// TRADECRAFT ui: the plaques over the picture: a place that's yours over its door, a face you've marked
// over its head, where you're going at the picture's edge (the user, 2026-10-27, of the old labels:
// "infocards need to be revamped, they feel low quality, low tech too sharp and practical"). They were
// browser text in boxes, laid over a picture of 480 × 270 pixels; now they're of the picture: drawn in
// its own pixel alphabet (src/art/pixelart.js text(), the one the shop signs are painted in), at its
// scale, on the same grid, as a small enamelled plaque: an ink outline, its face in the kind's colour
// with a lit top edge and a shaded foot, a 5 × 5 glyph (a star for the embassy, a house for home, a
// key for a safe house, an eye for a face, an arrow for the way), the name, and after a seam a
// quieter second part (how far); a notch at its foot points at what it names, and a pixel of shadow
// lifts it off the street.
//
// plaque({ text, sub, style, icon, notch }) → a canvas at the picture's pixels (made once a look, kept);
// place(el, canvas, x, y, k, anchor) sets it on the HUD: x, y in the picture's pixels, k the frame's
// scale, snapped to the picture's grid.
import { text as glyphs, textWidth } from '../art/pixelart.js';

// The kinds: face, its lit edge, its shade, the letters, the glyph's colour.
export const STYLES = {
  embassy: { face: 0x1b2541, hi: 0x283f6b, lo: 0x14151c, ink: 0xf6f4ee, glyph: 0xf8e08a },
  home: { face: 0xe7b84a, hi: 0xf8e08a, lo: 0xb9862e, ink: 0x14151c, glyph: 0x6e2a2e },
  safe: { face: 0x356f42, hi: 0x4f8a5a, lo: 0x24503a, ink: 0xf6f4ee, glyph: 0xf8e08a },
  seen: { face: 0xe2dac6, hi: 0xf6f4ee, lo: 0xc4bba9, ink: 0x14151c, glyph: 0x3b6296 },
  tail: { face: 0x9e3c36, hi: 0xc4574e, lo: 0x6e2a2e, ink: 0xf6f4ee, glyph: 0xf8e08a },
  way: { face: 0x23252f, hi: 0x353947, lo: 0x14151c, ink: 0xf6f4ee, glyph: 0xe7b84a },
};
const INK = 0x14151c, SHADOW = 'rgba(20, 21, 28, 0.55)';

// 5 × 5 glyphs.
const ICONS = {
  star: ['00100', '01110', '11111', '01110', '01010'],
  house: ['00100', '01110', '11111', '01010', '01110'],
  key: ['01100', '10010', '01100', '00100', '00110'],
  eye: ['00000', '01110', '11011', '01110', '00000'],
  tube: ['01110', '10001', '11111', '10001', '01110'],
  cross: ['00000', '00100', '01110', '00100', '00000'],
  pin: ['01110', '11011', '01110', '00100', '00100'],
  up: ['00100', '01110', '11111', '00100', '00100'],
  down: ['00100', '00100', '11111', '01110', '00100'],
  left: ['00100', '01100', '11111', '01100', '00100'],
  right: ['00100', '00110', '11111', '00110', '00100'],
};

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const kept = new Map();

/** A plaque, drawn at the picture's pixels: { canvas, w, h, tip } (tip: the notch's point, from the left). */
export function plaque({ text, sub = null, style = 'way', icon = null, notch = true }) {
  const key = `${text}|${sub}|${style}|${icon}|${notch}`;
  if (kept.has(key)) return kept.get(key);
  const S = STYLES[style] ?? STYLES.way, T = String(text).toUpperCase(), U = sub && String(sub).toUpperCase();
  const iw = icon ? 5 + 3 : 0, tw = textWidth(T), uw = U ? 4 + textWidth(U) : 0;
  const w = 1 + 3 + iw + tw + uw + 3 + 1, body = 1 + 2 + 5 + 2 + 1, h = body + (notch ? 3 : 0) + 1;
  const cv = document.createElement('canvas');
  cv.width = w + 1; cv.height = h;
  const g = cv.getContext('2d');
  const px = (x, y, ww = 1, hh = 1, c = INK) => { g.fillStyle = typeof c === 'string' ? c : hex(c); g.fillRect(x, y, ww, hh); };
  // (a pixel of shadow, right and below; the outline; the face, lit along its top, shaded along its foot)
  px(1, 1, w, body, SHADOW);
  px(0, 0, w, body, INK);
  px(1, 1, w - 2, body - 2, S.face);
  px(1, 1, w - 2, 1, S.hi); px(1, body - 2, w - 2, 1, S.lo);
  // (the corners nicked: an enamel plate's, not a box's)
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, body - 1], [w - 1, body - 1]]) g.clearRect(x, y, 1, 1);
  let x = 4;
  if (icon) { ICONS[icon].forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(x + i, 3 + j, 1, 1, S.glyph); })); x += iw; }
  glyphs(px, x, 3, T, S.ink);
  x += tw;
  if (U) {
    px(x + 2, 2, 1, body - 4, S.lo);                               // (the seam)
    glyphs(px, x + 4, 3, U, mix(S.ink, S.face, 0.35));
  }
  // (the notch: a point under its middle, at what it names)
  const tip = Math.floor(w / 2);
  if (notch) { px(tip - 2, body - 1, 5, 1, INK); px(tip - 1, body - 1, 3, 1, S.lo); px(tip - 1, body, 3, 1, INK); px(tip, body, 1, 1, S.lo); px(tip, body + 1, 1, 1, INK); }
  const out = { canvas: cv, w: cv.width, h: cv.height, tip, words: U ? `${T} ${U}` : T };
  kept.set(key, out);
  return out;
}

/** A colour part of the way to another. */
function mix(a, b, t) {
  const ch = (c, s) => (c >> s) & 255, m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * Set a plaque into its element (a canvas on the HUD) at x, y in the picture's pixels, k the frame's
 * scale; anchor 'tip' (its notch's point at x, y), 'left' or 'right' (its edge at x, its middle at y).
 */
export function place(el, p, x, y, k, anchor = 'tip') {
  if (el.$p !== p) {
    el.$p = p;
    el.width = p.w; el.height = p.h;
    el.getContext('2d').drawImage(p.canvas, 0, 0);
    el.dataset.text = p.words;                                     // (what it says, for the tests and a reader)
    el.setAttribute('aria-label', p.words);
    el.style.width = `${p.w * k}px`; el.style.height = `${p.h * k}px`;
    el.$k = k;
  } else if (el.$k !== k) { el.style.width = `${p.w * k}px`; el.style.height = `${p.h * k}px`; el.$k = k; }
  const ax = anchor === 'tip' ? x - p.tip : anchor === 'right' ? x - p.w : x, ay = anchor === 'tip' ? y - p.h : y - Math.floor(p.h / 2);
  el.style.transform = `translate(${Math.round(Math.round(ax) * k)}px, ${Math.round(Math.round(ay) * k)}px)`;
}
