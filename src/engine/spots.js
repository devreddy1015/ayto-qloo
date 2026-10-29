// Stage: places this crowd goes inside the city, plus the neighbourhoods where
// the crowd's taste runs hottest (geohash cells named by their nearest Qloo
// locality), and a shoot base: the area where most of those places sit.
import { cleanPlaceName, haversineKm, heatPoints, liftPoints, snapCellsToPlaces } from "../analysis.js";
import { subLocalities } from "../cities.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { crowdIds, placeLabel } from "./common.js";

// Admin units Qloo lists among a city's localities: too big to shoot in, so never a neighbourhood.
const ADMIN = /\b(zone|mandal|district|division|metropolitan|region|municipal corporation|taluk|taluka|tehsil|circle|urban agglomeration)\b/i;
// Places Qloo lists that nobody can shoot in or visit as a crowd: homes, clinics, banks, missions.
const NOT_PUBLIC = /\b(apartment building|apartment complex|apartments|residential (building|complex|society)|housing society|gated community|hospital|clinic|pharmacy|bank branch|atm|consulate|embassy|office building|office space|coworking)\b/i;
const tidy = (name) => String(name ?? "").replace(/^ward\s*(no\.?\s*)?\d+\s*/i, "").replace(/\s+/g, " ").trim();
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The area a venue sits in: the last "<area> <City>" segment of its address, else Qloo's geocode name. */
export function areaOf(v, city) {
  const addr = String(v?.properties?.address ?? v?.address ?? "");
  const matches = [...addr.matchAll(new RegExp(`,\\s*([^,]+?),?\\s+${escapeRe(city)}\\b`, "gi"))];
  let area = matches.at(-1)?.[1]?.trim();
  if (area && (/\d/.test(area) || area.split(/\s+/).length > 4 || /\b(road|rd|floor|street|st|lane|plot|no)\b\.?$/i.test(area))) area = undefined;
  area ||= tidy(v?.properties?.geocode?.name);
  return area && area.toLowerCase() !== String(city).toLowerCase() && !ADMIN.test(area) ? area : undefined;
}

/** The shoot base: the area with the most of this crowd's places (two or more), so a unit can stay in one part of town. */
export function shootBase(venues = []) {
  const counts = new Map();
  venues.forEach((v, i) => {
    if (!v.area) return;
    const c = counts.get(v.area) ?? { name: v.area, venues: 0, first: i };
    c.venues += 1;
    counts.set(v.area, c);
  });
  const best = [...counts.values()].sort((a, b) => b.venues - a.venues || a.first - b.first)[0];
  return best && best.venues >= 2 ? { name: best.name, venues: best.venues, of: venues.length, places: venues.filter((v) => v.area === best.name).map((v) => v.name) } : undefined;
}

/**
 * Hot neighbourhoods from the heatmap: rank the cells themselves (affinity against the cell's own
 * popularity, cells with no popularity read are dropped as empty), then name each top cell by the
 * nearest small Qloo locality within 3 km. Snapping localities to their strongest cell instead makes
 * every large area tie at the top.
 */
export function hotNeighbourhoods(cells = [], places = [], { take = 4, radiusKm = 3 } = {}) {
  const small = places.filter((p) => p.lat !== undefined && !ADMIN.test(p.qlooName ?? p.name));
  if (!small.length) return [];
  const real = liftPoints(cells.filter((c) => c.lat !== undefined && (c.popularity ?? 0) > 0));
  const groups = new Map();
  for (const c of real.sort((a, b) => b.lift - a.lift).slice(0, 15)) {
    const near = small.map((p) => ({ p, d: haversineKm(c, p) })).filter((x) => x.d <= radiusKm).sort((a, b) => a.d - b.d)[0];
    if (!near) continue;
    const name = tidy(near.p.name);
    const g = groups.get(name) ?? { name, lift: c.lift, lat: near.p.lat, lon: near.p.lon, cells: 0 };
    g.cells += 1;
    g.lift = Math.max(g.lift, c.lift);
    groups.set(name, g);
  }
  return [...groups.values()].sort((a, b) => b.lift - a.lift).slice(0, take);
}

export async function spots(run) {
  const q = evidenceFor(run, "spots");
  const r = run.stages.resolve.output;
  const signals = crowdIds(run);
  const where = placeLabel(r.city);
  const [venueEnv, heatRaw, subEnv] = await Promise.all([
    signals.length ? q.tryTool(`Places this crowd goes in ${r.city.name}`, "qloo_recommend", { target_type: "place", signals, filter_location: where, limit: 15, ...(r.filters?.place?.length ? { include_tags: r.filters.place.map((t) => t.id) } : {}) }) : Promise.resolve(undefined),
    signals.length ? q.tryInsights(`Where inside ${r.city.name} this taste runs hottest`, { "filter.type": "urn:heatmap", "signal.interests.entities": signals, "filter.location.query": where, "output.heatmap.boundary": "urn:geohash" }) : Promise.resolve(undefined),
    q.trySearch(`Neighbourhoods of ${r.city.name} that Qloo knows`, { query: r.city.name, type: "locality", take: 20 }),
  ]);
  const skipped = [];
  const venues = (venueEnv?.results ?? [])
    .filter((x) => x.name)
    .filter((x) => (cleanPlaceName(x.name) && !(/\b(hotel|hostel|lodge|resort|inn|suites)\b/i.test(x.name) && !/\b(bar|club|lounge|casino|rooftop|pub)\b/i.test(x.name))) || (skipped.push(x.name), false))
    .filter((x) => !NOT_PUBLIC.test(String(x.properties?.short_description ?? x.properties?.description ?? "")) || (skipped.push(x.name), false))
    .slice(0, 8)
    .map((x) => {
      const p = x.properties ?? {};
      const price = Number(p.price_level);
      return {
        id: x.entity_id,
        name: x.name,
        type: String(x.subtype ?? x.type ?? "").replace(/^urn:entity:/, ""),
        address: p.address,
        area: areaOf(x, r.city.name),
        about: String(p.short_description ?? p.description ?? "").slice(0, 220) || undefined,
        price: Number.isFinite(price) && price > 0 ? price : undefined,
        rating: typeof p.business_rating === "number" ? p.business_rating : undefined,
        tags: (x.tags ?? []).slice(0, 3).map((t) => t.name),
      };
    });
  for (const v of venues) registerName(run, v.name, "place", { city: r.city.name });
  const base = shootBase(venues);
  if (base) registerName(run, base.name, "neighbourhood", { city: r.city.name });
  for (const v of venues) if (v.area) registerName(run, v.area, "neighbourhood", { city: r.city.name });

  const cells = heatPoints(heatRaw ?? {});
  const market = r.city.market ?? r.city.country;
  // Qloo's locality search for a big city lists only a handful of wards, so the areas the venues sit in are
  // looked up too: the heatmap can then be read for the very areas a unit would shoot in.
  const areas = [...new Set(venues.map((v) => v.area).filter(Boolean))].slice(0, 5);
  const areaHits = cells.length ? await Promise.all(areas.map((a) => q.trySearch(`Find ${a} among ${r.city.name}'s localities`, { query: a, type: "locality", take: 5 }))) : [];
  const areaPlaces = areaHits.flatMap((env, i) => subLocalities(env?.results, { city: r.city.name, market }).filter((p) => tidy(p.name).toLowerCase().includes(areas[i].toLowerCase())).slice(0, 1).map((p) => ({ ...p, name: areas[i] })));
  const places = [...areaPlaces, ...subLocalities(subEnv?.results, { city: r.city.name, market })];
  let neighbourhoods;
  if (cells.some((c) => c.name)) {
    neighbourhoods = liftPoints(cells).filter((p) => p.name && p.name.toLowerCase() !== r.city.name.toLowerCase()).sort((a, b) => b.lift - a.lift).slice(0, 4).map((p) => ({ name: p.name, lift: p.lift, lat: p.lat, lon: p.lon }));
  } else {
    neighbourhoods = hotNeighbourhoods(cells, places);
    if (!neighbourhoods.length) {
      // Too few small localities to name cells: the old read, admin zones left out.
      const ranked = liftPoints(snapCellsToPlaces(cells, places.filter((p) => !ADMIN.test(p.qlooName ?? p.name)), { radiusKm: 4 })).filter((p) => p.name && p.name.toLowerCase() !== r.city.name.toLowerCase()).sort((a, b) => b.lift - a.lift);
      neighbourhoods = (ranked.filter((p) => p.lift > 0).length ? ranked.filter((p) => p.lift > 0) : ranked).slice(0, 4).map((p) => ({ name: tidy(p.name), lift: p.lift, lat: p.lat, lon: p.lon }));
    }
  }
  for (const n of neighbourhoods) registerName(run, n.name, "neighbourhood", { city: r.city.name });

  return {
    venues,
    neighbourhoods,
    base,
    skipped: skipped.slice(0, 8),
    cells: cells.length,
    coverage: !venues.length && !neighbourhoods.length ? "none" : venues.length + neighbourhoods.length < 4 ? "thin" : "ok",
    summary: `${venues.length} places, ${neighbourhoods.length} neighbourhoods${base ? `; shoot base ${base.name} (${base.venues} of ${base.of} places)` : ""}${skipped.length ? `, ${skipped.length} junk or private places dropped` : ""}.`,
  };
}
