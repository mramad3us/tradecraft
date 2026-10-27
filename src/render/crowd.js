// TRADECRAFT render: everyone on the map, in one draw.
//
// Each person's sprite sheet (src/art/sprites.js: 29 frames across, 4 facings down, a 24 × 34 cell)
// goes into a slot of one ATLAS_PX square atlas, the first time their look is seen; a slot whose look
// has gone unseen longest is reused when the atlas is full. Everyone is then one instance of one
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

export const ATLAS_PX = 4096;                                       // (150 people's sheets of 29 frames)
export const MAX_PEOPLE = 160;
export const STEP_M = { walk: 0.16, run: 0.45 };            // (8 frames a second at an ordinary walk, as the samples)
const SEAT = { y: 0.24, z: -0.2 };                                 // a sitter's card: up on the seat, back against it
const DOWN = { y: 0.35, x: 0.9 };                                 // a card laid on its side: lifted off the floor, its middle over the spot
const FIGHT = new Set(FIGHT_FRAMES);
const [CW, CH] = CELL, SW = CW * FRAMES.length, SH = CH * DIRS.length;
const COLS = Math.floor(ATLAS_PX / SW), ROWS = Math.floor(ATLAS_PX / SH);
const INK = 0x14151c;
const snap = (v) => Math.round(v * PX_PER_M) / PX_PER_M;

export function createCrowd(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_PX;
  const g2 = canvas.getContext('2d');
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;
  atlas.colorSpace = THREE.SRGBColorSpace;

  // Slots: look key → { slot, seen }.
  const slots = new Map(), free = Array.from({ length: COLS * ROWS }, (_, i) => i);
  let frameNo = 0, dirty = false;
  function slotOf(key, look) {
    let s = slots.get(key);
    if (!s) {
      let i = free.pop();
      if (i === undefined) {                                       // full: reuse the longest unseen
        let worst = null;
        for (const [k, v] of slots) if (!worst || v.seen < worst[1].seen) worst = [k, v];
        slots.delete(worst[0]);
        i = worst[1].slot;
      }
      drawSheet(i, look);
      s = { slot: i, seen: 0 };
      slots.set(key, s);
    }
    s.seen = frameNo;
    return s.slot;
  }
  function drawSheet(i, look) {
    const ox = (i % COLS) * SW, oy = Math.floor(i / COLS) * SH;
    const img = g2.createImageData(SW, SH), d = img.data;
    frames(look).forEach((facing, j) => facing.forEach((px, k) => {   // (left: right mirrored, drawn once)
      px.forEach((row, y) => row.forEach((c, x) => {
        if (c === null) return;
        const p = ((j * CH + y) * SW + k * CW + x) * 4;
        d[p] = (c >> 16) & 255; d[p + 1] = (c >> 8) & 255; d[p + 2] = c & 255; d[p + 3] = 255;
      }));
    }));
    g2.putImageData(img, ox, oy);
    dirty = true;
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
        // aCell is the frame's top-left in atlas pixels (y down); the texture is flipped (y up).
        vec2 px = aCell + vec2(uv.x, 1.0 - uv.y) * cell;
        vUv = vec2(px.x / size, 1.0 - px.y / size);
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
   * Draw these people: [{ key, look, x, z, face, gait, stride, phase, t?, tint: [r, g, b] }], at time
   * t (seconds, for idling; a person's own t holds them still, as a memory). Positions are where to
   * draw (the view interpolates between ticks).
   */
  function update(people, t) {
    frameNo++;
    const n = Math.min(people.length, MAX_PEOPLE);
    for (let i = 0; i < n; i++) {
      const p = people[i];
      const slot = slotOf(p.key, p.look);
      const f = p.gait === 'walk' ? `walk${Math.floor(p.stride / STEP_M.walk) % 4}`
        : p.gait === 'run' ? `run${Math.floor(p.stride / STEP_M.run) % 4}`
        : p.gait === 'sit' || p.gait === 'crouch' ? 'sit' : FIGHT.has(p.gait) ? p.gait : p.gait === 'down' ? 'reel' : `idle${((Math.floor((p.t ?? t) * 2 + p.phase) % 2) + 2) % 2}`;   // (game time runs negative before 2026: the Farm's 2007)
      const sit = p.gait === 'sit';                                 // (a crouch is the same pose, on the ground)
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
    }
    cards.count = blobs.count = n;
    cards.instanceMatrix.needsUpdate = blobs.instanceMatrix.needsUpdate = true;
    aCell.needsUpdate = aTint.needsUpdate = true;
    if (dirty) { atlas.needsUpdate = true; dirty = false; }
  }

  return { update, cards, blobs, atlas, slots };
}
