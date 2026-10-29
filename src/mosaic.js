// The background mosaic: images of what a city favours, from a run's own Qloo
// reads. With no run, the newest finished showcases feed the home page. Qloo
// hosts the images; nothing is copied into the repo.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "./config.js";
import { loadRun, recentRuns } from "./pipeline/store.js";
import { SHOWCASES } from "./presets.js";
import { qlooSearch } from "./qloo.js";
import { rankTitleOptions } from "./engine/resolve.js";

// The home wall for an international audience: titles known worldwide, across the themes AYTO writes for
// (crime, romance, horror, science fiction, food, music, fashion). Each is found with Qloo's own search and
// shown with Qloo's image; a title Qloo can't find, or one below the "hit" bar, is simply left off.
// India keeps two global names here; its city runs still show their own picks on their own pages.
const WORLD_WALL = [
  ["movie", "Oppenheimer", 2023], ["movie", "Barbie", 2023], ["movie", "Dune: Part Two", 2024], ["movie", "Spider-Man: Across the Spider-Verse", 2023],
  ["movie", "Everything Everywhere All at Once", 2022], ["movie", "Parasite", 2019], ["movie", "Top Gun: Maverick", 2022], ["movie", "Joker", 2019],
  ["movie", "Interstellar", 2014], ["movie", "La La Land", 2016], ["movie", "Get Out", 2017], ["movie", "The Batman", 2022],
  ["movie", "Mad Max: Fury Road", 2015], ["movie", "Black Panther", 2018], ["movie", "RRR", 2022],
  ["tv_show", "Squid Game", 2021], ["tv_show", "Stranger Things", 2016], ["tv_show", "Money Heist", 2017], ["tv_show", "Wednesday", 2022],
  ["tv_show", "The Last of Us", 2023], ["tv_show", "Breaking Bad", 2008], ["tv_show", "Peaky Blinders", 2013], ["tv_show", "Narcos", 2015],
  ["tv_show", "Dark", 2017], ["tv_show", "The Bear", 2022], ["tv_show", "Succession", 2018], ["tv_show", "Shōgun", 2024],
  ["artist", "Taylor Swift"], ["artist", "BTS"], ["artist", "Bad Bunny"], ["artist", "Beyoncé"], ["artist", "The Weeknd"], ["artist", "Billie Eilish"],
  ["artist", "BLACKPINK"], ["artist", "Burna Boy"], ["artist", "Dua Lipa"], ["artist", "Rosalía"], ["artist", "Kendrick Lamar"], ["artist", "A.R. Rahman"],
];
const WALL_HIT = 0.85;
let worldPromise;
let worldAt = 0;

/** The world wall, resolved once a day through Qloo search (cached on disk), six searches at a time. */
export function worldWall() {
  if (worldPromise && Date.now() - worldAt < 24 * 3600e3) return worldPromise;
  worldAt = Date.now();
  worldPromise = (async () => {
    const out = new Array(WORLD_WALL.length);
    let next = 0;
    const worker = async () => {
      while (next < WORLD_WALL.length) {
        const i = next++;
        const [type, name, year] = WORLD_WALL[i];
        const env = await qlooSearch({ query: name, type, take: 5 }).catch(() => undefined);
        const best = rankTitleOptions(env?.results ?? [], { name, year })[0];
        if (best?.image && (best.popularity ?? 0) >= WALL_HIT) out[i] = { url: best.image, name: best.name, type, world: true };
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    // Films, series and artists woven together so no kind clumps on the wall.
    const by = (t) => out.filter((x) => x?.type === t);
    return seen(interleave([by("movie"), by("tv_show"), by("artist")]));
  })().catch(() => []);
  return worldPromise;
}

/** What the wall has right now: the world list if it is ready within a moment, else nothing yet. */
const worldNow = (ms = 1200) => Promise.race([worldWall(), new Promise((r) => setTimeout(() => r([]), ms))]);

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
  const world = await worldNow();
  // An international wall: world titles and fashion first; each showcase adds a little of its own city, and an
  // Indian showcase at most three tiles, so India is about one tile in ten on the home page.
  const local = pool.map((r) => mosaicFor(r).slice(0, r.stages?.resolve?.output?.city?.market === "India" ? 3 : 6));
  const wall = seen(interleave([world, fashion, world.slice(Math.ceil(world.length / 2))]));
  // City tiles go in one every tenth place from the tenth on, never in the first screenful.
  const cities = seen(interleave(local)).filter((t) => !wall.some((w) => w.url === t.url));
  const images = [...wall];
  cities.forEach((t, k) => images.splice(Math.min(images.length, 9 + k * 10), 0, t));
  return { runs: pool.map((r) => r.id), world: world.length, images: images.slice(0, limit) };
}
