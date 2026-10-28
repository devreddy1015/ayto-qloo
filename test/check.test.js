import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEvidence } from "../src/pipeline/check.js";

test("checkEvidence removes names the run never saw from Qloo and keeps the rest", () => {
  const run = {
    names: { maestro: { name: "Maestro" }, "devi sri prasad": { name: "Devi Sri Prasad" }, kochi: { name: "Kochi" }, docudrama: { name: "Docudrama" } },
    stages: {
      write: {
        output: {
          writer: "film",
          plan: {
            lane: { flavour: "Docudrama" },
            references: [{ title: "Maestro", take: "pace" }, { title: "Invented Film", take: "" }],
            soundtrack: [{ artist: "Devi Sri Prasad", use: "score" }, { artist: "Made Up", use: "" }],
            travels_next: ["Kochi", "Nowhere"],
          },
        },
      },
    },
  };
  const out = checkEvidence(run);
  assert.equal(out.checked, 7);
  assert.equal(out.grounded, 4);
  assert.equal(out.removed, 3);
  const p = run.stages.write.output.plan;
  assert.deepEqual(p.references.map((r) => r.title), ["Maestro"]);
  assert.deepEqual(p.soundtrack.map((r) => r.artist), ["Devi Sri Prasad"]);
  assert.deepEqual(p.travels_next, ["Kochi"]);
  assert.equal(p.lane.flavour, "Docudrama");
});

test("check rewrites once with the invented names banned when a model is available", async () => {
  process.env.GROQ_API_KEY = "";
  const { check } = await import("../src/pipeline/check.js");
  // Without a model the check must not attempt a rewrite and must report the first pass only.
  const run = {
    id: "r_x",
    input: { format: "film" },
    names: { maestro: { name: "Maestro" } },
    stages: { write: { output: { writer: "film", canWrite: false, fallback: false, plan: { references: [{ title: "Maestro" }, { title: "Invented" }] } } } },
  };
  const out = await check(run);
  assert.equal(out.removed, 1);
  assert.equal(out.rewrote, undefined);
  assert.deepEqual(run.stages.write.output.plan.references.map((r) => r.title), ["Maestro"]);
});

test("check blanks a print motif that names a real brand and drops unknown garments", async () => {
  const { checkEvidence } = await import("../src/pipeline/check.js");
  const run = {
    names: { diesel: { name: "Diesel", kind: "brand" }, ink: { name: "Ink", kind: "tag" } },
    stages: { write: { output: { writer: "fashion", plan: { styles: [{ name: "Tee 01", garment: "cape", print: { type: "typographic", motif: "Diesel forever" }, from_tags: ["Ink"] }], brands_to_study: ["Diesel"], first_cities: [], palette: [] } } } },
  };
  const out = checkEvidence(run);
  const style = run.stages.write.output.plan.styles[0];
  assert.equal(style.print.motif, "");
  assert.equal(style.garment, undefined);
  assert.equal(out.items.some((i) => i.kind === "motif"), true);
  assert.deepEqual(run.stages.write.output.plan.brands_to_study, ["Diesel"]); // still allowed as a reference
});
