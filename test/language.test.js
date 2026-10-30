// A brief in the city's own language: the writer is asked for Telugu, Qloo's names stay in Latin letters (or in
// brackets after the Telugu), the check still traces every one, and a finished run switches language without
// reading Qloo again. A fake OpenAI-compatible model answers in Telugu when the prompt asks for it.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const systems = [];
let server;

function reply(system, user) {
  if (/single word: ok/i.test(system)) return "ok";
  if (/With no external data/i.test(system)) return JSON.stringify({ references: ["Some Film"], artists: ["Some Artist"], cities: ["Some City"], lane: "Noir" });
  if (!/story developer/i.test(system)) return "{}";
  const ev = JSON.parse(user || "{}");
  const titles = ["movie", "tv_show"].flatMap((t) => [...(ev.what_the_city_favours?.[t]?.only_here ?? []), ...(ev.what_the_city_favours?.[t]?.also_strong ?? [])]);
  const artist = ev.artists?.[0]?.name;
  if (/in Telugu script/.test(system)) {
    return JSON.stringify({
      titles: ["గడియారం స్తంభం (Gadiyaram Stambham)"],
      logline: "ఒక సబ్-ఇన్‌స్పెక్టర్ ఒక పాటను వెంబడిస్తూ తప్పిపోయిన గాయనిని వెతుకుతుంది.",
      beats: [{ title: "ఫిర్యాదు", what: "ఆమె ఫిర్యాదు నమోదు చేస్తుంది.", who: ["Aruna"] }],
      characters: [{ name: "Aruna", role: "32, సబ్-ఇన్‌స్పెక్టర్", wants: "ఒక ఫైల్‌ను నిజాయితీగా మూసివేయాలి." }],
      // One reference as Qloo spells it, one in Telugu with Qloo's spelling in brackets.
      references: titles.slice(0, 2).map((t, i) => ({ title: i ? `తెలుగు పేరు (${t})` : t, borrow: "పొడవైన లెన్స్‌తో దూరం నుంచి." })),
      soundtrack: artist ? [{ artist, use: "score", beat: 1 }] : [],
    });
  }
  return JSON.stringify({ titles: ["The Clock Tower Ledger"], logline: "A sub-inspector follows a song to a missing singer.", references: titles.slice(0, 1).map((t) => ({ title: t, borrow: "Long lens." })) });
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const system = (parsed.messages ?? []).filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const user = (parsed.messages ?? []).filter((m) => m.role === "user").map((m) => m.content).join("\n");
      systems.push(system);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: reply(system, user) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  process.env.CULTURE_GAP_MODE = "fake";
  process.env.GROQ_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.LLM_PROVIDER = "local";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  process.env.CACHE_DIR = `/tmp/ayto-language-${process.pid}`;
});

after(async () => {
  server?.close();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

test("the sentence and the pickers set the language; a language word is never a city", async () => {
  const { languageFrom, languagesFor, languageRule, writeLanguage } = await import("../src/languages.js");
  const { heuristicParse, parseInput } = await import("../src/parse.js");
  assert.equal(languageFrom("a crime short film in Hyderabad, in Telugu"), "Telugu");
  assert.equal(languageFrom("a Telugu crime film in Hyderabad"), undefined, "a Telugu film names the film's language, not the brief's");
  assert.equal(writeLanguage("telugu"), "Telugu");
  assert.equal(writeLanguage("English"), undefined);
  assert.deepEqual(languagesFor({ state: "Telangana", market: "India" }).map((l) => l.name), ["English", "Telugu"]);
  assert.deepEqual(languagesFor({ state: "Nevada", market: "United States" }).map((l) => l.name), ["English"]);
  assert.equal(languageRule("English"), "", "English prompts stay exactly as they were");
  assert.match(languageRule("Telugu"), /Telugu script/);
  assert.match(languageRule("Telugu"), /Latin letters/);
  assert.equal(heuristicParse("a crime film in Telugu set in Hyderabad").city, "Hyderabad");
  assert.equal(heuristicParse("I make reels in Las Vegas. Nightlife and food.").city, "Las Vegas");
  assert.equal(heuristicParse("a film in St. Louis about jazz").city, "St. Louis");
  assert.equal((await parseInput({ text: "a crime short film in Hyderabad, in Telugu" })).language, "Telugu");
  assert.equal((await parseInput({ text: "a crime short film in Hyderabad, in Telugu", language: "English" })).language, undefined, "the picker wins");
});

test("a Telugu brief keeps every Qloo name traceable, and a finished run switches back to English", async () => {
  const { parseInput } = await import("../src/parse.js");
  const { createRun, regenerate, startRun } = await import("../src/pipeline/runner.js");
  const { SHOWCASES } = await import("../src/presets.js");
  const { renderSharePage } = await import("../src/pipeline/page.js");

  const showcase = SHOWCASES.find((s) => s.format === "film");
  const run = await createRun(await parseInput({ ...showcase, language: "Telugu" }), { showcase: showcase.id });
  await startRun(run, 0);
  assert.equal(run.status, "done");

  const w = run.stages.write.output;
  assert.equal(w.fallback, false);
  assert.equal(w.language, "Telugu");
  assert.equal(w.languageCode, "te");
  assert.deepEqual(w.languages.map((l) => l.name), ["English", "Telugu"], "Hyderabad is offered Telugu");
  assert.match(w.summary, /in Telugu/);
  assert.match(w.plan.logline, /[ఀ-౿]/, "the logline is in Telugu script");
  assert.ok(systems.some((s) => /story developer/.test(s) && /in Telugu script/.test(s)));
  const check = run.stages.check.output;
  assert.equal(check.removed, 0, "Qloo names in Latin letters, or bracketed after the Telugu, all trace");
  assert.ok(w.plan.references.some((r) => /[ఀ-౿].*\(.+\)$/.test(r.title)), "the bracketed reference survived the check");
  assert.ok(check.checked >= 3);
  const html = renderSharePage(run);
  assert.match(html, /lang="te"/);
  assert.match(html, /Noto\+Sans\+Telugu/);
  assert.match(html, /Written in Telugu/);

  // Back to English from the write stage: Qloo is not read again.
  const ledger = run.ledger.length;
  const job = await regenerate(run, undefined, { language: "English" });
  await job.done;
  assert.equal(run.input.language, undefined);
  assert.equal(run.stages.write.output.language, "English");
  assert.match(run.stages.write.output.plan.logline, /sub-inspector/);
  assert.equal(run.ledger.length, ledger, "no new Qloo requests");
  assert.ok(!/Language:/.test(systems.filter((s) => /story developer/.test(s)).at(-1)), "the English prompt carries no language rule");
});
