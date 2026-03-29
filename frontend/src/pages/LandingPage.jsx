import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getResults, getWizardRecommendation } from "../utils/api";
import "../styles/landing.css";

const FEATURES = [
  {
    icon: "⚡",
    title: "Real Hardware Benchmarks",
    desc: "Every number measured on an actual RTX 500 Ada (4 GB VRAM) — not estimates or cloud A100 results. Reproducible on your hardware.",
  },
  {
    icon: "🔬",
    title: "LLM-as-Judge Evals",
    desc: "Coherence, accuracy, and completeness scored by an independent LLM judge via Arize Phoenix. Not just ROUGE — actual quality assessment.",
  },
  {
    icon: "📊",
    title: "Task-Aware Quality",
    desc: "Quality degradation differs by task. Code gen loses 20% at INT4 while QA loses only 6%. Pick the right tradeoff for your use case.",
  },
  {
    icon: "🧠",
    title: "Hardware Wizard",
    desc: "Enter your VRAM and minimum quality bar — get an instant deployment recommendation with efficiency score.",
  },
  {
    icon: "🔴",
    title: "Live Side-by-Side Demo",
    desc: "Type a prompt, watch two quantizations respond in parallel. Real TTFT timers, real tokens/sec. Evidence you can see.",
  },
  {
    icon: "🔭",
    title: "Full Observability",
    desc: "Every inference traced in Arize Phoenix. Every benchmark run tracked in Langfuse. Auditable, reproducible, transparent.",
  },
];

const STACK = [
  "llama.cpp / GGUF", "bitsandbytes INT4/INT8", "AutoAWQ",
  "HuggingFace Transformers", "Groq API", "Arize Phoenix",
  "Langfuse", "FastAPI", "React 19", "Recharts",
  "RTX 500 Ada 4GB", "Railway", "GitHub Pages",
];

const QUALITY_COLOR = (pct) => {
  if (pct >= 95) return "var(--green)";
  if (pct >= 88) return "var(--yellow)";
  return "var(--red)";
};

const VRAM_PRESETS = [2, 4, 6, 8, 16];

export default function LandingPage() {
  const navigate = useNavigate();

  // Live leaderboard
  const [liveResults, setLiveResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(true);

  // Mini wizard
  const [wizardVram, setWizardVram] = useState(4);
  const [wizardQuality, setWizardQuality] = useState(90);
  const [wizardTask, setWizardTask] = useState("qa");
  const [wizardResult, setWizardResult] = useState(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardRan, setWizardRan] = useState(false);

  useEffect(() => {
    getResults()
      .then((r) => {
        const sorted = [...r.data.results]
          .filter((x) => x.quant_format !== "fp16")
          .sort((a, b) => b.quality_retention_pct - a.quality_retention_pct)
          .slice(0, 6);
        setLiveResults(sorted);
        setResultsLoading(false);
      })
      .catch(() => setResultsLoading(false));
  }, []);

  function handleWizard() {
    setWizardLoading(true);
    setWizardResult(null);
    getWizardRecommendation(wizardVram, wizardQuality, wizardTask)
      .then((r) => { setWizardResult(r.data); setWizardLoading(false); setWizardRan(true); })
      .catch(() => setWizardLoading(false));
  }

  return (
    <div>
      {/* ── Nav ── */}
      <nav className="nav">
        <span className="nav-logo">Infer<span>IQ</span></span>
        <div className="nav-links">
          <a href="#how" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>How it works</a>
          <a
            href="https://github.com/keshaavraj/inferiq"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ padding: "8px 16px", fontSize: 13 }}
          >
            GitHub
          </a>
          <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: 13 }} onClick={() => navigate("/dashboard")}>
            Open Dashboard
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg" />
        <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
          <div className="hero-eyebrow">
            Evidence over advice — real numbers on real hardware
          </div>

          <h1 className="hero-title">
            Which LLM quantization<br />
            should you <span className="highlight">actually deploy?</span>
          </h1>

          <p className="hero-subtitle">
            InferIQ benchmarks GGUF, AWQ, bitsandbytes INT4/INT8 and fp16 across
            Llama and Mistral models — measuring TTFT, throughput, VRAM footprint,
            and quality retention on edge hardware. So you can decide with data.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
              Explore Benchmarks
            </button>
            <button className="btn btn-outline" onClick={() => navigate("/dashboard#demo")}>
              Try Live Demo
            </button>
          </div>

          <div className="hero-stats container">
            <div className="hero-stat">
              <span className="hero-stat-value">3</span>
              <div className="hero-stat-label">Models Tested</div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">8</span>
              <div className="hero-stat-label">Quant Formats</div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">26</span>
              <div className="hero-stat-label">Benchmark Runs</div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">4 GB</span>
              <div className="hero-stat-label">Max VRAM Used</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="problem-section">
        <div className="container problem-quote">
          <blockquote>
            "We can't send our data to OpenAI. What's the best open-source model
            we can actually run on our hardware?"
          </blockquote>
          <p style={{ marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
            — Every on-premise AI team in finance, healthcare, and government
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <div className="container">
          <p className="section-title" style={{ textAlign: "center" }}>Built to answer real deployment questions</p>
          <p className="section-sub" style={{ textAlign: "center" }}>
            Anyone can ask an LLM which quantization to use. InferIQ measures it.
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Leaderboard Preview ── */}
      <section className="preview-section">
        <div className="container">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Live benchmark results</p>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {resultsLoading ? "fetching from API…" : `${liveResults.length} results · live data`}
            </span>
          </div>
          <p className="section-sub">Quality retention % = model score ÷ fp16 baseline × 100. Sorted by quality.</p>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {resultsLoading ? (
              <div style={{ padding: "40px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-muted)", fontSize: 13 }}>
                <div className="spinner" /> Fetching live data from API…
              </div>
            ) : (
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Model</th>
                    <th>Quantization</th>
                    <th>VRAM</th>
                    <th>Tok/sec</th>
                    <th>Task</th>
                    <th>Quality Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {liveResults.map((r, i) => {
                    const qPct = r.quality_retention_pct;
                    const color = QUALITY_COLOR(qPct);
                    return (
                      <tr key={i}>
                        <td style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                        <td className="model-col">{r.model_name}</td>
                        <td className="quant-col">{r.quant_level}</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{(r.vram_mb / 1024).toFixed(1)} GB</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.tokens_per_sec}</td>
                        <td><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{r.task_type}</span></td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                              <div style={{ width: `${qPct}%`, height: "100%", background: color, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color, minWidth: 42 }}>{qPct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button className="btn btn-outline" onClick={() => navigate("/dashboard")}>
              View full benchmark matrix + charts
            </button>
          </div>
        </div>
      </section>

      {/* ── Mini Wizard ── */}
      <section className="preview-section" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <p className="section-title">Try it now — what should you deploy?</p>
          <p className="section-sub">Enter your hardware constraints and get a recommendation instantly.</p>

          <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
            {/* Controls row */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>VRAM Available</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {VRAM_PRESETS.map((v) => (
                    <button key={v} onClick={() => setWizardVram(v)} style={{
                      padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", border: "1px solid",
                      borderColor: wizardVram === v ? "var(--accent)" : "var(--border)",
                      background: wizardVram === v ? "var(--accent-dim)" : "var(--bg-secondary)",
                      color: wizardVram === v ? "var(--accent)" : "var(--text-secondary)",
                    }}>
                      {v} GB
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Min Quality</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[80, 90, 95].map((q) => (
                    <button key={q} onClick={() => setWizardQuality(q)} style={{
                      padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", border: "1px solid",
                      borderColor: wizardQuality === q ? QUALITY_COLOR(q) : "var(--border)",
                      background: wizardQuality === q ? `${QUALITY_COLOR(q)}18` : "var(--bg-secondary)",
                      color: wizardQuality === q ? QUALITY_COLOR(q) : "var(--text-secondary)",
                    }}>
                      {q}%
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Task</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["qa", "code", "summarization"].map((t) => (
                    <button key={t} onClick={() => setWizardTask(t)} style={{
                      padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", border: "1px solid",
                      borderColor: wizardTask === t ? "var(--purple)" : "var(--border)",
                      background: wizardTask === t ? "rgba(167,139,250,0.12)" : "var(--bg-secondary)",
                      color: wizardTask === t ? "var(--purple)" : "var(--text-secondary)",
                    }}>
                      {t === "qa" ? "Q&A" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleWizard} disabled={wizardLoading}
              style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
              {wizardLoading
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Finding best match…</>
                : "Get My Recommendation"}
            </button>

            {/* Result */}
            {wizardRan && wizardResult && (
              <div style={{ marginTop: 20 }}>
                {!wizardResult.recommendation ? (
                  <div style={{ padding: 16, background: "rgba(251,191,36,0.06)", border: "1px solid var(--yellow)", borderRadius: 8, fontSize: 13, color: "var(--yellow)" }}>
                    {wizardResult.message}
                  </div>
                ) : (
                  <div style={{
                    padding: "20px", background: "var(--accent-dim)",
                    border: "1px solid var(--accent)", borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Recommended</div>
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>
                        {wizardResult.recommendation.model_name}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--purple)", marginTop: 2 }}>
                        {wizardResult.recommendation.quant_level}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {[
                        { label: "Quality", value: `${wizardResult.recommendation.quality_retention_pct}%`, color: QUALITY_COLOR(wizardResult.recommendation.quality_retention_pct) },
                        { label: "VRAM", value: `${(wizardResult.recommendation.vram_mb / 1024).toFixed(1)} GB`, color: "var(--accent)" },
                        { label: "Tok/s", value: wizardResult.recommendation.tokens_per_sec, color: "var(--text-secondary)" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-outline" onClick={() => navigate("/dashboard#demo")} style={{ fontSize: 12 }}>
                      See live demo →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="how-section" id="how">
        <div className="container">
          <p className="section-title" style={{ textAlign: "center" }}>How InferIQ works</p>
          <p className="section-sub" style={{ textAlign: "center" }}>From local GPU run to deployment recommendation</p>
          <div className="steps">
            {[
              { n: "01", title: "Benchmark pipeline", desc: "GGUF, AWQ, bitsandbytes, and fp16 models loaded and run against 15 curated prompts across QA, code generation, and summarization tasks." },
              { n: "02", title: "Metrics captured", desc: "TTFT, tokens/sec, peak VRAM, RAM usage, ROUGE-L vs reference, and consistency score across 3 runs per prompt." },
              { n: "03", title: "Quality evaluated", desc: "Arize Phoenix runs LLM-as-judge coherence evals. Quality retention % computed vs fp16 baseline per task type." },
              { n: "04", title: "You decide with data", desc: "Filter by VRAM budget, task type, and quality threshold. Hardware wizard gives you a ranked recommendation instantly." },
            ].map((s) => (
              <div className="step" key={s.n}>
                <span className="step-num">{s.n}</span>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hardware callout ── */}
      <section className="hardware-section">
        <div className="container">
          <div className="hardware-card">
            <div className="hardware-badge">
              NVIDIA RTX 500 Ada Generation<br />
              4 GB VRAM · CUDA 13.0<br />
              Ada Lovelace Architecture
            </div>
            <div className="hardware-text">
              <h3>Benchmarked on real edge hardware</h3>
              <p>
                All results were measured on an RTX 500 Ada — a 4 GB VRAM laptop GPU,
                representative of the hardware available in most on-premise deployments.
                Not an A100. Not a cloud cluster. The hardware your team actually has.
                This makes the results directly applicable to real-world constrained deployments
                in finance, healthcare, and government — where data sovereignty prevents cloud use.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Audience ── */}
      <section className="audience-section">
        <div className="container">
          <p className="section-title" style={{ textAlign: "center" }}>Is InferIQ for you?</p>
          <p className="section-sub" style={{ textAlign: "center" }}>
            Honest answer — it depends on your deployment context.
          </p>

          <div className="audience-grid">

            {/* For you */}
            <div className="audience-card audience-card-for">
              <div className="audience-card-label">✓ Built for you</div>
              <h3>If you're deploying LLMs on-premise</h3>
              <div className="audience-items">
                {[
                  { icon: "🏦", title: "Finance / Healthcare / Government", desc: "Data sovereignty laws prevent sending data to OpenAI. You need local inference.", tag: "on-prem" },
                  { icon: "💻", title: "Edge device (2–4 GB VRAM)", desc: "Laptop GPU, Jetson, embedded server. Every MB counts.", tag: "4 GB VRAM" },
                  { icon: "🖥️", title: "Mid-range server (6–16 GB VRAM)", desc: "RTX 3060–4090, A4000. Want to run 7B models efficiently.", tag: "8–16 GB VRAM" },
                  { icon: "⚙️", title: "CPU-only deployment", desc: "No GPU at all. llama.cpp GGUF Q3/Q4 is your path.", tag: "CPU offload" },
                ].map((item) => (
                  <div className="audience-item" key={item.title}>
                    <div className="audience-icon">{item.icon}</div>
                    <div className="audience-item-text">
                      <div className="audience-item-title">{item.title}</div>
                      <div className="audience-item-desc">{item.desc}</div>
                    </div>
                    <span className="audience-item-tag">{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Not for you */}
            <div className="audience-card audience-card-not">
              <div className="audience-card-label">✕ Not built for you</div>
              <h3>If your context is different</h3>
              <div className="audience-items">
                {[
                  { icon: "☁️", title: "Already using OpenAI / Claude API", desc: "You don't control the model or hardware. Quantization isn't your problem.", tag: "cloud API" },
                  { icon: "🚀", title: "Running on 80 GB A100 / H100", desc: "You can run any model at fp16. No tradeoffs — no decisions needed.", tag: "datacenter" },
                  { icon: "🍎", title: "Mac / Apple Silicon (M1–M4)", desc: "Different ecosystem — Metal / MLX / Ollama. Benchmarks won't transfer.", tag: "MLX" },
                  { icon: "🎮", title: "Gaming / hobby use", desc: "Great tools already exist (Ollama, LM Studio). InferIQ is for production decisions.", tag: "hobbyist" },
                ].map((item) => (
                  <div className="audience-item" key={item.title}>
                    <div className="audience-icon">{item.icon}</div>
                    <div className="audience-item-text">
                      <div className="audience-item-title">{item.title}</div>
                      <div className="audience-item-desc">{item.desc}</div>
                    </div>
                    <span className="audience-item-tag">{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stack ── */}
      <section className="stack-section">
        <div className="container">
          <p className="section-title">Built with</p>
          <div className="stack-pills">
            {STACK.map((s) => (
              <span className="stack-pill" key={s}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="container">
          <h2 className="cta-title">
            Stop guessing.<br />Start measuring.
          </h2>
          <p className="cta-sub">
            Open the dashboard to explore 26 benchmark runs or try the live side-by-side inference demo.
          </p>
          <div className="cta-actions">
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
              Open Dashboard
            </button>
            <a
              href="https://github.com/keshaavraj/inferiq"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <span className="footer-left">
          InferIQ · Benchmarked on RTX 500 Ada 4GB · Built by Kesavan
        </span>
        <div className="footer-right">
          <a href="https://github.com/keshaavraj/inferiq" target="_blank" rel="noreferrer">GitHub</a>
          <a href="#how">Methodology</a>
        </div>
      </footer>
    </div>
  );
}
