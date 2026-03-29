import { useState, useRef, useEffect } from "react";
import { streamDemo, runEvals, getDemoModels } from "../utils/api";

const SAMPLE_PROMPTS = [
  "Explain what LLM quantization does and why it matters for on-premise deployment.",
  "Write a Python function to binary search a sorted list.",
  "Summarize the tradeoff between model size and inference quality in 3 sentences.",
  "What is the difference between GGUF Q4 and Q8 quantization?",
  "Write a SQL query to find duplicate rows in a table.",
];

const MetricPill = ({ label, value, color }) => (
  <div style={{
    display: "inline-flex", flexDirection: "column", alignItems: "center",
    padding: "8px 14px", background: "var(--bg-primary)",
    border: "1px solid var(--border)", borderRadius: 8, minWidth: 80,
  }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: color || "var(--accent)" }}>
      {value ?? "—"}
    </span>
    <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginTop: 2 }}>
      {label}
    </span>
  </div>
);

function ModelPane({ side, label, quantNote, vramEst, tokens, metrics, isStreaming, isDone }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tokens]);

  const ttft = metrics?.ttft_ms != null ? `${metrics.ttft_ms} ms` : isStreaming ? "…" : null;
  const tps  = metrics?.tokens_per_sec != null ? `${metrics.tokens_per_sec}` : isStreaming ? "…" : null;
  const totalMs = metrics?.total_ms != null ? `${(metrics.total_ms / 1000).toFixed(1)}s` : isStreaming ? "…" : null;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden", minWidth: 0,
    }}>
      {/* Pane header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            <span style={{ color: side === "a" ? "var(--accent)" : "var(--purple)", marginRight: 6 }}>
              {side === "a" ? "A" : "B"}
            </span>
            {label || "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{quantNote}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {vramEst && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4,
              background: "var(--accent-dim)", color: "var(--accent)",
              border: "1px solid var(--border-bright)", fontFamily: "var(--font-mono)",
            }}>
              ~{(vramEst / 1024).toFixed(1)} GB VRAM
            </span>
          )}
          {isStreaming && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4,
              background: "rgba(52,211,153,0.15)", color: "var(--green)",
              border: "1px solid rgba(52,211,153,0.3)",
            }}>
              ● streaming
            </span>
          )}
          {isDone && (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4,
              background: "var(--bg-primary)", color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}>
              done
            </span>
          )}
        </div>
      </div>

      {/* Response area */}
      <div style={{
        flex: 1, padding: "18px", minHeight: 200, maxHeight: 340,
        overflowY: "auto", fontSize: 13, lineHeight: 1.7,
        color: tokens ? "var(--text-primary)" : "var(--text-muted)",
        fontFamily: tokens?.includes("def ") || tokens?.includes("SELECT") ? "var(--font-mono)" : "var(--font-sans)",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {tokens || (isStreaming ? "" : <span style={{ fontStyle: "italic" }}>Response will appear here…</span>)}
        {isStreaming && <span style={{ display: "inline-block", width: 8, height: 14, background: "var(--accent)", marginLeft: 2, animation: "blink 1s step-end infinite", borderRadius: 1 }} />}
        <div ref={bottomRef} />
      </div>

      {/* Metrics bar */}
      <div style={{
        padding: "12px 18px", borderTop: "1px solid var(--border)",
        background: "var(--bg-card)", display: "flex", gap: 8, flexWrap: "wrap",
      }}>
        <MetricPill label="TTFT" value={ttft} color="var(--green)" />
        <MetricPill label="Tok/s" value={tps} color="var(--accent)" />
        <MetricPill label="Total" value={totalMs} color="var(--text-secondary)" />
      </div>
    </div>
  );
}

export default function LiveDemo() {
  const [demoModels, setDemoModels] = useState({});
  const [modelA, setModelA]         = useState("llama3.2-3b-q4");
  const [modelB, setModelB]         = useState("llama3.1-8b-q4");
  const [prompt, setPrompt]         = useState("");
  const [isRunning, setIsRunning]   = useState(false);

  // Per-model state
  const [metaA, setMetaA]   = useState(null);
  const [metaB, setMetaB]   = useState(null);
  const [tokensA, setTokensA] = useState("");
  const [tokensB, setTokensB] = useState("");
  const [metricsA, setMetricsA] = useState(null);
  const [metricsB, setMetricsB] = useState(null);
  const [doneA, setDoneA]   = useState(false);
  const [doneB, setDoneB]   = useState(false);
  const [evals, setEvals]   = useState(null);

  const bothDone = doneA && doneB;
  const fullResponseA = useRef("");
  const fullResponseB = useRef("");

  useEffect(() => {
    getDemoModels()
      .then((r) => setDemoModels(r.data.models))
      .catch(() => {});
  }, []);

  function reset() {
    setMetaA(null); setMetaB(null);
    setTokensA(""); setTokensB("");
    setMetricsA(null); setMetricsB(null);
    setDoneA(false); setDoneB(false);
    setEvals(null);
    fullResponseA.current = "";
    fullResponseB.current = "";
  }

  function handleRun() {
    if (!prompt.trim() || isRunning) return;
    reset();
    setIsRunning(true);

    streamDemo(
      { prompt: prompt.trim(), model_a: modelA, model_b: modelB, max_tokens: 300 },
      (event) => {
        const { model, type, data } = event;
        if (type === "meta") {
          if (model === "a") setMetaA(data);
          else setMetaB(data);
        } else if (type === "token") {
          if (model === "a") {
            fullResponseA.current += data;
            setTokensA((t) => t + data);
          } else {
            fullResponseB.current += data;
            setTokensB((t) => t + data);
          }
        } else if (type === "metrics") {
          if (model === "a") setMetricsA(data);
          else setMetricsB(data);
        }
      },
      () => {
        setDoneA(true); setDoneB(true);
        setIsRunning(false);
        // run evals after both done
        if (fullResponseA.current && fullResponseB.current) {
          runEvals({
            prompt: prompt.trim(),
            response_a: fullResponseA.current,
            response_b: fullResponseB.current,
            model_a_label: demoModels[modelA]?.label || modelA,
            model_b_label: demoModels[modelB]?.label || modelB,
          })
            .then((r) => setEvals(r.data.evals))
            .catch(() => {});
        }
      },
      (err) => {
        setIsRunning(false);
        console.error("Demo stream error:", err);
      }
    );
  }

  const modelKeys = Object.keys(demoModels);

  return (
    <div>
      {/* blink keyframe */}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h2 className="section-title">Live Inference Demo</h2>
        <p className="section-sub">
          Pick two models, type a prompt, watch them respond in parallel with real TTFT and tokens/sec.
        </p>
      </div>

      {/* Model selector row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>A</span>
          <select
            className="filter-select"
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            disabled={isRunning}
          >
            {modelKeys.map((k) => (
              <option key={k} value={k}>{demoModels[k]?.label || k}</option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>vs</span>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--purple)", fontWeight: 700 }}>B</span>
          <select
            className="filter-select"
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            disabled={isRunning}
          >
            {modelKeys.map((k) => (
              <option key={k} value={k}>{demoModels[k]?.label || k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sample prompts */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {SAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20 }}
            onClick={() => setPrompt(p)}
            disabled={isRunning}
          >
            {p.length > 40 ? p.slice(0, 40) + "…" : p}
          </button>
        ))}
      </div>

      {/* Prompt input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun(); }}
          placeholder="Type a prompt… (Ctrl+Enter to run)"
          disabled={isRunning}
          rows={3}
          style={{
            flex: 1, background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px", color: "var(--text-primary)",
            fontSize: 14, resize: "vertical", fontFamily: "var(--font-sans)",
            transition: "border-color 0.2s", outline: "none",
          }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={!prompt.trim() || isRunning}
            style={{ padding: "12px 24px", flex: 1 }}
          >
            {isRunning ? <><span className="spinner" style={{ width: 14, height: 14 }} />Running…</> : "Run"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={reset}
            disabled={isRunning}
            style={{ padding: "8px 16px", fontSize: 12 }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Side-by-side panes */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <ModelPane
          side="a"
          label={metaA?.label || demoModels[modelA]?.label}
          quantNote={metaA?.quant_note || demoModels[modelA]?.quant_note}
          vramEst={metaA?.vram_est_mb || demoModels[modelA]?.vram_est_mb}
          tokens={tokensA}
          metrics={metricsA}
          isStreaming={isRunning && !doneA}
          isDone={doneA}
        />
        <ModelPane
          side="b"
          label={metaB?.label || demoModels[modelB]?.label}
          quantNote={metaB?.quant_note || demoModels[modelB]?.quant_note}
          vramEst={metaB?.vram_est_mb || demoModels[modelB]?.vram_est_mb}
          tokens={tokensB}
          metrics={metricsB}
          isStreaming={isRunning && !doneB}
          isDone={doneB}
        />
      </div>

      {/* Eval results */}
      {bothDone && metricsA && metricsB && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-bright)",
          borderRadius: 10, padding: "20px 24px", marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--accent)", marginBottom: 14 }}>
            Inference Comparison
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              { label: "Model A TTFT", a: `${metricsA.ttft_ms} ms`, b: `${metricsB.ttft_ms} ms`, key: "ttft" },
              { label: "Tokens/sec", a: metricsA.tokens_per_sec, b: metricsB.tokens_per_sec, key: "tps" },
              { label: "Total tokens", a: metricsA.total_tokens, b: metricsB.total_tokens, key: "tok" },
            ].map(({ label, a, b }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</div>
                <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 16, fontWeight: 700 }}>A: {a}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--purple)", fontSize: 16, fontWeight: 700 }}>B: {b}</span>
                </div>
              </div>
            ))}
          </div>

          {/* LLM eval scores */}
          {evals && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>LLM-as-judge coherence scores (via Arize Phoenix)</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {["model_a", "model_b"].map((side) => {
                  const e = evals[side]?.eval;
                  const lbl = evals[side]?.label;
                  if (!e || !Object.keys(e).length) return null;
                  return (
                    <div key={side} style={{
                      background: "var(--bg-secondary)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "14px 18px", minWidth: 200,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: side === "model_a" ? "var(--accent)" : "var(--purple)" }}>
                        {lbl}
                      </div>
                      {["coherence", "accuracy", "completeness", "overall"].map((k) =>
                        e[k] != null ? (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                            <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{k}</span>
                            <span style={{ fontFamily: "var(--font-mono)", color: e[k] >= 4 ? "var(--green)" : e[k] >= 3 ? "var(--yellow)" : "var(--red)", fontWeight: 700 }}>
                              {e[k]}/5
                            </span>
                          </div>
                        ) : null
                      )}
                      {e.reasoning && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
                          "{e.reasoning}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
