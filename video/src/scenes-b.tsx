// Scenes 8–13: the look, the brief, receipts and without Qloo, the studio, anywhere, the close.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { mulberry32 } from "./helpers/rand";
import { Bg, CAM, EASE, INOUT, Pill, QTag, ramp, Rise, SceneFade, Shot, T, cut } from "./ui";
import { Ring } from "./scenes-a";

// ---------- 8 · the look (floating-glossy-label-pills) ----------

const LEANS = [
  { name: "Naturalistic", lift: "+6pt", at: 64 },
  { name: "Intimate", lift: "+6pt", at: 80 },
  { name: "Documentary-like", lift: "+6pt", at: 94 },
  { name: "Gritty", lift: "+4pt", at: 108 },
];
const LESS = [
  { name: "Cinematic", lift: "−8pt", at: 132 },
  { name: "Polished", lift: "−4pt", at: 140 },
];

export const Look: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const look = cut("evidence", "look");
  const enter = ramp(f, 0, 18);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 150, top: 120 }}>
          <Rise text="The look London's crime crowd leans to" at={8} size={44} weight={700} stagger={2} />
        </div>
        <div style={{ position: "absolute", left: 150, top: 230, display: "flex", flexDirection: "column", gap: 22 }}>
          {LEANS.map((p, i) => {
            const t = ramp(f, p.at, p.at + 20);
            const bob = Math.sin((f + i * 17) / 26) * 4 * t;
            return (
              <div key={p.name} style={{ opacity: t, transform: `translateY(${(1 - t) * 40 + bob}px)`, filter: `blur(${(1 - t) * 8}px)` }}>
                <Pill size={40}>
                  {p.name} <QTag size={18} /> <span style={{ color: T.soft, fontWeight: 400 }}>{p.lift}</span>
                </Pill>
              </div>
            );
          })}
          <div style={{ height: 18 }} />
          {LESS.map((p) => {
            const t = ramp(f, p.at, p.at + 16);
            const sink = ramp(f, p.at + 20, p.at + 60, 0, 1, INOUT);
            return (
              <div key={p.name} style={{ opacity: t * (1 - 0.5 * sink), transform: `translateY(${sink * 26}px)` }}>
                <Pill size={32} tone="dim">
                  <span style={{ textDecoration: sink > 0.4 ? "line-through" : "none" }}>{p.name}</span> <span>{p.lift}</span>
                </Pill>
              </div>
            );
          })}
        </div>
        <AbsoluteFill style={{ perspective: 2000 }}>
          <div style={{ position: "absolute", left: 1000, top: 150, opacity: enter, transform: `rotateY(${interpolate(f, [0, dur], [-14, -6])}deg) translateX(${(1 - enter) * 80}px)`, transformOrigin: "0 50%" }}>
            <Shot c={look} scale={1.25} clipH={620} style={{ position: "relative" }} />
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- 9 · the brief (document-typewriter-reveal, read down the page) ----------

const BRIEF_KEYS = [
  { f: 0, cy: 330, z: 1.5 },
  { f: 90, cy: 330, z: 1.48 },
  { f: 112, cy: 610, z: 1.42 },
  { f: 142, cy: 610, z: 1.42 },
  { f: 166, cy: 1290, z: 1.3 },
  { f: 206, cy: 1290, z: 1.3 },
  { f: 230, cy: 1980, z: 1.3 },
  { f: 266, cy: 1980, z: 1.3 },
  { f: 290, cy: 2480, z: 1.34 },
  { f: 322, cy: 2480, z: 1.34 },
  { f: 342, cy: 3060, z: 1.34 },
  { f: 360, cy: 3070, z: 1.34 },
];
const STORY_LINES = 11, STORY_TOP = 160, STORY_LH = 30;

export const Brief: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const w = cut("brief", "write");
  let a = BRIEF_KEYS[0], b = BRIEF_KEYS[BRIEF_KEYS.length - 1];
  for (let i = 0; i < BRIEF_KEYS.length - 1; i++) if (f >= BRIEF_KEYS[i].f && f <= BRIEF_KEYS[i + 1].f) { a = BRIEF_KEYS[i]; b = BRIEF_KEYS[i + 1]; break; }
  const t = interpolate(f, [a.f, b.f], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAM });
  const cy = a.cy + (b.cy - a.cy) * t, z = a.z + (b.z - a.z) * t;
  const cx = w.w / 2;
  const typeT = interpolate(f, [12, 80], [0, STORY_LINES], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: w.w, height: w.h, transform: `translate(${960 - cx * z}px, ${560 - cy * z}px) scale(${z})`, transformOrigin: "0 0" }}>
            <Img src={staticFile(`textures/${w.file}`)} style={{ width: w.w, height: w.h, display: "block", borderRadius: 18 }} />
            {Array.from({ length: STORY_LINES }, (_, i) => {
              const p = Math.max(0, Math.min(1, typeT - i));
              return <div key={i} style={{ position: "absolute", left: 36 + 900 * p, top: STORY_TOP + i * STORY_LH, width: 905 - 900 * p, height: STORY_LH, background: "rgb(22,24,24)" }} />;
            })}
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,13,0.9) 0%, rgba(11,11,13,0) 14%, rgba(11,11,13,0) 80%, rgba(11,11,13,0.9) 100%)" }} />
      </Bg>
    </SceneFade>
  );
};

// ---------- 10 · a receipt, then with vs without Qloo (chip-lift-to-user-pill → before-after-slider-scrub) ----------

export const Diff: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const chip = cut("brief", "chips1");
  const receipt = cut("receipt", "item");
  const diff = cut("brief", "diff");
  const lift = ramp(f, 6, 22);
  const open = ramp(f, 28, 52, 0, 1, EASE);
  const partA = 1 - ramp(f, 92, 104);
  const partB = ramp(f, 98, 114);
  const k = 1.06;
  const sweep = ramp(f, 116, 170, 0, 1, INOUT);
  const colX = 519, colW = diff.w * k - colX - 20;
  const lineX = colX + colW * sweep;
  const counts = ramp(f, 176, 196);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ opacity: partA }}>
          <div style={{ position: "absolute", left: 150, top: 120 }}>
            <Rise text="Every name → the Qloo request it came from" at={4} size={44} weight={700} stagger={2} />
          </div>
          <div style={{ position: "absolute", left: 170, top: 500 - lift * 30, opacity: 1 - open * 0.4, transform: `scale(${3.4 + lift * 0.15})`, transformOrigin: "0 50%", filter: `drop-shadow(0 ${lift * 20}px ${lift * 30}px rgba(0,0,0,0.6))` }}>
            <Img src={staticFile(`textures/${chip.file}`)} style={{ width: chip.w, height: chip.h, display: "block" }} />
          </div>
          <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
            <path d="M 800 500 C 900 500, 900 520, 1000 520" fill="none" stroke={T.link} strokeWidth={2.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(f, 22, 40)} opacity={ramp(f, 22, 26)} />
          </svg>
          <div style={{ position: "absolute", left: 1010, top: 200, opacity: open, transform: `scale(${0.55 + 0.45 * open}) translateX(${(1 - open) * -200}px)`, transformOrigin: "0 40%", filter: `blur(${(1 - open) * 10}px)` }}>
            <Shot c={receipt} scale={2.1} style={{ position: "relative" }} />
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ opacity: partB }}>
          <div style={{ position: "absolute", left: 960 - (diff.w * k) / 2, top: 70, transform: `translateY(${(1 - partB) * 40}px)` }}>
            <Shot c={diff} scale={k} style={{ position: "relative" }} />
            {/* left of the slider: as captured; right of it: greyed, the guesses */}
            <div style={{ position: "absolute", left: colX, top: 120, width: colW * sweep, height: diff.h * k - 140, backdropFilter: sweep > 0 ? "grayscale(1) brightness(0.55)" : undefined, opacity: sweep > 0 ? 1 : 0 }} />
            <div style={{ position: "absolute", left: lineX - 1.5, top: -10, width: 3, height: diff.h * k + 20, background: T.fg, opacity: sweep > 0 && sweep < 1 ? 0.9 : 0, boxShadow: "0 0 18px rgba(255,255,255,0.6)" }} />
            <div style={{ position: "absolute", left: 40, top: 560, opacity: counts, transform: `translateY(${(1 - counts) * 20}px)` }}>
              <div style={{ fontSize: 118, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>13 of 13</div>
              <div style={{ fontSize: 30, color: T.soft, marginTop: 8 }}>names trace to Qloo</div>
            </div>
            <div style={{ position: "absolute", left: colX + 12, width: colW - 24, top: 560, padding: "18px 26px", borderRadius: 16, background: T.card, boxShadow: "0 0 0 1px rgba(255,255,255,0.08)", opacity: counts, transform: `translateY(${(1 - counts) * 20}px)` }}>
              <div style={{ fontSize: 118, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: T.mute }}>0 of 10</div>
              <div style={{ fontSize: 30, color: T.mute, marginTop: 8 }}>without Qloo: guesses</div>
            </div>
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- 11 · the studio (deck-deal-flyin → voice-waveform-live) ----------

export const Make: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const img = cut("make", "image");
  const voice = cut("make", "voice");
  const still = ramp(f, 6, 30);
  const FW = 222, FH = 148, GX = 1130, GY = 150, G = 14;
  const voiceIn = ramp(f, 150, 172);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 110, top: 150, opacity: still, transform: `scale(${0.96 + 0.04 * still})`, transformOrigin: "50% 50%" }}>
          <Shot c={img} scale={1.0} clipH={640} style={{ position: "relative" }} />
        </div>
        <div style={{ position: "absolute", left: GX, top: 92, opacity: ramp(f, 56, 72), fontSize: 30, fontWeight: 700 }}>Shot deck · a frame per beat</div>
        {Array.from({ length: 6 }, (_, i) => {
          const at = 62 + i * 7;
          const p = ramp(f, at, at + 22, 0, 1, EASE);
          const rnd = mulberry32(i * 31 + 5);
          const col = i % 3, row = Math.floor(i / 3);
          const tx = GX + col * (FW + G), ty = GY + row * (FH + G);
          const fx = 2100 + rnd() * 200, fy = 1250 + rnd() * 100;
          const x = fx + (tx - fx) * p, y = fy + (ty - fy) * p;
          const rot = (1 - p) * (18 + rnd() * 14);
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: FW, height: FH, borderRadius: 10, overflow: "hidden", transform: `rotate(${rot}deg)`, boxShadow: "0 18px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)", opacity: p > 0 ? 1 : 0 }}>
              <Img src={staticFile(`textures/deck/f${i + 1}.png`)} style={{ width: FW + 4, height: FH + 4, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", left: 8, top: 6, fontSize: 15, fontWeight: 700, textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>{i + 1}</div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: GX, top: GY + 2 * (FH + G) + 30, width: 3 * FW + 2 * G, opacity: voiceIn, transform: `translateY(${(1 - voiceIn) * 30}px)` }}>
          <Shot c={voice} scale={(3 * FW + 2 * G) / voice.w} style={{ position: "relative" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5, height: 90, marginTop: 18 }}>
            {Array.from({ length: 48 }, (_, i) => {
              const live = ramp(f, 184, 192) * (1 - ramp(f, dur - 14, dur - 4));
              const h = 8 + live * (14 + 52 * Math.abs(Math.sin(f / 3.1 + i * 0.7) * Math.sin(f / 7.3 + i * 0.31)));
              return <div key={i} style={{ width: 8, height: h, borderRadius: 4, background: i < 48 * ramp(f, 186, dur) ? T.fg : "rgba(255,255,255,0.25)" }} />;
            })}
          </div>
        </div>
      </Bg>
    </SceneFade>
  );
};

// ---------- 13 · are you the one? (outro-group-photo-launch → logo-shrink-wordmark-lockup) ----------

const PALETTE = ["#5b6770", "#3c4147", "#b5833a", "#d9d4cc", "#4f5d4a", "#8a5a48"];

export const Outro: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const chip = cut("brief", "chips1");
  const gather = ramp(f, 34, 58, 0, 1, Easing2);
  const ring = ramp(f, 44, 60);
  const drop = interpolate(f, [52, 62], [-16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
  const bounce = f >= 62 ? -1.6 * Math.sin(ramp(f, 62, 74) * Math.PI) * (1 - ramp(f, 62, 74)) : 0;
  const dot = f >= 50 ? 1 : 0;
  const glow = f >= 62 ? 14 * (1 - ramp(f, 62, 110, 0, 0.7)) : 0;
  const items: { x: number; y: number; at: number; node: React.ReactNode }[] = [
    { x: -520, y: -250, at: 0, node: <Pill tone="tape" size={34}>Autobiographical +17</Pill> },
    { x: 360, y: -280, at: 5, node: <Img src={staticFile(`textures/${chip.file}`)} style={{ width: chip.w * 2.2, height: chip.h * 2.2 }} /> },
    { x: -600, y: 140, at: 10, node: <div style={{ display: "flex", gap: 8 }}>{PALETTE.map((c) => <div key={c} style={{ width: 56, height: 56, borderRadius: 12, background: c, boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }} />)}</div> },
    { x: 420, y: 160, at: 15, node: <div style={{ width: 240, height: 160, borderRadius: 12, overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}><Img src={staticFile("textures/deck/f3.png")} style={{ width: 244, height: 164, objectFit: "cover" }} /></div> },
    { x: -120, y: 300, at: 20, node: <div style={{ display: "flex", gap: 5, alignItems: "center", height: 60 }}>{Array.from({ length: 18 }, (_, i) => <div key={i} style={{ width: 7, height: 10 + 40 * Math.abs(Math.sin(i * 0.9 + f / 4)), borderRadius: 4, background: T.fg }} />)}</div> },
    { x: -40, y: -330, at: 25, node: <Pill size={30}>13 of 13 trace</Pill> },
  ];
  return (
    <SceneFade dur={dur} outF={20}>
      <Bg>
        {items.map((it, i) => {
          const t = ramp(f, it.at, it.at + 18);
          const g = gather;
          return (
            <div key={i} style={{ position: "absolute", left: 960, top: 470, opacity: t * (1 - g), transform: `translate(-50%, -50%) translate(${it.x * (1 - g)}px, ${it.y * (1 - g) + (1 - t) * 30}px) scale(${1 - 0.7 * g})` }}>
              {it.node}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 960 - 120, top: 350, opacity: ring, transform: `scale(${0.8 + 0.2 * ring})` }}>
          <Ring size={240} draw={1} dot={dot} dotY={drop + bounce} glow={glow} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center" }}>
          <Rise text="AYTO" at={62} size={110} spacing={0.04} />
          <Rise text="Are You The One?" at={98} size={46} weight={600} stagger={3} style={{ marginTop: 10 }} />
          <Rise text="Built on what your city already loves." at={132} size={40} weight={400} color={T.soft} stagger={2} style={{ marginTop: 18 }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, textAlign: "center", fontSize: 34, color: T.soft, opacity: ramp(f, 110, 130) }}>
          Powered by Qloo's taste graph · ayto-ocx1.onrender.com · github.com/devreddy1015/ayto-qloo
        </div>
      </Bg>
    </SceneFade>
  );
};

function Easing2(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function EASE_IN(t: number) {
  return t * t * t;
}
