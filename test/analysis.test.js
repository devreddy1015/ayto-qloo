import assert from "node:assert/strict";
import { test } from "node:test";
import { brandLift, cultureFashionGap, heatPoints, momentum } from "../src/analysis.js";

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

test("brandLift marks brands missing from the baseline as wave-specific", () => {
  const wave = [{ entity_id: "1", name: "A" }, { entity_id: "2", name: "B" }];
  const baseline = [{ entity_id: "2", name: "B" }];
  const lift = brandLift(wave, baseline);
  assert.equal(lift[0].waveSpecific, true);
  assert.equal(lift[1].waveSpecific, false);
  assert.equal(lift[1].baselineRank, 1);
});
