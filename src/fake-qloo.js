// Synthetic Qloo responses for development and for the public repo's sample
// mode. Shapes follow Qloo's documented envelopes; the VALUES are invented and
// deterministic, never real Qloo data. Enable with CULTURE_GAP_MODE=fake.
import { createHash } from "node:crypto";

const hash = (s) => createHash("sha1").update(String(s)).digest();
const rnd = (seed, i = 0) => hash(`${seed}:${i}`)[0] / 255; // 0..1, stable
const idFor = (name) => `fake-${hash(name).toString("hex").slice(0, 12)}`;

const CITIES = {
  India: [
    ["Hyderabad", 17.39, 78.49],
    ["Bengaluru", 12.97, 77.59],
    ["Mumbai", 19.08, 72.88],
    ["Chennai", 13.08, 80.27],
    ["Vijayawada", 16.51, 80.65],
    ["Kadapa", 14.47, 78.82],
    ["Pune", 18.52, 73.86],
    ["Kochi", 9.93, 76.27],
    ["Jaipur", 26.91, 75.79],
    ["Delhi", 28.61, 77.21],
    ["Tiruppur", 11.11, 77.34],
    ["Kolkata", 22.57, 88.36],
  ],
  "United States": [
    ["Los Angeles", 34.05, -118.24],
    ["New York", 40.71, -74.01],
    ["Houston", 29.76, -95.37],
    ["Atlanta", 33.75, -84.39],
    ["Miami", 25.76, -80.19],
    ["Chicago", 41.88, -87.63],
    ["Dallas", 32.78, -96.8],
    ["Seattle", 47.61, -122.33],
  ],
  "United Kingdom": [
    ["London", 51.51, -0.13],
    ["Manchester", 53.48, -2.24],
    ["Birmingham", 52.49, -1.89],
    ["Leicester", 52.64, -1.13],
    ["Glasgow", 55.86, -4.25],
  ],
  Mexico: [
    ["Mexico City", 19.43, -99.13],
    ["Guadalajara", 20.66, -103.35],
    ["Monterrey", 25.69, -100.32],
  ],
  Spain: [
    ["Madrid", 40.42, -3.7],
    ["Barcelona", 41.39, 2.17],
    ["Valencia", 39.47, -0.38],
  ],
};
const BRANDS = ["Sample Brand A", "Sample Brand B", "Sample Brand C", "Sample Brand D", "Sample Brand E", "Sample Brand F", "Sample Brand G", "Sample Brand H", "Sample Brand J", "Sample Brand K"];
const TAGS = ["streetwear", "oversized fit", "retro", "bold colour", "monochrome", "graphic print", "sportswear", "denim", "minimalist", "nostalgic", "maximalist", "youth culture", "hip hop", "k-drama", "pop"];

const envelope = (operation, results, extra = {}) => ({
  schema_version: "1.0-preview.1",
  operation,
  status: results.length ? "ok" : "empty",
  summary: `synthetic ${operation}`,
  results,
  result_count: results.length,
  provenance: { source: "Synthetic sample (not Qloo)", endpoint: "/fake", documentation: "", requests: [] },
  ...extra,
});

export async function fakeTool(name, args) {
  await new Promise((r) => setTimeout(r, 150 + rnd(name + JSON.stringify(args)) * 400));
  switch (name) {
    case "qloo_describe": {
      const n = args.entity;
      return envelope("describe", [{ entity_id: idFor(n), name: n, type: `urn:entity:${args.type ?? "artist"}`, subtype: `urn:entity:${args.type ?? "artist"}`, popularity: 0.9, properties: { short_description: `Synthetic description of ${n} for sample mode.`, release_year: 2021 } }], { interpretation: { entity: { match: "exact" } } });
    }
    case "qloo_entity_tags": {
      const seed = JSON.stringify(args.entities);
      return envelope("entity_tags", TAGS.filter((_, i) => rnd(seed, i) > 0.3).slice(0, args.limit ?? 10).map((t, i) => ({ id: `urn:tag:keyword:qloo:${t.replace(/\s+/g, "_")}`, name: t, type: "urn:tag:keyword:qloo", affinity: 0.5 + rnd(seed, i + 50) / 2 })));
    }
    case "qloo_audience_demographics":
      return envelope("audience_demographics", [{ entity_id: args.entity, query: { age: { "24_and_younger": 0.42, "25_to_29": 0.31, "30_to_34": 0.08, "35_to_44": -0.12, "45_to_54": -0.3, "55_and_older": -0.4 }, gender: { male: -0.05, female: 0.05 } } }]);
    case "qloo_trends": {
      const seed = JSON.stringify(args.entities);
      return { ...envelope("trends", []), series: args.entities.map((id) => ({ entity: { entityId: id }, points: Array.from({ length: 20 }, (_, i) => ({ date: new Date(Date.now() - (20 - i) * 9 * 864e5).toISOString().slice(0, 10), population_percentile: 60 + i * 1.2 + rnd(seed, i) * 8 })) })), result_count: args.entities.length };
    }
    case "qloo_find_tags":
      return envelope("find_tags", ["clothing", "fashion", "streetwear", "footwear"].filter((t) => args.query.includes(t.slice(0, 4))).map((t) => ({ id: `urn:tag:genre:brand:${t}`, name: `${t} brand`, type: "urn:tag:genre:brand" })));
    case "qloo_recommend": {
      const seed = JSON.stringify([args.target_type, args.signals ?? "none", args.signal_location ?? "", args.filter_location ?? ""]);
      if (args.target_type === "brand") {
        const list = BRANDS.map((b, i) => ({ b, r: rnd(seed, i) })).sort((x, y) => y.r - x.r).slice(0, args.limit ?? 10);
        return envelope("recommend", list.map(({ b, r }) => ({ entity_id: idFor(b), name: b, type: "urn:entity:brand", popularity: 0.5 + r / 2, affinity: r })));
      }
      if (args.target_type === "artist") return envelope("recommend", ["Sample Artist One", "Sample Artist Two", "Sample Artist Three"].map((n, i) => ({ entity_id: idFor(n), name: n, type: "urn:entity:artist", popularity: 0.4 + i * 0.1 })));
      if (args.target_type === "place") return envelope("recommend", ["Sample Café", "Sample Record Store", "Sample Rooftop"].map((n) => ({ entity_id: idFor(n), name: n, type: "urn:entity:place", properties: { address: "Sample address" } })));
      return envelope("recommend", []);
    }
    case "qloo_compare_audiences":
      return envelope("compare_audiences", { tags: TAGS.slice(0, 6).map((t) => ({ name: t, id: `urn:tag:keyword:qloo:${t.replace(/\s+/g, "_")}` })), a: [], b: [] });
    case "qloo_where_popular":
      return envelope("where_popular", []);
    default:
      return envelope(name.replace(/^qloo_/, ""), []);
  }
}

export async function fakeInsights(params) {
  await new Promise((r) => setTimeout(r, 200));
  if (params["filter.type"] !== "urn:heatmap") return { results: { entities: [] } };
  const market = params["filter.location.query"];
  const seed = JSON.stringify([params["signal.interests.entities"], market]);
  // A "City, Country" query returns synthetic neighbourhoods around that city.
  const cityMatch = Object.values(CITIES).flat().find(([name]) => market.toLowerCase().startsWith(name.toLowerCase()));
  const cities = market.includes(",") && cityMatch
    ? ["Old Town", "Station Road", "Market Square", "University Area", "Riverside", "New Colony"].map((n, i) => [`${n}`, cityMatch[1] + (i - 2) * 0.03, cityMatch[2] + (i % 3) * 0.03])
    : (CITIES[market] ?? CITIES.India);
  return {
    results: {
      heatmap: cities.map(([name, lat, lon], i) => ({
        location: { latitude: lat, longitude: lon, geohash: `fake${i}`, name },
        query: { affinity: 0.2 + rnd(seed, i) * 0.8, affinity_rank: i + 1, popularity: 0.15 + rnd(market, i) * 0.85 },
      })),
    },
  };
}
