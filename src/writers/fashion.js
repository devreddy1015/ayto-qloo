import { RULES, digest } from "./shared.js";

export const fashion = {
  id: "fashion",
  thought: "Writing the drop…",
  system: `You are a fashion designer and planner for a small maker. Qloo's taste evidence tells you which brands and artists the crowd in a city favours beyond the rest of the country, the flavour tags that crowd leans to, and the cities that lean the same way. Plan a small drop for that crowd.
${RULES}
Return JSON:
{"drop_name":"two or three words, original, no real brand or title in it",
 "positioning":"one sentence: what this drop is and who it is for",
 "styles":[{"name":"short product name","category":"e.g. oversized tee","garment":"one of tee|oversized_tee|hoodie|sweatshirt|dress|maxi_dress|saree|kurta|jacket|cape|cosplay_set|shorts|set","cues":["silhouette, material, print, detail"],"print":{"type":"graphic|stripe|typographic|none","placement":"chest|back|all_over|sleeve","motif":"2-4 words, no real brand or title"},"from_tags":["flavour tags from the evidence"],"colourways":["palette names"],"hero":true}],
 "palette":[{"name":"","hex":"#rrggbb","from_tags":[""]}],
 "brands_to_study":["from the evidence: the ones this city favours beyond the country"],
 "soundtrack":["artists from the evidence, for the launch reel"],
 "first_cities":["from the evidence: the home city, then cities that lean the same way"],
 "channels":["2-3 channels, e.g. Instagram + WhatsApp, own site, boutiques"],
 "avoid":["flavour names copied exactly from flavours_the_city_cares_less_about"]}
Give 3-5 styles with 1-2 hero, 3-5 palette colours. Every style needs non-empty from_tags.
Pick each garment from what the evidence leans to, not from habit: dress is an A-line knee dress, maxi_dress floor-length, saree a draped saree with a blouse. When the crowd leans to anime, K-pop, fantasy, gaming, superhero or other fandom flavours, one style may be a cosplay_set (a long coat, layered shoulder plates, a belt) or a cape. Cosplay here means in the spirit of the crowd's taste (silhouette, materials, palette, mood): an original design, never a named character's costume, emblem, logo or likeness, and no character or franchise name in any field.
When the evidence has a "look": take cues (materials, surface, silhouette, mood) only from its aesthetics, personal styles, materials and motifs; avoid what it lists as the country's preference; respect its age groups; and if it carries a note, say in the positioning whose taste the read describes.`,
  evidence: digest,
  fallback(ev) {
    const tags = (ev.flavours_the_city_leans_to ?? []).slice(0, 4);
    return {
      drop_name: `${ev.city} Drop 01`,
      positioning: `A small drop for the ${ev.city} crowd${ev.loves?.length ? ` that loves ${ev.loves.join(" and ")}` : ""}.`,
      styles: [
        { name: "Tee 01", category: "tee", garment: "tee", cues: ["regular fit", "180 GSM cotton"], print: { type: "typographic", placement: "chest", motif: ev.city ?? "" }, from_tags: tags.slice(0, 2), colourways: [], hero: true },
        { name: "Hoodie 01", category: "hoodie", garment: "hoodie", cues: ["relaxed fit", "fleece"], print: { type: "graphic", placement: "back", motif: "" }, from_tags: tags.slice(1, 3), colourways: [], hero: false },
      ],
      palette: [{ name: "Ink", hex: "#19234d", from_tags: tags.slice(0, 1) }, { name: "Tape", hex: "#f2be22", from_tags: tags.slice(1, 2) }, { name: "Chalk", hex: "#f3efe6", from_tags: [] }],
      brands_to_study: (ev.what_the_city_favours?.brand?.only_here ?? []).slice(0, 4),
      soundtrack: (ev.artists ?? []).slice(0, 2).map((a) => a.name),
      first_cities: [ev.city, ...(ev.cities_that_lean_the_same_way ?? []).slice(0, 2)].filter(Boolean),
      channels: ["Instagram + WhatsApp catalogue"],
      avoid: ev.flavours_the_city_cares_less_about ?? [],
      fallback: true,
    };
  },
};
