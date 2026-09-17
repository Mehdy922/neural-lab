// Shared theme, slide master and drawing helpers for the Neural Lab decks. Each lesson's
// build script imports from here so every deck looks the same: the app's palette, fonts that
// ship with Windows/Office, and pixel art from the same code the bot simulator draws with.

import pptxgen from "pptxgenjs";
import { existsSync } from "node:fs";
import { mulberry32 } from "../src/ml/net.js";
import { GRID } from "../src/ml/capture.js";
import { drawShape, STYLES } from "../scripts/lib/pixelart.mjs";

// ── theme (mirrors src/theme.js) ─────────────────────────────────────────
export const C = {
  cream: "FFF7E8", paper: "FFFFFF", soft: "FFF1DC", ink: "2A2140", muted: "6F6785", line: "F0E4D0",
  mango: "FF8A3D", mangoDeep: "D9651F", sky: "3BA7F5", skyDeep: "2378BD", leaf: "2FA866", berry: "E85D9C", sun: "FFD23F", red: "E24B4B",
};
// Fonts that ship with Windows 10/11 and Office, so the deck renders identically on the school PC
// without installing anything. (The web app uses Fredoka/Nunito; these are the closest safe match.)
export const DISP = "Segoe UI Black";
export const SANS = "Calibri";
export const W = 10, H = 5.625, M = 0.5;   // 16:9 layout in inches

// pptxgenjs only exposes its shape enum on an instance; read it once so the helpers below can
// draw into any presentation without being told which one.
const SHAPE = new pptxgen().ShapeType;

// Creates a presentation with the LAB master and returns it with a slide() bound to it.
export function makePptx({ title }) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Neural Lab";
  pptx.title = title;

  pptx.defineSlideMaster({
    title: "LAB",
    background: { color: C.cream },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.09, fill: { color: C.mango } } },
      { text: { text: "🧠 Neural Lab", options: { x: M, y: H - 0.42, w: 3, h: 0.3, fontFace: SANS, fontSize: 10, bold: true, color: C.muted } } },
    ],
    slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.3, fontFace: SANS, fontSize: 10, color: C.muted, align: "right" },
  });

  const slide = (notes) => { const s = pptx.addSlide({ masterName: "LAB" }); if (notes) s.addNotes(notes); return s; };
  return { pptx, slide };
}

// ── helpers ──────────────────────────────────────────────────────────────
export const title = (s, text, opts = {}) =>
  s.addText(text, { x: M, y: 0.32, w: W - 2 * M, h: 0.9, fontFace: DISP, fontSize: 34, bold: true, color: C.ink, valign: "middle", ...opts });
export const sub = (s, text, y = 1.15, opts = {}) =>
  s.addText(text, { x: M, y, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top", ...opts });
export const card = (s, x, y, w, h, fill = C.paper) => {
  s.addShape(SHAPE.roundRect, { x, y: y + 0.07, w, h, fill: { color: C.line }, line: { color: C.line, width: 0 }, rectRadius: 0.18 });
  s.addShape(SHAPE.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.18 });
};
export const badge = (s, text, x, y, color = C.sun, textColor = C.ink, w = 1.6) =>
  s.addText(text, { x, y, w, h: 0.36, fontFace: SANS, fontSize: 11, bold: true, color: textColor, align: "center", valign: "middle",
    fill: { color }, line: { color, width: 0 }, shape: SHAPE.roundRect, rectRadius: 0.18 });
export const body = (s, text, x, y, w, h, opts = {}) =>
  s.addText(text, { x, y, w, h, fontFace: SANS, fontSize: 15, color: C.ink, valign: "top", paraSpaceAfter: 6, ...opts });
export const big = (s, text, x, y, w, h, color = C.ink, size = 44) =>
  s.addText(text, { x, y, w, h, fontFace: DISP, fontSize: size, bold: true, color, align: "center", valign: "middle" });
export const bullets = (s, items, x, y, w, h, opts = {}) =>
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { code: "25CF" }, breakLine: i < items.length - 1 } })),
    { x, y, w, h, fontFace: SANS, fontSize: 15, color: C.ink, valign: "top", paraSpaceAfter: 8, ...opts });

// 16×16 pixel art: one small square per inked pixel.
export function pixelArt(s, pix, x, y, size, color = C.ink, bg = C.paper) {
  const cell = size / GRID;
  s.addShape(SHAPE.roundRect, { x: x - 0.06, y: y - 0.06, w: size + 0.12, h: size + 0.12, fill: { color: bg }, line: { color: C.line, width: 1.5 }, rectRadius: 0.1 });
  for (let i = 0; i < pix.length; i++) {
    if (pix[i] <= 0) continue;
    const gx = i % GRID, gy = Math.floor(i / GRID);
    const c = pix[i] >= 1 ? color : C.muted;
    s.addShape(SHAPE.rect, { x: x + gx * cell, y: y + gy * cell, w: cell, h: cell, fill: { color: c }, line: { color: c, width: 0 } });
  }
}
export const art = (kind, styleIdx, seed) => drawShape(kind, STYLES[styleIdx % STYLES.length], mulberry32(seed));
// Screenshots. pptxgenjs stretches the file to the box (its "contain" only compares the box with
// itself), so pass a w/h in the PNG's own aspect ratio.
export const img = (s, file, x, y, w, h) => {
  const path = `slides/img/${file}`;
  if (existsSync(path)) s.addImage({ path, x, y, w, h, rounding: false, sizing: { type: "contain", w, h } });
  else { card(s, x, y, w, h, C.soft); body(s, `screenshot: ${file}`, x + 0.2, y + h / 2 - 0.2, w - 0.4, 0.4, { color: C.muted, align: "center" }); }
};
export const arrow = (s, x, y, w = 0.5) => s.addText("→", { x, y, w, h: 0.5, fontFace: DISP, fontSize: 28, color: C.muted, align: "center", valign: "middle" });
