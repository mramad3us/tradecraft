// TRADECRAFT art: the town's sprites, for the pixel-art look: trees and street props, drawn as
// pixel art and stood in the 3D street as upright cards (sprites.js card()), like the people.
//
// A tree is generated, a species in a month (trees, below): a trunk with bark, branches grown to
// fill its crown, and a crown of overlapping leaf clumps from the back (top) to the front (bottom),
// each shaded round from the upper left (light, base, shade, dark), broken by a leafy noise so the
// bands become clusters of leaves, with a few bright tips and a dark outline; bare, a haze of fine
// twigs instead. Its card casts the sun's shadow: the silhouette, flattened onto the ground behind it.
//
// The props are templates shaded by sprites.js (drawSprite): a potted shrub, post boxes (Russian
// Post's blue, the Soviet one, an old red one, one on a pillar), a café chalkboard, a bistro table
// and chair, a bicycle, a pigeon (two frames: standing, pecking); and dry reeds, drawn.
import * as THREE from 'three';
import { rng, tone } from './pixelart.js';
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

// ---------- trees: species and season ----------
//
// A tree is a species (SPECIES: its card's size, its crown's shape, its bark, how its branches grow)
// in a month (leafState(): how much of its crown is in leaf, and in what colours). Moscow's: the
// boulevards' limes, Norway maples, balsam poplars, birches, oaks, and in the parks spruces. In
// November (the game's month) the broadleaves are bare but for what clings on (a birch's last yellow
// leaves, a poplar's few, an oak's brown ones, which it keeps into the winter); the spruces are green.
// A bare crown is drawn as a pixel artist draws one: a trunk forking into limbs and branches (lit on
// their left), inside a haze of fine twigs, denser toward the rim, lighter on the side to the sun.
const AUTUMN = {
  yellow: [0x47302a, 0x7a5a22, 0xb9862e, 0xd6ad7a, 0xe7c060, 0xf8e08a],
  orange: [0x3f1a22, 0x6e2a2e, 0x9e3c36, 0xc95c45, 0xe8896a, 0xe7c060],
  brown: [0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb48459, 0xd6ad7a],
  lime: [0x173327, 0x356f42, 0x7a5a22, 0xb9862e, 0xa6cc5e, 0xe7c060],
  spruce: [0x14151c, 0x173327, 0x24503a, 0x2f6b62, 0x356f42, 0x4f8f45],
};
export const SPECIES = {
  lime: { w: 72, h: 88, rx: 0.62, ry: 0.58, fork: 0.62, trunk: [BARK[2], BARK[1], BARK[3]], attract: 150, jitter: 0.35, haze: 0.85, twigs: [0x47302a, 0x5e4238, 0x7a5c4c], fall: 'yellow', clings: 0 },
  maple: { w: 78, h: 86, rx: 0.68, ry: 0.5, fork: 0.55, trunk: [0x6a6560, 0x47403c, 0x8a827a], attract: 130, jitter: 0.45, haze: 0.8, twigs: [0x47403c, 0x625650, 0x8a7e74], fall: 'orange', clings: 0.06 },
  birch: { w: 60, h: 92, rx: 0.44, ry: 0.7, fork: 0.5, trunk: [0xe2dac6, 0xa0978a, 0xf4efe6], attract: 110, jitter: 0.3, haze: 0.85, droop: 0.55, twigs: [0x3f1a22, 0x6e4a52, 0x8f6a70], fall: 'yellow', clings: 0.14 },
  poplar: { w: 62, h: 108, rx: 0.42, ry: 0.68, fork: 0.72, trunk: [0x7d756c, 0x5c5650, 0xa0978a], attract: 140, jitter: 0.25, haze: 0.8, twigs: [0x4c4844, 0x6a645e, 0x8f8880], fall: 'lime', clings: 0.2 },
  oak: { w: 84, h: 88, rx: 0.7, ry: 0.5, fork: 0.5, trunk: [BARK[1], BARK[0], BARK[2]], attract: 100, jitter: 0.9, haze: 0.75, twigs: [0x2a1c18, 0x47302a, 0x6b4636], fall: 'brown', clings: 0.42 },
  spruce: { w: 56, h: 92, evergreen: true },
};

/** How a species is in leaf in a month (1–12): { amount 0 … 1, palette dark → light }. */
export function leafState(species, month = 11) {
  const s = SPECIES[species] ?? SPECIES.lime;
  if (s.evergreen) return { amount: 1, palette: AUTUMN.spruce };
  if (month >= 5 && month <= 8) return { amount: 1, palette: LEAF };
  if (month === 9) return { amount: 1, palette: species === 'oak' || species === 'poplar' ? LEAF : AUTUMN.lime };
  if (month === 10) return { amount: { lime: 0.35, maple: 0.6, birch: 0.5, poplar: 0.75, oak: 0.85 }[species] ?? 0.5, palette: AUTUMN[s.fall] };
  if (month === 11) return { amount: s.clings, palette: AUTUMN[s.fall] };
  if (month === 4) return { amount: 0, palette: LEAF };
  return { amount: species === 'oak' ? 0.25 : 0, palette: AUTUMN[s.fall] };
}

/** A tree: a card a few metres wide and tall, its trunk over its origin: a species in a month (see above). */
export function treeCard({ seed = 3, size = 1, species = 'lime', month = 5 } = {}) {
  const S = SPECIES[species] ?? SPECIES.lime;
  const { amount, palette } = leafState(species, month);
  const px = species === 'spruce' ? spruce(S, seed, size) : broadleaf(S, species, seed, size, amount, palette);
  const w = px[0].length, h = px.length;
  const [cv, g] = canvasOf(w, h);
  blit(g, px);
  const m = card(cv, { ox: Math.floor(w / 2) });
  m.castShadow = true;                                           // the silhouette, flattened on the ground
  return m;
}

// A broadleaf: its trunk, and branches grown by space colonisation (points scattered through the
// crown's shape draw the nearest branch tip toward them, a step at a time, until each is reached), so
// they fill the crown as a tree's do; each branch as thick as what it carries. At their ends a haze
// of fine twigs (an ordered stipple, lit on the side to the sun), drawn behind them; what leaves the
// tree has, over them; outlined.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function broadleaf(S, species, seed, size, amount, palette) {
  const { w, h } = S, cx = Math.floor(w / 2), r = rng(seed * 7 + species.length);
  const R = (w * 0.4) * size, rx = R * S.rx / 0.62, ry = R * S.ry / 0.62 * (species === 'poplar' ? 1.3 : 1);
  const cy = Math.round(h * 0.4 + (1 - size) * 14);
  const grid = () => Array.from({ length: h }, () => Array(w).fill(null));
  const bark = grid(), haze = grid(), leafL = grid(), dry = grid();
  const put = (buf, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) buf[y][x] = c; };
  const edge = noise(seed + 1, 3);
  const inCrown = (x, y, m = 0) => ((x - cx) / (rx + m)) ** 2 + ((y - cy) / (ry + m)) ** 2 <= 1 + (edge(x, y) - 0.5) * 0.4;
  const [tc, td, tl] = S.trunk, [k0, k1, k2] = S.twigs;
  const fork = Math.round(cy + ry * S.fork);
  // The trunk to the fork: lit on its left, flared at its foot (a birch's white, its black marks).
  for (let y = fork; y < h - 1; y++) {
    const half = y > h - 4 ? 3 : 2;
    for (let x = cx - half; x <= cx + half; x++) {
      const k = x - (cx - half);
      let c = k === 0 ? tl : k >= 2 * half ? td : tc;
      if (species === 'birch' && ((y * 5 + x * 3) % 11 === 0 || (y % 7 === 3 && k > 0 && k < 2 * half))) c = 0x23252f;
      else if ((x === cx + 1 && (y * 7) % 5 < 2) || (x === cx - 1 && (y * 3) % 7 === 0)) c = td;
      put(bark, x, y, c);
    }
  }
  // The branches: attractors through the crown above the fork; nodes grown toward them.
  const A = [];
  for (let t = 0; A.length < S.attract && t < S.attract * 20; t++) {
    const x = cx + (r() * 2 - 1) * rx, y = cy + (r() * 2 - 1) * ry;
    if (inCrown(x, y, -1) && y < fork - 2) A.push([x, y]);
  }
  const N = [{ x: cx, y: fork, p: -1, kids: 0, tip: true }], step = 2.2, kill = 2.8;
  for (let it = 0; it < 80 && A.length; it++) {
    const pull = new Map();
    for (let ai = A.length - 1; ai >= 0; ai--) {
      const [ax, ay] = A[ai];
      let best = 0, bd = Infinity;
      for (let k = 0; k < N.length; k++) { const d = (N[k].x - ax) ** 2 + (N[k].y - ay) ** 2; if (d < bd) { bd = d; best = k; } }
      bd = Math.sqrt(bd);
      if (bd < kill) { A.splice(ai, 1); continue; }
      const v = pull.get(best) ?? [0, 0];
      v[0] += (ax - N[best].x) / bd; v[1] += (ay - N[best].y) / bd;
      pull.set(best, v);
    }
    let grew = false;
    for (const [k, [vx, vy]] of pull) {
      const l = Math.hypot(vx, vy);
      if (l < 0.3) continue;                                     // pulled every way at once: it stays
      let dx = vx / l + (r() - 0.5) * S.jitter, dy = vy / l + (r() - 0.5) * S.jitter + (S.droop && N[k].y < cy ? 0 : S.droop ?? 0);
      const ll = Math.hypot(dx, dy) || 1;
      N.push({ x: N[k].x + dx / ll * step, y: N[k].y + dy / ll * step, p: k, kids: 0, tip: true });
      N[k].tip = false; grew = true;
    }
    if (!grew) break;
  }
  for (let k = N.length - 1; k > 0; k--) N[N[k].p].kids += N[k].kids + 1;
  // Each branch from its parent, as thick as what it carries; thick ones in the trunk's colours.
  const width = (n) => Math.min(4, 1 + Math.floor(Math.sqrt(n.kids) / 2.6));
  for (let k = 1; k < N.length; k++) {
    const n = N[k], p = N[n.p], wd = width(n), thick = wd >= 3 || (species === 'birch' && wd >= 2);
    const [c, d, l] = thick ? [tc, td, tl] : wd === 2 ? [tone(k1, -0.02), k0, k2] : [k1, k0, k1];
    const steps = Math.ceil(Math.hypot(n.x - p.x, n.y - p.y) * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = p.x + (n.x - p.x) * t, y = p.y + (n.y - p.y) * t;
      for (let q = 0; q < wd; q++) put(bark, x - Math.floor(wd / 2) + q, y, wd > 1 && q === 0 ? l : wd > 2 && q === wd - 1 ? d : c);
    }
  }
  // The twig haze: the crown's mass of fine twigs, as a pixel artist stipples it: thin inside, thick
  // toward the rim (where the twigs are), thicker still round the branches' ends; an ordered dither of
  // that density, lit on the side to the sun, its edge broken.
  if (amount < 0.9) {
    const dens = new Float32Array(w * h), lumpy = noise(seed + 4, 5);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.sqrt(((x - cx) / (rx + 2)) ** 2 + ((y - cy) / (ry + 2)) ** 2) + (edge(x, y) - 0.5) * 0.3;
      if (e > 1 || y > fork + 1) continue;
      dens[y * w + x] = 0.22 + 0.5 * Math.min(1, Math.max(0, (e - 0.25) / 0.6)) - (e > 0.88 ? (e - 0.88) * 3 : 0) + (lumpy(x, y) - 0.5) * 0.3;
    }
    for (const n of N) {
      if (n.kids > 6) continue;
      const rr = n.tip ? 4 : 3;
      for (let y = Math.max(0, Math.floor(n.y - rr)); y <= Math.min(h - 1, n.y + rr); y++) for (let x = Math.max(0, Math.floor(n.x - rr)); x <= Math.min(w - 1, n.x + rr); x++) {
        const q2 = ((x - n.x) ** 2 + ((y - n.y) * 1.1) ** 2) / (rr * rr);
        if (q2 < 1) dens[y * w + x] += 0.35 * (1 - q2);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.min(1, dens[y * w + x]);
      if (d <= 0) continue;
      const hsh = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
      if (BAYER[(x & 3) + 4 * (y & 3)] / 16 * 0.8 + (hsh % 1000) / 1000 * 0.2 > d * S.haze) continue;
      const lit = (-(x - cx) * 0.6 - (y - cy) * 0.8) / Math.max(rx, ry) + (hsh % 7 - 3) * 0.04;
      put(haze, x, y, lit > 0.32 ? k2 : lit < -0.28 ? k0 : k1);
    }
  }
  // Leaves, the season's: a full crown of clumps; clumps at some of the branches' ends, as many as cling
  // on; or, when only a few are left, single leaves hanging at the tips.
  if (amount >= 0.9) {
    const clumps = [[cx, cy, Math.min(rx, ry) * 0.75]];
    for (let k = 0; k < 11; k++) { const a = (k / 9) * Math.PI * 2 + r() * 0.4; clumps.push([cx + Math.cos(a) * rx * 0.6, cy + Math.sin(a) * ry * 0.55, Math.min(rx, ry) * (0.42 + r() * 0.14)]); }
    for (let k = 0; k < 6; k++) clumps.push([cx + (r() - 0.5) * rx * 1.4, cy + (r() - 0.3) * ry, Math.min(rx, ry) * (0.32 + r() * 0.1)]);
    const leaves = foliage(w, h, clumps, seed, palette);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (leaves[y][x] !== null) leafL[y][x] = leaves[y][x];
  } else if (amount > 0.25) {                                  // bunches of dry leaves at the branches' ends, lit on the left
    for (const n of N) if (n.kids <= 4 && r() < amount * 1.2) for (let j = 0; j < 9; j++) {
      const ox = (r() - 0.5) * 5, oy = (r() - 0.5) * 4, l = -ox * 0.25 - oy * 0.3 + (-(n.x - cx) * 0.6 - (n.y - cy) * 0.8) / Math.max(rx, ry) * 0.8 + (r() - 0.5) * 0.6;
      put(dry, n.x + ox, n.y + oy, palette[l > 0.6 ? 5 : l > 0.15 ? 4 : l > -0.3 ? 3 : 2]);
    }
  } else if (amount > 0) {
    for (const n of N) if (n.tip && r() < amount * 2.2) {
      const x = Math.round(n.x + (r() - 0.5) * 3), y = Math.round(n.y + r() * 2), c = palette[3 + Math.floor(r() * 3)];
      put(haze, x, y, c); if (r() < 0.6) put(haze, x + 1, y, tone(c, -0.08)); if (r() < 0.3) put(haze, x, y + 1, palette[2]);
    }
  }
  // Composed back to front, then outlined: dark round the leaves and the limbs; the twigs keep a soft edge.
  const px = grid(), solid = grid();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    px[y][x] = leafL[y][x] ?? dry[y][x] ?? bark[y][x] ?? haze[y][x];
    solid[y][x] = leafL[y][x] !== null ? 3 : bark[y][x] !== null ? 1 : 0;
  }
  const out = px.map(row => row.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[y][x] !== null) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => solid[y + dy]?.[x + dx] ?? 0);
    if (n.includes(3)) out[y][x] = palette === LEAF ? 0x173327 : tone(palette[0], -0.06);
    else if (n.includes(1) && y > fork - 6) out[y][x] = 0x2a1c18;
  }
  return out;
}

// A spruce: a cone of drooping tiers, a little uneven, needles lit along the left and at each tier's
// top; Norway's dark green, or now and then a blue spruce.
function spruce(S, seed, size) {
  const { w, h } = S, cx = Math.floor(w / 2), r = rng(seed * 5 + 3), needle = noise(seed + 11, 1.6), lump = noise(seed + 12, 4);
  const P = seed % 3 === 0 ? [0x14151c, 0x1f3a3c, 0x2f5a58, 0x4a7a74, 0x6f9a92, 0x9ab8ae] : [0x14151c, 0x173327, 0x24503a, 0x2f5a3a, 0x356f42, 0x4f8f45];
  const px = Array.from({ length: h }, () => Array(w).fill(null));
  const ty = Math.round(4 + (1 - size) * 14), by = h - 7, R = (w / 2 - 4) * (0.85 + size * 0.15);
  const tiers = 7 + Math.floor(r() * 3), p = (by - ty) / tiers, skew = Array.from({ length: tiers + 2 }, () => [0.82 + r() * 0.36, 0.82 + r() * 0.36]);
  for (let y = ty; y <= by + 3; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, t = Math.min(1, (y - ty) / (by - ty)), cone = R * (0.08 + t * 0.92);
    // A tier's branches hang: its lower edge drops toward its ends.
    const sag = (Math.abs(dx) / Math.max(1, cone)) ** 2 * p * 0.55, yy = y - ty - sag;
    if (yy < 0) continue;
    const k = Math.min(tiers, Math.floor(yy / p)), ph = (yy % p) / p;
    const hw = cone * (0.55 + 0.45 * ph) * skew[k][dx < 0 ? 0 : 1];
    const e = Math.abs(dx) - hw + (needle(x, y) - 0.5) * (1.6 + ph * 2.6) + (lump(x, y) - 0.5) * 2.2;
    if (e > 0 || y > by + (Math.abs(dx) > 3 ? 2 : 0)) continue;
    if (ph > 0.7 && Math.abs(dx) > hw * 0.7 && (x + y) % 2) continue;   // ragged ends hanging down
    const out = Math.abs(dx) / Math.max(1, hw);
    let l = -dx / Math.max(1, hw) * 0.6 + (0.45 - ph) * 0.9 + (needle(x * 1.7, y) - 0.5) * 0.8;
    if (ph > 0.8) l -= 0.55 * (1 - out);                         // the shade under the tier above, deepest by the trunk
    px[y][x] = P[l > 0.8 ? 5 : l > 0.3 ? 4 : l > -0.15 ? 3 : l > -0.6 ? 2 : 1];
  }
  for (let y = by - 2; y < h - 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (px[y][x] === null || y > by + 1) px[y][x] = x === cx - 1 ? BARK[2] : BARK[1];
  px[ty - 1][cx] = P[4];
  const out = px.map(row => row.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[y][x] !== null) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => px[y + dy]?.[x + dx] != null)) out[y][x] = 0x14151c;
  }
  return out;
}

// ---------- props from templates ----------

const PROPS = {
  shrub: [16, 22, (seed) => {
    const leaves = foliage(16, 13, [[8, 6, 6], [4, 8, 4], [12, 8, 4], [8, 9, 5]], seed);
    return { pre: leaves, layers: [[3, 13, ['uuuuuuuuuu', 'UUUUUUUUUU', '.uuuuuuuu.', '.uuuuuuuu.', '.uuuuuuuu.', '..uuuuuu..', '..UUUUUU..', '..kkkkkk..']]], col: { u: 0xc95c45 } };
  }],
  // Post boxes: Russian Post's blue box on the wall (white band, the horn), the Soviet one (ПОЧТА, the
  // emblem), an old red one, a blue box on a pillar.
  postbox: [11, 20, () => ({ layers: [[1, 1, [
    '...ttt...', '.ttttttt.', 'ttttttttt', 'TTTTTTTTT', 'ttttttttt', 'ttkkkkktt', 'ttttttttt', 'ttttttttt', 'ttgggggtt',
    'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'TTTTTTTTT', 'kkkkkkkkk']]], col: { t: 0x9e3c36 } })],
  'postbox-blue': [12, 20, () => ({ layers: [[1, 3, [
    'tttttttttt', 'TTTTTTTTTT', 'tkkkkkkkkt', 'tttttttttt', 'wwwwwwwwww', 'wwwyyywwww', 'wwyywyywww', 'wwwwwwwwww', 'tttttttttt',
    'tttttttttt', 'tttttttttt', 'tttttttttt', 'TTTTTTTTTT', '.kk....kk.']]], col: { t: 0x3b6296, w: 0xdfe2e8, y: 0x283f6b } })],
  'postbox-soviet': [12, 21, () => ({ layers: [[1, 2, [
    '.tttttttt.', 'tttttttttt', 'TTTTTTTTTT', 'tkkkkkkkkt', 'tttttttttt', 'ttwwwwwwtt', 'ttwyywywtt', 'ttwwwwwwtt', 'tttttttttt',
    'ttttggtttt', 'tttggggttt', 'ttttggtttt', 'tttttttttt', 'tttttttttt', 'TTTTTTTTTT', '.kk....kk.']]], col: { t: 0x283f6b, w: 0xdfe2e8, y: 0x23252f } })],
  'postbox-pillar': [12, 26, () => ({ layers: [[3, 15, ['kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkk', 'kkkkkk'.slice(0, 4)]],
    [1, 2, ['..tttttt..', '.tttttttt.', 'tttttttttt', 'TTTTTTTTTT', 'tkkkkkkkkt', 'tttttttttt', 'wwwwwwwwww', 'wwyyywwwww', 'wwwwwwwwww', 'tttttttttt', 'tttttttttt', 'TTTTTTTTTT', '.tttttttt.']],
    [2, 24, ['kkkkkkkk']]], col: { t: 0x3b6296, w: 0xdfe2e8, y: 0x283f6b } })],
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

/** Dry reeds by a pond's bank: a clump of stalks, a few bulrush heads. Rows of colours, 12 × 22. */
function reeds(seed) {
  const w = 12, h = 22, r = rng(seed * 3 + 1), px = Array.from({ length: h }, () => Array(w).fill(null));
  for (let k = 0; k < 9; k++) {
    let x = 2 + r() * 8, lean = (r() - 0.5) * 0.25;
    const top = 3 + Math.floor(r() * 8), c = [0xb48459, 0x8f6345, 0xd6ad7a][Math.floor(r() * 3)];
    for (let y = h - 1; y >= top; y--) { const xx = Math.round(x); if (xx >= 0 && xx < w) px[y][xx] = y > h - 4 ? 0x6b4636 : c; x += lean; }
    if (r() < 0.4) { const xx = Math.round(x); for (let y = top; y < top + 3; y++) if (xx >= 0 && xx < w) { px[y][xx] = 0x47302a; if (xx + 1 < w) px[y][xx + 1] = 0x6b4636; } }
  }
  const out = px.map(row => row.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y][x] === null && [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => px[y + dy]?.[x + dx] != null)) out[y][x] = 0x2a1c18;
  return out;
}

/** A prop's card by name (see PROPS; 'reeds'); a pigeon has two frames (card.show(0 | 1)). */
export function propCard(name, { seed = 1 } = {}) {
  if (name === 'reeds') { const px = reeds(seed), [cv, g] = canvasOf(px[0].length, px.length); blit(g, px); return card(cv, { ox: 6 }); }
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
