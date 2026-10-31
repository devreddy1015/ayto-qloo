// The one timeline. Every scene, voice clip, caption and sound is placed from SHOTS, so moving a scene moves its
// sound with it. 30 fps. The voice is Sarvam Bulbul v3, speaker "shubh" (the user's pick), in public/vo/shubh/; three
// lines are cut at their pauses (s06, s12, s13) so the picture lands on the words. Lines in public/vo/lines.json.

export const VOICE_DIR = "vo/shubh";

export const FPS = 30;

type Shot = { id: string; dur: number };
const ORDER: Shot[] = [
  { id: "guess", dur: 225 },
  { id: "question", dur: 165 },
  { id: "ayto", dur: 105 },
  { id: "compose", dur: 170 },
  { id: "evidence", dur: 255 },
  { id: "gap", dur: 300 },
  { id: "card", dur: 115 },
  { id: "look", dur: 195 },
  { id: "brief", dur: 360 },
  { id: "diff", dur: 250 },
  { id: "make", dur: 245 },
  { id: "where", dur: 140 },
  { id: "reel", dur: 360 },
  { id: "drop", dur: 375 },
  { id: "formats", dur: 330 },
  { id: "mcp", dur: 100 },
  { id: "outro", dur: 260 },
];

export const SHOTS: Record<string, { from: number; dur: number }> = {};
let at = 0;
for (const s of ORDER) {
  SHOTS[s.id] = { from: at, dur: s.dur };
  at += s.dur;
}
export const TOTAL = at;

const s = (id: string, offset: number) => SHOTS[id].from + offset;

/** Voice clips: file, start frame, length in frames, and the caption it shows. */
export const VOICE: { src: string; from: number; dur: number; text: string }[] = [
  { src: "s01", from: s("guess", 15), dur: 175, text: "Every film starts with a blank page, and a guess. You know London loves crime. Everyone does." },
  { src: "s02", from: s("question", 10), dur: 134, text: "The real question is which kind of crime story London loves, and isn't getting." },
  { src: "s03", from: s("ayto", 20), dur: 62, text: "AYTO answers that before you write a word." },
  { src: "s04", from: s("compose", 10), dur: 105, text: "Tell it what you're making, and where. A crime short film in London." },
  { src: "s05", from: s("evidence", 10), dur: 216, text: "It plans its own reads on Qloo's taste graph: what London loves more than the UK, and more than Glasgow, Liverpool and Leeds." },
  { src: "s06a", from: s("gap", 15), dur: 38, text: "Autobiographical." },
  { src: "s06b", from: s("gap", 62), dur: 34, text: "Indietronica." },
  { src: "s06c", from: s("gap", 104), dur: 25, text: "Tragedy." },
  { src: "s06d", from: s("gap", 140), dur: 80, text: "Then it counts the recent crime films that carry them." },
  { src: "s06e", from: s("gap", 236), dur: 17, text: "Zero." },
  { src: "s07", from: s("card", 14), dur: 93, text: "That's the gap. Loved here, under-served." },
  { src: "s08", from: s("look", 12), dur: 159, text: "It reads the look this crowd leans to: naturalistic, intimate, gritty. Not glossy." },
  { src: "s09", from: s("brief", 12), dur: 236, text: "Then your own AI writes into the gap: the story, six beats, characters, films to study and the shot to borrow, a shoot base, a palette." },
  { src: "s10", from: s("diff", 10), dur: 203, text: "Every name opens the Qloo request it came from. Ask the same AI without Qloo: zero of ten names trace." },
  { src: "s11", from: s("make", 10), dur: 169, text: "Then make it: a concept still, a storyboard frame for every beat, and the story, read aloud." },
  { src: "s12a", from: s("where", 10), dur: 87, text: "Not sure where? It compares ten US cities." },
  { src: "s14", from: s("reel", 12), dur: 331, text: "Reels in Las Vegas? The crowd here leans club-like and party-oriented, far more than the rest of the country. So AYTO writes the reel: the hook, five beats, the track, and the spots to shoot." },
  { src: "s15", from: s("drop", 12), dur: 351, text: "A streetwear drop in Paris? The city leans artistic, avant-garde and intellectual, and the look is creative and minimal, in leather and wool. AYTO writes the drop, and every style turns in 3D." },
  { src: "s16", from: s("formats", 10), dur: 300, text: "Same engine, any format: a podcast in Los Angeles, a café in Austin, a live music night in Chicago, a novel in New York, an indie game in Seattle." },
  { src: "s12d", from: s("mcp", 12), dur: 46, text: "And any agent can call it." },
  { src: "s13a", from: s("outro", 63), dur: 17, text: "AYTO." },
  { src: "s13b", from: s("outro", 98), dur: 26, text: "Are you the one?" },
  { src: "s13c", from: s("outro", 132), dur: 55, text: "Built on what your city already loves." },
];

/** The story as the app reads it aloud (Sarvam Bulbul, from the live run), heard for a moment in the studio scene. */
export const STORY_VOICE = { src: "audio/sarvam-story.mp3", from: s("make", 186), dur: 56 };

/** Sound effects, each pinned to a scene action. Volumes are multipliers on the files' own levels. */
export const SFX: { src: string; from: number; volume: number; dur?: number; note: string }[] = [
  { src: "riser-cine.mp3", from: s("guess", 20), volume: 0.35, dur: 140, note: "the tile field builds" },
  { src: "swoosh-slow.mp3", from: s("question", 0), volume: 0.4, dur: 70, note: "push into the empty slot" },
  { src: "shimmer-sparkle-sweep.mp3", from: s("ayto", 8), volume: 0.35, note: "the ring draws" },
  { src: "keyboard.mp3", from: s("compose", 18), volume: 0.35, dur: 60, note: "the sentence types" },
  { src: "transition-soft.mp3", from: s("compose", 98), volume: 0.5, note: "the confirm row lands" },
  { src: "air-woosh-quick.mp3", from: s("evidence", 0), volume: 0.45, note: "cut to the evidence" },
  { src: "air-woosh-quick.mp3", from: s("gap", 0), volume: 0.45, note: "the gap card rises" },
  { src: "transition-soft.mp3", from: s("gap", 18), volume: 0.45, note: "lane 1 grows" },
  { src: "transition-soft.mp3", from: s("gap", 64), volume: 0.4, note: "lane 2 grows" },
  { src: "transition-soft.mp3", from: s("gap", 106), volume: 0.35, note: "lane 3 grows" },
  { src: "impact-cine-big.mp3", from: s("gap", 238), volume: 0.45, dur: 110, note: "ZERO: the first music hit" },
  { src: "air-woosh-quick.mp3", from: s("look", 0), volume: 0.4, note: "the look card enters" },
  { src: "air-woosh-quick.mp3", from: s("brief", 0), volume: 0.4, note: "the brief enters" },
  { src: "keyboard.mp3", from: s("brief", 14), volume: 0.22, dur: 70, note: "the story types in" },
  { src: "transition-soft.mp3", from: s("diff", 8), volume: 0.45, note: "the receipt chip lifts" },
  { src: "swoosh-slow.mp3", from: s("diff", 112), volume: 0.35, dur: 60, note: "the slider wipes" },
  { src: "air-woosh-quick.mp3", from: s("make", 0), volume: 0.4, note: "the studio enters" },
  { src: "transition-soft.mp3", from: s("make", 70), volume: 0.35, note: "shot deck frames deal" },
  { src: "air-woosh-quick.mp3", from: s("where", 0), volume: 0.4, note: "the map enters" },
  { src: "air-woosh-quick.mp3", from: s("reel", 0), volume: 0.4, note: "the reel's gap card enters" },
  { src: "transition-soft.mp3", from: s("reel", 186), volume: 0.4, note: "the reel brief" },
  { src: "air-woosh-quick.mp3", from: s("drop", 0), volume: 0.4, note: "the drop's gap card enters" },
  { src: "transition-soft.mp3", from: s("drop", 162), volume: 0.35, note: "the look card" },
  { src: "transition-soft.mp3", from: s("drop", 264), volume: 0.35, note: "the drop brief" },
  { src: "air-woosh-quick.mp3", from: s("formats", 72), volume: 0.3, note: "relay: podcast" },
  { src: "air-woosh-quick.mp3", from: s("formats", 128), volume: 0.3, note: "relay: café" },
  { src: "air-woosh-quick.mp3", from: s("formats", 170), volume: 0.3, note: "relay: live night" },
  { src: "air-woosh-quick.mp3", from: s("formats", 226), volume: 0.3, note: "relay: novel" },
  { src: "air-woosh-quick.mp3", from: s("formats", 266), volume: 0.3, note: "relay: game" },
  { src: "shimmer-sparkle-sweep.mp3", from: s("mcp", 4), volume: 0.3, note: "the MCP door" },
  { src: "riser-cine.mp3", from: s("outro", 0), volume: 0.35, dur: 64, note: "the elements gather" },
  { src: "bass-hit-short.mp3", from: s("outro", 62), volume: 0.7, note: "the dot lands: the second hit" },
  { src: "sparkle.mp3", from: s("outro", 66), volume: 0.3, dur: 90, note: "the dot's afterglow" },
];
