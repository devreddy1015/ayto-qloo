// What AYTO can write, and which Qloo reads each format needs.
// `types`: the Qloo entity types the three-column read runs on.
// `supply`: types that carry a release year, so the gap can count recent supply.
// `plan`: the pipeline stages, in order. The runner follows this list.
export const FORMATS = {
  film: {
    id: "film",
    label: "Short film / feature",
    noun: "film",
    types: ["movie", "tv_show"],
    supply: ["movie", "tv_show"],
    audio: true,
    spots: false,
    travels: true,
    plan: ["resolve", "read", "gap", "audio", "audience", "travels", "write", "check", "diff", "share"],
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
    plan: ["resolve", "read", "gap", "audio", "spots", "audience", "travels", "write", "check", "diff", "share"],
  },
};

export const FORMAT_IDS = Object.keys(FORMATS);

export const STAGE_LABELS = {
  resolve: { label: "Resolve", output: "City, theme and loves as Qloo knows them" },
  read: { label: "Read the city", output: "What this city loves vs the country" },
  gap: { label: "Find the gap", output: "Loved here, under-served" },
  audio: { label: "Audio", output: "Artists this crowd favours" },
  spots: { label: "Spots", output: "Places this crowd goes" },
  audience: { label: "Audience", output: "Who shows up, in aggregate" },
  travels: { label: "Where it travels", output: "Cities that lean the same way" },
  write: { label: "Write", output: "The idea, written into the gap" },
  check: { label: "Check", output: "Every name traced to Qloo" },
  diff: { label: "With vs without Qloo", output: "Same question, no evidence" },
  share: { label: "Share", output: "A page to send" },
};

/** Words in free text that pick a format when the model is not around. */
export const FORMAT_HINTS = [
  ["reel", /\b(reels?|shorts?|tiktok|short video|youtube short|instagram)\b/i],
  ["film", /\b(film|movie|cinema|feature|screenplay|short film|web ?series|series|show)\b/i],
  ["fashion", /\b(clothing|clothes|apparel|fashion|streetwear|kidswear|wear|drop|tee|t-shirt|hoodie|garment|label|footwear|sneaker)\b/i],
];
