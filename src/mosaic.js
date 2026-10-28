// The background mosaic: images of what a city favours, from a run's own Qloo
// reads. With no run, the newest finished showcases feed the home page. Qloo
// hosts the images; nothing is copied into the repo.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "./config.js";
import { loadRun, recentRuns } from "./pipeline/store.js";
import { SHOWCASES } from "./presets.js";

// Only well-known picks go on the wall: Qloo popularity (a 0..1 percentile) at or above these.
const HIT = { movie: 0.9, tv_show: 0.9, artist: 0.75, brand: 0.85, book: 0.85, podcast: 0.8, videogame: 0.85 };
const isHit = (type, popularity) => typeof popularity === "number" && popularity >= (HIT[type] ?? 1.01);

let curatedPromise;
/** Fashion editorial photos (Unsplash, free to use), read once from public/mosaic-curated.json. */
export function curated() {
  curatedPromise ??= readFile(join(ROOT, "public", "mosaic-curated.json"), "utf8")
    .then((text) => (JSON.parse(text).images ?? []).map((x) => ({ url: `https://images.unsplash.com/${x.id}?w=640&q=70&auto=format&fit=crop`, name: x.name, type: "fashion" })))
    .catch(() => []);
  return curatedPromise;
}

const seen = (list) => {
  const urls = new Set();
  return list.filter((x) => x?.url && !urls.has(x.url) && urls.add(x.url));
};

/** Image tiles from one run: the three-column reads, the audio shortlist, the spots. */
export function mosaicFor(run) {
  const read = run?.stages?.read?.output?.columns ?? {};
  const tiles = [];
  for (const [type, c] of Object.entries(read)) for (const row of c.rows ?? []) if (row.image && isHit(type, row.popularity)) tiles.push({ url: row.image, name: row.name, type, onlyHere: row.onlyHere, hiddenGem: row.hiddenGem });
  for (const a of run?.stages?.audio?.output?.shortlist ?? []) if (a.image && isHit("artist", a.popularity)) tiles.push({ url: a.image, name: a.name, type: "artist" });
  // At most eight of each kind per run, so one long artist list cannot crowd the wall.
  const perType = {};
  return seen(tiles).filter((t) => (perType[t.type] = (perType[t.type] ?? 0) + 1) <= 8);
}

/** Stable shuffle so the home page grid doesn't jump between requests. */
function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i += 1) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

export async function mosaic({ runId, limit = 60 } = {}) {
  const fashion = await curated();
  if (runId) {
    const run = await loadRun(runId);
    // The city's own hits, with fashion editorial shots woven in for texture (about one in three tiles).
    const own = mosaicFor(run);
    const woven = interleave([own, own, fashion.slice(0, Math.ceil(own.length / 2))]);
    return { run: run?.id, city: run?.stages?.resolve?.output?.city?.name, images: seen(woven).slice(0, limit) };
  }
  const runs = await recentRuns({ limit: 12 });
  const done = runs.filter((r) => r.stages?.read?.status === "done");
  const showcase = SHOWCASES.map((s) => done.find((r) => r.showcase === s.id)).filter(Boolean);
  const pool = showcase.length ? showcase : done.slice(0, 3);
  return { runs: pool.map((r) => r.id), images: seen(interleave([fashion, ...pool.map(mosaicFor)])).slice(0, limit) };
}
