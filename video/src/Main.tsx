// The whole film: scenes from SHOTS, then the voice, the captions, the sound effects and the music.
import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Ayto, Compose, Evidence, Gap, GapCard, Guess, Question } from "./scenes-a";
import { Brief, Diff, Look, Make, Outro } from "./scenes-b";
import { Drop, Formats, Mcp, Reel, Where } from "./scenes-c";
import cues from "./cues.json";
import { SFX, SHOTS, STORY_VOICE, TOTAL, VOICE, VOICE_DIR } from "./timeline";
import { fontFamily } from "./ui";

const SCENES: Record<string, React.FC<{ dur: number }>> = {
  guess: Guess, question: Question, ayto: Ayto, compose: Compose, evidence: Evidence, gap: Gap, card: GapCard,
  look: Look, brief: Brief, diff: Diff, make: Make, where: Where, reel: Reel, drop: Drop, formats: Formats, mcp: Mcp, outro: Outro,
};

// Lines the picture already says in big type get no caption.
const NO_CAPTION = new Set(["s07", "s13a", "s13b", "s13c"]);

/** Caption cues cut at the voice's own pauses (scripts/cues.mjs → cues.json). A cue ends where the next one starts,
 * or a little after its clip, and never runs into the next clip. */
const CUES = cues as Record<string, { text: string; at: number }[]>;
const SHOWN = VOICE.filter((v) => !NO_CAPTION.has(v.src));
const CAPTIONS = SHOWN.flatMap((v, i) => {
  const list = CUES[v.src] ?? [{ text: v.text, at: 0 }];
  const stop = Math.min(v.from + v.dur + 8, SHOWN[i + 1]?.from ?? Infinity);
  return list.map((c, j) => ({ text: c.text, from: v.from + c.at, dur: (j + 1 < list.length ? v.from + list[j + 1].at : stop) - (v.from + c.at) }));
});

const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const c = CAPTIONS.find((x) => f >= x.from && f < x.from + x.dur);
  if (!c) return null;
  const o = Math.min(interpolate(f - c.from, [0, 4], [0, 1], { extrapolateRight: "clamp" }), interpolate(c.from + c.dur - f, [0, 4], [0, 1], { extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 40, pointerEvents: "none" }}>
      <div style={{ fontFamily, fontSize: 50, fontWeight: 600, color: "#f5f5f7", background: "rgba(0,0,0,0.74)", padding: "8px 22px", borderRadius: 12, opacity: o, letterSpacing: "-0.005em" }}>{c.text}</div>
    </AbsoluteFill>
  );
};

const Music: React.FC = () => {
  const f = useCurrentFrame();
  const vol = interpolate(f, [0, 45, TOTAL - 90, TOTAL - 10], [0, 0.14, 0.14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Audio src={staticFile("audio/bgm-tech-house.mp3")} volume={vol} />;
};

export const Main: React.FC<{ bgm: boolean; captions: boolean }> = ({ bgm, captions }) => (
  <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
    {Object.entries(SHOTS).map(([id, s]) => {
      const Scene = SCENES[id];
      return (
        <Sequence key={id} from={s.from} durationInFrames={s.dur} name={id}>
          <Scene dur={s.dur} />
        </Sequence>
      );
    })}
    {captions ? <Captions /> : null}
    {VOICE.map((v) => (
      <Sequence key={v.src} from={v.from} durationInFrames={v.dur + 10} name={`vo ${v.src}`}>
        <Audio src={staticFile(`${VOICE_DIR}/${v.src}.wav`)} volume={1} />
      </Sequence>
    ))}
    <Sequence from={STORY_VOICE.from} durationInFrames={STORY_VOICE.dur} name="the story, read aloud">
      <Audio src={staticFile(STORY_VOICE.src)} volume={(f) => interpolate(f, [0, 6, STORY_VOICE.dur - 12, STORY_VOICE.dur], [0, 0.9, 0.9, 0], { extrapolateRight: "clamp" })} />
    </Sequence>
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur ?? 90} name={`sfx ${s.note}`}>
        <Audio src={staticFile(`audio/${s.src}`)} volume={s.volume} />
      </Sequence>
    ))}
    {bgm ? <Music /> : null}
  </AbsoluteFill>
);
