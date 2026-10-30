// Stage: with vs without Qloo. The same sentence goes to the same model with
// no evidence at all; the names it produces are checked against this run's Qloo
// evidence. It is the one-card answer to "would this work the same without Qloo?".
import { getRunCredential } from "../keys.js";
import { chatJson, llmAvailable, redact } from "../llm.js";
import { memo } from "../qloo.js";
import { isKnownName } from "./evidence.js";
import { emitEvent } from "./store.js";

const WITHOUT = {
  film: `A filmmaker describes a film they want to make. With no external data, suggest: 3 reference films they should study, 3 artists for the soundtrack, 3 cities beyond their own where it would land, and the sub-genre lane to take. Return JSON {"references":[""],"artists":[""],"cities":[""],"lane":""}`,
  reel: `A creator describes a reel they want to make. With no external data, suggest: the song or artist to use, 3 places in that city to shoot, and 3 films or series to nod to. Return JSON {"artists":[""],"places":[""],"references":[""]}`,
  fashion: `A small maker describes a drop. With no external data, suggest: 4 brands to study, 3 first cities, 3 artists for the launch, and the hero piece you would make first with its colours. Return JSON {"brands":[""],"cities":[""],"artists":[""],"look":{"garment":"one of tee|oversized_tee|hoodie|sweatshirt|dress|maxi_dress|saree|kurta|jacket|cape|cosplay_set|shorts|set","print":{"type":"graphic|stripe|typographic|none","placement":"chest|back|all_over|sleeve"},"palette":[{"name":"","hex":"#rrggbb"}]}}`,
  podcast: `Someone describes a podcast they want to start in a city. With no external data, suggest: 3 podcasts to study, 3 guests, an intro-music artist, 3 cities beyond their own where it would land. Return JSON {"references":[""],"guests":[""],"artists":[""],"cities":[""]}`,
  game: `A small studio describes a game for a city. With no external data, suggest: 3 games to study, a soundtrack artist, 3 cities beyond their own. Return JSON {"references":[""],"artists":[""],"cities":[""]}`,
  cafe: `Someone describes a café they want to open in a city. With no external data, suggest: 3 places in that city to study, 4 artists for the playlist, 3 brands to stock. Return JSON {"places":[""],"artists":[""],"brands":[""]}`,
  event: `Someone describes a live night in a city. With no external data, suggest: 3 artists for the lineup, 2 venues, 2 films to screen. Return JSON {"artists":[""],"places":[""],"references":[""]}`,
  book: `A writer describes a book for a city's readers. With no external data, suggest: 4 comparable titles, 3 cities beyond their own. Return JSON {"references":[""],"cities":[""]}`,
};

// The hero piece the model makes with no evidence, as the 3D viewer reads a style: a known garment, a print with no
// words on it (a motif could name a real brand; it is never drawn), and 2-4 valid colours.
const GARMENTS = ["tee", "oversized_tee", "hoodie", "sweatshirt", "dress", "maxi_dress", "saree", "kurta", "jacket", "cape", "cosplay_set", "shorts", "set"];
export function lookWithout(look) {
  if (!look || typeof look !== "object") return undefined;
  const word = (v) => String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const garment = GARMENTS.includes(word(look.garment)) ? word(look.garment) : "tee";
  const type = word(look.print?.type);
  const placement = word(look.print?.placement);
  const print = { type: type === "typographic" ? "graphic" : ["graphic", "stripe", "none"].includes(type) ? type : "none", placement: ["chest", "back", "all_over", "sleeve"].includes(placement) ? placement : "chest", motif: "" };
  const palette = (Array.isArray(look.palette) ? look.palette : [])
    .filter((c) => c && /^#[0-9a-f]{6}$/i.test(String(c.hex ?? "").trim()))
    .map((c) => ({ name: String(c.name ?? "").trim().slice(0, 30) || String(c.hex).trim().toLowerCase(), hex: String(c.hex).trim().toLowerCase() }))
    .slice(0, 4);
  return { garment, print, palette: palette.length ? palette : [{ name: "Black", hex: "#16171b" }, { name: "White", hex: "#f2f2f2" }] };
}

export async function diff(run) {
  const credential = getRunCredential(run.id);
  const format = run.input.format;
  const w = run.stages.write?.output;
  const input = run.input;
  // The same question the run answered, city included: a city picked in the confirm step may not be in the sentence.
  const city = run.stages.resolve?.output?.city?.name ?? input.city?.query ?? input.city;
  const said = input.text?.trim() || `I'm making a ${format}${input.theme?.query ? ` about ${input.theme.query}` : ""}.`;
  const sentence = city && !said.toLowerCase().includes(String(city).toLowerCase()) ? `${said.replace(/[.\s]+$/, "")}, in ${city}.` : said;
  let without;
  let error;
  if (credential || llmAvailable()) {
    emitEvent(run, { type: "thought", stage: "diff", text: "Asking the same question with no Qloo evidence…" });
    try {
      const deadline = Date.now() + 90000; // inside the stage's two minutes
      const call = () => chatJson({ credential, system: WITHOUT[format] ?? WITHOUT.film, user: sentence, temperature: 0.4, maxTokens: 600, deadline });
      without = credential ? await call() : await memo("llm", `diff-${format}-${format === "fashion" ? "v2" : "v1"}`, { sentence }, call);
    } catch (e) {
      error = redact(e.message).slice(0, 200);
    }
  }
  // Fashion: the hero piece without evidence goes to the 3D card, never into the names counted below.
  const look = format === "fashion" ? lookWithout(without?.look) : undefined;
  if (without && typeof without === "object" && "look" in without) {
    without = { ...without };
    delete without.look;
  }
  // Names however they come: strings, lists, lists of lists, or objects ({ title }, { name }, { artist }).
  const namesIn = (v) => (typeof v === "string" ? (v.trim() ? [v.trim()] : []) : Array.isArray(v) ? v.flatMap(namesIn) : v && typeof v === "object" ? namesIn(v.title ?? v.name ?? v.artist ?? v.city ?? v.brand ?? v.place ?? Object.values(v).find((x) => typeof x === "string")) : []);
  const flat = (o) => Object.entries(o ?? {}).filter(([k]) => !k.startsWith("_")).flatMap(([, v]) => namesIn(v));
  const withoutNames = flat(without);
  // Writers differ in shape: a field may be a list, one object, or missing. Normalise before reading names.
  const list = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : v ? [v] : []);
  const pl = w?.plan ?? {};
  const withNames = flat({
    a: list(pl.references).map((x) => x?.title ?? x),
    b: list(pl.soundtrack).map((x) => x?.artist ?? x),
    c: [...list(pl.travels_next), ...list(pl.first_cities)],
    d: [...list(pl.spots), ...list(pl.locations)].map((x) => x?.name ?? x),
    e: [...list(pl.brands_to_study), ...list(pl.brands_to_stock)],
    f: [pl.audio?.artist, pl.intro_music?.artist].filter(Boolean),
    g: [...list(pl.guests), ...list(pl.lineup), ...list(pl.playlist)].map((x) => x?.name ?? x?.artist ?? x),
    h: list(pl.comps).map((x) => x?.title ?? x),
    i: [...list(pl.study_these), ...list(pl.screening_or_theme)],
    j: [pl.venue?.name, pl.neighbourhood?.name].filter(Boolean),
  });
  const count = (list) => ({ named: list.length, grounded: list.filter((n) => isKnownName(run, n)).length });
  const a = count(withNames);
  const b = count(withoutNames);
  return { question: sentence, withQloo: withNames.slice(0, 12), withoutQloo: without ?? { unavailable: true }, ...(look ? { withoutLook: look } : {}), benchmark: { withQloo: a, withoutQloo: b }, error, summary: without ? `With Qloo: ${a.grounded} of ${a.named} names trace to evidence. Without: ${b.grounded} of ${b.named}.` : "No model to run the comparison." };
}
