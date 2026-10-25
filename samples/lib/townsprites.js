// TRADECRAFT samples: the town's sprites, for the pixel-art look: trees and street props, drawn as
// pixel art and stood in the 3D street as upright cards (sprites.js card()), like the people.
//
// A tree is generated: a trunk with bark, then a crown of overlapping leaf clumps from the back (top)
// to the front (bottom), each shaded round from the upper left (light, base, shade, dark), broken by
// a leafy noise so the bands become clusters of leaves, with a few bright tips and a dark outline.
// Its card casts the sun's shadow: the silhouette, flattened onto the ground behind it.
//
// The props are templates shaded by sprites.js (drawSprite): a potted shrub, a post box, a café
// chalkboard, a bistro table and chair, a bicycle, a pigeon (two frames: standing, pecking).
import * as THREE from 'three';
import { rng } from './pixelart.js';
import { drawSprite, blit, card } from './sprites.js';

const LEAF = [0x173327, 0x24503a, 0x356f42, 0x4f8f45, 0x76ad4c, 0xa6cc5e];   // dark → light
const BARK = [0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345];

function canvasOf(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}

// A smooth value noise on a grid of `cell` pixels, for leafy clusters.
function noise(seed, cell) {
  const r = rng(seed), grid = new Map();
  const v = (i, j) => { const k = i * 7919 + j; if (!grid.has(k)) grid.set(k, r()); return grid.get(k); };
  return (x, y) => {
    const i = Math.floor(x / cell), j = Math.floor(y / cell), fx = x / cell - i, fy = y / cell - j;
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/**
 * Leaf clumps onto a grid of pixels: each clump [cx, cy, r], drawn back to front (sorted by cy).
 * Returns rows of colours (null where no leaves). `palette` dark → light.
 */
function foliage(w, h, clumps, seed, palette = LEAF) {
  const own = Array.from({ length: h }, () => Array(w).fill(-1));
  const edge = noise(seed + 1, 2);
  clumps.sort((a, b) => a[1] - b[1]).forEach(([cx, cy, r], i) => {
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const d = Math.hypot(x - cx, (y - cy) * 1.1);
      if (d <= r + (edge(x, y) - 0.5) * 2.4) own[y][x] = i;      // a leafy, bumpy rim
    }
  });
  const leaf = noise(seed, 3), fine = noise(seed + 2, 1.5);
  const out = Array.from({ length: h }, () => Array(w).fill(null));
  const top = Math.min(...clumps.map(c => c[1] - c[2])), bottom = Math.max(...clumps.map(c => c[1] + c[2]));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = own[y][x];
    if (i < 0) continue;
    const [cx, cy, r] = clumps[i];
    // Round light from the upper left, the crown darker towards its underside, broken into leaves.
    let t = (-(x - cx) * 0.55 - (y - cy) * 0.83) / r;
    t -= ((y - top) / (bottom - top) - 0.5) * 0.5;
    t += (leaf(x, y) - 0.5) * 0.7 + (fine(x, y) - 0.5) * 0.25;
    // A clump's top edge over the clump behind it catches the light; the pixel under its rim is shade.
    if (y > 0 && own[y - 1][x] >= 0 && own[y - 1][x] < i) t += 0.35;
    if (y + 1 < h && own[y + 1][x] > i) t -= 0.5;
    const k = t > 0.75 ? 5 : t > 0.35 ? 4 : t > -0.1 ? 3 : t > -0.55 ? 2 : 1;
    out[y][x] = palette[k];
  }
  return out;
}

/** A tree: a card 4.5 m wide and 5.5 m tall (a crown some 3.5 m across), its trunk over its origin. */
export function treeCard({ seed = 3, size = 1 } = {}) {
  const w = 72, h = 88, cx = 36, R = 28 * size, cy = 36 + (1 - size) * 18;
  const r = rng(seed);
  // The crown: a ring of clumps round the middle, and a few inside, smaller at the top.
  const clumps = [[cx, cy, R * 0.62]];
  for (let k = 0; k < 11; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.4;
    clumps.push([cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.5, R * (0.38 + r() * 0.14)]);
  }
  for (let k = 0; k < 6; k++) clumps.push([cx + (r() - 0.5) * R * 0.9, cy + (r() - 0.3) * R * 0.6, R * (0.3 + r() * 0.1)]);
  const leaves = foliage(w, h, clumps, seed);
  const px = Array.from({ length: h }, () => Array(w).fill(null));
  // The trunk: lit on the left, a dark streak or two, flared at the foot, in the crown's shadow at the top.
  const t0 = Math.floor(cy + R * 0.35);
  for (let y = t0; y < h - 1; y++) {
    const flare = y > h - 4 ? 1 : 0, half = 2 + flare;
    for (let x = cx - half; x <= cx + half; x++) {
      const k = x - (cx - half);
      let c = k === 0 ? BARK[3] : k >= 2 * half ? BARK[1] : BARK[2];
      if ((x === cx + 1 && (y * 7) % 5 < 2) || (x === cx - 1 && (y * 3) % 7 === 0)) c = BARK[1];
      if (y < t0 + 4) c = BARK[0];
      px[y][x] = c;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (leaves[y][x] !== null) px[y][x] = leaves[y][x];
  // The outline: dark green round the leaves, dark brown round the bark.
  const out = px.map(row => row.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[y][x] !== null) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => px[y + dy]?.[x + dx]).filter(c => c !== null && c !== undefined);
    if (n.length) out[y][x] = n.some(c => BARK.includes(c)) && !n.some(c => LEAF.includes(c)) ? 0x2a1c18 : 0x173327;
  }
  const [cv, g] = canvasOf(w, h);
  blit(g, out);
  const m = card(cv, { ox: cx });
  m.castShadow = true;                                           // the silhouette, flattened on the ground
  return m;
}

// ---------- props from templates ----------

const PROPS = {
  shrub: [16, 22, (seed) => {
    const leaves = foliage(16, 13, [[8, 6, 6], [4, 8, 4], [12, 8, 4], [8, 9, 5]], seed);
    return { pre: leaves, layers: [[3, 13, ['uuuuuuuuuu', 'UUUUUUUUUU', '.uuuuuuuu.', '.uuuuuuuu.', '.uuuuuuuu.', '..uuuuuu..', '..UUUUUU..', '..kkkkkk..']]], col: { u: 0xc95c45 } };
  }],
  postbox: [11, 20, () => ({ layers: [[1, 1, [
    '...ttt...', '.ttttttt.', 'ttttttttt', 'TTTTTTTTT', 'ttttttttt', 'ttkkkkktt', 'ttttttttt', 'ttttttttt', 'ttgggggtt',
    'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'TTTTTTTTT', 'kkkkkkkkk']]], col: { t: 0x9e3c36 } })],
  chalkboard: [14, 18, () => ({ layers: [
    [1, 1, ['.uuuuuuuuuu.', 'uu........uu', 'u..........u', 'u..........u', 'u..........u', 'u..........u', 'u..........u', 'u..........u', 'u..........u', 'uu........uu', '.uuuuuuuuuu.', '.u........u.', '.u........u.', 'u..........u', 'u..........u', 'u..........u']],
    [2, 2, ['kkkkkkkkkk', 'kwwkwwwkkk', 'kkkkkkkkkk', 'kgggkggkkk', 'kkkkkkkkkk', 'kwkwwkwwkk', 'kkkkkkkkkk', 'kwwwkwwkkk', 'kkkkkkkkkk']],
  ], col: { u: 0x8f6345, w: 0xdfe2e8 } })],
  table: [14, 15, () => ({ layers: [
    [6, 4, ['kk', 'kk', 'kk', 'kk', 'kk', 'kk', 'kk', 'kk', 'kk']],
    [3, 12, ['kkkkkkkk']],
    [1, 1, ['..mmmmmmmm..', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '..MMMMMMMM..']],
  ], col: { m: 0xb8bdc8 } })],
  chair: [11, 16, () => ({ layers: [
    [1, 1, ['.kkkkkkk.', '.k.....k.', '.k.....k.', '.kkkkkkk.', '.k.....k.', '.k.....k.']],
    [1, 7, ['uuuuuuuuu', 'UUUUUUUUU']],
    [1, 9, ['.k.....k.', '.k.....k.', '.k.....k.', '.k.....k.', '.k.....k.']],
  ], col: { u: 0x8f6345 } })],
  bicycle: [28, 18, () => {
    const ring = (cx) => { const rows = []; for (let y = 0; y < 11; y++) { let s = ''; for (let x = 0; x < 11; x++) { const d = Math.hypot(x - 5, y - 5); s += d > 4.2 && d < 5.6 ? 'k' : d < 1 ? 'm' : '.'; } rows.push(s); } return [cx - 5, 6, rows]; };
    return { layers: [ring(6), ring(20),
      [6, 6, ['..........yy....', '.........y..y...', '...yyyyyyyyyyy..', '..y.....y....y..', '.y......y.....y.', 'y.......y......y']],
      [7, 4, ['kkk']], [17, 3, ['.kk', 'kk.']],
    ], col: { y: 0x3b6296, m: 0x8f96a6 } };
  }],
  pigeon: [9, 7, (seed, peck) => ({ layers: [[1, 1, peck
    ? ['.......', '.tttt..', 'ttttttt', '.TTTThg', '..k.k..']
    : ['....hh.', '.tttthg', 'tttttt.', '.TTTT..', '..k.k..']]], col: { t: 0x8f96a6, h: 0x6a7182 } })],
};

/** A prop's card by name (see PROPS); a pigeon has two frames (card.show(0 | 1)). */
export function propCard(name, { seed = 1 } = {}) {
  const [w, h, make] = PROPS[name];
  const frames = name === 'pigeon' ? 2 : 1;
  const [cv, g] = canvasOf(w * frames, h);
  for (let f = 0; f < frames; f++) {
    const { layers, col, pre } = make(seed, f === 1);
    let px = drawSprite(w, h, layers, col);
    if (pre) {                                                   // foliage on top of the pot, outlined
      const lh = pre.length, leaves = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y < lh ? pre[y][x] : null)));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (leaves[y][x] !== null && (px[y][x] === null || y < lh)) px[y][x] = leaves[y][x];
      for (let y = 0; y < lh + 1; y++) for (let x = 0; x < w; x++) {
        if (leaves[y]?.[x] !== null && leaves[y]?.[x] !== undefined) continue;
        if (px[y][x] !== null && !(y >= lh)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => leaves[y + dy]?.[x + dx] != null) && px[y][x] === null) px[y][x] = 0x173327;
      }
    }
    blit(g, px, f * w, 0);
  }
  const m = card(cv, { ox: Math.floor(w / 2), frames });
  return m;
}
