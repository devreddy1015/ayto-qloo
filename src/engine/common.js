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
  place: ["urn:tag:category:place:", "urn:tag:genre:place:", "urn:tag:cuisine:qloo:", "urn:tag:culinary_style:qloo:", "urn:tag:amenity:qloo:", "urn:tag:interests:qloo:"],
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
    // Qloo's names can carry stray spaces (" Hip Hop" is the music genre), so names are compared loosely,
    // and of two tags with one name the one whose id is the word itself ("hip_hop", not "hiphop") goes first:
    // verified live, only that one filters Chennai's artists.
    const same = bySlug(w.candidates.filter((c) => looseName(c.name) === looseName(w.chosen.name)), w.word);
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
  // In the format's own type order, never the order the reads happened to finish in (that made the music change run to run).
  const cols = read?.columns ?? {};
  const rows = [...format(run).types.map((t) => cols[t]), ...Object.entries(cols).filter(([t]) => !format(run).types.includes(t)).map(([, c]) => c)].filter(Boolean).flatMap((c) => c.rows ?? []);
  const picked = [...rows.filter((r) => r.onlyHere), ...rows.filter((r) => !r.onlyHere && r.notCountry), ...rows].map((r) => r.id);
  const ids = [...new Set(picked)].slice(0, limit);
  if (ids.length) return ids;
  return (run.stages.resolve?.output?.loves ?? []).map((l) => l.id).filter(Boolean).slice(0, limit);
}

const looseName = (n) => String(n ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const KEYWORD = /^urn:tag:keyword:/;
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const bySlug = (list, word) => [...list].sort((a, b) => (String(a.id).split(":").pop() === slug(word) ? 0 : 1) - (String(b.id).split(":").pop() === slug(word) ? 0 : 1));

/**
 * The theme's tags that belong to a type's own families (not keywords, not another type's genre), one per word.
 * Empty when the theme has no tag of that kind: then a filter on that type would return nothing or the wrong thing.
 */
export function themeTagsInFamily(run, type, { strict = false } = {}) {
  const theme = run.stages.resolve?.output?.theme;
  const prefs = (TYPE_TAG_FAMILIES[type] ?? []).filter((p) => !KEYWORD.test(p));
  const ids = [];
  for (const w of theme?.byWord ?? []) {
    const same = bySlug(w.candidates.filter((c) => looseName(c.name) === looseName(w.chosen.name) || looseName(c.name) === looseName(w.word)), w.word);
    const hit = prefs.map((pre) => same.find((c) => c.id.startsWith(pre))).find(Boolean) ?? (strict ? undefined : prefs.map((pre) => w.candidates.find((c) => c.id.startsWith(pre))).find(Boolean));
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

/**
 * Alternative theme filters for one type, best first: option k takes each word's k-th tag of that type's
 * families (same name first, the word's own spelling first). The read tries them in turn, because the first
 * often filters nothing: for films "Cricket" as a Qloo genre returns no titles, the media keyword returns '83,
 * Ghoomer and Jersey (verified live).
 */
export function themeTagOptions(run, type, max = 5) {
  const theme = run.stages.resolve?.output?.theme;
  if (!theme?.byWord?.length) return [themeTagIds(run)].filter((o) => o.length);
  const prefs = TYPE_TAG_FAMILIES[type] ?? [];
  const never = NEVER_FOR[type] ?? [];
  const perWord = theme.byWord.map((w) => {
    const same = bySlug(w.candidates.filter((c) => looseName(c.name) === looseName(w.chosen.name) || looseName(c.name) === looseName(w.word)), w.word);
    const ordered = [...same, ...w.candidates.filter((c) => !same.includes(c))];
    const inFamily = prefs.flatMap((pre) => ordered.filter((c) => c.id.startsWith(pre)));
    const list = [...new Set(inFamily.map((c) => c.id))];
    if (!list.length && !never.some((n) => w.chosen.id.startsWith(n))) list.push(w.chosen.id);
    return list;
  });
  const options = [];
  for (let k = 0; k < max; k += 1) {
    const ids = [...new Set(perWord.map((list) => list[Math.min(k, list.length - 1)]).filter(Boolean))];
    if (ids.length && !options.some((o) => o.join() === ids.join())) options.push(ids);
  }
  return options;
}

/**
 * Which of a format's entity types the lanes are read on: the first whose own tag families hold the theme.
 * A street-food or nightlife reel reads place tags, a love reel film tags, a hip hop night music tags;
 * with no theme (or no type that holds it) the format's first type, as before.
 */
export function laneTypeFor(run, types) {
  if (!run.stages.resolve?.output?.theme?.byWord?.length) return types[0];
  // Strict: the tag must carry the theme's own name ("Startup" as a music subgenre is not "startups").
  return types.find((t) => themeTagsInFamily(run, t, { strict: true }).length) ?? types[0];
}

export const themeTagIds = (run) => (run.stages.resolve?.output?.theme?.tags ?? []).map((t) => t.id);
export const lovesIds = (run) => (run.stages.resolve?.output?.loves ?? []).map((l) => l.id).filter(Boolean);
export const thisYear = () => new Date().getFullYear();
