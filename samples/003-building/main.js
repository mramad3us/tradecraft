// TRADECRAFT sample 003: a building from the kit. A three-storey corner block assembled at runtime
// (samples/lib/building.js) with windows, doors, a shopfront, balconies and stairs from the Blender
// kit (assets/kit/kit.glb), on a cobbled pavement by an asphalt street; one person walks outside,
// another talks upstairs.
//   ?walls=up|cut|down   the cutaway (default cut: the walls facing the camera drop to stubs)
//   ?storey=0|1|2        the highest storey shown (default the top)
//   ?t=<s>               freeze the people at that moment
import { createStage, loadModel, params, ready } from '../lib/stage.js';
import { building, slab } from '../lib/building.js';
import { textured, plain, loaded } from '../lib/materials.js';

const { THREE, renderer, scene, camera, sun, ground, follow } = createStage({ background: 0x15171c, groundSize: 80 });
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const brick = textured('polyhaven/red_brick_03', 1.5);
const plaster = textured('ambientcg/PaintedPlaster017', 2.0, { tint: 0xf1ece2 });
const mats = {
  facade: brick,
  interior: plaster,
  ceiling: plaster,
  cut: plain(0x2b2d33),
  roof: textured('ambientcg/Concrete034', 3),
  floors: [textured('ambientcg/Tiles074', 1.2), textured('ambientcg/WoodFloor051', 2.0), textured('ambientcg/WoodFloor051', 2.0)],
};
ground.material = textured('ambientcg/Asphalt033', 2.5);
ground.geometry = new THREE.PlaneGeometry(80, 80).toNonIndexed();
{ // world-metre UVs on the ground plane, as the materials expect
  const p = ground.geometry.attributes.position, uv = ground.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
}

const kit = (await loadModel('../../assets/kit/kit.glb')).scene;

const W = 11, D = 9, AT = [-5.5, -4.5];
const spec = {
  at: AT, size: [W, D], storeys: 3, height: 3.0,
  openings: [
    // the shop: two shopfronts and the entrance on the street (s), a shopfront round the corner (e)
    { side: 's', storey: 0, at: 2.6, piece: 'shopfront' },
    { side: 's', storey: 0, at: 6.4, piece: 'shopfront' },
    { side: 's', storey: 0, at: 9.6, piece: 'door_entrance' },
    { side: 'e', storey: 0, at: 3.0, piece: 'shopfront' },
    { side: 'e', storey: 0, at: 7.0, piece: 'window_casement' },
    { side: 'n', storey: 0, at: 2.5, piece: 'door_flat' },
    { side: 'n', storey: 0, at: 6.5, piece: 'window_casement' },
    { side: 'w', storey: 0, at: 4.5, piece: 'window_casement' },
    // the flats: casements all round, tall windows with balconies over the street
    ...[1, 2].flatMap(k => [
      { side: 's', storey: k, at: 1.6, piece: 'window_casement' },
      { side: 's', storey: k, at: 4.2, piece: 'window_tall' },
      { side: 's', storey: k, at: 4.2, piece: 'balcony' },
      { side: 's', storey: k, at: 6.8, piece: 'window_tall' },
      { side: 's', storey: k, at: 6.8, piece: 'balcony' },
      { side: 's', storey: k, at: 9.4, piece: 'window_casement' },
      { side: 'e', storey: k, at: 2.0, piece: 'window_casement' },
      { side: 'e', storey: k, at: 4.5, piece: 'window_casement' },
      { side: 'e', storey: k, at: 7.0, piece: 'window_casement' },
      { side: 'n', storey: k, at: 2.0, piece: 'window_casement' },
      { side: 'n', storey: k, at: 5.5, piece: 'window_casement' },
      { side: 'n', storey: k, at: 9.0, piece: 'window_casement' },
      { side: 'w', storey: k, at: 2.5, piece: 'window_casement' },
      { side: 'w', storey: k, at: 6.5, piece: 'window_casement' },
    ]),
  ],
  partitions: [
    { storey: 0, from: [0.125, 6.3], to: [8.6, 6.3], doors: [{ at: 4.5 }] },
    { storey: 0, from: [8.6, 0.125], to: [8.6, 8.875], doors: [{ at: 1.6 }] },
    ...[1, 2].flatMap(k => [
      { storey: k, from: [8.6, 0.125], to: [8.6, 8.875], doors: [{ at: 6.0 }] },
      { storey: k, from: [0.125, 4.4], to: [8.6, 4.4], doors: [{ at: 3.0 }] },
      { storey: k, from: [4.6, 4.4], to: [4.6, 8.875], doors: [{ at: 1.5 }] },
    ]),
  ],
  stairs: [{ storey: 0, at: [9.8, 7.6], dir: 'n' }, { storey: 1, at: [9.8, 7.6], dir: 'n' }],
  materials: mats,
};
const b = building(kit, spec);
scene.add(b.group);

// The street: a cobbled pavement round the building (a kerb 12 cm high), the asphalt beyond.
const paving = textured('ambientcg/PavingStones138', 1.6);
scene.add(slab(AT[0] - 3, AT[1] - 3, AT[0] + W + 3, AT[1] + D + 3, 0.12, [paving, paving, plain(0x6d6a64)],
  [{ x0: AT[0], x1: AT[0] + W, z0: AT[1], z1: AT[1] + D }]));

// People: one walking along the pavement, one talking in a first-floor room.
const t = Number(params.get('t') || 0.8);
const people = [];
for (const [clip, pos, rot] of [['07_01', [-3, 0.12, 6.0], Math.PI / 2], ['18_08@0-8', [-2.5, 3.0, 1.2], -2.4]]) {
  const p = await loadModel('../001-motion/person.glb');
  p.scene.position.set(...pos);
  p.scene.rotation.y = rot;
  scene.add(p.scene);
  const mixer = new THREE.AnimationMixer(p.scene);
  mixer.clipAction(p.animations.find(c => c.name === clip)).play();
  mixer.setTime(t);
  people.push({ mixer, node: p.scene, storey: b.storeyAt(pos[1]) });
}

// The camera: the iso angle, pulled back to frame the block.
camera.position.set(19, 21, 22);
camera.lookAt(0, 2.5, 0);
sun.position.set(-8, 18, 10);
sun.target.position.set(0, 0, 0);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 60 });
sun.shadow.camera.updateProjectionMatrix();
scene.environmentIntensity = 0.0;

const view = { walls: params.get('walls') || 'cut', storey: Number(params.get('storey') ?? 2) };
b.update(camera, view);
for (const p of people) p.node.visible = p.storey <= view.storey;   // people upstairs go with their storey
await loaded(() => renderer.render(scene, camera));
renderer.render(scene, camera);
ready();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!params.has('t')) { const dt = clock.getDelta(); for (const p of people) p.mixer.update(dt); }
  renderer.render(scene, camera);
});
