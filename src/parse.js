// Turning a sentence into a run input, and finding what Qloo makes of it
// before anything runs. Two paths: the model when it is there, plain rules
// when it is not. Both end at the same confirm step.
import { loveOptions, pickCity, pickTags, toCity, marketFor } from "./engine/resolve.js";
import { CANDIDATE_CITIES, closestKnownCity } from "./cities.js";
import { FORMAT_HINTS, FORMAT_IDS, formatFrom } from "./formats.js";
import { languageFrom, languagesFor, WRITE_LANGUAGES, writeLanguage } from "./languages.js";
import { chatJson, llmAvailable } from "./llm.js";
import { qlooSearch, qlooTool } from "./qloo.js";

export const BUDGETS = ["shoestring", "indie", "premium"];
/** "on a shoestring", "no budget", "big budget": the budget the sentence implies, if any. */
export function budgetFrom(text) {
  const t = String(text ?? "").toLowerCase();
  if (/\b(shoestring|no[- ]budget|zero[- ]budget|low[- ]budget|micro[- ]budget|tiny budget|tight budget|self[- ]funded)\b/.test(t)) return "shoestring";
  // Only a stated budget counts: "an indie game" or "a premium drop" names a kind of thing, not money.
  if (/\b(big[- ]budget|high[- ]budget|large budget|studio budget|premium budget|premium production)\b/.test(t)) return "premium";
  if (/\b(indie budget|mid[- ]budget|modest budget|small budget)\b/.test(t)) return "indie";
  return undefined;
}
const ENTITY_TYPES = ["artist", "tv_show", "movie", "person", "brand", "videogame", "podcast", "book"];
const GENRES = ["crime", "romance", "romantic", "comedy", "horror", "thriller", "drama", "action", "fantasy", "sci-fi", "science fiction", "documentary", "animation", "mystery", "nightlife", "food", "street food", "travel", "fitness", "dance", "music", "hip hop", "k-pop", "kpop", "anime", "gaming", "sports", "cricket", "football", "wedding", "festival", "family", "kids", "history", "mythology", "devotional", "political", "war", "heist", "gangster", "courtroom", "revenge", "superhero", "coming of age", "college", "office", "tech", "startup", "cars", "bikes", "nature", "wildlife", "beach", "monsoon", "satire", "true crime", "biopic", "musical", "rom-com", "noir", "western", "spy", "survival", "zombie", "streetwear", "luxury", "vintage", "minimal"];
const NOT_A_CITY = new Set(["cafe", "café", "cafes", "home", "office", "school", "college", "studio", "shop", "store", "mall", "city", "town", "village", "india", "bed", "car", "bus", "train", "street", "park", "club", "bar", "pub", "hotel", "room", "house", "kitchen", "garden", "beach", "mountains", "hills", "love", "life", "general", "public", "this", "that", "there", "here", "it", "them", "future", "past", "time", "night", "morning", "evening", "cinema", "theatre", "theater", "market", "gym", "hospital", "temple", "church", "mosque"]);
const STOP = new Set(["for", "about", "with", "after", "inspired", "before", "during", "featuring", "starring", "like", "set", "by", "and", "the", "theme", "will", "would", "that", "which", "it", "is", "to", "a", "an", "my", "our", "on", "of", "be", "where", "there", "here", "in", "at", "near", "but", "or", "so", "next", "this", "these", "those", "shot", "filmed", "when", "while", "because", "since", "until", "from", "around", "every", "each"]);
// Words that end a city mid-phrase: "in Mumbai nightlife crowd" is Mumbai. "Beach" stays (Miami Beach), and
// "City" stays (Kansas City).
const SCENE = new Set(["crowd", "crowds", "scene", "fans", "audience", "audiences", "vibe", "vibes", "people", "youth", "kids", "style"]);
const CITY_NAMES = new Set(Object.values(CANDIDATE_CITIES).flat().map((n) => n.toLowerCase()));

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
// First letter of each word up; a shouted word ("HYDERABAD") comes down first. Short ones (NYC, LA) stay.
const title = (s) => clean(s).split(" ").map((w) => (w.length > 3 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)).join(" ").replace(/(^|\s)(\p{Ll})/gu, (_, a, c) => a + c.toUpperCase());
const WORD = "[\\p{L}][\\p{L}\\p{M}\\w.'’-]*";

/** The city a sentence names: after "in" first ("at Charminar in Hyderabad" is Hyderabad), then "at", "from", "near". */
function cityFrom(t) {
  for (const preps of ["in", "at|around|from|near"]) {
    // The words are read in a lookahead, so "in Telugu set in Hyderabad" still reaches the second "in".
    for (const m of t.matchAll(new RegExp(`(?<![\\p{L}])(?:${preps})\\s+(?=(${WORD}(?:\\s+${WORD}){0,3}))`, "giu"))) {
      const kept = [];
      for (const w of m[1].split(/\s+/)) {
        const bare = w.replace(/[.,;!?]+$/, "");
        const low = bare.toLowerCase();
        if (STOP.has(low) || /^(i|we|you)$/i.test(bare) || /^\d/.test(bare)) break;
        // A genre, language, format or scene word after the first ends it; as the first word it is no city at all.
        if (kept.length && (SCENE.has(low) || (GENRES.includes(low) && low !== "beach") || WRITE_LANGUAGES[title(bare)] || formatFrom(low))) break;
        // "Hyderabad's Old City": the possessive ends the city.
        if (/['’]s$/i.test(bare)) {
          kept.push(bare.replace(/['’]s$/i, ""));
          break;
        }
        kept.push(w);
        // "Las Vegas. Nightlife and food": a sentence ends the city ("St. Louis" does not).
        if (/[,;!?]$/.test(w) || (/\.$/.test(w) && !/^(?:st|ste|mt|ft|[nsew])\.$/i.test(w))) break;
      }
      let city = title(kept.join(" ").replace(/[.,;!?]+$/, ""));
      // "Hyderabad city" is Hyderabad; "Kansas City" and "Mexico City" are cities of their own.
      const bare = city.replace(/\s+city$/i, "");
      if (bare !== city && CITY_NAMES.has(bare.toLowerCase()) && !CITY_NAMES.has(city.toLowerCase())) city = bare;
      // "in a café", "in the office", "in crime", "in Telugu": a format, genre, language or everyday-place word is never a city.
      const word = city.toLowerCase();
      if (!word || GENRES.includes(word) || NOT_A_CITY.has(word) || WRITE_LANGUAGES[city] || FORMAT_HINTS.some(([, re]) => re.test(word))) continue;
      return city;
    }
  }
  return "";
}

/** Rules only: format from keywords, city after "in", theme after "about" or a known genre word, loves after "love". */
export function heuristicParse(text) {
  const t = clean(text);
  const format = formatFrom(t) ?? "film";
  const city = cityFrom(t);
  let theme = "";
  const a = t.match(/\b(?:about|theme(?:d)?(?:\s+(?:is|will be|would be|of|around|on))?|genre(?:\s+is)?)\s+([\p{L}][\p{L}\w' -]{2,40}?)(?=[,.;!?]|\s+(?:in|for|with|that|which|set|after|inspired|on)\b|$)/iu);
  if (a) theme = clean(a[1]).toLowerCase().replace(/^(?:a|an|the|my|our|his|her|their|some)\s+/, "");
  if (!theme) {
    const formatRe = FORMAT_HINTS.find(([id]) => id === format)?.[1];
    const hits = GENRES.filter((g) => new RegExp(`\\b${g.replace(/[-/]/g, "\\$&")}\\b`, "i").test(t)).filter((g) => !formatRe?.test(g));
    // "true crime" over "crime", "street food" over "food": a genre inside a longer one is the same theme.
    theme = hits.filter((g) => !hits.some((h) => h !== g && h.includes(g))).slice(0, 2).join(", ");
  }
  const loves = [];
  const push = (name) => {
    const n = clean(name).replace(/\b(is|are)\b.*$/i, "").replace(/^(the\s+)?(film|movie|show|series|song|album|artist|singer)\s+/i, "").trim();
    if (n.length > 1 && !loves.some((x) => x.name.toLowerCase() === n.toLowerCase())) loves.push({ name: n });
  };
  // "I love Bad Bunny", "fans of Drishyam", "I'm into K-dramas"; never "a love story", never "getting into filmmaking".
  const l = t.match(/\b(?:loves?|fans? of|(?:i'm|i am|we're|we are|really) into|obsessed with)\s+(?!(?:story|stories|song|songs|triangle|affair|letters?|life)\b)([^.!?]{2,80})/i);
  // A love ends where the sentence moves on to the place: "fans of Drishyam in Hyderabad" is Drishyam.
  if (l) for (const part of l[1].replace(/\s+(?:set in|in|at|from|for|near)\s+.*$/i, "").split(/\s*(?:,|\band\b|&)\s*/i)) if (clean(part)) push(title(part));
  // "after HIT: The First Case", "inspired by Drishyam", "in the style of Wong Kar-wai": a reference title, kept as typed.
  const after = t.match(/\b(?:after|inspired by|in the (?:style|vein|spirit) of|à la|a la)\s+([A-Z0-9][^,.!?;]{1,60})/);
  if (after) push(after[1].replace(/\s+(?:on|with|for|in|set|about|at|from)\s+.*$/i, ""));
  // "for Sid Sriram fans"
  const fans = t.match(/\b([A-Z][\w.'&-]*(?:\s+[A-Z][\w.'&-]*){0,3})\s+fans\b/);
  if (fans && !/^(I|We|My|Our|The)$/.test(fans[1])) push(fans[1]);
  return { format, city, country: "", theme, loves: loves.slice(0, 3) };
}

const EXTRACT = `Extract a structured request from a creator's message. Return JSON:
{"format":"one of film|reel|fashion|podcast|game|cafe|event|book|other. film = any movie, short film, series or screen story. reel = short video, reel, TikTok, YouTube short. fashion = clothing, a drop, a label, a garment. podcast = an audio or talk show. game = a video game. cafe = a café, restaurant, bar or menu. event = a live night, gig, party, screening or pop-up. book = a novel, web novel, comic or story collection.",
 "city":"the city name only, in its common English spelling, else \\"\\"",
 "country":"the country if given or clearly implied by the city, else \\"\\"",
 "theme":"the subject or genre in 1-3 plain words (crime, nightlife and food, romance), else \\"\\"",
 "loves":[{"name":"exact well-known title or artist name","type":"one of ${ENTITY_TYPES.join("|")}"}]}
Only real, well-known names in loves. A genre named as a love (K-dramas) is a theme, not a love. Never invent a city.`;

/** Sentence → { format, city, country, theme, loves }. Model first, rules as the fallback. */
export async function extract(text) {
  const rules = heuristicParse(text);
  if (!text || !llmAvailable()) return { ...rules, by: "rules" };
  try {
    const m = await chatJson({ system: EXTRACT, user: text.slice(0, 600), temperature: 0.1, maxTokens: 300 });
    const format = FORMAT_IDS.includes(m.format) ? m.format : rules.format;
    return {
      format,
      city: clean(m.city).slice(0, 80) || rules.city,
      country: clean(m.country).slice(0, 40),
      theme: clean(m.theme).slice(0, 60).toLowerCase() || rules.theme,
      loves: (Array.isArray(m.loves) ? m.loves : []).filter((w) => w?.name).slice(0, 3).map((w) => ({ name: clean(w.name).slice(0, 80), type: ENTITY_TYPES.includes(w.type) ? w.type : undefined })),
      by: "model",
    };
  } catch {
    return { ...rules, by: "rules" };
  }
}

/** Normalise a request body (from the form or a showcase) into a run input. Fills blanks from the sentence. */
export async function parseInput(body) {
  const text = clean(body.text).slice(0, 600);
  const cityIn = typeof body.city === "string" ? { query: body.city } : body.city ?? {};
  const themeIn = typeof body.theme === "string" ? { query: body.theme } : body.theme ?? {};
  const input = {
    text,
    format: FORMAT_IDS.includes(body.format) ? body.format : "",
    city: { query: clean(cityIn.query).slice(0, 80), id: typeof cityIn.id === "string" ? cityIn.id.slice(0, 60) : undefined },
    theme: { query: clean(themeIn.query).slice(0, 60), ids: Array.isArray(themeIn.ids) ? themeIn.ids.filter((x) => typeof x === "string").slice(0, 3) : undefined },
    loves: (Array.isArray(body.loves) ? body.loves : []).slice(0, 3).map((w) => (typeof w === "string" ? { name: clean(w).slice(0, 80) } : { name: clean(w?.name).slice(0, 80), type: ENTITY_TYPES.includes(w?.type) ? w.type : undefined, id: typeof w?.id === "string" && /^[A-Za-z0-9-]{8,60}$/.test(w.id) ? w.id : undefined })).filter((w) => w.name),
    budget: BUDGETS.includes(body.budget) ? body.budget : budgetFrom(body.text),
    // The language the brief is written in; a picker's "English" wins over a sentence that named another.
    language: typeof body.language === "string" ? writeLanguage(body.language) : languageFrom(body.text),
  };
  if (!input.budget) delete input.budget;
  if (!input.language) delete input.language;
  // The sentence fills whatever the request left out. A theme or loves the request carries, even empty ("none"
  // picked for every word, a showcase with no theme), are the maker's choice and stay as sent.
  const themeSent = body.theme != null;
  const lovesSent = Array.isArray(body.loves);
  if (text && (!input.format || !input.city.query || !themeSent || !lovesSent)) {
    const x = await extract(text);
    input.format ||= x.format;
    // A country alone (a model that found no city) is no city.
    if (!input.city.query && x.city) input.city.query = x.country && !x.city.includes(",") ? `${x.city}, ${x.country}` : x.city;
    // A theme and a love can come together ("about crime, after HIT"): the theme filters, the love signals.
    if (!themeSent) input.theme.query = x.theme;
    if (!lovesSent) input.loves = x.loves ?? [];
    input.parsedBy = x.by;
  }
  input.format ||= "film";
  if (!input.city.query) throw new Error("Tell AYTO which city this is for.");
  return input;
}

/** What Qloo makes of the input: candidate cities and theme tags, for the confirm step. */
export async function candidates(input) {
  const [cityPart, countryPart] = input.city.query.split(",").map((s) => s.trim());
  const cityEnv = await qlooSearch({ query: cityPart, type: "locality", take: 8 }).catch(() => ({ results: [] }));
  let best = pickCity(cityEnv.results ?? [], cityPart, { wantedId: input.city.id });
  // A typo or an old name: offer the closest known city instead of a dead end.
  let corrected;
  if (!best) {
    const guess = closestKnownCity(cityPart, { market: countryPart && marketFor(countryPart) });
    if (guess) {
      const env = await qlooSearch({ query: guess.name, type: "locality", take: 8 }).catch(() => ({ results: [] }));
      best = pickCity(env.results ?? [], guess.name);
      if (best) corrected = { from: cityPart, to: guess.name };
    }
  }
  // Only localities whose name (or an alias) carries what was typed are offered; a typo never turns into a random city.
  // As a whole word, so "LA" offers no Atlanta and "Delhi" still offers New Delhi.
  const fold = (n) => String(n ?? "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  const word = new RegExp(`(^|[\\s(])${fold(cityPart).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[\\s,)])`);
  const matches = (r) => [r.name, ...(r.properties?.akas ?? []).map((a) => a?.value)].some((n) => word.test(fold(n)));
  const seen = new Set();
  const cities = [best, ...(cityEnv.results ?? []).filter(matches)]
    .filter((r) => r?.entity_id && r?.location && !seen.has(r.entity_id) && seen.add(r.entity_id))
    .slice(0, 5)
    .map((r) => toCity(r, countryPart && marketFor(countryPart)))
    .map((c) => ({ id: c.id, name: c.name, qlooName: c.qlooName, country: c.country, market: c.market, languages: languagesFor(c) }));
  const words = input.theme.query ? input.theme.query.split(/\s*(?:,|\band\b|\/|\+)\s*/i).map((w) => w.trim()).filter(Boolean).slice(0, 3) : [];
  const themes = [];
  for (const word of words) {
    const env = await qlooTool("qloo_find_tags", { query: word, limit: 12 }).catch(() => undefined);
    themes.push({ word, candidates: pickTags(env?.results ?? [], { max: 4 }) });
  }
  // Each love, as Qloo lists it: the pick first, then the other titles that carry the same name (an original
  // and its remake share one), so the maker can choose before anything runs.
  const city = best ? toCity(best, countryPart && marketFor(countryPart)) : undefined;
  const loves = [];
  for (const love of input.loves ?? []) {
    const options = await loveOptions((args) => qlooSearch(args).catch(() => ({ results: [] })), love, city, { format: input.format }).catch(() => []);
    loves.push({ name: love.name, type: love.type, options: options.slice(0, 4).map(({ raw, image, ...o }) => o) });
  }
  return { cities, themes, loves, cityFound: Boolean(best), corrected };
}
