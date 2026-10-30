// Music tones: one short original instrumental cue composed from a finished run's music taste, on demand, with the
// server's Gemini key (Google's Lyria 3 Clip: 30 seconds, MP3). Never a stage: a run never waits on it or fails because
// of it. The prompt is built from what Qloo read (the genres, moods and instruments the audio shortlist's artists carry,
// the gap's lanes, the look words), the city and the brief's own mood, with every Qloo name taken out: genre, tempo,
// mood and instruments only, never an artist, a song or "in the style of".
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config } from "./config.js";
import { scrub } from "./image.js";
import { redact } from "./llm.js";

const BASE = () => String(process.env.MUSIC_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
const KEY = () => String(process.env.GEMINI_API_KEY ?? "").trim();
// Lyria 3 Clip is Google's 30-second music model on the Gemini API (paid tier, $0.04 a clip, 31 Oct 2026).
const MODEL = () => String(process.env.MUSIC_MODEL || "lyria-3-clip-preview").trim();
const MAX_PER_DAY = () => Number(process.env.MAX_MUSIC_PER_DAY || 40);
const DIR = () => resolve(config.cacheDir, "music");

const jobs = new Map(); // runId -> { status: "composing" | "done" | "error", error?, model?, at }
const day = { date: "", count: 0 };

// A key with no Lyria quota (no billing on its project: "429 … limit: 0") turns music off for the rest of the day,
// so visitors never meet Google's quota message. Billing switched on brings it back after a restart or at midnight UTC.
const blocked = { date: "" };
const today = () => new Date().toISOString().slice(0, 10);
export const MUSIC_UNAVAILABLE = "Music isn't available on this site right now.";
export const musicBlocked = () => blocked.date === today();
const noQuota = (status, message) => [403, 429].includes(status) && /limit:\s*0\b|free.?tier|billing/i.test(message);

export const musicAvailable = () => KEY().length >= 20 && !musicBlocked();

/** Room left in today's music budget; counts one when `take` is set. */
export function musicBudget({ take = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) Object.assign(day, { date: today, count: 0 });
  if (day.count >= MAX_PER_DAY()) return false;
  if (take) day.count += 1;
  return true;
}

// What the cue is for and how it moves, per format: a reel's opener and a café's background are different jobs.
const ROLE = {
  film: ["the opening-titles cue for a short film", "unhurried, building slowly", 80],
  reel: ["the background track for a vertical reel", "upbeat, with a hook in the first two seconds", 120],
  fashion: ["the runway and lookbook track for a fashion drop", "a steady walking pulse", 118],
  podcast: ["the intro theme for a podcast", "warm, settling under a voice", 95],
  game: ["the title-screen loop for an indie game", "mid-tempo and loopable", 110],
  cafe: ["the background music for a café", "relaxed and unobtrusive", 85],
  event: ["the opening track of a live night", "high energy, building", 124],
  book: ["the trailer cue for a book", "slow and atmospheric", 70],
};
// The brief's own line that carries its mood, per format.
const MOOD = { film: (p) => p.theme || p.logline, reel: (p) => p.hook, fashion: (p) => p.positioning, podcast: (p) => p.premise, game: (p) => p.pitch, cafe: (p) => p.concept, event: (p) => p.concept, book: (p) => p.premise || p.logline };
const txt = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(txt).filter(Boolean).join(", ") : v && typeof v === "object" ? txt(v.text ?? v.line ?? "") : v == null ? "" : String(v));

/** The music prompt for a finished run. Returns undefined when the run has nothing written to compose from. */
export function musicPrompt(run) {
  const w = run.stages?.write?.output;
  const plan = w?.plan;
  if (!plan) return undefined;
  const format = run.input?.format ?? w.writer ?? "film";
  const city = run.stages?.resolve?.output?.city?.name ?? txt(run.input?.city?.query).split(",")[0];
  const say = (s) => scrub(s, run);
  // Every word from the run goes through scrub(), so a tag that shares a name with a title or an artist drops out.
  const words = (list, n) => (list ?? []).map((t) => say(t?.name ?? t)).filter(Boolean).slice(0, n);
  const sound = run.stages?.audio?.output?.sound ?? {};
  // Qloo has sung genres ("Playback Singing"); an instrumental leaves those out rather than contradict itself.
  const genres = words((sound.genres ?? []).filter((t) => !/sing|vocal|choir|cappella|karaoke|spoken/i.test(t?.name ?? "")), 4);
  const moods = words(sound.moods, 3);
  const instruments = words(sound.instruments, 4);
  const lanes = words(run.stages?.gap?.output?.lanes, 2);
  const look = words((run.stages?.look?.output?.styles ?? []).filter((s) => s.lift > 0), 3);
  const mood = say(txt(MOOD[format]?.(plan))).slice(0, 300);
  const [role, pace, bpm] = ROLE[format] ?? ROLE.film;
  const lower = (list) => list.join(", ").toLowerCase();
  const parts = [
    `A 30-second original instrumental piece: ${role}${city ? ` set in ${say(city)}` : ""}.`,
    genres.length && `Genres: ${genres.join(", ")}.`,
    moods.length && `Feel: ${lower(moods)}.`,
    instruments.length ? `Lead instruments: ${lower(instruments)}.` : "Instruments that suit those genres.",
    lanes.length && `Theme: ${lower(lanes)}.`,
    look.length && `Visual style it plays under: ${lower(look)}.`,
    mood && `Mood: ${mood.replace(/[.!?]*$/, ".")}`,
    `Tempo: ${pace}, around ${bpm} BPM.`,
    "Instrumental only: no vocals, no singing, no lyrics, no spoken words.",
    "Original music with a clear opening and a clean ending. Not in the style of any named artist, and no melody, hook or sample from an existing song.",
  ];
  return { prompt: parts.filter(Boolean).join(" "), format, basis: { genres, moods, instruments, lanes, look } };
}

/** The audio in a Gemini answer: generateContent's inlineData part, or an Interactions step's audio block. */
export function audioOf(json) {
  for (const part of (json?.candidates ?? []).flatMap((c) => c?.content?.parts ?? [])) {
    const d = part?.inlineData ?? part?.inline_data;
    if (d?.data && /^audio\//.test(d.mimeType ?? d.mime_type ?? "audio/")) return d.data;
  }
  for (const step of json?.steps ?? []) for (const c of step?.content ?? []) if (c?.type === "audio" && c.data) return c.data;
  return undefined;
}

// Lyria 3 Clip answers MP3; a WAV (RIFF header) is kept as WAV so the browser is told the truth.
const extOf = (bytes) => (bytes.subarray(0, 4).toString("latin1") === "RIFF" ? "wav" : "mp3");
const fileOf = (runId, ext) => join(DIR(), `${runId}.${ext}`);
// What was asked for the tone, kept beside it so the page can show the exact prompt and what it was built from.
const askOf = (runId) => join(DIR(), `${runId}.json`);

/** The run's music file on disk, if there is one: { path, ext }. */
export async function musicFile(runId, ext) {
  for (const e of ext ? [ext] : ["mp3", "wav"]) {
    try {
      if ((await stat(fileOf(runId, e))).isFile()) return { path: fileOf(runId, e), ext: e };
    } catch {}
  }
  return undefined;
}

/** Where the run's music tone stands: composing, done (with its file), error, or none. */
export async function musicStatus(runId) {
  const job = jobs.get(runId);
  if (job?.status === "done" || !job) {
    const file = await musicFile(runId);
    if (file) {
      const asked = await readFile(askOf(runId), "utf8").then(JSON.parse).catch(() => ({}));
      return { status: "done", url: `/api/runs/${runId}/music.${file.ext}`, model: job?.model ?? asked.model, prompt: asked.prompt, basis: asked.basis };
    }
    if (!job) return { status: "none" };
  }
  return { status: job.status, ...(job.error ? { error: job.error } : {}), ...(job.unavailable ? { unavailable: true } : {}) };
}

/** Start composing the run's music tone (no-op if one is composing). Resolves when the job starts; callers needn't wait. */
export async function startMusic(run, { timeoutMs = 150000 } = {}) {
  const current = jobs.get(run.id);
  if (current?.status === "composing") return current;
  const ask = musicPrompt(run);
  if (!ask) throw Object.assign(new Error("This run has nothing written to compose from yet."), { status: 409 });
  const job = { status: "composing", at: Date.now() };
  jobs.set(run.id, job);
  (async () => {
    const model = MODEL();
    try {
      const res = await fetch(`${BASE()}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": KEY(), "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: ask.prompt }] }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && noQuota(res.status, String(json?.error?.message ?? ""))) {
        blocked.date = today();
        return Object.assign(job, { status: "error", error: MUSIC_UNAVAILABLE, unavailable: true });
      }
      if (!res.ok) throw new Error(`${model} ${res.status}: ${json?.error?.message ?? res.statusText}`);
      const b64 = audioOf(json);
      if (!b64) {
        // A prompt the safety filter stopped says why; anything else just came back empty.
        const why = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason;
        throw new Error(`${model} returned no music${why && why !== "STOP" ? ` (${why})` : ""}.`);
      }
      const bytes = Buffer.from(b64, "base64");
      await mkdir(DIR(), { recursive: true });
      await writeFile(askOf(run.id), JSON.stringify({ prompt: ask.prompt, basis: ask.basis, model }));
      await writeFile(fileOf(run.id, extOf(bytes)), bytes);
      Object.assign(job, { status: "done", model });
    } catch (error) {
      Object.assign(job, { status: "error", error: redact(error?.name === "TimeoutError" ? `${model} took too long.` : String(error?.message ?? error)) });
    }
  })();
  return job;
}

/** For tests: forget jobs and today's count. */
export function resetMusic() {
  jobs.clear();
  Object.assign(day, { date: "", count: 0 });
  blocked.date = "";
}
