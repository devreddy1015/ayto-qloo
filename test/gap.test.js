import assert from "node:assert/strict";
import { test } from "node:test";
import { averageSkew, cleanPlaceName, demandLift, laneGap, threeColumns } from "../src/analysis.js";

const tag = (name, i) => ({ id: `t:${name}`, name, affinity: 0.9 - i * 0.01 });

test("demandLift ranks flavours by how much higher the city ranks them than the country", () => {
  const city = ["Docudrama", "Courtroom", "Heist", "Fiction"].map(tag);
  const country = ["Fiction", "Heist", "Action", "Courtroom"].map(tag);
  const lift = demandLift(city, country, { take: 30 });
  assert.equal(lift[0].name, "Docudrama"); // absent from the country: 31 - 1
  assert.equal(lift[0].lift, 30);
  assert.equal(lift[0].countryRank, undefined);
  const court = lift.find((x) => x.name === "Courtroom");
  assert.equal(court.lift, 2); // country #4, city #2
  const fiction = lift.find((x) => x.name === "Fiction");
  assert.equal(fiction.lift, -3); // country #1, city #4
});

test("laneGap weighs demand by how little recent supply carries the flavour", () => {
  const flavours = [
    { id: "a", name: "A", lift: 20 },
    { id: "b", name: "B", lift: 20 },
    { id: "c", name: "C", lift: 20 },
    { id: "d", name: "D", lift: -4 },
  ];
  const lanes = laneGap(flavours, { a: { count: 0, titles: [] }, b: { count: 5, titles: [] }, c: { count: 12, titles: [] } }, { n: 30 });
  assert.deepEqual(lanes.map((l) => l.name), ["A", "B", "C"]); // D dropped: negative lift
  assert.equal(lanes[0].gap, 0.67); // demand 20/30, fill 0
  assert.equal(lanes[1].fill, 0.5);
  assert.equal(lanes[2].gap, 0); // fill capped at 1
  assert.equal(lanes[0].mode, "demand-and-supply");
});

test("laneGap falls back to demand only when there is no supply read", () => {
  const lanes = laneGap([{ id: "a", name: "A", lift: 15 }], {}, { n: 30 });
  assert.equal(lanes[0].gap, 0.5);
  assert.equal(lanes[0].mode, "demand-only");
  assert.equal(lanes[0].fill, undefined);
});

test("threeColumns flags only-here picks and hidden gems, never sorting by raw affinity", () => {
  const city = [
    { entity_id: "1", name: "Big Everywhere", affinity: 1.0, popularity: 0.99 },
    { entity_id: "2", name: "Local Gem", affinity: 0.98, popularity: 0.2 },
    { entity_id: "3", name: "Local Hit", affinity: 0.97, popularity: 0.9 },
    { entity_id: "4", name: "Also Country", affinity: 0.96, popularity: 0.8 },
  ];
  const country = [{ entity_id: "1" }, { entity_id: "4" }];
  const contrast = [{ entity_id: "1" }, { entity_id: "3" }];
  const rows = threeColumns(city, country, contrast);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by["2"].onlyHere, true);
  assert.equal(by["2"].hiddenGem, true);
  assert.equal(by["3"].notCountry, true);
  assert.equal(by["3"].onlyHere, false); // the contrast city has it too
  assert.equal(by["1"].onlyHere, false);
  assert.equal(rows[0].id, "2");
  assert.equal(by["1"].rank, 1); // Qloo's own rank is kept
});

test("averageSkew averages age and gender across picks", () => {
  const skew = averageSkew([{ query: { age: { "25_to_29": 0.4 }, gender: { male: 0.2, female: -0.2 } } }, { query: { age: { "25_to_29": 0.2 }, gender: { male: 0, female: 0 } } }]);
  assert.equal(skew.age["25_to_29"], 0.3);
  assert.equal(skew.gender.male, 0.1);
  assert.equal(skew.entities, 2);
  assert.equal(averageSkew([]), undefined);
});

test("cleanPlaceName drops junk venue names", () => {
  assert.equal(cleanPlaceName("Kadalas Cafe"), true);
  assert.equal(cleanPlaceName("AMBULANCE MMC ULLIYERI📞75 101 101 06"), false);
  assert.equal(cleanPlaceName("Thinking Of You 💕"), false);
  assert.equal(cleanPlaceName("Aspire Tucson Apartments"), false);
  assert.equal(cleanPlaceName("KL"), false);
  assert.equal(cleanPlaceName("SM Street"), true);
});
