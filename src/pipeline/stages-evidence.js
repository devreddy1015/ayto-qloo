// Stages that talk to Qloo: Think, Architect, Design, Entrepreneur.
import { brandLift, brandLocalisation, cultureFashionGap, heatPoints, liftPoints, momentum, snapCellsToPlaces, styleTags, tagPoints } from "../analysis.js";
import { CANDIDATE_CITIES, pickLocality, subLocalities, toPlace } from "../cities.js";
import { chatJson, llmAvailable } from "../llm.js";
import { memo, qlooSearch } from "../qloo.js";
import { evidenceFor, registerEntity, registerName } from "./evidence.js";
import { ARCHITECT, DESIGN, ENTREPRENEUR } from "./prompts.js";
import { emitEvent } from "./store.js";

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 864e5));
const INSIGHTS_TYPES = new Set(["artist", "book", "brand", "movie", "person", "place", "podcast", "tv_show", "videogame"]);
const normType = (t) => {
  const s = String(t ?? "").replace(/^urn:entity:/, "");
  return s === "video_game" ? "videogame" : s;
};

/** Ask the model for JSON, cached by prompt + evidence so reruns are free. */
async function llmJson(run, stageId, system, evidence, opts = {}) {
  if (!llmAvailable()) return undefined;
  emitEvent(run, { type: "thought", stage: stageId, text: opts.thought ?? "Writing this stage from the evidence…" });
  try {
    return await memo("llm", `${stageId}-v2`, { system, evidence }, () =>
      chatJson({ system, user: JSON.stringify(evidence), temperature: opts.temperature ?? 0.4, maxTokens: opts.maxTokens ?? 1800 }),
    );
  } catch (error) {
    emitEvent(run, { type: "thought", stage: stageId, text: `Language model unavailable (${error.message}). Using the evidence directly.` });
    return undefined;
  }
}

// ---------- 1. Think ----------

async function resolveOne(q, run, wave) {
  const args = { entity: wave.name, ...(wave.type ? { type: wave.type } : {}) };
  let env = await q.tool(`Find “${wave.name}” in Qloo`, "qloo_describe", args);
  if (env.status === "needs_input") {
    const candidate = env.resolution?.issues?.[0]?.candidates?.[0];
    if (!candidate?.id) return undefined;
    env = await q.tool(`Use the closest match for “${wave.name}”`, "qloo_describe", { entity: candidate.id });
  }
  const r = env.results?.[0];
  if (!r?.entity_id) return undefined;
  const entity = {
    input: wave.name,
    id: r.entity_id,
    name: r.name,
    type: normType(r.subtype ?? r.type ?? wave.type),
    popularity: r.popularity,
    description: r.properties?.short_description ?? r.properties?.description,
    image: r.properties?.image?.url ?? r.properties?.image,
    year: r.properties?.release_year,
  };
  registerEntity(run, { ...entity, source: "describe" });
  registerName(run, entity.name, "wave", { id: entity.id });
  return entity;
}

export async function think(run) {
  const q = evidenceFor(run, "think");
  const input = run.input;
  const waves = (await Promise.all(input.loves.map((w) => resolveOne(q, run, w).catch(() => undefined)))).filter(Boolean);
  if (!waves.length) throw new Error("Qloo couldn't find any of those. Try the exact title or artist name.");
  const ids = waves.map((w) => w.id);

  // Tags of the waves' own kind only: without the parent filter Qloo leads with place tags (hotel stars, card types).
  const parentTypes = [...new Set(waves.map((w) => `urn:entity:${w.type}`))];
  const [tagEnv, demoEnv, ...trendEnvs] = await Promise.all([
    q.tryInsights("Decode the aesthetic: tags these fans share", { "filter.type": "urn:tag", "signal.interests.entities": ids, "filter.parents.types": parentTypes, take: 20 }),
    q.tryTool("Who the audience is (aggregate skew only)", "qloo_audience_demographics", { entity: ids[0], limit: 10 }),
    ...[...new Set(waves.map((w) => w.type).filter((t) => INSIGHTS_TYPES.has(t)))].map((type) =>
      q.tryTool("Momentum snapshot (hackathon trend data may be frozen)", "qloo_trends", {
        entities: waves.filter((w) => w.type === type).map((w) => w.id).slice(0, 5),
        entity_type: type,
        start_date: daysAgo(182),
        end_date: daysAgo(3),
        limit: 20,
      }),
    ),
  ]);

  const tags = styleTags(tagPoints(tagEnv));
  for (const t of tags) registerName(run, t.name, "tag", { id: t.id });
  const momentumById = {};
  for (const env of trendEnvs.filter(Boolean)) for (const s of env.series ?? []) momentumById[s.entity?.entityId] = momentum(s.points);

  return {
    waves,
    tags,
    demographics: (demoEnv?.results ?? []).slice(0, 10),
    momentum: momentumById,
    summary: `Qloo found ${waves.map((w) => w.name).join(", ")} and ${tags.length} taste tags its fans share.`,
  };
}

// ---------- 2. Architect ----------

let fashionTagsPromise;
const FASHION_TAG = /cloth|apparel|fashion|streetwear|footwear|sneaker|shoe|luxury|sportswear|athleisure|denim|accessor|jewel|handbag/i;
function fashionTags(q) {
  fashionTagsPromise ??= (async () => {
    const found = new Map();
    for (const query of ["clothing brand", "fashion", "streetwear", "footwear"]) {
      const env = await q.tryTool(`Find Qloo's fashion categories (“${query}”)`, "qloo_find_tags", { query, limit: 10 });
      for (const t of env?.results ?? []) {
        if (t?.id && FASHION_TAG.test(t.name ?? "") && /brand|category/i.test(`${t.type ?? ""} ${t.id}`)) found.set(t.id, t);
      }
    }
    return [...found.values()].slice(0, 8);
  })().catch((e) => {
    fashionTagsPromise = undefined;
    throw e;
  });
  return fashionTagsPromise;
}

/**
 * The market's cities as Qloo knows them. Each candidate name is looked up with
 * a locality search; only the ones Qloo returns, with Qloo's id, spelling and
 * coordinates, go on. Recorded as one receipt listing every search.
 */
async function marketPlaces(q, run, market) {
  const home = run.input.city && market === run.input.homeMarket ? [run.input.city.split(",")[0].trim()] : [];
  const names = [...new Set([...home, ...(CANDIDATE_CITIES[market] ?? [])])];
  if (!names.length) return [];
  const env = await q.tryStep(`Find ${market}'s cities in Qloo (${names.length} locality searches)`, "qloo api search", { type: "locality", take: 6, queries: names.length }, async () => {
    const hits = await Promise.all(
      names.map((name) =>
        qlooSearch({ query: name, type: "locality", take: 6 })
          .then((r) => pickLocality(r?.results, { query: name, market }))
          .catch(() => undefined),
      ),
    );
    const seen = new Set();
    const results = hits.filter((h) => h && !seen.has(h.entity_id) && seen.add(h.entity_id)).map((h) => toPlace(h, market));
    return {
      results,
      provenance: { source: "Qloo API", endpoint: "/search", requests: names.map((name) => ({ method: "GET", path: "/search", query: { query: name, types: "urn:entity:locality", take: 6 } })) },
    };
  });
  const places = env?.results ?? [];
  for (const p of places) registerName(run, p.name, "city", { id: p.id, market });
  return places;
}

/**
 * A heatmap as named points. Qloo returns geohash cells (its locality form
 * returns every polygon in the country, over 100 MB), so the cells are snapped
 * to the market's Qloo localities. Sample mode already names its cells.
 */
async function heat(q, title, ids, market, places, { radiusKm = 30 } = {}) {
  const raw = await q.tryInsights(title, {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": ids,
    "filter.location.query": market,
    "output.heatmap.boundary": "urn:geohash",
  });
  const cells = heatPoints(raw ?? {});
  const points = cells.some((c) => c.name) ? cells : snapCellsToPlaces(cells, places, { radiusKm });
  return { cells: cells.length, points };
}

/**
 * The fashion brands the wave's fans favour in a market, with lift read inside
 * that one response (see brandLift). The same request without the location is
 * kept as a receipt for how little Qloo localises brands. A separate "what the
 * market favours overall" baseline was dropped: with the fashion filter Qloo
 * answers that with designer labels that share no names with the wave list.
 */
async function marketBrands(q, run, market, waves, tagIds) {
  const waveIds = waves.map((w) => w.id);
  const base = { target_type: "brand", limit: 15, ...(tagIds.length ? { include_tags: tagIds } : {}) };
  const [wave, global] = await Promise.all([
    q.tryTool(`Fashion brands this wave's fans favour in ${market}`, "qloo_recommend", { ...base, signals: waveIds, signal_location: market }),
    q.tryTool("Same brands with no location (does Qloo localise this?)", "qloo_recommend", { ...base, signals: waveIds, explain: false }),
  ]);
  const lift = brandLift(wave?.results ?? [], { waves });
  for (const b of lift) {
    registerEntity(run, { id: b.id, name: b.name, type: "brand", source: "recommend" });
    registerName(run, b.name, "brand", { id: b.id, market });
  }
  return { lift, localisation: brandLocalisation(wave?.results ?? [], global?.results ?? []) };
}

export async function architect(run) {
  const q = evidenceFor(run, "architect");
  const t = run.stages.think.output;
  const waveIds = t.waves.map((w) => w.id);
  const fashion = await fashionTags(q).catch(() => []);
  const tagIds = fashion.map((x) => x.id);

  const markets = await Promise.all(
    run.input.markets.map(async (market) => {
      const [{ lift, localisation }, places] = await Promise.all([marketBrands(q, run, market, t.waves, tagIds), marketPlaces(q, run, market)]);
      const riding = lift.filter((b) => b.waveSpecific).slice(0, 5);
      const fashionIds = (riding.length ? riding : lift.slice(0, 5)).map((b) => b.id).filter(Boolean);
      const [culture, fashionHeat] = await Promise.all([
        heat(q, `Where the wave is hot in ${market} (city level)`, waveIds, market, places),
        fashionIds.length ? heat(q, `Where its fashion has landed in ${market}`, fashionIds, market, places) : Promise.resolve({ cells: 0, points: [] }),
      ]);
      const gap = cultureFashionGap(culture.points, fashionHeat.points).slice(0, 30);
      const named = gap.filter((g) => g.name);
      for (const g of named) registerName(run, g.name, "city", { market });
      const cultureLift = liftPoints(culture.points);
      const home = run.input.city && market === run.input.homeMarket ? findPlace(cultureLift, run.input.city) : undefined;
      return {
        market,
        brands: lift.slice(0, 12),
        brandsLocalised: localisation.localised,
        localisation,
        gap,
        opportunityCities: named.filter((g) => g.signal === "opportunity").slice(0, 6).map((g) => g.name),
        inStepCities: named.filter((g) => g.signal === "in-step").slice(0, 4).map((g) => g.name),
        cells: culture.cells,
        places: places.length,
        coverage: culture.points.length === 0 ? "none" : culture.points.length < 8 ? "thin" : "ok",
        home,
      };
    }),
  );

  const evidence = {
    maker: run.input.maker,
    angle: run.input.angle,
    home: run.input.city,
    waves: t.waves.map((w) => ({ name: w.name, type: w.type })),
    tags: t.tags.slice(0, 15).map((x) => x.name),
    markets: markets.map((m) => ({
      market: m.market,
      brands_riding_the_wave: m.brands.filter((b) => b.signal === "rides").slice(0, 6).map((b) => (b.pulledBy?.name ? `${b.name} (pulled by ${b.pulledBy.name})` : b.name)),
      brands_in_step: m.brands.filter((b) => b.signal === "in-step").slice(0, 4).map((b) => b.name),
      brands_popular_regardless: m.brands.filter((b) => b.signal === "giant").slice(0, 4).map((b) => b.name),
      opportunity_cities: m.opportunityCities,
      in_step_cities: m.inStepCities,
      coverage: m.coverage,
    })),
  };
  const plan = (await llmJson(run, "architect", ARCHITECT, evidence, { thought: "Planning the product line from the gap map…" })) ?? fallbackArchitect(evidence);
  return {
    fashionTags: fashion.map((x) => ({ id: x.id, name: x.name })),
    markets,
    plan,
    summary: `${markets.reduce((n, m) => n + m.opportunityCities.length, 0)} opportunity cities across ${markets.length} market(s).`,
  };
}

function findPlace(points, name) {
  const needle = String(name).toLowerCase().split(",")[0].trim();
  return points.find((p) => p.name && p.name.toLowerCase().includes(needle));
}

function fallbackArchitect(ev) {
  return {
    positioning: `A ${ev.maker ?? "clothing"} line for fans of ${ev.waves.map((w) => w.name).join(" and ")}.`,
    categories: [{ category: ev.angle || "tees and layers", why: "Chosen without the language model; from the maker's own input.", priority: 1 }],
    price_tier: { tier: "mid", why: "Default without the language model." },
    first_markets: ev.markets.map((m) => ({ market: m.market, cities: m.opportunity_cities.slice(0, 3), why: "Highest culture-minus-fashion gap." })),
    avoid: [],
    fallback: true,
  };
}

// ---------- 3. Design ----------

export async function design(run) {
  const q = evidenceFor(run, "design");
  const t = run.stages.think.output;
  const a = run.stages.architect.output;
  const topBrands = [...new Map(a.markets.flatMap((m) => m.brands.filter((b) => b.waveSpecific)).map((b) => [b.id, b])).values()].slice(0, 5);
  const brandTagEnv = topBrands.length
    ? await q.tryInsights("Style tags of the brands these fans favour", { "filter.type": "urn:tag", "signal.interests.entities": topBrands.map((b) => b.id), "filter.parents.types": ["urn:entity:brand"], take: 20 })
    : undefined;
  const brandTags = styleTags(tagPoints(brandTagEnv));
  for (const x of brandTags) registerName(run, x.name, "tag", { id: x.id });

  const evidence = {
    maker: run.input.maker,
    angle: run.input.angle,
    waves: t.waves.map((w) => w.name),
    audience_tags: t.tags.slice(0, 18).map((x) => x.name),
    brand_style_tags: brandTags.slice(0, 15).map((x) => x.name),
    brands_fans_favour: topBrands.map((b) => b.name),
    categories: a.plan.categories?.map((c) => c.category),
    price_tier: a.plan.price_tier?.tier,
  };
  const plan = (await llmJson(run, "design", DESIGN, evidence, { thought: "Turning taste tags into a collection…", temperature: 0.5 })) ?? fallbackDesign(evidence);
  return { brandTags, plan, summary: `${plan.styles?.length ?? 0} styles from ${evidence.audience_tags.length + evidence.brand_style_tags.length} Qloo tags.` };
}

function fallbackDesign(ev) {
  const tags = ev.audience_tags.slice(0, 4);
  return {
    mood: `Built from Qloo tags: ${tags.join(", ")}. Written without the language model.`,
    palette: [],
    cues: tags.map((t) => ({ cue: `Reference “${t}”`, from_tags: [t], from_brands: [] })),
    styles: (ev.categories?.length ? ev.categories : ["tee"]).slice(0, 3).map((c, i) => ({
      name: `${c} 01`,
      category: c,
      description: "Placeholder style; the language model was unavailable.",
      colourways: [],
      hero: i === 0,
      from_tags: tags.slice(0, 2),
    })),
    avoid: [],
    fallback: true,
  };
}

// ---------- 8. Entrepreneur ----------

export async function entrepreneur(run) {
  const q = evidenceFor(run, "entrepreneur");
  const t = run.stages.think.output;
  const a = run.stages.architect.output;
  const b = run.stages.backend.output;
  const waveIds = t.waves.map((w) => w.id);
  // The first cities: top gap cities per market, home city first when it has data.
  const cities = [];
  for (const m of a.markets) {
    const home = m.home?.name && m.market === run.input.homeMarket ? [m.home.name] : [];
    for (const c of [...home, ...m.opportunityCities]) if (!cities.some((x) => x.city === c)) cities.push({ city: c, market: m.market });
  }
  const firstCities = cities.slice(0, 3);

  const [collabEnv, ...passportEnvs] = await Promise.all([
    q.tryTool("Rising artists the same fans love (soundtrack and collab candidates)", "qloo_recommend", {
      target_type: "artist",
      signals: waveIds,
      limit: 12,
    }),
    ...firstCities.map((c) => cityPassport(q, run, waveIds, c)),
  ]);

  // ---- Campaign soundtrack: rising artists, with the tags their fans share with the wave ----
  const artists = (collabEnv?.results ?? [])
    .filter((r) => r.name && !t.waves.some((w) => w.id === r.entity_id))
    .filter((r) => (r.popularity ?? 0) < 0.9)
    .slice(0, 6)
    .map((r) => ({ id: r.entity_id, name: r.name, popularity: r.popularity, image: r.properties?.image?.url ?? r.properties?.image }));
  for (const c of artists) {
    registerEntity(run, { id: c.id, name: c.name, type: "artist", source: "recommend" });
    registerName(run, c.name, "artist", { id: c.id });
  }
  const compareEnv = artists.length
    ? await q.tryTool("What the wave's fans and these artists' fans share", "qloo_compare_audiences", {
        group_a: waveIds,
        group_b: artists.slice(0, 3).map((x) => x.id),
        limit: 12,
      })
    : undefined;
  const sharedTags = sharedTagNames(compareEnv);
  for (const s of sharedTags) registerName(run, s, "tag");
  const soundtrack = artists.map((x, i) => ({ ...x, role: i === 0 ? "feature" : i < 3 ? "collab" : "playlist", sharedTags: sharedTags.slice(0, 5) }));
  const collabs = artists.slice(0, 4);

  const passport = passportEnvs.filter(Boolean);
  const places = passport.flatMap((p) => p.venues).slice(0, 6);

  const evidence = {
    maker: run.input.maker,
    home: run.input.city,
    waves: t.waves.map((w) => w.name),
    markets: a.markets.map((m) => ({
      market: m.market,
      brands_fans_favour: m.brands.slice(0, 6).map((x) => x.name),
      opportunity_cities: m.opportunityCities,
    })),
    collab_candidates: collabs.map((c) => c.name),
    popup_venues: places.map((p) => p.name),
    unit_economics: b.economics,
    price_tier: a.plan.price_tier?.tier,
  };
  const plan = (await llmJson(run, "entrepreneur", ENTREPRENEUR, evidence, { thought: "Working out channels, pricing and partners…" })) ?? fallbackEntrepreneur(evidence);
  return {
    collabs,
    places,
    soundtrack,
    passport,
    plan,
    summary: `${passport.length} city passports, ${soundtrack.length} soundtrack artists, ${collabs.length} collab candidates.`,
  };
}

/** City Passport: the neighbourhoods and venues inside one city where the wave's fans are. */
async function cityPassport(q, run, waveIds, { city, market }) {
  const where = `${city}, ${market}`;
  const [venueEnv, heatRaw, subEnv] = await Promise.all([
    q.tryTool(`Venues the fans visit in ${city}`, "qloo_recommend", { target_type: "place", signals: waveIds, filter_location: where, limit: 8 }),
    q.tryInsights(`Where inside ${city} the wave is hottest`, {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": waveIds,
      "filter.location.query": where,
      "output.heatmap.boundary": "urn:geohash",
    }),
    q.trySearch(`Neighbourhoods of ${city} that Qloo knows`, { query: city, type: "locality", take: 20 }),
  ]);
  const venues = (venueEnv?.results ?? [])
    .filter((r) => r.name)
    .slice(0, 6)
    .map((r) => ({ id: r.entity_id, name: r.name, address: r.properties?.address, type: r.subtype ?? r.type }));
  for (const v of venues) registerName(run, v.name, "place", { city });
  const cells = heatPoints(heatRaw ?? {});
  const named = cells.some((c) => c.name) ? cells : snapCellsToPlaces(cells, subLocalities(subEnv?.results, { city, market }), { radiusKm: 4 });
  const ranked = liftPoints(named).filter((p) => p.name && p.name.toLowerCase() !== city.toLowerCase()).sort((x, y) => y.lift - x.lift);
  const positive = ranked.filter((p) => p.lift > 0);
  const neighbourhoods = (positive.length ? positive : ranked).slice(0, 4).map((p) => ({ name: p.name, lift: p.lift, lat: p.lat, lon: p.lon }));
  for (const n of neighbourhoods) registerName(run, n.name, "neighbourhood", { city });
  return {
    city,
    market,
    venues,
    neighbourhoods,
    coverage: !venues.length && !neighbourhoods.length ? "none" : venues.length + neighbourhoods.length < 4 ? "thin" : "ok",
  };
}

function sharedTagNames(env) {
  const r = env?.results;
  const list = Array.isArray(r?.tags) ? r.tags : Array.isArray(r) ? r : [];
  return list.map((t) => t?.name ?? t?.tag?.name).filter(Boolean).slice(0, 10);
}

function fallbackEntrepreneur(ev) {
  return {
    channels: [{ channel: "Instagram + WhatsApp catalogue", why: "Zero-fee direct channel.", first: true }, { channel: "Meesho", why: "Tier-2/3 reach, 0% commission.", first: false }],
    pricing: { anchor_brands: ev.markets[0]?.brands_fans_favour.slice(0, 3) ?? [], note: "Written without the language model." },
    collabs: ev.collab_candidates.slice(0, 2).map((p) => ({ partner: p, idea: "Co-branded capsule", why: "Same fans, smaller audience." })),
    risks: ["Affinity is taste fit, not a sales forecast."],
    next_90_days: ["Sample 3 styles", "Soft-launch on Instagram", "Ship first drop to the top gap city"],
    fallback: true,
  };
}
