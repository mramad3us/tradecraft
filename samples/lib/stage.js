// TRADECRAFT samples: the stage every sample shares. A WebGL renderer, a scene, the iso-style camera
// (high, ~35° down, narrow field of view: perspective, not orthographic), a sun with shadows, sky
// fill, a ground, and a loader for the people and kits made by the tools (glTF, meshopt-compressed).
//
// The page contract the tools rely on (tools/shot.mjs): window.__renderer names the GPU, and
// window.__ready turns true once the sample has drawn what it wants seen. ?cam=px,py,pz,tx,ty,tz
// overrides the camera (from, to).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const params = new URLSearchParams(location.search);

export function createStage({ background = 0x1b1d22, groundSize = 40, grid = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'webgl';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(20, innerWidth / innerHeight, 0.1, 400);
  const iso = new THREE.Vector3(9, 8.5, 9);          // the offset from what the camera looks at
  const look = (target) => { camera.position.copy(target).add(iso); camera.lookAt(target); };
  look(new THREE.Vector3(0, 0.9, 0));
  const cam = params.get('cam')?.split(',').map(Number);
  const fixed = cam?.length === 6;
  if (fixed) { camera.position.set(cam[0], cam[1], cam[2]); camera.lookAt(cam[3], cam[4], cam[5]); }

  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x2a2420, 0.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(-6, 12, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({ color: 0x5a5a58, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  if (grid) {
    const g = new THREE.GridHelper(groundSize, groundSize, 0x777770, 0x66665f);
    g.position.y = 0.002;
    scene.add(g);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // The sun and its shadow box follow a point (a walking person) so shadows stay sharp near it.
  const follow = (target) => {
    if (!fixed) look(target);
    sun.position.copy(target).add(new THREE.Vector3(-6, 12, 4));
    sun.target.position.copy(target);
  };

  return { THREE, renderer, scene, camera, sun, ground, follow, fixed };
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** Load a glTF made by the tools: shadows on, cut-out materials soft-edged through MSAA. */
export async function loadModel(url) {
  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;           // skinned: the bind-pose bounds don't follow the motion
    if (o.material.alphaTest > 0) o.material.alphaToCoverage = true;
  });
  return gltf;
}

/** Tell the tools the sample is drawn (after one more frame, so the canvas holds it). */
export function ready() {
  requestAnimationFrame(() => { window.__ready = true; });
}
