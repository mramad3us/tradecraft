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
//     section spread over a few frames (BUILD_MS of building a frame; flush() builds all at once),
//     but one on screen at once: on the next street, what's in the picture is built the frame it
//     arrives and the rest over the frames after (building it all froze a street change half a second).
//     Better still, it's built ahead: up a lane, within AHEAD_M of its end, the part of the next street
//     that will be on screen is built in the frames' spare time, kept out of the scene, and put in it
//     when the street changes (and thrown away if they turn back);
//     in the clock's month (`month()`: the trees in leaf or bare, the hedges', the fallen leaves);
//     a change of map ('map-': the player has gone on to the next street) frees them all;
//   - the light is the clock's (sim/light.js sky()): the sun and the sky fill take its colours and
//     strengths, the sun's shadows fade at sunset, windows light house by house through dusk, the
//     lamps' heads light and their pools come on. Pools are LAMP_SLOTS pairs of spotlights moved to
//     the lamps nearest the camera, so the scene's light count never changes (no shader rebuilds);
//   - people and sprite props take the light where they stand (lightAt), the same number checks read;
//     a card in front of the player that would hide them is seen through;
//   - the camera follows the focus (the player), clamped to the map, snapped to the pixel grid, and
//     the sun's shadow camera moves with it in steps of SHADOW_STEP texels of its map, so shadows never
//     shimmer. Nothing that moves casts a sun shadow (people have blobs) and the sun stands still, so
//     the shadow map is drawn only when that camera steps or a section comes or goes, not every frame
//     (it was two thirds of the draw calls). Its frustum is wider by a step, and its map by as many
//     texels, so a texel covers the same ground on the same grid as when it followed texel by texel;
//   - in a fight, a blow landing jolts the picture a pixel to three, the way it went, for SHAKE_TICKS;
//   - the camera leans where the eyes go (LEAD_M: a little walking, far looking with E held, more
//     north–south, where the picture is shorter; the user, 2026-10-26: "targets up and down are out
//     of the field of view"; into a shop's glass, where its mirror looks: the street behind), and in a scene following someone (scenario.watch()) toward them while
//     they're in sight; never past what the crowd's rule allows (sim/crowd.js SCREEN_HALF_M: nobody
//     comes or goes on screen), and eased (LEAD_S). The fog still says what's seen;
//   - what the player's character is aware of (sim/perception.js): a mask on the ground, FOG_CELL_M
//     cells over the view, each the visibility of its spot from the player's eyes (the cone, the
//     radius of awareness, a shop window's glass, the light, the walls in the way). A building takes the visibility of its
//     walls' feet, so a facade lights up when it's seen. The stage dims what's unseen (pixelStage
//     setFog); the mask eases in quickly and out slowly (FOG_IN_S, FOG_OUT_S), as eyes do. What the
//     eyes take in changes with the sim, so it's worked out again only on a new tick (or when the mask
//     moves, or the light changes, once a game second); only the easing runs every frame. The light on
//     a cell is the open air's, but where a lamp's pool may reach (each lamp stamps the cells under
//     it): those take lightLevel() with the lamps that reach them, the number checks read;
//   - people as the player knows them: those seen this tick where they are, the rest where they were
//     last seen, frozen mid-step in the dimmed street, until that spot is looked at again;
//   - the weather (sim/weather.js weatherAt(), the sim's, so the screen shows what the dice read):
//     the light under cloud is sky()'s; on the surfaces (src/art/pixelart.js WX) the snow lying, the
//     wet and its puddles, the lamps mirrored in them; in the composite (setWeather()) what falls, at
//     its density by level (FALL), slanted by the wind (SLANT), splashes, the haze out to how far the
//     eye reaches through it (sightM(): what's hazed out is what can't be seen) and the lamps' halos.
//     Nothing on a map indoors.
// Positions are interpolated between the last two ticks (alpha), so motion is smooth at any frame rate.
import * as THREE from 'three';
import { pixelStage, finish, FINE_PALETTE, PX_PER_M, emissiveOf, WX, WX_LAMPS } from '../art/pixelart.js';
import { buildSection } from './town.js';
import { buildDojo } from './dojo.js';
import { buildInterior } from './interior.js';
import { buildCut } from './cutaway.js';
import { unitAt } from '../sim/interiors/use.js';
import { createCrowd } from './crowd.js';
import { createBlood } from './blood.js';
import { createTraffic } from './traffic.js';
import { createItems } from './items.js';
import { sky, indoors, lightAt, lightLevel, LAMP } from '../sim/light.js';
import { Z, SECTION_M } from '../sim/map/street.js';
import { passerby } from '../sim/people.js';
import { geoOf } from '../sim/cities/index.js';
import { focusActor, playerActor } from '../sim/game.js';
import { SCENARIOS } from '../sim/scenarios/index.js';
import { SCREEN_HALF_M } from '../sim/crowd.js';
import { Z_BACK, Z_FRONT } from '../sim/map/dojo.js';
import { eyes, visibility, openAir } from '../sim/perception.js';
import { sectionFor } from '../sim/world.js';
import { weatherAt, sightM, FALLS } from '../sim/weather.js';
import { hash as hashOf } from '../sim/rng.js';

/**
 * Under what falls, some open an umbrella and some put a hood up (by who they are, so the same people
 * the same way; more of both the heavier it comes; a full hand can't hold an umbrella, nor can anyone
 * in a gale). Only how they're drawn: what it does to faces is the sim's (sim/weather.js weatherMods()).
 */
function rainwearOf(w, who, hand) {
  if (!w || !FALLS.has(w.kind) || !w.level) return null;
  const v = hashOf('rainwear', who) % 100, lv = w.level;
  const umbrella = w.kind === 'snow' ? 6 + lv * 4 : 18 + lv * 14, hood = w.kind === 'snow' ? 18 + lv * 12 : 10 + lv * 8;
  if (!hand && (w.wind ?? 0) < 3 && v < umbrella) return 'umbrella';
  return v < umbrella + hood ? 'hood' : null;
}
import { TICK_MS } from '../sim/clock.js';

export const RES = [640, 360];
export const LAMP_SLOTS = 10;
export const BUILD_MS = 6;
export const AHEAD_M = 15;                                          // up a lane this near its far end, the next street's built ahead
export const FOG_CELL_M = 0.5;
export const SHAKE_TICKS = 4;
export const INTERIOR_CAM_M = 3.2;                                // (in a flat: the camera on the plan's north wall plus this)
export const LEAD_M = { walk: [1, 2.5], look: [1.5, 8] };          // the camera's lean where the eyes go (east–west, north–south): walking, looking (E held)
export const LEAD_S = 0.35;                                         // how quickly it gets there
// (deep to the south: a facade whose foot is well below the picture shows its upper floors in it)
export const FOG_N = [96, 128];                                    // cells: 48 × 64 m round the camera
const FOG_AT = [-24, -18];                                         // the mask's corner from the camera, m
const FOG_IN_S = 0.08, FOG_OUT_S = 0.4;
const LAMP_Y = 2.7;
// The weather drawn: what falls by kind and level (rain's streaks, snow's flakes, dust's grit; sleet
// is both, half each), splashes on wet ground, the haze's strength (by its far edge, the eye's reach
// through it), the wind's slant (pixels across a pixel down, by its level; snow drifts further).
export const FALL = { rain: [0, 0.25, 0.6, 1], snow: [0, 0.3, 0.65, 1], dust: [0, 0, 0.5, 1] };
export const SPLASH = [0, 0.15, 0.4, 0.7];
export const HAZE = { rain: [0, 0, 0.18, 0.4], sleet: [0, 0.05, 0.22, 0.45], snow: [0, 0.08, 0.3, 0.55], fog: [0, 0.45, 0.7, 0.85], dust: [0, 0.35, 0.6, 0.8] };
export const SLANT = { rain: [0.06, 0.18, 0.4, 0.75], snow: [0.1, 0.3, 0.65, 1.1] };
const FALL_LOOP_MS = 600000;                                        // (what falls loops every ten minutes: small numbers for the GPU)
const CAMERA_Z = [Z.north + 8, Z.edge - 8];                        // the camera's centre stays within these (at RES)

export function createView({ parent, bus, month = () => 11 }) {
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
  const blood = createBlood(scene);
  const traffic = createTraffic(scene);
  const items = createItems(scene);                                // (things lying about: src/render/items.js)
  const looks = new Map();                                         // passer-by seed → look (generated once)
  let city = null;
  const building = new Map();                                     // i → a section's build under way: { gen, x0, x1 }
  let cut = false;                                                 // (the street just changed: this frame builds only what's on screen)
  const off = [
    bus.on('map-', () => clear(true)),                            // another street: its sections share the old one's indices
    bus.on('section+', (S) => {
      if (sections.has(S.i) || building.has(S.i)) return;
      const k = `${S.row}|${S.i}`, a = ahead.get(k)?.S.seed === S.seed && ahead.get(k).month === month() ? ahead.get(k) : null;
      if (a) ahead.delete(k);                                     // (built ahead: in the scene now, or the rest of it to build)
      if (a?.built) { sections.set(S.i, a.built); scene.add(a.built.group); shadows(); return; }
      building.set(S.i, { gen: a ? a.gen : S.kind === 'dojo' ? buildDojo(S) : S.kind === 'interior' ? buildInterior(S) : buildSection(S, { month: month() }), x0: S.x0, x1: S.x1 });
    }),
    bus.on('map', () => { for (const k of [...ahead.keys()]) drop(k); cut = true; }),   // (what was built ahead and not wanted after all)
    bus.on('section-', (S) => {
      const b = building.get(S.i);
      if (b) { building.delete(S.i); const r = b.gen.return(); r.value?.dispose(); }
      const s = sections.get(S.i); if (s) { scene.remove(s.group); s.dispose(); sections.delete(S.i); shadows(); }
    }),
  ];
  /** Build what's queued: one within m metres of x (on screen) whole, the rest for `budget` ms (Infinity: everything). */
  function build(budget = BUILD_MS, x = null, m = 0) {
    const t0 = performance.now();
    for (const [i, b] of building) {
      const now = x !== null && b.x1 > x - m && b.x0 < x + m;
      for (;;) {
        if (!now && performance.now() - t0 > budget) break;
        const r = b.gen.next();
        if (r.done) { building.delete(i); sections.set(i, r.value); scene.add(r.value.group); shadows(); break; }
      }
    }
  }

  // The next street's sections, built ahead (see the header): `row|i` → { S, gen, built, month }. One
  // dropped half built is finished first (scrap), so all it made is freed.
  const ahead = new Map(), scrap = [];
  function drop(k) {
    const a = ahead.get(k);
    ahead.delete(k);
    if (a.built) a.built.dispose(); else scrap.push(a.gen);
  }
  function buildAhead(state, f, t0) {
    const m = state.map, row = m.row ?? 0;
    const next = f && m.kind === 'street' ? (f.z < Z.north + AHEAD_M ? row - 1 : f.z > Z.hedge ? row + 1 : null) : null;
    const want = new Set();
    if (next !== null) {
      const r = SCREEN_HALF_M[0] + 1;                              // (as far as the picture reaches from them, leaning)
      let a = Math.floor((f.x - r) / SECTION_M), b = Math.floor((f.x + r) / SECTION_M);
      if (m.i0 !== null) a = Math.max(a, m.i0);
      if (m.i1 !== null) b = Math.min(b, m.i1);
      for (let i = a; i <= b; i++) {
        const k = `${next}|${i}`;
        want.add(k);
        if (!ahead.has(k)) { const S = sectionFor({ ...m, row: next }, i); ahead.set(k, { S, gen: buildSection(S, { month: month() }), built: null, month: month() }); }
      }
    }
    for (const k of [...ahead.keys()]) if (!want.has(k)) drop(k);
    // (in what's left of the frame's building time)
    for (const gen of [...scrap]) while (performance.now() - t0 < BUILD_MS) { const r = gen.next(); if (r.done) { r.value.dispose(); scrap.splice(scrap.indexOf(gen), 1); break; } }
    for (const a of ahead.values()) while (!a.built && performance.now() - t0 < BUILD_MS) { const r = a.gen.next(); if (r.done) a.built = r.value; }
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

  // The sun's shadow camera: its basis, to snap it to SHADOW_STEP as it follows. The step is an even
  // number of texels (about 2 m), so the frustum, a step wider (its map as many texels more), keeps
  // its edges on the texel grid it had when it followed texel by texel: the same shadows, drawn only
  // when the step changes or the street does (shadows()).
  const sunDir = new THREE.Vector3(8, -15, -5).normalize();        // from the upper left, a little in front
  const right = new THREE.Vector3().crossVectors(sunDir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, sunDir).normalize();
  const sc = sun.shadow.camera, texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
  const SHADOW_STEP = 2 * Math.round(1 / texel) * texel;
  { const h = sc.right + SHADOW_STEP / 2, n = Math.round(2 * h / texel); Object.assign(sc, { left: -h, right: h, top: h, bottom: -h }); sc.updateProjectionMatrix(); sun.shadow.mapSize.set(n, n); }
  stage.renderer.shadowMap.autoUpdate = false;
  const shadows = () => { stage.renderer.shadowMap.needsUpdate = true; };
  // The shop you're in, opened up (src/render/cutaway.js): its building hidden, and the awnings and signs
  // over its front; the building with the shop's slot cut out of it in their place.
  let opened = null;
  const over = (m, u) => { const bb = new THREE.Box3().setFromObject(m); return bb.max.x > u.x0 + 0.05 && bb.min.x < u.x1 - 0.05; };
  function cutaway(state) {
    const pc = playerActor(state), at = pc && !pc.hidden ? unitAt(state, pc.x, pc.z) : null, built = at && sections.get(at.S.i);
    const all = built?.byBuilding?.[at.u.building] ?? [], body = all.find(m => m.userData?.body)?.userData.body;
    const key = built && body ? `${state.map.row}|${at.S.i}|${at.k}|${body.material[4]?.id}` : null;   // (its façade's material too: dusk repaints it)
    if (key === (opened?.key ?? null)) return;
    if (opened) { for (const m of opened.hidden) m.visible = true; scene.remove(opened.group); opened.group.traverse(o => o.geometry?.dispose()); opened = null; }
    if (!key) return;
    // (its body; whatever's on it over the shop (a pipe, the ivy, the parapet) and the awnings and signs there: the rest stays)
    const hidden = [body, ...all.flatMap(m => (m.userData?.body ? m.children.filter(c => c !== body && over(c, at.u)) : over(m, at.u) ? [m] : []))];
    for (const m of hidden) m.visible = false;
    const group = buildCut(at.S, at.u.building, at.u, body);
    scene.add(group);
    opened = { key, hidden, group, units: [at.u] };
    shadows();
  }
  shadows();
  let shadowU = null, shadowV = null;
  const aim = new THREE.Vector3();

  let cam = { x: 0, z: 0 }, lead = [0, 0], leadAt = performance.now();
  function look(x, z) {
    x = Math.round(x * PX_PER_M) / PX_PER_M; z = Math.round(z * PX_PER_M) / PX_PER_M;
    cam = { x, z };
    const s45 = Math.SQRT1_2;
    camera.position.set(x, 60 * s45, z + 60 * s45);
    camera.lookAt(x, 0, z);
    aim.set(x, 0, z);
    const u = Math.round(aim.dot(right) / SHADOW_STEP) * SHADOW_STEP, v = Math.round(aim.dot(up) / SHADOW_STEP) * SHADOW_STEP, w = aim.dot(sunDir);
    if (u !== shadowU || v !== shadowV) { shadowU = u; shadowV = v; shadows(); }
    aim.copy(right).multiplyScalar(u).addScaledVector(up, v).addScaledVector(sunDir, w);
    sun.target.position.copy(aim);
    sun.position.copy(aim).addScaledVector(sunDir, -18);
  }

  // The fog: what the player's character is aware of, on the ground.
  const [FNX, FNZ] = FOG_N, fogData = new Uint8Array(FNX * FNZ), fogVal = new Float32Array(FNX * FNZ).fill(1);
  const fogAim = new Float32Array(FNX * FNZ), fogLight = new Float32Array(FNX * FNZ), fogIn = new Int16Array(FNX * FNZ);
  const fogLamps = Array.from({ length: FNX * FNZ }, () => []);   // per cell, the lamps whose pool may reach it
  const fogTex = new THREE.DataTexture(fogData, FNX, FNZ, THREE.RedFormat, THREE.UnsignedByteType);
  fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter;
  fogTex.generateMipmaps = false;
  let fogO = null, fogLitAt = -1e12, fogWalls = null, fogLast = performance.now(), fogTick = null;
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
      // Each lamp near the mask onto the cells its pool may reach (its box, 1.5 radii and a cell's
      // margin), in the lamps' order: lightLevel() over a cell's own then adds up what it did over all.
      for (const l of fogLamps) l.length = 0;
      for (const l of W.lamps) {
        if (!(l.x > x0 - 4 && l.x < x0 + FNX * FOG_CELL_M + 4 && l.z > z0 - 4 && l.z < z0 + FNZ * FOG_CELL_M + 4)) continue;
        const R = l.r * 1.5 + FOG_CELL_M;
        const i0 = Math.max(0, Math.floor((l.x - R - x0) / FOG_CELL_M)), i1 = Math.min(FNX - 1, Math.floor((l.x + R - x0) / FOG_CELL_M));
        const j0 = Math.max(0, Math.floor((l.z - R - z0) / FOG_CELL_M)), j1 = Math.min(FNZ - 1, Math.floor((l.z + R - z0) / FOG_CELL_M));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fogLamps[j * FNX + i].push(l);
      }
    }
    const x0 = ox * FOG_CELL_M, z0 = oz * FOG_CELL_M;
    if (Math.abs(state.time.ms - fogLitAt) > 1000) {               // the light changes slowly: once a game second
      fogLitAt = state.time.ms; fogTick = null;
      const open = lightLevel([], x0, z0, state.time.ms, S);      // (the open air's: the same everywhere)
      for (let j = 0, k = 0; j < FNZ; j++) for (let i = 0; i < FNX; i++, k++) fogLight[k] = fogLamps[k].length ? lightLevel(fogLamps[k], x0 + (i + 0.5) * FOG_CELL_M, z0 + (j + 0.5) * FOG_CELL_M, state.time.ms, S) : open;
    }
    // What the eyes take in: again only when the sim has moved on (or the mask, or the light).
    if (fogTick !== state.tick) {
      fogTick = state.tick;
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
    }
    const kin = 1 - Math.exp(-dt / FOG_IN_S), kout = 1 - Math.exp(-dt / FOG_OUT_S);
    for (let k = 0; k < fogVal.length; k++) {
      const a = fogAim[k], v = fogVal[k];
      fogVal[k] = v + (a - v) * (a > v ? kin : kout);
      fogData[k] = Math.round(fogVal[k] * 255);
    }
    fogTex.needsUpdate = true;
    // (unseen: dimmed by day, near black at night, so the edge of sight is a shadow)
    const air = Math.max(0, Math.min(1, (openAir(state) - 0.11) / 0.89));
    stage.setFog(fogTex, x0, z0, FNX * FOG_CELL_M, FNZ * FOG_CELL_M, 0.18 + 0.3 * air);
  }

  const lerp = (a, b, k) => a + (b - a) * k;
  const drawn = new Map();                                         // id → [x, z] as last drawn
  const sceneSprites = () => [...sections.values()].flatMap(s => s.sprites);

  /** Draw the state. prev: id → [x, z, stride] at the last tick; alpha: how far into this one. */
  function frame(state, prev, alpha, t) {
    city = state.map.city;                                         // (passers-by dress as their city does)
    cutaway(state);
    const ms = state.time.ms, wx = weatherAt(state), S = state.map.kind === 'interior' ? indoors(sky(ms, geoOf(state.map), wx), state.$world?.sections.get(0)?.plan?.mood) : sky(ms, geoOf(state.map), wx), W = state.$world;
    const lamps = W.lamps;
    // Where everyone is, between the ticks.
    const at = (a) => { const p = prev.get(a.id); return p ? [lerp(p[0], a.x, alpha), lerp(p[1], a.z, alpha), lerp(p[2], a.stride, alpha)] : [a.x, a.z, a.stride]; };
    // The camera on the focus.
    const f = focusActor(state);
    if (f) {
      const [fx, fz] = at(f);
      const now = performance.now(), dt = Math.min(0.1, (now - leadAt) / 1000), pc = playerActor(state), want = [0, 0];
      leadAt = now;
      if (pc && f === pc) {
        const L = pc.looking ? LEAD_M.look : (pc.vx || pc.vz) ? LEAD_M.walk : [0, 0], h = pc.head ?? 0;
        // (into a shop's glass, what the eyes see is its mirror: the street behind, on the side they slant to)
        want[0] = Math.cos(h) * L[0]; want[1] = (pc.glass ? -1 : 1) * Math.sin(h) * L[1];
        const w = SCENARIOS[state.scenario.kind]?.watch?.(state);
        if (w) { want[0] += (w.x - fx) * 0.5; want[1] += (w.z - fz) * 0.5; }
      }
      const mx = Math.max(0, SCREEN_HALF_M[0] - halfW - 0.5), mz = Math.max(0, SCREEN_HALF_M[1] - stage.H / PX_PER_M / 2 - 0.5);
      want[0] = Math.max(-mx, Math.min(mx, want[0])); want[1] = Math.max(-mz, Math.min(mz, want[1]));
      const ease = 1 - Math.exp(-dt / LEAD_S);
      lead[0] += (want[0] - lead[0]) * ease; lead[1] += (want[1] - lead[1]) * ease;
      let x = fx + lead[0];
      if (state.map.i0 !== null) x = Math.max(state.map.i0 * SECTION_M + halfW, Math.min((state.map.i1 + 1) * SECTION_M - halfW, x));
      // (in the hall: the near sill at the picture's foot, the back wall in it; in a flat, the whole plan, still)
      const plan = state.map.kind === 'interior' && W.sections.get(0)?.plan;
      if (plan) x = (plan.x0 + plan.x1) / 2;
      const cz = state.map.kind === 'dojo' ? [Z_BACK + 3, Z_FRONT + 0.4 - stage.H / PX_PER_M / 2] : plan ? [plan.z0 + INTERIOR_CAM_M, plan.z0 + INTERIOR_CAM_M] : camZ;
      // (a blow landing: the picture jolts a pixel or three, the way the blow went, and settles: sim/cqcshow.js)
      const imp = state.fight?.impact, since = imp ? state.tick - imp.tick + alpha : 99;
      const jolt = since < SHAKE_TICKS ? Math.round((1 + 2 * Math.min(1, imp.force / 0.4)) * (1 - since / SHAKE_TICKS)) * (Math.floor(since * 2) % 2 ? -1 : 1) * (imp.side === 'b' ? 1 : -1) / PX_PER_M : 0;
      look(x + jolt, Math.max(cz[0], Math.min(Math.max(cz[0], cz[1]), fz + lead[1])) + Math.abs(jolt) * 0.5);
    }
    const t0 = performance.now();
    build(cut ? 0 : BUILD_MS, cam.x, halfW + 1);                   // (what's on screen whole: the next street's, the frame it comes)
    cut = false;
    if (!building.size) buildAhead(state, f, t0);
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
    // (a shop's lights behind its façade light nothing you can see: only the shop you're in has its own; sim/interiors/shop.js)
    const near = lamps.filter(l => l.shop === undefined || l.shop === opened?.units[0].door).map(l => [l, (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2]).sort((a, b) => a[1] - b[1]);
    slots.forEach((pair, i) => {
      const l = near[i]?.[0];
      pair.forEach((spot, k) => {
        spot.intensity = l ? (k === 0 ? l.core : l.ring) * Math.PI * S.glow : 0;
        if (l) { spot.position.set(l.x, LAMP_Y, l.z); spot.target.position.set(l.x, 0, l.z); }
      });
    });
    weather(state, wx, S, near, f, alpha);
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
    const aware = SCENARIOS[state.scenario.kind]?.aware?.(state);
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
      // (blood worn, what's in the hand, and the rainwear the weather puts on them are part of the look: their own sheet)
      // (a named person's sheet keyed by their look too, so a change of clothes is drawn: sim/clothes.js; a shop's bag in the hand)
      const P = a.who && state.people[a.who], bl = P?.bloody, hand = P?.hand, rain = rainwearOf(wx, a.who ?? a.seed, hand), bag = P?.bag?.length ? 'bag' : null;
      const base = a.who ? `${a.who}#${lookKey(look)}` : a.seed;
      const key = bl || hand || rain || bag ? `${base}~${bl ? Object.keys(bl).sort().join('') : ''}~${hand ?? ''}~${rain ?? ''}~${bag ?? ''}` : base;
      people.push({ key, look: bl || hand || rain || bag ? { ...look, ...(bl ? { blood: bl } : {}), ...(hand ? { hand } : {}), ...(rain ? { rainwear: rain } : {}), ...(bag ? { carry: 'bag' } : {}) } : look, x, z, face: a.face, gait: a.gait, stride, phase: (a.seed ?? 0) % 7 * 0.29, tint: lightAt(lamps, x, z, ms, S) });
    }
    // (indoors, the view's own people at their places, not the sim's: whoever's behind the counter of the
    // shop you're in. Their looks a passer-by's, the hat and the bag left at the door)
    const staff = (opened?.units ?? []).map(u => ({ ...u.staff, key: 7e6 + u.look.seed, face: 'down' }));   // (an embassy's people are the sim's: sim/interiors/staffing.js)
    for (const p of staff) {
      const lk = p.look ?? indoors(lookOf(p.key));
      people.push({ key: p.look ? `staff-${p.key}` : p.key, look: lk, x: p.x, z: p.z, face: p.face ?? 'down', gait: p.gait ?? 'idle', stride: 0, phase: 0, tint: lightAt(lamps, p.x, p.z, ms, S) });
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
    blood.update(state);
    traffic.update(state, alpha, S.glow > 0.35);                   // (the cars on the road, their lights on after dark: src/render/traffic.js)
    items.update(state);
    stage.render();
    for (const s of dying) s.dispose();                            // (the last street's, now the next's have their shaders)
    dying.length = 0;
  }
  // The weather, each frame: on the surfaces (WX) and in the composite (setWeather()).
  const proj = new THREE.Vector3(), lin = new THREE.Color();
  function weather(state, w, S, near, f, alpha) {
    if (w.indoors) { WX.wxCover.value = WX.wxRime.value = WX.wxWet.value = WX.wxPuddles.value = 0; stage.setWeather(null); return; }
    const falls = FALLS.has(w.kind), L = w.level, sleet = w.kind === 'sleet';
    // (how bright the open air is, 0 night … 1 day: what falls and the haze are lit by it)
    const air = Math.max(0, Math.min(1, (openAir(state) - 0.06) / 0.9)), lit = (c, lo = 0.3) => c.map(v => v * (lo + (1 - lo) * air));
    const dusk = (day, night) => day.map((v, j) => night[j] + (v - night[j]) * air);   // (the haze: its night colour to its day's)
    WX.wxCover.value = w.cover;
    WX.wxRime.value = w.rime;
    WX.wxWet.value = w.wet;
    WX.wxPuddles.value = Math.max(0, Math.min(1, (w.wet - 0.45) / 0.55)) * (falls ? 0.3 + 0.25 * L : 0.4) * (state.map.city === 'cairo' ? 0.3 : 1);
    lin.setHex(S.sky, THREE.SRGBColorSpace).multiplyScalar(0.25 * S.skyK + 0.1 * S.sunK);
    WX.wxSky.value.copy(lin);
    WX.wxRoad.value.set(Z.kerbN, Z.kerbS, Z.roadN, Z.roadS);
    WX.wxLamps.value.forEach((v, i) => { const l = near[i]?.[0]; v.set(l?.x ?? 0, l?.z ?? 0, l && w.wet > 0.3 ? S.glow : 0, LAMP_Y); });
    const hk = HAZE[w.kind]?.[L] ?? 0, far = Math.min(60, sightM(w));
    const slant = w.dir * (SLANT[w.kind === 'snow' ? 'snow' : 'rain'][w.wind] ?? 0);
    // (the lamps' halos in wet or thick air: their heads on the screen, pixels from the bottom left)
    const halos = [];
    const wetAir = hk + (falls ? 0.08 * L : 0);
    if (S.glow > 0 && wetAir > 0.05) {
      camera.updateMatrixWorld();
      for (const [l] of near.slice(0, WX_LAMPS)) {
        proj.set(l.x, LAMP_Y, l.z).project(camera);
        halos.push([(proj.x + 1) / 2 * stage.W, (proj.y + 1) / 2 * stage.H, S.glow * Math.min(0.5, 0.15 + 0.5 * wetAir), 8 + 16 * hk]);
      }
    }
    const fx = f ? f.x : cam.x, fz = f ? f.z : cam.z;
    stage.setWeather({
      rain: w.kind === 'rain' ? FALL.rain[L] : sleet ? 0.5 * FALL.rain[L] : 0,
      snow: w.kind === 'snow' ? FALL.snow[L] : sleet ? 0.5 * FALL.snow[L] : 0,
      dust: w.kind === 'dust' ? FALL.dust[L] : 0,
      splash: w.kind === 'rain' || sleet ? SPLASH[L] : 0,
      slant, t: ((state.time.ms + alpha * TICK_MS) % FALL_LOOP_MS) / 1000, cam: [cam.x * PX_PER_M, cam.z * PX_PER_M],
      drop: lit([0.7, 0.76, 0.86]), flake: lit([0.95, 0.96, 1], 0.4), grit: lit([0.78, 0.64, 0.42]),
      haze: hk ? { k: hk, far, eye: [fx, fz], col: dusk(w.kind === 'dust' ? [0.78, 0.64, 0.44] : w.kind === 'fog' ? [0.72, 0.74, 0.77] : [0.62, 0.65, 0.7], w.kind === 'dust' ? [0.2, 0.16, 0.12] : [0.13, 0.15, 0.21]) } : null,
      halos,
    });
  }

  // (a look's short fingerprint, kept per look object: a look's replaced, not changed, when clothes change)
  const lookKeys = new WeakMap();
  function lookKey(look) {
    if (!look || typeof look !== 'object') return '';
    let k = lookKeys.get(look);
    if (k === undefined) { const t = JSON.stringify(look); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; k = (h >>> 0).toString(36); lookKeys.set(look, k); }
    return k;
  }
  // (a look for indoors: no hat but a headscarf or a skullcap, nothing carried)
  function indoors(look) {
    if (!look || (!look.carry && (!look.hat || ['hijab', 'skullcap'].includes(look.hat.kind)))) return look;
    const { carry, hat, ...rest } = look;
    return hat && ['hijab', 'skullcap'].includes(hat.kind) ? { ...rest, hat } : rest;
  }
  function lookOf(seed) {
    if (!looks.has(seed)) { looks.set(seed, passerby(seed, city).look); if (looks.size > 600) looks.delete(looks.keys().next().value); }
    return looks.get(seed);
  }

  /**
   * Free every section (a new game, a load); on a street change (`later`), after the next frame's
   * drawn: three frees a shader with the last material using it, and the next street's are the same
   * shaders, so freeing the last street first had them all compiled again in that frame (60 ms).
   */
  const dying = [];
  function clear(later = false) {
    if (opened) { scene.remove(opened.group); opened.group.traverse(o => o.geometry?.dispose()); opened = null; }   // (the street gone: its cut with it)
    for (const s of sections.values()) { scene.remove(s.group); if (later) dying.push(s); else s.dispose(); }
    sections.clear();
    for (const b of building.values()) b.gen.return();
    building.clear();
    if (!later) { for (const k of [...ahead.keys()]) drop(k); for (const gen of scrap.splice(0)) gen.return(); }
    shadows();
  }
  /** Done with the view (a new game makes its own): its GPU context given back, not left for the browser to cap. */
  function dispose() { traffic.dispose(); clear(); for (const s of dying.splice(0)) s.dispose(); off.forEach(f => f()); fogTex.dispose(); crowd.atlas.dispose(); stage.dispose(); }

  return { stage, frame, resize, clear, dispose, flush: () => build(Infinity), canvas: stage.renderer.domElement, get camera() { return cam; }, posOf: (id) => drawn.get(id),
    fogAt: (x, z) => { if (!fogO) return 1; const i = Math.floor(x / FOG_CELL_M) - fogO[0], j = Math.floor(z / FOG_CELL_M) - fogO[1]; return i >= 0 && i < FNX && j >= 0 && j < FNZ ? fogVal[j * FNX + i] : 0; } };
}
