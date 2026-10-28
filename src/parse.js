// Turning a sentence into a run input, and finding what Qloo makes of it
// before anything runs. Two paths: the model when it is there, plain rules
// when it is not. Both end at the same confirm step.
import { pickCity, pickTags, toCity, marketFor } from "./engine/resolve.js";
import { FORMAT_HINTS, FORMAT_IDS } from "./formats.js";
import { chatJson, llmAvailable } from "./llm.js";
import { qlooSearch, qlooTool } from "./qloo.js";

const ENTITY_TYPES = ["artist", "tv_show", "movie", "person", "brand", "videogame", "podcast", "book"];
const GENRES = ["crime", "romance", "romantic", "comedy", "horror", "thriller", "drama", "action", "fantasy", "sci-fi", "science fiction", "documentary", "animation", "mystery", "nightlife", "food", "street food", "travel", "fitness", "dance", "music", "hip hop", "k-pop", "kpop", "anime", "gaming", "sports", "cricket", "football", "wedding", "festival", "family", "kids", "history", "mythology", "devotional", "political", "war", "heist", "gangster", "courtroom", "revenge", "superhero", "coming of age", "college", "office", "tech", "startup", "cars", "bikes", "nature", "wildlife", "beach", "monsoon", "comedy", "satire", "true crime", "biopic", "musical", "rom-com", "noir", "western", "spy", "survival", "zombie", "streetwear", "luxury", "vintage", "minimal"];
const STOP = new Set(["for", "about", "with", "and", "the", "theme", "will", "would", "that", "which", "it", "is", "to", "a", "an", "my", "our", "on", "of", "be", "where", "there", "here", "city"]);

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const title = (s) => clean(s).replace(/\b\w/g, (c) => c.toUpperCase());

/** Rules only: format from keywords, city after "in", theme after "about" or a known genre word, loves after "love". */
export function heuristicParse(text) {
  const t = clean(text);
  const format = FORMAT_HINTS.find(([, re]) => re.test(t))?.[0] ?? "film";
  let city = "";
  const m = t.match(/\b(?:in|at|around|from)\s+([A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*){0,3})/);
  if (m) {
    const words = m[1].split(" ");
    const kept = [];
    for (const w of words) {
      if (STOP.has(w.toLowerCase()) || /^(i|we|you)$/i.test(w)) break;
      kept.push(w);
    }
    city = title(kept.join(" ").replace(/[.,;!?]+$/, ""));
  }
  let theme = "";
  const a = t.match(/\b(?:about|theme(?:d)?(?:\s+(?:is|will be|would be|of))?|genre(?:\s+is)?)\s+([a-z][\w' -]{2,40}?)(?=[,.;!?]|\s+(?:in|for|and|with|that|which|set)\b|$)/i);
  if (a) theme = clean(a[1]).toLowerCase();
  if (!theme) {
    const formatRe = FORMAT_HINTS.find(([id]) => id === format)?.[1];
    const hits = GENRES.filter((g) => new RegExp(`\\b${g.replace(/[-/]/g, "\\$&")}\\b`, "i").test(t)).filter((g) => !formatRe?.test(g));
    theme = hits.slice(0, 2).join(", ");
  }
  const loves = [];
  const l = t.match(/\b(?:love|loves|fans? of|into|obsessed with)\s+([^.!?]{2,80})/i);
  if (l) for (const part of l[1].split(/\s*(?:,|\band\b|&)\s*/i)) if (clean(part)) loves.push({ name: title(part.replace(/\b(is|are)\b.*$/i, "")) });
  return { format, city, country: "", theme, loves: loves.slice(0, 3) };
}

const EXTRACT = `Extract a structured request from a creator's message. Return JSON:
{"format":"one of film|reel|fashion|other. film = any movie, short film, series or story. reel = short video, reel, TikTok, YouTube short. fashion = clothing, a drop, a label, a garment.",
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
    loves: (Array.isArray(body.loves) ? body.loves : []).slice(0, 3).map((w) => (typeof w === "string" ? { name: clean(w).slice(0, 80) } : { name: clean(w?.name).slice(0, 80), type: ENTITY_TYPES.includes(w?.type) ? w.type : undefined })).filter((w) => w.name),
  };
  if (text && (!input.format || !input.city.query)) {
    const x = await extract(text);
    input.format ||= x.format;
    if (!input.city.query) input.city.query = x.country && !x.city.includes(",") ? `${x.city}, ${x.country}` : x.city;
    if (!input.theme.query && !input.loves.length) input.theme.query = x.theme;
    if (!input.loves.length && !input.theme.query) input.loves = x.loves;
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
  const best = pickCity(cityEnv.results ?? [], cityPart, { wantedId: input.city.id });
  const seen = new Set();
  const cities = [best, ...(cityEnv.results ?? [])]
    .filter((r) => r?.entity_id && r?.location && !seen.has(r.entity_id) && seen.add(r.entity_id))
    .slice(0, 5)
    .map((r) => toCity(r, countryPart && marketFor(countryPart)))
    .map((c) => ({ id: c.id, name: c.name, qlooName: c.qlooName, country: c.country, market: c.market }));
  const words = input.theme.query ? input.theme.query.split(/\s*(?:,|\band\b|\/|\+)\s*/i).map((w) => w.trim()).filter(Boolean).slice(0, 3) : [];
  const themes = [];
  for (const word of words) {
    const env = await qlooTool("qloo_find_tags", { query: word, limit: 12 }).catch(() => undefined);
    themes.push({ word, candidates: pickTags(env?.results ?? [], { max: 4 }) });
  }
  return { cities, themes, cityFound: Boolean(best) };
}
