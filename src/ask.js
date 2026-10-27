// Follow-up questions about a scan. A tool-calling agent: the model decides which
// Qloo workflows to run (through the same `qloo mcp` server), reads the results,
// and answers with the evidence it used.
import { chat, llmAvailable } from "./llm.js";
import { listQlooTools, qlooTool } from "./qloo.js";

const ALLOWED = new Set([
  "qloo_recommend",
  "qloo_rank",
  "qloo_describe",
  "qloo_where_popular",
  "qloo_compare_audiences",
  "qloo_entity_tags",
  "qloo_audience_demographics",
  "qloo_trends",
  "qloo_find_tags",
]);
const MAX_STEPS = 6;

let toolSpecsPromise;
function toolSpecs() {
  toolSpecsPromise ??= listQlooTools()
    .then((tools) =>
      tools
        .filter((t) => ALLOWED.has(t.name))
        .map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
    )
    .catch((error) => {
      toolSpecsPromise = undefined;
      throw error;
    });
  return toolSpecsPromise;
}

/** Shrink a Qloo envelope to what the model needs, so it fits the context. */
function forModel(env) {
  const pick = (r) => {
    if (!r || typeof r !== "object") return r;
    const { entity_id, id, name, type, subtype, affinity, popularity } = r;
    if (name || entity_id || id) return { id: entity_id ?? id, name, type: subtype ?? type, affinity, popularity };
    if (r.location || r.query) return { location: r.location, affinity: r.query?.affinity, popularity: r.query?.popularity };
    return r;
  };
  const results = Array.isArray(env.results) ? env.results.slice(0, 15).map(pick) : env.results;
  const series = env.series?.map((s) => ({ entity: s.entity?.name, points: (s.points ?? []).slice(-12) }));
  const text = JSON.stringify({
    status: env.status,
    summary: env.summary,
    interpretation: env.interpretation,
    results,
    ...(series ? { series } : {}),
    issues: env.resolution?.issues?.map((i) => ({ input: i.input, kind: i.kind, candidates: i.candidates?.slice(0, 3) })),
  });
  return text.length > 7000 ? `${text.slice(0, 7000)}…` : text;
}

const SYSTEM = (context) => `You are Culture Gap's analyst. You help small fashion makers, boutiques and brands read cultural trends with Qloo's taste graph.
You can call Qloo workflow tools. Use them whenever the question needs data you don't already have; do not guess taste data.
Guidance:
- Resolve vague words first: qloo_find_tags for concepts, qloo_describe for named things. If a result says needs_input, pick the most sensible candidate and say which one you used.
- "Fans of X also like…": qloo_recommend with signals and target_type (brand for fashion). Add signal_location for a country or city.
- "Where?": qloo_where_popular with entity and within.
- "Rising?": qloo_trends with entities, entity_type and dates (YYYY-MM-DD; today is ${new Date().toISOString().slice(0, 10)}).
- Compare two fan bases: qloo_compare_audiences.
Answer in under 150 words, plain English, concrete for a maker. Name what came from Qloo versus your own interpretation. Qloo shows aggregate affinity, not individual behaviour or sales; never claim certainty.
Never infer sensitive traits about people (health, religion, politics, ethnicity, sexuality).
Context from the scan the user is looking at:
${JSON.stringify(context).slice(0, 6000)}`;

export async function runAsk({ question, context }, emit) {
  if (!llmAvailable()) throw new Error("Follow-up questions need the language model, which isn't configured.");
  const tools = await toolSpecs();
  const messages = [
    { role: "system", content: SYSTEM(context ?? {}) },
    { role: "user", content: String(question).slice(0, 800) },
  ];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const message = await chat({ messages, tools, temperature: 0.2, maxTokens: 1200 });
    const calls = message.tool_calls ?? [];
    if (!calls.length) {
      emit({ type: "answer", text: message.content ?? "" });
      return message.content ?? "";
    }
    messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });

    for (const call of calls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      const id = call.id;
      if (!ALLOWED.has(name)) {
        messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify({ error: "Unknown tool" }) });
        continue;
      }
      emit({ type: "call", id, status: "running", title: name.replace(/^qloo_/, "").replace(/_/g, " "), tool: name, args });
      const started = Date.now();
      try {
        const env = await qlooTool(name, args);
        emit({ type: "call", id, status: "done", tool: name, ms: Date.now() - started, count: env.result_count, provenance: env.provenance });
        messages.push({ role: "tool", tool_call_id: id, content: forModel(env) });
      } catch (error) {
        emit({ type: "call", id, status: "error", tool: name, ms: Date.now() - started, error: error.message });
        messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify({ error: error.message, recovery: error.envelope?.error?.recovery }) });
      }
    }
  }

  // Out of steps: ask for an answer with what we have.
  messages.push({ role: "user", content: "Answer now with the evidence you have." });
  const final = await chat({ messages, temperature: 0.2, maxTokens: 800 });
  emit({ type: "answer", text: final.content ?? "" });
  return final.content ?? "";
}
