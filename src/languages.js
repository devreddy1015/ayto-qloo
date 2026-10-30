// The language the writer writes in: English by default, the city's own language on request (Telugu for
// Hyderabad). Names from Qloo stay in Latin letters whatever the language, so the check can still trace each one.
import { cityLanguages } from "./engine/resolve.js";

/** Languages a writer can be asked for, with the script and the web font that shows it. */
export const WRITE_LANGUAGES = {
  English: { code: "en", native: "English" },
  Telugu: { code: "te", native: "తెలుగు", script: "Telugu", font: "Noto Sans Telugu" },
  Tamil: { code: "ta", native: "தமிழ்", script: "Tamil", font: "Noto Sans Tamil" },
  Hindi: { code: "hi", native: "हिन्दी", script: "Devanagari", font: "Noto Sans Devanagari" },
  Marathi: { code: "mr", native: "मराठी", script: "Devanagari", font: "Noto Sans Devanagari" },
  Kannada: { code: "kn", native: "ಕನ್ನಡ", script: "Kannada", font: "Noto Sans Kannada" },
  Malayalam: { code: "ml", native: "മലയാളം", script: "Malayalam", font: "Noto Sans Malayalam" },
  Bengali: { code: "bn", native: "বাংলা", script: "Bengali", font: "Noto Sans Bengali" },
  Gujarati: { code: "gu", native: "ગુજરાતી", script: "Gujarati", font: "Noto Sans Gujarati" },
  Punjabi: { code: "pa", native: "ਪੰਜਾਬੀ", script: "Gurmukhi", font: "Noto Sans Gurmukhi" },
  Odia: { code: "or", native: "ଓଡ଼ିଆ", script: "Odia", font: "Noto Sans Oriya" },
  Spanish: { code: "es", native: "Español" },
  French: { code: "fr", native: "Français" },
  Portuguese: { code: "pt", native: "Português" },
  German: { code: "de", native: "Deutsch" },
  Italian: { code: "it", native: "Italiano" },
  Indonesian: { code: "id", native: "Bahasa Indonesia" },
  Turkish: { code: "tr", native: "Türkçe" },
  Japanese: { code: "ja", native: "日本語", script: "Japanese" },
  Korean: { code: "ko", native: "한국어", script: "Hangul" },
};

/** A supported language from anything typed ("telugu"); English and unknown names are no language at all. */
export function writeLanguage(value) {
  const name = Object.keys(WRITE_LANGUAGES).find((n) => n.toLowerCase() === String(value ?? "").trim().toLowerCase());
  return name && name !== "English" ? name : undefined;
}

/** "…in Hyderabad, in Telugu": the language a sentence asks for. "A Telugu film" names the film's language, not the brief's. */
export function languageFrom(text) {
  const m = String(text ?? "").match(new RegExp(`\\b(?:in|written in|write it in)\\s+(${Object.keys(WRITE_LANGUAGES).join("|")})\\b`, "i"));
  return writeLanguage(m?.[1]);
}

/** What a city is offered: English, then its own languages a writer can use. */
export function languagesFor(city) {
  const names = ["English", ...cityLanguages(city).filter((l) => l !== "English" && WRITE_LANGUAGES[l])];
  return names.map((name) => ({ name, native: WRITE_LANGUAGES[name].native, code: WRITE_LANGUAGES[name].code, font: WRITE_LANGUAGES[name].font }));
}

/** The writer's language instruction; empty for English, so English prompts (and their cache keys) never change. */
export function languageRule(language) {
  const name = writeLanguage(language);
  if (!name) return "";
  const { script } = WRITE_LANGUAGES[name];
  return `Language: write every sentence of free text in ${name}${script ? `, in ${script} script` : ""}, the way people who make things in this city write a working brief: natural and spoken, with the English words they really use (shot, beat, reel, drop) left as they are. This replaces "English" in the rules above.
- Every name from the evidence (titles, people, artists, places, neighbourhoods, cities, brands, flavour tags) stays exactly as the evidence spells it, in Latin letters, so it can be checked.
- ${script ? `Titles you invent: ${script} script first, then the Latin spelling in brackets. ` : ""}Character names: Latin letters, so the beats and the cast line up.
- JSON keys, numbers, hex colours, hashtags and the fixed words a field lists (score, montage, needle drop) stay in English.`;
}
