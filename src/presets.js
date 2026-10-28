// Showcase runs on the home page. Prewarmed at boot so judges never wait, and
// recorded as synthetic samples for no-key mode.
import { FORMATS, STAGE_LABELS } from "./formats.js";

export const SHOWCASES = [
  {
    id: "hyderabad-crime-film",
    label: "Crime film · Hyderabad",
    text: "I'm making a crime short film in Hyderabad.",
    format: "film",
    city: { query: "Hyderabad, India" },
    theme: { query: "crime" },
    loves: [],
  },
  {
    id: "vegas-reel",
    label: "Reel · Las Vegas",
    text: "I make reels in Las Vegas. Nightlife and food.",
    format: "reel",
    city: { query: "Las Vegas, United States" },
    theme: { query: "nightlife, food" },
    loves: [],
  },
  {
    id: "tiruppur-kidswear",
    label: "Kidswear · Tiruppur",
    text: "I run a small kidswear unit in Tiruppur. KPop Demon Hunters is everywhere.",
    format: "fashion",
    city: { query: "Tiruppur, India" },
    theme: { query: "" },
    loves: [{ name: "KPop Demon Hunters", type: "movie" }],
  },
];

export const MARKETS = ["India", "United States", "United Kingdom", "Canada", "Brazil", "Mexico", "Spain", "France", "Germany", "Japan", "South Korea", "Indonesia", "Philippines", "Nigeria", "United Arab Emirates", "Australia"];

export const formatList = () => Object.values(FORMATS).map((f) => ({ id: f.id, label: f.label, noun: f.noun, plan: f.plan.map((id) => ({ id, ...STAGE_LABELS[id] })) }));
