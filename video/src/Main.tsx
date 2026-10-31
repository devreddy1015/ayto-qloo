// A whole film from one timeline: its scenes, then the voice, the captions, the sound effects and the music.
// makeFilm builds both videos: AytoDemo (the London film leads, ./timeline) and AytoDrop (a Los Angeles drop leads,
// ./drop/timeline).
import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Ayto, Compose, Evidence, Gap, GapCard, Guess, Question } from "./scenes-a";
import { Brief, Diff, Look, Make, Outro } from "./scenes-b";
import { Drop, Formats, Mcp, Reel, Where } from "./scenes-c";
import * as D from "./drop/scenes";
import filmCues from "./cues.json";
import dropCues from "./drop/cues.json";
import * as film from "./timeline";
import * as drop from "./drop/timeline";
import { fontFamily } from "./ui";

type Voice = { src: string; from: number; dur: number; text: string };
type Sfx = { src: string; from: number; volume: number; dur?: number; note: string };
type Timeline = {
  SHOTS: Record<string, { from: number; dur: number }>;
  VOICE: Voice[];
  SFX: Sfx[];
  TOTAL: number;
  VOICE_DIR: string;
  STORY_VOICE?: { src: string; from: number; dur: number };
};
export type FilmProps = { bgm: boolean; captions: boolean };

// Lines the picture already says in big type get no caption.
const NO_CAPTION = new Set(["s07", "s13a", "s13b", "s13c"]);

function makeFilm(t: Timeline, scenes: Record<string, React.FC<{ dur: number }>>, cues: Record<string, { text: string; at: number }[]>): React.FC<FilmProps> {
  // Caption cues cut at the voice's own pauses (scripts/cues.mjs). A cue ends where the next one starts, or a little
  // after its clip, and never runs into the next clip.
  const shown = t.VOICE.filter((v) => !NO_CAPTION.has(v.src));
  const captions = shown.flatMap((v, i) => {
    const list = cues[v.src] ?? [{ text: v.text, at: 0 }];
    const stop = Math.min(v.from + v.dur + 8, shown[i + 1]?.from ?? Infinity);
    return list.map((c, j) => ({ text: c.text, from: v.from + c.at, dur: (j + 1 < list.length ? v.from + list[j + 1].at : stop) - (v.from + c.at) }));
  });

  const Captions: React.FC = () => {
    const f = useCurrentFrame();
    const c = captions.find((x) => f >= x.from && f < x.from + x.dur);
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
    const vol = interpolate(f, [0, 45, t.TOTAL - 90, t.TOTAL - 10], [0, 0.14, 0.14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <Audio src={staticFile("audio/bgm-tech-house.mp3")} volume={vol} />;
  };

  const Film: React.FC<FilmProps> = ({ bgm, captions: withCaptions }) => (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      {Object.entries(t.SHOTS).map(([id, s]) => {
        const Scene = scenes[id];
        return (
          <Sequence key={id} from={s.from} durationInFrames={s.dur} name={id}>
            <Scene dur={s.dur} />
          </Sequence>
        );
      })}
      {withCaptions ? <Captions /> : null}
      {t.VOICE.map((v) => (
        <Sequence key={v.src} from={v.from} durationInFrames={v.dur + 10} name={`vo ${v.src}`}>
          <Audio src={staticFile(`${t.VOICE_DIR}/${v.src}.wav`)} volume={1} />
        </Sequence>
      ))}
      {t.STORY_VOICE ? (
        <Sequence from={t.STORY_VOICE.from} durationInFrames={t.STORY_VOICE.dur} name="the story, read aloud">
          <Audio src={staticFile(t.STORY_VOICE.src)} volume={(f) => interpolate(f, [0, 6, t.STORY_VOICE!.dur - 12, t.STORY_VOICE!.dur], [0, 0.9, 0.9, 0], { extrapolateRight: "clamp" })} />
        </Sequence>
      ) : null}
      {t.SFX.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur ?? 90} name={`sfx ${s.note}`}>
          <Audio src={staticFile(`audio/${s.src}`)} volume={s.volume} />
        </Sequence>
      ))}
      {bgm ? <Music /> : null}
    </AbsoluteFill>
  );
  return Film;
}

export const Main = makeFilm(
  film,
  {
    guess: Guess, question: Question, ayto: Ayto, compose: Compose, evidence: Evidence, gap: Gap, card: GapCard,
    look: Look, brief: Brief, diff: Diff, make: Make, where: Where, reel: Reel, drop: Drop, formats: Formats, mcp: Mcp, outro: Outro,
  },
  filmCues,
);
export const FILM_TOTAL = film.TOTAL;

export const DropMain = makeFilm(
  drop,
  {
    guess: D.DGuess, question: D.DQuestion, ayto: D.DAyto, compose: D.DCompose, evidence: D.DEvidence, gap: D.DGap, card: D.DCard,
    look: D.DLook, brief: D.DBrief, diff: D.DDiff, make: D.DMake, formats: D.DFormats, mcp: D.DMcp, outro: D.DOutro,
  },
  dropCues,
);
export const DROP_TOTAL = drop.TOTAL;
