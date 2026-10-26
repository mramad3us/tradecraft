// Sample 007: the fine town. Sample 006's street (samples/lib/mainstreet.js), in a finer finish after
// Stoneshard: people drawn finer (samples/lib/finepeople.js), the fine palette and a warm grade
// (pixelart.js), bevelled, weathered, cluttered surfaces (finish.fine in pixelart.js and pixeltown.js).
//   ?view=street|lineup|sheet   the street; the cast in a row; or their sprites flat
//   ?res=480                    sample 006's frame (480 × 270) instead of 640 × 360
//   ?people=chibi               sample 006's chibi people in the fine town (the user's pick, 2026-10-26)
//   ?zoom=2  ?x=0&z=-3.2  ?time=night  ?t=1.25   as in sample 006
import * as THREE from 'three';
import { pixelStage, nightfall, ground, tile, mat, finish, FINE_PALETTE } from '../lib/pixelart.js';
import { finePerson } from '../lib/finepeople.js';
import { spritePerson } from '../lib/sprites.js';
import { mainStreet } from '../lib/mainstreet.js';
import { CAST } from '../006-chibi/cast.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'street';
if (view === 'sheet') await import('./sheet.js');
else run();
function run() {
finish.fine = true;
const zoom = Number(q.get('zoom') ?? (view === 'lineup' ? 2 : 1));
const res = q.get('res') === '480' ? [480, 270] : [640, 360];
const T = q.has('t') ? Number(q.get('t')) : null;
const night = q.get('time') === 'night';
const stage = pixelStage({ zoom, res, palette: FINE_PALETTE, grade: 1, background: 0x1a1214 });
const { scene } = stage;
const actors = [];
const chibi = q.get('people') === 'chibi';
const wrap = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));
const snap = (v) => Math.round(v * 16) / 16;
const WHITE = new THREE.Color(1, 1, 1);
function person(name, { x, z, y = 0, facing = 0, state = 'idle', phase = 0, path = null }) {
  const p = (chibi ? spritePerson : finePerson)(CAST[name]);
  p.root.position.set(x, y, z);
  p.turn.rotation.y = facing;
  scene.add(p.root);
  actors.push({ update(t) {
    let px = x, pz = z;
    if (path) {
      if (path.vx) px = wrap(x + path.vx * t, path.from, path.to);
      if (path.vz) pz = wrap(z + path.vz * t, path.from, path.to);
    }
    p.root.position.set(snap(px), snap(y), snap(pz));
    p.material.color.copy(stage.lightAt ? stage.lightAt(px, pz) : WHITE);
    p.pose(state, t + phase);
  } });
  return p;
}

if (view === 'lineup') {
  scene.add(ground(-10, -6, 10, 6, mat(0, tile('cobble', 2))));
  const names = Object.keys(CAST);
  names.forEach((name, i) => {
    const x = (i - (names.length - 1) / 2) * 1.6;
    person(name, { x, z: -1.2, phase: i * 0.37 });
    person(name, { x, z: 1.6, facing: (i % 2 ? -1 : 1) * Math.PI / 2, state: 'walk', phase: i * 0.13 });
  });
  stage.look({ x: 0, z: 0.6 });
} else {
  // A fine sitter's seat row is 6 px above its feet (sample 006's: 4), so its card stands back 2 px less.
  mainStreet({ scene, night, person, actors, seat: (kind, x) => kind === 'bench' ? { x, y: 0.24, z: chibi ? 5.7 : 5.6 } : { x, y: 0.22, z: chibi ? -3.85 : -3.95 } });
  stage.look({ x: Number(q.get('x') ?? 0), z: Number(q.get('z') ?? (res[0] === 640 ? -3.2 : -2.4)) });
  if (night) {
    nightfall(stage);
    scene.traverse(o => { if (o.userData.sprite) o.material.color.copy(stage.lightAt(o.position.x, o.position.z)); });
  }
}

let frames = 0;
const clock = new THREE.Clock();
function frame() {
  const t = T ?? clock.getElapsedTime();
  for (const a of actors) a.update(t);
  stage.render();
  if (++frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}
window.__tradecraft = { stage, actors };
frame();
}
