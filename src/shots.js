// Shot deck: one storyboard frame per beat of a finished film brief, drawn on demand with the server's OpenAI key.
// Never a stage: a run never waits on it or fails because of it. Each frame's prompt comes from the beat (what happens,
// where), the city's look words, the palette and a shot line, with every Qloo name taken out, so the frames are
// original art. Real films appear only as the named references the check already traced to Qloo: no still from a real
// film (or from a site like ShotDeck) is ever fetched, copied or re-hosted.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { imageAvailable, scrub } from "./image.js";
import { chatJson, llmAvailable, redact } from "./llm.js";
import { isKnownName } from "./pipeline/evidence.js";

const BASE = () => String(process.env.OPENAI_IMAGE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const KEY = () => String(process.env.OPENAI_API_KEY ?? "").trim();
const MODELS = () => String(process.env.IMAGE_MODELS || "gpt-image-2.5-flare,gpt-image-2").split(",").map((m) => m.trim()).filter(Boolean);
// MAX_SHOT_DECKS_PER_DAY=0 switches the deck off while concept images stay on.
const MAX_PER_DAY = () => (String(process.env.MAX_SHOT_DECKS_PER_DAY ?? "").trim() === "" ? 15 : Number(process.env.MAX_SHOT_DECKS_PER_DAY));
export const shotsPerHour = () => Number(process.env.SHOT_DECKS_PER_IP_PER_HOUR || 3);
const MAX_FRAMES = 6;
// Two frames at a time: about a minute for six at low quality, and gentle on the account's image rate limit.
const AT_ONCE = 2;
const DIR = (runId) => join(config.cacheDir, "shots", runId);

const jobs = new Map(); // runId -> deck { status: "drawing" | "done" | "error", frames, model?, error?, at }
const day = { date: "", count: 0 };

export const shotsAvailable = () => imageAvailable() && MAX_PER_DAY() > 0;

/** Room left in today's deck budget; counts one when `take` is set. */
export function shotBudget({ take = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) Object.assign(day, { date: today, count: 0 });
  if (day.count >= MAX_PER_DAY()) return false;
  if (take) day.count += 1;
  return true;
}

const txt = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(txt).filter(Boolean).join(", ") : v && typeof v === "object" ? txt(v.name ?? v.title ?? v.text ?? "") : v == null ? "" : String(v));
const arr = (v) => (Array.isArray(v) ? v.flat(Infinity) : v === undefined || v === null || v === "" ? [] : [v]);
const same = (a, b) => Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * The frames a finished film run would get: one per beat (at most six), each with its shot line from the plan's camera
 * notes and the reference film to study for it. Undefined when the run isn't a film or its plan has no beats.
 */
export function shotPlan(run) {
  const w = run.stages?.write?.output;
  const plan = w?.plan;
  if (!plan || (run.input?.format ?? w.writer) !== "film") return undefined;
  const beats = arr(plan.beats).map((b) => (typeof b === "string" ? { what: b } : b)).filter((b) => b && typeof b === "object" && (txt(b.what) || txt(b.title))).slice(0, MAX_FRAMES);
  if (!beats.length) return undefined;
  const camera = plan.camera && typeof plan.camera === "object" ? plan.camera : {};
  const shots = arr(camera.shots).map((x) => (x && typeof x === "object" ? [txt(x.shot), txt(x.lens)].filter(Boolean).join(", ") : txt(x))).filter(Boolean);
  const lighting = arr(camera.lighting).map(txt).filter(Boolean);
  // Only titles a Qloo read returned: the check has pruned the rest already, and this holds even for an edited plan.
  const refs = arr(plan.references).map((r) => (r && typeof r === "object" ? { title: txt(r.title ?? r.name), borrow: txt(r.borrow ?? r.take) } : { title: txt(r), borrow: "" })).filter((r) => r.title && isKnownName(run, r.title));
  const venues = run.stages?.spots?.output?.venues ?? [];
  const characters = arr(plan.characters).filter((c) => c && typeof c === "object" && txt(c.name));
  return beats.map((b, i) => {
    const after = txt(b.after?.title ?? b.after);
    const reference = refs.find((r) => same(r.title, after)) ?? (after && isKnownName(run, after) ? { title: after, borrow: "" } : refs.length ? refs[i % refs.length] : undefined);
    const venue = venues.find((v) => same(v.name, txt(b.where?.name ?? b.where)));
    return {
      n: i + 1,
      title: txt(b.title) || `Beat ${i + 1}`,
      what: txt(b.what),
      who: arr(b.who).map(txt).filter(Boolean).map((name) => {
        const c = characters.find((x) => same(txt(x.name), name) || same(txt(x.name).split(" ")[0], name.split(" ")[0]));
        return [name, txt(c?.role), c?.look && `wearing ${txt(c.look)}`].filter(Boolean).join(", ");
      }),
      where: venue ? [arr(venue.tags).map(txt).filter(Boolean).slice(0, 2).join(", ").toLowerCase() || "a place this crowd goes", venue.area && `in ${venue.area}`].filter(Boolean).join(" ") : "",
      shot: [shots.length ? shots[i % shots.length] : "", lighting.length ? `Light: ${lighting[i % lighting.length]}` : ""].filter(Boolean).join(". "),
      reference,
    };
  });
}

/** One shot per beat from the server's model: size, lens, light, movement. Undefined when there's no model or it fails. */
async function shotLines(run, frames) {
  if (!llmAvailable()) return undefined;
  const plan = run.stages?.write?.output?.plan ?? {};
  const system = `You are a director of photography breaking a short film into shots. For each beat give one shot: its size (extreme wide, wide, medium, medium close-up, close-up, extreme close-up or insert), a lens in mm, the light and the camera movement, a few plain words each. Stay within the camera notes and the budget. Name no film, person, place or brand.
Return only JSON: {"shots":[{"beat":1,"size":"","lens":"","light":"","movement":""}]}`;
  const user = JSON.stringify({ city: run.stages?.resolve?.output?.city?.name, budget: run.input?.budget ?? "indie", look: plan.look, camera: plan.camera, beats: frames.map((f) => ({ beat: f.n, title: f.title, what: f.what })) });
  const out = await chatJson({ system, user, temperature: 0.4, maxTokens: 1200, deadline: Date.now() + 30000 });
  const list = arr(out?.shots).filter((s) => s && typeof s === "object");
  const lines = frames.map((f, i) => {
    const s = list.find((x) => Number(x.beat) === f.n) ?? list[i];
    return s ? [txt(s.size), txt(s.lens), txt(s.light), txt(s.movement)].map((x) => x.trim()).filter(Boolean).join(" · ").slice(0, 200) : "";
  });
  return lines.some(Boolean) ? lines : undefined;
}

/** The image prompt for one frame: the beat, the place, the shot, the look and the palette, with every Qloo name out. */
export function framePrompt(run, frame) {
  const plan = run.stages?.write?.output?.plan ?? {};
  const say = (s, n = 400) => scrub(s, run).slice(0, n);
  const city = run.stages?.resolve?.output?.city?.name ?? txt(run.input?.city?.query).split(",")[0];
  const lane = say(txt(plan.lane?.flavour ?? plan.lane)).toLowerCase();
  const look = (run.stages?.look?.output?.styles ?? []).filter((s) => s.lift > 0).slice(0, 4).map((s) => s.name);
  const palette = arr(plan.palette).map((c) => (c && typeof c === "object" ? [txt(c.name), /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : ""].filter(Boolean).join(" ") : txt(c))).filter(Boolean).slice(0, 6);
  return [
    `One storyboard frame from a ${lane ? `${lane} ` : ""}film set in ${city || "a city"}. Beat ${frame.n}, ${say(frame.title, 80)}: ${say(frame.what)}`,
    frame.where && `Where: ${say(frame.where, 240)}.`,
    frame.who.length && `In the frame: ${say(frame.who.join("; "), 300)}.`,
    frame.shot && `Shot: ${say(frame.shot, 240)}.`,
    look.length && `Visual style: ${say(look.join(", "))}.`,
    palette.length && `Colour palette: ${say(palette.join(", "))}.`,
    "A cinematic film still in a wide frame, photographic, as if from the finished film.",
    "No text, letters, numbers, logos, brand marks, signage, subtitles or watermarks anywhere in the image.",
    "Everyone in the frame is an invented character: no real, famous or recognisable person and no actor's likeness.",
    "Not a still from any real film, not a real venue, not a real product.",
  ].filter(Boolean).join(" ");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One frame from the image API: the first model the account can use; a rate limit waits and tries again. */
async function draw(prompt, models, timeoutMs) {
  let lastError = "The image model didn't answer.";
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let res;
      let json;
      try {
        res = await fetch(`${BASE()}/images/generations`, {
          method: "POST",
          headers: { authorization: `Bearer ${KEY()}`, "content-type": "application/json" },
          body: JSON.stringify({ model, prompt, size: "1536x1024", quality: "low", output_format: "jpeg", output_compression: 80, n: 1 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        json = await res.json().catch(() => ({}));
      } catch (error) {
        throw new Error(redact(error?.name === "TimeoutError" ? `${model} took too long.` : String(error?.message ?? error)));
      }
      if (res.ok) {
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) throw new Error(`${model} returned no image.`);
        return { buffer: Buffer.from(b64, "base64"), model };
      }
      const message = String(json?.error?.message ?? res.statusText ?? "");
      lastError = redact(`${model} ${res.status}: ${message}`).slice(0, 240);
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await sleep(Math.min(Number(res.headers.get("retry-after")) * 1000 || 6000 * (attempt + 1), 20000));
        continue;
      }
      // A model this account can't use: try the next. Anything else (a refused prompt, a bad key) won't change.
      if ([400, 403, 404].includes(res.status) && /model|access|verif|not found|does not exist/i.test(message)) break;
      throw new Error(lastError);
    }
  }
  throw new Error(lastError);
}

const fileOf = (runId, n) => join(DIR(runId), `${n}.jpg`);
const deckFile = (runId) => join(DIR(runId), "deck.json");

/** What the page sees of a deck: each frame's beat, shot line, reference and picture. */
function view(runId, deck) {
  return {
    status: deck.status,
    frames: deck.frames.map((f) => ({ n: f.n, title: f.title, shot: f.shot, reference: f.reference, status: f.status, ...(f.status === "done" ? { url: `/api/runs/${runId}/shots/${f.n}.jpg` } : {}), ...(f.error ? { error: f.error } : {}) })),
    ...(deck.model ? { model: deck.model } : {}),
    ...(deck.error ? { error: deck.error } : {}),
    ...(deck.status === "done" ? { download: `/api/runs/${runId}/shots.html` } : {}),
  };
}

/** Where the run's deck stands: drawing (frames arrive one by one), done, error, or none. */
export async function shotStatus(runId) {
  const deck = jobs.get(runId);
  if (deck) return { ...view(runId, deck), available: shotsAvailable() };
  try {
    const saved = JSON.parse(await readFile(deckFile(runId), "utf8"));
    return { ...view(runId, saved), available: shotsAvailable() };
  } catch {
    return { status: "none", available: shotsAvailable() };
  }
}

export const shotFile = (runId, n) => readFile(fileOf(runId, n));

/** Start drawing the run's deck (no-op while one is drawing). Resolves once it has started; callers needn't wait. */
export async function startShots(run, { timeoutMs = 120000 } = {}) {
  const current = jobs.get(run.id);
  if (current?.status === "drawing") return current;
  const frames = shotPlan(run);
  if (!frames) throw Object.assign(new Error("Only a finished film brief with beats gets a shot deck."), { status: 409 });
  const deck = { status: "drawing", at: Date.now(), frames: frames.map((f) => ({ n: f.n, title: f.title, shot: f.shot, reference: f.reference, status: "waiting" })) };
  jobs.set(run.id, deck);
  deck.done = (async () => {
    try {
      const lines = await shotLines(run, frames).catch(() => undefined);
      lines?.forEach((line, i) => line && (frames[i].shot = deck.frames[i].shot = line));
      await mkdir(DIR(run.id), { recursive: true });
      let models = MODELS();
      const one = async (i) => {
        deck.frames[i].status = "drawing";
        try {
          const { buffer, model } = await draw(framePrompt(run, frames[i]), models, timeoutMs);
          await writeFile(fileOf(run.id, frames[i].n), buffer);
          models = [model]; // later frames skip a model the account lacks
          deck.model = model;
          deck.frames[i].status = "done";
        } catch (error) {
          Object.assign(deck.frames[i], { status: "error", error: redact(String(error?.message ?? error)).slice(0, 240) });
        }
      };
      // The first frame alone finds the model this account can use; the rest follow two at a time.
      await one(0);
      let next = 1;
      await Promise.all(Array.from({ length: AT_ONCE }, async () => {
        while (next < frames.length) await one(next++);
      }));
      const drawn = deck.frames.some((f) => f.status === "done");
      Object.assign(deck, drawn ? { status: "done" } : { status: "error", error: deck.frames[0].error ?? "No frame could be drawn." });
      if (drawn) await writeFile(deckFile(run.id), JSON.stringify({ ...view(run.id, deck), title: deckTitle(run), city: run.stages?.resolve?.output?.city?.name }));
    } catch (error) {
      Object.assign(deck, { status: "error", error: redact(String(error?.message ?? error)).slice(0, 240) });
    }
  })();
  return deck;
}

const deckTitle = (run) => txt(run.publish?.page?.title) || txt(arr(run.stages?.write?.output?.plan?.titles)[0]) || "A film";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The whole deck as one HTML file with its frames inside: opens offline, prints to PDF, carries no scripts. */
export async function deckHtml(runId) {
  let deck;
  try {
    deck = JSON.parse(await readFile(deckFile(runId), "utf8"));
  } catch {
    return undefined;
  }
  const frames = [];
  for (const f of deck.frames ?? []) {
    let img = "";
    if (f.status === "done") img = await readFile(fileOf(runId, Number(f.n))).then((b) => `data:image/jpeg;base64,${b.toString("base64")}`).catch(() => "");
    frames.push(`<figure>${img ? `<img src="${img}" alt="Frame ${esc(f.n)}">` : `<div class="none">Not drawn</div>`}<figcaption><b>${esc(f.n)}. ${esc(f.title)}</b>${f.shot ? `<p>${esc(f.shot)}</p>` : ""}${f.reference?.title ? `<p class="ref">Study <i>${esc(f.reference.title)}</i>${f.reference.borrow ? `: ${esc(f.reference.borrow)}` : ""}</p>` : ""}</figcaption></figure>`);
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<title>${esc(deck.title)}: shot deck · AYTO</title>
<style>
body{margin:0;background:#0b0b0d;color:#eef0f7;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:2rem 1rem}
h1{margin:0 0 .3rem;font-size:2rem}.k{color:#f2be22;font-weight:700}.fine{color:#aab0c4;font-size:.85rem;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.2rem;margin-top:1.5rem}
figure{margin:0;break-inside:avoid}img,.none{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:8px;display:block;background:#1a1a1f}
.none{display:grid;place-items:center;color:#aab0c4}figcaption p{margin:.2rem 0;color:#c9cdda;font-size:.92rem}.ref i{color:#eef0f7}
@media print{body{background:#fff;color:#111}figcaption p,.ref i{color:#222}.fine{color:#444}}
</style></head><body><main>
<span class="k">Shot deck${deck.city ? ` · ${esc(deck.city)}` : ""}</span>
<h1>${esc(deck.title)}</h1>
<p class="fine">One storyboard frame per beat, drawn by OpenAI${deck.model ? ` (${esc(deck.model)})` : ""} from the brief AYTO wrote on Qloo taste signals. The frames are original: no real people, logos, venues or stills from real films. The films named are references to study, each traced to a Qloo request.</p>
<div class="grid">${frames.join("")}</div>
</main></body></html>`;
}

/** For tests: forget decks and today's count. */
export function resetShots() {
  jobs.clear();
  Object.assign(day, { date: "", count: 0 });
}
