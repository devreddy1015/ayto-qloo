// Hear the story: a finished brief read aloud by Sarvam's Bulbul, on demand, with the server's Sarvam key. A film
// reads its story ("the story, simply"); other formats read their concept, logline or premise; the title goes first.
// It reads the brief in the brief's own words and language (a brief written in Telugu is heard in Telugu, an English
// one in Indian English), stripped of markup only. Never a stage: a run never waits on it or fails because of it.
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config } from "./config.js";
import { cityLanguages } from "./engine/resolve.js";
import { writeLanguage } from "./languages.js";
import { redact } from "./llm.js";

const BASE = () => String(process.env.SARVAM_BASE_URL || "https://api.sarvam.ai").replace(/\/+$/, "");
const KEY = () => String(process.env.SARVAM_API_KEY ?? "").trim();
// Bulbul v3 is the API's default model, with plain speaker names (31 Oct 2026); SARVAM_SPEAKER picks another voice.
const MODEL = () => String(process.env.SARVAM_TTS_MODEL || "bulbul:v3").trim();
const SPEAKER = () => String(process.env.SARVAM_SPEAKER ?? "").trim();
const MAX_PER_DAY = () => Number(process.env.MAX_VOICE_PER_DAY || 30);
const DIR = () => resolve(config.cacheDir, "voice");
const CHUNK = 2400; // Bulbul v3 takes up to 2500 characters a request

const jobs = new Map(); // runId -> { status: "reading" | "done" | "error", error?, at }
const day = { date: "", count: 0 };

export const voiceAvailable = () => KEY().length >= 16;

/** Room left in today's narration budget; counts one when `take` is set. */
export function voiceBudget({ take = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) Object.assign(day, { date: today, count: 0 });
  if (day.count >= MAX_PER_DAY()) return false;
  if (take) day.count += 1;
  return true;
}

// The languages Bulbul speaks, by the names languages.js uses (Sarvam writes Odia as od-IN).
const SPOKEN = { English: "en-IN", Hindi: "hi-IN", Bengali: "bn-IN", Tamil: "ta-IN", Telugu: "te-IN", Kannada: "kn-IN", Malayalam: "ml-IN", Marathi: "mr-IN", Gujarati: "gu-IN", Punjabi: "pa-IN", Odia: "od-IN" };
// What is read, per format, after the title.
const BODY = { film: (p) => p.story || p.logline, reel: (p) => p.hook, fashion: (p) => p.positioning, podcast: (p) => p.premise, game: (p) => p.pitch, cafe: (p) => p.concept, event: (p) => p.concept, book: (p) => p.premise || p.logline };
const txt = (v) => (typeof v === "string" ? v : Array.isArray(v) ? (typeof v[0] === "string" ? txt(v[0]) : v.map(txt).filter(Boolean).join(" ")) : v && typeof v === "object" ? txt(v.title ?? v.name ?? v.text ?? "") : v == null ? "" : String(v));
/** Markup out, words kept: [a](b) → a, and no *, _, #, ` or > used for formatting. */
const plain = (s) => String(s ?? "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
const sentence = (s) => (/[.!?।]$/.test(s) ? s : `${s}.`);

/**
 * What to read and in which language: the brief's own language when Bulbul speaks it, else English. Returns
 * undefined when the run has nothing written to read (a template brief written without a model) or is in a
 * language Bulbul doesn't speak. `hint` names the city's language when the brief is in English.
 */
export function voicePlan(run) {
  const w = run.stages?.write?.output;
  const plan = w?.plan;
  if (!plan) return undefined;
  const format = run.input?.format ?? w.writer ?? "film";
  const title = plain(txt(plan.titles ?? plan.title ?? plan.name ?? plan.drop_name));
  const body = plain(txt(BODY[format]?.(plan)));
  if (!body) return undefined;
  const language = writeLanguage(w.language) ?? writeLanguage(run.input?.language) ?? "English";
  if (!SPOKEN[language]) return undefined;
  const text = [title, body].filter(Boolean).map(sentence).join(" ");
  const local = cityLanguages(run.stages?.resolve?.output?.city).find((l) => l !== "English" && SPOKEN[l]);
  return { text, language, ...(language === "English" && local ? { hint: local } : {}) };
}

/** The text in pieces Bulbul takes, cut at sentence ends. */
export function chunks(text, size = CHUNK) {
  const out = [];
  let current = "";
  for (const piece of text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text]) {
    if (current && (current + piece).length > size) {
      out.push(current.trim());
      current = "";
    }
    current += piece;
    while (current.length > size) {
      out.push(current.slice(0, size));
      current = current.slice(size);
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** WAV files of one format joined into one: the first file's header, every file's samples, sizes rewritten. */
export function joinWav(files) {
  const dataOf = (b) => {
    for (let at = 12; at + 8 <= b.length; ) {
      const id = b.toString("latin1", at, at + 4);
      const size = b.readUInt32LE(at + 4);
      if (id === "data") return { head: b.subarray(0, at + 8), data: b.subarray(at + 8, at + 8 + size) };
      at += 8 + size + (size % 2);
    }
    throw new Error("Sarvam sent audio without a data chunk.");
  };
  const parts = files.map(dataOf);
  const head = Buffer.from(parts[0].head);
  const data = Buffer.concat(parts.map((p) => p.data));
  head.writeUInt32LE(head.length - 8 + data.length, 4);
  head.writeUInt32LE(data.length, head.length - 4);
  return Buffer.concat([head, data]);
}

async function speak(text, code, codec, timeoutMs) {
  const res = await fetch(`${BASE()}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": KEY(), "content-type": "application/json" },
    body: JSON.stringify({ text, language_code: code, model: MODEL(), ...(SPEAKER() ? { speaker: SPEAKER() } : {}), pace: 1, output_audio_codec: codec }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${json?.error?.message ?? json?.message ?? res.statusText}`);
  const b64 = json?.audios?.[0];
  if (!b64) throw new Error("Sarvam returned no audio.");
  return Buffer.from(b64, "base64");
}

const extOf = (bytes) => (bytes.subarray(0, 4).toString("latin1") === "RIFF" ? "wav" : "mp3");
const fileOf = (runId, ext) => join(DIR(), `${runId}.${ext}`);
const saidOf = (runId) => join(DIR(), `${runId}.json`);

/** The run's narration on disk, if there is one: { path, ext }. */
export async function voiceFile(runId, ext) {
  for (const e of ext ? [ext] : ["mp3", "wav"]) {
    try {
      if ((await stat(fileOf(runId, e))).isFile()) return { path: fileOf(runId, e), ext: e };
    } catch {}
  }
  return undefined;
}

/**
 * Where the run's narration stands: reading, done (with its file and what it says), error, or none. Given the run,
 * a narration of words the brief no longer has (it was written again, say in Telugu) counts as none.
 */
export async function voiceStatus(runId, run) {
  const job = jobs.get(runId);
  if (job?.status === "done" || !job) {
    const file = await voiceFile(runId);
    if (file) {
      const said = await readFile(saidOf(runId), "utf8").then(JSON.parse).catch(() => ({}));
      const now = run && voicePlan(run);
      // ?v= changes with each reading, so a browser never plays a cached older one.
      if (!run || !now || (now.text === said.text && now.language === said.language)) return { status: "done", url: `/api/runs/${runId}/voice.${file.ext}${said.at ? `?v=${said.at}` : ""}`, ...said };
      return { status: "none" };
    }
    if (!job) return { status: "none" };
  }
  return { status: job.status, ...(job.error ? { error: job.error } : {}) };
}

/** Start reading the run's brief aloud (no-op if it is already reading). Callers needn't wait. */
export async function startVoice(run, { timeoutMs = 60000 } = {}) {
  const current = jobs.get(run.id);
  if (current?.status === "reading") return current;
  const ask = voicePlan(run);
  if (!ask) throw Object.assign(new Error("This brief has nothing to read aloud yet."), { status: 409 });
  const job = { status: "reading", at: Date.now() };
  jobs.set(run.id, job);
  (async () => {
    try {
      const pieces = chunks(ask.text);
      const code = SPOKEN[ask.language];
      // One piece comes back as MP3; several come back as WAV and are joined, since MP3s don't join cleanly.
      const audio = pieces.length === 1 ? [await speak(pieces[0], code, "mp3", timeoutMs)] : await Promise.all(pieces.map((p) => speak(p, code, "wav", timeoutMs)));
      const bytes = audio.length === 1 ? audio[0] : joinWav(audio);
      await mkdir(DIR(), { recursive: true });
      // A brief written again replaces its old narration, whichever format that one came in.
      for (const ext of ["mp3", "wav"]) await rm(fileOf(run.id, ext), { force: true });
      await writeFile(saidOf(run.id), JSON.stringify({ text: ask.text, language: ask.language, at: Date.now() }));
      await writeFile(fileOf(run.id, extOf(bytes)), bytes);
      Object.assign(job, { status: "done" });
    } catch (error) {
      Object.assign(job, { status: "error", error: redact(error?.name === "TimeoutError" ? "Sarvam took too long." : String(error?.message ?? error)) });
    }
  })();
  return job;
}

/** For tests: forget jobs and today's count. */
export function resetVoice() {
  jobs.clear();
  Object.assign(day, { date: "", count: 0 });
}
