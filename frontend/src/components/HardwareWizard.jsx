import { useState } from "react";
import { getWizardRecommendation } from "../utils/api";

const VRAM_PRESETS = [
  { label: "2 GB", value: 2, note: "Ultra-budget / CPU offload" },
  { label: "4 GB", value: 4, note: "Laptop GPU (RTX 500 Ada)" },
  { label: "6 GB", value: 6, note: "RTX 3060 / 4060" },
  { label: "8 GB", value: 8, note: "RTX 3070 / 4070" },
  { label: "16 GB", value: 16, note: "RTX 3090 / 4090 / A4000" },
  { label: "Custom", value: null, note: "" },
];

const QUALITY_MARKS = [
  { value: 75,  label: "75%", desc: "Speed-first" },
  { value: 85,  label: "85%", desc: "Balanced" },
  { value: 90,  label: "90%", desc: "Quality-first" },
  { value: 95,  label: "95%", desc: "Near lossless" },
];

const QUALITY_COLOR = (pct) => {
  if (pct >= 95) return "var(--green)";
  if (pct >= 88) return "var(--yellow)";
  return "var(--red)";
};

const RECOMMENDATION_LABEL = (rec) => {
  if (!rec) return null;
  if (rec === "use")     return { text: "Deploy",  color: "var(--green)",  bg: "rgba(52,211,153,0.12)" };
  if (rec === "caution") return { text: "Caution", color: "var(--yellow)", bg: "rgba(251,191,36,0.12)" };
  return                        { text: "Avoid",   color: "var(--red)",    bg: "rgba(248,113,113,0.12)" };
};

export default function HardwareWizard() {
  const [vramPreset, setVramPreset] = useState(4);
  const [customVram, setCustomVram] = useState("");
  const [quality, setQuality]       = useState(90);
  const [taskType, setTaskType]     = useState("qa");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const effectiveVram = vramPreset !== null ? vramPreset : parseFloat(customVram) || 0;

  function handleRun() {
    if (!effectiveVram) return;
    setLoading(true);
    setResult(null);
    setError(null);

    getWizardRecommendation(effectiveVram, quality, taskType)
      .then((r) => { setResult(r.data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }

  const rec = result?.recommendation;

  return (
    <div>
      <h2 className="section-title">Hardware Wizard</h2>
      <p className="section-sub">
        Enter your hardware constraints — get a data-driven deployment recommendation.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* ── Left: inputs ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* VRAM selector */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Available VRAM
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {VRAM_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setVramPreset(p.value)}
                  style={{
                    padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1px solid",
                    borderColor: vramPreset === p.value ? "var(--accent)" : "var(--border)",
                    background: vramPreset === p.value ? "var(--accent-dim)" : "var(--bg-secondary)",
                    color: vramPreset === p.value ? "var(--accent)" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {vramPreset === null && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={1} max={80} step={0.5}
                  value={customVram}
                  onChange={(e) => setCustomVram(e.target.value)}
                  placeholder="e.g. 12"
                  style={{
                    width: 100, background: "var(--bg-secondary)",
                    border: "1px solid var(--accent)", borderRadius: 6,
                    color: "var(--text-primary)", padding: "7px 12px",
                    fontSize: 14, fontFamily: "var(--font-mono)", outline: "none",
                  }}
                />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>GB VRAM</span>
              </div>
            )}
            {vramPreset !== null && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                {VRAM_PRESETS.find((p) => p.value === vramPreset)?.note}
              </div>
            )}
          </div>

          {/* Quality threshold */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Minimum Quality Retention
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {QUALITY_MARKS.map((q) => (
                <button
                  key={q.value}
                  onClick={() => setQuality(q.value)}
                  style={{
                    padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1px solid",
                    borderColor: quality === q.value ? QUALITY_COLOR(q.value) : "var(--border)",
                    background: quality === q.value ? `${QUALITY_COLOR(q.value)}18` : "var(--bg-secondary)",
                    color: quality === q.value ? QUALITY_COLOR(q.value) : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {q.label}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>{q.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Task type */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Primary Task
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["qa", "code", "summarization"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTaskType(t)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1px solid",
                    borderColor: taskType === t ? "var(--purple)" : "var(--border)",
                    background: taskType === t ? "rgba(167,139,250,0.12)" : "var(--bg-secondary)",
                    color: taskType === t ? "var(--purple)" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "qa" ? "Q&A" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={!effectiveVram || loading}
            style={{ padding: "13px 28px", fontSize: 14, alignSelf: "flex-start" }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14 }} />Searching…</>
              : "Get Recommendation"}
          </button>
        </div>

        {/* ── Right: result ── */}
        <div>
          {!result && !loading && !error && (
            <div style={{
              height: "100%", minHeight: 280,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              border: "1px dashed var(--border)", borderRadius: 10,
              color: "var(--text-muted)", fontSize: 13, gap: 10,
            }}>
              <span style={{ fontSize: 36 }}>🧠</span>
              <span>Your recommendation will appear here</span>
            </div>
          )}

          {loading && (
            <div style={{ height: "100%", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <div className="spinner" />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Scanning benchmark matrix…</span>
            </div>
          )}

          {error && (
            <div style={{ padding: 20, background: "rgba(248,113,113,0.08)", border: "1px solid var(--red)", borderRadius: 10, fontSize: 13, color: "var(--red)" }}>
              {error}
            </div>
          )}

          {result && !result.recommendation && (
            <div style={{
              padding: 28, background: "rgba(251,191,36,0.06)", border: "1px solid var(--yellow)",
              borderRadius: 10, fontSize: 14, color: "var(--yellow)", textAlign: "center",
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>No matching configuration found</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{result.message}</div>
            </div>
          )}

          {rec && (
            <div style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border-bright)",
              borderRadius: 10, overflow: "hidden",
            }}>
              {/* Result header */}
              <div style={{
                background: "var(--accent-dim)", borderBottom: "1px solid var(--border-bright)",
                padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                  Recommended Configuration
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Ranked by quality ÷ VRAM efficiency
                </span>
              </div>

              <div style={{ padding: "24px 20px" }}>
                {/* Model + quant hero */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 4 }}>
                    {rec.model_name}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--purple)", marginBottom: 8 }}>
                    {rec.quant_level}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                    {rec.notes}
                  </div>
                </div>

                {/* Metric grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Quality Retention", value: `${rec.quality_retention_pct}%`, color: QUALITY_COLOR(rec.quality_retention_pct) },
                    { label: "VRAM Usage",         value: `${(rec.vram_mb / 1024).toFixed(1)} GB`, color: "var(--accent)" },
                    { label: "TTFT",               value: `${rec.ttft_ms} ms`, color: "var(--green)" },
                    { label: "Tokens / sec",       value: rec.tokens_per_sec, color: "var(--text-secondary)" },
                    { label: "ROUGE-L",            value: (rec.rouge_l * 100).toFixed(1), color: "var(--text-secondary)" },
                    { label: "Consistency",        value: `${(rec.consistency_score * 100).toFixed(0)}%`, color: "var(--text-secondary)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "12px 14px",
                    }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Summary message */}
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "14px 16px", fontSize: 13,
                  color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                  {result.message}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
