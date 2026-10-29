// Regression tests for the bugs fixed on 29 Oct 2026: ambiguous location text, typed theme tags,
// empty answers cached forever, reruns that blocked the request, and the share-slug scan.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-fixes-cache-${process.pid}`;
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, test } from "node:test";

const { placeLabel, signalLocation, themeTagIdsFor } = await import("../src/engine/common.js");
const { isEmptyAnswer } = await import("../src/qloo.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

test("location labels carry the state, and raw signals use the locality id", () => {
  const mumbai = { id: "341FE4F4-6424-438B-A509-8CE5FD5CE26D", name: "Mumbai", state: "Maharashtra", country: "India", market: "India" };
  assert.equal(placeLabel(mumbai), "Mumbai, Maharashtra, India");
  assert.equal(placeLabel({ name: "Delhi", market: "India" }), "Delhi, India");
  assert.deepEqual(signalLocation(mumbai), { "signal.location": mumbai.id });
  assert.deepEqual(signalLocation("India"), { "signal.location.query": "India" });
  assert.deepEqual(signalLocation({ id: "fake-abc", name: "Pune", market: "India" }), { "signal.location.query": "Pune, India" });
});

test("each entity type gets the theme tag of its own family; a film genre tag never filters artists", () => {
  const candidates = [
    { id: "urn:tag:genre:media:hip_hop", name: "Hip Hop" },
    { id: "urn:tag:genre:music:hip_hop", name: "Hip Hop" },
    { id: "urn:tag:genre:qloo:hip_hop", name: "Hip Hop" },
    { id: "urn:tag:keyword:media:hip_hop", name: "Hip Hop" },
  ];
  const run = { stages: { resolve: { output: { theme: { tags: [candidates[0]], byWord: [{ word: "hip hop", chosen: candidates[0], candidates }] } } } } };
  assert.deepEqual(themeTagIdsFor(run, "artist"), ["urn:tag:genre:music:hip_hop"]);
  assert.deepEqual(themeTagIdsFor(run, "movie"), ["urn:tag:genre:qloo:hip_hop"]);
  // A type with no matching family keeps the word's own pick, except where that pick is known not to work.
  const onlyMedia = { stages: { resolve: { output: { theme: { tags: [candidates[0]], byWord: [{ word: "x", chosen: candidates[0], candidates: [candidates[0]] }] } } } } };
  assert.deepEqual(themeTagIdsFor(onlyMedia, "artist"), []);
  assert.deepEqual(themeTagIdsFor(onlyMedia, "movie"), ["urn:tag:genre:media:hip_hop"]);
  // Older runs without byWord fall back to the theme tags as they were.
  assert.deepEqual(themeTagIdsFor({ stages: { resolve: { output: { theme: { tags: [{ id: "t1" }] } } } } }, "artist"), ["t1"]);
});

test("empty Qloo answers are recognised so they are not cached on disk", () => {
  assert.equal(isEmptyAnswer({ status: "ok", results: [] }), true);
  assert.equal(isEmptyAnswer({ status: "needs_input", results: [] }), true);
  assert.equal(isEmptyAnswer({ results: { entities: [] } }), true);
  assert.equal(isEmptyAnswer({ results: { heatmap: [], tags: [] } }), true);
  assert.equal(isEmptyAnswer({ status: "ok", results: [{ name: "x" }] }), false);
  assert.equal(isEmptyAnswer({ results: { tags: [{ name: "x" }] } }), false);
  assert.equal(isEmptyAnswer({ results: [], series: [{ points: [] }] }), false);
});

test("a rerun answers as soon as it starts, and refuses plainly while the run is working", async () => {
  const { parseInput } = await import("../src/parse.js");
  const { createRun, startRun, regenerate, editAndRerun } = await import("../src/pipeline/runner.js");
  const { SHOWCASES } = await import("../src/presets.js");
  const sc = SHOWCASES.find((s) => s.format === "film");
  const run = await createRun(await parseInput(sc), { showcase: sc.id });
  await startRun(run, 0);
  const t0 = Date.now();
  const job = await editAndRerun(run, "gap", { summary: "edited" });
  assert.ok(Date.now() - t0 < 1000, "edit resolves before the rerun finishes");
  assert.ok(job.done instanceof Promise);
  await assert.rejects(() => regenerate(run), /still working/);
  await job.done;
  assert.equal(run.status, "done");
});

test("a share slug resolves from the index without loading every run", async () => {
  const { findRunBySlug } = await import("../src/pipeline/store.js");
  const dir = join(process.env.CACHE_DIR, "runs");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "r_slugtest.json"), JSON.stringify({ id: "r_slugtest", status: "done", publish: { slug: "a-test-page-abcde", url: "/s/a-test-page-abcde", page: {} }, stages: {}, ledger: [] }));
  const run = await findRunBySlug("a-test-page-abcde");
  assert.equal(run?.id, "r_slugtest");
  assert.equal(await findRunBySlug("no-such-page-zzzzz"), undefined);
});
