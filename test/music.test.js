// Music tones against a fake Gemini (Lyria) API: composed on demand from a finished run's music taste, with every
// Qloo name kept out of the prompt, served so the browser can seek and download it, and off when there's no key.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const MP3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);
const calls = [];
let block = false;
let fake;
let app;
let base;

before(async () => {
  fake = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      // The boot probe of the writer lands here too (see LLM_BASE_URL), so the tests never reach a real API.
      if (!req.url.endsWith(":generateContent")) return res.writeHead(404).end();
      const parsed = JSON.parse(body || "{}");
      calls.push({ path: req.url, key: req.headers["x-goog-api-key"], prompt: parsed.contents?.[0]?.parts?.[0]?.text ?? "" });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(block ? { promptFeedback: { blockReason: "PROHIBITED_CONTENT" } } : { candidates: [{ content: { parts: [{ text: "[0:00] Intro" }, { inlineData: { mimeType: "audio/mpeg", data: MP3.toString("base64") } }] }, finishReason: "STOP" }] }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  Object.assign(process.env, {
    CULTURE_GAP_MODE: "fake",
    GROQ_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "AIzaTestMusicKey-abcdefghijklmnopqrstu",
    LLM_PROVIDER: "local",
    LLM_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1`,
    MUSIC_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1beta`,
    CACHE_DIR: `/tmp/ayto-music-test-${process.pid}`,
    PORT: String(22000 + (process.pid % 20000)),
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
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const named = (name, text) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);

async function finishedRun(showcase = "hyderabad-crime-film") {
  const { body } = await post("/api/runs", { showcase });
  for (let i = 0; i < 200; i += 1) {
    const { body: r } = await json(`/api/runs/${body.id}`);
    if ((r.run ?? r).status === "done") return r.run ?? r;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("run didn't finish");
}

async function settle(id) {
  let status;
  for (let i = 0; i < 100; i += 1) {
    ({ body: status } = await json(`/api/runs/${id}/music`));
    if (status.status !== "composing") return status;
    await new Promise((r) => setTimeout(r, 50));
  }
  return status;
}

test("a finished run gets one music tone, composed from Qloo's tags without a single Qloo name", async () => {
  const { body: presets } = await json("/api/presets");
  assert.equal(presets.music, true, "the page is told music is on");
  const run = await finishedRun();
  const sound = run.stages.audio.output.sound;
  assert.ok(sound?.genres?.length && sound.instruments.length, "the audio stage read the shortlist's own tags");
  assert.ok(run.ledger.some((c) => c.stage === "audio" && c.tool === "qloo api entities" && c.status === "done"), "that read is a receipt");
  assert.ok(!sound.instruments.some((t) => /vocal/i.test(t.name)), "vocals are never a lead instrument");
  const started = await post(`/api/runs/${run.id}/music`);
  assert.equal(started.status, 202);
  const status = await settle(run.id);
  assert.equal(status.status, "done", JSON.stringify(status));
  assert.equal(calls.length, 1);
  const [ask] = calls;
  assert.equal(ask.path, "/v1beta/models/lyria-3-clip-preview:generateContent");
  assert.equal(ask.key, "AIzaTestMusicKey-abcdefghijklmnopqrstu");
  assert.match(ask.prompt, /Instrumental only: no vocals/);
  assert.match(ask.prompt, /short film set in Hyderabad/, "the format and the city set the job");
  assert.match(ask.prompt, /BPM/);
  assert.ok(ask.prompt.includes(sound.genres[0].name), "the shortlist's top genre leads the description");
  assert.ok(ask.prompt.toLowerCase().includes(sound.instruments[0].name.toLowerCase()), "and its top instrument");
  const names = Object.values(run.names ?? {}).filter((n) => !["city", "neighbourhood", "tag"].includes(n.kind) && String(n.name).length >= 3);
  assert.ok(names.length > 3, "the run has Qloo names to keep out");
  for (const a of run.stages.audio.output.shortlist) assert.equal(named(a.name, ask.prompt), false, `artist "${a.name}" reached the prompt`);
  for (const n of names) assert.equal(named(n.name, ask.prompt), false, `"${n.name}" reached the prompt`);

  assert.equal(status.url, `/api/runs/${run.id}/music.mp3`);
  const file = await fetch(`${base}${status.url}`);
  assert.equal(file.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), MP3);
  const part = await fetch(`${base}${status.url}`, { headers: { range: "bytes=0-3" } });
  assert.equal(part.status, 206, "the player can seek");
  assert.deepEqual(Buffer.from(await part.arrayBuffer()), MP3.subarray(0, 4));
  const again = await post(`/api/runs/${run.id}/music`);
  assert.equal(again.body.status, "done", "a second click plays the same tone instead of paying for another");
  assert.equal(calls.length, 1);
});

test("a prompt Lyria refuses says why, and the button can try again", async () => {
  const run = await finishedRun("vegas-reel");
  block = true;
  try {
    assert.equal((await post(`/api/runs/${run.id}/music`)).status, 202);
    const failed = await settle(run.id);
    assert.equal(failed.status, "error");
    assert.match(failed.error, /returned no music \(PROHIBITED_CONTENT\)/);
    assert.match(calls.at(-1).prompt, /background track for a vertical reel/);
  } finally {
    block = false;
  }
  assert.equal((await post(`/api/runs/${run.id}/music`)).status, 202, "an error isn't a finished tone");
  assert.equal((await settle(run.id)).status, "done");
});

test("no key, no button: the page is told and the routes say so", async () => {
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  try {
    const { body: presets } = await json("/api/presets");
    assert.equal(presets.music, false);
    const run = await finishedRun("tiruppur-kidswear");
    assert.equal((await post(`/api/runs/${run.id}/music`)).status, 503);
    assert.equal((await json(`/api/runs/${run.id}/music`)).body.status, "none");
    assert.equal((await fetch(`${base}/api/runs/${run.id}/music.mp3`)).status, 404);
  } finally {
    process.env.GEMINI_API_KEY = key;
  }
  assert.equal((await json("/api/runs/..%2Fetc/music")).status, 404);
  assert.equal((await fetch(`${base}/api/runs/..%2Fetc/music.mp3`)).status, 404);
});

test("the prompt keeps the taste and drops the names", async () => {
  const { musicPrompt, audioOf } = await import("../src/music.js");
  const run = {
    input: { format: "cafe" },
    names: { a: { name: "Nucleya", kind: "artist" }, b: { name: "Folk", kind: "movie" }, c: { name: "Hyderabad", kind: "city" } },
    stages: {
      resolve: { output: { city: { name: "Hyderabad" } } },
      audio: { output: { sound: { genres: [{ name: "Folk" }, { name: "Playback Singing" }, { name: "Indie Pop" }], moods: [{ name: "Melodic" }], instruments: [{ name: "Guitar" }] } } },
      gap: { output: { lanes: [{ name: "Late Night" }] } },
      write: { output: { plan: { concept: "Late tea where Nucleya plays low." } } },
    },
  };
  const { prompt, basis } = musicPrompt(run);
  assert.deepEqual(basis.genres, ["Indie Pop"], "a genre that shares a title's name drops out, and so does a sung one");
  assert.equal(named("Nucleya", prompt), false);
  assert.match(prompt, /background music for a café set in Hyderabad/);
  assert.match(prompt, /Lead instruments: guitar\./);
  assert.match(prompt, /Mood: Late tea where plays low\./);
  assert.equal(musicPrompt({ stages: {} }), undefined, "nothing written, nothing to compose");
  assert.equal(audioOf({ steps: [{ type: "model_output", content: [{ type: "text", text: "x" }, { type: "audio", data: "QUJD" }] }] }), "QUJD", "the Interactions shape works too");
});
