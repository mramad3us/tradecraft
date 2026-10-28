// Sample 008: furniture. Every kind in src/sim/interiors/furniture.js as src/art/furniture.js draws
// it, at the game's camera and scale (the fine finish, 640 × 360, its palette and grade): a contact
// sheet a page at a time, each kind labelled on the floor before it, in rows against a plain wall,
// a person in each row for scale; then the pieces together, a small flat over a row of shops.
//   ?view=sheet&page=home|shop|food|office|turned   the sheet (turned: pieces facing up, left, right)
//   ?view=scene        the flat (living room, kitchen, bedroom, bathroom, hall) over the shops
//                      (a corner shop, a bakery, a café-bar)
//   ?time=night        night: the lamps, the TV and the fridges on
//   ?zoom=2  ?x=0&z=0  look closer, and where
import * as THREE from 'three';
import { pixelStage, nightfall, ground, tile, mat, box, paint, part, pool, text, textWidth, finish, tone, noise, FINE_PALETTE } from '../lib/pixelart.js';
import { spritePerson } from '../lib/sprites.js';
import { furniture } from '../../src/art/furniture.js';
import { FURNITURE, footprint } from '../../src/sim/interiors/furniture.js';
import { CAST } from '../006-chibi/cast.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'sheet';
const page = q.get('page') ?? 'home';
const night = q.get('time') === 'night';
finish.fine = true;
const stage = pixelStage({ zoom: Number(q.get('zoom') ?? 1), res: [640, 360], palette: FINE_PALETTE, grade: 1, background: 0x1a1214 });
const { scene } = stage;
const actors = [];
const report = { view, page, pieces: [] };

// ---------- the room's makings: floors, walls, labels, people ----------

const M = 16;
const floors = {
  // (calmer than the town's planks, which would fight the furniture: boards 4 px, staggered joints, a grain)
  planks: () => mat(0, paint(16, 32, (px) => { const c = 0x8f6345; for (let x = 0; x < 16; x += 4) { const d = [0, -0.02, 0.015, -0.01][x / 4]; px(x, 0, 4, 32, tone(c, d)); px(x + 3, 0, 1, 32, tone(c, -0.1)); const j = (x * 7) % 32; px(x, j, 3, 1, tone(c, -0.1)); px(x + 1, (j + 11) % 32, 1, 3, tone(c, d - 0.03)); } }, { repeat: true })),
  tiles: () => mat(0, paint(16, 16, (px) => { px(0, 0, 16, 16, 0xa0978a); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) { const c = ((x + y) / 4) % 2 ? 0xe2dac6 : 0xc4bba9; px(x, y, 3, 3, c); px(x, y, 3, 1, tone(c, 0.03)); } }, { repeat: true })),
  squares: () => mat(0, tile('squares', 1)),
  terrazzo: () => mat(0, tile('terrazzo', 1)),
  lino: () => mat(0, paint(16, 16, (px) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 1, 1, tone(0xa0978a, noise(x / 3, y / 3, 5) < 0.3 ? -0.03 : 0)); px(0, 0, 16, 1, 0x8f8a84); px(0, 0, 1, 16, 0x8f8a84); }, { repeat: true })),
  carpet: () => mat(0, paint(16, 16, (px) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 1, 1, tone(0x4c5262, ((x * 7 + y * 13) % 5 === 0) ? -0.04 : noise(x / 2, y / 2, 9) > 0.7 ? 0.02 : 0)); }, { repeat: true })),
};
const g16 = (v) => Math.round(v * M) / M;                        // (on the pixel grid: texels on the screen's pixels)
function floor(x0, z0, x1, z1, kind) { scene.add(ground(g16(x0), g16(z0), g16(x1), g16(z1), floors[kind]())); }
// A wall: its front face at z, x0 … x1, h tall: painted plaster (or a paper), a skirting board.
const WALLS = { plaster: [0xe2dac6, null], blue: [0xb7cbe0, null], green: [0xc9dcb5, null], paper: [0xe2d6b8, 0xc9b88f], tile: [0xdfe2e8, 'tile'], ochre: [0xe7d58a, null], grey: [0xc4c8d0, null] };
function wall(x0, x1, z, { h = 2.6, kind = 'plaster', d = 0.25 } = {}) {
  [x0, x1, z] = [g16(x0), g16(x1), g16(z)];
  const [c, stripe] = WALLS[kind];
  const H = Math.round(h * M);
  const face = mat(0, paint(16, H, (px) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < 16; x++) px(x, y, 1, 1, noise(x / 4, y / 4, 3) < 0.18 ? tone(c, -0.02) : c);
    if (stripe === 'tile') { for (let y = H - 22; y < H - 2; y++) for (let x = 0; x < 16; x++) px(x, y, 1, 1, (x % 4 === 3 || y % 4 === 3) ? 0xb8bdc8 : 0xf4efe6); }
    else if (stripe) for (let x = 0; x < 16; x += 4) px(x, 0, 1, H - 2, stripe);
    px(0, H - 2, 16, 2, 0x6b4636); px(0, H - 2, 16, 1, 0x8f6345);  // the skirting
  }, { repeat: true }));
  const b = box(x1 - x0, H / M, d, { sides: mat(tone(c, -0.06)), top: mat(0x8f8a84), front: face });
  b.position.set((x0 + x1) / 2, 0, z - d / 2);
  scene.add(part(b));
  return b;
}
// A partition between rooms: x, from z0 to z1, h tall.
function partition(x, z0, z1, { h = 2.6, kind = 'plaster' } = {}) {
  const b = box(0.125, h, z1 - z0, { sides: mat(WALLS[kind][0]), top: mat(0x8f8a84) });
  b.position.set(x, 0, (z0 + z1) / 2);
  scene.add(part(b));
}
// A low sill along the cut-away front of a room (the dojo's).
function sill(x0, x1, z) { const b = box(x1 - x0, 0.3, 0.25, { sides: mat(0x8f8a84), top: mat(0xa0978a) }); b.position.set((x0 + x1) / 2, 0, z + 0.125); scene.add(part(b)); }

// A label on the floor: the kind's name in the pixel font (camelCase split into words, a word a line), on a card.
const labelLines = (str) => str.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase().split(/\s+/);
const labelSize = (str) => { const lines = labelLines(str); return { w: (Math.max(...lines.map(textWidth)) + 4) / M, d: (lines.length * 6 + 3) / M }; };
function label(str, x, z) {
  const lines = labelLines(str);
  const W = Math.max(...lines.map(textWidth)) + 4, H = lines.length * 6 + 3;
  const t = paint(W, H, (px) => { px(0, 0, W, H, 0xe2dac6); px(0, 0, W, 1, 0x8f6345); px(0, H - 1, W, 1, 0x8f6345); px(0, 0, 1, H, 0x8f6345); px(W - 1, 0, 1, H, 0x8f6345); lines.forEach((l, i) => text(px, Math.floor((W - textWidth(l)) / 2), 2 + i * 6, l, 0x1a1214)); });
  const x0 = Math.round((x - W / M / 2) * M) / M, z0 = Math.round(z * M) / M;   // (texels on the screen's pixels)
  const m = ground(x0, z0, x0 + W / M, z0 + H / M, mat(0, t), 0.01);
  scene.add(m);
  return { w: W / M, d: H / M };
}

const snap = (v) => Math.round(v * 16) / 16;
function person(name, x, z, { facing = 0, state = 'idle', phase = 0 } = {}) {
  const p = spritePerson(CAST[name]);
  p.root.position.set(snap(x), 0, snap(z));
  p.turn.rotation.y = facing;
  scene.add(p.root);
  actors.push({ update(t) { p.material.color.copy(stage.lightAt ? stage.lightAt(x, z) : new THREE.Color(1, 1, 1)); p.pose(state, t + phase); } });
}

// A piece, placed: { kind, x, z, face, look, seed }; at night lamps and screens are on.
const lights = [];
function put(item) {
  const look = { ...(item.look ?? {}) };
  if (night && ['bedsideTable', 'floorLamp', 'desk', 'tv'].includes(item.kind) && look.on === undefined) look.on = true;
  const g = furniture({ ...item, look });
  scene.add(g);
  if (g.userData.light) { const L = g.userData.light, v = new THREE.Vector3(L.x, L.y, L.z).applyEuler(g.rotation).add(g.position); lights.push(v); }
  const f = footprint(item), s = FURNITURE[item.kind];
  report.pieces.push(`${item.kind}${item.look ? ' ' + JSON.stringify(item.look) : ''} ${item.face ?? 'down'}: ${(f.x1 - f.x0).toFixed(2)} × ${(f.z1 - f.z0).toFixed(2)} × ${s.h} m`);
  return g;
}

// ---------- the sheet: every kind in rows, against a wall, labelled ----------

const PAGES = {
  home: [['bed'], ['singleBed'], ['bedsideTable'], ['wardrobe'], ['drawers'], ['sofa'], ['armchair'], ['coffeeTable'], ['tv'], ['bookshelf'], ['diningTable'], ['chair'], ['desk'], ['rug'],
    ['counter'], ['sink'], ['cooker'], ['fridge'], ['kitchenShelf'], ['bathtub'], ['toilet'], ['washbasin'], ['radiator'], ['floorLamp'], ['plant', { kind: 'ficus' }, 'plant'], ['plant', { kind: 'snake' }, 'plant snake'], ['phoneTable'], ['coatRack'], ['shoeRack']],
  shop: [['shelving', { goods: 'groceries' }, 'shelving groceries'], ['shelving', { goods: 'tins' }, 'shelving tins'], ['shelving', { goods: 'bottles' }, 'shelving bottles'], ['shelving', { goods: 'boxes' }, 'shelving boxes'], ['shelving', { goods: 'books' }, 'shelving books'], ['shelving', { goods: 'shoes' }, 'shelving shoes'], ['shelving', { goods: 'phones' }, 'shelving phones'],
    ['gondola'], ['shopCounter'], ['checkout'], ['drinksFridge'], ['chestFreezer'], ['baskets'], ['crates'], ['pallet'], ['clothesRail'], ['fittingRoom'], ['mirror'], ['flowerBuckets']],
  food: [['displayCase', { goods: 'bread' }, 'case bread'], ['displayCase', { goods: 'pastries' }, 'case pastries'], ['displayCase', { goods: 'cakes' }, 'case cakes'], ['displayCase', { goods: 'cheese' }, 'case cheese'], ['displayCase', { goods: 'meat' }, 'case meat'],
    ['breadRack'], ['deckOven'], ['workTable'], ['cafeCounter'], ['bar'], ['barShelf'], ['barStool'], ['restaurantTable'], ['range'], ['steelSink'], ['bankCounter']],
  office: [['stairs'], ['mailboxes'], ['liftDoor'], ['officeDesk'], ['officeChair'], ['filingCabinet'], ['securityDesk'], ['metalDetector'], ['xray'], ['stanchions'], ['flag'], ['waitingChairs'], ['vaultDoor'], ['waterCooler']],
  turned: [['sofa', null, 'sofa up', 'up'], ['sofa', null, 'sofa left', 'left'], ['sofa', null, 'sofa right', 'right'], ['armchair', null, 'armchair up', 'up'], ['bed', null, 'bed left', 'left'], ['wardrobe', null, 'wardrobe right', 'right'],
    ['desk', null, 'desk up', 'up'], ['diningTable', null, 'dining left', 'left'], ['gondola', null, 'gondola left', 'left'], ['shelving', null, 'shelving right', 'right'], ['counter', null, 'counter left', 'left'], ['officeDesk', null, 'office desk up', 'up'],
    ['officeChair', null, 'chair up', 'up'], ['waitingChairs', null, 'waiting up', 'up'], ['stairs', null, 'stairs left', 'left'], ['bar', null, 'bar up', 'up'], ['xray', null, 'xray left', 'left'], ['flag', null, 'flag up', 'up'], ['fridge', null, 'fridge left', 'left']],
};
const FLOOR_OF = { home: 'planks', shop: 'squares', food: 'terrazzo', office: 'carpet', turned: 'lino' };
const CASTS = ['spy', 'red', 'suit', 'long', 'cop', 'beanie'];

function sheet() {
  const entries = PAGES[page] ?? PAGES.home;
  const MAXW = 37, GAP = 0.55;
  const rows = [];
  let row = [], w = 1.2;
  for (const [kind, look, name, face = 'down'] of entries) {
    const f = footprint({ kind, x: 0, z: 0, face }), fw = f.x1 - f.x0, lw = labelSize(name ?? kind).w;
    const slot = Math.max(fw, lw) + GAP;
    if (w + slot > MAXW && row.length) { rows.push(row); row = []; w = 1.2; }
    row.push({ kind, look, name: name ?? kind, face, fw, fd: f.z1 - f.z0, slot });
    w += slot;
  }
  if (row.length) rows.push(row);
  let zWall = 0;
  const x0 = -MAXW / 2;
  rows.forEach((r, i) => {
    const rowW = 1.2 + r.reduce((a, e) => a + e.slot, 0);
    const xs = x0 + (MAXW - rowW) / 2;
    wall(xs - 0.6, xs + rowW + 0.6, zWall, { kind: i % 2 ? 'grey' : 'plaster' });
    const depth = Math.max(...r.map(e => e.fd + (FURNITURE[e.kind].wall ? 0 : 0.3)));
    const labelZ = zWall + depth + 0.35;
    person(CASTS[i % CASTS.length], xs + 0.5, zWall + 0.9, { phase: i * 0.3 });
    let x = xs + 1.2;
    let labelD = 0;
    for (const e of r) {
      const cx = x + e.slot / 2, s = FURNITURE[e.kind];
      put({ kind: e.kind, x: cx, z: zWall + e.fd / 2 + (s.wall ? 0 : 0.3), face: e.face, look: e.look ?? undefined, seed: 1 + i * 7 + Math.round(cx) });
      labelD = Math.max(labelD, label(e.name, cx, labelZ).d);
      x += e.slot;
    }
    floor(xs - 0.6, zWall - 0.25, xs + rowW + 0.6, labelZ + labelD + 0.4, FLOOR_OF[page] ?? 'planks');
    zWall = labelZ + labelD + 0.4 + 2.6 + 0.3;
  });
  // The camera on the middle of it all: from the first wall's top (2.6 up at z 0) to the last labels.
  const top = 2.6, bottom = -(zWall - 2.6 - 0.3);
  return { x: 0, z: -(top + bottom) / 2 };
}

// ---------- the scene: a flat over a row of shops ----------

function scene_() {
  // The flat, its back wall at z −3, its front cut away at z 2.5.
  const ZB = -3, ZF = 2.5;
  floor(0, ZB, 9, ZF, 'planks'); floor(9, ZB, 16, ZF, 'tiles'); floor(16, ZB, 24, ZF, 'planks'); floor(24, ZB, 28, ZF, 'tiles'); floor(28, ZB, 31, ZF, 'lino');
  wall(0, 9, ZB, { kind: 'paper' }); wall(9, 16, ZB, { kind: 'plaster' }); wall(16, 24, ZB, { kind: 'blue' }); wall(24, 28, ZB, { kind: 'tile' }); wall(28, 31, ZB, { kind: 'ochre' });
  for (const x of [0, 9, 16, 24, 28, 31]) partition(x, ZB, ZF);
  sill(0, 31, ZF);
  const W = (kind, x, face = 'down', look, seed = 1) => { const f = footprint({ kind, x: 0, z: 0, face }); put({ kind, x, z: ZB + (f.z1 - f.z0) / 2, face, look, seed }); };
  // The living room: shelves and the TV on the back wall, the sofa facing it, an armchair, a rug.
  W('bookshelf', 0.75, 'down', { wood: 'walnut' }, 2); W('tv', 4.5, 'down', { wood: 'walnut', on: night }); W('plant', 7.9, 'down', { kind: 'ficus' }, 3); W('bookshelf', 2.05, 'down', { wood: 'walnut' }, 3);
  put({ kind: 'rug', x: 4.5, z: -0.6, look: { pattern: 'persian' }, seed: 4 });
  put({ kind: 'coffeeTable', x: 4.5, z: -0.9, look: { wood: 'walnut' } });
  put({ kind: 'sofa', x: 4.5, z: 0.75, face: 'up', look: { fabric: 'green' } });
  put({ kind: 'armchair', x: 1.6, z: -0.6, face: 'right', look: { fabric: 'mustard' } });
  put({ kind: 'floorLamp', x: 0.5, z: -1.75 });
  put({ kind: 'radiator', x: 6.9, z: ZB + 0.06 });
  // The kitchen: the run along the back wall, a shelf over it, the table in the middle.
  const kl = { front: 0x3b6296, top: 'teak' };
  W('fridge', 9.45, 'down', { front: 'white' }, 1); W('counter', 10.4, 'down', kl, 1); W('cooker', 11.3, 'down', { front: 'white' }, 2); W('sink', 12.1, 'down', kl, 1); W('counter', 13.2, 'down', kl, 2); W('counter', 14.4, 'down', kl, 3);
  put({ kind: 'kitchenShelf', x: 13.2, z: ZB + 0.125 });
  put({ kind: 'diningTable', x: 12.5, z: 0.4, look: { wood: 'oak' }, seed: 1 });
  put({ kind: 'plant', x: 15.5, z: 1.9, look: { kind: 'snake', pot: 'white' } });
  // The bedroom: the bed between its bedside tables, the wardrobe on the east wall, drawers on the west.
  W('bed', 20, 'down', { duvet: 'blue', pattern: 'checks', wood: 'oak' }); W('bedsideTable', 18.75, 'down', { wood: 'oak' }); W('bedsideTable', 21.25, 'down', { wood: 'oak' }, 2);
  W('radiator', 17.2);
  put({ kind: 'wardrobe', x: 23.62, z: -1.6, face: 'left', look: { wood: 'oak' } });
  put({ kind: 'drawers', x: 16.31, z: 0.2, face: 'right', look: { wood: 'oak' } });
  put({ kind: 'rug', x: 20, z: 1.3, look: { pattern: 'kilim' }, seed: 2 });
  // The bathroom: the bath along the back wall, the basin, the toilet.
  W('bathtub', 25, 'down'); W('washbasin', 26.4); W('toilet', 27.3);
  // The hall: the telephone, the coats, the shoes.
  W('phoneTable', 29.0, 'down', { wood: 'walnut' }); W('shoeRack', 30.3, 'down', { wood: 'oak' });
  put({ kind: 'coatRack', x: 30.4, z: 0.4 });
  person('long', 6.5, 0.0, { facing: Math.PI / 2 }); person('beard', 13.8, 1.2, { phase: 0.4 }); person('spy', 29.6, 1.0, { facing: Math.PI, phase: 0.2 });

  // The shops, their back wall at z 6.2, their front at 11.7.
  const SB = 6.2, SF = 11.7;
  const S = (kind, x, face = 'down', look, seed = 1) => { const f = footprint({ kind, x: 0, z: 0, face }); put({ kind, x, z: SB + (f.z1 - f.z0) / 2, face, look, seed }); };
  floor(0, SB, 12, SF, 'squares'); floor(12, SB, 22, SF, 'terrazzo'); floor(22, SB, 31, SF, 'planks');
  wall(0, 12, SB, { kind: 'grey' }); wall(12, 22, SB, { kind: 'ochre' }); wall(22, 31, SB, { kind: 'green' });
  for (const x of [0, 12, 22, 31]) partition(x, SB, SF);
  sill(0, 31, SF);
  // A corner shop: shelving round the walls, a gondola, the fridges, the counter by the door.
  S('shelving', 0.7, 'down', { goods: 'groceries' }, 1); S('shelving', 1.9, 'down', { goods: 'tins' }, 2); S('shelving', 3.1, 'down', { goods: 'groceries' }, 3); S('shelving', 4.3, 'down', { goods: 'bottles' }, 4);
  S('drinksFridge', 5.4); S('drinksFridge', 6.1, 'down', undefined, 2);
  S('shelving', 7.3, 'down', { goods: 'boxes' }, 5);
  put({ kind: 'gondola', x: 3.0, z: 9.0, look: { goods: 'groceries' }, seed: 6 });
  put({ kind: 'chestFreezer', x: 6.6, z: 9.1 });
  put({ kind: 'shopCounter', x: 9.6, z: 9.6 });
  put({ kind: 'baskets', x: 11.4, z: 11.1 });
  put({ kind: 'crates', x: 10.9, z: SB + 0.45, seed: 2 });
  person('beanie', 9.95, 8.95, { phase: 0.1 }); person('kid', 3.6, 10.6, { facing: Math.PI, phase: 0.3 });
  // The bakery: bread racks behind, the oven; the display cases at the front, the baker between.
  S('breadRack', 12.75); S('breadRack', 13.95, 'down', undefined, 2); S('deckOven', 18.6); S('breadRack', 15.15, 'down', undefined, 3);
  put({ kind: 'workTable', x: 20.6, z: 8.6 });
  put({ kind: 'displayCase', x: 13.8, z: 9.6, look: { goods: 'bread' } });
  put({ kind: 'displayCase', x: 15.3, z: 9.6, look: { goods: 'pastries' } });
  put({ kind: 'displayCase', x: 16.8, z: 9.6, look: { goods: 'cakes' } });
  put({ kind: 'flowerBuckets', x: 20.8, z: 11.1 });
  person('red', 15.0, 8.8, { phase: 0.6 }); person('suit', 14.5, 10.8, { facing: Math.PI, phase: 0.2 });
  // A café-bar: the back bar, the counter and its stools, a table for two.
  S('barShelf', 24.6);
  put({ kind: 'bar', x: 24.6, z: 8.3 });
  for (const x of [23.7, 24.6, 25.5]) put({ kind: 'barStool', x, z: 9.25 });
  put({ kind: 'restaurantTable', x: 28.8, z: 8.9, look: { cloth: 'checks' } });
  S('cafeCounter', 29.0, 'down', undefined, 1);
  person('cop', 24.6, 7.45, { phase: 0.5 });
  return { x: 15.5, z: 2.6 };
}

const at = view === 'scene' ? scene_() : sheet();
stage.look({ x: Number(q.get('x') ?? at.x), z: Number(q.get('z') ?? at.z) });
if (night) {
  for (const L of lights) scene.add(pool(L.x, L.y, L.z, { r: Math.max(0.7, L.y * 0.9), core: 0.45, ring: 0.18 }));   // (a pool as wide as the lamp is high)
  nightfall(stage);
}

let frames = 0;
const clock = new THREE.Clock();
function frame() {
  const t = q.has('t') ? Number(q.get('t')) : clock.getElapsedTime();
  for (const a of actors) a.update(t);
  stage.render();
  if (++frames === 3) { window.__ready = true; window.__report = { view, page, pieces: report.pieces.length }; }
  requestAnimationFrame(frame);
}
window.__tradecraft = { stage, report };
frame();
