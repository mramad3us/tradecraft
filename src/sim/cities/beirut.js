// TRADECRAFT sim: Beirut, as a city profile (sim/cities/index.js). Achrafieh, Gemmayzeh, Mar
// Mikhael, toward Hamra: the old houses between the towers, the stairs up the hill, the war still in
// the walls.
//
// The buildings (building()):
//   - ottoman: a Lebanese house of the nineteenth century: sandstone in courses, two or three
//     storeys; on the first floor its triple arched window (three tall arches on slim marble columns,
//     coloured glass in their heads) over a little iron balcony, shutters either side; a red tile
//     roof;
//   - mandate: a French mandate block of four to six storeys in cream, ochre or rose plaster: a
//     balcony across every floor in wrought iron, tall French windows behind persiennes;
//   - block: a post-war block of six to nine floors in concrete, its balconies deep, hung with
//     canvas awnings, plants on them; air conditioners, water tanks and solar heaters on the roof;
// any of them scarred by shrapnel and bullets now and then, patched or not (the dress). Signs in
// Arabic and French. On the street: generators in the side streets, their cables, and every other
// cable in the city, slung along the fronts and across the lanes (src/render/town.js); scooters
// parked at the kerb and against the walls; palms and ficus; service taxis, old Mercedes. Escaliers
// (stairs: the city climbs) and alleys lead north. Cars drive on the right.
import { stream, int, range, pick, chance, weighted } from '../rng.js';
import { SECTION_M, GAP_M, STRETCH, Z, GROUND_H, FLOOR_H, at, toneOf } from '../map/layout.js';
import { beirutName, beirutLook } from './folk.js';
import { squareFurniture } from './square.js';
import { wordM, fit } from './signs.js';

// ---------- names ----------

const STREETS = ['Rue Gouraud', 'Rue Pasteur', 'Rue d\'Arménie', 'Rue Monot', 'Rue Hamra', 'Rue Bliss', 'Rue Makdissi', 'Rue Abdel Aziz',
  'Rue Sursock', 'Rue Mar Mikhael', 'Rue Spears', 'Rue Clemenceau', 'Rue Jeanne d\'Arc', 'Rue Verdun', 'Rue Sidani', 'Rue Baalbek',
  'Rue Huvelin', 'Rue Abdel Wahab el-Inglizi', 'Rue Lyon', 'Rue Emile Eddé'];
const AVENUES = ['Avenue Charles Malek', 'Avenue de Paris', 'Avenue des Français', 'Avenue Sami el-Solh', 'Boulevard Saeb Salam',
  'Avenue Fouad Chehab', 'Avenue du Général de Gaulle', 'Rue de Damas'];
const JARDINS = ['the Jardin Sanayeh', 'the Jardin des Jésuites', 'the Jardin Sioufi', 'the Jardin Gebran Khalil Gebran', 'Place Sassine',
  'the Jardin Saint-Nicolas', 'the Jardin Mar Mitr', 'Place Riad el-Solh', 'Place Debbas', 'the Jardin Rizkallah'];
const STAIRS = ['Escalier Saint-Nicolas', 'Escalier de l\'Art', 'Escalier Vendôme', 'Escalier Mar Mitr', 'Escalier du Liban', 'Escalier Saint-Antoine',
  'Escalier Pharaon', 'Escalier Laziste', 'Escalier Saint-Maron', 'Escalier Rmeil'];
const SIDE = ['Rue Gemmayzeh', 'Rue Patriarche Arida', 'Rue Saint-Nicolas', 'Rue Kaskas', 'Rue Mar Maroun', 'Rue Sioufi', 'Rue Tabaris',
  'Rue Ibrahim Pacha', 'Rue Nahr', 'Rue Badaro', 'Rue Hobeiche', 'Rue Commodore'];
const streetName = (seed, row) => at(STREETS, seed, row, 'street');

/** A row's ways north in section i: stairs up the hill, a side street, an alley. */
function gaps(seed, row, i) {
  const r = stream('street-gaps', seed, row, i), x0 = i * SECTION_M, out = [];
  const add = (kind, lo, span) => {
    for (let k = 0; k < 6; k++) {
      const gx = x0 + lo + int(r, span), w = GAP_M[kind];
      if (gx + w > x0 + SECTION_M - 4) continue;
      if (out.every(g => gx + w < g.x0 - 8 || gx > g.x1 + 8)) { out.push({ x0: gx, x1: gx + w, kind }); return true; }
    }
    return false;
  };
  if (chance(r, 0.28)) add('side', 5, 24);
  if (chance(r, 0.32)) add('stairs', 6, 32);
  if (chance(r, 0.3) || (!out.length && (i % 2 + 2) % 2 === 0)) add('alley', 8, 30);
  for (const g of out) {
    const k = [seed, row, i, Math.round(g.x0), 'lane'];
    g.name = g.kind === 'side' ? at(SIDE, ...k) : g.kind === 'stairs' ? at(STAIRS, ...k) : `a zaroub off ${streetName(seed, row)}`;
  }
  return out;
}

// ---------- shops ----------

const SHOPS = {
  pharmacy: ['صيدلية|PHARMACIE', 'PHARMACIE'], bakery: ['فرن|BOULANGERIE', 'فرن', 'فرن مناقيش'], manakish: ['مناقيش', 'فرن مناقيش'],
  sweets: ['حلويات|PATISSERIE', 'حلويات'], cafe: ['قهوة|CAFE', 'CAFE', 'قهوة'], grocery: ['ميني ماركت|MINI MARKET', 'دكان', 'سمانة'],
  vegetables: ['خضار'], books: ['مكتبة|LIBRAIRIE', 'LIBRAIRIE'], exchange: ['صيرفة|CHANGE'], bank: ['بنك|BANQUE', 'BANQUE'],
  optician: ['نظارات|OPTIQUE', 'OPTIQUE'], flowers: ['زهور|FLEURISTE', 'FLEURS'], butcher: ['لحوم|BOUCHERIE', 'لحوم'],
  clothes: ['BOUTIQUE', 'ملابس'], shoes: ['أحذية|CHAUSSURES', 'CHAUSSURES'], phones: ['خليوي|CELLULAR', 'خليوي'], restaurant: ['مطعم|RESTAURANT', 'مطعم'],
  bar: ['BAR', 'PUB', 'CAVE'], shawarma: ['شاورما', 'شاورما|SHAWARMA'], barber: ['حلاق|COIFFEUR', 'COIFFEUR'], laundry: ['PRESSING', 'كوي'],
};
const SHOP_WEIGHTS = [['grocery', 2.5], ['cafe', 3], ['bakery', 1.5], ['manakish', 1.5], ['sweets', 1.2], ['pharmacy', 2], ['vegetables', 1],
  ['books', 0.8], ['exchange', 0.8], ['bank', 0.8], ['optician', 0.7], ['flowers', 0.8], ['butcher', 0.8], ['clothes', 1.5], ['shoes', 0.8],
  ['phones', 1.5], ['restaurant', 1.5], ['bar', 1.2], ['shawarma', 1], ['barber', 1], ['laundry', 0.8]];
const BOARDS = [[0x24503a, 0xf6f4ee, 0x173327], [0x23252f, 0xf6f4ee, 0x14151c], [0xf6f4ee, 0x9e3c36, 0x6a7182], [0x6e2a2e, 0xf8e08a, 0x3f1a22],
  [0x283f6b, 0xf6f4ee, 0x1b2541], [0x9e3c36, 0xf6f4ee, 0x6e2a2e], [0xe7b84a, 0x23252f, 0xb9862e]];

// ---------- the buildings ----------

const SANDSTONE = [0xd8c09a, 0xe0c8a0, 0xcdb48c, 0xd6b98a];       // the old houses' ramleh stone
const MANDATE = [0xe2d2a8, 0xe0c38a, 0xd9a48a, 0xe2dac6, 0xc9a9b4, 0xd8b56c];   // cream, ochre, rose, the pink of Gemmayzeh
const CONCRETE = [0xa0978a, 0xc4bba9, 0xb8bdc8, 0x8f96a6];             // (the palette's own greys: others snap to green)
const SHUTTERS = [0x356f42, 0x24503a, 0x2f6b62, 0x283f6b, 0x3b6296, 0x6a7182, 0x47302a];
const CAR_COLOURS = [0xf6f4ee, 0xdfe2e8, 0xb8bdc8, 0x23252f, 0x23252f, 0x9e3c36, 0x283f6b, 0x6a7182, 0x47302a];
const STYLES = [['ottoman', 2.2], ['mandate', 3.2], ['block', 3.5]];

function building(r, x0, x1, z, S) {
  const w = x1 - x0, ops = [], seed = int(r, 1e6);
  const style = weighted(r, STYLES.map(([s, k]) => [s, s === 'ottoman' && w > 15 ? 0.5 : k]));
  const B = { x0, x1, z, h: 0, d: 35, wall: 'plaster', wallColor: pick(r, MANDATE), roof: 'flat', ops, style, seed };
  const door = (x, w, kind, extra = {}) => S.doors.push({ x: x0 + x + w / 2, z, w, kind, ...extra });
  const shop = (x, sw, roller = 0) => {
    const kind = weighted(r, SHOP_WEIGHTS), words = fit(r, SHOPS[kind], sw - 0.1), [bg, fg, border] = pick(r, BOARDS);
    ops.push(['shopfront', x, sw - 1.3, 2.75, { goods: [pick(r, [0xe7b84a, 0xc95c45, 0xf6f4ee]), pick(r, [0x9e3c36, 0x3b6296, 0x356f42, 0xe7b84a]), pick(r, [0x8f6345, 0xc95c45, 0x5d8fc2])], roller }]);
    ops.push(['door', x + sw - 1.2, 1.1, 2.45, { color: 0x23252f, frame: 0x23252f }]);
    ops.push(['sign', x, 3.0, sw - 0.1, 0.85, words, { bg, fg, border, style: weighted(r, [['board', 3], ['lightbox', 1.5], ['letters', 1]]) }]);
    S.doors.push({ x: x0 + x + sw - 0.65, z, w: 1.1, kind: 'shop', shop: kind, pane: { x0: x0 + x, x1: x0 + x + sw - 1.3, z } });
  };
  const groundFloor = ({ shops = 0.7, roller = 0.25, entrance = 0.5, arched = false }) => {
    let x = 0.4 + range(r, 0, 0.5);
    while (x < w - 1.4) {
      const room = w - 0.4 - x;
      if (room > 3.4 && chance(r, shops)) { const sw = Math.min(room, 3.4 + int(r, 3) * 0.8); shop(x, sw, chance(r, roller) ? range(r, 0.2, 1) : 0); x += sw + 0.45; continue; }
      if (room > 1.6 && chance(r, entrance)) {
        ops.push(['door', x, 1.3, 2.6, { color: pick(r, [0x47302a, 0x23252f, 0x356f42, 0x283f6b, 0x6a7182]), frame: toneOf(B.wallColor, -1), style: arched ? 'arched' : weighted(r, [['glazed', 2], ['metal', 1.5], ['panel', 1]]) }]);
        door(x, 1.3, 'entrance'); x += 2.1 + range(r, 0, 0.5); continue;
      }
      if (room > 1.4) ops.push(['window', x, 1.0, 1.1, 1.7, { frame: 0x6b4636, lintel: null, head: arched ? 'round' : 'none', bars: true }]);
      x += 1.1 + 0.9 + range(r, 0, 0.5);
    }
  };

  if (style === 'ottoman') {
    // A central-hall house: its sandstone, the triple arch over the door, a red tile roof.
    const floors = 2 + int(r, 2);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.6;
    B.wall = 'stone'; B.wallColor = pick(r, SANDSTONE);
    B.roof = 'pitched'; B.roofColor = 0x9e3c36;
    groundFloor({ shops: 0.35, entrance: 0.7, arched: true });
    ops.push(['band', GROUND_H, toneOf(B.wallColor, 1)]);
    const mid = w / 2, tw = Math.min(3.4, w * 0.36), shut = pick(r, SHUTTERS);
    for (let f = 1; f < floors; f++) {
      const y = GROUND_H + FLOOR_H * (f - 1) + 0.3;
      if (f === 1) {
        ops.push(['triforium', mid - tw / 2, y, tw, 2.75, { glass: [0x9e3c36, 0x3b6296, 0xe7b84a, 0x356f42] }]);
        ops.push(['balcony', mid - tw / 2 - 0.2, mid + tw / 2 + 0.2, y - 0.1, 'iron', toneOf(B.wallColor, 1)]);
      } else ops.push(['window', mid - 0.6, y + 0.2, 1.2, 2.0, { frame: 0xe2dac6, lintel: null, head: 'round', shutters: shut }]);
      for (const x of [mid - tw / 2 - 1.9, mid + tw / 2 + 0.9]) if (x > 0.3 && x + 1.0 < w - 0.3) ops.push(['window', x, y + 0.3, 1.0, 2.0, { frame: 0xe2dac6, lintel: null, head: 'round', shutters: shut, louvres: chance(r, 0.4) ? shut : null }]);
    }
    ops.push(['cornice', B.h - 0.55, 0.3, toneOf(B.wallColor, 1)]);
    return B;
  }

  if (style === 'mandate') {
    const floors = 4 + int(r, 3);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 1.0;
    ops.push(['rustic', 0.45, GROUND_H, toneOf(B.wallColor, -1)]);
    groundFloor({ shops: 0.8, roller: 0.3 });
    ops.push(['band', GROUND_H, 0xf4efe6]);
    const bays = Math.max(2, Math.round(w / 2.6)), bay = w / bays, shut = pick(r, SHUTTERS);
    for (let f = 1; f < floors; f++) {
      const y = GROUND_H + FLOOR_H * (f - 1) + 0.2;
      for (let k = 0; k < bays; k++) ops.push(['window', bay * k + (bay - 1.15) / 2, y, 1.15, 2.45, { frame: 0xf4efe6, lintel: null, head: f === 1 ? 'hood' : null, louvres: chance(r, 0.5) ? shut : null, shutters: chance(r, 0.4) ? shut : null }]);
      ops.push(['balcony', 0.25, w - 0.25, y - 0.1, chance(r, 0.75) ? 'iron' : 'stone', 0xf4efe6]);
    }
    ops.push(['cornice', B.h - 0.85, 0.5, 0xf4efe6]);
    return B;
  }

  // block: post-war concrete, its balconies deep.
  const floors = 6 + int(r, 4);
  B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.6;
  B.wall = 'concrete'; B.wallColor = pick(r, CONCRETE);
  groundFloor({ shops: 0.9, roller: 0.35 });
  const bays = Math.max(2, Math.round(w / 3.0)), bay = w / bays;
  for (let f = 1; f < floors; f++) {
    const y = GROUND_H + FLOOR_H * (f - 1) + 0.4;
    for (let k = 0; k < bays; k++) ops.push(['window', bay * k + (bay - 1.6) / 2, y, 1.6, 2.1, { frame: pick(r, [0xdfe2e8, 0x8f96a6, 0x6b4636]), lintel: null, head: 'none' }]);
    ops.push(['balcony', 0.1, w - 0.1, y - 0.2, 'solid', toneOf(B.wallColor, 1)]);
  }
  ops.push(['parapet', B.h - 0.5, 0.35, toneOf(B.wallColor, 1)]);
  return B;
}

// ---------- the dress ----------

// A building's dress: canvas awnings over the balconies, plants and washing on them; air conditioners;
// the war's scars (shrapnel and bullets, a window bricked up or burnt out); cables slung across the
// front; water tanks and solar heaters, or a red tile roof's own.
const AWNING_SHOPS = /CAFE|قهوة|فرن|مناقيش|حلويات|خضار|مطعم|RESTAURANT|BAR/;
function dress(B, L) {
  const w = B.x1 - B.x0, v = { dress: B.style, pipes: [], hanging: [], awnings: [] };
  B.look = v;
  if (B.roof !== 'pitched') B.roofColor = weighted(L, [[0xa0978a, 3], [0x8f8a84, 2], [0xb8bdc8, 1]]);
  v.roofKit = B.roof === 'pitched' ? null : weighted(L, [['solar', 3], ['tanks', 3], ['dishes', 2], ['ac', 1]]);
  for (const op of B.ops) {
    if (op[0] !== 'shopfront') continue;
    const sign = B.ops.find(o => o[0] === 'sign' && Math.abs(o[1] - op[1]) < 0.15);
    if (chance(L, AWNING_SHOPS.test(sign?.[5] ?? '') ? 0.55 : 0.2)) v.awnings.push({ x0: op[1] - 0.1, x1: op[1] + op[2] + 1.3, color: pick(L, [0x24503a, 0x9e3c36, 0x283f6b, 0xc95c45]) });
  }
  const extra = [];
  for (const op of B.ops) {
    if (op[0] === 'window' && op[2] > GROUND_H && chance(L, B.style === 'block' ? 0.25 : 0.12)) op[5] = { ...op[5], ac: pick(L, ['below', 'side']) };
    if (op[0] === 'balcony' && B.style === 'block') {
      if (chance(L, 0.45)) extra.push(['canopy', op[1] + range(L, 0, w * 0.3), op[1] + range(L, w * 0.4, w * 0.95), op[3] + FLOOR_H - 0.5, pick(L, [0x24503a, 0xc95c45, 0x283f6b, 0xe7b84a, 0x9e3c36])]);
      if (chance(L, 0.5)) extra.push(['plants', op[1] + 0.3, op[2] - 0.3, op[3] + 1.0]);
      if (chance(L, 0.3)) extra.push(['laundry', op[1] + 0.3, op[2] - 0.3, op[3] + 1.7]);
    }
    if (op[0] === 'balcony' && B.style === 'mandate' && chance(L, 0.35)) extra.push(['plants', op[1] + 0.3, op[2] - 0.3, op[3] + 1.0]);
  }
  if (chance(L, 0.38)) {                                          // the war, in the stone; a window or two burnt out and left
    extra.push(['scars', GROUND_H * 0.6, B.h - 0.5, range(L, 0.3, 1)]);
    if (chance(L, 0.3)) for (const op of B.ops) if (op[0] === 'window' && op[2] > GROUND_H && chance(L, 0.22)) op[5] = { ...op[5], burnt: true };
  }
  extra.push(['cables', GROUND_H + 0.3, B.h - 1.5, 2 + int(L, 4)]);
  if (B.h > GROUND_H + FLOOR_H && chance(L, 0.04)) extra.push(['scaffold', GROUND_H + 0.3, B.h - 0.6, pick(L, [0x356f42, 0x6a7182]), FLOOR_H]);
  B.ops.push(...extra);
}

// ---------- the street's furniture ----------

/**
 * What else stands on a Beirut street (from its own stream): scooters at the kerb between the cars
 * and against the walls; a generator in a side street, its cables. (The cables slung across the
 * street are drawn from the section by the renderer.)
 */
function furnish(S, { r, block, lamp, inMouth, near, zx }) {
  for (const q of S.squares ?? []) squareFurniture(S, q, r, block, lamp, 'fountain', 'fan');
  const cars = S.props.filter(p => p.kind === 'car' && p.z < 5);
  for (let k = 0, n = 1 + int(r, 3); k < n; k++) {               // at the kerb, in the road
    const x = S.x0 + 2 + range(r, 0, SECTION_M - 4);
    if (near(x, zx, 2.5) || inMouth(x, 1.5) || cars.some(c => Math.abs(c.x - x) < 3.1) || S.props.some(p => p.kind === 'scooter' && Math.abs(p.x - x) < 1.2)) continue;
    S.props.push({ kind: 'scooter', x, z: 0.0, look: pick(r, [0x9e3c36, 0x23252f, 0xdfe2e8, 0x3b6296, 0xe7b84a]) });
    block(x - 0.85, -0.3, x + 0.85, 0.3, 'scooter');
  }
  for (let k = 0, n = int(r, 3); k < n; k++) {                    // against a wall, where there's no door
    const x = S.x0 + 2 + range(r, 0, SECTION_M - 4);
    if (inMouth(x, 1.5) || S.doors.some(d => d.z === Z.front && Math.abs(d.x - x) < 1.8) || S.props.some(p => p.z < -4 && Math.abs((p.x ?? p.x0) - x) < 2)) continue;
    S.props.push({ kind: 'scooter', x, z: -4.7, look: pick(r, [0x9e3c36, 0x23252f, 0xdfe2e8, 0x3b6296]) });
    block(x - 0.85, Z.front, x + 0.85, -4.38, 'scooter');
  }
  // A neighbourhood's generator, on a side street's pavement: a green cabinet, its exhaust, its cables.
  for (const g of S.gapsN) if (g.kind === 'side' && chance(r, 0.6)) {
    const left = chance(r, 0.5), x = left ? g.x0 + 0.75 : g.x1 - 0.75, z = -14 - range(r, 0, 12);
    S.props.push({ kind: 'generator', x, z });
    block(x - 0.6, z - 1.1, x + 0.6, z + 1.1, 'generator');
  }
  // The stairs: their handrails, down each side.
  for (const g of S.gapsN) if (g.kind === 'stairs') for (const x of [g.x0 + 0.2, g.x1 - 0.2]) { block(x - 0.05, Z.north, x + 0.05, Z.front - 1, 'rail'); }
}

// ---------- the looks ----------

const LOOKS = {
  pave: [['pavers', 3], ['broken', 2.5], ['terrazzo', 2], ['slabs', 1]],
  kerb: [['painted', 2], ['yellow', 2], ['redwhite', 2], ['worn', 2]],
  road: [['patched', 3], ['worn', 2.5], ['fresh', 1], ['dusty', 1]],
  lanes: [['dashed', 2.5], ['none', 2], ['solid', 1]],
  zebra: [['faded', 3], ['white', 2], ['ghost', 1.5]],
  lamp: [['modern', 3], ['crook', 2.5], ['twin', 1]],
  pathLamp: [['globe', 2], ['lantern', 2], ['modern', 1]],
  sideLamp: [['modern', 2], ['crook', 2]],
  railing: [['pipe', 2.5], ['cast', 2], ['mesh', 1.5]],
  bench: [['backless', 2.5], ['slats', 2], ['granite', 1.5]],
  bin: [['box', 2], ['tulip', 1]],
  hedge: [['bougainvillea', 2.5], ['oleander', 2], ['ficus', 2], ['myrtle', 1]],
  rowTree: [['ficus', 4], ['fan', 2], ['jacaranda', 1.5]],
  parkTree: [['ficus', 3], ['fan', 2], ['pine', 2.5], ['jacaranda', 1.5], ['olive', 1], ['palm', 1]],
  lane: [['asphalt', 3], ['patched', 2], ['concrete', 1]],
  alley: [['concrete', 2], ['setts', 1.5], ['dirt', 1]],
  stairs: [['stone', 2], ['painted', 1.5], ['concrete', 1.5]],
  car: [['sedan', 3], ['suv', 2.5], ['boxy', 2], ['hatch', 2], ['van', 0.8]],
  postbox: [['blue', 1]],
  pond: [['stone', 2], ['granite', 1]],
  fountain: [['basin', 2], ['tiers', 1.5], ['vase', 1]],
  monument: [['statue', 2], ['bust', 2]],
  kiosk: [['cabin', 2], ['glass', 1.5]],
  beds: [['flowers', 2], ['box', 1]],
};

export const BEIRUT = {
  id: 'beirut', name: 'Beirut', country: 'lb', lang: 'ar', geo: { lat: 33.89, lon: 35.5, tz: 2 }, drive: 'right',
  streetName,
  boulevardName: (seed, row) => at(AVENUES, seed, row, 'boulevard'),
  parkName: (seed, row, i) => at(JARDINS, seed, row, Math.floor(i / STRETCH), 'park'),
  gaps, parkShare: 0.3, building, dress, furnish, LOOKS, SHOPS, carColours: CAR_COLOURS, postbox: 'none', taxi: 'servis',
  // The terrace's shapes (sim/map/street.js terraceOf()): an impasse now and then, alleys that dogleg
  // up the hill, a place set back with its fountain.
  lot: 'parking',                                                  // (beside a dogleg, before its turn)
  terrace: { court: 0.22, square: 0.1, jog: 0.32 },
  courtName: (seed, row, i) => at(['Impasse Sursock', 'Impasse Saint-Nicolas', 'Impasse Kassab', 'Impasse Hobeiche', 'Impasse Mar Mitr', 'Impasse Trad', 'Impasse Bustros'], seed, row, i, 'court'),
  squareName: (seed, row, i) => at(['Place Debbas', 'Place Sassine', 'Place Saint-Nicolas', 'Place Tabaris', 'Place Mar Mikhael', 'Place Chehab'], seed, row, i, 'square'),
  kiosks: [['قهوة', 0x6e2a2e], ['CAFE', 0x24503a], ['جرائد', 0x283f6b], ['كعك', 0x9e3c36]], news: 'جرائد', stop: { frame: 0x6a7182, roof: 0x24503a, sign: ['BUS', 0x24503a, 0xf4efe6] }, bus: { kind: 'van', body: 0xf4efe6, stripe: 0x9e3c36, len: 5.4 },
  litter: 0, cables: true,                                         // (no autumn on the ground; its cables slung across: src/render/town.js)
  people: {
    name: (r, sex) => beirutName(r, sex),
    langs: (r) => ({ ar: 'native', ...(chance(r, 0.55) ? { fr: pick(r, ['working', 'fluent']) } : {}), ...(chance(r, 0.6) ? { en: pick(r, ['basic', 'working', 'fluent']) } : {}), ...(chance(r, 0.08) ? { hy: 'native' } : {}) }),
    look: (r, sex, age) => beirutLook(r, sex, age),
  },
};
