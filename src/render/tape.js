// TRADECRAFT render: the police tape round a place (sim/emergency.js state.cordons): a post at each corner, a metre high,
// and the tape between them in the country's colours (its police car's band and white: sim/countries/), banded so it
// reads at the picture's scale. Kept to the pavement it's on (between the buildings' front and the kerb), so it
// doesn't run through a wall or across the road. Rebuilt only when the tape changes; it's scenery, there whether or
// not you're looking, as a parked car is.
import * as THREE from 'three';
import { mat, paint, box, part } from '../art/pixelart.js';
import { Z } from '../sim/map/street.js';
import { policeOf } from '../sim/countries/index.js';

const POST_H = 1.0, TAPE_H = 0.88, TAPE_T = 0.06;

export function createTape(scene) {
  const group = new THREE.Group();
  scene.add(group);
  let key = '';
  /** Each frame: the tape on this street, as it stands. */
  function update(state) {
    const row = state.map?.row ?? 0, list = state.map?.kind === 'street' ? (state.cordons ?? []).filter(k => k.row === row && k.until > state.time.ms) : [];
    const k = list.map(c => c.id).join(',');
    if (k === key) return;
    key = k;
    for (const o of [...group.children]) { group.remove(o); o.traverse(m => m.geometry?.dispose()); }
    const L = policeOf(state.map)?.ems?.policeCar, c0 = L?.stripe?.[0] ?? 0x3b6296;
    const band = mat(0, paint(16, 2, (px) => { for (let x = 0; x < 16; x += 4) px(x, 0, 2, 2, c0); for (let x = 2; x < 16; x += 4) px(x, 0, 2, 2, 0xf6f4ee); }, { repeat: true }));
    const post = mat(0x4c5262);
    for (const c of list) {
      // (on the pavement it's on: the north between the fronts and the kerb, the south past its kerb; elsewhere, as it is)
      const north = c.z < Z.kerbN, south = c.z > Z.kerbS;
      const z0 = north ? Math.max(Z.front + 0.3, c.z - c.r * 0.6) : south ? Math.max(Z.kerbS + 0.3, c.z - c.r * 0.6) : c.z - c.r * 0.6;
      const z1 = north ? Math.min(Z.kerbN - 0.2, c.z + c.r * 0.6) : c.z + c.r * 0.6;
      const x0 = c.x - c.r, x1 = c.x + c.r, corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      for (const [x, z] of corners) { const p = box(0.08, POST_H, 0.08, { sides: post, top: post }); p.position.set(x, POST_H / 2, z); group.add(part(p)); }
      for (let i = 0; i < 4; i++) {
        const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4], len = Math.hypot(bx - ax, bz - az);
        const t = box(len, TAPE_T, 0.02, { sides: band, front: band, back: band, top: band });
        t.position.set((ax + bx) / 2, TAPE_H, (az + bz) / 2);
        t.rotation.y = -Math.atan2(bz - az, bx - ax);
        group.add(part(t));
      }
    }
  }
  function dispose() { for (const o of [...group.children]) o.traverse(m => m.geometry?.dispose()); scene.remove(group); }
  return { update, dispose };
}
