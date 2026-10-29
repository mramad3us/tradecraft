// TRADECRAFT render: everyone on the map, in one draw.
//
// Each person's sprite sheet (src/art/sprites.js: 31 frames across, 4 facings down, a 28 × 34 cell)
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
import * as THREE from 'three';
import { frames, CELL, FRAMES, DIRS, FIGHT_FRAMES } from '../art/sprites.js';
import { PX_PER_M } from '../art/pixelart.js';

export const ATLAS_PX = 4096;                                       // (120 people's sheets of 31 frames)
export const SHEETS_PER_FRAME = 2;
// (the frames of the street, painted with a new face; a fight's, the first time they fight)
export const STREET = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'run0', 'run1', 'run2', 'run3', 'sit', 'reel', 'hail', 'phone'];
const ON_STREET = new Set(STREET);                                  // (new faces painted a frame: a turn brings several into sight at once; the rest a frame or two on, still coming out of the dark)
export const MAX_PEOPLE = 160;
export const STEP_M = { walk: 0.16, run: 0.45 };            // (8 frames a second at an ordinary walk, as the samples)
const SEAT = { y: 0.24, z: -0.2 };                                 // a sitter's card: up on the seat, back against it
const DOWN = { y: 0.35, x: 0.9 };                                 // a card laid on its side: lifted off the floor, its middle over the spot
const FIGHT = new Set(FIGHT_FRAMES);
const [CW, CH] = CELL, SW = CW * FRAMES.length, SH = CH * DIRS.length;
const COLS = Math.floor(ATLAS_PX / SW), ROWS = Math.floor(ATLAS_PX / SH);
const INK = 0x14151c;
const snap = (v) => Math.round(v * PX_PER_M) / PX_PER_M;

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
  let frameNo = 0, fresh = 0;
  /** A look's slot ({ slot, full }; painted now if it's new), or null: too many new this frame (own: yours, never put off). */
  function slotOf(key, look, own = false) {
    let s = slots.get(key);
    if (!s) {
      if (fresh >= SHEETS_PER_FRAME && !own) return null;
      fresh++;
      let i = free.pop();
      if (i === undefined) {                                       // full: reuse the longest unseen
        let worst = null;
        for (const [k, v] of slots) if (!worst || v.seen < worst[1].seen) worst = [k, v];
        slots.delete(worst[0]);
        i = worst[1].slot;
      }
      drawSheet(i, look, STREET);
      s = { slot: i, seen: 0, full: false };
      slots.set(key, s);
    }
    s.seen = frameNo;
    return s;
  }
  function drawSheet(i, look, names = FRAMES) {
    const d = new Uint8Array(SW * SH * 4), at0 = names.map(n => FRAMES.indexOf(n));   // (all clear but the figure)
    frames(look, names).forEach((facing, j) => facing.forEach((px, n) => {   // (left: right mirrored, drawn once)
      const k = at0[n];
      px.forEach((row, y) => row.forEach((c, x) => {
        if (c === null) return;
        const p = ((j * CH + y) * SW + k * CW + x) * 4;
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
  scene.add(cards, blobs);

  const m4 = new THREE.Matrix4();
  /**
   * Draw these people: [{ key, look, x, z, face, gait, stride, phase, t?, tint: [r, g, b], own? }], at time
   * t (seconds, for idling; a person's own t holds them still, as a memory). Positions are where to
   * draw (the view interpolates between ticks).
   */
  function update(people, t) {
    frameNo++; fresh = 0;
    let i = 0;
    for (const p of people) {
      if (i >= MAX_PEOPLE) break;
      const s = slotOf(p.key, p.look, p.own);
      if (!s) continue;                                              // (a frame or two on)
      const f = p.gait === 'walk' ? `walk${Math.floor(p.stride / STEP_M.walk) % 4}`
        : p.gait === 'run' ? `run${Math.floor(p.stride / STEP_M.run) % 4}`
        : p.gait === 'sit' || p.gait === 'crouch' ? 'sit' : p.gait === 'phone' || p.gait === 'hail' ? p.gait : FIGHT.has(p.gait) ? p.gait : p.gait === 'down' ? 'reel' : `idle${((Math.floor((p.t ?? t) * 2 + p.phase) % 2) + 2) % 2}`;   // (game time runs negative before 2026: the Farm's 2007)
      if (!s.full && !ON_STREET.has(f)) { drawSheet(s.slot, p.look); s.full = true; }   // (a fight: its frames, now)
      const slot = s.slot, sit = p.gait === 'sit';                  // (a crouch is the same pose, on the ground)
      if (p.gait === 'down') {                                      // (on their back, the head away from whoever they faced)
        const s = p.face === 'left' ? -1 : 1;
        m4.makeRotationZ(s * Math.PI / 2).setPosition(snap(p.x + s * DOWN.x), DOWN.y, snap(p.z));
      } else m4.makeTranslation(snap(p.x), sit ? SEAT.y : 0, snap(p.z + (sit ? SEAT.z : 0)));
      cards.setMatrixAt(i, m4);
      m4.makeTranslation(snap(p.x), 0.02, snap(p.z));
      blobs.setMatrixAt(i, m4);
      // (a frame or facing it doesn't know stands still, facing us: never the cell next door, another person's)
      const fi = Math.max(0, FRAMES.indexOf(f)), di = Math.max(0, DIRS.indexOf(p.face));
      aCell.setXY(i, (slot % COLS) * SW + fi * CW, Math.floor(slot / COLS) * SH + di * CH);
      aTint.setXYZ(i, p.tint[0], p.tint[1], p.tint[2]);
      i++;
    }
    cards.count = blobs.count = i;
    cards.instanceMatrix.needsUpdate = blobs.instanceMatrix.needsUpdate = true;
    aCell.needsUpdate = aTint.needsUpdate = true;
  }

  return { update, cards, blobs, atlas, slots };
}
