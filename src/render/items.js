// TRADECRAFT render: things lying about (sim/items.js lyingAbout()), pixel by pixel.
//
// Each kind is a little template of pixels (SHAPES), drawn bigger than life the way pixel art draws a
// key or a knife on the ground, so it reads at PX_PER_M: a penknife 7 pixels, a pipe 14. Letters are
// colours (INK, STEEL…); every one gets an ink outline so it stands off the paving. An item lies along
// x or along z, and either way round, by its id: the same every frame and after a load. One instanced
// draw for all of them, like the blood (src/render/blood.js), redrawn only when what's lying changes.
import * as THREE from 'three';
import { PX_PER_M } from '../art/pixelart.js';
import { lyingAbout } from '../sim/items.js';
import { hash } from '../sim/rng.js';

export const MAX_PIXELS = 3000;
const INK = 0x14151c;
const COLOURS = {
  g: 0xd6dae2, s: 0x8f96a6, S: 0x5c6272, d: 0x353947, w: 0x8a5a3c, W: 0x5e3b28, r: 0xb5493c, R: 0x6e2a2e,
  b: 0x3f6b4a, B: 0x9fc2a0, y: 0xd9a83a, u: 0x23252f, k: INK,
};
/** Each kind lying along x, its tip to the east (rows north to south). */
export const SHAPES = {
  penknife: ['ddddsgg'],
  boxcutter: ['yyyyysg'],
  switchblade: ['dddddsggg'],
  kitchen: ['wwwwSggggggg'],
  finka: ['WWWWkgggggg'],
  combat: ['    k       ', 'ddddkgggggggg', '    k       '],
  screwdriver: ['yyyyssss'],
  bottle: ['bbbbbb  ', 'bBbbbbbbb', 'bbbbbb  '],
  brokenbottle: ['bbbb b', 'bBbbbb', 'bbbb  b'],
  brick: ['rrrrrr', 'rrRrrr', 'RRRRRR'],
  hammer: ['ss       ', 'sswwwwwww', 'ss       '],
  spanner: ['s        s', 'ssssssssss', 's        s'],
  pipe: ['gggggggggggggg', 'ssssssssssssss'],
  crowbar: ['s            ', 'Ssssssssssssss', ' s            '],
  stick: ['       w    ', 'wwwwwwwwwwWww'],
  umbrella: ['k         ', 'kuuuuuuuuud', ' k         '],
  shovel: ['        sss', 'wwwwwwwwsss', '        sss'],
  bikelock: ['ssss', 's  s', 's  s', 'yyyy'],
  chain: ['s s s s s', ' s s s s '],
};

/** The pixels of one item: [{ x, z, c }] in metres, its outline first. */
function pixels(it) {
  const rows = SHAPES[it.kind] ?? SHAPES.stick, h = hash(it.id), P = 1 / PX_PER_M;
  const along = h % 2 === 0, flip = (h >> 1) % 2 === 1;
  const W = Math.max(...rows.map(r => r.length)), H = rows.length, on = new Set(), out = [];
  const at = (i, j) => {                                             // (template column i, row j → metres)
    const u = (flip ? W - 1 - i : i) - W / 2, v = j - H / 2;
    return along ? [it.x + u * P, it.z + v * P] : [it.x + v * P, it.z + u * P];
  };
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ' ') on.add(`${i},${j}`); }));
  const ring = new Set();
  for (const k of on) { const [i, j] = k.split(',').map(Number); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!on.has(`${i + a},${j + b}`)) ring.add(`${i + a},${j + b}`); }
  for (const k of ring) { const [i, j] = k.split(',').map(Number); out.push({ p: at(i, j), c: INK, y: 0.03 }); }
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ' ') out.push({ p: at(i, j), c: COLOURS[ch] ?? COLOURS.s, y: 0.033 }); }));
  return out;
}

export function createItems(scene) {
  const P = 1 / PX_PER_M;
  const geo = new THREE.PlaneGeometry(P, P).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PIXELS);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PIXELS * 3), 3);
  mesh.userData.noId = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  let key = '';
  /** Draw what's lying about on this map (redrawn only when it changes). */
  function update(state) {
    const list = lyingAbout(state);
    const k = `${state.map.seed}:${state.map.row}:${list.map(it => it.id).join(',')}`;
    if (k === key) return;
    key = k;
    let n = 0;
    for (const it of list) for (const px of pixels(it)) {
      if (n >= MAX_PIXELS) break;
      m4.makeTranslation(Math.round(px.p[0] * PX_PER_M) * P, px.y, Math.round(px.p[1] * PX_PER_M) * P);
      mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, c.setHex(px.c));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
  return { update, mesh };
}
