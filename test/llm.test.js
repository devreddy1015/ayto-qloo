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
