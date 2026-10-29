// "Where should I make it?" The usual run answers "I'm making X in Y". A production house often asks the
// question before that: for this theme, which city has the widest open lane? This reads the same theme across a
// market's largest cities with one Qloo tag read each, and measures every city twice: against the country (lift)
// and against the median of the other cities in the set (specific lift). The cities are each other's controls, so
// a flavour every big city shares never counts as one city's lane. Supply is counted later, in the full run for
// the city the maker picks.
import { demandLift, median, tagPoints } from "../analysis.js";
import { CANDIDATE_CITIES, COUNTRY_ALIASES } from "../cities.js";
import { FORMATS } from "../formats.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { newId } from "../pipeline/store.js";
import { isNoise } from "./gap.js";
import { laneTypeFor, signalLocation, themeTagIdsFor } from "./common.js";
import { pickCity, resolveTheme, toCity } from "./resolve.js";
import { pickLocality } from "../cities.js";

const TAKE = 30;
const PEERS = 0.7;

/**
 * Lift over the peers: this city's lift minus the 70th percentile of the other cities' lifts for the same flavour
 * (a city that doesn't list it counts as no lift). Against the median, a flavour four of ten cities share still
 * looked like each one's own lane; against the 70th percentile it only counts when at most two others share it.
 */
export function peerLift(flavour, others = [], { take = TAKE, pct = PEERS } = {}) {
  if (!others.length) return undefined;
  const key = flavour.id ?? flavour.name;
  const absent = (flavour.countryRank ?? take + 1) - (take + 1);
  const lifts = others.map((m) => (m.has(key) ? m.get(key) : absent)).sort((a, b) => a - b);
  return Math.round(flavour.lift - lifts[Math.round(pct * (lifts.length - 1))]);
}
const lower = (s) => String(s ?? "").toLowerCase();

/** The market a sentence names ("…in India", "in the US"), else undefined. */
export function marketFrom(text) {
  const t = ` ${lower(text).replace(/[^a-zÀ-ɏ\s]/g, " ")} `;
  if (/\s(us|usa|america)\s/.test(t)) return "United States";
  if (/\s(uk|britain|england)\s/.test(t)) return "United Kingdom";
  for (const [market, aliases] of Object.entries(COUNTRY_ALIASES)) if (aliases.some((a) => t.includes(` ${a} `)) || t.includes(` ${lower(market)} `)) return market;
  return undefined;
}

/**
 * Rank a market's cities for one theme and format.
 * Returns the cities (with coordinates for the map) each with its own lanes, the flavours every city shares
 * (crowded, not a gap), and the receipts.
 */
export async function whereToMake({ format = "film", theme, market = "India", text = "" } = {}, { cities: n = 10 } = {}) {
  const f = FORMATS[format] ?? FORMATS.film;
  const run = { id: newId("w"), input: { format: f.id, theme: { query: theme }, text }, ledger: [], names: {}, entities: {}, events: [], stages: {} };
  const q = evidenceFor(run, "where");
  const resolved = await resolveTheme(q, run, run.input);
  if (!resolved.tags.length) throw new Error(`Qloo has no tag for “${theme}”. Try a genre word (crime, romance, nightlife).`);
  run.stages.resolve = { output: { theme: resolved } };
  const type = laneTypeFor(run, f.types);
  const tagIds = themeTagIdsFor(run, type);
  const names = (CANDIDATE_CITIES[market] ?? []).slice(0, n);
  if (names.length < 3) throw new Error(`AYTO doesn't have a city list for ${market} yet.`);

  // Every city as Qloo knows it (id for the read, coordinates for the map), in parallel.
  const places = (
    await Promise.all(
      names.map(async (name) => {
        const env = await q.trySearch(`Find ${name} among Qloo's localities`, { query: name, type: "locality", take: 6 });
        const hit = pickLocality(env?.results ?? [], { query: name, market }) ?? pickCity(env?.results ?? [], name);
        return hit ? toCity(hit, market) : undefined;
      }),
    )
  ).filter(Boolean);

  const read = (title, where) =>
    q.tryInsights(title, { "filter.type": "urn:tag", ...signalLocation(where), "filter.parents.types": `urn:entity:${type}`, "signal.interests.tags": tagIds, take: TAKE }).then((raw) => tagPoints(raw ?? {}));
  const [countryTags, ...cityTags] = await Promise.all([read(`What ${market} leans to for ${theme} (${type.replace("_", " ")} tags)`, market), ...places.map((p) => read(`What ${p.name} leans to for ${theme}`, p))]);
  if (!countryTags.length) throw new Error(`Qloo returned no ${theme} flavours for ${market}.`);

  const themeIds = new Set(tagIds);
  const themeNames = new Set(resolved.tags.map((t) => lower(t.name)));
  const keep = (t) => !themeIds.has(t.id) && !themeNames.has(lower(t.name)) && !isNoise(t.name);
  const lifts = cityTags.map((tags) => demandLift(tags, countryTags, { take: TAKE }).filter(keep));
  const maps = lifts.map((list) => new Map(list.map((x) => [x.id ?? x.name, x.lift])));

  const rows = places.map((p, i) => {
    if (!cityTags[i].length) return { ...pick(p), lanes: [], coverage: "none" };
    const others = maps.filter((_, j) => j !== i && cityTags[j].length);
    const lanes = lifts[i]
      .map((x) => {
        const specific = peerLift(x, others);
        const strength = specific === undefined ? x.lift : Math.min(x.lift, specific);
        return { id: x.id, name: x.name, cityRank: x.cityRank, countryRank: x.countryRank, lift: x.lift, specific, strength, scope: specific === undefined ? "unknown" : specific >= 8 ? "this city" : specific >= 3 ? "leans here" : "most cities" };
      })
      .filter((x) => x.strength >= 3)
      .sort((a, b) => b.strength - a.strength || a.cityRank - b.cityRank)
      .slice(0, 3);
    for (const l of lanes) registerName(run, l.name, "tag", { id: l.id });
    return { ...pick(p), lanes, coverage: cityTags[i].length < 10 ? "thin" : "ok" };
  });
  rows.sort((a, b) => (b.lanes[0]?.strength ?? -99) - (a.lanes[0]?.strength ?? -99));

  // Flavours most cities lean to: real taste, but crowded, so no one city's gap.
  const read_ = maps.filter((_, i) => cityTags[i].length);
  const counts = new Map();
  for (const m of read_) for (const [k, lift] of m) if (lift >= 5) counts.set(k, (counts.get(k) ?? 0) + 1);
  const byId = new Map(lifts.flat().map((x) => [x.id ?? x.name, x.name]));
  const shared = [...counts.entries()]
    .filter(([, c]) => read_.length >= 3 && c >= Math.ceil(read_.length / 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, c]) => ({ name: byId.get(k), cities: c, of: read_.length, medianLift: Math.round(median(read_.map((m) => m.get(k) ?? 0))) }));

  const top = rows[0];
  return {
    id: run.id,
    format: f.id,
    theme: resolved.query,
    themeTags: resolved.tags,
    market,
    type,
    cities: rows,
    shared,
    ledger: run.ledger.map(({ id, title, tool, args, status, count, ms, provenance, error }) => ({ id, title, tool, args, status, count, ms, provenance, error })),
    summary: top?.lanes?.length ? `${top.name} has the widest open lane for ${resolved.query} in ${market}: ${top.lanes[0].name} (+${top.lanes[0].lift} over ${market}, +${top.lanes[0].specific ?? "?"} over the other cities).` : `No city stands out for ${resolved.query} in ${market}.`,
  };
}

const pick = (p) => ({ id: p.id, name: p.name, state: p.state, lat: p.lat, lon: p.lon });
