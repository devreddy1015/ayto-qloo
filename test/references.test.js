// The reference strip under a fashion drop's 3D preview: three or four pictures, all from Qloo's own read of the run.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickReferences } from "../public/references.js";

const img = (n) => `https://images.qloo.com/i/${n}.jpg`;
const run = (labels, loves = [], rows = [], shortlist = []) => ({
  input: { city: { query: "Las Vegas, NV, United States" } },
  stages: { resolve: { output: { city: { name: "Las Vegas" }, loves } }, read: { output: { columns: { brand: { rows } } } }, look: { output: { labels } }, audio: { output: { shortlist } } },
});

test("photos lead: the love, then two style icons, then the labels the country's list lacks; four at most", () => {
  const refs = pickReferences(
    run(
      [{ name: "Common Label", image: img(1) }, { name: "Local Label", image: img(2) }, { name: "Second Label", image: img(3) }],
      [{ name: "KPop Demon Hunters", type: "movie", image: img(9) }],
      [{ name: "Local Label", onlyHere: true }, { name: "Common Label", onlyHere: false }],
      [{ name: "Dita Von Teese", image: img(7), why: "favoured in Las Vegas, not nationally" }, { name: "Kat Von D", image: img(8), why: "hidden gem: loved here, small everywhere" }, { name: "Third Icon", image: img(6) }],
    ),
  );
  assert.deepEqual(refs.map((r) => r.name), ["KPop Demon Hunters", "Dita Von Teese", "Kat Von D", "Local Label"]);
  assert.deepEqual(refs.map((r) => r.kind), ["love", "artist", "artist", "brand"]);
  assert.equal(refs[1].tag, "Style icon");
  assert.equal(refs[1].why, "favoured in Las Vegas, not nationally", "the audio stage's own reason");
  assert.match(refs[3].why, /Las Vegas favours it; the country's top list doesn't/);
});

test("without a love: two icons and two labels; with few labels, more icons fill the strip", () => {
  const icons = [1, 2, 3, 4].map((n) => ({ name: `Icon ${n}`, image: img(10 + n) }));
  assert.deepEqual(pickReferences(run([{ name: "Label A", image: img(1) }, { name: "Label B", image: img(2) }, { name: "Label C", image: img(3) }], [], [], icons)).map((r) => r.name), ["Icon 1", "Icon 2", "Label A", "Label B"]);
  assert.deepEqual(pickReferences(run([{ name: "Label A", image: img(1) }], [], [], icons)).map((r) => r.name), ["Icon 1", "Icon 2", "Label A", "Icon 3"]);
  assert.equal(pickReferences(run([], [], [], [{ name: "Icon", image: img(1) }])).length, 0, "one picture is no strip");
  assert.match(pickReferences(run([], [], [], icons))[0].why, /followed in Las Vegas/, "an icon with no reason still says why");
});

test("only https pictures from the read: no picture, a data: or javascript: URL, or a repeat is skipped", () => {
  const refs = pickReferences(
    run([
      { name: "No Picture" },
      { name: "Data Label", image: "data:image/svg+xml,<svg/>" },
      { name: "Script Label", image: "javascript:alert(1)" },
      { name: "Plain Http", image: "http://example.com/a.jpg" },
      { name: "Good One", image: img(1) },
      { name: "good one", image: img(2) },
      { name: "Good Two", image: img(3) },
    ]),
  );
  assert.deepEqual(refs.map((r) => r.name), ["Good One", "Good Two"]);
});

test("fewer than two pictures means no strip; a run with nothing read yet has none", () => {
  assert.deepEqual(pickReferences(run([{ name: "Only One", image: img(1) }])), []);
  assert.deepEqual(pickReferences({}), []);
  assert.deepEqual(pickReferences(undefined), []);
});
