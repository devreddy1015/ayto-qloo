// Synthetic Qloo responses for development and for the public repo's sample
// mode. Shapes follow Qloo's envelopes; the VALUES are invented and
// deterministic, never real Qloo data. Enable with CULTURE_GAP_MODE=fake.
import { createHash } from "node:crypto";

const hash = (s) => createHash("sha1").update(String(s)).digest();
const rnd = (seed, i = 0) => hash(`${seed}:${i}`)[0] / 255; // 0..1, stable
const idFor = (name) => `fake-${hash(name).toString("hex").slice(0, 12)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CITIES = {
  India: [["Hyderabad", 17.39, 78.49], ["Mumbai", 19.08, 72.88], ["Bengaluru", 12.97, 77.59], ["Chennai", 13.08, 80.27], ["Vijayawada", 16.51, 80.65], ["Kochi", 9.93, 76.27], ["Pune", 18.52, 73.86], ["Jaipur", 26.91, 75.79], ["Delhi", 28.61, 77.21], ["Tiruppur", 11.11, 77.34], ["Kolkata", 22.57, 88.36], ["Mysuru", 12.3, 76.65], ["Tirupati", 13.63, 79.42]],
  "United States": [["Las Vegas", 36.17, -115.14], ["New York", 40.71, -74.01], ["Los Angeles", 34.05, -118.24], ["Houston", 29.76, -95.37], ["Atlanta", 33.75, -84.39], ["Miami", 25.76, -80.19], ["Chicago", 41.88, -87.63], ["Phoenix", 33.45, -112.07], ["Tucson", 32.22, -110.97], ["San Diego", 32.72, -117.16]],
  "United Kingdom": [["London", 51.51, -0.13], ["Manchester", 53.48, -2.24], ["Birmingham", 52.49, -1.89], ["Glasgow", 55.86, -4.25]],
  Mexico: [["Ciudad de México", 19.43, -99.13], ["Guadalajara", 20.66, -103.35], ["Monterrey", 25.69, -100.32]],
  Spain: [["Madrid", 40.42, -3.7], ["Barcelona", 41.39, 2.17], ["Valencia", 39.47, -0.38]],
};
const COUNTRY_NAME = { "United States": "United States of America" };

// Synthetic catalogues per entity type. Names are clearly invented.
const POOL = {
  movie: ["Sample Film: The Ledger", "Sample Film: Night Market", "Sample Film: Courtroom Nine", "Sample Film: Saltwater", "Sample Film: Paper Tiger", "Sample Film: The Long Road", "Sample Film: Ironwork", "Sample Film: Quiet Hours", "Sample Film: Blue Signal", "Sample Film: Mango Season", "Sample Film: The Witness", "Sample Film: Gravel", "Sample Film: Monsoon Case", "Sample Film: First Light", "Sample Film: Two Rivers", "Sample Film: Kite Lines", "Sample Film: Late Shift", "Sample Film: The Archive", "Sample Film: Dust Road", "Sample Film: Tin Roof", "Sample Film: Harbour", "Sample Film: Clockwork", "Sample Film: Old Fort", "Sample Film: Glass City"],
  tv_show: ["Sample Series: Precinct", "Sample Series: The Docket", "Sample Series: Night Owls", "Sample Series: Field Notes", "Sample Series: Second City", "Sample Series: Low Tide", "Sample Series: The Verdict Room", "Sample Series: Static", "Sample Series: Union Street", "Sample Series: Afterhours", "Sample Series: The Bureau", "Sample Series: Cold Case Lane", "Sample Series: Riverbend", "Sample Series: The Lookout", "Sample Series: Open Mic", "Sample Series: Switchboard", "Sample Series: High Beam", "Sample Series: Ward Nine", "Sample Series: Dockyard", "Sample Series: Skyline"],
  artist: ["Sample Artist Aru", "Sample Artist Bela", "Sample Artist Cass", "Sample Artist Dev", "Sample Artist Esha", "Sample Artist Faro", "Sample Artist Gia", "Sample Artist Hale", "Sample Artist Ivo", "Sample Artist Juno", "Sample Artist Kai", "Sample Artist Lior", "Sample Artist Mira", "Sample Artist Nael", "Sample Artist Ona", "Sample Artist Pim", "Sample Artist Quin", "Sample Artist Rue", "Sample Artist Sol", "Sample Artist Tia"],
  place: ["Sample Café Corner", "Sample Record Store", "Sample Rooftop", "Sample Night Market", "Sample Bowling Lanes", "Sample Karaoke Room", "Sample Old Fort Steps", "Sample Riverside Walk", "Sample Tea House", "Sample Vinyl Bar", "Sample Skate Park", "Sample Book Café"],
  podcast: ["Sample Podcast: Late Desk", "Sample Podcast: The Docket", "Sample Podcast: Night Bus", "Sample Podcast: Second City Stories", "Sample Podcast: Open File", "Sample Podcast: Harbour Talk", "Sample Podcast: The Verdict Room", "Sample Podcast: Static Hour", "Sample Podcast: Union Street", "Sample Podcast: Afterhours", "Sample Podcast: The Bureau", "Sample Podcast: Cold Case Lane", "Sample Podcast: Riverbend", "Sample Podcast: Lookout", "Sample Podcast: Switchboard", "Sample Podcast: High Beam", "Sample Podcast: Dockyard", "Sample Podcast: Skyline", "Sample Podcast: Field Notes", "Sample Podcast: Low Tide"],
  videogame: ["Sample Game: Ledger", "Sample Game: Night Market", "Sample Game: Courtroom Nine", "Sample Game: Saltwater", "Sample Game: Paper Tiger", "Sample Game: Long Road", "Sample Game: Ironwork", "Sample Game: Quiet Hours", "Sample Game: Blue Signal", "Sample Game: Mango Season", "Sample Game: Witness", "Sample Game: Gravel", "Sample Game: Monsoon Case", "Sample Game: First Light", "Sample Game: Two Rivers", "Sample Game: Kite Lines", "Sample Game: Late Shift", "Sample Game: Archive", "Sample Game: Dust Road", "Sample Game: Tin Roof"],
  book: ["Sample Novel: The Ledger", "Sample Novel: Night Market", "Sample Novel: Courtroom Nine", "Sample Novel: Saltwater", "Sample Novel: Paper Tiger", "Sample Novel: The Long Road", "Sample Novel: Ironwork", "Sample Novel: Quiet Hours", "Sample Novel: Blue Signal", "Sample Novel: Mango Season", "Sample Novel: The Witness", "Sample Novel: Gravel", "Sample Novel: Monsoon Case", "Sample Novel: First Light", "Sample Novel: Two Rivers", "Sample Novel: Kite Lines", "Sample Novel: Late Shift", "Sample Novel: The Archive", "Sample Novel: Dust Road", "Sample Novel: Tin Roof"],
  person: ["Sample Host Aru", "Sample Host Bela", "Sample Host Cass", "Sample Host Dev", "Sample Host Esha", "Sample Host Faro", "Sample Host Gia", "Sample Host Hale", "Sample Host Ivo", "Sample Host Juno", "Sample Host Kai", "Sample Host Lior", "Sample Host Mira", "Sample Host Nael", "Sample Host Ona", "Sample Host Pim"],
  brand: ["Sample Brand A", "Sample Brand B", "Sample Brand C", "Sample Brand D", "Sample Brand E", "Sample Brand F", "Sample Brand G", "Sample Brand H", "Sample Brand J", "Sample Brand K", "Sample Brand L", "Sample Brand M"],
};
const FLAVOURS_BY_DOMAIN = {
  screen: ["Suspense", "Docudrama", "Courtroom", "Biographical", "Revenge and Justice", "Social Issues", "Heist", "Survival", "Mythology", "Investigative Journalism", "Dark Comedy", "Folk", "Travel", "Martial Arts", "Romance", "Thriller", "Mystery", "Action", "Family", "Coming of Age", "Period Piece", "Road Movie", "Police Procedural", "Political", "Satire"],
  music: ["Live Music", "Karaoke", "Late Night", "Hip Hop", "Indie Pop", "Folk", "Electronic", "Soundtrack", "Devotional", "Fusion", "Rap", "Lo-fi", "Classical Crossover", "Dance", "Nightlife", "Street Food", "Rooftop", "Open Mic", "Vinyl", "Festival"],
  wear: ["Casual Wear", "Streetwear", "Graphic Print", "Oversized Fit", "Bold Colour", "Retro", "Sportswear", "Denim", "Minimalist", "Youth Culture", "Athleisure", "Workwear", "Monochrome", "Nostalgic", "Maximalist", "Kidswear", "Pastel", "Utility", "Hand Loom", "Collegiate"],
};
const FLAVOURS = [...FLAVOURS_BY_DOMAIN.screen, ...FLAVOURS_BY_DOMAIN.music, ...FLAVOURS_BY_DOMAIN.wear];
const domainFor = (parentType) => (/brand/.test(parentType ?? "") ? "wear" : /artist|place/.test(parentType ?? "") ? "music" : "screen");
const STYLE_TAGS = ["Atmospheric", "Kinetic", "Slow Burn", "Ensemble", "Star Driven", "Procedural", "Grounded"];

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

/** A deterministic ranked list for a (type, location, filter) combination; the location shifts the order so cities differ. */
function ranked(type, seed, n = 20) {
  const pool = POOL[type] ?? POOL.movie;
  return pool
    .map((name, i) => ({ name, r: rnd(`${type}|${seed}`, i), pop: 0.15 + rnd(`pop|${type}|${name}`) * 0.85 }))
    .filter((x) => x.r > 0.35)
    .sort((a, b) => b.r - a.r)
    .slice(0, n)
    .map(({ name, r, pop }, i) => ({ entity_id: idFor(`${type}:${name}`), name, type: `urn:entity:${type}`, subtype: `urn:entity:${type}`, popularity: Math.round(pop * 100) / 100, affinity: Math.round((0.99 - i * 0.004) * 1000) / 1000, properties: { release_year: 2019 + (hash(name)[1] % 7), image: undefined, style_description: type === "movie" || type === "tv_show" ? `Synthetic style note for ${name}: moody, kinetic, high-contrast.` : undefined }, tags: type === "brand" ? brandTagsFor(name) : tagsFor(name) }));
}
const FAMILIES = {
  material: ["Cotton", "Silk", "Organza", "Velvet", "Linen", "Denim", "Fleece", "Chiffon"],
  target_age_group: ["Teens", "Young Adults", "Adults", "Middle-Aged", "Seniors"],
  aesthetic_property: ["Intricate Embroidery", "Minimalist", "Traditional Motifs", "Rich Color Palettes", "Clean Lines", "Contemporary Silhouettes", "Bold Graphics", "Vintage"],
  personal_style: ["Sophisticated", "Elegant", "Casual", "Classic", "Bohemian", "Glamorous", "Sporty", "Streetwear"],
  fashion_segment: ["Ready-to-Wear", "Luxury", "Casual Wear", "Heritage", "Ethnic Wear", "Contemporary", "Kidswear"],
};
const slug = (t) => t.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
const tagsFor = (name) => [
  ...FLAVOURS_BY_DOMAIN.screen.filter((_, i) => rnd(`tag|${name}`, i) > 0.72).map((t) => ({ tag_id: `urn:tag:genre:qloo:${slug(t)}`, name: t })),
  ...STYLE_TAGS.filter((_, i) => rnd(`style|${name}`, i) > 0.6).map((t) => ({ tag_id: `urn:tag:style:qloo:${slug(t)}`, name: t })),
];
const brandTagsFor = (name) => Object.entries(FAMILIES).flatMap(([family, list]) => list.filter((_, i) => rnd(`${family}|${name}`, i) > 0.55).map((t) => ({ tag_id: `urn:tag:${family}:qloo:${slug(t)}`, name: t })));

export async function fakeTool(name, args) {
  await wait(120 + rnd(name + JSON.stringify(args)) * 300);
  switch (name) {
    case "qloo_describe": {
      const n = args.entity;
      const type = args.type ?? "movie";
      return envelope("describe", [{ entity_id: idFor(`${type}:${n}`), name: n, type: `urn:entity:${type}`, subtype: `urn:entity:${type}`, popularity: 0.9, properties: { short_description: `Synthetic description of ${n} for sample mode.`, release_year: 2024 } }], { interpretation: { entity: { match: "exact" } } });
    }
    case "qloo_find_tags": {
      const q = String(args.query ?? "").toLowerCase();
      const hits = [
        ...FLAVOURS.filter((t) => t.toLowerCase().includes(q.split(" ")[0])).map((t) => ({ id: `urn:tag:genre:qloo:${t.toLowerCase().replace(/[^a-z]+/g, "_")}`, name: t, type: "urn:tag:genre:qloo", popularity: 0.9 })),
        ...["clothing brand", "fashion", "streetwear", "footwear"].filter((t) => q.includes(t.split(" ")[0])).map((t) => ({ id: `urn:tag:genre:brand:${t.replace(/\s+/g, "_")}`, name: `${t} brand`, type: "urn:tag:genre:brand", popularity: 0.8 })),
      ];
      if (!hits.length) hits.push({ id: `urn:tag:genre:qloo:${q.replace(/[^a-z]+/g, "_")}`, name: q.replace(/\b\w/g, (c) => c.toUpperCase()), type: "urn:tag:genre:qloo", popularity: 0.7 });
      return envelope("find_tags", hits.slice(0, args.limit ?? 10));
    }
    case "qloo_recommend": {
      const seed = JSON.stringify([args.signal_location ?? args.filter_location ?? "", (args.include_tags ?? []).join("|"), (args.signals ?? []).join("|")]);
      const city = String(args.filter_location ?? args.signal_location ?? "").split(",")[0].trim() || "Sample City";
      const AREAS = ["Sample Old Town", "Sample Riverside", "Sample Old Town", "Sample Hill"];
      return envelope("recommend", ranked(args.target_type, seed, args.limit ?? 15).map(({ tags, ...r }, i) => (args.target_type === "place" ? { ...r, properties: { ...r.properties, address: `${10 + i} Sample Road, ${AREAS[i % AREAS.length]} ${city}, Sample State`, short_description: `Synthetic place for sample mode (${r.name}).`, price_level: 1 + (i % 4) } } : r)));
    }
    case "qloo_audience_demographics":
      return envelope("audience_demographics", [{ entity_id: args.entity, query: { age: { "24_and_younger": 0.12, "25_to_29": 0.41, "30_to_34": 0.33, "35_to_44": -0.2, "45_to_54": -0.4, "55_and_older": -0.5 }, gender: { male: 0.18, female: -0.18 } } }]);
    case "qloo_trends":
      return { ...envelope("trends", []), series: (args.entities ?? []).map((id) => ({ entity: { entityId: id }, points: [] })), result_count: 0 };
    case "qloo_entity_tags":
      return envelope("entity_tags", FLAVOURS.slice(0, args.limit ?? 10).map((t) => ({ id: `urn:tag:genre:qloo:${t.toLowerCase().replace(/[^a-z]+/g, "_")}`, name: t, type: "urn:tag:genre:qloo" })));
    case "qloo_compare_audiences":
      return envelope("compare_audiences", { tags: FLAVOURS.slice(0, 6).map((t) => ({ name: t })), a: [], b: [] });
    case "qloo_capabilities":
      return { adapter: { canonical_workflow_execution: true } };
    default:
      return envelope(name.replace(/^qloo_/, ""), []);
  }
}

/** Synthetic locality search: the sample cities, with their country as the parent. */
export async function fakeSearch({ query, type, take = 10 }) {
  await wait(80);
  // Titles and names: one synthetic entity with the same id the describe tool gives it.
  if (type && type !== "locality") return { results: [{ entity_id: idFor(`${type}:${query}`), name: query, types: [`urn:entity:${type}`], popularity: 0.9, properties: { release_year: 2024, description: `Synthetic description of ${query} for sample mode.` } }] };
  const needle = String(query).toLowerCase().split(",")[0].trim();
  const results = Object.entries(CITIES).flatMap(([market, list]) =>
    list
      .filter(([name]) => name.toLowerCase().includes(needle))
      .map(([name, lat, lon]) => ({
        name,
        entity_id: idFor(`locality:${name}`),
        types: ["urn:entity:locality"],
        popularity: 0.9,
        disambiguation: `${name}, ${COUNTRY_NAME[market] ?? market}`,
        location: { lat, lon },
        properties: { admin_level: 8, ancestors: [{ admin_level: 2, name: COUNTRY_NAME[market] ?? market, place: "country" }] },
      })),
  );
  return { results: results.slice(0, take) };
}

export async function fakeInsights(params) {
  await wait(150);
  const where = String(params["filter.location.query"] ?? params["signal.location.query"] ?? "");
  if (params["filter.type"] === "urn:tag") {
    // Flavour tags: the order depends on the location, so a city and its country differ. A typed read
    // (filter.tag.types) draws from that family instead of the flavour vocabulary.
    const seed = JSON.stringify([where, params["signal.interests.tags"], params["signal.interests.entities"], params["filter.parents.types"], params["filter.tag.types"]]);
    const typed = String(params["filter.tag.types"] ?? "").match(/^urn:tag:([a-z_]+):qloo$/)?.[1];
    const vocab = typed && FAMILIES[typed] ? FAMILIES[typed] : FLAVOURS_BY_DOMAIN[domainFor(params["filter.parents.types"])];
    const family = typed && FAMILIES[typed] ? typed : "genre";
    const tags = vocab.map((t, i) => ({ t, r: rnd(`flav|${seed}`, i) }))
      .sort((a, b) => b.r - a.r)
      .slice(0, params.take ?? 20)
      .map(({ t }, i) => ({ tag_id: `urn:tag:${family}:qloo:${slug(t)}`, name: t, subtype: `urn:tag:${family}:qloo`, popularity: 0.5, query: { affinity: Math.round((0.95 - i * 0.01) * 100) / 100 } }));
    return { results: { tags } };
  }
  if (/^urn:entity:/.test(params["filter.type"] ?? "")) {
    const type = params["filter.type"].replace("urn:entity:", "");
    const minYear = Number(params["filter.release_year.min"]) || 0;
    const entities = ranked(type, JSON.stringify([where, params["filter.tags"]]), params.take ?? 20).filter((e) => (e.properties.release_year ?? 0) >= minYear);
    return { results: { entities } };
  }
  if (params["filter.type"] !== "urn:heatmap") return { results: { entities: [] } };
  const seed = JSON.stringify([params["signal.interests.entities"], where]);
  const cityMatch = Object.values(CITIES).flat().find(([name]) => where.toLowerCase().startsWith(name.toLowerCase()));
  const cities = where.includes(",") && cityMatch
    ? ["Old Town", "Station Road", "Market Square", "University Area", "Riverside", "New Colony"].map((n, i) => [n, cityMatch[1] + (i - 2) * 0.03, cityMatch[2] + (i % 3) * 0.03])
    : (CITIES[where] ?? CITIES[Object.keys(CITIES).find((m) => (COUNTRY_NAME[m] ?? m).toLowerCase() === where.toLowerCase())] ?? CITIES.India);
  return {
    results: {
      heatmap: cities.map(([name, lat, lon], i) => ({
        location: { latitude: lat, longitude: lon, geohash: `fake${i}`, name },
        query: { affinity: 0.2 + rnd(seed, i) * 0.8, affinity_rank: i + 1, popularity: 0.15 + rnd(where, i) * 0.85 },
      })),
    },
  };
}

/** Synthetic entity lookup: the love's own style and theme tags. */
export async function fakeEntities(ids) {
  await wait(80);
  return { results: ids.map((id) => ({ entity_id: id, name: `Entity ${id.slice(-4)}`, type: "urn:entity:movie", tags: ["Neon Infused", "Glam Spectacle", "Textured Collage", "Stylized", "Vibrant"].map((t) => ({ tag_id: `urn:tag:style:qloo:${slug(t)}`, name: t })).concat([{ tag_id: "urn:tag:theme:qloo:sisterhood", name: "Sisterhood" }]) })) };
}
