// "Where should I make it?": one theme across a market's cities, each against the country and the others.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-where-cache-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { peerLift, marketFrom, whereToMake } = await import("../src/engine/where.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

test("a lane counts for one city only when few of the others share it", () => {
  const flavour = { id: "t", name: "Tragedy", lift: 28, countryRank: undefined };
  // Three of eight other cities also lift Tragedy by ~28: against the median it looked like this city's own lane.
  const shared = [28, 27, 29, 0, 0, 0, 0, 0].map((l) => new Map([["t", l]]));
  assert.ok(peerLift(flavour, shared) <= 1, "shared by three others: not this city's lane");
  // Only one other city lifts it: still this city's lane.
  const rare = [22, 0, 0, 0, 0, 0, 0, 0].map((l) => new Map([["t", l]]));
  assert.equal(peerLift(flavour, rare), 28);
  // A city that doesn't list the flavour counts as no lift when the country lacks it too.
  assert.equal(peerLift(flavour, [new Map(), new Map()]), 28);
  assert.equal(peerLift(flavour, []), undefined);
});

test("the market comes from the sentence", () => {
  assert.equal(marketFrom("a crime short film in India"), "India");
  assert.equal(marketFrom("a horror short for the US"), "United States");
  assert.equal(marketFrom("a reel about nightlife in Brazil"), "Brazil");
  assert.equal(marketFrom("a crime short film in Hyderabad"), undefined);
});

test("in sample mode the cities come back ranked, each with its own lanes and the receipts", async () => {
  const out = await whereToMake({ format: "film", theme: "crime", market: "India" });
  assert.equal(out.market, "India");
  assert.ok(out.cities.length >= 5);
  const strengths = out.cities.map((c) => c.lanes[0]?.strength ?? -99);
  assert.deepEqual(strengths, [...strengths].sort((a, b) => b - a), "ranked by the widest open lane");
  for (const c of out.cities) {
    assert.ok(c.lat !== undefined && c.lon !== undefined, `${c.name} has coordinates for the map`);
    for (const l of c.lanes) assert.ok(l.strength >= 3 && l.strength <= l.lift);
  }
  assert.ok(out.ledger.length >= out.cities.length + 1, "one receipt per city read, plus the country");
  assert.match(out.summary, /widest open lane|No city stands out/);
  await assert.rejects(() => whereToMake({ format: "film", theme: "crime", market: "Atlantis" }), /city list/);
});
