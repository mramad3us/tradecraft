// Sample 006: chibi town. Pixel art from simple 3D (samples/lib/pixelart.js): chibi people
// (samples/lib/chibi.js) on a street of painted boxes (samples/lib/pixeltown.js).
//   ?view=street|lineup|sheet   the street; the cast in a row; or their sprites flat
//   ?people=boxes         people as boxes (chibi.js) instead of sprites (sprites.js)
//   ?zoom=2               look closer (the same pixels, fewer of them, shown bigger)
//   ?x=0&z=-2.4           where the camera looks
//   ?time=night           night: lamps lit, windows and signs aglow
//   ?t=1.25               freeze the clock there (for shots)
import * as THREE from 'three';
import { pixelStage, nightfall, ground, tile, mat } from '../lib/pixelart.js';
import { chibi } from '../lib/chibi.js';
import { spritePerson } from '../lib/sprites.js';
import { mainStreet } from '../lib/mainstreet.js';
import { CAST } from './cast.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'street';
if (view === 'sheet') await import('./sheet.js');
else run();
function run() {
const zoom = Number(q.get('zoom') ?? (view === 'lineup' ? 2 : 1));
const T = q.has('t') ? Number(q.get('t')) : null;
const night = q.get('time') === 'night';
const stage = pixelStage({ zoom });
const { scene } = stage;
const actors = [];                                               // { update(t) }
const wrap = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));

const boxes = q.get('people') === 'boxes';
const snap = (v) => Math.round(v * 16) / 16;                     // sprites sit on the pixel grid
function person(name, { x, z, y = 0, facing = 0, state = 'idle', phase = 0, path = null }) {
  const p = (boxes ? chibi : spritePerson)(CAST[name]);
  p.root.position.set(x, y, z);
  p.turn.rotation.y = facing;
  scene.add(p.root);
  actors.push({ update(t) {
    let px = x, pz = z;
    if (path) {                                                  // along x (vx) or z (vz), looping
      if (path.vx) px = wrap(x + path.vx * t, path.from, path.to);
      if (path.vz) pz = wrap(z + path.vz * t, path.from, path.to);
    }
    p.root.position.set(boxes ? px : snap(px), boxes ? y : snap(y), boxes ? pz : snap(pz));
    if (p.material) p.material.color.copy(stage.lightAt ? stage.lightAt(px, pz) : WHITE);
    p.pose(state, t + phase);
  } });
  return p;
}
const WHITE = new THREE.Color(1, 1, 1);

if (view === 'lineup') {
  scene.add(ground(-10, -6, 10, 6, mat(0, tile('cobble', 2))));
  const names = Object.keys(CAST);
  names.forEach((name, i) => {
    const x = (i - (names.length - 1) / 2) * 1.6;
    person(name, { x, z: -1.2, phase: i * 0.13 });
    person(name, { x, z: 1.6, facing: (i % 2 ? -1 : 1) * Math.PI / 2, state: 'walk', phase: i * 0.13 });
  });
  stage.look({ x: 0, z: 0.6 });
} else {
  mainStreet({ scene, night, person, actors, seat: (kind, x) => boxes
    ? (kind === 'bench' ? { x, y: 0.03, z: 5.45 } : { x, y: 0.06, z: -4.05 })
    // a sprite's card stands just in front of the seat, raised so its seat row meets the seat's front edge
    // on screen (a pixel up for each pixel forward)
    : (kind === 'bench' ? { x, y: 0.24, z: 5.7 } : { x, y: 0.22, z: -3.85 }) });
  stage.look({ x: Number(q.get('x') ?? 0), z: Number(q.get('z') ?? -2.4) });
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
