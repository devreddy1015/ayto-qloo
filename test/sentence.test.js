// Reading a sentence the way a maker writes it, and finding the city they mean. Every case here was a wrong
// reading found in review (30 Oct). The locality fixtures are hand-made in Qloo's shape, not Qloo responses.
process.env.CULTURE_GAP_MODE = "fake";
process.env.GROQ_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.CACHE_DIR = `/tmp/ayto-sentence-test-${process.pid}`;
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { after, test } from "node:test";

const { heuristicParse, parseInput } = await import("../src/parse.js");
const { formatFrom } = await import("../src/formats.js");
const { languageFrom } = await import("../src/languages.js");
const { marketFrom } = await import("../src/engine/where.js");
const { splitYear, pickCity } = await import("../src/engine/resolve.js");
const { displayName, pickLocality } = await import("../src/cities.js");

after(() => rm(process.env.CACHE_DIR, { recursive: true, force: true }));

test("the format the maker names beats a word about the subject", () => {
  const cases = {
    "a short film about a bar fight": "film",
    "a film about a restaurant": "film",
    "a documentary about a music festival": "film",
    "a political party satire film": "film",
    "a comic short film": "film",
    "a reel for Telugu cinema fans": "reel",
    "a web series with 6 episodes": "film",
    "a short in Hyderabad": "film",
    "a short story": "book",
    "a horror game": "game",
    "a board game for families": "game",
    "TikToks about street food": "reel",
    "a saree collection": "fashion",
    "a drop of hoodies and tees": "fashion",
    "a pub in Bengaluru": "cafe",
    "a stand-up comedy night": "event",
    "a podcast about films": "podcast",
    "I make YouTube shorts in Pune": "reel",
    "I'm opening a bar": "cafe",
  };
  for (const [text, format] of Object.entries(cases)) assert.equal(formatFrom(text), format, text);
  assert.equal(heuristicParse("a story set in Hyderabad").format, "film", "nothing named: a film");
});

test("the city after 'in', however the sentence is written", () => {
  const cases = {
    "In Hyderabad, I'm making a crime short film": "Hyderabad",
    "A CRIME FILM IN HYDERABAD": "Hyderabad",
    "a reel in São Paulo": "São Paulo",
    "a drop in Montréal": "Montréal",
    "a film in Hyderabad but shot in Vizag": "Hyderabad",
    "a reel shot at night in Hyderabad": "Hyderabad",
    "a film in Telugu in Hyderabad": "Hyderabad",
    "a film in Hyderabad in 2026": "Hyderabad",
    "a reel at Charminar in Hyderabad": "Hyderabad",
    "themed around Diwali in Delhi": "Delhi",
    "a reel in Kansas City": "Kansas City",
    "a film in Mexico City": "Mexico City",
    "a film in Hyderabad city": "Hyderabad",
    "a film in Hyderabad's Old City": "Hyderabad",
    "a drop for the crowd in Mumbai nightlife": "Mumbai",
    "a reel in Miami Beach": "Miami Beach",
    "I'm a filmmaker from Chennai": "Chennai",
  };
  for (const [text, city] of Object.entries(cases)) assert.equal(heuristicParse(text).city, city, text);
});

test("loves and themes read only what was meant", () => {
  assert.deepEqual(heuristicParse("a love story set in Hyderabad").loves, []);
  assert.deepEqual(heuristicParse("I'm getting into filmmaking in Hyderabad").loves, []);
  assert.deepEqual(heuristicParse("a thriller inspired by Drishyam in Hyderabad").loves.map((l) => l.name), ["Drishyam"]);
  assert.deepEqual(heuristicParse("reels for fans of Bad Bunny in Las Vegas").loves.map((l) => l.name), ["Bad Bunny"]);
  assert.equal(heuristicParse("a comedy film in Pune").theme, "comedy");
  assert.equal(heuristicParse("a true crime podcast in Mumbai").theme, "true crime");
  assert.equal(heuristicParse("a street food reel in Delhi").theme, "street food");
  assert.equal(heuristicParse("a film about a bar fight in Goa").theme, "bar fight");
  assert.equal(heuristicParse("an event themed around Diwali in Delhi").theme, "diwali");
});

test("the sentence fills what the request left out, and nothing the maker chose", async () => {
  const filled = await parseInput({ text: "a crime short film inspired by Drishyam", format: "film", city: "Hyderabad" });
  assert.equal(filled.theme.query, "crime");
  assert.deepEqual(filled.loves.map((l) => l.name), ["Drishyam"]);
  const chosen = await parseInput({ text: "a crime short film inspired by Drishyam", format: "film", city: { query: "Hyderabad, India" }, theme: { query: "", ids: [] }, loves: [] });
  assert.equal(chosen.theme.query, "", "none picked for every word stays none");
  assert.deepEqual(chosen.loves, []);
  await assert.rejects(() => parseInput({ text: "a film somewhere in the country" }), /which city/);
});

test("a year is split off only when it is marked; a bare number may be the title's own", () => {
  assert.deepEqual(splitYear("HIT: The First Case (2022)"), { name: "HIT: The First Case", year: 2022 });
  assert.deepEqual(splitYear("Drishyam, 2015"), { name: "Drishyam", year: 2015 });
  assert.deepEqual(splitYear("Blade Runner 2049"), { name: "Blade Runner 2049", year: undefined, bare: { name: "Blade Runner", year: 2049 } });
  assert.deepEqual(splitYear("Sid Sriram"), { name: "Sid Sriram", year: undefined });
});

test("a place or an industry named after 'in' is not a language request; 'us' is not the US", () => {
  assert.equal(languageFrom("a crime film in Chennai, Tamil Nadu"), undefined);
  assert.equal(languageFrom("a reel in Hindi cinema style"), undefined);
  assert.equal(languageFrom("a film in Chennai, in Tamil"), "Tamil");
  assert.equal(marketFrom("Help us pick a city in India for a crime short film"), "India");
  assert.equal(marketFrom("tell us where in the UK to shoot"), "United Kingdom");
  assert.equal(marketFrom("a Latin America reel in Mexico"), "Mexico");
  assert.equal(marketFrom("where in the US should I shoot"), "United States");
});

// Hand-made hits in Qloo's locality shape: a famous city listed in an admin form next to villages with its name.
const hit = (id, name, { level, pop, chain, akas = [] }) => ({ entity_id: id, name, disambiguation: [name, ...chain].join(", "), popularity: pop, location: { lat: 1, lon: 1 }, properties: { admin_level: level, akas: akas.map((value) => ({ value })), ancestors: chain.map((n) => ({ name: n })) } });
const JAIPUR = [
  hit("j1", "Jaipur Municipal Corporation", { level: 8, pop: 0.9996, chain: ["Jaipur District", "Rajasthan", "India"] }),
  hit("j2", "Jaipur District", { level: 5, pop: 0.9996, chain: ["Rajasthan", "India"] }),
  hit("j3", "Jaipur", { level: 10, pop: 0.5, chain: ["Ranchi District", "Jharkhand", "India"] }),
];
const GLASGOW = [
  hit("g1", "Glasgow", { level: 8, pop: 0.968, chain: ["Kentucky", "United States of America"] }),
  hit("g2", "Glasgow City", { level: 6, pop: 0.998, chain: ["Alba / Scotland", "United Kingdom"] }),
];
const PERTH = [
  hit("p1", "Perth", { level: 6, pop: 0.958, chain: ["Ontario", "Canada"] }),
  hit("p2", "Perth and Kinross", { level: 6, pop: 0.993, chain: ["Alba / Scotland", "United Kingdom"], akas: ["Perth ja Kinross"] }),
  hit("p3", "Perth Amboy", { level: 8, pop: 0.973, chain: ["New Jersey", "United States of America"] }),
];
const MUNSTER = [
  hit("m1", "Münster", { level: 6, pop: 0.997, chain: ["Nordrhein-Westfalen", "Deutschland"] }),
  hit("m2", "Munster", { level: 5, pop: 0.999, chain: ["Southern Region", "Ireland"] }),
];

test("a city name finds the city, not a village or a neighbour that shares it", () => {
  assert.equal(pickLocality(JAIPUR, { query: "Jaipur", market: "India" }).entity_id, "j1");
  assert.equal(pickCity(JAIPUR, "Jaipur").entity_id, "j1");
  assert.equal(pickCity(GLASGOW, "Glasgow").entity_id, "g2");
  assert.equal(pickCity(PERTH, "Perth").entity_id, "p1", "neither Perth and Kinross nor Perth Amboy is Perth");
  assert.equal(pickCity(MUNSTER, "Münster").entity_id, "m1", "spelt as typed, accents and all");
  assert.equal(pickCity(MUNSTER, "Munster").entity_id, "m2");
  assert.equal(pickCity(GLASGOW, "LA"), undefined, "a short name never matches inside another");
  assert.equal(pickCity(GLASGOW, "Glasgow", { wantedId: "g1" }).entity_id, "g1", "the maker's pick wins");
  assert.equal(pickCity(GLASGOW, ""), undefined);
});

test("display names drop admin words but keep a city's own 'City'", () => {
  assert.equal(displayName("Jaipur Municipal Corporation"), "Jaipur");
  assert.equal(displayName("Patna Urban Municipal Corporation"), "Patna");
  assert.equal(displayName("Jaipur(Rural) District"), "Jaipur");
  assert.equal(displayName("Pune City"), "Pune");
  assert.equal(displayName("City of Edinburgh"), "Edinburgh");
  assert.equal(displayName("County Borough of Belfast"), "Belfast");
  for (const keep of ["Kansas City", "Quezon City", "Benin City", "Oklahoma City", "Salt Lake City", "Mexico City"]) assert.equal(displayName(keep), keep);
});
