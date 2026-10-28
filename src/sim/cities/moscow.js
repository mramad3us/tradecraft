// TRADECRAFT sim: Moscow, as a city profile (sim/cities/index.js): the city the game began in, kept
// exactly as it was generated before there were other cities (the same draws from the same streams,
// so every street of a Moscow game is the street it always was).
//
// Pre-revolutionary plaster in ochres, pinks and greens with white trim, red brick, or a Stalinist
// block with a heavy base; shops on the ground floor, signs in Cyrillic, arches through to the
// courtyards (building()); each building in a dress of its style (dressBuilding()). Lanes and
// boulevards with Moscow names; Russian passers-by (sim/people.js); November's limes and birches.
import { stream, int, range, pick, chance, weighted } from '../rng.js';
import { SECTION_M, GAP_M, STRETCH, GROUND_H, FLOOR_H, at, toneOf } from '../map/layout.js';
import { russianName, streetLook } from '../people.js';

// Names. A row is a street (and its boulevard, its parks), each side street a lane.
const STREETS = ['Pokrovka', 'Maroseyka', 'Myasnitskaya', 'Sretenka', 'Solyanka', 'Petrovka', 'Pyatnitskaya', 'Ostozhenka',
  'Prechistenka', 'Bolshaya Ordynka', 'Varvarka', 'Ilyinka', 'Bolshaya Nikitskaya', 'Povarskaya', 'Sivtsev Vrazhek', 'Zabelina'];
const BOULEVARDS = ['Pokrovsky', 'Chistoprudny', 'Yauzsky', 'Rozhdestvensky', 'Sretensky', 'Petrovsky', 'Strastnoy', 'Tverskoy', 'Nikitsky', 'Gogolevsky'];
const PARKS = ['the Lyalin garden', 'the Ilyinsky square', 'the Novopushkinsky garden', 'the Morozov garden', 'the Pokrovsky garden',
  'the Bauman garden', 'the Myasnitsky square', 'the Khitrovka square', 'the Ivanovsky garden', 'the Starosadsky square'];
const LANE_NAMES = ['Kolpachny', 'Armyansky', 'Krivokolenny', 'Potapovsky', 'Lyalin', 'Khokhlovsky', 'Podkopayevsky', 'Starosadsky',
  'Petroverigsky', 'Sverchkov', 'Bobrov', 'Milyutinsky', 'Furkasovsky', 'Kostyansky', 'Lukov', 'Pechatnikov', 'Bolshoy Kozlovsky',
  'Maly Zlatoustinsky', 'Spasoglinishchevsky', 'Barashevsky', 'Durasovsky', 'Lyalin', 'Tokmakov', 'Gusyatnikov'];
const streetName = (seed, row) => at(STREETS, seed, row, 'street');

/** A row's ways north through its terrace in section i (sim/map/street.js gapsOf()). */
function gaps(seed, row, i) {
  const r = stream('street-gaps', seed, row, i), x0 = i * SECTION_M, gaps = [];
  if (chance(r, 0.35)) { const gx = x0 + 6 + int(r, 23); gaps.push({ x0: gx, x1: gx + GAP_M.side, kind: 'side' }); }
  // An alley, a building's width from anything else; and every other section has one at least, so a
  // way north is never more than two sections off.
  if (chance(r, 0.35) || (!gaps.length && (i % 2 + 2) % 2 === 0)) {
    for (let k = 0; k < 6; k++) {
      const ax = x0 + 8 + int(r, 26);
      if (gaps.every(g => ax + GAP_M.alley < g.x0 - 8 || ax > g.x1 + 8)) { gaps.push({ x0: ax, x1: ax + GAP_M.alley, kind: 'alley' }); break; }
    }
  }
  for (const g of gaps) g.name = g.kind === 'side' ? `${at(LANE_NAMES, seed, row, i, Math.round(g.x0), 'lane')} Lane` : `an alley off ${streetName(seed, row)}`;
  return gaps;
}

// Shops: their sign, in Cyrillic, and what they sell (the game's later business: clothes, a phone…).
const SHOPS = {
  pharmacy: 'АПТЕКА', grocery: 'ПРОДУКТЫ', cafe: 'КАФЕ', flowers: 'ЦВЕТЫ', bakery: 'ХЛЕБ', books: 'КНИГИ',
  optician: 'ОПТИКА', bank: 'БАНК', tobacco: 'ТАБАК', exchange: 'ОБМЕН ВАЛЮТ', bar: 'БАР', clothes: 'ОДЕЖДА',
  shoes: 'ОБУВЬ', watches: 'ЧАСЫ', phones: 'СВЯЗЬ', shawarma: 'ШАУРМА', beer: 'ПИВО', deli: 'ГАСТРОНОМ', restaurant: 'РЕСТОРАН',
  gym: 'ФИТНЕС', club: 'САМБО', school: 'ЯЗЫКИ',
};
const SHOP_WEIGHTS = [['grocery', 3], ['pharmacy', 2.5], ['cafe', 3], ['clothes', 2], ['flowers', 1.5], ['bakery', 1.5],
  ['books', 1], ['optician', 1], ['bank', 1.2], ['tobacco', 1], ['exchange', 1], ['bar', 1.2], ['shoes', 1], ['watches', 0.6],
  ['phones', 1.2], ['shawarma', 1], ['beer', 0.8], ['deli', 1], ['restaurant', 1], ['gym', 0.6], ['club', 0.4], ['school', 0.4]];
// Sign boards: [background, letters, border].
const SIGN_COLOURS = [[0x1b2541, 0xf6f4ee, 0x8f96a6], [0x24503a, 0xf6f4ee, 0x173327], [0x6e2a2e, 0xf8e08a, 0x23252f],
  [0x23252f, 0xe7b84a, 0x6a7182], [0xf6f4ee, 0x9e3c36, 0x6a7182], [0x283f6b, 0xf8e08a, 0xb9862e], [0x4a2a52, 0xf6f4ee, 0x23252f]];

// Moscow plaster: ochre, cream, salmon, pale green, blue-grey, mauve; Stalinist beige and grey; brick.
const PLASTER = [0xd8b56c, 0xe2d2a8, 0xd9a48a, 0xa9bf9c, 0xb7c3cc, 0xc9a9b4, 0xe0c38a, 0xc98f6e];
const STALIN = [0xc8b89a, 0xb8b0a4, 0xd2bfa0, 0xa8a49c];
const BRICK = [0x9e3c36, 0x8f3a30, 0xa8503c];
const TRIM = 0xf4efe6;
const DOOR_COLOURS = [0x356f42, 0x6e2a2e, 0x283f6b, 0x47302a, 0x23252f, 0x4a2a52];
const CAR_COLOURS = [0x3b6296, 0x9e3c36, 0xdfe2e8, 0x23252f, 0x6a7182, 0x24503a, 0x8f96a6, 0xf6f4ee, 0x47302a];

// A building and its facade: { x0, x1, z, h, d, wall, wallColor, roof, ops, seed }.
function building(r, x0, x1, z, S, { far = false } = {}) {
  const w = x1 - x0;
  const style = far ? pick(r, ['merchant', 'brick']) : weighted(r, [['merchant', 6], ['brick', 2], ['stalin', w >= 14 ? 2.5 : 0]]);
  const floors = style === 'stalin' ? 7 + int(r, 3) : 3 + int(r, 3);
  const h = GROUND_H + FLOOR_H * (floors - 1) + (style === 'stalin' ? 1.2 : 0.8);
  const wall = style === 'brick' ? 'brick' : 'plaster';
  const wallColor = style === 'brick' ? pick(r, BRICK) : style === 'stalin' ? pick(r, STALIN) : pick(r, PLASTER);
  const ops = [];
  const B = { x0, x1, z, h, d: far ? 16 : 35, wall, wallColor, roof: 'flat', ops, style, seed: int(r, 1e6) };

  // The ground floor: shops, doors, now and then an arch through to the courtyard.
  if (style === 'stalin') {
    ops.push(['rect', 0, 0, w, GROUND_H + FLOOR_H, toneOf(wallColor, -1)]);   // a heavy base, two storeys of stone
    for (let y = 0.6; y < GROUND_H + FLOOR_H; y += 0.6) ops.push(['rect', 0, y, w, 0.06, toneOf(wallColor, -2)]);
  } else ops.push(['rect', 0, 0, w, 0.45, style === 'brick' ? 0x5c5650 : toneOf(wallColor, -2)]);
  let x = 0.6 + range(r, 0, 0.6);
  let arch = !far && w >= 11 && chance(r, 0.45);
  while (x < w - 1.4) {
    const room = w - 0.6 - x;
    if (arch && room > 4 && chance(r, 0.4)) {
      ops.push(['arch', x, 3.0, 3.3]);
      S.doors.push({ x: x0 + x + 1.5, z, w: 3, kind: 'arch' });
      x += 3.0 + 0.8; arch = false; continue;
    }
    if (!far && room > 3.6 && chance(r, 0.6)) {                    // a shop: window, door, a sign above
      const sw = Math.min(room, 3.4 + int(r, 3) * 0.8);
      const kind = weighted(r, SHOP_WEIGHTS);
      const [bg, fg, border] = pick(r, SIGN_COLOURS);
      ops.push(['shopfront', x, sw - 1.3, 2.7, { goods: [pick(r, [0xf6f4ee, 0xdfe2e8]), pick(r, [0x9e3c36, 0x3b6296, 0x356f42, 0xe7b84a]), pick(r, [0x8f6345, 0xc95c45, 0x5d8fc2])] }]);
      ops.push(['door', x + sw - 1.2, 1.1, 2.4, { color: 0x23252f, frame: 0x23252f }]);
      ops.push(['sign', x, 3.05, sw - 0.1, 0.75, SHOPS[kind], { bg, fg, border }]);
      S.doors.push({ x: x0 + x + sw - 0.65, z, w: 1.1, kind: 'shop', shop: kind, pane: { x0: x0 + x, x1: x0 + x + sw - 1.3, z } });
      x += sw + 0.5 + range(r, 0, 0.6);
      continue;
    }
    if (room > 1.6 && chance(r, 0.5)) {                            // an entrance: a door with a canopy of plaster over it
      ops.push(['door', x, 1.3, 2.5, { color: pick(r, DOOR_COLOURS), frame: TRIM }]);
      S.doors.push({ x: x0 + x + 0.65, z, w: 1.3, kind: 'entrance' });
      x += 1.3 + 0.9 + range(r, 0, 0.6);
      continue;
    }
    if (room > 1.4) ops.push(['window', x, 1.0, 1.2, 1.7, { frame: TRIM, lintel: TRIM }]);
    x += 1.2 + 0.9 + range(r, 0, 0.5);
  }
  // Upper floors: bays of windows over a string course.
  ops.push(['band', GROUND_H, style === 'brick' ? 0xc4bba9 : TRIM]);
  const bays = Math.max(2, Math.round(w / (style === 'stalin' ? 2.2 : 2.7)));
  const bay = w / bays, ww = style === 'stalin' ? 1.0 : 1.15, wh = style === 'stalin' ? 2.0 : 1.75;
  const shutters = style === 'merchant' && chance(r, 0.12) ? pick(r, [0x356f42, 0x283f6b]) : null;
  for (let f = 1; f < floors; f++) {
    const y = GROUND_H + FLOOR_H * (f - 1) + (FLOOR_H - wh) / 2 + 0.15;
    for (let k = 0; k < bays; k++) {
      const flowers = chance(r, 0.06) ? [0xc95c45, 0xe8896a, 0xf8e08a] : null;
      ops.push(['window', bay * k + (bay - ww) / 2, y, ww, wh, { frame: TRIM, lintel: style === 'brick' ? 0xe2dac6 : TRIM, shutters, flowers, curtain: chance(r, 0.15) ? pick(r, [0xc95c45, 0xe2dac6, 0x7a4a86]) : null }]);
    }
    if (style !== 'brick' && f === 1) ops.push(['band', y - 0.35, TRIM]);
  }
  ops.push(['cornice', h - 0.75, style === 'stalin' ? 0.55 : 0.4, style === 'brick' ? 0xc4bba9 : TRIM]);
  if (style === 'merchant' && chance(r, 0.15)) ops.push(['ivy', 0.3 + range(r, 0, w - 3), 1.6 + range(r, 0, 1.5), 3 + range(r, 0, 3)]);
  return B;
}

const LOOKS = {
  pave: [['slabs', 4], ['squares', 2.2], ['granite', 1.6], ['pavers', 2.2], ['asphalt', 1.6]],
  kerb: [['granite', 3], ['concrete', 2.5], ['worn', 2], ['painted', 1]],
  road: [['worn', 3], ['fresh', 1.5], ['patched', 2], ['grey', 2]],
  lanes: [['dashed', 4], ['solid', 1.5], ['double', 1.5], ['long', 1.5], ['combo', 1.2]],
  zebra: [['white', 3], ['yellow', 3], ['faded', 2], ['fresh', 1.5], ['raised', 1.2]],
  lamp: [['lantern', 3], ['crook', 2.5], ['twin', 1.5], ['modern', 2]],
  pathLamp: [['lantern', 2], ['globe', 2.5], ['twin', 1.5], ['torch', 2]],
  sideLamp: [['crook', 2], ['lantern', 2], ['modern', 1.5], ['globe', 1]],
  railing: [['spears', 3], ['hoops', 2], ['cast', 2], ['pipe', 1.5], ['mesh', 1.2]],
  bench: [['slats', 3], ['moscow', 2.5], ['backless', 1.5], ['sofa', 1.5], ['granite', 1]],
  bin: [['green', 2.5], ['urn', 2.5], ['basket', 2], ['tulip', 2], ['box', 1.5]],
  hedge: [['privet', 3], ['thuja', 2], ['hawthorn', 2], ['twigs', 1.5]],
  // Trees: a boulevard's rows are planted alike (limes most of all); a park is mixed.
  rowTree: [['lime', 5], ['maple', 2], ['poplar', 2], ['birch', 1.2], ['oak', 1]],
  parkTree: [['lime', 3], ['maple', 2.5], ['birch', 2.5], ['oak', 1.5], ['poplar', 1.5], ['spruce', 1.8]],
  lane: [['asphalt', 3], ['setts', 2], ['patched', 2], ['slabs', 1.5]],
  alley: [['setts', 3], ['asphalt', 2], ['concrete', 2], ['dirt', 1.5]],
  car: [['sedan', 3], ['boxy', 2.5], ['hatch', 2], ['estate', 1.5], ['van', 1], ['suv', 1.2]],
  postbox: [['blue', 3], ['soviet', 2], ['red', 1], ['pillar', 1.5]],
  pond: [['stone', 2], ['granite', 1.5], ['reeds', 1.5], ['fenced', 1.2]],
  fountain: [['basin', 2], ['vase', 1.5], ['boxed', 1.5], ['tiers', 1.5]],
  monument: [['statue', 2], ['poet', 1.5], ['seated', 1.5], ['bust', 1.5], ['soldier', 1]],
  kiosk: [['plaster', 2], ['news', 2], ['glass', 1.5], ['cabin', 1.5]],
  beds: [['box', 1.5], ['kale', 2], ['boughs', 1.5], ['stalks', 1]],
  // A building's dress, by its style: plaster's orders, brick's bonds and dressings, the Soviet blocks.
  merchant: [['classic', 3], ['pediment', 2], ['rustic', 2], ['pilaster', 1.5], ['moderne', 1.2], ['constructivist', 0.8]],
  brick: [['red', 2.5], ['dressed', 2], ['yellow', 1.5], ['arched', 1.5], ['painted', 1]],
  stalin: [['classic', 2], ['ornate', 2], ['tiled', 1.2], ['panel', 1.5], ['silicate', 1]],
};
const CONSTRUCTIVIST = [0xdfe2e8, 0xc4bba9, 0xe2dac6, 0xb8bdc8];
const YELLOW_BRICK = [0xd6ad7a, 0xe0c38a, 0xc9a46a];
const PAINTED_BRICK = [0xa9bf9c, 0xd8b56c, 0xb7c3cc, 0xd9a48a];
const PANEL = [0xb8bdc8, 0xc4bba9, 0xdfe2e8, 0xa8a49c];
const ROOFS = [[0x6a7182, 3], [0x356f42, 2], [0x6e2a2e, 1.5], [0x8f96a6, 1.5]];


// A building's dress: its version of its style, its roof, pipes, a balcony, posters, scaffolding, the
// make of its doors, arches and shopfronts. Ops are rewritten (windows get heads and surrounds) and
// added (quoins, pilasters, rustication, friezes, panels, loggias, pipes), never moved: the doors,
// shops and arches stay where the sim knows them.
function dressBuilding(B, L) {
  const w = B.x1 - B.x0, dress = weighted(L, LOOKS[B.style]);
  const v = { dress, pipes: [], ac: 0, posters: 0, hanging: [] };
  B.look = v;
  B.roofColor = weighted(L, ROOFS);
  v.roofKit = weighted(L, [['ac', 3], ['chimneys', 2], ['hut', 1.5], ['antenna', 1.5], ['none', 1]]);
  if (dress === 'constructivist') { B.wallColor = pick(L, CONSTRUCTIVIST); B.ops[0][5] = toneOf(B.wallColor, -2); }
  if (dress === 'yellow') B.wallColor = pick(L, YELLOW_BRICK);
  if (dress === 'painted') B.wallColor = pick(L, PAINTED_BRICK);
  if (dress === 'panel') { B.wall = 'concrete'; B.wallColor = pick(L, PANEL); B.roofColor = 0x8f96a6; }
  if (dress === 'silicate') { B.wall = 'brick'; B.wallColor = 0xcfcac2; B.roofColor = 0x8f96a6; }
  const soviet = dress === 'panel' || dress === 'silicate';
  const trim = B.style === 'brick' ? (dress === 'dressed' || dress === 'yellow' ? TRIM : 0xc4bba9) : TRIM;
  const ground = [], upper = [], rest = [];
  for (const op of B.ops) (op[0] === 'window' && op[2] >= GROUND_H ? upper : (op[2] ?? 0) < GROUND_H && ['window', 'door', 'shopfront', 'arch', 'sign'].includes(op[0]) ? ground : rest).push(op);
  const floorOf = (y) => Math.round((y - GROUND_H) / FLOOR_H) + 1;
  const floors = Math.max(1, ...upper.map(op => floorOf(op[2])));
  const head = { classic: null, pediment: 'pediment', rustic: 'keystone', pilaster: null, moderne: 'round', constructivist: 'none',
    red: null, dressed: 'keystone', yellow: 'keystone', arched: 'segment', painted: null,
    ornate: 'pediment', tiled: null, panel: 'none', silicate: 'none' }[dress];
  const doorStyle = soviet ? 'metal' : weighted(L, [['panel', 3], ['glazed', 2], ['arched', 1.5], ['metal', 1]]);
  const canopy = !soviet && chance(L, 0.4);
  const frame = soviet ? 0x6a7182 : weighted(L, [[0x23252f, 3], [0x47302a, 2], [0xdfe2e8, 1.2], [0x24503a, 1.2], [0x6e2a2e, 1]]);
  const ac = chance(L, soviet ? 0.5 : 0.3) ? range(L, 0.06, 0.16) : 0;
  // The ground floor: doors by the building's make, arches each their own, shopfronts in its frame
  // colour, a sign each its own; windows barred now and then.
  const bars = chance(L, 0.3);
  for (const op of ground) {
    const o = op[op.length - 1];
    if (op[0] === 'door' && o.frame !== 0x23252f) op[op.length - 1] = { ...o, style: doorStyle, canopy };
    else if (op[0] === 'door') op[op.length - 1] = { ...o, color: frame, frame, style: 'shop' };
    else if (op[0] === 'shopfront') op[op.length - 1] = { ...o, frame };
    else if (op[0] === 'sign') {
      op[op.length - 1] = { ...o, style: weighted(L, [['board', 3], ['letters', 1.5], ['lightbox', 1.5], ['hanging', op[5].length <= 4 ? 2 : 0]]) };
      if (op[op.length - 1].style === 'hanging') { op[op.length - 1].style = 'board'; v.hanging.push({ x: op[1] + op[3] - 0.55, text: op[5], bg: o.bg, fg: o.fg }); }   // (over its door, beside the board)
    }
    else if (op[0] === 'arch') op.push({ kind: weighted(L, [['open', 2], ['gate', 2], ['rect', soviet ? 3 : 1], ['doors', 1.5]]) });
    else if (op[0] === 'window') op[op.length - 1] = { ...o, bars, head: soviet ? 'none' : head === 'keystone' || head === 'segment' ? head : null };
  }
  // Awnings over some shops (cafés, bakeries, flowers most of all), clear of the sign above.
  v.awnings = [];
  for (const op of ground) if (op[0] === 'shopfront') {
    const i = ground.indexOf(op), sign = ground.slice(i).find(o => o[0] === 'sign');
    const want = /КАФЕ|ХЛЕБ|ЦВЕТЫ|РЕСТОРАН|БАР|ПИВО/.test(sign?.[5] ?? '') ? 0.55 : 0.15;
    if (chance(L, want) && !v.hanging.some(h => Math.abs(h.x - (op[1] + op[2] + 0.75)) < 1.2)) v.awnings.push({ x0: op[1] - 0.1, x1: op[1] + op[2] + 1.3, color: pick(L, [0x9e3c36, 0x24503a, 0x283f6b, 0x6e2a2e]) });
  }
  // Upper floors: heads and surrounds by the dress; balconies; air conditioners.
  for (const op of upper) {
    const f = floorOf(op[2]), o = op[op.length - 1];
    let h = head;
    if (dress === 'pediment' || dress === 'ornate') h = f === 1 ? 'pediment' : f === 2 ? 'hood' : null;
    op[op.length - 1] = { ...o, head: h, surround: ['rustic', 'dressed', 'yellow', 'tiled', 'ornate'].includes(dress) ? trim : null,
      lintel: h === 'none' ? null : o.lintel, frame: soviet ? pick(L, [0xf6f4ee, 0xdfe2e8, 0x8f6345]) : o.frame,
      ac: ac && chance(L, ac) ? pick(L, ['below', 'side']) : null, sat: chance(L, 0.012) };
  }
  const extra = [], over = [];
  const bays = upper.filter(op => floorOf(op[2]) === 1).map(op => [op[1], op[3]]);
  if (dress === 'constructivist') {                                 // ribbon windows: a floor's bays as one band of glass
    for (let f = 1; f <= floors; f++) {
      const row = upper.filter(op => floorOf(op[2]) === f);
      if (!row.length) continue;
      const first = row[0], last = row.at(-1);
      first[3] = last[1] + last[3] - first[1];
      first[op_(first)] = { ...first[op_(first)], ribbon: true, curtain: null, flowers: null, shutters: null, ac: null };
      for (const op of row.slice(1)) op[0] = 'skip';
    }
    for (const op of rest) if (op[0] === 'cornice') { op[0] = 'parapet'; } else if (op[0] === 'band' && op[1] !== GROUND_H) op[0] = 'skip';
  }
  if (dress === 'rustic') extra.push(['rustic', 0.45, GROUND_H, toneOf(B.wallColor, -1)]);
  if (dress === 'tiled') extra.push(['tiles', GROUND_H + FLOOR_H, B.h - 0.8]);
  if (['pediment', 'dressed', 'yellow', 'ornate'].includes(dress)) extra.push(['quoins', GROUND_H, B.h - 0.75, trim]);
  if ((dress === 'pilaster' || dress === 'ornate') && bays.length > 1) {
    const xs = [];
    for (let k = 1; k < bays.length; k++) xs.push((bays[k - 1][0] + bays[k - 1][1] + bays[k][0]) / 2);
    extra.push(['pilasters', dress === 'ornate' ? xs.filter((_, k) => k === 0 || k === xs.length - 1) : xs, GROUND_H + (dress === 'ornate' ? FLOOR_H : 0.1), B.h - 0.75, trim]);
  }
  if (dress === 'moderne' || dress === 'ornate' || dress === 'arched') over.push(['frieze', B.h - 0.75 - 0.5, 0.45, dress === 'arched' ? 'corbel' : dress === 'moderne' ? 'tiles' : 'garland', dress === 'moderne' ? pick(L, [0x2f6b62, 0x3b6296, 0x356f42]) : dress === 'arched' ? toneOf(B.wallColor, -1) : trim]);
  if (soviet) {
    for (const op of rest) if (op[0] === 'cornice') op[0] = 'parapet'; else if (op[0] === 'band' && op[1] !== GROUND_H) op[0] = 'skip';
    if (B.style === 'stalin') { B.ops[0][4] = GROUND_H; B.ops[0][5] = toneOf(B.wallColor, -1); B.ops.forEach(op => { if (op[0] === 'rect' && op[4] === 0.06) op[0] = 'skip'; }); }
    if (dress === 'panel') extra.push(['panels', GROUND_H, B.h - 0.8, bays.length, FLOOR_H]);
    const cols = bays.length > 3 ? [1, bays.length - 2] : [0];
    if (chance(L, 0.8)) over.push(['loggias', cols.map(c => bays[c]).filter(Boolean), GROUND_H, floors, pick(L, [0xdfe2e8, 0xa0978a, 0x8f96a6, 0xc4bba9]), FLOOR_H]);
  } else if (chance(L, 0.35) && bays.length >= 3 && floors >= 2) {  // a balcony on the first floor up, over the middle bays
    const m = Math.floor(bays.length / 2), span = bays.length >= 5 ? [m - 1, m + 1] : [m, m];
    over.push(['balcony', bays[span[0]][0] - 0.3, bays[span[1]][0] + bays[span[1]][1] + 0.3, GROUND_H + 0.15, chance(L, 0.5) ? 'iron' : 'stone', trim]);
  }
  // Drainpipes down the party walls, now and then; posters on blank wall; scaffolding, rarely.
  for (const x of [0.18, w - 0.38]) if (!soviet && chance(L, 0.45)) v.pipes.push(x);
  for (const x of v.pipes) over.push(['pipe', x, B.h - 0.75, pick(L, [0x8f96a6, 0x6a7182, toneOf(B.wallColor, -1)])]);
  const used = ground.filter(op => ['window', 'door', 'shopfront', 'arch'].includes(op[0])).map(op => op[0] === 'arch' ? [op[1] - 0.2, op[1] + op[2] + 0.2] : op[0] === 'shopfront' ? [op[1], op[1] + op[2]] : [op[1] - 0.15, op[1] + op[op[0] === 'window' ? 3 : 2] + 0.15]).sort((p, q) => p[0] - q[0]);
  let from = 0.5;
  for (const [x0, x1] of [...used, [w - 0.5, w]]) {
    if (x0 - from >= 1.9 && !soviet && chance(L, 0.45)) { over.push(['poster', from + (x0 - from - 1.25) / 2, 0.75, 1.25, 1.6, posterOf(L)]); v.posters++; }
    from = Math.max(from, x1);
  }
  if (!soviet && floors >= 2 && chance(L, 0.05)) over.push(['scaffold', GROUND_H + 0.3, B.h - 0.6, pick(L, [0x356f42, 0x283f6b, 0x6a7182]), FLOOR_H]);
  B.ops = [...B.ops.slice(0, 1), ...extra, ...B.ops.slice(1), ...over].filter(op => op[0] !== 'skip');
}
const op_ = (op) => op.length - 1;
const POSTERS = [['ТЕАТР', 0xe2dac6, 0x9e3c36, 0x283f6b], ['КИНО', 0x23252f, 0xf8e08a, 0x6e2a2e], ['ДЖАЗ', 0x283f6b, 0xf8e08a, 0x4a2a52],
  ['ЦИРК', 0xf8e08a, 0x9e3c36, 0x3b6296], ['БАЛЕТ', 0xf6f4ee, 0x4a2a52, 0xc95c45], ['ОПЕРА', 0x6e2a2e, 0xf6f4ee, 0x23252f]];
function posterOf(L) { const [words, bg, fg, art] = pick(L, POSTERS); return { words, bg, fg, art }; }

export const MOSCOW = {
  id: 'moscow', name: 'Moscow', country: 'ru', lang: 'ru', geo: { lat: 55.75, lon: 37.62, tz: 3 }, drive: 'right',
  streetName,
  boulevardName: (seed, row) => `${at(BOULEVARDS, seed, row, 'boulevard')} Boulevard`,
  parkName: (seed, row, i) => at(PARKS, seed, row, Math.floor(i / STRETCH), 'park'),
  gaps, parkShare: 0.35, building, dress: dressBuilding, LOOKS, SHOPS, carColours: CAR_COLOURS, postbox: 'wall', taxi: 'taxi',
  kiosks: [['ПЕЧАТЬ', 0x24503a], ['КОФЕ', 0x6e2a2e], ['ЦВЕТЫ', 0x283f6b], ['МОРОЖЕНОЕ', 0x3b6296]], news: 'ПЕЧАТЬ', stop: { frame: 0x6a7182, roof: 0x3b6296, sign: ['ОСТАНОВКА', 0x3b6296, 0xf4efe6] }, bus: { kind: 'single', body: 0xf4efe6, stripe: 0x24503a, len: 11 },
  // Passers-by: Russian names, Moscow's November dress (sim/people.js).
  people: {
    name: (r, sex) => russianName(r, sex),
    langs: (r) => ({ ru: 'native', ...(chance(r, 0.25) ? { en: pick(r, ['basic', 'working']) } : {}) }),
    look: (r, sex, age) => streetLook(r, sex, age),
  },
};
