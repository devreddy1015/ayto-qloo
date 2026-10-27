// Stages that talk to Qloo: Think, Architect, Design, Entrepreneur.
import { brandLift, cultureFashionGap, heatPoints, liftPoints, momentum, styleTags } from "../analysis.js";
import { chatJson, llmAvailable } from "../llm.js";
import { memo } from "../qloo.js";
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

  const [tagEnv, demoEnv, ...trendEnvs] = await Promise.all([
    q.tryTool("Decode the aesthetic: tags these fans share", "qloo_entity_tags", { entities: ids, limit: 20 }),
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

  const tags = styleTags(tagEnv?.results ?? []);
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

async function heat(q, title, ids, market) {
  const raw = await q.tryInsights(title, {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": ids,
    "filter.location.query": market,
    "output.heatmap.boundary": "urn:entity:locality",
    take: 50,
  });
  return heatPoints(raw ?? {});
}

async function marketBrands(q, run, market, waveIds, tagIds) {
  const base = { target_type: "brand", limit: 15, ...(tagIds.length ? { include_tags: tagIds } : {}) };
  const [wave, baseline, global] = await Promise.all([
    q.tryTool(`Fashion brands this wave's fans favour in ${market}`, "qloo_recommend", { ...base, signals: waveIds, signal_location: market }),
    q.tryTool(`Baseline: fashion brands ${market} favours overall`, "qloo_recommend", { ...base, limit: 20, explain: false, signal_location: market }),
    q.tryTool("Same brands with no location (does Qloo localise this?)", "qloo_recommend", { ...base, signals: waveIds, explain: false }),
  ]);
  const lift = brandLift(wave?.results ?? [], baseline?.results ?? []);
  for (const b of lift) {
    registerEntity(run, { id: b.id, name: b.name, type: "brand", source: "recommend" });
    registerName(run, b.name, "brand", { id: b.id, market });
  }
  const globalIds = (global?.results ?? []).map((b) => b.entity_id).join();
  const localIds = (wave?.results ?? []).map((b) => b.entity_id).join();
  return { lift, localised: Boolean(globalIds && localIds) && globalIds !== localIds };
}

export async function architect(run) {
  const q = evidenceFor(run, "architect");
  const t = run.stages.think.output;
  const waveIds = t.waves.map((w) => w.id);
  const fashion = await fashionTags(q).catch(() => []);
  const tagIds = fashion.map((x) => x.id);

  const markets = await Promise.all(
    run.input.markets.map(async (market) => {
      const { lift, localised } = await marketBrands(q, run, market, waveIds, tagIds);
      const riding = lift.filter((b) => b.waveSpecific).slice(0, 5);
      const fashionIds = (riding.length ? riding : lift.slice(0, 5)).map((b) => b.id).filter(Boolean);
      const [culture, fashionHeat] = await Promise.all([
        heat(q, `Where the wave is hot in ${market} (city level)`, waveIds, market),
        fashionIds.length ? heat(q, `Where its fashion has landed in ${market}`, fashionIds, market) : Promise.resolve([]),
      ]);
      const gap = cultureFashionGap(culture, fashionHeat).slice(0, 30);
      const named = gap.filter((g) => g.name);
      for (const g of named) registerName(run, g.name, "city", { market });
      const cultureLift = liftPoints(culture);
      const home = run.input.city && market === run.input.homeMarket ? findPlace(cultureLift, run.input.city) : undefined;
      return {
        market,
        brands: lift.slice(0, 12),
        brandsLocalised: localised,
        gap,
        opportunityCities: named.filter((g) => g.signal === "opportunity").slice(0, 6).map((g) => g.name),
        inStepCities: named.filter((g) => g.signal === "in-step").slice(0, 4).map((g) => g.name),
        cells: culture.length,
        coverage: culture.length === 0 ? "none" : culture.length < 8 ? "thin" : "ok",
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
      brands_riding_the_wave: m.brands.filter((b) => b.waveSpecific).slice(0, 6).map((b) => b.name),
      brands_strong_overall: m.brands.filter((b) => !b.waveSpecific).slice(0, 4).map((b) => b.name),
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
    ? await q.tryTool("Style tags of the brands these fans favour", "qloo_entity_tags", { entities: topBrands.map((b) => b.id), limit: 20 })
    : undefined;
  const brandTags = styleTags(brandTagEnv?.results ?? []);
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
  const topCity = a.markets.flatMap((m) => m.opportunityCities.map((c) => ({ c, m: m.market })))[0];

  const [collabEnv, placeEnv] = await Promise.all([
    q.tryTool("Smaller artists the same fans love (collab candidates)", "qloo_recommend", {
      target_type: "artist",
      signals: waveIds,
      limit: 10,
    }),
    topCity
      ? q.tryTool(`Pop-up venues fans would visit in ${topCity.c}`, "qloo_recommend", {
          target_type: "place",
          signals: waveIds,
          filter_location: `${topCity.c}, ${topCity.m}`,
          limit: 8,
        })
      : Promise.resolve(undefined),
  ]);
  const collabs = (collabEnv?.results ?? [])
    .filter((r) => r.name && !t.waves.some((w) => w.id === r.entity_id))
    .filter((r) => (r.popularity ?? 0) < 0.9)
    .slice(0, 6)
    .map((r) => ({ id: r.entity_id, name: r.name, popularity: r.popularity }));
  for (const c of collabs) {
    registerEntity(run, { id: c.id, name: c.name, type: "artist", source: "recommend" });
    registerName(run, c.name, "artist", { id: c.id });
  }
  const places = (placeEnv?.results ?? []).slice(0, 6).map((r) => ({ id: r.entity_id, name: r.name, address: r.properties?.address }));
  for (const p of places) registerName(run, p.name, "place");

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
  return { collabs, places, plan, summary: `${collabs.length} collab candidates, ${places.length} pop-up venues.` };
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
