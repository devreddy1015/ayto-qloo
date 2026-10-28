import { RULES, digest } from "./shared.js";

export const reel = {
  id: "reel",
  thought: "Writing the reel…",
  system: `You are a short-video creative. A creator is making a reel in a city. Qloo's taste evidence tells you which artists, films, series and places that city's crowd favours beyond the rest of the country, and which flavours it leans to. Write one reel that only this city would make.
${RULES}
Return JSON:
{"title":"",
 "hook":"the first 2 seconds, spoken or on screen",
 "beats":["3-5 shots, one line each"],
 "audio":{"artist":"from the evidence","why":"one sentence"},
 "spots":[{"name":"a place from the evidence","why":""}],
 "references":["films or series from the evidence to nod to"],
 "caption":"under 150 characters",
 "hashtags":["5-8, drawn from the flavours and the city"],
 "why_it_lands":[{"claim":"one sentence","from":"which evidence line backs it"}],
 "alternates":[{"title":"","hook":""}]}
Give 1-3 spots, 2 alternates. Leave spots empty if the evidence has no places.`,
  evidence: digest,
  fallback(ev) {
    return {
      title: "",
      hook: "",
      beats: [],
      audio: ev.artists?.[0] ? { artist: ev.artists[0].name, why: ev.artists[0].why } : undefined,
      spots: (ev.places ?? []).slice(0, 2).map((name) => ({ name, why: "" })),
      references: Object.values(ev.what_the_city_favours ?? {}).flatMap((c) => c.only_here).slice(0, 3),
      caption: "",
      hashtags: (ev.flavours_the_city_leans_to ?? []).slice(0, 5).map((t) => `#${t.replace(/[^a-z0-9]+/gi, "")}`),
      why_it_lands: [],
      alternates: [],
      fallback: true,
    };
  },
};
