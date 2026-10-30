// The run page's three pages: which stage card goes where, and what a URL hash opens. No DOM needed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FORMATS, STAGE_LABELS } from "../src/formats.js";
import { defaultPage, MAKE_BLOCKS, PAGES, pageFromHash, pageOf } from "../public/pages.js";

const QLOO_STAGES = ["resolve", "read", "gap", "look", "audio", "spots", "audience", "travels"];

test("three pages, in order: the brief, the evidence, make it", () => {
  assert.deepEqual(PAGES.map((p) => p.id), ["brief", "evidence", "make"]);
});

test("the written piece and its checks are the brief; every Qloo read is evidence; produce is the studio", () => {
  for (const id of ["write", "check", "diff", "share"]) assert.equal(pageOf(id), "brief", id);
  for (const id of QLOO_STAGES) assert.equal(pageOf(id), "evidence", id);
  assert.equal(pageOf("produce"), "make");
  assert.equal(pageOf("some-new-stage"), "evidence", "a stage this file doesn't know is a read");
});

test("every format's plan puts its writing on the brief and its reads on the evidence page", () => {
  for (const [format, f] of Object.entries(FORMATS)) {
    const by = (page) => f.plan.filter((id) => pageOf(id) === page);
    assert.deepEqual(by("brief").slice(0, 2), ["write", "check"], format);
    assert.ok(by("evidence").includes("resolve") && by("evidence").includes("gap"), format);
    assert.ok(by("evidence").every((id) => QLOO_STAGES.includes(id)), `${format}: ${by("evidence")}`);
    assert.deepEqual(by("make"), format === "fashion" ? ["produce"] : [], format);
  }
  for (const id of Object.keys(STAGE_LABELS)) assert.ok(PAGES.some((p) => p.id === pageOf(id)), id);
});

test("a hash opens a page by its id, or a stage's page by the stage's own anchor", () => {
  assert.deepEqual(pageFromHash("#brief"), { page: "brief" });
  assert.deepEqual(pageFromHash("#evidence"), { page: "evidence" });
  assert.deepEqual(pageFromHash("make"), { page: "make" });
  assert.deepEqual(pageFromHash("#stage-gap"), { page: "evidence", stage: "gap" });
  assert.deepEqual(pageFromHash("#stage-diff"), { page: "brief", stage: "diff" });
  assert.deepEqual(pageFromHash("#stage-produce"), { page: "make", stage: "produce" });
  for (const other of ["", "#", "#how", "#stage-", "#Brief", undefined]) assert.equal(pageFromHash(other), null, String(other));
});

test("with no hash, a run still working opens on the evidence and a finished one on the brief", () => {
  assert.equal(defaultPage("running"), "evidence");
  assert.equal(defaultPage("error"), "evidence");
  assert.equal(defaultPage(null), "evidence");
  assert.equal(defaultPage("done"), "brief");
});

test("the studio takes the write card's on-demand extras by class", () => {
  for (const cls of [".concept-image", ".shot-deck", ".music-tone", ".spoken-pitch", ".sect.garment", ".sect.refs"]) assert.ok(MAKE_BLOCKS.split(", ").includes(cls), cls);
});
