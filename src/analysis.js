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
  const key = loc.geohash ?? loc.id ?? name ?? (lat !== undefined ? `${lat.toFixed(2)},${lon.toFixed(2)}` : undefined);
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

const haversineKm = (a, b) => {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Percentile rank (0..1) of each point's `field` within its own heatmap. */
function percentiles(points, field = "affinity") {
  const sorted = [...points].sort((a, b) => a[field] - b[field]);
  const n = sorted.length;
  const map = new Map();
  sorted.forEach((p, i) => map.set(p.key, n === 1 ? 1 : i / (n - 1)));
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
  if (!culture.length) return [];
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
 * Brands that over-index with the wave's fans in a market, relative to that
 * market's baseline. lift > 0 means the wave pulls the brand up.
 */
export function brandLift(waveBrands = [], baselineBrands = []) {
  const baseRank = new Map(baselineBrands.map((b, i) => [b.entity_id ?? b.name, i]));
  const n = Math.max(baselineBrands.length, 1);
  return waveBrands.map((b, i) => {
    const id = b.entity_id ?? b.name;
    const inBaseline = baseRank.has(id);
    const baseIndex = inBaseline ? baseRank.get(id) : n + 5;
    return {
      id,
      name: b.name,
      affinity: num(b.affinity),
      popularity: num(b.popularity),
      rank: i + 1,
      baselineRank: inBaseline ? baseIndex + 1 : undefined,
      lift: round((baseIndex - i) / (n + 5)),
      waveSpecific: !inBaseline,
      image: b.properties?.image?.url ?? b.properties?.image,
      tags: b.tags,
    };
  });
}

/** Pick the tags most worth turning into design cues: drop pure media-format tags. */
export function styleTags(tags = []) {
  const skip = /^(tv|television|movie|film|series|show|streaming|drama series)$/i;
  return tags
    .filter((t) => t?.name && !skip.test(t.name))
    .map((t) => ({ id: t.id, name: t.name, type: t.type, affinity: num(t.affinity), popularity: num(t.popularity) }));
}
