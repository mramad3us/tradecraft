// TRADECRAFT art: a town for the pixel-art look (pixelart.js).
//
// Flat things are painted, things that stand out are boxes. The street's ground is one painted
// texture (paving slabs, kerbs, asphalt, lane marks, a zebra crossing, drains, a manhole, cracks,
// tree pits), as a 2D game draws its map. A building is a box whose front is a painted facade
// (bricks, plaster or concrete, windows with sills and lintels, shutters, doors, shopfronts, signs
// in a 3 × 5 pixel font, a cornice); what projects from it (an awning, a hanging sign) is a box of
// its own, and casts its shadow. Props (lamp posts, trees, benches, bins, café tables, cars) are a
// few boxes each, with painted faces where they need detail; their plain parts merged (compact()).
//
// Most come in makes, so a street isn't one thing repeated (the sim's looks, sim/map/street.js,
// choose them): five pavements, four kerbs, four asphalts, five centre lines and five zebras in the
// ground (fineStreet()); window heads (pediments, hoods, brick arches, arched heads, keystones),
// architraves, grilles, air conditioners and dishes, four kinds of door and of courtyard arch,
// rustication, quoins, pilasters, friezes, a panel block's joints and loggias, balconies, pipes,
// posters and scaffolding on the facades (painter()); roof clutter (building()); six lamps,
// five railings, five benches, five bins, six cars and a taxi, four hedges. Textures a make shares
// are made once and kept (keep()).
//
// Everything is measured in metres, painted at PX_PER_M pixels a metre, in PALETTE colours.
//
// The fine finish (finish.fine, sample 007, after Stoneshard) paints the same things with more care:
// bricks and slabs bevelled one by one, plaster weathered (mottled, grimy at the foot, cracked,
// fallen away in patches to the brick), window and door frames bevelled, glass with a reflection,
// dirt streaking down from the sills, ivy, and the street's clutter (weeds, puddles, litter, moss in
// the joints). The plain finish is untouched: sample 006 draws as it did.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PX_PER_M, GLOWS, mat, glow, paint, tile, box, roundedBox, ground, part, pool, rng, text, textWidth, finish, tone, noise, tnoise, fineBricks } from './pixelart.js';

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
    /** Concrete (a panel block's): mottled, damp-stained down from the joints, grimy at the foot; no brick behind it. */
    concrete(x, y, w, h, base) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M), sd = seed * 7;
      for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
        const v = noise(i / 6, j / 6, sd) * 0.6 + noise(i / 2, j / 2, sd + 1) * 0.4;
        let d = v < 0.3 ? -0.03 : v > 0.7 ? 0.02 : -0.005;
        const foot = hh - j;
        if (foot < 12 && noise(i / 3, j / 2, sd + 2) < (12 - foot) / 12) d -= 0.04;
        px(x0 + i, y0 + j, 1, 1, tone(base, d));
      }
      for (let k = 0; k < Math.max(2, Math.round(ww / 25)); k++) {   // damp stains running down
        const sx = Math.floor(r() * ww), sy = Math.floor(r() * hh * 0.8), len = 10 + Math.floor(r() * 30);
        for (let j = 0; j < len && sy + j < hh; j++) px(x0 + sx + (j % 7 === 6 ? 1 : 0), y0 + sy + j, 1 + (j < len / 2 ? 1 : 0), 1, tone(base, -0.05));
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
    /**
     * A window: frame, glass with a glint (or lit), mullion and transom, a sill, a lintel, shutters.
     * Its dress: a head over it (`head`: 'pediment', 'hood', 'segment' (a brick arch), 'round' (an
     * arched head over a tympanum), 'keystone', 'none'; else a plain lintel), a `surround` (an
     * architrave), `bars` (a ground floor's grille), an air conditioner (`ac`: 'below' | 'side'), a
     * satellite dish (`sat`), or a `ribbon` (a constructivist band of glass, mullions every 0.9 m).
     */
    window(x, y, w, h, { lit = false, frame = 0xdfe2e8, lintel = 0xc4bba9, shutters = null, curtain = null, flowers = null, head = null, surround = null, bars = false, ac = null, sat = false, ribbon = false } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (ribbon) return f.ribbon(x0, y0, ww, hh, frame);
      if (litR ? night && litR() < 0.4 : night && r() < 0.4) lit = true;   // at night, some rooms have the light on
      const hc = surround ?? lintel ?? 0xe2dac6, cx = x0 + Math.floor(ww / 2);
      if (surround) { px(x0 - 3, y0 - 3, ww + 6, hh + 3, surround); if (fine) bevel(x0 - 3, y0 - 3, ww + 6, hh + 3, surround); }
      if (head === 'pediment') {                                 // a triangle over a moulding, its tympanum a shade darker
        const half = Math.floor(ww / 2) + 3, rise = Math.max(3, Math.round(ww / 4.5)), yb = y0 - 3;
        for (let j = 0; j < rise; j++) { const hw = Math.round(half * (j + 1) / rise); px(cx - hw, yb - rise + j, 2 * hw + 1, 1, j === 0 ? tone(hc, 0.06) : tone(wall ?? hc, -0.04)); px(cx - hw, yb - rise + j, 2, 1, tone(hc, 0.05)); px(cx + hw - 1, yb - rise + j, 2, 1, tone(hc, -0.05)); }
        px(cx - half - 1, yb, 2 * half + 3, 2, hc); px(cx - half - 1, yb, 2 * half + 3, 1, tone(hc, 0.05));
        px(cx - half - 1, yb + 2, 2 * half + 3, 1, tone(wall ?? hc, -0.12));
      } else if (head === 'hood') {                              // a cornice hood on two brackets
        px(x0 - 3, y0 - 5, ww + 6, 2, hc); px(x0 - 3, y0 - 5, ww + 6, 1, tone(hc, 0.06)); px(x0 - 3, y0 - 3, ww + 6, 1, tone(wall ?? hc, -0.12));
        px(x0 - 2, y0 - 3, 1, 2, tone(hc, -0.04)); px(x0 + ww + 1, y0 - 3, 1, 2, tone(hc, -0.04));
      } else if (head === 'segment') {                           // a shallow arch of stone or brick
        for (let i = -1; i <= ww; i++) {
          const t = (i + 0.5) / (ww / 2) - 1, rise = Math.round(2.5 * (1 - t * t));
          px(x0 + i, y0 - 2 - rise, 1, 2 + rise, i === -1 ? tone(hc, 0.05) : hc); px(x0 + i, y0 - 2 - rise, 1, 1, tone(hc, 0.06));
        }
      } else if (head === 'round') {                             // an arched head: a tympanum under an arc of trim, a keystone
        const R = ww / 2 + 1, base = wall ?? hc;
        for (let i = -1; i <= ww; i++) {
          const t = (i + 0.5 - ww / 2) / R, top = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * R * 0.55);
          px(x0 + i, y0 - 1 - top, 1, top + 1, tone(base, -0.05));                       // the tympanum, set back
          for (let k = 2; k < top; k += 2) if ((i + k) % 3 === 0) px(x0 + i, y0 - 1 - k, 1, 1, tone(base, -0.08));   // its fan
          px(x0 + i, y0 - 2 - top, 1, 1, i < ww / 2 ? tone(base, 0.07) : tone(base, -0.1));   // the arch's moulding, lit on its left
          px(x0 + i, y0 - 1 - top, 1, 1, tone(base, -0.12));
        }
        px(cx - 1, y0 - 3 - Math.round(R * 0.55), 3, 3, tone(base, 0.08)); px(cx + 1, y0 - 2 - Math.round(R * 0.55), 1, 2, tone(base, -0.06));
      } else if (head !== 'none' && lintel) px(x0 - 1, y0 - 2, ww + 2, 2, lintel);
      if (head === 'keystone') { px(cx - 1, y0 - 5, 3, 4, hc); px(cx - 1, y0 - 5, 3, 1, tone(hc, 0.07)); px(cx + 1, y0 - 4, 1, 3, tone(hc, -0.07)); }
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
        if (lintel && !head) bevel(x0 - 1, y0 - 2, ww + 2, 2, lintel);
      }
      px(x0 + Math.floor(ww / 2), y0, 1, hh, frame);             // mullion
      px(x0, y0 + Math.floor(hh / 3), ww, 1, frame);             // transom
      if (bars) {                                                // a grille: bars, a rail, spikes over the top
        for (let i = x0 + 2; i < x0 + ww - 1; i += 3) { px(i, y0 - 1, 1, hh + 1, 0x23252f); px(i, y0 - 2, 1, 1, 0x4c5262); }
        px(x0 + 1, y0 + Math.floor(hh * 0.6), ww - 2, 1, 0x23252f); px(x0 + 1, y0 + 1, ww - 2, 1, 0x23252f);
      }
      px(x0 - 1, y0 + hh, ww + 2, 1, 0xf6f4ee);                  // sill, and its shadow
      px(x0 - 1, y0 + hh + 1, ww + 2, 1, 0x5c5650);
      if (fine) { streaks(x0, y0 + hh + 2, ww); px(x0 - 1, y0 + hh + 1, ww + 2, 1, tone(wall ?? 0x5c5650, -0.14)); }
      if (shutters) for (const sx of [x0 - 5, x0 + ww + 1]) {
        px(sx, y0, 4, hh, shutters);
        for (let j = 1; j < hh; j += 2) px(sx, y0 + j, 4, 1, INK === shutters ? 0x353947 : 0x24503a);
      }
      if (ac && !shutters) {                                     // an air conditioner, its grille, a drip stain under it
        const [ax, ay] = ac === 'side' ? [x0 + ww + 3, y0 + Math.floor(hh / 2) - 3] : [x0 + ww - 11, y0 + hh + 3];
        px(ax, ay, 11, 7, 0xdfe2e8); px(ax, ay, 11, 1, 0xf6f4ee); px(ax + 10, ay, 1, 7, 0xb8bdc8); px(ax, ay + 6, 11, 1, 0xb8bdc8);
        for (let k = 2; k < 9; k += 2) px(ax + 1, ay + k - 1, 6, 1, 0x8f96a6);
        px(ax + 7, ay + 2, 3, 3, 0x8f96a6); px(ax + 8, ay + 3, 1, 1, 0x4c5262);
        px(ax + 1, ay + 7, 9, 1, tone(wall ?? 0x8f96a6, -0.16));
        if (fine && wall) for (let j = 0; j < 4 + Math.floor(r() * 6); j++) px(ax + 5, ay + 8 + j, 1, 1, tone(wall, -0.06));
      }
      if (sat) { const sx = x0 + ww + 3, sy = y0 + 2; px(sx + 1, sy, 4, 6, 0xdfe2e8); px(sx, sy + 1, 6, 4, 0xdfe2e8); px(sx + 4, sy + 1, 1, 4, 0xb8bdc8); px(sx + 2, sy + 2, 1, 1, 0x6a7182); px(sx + 2, sy + 6, 1, 2, 0x6a7182); }
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
    /** A ribbon window (in pixels): one band of glass across a floor, mullions every 0.9 m, each pane lit on its own at night. */
    ribbon(x0, y0, ww, hh, frame) {
      px(x0, y0, ww, hh, frame);
      for (let a = x0 + 1; a < x0 + ww - 1; a += 14) {
        const b = Math.min(a + 13, x0 + ww - 1), lit = litR ? night && litR() < 0.4 : night && r() < 0.4, g = lit ? [0xe7b84a, 0xf8e08a] : [0x283f6b, 0x3b6296];
        px(a, y0 + 1, b - a, hh - 2, g[0]); px(a, y0 + 1, b - a, Math.floor((hh - 2) / 3), g[1]);
        if (!lit) { px(a + 1, y0 + 3, 1, 2, 0x95c1e3); if (fine) for (let k = 0; k < Math.min(b - a, hh) - 4; k++) px(b - 2 - k, y0 + 2 + k, 1, 1, tone(g[0], 0.08)); }
        if (fine) px(a, y0 + 1, b - a, 1, tone(g[0], -0.1));
      }
      px(x0, y0 + Math.floor(hh / 3), ww, 1, frame);
      if (fine) bevel(x0, y0, ww, hh, frame);
      px(x0, y0 + hh, ww, 1, tone(frame, 0.04)); px(x0, y0 + hh + 1, ww, 1, tone(wall ?? 0x5c5650, -0.14));
    },
    /** Banded rustication: a channel every 0.35 m, y0 … y1 (metres), lit along its lower lip. */
    rustic(y0, y1, c) {
      for (let y = Y(y1); y < Y(y0); y += 6) { px(0, y, W, 1, tone(wall ?? c, -0.1)); px(0, y + 1, W, 1, tone(wall ?? c, 0.04)); }
    },
    /** Ceramic tiles over a wall, y0 … y1: a fine grid, each tile its own tone. */
    tiles(y0, y1) {
      const base = wall ?? 0xe2dac6;
      for (let y = Y(y1); y < Y(y0); y += 4) for (let x = 0; x < W; x += 4) {
        const d = r();
        if (d < 0.25) px(x + 1, y + 1, 3, 3, tone(base, d < 0.08 ? -0.04 : 0.025));
        px(x, y, 4, 1, tone(base, -0.05)); px(x, y, 1, 4, tone(base, -0.04));
      }
    },
    /** Quoins at both corners, y0 … y1: dressed blocks, long and short in turn. */
    quoins(y0, y1, c) {
      for (let y = Y(y1), k = 0; y < Y(y0) - 1; y += 8, k++) {
        const w = k % 2 ? 7 : 11, h = Math.min(7, Y(y0) - y - 1);
        for (const x of [0, W - w]) { px(x, y, w, h, c); if (fine) bevel(x, y, w, h, c); }
      }
    },
    /** Pilasters at xs (metres, their middles), y0 … y1, with a base and a capital. */
    pilasters(xs, y0, y1, c) {
      for (const xm of xs) {
        const x = X(xm) - 3, top = Y(y1), bot = Y(y0);
        px(x, top, 6, bot - top, tone(c, -0.02)); px(x, top, 1, bot - top, tone(c, 0.05)); px(x + 5, top, 1, bot - top, tone(c, -0.08));
        px(x + 6, top + 3, 1, bot - top - 3, tone(wall ?? c, -0.1));          // its shadow on the wall
        px(x - 1, top, 8, 3, c); px(x - 1, top, 8, 1, tone(c, 0.06)); px(x - 1, top + 3, 8, 1, tone(c, -0.1));   // the capital
        px(x - 1, bot - 2, 8, 2, c); px(x - 1, bot - 2, 8, 1, tone(c, 0.05));                                      // the base
      }
    },
    /** A frieze under the cornice, from y (metres) h tall: 'tiles' (glazed, a flower every 8 px), 'corbel' (brick), 'garland'. */
    frieze(y, h, kind, c) {
      const top = Y(y + h), hh = Math.round(h * M);
      if (kind === 'tiles') {
        px(0, top, W, hh, c); px(0, top, W, 1, 0xf6f4ee); px(0, top + hh - 1, W, 1, tone(c, -0.12));
        for (let x = 0; x < W; x += 8) { px(x + 3, top + 2, 2, hh - 4, tone(c, 0.12)); px(x + 2, top + Math.floor(hh / 2) - 1, 4, 2, tone(c, 0.12)); px(x + 3, top + Math.floor(hh / 2) - 1, 2, 2, 0xf8e08a === c ? 0xe2dac6 : 0xe2dac6); px(x, top + 1, 1, hh - 2, tone(c, -0.06)); }
      } else if (kind === 'corbel') {
        for (let x = 0; x < W; x += 6) { px(x, top, 4, hh - 2, tone(c, -0.02)); px(x, top, 4, 1, tone(c, 0.05)); px(x + 3, top + 1, 1, hh - 3, tone(c, -0.1)); px(x, top + hh - 2, 4, 1, tone(c, -0.14)); }
        px(0, top - 1, W, 1, tone(c, 0.04));
      } else {
        px(0, top, W, hh, tone(c, -0.02)); px(0, top, W, 1, tone(c, 0.05)); px(0, top + hh - 1, W, 1, tone(wall ?? c, -0.12));
        for (let x = 0; x < W; x += 12) { for (let i = 0; i < 10; i++) { const d = Math.round(Math.sin(Math.PI * i / 9) * (hh - 4) * 0.6); px(x + 1 + i, top + 2 + d, 1, 1, tone(c, -0.1)); } px(x, top + 2, 2, 2, tone(c, 0.06)); }
      }
    },
    /** A panel block's joints: a line at every floor (fh metres) and between pairs of bays, y0 … y1. */
    panels(y0, y1, bays, fh) {
      const base = wall ?? 0xb8bdc8, step = W / Math.max(1, Math.round(bays / 2));
      for (let y = Y(y0) - Math.round(fh * M); y > Y(y1); y -= Math.round(fh * M)) { px(0, y, W, 1, tone(base, -0.1)); px(0, y + 1, W, 1, tone(base, 0.04)); }
      for (let x = step; x < W - 2; x += step) { px(Math.round(x), Y(y1), 1, Y(y0) - Y(y1), tone(base, -0.09)); px(Math.round(x) + 1, Y(y1), 1, Y(y0) - Y(y1), tone(base, 0.03)); }
    },
    /** Loggias stacked up the given columns ([x, w] of a window, metres), floors 1 … n of fh metres above y0: slabs, parapet panels, the shade inside. */
    loggias(cols, y0, floors, c, fh) {
      for (const [xm, wm] of cols) for (let f = 1; f <= floors; f++) {
        const x = X(xm) - 5, w = Math.round(wm * M) + 10, fl = Y(y0 + fh * (f - 1)), top = fl - Math.round(fh * M) + 1;
        px(x, top, w, 3, tone(c, -0.18));                                       // the shade under the slab above
        const ph = Math.round(1.05 * M), py = fl - ph;
        px(x, py, w, ph, c); px(x, py, w, 1, tone(c, 0.06)); px(x + w - 1, py, 1, ph, tone(c, -0.08));
        for (let i = x + 3; i < x + w - 2; i += 4) px(i, py + 2, 1, ph - 4, tone(c, -0.04));   // ribs
        px(x - 1, fl, w + 2, 2, tone(c, -0.03)); px(x - 1, fl + 2, w + 2, 1, tone(wall ?? c, -0.16));
      }
    },
    /** A balcony from x0 to x1 (metres) at y: a slab on consoles, a balustrade of stone or iron. */
    balcony(x0, x1, y, kind, c) {
      const a = X(x0), w = X(x1) - a, fl = Y(y), bh = Math.round(0.95 * M), top = fl - bh;
      if (kind === 'stone') {
        px(a, top, w, 2, c); px(a, top, w, 1, tone(c, 0.06));
        for (let i = a + 1; i < a + w - 1; i += 3) { px(i, top + 2, 2, bh - 3, tone(c, -0.03)); px(i, top + 4, 2, 2, tone(c, 0.04)); px(i + 1, top + 2, 1, bh - 3, tone(c, -0.09)); }
      } else {
        px(a, top, w, 1, 0x23252f); px(a, top + bh - 3, w, 1, 0x23252f);
        for (let i = a; i < a + w; i += 2) px(i, top + 1, 1, bh - 3, 0x23252f);
        for (let i = a + 2; i < a + w - 3; i += 6) { px(i, top + 4, 3, 1, 0x353947); px(i + 1, top + 3, 1, 3, 0x353947); }
      }
      px(a - 1, fl - 2, w + 2, 3, c); px(a - 1, fl - 2, w + 2, 1, tone(c, 0.05));            // the slab
      px(a - 1, fl + 1, w + 2, 1, tone(wall ?? c, -0.16));
      for (const x of [a + 1, a + w - 4]) { px(x, fl + 1, 3, 3, tone(c, -0.05)); px(x, fl + 4, 2, 1, tone(c, -0.08)); }   // consoles
    },
    /** A drainpipe at x (metres) from the gutter at `top` down to a spout: a hopper, collars, a splash. */
    pipe(x, top, c) {
      const a = X(x), y0 = Y(top), y1 = Y(0.25);
      px(a - 1, y0, 6, 3, tone(c, -0.03)); px(a - 1, y0, 6, 1, tone(c, 0.06));                // the hopper
      px(a, y0 + 3, 4, y1 - y0 - 3, c); px(a, y0 + 3, 1, y1 - y0 - 3, tone(c, 0.07)); px(a + 3, y0 + 3, 1, y1 - y0 - 3, tone(c, -0.08));
      px(a + 4, y0 + 3, 1, y1 - y0 - 3, tone(wall ?? c, -0.1));
      for (let y = y0 + 20; y < y1 - 2; y += 24) { px(a - 1, y, 6, 2, tone(c, -0.05)); px(a - 1, y, 6, 1, tone(c, 0.04)); }   // collars
      px(a, y1, 4, 2, c); px(a + 1, y1 + 2, 4, 2, tone(c, -0.04)); px(a + 1, y1 + 3, 4, 1, tone(c, -0.1));                   // the spout
    },
    /** Scaffolding over the floors y0 … y1: a builder's mesh (the facade showing through it), poles and boards. */
    scaffold(y0, y1, c, fh) {
      const top = Y(y1), bot = Y(y0);
      for (let y = top; y < bot; y++) for (let x = (y % 2); x < W; x += 2) px(x, y, 1, 1, tone(c, (x + y) % 4 === 0 ? 0.03 : 0));
      for (let x = 6; x < W - 2; x += 40) { px(x, top - 3, 2, bot - top + 3, 0x8f96a6); px(x, top - 3, 1, bot - top + 3, 0xb8bdc8); }
      for (let y = bot; y > top; y -= Math.round(fh * M)) { px(0, y - 2, W, 2, 0x8f6345); px(0, y - 2, W, 1, 0xb48459); }
      px(0, top, W, 1, tone(c, -0.1));
    },
    /** A plain parapet in place of a cornice: a band, a metal flashing along its top, a thin shadow. */
    parapet(y, h = 0.3, c = 0xe2dac6) {
      const base = wall ?? c, hh = Math.max(3, Math.round(h * M * 0.7));
      px(0, Y(y) - hh, W, hh, tone(base, 0.03)); px(0, Y(y) - hh - 1, W, 1, 0x8f96a6); px(0, Y(y) - hh, W, 1, 0xb8bdc8);
      px(0, Y(y), W, 1, tone(base, -0.1));
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
    /**
     * An arch through to the courtyard: a dark passage under a round head, the yard's daylight at its
     * end. `kind`: 'open', 'gate' (iron bars across, a leaf open), 'rect' (a square passage under a
     * lintel), 'doors' (a carriage door of planks, a fanlight grille in the head, a wicket in one leaf).
     */
    arch(x, w, h, { kind = 'open' } = {}) {
      const x0 = X(x), ww = Math.round(w * M), hh = Math.round(h * M), y0 = Y(h), rad = kind === 'rect' ? 0 : ww / 2;
      const inside = (i, j) => j >= rad || (i + 0.5 - rad) ** 2 + (rad - j - 0.5) ** 2 <= rad * rad;
      const sur = wall ?? 0xe2dac6;
      for (let j = -2; j < hh; j++) for (let i = -2; i < ww + 2; i++) {
        if (inside(i, j) && j >= 0) continue;
        if (inside(i + 2, j) || inside(i - 2, j) || inside(i, j + 2) || (j >= 0 && (i === -1 || i === ww))) px(x0 + i, y0 + j, 1, 1, tone(sur, j < rad ? 0.04 : -0.06));   // the surround
      }
      if (kind === 'rect') { px(x0 - 2, y0 - 4, ww + 4, 3, tone(sur, 0.04)); px(x0 - 2, y0 - 4, ww + 4, 1, tone(sur, 0.08)); px(x0 - 2, y0 - 1, ww + 4, 1, tone(sur, -0.1)); }
      const yard = [Math.round(ww * 0.3), Math.round(hh * 0.45)];
      for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
        if (!inside(i, j)) continue;
        const edge = Math.min(i, ww - 1 - i), inYard = Math.abs(i + 0.5 - ww / 2) < yard[0] / 2 && j >= hh - yard[1];
        let c = inYard ? (j === hh - yard[1] ? 0x4c5262 : j > hh - 4 ? 0x7d756c : 0x6a7182) : edge < 2 ? 0x14151c : j > hh - 3 ? 0x353947 : 0x23252f;
        if (kind === 'doors') {                                  // planks, a rail, studs; a fanlight grille in the head
          const open = i > ww * 0.12 && i < ww * 0.12 + 9 && j > hh - 30;
          c = j < rad ? ((i + j) % 4 === 0 || Math.abs(i - ww / 2) < 1 ? 0x6b4636 : 0x23252f) : open ? (inYard ? c : 0x23252f) : i % 4 === 0 ? 0x47302a : i === Math.floor(ww / 2) ? 0x2a1c18 : (j - rad) % 18 === 9 ? 0x6b4636 : 0x8f6345;
          if (!open && j >= rad && i % 8 === 2 && (j - rad) % 18 === 9) c = 0xc4bba9;
        }
        px(x0 + i, y0 + j, 1, 1, c);
      }
      if (kind === 'gate') {                                     // bars with spear tips, a rail at the spring, one leaf standing open
        const gap = [Math.floor(ww / 2) + 1, Math.floor(ww / 2) + 8];
        for (let i = 1; i < ww - 1; i += 3) {
          if (i >= gap[0] && i < gap[1]) continue;
          for (let j = 0; j < hh; j++) if (inside(i, j)) px(x0 + i, y0 + j, 1, 1, 0x4c5262);
        }
        for (const j of [Math.round(rad), hh - 4, Math.round(rad + (hh - rad) / 2)]) for (let i = 1; i < ww - 1; i++) if (!(i >= gap[0] && i < gap[1]) && inside(i, j)) px(x0 + i, y0 + j, 1, 1, 0x4c5262);
        for (let k = 0; k < 7; k++) px(x0 + gap[1] + Math.floor(k / 2), y0 + Math.round(rad) + 2 + k * 4, 1, 3, 0x4c5262);   // the open leaf, edge on
      }
      if (kind !== 'rect') px(x0 + Math.floor(ww / 2) - 1, y0 - 2, 3, 3, tone(sur, 0.08));   // the keystone
      else px(x0 + Math.floor(ww / 2) - 2, y0 - 5, 5, 5, tone(sur, 0.07));
      px(x0 - 1, y0 + hh, ww + 2, 1, 0x5c5650);
    },
    /**
     * A door: panels, a knob, a fanlight above, a step below. `style`: 'panel', 'glazed' (glass in its
     * upper half), 'metal' (a Soviet steel door, an entry phone beside it), 'arched' (a round fanlight
     * over it), 'shop' (a glass door in the shopfront's frame); `canopy`, a hood over it on brackets.
     */
    door(x, w, h, { color = 0x356f42, frame = 0xe2dac6, glass = true, style = 'panel', canopy = false } = {}) {
      const x0 = X(x), y0 = Y(h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (style === 'arched') {                                  // a half-round fanlight, its glazing bars fanning out
        const R = ww / 2 + 1, cx = x0 + ww / 2;
        for (let j = 0; j <= R; j++) for (let i = -1; i <= ww; i++) {
          const dx = i + 0.5 - ww / 2, dy = j, d = Math.hypot(dx, dy);
          if (d > R + 1.2) continue;
          const yy = y0 - 2 - j;
          px(x0 + i, yy, 1, 1, d > R - 0.5 ? (dx < 0 ? tone(frame, 0.04) : tone(frame, -0.04)) : (Math.abs(Math.atan2(dy, dx) * 4 / Math.PI % 1) < 0.18 || d < 2 ? frame : 0x283f6b));
        }
        px(Math.floor(cx) - 2, y0 - 4, 1, 1, 0x95c1e3);
      }
      px(x0 - 1, y0 - 4, ww + 2, hh + 4, frame);
      if (glass && style !== 'metal') { px(x0, y0 - 3, ww, 2, 0x3b6296); px(x0 + 1, y0 - 3, 1, 1, 0x95c1e3); }
      px(x0, y0, ww, hh, color);
      const dk = 0x173327 === color ? INK : 0x14151c;
      if (style === 'metal') {                                   // a steel slab: a stiffener, rivets, a handle; the entry phone
        px(x0, y0 + Math.floor(hh * 0.45), ww, 1, tone(color, -0.1)); px(x0, y0 + Math.floor(hh * 0.45) + 1, ww, 1, tone(color, 0.05));
        for (const yy of [y0 + 2, y0 + hh - 3]) for (const xx of [x0 + 2, x0 + ww - 3]) px(xx, yy, 1, 1, tone(color, 0.1));
        px(x0 + ww - 4, y0 + Math.floor(hh / 2) - 2, 2, 4, 0x8f96a6);
        px(x0 + ww + 2, y0 + Math.floor(hh * 0.35), 4, 6, 0x353947); px(x0 + ww + 3, y0 + Math.floor(hh * 0.35) + 1, 2, 1, 0x95c1e3);
        for (let k = 0; k < 2; k++) px(x0 + ww + 3, y0 + Math.floor(hh * 0.35) + 3 + k, 2, 1, 0x8f96a6);
      } else if (style === 'shop' || style === 'glazed') {        // glass in the frame (a shop's: most of it), a rail, a handle
        const gh = style === 'shop' ? hh - 7 : Math.floor(hh / 2) - 2;
        px(x0 + 2, y0 + 2, ww - 4, gh, 0x283f6b); px(x0 + 2, y0 + 2, ww - 4, 2, 0x3b6296); px(x0 + 3, y0 + 4, 1, 2, 0x95c1e3);
        if (fine) for (let k = 0; k < Math.min(ww - 6, gh - 3); k++) px(x0 + ww - 4 - k, y0 + 3 + k, 1, 1, tone(0x283f6b, 0.08));
        if (style === 'glazed') { px(x0 + Math.floor(ww / 2), y0 + 2, 1, gh, color); for (const a of [2, Math.ceil(ww / 2) + 1]) px(x0 + a, y0 + hh / 2 + 2, Math.floor(ww / 2) - 3, Math.floor(hh / 2) - 5, dk); }
        px(x0 + ww - 4, y0 + Math.floor(hh / 2), 2, 1, 0xb8bdc8);
      } else {
        for (const [a, b] of [[2, 2], [2, Math.floor(hh / 2) + 1]]) { px(x0 + a, y0 + b, Math.floor(ww / 2) - 3, Math.floor(hh / 2) - 3, dk); px(x0 + Math.ceil(ww / 2) + 1, y0 + b, Math.floor(ww / 2) - 3, Math.floor(hh / 2) - 3, dk); }
        px(x0 + ww - 3, y0 + Math.floor(hh / 2), 1, 1, 0xe7b84a);
        px(x0 + Math.floor(ww / 2), y0, 1, hh, dk);
      }
      if (fine) {
        bevel(x0 - 1, y0 - 4, ww + 2, 4, frame);
        if (style === 'panel' || style === 'arched') for (const [a, b] of [[2, 2], [2, Math.floor(hh / 2) + 1]]) for (const ax of [x0 + a, x0 + Math.ceil(ww / 2) + 1]) {
          const pw = Math.floor(ww / 2) - 3, ph = Math.floor(hh / 2) - 3;
          px(ax, y0 + b + ph, pw, 1, tone(color, 0.06)); px(ax + pw, y0 + b, 1, ph + 1, tone(color, 0.05));   // the panels' lit lips
        }
        px(x0, y0, ww, 1, tone(color, -0.12)); if (style === 'panel' || style === 'arched') px(x0 + ww - 3, y0 + Math.floor(hh / 2) - 1, 1, 1, 0xf8e08a);
        px(x0 - 2, y0 + hh, ww + 4, 1, tone(0xa0978a, 0.04));     // the step
      }
      if (canopy) {                                              // a hood over the door, on two brackets
        const cy = style === 'arched' ? y0 - Math.round(ww / 2) - 6 : y0 - 7, c = tone(wall ?? frame, 0.03);
        px(x0 - 4, cy, ww + 8, 2, c); px(x0 - 4, cy, ww + 8, 1, tone(c, 0.07)); px(x0 - 4, cy + 2, ww + 8, 1, tone(wall ?? c, -0.16));
        for (const bx of [x0 - 3, x0 + ww + 1]) { px(bx, cy + 2, 2, 2, tone(c, -0.04)); px(bx, cy + 4, 1, 1, tone(c, -0.06)); }
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
    /** A sign: a board with a border and centred text; or (`style`) 'letters' on the wall itself, or a 'lightbox'. */
    sign(x, y, w, h, str, { bg = 0x1b2541, fg = 0xf8e08a, border = 0xb9862e, style = 'board' } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      const tx = x0 + Math.floor((ww - textWidth(str)) / 2), ty = y0 + Math.floor((hh - 5) / 2);
      if (style === 'letters') {                                 // letters fixed to the wall, the one of its colours that stands out, a shadow
        const luma = (c) => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
        const back = luma(wall ?? 0x9e3c36), c = Math.abs(luma(fg) - back) > Math.abs(luma(bg) - back) ? fg : bg;
        text(px, tx + 1, ty + 1, str, tone(wall ?? 0x9e3c36, -0.2));
        text(px, tx, ty, str, c);
        return;
      }
      if (style === 'lightbox') {                                // a box: a dark case, a face lit along its top, end caps
        px(x0 - 1, y0, ww + 2, hh, 0x23252f); px(x0 + 1, y0 + 1, ww - 2, hh - 2, bg);
        px(x0 + 1, y0 + 1, ww - 2, 1, tone(bg, 0.08)); px(x0 + 1, y0 + hh - 2, ww - 2, 1, tone(bg, -0.08));
        px(x0 - 1, y0 + hh, ww + 2, 1, tone(wall ?? 0x5c5650, -0.14));
        text(px, tx, ty, str, fg);
        return;
      }
      px(x0, y0, ww, hh, border); px(x0 + 1, y0 + 1, ww - 2, hh - 2, bg);
      text(px, tx, ty, str, fg);
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
 * The fine finish also takes the street's looks (sim/map/street.js): `look` { a, b, breakX }, the
 * schemes west and east of breakX ({ paveN, paveS, kerb, road, lanes }: the pavements' surface, the
 * kerb stones, the asphalt, the line down the middle), `zebraKind` the crossing's paint, `rowSeed` (the
 * street's, for detail placed by where it is, so it matches across sections) and `leaves`, how much
 * of the autumn lies on the ground (0 … 1).
 */
export function street({ x0, x1, zB, zK1, zK2, z1, zebra = null, pits = [], seed = 7, ox = 0, calm = false, look = null, zebraKind = 'white', rowSeed = 0, leaves = 0 }) {
  const W = Math.round((x1 - x0) * M), H = Math.round((z1 - zB) * M);
  const X = (x) => Math.round((x - x0) * M), Z = (z) => Math.round((z - zB) * M);
  const tex = paint(W, H, (px) => {
    if (finish.fine) return fineStreet(px, W, X, Z, { x0, x1, zB, zK1, zK2, z1, zebra, pits, seed, ox, calm, look, zebraKind, rowSeed, leaves });
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

/** A hash of whole numbers to [0, 1): detail placed by where it is in the world, not drawn from a section's own dice. */
export function cell(i, j, s = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The street's ground in the fine finish: the same layout, every slab and kerb stone bevelled, moss in
// the joints, the asphalt mottled and patched and cracked, worn paint, weeds at the walls' foot,
// puddles, manholes, leaves and litter where they fell. The looks (street()) choose each part's make:
//   - pavements: 'slabs' (0.75 × 0.6 m concrete in running bond), 'squares' (0.5 m, stack bond),
//     'granite' (a metre by 0.75, speckled, pinkish), 'pavers' (0.5 × 0.25 m in stretcher bond, a
//     darker border along the kerb and the wall), 'asphalt' (Soviet tarmac, patched);
//   - kerbs: 'granite' (pale stones a metre long), 'concrete' (cool grey), 'worn' (chipped, some sunk),
//     'painted' (black and white, a metre each);
//   - the road: 'worn', 'fresh' (dark, smooth), 'patched', 'grey' (old and pale, tar-sealed cracks);
//   - the line down the middle: 'dashed', 'solid', 'double', 'long' (long dashes), 'combo' (solid beside broken);
//   - the zebra: 'white', 'yellow' (white and yellow, Moscow's), 'faded' (an older one's ghost beside
//     it), 'fresh' (crisp, with edge lines), 'raised' (on a table, the ramps marked); the modern ones
//     with yellow tactile paving at both kerbs.
// Every pattern repeats in whole periods of the section's 720 pixels, and a slab's or a stone's tone
// comes from its world place (cell(), rowSeed), so sections join without a seam; a change of make
// comes only at breakX (a crossing's line). Clutter (puddles, manholes, litter, leaves) is placed by
// the section's own dice, inside it.
function fineStreet(px, W, X, Z, { x0, zB, zK1, zK2, z1, zebra, pits, seed, ox = 0, calm = false, look = null, zebraKind = 'white', rowSeed = 0, leaves = 0 }) {
  const r = rng(seed);
  const SL = 0xc4bba9, AS = 0x4c5262, K = rowSeed;
  const plain = { paveN: 'slabs', paveS: 'slabs', kerb: 'granite', road: 'worn', lanes: 'dashed' };
  const A = look?.a ?? plain, B = look?.b ?? plain;
  const bx = look ? Math.max(0, Math.min(W, X(look.breakX))) : 0;
  const spans = A === B || bx <= 0 ? [[0, W, B]] : bx >= W ? [[0, W, A]] : [[0, bx, A], [bx, W, B]];
  const noisy = (x, y, base, d, s, sc = 3) => { const v = noise((x + ox) / sc, y / sc, s); return tone(base, d + (v < 0.25 ? -0.03 : v > 0.8 ? 0.02 : 0)); };
  // A bevelled stone: its face mottled, lit along the top and left, shaded along the bottom; only the
  // edges that are its own (a stone cut by a break keeps no lit edge at the cut).
  const stone = (a, b, j, w, h, base, d, cut, s = 1) => {
    for (let y = 0; y < h; y++) for (let x = Math.max(a, cut[0]); x < Math.min(a + w, b, cut[1]); x++) px(x, j + y, 1, 1, noisy(x, j + y, base, d, seed + s));
    const xa = Math.max(a, cut[0]), xb = Math.min(a + w, b, cut[1]);
    if (xb <= xa) return;
    px(xa, j, xb - xa, 1, tone(base, d + 0.05));
    if (a >= cut[0]) px(a, j, 1, h, tone(base, d + 0.03));
    px(xa, j + h - 1, xb - xa, 1, tone(base, d - 0.06));
  };
  // A pavement band, rows ya … yb, over the columns xa … xb, of a kind.
  const pave = (ya, yb, xa, xb, kind) => {
    const cut = [xa, xb];
    if (kind === 'asphalt') {
      const base = 0x5f5e63;
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const k = noise((x + ox) * 7.31, y * 5.17, seed + 14); px(x, y, 1, 1, k < 0.08 ? tone(base, -0.05) : k > 0.95 ? tone(base, 0.04) : base); }
      for (let i = 0; i < (xb - xa) / 110; i++) {                   // patches of newer tarmac, a lip round them
        const w = 10 + Math.floor(r() * 16), h = 4 + Math.floor(r() * 5), x = xa + 2 + Math.floor(r() * Math.max(1, xb - xa - w - 4)), y = ya + 2 + Math.floor(r() * Math.max(1, yb - ya - h - 3));
        px(x, y, w, h, tone(base, -0.04)); px(x, y, w, 1, tone(base, 0.03));
      }
      for (let k = 0; k < (xb - xa) / 70; k++) { let cx = xa + Math.floor(r() * (xb - xa)), cy = ya + 2 + Math.floor(r() * Math.max(1, yb - ya - 4)); for (let n = 0; n < 8 + r() * 12 && cx < xb; n++) { if (cy >= ya && cy < yb) px(cx, cy, 1, 1, tone(base, -0.11)); cx++; cy += r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0; } }
      return;
    }
    const [pw, ph, shift, base] = { slabs: [12, 10, 6, SL], squares: [8, 8, 0, 0xb8b0a4], granite: [16, 12, 8, 0xb4a296], pavers: [8, 4, 4, 0xa8a49c] }[kind] ?? [12, 10, 6, SL];
    px(xa, ya, xb - xa, yb - ya, tone(base, -0.15));                 // the joints
    for (let j = ya, row = 0; j < yb; j += ph, row++) {
      const off = (row % 2) * shift, h = Math.min(ph - 1, yb - j);
      if (h <= 0) continue;
      const border = kind === 'pavers' && (row < 2 || j + ph * 2 >= yb);
      for (let a = xa - (((xa + off) % pw) + pw) % pw - pw; a < xb; a += pw) {
        if (a + pw - 1 <= xa) continue;
        const k = Math.floor((a + ox + pw) / pw), u = cell(k, row, K + 3), v = cell(k, row, K + 4);
        let d = (u - 0.5) * 0.06 + (v < 0.04 ? -0.05 : 0);
        let c = base;
        if (border) { c = 0x8f6a5c; d = (u - 0.5) * 0.05; }
        else if (kind === 'squares' && v > 0.985) c = tone(0xb8b0a4, -0.07);             // one replaced by a darker one
        else if (kind === 'pavers' && u > 0.9) d -= 0.05;
        stone(a, xb, j, pw - 1, h, c, d, cut, kind === 'granite' ? 21 : 1);
        if (kind === 'granite') for (let n = 0; n < 7; n++) { const gx = a + Math.floor(cell(k, row * 9 + n, K + 5) * (pw - 2)) + 1, gy = j + 1 + Math.floor(cell(k, row * 9 + n, K + 6) * (h - 2)); if (gx >= xa && gx < xb) px(gx, gy, 1, 1, tone(c, n % 3 ? -0.08 : 0.06)); }   // the grain
        const cr = cell(k, row, K + 7);
        if (cr < (kind === 'squares' ? 0.07 : 0.045) && pw > 6 && a + 6 < xb && a >= xa) { px(a + 3, j + 3, 1, 1, tone(c, -0.18)); px(a + 4, j + 4, 2, 1, tone(c, -0.18)); if (h > 5) px(a + 6, j + 5, 1, 1, tone(c, -0.18)); }   // a crack
        if (cell(k, row, K + 8) < 0.3 && a + pw - 1 >= xa && a + pw - 1 < xb) px(a + pw - 1, j + Math.floor(cell(k, row, K + 9) * h), 1, 1 + (cell(k, row, K + 10) < 0.5 ? 1 : 0), tone(0x356f42, -0.06));   // moss in the joint
      }
    }
  };
  // The road: asphalt, its grain and repairs by its kind; cracks.
  const road = (xa, xb, kind) => {
    const base = kind === 'fresh' ? tone(AS, -0.05) : AS;     // (old tarmac shows by its grain and tarred cracks: any paler and the light warms it to brown)
    const [lo, hi] = kind === 'fresh' ? [0.04, 0.98] : kind === 'grey' ? [0.1, 0.84] : [0.08, 0.95];
    for (let y = Z(zK1); y < Z(zK2); y++) for (let x = xa; x < xb; x++) {
      if (calm) { const k = noise((x + ox) * 7.31, y * 5.17, seed + 4); px(x, y, 1, 1, k < lo ? tone(base, -0.05) : k > hi ? tone(base, 0.04) : base); continue; }
      const v = noise((x + ox) / 3.5, y / 3.5, seed + 4) * 0.7 + noise((x + ox) / 1.3, y / 1.3, seed + 5) * 0.3;
      px(x, y, 1, 1, tone(base, v < 0.3 ? -0.035 : v > 0.72 ? 0.025 : 0));
    }
    const n = (xb - xa) / W;
    const repairs = Math.round(n * { worn: 7, fresh: 1, patched: 15, grey: 5 }[kind]), cracks = Math.round(n * { worn: 9, fresh: 2, patched: 12, grey: 11 }[kind]);
    for (let i = 0; i < repairs; i++) {                            // repairs: a patch with a raised lip
      const w = 12 + Math.floor(r() * 18), h = 5 + Math.floor(r() * 6), x = xa + 2 + Math.floor(r() * Math.max(1, xb - xa - w - 4)), y = Z(zK1) + 5 + Math.floor(r() * (Z(zK2) - Z(zK1) - 14));
      const d = kind === 'patched' && r() < 0.4 ? 0.03 : -0.06;
      px(x, y, w, h, tone(base, d)); px(x, y, w, 1, tone(base, d + 0.1)); px(x, y + h, w, 1, tone(base, -0.1));
    }
    for (let k = 0; k < cracks; k++) {                             // cracks (on old grey tarmac, sealed with tar: wider and black)
      let cx = xa + Math.floor(r() * (xb - xa)), cy = Z(zK1) + 4 + Math.floor(r() * (Z(zK2) - Z(zK1) - 8));
      for (let n = 0; n < 10 + r() * 16 && cx < xb; n++) { px(cx, cy, 1, kind === 'grey' ? 2 : 1, kind === 'grey' ? 0x23252f : tone(base, -0.12)); cx++; cy += r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0; }
    }
  };
  // Kerbs: stones a metre long, bevelled, by their kind.
  const kerb = (y, face, xa, xb, kind) => {
    for (let i = xa - xa % 16; i < xb; i += 16) {
      const k = Math.floor((i + ox) / 16), u = cell(k, y, K + 11), a = Math.max(i, xa), w = Math.min(i + 15, xb) - a;
      if (w <= 0) continue;
      let top = 0xe2dac6, fc = 0xa0978a, d = (u - 0.5) * 0.06;
      if (kind === 'concrete') { top = 0xc8ccd2; fc = 0x8f96a6; d *= 0.5; }
      if (kind === 'worn') { top = tone(0xc4bba9, -0.04); fc = 0x7d756c; d = (u - 0.5) * 0.12; }
      if (kind === 'painted') { const black = k % 2 === 0; top = black ? 0x353947 : 0xf4efe6; fc = black ? 0x23252f : 0xc4bba9; }
      const sunk = kind === 'worn' && u > 0.85;
      px(a, y, w, 2, tone(top, d)); if (!sunk) px(a, y, w, 1, tone(top, d + 0.04));
      if (i + 15 < xb) px(i + 15, y, 1, 2 + (face ? 2 : 0), tone(0xa0978a, -0.12));
      if (face) { px(a, y + 2, w, 2, tone(fc, d)); px(a, y + 3, w, 1, tone(fc, d - 0.06)); }
      if (kind === 'painted' || kind === 'worn') for (let n = 0; n < 3; n++) { const c = cell(k, n, K + 12); if (c < 0.5) { const cx = a + Math.floor(c * 2 * w); px(cx, y + (n % 2), 1, 1, kind === 'painted' ? tone(0xa0978a, 0.02) : tone(top, -0.14)); } }   // chips, worn paint
    }
  };

  for (const [xa, xb, s] of spans) road(xa, xb, s.road);
  for (const [xa, xb, s] of spans) { pave(Z(zB), Z(zK1), xa, xb, s.paveN); pave(Z(zK2), Z(z1), xa, xb, s.paveS); }
  px(0, 0, W, 2, tone(0x7d756c, -0.04));                         // the foot of the buildings
  for (const [xa, xb, s] of spans) kerb(Z(zK1) - 2, true, xa, xb, s.kerb);
  px(0, Z(zK1) + 2, W, 1, 0x23252f);                             // the gutter
  for (let i = 0; i < W; i++) if (r() < 0.06) px(i, Z(zK1) + 2 + Math.floor(r() * 2), 1, 1, [0x8f6345, 0xb9862e, 0xc95c45, 0xdfe2e8][Math.floor(r() * 4)]);
  px(0, Z(zK2) - 1, W, 1, tone(AS, -0.1));
  for (const [xa, xb, s] of spans) kerb(Z(zK2), false, xa, xb, s.kerb);
  // The line down the middle and the zebra, the paint worn through in places.
  const worn = (x, y, w, h, c, wear = 0.22, s = 6) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (noise((x + i + ox) / 2, (y + j) / 2, seed + s) > wear) px(x + i, y + j, 1, 1, i === 0 || j === 0 ? tone(c, 0.02) : c); };
  const mid = Z((zK1 + zK2) / 2), zx = zebra ? [X(zebra[0]) - 10, X(zebra[1]) + 10] : [-1, -1];
  for (const [xa, xb, s] of spans) {
    const clear = (a, w) => { for (let x = a; x < a + w; x++) if (x >= xa && x < xb && (x < zx[0] || x >= zx[1])) worn(x, mid, 1, 2, 0xdfe2e8); };
    if (s.lanes === 'solid') clear(xa, xb - xa);
    else if (s.lanes === 'double') { for (let x = xa; x < xb; x++) if (x < zx[0] || x >= zx[1]) { worn(x, mid - 2, 1, 1, 0xdfe2e8); worn(x, mid + 1, 1, 1, 0xdfe2e8); } }
    else if (s.lanes === 'combo') {                              // a solid line beside a broken one: overtaking one way only
      for (let x = xa; x < xb; x++) if (x < zx[0] || x >= zx[1]) worn(x, mid - 2, 1, 1, 0xdfe2e8);
      for (let i = xa - xa % 80; i < xb; i += 80) for (let x = Math.max(i, xa); x < Math.min(i + 40, xb); x++) worn(x, mid + 1, 1, 1, 0xdfe2e8);
    } else {                                                     // broken: dashes of 2.5 m every 5 m, or long ones (3.75 in 5)
      const dash = s.lanes === 'long' ? 60 : 40;
      for (let i = xa - xa % 80; i < xb; i += 80) for (let x = Math.max(i, xa); x < Math.min(i + dash, xb); x++) worn(x, mid, 1, 2, 0xdfe2e8);
    }
  }
  for (let i = ((24 - ox) % 128 + 128) % 128; i < W; i += 128) { px(i - 1, Z(zK1) + 2, 9, 5, tone(AS, -0.12)); px(i, Z(zK1) + 3, 7, 3, 0x23252f); for (let k = 1; k < 7; k += 2) px(i + k, Z(zK1) + 4, 1, 1, 0x6a7182); }   // drains
  // Manholes on the road, one or two, round or a square hatch; a utility hatch on a pavement now and then.
  for (let n = 0, count = 1 + (r() < 0.45 ? 1 : 0); n < count; n++) {
    const mx = 10 + Math.floor(r() * (W - 20)), mz = Z(zK1) + 10 + Math.floor(r() * Math.max(1, Z(zK2) - Z(zK1) - 20));
    if (zebra && mx > zx[0] - 6 && mx < zx[1] + 6) continue;
    if (r() < 0.65) {
      px(mx - 5, mz - 4, 11, 9, tone(0x353947, 0.03)); px(mx - 4, mz - 5, 9, 11, tone(0x353947, 0.03));
      px(mx - 3, mz - 4, 7, 9, 0x23252f); px(mx - 4, mz - 3, 9, 7, 0x23252f);
      for (let k = -2; k <= 2; k += 2) px(mx - 3, mz + k, 7, 1, 0x4c5262);
      px(mx - 4, mz - 5, 9, 1, tone(0x6a7182, 0.06));
    } else {
      px(mx - 4, mz - 4, 9, 9, tone(0x353947, 0.02)); px(mx - 3, mz - 3, 7, 7, 0x23252f);
      for (let k = -3; k <= 3; k += 2) { px(mx + k, mz - 3, 1, 7, 0x4c5262); }
      px(mx - 4, mz - 4, 9, 1, tone(0x6a7182, 0.06));
    }
  }
  if (r() < 0.5) { const hx = 8 + Math.floor(r() * (W - 16)), hz = r() < 0.5 ? Z(zB) + 8 + Math.floor(r() * Math.max(1, Z(zK1) - Z(zB) - 18)) : Z(zK2) + 6 + Math.floor(r() * Math.max(1, Z(z1) - Z(zK2) - 12)); px(hx - 3, hz - 2, 7, 5, tone(0x6a7182, -0.04)); px(hx - 2, hz - 1, 5, 3, tone(0x4c5262, 0.02)); px(hx - 3, hz - 2, 7, 1, tone(0x8f96a6, 0.02)); }
  if (zebra) {
    const xa = X(zebra[0]), xb = X(zebra[1]), w = xb - xa, top = Z(zK1) + 4, bot = Z(zK2) - 4;
    if (zebraKind === 'raised') {                                // a table: paler asphalt, its ramps marked with teeth
      px(xa - 8, Z(zK1) + 3, w + 16, Z(zK2) - Z(zK1) - 4, tone(AS, 0.05));
      for (const [ra, dir] of [[xa - 8, 1], [xb + 2, -1]]) for (let y = Z(zK1) + 5; y < Z(zK2) - 4; y += 8) for (let k = 0; k < 4; k++) px(dir > 0 ? ra + k : ra + 5 - k, y + k, 1, 4 - k > 0 ? 7 - 2 * k : 1, 0xdfe2e8);
    }
    if (zebraKind === 'faded') for (let z = top + 5; z < bot; z += 10) worn(xa + 3, z, w, 6, tone(AS, 0.03), 0.5, 8);   // an older zebra's ghost
    const wear = { white: 0.22, yellow: 0.2, faded: 0.52, fresh: 0.06, raised: 0.12 }[zebraKind] ?? 0.22;
    for (let z = top, n = 0; z < bot; z += 10, n++) worn(xa, z, w, 6, zebraKind === 'yellow' && n % 2 ? tone(0xe7b84a, -0.04) : zebraKind === 'fresh' ? 0xf6f4ee : 0xdfe2e8, wear);
    if (zebraKind === 'fresh') { worn(xa - 3, top - 1, 1, bot - top + 2, 0xf6f4ee, 0.06); worn(xb + 2, top - 1, 1, bot - top + 2, 0xf6f4ee, 0.06); }
    px(xa - 2, Z(zK1) - 2, w + 4, 2, 0xb8bdc8);                    // dropped kerbs
    px(xa - 2, Z(zK2), w + 4, 2, 0xb8bdc8);
    if (zebraKind === 'yellow' || zebraKind === 'fresh' || zebraKind === 'raised') {   // tactile paving, at both kerbs
      for (const y0 of [Z(zK1) - 2 - 9, Z(zK2) + 2]) {
        if (y0 < 1 || y0 + 9 > Z(z1)) continue;
        px(xa, y0, w, 9, tone(0xe7b84a, -0.1));
        for (let y = y0 + 1; y < y0 + 8; y += 2) for (let x = xa + 1 + (y % 4 === 1 ? 0 : 1); x < xb - 1; x += 2) px(x, y, 1, 1, tone(0xe7b84a, 0.02));
        px(xa, y0 + 8, w, 1, tone(0xb9862e, -0.1));
      }
    }
  }
  // Puddles, where the ground sags: by the kerbs, now and then on a pavement. The sky in them, a dark
  // rim along their far edge.
  for (let n = 0, count = 1 + Math.floor(r() * 4); n < count; n++) {
    const rw = 7 + Math.floor(r() * 15), rh = 3 + Math.floor(r() * 3), cx = rw + 2 + Math.floor(r() * (W - 2 * rw - 4));
    const where = r(), cy = where < 0.4 ? Z(zK2) - rh - 2 : where < 0.7 ? Z(zK1) + rh + 3 : where < 0.85 ? Z(zK2) + rh + 4 : Z(zB) + Math.floor((Z(zK1) - Z(zB)) * (0.3 + r() * 0.4));
    const s = seed + 7 + n;
    for (let j = -rh; j <= rh; j++) for (let i = -rw; i <= rw; i++) {
      const e = (i / rw) ** 2 + (j / rh) ** 2 + (noise((cx + i) / 3, (cy + j) / 3, s) - 0.5) * 0.8;
      if (e > 1) continue;
      px(cx + i, cy + j, 1, 1, e > 0.8 && j < 0 ? 0x353947 : (i - j * 2) % 9 === 0 && e < 0.6 ? 0xb8bdc8 : j < -rh / 3 ? 0x6a7182 : 0x8f96a6);
    }
  }
  // Weeds where the pavement meets the walls (green, or dry by November), and a few in the kerbs.
  for (let i = 0; i < W; i += 4 + Math.floor(r() * 14)) {
    const y = 2 + Math.floor(r() * 2), g = leaves > 0.3 && r() < 0.5 ? 0x8f6345 : 0x4f8f45;
    px(i, y + 1, 1, 1, tone(g, -0.1)); px(i + 1, y, 1, 1, tone(g, 0.02)); if (r() < 0.6) px(i - 1, y, 1, 1, tone(g, -0.04)); if (r() < 0.4) px(i + 1, y - 1, 1, 1, tone(g, 0.1));
  }
  // Fallen leaves: thick by the far kerb's gutter and along the near pavement's edge (the boulevard's
  // trees), thin elsewhere; and litter: a cigarette end, a ticket, a bottle cap.
  const LEAVES = [0xb9862e, 0xc95c45, 0x8f6345, 0x7a5a22, tone(0xe7b84a, -0.05), 0x6b4636];
  if (leaves > 0) {
    const drop = (y0, y1, count) => { for (let n = 0; n < count; n++) { const x = Math.floor(r() * W), y = y0 + Math.floor(r() * Math.max(1, y1 - y0)), c = LEAVES[Math.floor(r() * LEAVES.length)]; px(x, y, 1, 1, c); if (r() < 0.45) px(x + 1, y, 1, 1, tone(c, -0.06)); } };
    drop(Z(z1) - 10, Z(z1), Math.round(W * 0.35 * leaves));
    drop(Z(zK2) - 4, Z(zK2), Math.round(W * 0.12 * leaves));
    drop(Z(zK2) + 2, Z(z1), Math.round(W * 0.12 * leaves));
    drop(Z(zB) + 2, Z(zK1) - 2, Math.round(W * 0.05 * leaves));
  }
  for (let n = 0; n < 6 + Math.floor(r() * 8); n++) {
    const x = 2 + Math.floor(r() * (W - 4)), onRoad = r() < 0.3, y = onRoad ? Z(zK1) + 3 + Math.floor(r() * 3) : r() < 0.5 ? Z(zB) + 3 + Math.floor(r() * Math.max(1, Z(zK1) - Z(zB) - 6)) : Z(zK2) + 3 + Math.floor(r() * Math.max(1, Z(z1) - Z(zK2) - 5));
    const k = r();
    if (k < 0.4) { px(x, y, 1, 1, 0xe2dac6); px(x + 1, y, 1, 1, 0xc95c45); }   // a cigarette end
    else if (k < 0.7) { px(x, y, 2, 1, 0xf6f4ee); px(x, y + 1, 2, 1, 0xb8bdc8); }   // a ticket, a scrap of paper
    else px(x, y, 1, 1, 0xb8bdc8);                                // a bottle cap
  }
  for (const [x, z] of pits) {                                   // tree pits: soil, an iron grate, leaves
    const a = X(x) - 10, b = Z(z) - 8;
    px(a, b, 20, 16, tone(0x5c5650, 0.03)); px(a + 1, b + 1, 18, 14, 0x47302a);
    for (let k = 2; k < 18; k += 3) { px(a + k, b + 1, 1, 14, 0x2a1c18); px(a + k, b + 1, 1, 1, 0x6b4636); }
    for (let i = 0; i < 14; i++) px(a + 2 + Math.floor(r() * 16), b + 2 + Math.floor(r() * 12), 1, 1, [0x4f8f45, 0x76ad4c, 0xb9862e][Math.floor(r() * 3)]);
  }
}

/** A building's painted front, w × h metres: the wall ('brick', 'plaster' or 'concrete'), then draw(f) with painter() (see building()). */
export function facade({ w, h, wall = 'brick', wallColor, draw, seed = 1, night = false, split = false }) {
  return paint(Math.round(w * M), Math.round(h * M), (px) => {
    const f = painter(px, w, h, seed, night, wall === 'brick' ? null : wallColor ?? 0xe2dac6, split);
    if (wall === 'brick') f.bricks(0, 0, w, h, wallColor ?? 0x9e3c36);
    else if (wall === 'concrete' && finish.fine) f.concrete(0, 0, w, h, wallColor ?? 0xb8bdc8);
    else f.plaster(0, 0, w, h, wallColor ?? 0xe2dac6);
    draw?.(f);
  }, { glows: GLOWS });
}

// Textures and materials shared between props of one make (a bench's planks, a car's sides in one
// colour, a railing's bars): made once, marked `keep` so a section freeing its meshes leaves them
// (src/render/town.js dispose()).
const shared = new Map();
/** A material made once per key and kept (see above). */
export function keep(key, make) {
  if (!shared.has(key)) { const m = make(); m.userData.keep = true; if (m.map) m.map.userData.keep = true; shared.set(key, m); }
  return shared.get(key);
}

/**
 * A building: a box x0..x1 wide, h tall, d deep, its front at z (facing the street, +z). draw(f)
 * paints the facade with painter(); the sides are wall, the roof flat (with a parapet) or pitched.
 * The group's userData.body is the box, its material[4] the front (to swap for a night one).
 * `kit`, what stands on a flat roof: 'ac' (an air-conditioning plant), 'chimneys', 'hut' (the stair's
 * head house), 'antenna', 'none'; placed by `seed` (none given: the plant, where it always stood).
 */
export function building({ x0, x1, z, h, d = 8, wall = 'brick', wallColor, roof = 'flat', roofColor = 0x6a7182, kit = null, draw, seed = 1, night = false, split = false }) {
  const w = x1 - x0;
  const g = new THREE.Group();
  const front = facade({ w, h, wall, wallColor, draw, seed, night, split });
  const sides = keep(`side-${wall}`, () => mat(0, wall === 'brick' ? tile('brick', 1) : tile('plaster', 1)));
  const body = box(w, h, d, { front: mat(0, front), sides, top: mat(roofColor) });
  body.position.set((x0 + x1) / 2, 0, z - d / 2);
  g.add(part(body));
  g.userData.body = body;
  if (roof === 'flat') {                                         // a parapet, and something on the roof
    const lip = box(w, 0.3, 0.25, { sides: mat(0xc4bba9), top: mat(0xe2dac6) });
    lip.position.set((x0 + x1) / 2, h, z - 0.125);
    g.add(part(lip, body.userData.part));
    const r = rng(seed * 13 + 5), at = (k) => x0 + 1.2 + (w - 2.4) * k;
    if (kit === null || kit === 'ac') {
      const front = keep('roof-ac', () => mat(0, paint(19, 11, (px) => { px(0, 0, 19, 11, 0xb8bdc8); px(2, 2, 9, 7, 0x6a7182); for (let k = 2; k < 9; k += 2) px(2, k, 9, 1, 0x4c5262); px(13, 3, 4, 1, 0x6a7182); })));
      const ac = box(1.2, 0.7, 0.9, { sides: mat(0xb8bdc8), top: mat(0xdfe2e8), front });
      if (kit === null) ac.position.set(x0 + w * 0.7, h, z - 2); else ac.position.set(at(r()), h, z - 2 - r() * 2);
      g.add(part(ac));
    } else if (kit === 'chimneys') {                             // brick stacks, a cap on each
      for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
        const stack = box(0.6, 1.1 + r() * 0.6, 0.6, { sides: keep('chimney', () => mat(0, tile('brick', 1))), top: mat(0x353947) });
        const x = at(r()), zz = z - 1.5 - r() * 4;
        stack.position.set(x, h, zz); g.add(part(stack));
        const cap = box(0.75, 0.1, 0.75, { sides: mat(0x8f96a6) }); cap.position.set(x, h + stack.geometry.parameters.height, zz); g.add(part(cap, stack.userData.part));
      }
    } else if (kit === 'hut') {                                  // the stair's head house: plaster, a door
      const door = keep('roof-hut', () => mat(0, paint(29, 22, (px) => { px(0, 0, 29, 22, 0xc4bba9); px(0, 0, 29, 1, 0xe2dac6); px(17, 6, 7, 16, 0x6a7182); px(18, 7, 5, 15, 0x4c5262); px(22, 14, 1, 1, 0xb8bdc8); })));
      const hut = box(1.8, 1.4, 1.6, { sides: mat(0xc4bba9), top: mat(0x8f96a6), front: door });
      hut.position.set(at(r()), h, z - 2.5 - r() * 2); g.add(part(hut));
    } else if (kit === 'antenna') {                              // a mast with its crossbars
      const x = at(r()), zz = z - 2 - r() * 3, iron = mat(0x6a7182);
      const mast = box(0.07, 2.4, 0.07, { sides: iron }); mast.position.set(x, h, zz); g.add(mast);
      for (const [y, l] of [[1.6, 1.1], [2.0, 0.8], [2.3, 0.5]]) { const bar = box(l, 0.05, 0.05, { sides: iron }); bar.position.set(x, h + y, zz); g.add(bar); }
      part(mast);
    }
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
  const stripes = keep(`awning-${color}`, () => mat(0, paint(16, 16, (px) => { for (let x = 0; x < 16; x++) px(x, 0, 1, 16, Math.floor(x / 4) % 2 ? 0xf6f4ee : color); }, { repeat: true })));
  const edge = keep(`valance-${color}`, () => mat(0, paint(8, 5, (px) => { for (let x = 0; x < 8; x++) px(x, 0, 1, 5, Math.floor(x / 4) % 2 ? 0xf6f4ee : color); px(1, 4, 2, 1, 0x23252f); px(5, 4, 2, 1, 0x23252f); }, { repeat: true })));
  const g = new THREE.Group();
  const len = Math.hypot(depth, drop);
  const top = box(w, 0.08, len, { sides: mat(color), top: stripes, bottom: mat(0x6e2a2e) });
  top.geometry.translate(0, 0, len / 2);
  top.rotation.x = Math.atan2(drop, depth);
  top.position.set((x0 + x1) / 2, y, z);
  const valance = box(w, 0.3, 0.06, { sides: mat(color), front: edge });
  valance.position.set((x0 + x1) / 2, y - drop - 0.3, z + depth);
  g.add(top, valance);
  return part(g);
}

/** A sign standing out from the wall (a blade), lettered on both faces. */
export function bladeSign(x, y, z, str, { bg = 0x6e2a2e, fg = 0xf8e08a } = {}) {
  const w = 1.0, h = ([...str].length * 6 + 5) / M;
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

/**
 * A sign hung from a bracket over a door, its board facing the street (a short word: БАР, ХЛЕБ);
 * its top at height y, x its middle, against the wall at z.
 */
export function hangingSign(x, y, z, str, { bg = 0x6e2a2e, fg = 0xf8e08a } = {}) {
  const W = Math.max(12, textWidth(str) + 6), H = 9, w = W / M, h = H / M;
  const face = keep(`hanging-${str}-${bg}-${fg}`, () => mat(0, paint(W, H, (px) => {
    px(0, 0, W, H, 0xb9862e); px(1, 1, W - 2, H - 2, bg); px(1, 1, W - 2, 1, tone(bg, 0.08));
    text(px, Math.floor((W - textWidth(str)) / 2), 2, str, fg);
  }, { glows: [fg] })));
  const g = new THREE.Group(), iron = mat(0x23252f);
  const board = box(w, h, 0.05, { front: face, back: face, sides: mat(0xb9862e) });
  board.position.set(x, y - h - 0.12, z + 0.5); g.add(board);
  const arm = box(0.05, 0.05, 0.62, { sides: iron }); arm.position.set(x, y, z + 0.31); g.add(arm);
  for (const dx of [-w / 2 + 0.06, w / 2 - 0.06]) { const c = box(0.03, 0.12, 0.03, { sides: iron }); c.position.set(x + dx, y - 0.12, z + 0.5); g.add(c); }
  return part(g);
}

// ---------- props ----------

/**
 * A prop's plain parts (one flat colour on every face) merged into one mesh a colour: a lamp of
 * nine boxes draws as two or three. `except`: parts left alone (a lamp's heads, which light at night).
 */
function compact(g, except = []) {
  const byMat = new Map();
  for (const m of [...g.children]) {
    if (!m.isMesh || except.includes(m)) continue;
    const mats = [m.material].flat();
    if (mats.some(x => x !== mats[0]) || mats[0].map) continue;
    m.updateMatrix();
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    geo.clearGroups();
    if (!byMat.has(mats[0])) byMat.set(mats[0], []);
    byMat.get(mats[0]).push(geo);
    g.remove(m); m.geometry.dispose();
  }
  for (const [material, geos] of byMat) {
    const mesh = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], material);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

/**
 * A lamp post, of a make (`kind`), its head `reach` metres out toward +z from the post (over its
 * light; 0, on top of the post; negative, out the other way). userData.heads are the parts that light
 * at night (userData.head the first); `pool` false leaves its light to the caller.
 *   - 'lantern': an iron post, a square lantern on an arm (or on top);
 *   - 'crook': a Soviet street light, a grey pole bent over, a cobra head;
 *   - 'twin': a cross-arm with two lanterns;
 *   - 'modern': a slim pole, a flat LED head on a straight arm;
 *   - 'globe': a park lamp, a white globe on a swan neck;
 *   - 'torch': a boulevard candelabra, three globes.
 */
export function lamp(x, z, { lit = false, pool: withPool = true, kind = 'lantern', reach = 0.5 } = {}) {
  const g = new THREE.Group();
  const iron = mat(0x23252f), heads = [];
  const lens = (c = 0xf8e08a) => lit ? glow(0xf8e08a) : mat(c);
  const add = (m, px0, py, pz) => { m.position.set(px0, py, pz); g.add(m); return m; };
  const arm = (y, from, to, c = iron, t = 0.08) => { if (Math.abs(to - from) > 0.05) add(box(t, t, Math.abs(to - from), { sides: c }), 0, y, (from + to) / 2); };
  const lantern = (px0, py, pz, s = 1) => {
    heads.push(add(box(0.36 * s, 0.44 * s, 0.36 * s, { sides: lens(), top: iron, bottom: lit ? glow(0xf8e08a) : iron }), px0, py, pz));
    add(box(0.46 * s, 0.08, 0.46 * s, { sides: iron }), px0, py + 0.44 * s, pz);
  };
  const globe = (px0, py, pz, r = 0.21) => heads.push(add(roundedBox(2 * r, 2 * r, 2 * r, r * 0.9, { sides: lens(0xf6f4ee), top: lens(0xf6f4ee) }), px0, py, pz));
  if (kind === 'crook') {
    const grey = mat(0x8f96a6);
    add(box(0.24, 0.5, 0.24, { sides: mat(0x6a7182) }), 0, 0, 0);
    add(box(0.13, 3.7, 0.13, { sides: grey }), 0, 0, 0);
    arm(3.62, 0, reach, grey, 0.09);
    if (Math.abs(reach) < 0.05) add(box(0.09, 0.2, 0.09, { sides: grey }), 0, 3.7, 0);
    add(box(0.3, 0.14, 0.52, { sides: mat(0x6a7182), top: mat(0x8f96a6) }), 0, 3.5, reach + Math.sign(reach || 1) * 0.12);
    heads.push(add(box(0.24, 0.06, 0.42, { sides: lens(0xf6f4ee) }), 0, 3.44, reach + Math.sign(reach || 1) * 0.12));
  } else if (kind === 'twin') {
    add(box(0.32, 0.4, 0.32, { sides: iron }), 0, 0, 0);
    add(box(0.12, 3.3, 0.12, { sides: iron }), 0, 0, 0);
    arm(3.25, 0, reach);
    add(box(0.9, 0.07, 0.07, { sides: iron }), 0, 3.25, reach);
    for (const sx of [-0.42, 0.42]) { add(box(0.05, 0.25, 0.05, { sides: iron }), sx, 3.0, reach); lantern(sx, 2.6, reach, 0.8); }
    add(box(0.1, 0.25, 0.1, { sides: iron }), 0, 3.32, reach);
  } else if (kind === 'modern') {
    const dark = mat(0x4c5262);
    add(box(0.2, 0.3, 0.2, { sides: dark }), 0, 0, 0);
    add(box(0.1, 3.9, 0.1, { sides: dark }), 0, 0, 0);
    arm(3.82, 0, reach, dark, 0.06);
    add(box(0.26, 0.08, 0.56, { sides: dark, top: mat(0x6a7182) }), 0, 3.78, reach + Math.sign(reach || 1) * 0.1);
    heads.push(add(box(0.2, 0.03, 0.48, { sides: lens(0xdfe2e8) }), 0, 3.75, reach + Math.sign(reach || 1) * 0.1));
  } else if (kind === 'globe') {
    add(box(0.26, 0.3, 0.26, { sides: iron }), 0, 0, 0);
    add(box(0.1, 2.7, 0.1, { sides: iron }), 0, 0, 0);
    arm(2.7, 0, reach * 0.8, iron, 0.07);
    add(box(0.07, 0.25, 0.07, { sides: iron }), 0, 2.5, reach * 0.8);
    globe(0, 2.06, reach * 0.8);
  } else if (kind === 'torch') {
    add(box(0.36, 0.5, 0.36, { sides: iron, top: mat(0x353947) }), 0, 0, 0);
    add(box(0.13, 2.9, 0.13, { sides: iron }), 0, 0, 0);
    arm(2.9, 0, reach);
    add(box(0.8, 0.07, 0.07, { sides: iron }), 0, 2.9, reach);
    for (const [sx, y] of [[-0.38, 2.97], [0.38, 2.97], [0, 3.22]]) globe(sx, y, reach, 0.18);
  } else {                                                       // the lantern
    add(box(0.32, 0.4, 0.32, { sides: iron }), 0, 0, 0);
    if (Math.abs(reach) < 0.05) { add(box(0.12, 2.9, 0.12, { sides: iron }), 0, 0, 0); lantern(0, 2.9, 0); }
    else { add(box(0.12, 3.4, 0.12, { sides: iron }), 0, 0, 0); arm(3.3, 0, reach); lantern(0, 2.9, reach); }
  }
  compact(g, heads);
  g.position.set(x, 0, z);
  part(g);
  const head = heads[0];
  if (lit && withPool) g.add(pool(0, 2.7, head.position.z, { r: 2.0 }));    // its pool of light
  g.userData.head = head;
  g.userData.heads = heads;
  return g;
}

/**
 * An iron railing along x from x0 to x1 at z, painted on a thin box with the gaps cut out (alphaTest),
 * so the street shows through. It draws its own ink, so it stays out of the outline pass. Its pattern
 * is laid from the world's x, so pieces meet without a jump. `kind`:
 *   - 'spears': bars with spear tops between two rails (0.9 m);
 *   - 'hoops': a low fence of overlapping hoops (0.5 m), green;
 *   - 'cast': cast-iron panels of rings between posts with finials (1 m);
 *   - 'pipe': a Soviet railing of painted tubes on posts (0.8 m);
 *   - 'mesh': a modern barrier, slim bars in a frame, posts every 2 m (0.9 m).
 */
export const RAILINGS = { spears: [0.9, 0x23252f, 1], hoops: [0.5, 0x24503a, 1], cast: [1.0, 0x23252f, 2], pipe: [0.8, 0x356f42, 2], mesh: [0.9, 0x6a7182, 2] };
export function railing(x0, x1, z, { kind = 'spears', h: hh = null, color: cc = null } = {}) {
  const [h0, c0, period] = RAILINGS[kind] ?? RAILINGS.spears;
  const h = hh ?? h0, color = cc ?? c0, n = Math.round(h * M), pw = period * M;
  const m = keep(`railing-${kind}-${n}-${color}`, () => {
    const bars = paint(pw, n, (px) => {
      if (kind === 'hoops') {
        for (let x = 0; x < pw; x++) for (const c of [0, pw / 2]) {
          const t = (x - c + pw / 2 + pw) % pw - pw / 2;
          if (Math.abs(t) > 6) continue;
          const y = Math.round(n - 1 - Math.sqrt(Math.max(0, 36 - t * t)) * (n - 2) / 6);
          px(x, y, 1, 1, Math.abs(t) < 2 ? tone(color, 0.12) : color);
        }
        for (let x = 0; x < pw; x += 8) px(x + 2, n - 2, 1, 2, tone(color, -0.1));
      } else if (kind === 'cast') {
        px(0, 2, pw, 1, tone(color, 0.12)); px(0, 3, pw, 1, color); px(0, n - 4, pw, 2, color); px(0, n - 4, pw, 1, tone(color, 0.08));
        px(0, 0, 3, n, color); px(1, 0, 1, n, tone(color, 0.12)); px(0, 0, 3, 1, tone(color, 0.18));                       // the post, a finial
        for (let x = 6; x < pw - 2; x += 5) {
          px(x, 4, 1, n - 8, color);
          const cy = Math.floor(n / 2), rr = 2;
          for (let a = 0; a < 12; a++) px(x + 2 + Math.round(Math.cos(a * Math.PI / 6) * rr), cy + Math.round(Math.sin(a * Math.PI / 6) * rr), 1, 1, a < 6 ? color : tone(color, 0.1));
        }
      } else if (kind === 'pipe') {
        for (const y of [1, Math.floor(n / 2)]) { px(0, y, pw, 2, color); px(0, y, pw, 1, tone(color, 0.12)); }
        px(0, 0, 3, n, color); px(0, 0, 1, n, tone(color, 0.12)); px(0, 0, 3, 1, tone(color, 0.15));
      } else if (kind === 'mesh') {
        px(0, 1, pw, 1, tone(color, 0.14)); px(0, 2, pw, 1, color); px(0, n - 3, pw, 2, color);
        for (let x = 4; x < pw - 1; x += 3) px(x, 3, 1, n - 6, tone(color, 0.06));
        px(0, 0, 3, n, tone(color, -0.06)); px(0, 0, 1, n, tone(color, 0.1)); px(0, 0, 3, 1, tone(color, 0.18));
      } else {
        px(0, 2, pw, 1, tone(color, 0.12)); px(0, 3, pw, 1, color);
        px(0, n - 3, pw, 1, tone(color, 0.08)); px(0, n - 2, pw, 1, color);
        for (let i = 1; i < pw; i += 4) { px(i, 1, 1, n - 1, color); px(i, 0, 1, 1, tone(color, 0.18)); px(i - 1, 1, 3, 1, color); }
      }
    }, { repeat: true });
    const mm = mat(0, bars);
    mm.alphaTest = 0.5;
    return mm;
  });
  const rail = box(x1 - x0, h, 0.04, { front: m, back: m, sides: mat(color), top: mat(color) });
  const uv = rail.geometry.attributes.uv, shift = (((x0 / period) % 1) + 1) % 1;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + shift);
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

/** Planks in a colour (a bench's seat and back): a texture made once a colour. */
const planks = (c) => keep(`planks-${c}`, () => {
  if (c === 0x8f6345) return mat(0, tile('planks', 1));
  return mat(0, paint(16, 16, (px) => { for (let x = 0; x < 16; x += 4) { const d = ((x * 7) % 5 - 2) * 0.015; px(x, 0, 4, 16, tone(c, d)); px(x, 0, 1, 16, tone(c, d + 0.06)); px(x + 3, 0, 1, 16, tone(c, -0.16)); } }, { repeat: true }));
});

/**
 * A bench, len long, facing +z (or `facing`), of a make (`kind`):
 *   - 'slats': wooden slats on iron legs (the game's first);
 *   - 'moscow': green-painted slats between cast-iron ends with scrolled arms;
 *   - 'backless': slats on two concrete blocks;
 *   - 'sofa': a deep seat and a tall back, dark wood, iron ends;
 *   - 'granite': a granite block with a wooden top.
 */
export function bench(x, z, { facing = 0, len = 2.1, kind = 'slats' } = {}) {
  const g = new THREE.Group(), iron = mat(0x23252f), h = len / 2 - 0.1;
  const add = (m, px0, py, pz) => { m.position.set(px0, py, pz); g.add(m); return m; };
  const legsAt = len > 3 ? [-h, 0, h] : [-h, h];
  if (kind === 'moscow') {
    const wood = planks(0x356f42);
    add(box(len - 0.1, 0.07, 0.46, { sides: mat(0x24503a), top: wood }), 0, 0.42, 0.02);
    add(box(len - 0.1, 0.36, 0.06, { sides: mat(0x24503a), front: wood }), 0, 0.58, -0.24);
    for (const sx of legsAt) {
      add(box(0.07, 0.45, 0.5, { sides: iron }), sx, 0, 0);
      add(box(0.07, 0.5, 0.07, { sides: iron }), sx, 0.45, -0.26);
      if (sx !== 0) { add(box(0.07, 0.06, 0.42, { sides: iron }), sx, 0.68, 0.0); add(box(0.07, 0.2, 0.07, { sides: iron }), sx, 0.48, 0.2); }
    }
  } else if (kind === 'backless') {
    const wood = planks(0x8f6345), stone = mat(0xa0978a);
    add(box(len, 0.08, 0.48, { sides: mat(0x6b4636), top: wood }), 0, 0.42, 0);
    for (const sx of [-h + 0.1, h - 0.1]) add(box(0.22, 0.42, 0.44, { sides: stone, top: mat(0xc4bba9) }), sx, 0, 0);
  } else if (kind === 'sofa') {
    const wood = planks(0x6b4636);
    add(box(len - 0.1, 0.08, 0.5, { sides: mat(0x47302a), top: wood }), 0, 0.42, 0.02);
    add(box(len - 0.1, 0.62, 0.07, { sides: mat(0x47302a), front: wood }), 0, 0.5, -0.24);
    add(box(len - 0.1, 0.06, 0.12, { sides: mat(0x47302a), top: mat(0x6b4636) }), 0, 1.12, -0.22);
    for (const sx of legsAt) add(box(0.08, 0.42, 0.5, { sides: iron }), sx, 0, 0);
    for (const sx of [-h, h]) { add(box(0.08, 0.3, 0.08, { sides: iron }), sx, 0.5, 0.2); add(box(0.08, 0.06, 0.46, { sides: iron }), sx, 0.78, -0.02); }
  } else if (kind === 'granite') {
    add(box(len, 0.36, 0.5, { sides: mat(0x7d756c), top: mat(0x8f8a84) }), 0, 0, 0);
    add(box(len - 0.06, 0.07, 0.46, { sides: mat(0x6b4636), top: planks(0xb48459) }), 0, 0.36, 0);
  } else {
    const wood = planks(0x8f6345);
    add(box(len, 0.08, 0.5, { sides: mat(0x6b4636), top: wood }), 0, 0.42, 0);
    add(box(len, 0.42, 0.07, { sides: mat(0x8f6345), front: wood }), 0, 0.55, -0.25);
    for (const sx of legsAt) add(box(0.08, 0.42, 0.46, { sides: iron }), sx, 0, 0);
  }
  compact(g);
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  return part(g);
}

/**
 * A litter bin, 0.5 m square, of a make (`kind`): 'green' (a rounded box with a lid), 'urn' (a
 * Soviet concrete urn on a stem), 'basket' (an iron basket of bars), 'tulip' (a tipping bin hung
 * between two posts), 'box' (a modern steel box with a slot).
 */
export function bin(x, z, { kind = 'green' } = {}) {
  const g = new THREE.Group();
  const add = (m, px0, py, pz) => { m.position.set(px0, py, pz); g.add(m); return m; };
  if (kind === 'urn') {
    const stone = mat(0xa0978a);
    add(box(0.36, 0.12, 0.36, { sides: mat(0x7d756c), top: mat(0x8f8a84) }), 0, 0, 0);
    add(box(0.2, 0.26, 0.2, { sides: stone }), 0, 0.12, 0);
    add(roundedBox(0.5, 0.44, 0.5, 0.1, { sides: stone, top: mat(0xc4bba9) }), 0, 0.36, 0);
    add(box(0.34, 0.02, 0.34, { sides: mat(0x23252f) }), 0, 0.79, 0);
  } else if (kind === 'basket') {
    const bars = keep('bin-basket', () => { const mm = mat(0, paint(8, 12, (px) => { px(0, 0, 8, 2, 0x23252f); px(0, 0, 8, 1, 0x4c5262); px(0, 10, 8, 2, 0x23252f); for (let x = 0; x < 8; x += 2) px(x, 2, 1, 8, 0x23252f); }, { repeat: true })); mm.alphaTest = 0.5; return mm; });
    add(box(0.44, 0.75, 0.44, { sides: bars, top: mat(0x23252f) }), 0, 0.05, 0);
    add(box(0.38, 0.6, 0.38, { sides: mat(0x353947), top: mat(0x14151c) }), 0, 0.1, 0);
    add(box(0.5, 0.06, 0.5, { sides: mat(0x23252f), top: mat(0x353947) }), 0, 0.78, 0);
  } else if (kind === 'tulip') {
    const post = mat(0x4c5262);
    for (const sx of [-0.23, 0.23]) add(box(0.05, 0.92, 0.05, { sides: post }), sx, 0, 0);
    add(roundedBox(0.38, 0.46, 0.38, 0.05, { sides: mat(0x6a7182), top: mat(0x23252f) }), 0, 0.3, 0);
    add(box(0.42, 0.05, 0.05, { sides: post }), 0, 0.88, 0);
  } else if (kind === 'box') {
    const front = keep('bin-box', () => mat(0, paint(7, 14, (px) => { px(0, 0, 7, 14, 0x4c5262); px(0, 0, 7, 1, 0x6a7182); px(1, 2, 5, 2, 0x14151c); px(3, 7, 1, 3, 0xdfe2e8); px(2, 8, 3, 1, 0xdfe2e8); })));
    add(box(0.44, 0.9, 0.44, { sides: mat(0x4c5262), top: mat(0x8f96a6), front }), 0, 0, 0);
  } else {
    add(roundedBox(0.5, 0.85, 0.5, 0.06, { sides: mat(0x24503a), top: mat(0x356f42) }), 0, 0, 0);
    add(box(0.56, 0.08, 0.56, { sides: mat(0x173327) }), 0, 0.85, 0);
  }
  compact(g);
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

// Car makes, all on the same 4.2 × 1.8 m: the body's height and how high it rides, the cabin's
// length, where it sits (x, back from the middle), its height, and how round the corners are.
const CARS = {
  sedan: { body: 0.75, ride: 0.3, cab: 2.3, at: -0.2, cabH: 0.62, round: 0.1 },
  boxy: { body: 0.7, ride: 0.3, cab: 2.2, at: -0.15, cabH: 0.62, round: 0.04, chrome: true },
  hatch: { body: 0.72, ride: 0.3, cab: 2.5, at: -0.5, cabH: 0.64, round: 0.1 },
  estate: { body: 0.74, ride: 0.3, cab: 2.9, at: -0.55, cabH: 0.62, round: 0.08, rack: true },
  van: { body: 0.9, ride: 0.32, cab: 3.6, at: -0.2, cabH: 0.85, round: 0.2 },
  suv: { body: 0.82, ride: 0.42, cab: 2.5, at: -0.35, cabH: 0.66, round: 0.08, spare: true },
};
/**
 * A car, 4.2 × 1.8 m, facing +x (rotate the group to turn it): painted sides, windows, lights. `kind`
 * a make (CARS: a sedan, a boxy Soviet saloon with chrome bumpers, a hatchback, an estate with a roof
 * rack, a van, an SUV with a spare wheel; 'taxi' a yellow sedan with its chequered band and roof
 * sign). Its painted faces are made once a make and colour.
 */
export function car(color = 0x3b6296, { taxi = false, seed = 5, kind = 'sedan' } = {}) {
  if (kind === 'taxi') { taxi = true; kind = 'sedan'; color = 0xe7b84a; }
  const K = CARS[kind] ?? CARS.sedan;
  const L = 4.2, Wd = 1.8, body = mat(color), dark = 0x23252f, key = `${kind}-${color}-${taxi}`;
  const side = keep(`car-side-${key}`, () => mat(0, paint(Math.round(L * M), Math.round(K.body * 16), (px, W, H) => {
    px(0, 0, W, H, color);
    px(0, 0, W, 1, 0xdfe2e8);                                    // the lit crease
    px(Math.floor(W * 0.32), 1, 1, H - 3, dark); px(Math.floor(W * 0.58), 1, 1, H - 3, dark);   // doors
    if (kind === 'van') px(Math.floor(W * 0.8), 1, 1, H - 3, dark);
    px(Math.floor(W * 0.4), 4, 3, 1, dark); px(Math.floor(W * 0.66), 4, 3, 1, dark);           // handles
    if (taxi) for (let x = 0; x < W; x += 2) { px(x, 6, 1, 1, x % 4 ? 0xf6f4ee : dark); px(x + 1, 7, 1, 1, x % 4 ? dark : 0xf6f4ee); }   // the chequered band
    if (K.chrome) px(0, H - 4, W, 1, 0xb8bdc8);
    px(0, H - 3, W, 3, dark);                                    // the sill
  })));
  const nose = keep(`car-nose-${key}`, () => mat(0, paint(Math.round(Wd * M), Math.round(K.body * 16), (px, W, H) => {
    px(0, 0, W, H, color); px(1, 3, 6, 3, 0xf8e08a); px(W - 7, 3, 6, 3, 0xf8e08a);              // headlights
    px(9, 4, W - 18, 4, dark); for (let i = 10; i < W - 9; i += 2) px(i, 5, 1, 2, 0x6a7182);   // grille
    if (K.chrome) px(0, H - 4, W, 2, 0xdfe2e8);
    px(0, H - 3, W, 3, dark);
  }, { glows: [0xf8e08a] })));
  const tail = keep(`car-tail-${key}`, () => mat(0, paint(Math.round(Wd * M), Math.round(K.body * 16), (px, W, H) => {
    px(0, 0, W, H, color); px(1, 3, 5, 3, 0xc95c45); px(W - 6, 3, 5, 3, 0xc95c45);
    px(Math.floor(W / 2) - 4, 6, 8, 3, 0xe2dac6); px(Math.floor(W / 2) - 3, 7, 6, 1, dark);   // the plate
    if (K.chrome) px(0, H - 4, W, 2, 0xdfe2e8);
    px(0, H - 3, W, 3, dark);
  }, { glows: [0xc95c45] })));
  const glass = keep(`car-glass-${key}`, () => mat(0, paint(Math.round(K.cab * M), Math.round(K.cabH * 16), (px, W, H) => {
    px(0, 0, W, H, color); px(2, 1, W - 4, H - 2, 0x283f6b); px(3, 1, Math.floor(W * 0.4), 3, 0x5d8fc2);
    for (let k = 1; k < Math.round(K.cab / 1.15); k++) px(Math.floor(W * k / Math.round(K.cab / 1.15)), 1, 2, H - 2, color);
    px(4, 2, 2, 1, 0x95c1e3);
  })));
  const screen = keep(`car-screen-${key}`, () => mat(0, paint(Math.round((Wd - 0.2) * M), Math.round(K.cabH * 16), (px, W, H) => { px(0, 0, W, H, color); px(1, 1, W - 2, H - 2, 0x283f6b); px(2, 1, 6, 3, 0x5d8fc2); })));
  const g = new THREE.Group();
  // Built long in z (its nose +z), then turned so the nose points along +x.
  const lower = roundedBox(Wd, K.body, L, K.round, { left: side, right: side, front: nose, back: tail, sides: body, top: body });
  lower.rotation.y = Math.PI / 2;                                // its front (+z) to +x
  lower.position.y = K.ride;
  const cabin = roundedBox(Wd - 0.2, K.cabH, K.cab, Math.min(0.12, K.round + 0.04), { left: glass, right: glass, front: screen, back: screen, sides: body, top: body });
  cabin.rotation.y = Math.PI / 2;
  cabin.position.set(K.at, K.ride + K.body - 0.03, 0);
  g.add(part(lower), part(cabin, lower.userData.part));
  const wheelFace = keep('car-wheel', () => mat(0, paint(10, 10, (px) => { px(0, 0, 10, 10, 0x14151c); px(3, 3, 4, 4, 0x8f96a6); px(4, 4, 2, 2, 0x4c5262); })));
  const wr = kind === 'suv' ? 0.72 : 0.62;
  for (const [sx, sz] of [[-1.3, 0.75], [1.3, 0.75], [-1.3, -0.75], [1.3, -0.75]]) {
    const wheel = box(wr, wr, 0.26, { sides: mat(0x14151c), front: wheelFace });
    wheel.position.set(sx, 0, sz);
    g.add(part(wheel));
  }
  if (K.rack) for (const dx of [-0.9, 0.2]) { const bar = box(0.06, 0.06, Wd - 0.3, { sides: mat(0x23252f) }); bar.position.set(K.at + dx, K.ride + K.body + K.cabH - 0.03, 0); g.add(part(bar, cabin.userData.part)); }
  if (K.spare) { const sp = box(0.2, 0.6, 0.6, { sides: mat(0x14151c), top: mat(0x23252f) }); sp.position.set(-2.2, K.ride + 0.1, 0); g.add(part(sp)); }
  if (taxi) {
    const sign = keep('taxi-sign', () => mat(0, paint(16, 7, (px) => { px(0, 0, 16, 7, 0xf8e08a); text(px, 1, 1, 'TAXI', INK); }, { glows: [0xf8e08a] })));
    const t = box(1.0, 0.44, 0.3, { sides: mat(0xf8e08a), front: sign, back: sign });
    t.position.set(K.at, K.ride + K.body + K.cabH - 0.06, 0);
    g.add(part(t));
  }
  return g;
}

/**
 * A hedge's leaves for a plant (`kind`) in a month: a repeating texture a metre square. 'privet'
 * (green, keeps its leaves into the winter), 'thuja' (evergreen, dark and upright), 'hawthorn' (green;
 * russet from October), 'twigs' (spiraea: green; bare grey-brown twigs from November to April).
 */
export function hedgeLeaves(kind = 'privet', month = 11) {
  const autumn = month >= 10 || month <= 3, bare = month >= 11 || month <= 4;
  const key = `hedge-${kind}-${kind === 'hawthorn' ? autumn : kind === 'twigs' ? bare : 0}`;
  return keep(key, () => {
    const pal = kind === 'thuja' ? [0x173327, 0x24503a, 0x2f6b62, 0x356f42, 0x4f8f45]
      : kind === 'hawthorn' && autumn ? [0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb9862e]
      : kind === 'twigs' && bare ? [0x2a1c18, 0x47302a, 0x6b4636, 0x7d756c, 0x8f6345]
      : [0x24503a, 0x24503a, 0x356f42, 0x4f8f45, 0x76ad4c];
    const r = rng(kind.length * 31 + 7), sd = kind.length * 7;
    const n = 32;                                                // (two metres a tile: a long hedge shows no beat)
    return mat(0, paint(n, n, (px) => {
      const dot = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px((x + i) % n, (y + j) % n, 1, 1, c); };
      if (kind === 'twigs' && bare) { px(0, 0, n, n, pal[0]); for (let i = 0; i < 280; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); dot(x, y, 1, 2, pal[1 + Math.floor(r() * 3)]); if (r() < 0.3) dot(x + 1, y + n - 1, 1, 1, pal[4]); } return; }
      // Leaf clusters: a dark ground, clumps lit at their tops, bright tips, shadowed holes; wrapped, so it repeats.
      px(0, 0, n, n, pal[1]);
      for (let i = 0; i < 104; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); dot(x, y, 2 + Math.floor(r() * 2), 2, pal[2]); dot(x + 1, y, 1, 1, pal[3]); }
      for (let i = 0; i < 32; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); dot(x, y, 2, 1, pal[3]); if (r() < 0.5) dot(x, y, 1, 1, pal[4]); }
      for (let i = 0; i < 32; i++) dot(Math.floor(r() * n), Math.floor(r() * n), 1, 1, pal[0]);
    }, { repeat: true }));
  });
}
