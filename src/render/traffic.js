// TRADECRAFT render: the traffic on the road (sim/traffic.js state.traffic), as the sim has it.
//
// A car or a bus is built when it comes into play (src/art/pixeltown.js car(), busModel(): their faces
// shared, made once a make), placed each frame between its last two ticks (alpha), turned to its way,
// and freed when it goes (its geometry; the faces are kept). Nothing that moves casts a sun shadow
// (src/render/view.js: the shadow map is drawn only when the camera steps), so they don't. After dark
// their lights are on (and a bus's line): each face that has lights takes a lit copy of itself (its
// glows emissive, src/art/pixelart.js emissiveOf()), a copy of its own, so the parked cars that share
// the face stay dark.
import { car, busModel } from '../art/pixeltown.js';
import { emissiveOf } from '../art/pixelart.js';
import { cityById, townOf } from '../sim/cities/index.js';
import { lineNumber } from '../sim/map/street.js';

const lerp = (a, b, t) => a + (b - a) * t;
const lit = new Map();                                             // (a face's lit copy, by the face)
function litOf(m) {
  if (!m.map) return m;
  if (!lit.has(m)) {
    const e = emissiveOf(m.map);
    if (!e) lit.set(m, m);
    else { const c = m.clone(); c.emissiveMap = e; c.emissive.set(0xffffff); c.userData.keep = true; lit.set(m, c); }
  }
  return lit.get(m);
}
/** Its lights on, or off. */
function lights(g, on) {
  g.traverse(o => {
    if (!o.isMesh) return;
    o.userData.day ??= o.material;
    o.material = on ? (Array.isArray(o.userData.day) ? o.userData.day.map(litOf) : litOf(o.userData.day)) : o.userData.day;
  });
  g.userData.on = on;
}

export function createTraffic(scene) {
  const meshes = new Map();
  let row = null;
  function free(id) {
    const m = meshes.get(id);
    if (!m) return;
    scene.remove(m);
    m.traverse(o => o.geometry?.dispose());
    meshes.delete(id);
  }
  /** Each frame: the cars in play, where they are between the ticks. */
  function update(state, alpha, night = false) {
    const t = state.traffic, cars = state.map.kind === 'street' && t?.row === (state.map.row ?? 0) ? t.cars : [];
    if (row !== (state.map.row ?? 0)) { for (const id of [...meshes.keys()]) free(id); row = state.map.row ?? 0; }
    const live = new Set();
    for (const c of cars) {
      live.add(c.id);
      let m = meshes.get(c.id);
      if (m && c.taxi && m.userData.free !== c.taxi.free) { free(c.id); m = null; }   // (a taxi's light changed: hailed and taken, or let go)
      if (!m) {
        const C = cityById(state.map.city);
        m = c.kind === 'bus' ? busModel(C.bus, lineNumber(townOf(state.map), state.map.row ?? 0)) : car(c.color, { seed: c.seed, kind: c.kind, free: c.taxi?.free ?? true });
        m.userData.free = c.taxi?.free;
        m.traverse(o => { if (o.isMesh) o.castShadow = false; });
        m.rotation.y = c.dir > 0 ? 0 : Math.PI;
        scene.add(m);
        meshes.set(c.id, m);
      }
      if (!!m.userData.on !== night) lights(m, night);
      m.position.set(lerp(c.px ?? c.x, c.x, alpha), 0, lerp(c.pz ?? c.z, c.z, alpha));
    }
    for (const id of [...meshes.keys()]) if (!live.has(id)) free(id);
  }
  function dispose() { for (const id of [...meshes.keys()]) free(id); }
  return { update, dispose };
}
