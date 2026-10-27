// Evidence layer: every Qloo request a stage makes goes through here, so it is
// recorded in the run's ledger (the "receipts") and streamed to the browser.
import { qlooInsights, qlooSearch, qlooTool } from "../qloo.js";
import { emitEvent } from "./store.js";

export function evidenceFor(run, stageId) {
  run.ledger ??= [];
  const record = async (title, tool, args, fn) => {
    const id = `c_${String(run.ledger.length + 1).padStart(3, "0")}`;
    const entry = { id, stage: stageId, title, tool, args, status: "running", at: new Date().toISOString() };
    run.ledger.push(entry);
    emitEvent(run, { type: "call", ...entry });
    const started = Date.now();
    try {
      const value = await fn();
      Object.assign(entry, {
        status: "done",
        ms: Date.now() - started,
        count: value?.result_count ?? value?.results?.length ?? value?.results?.heatmap?.length ?? value?.results?.tags?.length ?? value?.results?.entities?.length,
        provenance: value?.provenance ?? { source: "Qloo API", endpoint: "/v2/insights", requests: [{ method: "GET", path: "/v2/insights", query: args }] },
        envelopeStatus: value?.status,
      });
      emitEvent(run, { type: "call", ...entry });
      return value;
    } catch (error) {
      Object.assign(entry, { status: "error", ms: Date.now() - started, error: error.message });
      emitEvent(run, { type: "call", ...entry });
      throw error;
    }
  };
  return {
    tool: (title, name, args) => record(title, name, args, () => qlooTool(name, args)),
    insights: (title, params) => record(title, "qloo api insights", params, () => qlooInsights(params)),
    /** Run and swallow: returns undefined on failure, after recording it. */
    tryTool: (title, name, args) => record(title, name, args, () => qlooTool(name, args)).catch(() => undefined),
    tryInsights: (title, params) => record(title, "qloo api insights", params, () => qlooInsights(params)).catch(() => undefined),
    trySearch: (title, args) => record(title, "qloo api search", args, () => qlooSearch(args)).catch(() => undefined),
    /** A step made of several Qloo requests, recorded as one receipt; fn returns { results, provenance }. */
    tryStep: (title, tool, args, fn) => record(title, tool, args, fn).catch(() => undefined),
  };
}

/** Register a Qloo-returned entity in the run so later stages and the Test stage can check names. */
export function registerEntity(run, entity) {
  run.entities ??= {};
  if (!entity?.id || !entity?.name) return;
  run.entities[entity.id] = { id: entity.id, name: entity.name, type: entity.type, source: entity.source };
}

export function registerName(run, name, kind, extra = {}) {
  run.names ??= {};
  if (!name) return;
  run.names[String(name).toLowerCase()] = { name, kind, ...extra };
}

/** Is this name something Qloo actually returned (entity, brand, tag, city)? */
export function isKnownName(run, name) {
  return Boolean(run.names?.[String(name ?? "").toLowerCase()]);
}
