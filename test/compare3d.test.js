// With vs without Qloo, in 3D: for a fashion run the no-evidence answer also names the hero piece it would make and
// its colours. That look is read safely (a known garment, no words drawn, valid colours) and kept out of the names the
// card counts. A fake OpenAI-compatible model answers.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { after, before, test } from "node:test";

let fake;
let answer = {};
const systems = [];

before(async () => {
  fake = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      systems.push(JSON.parse(body).messages?.[0]?.content ?? "");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(answer) } }], usage: { prompt_tokens: 5, completion_tokens: 5 } }));
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  Object.assign(process.env, { CULTURE_GAP_MODE: "fake", LLM_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1`, CACHE_DIR: `/tmp/ayto-compare3d-test-${process.pid}` });
});

after(async () => {
  fake.close();
  await rm(process.env.CACHE_DIR, { recursive: true, force: true });
});

const runOf = (format, id) => ({
  id,
  input: { format, text: "I run a small kidswear unit in Tiruppur.", city: { query: "Tiruppur, India" } },
  names: { a: { name: "Hand Loom", kind: "tag" } },
  stages: { write: { output: { plan: { styles: [{ name: "Loom Saree", garment: "saree", hero: true }], palette: [{ name: "Plum", hex: "#5b2a6e" }], brands_to_study: [] } } } },
});

test("a fashion run's no-Qloo answer gives its hero piece to the 3D card, not to the name count", async () => {
  const { setRunCredential } = await import("../src/keys.js");
  const { diff } = await import("../src/pipeline/diff.js");
  const run = runOf("fashion", "r_cmp_fashion");
  setRunCredential(run.id, { provider: "local", key: "local", model: "fake" });
  answer = { brands: ["Nike", "Zara"], cities: ["Mumbai"], artists: ["Arijit Singh"], look: { garment: "Oversized Tee", print: { type: "typographic", placement: "chest", motif: "JUST DO IT" }, palette: [{ name: "Black", hex: "#111111" }, { name: "Neon", hex: "green" }, { name: "White", hex: "#FFFFFF" }] } };
  const out = await diff(run);
  assert.match(systems.at(-1), /"look":\{"garment":"one of tee\|/, "the fashion question asks for the hero piece");
  assert.deepEqual(out.withoutLook, { garment: "oversized_tee", print: { type: "graphic", placement: "chest", motif: "" }, palette: [{ name: "Black", hex: "#111111" }, { name: "White", hex: "#ffffff" }] });
  assert.equal(out.withoutQloo.look, undefined, "the look isn't listed with the names");
  assert.equal(out.benchmark.withoutQloo.named, 4, "only the four names count: no garment, colour or print words");
});

test("an odd look still reads: unknown garments are tees, no colours means black and white, no look means no card", async () => {
  const { lookWithout } = await import("../src/pipeline/diff.js");
  assert.deepEqual(lookWithout({ garment: "spacesuit", print: { type: "hologram", placement: "hat" }, palette: "red" }), { garment: "tee", print: { type: "none", placement: "chest", motif: "" }, palette: [{ name: "Black", hex: "#16171b" }, { name: "White", hex: "#f2f2f2" }] });
  assert.equal(lookWithout(undefined), undefined);
  assert.equal(lookWithout("a tee"), undefined);
  assert.equal(lookWithout({ garment: "cosplay set", palette: [{ hex: "#abcdef" }] }).garment, "cosplay_set");
  assert.equal(lookWithout({ garment: "tee", palette: [{ hex: "#abcdef" }] }).palette[0].name, "#abcdef", "a colour with no name is named by its hex");

  const { setRunCredential } = await import("../src/keys.js");
  const { diff } = await import("../src/pipeline/diff.js");
  const film = runOf("film", "r_cmp_film");
  setRunCredential(film.id, { provider: "local", key: "local", model: "fake" });
  answer = { references: ["Some Film"], artists: [], cities: [], lane: "Noir", look: { garment: "dress" } };
  const out = await diff(film);
  assert.equal(out.withoutLook, undefined, "only fashion gets a 3D comparison");
  const fashion = runOf("fashion", "r_cmp_nolook");
  setRunCredential(fashion.id, { provider: "local", key: "local", model: "fake" });
  answer = { brands: ["Nike"], cities: [], artists: [] };
  assert.equal((await diff(fashion)).withoutLook, undefined, "a model that skips the look leaves the card out");
});
