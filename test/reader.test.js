// The rules sentence reader against every sentence three reviews (30 Oct) found it reading wrong at some point,
// with the reading a maker would expect. Each change to the reader has to keep the whole table right, not just
// the case it was made for: the reader was rewritten three times that day and each rewrite broke something new.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heuristicParse } from "../src/parse.js";

// [sentence, format, city, loves (omitted: not checked)]
const TABLE = [
  ["i wana make a movie in hyderabad about crime", "film", "Hyderabad"],
  ["I'm making a crime short film in Hyderabad.", "film", "Hyderabad", []],
  ["In Hyderabad, I'm making a crime short film", "film", "Hyderabad"],
  ["A CRIME FILM IN HYDERABAD", "film", "Hyderabad"],
  ["I make reels in Las Vegas. I love Bad Bunny and Peso Pluma", "reel", "Las Vegas", ["Bad Bunny", "Peso Pluma"]],
  ["Reels in Mumbai about weddings in Udaipur", "reel", "Mumbai"],
  ["I'm in Hyderabad and want to shoot a short film in Vizag", "film", "Hyderabad"],
  ["a film for Netflix in Mumbai about a heist in Goa", "film", "Mumbai"],
  ["A short film in Hyderabad set in winter", "film", "Hyderabad"],
  ["a film in Mumbai set in Kashmir", "film", "Mumbai"],
  ["a film in Mumbai set in the 1990s", "film", "Mumbai"],
  ["A crime film in Hyderabad, based in Old City", "film", "Hyderabad"],
  ["a film in Hyderabad but shot in Vizag", "film", "Hyderabad"],
  ["a crime film in Telugu set in Hyderabad", "film", "Hyderabad"],
  ["a reel at Charminar in Hyderabad", "reel", "Hyderabad"],
  ["I'm a filmmaker from Chennai", "film", "Chennai"],
  ["We're shooting a reel in Goa", "reel", "Goa"],
  ["a reel shot at night in Hyderabad", "reel", "Hyderabad"],
  ["a reel in Kansas City", "reel", "Kansas City"],
  ["a reel in Cox's Bazar", "reel", "Cox's Bazar"],
  ["a film in Hyderabad's Old City", "film", "Hyderabad"],
  ["a drop for the crowd in Mumbai nightlife", "fashion", "Mumbai"],
  ["Small streetwear label in Mumbai, nightlife crowd", "fashion", "Mumbai"],
  ["a café in Kochi", "cafe", "Kochi"],
  // Titles keep their own words; the city is the one the sentence is about.
  ["I love Lost in Translation, set in Tokyo", "film", "Tokyo", ["Lost In Translation"]],
  ["a film after Midnight in Paris in Pune", "film", "Pune", ["Midnight in Paris"]],
  ["a romance inspired by In the Mood for Love in Mumbai", "film", "Mumbai", ["In the Mood for Love"]],
  ["a gangster film after Once Upon a Time in Mumbaai in Mumbai", "film", "Mumbai", ["Once Upon a Time in Mumbaai"]],
  ["a thriller inspired by Drishyam in Hyderabad", "film", "Hyderabad", ["Drishyam"]],
  ["reels for fans of Bad Bunny in Las Vegas", "reel", "Las Vegas", ["Bad Bunny"]],
  ["a film in Hyderabad, the crowd loves Pushpa and RRR", "film", "Hyderabad", ["Pushpa", "RRR"]],
  ["A short film in Hyderabad, fans of RRR in Telugu", "film", "Hyderabad", ["RRR"]],
  ["I love Drishyam for its twists, a thriller in Kochi", "film", "Kochi", ["Drishyam"]],
  ["a thriller after HIT on Netflix in Hyderabad", "film", "Hyderabad", ["HIT"]],
  ["a reel for fans of Interview with the Vampire in New Orleans", "reel", "New Orleans", ["Interview With The Vampire"]],
  ["a book club night inspired by Notes on a Scandal in London", "event", "London", ["Notes on a Scandal"]],
  ["fans of RRR, a film in Hyderabad", "film", "Hyderabad", ["RRR"]],
  ["a love story set in Hyderabad", "film", "Hyderabad", []],
  ["I'm getting into filmmaking in Hyderabad", "film", "Hyderabad", []],
  // The thing being made is the head of the first phrase.
  ["A podcast series about crime in Chennai", "podcast", "Chennai"],
  ["A short story collection in Delhi", "book", "Delhi"],
  ["A film festival in Kochi", "event", "Kochi"],
  ["A book cafe in Pune", "cafe", "Pune"],
  ["A book launch event in Pune", "event", "Pune"],
  ["a movie night in Pune", "event", "Pune"],
  ["a short film about a bar fight in Goa", "film", "Goa"],
  ["a documentary about a music festival in Pune", "film", "Pune"],
  ["a podcast about films in Mumbai", "podcast", "Mumbai"],
  ["a reel for Telugu cinema fans in Hyderabad", "reel", "Hyderabad"],
  ["a web series with 6 episodes in Mumbai", "film", "Mumbai"],
  ["a saree collection in Chennai", "fashion", "Chennai"],
];

test("the rules reader reads every sentence in the table as a maker would", () => {
  const wrong = [];
  for (const [text, format, city, loves] of TABLE) {
    const p = heuristicParse(text);
    const got = { format: p.format, city: p.city, ...(loves ? { loves: p.loves.map((l) => l.name) } : {}) };
    const want = { format, city, ...(loves ? { loves } : {}) };
    if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${text}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
  }
  assert.equal(wrong.length, 0, `${wrong.length} of ${TABLE.length} read wrong:\n  ${wrong.join("\n  ")}`);
});
