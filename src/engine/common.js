// Shared helpers for the engine stages.
import { FORMATS } from "../formats.js";

export const format = (run) => FORMATS[run.input.format] ?? FORMATS.film;

/** "Hyderabad, India": the location string Qloo's signal_location / filter_location accept. */
export const placeLabel = (p) => (p ? `${p.name}, ${p.market ?? p.country ?? ""}`.replace(/, $/, "") : "");

/** The entity ids that stand for "this crowd": what the city favours beyond the country, else the loves. */
export function crowdIds(run, { limit = 5 } = {}) {
  const read = run.stages.read?.output;
  const rows = Object.values(read?.columns ?? {}).flatMap((c) => c.rows ?? []);
  const picked = [...rows.filter((r) => r.onlyHere), ...rows.filter((r) => !r.onlyHere && r.notCountry), ...rows].map((r) => r.id);
  const ids = [...new Set(picked)].slice(0, limit);
  if (ids.length) return ids;
  return (run.stages.resolve?.output?.loves ?? []).map((l) => l.id).filter(Boolean).slice(0, limit);
}

export const themeTagIds = (run) => (run.stages.resolve?.output?.theme?.tags ?? []).map((t) => t.id);
export const lovesIds = (run) => (run.stages.resolve?.output?.loves ?? []).map((l) => l.id).filter(Boolean);
export const thisYear = () => new Date().getFullYear();
