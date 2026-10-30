import { RULES, digest } from "./shared.js";

const BUDGET_NOTES = {
  shoestring: "Shoestring: one camera, available light and practical lamps, public or free locations, shoot venues before they open; anything priced 3-4 of 4 is a place to ask for a quiet hour, not to hire.",
  indie: "Indie: a small crew, one or two hired locations, a modest lighting kit; hire the cheaper places, ask the rest for a quiet hour.",
  premium: "Premium: a full crew and lighting package; any listed place can be hired.",
};

export const film = {
  id: "film",
  thought: "Writing the film into the gap…",
  maxTokens: 4800,
  system: `You are a story developer and line producer. A filmmaker is making a film in a city. Qloo's taste evidence tells you what that city's audience favours beyond the rest of the country, which flavours it leans to, which lanes are loved but under-served (high demand, little recent supply), the look the city leans to, the places this crowd goes and where they cluster. Write a treatment into lane 1 that the filmmaker can shoot.
${RULES}
- Characters are yours to invent (names fitting the city). Every title, person, artist, place and neighbourhood must come from the evidence.
- Respect the budget in the evidence. ${Object.values(BUDGET_NOTES).join(" ")}
Return JSON:
{"titles":["three title options"],
 "lane":{"flavour":"lane 1 flavour name exactly as in the evidence","why":"one sentence citing the city rank vs country rank and the recent supply count"},
 "logline":"one sentence",
 "theme":"one sentence on what it is really about",
 "look":"one or two sentences on the visual style, using only the style words the evidence gives for this city",
 "synopsis":{"act1":"2-3 sentences","act2":"2-3 sentences","act3":"2-3 sentences"},
 "story":"the story, simply: 120-200 words of plain English in the present tense, for someone who has read nothing else here. Who wants what, what stands in the way, how it turns, how it ends. Name only your invented characters and the city; no titles, artists, places or brands",
 "beats":[{"title":"3-5 words","what":"two sentences of what happens on screen","who":["character names"],"after":{"title":"a reference title from the evidence whose staging this beat borrows, or empty"},"where":{"name":"a place name from the evidence, or empty"}}],
 "characters":[{"name":"invented, fits the city","role":"one line: age, job, place in the story","wants":"one line","hides":"one line","look":"one line of wardrobe, concrete and within budget","arc":"where we meet them, where we leave them","archetype":"one of the character archetypes the evidence says this city leans to, or empty"}],
 "references":[{"title":"from the evidence","borrow":"one concrete shot, staging or edit choice to borrow, phrased as an instruction"}],
 "cast_ideas":[{"name":"a person from the evidence's people lists","role":"which character name","why":"one line"}],
 "shoot_base":{"name":"the shoot base or a neighbourhood from the evidence","why":"one line citing how many of the crowd's places sit there"},
 "locations":[{"name":"a place from the evidence","beat":1,"use":"one line: when to shoot there and how, within budget"}],
 "camera":{"lighting":["3-4 concrete lighting instructions within budget"],"shots":["3-5 concrete shot instructions"]},
 "palette":[{"name":"evocative colour name tied to the city or story","hex":"#rrggbb"}],
 "soundtrack":[{"artist":"from the evidence","use":"score|title track|montage|end credits|needle drop","beat":1}],
 "audience":{"who":"from the audience skew","note":"one sentence"},
 "travels_next":["cities from the evidence that lean the same way"],
 "avoid":["2-3 flavour names copied exactly from flavours_the_city_cares_less_about"]}
Give 3 titles, 5-6 beats, 2-4 characters, 3-5 references, 2-4 cast ideas (only people from the evidence; leave empty if there are none), 2-4 locations (only places from the evidence; empty if none), 5-6 palette colours, 2-4 soundtrack artists. Beat numbers start at 1.`,
  evidence: (run) => ({ ...digest(run), budget: run.input.budget ?? "indie (not stated)", budget_note: BUDGET_NOTES[run.input.budget ?? "indie"] }),
  fallback(ev) {
    const lane = ev.lanes?.[0];
    const notes = Object.fromEntries((ev.look?.style_notes_on_its_own_picks ?? []).map((s) => [s.split(":")[0], s.slice(s.indexOf(":") + 1).trim()]));
    const people = ev.what_the_city_favours?.person ?? {};
    const cast = people.only_here?.length ? people.only_here : people.also_strong ?? [];
    const base = ev.shoot_base ?? (ev.neighbourhoods?.[0] ? { name: ev.neighbourhoods[0] } : undefined);
    return {
      titles: [],
      // Built in finish() below from whatever the plan ends up holding, so a model's plan never gets the template's.
      story: "",
      lane: lane ? { flavour: lane.flavour, why: `${ev.city} ranks it #${lane.city_rank}; ${ev.country} ${typeof lane.country_rank === "number" ? `ranks it #${lane.country_rank}` : "doesn't rank it in its top 30"}.` } : undefined,
      logline: "",
      theme: "",
      look: (ev.look?.style_this_city_leans_to ?? []).length ? `Leans ${ev.look.style_this_city_leans_to.slice(0, 4).join(", ")}.` : "",
      synopsis: { act1: "", act2: "", act3: "" },
      beats: [],
      characters: [],
      // Without a model, the only thing to borrow is what Qloo itself says about each title's style.
      references: ["movie", "tv_show"].flatMap((t) => ev.what_the_city_favours?.[t]?.only_here ?? []).slice(0, 4).map((title) => ({ title, borrow: notes[title] ? `Qloo: ${notes[title]}` : "" })),
      cast_ideas: cast.slice(0, 3).map((name) => ({ name, role: "", why: people.only_here?.length ? `${ev.city} favours them beyond ${ev.country}.` : `Among the people this crowd ranks highest.` })),
      shoot_base: base?.name ? { name: base.name, why: base.venues ? `${base.venues} of the ${base.of} places this crowd goes are here.` : "Where this taste runs hottest." } : undefined,
      // The base's own places first, so the template's locations sit in one part of town.
      locations: [...(ev.places_detail ?? []).filter((p) => base?.places?.includes(p.name)), ...(ev.places_detail ?? []).filter((p) => !base?.places?.includes(p.name))].slice(0, 4).map((p) => ({ name: p.name, use: [p.area, p.about && `Qloo: ${p.about}`].filter(Boolean).join(" · ") })),
      camera: { lighting: [], shots: [] },
      palette: [],
      soundtrack: (ev.artists ?? []).slice(0, 3).map((a) => ({ artist: a.name, use: "score" })),
      audience: ev.audience ? { who: ev.audience.leans?.join(" and ") ?? "", note: "" } : undefined,
      travels_next: ev.cities_that_lean_the_same_way ?? [],
      avoid: ev.flavours_the_city_cares_less_about ?? [],
      fallback: true,
    };
  },
  /**
   * The story, simply: the model's own telling; else its logline and three acts in a row; else, with no model, the
   * shape the evidence gives the film (its lane, look and where it would be shot). Never invented.
   */
  finish(plan, ev) {
    if (str(plan.story).trim()) return plan;
    const acts = plan.synopsis && typeof plan.synopsis === "object" ? ["act1", "act2", "act3"].map((k) => str(plan.synopsis[k])) : [str(plan.synopsis)];
    const told = [str(plan.logline), ...acts].map((x) => x.trim()).filter(Boolean).join(" ");
    return { ...plan, story: told || shapeOf(plan, ev) };
  },
};

const str = (v) => (typeof v === "string" ? v : "");

/** What the template knows about the film, told plainly, for a run with no language model. */
function shapeOf(plan, ev) {
  const look = (ev.look?.style_this_city_leans_to ?? []).slice(0, 3).map((x) => x.replace(/\s*\(\+[\d.]+\)$/, ""));
  const places = (plan.locations ?? []).map((l) => str(l?.name)).filter(Boolean).slice(0, 3);
  const base = str(plan.shoot_base?.name);
  return [
    "No language model wrote this one, so there is no story yet, only the shape the evidence gives it.",
    plan.lane?.flavour && `It is a ${String(plan.lane.flavour).toLowerCase()} film${ev.city ? ` for ${ev.city}` : ""}. ${str(plan.lane.why)}`.trim(),
    look.length && `The look leans ${look.join(", ")}.`,
    (base || places.length) && `It would be shot ${base ? `around ${base}` : "in the city"}${places.length ? `, at ${places.join(", ")}` : ""}.`,
    "Add a language model key and this becomes the story in plain words: who wants what, what stands in the way, how it turns, how it ends.",
  ].filter(Boolean).join(" ");
}
