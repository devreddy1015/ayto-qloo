import assert from "node:assert/strict";
import { test } from "node:test";
import { heuristicParse } from "../src/parse.js";

test("heuristicParse reads format, city and theme from a plain sentence", () => {
  const p = heuristicParse("i wana make a movie in hyderabad about crime");
  assert.equal(p.format, "film");
  assert.equal(p.city, "Hyderabad");
  assert.equal(p.theme, "crime");
});

test("heuristicParse reads reels, multi-word cities and a love", () => {
  const p = heuristicParse("I make reels in Las Vegas. I love Bad Bunny and Peso Pluma");
  assert.equal(p.format, "reel");
  assert.equal(p.city, "Las Vegas");
  assert.deepEqual(p.loves.map((l) => l.name), ["Bad Bunny", "Peso Pluma"]);
});

test("heuristicParse falls back to genre words and fashion hints", () => {
  const p = heuristicParse("Small streetwear label in Mumbai, nightlife crowd");
  assert.equal(p.format, "fashion");
  assert.equal(p.city, "Mumbai");
  assert.equal(p.theme, "nightlife");
});
