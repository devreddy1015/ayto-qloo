import assert from "node:assert/strict";
import { test } from "node:test";
import { snapCellsToPlaces, tagPoints, cultureFashionGap } from "../src/analysis.js";
import { pickLocality, subLocalities, localityName } from "../src/cities.js";

const cell = (lat, lon, affinity, popularity) => ({ key: `${lat},${lon}`, lat, lon, affinity, popularity });

test("snapCellsToPlaces names cells by the nearest Qloo locality and takes the strongest cell around it", () => {
  const cells = [cell(14.48, 78.82, 0.9, 0.3), cell(14.6, 78.9, 0.95, 0.4), cell(17.39, 78.49, 0.5, 0.99), cell(28.6, 77.2, 0.7, 1)];
  const places = [
    { id: "kadapa", name: "Kadapa", lat: 14.47, lon: 78.82 },
    { id: "hyd", name: "Hyderabad", lat: 17.39, lon: 78.49 },
    { id: "sea", name: "Nowhere at sea", lat: 10, lon: 70 },
  ];
  const points = snapCellsToPlaces(cells, places, { radiusKm: 30 });
  assert.deepEqual(points.map((p) => p.name), ["Kadapa", "Hyderabad"]);
  const kadapa = points.find((p) => p.name === "Kadapa");
  assert.equal(kadapa.affinity, 0.95, "takes the max affinity within the radius");
  assert.equal(kadapa.popularity, 0.4);
  assert.equal(kadapa.cells, 2);
  assert.equal(kadapa.key, "kadapa", "keyed by the Qloo locality id so both heatmaps match by key");
});

test("snapped points feed the gap formula unchanged", () => {
  const places = [
    { id: "a", name: "A", lat: 10, lon: 10 },
    { id: "b", name: "B", lat: 20, lon: 20 },
    { id: "c", name: "C", lat: 30, lon: 30 },
  ];
  const culture = snapCellsToPlaces([cell(10, 10, 0.9, 0.2), cell(20, 20, 0.5, 0.5), cell(30, 30, 0.3, 0.9)], places);
  const fashion = snapCellsToPlaces([cell(10, 10, 0.2, 0.2), cell(20, 20, 0.5, 0.5), cell(30, 30, 0.9, 0.9)], places);
  const gap = cultureFashionGap(culture, fashion);
  assert.equal(gap[0].name, "A", "culture hot, fashion cold: the opportunity");
  assert.equal(gap[0].signal, "opportunity");
  assert.equal(gap.at(-1).name, "C");
});

test("tagPoints normalises a raw tag response", () => {
  const raw = { results: { tags: [{ tag_id: "urn:tag:style:qloo:glitzy", name: "Glitzy", subtype: "urn:tag:style:qloo", popularity: 0.9, query: { affinity: 0.8 } }, { name: "" }] } };
  assert.deepEqual(tagPoints(raw), [{ id: "urn:tag:style:qloo:glitzy", name: "Glitzy", type: "urn:tag:style:qloo", affinity: 0.8, popularity: 0.9 }]);
  assert.deepEqual(tagPoints(undefined), []);
});

const hit = (name, chain, level, popularity, extra = {}) => ({
  entity_id: `id-${name}-${chain.join("-")}`,
  name,
  popularity,
  disambiguation: [name, ...chain].join(", "),
  location: { lat: 1, lon: 2 },
  properties: { admin_level: level, ancestors: chain.map((n) => ({ name: n })), ...extra },
});

test("pickLocality prefers the right country, an exact name and a city-sized level", () => {
  const results = [
    hit("London", ["Laurel", "Kentucky", "United States of America"], 8, 0.999),
    hit("Greater London", ["England", "United Kingdom"], 5, 1),
    hit("London", ["Inner London - East", "Greater London", "England", "United Kingdom"], 8, 0.998),
    hit("London Borough of Camden", ["London", "England", "United Kingdom"], 9, 0.99),
  ];
  const best = pickLocality(results, { query: "London", market: "United Kingdom" });
  assert.equal(best.disambiguation, "London, Inner London - East, Greater London, England, United Kingdom");
  assert.equal(pickLocality(results, { query: "London", market: "United States" }).properties.ancestors[1].name, "Kentucky");
});

test("pickLocality prefers Qloo's city-sized variant over the district when the plain name is missing", () => {
  const results = [
    hit("Pune District", ["Maharashtra", "India"], 5, 1),
    hit("Pune Metropolitan Region", ["Pune City", "Pune District", "Maharashtra", "India"], 7, 1),
    hit("Pune City", ["Pune District", "Maharashtra", "India"], 6, 1),
    hit("Vijayawada (Rural)", ["NTR", "Andhra Pradesh", "India"], 6, 0.98),
    hit("Vijayawada (Urban)", ["NTR", "Andhra Pradesh", "India"], 6, 0.99),
  ];
  assert.equal(pickLocality(results, { query: "Pune", market: "India" }).name, "Pune City");
  assert.equal(pickLocality(results, { query: "Vijayawada", market: "India" }).name, "Vijayawada (Urban)");
  assert.equal(pickLocality(results.slice(0, 1), { query: "Pune", market: "India" }).name, "Pune District", "a district is still better than nothing");
  const mangaluru = [hit("Dongerkeri", ["Mangaluru taluk", "Dakshina Kannada", "India"], 10, 1), hit("Mangaluru taluk", ["Dakshina Kannada", "India"], 6, 0.99)];
  assert.equal(pickLocality(mangaluru, { query: "Mangaluru", market: "India" }).name, "Mangaluru taluk", "a name carrying the query beats a stranger inside it");
  assert.equal(pickLocality(mangaluru.slice(0, 1), { query: "Mangaluru", market: "India" }), undefined, "never a locality whose name is unrelated");
});

test("pickLocality gives up when nothing is in the market's country", () => {
  const results = [hit("Austin", ["Travis", "Texas", "United States of America"], 8, 0.999)];
  assert.equal(pickLocality(results, { query: "Austin", market: "India" }), undefined);
  // A locality with no parent chain is accepted only as an exact, popular, city-sized hit.
  assert.equal(pickLocality([{ entity_id: "t", name: "Tokyo", popularity: 0.99, location: { lat: 35, lon: 139 }, properties: { admin_level: 4, ancestors: [] } }], { query: "Tokyo", market: "Japan" })?.name, "Tokyo");
});

test("localityName prefers an English alias", () => {
  assert.equal(localityName({ name: "서울", properties: { akas: [{ language: "ko", value: "서울" }, { language: "en", value: "Seoul" }, { value: "Seoul, South Korea" }] } }), "Seoul");
  assert.equal(localityName({ name: "Kadapa", properties: {} }), "Kadapa");
});

test("subLocalities keeps only Qloo localities whose parent chain names the city", () => {
  const results = [
    hit("Kadapa", ["YSR", "Andhra Pradesh", "India"], 6, 0.99),
    hit("Dongala Cheruvu", ["Kadapa", "YSR", "Andhra Pradesh", "India"], 10, 0.99),
    hit("dongala cheruvu", ["Kadapa", "YSR", "Andhra Pradesh", "India"], 10, 0.93),
    hit("Kadapakkam", ["Ward 16", "Thiruvallur District", "Tamil Nadu", "India"], 10, 0.7),
    hit("Kadapa Road", ["Kadapa", "Sindh", "Pakistan"], 10, 0.9),
  ];
  assert.deepEqual(subLocalities(results, { city: "Kadapa", market: "India" }).map((p) => p.name), ["Dongala Cheruvu"]);
});
