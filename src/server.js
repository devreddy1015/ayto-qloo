import express from "express";
import { join } from "node:path";
import { runAsk } from "./ask.js";
import { config, ROOT } from "./config.js";
import { checkCredential, credentialFrom, llmAvailable, llmStatus, probeServerLlm, providerList, redact } from "./llm.js";
import { discovery, mcpHandler } from "./mcp.js";
import { mosaic } from "./mosaic.js";
import { gallery } from "./gallery.js";
import { candidates, parseInput } from "./parse.js";
import { renderShareMarkdown, renderSharePage } from "./pipeline/page.js";
import { createRun, editAndRerun, isRunning, regenerate, rerunFrom, startRun } from "./pipeline/runner.js";
import { findRunBySlug, loadRun, publicRun, subscribe } from "./pipeline/store.js";
import { formatList, MARKETS, SHOWCASES } from "./presets.js";
import { closeQloo, qlooStatus } from "./qloo.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "64kb" }));
app.use(express.static(join(ROOT, "public"), { maxAge: "5m" }));

// ---------- abuse / quota protection ----------

const hits = new Map(); // ip -> [timestamps]
const counters = { day: new Date().toISOString().slice(0, 10), runs: 0, llmRuns: 0 };

function allow(ip, { perHour = config.scansPerIpPerHour, bucket = "runs" } = {}) {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3600e3);
  if (recent.length + 1 > perHour) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function allowGlobal({ llm = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== counters.day) Object.assign(counters, { day: today, runs: 0, llmRuns: 0 });
  if (counters.runs >= config.maxRunsPerDay) return false;
  if (llm && counters.llmRuns >= config.maxLlmRunsPerDay) return false;
  counters.runs += 1;
  if (llm) counters.llmRuns += 1;
  return true;
}

// ---------- helpers ----------

function sse(res) {
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
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
        : redact(error?.message ?? "Something went wrong.").slice(0, 300);

/** The user's own credential, if the body carries one. Never logged, never echoed. */
function credentialOf(body, res) {
  try {
    return credentialFrom(body?.llm);
  } catch (error) {
    res.status(400).json({ error: error.message });
    return null;
  }
}

// ---------- routes ----------

app.get("/api/health", async (_req, res) => {
  const qloo = await qlooStatus();
  res.json({ ok: qloo.ready, qloo, llm: llmStatus() });
});

app.get("/api/presets", (_req, res) => {
  res.json({ showcases: SHOWCASES.map(({ id, label, text, format }) => ({ id, label, text, format })), formats: formatList(), markets: MARKETS, providers: providerList(), mode: config.mode, llm: llmStatus() });
});

app.get("/api/llm/providers", (_req, res) => res.json({ providers: providerList() }));

/** Finished runs for the home page: one card per showcase, then recent runs, plus the walkthrough source. */
app.get("/api/gallery", async (_req, res) => {
  res.set("cache-control", "public, max-age=60");
  res.json(await gallery());
});

/** Images for the background: a run's own picks, or the showcases' when there is no run. */
app.get("/api/mosaic", async (req, res) => {
  const runId = typeof req.query.run === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(req.query.run) ? req.query.run : undefined;
  res.set("cache-control", runId ? "private, max-age=60" : "public, max-age=300");
  res.json(await mosaic({ runId }));
});

/** One tiny call with the user's key, so a bad key fails before a run. The key is not kept. */
app.post("/api/llm/check", async (req, res) => {
  if (!allow(req.ip, { perHour: 20, bucket: "check" })) return res.status(429).json({ error: "Too many key checks this hour." });
  const body = req.body?.llm ? req.body : { llm: req.body };
  const credential = credentialOf(body, res);
  if (credential === null) return;
  if (!credential) return res.status(400).json({ error: "Send a provider and a key." });
  res.json(await checkCredential(credential));
});

/** Sentence → structured input plus what Qloo makes of it. Nothing runs yet. */
app.post("/api/parse", async (req, res) => {
  if (!allow(req.ip, { perHour: 40, bucket: "parse" })) return res.status(429).json({ error: "Too many requests this hour." });
  try {
    const input = await parseInput(req.body ?? {});
    const found = await candidates(input);
    res.json({ input, ...found });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

/** Start a run. Responds at once with the run id; progress streams from /events. */
app.post("/api/runs", async (req, res) => {
  const body = req.body ?? {};
  const showcase = typeof body.showcase === "string" ? SHOWCASES.find((s) => s.id === body.showcase) : undefined;
  // A showcase may carry the user's own key too, so a judge with a key gets real writing from one click.
  const credential = credentialOf(body, res);
  if (credential === null) return;
  if (!showcase && !allow(req.ip)) return res.status(429).json({ error: "You've started a lot of runs this hour. Try again later." });
  if (!showcase && !allowGlobal({ llm: !credential && llmAvailable() })) return res.status(503).json({ error: "The demo has hit today's budget. The showcase runs still work, or bring your own LLM key." });
  try {
    const input = await parseInput(showcase ?? body);
    const run = await createRun(input, { showcase: showcase?.id, credential });
    startRun(run, 0).catch(() => {});
    res.status(201).json({ id: run.id, input, llm: run.llm });
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
  const credential = credentialOf(req.body, res);
  if (credential === null) return;
  try {
    await editAndRerun(run, stage, edits, credential).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

/** Change the production assumptions and recompute from the produce stage. Numbers only; nothing else in the run moves. */
app.post("/api/runs/:id/assumptions", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  if (!allow(req.ip, { perHour: 30, bucket: "assumptions" })) return res.status(429).json({ error: "Too many recomputes this hour." });
  const a = req.body?.assumptions;
  if (!a || typeof a !== "object") return res.status(400).json({ error: "Send assumptions." });
  const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  const clean = {};
  for (const k of ["moqPerStylePerColour", "heroQuantity", "otherQuantity", "logisticsPerUnit"]) if (num(a[k], 0, 1e6) !== undefined) clean[k] = Math.round(a[k]);
  for (const k of ["returnsReserveShare", "homeCityShare"]) if (num(a[k], 0, 1) !== undefined) clean[k] = a[k];
  if (["value", "mid", "premium"].includes(a.tier)) clean.tier = a.tier;
  if (a.unitCost && typeof a.unitCost === "object") {
    clean.unitCost = {};
    for (const k of ["fabric", "cmt", "print", "trimsAndPacking"]) if (num(a.unitCost[k], 0, 1e5) !== undefined) clean.unitCost[k] = Math.round(a.unitCost[k]);
  }
  try {
    await rerunFrom(run, "produce", { assumptions: clean });
    res.json({ ok: true, assumptions: run.input.assumptions });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

/** Write again, with the user's own key. */
app.post("/api/runs/:id/regenerate", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  if (!allow(req.ip)) return res.status(429).json({ error: "Too many reruns this hour." });
  const credential = credentialOf(req.body, res);
  if (credential === null) return;
  if (!credential && !llmAvailable()) return res.status(400).json({ error: "Add a key to write again." });
  if (!credential && !allowGlobal({ llm: true })) return res.status(503).json({ error: "The demo has hit today's budget. Bring your own key to write." });
  try {
    regenerate(run, credential).catch(() => {});
    res.json({ ok: true, llm: run.llm });
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

/** The share page as Markdown: a file for a producer's inbox or a sampling room. */
app.get("/s/:slug.md", async (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return res.status(404).send("Not found");
  const run = await findRunBySlug(slug);
  const md = run && renderShareMarkdown(run);
  if (!md) return res.status(404).send("This page doesn't exist (yet).");
  res.set("content-disposition", `attachment; filename="${slug}.md"`).type("text/markdown").send(md);
});

/** The share page. */
app.get("/s/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return res.status(404).send("Not found");
  const run = await findRunBySlug(slug);
  const html = run && renderSharePage(run);
  if (!html) return res.status(404).send("This page doesn't exist (yet).");
  res.type("html").send(html);
});

app.get("/run/:id", (_req, res) => res.sendFile(join(ROOT, "public", "index.html")));

// ---------- the agent door ----------

const publicUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
app.get("/.well-known/ayto.json", (req, res) => res.json(discovery(publicUrl(req))));
app.post("/mcp", (req, res, next) => (allow(req.ip, { perHour: 30, bucket: "mcp" }) ? next() : res.status(429).json({ jsonrpc: "2.0", error: { code: -32000, message: "Too many MCP calls this hour." }, id: null })), mcpHandler());
app.get("/mcp", (_req, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "AYTO's MCP server is stateless: POST JSON-RPC here. Discovery at /.well-known/ayto.json" }, id: null }));
app.delete("/mcp", (_req, res) => res.status(405).end());

const server = app.listen(config.port, async () => {
  const llm = await probeServerLlm();
  console.log(`AYTO on :${config.port} (mode=${config.mode}, llm=${llm.available ? `on (${llm.model})` : `off: ${llm.error ?? "no key"}`})`);
  if (process.env.PREWARM === "1" && config.mode !== "samples") setTimeout(prewarm, 3000);
});

// Run the showcases once in the background so judges never wait on Qloo.
async function prewarm() {
  for (const showcase of SHOWCASES) {
    try {
      const run = await createRun(await parseInput(showcase), { showcase: showcase.id });
      await startRun(run, 0);
      console.log(`prewarmed ${showcase.id}: ${run.status}`);
    } catch (error) {
      console.log(`prewarm ${showcase.id} failed: ${redact(error.message)}`);
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
