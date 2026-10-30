// AYTO garment viewer. A procedural mannequin and garments in Three.js, coloured
// from the drop's palette and printed from the plan. It is a preview, not a cloth
// simulation: no drape, no physics, only geometry and a canvas texture.
// Loaded lazily by app.js. `three` and OrbitControls resolve through the import
// map in index.html, one pinned version. Nothing here renders a real brand: the
// only text is the style name or the motif the plan wrote.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const GARMENTS = ["tee", "oversized_tee", "hoodie", "sweatshirt", "dress", "maxi_dress", "saree", "kurta", "jacket", "cape", "cosplay_set", "shorts", "set"];
const PRINT_TYPES = ["graphic", "stripe", "typographic", "none"];
const PLACEMENTS = ["chest", "back", "all_over", "sleeve"];
const DEFAULT_HEX = "#2b2f3a";
const MANNEQUIN_HEX = 0x8a8d96;
const LOOK_AT = new THREE.Vector3(0, 1.06, 0);
const HEX = /^#[0-9a-f]{6}$/i;
const clean = (s) => String(s ?? "").trim();

// ---------- reading a style ----------

/** The garment to build: the plan's `garment` when it is one we know, else keywords in the category and name. */
export function garmentOf(style = {}) {
  const given = clean(style.garment).toLowerCase().replace(/[\s-]+/g, "_");
  if (GARMENTS.includes(given)) return given;
  const text = `${clean(style.category)} ${clean(style.name)}`.toLowerCase();
  if (/cosplay|armou?r|pauldron|costume/.test(text)) return "cosplay_set";
  if (/\b(sarees?|saris?)\b/.test(text)) return "saree";
  if (/\b(capes?|cloaks?|capelets?)\b/.test(text)) return "cape";
  if (/maxi|gown|floor[ -]length|anarkali/.test(text)) return "maxi_dress";
  if (/\b(co-?ord|set)\b/.test(text)) return "set";
  if (/hood/.test(text)) return "hoodie";
  if (/sweat|crew ?neck|jumper|pullover/.test(text)) return "sweatshirt";
  if (/dress|frock|gown/.test(text)) return "dress";
  if (/kurt[ai]|tunic/.test(text)) return "kurta";
  if (/jacket|bomber|blazer|shacket|overshirt|coat/.test(text)) return "jacket";
  if (/shorts/.test(text)) return "shorts";
  if (/oversiz|boxy|drop(ped)?[ -]?shoulder|relaxed/.test(text)) return "oversized_tee";
  return "tee";
}

/** The print to draw: the plan's `print` when present, else words in the cues. */
export function printOf(style = {}) {
  const p = style.print;
  if (p && typeof p === "object") {
    const type = clean(p.type).toLowerCase();
    const placement = clean(p.placement).toLowerCase().replace(/[\s-]+/g, "_");
    return { type: PRINT_TYPES.includes(type) ? type : "none", placement: PLACEMENTS.includes(placement) ? placement : "chest", motif: clean(p.motif).slice(0, 40) };
  }
  const text = (style.cues ?? []).map(clean).join(" ").toLowerCase();
  const placement = /\bback\b/.test(text) ? "back" : /sleeve/.test(text) ? "sleeve" : /all[ -]?over|repeat/.test(text) ? "all_over" : "chest";
  if (/stripe|breton/.test(text)) return { type: "stripe", placement: placement === "chest" ? "all_over" : placement, motif: "" };
  if (/typograph|slogan|wordmark|letter|\btext\b/.test(text)) return { type: "typographic", placement, motif: "" };
  if (/graphic|print|logo|artwork|motif|emblem|pattern/.test(text)) return { type: "graphic", placement, motif: "" };
  return { type: "none", placement: "chest", motif: "" };
}

/**
 * How a drawn print sits on a style: "fabric" tiles it over the cloth (all-over prints, stripes, a plain style, a saree's
 * buta), "panel" places it once where the plan put the print (chest, back, sleeve).
 */
export function printModeOf(style = {}) {
  const p = printOf(style);
  return garmentOf(style) === "saree" || p.type === "none" || p.type === "stripe" || p.placement === "all_over" ? "fabric" : "panel";
}

/** A palette name to its hex; unknown names take the first palette hex; no palette, a dark default. */
export function colourOf(name, palette = []) {
  const valid = palette.filter((c) => HEX.test(clean(c?.hex)));
  const key = clean(name).toLowerCase();
  const hit = key ? valid.find((c) => clean(c.name).toLowerCase() === key) : null;
  return (hit ?? valid[0])?.hex?.toLowerCase() ?? DEFAULT_HEX;
}

/** The colourways a style offers: its own names that exist in the palette, else every palette name. */
export function colourwaysOf(style = {}, palette = []) {
  const names = palette.filter((c) => HEX.test(clean(c?.hex))).map((c) => clean(c.name)).filter(Boolean);
  const own = (style.colourways ?? []).map(clean).filter((n) => names.some((p) => p.toLowerCase() === n.toLowerCase()));
  return own.length ? own : names;
}

// ---------- colour maths ----------

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex) => {
  const [r, g, b] = rgbOf(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
const shade = (hex, k) => `#${rgbOf(hex).map((c) => Math.round(Math.min(1, Math.max(0, c * k)) * 255).toString(16).padStart(2, "0")).join("")}`;
const hash = (s) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** The palette hex that contrasts most with the base; white or ink when the palette has no contrast to give. */
function accentOf(base, palette = []) {
  const others = palette.map((c) => clean(c?.hex).toLowerCase()).filter((h) => HEX.test(h) && h !== base);
  let best = null;
  let bestRatio = 0;
  for (const h of others) {
    const ratio = contrast(base, h);
    if (ratio > bestRatio) [best, bestRatio] = [h, ratio];
  }
  if (best && bestRatio >= 1.7) return best;
  return lum(base) > 0.35 ? "#15171c" : "#f5f5f7";
}

// ---------- canvas painting ----------

const fontFor = (px) => `900 ${px}px Archivo, "Archivo", system-ui, -apple-system, sans-serif`;

function mark(ctx, cx, cy, w, h, look, seed) {
  const { type, motif } = look.print;
  const text = (motif || look.label || "").toUpperCase();
  ctx.save();
  ctx.fillStyle = look.accent;
  ctx.strokeStyle = look.accent;
  if (type === "typographic") {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = text.length > 12 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [text];
    const lineH = h / lines.length;
    let size = Math.min(lineH * 0.78, h * 0.6);
    ctx.font = fontFor(100);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width || 1));
    size = Math.min(size, (w * 0.96 * 100) / widest);
    ctx.font = fontFor(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, cx, cy - ((lines.length - 1) * lineH) / 2 + i * lineH));
  } else if (type === "stripe") {
    const bands = 5;
    const bh = h / bands;
    for (let i = 0; i < bands; i += 2) ctx.fillRect(cx - w / 2, cy - h / 2 + i * bh, w, bh);
  } else {
    const r = Math.min(w, h) / 2;
    const shape = hash(seed ?? text) % 4;
    if (shape === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = look.base;
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 1) {
      const bar = h / 5;
      for (let i = 0; i < 3; i += 1) {
        const y = cy - h / 2 + i * bar * 1.6;
        const bw = w * (1 - i * 0.22);
        ctx.beginPath();
        ctx.roundRect(cx - bw / 2, y, bw, bar, bar / 2);
        ctx.fill();
      }
    } else if (shape === 2) {
      ctx.lineWidth = r * 0.3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.1, r * 0.72, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.45, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      const s = r * 1.25;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = look.base;
      ctx.fillRect(-s * 0.22, -s * 0.22, s * 0.44, s * 0.44);
    }
  }
  ctx.restore();
}

function pattern(ctx, W, H, look) {
  if (look.print.type === "stripe") {
    const bh = H / 14;
    ctx.fillStyle = look.accent;
    for (let y = 0; y < H; y += bh * 2) ctx.fillRect(0, y, W, bh);
    return;
  }
  const tile = W / 7;
  for (let row = 0; row * tile < H + tile; row += 1) {
    for (let col = -1; col * tile < W + tile; col += 1) {
      const cx = col * tile + tile / 2 + (row % 2 ? tile / 2 : 0);
      const cy = row * tile + tile / 2;
      mark(ctx, cx, cy, tile * 0.42, tile * 0.42, look, `${look.label}-${look.print.motif}`);
    }
  }
}

function seamLine(ctx, x0, y0, x1, y1, base, width = 3, alpha = 0.45) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = shade(base, lum(base) > 0.5 ? 0.78 : 1.35);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** Tile a drawn fabric image across the canvas, about `world` metres a tile when the part knows its size. */
function fabric(ctx, W, H, img, L) {
  const tw = L.perimeter ? (0.26 / L.perimeter) * W : W / 4;
  const th = L.height ? (0.26 / L.height) * H : H / 4;
  for (let y = 0; y < H; y += th) for (let x = 0; x < W; x += tw) ctx.drawImage(img, x, y, tw + 1, th + 1);
}

/** A drawn print as a panel centred at (cx, cy) inside w×h, kept square on the body, not on the texture. */
function panel(ctx, W, H, cx, cy, w, h, img, L) {
  const ww = L.perimeter ? (w / W) * L.perimeter : 1;
  const wh = L.height ? (h / H) * L.height : 1;
  const side = Math.min(ww, wh);
  const pw = (w * side) / ww;
  const ph = (h * side) / wh;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, Math.min(pw, ph) * 0.06);
  ctx.clip();
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

/** Repaint one part's canvas for the current look. A part in the accent tone (a blouse, armour, a lining) swaps the two. */
function paint(part, baseLook) {
  const look = part.tone === "accent" ? { ...baseLook, base: baseLook.accent, accent: baseLook.base } : baseLook;
  const { canvas, ctx } = part;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = look.base;
  ctx.fillRect(0, 0, W, H);
  if (part.rib) {
    ctx.fillStyle = shade(look.base, lum(look.base) > 0.5 ? 0.9 : 1.18);
    const step = W / 16;
    for (let x = 0; x < W; x += step) ctx.fillRect(x, 0, step * 0.45, H);
    return;
  }
  const { print } = look;
  const L = part.layout ?? {};
  // A drawn fabric covers the cloth before the seams go on; armour and trims keep their own finish.
  if (look.image && look.imageMode === "fabric" && part.printable !== false && part.tone !== "accent") fabric(ctx, W, H, look.image, L);
  for (const u of L.seams ?? []) seamLine(ctx, u * W, 0, u * W, H, look.base);
  if (L.hem !== false) seamLine(ctx, 0, H * 0.985, W, H * 0.985, look.base, 4, 0.35);
  L.extra?.(ctx, W, H, look);
  if (look.image && look.imageMode === "fabric") return;
  if (look.image && look.imageMode === "panel") {
    if (part.kind !== "body") return;
    const back = print.placement === "back";
    const u = back ? L.back : L.front;
    const v = back ? L.vBack : L.vChest;
    if (u === undefined || v === undefined) return;
    panel(ctx, W, H, u * W, (1 - v) * H, (back ? L.backSpan : L.chestSpan) * W, (back ? L.backHeight : L.chestHeight) * H, look.image, L);
    return;
  }
  if (print.type === "none") return;
  if (print.placement === "all_over") {
    if (part.printable !== false) pattern(ctx, W, H, look);
    return;
  }
  if (print.placement === "sleeve") {
    if (part.kind !== "sleeve") return;
    const bandH = H * 0.26;
    const cy = H * 0.42;
    if (print.type === "stripe") {
      ctx.fillStyle = look.accent;
      for (let i = 0; i < 3; i += 1) ctx.fillRect(0, cy - bandH / 2 + (i * bandH) / 3, W, bandH / 6);
    } else {
      const n = 4;
      for (let i = 0; i < n; i += 1) mark(ctx, (W / n) * (i + 0.5), cy, (W / n) * 0.78, bandH, look, look.label);
    }
    return;
  }
  if (part.kind !== "body") return;
  const back = print.placement === "back";
  const u = back ? L.back : L.front;
  const v = back ? L.vBack : L.vChest;
  const w = (back ? L.backSpan : L.chestSpan) * W;
  const h = (back ? L.backHeight : L.chestHeight) * H;
  if (u === undefined || v === undefined) return;
  mark(ctx, u * W, (1 - v) * H, w, h, look, look.label);
}

// ---------- geometry ----------

const V2 = (r, y) => new THREE.Vector2(r, y);
const radiusAt = (keys, y) => {
  for (let i = 1; i < keys.length; i += 1) {
    const [r0, y0] = keys[i - 1];
    const [r1, y1] = keys[i];
    if (y <= y1) return y1 === y0 ? r1 : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return keys[keys.length - 1][0];
};

/** A lathe from (radius, y) keys, resampled evenly in y so the texture's v runs with height; `yoke` closes toward the neck. */
function lathe(keys, { yoke = null, phiStart = Math.PI / 2, phiLength = Math.PI * 2, steps = 24, segments = 72 } = {}) {
  const y0 = keys[0][1];
  const y1 = keys[keys.length - 1][1];
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const y = y0 + ((y1 - y0) * i) / steps;
    pts.push(V2(radiusAt(keys, y), y));
  }
  if (yoke) for (const [r, y] of yoke) pts.push(V2(r, y));
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  const n = pts.length - 1;
  const vOf = (y) => (Math.min(Math.max((y - y0) / (y1 - y0), 0), 1) * steps) / n;
  return { geo, vOf, y0, y1, height: ((y1 - y0) * n) / steps };
}

/** Folds: push a lathe's radius in and out around it, growing from `top` down to `bottom` (a skirt, a cape's hem). */
function flute(geo, { top, bottom, amp = 0.05, n = 12 }) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    if (y >= top) continue;
    const k = Math.min(1, (top - y) / Math.max(0.01, top - bottom)) ** 1.4;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const f = 1 + amp * k * Math.sin(n * Math.atan2(x, z));
    pos.setXYZ(i, x * f, y, z * f);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * A strip of cloth `width` wide along a path of [angle, y, radius] points around the body (angle 0 faces front):
 * a saree's pallu, a sash. It lies flat on the shoulder (its normal turns up there) and along the body elsewhere.
 * u runs across the strip, v along it.
 */
function ribbon(points, { width = 0.2, zs = 0.74, segments = 64 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([a, y, r]) => new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a) * zs)));
  const pos = [];
  const uv = [];
  const index = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const lift = THREE.MathUtils.smoothstep(p.y, 1.42, 1.52);
    const out = new THREE.Vector3(p.x, 0, p.z / zs).normalize().multiplyScalar(1 - lift).addScaledVector(up, lift).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, out).normalize();
    for (const j of [0, 1]) {
      const q = p.clone().addScaledVector(side, (j - 0.5) * width);
      pos.push(q.x, q.y, q.z);
      uv.push(j, t);
    }
    if (i < segments) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return { geo, length: curve.getLength() };
}

const texture = (canvas, renderer) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
};

/** A garment part: a mesh with its own canvas texture. */
function part(renderer, geo, { kind = "body", size = [1024, 1024], layout = null, rib = false, printable = true, repeat = null, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], roughness = 0.85, metalness = 0, tone = "base", side = THREE.DoubleSide } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size[0];
  canvas.height = size[1];
  const ctx = canvas.getContext("2d");
  const tex = texture(canvas, renderer);
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness, metalness, side });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, canvas, ctx, tex, kind, layout, rib, printable, tone };
}

/** A sleeve on side s (+1 right, -1 left), hanging from `top` and tilted outward. Returns the sleeve and the point at its cuff. */
function sleeve(renderer, s, { r0 = 0.1, r1 = 0.095, len = 0.22, top = [0.185, 1.43], tilt = 0.45, zs = 0.9, cuff = 0, tone = "base" } = {}) {
  const bx = top[0] + len * Math.sin(tilt);
  const by = top[1] - len * Math.cos(tilt);
  const geo = new THREE.CylinderGeometry(r0, r1, len, 36, 1, true, Math.PI / 2);
  const p = part(renderer, geo, { kind: "sleeve", tone, size: [512, 512], layout: { seams: [0.5], hem: cuff === 0 }, position: [(s * (top[0] + bx)) / 2, (top[1] + by) / 2, 0], rotation: [0, 0, s * tilt], scale: [1, 1, zs] });
  const cap = part(renderer, new THREE.SphereGeometry(r0 * 0.98, 28, 18), { kind: "cap", tone, size: [64, 64], printable: false, layout: { seams: [], hem: false }, position: [s * top[0], top[1], 0], scale: [1, 1, zs] });
  const parts = [p, cap];
  if (cuff > 0) {
    const d = len / 2 - cuff / 2;
    const cgeo = new THREE.CylinderGeometry(r1 * 0.9, r1 * 0.88, cuff, 36, 1, true, Math.PI / 2);
    parts.push(
      part(renderer, cgeo, {
        kind: "trim",
        rib: true,
        size: [256, 64],
        repeat: [12, 1],
        roughness: 0.95,
        position: [(s * (top[0] + bx)) / 2 + s * d * Math.sin(tilt), (top[1] + by) / 2 - d * Math.cos(tilt), 0],
        rotation: [0, 0, s * tilt],
        scale: [1, 1, zs],
      }),
    );
  }
  return parts;
}

/** A ribbed ring (hem band, collar, waistband). */
function ring(renderer, { r0, r1 = r0, h, y, zs = 0.72, thetaStart = Math.PI / 2, thetaLength = Math.PI * 2, rib = true, kind = "trim", tone = "base", roughness = 0.95, metalness = 0, extra = null } = {}) {
  const geo = new THREE.CylinderGeometry(r0, r1, h, 72, 1, true, thetaStart, thetaLength);
  return part(renderer, geo, { kind, rib, tone, roughness, metalness, printable: false, size: rib ? [256, 64] : [512, 128], repeat: rib ? [24, 1] : null, layout: { seams: [], hem: false, extra }, position: [0, y, 0], scale: [1, 1, zs] });
}

/** The torso of a garment: a lathe with a yoke to the neck, chest and back print regions in its texture. */
function torso(renderer, keys, { yoke = [[0.1, 1.525]], zs = 0.72, phiStart, phiLength = Math.PI * 2, chestY = 1.29, backY = 1.24, chestSpan = 0.25, backSpan = 0.3, front = 0.75, back = 0.25, seams = [0, 0.5], extra = null, markH = 0.22, folds = null, kind = "body", tone = "base", printable = true, side } = {}) {
  const { geo, vOf, height } = lathe(keys, { yoke, phiStart, phiLength });
  if (folds) flute(geo, { bottom: keys[0][1], ...folds });
  // The cloth's size on the body (an ellipse's perimeter at the chest), so a drawn print can keep its proportions.
  const rc = radiusAt(keys, chestY);
  const perimeter = (Math.PI * rc * (1 + zs) * phiLength) / (Math.PI * 2);
  const layout = { front, back, seams, extra, vChest: vOf(chestY), vBack: vOf(backY), chestSpan, backSpan, chestHeight: vOf(chestY + markH / 2) - vOf(chestY - markH / 2), backHeight: vOf(backY + markH * 0.6) - vOf(backY - markH * 0.6), vOf, perimeter, height };
  return part(renderer, geo, { kind, tone, printable, layout, scale: [1, 1, zs], ...(side === undefined ? {} : { side }) });
}

const BUILD = {
  tee(r) {
    return [torso(r, [[0.228, 0.92], [0.226, 1.1], [0.232, 1.3], [0.242, 1.44], [0.236, 1.49]]), ...sleeve(r, 1), ...sleeve(r, -1)];
  },
  oversized_tee(r) {
    const s = { r0: 0.125, r1: 0.12, len: 0.24, top: [0.225, 1.41], tilt: 0.36, zs: 0.85 };
    return [torso(r, [[0.272, 0.78], [0.266, 1.0], [0.27, 1.3], [0.28, 1.44], [0.268, 1.49]], { chestSpan: 0.24, backSpan: 0.32, chestY: 1.27 }), ...sleeve(r, 1, s), ...sleeve(r, -1, s)];
  },
  hoodie(r) {
    const s = { r0: 0.105, r1: 0.085, len: 0.46, top: [0.19, 1.43], tilt: 0.3, cuff: 0.06 };
    const pocket = new THREE.CylinderGeometry(0.262, 0.262, 0.17, 32, 1, true, -0.95, 1.9);
    const hood = new THREE.SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    return [
      torso(r, [[0.25, 0.86], [0.25, 1.05], [0.252, 1.3], [0.264, 1.44], [0.258, 1.49]], { yoke: [[0.11, 1.53]], chestY: 1.3, chestSpan: 0.2, backSpan: 0.3 }),
      ring(r, { r0: 0.238, h: 0.07, y: 0.845 }),
      part(r, pocket, {
        kind: "panel",
        size: [512, 256],
        scale: [1, 1, 0.72],
        position: [0, 0.98, 0],
        layout: {
          seams: [],
          hem: false,
          extra: (ctx, W, H, look) => {
            seamLine(ctx, 0, H * 0.06, W, H * 0.06, look.base, 4, 0.5);
            seamLine(ctx, W * 0.1, H * 0.12, W * 0.2, H * 0.95, look.base, 4, 0.5);
            seamLine(ctx, W * 0.9, H * 0.12, W * 0.8, H * 0.95, look.base, 4, 0.5);
          },
        },
      }),
      part(r, hood, { kind: "hood", size: [512, 512], position: [0, 1.47, -0.09], rotation: [-0.55, 0, 0], scale: [0.95, 0.85, 0.85], layout: { seams: [0.5], hem: false } }),
      ...sleeve(r, 1, s),
      ...sleeve(r, -1, s),
    ];
  },
  sweatshirt(r) {
    const s = { r0: 0.1, r1: 0.082, len: 0.46, top: [0.19, 1.43], tilt: 0.28, cuff: 0.06 };
    return [torso(r, [[0.245, 0.88], [0.245, 1.05], [0.247, 1.3], [0.26, 1.44], [0.254, 1.49]], { yoke: [[0.105, 1.525]], chestY: 1.3 }), ring(r, { r0: 0.232, h: 0.07, y: 0.865 }), ring(r, { r0: 0.108, r1: 0.102, h: 0.035, y: 1.53, zs: 0.76 }), ...sleeve(r, 1, s), ...sleeve(r, -1, s)];
  },
  dress(r) {
    const s = { r0: 0.1, r1: 0.1, len: 0.1, top: [0.2, 1.46], tilt: 0.65 };
    return [torso(r, [[0.44, 0.42], [0.36, 0.7], [0.27, 0.95], [0.2, 1.15], [0.2, 1.3], [0.215, 1.42], [0.226, 1.48]], { chestY: 1.3, chestSpan: 0.2, backSpan: 0.26, markH: 0.18 }), ...sleeve(r, 1, s), ...sleeve(r, -1, s)];
  },
  kurta(r) {
    const s = { r0: 0.092, r1: 0.08, len: 0.44, top: [0.19, 1.43], tilt: 0.24 };
    const extra = (ctx, W, H, look) => {
      const v = (y) => (1 - look.vOf(y)) * H;
      // Placket down the front, side slits at the hem.
      seamLine(ctx, W * 0.75 - 18, v(1.5), W * 0.75 - 18, v(1.2), look.base, 3, 0.5);
      seamLine(ctx, W * 0.75 + 18, v(1.5), W * 0.75 + 18, v(1.2), look.base, 3, 0.5);
      seamLine(ctx, W * 0.75 - 18, v(1.2), W * 0.75 + 18, v(1.2), look.base, 3, 0.5);
      for (const u of [0, 0.5, 1]) seamLine(ctx, u * W, v(0.86), u * W, H, look.base, 8, 0.7);
    };
    return [torso(r, [[0.252, 0.62], [0.242, 0.9], [0.234, 1.1], [0.237, 1.3], [0.246, 1.44], [0.24, 1.49]], { yoke: [[0.09, 1.525]], chestY: 1.3, chestSpan: 0.2, extra }), ring(r, { r0: 0.095, r1: 0.093, h: 0.045, y: 1.548, zs: 0.78, rib: false, thetaStart: 0.3, thetaLength: Math.PI * 2 - 0.6 }), ...sleeve(r, 1, s), ...sleeve(r, -1, s)];
  },
  jacket(r) {
    const gap = 0.24;
    const s = { r0: 0.108, r1: 0.09, len: 0.46, top: [0.195, 1.43], tilt: 0.3, cuff: 0.06, zs: 0.92 };
    const extra = (ctx, W, H, look) => {
      const v = (y) => (1 - look.vOf(y)) * H;
      for (const u of [0.07, 0.93]) seamLine(ctx, u * W - 40, v(1.06), u * W + 40, v(1.06), look.base, 5, 0.5);
    };
    return [
      torso(r, [[0.256, 0.92], [0.25, 1.1], [0.253, 1.3], [0.264, 1.44], [0.258, 1.49]], { yoke: [[0.115, 1.53]], phiStart: gap, phiLength: Math.PI * 2 - gap * 2, front: 0.9, back: 0.5, chestSpan: 0.09, backSpan: 0.28, chestY: 1.32, markH: 0.13, seams: [0.25, 0.75], extra }),
      ring(r, { r0: 0.242, h: 0.065, y: 0.9, thetaStart: gap, thetaLength: Math.PI * 2 - gap * 2 }),
      ring(r, { r0: 0.135, r1: 0.118, h: 0.07, y: 1.555, zs: 0.8, thetaStart: gap, thetaLength: Math.PI * 2 - gap * 2 }),
      ...sleeve(r, 1, s),
      ...sleeve(r, -1, s),
    ];
  },
  maxi_dress(r) {
    const s = { r0: 0.1, r1: 0.118, len: 0.12, top: [0.2, 1.46], tilt: 0.72 };
    return [
      torso(r, [[0.41, 0.05], [0.35, 0.4], [0.275, 0.78], [0.208, 1.06], [0.2, 1.15], [0.205, 1.3], [0.218, 1.42], [0.226, 1.48]], { chestY: 1.3, chestSpan: 0.2, backSpan: 0.26, markH: 0.18, folds: { top: 1.02, amp: 0.055, n: 14 } }),
      ring(r, { r0: 0.212, r1: 0.208, h: 0.05, y: 1.12, zs: 0.73, rib: false, tone: "accent", roughness: 0.6 }),
      ...sleeve(r, 1, s),
      ...sleeve(r, -1, s),
    ];
  },
  saree(r) {
    // A fitted blouse in the accent colour, a pleated floor-length skirt with a woven border, and the pallu:
    // across the front from the hip, over one shoulder, down the back. Prints go all over (buta), never one chest mark.
    const s = { r0: 0.1, r1: 0.097, len: 0.13, top: [0.2, 1.45], tilt: 0.55, tone: "accent" };
    const hemBorder = (ctx, W, H, look) => {
      ctx.fillStyle = look.accent;
      ctx.fillRect(0, H * 0.92, W, H * 0.06);
      ctx.fillRect(0, H * 0.895, W, H * 0.008);
    };
    const palluBorder = (ctx, W, H, look) => {
      ctx.fillStyle = look.accent;
      ctx.fillRect(0, 0, W * 0.08, H);
      ctx.fillRect(W * 0.92, 0, W * 0.08, H);
      ctx.fillRect(0, 0, W, H * 0.12);
      for (let i = 0; i < 3; i += 1) ctx.fillRect(0, H * (0.14 + i * 0.018), W, H * 0.007);
    };
    const pallu = ribbon(
      [[-1.0, 1.0, 0.245], [-0.55, 1.1, 0.24], [-0.05, 1.22, 0.238], [0.45, 1.34, 0.245], [0.95, 1.46, 0.26], [1.45, 1.575, 0.205], [1.95, 1.48, 0.26], [2.25, 1.3, 0.27], [2.42, 1.08, 0.275], [2.52, 0.84, 0.3], [2.57, 0.6, 0.33], [2.6, 0.4, 0.355]],
      { width: 0.22, zs: 0.74 },
    );
    return [
      torso(r, [[0.198, 1.17], [0.2, 1.3], [0.216, 1.42], [0.226, 1.48]], { tone: "accent", chestY: 1.3, printable: false }),
      torso(r, [[0.37, 0.03], [0.325, 0.3], [0.275, 0.62], [0.234, 0.9], [0.22, 1.04]], { yoke: null, zs: 0.74, kind: "skirt", folds: { top: 0.98, amp: 0.035, n: 22 }, extra: hemBorder, seams: [] }),
      part(r, pallu.geo, { kind: "drape", size: [256, 1024], layout: { seams: [], hem: false, extra: palluBorder, perimeter: 0.22, height: pallu.length } }),
      ...sleeve(r, 1, s),
      ...sleeve(r, -1, s),
    ];
  },
  cape(r) {
    // Open at the front, falling in folds to below the knee, lined in the accent colour, a standing collar and a clasp.
    const gap = 0.42;
    const keys = [[0.46, 0.4], [0.41, 0.68], [0.365, 0.98], [0.337, 1.2], [0.323, 1.36], [0.302, 1.45]];
    const shape = { yoke: [[0.22, 1.51], [0.135, 1.55]], zs: 0.8, phiStart: gap, phiLength: Math.PI * 2 - gap * 2, folds: { top: 1.25, amp: 0.06, n: 9 } };
    const clasp = (x) => part(r, new THREE.SphereGeometry(0.018, 16, 12), { kind: "trim", tone: "accent", size: [32, 32], printable: false, metalness: 0.6, roughness: 0.35, layout: { seams: [], hem: false }, position: [x, 1.535, 0.105] });
    return [
      // A cape is seen from behind: a chest or a back print both go on the back.
      torso(r, keys, { ...shape, front: 0.5, back: 0.5, chestY: 1.18, chestSpan: 0.2, backY: 1.18, backSpan: 0.2, markH: 0.24, seams: [0.25, 0.75], side: THREE.FrontSide }),
      torso(r, keys.map(([rr, y]) => [rr * 0.985, y]), { ...shape, yoke: [[0.217, 1.505], [0.133, 1.545]], tone: "accent", printable: false, seams: [], side: THREE.BackSide }),
      ring(r, { r0: 0.15, r1: 0.138, h: 0.075, y: 1.585, zs: 0.82, thetaStart: gap, thetaLength: Math.PI * 2 - gap * 2, rib: false }),
      clasp(0.055),
      clasp(-0.055),
    ];
  },
  cosplay_set(r) {
    // An original costume, not a character's: a fitted long coat with trim down the front, layered shoulder plates,
    // a belt with a plain buckle and a standing collar. The palette and the crowd's taste set the mood.
    const gap = 0.14;
    const s = { r0: 0.105, r1: 0.088, len: 0.46, top: [0.195, 1.43], tilt: 0.3, cuff: 0.06, zs: 0.92 };
    const trim = (ctx, W, H, look) => {
      ctx.fillStyle = look.accent;
      ctx.fillRect(0, 0, W * 0.018, H);
      ctx.fillRect(W * 0.982, 0, W * 0.018, H);
      ctx.fillRect(0, H * 0.955, W, H * 0.03);
    };
    const plates = [];
    for (const side of [1, -1]) {
      [[0.105, 0.235, 1.49, 0.35], [0.112, 0.252, 1.45, 0.53], [0.12, 0.27, 1.41, 0.71]].forEach(([rad, x, y, tilt]) => {
        const geo = new THREE.SphereGeometry(rad, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.45);
        const rim = (ctx, W, H, look) => {
          ctx.fillStyle = look.accent;
          ctx.fillRect(0, H * 0.86, W, H * 0.08);
        };
        plates.push(part(r, geo, { kind: "armour", tone: "accent", size: [256, 128], printable: false, metalness: 0.55, roughness: 0.35, layout: { seams: [], hem: false, extra: rim }, position: [side * x, y, 0], rotation: [0, 0, -side * tilt], scale: [1, 0.62, 0.95] }));
      });
    }
    return [
      torso(r, [[0.272, 0.7], [0.257, 0.9], [0.242, 1.05], [0.25, 1.3], [0.262, 1.44], [0.256, 1.49]], { yoke: [[0.12, 1.535]], phiStart: gap, phiLength: Math.PI * 2 - gap * 2, front: 0.9, back: 0.5, chestSpan: 0.09, backSpan: 0.26, chestY: 1.32, markH: 0.13, seams: [0.25, 0.75], extra: trim, folds: { top: 0.95, amp: 0.03, n: 8 } }),
      ring(r, { r0: 0.128, r1: 0.116, h: 0.08, y: 1.57, zs: 0.8, thetaStart: gap, thetaLength: Math.PI * 2 - gap * 2, rib: false, tone: "accent" }),
      ring(r, { r0: 0.252, h: 0.065, y: 1.0, zs: 0.745, rib: false, tone: "accent", roughness: 0.5, metalness: 0.25 }),
      part(r, new THREE.BoxGeometry(0.06, 0.055, 0.014), { kind: "trim", size: [32, 32], printable: false, metalness: 0.7, roughness: 0.3, layout: { seams: [], hem: false }, position: [0, 1.0, 0.252 * 0.745 + 0.006] }),
      ...plates,
      ...sleeve(r, 1, s),
      ...sleeve(r, -1, s),
    ];
  },
  shorts(r, { withTop = false } = {}) {
    const hip = lathe([[0.226, 0.8], [0.22, 0.935]], { steps: 4 });
    const legs = [1, -1].map((s) => {
      const geo = new THREE.CylinderGeometry(0.126, 0.13, 0.22, 36, 1, true, Math.PI / 2);
      const isFront = s === -1;
      return part(r, geo, { kind: isFront ? "body" : "shorts", size: [512, 512], position: [s * 0.1, 0.71, 0], rotation: [0, 0, s * 0.06], scale: [1, 1, 0.82], layout: { seams: [0, 0.5], front: 0.75, back: 0.25, vChest: 0.5, vBack: 0.5, chestSpan: 0.16, backSpan: 0.16, chestHeight: 0.34, backHeight: 0.34 } });
    });
    return [...(withTop ? [] : [ring(r, { r0: 0.217, h: 0.05, y: 0.955, zs: 0.74 })]), part(r, hip.geo, { kind: "shorts", size: [1024, 256], scale: [1, 1, 0.74], layout: { seams: [0, 0.5], hem: false } }), ...legs];
  },
  set(r) {
    return [torso(r, [[0.23, 0.94], [0.226, 1.1], [0.232, 1.3], [0.242, 1.44], [0.236, 1.49]]), ...sleeve(r, 1), ...sleeve(r, -1), ...BUILD.shorts(r, { withTop: true })];
  },
};

/** The parts of one garment, for a renderer (or a stand-in with `capabilities`). Unknown kinds build a tee. */
export function buildGarment(kind, renderer) {
  return (BUILD[kind] ?? BUILD.tee)(renderer);
}
export { paint as paintPart };

// ---------- the mannequin ----------

function mannequin() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: MANNEQUIN_HEX, roughness: 0.72, metalness: 0.04 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4b4d55, roughness: 0.45, metalness: 0.5 });
  const add = (geo, mat, [x, y, z], { rz = 0, scale = [1, 1, 1] } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.SphereGeometry(0.105, 36, 24), skin, [0, 1.73, 0], { scale: [1, 1.16, 1.02] });
  add(new THREE.CylinderGeometry(0.05, 0.062, 0.16, 24), skin, [0, 1.56, 0]);
  const body = [[0, 0.86], [0.17, 0.86], [0.19, 0.93], [0.18, 1.02], [0.158, 1.12], [0.168, 1.22], [0.19, 1.33], [0.2, 1.42], [0.19, 1.47], [0.12, 1.5], [0.06, 1.51], [0, 1.51]].map(([r, y]) => V2(r, y));
  add(new THREE.LatheGeometry(body, 56), skin, [0, 0, 0], { scale: [1, 1, 0.64] });
  for (const s of [1, -1]) {
    add(new THREE.SphereGeometry(0.062, 24, 16), skin, [s * 0.215, 1.44, 0]);
    add(new THREE.CapsuleGeometry(0.052, 0.3, 8, 20), skin, [s * 0.245, 1.25, 0], { rz: s * 0.12 });
    add(new THREE.CapsuleGeometry(0.082, 0.34, 8, 20), skin, [s * 0.095, 0.72, 0], { rz: s * 0.03 });
  }
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 16), metal, [0, 0.36, 0]);
  add(new THREE.CylinderGeometry(0.3, 0.32, 0.025, 48), metal, [0, 0.0125, 0]);
  return group;
}

// ---------- the viewer ----------

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Mount a viewer in `container`. `styles` and `palette` come straight from the
 * written plan. Returns { show(styleIndex), setColourway(name), snapshot(), destroy() }.
 */
export function createGarmentViewer(container, { styles = [], palette = [], label = "" } = {}) {
  if (!webglAvailable()) throw new Error("WebGL is not available in this browser.");
  const stillByPreference = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "garment-canvas";
  renderer.domElement.setAttribute("aria-label", "3D garment preview. Drag to turn it.");
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0.9, 1.35, 3.7);
  camera.lookAt(LOOK_AT);

  // Three-point light: key with the shadow, fill, rim; a hemisphere for the ambient.
  const key = new THREE.DirectionalLight(0xffffff, 3.0);
  key.position.set(2.5, 4.5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -1.6;
  key.shadow.camera.right = key.shadow.camera.top = 1.6;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0xdfe6ff, 1.1);
  fill.position.set(-3, 2, 2);
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(-1, 3.5, -3.5);
  const sky = new THREE.HemisphereLight(0xd8dcff, 0x1a1a1e, 1.0);
  scene.add(key, fill, rim, sky);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.42 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const form = mannequin();
  scene.add(form);
  const garment = new THREE.Group();
  scene.add(garment);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(LOOK_AT);
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 2.6;
  controls.maxDistance = 4.8;
  controls.minPolarAngle = 0.8;
  controls.maxPolarAngle = 1.75;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = !stillByPreference;
  controls.autoRotateSpeed = 1.4;
  controls.update();
  // OrbitControls sets touch-action none; let a vertical swipe still scroll the page on phones.
  renderer.domElement.style.touchAction = "pan-y";
  let resumeTimer = 0;
  const onStart = () => {
    controls.autoRotate = false;
    clearTimeout(resumeTimer);
  };
  const onEnd = () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => (controls.autoRotate = !stillByPreference), 1800);
  };
  controls.addEventListener("start", onStart);
  controls.addEventListener("end", onEnd);

  let parts = [];
  let current = { style: null, index: -1, colourway: "", look: null };
  let raf = 0;
  let visible = true;
  let alive = true;

  function size() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame() {
    raf = 0;
    if (!alive || !visible || document.hidden) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (alive && !raf) raf = requestAnimationFrame(frame);
  };

  const ro = new ResizeObserver(() => {
    size();
    wake();
  });
  ro.observe(container);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    wake();
  });
  io.observe(container);
  document.addEventListener("visibilitychange", wake);
  size();

  function clearGarment() {
    for (const p of parts) {
      garment.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      p.tex.dispose();
    }
    parts = [];
  }

  const drawn = new Map(); // style index -> { image, mode }: a print or fabric OpenAI drew for that style
  let model = null; // a generated GLB, shown in place of the mannequin and the procedural garment

  function lookFor(style, colourway) {
    const base = colourOf(colourway, palette);
    const kind = garmentOf(style);
    const print = printOf(style);
    // A saree carries its print all over (buta), never as one chest mark.
    if (kind === "saree" && print.type !== "none") print.placement = "all_over";
    const art = drawn.get(styles.indexOf(style));
    return { base, accent: accentOf(base, palette), print, label: clean(style?.name) || label || "", garment: kind, image: art?.image ?? null, imageMode: art?.mode ?? "" };
  }

  function clearModel() {
    if (!model) return;
    scene.remove(model);
    model.traverse((o) => {
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    model = null;
    form.visible = true;
    garment.visible = true;
  }

  /** Show a GLB (a generated 3D model) on the turntable in place of the mannequin, about the garment's size. */
  async function showModel(url) {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(url);
    if (!alive) return false;
    clearModel();
    model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(1.25 / Math.max(size.x, size.y, size.z, 1e-3));
    box.setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3())).add(LOOK_AT);
    model.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    form.visible = false;
    garment.visible = false;
    scene.add(model);
    wake();
    return true;
  }

  /** Back to the procedural garment on the mannequin. */
  function showGarment() {
    clearModel();
    wake();
  }

  /** Put a drawn print (or fabric) on a style; repaints now if that style is showing. */
  function setPrintImage(index, src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (!alive || !styles[index]) return resolve(false);
        drawn.set(index, { image, mode: printModeOf(styles[index]) });
        if (index === current.index) {
          current.look = lookFor(current.style, current.colourway);
          repaint();
        }
        resolve(true);
      };
      image.onerror = () => reject(new Error("The print didn't load."));
      image.src = src;
    });
  }

  function repaint() {
    if (!current.look) return;
    for (const p of parts) {
      paint(p, { ...current.look, vOf: p.layout?.vOf ?? ((y) => y) });
      p.tex.needsUpdate = true;
    }
    wake();
  }

  function show(index) {
    const style = styles[index];
    if (!style) return;
    const ways = colourwaysOf(style, palette);
    const keep = ways.some((w) => w.toLowerCase() === current.colourway.toLowerCase());
    current = { style, index, colourway: keep ? current.colourway : ways[0] ?? "", look: null };
    current.look = lookFor(style, current.colourway);
    clearModel();
    clearGarment();
    const build = BUILD[current.look.garment] ?? BUILD.tee;
    parts = build(renderer);
    for (const p of parts) garment.add(p.mesh);
    repaint();
  }

  function setColourway(name) {
    if (!current.style) return;
    current.colourway = clean(name);
    current.look = lookFor(current.style, current.colourway);
    repaint();
  }

  function snapshot() {
    controls.update();
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#0b0b0d";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    const dpr = out.width / Math.max(1, src.clientWidth || out.width);
    const line = [label, current.style?.name, current.colourway].filter(Boolean).join(" · ");
    if (line) {
      ctx.font = `700 ${Math.round(13 * dpr)}px Archivo, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(245,245,247,0.85)";
      ctx.textBaseline = "bottom";
      ctx.fillText(line, 14 * dpr, out.height - 12 * dpr);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(245,245,247,0.5)";
      ctx.fillText("3D preview · AYTO", out.width - 14 * dpr, out.height - 12 * dpr);
    }
    return out.toDataURL("image/png");
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(resumeTimer);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", wake);
    controls.removeEventListener("start", onStart);
    controls.removeEventListener("end", onEnd);
    controls.dispose();
    clearModel();
    clearGarment();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.map?.dispose();
          m.dispose();
        }
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  wake();
  return { show, setColourway, setPrintImage, showModel, showGarment, snapshot, destroy, get current() { return { index: current.index, colourway: current.colourway, garment: current.look?.garment }; } };
}
