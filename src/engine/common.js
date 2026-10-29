// Shared helpers for the engine stages.
import { FORMATS } from "../formats.js";

export const format = (run) => FORMATS[run.input.format] ?? FORMATS.film;

/**
 * "Mumbai, Maharashtra, India": the location text for Qloo's signal_location / filter_location.
 * The state is there on purpose: Qloo resolves some bare "City, Country" strings to nothing for some
 * entity types ("Mumbai, India" returns zero artists and needs_input for places; the qualified form works).
 */
export const placeLabel = (p) => (p ? [p.name, p.state, p.market ?? p.country].filter(Boolean).join(", ") : "");

/** Location params for a raw Insights signal: the locality id when known (unambiguous), else the label. */
export const signalLocation = (p) => (typeof p === "string" ? { "signal.location.query": p } : p?.id && !String(p.id).startsWith("fake-") ? { "signal.location": p.id } : { "signal.location.query": placeLabel(p) });

// Which tag families work as a filter for each entity type, best first (verified live: a media genre tag
// returns no artists; music and Qloo genre tags do).
const TYPE_TAG_FAMILIES = {
  artist: ["urn:tag:genre:music:", "urn:tag:genre:qloo:", "urn:tag:subgenre:qloo:", "urn:tag:genre_category:qloo:"],
  movie: ["urn:tag:genre:qloo:", "urn:tag:genre:media:", "urn:tag:subgenre:qloo:", "urn:tag:theme:qloo:", "urn:tag:keyword:media:"],
  tv_show: ["urn:tag:genre:qloo:", "urn:tag:genre:media:", "urn:tag:subgenre:qloo:", "urn:tag:theme:qloo:", "urn:tag:keyword:media:"],
  person: ["urn:tag:genre:qloo:", "urn:tag:genre:media:"],
  book: ["urn:tag:genre:qloo:", "urn:tag:genre:book:", "urn:tag:subgenre:qloo:", "urn:tag:theme:qloo:", "urn:tag:genre:media:"],
  podcast: ["urn:tag:genre:podcast:", "urn:tag:genre:qloo:", "urn:tag:genre:media:", "urn:tag:theme:qloo:"],
  videogame: ["urn:tag:genre:videogame:", "urn:tag:genre:qloo:", "urn:tag:genre:media:", "urn:tag:theme:qloo:"],
  place: ["urn:tag:category:place:", "urn:tag:genre:place:", "urn:tag:cuisine:qloo:", "urn:tag:amenity:qloo:", "urn:tag:interests:qloo:"],
  brand: ["urn:tag:genre:brand:", "urn:tag:category:brand:", "urn:tag:interests:qloo:"],
};
const NEVER_FOR = { artist: ["urn:tag:genre:media:", "urn:tag:music:qloo:"] };

/** The theme's tag ids for one entity type: per word, the candidate of that type's family, else the word's default pick. */
export function themeTagIdsFor(run, type) {
  const theme = run.stages.resolve?.output?.theme;
  if (!theme?.byWord?.length) return themeTagIds(run);
  const prefs = TYPE_TAG_FAMILIES[type] ?? [];
  const never = NEVER_FOR[type] ?? [];
  const ids = [];
  for (const w of theme.byWord) {
    const same = w.candidates.filter((c) => c.name.toLowerCase() === w.chosen.name.toLowerCase());
    const pool = same.length ? same : w.candidates;
    const hit = prefs.map((pre) => pool.find((c) => c.id.startsWith(pre))).find(Boolean) ?? prefs.map((pre) => w.candidates.find((c) => c.id.startsWith(pre))).find(Boolean);
    const pick = hit ?? (never.some((n) => w.chosen.id.startsWith(n)) ? undefined : w.chosen);
    if (pick && !ids.includes(pick.id)) ids.push(pick.id);
  }
  return ids;
}

/** The entity ids that stand for "this crowd": what the city favours beyond the country, else the loves. */
export function crowdIds(run, { limit = 5 } = {}) {
  const read = run.stages.read?.output;
  const rows = Object.values(read?.columns ?? {}).flatMap((c) => c.rows ?? []);
  const picked = [...rows.filter((r) => r.onlyHere), ...rows.filter((r) => !r.onlyHere && r.notCountry), ...rows].map((r) => r.id);
  const ids = [...new Set(picked)].slice(0, limit);
  if (ids.length) return ids;
  return (run.stages.resolve?.output?.loves ?? []).map((l) => l.id).filter(Boolean).slice(0, limit);
}

export const themeTagIds = (run) => (run.stages.resolve?.output?.theme?.tags ?? []).map((t) => t.id);
export const lovesIds = (run) => (run.stages.resolve?.output?.loves ?? []).map((l) => l.id).filter(Boolean);
export const thisYear = () => new Date().getFullYear();
