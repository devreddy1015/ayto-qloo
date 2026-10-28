// Stage: who shows up, in aggregate. Qloo's skews for the city's own picks,
// averaged. Never about an individual.
import { averageSkew } from "../analysis.js";
import { evidenceFor } from "../pipeline/evidence.js";
import { crowdIds } from "./common.js";

const AGE_LABEL = { "24_and_younger": "under 25", "25_to_29": "25–29", "30_to_34": "30–34", "35_to_44": "35–44", "45_to_54": "45–54", "55_and_older": "55+" };

export async function audience(run) {
  const q = evidenceFor(run, "audience");
  const ids = crowdIds(run, { limit: 3 });
  const names = ids.map((id) => run.entities?.[id]?.name ?? id);
  const envs = await Promise.all(ids.map((id, i) => q.tryTool(`Audience skew for ${names[i]}`, "qloo_audience_demographics", { entity: id, limit: 10 })));
  const skew = averageSkew(envs.flatMap((e) => e?.results ?? []));
  if (!skew) return { skew: undefined, basis: names, summary: "No audience skew available." };
  const ages = Object.entries(skew.age).sort((a, b) => b[1] - a[1]);
  const leans = ages.filter(([, v]) => v > 0.1).slice(0, 2).map(([k]) => AGE_LABEL[k] ?? k);
  const gender = skew.gender.male > 0.15 ? "leans male" : skew.gender.female > 0.15 ? "leans female" : "even";
  return { skew, basis: names, leans, gender, summary: `${leans.length ? `Skews ${leans.join(" and ")}` : "Spread across ages"}, ${gender}. From ${skew.entities} of this city's picks.` };
}
