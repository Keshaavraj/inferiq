# InferIQ

**LLM Quantization Benchmark & Deployment Decision Engine**

> Evidence over advice. Real numbers on real hardware.

InferIQ answers the question every on-premise AI team faces:
*"Which model + quantization should we deploy given our hardware and quality requirements?"*

## Live Demo
🔗 [inferiq.github.io/inferiq](#) *(coming soon)*

## What It Does
- Benchmarks GGUF (Q3/Q4/Q5/Q8), AWQ 4-bit, bitsandbytes INT4/INT8, and fp16 baseline
- Measures TTFT, tokens/sec, VRAM footprint, and quality retention per task type
- Evaluates output quality via LLM-as-judge (Arize Phoenix) across QA, code gen, and summarization
- Tracks all experiment runs in Langfuse
- Interactive dashboard: filter by hardware profile, task type, quality threshold
- Live side-by-side inference demo (powered by Groq)
- Hardware wizard: enter your VRAM → get a deployment recommendation

## Stack
| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite → GitHub Pages |
| Backend | FastAPI + SQLite → Railway |
| Live Inference | Groq API (free tier) |
| LLM Evals | Arize Phoenix |
| Experiment Tracking | Langfuse |
| CI/CD | GitHub Actions |

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your GROQ_API_KEY
uvicorn server:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
echo "VITE_BACKEND_URL=http://localhost:8000" > .env.local
npm run dev
```

## Hardware Tested
- NVIDIA RTX 500 Ada Generation — 4 GB VRAM
- Represents real-world edge / on-premise deployment constraints

## Build Progress
See [CHECKPOINTS.md](./CHECKPOINTS.md)
