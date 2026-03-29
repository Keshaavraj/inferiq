import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell,
} from "recharts";

const MODEL_COLORS = {
  "llama3.2-3b": "#4f8ef7",
  "phi3-mini":   "#a78bfa",
  "mistral-7b":  "#34d399",
};

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  return (
    <circle
      cx={cx} cy={cy} r={6}
      fill={MODEL_COLORS[payload.model_name] || "#4f8ef7"}
      stroke="rgba(0,0,0,0.3)"
      strokeWidth={1}
      opacity={0.85}
    />
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-bright)",
      borderRadius: 8,
      padding: "12px 16px",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      minWidth: 180,
    }}>
      <div style={{ color: "var(--text-primary)", fontWeight: 700, marginBottom: 6 }}>
        {d.model_name} · {d.quant_level}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>Task: {d.task_type}</div>
      <div style={{ color: "var(--green)" }}>Quality: {d.quality_retention_pct?.toFixed(1)}%</div>
      <div style={{ color: "var(--accent)" }}>VRAM: {(d.vram_mb / 1024).toFixed(1)} GB</div>
      <div style={{ color: "var(--text-secondary)" }}>TTFT: {d.ttft_ms} ms</div>
      <div style={{ color: "var(--text-secondary)" }}>Tok/s: {d.tokens_per_sec}</div>
    </div>
  );
};

// VRAM vs Quality scatter
export function VramQualityChart({ results }) {
  const data = results.map((r) => ({
    ...r,
    vram_gb: parseFloat((r.vram_mb / 1024).toFixed(2)),
  }));

  const models = [...new Set(data.map((d) => d.model_name))];

  return (
    <div className="chart-card">
      <div className="chart-title">VRAM vs Quality Retention</div>
      <div className="chart-sub">
        Each point = one model+quant+task run. Higher-right = better quality, more memory.
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="vram_gb"
            name="VRAM (GB)"
            type="number"
            domain={[0, "auto"]}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            label={{ value: "VRAM (GB)", position: "insideBottom", offset: -10, fill: "var(--text-muted)", fontSize: 11 }}
          />
          <YAxis
            dataKey="quality_retention_pct"
            name="Quality %"
            domain={[70, 105]}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            label={{ value: "Quality %", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            formatter={(v) => <span style={{ color: MODEL_COLORS[v] || "#fff" }}>{v}</span>}
          />
          {models.map((m) => (
            <Scatter
              key={m}
              name={m}
              data={data.filter((d) => d.model_name === m)}
              shape={<CustomDot />}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// Quality by task type bar chart
export function QualityByTaskChart({ results }) {
  const taskTypes = ["qa", "code", "summarization"];
  const quantLevels = [...new Set(results.map((r) => r.quant_level))].slice(0, 6);

  const data = taskTypes.map((task) => {
    const row = { task: task.toUpperCase() };
    quantLevels.forEach((q) => {
      const matches = results.filter(
        (r) => r.task_type === task && r.quant_level === q
      );
      if (matches.length) {
        row[q] = parseFloat(
          (matches.reduce((s, r) => s + r.quality_retention_pct, 0) / matches.length).toFixed(1)
        );
      }
    });
    return row;
  });

  const BAR_COLORS = [
    "#4f8ef7", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#60a5fa",
  ];

  return (
    <div className="chart-card">
      <div className="chart-title">Quality Retention by Task Type</div>
      <div className="chart-sub">
        Avg quality retention % per task. Code gen degrades fastest at lower bit-widths.
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="task" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
          <YAxis domain={[70, 105]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-bright)",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "var(--text-primary)", fontWeight: 700 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
          />
          {quantLevels.map((q, i) => (
            <Bar key={q} dataKey={q} fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
