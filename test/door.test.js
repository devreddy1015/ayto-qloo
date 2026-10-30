// The doors other people and agents use: MCP says why a run failed and links to an absolute share page, a key
// needs its provider, malformed JSON is the caller's 400 (a JSON-RPC error on /mcp), the analyst stops at its
// Qloo budget, and one odd run can't take the gallery down.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

let llm;
let base;
let server;
let toolCalls = 0;

before(async () => {
  // A model that always asks for forty Qloo lookups at once, then for titles in a shape the gallery once tripped on.
  llm = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const system = (parsed.messages ?? []).filter((m) => m.role === "system").map((m) => m.content).join("\n");
      let message;
      if (/single word: ok/i.test(system)) message = { role: "assistant", content: "ok" };
      else if (parsed.tools?.length && !(parsed.messages ?? []).some((m) => m.role === "user" && /Answer now/.test(m.content))) {
        message = { role: "assistant", content: "", tool_calls: Array.from({ length: 40 }, (_, i) => ({ id: `t${toolCalls}-${i}`, type: "function", function: { name: "qloo_find_tags", arguments: JSON.stringify({ query: `crime ${i}` }) } })) };
      } else if (parsed.tools?.length) message = { role: "assistant", content: "Answered with what I had." };
      else message = { role: "assistant", content: JSON.stringify({ titles: [{ title: "Late Shift", why: "x" }], logline: "A line." }) };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
  await new Promise((r) => llm.listen(0, "127.0.0.1", r));
  process.env.CULTURE_GAP_MODE = "fake";
  process.env.GROQ_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.LLM_PROVIDER = "local";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${llm.address().port}/v1`;
  process.env.CACHE_DIR = `/tmp/ayto-door-test-${process.pid}`;
  process.env.PORT = String(41000 + (process.pid % 20000));
  process.env.SCANS_PER_IP_PER_HOUR = "100";
  process.env.PUBLIC_URL = "https://ayto.example";
  ({ server } = await import("../src/server.js"));
  await new Promise((r) => (server.listening ? r() : server.once("listening", r)));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  // The analyst lists the harness's tools, which starts `qloo mcp`; close it so the test process can exit.
  await (await import("../src/qloo.js")).closeQloo();
  llm.closeAllConnections?.();
  llm.close();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

async function rpc(method, params, id = 1) {
  const res = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  const text = await res.text();
  const data = text.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)))[0] ?? JSON.parse(text);
  return { status: res.status, data };
}

test("an MCP run that fails says why, as a tool error", async () => {
  const { data } = await rpc("tools/call", { name: "ayto_read_city", arguments: { city: "Qwxzzy Nowhere", format: "film" } });
  const result = data.result;
  assert.equal(result.isError, true);
  assert.match(result.structuredContent.error, /couldn't place/i);
});

test("an MCP write's share link is absolute, and a key without its provider is refused", async () => {
  const { data } = await rpc("tools/call", { name: "ayto_write", arguments: { city: "Hyderabad, India", theme: "crime", format: "film" } });
  assert.match(data.result.structuredContent.share, /^https:\/\/ayto\.example\/s\//);
  const keyOnly = await rpc("tools/call", { name: "ayto_write", arguments: { city: "Hyderabad, India", key: "sk-test-not-a-real-key-123456" } });
  assert.equal(keyOnly.data.result?.isError ?? Boolean(keyOnly.data.error), true);
  assert.match(JSON.stringify(keyOnly.data), /provider/);
});

test("malformed JSON is the caller's 400, and a JSON-RPC parse error on /mcp", async () => {
  const bad = await fetch(`${base}/api/parse`, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /valid JSON/);
  const big = await fetch(`${base}/api/parse`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(70000) }) });
  assert.equal(big.status, 413);
  const mcp = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{oops" });
  assert.equal(mcp.status, 400);
  assert.equal((await mcp.json()).error.code, -32700);
});

test("the analyst stops at its Qloo budget however many lookups the model asks for", async () => {
  const res = await fetch(`${base}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "Why folk?", context: { city: "Hyderabad" } }) });
  const text = await res.text();
  const events = text.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  const ran = events.filter((e) => e.type === "call" && e.status === "running").length;
  assert.ok(ran > 0 && ran <= 12, `ran ${ran} Qloo lookups`);
  assert.ok(events.some((e) => e.type === "answer"));
});

test("a run whose titles came as objects still leaves the gallery up", async () => {
  const started = await fetch(`${base}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ showcase: "hyderabad-crime-film" }) }).then((r) => r.json());
  for (let i = 0; i < 200; i += 1) {
    const run = await fetch(`${base}/api/runs/${started.id}`).then((r) => r.json());
    if (run.status !== "running") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const gallery = await fetch(`${base}/api/gallery`);
  assert.equal(gallery.status, 200);
  const { cards } = await gallery.json();
  assert.ok(cards.every((c) => typeof c.title === "string"));
});
