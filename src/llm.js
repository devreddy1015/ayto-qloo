// The language-model layer. One OpenAI-compatible client with a provider table,
// a small Anthropic adapter, a key redactor, and a boot-time probe so "LLM on"
// means a call actually succeeded, not that a key exists.
//
// Credentials: the server's own key (config.groq) is the default. A run can
// carry the user's own credential { provider, key, model } instead; it lives in
// memory (keys.js), never in a run file, an event, the cache or a log line.
import { config } from "./config.js";
import { recordUsage } from "./usage.js";

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
  // deepseek-chat is the legacy name for V4 Flash without thinking. DeepSeek's change log retired it on 24 Jul 2026, but
  // on 31 Oct it still answered and wrote full treatments live; deepseek-flash (V4.1, thinking off) returned plans with
  // every section empty. Keep the name that writes until the newer model is checked against the writers.
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", keyHint: "sk-…", json: true },
  xai: { label: "xAI", baseUrl: "https://api.x.ai/v1", model: "grok-3-mini", keyHint: "xai-…", json: true },
  cerebras: { label: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", model: "llama-3.3-70b", keyHint: "csk-…", json: true },
  sambanova: { label: "SambaNova", baseUrl: "https://api.sambanova.ai/v1", model: "Meta-Llama-3.3-70B-Instruct", keyHint: "…", json: true },
  // Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM), for the server only: set LLM_PROVIDER=local and
  // LLM_BASE_URL. Never offered to the browser, so a hosted server can't be pointed at an arbitrary address.
  local: { label: "Local OpenAI-compatible", get baseUrl() { return String(process.env.LLM_BASE_URL ?? "").replace(/\/+$/, ""); }, model: "local-model", keyHint: "…", json: true, serverOnly: true },
};

/** Public view of the provider table (no secrets in it, but keep it explicit). */
export const providerList = () => Object.entries(PROVIDERS).filter(([, p]) => !p.serverOnly).map(([id, p]) => ({ id, label: p.label, model: p.model, keyHint: p.keyHint }));

/** Strip anything that looks like an API key from text that may reach a log, an event or the browser. */
export function redact(text) {
  return String(text ?? "")
    .replace(/\b(sk-ant-|sk-or-|sk-|gsk_|AIza|xai-|csk-|fw_|hf_|r8_)[A-Za-z0-9_\-]{8,}/g, "$1[redacted]")
    .replace(/\bBearer\s+[^\s"',]+/gi, "Bearer [redacted]")
    // Long random tokens: 40+ characters, or 32+ with both letters and digits (Mistral keys, UUID keys).
    .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, (m) => (m.length >= 40 || (/[A-Za-z]/.test(m) && /\d/.test(m)) ? "[redacted]" : m))
    .replace(/(authorization|x-api-key|api[-_]?key)(["':\s=]+)(?!Bearer \[redacted\])[^\s"',]+/gi, "$1$2[redacted]");
}

/**
 * The server's own credential: LLM_PROVIDER + LLM_API_KEY if set, else the first
 * provider key found in the environment, in this order.
 */
const SERVER_KEYS = [["anthropic", "ANTHROPIC_API_KEY"], ["openai", "OPENAI_API_KEY"], ["groq", "GROQ_API_KEY"], ["gemini", "GEMINI_API_KEY"], ["mistral", "MISTRAL_API_KEY"], ["openrouter", "OPENROUTER_API_KEY"]];
export function serverCredential() {
  const explicit = String(process.env.LLM_PROVIDER ?? "").toLowerCase();
  if (explicit === "local" && process.env.LLM_BASE_URL) return { provider: "local", key: process.env.LLM_API_KEY || "local", model: process.env.LLM_MODEL || "local-model", server: true };
  if (explicit && PROVIDERS[explicit] && process.env.LLM_API_KEY) return { provider: explicit, key: process.env.LLM_API_KEY, model: process.env.LLM_MODEL || undefined, server: true };
  for (const [provider, name] of SERVER_KEYS) {
    const key = String(process.env[name] ?? "").trim();
    if (key.length >= 12) return { provider, key, model: process.env.LLM_MODEL || undefined, server: true };
  }
  return undefined;
}

/** Normalise and validate a user credential. Throws on a bad provider; never logs the key. */
/**
 * The server's backup writer: DeepSeek, when DEEPSEEK_API_KEY is set and the server's own model is something else.
 * It answers only for the server's own key (never a visitor's) and only after that model has failed.
 * DEEPSEEK_MODEL picks the model; DEEPSEEK_BASE_URL is for tests.
 */
export function backupCredential(primary = serverCredential()) {
  const key = String(process.env.DEEPSEEK_API_KEY ?? "").trim();
  if (key.length < 12 || !primary?.server || primary.backup || primary.provider === "deepseek") return undefined;
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL ?? "").replace(/\/+$/, "") || undefined;
  return { provider: "deepseek", key, model: String(process.env.DEEPSEEK_MODEL ?? "").trim() || PROVIDERS.deepseek.model, server: true, backup: true, ...(baseUrl ? { baseUrl } : {}) };
}

export function credentialFrom(body) {
  if (!body || typeof body !== "object") return undefined;
  const provider = String(body.provider ?? "").toLowerCase();
  if (!PROVIDERS[provider] || PROVIDERS[provider].serverOnly) throw new LlmError(`Unknown LLM provider “${provider.slice(0, 20)}”.`);
  const key = String(body.key ?? "").trim();
  // Printable ASCII only: a control character would make fetch throw with the key inside its error message.
  if (key.length < 8 || key.length > 300 || !/^[\x21-\x7e]+$/.test(key)) throw new LlmError("That key doesn't look right.");
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim().slice(0, 120) : undefined;
  return { provider, key, model };
}

async function postJson(url, headers, body, timeoutMs = 60000) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1000, timeoutMs)) });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, headers: response.headers };
}

function openaiCall(p, cred, model, { messages, tools, json, temperature, maxTokens, timeoutMs }) {
  const body = { model, messages: messages.map(({ blocks, ...m }) => m), temperature, max_tokens: maxTokens, ...(tools?.length ? { tools, tool_choice: "auto" } : {}), ...(json && p.json ? { response_format: { type: "json_object" } } : {}) };
  const headers = { authorization: `Bearer ${cred.key}` };
  if (cred.provider === "openrouter") Object.assign(headers, { "http-referer": "https://ayto.app", "x-title": "AYTO" });
  return postJson(`${cred.baseUrl ?? p.baseUrl}/chat/completions`, headers, body, timeoutMs).then((r) => ({ ...r, message: r.status === 200 ? r.json?.choices?.[0]?.message : undefined, usage: r.status === 200 ? { input: r.json?.usage?.prompt_tokens ?? 0, output: r.json?.usage?.completion_tokens ?? 0 } : undefined }));
}

/** OpenAI-style messages and tools → Anthropic Messages API, and the reply back to the OpenAI shape ask.js expects. */
// Claude 5.x takes no sampling settings (since 21 Oct 2026 a temperature is a 400 on every model). It thinks adaptively:
// low effort keeps a write fast, max_tokens leaves room for the thinking as well as the reply, and a tool loop passes the
// assistant's blocks back unchanged (thinking blocks included). A request a safety classifier declines is retried
// server-side on the model Anthropic recommends for that category.
const ANTHROPIC_MIN_TOKENS = 16000;
function anthropicCall(p, cred, model, { messages, tools, json, maxTokens, timeoutMs }) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") + (json ? "\n\nReturn only a JSON object. No prose, no code fences." : "");
  const turns = [];
  const push = (role, blocks) => {
    const last = turns.at(-1);
    if (last && last.role === role) last.content.push(...blocks); // Anthropic wants alternating roles; merge neighbours
    else turns.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") push("user", [{ type: "tool_result", tool_use_id: m.tool_call_id, content: String(m.content ?? "") }]);
    else if (m.role === "assistant" && m.blocks?.length) push("assistant", m.blocks);
    else if (m.role === "assistant" && m.tool_calls?.length) {
      const blocks = m.content ? [{ type: "text", text: String(m.content) }] : [];
      for (const c of m.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(c.function?.arguments || "{}");
        } catch {}
        blocks.push({ type: "tool_use", id: c.id, name: c.function?.name, input });
      }
      push("assistant", blocks);
    } else push(m.role === "assistant" ? "assistant" : "user", [{ type: "text", text: String(m.content ?? "") || "." }]);
  }
  // Effort is for the 5.x family (older Haiku and Sonnet reject it); server-side fallback is for the models that have one.
  const modern = /^claude-(?:opus|sonnet|fable|haiku|mythos)-5/.test(model);
  const fallback = /^claude-(?:opus-5(?:-5)?|sonnet-5-5|fable-5-1)$/.test(model);
  const body = { model, max_tokens: Math.max(maxTokens ?? 0, ANTHROPIC_MIN_TOKENS), system, messages: turns, ...(modern ? { output_config: { effort: "low" } } : {}), ...(fallback ? { fallbacks: "default" } : {}) };
  if (tools?.length) body.tools = tools.map((t) => ({ name: t.function.name, description: t.function.description ?? "", input_schema: t.function.parameters ?? { type: "object", properties: {} } }));
  return postJson(`${p.baseUrl}/messages`, { "x-api-key": cred.key, "anthropic-version": "2023-06-01", ...(fallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) }, body, timeoutMs).then((r) => {
    if (r.status !== 200) return { ...r, message: undefined };
    const blocks = r.json?.content ?? [];
    const text = blocks.filter((c) => c.type === "text").map((c) => c.text).join("");
    const calls = blocks.filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } }));
    return { ...r, message: { role: "assistant", content: text, ...(calls.length ? { tool_calls: calls, blocks } : {}) }, usage: { input: r.json?.usage?.input_tokens ?? 0, output: r.json?.usage?.output_tokens ?? 0 } };
  });
}

let workingModel; // the server default model that last worked

/**
 * One chat completion. `credential` picks the provider and key; without one the
 * server default is used and its model list is tried in order. `deadline` (a time in ms) bounds every attempt
 * and retry together, so a slow model gives up inside its stage's budget and the stage can fall back.
 */
export async function chat({ credential, ...ask }) {
  const cred = credential ?? serverCredential();
  if (!cred) throw new LlmError("No language model configured. Add a key in the drawer or set GROQ_API_KEY.");
  const backup = backupCredential(cred);
  if (!backup) return chatWith(cred, ask);
  // The server's model gets the budget less a reserve (a third, at most 30 s), so the backup still has time to write.
  const { deadline } = ask;
  // Whole milliseconds: a fractional timeout makes AbortSignal.timeout throw, which would fail every call to the main model.
  const reserve = deadline ? Math.floor(Math.min(30000, Math.max(0, (deadline - Date.now()) / 3))) : 0;
  try {
    return await chatWith(cred, { ...ask, deadline: deadline ? deadline - reserve : undefined });
  } catch (error) {
    try {
      const message = await chatWith(backup, ask);
      // Not enumerable: a tool loop sends this message back to a model, which mustn't see the marker.
      return Object.defineProperty(message, "_by", { value: { provider: backup.provider, model: backup.model, backup: true, after: error.message } });
    } catch (second) {
      throw new LlmError(`${error.message} · backup ${second.message}`);
    }
  }
}

async function chatWith(cred, { messages, tools, json = false, temperature = 0.3, maxTokens = 2048, deadline }) {
  const p = PROVIDERS[cred.provider];
  const models = cred.model ? [cred.model] : cred.server && cred.provider === "groq" ? (workingModel ? [workingModel, ...config.groq.models.filter((m) => m !== workingModel)] : config.groq.models) : [p.model];

  let lastError;
  for (const model of models) {
    let useJson = json;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const left = deadline ? deadline - Date.now() : 60000;
      if (left < 5000) throw lastError ?? new LlmError(`${p.label} ${model}: no answer in time.`);
      const call = p.kind === "anthropic" ? anthropicCall : openaiCall;
      const r = await call(p, cred, model, { messages, tools, json: useJson, temperature, maxTokens, timeoutMs: Math.min(60000, left) }).catch((error) => ({ status: 0, text: error?.name === "TimeoutError" ? "timed out" : String(error?.message ?? error) }));
      if (r.message) {
        if (cred.server && !cred.backup) workingModel = model; // the backup never becomes the site's model
        if (r.usage) recordUsage({ provider: cred.provider, model, input: r.usage.input, output: r.usage.output, byok: !cred.server });
        return r.message;
      }
      const detail = redact(r.json?.error?.message || r.json?.error?.msg || r.text || "").slice(0, 240);
      lastError = new LlmError(`${p.label} ${model} ${r.status || "network"}: ${detail}`);
      if (r.status === 429 || r.status >= 500 || r.status === 0) {
        const wait = Math.min(Number(r.headers?.get?.("retry-after")) * 1000 || 1500 * 2 ** attempt, 8000);
        if (deadline && Date.now() + wait > deadline - 5000) break;
        await new Promise((res) => setTimeout(res, wait));
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
export async function chatJson({ credential, system, user, temperature = 0.2, maxTokens = 2048, deadline }) {
  const message = await chat({ credential, messages: [{ role: "system", content: system }, { role: "user", content: user }], json: true, temperature, maxTokens, deadline });
  const parsed = parseModelJson(message.content);
  if (!parsed) throw new LlmError("Model did not return JSON");
  if (message._by?.backup) parsed._backup = { provider: message._by.provider, model: message._by.model };
  return parsed;
}

/**
 * The JSON object in a model's reply, however it arrives: after a <think> block, inside code fences, after a
 * sentence of prose, or cut off by the token limit (then the open strings and brackets are closed and the
 * half-written last item dropped, and the object is marked _repaired). Undefined when there is no object at all.
 */
export function parseModelJson(content) {
  const text = String(content ?? "").replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").replace(/```(?:json)?/gi, "");
  // Any "{" may start the object: the prose before it can hold braces of its own ("a film for {city}").
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    const rest = text.slice(start);
    const whole = closedObject(rest);
    if (whole) {
      try {
        const value = JSON.parse(whole);
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
      } catch {}
      continue;
    }
    // Never closed: the reply was cut off. Mend it if it starts the way a JSON object does.
    if (!/^\{\s*("|\})/.test(rest)) continue;
    const fixed = repairJson(rest);
    try {
      const value = fixed && JSON.parse(fixed);
      return value && typeof value === "object" ? Object.assign(value, { _repaired: true }) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The object that opens at text[0], up to its own closing brace (strings respected); undefined if it never closes. */
function closedObject(text) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth += 1;
    else if ((ch === "}" || ch === "]") && --depth === 0) return text.slice(0, i + 1);
  }
  return undefined;
}

/** Close a JSON text that stopped mid-way: trim back to the last complete value, then close what is open. */
export function repairJson(text) {
  const stack = [];
  let inString = false;
  let escaped = false;
  let lastSafe = -1; // index after the last complete value at any depth
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        lastSafe = i + 1;
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      stack.pop();
      lastSafe = i + 1;
      if (!stack.length) return text.slice(0, i + 1);
    } else if (/[-0-9tfn]/.test(ch)) {
      // A number or true/false/null counts only when whole: a reply cut off at "fal" or "1e" ends before it.
      let j = i;
      while (j < text.length && /[A-Za-z0-9.+-]/.test(text[j])) j += 1;
      if (/^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(text.slice(i, j))) lastSafe = j;
      i = j - 1;
    }
  }
  if (lastSafe < 0) return undefined;
  // Cut back to the last complete value, then drop a dangling key, colon or comma.
  let body = text.slice(0, lastSafe).replace(/,\s*"(?:[^"\\]|\\.)*"\s*$/, "").replace(/[,:]\s*$/, "");
  // A key whose value never came ({"a": 1, "b") is dropped too.
  body = body.replace(/,\s*"(?:[^"\\]|\\.)*"\s*$/, "").replace(/\{\s*"(?:[^"\\]|\\.)*"\s*$/, "{");
  // Recount what is still open after the cut.
  const open = [];
  let str = false;
  let esc = false;
  for (const ch of body) {
    if (str) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') str = false;
      continue;
    }
    if (ch === '"') str = true;
    else if (ch === "{" || ch === "[") open.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") open.pop();
  }
  return body + open.reverse().join("");
}

/** One tiny call to prove a credential works. Returns { ok, model, error }. */
export async function checkCredential(credential) {
  try {
    const m = await chat({ credential, messages: [{ role: "system", content: "Reply with the single word: ok" }, { role: "user", content: "ready?" }], temperature: 0, maxTokens: 8 });
    const cred = credential ?? serverCredential();
    return { ok: true, provider: cred?.provider, model: credential?.model ?? workingModel ?? (cred ? PROVIDERS[cred.provider].model : undefined), reply: String(m.content ?? "").slice(0, 20), ...(m._by?.backup ? { via: m._by.provider } : {}) };
  } catch (error) {
    return { ok: false, error: redact(error.message).slice(0, 240) };
  }
}

// ---------- server default status ----------

/** Probe the server default once (at boot). "available" then means a call succeeded. */
let probedAt = 0;
export async function probeServerLlm() {
  probedAt = Date.now();
  const cred = serverCredential();
  if (!cred) return (status = { available: false, probed: true, error: "No server LLM key (ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY…)" });
  const r = await checkCredential(undefined);
  status = { available: r.ok, probed: true, provider: cred.provider, model: r.ok ? (workingModel ?? cred.model ?? PROVIDERS[cred.provider].model) : undefined, error: r.ok ? undefined : r.error, at: new Date().toISOString(), ...(r.via ? { via: r.via } : {}) };
  return status;
}

let status = { available: Boolean(serverCredential()), probed: false, provider: serverCredential()?.provider, model: undefined, error: undefined };
export const llmStatus = () => ({ ...status, model: status.model ?? workingModel ?? (status.provider ? PROVIDERS[status.provider].model : undefined), ...(backupCredential() ? { backup: "deepseek" } : {}) });
/** The server's model is there. One failed probe (a 429 at boot) isn't final: it is tried again every ten minutes. */
export const llmAvailable = () => {
  if (!status.available && status.probed && serverCredential() && Date.now() - probedAt > 10 * 60e3) probeServerLlm().catch(() => {});
  return status.available;
};
export const currentModel = () => workingModel ?? (serverCredential() ? serverCredential().model ?? PROVIDERS[serverCredential().provider].model : config.groq.models[0]);
