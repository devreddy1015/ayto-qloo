import assert from "node:assert/strict";
import { test } from "node:test";
import { cultureFashionGap, liftPoints } from "../src/analysis.js";

test("liftPoints rewards places that care more than their size predicts", () => {
  const points = [
    { key: "metro", affinity: 0.9, popularity: 0.95 }, // big and hot: lift ~ 0
    { key: "town", affinity: 0.85, popularity: 0.2 }, // small but hot: positive lift
    { key: "quiet", affinity: 0.1, popularity: 0.6 }, // mid-size, cold: negative lift
  ];
  const lifted = liftPoints(points);
  const by = Object.fromEntries(lifted.map((p) => [p.key, p]));
  assert.ok(by.town.lift > by.metro.lift);
  assert.ok(by.quiet.lift < 0);
  assert.equal(by.town.baseline, "popularity");
});

test("gap uses lift, so a big city with proportional fashion heat is in step", () => {
  const culture = [
    { key: "a", affinity: 0.9, popularity: 0.9 },
    { key: "b", affinity: 0.8, popularity: 0.2 },
    { key: "c", affinity: 0.2, popularity: 0.5 },
  ];
  const fashion = [
    { key: "a", affinity: 0.9, popularity: 0.9 },
    { key: "b", affinity: 0.1, popularity: 0.2 },
    { key: "c", affinity: 0.6, popularity: 0.5 },
  ];
  const gap = cultureFashionGap(culture, fashion);
  const by = Object.fromEntries(gap.map((g) => [g.key, g]));
  assert.equal(by.b.signal, "opportunity");
  assert.equal(by.a.signal, "in-step");
  assert.equal(gap[0].key, "b");
});
