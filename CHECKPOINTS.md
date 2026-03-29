# InferIQ — Build Checkpoints

> Resume any session by checking which CP is last marked ✅ and continue from the next one.

## Stack
- **Frontend:** React + Vite → GitHub Pages
- **Backend:** FastAPI + SQLite → Railway
- **Live Inference:** Groq free API (SSE streaming)
- **Experiment Tracking:** Langfuse cloud free
- **LLM Evals:** Arize Phoenix (self-hosted on Railway)
- **CI/CD:** GitHub Actions

---

## Checkpoints

| CP | What Gets Built | Status |
|---|---|---|
| CP01 | Project scaffold — folder structure, git init, `.env.example`, `railway.json`, `README.md` | ✅ |
| CP02 | Backend foundation — FastAPI app, SQLite setup, health endpoint, CORS, rate limiting | ✅ |
| CP03 | Benchmark pipeline — runner harness, metrics capture (TTFT, tokens/sec, VRAM), test prompts (QA/code/summarization), seed results JSON | ✅ |
| CP04 | Groq live inference — `/api/demo` SSE endpoint, streams two quant models side-by-side | ✅ |
| CP05 | Langfuse integration — log every inference call, experiment tracking per benchmark run | ✅ |
| CP06 | Arize Phoenix integration — LLM-as-judge evals, quality retention % vs fp16 baseline | ✅ |
| CP07 | Results API — `/api/results` filterable by model/quant/task, serves pre-computed benchmark matrix | ✅ |
| CP08 | Frontend scaffold — React + Vite, React Router, GitHub Actions CI/CD, GitHub Pages deploy | ✅ |
| CP09 | Landing page — hero, what/why/who, feature cards | ✅ |
| CP10 | Dashboard — leaderboard table, filters, VRAM vs quality scatter chart | ✅ |
| CP11 | Live demo panel — type a prompt, 2 quants respond in parallel with real TTFT shown | ✅ |
| CP12 | Hardware wizard — enter VRAM + quality bar → get deployment recommendation | ✅ |
| CP13 | Polish — findings section, methodology, Langfuse public link, mobile responsive | ⬜ |

---

## How to Resume
1. Check last ✅ checkpoint above
2. Tell Claude: _"Resume InferIQ from CP0X"_
3. Claude reads this file and picks up exactly where we left off
