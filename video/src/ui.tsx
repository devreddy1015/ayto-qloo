// Shared pieces: the app's tokens, easing, the background, captured cutouts and type.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Archivo";
import layout from "./layout.json";

export const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

/** The app's own tokens (public/styles.css). Yellow means only the gap. */
export const T = {
  bg: "#0b0b0d",
  fg: "#f5f5f7",
  soft: "#b6b6be",
  mute: "#8f8f99",
  line: "rgba(255,255,255,0.10)",
  card: "#141417",
  tape: "#f2be22",
  tapeDeep: "#d9a70f",
  link: "#b9c3ff",
};

/** Motion tokens: calm and precise. Entrances decelerate, nothing overshoots unless it lands. */
export const EASE = Easing.bezier(0, 0, 0.2, 1);
export const CAM = Easing.bezier(0.33, 0, 0.15, 1);
export const INOUT = Easing.bezier(0.45, 0, 0.55, 1);

export const ramp = (f: number, a: number, b: number, from = 0, to = 1, easing = EASE) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

type Cut = { file: string; x: number; y: number; w: number; h: number };
const L = layout as unknown as Record<string, { cutouts: Record<string, Cut> }>;
/** A captured element: its file and its CSS size (the PNG is 2x). */
export const cut = (page: string, name: string): Cut => L[page].cutouts[name];

export const Bg: React.FC<{ children?: React.ReactNode; glow?: number }> = ({ children, glow = 1 }) => (
  <AbsoluteFill style={{ backgroundColor: T.bg, fontFamily, color: T.fg }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 70% 60% at 50% 42%, rgba(255,255,255,${0.045 * glow}) 0%, rgba(255,255,255,0) 70%)`,
      }}
    />
    {children}
  </AbsoluteFill>
);

/** Fades a scene in and out over its own length, so cuts between scenes are soft. */
export const SceneFade: React.FC<{ dur: number; inF?: number; outF?: number; children: React.ReactNode }> = ({ dur, inF = 8, outF = 8, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(ramp(f, 0, inF), 1 - ramp(f, dur - outF, dur));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** A cutout at its CSS size, in a rounded frame with the app's thin border. */
export const Shot: React.FC<{ c: Cut; style?: React.CSSProperties; radius?: number; scale?: number; children?: React.ReactNode; clipH?: number }> = ({ c, style, radius = 18, scale = 1, children, clipH }) => (
  <div
    style={{
      position: "absolute",
      width: c.w * scale,
      height: (clipH ?? c.h) * scale,
      borderRadius: radius,
      overflow: "hidden",
      boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
      ...style,
    }}
  >
    <div style={{ position: "absolute", left: 0, top: 0, width: c.w, height: c.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      <Img src={staticFile(`textures/${c.file}`)} style={{ width: c.w, height: c.h, display: "block" }} />
      {children}
    </div>
    {/* a cropped card fades out at the bottom, so no line of text is cut in half */}
    {clipH && clipH < c.h ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70 * scale, background: "linear-gradient(180deg, rgba(20,20,23,0), rgba(20,20,23,1))" }} /> : null}
  </div>
);

/** A title that rises out of a blur, word by word (blur-slide / type-entrance). */
export const Rise: React.FC<{ text: string; at: number; size?: number; weight?: number; color?: string; stagger?: number; style?: React.CSSProperties; spacing?: number }> = ({
  text, at, size = 64, weight = 800, color = T.fg, stagger = 3, style, spacing = -0.02,
}) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontSize: size, fontWeight: weight, letterSpacing: `${spacing}em`, lineHeight: 1.08, color, ...style }}>
      {words.map((w, i) => {
        const t = ramp(f, at + i * stagger, at + i * stagger + 18);
        return (
          <span key={i} style={{ display: "inline-block", opacity: t, filter: `blur(${(1 - t) * 10}px)`, transform: `translateY(${(1 - t) * 26}px)`, marginRight: "0.26em" }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** A pill like the app's chips. */
export const Pill: React.FC<{ children: React.ReactNode; tone?: "plain" | "tape" | "dim"; size?: number; style?: React.CSSProperties }> = ({ children, tone = "plain", size = 30, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      padding: `${size * 0.36}px ${size * 0.7}px`,
      borderRadius: 999,
      fontSize: size,
      fontWeight: 600,
      background: tone === "tape" ? "rgba(242,190,34,0.12)" : "rgba(255,255,255,0.05)",
      border: `1.5px solid ${tone === "tape" ? T.tape : tone === "dim" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.16)"}`,
      color: tone === "dim" ? T.mute : T.fg,
      ...style,
    }}
  >
    {children}
  </div>
);

/** The app's receipt tag, drawn small after a name. */
export const QTag: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <span style={{ fontSize: size, fontWeight: 700, letterSpacing: "0.06em", color: T.link, border: `1.5px solid ${T.link}`, borderRadius: 6, padding: "1px 6px" }}>QLOO</span>
);
