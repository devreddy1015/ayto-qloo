// Minimal Groq client (OpenAI-compatible chat completions with tool calling).
import { config } from "./config.js";

export class LlmError extends Error {}

let workingModel; // remembered after the first successful call

export const llmAvailable = () => Boolean(config.groq.apiKey);

async function post(body) {
  const response = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.groq.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, headers: response.headers };
}

/**
 * One chat completion. Tries the configured models in order until one works.
 * Returns the assistant message ({ content, tool_calls }).
 */
export async function chat({ messages, tools, json = false, temperature = 0.3, maxTokens = 2048 }) {
  if (!llmAvailable()) throw new LlmError("No GROQ_API_KEY configured.");
  const models = workingModel ? [workingModel, ...config.groq.models.filter((m) => m !== workingModel)] : config.groq.models;

  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
      };
      const { status, json: payload, text, headers } = await post(body).catch((error) => ({
        status: 0,
        text: error.message,
      }));

      if (status === 200 && payload?.choices?.[0]?.message) {
        workingModel = model;
        return payload.choices[0].message;
      }
      lastError = new LlmError(`Groq ${model} ${status}: ${(payload?.error?.message || text || "").slice(0, 300)}`);

      if (status === 429 || status >= 500 || status === 0) {
        const wait = Math.min(Number(headers?.get?.("retry-after")) * 1000 || 1500 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // A failed JSON-mode generation is worth one retry on the same model.
      if (status === 400 && payload?.error?.code === "json_validate_failed" && attempt === 0) continue;
      break; // model not available / bad request: try the next model
    }
  }
  throw lastError ?? new LlmError("Groq request failed");
}

/** Ask for a JSON object and parse it. */
export async function chatJson({ system, user, temperature = 0.2, maxTokens = 2048 }) {
  const message = await chat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
    temperature,
    maxTokens,
  });
  const raw = message.content ?? "";
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new LlmError("Model did not return JSON");
  }
}

export const currentModel = () => workingModel ?? config.groq.models[0];
