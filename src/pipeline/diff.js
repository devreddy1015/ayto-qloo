// Stage: with vs without Qloo. The same sentence goes to the same model with
// no evidence at all; the names it produces are checked against this run's Qloo
// evidence. It is the one-card answer to "would this work the same without Qloo?".
import { getRunCredential } from "../keys.js";
import { chatJson, llmAvailable, redact } from "../llm.js";
import { memo } from "../qloo.js";
import { isKnownName } from "./evidence.js";
import { emitEvent } from "./store.js";

const WITHOUT = {
  film: `A filmmaker describes a film they want to make. With no external data, suggest: 3 reference films they should study, 3 artists for the soundtrack, 3 cities beyond their own where it would land, and the sub-genre lane to take. Return JSON {"references":[""],"artists":[""],"cities":[""],"lane":""}`,
  reel: `A creator describes a reel they want to make. With no external data, suggest: the song or artist to use, 3 places in that city to shoot, and 3 films or series to nod to. Return JSON {"artists":[""],"places":[""],"references":[""]}`,
  fashion: `A small maker describes a drop. With no external data, suggest: 4 brands to study, 3 first cities, 3 artists for the launch. Return JSON {"brands":[""],"cities":[""],"artists":[""]}`,
};

export async function diff(run) {
  const credential = getRunCredential(run.id);
  const format = run.input.format;
  const w = run.stages.write?.output;
  const input = run.input;
  const sentence = input.text?.trim() || `I'm making a ${format} in ${input.city?.query ?? input.city}${input.theme?.query ? ` about ${input.theme.query}` : ""}.`;
  let without;
  let error;
  if (credential || llmAvailable()) {
    emitEvent(run, { type: "thought", stage: "diff", text: "Asking the same question with no Qloo evidence…" });
    try {
      const call = () => chatJson({ credential, system: WITHOUT[format] ?? WITHOUT.film, user: sentence, temperature: 0.4, maxTokens: 600 });
      without = credential ? await call() : await memo("llm", `diff-${format}-v1`, { sentence }, call);
    } catch (e) {
      error = redact(e.message).slice(0, 200);
    }
  }
  const flat = (o) => Object.values(o ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((x) => typeof x === "string" && x.trim());
  const withoutNames = flat(without);
  const withNames = flat({
    a: (w?.plan?.references ?? []).map((x) => x?.title ?? x),
    b: (w?.plan?.soundtrack ?? []).map((x) => x?.artist ?? x),
    c: w?.plan?.travels_next ?? w?.plan?.first_cities ?? [],
    d: (w?.plan?.spots ?? []).map((x) => x?.name ?? x),
    e: w?.plan?.brands_to_study ?? [],
    f: w?.plan?.audio?.artist,
  });
  const count = (list) => ({ named: list.length, grounded: list.filter((n) => isKnownName(run, n)).length });
  const a = count(withNames);
  const b = count(withoutNames);
  return { question: sentence, withQloo: withNames.slice(0, 12), withoutQloo: without ?? { unavailable: true }, benchmark: { withQloo: a, withoutQloo: b }, error, summary: without ? `With Qloo: ${a.grounded} of ${a.named} names trace to evidence. Without: ${b.grounded} of ${b.named}.` : "No model to run the comparison." };
}
