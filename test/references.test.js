// The reference strip under a fashion drop's 3D preview: three or four pictures, all from Qloo's own read of the run.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickReferences } from "../public/references.js";

const img = (n) => `https://images.qloo.com/i/${n}.jpg`;
const run = (labels, loves = [], rows = []) => ({
  input: { city: { query: "Tiruppur, India" } },
  stages: { resolve: { output: { city: { name: "Tiruppur" }, loves } }, read: { output: { columns: { brand: { rows } } } }, look: { output: { labels } } },
});

test("the love comes first, then the labels the country's list lacks, then the rest; four at most", () => {
  const refs = pickReferences(
    run(
      [{ name: "Common Label", image: img(1) }, { name: "Local Label", image: img(2) }, { name: "Second Label", image: img(3) }, { name: "Third Label", image: img(4) }, { name: "Fourth Label", image: img(5) }],
      [{ name: "KPop Demon Hunters", type: "movie", image: img(9) }],
      [{ name: "Local Label", onlyHere: true }, { name: "Common Label", onlyHere: false }],
    ),
  );
  assert.deepEqual(refs.map((r) => r.name), ["KPop Demon Hunters", "Local Label", "Common Label", "Second Label"]);
  assert.equal(refs[0].kind, "movie");
  assert.match(refs[1].why, /Tiruppur favours it; the country's top list doesn't/);
  assert.match(refs[2].why, /A label Tiruppur favours/);
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
