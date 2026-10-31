// The drop-led video's one timeline (composition AytoDrop): a streetwear drop in Los Angeles, from the live run
// r_ftChx5Q of 31 Oct, 06:00 IST, then the same engine in five other formats. 30 fps. The voice is Sarvam Bulbul v3,
// speaker "shubh", in public/vo/drop/ (lines in public/vo/drop/lines.json). The frame numbers inside each scene are
// its line's phrase starts, read from the clip's own pauses.

export const VOICE_DIR = "vo/drop";

type Shot = { id: string; dur: number };
const ORDER: Shot[] = [
  { id: "guess", dur: 210 },
  { id: "question", dur: 150 },
  { id: "ayto", dur: 100 },
  { id: "compose", dur: 170 },
  { id: "evidence", dur: 230 },
  { id: "gap", dur: 280 },
  { id: "card", dur: 115 },
  { id: "look", dur: 300 },
  { id: "brief", dur: 300 },
  { id: "diff", dur: 230 },
  { id: "make", dur: 260 },
  { id: "formats", dur: 330 },
  { id: "mcp", dur: 100 },
  { id: "outro", dur: 260 },
];

export const SHOTS: Record<string, { from: number; dur: number }> = {};
let at = 0;
for (const sh of ORDER) {
  SHOTS[sh.id] = { from: at, dur: sh.dur };
  at += sh.dur;
}
export const TOTAL = at;

const s = (id: string, offset: number) => SHOTS[id].from + offset;

/** Voice clips: file, start frame, length in frames, and the caption it shows. */
export const VOICE: { src: string; from: number; dur: number; text: string }[] = [
  { src: "d01", from: s("guess", 15), dur: 175, text: "Every drop starts with a blank sketchbook, and a guess. You know L.A. loves streetwear. Everyone does." },
  { src: "d02", from: s("question", 10), dur: 113, text: "The real question is which kind of streetwear L.A. loves, and isn't getting." },
  { src: "d03", from: s("ayto", 20), dur: 59, text: "AYTO answers that before you design a thing." },
  { src: "d04", from: s("compose", 10), dur: 123, text: "Tell it what you're making, and where. A streetwear drop in Los Angeles." },
  { src: "d05", from: s("evidence", 10), dur: 200, text: "It plans its own reads on Qloo's taste graph: what L.A. loves more than the U.S., and more than Houston, Phoenix and Philadelphia." },
  { src: "d06", from: s("gap", 15), dur: 231, text: "Visual arts. Skate punk. Alternative dance. L.A. ranks them in its top twelve. The rest of the country? Not even in its top thirty." },
  { src: "s07", from: s("card", 14), dur: 93, text: "That's the gap. Loved here, under-served." },
  { src: "d08", from: s("look", 12), dur: 274, text: "Then it reads the look: unique silhouettes, high fashion, artisanal. Silk and leather, three times the country's share. Not polished. Not colourful." },
  { src: "d09", from: s("brief", 12), dur: 233, text: "Your own AI writes the drop into that gap: Sunset Static. Four styles, a palette, the labels to study, and the first cities to launch in." },
  { src: "d10", from: s("diff", 10), dur: 174, text: "Every name opens the Qloo request it came from. Ask the same AI without Qloo: two of ten names trace." },
  { src: "d11", from: s("make", 10), dur: 197, text: "Then see it: every style on a mannequin, in 3D, in the drop's own colours, with its print drawn for it." },
  { src: "d12", from: s("formats", 10), dur: 289, text: "Same engine, any format: a crime film in London, a reel in Las Vegas, a live music night in Chicago, an indie game in Seattle, a café in Austin." },
  { src: "s12d", from: s("mcp", 12), dur: 46, text: "And any agent can call it." },
  { src: "s13a", from: s("outro", 63), dur: 17, text: "AYTO." },
  { src: "s13b", from: s("outro", 98), dur: 26, text: "Are you the one?" },
  { src: "s13c", from: s("outro", 132), dur: 55, text: "Built on what your city already loves." },
];

/** Sound effects, each pinned to a scene action. Volumes are multipliers on the files' own levels. */
export const SFX: { src: string; from: number; volume: number; dur?: number; note: string }[] = [
  { src: "riser-cine.mp3", from: s("guess", 20), volume: 0.35, dur: 140, note: "the tile field builds" },
  { src: "swoosh-slow.mp3", from: s("question", 0), volume: 0.4, dur: 70, note: "push into the empty slot" },
  { src: "shimmer-sparkle-sweep.mp3", from: s("ayto", 8), volume: 0.35, note: "the ring draws" },
  { src: "keyboard.mp3", from: s("compose", 18), volume: 0.35, dur: 60, note: "the sentence types" },
  { src: "transition-soft.mp3", from: s("compose", 98), volume: 0.5, note: "the confirm row lands" },
  { src: "air-woosh-quick.mp3", from: s("evidence", 0), volume: 0.45, note: "cut to the evidence" },
  { src: "air-woosh-quick.mp3", from: s("gap", 0), volume: 0.45, note: "the gap card rises" },
  { src: "transition-soft.mp3", from: s("gap", 15), volume: 0.45, note: "lane 1" },
  { src: "transition-soft.mp3", from: s("gap", 40), volume: 0.4, note: "lane 2" },
  { src: "transition-soft.mp3", from: s("gap", 73), volume: 0.35, note: "lane 3" },
  { src: "impact-cine-big.mp3", from: s("gap", 206), volume: 0.45, dur: 110, note: "not in the country's top 30: the first hit" },
  { src: "air-woosh-quick.mp3", from: s("look", 0), volume: 0.4, note: "the look card enters" },
  { src: "transition-soft.mp3", from: s("look", 152), volume: 0.35, note: "the material bars grow" },
  { src: "air-woosh-quick.mp3", from: s("brief", 0), volume: 0.4, note: "the brief enters" },
  { src: "transition-soft.mp3", from: s("diff", 8), volume: 0.45, note: "the receipt chip lifts" },
  { src: "swoosh-slow.mp3", from: s("diff", 112), volume: 0.35, dur: 60, note: "the slider wipes" },
  { src: "air-woosh-quick.mp3", from: s("make", 0), volume: 0.4, note: "the studio enters" },
  { src: "transition-soft.mp3", from: s("make", 88), volume: 0.3, note: "style change" },
  { src: "transition-soft.mp3", from: s("make", 118), volume: 0.3, note: "style change" },
  { src: "shimmer-sparkle-sweep.mp3", from: s("make", 168), volume: 0.3, note: "the drawn print" },
  { src: "air-woosh-quick.mp3", from: s("formats", 72), volume: 0.3, note: "relay: film" },
  { src: "air-woosh-quick.mp3", from: s("formats", 116), volume: 0.3, note: "relay: reel" },
  { src: "air-woosh-quick.mp3", from: s("formats", 162), volume: 0.3, note: "relay: live night" },
  { src: "air-woosh-quick.mp3", from: s("formats", 216), volume: 0.3, note: "relay: game" },
  { src: "air-woosh-quick.mp3", from: s("formats", 267), volume: 0.3, note: "relay: café" },
  { src: "shimmer-sparkle-sweep.mp3", from: s("mcp", 4), volume: 0.3, note: "the MCP door" },
  { src: "riser-cine.mp3", from: s("outro", 0), volume: 0.35, dur: 64, note: "the elements gather" },
  { src: "bass-hit-short.mp3", from: s("outro", 62), volume: 0.7, note: "the dot lands: the second hit" },
  { src: "sparkle.mp3", from: s("outro", 66), volume: 0.3, dur: 90, note: "the dot's afterglow" },
];
