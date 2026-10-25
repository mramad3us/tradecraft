// TRADECRAFT sample 000: the toolchain check. A person made by tools/blender/person.py (MPFB,
// exported as glTF) stands on a ground plane under an iso camera; the page says when it has drawn.
// Without the model it draws a box in its place, so the renderer can be checked on its own.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
window.__renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'webgl';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1d22);

// Iso-style camera: high, looking down at ~35°, narrow field of view (perspective, not orthographic).
const camera = new THREE.PerspectiveCamera(20, innerWidth / innerHeight, 0.1, 200);
camera.position.set(9, 8.5, 9);
camera.lookAt(0, 0.9, 0);
// ?cam=px,py,pz,tx,ty,tz aims the camera anywhere (from, to), for close looks at faces and hands.
const cam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
if (cam?.length === 6) { camera.position.set(cam[0], cam[1], cam[2]); camera.lookAt(cam[3], cam[4], cam[5]); }

scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x2a2420, 0.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(-4, 8, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x5a5a58, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const done = () => { renderer.render(scene, camera); requestAnimationFrame(() => { window.__ready = true; }); };
const url = new URLSearchParams(location.search).get('model') || './person.glb';
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, gltf => {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // Cut-out materials (hair, brows, lashes) get soft edges from MSAA instead of a hard alpha test.
    if (o.material.alphaTest > 0) o.material.alphaToCoverage = true;
  });
  scene.add(gltf.scene);
  window.__model = { meshes: 0, bones: 0 };
  gltf.scene.traverse(o => { if (o.isMesh) window.__model.meshes++; if (o.isBone) window.__model.bones++; });
  done();
}, undefined, () => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a6d4f }));
  box.position.y = 0.9; box.castShadow = true;
  scene.add(box);
  done();
});
