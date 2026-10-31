// Scenes 1–7: the guess, the question, the mark, the sentence, Qloo reading, the gap, the gap card.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { mulberry32 } from "./helpers/rand";
import { Bg, CAM, EASE, INOUT, Pill, ramp, Rise, SceneFade, Shot, T, cut, fontFamily } from "./ui";

// ---------- 1–2 · the field of guesses (avatar-grid-radial-build-colorize, tiles drawn in code) ----------

const COLS = 15, ROWS = 9, TW = 104, TH = 140, GAP = 16;
const CC = 7, CR = 4; // the empty slot, dead centre
const gx = (c: number) => 960 - TW / 2 + (c - CC) * (TW + GAP);
const gy = (r: number) => 540 - TH / 2 + (r - CR) * (TH + GAP);

const GuessGrid: React.FC<{ f: number; zoom: number; slotGlow: number }> = ({ f, zoom, slotGlow }) => {
  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c === CC && r === CR) continue;
      const rnd = mulberry32(r * 97 + c * 13 + 7);
      const d = Math.hypot(c - CC, (r - CR) * 1.25);
      const t = ramp(f, 8 + d * 6, 8 + d * 6 + 16);
      const shade = 22 + Math.floor(rnd() * 10);
      tiles.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute", left: gx(c), top: gy(r), width: TW, height: TH, borderRadius: 10,
            background: `linear-gradient(180deg, rgb(${shade},${shade},${shade + 4}) 0%, rgb(${shade - 6},${shade - 6},${shade - 3}) 100%)`,
            border: "1px solid rgba(255,255,255,0.06)", opacity: t, transform: `scale(${0.72 + 0.28 * t})`,
          }}
        >
          <div style={{ position: "absolute", left: 12, right: 12 + rnd() * 30, bottom: 26, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", left: 12, right: 40 + rnd() * 20, bottom: 14, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
        </div>,
      );
    }
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "960px 540px" }}>
      {tiles}
      <div
        style={{
          position: "absolute", left: gx(CC), top: gy(CR), width: TW, height: TH, borderRadius: 10,
          border: `${1.5 / Math.max(1, zoom * 0.5)}px dashed rgba(242,190,34,${0.85 * slotGlow})`,
          boxShadow: `0 0 ${24 / zoom}px rgba(242,190,34,${0.35 * slotGlow})`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Guess: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  return (
    <Bg>
      <GuessGrid f={f} zoom={1 + 0.06 * ramp(f, 0, dur, 0, 1, INOUT)} slotGlow={ramp(f, 140, 175)} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,13,0) 45%, rgba(11,11,13,0.92) 78%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 690, textAlign: "center" }}>
        <Rise text="Every film starts with a guess." at={36} size={76} />
      </div>
    </Bg>
  );
};

export const Question: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 70], [1.06, 11], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAM });
  return (
    <SceneFade dur={dur} inF={1}>
      <Bg>
        <GuessGrid f={999} zoom={z} slotGlow={1} />
        <AbsoluteFill style={{ background: `rgba(11,11,13,${ramp(f, 40, 70, 0, 0.55)})` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 390, textAlign: "center" }}>
          <Rise text="Which kind of crime" at={52} size={76} stagger={4} />
          <Rise text="is London missing?" at={64} size={76} stagger={4} style={{ marginTop: 6 }} />
        </div>
      </Bg>
    </SceneFade>
  );
};

// ---------- 3 · the mark (draw-svg-trace); the dot is kept for the last scene ----------

const RING = "M25.487 15.503A9.5 9.5 0 1 1 16.497 6.513";
const RING_LEN = 44.77; // 270° of r = 9.5

export const Ring: React.FC<{ size: number; draw: number; dot?: number; dotY?: number; glow?: number }> = ({ size, draw, dot = 0, dotY = 0, glow = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ overflow: "visible" }}>
    <path d={RING} fill="none" stroke={T.fg} strokeWidth={4.4} strokeLinecap="round" opacity={draw < 0.04 ? 0 : 1} strokeDasharray={RING_LEN} strokeDashoffset={RING_LEN * (1 - draw)} />
    {dot > 0 ? (
      <circle cx={22.718} cy={9.282 + dotY} r={2.7 * dot} fill={T.tape} style={{ filter: glow ? `drop-shadow(0 0 ${glow}px rgba(242,190,34,0.8))` : undefined }} />
    ) : null}
  </svg>
);

export const Ayto: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 960 - 130, top: 230, transform: `scale(${0.94 + 0.06 * ramp(f, 4, 50)})` }}>
          <Ring size={260} draw={ramp(f, 6, 48, 0, 1, INOUT)} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center" }}>
          <Rise text="AYTO" at={36} size={120} spacing={0.04} />
          <Rise text="an agent with taste" at={50} size={36} weight={400} color={T.soft} stagger={2} style={{ marginTop: 18 }} />
        </div>
      </Bg>
    </SceneFade>
  );
};

// ---------- 4 · the sentence and what Qloo found (hashtag-to-pill-materialize) ----------

const SENTENCE = "I'm making a crime short film in London.";

export const Compose: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const empty = cut("compose", "empty");
  const confirm = cut("confirm", "confirm");
  const k = 1.3;
  const left = 960 - (empty.w * k) / 2;
  const typed = Math.floor(interpolate(f, [16, 74], [0, SENTENCE.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = f < 80 ? (Math.floor(f / 8) % 2 === 0 ? 1 : 0.2) : 0;
  const c = ramp(f, 92, 116);
  const wipe = ramp(f, 92, 124, 0, 100, INOUT);
  const lift = ramp(f, 86, 104);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ transform: `scale(${1 + 0.035 * ramp(f, 0, dur, 0, 1, INOUT)}) translateY(${-60 * lift}px)`, transformOrigin: "960px 540px" }}>
          <Shot c={empty} scale={k} style={{ left, top: 190 }}>
            {/* the textarea's own placeholder, covered so only the typed sentence shows */}
            <div style={{ position: "absolute", left: 8, top: 36, width: 900, height: 44, background: "rgb(27,26,26)" }} />
            <div style={{ position: "absolute", left: 16, top: 29 + 14.4, fontFamily, fontSize: 20, lineHeight: "28px", color: T.fg, whiteSpace: "pre" }}>
              {SENTENCE.slice(0, typed)}
              <span style={{ opacity: caret, color: T.fg }}>|</span>
            </div>
          </Shot>
          <div
            style={{
              position: "absolute", left, top: 190 + empty.h * k + 34, opacity: c,
              transform: `translateY(${(1 - c) * 40}px)`, filter: `blur(${(1 - c) * 8}px)`,
              clipPath: `inset(0 ${100 - wipe}% 0 0 round 18px)`,
            }}
          >
            <Shot c={confirm} scale={k} style={{ position: "relative" }} />
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- 5 · Qloo reads the city (ai-stream-response) ----------

export const Evidence: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const tabs = cut("evidence", "tabs");
  const resolve = cut("evidence", "resolve");
  const read = cut("evidence", "read");
  const trace = cut("evidence", "trace");
  const k = 1.12;
  const land = (at: number) => ({ o: ramp(f, at, at + 16), y: (1 - ramp(f, at, at + 20)) * 50 });
  const a = land(10), b = land(34), cR = land(64), d = land(20);
  const scroll = interpolate(f, [30, dur], [0, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: INOUT });
  const yaw = interpolate(f, [0, dur], [-7, -2]);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 150, top: 64 }}>
          <Rise text="London  vs  the UK  vs  Glasgow · Liverpool · Leeds" at={24} size={42} weight={700} stagger={2} />
        </div>
        <AbsoluteFill style={{ perspective: 2200 }}>
          <AbsoluteFill style={{ transform: `rotateY(${yaw}deg)`, transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", left: 150, top: 150, opacity: a.o, transform: `translateY(${a.y}px)` }}>
              <Shot c={tabs} scale={k} radius={14} style={{ position: "relative" }} />
            </div>
            <div style={{ position: "absolute", left: 150, top: 250, opacity: b.o, transform: `translateY(${b.y}px)` }}>
              <Shot c={resolve} scale={k} style={{ position: "relative" }} />
            </div>
            <div style={{ position: "absolute", left: 150, top: 250 + resolve.h * k + 24, opacity: cR.o, transform: `translateY(${cR.y}px)` }}>
              <Shot c={read} scale={k} clipH={330} style={{ position: "relative" }} />
            </div>
            <div style={{ position: "absolute", left: 1010, top: 150, width: trace.w * 1.55, height: 800, opacity: d.o, transform: `translateY(${d.y}px)`, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)", background: T.card }}>
              <div style={{ position: "relative", zIndex: 2, background: T.card, padding: "18px 24px", fontSize: 26, fontWeight: 700, borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between" }}>
                <span>Receipts</span>
                <span style={{ color: T.soft, fontVariantNumeric: "tabular-nums" }}>Qloo · 45 requests</span>
              </div>
              <div style={{ position: "absolute", top: 70, left: 0, transform: `translateY(${-scroll}px)` }}>
                <Img src={staticFile(`textures/${trace.file}`)} style={{ width: trace.w * 1.55, height: trace.h * 1.55, display: "block" }} />
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: `linear-gradient(180deg, rgba(20,20,23,0), ${T.card})` }} />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- 6 · the gap (dashboard-glow-highlight-pill + odometer-digit-roll) ----------

// The three lane bars inside the captured gap card, in CSS px (measured from evidence-gap.png).
const BARS = [
  { y: 153, end: 347, at: 18 },
  { y: 298, end: 325, at: 64 },
  { y: 443, end: 325, at: 106 },
];
const BAR_X0 = 39, BAR_X1 = 578.5, BAR_H = 14.5;
const LANE1 = { x: 23, y: 101, w: 572, h: 130, r: 14 };

const CountDown: React.FC<{ f: number; from: number; at: number; land: number }> = ({ f, from, at, land }) => {
  const size = 300, lineH = size * 1.05;
  const t = interpolate(f, [at, land], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const nums = Array.from({ length: from + 1 }, (_, i) => from - i);
  const done = f >= land;
  const punch = done ? 1 + 0.12 * (1 - ramp(f, land, land + 14)) : 1;
  return (
    <div style={{ height: lineH, overflow: "hidden", transform: `scale(${punch})`, transformOrigin: "left center" }}>
      <div style={{ transform: `translateY(${-t * from * lineH}px)` }}>
        {nums.map((n) => (
          <div key={n} style={{ height: lineH, fontSize: size, lineHeight: `${lineH}px`, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em", color: n === 0 && done ? T.tape : T.fg, textShadow: n === 0 && done ? `0 0 ${40 * (1 - ramp(f, land, land + 40, 0, 0.6))}px rgba(242,190,34,0.55)` : undefined }}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Gap: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const gap = cut("evidence", "gap");
  const k = 1.42;
  const rise = ramp(f, 0, 14);
  const pitch = interpolate(rise, [0, 1], [30, 4]);
  const yaw = interpolate(f, [0, dur], [-8, 3], { easing: INOUT });
  const outline = ramp(f, 148, 186, 0, 1, EASE);
  const panel = ramp(f, 140, 160);
  return (
    <SceneFade dur={dur} inF={4}>
      <Bg>
        <AbsoluteFill style={{ perspective: 1800 }}>
          <div
            style={{
              position: "absolute", left: 150, top: 150, opacity: rise,
              transform: `rotateX(${pitch}deg) rotateY(${yaw}deg) scale(${1.12 - 0.12 * rise})`, transformOrigin: "50% 30%",
            }}
          >
            <Shot c={gap} scale={k} clipH={595} style={{ position: "relative" }}>
              {BARS.map((b, i) => {
                const p = ramp(f, b.at, b.at + 24, 0, 1, EASE);
                const left = BAR_X0 + (b.end - BAR_X0) * p;
                return <div key={i} style={{ position: "absolute", left: left - (p > 0.02 ? 0 : 2), top: b.y - 2, width: BAR_X1 - left + 4, height: BAR_H + 4, background: "rgb(50,51,49)", borderRadius: p > 0.02 ? "0 8px 8px 0" : 8 }} />;
              })}
              <svg style={{ position: "absolute", left: LANE1.x - 3, top: LANE1.y - 3, overflow: "visible" }} width={LANE1.w + 6} height={LANE1.h + 6}>
                <rect x={1.5} y={1.5} width={LANE1.w + 3} height={LANE1.h + 3} rx={LANE1.r + 2} fill="none" stroke={T.tape} strokeWidth={2.5 - outline} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} style={{ filter: `drop-shadow(0 0 ${8 * (1 - outline * 0.6)}px rgba(242,190,34,0.8))` }} opacity={outline > 0 ? 1 : 0} />
              </svg>
            </Shot>
          </div>
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 1160, top: 250, width: 640, opacity: panel, transform: `translateY(${(1 - panel) * 30}px)` }}>
          <div style={{ fontSize: 34, fontWeight: 600, color: T.soft, lineHeight: 1.3 }}>Recent crime films in London's picks that carry these lanes</div>
          <CountDown f={f} from={17} at={160} land={238} />
          <div style={{ fontSize: 34, color: T.soft, opacity: ramp(f, 244, 260), marginTop: 10 }}>17 recent crime titles read · 0 carry them</div>
        </div>
      </Bg>
    </SceneFade>
  );
};

// ---------- 7 · loved here, under-served (outline-word-fill) ----------

export const GapCard: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const stroke = ramp(f, 0, 18);
  const fill = ramp(f, 16, 42, 0, 100, INOUT);
  const word: React.CSSProperties = { fontSize: 230, fontWeight: 800, letterSpacing: "0.02em", lineHeight: 1 };
  return (
    <SceneFade dur={dur} inF={2}>
      <Bg glow={0.6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", opacity: stroke, transform: `scale(${1.04 - 0.04 * stroke})` }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ ...word, color: "transparent", WebkitTextStroke: `3px ${T.tape}` }}>THE GAP</div>
            <div style={{ ...word, position: "absolute", inset: 0, color: T.tape, clipPath: `inset(0 ${100 - fill}% 0 0)` }}>THE GAP</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 610, textAlign: "center" }}>
          <Rise text="loved here, under-served" at={50} size={56} weight={400} color={T.soft} stagger={3} />
        </div>
      </Bg>
    </SceneFade>
  );
};

export { Pill };
