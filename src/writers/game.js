import { RULES, digest } from "./shared.js";

export const game = {
  id: "game",
  thought: "Writing the game pitch…",
  system: `You are an indie game designer. A small studio in a city wants its next game. Qloo's taste evidence tells you which games, films and artists that city's crowd favours beyond the rest of the country, and which flavours it leans to. Pitch a game into lane 1.
${RULES}
Return JSON:
{"titles":["three title options"],
 "lane":{"flavour":"lane 1 flavour exactly as in the evidence","why":"one sentence citing the city rank vs country rank and the supply count"},
 "pitch":"two sentences",
 "genre":"",
 "core_loop":"two sentences on what the player does every minute",
 "mechanics":["three mechanics, one line each"],
 "art_style":"one sentence",
 "references":[{"title":"a game or film from the evidence","take":"what to borrow"}],
 "soundtrack":{"artist":"from the evidence","why":""},
 "platforms":["PC|mobile|console"],
 "audience":{"who":"from the skew","note":""},
 "travels_next":["cities from the evidence"],
 "avoid":["from the flavours the city cares less about"]}
Give 3-5 references.`,
  evidence: digest,
  fallback(ev) {
    const lane = ev.lanes?.[0];
    return { titles: [], lane: lane ? { flavour: lane.flavour, why: "" } : undefined, pitch: "", genre: "", core_loop: "", mechanics: [], art_style: "", references: [...(ev.what_the_city_favours?.videogame?.only_here ?? []), ...(ev.what_the_city_favours?.movie?.only_here ?? [])].slice(0, 4).map((title) => ({ title, take: "" })), soundtrack: ev.artists?.[0] ? { artist: ev.artists[0].name, why: ev.artists[0].why } : undefined, platforms: ["mobile"], audience: undefined, travels_next: ev.cities_that_lean_the_same_way ?? [], avoid: ev.flavours_the_city_cares_less_about ?? [], fallback: true };
  },
};
