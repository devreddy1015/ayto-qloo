import { RULES, digest } from "./shared.js";

export const event = {
  id: "event",
  thought: "Writing the night…",
  system: `You programme live nights: gigs, club nights, screenings, pop-ups. Someone wants to run one in a city. Qloo's taste evidence tells you which artists, places and films that city's crowd favours beyond the rest of the country, and which flavours it leans to. Programme one night into lane 1.
${RULES}
Return JSON:
{"names":["three name options, original"],
 "concept":"two sentences",
 "lane":{"flavour":"lane 1 flavour exactly as in the evidence","why":"one sentence citing the city rank vs country rank"},
 "lineup":[{"artist":"from the evidence","slot":"opener|main|late|dj"}],
 "venue":{"name":"a place from the evidence","why":""},
 "screening_or_theme":["films from the evidence to screen or nod to"],
 "runsheet":[{"time":"","what":""}],
 "promo_hook":"one line for the poster",
 "audience":{"who":"from the skew","note":""},
 "avoid":["flavour names copied exactly from flavours_the_city_cares_less_about"]}
Give 3-4 lineup slots, 4-6 runsheet rows. Leave venue empty if the evidence has no places.`,
  evidence: digest,
  fallback(ev) {
    const lane = ev.lanes?.[0];
    return { names: [], concept: "", lane: lane ? { flavour: lane.flavour, why: "" } : undefined, lineup: (ev.artists ?? []).slice(0, 3).map((a, i) => ({ artist: a.name, slot: ["opener", "main", "late"][i] })), venue: ev.places?.[0] ? { name: ev.places[0], why: "" } : undefined, screening_or_theme: (ev.what_the_city_favours?.movie?.only_here ?? []).slice(0, 2), runsheet: [], promo_hook: "", audience: undefined, avoid: ev.flavours_the_city_cares_less_about ?? [], fallback: true };
  },
};
