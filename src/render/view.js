// TRADECRAFT render: the view of the map. What the player sees, drawn from the state, never the reverse.
//
// The look (picked 2026-10-26): chibi people (src/art/sprites.js) in the fine town (finish.fine, the
// 116-colour FINE_PALETTE, a warm grade) at 640 × 360 (on a window of another shape, a little more
// street: resize(), src/ui/ui.js), through the pixel stage of src/art/pixelart.js:
// a camera looking north and 45° down, orthographic, a metre 16 pixels, outlines, every pixel snapped
// to the palette.
//
// Each frame:
//   - sections are built and freed as the sim reports them ('section+' / 'section-' on the bus), a
//     section spread over a few frames (BUILD_MS of building a frame; flush() builds all at once);
//     a change of map ('map-': the player has gone on to the next street) frees them all;
//   - the light is the clock's (sim/light.js sky()): the sun and the sky fill take its colours and
//     strengths, the sun's shadows fade at sunset, windows light house by house through dusk, the
//     lamps' heads light and their pools come on. Pools are LAMP_SLOTS pairs of spotlights moved to
//     the lamps nearest the camera, so the scene's light count never changes (no shader rebuilds);
//   - people and sprite props take the light where they stand (lightAt), the same number checks read;
//     a card in front of the player that would hide them is seen through;
//   - the camera follows the focus (the player), clamped to the map, snapped to the pixel grid, and
//     the sun's shadow camera moves with it in whole texels of its map, so shadows never shimmer;
//   - in a fight, a blow landing jolts the picture a pixel to three, the way it went, for SHAKE_TICKS;
//   - what the player's character is aware of (sim/perception.js): a mask on the ground, FOG_CELL_M
//     cells over the view, each the visibility of its spot from the player's eyes (the cone, the
//     radius of awareness, a shop window's glass, the light, the walls in the way). A building takes the visibility of its
//     walls' feet, so a facade lights up when it's seen. The stage dims what's unseen (pixelStage
//     setFog); the mask eases in quickly and out slowly (FOG_IN_S, FOG_OUT_S), as eyes do;
//   - people as the player knows them: those seen this tick where they are, the rest where they were
//     last seen, frozen mid-step in the dimmed street, until that spot is looked at again.
// Positions are interpolated between the last two ticks (alpha), so motion is smooth at any frame rate.
import * as THREE from 'three';
import { pixelStage, finish, FINE_PALETTE, PX_PER_M, emissiveOf } from '../art/pixelart.js';
import { buildSection } from './town.js';
import { buildDojo } from './dojo.js';
import { createCrowd } from './crowd.js';
import { sky, lightAt, lightLevel, LAMP } from '../sim/light.js';
import { Z, SECTION_M } from '../sim/map/street.js';
import { passerby } from '../sim/people.js';
import { focusActor, playerActor } from '../sim/game.js';
import { SCENARIOS } from '../sim/scenarios/index.js';
import { Z_BACK, Z_FRONT } from '../sim/map/dojo.js';
import { eyes, visibility } from '../sim/perception.js';

export const RES = [640, 360];
export const LAMP_SLOTS = 10;
export const BUILD_MS = 6;
export const FOG_CELL_M = 0.5;
export const SHAKE_TICKS = 4;
// (deep to the south: a facade whose foot is well below the picture shows its upper floors in it)
export const FOG_N = [96, 128];                                    // cells: 48 × 64 m round the camera
const FOG_AT = [-24, -18];                                         // the mask's corner from the camera, m
const FOG_IN_S = 0.08, FOG_OUT_S = 0.4;
const LAMP_Y = 2.7;
const CAMERA_Z = [Z.north + 8, Z.edge - 8];                        // the camera's centre stays within these (at RES)

export function createView({ parent, bus }) {
  finish.fine = true;
  const stage = pixelStage({ res: RES, palette: FINE_PALETTE, grade: 1, background: 0x1a1214, parent, autoFit: false });
  let halfW = RES[0] / PX_PER_M / 2, camZ = CAMERA_Z;
  /** The picture w × h pixels (RES, or more on a window of another shape: src/ui/ui.js), on a canvas of outW × outH. */
  function resize(w, h, outW, outH) {
    stage.size(w, h, outW, outH);
    halfW = w / PX_PER_M / 2;
    const more = (h - RES[1]) / PX_PER_M / 2;                      // (taller: the camera stays as far in from the map's ends)
    camZ = [CAMERA_Z[0] + more, CAMERA_Z[1] - more];
  }
  const { scene, camera, sun, hemi } = stage;
  const sections = new Map();
  const crowd = createCrowd(scene);
  const looks = new Map();                                         // passer-by seed → look (generated once)
  const building = new Map();                                     // i → a section's build, under way
  const off = [
    bus.on('map-', () => clear()),                                // another street: its sections share the old one's indices
    bus.on('section+', (S) => { if (!sections.has(S.i) && !building.has(S.i)) building.set(S.i, S.kind === 'dojo' ? buildDojo(S) : buildSection(S)); }),
    bus.on('section-', (S) => {
      const b = building.get(S.i);
      if (b) { building.delete(S.i); const r = b.return(); r.value?.dispose(); }
      const s = sections.get(S.i); if (s) { scene.remove(s.group); s.dispose(); sections.delete(S.i); }
    }),
  ];
  /** Build what's queued: for BUILD_MS, or everything (budget Infinity). */
  function build(budget = BUILD_MS) {
    const t0 = performance.now();
    for (const [i, gen] of building) {
      for (;;) {
        const r = gen.next();
        if (r.done) { building.delete(i); sections.set(i, r.value); scene.add(r.value.group); break; }
        if (performance.now() - t0 > budget) return;
      }
    }
  }

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

  // The fog: what the player's character is aware of, on the ground.
  const [FNX, FNZ] = FOG_N, fogData = new Uint8Array(FNX * FNZ), fogVal = new Float32Array(FNX * FNZ).fill(1);
  const fogAim = new Float32Array(FNX * FNZ), fogLight = new Float32Array(FNX * FNZ), fogIn = new Int16Array(FNX * FNZ);
  const fogTex = new THREE.DataTexture(fogData, FNX, FNZ, THREE.RedFormat, THREE.UnsignedByteType);
  fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter;
  fogTex.generateMipmaps = false;
  let fogO = null, fogLitAt = -1e12, fogWalls = null, fogLast = performance.now();
  /** Bring the mask up to date for the player's eyes (dt: seconds since the last frame). */
  function fog(state, me, S) {
    const now = performance.now(), dt = Math.min(0.25, (now - fogLast) / 1000);
    fogLast = now;
    const W = state.$world;
    const ox = Math.floor((cam.x + FOG_AT[0]) / FOG_CELL_M), oz = Math.floor((cam.z + FOG_AT[1]) / FOG_CELL_M);
    if (!fogO || fogO[0] !== ox || fogO[1] !== oz || fogWalls !== W.walls) {
      // The mask moved (or the street changed): carry the eased values over, and find again the
      // walls each cell lies in and the light on each.
      if (fogO) {
        const old = fogVal.slice(), sx = ox - fogO[0], sz = oz - fogO[1];
        for (let j = 0; j < FNZ; j++) for (let i = 0; i < FNX; i++) {
          const pi = i + sx, pj = j + sz;
          fogVal[j * FNX + i] = pi >= 0 && pi < FNX && pj >= 0 && pj < FNZ ? old[pj * FNX + pi] : 0;
        }
      }
      fogO = [ox, oz]; fogWalls = W.walls; fogLitAt = -1e12;
      const x0 = ox * FOG_CELL_M, z0 = oz * FOG_CELL_M;
      fogIn.fill(-1);
      W.walls.forEach((w, k) => {
        const i0 = Math.max(0, Math.ceil((w.x0 - x0) / FOG_CELL_M - 0.5)), i1 = Math.min(FNX - 1, Math.floor((w.x1 - x0) / FOG_CELL_M - 0.5));
        const j0 = Math.max(0, Math.ceil((w.z0 - z0) / FOG_CELL_M - 0.5)), j1 = Math.min(FNZ - 1, Math.floor((w.z1 - z0) / FOG_CELL_M - 0.5));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fogIn[j * FNX + i] = k;
      });
    }
    const x0 = ox * FOG_CELL_M, z0 = oz * FOG_CELL_M;
    if (Math.abs(state.time.ms - fogLitAt) > 1000) {               // the light changes slowly: once a game second
      fogLitAt = state.time.ms;
      const lamps = W.lamps.filter(l => l.x > x0 - 4 && l.x < x0 + FNX * FOG_CELL_M + 4 && l.z > z0 - 4 && l.z < z0 + FNZ * FOG_CELL_M + 4);
      for (let j = 0; j < FNZ; j++) for (let i = 0; i < FNX; i++) fogLight[j * FNX + i] = lightLevel(lamps, x0 + (i + 0.5) * FOG_CELL_M, z0 + (j + 0.5) * FOG_CELL_M, state.time.ms, S);
    }
    const e = eyes(state, me);
    const walls = W.walls.filter(w => w.x1 > Math.min(e.x, x0) - 1 && w.x0 < Math.max(e.x, x0 + FNX * FOG_CELL_M) + 1 && w.z1 > Math.min(e.z, z0) - 1 && w.z0 < Math.max(e.z, z0 + FNZ * FOG_CELL_M) + 1);
    for (let j = 0, k = 0; j < FNZ; j++) {
      const z = z0 + (j + 0.5) * FOG_CELL_M;
      for (let i = 0; i < FNX; i++, k++) {
        if (fogIn[k] >= 0) { fogAim[k] = 0; continue; }
        fogAim[k] = visibility(state, e, x0 + (i + 0.5) * FOG_CELL_M, z, fogLight[k], walls);
      }
    }
    // A building's cells take its walls' feet: the facade's (the open cell south of them in their
    // column), and near its ends, the side walls' (the open cell beside them in their row).
    for (let i = 0; i < FNX; i++) {
      let foot = 0;
      for (let j = FNZ - 1; j >= 0; j--) { const k = j * FNX + i; if (fogIn[k] < 0) foot = fogAim[k]; else fogAim[k] = foot; }
    }
    for (let j = 0; j < FNZ; j++) {
      const row = j * FNX;
      for (let i = 0; i < FNX; i++) {
        if (fogIn[row + i] >= 0) continue;
        const v = fogAim[row + i];
        for (const s of [-1, 1]) for (let n = 1; n <= 2; n++) {
          const ii = i + s * n;
          if (ii < 0 || ii >= FNX || fogIn[row + ii] < 0) break;
          fogAim[row + ii] = Math.max(fogAim[row + ii], v);
        }
      }
    }
    const kin = 1 - Math.exp(-dt / FOG_IN_S), kout = 1 - Math.exp(-dt / FOG_OUT_S);
    for (let k = 0; k < fogVal.length; k++) {
      const a = fogAim[k], v = fogVal[k];
      fogVal[k] = v + (a - v) * (a > v ? kin : kout);
      fogData[k] = Math.round(fogVal[k] * 255);
    }
    fogTex.needsUpdate = true;
    stage.setFog(fogTex, x0, z0, FNX * FOG_CELL_M, FNZ * FOG_CELL_M);
  }

  const lerp = (a, b, k) => a + (b - a) * k;
  const drawn = new Map();                                         // id → [x, z] as last drawn
  const sceneSprites = () => [...sections.values()].flatMap(s => s.sprites);

  /** Draw the state. prev: id → [x, z, stride] at the last tick; alpha: how far into this one. */
  function frame(state, prev, alpha, t) {
    build();
    const ms = state.time.ms, S = sky(ms), W = state.$world;
    const lamps = W.lamps;
    // Where everyone is, between the ticks.
    const at = (a) => { const p = prev.get(a.id); return p ? [lerp(p[0], a.x, alpha), lerp(p[1], a.z, alpha), lerp(p[2], a.stride, alpha)] : [a.x, a.z, a.stride]; };
    // The camera on the focus.
    const f = focusActor(state);
    if (f) {
      const [fx, fz] = at(f);
      let x = fx;
      if (state.map.i0 !== null) x = Math.max(state.map.i0 * SECTION_M + halfW, Math.min((state.map.i1 + 1) * SECTION_M - halfW, x));
      // (in the hall: the near sill at the picture's foot, the back wall in it)
      const cz = state.map.kind === 'dojo' ? [Z_BACK + 3, Z_FRONT + 0.4 - stage.H / PX_PER_M / 2] : camZ;
      // (a blow landing: the picture jolts a pixel or three, the way the blow went, and settles: sim/cqcshow.js)
      const imp = state.fight?.impact, since = imp ? state.tick - imp.tick + alpha : 99;
      const jolt = since < SHAKE_TICKS ? Math.round((1 + 2 * Math.min(1, imp.force / 0.4)) * (1 - since / SHAKE_TICKS)) * (Math.floor(since * 2) % 2 ? -1 : 1) * (imp.side === 'b' ? 1 : -1) / PX_PER_M : 0;
      look(x + jolt, Math.max(cz[0], Math.min(Math.max(cz[0], cz[1]), fz)) + Math.abs(jolt) * 0.5);
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
    // People as the player knows them: seen this tick, where they are; otherwise where they were.
    const pc = playerActor(state), seen = state.mind?.seen ?? {}, now = state.mind?.at;
    // (a scenario whose character takes in all of a small lit room shows it whole: aware)
    const aware = SCENARIOS[state.scenario.kind]?.aware;
    if (pc && !aware) fog(state, pc, S); else stage.setFog(null);
    const people = [];
    drawn.clear();
    const lookFor = (key) => (typeof key === 'string' ? state.people[key]?.look : lookOf(key));
    for (const a of state.actors) {
      if (a.hidden) continue;                                      // (indoors)
      if (pc && a !== pc && !aware && seen[a.id]?.[5] !== now) continue;
      const [x, z, stride] = at(a);
      drawn.set(a.id, [x, z]);
      const look = lookFor(a.who ?? a.seed);
      if (!look) continue;
      people.push({ key: a.who ?? a.seed, look, x, z, face: a.face, gait: a.gait, stride, phase: (a.seed ?? 0) % 7 * 0.29, tint: lightAt(lamps, x, z, ms, S) });
    }
    for (const id in aware ? {} : seen) {                          // (and as remembered, those out of sight)
      const r = seen[id];
      if (r[5] === now) continue;
      const look = lookFor(r[6]);
      if (!look) continue;
      drawn.set(id, [r[0], r[1]]);
      people.push({ key: r[6], look, x: r[0], z: r[1], face: r[2], gait: r[3], stride: r[4], phase: 0, t: r[5] / 1000, tint: lightAt(lamps, r[0], r[1], ms, S) });
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
    for (const gen of building.values()) gen.return();
    building.clear();
  }
  function dispose() { clear(); off.forEach(f => f()); stage.renderer.dispose(); stage.renderer.domElement.remove(); }

  return { stage, frame, resize, clear, dispose, flush: () => build(Infinity), canvas: stage.renderer.domElement, get camera() { return cam; }, posOf: (id) => drawn.get(id),
    fogAt: (x, z) => { if (!fogO) return 1; const i = Math.floor(x / FOG_CELL_M) - fogO[0], j = Math.floor(z / FOG_CELL_M) - fogO[1]; return i >= 0 && i < FNX && j >= 0 && j < FNZ ? fogVal[j * FNX + i] : 0; } };
}
