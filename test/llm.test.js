import assert from "node:assert/strict";
import { test } from "node:test";
import { credentialFrom, PROVIDERS, redact } from "../src/llm.js";

test("redact never leaks a key-shaped token", () => {
  for (const key of ["sk-abcdefghijklmnopqrstuvwxyz0123", "gsk_ABCDEFGHIJKLMNOPQRSTUV", "sk-ant-api03-abcdefghijklmnop", "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345", "xai-abcdefghijklmnop1234"]) {
    const out = redact(`Groq 401: Invalid API Key ${key} rejected`);
    assert.equal(out.includes(key), false, key);
    assert.match(out, /\[redacted\]/);
  }
  assert.equal(redact(`authorization: Bearer ${"x".repeat(50)}`).includes("x".repeat(50)), false);
});

test("every provider has a base URL, a default model and a label", () => {
  for (const [id, p] of Object.entries(PROVIDERS)) {
    assert.ok(p.model && p.label, id);
    // Every provider a browser can pick is a public https endpoint; the server-only local one reads LLM_BASE_URL.
    if (p.serverOnly) continue;
    assert.match(p.baseUrl, /^https:\/\//, id);
  }
  assert.ok(Object.keys(PROVIDERS).length >= 12);
});

test("credentialFrom validates provider and key shape", () => {
  assert.deepEqual(credentialFrom({ provider: "openai", key: "sk-abcdefghijkl", model: " gpt-x " }), { provider: "openai", key: "sk-abcdefghijkl", model: "gpt-x" });
  assert.throws(() => credentialFrom({ provider: "nope", key: "sk-abcdefghijkl" }), /Unknown LLM provider/);
  assert.throws(() => credentialFrom({ provider: "openai", key: "short" }), /doesn't look right/);
  assert.equal(credentialFrom(undefined), undefined);
});

test("the Anthropic adapter is wired for tools (no provider-level refusal)", async () => {
  const src = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/llm.js", import.meta.url), "utf8"));
  assert.ok(!src.includes("Tool calls need an OpenAI-compatible provider"));
  assert.ok(src.includes('type: "tool_use"') && src.includes('type: "tool_result"'));
});

test("DeepSeek gets the model that writes", async () => {
  const { createServer } = await import("node:http");
  const { chat } = await import("../src/llm.js");
  let seen;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      seen = { path: req.url, body: JSON.parse(body) };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const real = PROVIDERS.deepseek.baseUrl;
  PROVIDERS.deepseek.baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const message = await chat({ credential: credentialFrom({ provider: "deepseek", key: "sk-test-abcdefghijkl" }), messages: [{ role: "user", content: "hi" }] });
    assert.equal(message.content, "ok");
    assert.equal(seen.path, "/chat/completions");
    // deepseek-flash wrote empty plans live on 31 Oct; deepseek-chat wrote full ones.
    assert.equal(seen.body.model, "deepseek-chat");
  } finally {
    PROVIDERS.deepseek.baseUrl = real;
    server.close();
  }
});

test("Claude 5.x gets no temperature, low effort, room to think, fallbacks, and its blocks back in a tool loop", async () => {
  const { createServer } = await import("node:http");
  const { chat } = await import("../src/llm.js");
  const seen = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      seen.push({ path: req.url, beta: req.headers["anthropic-beta"], body: parsed });
      // First call: a thinking block, then a tool call. Second call: a thinking block, then the answer.
      const content = seen.length === 1
        ? [{ type: "thinking", thinking: "", signature: "sig-1" }, { type: "tool_use", id: "tu_1", name: "lookup", input: { q: "x" } }]
        : [{ type: "thinking", thinking: "", signature: "sig-2" }, { type: "text", text: "{\"ok\":true}" }];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ content, stop_reason: seen.length === 1 ? "tool_use" : "end_turn", usage: { input_tokens: 5, output_tokens: 5 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const real = PROVIDERS.anthropic.baseUrl;
  PROVIDERS.anthropic.baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const credential = credentialFrom({ provider: "anthropic", key: "sk-ant-test-abcdefghijkl" });
    const tools = [{ type: "function", function: { name: "lookup", description: "d", parameters: { type: "object", properties: { q: { type: "string" } } } } }];
    const first = await chat({ credential, messages: [{ role: "user", content: "hi" }], tools, temperature: 0.7, maxTokens: 2048 });
    assert.equal(first.tool_calls[0].function.name, "lookup");
    const second = await chat({ credential, messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "", tool_calls: first.tool_calls, blocks: first.blocks }, { role: "tool", tool_call_id: "tu_1", content: "{}" }], tools });
    assert.equal(second.content, "{\"ok\":true}", "the reply is read by block type, not position");
    const [a, b] = seen;
    assert.equal(a.path, "/messages");
    assert.equal("temperature" in a.body, false);
    assert.deepEqual(a.body.output_config, { effort: "low" });
    assert.ok(a.body.max_tokens >= 16000, "room for thinking as well as the reply");
    assert.equal(a.body.fallbacks, "default");
    assert.equal(a.beta, "server-side-fallback-2026-07-01");
    assert.deepEqual(b.body.messages[1].content[0], { type: "thinking", thinking: "", signature: "sig-1" }, "the thinking block goes back unchanged");
  } finally {
    PROVIDERS.anthropic.baseUrl = real;
    server.close();
  }
});
