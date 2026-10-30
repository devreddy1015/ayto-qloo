// Every format runs its whole plan in synthetic mode.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-formats-cache-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { parseInput } = await import("../src/parse.js");
const { createRun, startRun } = await import("../src/pipeline/runner.js");
const { FORMATS } = await import("../src/formats.js");
const { renderSharePage } = await import("../src/pipeline/page.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

const INPUT = {
  podcast: { text: "I want to start a true crime podcast in Hyderabad", city: "Hyderabad, India", theme: "crime" },
  game: { text: "an indie mystery game in Pune", city: "Pune, India", theme: "mystery" },
  cafe: { text: "a late-night café in Kochi", city: "Kochi, India", theme: "coffee" },
  event: { text: "a hip hop night in Mumbai", city: "Mumbai, India", theme: "hip hop" },
  book: { text: "a heist novel in Chennai", city: "Chennai, India", theme: "heist" },
};

for (const [format, body] of Object.entries(INPUT)) {
  test(`${format} runs every stage in fake mode and grounds its names`, async () => {
    const input = await parseInput({ ...body, format });
    assert.equal(input.format, format);
    const run = await createRun(input, {});
    await startRun(run, 0);
    assert.equal(run.status, "done", JSON.stringify(Object.fromEntries(run.plan.map((s) => [s, run.stages[s].error ?? run.stages[s].status]))));
    assert.deepEqual(run.plan, FORMATS[format].plan);
    assert.equal(run.stages.write.output.writer, format);
    assert.equal(run.stages.check.output.removed, 0, JSON.stringify(run.stages.check.output.items));
    assert.match(renderSharePage(run), /<!doctype html>/);
  });
}

test("format hints pick the new formats from a sentence", async () => {
  const { heuristicParse } = await import("../src/parse.js");
  assert.equal(heuristicParse("I want to start a podcast in Hyderabad").format, "podcast");
  assert.equal(heuristicParse("we are a small studio making a mobile game in Pune").format, "game");
  assert.equal(heuristicParse("opening a café in Kochi").format, "cafe");
  assert.equal(heuristicParse("running a club night in Mumbai").format, "event");
  assert.equal(heuristicParse("writing a web novel set in Chennai").format, "book");
});

test("recomputing the produce stage with new assumptions changes the numbers and nothing before it", async () => {
  const { rerunFrom } = await import("../src/pipeline/runner.js");
  // The costing is India's, so this drop is Tiruppur's (the Paris showcase gets no rupee costing).
  const sc = { text: "I run a small kidswear unit in Tiruppur. KPop Demon Hunters is everywhere.", format: "fashion", city: { query: "Tiruppur, India" }, theme: { query: "" }, loves: [{ name: "KPop Demon Hunters", type: "movie" }] };
  const run = await createRun(await parseInput(sc), {});
  await startRun(run, 0);
  const before = run.stages.produce.output;
  const writeBefore = run.stages.write.output.plan;
  const job = await rerunFrom(run, "produce", { assumptions: { moqPerStylePerColour: 50, heroQuantity: 100, otherQuantity: 60, tier: "premium", unitCost: { fabric: 200 } } });
  await job.done;
  const after = run.stages.produce.output;
  assert.equal(run.status, "done");
  assert.notEqual(after.totalUnits, before.totalUnits);
  assert.ok(after.economics.mrp > before.economics.mrp);
  assert.equal(after.assumptions.unitCost.cmt, before.assumptions.unitCost.cmt); // untouched costs keep their defaults
  assert.deepEqual(run.stages.write.output.plan, writeBefore); // the writing did not move
});
