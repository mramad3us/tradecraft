// TRADECRAFT render: an interior, drawn from its plan (src/sim/interiors/plan.js, set as a map by
// src/sim/map/interior.js), in the same shape as a street section (src/render/town.js buildSection: a
// generator returning { group, fronts, heads, sprites, dispose }), so the view takes it as one.
//
// The cutaway, as a dollhouse is seen from above (DESIGN.md, Look): each room's floor (parquet, a
// bathroom's small white tiles, a kitchen's chequered lino); the back wall (north) standing to the
// ceiling, painted room by room, with its skirting, the windows onto the courtyard and the front door
// from the landing; the side walls to the ceiling too, seen edge on; every other wall cut to a metre,
// its cut dark on top and its face the paint of the room in front of it, so the room behind shows.
// A threshold where a doorway is. Round it all, the dark: nothing else is there.
// The furniture, each piece by its kind (src/art/furniture.js).
import * as THREE from 'three';
import { ground, mat, box, paint, tone, part, PX_PER_M } from '../art/pixelart.js';
import { facade } from '../art/pixeltown.js';
import { WALL_H, CUT_H, OUTER_T, wallRect } from '../sim/interiors/plan.js';
import { furniture } from '../art/furniture.js';
import { CEMENT } from '../sim/interiors/flat.js';

const CUT = 0x3a3f4b, DARK = 0x14151c, OUTSIDE = 0x9a8f80;

// The floors, as repeating textures a metre square: straight parquet in staggered boards, herringbone
// (a basket weave of short boards, as a pixel can lay one), long planks, carpet, lino, chequered lino,
// small white tiles with their grout, terrazzo's chips, patterned cement tiles (a two-colour motif each).
const floors = new Map();
const LINO = [0xc9b99a, 0xa8b0a0, 0xb8a090, 0x9fa8b4];
function floorMat(kind, c = 0xa8784f) {
  const k = `${kind}-${c}`;
  if (floors.has(k)) return floors.get(k);
  const n = PX_PER_M, speck = (px, base, k2, ...cs) => { for (let i = 0; i < k2; i++) { const h = (i * 7919 + 13) >>> 0; px((h * 31) % n, (h * 17 + i) % n, 1, 1, cs[i % cs.length] ?? tone(base, -0.06)); } };
  const t = paint(n, n, (px) => {
    if (kind === 'tiles') { px(0, 0, n, n, 0xb8bdc8); for (let y = 0; y < n; y += 4) for (let x = 0; x < n; x += 4) px(x, y, 3, 3, (x + y) % 8 ? 0xe8ecef : 0xdfe2e8); return; }
    if (kind === 'checker') { for (let y = 0; y < n; y += 8) for (let x = 0; x < n; x += 8) px(x, y, 8, 8, ((x + y) / 8) % 2 ? 0x6a7182 : 0xe2dac6); return; }
    if (kind === 'lino') { const b = LINO[c % LINO.length]; px(0, 0, n, n, b); speck(px, b, 22); return; }
    if (kind === 'carpet') { px(0, 0, n, n, c); speck(px, c, 40, tone(c, -0.05), tone(c, 0.04)); return; }
    if (kind === 'terrazzo') { px(0, 0, n, n, 0xd6ccb8); speck(px, 0xd6ccb8, 46, 0x8f8a80, 0xb48459, 0x6a7182, 0xf4efe6); px(0, n - 1, n, 1, 0xc4bba9); px(n - 1, 0, 1, n, 0xc4bba9); return; }
    if (kind === 'cement') {
      // (8-px tiles, a quatrefoil in each: the motif's colour, the ground's, a grout line)
      const [m, g] = CEMENT[c % CEMENT.length] ?? CEMENT[0];
      for (let y = 0; y < n; y += 8) for (let x = 0; x < n; x += 8) {
        px(x, y, 8, 8, g); px(x + 3, y + 1, 2, 6, m); px(x + 1, y + 3, 6, 2, m); px(x + 3, y + 3, 2, 2, g);
        px(x, y, 1, 1, m); px(x + 7, y, 1, 1, m); px(x, y + 7, 1, 1, m); px(x + 7, y + 7, 1, 1, m); px(x, y + 7, 8, 1, tone(g, -0.08)); px(x + 7, y, 1, 8, tone(g, -0.08));
      }
      return;
    }
    if (kind === 'herringbone') {
      // (boards in pairs, turned each square: across, then along)
      for (let y = 0; y < n; y += 4) for (let x = 0; x < n; x += 4) {
        const across = ((x + y) / 4) % 2 === 0, sh = (((x * 3 + y * 5) % 7) - 3) * 0.015;
        if (across) { px(x, y, 4, 2, tone(c, sh)); px(x, y + 2, 4, 2, tone(c, sh - 0.04)); px(x, y + 1, 4, 1, tone(c, sh - 0.02)); px(x, y + 3, 4, 1, tone(c, -0.13)); }
        else { px(x, y, 2, 4, tone(c, sh + 0.02)); px(x + 2, y, 2, 4, tone(c, sh - 0.03)); px(x + 3, y, 1, 4, tone(c, -0.13)); }
      }
      return;
    }
    const w = kind === 'planks' ? 5 : 4, len = kind === 'planks' ? 16 : 12;
    // parquet and planks: boards w px wide, their ends staggered, a shade apart, a dark seam between
    for (let x = 0; x < n; x += w) {
      const off = (x / w) % 2 ? Math.floor(len / 2) : 0;
      for (let y = -off; y < n; y += len) { px(x, y, w - 1, len - 1, tone(c, ((x * 7 + y * 3) % 5 - 2) * 0.02)); px(x, y + len - 1, w - 1, 1, tone(c, -0.12)); }
      px(x + w - 1, 0, 1, n, tone(c, -0.14));
    }
  }, { repeat: true });
  const m = mat(0, t);
  floors.set(k, m);
  return m;
}

// A wall's face, by the room's finish ({ kind: 'paint' | 'stripes' | 'damask' | 'flowers', c1, c2 }), into a
// painter's px (pixels, y down) over x0 … x0 + w, rows y0 … y0 + h: the paint or the paper, a skirting at its foot.
function finish(px, x0, y0, w, h, f = { kind: 'paint', c1: 0xe2dac6, c2: 0xc4bba9 }) {
  const { c1, c2 = tone(c1, -0.12) } = f;
  px(x0, y0, w, h, c1);
  if (f.kind === 'stripes') for (let x = x0 + 2; x < x0 + w; x += 6) px(x, y0, 2, h, c2);
  if (f.kind === 'damask') for (let y = y0 + 2, k = 0; y < y0 + h - 3; y += 6, k++) for (let x = x0 + (k % 2 ? 3 : 0) + 1; x < x0 + w - 2; x += 6) { px(x + 1, y, 1, 3, c2); px(x, y + 1, 3, 1, c2); }
  if (f.kind === 'flowers') for (let y = y0 + 2, k = 0; y < y0 + h - 3; y += 5, k++) for (let x = x0 + (k % 2 ? 2 : 0) + 1; x < x0 + w - 1; x += 5) { px(x, y, 1, 1, c2); px(x + 1, y + 1, 1, 1, tone(c2, 0.1)); }
  px(x0, y0 + h - 2, w, 2, tone(c1, -0.25)); px(x0, y0 + h - 3, w, 1, tone(c1, -0.12));
}

// A cut wall's face: the room's paint or paper over a skirting board, CUT_H high, painted to its length.
function cutFace(len, f) {
  const W = Math.max(1, Math.round(len * PX_PER_M)), H = Math.round(CUT_H * PX_PER_M);
  return mat(0, paint(W, H, (px) => { finish(px, 0, 0, W, H, f); px(0, 0, W, 1, tone(f.c1, -0.08)); }));
}

// What hangs on the back wall (the plan's decor), in a painter's px: a picture (a landscape or a still
// life in its frame), a mirror, a clock, a calendar, a carpet (Moscow hangs them over the bed).
function hang(px, d, x, y, w, h) {
  const s = d.look?.seed ?? 1, fr = d.look?.frame ?? 0x6b4636;
  if (d.kind === 'carpet') {
    const field = [0x9e3c36, 0x6e2a2e, 0x283f6b][s % 3], border = tone(field, -0.15);
    px(x, y, w, h, border); px(x + 2, y + 2, w - 4, h - 4, field);
    for (let j = y + 4; j < y + h - 5; j += 5) for (let i = x + 4 + ((j / 5) % 2 ? 2 : 0); i < x + w - 5; i += 5) { px(i + 1, j, 1, 3, 0xe2c08a); px(i, j + 1, 3, 1, 0xe2c08a); px(i + 1, j + 1, 1, 1, 0x3b6296); }
    for (let i = x; i < x + w; i += 2) { px(i, y + h, 1, 1, 0xe2dac6); }   // (the fringe)
    return;
  }
  if (d.kind === 'clock') { px(x, y, w, h, 0x23252f); px(x + 1, y + 1, w - 2, h - 2, 0xf4efe6); const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2); px(cx, y + 2, 1, cy - y - 1, 0x23252f); px(cx, cy, Math.max(1, Math.floor(w / 3)), 1, 0x23252f); return; }
  if (d.kind === 'calendar') { px(x, y, w, h, 0xf4efe6); px(x, y, w, 2, 0x9e3c36); for (let j = y + 3; j < y + h - 1; j += 2) for (let i = x + 1; i < x + w - 1; i += 2) px(i, j, 1, 1, 0x8f96a6); return; }
  px(x, y, w, h, fr); px(x, y + h - 1, w, 1, tone(fr, -0.2));
  if (d.kind === 'mirror') { px(x + 1, y + 1, w - 2, h - 2, 0xb8c4cc); for (let k = 0; k < Math.min(w, h) - 3; k++) px(x + 2 + k, y + h - 3 - k, 1, 1, 0xdfe6ec); return; }
  // a picture: sky, hills, a field; or a still life on a dark ground
  const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 2;
  if (s % 3 === 2) { px(ix, iy, iw, ih, 0x353947); px(ix + Math.floor(iw / 3), iy + Math.floor(ih / 2), Math.max(1, Math.floor(iw / 3)), Math.max(1, Math.floor(ih / 3)), [0xb9862e, 0x9e3c36, 0xe2dac6][s % 3]); return; }
  px(ix, iy, iw, ih, [0xb8c8d8, 0xd8c8a8, 0xc8d0d8][s % 3]);
  px(ix, iy + Math.floor(ih * 0.55), iw, ih - Math.floor(ih * 0.55), [0x556b3c, 0x8f7a4a, 0x6a7a5a][s % 3]);
  px(ix, iy + Math.floor(ih * 0.8), iw, ih - Math.floor(ih * 0.8), tone([0x556b3c, 0x8f7a4a, 0x6a7a5a][s % 3], -0.1));
  if (s % 2) px(ix + Math.floor(iw * 0.7), iy + 1, 1, 1, 0xf8e08a);
}

export function* buildInterior(S) {
  const g = new THREE.Group(), plan = S.plan;
  const sprites = [], fronts = [], heads = [];
  // The dark round it; the floors, room by room.
  g.add(ground(-10, plan.z0 - 12, S.x1 + 10, plan.z1 + 14, mat(DARK), -0.02));
  for (const r of plan.rooms) g.add(ground(r.x0, r.z0, r.x1, r.z1, floorMat(r.floor, r.floorColor ?? plan.look?.floor)));
  yield;
  // The back wall: one face, painted room by room, with the windows and the front door.
  const bx0 = plan.x0 - OUTER_T, bx1 = plan.x1 + OUTER_T, roomsN = plan.rooms.filter(r => Math.abs(r.z0 - plan.z0) < 0.01);
  const back = facade({ w: bx1 - bx0, h: WALL_H, wall: 'plaster', wallColor: 0xe2dac6, seed: S.seed % 1000, draw: (f) => {
    f.rect(0, 0, bx1 - bx0, WALL_H, CUT);
    // (each room's paint or paper, its skirting and cornice; then what hangs on it)
    const P = (x, y, w, h, c) => f.rect(x / PX_PER_M, WALL_H - (y + h) / PX_PER_M, w / PX_PER_M, h / PX_PER_M, c);   // (pixels, y down from the top)
    const HP = Math.round(WALL_H * PX_PER_M);
    for (const r of roomsN) {
      finish(P, Math.round((r.x0 - bx0) * PX_PER_M), 0, Math.round((r.x1 - r.x0) * PX_PER_M), HP, r.wall ?? { kind: 'paint', c1: r.paint });
      f.rect(r.x0 - bx0, WALL_H - 0.1, r.x1 - r.x0, 0.1, tone(r.paint, 0.06));   // (the cornice)
    }
    for (const d of plan.decor ?? []) hang(P, d, Math.round((d.x - d.w / 2 - bx0) * PX_PER_M), Math.round((WALL_H - d.y - d.h) * PX_PER_M), Math.max(3, Math.round(d.w * PX_PER_M)), Math.max(3, Math.round(d.h * PX_PER_M)));
    for (const w of plan.windows.filter(o => o.axis === 'x' && Math.abs(o.at - plan.z0) < 0.01)) f.window(w.a - bx0, 1.0, w.b - w.a, 1.35, { frame: 0xf6f4ee, lintel: null, curtain: 0x9e8a6a });
    for (const o of plan.openings.filter(o => o.kind === 'front')) f.door(o.a - bx0, o.b - o.a, 2.1, { color: 0x6b4636, frame: 0xf6f4ee, glass: false, style: 'panel' });
  } });
  const backBox = box(bx1 - bx0, WALL_H, OUTER_T, { front: mat(0, back), sides: mat(CUT), top: mat(CUT) });
  backBox.position.set((bx0 + bx1) / 2, 0, plan.z0 - OUTER_T / 2);
  g.add(part(backBox));
  // The other walls: the sides to the ceiling (edge on), the rest cut, their faces the paint of the room in front.
  for (const w of S.walls.filter(w => w.side !== 'n')) {
    const q = wallRect(w), len = w.axis === 'x' ? q.x1 - q.x0 : q.z1 - q.z0;
    const front = w.axis === 'x' ? plan.rooms.find(r => Math.abs(r.z0 - w.at) < 0.01 && r.x0 < w.b && r.x1 > w.a) : null;
    const face = w.side === 's' ? mat(OUTSIDE) : front ? cutFace(q.x1 - q.x0, front.wall ?? { kind: 'paint', c1: front.paint }) : mat(tone(CUT, 0.1));
    const b = w.axis === 'x' ? box(len, w.h, q.z1 - q.z0, { front: face, sides: mat(tone(CUT, 0.06)), top: mat(CUT) })
      : box(q.x1 - q.x0, w.h, len, { front: mat(tone(CUT, 0.1)), sides: mat(tone(CUT, 0.06)), top: mat(CUT) });
    b.position.set((q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2);
    g.add(part(b));
  }
  // The street side's windows: glass along the top of its cut wall, a sill in front.
  for (const w of plan.windowsS ?? []) {
    const glass = box(w.b - w.a, 0.06, OUTER_T * 0.6, { sides: mat(0xb8c4cc), top: mat(0xc8d4dc) });
    glass.position.set((w.a + w.b) / 2, CUT_H, plan.z1 + OUTER_T / 2);
    g.add(part(glass));
    g.add(ground(w.a, plan.z1 - 0.12, w.b, plan.z1, mat(0xe2dac6), 0.012));
  }
  // A threshold in each doorway.
  for (const o of plan.openings.filter(o => o.kind !== 'front')) {
    g.add(o.axis === 'x' ? ground(o.a, o.at - 0.08, o.b, o.at + 0.08, mat(0x8f6345), 0.01) : ground(o.at - 0.08, o.a, o.at + 0.08, o.b, mat(0x8f6345), 0.01));
  }
  yield;
  // The furniture.
  for (const it of plan.items) { g.add(furniture({ ...it, seed: (S.seed + Math.round(it.x * 10) + Math.round(it.z * 10)) % 100000 })); }
  yield;
  const dispose = () => g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
  return { group: g, fronts, heads, sprites, dispose };
}

