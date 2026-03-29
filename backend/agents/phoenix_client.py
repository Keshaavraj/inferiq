"""
Arize Phoenix integration for InferIQ.

Two responsibilities:
1. Auto-instrument all Groq API calls via OpenTelemetry (zero-code tracing)
2. Run LLM-as-judge evals on benchmark outputs — coherence, faithfulness,
   and quality-vs-reference scoring

Phoenix is self-hosted on Railway at $PHOENIX_HOST:$PHOENIX_PORT.
Falls back gracefully if Phoenix is not reachable.
"""

import os
from typing import Optional

_phoenix_session = None
_tracer_provider = None


# ── Phoenix server + OTel instrumentation ──────────────────────────────────────

def setup_phoenix():
    """
    Launches/connects to Phoenix and instruments Groq calls via OTel.
    Call once at app startup.
    """
    global _phoenix_session, _tracer_provider

    host = os.getenv("PHOENIX_HOST", "0.0.0.0")
    port = int(os.getenv("PHOENIX_PORT", "6006"))

    try:
        import phoenix as px
        from phoenix.otel import register
        from openinference.instrumentation.groq import GroqInstrumentor

        # Connect to existing Phoenix instance (Railway) or launch locally
        phoenix_endpoint = os.getenv("PHOENIX_COLLECTOR_ENDPOINT")

        if phoenix_endpoint:
            # Production: Phoenix running as separate Railway service
            tracer_provider = register(
                project_name="inferiq",
                endpoint=phoenix_endpoint,
            )
        else:
            # Development: launch Phoenix in-process
            _phoenix_session = px.launch_app(host=host, port=port)
            tracer_provider = register(project_name="inferiq")

        _tracer_provider = tracer_provider

        # Auto-instrument all Groq SDK calls
        GroqInstrumentor().instrument(tracer_provider=tracer_provider)

        print(f"Phoenix initialized — project: inferiq")
        if _phoenix_session:
            print(f"Phoenix UI: http://{host}:{port}")

    except Exception as e:
        print(f"Phoenix setup skipped: {e}")


def get_phoenix_url() -> Optional[str]:
    """Returns Phoenix UI URL if running locally."""
    if _phoenix_session:
        host = os.getenv("PHOENIX_HOST", "localhost")
        port = os.getenv("PHOENIX_PORT", "6006")
        return f"http://{host}:{port}"
    endpoint = os.getenv("PHOENIX_COLLECTOR_ENDPOINT")
    if endpoint:
        return endpoint.replace("/v1/traces", "")
    return None


# ── LLM-as-judge evals ─────────────────────────────────────────────────────────

COHERENCE_EVAL_PROMPT = """
You are an expert evaluator assessing the coherence and quality of an AI-generated response.

Question asked: {question}
AI Response: {response}

Rate the response on the following criteria (1-5 scale):
- Coherence: Is the response logically structured and easy to follow?
- Accuracy: Does the response appear factually correct?
- Completeness: Does the response fully address the question?

Respond with ONLY a JSON object:
{{"coherence": <1-5>, "accuracy": <1-5>, "completeness": <1-5>, "overall": <1-5>, "reasoning": "<one sentence>"}}
"""

QUALITY_COMPARISON_PROMPT = """
You are evaluating two AI responses to the same question — one from a full-precision model (fp16) and one from a quantized model.

Question: {question}
Reference response (fp16 full precision): {reference}
Quantized model response: {response}

How well does the quantized response preserve the quality of the reference?
Score from 0-100 where 100 = identical quality, 0 = completely different/wrong.

Respond with ONLY a JSON object:
{{"quality_retention": <0-100>, "key_differences": "<one sentence>", "recommendation": "use" | "caution" | "avoid"}}
"""


async def eval_coherence(question: str, response: str) -> dict:
    """
    Runs LLM-as-judge coherence eval via Groq.
    Returns scores dict or empty dict on failure.
    """
    if not response.strip():
        return {}

    try:
        import json
        from groq import AsyncGroq

        client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        prompt = COHERENCE_EVAL_PROMPT.format(question=question, response=response)

        result = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.1,
        )

        raw = result.choices[0].message.content.strip()
        # Extract JSON from response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception as e:
        print(f"Coherence eval failed: {e}")

    return {}


async def eval_quality_retention(question: str, reference: str, response: str) -> dict:
    """
    Runs LLM-as-judge quality retention eval — quantized vs fp16 baseline.
    Returns quality_retention score (0-100) and recommendation.
    """
    if not response.strip() or not reference.strip():
        return {}

    try:
        import json
        from groq import AsyncGroq

        client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        prompt = QUALITY_COMPARISON_PROMPT.format(
            question=question,
            reference=reference,
            response=response,
        )

        result = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.1,
        )

        raw = result.choices[0].message.content.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception as e:
        print(f"Quality retention eval failed: {e}")

    return {}


async def run_evals_for_demo(
    prompt: str,
    response_a: str,
    response_b: str,
    model_a_label: str,
    model_b_label: str,
) -> dict:
    """
    Runs coherence evals on both demo responses in parallel.
    Returns {model_a: scores, model_b: scores}.
    """
    import asyncio

    eval_a, eval_b = await asyncio.gather(
        eval_coherence(prompt, response_a),
        eval_coherence(prompt, response_b),
    )

    return {
        "model_a": {"label": model_a_label, "eval": eval_a},
        "model_b": {"label": model_b_label, "eval": eval_b},
    }
