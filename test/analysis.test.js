import assert from "node:assert/strict";
import { test } from "node:test";
import { brandLift, brandLocalisation, cultureFashionGap, heatPoints, momentum } from "../src/analysis.js";

test("momentum reads a rising series", () => {
  const points = Array.from({ length: 12 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, "0")}`, population_percentile: 40 + i * 4 }));
  const m = momentum(points);
  assert.equal(m.label, "rising");
  assert.equal(m.series.length, 12);
});

test("momentum reads a cooling series and handles rank fields", () => {
  const points = Array.from({ length: 9 }, (_, i) => ({ date: `2026-06-0${i + 1}`, population_rank: 100 + i * 50 }));
  assert.equal(momentum(points).label, "cooling");
});

test("momentum is unknown with too little data", () => {
  assert.equal(momentum([{ date: "2026-01-01", population_percentile: 3 }]).label, "unknown");
});

test("heatPoints normalises Qloo heatmap entries", () => {
  const raw = {
    results: {
      heatmap: [
        { location: { latitude: 19.07, longitude: 72.87, geohash: "te7u" }, query: { affinity: 0.9, popularity: 0.4 } },
        { location: { latitude: 28.6, longitude: 77.2, geohash: "ttnf" }, query: { affinity: 0.3 } },
        { location: {}, query: {} },
      ],
    },
  };
  const pts = heatPoints(raw);
  assert.equal(pts.length, 2);
  assert.deepEqual(pts[0], { key: "te7u", name: undefined, lat: 19.07, lon: 72.87, affinity: 0.9, affinityRank: undefined, popularity: 0.4 });
});

test("cultureFashionGap flags places where culture leads fashion", () => {
  const culture = [
    { key: "a", lat: 1, lon: 1, affinity: 0.9 },
    { key: "b", lat: 2, lon: 2, affinity: 0.5 },
    { key: "c", lat: 3, lon: 3, affinity: 0.1 },
  ];
  const fashion = [
    { key: "a", lat: 1, lon: 1, affinity: 0.1 },
    { key: "b", lat: 2, lon: 2, affinity: 0.5 },
    { key: "c", lat: 3, lon: 3, affinity: 0.9 },
  ];
  const gap = cultureFashionGap(culture, fashion);
  assert.equal(gap[0].key, "a");
  assert.equal(gap[0].signal, "opportunity");
  assert.equal(gap.at(-1).signal, "fashion-ahead");
});

test("cultureFashionGap matches by distance when grids differ", () => {
  const culture = [{ key: "x", lat: 19.07, lon: 72.87, affinity: 1 }, { key: "y", lat: 28.6, lon: 77.2, affinity: 0 }];
  const fashion = [{ key: "z", lat: 19.1, lon: 72.9, affinity: 1 }, { key: "w", lat: 28.61, lon: 77.21, affinity: 0 }];
  const gap = cultureFashionGap(culture, fashion);
  assert.equal(gap.find((g) => g.key === "x").fashion, 1);
});

test("brandLift reads lift inside one response: fans favour a brand beyond its size", () => {
  const wave = [
    { entity_id: "giant", name: "Giant", affinity: 0.93, popularity: 0.999, explainability: { "signal.interests.entities": [{ entity_id: "w1", score: 0.3 }, { entity_id: "w2", score: 0.7 }] } },
    { entity_id: "rider", name: "Rider", affinity: 0.935, popularity: 0.6 },
    { entity_id: "mid", name: "Mid", affinity: 0.92, popularity: 0.8 },
  ];
  const lift = brandLift(wave, { waves: [{ id: "w1", name: "Wave One" }, { id: "w2", name: "Wave Two" }] });
  const by = Object.fromEntries(lift.map((b) => [b.id, b]));
  assert.equal(by.rider.signal, "rides");
  assert.equal(by.rider.waveSpecific, true);
  assert.equal(by.rider.lift, 1);
  assert.equal(by.giant.signal, "giant");
  assert.equal(by.giant.waveSpecific, false);
  assert.equal(by.giant.rank, 1);
  assert.deepEqual(by.giant.pulledBy, { id: "w2", name: "Wave Two", share: 0.7 });
  assert.equal(by.rider.pulledBy, undefined);
  assert.equal(lift[0].id, "rider");
});

test("brandLift without popularity data marks everything in step", () => {
  const lift = brandLift([{ entity_id: "1", name: "A", affinity: 0.9 }, { entity_id: "2", name: "B", affinity: 0.8 }]);
  assert.deepEqual(lift.map((b) => b.signal), ["in-step", "in-step"]);
  assert.equal(lift[0].baseline, "none");
  assert.equal(lift.some((b) => b.waveSpecific), false);
});

test("brandLocalisation reports how many brands survive without the location", () => {
  const local = ["1", "2", "3", "4", "5"].map((entity_id) => ({ entity_id }));
  const global = ["1", "2", "3", "4", "9"].map((entity_id) => ({ entity_id }));
  assert.deepEqual(brandLocalisation(local, global), { total: 5, shared: 4, localised: false });
  assert.equal(brandLocalisation(local, local.slice(0, 2)).localised, true);
  assert.equal(brandLocalisation(local, []).localised, undefined);
});
