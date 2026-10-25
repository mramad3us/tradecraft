// TRADECRAFT samples: a town for the pixel-art look (samples/lib/pixelart.js).
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
import * as THREE from 'three';
import { PX_PER_M, GLOWS, mat, glow, paint, tile, box, roundedBox, ground, part, pool, rng, text, textWidth } from './pixelart.js';

const M = PX_PER_M;
const INK = 0x14151c;

// ---------- painting helpers (y measured up from a surface's bottom, in metres) ----------

/** Painting tools for a surface w × h metres: rect, window, door, shopfront, sign, cornice, bricks, plaster. */
function painter(px, wM, hM, seed = 1, night = false) {
  const W = Math.round(wM * M), H = Math.round(hM * M);
  const r = rng(seed);
  const X = (x) => Math.round(x * M), Y = (y) => H - Math.round(y * M);   // metres → pixels, y up
  const f = {
    W, H, r,
    /** A rectangle in metres from the bottom left. */
    rect: (x, y, w, h, c) => px(X(x), Y(y + h), Math.round(w * M), Math.round(h * M), c),
    bricks(x, y, w, h, base = 0x9e3c36) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      px(x0, y0, ww, hh, 0x7d756c);                              // mortar
      for (let j = 0; j < hh; j += 4) for (let i = ((j / 4) % 2) * 4 - 4; i < ww; i += 8) {
        const a = Math.max(0, i), b = Math.min(ww, i + 7);
        if (b > a) px(x0 + a, y0 + j, b - a, Math.min(3, hh - j), r() < 0.15 ? 0xc95c45 : r() < 0.12 ? 0x6e2a2e : base);
      }
    },
    plaster(x, y, w, h, base = 0xe2dac6, dirt = 0xc4bba9) {
      f.rect(x, y, w, h, base);
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      for (let i = 0; i < ww * hh * 0.03; i++) px(x0 + Math.floor(r() * ww), y0 + Math.floor(r() * hh), 1, 1, dirt);
      px(x0, y0 + hh - 2, ww, 2, dirt);                          // grime at the foot
    },
    /** A window: frame, glass with a glint (or lit), mullion and transom, a sill, a lintel, shutters. */
    window(x, y, w, h, { lit = false, frame = 0xdfe2e8, lintel = 0xc4bba9, shutters = null, curtain = null } = {}) {
      const x0 = X(x), y0 = Y(y + h), ww = Math.round(w * M), hh = Math.round(h * M);
      if (night && r() < 0.4) lit = true;                        // at night, some rooms have the light on
      if (lintel) px(x0 - 1, y0 - 2, ww + 2, 2, lintel);
      px(x0, y0, ww, hh, frame);
      const g = lit ? [0xe7b84a, 0xf8e08a] : [0x283f6b, 0x3b6296];
      px(x0 + 1, y0 + 1, ww - 2, hh - 2, g[0]);
      px(x0 + 1, y0 + 1, ww - 2, Math.floor((hh - 2) / 3), g[1]);
      if (curtain) { px(x0 + 1, y0 + 1, 2, hh - 2, curtain); px(x0 + ww - 3, y0 + 1, 2, hh - 2, curtain); }
      if (!lit) { px(x0 + 2, y0 + 3, 1, 2, 0x95c1e3); px(x0 + 3, y0 + 2, 1, 1, 0x95c1e3); }
      px(x0 + Math.floor(ww / 2), y0, 1, hh, frame);             // mullion
      px(x0, y0 + Math.floor(hh / 3), ww, 1, frame);             // transom
      px(x0 - 1, y0 + hh, ww + 2, 1, 0xf6f4ee);                  // sill, and its shadow
      px(x0 - 1, y0 + hh + 1, ww + 2, 1, 0x5c5650);
      if (shutters) for (const sx of [x0 - 5, x0 + ww + 1]) {
        px(sx, y0, 4, hh, shutters);
        for (let j = 1; j < hh; j += 2) px(sx, y0 + j, 4, 1, INK === shutters ? 0x353947 : 0x24503a);
      }
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
    },
    /** A string course (a band between storeys). */
    band(y, c = 0xc4bba9) { px(0, Y(y) - 1, W, 2, c); px(0, Y(y) + 1, W, 1, 0x5c5650); },
  };
  return f;
}

// ---------- the street ----------

/**
 * The street's ground, painted: x0..x1, from the building line zB back to front: a pavement to zK1,
 * the road to zK2, a pavement to z1. Options: zebra [xa, xb], pits [[x, z]...] for trees.
 */
export function street({ x0, x1, zB, zK1, zK2, z1, zebra = null, pits = [], seed = 7 }) {
  const W = Math.round((x1 - x0) * M), H = Math.round((z1 - zB) * M);
  const X = (x) => Math.round((x - x0) * M), Z = (z) => Math.round((z - zB) * M);
  const tex = paint(W, H, (px) => {
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
    for (let i = 24; i < W; i += 128) { px(i, Z(zK1) + 3, 7, 3, 0x23252f); for (let k = 1; k < 7; k += 2) px(i + k, Z(zK1) + 4, 1, 1, 0x6a7182); }   // drains
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

/**
 * A building: a box x0..x1 wide, h tall, d deep, its front at z (facing the street, +z). draw(f)
 * paints the facade with painter(); the sides are wall, the roof flat (with a parapet) or pitched.
 */
export function building({ x0, x1, z, h, d = 8, wall = 'brick', wallColor, roof = 'flat', roofColor = 0x6a7182, draw, seed = 1, night = false }) {
  const w = x1 - x0;
  const g = new THREE.Group();
  const front = paint(Math.round(w * M), Math.round(h * M), (px) => {
    const f = painter(px, w, h, seed, night);
    if (wall === 'brick') f.bricks(0, 0, w, h, wallColor ?? 0x9e3c36);
    else f.plaster(0, 0, w, h, wallColor ?? 0xe2dac6);
    draw?.(f);
  }, { glows: GLOWS });
  const sideTex = wall === 'brick' ? tile('brick', 1) : tile('plaster', 1);
  const body = box(w, h, d, { front: mat(0, front), sides: mat(0, sideTex), top: mat(roofColor) });
  body.position.set((x0 + x1) / 2, 0, z - d / 2);
  g.add(part(body));
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

export function lamp(x, z, { lit = false } = {}) {
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
  if (lit) g.add(pool(0, 2.7, 0.5, { r: 2.0 }));                // its pool of light
  return g;
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
