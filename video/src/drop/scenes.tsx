// The drop-led video's own scenes: Los Angeles' gap, look, brief, receipts and studio. The rest of the film reuses
// the shared scenes with the drop's props. Card coordinates are CSS px measured on the la-* captures.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Ayto, Compose, Evidence, GapCard, Guess, Question } from "../scenes-a";
import { Outro } from "../scenes-b";
import { Formats, Mcp, Pointer, type FormatCard } from "../scenes-c";
import { Bg, CAM, EASE, INOUT, Pill, QTag, ramp, Rise, SceneFade, Shot, T, cut } from "../ui";

type P = { dur: number };

export const DGuess: React.FC<P> = ({ dur }) => <Guess dur={dur} title="Every drop starts with a guess." />;
export const DQuestion: React.FC<P> = ({ dur }) => <Question dur={dur} lines={["Which kind of streetwear", "is L.A. missing?"]} />;
export const DAyto = Ayto;
export const DCompose: React.FC<P> = ({ dur }) => <Compose dur={dur} sentence="I'm making a streetwear drop in Los Angeles." confirmPage="la-confirm" />;
export const DEvidence: React.FC<P> = ({ dur }) => <Evidence dur={dur} page="la-evidence" title="Los Angeles  vs  the US  vs  Houston · Phoenix · Philadelphia" count={40} />;
export const DCard = GapCard;
export const DMcp = Mcp;
export const DOutro: React.FC<P> = ({ dur }) => (
  <Outro dur={dur} lane="Visual Arts +22" palette={["#e8e2d6", "#1f1f21", "#c9b79c", "#5a1a1f"]} chipPage="la-brief" thumb="la-style3.png" trace="16 of 16 trace" />
);

const CARDS: FormatCard[] = [
  { page: "brief", label: "Crime film · London", at: 72, cropY: 515 },
  { page: "vegas", label: "Reel · Las Vegas", at: 116 },
  { page: "night-brief", label: "Live night · Chicago", at: 162 },
  { page: "game-brief", label: "Indie game · Seattle", at: 216 },
  { page: "cafe-brief", label: "Café · Austin", at: 267 },
];
export const DFormats: React.FC<P> = ({ dur }) => <Formats dur={dur} cards={CARDS} />;

// ---------- the gap: three lanes, ranked here and absent from the country's top 30 ----------

const BARS = [
  { y: 131, end: 432.5, at: 15 },
  { y: 276, end: 400.5, at: 40 },
  { y: 421, end: 378.5, at: 73 },
];
const LANES = [
  { name: "Visual Arts", rank: 9, box: { x: 17, y: 78, w: 583, h: 132 } },
  { name: "Skate Punk", rank: 11, box: { x: 17, y: 223, w: 583, h: 132 } },
  { name: "Alternative Dance", rank: 12, box: { x: 17, y: 368, w: 583, h: 132 } },
];

export const DGap: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const gap = cut("la-evidence", "gap");
  const k = 1.32;
  const rise = ramp(f, 0, 14);
  const yaw = interpolate(f, [0, dur], [-8, 3], { easing: INOUT });
  const lane = f < 40 ? 0 : f < 73 ? 1 : 2;
  const box = LANES[lane].box;
  const hl = ramp(f, 15, 24);
  return (
    <SceneFade dur={dur} inF={4}>
      <Bg>
        <AbsoluteFill style={{ perspective: 1800 }}>
          <div style={{ position: "absolute", left: 120, top: 140, opacity: rise, transform: `rotateX(${interpolate(rise, [0, 1], [30, 4])}deg) rotateY(${yaw}deg) scale(${1.12 - 0.12 * rise})`, transformOrigin: "50% 30%" }}>
            <Shot c={gap} scale={k} clipH={520} style={{ position: "relative" }}>
              {BARS.map((b, i) => {
                const p = ramp(f, b.at, b.at + 22, 0, 1, EASE);
                const left = 39 + (b.end - 39) * p;
                return <div key={i} style={{ position: "absolute", left: left - (p > 0.02 ? 0 : 2), top: b.y - 2, width: 576.5 - left + 4, height: 18.5, background: "rgb(48,48,49)", borderRadius: p > 0.02 ? "0 8px 8px 0" : 8 }} />;
              })}
              <div style={{ position: "absolute", left: box.x - 3, top: box.y - 3, width: box.w + 6, height: box.h + 6, borderRadius: 16, border: `2.5px solid ${T.tape}`, boxShadow: "0 0 14px rgba(242,190,34,0.55)", opacity: hl * (1 - ramp(f, 110, 124)), transition: "none" }} />
            </Shot>
          </div>
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 1040, top: 210, width: 780, opacity: ramp(f, 108, 122) }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.25fr", rowGap: 26, alignItems: "baseline" }}>
            <div />
            <div style={{ fontSize: 30, fontWeight: 700 }}>Los Angeles</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: f >= 171 ? T.fg : T.mute, transition: "none" }}>United States</div>
            {LANES.map((l, i) => {
              const r = ramp(f, 115 + i * 9, 131 + i * 9);
              const us = ramp(f, 206 + i * 6, 218 + i * 6);
              return (
                <React.Fragment key={l.name}>
                  <div style={{ fontSize: 34, fontWeight: 600, color: T.soft, opacity: r }}>{l.name}</div>
                  <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.03em", opacity: r, transform: `translateY(${(1 - r) * 20}px)` }}>#{l.rank}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: T.tape, opacity: us, transform: `scale(${1 + 0.15 * (1 - us)})`, transformOrigin: "0 50%" }}>not in its top 30</div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ marginTop: 40, fontSize: 30, color: T.soft, opacity: ramp(f, 232, 248) }}>Specific to L.A. against Houston, Phoenix and Philadelphia (+19 to +22)</div>
        </div>
      </Bg>
    </SceneFade>
  );
};

// ---------- the look: aesthetics, materials against the country, what the crowd cares less about ----------

const LEANS = [
  { name: "Unique Silhouettes", lift: "+28", at: 49 },
  { name: "High Fashion", lift: "+27", at: 90 },
  { name: "Artisanal", lift: "+27", at: 125 },
];
const MATERIALS = [
  { name: "Silk", city: 44, country: 12, at: 152 },
  { name: "Leather", city: 44, country: 14, at: 164 },
];

export const DLook: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const look = cut("la-evidence", "look");
  const enter = ramp(f, 0, 18);
  const W = 560;
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 120, top: 96 }}>
          <Rise text="The look L.A.'s streetwear crowd leans to" at={6} size={44} weight={700} stagger={2} />
        </div>
        <div style={{ position: "absolute", left: 120, top: 186, display: "flex", flexDirection: "column", gap: 18 }}>
          {LEANS.map((p, i) => {
            const t = ramp(f, p.at, p.at + 18);
            const bob = Math.sin((f + i * 17) / 26) * 4 * t;
            return (
              <div key={p.name} style={{ opacity: t, transform: `translateY(${(1 - t) * 36 + bob}px)`, filter: `blur(${(1 - t) * 8}px)` }}>
                <Pill size={38}>{p.name} <QTag size={17} /> <span style={{ color: T.soft, fontWeight: 400 }}>{p.lift}</span></Pill>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 120, top: 470, width: 820, opacity: ramp(f, 146, 160) }}>
          <div style={{ fontSize: 26, color: T.soft, marginBottom: 18 }}>Share of the labels L.A. favours · the country's</div>
          {MATERIALS.map((m) => {
            const g = ramp(f, m.at, m.at + 22, 0, 1, EASE);
            return (
              <div key={m.name} style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "center", rowGap: 8, marginBottom: 22 }}>
                <div style={{ fontSize: 34, fontWeight: 700 }}>{m.name}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ height: 22, width: (W * m.city * g) / 44, borderRadius: 6, background: T.fg }} />
                    <span style={{ fontSize: 26, fontWeight: 700, opacity: g }}>{m.city}%</span>
                    <span style={{ fontSize: 26, color: T.soft, opacity: ramp(f, 183, 196), marginLeft: 10 }}>{(m.city / m.country).toFixed(1)}×</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                    <div style={{ height: 14, width: (W * m.country * g) / 44, borderRadius: 5, background: "rgba(255,255,255,0.28)" }} />
                    <span style={{ fontSize: 22, color: T.mute, opacity: g }}>{m.country}% in the US</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 120, top: 830, display: "flex", gap: 18 }}>
          {[{ n: "Polished", at: 229 }, { n: "Colorful", at: 260 }].map((p) => {
            const t = ramp(f, p.at, p.at + 14);
            const sink = ramp(f, p.at + 14, p.at + 40, 0, 1, INOUT);
            return (
              <div key={p.n} style={{ opacity: t * (1 - 0.45 * sink), transform: `translateY(${sink * 18}px)` }}>
                <Pill size={30} tone="dim"><span style={{ textDecoration: sink > 0.4 ? "line-through" : "none" }}>{p.n}</span> −8pt</Pill>
              </div>
            );
          })}
        </div>
        <AbsoluteFill style={{ perspective: 2000 }}>
          <div style={{ position: "absolute", left: 1090, top: 150, opacity: enter, transform: `rotateY(${interpolate(f, [0, dur], [-14, -6])}deg) translateX(${(1 - enter) * 80}px)`, transformOrigin: "0 50%" }}>
            <Shot c={look} scale={1.12} clipH={640} style={{ position: "relative" }} />
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- the brief: two framings of the write card, a frame moving on the words ----------

export const DBrief: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const w = cut("la-brief", "write");
  const z = 1.12;
  const cy = interpolate(f, [0, 175, 200, dur], [470, 470, 920, 920], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAM });
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: w.w, height: w.h, transform: `translate(${960 - (w.w / 2) * z}px, ${540 - cy * z}px) scale(${z})`, transformOrigin: "0 0", opacity: ramp(f, 0, 14) }}>
            <Img src={staticFile(`textures/${w.file}`)} style={{ width: w.w, height: w.h, display: "block", borderRadius: 18 }} />
            <Pointer
              f={f}
              stops={[
                { at: 78, x: 12, y: 86, w: 938, h: 150 },
                { at: 115, x: 12, y: 466, w: 938, h: 318 },
                { at: 146, x: 12, y: 314, w: 938, h: 150 },
                { at: 167, x: 12, y: 784, w: 938, h: 120 },
                { at: 205, x: 12, y: 982, w: 938, h: 78 },
              ]}
            />
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,13,0.85) 0%, rgba(11,11,13,0) 10%, rgba(11,11,13,0) 84%, rgba(11,11,13,0.9) 100%)" }} />
      </Bg>
    </SceneFade>
  );
};

// ---------- a receipt, then with vs without Qloo ----------

export const DDiff: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const chip = cut("la-brief", "chips1");
  const receipt = cut("la-receipt", "item");
  const diff = cut("la-brief", "diff");
  const lift = ramp(f, 6, 22);
  const open = ramp(f, 28, 52, 0, 1, EASE);
  const partA = 1 - ramp(f, 84, 96);
  const partB = ramp(f, 90, 106);
  const k = 1.06, clip = 500;
  const colX = 519, colW = diff.w * k - colX - 20;
  const sweep = ramp(f, 100, 146, 0, 1, INOUT);
  const counts = ramp(f, 146, 166);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ opacity: partA }}>
          <div style={{ position: "absolute", left: 150, top: 120 }}>
            <Rise text="Every name → the Qloo request it came from" at={4} size={44} weight={700} stagger={2} />
          </div>
          <div style={{ position: "absolute", left: 230, top: 500 - lift * 30, opacity: 1 - open * 0.4, transform: `scale(${3.4 + lift * 0.15})`, transformOrigin: "0 50%", filter: `drop-shadow(0 ${lift * 20}px ${lift * 30}px rgba(0,0,0,0.6))` }}>
            <Img src={staticFile(`textures/${chip.file}`)} style={{ width: chip.w, height: chip.h, display: "block" }} />
          </div>
          <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
            <path d="M 700 500 C 820 500, 880 520, 1000 520" fill="none" stroke={T.link} strokeWidth={2.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ramp(f, 22, 40)} opacity={ramp(f, 22, 26)} />
          </svg>
          <div style={{ position: "absolute", left: 1010, top: 200, opacity: open, transform: `scale(${0.55 + 0.45 * open}) translateX(${(1 - open) * -200}px)`, transformOrigin: "0 40%", filter: `blur(${(1 - open) * 10}px)` }}>
            <Shot c={receipt} scale={2.1} style={{ position: "relative" }} />
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ opacity: partB }}>
          <div style={{ position: "absolute", left: 960 - (diff.w * k) / 2, top: 90, transform: `translateY(${(1 - partB) * 40}px)` }}>
            <Shot c={diff} scale={k} clipH={clip} style={{ position: "relative" }} />
            <div style={{ position: "absolute", left: colX, top: 118, width: colW * sweep, height: 380, backdropFilter: sweep > 0 ? "grayscale(1) brightness(0.55)" : undefined, opacity: sweep > 0 ? 1 : 0 }} />
            <div style={{ position: "absolute", left: 40, top: clip * k + 40, opacity: counts, transform: `translateY(${(1 - counts) * 20}px)` }}>
              <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>16 of 16</div>
              <div style={{ fontSize: 30, color: T.soft, marginTop: 8 }}>names trace to Qloo</div>
            </div>
            <div style={{ position: "absolute", left: colX + 12, top: clip * k + 40, opacity: counts, transform: `translateY(${(1 - counts) * 20}px)` }}>
              <div style={{ fontSize: 110, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: T.mute }}>2 of 10</div>
              <div style={{ fontSize: 30, color: T.mute, marginTop: 8 }}>without Qloo: guesses</div>
            </div>
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- the studio: the concept image, every style in 3D, the drawn print ----------

const STYLES = [
  { file: "la-style1.png", at: 30 },
  { file: "la-style4.png", at: 86 },
  { file: "la-style2.png", at: 116 },
  { file: "la-style3.png", at: 160 },
];

export const DMake: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const img = cut("la-make", "image");
  const still = ramp(f, 6, 30);
  const VW = 820, VH = (VW * 600) / 963;
  const push = ramp(f, 172, 250, 0, 1, INOUT);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 110, top: 70 }}>
          <Rise text="Make it · the studio" at={4} size={44} weight={700} stagger={2} />
        </div>
        <div style={{ position: "absolute", left: 110, top: 170, opacity: still, transform: `scale(${0.96 + 0.04 * still})` }}>
          <Shot c={img} scale={0.86} clipH={640} style={{ position: "relative" }} />
          <div style={{ marginTop: 16, fontSize: 26, color: T.soft, opacity: ramp(f, 30, 44) }}>Concept image, drawn from the brief: no real place, product or person</div>
        </div>
        <AbsoluteFill style={{ perspective: 1600 }}>
          <div style={{ position: "absolute", left: 1000, top: 170, width: VW, height: VH, opacity: ramp(f, 24, 40), transform: `rotateY(${-10 + Math.sin(f / 38) * 7}deg)`, borderRadius: 18, overflow: "hidden" }}>
            {STYLES.map((st, i) => {
              const next = STYLES[i + 1]?.at ?? 9999;
              const o = i === 0 ? 1 - ramp(f, next, next + 10) : Math.min(ramp(f, st.at, st.at + 10), 1 - ramp(f, next, next + 10));
              return (
                <div key={st.file} style={{ position: "absolute", inset: 0, opacity: o, transform: i === 3 ? `scale(${1 + 0.4 * push})` : undefined, transformOrigin: "50% 42%" }}>
                  <Img src={staticFile(`textures/${st.file}`)} style={{ width: VW, height: VH, display: "block" }} />
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 1000, top: 170 + VH + 20, width: VW, textAlign: "center", fontSize: 26, color: T.soft, opacity: ramp(f, 176, 190) }}>
            The print, drawn by OpenAI from the style's cues: original art
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};
