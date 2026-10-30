import express from "express";
import { join } from "node:path";
import { runAsk } from "./ask.js";
import { config, ROOT } from "./config.js";
import { checkCredential, credentialFrom, llmAvailable, llmStatus, probeServerLlm, providerList, redact } from "./llm.js";
import { discovery, mcpHandler } from "./mcp.js";
import { imageAvailable, imageBudget, imageFile, imageStatus, startImage } from "./image.js";
import { mosaic, worldWall } from "./mosaic.js";
import { gallery } from "./gallery.js";
import { candidates, heuristicParse, parseInput } from "./parse.js";
import { CANDIDATE_CITIES, closestKnownCity } from "./cities.js";
import { FORMAT_IDS } from "./formats.js";
import { marketFrom, whereToMake } from "./engine/where.js";
import { renderShareMarkdown, renderSharePage } from "./pipeline/page.js";
import { createRun, editAndRerun, forkRun, isRunning, laneFirstEdit, regenerate, rerunFrom, startRun } from "./pipeline/runner.js";
import { findRunBySlug, loadRun, ownsRun, publicRun, subscribe } from "./pipeline/store.js";
import { formatList, MARKETS, SHOWCASES } from "./presets.js";
import { closeQloo, qlooStatus } from "./qloo.js";

const app = express();
app.disable("x-powered-by");
// One proxy hop: req.ip is the address the nearest proxy saw, not a client-supplied X-Forwarded-For. (The limits
// read clientIp below, which on Render is Cloudflare's header.)
// TRUST_PROXY may be a hop count, true/false, or addresses; anything Express refuses (empty, "yes") means one hop.
const trust = String(process.env.TRUST_PROXY ?? "").trim();
try {
  app.set("trust proxy", /^\d+$/.test(trust) ? Number(trust) : trust === "true" ? true : trust === "false" ? false : trust || 1);
} catch {
  console.error(`TRUST_PROXY "${trust.slice(0, 40)}" isn't a hop count, true/false or an address list; trusting one hop.`);
  app.set("trust proxy", 1);
}
// The visitor's address for the per-address limits. On Render, Cloudflare and Render's own proxy sit in front and the
// address Express sees changed with every request (checked live on 31 Oct: 21 requests to a 20-an-hour route all
// passed), so no limit ever tripped. Cloudflare sets CF-Connecting-IP to the visitor and refuses a request that sends
// its own, so on Render that header is the address. CLIENT_IP_HEADER names another header; leave it unset wherever a
// visitor could reach the app without such a proxy, and req.ip (trust proxy above) is used.
const CLIENT_IP_HEADER = String(process.env.CLIENT_IP_HEADER ?? (process.env.RENDER ? "cf-connecting-ip" : "")).trim().toLowerCase();
const clientIp = (req) => (CLIENT_IP_HEADER && String(req.get(CLIENT_IP_HEADER) ?? "").split(",")[0].trim().slice(0, 64)) || req.ip;

// Express 4 lets a rejected async handler escape, and Node then exits: one bad request would take the server down.
// Every handler registered below is guarded, so its errors reach the error handler at the end instead.
const guard = (h) => (typeof h !== "function" || h.length === 4 ? h : (req, res, next) => {
  try {
    Promise.resolve(h(req, res, next)).catch(next);
  } catch (error) {
    next(error);
  }
});
for (const method of ["get", "post", "delete"]) {
  const register = app[method].bind(app);
  app[method] = (path, ...handlers) => (handlers.length ? register(path, ...handlers.map(guard)) : register(path));
}
// Every response: no MIME sniffing, no framing by another site (clickjacking), and only the origin in a Referer.
app.use((_req, res, next) => {
  res.set({ "x-content-type-options": "nosniff", "x-frame-options": "DENY", "content-security-policy": "frame-ancestors 'none'", "referrer-policy": "strict-origin-when-cross-origin" });
  next();
});
app.use(express.json({ limit: "64kb" }));
// Pages, scripts and styles revalidate on every load (an ETag makes that a cheap 304), so a deploy is never
// half old and half new in someone's browser; images and data may be cached for five minutes.
app.use(
  express.static(join(ROOT, "public"), {
    maxAge: "5m",
    setHeaders(res, path) {
      if (/\.(html|js|css)$/.test(path)) res.setHeader("Cache-Control", "no-cache");
    },
  }),
);

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
  // Drop addresses with nothing in the last hour, so the map can't grow without bound.
  if (hits.size > 5000) for (const [k, list] of hits) if (!list.some((t) => now - t < 3600e3)) hits.delete(k);
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

/**
 * The run a change applies to: the caller's own when their edit key matches, else a copy made for them, so nobody
 * changes a run someone else started (a showcase, a page in the gallery). Returns the run and, for a copy, its key.
 */
async function ownRun(run, req) {
  if (ownsRun(run, req.body?.editKey)) return { run };
  const copy = await forkRun(run);
  return { run: copy, forked: { id: copy.id, editKey: copy.editKey } };
}

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
  res.json({ showcases: SHOWCASES.map(({ id, label, text, format }) => ({ id, label, text, format })), formats: formatList(), markets: MARKETS, providers: providerList(), mode: config.mode, llm: llmStatus(), images: imageAvailable() });
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
  const out = await mosaic({ runId });
  // The home wall is cached for five minutes only once its world titles are in; a half-ready wall is never cached.
  res.set("cache-control", runId ? "private, max-age=60" : config.mode === "live" && !out.world ? "no-store" : "public, max-age=300");
  res.json(out);
});

/** One tiny call with the user's key, so a bad key fails before a run. The key is not kept. */
app.post("/api/llm/check", async (req, res) => {
  if (!allow(clientIp(req), { perHour: 20, bucket: "check" })) return res.status(429).json({ error: "Too many key checks this hour." });
  const body = req.body?.llm ? req.body : { llm: req.body };
  const credential = credentialOf(body, res);
  if (credential === null) return;
  if (!credential) return res.status(400).json({ error: "Send a provider and a key." });
  res.json(await checkCredential(credential));
});

/** Sentence → structured input plus what Qloo makes of it. Nothing runs yet. */
app.post("/api/parse", async (req, res) => {
  if (!allow(clientIp(req), { perHour: 40, bucket: "parse" })) return res.status(429).json({ error: "Too many requests this hour." });
  try {
    const input = await parseInput(req.body ?? {});
    const found = await candidates(input);
    res.json({ input, ...found });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

/**
 * "Where should I make it?": one theme across a market's largest cities, each measured against the country and
 * against the other cities. Qloo only (no model), so it works with no key. The market comes from the request, a
 * country or city named in the sentence, else India.
 */
app.post("/api/where", async (req, res) => {
  if (!allow(clientIp(req), { perHour: 20, bucket: "where" })) return res.status(429).json({ error: "You've compared a lot of cities this hour. Try again later." });
  try {
    const body = req.body ?? {};
    const text = String(body.text ?? "").slice(0, 600);
    const h = text ? heuristicParse(text) : { format: "film", theme: "", city: "" };
    const format = FORMAT_IDS.includes(body.format) ? body.format : h.format;
    const theme = String(body.theme || h.theme || "").trim().slice(0, 60);
    if (!theme) return res.status(400).json({ error: "Say what it's about (crime, romance, nightlife) so AYTO knows what to compare." });
    const cityText = String(body.city || h.city || "").split(",")[0].trim().toLowerCase();
    const cityMarket = cityText ? Object.entries(CANDIDATE_CITIES).find(([, list]) => list.some((n) => n.toLowerCase() === cityText))?.[0] ?? closestKnownCity(cityText)?.market : undefined;
    const market = (typeof body.market === "string" && CANDIDATE_CITIES[body.market] ? body.market : undefined) ?? marketFrom(`${text} ${body.city ?? ""}`) ?? cityMarket ?? "India";
    res.json(await whereToMake({ format, theme, market, text }));
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
  // Showcases skip the daily budget (their Qloo reads are cached) but not the per-address limit.
  if (showcase ? !allow(clientIp(req), { perHour: 30, bucket: "showcase" }) : !allow(clientIp(req))) return res.status(429).json({ error: "You've started a lot of runs this hour. Try again later." });
  try {
    const input = await parseInput(showcase ?? body);
    // Counted only once the input is a real run, so empty or broken requests can't use up the day.
    if (!showcase && !allowGlobal({ llm: !credential && llmAvailable() })) return res.status(503).json({ error: "The demo has hit today's budget. The showcase runs still work, or bring your own LLM key." });
    const run = await createRun(input, { showcase: showcase?.id, credential });
    startRun(run, 0).catch(() => {});
    res.status(201).json({ id: run.id, editKey: run.editKey, input, llm: run.llm });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

app.get("/api/runs/:id", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  res.json(publicRun(run));
});

/**
 * Live events: the run as it is now (a snapshot), then every new event. Past events are not replayed on top of the
 * snapshot, which already holds their result: replaying them flashed finished stages back to "running", marked
 * kept stages stale and brought back receipts a rerun had replaced. A reconnect (Last-Event-ID) gets a fresh snapshot.
 */
app.get("/api/runs/:id/events", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  const send = sse(res);
  send({ type: "snapshot", run: publicRun(run) });
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

/**
 * Put one of the run's lanes first and rerun everything after the gap. That is the only edit the web takes: the
 * lanes are rebuilt from the run, so no text or shape from the request is ever stored.
 */
app.post("/api/runs/:id/edit", async (req, res) => {
  const original = await loadRun(req.params.id);
  if (!original) return res.status(404).json({ error: "No such run." });
  if (!allow(clientIp(req))) return res.status(429).json({ error: "Too many reruns this hour." });
  const { stage, edits } = req.body ?? {};
  if (stage !== "gap") return res.status(400).json({ error: "Only the lane order can be changed." });
  const first = edits?.lanes?.[0];
  const lane = typeof req.body?.lane === "string" ? req.body.lane : typeof first === "string" ? first : first?.name;
  if (typeof lane !== "string" || !laneFirstEdit(original, lane)) return res.status(400).json({ error: "Pick one of this run's lanes." });
  if (isRunning(original.id)) return res.status(400).json({ error: "This run is still working. Wait for it to finish." });
  const credential = credentialOf(req.body, res);
  if (credential === null) return;
  try {
    const { run, forked } = await ownRun(original, req);
    const job = await editAndRerun(run, "gap", laneFirstEdit(run, lane), credential);
    job.done.catch(() => {});
    res.json({ ok: true, ...(forked ? { forked } : {}) });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

/** Change the production assumptions and recompute from the produce stage. Numbers only; nothing else in the run moves. */
app.post("/api/runs/:id/assumptions", async (req, res) => {
  const original = await loadRun(req.params.id);
  if (!original) return res.status(404).json({ error: "No such run." });
  if (!allow(clientIp(req), { perHour: 30, bucket: "assumptions" })) return res.status(429).json({ error: "Too many recomputes this hour." });
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
  if (!original.plan?.includes("produce")) return res.status(400).json({ error: "This run has no production stage." });
  const before = original.plan[original.plan.indexOf("produce") - 1];
  if (original.stages?.[before]?.status !== "done") return res.status(400).json({ error: "The stages before it must finish first." });
  if (isRunning(original.id)) return res.status(400).json({ error: "This run is still working. Wait for it to finish." });
  try {
    const { run, forked } = await ownRun(original, req);
    const job = await rerunFrom(run, "produce", { assumptions: clean });
    job.done.catch(() => {});
    res.json({ ok: true, assumptions: run.input.assumptions, ...(forked ? { forked } : {}) });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

/** Write again, with the user's own key and/or in another language. */
app.post("/api/runs/:id/regenerate", async (req, res) => {
  const original = await loadRun(req.params.id);
  if (!original) return res.status(404).json({ error: "No such run." });
  if (!allow(clientIp(req))) return res.status(429).json({ error: "Too many reruns this hour." });
  const credential = credentialOf(req.body, res);
  if (credential === null) return;
  if (!credential && !llmAvailable()) return res.status(400).json({ error: "Add a key to write again." });
  const w = original.plan?.indexOf("write") ?? -1;
  if (w < 0 || original.stages?.[original.plan[w - 1]]?.status !== "done") return res.status(400).json({ error: "The evidence stages must finish first." });
  if (isRunning(original.id)) return res.status(400).json({ error: "This run is still working. Wait for it to finish." });
  if (!credential && !allowGlobal({ llm: true })) return res.status(503).json({ error: "The demo has hit today's budget. Bring your own key to write." });
  try {
    const { run, forked } = await ownRun(original, req);
    const job = await regenerate(run, credential, { language: typeof req.body?.language === "string" ? req.body.language.slice(0, 30) : undefined });
    job.done.catch(() => {});
    res.json({ ok: true, llm: run.llm, ...(forked ? { forked } : {}) });
  } catch (error) {
    res.status(400).json({ error: publicError(error) });
  }
});

// ---------- concept image: one picture from a finished brief (OpenAI), on demand, never a stage ----------

const RUN_ID = /^[A-Za-z0-9_-]{3,40}$/;
app.post("/api/runs/:id/image", async (req, res) => {
  if (!imageAvailable()) return res.status(503).json({ error: "Concept images aren't switched on for this site." });
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "No such run." });
  if (run.status !== "done") return res.status(409).json({ error: "Wait for the run to finish, then draw." });
  const now = await imageStatus(run.id);
  if (now.status === "drawing" || now.status === "done") return res.json(now);
  if (!allow(clientIp(req), { perHour: 6, bucket: "image" })) return res.status(429).json({ error: "You've drawn a lot of images this hour. Try again later." });
  if (!imageBudget({ take: true })) return res.status(503).json({ error: "The demo has drawn today's images. Try again tomorrow." });
  try {
    await startImage(run);
  } catch (error) {
    return res.status(error.status ?? 400).json({ error: publicError(error) });
  }
  res.status(202).json({ status: "drawing" });
});
app.get("/api/runs/:id/image", async (req, res) => {
  if (!RUN_ID.test(req.params.id)) return res.status(404).json({ error: "No such run." });
  res.json(await imageStatus(req.params.id));
});
app.get("/api/runs/:id/image.jpg", async (req, res) => {
  if (!RUN_ID.test(req.params.id)) return res.status(404).send("Not found");
  try {
    res.type("jpeg").set("cache-control", "public, max-age=3600").send(await imageFile(req.params.id));
  } catch {
    res.status(404).send("No image yet.");
  }
});

app.post("/api/ask", async (req, res) => {
  const { question, context } = req.body ?? {};
  if (typeof question !== "string" || !question.trim()) return res.status(400).json({ error: "Ask a question." });
  if (!allow(clientIp(req), { perHour: 20, bucket: "ask" })) return res.status(429).json({ error: "You've asked a lot this hour. Try again later." });
  const credential = credentialOf(req.body, res);
  if (credential === null) return;
  if (!credential && !llmAvailable()) return res.status(400).json({ error: "The analyst needs a language model. Add your key in the drawer." });
  // A question on the server's model counts against its daily cap like a run does.
  if (!credential && !allowGlobal({ llm: true })) return res.status(503).json({ error: "The demo has hit today's budget. Bring your own key to ask." });
  const emit = sse(res);
  const left = new AbortController();
  res.on("close", () => left.abort());
  try {
    await runAsk({ question, context, credential, signal: left.signal }, emit);
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

// PUBLIC_URL if set; on Render its own RENDER_EXTERNAL_URL; else the request's host (behind the trusted proxy).
const publicUrl = (req) => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
app.get("/.well-known/ayto.json", (req, res) => res.json(discovery(publicUrl(req))));
app.post(
  "/mcp",
  (req, res, next) => {
    // One JSON-RPC message per request (MCP dropped batching), so each tool call meets the limits below.
    if (Array.isArray(req.body)) return res.status(400).json({ jsonrpc: "2.0", error: { code: -32600, message: "Send one JSON-RPC message per request." }, id: null });
    const id = req.body?.id ?? null;
    const call = req.body?.method === "tools/call" ? req.body.params ?? {} : undefined;
    // Tool calls run the engine: 30 an hour. Handshakes and listings are cheap, so a reconnecting client isn't shut out.
    if (!allow(clientIp(req), call ? { perHour: 30, bucket: "mcp" } : { perHour: 300, bucket: "mcp-meta" })) return res.status(429).json({ jsonrpc: "2.0", error: { code: -32000, message: "Too many MCP calls this hour." }, id });
    // A tool call runs the engine against Qloo: it counts against the same daily budget as a web run, and a write
    // without the caller's own provider and key spends the server's model too.
    const serverModel = call?.name === "ayto_write" && !(call.arguments?.key && call.arguments?.provider) && llmAvailable();
    if (call && !allowGlobal({ llm: serverModel })) return res.status(503).json({ jsonrpc: "2.0", error: { code: -32000, message: "The demo has hit today's budget." }, id });
    next();
  },
  mcpHandler(),
);
app.get("/mcp", (_req, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "AYTO's MCP server is stateless: POST JSON-RPC here. Discovery at /.well-known/ayto.json" }, id: null }));
app.delete("/mcp", (_req, res) => res.status(405).end());

// Anything a route threw: logged without secrets, answered plainly, and the server stays up. A body that isn't JSON
// or is too large is the caller's mistake (400, 413), not a server error, and on /mcp it is a JSON-RPC error.
app.use((error, req, res, _next) => {
  const status = Number(error?.status ?? error?.statusCode);
  const theirs = status >= 400 && status < 500;
  if (!theirs) console.error(`${req.method} ${req.path} failed: ${redact(error?.stack ?? error?.message ?? error).slice(0, 500)}`);
  if (res.headersSent) return res.end();
  const message = !theirs ? "Something went wrong on the server. Try again." : status === 413 ? "That request is too large." : "That request isn't valid JSON.";
  if (req.path === "/mcp") return res.status(theirs ? status : 500).json({ jsonrpc: "2.0", error: { code: theirs ? -32700 : -32603, message }, id: null });
  res.status(theirs ? status : 500).json({ error: message });
});
process.on("unhandledRejection", (error) => console.error(`unhandled: ${redact(error?.stack ?? error?.message ?? error).slice(0, 500)}`));

export const server = app.listen(config.port, async () => {
  const llm = await probeServerLlm();
  console.log(`AYTO on :${config.port} (mode=${config.mode}, llm=${llm.available ? `on (${llm.model})` : `off: ${llm.error ?? "no key"}`})`);
  if (process.env.PREWARM === "1" && config.mode !== "samples") setTimeout(prewarm, 3000);
  // The home page's world wall resolves through Qloo search in the background, so the first visitor sees it.
  if (config.mode === "live") setTimeout(() => worldWall().then((w) => console.log(`world wall: ${w.length} titles`)), 1500);
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
