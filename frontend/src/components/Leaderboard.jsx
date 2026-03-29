import { useState, useMemo } from "react";

const QUALITY_COLOR = (pct) => {
  if (pct >= 95) return "var(--green)";
  if (pct >= 88) return "var(--yellow)";
  return "var(--red)";
};

const COLS = [
  { key: "quality_retention_pct", label: "Quality %" },
  { key: "ttft_ms",               label: "TTFT ms" },
  { key: "tokens_per_sec",        label: "Tok/s" },
  { key: "vram_mb",               label: "VRAM MB" },
];

export default function Leaderboard({ results = [] }) {
  const [sortKey, setSortKey] = useState("quality_retention_pct");
  const [sortDir, setSortDir] = useState("desc");

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [results, sortKey, sortDir]);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortIcon = (key) => {
    if (key !== sortKey) return " ↕";
    return sortDir === "desc" ? " ↓" : " ↑";
  };

  if (!results.length) {
    return (
      <div className="state-center">
        <div className="spinner" />
        <span>Loading benchmark results…</span>
      </div>
    );
  }

  return (
    <div className="leaderboard-wrap">
      <div className="leaderboard-title">
        Benchmark Leaderboard
        <span className="leaderboard-count">{sorted.length} runs</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Model</th>
              <th>Quantization</th>
              <th>Task</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={sortKey === c.key ? "sorted" : ""}
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}{sortIcon(c.key)}
                </th>
              ))}
              <th>Consistency</th>
              <th>ROUGE-L</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const qPct = r.quality_retention_pct ?? 0;
              const color = QUALITY_COLOR(qPct);
              return (
                <tr key={`${r.model_name}-${r.quant_level}-${r.task_type}-${i}`}>
                  <td className="lb-rank">{i + 1}</td>
                  <td className="lb-model">{r.model_name}</td>
                  <td className="lb-quant">{r.quant_level}</td>
                  <td><span className="lb-task">{r.task_type}</span></td>

                  {/* Quality retention with bar */}
                  <td>
                    <div className="quality-bar-wrap">
                      <div className="quality-bar-bg">
                        <div
                          className="quality-bar-fill"
                          style={{ width: `${qPct}%`, background: color }}
                        />
                      </div>
                      <span className="quality-num" style={{ color }}>
                        {qPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  <td className="lb-mono">{r.ttft_ms} ms</td>
                  <td className="lb-mono">{r.tokens_per_sec}</td>
                  <td className="lb-mono">{(r.vram_mb / 1024).toFixed(1)} GB</td>
                  <td className="lb-mono">{(r.consistency_score * 100).toFixed(0)}%</td>
                  <td className="lb-mono">{(r.rouge_l * 100).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
