// The agent door: AYTO as an MCP server over stateless Streamable HTTP. Three
// tools that call the same engine stages the web app runs. A user credential
// passed to ayto_write is used once and never stored.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { FORMAT_IDS } from "./formats.js";
import { credentialFrom } from "./llm.js";
import { parseInput } from "./parse.js";
import { createRun, startRun } from "./pipeline/runner.js";

const formatSchema = z.enum(FORMAT_IDS).describe("film, reel or fashion");
const cityDesc = "City with its country, e.g. 'Hyderabad, India'";

const digest = (run) => {
  const o = (id) => run.stages[id]?.output;
  return {
    run: run.id,
    status: run.status,
    resolve: o("resolve") && { city: o("resolve").city, contrast: o("resolve").contrast?.name, theme: o("resolve").theme?.tags, loves: o("resolve").loves?.map((l) => l.name) },
    read: o("read") && Object.fromEntries(Object.entries(o("read").columns).map(([t, c]) => [t, { filter: c.filter, only_here: c.onlyHere, hidden_gems: c.hiddenGems, top: c.rows.slice(0, 10).map((r) => r.name), country_prefers: c.countryNames.slice(0, 8), contrast_prefers: c.contrastNames.slice(0, 8) }])),
    gap: o("gap") && { mode: o("gap").mode, lanes: o("gap").lanes, avoid: o("gap").avoid.map((a) => a.name), flavours: o("gap").flavours.map((f) => f.name) },
    audio: o("audio")?.shortlist,
    spots: o("spots") && { venues: o("spots").venues.map((v) => v.name), neighbourhoods: o("spots").neighbourhoods.map((n) => n.name) },
    audience: o("audience") && { leans: o("audience").leans, gender: o("audience").gender },
    travels: o("travels")?.cities,
    write: o("write") && { plan: o("write").plan, llm: o("write").llm, fallback: o("write").fallback },
    check: o("check") && { grounded: o("check").grounded, checked: o("check").checked, removed: o("check").removed },
    share: run.publish?.url,
    receipts: run.ledger.length,
    note: "Qloo describes aggregate taste affinity, not individuals and not sales. Every name above came from a Qloo request recorded in the run's ledger.",
  };
};

async function runUntil(input, stopAfter, credential) {
  const run = await createRun(input, { mode: undefined, credential });
  if (stopAfter) run.plan = run.plan.slice(0, run.plan.indexOf(stopAfter) + 1);
  await startRun(run, 0);
  return run;
}

export function buildMcpServer() {
  const server = new McpServer({ name: "ayto", version: "0.2.0" });
  const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });

  server.registerTool("ayto_read_city", { title: "Read a city's taste", description: "What a city favours beyond its country and a contrast city, for a theme and a format. Three-column read plus flavour tags. Aggregate Qloo affinity, no personal data.", inputSchema: { city: z.string().describe(cityDesc), theme: z.string().optional().describe("Genre or subject words, e.g. 'crime' or 'nightlife, food'"), format: formatSchema.default("film"), loves: z.array(z.string()).optional().describe("Up to 3 titles or artists the crowd loves") } }, async ({ city, theme, format, loves }) => {
    const run = await runUntil(await parseInput({ text: "", format, city, theme: theme ?? "", loves: loves ?? [] }), "read");
    return text(digest(run));
  });

  server.registerTool("ayto_find_gap", { title: "Find the gap", description: "Lanes a city loves and is under-served in: demand (flavour rank in the city vs the country) weighed by recent supply. Includes audio, spots, audience and where the taste travels, per format.", inputSchema: { city: z.string().describe(cityDesc), theme: z.string().optional(), format: formatSchema.default("film"), loves: z.array(z.string()).optional() } }, async ({ city, theme, format, loves }) => {
    const run = await runUntil(await parseInput({ text: "", format, city, theme: theme ?? "", loves: loves ?? [] }), "audience");
    return text(digest(run));
  });

  server.registerTool("ayto_write", { title: "Write into the gap", description: "The full run: read, gap, and the written film, reel or drop, checked so every name traces to Qloo. Pass your own LLM provider and key; it is used for this call only and never stored.", inputSchema: { city: z.string().describe(cityDesc), theme: z.string().optional(), format: formatSchema.default("film"), loves: z.array(z.string()).optional(), provider: z.string().optional().describe("groq, openai, anthropic, gemini, mistral, openrouter, together, fireworks, deepseek, xai, cerebras, sambanova"), key: z.string().optional().describe("Your API key for that provider"), model: z.string().optional() } }, async ({ city, theme, format, loves, provider, key, model }) => {
    const credential = provider && key ? credentialFrom({ provider, key, model }) : undefined;
    const run = await runUntil(await parseInput({ text: "", format, city, theme: theme ?? "", loves: loves ?? [] }), undefined, credential);
    return text(digest(run));
  });

  return server;
}

/** Express handler: one stateless MCP request per HTTP request. */
export function mcpHandler() {
  return async (req, res) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "MCP request failed" }, id: null });
    }
  };
}

export const discovery = (publicUrl) => ({
  name: "AYTO",
  version: "0.2.0",
  description: "Tell AYTO what you're making and where. Qloo reads what that city's people love and finds the gap; your own LLM writes the idea into it.",
  mcp: { endpoint: `${publicUrl}/mcp`, transport: "streamable-http", stateless: true, tools: ["ayto_read_city", "ayto_find_gap", "ayto_write"] },
  http: { parse: `${publicUrl}/api/parse`, runs: `${publicUrl}/api/runs`, events: `${publicUrl}/api/runs/{id}/events` },
  data: { source: "Qloo taste graph (hackathon API)", nature: "aggregate taste affinity across large groups", personalData: "none sent, none inferred", sales: "not sales data, not a prediction of success" },
  llm: { byok: true, stored: false, providers: 12 },
});
