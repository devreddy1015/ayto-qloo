// The brief page's main results: every showcase gives an idea, a gap, a traced score and with vs without Qloo, and a
// live run shows only what has finished. highlightData() is plain data, so no DOM is needed.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-highlights-cache-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { parseInput } = await import("../src/parse.js");
const { createRun, startRun } = await import("../src/pipeline/runner.js");
const { SHOWCASES } = await import("../src/presets.js");
const { highlightData, clip } = await import("../public/highlights.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

for (const showcase of SHOWCASES) {
  test(`${showcase.id}: the main results come from the run's own stages`, async () => {
    const run = await createRun(await parseInput(showcase), { showcase: showcase.id });
    await startRun(run, 0);
    const d = highlightData(run);
    assert.ok(d.done);
    assert.equal(d.where.city, run.stages.resolve.output.city.name);
    assert.ok(d.idea.title, "a title");
    assert.match(d.idea.kicker, new RegExp(`for ${d.where.city}$`));
    // The template writer (no model in tests) leaves the logline and hook empty; the drop keeps its positioning.
    assert.ok(d.idea.line.length <= 241, d.idea.line);
    if (showcase.format === "fashion") assert.ok(d.idea.line.length > 0);
    const lanes = run.stages.gap.output.lanes;
    assert.deepEqual(d.gap.lanes.map((l) => l.name), lanes.slice(0, 3).map((l) => l.name));
    for (const l of d.gap.lanes) assert.ok(l.countryRank === null || (l.countryRank > l.cityRank && l.countryRank <= 30), JSON.stringify(l));
    const check = run.stages.check.output;
    assert.deepEqual(d.traced, { grounded: check.grounded, checked: check.checked });
    assert.deepEqual(d.versus, { with: run.stages.diff.output.benchmark.withQloo, without: run.stages.diff.output.benchmark.withoutQloo });
    assert.ok(d.facts.length >= 2, JSON.stringify(d.facts));
    for (const f of d.facts) assert.ok(run.plan.includes(f.stage), `${f.label} opens ${f.stage}`);
  });
}

test("a live run shows what has finished and nothing that's working or stale", () => {
  const run = {
    status: "running",
    input: { format: "film" },
    stages: {
      resolve: { status: "done", output: { city: { name: "London", country: "United Kingdom" } } },
      gap: { status: "done", output: { controls: ["Glasgow", "Liverpool", "Leeds"], lanes: [{ name: "Autobiographical", cityRank: 14, lift: 17, supplyRead: true, supplyCount: 0 }, { name: "Tragedy", cityRank: 15, lift: 8 }] } },
      write: { status: "running" },
      check: { status: "stale", output: { grounded: 30, checked: 30 } },
    },
  };
  const d = highlightData(run);
  assert.equal(d.done, false);
  assert.equal(d.idea, null);
  assert.equal(d.traced, null, "a stale check is not a result");
  assert.deepEqual(d.gap.lanes, [
    { name: "Autobiographical", cityRank: 14, countryRank: null, recent: 0 },
    { name: "Tragedy", cityRank: 15, countryRank: 23, recent: null },
  ]);
  assert.equal(highlightData({ status: "running", stages: { resolve: run.stages.resolve } }), null, "nothing to show before the gap");
});

test("long lines are cut at a clause, or else at a word", () => {
  assert.equal(clip("short"), "short");
  const cut = clip("word ".repeat(80));
  assert.ok(cut.length <= 241 && cut.endsWith("word…"), cut);
  const drop = "A small drop of leather, wool and silk pieces in neutral tones with minimalist silhouettes, made for the Paris crowd whose taste leans intellectual, experimental and avant-garde; the read describes the taste of an audience that leans 30 to 44, evenly split by gender.";
  assert.equal(clip(drop), "A small drop of leather, wool and silk pieces in neutral tones with minimalist silhouettes, made for the Paris crowd whose taste leans intellectual, experimental and avant-garde.");
});

test("country names read plainly", async () => {
  const { countryName } = await import("../public/highlights.js");
  assert.equal(countryName("United Kingdom"), "the UK");
  assert.equal(countryName("United States of America"), "the US");
  assert.equal(countryName("France (terres)"), "France");
  assert.equal(countryName("India"), "India");
});
