// TRADECRAFT render: footprints in the snow (the user, 2026-11-04: "If we could do some sort of transitory footprints as
// well where we walk without it being too heavy in performance it would be awesome").
//
// The view's alone, nothing the sim keeps: where snow lies (WX's cover over SNOW_FROM), whoever walks the street leaves a
// print every STEP_M (yours every YOURS_M), left foot and right a hand's width either side of the way they're going; each
// a little sunk grey oval on the ground, gone again over its life (LIFE_S, yours YOURS_S, half that while snow's falling:
// filled in), shrinking away in its last third. One instanced mesh, PRINTS of them in a ring (the oldest goes first): a draw
// call, and a matrix written only when one's laid or every FADE_S as they fade.
import * as THREE from 'three';
import { WX } from '../art/pixelart.js';

export const PRINT_Y = 0.03, PRINTS = 1500, STEP_M = 0.9, YOURS_M = 0.65, LIFE_S = 50, YOURS_S = 140, SNOW_FROM = 0.4, FADE_S = 0.5, FOOT_M = 0.11;

export function createPrints(scene) {
  const geo = new THREE.PlaneGeometry(0.18, 0.32);                 // (three pixels by five: a print you can see in the picture's)
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x7c8597 });     // (opaque and unlit, as the blood's are: src/render/blood.js; the snow's shadow blue)
  const mesh = new THREE.InstancedMesh(geo, mat, PRINTS);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 1;
  scene.add(mesh);
  const ring = [], last = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let next = 0, faded = 0, row = null;
  const put = (i, P, k) => { q.setFromAxisAngle(up, P.ang); v.set(P.x, PRINT_Y, P.z); sc.set(k, 1, k); m4.compose(v, q, sc); mesh.setMatrixAt(i, m4); };

  return {
    /** Once a frame: prints laid where people have walked on snow, the old ones fading; on another street, none of the last's. */
    update(state, now, falling = false) {
      const street = state.map?.kind === 'street', key = street ? `${state.map.seed}:${state.map.row}` : null;
      if (key !== row) { row = key; ring.length = 0; last.clear(); next = 0; mesh.count = 0; mesh.instanceMatrix.needsUpdate = true; }
      if (!street) return;
      const snow = WX.wxCover.value > SNOW_FROM, t = now / 1000;
      let laid = false;
      if (snow) for (const a of state.actors) {
        if (a.hidden || a.gait === 'down' || a.gait === 'sit' || (a.row ?? state.map.row) !== state.map.row) continue;
        const mine = a.who === state.player, L = last.get(a.id);
        if (!L) { last.set(a.id, { x: a.x, z: a.z, side: 1 }); continue; }
        const dx = a.x - L.x, dz = a.z - L.z, d = Math.hypot(dx, dz);
        if (d > 6) { L.x = a.x; L.z = a.z; continue; }               // (a jump: put somewhere, not walked there)
        if (d < (mine ? YOURS_M : STEP_M)) continue;
        const ang = Math.atan2(dx, dz), nx = -dz / d, nz = dx / d;   // (its length along the way they went)
        L.side = -L.side; L.x = a.x; L.z = a.z;
        const P = { x: a.x + nx * FOOT_M * L.side, z: a.z + nz * FOOT_M * L.side, ang, t, life: (mine ? YOURS_S : LIFE_S) * (falling ? 0.5 : 1) };
        const i = next; next = (next + 1) % PRINTS;
        ring[i] = P; put(i, P, 1); laid = true;
        mesh.count = Math.max(mesh.count, i + 1);
      }
      // (fading: in its last third, shrinking to nothing; gone, out of the ring)
      if (now - faded > FADE_S * 1000 || laid) {
        faded = now;
        for (let i = 0; i < mesh.count; i++) {
          const P = ring[i];
          if (!P) continue;
          const age = (t - P.t) / P.life, k = !snow || age >= 1 ? 0 : age < 0.66 ? 1 : 1 - (age - 0.66) / 0.34;
          if (k === P.k) continue;
          P.k = k; put(i, P, k);
          if (!k) ring[i] = null;
        }
        mesh.instanceMatrix.needsUpdate = true;
        const here = new Set(state.actors.map(a => a.id));
        for (const id of last.keys()) if (!here.has(id)) last.delete(id);
      }
    },
  };
}
