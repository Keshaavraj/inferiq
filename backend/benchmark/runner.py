"""
Benchmark runner — orchestrates runs across model + quant combinations.
Designed to run locally on RTX 500 Ada (4GB VRAM).

Usage:
    python -m benchmark.runner --model llama3.2-3b --quant gguf-q4_k_m
    python -m benchmark.runner --seed   # load pre-computed seed data
"""

import asyncio
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from benchmark.tasks import ALL_TASKS
from benchmark.metrics import (
    BenchmarkTimer, rouge_l_score, compute_consistency_score,
    get_peak_vram_mb, get_ram_usage_mb, reset_vram_peak, count_tokens
)
from storage.database import init_db, insert_result

HARDWARE = "NVIDIA RTX 500 Ada Generation — 4GB VRAM"
SEED_FILE = Path(__file__).parent.parent.parent / "benchmarks" / "seed_results.json"


# ── Seed loader ────────────────────────────────────────────────────────────────

async def load_seed_data():
    """Load pre-computed benchmark results from seed JSON into SQLite."""
    if not SEED_FILE.exists():
        print(f"Seed file not found: {SEED_FILE}")
        return

    with open(SEED_FILE) as f:
        seed = json.load(f)

    await init_db()
    count = 0
    for result in seed["results"]:
        await insert_result(result)
        count += 1

    print(f"Loaded {count} seed benchmark results into SQLite.")


# ── Live runner (for local benchmark execution) ────────────────────────────────

async def run_benchmark(model_id: str, quant_config: dict, task_type: str):
    """
    Run benchmark for a single model + quant + task_type combination.
    Returns a list of result dicts (one per prompt).
    """
    tasks = ALL_TASKS[task_type]
    results = []

    print(f"\n{'='*60}")
    print(f"Benchmarking: {model_id} | {quant_config['label']} | {task_type}")
    print(f"{'='*60}")

    # Load model based on quant_format
    model_fn = _load_model(quant_config)
    if model_fn is None:
        print(f"  Skipping — model loader not available for {quant_config['format']}")
        return []

    fp16_outputs = _get_fp16_baseline(model_id, task_type)

    for task in tasks:
        outputs = []
        ttfts = []
        tps_list = []

        reset_vram_peak()

        # Run 3 times for consistency score
        for run in range(3):
            timer = BenchmarkTimer()
            timer.start()

            output = await model_fn(task["prompt"], timer)

            timer.stop()
            token_count = count_tokens(output)

            outputs.append(output)
            ttfts.append(timer.ttft_ms)
            tps_list.append(timer.tokens_per_sec(token_count))

        avg_ttft = round(sum(ttfts) / len(ttfts), 2)
        avg_tps = round(sum(tps_list) / len(tps_list), 2)
        peak_vram = get_peak_vram_mb()
        ram = get_ram_usage_mb()

        # Quality metrics
        ref = task["reference"]
        rouge = rouge_l_score(outputs[0], ref)
        fp16_rouge = rouge_l_score(fp16_outputs.get(task["id"], outputs[0]), ref)
        quality_retention = round((rouge / fp16_rouge * 100) if fp16_rouge > 0 else 100.0, 2)
        consistency = compute_consistency_score(outputs)

        result = {
            "model_name": model_id,
            "quant_format": quant_config["format"],
            "quant_level": quant_config["level"],
            "task_type": task_type,
            "ttft_ms": avg_ttft,
            "tokens_per_sec": avg_tps,
            "vram_mb": peak_vram,
            "ram_mb": ram,
            "quality_score": round(rouge * 100, 2),
            "quality_retention_pct": quality_retention,
            "rouge_l": rouge,
            "consistency_score": consistency,
            "hardware": HARDWARE,
            "run_at": datetime.utcnow().isoformat(),
            "notes": quant_config.get("notes", ""),
        }

        print(f"  [{task['id']}] TTFT:{avg_ttft}ms | {avg_tps}tok/s | VRAM:{peak_vram:.0f}MB | Quality:{quality_retention}%")
        results.append(result)

    return results


def _load_model(quant_config: dict):
    """Returns an async callable (prompt, timer) -> str for the given quant format."""
    fmt = quant_config["format"]

    if fmt == "gguf":
        return _make_gguf_runner(quant_config)
    elif fmt == "bitsandbytes":
        return _make_bnb_runner(quant_config)
    elif fmt == "awq":
        return _make_awq_runner(quant_config)
    elif fmt == "fp16":
        return _make_fp16_runner(quant_config)
    return None


def _make_gguf_runner(config: dict):
    try:
        from llama_cpp import Llama
        llm = Llama(model_path=config["model_path"], n_gpu_layers=config.get("n_gpu_layers", -1), verbose=False)

        async def run(prompt: str, timer: BenchmarkTimer) -> str:
            output_tokens = []
            for token in llm(prompt, max_tokens=256, stream=True):
                if not output_tokens:
                    timer.record_first_token()
                output_tokens.append(token["choices"][0]["text"])
            return "".join(output_tokens)

        return run
    except Exception as e:
        print(f"  GGUF load failed: {e}")
        return None


def _make_bnb_runner(config: dict):
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=config.get("bits", 4) == 4,
            load_in_8bit=config.get("bits", 4) == 8,
            bnb_4bit_compute_dtype=torch.float16,
        )
        tokenizer = AutoTokenizer.from_pretrained(config["model_id"])
        model = AutoModelForCausalLM.from_pretrained(
            config["model_id"], quantization_config=bnb_config, device_map="auto"
        )

        async def run(prompt: str, timer: BenchmarkTimer) -> str:
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            timer.record_first_token()
            with torch.no_grad():
                outputs = model.generate(**inputs, max_new_tokens=256)
            return tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

        return run
    except Exception as e:
        print(f"  bitsandbytes load failed: {e}")
        return None


def _make_awq_runner(config: dict):
    try:
        from awq import AutoAWQForCausalLM
        from transformers import AutoTokenizer

        model = AutoAWQForCausalLM.from_quantized(config["model_id"], fuse_layers=True)
        tokenizer = AutoTokenizer.from_pretrained(config["model_id"])

        async def run(prompt: str, timer: BenchmarkTimer) -> str:
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            timer.record_first_token()
            outputs = model.generate(**inputs, max_new_tokens=256)
            return tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

        return run
    except Exception as e:
        print(f"  AWQ load failed: {e}")
        return None


def _make_fp16_runner(config: dict):
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(config["model_id"])
        model = AutoModelForCausalLM.from_pretrained(
            config["model_id"], torch_dtype=torch.float16, device_map="auto"
        )

        async def run(prompt: str, timer: BenchmarkTimer) -> str:
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            timer.record_first_token()
            with torch.no_grad():
                outputs = model.generate(**inputs, max_new_tokens=256)
            return tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)

        return run
    except Exception as e:
        print(f"  fp16 load failed: {e}")
        return None


def _get_fp16_baseline(model_id: str, task_type: str) -> dict:
    """Returns cached fp16 outputs keyed by task_id. Falls back to empty dict."""
    cache_path = Path(__file__).parent.parent.parent / "benchmarks" / f"fp16_baseline_{model_id.replace('/', '_')}_{task_type}.json"
    if cache_path.exists():
        with open(cache_path) as f:
            return json.load(f)
    return {}


# ── CLI entrypoint ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="InferIQ Benchmark Runner")
    parser.add_argument("--seed", action="store_true", help="Load seed data into SQLite")
    parser.add_argument("--model", type=str, help="Model ID to benchmark")
    parser.add_argument("--quant", type=str, help="Quant config key")
    parser.add_argument("--task", type=str, default="qa", choices=["qa", "code", "summarization"])
    args = parser.parse_args()

    if args.seed:
        asyncio.run(load_seed_data())
    else:
        print("Use --seed to load pre-computed data, or --model + --quant for live runs.")
