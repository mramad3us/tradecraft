// TRADECRAFT render: blood on the ground (sim/blood.js state.decals), pixel by pixel.
//
// Each decal is a handful of pixels, a PX_PER_M-th of a metre each, laid flat on the floor: a spatter
// flung the way the blow went (thinning with distance, a few big drops near, fine ones far), a drip a
// pixel or two. Their places and shades come from the decal's seed, so a spatter is the same every
// frame and after a load. One instanced draw for all of them (MAX_PIXELS), darker as it dries.
import * as THREE from 'three';
import { PX_PER_M } from '../art/pixelart.js';

export const MAX_PIXELS = 2400;
const SHADES = [0xc95c45, 0x9e3c36, 0x9e3c36, 0x6e2a2e, 0x6e2a2e];   // (fresh to dry: darker reds snap to the palette's purples)
const DRY_MS = 30 * 60 * 1000;                                     // (half an hour: dark as it'll get)

function* pixels(d) {
  let s = d.seed >>> 0 || 1;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < d.n; i++) {
    const far = d.dx ? Math.pow(r(), 1.6) * (0.25 + d.n * 0.04) : r() * 0.08;   // (flung: most near, a few far)
    const x = d.x + d.dx * far + (r() - 0.5) * (0.12 + far * 0.5), z = d.z + (r() - 0.5) * (0.1 + far * 0.35);
    const big = !d.dx || far < 0.2 ? r() < 0.5 : r() < 0.15;
    yield { x, z, big, shade: Math.floor(r() * 3) };
  }
}

export function createBlood(scene) {
  const P = 1 / PX_PER_M;
  const geo = new THREE.PlaneGeometry(P, P).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });     // (a few cm over the floor: it needs no offset, and its depth hurts no outline)
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_PIXELS);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PIXELS * 3), 3);   // (there from the start: the shader is built with it)
  mesh.userData.noId = true;
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  let key = '';
  /** Draw the decals on this row (redrawn only when they change). */
  function update(state) {
    const list = (state.decals ?? []).filter(d => d.row === (state.map.row ?? 0));
    const k = `${list.length}:${list.at(-1)?.seed ?? 0}:${Math.floor(state.time.ms / 60000)}`;
    if (k === key) return;
    key = k;
    let n = 0;
    for (const d of list) {
      const dry = Math.min(1, (state.time.ms - d.ms) / DRY_MS);
      for (const px of pixels(d)) {
        for (const [ox, oz] of px.big ? [[0, 0], [P, 0]] : [[0, 0]]) {
          if (n >= MAX_PIXELS) break;
          m4.makeTranslation(Math.round((px.x + ox) * PX_PER_M) * P, 0.035, Math.round((px.z + oz) * PX_PER_M) * P);   // (over a mat, a line on it)
          mesh.setMatrixAt(n, m4);
          mesh.setColorAt(n, c.setHex(SHADES[Math.min(SHADES.length - 1, px.shade + Math.round(dry * 2))]));
          n++;
        }
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return { update, mesh };
}
