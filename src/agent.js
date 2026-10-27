// The Culture Gap scan agent.
//
// Given a cultural wave (shows, artists, films, people) and the markets a maker
// sells in, it works through a fixed playbook of Qloo workflows, makes the
// judgement calls with an LLM where judgement is needed (reading the request,
// turning taste tags into design cues, writing the brief), and keeps every number
// traceable to the Qloo request that produced it.
import { brandLift, cultureFashionGap, heatPoints, momentum, styleTags } from "./analysis.js";
import { chatJson, llmAvailable } from "./llm.js";
import { memo, qlooInsights, qlooTool } from "./qloo.js";

export const ENTITY_TYPES = ["artist", "tv_show", "movie", "person", "brand", "videogame", "podcast", "book"];
export const PERSONAS = {
  maker: "garment maker or manufacturer deciding what to produce",
  boutique: "independent boutique deciding what to stock",
  brand: "small fashion or D2C brand planning its next drop",
  designer: "independent designer looking for the next direction",
};

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 864e5));

/** Wraps a Qloo call so it shows up in the live agent trace with its provenance. */
function tracer(emit) {
  let counter = 0;
  const call = async (title, tool, args, run) => {
    const id = `q${++counter}`;
    emit({ type: "call", id, status: "running", title, tool, args });
    const started = Date.now();
    try {
      const value = await run();
      emit({
        type: "call",
        id,
        status: "done",
        title,
        tool,
        ms: Date.now() - started,
        count: value?.result_count ?? value?.results?.length ?? value?.results?.heatmap?.length,
        provenance: value?.provenance ?? { source: "Qloo API", endpoint: "/v2/insights", requests: [{ method: "GET", path: "/v2/insights", query: args }] },
      });
      return value;
    } catch (error) {
      emit({ type: "call", id, status: "error", title, tool, ms: Date.now() - started, error: error.message });
      throw error;
    }
  };
  return {
    tool: (title, name, args) => call(title, name, args, () => qlooTool(name, args)),
    insights: (title, params) => call(title, "qloo api insights", params, () => qlooInsights(params)),
  };
}

// ---------- step 1: understand the request ----------

async function plan(input, emit) {
  if (Array.isArray(input.waves) && input.waves.length) {
    return {
      waves: input.waves.slice(0, 3).map((w) => (typeof w === "string" ? { name: w } : w)),
      markets: (input.markets ?? []).slice(0, 3),
      persona: input.persona in PERSONAS ? input.persona : "brand",
      angle: input.angle ?? "",
    };
  }
  if (!input.question) throw new Error("Tell the agent which cultural wave to read.");
  if (!llmAvailable()) throw new Error("Free-text questions need the language model. Pick a wave from the examples instead.");

  emit({ type: "thought", text: "Reading your question to work out the cultural wave and the markets…" });
  const planJson = await chatJson({
    system: `You plan fashion trend research. From the user's message, extract:
- waves: 1-3 specific, real cultural entities that are driving the trend (a TV show, film, music artist, celebrity/trendsetter, video game). Use the exact well-known title or name. Give each a type from: ${ENTITY_TYPES.join(", ")}.
- markets: 1-3 countries the user sells in or asks about (full English country names). If none are given, infer from context or use ["India", "United States"].
- persona: one of ${Object.keys(PERSONAS).join(", ")}.
- angle: one short phrase for what they want to make or sell (e.g. "winter jackets", "kidswear"), or "".
Return JSON: {"waves":[{"name":"","type":""}],"markets":[],"persona":"","angle":""}. Never invent people; only use entities you are confident exist.`,
    user: input.question.slice(0, 600),
  });
  const waves = (planJson.waves ?? [])
    .filter((w) => w?.name)
    .slice(0, 3)
    .map((w) => ({ name: String(w.name).slice(0, 80), type: ENTITY_TYPES.includes(w.type) ? w.type : undefined }));
  if (!waves.length) throw new Error("I couldn't spot a cultural wave in that question. Try naming a show, artist or film.");
  return {
    waves,
    markets: (planJson.markets ?? []).filter(Boolean).slice(0, 3),
    persona: planJson.persona in PERSONAS ? planJson.persona : "brand",
    angle: String(planJson.angle ?? "").slice(0, 80),
  };
}

// ---------- step 2: resolve the wave to Qloo entities ----------

async function resolveWave(q, wave) {
  const args = { entity: wave.name, ...(wave.type ? { type: wave.type } : {}) };
  let env = await q.tool(`Find “${wave.name}” in Qloo`, "qloo_describe", args);
  if (env.status === "needs_input") {
    const candidate = env.resolution?.issues?.[0]?.candidates?.[0];
    if (!candidate?.id) return undefined;
    env = await q.tool(`Use the closest match for “${wave.name}”`, "qloo_describe", { entity: candidate.id });
  }
  const r = env.results?.[0];
  if (!r?.entity_id) return undefined;
  return {
    input: wave.name,
    id: r.entity_id,
    name: r.name,
    type: (r.subtype ?? r.type ?? wave.type ?? "").replace(/^urn:entity:/, ""),
    qlooType: r.type,
    popularity: r.popularity,
    description: r.properties?.short_description ?? r.properties?.description,
    image: r.properties?.image?.url ?? r.properties?.image,
    year: r.properties?.release_year,
    match: env.interpretation?.entity?.match,
  };
}

const INSIGHTS_TYPE = (entity) => {
  const t = (entity.qlooType ?? entity.type ?? "").replace(/^urn:entity:/, "");
  if (t === "video_game") return "videogame";
  return ["artist", "book", "brand", "movie", "person", "place", "podcast", "tv_show", "videogame"].includes(t) ? t : undefined;
};

// ---------- fashion tags (looked up once per process) ----------

let fashionTagsPromise;
const FASHION_TAG = /cloth|apparel|fashion|streetwear|footwear|sneaker|shoe|luxury|sportswear|athleisure|denim|accessor|jewel|handbag|beauty|cosmetic/i;

function fashionTags(q) {
  fashionTagsPromise ??= (async () => {
    const found = new Map();
    for (const query of ["clothing brand", "fashion", "streetwear", "footwear"]) {
      const env = await q.tool(`Find Qloo's fashion categories (“${query}”)`, "qloo_find_tags", { query, limit: 10 });
      for (const t of env.results ?? []) {
        if (t?.id && FASHION_TAG.test(t.name ?? "") && /brand|category/i.test(`${t.type ?? ""} ${t.id}`)) found.set(t.id, t);
      }
    }
    return [...found.values()].slice(0, 8);
  })().catch((error) => {
    fashionTagsPromise = undefined;
    throw error;
  });
  return fashionTagsPromise;
}

// ---------- per-market analysis ----------

async function brandsFor(q, market, waveIds, tagIds) {
  const base = { target_type: "brand", signal_location: market, limit: 15, ...(tagIds.length ? { include_tags: tagIds } : {}) };
  const [wave, baseline] = await Promise.all([
    q.tool(`Brands fans of the wave favour in ${market}`, "qloo_recommend", { ...base, signals: waveIds }),
    q.tool(`Baseline: fashion brands ${market} favours overall`, "qloo_recommend", { ...base, limit: 20, explain: false }),
  ]);
  return { lift: brandLift(wave.results ?? [], baseline.results ?? []), baselineCount: baseline.results?.length ?? 0 };
}

async function heat(q, title, entityIds, market) {
  const raw = await q.insights(title, {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": entityIds,
    "filter.location.query": market,
    "output.heatmap.boundary": "city",
    take: 50,
  });
  return heatPoints(raw);
}

async function analyseMarket(q, market, waveEntities, tagIds, emit) {
  const waveIds = waveEntities.map((w) => w.id);
  const result = { market, brands: [], gap: [], notes: [] };

  try {
    const { lift } = await brandsFor(q, market, waveIds, tagIds);
    result.brands = lift;
  } catch (error) {
    result.notes.push(`Brand affinities unavailable: ${error.message}`);
  }
  emit({ type: "partial", key: `brands:${market}`, value: result.brands });

  const followers = result.brands.filter((b) => b.waveSpecific).slice(0, 3);
  const fashionIds = (followers.length ? followers : result.brands.slice(0, 3)).map((b) => b.id).filter(Boolean);
  try {
    const [culture, fashion] = await Promise.all([
      heat(q, `Where the wave is hot in ${market}`, waveIds, market),
      fashionIds.length ? heat(q, `Where its fashion has landed in ${market}`, fashionIds, market) : Promise.resolve([]),
    ]);
    result.gap = cultureFashionGap(culture, fashion).slice(0, 25);
    result.gapBrands = fashionIds;
    if (!culture.length) result.notes.push(`Qloo has no city-level data for this wave in ${market}.`);
  } catch (error) {
    result.notes.push(`City heatmaps unavailable: ${error.message}`);
  }
  emit({ type: "partial", key: `gap:${market}`, value: result.gap });
  return result;
}

// ---------- the brief ----------

function compactForBrief(ctx) {
  return {
    persona: PERSONAS[ctx.plan.persona],
    angle: ctx.plan.angle || undefined,
    waves: ctx.waves.map((w) => ({ name: w.name, type: w.type, momentum: ctx.momentum[w.id]?.label })),
    aesthetic_tags: ctx.tags.slice(0, 15).map((t) => t.name),
    markets: ctx.markets.map((m) => ({
      market: m.market,
      brands_following_the_wave: m.brands.filter((b) => b.waveSpecific).slice(0, 6).map((b) => b.name),
      brands_strong_everywhere: m.brands.filter((b) => !b.waveSpecific).slice(0, 4).map((b) => b.name),
      opportunity_cities: m.gap.filter((g) => g.signal === "opportunity" && g.name).slice(0, 5).map((g) => g.name),
      in_step_cities: m.gap.filter((g) => g.signal === "in-step" && g.name).slice(0, 3).map((g) => g.name),
    })),
  };
}

const BRIEF_SYSTEM = `You are a fashion trend strategist writing for a small business that cannot afford a forecasting agency.
You get structured evidence from Qloo's taste graph: a cultural wave, its momentum, the taste tags that characterise its fans, the fashion brands those fans over-index on in each market, and cities where the culture is hot but the fashion has not followed yet ("opportunity cities").
Write a practical brief. Rules:
- Ground every claim in the evidence. Only name brands, cities and tags that appear in the evidence. Never invent numbers or sales figures.
- Design cues are your interpretation: translate tags into concrete product ideas (silhouettes, colours, prints, materials, items) and say which tags each cue comes from.
- Qloo shows aggregate taste affinity and momentum, not sales or predictions about individuals. Say "early signal", never "guaranteed".
- Plain, confident English. No hype words.
Return JSON:
{"headline":"max 12 words","summary":"2 sentences","timing":{"call":"move now|get ready|watch|late","why":"1 sentence"},
"design_cues":[{"cue":"","from_tags":[""],"product":""}],
"markets":[{"market":"","where_first":[""],"brands_to_study":[""],"move":"1-2 sentences"}],
"collab_ideas":[{"idea":"","why":""}],
"watch_outs":[""]}`;

function groundBrief(brief, evidence) {
  const tags = new Set(evidence.aesthetic_tags.map((t) => t.toLowerCase()));
  const keepTags = (list) => (list ?? []).filter((t) => tags.has(String(t).toLowerCase()));
  const byMarket = new Map(evidence.markets.map((m) => [m.market.toLowerCase(), m]));
  return {
    headline: String(brief.headline ?? "").slice(0, 120),
    summary: String(brief.summary ?? "").slice(0, 600),
    timing: brief.timing,
    design_cues: (brief.design_cues ?? [])
      .map((c) => ({ ...c, from_tags: keepTags(c.from_tags) }))
      .filter((c) => c.cue && c.from_tags.length)
      .slice(0, 5),
    markets: (brief.markets ?? [])
      .map((m) => {
        const ev = byMarket.get(String(m.market ?? "").toLowerCase());
        if (!ev) return undefined;
        const cities = new Set([...ev.opportunity_cities, ...ev.in_step_cities].map((c) => c.toLowerCase()));
        const brands = new Set([...ev.brands_following_the_wave, ...ev.brands_strong_everywhere].map((b) => b.toLowerCase()));
        return {
          market: ev.market,
          where_first: (m.where_first ?? []).filter((c) => cities.has(String(c).toLowerCase())).slice(0, 4),
          brands_to_study: (m.brands_to_study ?? []).filter((b) => brands.has(String(b).toLowerCase())).slice(0, 4),
          move: String(m.move ?? "").slice(0, 400),
        };
      })
      .filter(Boolean),
    collab_ideas: (brief.collab_ideas ?? []).slice(0, 3),
    watch_outs: (brief.watch_outs ?? []).slice(0, 4),
    grounded: true,
  };
}

function fallbackBrief(evidence) {
  const first = evidence.waves[0];
  return {
    headline: `${first?.name ?? "This wave"}: where its fashion goes next`,
    summary: "Written without the language model: these are the raw signals from Qloo.",
    timing: { call: first?.momentum === "rising" ? "move now" : "watch", why: `Momentum reads as ${first?.momentum ?? "unknown"}.` },
    design_cues: [],
    markets: evidence.markets.map((m) => ({
      market: m.market,
      where_first: m.opportunity_cities.slice(0, 3),
      brands_to_study: m.brands_following_the_wave.slice(0, 3),
      move: "",
    })),
    collab_ideas: [],
    watch_outs: [],
    grounded: true,
  };
}

// ---------- the whole scan ----------

export async function runScan(input, emit) {
  const q = tracer(emit);
  const started = Date.now();

  const p = await plan(input, emit);
  if (!p.markets.length) p.markets = ["India", "United States"];
  emit({ type: "plan", value: p });

  // Resolve every wave entity.
  const resolved = (await Promise.all(p.waves.map((w) => resolveWave(q, w).catch(() => undefined)))).filter(Boolean);
  if (!resolved.length) throw new Error("Qloo couldn't find that wave. Try the exact title or artist name.");
  emit({ type: "partial", key: "waves", value: resolved });

  // Momentum (grouped by type, as /v2/trending needs one type per request) and the aesthetic, in parallel.
  const byType = new Map();
  for (const w of resolved) {
    const t = INSIGHTS_TYPE(w);
    if (t) byType.set(t, [...(byType.get(t) ?? []), w]);
  }
  const momentumP = Promise.all(
    [...byType].map(([type, list]) =>
      q
        .tool(`Is it rising? Popularity over the last 6 months`, "qloo_trends", {
          entities: list.map((w) => w.id),
          entity_type: type,
          start_date: daysAgo(182),
          end_date: daysAgo(3),
          limit: 20,
        })
        .catch(() => undefined),
    ),
  );
  const tagsP = q
    .tool("Decode the aesthetic: tags its fans share", "qloo_entity_tags", { entities: resolved.map((w) => w.id), limit: 20 })
    .catch(() => undefined);
  const fashionP = fashionTags(q).catch(() => []);

  const [trendEnvs, tagEnv, fashion] = await Promise.all([momentumP, tagsP, fashionP]);

  const momentumById = {};
  for (const env of trendEnvs.filter(Boolean)) {
    for (const s of env.series ?? []) momentumById[s.entity?.entityId] = momentum(s.points);
  }
  const tags = styleTags(tagEnv?.results ?? []);
  emit({ type: "partial", key: "momentum", value: momentumById });
  emit({ type: "partial", key: "tags", value: tags });
  emit({ type: "partial", key: "fashionTags", value: fashion });

  // Every market in parallel.
  const tagIds = fashion.map((t) => t.id);
  const markets = await Promise.all(p.markets.map((m) => analyseMarket(q, m, resolved, tagIds, emit)));

  const ctx = { plan: p, waves: resolved, momentum: momentumById, tags, markets };
  const evidence = compactForBrief(ctx);

  let brief;
  if (llmAvailable()) {
    emit({ type: "thought", text: "Turning the evidence into a brief…" });
    try {
      // Same evidence, same brief: cached so repeat visits don't spend model quota.
      const raw = await memo("llm", "brief-v1", evidence, () =>
        chatJson({ system: BRIEF_SYSTEM, user: JSON.stringify(evidence), temperature: 0.4, maxTokens: 1800 }),
      );
      brief = groundBrief(raw, evidence);
    } catch (error) {
      emit({ type: "thought", text: `The language model failed (${error.message}); showing the raw signals.` });
    }
  }
  brief ??= fallbackBrief(evidence);

  const report = {
    plan: p,
    waves: resolved,
    momentum: momentumById,
    tags,
    fashionTags: fashion,
    markets,
    brief,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
  emit({ type: "report", value: report });
  return report;
}
