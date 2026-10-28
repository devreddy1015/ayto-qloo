import assert from "node:assert/strict";
import { test } from "node:test";
import { recordUsage, runWithUsage } from "../src/usage.js";

test("model usage is counted against the run whose stage is executing", async () => {
  const run = { id: "r1" };
  await runWithUsage(run, "write", async () => {
    recordUsage({ provider: "anthropic", model: "claude-sonnet-5-5", input: 3000, output: 900, byok: true });
    await new Promise((r) => setTimeout(r, 5));
    recordUsage({ provider: "anthropic", model: "claude-sonnet-5-5", input: 500, output: 100, byok: true });
  });
  assert.equal(run.usage.calls, 2);
  assert.equal(run.usage.input, 3500);
  assert.equal(run.usage.output, 1000);
  assert.equal(run.usage.byok, true);
  assert.equal(run.usage.items[0].stage, "write");
  // Outside any run nothing is recorded and nothing throws.
  assert.equal(recordUsage({ provider: "groq", input: 1, output: 1 }), undefined);
});

test("two runs interleaving do not mix their counts", async () => {
  const a = { id: "a" };
  const b = { id: "b" };
  await Promise.all([
    runWithUsage(a, "write", async () => { await new Promise((r) => setTimeout(r, 3)); recordUsage({ provider: "x", input: 10, output: 1 }); }),
    runWithUsage(b, "diff", async () => { recordUsage({ provider: "x", input: 20, output: 2 }); await new Promise((r) => setTimeout(r, 6)); recordUsage({ provider: "x", input: 20, output: 2 }); }),
  ]);
  assert.equal(a.usage.input, 10);
  assert.equal(b.usage.input, 40);
  assert.equal(b.usage.items[0].stage, "diff");
});
