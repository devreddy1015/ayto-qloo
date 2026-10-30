// Showcase runs on the home page. Prewarmed at boot so judges never wait, and
// recorded as synthetic samples for no-key mode.
import { FORMATS, STAGE_LABELS } from "./formats.js";

export const SHOWCASES = [
  {
    id: "london-crime-film",
    label: "Crime film · London",
    text: "I'm making a crime short film in London.",
    format: "film",
    city: { query: "London, United Kingdom" },
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
    id: "paris-streetwear",
    label: "Streetwear drop · Paris",
    text: "I'm making a streetwear drop in Paris.",
    format: "fashion",
    city: { query: "Paris, France" },
    theme: { query: "" },
    loves: [],
  },
];

export const MARKETS = ["United States", "United Kingdom", "France", "Germany", "Spain", "Canada", "Australia", "Japan", "South Korea", "Brazil", "Mexico", "India", "Indonesia", "Philippines", "Nigeria", "United Arab Emirates"];

export const formatList = () => Object.values(FORMATS).map((f) => ({ id: f.id, label: f.label, noun: f.noun, plan: f.plan.map((id) => ({ id, ...STAGE_LABELS[id] })) }));
