// DeepSeek as the server's backup writer, against two fake APIs: the server's own model fails, DeepSeek writes, and
// the brief says so; a visitor's own key never falls back to the server's DeepSeek; both failing says both; and the
// backup never becomes the site's model.
process.env.CULTURE_GAP_MODE = "fake";
for (const k of ["GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "LLM_MODEL"]) process.env[k] = "";
process.env.CACHE_DIR = `/tmp/ayto-backup-test-${process.pid}`;
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const PLAN = { titles: ["Night Till"], logline: "A clerk keeps a secret for one more night.", story: "A clerk keeps a secret for one more night, and the city keeps it with her." };
const calls = [];
const servers = [];
let mainDown = true;
let backupDown = false;

/** A fake OpenAI-compatible API that records each call and answers with `answer()` (status, body). */
async function fakeApi(name, answer) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      calls.push({ name, path: req.url, auth: req.headers.authorization, model: parsed.model, keys: (parsed.messages ?? []).flatMap((m) => Object.keys(m)) });
      const [status, out] = answer(parsed);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}/v1`;
}

before(async () => {
  // The server's own model: down with a 401 (a key that ran out), which isn't retried, so the tests stay fast.
  process.env.LLM_BASE_URL = await fakeApi("main", () => (mainDown ? [401, { error: { message: "invalid x-api-key" } }] : [200, { choices: [{ message: { role: "assistant", content: JSON.stringify(PLAN) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }]));
  process.env.LLM_PROVIDER = "local";
  process.env.DEEPSEEK_BASE_URL = await fakeApi("deepseek", () => (backupDown ? [503, { error: { message: "Service unavailable" } }] : [200, { choices: [{ message: { role: "assistant", content: JSON.stringify(PLAN) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }]));
  process.env.DEEPSEEK_API_KEY = "sk-deepseek-test-abcdefghijklmnop";
});

after(async () => {
  for (const s of servers) s.close();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

test("the server's model fails, DeepSeek answers, and the site's model stays the server's", async () => {
  calls.length = 0;
  const { chat, currentModel, llmStatus } = await import("../src/llm.js");
  // A budget whose third isn't a whole number of milliseconds: the main model must still be asked.
  const message = await chat({ messages: [{ role: "system", content: "Write." }, { role: "user", content: "Go." }], deadline: Date.now() + 30001 });
  assert.deepEqual(JSON.parse(message.content), PLAN);
  assert.deepEqual(calls.map((c) => c.name), ["main", "deepseek"], "a 401 isn't retried; the backup is asked once");
  const ds = calls[1];
  assert.equal(ds.path, "/v1/chat/completions");
  assert.equal(ds.auth, "Bearer sk-deepseek-test-abcdefghijklmnop");
  assert.equal(ds.model, "deepseek-chat", "the DeepSeek model that writes full treatments");
  assert.deepEqual(message._by, { provider: "deepseek", model: "deepseek-chat", backup: true, after: message._by.after });
  assert.match(message._by.after, /401/);
  assert.equal(Object.keys(message).includes("_by"), false, "the marker never goes back to a model in a tool loop");
  assert.equal(currentModel(), "local-model", "the backup never becomes the site's model");
  assert.equal(llmStatus().backup, "deepseek");
});

test("a visitor's own key never falls back to the server's DeepSeek", async () => {
  calls.length = 0;
  const { chat } = await import("../src/llm.js");
  const visitor = { provider: "local", key: "visitor-key-abcdefghij" }; // a visitor's key, pointed at the failing model
  await assert.rejects(chat({ credential: visitor, messages: [{ role: "user", content: "x" }], deadline: Date.now() + 8000 }), /401/);
  assert.ok(calls.every((c) => c.name !== "deepseek"), "DeepSeek was never asked");
});

test("both down: the error names both", async () => {
  calls.length = 0;
  backupDown = true;
  try {
    const { chat } = await import("../src/llm.js");
    await assert.rejects(chat({ messages: [{ role: "user", content: "x" }], deadline: Date.now() + 9000 }), (e) => /401/.test(e.message) && /backup .*503/.test(e.message));
  } finally {
    backupDown = false;
  }
});

test("a brief written by the backup says so; with the server's model back, the backup sits out", async () => {
  calls.length = 0;
  const { parseInput } = await import("../src/parse.js");
  const { createRun, startRun } = await import("../src/pipeline/runner.js");
  const { SHOWCASES } = await import("../src/presets.js");
  const showcase = SHOWCASES.find((s) => s.format === "film");
  const run = await createRun(await parseInput(showcase), { showcase: showcase.id });
  await startRun(run, 0);
  const write = run.stages.write.output;
  assert.equal(write.fallback, false, "DeepSeek's brief is used, not the template");
  assert.deepEqual(write.llm, { provider: "deepseek", model: "deepseek-chat", byok: false, server: true, backup: true });
  assert.match(write.summary, /^Written by deepseek \(deepseek-chat\), the backup writer, because the main model failed/);
  assert.equal(write.plan.logline, PLAN.logline);
  assert.ok(calls.some((c) => c.name === "deepseek"));

  mainDown = false;
  calls.length = 0;
  const { chat } = await import("../src/llm.js");
  const message = await chat({ messages: [{ role: "user", content: "x" }], deadline: Date.now() + 30000 });
  assert.equal(message._by, undefined);
  assert.deepEqual(calls.map((c) => c.name), ["main"]);
});

test("no DeepSeek key, or DeepSeek already the server's model: no backup", async () => {
  const { backupCredential } = await import("../src/llm.js");
  assert.ok(backupCredential());
  assert.equal(backupCredential({ provider: "deepseek", key: "x", server: true }), undefined);
  assert.equal(backupCredential({ provider: "groq", key: "x" }), undefined, "a visitor's key");
  const key = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    assert.equal(backupCredential(), undefined);
  } finally {
    process.env.DEEPSEEK_API_KEY = key;
  }
});
