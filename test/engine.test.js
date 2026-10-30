// The engine's maths on the inputs live Qloo can send: a country read that failed, ties, half-filled points,
// skews with gaps, odd venue names and addresses, empty envelopes, and a cached plan two runs share.
process.env.CULTURE_GAP_MODE = "fake";
process.env.CACHE_DIR = `/tmp/ayto-engine-test-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { averageSkew, cleanPlaceName, cultureFashionGap, demandLift, heatPoint, liftPoints, shareLift, threeColumns } = await import("../src/analysis.js");
const { areaOf } = await import("../src/engine/spots.js");
const { isEmptyAnswer, memo } = await import("../src/qloo.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

test("a country read that failed makes no lane, no 'only here' and no opportunity", () => {
  const city = [{ id: "t1", name: "Travel" }, { id: "t2", name: "Political" }];
  assert.deepEqual(demandLift(city, []), []);
  const rows = threeColumns([{ entity_id: "e1", name: "V", query: { affinity: 0.99 }, popularity: 0.9 }], [], []);
  assert.equal(rows[0].onlyHere, false);
  assert.equal(rows[0].notCountry, false);
  const look = shareLift([{ tags: [{ tag_id: "urn:tag:style:qloo:moody", name: "Moody" }] }], []);
  assert.deepEqual(look.over, []);
  const culture = [{ key: "a", lat: 1, lon: 1, affinity: 0.9, popularity: 0.5 }, { key: "b", lat: 2, lon: 2, affinity: 0.1, popularity: 0.5 }];
  assert.deepEqual(cultureFashionGap(culture, []), []);
  // With a baseline, the lift is still read as before.
  assert.equal(demandLift(city, [{ id: "t2", name: "Political" }], { take: 30 })[0].name, "Travel");
});

test("equal values share a percentile; a point with latitude but no longitude doesn't throw", () => {
  const pts = [0, 1, 2, 3, 4].map((i) => ({ key: `k${i}`, affinity: i === 4 ? 0.9 : 0.5, popularity: 0.5 }));
  const lifted = liftPoints(pts);
  const tied = lifted.filter((p) => p.key !== "k4").map((p) => p.affinityPct);
  assert.equal(new Set(tied).size, 1, `ties got ${tied}`);
  assert.equal(new Set(lifted.map((p) => p.popularityPct)).size, 1, "equal popularity, equal percentile");
  assert.doesNotThrow(() => heatPoint({ location: { lat: 17.4 }, query: { affinity: 0.5 } }));
  assert.equal(heatPoint({ location: { lat: 17.4 }, query: { affinity: 0.5 } }).key, undefined);
});

test("a skew averages over the picks that carry each key", () => {
  const skew = averageSkew([{ query: { age: { "25_to_29": 0.4 }, gender: { male: 0.3 } } }, { query: { age: { "25_to_29": 0.2 } } }]);
  assert.equal(skew.gender.male, 0.3);
  assert.equal(skew.age["25_to_29"], 0.3);
});

test("venue names: junk out, short brands and real bars in", () => {
  for (const junk of ["...", "1234", "N/A", "???", "HDFC Bank", "Sunrise Residency"]) assert.equal(cleanPlaceName(junk), false, junk);
  for (const real of ["PVR INOX", "INOX", "IMAX", "Left Bank Bar", "The Residency Club", "Kadalas Cafe", "SM Street"]) assert.equal(cleanPlaceName(real), true, real);
});

test("the area of a venue in a city named after another", () => {
  assert.equal(areaOf({ address: "12 Outer Circle, Connaught Place, New Delhi, Delhi 110001" }, "Delhi"), "Connaught Place");
  assert.equal(areaOf({ address: "Sector 17, Vashi, Navi Mumbai, Mumbai" }, "Mumbai"), "Vashi");
  assert.equal(areaOf({ address: "Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033" }, "Hyderabad"), "Jubilee Hills");
  assert.equal(areaOf({ address: "1600 21st St NW, Dupont Circle, Washington, DC 20009" }, "Washington"), "Dupont Circle");
  assert.equal(areaOf({ address: "1208 Surf Ave, Coney Island, New York, NY 11224" }, "New York"), "Coney Island");
  assert.equal(areaOf({ address: "Plot 4, Circle 12, Hyderabad, Telangana" }, "Hyderabad"), undefined, "a municipal circle is no neighbourhood");
});

test("an envelope with no result list is empty and never cached; trends and real lists are not", () => {
  for (const empty of [{}, { results: {} }, { success: false }, { results: [] }, { status: "needs_input" }]) assert.equal(isEmptyAnswer(empty), true, JSON.stringify(empty));
  for (const full of [{ results: [{ name: "x" }] }, { results: { tags: [{ name: "x" }] } }, { series: [{ points: [] }] }]) assert.equal(isEmptyAnswer(full), false, JSON.stringify(full));
});

test("a memoised plan is each caller's own copy", async () => {
  let calls = 0;
  const make = async () => {
    calls += 1;
    return { references: [{ title: "Invented" }] };
  };
  const a = await memo("llm", "test-plan", { n: 1 }, make);
  a.references.length = 0; // what the check does to a plan with a made-up name
  const b = await memo("llm", "test-plan", { n: 1 }, make);
  assert.equal(calls, 1, "the second caller is served from the cache");
  assert.equal(b.references.length, 1, "and is not handed the first caller's edits");
});

test("a group of people is an audience, never a lane, and a café's lanes are never film genres", async () => {
  const { isNoise, fitsLaneType } = await import("../src/engine/gap.js");
  // Live, 31 Oct: a Hyderabad café came back with "Muslims" (genre:media:muslims) as lane 1 and a menu "tuned to" it.
  assert.equal(isNoise("Muslims", "urn:tag:genre:media:muslims"), true);
  assert.equal(isNoise("Hindus"), true);
  assert.equal(isNoise("Young Professionals", "urn:tag:customer_identity:qloo:young_professionals"), true);
  assert.equal(isNoise("Religion", "urn:tag:genre:media:religion"), false, "a subject stays a lane");
  assert.equal(isNoise("Family Friendly", "urn:tag:ambience:qloo:family_friendly"), false);
  assert.equal(fitsLaneType("urn:tag:genre:media:muslims", "place"), false);
  assert.equal(fitsLaneType("urn:tag:keyword:media:cricket", "brand"), false);
  assert.equal(fitsLaneType("urn:tag:genre:place:restaurant:south_indian", "place"), true);
  assert.equal(fitsLaneType("urn:tag:genre:media:crime", "movie"), true, "films keep their genres");
});
