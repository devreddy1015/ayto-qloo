// Stage: check. Every named claim the writer made is looked up in the names
// Qloo returned during this run. Unknown names are removed, not corrected.
import { GROUND } from "../writers/index.js";
import { isKnownName } from "./evidence.js";
import { emitEvent } from "./store.js";

function walk(obj, path, visit) {
  const [head, ...rest] = path.split(".");
  if (head === undefined) return;
  const key = head.replace("[]", "");
  const isArray = head.endsWith("[]");
  const value = key ? obj?.[key] : obj;
  if (value === undefined || value === null) return;
  const items = isArray ? (Array.isArray(value) ? value : []) : [value];
  items.forEach((item, i) => {
    if (rest.length) return walk(item, rest.join("."), visit);
    // A removed string inside an array is replaced in place; a removed string field marks its whole
    // parent object (the reference, the lane, the audio pick), so the object goes, not just the name.
    visit(item, (replacement) => {
      if (isArray) obj[key][i] = replacement;
      else if (typeof item === "string") obj.removed = true;
      else obj[key] = replacement;
    });
  });
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

const nameOf = (item) => (typeof item === "string" ? item : item?.title ?? item?.artist ?? item?.name ?? item?.city ?? item?.flavour ?? item?.partner);

export function checkEvidence(run) {
  const output = run.stages.write?.output;
  const paths = GROUND[output?.writer] ?? [];
  const checked = [];
  let grounded = 0;
  let removed = 0;
  if (output) {
    for (const [path, kind] of paths) {
      walk(output, path, (item, replace) => {
        const name = nameOf(item);
        if (!name) return;
        const ok = isKnownName(run, name);
        checked.push({ kind, name, ok });
        if (ok) grounded += 1;
        else {
          removed += 1;
          replace(typeof item === "string" ? `[removed: not in Qloo evidence] ${name}` : { ...item, removed: true });
        }
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
