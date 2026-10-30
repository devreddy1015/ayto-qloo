// What a real model sends: names under the wrong key, lists given as one string, extra keys, a wrapped reply, a
// title copied with its year, a model that never answers. The check still traces every name, the page still
// reads, the run still ends with a share page. A fake OpenAI-compatible model plays the writer.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

let server;
let mode = "odd"; // what the fake model answers: "odd" shapes, a "hang", or "packs" for fashion
const calls = { packs: 0 };

function reply(system, user) {
  if (/single word: ok/i.test(system)) return "ok";
  if (/With no external data/i.test(system)) return JSON.stringify({ references: [{ title: "Some Film" }, { name: "Another Film" }], artists: [["Nested Artist"]], cities: ["Some City"], lane: "Noir" });
  if (/tech packs/i.test(system)) {
    calls.packs += 1;
    const ev = JSON.parse(user || "{}");
    return JSON.stringify({ packs: (ev.styles ?? []).map((s) => ({ style: s.name, fabric: { composition: "100% cotton", gsm: 200, finish: "model wash" }, construction: ["model seam"], trims: ["label"], fit_notes: "model fit" })) });
  }
  const ev = JSON.parse(user || "{}");
  const titles = Object.values(ev.what_the_city_favours ?? {}).flatMap((c) => [...(c.only_here ?? []), ...(c.also_strong ?? [])]);
  const artist = ev.artists?.[0]?.name;
  const supply = (ev.lanes ?? []).flatMap((l) => (Array.isArray(l.recent_supply?.titles) ? l.recent_supply.titles : []));
  if (/fashion/i.test(system) && /styles/.test(system)) {
    // A drop with every field in an awkward shape.
    return JSON.stringify({ drop_name: 101, positioning: "Small drop.", styles: [{ name: 101, category: "tee", garment: "tee", cues: "boxy fit, 220 GSM", colourways: "Ink", hero: true, print: { type: "none" } }], palette: [{ name: "Ink", hex: "#112233" }], brands_to_study: [], first_cities: [], soundtrack: [] });
  }
  return JSON.stringify({
    plan: {
      // Wrapped in one key, as some models do.
      titles: [{ title: "Late Shift" }],
      logline: "A sub-inspector follows a song to a missing singer.",
      references: [{ name: titles[0] }, { title: "Invented Reference One" }, ...(supply[0] ? [{ title: supply[0] }] : [])],
      soundtrack: [{ name: artist }, { name: "Invented Artist" }],
      beats: [{ title: "Complaint", what: "She files it.", after: "Invented Title Two", where: "Invented Place" }],
      travels_next: [["Invented City"]],
      camera: { shots: [{ shot: "wide", lens: "24mm" }], lighting: "sodium" },
      similar_shows: ["Invented Extra Key"],
    },
  });
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (mode === "hang") return; // never answers
      const parsed = JSON.parse(body || "{}");
      const system = (parsed.messages ?? []).filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const user = (parsed.messages ?? []).filter((m) => m.role === "user").map((m) => m.content).join("\n");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: reply(system, user) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.CULTURE_GAP_MODE = "fake";
  process.env.GROQ_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.LLM_PROVIDER = "local";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  process.env.LLM_STAGE_BUDGET_MS = "6000";
  process.env.CACHE_DIR = `/tmp/ayto-writer-test-${process.pid}`;
});

after(async () => {
  server?.closeAllConnections?.();
  server?.close();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

async function showcaseRun(format) {
  const { parseInput } = await import("../src/parse.js");
  const { createRun, startRun } = await import("../src/pipeline/runner.js");
  const { SHOWCASES } = await import("../src/presets.js");
  const showcase = SHOWCASES.find((s) => s.format === format);
  const run = await createRun(await parseInput(showcase), {});
  await startRun(run, 0);
  return run;
}

test("names in any shape are checked: invented ones go, Qloo's stay, extra keys are dropped", async () => {
  mode = "odd";
  const { renderShareMarkdown, renderSharePage } = await import("../src/pipeline/page.js");
  const run = await showcaseRun("film");
  assert.equal(run.status, "done", JSON.stringify(Object.fromEntries(run.plan.map((s) => [s, run.stages[s].error ?? run.stages[s].status]))));
  const w = run.stages.write.output;
  assert.equal(w.fallback, false);
  const plan = w.plan;
  const all = JSON.stringify(plan);
  for (const invented of ["Invented Reference One", "Invented Artist", "Invented Title Two", "Invented Place", "Invented City", "Invented Extra Key"]) assert.ok(!all.includes(invented), `${invented} survived`);
  assert.ok(plan.references.some((r) => (r.title ?? r.name) && !/Invented/.test(r.title ?? r.name)), "the real reference stays");
  assert.ok(plan.soundtrack.length >= 1, "the real artist stays");
  assert.equal(plan.similar_shows, undefined, "a key no template has is dropped");
  const html = renderSharePage(run);
  const md = renderShareMarkdown(run);
  for (const page of [html, md]) for (const junk of ["[object Object]", "undefined", "NaN"]) assert.ok(!page.includes(junk), `${junk} on the page`);
  assert.equal(run.publish.page.title, "Late Shift", "a title given as { title } is the page title");
  assert.match(run.publish.slug, /^late-shift-/);
  // The with/without card reads names from objects and nested lists, and asks with the city.
  const d = run.stages.diff.output;
  assert.equal(d.benchmark.withoutQloo.named, 5);
  assert.match(d.question, /Hyderabad/);
});

test("a real name copied with its year, its accents dropped, or with a script bracket still traces", async () => {
  const { checkEvidence } = await import("../src/pipeline/check.js");
  const names = { quiet: { name: "Quiet Hours" }, beyonce: { name: "Beyoncé" }, hit: { name: "HIT" }, spider: { name: "Spider-Man" } };
  const run = (references) => ({ names, stages: { write: { output: { writer: "film", plan: { references } } } } });
  const ok = checkEvidence(run([{ title: "Quiet Hours (2022)" }, { title: "Beyonce" }, { title: "HIT (హిట్)" }, { title: "హిట్ (HIT)" }, { title: "Spider Man" }]));
  assert.equal(ok.removed, 0, JSON.stringify(ok.items));
  const bad = checkEvidence(run([{ title: "Gangs of Wasseypur — తెలుగు (HIT)" }]));
  assert.equal(bad.removed, 1);
});

test("a drop with a numbered name and cues as one string produces and publishes", async () => {
  mode = "odd";
  const { renderSharePage } = await import("../src/pipeline/page.js");
  const run = await showcaseRun("fashion");
  assert.equal(run.status, "done", JSON.stringify(Object.fromEntries(run.plan.map((s) => [s, run.stages[s].error ?? run.stages[s].status]))));
  const w = run.stages.write.output;
  assert.equal(w.fallback, false, "the model's drop, not the template");
  assert.equal(w.plan.styles[0].name, "101");
  assert.deepEqual(w.plan.styles[0].cues, ["boxy fit, 220 GSM"], "a string becomes a one-item list");
  const p = run.stages.produce.output;
  assert.equal(p.packs.length, 1, JSON.stringify(p).slice(0, 300));
  assert.equal(p.packs[0].style, "101");
  const html = renderSharePage(run);
  assert.ok(!html.includes("[object Object]"));
});

test("new assumptions keep the model's tech packs and the with/without card", async () => {
  mode = "packs";
  const { rerunFrom } = await import("../src/pipeline/runner.js");
  const run = await showcaseRun("fashion");
  assert.equal(run.status, "done");
  assert.equal(run.stages.produce.output.packsBy, "model");
  const packCalls = calls.packs;
  const diffBefore = JSON.stringify(run.stages.diff.output);
  const job = await rerunFrom(run, "produce", { assumptions: { heroQuantity: 300 } });
  await job.done;
  assert.equal(run.status, "done");
  assert.equal(run.stages.produce.output.packsBy, "model", "the packs carried over");
  assert.equal(calls.packs, packCalls, "no new model call for new numbers");
  assert.equal(JSON.stringify(run.stages.diff.output), diffBefore, "the diff stayed");
});

test("a rerun replaces its stages' receipts instead of adding to them", async () => {
  mode = "odd";
  const { editAndRerun, laneFirstEdit } = await import("../src/pipeline/runner.js");
  const run = await showcaseRun("film");
  const before = run.ledger.length;
  const lanes = run.stages.gap.output.lanes;
  const job = await editAndRerun(run, "gap", laneFirstEdit(run, lanes[lanes.length - 1].name));
  await job.done;
  assert.equal(run.ledger.length, before);
  assert.equal(new Set(run.ledger.map((e) => e.id)).size, run.ledger.length, "ids stay unique");
});

test("a model that never answers ends in the template, inside the stage's time", async () => {
  mode = "odd";
  const run = await showcaseRun("reel");
  const { writeWith } = await import("../src/pipeline/write.js");
  mode = "hang";
  const started = Date.now();
  // A new evidence key, so the cached plan from the first write doesn't answer for the model.
  run.stages.resolve.output.city.name += " ";
  const out = await writeWith(run);
  mode = "odd";
  assert.equal(out.fallback, true, "the template stands in");
  assert.match(out.summary, /Model failed/);
  assert.ok(Date.now() - started < 15000, `took ${Date.now() - started} ms; the budget here is 6 s`);
});

test("the JSON in a reply: prose braces before it, braces after it, a reply cut mid-literal", async () => {
  const { parseModelJson } = await import("../src/llm.js");
  assert.deepEqual(parseModelJson('A film for {city}: {"a":1}'), { a: 1 });
  assert.deepEqual(parseModelJson('{"a":1} and a note {b}'), { a: 1 }, "not marked as cut off");
  assert.deepEqual(parseModelJson('{"a":"x","b":fal'), { a: "x", _repaired: true });
  assert.deepEqual(parseModelJson('{"a":1,"b":1e'), { a: 1, _repaired: true });
});
