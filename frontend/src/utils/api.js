import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

export default api;

// Results
export const getResults = (params = {}) =>
  api.get("/api/results", { params });

export const getModels = () =>
  api.get("/api/results/models");

export const getWizardRecommendation = (vram_gb, quality_min, task_type) =>
  api.get("/api/wizard", { params: { vram_gb, quality_min, task_type } });

export const getDemoModels = () =>
  api.get("/api/demo/models");

export const runEvals = (payload) =>
  api.post("/api/evals", payload);

export const getHealth = () =>
  api.get("/api/health");

// Demo SSE stream — returns an EventSource-like async generator
export function streamDemo(payload, onEvent, onDone, onError) {
  const url = `${BASE_URL}/api/demo`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") {
            onDone();
            return;
          }
          try {
            onEvent(JSON.parse(raw));
          } catch {
            // skip malformed
          }
        }
      }
      onDone();
    })
    .catch(onError);
}
