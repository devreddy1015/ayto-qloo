// Caption cues from the voice itself: each line is cut into chunks of at most 52 characters at its punctuation, and
// each chunk starts where the speaker resumes after a pause (ffmpeg silencedetect on the clip), so captions don't
// lag the voice. Writes src/cues.json: { "<clip>": [{ text, at }] }, with `at` in frames from the clip's start.
//
//   node scripts/cues.mjs [timeline.ts] [cues.json]     (default: src/timeline.ts → src/cues.json)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const timeline = fs.readFileSync(path.resolve(root, process.argv[2] ?? "src/timeline.ts"), "utf8");
const outFile = path.resolve(root, process.argv[3] ?? "src/cues.json");
const dir = timeline.match(/VOICE_DIR = "([^"]+)"/)[1];
const FPS = 30, MAX = 52;

// Lines whose natural breaks the 52-character rule gets wrong: the chunks are set by hand, the timing still snaps to pauses.
const OVERRIDE = {
  s02: ["The real question is which kind of crime story", "London loves, and isn't getting."],
  s06d: ["Then it counts the recent crime films that carry them."],
  s11: ["Then make it: a concept still,", "a storyboard frame for every beat,", "and the story, read aloud."],
  // "L.A." ends in a period, which the splitter would read as a sentence end.
  d01: ["Every drop starts with a blank sketchbook, and a guess.", "You know L.A. loves streetwear.", "Everyone does."],
  d02: ["The real question is which kind of streetwear", "L.A. loves, and isn't getting."],
  d05: ["It plans its own reads on Qloo's taste graph:", "what L.A. loves more than the U.S.,", "and more than Houston, Phoenix and Philadelphia."],
  d06: ["Visual arts. Skate punk. Alternative dance.", "L.A. ranks them in its top twelve.", "The rest of the country?", "Not even in its top thirty."],
  d12: ["Same engine, any format:", "a crime film in London,", "a reel in Las Vegas,", "a live music night in Chicago,", "an indie game in Seattle,", "a café in Austin."],
  s16: ["Same engine, any format:", "a podcast in Los Angeles,", "a café in Austin,", "a live music night in Chicago,", "a novel in New York,", "an indie game in Seattle."],
};

const voice = [...timeline.matchAll(/\{ src: "(\w+)", from: s\("\w+", \d+\), dur: \d+, text: "((?:[^"\\]|\\.)*)" \}/g)].map((m) => ({ src: m[1], text: m[2] }));

function chunks(text) {
  const phrases = text.split(/(?<=[,.:?;])\s+/);
  const out = [];
  for (const p of phrases) {
    const last = out[out.length - 1];
    if (last && (last + " " + p).length <= MAX && !/[.?]$/.test(last)) out[out.length - 1] = `${last} ${p}`;
    else if (p.length <= MAX) out.push(p);
    else {
      // A long phrase splits at the space nearest its middle.
      const mid = p.lastIndexOf(" ", Math.ceil(p.length / 2) + 4);
      out.push(p.slice(0, mid), p.slice(mid + 1));
    }
  }
  return out;
}

const cues = {};
for (const v of voice) {
  const file = path.join(root, "public", dir, `${v.src}.wav`);
  // ffmpeg writes its log to stderr.
  const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${file}" -af silencedetect=noise=-35dB:d=0.12 -f null - 2>&1`], { encoding: "utf8" });
  const dur = Number(log.match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((a, x, i) => a + Number(x) * [3600, 60, 1][i], 0));
  const back = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t < dur - 0.1);
  const parts = OVERRIDE[v.src] ?? chunks(v.text.replace(/\\"/g, '"'));
  const total = parts.reduce((n, p) => n + p.length, 0);
  let before = 0, prev = 0;
  cues[v.src] = parts.map((text, i) => {
    let at = 0;
    if (i > 0) {
      const guess = (dur * before) / total;
      const near = back.filter((t) => t > prev + 0.3).sort((a, b) => Math.abs(a - guess) - Math.abs(b - guess))[0];
      at = near !== undefined && Math.abs(near - guess) < 0.9 ? near : guess;
    }
    before += text.length;
    prev = at;
    return { text, at: Math.round(at * FPS) };
  });
}

fs.writeFileSync(outFile, JSON.stringify(cues, null, 1));
for (const [k, list] of Object.entries(cues)) console.log(k, list.map((c) => `${c.at}:${c.text}`).join(" | "));
