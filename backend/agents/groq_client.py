"""
Groq API client for live inference demo.
Maps our quant "models" to actual Groq-hosted model IDs.
Groq serves highly optimized models — we use it to demonstrate
real streaming inference with TTFT measurement.
"""

import os
import time
import asyncio
from groq import AsyncGroq

# Maps display label → Groq model ID
DEMO_MODELS = {
    "llama3.2-3b-q4": {
        "label": "Llama 3.2 3B (Q4 equiv)",
        "groq_id": "llama-3.2-3b-preview",
        "quant_note": "Groq runs quantized inference internally (~Q4 efficiency)",
        "vram_est_mb": 2050,
    },
    "llama3.2-3b-q8": {
        "label": "Llama 3.2 3B (Q8 equiv)",
        "groq_id": "llama-3.2-3b-preview",
        "quant_note": "Same model, higher precision mode simulation",
        "vram_est_mb": 3300,
    },
    "llama3.1-8b-q4": {
        "label": "Llama 3.1 8B (Q4 equiv)",
        "groq_id": "llama-3.1-8b-instant",
        "quant_note": "8B model at 4-bit quantization",
        "vram_est_mb": 4800,
    },
    "mixtral-q4": {
        "label": "Mixtral 8x7B (Q4 equiv)",
        "groq_id": "mixtral-8x7b-32768",
        "quant_note": "MoE model, efficient at inference despite param count",
        "vram_est_mb": 6200,
    },
}

DEFAULT_PAIR = ("llama3.2-3b-q4", "llama3.1-8b-q4")


async def stream_inference(
    model_key: str,
    prompt: str,
    max_tokens: int = 300,
):
    """
    Streams a single model inference via Groq.
    Yields dicts: {type, data}
      - type="meta"    → model info
      - type="token"   → one token chunk
      - type="metrics" → final TTFT + tokens/sec
      - type="done"    → stream complete
    """
    client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    model_cfg = DEMO_MODELS.get(model_key)
    if not model_cfg:
        yield {"type": "error", "data": f"Unknown model key: {model_key}"}
        return

    yield {"type": "meta", "data": {
        "model_key": model_key,
        "label": model_cfg["label"],
        "groq_id": model_cfg["groq_id"],
        "quant_note": model_cfg["quant_note"],
        "vram_est_mb": model_cfg["vram_est_mb"],
    }}

    start_time = time.perf_counter()
    first_token_time = None
    token_count = 0
    full_response = ""

    try:
        stream = await client.chat.completions.create(
            model=model_cfg["groq_id"],
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                if first_token_time is None:
                    first_token_time = time.perf_counter()
                token_count += 1
                full_response += delta
                yield {"type": "token", "data": delta}

    except Exception as e:
        yield {"type": "error", "data": str(e)}
        return

    end_time = time.perf_counter()
    ttft_ms = round((first_token_time - start_time) * 1000, 2) if first_token_time else 0
    total_s = end_time - start_time
    tokens_per_sec = round(token_count / total_s, 2) if total_s > 0 else 0

    yield {"type": "metrics", "data": {
        "ttft_ms": ttft_ms,
        "tokens_per_sec": tokens_per_sec,
        "total_tokens": token_count,
        "total_ms": round(total_s * 1000, 2),
    }}
    yield {"type": "done", "data": full_response}
