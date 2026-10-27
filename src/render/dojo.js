// TRADECRAFT render: the dojo, a training hall at the Farm, drawn from its data (src/sim/map/dojo.js)
// with the town's painters, in the same shape as a street section (src/render/town.js buildSection:
// a generator returning { group, fronts, heads, sprites, dispose }), so the view takes it as one.
//
// A pale hall with a wood wainscot: high windows along the back wall, the flag, a sign over the main
// mat, a clock; planks underfoot and the mats on them (blue, edged in red, the main one with its
// start marks); benches along the back, heavy bags on stands and a rack at the east end, a water
// cooler by the door. The side walls stand to the ceiling's height; the near wall is cut away to a
// sill, so the view looks in.
import * as THREE from 'three';
import { ground, tile, mat, box, paint, PX_PER_M } from '../art/pixelart.js';
import { building, bench } from '../art/pixeltown.js';
import { DOJO_W, Z_BACK, Z_FRONT, MAT, MAT2, FIGHT } from '../sim/map/dojo.js';

const WALL = 0xe2dac6, WOOD = 0x8f6345, MAT_BLUE = 0x3b6296, MAT_EDGE = 0x9e3c36;

// The mats: blue panels a metre square, seams a shade darker, a red border round the whole.
function matMaterial(w, d) {
  const W = Math.round(w * PX_PER_M), D = Math.round(d * PX_PER_M);
  return mat(0, paint(W, D, (px) => {
    px(0, 0, W, D, MAT_BLUE);
    for (let x = PX_PER_M; x < W; x += PX_PER_M) px(x, 0, 1, D, 0x283f6b);
    for (let y = PX_PER_M; y < D; y += PX_PER_M) px(0, y, W, 1, 0x283f6b);
    px(0, 0, W, 6, MAT_EDGE); px(0, D - 6, W, 6, MAT_EDGE); px(0, 0, 6, D, MAT_EDGE); px(W - 6, 0, 6, D, MAT_EDGE);
    px(0, 6, W, 1, 0x6e2a2e); px(6, 0, 1, D, 0x6e2a2e);
  }));
}

// The back wall: wainscot, high windows, the flag, the sign, a clock, a door at the west end.
function drawWall(f) {
  f.rect(0, 0, DOJO_W, 5.2, WALL);                                 // (fresh paint, not a Moscow street's plaster)
  f.rect(0, 4.9, DOJO_W, 0.3, 0xc4bba9);
  f.rect(0, 0, DOJO_W, 1.2, WOOD);
  f.rect(0, 1.2, DOJO_W, 0.08, 0x6b4636);
  for (let x = 2; x < DOJO_W - 2; x += 4.5) if (Math.abs(x + 0.8 - DOJO_W / 2) > 4) f.window(x, 2.7, 1.6, 1.7, { frame: 0xf6f4ee, lintel: WALL });
  // The flag: thirteen stripes, a blue canton with a speckle of stars.
  const fx = DOJO_W / 2 - 3.9, fy = 2.6, fw = 1.9, fh = 1.0;
  for (let i = 0; i < 13; i++) f.rect(fx, fy + fh - (i + 1) * fh / 13, fw, fh / 13, i % 2 ? 0xf6f4ee : 0x9e3c36);
  f.rect(fx, fy + fh * 6 / 13, fw * 0.4, fh * 7 / 13, 0x1b2541);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) f.rect(fx + 0.08 + i * 0.18, fy + fh * 6 / 13 + 0.07 + j * 0.15, 0.06, 0.06, 0xf6f4ee);
  f.sign(DOJO_W / 2 - 1.6, 3.0, 5.2, 0.6, 'DEFENSIVE TACTICS', { bg: 0x1b2541, fg: 0xf6f4ee, border: 0xb9862e });
  f.rect(DOJO_W / 2 + 4.2, 3.2, 0.5, 0.5, 0xf6f4ee); f.rect(DOJO_W / 2 + 4.43, 3.42, 0.04, 0.22, 0x14151c); f.rect(DOJO_W / 2 + 4.43, 3.42, 0.18, 0.04, 0x14151c);
}

export function* buildDojo(S) {
  const g = new THREE.Group();
  const sprites = [], fronts = [], heads = [];
  // The floor, the mats.
  g.add(ground(0, Z_BACK, DOJO_W, Z_FRONT + 0.4, mat(0, tile('planks', 1))));
  for (const M of [MAT, MAT2]) g.add(ground(M.x0, M.z0, M.x1, M.z1, matMaterial(M.x1 - M.x0, M.z1 - M.z0), 0.02));
  // (the start marks: a white tape and a red, where the two in a bout face each other)
  for (const [dx, c] of [[-1.3, 0xf6f4ee], [1.3, 0xc44a3c]]) g.add(ground(FIGHT.x + dx - 0.05, FIGHT.z - 0.4, FIGHT.x + dx + 0.05, FIGHT.z + 0.4, mat(c), 0.025));
  yield;
  // The walls: the back (a building, its front painted), the sides, the sill.
  const back = building({ x0: 0, x1: DOJO_W, z: Z_BACK, h: 5.2, d: 4, wall: 'plaster', wallColor: WALL, draw: drawWall, seed: S.seed % 1000 });
  g.add(back);
  fronts.push({ body: back.userData.body, day: back.userData.body.material[4], night: null, spec: null, dusk: 2, paintNight() { this.night = this.day; } });
  for (const x of [-1, DOJO_W + 1]) { const w = box(2, 5.2, Z_FRONT - Z_BACK, { sides: mat(WALL), top: mat(0xc4bba9) }); w.position.set(x, 0, (Z_BACK + Z_FRONT) / 2); g.add(w); }
  const sill = box(DOJO_W, 0.35, 0.4, { sides: mat(WOOD), top: mat(0xb48459) }); sill.position.set(DOJO_W / 2, 0, Z_FRONT + 0.2); g.add(sill);
  yield;
  // The furniture.
  for (const p of S.props) {
    if (p.kind === 'bench') g.add(bench(p.x, p.z, { len: p.len }));
    else if (p.kind === 'bag') {
      const stand = box(0.08, 2.3, 0.08, { sides: mat(0x23252f) }); stand.position.set(p.x - 0.45, 0, p.z); g.add(stand);
      const arm = box(0.55, 0.06, 0.06, { sides: mat(0x23252f) }); arm.position.set(p.x - 0.2, 2.25, p.z); g.add(arm);
      const bag = box(0.42, 1.05, 0.42, { sides: mat(0x6e2a2e), top: mat(0x9e3c36), front: mat(0x9e3c36) }); bag.position.set(p.x, 0.9, p.z); g.add(bag);
    } else if (p.kind === 'rack') {
      const r = box(1.4, 1.5, 0.5, { sides: mat(WOOD), top: mat(0xb48459) }); r.position.set(p.x, 0, p.z); r.rotation.y = Math.PI / 2; g.add(r);
    } else if (p.kind === 'cooler') {
      const c = box(0.4, 1.0, 0.4, { sides: mat(0xdfe2e8), top: mat(0xf6f4ee) }); c.position.set(p.x, 0, p.z); g.add(c);
      const jug = box(0.3, 0.4, 0.3, { sides: mat(0x5d8fc2), top: mat(0x95c1e3) }); jug.position.set(p.x, 1.0, p.z); g.add(jug);
    }
  }
  return { group: g, fronts, heads, sprites, dispose() { g.traverse(o => { o.geometry?.dispose(); }); } };
}
