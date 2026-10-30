// Stage: check. Every named claim the writer made is looked up in the names
// Qloo returned during this run. Unknown names are removed, not corrected.
import { GROUND } from "../writers/index.js";
import { isKnownName } from "./evidence.js";
import { emitEvent } from "./store.js";

/**
 * Visit every name a GROUND path points at, whatever shape the model gave it. "plan.references[].title" means the
 * items of plan.references; the last key only says where a name usually sits, so a reference written as
 * { name }, as a plain string, or with its title as a list is still read. A list given as one value, or as a
 * list of lists, is made a flat list first (the page reads the same shape).
 */
function walk(obj, path, visit) {
  const segs = path.split(".");
  const parts = segs.at(-1).endsWith("[]") ? segs : segs.slice(0, -1);
  const step = (holder, [head, ...rest]) => {
    if (!holder || typeof holder !== "object") return;
    const key = head.replace("[]", "");
    let value = holder[key];
    if (value === undefined || value === null || value === "") return;
    if (head.endsWith("[]")) {
      value = holder[key] = Array.isArray(value) ? value.flat(Infinity) : [value];
      if (rest.length) return value.forEach((item) => step(item, rest));
      return value.forEach((item, i) => visit(item, (replacement) => (value[i] = replacement)));
    }
    if (rest.length) return step(value, rest);
    visit(value, (replacement) => (holder[key] = replacement));
  };
  step(obj, parts);
}

function prune(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i -= 1) {
      const v = node[i];
      if ((typeof v === "string" && v.startsWith("[removed:")) || (v && typeof v === "object" && v.removed)) node.splice(i, 1);
      else prune(v);
    }
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object" && !Array.isArray(v) && v.removed) delete node[k];
      else if (typeof v === "string" && v.startsWith("[removed:")) node[k] = "";
      else prune(v);
    }
  }
}

const NAME_KEYS = ["title", "artist", "name", "city", "flavour", "brand", "place", "venue", "show", "film", "guest", "partner"];
/** The names one written item carries: itself if a string, the strings in a list, or the value under a name key. */
function namesOf(item) {
  if (typeof item === "string") return item.trim() ? [item] : [];
  if (typeof item === "number") return [String(item)];
  if (Array.isArray(item)) return item.flatMap(namesOf);
  if (!item || typeof item !== "object") return [];
  const key = NAME_KEYS.find((k) => item[k] !== undefined && item[k] !== null && item[k] !== "");
  return key ? namesOf(item[key]) : [];
}

const LATIN = /\p{Script=Latin}/u;
/**
 * The spellings of a written name that may be Qloo's: as written; without a trailing "(2022)" (the digest shows
 * years); and, when one side of a bracket is another script, the other side. A brief in Telugu may write "హిట్
 * (HIT)" or "HIT (హిట్)"; "Gangs of Wasseypur — తెలుగు (HIT)" is neither, so it is checked whole.
 */
function spellings(name) {
  const s = String(name).trim();
  const out = [s];
  const plain = s.replace(/\s*\((?:19|20)\d\d\)\s*$/, "").trim();
  if (plain !== s) out.push(plain);
  const m = plain.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) {
    const [outer, inner] = [m[1].trim(), m[2].trim()];
    if (outer && !LATIN.test(outer) && LATIN.test(inner)) out.push(inner);
    if (inner && !LATIN.test(inner) && LATIN.test(outer)) out.push(outer);
  }
  return out;
}

export function checkEvidence(run) {
  const output = run.stages.write?.output;
  const paths = GROUND[output?.writer] ?? [];
  const checked = [];
  let grounded = 0;
  let removed = 0;
  if (output) {
    for (const [path, kind] of paths) {
      walk(output, path, (item, replace) => {
        const names = namesOf(item);
        if (!names.length) return;
        let bad = false;
        for (const name of names) {
          const ok = spellings(name).some((n) => isKnownName(run, n));
          checked.push({ kind, name, ok });
          if (ok) grounded += 1;
          else {
            removed += 1;
            bad = true;
          }
        }
        // An item with any name not in the evidence goes whole: the reference, the cast idea, the lane.
        if (bad) replace(typeof item === "string" ? `[removed: not in Qloo evidence] ${item}` : Array.isArray(item) ? [] : { ...item, removed: true });
      });
    }
    prune(output.plan);
    // A print motif is free text drawn onto a garment: it must never be a real brand, artist or title from the evidence,
    // and the garment must be one the viewer knows.
    const GARMENTS = new Set(["tee", "oversized_tee", "hoodie", "sweatshirt", "dress", "kurta", "jacket", "shorts", "set"]);
    const protectedNames = new Set(Object.values(run.names ?? {}).filter((n) => ["brand", "artist", "love", "movie", "tv_show"].includes(n.kind)).map((n) => String(n.name).toLowerCase()));
    for (const style of output.plan?.styles ?? []) {
      if (!style || typeof style !== "object") continue;
      if (style.garment && !GARMENTS.has(style.garment)) style.garment = undefined;
      const motif = String(style.print?.motif ?? "").toLowerCase().trim();
      if (motif && [...protectedNames].some((n) => n.length > 2 && (motif === n || motif.includes(n)))) {
        checked.push({ kind: "motif", name: style.print.motif, ok: false });
        removed += 1;
        style.print.motif = "";
      }
    }
  }
  const score = checked.length ? Math.round((grounded / checked.length) * 100) : 100;
  return { checked: checked.length, grounded, removed, score, items: checked.filter((c) => !c.ok).slice(0, 30), summary: checked.length ? `${grounded} of ${checked.length} names trace to Qloo. ${removed} removed.` : "Nothing named to check." };
}

/**
 * The check stage: verify, and if the writer invented names and a model is
 * there, write once more with those names banned, then verify again. Both
 * passes are reported so the card can show the correction.
 */
export const check = async (run) => {
  const first = checkEvidence(run);
  const w = run.stages.write?.output;
  if (!first.removed || !w || w.fallback || !w.canWrite || w.rewrites) return first;
  const banned = [...new Set(first.items.map((i) => i.name))];
  emitEvent(run, { type: "thought", stage: "check", text: `${first.removed} name${first.removed === 1 ? "" : "s"} not in the evidence. Asking the writer again with ${banned.length === 1 ? "it" : "them"} banned…` });
  const { writeWith } = await import("./write.js");
  const second = await writeWith(run, { forbid: banned });
  if (second.fallback) return { ...first, rewrote: false, summary: `${first.summary} A rewrite was attempted but the model failed.` };
  Object.assign(w, { plan: second.plan, filled: second.filled ?? [], repaired: second.repaired ?? false, rewrites: 1, banned, summary: `${second.summary} Rewritten once after the check.` });
  emitEvent(run, { type: "stage", id: "write", status: "done", output: w, summary: w.summary, rewritten: true });
  const again = checkEvidence(run);
  return { ...again, rewrote: true, banned, firstPass: { checked: first.checked, grounded: first.grounded, removed: first.removed, items: first.items }, summary: `First pass: ${first.removed} of ${first.checked} names not in Qloo's evidence. Rewrote with them banned: now ${again.grounded} of ${again.checked} trace to Qloo, ${again.removed} removed.` };
};
