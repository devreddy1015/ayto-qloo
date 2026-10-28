// Stage: places this crowd goes inside the city, plus the neighbourhoods where
// the crowd's taste runs hottest (geohash cells snapped to Qloo's localities).
import { cleanPlaceName, heatPoints, liftPoints, snapCellsToPlaces } from "../analysis.js";
import { subLocalities } from "../cities.js";
import { evidenceFor, registerName } from "../pipeline/evidence.js";
import { crowdIds, placeLabel } from "./common.js";

export async function spots(run) {
  const q = evidenceFor(run, "spots");
  const r = run.stages.resolve.output;
  const signals = crowdIds(run);
  const where = placeLabel(r.city);
  const [venueEnv, heatRaw, subEnv] = await Promise.all([
    signals.length ? q.tryTool(`Places this crowd goes in ${r.city.name}`, "qloo_recommend", { target_type: "place", signals, filter_location: where, limit: 15 }) : Promise.resolve(undefined),
    signals.length ? q.tryInsights(`Where inside ${r.city.name} this taste runs hottest`, { "filter.type": "urn:heatmap", "signal.interests.entities": signals, "filter.location.query": where, "output.heatmap.boundary": "urn:geohash" }) : Promise.resolve(undefined),
    q.trySearch(`Neighbourhoods of ${r.city.name} that Qloo knows`, { query: r.city.name, type: "locality", take: 20 }),
  ]);
  const skipped = [];
  const venues = (venueEnv?.results ?? [])
    .filter((x) => x.name)
    .filter((x) => (cleanPlaceName(x.name) && !(/\b(hotel|hostel|lodge|resort|inn|suites)\b/i.test(x.name) && !/\b(bar|club|lounge|casino|rooftop|pub)\b/i.test(x.name))) || (skipped.push(x.name), false))
    .slice(0, 8)
    .map((x) => ({ id: x.entity_id, name: x.name, type: String(x.subtype ?? x.type ?? "").replace(/^urn:entity:/, ""), address: x.properties?.address, tags: (x.tags ?? []).slice(0, 3).map((t) => t.name) }));
  for (const v of venues) registerName(run, v.name, "place", { city: r.city.name });

  const cells = heatPoints(heatRaw ?? {});
  const named = cells.some((c) => c.name) ? cells : snapCellsToPlaces(cells, subLocalities(subEnv?.results, { city: r.city.name, market: r.city.market ?? r.city.country }), { radiusKm: 4 });
  const ranked = liftPoints(named).filter((p) => p.name && p.name.toLowerCase() !== r.city.name.toLowerCase()).sort((a, b) => b.lift - a.lift);
  const neighbourhoods = (ranked.filter((p) => p.lift > 0).length ? ranked.filter((p) => p.lift > 0) : ranked).slice(0, 4).map((p) => ({ name: p.name, lift: p.lift, lat: p.lat, lon: p.lon }));
  for (const n of neighbourhoods) registerName(run, n.name, "neighbourhood", { city: r.city.name });

  return { venues, neighbourhoods, skipped: skipped.slice(0, 8), cells: cells.length, coverage: !venues.length && !neighbourhoods.length ? "none" : venues.length + neighbourhoods.length < 4 ? "thin" : "ok", summary: `${venues.length} places, ${neighbourhoods.length} neighbourhoods${skipped.length ? `, ${skipped.length} junk names dropped` : ""}.` };
}
