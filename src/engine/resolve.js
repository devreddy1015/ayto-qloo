// Stage 1: everything the user typed, as Qloo knows it. A run never goes on
// with a city Qloo cannot place; a theme Qloo cannot tag is kept as plain
// words and the read falls back to the loves.
import { CANDIDATE_CITIES, COUNTRY_ALIASES, displayName, localityName, pickLocality } from "../cities.js";
import { CATEGORY_FILTERS } from "../formats.js";
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
  const hit = (countryPart && marketFor(countryPart) && pickLocality(hits, { query: cityPart, market: marketFor(countryPart) })) || pickCity(hits, cityPart, { wantedId: input.city?.id });
  if (!hit) throw new Error(`Qloo couldn't place “${cityPart}”. Try the city's common English name, with the country.`);
  const city = toCity(hit, countryPart && marketFor(countryPart));
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

async function resolveLove(q, run, love) {
  const args = { entity: love.name, ...(love.type ? { type: love.type } : {}) };
  let env = await q.tryTool(`Find “${love.name}” in Qloo`, "qloo_describe", args);
  if (env?.status === "needs_input") {
    const candidate = env.resolution?.issues?.[0]?.candidates?.[0];
    if (!candidate?.id) return undefined;
    env = await q.tryTool(`Use the closest match for “${love.name}”`, "qloo_describe", { entity: candidate.id });
  }
  const r = env?.results?.[0];
  if (!r?.entity_id) return undefined;
  const entity = { input: love.name, id: r.entity_id, name: r.name, type: String(r.subtype ?? r.type ?? love.type ?? "").replace(/^urn:entity:/, ""), popularity: r.popularity, image: r.properties?.image?.url ?? r.properties?.image, year: r.properties?.release_year };
  registerEntity(run, { ...entity, source: "describe" });
  registerName(run, entity.name, "love", { id: entity.id });
  return entity;
}

/**
 * Qloo's category tags for one slice of a broad type ("coffee brand", "cafe"), so a brand read
 * stays on labels and a place read on cafés. One receipt per query; only tags that look like
 * brand or place categories and match the format's pattern are kept.
 */
async function categoryTags(q, type, { queries, match }) {
  const found = new Map();
  for (const query of queries) {
    const env = await q.tryTool(`Find Qloo's ${type} categories (“${query}”)`, "qloo_find_tags", { query, limit: 10 });
    for (const t of env?.results ?? []) {
      const kind = `${t.type ?? ""} ${t.id ?? ""}`;
      if (t?.id && match.test(t.name ?? "") && /brand|category|place|cuisine|amenity|genre/i.test(kind)) found.set(t.id, { id: t.id, name: t.name, type: t.type });
    }
  }
  return [...found.values()].slice(0, 8);
}

async function formatFilters(q, format) {
  const spec = CATEGORY_FILTERS[format] ?? {};
  const out = {};
  for (const [type, cfg] of Object.entries(spec)) out[type] = await categoryTags(q, type, cfg);
  return out;
}

export async function resolve(run) {
  const q = evidenceFor(run, "resolve");
  const input = run.input;
  const city = await resolveCity(q, run, input);
  const [contrast, theme, filters, ...loves] = await Promise.all([resolveContrast(q, run, city), resolveTheme(q, run, input), formatFilters(q, input.format), ...(input.loves ?? []).slice(0, 3).map((l) => resolveLove(q, run, l))]);
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
