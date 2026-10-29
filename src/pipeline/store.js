// Run store: one JSON document per run, kept in memory and written to disk
// after every change so a run survives a restart and can be resumed.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { config } from "../config.js";

const DIR = join(config.cacheDir, "runs");
const runs = new Map(); // runId -> run (a bounded working set; the disk is the record)
const listeners = new Map(); // runId -> Set<fn(event)>
const slugs = new Map(); // share slug -> runId
let slugsIndexed = false;
const MAX_IN_MEMORY = 150;
const QUIET_MS = 10 * 60 * 1000;

/** Drop the least recently updated runs from memory once there are too many; never one touched in the last ten minutes. */
function evict() {
  if (runs.size <= MAX_IN_MEMORY) return;
  const now = Date.now();
  const old = [...runs.values()].filter((r) => r.status !== "running" && now - Date.parse(r.updatedAt ?? 0) > QUIET_MS).sort((a, b) => Date.parse(a.updatedAt ?? 0) - Date.parse(b.updatedAt ?? 0));
  for (const r of old.slice(0, runs.size - MAX_IN_MEMORY)) runs.delete(r.id);
}

export const newId = (prefix = "r") => `${prefix}_${randomBytes(5).toString("base64url")}`;

export async function saveRun(run) {
  run.updatedAt = new Date().toISOString();
  runs.set(run.id, run);
  if (run.publish?.slug) slugs.set(run.publish.slug, run.id);
  evict();
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, `${run.id}.json`), JSON.stringify(run)).catch(() => {});
  return run;
}

export async function loadRun(id) {
  if (runs.has(id)) return runs.get(id);
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(id)) return undefined;
  try {
    const run = JSON.parse(await readFile(join(DIR, `${id}.json`), "utf8"));
    runs.set(id, run);
    if (run.publish?.slug) slugs.set(run.publish.slug, run.id);
    evict();
    return run;
  } catch {
    return undefined;
  }
}

/** A share slug to its run: from the index, built once from disk without holding every run in memory. */
export async function findRunBySlug(slug) {
  if (!slugs.has(slug) && !slugsIndexed) {
    slugsIndexed = true;
    try {
      for (const file of await readdir(DIR)) {
        if (!file.endsWith(".json")) continue;
        try {
          const text = await readFile(join(DIR, file), "utf8");
          const m = text.match(/"slug":"([a-z0-9-]{3,60})"/);
          if (m && !slugs.has(m[1])) slugs.set(m[1], file.replace(/\.json$/, ""));
        } catch {}
      }
    } catch {}
  }
  const id = slugs.get(slug);
  return id ? loadRun(id) : undefined;
}

/** Append an event to the run's log and fan it out to live subscribers. */
export function emitEvent(run, event) {
  run.events ??= [];
  const seq = run.events.length + 1;
  const stamped = { seq, at: Date.now(), ...event };
  run.events.push(stamped);
  // Keep the log bounded; the state object holds the durable results.
  if (run.events.length > 600) run.events.splice(0, run.events.length - 600);
  for (const fn of listeners.get(run.id) ?? []) {
    try {
      fn(stamped);
    } catch {}
  }
  return stamped;
}

export function subscribe(runId, fn) {
  if (!listeners.has(runId)) listeners.set(runId, new Set());
  listeners.get(runId).add(fn);
  return () => listeners.get(runId)?.delete(fn);
}

/** A view of the run safe to send to the browser (no internals). */
export function publicRun(run) {
  const { events, ...rest } = run;
  return rest;
}

/** The most recently updated runs on disk (and in memory), newest first. */
export async function recentRuns({ limit = 8 } = {}) {
  let files = [];
  try {
    const { stat } = await import("node:fs/promises");
    const names = (await readdir(DIR)).filter((f) => f.endsWith(".json"));
    files = (await Promise.all(names.map(async (f) => ({ id: f.replace(/\.json$/, ""), at: (await stat(join(DIR, f))).mtimeMs })))).sort((a, b) => b.at - a.at).slice(0, limit * 3);
  } catch {}
  const out = [];
  for (const { id } of files) {
    const run = await loadRun(id);
    if (run) out.push(run);
    if (out.length >= limit) break;
  }
  return out;
}
