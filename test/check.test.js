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
