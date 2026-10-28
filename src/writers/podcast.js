import { RULES, digest } from "./shared.js";

export const podcast = {
  id: "podcast",
  thought: "Writing the podcast…",
  system: `You are a podcast developer. Someone in a city wants to start a show. Qloo's taste evidence tells you which podcasts, people and artists that city's crowd favours beyond the rest of the country, and which flavours it leans to. Write a show that only this city would make, into lane 1.
${RULES}
Return JSON:
{"titles":["three title options"],
 "lane":{"flavour":"lane 1 flavour exactly as in the evidence","why":"one sentence citing the city rank vs country rank and the supply count"},
 "premise":"two sentences",
 "format":"interview|narrative|panel|solo",
 "episodes":[{"title":"","hook":"one line"}],
 "guests":[{"name":"a person from the evidence","why":""}],
 "intro_music":{"artist":"from the evidence","why":""},
 "references":[{"title":"a podcast from the evidence","take":"what to borrow"}],
 "audience":{"who":"from the skew","note":""},
 "travels_next":["cities from the evidence"],
 "avoid":["from the flavours the city cares less about"]}
Give 5 episodes, 2-4 guests, 2-3 references. Leave guests empty if the evidence has no people.`,
  evidence: digest,
  fallback(ev) {
    const lane = ev.lanes?.[0];
    return { titles: [], lane: lane ? { flavour: lane.flavour, why: "" } : undefined, premise: "", format: "interview", episodes: [], guests: (ev.what_the_city_favours?.person?.only_here ?? []).slice(0, 3).map((name) => ({ name, why: "" })), intro_music: ev.artists?.[0] ? { artist: ev.artists[0].name, why: ev.artists[0].why } : undefined, references: (ev.what_the_city_favours?.podcast?.only_here ?? []).slice(0, 3).map((title) => ({ title, take: "" })), audience: undefined, travels_next: ev.cities_that_lean_the_same_way ?? [], avoid: ev.flavours_the_city_cares_less_about ?? [], fallback: true };
  },
};
