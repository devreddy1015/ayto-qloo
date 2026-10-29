// Stage 1: everything the user typed, as Qloo knows it. A run never goes on
// with a city Qloo cannot place; a theme Qloo cannot tag is kept as plain
// words and the read falls back to the loves.
import { CANDIDATE_CITIES, COUNTRY_ALIASES, closestKnownCity, displayName, localityName, pickLocality } from "../cities.js";
import { CATEGORY_FILTERS, FORMATS } from "../formats.js";
import { evidenceFor, registerEntity, registerName } from "../pipeline/evidence.js";

const TAG_PREFERENCE = ["urn:tag:genre:qloo", "urn:tag:genre:media", "urn:tag:subgenre:qloo", "urn:tag:theme:qloo", "urn:tag:category:qloo", "urn:tag:category:place", "urn:tag:plot:qloo", "urn:tag:keyword:qloo", "urn:tag:keyword:media"];
const lower = (s) => String(s ?? "").toLowerCase();

/** Our market name for a Qloo country name ("United States of America" → "United States"). */
export function marketFor(countryName) {
  const c = lower(countryName);
  for (const [market, aliases] of Object.entries(COUNTRY_ALIASES)) if (aliases.some((a) => c === a || c.includes(a))) return market;
  return undefined;
}

function countryOf(hit) {
  const a = (hit?.properties?.ancestors ?? []).find((x) => x?.place === "country" || x?.admin_level === 2);
  return a?.name ?? lower(hit?.disambiguation).split(",").at(-1)?.trim();
}

/** The state or province in a locality's parent chain (admin level 4), for an unambiguous location label. */
function stateOf(hit) {
  const a = (hit?.properties?.ancestors ?? []).find((x) => x?.place === "state" || x?.admin_level === 4);
  return a?.name && lower(a.name) !== lower(localityName(hit)) ? a.name : undefined;
}

export const toCity = (hit, countryHint) => {
  const country = countryOf(hit) ?? countryHint;
  return { id: hit.entity_id, name: displayName(localityName(hit)), state: stateOf(hit), lat: hit.location?.lat, lon: hit.location?.lon, country, market: marketFor(country) ?? countryHint, level: hit.properties?.admin_level, popularity: hit.popularity, qlooName: hit.disambiguation ?? hit.name };
};

/** Rank locality hits for a free query: exact name, city-sized, popular. */
export function pickCity(results = [], query, { wantedId } = {}) {
  const needle = lower(query).split(",")[0].trim();
  const scored = results
    .filter((r) => r?.entity_id && r?.location?.lat !== undefined)
    .map((r) => {
      const names = [r.name, ...(r.properties?.akas ?? []).map((a) => a?.value)].map((n) => lower(n).split(",")[0].trim());
      const level = r.properties?.admin_level;
      return {
        r,
        wanted: wantedId && r.entity_id === wantedId ? 1 : 0,
        exact: names.includes(needle) ? 2 : names.some((n) => n.includes(needle)) ? 1 : 0,
        city: level === undefined || (level >= 4 && level <= 8) ? 1 : 0,
        popularity: r.popularity ?? 0,
      };
    })
    .sort((a, b) => b.wanted - a.wanted || b.exact - a.exact || b.city - a.city || b.popularity - a.popularity);
  return scored[0]?.exact || scored[0]?.wanted ? scored[0].r : undefined;
}

async function resolveCity(q, run, input) {
  const query = String(input.city?.query ?? input.city ?? "").trim();
  if (!query) throw new Error("Tell AYTO which city this is for.");
  const [cityPart, countryPart] = query.split(",").map((s) => s.trim());
  const env = await q.trySearch(`Find “${cityPart}” among Qloo's localities`, { query: cityPart, type: "locality", take: 8 });
  const hits = env?.results ?? [];
  let hit = (countryPart && marketFor(countryPart) && pickLocality(hits, { query: cityPart, market: marketFor(countryPart) })) || pickCity(hits, cityPart, { wantedId: input.city?.id });
  // A typo or an old name ("Hydrabad", "Bangalore"): try the closest known city, and say so.
  let correctedFrom;
  if (!hit) {
    const guess = closestKnownCity(cityPart, { market: countryPart && marketFor(countryPart) });
    if (guess) {
      const env2 = await q.trySearch(`“${cityPart}” isn't in Qloo; trying ${guess.name}`, { query: guess.name, type: "locality", take: 8 });
      hit = pickLocality(env2?.results ?? [], { query: guess.name, market: guess.market }) || pickCity(env2?.results ?? [], guess.name);
      if (hit) correctedFrom = cityPart;
    }
  }
  if (!hit) throw new Error(`Qloo couldn't place “${cityPart}”. Try the city's common English name, with the country.`);
  const city = { ...toCity(hit, countryPart && marketFor(countryPart)), ...(correctedFrom ? { correctedFrom } : {}) };
  registerName(run, city.name, "city", { id: city.id, market: city.market });
  registerName(run, localityName(hit), "city", { id: city.id, market: city.market });
  return city;
}

async function resolveContrast(q, run, city) {
  const list = CANDIDATE_CITIES[city.market] ?? [];
  const name = list.find((n) => lower(n) !== lower(city.name) && !lower(city.qlooName).includes(lower(n)));
  if (!name) return undefined;
  const env = await q.trySearch(`Contrast city: find “${name}” (the country's largest other city)`, { query: name, type: "locality", take: 6 });
  const hit = pickLocality(env?.results ?? [], { query: name, market: city.market });
  if (!hit) return undefined;
  const contrast = toCity(hit, city.market);
  registerName(run, contrast.name, "city", { id: contrast.id, market: city.market });
  return contrast;
}

export function pickTags(results = [], { max = 2, query } = {}) {
  const rank = (t) => {
    const i = TAG_PREFERENCE.findIndex((p) => String(t.id ?? "").startsWith(p));
    return i < 0 ? TAG_PREFERENCE.length : i;
  };
  const exact = (t) => (query && lower(t.name) === lower(query) ? 0 : 1);
  const seen = new Set();
  return results
    .filter((t) => t?.id && t?.name)
    .sort((a, b) => exact(a) - exact(b) || rank(a) - rank(b) || (b.popularity ?? 0) - (a.popularity ?? 0))
    .filter((t) => !seen.has(lower(t.name)) && seen.add(lower(t.name)))
    .slice(0, max)
    .map((t) => ({ id: t.id, name: t.name, type: t.type }));
}

async function resolveTheme(q, run, input) {
  const query = String(input.theme?.query ?? input.theme ?? "").trim();
  if (!query) return { query: "", tags: [] };
  const words = query.split(/\s*(?:,|\band\b|\/|\+)\s*/i).map((w) => w.trim()).filter(Boolean).slice(0, 3);
  const tags = [];
  // Every word keeps its candidates: Qloo's tags are typed (a film genre tag filters no artist), so each
  // entity type later picks the candidate of its own family (themeTagIdsFor in common.js).
  const byWord = [];
  for (const word of words) {
    const env = await q.tryTool(`Find Qloo's tag for “${word}”`, "qloo_find_tags", { query: word, limit: 12 });
    const candidates = (env?.results ?? []).filter((t) => t?.id && t?.name).map((t) => ({ id: t.id, name: t.name, type: t.type }));
    const picked = input.theme?.ids?.length ? candidates.filter((t) => input.theme.ids.includes(t.id)) : [];
    const chosen = picked.length ? picked : pickTags(env?.results ?? [], { max: 1, query: word });
    for (const t of chosen) if (!tags.some((x) => x.id === t.id)) tags.push(t);
    if (chosen.length) byWord.push({ word, chosen: chosen[0], candidates: candidates.slice(0, 12) });
  }
  for (const t of tags) registerName(run, t.name, "tag", { id: t.id });
  for (const w of byWord) for (const c of w.candidates) if (lower(c.name) === lower(w.chosen.name)) registerName(run, c.name, "tag", { id: c.id });
  return { query, words, tags, byWord };
}

// The languages a city's own screen culture works in, so a title that exists twice (an original and its
// remake) resolves to the one this city watches. India's film industries follow the state; elsewhere the market.
const LANG_BY_STATE = {
  telangana: ["Telugu"], "andhra pradesh": ["Telugu"], "tamil nadu": ["Tamil"], puducherry: ["Tamil"], kerala: ["Malayalam"], karnataka: ["Kannada"],
  maharashtra: ["Marathi", "Hindi"], "west bengal": ["Bengali"], punjab: ["Punjabi"], gujarat: ["Gujarati"], odisha: ["Odia"], assam: ["Assamese"],
  delhi: ["Hindi"], "national capital territory of delhi": ["Hindi"], "uttar pradesh": ["Hindi"], bihar: ["Hindi", "Bhojpuri"], rajasthan: ["Hindi"], "madhya pradesh": ["Hindi"], haryana: ["Hindi"], uttarakhand: ["Hindi"], jharkhand: ["Hindi"], chhattisgarh: ["Hindi"], goa: ["Konkani", "Hindi"],
};
const LANG_BY_MARKET = {
  "United States": ["English"], "United Kingdom": ["English"], Canada: ["English", "French"], Australia: ["English"], Ireland: ["English"], "New Zealand": ["English"],
  France: ["French"], Spain: ["Spanish"], Mexico: ["Spanish"], Argentina: ["Spanish"], Colombia: ["Spanish"], Brazil: ["Portuguese"], Portugal: ["Portuguese"],
  Germany: ["German"], Italy: ["Italian"], Japan: ["Japanese"], "South Korea": ["Korean"], Indonesia: ["Indonesian"], Turkey: ["Turkish"], Nigeria: ["English"],
};
export function cityLanguages(city) {
  if (!city) return [];
  return LANG_BY_STATE[lower(city.state)] ?? LANG_BY_MARKET[city.market] ?? (city.market === "India" ? ["Hindi"] : []);
}

const norm = (s) => lower(s).normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
/** "HIT: The First Case (2020)" → { name, year }. */
export function splitYear(text) {
  const m = String(text ?? "").match(/^(.*?)[\s,]*\(?((?:19|20)\d\d)\)?\s*$/);
  return m && m[1].trim() ? { name: m[1].trim(), year: Number(m[2]) } : { name: String(text ?? "").trim(), year: undefined };
}
const languageOf = (r) => String(r?.properties?.description ?? "").match(/\b([A-Z][a-z]+)-language\b/)?.[1];
const isRemake = (r) => /\bremake of\b/i.test(String(r?.properties?.description ?? ""));
const yearOfEntity = (r) => Number(r?.properties?.release_year ?? String(r?.properties?.release_date ?? "").slice(0, 4)) || undefined;

/**
 * Rank Qloo search hits for a title or name the user typed. A hit must carry the name, or have it as an
 * alias (Qloo lists the Telugu original "HIT" with the alias "Hit: The First Case", the same name as its
 * 2022 Hindi remake). Then: the year if the user gave one, the original over a remake, the city's own
 * language, the exact name, popularity. Each option says why, so the confirm step can show it.
 */
export function rankTitleOptions(results = [], { name, year, languages = [], kinds = [] } = {}) {
  const needle = norm(name);
  const langs = languages.map(lower);
  return results
    .filter((r) => r?.entity_id && r?.name)
    .map((r) => {
      const own = norm(r.name) === needle;
      const aka = (r.properties?.akas ?? []).some((a) => norm(a?.value ?? a) === needle);
      const y = yearOfEntity(r);
      const language = languageOf(r);
      const remake = isRemake(r);
      // A name with no stated kind ("Sid Sriram") prefers the kind the format reads first: the singer for a reel.
      const kind = String(r.subtype ?? r.types?.[0] ?? r.type ?? "").replace(/^urn:entity:/, "");
      const k = kinds.indexOf(kind);
      const kindBonus = k < 0 ? 0 : Math.max(0, 1.5 - 0.5 * k);
      const score = (year && y === year ? 10 : 0) + (own ? 2 : aka ? 1 : 0) + (language && langs.includes(lower(language)) ? 2 : 0) - (remake ? 2 : 0) + kindBonus;
      return { r, own, aka, year: y, language, remake, score };
    })
    .filter((o) => o.own || o.aka || (year && o.year === year && norm(o.r.name).includes(needle)))
    .sort((a, b) => b.score - a.score || (b.r.popularity ?? 0) - (a.r.popularity ?? 0))
    .map((o) => ({ id: o.r.entity_id, name: o.r.name, type: String(o.r.subtype ?? o.r.types?.[0] ?? o.r.type ?? "").replace(/^urn:entity:/, "") || undefined, year: o.year, language: o.language, remake: o.remake, popularity: o.r.popularity, image: o.r.properties?.image?.url ?? o.r.properties?.image, raw: o.r }));
}

/** Search Qloo for one love and rank what comes back (used by the confirm step and by resolve). */
export async function loveOptions(search, love, city, { format } = {}) {
  const { name, year } = splitYear(love.name);
  const env = await search({ query: name, ...(love.type ? { type: love.type } : {}), take: 8 });
  return rankTitleOptions(env?.results ?? [], { name, year, languages: cityLanguages(city), kinds: love.type ? [] : FORMATS[format]?.types ?? [] });
}

async function resolveLove(q, run, love, city) {
  let r;
  let alternatives = [];
  if (love.id) {
    // Picked in the confirm step: the same search (cached from that step) carries the full entity;
    // describe it by id only if the search no longer lists it.
    const options = await loveOptions((args) => q.trySearch(`Find “${love.name}” among Qloo's ${love.type ? love.type.replace("_", " ") + "s" : "entities"}`, args), love, city, { format: run.input.format });
    const picked = options.find((o) => o.id === love.id);
    if (picked) {
      r = picked.raw;
      alternatives = options.filter((o) => o.id !== love.id).slice(0, 3).map(({ raw, ...o }) => o);
    } else {
      const env = await q.tryTool(`Use the “${love.name}” you picked`, "qloo_describe", { entity: love.id });
      r = env?.results?.[0];
    }
  } else {
    const options = await loveOptions((args) => q.trySearch(`Find “${love.name}” among Qloo's ${love.type ? love.type.replace("_", " ") + "s" : "entities"}`, args), love, city, { format: run.input.format });
    if (options.length) {
      r = options[0].raw;
      alternatives = options.slice(1, 4).map(({ raw, ...o }) => o);
    } else {
      const args = { entity: splitYear(love.name).name, ...(love.type ? { type: love.type } : {}) };
      let env = await q.tryTool(`Find “${love.name}” in Qloo`, "qloo_describe", args);
      if (env?.status === "needs_input") {
        const candidate = env.resolution?.issues?.[0]?.candidates?.[0];
        if (!candidate?.id) return undefined;
        env = await q.tryTool(`Use the closest match for “${love.name}”`, "qloo_describe", { entity: candidate.id });
      }
      r = env?.results?.[0];
    }
  }
  if (!r?.entity_id) return undefined;
  const entity = {
    input: love.name,
    id: r.entity_id,
    name: r.name,
    type: String(r.subtype ?? r.types?.[0] ?? r.type ?? love.type ?? "").replace(/^urn:entity:/, ""),
    popularity: r.popularity,
    image: r.properties?.image?.url ?? r.properties?.image,
    year: yearOfEntity(r),
    language: languageOf(r),
    remake: isRemake(r) || undefined,
    alternatives: alternatives.length ? alternatives : undefined,
  };
  registerEntity(run, { ...entity, source: love.id ? "describe" : "search" });
  registerName(run, entity.name, "love", { id: entity.id });
  return entity;
}

/**
 * Qloo's category tags for one slice of a broad type ("coffee brand", "cafe"), so a brand read
 * stays on labels and a place read on cafés. One receipt per query; only tags that look like
 * brand or place categories and match the format's pattern are kept.
 */
async function categoryTags(q, type, { queries, match, kinds = /brand|category|place|cuisine|amenity|genre/i }) {
  const found = new Map();
  for (const query of queries) {
    const env = await q.tryTool(`Find Qloo's ${type} categories (“${query}”)`, "qloo_find_tags", { query, limit: 10 });
    for (const t of env?.results ?? []) {
      const kind = `${t.type ?? ""} ${t.id ?? ""}`;
      if (t?.id && match.test(t.name ?? "") && kinds.test(kind)) found.set(t.id, { id: t.id, name: t.name, type: t.type });
    }
  }
  return [...found.values()].slice(0, 8);
}

// A drop for children reads children's labels: Qloo's kidswear segment, not every "fashion" brand (watches, bike gear).
const KIDS = /\b(kids?|kidswear|children'?s?|childrenswear|child|baby|babies|babywear|toddlers?|infants?)\b/i;
const KIDS_BRANDS = { queries: ["kidswear", "kids fashion", "baby clothing"], match: /kid|child|baby|toddler|infant/i, kinds: /fashion_segment|category|brand/i };

async function formatFilters(q, format, input = {}) {
  const spec = { ...(CATEGORY_FILTERS[format] ?? {}) };
  if (format === "fashion" && KIDS.test(String(input.text ?? ""))) spec.brand = KIDS_BRANDS;
  const out = {};
  for (const [type, cfg] of Object.entries(spec)) out[type] = await categoryTags(q, type, cfg);
  return out;
}

export async function resolve(run) {
  const q = evidenceFor(run, "resolve");
  const input = run.input;
  const city = await resolveCity(q, run, input);
  const [contrast, theme, filters, ...loves] = await Promise.all([resolveContrast(q, run, city), resolveTheme(q, run, input), formatFilters(q, input.format, input), ...(input.loves ?? []).slice(0, 3).map((l) => resolveLove(q, run, l, city))]);
  const found = loves.filter(Boolean);
  if (!theme.tags.length && !found.length && (input.theme?.query || input.loves?.length)) {
    throw new Error("Qloo couldn't find that theme or those names. Try a genre word (crime, romance, nightlife) or an exact title.");
  }
  return {
    city,
    contrast,
    theme,
    filters,
    fashionTags: filters.brand ?? [],
    loves: found,
    label: `${city.name}, ${city.market ?? city.country}`,
    summary: `${city.name} (${city.market ?? city.country})${theme.tags.length ? ` · ${theme.tags.map((t) => t.name).join(", ")}` : ""}${found.length ? ` · ${found.map((l) => l.name).join(", ")}` : ""}${contrast ? ` · vs ${contrast.name}` : ""}`,
  };
}
