// Stage: where this taste travels next. Heatmap of the city's own picks across
// the country, cells snapped to Qloo's localities, lift against popularity.
// Fashion adds the culture-vs-brands gap from the first build.
import { cultureFashionGap, heatPoints, liftPoints, snapCellsToPlaces } from "../analysis.js";
import { CANDIDATE_CITIES, pickLocality, toPlace } from "../cities.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { qlooSearch } from "../qloo.js";
import { crowdIds, format } from "./common.js";

/** The market's cities as Qloo knows them: one receipt listing every locality search. */
export async function marketPlaces(q, run, market, extra = []) {
  const names = [...new Set([...extra, ...(CANDIDATE_CITIES[market] ?? [])])];
  if (!names.length) return [];
  const env = await q.tryStep(`Find ${market}'s cities in Qloo (${names.length} locality searches)`, "qloo api search", { type: "locality", take: 6, queries: names.length }, async () => {
    const hits = await Promise.all(names.map((name) => qlooSearch({ query: name, type: "locality", take: 6 }).then((x) => pickLocality(x?.results, { query: name, market })).catch(() => undefined)));
    const seen = new Set();
    return { results: hits.filter((h) => h && !seen.has(h.entity_id) && seen.add(h.entity_id)).map((h) => toPlace(h, market)), provenance: { source: "Qloo API", endpoint: "/search", requests: names.map((name) => ({ method: "GET", path: "/search", query: { query: name, types: "urn:entity:locality", take: 6 } })) } };
  });
  const places = env?.results ?? [];
  for (const p of places) {
    registerName(run, p.name, "city", { id: p.id, market });
    if (p.qlooName && p.qlooName !== p.name) registerName(run, p.qlooName, "city", { id: p.id, market });
  }
  return places;
}

async function heat(q, title, ids, market, places) {
  const raw = await q.tryInsights(title, { "filter.type": "urn:heatmap", "signal.interests.entities": ids, "filter.location.query": market, "output.heatmap.boundary": "urn:geohash" });
  const cells = heatPoints(raw ?? {});
  return { cells: cells.length, points: cells.some((c) => c.name) ? cells : snapCellsToPlaces(cells, places, { radiusKm: 30 }) };
}

export async function travels(run) {
  const q = evidenceFor(run, "travels");
  const r = run.stages.resolve.output;
  const market = r.city.market;
  if (!market) return { cities: [], coverage: "none", summary: `No city list for ${r.city.country}; the map is skipped.` };
  const ids = crowdIds(run);
  if (!ids.length) return { cities: [], coverage: "none", summary: "No crowd to map." };
  const places = await marketPlaces(q, run, market, [r.city.name]);
  const culture = await heat(q, `Where this taste runs hot across ${market}`, ids, market, places);
  const lifted = liftPoints(culture.points).sort((a, b) => b.lift - a.lift);
  const home = lifted.find((p) => p.name?.toLowerCase().includes(r.city.name.toLowerCase().split(" ")[0]));
  let gap;
  if (format(run).id === "fashion") {
    const brands = (run.stages.read?.output?.columns?.brand?.rows ?? []).filter((b) => b.onlyHere || b.hiddenGem).slice(0, 5).map((b) => b.id);
    if (brands.length) {
      const fashion = await heat(q, `Where those brands have landed across ${market}`, brands, market, places);
      gap = cultureFashionGap(culture.points, fashion.points).slice(0, 20);
    }
  }
  const cities = lifted.slice(0, 8).map((p) => ({ name: p.name, lift: p.lift, affinityPct: p.affinityPct, popularityPct: p.popularityPct, lat: p.lat, lon: p.lon, home: p === home }));
  return { market, cells: culture.cells, places: places.length, home: home ? { name: home.name, lift: home.lift } : undefined, cities, points: lifted.slice(0, 40).map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, lift: p.lift })), gap, coverage: lifted.length === 0 ? "none" : lifted.length < 8 ? "thin" : "ok", summary: cities.length ? `Leans the same way: ${cities.filter((c) => !c.home).slice(0, 4).map((c) => c.name).join(", ")}.` : "No city-level read." };
}
