// TRADECRAFT render: the view of the map. What the player sees, drawn from the state, never the reverse.
//
// The look (picked 2026-10-26): chibi people (src/art/sprites.js) in the fine town (finish.fine, the
// 116-colour FINE_PALETTE, a warm grade) at 640 × 360, through the pixel stage of src/art/pixelart.js:
// a camera looking north and 45° down, orthographic, a metre 16 pixels, outlines, every pixel snapped
// to the palette.
//
// Each frame:
//   - sections are built and freed as the sim reports them ('section+' / 'section-' on the bus);
//   - the light is the clock's (sim/light.js sky()): the sun and the sky fill take its colours and
//     strengths, the sun's shadows fade at sunset, windows light house by house through dusk, the
//     lamps' heads light and their pools come on. Pools are LAMP_SLOTS pairs of spotlights moved to
//     the lamps nearest the camera, so the scene's light count never changes (no shader rebuilds);
//   - people and sprite props take the light where they stand (lightAt), the same number checks read;
//     a card in front of the player that would hide them is seen through;
//   - the camera follows the focus (the player), clamped to the map, snapped to the pixel grid, and
//     the sun's shadow camera moves with it in whole texels of its map, so shadows never shimmer.
// Positions are interpolated between the last two ticks (alpha), so motion is smooth at any frame rate.
import * as THREE from 'three';
import { pixelStage, finish, FINE_PALETTE, PX_PER_M, emissiveOf } from '../art/pixelart.js';
import { buildSection } from './town.js';
import { createCrowd } from './crowd.js';
import { sky, lightAt, LAMP } from '../sim/light.js';
import { Z, SECTION_M } from '../sim/map/street.js';
import { passerby } from '../sim/people.js';
import { focusActor } from '../sim/game.js';

export const RES = [640, 360];
export const LAMP_SLOTS = 10;
const LAMP_Y = 2.7;
const CAMERA_Z = [Z.sideEnd + 5, 14.2];                             // the camera's centre stays within these
const HALF_W = RES[0] / PX_PER_M / 2;

export function createView({ parent, bus }) {
  finish.fine = true;
  const stage = pixelStage({ res: RES, palette: FINE_PALETTE, grade: 1, background: 0x1a1214, parent, autoFit: false });
  const { scene, camera, sun, hemi } = stage;
  const sections = new Map();
  const crowd = createCrowd(scene);
  const looks = new Map();                                         // passer-by seed → look (generated once)
  const off = [
    bus.on('section+', (S) => { if (!sections.has(S.i)) { const s = buildSection(S); sections.set(S.i, s); scene.add(s.group); } }),
    bus.on('section-', (S) => { const s = sections.get(S.i); if (s) { scene.remove(s.group); s.dispose(); sections.delete(S.i); } }),
  ];

  // Lamp light: pairs of spotlights (a core and a ring), moved to the nearest lamps each frame.
  const slots = Array.from({ length: LAMP_SLOTS }, () => {
    const pair = [LAMP.r, LAMP.r * 1.5].map(radius => {
      const spot = new THREE.SpotLight(LAMP.color, 0, 0, Math.atan(radius / LAMP_Y), 0, 0);
      scene.add(spot, spot.target);
      return spot;
    });
    return pair;
  });

  // The sun's shadow camera: its basis, to snap it to whole texels as it follows.
  const sunDir = new THREE.Vector3(8, -15, -5).normalize();        // from the upper left, a little in front
  const right = new THREE.Vector3().crossVectors(sunDir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, sunDir).normalize();
  const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const aim = new THREE.Vector3();

  let cam = { x: 0, z: 0 };
  function look(x, z) {
    x = Math.round(x * PX_PER_M) / PX_PER_M; z = Math.round(z * PX_PER_M) / PX_PER_M;
    cam = { x, z };
    const s45 = Math.SQRT1_2;
    camera.position.set(x, 60 * s45, z + 60 * s45);
    camera.lookAt(x, 0, z);
    aim.set(x, 0, z);
    const u = Math.round(aim.dot(right) / texel) * texel, v = Math.round(aim.dot(up) / texel) * texel, w = aim.dot(sunDir);
    aim.copy(right).multiplyScalar(u).addScaledVector(up, v).addScaledVector(sunDir, w);
    sun.target.position.copy(aim);
    sun.position.copy(aim).addScaledVector(sunDir, -18);
  }

  const lerp = (a, b, k) => a + (b - a) * k;
  const sceneSprites = () => [...sections.values()].flatMap(s => s.sprites);

  /** Draw the state. prev: id → [x, z, stride] at the last tick; alpha: how far into this one. */
  function frame(state, prev, alpha, t) {
    const ms = state.time.ms, S = sky(ms), W = state.$world;
    const lamps = W.lamps;
    // Where everyone is, between the ticks.
    const at = (a) => { const p = prev.get(a.id); return p ? [lerp(p[0], a.x, alpha), lerp(p[1], a.z, alpha), lerp(p[2], a.stride, alpha)] : [a.x, a.z, a.stride]; };
    // The camera on the focus.
    const f = focusActor(state);
    if (f) {
      const [fx, fz] = at(f);
      let x = fx;
      if (state.map.i0 !== null) x = Math.max(state.map.i0 * SECTION_M + HALF_W, Math.min((state.map.i1 + 1) * SECTION_M - HALF_W, x));
      look(x, Math.max(CAMERA_Z[0], Math.min(CAMERA_Z[1], fz)));
    }
    // The light.
    hemi.color.setHex(S.sky); hemi.groundColor.setHex(S.ground); hemi.intensity = S.skyK * Math.PI;
    sun.color.setHex(S.sun); sun.intensity = S.sunK * Math.PI;
    sun.shadow.intensity = S.shadow;
    let painted = false;
    for (const s of sections.values()) {
      for (const fr of s.fronts) {
        const lit = S.glow > fr.dusk;
        if (S.glow > 0 && !fr.night && !painted) {                  // dusk is coming: paint one night face a frame
          fr.paintNight();
          const e = emissiveOf(fr.night.map);
          if (e) { fr.night.emissiveMap = e; fr.night.emissive.set(0xffffff); }
          painted = true;
        }
        const want = lit && fr.night ? fr.night : fr.day;
        if (fr.body.material[4] !== want) { fr.body.material[4] = want; }
        if (fr.night) fr.night.emissiveIntensity = S.glow;
      }
      for (const h of s.heads) h.head.material = S.glow > 0.35 ? h.night : h.day;
    }
    const near = lamps.map(l => [l, (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2]).sort((a, b) => a[1] - b[1]);
    slots.forEach((pair, i) => {
      const l = near[i]?.[0];
      pair.forEach((spot, k) => {
        spot.intensity = l ? (k === 0 ? l.core : l.ring) * Math.PI * S.glow : 0;
        if (l) { spot.position.set(l.x, LAMP_Y, l.z); spot.target.position.set(l.x, 0, l.z); }
      });
    });
    // Sprite props and people, in the light where they stand. On screen, something at height y on a
    // card at z sits where the ground at z − y does: a card hides whoever stands behind it (smaller z)
    // within its width and height.
    const me = f && at(f);
    for (const m of sceneSprites()) {
      const c = lightAt(lamps, m.position.x, m.position.z, ms, S);
      m.material.color.setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);
      if (m.userData.see) {
        const box = m.userData.box ??= new THREE.Box3().setFromObject(m);
        const see = me && me[1] < m.position.z && me[1] > m.position.z - (box.max.y + 0.3) && me[0] > box.min.x - 0.4 && me[0] < box.max.x + 0.4;
        // Seen through, the card draws last and leaves the depth alone: its holes then show what's
        // behind, and the outline pass sees no depth jumps to ink round every pixel left.
        m.userData.see.value = see ? 1 : 0;
        m.material.depthWrite = !see;
        m.renderOrder = see ? 10 : 0;
      }
    }
    const people = [];
    for (const a of state.actors) {
      const [x, z, stride] = at(a);
      const look = a.who ? state.people[a.who]?.look : lookOf(a.seed);
      if (!look) continue;
      people.push({ key: a.who ?? a.seed, look, x, z, face: a.face, gait: a.gait, stride, phase: (a.seed ?? 0) % 7 * 0.29, tint: lightAt(lamps, x, z, ms, S) });
    }
    crowd.update(people, t);
    stage.render();
  }
  function lookOf(seed) {
    if (!looks.has(seed)) { looks.set(seed, passerby(seed).look); if (looks.size > 600) looks.delete(looks.keys().next().value); }
    return looks.get(seed);
  }

  /** Free every section (a new game, a load). */
  function clear() {
    for (const s of sections.values()) { scene.remove(s.group); s.dispose(); }
    sections.clear();
  }
  function dispose() { clear(); off.forEach(f => f()); stage.renderer.dispose(); stage.renderer.domElement.remove(); }

  return { stage, frame, clear, dispose, canvas: stage.renderer.domElement, get camera() { return cam; } };
}
