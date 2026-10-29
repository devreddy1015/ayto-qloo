// Stage: artists this crowd favours in the city, vs the country. Reuses the
// read's artist column when the format already read artists.
import { threeColumns } from "../analysis.js";
import { evidenceFor, registerEntity, registerName } from "../pipeline/evidence.js";
import { crowdIds, placeLabel } from "./common.js";

export async function audio(run) {
  const q = evidenceFor(run, "audio");
  const r = run.stages.resolve.output;
  const fromRead = run.stages.read?.output?.columns?.artist;
  let rows;
  if (fromRead?.rows?.length >= 5) {
    rows = fromRead.rows;
  } else {
    const signals = crowdIds(run);
    if (!signals.length) return { artists: [], shortlist: [], summary: "No crowd to read artists for." };
    const [city, country] = await Promise.all([
      q.tryTool(`Artists this crowd favours in ${r.city.name}`, "qloo_recommend", { target_type: "artist", signals, signal_location: placeLabel(r.city), limit: 15 }),
      q.tryTool(`Same artists for ${r.city.market ?? r.city.country}`, "qloo_recommend", { target_type: "artist", signals, signal_location: r.city.market ?? r.city.country, limit: 15 }),
    ]);
    rows = threeColumns(city?.results ?? [], country?.results ?? [], []);
    for (const row of rows) {
      registerEntity(run, { id: row.id, name: row.name, type: "artist", source: "recommend" });
      registerName(run, row.name, "artist", { id: row.id });
    }
  }
  const shortlist = [...rows.filter((x) => x.onlyHere || x.hiddenGem), ...rows.filter((x) => !(x.onlyHere || x.hiddenGem))].slice(0, 6).map((x) => ({ id: x.id, name: x.name, why: x.hiddenGem ? "hidden gem: loved here, small everywhere" : x.onlyHere ? `favoured in ${r.city.name}, not nationally` : "favoured here and nationally", popularity: x.popularity, affinity: x.affinity, image: x.image }));
  return { artists: rows.slice(0, 15), shortlist, summary: `${shortlist.length} artist${shortlist.length === 1 ? "" : "s"}, ${rows.filter((x) => x.hiddenGem).length} hidden gem${rows.filter((x) => x.hiddenGem).length === 1 ? "" : "s"}.` };
}
