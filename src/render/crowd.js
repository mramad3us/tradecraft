// TRADECRAFT render: everyone on the map, in one draw.
//
// Each person's sprite sheet (src/art/sprites.js: 37 frames, 4 facings, a 28 × 34 cell; in BANDS bands, below)
// goes into a slot of one ATLAS_PX square atlas, the first time their look is seen; a slot whose look
// has gone unseen longest is reused when the atlas is full. The atlas lives on the GPU, allocated once
// and never sent whole: a sheet goes up alone, into its slot (renderer.copyTextureToTexture: a
// texSubImage2D of half a megabyte). It used to be a canvas sent whole (64 MB) whenever a new face came
// into view, which Chrome on Windows took up to a second over (the user, 2026-10-29: "each time I
// turn it staggers almost a second": turning brings new people into sight). And no more than
// SHEETS_PER_FRAME new sheets are painted in a frame (a few milliseconds each): anyone left over is
// drawn a frame or two later, your own figure never. A new face gets the street's frames (STREET:
// standing, walking, running, sat, lying, a hand up, a phone); the fight's seventeen are painted the
// first time they're wanted, over half the work spared on nearly everyone. Everyone is then one instance of one
// upright card (an InstancedMesh): per instance its place, its atlas cell (the slot plus the frame and
// facing) and its tint, the light where it stands (sim/light.js lightAt). So a crowd of fifty is one
// draw call, as DESIGN.md (World size) sets for the engine.
//
// Frames follow the sim, not a clock: a walker's step advances with the distance they've walked
// (STEP_M a frame), so feet never slide, and a run's longer stride shows. A sitter's card stands on
// the seat (SEAT). A fighter's gait is its frame (guard, punch, grab, reel); someone down lies: the
// card turned on its side, its back to where they fell from (DOWN). Each card has a blob of shadow
// under it (a second instanced draw), as in the samples.
//
// **A gun in the hand** (the user, 2026-11-03: "when aiming, the sprites should show us aiming"): its look is
// a sheet of its own (src/render/view.js), whose street frames carry it at the low ready (src/art/sprites.js),
// its aim and fire frames painted with them. Which one is drawn is gunPose()'s, from the sim's runtime marks on
// the actor: aiming ($aim: at that spot, since its ms), the aim turned up or down the picture (or, from the
// front or behind, to its right or left) once it's TURN_RAD off the facing, the first RAISE_MS of it a turn
// lower (the gun coming up, side on); a round fired ($shot: its time), the kick for KICK_MS and the arms kept
// up AFTER_MS, aimed or not. The flash (FLASH_MS) is no part of the sheet: it's a card of its own, drawn over
// the figure at the muzzle (behind the head, from behind), unlit, as bright at night as by day (a third
// instanced draw); and the view lights whoever is near it (FLASH_LIT_M). All of it on the sim's clock, so a
// stopped clock (shooting's choice) holds the frame as it was.
//
// A sheet is laid out in BANDS bands of frames, one above the other (each band FRAMES / BANDS across, DIRS
// down), so a sheet is squarer than a row of 37 cells and more of them go in the atlas: SLOTS, 110 (a row
// of 37 would leave room for 90; of the 31 before the gun's, 120 went in).
import * as THREE from 'three';
import { frames, CELL, FRAMES, DIRS, FIGHT_FRAMES, GUN_FRAMES, flashOf } from '../art/sprites.js';
import { PX_PER_M } from '../art/pixelart.js';

export const ATLAS_PX = 4096;                                       // (110 people's sheets of 37 frames, in three bands)
export const SHEETS_PER_FRAME = 2, SHEET_MS = 1.5;              // (new faces a frame: one at least, a second only while the first took under SHEET_MS; a slow machine paints one)
// (the frames of the street, painted with a new face; a fight's, the first time they fight; a gun's with a gun in hand)
export const STREET = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'run0', 'run1', 'run2', 'run3', 'sit', 'reel', 'hail', 'phone'];
const ON_STREET = new Set(STREET);                                  // (new faces painted a frame: a turn brings several into sight at once; the rest a frame or two on, still coming out of the dark)
const ARMED = [...STREET, ...GUN_FRAMES], GUN = new Set(GUN_FRAMES), GUNS = new Set(['pistol', 'rifle']);
export const MAX_PEOPLE = 160, MAX_FLASHES = 24;
export const STEP_M = { walk: 0.16, run: 0.45 };            // (8 frames a second at an ordinary walk, as the samples)
/** Game milliseconds: a round's flash, its kick, the arms kept up after it; the gun coming up into the aim. */
export const FLASH_MS = 70, KICK_MS = 140, AFTER_MS = 600, RAISE_MS = 120;
/** Radians off the facing past which an aim is drawn turned: side on (up or down the picture), from the front or behind (to its right or left). */
export const TURN_RAD = { side: 0.2, front: 0.35 };
export const FLASH_LIT_M = 3, FLASH_LIGHT = [1.0, 0.85, 0.55];      // (who's lit by a flash, how far, and the most it lights them: linear, a warm white)
const SEAT = { y: 0.24, z: -0.2 };                                 // a sitter's card: up on the seat, back against it
const DOWN = { y: 0.35, x: 0.9 };                                 // a card laid on its side: lifted off the floor, its middle over the spot
const FIGHT = new Set(FIGHT_FRAMES);
const BANDS = 3, PER = Math.ceil(FRAMES.length / BANDS);
const [CW, CH] = CELL, SW = CW * PER, SH = CH * DIRS.length * BANDS;
const COLS = Math.floor(ATLAS_PX / SW), ROWS = Math.floor(ATLAS_PX / SH);
/** How many people's sheets the atlas holds at once (more looks than that in sight: the longest unseen is painted over). */
export const SLOTS = COLS * ROWS;
/** Where frame k (FRAMES' index) facing j (DIRS') sits in a sheet: its top-left, in pixels. */
const cellAt = (k, j) => [(k % PER) * CW, (Math.floor(k / PER) * DIRS.length + j) * CH];
const INK = 0x14151c;
const snap = (v) => Math.round(v * PX_PER_M) / PX_PER_M;
const STANDING = new Set(['idle', 'walk', 'run']);
const HEAD = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/**
 * Which way an aim (to, radians: atan2(dz, dx)) is turned off the facing, as the picture shows it: side on, 1 up
 * the picture, -1 down; from the front or behind, 1 to the picture's right, -1 its left; 0 straight.
 */
export function turnOf(face, to) {
  const c = Math.cos(to), s = Math.sin(to);
  if (face === 'right' || face === 'left') { const r = Math.atan2(s, face === 'right' ? c : -c); return r < -TURN_RAD.side ? 1 : r > TURN_RAD.side ? -1 : 0; }
  const r = Math.atan2(c, face === 'up' ? -s : s);
  return r > TURN_RAD.front ? 1 : r < -TURN_RAD.front ? -1 : 0;
}

/**
 * How someone with a gun in hand is drawn at game time ms, from the actor: { frame, flash }, frame a gun frame
 * (src/art/sprites.js GUN_FRAMES) or null (not aiming: the gait's own, the low ready); flash, the muzzle alight.
 * Reads a.$aim ({ x, z, ms }), a.$shot (ms), a.face, a.head, a.gait and where they stand. Pure: see the header.
 */
export function gunPose(a, ms) {
  const since = typeof a.$shot === 'number' ? ms - a.$shot : Infinity, fired = since >= 0 && since < AFTER_MS;
  if ((!a.$aim && !fired) || !STANDING.has(a.gait ?? 'idle')) return { frame: null, flash: false };
  const face = HEAD[a.face] !== undefined ? a.face : 'down', dx = a.$aim ? a.$aim.x - a.x : 0, dz = a.$aim ? a.$aim.z - a.z : 0;
  const to = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dz, dx) : a.head ?? HEAD[face];
  const kick = since >= 0 && since < KICK_MS, up = a.$aim ? ms - a.$aim.ms : Infinity;
  let turn = turnOf(face, to);
  if (!kick && (face === 'left' || face === 'right') && up >= 0 && up < RAISE_MS && turn >= 0) turn--;   // (coming up from the low ready)
  return { frame: `${kick ? 'fire' : 'aim'}${turn > 0 ? 'hi' : turn < 0 ? 'lo' : ''}`, flash: since >= 0 && since < FLASH_MS };
}

export function createCrowd(scene, renderer) {
  // (on the GPU only: storage made at its first use, nothing uploaded with it; rows top-down, as the sheets are drawn)
  const atlas = new THREE.DataTexture(null, ATLAS_PX, ATLAS_PX);
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.source.dataReady = false;
  atlas.needsUpdate = true;
  const at = new THREE.Vector2();

  // Slots: look key → { slot, seen }.
  const slots = new Map(), free = Array.from({ length: COLS * ROWS }, (_, i) => i);
  let frameNo = 0, fresh = 0, sheetMs = 0;
  /** A look's slot ({ slot, full }; painted now if it's new), or null: too many new this frame (own: yours, never put off). */
  function slotOf(key, look, own = false) {
    let s = slots.get(key);
    if (!s) {
      if ((fresh >= SHEETS_PER_FRAME || (fresh && sheetMs > SHEET_MS)) && !own) return null;
      fresh++;
      const t0 = performance.now();
      let i = free.pop();
      if (i === undefined) {                                       // full: reuse the longest unseen
        let worst = null;
        for (const [k, v] of slots) if (!worst || v.seen < worst[1].seen) worst = [k, v];
        slots.delete(worst[0]);
        i = worst[1].slot;
      }
      drawSheet(i, look, GUNS.has(look.hand) ? ARMED : STREET);
      s = { slot: i, seen: 0, full: false };
      slots.set(key, s);
      sheetMs += performance.now() - t0;
    }
    s.seen = frameNo;
    return s;
  }
  function drawSheet(i, look, names = FRAMES) {
    const d = new Uint8Array(SW * SH * 4), at0 = names.map(n => FRAMES.indexOf(n));   // (all clear but the figure)
    frames(look, names).forEach((facing, j) => facing.forEach((px, n) => {   // (left: right mirrored, drawn once)
      const [ox, oy] = cellAt(at0[n], j);
      px.forEach((row, y) => row.forEach((c, x) => {
        if (c === null) return;
        const p = ((oy + y) * SW + ox + x) * 4;
        d[p] = (c >> 16) & 255; d[p + 1] = (c >> 8) & 255; d[p + 2] = c & 255; d[p + 3] = 255;
      }));
    }));
    renderer.copyTextureToTexture(new THREE.DataTexture(d, SW, SH), atlas, null, at.set((i % COLS) * SW, Math.floor(i / COLS) * SH));
  }

  // The card: column 11 over the feet, the bottom on the ground (as src/art/sprites.js spritePerson).
  const geo = new THREE.PlaneGeometry(CW / PX_PER_M, CH / PX_PER_M);
  geo.translate(0.5 / PX_PER_M, CH / PX_PER_M / 2, 0);
  const aCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PEOPLE * 2), 2);
  const aTint = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PEOPLE * 3), 3);
  geo.setAttribute('aCell', aCell);
  geo.setAttribute('aTint', aTint);
  const material = new THREE.ShaderMaterial({
    uniforms: { atlas: { value: atlas }, cell: { value: new THREE.Vector2(CW, CH) }, size: { value: ATLAS_PX } },
    vertexShader: `
      attribute vec2 aCell; attribute vec3 aTint;
      uniform vec2 cell; uniform float size;
      varying vec2 vUv; varying vec3 vTint;
      void main() {
        // aCell is the frame's top-left in atlas pixels (y down), as the atlas's rows are stored.
        vec2 px = aCell + vec2(uv.x, 1.0 - uv.y) * cell;
        vUv = px / size;
        vTint = aTint;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D atlas;
      varying vec2 vUv; varying vec3 vTint;
      void main() {
        vec4 c = texture2D(atlas, vUv);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(c.rgb * vTint, 1.0);
      }`,
  });
  const cards = new THREE.InstancedMesh(geo, material, MAX_PEOPLE);
  // (sprites bring their own outline; but in the outline pass's ID buffer they're there, cut to their shape and
  // all one part, so nothing behind a person is outlined across them: a building's sill drew a line through heads)
  cards.userData.idMaterial = new THREE.ShaderMaterial({ uniforms: material.uniforms, vertexShader: material.vertexShader, fragmentShader: `
      uniform sampler2D atlas;
      varying vec2 vUv;
      void main() {
        if (texture2D(atlas, vUv).a < 0.5) discard;
        gl_FragColor = vec4(0.53, 0.02, 0.91, 1.0);
      }` });
  cards.frustumCulled = false;
  const blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2).scale(1, 1, 0.6),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.4, depthWrite: false }), MAX_PEOPLE);
  blobs.userData.noId = true;
  blobs.frustumCulled = false;

  // The flashes: every one there can be (each gun, facing and fire frame: sprites.js flashOf()) in a strip of FS
  // × FS cells, each its pixels from the cell's top-left; one card per flash at the muzzle, its colour as it is
  // (no light's tint: it's the light), drawn after the people (renderOrder) and a little toward the camera, or
  // away from it behind the head. Out of the outline pass and the depth, so it's inked by nothing.
  const FLASH_KEYS = [...GUNS].flatMap(g => DIRS.flatMap(d => GUN_FRAMES.filter(f => flashOf(g, d, f)).map(f => `${g}|${d}|${f}`)));
  const FS = Math.max(...FLASH_KEYS.map(k => { const o = flashOf(...k.split('|')); return Math.max(o.px.length, o.px[0].length); }));
  const flashSlot = new Map(FLASH_KEYS.map((k, n) => [k, n]));
  const fd = new Uint8Array(FS * FLASH_KEYS.length * FS * 4);
  FLASH_KEYS.forEach((k, n) => flashOf(...k.split('|')).px.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    const p = (y * FS * FLASH_KEYS.length + n * FS + x) * 4;
    fd[p] = (c >> 16) & 255; fd[p + 1] = (c >> 8) & 255; fd[p + 2] = c & 255; fd[p + 3] = 255;
  })));
  const flashTex = new THREE.DataTexture(fd, FS * FLASH_KEYS.length, FS);
  flashTex.magFilter = flashTex.minFilter = THREE.NearestFilter;
  flashTex.generateMipmaps = false;
  flashTex.colorSpace = THREE.SRGBColorSpace;
  flashTex.flipY = false;
  flashTex.needsUpdate = true;
  const fgeo = new THREE.PlaneGeometry(FS / PX_PER_M, FS / PX_PER_M);
  const aSlot = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLASHES), 1);
  fgeo.setAttribute('aSlot', aSlot);
  const flashes = new THREE.InstancedMesh(fgeo, new THREE.ShaderMaterial({
    uniforms: { map: { value: flashTex }, size: { value: new THREE.Vector2(FS * FLASH_KEYS.length, FS) } },
    vertexShader: `
      attribute float aSlot; uniform vec2 size;
      varying vec2 vPx;
      void main() {
        vPx = vec2(aSlot * size.y + uv.x * size.y, (1.0 - uv.y) * size.y);   // (in the strip's pixels; its rows stored top-down)
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    // (a screen pixel's centre can fall right on a texel's edge, as the cards' grid lies across the screen's: there,
    // take the texel the edge begins, not whichever the rounding gives, or a flash far along the strip comes out
    // smeared, columns doubled and lost; in a texel's middle, that texel)
    fragmentShader: `
      uniform sampler2D map; uniform vec2 size;
      varying vec2 vPx;
      void main() {
        vec2 f = fract(vPx), k = mix(floor(vPx), floor(vPx + 0.5), step(0.25, abs(f - 0.5)));
        vec4 c = texture2D(map, (k + 0.5) / size);
        if (c.a < 0.5) discard;
        gl_FragColor = vec4(c.rgb, 1.0);
      }`,
    depthWrite: false,
  }), MAX_FLASHES);
  flashes.userData.noId = true;
  flashes.frustumCulled = false;
  flashes.renderOrder = 2;
  flashes.count = 0;
  const TOWARD = new THREE.Vector3(0, Math.SQRT1_2, Math.SQRT1_2).multiplyScalar(0.15);   // (along the camera's line: the picture doesn't move)
  scene.add(cards, blobs, flashes);

  const m4 = new THREE.Matrix4();
  /**
   * Draw these people: [{ key, look, x, z, face, gait, stride, phase, t?, tint: [r, g, b], own?, frame?, flash? }],
   * at time t (seconds, for idling; a person's own t holds them still, as a memory). Positions are where to
   * draw (the view interpolates between ticks). frame: a gun's (gunPose()), over the gait's; flash: its muzzle alight.
   */
  function update(people, t) {
    frameNo++; fresh = 0; sheetMs = 0;
    let i = 0, nf = 0;
    for (const p of people) {
      if (i >= MAX_PEOPLE) break;
      const s = slotOf(p.key, p.look, p.own);
      if (!s) continue;                                              // (a frame or two on)
      const armed = GUNS.has(p.look?.hand);
      const f = armed && GUN.has(p.frame) ? p.frame
        : p.gait === 'walk' ? `walk${Math.floor(p.stride / STEP_M.walk) % 4}`
        : p.gait === 'run' ? `run${Math.floor(p.stride / STEP_M.run) % 4}`
        : p.gait === 'sit' || p.gait === 'crouch' ? 'sit' : p.gait === 'phone' || p.gait === 'hail' ? p.gait : FIGHT.has(p.gait) ? p.gait : p.gait === 'down' ? 'reel' : `idle${((Math.floor((p.t ?? t) * 2 + p.phase) % 2) + 2) % 2}`;   // (game time runs negative before 2026: the Farm's 2007)
      if (!s.full && !ON_STREET.has(f) && !(armed && GUN.has(f))) { drawSheet(s.slot, p.look); s.full = true; }   // (a fight: its frames, now)
      const fk = p.flash && armed && `${p.look.hand}|${p.face}|${f}`, fl = fk && flashSlot.has(fk) && nf < MAX_FLASHES && flashOf(p.look.hand, p.face, f);
      if (fl) {
        // (its top-left pixel over the cell's (fl.x, fl.y): column 13 of the cell is over the feet, as the card's geometry puts it)
        m4.makeTranslation(snap(p.x) + (fl.x - 13 + (FS - 1) / 2) / PX_PER_M, (CH - fl.y - 0.5 - (FS - 1) / 2) / PX_PER_M, snap(p.z));
        const k = fl.behind ? -1 : 1;
        m4.elements[12] += TOWARD.x * k; m4.elements[13] += TOWARD.y * k; m4.elements[14] += TOWARD.z * k;
        flashes.setMatrixAt(nf, m4);
        aSlot.setX(nf, flashSlot.get(fk));
        nf++;
      }
      const slot = s.slot, sit = p.gait === 'sit';                  // (a crouch is the same pose, on the ground)
      if (p.gait === 'down') {                                      // (on their back, the head away from whoever they faced)
        const s = p.face === 'left' ? -1 : 1;
        m4.makeRotationZ(s * Math.PI / 2).setPosition(snap(p.x + s * DOWN.x), DOWN.y, snap(p.z));
      } else m4.makeTranslation(snap(p.x), sit ? SEAT.y : 0, snap(p.z + (sit ? SEAT.z : 0)));
      cards.setMatrixAt(i, m4);
      m4.makeTranslation(snap(p.x), 0.02, snap(p.z));
      blobs.setMatrixAt(i, m4);
      // (a frame or facing it doesn't know stands still, facing us: never the cell next door, another person's)
      const [ox, oy] = cellAt(Math.max(0, FRAMES.indexOf(f)), Math.max(0, DIRS.indexOf(p.face)));
      aCell.setXY(i, (slot % COLS) * SW + ox, Math.floor(slot / COLS) * SH + oy);
      aTint.setXYZ(i, p.tint[0], p.tint[1], p.tint[2]);
      i++;
    }
    cards.count = blobs.count = i;
    flashes.count = nf;
    cards.instanceMatrix.needsUpdate = blobs.instanceMatrix.needsUpdate = flashes.instanceMatrix.needsUpdate = true;
    aCell.needsUpdate = aTint.needsUpdate = aSlot.needsUpdate = true;
  }

  return { update, cards, blobs, flashes, atlas, slots, dispose: () => { flashTex.dispose(); fgeo.dispose(); flashes.material.dispose(); } };
}
