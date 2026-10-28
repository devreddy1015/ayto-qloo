// End to end in synthetic mode: every format runs its whole plan with no keys.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-test-cache-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { parseInput } = await import("../src/parse.js");
const { createRun, startRun } = await import("../src/pipeline/runner.js");
const { SHOWCASES } = await import("../src/presets.js");
const { renderSharePage } = await import("../src/pipeline/page.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

for (const showcase of SHOWCASES) {
  test(`showcase ${showcase.id} runs every stage in fake mode`, async () => {
    const input = await parseInput(showcase);
    assert.equal(input.format, showcase.format);
    const run = await createRun(input, { showcase: showcase.id });
    await startRun(run, 0);
    assert.equal(run.status, "done", JSON.stringify(Object.fromEntries(run.plan.map((s) => [s, run.stages[s].error ?? run.stages[s].status]))));
    for (const id of run.plan) assert.equal(run.stages[id].status, "done", id);
    assert.ok(run.ledger.length >= 8);
    assert.equal(run.ledger.filter((c) => c.status === "error").length, 0);
    const gap = run.stages.gap.output;
    assert.ok(gap.lanes.length >= 1, "at least one lane");
    assert.ok(gap.lanes[0].gap > 0);
    const write = run.stages.write.output;
    assert.equal(write.fallback, true); // no model in tests
    assert.equal(write.writer, showcase.format);
    const check = run.stages.check.output;
    assert.equal(check.removed, 0, JSON.stringify(check.items)); // the template only uses evidence names
    assert.match(run.publish.url, /^\/s\/[a-z0-9-]+$/);
    const html = renderSharePage(run);
    assert.match(html, /<!doctype html>/);
    assert.ok(!html.includes("<script"), "share page carries no scripts");
  });
}

test("a city Qloo cannot place stops the run at resolve", async () => {
  const input = await parseInput({ text: "", format: "film", city: "Nowhereville", theme: "crime" });
  const run = await createRun(input, {});
  await startRun(run, 0);
  assert.equal(run.status, "error");
  assert.equal(run.stages.resolve.status, "error");
  assert.match(run.stages.resolve.error, /couldn't place/);
});
