// Stage: write. The format's writer turns the evidence digest into the thing.
// The user's own credential wins; the server default is capped and cached.
import { getRunCredential } from "../keys.js";
import { languageRule, languagesFor, WRITE_LANGUAGES, writeLanguage } from "../languages.js";
import { chatJson, llmAvailable, PROVIDERS, redact, serverCredential } from "../llm.js";
import { memo } from "../qloo.js";
import { WRITERS } from "../writers/index.js";
import { emitEvent } from "./store.js";

/**
 * One writing pass. `forbid` lists names a previous pass invented; the writer
 * is told they are not in the evidence and must not appear.
 */
export async function writeWith(run, { forbid = [] } = {}) {
  const writer = WRITERS[run.input.format] ?? WRITERS.film;
  const evidence = writer.evidence(run);
  const credential = getRunCredential(run.id);
  const canWrite = Boolean(credential) || llmAvailable();
  const language = writeLanguage(run.input.language);
  const system = [writer.system, languageRule(language), forbid.length ? `A check found these names are NOT in the evidence. Do not use them, and do not replace them with anything that is not in the evidence either: ${forbid.join("; ")}.` : ""].filter(Boolean).join("\n\n");
  let plan;
  let error;
  if (canWrite) {
    emitEvent(run, { type: "thought", stage: "write", text: forbid.length ? `Writing again with ${forbid.length} name${forbid.length === 1 ? "" : "s"} banned…` : writer.thought });
    try {
      const call = () => chatJson({ credential, system, user: JSON.stringify(evidence), temperature: 0.6, maxTokens: writer.maxTokens ?? 2400 });
      // Server-key runs are cached by evidence so repeat visits are free; a user's own key always writes fresh.
      plan = credential ? await call() : await memo("llm", `write-${writer.id}-v1`, { system, evidence }, call);
    } catch (e) {
      error = redact(e.message).slice(0, 240);
      emitEvent(run, { type: "thought", stage: "write", text: `The language model failed (${error}). Showing the evidence as a template.` });
    }
  }
  const fallback = !plan;
  const template = writer.fallback(evidence);
  const repaired = Boolean(plan?._repaired);
  let filled = [];
  if (plan) ({ plan, filled } = normalizePlan(plan, template));
  plan ??= template;
  const server = serverCredential();
  const llm = credential ? { provider: credential.provider, model: credential.model ?? PROVIDERS[credential.provider].model, byok: true } : { provider: server?.provider ?? "none", model: server ? server.model ?? PROVIDERS[server.provider].model : undefined, byok: false, server: true };
  return {
    writer: writer.id,
    plan,
    evidence,
    llm,
    fallback,
    error,
    canWrite,
    filled,
    repaired,
    language: language ?? "English",
    languageCode: WRITE_LANGUAGES[language ?? "English"].code,
    languageFont: WRITE_LANGUAGES[language ?? "English"].font,
    languages: languagesFor(run.stages.resolve?.output?.city),
    summary: fallback
      ? `${canWrite ? "Model failed; template shown." : "No language model: template from the evidence. Add a key to write."}${language ? ` The template is in English; ${language} needs a language model.` : ""}`
      : `Written by ${llm.provider}${llm.model ? ` (${llm.model})` : ""}${language ? ` in ${language}` : ""}.${repaired ? " The reply was cut off; the complete part was kept." : ""}${filled.length ? ` ${filled.length} section${filled.length === 1 ? "" : "s"} the model left empty came from the evidence (${filled.join(", ").replace(/_/g, " ")}).` : ""}`,
  };
}

export const write = (run) => writeWith(run);

const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.some((x) => !isEmpty(x))) || (typeof v === "object" && !Array.isArray(v) && !Object.values(v).some((x) => !isEmpty(x)));
const textOf = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : Array.isArray(v) ? v.map(textOf).filter(Boolean).join(", ") : v && typeof v === "object" ? Object.values(v).map(textOf).filter(Boolean).join(" · ") : "");

/** One value in the shape the template has for it: a list, a text, or an object with the template's keys. */
function coerce(v, t) {
  if (t === undefined) return v;
  if (Array.isArray(t)) {
    const list = Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : typeof v === "string" ? v.split(/\n+/).map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()) : [v];
    // A plain text where the template has objects becomes an object on the template's first key ({ title }, { artist }).
    const key = t[0] && typeof t[0] === "object" ? Object.keys(t[0])[0] : undefined;
    return list.filter((x) => !isEmpty(x)).map((x) => (key && typeof x === "string" ? { [key]: x } : x));
  }
  if (typeof t === "string") return typeof v === "string" ? v : textOf(v);
  if (t && typeof t === "object") {
    const keys = Object.keys(t);
    const obj = v && typeof v === "object" && !Array.isArray(v) ? { ...v } : typeof v === "string" && keys.length ? { [keys[0]]: v } : {};
    for (const k of keys) if (k in obj || t[k] !== undefined) obj[k] = coerce(obj[k], t[k]);
    return obj;
  }
  return v;
}

/**
 * A model's plan, made safe to render and complete: every field in the shape the writer's template has, and a
 * field the model left empty (no locations, no references) filled from the evidence template, which holds only
 * Qloo names. Returns the plan and the fields that were filled.
 */
export function normalizePlan(plan, template) {
  const filled = [];
  const out = {};
  for (const [k, t] of Object.entries(template ?? {})) {
    if (k === "fallback") continue;
    let v = coerce(plan?.[k], t);
    if (isEmpty(v) && !isEmpty(t)) {
      v = t;
      filled.push(k);
    } else if (t && typeof t === "object" && !Array.isArray(t) && v && typeof v === "object") {
      // An empty part of an object (the lane's "why") takes the evidence's own wording.
      for (const [sk, sv] of Object.entries(t)) if (isEmpty(v[sk]) && !isEmpty(sv)) v[sk] = sv;
    }
    if (v !== undefined) out[k] = v;
  }
  for (const [k, v] of Object.entries(plan ?? {})) if (!(k in out) && !k.startsWith("_")) out[k] = v;
  return { plan: out, filled };
}
