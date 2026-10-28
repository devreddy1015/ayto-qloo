// Stage: check. Every named claim the writer made is looked up in the names
// Qloo returned during this run. Unknown names are removed, not corrected.
import { GROUND } from "../writers/index.js";
import { isKnownName } from "./evidence.js";

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
  }
  const score = checked.length ? Math.round((grounded / checked.length) * 100) : 100;
  return { checked: checked.length, grounded, removed, score, items: checked.filter((c) => !c.ok).slice(0, 30), summary: checked.length ? `${grounded} of ${checked.length} names trace to Qloo. ${removed} removed.` : "Nothing named to check." };
}

export const check = async (run) => checkEvidence(run);
