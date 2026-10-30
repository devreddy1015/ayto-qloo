// Hear the story against a fake Sarvam API: a brief is read aloud in its own words and language, once, and again only
// when it is written again; a long story is read in pieces and joined; a template brief with nothing to read hides
// the button; and it is off without a key.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const MP3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, 5, 6, 7, 8]);
/** A tiny 16-bit mono WAV holding these sample bytes. */
const wav = (data) => {
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0, "latin1");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(22050, 12);
  fmt.writeUInt32LE(44100, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(4 + fmt.length + 8 + data.length, 4);
  head.write("WAVE", 8, "latin1");
  const dataHead = Buffer.alloc(8);
  dataHead.write("data", 0, "latin1");
  dataHead.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, fmt, dataHead, data]);
};
const calls = [];
let fake;
let app;
let base;

before(async () => {
  fake = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      // The boot probe of the writer lands here too (see LLM_BASE_URL), so the tests never reach a real API.
      if (req.url !== "/text-to-speech") return res.writeHead(404).end();
      const parsed = JSON.parse(body || "{}");
      calls.push({ key: req.headers["api-subscription-key"], body: parsed });
      const audio = parsed.output_audio_codec === "wav" ? wav(Buffer.from([calls.length, calls.length])) : MP3;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ request_id: `s${calls.length}`, audios: [audio.toString("base64")] }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  Object.assign(process.env, {
    CULTURE_GAP_MODE: "fake",
    GROQ_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    SARVAM_API_KEY: "sk_test_sarvam_abcdefghijklmnop",
    LLM_PROVIDER: "local",
    LLM_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1`,
    SARVAM_BASE_URL: `http://127.0.0.1:${fake.address().port}`,
    CACHE_DIR: `/tmp/ayto-voice-test-${process.pid}`,
    PORT: String(23000 + (process.pid % 20000)),
  });
  ({ server: app } = await import("../src/server.js"));
  await new Promise((r) => (app.listening ? r() : app.once("listening", r)));
  base = `http://127.0.0.1:${app.address().port}`;
});

after(async () => {
  await new Promise((r) => app.close(r));
  fake.close();
  const { closeQloo } = await import("../src/qloo.js");
  await closeQloo?.();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

const json = (path, init) => fetch(`${base}${path}`, init).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const post = (path, body) => json(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function finishedRun(showcase) {
  const { body } = await post("/api/runs", { showcase });
  for (let i = 0; i < 200; i += 1) {
    const { body: r } = await json(`/api/runs/${body.id}`);
    if ((r.run ?? r).status === "done") return r.run ?? r;
    await wait(100);
  }
  throw new Error("run didn't finish");
}

async function settle(id, status = async () => (await json(`/api/runs/${id}/voice`)).body) {
  let now;
  for (let i = 0; i < 100; i += 1) {
    now = await status();
    if (now.status !== "reading") return now;
    await wait(50);
  }
  return now;
}

test("a brief is read aloud in its own words, once", async () => {
  const { body: presets } = await json("/api/presets");
  assert.equal(presets.voice, true, "the page is told reading aloud is on");
  const run = await finishedRun("tiruppur-kidswear");
  const plan = run.stages.write.output.plan;
  const before = await json(`/api/runs/${run.id}/voice`);
  assert.deepEqual(before.body, { status: "none", language: "English", hint: "Tamil" }, "an English brief is heard in English, and the page can say how to hear it in Tamil");
  assert.equal((await post(`/api/runs/${run.id}/voice`)).status, 202);
  const done = await settle(run.id);
  assert.equal(done.status, "done", JSON.stringify(done));
  assert.equal(calls.length, 1);
  const [ask] = calls;
  assert.equal(ask.key, "sk_test_sarvam_abcdefghijklmnop");
  assert.equal(ask.body.text, `${plan.drop_name}. ${plan.positioning}`, "the title, then the brief's own pitch line, word for word");
  assert.equal(ask.body.language_code, "en-IN");
  assert.equal(ask.body.model, "bulbul:v3");
  assert.equal(ask.body.output_audio_codec, "mp3");
  assert.equal(done.text, ask.body.text, "the page can show what it reads");
  assert.match(done.url, new RegExp(`^/api/runs/${run.id}/voice\\.mp3\\?v=\\d+$`));
  const file = await fetch(`${base}${done.url}`);
  assert.equal(file.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), MP3);
  assert.equal((await fetch(`${base}${done.url}`, { headers: { range: "bytes=0-3" } })).status, 206, "the player can seek");
  assert.equal((await post(`/api/runs/${run.id}/voice`)).body.status, "done", "a second click plays the same file");
  assert.equal(calls.length, 1);
});

test("a brief written again in Telugu is read again, in Telugu; a long story is read in pieces and joined", async () => {
  calls.length = 0;
  const { startVoice, voiceStatus } = await import("../src/voice.js");
  const story = Array.from({ length: 60 }, (_, i) => `Scene ${i + 1}: the clerk counts the till and keeps the secret for one more night.`).join(" ");
  const run = (language, plan) => ({ id: "r_story_test", input: { format: "film" }, stages: { resolve: { output: { city: { name: "Hyderabad", state: "Telangana", market: "India" } } }, write: { output: { writer: "film", language, plan } } } });
  const english = run("English", { titles: ["Night Till"], story: "A clerk keeps a secret." });
  await startVoice(english);
  assert.equal((await settle(english.id, () => voiceStatus(english.id, english))).status, "done");
  assert.equal(calls.at(-1).body.text, "Night Till. A clerk keeps a secret.", "a film reads its story");

  const telugu = run("Telugu", { titles: ["రాత్రి కౌంటర్"], story });
  assert.equal((await voiceStatus(telugu.id, telugu)).status, "none", "words the brief no longer has don't count as its reading");
  await startVoice(telugu);
  const done = await settle(telugu.id, () => voiceStatus(telugu.id, telugu));
  assert.equal(done.status, "done", JSON.stringify(done));
  const pieces = calls.slice(1);
  assert.ok(pieces.length >= 2, "a story longer than Bulbul takes goes in pieces");
  assert.ok(pieces.every((c) => c.body.language_code === "te-IN" && c.body.output_audio_codec === "wav" && c.body.text.length <= 2500));
  assert.equal(pieces.map((c) => c.body.text).join(" "), `రాత్రి కౌంటర్. ${story}`, "every word is read, in order");
  assert.equal(done.language, "Telugu");
  assert.match(done.url, /voice\.wav\?v=/);
  const file = Buffer.from(await (await fetch(`${base}${done.url}`)).arrayBuffer());
  assert.equal(file.toString("latin1", 0, 4), "RIFF");
  assert.equal(file.readUInt32LE(4), file.length - 8, "one WAV, its size rewritten");
  assert.equal(file.readUInt32LE(40), pieces.length * 2, "with every piece's samples");
  assert.equal((await fetch(`${base}/api/runs/${telugu.id}/voice.mp3`)).status, 404, "the older English reading is gone");
});

test("a template brief with nothing to read hides the button instead of reading nothing", async () => {
  calls.length = 0;
  const run = await finishedRun("vegas-reel"); // no model in tests: the reel's title and hook are empty
  assert.deepEqual((await json(`/api/runs/${run.id}/voice`)).body, { status: "none", nothing: true });
  assert.equal((await post(`/api/runs/${run.id}/voice`)).status, 409);
  assert.equal(calls.length, 0, "Sarvam was never called for it");
});

test("no key, no button: the page is told and the routes say so", async () => {
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "";
  try {
    assert.equal((await json("/api/presets")).body.voice, false);
    const run = await finishedRun("hyderabad-crime-film");
    assert.equal((await post(`/api/runs/${run.id}/voice`)).status, 503);
    assert.deepEqual((await json(`/api/runs/${run.id}/voice`)).body, { status: "none" });
    assert.equal((await fetch(`${base}/api/runs/${run.id}/voice.mp3`)).status, 404);
  } finally {
    process.env.SARVAM_API_KEY = key;
  }
  assert.equal((await json("/api/runs/..%2Fetc/voice")).status, 404);
});

test("what gets read, and in which language", async () => {
  const { voicePlan, chunks } = await import("../src/voice.js");
  const run = (input, language, plan) => ({ input, stages: { resolve: { output: { city: { name: "Chennai", state: "Tamil Nadu", market: "India" } } }, write: { output: { language, plan } } } });
  assert.deepEqual(voicePlan(run({ format: "film" }, "English", { titles: ["Night Shift", "Two"], story: "**A clerk** keeps [a secret](x)", logline: "unused" })), { text: "Night Shift. A clerk keeps a secret.", language: "English", hint: "Tamil" }, "markup out, words in");
  assert.deepEqual(voicePlan(run({ format: "cafe" }, "Tamil", { name: "Kaapi", concept: "ஒரு சிறிய கஃபே" })), { text: "Kaapi. ஒரு சிறிய கஃபே.", language: "Tamil" }, "a brief in Tamil is read in Tamil");
  assert.equal(voicePlan(run({ format: "film" }, "Spanish", { logline: "Una noche" })), undefined, "a language Bulbul doesn't speak isn't read in the wrong voice");
  assert.equal(voicePlan(run({ format: "film" }, "English", { titles: ["Only a title"] })), undefined, "a title alone isn't worth a click");
  assert.equal(voicePlan({ stages: {} }), undefined);
  assert.deepEqual(chunks("One. Two. Three.", 10), ["One. Two.", "Three."], "cut at sentence ends");
});
