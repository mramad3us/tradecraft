// Sample 006: chibi town. Pixel art from simple 3D (samples/lib/pixelart.js): chibi people
// (samples/lib/chibi.js) on a street of painted boxes (samples/lib/pixeltown.js).
//   ?view=street|lineup   the street, or the cast in a row (front, then side on, walking)
//   ?zoom=2               look closer (the same pixels, fewer of them, shown bigger)
//   ?x=0&z=-2.4           where the camera looks
//   ?time=night           night: lamps lit, windows and signs aglow
//   ?t=1.25               freeze the clock there (for shots)
import * as THREE from 'three';
import { pixelStage, nightfall, pool, ground, tile, mat } from '../lib/pixelart.js';
import { chibi } from '../lib/chibi.js';
import { street, building, awning, bladeSign, lamp, tree, bench, bin, cafeTable, chair, car } from '../lib/pixeltown.js';
import { CAST } from './cast.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'street';
const zoom = Number(q.get('zoom') ?? (view === 'lineup' ? 2 : 1));
const T = q.has('t') ? Number(q.get('t')) : null;
const night = q.get('time') === 'night';
const stage = pixelStage({ zoom });
const { scene } = stage;
const actors = [];                                               // { update(t) }
const wrap = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));

function person(name, { x, z, y = 0, facing = 0, state = 'idle', phase = 0, path = null }) {
  const p = chibi(CAST[name]);
  p.root.position.set(x, y, z);
  p.turn.rotation.y = facing;
  scene.add(p.root);
  actors.push({ update(t) {
    if (path) {                                                  // along x (vx) or z (vz), looping
      if (path.vx) p.root.position.x = wrap(x + path.vx * t, path.from, path.to);
      if (path.vz) p.root.position.z = wrap(z + path.vz * t, path.from, path.to);
    }
    p.pose(state, t + phase);
  } });
  return p;
}

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
  // The street: buildings along z = -5, a pavement to -2, the road to 3.5, a pavement beyond.
  const zB = -5;
  scene.add(street({ x0: -20, x1: 20, zB, zK1: -2, zK2: 3.5, z1: 8, zebra: [0, 2.2], pits: [[-12, 4.8], [11, 4.8]] }));
  scene.add(building({ x0: -20, x1: -8.5, z: zB, h: 7.2, roof: 'pitched', seed: 11, night, draw(f) {
    f.band(3.4);
    f.door(3.0, 1.1, 2.2, { color: 0x356f42 });
    for (const x of [1.0, 5.0, 7.0, 9.2]) f.window(x, 0.9, 1.1, 1.4, { curtain: x === 5.0 ? 0xc95c45 : null });
    for (const x of [1.0, 3.0, 5.0, 7.0, 9.2]) f.window(x, 4.0, 1.1, 1.5, { shutters: 0x356f42 });
    f.cornice(6.9);
  } }));
  scene.add(building({ x0: -8.5, x1: -1, z: zB, h: 4.4, wall: 'plaster', wallColor: 0xe2dac6, seed: 12, night, draw(f) {
    f.shopfront(0.4, 4.4, 2.6, { goods: [0xf6f4ee, 0x8f6345, 0xc95c45, 0xb48459] });
    f.door(5.4, 1.1, 2.3, { color: 0x6e2a2e, frame: 0x23252f });
    f.sign(0.6, 3.3, 4.0, 0.7, 'CAFE', { bg: 0x6e2a2e, fg: 0xf8e08a, border: 0x23252f });
    f.cornice(4.1, 0.3, 0xc4bba9);
  } }));
  scene.add(awning(-8.2, -3.9, 3.0, zB, { color: 0x9e3c36 }));
  scene.add(building({ x0: -1, x1: 7.5, z: zB, h: 9.5, wall: 'plaster', wallColor: 0xdfe2e8, seed: 13, night, draw(f) {
    f.rect(0, 0, 8.5, 0.5, 0xb8bdc8);                            // a plinth
    f.door(3.5, 1.6, 2.5, { color: 0x283f6b, frame: 0xb9862e });
    for (const x of [0.7, 1.9, 5.6, 6.8]) f.window(x, 0.9, 0.9, 1.6, { frame: 0xf6f4ee, lintel: 0xb8bdc8 });
    f.sign(3.0, 2.95, 2.6, 0.6, 'HOTEL', { bg: 0x1b2541, fg: 0xf8e08a, border: 0xb9862e });
    f.band(3.8, 0xb8bdc8);
    for (const x of [0.7, 2.4, 4.1, 5.8]) f.window(x, 4.3, 1.0, 1.7, { frame: 0xf6f4ee, lintel: 0xb8bdc8, shutters: 0x3b6296, lit: x === 4.1 });
  } }));
  scene.add(bladeSign(7.3, 3.2, zB, 'BAR', { bg: 0x4a2a52 }));
  // An alley between the hotel and the newsagent, with a building at its end.
  scene.add(ground(7.5, -11, 9.5, zB, mat(0, tile('cobble', 1))));
  scene.add(building({ x0: 6, x1: 11, z: -10, h: 6, wallColor: 0x6e2a2e, seed: 14, night, draw(f) {
    f.door(2.0, 1.0, 2.1, { color: 0x353947, frame: 0x7d756c, glass: false });
  } }));
  scene.add(bin(8.8, -6.2));
  scene.add(building({ x0: 9.5, x1: 20, z: zB, h: 6.4, wallColor: 0x8f6345, seed: 15, night, draw(f) {
    f.shopfront(0.6, 4.6, 2.6, { goods: [0xf6f4ee, 0xdfe2e8, 0x5d8fc2, 0xc95c45, 0xe7b84a] });
    f.door(5.8, 1.1, 2.3, { color: 0x24503a, frame: 0x23252f });
    f.sign(0.6, 2.9, 6.4, 0.6, 'NEWS TOBACCO', { bg: 0x24503a, fg: 0xf6f4ee, border: 0x173327 });
    for (const x of [0.8, 3.0, 5.2, 7.4]) f.window(x, 4.0, 1.1, 1.5, {});
    f.cornice(6.1, 0.3, 0xc4bba9);
  } }));
  scene.add(awning(10.0, 14.9, 2.85, zB, { color: 0x24503a, depth: 1.1 }));
  // Street furniture.
  scene.add(lamp(-9.6, -2.5, { lit: night }), lamp(6.4, -2.5, { lit: night }), lamp(-1.5, 4.2, { lit: night }));
  if (night) for (const x of [-6.1, 12.3]) {                     // shop windows spill light on the pavement
    scene.add(pool(x, 2.4, zB + 0.2, { r: 1.6, color: 0xe7b84a, core: 0.3, ring: 0.15, aim: [0, 1.6] }));
  }
  scene.add(tree(-12, 4.8, { seed: 3 }), tree(11, 4.8, { seed: 4, scale: 0.9 }));
  scene.add(bench(-5.5, 5.4), bin(2.8, 4.3));
  scene.add(cafeTable(-7.2, -3.5), chair(-7.2, -4.1), chair(-6.6, -3.0, -Math.PI / 2), cafeTable(-5.2, -3.5), chair(-5.2, -4.1));
  const parked = car(0x3b6296); parked.position.set(-14.5, 0, -1.05); scene.add(parked);
  const parked2 = car(0x9e3c36); parked2.position.set(14.0, 0, -1.05); scene.add(parked2);
  const taxi = car(0xe7b84a, { taxi: true }); taxi.rotation.y = Math.PI; taxi.position.set(0, 0, 2.2); scene.add(taxi);
  actors.push({ update(t) { taxi.position.x = wrap(12 - 4.5 * t, -24, 24); } });
  // The people.
  person('spy', { x: 5.6, z: -2.9 });
  person('cop', { x: 4.3, z: -4.3, phase: 0.4 });
  person('red', { x: -14, z: -3.4, facing: Math.PI / 2, state: 'walk', path: { vx: 1.1, from: -19, to: 19 } });
  person('suit', { x: 9, z: 4.3, facing: -Math.PI / 2, state: 'walk', phase: 0.2, path: { vx: -1.2, from: -19, to: 19 } });
  person('kid', { x: 2, z: -2.6, facing: -Math.PI / 2, state: 'run', path: { vx: -2.6, from: -19, to: 19 } });
  person('beard', { x: -5.5, y: 0.03, z: 5.45, state: 'sit' });
  person('long', { x: -7.2, y: 0.06, z: -4.05, state: 'sit', phase: 0.3 });
  person('beanie', { x: 1.1, z: -2.4, state: 'walk', path: { vz: 0.9, from: -2.6, to: 4.2 } });
  stage.look({ x: Number(q.get('x') ?? 0), z: Number(q.get('z') ?? -2.4) });
  if (night) nightfall(stage);
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
