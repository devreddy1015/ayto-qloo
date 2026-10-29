// Stage 3: the gap. Demand = flavour tags the city ranks higher than the
// country. Supply = recent titles that carry the theme AND that flavour, read
// with the city as the signal. Lanes = high demand, low supply.
import { demandLift, laneGap, specificLift, tagPoints } from "../analysis.js";
import { CANDIDATE_CITIES } from "../cities.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { crowdIds, format, placeLabel, signalLocation, themeTagIdsFor, thisYear } from "./common.js";

const TAKE = 30;
const SUPPLY_FLAVOURS = 8; // flavours that get a supply count (×2 are tried; the lanes are the top 3)

async function flavourRead(q, title, { type, tagIds, entityIds, where }) {
  const params = { "filter.type": "urn:tag", ...signalLocation(where), "filter.parents.types": `urn:entity:${type}`, take: TAKE };
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

// Tag names that are placeholders in Qloo's graph, not flavours ("None" comes back as a theme for artists).
const JUNK_TAGS = new Set(["none", "other", "others", "unknown", "misc", "miscellaneous", "general", "n/a", "na", "various"]);
// Genres that travel with a theme: never tell a crime film to avoid thrillers, or a love story to avoid romance.
const SIBLINGS = {
  crime: ["thriller", "mystery", "detective", "police", "noir", "suspense", "heist", "gangster", "investigation", "procedural"],
  thriller: ["crime", "mystery", "suspense", "action"],
  mystery: ["crime", "thriller", "detective", "suspense"],
  love: ["romance", "romantic", "relationship", "relationships", "heartbreak", "love song", "love songs"],
  romance: ["love", "romantic", "relationship", "romcom", "rom com"],
  romantic: ["love", "romance"],
  horror: ["thriller", "supernatural", "slasher", "psychological"],
  comedy: ["humor", "humour", "funny", "sitcom", "satire", "romcom"],
  action: ["thriller", "martial arts", "adventure"],
  family: ["kids", "children", "parenting"],
  devotional: ["spiritual", "spirituality", "religious", "gospel", "bhakti"],
  "hip hop": ["rap", "hip-hop", "trap"],
  nightlife: ["club", "dance", "electronic", "party"],
};

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
  const raw = await q.tryInsights(`The ${NOUN[type] ?? type} with the theme that ${typeof where === "string" ? where.split(",")[0] : where.name} favours, with their tags and years`, {
    "filter.type": `urn:entity:${type}`,
    "filter.tags": themeIds[0],
    ...signalLocation(where),
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

/**
 * What the writer is told to steer away from: the country's flavours this city ranks lower, minus the ones
 * that are part of the theme itself. A flavour is part of the theme when a fifth or more of the city's themed
 * catalogue carries it (Thriller in a crime catalogue), when it is a known sibling genre of the theme word, or
 * when the maker said it (a "short film" is never told to avoid Short).
 */
export function avoidFrom(pool, { read = {}, supply = {}, siblings = [], said = [] } = {}) {
  const sib = new Set([...siblings].map(stem));
  const asked = new Set([...said].map(stem));
  const out = [];
  for (const t of pool) {
    const words = String(t.name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
    const share = read.sample ? (supply[t.id]?.total ?? 0) / read.sample : 0;
    if (share >= 0.2) t.why = `${Math.round(share * 100)}% of the themed catalogue carries it`;
    else if (words.some((w) => sib.has(w)) || sib.has(stem(t.name))) t.why = "part of the theme";
    else if (words.some((w) => asked.has(w))) t.why = "you asked for it";
    else {
      out.push(t);
      if (out.length === 4) break;
    }
  }
  return out;
}

export async function gap(run) {
  const q = evidenceFor(run, "gap");
  const f = format(run);
  const r = run.stages.resolve.output;
  const type = f.types[0];
  const themeIds = themeTagIdsFor(run, type);
  const entityIds = themeIds.length ? [] : crowdIds(run);
  const where = r.city;
  const country = r.city.market ?? r.city.country;

  const [cityTags, countryTags] = await Promise.all([
    flavourRead(q, `Flavours ${r.city.name} leans to (${type.replace("_", " ")} tags)`, { type, tagIds: themeIds, entityIds, where }),
    flavourRead(q, `Same flavours for ${country}`, { type, tagIds: themeIds, entityIds, where: country }),
  ]);
  const flavoursRaw = demandLift(cityTags, countryTags, { take: TAKE }).filter((t) => !JUNK_TAGS.has(String(t.name ?? "").trim().toLowerCase()));

  // Control cities: the country baseline behaves like its largest city, so a lift over the country is
  // often shared by every other big city. Read the same flavours for up to three controls and keep
  // "specific lift" = this city's lift minus the controls' median. Lanes rank on the specific lift.
  const lower = (x) => String(x ?? "").toLowerCase();
  const controls = (CANDIDATE_CITIES[country] ?? []).filter((n) => lower(n) !== lower(r.city.name) && lower(n) !== lower(r.contrast?.name) && !lower(r.city.qlooName).includes(lower(n))).slice(1, 4);
  const controlTags = await Promise.all(controls.map((name) => flavourRead(q, `Control city ${name}: the same flavours`, { type, tagIds: themeIds, entityIds, where: `${name}, ${country}` })));
  const controlLifts = controlTags.filter((t) => t.length).map((t) => new Map(demandLift(t, countryTags, { take: TAKE }).map((f) => [f.id ?? f.name, f.lift])));
  const flavours = flavoursRaw.map((f) => {
    const specific = specificLift(f, controlLifts, { take: TAKE });
    const scope = specific === undefined ? "unknown" : specific >= 8 ? "this city" : specific >= 3 ? "leans here" : "most cities";
    // A lane's strength is the smaller of its two signals: how far above the country, and how far above
    // comparable cities. Either one alone misleads (shared by every big city; or a country favourite the
    // controls happen not to list while this city is barely above the country).
    const strength = specific === undefined ? f.lift : Math.min(f.lift, specific);
    return { ...f, rawLift: f.lift, specific, strength, scope, controls: controls.slice(0, controlLifts.length) };
  });
  for (const t of flavours) registerName(run, t.name, "tag", { id: t.id });

  const themeNames = new Set((r.theme?.tags ?? []).map((t) => t.name.toLowerCase()));
  const notTheme = (t) => !themeIds.includes(t.id) && !themeNames.has(String(t.name).toLowerCase());
  // What the country leans to that this city doesn't: country tags missing from the city's list, then city tags that rank well below.
  const cityNames = new Set(cityTags.map((t) => String(t.name).toLowerCase()));
  const seenAvoid = new Set();
  const avoidPool = [
    ...countryTags.filter((t) => t?.name && !cityNames.has(String(t.name).toLowerCase())).map((t, i) => ({ id: t.id, name: t.name, countryRank: countryTags.indexOf(t) + 1, cityRank: undefined, lift: -(TAKE - i) })),
    ...flavours.filter((x) => x.lift <= -3).sort((a, b) => a.lift - b.lift),
  ]
    .filter(notTheme)
    .filter((t) => !JUNK_TAGS.has(String(t.name).trim().toLowerCase()))
    .filter((t) => !seenAvoid.has(String(t.name).toLowerCase()) && seenAvoid.add(String(t.name).toLowerCase()))
    .slice(0, 10)
    .map((t) => ({ ...t, name: String(t.name).trim() }));
  const themeWords = [...(r.theme?.words ?? []), ...(r.theme?.tags ?? []).map((t) => t.name)].map((w) => String(w).toLowerCase());
  const siblings = themeWords.flatMap((w) => SIBLINGS[w] ?? []);
  const said = String(run.input.text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

  const canCount = f.supply.includes(type) && themeIds.length > 0;
  // Supply is read for the flavours that can become lanes: the strongest, not merely the highest raw lift.
  const forSupply = [...flavours].filter((x) => x.strength > 0).sort((a, b) => b.strength - a.strength).slice(0, SUPPLY_FLAVOURS * 2);
  const read = canCount ? await supplyRead(q, { type, themeIds, flavours: [...forSupply, ...avoidPool.filter((a) => !forSupply.some((x) => x.id === a.id))], where }) : { supply: {}, sample: 0 };
  const supply = read.supply;
  // A lane must exist in the theme's catalogue at least once; a flavour no title carries is a taste, not a lane.
  // A lane must exist in the theme's catalogue at least once, unless the flavour is strongly specific to this
  // city (control cities do not share it): then zero supply is the open lane itself, and the card says so.
  const exists = (t) => !read.sample || (supply[t.id]?.total ?? 0) > 0 || t.strength >= 10;
  // Rank on strength when controls were read; a city with no strong flavour falls back to the raw lift.
  const specificOnes = flavours.filter(notTheme).filter(exists).filter((t) => typeof t.specific === "number" && t.strength >= 3).map((t) => ({ ...t, lift: t.strength }));
  const candidates = specificOnes.length ? specificOnes : flavours.filter(notTheme).filter(exists);
  const lanes = laneGap(candidates.length ? candidates : flavours.filter(notTheme), supply, { n: TAKE }).slice(0, 3).map((l) => ({ ...l, lift: l.rawLift ?? l.lift }));
  for (const lane of lanes) for (const t of lane.supplyTitles) registerName(run, t.name, type, {});
  // Demand-only when the catalogue read came back empty: say so rather than show zeros.
  if (canCount && !read.sample) for (const lane of lanes) Object.assign(lane, { supplyRead: false, supplyCount: undefined, fill: undefined, mode: "demand-only" });
  const avoid = avoidFrom(avoidPool, { read, supply, siblings, said });
  const avoidSkipped = avoidPool.filter((t) => t.why).slice(0, 4).map((t) => ({ name: t.name, why: t.why }));

  return {
    type,
    mode: canCount && read.sample ? "demand-and-supply" : "demand-only",
    supplySample: read.sample,
    supplyRecent: read.recent,
    supplyMinYear: read.minYear,
    flavours: flavours.filter(notTheme).slice(0, 12),
    lanes,
    avoid,
    avoidSkipped,
    coverage: cityTags.length === 0 ? "none" : cityTags.length < 10 ? "thin" : "ok",
    controls: controls.slice(0, controlLifts.length),
    summary: lanes.length ? `Lane 1: ${lanes[0].name} (${r.city.name} #${lanes[0].cityRank} vs ${country} #${lanes[0].countryRank ?? "–"}${typeof lanes[0].specific === "number" ? `, ${lanes[0].scope}` : ""}${lanes[0].supplyRead ? `, ${lanes[0].supplyCount} recent of ${supply[lanes[0].id]?.total ?? 0} titles` : ", demand only"}).` : `No flavour ranks higher in ${r.city.name} than in ${country}.`,
  };
}
