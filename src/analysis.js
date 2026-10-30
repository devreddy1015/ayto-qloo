// Pure analysis helpers. No network, no LLM: everything here is deterministic
// so the numbers in a report can be traced back to Qloo responses.

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

// ---------- momentum (from /v2/trending series) ----------

// Field preference for a point's "how big is it right now" value. Higher is better.
const LEVEL_FIELDS = ["population_percentile", "percentile", "popularity", "value", "score"];
// Rank fields: lower is better, so they are negated.
const RANK_FIELDS = ["population_rank", "rank"];

function pointDate(point) {
  return point?.date ?? point?.day ?? point?.week ?? point?.timestamp ?? point?.time;
}

export function pointLevel(point) {
  for (const f of LEVEL_FIELDS) if (num(point?.[f]) !== undefined) return { value: point[f], field: f };
  for (const f of RANK_FIELDS) if (num(point?.[f]) !== undefined) return { value: -point[f], field: f };
  return undefined;
}

/**
 * Summarise one trend series into a direction the UI can show.
 * Compares the mean of the most recent third of points with the earliest third.
 */
export function momentum(points = []) {
  const series = points
    .map((p) => ({ date: pointDate(p), level: pointLevel(p) }))
    .filter((p) => p.level)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (series.length < 3) return { label: "unknown", change: undefined, series: [], field: undefined };

  const field = series[0].level.field;
  const values = series.map((p) => p.level.value);
  const third = Math.max(1, Math.floor(values.length / 3));
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const early = mean(values.slice(0, third));
  const late = mean(values.slice(-third));
  const span = Math.max(...values) - Math.min(...values) || Math.abs(early) || 1;
  const change = (late - early) / span; // -1..1, relative to the series' own range

  // Velocity fields, if Qloo returned them, are a better short-term signal.
  const last = points.at(-1) ?? {};
  const velocity = num(last.population_rank_velocity) ?? num(last.velocity) ?? undefined;

  let label = "steady";
  if (change > 0.25) label = "rising";
  else if (change < -0.25) label = "cooling";
  const peakIndex = values.indexOf(Math.max(...values));
  if (label === "steady" && peakIndex >= values.length - Math.max(2, third)) label = "peaking";

  return {
    label,
    change: Math.round(change * 100) / 100,
    velocity,
    field,
    series: series.map((p) => ({ date: p.date, value: p.level.value })),
  };
}

// ---------- heatmaps ----------

/** Normalise a Qloo heatmap point into { key, lat, lon, name, affinity, popularity }. */
export function heatPoint(point) {
  const loc = point?.location ?? point?.geo ?? {};
  const q = point?.query ?? point;
  const lat = num(loc.latitude) ?? num(loc.lat) ?? num(point?.latitude);
  const lon = num(loc.longitude) ?? num(loc.lon) ?? num(loc.lng) ?? num(point?.longitude);
  const name = loc.name ?? loc.city ?? loc.locality ?? point?.name ?? point?.entity?.name ?? point?.properties?.name ?? undefined;
  const key = loc.geohash ?? loc.id ?? name ?? (lat !== undefined && lon !== undefined ? `${lat.toFixed(2)},${lon.toFixed(2)}` : undefined);
  return {
    key,
    name,
    lat,
    lon,
    affinity: num(q?.affinity) ?? num(q?.affinity_score),
    affinityRank: num(q?.affinity_rank),
    popularity: num(q?.popularity),
  };
}

export function heatPoints(raw) {
  const list = raw?.results?.heatmap ?? raw?.heatmap ?? (Array.isArray(raw?.results) ? raw.results : []);
  return list.map(heatPoint).filter((p) => p.key !== undefined && p.affinity !== undefined);
}

/**
 * Give geohash cells names by snapping them to Qloo localities.
 *
 * Qloo's heatmap is a grid of unnamed cells. For each named place (a locality
 * Qloo returned, with its own coordinates) take the cells within radiusKm and
 * read the place as the strongest of them, affinity and popularity alike, so a
 * city is read from the cells around it rather than one lucky grid square.
 * Places with no cell nearby are dropped: no data, no claim. The result has the
 * heatPoint shape, keyed by the locality id, so both heatmaps of a market match
 * by key in cultureFashionGap.
 */
export function snapCellsToPlaces(cells = [], places = [], { radiusKm = 30 } = {}) {
  const grid = cells.filter((c) => c.lat !== undefined && c.lon !== undefined);
  return places
    .map((place) => {
      if (place?.lat === undefined || place?.lon === undefined) return undefined;
      const near = grid.filter((c) => haversineKm(c, place) <= radiusKm);
      if (!near.length) return undefined;
      const max = (field) => near.reduce((m, c) => (c[field] !== undefined && (m === undefined || c[field] > m) ? c[field] : m), undefined);
      return {
        key: place.id ?? place.name,
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        affinity: max("affinity"),
        affinityRank: max("affinityRank"),
        popularity: max("popularity"),
        cells: near.length,
      };
    })
    .filter((p) => p && p.affinity !== undefined);
}

/** Normalise a raw tag Insights response into { id, name, type, affinity, popularity }. */
export function tagPoints(raw) {
  const list = raw?.results?.tags ?? (Array.isArray(raw?.results) ? raw.results : []);
  return list
    .filter((t) => t?.name)
    .map((t) => ({ id: t.tag_id ?? t.id, name: tagName(t.name), type: t.subtype ?? t.type, affinity: num(t.query?.affinity) ?? num(t.affinity), popularity: num(t.popularity) }));
}

/** A tag's name for display: single spaces, and words capitalised when Qloo sent it all lower case ("underground  rap"). */
export function tagName(name) {
  const s = String(name ?? "").replace(/\s+/g, " ").trim();
  return s && s === s.toLowerCase() ? s.replace(/(^|\s)([a-z])/g, (m, a, c) => a + c.toUpperCase()) : s;
}

export const haversineKm = (a, b) => {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Percentile rank (0..1) of each point's `field` within its own heatmap; equal values share their average rank. */
function percentiles(points, field = "affinity") {
  const sorted = [...points].sort((a, b) => a[field] - b[field]);
  const n = sorted.length;
  const map = new Map();
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && sorted[j + 1][field] === sorted[i][field]) j += 1;
    const pct = n === 1 ? 1 : (i + j) / 2 / (n - 1);
    for (let k = i; k <= j; k += 1) map.set(sorted[k].key, pct);
    i = j + 1;
  }
  return map;
}

/**
 * Lift of a heatmap against its own popularity baseline.
 *
 * Qloo's heatmap affinity tracks raw popularity closely (where people live),
 * so a raw affinity ranking mostly lists big cities. Lift is the affinity
 * percentile minus the popularity percentile within the same response:
 * positive means this place cares about the signal more than its size predicts.
 * When popularity is missing, lift falls back to the affinity percentile.
 */
export function liftPoints(points) {
  const withPop = points.filter((p) => p.popularity !== undefined);
  const aff = percentiles(points, "affinity");
  const pop = withPop.length >= 3 ? percentiles(withPop, "popularity") : undefined;
  return points.map((p) => ({
    ...p,
    affinityPct: round(aff.get(p.key)),
    popularityPct: pop ? round(pop.get(p.key)) : undefined,
    lift: round(pop && pop.has(p.key) ? aff.get(p.key) - pop.get(p.key) : aff.get(p.key) - 0.5),
    baseline: pop && pop.has(p.key) ? "popularity" : "none",
  }));
}

/**
 * Culture–Fashion Gap for places inside one market.
 *
 * culture: heatmap points for the cultural wave.
 * fashion: heatmap points for the fashion brands that wave's fans favour.
 * Each side is first turned into lift (affinity vs the place's own popularity,
 * see liftPoints), so big cities don't win by size alone. Then
 *   gap = cultureLift − fashionLift
 *   high gap  → the culture is already there, the fashion hasn't followed (opportunity)
 *   near zero → both arrived together
 *   negative  → the fashion is ahead of the culture
 * Points are matched by key, or by distance when the two grids differ.
 */
export function cultureFashionGap(culture, fashion, { matchKm = 35 } = {}) {
  // No fashion read at all is no data, not "fashion hasn't arrived anywhere": no place is called an opportunity.
  if (!culture.length || !fashion?.length) return [];
  const c = liftPoints(culture);
  const f = liftPoints(fashion);
  const fashionByKey = new Map(f.map((p) => [p.key, p]));

  return c
    .map((cp) => {
      let fp = fashionByKey.get(cp.key);
      if (!fp && cp.lat !== undefined && f.length) {
        let best;
        for (const candidate of f) {
          if (candidate.lat === undefined) continue;
          const d = haversineKm(cp, candidate);
          if (d <= matchKm && (!best || d < best.d)) best = { d, p: candidate };
        }
        fp = best?.p;
      }
      const cultureLift = cp.lift;
      // A place missing from the fashion heatmap entirely: fashion hasn't registered there.
      const fashionLift = fp ? fp.lift : -0.5;
      const gap = cultureLift - fashionLift;
      return {
        key: cp.key,
        name: cp.name ?? fp?.name,
        lat: cp.lat,
        lon: cp.lon,
        culture: round(cp.affinityPct),
        fashion: round(fp?.affinityPct ?? 0),
        cultureLift: round(cultureLift),
        fashionLift: round(fashionLift),
        gap: round(gap),
        baseline: cp.baseline,
        cultureAffinity: cp.affinity,
        fashionAffinity: fp?.affinity,
        signal: gap >= 0.25 && cultureLift > 0 ? "opportunity" : gap <= -0.25 ? "fashion-ahead" : "in-step",
      };
    })
    .sort((a, b) => b.gap - a.gap || b.cultureLift - a.cultureLift);
}

const round = (v) => (v === undefined ? undefined : Math.round(v * 100) / 100);

// ---------- brands ----------

/**
 * Brands that over-index with the wave's fans, read inside one Qloo response.
 *
 * Qloo's brand affinity tracks global popularity closely (Nike, Puma and Rolex
 * come back for almost any signal), so the raw ranking mostly lists giants. As
 * with the heatmaps, lift is the affinity percentile minus the popularity
 * percentile within the same response: positive means these fans favour the
 * brand more than its size predicts (it rides the wave), negative means it is
 * big everywhere, near zero means in step. A baseline from a separate request
 * does not work: Qloo's location-only and tag-only brand lists live in another
 * part of the graph (designer labels) and share no names with the wave list.
 *
 * `pulledBy` names the wave entity that contributes most to a brand when the
 * response carries Qloo's explainability. Sorted by lift, Qloo's rank kept.
 */
export function brandLift(waveBrands = [], { waves = [], threshold = 0.15 } = {}) {
  const keyed = waveBrands.map((b, i) => ({ key: b.entity_id ?? b.name, b, i }));
  const aff = percentiles(keyed.map((x) => ({ key: x.key, affinity: num(x.b.affinity) ?? -x.i })), "affinity");
  const withPop = keyed.filter((x) => num(x.b.popularity) !== undefined);
  const pop = withPop.length >= 3 ? percentiles(withPop.map((x) => ({ key: x.key, popularity: num(x.b.popularity) })), "popularity") : undefined;
  const waveName = new Map(waves.map((w) => [w.id, w.name]));
  return keyed
    .map(({ key, b, i }) => {
      const affinityPct = aff.get(key);
      const popularityPct = pop?.get(key);
      const lift = popularityPct === undefined ? 0 : affinityPct - popularityPct;
      const signal = lift >= threshold ? "rides" : lift <= -threshold ? "giant" : "in-step";
      const scores = b.explainability?.["signal.interests.entities"];
      let pulledBy;
      if (Array.isArray(scores) && scores.length) {
        const top = scores.reduce((best, s) => ((num(s.score) ?? 0) > (num(best.score) ?? 0) ? s : best));
        const total = scores.reduce((sum, s) => sum + (num(s.score) ?? 0), 0);
        pulledBy = { id: top.entity_id, name: waveName.get(top.entity_id) ?? top.entity_id, share: total ? round(num(top.score) / total) : undefined };
      }
      return {
        id: key,
        name: b.name,
        affinity: num(b.affinity),
        popularity: num(b.popularity),
        rank: i + 1,
        affinityPct: round(affinityPct),
        popularityPct: round(popularityPct),
        lift: round(lift),
        signal,
        waveSpecific: signal === "rides",
        baseline: popularityPct === undefined ? "none" : "popularity",
        pulledBy,
        image: b.properties?.image?.url ?? b.properties?.image,
        tags: b.tags,
      };
    })
    .sort((a, b) => b.lift - a.lift || a.rank - b.rank);
}

/**
 * How much the location changed the brand list: the same request with and
 * without `signal_location`. On the first live runs 14 of 15 brands were
 * identical, so "localised" needs at least a fifth of the list to change.
 */
export function brandLocalisation(withLocation = [], withoutLocation = []) {
  const local = new Set(withLocation.map((b) => b.entity_id ?? b.name));
  const total = local.size;
  if (!total || !withoutLocation.length) return { total, shared: undefined, localised: undefined };
  const shared = withoutLocation.filter((b) => local.has(b.entity_id ?? b.name)).length;
  return { total, shared, localised: shared / total < 0.8 };
}

/** Pick the tags most worth turning into design cues: drop pure media-format tags. */
export function styleTags(tags = []) {
  const skip = /^(tv|television|movie|film|series|show|streaming|drama series)$/i;
  const seen = new Set();
  return tags
    .filter((t) => t?.name && !skip.test(t.name))
    .filter((t) => !seen.has(t.name.toLowerCase()) && seen.add(t.name.toLowerCase()))
    .map((t) => ({ id: t.id, name: t.name, type: t.type, affinity: num(t.affinity), popularity: num(t.popularity) }));
}

// ---------- AYTO: three-column reads, demand lift, lanes ----------

/** Normalise a Qloo recommend result into { id, name, type, affinity, popularity, year, image }. */
export function entityPoint(r) {
  // Prefer an English alias when Qloo's name is in another script (劉亦菲 → Liu Yifei).
  // An English alias first, else any alias in Latin script; the original name stays as qlooName.
  const latin = (v) => v && !/[^\u0000-\u024F\u1E00-\u1EFF\s\d\p{P}\p{S}]/u.test(v);
  const akas = r.properties?.akas ?? [];
  const en = !latin(String(r.name ?? "")) ? akas.find((a) => a?.language === "en" && latin(a.value))?.value ?? akas.find((a) => latin(a?.value))?.value : undefined;
  return {
    id: r.entity_id ?? r.id,
    name: en ?? r.name,
    qlooName: en ? r.name : undefined,
    type: String(r.subtype ?? r.type ?? "").replace(/^urn:entity:/, ""),
    affinity: num(r.affinity) ?? num(r.query?.affinity),
    popularity: num(r.popularity),
    year: num(r.properties?.release_year),
    image: r.properties?.image?.url ?? r.properties?.image,
    died: r.properties?.date_of_death || undefined,
  };
}

/**
 * Compare what a city favours with what the country and a contrast city favour.
 * All three lists come from the same request shape, so they are comparable.
 *   onlyHere   : in the city list, in neither of the other two
 *   notCountry : in the city list, not in the country list
 *   hiddenGem  : near the top on affinity while small on popularity
 * Raw affinity is never the sort key: the lists come back flat at the top.
 * Sort: onlyHere first, then hidden gems, then by affinity minus popularity.
 */
export function threeColumns(cityRaw = [], countryRaw = [], contrastRaw = [], { gemPopularity = 0.5, gemSlack = 0.06 } = {}) {
  const city = cityRaw.map(entityPoint).filter((e) => e.id && e.name);
  const country = new Set(countryRaw.map((r) => r.entity_id ?? r.id));
  const contrast = new Set(contrastRaw.map((r) => r.entity_id ?? r.id));
  const top = Math.max(...city.map((e) => e.affinity ?? 0), 0);
  // With no country list (the read failed or came back empty) nothing can be "not in the country".
  const baseline = countryRaw.length > 0;
  const rows = city.map((e, i) => {
    const notCountry = baseline ? !country.has(e.id) : false;
    const notContrast = contrastRaw.length ? !contrast.has(e.id) : undefined;
    const onlyHere = notCountry && notContrast !== false;
    const hiddenGem = e.affinity !== undefined && e.popularity !== undefined && e.affinity >= top - gemSlack && e.popularity <= gemPopularity;
    const edge = e.affinity !== undefined && e.popularity !== undefined ? round(e.affinity - e.popularity) : undefined;
    return { ...e, rank: i + 1, onlyHere, notCountry, notContrast, hiddenGem, edge };
  });
  const score = (r) => (r.onlyHere ? 2 : r.notCountry ? 1 : 0) + (r.hiddenGem ? 1.5 : 0) + (r.edge ?? 0);
  return rows.sort((a, b) => score(b) - score(a) || a.rank - b.rank);
}

/**
 * Demand lift of each flavour tag: how much higher it ranks for the city than
 * for the country, in rank positions. A tag missing from the country list
 * counts as one past the end. Positive = the city cares more than the country.
 */
export function demandLift(cityTags = [], countryTags = [], { take } = {}) {
  // No country list, no lift: every city tag would otherwise look far above a country that simply wasn't read.
  if (!countryTags.length) return [];
  const n = take ?? Math.max(cityTags.length, countryTags.length, 1);
  const countryRank = new Map(countryTags.map((t, i) => [t.id ?? t.name, i + 1]));
  return cityTags
    .filter((t) => t?.name)
    .map((t, i) => {
      const key = t.id ?? t.name;
      const cr = countryRank.get(key) ?? n + 1;
      return { id: t.id, name: t.name, type: t.type, affinity: t.affinity, cityRank: i + 1, countryRank: countryRank.has(key) ? cr : undefined, lift: cr - (i + 1) };
    })
    .sort((a, b) => b.lift - a.lift || a.cityRank - b.cityRank);
}

/**
 * Lanes: flavours the city wants more than the country, weighted by how little
 * recent supply carries them.
 *   demand = lift / n          (clamped 0..1)
 *   fill   = min(count, cap) / cap   (undefined when no supply read)
 *   gap    = demand × (1 − fill)      (demand alone when fill is undefined)
 * `supply` maps a flavour id to { count, titles }. Flavours with lift ≤ 0 are dropped.
 */
export function laneGap(flavours = [], supply = {}, { n = 30, cap = 10, minLift = 1 } = {}) {
  return flavours
    .filter((f) => f.lift >= minLift)
    .map((f) => {
      const s = supply[f.id];
      const demand = Math.min(1, Math.max(0, f.lift / n));
      const fill = s ? Math.min(s.count, cap) / cap : undefined;
      const gap = fill === undefined ? demand : demand * (1 - fill);
      return { ...f, demand: round(demand), fill: fill === undefined ? undefined : round(fill), gap: round(gap), supplyCount: s?.count, supplyTotal: s?.total, supplyTitles: s?.titles ?? [], supplyRead: Boolean(s), mode: s ? "demand-and-supply" : "demand-only" };
    })
    .sort((a, b) => b.gap - a.gap || b.lift - a.lift);
}

/** Average several audience skews (age, gender) into one, keeping the entity count. */
export function averageSkew(results = []) {
  const rows = results.map((r) => r?.query ?? r).filter((q) => q?.age || q?.gender);
  if (!rows.length) return undefined;
  // Each key over the picks that carry it: one pick without a gender read doesn't halve the others' skew.
  const avg = (key) => {
    const sum = {};
    const n = {};
    for (const r of rows) for (const [k, v] of Object.entries(r[key] ?? {})) if (num(v) !== undefined) {
      sum[k] = (sum[k] ?? 0) + v;
      n[k] = (n[k] ?? 0) + 1;
    }
    return Object.fromEntries(Object.keys(sum).map((k) => [k, round(sum[k] / n[k])]));
  };
  return { age: avg("age"), gender: avg("gender"), entities: rows.length };
}

// Short all-caps names that are real venues, not shouting.
const CAPS_BRANDS = /^(PVR(?: INOX)?|INOX|IMAX|AMC|BMS|MOMA|LACMA|SFMOMA|ICA|BFI|NFT|O2|HMV|KFC|IKEA|H&M|ZARA|UNIQLO|MUJI)\b/;

/** A place name worth printing: no phone numbers, emoji, shouting, punctuation stubs or two-letter names. */
export function cleanPlaceName(name) {
  const s = String(name ?? "").trim();
  if (s.length < 3 || s.length > 60) return false;
  if ((s.match(/\p{L}/gu) ?? []).length < 2) return false; // "...", "1234", "???"
  if (/^(n\/?a|null|undefined|unknown|none)$/i.test(s)) return false;
  if (/\d{5,}/.test(s)) return false; // phone numbers
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u.test(s)) return false; // emoji
  if (/^[^a-z]*$/.test(s) && /[A-Z]{4,}/.test(s) && !CAPS_BRANDS.test(s)) return false; // ALL CAPS
  // Homes, clinics and offices; a bank only as a branch or ATM ("Left Bank Bar" is a bar), a residency only as housing.
  if (/\b(ambulance|apartment|apartments|pvt|ltd|llc|inc\.?|hospital|clinic|atm)\b/i.test(s)) return false;
  if (/\bbank\b/i.test(s) && !/\b(bar|cafe|café|club|pub|kitchen|lounge|bistro|brewery|restaurant)\b/i.test(s)) return false;
  if (/\bresidency\b/i.test(s) && !/\b(club|hotel|bar|lounge|restaurant|cafe|café)\b/i.test(s)) return false;
  return true;
}

/**
 * Share lift of tag families between two tagged catalogues (the city's and the country's):
 * for each tag of the wanted families, the share of titles carrying it on each side, and the
 * difference in points. Two points ≈ one title at n = 50, so treat small lifts as noise.
 */
export function shareLift(cityEntities = [], countryEntities = [], { families = ["style"], minAbs = 4, top = 8 } = {}) {
  const count = (list) => {
    const out = {};
    for (const e of list) for (const t of e.tags ?? []) {
      const id = String(t.tag_id ?? t.id ?? "");
      const fam = id.match(/^urn:tag:([a-z_]+):qloo:/)?.[1];
      if (fam && families.includes(fam)) out[id] = { id, name: t.name, family: fam, n: (out[id]?.n ?? 0) + 1 };
    }
    return out;
  };
  // No country catalogue, no share lift: the city's shares alone would read as lifts.
  if (!cityEntities.length || !countryEntities.length) return { over: [], under: [], cityN: cityEntities.length, countryN: countryEntities.length };
  const c = count(cityEntities);
  const k = count(countryEntities);
  const nc = cityEntities.length || 1;
  const nk = countryEntities.length || 1;
  const rows = [...new Set([...Object.keys(c), ...Object.keys(k)])].map((id) => {
    const cityShare = Math.round(((c[id]?.n ?? 0) / nc) * 100);
    const countryShare = Math.round(((k[id]?.n ?? 0) / nk) * 100);
    return { id, name: (c[id] ?? k[id]).name, family: (c[id] ?? k[id]).family, cityShare, countryShare, lift: cityShare - countryShare };
  });
  const over = rows.filter((r) => r.lift >= minAbs).sort((a, b) => b.lift - a.lift || b.cityShare - a.cityShare).slice(0, top);
  const under = rows.filter((r) => r.lift <= -minAbs).sort((a, b) => a.lift - b.lift).slice(0, top);
  return { over, under, cityN: cityEntities.length, countryN: countryEntities.length };
}

/** Median of a list of numbers (0 for an empty list). */
export const median = (xs) => {
  const a = xs.filter((x) => typeof x === "number").sort((x, y) => x - y);
  return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 0;
};

/**
 * Specific lift of one flavour: the city's lift over the country minus the median of the same lift
 * in control cities. A control that does not list the flavour in its top `take` ranks it below the
 * list, so its lift is at most (country rank − (take + 1)); for a flavour the country does not list
 * either, that is 0. (Counting such a control as −(take + 1) would inflate every result by ~take.)
 */
export function specificLift(flavour, controlLifts = [], { take = 30 } = {}) {
  if (!controlLifts.length) return undefined;
  const key = flavour.id ?? flavour.name;
  const absent = (flavour.countryRank ?? take + 1) - (take + 1);
  const lifts = controlLifts.map((m) => (m.has(key) ? m.get(key) : absent));
  return Math.round(flavour.lift - median(lifts));
}
