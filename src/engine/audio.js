// Stage: artists this crowd favours in the city, vs the country. Reuses the
// read's artist column when the format already read artists.
import { tagName, threeColumns } from "../analysis.js";
import { evidenceFor, registerEntity, registerName } from "../pipeline/evidence.js";
import { qlooEntities } from "../qloo.js";
import { crowdIds, placeLabel } from "./common.js";
import { isNoise } from "./gap.js";
import { latinNames } from "./read.js";

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
    await latinNames(q, run, { artist: { type: "artist", rows } });
  }
  // Names a reader can't read (Qloo has no Latin alias for some) go after the readable ones.
  const readable = (x) => !/[^\u0000-\u024F\u1E00-\u1EFF\s\d\p{P}\p{S}]/u.test(String(x.name ?? ""));
  const ranked = [...rows.filter(readable), ...rows.filter((x) => !readable(x))];
  const shortlist = [...ranked.filter((x) => x.onlyHere || x.hiddenGem), ...ranked.filter((x) => !(x.onlyHere || x.hiddenGem))].slice(0, 6).map((x) => ({ id: x.id, name: x.name, why: x.hiddenGem ? "hidden gem: loved here, small everywhere" : x.onlyHere ? `favoured in ${r.city.name}, not nationally` : "favoured here and nationally", popularity: x.popularity, affinity: x.affinity, image: x.image }));
  const sound = await soundOf(q, shortlist);
  return { artists: rows.slice(0, 15), shortlist, sound, summary: `${shortlist.length} artist${shortlist.length === 1 ? "" : "s"}, ${rows.filter((x) => x.hiddenGem).length} hidden gem${rows.filter((x) => x.hiddenGem).length === 1 ? "" : "s"}.` };
}

// The shortlist's own tags on /entities (recommend results carry none): the genres, moods and instruments these
// artists share, ranked by how many of them carry each. The music tone (src/music.js) is described with these words,
// never with an artist's name.
const SOUND_FAMILIES = {
  genres: ["urn:tag:genre:qloo:", "urn:tag:subgenre:qloo:", "urn:tag:genre:music:"],
  moods: ["urn:tag:music:qloo:"],
  instruments: ["urn:tag:instrument:qloo:"],
};
// Qloo files these under instrument; the tone is instrumental, so they're left out.
const NOT_INSTRUMENTS = new Set(["vocals", "vocal", "voice", "singing", "dance", "rap"]);

async function soundOf(q, shortlist) {
  const ids = shortlist.map((a) => a.id).filter(Boolean);
  if (!ids.length) return undefined;
  const env = await q.tryStep("The shortlist's own genre, mood and instrument tags", "qloo api entities", { ids }, async () => ({ results: (await qlooEntities(ids)).results ?? [], provenance: { source: "Qloo API", endpoint: "/entities", requests: [{ method: "GET", path: "/entities", query: { entity_ids: ids } }] } }));
  const entities = env?.results ?? [];
  if (!entities.length) return undefined;
  const top = (prefixes, skip = new Set()) => {
    const seen = new Map(); // folded name -> { id, name, artists }
    for (const pre of prefixes) {
      for (const e of entities) {
        for (const t of e.tags ?? []) {
          const id = String(t.tag_id ?? t.id ?? "");
          const name = tagName(t.name);
          const key = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); // "Hip - Hop" is "Hip Hop"
          if (!id.startsWith(pre) || !key || isNoise(name, id) || skip.has(name.toLowerCase())) continue;
          if (!seen.has(key)) seen.set(key, { id, name, artists: new Set() });
          seen.get(key).artists.add(e.entity_id);
        }
      }
    }
    // Map order breaks ties: the first family, then the shortlist's own order.
    return [...seen.values()].sort((a, b) => b.artists.size - a.artists.size).slice(0, 5).map((x) => ({ id: x.id, name: x.name, artists: x.artists.size }));
  };
  const sound = { genres: top(SOUND_FAMILIES.genres), moods: top(SOUND_FAMILIES.moods), instruments: top(SOUND_FAMILIES.instruments, NOT_INSTRUMENTS), of: entities.length };
  return sound.genres.length || sound.moods.length || sound.instruments.length ? sound : undefined;
}
