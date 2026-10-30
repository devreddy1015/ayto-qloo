// What AYTO can write, and which Qloo reads each format needs.
// `types`: the Qloo entity types the three-column read runs on.
// `supply`: types that carry a release year, so the gap can count recent supply.
// `plan`: the pipeline stages, in order. The runner follows this list.
export const FORMATS = {
  film: {
    id: "film",
    label: "Short film / feature",
    noun: "film",
    types: ["movie", "tv_show", "person"],
    supply: ["movie", "tv_show"],
    audio: true,
    spots: true,
    travels: true,
    plan: ["resolve", "read", "gap", "look", "audio", "spots", "audience", "travels", "write", "check", "diff", "share"],
  },
  reel: {
    id: "reel",
    label: "Reel / short video",
    noun: "reel",
    types: ["artist", "movie", "tv_show", "place"],
    supply: [],
    audio: true,
    spots: true,
    travels: false,
    plan: ["resolve", "read", "gap", "audio", "spots", "audience", "write", "check", "diff", "share"],
  },
  fashion: {
    id: "fashion",
    label: "Fashion drop",
    noun: "drop",
    types: ["brand", "artist"],
    supply: [],
    audio: true,
    spots: true,
    travels: true,
    plan: ["resolve", "read", "gap", "look", "audio", "spots", "audience", "travels", "write", "check", "produce", "diff", "share"],
  },
  podcast: {
    id: "podcast",
    label: "Podcast",
    noun: "podcast",
    types: ["podcast", "person", "artist"],
    supply: ["podcast"],
    audio: true,
    spots: false,
    travels: true,
    plan: ["resolve", "read", "gap", "audio", "audience", "travels", "write", "check", "diff", "share"],
  },
  game: {
    id: "game",
    label: "Indie game",
    noun: "game",
    types: ["videogame", "movie", "artist"],
    supply: ["videogame"],
    audio: true,
    spots: false,
    travels: true,
    plan: ["resolve", "read", "gap", "audio", "audience", "travels", "write", "check", "diff", "share"],
  },
  cafe: {
    id: "cafe",
    label: "Café / menu",
    noun: "café",
    types: ["place", "artist", "brand"],
    supply: [],
    audio: true,
    spots: true,
    travels: false,
    plan: ["resolve", "read", "gap", "audio", "spots", "audience", "write", "check", "diff", "share"],
  },
  event: {
    id: "event",
    label: "Live event night",
    noun: "night",
    types: ["artist", "place", "movie"],
    supply: [],
    audio: true,
    spots: true,
    travels: false,
    plan: ["resolve", "read", "gap", "audio", "spots", "audience", "write", "check", "diff", "share"],
  },
  book: {
    id: "book",
    label: "Book / web novel",
    noun: "book",
    types: ["book", "movie", "tv_show"],
    supply: ["book"],
    audio: false,
    spots: false,
    travels: true,
    plan: ["resolve", "read", "gap", "audience", "travels", "write", "check", "diff", "share"],
  },
};

export const FORMAT_IDS = Object.keys(FORMATS);

/**
 * Category filters for reads whose entity type is broad. Qloo's "brand" holds museums and
 * nonprofits next to labels, and "place" holds theatres next to cafés; the format says which slice it means.
 * Each entry: the find_tags queries and the name/id pattern a tag must match.
 */
export const CATEGORY_FILTERS = {
  fashion: { brand: { queries: ["clothing brand", "fashion", "streetwear", "footwear"], match: /cloth|apparel|fashion|streetwear|footwear|sneaker|shoe|luxury|sportswear|athleisure|denim|accessor|jewel|handbag/i } },
  cafe: {
    brand: { queries: ["coffee brand", "food brand", "beverage", "bakery"], match: /coffee|food|beverage|drink|tea|bakery|snack|dairy|chocolate|juice|cafe|café/i },
    place: { queries: ["cafe", "coffee shop", "restaurant", "bakery", "bar"], match: /caf|coffee|restaurant|bakery|dessert|tea|bar\b|pub|bistro|diner|eatery|food/i },
  },
  event: { place: { queries: ["music venue", "bar", "club", "theater", "arena"], match: /venue|bar\b|club|lounge|theat|arena|hall|stage|pub|rooftop|live music/i } },
  reel: { place: { queries: ["bar", "cafe", "park", "nightclub", "landmark"], match: /bar\b|caf|park|club|lounge|landmark|attraction|rooftop|beach|market|street food|restaurant/i } },
};

export const STAGE_LABELS = {
  resolve: { label: "Resolve", output: "City, theme and loves as Qloo knows them" },
  read: { label: "Read the city", output: "What this city loves vs the country" },
  gap: { label: "Find the gap", output: "Loved here, under-served" },
  look: { label: "The look", output: "Style words this city leans to" },
  audio: { label: "Audio", output: "Artists this crowd favours" },
  spots: { label: "Locations", output: "Places this crowd goes, and a shoot base" },
  audience: { label: "Audience", output: "Who shows up, in aggregate" },
  travels: { label: "Where it travels", output: "Cities that lean the same way" },
  write: { label: "Write", output: "The idea, written into the gap" },
  check: { label: "Check", output: "Every name traced to Qloo" },
  produce: { label: "Produce", output: "Tech packs, costing, sizes, city split" },
  diff: { label: "With vs without Qloo", output: "Same question, no evidence" },
  share: { label: "Share", output: "A page to send" },
};

/**
 * The words that name what is being made ("a short film", "a podcast", "a novel"), then words that only suggest it
 * ("a bar", "a party", "comic"). A named format beats a suggested one, and the earlier word wins within each, so
 * "a short film about a bar fight" is a film and "a reel for Telugu cinema fans" is a reel.
 */
const FORMAT_WORDS = {
  named: [
    ["podcast", /\b(podcasts?|audio shows?|talk shows?|audio series)\b/gi],
    ["game", /\b(video ?games?|mobile games?|indie games?|board games?|card games?|games?|gameplay|game studio)\b/gi],
    ["cafe", /(?:\bcaf[eé]s?(?![a-zà-ÿ])|\b(?:coffee shops?|restaurants?|bakery|bakeries|tea house|bistro|cloud kitchen|food truck|eatery|diner|pubs?|brewery)\b)/gi],
    ["event", /\b(events?|concerts?|gigs?|club nights?|festivals?|open mics?|screening nights?|screenings?|movie nights?|film nights?|pop-?ups?|meetups?|comedy nights?|stand-?up (?:show|night|gig)s?|raves?|parties)\b/gi],
    ["book", /\b(books?|novels?|novellas?|web ?novels?|short stor(?:y|ies)|story collections?|graphic novels?|manga|comic books?|zines?)\b/gi],
    ["film", /\b(short films?|feature films?|films?|movies?|screenplays?|web ?series|docu-?series|series|documentar(?:y|ies)|short(?!\s+(?:stor(?:y|ies)|videos?|reels?|clips?|form|films?|documentar(?:y|ies)|podcasts?|novels?)\b)(?![-\w]))/gi],
    ["reel", /\b(reels?|tik ?toks?|short videos?|youtube shorts?|insta(?:gram)? (?:reels?|videos?)|instagram|vlogs?|ig videos?|youtube videos?)\b/gi],
    ["fashion", /\b(clothing|clothes|apparel|fashion|streetwear|kidswear|menswear|womenswear|drops?|capsule|collections?|tees?|t-shirts?|hoodies?|sweatshirts?|garments?|labels?|footwear|sneakers?|sarees?|kurtas?|jackets?|merch)\b/gi],
  ],
  suggested: [
    ["podcast", /\b(episodes?|audio)\b/gi],
    ["cafe", /\b(bars?|menu|kitchen|coffee)\b/gi],
    ["event", /\b(party|gathering)\b/gi],
    ["book", /\b(comics?)\b/gi],
    ["film", /\b(cinema|screen story|ott)\b/gi],
    ["reel", /\b(shorts|videos?|content)\b/gi],
    ["fashion", /\b(wear|outfits?|shorts)\b/gi],
  ],
};

// Words that end a noun phrase: "a podcast about films" is a podcast, "a film festival" is a festival.
const PHRASE_BREAK = /[,.;:!?()]|\b(?:about|for|with|on|in|at|from|set|inspired|after|of|to|by|and|or|that|which|where|like|a|an|the|my|our|is|are|was)\b/i;

/**
 * The format a sentence names, else the one it suggests, else undefined. Within the first noun phrase the last
 * format word is the thing being made: "a film festival" is an event, "a book café" a café, "a fashion film" a film.
 */
export function formatFrom(text) {
  const t = String(text ?? "");
  for (const tier of ["named", "suggested"]) {
    const hits = FORMAT_WORDS[tier].flatMap(([id, re]) => [...t.matchAll(re)].map((m) => ({ id, at: m.index, end: m.index + m[0].length })));
    hits.sort((a, b) => a.at - b.at || b.end - a.end);
    if (!hits.length) continue;
    let head = hits[0];
    for (const next of hits.filter((h) => h.at >= head.end)) {
      const gap = t.slice(head.end, next.at);
      // At most two plain words between them ("movie-themed", "book launch"), none that starts a new phrase.
      if (PHRASE_BREAK.test(gap) || gap.trim().split(/[\s-]+/).filter(Boolean).length > 2) break;
      head = next;
    }
    return head.id;
  }
  return undefined;
}

/** Words in free text that mark a format (used to keep them out of city and theme readings). */
export const FORMAT_HINTS = [
  ["podcast", /\b(podcasts?|audio show|talk show|episodes?)\b/i],
  ["game", /\b(video ?games?|indie games?|mobile games?|game studio|gameplay)\b/i],
  ["cafe", /(?:\bcaf[eé]s?(?![a-z\u00e0-\u00ff])|\b(?:coffee shop|restaurant|menu|bakery|tea house|bar|bistro|cloud kitchen|food truck)\b)/i],
  ["event", /\b(events?|concert|gig|club night|party|festival|open mic|screening night|pop-?up)\b/i],
  ["book", /\b(books?|novel|web novel|webnovel|story collection|comic|manga|graphic novel)\b/i],
  ["film", /\b(short film|feature film|film|movie|cinema|screenplay|web ?series|series|documentary)\b/i],
  ["reel", /\b(reels?|tiktok|short video|youtube shorts?|shorts?(?!\s+film)|instagram|ig video)\b/i],
  ["fashion", /\b(clothing|clothes|apparel|fashion|streetwear|kidswear|wear|drop|tee|t-shirt|hoodie|garment|label|footwear|sneaker)\b/i],
];
