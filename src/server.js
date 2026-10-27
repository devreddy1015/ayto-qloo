import express from "express";
import { join } from "node:path";
import { runAsk } from "./ask.js";
import { runScan } from "./agent.js";
import { config, ROOT } from "./config.js";
import { currentModel, llmAvailable } from "./llm.js";
import { closeQloo, qlooStatus } from "./qloo.js";
import { EXAMPLES, MARKETS } from "./presets.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "64kb" }));
app.use(express.static(join(ROOT, "public"), { maxAge: "5m" }));

// ---------- abuse / quota protection ----------

const hits = new Map(); // ip -> [timestamps]
let activeScans = 0;

function allow(ip, weight = 1) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600e3);
  if (recent.length + weight > config.scansPerIpPerHour) return false;
  for (let i = 0; i < weight; i += 1) recent.push(now);
  hits.set(ip, recent);
  return true;
}

// ---------- server-sent events ----------

function sse(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => clearInterval(ping));
  return (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

const publicError = (error) =>
  error?.code === "QLOO_AUTH"
    ? "The Qloo key was rejected. The demo's key may have expired."
    : error?.code === "NOT_IN_SAMPLES"
      ? error.message
      : /rate|429/i.test(error?.message ?? "")
        ? "Qloo or the language model is rate limiting right now. Try again in a minute."
        : (error?.message ?? "Something went wrong.").slice(0, 300);

// ---------- routes ----------

app.get("/api/health", async (_req, res) => {
  const qloo = await qlooStatus();
  res.json({ ok: qloo.ready, qloo, llm: { available: llmAvailable(), model: currentModel() } });
});

app.get("/api/presets", (_req, res) => {
  res.json({ examples: EXAMPLES, markets: MARKETS, mode: config.mode, llm: llmAvailable() });
});

app.post("/api/scan", async (req, res) => {
  const body = req.body ?? {};
  if (!allow(req.ip)) return res.status(429).json({ error: "You've run a lot of scans this hour. Try again later." });
  if (activeScans >= config.maxConcurrentScans) {
    return res.status(503).json({ error: "The agent is busy with other scans. Try again in a minute." });
  }
  activeScans += 1;
  const emit = sse(res);
  try {
    await runScan(
      {
        question: typeof body.question === "string" ? body.question : undefined,
        waves: Array.isArray(body.waves) ? body.waves : undefined,
        markets: Array.isArray(body.markets) ? body.markets.map(String) : undefined,
        persona: typeof body.persona === "string" ? body.persona : undefined,
        angle: typeof body.angle === "string" ? body.angle : undefined,
      },
      emit,
    );
  } catch (error) {
    console.error("scan failed:", error.code ?? "", error.message);
    emit({ type: "error", message: publicError(error) });
  } finally {
    activeScans -= 1;
    emit({ type: "end" });
    res.end();
  }
});

app.post("/api/ask", async (req, res) => {
  const { question, context } = req.body ?? {};
  if (typeof question !== "string" || !question.trim()) return res.status(400).json({ error: "Ask a question." });
  if (!allow(req.ip)) return res.status(429).json({ error: "You've asked a lot this hour. Try again later." });
  const emit = sse(res);
  try {
    await runAsk({ question, context }, emit);
  } catch (error) {
    console.error("ask failed:", error.message);
    emit({ type: "error", message: publicError(error) });
  } finally {
    emit({ type: "end" });
    res.end();
  }
});

const server = app.listen(config.port, () => {
  console.log(`Culture Gap on :${config.port} (mode=${config.mode}, llm=${llmAvailable() ? "on" : "off"})`);
});

const shutdown = async () => {
  server.close();
  await closeQloo();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
