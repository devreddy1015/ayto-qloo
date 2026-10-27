// Run store: one JSON document per run, kept in memory and written to disk
// after every change so a run survives a restart and can be resumed.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { config } from "../config.js";

const DIR = join(config.cacheDir, "runs");
const runs = new Map(); // runId -> run
const listeners = new Map(); // runId -> Set<fn(event)>

export const newId = (prefix = "r") => `${prefix}_${randomBytes(5).toString("base64url")}`;

export async function saveRun(run) {
  run.updatedAt = new Date().toISOString();
  runs.set(run.id, run);
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
    return run;
  } catch {
    return undefined;
  }
}

export async function findRunBySlug(slug) {
  for (const run of runs.values()) if (run.publish?.slug === slug) return run;
  try {
    for (const file of await readdir(DIR)) {
      const run = await loadRun(file.replace(/\.json$/, ""));
      if (run?.publish?.slug === slug) return run;
    }
  } catch {}
  return undefined;
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
