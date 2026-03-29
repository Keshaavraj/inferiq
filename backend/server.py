import os
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from storage.database import init_db, get_all_results, log_demo
from agents.groq_client import stream_inference, DEMO_MODELS, DEFAULT_PAIR
from agents.langfuse_client import trace_demo_request, log_generation, flush
from agents.phoenix_client import setup_phoenix, get_phoenix_url, run_evals_for_demo

load_dotenv()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    setup_phoenix()
    yield
    flush()  # flush Langfuse events on shutdown


app = FastAPI(
    title="InferIQ API",
    description="LLM Quantization Benchmark & Live Inference API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "InferIQ API",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "phoenix_url": get_phoenix_url(),
    }


# ── Benchmark Results ──────────────────────────────────────────────────────────

@app.get("/api/results")
async def get_results(
    task_type: str = Query(None, description="qa | code | summarization"),
    quant_format: str = Query(None, description="gguf | awq | bitsandbytes | fp16"),
    model_name: str = Query(None, description="llama3.2-3b | phi3-mini | mistral-7b"),
):
    results = await get_all_results(task_type=task_type, quant_format=quant_format, model_name=model_name)
    return {"results": results, "count": len(results)}


@app.get("/api/results/summary")
async def get_summary():
    """Returns aggregated leaderboard — best quant per model per task."""
    all_results = await get_all_results()
    return {"summary": all_results}


@app.get("/api/results/models")
async def get_models():
    """Returns list of distinct models and quant formats in the DB."""
    all_results = await get_all_results()
    models = list({r["model_name"] for r in all_results})
    quant_formats = list({r["quant_format"] for r in all_results})
    quant_levels = list({r["quant_level"] for r in all_results})
    return {"models": models, "quant_formats": quant_formats, "quant_levels": quant_levels}


# ── Hardware Wizard ────────────────────────────────────────────────────────────

@app.get("/api/wizard")
async def wizard(
    vram_gb: float = Query(..., description="Available VRAM in GB"),
    quality_min: float = Query(80.0, description="Minimum quality retention % (0-100)"),
    task_type: str = Query("qa", description="qa | code | summarization"),
):
    all_results = await get_all_results(task_type=task_type)

    # Filter: fits in VRAM + meets quality bar
    candidates = [
        r for r in all_results
        if r["vram_mb"] <= vram_gb * 1024
        and r["quality_retention_pct"] >= quality_min
    ]

    if not candidates:
        return {"recommendation": None, "message": "No matching configuration found. Try lowering quality threshold."}

    # Rank by efficiency: quality_retention / vram
    best = max(candidates, key=lambda r: r["quality_retention_pct"] / (r["vram_mb"] / 1024))

    return {
        "recommendation": best,
        "message": f"Best match: {best['model_name']} {best['quant_level']} — {best['quality_retention_pct']}% quality at {best['vram_mb']/1024:.1f} GB VRAM",
    }


# ── Evals ─────────────────────────────────────────────────────────────────────

class EvalRequest(BaseModel):
    prompt: str
    response_a: str
    response_b: str
    model_a_label: str = "Model A"
    model_b_label: str = "Model B"


@app.post("/api/evals")
@limiter.limit("10/minute")
async def run_evals(request: Request, body: EvalRequest):
    """
    Runs LLM-as-judge coherence evals on two responses in parallel.
    Called after a live demo completes to show quality scores.
    All eval calls are auto-traced by Phoenix via OTel instrumentation.
    """
    evals = await run_evals_for_demo(
        prompt=body.prompt,
        response_a=body.response_a,
        response_b=body.response_b,
        model_a_label=body.model_a_label,
        model_b_label=body.model_b_label,
    )
    return {"evals": evals}


# ── Demo Models List ───────────────────────────────────────────────────────────

@app.get("/api/demo/models")
async def demo_models():
    """Returns available model pairs for live demo."""
    return {"models": DEMO_MODELS, "default_pair": DEFAULT_PAIR}


# ── Live Inference SSE ─────────────────────────────────────────────────────────

class DemoRequest(BaseModel):
    prompt: str
    model_a: str = DEFAULT_PAIR[0]
    model_b: str = DEFAULT_PAIR[1]
    max_tokens: int = 300

    model_config = {"json_schema_extra": {"example": {
        "prompt": "Explain what quantization does to an LLM in 3 sentences.",
        "model_a": "llama3.2-3b-q4",
        "model_b": "llama3.1-8b-q4",
    }}}


@app.post("/api/demo")
@limiter.limit("20/minute")
async def demo(request: Request, body: DemoRequest):
    """
    SSE stream — runs two model inferences in parallel.
    Each SSE event is a JSON object with a 'model' field (a or b) + payload.

    Event format:
        data: {"model": "a", "type": "token", "data": "..."}\n\n
        data: {"model": "b", "type": "metrics", "data": {...}}\n\n
        data: [DONE]\n\n
    """
    if len(body.prompt.strip()) < 3:
        raise HTTPException(status_code=400, detail="Prompt too short.")
    if len(body.prompt) > 500:
        raise HTTPException(status_code=400, detail="Prompt too long (max 500 chars).")

    results = {"a": {"response": "", "metrics": {}}, "b": {"response": "", "metrics": {}}}
    lf_trace = trace_demo_request(
        session_id=request.client.host,
        prompt=body.prompt,
        model_a_key=body.model_a,
        model_b_key=body.model_b,
    )

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()

        async def run_model(side: str, model_key: str):
            async for event in stream_inference(model_key, body.prompt, body.max_tokens):
                await queue.put((side, event))
            await queue.put((side, None))  # sentinel

        task_a = asyncio.create_task(run_model("a", body.model_a))
        task_b = asyncio.create_task(run_model("b", body.model_b))

        done_count = 0
        while done_count < 2:
            side, event = await queue.get()
            if event is None:
                done_count += 1
                continue

            # Track for demo logging
            if event["type"] == "token":
                results[side]["response"] += event["data"]
            elif event["type"] == "metrics":
                results[side]["metrics"] = event["data"]

            payload = json.dumps({"model": side, **event})
            yield f"data: {payload}\n\n"

        # Log generations to Langfuse
        for side, model_key in [("a", body.model_a), ("b", body.model_b)]:
            m = results[side]["metrics"]
            model_cfg = DEMO_MODELS.get(model_key, {})
            log_generation(
                trace=lf_trace,
                model_key=model_key,
                model_label=model_cfg.get("label", model_key),
                prompt=body.prompt,
                response=results[side]["response"],
                ttft_ms=m.get("ttft_ms", 0),
                tokens_per_sec=m.get("tokens_per_sec", 0),
                total_tokens=m.get("total_tokens", 0),
            )

        # Log to DB
        await log_demo({
            "session_id": request.client.host,
            "prompt": body.prompt,
            "model_a": body.model_a,
            "model_b": body.model_b,
            "response_a": results["a"]["response"],
            "response_b": results["b"]["response"],
            "ttft_a_ms": results["a"]["metrics"].get("ttft_ms"),
            "ttft_b_ms": results["b"]["metrics"].get("ttft_ms"),
            "tokens_sec_a": results["a"]["metrics"].get("tokens_per_sec"),
            "tokens_sec_b": results["b"]["metrics"].get("tokens_per_sec"),
        })

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
