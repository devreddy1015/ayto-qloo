import assert from "node:assert/strict";
import { test } from "node:test";
process.env.GROQ_API_KEY = "";
const { produce, ASSUMPTIONS } = await import("../src/pipeline/produce.js");

const run = (over = {}) => ({
  id: "r_test",
  input: { text: "I run a small kidswear unit in Tiruppur", theme: { query: "" }, ...over.input },
  stages: {
    resolve: { output: { city: { name: "Tiruppur" } } },
    travels: { output: { cities: [{ name: "Tiruppur", lift: 0.4, home: true }, { name: "Tirupati", lift: 0.8 }, { name: "Nashik", lift: 0.2 }] } },
    write: { output: { plan: { styles: [{ name: "Tee 01", garment: "tee", colourways: ["Ink", "Tape"], hero: true, print: { type: "graphic", placement: "chest" } }, { name: "Hoodie 01", garment: "hoodie", colourways: [], hero: false }], palette: [{ name: "Ink", hex: "#19234d" }], channels: ["Instagram + WhatsApp catalogue", "Myntra"] } } },
  },
});

test("produce builds packs, economics, sizes and a city split from editable assumptions", async () => {
  const out = await produce(run());
  assert.equal(out.packs.length, 2);
  assert.equal(out.packsBy, "defaults");
  assert.equal(out.packs[0].pointsOfMeasure[0].cm, ""); // blank on purpose
  assert.deepEqual(out.packs[0].sizes, Object.keys(ASSUMPTIONS.kidsSizeCurve)); // kidswear detected
  assert.equal(out.economics.mrp, 810);
  assert.equal(out.economics.gstRate, 0.05);
  assert.deepEqual(out.economics.channels.map((c) => c.channel), ["Instagram + WhatsApp", "Myntra"]);
  assert.ok(out.economics.channels[0].marginPerUnit > 0);
  const tee = out.styles.find((s) => s.style === "Tee 01");
  assert.equal(tee.total, 300); // hero 300 across 2 colourways, 150 each ≥ MOQ 100
  assert.equal(out.styles.find((s) => s.style === "Hoodie 01").total, 150);
  assert.equal(out.totalUnits, 450);
  assert.equal(out.allocation[0].city, "Tiruppur");
  assert.equal(out.allocation[0].units, 90); // 20% home share
  assert.equal(out.allocation[1].city, "Tirupati"); // highest lift first
  assert.equal(out.compliance.loose.length, 4);
});

test("produce flips to 18% GST above the ₹2,500 cliff", async () => {
  const out = await produce(run({ input: { assumptions: { tier: "premium", unitCost: { fabric: 500, cmt: 200, print: 50, trimsAndPacking: 50 } } } }));
  assert.ok(out.economics.mrp > 2500);
  assert.equal(out.economics.gstRate, 0.18);
  assert.match(out.economics.gstNote, /18% GST/);
});

test("a drop outside India gets no rupee costing, and says why", async () => {
  const { produce } = await import("../src/pipeline/produce.js");
  const run = { stages: { resolve: { output: { city: { name: "Paris", market: "France" } } }, write: { output: { plan: { styles: [{ name: "Studio Leather Jacket", garment: "jacket", hero: true }] } } } } };
  const out = await produce(run);
  assert.equal(out.notCosted, true);
  assert.deepEqual(out.packs, []);
  assert.doesNotMatch(out.summary, /₹/);
  assert.match(out.summary, /France/);
});
