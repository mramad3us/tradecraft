// TRADECRAFT samples: the street every look sample renders, so looks are compared on the same scene.
// The three-storey corner block from the kit (samples/lib/building.js), a cobbled pavement on an
// asphalt street, two street trees and a lamp post (procedural, low-poly), and two people: one walking
// along the pavement (the Mixamo library walk, re-based onto a person on the mixamo rig), one talking
// in a first-floor room (CMU, baked on). Materials are the CC0 texture sets; looks.js may restyle them.
//
// street(stage, opts) builds it into stage.scene and returns { building, people, update(dt), view }.
//   opts.heads     head size (1 as made; 1.5 for a chibi look), by scaling the head bone
//   opts.t         freeze the people at that moment (seconds), else they play
//   opts.walls / opts.storey   the building's cutaway (building.js)
import * as THREE from 'three';
import { loadModel } from './stage.js';
import { building, slab } from './building.js';
import { textured, plain } from './materials.js';
import { rebaseClips, skeletonOf } from './anim.js';

const ROOT = new URL('../../', import.meta.url).href;

/** A street tree: a tapered trunk and a canopy of three low-poly blobs. */
function tree(seed = 1) {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 0.9, name: 'bark' });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x4f6b38, roughness: 0.85, name: 'leaves', flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 7), bark);
  trunk.position.y = 1.3;
  g.add(trunk);
  const r = (k) => 0.5 + 0.5 * Math.sin(seed * 12.9898 + k * 78.233);
  for (let k = 0; k < 3; k++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + 0.35 * r(k), 1), leaves);
    blob.position.set((r(k + 3) - 0.5) * 1.2, 3.0 + r(k + 6) * 0.8, (r(k + 9) - 0.5) * 1.2);
    g.add(blob);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}

/** A street lamp: a dark pole, an arm, a lantern that glows. */
function lamp() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.6, name: 'iron' });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe3a8, emissive: 0xffc870, emissiveIntensity: 1.5, name: 'lantern' });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.2, 8), iron);
  pole.position.y = 2.1;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), iron);
  arm.position.set(0.32, 4.1, 0);
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), glow);
  lantern.position.set(0.62, 3.92, 0);
  g.add(pole, arm, lantern);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}

/** Bigger heads, by the head bone (the skinned mesh follows): 1.5 reads as chibi. */
function headScale(person, s) {
  const sk = skeletonOf(person);
  const head = person.getObjectByName(sk.hips.startsWith('mixamorig') ? 'mixamorigHead' : 'Head');
  if (head && s !== 1) head.scale.setScalar(s);
}

export async function street(stage, { heads = 1, t = null, walls = 'cut', storey = 2 } = {}) {
  const { scene, camera, ground } = stage;
  const brick = textured('polyhaven/red_brick_03', 1.5);
  const plaster = textured('ambientcg/PaintedPlaster017', 2.0, { tint: 0xf1ece2 });
  const mats = {
    facade: brick, interior: plaster, ceiling: plaster, cut: plain(0x2b2d33),
    roof: textured('ambientcg/Concrete034', 3),
    floors: [textured('ambientcg/Tiles074', 1.2), textured('ambientcg/WoodFloor051', 2.0), textured('ambientcg/WoodFloor051', 2.0)],
  };
  ground.material = textured('ambientcg/Asphalt033', 2.5);
  ground.geometry = new THREE.PlaneGeometry(80, 80).toNonIndexed();
  { // world-metre UVs on the ground plane, as the materials expect
    const p = ground.geometry.attributes.position, uv = ground.geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
  }

  const kit = (await loadModel(ROOT + 'assets/kit/kit.glb')).scene;
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

  // The street: a cobbled pavement round the building (a kerb 12 cm high), the asphalt beyond, two
  // trees and a lamp on the pavement.
  const paving = textured('ambientcg/PavingStones138', 1.6);
  scene.add(slab(AT[0] - 3, AT[1] - 3, AT[0] + W + 3, AT[1] + D + 3, 0.12, [paving, paving, plain(0x6d6a64)],
    [{ x0: AT[0], x1: AT[0] + W, z0: AT[1], z1: AT[1] + D }]));
  for (const [x, z, s] of [[-4.2, 6.6, 1], [7.2, -1.5, 2]]) { const tr = tree(s); tr.position.set(x, 0.12, z); scene.add(tr); }
  const lp = lamp(); lp.position.set(1.8, 0.12, 6.9); lp.rotation.y = -Math.PI / 2; scene.add(lp);

  // People: the walker plays the Mixamo library's walk; the upstairs man the CMU conversation.
  const people = [];
  const walker = await loadModel(ROOT + 'samples/004-mixamo/person.glb');
  const lib = await loadModel(ROOT + 'assets/anim/mixamo.glb');
  const [walk] = rebaseClips(lib.scene, lib.animations, walker.scene).filter(c => c.name === 'standard-walk');
  const talker = await loadModel(ROOT + 'samples/001-motion/person.glb');
  for (const [p, clip, pos, rot] of [[walker, walk, [-2.6, 0.12, 6.2], Math.PI / 2],
    [talker, talker.animations.find(c => c.name === '18_08@0-8'), [-2.5, 3.0, 1.2], -2.4]]) {
    headScale(p.scene, heads);
    p.scene.position.set(...pos);
    p.scene.rotation.y = rot;
    scene.add(p.scene);
    const mixer = new THREE.AnimationMixer(p.scene);
    mixer.clipAction(clip).play();
    mixer.setTime(t ?? 0.8);
    people.push({ mixer, node: p.scene, storey: b.storeyAt(pos[1]) });
  }

  const view = { walls, storey };
  b.update(camera, view);
  for (const p of people) p.node.visible = p.storey <= view.storey;   // people upstairs go with their storey
  const update = (dt) => { if (t === null) for (const p of people) p.mixer.update(dt); };
  return { building: b, people, update, view };
}
