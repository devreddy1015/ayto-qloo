// The pipeline runner: a plain state machine over 11 stages. Each stage reads
// the outputs before it, adds its own, and the run is saved after every stage.
// Editing a stage marks everything after it stale and reruns from there.
import { chatJson, llmAvailable } from "../llm.js";
import { emitEvent, newId, saveRun } from "./store.js";
import { architect, design, entrepreneur, think } from "./stages-evidence.js";
import { backend, brand, build, deploy, diff, launch, test } from "./stages-plan.js";

export const STAGES = [
  { id: "think", label: "Think", output: "Qloo taste read", run: think },
  { id: "architect", label: "Architect", output: "Gap map and product line", run: architect },
  { id: "design", label: "Design", output: "Collection plan", run: design },
  { id: "build", label: "Build", output: "Tech packs", run: build },
  { id: "backend", label: "Backend", output: "Costing, SKUs and city split", run: backend },
  { id: "test", label: "Test", output: "Qloo evidence check", run: test },
  { id: "diff", label: "Diff", output: "With vs without Qloo", run: diff },
  { id: "entrepreneur", label: "Entrepreneur", output: "Channels, pricing, partners", run: entrepreneur },
  { id: "brand", label: "Brand", output: "Name, story, taglines", run: brand },
  { id: "launch", label: "Launch", output: "30-day plan", run: launch },
  { id: "deploy", label: "Deploy", output: "Live drop page", run: deploy },
];

export const MAKERS = ["clothing", "streetwear", "ethnic wear", "kidswear", "footwear", "accessories", "merch"];
const STAGE_TIMEOUT_MS = 120000;
const active = new Map(); // runId -> Promise

// ---------- input ----------

const ENTITY_TYPES = ["artist", "tv_show", "movie", "person", "brand", "videogame", "podcast", "book"];

/** Turn a free-text request into structured input, with the model when available. */
export async function parseInput(body) {
  const input = {
    text: String(body.text ?? "").slice(0, 600),
    maker: typeof body.maker === "string" ? body.maker.slice(0, 40) : "",
    city: typeof body.city === "string" ? body.city.slice(0, 80) : "",
    markets: Array.isArray(body.markets) ? body.markets.map((m) => String(m).slice(0, 40)).slice(0, 3) : [],
    loves: Array.isArray(body.loves) ? body.loves.slice(0, 3).map((w) => (typeof w === "string" ? { name: w.slice(0, 80) } : { name: String(w.name).slice(0, 80), type: w.type })) : [],
    angle: typeof body.angle === "string" ? body.angle.slice(0, 80) : "",
  };

  if (input.text && (!input.loves.length || !input.markets.length) && llmAvailable()) {
    const parsed = await chatJson({
      system: `Extract a structured request from a maker's message. Return JSON:
{"loves":[{"name":"exact well-known title or artist name","type":"one of ${ENTITY_TYPES.join("|")}"}],"markets":["full country names, 1-3"],"city":"home city with country if given, else \\"\\"","maker":"what they make, 1-3 words","angle":"specific product if given, else \\"\\""}
Only include real, well-known entities. If the message names a genre (e.g. K-dramas), pick one or two famous, current examples of it. If no market is given, infer from the city's country, else use ["India"].`,
      user: input.text,
      temperature: 0.1,
    }).catch(() => ({}));
    input.loves = input.loves.length ? input.loves : (parsed.loves ?? []).filter((w) => w?.name).slice(0, 3).map((w) => ({ name: String(w.name).slice(0, 80), type: ENTITY_TYPES.includes(w.type) ? w.type : undefined }));
    input.markets = input.markets.length ? input.markets : (parsed.markets ?? []).filter(Boolean).slice(0, 3);
    input.city ||= String(parsed.city ?? "").slice(0, 80);
    input.maker ||= String(parsed.maker ?? "").slice(0, 40);
    input.angle ||= String(parsed.angle ?? "").slice(0, 80);
  }
  if (!input.loves.length && input.text) input.loves = input.text.split(/\s*[,;+]\s*|\s+and\s+/i).filter(Boolean).slice(0, 3).map((name) => ({ name: name.slice(0, 80) }));
  if (!input.loves.length) throw new Error("Tell the agent which show, artist or film you love.");
  if (!input.markets.length) input.markets = [input.city.split(",").at(-1)?.trim() || "India"];
  input.maker ||= "clothing";
  input.homeMarket = input.city ? input.markets.find((m) => input.city.toLowerCase().includes(m.toLowerCase())) ?? input.markets[0] : undefined;
  return input;
}

// ---------- runs ----------

export async function createRun(input, meta = {}) {
  const run = {
    id: newId("r"),
    version: 1,
    createdAt: new Date().toISOString(),
    mode: meta.mode ?? "live",
    input,
    stages: Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending" }])),
    ledger: [],
    entities: {},
    names: {},
    events: [],
  };
  await saveRun(run);
  return run;
}

export function startRun(run, fromIndex = 0) {
  if (active.has(run.id)) return active.get(run.id);
  const p = execute(run, fromIndex).finally(() => active.delete(run.id));
  active.set(run.id, p);
  return p;
}

export const isRunning = (runId) => active.has(runId);

async function execute(run, fromIndex) {
  run.status = "running";
  run.version += 1;
  for (let i = fromIndex; i < STAGES.length; i += 1) run.stages[STAGES[i].id] = { ...run.stages[STAGES[i].id], status: i === fromIndex ? "running" : "stale", output: undefined, error: undefined };
  emitEvent(run, { type: "run", status: "running", from: STAGES[fromIndex].id });
  await saveRun(run);

  for (let i = fromIndex; i < STAGES.length; i += 1) {
    const stage = STAGES[i];
    const state = run.stages[stage.id];
    state.status = "running";
    state.startedAt = new Date().toISOString();
    emitEvent(run, { type: "stage", id: stage.id, status: "running" });
    try {
      const output = await withTimeout(stage.run(run), STAGE_TIMEOUT_MS, `${stage.label} took too long`);
      state.output = applyEdits(output, state.userEdits);
      state.status = "done";
      state.endedAt = new Date().toISOString();
      emitEvent(run, { type: "stage", id: stage.id, status: "done", output: state.output, summary: state.output?.summary });
    } catch (error) {
      state.status = "error";
      state.error = error.message;
      state.endedAt = new Date().toISOString();
      emitEvent(run, { type: "stage", id: stage.id, status: "error", error: error.message });
      run.status = "error";
      emitEvent(run, { type: "run", status: "error", at_stage: stage.id, message: error.message });
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

/** Apply edits to stage `stageId` without rerunning it, then rerun everything after it. */
export async function editAndRerun(run, stageId, edits) {
  const index = STAGES.findIndex((s) => s.id === stageId);
  if (index < 0) throw new Error("Unknown stage");
  if (isRunning(run.id)) throw new Error("This run is still working. Wait for it to finish.");
  const state = run.stages[stageId];
  if (state.status !== "done") throw new Error("Only finished stages can be edited.");
  state.userEdits = { ...(state.userEdits ?? {}), ...edits };
  state.output = applyEdits(state.output, edits);
  emitEvent(run, { type: "stage", id: stageId, status: "done", output: state.output, edited: true });
  await saveRun(run);
  if (index + 1 < STAGES.length) return startRun(run, index + 1);
  return run;
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms)))]).finally(() => clearTimeout(timer));
}
