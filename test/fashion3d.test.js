// Fashion in 3D: the procedural garments build and paint headless (three.js in Node, a stand-in canvas), and the
// on-demand print and model routes run against fake OpenAI and Stability servers: one per style, capped per visitor
// and per day, off without a key, with every Qloo name kept out of every prompt.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

// ---------- the procedural garments, headless ----------

const painted = [];
const ctx = new Proxy(
  {},
  {
    get: (t, k) => (k === "measureText" ? () => ({ width: 40 }) : k === "drawImage" ? (...a) => painted.push(a.length) : typeof k === "string" ? (t[k] ??= () => {}) : undefined),
    set: () => true,
  },
);
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
const renderer = { capabilities: { getMaxAnisotropy: () => 8 } };
const g3d = await import("../public/garment3d.js");
const THREE = await import("three");

test("every garment builds finite geometry around the mannequin and paints every print without throwing", () => {
  for (const kind of g3d.GARMENTS) {
    const parts = g3d.buildGarment(kind, renderer);
    assert.ok(parts.length >= 3, `${kind} has parts`);
    const box = new THREE.Box3();
    for (const p of parts) {
      const pos = p.mesh.geometry.attributes.position;
      assert.ok(pos.count > 0 && [...pos.array].every(Number.isFinite), `${kind}: finite vertices`);
      assert.ok(p.mesh.geometry.attributes.uv, `${kind}: a part has uvs for its texture`);
      p.mesh.updateMatrixWorld(true);
      box.expandByObject(p.mesh);
      for (const print of [{ type: "graphic", placement: "chest" }, { type: "typographic", placement: "back", motif: "night" }, { type: "stripe", placement: "all_over" }, { type: "graphic", placement: "sleeve" }, { type: "none", placement: "chest" }])
        for (const image of [null, { panel: true }])
          g3d.paintPart(p, { base: "#5b2a6e", accent: "#e0b04a", print: { motif: "", ...print }, label: "Style", vOf: p.layout?.vOf ?? ((y) => y), image, imageMode: image ? (print.placement === "all_over" ? "fabric" : "panel") : "" });
    }
    assert.ok(box.min.y > -0.01 && box.max.y < 1.75, `${kind} stays between the floor and the head (${box.min.y.toFixed(2)}–${box.max.y.toFixed(2)})`);
    assert.ok(box.max.x < 0.7 && box.min.x > -0.7, `${kind} stays on the turntable`);
  }
  assert.ok(painted.length > 0, "drawn prints were painted onto the cloth");
});

test("long garments reach the floor; the cape clears the mannequin's arms", () => {
  const extent = (kind) => {
    const box = new THREE.Box3();
    for (const p of g3d.buildGarment(kind, renderer)) {
      p.mesh.updateMatrixWorld(true);
      box.expandByObject(p.mesh);
    }
    return box;
  };
  assert.ok(extent("maxi_dress").min.y < 0.1);
  assert.ok(extent("saree").min.y < 0.1);
  assert.ok(extent("dress").min.y > 0.3, "the A-line dress stops at the knee");
  // The cape body is the first part. The mannequin's upper arm splays out from x ≈ 0.273 at the shoulder (y 1.45)
  // to x ≈ 0.321 at the elbow (y 1.05): at the sides the cape must stay outside it.
  const cape = g3d.buildGarment("cape", renderer)[0].mesh.geometry.attributes.position;
  const arm = (y) => 0.273 + ((1.45 - y) * 0.048) / 0.4;
  let closest = Infinity;
  for (let i = 0; i < cape.count; i += 1) {
    const y = cape.getY(i);
    if (y > 1.05 && y < 1.45 && Math.abs(cape.getZ(i)) < 0.05) closest = Math.min(closest, Math.abs(cape.getX(i)) - arm(y));
  }
  assert.ok(closest > 0.005, `cape clearance at the arms: ${closest.toFixed(3)}`);
});

test("the writer's words pick the new garments; prints go on as panels or fabric", () => {
  assert.equal(g3d.garmentOf({ category: "cosplay coat with armour" }), "cosplay_set");
  assert.equal(g3d.garmentOf({ category: "silk saree" }), "saree");
  assert.equal(g3d.garmentOf({ name: "Night cloak" }), "cape");
  assert.equal(g3d.garmentOf({ category: "floor-length gown" }), "maxi_dress");
  assert.equal(g3d.garmentOf({ category: "landscape tee" }), "tee", "a word inside another word is not a cape");
  assert.equal(g3d.garmentOf({ garment: "cosplay_set", category: "tee" }), "cosplay_set", "the plan's garment wins");
  assert.equal(g3d.printModeOf({ print: { type: "graphic", placement: "chest" } }), "panel");
  assert.equal(g3d.printModeOf({ print: { type: "graphic", placement: "all_over" } }), "fabric");
  assert.equal(g3d.printModeOf({ garment: "saree", print: { type: "graphic", placement: "chest" } }), "fabric");
});

// ---------- the routes, against fake OpenAI and Stability ----------

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 0xff, 0xd9]);
const GLB = Buffer.concat([Buffer.from("glTF", "latin1"), Buffer.from([2, 0, 0, 0, 12, 0, 0, 0])]);
const openaiCalls = [];
const stabilityCalls = [];
let stabilityFails = false;
let fake;
let app;
let base;

before(async () => {
  fake = createServer((req, res) => {
    const chunks = [];
    req.on("data", (d) => chunks.push(d));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      if (req.url.startsWith("/v2beta/3d/")) {
        stabilityCalls.push({ path: req.url, auth: req.headers.authorization, type: req.headers["content-type"], body: body.toString("latin1") });
        if (stabilityFails) {
          res.writeHead(500, { "content-type": "application/json" });
          return res.end(JSON.stringify({ name: "server_error", errors: ["try again, key sk-abcdefghijklmnopqrstuvwxyz123456"] }));
        }
        res.writeHead(200, { "content-type": "model/gltf-binary" });
        return res.end(GLB);
      }
      const parsed = JSON.parse(body.toString() || "{}");
      openaiCalls.push({ path: req.url, body: parsed });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ b64_json: JPEG.toString("base64") }] }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  const at = `http://127.0.0.1:${fake.address().port}`;
  Object.assign(process.env, {
    CULTURE_GAP_MODE: "fake",
    GROQ_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "sk-test-image-key-abcdefghijklmnop",
    OPENAI_IMAGE_BASE_URL: `${at}/v1`,
    STABILITY_API_KEY: "sk-test-stability-key-abcdefghijk",
    STABILITY_BASE_URL: at,
    CACHE_DIR: `/tmp/ayto-fashion3d-test-${process.pid}`,
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

async function fashionRun() {
  const { body } = await post("/api/runs", { showcase: "tiruppur-kidswear" });
  for (let i = 0; i < 300; i += 1) {
    const { body: r } = await json(`/api/runs/${body.id}`);
    if ((r.run ?? r).status === "done") return r.run ?? r;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("run didn't finish");
}
async function settle(path) {
  let status;
  for (let i = 0; i < 100; i += 1) {
    ({ body: status } = await json(path));
    if (status.status !== "drawing") return status;
    await new Promise((r) => setTimeout(r, 50));
  }
  return status;
}
const named = (run) => Object.values(run.names ?? {}).filter((n) => !["city", "neighbourhood", "tag"].includes(n.kind) && String(n.name).trim().length >= 3);
const mentions = (text, name) => new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);

test("a hero style gets a drawn print and a 3D model, each once, with no Qloo name in either prompt", async () => {
  const { body: presets } = await json("/api/presets");
  assert.deepEqual(presets.garment3d, { prints: true, models: true });
  const run = await fashionRun();
  const styles = run.stages.write.output.plan.styles;
  const hero = styles.findIndex((s) => s.hero);
  assert.ok(hero >= 0);

  assert.equal((await post(`/api/runs/${run.id}/styles/${hero}/print`)).status, 202);
  const print = await settle(`/api/runs/${run.id}/styles/${hero}/print`);
  assert.equal(print.status, "done", JSON.stringify(print));
  const jpg = await fetch(`${base}${print.url}`);
  assert.equal(jpg.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await jpg.arrayBuffer()), JPEG);

  assert.equal((await post(`/api/runs/${run.id}/styles/${hero}/model`)).status, 202);
  const model = await settle(`/api/runs/${run.id}/styles/${hero}/model`);
  assert.equal(model.status, "done", JSON.stringify(model));
  const glb = await fetch(`${base}${model.url}`);
  assert.equal(glb.headers.get("content-type"), "model/gltf-binary");
  assert.deepEqual(Buffer.from(await glb.arrayBuffer()), GLB);

  assert.equal(openaiCalls.length, 2, "one drawn print, one product shot");
  assert.equal(stabilityCalls.length, 1);
  const [printAsk, shotAsk] = openaiCalls.map((c) => c.body.prompt);
  assert.match(printAsk, /No text, letters/);
  assert.match(shotAsk, /ghost mannequin/);
  assert.match(shotAsk, /not any existing character/);
  assert.equal(stabilityCalls[0].path, "/v2beta/3d/stable-fast-3d");
  assert.equal(stabilityCalls[0].auth, "Bearer sk-test-stability-key-abcdefghijk");
  assert.match(stabilityCalls[0].type, /^multipart\/form-data/);
  assert.match(stabilityCalls[0].body, /name="image"; filename="style.jpg"/);
  assert.ok(stabilityCalls[0].body.includes(JPEG.toString("latin1")), "the product shot is what goes to Stability");
  assert.ok(named(run).length > 3, "the run has Qloo names to keep out");
  for (const n of named(run)) for (const ask of [printAsk, shotAsk]) assert.equal(mentions(ask, n.name), false, `"${n.name}" reached a prompt`);

  // One per style: a second click shows the same files instead of paying again.
  assert.equal((await post(`/api/runs/${run.id}/styles/${hero}/print`)).body.status, "done");
  assert.equal((await post(`/api/runs/${run.id}/styles/${hero}/model`)).body.status, "done");
  assert.equal(openaiCalls.length, 2);
  const saved = await json(`/api/runs/${run.id}/garment`);
  assert.equal(saved.body.styles[hero].print.status, "done");
  assert.equal(saved.body.styles[hero].model.status, "done");

  const other = styles.findIndex((s) => !s.hero);
  if (other >= 0) assert.equal((await post(`/api/runs/${run.id}/styles/${other}/model`)).status, 400, "models are for hero styles");
  assert.equal((await post(`/api/runs/${run.id}/styles/9/print`)).status, 404);
  assert.equal((await post(`/api/runs/${run.id}/styles/x/print`)).status, 404);
});

test("a failed model says why without the key, and a visitor's retries are capped per hour", async () => {
  const run = await fashionRun();
  const hero = run.stages.write.output.plan.styles.findIndex((s) => s.hero);
  stabilityFails = true;
  try {
    // A failure can be retried, and each retry counts: three model requests an hour per address, whatever earlier
    // tests already spent from this one.
    let tries = 0;
    for (;;) {
      const r = await post(`/api/runs/${run.id}/styles/${hero}/model`);
      if (r.status === 429) break;
      assert.equal(r.status, 202, JSON.stringify(r.body));
      tries += 1;
      assert.ok(tries <= 3, "the hourly cap holds");
      const failed = await settle(`/api/runs/${run.id}/styles/${hero}/model`);
      assert.equal(failed.status, "error");
      assert.match(failed.error, /stable-fast-3d 500/);
      assert.doesNotMatch(failed.error, /abcdefghijklmnopqrstuvwxyz/, "a key in the error is redacted");
    }
    assert.ok(tries >= 1, "at least one failure was seen");
  } finally {
    stabilityFails = false;
  }
});

test("a daily cap for the site, and no key means no button", async () => {
  const run = await fashionRun();
  process.env.MAX_PRINTS_PER_DAY = "1"; // the first test spent today's one
  try {
    const r = await post(`/api/runs/${run.id}/styles/0/print`);
    assert.equal(r.status, 503);
    assert.match(r.body.error, /today's prints/);
  } finally {
    delete process.env.MAX_PRINTS_PER_DAY;
  }
  const stability = process.env.STABILITY_API_KEY;
  process.env.STABILITY_API_KEY = "";
  try {
    assert.deepEqual((await json("/api/presets")).body.garment3d, { prints: true, models: false });
    assert.equal((await post(`/api/runs/${run.id}/styles/0/model`)).status, 503);
  } finally {
    process.env.STABILITY_API_KEY = stability;
  }
  const openai = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  try {
    assert.deepEqual((await json("/api/presets")).body.garment3d, { prints: false, models: false });
    assert.equal((await post(`/api/runs/${run.id}/styles/0/print`)).status, 503);
  } finally {
    process.env.OPENAI_API_KEY = openai;
  }
});

test("prompts drop every Qloo name, keep the city's look, and keep cosplay original", async () => {
  const { printPrompt, shotPrompt } = await import("../src/fashion3d.js");
  const run = {
    names: { a: { name: "Demon Hunters", kind: "movie" }, b: { name: "Nucleya", kind: "artist" }, c: { name: "Hyderabad", kind: "city" }, d: { name: "Zudio", kind: "brand" } },
    stages: {
      look: { output: { styles: [{ name: "Streetwear", lift: 4 }, { name: "Preppy", lift: -2 }] } },
      write: { output: { plan: { palette: [{ name: "Neon Plum", hex: "#5b2a6e" }], styles: [{ name: "Demon Hunters Coat", category: "cosplay coat like Zudio's", garment: "cosplay_set", cues: ["Nucleya night", "satin shell"], print: { type: "graphic", placement: "back", motif: "Demon Hunters crest" }, hero: true }] } } },
    },
  };
  for (const ask of [printPrompt(run, 0).prompt, shotPrompt(run, 0).prompt]) {
    for (const name of ["Demon Hunters", "Nucleya", "Zudio"]) assert.equal(mentions(ask, name), false, `${name} in: ${ask}`);
    assert.match(ask, /Streetwear/);
    assert.doesNotMatch(ask, /Preppy/);
    assert.match(ask, /#5b2a6e/);
    assert.match(ask, /existing character/);
  }
  assert.equal(printPrompt(run, 0).mode, "panel");
  assert.equal(printPrompt(run, 3), undefined);
});
