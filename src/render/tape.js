// TRADECRAFT render: the police tape round a place (sim/emergency.js state.cordons): posts a metre high at its corners
// and every POST_GAP_M between, and the tape from post to post in the country's colours (its police car's band and
// white: sim/countries/), banded so it reads at the picture's scale. The tape is as thick across as it is tall, so a
// side running up the picture shows as a line too (it was 2 cm across, under a pixel: the sides vanished, and the
// line read as a stray bar and a lamp post, the user's "mess", 2026-11-04); it glows a little (TAPE_GLOW), as the
// reflective stuff does in a street's light (unlit, at TAPE_GLOW of its colours), so it reads after dark. On the pavement under the fronts, it's tied off
// to the wall, as the police do it: along the kerb and across the pavement at both ends, no tape along the front
// (where it was hidden by whoever stood there, and doubled the wall's line). Kept to the pavement it's on (between the buildings' front and the kerb), so it
// doesn't run through a wall or across the road. Rebuilt only when the tape changes; it's scenery, there whether or
// not you're looking, as a parked car is.
import * as THREE from 'three';
import { mat, glow, paint, box, part } from '../art/pixelart.js';
import { Z } from '../sim/map/street.js';
import { policeOf } from '../sim/countries/index.js';

const POST_H = 1.0, TAPE_H = 0.88, TAPE_T = 0.07, TAPE_W = 0.1, POST_GAP_M = 2.4, TAPE_GLOW = 0.7;

export function createTape(scene) {
  const group = new THREE.Group();
  scene.add(group);
  let key = '', made = [];                                         // (the band's texture and material, freed when it's rebuilt)
  /** Each frame: the tape on this street, as it stands. */
  function update(state) {
    const row = state.map?.row ?? 0, list = state.map?.kind === 'street' ? (state.cordons ?? []).filter(k => k.row === row && k.until > state.time.ms) : [];
    const k = list.map(c => c.id).join(',');
    if (k === key) return;
    key = k;
    for (const o of [...group.children]) { group.remove(o); o.traverse(m => m.geometry?.dispose()); }
    for (const m of made) m.dispose(); made = [];
    const L = policeOf(state.map)?.ems?.policeCar, c0 = L?.stripe?.[0] ?? 0x3b6296;
    const tex = paint(16, 2, (px) => { for (let x = 0; x < 16; x += 4) px(x, 0, 2, 2, c0); for (let x = 2; x < 16; x += 4) px(x, 0, 2, 2, 0xf6f4ee); }, { repeat: true });
    // (unlit, a little dimmed: reflective, as it is in a street's light; lit as the rest is, a side running up the
    // picture shows only its top, which a lamp's pool hardly lights, and went dark as the posts)
    const band = glow(0, tex);
    band.color?.setScalar(TAPE_GLOW);
    band.depthWrite = false;                                        // (and it leaves the depth alone: see below)
    made.push(tex, band);
    const post = mat(0x6a7182);
    for (const c of list) {
      // (on the pavement it's on: the north between the fronts and the kerb, the south past its kerb; elsewhere, as it is)
      const north = c.z < Z.kerbN, south = c.z > Z.kerbS;
      const z0 = north ? Math.max(Z.front + 0.3, c.z - c.r * 0.6) : south ? Math.max(Z.kerbS + 0.3, c.z - c.r * 0.6) : c.z - c.r * 0.6;
      const z1 = north ? Math.min(Z.kerbN - 0.2, c.z + c.r * 0.6) : c.z + c.r * 0.6;
      const x0 = c.x - c.r, x1 = c.x + c.r;
      // (the north pavement's: from the wall, along the kerb, back to the wall; elsewhere all the way round)
      const corners = north ? [[x0, Z.front], [x0, z1], [x1, z1], [x1, Z.front]] : [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
      // (a post every POST_GAP_M at most, the tape from each to the next; none at the wall, where it's tied off)
      const pts = [];
      for (let i = 0; i < corners.length - 1; i++) {
        const [ax, az] = corners[i], [bx, bz] = corners[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / POST_GAP_M));
        for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
      }
      pts.push(corners[corners.length - 1]);
      for (const [x, z] of pts) if (!(north && z === Z.front)) { const p = box(0.08, POST_H, 0.08, { sides: post, top: post }); p.position.set(x, POST_H / 2, z); group.add(part(p)); }
      pts.slice(0, -1).forEach(([ax, az], i) => {
        const [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
        const t = box(len, TAPE_T, TAPE_W, { sides: band, front: band, back: band, top: band });
        t.position.set((ax + bx) / 2, TAPE_H, (az + bz) / 2);
        t.rotation.y = -Math.atan2(bz - az, bx - ax);
        // (no ink line round it: the outline inks a part's edges and any jump in depth, and a tape that runs up the
        // picture, 10 cm wide, is all edge: over the pavement it was inked black from end to end. Out of the part-ID
        // pass, writing no depth, drawn after what's solid, and still hidden by whoever stands in front of it)
        t.userData.noId = true; t.renderOrder = 5; t.castShadow = false;
        group.add(part(t));
      });
    }
  }
  function dispose() { for (const o of [...group.children]) o.traverse(m => m.geometry?.dispose()); for (const m of made) m.dispose(); scene.remove(group); }
  return { update, dispose };
}
