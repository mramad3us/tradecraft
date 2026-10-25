// TRADECRAFT sample 002: the CC0 libraries, checked in the renderer. What tools/fetch-asset.mjs
// brought in: an ambientCG asphalt on the ground, a Poly Haven brick wall, a Poly Haven armchair,
// and a Poly Haven night street as the light (its HDR as the environment); the person from
// sample 001 walks past. Textures tile at their real size: TILE_M metres per repeat.
import { createStage, loadModel, params, ready } from '../lib/stage.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const { THREE, renderer, scene, camera, sun, ground, follow } = createStage({ background: 0x0e1014 });
const lib = '../../assets/lib/';
const tex = new THREE.TextureLoader();
const loading = [];

/** A PBR material from a fetched texture set; `tile` metres per repeat over a surface `w` × `h` m. */
function pbr(base, res, w, h, tile) {
  const load = (map, srgb) => {
    const t = tex.load(`${base}_${map}_${res}.jpg`);
    loading.push(new Promise((ok, fail) => { t.onUpdate = ok; setTimeout(() => fail(new Error('texture timeout ' + map)), 20000); }));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / tile, h / tile);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return new THREE.MeshStandardMaterial({
    map: load('diff', true), normalMap: load('nor_gl'), roughnessMap: load('rough'), aoMap: load('ao'),
  });
}

ground.material = pbr(lib + 'ambientcg/Asphalt033/Asphalt033', '1K', 40, 40, 2);

const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 0.3), pbr(lib + 'polyhaven/red_brick_03/red_brick_03', '1k', 8, 3.2, 1.5));
wall.position.set(0, 1.6, -2.2);
wall.castShadow = wall.receiveShadow = true;
scene.add(wall);

const hdr = await new HDRLoader().loadAsync(lib + 'polyhaven/cobblestone_street_night/cobblestone_street_night_1k.hdr');
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr;
scene.environmentIntensity = Number(params.get('env') || 0.6);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
sun.intensity = 0.8;                                  // a street lamp's worth, not daylight
sun.color.set(0xffc98a);

const chair = (await loadModel(lib + 'polyhaven/modern_arm_chair_01/modern_arm_chair_01.glb')).scene;
chair.position.set(1.6, 0, -1.2);
chair.rotation.y = -0.6;
scene.add(chair);

const person = await loadModel('../001-motion/person.glb');
scene.add(person.scene);
const mixer = new THREE.AnimationMixer(person.scene);
mixer.clipAction(person.animations.find(c => c.name === '07_01')).play();
mixer.setTime(Number(params.get('t') || 0.6));
follow(new THREE.Vector3(0.3, 0.9, -0.8));

// Textures upload on first use: draw, wait until every one has reached the GPU, draw again.
renderer.render(scene, camera);
await Promise.all(loading);
renderer.render(scene, camera);
ready();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
