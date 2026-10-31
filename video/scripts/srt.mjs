// Writes the captions as an .srt for the YouTube upload (and for an editor): every voice line, cut where the video
// cuts it (src/cues.json), including the lines the picture shows in big type and so leaves uncaptioned.
//
//   node scripts/srt.mjs out/ayto-demo.srt [timeline.ts] [cues.json]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const timeline = fs.readFileSync(path.resolve(root, process.argv[3] ?? "src/timeline.ts"), "utf8");
const cues = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[4] ?? "src/cues.json"), "utf8"));
const FPS = 30;

// Scene starts, the same sum timeline.ts makes.
const starts = {};
let at = 0;
for (const m of timeline.matchAll(/\{ id: "(\w+)", dur: (\d+) \}/g)) {
  starts[m[1]] = at;
  at += Number(m[2]);
}
const voice = [...timeline.matchAll(/\{ src: "(\w+)", from: s\("(\w+)", (\d+)\), dur: (\d+), text: "((?:[^"\\]|\\.)*)" \}/g)].map((m) => ({
  src: m[1], from: starts[m[2]] + Number(m[3]), dur: Number(m[4]), text: m[5],
}));

const stamp = (frames) => {
  const ms = Math.round((frames / FPS) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

const rows = [];
voice.forEach((v, i) => {
  const list = cues[v.src] ?? [{ text: v.text, at: 0 }];
  const stop = Math.min(v.from + v.dur + 8, voice[i + 1]?.from ?? Infinity);
  list.forEach((c, j) => rows.push({ from: v.from + c.at, to: j + 1 < list.length ? v.from + list[j + 1].at : stop, text: c.text }));
});

const out = process.argv[2] ?? path.join(root, "out/ayto-demo.srt");
fs.writeFileSync(out, rows.map((r, i) => `${i + 1}\n${stamp(r.from)} --> ${stamp(r.to)}\n${r.text}\n`).join("\n"));
console.log(`${rows.length} captions → ${out}`);
