// Tests for what a side-by-side with another Qloo film tool showed (29 Oct 2026): a title that exists as an
// original and a remake resolved to the wrong one, the avoid list contradicted the theme, the film had no
// locations, and the treatment had no beats, characters, camera or palette.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-treatment-cache-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { rankTitleOptions, splitYear, cityLanguages } = await import("../src/engine/resolve.js");
const { avoidFrom } = await import("../src/engine/gap.js");
const { areaOf, shootBase, hotNeighbourhoods } = await import("../src/engine/spots.js");
const { budgetFrom } = await import("../src/parse.js");
const { film } = await import("../src/writers/film.js");
const { checkEvidence } = await import("../src/pipeline/check.js");
const { registerName } = await import("../src/pipeline/evidence.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

// The two entities Qloo returns for "HIT: The First Case" (live, 29 Oct 2026), trimmed.
const HIT_2022 = { entity_id: "B7A5", name: "Hit: The First Case", popularity: 0.892, properties: { release_year: 2022, akas: [{ value: "Hit: The First Case" }], description: "Hit: The First Case (2022) ... is a Hindi-language crime mystery thriller and a remake of a 2020 Telugu film." } };
const HIT_2020 = { entity_id: "144F", name: "HIT", popularity: 0.896, properties: { release_year: 2020, akas: [{ value: "Hit: The First Case" }], description: "HIT (2020) ... is a Telugu-language crime thriller." } };
const HIT_2 = { entity_id: "45F8", name: "HIT: The 2nd Case", popularity: 0.88, properties: { release_year: 2022, description: "A Telugu-language sequel." } };

test("a title shared by an original and its remake resolves to the original in the city's language", () => {
  const hyderabad = { name: "Hyderabad", state: "Telangana", market: "India" };
  const ranked = rankTitleOptions([HIT_2022, HIT_2020, HIT_2], { name: "HIT: The First Case", languages: cityLanguages(hyderabad) });
  assert.deepEqual(ranked.map((o) => o.id), ["144F", "B7A5"], "the sequel does not carry the name and is dropped");
  assert.equal(ranked[0].language, "Telugu");
  assert.equal(ranked[1].remake, true);
  // A year typed by the maker wins over everything else.
  const asked = rankTitleOptions([HIT_2022, HIT_2020], { name: "HIT: The First Case", year: 2022, languages: ["Telugu"] });
  assert.equal(asked[0].id, "B7A5");
  assert.deepEqual(splitYear("HIT: The First Case (2022)"), { name: "HIT: The First Case", year: 2022 });
  assert.deepEqual(splitYear("Sid Sriram"), { name: "Sid Sriram", year: undefined });
  assert.deepEqual(cityLanguages({ name: "Chennai", state: "Tamil Nadu", market: "India" }), ["Tamil"]);
  assert.deepEqual(cityLanguages({ name: "Austin", market: "United States" }), ["English"]);
});

test("the avoid list never contradicts the theme or what the maker asked for", () => {
  const pool = [
    { id: "t:thriller", name: "Thriller" },
    { id: "t:mystery", name: "Mystery" },
    { id: "t:comedy", name: "Comedy" },
    { id: "t:short", name: "Short" },
    { id: "t:musical", name: "Musical" },
    { id: "t:romance", name: "Romance" },
  ];
  const read = { sample: 50 };
  const supply = { "t:thriller": { total: 31 }, "t:mystery": { total: 4 }, "t:comedy": { total: 2 } };
  const siblings = new Set(["mystery"]);
  const said = new Set(["short", "film"]);
  const out = avoidFrom(pool.map((t) => ({ ...t })), { read, supply, siblings, said });
  assert.deepEqual(out.map((t) => t.name), ["Comedy", "Musical", "Romance"]);
  const why = Object.fromEntries(pool.map((t) => ({ ...t })).map((t) => [t.name, t]));
  const pool2 = pool.map((t) => ({ ...t }));
  avoidFrom(pool2, { read, supply, siblings, said });
  assert.match(pool2[0].why, /62% of the themed catalogue/);
  assert.equal(pool2[1].why, "part of the theme");
  assert.equal(pool2[3].why, "you asked for it");
  assert.ok(why);
});

test("venues get their area from the address, and the shoot base is where most of them sit", () => {
  assert.equal(areaOf({ properties: { address: "8-2-293/174, Road No. 14, Banjara Hills Hyderabad, Telangana 500034 India" } }, "Hyderabad"), "Banjara Hills");
  assert.equal(areaOf({ properties: { address: "3rd Floor, The Park Hyderabad 22, Raj Bhavan Rd, Somajiguda Hyderabad, Telangana 500082 India" } }, "Hyderabad"), "Somajiguda");
  assert.equal(areaOf({ properties: { address: "Shahid Bhagat Singh Rd, Colaba, Mumbai, Maharashtra 400005" } }, "Mumbai"), "Colaba");
  assert.equal(areaOf({ properties: { address: "", geocode: { name: "Ward 32 Patthergatti" } } }, "Hyderabad"), "Patthergatti");
  assert.equal(areaOf({ properties: { geocode: { name: "Greater Hyderabad Municipal Corporation Central Zone" } } }, "Hyderabad"), undefined);
  const venues = [{ name: "A", area: "Old Town" }, { name: "B", area: "Hill" }, { name: "C", area: "Old Town" }, { name: "D" }];
  assert.deepEqual(shootBase(venues), { name: "Old Town", venues: 2, of: 4, places: ["A", "C"] });
  assert.equal(shootBase([{ name: "A", area: "X" }, { name: "B", area: "Y" }]), undefined, "one place per area is no base");
});

test("hot neighbourhoods rank the heatmap cells and skip admin zones and empty cells", () => {
  const places = [
    { name: "Ward 104 Kondapur", lat: 17.46, lon: 78.36 },
    { name: "Greater Hyderabad Municipal Corporation West Zone", lat: 17.44, lon: 78.38 },
    { name: "Old City", lat: 17.36, lon: 78.47 },
  ];
  const cells = [
    { key: "a", lat: 17.461, lon: 78.361, affinity: 0.95, popularity: 0.3 },
    { key: "b", lat: 17.361, lon: 78.471, affinity: 0.5, popularity: 0.6 },
    { key: "c", lat: 17.362, lon: 78.472, affinity: 0.9, popularity: 0 },
    { key: "d", lat: 17.2, lon: 78.2, affinity: 0.99, popularity: 0.2 },
  ];
  const hot = hotNeighbourhoods(cells, places);
  assert.equal(hot[0].name, "Kondapur");
  assert.ok(!hot.some((h) => /Zone/.test(h.name)));
});

test("budget words in the sentence set the budget", () => {
  assert.equal(budgetFrom("a short film in Mumbai on a shoestring"), "shoestring");
  assert.equal(budgetFrom("a no-budget crime short"), "shoestring");
  assert.equal(budgetFrom("a big budget feature"), "premium");
  assert.equal(budgetFrom("a short film in Hyderabad"), undefined);
});

test("without a model the film template still carries the base, the locations and Qloo's own style notes", () => {
  const ev = {
    city: "Hyderabad",
    country: "India",
    lanes: [{ flavour: "Folk", city_rank: 14, country_rank: "not in the country's top 30" }],
    look: { style_this_city_leans_to: ["Cinematic (+10)"], style_notes_on_its_own_picks: ["V: Polished, high-contrast cinematography."] },
    what_the_city_favours: { movie: { only_here: ["V", "Deva"] }, person: { only_here: [], also_strong: ["Nani"] } },
    places_detail: [{ name: "Some Gym", area: "Hill" }, { name: "Laad Bazaar", area: "Old City", about: "Historic market near Charminar." }],
    shoot_base: { name: "Old City", venues: 3, of: 8, places: ["Laad Bazaar"] },
  };
  const p = film.fallback(ev);
  assert.equal(p.references[0].borrow, "Qloo: Polished, high-contrast cinematography.");
  assert.equal(p.shoot_base.name, "Old City");
  assert.match(p.shoot_base.why, /3 of the 8/);
  assert.equal(p.locations[0].name, "Laad Bazaar", "the base's places come first");
  assert.equal(p.locations[0].beat, undefined, "no beat numbers without beats");
  assert.equal(p.locations[0].use, "Old City · Qloo: Historic market near Charminar.");
  assert.equal(p.cast_ideas[0].name, "Nani");
});

test("check drops an invented location or reference but keeps the beat it sat in", () => {
  const run = { names: {}, stages: {} };
  for (const [n, k] of [["V", "movie"], ["Laad Bazaar", "place"], ["Old City", "neighbourhood"]]) registerName(run, n, k);
  run.stages.write = {
    output: {
      writer: "film",
      plan: {
        beats: [
          { title: "The complaint", what: "...", after: { title: "V" }, where: { name: "Laad Bazaar" } },
          { title: "Rice at midnight", what: "...", after: { title: "Invented Film" }, where: { name: "Made-up Cafe" } },
        ],
        locations: [{ name: "Laad Bazaar", beat: 1 }, { name: "Made-up Cafe", beat: 2 }],
        shoot_base: { name: "Old City" },
      },
    },
  };
  const result = checkEvidence(run);
  const plan = run.stages.write.output.plan;
  assert.equal(plan.beats.length, 2, "beats survive");
  assert.equal(plan.beats[1].after, undefined);
  assert.equal(plan.beats[1].where, undefined);
  assert.equal(plan.beats[0].after.title, "V");
  assert.deepEqual(plan.locations.map((l) => l.name), ["Laad Bazaar"]);
  assert.equal(plan.shoot_base.name, "Old City");
  assert.equal(result.removed, 3);
});

test("the rule parser reads reference titles and fan phrasings, and keeps a theme with a love", async () => {
  const { heuristicParse, parseInput } = await import("../src/parse.js");
  assert.deepEqual(heuristicParse("A short film in Hyderabad about crime, after HIT: The First Case, on a shoestring").loves, [{ name: "HIT: The First Case" }]);
  assert.equal(heuristicParse("a crime film in Mumbai inspired by Drishyam").city, "Mumbai");
  assert.deepEqual(heuristicParse("A reel in Hyderabad about love, for Sid Sriram fans").loves, [{ name: "Sid Sriram" }]);
  assert.equal(heuristicParse("short film in Chennai after work about friendship").loves.length, 0, "lower-case words after 'after' are not a title");
  const input = await parseInput({ text: "A short film in Hyderabad about crime, after HIT: The First Case, on a shoestring" });
  assert.equal(input.theme.query, "crime");
  assert.equal(input.loves[0].name, "HIT: The First Case");
  assert.equal(input.budget, "shoestring");
});
