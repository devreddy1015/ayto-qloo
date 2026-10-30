// The shot deck against one fake server playing both the language model and OpenAI's image API: one frame per beat
// (six at most), two at a time, the shot lines from the model, every Qloo name kept out of every image prompt, the
// references only Qloo-traced titles, one deck per run, the per-visitor and daily caps, and off without a key.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 5, 6, 7, 8, 0xff, 0xd9]);
const STORY = "Aruna, a sub-inspector, wants to close one file honestly before her transfer comes through.";
const images = [];
let inFlight = 0;
let maxInFlight = 0;
let firstTitle = "";
let fake;
let app;
let base;

/** A film plan built from the evidence the writer was sent, so every name in it is one Qloo returned. */
function filmPlan(ev) {
  const fav = ev.what_the_city_favours ?? {};
  const titles = [...new Set(["movie", "tv_show", ...Object.keys(fav)].flatMap((t) => [...(fav[t]?.only_here ?? []), ...(fav[t]?.also_strong ?? [])]))].slice(0, 4);
  const places = ev.places ?? [];
  firstTitle = titles[0] ?? "";
  return {
    titles: ["Late Shift", "Second", "Third"],
    lane: { flavour: ev.lanes?.[0]?.flavour ?? "", why: "It leans here." },
    logline: "A sub-inspector follows a song.",
    story: STORY,
    synopsis: { act1: "One.", act2: "Two.", act3: "Three." },
    beats: Array.from({ length: 7 }, (_, i) => ({ title: `Beat <${i + 1}> & after`, what: `Aruna walks past ${places[i % Math.max(places.length, 1)] ?? "the station"} while ${titles[0] ?? "a film"} plays on a TV.`, who: ["Aruna"], where: { name: places[i % Math.max(places.length, 1)] ?? "" }, after: { title: titles[i % Math.max(titles.length, 1)] ?? "" } })),
    characters: [{ name: "Aruna", role: "32, sub-inspector", look: "a pressed khaki shirt" }],
    references: titles.slice(0, 3).map((title) => ({ title, borrow: "Hold the wide shot <long>." })),
    camera: { lighting: ["One tube light per room"], shots: ["Wide, locked off"] },
    palette: [{ name: "Irani chai", hex: "#c08a4a" }],
  };
}

before(async () => {
  fake = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      const parsed = JSON.parse(body || "{}");
      if (req.url.endsWith("/images/generations")) {
        images.push({ auth: req.headers.authorization, body: parsed });
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 40));
        inFlight -= 1;
        const missing = parsed.model === "gpt-image-2.5-flare";
        res.writeHead(missing ? 404 : 200, { "content-type": "application/json" });
        return res.end(JSON.stringify(missing ? { error: { message: "The model `gpt-image-2.5-flare` does not exist or you do not have access to it." } } : { data: [{ b64_json: JPEG.toString("base64") }] }));
      }
      const system = (parsed.messages ?? []).filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const user = (parsed.messages ?? []).find((m) => m.role === "user")?.content ?? "{}";
      let content = "{}";
      if (/single word: ok/i.test(system)) content = "ok";
      else if (/story developer/i.test(system)) content = JSON.stringify(filmPlan(JSON.parse(user)));
      // A shot line that names a Qloo title: fine to show, never sent to the image model.
      else if (/director of photography/i.test(system)) content = JSON.stringify({ shots: JSON.parse(user).beats.map((b) => ({ beat: b.beat, size: "Wide", lens: "24mm", light: `sodium light as in ${firstTitle}`, movement: "slow push-in" })) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  const at = `http://127.0.0.1:${fake.address().port}/v1`;
  Object.assign(process.env, {
    CULTURE_GAP_MODE: "fake",
    GROQ_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    LLM_PROVIDER: "local",
    LLM_BASE_URL: at,
    OPENAI_API_KEY: "sk-test-shots-key-abcdefghijklmnop",
    OPENAI_IMAGE_BASE_URL: at,
    CACHE_DIR: `/tmp/ayto-shots-test-${process.pid}`,
    PORT: String(23000 + (process.pid % 20000)),
    SCANS_PER_IP_PER_HOUR: "100",
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

async function finishedRun(showcase = "london-crime-film") {
  const { body } = await post("/api/runs", { showcase });
  for (let i = 0; i < 300; i += 1) {
    const { body: r } = await json(`/api/runs/${body.id}`);
    if ((r.run ?? r).status === "done") return r.run ?? r;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("run didn't finish");
}

const qlooNames = (run) => Object.values(run.names ?? {}).filter((n) => !["city", "neighbourhood", "tag"].includes(n.kind) && String(n.name).trim().length >= 3).map((n) => String(n.name).trim());
const named = (text, name) => new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);

test("a film gets its shot deck: one frame per beat, six at most, two at a time, no Qloo name in any prompt", async () => {
  const { body: presets } = await json("/api/presets");
  assert.equal(presets.shotDeck, true, "the page is told the deck is on");
  const run = await finishedRun();
  const plan = run.stages.write.output.plan;
  assert.equal(run.stages.write.output.fallback, false);
  assert.equal(plan.story, STORY, "the model's plain story is kept");
  assert.equal(plan.beats.length, 7);
  assert.equal((await json(`/api/runs/${run.id}/shots`)).body.status, "none");

  const started = await post(`/api/runs/${run.id}/shots`);
  assert.equal(started.status, 202);
  assert.equal(started.body.frames.length, 6, "capped at six frames");
  let deck;
  for (let i = 0; i < 200; i += 1) {
    ({ body: deck } = await json(`/api/runs/${run.id}/shots`));
    if (deck.status !== "drawing") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(deck.status, "done", JSON.stringify(deck));
  assert.equal(deck.frames.length, 6);
  assert.ok(deck.frames.every((f) => f.status === "done" && f.url), "every frame drawn");
  assert.deepEqual(images.map((c) => c.body.model), ["gpt-image-2.5-flare", ...Array(6).fill("gpt-image-2")], "the first frame finds the model; the rest skip the one the account lacks");
  assert.ok(images.every((c) => c.body.quality === "low" && c.body.size === "1536x1024" && c.auth === "Bearer sk-test-shots-key-abcdefghijklmnop"));
  assert.ok(maxInFlight <= 2, `${maxInFlight} image calls at once`);

  const names = qlooNames(run);
  assert.ok(names.length > 3, "the run has Qloo names to keep out");
  for (const { body } of images) {
    for (const n of names) assert.equal(named(body.prompt, n), false, `"${n}" reached an image prompt`);
    assert.match(body.prompt, /London/);
    assert.match(body.prompt, /No text, letters/);
    assert.match(body.prompt, /no real, famous or recognisable person/);
    assert.match(body.prompt, /Shot: Wide · 24mm · sodium light as in · slow push-in/, "the model's shot line, its title taken out");
  }
  assert.match(deck.frames[0].shot, /^Wide · 24mm/, "the shot line shows under the frame");
  for (const f of deck.frames) {
    assert.ok(f.reference?.title, "every frame names a film to study");
    assert.ok(Object.values(run.names).some((n) => n.name === f.reference.title), `"${f.reference.title}" traces to Qloo`);
  }

  const img = await fetch(`${base}${deck.frames[2].url}`);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), JPEG);

  const again = await post(`/api/runs/${run.id}/shots`);
  assert.equal(again.body.status, "done", "one deck per run: a second click shows the same deck");
  assert.equal(images.length, 7, "and pays for nothing more");

  const file = await fetch(`${base}${deck.download}`);
  assert.match(file.headers.get("content-disposition"), /attachment; filename=".+-shot-deck\.html"/);
  const html = await file.text();
  assert.equal((html.match(/data:image\/jpeg;base64,/g) ?? []).length, 6, "the frames are inside the file");
  assert.match(html, /1\. Beat &lt;1&gt; &amp; after/, "titles are escaped");
  assert.match(html, /Hold the wide shot &lt;long&gt;\./);
  assert.ok(!/<script/i.test(html), "no scripts in the download");
});

test("the caps: a per-visitor hourly limit and a daily site cap, and the deck can be switched off alone", async () => {
  const run = await finishedRun();
  process.env.SHOT_DECKS_PER_IP_PER_HOUR = "1";
  try {
    assert.equal((await post(`/api/runs/${run.id}/shots`)).status, 429, "one deck this hour already");
  } finally {
    process.env.SHOT_DECKS_PER_IP_PER_HOUR = "100";
  }
  process.env.MAX_SHOT_DECKS_PER_DAY = "1";
  try {
    assert.equal((await post(`/api/runs/${run.id}/shots`)).status, 503, "today's one deck is drawn");
    process.env.MAX_SHOT_DECKS_PER_DAY = "0";
    assert.equal((await json("/api/presets")).body.shotDeck, false, "0 switches the deck off");
    assert.equal((await json("/api/presets")).body.images, true, "while concept images stay on");
  } finally {
    delete process.env.MAX_SHOT_DECKS_PER_DAY;
  }
  assert.equal(images.length, 7, "no frame was drawn past a cap");
});

test("no key, no deck; only a film with beats gets one; bad ids are 404s", async () => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  try {
    assert.equal((await json("/api/presets")).body.shotDeck, false);
    const run = await finishedRun();
    assert.equal((await json(`/api/runs/${run.id}/shots`)).body.available, false);
    assert.equal((await post(`/api/runs/${run.id}/shots`)).status, 503);
  } finally {
    process.env.OPENAI_API_KEY = key;
  }
  const reel = await finishedRun("vegas-reel");
  assert.equal((await post(`/api/runs/${reel.id}/shots`)).status, 409);
  assert.equal((await json("/api/runs/..%2Fetc/shots")).status, 404);
  assert.equal((await fetch(`${base}/api/runs/${reel.id}/shots/1.jpg`)).status, 404);
  assert.equal((await fetch(`${base}/api/runs/${reel.id}/shots.html`)).status, 404);
  assert.equal(images.length, 7);
});

test("without a model the shot line comes from the plan's camera notes", async () => {
  const { shotPlan } = await import("../src/shots.js");
  const run = {
    input: { format: "film" },
    names: { a: { name: "Drishyam", kind: "movie" } },
    stages: { write: { output: { writer: "film", plan: { beats: [{ title: "One", what: "x", after: { title: "Drishyam" } }, { title: "Two", what: "y" }, "Three happens."], references: [{ title: "Drishyam", borrow: "Hold on the clock." }, { title: "Invented Film", borrow: "z" }], camera: { shots: ["Wide, locked off", "Close on hands"], lighting: ["One tube light"] } } } } },
  };
  const frames = shotPlan(run);
  assert.deepEqual(frames.map((f) => f.shot), ["Wide, locked off. Light: One tube light", "Close on hands. Light: One tube light", "Wide, locked off. Light: One tube light"]);
  assert.deepEqual(frames.map((f) => f.reference?.title), ["Drishyam", "Drishyam", "Drishyam"], "a title Qloo never returned is never offered");
  assert.equal(frames[0].reference.borrow, "Hold on the clock.");
  assert.equal(frames[2].title, "Beat 3", "a beat written as plain text still gets a frame");
  assert.equal(shotPlan({ ...run, input: { format: "reel" } }), undefined);
});
