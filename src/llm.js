// The language-model layer. One OpenAI-compatible client with a provider table,
// a small Anthropic adapter, a key redactor, and a boot-time probe so "LLM on"
// means a call actually succeeded, not that a key exists.
//
// Credentials: the server's own key (config.groq) is the default. A run can
// carry the user's own credential { provider, key, model } instead; it lives in
// memory (keys.js), never in a run file, an event, the cache or a log line.
import { config } from "./config.js";

export class LlmError extends Error {}

export const PROVIDERS = {
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", keyHint: "gsk_…", json: true },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini", keyHint: "sk-…", json: true },
  anthropic: { label: "Anthropic", kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-5-5", keyHint: "sk-ant-…", json: false },
  gemini: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", keyHint: "AIza…", json: true },
  mistral: { label: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", keyHint: "…", json: true },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct", keyHint: "sk-or-…", json: false },
  together: { label: "Together", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyHint: "…", json: true },
  fireworks: { label: "Fireworks", baseUrl: "https://api.fireworks.ai/inference/v1", model: "accounts/fireworks/models/llama-v3p3-70b-instruct", keyHint: "fw_…", json: true },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", keyHint: "sk-…", json: true },
  xai: { label: "xAI", baseUrl: "https://api.x.ai/v1", model: "grok-3-mini", keyHint: "xai-…", json: true },
  cerebras: { label: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", model: "llama-3.3-70b", keyHint: "csk-…", json: true },
  sambanova: { label: "SambaNova", baseUrl: "https://api.sambanova.ai/v1", model: "Meta-Llama-3.3-70B-Instruct", keyHint: "…", json: true },
};

/** Public view of the provider table (no secrets in it, but keep it explicit). */
export const providerList = () => Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, model: p.model, keyHint: p.keyHint }));

/** Strip anything that looks like an API key from text that may reach a log, an event or the browser. */
export function redact(text) {
  return String(text ?? "")
    .replace(/\b(sk-ant-|sk-or-|sk-|gsk_|AIza|xai-|csk-|fw_|hf_|r8_)[A-Za-z0-9_\-]{8,}/g, "$1[redacted]")
    .replace(/\b[A-Za-z0-9_\-]{40,}\b/g, "[redacted]")
    .replace(/(authorization|x-api-key|api[-_]?key)(["':\s=]+)[^\s"',]+/gi, "$1$2[redacted]");
}

const serverCredential = () => (config.groq.apiKey ? { provider: "groq", key: config.groq.apiKey, model: undefined, server: true } : undefined);

/** Normalise and validate a user credential. Throws on a bad provider; never logs the key. */
export function credentialFrom(body) {
  if (!body || typeof body !== "object") return undefined;
  const provider = String(body.provider ?? "").toLowerCase();
  if (!PROVIDERS[provider]) throw new LlmError(`Unknown LLM provider “${provider.slice(0, 20)}”.`);
  const key = String(body.key ?? "").trim();
  if (key.length < 8 || key.length > 300 || /\s/.test(key)) throw new LlmError("That key doesn't look right.");
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim().slice(0, 120) : undefined;
  return { provider, key, model };
}

async function postJson(url, headers, body) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, headers: response.headers };
}

function openaiCall(p, cred, model, { messages, tools, json, temperature, maxTokens }) {
  const body = { model, messages, temperature, max_tokens: maxTokens, ...(tools?.length ? { tools, tool_choice: "auto" } : {}), ...(json && p.json ? { response_format: { type: "json_object" } } : {}) };
  const headers = { authorization: `Bearer ${cred.key}` };
  if (cred.provider === "openrouter") Object.assign(headers, { "http-referer": "https://ayto.app", "x-title": "AYTO" });
  return postJson(`${p.baseUrl}/chat/completions`, headers, body).then((r) => ({ ...r, message: r.status === 200 ? r.json?.choices?.[0]?.message : undefined }));
}

function anthropicCall(p, cred, model, { messages, json, temperature, maxTokens }) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") + (json ? "\n\nReturn only a JSON object. No prose, no code fences." : "");
  const turns = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }));
  return postJson(`${p.baseUrl}/messages`, { "x-api-key": cred.key, "anthropic-version": "2023-06-01" }, { model, max_tokens: maxTokens, temperature, system, messages: turns }).then((r) => ({
    ...r,
    message: r.status === 200 ? { role: "assistant", content: (r.json?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("") } : undefined,
  }));
}

let workingModel; // the server default model that last worked

/**
 * One chat completion. `credential` picks the provider and key; without one the
 * server default is used and its model list is tried in order.
 */
export async function chat({ credential, messages, tools, json = false, temperature = 0.3, maxTokens = 2048 }) {
  const cred = credential ?? serverCredential();
  if (!cred) throw new LlmError("No language model configured. Add a key in the drawer or set GROQ_API_KEY.");
  const p = PROVIDERS[cred.provider];
  const models = cred.model ? [cred.model] : cred.server ? (workingModel ? [workingModel, ...config.groq.models.filter((m) => m !== workingModel)] : config.groq.models) : [p.model];
  if (p.kind === "anthropic" && tools?.length) throw new LlmError("Tool calls need an OpenAI-compatible provider.");

  let lastError;
  for (const model of models) {
    let useJson = json;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const call = p.kind === "anthropic" ? anthropicCall : openaiCall;
      const r = await call(p, cred, model, { messages, tools, json: useJson, temperature, maxTokens }).catch((error) => ({ status: 0, text: error?.name === "TimeoutError" ? "timed out" : String(error?.message ?? error) }));
      if (r.message) {
        if (cred.server) workingModel = model;
        return r.message;
      }
      const detail = redact(r.json?.error?.message || r.json?.error?.msg || r.text || "").slice(0, 240);
      lastError = new LlmError(`${p.label} ${model} ${r.status || "network"}: ${detail}`);
      if (r.status === 429 || r.status >= 500 || r.status === 0) {
        await new Promise((res) => setTimeout(res, Math.min(Number(r.headers?.get?.("retry-after")) * 1000 || 1500 * 2 ** attempt, 8000)));
        continue;
      }
      if (r.status === 400 && useJson && /response_format|json/i.test(detail)) {
        useJson = false; // the provider rejects JSON mode: ask plainly, parse what comes back
        continue;
      }
      if (r.status === 400 && r.json?.error?.code === "json_validate_failed" && attempt === 0) continue;
      break;
    }
  }
  throw lastError ?? new LlmError("Language model request failed");
}

/** Ask for a JSON object and parse it. */
export async function chatJson({ credential, system, user, temperature = 0.2, maxTokens = 2048 }) {
  const message = await chat({ credential, messages: [{ role: "system", content: system }, { role: "user", content: user }], json: true, temperature, maxTokens });
  const raw = String(message.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new LlmError("Model did not return JSON");
  }
}

/** One tiny call to prove a credential works. Returns { ok, model, error }. */
export async function checkCredential(credential) {
  try {
    const m = await chat({ credential, messages: [{ role: "system", content: "Reply with the single word: ok" }, { role: "user", content: "ready?" }], temperature: 0, maxTokens: 8 });
    return { ok: true, model: credential?.model ?? (credential ? PROVIDERS[credential.provider].model : workingModel), reply: String(m.content ?? "").slice(0, 20) };
  } catch (error) {
    return { ok: false, error: redact(error.message).slice(0, 240) };
  }
}

// ---------- server default status ----------

let status = { available: Boolean(config.groq.apiKey), probed: false, model: undefined, error: undefined };

/** Probe the server default once (at boot). "available" then means a call succeeded. */
export async function probeServerLlm() {
  if (!config.groq.apiKey) return (status = { available: false, probed: true, error: "No GROQ_API_KEY" });
  const r = await checkCredential(undefined);
  status = { available: r.ok, probed: true, model: r.ok ? workingModel : undefined, error: r.ok ? undefined : r.error, at: new Date().toISOString() };
  return status;
}

export const llmStatus = () => ({ ...status, model: status.model ?? workingModel ?? config.groq.models[0] });
export const llmAvailable = () => status.available;
export const currentModel = () => workingModel ?? config.groq.models[0];
