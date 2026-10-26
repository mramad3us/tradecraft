// TRADECRAFT art: a town for the pixel-art look (pixelart.js).
//
// Flat things are painted, things that stand out are boxes. The street's ground is one painted
// texture (paving slabs, kerbs, asphalt, lane marks, a zebra crossing, drains, a manhole, cracks,
// tree pits), as a 2D game draws its map. A building is a box whose front is a painted facade
// (bricks or plaster, windows with sills and lintels, shutters, doors, shopfronts, signs in a 3 × 5
// pixel font, a cornice); what projects from it (an awning, a canopy, a sign) is a box of its own,
// and casts its shadow. Props (lamp posts, trees, benches, bins, café tables, cars) are a few boxes
// each, with painted faces where they need detail.
//
// Everything is measured in metres, painted at PX_PER_M pixels a metre, in PALETTE colours.
//
// The fine finish (finish.fine, sample 007, after Stoneshard) paints the same things with more care:
// bricks and slabs bevelled one by one, plaster weathered (mottled, grimy at the foot, cracked,
// fallen away in patches to the brick), window and door frames bevelled, glass with a reflection,
// dirt streaking down from the sills, ivy, and the street's clutter (weeds, puddles, litter, moss in
// the joints). The plain finish is untouched: sample 006 draws as it did.
import * as THREE from 'three';
import { PX_PER_M, GLOWS, mat, glow, paint, tile, box, roundedBox, ground, part, pool, rng, text, textWidth, finish, tone, noise, fineBricks } from './pixelart.js';

const M = PX_PER_M;
const INK = 0x14151c;

// ---------- painting helpers (y measured up from a surface's bottom, in metres) ----------

/**
 * Painting tools for a surface w × h metres: rect, window, door, shopfront, sign, cornice, bricks,
 * plaster, arch. `split` draws which windows are lit at night from a stream of its own, so a wall
 * painted for day and for night comes out the same but for the lights (the game swaps them at dusk).
 */
function painter(px, wM, hM, seed = 1, night = false, wall = null, split = false) {
  const W = Math.round(wM * M), H = Math.round(hM * M);
  const r = rng(seed);
  const litR = split ? rng(seed * 31 + 7) : null;
  const X = (x) => Math.round(x * M), Y = (y) => H - Math.round(y * M);   // metres → pixels, y up
  const fine = finish.fine;
  // A frame's bevel: lit along the top and left, in shade along the bottom and right.
  const bevel = (x0, y0, ww, hh, c) => {
    px(x0, y0, ww, 1, tone(c, 0.06)); px(x0, y0, 1, hh, tone(c, 0.04));
    px(x0, y0 + hh - 1, ww, 1, tone(c, -0.1)); px(x0 + ww - 1, y0, 1, hh, tone(c, -0.08));
  };
  // Dirt run down a wall from (x0, y0), a few streaks over ww pixels.
  const streaks = (x0, y0, ww) => {
    if (!wall) return;
    for (let i = 0; i < ww; i++) if (r() < 0.35) px(x0 + i, y0, 1, 2 + Math.floor(r() * 7), tone(wall, -0.05 - r() * 0.03));
  };
  const f = {
    W, H, r,
    /** A rectangle in metres from the bottom left. */
    rect: (x, y, w, h, c) => px(X(x), Y(y + h), Math.round(w * M), Math.round(h * M), c),
    bricks(x, y, w, h, base = 0x9e3c36) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (fine) return fineBricks(px, x0, y0, ww, hh, base, r);
      px(x0, y0, ww, hh, 0x7d756c);                              // mortar
      for (let j = 0; j < hh; j += 4) for (let i = ((j / 4) % 2) * 4 - 4; i < ww; i += 8) {
        const a = Math.max(0, i), b = Math.min(ww, i + 7);
        if (b > a) px(x0 + a, y0 + j, b - a, Math.min(3, hh - j), r() < 0.15 ? 0xc95c45 : r() < 0.12 ? 0x6e2a2e : base);
      }
    },
    plaster(x, y, w, h, base = 0xe2dac6, dirt = 0xc4bba9) {
      if (fine) return f.weathered(x, y, w, h, base);
      f.rect(x, y, w, h, base);
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      for (let i = 0; i < ww * hh * 0.03; i++) px(x0 + Math.floor(r() * ww), y0 + Math.floor(r() * hh), 1, 1, dirt);
      px(x0, y0 + hh - 2, ww, 2, dirt);                          // grime at the foot
    },
    /** Plaster, weathered (the fine finish): mottled, grimy at the foot, cracked, fallen away to the brick here and there. */
    weathered(x, y, w, h, base) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M), sd = seed * 7;
      for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
        const v = noise(i / 7, j / 7, sd) * 0.6 + noise(i / 2.5, j / 2.5, sd + 1) * 0.4;
        let d = v < 0.28 ? -0.035 : v > 0.72 ? 0.02 : -0.01;
        const foot = hh - j;                                     // grime rising from the pavement
        if (foot < 14 && noise(i / 3, j / 2, sd + 2) < (14 - foot) / 14) d -= 0.045;
        px(x0 + i, y0 + j, 1, 1, tone(base, d));
      }
      // Patches where the plaster has come away: brick in a ragged hole, its edge in shade.
      for (let k = 0; k < Math.max(1, Math.round(ww * hh / 9000)); k++) {
        const cx = Math.floor(r() * ww), cy = Math.floor(hh * 0.15 + r() * hh * 0.6), rw = 6 + r() * 8, rh = 4 + r() * 5;
        for (let j = -Math.ceil(rh) - 1; j <= rh + 1; j++) for (let i = -Math.ceil(rw) - 1; i <= rw + 1; i++) {
          const e = (i / rw) ** 2 + (j / rh) ** 2 + (noise((cx + i) / 3, (cy + j) / 3, sd + 3) - 0.5) * 0.9;
          const X0 = cx + i, Y0 = cy + j;
          if (X0 < 0 || Y0 < 0 || X0 >= ww || Y0 >= hh || e > 1.15) continue;
          if (e > 0.9) { px(x0 + X0, y0 + Y0, 1, 1, tone(base, j < 0 || i < 0 ? -0.12 : 0.03)); continue; }
          const row = Math.floor(Y0 / 4), mortar = Y0 % 4 === 3 || (X0 + (row % 2) * 4) % 8 === 7;
          px(x0 + X0, y0 + Y0, 1, 1, mortar ? tone(0x9e3c36, -0.24) : tone(0x9e3c36, Y0 % 4 === 0 ? 0.03 : (noise(X0, Y0, 5) - 0.5) * 0.08));
        }
      }
      // Cracks: a wandering line, its lip catching the light.
      for (let k = 0; k < Math.max(1, Math.round(ww / 60)); k++) {
        let cx = Math.floor(r() * ww), cy = Math.floor(r() * hh * 0.8);
        for (let n = 0; n < 8 + r() * 12; n++) {
          if (cx >= 0 && cy >= 0 && cx < ww && cy < hh) { px(x0 + cx, y0 + cy, 1, 1, tone(base, -0.16)); if (cx + 1 < ww) px(x0 + cx + 1, y0 + cy, 1, 1, tone(base, 0.03)); }
          cy++; cx += r() < 0.4 ? (r() < 0.5 ? -1 : 1) : 0;
        }
      }
    },
    /** Ivy climbing from the foot of the wall at x, w wide, up to h (metres); the fine finish only. */
    ivy(x, w, h) {
      if (!fine) return;
      const x0 = X(x), ww = Math.round(w * M), hh = Math.round(h * M), base = 0x356f42;
      for (let i = 0; i < ww; i++) {                             // a ragged top, highest in the middle
        const top = hh * (0.55 + 0.45 * Math.sin(Math.PI * i / ww)) * (0.75 + 0.35 * noise(i / 4, 0, seed));
        for (let j = 0; j < top; j++) {
          const v = noise(i / 2.2, j / 2.2, seed + 9);
          if (v < 0.3 && j > 3) continue;                         // gaps where the wall shows
          const yy = H - 1 - j;
          px(x0 + i, yy, 1, 1, v > 0.72 ? tone(base, 0.12) : v > 0.55 ? tone(base, 0.04) : v > 0.42 ? base : tone(base, -0.08));
        }
      }
      for (let k = 0; k < ww / 6; k++) { const sx = x0 + Math.floor(r() * ww); for (let j = 0; j < hh * 0.5 * r(); j += 2) px(sx + (j % 4 === 0 ? 1 : 0), H - 1 - j, 1, 1, 0x47302a); }   // stems
    },
    /** A window: frame, glass with a glint (or lit), mullion and transom, a sill, a lintel, shutters. */
    window(x, y, w, h, { lit = false, frame = 0xdfe2e8, lintel = 0xc4bba9, shutters = null, curtain = null, flowers = null } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (litR ? night && litR() < 0.4 : night && r() < 0.4) lit = true;   // at night, some rooms have the light on
      if (lintel) px(x0 - 1, y0 - 2, ww + 2, 2, lintel);
      px(x0, y0, ww, hh, frame);
      const g = lit ? [0xe7b84a, 0xf8e08a] : [0x283f6b, 0x3b6296];
      px(x0 + 1, y0 + 1, ww - 2, hh - 2, g[0]);
      px(x0 + 1, y0 + 1, ww - 2, Math.floor((hh - 2) / 3), g[1]);
      if (curtain) { px(x0 + 1, y0 + 1, 2, hh - 2, curtain); px(x0 + ww - 3, y0 + 1, 2, hh - 2, curtain); }
      if (!lit) { px(x0 + 2, y0 + 3, 1, 2, 0x95c1e3); px(x0 + 3, y0 + 2, 1, 1, 0x95c1e3); }
      if (fine) {
        if (!lit) for (let k = 0; k < Math.min(ww, hh) - 4; k++) px(x0 + ww - 3 - k, y0 + 2 + k, 1, 1, tone(g[0], 0.08));   // a reflection, corner to corner
        px(x0 + 1, y0 + 1, ww - 2, 1, tone(g[0], -0.1));           // the frame's shadow on the glass
        bevel(x0, y0, ww, hh, frame);
        if (lintel) bevel(x0 - 1, y0 - 2, ww + 2, 2, lintel);
      }
      px(x0 + Math.floor(ww / 2), y0, 1, hh, frame);             // mullion
      px(x0, y0 + Math.floor(hh / 3), ww, 1, frame);             // transom
      px(x0 - 1, y0 + hh, ww + 2, 1, 0xf6f4ee);                  // sill, and its shadow
      px(x0 - 1, y0 + hh + 1, ww + 2, 1, 0x5c5650);
      if (fine) { streaks(x0, y0 + hh + 2, ww); px(x0 - 1, y0 + hh + 1, ww + 2, 1, tone(wall ?? 0x5c5650, -0.14)); }
      if (shutters) for (const sx of [x0 - 5, x0 + ww + 1]) {
        px(sx, y0, 4, hh, shutters);
        for (let j = 1; j < hh; j += 2) px(sx, y0 + j, 4, 1, INK === shutters ? 0x353947 : 0x24503a);
      }
      if (flowers) {                                             // a flower box on the sill
        const by = y0 + hh + 2;
        px(x0 - 1, by, ww + 2, 2, 0x6b4636); px(x0 - 1, by + 2, ww + 2, 1, 0x47302a);
        for (let i = 0; i < ww + 2; i++) {
          px(x0 - 1 + i, by - 1, 1, 1, r() < 0.5 ? 0x356f42 : 0x4f8f45);
          if (r() < 0.6) px(x0 - 1 + i, by - 2, 1, 1, r() < 0.5 ? 0x24503a : 0x356f42);
          if (r() < 0.4) px(x0 - 1 + i, by - 2 - (r() < 0.3 ? 1 : 0), 1, 1, flowers[Math.floor(r() * flowers.length)]);
        }
      }
    },
    /** A poster pasted on a wall: a coloured sheet, a band of text, a picture, a torn corner. */
    poster(x, y, w, h, { bg = 0xe2dac6, fg = 0x9e3c36, art = 0x283f6b, words = '' } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      px(x0, y0, ww, hh, bg);
      px(x0 + 1, y0 + 1, ww - 2, Math.floor(hh * 0.55), art);
      px(x0 + 3, y0 + 3, 3, 3, fg); px(x0 + ww - 5, y0 + 2, 2, 2, 0xf8e08a);
      if (words) text(px, x0 + Math.max(1, Math.floor((ww - textWidth(words)) / 2)), y0 + hh - 7, words, fg);
      px(x0 + ww - 2, y0 + hh - 2, 2, 2, 0x5c5650);              // a torn corner
      px(x0, y0 + hh, ww, 1, 0x5c5650);
    },
    /** An arch through to the courtyard: a dark passage under a round head, the yard's daylight at its end. */
    arch(x, w, h) {
      const x0 = X(x), ww = Math.round(w * M), hh = Math.round(h * M), y0 = Y(h), rad = ww / 2;
      const inside = (i, j) => j >= rad || (i + 0.5 - rad) ** 2 + (rad - j - 0.5) ** 2 <= rad * rad;
      for (let j = -2; j < hh; j++) for (let i = -2; i < ww + 2; i++) {
        if (inside(i, j)) continue;
        if (inside(i + 2, j) || inside(i - 2, j) || inside(i, j + 2) || (j >= 0 && (i === -1 || i === ww))) px(x0 + i, y0 + j, 1, 1, tone(wall ?? 0xe2dac6, j < rad ? 0.04 : -0.06));   // the surround
      }
      const yard = [Math.round(ww * 0.3), Math.round(hh * 0.45)];
      for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
        if (!inside(i, j)) continue;
        const edge = Math.min(i, ww - 1 - i), inYard = Math.abs(i + 0.5 - ww / 2) < yard[0] / 2 && j >= hh - yard[1];
        px(x0 + i, y0 + j, 1, 1, inYard ? (j === hh - yard[1] ? 0x4c5262 : j > hh - 4 ? 0x7d756c : 0x6a7182) : edge < 2 ? 0x14151c : j > hh - 3 ? 0x353947 : 0x23252f);
      }
      px(x0 + Math.floor(ww / 2) - 1, y0 - 2, 3, 3, tone(wall ?? 0xe2dac6, 0.08));   // the keystone
      px(x0 - 1, y0 + hh, ww + 2, 1, 0x5c5650);
    },
    /** A door: panels, a knob, a fanlight above, a step below. */
    door(x, w, h, { color = 0x356f42, frame = 0xe2dac6, glass = true } = {}) {
      const x0 = X(x), y0 = Y(h), ww = Math.round(w * M), hh = Math.round(h * M);
      px(x0 - 1, y0 - 4, ww + 2, hh + 4, frame);
      if (glass) { px(x0, y0 - 3, ww, 2, 0x3b6296); px(x0 + 1, y0 - 3, 1, 1, 0x95c1e3); }
      px(x0, y0, ww, hh, color);
      const dk = 0x173327 === color ? INK : 0x14151c;
      for (const [a, b] of [[2, 2], [2, Math.floor(hh / 2) + 1]]) { px(x0 + a, y0 + b, Math.floor(ww / 2) - 3, Math.floor(hh / 2) - 3, dk); px(x0 + Math.ceil(ww / 2) + 1, y0 + b, Math.floor(ww / 2) - 3, Math.floor(hh / 2) - 3, dk); }
      px(x0 + ww - 3, y0 + Math.floor(hh / 2), 1, 1, 0xe7b84a);
      px(x0 + Math.floor(ww / 2), y0, 1, hh, dk);
      if (fine) {
        bevel(x0 - 1, y0 - 4, ww + 2, 4, frame);
        for (const [a, b] of [[2, 2], [2, Math.floor(hh / 2) + 1]]) for (const ax of [x0 + a, x0 + Math.ceil(ww / 2) + 1]) {
          const pw = Math.floor(ww / 2) - 3, ph = Math.floor(hh / 2) - 3;
          px(ax, y0 + b + ph, pw, 1, tone(color, 0.06)); px(ax + pw, y0 + b, 1, ph + 1, tone(color, 0.05));   // the panels' lit lips
        }
        px(x0, y0, ww, 1, tone(color, -0.12)); px(x0 + ww - 3, y0 + Math.floor(hh / 2) - 1, 1, 1, 0xf8e08a);
        px(x0 - 2, y0 + hh, ww + 4, 1, tone(0xa0978a, 0.04));     // the step
      }
    },
    /** A shopfront: a dark frame, lit glass with things on shelves, a stall riser. */
    shopfront(x, w, h, { frame = 0x23252f, lit = true, goods = [0x9e3c36, 0xf6f4ee, 0x5d8fc2, 0xe7b84a] } = {}) {
      const x0 = X(x), y0 = Y(h), ww = Math.round(w * M), hh = Math.round(h * M);
      px(x0, y0, ww, hh, frame);
      px(x0 + 1, y0 + 1, ww - 2, hh - 6, lit ? 0xe7b84a : 0x283f6b);
      px(x0 + 1, y0 + 1, ww - 2, 3, lit ? 0xf8e08a : 0x3b6296);
      for (const sy of [Math.floor(hh * 0.45), hh - 7]) {        // shelves with goods
        px(x0 + 1, y0 + sy, ww - 2, 1, 0x6b4636);
        for (let i = 2; i < ww - 3; i += 3) if (r() < 0.75) px(x0 + i, y0 + sy - 2, 2, 2, goods[Math.floor(r() * goods.length)]);
      }
      for (let i = 0; i < ww; i += 16) px(x0 + i, y0, 1, hh, frame);
      px(x0, y0 + hh - 5, ww, 5, frame);
      px(x0, y0 + hh - 5, ww, 1, 0x4c5262);
      if (fine) { bevel(x0, y0, ww, hh, frame); for (let i = 3; i < ww - 6; i += 16) for (let k = 0; k < 5; k++) px(x0 + i + k + 2, y0 + 4 + k, 1, 1, tone(lit ? 0xe7b84a : 0x283f6b, 0.08)); }
    },
    /** A sign: a board with a border and centred text. */
    sign(x, y, w, h, str, { bg = 0x1b2541, fg = 0xf8e08a, border = 0xb9862e } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      px(x0, y0, ww, hh, border); px(x0 + 1, y0 + 1, ww - 2, hh - 2, bg);
      text(px, x0 + Math.floor((ww - textWidth(str)) / 2), y0 + Math.floor((hh - 5) / 2), str, fg);
    },
    /** A cornice at the top: a lit edge, the band, a shadow under it. */
    cornice(y, h = 0.3, c = 0xe2dac6) {
      px(0, Y(y + h), W, Math.round(h * M), c);
      px(0, Y(y + h), W, 1, 0xf6f4ee);
      px(0, Y(y), W, 1, 0x5c5650);
      if (fine) {                                                // dentils under the moulding, and a deeper shadow
        const hh = Math.round(h * M);
        px(0, Y(y + h) + 1, W, 1, tone(c, 0.03));
        for (let i = 0; i < W; i += 3) px(i, Y(y) - 2, 2, 2, tone(c, -0.05));
        px(0, Y(y) - 2, W, 1, tone(c, -0.12)); px(0, Y(y) + 1, W, 1, tone(wall ?? c, -0.1));
        if (hh > 4) px(0, Y(y + h) + 2, W, 1, tone(c, -0.04));
      }
    },
    /** A string course (a band between storeys). */
    band(y, c = 0xc4bba9) { px(0, Y(y) - 1, W, 2, c); px(0, Y(y) + 1, W, 1, 0x5c5650); if (fine) { px(0, Y(y) - 1, W, 1, tone(c, 0.05)); px(0, Y(y) + 1, W, 1, tone(wall ?? c, -0.12)); } },
  };
  return f;
}

// ---------- the street ----------

/**
 * The street's ground, painted: x0..x1, from the building line zB back to front: a pavement to zK1,
 * the road to zK2, a pavement to z1. Options: zebra [xa, xb], pits [[x, z]...] for trees; ox, the
 * texture's left edge in world pixels, so pieces of one street join (its noise and drains line up);
 * calm, the asphalt one tone with a sparse grain of single pixels rather than mottled (the game's:
 * mottling snaps into blotches under the palette, worst at night).
 */
export function street({ x0, x1, zB, zK1, zK2, z1, zebra = null, pits = [], seed = 7, ox = 0, calm = false }) {
  const W = Math.round((x1 - x0) * M), H = Math.round((z1 - zB) * M);
  const X = (x) => Math.round((x - x0) * M), Z = (z) => Math.round((z - zB) * M);
  const tex = paint(W, H, (px) => {
    if (finish.fine) return fineStreet(px, W, X, Z, { x0, x1, zB, zK1, zK2, z1, zebra, pits, seed, ox, calm });
    const r = rng(seed);
    const slabs = (za, zb) => {                                  // paving: 0.75 × 0.6 m slabs, a few odd ones
      px(0, Z(za), W, Z(zb) - Z(za), 0xc4bba9);
      for (let j = Z(za); j < Z(zb); j += 10) {
        const off = ((j / 10) % 2) * 6;
        for (let i = -off; i < W; i += 12) {
          const c = r() < 0.12 ? 0xa0978a : r() < 0.1 ? 0xe2dac6 : 0xc4bba9;
          px(Math.max(0, i), j, Math.min(11, 11 + i), 9, c);
          px(Math.max(0, i + 11), j, 1, 10, 0xa0978a);
          if (r() < 0.04) { px(i + 3, j + 3, 1, 1, 0x7d756c); px(i + 4, j + 4, 2, 1, 0x7d756c); }   // a crack
        }
        px(0, j + 9, W, 1, 0xa0978a);
      }
    };
    slabs(zB, zK1);
    slabs(zK2, z1);
    px(0, 0, W, 2, 0x7d756c);                                     // the foot of the buildings
    // The road: asphalt, worn patches, the kerbs' faces and gutters, lane dashes.
    px(0, Z(zK1), W, Z(zK2) - Z(zK1), 0x4c5262);
    for (let i = 0; i < W * (Z(zK2) - Z(zK1)) * 0.07; i++) px(Math.floor(r() * W), Z(zK1) + Math.floor(r() * (Z(zK2) - Z(zK1))), 1, 1, r() < 0.5 ? 0x353947 : 0x6a7182);
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * W), z = Z(zK1) + 4 + Math.floor(r() * (Z(zK2) - Z(zK1) - 8)); px(x, z, 10 + Math.floor(r() * 12), 3, 0x353947); px(x + 3, z + 1, 6, 1, 0x23252f); }
    px(0, Z(zK1) - 2, W, 2, 0xe2dac6);                           // far kerb: its lit top
    px(0, Z(zK1), W, 2, 0xa0978a);                               // and its face
    px(0, Z(zK1) + 2, W, 1, 0x23252f);                           // the gutter
    px(0, Z(zK2) - 1, W, 1, 0x353947);
    px(0, Z(zK2), W, 2, 0xe2dac6);                               // near kerb: only its top shows
    const mid = Z((zK1 + zK2) / 2);
    for (let i = 0; i < W; i += 80) px(i, mid, 40, 2, 0xdfe2e8);
    for (let i = ((24 - ox) % 128 + 128) % 128; i < W; i += 128) { px(i, Z(zK1) + 3, 7, 3, 0x23252f); for (let k = 1; k < 7; k += 2) px(i + k, Z(zK1) + 4, 1, 1, 0x6a7182); }   // drains
    // A manhole and a crack or two.
    const mx = X(x0 + (x1 - x0) * 0.72), mz = mid + 14;
    px(mx - 4, mz - 5, 9, 11, 0x353947); px(mx - 5, mz - 4, 11, 9, 0x353947); px(mx - 3, mz - 4, 7, 9, 0x23252f); px(mx - 4, mz - 3, 9, 7, 0x23252f);
    for (let k = -2; k <= 2; k += 2) px(mx - 3, mz + k, 7, 1, 0x4c5262);
    if (zebra) {
      for (let z = Z(zK1) + 4; z < Z(zK2) - 4; z += 10) px(X(zebra[0]), z, X(zebra[1]) - X(zebra[0]), 6, 0xdfe2e8);
      px(X(zebra[0]) - 2, Z(zK1) - 2, X(zebra[1]) - X(zebra[0]) + 4, 2, 0xb8bdc8);   // dropped kerbs
      px(X(zebra[0]) - 2, Z(zK2), X(zebra[1]) - X(zebra[0]) + 4, 2, 0xb8bdc8);
    }
    for (const [x, z] of pits) {                                 // tree pits: soil, an iron grate
      const a = X(x) - 10, b = Z(z) - 8;
      px(a, b, 20, 16, 0x5c5650); px(a + 1, b + 1, 18, 14, 0x47302a);
      for (let k = 2; k < 18; k += 3) px(a + k, b + 1, 1, 14, 0x2a1c18);
      for (let i = 0; i < 10; i++) px(a + 2 + Math.floor(r() * 16), b + 2 + Math.floor(r() * 12), 1, 1, 0x4f8f45);
    }
  });
  return ground(x0, zB, x1, z1, mat(0, tex));
}

// The street's ground in the fine finish: the same layout, every slab and kerb stone bevelled, moss in
// the joints, the asphalt mottled and patched and cracked, worn paint, weeds at the walls' foot,
// puddles at the kerbs, leaves and litter in the gutters.
function fineStreet(px, W, X, Z, { x0, x1, zB, zK1, zK2, z1, zebra, pits, seed, ox = 0, calm = false }) {
  const r = rng(seed);
  const SL = 0xc4bba9, AS = 0x4c5262;
  const slabs = (za, zb) => {
    px(0, Z(za), W, Z(zb) - Z(za), tone(SL, -0.15));             // the joints
    for (let j = Z(za); j < Z(zb); j += 10) {
      const off = ((j / 10) % 2) * 6;
      for (let i = -off; i < W; i += 12) {
        const d = (r() - 0.5) * 0.07 + (r() < 0.06 ? -0.06 : 0), a = Math.max(0, i), w = Math.min(11, 11 + i);
        const h = Math.min(9, Z(zb) - j);
        if (h <= 0) continue;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = noise((a + x + ox) / 3, (j + y) / 3, seed + 1);
          px(a + x, j + y, 1, 1, tone(SL, d + (v < 0.25 ? -0.03 : v > 0.8 ? 0.02 : 0)));
        }
        px(a, j, w, 1, tone(SL, d + 0.05)); px(a, j, 1, h, tone(SL, d + 0.03));          // lit edges
        px(a, j + h - 1, w, 1, tone(SL, d - 0.06));                                       // the shaded edge
        if (r() < 0.05) { px(a + 3, j + 3, 1, 1, tone(SL, -0.18)); px(a + 4, j + 4, 2, 1, tone(SL, -0.18)); px(a + 6, j + 5, 1, 1, tone(SL, -0.18)); }   // a crack
        if (r() < 0.3) px(a + w, j + Math.floor(r() * 9), 1, 1 + Math.floor(r() * 2), tone(0x356f42, -0.06));             // moss in the joint
      }
    }
  };
  // The road: asphalt mottled in three tones, patched, cracked, stained.
  for (let y = Z(zK1); y < Z(zK2); y++) for (let x = 0; x < W; x++) {
    if (calm) { const k = noise((x + ox) * 7.31, y * 5.17, seed + 4); px(x, y, 1, 1, k < 0.08 ? tone(AS, -0.05) : k > 0.95 ? tone(AS, 0.04) : AS); continue; }
    const v = noise((x + ox) / 3.5, y / 3.5, seed + 4) * 0.7 + noise((x + ox) / 1.3, y / 1.3, seed + 5) * 0.3;
    px(x, y, 1, 1, tone(AS, v < 0.3 ? -0.035 : v > 0.72 ? 0.025 : 0));
  }
  for (let i = 0; i < 7; i++) {                                  // repairs: a darker patch with a raised lip
    const x = Math.floor(r() * W), y = Z(zK1) + 5 + Math.floor(r() * (Z(zK2) - Z(zK1) - 14)), w = 12 + Math.floor(r() * 18), h = 5 + Math.floor(r() * 6);
    px(x, y, w, h, tone(AS, -0.06)); px(x, y, w, 1, tone(AS, 0.04)); px(x, y + h, w, 1, tone(AS, -0.1));
  }
  for (let k = 0; k < 9; k++) {                                  // cracks
    let cx = Math.floor(r() * W), cy = Z(zK1) + 4 + Math.floor(r() * (Z(zK2) - Z(zK1) - 8));
    for (let n = 0; n < 10 + r() * 16; n++) { px(cx, cy, 1, 1, tone(AS, -0.12)); cx++; cy += r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0; }
  }
  slabs(zB, zK1); slabs(zK2, z1);
  px(0, 0, W, 2, tone(0x7d756c, -0.04));                         // the foot of the buildings
  // Kerbs: stones a metre long, bevelled; the gutter, with leaves and litter in it.
  const kerb = (y, face) => {
    for (let i = 0; i < W; i += 16) {
      const d = (r() - 0.5) * 0.06;
      px(i, y, 15, 2, tone(0xe2dac6, d)); px(i, y, 15, 1, tone(0xe2dac6, d + 0.04)); px(i + 15, y, 1, 2 + (face ? 2 : 0), tone(0xa0978a, -0.12));
      if (face) { px(i, y + 2, 15, 2, tone(0xa0978a, d)); px(i, y + 3, 15, 1, tone(0xa0978a, d - 0.06)); }
    }
  };
  kerb(Z(zK1) - 2, true);
  px(0, Z(zK1) + 2, W, 1, 0x23252f);                             // the gutter
  for (let i = 0; i < W; i++) if (r() < 0.06) px(i, Z(zK1) + 2 + Math.floor(r() * 2), 1, 1, [0x8f6345, 0xb9862e, 0xc95c45, 0xdfe2e8][Math.floor(r() * 4)]);
  px(0, Z(zK2) - 1, W, 1, tone(AS, -0.1));
  kerb(Z(zK2), false);
  // Lane dashes and the zebra, the paint worn through in places.
  const worn = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (noise((x + i + ox) / 2, (y + j) / 2, seed + 6) > 0.22) px(x + i, y + j, 1, 1, i === 0 || j === 0 ? tone(c, 0.02) : c); };
  const mid = Z((zK1 + zK2) / 2);
  for (let i = 0; i < W; i += 80) worn(i, mid, 40, 2, 0xdfe2e8);
  for (let i = ((24 - ox) % 128 + 128) % 128; i < W; i += 128) { px(i - 1, Z(zK1) + 2, 9, 5, tone(AS, -0.12)); px(i, Z(zK1) + 3, 7, 3, 0x23252f); for (let k = 1; k < 7; k += 2) px(i + k, Z(zK1) + 4, 1, 1, 0x6a7182); }   // drains
  const mx = X(x0 + (x1 - x0) * 0.72), mz = mid + 14;          // a manhole
  px(mx - 5, mz - 4, 11, 9, tone(0x353947, 0.03)); px(mx - 4, mz - 5, 9, 11, tone(0x353947, 0.03));
  px(mx - 3, mz - 4, 7, 9, 0x23252f); px(mx - 4, mz - 3, 9, 7, 0x23252f);
  for (let k = -2; k <= 2; k += 2) px(mx - 3, mz + k, 7, 1, 0x4c5262);
  px(mx - 4, mz - 5, 9, 1, tone(0x6a7182, 0.06));
  if (zebra) {
    for (let z = Z(zK1) + 4; z < Z(zK2) - 4; z += 10) worn(X(zebra[0]), z, X(zebra[1]) - X(zebra[0]), 6, 0xdfe2e8);
    px(X(zebra[0]) - 2, Z(zK1) - 2, X(zebra[1]) - X(zebra[0]) + 4, 2, 0xb8bdc8);
    px(X(zebra[0]) - 2, Z(zK2), X(zebra[1]) - X(zebra[0]) + 4, 2, 0xb8bdc8);
  }
  // Puddles by the kerbs: the sky in them, a dark rim along their far edge.
  for (const [px0, pz0, rw, rh] of [[0.18, zK2 - 0.55, 22, 6], [0.57, zK1 + 0.5, 16, 5], [0.86, zK2 + 0.8, 12, 4]]) {
    const cx = Math.floor(W * px0), cy = Z(pz0);
    for (let j = -rh; j <= rh; j++) for (let i = -rw; i <= rw; i++) {
      const e = (i / rw) ** 2 + (j / rh) ** 2 + (noise((cx + i) / 3, (cy + j) / 3, seed + 7) - 0.5) * 0.8;
      if (e > 1) continue;
      px(cx + i, cy + j, 1, 1, e > 0.8 && j < 0 ? 0x353947 : (i - j * 2) % 9 === 0 && e < 0.6 ? 0xb8bdc8 : j < -rh / 3 ? 0x6a7182 : 0x8f96a6);
    }
  }
  // Weeds where the pavement meets the walls, and a few in the kerbs.
  for (let i = 0; i < W; i += 4 + Math.floor(r() * 14)) {
    const y = 2 + Math.floor(r() * 2), g = 0x4f8f45;
    px(i, y + 1, 1, 1, tone(g, -0.1)); px(i + 1, y, 1, 1, tone(g, 0.02)); if (r() < 0.6) px(i - 1, y, 1, 1, tone(g, -0.04)); if (r() < 0.4) px(i + 1, y - 1, 1, 1, tone(g, 0.1));
  }
  for (const [x, z] of pits) {                                   // tree pits: soil, an iron grate, leaves
    const a = X(x) - 10, b = Z(z) - 8;
    px(a, b, 20, 16, tone(0x5c5650, 0.03)); px(a + 1, b + 1, 18, 14, 0x47302a);
    for (let k = 2; k < 18; k += 3) { px(a + k, b + 1, 1, 14, 0x2a1c18); px(a + k, b + 1, 1, 1, 0x6b4636); }
    for (let i = 0; i < 14; i++) px(a + 2 + Math.floor(r() * 16), b + 2 + Math.floor(r() * 12), 1, 1, [0x4f8f45, 0x76ad4c, 0xb9862e][Math.floor(r() * 3)]);
  }
}

/** A building's painted front, w × h metres: the wall, then draw(f) with painter() (see building()). */
export function facade({ w, h, wall = 'brick', wallColor, draw, seed = 1, night = false, split = false }) {
  return paint(Math.round(w * M), Math.round(h * M), (px) => {
    const f = painter(px, w, h, seed, night, wall === 'brick' ? null : wallColor ?? 0xe2dac6, split);
    if (wall === 'brick') f.bricks(0, 0, w, h, wallColor ?? 0x9e3c36);
    else f.plaster(0, 0, w, h, wallColor ?? 0xe2dac6);
    draw?.(f);
  }, { glows: GLOWS });
}

/**
 * A building: a box x0..x1 wide, h tall, d deep, its front at z (facing the street, +z). draw(f)
 * paints the facade with painter(); the sides are wall, the roof flat (with a parapet) or pitched.
 * The group's userData.body is the box, its material[4] the front (to swap for a night one).
 */
export function building({ x0, x1, z, h, d = 8, wall = 'brick', wallColor, roof = 'flat', roofColor = 0x6a7182, draw, seed = 1, night = false, split = false }) {
  const w = x1 - x0;
  const g = new THREE.Group();
  const front = facade({ w, h, wall, wallColor, draw, seed, night, split });
  const sideTex = wall === 'brick' ? tile('brick', 1) : tile('plaster', 1);
  const body = box(w, h, d, { front: mat(0, front), sides: mat(0, sideTex), top: mat(roofColor) });
  body.position.set((x0 + x1) / 2, 0, z - d / 2);
  g.add(part(body));
  g.userData.body = body;
  if (roof === 'flat') {                                         // a parapet, and something on the roof
    const lip = box(w, 0.3, 0.25, { sides: mat(0xc4bba9), top: mat(0xe2dac6) });
    lip.position.set((x0 + x1) / 2, h, z - 0.125);
    g.add(part(lip, body.userData.part));
    const ac = box(1.2, 0.7, 0.9, { sides: mat(0xb8bdc8), top: mat(0xdfe2e8), front: mat(0, paint(19, 11, (px) => { px(0, 0, 19, 11, 0xb8bdc8); px(2, 2, 9, 7, 0x6a7182); for (let k = 2; k < 9; k += 2) px(2, k, 9, 1, 0x4c5262); px(13, 3, 4, 1, 0x6a7182); })) });
    ac.position.set(x0 + w * 0.7, h, z - 2);
    g.add(part(ac));
  } else {                                                       // a pitched roof, its ridge along x
    const rise = 2.2, run = Math.min(d / 2, 3.5), len = Math.hypot(rise, run);
    const tiles = tile('roof', 1);
    const slope = box(w + 0.3, 0.2, len, { sides: mat(0x6e2a2e), top: mat(0, tiles) });
    slope.geometry.translate(0, 0, -len / 2);
    slope.rotation.x = Math.atan2(rise, run);
    slope.position.set((x0 + x1) / 2, h, z + 0.15);
    g.add(part(slope));
  }
  return g;
}

/** A striped awning over a shopfront, x0..x1, its top at height y against the wall at z. */
export function awning(x0, x1, y, z, { depth = 1.3, drop = 0.6, color = 0x9e3c36 } = {}) {
  const w = x1 - x0;
  const stripes = paint(16, 16, (px) => { for (let x = 0; x < 16; x++) px(x, 0, 1, 16, Math.floor(x / 4) % 2 ? 0xf6f4ee : color); }, { repeat: true });
  const g = new THREE.Group();
  const len = Math.hypot(depth, drop);
  const top = box(w, 0.08, len, { sides: mat(color), top: mat(0, stripes), bottom: mat(0x6e2a2e) });
  top.geometry.translate(0, 0, len / 2);
  top.rotation.x = Math.atan2(drop, depth);
  top.position.set((x0 + x1) / 2, y, z);
  const valance = box(w, 0.3, 0.06, { sides: mat(color), front: mat(0, paint(Math.round(w * M), 5, (px, W) => { for (let x = 0; x < W; x++) px(x, 0, 1, 5, Math.floor(x / 4) % 2 ? 0xf6f4ee : color); for (let x = 0; x < W; x += 4) px(x + 1, 4, 2, 1, 0x23252f); })) });
  valance.position.set((x0 + x1) / 2, y - drop - 0.3, z + depth);
  g.add(top, valance);
  return part(g);
}

/** A sign standing out from the wall (a blade), lettered on both faces. */
export function bladeSign(x, y, z, str, { bg = 0x6e2a2e, fg = 0xf8e08a } = {}) {
  const w = 1.0, h = (textWidth(str) + 6) / M;
  const face = paint(Math.round(w * M), Math.round(h * M), (px, W, H) => {
    px(0, 0, W, H, 0xb9862e); px(1, 1, W - 2, H - 2, bg);
    [...str].forEach((ch, i) => text(px, Math.floor((W - 3) / 2), 3 + i * 6, ch, fg));
  }, { glows: [fg] });
  const g = new THREE.Group();
  const board = box(0.12, h, w, { left: mat(0, face), right: mat(0, face), sides: mat(0xb9862e) });
  board.position.set(x, y, z + w / 2 + 0.1);
  const arm = box(0.06, 0.06, w + 0.2, { sides: mat(0x23252f) });
  arm.position.set(x, y + h, z + w / 2);
  g.add(board, arm);
  return part(g);
}

// ---------- props ----------

/** A lamp post. userData.head is the lamp's head; `pool` false leaves its light to the caller. */
export function lamp(x, z, { lit = false, pool: withPool = true } = {}) {
  const g = new THREE.Group();
  const iron = mat(0x23252f);
  const base = box(0.32, 0.4, 0.32, { sides: iron }); g.add(base);
  const post = box(0.12, 3.4, 0.12, { sides: iron }); g.add(post);
  const arm = box(0.08, 0.08, 0.6, { sides: iron }); arm.position.set(0, 3.3, 0.25); g.add(arm);
  const head = box(0.36, 0.44, 0.36, { sides: lit ? glow(0xf8e08a) : mat(0xf8e08a), top: iron, bottom: lit ? glow(0xf8e08a) : iron });
  head.position.set(0, 2.9, 0.5); g.add(head);
  const cap = box(0.46, 0.08, 0.46, { sides: iron }); cap.position.set(0, 3.34, 0.5); g.add(cap);
  g.position.set(x, 0, z);
  part(g);
  if (lit && withPool) g.add(pool(0, 2.7, 0.5, { r: 2.0 }));    // its pool of light
  g.userData.head = head;
  return g;
}

/**
 * An iron railing along x from x0 to x1 at z, h tall: bars with spear tops between two rails, painted
 * on a thin box with the gaps cut out (alphaTest), so the street shows through. It draws its own ink,
 * so it stays out of the outline pass.
 */
export function railing(x0, x1, z, { h = 0.9, color = 0x23252f } = {}) {
  const n = Math.round(h * M);
  const bars = paint(16, n, (px) => {
    px(0, 2, 16, 1, tone(color, 0.12)); px(0, 3, 16, 1, color);
    px(0, n - 3, 16, 1, tone(color, 0.08)); px(0, n - 2, 16, 1, color);
    for (let i = 1; i < 16; i += 4) { px(i, 1, 1, n - 1, color); px(i, 0, 1, 1, tone(color, 0.18)); px(i - 1, 1, 3, 1, color); }
  }, { repeat: true });
  const m = mat(0, bars);
  m.alphaTest = 0.5;
  const rail = box(x1 - x0, h, 0.04, { front: m, back: m, sides: mat(color), top: mat(color) });
  rail.position.set((x0 + x1) / 2, 0, z);
  rail.userData.noId = true;
  return rail;
}

export function tree(x, z, { seed = 3, scale = 1 } = {}) {
  const g = new THREE.Group();
  const trunk = box(0.28, 2.0, 0.28, { sides: mat(0x6b4636), top: mat(0x47302a) });
  g.add(part(trunk));
  const leaves = tile('leaves', 2);
  const leafM = mat(0, leaves);
  const r = rng(seed);
  const crown = new THREE.Group();
  for (const [cx, cy, cz, rr] of [[0, 2.9, 0, 1.25], [-0.75, 2.45, 0.25, 0.85], [0.8, 2.55, 0.15, 0.9], [0.1, 3.55, -0.2, 0.85], [0.2, 2.3, 0.6, 0.7]]) {
    const geo = new THREE.IcosahedronGeometry(rr * scale, 1);
    const uv = geo.attributes.uv;                                // the leaf tile at a texel a pixel, near enough
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * rr * 2 / 2, uv.getY(i) * Math.PI * rr / 2);
    const m = new THREE.Mesh(geo, leafM);
    m.position.set(cx * scale + (r() - 0.5) * 0.1, cy * scale, cz * scale);
    m.castShadow = m.receiveShadow = true;
    crown.add(m);
  }
  g.add(part(crown));
  g.position.set(x, 0, z);
  return g;
}

export function bench(x, z, { facing = 0 } = {}) {
  const g = new THREE.Group();
  const wood = mat(0, tile('planks', 1)), iron = mat(0x23252f);
  const seat = box(1.7, 0.08, 0.5, { sides: mat(0x6b4636), top: wood }); seat.position.y = 0.42; g.add(seat);
  const backr = box(1.7, 0.42, 0.07, { sides: mat(0x8f6345), front: wood }); backr.position.set(0, 0.55, -0.25); g.add(backr);
  for (const sx of [-0.75, 0.75]) { const l = box(0.08, 0.42, 0.46, { sides: iron }); l.position.x = sx; g.add(l); }
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  return part(g);
}

export function bin(x, z) {
  const g = new THREE.Group();
  const body = roundedBox(0.5, 0.85, 0.5, 0.06, { sides: mat(0x24503a), top: mat(0x356f42) });
  const lid = box(0.56, 0.08, 0.56, { sides: mat(0x173327) }); lid.position.y = 0.85;
  g.add(body, lid);
  g.position.set(x, 0, z);
  return part(g);
}

export function cafeTable(x, z) {
  const g = new THREE.Group();
  const top = roundedBox(0.6, 0.05, 0.6, 0.02, { sides: mat(0x8f96a6), top: mat(0xb8bdc8) }); top.position.y = 0.72; g.add(top);
  const leg = box(0.07, 0.72, 0.07, { sides: mat(0x23252f) }); g.add(leg);
  const cup = box(0.1, 0.08, 0.1, { sides: mat(0xf6f4ee) }); cup.position.set(0.12, 0.77, 0.05); g.add(cup);
  g.position.set(x, 0, z);
  return part(g);
}

export function chair(x, z, facing = 0) {
  const g = new THREE.Group();
  const m = mat(0x23252f);
  const seat = box(0.42, 0.05, 0.42, { sides: m }); seat.position.y = 0.44; g.add(seat);
  const backr = box(0.42, 0.45, 0.05, { sides: m }); backr.position.set(0, 0.46, -0.2); g.add(backr);
  for (const [sx, sz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const l = box(0.04, 0.44, 0.04, { sides: m }); l.position.set(sx, 0, sz); g.add(l); }
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  return part(g);
}

/** A car, 4.2 × 1.8 m, facing +x (rotate the group to turn it): painted sides, windows, lights. */
export function car(color = 0x3b6296, { taxi = false, seed = 5 } = {}) {
  const L = 4.2, Wd = 1.8, body = mat(color), dark = 0x23252f;
  const side = paint(Math.round(L * M), 12, (px, W, H) => {
    px(0, 0, W, H, color);
    px(0, 0, W, 1, 0xf6f4ee === color ? 0xdfe2e8 : 0xdfe2e8);  // the lit crease
    px(Math.floor(W * 0.32), 1, 1, H - 3, dark); px(Math.floor(W * 0.58), 1, 1, H - 3, dark);   // doors
    px(Math.floor(W * 0.4), 4, 3, 1, dark); px(Math.floor(W * 0.66), 4, 3, 1, dark);           // handles
    px(0, H - 3, W, 3, dark);                                    // the sill
  });
  const nose = paint(Math.round(Wd * M), 12, (px, W, H) => {
    px(0, 0, W, H, color); px(1, 3, 6, 3, 0xf8e08a); px(W - 7, 3, 6, 3, 0xf8e08a);              // headlights
    px(9, 4, W - 18, 4, dark); for (let i = 10; i < W - 9; i += 2) px(i, 5, 1, 2, 0x6a7182);   // grille
    px(0, H - 3, W, 3, dark);
  }, { glows: [0xf8e08a] });
  const tail = paint(Math.round(Wd * M), 12, (px, W, H) => {
    px(0, 0, W, H, color); px(1, 3, 5, 3, 0xc95c45); px(W - 6, 3, 5, 3, 0xc95c45);
    px(Math.floor(W / 2) - 4, 6, 8, 3, 0xe2dac6); px(Math.floor(W / 2) - 3, 7, 6, 1, dark);   // the plate
    px(0, H - 3, W, 3, dark);
  }, { glows: [0xc95c45] });
  const glass = paint(Math.round(2.3 * M), 10, (px, W, H) => {
    px(0, 0, W, H, color); px(2, 1, W - 4, H - 2, 0x283f6b); px(3, 1, Math.floor(W * 0.4), 3, 0x5d8fc2);
    px(Math.floor(W / 2), 1, 2, H - 2, color); px(4, 2, 2, 1, 0x95c1e3);
  });
  const screen = paint(Math.round(1.6 * M), 10, (px, W, H) => { px(0, 0, W, H, color); px(1, 1, W - 2, H - 2, 0x283f6b); px(2, 1, 6, 3, 0x5d8fc2); });
  const g = new THREE.Group();
  // Built long in z (its nose +z), then turned so the nose points along +x.
  const lower = roundedBox(Wd, 0.75, L, 0.1, { left: mat(0, side), right: mat(0, side), front: mat(0, nose), back: mat(0, tail), sides: body, top: body });
  lower.rotation.y = Math.PI / 2;                                // its front (+z) to +x
  lower.position.y = 0.3;
  const cabin = roundedBox(Wd - 0.2, 0.62, 2.3, 0.12, { left: mat(0, glass), right: mat(0, glass), front: mat(0, screen), back: mat(0, screen), sides: body, top: body });
  cabin.rotation.y = Math.PI / 2;
  cabin.position.set(-0.2, 1.02, 0);
  g.add(part(lower), part(cabin, lower.userData.part));
  for (const [sx, sz] of [[-1.3, 0.75], [1.3, 0.75], [-1.3, -0.75], [1.3, -0.75]]) {
    const wheel = box(0.62, 0.62, 0.26, { sides: mat(0x14151c), front: mat(0, paint(10, 10, (px) => { px(0, 0, 10, 10, 0x14151c); px(3, 3, 4, 4, 0x8f96a6); px(4, 4, 2, 2, 0x4c5262); })) });
    wheel.position.set(sx, 0, sz);
    g.add(part(wheel));
  }
  if (taxi) {
    const sign = mat(0, paint(16, 7, (px) => { px(0, 0, 16, 7, 0xf8e08a); text(px, 1, 1, 'TAXI', INK); }, { glows: [0xf8e08a] }));
    const t = box(1.0, 0.44, 0.3, { sides: mat(0xf8e08a), front: sign, back: sign });
    t.position.set(-0.2, 1.64, 0);
    g.add(part(t));
  }
  return g;
}
