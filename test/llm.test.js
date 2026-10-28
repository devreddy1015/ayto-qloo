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
    assert.match(p.baseUrl, /^https:\/\//, id);
    assert.ok(p.model && p.label, id);
  }
  assert.ok(Object.keys(PROVIDERS).length >= 12);
});

test("credentialFrom validates provider and key shape", () => {
  assert.deepEqual(credentialFrom({ provider: "openai", key: "sk-abcdefghijkl", model: " gpt-x " }), { provider: "openai", key: "sk-abcdefghijkl", model: "gpt-x" });
  assert.throws(() => credentialFrom({ provider: "nope", key: "sk-abcdefghijkl" }), /Unknown LLM provider/);
  assert.throws(() => credentialFrom({ provider: "openai", key: "short" }), /doesn't look right/);
  assert.equal(credentialFrom(undefined), undefined);
});
