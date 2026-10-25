// TRADECRAFT samples: chibi people for the pixel-art look (samples/lib/pixelart.js).
//
// A person is a handful of boxes measured in whole pixels (P = 1/16 m), drawn to the proportions of
// a handheld RPG sprite: 29 px tall, a head of 15 × 13 (45% of the height), a body of 9 × 8, arms of
// 3 × 7 ending at the hips, stubby legs of 7 and 2-px boots; a coat or a dress hides the legs. The
// face isn't modelled: it's painted on the head's front, a pixel a texel (brows, 1 × 2 eyes, a nose,
// a mouth, a moustache, a beard, glasses), and so is a profile on each side and the hair at the back.
// The torso's front is painted too (a shirt and tie, lapels, a belt, buttons, a badge). Every piece
// is its own part() for the outline pass, so hat, hair, head, body, arms and legs each get their dark
// edge where they overlap.
//
// Seen from 45° above, a head as deep as it is wide would show as much top as face; sprites are drawn
// nearly front-on. So the person is squashed to DEPTH in world z (root.scale.z) outside its turn
// (turn.rotation.y): whichever way it faces, its tops show at DEPTH of their size.
//
// Variety is parameters, chibi(spec): skin (light | tan | brown | dark), hair { style: short | long |
// bun | bald, color }, beard, moustache, glasses (shades | specs), hat { kind: fedora | cap | beanie |
// peaked, color }, top { kind: suit | coat | tee | sweater | dress | uniform, color, tie, trim },
// legs, shoes, carry (briefcase | paper). A crowd of different people costs nothing.
//
// Animation is posed in code and stepped like sprites (FPS frames a second): idle (a one-pixel
// breath), walk (four frames: contact, pass, contact, pass), run (longer swings, a lean), sit, crouch.
// person.pose(state, t) sets it; place person.root, turn person.turn.
import * as THREE from 'three';
import { mat, paint, roundedBox, box, part } from './pixelart.js';

export const FPS = 8;
export const DEPTH = 0.45;
const P = 1 / 16;

export const SKIN = { light: 0xedc39c, tan: 0xc48a62, brown: 0x8c5a3f, dark: 0x5e3a2a };
const SHADE = { light: 0xc48a62, tan: 0x8c5a3f, brown: 0x5e3a2a, dark: 0x47302a };
const INK = 0x14151c;

// Sizes, in pixels.
const HEAD = [15, 13, 12], TORSO = [9, 8, 7], ARM = [3, 7, 3], LEG = [3, 7, 3], SHOE = [4, 2, 5];
const HIP = 7, NECK = 15;

function colours(s) {
  const skin = SKIN[s.skin] ?? s.skin ?? SKIN.light;
  return { skin, shade: SHADE[s.skin] ?? 0xc48a62, hair: s.hair?.color ?? 0x2a1c18, top: s.top?.color ?? 0x3b6296,
    beard: s.beard === true ? (s.hair?.color ?? 0x2a1c18) : s.beard };
}

// The face, 15 × 13, rows from the top; a hair cap hides rows 0-2.
function face(s, c) {
  return paint(HEAD[0], HEAD[1], (px, w, h) => {
    px(0, 0, w, h, c.skin);
    px(0, h - 1, w, 1, c.shade);                                 // under the chin
    if ((s.hair?.style ?? 'short') !== 'bald') px(0, 0, w, 4, c.hair);
    if (s.hair?.style === 'long') { px(0, 4, 2, 6, c.hair); px(w - 2, 4, 2, 6, c.hair); }
    if (c.beard !== undefined) {                                 // a beard: cheeks, jaw and chin
      px(1, 8, 2, 5, c.beard); px(w - 3, 8, 2, 5, c.beard); px(2, 10, w - 4, 3, c.beard);
      px(6, 10, 3, 1, c.shade);                                  // the mouth, in it
    } else {
      px(6, 10, 3, 1, c.shade);
    }
    if (s.moustache || c.beard !== undefined) { px(4, 9, 7, 1, c.beard ?? c.hair); px(4, 10, 1, 1, c.beard ?? c.hair); px(10, 10, 1, 1, c.beard ?? c.hair); }
    px(7, 7, 1, 2, c.shade);                                     // the nose
    if (s.glasses === 'shades') {
      px(2, 5, 5, 2, INK); px(8, 5, 5, 2, INK); px(7, 5, 1, 1, INK);
      px(3, 5, 1, 1, 0x6a7182); px(9, 5, 1, 1, 0x6a7182);        // a glint
    } else {
      px(3, 4, 3, 1, c.hair); px(9, 4, 3, 1, c.hair);            // brows
      px(4, 5, 1, 2, INK); px(10, 5, 1, 2, INK);                 // eyes
      if (s.glasses === 'specs') { px(2, 5, 1, 2, 0x8f96a6); px(6, 5, 3, 1, 0x8f96a6); px(12, 5, 1, 2, 0x8f96a6); px(3, 7, 3, 1, 0x8f96a6); px(9, 7, 3, 1, 0x8f96a6); }
    }
  });
}

// A profile, 12 × 13, the face's front at the right; mirrored for the other side.
function profile(s, c, mirror) {
  return paint(HEAD[2], HEAD[1], (px0, w, h) => {
    const px = mirror ? (x, y, ww = 1, hh = 1, col) => px0(w - x - ww, y, ww, hh, col) : px0;
    px(0, 0, w, h, c.skin);
    px(0, h - 1, w, 1, c.shade);
    const bald = (s.hair?.style ?? 'short') === 'bald';
    if (!bald) { px(0, 0, w, 3, c.hair); px(0, 3, 4, s.hair?.style === 'long' ? 10 : 5, c.hair); }
    else px(0, 5, 4, 4, c.hair);                                 // a fringe of hair round the back
    px(5, 6, 2, 3, c.shade); px(5, 6, 1, 1, c.skin);            // the ear
    if (s.glasses === 'shades') px(8, 5, 4, 2, INK);
    else { px(8, 4, 3, 1, c.hair); px(9, 5, 1, 2, INK); if (s.glasses === 'specs') px(7, 5, 5, 1, 0x8f96a6); }
    if (c.beard !== undefined) px(6, 8, 6, 5, c.beard);
    else if (s.moustache) px(9, 9, 3, 1, c.hair);
    px(10, 10, 2, 1, c.shade);                                   // the mouth's corner
  });
}

function back(s, c) {
  return paint(HEAD[0], HEAD[1], (px, w, h) => {
    if ((s.hair?.style ?? 'short') === 'bald') { px(0, 0, w, h, c.skin); px(0, 5, w, 4, c.hair); px(0, h - 1, w, 1, c.shade); }
    else { px(0, 0, w, h, c.hair); px(0, h - 1, w, 1, c.skin); }
  });
}

// The torso's front, 9 wide × its height.
function chest(s, c, h) {
  const k = s.top?.kind ?? 'tee', w = TORSO[0], mid = 4;
  const dark = s.top?.trim ?? INK;
  return paint(w, h, (px) => {
    px(0, 0, w, h, c.top);
    switch (k) {
      case 'suit':                                               // a white shirt in a V, the tie, lapels
        px(mid - 2, 0, 5, 1, 0xf6f4ee); px(mid - 1, 1, 3, 2, 0xf6f4ee); px(mid, 3, 1, 1, 0xf6f4ee);
        px(mid, 1, 1, 4, s.top.tie ?? 0x9e3c36);
        px(mid - 2, 1, 1, 3, dark); px(mid + 2, 1, 1, 3, dark);
        px(mid, 5, 1, 1, dark); px(mid, 7, 1, 1, dark);
        break;
      case 'coat':                                               // lapels open on a shirt and tie, a belt, buttons
        px(mid - 2, 0, 5, 1, s.top.shirt ?? 0xf6f4ee); px(mid - 1, 1, 3, 2, s.top.shirt ?? 0xf6f4ee);
        px(mid, 1, 1, 3, s.top.tie ?? 0x353947);
        px(mid - 3, 0, 1, 4, dark); px(mid + 3, 0, 1, 4, dark); px(mid - 2, 3, 1, 2, dark); px(mid + 2, 3, 1, 2, dark);
        px(0, 6, w, 1, s.top.belt ?? 0x6b4636); px(mid, 6, 1, 1, 0xb9862e);
        px(2, 8, 1, 1, dark); px(6, 8, 1, 1, dark);
        px(mid, 7, 1, h - 7, dark);
        break;
      case 'dress':
        px(mid - 1, 0, 3, 1, c.skin); px(0, 4, w, 1, s.top.trim ?? 0x6e2a2e);
        break;
      case 'uniform':                                            // pockets, a badge, a belt
        px(mid - 1, 0, 3, 1, c.skin); px(mid, 1, 1, h - 2, dark);
        px(1, 2, 2, 1, dark); px(6, 2, 2, 1, dark); px(1, 3, 1, 1, 0xe7b84a);
        px(0, h - 2, w, 1, INK);
        break;
      case 'sweater':
        px(mid - 2, 0, 5, 1, s.top.trim ?? 0xf6f4ee); px(0, 3, w, 1, s.top.trim ?? 0xf6f4ee);
        break;
      default:                                                   // a tee
        px(mid - 1, 0, 3, 1, c.skin); px(mid - 2, 0, 1, 1, dark); px(mid + 2, 0, 1, 1, dark);
    }
  });
}

/** A chibi person from a spec (see the header). Returns { root, turn, pose(state, t) }. */
export function chibi(s = {}) {
  const c = colours(s);
  const skinM = mat(c.skin), hairM = mat(c.hair), topM = mat(c.top);
  const legsM = mat(s.legs ?? 0x283f6b), shoesM = mat(s.shoes ?? 0x2a1c18);
  const kind = s.top?.kind ?? 'tee';
  const long = kind === 'coat' || kind === 'dress';

  const root = new THREE.Group();
  root.scale.z = DEPTH;
  const turn = new THREE.Group();
  root.add(turn);
  const body = new THREE.Group();                                // bobs and leans: torso, head, arms
  turn.add(body);

  // The blob of shadow under the feet (left out of the outline pass).
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.45, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.userData.noId = true;
  root.add(blob);

  // The torso: a coat or a dress runs down over the legs.
  const th = long ? 11 : TORSO[1];
  const torso = part(roundedBox(TORSO[0] * P, th * P, TORSO[2] * P, 1.5 * P, { sides: topM, front: mat(0, chest(s, c, th)) }));
  torso.position.y = (NECK - th) * P;
  body.add(torso);

  // The head: a painted face, profiles and back; hair as a cap and a back plate.
  const head = new THREE.Group();
  head.position.y = NECK * P;
  body.add(head);
  const hairTop = (s.hair?.style ?? 'short') === 'bald' ? skinM : hairM;
  head.add(part(roundedBox(HEAD[0] * P, HEAD[1] * P, HEAD[2] * P, 2 * P, {
    front: mat(0, face(s, c)), back: mat(0, back(s, c)), left: mat(0, profile(s, c, false)), right: mat(0, profile(s, c, true)),
    top: hairTop, bottom: skinM })));
  const style = s.hair?.style ?? 'short';
  if (style !== 'bald') {
    const cap = roundedBox((HEAD[0] + 1) * P, 4 * P, (HEAD[2] + 2) * P, 1.5 * P, { sides: hairM });
    cap.position.set(0, (HEAD[1] - 3) * P, -0.5 * P);
    const plate = roundedBox((HEAD[0] + 1) * P, (style === 'long' ? 15 : 9) * P, 3 * P, 1 * P, { sides: hairM });
    plate.position.set(0, (style === 'long' ? -3 : 4) * P, -(HEAD[2] / 2 - 0.5) * P);
    const hair = part(new THREE.Group().add(cap, plate));
    if (style === 'bun') { const bun = roundedBox(6 * P, 5 * P, 5 * P, 2 * P, { sides: hairM }); bun.position.set(0, (HEAD[1] + 1) * P, -4 * P); hair.add(part(bun, hair.children[0].userData.part)); }
    head.add(hair);
  }
  if (c.beard !== undefined) {                                   // a beard's volume, under the chin
    const b = part(roundedBox(11 * P, 4 * P, 5 * P, 1.5 * P, { sides: mat(c.beard) }));
    b.position.set(0, -2 * P, (HEAD[2] / 2 - 2) * P);
    head.add(b);
  }
  if (s.hat) {
    const hm = mat(s.hat.color ?? 0x353947), band = mat(s.hat.band ?? INK);
    const hat = new THREE.Group();
    const at = (m, y, z = 0) => { m.position.set(0, y * P, z * P); hat.add(m); };
    if (s.hat.kind === 'fedora') {
      at(box(19 * P, 1 * P, 16 * P, { sides: hm }), HEAD[1] - 2);
      at(roundedBox(13 * P, 5 * P, 11 * P, 1.5 * P, { sides: hm }), HEAD[1] - 1);
      at(box(13.2 * P, 1 * P, 11.2 * P, { sides: band }), HEAD[1] - 1);
    } else if (s.hat.kind === 'cap') {
      at(roundedBox(16 * P, 5 * P, 14 * P, 2 * P, { sides: hm }), HEAD[1] - 3);
      at(box(10 * P, 1 * P, 6 * P, { sides: hm }), HEAD[1] - 3, 9);
    } else if (s.hat.kind === 'peaked') {
      at(box(16 * P, 3 * P, 14 * P, { sides: band }), HEAD[1] - 3);
      at(roundedBox(18 * P, 2 * P, 16 * P, 0.8 * P, { sides: hm }), HEAD[1]);
      at(box(10 * P, 1 * P, 5 * P, { sides: mat(INK) }), HEAD[1] - 3, 8);
      at(box(2 * P, 2 * P, 1 * P, { sides: mat(0xe7b84a) }), HEAD[1] - 2.5, 7.2);
    } else {                                                     // a beanie
      at(roundedBox(16 * P, 7 * P, 14 * P, 2.5 * P, { sides: hm }), HEAD[1] - 5);
      at(box(16.4 * P, 2 * P, 14.4 * P, { sides: band }), HEAD[1] - 5);
    }
    head.add(part(hat));
  }

  // Arms from the shoulders, sleeves painted down to the cuff (a tee's stop short); legs from the hips.
  const sleeve = paint(ARM[0], ARM[1], (px, w, h) => { px(0, 0, w, h, c.top); if (kind === 'tee' || kind === 'dress') px(0, 3, w, h - 3, c.skin); });
  const sleeveM = mat(0, sleeve);
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (TORSO[0] + ARM[0]) / 2 * P, (NECK - 0.5) * P, 0);
    const a = box(ARM[0] * P, ARM[1] * P, ARM[2] * P, { sides: sleeveM, top: topM, bottom: topM });
    a.position.y = -ARM[1] * P;
    const hand = box(ARM[0] * P, 2 * P, ARM[2] * P, { sides: skinM });
    hand.position.y = -(ARM[1] + 2) * P;
    pivot.add(part(new THREE.Group().add(a, hand)));
    body.add(pivot);
    return pivot;
  });
  const legs = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 2 * P, HIP * P, 0);
    const l = box(LEG[0] * P, LEG[1] * P, LEG[2] * P, { sides: legsM });
    l.position.y = -HIP * P;
    const shoe = box(SHOE[0] * P, SHOE[1] * P, SHOE[2] * P, { sides: shoesM });
    shoe.position.set(0, -HIP * P, 1 * P);
    pivot.add(part(new THREE.Group().add(l, shoe)));
    turn.add(pivot);
    return pivot;
  });
  if (s.carry) {                                                 // in the right hand (the person's right: -x)
    const item = s.carry === 'briefcase'
      ? box(2 * P, 5 * P, 7 * P, { sides: mat(0x47302a), top: mat(0x6b4636) })
      : box(1 * P, 6 * P, 5 * P, { sides: mat(0xdfe2e8), front: mat(0xb8bdc8) });
    item.position.set(-0.5 * P, -(ARM[1] + 6) * P, 0);
    arms[0].add(part(item));
  }

  /** Pose for `state` at time t (seconds), stepped to FPS frames a second. */
  const pose = (state = 'idle', t = 0) => {
    const f = Math.floor(t * FPS);
    let swing = 0, armSwing = 0, bob = 0, lean = 0, drop = 0, legsUp = 0;
    if (state === 'walk') {                                      // contact, pass, contact, pass
      const k = f % 4;
      swing = [0.5, 0, -0.5, 0][k]; armSwing = -swing * 0.8; bob = [0, P, 0, P][k];
    } else if (state === 'run') {
      const k = f % 4;
      swing = [0.9, 0.2, -0.9, -0.2][k]; armSwing = -swing; bob = [0, 2 * P, 0, 2 * P][k]; lean = 0.2;
    } else if (state === 'sit') {
      legsUp = -Math.PI / 2;
    } else if (state === 'crouch') {
      drop = 3 * P; lean = 0.25;
    } else {                                                     // idle: a one-pixel breath every second
      bob = Math.floor(t * 2) % 2 ? -P : 0;
    }
    body.position.y = bob - drop;
    body.rotation.x = lean;
    legs[0].rotation.x = legsUp + swing; legs[1].rotation.x = legsUp - swing;
    arms[0].rotation.x = armSwing; arms[1].rotation.x = -armSwing;
    legs.forEach(l => { l.scale.y = drop ? 0.6 : 1; });
  };
  // No sun shadow: the blob is a person's shadow, as under a sprite.
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  pose('idle', 0);
  return { root, turn, pose };
}
