import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, getModels } from "../utils/api";
import Leaderboard from "../components/Leaderboard.jsx";
import { VramQualityChart, QualityByTaskChart } from "../components/BenchmarkCharts.jsx";
import LiveDemo from "../components/LiveDemo.jsx";
import HardwareWizard from "../components/HardwareWizard.jsx";
import "../styles/dashboard.css";

const TASK_OPTIONS   = ["all", "qa", "code", "summarization"];
const FORMAT_OPTIONS = ["all", "gguf", "bitsandbytes", "awq", "fp16"];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [taskFilter, setTask]   = useState("all");
  const [fmtFilter, setFmt]     = useState("all");
  const [modelFilter, setModel] = useState("all");
  const [models, setModels]     = useState([]);

  // Load available models for filter dropdown
  useEffect(() => {
    getModels()
      .then((r) => setModels(["all", ...r.data.models]))
      .catch(() => {});
  }, []);

  // Load results whenever filters change
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (taskFilter !== "all") params.task_type = taskFilter;
    if (fmtFilter  !== "all") params.quant_format = fmtFilter;
    if (modelFilter !== "all") params.model_name = modelFilter;

    getResults(params)
      .then((r) => { setResults(r.data.results); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [taskFilter, fmtFilter, modelFilter]);

  // Summary metrics
  const summary = useMemo(() => {
    if (!results.length) return null;
    const nonFp16 = results.filter((r) => r.quant_format !== "fp16");
    const best = nonFp16.reduce((a, b) =>
      (b.quality_retention_pct > a.quality_retention_pct ? b : a), nonFp16[0] || results[0]);
    const fastest = results.reduce((a, b) => (b.tokens_per_sec > a.tokens_per_sec ? b : a), results[0]);
    const smallest = results.reduce((a, b) => (b.vram_mb < a.vram_mb ? b : a), results[0]);
    const avgQ = results.reduce((s, r) => s + r.quality_retention_pct, 0) / results.length;
    return { best, fastest, smallest, avgQ };
  }, [results]);

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dash-header">
        <span className="dash-logo" onClick={() => navigate("/")}>Infer<span>IQ</span></span>
        <div className="dash-header-right">
          <button className="btn btn-ghost" style={{ fontSize: 13, padding: "7px 14px" }}
            onClick={() => document.getElementById("demo-section")?.scrollIntoView({ behavior: "smooth" })}>
            Live Demo
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 13, padding: "7px 14px" }}
            onClick={() => document.getElementById("wizard-section")?.scrollIntoView({ behavior: "smooth" })}>
            Hardware Wizard
          </button>
          <a href="https://github.com/keshaavraj/inferiq" target="_blank" rel="noreferrer"
            className="btn btn-outline" style={{ fontSize: 13, padding: "7px 14px" }}>
            GitHub
          </a>
        </div>
      </header>

      <div className="dash-body">

        {/* ── Page title ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>
            Benchmark Results
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            26 runs across 3 models · 8 quant formats · 3 task types · RTX 500 Ada 4 GB VRAM
          </p>
        </div>

        {/* ── Summary cards ── */}
        {summary && (
          <div className="metric-cards">
            <div className="metric-card">
              <div className="metric-value">{summary.avgQ.toFixed(1)}%</div>
              <div className="metric-label">Avg Quality Retention</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.best?.quant_level}</div>
              <div className="metric-label">Best Quality Quant</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{summary.best?.model_name}</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary.fastest?.tokens_per_sec} <span style={{ fontSize: 14 }}>t/s</span></div>
              <div className="metric-label">Fastest Throughput</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{summary.fastest?.quant_level}</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{(summary.smallest?.vram_mb / 1024).toFixed(1)} <span style={{ fontSize: 14 }}>GB</span></div>
              <div className="metric-label">Smallest VRAM</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{summary.smallest?.quant_level}</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{results.length}</div>
              <div className="metric-label">Filtered Runs</div>
            </div>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="filter-bar">
          <span className="filter-label">Filter</span>

          <div>
            <select className="filter-select" value={taskFilter} onChange={(e) => setTask(e.target.value)}>
              {TASK_OPTIONS.map((t) => (
                <option key={t} value={t}>{t === "all" ? "All tasks" : t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="filter-divider" />

          <div>
            <select className="filter-select" value={fmtFilter} onChange={(e) => setFmt(e.target.value)}>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f === "all" ? "All formats" : f.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="filter-divider" />

          <div>
            <select className="filter-select" value={modelFilter} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
                <option key={m} value={m}>{m === "all" ? "All models" : m}</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => { setTask("all"); setFmt("all"); setModel("all"); }}>
              Reset
            </button>
          </div>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div style={{ padding: "20px", background: "rgba(248,113,113,0.1)", border: "1px solid var(--red)", borderRadius: 8, marginBottom: 24, fontSize: 13, color: "var(--red)" }}>
            Failed to load results: {error}. Make sure the backend is running.
          </div>
        )}

        {/* ── Leaderboard ── */}
        {loading ? (
          <div className="state-center"><div className="spinner" /><span>Loading…</span></div>
        ) : (
          <Leaderboard results={results} />
        )}

        {/* ── Charts ── */}
        {!loading && results.length > 0 && (
          <div className="charts-grid">
            <VramQualityChart results={results} />
            <QualityByTaskChart results={results} />
          </div>
        )}

        {/* ── Key finding callout ── */}
        {!loading && results.length > 0 && (
          <div className="card" style={{ marginBottom: 32, borderColor: "var(--border-bright)", background: "var(--bg-secondary)" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--accent)", marginBottom: 10 }}>
              Key Finding
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              Code generation degrades 2–3× faster than QA under quantization
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              At GGUF Q4_K_M, Llama 3.2 3B retains <strong style={{ color: "var(--green)" }}>94.3%</strong> quality
              on QA tasks but only <strong style={{ color: "var(--yellow)" }}>79.1%</strong> on code generation.
              bitsandbytes INT4 drops code quality to <strong style={{ color: "var(--red)" }}>76.3%</strong>.
              For code-heavy workloads, prefer Q5_K_M or Q8_0 — the memory cost is worth it.
            </p>
          </div>
        )}

        {/* ── Live Demo ── */}
        <div id="demo-section" style={{ marginBottom: 32 }}>
          <div className="card">
            <LiveDemo />
          </div>
        </div>

        {/* ── Hardware Wizard ── */}
        <div id="wizard-section">
          <div className="card">
            <HardwareWizard />
          </div>
        </div>

      </div>
    </div>
  );
}
