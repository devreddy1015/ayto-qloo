// The pipeline runner: a plain state machine over the run's own plan (a list
// of stage ids chosen by the format). Each stage reads the outputs before it,
// adds its own, and the run is saved after every stage. Editing a stage marks
// everything after it stale and reruns from there.
import { config } from "../config.js";
import { audience } from "../engine/audience.js";
import { audio } from "../engine/audio.js";
import { gap } from "../engine/gap.js";
import { look } from "../engine/look.js";
import { read } from "../engine/read.js";
import { resolve } from "../engine/resolve.js";
import { spots } from "../engine/spots.js";
import { travels } from "../engine/travels.js";
import { FORMATS, STAGE_LABELS } from "../formats.js";
import { clearRunCredential, setRunCredential } from "../keys.js";
import { writeLanguage } from "../languages.js";
import { runWithUsage } from "../usage.js";
import { check } from "./check.js";
import { diff } from "./diff.js";
import { produce } from "./produce.js";
import { share } from "./share.js";
import { emitEvent, newEditKey, newId, saveRun } from "./store.js";
import { write } from "./write.js";

export const STAGE_RUNNERS = { resolve, read, gap, look, audio, spots, audience, travels, write, check, produce, diff, share };
export const stageInfo = (id) => ({ id, ...(STAGE_LABELS[id] ?? { label: id, output: "" }) });
export const planFor = (format) => (FORMATS[format] ?? FORMATS.film).plan;

// Wall-clock budget per stage. The read runs up to four entity types across three locations through a
// harness that serialises calls, so it gets more room than the single-call stages.
const STAGE_TIMEOUT_MS = { default: 120000, read: 300000, travels: 180000, gap: 180000 };
const active = new Map(); // runId -> Promise

export async function createRun(input, meta = {}) {
  const plan = planFor(input.format);
  const run = {
    id: newId("r"),
    editKey: newEditKey(),
    version: 1,
    createdAt: new Date().toISOString(),
    mode: meta.mode ?? config.mode,
    showcase: meta.showcase,
    input,
    plan,
    stages: Object.fromEntries(plan.map((s) => [s, { status: "pending" }])),
    ledger: [],
    entities: {},
    names: {},
    events: [],
  };
  if (meta.credential) {
    setRunCredential(run.id, meta.credential);
    run.llm = { provider: meta.credential.provider, model: meta.credential.model, byok: true };
  }
  await saveRun(run);
  return run;
}

export function startRun(run, fromIndex = 0) {
  if (active.has(run.id)) return active.get(run.id);
  const p = execute(run, fromIndex).finally(() => {
    active.delete(run.id);
    clearRunCredential(run.id);
  });
  active.set(run.id, p);
  return p;
}

export const isRunning = (runId) => active.has(runId);

async function execute(run, fromIndex) {
  run.status = "running";
  run.version += 1;
  for (let i = fromIndex; i < run.plan.length; i += 1) run.stages[run.plan[i]] = { ...run.stages[run.plan[i]], status: i === fromIndex ? "running" : "stale", output: undefined, error: undefined };
  emitEvent(run, { type: "run", status: "running", from: run.plan[fromIndex] });
  await saveRun(run);

  for (let i = fromIndex; i < run.plan.length; i += 1) {
    const id = run.plan[i];
    const state = run.stages[id];
    state.status = "running";
    state.startedAt = new Date().toISOString();
    emitEvent(run, { type: "stage", id, status: "running" });
    try {
      const before = run.usage?.calls ?? 0;
      const output = await withTimeout(runWithUsage(run, id, () => STAGE_RUNNERS[id](run)), STAGE_TIMEOUT_MS[id] ?? STAGE_TIMEOUT_MS.default, `${stageInfo(id).label} took too long`);
      state.output = applyEdits(output, state.userEdits);
      state.status = "done";
      state.endedAt = new Date().toISOString();
      emitEvent(run, { type: "stage", id, status: "done", output: state.output, summary: state.output?.summary });
      if ((run.usage?.calls ?? 0) > before) emitEvent(run, { type: "usage", usage: { calls: run.usage.calls, input: run.usage.input, output: run.usage.output, byok: run.usage.byok, provider: run.usage.provider, model: run.usage.model } });
    } catch (error) {
      state.status = "error";
      state.error = error.message;
      state.endedAt = new Date().toISOString();
      emitEvent(run, { type: "stage", id, status: "error", error: error.message });
      run.status = "error";
      emitEvent(run, { type: "run", status: "error", at_stage: id, message: error.message });
      await saveRun(run);
      return run;
    }
    await saveRun(run);
  }
  run.status = "done";
  emitEvent(run, { type: "run", status: "done", publish: run.publish });
  await saveRun(run);
  return run;
}

/** User edits are a shallow patch over the stage's output; they survive reruns of that stage. */
function applyEdits(output, edits) {
  if (!edits || typeof edits !== "object") return output;
  const merged = structuredClone(output ?? {});
  for (const [k, v] of Object.entries(edits)) {
    if (v && typeof v === "object" && !Array.isArray(v) && merged[k] && typeof merged[k] === "object" && !Array.isArray(merged[k])) merged[k] = { ...merged[k], ...v };
    else merged[k] = v;
  }
  merged.edited = true;
  return merged;
}

/**
 * Apply edits to a finished stage without rerunning it, then rerun everything after it.
 * Resolves as soon as the rerun has started ({ done } is the whole rerun), and rejects
 * with a plain message when it cannot start, so the caller can answer the request at once.
 */
export async function editAndRerun(run, stageId, edits, credential) {
  const index = run.plan.indexOf(stageId);
  if (index < 0) throw new Error("Unknown stage");
  if (isRunning(run.id)) throw new Error("This run is still working. Wait for it to finish.");
  const state = run.stages[stageId];
  if (state.status !== "done") throw new Error("Only finished stages can be edited.");
  state.userEdits = { ...(state.userEdits ?? {}), ...edits };
  state.output = applyEdits(state.output, edits);
  emitEvent(run, { type: "stage", id: stageId, status: "done", output: state.output, edited: true });
  if (credential) setRunCredential(run.id, credential);
  // Start before any await, so a regenerate landing in between can't take the run first; the rerun saves the edit.
  if (index + 1 < run.plan.length) return { done: startRun(run, index + 1) };
  await saveRun(run);
  return { done: Promise.resolve(run) };
}

/** The one edit the web app makes: one of the run's own lanes first. Built from the run, so nothing sent is stored. */
export function laneFirstEdit(run, name) {
  const lanes = run.stages.gap?.output?.lanes ?? [];
  const pick = lanes.find((l) => l.name === name);
  if (!pick) return undefined;
  return { lanes: [pick, ...lanes.filter((l) => l !== pick)], summary: `Lane 1: ${pick.name} (your pick).` };
}

/**
 * Someone else's run, copied for the person who wants to change it: the same evidence and receipts under a new id
 * and edit key. The original (a showcase, a run in the gallery) stays exactly as its owner left it.
 */
export async function forkRun(run) {
  const { events, editKey, publish, showcase, ...rest } = run;
  const copy = { ...structuredClone(rest), id: newId("r"), editKey: newEditKey(), forkedFrom: run.id, createdAt: new Date().toISOString(), version: 1, events: [] };
  await saveRun(copy);
  return copy;
}

/** Rerun from a stage with changed input (production assumptions). The stages before it keep their outputs. */
export async function rerunFrom(run, stageId, { assumptions } = {}) {
  const index = run.plan.indexOf(stageId);
  if (index < 0) throw new Error("This run has no such stage.");
  if (isRunning(run.id)) throw new Error("This run is still working. Wait for it to finish.");
  if (index > 0 && run.stages[run.plan[index - 1]]?.status !== "done") throw new Error("The stages before it must finish first.");
  if (assumptions) {
    const prev = run.input.assumptions ?? {};
    run.input.assumptions = { ...prev, ...assumptions, unitCost: { ...(prev.unitCost ?? {}), ...(assumptions.unitCost ?? {}) } };
  }
  // The rerun saves the new assumptions itself; no await before it, so nothing can start in between.
  return { done: startRun(run, index) };
}

/** Rerun from the write stage, with a (new) credential, and in another language if one is given ("English" clears it). */
export async function regenerate(run, credential, { language } = {}) {
  const index = run.plan.indexOf("write");
  if (index < 0) throw new Error("This run has no write stage.");
  if (isRunning(run.id)) throw new Error("This run is still working. Wait for it to finish.");
  if (run.stages[run.plan[index - 1]]?.status !== "done") throw new Error("The evidence stages must finish first.");
  if (typeof language === "string") {
    run.input.language = writeLanguage(language);
    if (!run.input.language) delete run.input.language;
  }
  if (credential) {
    setRunCredential(run.id, credential);
    run.llm = { provider: credential.provider, model: credential.model, byok: true };
  }
  return { done: startRun(run, index) };
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms)))]).finally(() => clearTimeout(timer));
}
