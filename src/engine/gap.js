// Stage 3: the gap. Demand = flavour tags the city ranks higher than the
// country. Supply = recent titles that carry the theme AND that flavour, read
// with the city as the signal. Lanes = high demand, low supply.
import { demandLift, laneGap, tagPoints } from "../analysis.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { crowdIds, format, placeLabel, themeTagIds, thisYear } from "./common.js";

const TAKE = 30;
const SUPPLY_FLAVOURS = 8; // flavours that get a supply count (×2 are tried; the lanes are the top 3)

async function flavourRead(q, title, { type, tagIds, entityIds, where }) {
  const params = { "filter.type": "urn:tag", "signal.location.query": where, "filter.parents.types": `urn:entity:${type}`, take: TAKE };
  if (tagIds.length) params["signal.interests.tags"] = tagIds;
  else if (entityIds.length) params["signal.interests.entities"] = entityIds;
  const raw = await q.tryInsights(title, params);
  return tagPoints(raw ?? {});
}

/** The year an entity came out, from whichever field its type carries (films: release_year; podcasts and games: release_date; books: publication_year). */
export function yearOf(e) {
  const p = e?.properties ?? {};
  const n = Number(p.release_year ?? p.publication_year);
  if (Number.isFinite(n) && n > 1800) return n;
  const d = String(p.release_date ?? p.publication_date ?? "").slice(0, 4);
  const y = Number(d);
  return Number.isFinite(y) && y > 1800 ? y : undefined;
}

/** Words to the same stem, so "Biographical" (an affinity tag) meets "biography" (an entity tag). */
const stem = (name) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ical|ies|ing|ed|al|s|y)$/, "");

/**
 * Supply, read inside one response: the recent titles of this type that carry
 * the theme and that the city favours, with their own tags. A flavour's supply
 * is how many of those titles carry it. (Filtering by the flavour tag instead
 * returns nothing for most affinity tags: they are not entity tags.)
 */
async function supplyRead(q, { type, themeIds, flavours, where }) {
  const minYear = thisYear() - 4;
  const NOUN = { movie: "films", tv_show: "series", podcast: "podcasts", videogame: "games", book: "books" };
  const raw = await q.tryInsights(`The ${NOUN[type] ?? type} with the theme that ${where.split(",")[0]} favours, with their tags and years`, {
    "filter.type": `urn:entity:${type}`,
    "filter.tags": themeIds[0],
    "signal.location.query": where,
    take: 50,
  });
  const entities = raw?.results?.entities ?? [];
  if (!entities.length) return { supply: {}, sample: 0, recent: 0, minYear };
  const isRecent = (e) => (yearOf(e) ?? 0) >= minYear;
  const supply = {};
  for (const f of flavours) {
    const fs = stem(f.name);
    const matches = entities.filter((e) => (e.tags ?? []).some((t) => (t.tag_id ?? t.id) === f.id || stem(t.name) === fs));
    const recent = matches.filter(isRecent);
    // count = recent titles in the lane (what the gap weighs); total = the lane exists in this theme's catalogue at all.
    supply[f.id] = { id: f.id, name: f.name, count: recent.length, total: matches.length, titles: [...recent, ...matches.filter((e) => !isRecent(e))].slice(0, 6).map((e) => ({ name: e.name, year: yearOf(e), recent: isRecent(e) })) };
  }
  return { supply, sample: entities.length, recent: entities.filter(isRecent).length, minYear };
}

export async function gap(run) {
  const q = evidenceFor(run, "gap");
  const f = format(run);
  const r = run.stages.resolve.output;
  const type = f.types[0];
  const themeIds = themeTagIds(run);
  const entityIds = themeIds.length ? [] : crowdIds(run);
  const where = placeLabel(r.city);
  const country = r.city.market ?? r.city.country;

  const [cityTags, countryTags] = await Promise.all([
    flavourRead(q, `Flavours ${r.city.name} leans to (${type.replace("_", " ")} tags)`, { type, tagIds: themeIds, entityIds, where }),
    flavourRead(q, `Same flavours for ${country}`, { type, tagIds: themeIds, entityIds, where: country }),
  ]);
  const flavours = demandLift(cityTags, countryTags, { take: TAKE });
  for (const t of flavours) registerName(run, t.name, "tag", { id: t.id });

  const canCount = f.supply.includes(type) && themeIds.length > 0;
  const read = canCount ? await supplyRead(q, { type, themeIds, flavours: flavours.filter((x) => x.lift > 0).slice(0, SUPPLY_FLAVOURS * 2), where }) : { supply: {}, sample: 0 };
  const supply = read.supply;
  const themeNames = new Set((r.theme?.tags ?? []).map((t) => t.name.toLowerCase()));
  const notTheme = (t) => !themeIds.includes(t.id) && !themeNames.has(String(t.name).toLowerCase());
  // A lane must exist in the theme's catalogue at least once; a flavour no title carries is a taste, not a lane.
  const exists = (t) => !read.sample || (supply[t.id]?.total ?? 0) > 0;
  const candidates = flavours.filter(notTheme).filter(exists);
  const lanes = laneGap(candidates.length ? candidates : flavours.filter(notTheme), supply, { n: TAKE }).slice(0, 3);
  for (const lane of lanes) for (const t of lane.supplyTitles) registerName(run, t.name, type, {});
  // Demand-only when the catalogue read came back empty: say so rather than show zeros.
  if (canCount && !read.sample) for (const lane of lanes) Object.assign(lane, { supplyRead: false, supplyCount: undefined, fill: undefined, mode: "demand-only" });
  // What the country leans to that this city doesn't: country tags missing from the city's list, then city tags that rank well below.
  const cityNames = new Set(cityTags.map((t) => String(t.name).toLowerCase()));
  const seenAvoid = new Set();
  const avoid = [
    ...countryTags.filter((t) => t?.name && !cityNames.has(String(t.name).toLowerCase())).map((t, i) => ({ id: t.id, name: t.name, countryRank: countryTags.indexOf(t) + 1, cityRank: undefined, lift: -(TAKE - i) })),
    ...flavours.filter((x) => x.lift <= -3).sort((a, b) => a.lift - b.lift),
  ]
    .filter(notTheme)
    .filter((t) => !seenAvoid.has(String(t.name).toLowerCase()) && seenAvoid.add(String(t.name).toLowerCase()))
    .slice(0, 4);

  return {
    type,
    mode: canCount && read.sample ? "demand-and-supply" : "demand-only",
    supplySample: read.sample,
    supplyRecent: read.recent,
    supplyMinYear: read.minYear,
    flavours: flavours.filter(notTheme).slice(0, 12),
    lanes,
    avoid,
    coverage: cityTags.length === 0 ? "none" : cityTags.length < 10 ? "thin" : "ok",
    summary: lanes.length ? `Lane 1: ${lanes[0].name} (${r.city.name} #${lanes[0].cityRank} vs ${country} #${lanes[0].countryRank ?? "–"}${lanes[0].supplyRead ? `, ${lanes[0].supplyCount} recent of ${supply[lanes[0].id]?.total ?? 0} titles` : ", demand only"}).` : `No flavour ranks higher in ${r.city.name} than in ${country}.`,
  };
}
