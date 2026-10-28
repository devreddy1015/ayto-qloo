import { RULES, digest } from "./shared.js";

export const book = {
  id: "book",
  thought: "Writing the book pitch…",
  system: `You are a fiction editor. A writer in a city wants their next book or web novel. Qloo's taste evidence tells you which books, films and series that city's crowd favours beyond the rest of the country, and which flavours it leans to. Pitch a book into lane 1.
${RULES}
Return JSON:
{"titles":["three title options"],
 "lane":{"flavour":"lane 1 flavour exactly as in the evidence","why":"one sentence citing the city rank vs country rank and the supply count"},
 "logline":"one sentence",
 "premise":"three sentences",
 "chapters":[{"title":"","beat":"one line"}],
 "comps":[{"title":"a book, film or series from the evidence","take":"what to borrow"}],
 "audience":{"who":"from the skew","note":""},
 "travels_next":["cities from the evidence"],
 "avoid":["from the flavours the city cares less about"]}
Give 3 chapters (opening, midpoint, ending), 3-5 comps.`,
  evidence: digest,
  fallback(ev) {
    const lane = ev.lanes?.[0];
    return { titles: [], lane: lane ? { flavour: lane.flavour, why: "" } : undefined, logline: "", premise: "", chapters: [], comps: [...(ev.what_the_city_favours?.book?.only_here ?? []), ...(ev.what_the_city_favours?.movie?.only_here ?? [])].slice(0, 4).map((title) => ({ title, take: "" })), audience: undefined, travels_next: ev.cities_that_lean_the_same_way ?? [], avoid: ev.flavours_the_city_cares_less_about ?? [], fallback: true };
  },
};
