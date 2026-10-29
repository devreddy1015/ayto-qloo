// What every writer gets: a compact digest of the evidence, never raw Qloo, and
// the rules every prompt carries.
export const RULES = `Rules you must follow:
- Use only the titles, artists, places, brands, cities and flavour tags that appear in the evidence. Never invent a title, person, place, statistic or sales figure. If you need a name that is not in the evidence, leave the field empty.
- Qloo describes aggregate taste affinity across large groups, not individuals and not sales. Say "this city leans", "signal", "affinity". Never "will be a hit", "viral", "guaranteed", "will sell".
- Write for the person making the thing. Plain, concrete, confident English. No hype words, no exclamation marks.
- Return only the JSON object requested.`;

const names = (rows = [], n = 8) => rows.slice(0, n).map((r) => r.name);

/** The digest shared by every format. */
export function digest(run) {
  const r = run.stages.resolve?.output ?? {};
  const read = run.stages.read?.output?.columns ?? {};
  const g = run.stages.gap?.output;
  const a = run.stages.audio?.output;
  const s = run.stages.spots?.output;
  const d = run.stages.audience?.output;
  const t = run.stages.travels?.output;
  return {
    making: run.input.format,
    city: r.city?.name,
    country: r.city?.market ?? r.city?.country,
    contrast_city: r.contrast?.name,
    theme: (r.theme?.tags ?? []).map((x) => x.name),
    loves: (r.loves ?? []).map((x) => x.name),
    what_the_city_favours: Object.fromEntries(
      Object.entries(read).map(([type, c]) => [
        type,
        {
          only_here: names(c.rows.filter((x) => x.onlyHere)),
          hidden_gems: names(c.rows.filter((x) => x.hiddenGem), 4),
          also_strong: names(c.rows.filter((x) => !x.onlyHere && !x.hiddenGem), 5),
          the_country_prefers_instead: (c.countryNames ?? []).filter((n) => !c.rows.some((x) => x.name === n)).slice(0, 5),
          contrast_city_prefers_instead: (c.contrastNames ?? []).filter((n) => !c.rows.some((x) => x.name === n)).slice(0, 5),
        },
      ]),
    ),
    lanes: (g?.lanes ?? []).map((l) => ({ flavour: l.name, city_rank: l.cityRank, country_rank: l.countryRank ?? "not in the country's top 30", scope: l.scope === "this city" ? `specific to ${r.city?.name} (control cities do not share it)` : l.scope === "leans here" ? "leans here more than comparable cities" : l.scope === "most cities" ? "shared by most big cities in the country" : undefined, recent_supply: l.supplyRead ? { count: l.supplyCount, titles: l.supplyTitles.map((x) => (x.year ? `${x.name} (${x.year})` : x.name)) } : "not read", gap: l.gap })),
    look: lookDigest(run.stages.look?.output),
    flavours_the_city_leans_to: (g?.flavours ?? []).slice(0, 10).map((x) => x.name),
    flavours_the_city_cares_less_about: (g?.avoid ?? []).map((x) => x.name),
    artists: (a?.shortlist ?? []).map((x) => ({ name: x.name, why: x.why })),
    places: (s?.venues ?? []).map((x) => x.name),
    places_detail: (s?.venues ?? []).map((x) => ({ name: x.name, area: x.area, about: x.about, price_level: x.price ? `${x.price} of 4` : undefined })),
    neighbourhoods: (s?.neighbourhoods ?? []).map((x) => x.name),
    shoot_base: s?.base ? { name: s.base.name, venues: s.base.venues, of: s.base.of, places: s.base.places } : undefined,
    audience: d?.skew ? { leans: d.leans, gender: d.gender } : undefined,
    cities_that_lean_the_same_way: (t?.cities ?? []).filter((c) => !c.home).slice(0, 5).map((c) => c.name),
  };
}

/** The look stage, compact: only the words, with their lifts, so the writer cannot invent a style. */
function lookDigest(l) {
  if (!l) return undefined;
  const w = (list = [], n = 6) => list.slice(0, n).map((x) => (typeof x.lift === "number" ? `${x.name} (+${x.lift})` : x.name));
  if (l.kind === "fashion") {
    return {
      aesthetics_this_city_leans_to: w(l.aesthetics),
      personal_styles: w(l.personalStyles),
      materials_more_than_the_country: w(l.materials?.over),
      materials_less_than_the_country: w(l.materials?.under),
      age_groups: w(l.ages?.over, 3),
      segments: w(l.segments?.over, 4),
      aesthetics_the_country_prefers_instead: w(l.avoid),
      motifs_from_the_loves: (l.motifs ?? []).slice(0, 8).map((m) => `${m.name} (from ${m.from})`),
      labels_this_city_favours: (l.labels ?? []).slice(0, 6).map((x) => x.name),
      note: l.note,
    };
  }
  return { style_this_city_leans_to: w(l.styles), style_it_cares_less_about: w(l.avoid, 4), character_archetypes_it_leans_to: w(l.archetypes, 5), themes_it_leans_to: w(l.themes, 5), style_notes_on_its_own_picks: (l.descriptions ?? []).map((d) => `${d.title}: ${d.text}`) };
}

/** Names that the check stage must find in the Qloo evidence, per writer. Paths walk the written plan. */
export const GROUND = {
  film: [
    ["plan.references[].title", "title"],
    ["plan.beats[].after.title", "title"],
    ["plan.beats[].where.name", "place"],
    ["plan.cast_ideas[].name", "person"],
    ["plan.soundtrack[].artist", "artist"],
    ["plan.locations[].name", "place"],
    ["plan.shoot_base.name", "neighbourhood"],
    ["plan.travels_next[]", "city"],
    ["plan.lane.flavour", "tag"],
  ],
  reel: [
    ["plan.audio.artist", "artist"],
    ["plan.spots[].name", "place"],
    ["plan.references[]", "title"],
  ],
  fashion: [
    ["plan.brands_to_study[]", "brand"],
    ["plan.first_cities[]", "city"],
    ["plan.styles[].from_tags[]", "tag"],
    ["plan.palette[].from_tags[]", "tag"],
    ["plan.soundtrack[]", "artist"],
  ],
  podcast: [
    ["plan.guests[].name", "person"],
    ["plan.intro_music.artist", "artist"],
    ["plan.references[].title", "title"],
    ["plan.travels_next[]", "city"],
    ["plan.lane.flavour", "tag"],
  ],
  game: [
    ["plan.references[].title", "title"],
    ["plan.soundtrack.artist", "artist"],
    ["plan.travels_next[]", "city"],
    ["plan.lane.flavour", "tag"],
  ],
  cafe: [
    ["plan.playlist[].artist", "artist"],
    ["plan.neighbourhood.name", "neighbourhood"],
    ["plan.study_these[]", "place"],
    ["plan.brands_to_stock[]", "brand"],
    ["plan.lane.flavour", "tag"],
  ],
  event: [
    ["plan.lineup[].artist", "artist"],
    ["plan.venue.name", "place"],
    ["plan.screening_or_theme[]", "title"],
    ["plan.lane.flavour", "tag"],
  ],
  book: [
    ["plan.comps[].title", "title"],
    ["plan.travels_next[]", "city"],
    ["plan.lane.flavour", "tag"],
  ],
};
