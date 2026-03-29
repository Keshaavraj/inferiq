"""
Langfuse integration for InferIQ.
Tracks:
  - Every live demo inference (trace per demo request, one generation per model)
  - Every benchmark run (trace per run, generation per prompt)
  - Key metrics as scores: ttft_ms, tokens_per_sec, quality_retention_pct

Lazy-initialized — safe to import even without keys set.
"""

import os
from typing import Optional

_langfuse = None


def get_langfuse():
    """Returns a Langfuse client, lazy-initialized. Returns None if keys not set."""
    global _langfuse
    if _langfuse is not None:
        return _langfuse

    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

    if not public_key or not secret_key:
        return None

    try:
        from langfuse import Langfuse
        _langfuse = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
        )
        return _langfuse
    except Exception:
        return None


def trace_demo_request(
    session_id: str,
    prompt: str,
    model_a_key: str,
    model_b_key: str,
) -> Optional[object]:
    """
    Creates a Langfuse trace for a live demo request.
    Returns the trace object (to attach generations to), or None.
    """
    lf = get_langfuse()
    if not lf:
        return None

    trace = lf.trace(
        name="inferiq-live-demo",
        session_id=session_id,
        input={"prompt": prompt},
        metadata={
            "model_a": model_a_key,
            "model_b": model_b_key,
            "source": "live_demo",
        },
        tags=["live-demo", "inferiq"],
    )
    return trace


def log_generation(
    trace,
    model_key: str,
    model_label: str,
    prompt: str,
    response: str,
    ttft_ms: float,
    tokens_per_sec: float,
    total_tokens: int,
):
    """Logs one model generation under a trace."""
    if not trace:
        return

    gen = trace.generation(
        name=f"inference-{model_key}",
        model=model_label,
        input=[{"role": "user", "content": prompt}],
        output=response,
        metadata={
            "ttft_ms": ttft_ms,
            "tokens_per_sec": tokens_per_sec,
            "total_tokens": total_tokens,
        },
    )

    # Log efficiency metrics as Langfuse scores
    lf = get_langfuse()
    if lf and gen:
        lf.score(
            trace_id=trace.id,
            observation_id=gen.id,
            name="ttft_ms",
            value=ttft_ms,
            comment="Time to first token in milliseconds",
        )
        lf.score(
            trace_id=trace.id,
            observation_id=gen.id,
            name="tokens_per_sec",
            value=tokens_per_sec,
            comment="Throughput tokens per second",
        )


def trace_benchmark_run(
    model_name: str,
    quant_level: str,
    task_type: str,
    prompt: str,
    response: str,
    quality_retention_pct: float,
    ttft_ms: float,
    tokens_per_sec: float,
    vram_mb: float,
    rouge_l: float,
):
    """Logs a single benchmark prompt run to Langfuse."""
    lf = get_langfuse()
    if not lf:
        return

    trace = lf.trace(
        name="inferiq-benchmark",
        input={"prompt": prompt},
        output={"response": response},
        metadata={
            "model_name": model_name,
            "quant_level": quant_level,
            "task_type": task_type,
            "vram_mb": vram_mb,
        },
        tags=["benchmark", task_type, model_name, quant_level, "inferiq"],
    )

    gen = trace.generation(
        name=f"benchmark-{model_name}-{quant_level}",
        model=f"{model_name}/{quant_level}",
        input=[{"role": "user", "content": prompt}],
        output=response,
        metadata={
            "ttft_ms": ttft_ms,
            "tokens_per_sec": tokens_per_sec,
            "vram_mb": vram_mb,
            "rouge_l": rouge_l,
        },
    )

    if gen:
        for name, value, comment in [
            ("quality_retention_pct", quality_retention_pct, "Quality vs fp16 baseline (%)"),
            ("ttft_ms", ttft_ms, "Time to first token (ms)"),
            ("tokens_per_sec", tokens_per_sec, "Throughput (tok/s)"),
            ("rouge_l", rouge_l * 100, "ROUGE-L score (scaled 0-100)"),
            ("vram_mb", vram_mb, "Peak VRAM usage (MB)"),
        ]:
            lf.score(
                trace_id=trace.id,
                observation_id=gen.id,
                name=name,
                value=value,
                comment=comment,
            )


def flush():
    """Flush pending Langfuse events. Call on app shutdown."""
    lf = get_langfuse()
    if lf:
        lf.flush()
