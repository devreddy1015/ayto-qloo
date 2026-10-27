import express from "express";
import { join } from "node:path";
import { runAsk } from "./ask.js";
import { config, ROOT } from "./config.js";
import { currentModel, llmAvailable } from "./llm.js";
import { renderDropPage } from "./pipeline/page.js";
import { createRun, editAndRerun, isRunning, parseInput, STAGES, startRun } from "./pipeline/runner.js";
import { findRunBySlug, loadRun, publicRun, subscribe } from "./pipeline/store.js";
import { closeQloo, qlooStatus } from "./qloo.js";
import { EXAMPLES, MARKETS } from "./presets.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "64kb" }));
app.use(express.static(join(ROOT, "public"), { maxAge: "5m" }));

// ---------- abuse / quota protection ----------

const hits = new Map(); // ip -> [timestamps]
let runsToday = 0;
let dayKey = new Date().toISOString().slice(0, 10);

function allow(ip, weight = 1) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600e3);
  if (recent.length + weight > config.scansPerIpPerHour) return false;
  for (let i = 0; i < weight; i += 1) recent.push(now);
  hits.set(ip, recent);
  return true;
}

function allowGlobal() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    runsToday = 0;
  }
  if (runsToday >= config.maxRunsPerDay) return false;
  runsToday += 1;
  return true;
}

// ---------- helpers ----------

function sse(res) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.flushHeaders?.();
  const ping = setInterval(() => !res.writableEnded && res.write(": ping\n\n"), 15000);
  res.on("close", () => clearInterval(ping));
  return (event) => {
    if (res.writableEnded) return;
    if (event.seq) res.write(`id: ${event.seq}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
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
  res.json({
    examples: EXAMPLES.map(({ id, label, text }) => ({ id, label, text })),
    markets: MARKETS,
    stages: STAGES.map(({ id, label, output }) => ({ id, label, output })),
    mode: config.mode,
    llm: llmAvailable(),
  });
});

/** Start a run. Responds at once with the run id; progress streams from /events. */
app.post("/api/runs", async (req, res) => {
  const body = req.body ?? {};
  const example = typeof body.example === "string" ? EXAMPLES.find((e) => e.id === body.example) : undefined;
  if (!example && !allow(req.ip)) return res.status(429).json({ error: "You've started a lot of runs this hour. Try again later." });
  if (!example && !allowGlobal()) return res.status(503).json({ error: "The demo has hit today's Qloo budget. The showcase runs still work." });
  try {
    const input = await parseInput(example ?? body);
    const run = await createRun(input, { example: example?.id });
    startRun(run, 0).catch(() => {});
    res.status(201).json({ id: run.id, input });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

app.get("/api/runs/:id", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  res.json(publicRun(run));
});

/** Live events, resumable: the browser sends Last-Event-ID and gets everything after it. */
app.get("/api/runs/:id/events", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  const send = sse(res);
  const after = Number(req.headers["last-event-id"] ?? req.query.after ?? 0) || 0;
  send({ type: "snapshot", run: publicRun(run) });
  for (const event of run.events ?? []) if (event.seq > after) send(event);
  if (!isRunning(run.id)) {
    send({ type: "end" });
    return res.end();
  }
  const unsubscribe = subscribe(run.id, (event) => {
    send(event);
    if (event.type === "run" && event.status !== "running") {
      send({ type: "end" });
      res.end();
    }
  });
  res.on("close", unsubscribe);
});

/** Edit a finished stage's output and rerun everything after it. */
app.post("/api/runs/:id/edit", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  if (!allow(req.ip)) return res.status(429).json({ error: "Too many reruns this hour." });
  const { stage, edits } = req.body ?? {};
  if (typeof stage !== "string" || !edits || typeof edits !== "object") return res.status(400).json({ error: "Send a stage and edits." });
  try {
    editAndRerun(run, stage, edits).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
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
    emit({ type: "error", message: publicError(error) });
  } finally {
    emit({ type: "end" });
    res.end();
  }
});

/** The published drop page. */
app.get("/d/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return res.status(404).send("Not found");
  const run = await findRunBySlug(slug);
  const html = run && renderDropPage(run);
  if (!html) return res.status(404).send("This drop page doesn't exist (yet).");
  res.type("html").send(html);
});

app.get("/run/:id", (_req, res) => res.sendFile(join(ROOT, "public", "index.html")));

const server = app.listen(config.port, () => {
  console.log(`Culture Gap on :${config.port} (mode=${config.mode}, llm=${llmAvailable() ? "on" : "off"})`);
  if (process.env.PREWARM === "1" && config.mode === "live") setTimeout(prewarm, 3000);
});

// Run the showcase examples once in the background so judges never wait on Qloo.
async function prewarm() {
  for (const example of EXAMPLES) {
    try {
      const run = await createRun(await parseInput(example), { example: example.id });
      await startRun(run, 0);
      console.log(`prewarmed ${example.id}: ${run.status}`);
    } catch (error) {
      console.log(`prewarm ${example.id} failed: ${error.message}`);
    }
  }
}

const shutdown = async () => {
  server.close();
  await closeQloo();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
