// The write path end to end against a fake OpenAI-compatible model that answers badly on purpose: a <think>
// block, code fences, an invented title, a reply cut off by the token limit, wrong shapes, an empty object.
// The run must still finish, keep what the model wrote, drop the invented name, and fill the rest from Qloo.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const calls = [];
let server;

/** What the fake model says, by which prompt it got. */
function reply(system) {
  if (/single word: ok/i.test(system)) return "ok";
  if (/With no external data/i.test(system)) return JSON.stringify({ references: ["Some Film"], artists: ["Some Artist"], cities: ["Some City"], lane: "Noir" });
  if (/story developer/i.test(system)) {
    // The rewrite after the check: clean, but it leaves the references out (the evidence fills them).
    if (/NOT in the evidence/.test(system)) return JSON.stringify({ titles: ["The Clock Tower Ledger", "Second", "Third"], logline: "A sub-inspector follows a song to a missing singer.", beats: [{ title: "The complaint", what: "She logs it.", who: ["Aruna"] }], characters: [{ name: "Aruna", role: "32, sub-inspector", wants: "To close one file honestly." }], references: [] });
    // The first pass: thinking, fences, an invented title, wrong shapes, and cut off in the middle of a character.
    return '<think>The city leans to folk; I should write…</think>\n```json\n{"titles": "The Clock Tower Ledger", "logline": "A sub-inspector follows a song to a missing singer.", "synopsis": "One paragraph instead of three acts.", "beats": ["She logs the complaint.", "The museum guard remembers the song."], "references": [{"title": "Invented Film", "borrow": "Long lens."}], "camera": "One tube light per room.", "characters": [{"name": "Aruna", "role": "32, sub-inspector"}, {"name": "Ravi", "wants": "His name off the ca';
  }
  return "{}"; // any other writer: nothing useful
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const system = (parsed.messages ?? []).filter((m) => m.role === "system").map((m) => m.content).join("\n");
      calls.push(system.slice(0, 60));
      const content = reply(system);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.CULTURE_GAP_MODE = "fake";
  process.env.GROQ_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.LLM_PROVIDER = "local";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  process.env.CACHE_DIR = `/tmp/ayto-llm-e2e-${process.pid}`;
});

after(async () => {
  server?.close();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

test("a messy model reply still gives a complete, grounded film treatment", async () => {
  const { parseInput } = await import("../src/parse.js");
  const { createRun, startRun } = await import("../src/pipeline/runner.js");
  const { SHOWCASES } = await import("../src/presets.js");
  const { renderSharePage } = await import("../src/pipeline/page.js");
  const { llmAvailable, providerList, credentialFrom } = await import("../src/llm.js");
  assert.equal(llmAvailable(), true, "the local provider counts as a server model");
  assert.ok(!providerList().some((p) => p.id === "local"), "the browser is never offered the local provider");
  assert.throws(() => credentialFrom({ provider: "local", key: "abcdefghijk" }), /Unknown LLM provider/);

  const showcase = SHOWCASES.find((s) => s.format === "film");
  const run = await createRun(await parseInput(showcase), { showcase: showcase.id });
  await startRun(run, 0);
  assert.equal(run.status, "done", JSON.stringify(Object.fromEntries(run.plan.map((s) => [s, run.stages[s].error ?? run.stages[s].status]))));

  const write = run.stages.write.output;
  assert.equal(write.fallback, false, "the model's writing is kept");
  const p = write.plan;
  assert.ok(Array.isArray(p.titles) && p.titles.length >= 1);
  assert.match(p.logline, /sub-inspector/);
  assert.ok(Array.isArray(p.beats) && p.beats.length >= 1, "beats survive as a list");
  assert.ok(p.characters.some((c) => c.name === "Aruna"));
  const check = run.stages.check.output;
  assert.equal(check.rewrote, true, "the invented title triggered one rewrite");
  assert.ok(!JSON.stringify(p).includes("Invented Film"), "the invented title is gone");
  assert.ok(p.references.length >= 1, "references the model left out come from the evidence");
  assert.ok(write.filled.includes("references"));
  assert.equal(check.removed, 0, "after the rewrite every name traces to Qloo");
  assert.equal(run.stages.diff.output.withoutQloo.references?.[0], "Some Film");
  assert.ok(calls.some((c) => /story developer/i.test(c)));
  const html = renderSharePage(run);
  assert.match(html, /The Clock Tower Ledger/);
});

test("a reply that is cut off is repaired, and one with no JSON fails cleanly", async () => {
  const { parseModelJson } = await import("../src/llm.js");
  const cut = parseModelJson('{"titles": ["A", "B"], "beats": [{"title": "One", "what": "She logs the compl');
  assert.deepEqual(cut.titles, ["A", "B"]);
  assert.equal(cut._repaired, true);
  assert.equal(parseModelJson("Sorry, I can't help with that."), undefined);
  const { normalizePlan } = await import("../src/pipeline/write.js");
  const { plan, filled } = normalizePlan({ lane: "Folk", camera: "One tube light", soundtrack: [] }, { lane: { flavour: "Folk", why: "ranks #14" }, camera: { lighting: [], shots: [] }, soundtrack: [{ artist: "Karthik", use: "score" }] });
  assert.deepEqual(plan.lane, { flavour: "Folk", why: "ranks #14" });
  assert.deepEqual(plan.camera.lighting, ["One tube light"]);
  assert.deepEqual(filled, ["soundtrack"]);
});
