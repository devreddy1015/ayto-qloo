// Concept images: one picture drawn from a finished run's brief, on demand, with the server's OpenAI key.
// Never a stage: a run never waits on it or fails because of it. The prompt is built from what the run wrote and
// what Qloo read (the look words, the palette, the area), with every Qloo name taken out, so the picture is original
// art in the city's taste, never a real film's poster, a brand's logo or a real person.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { redact } from "./llm.js";

const BASE = () => String(process.env.OPENAI_IMAGE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const KEY = () => String(process.env.OPENAI_API_KEY ?? "").trim();
// Flare is OpenAI's fast everyday image model (31 Oct 2026); gpt-image-2 is the fallback if an account lacks it.
const MODELS = () => String(process.env.IMAGE_MODELS || "gpt-image-2.5-flare,gpt-image-2").split(",").map((m) => m.trim()).filter(Boolean);
const MAX_PER_DAY = () => Number(process.env.MAX_IMAGES_PER_DAY || 40);
const DIR = () => join(config.cacheDir, "images");

const jobs = new Map(); // runId -> { status: "drawing" | "done" | "error", error?, model?, at }
const day = { date: "", count: 0 };

export const imageAvailable = () => KEY().length >= 20;

/** Room left in today's image budget; counts one when `take` is set. */
export function imageBudget({ take = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) Object.assign(day, { date: today, count: 0 });
  if (day.count >= MAX_PER_DAY()) return false;
  if (take) day.count += 1;
  return true;
}

const SIZE = { reel: "1024x1536", podcast: "1024x1024", book: "1024x1536" };
const txt = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(txt).filter(Boolean).join(", ") : v && typeof v === "object" ? txt(v.name ?? v.title ?? v.text ?? "") : v == null ? "" : String(v));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every name a Qloo read put in this run (titles, artists, brands, places, loves): never drawn, never named to the image model. */
function qlooNames(run) {
  const keep = new Set(["city", "neighbourhood", "tag"]);
  return Object.values(run.names ?? {})
    .filter((n) => n?.name && !keep.has(n.kind) && String(n.name).trim().length >= 3)
    .map((n) => String(n.name).trim())
    .sort((a, b) => b.length - a.length);
}

/** Text from the brief with every Qloo name taken out. */
export function scrub(text, run) {
  let out = String(text ?? "");
  for (const name of qlooNames(run)) out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}(?=$|[^\\p{L}\\p{N}])`, "giu"), "$1");
  return out.replace(/\s+([,.;:])/g, "$1").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

/** The image prompt for a finished run, per format. Returns undefined when the run has nothing written to draw from. */
export function imagePrompt(run) {
  const w = run.stages?.write?.output;
  const plan = w?.plan;
  if (!plan) return undefined;
  const format = run.input?.format ?? w.writer ?? "film";
  const city = run.stages?.resolve?.output?.city?.name ?? txt(run.input?.city?.query).split(",")[0];
  const area = txt(run.stages?.spots?.output?.base?.name ?? plan.shoot_base ?? plan.neighbourhood);
  const look = (run.stages?.look?.output?.styles ?? []).filter((s) => s.lift > 0).slice(0, 4).map((s) => s.name);
  const palette = (Array.isArray(plan.palette) ? plan.palette : []).map((c) => (typeof c === "object" ? [txt(c.name), /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : ""].filter(Boolean).join(" ") : txt(c))).filter(Boolean).slice(0, 6);
  const lane = txt(plan.lane?.flavour ?? plan.lane);
  const say = (s) => scrub(s, run).slice(0, 600);
  const setting = [city, area && area !== city ? area : ""].filter(Boolean).join(", ");
  const first = (list) => (Array.isArray(list) ? list[0] : list);
  const style = (Array.isArray(plan.styles) ? plan.styles.find((x) => x?.hero) : undefined) ?? first(plan.styles);
  const subject = {
    film: `A single cinematic still that sets the mood of a ${lane ? `${lane.toLowerCase()} ` : ""}film: ${say(plan.logline || plan.theme)}`,
    reel: `A vertical video frame, the opening shot of a reel: ${say(txt(plan.hook) || txt(first(plan.beats)))}`,
    fashion: `A lookbook photograph of one garment on a plain mannequin in a studio: ${say([txt(style?.category) || txt(style?.garment).replace(/_/g, " "), txt(style?.cues), style?.print?.motif ? `printed with ${txt(style.print.motif)}` : ""].filter(Boolean).join(", ") || txt(plan.concept))}`,
    cafe: `The interior of a café, seen from the doorway: ${say(plan.concept)}`,
    event: `The room at the peak of a live night: ${say(plan.concept)}`,
    book: `A book cover illustration: ${say(plan.premise || plan.logline)}`,
    podcast: `Square cover art for a podcast: ${say(plan.premise)}`,
    game: `Key art for an indie game in ${txt(plan.art_style) || "its own art style"}: ${say(plan.pitch || plan.core_loop)}`,
  }[format] ?? `Concept art for ${say(plan.concept || plan.logline || plan.premise)}`;
  const parts = [
    subject,
    setting && `Set in ${setting}.`,
    look.length && `Visual style: ${look.join(", ")}.`,
    palette.length && `Colour palette: ${palette.join(", ")}.`,
    "Original artwork for a concept brief.",
    "No text, letters, numbers, logos, brand marks, signage or watermarks anywhere in the image.",
    "No real or recognisable people; anyone in the frame is anonymous, small, or seen from behind.",
    "Not a real film's poster or still, not a real venue, not a real product.",
  ];
  return { prompt: parts.filter(Boolean).join(" "), size: SIZE[format] ?? "1536x1024", format };
}

const fileOf = (runId) => join(DIR(), `${runId}.jpg`);

/** Where the run's image stands: drawing, done (with its file), error, or none. */
export async function imageStatus(runId) {
  const job = jobs.get(runId);
  if (job?.status === "done" || !job) {
    try {
      await readFile(fileOf(runId));
      return { status: "done", url: `/api/runs/${runId}/image.jpg`, model: job?.model };
    } catch {
      if (!job) return { status: "none" };
    }
  }
  return { status: job.status, ...(job.error ? { error: job.error } : {}) };
}

export const imageFile = (runId) => readFile(fileOf(runId));

/** Start drawing the run's image (no-op if one is drawing or done). Resolves when the job ends; callers needn't wait. */
export async function startImage(run, { timeoutMs = 150000 } = {}) {
  const current = jobs.get(run.id);
  if (current?.status === "drawing") return current;
  const ask = imagePrompt(run);
  if (!ask) throw Object.assign(new Error("This run has nothing written to draw yet."), { status: 409 });
  const job = { status: "drawing", at: Date.now() };
  jobs.set(run.id, job);
  (async () => {
    let lastError = "The image model didn't answer.";
    for (const model of MODELS()) {
      try {
        const res = await fetch(`${BASE()}/images/generations`, {
          method: "POST",
          headers: { authorization: `Bearer ${KEY()}`, "content-type": "application/json" },
          body: JSON.stringify({ model, prompt: ask.prompt, size: ask.size, quality: "medium", output_format: "jpeg", output_compression: 85, n: 1 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastError = redact(`${model} ${res.status}: ${json?.error?.message ?? res.statusText}`);
          // A model this account can't use: try the next. Anything else (a refused prompt, a bad key) won't change.
          if ([400, 403, 404].includes(res.status) && /model|access|verif|not found|does not exist/i.test(json?.error?.message ?? "")) continue;
          break;
        }
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) {
          lastError = `${model} returned no image.`;
          break;
        }
        await mkdir(DIR(), { recursive: true });
        await writeFile(fileOf(run.id), Buffer.from(b64, "base64"));
        Object.assign(job, { status: "done", model });
        return;
      } catch (error) {
        lastError = redact(error?.name === "TimeoutError" ? `${model} took too long.` : String(error?.message ?? error));
        break;
      }
    }
    Object.assign(job, { status: "error", error: lastError });
  })();
  return job;
}

/** For tests: forget jobs and today's count. */
export function resetImages() {
  jobs.clear();
  Object.assign(day, { date: "", count: 0 });
}
