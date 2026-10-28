// TRADECRAFT render: the shop you're in, opened up (the user, 2026-10-27: "let's build a lot of
// interiors ... going out the back should be a thing we do when inside"; DESIGN.md, Look: "cutaways so
// interiors read from above"). A dollhouse's cut: the view hides the building as the street draws it
// (src/render/town.js: its body; the awnings and signs over this shop) and puts in its place the same
// building with a slot taken out of it, the shop's width, from the pavement to the roof and back to the
// shop's back wall. Either side, the building stands as it was, its façade the same pixels; down the
// slot, the shop's floor (src/render/interior.js drawPlan(), set into the building: sim/interiors/
// shop.js), and its cut faces hatched as a section drawing's, the floors above it marked by their slabs.
import * as THREE from 'three';
import { box, mat, part, paint, tone } from '../art/pixelart.js';
import { walls, WALL_H } from '../sim/interiors/plan.js';
import { drawPlan } from './interior.js';

export const STOREY_M = WALL_H + 0.3;                               // (a floor's walls and the slab over them: the marks up the cut)
const CUT = 0x3a3f4b, LINE = 0x4a4f5c, SLAB = 0x6a7182;
let hatched = null;
const hatch = () => (hatched ??= mat(0, paint(8, 8, (px) => { px(0, 0, 8, 8, CUT); for (let k = 0; k < 8; k++) px(k, 7 - k, 1, 1, LINE); }, { repeat: true })));

/**
 * Building b of section S with the slot of shop floor u cut out of it (body: the mesh the street drew it
 * with, whose materials (its façade, day's or night's; its sides; its roof) it wears again): a group.
 */
export function buildCut(S, b, u, body) {
  const B = S.buildings[b], g = new THREE.Group(), w = B.x1 - B.x0, h = B.h, zb = B.z - B.d;
  const [side, , roof, , front] = body?.material ?? [];
  drawPlan(g, u, walls(u), { seed: (S.seed + b * 97) % 100000, inset: true, outside: B.wallColor ?? 0xc4bba9 });
  // (a piece of the building, x0..x1 × z0..z1, full height; its face on the street, if it has one, its
  // stretch of the façade's own pixels)
  const piece = (x0, z0, x1, z1, faces) => {
    if (x1 - x0 < 0.02 || z1 - z0 < 0.02) return;
    const street = Math.abs(z1 - B.z) < 0.01 && front;
    const m = box(x1 - x0, h, z1 - z0, { sides: side ?? hatch(), top: roof ?? mat(0x6a7182), front: street ? front : hatch(), ...faces });
    if (street) {
      const uv = m.geometry.attributes.uv, grp = m.geometry.groups[4], u0 = (x0 - B.x0) / w, u1 = (x1 - B.x0) / w;
      const vs = new Set();
      for (let i = grp.start; i < grp.start + grp.count; i++) vs.add(m.geometry.index.getX(i));   // (each corner once: the triangles share two)
      for (const v of vs) uv.setXY(v, uv.getX(v) > 1e-6 ? u1 : u0, uv.getY(v) > 1e-6 ? 1 : 0);
    }
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    g.add(part(m));
  };
  piece(B.x0, zb, u.x0, B.z, { right: hatch() });
  piece(u.x1, zb, B.x1, B.z, { left: hatch() });
  piece(u.x0, zb, u.x1, u.z0, { front: slabs(u.x1 - u.x0, h) });
  return g;
}

// The back of the slot, over the shop's back wall: the cut's hatch, a slab's edge at each floor.
function slabs(wM, hM) {
  const W = Math.max(8, Math.round(wM * 16)), H = Math.max(8, Math.round(hM * 16)), every = Math.round(STOREY_M * 16);
  return mat(0, paint(W, H, (px) => {
    px(0, 0, W, H, CUT);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) for (let k = 0; k < 8; k++) px(x + k, y + 7 - k, 1, 1, LINE);
    for (let y = H - every; y > 0; y -= every) { px(0, y - 4, W, 5, SLAB); px(0, y - 4, W, 1, tone(SLAB, 0.12)); }
  }));
}
