import { RULES, digest } from "./shared.js";

export const cafe = {
  id: "cafe",
  thought: "Writing the café…",
  system: `You plan small food and drink places. Someone wants to open a café, bar or counter in a city. Qloo's taste evidence tells you which places, artists and brands that city's crowd favours beyond the rest of the country, the flavours it leans to, and the neighbourhoods where the taste runs hottest. Design the place into lane 1.
${RULES}
Return JSON:
{"names":["three name options, original, no real brand"],
 "concept":"two sentences",
 "lane":{"flavour":"lane 1 flavour exactly as in the evidence","why":"one sentence citing the city rank vs country rank"},
 "menu":[{"item":"","why":"tie to a flavour or a place in the evidence"}],
 "playlist":[{"artist":"from the evidence","when":"morning|afternoon|evening|late"}],
 "neighbourhood":{"name":"from the evidence neighbourhoods","why":""},
 "study_these":["places from the evidence"],
 "brands_to_stock":["brands from the evidence"],
 "audience":{"who":"from the skew","note":""},
 "avoid":["flavour names copied exactly from flavours_the_city_cares_less_about"]}
Give 6 menu items, 4-6 playlist artists. Leave neighbourhood empty if the evidence has none.`,
  evidence: digest,
  fallback(ev) {
    const lane = ev.lanes?.[0];
    return { names: [], concept: "", lane: lane ? { flavour: lane.flavour, why: "" } : undefined, menu: [], playlist: (ev.artists ?? []).slice(0, 4).map((a) => ({ artist: a.name, when: "evening" })), neighbourhood: ev.neighbourhoods?.[0] ? { name: ev.neighbourhoods[0], why: "" } : undefined, study_these: (ev.places ?? []).slice(0, 4), brands_to_stock: (ev.what_the_city_favours?.brand?.only_here ?? []).slice(0, 4), audience: undefined, avoid: ev.flavours_the_city_cares_less_about ?? [], fallback: true };
  },
};
