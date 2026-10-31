// Writes voice lines with Sarvam Bulbul v3, speaker "shubh" (the video's voice), the same request src/voice.js makes.
//
//   SARVAM_API_KEY=… node scripts/sarvam.mjs <out-dir> <id>=<text> [<id>=<text> …]
//
// The key is read from the environment only; it never goes into a file.

import fs from "node:fs";
import path from "node:path";

const key = process.env.SARVAM_API_KEY;
if (!key) throw new Error("SARVAM_API_KEY is not set");
const [out, ...pairs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

for (const pair of pairs) {
  const i = pair.indexOf("=");
  const id = pair.slice(0, i), text = pair.slice(i + 1);
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, language_code: "en-IN", model: "bulbul:v3", speaker: "shubh", pace: 1, output_audio_codec: "wav" }),
  });
  if (!res.ok) throw new Error(`${id}: Sarvam answered ${res.status}`);
  const json = await res.json();
  const audio = Buffer.from(json.audios.join(""), "base64");
  fs.writeFileSync(path.join(out, `${id}.wav`), audio);
  console.log(`${id}.wav`, audio.length, "bytes");
}
