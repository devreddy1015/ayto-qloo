// Scenes 12–16: where to make it, a Las Vegas reel, a Paris drop, five more formats, the MCP door.
// The voice lines here are single clips; the frame numbers in each scene are their phrase starts, read from the
// clips' own pauses (ffmpeg silencedetect), plus the clip's offset in timeline.ts.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Bg, EASE, INOUT, Pill, ramp, Rise, SceneFade, Shot, T, cut } from "./ui";

// ---------- 12 · where should I make it? (radial-wave) ----------

export const Where: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const map = cut("where", "map");
  const mk = 1.85, rowW = 898, rowH = 250, rk = 1.1;
  const mapIn = ramp(f, 4, 24);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 50, textAlign: "center" }}>
          <Rise text="Not sure where? Compare 10 cities." at={6} size={58} stagger={3} />
        </div>
        <div style={{ position: "absolute", left: 960 - (map.w * mk) / 2, top: 150, opacity: mapIn, transform: `translateY(${(1 - mapIn) * 30}px)` }}>
          <Shot c={map} scale={mk} style={{ position: "relative" }}>
            {[0, 1, 2].map((i) => {
              const p = (((f - 20 - i * 18) % 60) + 60) % 60 / 60;
              const on = f > 20 + i * 18;
              return <div key={i} style={{ position: "absolute", left: 440 - 400 * p, top: 194 - 400 * p, width: 800 * p, height: 800 * p, borderRadius: "50%", border: `2px solid rgba(242,190,34,${on ? 0.5 * (1 - p) : 0})` }} />;
            })}
          </Shot>
        </div>
        <div style={{ position: "absolute", left: 960 - (rowW * rk) / 2, top: 150 + map.h * mk + 26, width: rowW * rk, height: rowH * rk, opacity: ramp(f, 40, 60), transform: `translateY(${(1 - ramp(f, 40, 64)) * 30}px)`, borderRadius: 14, overflow: "hidden" }}>
          <Img src={staticFile("textures/where-row2.png")} style={{ width: rowW * rk, height: rowH * rk, display: "block" }} />
        </div>
      </Bg>
    </SceneFade>
  );
};

/** A white frame that moves between boxes of a card (page space), for "this part, then this part". */
const Pointer: React.FC<{ f: number; stops: { at: number; x: number; y: number; w: number; h: number }[] }> = ({ f, stops }) => {
  if (f < stops[0].at) return null;
  let a = stops[0], b = stops[0];
  for (let i = 0; i < stops.length; i++) if (f >= stops[i].at) { a = stops[Math.max(0, i - 1)]; b = stops[i]; }
  const t = ramp(f, b.at, b.at + 12, 0, 1, EASE);
  const L = (k: "x" | "y" | "w" | "h") => a[k] + (b[k] - a[k]) * t;
  return (
    <div style={{ position: "absolute", left: L("x"), top: L("y"), width: L("w"), height: L("h"), borderRadius: 12, border: "2px solid rgba(245,245,247,0.9)", boxShadow: "0 0 0 9999px rgba(11,11,13,0.35)", opacity: ramp(f, stops[0].at, stops[0].at + 8) }} />
  );
};

// ---------- 13 · a reel in Las Vegas ----------

export const Reel: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const gap = cut("vegas-gap", "gap");
  const brief = cut("vegas", "write");
  const partA = 1 - ramp(f, 180, 194);
  const partB = ramp(f, 186, 202);
  const k = 1.45;
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ opacity: partA }}>
          <div style={{ position: "absolute", left: 150, top: 110 }}>
            <Rise text="Las Vegas · a reel" at={8} size={50} stagger={3} />
            <div style={{ marginTop: 18, opacity: ramp(f, 70, 86) }}>
              <Pill size={30}>Club Like: Las Vegas #8, not in the US top 30</Pill>
            </div>
          </div>
          <AbsoluteFill style={{ perspective: 2000 }}>
            <div style={{ position: "absolute", left: 1000, top: 110, opacity: ramp(f, 4, 22), transform: `rotateY(${interpolate(f, [0, 190], [-12, -4])}deg) translateX(${(1 - ramp(f, 4, 26)) * 80}px)`, transformOrigin: "0 50%" }}>
              <Shot c={gap} scale={1.3} clipH={600} style={{ position: "relative" }} />
            </div>
          </AbsoluteFill>
          <div style={{ position: "absolute", left: 150, top: 420, width: 760, fontSize: 40, lineHeight: 1.35, fontWeight: 600, color: T.soft }}>
            <div style={{ opacity: ramp(f, 62, 78) }}><span style={{ color: T.fg }}>Club Like +23</span> · <span style={{ color: T.fg }}>Party Oriented +18</span> · Party-Like +15</div>
            <div style={{ marginTop: 24, fontSize: 32, opacity: ramp(f, 144, 160) }}>specific to Las Vegas, against control cities</div>
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ opacity: partB }}>
          <div style={{ position: "absolute", left: 960 - (brief.w * k) / 2, top: 30, transform: `translateY(${(1 - partB) * 40}px)` }}>
            {/* boxes in the card's CSS px, measured on vegas-write.png: the hook, the beats, the track, the spots */}
            <Shot c={brief} scale={k} clipH={662} style={{ position: "relative" }}>
              <Pointer
                f={f}
                stops={[
                  { at: 236, x: 12, y: 170, w: 400, h: 104 },
                  { at: 258, x: 12, y: 278, w: 940, h: 182 },
                  { at: 284, x: 12, y: 468, w: 940, h: 60 },
                  { at: 306, x: 12, y: 536, w: 940, h: 116 },
                ]}
              />
            </Shot>
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- 14 · a streetwear drop in Paris ----------

const STYLE_AT = [40, 130, 210, 290];

export const Drop: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const gap = cut("paris2", "gap");
  const look = cut("paris2", "look");
  const brief = cut("paris2-brief", "write");
  const show = (a: number, b: number) => Math.min(ramp(f, a, a + 14), 1 - ramp(f, b, b + 12));
  const sGap = show(0, 160), sLook = show(162, 262), sBrief = show(264, dur + 99);
  const sway = Math.sin(f / 38) * 7;
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 120, top: 56 }}>
          <Rise text="Paris · a streetwear drop" at={6} size={46} stagger={3} />
        </div>
        <div style={{ position: "absolute", left: 120, top: 140, opacity: sGap, transform: `translateY(${(1 - ramp(f, 0, 20)) * 40}px)` }}>
          <Shot c={gap} scale={1.18} clipH={600} style={{ position: "relative" }} />
        </div>
        <div style={{ position: "absolute", left: 120, top: 140, opacity: sLook, transform: `translateY(${(1 - ramp(f, 162, 182)) * 40}px)` }}>
          <Shot c={look} scale={1.18} clipH={600} style={{ position: "relative" }} />
        </div>
        <div style={{ position: "absolute", left: 120, top: 140, opacity: sBrief, transform: `translateY(${(1 - ramp(f, 264, 284)) * 40}px)` }}>
          <Shot c={brief} scale={0.76} clipH={1000} style={{ position: "relative" }} />
        </div>
        <AbsoluteFill style={{ perspective: 1600 }}>
          <div style={{ position: "absolute", left: 1000, top: 200, width: 820, height: 512, opacity: ramp(f, STYLE_AT[0], STYLE_AT[0] + 18), transform: `rotateY(${-10 + sway}deg) translateX(${(1 - ramp(f, 40, 64)) * 60}px)`, transformOrigin: "50% 50%" }}>
            {STYLE_AT.map((at, i) => (
              <div key={i} style={{ position: "absolute", inset: 0, opacity: i === 0 ? 1 - ramp(f, STYLE_AT[1], STYLE_AT[1] + 12) : Math.min(ramp(f, at, at + 12), i < 3 ? 1 - ramp(f, STYLE_AT[i + 1], STYLE_AT[i + 1] + 12) : 1) }}>
                <Shot c={{ file: `paris2-style${i + 1}.png`, x: 0, y: 0, w: 963, h: 600 }} scale={820 / 963} style={{ position: "relative" }} />
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 1000, top: 740, width: 820, textAlign: "center", fontSize: 30, color: T.soft, opacity: ramp(f, 300, 316) }}>Every style, in 3D, in the drop's own palette</div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

// ---------- 15 · five more formats (word-relay-filmstrip) ----------

const FORMAT_CARDS = [
  { key: "podcast", label: "Podcast · Los Angeles", at: 72 },
  { key: "cafe", label: "Café · Austin", at: 128 },
  { key: "night", label: "Live night · Chicago", at: 170 },
  { key: "novel", label: "Novel · New York", at: 226 },
  { key: "game", label: "Indie game · Seattle", at: 266 },
];

export const Formats: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const CW = 963, CH = 360, k = 1.12;
  return (
    <SceneFade dur={dur}>
      <Bg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center" }}>
          <Rise text="Same engine, any format" at={6} size={60} stagger={3} />
        </div>
        {FORMAT_CARDS.map((c, i) => {
          const next = FORMAT_CARDS[i + 1]?.at ?? 9999;
          const enter = ramp(f, c.at, c.at + 16, 0, 1, EASE);
          const leave = ramp(f, next, next + 16, 0, 1, EASE);
          const x = 960 - (CW * k) / 2 + (1 - enter) * 900 - leave * 760;
          const sc = 1 - 0.22 * leave;
          const write = cut(`${c.key}-brief`, "write");
          return (
            <div key={c.key} style={{ position: "absolute", left: x, top: 250, opacity: enter * (1 - 0.75 * leave), transform: `scale(${sc})`, transformOrigin: "100% 50%" }}>
              <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 16 }}>{c.label}</div>
              <Shot c={write} scale={k} clipH={CH} style={{ position: "relative" }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", gap: 18 }}>
          {FORMAT_CARDS.map((c, i) => (
            <Pill key={c.key} size={24} tone={f >= c.at && f < (FORMAT_CARDS[i + 1]?.at ?? 9999) ? "plain" : "dim"} style={{ opacity: ramp(f, c.at - 6, c.at + 6) }}>
              {c.label.split(" · ")[0]}
            </Pill>
          ))}
        </div>
      </Bg>
    </SceneFade>
  );
};

// ---------- 16 · the MCP door ----------

export const Mcp: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const t = ramp(f, 4, 24);
  return (
    <SceneFade dur={dur}>
      <Bg>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ opacity: t, transform: `scale(${0.92 + 0.08 * t})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
            <Pill size={64}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={T.fg} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v5" />
              </svg>
              MCP
            </Pill>
            <Rise text="Any agent can call it" at={14} size={56} weight={700} stagger={3} />
            <div style={{ fontSize: 32, color: T.soft, opacity: ramp(f, 30, 46) }}>ayto-ocx1.onrender.com/mcp</div>
          </div>
        </AbsoluteFill>
      </Bg>
    </SceneFade>
  );
};

export { INOUT };
