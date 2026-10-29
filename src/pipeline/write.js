// Stage: write. The format's writer turns the evidence digest into the thing.
// The user's own credential wins; the server default is capped and cached.
import { getRunCredential } from "../keys.js";
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
  const system = forbid.length ? `${writer.system}\n\nA check found these names are NOT in the evidence. Do not use them, and do not replace them with anything that is not in the evidence either: ${forbid.join("; ")}.` : writer.system;
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
  plan ??= writer.fallback(evidence);
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
    summary: fallback ? (canWrite ? "Model failed; template shown." : "No language model: template from the evidence. Add a key to write.") : `Written by ${llm.provider}${llm.model ? ` (${llm.model})` : ""}.`,
  };
}

export const write = (run) => writeWith(run);
