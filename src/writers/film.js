import { RULES, digest } from "./shared.js";

export const film = {
  id: "film",
  thought: "Writing the film into the gap…",
  system: `You are a story developer. A filmmaker is making a film in a city. Qloo's taste evidence tells you what that city's audience favours beyond the rest of the country, which flavours it leans to, and which lanes are loved but under-served (high demand, little recent supply). Write a film into lane 1.
${RULES}
Return JSON:
{"titles":["three title options"],
 "lane":{"flavour":"lane 1 flavour name exactly as in the evidence","why":"one sentence citing the city rank vs country rank and the recent supply count"},
 "logline":"one sentence",
 "theme":"one sentence on what it is really about",
 "synopsis":{"act1":"2-3 sentences","act2":"2-3 sentences","act3":"2-3 sentences"},
 "characters":[{"role":"","note":"one line"}],
 "references":[{"title":"from the evidence","take":"what to borrow from it"}],
 "cast_ideas":[{"name":"a person from the evidence (people this city favours beyond the country)","role":"which character","why":"one line"}],
 "soundtrack":[{"artist":"from the evidence","use":"score|title track|montage|end credits"}],
 "audience":{"who":"from the audience skew","note":"one sentence"},
 "travels_next":["cities from the evidence that lean the same way"],
 "avoid":["2-3 things the evidence argues against, from the flavours the city cares less about"]}
Give 3 titles, 2-4 characters, 3-5 references, 2-4 cast ideas (only people from the evidence; leave empty if there are none), 2-4 soundtrack artists.`,
  evidence: digest,
  fallback(ev) {
    const lane = ev.lanes?.[0];
    return {
      titles: [],
      lane: lane ? { flavour: lane.flavour, why: `${ev.city} ranks it #${lane.city_rank}; ${ev.country} ${typeof lane.country_rank === "number" ? `ranks it #${lane.country_rank}` : "doesn't rank it in its top 30"}.` } : undefined,
      logline: "",
      theme: "",
      synopsis: { act1: "", act2: "", act3: "" },
      characters: [],
      references: ["movie", "tv_show"].flatMap((t) => ev.what_the_city_favours?.[t]?.only_here ?? []).slice(0, 4).map((title) => ({ title, take: "" })),
      cast_ideas: (ev.what_the_city_favours?.person?.only_here ?? []).slice(0, 3).map((name) => ({ name, role: "", why: `${ev.city} favours them beyond ${ev.country}.` })),
      soundtrack: (ev.artists ?? []).slice(0, 3).map((a) => ({ artist: a.name, use: "score" })),
      audience: ev.audience ? { who: ev.audience.leans?.join(" and ") ?? "", note: "" } : undefined,
      travels_next: ev.cities_that_lean_the_same_way ?? [],
      avoid: ev.flavours_the_city_cares_less_about ?? [],
      fallback: true,
    };
  },
};
