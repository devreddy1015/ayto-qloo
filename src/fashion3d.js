// Fashion in 3D, on demand: for one style of a finished drop, OpenAI draws its print (or its fabric) to wrap onto the
// procedural garment in the viewer, and, when a Stability key is set, a product shot of the style that Stable Fast 3D
// turns into a GLB to turn around and download. Never a stage: a run never waits on these or fails because of them.
// Like the concept image (image.js), every prompt is built from what the run wrote with every Qloo name taken out,
// and asks for original work: no logos, no text, no real person, no existing character or franchise costume.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { scrub } from "./image.js";
import { redact } from "./llm.js";

const OPENAI_BASE = () => String(process.env.OPENAI_IMAGE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_KEY = () => String(process.env.OPENAI_API_KEY ?? "").trim();
const IMAGE_MODELS = () => String(process.env.IMAGE_MODELS || "gpt-image-2.5-flare,gpt-image-2").split(",").map((m) => m.trim()).filter(Boolean);
// Stable Fast 3D: one synchronous multipart call, an image in, GLB bytes out (docs.stability.ai, 31 Oct 2026).
const STABILITY_BASE = () => String(process.env.STABILITY_BASE_URL || "https://api.stability.ai").replace(/\/+$/, "");
const STABILITY_KEY = () => String(process.env.STABILITY_API_KEY ?? "").trim();
const MODEL_3D = () => (process.env.MODEL_3D === "stable-point-aware-3d" ? "stable-point-aware-3d" : "stable-fast-3d");
const MAX_PRINTS = () => Number(process.env.MAX_PRINTS_PER_DAY || 30);
const MAX_MODELS = () => Number(process.env.MAX_MODELS_PER_DAY || 10);
const DIR = () => join(config.cacheDir, "garments");

export const printsAvailable = () => OPENAI_KEY().length >= 20;
export const modelsAvailable = () => printsAvailable() && STABILITY_KEY().length >= 20;
/** What the page may offer: no key, no button. */
export const fashion3dStatus = () => ({ prints: printsAvailable(), models: modelsAvailable() });

const jobs = new Map(); // `${runId}:${index}:${kind}` -> { status: "drawing" | "done" | "error", error?, at }
const days = { print: { date: "", count: 0 }, model: { date: "", count: 0 } };

/** Room left in today's budget for prints or models; counts one when `take` is set. */
export function fashion3dBudget(kind, { take = false } = {}) {
  const day = days[kind];
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) Object.assign(day, { date: today, count: 0 });
  if (day.count >= (kind === "model" ? MAX_MODELS() : MAX_PRINTS())) return false;
  if (take) day.count += 1;
  return true;
}

const txt = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(txt).filter(Boolean).join(", ") : v && typeof v === "object" ? txt(v.name ?? v.title ?? v.text ?? "") : v == null ? "" : String(v));
const GARMENT_WORDS = { tee: "t-shirt", oversized_tee: "oversized t-shirt", maxi_dress: "floor-length maxi dress", dress: "A-line dress", saree: "saree with a fitted blouse", cape: "cape", cosplay_set: "costume set: a long coat, layered shoulder plates and a belt", set: "co-ord set of a top and shorts" };

/** The styles of a finished fashion run, or undefined when there is nothing to draw from. */
function stylesOf(run) {
  const plan = run?.stages?.write?.output?.plan;
  return Array.isArray(plan?.styles) ? plan.styles.filter((s) => s && typeof s === "object") : undefined;
}

/** Fabric (tiled over the cloth) or panel (placed once), the same rule as printModeOf() in public/garment3d.js. */
export function printMode(style = {}) {
  const p = style.print && typeof style.print === "object" ? style.print : {};
  const type = txt(p.type).toLowerCase();
  const placement = txt(p.placement).toLowerCase().replace(/[\s-]+/g, "_");
  return style.garment === "saree" || !type || type === "none" || type === "stripe" || placement === "all_over" ? "fabric" : "panel";
}

function common(run, style) {
  const plan = run.stages.write.output.plan;
  const say = (s, n = 300) => scrub(s, run).slice(0, n);
  const garment = say(txt(style.category)) || GARMENT_WORDS[style.garment] || txt(style.garment).replace(/_/g, " ") || "garment";
  const palette = (Array.isArray(plan.palette) ? plan.palette : []).map((c) => (typeof c === "object" ? [say(txt(c.name), 40), /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : ""].filter(Boolean).join(" ") : say(txt(c), 40))).filter(Boolean).slice(0, 6);
  const look = (run.stages?.look?.output?.styles ?? []).filter((s) => s.lift > 0).slice(0, 4).map((s) => s.name);
  return { garment, palette, look, cues: say(txt(style.cues)), motif: say(txt(style.print?.motif), 80), say };
}

const ORIGINAL = [
  "Original design for a small maker's concept brief.",
  "No text, letters, numbers, logos, brand marks, signatures or watermarks anywhere.",
  "No real or recognisable people, and not any existing character's costume, emblem, mascot or franchise design.",
];

/** The prompt for a style's print (a square panel artwork) or fabric (a seamless tile). */
export function printPrompt(run, index) {
  const style = stylesOf(run)?.[index];
  if (!style) return undefined;
  const { garment, palette, look, cues, motif } = common(run, style);
  const mode = printMode(style);
  const placement = txt(style.print?.placement).replace(/_/g, " ") || "chest";
  const subject =
    mode === "fabric"
      ? `A seamless, tileable textile pattern for a ${garment}${motif ? `: ${motif}` : ""}. Flat and top-down like a scanned fabric swatch, edge to edge, repeating on all four sides, no garment and no mockup.`
      : `A square print artwork for the ${placement} of a ${garment}${motif ? `: ${motif}` : ""}. Flat 2D artwork that fills the whole square edge to edge, ready to screen-print, no garment, no mockup, no scene around it.`;
  const parts = [subject, cues && `Mood and material: ${cues}.`, look.length && `Visual style: ${look.join(", ")}.`, palette.length && `Colours only from this palette: ${palette.join(", ")}.`, ...ORIGINAL];
  return { prompt: parts.filter(Boolean).join(" "), mode };
}

/** The prompt for a style's product shot, the image Stable Fast 3D lifts into a model: one garment, plain backdrop. */
export function shotPrompt(run, index) {
  const style = stylesOf(run)?.[index];
  if (!style) return undefined;
  const { garment, palette, look, cues, motif } = common(run, style);
  // A typographic print becomes a graphic one: the image model is asked for no lettering at all.
  const type = txt(style.print?.type).toLowerCase();
  const print = type && type !== "none" ? `${type === "typographic" ? "bold graphic" : type} print${motif ? ` of ${motif}` : ""} on the ${txt(style.print.placement).replace(/_/g, " ") || "chest"}` : "";
  const parts = [
    `A product photograph of one ${garment} on an invisible ghost mannequin${[cues, print].filter(Boolean).length ? `: ${[cues, print].filter(Boolean).join(", ")}` : ""}.`,
    style.garment === "cosplay_set" && "An original costume in the spirit of a fandom crowd's taste, not any existing character's outfit.",
    "Front three-quarter view, the whole garment in frame and centred with a margin, on a plain light grey seamless background, soft even studio light. Nothing else in the frame.",
    look.length && `Visual style: ${look.join(", ")}.`,
    palette.length && `Colours from this palette: ${palette.join(", ")}.`,
    ...ORIGINAL,
  ];
  return { prompt: parts.filter(Boolean).join(" ") };
}

const fileOf = (runId, index, kind) => join(DIR(), `${runId}-${index}-${kind === "model" ? "model.glb" : kind === "shot" ? "shot.jpg" : "print.jpg"}`);
const urlOf = (runId, index, kind) => `/api/runs/${runId}/styles/${index}/${kind === "model" ? "model.glb" : "print.jpg"}`;
const keyOf = (runId, index, kind) => `${runId}:${index}:${kind}`;

/** Where one style's print or model stands: drawing, done (with its url), error, or none. */
export async function fashion3dJob(runId, index, kind) {
  const job = jobs.get(keyOf(runId, index, kind));
  if (job?.status === "done" || !job) {
    try {
      await readFile(fileOf(runId, index, kind));
      return { status: "done", url: urlOf(runId, index, kind) };
    } catch {
      if (!job) return { status: "none" };
    }
  }
  return { status: job.status, ...(job.error ? { error: job.error } : {}) };
}

export const fashion3dFile = (runId, index, kind) => readFile(fileOf(runId, index, kind));

/** One image from OpenAI: the account's first image model that answers. Returns JPEG bytes or throws a redacted error. */
async function draw(prompt, { size = "1024x1024", timeoutMs = 150000 } = {}) {
  let lastError = "The image model didn't answer.";
  for (const model of IMAGE_MODELS()) {
    try {
      const res = await fetch(`${OPENAI_BASE()}/images/generations`, {
        method: "POST",
        headers: { authorization: `Bearer ${OPENAI_KEY()}`, "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, size, quality: "medium", output_format: "jpeg", output_compression: 90, n: 1 }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = redact(`${model} ${res.status}: ${json?.error?.message ?? res.statusText}`);
        if ([400, 403, 404].includes(res.status) && /model|access|verif|not found|does not exist/i.test(json?.error?.message ?? "")) continue;
        break;
      }
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) {
        lastError = `${model} returned no image.`;
        break;
      }
      return Buffer.from(b64, "base64");
    } catch (error) {
      lastError = redact(error?.name === "TimeoutError" ? `${model} took too long.` : String(error?.message ?? error));
      break;
    }
  }
  throw new Error(lastError);
}

/** Lift a product shot into a GLB with Stable Fast 3D (or SPAR3D). Returns the GLB bytes or throws a redacted error. */
async function lift(image, { timeoutMs = 120000 } = {}) {
  const form = new FormData();
  form.append("image", new Blob([image], { type: "image/jpeg" }), "style.jpg");
  form.append("texture_resolution", "1024");
  form.append("foreground_ratio", "0.85");
  const res = await fetch(`${STABILITY_BASE()}/v2beta/3d/${MODEL_3D()}`, { method: "POST", headers: { authorization: `Bearer ${STABILITY_KEY()}` }, body: form, signal: AbortSignal.timeout(timeoutMs) }).catch((error) => {
    throw new Error(redact(error?.name === "TimeoutError" ? "The 3D model took too long." : String(error?.message ?? error)));
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = JSON.parse(bytes.toString("utf8"));
      message = [json.name, ...(Array.isArray(json.errors) ? json.errors : [])].filter(Boolean).join(": ") || message;
    } catch {}
    throw new Error(redact(`${MODEL_3D()} ${res.status}: ${message}`));
  }
  // A GLB starts with the ASCII magic "glTF".
  if (bytes.subarray(0, 4).toString("latin1") !== "glTF") throw new Error(`${MODEL_3D()} returned something other than a GLB.`);
  return bytes;
}

/**
 * Start a style's print or model (no-op if one is drawing or done). Resolves once the job is registered; the work
 * carries on in the background and the page polls fashion3dJob().
 */
export async function startFashion3d(run, index, kind) {
  const key = keyOf(run.id, index, kind);
  const current = jobs.get(key);
  if (current?.status === "drawing") return current;
  const style = stylesOf(run)?.[index];
  if (!style) throw Object.assign(new Error("This run has no such style."), { status: 404 });
  if (kind === "model" && !style.hero) throw Object.assign(new Error("3D models are for the drop's hero styles."), { status: 400 });
  const ask = kind === "model" ? shotPrompt(run, index) : printPrompt(run, index);
  const job = { status: "drawing", at: Date.now() };
  jobs.set(key, job);
  (async () => {
    try {
      await mkdir(DIR(), { recursive: true });
      const image = await draw(ask.prompt);
      if (kind === "model") {
        await writeFile(fileOf(run.id, index, "shot"), image);
        await writeFile(fileOf(run.id, index, "model"), await lift(image));
      } else await writeFile(fileOf(run.id, index, "print"), image);
      Object.assign(job, { status: "done" });
    } catch (error) {
      Object.assign(job, { status: "error", error: redact(String(error?.message ?? error)).slice(0, 300) });
    }
  })();
  return job;
}

/** Every style's print and model status for a run, for the page to restore what was already made. */
export async function fashion3dRun(run) {
  const styles = stylesOf(run) ?? [];
  return {
    ...fashion3dStatus(),
    styles: await Promise.all(styles.map(async (s, i) => ({ print: await fashion3dJob(run.id, i, "print"), model: s.hero ? await fashion3dJob(run.id, i, "model") : { status: "none" } }))),
  };
}

/** For tests: forget jobs and today's counts. */
export function resetFashion3d() {
  jobs.clear();
  for (const d of Object.values(days)) Object.assign(d, { date: "", count: 0 });
}
