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
// The cities brought their own (sim/cities/): London's sash windows, bays, porticos, porches, party
// walls, fascias and their consoles, a pub's etched glass and baskets, name plates, a council block's
// walkways, York stone, yellow lines and a Belisha zebra, chimney pots, a telephone box, a beacon, a
// black cab; Cairo's ablaq, mashrabiyas, a mosque's portal and crenellations, a concrete frame over
// brick, louvred shutters, pointed and arched heads, roller shutters, printed banners, washing, dust,
// terrazzo and broken flags, high kerbs, carts, stalls, a souk's stalls, satellite dishes, water
// tanks, pigeon lofts, rebar, a minaret; Beirut's sandstone courses, the triple arched window, war
// scars, burnt-out windows, cables, canvas awnings and balcony plants, a generator, solar heaters, a
// service taxi. Signs in Arabic are src/art/arabic.js's script, set beside a Latin line when they fit.
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
const pick3 = (i, j, list) => list[((i * 7 + j * 13) % list.length + list.length) % list.length];   // (a colour by where it is: stable)

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
    /** Plaster, weathered (the fine finish): mottled, grimy at the foot, cracked, fallen away to the brick here and there (kept: stucco painted and kept up, London's). */
    weathered(x, y, w, h, base, kept = false) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M), sd = seed * 7;
      for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
        const v = noise(i / 7, j / 7, sd) * 0.6 + noise(i / 2.5, j / 2.5, sd + 1) * 0.4;
        let d = v < 0.28 ? -0.035 : v > 0.72 ? 0.02 : -0.01;
        const foot = hh - j;                                     // grime rising from the pavement
        if (foot < 14 && noise(i / 3, j / 2, sd + 2) < (14 - foot) / 14) d -= 0.045;
        px(x0 + i, y0 + j, 1, 1, tone(base, d));
      }
      // Patches where the plaster has come away: brick in a ragged hole, its edge in shade.
      for (let k = 0; k < (kept ? 0 : Math.max(1, Math.round(ww * hh / 9000))); k++) {
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
      for (let k = 0; k < (kept ? 0 : Math.max(1, Math.round(ww / 60))); k++) {
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
    /** Ivy climbing from the foot of the wall at x, w wide, up to h (metres); the fine finish only. 'wisteria': its old stems, bare in winter. */
    ivy(x, w, h, kind = 'ivy') {
      if (!fine) return;
      if (kind === 'wisteria') {                                 // twisted grey stems up from the foot, along under the first floor's sills
        const x0 = X(x), ww = Math.round(w * M), hh = Math.round(h * M);
        for (let k = 0; k < 3; k++) {
          let cx = x0 + Math.floor(ww * (0.2 + k * 0.3));
          for (let j = 0; j < hh; j++) { cx += noise(k * 9, j / 4, seed) > 0.62 ? 1 : noise(k * 9, j / 4, seed) < 0.38 ? -1 : 0; px(cx, H - 1 - j, 2, 1, j % 5 ? 0x6a645e : 0x8f8880); }
          for (let i = 0; i < ww * 0.6; i++) if (noise(i / 3, k, seed + 5) > 0.45) px(cx + (k % 2 ? -i : i), H - hh - 1 + Math.round(Math.sin(i / 3) * 2), 1, 1, 0x6a645e);
        }
        return;
      }
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
    window(x, y, w, h, { lit = false, frame = 0xdfe2e8, lintel = 0xc4bba9, shutters = null, curtain = null, flowers = null, head = null, surround = null, bars = false, ac = null, sat = false, ribbon = false, sash = false, louvres = null, burnt = false } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (burnt) {                                               // burnt out in the war, never mended: a black hole, soot up the wall over it, a scorched sill
        px(x0, y0, ww, hh, 0x14151c); px(x0 + 1, y0 + hh - 3, ww - 2, 2, 0x23252f);
        for (let i = -2; i < ww + 2; i++) for (let j = 1; j < 10 + (i % 3) * 3; j++) if (noise(i / 2, j / 2, seed + 5) > 0.35 + j * 0.05) px(x0 + i, y0 - j, 1, 1, tone(wall ?? 0x8f8a84, -0.25 + j * 0.015));
        px(x0 - 1, y0 + hh, ww + 2, 1, tone(wall ?? 0x8f8a84, -0.2));
        return;
      }
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
      } else if (head === 'pointed') {                           // a pointed arch over it (Cairo's, Beirut's): its two curves meeting, a moulding
        const base = wall ?? hc, R = ww * 0.75;
        for (let i = -1; i <= ww; i++) {
          const d = Math.min(i + 1, ww - i), top = Math.round(Math.sqrt(Math.max(0, R * R - (R - d) ** 2)) * 0.9);
          px(x0 + i, y0 - 1 - top, 1, top + 1, tone(base, -0.07));
          px(x0 + i, y0 - 2 - top, 1, 1, i < ww / 2 ? tone(base, 0.07) : tone(base, -0.12));
        }
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
      if (louvres && !lit) {                                     // shut against the sun: louvred shutters over the glass, their slats, a gap where they meet
        px(x0 + 1, y0 + 1, ww - 2, hh - 2, louvres);
        for (let j = y0 + 2; j < y0 + hh - 1; j += 2) { px(x0 + 1, j, ww - 2, 1, tone(louvres, -0.1)); px(x0 + 1, j - 1, ww - 2, 1, tone(louvres, 0.05)); }
        px(x0 + Math.floor(ww / 2), y0 + 1, 1, hh - 2, tone(louvres, -0.18));
      } else if (sash) {                                         // a sash window: two sashes, the meeting rail, glazing bars (six over six)
        const mid = y0 + Math.floor(hh / 2);
        px(x0, mid - 1, ww, 2, frame); px(x0, mid - 1, ww, 1, tone(frame, 0.04));
        for (const t of [1 / 3, 2 / 3]) px(x0 + Math.round(ww * t), y0 + 1, 1, hh - 2, frame);
        for (const yy of [y0 + Math.floor((mid - y0) / 2), mid + Math.floor((y0 + hh - mid) / 2)]) px(x0 + 1, yy, ww - 2, 1, frame);
      } else {
        px(x0 + Math.floor(ww / 2), y0, 1, hh, frame);           // mullion
        px(x0, y0 + Math.floor(hh / 3), ww, 1, frame);           // transom
      }
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
      if (kind === 'solid') {                                   // a concrete balcony: a solid parapet, its slab's shadow
        const ph = Math.round(1.0 * M), t2 = fl - ph;
        px(a, t2, w, ph, c); px(a, t2, w, 1, tone(c, 0.07)); px(a + w - 1, t2, 1, ph, tone(c, -0.08)); px(a, fl - 2, w, 2, tone(c, -0.05));
        px(a, fl, w, 2, tone(wall ?? c, -0.18));
        if (fine) for (let i = a + 2; i < a + w - 2; i += 7) px(i, t2 + 2, 1, ph - 4, tone(c, -0.025));
        return;
      }
      if (kind === 'rail') {                                    // a balconette: a low iron rail across a window's foot, no slab
        const rh = Math.round(0.6 * M), t2 = fl - rh;
        px(a, t2, w, 1, 0x23252f); px(a, t2 + 1, w, 1, 0x353947); px(a, fl - 1, w, 1, 0x23252f);
        for (let i = a; i < a + w; i += 2) px(i, t2 + 2, 1, rh - 3, 0x23252f);
        for (let i = a + 1; i < a + w - 2; i += 4) px(i, t2 + Math.floor(rh / 2), 2, 1, 0x353947);
        px(a, fl, w, 1, tone(wall ?? 0x5c5650, -0.12));
        return;
      }
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
    door(x, w, h, { color = 0x356f42, frame = 0xe2dac6, glass = true, style = 'panel', canopy = false, fan = false } = {}) {
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
      if (fan && style !== 'arched') {                           // a fanlight over the door: glass behind radiating bars
        const fh = 7, fy = y0 - 4 - fh;
        px(x0 - 1, fy - 1, ww + 2, fh + 1, frame); px(x0, fy, ww, fh, 0x283f6b);
        for (let i = 0; i < ww; i++) { const t = (i + 0.5) / ww - 0.5; for (let j = 0; j < fh; j++) if (Math.abs(t * fh - (j - fh) * 0.35 * Math.sign(t)) < 0.6 || j === fh - 1) px(x0 + i, fy + j, 1, 1, frame); }
        px(x0 + 2, fy + 1, 1, 2, 0x95c1e3);
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
    shopfront(x, w, h, { frame = 0x23252f, lit = true, goods = [0x9e3c36, 0xf6f4ee, 0x5d8fc2, 0xe7b84a], etched = false, arched = false, roller = 0 } = {}) {
      const x0 = X(x), y0 = Y(h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (arched) {                                              // a round head over it, a grille fanning in it (downtown Cairo's ground floors)
        const R = ww / 2, base = wall ?? 0xd6b98a;
        for (let i = -2; i < ww + 2; i++) {
          const t = (i + 0.5 - ww / 2) / (R + 2), top = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * Math.min(R, 10));
          px(x0 + i, y0 - top - 2, 1, top + 2, i < -0 || i >= ww ? tone(base, 0.04) : (i + top) % 3 === 0 ? frame : tone(frame, 0.05));
          px(x0 + i, y0 - top - 3, 1, 1, i < ww / 2 ? tone(base, 0.08) : tone(base, -0.1));
        }
      }
      if (etched) {                                              // a pub's windows: small panes over etched glass, a stall riser, the warm light in
        px(x0, y0, ww, hh, frame);
        const top = Math.floor(hh * 0.42), g = lit ? [0xe7b84a, 0xf8e08a] : [0x283f6b, 0x3b6296];
        px(x0 + 1, y0 + 1, ww - 2, top - 1, g[0]); px(x0 + 1, y0 + 1, ww - 2, 2, g[1]);
        for (let i = x0 + 4; i < x0 + ww - 2; i += 5) px(i, y0 + 1, 1, top - 1, frame);
        for (let j = y0 + 1; j < y0 + hh - 7; j++) for (let i = x0 + 1; i < x0 + ww - 1; i++) {
          if (j < y0 + top) continue;
          const etch = ((i - x0) + (j - y0) * 2) % 7 === 0 || ((i - x0) * 2 - (j - y0)) % 9 === 0;
          px(i, j, 1, 1, lit ? (etch ? 0xf8e08a : 0xe7b84a) : etch ? 0xe2dac6 : 0xb8bdc8);
        }
        px(x0 + 1, y0 + top, ww - 2, 1, frame);
        for (let i = x0 + Math.floor(ww / 3); i < x0 + ww - 2; i += Math.floor(ww / 3)) px(i, y0 + top, 1, hh - top - 6, frame);
        px(x0, y0 + hh - 6, ww, 6, frame); px(x0, y0 + hh - 6, ww, 1, tone(frame, 0.08));
        if (fine) bevel(x0, y0, ww, hh, frame);
        return;
      }
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
      if (roller > 0) {                                          // a roller shutter, part down: corrugated steel, a padlock's hasp at its foot
        const rh = Math.round((hh - 5) * roller), c = 0x8f96a6;
        for (let j = 0; j < rh; j++) px(x0, y0 + j, ww, 1, j % 3 === 0 ? tone(c, -0.12) : j % 3 === 1 ? tone(c, 0.05) : c);
        px(x0, y0 + rh, ww, 1, 0x4c5262); px(x0 + Math.floor(ww / 2) - 1, y0 + rh - 2, 3, 2, 0x353947);
        if (fine) for (let k = 0; k < ww / 10; k++) px(x0 + Math.floor(r() * ww), y0 + Math.floor(r() * rh), 2, 1, tone(c, -0.18));   // rust, a sticker, graffiti's tag
      }
      if (fine) { bevel(x0, y0, ww, hh, frame); for (let i = 3; i < ww - 6; i += 16) for (let k = 0; k < 5; k++) px(x0 + i + k + 2, y0 + 4 + k, 1, 1, tone(lit ? 0xe7b84a : 0x283f6b, 0.08)); }
    },
    /** A sign: a board with a border and centred text; or (`style`) 'letters' on the wall itself, or a 'lightbox'. */
    sign(x, y, w, h, str, { bg = 0x1b2541, fg = 0xf8e08a, border = 0xb9862e, style = 'board', band = null } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      // Its words: one line centred; or two scripts ('عربي|LATIN', Beirut's and Cairo's): side by side
      // when they fit, the Arabic on the right as it's read first; one over the other on a tall board;
      // else the Arabic alone.
      const lines = [], parts = str.split('|'), mid = y0 + Math.floor((hh - 5) / 2);
      const centred = (t, ly) => lines.push([t, x0 + Math.floor((ww - textWidth(t)) / 2), ly]);
      if (parts.length < 2) centred(str, mid);
      else {
        const [ar, la] = parts, wa = textWidth(ar), wl = textWidth(la), gap = 7;
        if (wa + wl + gap <= ww - 4) { const left = x0 + Math.floor((ww - wa - wl - gap) / 2); lines.push([la, left, mid], [ar, left + wl + gap, mid]); }
        else if (hh >= 16 && Math.max(wa, wl) <= ww - 2) { centred(ar, y0 + 3); centred(la, y0 + hh - 6); }
        else centred(wa <= ww - 2 ? ar : la, mid);
      }
      const ink = (c, dx = 0, dy = 0) => { for (const [t, lx, ly] of lines) text(px, lx + dx, ly + dy, t, c); };
      if (style === 'letters') {                                 // letters fixed to the wall, the one of its colours that stands out, a shadow
        const luma = (c) => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
        const back = luma(wall ?? 0x9e3c36), c = Math.abs(luma(fg) - back) > Math.abs(luma(bg) - back) ? fg : bg;
        ink(tone(wall ?? 0x9e3c36, -0.2), 1, 1);
        ink(c);
        return;
      }
      if (style === 'lightbox') {                                // a box: a dark case, a face lit along its top, end caps
        px(x0 - 1, y0, ww + 2, hh, 0x23252f); px(x0 + 1, y0 + 1, ww - 2, hh - 2, bg);
        px(x0 + 1, y0 + 1, ww - 2, 1, tone(bg, 0.08)); px(x0 + 1, y0 + hh - 2, ww - 2, 1, tone(bg, -0.08));
        px(x0 - 1, y0 + hh, ww + 2, 1, tone(wall ?? 0x5c5650, -0.14));
        ink(fg);
        return;
      }
      if (style === 'fascia') {                                  // a shop's fascia: a board under a moulded cornice, its letters with a shadow
        px(x0, y0 - 2, ww, 2, tone(border, 0.06)); px(x0, y0 - 2, ww, 1, tone(border, 0.14));
        px(x0, y0, ww, hh, border); px(x0 + 1, y0, ww - 2, hh - 1, bg);
        px(x0 + 1, y0, ww - 2, 1, tone(bg, -0.1)); px(x0 + 1, y0 + hh - 2, ww - 2, 1, tone(bg, 0.06));
        ink(tone(bg, -0.12), 1, 1);
        ink(fg);
        return;
      }
      if (style === 'banner') {                                  // a printed flex banner (Cairo's, Beirut's): bright, a band of another colour, wrinkled, its edges ragged with age
        px(x0, y0, ww, hh, bg);
        if (band) { px(x0, y0 + hh - 3, ww, 3, band); px(x0, y0, ww, 2, band); }
        for (let i = x0 + 3; i < x0 + ww - 2; i += 9 + ((i * 7) % 5)) px(i, y0 + 2, 1, hh - 5, tone(bg, -0.05));   // the wrinkles
        ink(tone(bg, -0.22), 1, 1);
        ink(fg);
        px(x0, y0 - 1, ww, 1, tone(bg, 0.06)); px(x0 + ww - 1, y0, 1, hh, tone(bg, -0.12));
        if (fine) for (let k = 0; k < ww / 18; k++) { const i = x0 + 2 + Math.floor(r() * (ww - 4)); px(i, y0 + hh - 1, 2, 1, tone(wall ?? 0x5c5650, -0.1)); }
        return;
      }
      px(x0, y0, ww, hh, border); px(x0 + 1, y0 + 1, ww - 2, hh - 2, bg);
      ink(fg);
    },
    /** Sandstone in courses (Beirut's old houses): blocks 0.35 m high, their joints, each block its own tone, the stone's pitting. */
    ashlar(x, y, w, h, base) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      px(x0, y0, ww, hh, tone(base, -0.1));
      for (let j = 0, row = 0; j < hh; j += 6, row++) for (let i = (row % 2) * -7; i < ww; i += 14) {
        const a = Math.max(0, i), b = Math.min(ww, i + 13), h2 = Math.min(5, hh - j), d = (cell(i + seed, row, 61) - 0.5) * 0.07;
        if (b <= a) continue;
        px(x0 + a, y0 + j, b - a, h2, tone(base, d)); px(x0 + a, y0 + j, b - a, 1, tone(base, d + 0.05));
        for (let k = 0; k < 3; k++) px(x0 + a + Math.floor(cell(i, row * 3 + k, 62) * (b - a)), y0 + j + 1 + Math.floor(cell(i, row * 3 + k, 63) * Math.max(1, h2 - 1)), 1, 1, tone(base, d - 0.08));
      }
    },
    /** The triple arched window (a Lebanese house's): three tall arches on slim columns, x … x + w from y up h, coloured glass in their heads. */
    triforium(x, y, w, h, { glass = [0x9e3c36, 0x3b6296, 0xe7b84a] } = {}) {
      const a = X(x), ww = Math.round(w * M), t = Y(y + h), b = Y(y), col = 2, aw = Math.floor((ww - 2 * col - 4) / 3), stone = tone(wall ?? 0xd8c09a, 0.06);
      px(a - 2, t - 3, ww + 4, b - t + 4, stone);                                                // the frame
      for (let k = 0; k < 3; k++) {
        const x0 = a + 2 + k * (aw + col), R = aw / 2, lit = litR ? night && litR() < 0.5 : false;
        for (let i = 0; i < aw; i++) {
          const dx = i + 0.5 - R, top = t + Math.round(R - Math.sqrt(Math.max(0, R * R - dx * dx)));
          for (let j = top; j < b - 2; j++) {
            const head = j < t + R + 1, c = head ? glass[(Math.floor(Math.atan2(j - t - R, dx) * 3) + 9 + k) % glass.length] : lit ? 0xe7b84a : (j - top) < 3 ? 0x3b6296 : 0x283f6b;
            px(x0 + i, j, 1, 1, head && (i === Math.round(R) || j === Math.round(t + R)) ? stone : c);
          }
        }
        px(x0 + Math.round(R), t + R, 1, b - t - R - 2, stone);                                   // its mullion
        if (k > 0) { px(x0 - col, t + R - 1, col, b - t - R, 0xf4efe6); px(x0 - col, t + R - 2, col, 1, tone(0xf4efe6, 0.05)); }   // a marble column
      }
      px(a - 3, b - 2, ww + 6, 2, stone); px(a - 3, b, ww + 6, 1, tone(wall ?? stone, -0.14));
      if (fine) bevel(a - 2, t - 3, ww + 4, b - t + 4, stone);
    },
    /** War scars, from y0 to y1: shrapnel's pocks in bursts, a bullet's spray in a line, now and then a shell's hole to the stone; `k` how bad. */
    scars(y0, y1, k = 0.5) {
      const base = wall ?? 0xa8a49c, top = Y(y1), bot = Y(y0);
      const pock = (x, y) => { px(x, y, 1, 1, tone(base, -0.22)); if (r() < 0.6) px(x + 1, y, 1, 1, tone(base, -0.14)); px(x - 1, y, 1, 1, tone(base, 0.05)); };
      for (let n = 0; n < Math.round(3 + 6 * k); n++) {             // bursts
        const cx = Math.floor(r() * W), cy = top + Math.floor(r() * (bot - top)), rad = 6 + Math.floor(r() * 14);
        for (let m = 0; m < 12 + 30 * k; m++) { const a = r() * 6.28, d = Math.sqrt(r()) * rad; pock(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8)); }
      }
      for (let n = 0; n < Math.round(1 + 3 * k); n++) {             // a spray along the wall
        let x = Math.floor(r() * W), y = top + Math.floor(r() * (bot - top)); const dy = (r() - 0.5) * 0.4;
        for (let m = 0; m < 20; m++) { pock(x, Math.round(y)); x += 2 + Math.floor(r() * 4); y += dy * 3; }
      }
      for (let n = 0; n < Math.round(k * 2); n++) {                 // a shell's hole, patched round with cement or not
        const cx = Math.floor(r() * W), cy = top + Math.floor(r() * (bot - top)), rr = 3 + Math.floor(r() * 4);
        for (let j = -rr - 2; j <= rr + 2; j++) for (let i = -rr - 2; i <= rr + 2; i++) {
          const d = Math.hypot(i, j * 1.2);
          if (d > rr + 2) continue;
          px(cx + i, cy + j, 1, 1, d < rr * 0.6 ? 0x23252f : d < rr ? tone(0x9e3c36, -0.15) : tone(base, d < rr + 1 ? -0.1 : 0.03));
        }
      }
    },
    /** Cables slung across the front, from y0 to y1: `n` of them, sagging between where they're tacked to the wall, a junction box or two. */
    cables(y0, y1, n = 3) {
      for (let k = 0; k < n; k++) {
        let x = 0, y = Y(y0 + (y1 - y0) * r());
        while (x < W) {
          const span = 30 + Math.floor(r() * 60), sag = 2 + Math.floor(r() * 5), y2 = Math.max(Y(y1), Math.min(Y(y0), y + Math.floor((r() - 0.5) * 16)));
          for (let i = 0; i < span && x + i < W; i++) { const t = i / span; px(x + i, Math.round(y + (y2 - y) * t + Math.sin(t * Math.PI) * sag), 1, 1, 0x14151c); }
          x += span; y = y2;
          if (r() < 0.25 && x < W - 6) { px(x - 2, y - 2, 5, 5, 0x6a7182); px(x - 2, y - 2, 5, 1, 0x8f96a6); }
        }
      }
    },
    /** A canvas awning over a balcony, x0 … x1 (metres), hung from y: striped, its scalloped edge, sloping out. */
    canopy(x0, x1, y, c) {
      const a = X(x0), w = X(x1) - a, t = Y(y);
      for (let j = 0; j < 9; j++) for (let i = 0; i < w; i++) px(a + i, t + j, 1, 1, Math.floor(i / 4) % 2 ? tone(0xf6f4ee, -j * 0.01) : tone(c, -j * 0.012));
      for (let i = 0; i < w; i += 4) px(a + i + 1, t + 9, 2, 1, Math.floor(i / 4) % 2 ? 0xf6f4ee : c);
      px(a, t + 10, w, 1, tone(wall ?? c, -0.18)); px(a, t, w, 1, tone(c, 0.08));
    },
    /** Pots of plants along a balcony, x0 … x1 (metres) at y: geraniums, a fern, a little tree. */
    plants(x0, x1, y) {
      const a = X(x0), b = X(x1), t = Y(y);
      for (let x = a + 1; x < b - 4; x += 5 + Math.floor(r() * 5)) {
        px(x, t - 3, 4, 3, 0xc95c45); px(x, t - 3, 4, 1, 0xe8896a);
        for (let k = 0; k < 9; k++) { const i = Math.floor(r() * 6) - 1, j = Math.floor(r() * 5); px(x + i, t - 4 - j, 1, 1, r() < 0.2 ? pick3(i, j, [0xc95c45, 0xe8896a, 0xf6f4ee, 0x7a4a86]) : r() < 0.5 ? 0x4f8f45 : 0x356f42); }
      }
    },
    /** Ablaq: courses of two stones in turn, y0 … y1 (metres), each course bevelled, its joints cut. */
    ablaq(y0, y1, c1, c2) {
      for (let y = Y(y1), k = 0; y < Y(y0); y += 5, k++) {
        const c = k % 2 ? c1 : c2, h = Math.min(5, Y(y0) - y);
        px(0, y, W, h, c); px(0, y, W, 1, tone(c, 0.05)); px(0, y + h - 1, W, 1, tone(c, -0.1));
        for (let x = (k % 2) * 7; x < W; x += 14) px(x, y, 1, h, tone(c, -0.14));
        if (fine) for (let x = 0; x < W; x += 3) if (noise(x / 2, y, seed) > 0.78) px(x, y + 1 + (x % 3), 1, 1, tone(c, -0.06));
      }
    },
    /** A mashrabiya: a bay of turned-wood lattice x … x + w, from y up h (metres), on corbels, under a little roof; its shadow on the wall. */
    mashrabiya(x, y, w, h, c = 0x47302a) {
      const a = X(x), ww = Math.round(w * M), t = Y(y + h), b = Y(y), lit = litR ? night && litR() < 0.4 : false;
      px(a + ww, t + 3, 2, b - t, tone(wall ?? c, -0.16));                                   // its shadow
      px(a - 1, t - 3, ww + 2, 3, tone(c, -0.05)); px(a - 2, t - 4, ww + 4, 1, tone(c, 0.08));   // the roof
      px(a, t, ww, b - t, c);
      for (let j = t + 2; j < b - 4; j++) for (let i = a + 1; i < a + ww - 1; i++) {        // the lattice: a grid of beads, light through it
        const u = (i - a) % 3, v = (j - t) % 3;
        px(i, j, 1, 1, u === 1 && v === 1 ? (lit ? 0xe7b84a : tone(c, -0.18)) : u === 0 || v === 0 ? tone(c, 0.06) : c);
      }
      px(a, t + 1, ww, 1, tone(c, 0.1)); px(a, b - 4, ww, 4, tone(c, 0.02)); px(a, b - 4, ww, 1, tone(c, 0.08));   // its rails
      px(a + Math.floor(ww / 2), t + 1, 1, b - t - 5, tone(c, -0.08));
      for (const cx of [a + 1, a + ww - 4]) { px(cx, b, 3, 3, tone(c, -0.04)); px(cx + 1, b + 3, 1, 2, tone(c, -0.08)); }   // corbels
    },
    /** A mosque's portal: a tall pointed recess x … x + w, h high, muqarnas in its hood, a door at its foot. */
    portal(x, w, h, c) {
      const a = X(x), ww = Math.round(w * M), top = Y(h), bot = Y(0), base = wall ?? c, R = ww * 0.62;
      for (let i = -3; i < ww + 3; i++) {                                                     // the frame
        const d = Math.min(i + 3, ww + 2 - i), arc = Math.round(Math.sqrt(Math.max(0, (R + 3) ** 2 - (R + 3 - d) ** 2)) * 0.85);
        px(a + i, top - arc + Math.round(R * 0.85), 1, 2, tone(base, 0.08));
      }
      px(a - 3, top + Math.round(R * 0.85), 3, bot - top, tone(base, 0.05)); px(a + ww, top + Math.round(R * 0.85), 3, bot - top, tone(base, -0.06));
      for (let i = 0; i < ww; i++) {                                                          // the recess, in shade, its hood stepped (muqarnas)
        const d = Math.min(i + 1, ww - i), arc = Math.round(Math.sqrt(Math.max(0, R * R - (R - d) ** 2)) * 0.85), y0 = top - arc + Math.round(R * 0.85) + 2;
        for (let j = y0; j < bot; j++) {
          const hood = j < top + Math.round(R * 0.85) + 10;
          px(a + i, j, 1, 1, hood ? ((Math.floor((j - y0) / 3) + Math.floor(i / 3)) % 2 ? tone(base, -0.16) : tone(base, -0.08)) : tone(base, -0.12));
        }
      }
      const dw = Math.round(1.6 * M), dh = Math.round(2.8 * M), dx = a + Math.floor((ww - dw) / 2);
      px(dx - 1, bot - dh - 1, dw + 2, dh + 1, tone(base, 0.06)); px(dx, bot - dh, dw, dh, 0x47302a);
      for (let j = bot - dh + 2; j < bot - 1; j += 4) px(dx + 1, j, dw - 2, 1, 0x6b4636);
      for (let i = dx + 2; i < dx + dw - 1; i += 4) for (let j = bot - dh + 3; j < bot - 2; j += 4) px(i, j, 1, 1, 0xb9862e);   // studs
      px(dx + Math.floor(dw / 2), bot - dh, 1, dh, 0x2a1c18);
    },
    /** Crenellations along the top (y, metres): stepped merlons, as a mosque's parapet has them. */
    crenels(y, c) {
      const t = Y(y);
      for (let x = 1; x < W - 4; x += 7) { px(x, t - 6, 5, 6, tone(c, 0.03)); px(x + 1, t - 8, 3, 2, tone(c, 0.03)); px(x + 2, t - 9, 1, 1, tone(c, 0.03)); px(x, t - 6, 1, 6, tone(c, 0.08)); px(x + 4, t - 6, 1, 6, tone(c, -0.1)); }
    },
    /** A concrete frame over brick infill, from y0, floors of fh metres, `bays` bays: slabs and columns in grey. */
    frame(y0, floors, fh, bays, c = 0xa8a49c) {
      const step = W / bays;
      for (let f = 0; f < floors; f++) { const y = Y(y0 + fh * f); px(0, y - 3, W, 4, c); px(0, y - 3, W, 1, tone(c, 0.07)); px(0, y + 1, W, 1, tone(wall ?? c, -0.16)); }
      for (let k = 0; k <= bays; k++) { const x = Math.min(W - 4, Math.max(0, Math.round(k * step) - 2)); px(x, Y(y0 + fh * (floors - 1) + 0.4), 4, Y(y0) - Y(y0 + fh * (floors - 1) + 0.4), c); px(x, Y(y0 + fh * (floors - 1) + 0.4), 1, Y(y0) - Y(y0 + fh * (floors - 1) + 0.4), tone(c, 0.06)); px(x + 3, Y(y0 + fh * (floors - 1) + 0.4), 1, Y(y0) - Y(y0 + fh * (floors - 1) + 0.4), tone(c, -0.1)); }
    },
    /** Washing on a line from x0 to x1 (metres) at y: shirts, sheets, a towel, pegged and hanging. */
    laundry(x0, x1, y) {
      const a = X(x0), b = X(x1), t = Y(y);
      px(a, t, b - a, 1, 0x4c5262);
      const C = [0xf6f4ee, 0x9e3c36, 0x3b6296, 0xe7b84a, 0x356f42, 0xe8896a, 0xdfe2e8, 0x7a4a86, 0x23252f];
      for (let i = a + 1; i < b - 3; ) {
        const w = 3 + Math.floor(r() * 4), h = 4 + Math.floor(r() * 6), c = C[Math.floor(r() * C.length)];
        if (r() < 0.75) { px(i, t + 1, w, h, c); px(i, t + 1, w, 1, tone(c, -0.08)); px(i + w - 1, t + 1, 1, h, tone(c, -0.1)); }
        i += w + 1 + Math.floor(r() * 3);
      }
    },
    /** Dust: the city's, settled on the ledges and run down the wall in streaks, darkest low. */
    dust(y0, y1, ledgesOnly = false) {
      const c = wall ?? 0xc4a882;
      for (let k = 0; k < (ledgesOnly ? 0 : W / 3); k++) { const x = Math.floor(r() * W), y = Y(y1) + Math.floor(r() * (Y(y0) - Y(y1))), len = 4 + Math.floor(r() * 14); for (let j = 0; j < len; j++) if (r() < 0.8) px(x, y + j, 1, 1, tone(c, -0.05 - j * 0.002)); }
      for (let x = 0; x < W; x++) if (r() < 0.5) px(x, Y(y0) - 1 - Math.floor(r() * 3), 1, 1, tone(c, -0.08));
    },
    /** A canted bay window x … x + w, from y0 up to y1 (metres): stone round it, its glass in two storeys, the canted sides in shade, a cornice on it. */
    bay(x, w, y0, y1, { frame = 0xf4efe6, stone = 0xe2dac6 } = {}) {
      const a = X(x), ww = Math.round(w * M), top = Y(y1), bot = Y(y0), side = Math.max(3, Math.round(ww * 0.2));
      px(a, top, ww, bot - top, stone); if (fine) bevel(a, top, ww, bot - top, stone);
      px(a + ww, top + 2, 2, bot - top - 2, tone(wall ?? stone, -0.12));               // its shadow on the wall
      const mid = Math.round((top + bot) / 2);
      for (const [t, b] of [[top + 5, mid - 3], [mid + 4, bot - 3]]) {
        for (const [i0, i1, d] of [[a + 2, a + side, -0.1], [a + side + 2, a + ww - side - 2, 0], [a + ww - side, a + ww - 2, -0.14]]) {
          const lit = litR ? night && litR() < 0.45 : night && r() < 0.45, g = lit ? [0xe7b84a, 0xf8e08a] : [0x283f6b, 0x3b6296];
          px(i0, t, i1 - i0, b - t, tone(frame, d)); px(i0 + 1, t + 1, i1 - i0 - 2, b - t - 2, tone(g[0], d));
          px(i0 + 1, t + 1, i1 - i0 - 2, Math.floor((b - t) / 3), tone(g[1], d));
          px(i0, t + Math.floor((b - t) / 2), i1 - i0, 1, tone(frame, d));                 // the meeting rail
          if (i1 - i0 > 8) for (const k of [1 / 3, 2 / 3]) px(i0 + Math.round((i1 - i0) * k), t + 1, 1, b - t - 2, tone(frame, d));   // glazing bars
          px(i0 + 1, t + Math.floor((b - t) / 4), i1 - i0 - 2, 1, tone(frame, d)); px(i0 + 1, t + Math.floor((b - t) * 3 / 4), i1 - i0 - 2, 1, tone(frame, d));
          if (!lit && d === 0) for (let k = 0; k < Math.min(i1 - i0, b - t) - 4; k++) px(i1 - 3 - k, t + 2 + k, 1, 1, tone(g[0], 0.08));
        }
      }
      px(a - 1, mid - 2, ww + 2, 3, stone); px(a - 1, mid - 2, ww + 2, 1, tone(stone, 0.06)); px(a - 1, mid + 1, ww + 2, 1, tone(stone, -0.1));
      px(a - 2, top - 3, ww + 4, 3, tone(stone, 0.02)); px(a - 2, top - 3, ww + 4, 1, tone(stone, 0.08)); px(a - 2, top, ww + 4, 1, tone(stone, -0.12));   // its cornice
      px(a - 2, top - 5, ww + 4, 2, 0x4c5262); px(a - 2, top - 5, ww + 4, 1, 0x6a7182);                                                                   // and the lead over it
    },
    /** A portico at a door: two columns either side of it (x … x + w), an entablature on them, h tall. */
    portico(x, w, h, c = 0xf4efe6) {
      const a = X(x), ww = Math.round(w * M), top = Y(h), bot = Y(0);
      for (const cx of [a, a + ww - 4]) {
        px(cx, top + 6, 4, bot - top - 6, c); px(cx, top + 6, 1, bot - top - 6, tone(c, 0.05)); px(cx + 3, top + 6, 1, bot - top - 6, tone(c, -0.1));
        px(cx + 4, top + 7, 1, bot - top - 8, tone(wall ?? c, -0.14));                // its shadow
        px(cx - 1, top + 5, 6, 2, tone(c, -0.03)); px(cx - 1, bot - 2, 6, 2, tone(c, -0.04));   // capital and base
        for (let y = top + 9; y < bot - 3; y += 3) px(cx + 2, y, 1, 2, tone(c, -0.05));   // (fluting)
      }
      px(a - 2, top, ww + 4, 6, c); px(a - 2, top, ww + 4, 1, tone(c, 0.07)); px(a - 2, top + 2, ww + 4, 1, tone(c, -0.05)); px(a - 2, top + 5, ww + 4, 1, tone(c, -0.12));
      px(a - 2, top + 6, ww + 4, 1, tone(wall ?? c, -0.16));
      px(a - 3, bot, ww + 6, 2, tone(0xa0978a, 0.06)); px(a - 3, bot, ww + 6, 1, tone(0xa0978a, 0.12));   // the step
    },
    /** A Victorian porch over a door: a hood on two corbels, its lintel carved. */
    porch(x, w, h, c = 0xe2dac6) {
      const a = X(x), ww = Math.round(w * M), y = Y(h);
      px(a - 1, y - 4, ww + 2, 4, c); px(a - 1, y - 4, ww + 2, 1, tone(c, 0.07)); px(a - 1, y - 1, ww + 2, 1, tone(c, -0.1));
      for (let i = a + 2; i < a + ww - 2; i += 4) px(i, y - 3, 2, 1, tone(c, -0.06));
      for (const cx of [a, a + ww - 3]) { px(cx, y, 3, 6, c); px(cx + 1, y + 6, 1, 3, c); px(cx + 2, y, 1, 6, tone(c, -0.08)); }
      px(a - 1, y, ww + 2, 1, tone(wall ?? c, -0.14));
    },
    /** Where two houses of a terrace meet, at x (metres): the joint, up to top. */
    party(x, top) {
      const a = X(x);
      px(a - 1, Y(top), 1, Y(0) - Y(top), tone(wall ?? 0xa0978a, -0.1)); px(a, Y(top), 1, Y(0) - Y(top), tone(wall ?? 0xa0978a, 0.03));
    },
    /** The consoles between shopfronts at xs (metres), from y to y + h: a scrolled bracket each side of a fascia. */
    consoles(xs, y, h) {
      for (const xm of xs) {
        const a = X(xm) - 2, t = Y(y + h), b = Y(y), c = 0x23252f;
        px(a, t - 2, 5, b - t + 2, c); px(a, t - 2, 5, 1, 0x4c5262); px(a + 1, t, 3, 3, 0x353947); px(a + 2, t + 1, 1, 1, 0x6a7182);
        px(a + 1, b - 4, 3, 3, 0x353947); px(a + 4, t - 1, 1, b - t, 0x14151c);
      }
    },
    /** A council block's walkways, one a floor (fh metres) from y0: a slab, a steel railing over it, the shade under. */
    decks(y0, floors, fh, c = 0xa0978a) {
      for (let f = 1; f < floors; f++) {
        const fl = Y(y0 + fh * (f - 1)), rh = Math.round(1.0 * M), t = fl - rh;
        px(0, fl - 1, W, 4, c); px(0, fl - 1, W, 1, tone(c, 0.07)); px(0, fl + 3, W, 2, tone(c, -0.2));
        px(0, t, W, 2, 0x6a7182); px(0, t, W, 1, 0x8f96a6);
        for (let i = 2; i < W; i += 3) px(i, t + 2, 1, rh - 3, 0x4c5262);
        for (let i = 0; i < W; i += 48) px(i, t, 2, rh, 0x6a7182);
      }
    },
    /** A street's name on a plate on the wall, London's: white, a black edge, black letters. */
    plate(x, y, w, h, words) {
      const a = X(x), ww = Math.round(w * M), hh = Math.max(9, Math.round(h * M)), t = Y(y + h);
      px(a - 1, t - 1, ww + 2, hh + 2, tone(wall ?? 0x5c5650, -0.14));
      px(a, t, ww, hh, 0x14151c); px(a + 1, t + 1, ww - 2, hh - 2, 0xf4efe6);
      const lines = words.split('\n'), top = t + Math.floor((hh - lines.length * 6 + 1) / 2);
      lines.forEach((l, k) => text(px, a + Math.floor((ww - textWidth(l)) / 2), top + k * 6, l, 0x14151c));
    },
    /** Hanging baskets on brackets at xs (metres), hung from y: a ball of ivy and winter pansies. */
    baskets(xs, y) {
      for (const xm of xs) {
        const cx = X(xm), t = Y(y);
        px(cx - 4, t, 9, 1, 0x23252f); px(cx, t, 1, 3, 0x23252f);
        for (let j = 0; j < 8; j++) for (let i = -5; i <= 5; i++) {
          const d = (i / 5.5) ** 2 + ((j - 3.5) / 4.2) ** 2;
          if (d > 1 + (noise(cx + i, j, seed) - 0.5) * 0.5) continue;
          const v = noise((cx + i) / 1.5, (t + j) / 1.5, seed + 3);
          px(cx + i, t + 3 + j, 1, 1, v > 0.78 ? pick3(i, j, [0x7a4a86, 0xe7b84a, 0xf6f4ee]) : v > 0.5 ? 0x4f8f45 : j > 5 ? 0x24503a : 0x356f42);
        }
        for (let k = 0; k < 4; k++) px(cx - 3 + k * 2, t + 11 + (k % 2) * 2, 1, 3, 0x356f42);   // trailing ivy
      }
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
export function street({ x0, x1, zB, zK1, zK2, z1, zebra = null, pits = [], seed = 7, ox = 0, calm = false, look = null, zebraKind = 'white', rowSeed = 0, leaves = 0, city = null, areas = [], bays = [] }) {
  const W = Math.round((x1 - x0) * M), H = Math.round((z1 - zB) * M);
  const X = (x) => Math.round((x - x0) * M), Z = (z) => Math.round((z - zB) * M);
  const tex = paint(W, H, (px) => {
    if (finish.fine) return fineStreet(px, W, X, Z, { x0, x1, zB, zK1, zK2, z1, zebra, pits, seed, ox, calm, look, zebraKind, rowSeed, leaves, city, areas, bays });
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
function fineStreet(px, W, X, Z, { x0, zB, zK1, zK2, z1, zebra, pits, seed, ox = 0, calm = false, look = null, zebraKind = 'white', rowSeed = 0, leaves = 0, city = null, areas = [], bays = [] }) {
  const r = rng(seed);
  const london = city === 'london', wet = london ? -0.035 : 0;          // (London's pavements rain-dark)
  const dust = city === 'cairo' ? 1 : city === 'beirut' ? 0.45 : 0;    // (sand in the gutters, on the kerbs)
  const DUST = 0xc4a882;
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
    if (kind === 'terrazzo') {                                   // cement tiles (Cairo's, Beirut's): half-metre squares, a square pattern in each, many cracked or gone
      const base = 0xb8ae9c;
      px(xa, ya, xb - xa, yb - ya, tone(base, -0.13));
      for (let j = ya, row = 0; j < yb; j += 8, row++) for (let a = xa - (((xa + ox) % 8) + 8) % 8; a < xb; a += 8) {
        const k = Math.floor((a + ox) / 8), u = cell(k, row, K + 41), h = Math.min(7, yb - j);
        if (u < 0.06) { for (let y = 0; y < h; y++) for (let x = Math.max(a, xa); x < Math.min(a + 7, xb); x++) px(x, j + y, 1, 1, tone(0x8f6a50, (noise(x, y + j, seed) - 0.5) * 0.08)); continue; }   // a tile gone: the earth under it
        const c = u > 0.9 ? 0xa89c8a : base, d = (cell(k, row, K + 42) - 0.5) * 0.05;
        stone(a, xb, j, 7, h, c, d, [xa, xb], 5);
        if (h >= 6 && a + 5 < xb && a + 2 >= xa) { px(a + 2, j + 2, 3, 3, tone(c, d - 0.05)); px(a + 3, j + 3, 1, 1, tone(0x9e3c36, -0.1)); }
        if (cell(k, row, K + 43) < 0.12 && a + 6 < xb && a >= xa) { px(a + 1, j + 3, 2, 1, tone(c, -0.2)); px(a + 3, j + 4, 3, 1, tone(c, -0.2)); }
      }
      return;
    }
    if (kind === 'broken') {                                     // concrete flags, cracked, sunk, patched with cement, some gone to the dirt
      const base = 0xaca69c;
      px(xa, ya, xb - xa, yb - ya, tone(base, -0.14));
      for (let j = ya, row = 0; j < yb; j += 11, row++) for (let a = xa - (((xa + ox + (row % 2) * 7) % 14) + 14) % 14; a < xb; a += 14) {
        const k = Math.floor((a + ox + (row % 2) * 7) / 14), u = cell(k, row, K + 44), h = Math.min(10, yb - j);
        if (u < 0.1) { for (let y = 0; y < h; y++) for (let x = Math.max(a, xa); x < Math.min(a + 13, xb); x++) px(x, j + y, 1, 1, noise((x + ox) / 2, (j + y) / 2, seed + 7) > 0.6 ? 0x8f6a50 : 0x7d6450); continue; }
        const d = (cell(k, row, K + 45) - 0.5) * 0.08 - (u < 0.2 ? 0.06 : 0);
        stone(a, xb, j, 13, h, u > 0.85 ? 0xb8b0a0 : base, d, [xa, xb], 6);
        if (cell(k, row, K + 46) < 0.45) { let cx = a + 2 + Math.floor(cell(k, row, K + 47) * 9), cy = j + 1; for (let n = 0; n < h - 1; n++) { if (cx >= xa && cx < xb) px(cx, cy + n, 1, 1, tone(base, -0.22)); cx += cell(k, n, K + 48) < 0.4 ? -1 : cell(k, n, K + 48) > 0.7 ? 1 : 0; } }
      }
      return;
    }
    if (kind === 'york') {                                       // York stone: flags of many sizes in courses, buff and grey, worn smooth
      const base = 0xb2aa9a;
      px(xa, ya, xb - xa, yb - ya, tone(base, -0.12 + wet));
      for (let j = ya, row = 0; j < yb; row++) {
        const h = Math.min(yb - j, [11, 13, 9, 14, 12][Math.floor(cell(row, 3, K + 31) * 5)]) - 1;
        if (h <= 0) break;
        // (a stone starts where the world's hash says, and every fifth unit at the latest: 6 to 30 px, the same in every section)
        const start = (u) => cell(u, row, K + 32) <= 0.38 || ((u % 5) + 5) % 5 === 0;
        let u = Math.floor((xa + ox) / 6) - 5;
        while (!start(u)) u++;
        while (u * 6 - ox < xb) {
          let n = 1; while (!start(u + n)) n++;
          const a = u * 6 - ox, w = n * 6 - 1, k = cell(u, row, K + 33), d = (k - 0.5) * 0.04 + (k < 0.06 ? -0.035 : k > 0.95 ? 0.025 : 0) + wet;
          const c = k > 0.82 ? 0xaaa79f : base;
          if (a + w > xa) stone(a, xb, j, w, h, c, d, [xa, xb], 3);
          if (cell(u, row, K + 34) < 0.08 && a + 4 >= xa && a + 8 < xb) { px(a + 3, j + 3, 1, 1, tone(c, -0.2)); px(a + 4, j + 4, 3, 1, tone(c, -0.2)); }   // a crack
          u += n;
        }
        j += h + 1;
      }
      return;
    }
    const [pw, ph, shift, base] = { slabs: [12, 10, 6, SL], squares: [8, 8, 0, 0xb8b0a4], granite: [16, 12, 8, 0xb4a296], pavers: [8, 4, 4, 0xa8a49c], pcc: [14, 10, 7, 0xa8a6a0] }[kind] ?? [12, 10, 6, SL];
    px(xa, ya, xb - xa, yb - ya, tone(base, -0.15));                 // the joints
    for (let j = ya, row = 0; j < yb; j += ph, row++) {
      const off = (row % 2) * shift, h = Math.min(ph - 1, yb - j);
      if (h <= 0) continue;
      const border = kind === 'pavers' && (row < 2 || j + ph * 2 >= yb);
      for (let a = xa - (((xa + off) % pw) + pw) % pw - pw; a < xb; a += pw) {
        if (a + pw - 1 <= xa) continue;
        const k = Math.floor((a + ox + pw) / pw), u = cell(k, row, K + 3), v = cell(k, row, K + 4);
        let d = (u - 0.5) * 0.06 + (v < 0.04 ? -0.05 : 0) + wet;
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
    const base = kind === 'fresh' ? tone(AS, -0.05) : kind === 'dusty' ? 0x55565c : AS;     // (old tarmac shows by its grain and tarred cracks: any paler and the light warms it to brown)
    const [lo, hi] = kind === 'fresh' ? [0.04, 0.98] : kind === 'grey' || kind === 'dusty' ? [0.1, 0.84] : [0.08, 0.95];
    for (let y = Z(zK1); y < Z(zK2); y++) for (let x = xa; x < xb; x++) {
      if (calm) { const k = noise((x + ox) * 7.31, y * 5.17, seed + 4); px(x, y, 1, 1, k < lo ? tone(base, -0.05) : k > hi ? tone(base, 0.04) : base); continue; }
      const v = noise((x + ox) / 3.5, y / 3.5, seed + 4) * 0.7 + noise((x + ox) / 1.3, y / 1.3, seed + 5) * 0.3;
      px(x, y, 1, 1, tone(base, v < 0.3 ? -0.035 : v > 0.72 ? 0.025 : 0));
    }
    const n = (xb - xa) / W;
    const repairs = Math.round(n * ({ worn: 7, fresh: 1, patched: 15, grey: 5, dusty: 10 }[kind] ?? 7)), cracks = Math.round(n * ({ worn: 9, fresh: 2, patched: 12, grey: 11, dusty: 12 }[kind] ?? 9));
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
      if (kind === 'yellow') { const black = k % 2 === 0; top = black ? 0x353947 : 0xe7b84a; fc = black ? 0x23252f : 0xb9862e; }
      if (kind === 'redwhite') { const red = k % 2 === 0; top = red ? 0x9e3c36 : 0xf4efe6; fc = red ? 0x6e2a2e : 0xc4bba9; }
      const sunk = kind === 'worn' && u > 0.85;
      px(a, y, w, 2, tone(top, d)); if (!sunk) px(a, y, w, 1, tone(top, d + 0.04));
      if (i + 15 < xb) px(i + 15, y, 1, 2 + (face ? 2 : 0), tone(0xa0978a, -0.12));
      if (face) { px(a, y + 2, w, 2, tone(fc, d)); px(a, y + 3, w, 1, tone(fc, d - 0.06)); }
      if (face && dust) { px(a, y + 4, w, 2, tone(fc, -0.1)); }   // (a high kerb: its face deeper)
      if (kind === 'painted' || kind === 'yellow' || kind === 'redwhite' || kind === 'worn') for (let n = 0; n < 3; n++) { const c = cell(k, n, K + 12); if (c < 0.5) { const cx = a + Math.floor(c * 2 * w); px(cx, y + (n % 2), 1, 1, kind === 'painted' ? tone(0xa0978a, 0.02) : tone(top, -0.14)); } }   // chips, worn paint
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
  if (london) {
    // London's road paint: double yellow lines along the kerbs (no waiting), but where cars may park
    // (a residents' bay: its broken white edge); the zebra's zigzags, eight metres each way along
    // both kerbs, and its give-way lines.
    const zig = zebra ? [X(zebra[0]) - 8 * M, X(zebra[1]) + 8 * M] : [-1, -1];
    const bayAt = (x) => bays.some(([a, b]) => x >= X(a) && x < X(b));
    const YL = 0xe7b84a;
    for (let x = 0; x < W; x++) {
      if (x >= zig[0] && x < zig[1]) continue;
      if (!bayAt(x)) { worn(x, Z(zK1) + 4, 1, 1, YL, 0.18, 21); worn(x, Z(zK1) + 6, 1, 1, YL, 0.18, 22); }
      worn(x, Z(zK2) - 6, 1, 1, YL, 0.18, 23); worn(x, Z(zK2) - 4, 1, 1, YL, 0.18, 24);
    }
    for (const [a, b] of bays) {                                    // the bay's edge, broken, and its ends
      const xa = Math.max(0, X(a)), xb = Math.min(W, X(b)), y = Z(zK1) + 2 + 32;
      for (let x = xa; x < xb; x++) if (((x + ox) & 7) < 5) worn(x, y, 1, 1, 0xdfe2e8, 0.2, 25);
      for (const x of [X(a), X(b) - 1]) if (x >= 0 && x < W) worn(x, Z(zK1) + 3, 1, 31, 0xdfe2e8, 0.2, 26);
    }
    if (zebra) for (const [from, to] of [[zig[0], X(zebra[0]) - 16], [X(zebra[1]) + 16, zig[1]]]) for (let x = Math.max(0, from); x < Math.min(W, to); x++) {
      const t = ((x + ox) % 12 + 12) % 12, dy = t < 6 ? t / 2 : (12 - t) / 2;
      worn(x, Z(zK1) + 6 + Math.round(dy), 1, 1, 0xdfe2e8, 0.15, 27);
      worn(x, Z(zK2) - 9 + Math.round(dy), 1, 1, 0xdfe2e8, 0.15, 28);
    }
    if (zebra) for (const x of [X(zebra[0]) - 14, X(zebra[1]) + 13]) for (let y = Z(zK1) + 4; y < Z(zK2) - 4; y++) if (y % 6 < 4) worn(x, y, 2, 1, 0xdfe2e8, 0.2, 29);
  }
  for (const [xa, xb, s] of spans) {
    const clear = (a, w) => { for (let x = a; x < a + w; x++) if (x >= xa && x < xb && (x < zx[0] || x >= zx[1])) worn(x, mid, 1, 2, 0xdfe2e8); };
    if (s.lanes === 'none') continue;
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
    const belisha = zebraKind === 'belisha';
    const xa = X(zebra[0]), xb = X(zebra[1]), w = xb - xa, top = Z(zK1) + (belisha ? 12 : 4), bot = Z(zK2) - (belisha ? 11 : 4);
    if (belisha) for (const y of [Z(zK1) + 4, Z(zK2) - 9]) { const t = 'LOOK RIGHT'; text(px, xa + Math.floor((w - textWidth(t)) / 2), y, t, 0xdfe2e8); }
    if (zebraKind === 'raised') {                                // a table: paler asphalt, its ramps marked with teeth
      px(xa - 8, Z(zK1) + 3, w + 16, Z(zK2) - Z(zK1) - 4, tone(AS, 0.05));
      for (const [ra, dir] of [[xa - 8, 1], [xb + 2, -1]]) for (let y = Z(zK1) + 5; y < Z(zK2) - 4; y += 8) for (let k = 0; k < 4; k++) px(dir > 0 ? ra + k : ra + 5 - k, y + k, 1, 4 - k > 0 ? 7 - 2 * k : 1, 0xdfe2e8);
    }
    if (zebraKind === 'faded') for (let z = top + 5; z < bot; z += 10) worn(xa + 3, z, w, 6, tone(AS, 0.03), 0.5, 8);   // an older zebra's ghost
    const wear = { white: 0.22, yellow: 0.2, faded: 0.52, fresh: 0.06, raised: 0.12, belisha: 0.12, ghost: 0.72 }[zebraKind] ?? 0.22;
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
  // Sand: drifted against the kerbs and along the walls' foot, a skin of it on the road's edges (Cairo's, Beirut's).
  if (dust) {
    const drift = (y0, dir, depth) => { for (let x = 0; x < W; x++) { const d = Math.max(0, Math.round((noise((x + ox) / 9, y0, seed + 17) - 0.35) * depth * 2 * dust)); for (let j = 0; j < d; j++) if (noise((x + ox) / 1.7, (y0 + j * dir) / 1.7, seed + 18) > 0.25 + j / (depth * 2)) px(x, y0 + j * dir, 1, 1, tone(DUST, (noise(x, j, seed + 19) - 0.5) * 0.08 - j * 0.01)); } };
    drift(Z(zK1) + 3, 1, 6); drift(Z(zK2) - 2, -1, 5); drift(2, 1, 4); drift(Z(z1) - 1, -1, 3);
    for (let i = 0; i < W * 2 * dust; i++) px(Math.floor(r() * W), Math.floor(r() * Z(z1)), 1, 1, tone(DUST, (r() - 0.5) * 0.1));
  }
  // Puddles, where the ground sags: by the kerbs, now and then on a pavement. The sky in them, a dark
  // rim along their far edge.
  for (let n = 0, count = dust ? 0 : 1 + Math.floor(r() * 4) + (london ? 3 : 0); n < count; n++) {
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
  // A terrace's areas (London): the lightwell down to the basement, under the railings: its coping
  // along the pavement, the shade down in it, the basement's window heads in its far wall.
  for (const [a, b] of areas) {
    const xa = Math.max(0, X(a)), xb = Math.min(W, X(b)), d = Math.round(0.62 * M);
    for (let y = 0; y < d - 2; y++) px(xa, y, xb - xa, 1, y < 3 ? 0x353947 : tone(0x23252f, (y - 3) * 0.004));
    for (let x = xa + 3; x < xb - 4; x += 22) { px(x, 1, Math.min(14, xb - 4 - x), 3, 0x1b2541); px(x + 1, 1, 2, 1, 0x3b6296); }   // the basement's windows, their heads
    for (let x = xa; x < xb; x++) if (r() < 0.12) px(x, 4 + Math.floor(r() * (d - 7)), 1, 1, r() < 0.5 ? 0x4c5262 : 0x2f6b3a);   // a weed, a leaf, down there
    px(xa, d - 2, xb - xa, 2, tone(0xc4bba9, -0.02 + wet)); px(xa, d - 2, xb - xa, 1, tone(0xc4bba9, 0.05 + wet)); px(xa, d - 3, xb - xa, 1, 0x14151c);
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
    f.wallKind = wall;
    if (wall === 'brick') f.bricks(0, 0, w, h, wallColor ?? 0x9e3c36);
    else if (wall === 'concrete' && finish.fine) f.concrete(0, 0, w, h, wallColor ?? 0xb8bdc8);
    else if (wall === 'stucco' && finish.fine) f.weathered(0, 0, w, h, wallColor ?? 0xf4efe6, true);
    else if (wall === 'stone') f.ashlar(0, 0, w, h, wallColor ?? 0xd8c09a);
    else f.plaster(0, 0, w, h, wallColor ?? 0xe2dac6);
    draw?.(f);
  }, { glows: GLOWS });
}

/** A metre of bricks in a colour (a chimney stack's, its building's), repeating. */
function bricksOf(c) { return paint(16, 16, (px) => fineBricks(px, 0, 0, 16, 16, c, rng(c & 0xffff)), { repeat: true }); }

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
export function building({ x0, x1, z, h, d = 8, wall = 'brick', wallColor, roof = 'flat', roofColor = 0x6a7182, kit = null, draw, seed = 1, night = false, split = false, stacks = null }) {
  const w = x1 - x0;
  const g = new THREE.Group();
  const front = facade({ w, h, wall, wallColor, draw, seed, night, split });
  const sides = keep(`side-${wall === 'stucco' || wall === 'stone' ? 'plaster' : wall}`, () => mat(0, wall === 'brick' ? tile('brick', 1) : tile('plaster', 1)));
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
    } else if (kit === 'pots') {                                 // a terrace's stacks on its party walls, a row of clay pots on each (London's)
      const xs = stacks?.length ? stacks : [0.4, w - 0.4], brick = keep(`chimney-${wallColor}`, () => mat(0, wall === 'brick' ? bricksOf(wallColor) : tile('plaster', 1))), pots = [];
      for (const sx of xs) {
        const sw = 0.9 + r() * 0.5, sh = 1.0 + r() * 0.5, zz = z - 1.2 - r() * 1.5;
        const stack = box(sw, sh, 0.55, { sides: brick, top: mat(0x353947) });
        stack.position.set(x0 + Math.max(sw / 2, Math.min(w - sw / 2, sx)), h, zz); g.add(part(stack));
        for (let k = 0, n = 2 + Math.floor(r() * 4); k < n; k++) {
          const geo = new THREE.BoxGeometry(0.16, 0.32 + r() * 0.14, 0.16); geo.translate(stack.position.x - sw / 2 + 0.14 + k * (sw - 0.28) / Math.max(1, n - 1), h + sh + 0.18, zz);
          pots.push(geo);
        }
      }
      if (pots.length) { const m = new THREE.Mesh(mergeGeometries(pots), mat(0xc95c45)); m.castShadow = true; g.add(part(m)); }
    } else if (kit === 'dishes' || kit === 'tanks' || kit === 'pigeons' || kit === 'rebar' || kit === 'solar') {
      // A roof lived on (Cairo's, Beirut's): satellite dishes by the dozen, water tanks on their frames,
      // a pigeon loft, solar water heaters; or the next floor's rebar standing off the columns.
      const white = mat(0xdfe2e8), dark = mat(0x353947), geos = { white: [], dark: [], wood: [], rust: [] };
      const add = (list, ww, hh, dd, x, y, zz, rx = 0) => { const geo = new THREE.BoxGeometry(ww, hh, dd); if (rx) geo.rotateX(rx); geo.translate(x, y + hh / 2, zz); geos[list].push(geo); };
      for (let k = 0, n = 3 + Math.floor(r() * 6); k < n; k++) {      // dishes, tipped to the sky, on their stands
        const d = roundedBox(0.6, 0.6, 0.12, 0.25, { sides: mat(0xdfe2e8), top: mat(0xf6f4ee) }), x = at(r()), zz = z - 0.6 - r() * 3;
        d.rotation.x = -0.6; d.position.set(x, h + 0.35, zz); g.add(part(d)); add('dark', 0.05, 0.4, 0.05, x, h, zz + 0.2);
      }
      if (kit === 'tanks' || r() < 0.5) for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
        const x = at(r()), zz = z - 2 - r() * 3, blue = r() < 0.5;
        add('rust', 1.1, 0.7, 1.1, x, h, zz); const t = roundedBox(0.9, 1.0, 0.9, 0.3, { sides: mat(blue ? 0x3b6296 : 0x23252f), top: mat(blue ? 0x5d8fc2 : 0x353947) }); t.position.set(x, h + 0.7, zz); g.add(part(t));
      }
      if (kit === 'pigeons') { const x = at(r()), zz = z - 3; add('wood', 0.1, 1.6, 0.1, x - 0.9, h, zz - 0.9); add('wood', 0.1, 1.6, 0.1, x + 0.9, h, zz - 0.9); add('wood', 0.1, 1.6, 0.1, x - 0.9, h, zz + 0.9); add('wood', 0.1, 1.6, 0.1, x + 0.9, h, zz + 0.9);
        const loft = box(2.0, 1.6, 2.0, { sides: keep('pigeon-loft', () => mat(0, paint(16, 13, (px) => { px(0, 0, 16, 13, 0x6b4636); for (let y = 1; y < 13; y += 3) for (let x = (y % 2); x < 16; x += 3) px(x, y, 2, 2, 0x2a1c18); px(0, 0, 16, 1, 0x8f6345); }))), top: mat(0x47302a) }); loft.position.set(x, h + 1.6, zz); g.add(part(loft)); }
      if (kit === 'solar') for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) { const x = at(r()), zz = z - 1.5 - r() * 3; const p = box(1.2, 0.06, 1.0, { sides: mat(0x8f96a6), top: mat(0x283f6b) }); p.rotation.x = -0.5; p.position.set(x, h + 0.6, zz); g.add(part(p)); add('white', 1.2, 0.35, 0.35, x, h + 0.9, zz - 0.6); }
      if (kit === 'rebar') {                                     // the columns' bars, rusty, the start of a brick wall along the front
        const step = (w - 0.4) / Math.max(1, Math.round(w / 3));
        for (let x = x0 + 0.2; x <= x1 - 0.19; x += step) for (const zz of [z - 0.3, z - 3.5]) for (const dx of [-0.12, 0.12]) add('rust', 0.035, 0.9 + r() * 0.5, 0.035, x + dx, h, zz);
        const wall = box(w * (0.3 + r() * 0.5), 0.6 + r() * 0.6, 0.25, { sides: keep('bricks-red', () => mat(0, bricksOf(0xa8503c))), top: mat(0x8f3a30) }); wall.position.set(x0 + w * 0.3, h, z - 0.15); g.add(part(wall));
      }
      for (const [k, list] of Object.entries(geos)) if (list.length) { const m = new THREE.Mesh(mergeGeometries(list), k === 'white' ? white : k === 'dark' ? dark : k === 'wood' ? mat(0x6b4636) : mat(0x6e3a2a)); m.castShadow = true; g.add(part(m)); }
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
    const tiles = keep('roof-tiles', () => mat(0, tile('roof', 1)));
    const slope = box(w + 0.3, 0.2, len, { sides: mat(0x6e2a2e), top: tiles });
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
  } else if (kind === 'london') {                                // London's: black cast iron, a gold band, its slot
    const sides = keep('bin-london', () => mat(0, paint(8, 15, (px) => { px(0, 0, 8, 15, 0x23252f); px(0, 0, 8, 1, 0x353947); px(0, 2, 8, 1, 0xb9862e); px(0, 3, 8, 1, 0xe7b84a); px(1, 5, 6, 2, 0x14151c); px(0, 13, 8, 2, 0x14151c); })));
    add(roundedBox(0.46, 0.92, 0.46, 0.06, { sides, top: mat(0x14151c) }), 0, 0, 0);
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
  cab: { body: 0.78, ride: 0.32, cab: 2.6, at: -0.25, cabH: 0.82, round: 0.2 },   // London's black cab: tall, rounded, its TAXI sign
};
/**
 * A car, 4.2 × 1.8 m, facing +x (rotate the group to turn it): painted sides, windows, lights. `kind`
 * a make (CARS: a sedan, a boxy Soviet saloon with chrome bumpers, a hatchback, an estate with a roof
 * rack, a van, an SUV with a spare wheel; 'taxi' a yellow sedan with its chequered band and roof
 * sign). Its painted faces are made once a make and colour.
 */
export function car(color = 0x3b6296, { taxi = false, seed = 5, kind = 'sedan' } = {}) {
  if (kind === 'taxi') { taxi = true; kind = 'sedan'; color = 0xe7b84a; }
  const city = kind === 'cairotaxi' ? 'cairo' : kind === 'servis' ? 'beirut' : null;     // Cairo's white taxi with its chequered band; Beirut's service taxi, an old Mercedes, its red plate
  if (city === 'cairo') { kind = 'sedan'; color = 0xf6f4ee; taxi = true; }
  if (city === 'beirut') { kind = 'boxy'; color = pick3(seed, 1, [0xf6f4ee, 0xdfe2e8, 0xc4bba9, 0x8f96a6]); taxi = true; }
  const cab = kind === 'cab';
  if (cab) color = 0x23252f;
  const K = CARS[kind] ?? CARS.sedan;
  const L = 4.2, Wd = 1.8, body = mat(color), dark = 0x23252f, key = `${kind}-${color}-${taxi}-${city}`;
  const side = keep(`car-side-${key}`, () => mat(0, paint(Math.round(L * M), Math.round(K.body * 16), (px, W, H) => {
    px(0, 0, W, H, color);
    px(0, 0, W, 1, 0xdfe2e8);                                    // the lit crease
    px(Math.floor(W * 0.32), 1, 1, H - 3, dark); px(Math.floor(W * 0.58), 1, 1, H - 3, dark);   // doors
    if (kind === 'van') px(Math.floor(W * 0.8), 1, 1, H - 3, dark);
    px(Math.floor(W * 0.4), 4, 3, 1, dark); px(Math.floor(W * 0.66), 4, 3, 1, dark);           // handles
    if (taxi && city !== 'beirut') for (let x = 0; x < W; x += 2) { px(x, 6, 1, 1, x % 4 ? 0xf6f4ee : dark); px(x + 1, 7, 1, 1, x % 4 ? dark : 0xf6f4ee); }   // the chequered band
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
    const wheel = box(wr, wr, 0.26, { sides: mat(0x14151c), front: wheelFace, back: wheelFace });   // (a car turned to face the other way shows the back of its wheels)
    wheel.position.set(sx, 0, sz);
    g.add(part(wheel));
  }
  if (K.rack) for (const dx of [-0.9, 0.2]) { const bar = box(0.06, 0.06, Wd - 0.3, { sides: mat(0x23252f) }); bar.position.set(K.at + dx, K.ride + K.body + K.cabH - 0.03, 0); g.add(part(bar, cabin.userData.part)); }
  if (K.spare) { const sp = box(0.2, 0.6, 0.6, { sides: mat(0x14151c), top: mat(0x23252f) }); sp.position.set(-2.2, K.ride + 0.1, 0); g.add(part(sp)); }
  if (cab) {                                                     // the black cab's sign: amber, small, at the windscreen
    const sign = keep('cab-sign', () => mat(0, paint(14, 6, (px) => { px(0, 0, 14, 6, 0xe7b84a); px(0, 0, 14, 1, 0xf8e08a); text(px, 0, 1, 'TAXI', INK); }, { glows: [0xe7b84a] })));
    const t = box(0.75, 0.22, 0.24, { sides: mat(0xe7b84a), front: sign, back: sign });
    t.position.set(K.at + K.cab / 2 - 0.5, K.ride + K.body + K.cabH - 0.06, 0);
    t.rotation.y = Math.PI / 2;
    g.add(part(t));
  }
  if (taxi) {
    const word = city === 'beirut' ? 'TAXI' : city === 'cairo' ? 'تاكسي' : 'TAXI';
    const sign = keep(`taxi-sign-${city}`, () => mat(0, paint(city === 'cairo' ? 20 : 16, 7, (px, W) => { px(0, 0, W, 7, city === 'beirut' ? 0xf6f4ee : 0xf8e08a); text(px, Math.floor((W - textWidth(word)) / 2), 1, word, city === 'beirut' ? 0x9e3c36 : INK); }, { glows: [0xf8e08a] })));
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
      : kind === 'yew' ? [0x14151c, 0x173327, 0x173327, 0x24503a, 0x2f6b62]
      : kind === 'holly' ? [0x14151c, 0x173327, 0x24503a, 0x356f42, 0x76ad4c]
      : kind === 'laurel' ? [0x173327, 0x24503a, 0x356f42, 0x4f8f45, 0xa6cc5e]
      : kind === 'ficus' ? [0x14151c, 0x173327, 0x24503a, 0x356f42, 0x4f8f45]
      : kind === 'bougainvillea' || kind === 'oleander' ? [0x173327, 0x24503a, 0x356f42, 0x4f8f45, 0x76ad4c]
      : kind === 'myrtle' ? [0x173327, 0x24503a, 0x2f6b62, 0x4f8f45, 0x76ad4c]
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
      if (kind === 'holly') for (let i = 0; i < 14; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); dot(x, y, 1, 1, 0x9e3c36); if (r() < 0.5) dot(x + 1, y, 1, 1, 0xc95c45); }   // its berries
      if (kind === 'laurel') for (let i = 0; i < 20; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); dot(x, y, 3, 1, pal[4]); }   // big glossy leaves catching the light
      if (kind === 'bougainvillea') for (let i = 0; i < 40; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); dot(x, y, 2, 2, r() < 0.7 ? 0xc95c8a : 0x9e3c6a); if (r() < 0.4) dot(x + 1, y, 1, 1, 0xe8896a); }   // its bracts, magenta
      if (kind === 'oleander') for (let i = 0; i < 26; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n), c = [0xe8896a, 0xf6f4ee, 0xc95c8a][Math.floor(r() * 3)]; dot(x, y, 2, 1, c); dot(x, y + 1, 1, 1, tone(c, -0.08)); }
    }, { repeat: true }));
  });
}

// ---------- the cities' street furniture ----------

/**
 * A red telephone box (London's K6), its front to the street at z: cast-iron red, small panes in three
 * columns, the crowned TELEPHONE panel over the door (lit at night: userData.heads), a domed roof.
 */
export function phonebox(x, z) {
  const g = new THREE.Group(), red = 0x9e3c36;
  const face = keep('phonebox-face', () => mat(0, paint(14, 38, (px, W, H) => {
    px(0, 0, W, H, red); px(0, 0, 1, H, tone(red, 0.06)); px(W - 1, 0, 1, H, tone(red, -0.1));
    px(2, 7, W - 4, H - 10, 0x6e2a2e);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 3; i++) { px(3 + i * 3, 8 + j * 3, 2, 2, 0x283f6b); if ((i + j) % 4 === 0) px(3 + i * 3, 8 + j * 3, 1, 1, 0x95c1e3); }
    px(W - 3, 20, 1, 3, 0xb9862e);                                  // the handle
    px(0, H - 3, W, 3, tone(red, -0.16));
  })));
  const body = box(0.88, 2.35, 0.68, { sides: face, top: mat(red) });
  g.add(part(body));
  const panel = keep('phonebox-panel', () => mat(0, paint(14, 4, (px) => { px(0, 0, 14, 4, 0xe2dac6); for (let i = 1; i < 13; i += 2) px(i, 1, 1, 2, 0x23252f); })));
  const sign = box(0.9, 0.22, 0.7, { sides: panel, top: mat(red) });
  sign.position.y = 2.1; g.add(part(sign, body.userData.part));
  const roof = roundedBox(0.98, 0.26, 0.78, 0.1, { sides: mat(red), top: mat(tone(red, 0.06)) });
  roof.position.y = 2.32; g.add(part(roof, body.userData.part));
  g.position.set(x, 0, z);
  g.userData.heads = [sign];
  return g;
}

/** A Belisha beacon: a pole in black and white bands, an amber globe (lit at night: userData.heads). */
export function beacon(x, z) {
  const g = new THREE.Group();
  const bands = keep('beacon-pole', () => mat(0, paint(2, 32, (px) => { for (let y = 0; y < 32; y += 8) { px(0, y, 2, 4, 0x23252f); px(0, y + 4, 2, 4, 0xf4efe6); } }, { repeat: true })));
  const pole = box(0.09, 2.3, 0.09, { sides: bands, top: mat(0x23252f) });
  g.add(part(pole));
  const globe = roundedBox(0.32, 0.32, 0.32, 0.15, { sides: mat(0xe7b84a), top: mat(0xf8e08a) });
  globe.position.y = 2.3; g.add(part(globe));
  g.position.set(x, 0, z);
  g.userData.heads = [globe];
  return g;
}

// A pub's sign's pictures (12 × 9): a crown, a red lion, a white hart, an anchor, a rose, a star, a bell.
const EMBLEMS = {
  crown: [0x9e3c36, ['............', '..g..g..g...', '..gg.gg.gg..', '..gggggggg..', '..gyggygyg..', '..gggggggg..', '..kkkkkkkk..', '............']],
  lion: [0xe7b84a, ['............', '...rr.......', '..rrrr...r..', '..rrrrrrrr..', '...rrrrrrr..', '...r.r..r.r.', '...r.r..r.r.', '............']],
  hart: [0x24503a, ['..w.w.......', '...w........', '...ww.......', '....wwwwww..', '....wwwwww..', '....w.w..w..', '....w.w..w..', '............']],
  anchor: [0x1b2541, ['.....gg.....', '....g..g....', '.....gg.....', '..gggggggg..', '.....gg.....', '..g..gg..g..', '...gggggg...', '............']],
  rose: [0xf4efe6, ['............', '....rrrr....', '...rrRrrr...', '...rRRRrr...', '....rrrr....', '.....gg.....', '....g..g....', '............']],
  star: [0x283f6b, ['.....g......', '.....g......', '.gggggggg...', '...ggggg....', '...gg.gg....', '..g.....g...', '............', '............']],
  bell: [0x24503a, ['.....g......', '....ggg.....', '...ggggg....', '...ggggg....', '..ggggggg...', '..ggggggg...', '.....g......', '............']],
};
/** A pub's hanging sign: its picture in a gilt frame, on a bracket out from the wall at z; its top at y. */
export function pubSign(x, y, z, emblem = 'crown', name = '') {
  const [bg, rows] = EMBLEMS[emblem] ?? EMBLEMS.crown;
  const face = keep(`pubsign-${emblem}`, () => mat(0, paint(16, 13, (px) => {
    px(0, 0, 16, 13, 0xb9862e); px(1, 1, 14, 11, bg); px(1, 1, 14, 1, tone(bg, 0.08));
    const col = { g: 0xe7b84a, y: 0xf8e08a, r: 0x9e3c36, R: 0x6e2a2e, w: 0xf4efe6, k: 0x23252f };
    rows.forEach((row, j) => [...row].forEach((c, i) => { if (col[c]) px(2 + i, 2 + j, 1, 1, col[c]); }));
  })));
  const g = new THREE.Group(), iron = mat(0x23252f);
  const board = box(1.0, 0.8, 0.05, { front: face, back: face, sides: mat(0xb9862e) });
  board.position.set(x, y - 0.95, z + 0.75); g.add(board);
  const arm = box(0.05, 0.05, 1.1, { sides: iron }); arm.position.set(x, y, z + 0.55); g.add(arm);
  const stay = box(0.04, 0.04, 0.8, { sides: iron }); stay.rotation.x = -0.6; stay.position.set(x, y - 0.55, z + 0.2); g.add(stay);
  for (const dx of [-0.38, 0.38]) { const c = box(0.03, 0.15, 0.03, { sides: iron }); c.position.set(x + dx, y - 0.15, z + 0.75); g.add(c); }
  return part(g);
}

/**
 * A handcart at the kerb (Cairo's), its long side to the street: a painted wooden bed on two wheels,
 * what it sells on top (`look`: 'fruit' (oranges), 'bananas', 'bread' (rounds of aish baladi on a
 * tray), 'potato' (sweet potatoes in their oven, its chimney), 'foul' (the copper pot)).
 */
export function cart(x, z, look = 'fruit', seed = 1) {
  const g = new THREE.Group(), paintC = pick3(seed, 3, [0x3b6296, 0x356f42, 0x9e3c36, 0xe7b84a]);
  const side = keep(`cart-side-${paintC}`, () => mat(0, paint(27, 7, (px, W, H) => { px(0, 0, W, H, paintC); px(0, 0, W, 1, tone(paintC, 0.1)); for (let x = 2; x < W; x += 5) px(x, 1, 1, H - 2, tone(paintC, -0.12)); px(0, H - 1, W, 1, tone(paintC, -0.2)); px(3, 2, 6, 2, 0xf6f4ee); px(W - 9, 3, 5, 1, 0xe7b84a); })));
  const bed = box(1.7, 0.42, 0.72, { sides: side, top: mat(0x6b4636) });
  bed.position.y = 0.42; g.add(part(bed));
  const wheel = keep('cart-wheel', () => mat(0, paint(10, 10, (px) => { px(0, 0, 10, 10, 0x23252f); px(1, 1, 8, 8, 0x47302a); px(4, 0, 2, 10, 0x23252f); px(0, 4, 10, 2, 0x23252f); px(4, 4, 2, 2, 0x8f96a6); })));
  for (const dz of [0.4, -0.4]) { const wh = box(0.62, 0.62, 0.08, { sides: mat(0x23252f), front: wheel, back: wheel }); wh.position.set(0, 0, dz); g.add(part(wh)); }
  for (const dx of [0.95, 1.25]) { const h2 = box(0.5, 0.05, 0.05, { sides: mat(0x6b4636) }); h2.position.set(dx, 0.75, dx > 1 ? 0.25 : -0.25); g.add(h2); }
  const goods = { fruit: [0xe7b84a, 0xc95c45, 0xe8896a], bananas: [0xe7b84a, 0xf8e08a, 0xb9862e], bread: [0xd6ad7a, 0xb48459, 0x8f6345] }[look];
  if (goods) {
    const top = keep(`cart-goods-${look}`, () => mat(0, paint(26, 11, (px, W, H) => {
      px(0, 0, W, H, 0x47302a);
      for (let y = 0; y < H; y += 3) for (let x = (y / 3) % 2 ? 1 : 0; x < W; x += 3) { const c = goods[(x * 7 + y * 3) % goods.length]; if (look === 'bananas') { px(x, y, 3, 1, c); px(x, y + 1, 1, 1, tone(c, -0.1)); } else { px(x, y, 2, 2, c); px(x, y, 1, 1, tone(c, 0.08)); } }
    })));
    const heap = roundedBox(1.55, 0.22, 0.62, 0.1, { sides: top, top });
    heap.position.y = 0.84; g.add(part(heap));
  } else if (look === 'foul') {                                   // the qidra: a big copper pot, its lid, a ladle
    const pot = roundedBox(0.62, 0.62, 0.62, 0.22, { sides: mat(0xb9862e), top: mat(0x8f6345) }); pot.position.set(-0.3, 0.84, 0); g.add(part(pot));
    const lid = box(0.3, 0.1, 0.3, { sides: mat(0xe7b84a) }); lid.position.set(-0.3, 1.46, 0); g.add(part(lid));
    const tray = box(0.6, 0.12, 0.55, { sides: mat(0xdfe2e8), top: mat(0xf6f4ee) }); tray.position.set(0.45, 0.84, 0); g.add(part(tray));
  } else if (look === 'potato') {                                 // the sweet potato oven: a black drum, its chimney, embers
    const drum = box(1.0, 0.6, 0.6, { sides: keep('potato-oven', () => mat(0, paint(16, 10, (px) => { px(0, 0, 16, 10, 0x23252f); px(3, 6, 10, 3, 0xc95c45); px(4, 7, 8, 1, 0xe7b84a); px(0, 0, 16, 1, 0x353947); }, { glows: [0xe7b84a] }))), top: mat(0x353947) });
    drum.position.set(-0.2, 0.84, 0); g.add(part(drum));
    const flue = box(0.14, 0.9, 0.14, { sides: mat(0x23252f) }); flue.position.set(-0.55, 1.44, 0); g.add(part(flue));
  }
  compact(g);
  g.position.set(x, 0, z);
  return part(g);
}

/** A vendor's stall against a wall (Cairo's): a counter of cigarettes and sweets (`look` 'kiosk'), papers on a rack, or jars of sweets, its little canopy. */
export function stall(x, z, look = 'kiosk') {
  const g = new THREE.Group();
  const front = keep(`stall-${look}`, () => mat(0, paint(22, 14, (px, W, H) => {
    px(0, 0, W, H, 0x6b4636); px(0, 0, W, 1, 0x8f6345);
    if (look === 'papers') for (let x = 1; x < W - 3; x += 4) { px(x, 2, 3, 5, 0xf6f4ee); px(x, 3, 3, 1, 0x23252f); px(x, 5, 2, 1, 0x9e3c36); px(x, 8, 3, 5, 0xe2dac6); px(x, 9, 3, 1, 0x283f6b); }
    else for (let y = 1; y < H - 2; y += 3) for (let x = 1; x < W - 1; x += 2) px(x, y, 1, 2, [0x9e3c36, 0xf6f4ee, 0x3b6296, 0xe7b84a, 0x356f42, 0xc95c45][(x * 3 + y) % 6]);
  })));
  const counter = box(1.3, 0.9, 0.55, { sides: mat(0x6b4636), front, top: mat(0x8f6345) });
  g.add(part(counter));
  const canopy = box(1.45, 0.05, 0.8, { sides: mat(0x9e3c36), top: keep('stall-canopy', () => mat(0, paint(16, 16, (px) => { for (let x = 0; x < 16; x++) px(x, 0, 1, 16, Math.floor(x / 4) % 2 ? 0xf6f4ee : 0x9e3c36); }, { repeat: true }))) });
  canopy.position.set(0, 2.0, 0.15); canopy.rotation.x = 0.18; g.add(part(canopy));
  for (const dx of [-0.65, 0.65]) { const pole = box(0.04, 2.0, 0.04, { sides: mat(0x8f96a6) }); pole.position.set(dx, 0, 0.5); g.add(pole); }
  g.position.set(x, 0, z);
  return part(g);
}

/** A souk's stall down the side of a passage: its counter heaped with what it sells (`look`: 'spice', 'cloth', 'lamps', 'brass', 'fruit'), an awning over it. userData.heads: lanterns that light. */
export function soukStall(x, z, side = 0, look = 'spice') {
  const g = new THREE.Group(), heads = [];
  const TOPS = { spice: [0x9e3c36, 0xe7b84a, 0xc95c45, 0x356f42, 0x8f6345, 0xb9862e], cloth: [0x9e3c36, 0x283f6b, 0xe7b84a, 0x356f42, 0x7a4a86, 0xf6f4ee], brass: [0xe7b84a, 0xb9862e, 0xf8e08a, 0x8f6345], fruit: [0xe7b84a, 0xc95c45, 0x76ad4c, 0xe8896a], lamps: [0x6b4636, 0x8f6345] };
  const cols = TOPS[look] ?? TOPS.spice;
  const top = keep(`souk-top-${look}`, () => mat(0, paint(14, 26, (px, W, H) => {
    px(0, 0, W, H, 0x47302a);
    if (look === 'spice') for (let y = 1; y < H - 4; y += 6) for (let x = 1; x < W - 4; x += 6) { const c = cols[(x + y * 2) % cols.length]; for (let j = 0; j < 5; j++) px(x + Math.abs(2 - j), y + j, 5 - 2 * Math.abs(2 - j), 1, j < 2 ? tone(c, 0.06) : c); }
    else if (look === 'cloth') for (let y = 0; y < H; y += 3) px(0, y, W, 3, cols[(y / 3) % cols.length]);
    else for (let y = 1; y < H - 2; y += 3) for (let x = 1; x < W - 2; x += 3) { const c = cols[(x * 5 + y) % cols.length]; px(x, y, 2, 2, c); px(x, y, 1, 1, tone(c, 0.1)); }
  })));
  const counter = box(0.9, 0.85, 1.6, { sides: mat(0x6b4636), top, front: mat(0x8f6345) });
  g.add(part(counter));
  const awn = box(1.0, 0.05, 1.7, { sides: mat(0x9e3c36), top: keep(`souk-awning-${side}`, () => mat(0, paint(16, 16, (px) => { for (let y = 0; y < 16; y++) px(0, y, 16, 1, Math.floor(y / 4) % 2 ? 0xe2dac6 : side ? 0x24503a : 0x9e3c36); }, { repeat: true }))) });
  awn.position.set(side ? -0.15 : 0.15, 2.3, 0); awn.rotation.z = side ? -0.2 : 0.2; g.add(part(awn));
  if (look === 'lamps') for (let k = 0; k < 4; k++) {               // brass lanterns hung from the awning's edge
    const lamp = roundedBox(0.22, 0.32, 0.22, 0.08, { sides: mat([0xe7b84a, 0x9e3c36, 0x3b6296, 0x356f42][k]), top: mat(0xb9862e) });
    lamp.position.set(side ? -0.45 : 0.45, 1.75, -0.6 + k * 0.4); g.add(part(lamp)); heads.push(lamp);
  }
  g.position.set(x, 0, z);
  g.userData.heads = heads;
  return part(g);
}

/**
 * A minaret (Cairo's), rising from a mosque's roof at height `base` at (x, z), to `h` metres: a square
 * shaft with its niches, a balcony on its corbels, an octagon, a second balcony, a slender top
 * stage, and a Mamluk's bulb on columns or an Ottoman's pencil cone, its crescent on a finial.
 */
export function minaret(x, z, base, h, kind = 'mamluk', stone = 0xe2d2b0) {
  const g = new THREE.Group();
  const shaft = keep(`minaret-${stone}`, () => mat(0, paint(16, 32, (px) => {
    px(0, 0, 16, 32, stone);
    for (let y = 0; y < 32; y += 4) { px(0, y, 16, 1, tone(stone, -0.08)); for (let x = (y / 4) % 2 ? 3 : 7; x < 16; x += 8) px(x, y, 1, 4, tone(stone, -0.06)); }
    px(5, 6, 6, 14, tone(stone, -0.14)); for (let j = 0; j < 4; j++) px(5 + j, 6 - j, 6 - 2 * j, 1, tone(stone, -0.14));   // a pointed niche
    px(6, 9, 4, 9, 0x23252f);
  }, { repeat: true })));
  const rail = keep('minaret-rail', () => mat(0, paint(8, 6, (px) => { px(0, 0, 8, 1, 0x8f6345); for (let x = 0; x < 8; x += 2) px(x, 1, 1, 5, 0x6b4636); px(0, 5, 8, 1, 0x47302a); }, { repeat: true })));
  let y = base;
  const stage = (wd, hh) => { const m = box(wd, hh, wd, { sides: shaft, top: mat(tone(stone, 0.05)) }); m.position.set(x, y, z); g.add(part(m)); y += hh; };
  const balcony = (wd) => { const s2 = box(wd, 0.25, wd, { sides: mat(tone(stone, -0.08)), top: mat(tone(stone, -0.06)) }); s2.position.set(x, y, z); g.add(part(s2)); const rr = box(wd, 0.6, wd, { sides: rail, top: mat(tone(stone, -0.1)) }); rr.position.set(x, y + 0.25, z); g.add(part(rr)); y += 0.25; };
  const total = h, s1 = total * 0.36, s2 = total * 0.26, s3 = total * 0.14;
  stage(2.4, s1); balcony(3.0); stage(1.9, s2); balcony(2.5); stage(1.35, s3);
  if (kind === 'ottoman') {                                       // a pencil: a long cone in rings, lead-grey
    for (let k = 0; k < 7; k++) { const wd = 1.3 - k * 0.17, m = box(wd, 0.7, wd, { sides: mat(k % 2 ? 0x6a7182 : 0x8f96a6), top: mat(0x8f96a6) }); m.position.set(x, y, z); g.add(part(m)); y += 0.7; }
  } else {                                                        // a pavilion of columns and its bulb
    for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) { const c = box(0.16, 1.6, 0.16, { sides: mat(stone) }); c.position.set(x + dx, y, z + dz); g.add(part(c)); }
    y += 1.6;
    const bulb = roundedBox(1.15, 1.5, 1.15, 0.5, { sides: mat(tone(stone, -0.03)), top: mat(tone(stone, -0.02)) }); bulb.position.set(x, y, z); g.add(part(bulb)); y += 1.5;
  }
  const fin = box(0.08, 1.0, 0.08, { sides: mat(0xb9862e) }); fin.position.set(x, y, z); g.add(fin);
  const moon = box(0.4, 0.4, 0.05, { sides: mat(0xe7b84a) }); moon.position.set(x, y + 1.0, z); g.add(part(moon));
  return g;
}

/** A neighbourhood generator (Beirut's): a green steel cabinet, louvred, its exhaust up the side, a warning plate; its cables are the street's. */
export function generator(x, z) {
  const g = new THREE.Group();
  const side = keep('generator-side', () => mat(0, paint(35, 26, (px, W, H) => {
    px(0, 0, W, H, 0x356f42); px(0, 0, W, 1, 0x4f8f45); px(W - 1, 0, 1, H, 0x24503a);
    for (let y = 4; y < 14; y += 2) px(3, y, 12, 1, 0x173327);
    px(20, 4, 9, 6, 0xe7b84a); px(21, 5, 7, 4, 0x23252f); px(23, 6, 3, 2, 0xe7b84a);
    for (let k = 0; k < 6; k++) px(Math.floor(k * 6 + 2), H - 4 - (k % 2), 4, 1, 0x6e3a2a);   // rust along its foot
    px(0, H - 2, W, 2, 0x23252f);
  })));
  const body = box(1.2, 1.6, 2.2, { sides: side, top: mat(0x24503a) });
  g.add(part(body));
  const pipe = box(0.12, 1.1, 0.12, { sides: mat(0x4c5262) }); pipe.position.set(0.4, 1.6, -0.8); g.add(part(pipe, body.userData.part));
  g.position.set(x, 0, z);
  return g;
}

/**
 * Cables, slung (Beirut's): each a run of points [x, y, z] sagging between them, as one mesh of thin
 * dark segments (one draw for the lot), casting no shadow.
 */
export function cablesMesh(runs) {
  const geos = [], up = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const pts of runs) for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1], [bx, by, bz] = pts[i];
    dir.set(bx - ax, by - ay, bz - az);
    const len = dir.length();
    if (len < 1e-3) continue;
    const geo = new THREE.BoxGeometry(0.07, 0.07, len);
    q.setFromUnitVectors(up, dir.normalize());
    geo.applyQuaternion(q); geo.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    geos.push(geo);
  }
  if (!geos.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geos), mat(0x14151c));
  m.castShadow = false; m.receiveShadow = false;
  m.userData.noId = true;                                         // (it draws its own dark line: no outline round every segment)
  return m;
}
