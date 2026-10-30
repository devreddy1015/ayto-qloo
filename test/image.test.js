// Concept images against a fake OpenAI image API: drawn on demand from a finished run, falling back to the next model
// when an account lacks the first, with every Qloo name kept out of the prompt, and off when there's no key.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const calls = [];
let fake;
let app;
let base;

before(async () => {
  fake = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      calls.push({ path: req.url, auth: req.headers.authorization, body: parsed });
      res.writeHead(parsed.model === "gpt-image-2.5-flare" ? 404 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(parsed.model === "gpt-image-2.5-flare" ? { error: { message: "The model `gpt-image-2.5-flare` does not exist or you do not have access to it." } } : { data: [{ b64_json: JPEG.toString("base64") }] }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  Object.assign(process.env, {
    CULTURE_GAP_MODE: "fake",
    GROQ_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "sk-test-image-key-abcdefghijklmnop",
    OPENAI_IMAGE_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1`,
    CACHE_DIR: `/tmp/ayto-image-test-${process.pid}`,
    PORT: String(21000 + (process.pid % 20000)),
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

async function finishedRun() {
  const { body } = await post("/api/runs", { showcase: "hyderabad-crime-film" });
  for (let i = 0; i < 200; i += 1) {
    const { body: r } = await json(`/api/runs/${body.id}`);
    if ((r.run ?? r).status === "done") return r.run ?? r;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("run didn't finish");
}

test("a finished run gets one concept image, drawn without a single Qloo name", async () => {
  const { body: presets } = await json("/api/presets");
  assert.equal(presets.images, true, "the page is told images are on");
  const run = await finishedRun();
  const started = await post(`/api/runs/${run.id}/image`);
  assert.equal(started.status, 202);
  let status;
  for (let i = 0; i < 100; i += 1) {
    ({ body: status } = await json(`/api/runs/${run.id}/image`));
    if (status.status !== "drawing") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(status.status, "done", JSON.stringify(status));
  assert.deepEqual(calls.map((c) => c.body.model), ["gpt-image-2.5-flare", "gpt-image-2"], "an account without the first model falls back");
  const ask = calls.at(-1);
  assert.equal(ask.path, "/v1/images/generations");
  assert.equal(ask.auth, "Bearer sk-test-image-key-abcdefghijklmnop");
  assert.equal(ask.body.size, "1536x1024");
  assert.match(ask.body.prompt, /No text, letters/);
  assert.match(ask.body.prompt, /Hyderabad/, "the city sets the scene");
  const names = Object.values(run.names ?? {}).filter((n) => !["city", "neighbourhood", "tag"].includes(n.kind) && String(n.name).length >= 3);
  assert.ok(names.length > 3, "the run has Qloo names to keep out");
  for (const n of names) assert.equal(new RegExp(`(^|[^\\p{L}\\p{N}])${n.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(ask.body.prompt), false, `"${n.name}" reached the prompt`);
  const img = await fetch(`${base}${status.url}`);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), JPEG);
  const again = await post(`/api/runs/${run.id}/image`);
  assert.equal(again.body.status, "done", "a second click shows the same image instead of paying for another");
  assert.equal(calls.length, 2);
});

test("no key, no button: the page is told and the route says so", async () => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  try {
    const { body: presets } = await json("/api/presets");
    assert.equal(presets.images, false);
    const run = await finishedRun();
    assert.equal((await post(`/api/runs/${run.id}/image`)).status, 503);
  } finally {
    process.env.OPENAI_API_KEY = key;
  }
  assert.equal((await json("/api/runs/..%2Fetc/image")).status, 404);
});

test("the prompt keeps the brief and drops the names", async () => {
  const { scrub } = await import("../src/image.js");
  const run = { names: { a: { name: "Insomnia", kind: "place" }, b: { name: "Nucleya", kind: "artist" }, c: { name: "Hyderabad", kind: "city" }, d: { name: "V", kind: "movie" } } };
  assert.equal(scrub("A bookkeeper at Insomnia hums Nucleya in Hyderabad.", run), "A bookkeeper at hums in Hyderabad.");
  assert.equal(scrub("Vivid night in Vizag", run), "Vivid night in Vizag", "a short title never eats other words");
});
