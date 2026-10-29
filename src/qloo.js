// Qloo access layer.
//
// Every live call goes through Qloo's official harness (@qloo/qloo-harness):
//   - workflow tools (qloo_recommend, qloo_trends, ...) through `qloo mcp`,
//     one long-lived stdio MCP server per backend process;
//   - locality search through `qloo api search`;
//   - the two raw Insights requests the workflows don't cover, straight to
//     the API with the same key: heatmaps (the CLI prints an empty list for
//     them) and tag reads filtered by parent type (the tools take no filter).
// The API key stays in this process's environment and is never logged.
//
// Responses are cached privately on the server (allowed by the hackathon
// guide). In "samples" mode, recorded real responses are replayed instead.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

export class QlooError extends Error {
  constructor(message, { code = "QLOO_ERROR", retryable = false, envelope } = {}) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.envelope = envelope;
  }
}

// ---------- tiny utilities ----------

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const cacheKey = (kind, name, args) =>
  createHash("sha256").update(`${kind}|${name}|${stableStringify(args)}`).digest("hex").slice(0, 32);

class Semaphore {
  constructor(max) {
    this.max = max;
    this.active = 0;
    this.queue = [];
  }
  async run(fn) {
    if (this.active >= this.max) await new Promise((resolve) => this.queue.push(resolve));
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

const limiter = new Semaphore(config.qloo.concurrency);
const memory = new Map(); // key -> Promise<value>, de-duplicates in-flight calls too

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

async function writeJson(dir, key, value) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${key}.json`), JSON.stringify(value));
}

// ---------- MCP connection ----------

let clientPromise;

async function connect() {
  const client = new Client({ name: "culture-gap", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.qloo.command,
    args: ["mcp"],
    // Forward the environment so QLOO_API_KEY / QLOO_BASE_URL reach the server.
    env: process.env,
    stderr: "ignore",
  });
  transport.onclose = () => {
    clientPromise = undefined;
  };
  await client.connect(transport);
  return client;
}

async function mcpClient() {
  clientPromise ??= connect().catch((error) => {
    clientPromise = undefined;
    throw error.code === "ENOENT"
      ? new QlooError("The Qloo harness is not installed. Run npm install.", { code: "QLOO_HARNESS_MISSING" })
      : error;
  });
  return clientPromise;
}

export async function listQlooTools() {
  const client = await mcpClient();
  const { tools } = await client.listTools();
  return tools;
}

async function callMcpTool(name, args) {
  const client = await mcpClient();
  let result;
  try {
    result = await client.callTool({ name, arguments: args }, undefined, { timeout: config.qloo.timeoutMs });
  } catch (error) {
    // A harness timeout under load is worth one more try; withRetry only retries QlooErrors marked retryable.
    if (error?.code === -32001 || /timed out/i.test(error?.message ?? "")) throw new QlooError(`Qloo tool ${name} timed out after ${config.qloo.timeoutMs} ms`, { code: "QLOO_TIMEOUT", retryable: true });
    throw error;
  }
  const envelope = result.structuredContent ?? safeParse(result.content?.[0]?.text) ?? {};
  if (envelope.status === "error" || result.isError) {
    throw new QlooError(envelope.summary || `Qloo tool ${name} failed`, {
      code: envelope.error?.code ?? "QLOO_TOOL_ERROR",
      retryable: Boolean(envelope.error?.retryable),
      envelope,
    });
  }
  return envelope;
}

function safeParse(text) {
  try {
    return typeof text === "string" ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

// ---------- raw requests ----------

function runQlooApi(args) {
  return new Promise((resolve, reject) => {
    execFile(
      config.qloo.command,
      ["api", ...args, "--json", "--quiet", "--no-color"],
      { env: process.env, timeout: config.qloo.timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || error.message).replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
          return reject(new QlooError(`qloo api failed: ${detail.slice(0, 300)}`, { code: "QLOO_API_ERROR" }));
        }
        const parsed = safeParse(stdout);
        if (parsed === undefined) return reject(new QlooError("qloo api returned non-JSON output"));
        resolve(parsed);
      },
    );
  });
}

const redact = (text) => String(text).replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");

/** One authenticated GET against the Qloo API. Lists become comma-separated values. */
async function rawGet(path, params) {
  const url = new URL(path, process.env.QLOO_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { "X-Api-Key": process.env.QLOO_API_KEY ?? "", accept: "application/json" },
      signal: AbortSignal.timeout(config.qloo.timeoutMs),
    });
  } catch (error) {
    const why = error?.name === "TimeoutError" ? `timed out after ${config.qloo.timeoutMs} ms` : redact(error?.message ?? error);
    throw new QlooError(`Qloo request failed: ${why}`, { code: "QLOO_NETWORK", retryable: true });
  }
  if (res.status === 401 || res.status === 403) throw new QlooError("Qloo rejected the API key.", { code: "QLOO_AUTH" });
  if (res.status === 429 || res.status >= 500) throw new QlooError(`Qloo returned ${res.status}.`, { code: "QLOO_HTTP", retryable: true });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new QlooError(`Qloo returned ${res.status}: ${redact(body).slice(0, 200)}`, { code: "QLOO_HTTP" });
  }
  return res.json();
}

const rawInsights = (params) => rawGet("/v2/insights", params);

// ---------- public, cached entry points ----------

async function cached(kind, name, args, live) {
  const key = cacheKey(kind, name, args);
  if (memory.has(key)) return memory.get(key);

  const promise = (async () => {
    const sample = await readJson(join(config.samplesDir, "qloo", `${key}.json`));
    if (config.mode === "samples") {
      if (sample) return sample.value;
      throw new QlooError(
        "This request isn't in the recorded samples. Pick one of the example waves, or run with a Qloo key.",
        { code: "NOT_IN_SAMPLES" },
      );
    }
    const disk = await readJson(join(config.cacheDir, "qloo", `${key}.json`));
    if (disk) return disk.value;

    const value = await limiter.run(() => withRetry(live));
    const record = { kind, name, args, at: new Date().toISOString(), value };
    await writeJson(join(config.cacheDir, "qloo"), key, record).catch(() => {});
    if (process.env.RECORD_SAMPLES === "1") {
      await writeJson(join(config.samplesDir, "qloo"), key, record).catch(() => {});
    }
    return value;
  })();

  memory.set(key, promise);
  promise.catch(() => memory.delete(key));
  return promise;
}

async function withRetry(fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!(error instanceof QlooError) || !error.retryable || i === attempts - 1) throw error;
      if (error.code === "QLOO_TIMEOUT" && i >= 1) throw error; // a call that timed out twice is slow, not flaky
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw lastError;
}

/** Cache any other expensive, deterministic-enough step (the written brief) the same way. */
export function memo(kind, name, args, fn) {
  return cached(kind, name, args, fn);
}

/** Run one Qloo workflow tool (qloo_recommend, qloo_trends, ...). Returns the envelope. */
export async function qlooTool(name, args) {
  if (config.mode === "fake") return (await import("./fake-qloo.js")).fakeTool(name, args);
  return cached("mcp", name, args, () => callMcpTool(name, args));
}

/** Entity search through `qloo api search`. Returns { results: [...] } of raw Qloo entities. */
export async function qlooSearch(args) {
  if (config.mode === "fake") return (await import("./fake-qloo.js")).fakeSearch(args);
  return cached("api", "search", args, async () => {
    const out = await runQlooApi(["search", "-q", args.query, ...(args.type ? ["-t", args.type] : []), "-n", String(args.take ?? 10)]);
    return { results: Array.isArray(out) ? out : (out?.results ?? []) };
  });
}

/** Entities by id, with their tags and properties (a love's own style and theme tags). */
export async function qlooEntities(ids) {
  const list = [...new Set((ids ?? []).filter(Boolean))].slice(0, 10);
  if (!list.length) return { results: [] };
  if (config.mode === "fake") return (await import("./fake-qloo.js")).fakeEntities(list);
  return cached("api", "entities", { ids: list }, () => rawGet("/entities", { entity_ids: list }));
}

/** Raw Insights request (heatmaps, typed tag reads). Returns the raw API response. */
export async function qlooInsights(params) {
  if (config.mode === "fake") return (await import("./fake-qloo.js")).fakeInsights(params);
  return cached("api", "insights", params, () => rawInsights(params));
}

export async function qlooStatus() {
  if (config.mode === "samples" || config.mode === "fake") return { mode: config.mode, ready: true };
  try {
    const client = await mcpClient();
    const cap = await client.callTool({ name: "qloo_capabilities", arguments: {} });
    const ready = Boolean(cap.structuredContent?.adapter?.canonical_workflow_execution);
    return { mode: "live", ready };
  } catch (error) {
    return { mode: "live", ready: false, error: error.message };
  }
}

export async function closeQloo() {
  const client = await clientPromise?.catch(() => undefined);
  await client?.close().catch(() => {});
}
