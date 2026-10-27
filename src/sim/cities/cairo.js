// TRADECRAFT sim: Cairo, as a city profile (sim/cities/index.js). Downtown, Wust el-Balad and the
// lanes toward Islamic Cairo: belle époque blocks gone the colour of the dust, old houses with their
// mashrabiyas, concrete and red brick going up a floor at a time, a mosque and its minaret.
//
// The buildings (building()):
//   - khedival: five to seven storeys of sandstone-coloured plaster over a rusticated ground floor
//     of arched shopfronts; balconies on every floor, stone or iron; tall windows behind louvred
//     shutters, most of them shut against the sun; a heavy cornice;
//   - islamic: an old house: its ground floor in ablaq (courses of red and pale stone), a carved
//     wooden door, small barred windows; the floors over it plastered ochre, a mashrabiya (a lattice
//     of turned wood) bayed out on each;
//   - concrete: a frame of grey concrete filled with red brick, never finished: rebar standing off the
//     roof for the next floor; balconies hung with washing; shops behind roller shutters;
//   - deco: a 1930s block, cream, its balconies in bands;
//   - mosque: ablaq and pointed arches, a portal, crenellations along the top, and at its corner the
//     minaret (src/render/town.js draws it, stage by stage, up over the roofs).
// Signs in Arabic, some with English beside them (sim/map/street.js SHOPS: 'عربي|LATIN'); printed
// banners over the shops. On the street: handcarts at the kerb (fruit, foul in its copper pot, sweet
// potatoes, bread), a vendor's stall against a wall, palms and ficus, dust in the gutters, high kerbs
// painted black and white. Harets (narrow lanes) and souk passages lead north, the souks lined with
// stalls. Cars drive on the right.
import { stream, int, range, pick, chance, weighted, hash } from '../rng.js';
import { SECTION_M, GAP_M, STRETCH, Z, GROUND_H, FLOOR_H, at, toneOf } from '../map/layout.js';
import { cairoName, cairoLook } from './folk.js';
import { squareFurniture } from './square.js';
import { wordM, fit } from './signs.js';

// ---------- names ----------

const STREETS = ['Sharia Qasr el-Nil', 'Sharia Talaat Harb', 'Sharia Mohamed Farid', 'Sharia Sherif', 'Sharia Emad el-Din', 'Sharia Abdel Khalek Sarwat',
  'Sharia Adly', 'Sharia Huda Shaarawi', 'Sharia Champollion', 'Sharia Mahmoud Bassiouni', 'Sharia el-Bustan', 'Sharia Mohamed Mahmoud',
  'Sharia Clot Bey', 'Sharia el-Alfi', 'Sharia 26 July', 'Sharia el-Gomhoreya', 'Sharia Port Said', 'Sharia el-Azhar', 'Sharia el-Muizz', 'Sharia Khairat'];
const AVENUES = ['Sharia Salah Salem', 'Sharia el-Gezira el-Wusta', 'Sharia Abu el-Feda', 'Sharia Saray el-Gezira', 'Sharia Shagaret el-Dorr',
  'Sharia Ibn Zanki', 'Sharia el-Gaish', 'Sharia Ramses', 'Sharia Kasr el-Aini', 'Sharia el-Galaa'];
const MIDANS = ['Midan Talaat Harb', 'Midan Mustafa Kamel', 'Midan Falaki', 'Midan Bab el-Louq', 'Midan Orabi', 'Midan el-Opera', 'Midan Ataba',
  'Midan Lazoghli', 'Hadiqat el-Azbakiya', 'Hadiqat el-Horreya', 'Midan Sayyida Zeinab', 'Midan el-Hussein'];
const SIDE = ['Sharia Hoda', 'Sharia Saad Zaghloul', 'Sharia Mariette', 'Sharia el-Sheikh Rihan', 'Sharia Youssef el-Guindi', 'Sharia el-Borsa',
  'Sharia Antikhana', 'Sharia Hassan el-Akbar', 'Sharia el-Falaki', 'Sharia Nubar', 'Sharia el-Tahrir', 'Sharia Abdel Aziz'];
const HARAT = ['Haret el-Yahud', 'Haret el-Rum', 'Haret el-Saqqayin', 'Haret el-Wazir', 'Haret Zuweila', 'Darb el-Ahmar', 'Darb el-Labbana',
  'Darb Saada', 'Darb el-Gamamiz', 'Haret el-Darb el-Asfar', 'Haret el-Tablawi', 'Haret el-Shamashirgi', 'Darb el-Masmat', 'Haret el-Ghuriya'];
const SOUKS = ['Souk el-Attarin', 'Souk el-Nahhasin', 'Souk el-Khayamiya', 'Souk el-Fahhamin', 'Souk el-Silah', 'Souk el-Sagha', 'Souk el-Tawfiqiya', 'Souk el-Bakri'];
const streetName = (seed, row) => at(STREETS, seed, row, 'street');

/** A row's ways north in section i: a side street now and then; a haret; a souk passage; an alley. */
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
  if (chance(r, 0.25)) add('side', 5, 24);
  if (chance(r, 0.22)) add('souk', 6, 30);
  if (chance(r, 0.32)) add('haret', 6, 32);
  if (chance(r, 0.2) || (!out.length && (i % 2 + 2) % 2 === 0)) add('alley', 8, 30);
  for (const g of out) {
    const k = [seed, row, i, Math.round(g.x0), 'lane'];
    g.name = g.kind === 'side' ? at(SIDE, ...k) : g.kind === 'souk' ? at(SOUKS, ...k) : g.kind === 'haret' ? at(HARAT, ...k) : `a zuqaq off ${streetName(seed, row)}`;
  }
  return out;
}

// ---------- shops ----------

// Their kinds and their signs: Arabic, some with English beside it ('عربي|LATIN').
const SHOPS = {
  pharmacy: ['صيدلية|PHARMACY', 'صيدلية'], grocery: ['بقالة', 'سوبر ماركت|MARKET', 'بقالة|MARKET'], cafe: ['قهوة', 'مقهى|CAFE', 'قهوة|COFFEE'],
  juice: ['عصير|JUICE', 'عصير قصب', 'عصير'], koshary: ['كشري', 'كشري|KOSHARY'], foul: ['فول وطعمية', 'فول'], bakery: ['مخبز', 'عيش', 'مخبز|BAKERY'],
  sweets: ['حلويات', 'حلواني'], phones: ['موبايل|MOBILE', 'موبايلات'], clothes: ['ملابس', 'ملابس|FASHION'], shoes: ['أحذية', 'أحذية|SHOES'],
  exchange: ['صرافة|EXCHANGE'], bank: ['بنك|BANK'], restaurant: ['مطعم', 'مطعم|RESTAURANT'], spices: ['عطارة'], barber: ['حلاق', 'صالون|SALON'],
  butcher: ['جزارة', 'لحوم'], laundry: ['مكوجي', 'دراي كلين'], books: ['مكتبة', 'مكتبة|BOOKS'], optician: ['نظارات', 'نظارات|OPTICS'],
  watches: ['ساعات'], tobacco: ['سجائر', 'كشك'],
};
const SHOP_WEIGHTS = [['grocery', 3], ['cafe', 3], ['juice', 2], ['koshary', 1.2], ['foul', 1.5], ['pharmacy', 2], ['bakery', 1.5], ['sweets', 1.2],
  ['phones', 2.5], ['clothes', 2.5], ['shoes', 1.5], ['exchange', 0.6], ['bank', 0.6], ['restaurant', 1.2], ['spices', 0.8], ['barber', 1.2],
  ['butcher', 0.8], ['laundry', 1], ['books', 0.6], ['optician', 0.8], ['watches', 0.6], ['tobacco', 1]];
// Boards: [ground, letters, border]; banners: [ground, letters, band].
const BOARDS = [[0x24503a, 0xf6f4ee, 0x173327], [0x1b2541, 0xf8e08a, 0x14151c], [0xf6f4ee, 0x9e3c36, 0x6a7182], [0x6e2a2e, 0xf8e08a, 0x3f1a22], [0x23252f, 0xe7b84a, 0x14151c]];
const BANNERS = [[0x9e3c36, 0xf6f4ee, 0xe7b84a], [0xe7b84a, 0x9e3c36, 0x24503a], [0x3b6296, 0xf6f4ee, 0xe7b84a], [0x356f42, 0xf6f4ee, 0xe7b84a], [0xf6f4ee, 0x283f6b, 0x9e3c36], [0xc95c45, 0xf8e08a, 0x23252f]];

// ---------- the buildings ----------

const SAND = [0xd6b98a, 0xe0c38a, 0xcdb48c, 0xc8a878, 0xd9b090, 0xd8c09a, 0xc4a882];   // downtown's plaster, the dust's colour
const OCHRE = [0xc8a06a, 0xb9905a, 0xd6ad7a, 0xc49a6c];
const CREAM = [0xe2dac6, 0xf4efe6, 0xdfe2e8, 0xc4bba9];
const SHUTTERS = [0x356f42, 0x24503a, 0x47302a, 0x6b4636, 0x6a7182, 0x4c5262, 0x2f6b62];
const CAR_COLOURS = [0xf6f4ee, 0xf6f4ee, 0xdfe2e8, 0xb8bdc8, 0x23252f, 0x9e3c36, 0x3b6296, 0x6a7182, 0xc4bba9, 0x47302a];
const STYLES = [['khedival', 4], ['concrete', 3.5], ['islamic', 1.6], ['deco', 1.4], ['mosque', 0.6]];

/**
 * A building and its facade: { x0, x1, z, h, d, wall, wallColor, roof, ops, style, seed }; a mosque
 * has its minaret ({ x, h }: where it stands on the front, how high), drawn by the renderer.
 */
function building(r, x0, x1, z, S) {
  const w = x1 - x0, ops = [], seed = int(r, 1e6);
  const mosqueHere = S.buildings.some(B => B.style === 'mosque');
  const style = weighted(r, STYLES.map(([s, k]) => [s, s === 'mosque' && (mosqueHere || w < 12) ? 0 : s === 'deco' && w < 11 ? 0 : k]));
  const B = { x0, x1, z, h: 0, d: 35, wall: 'plaster', wallColor: pick(r, SAND), roof: 'flat', ops, style, seed };
  const door = (x, w, kind, extra = {}) => S.doors.push({ x: x0 + x + w / 2, z, w, kind, ...extra });
  const shop = (x, sw, { arched = false, roller = 0, banner = false } = {}) => {
    const kind = weighted(r, SHOP_WEIGHTS), words = fit(r, SHOPS[kind], sw - 0.1);
    ops.push(['shopfront', x, sw - 1.3, arched ? 2.6 : 2.75, { goods: [pick(r, [0xe7b84a, 0xc95c45, 0xf6f4ee]), pick(r, [0x9e3c36, 0x3b6296, 0x356f42, 0xe7b84a]), pick(r, [0x8f6345, 0xc95c45, 0x5d8fc2])], arched, roller }]);
    ops.push(['door', x + sw - 1.2, 1.1, 2.45, { color: 0x23252f, frame: 0x23252f }]);
    if (banner) { const [bg, fg, band] = pick(r, BANNERS); ops.push(['sign', x - 0.1, 3.0, sw + 0.1, 0.95, words, { bg, fg, band, style: 'banner' }]); }
    else { const [bg, fg, border] = pick(r, BOARDS); ops.push(['sign', x, arched ? 3.05 : 3.0, sw - 0.1, 0.8, words, { bg, fg, border, style: chance(r, 0.3) ? 'lightbox' : 'board' }]); }
    S.doors.push({ x: x0 + x + sw - 0.65, z, w: 1.1, kind: 'shop', shop: kind, pane: { x0: x0 + x, x1: x0 + x + sw - 1.3, z } });
  };
  const groundFloor = ({ shops = 0.7, arched = false, roller = 0, banner = 0.4, entrance = 0.5 }) => {
    let x = 0.4 + range(r, 0, 0.5);
    while (x < w - 1.4) {
      const room = w - 0.4 - x;
      if (room > 3.4 && chance(r, shops)) { const sw = Math.min(room, 3.4 + int(r, 3) * 0.8); shop(x, sw, { arched, roller: chance(r, roller) ? range(r, 0.3, 1) : 0, banner: chance(r, banner) }); x += sw + 0.45; continue; }
      if (room > 1.6 && chance(r, entrance)) {
        ops.push(['door', x, 1.4, 2.7, { color: pick(r, [0x47302a, 0x6b4636, 0x23252f, 0x24503a]), frame: toneOf(B.wallColor, -1), style: chance(r, 0.5) ? 'arched' : 'panel' }]);
        door(x, 1.4, 'entrance'); x += 2.2 + range(r, 0, 0.5); continue;
      }
      if (room > 1.4) ops.push(['window', x, 1.0, 1.1, 1.6, { frame: 0x6b4636, lintel: null, bars: true, head: 'none' }]);
      x += 1.1 + 0.9 + range(r, 0, 0.5);
    }
  };

  if (style === 'khedival') {
    const floors = 5 + int(r, 3);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 1.2;
    ops.push(['rustic', 0.45, GROUND_H, toneOf(B.wallColor, -1)]);
    groundFloor({ shops: 0.85, arched: chance(r, 0.6), banner: 0.35 });
    ops.push(['band', GROUND_H, toneOf(B.wallColor, 1)]);
    const bays = Math.max(2, Math.round(w / 2.7)), bay = w / bays, shut = pick(r, SHUTTERS), iron = chance(r, 0.5);
    for (let f = 1; f < floors; f++) {
      const y = GROUND_H + FLOOR_H * (f - 1) + 0.3;
      for (let k = 0; k < bays; k++) {
        ops.push(['window', bay * k + (bay - 1.1) / 2, y, 1.1, 2.3, { frame: 0xe2dac6, lintel: null, head: f === 1 ? 'pediment' : f % 2 ? 'round' : 'hood', surround: toneOf(B.wallColor, 1), louvres: chance(r, 0.55) ? shut : null, shutters: null }]);
      }
      // a balcony every floor: across the middle bays, or the whole front
      const all = chance(r, 0.4) || f === 1;
      const a = all ? 0.3 : bay * Math.floor(bays / 2 - 0.5) + 0.2, b = all ? w - 0.3 : bay * Math.ceil(bays / 2 + 0.5) - 0.2;
      ops.push(['balcony', a, b, y - 0.15, iron ? 'iron' : 'stone', toneOf(B.wallColor, 1)]);
    }
    ops.push(['cornice', B.h - 1.0, 0.65, toneOf(B.wallColor, 1)]);
    ops.push(['frieze', B.h - 1.55, 0.5, 'garland', toneOf(B.wallColor, 1)]);
    return B;
  }

  if (style === 'islamic') {
    const floors = 3 + int(r, 2);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.9;
    B.wallColor = pick(r, OCHRE);
    ops.push(['ablaq', 0.0, GROUND_H, 0xc0704c, 0xe2d2b0]);
    groundFloor({ shops: 0.45, entrance: 0.7, banner: 0.2 });
    ops.push(['band', GROUND_H, 0xe2d2b0]);
    const bays = Math.max(2, Math.round(w / 3.2)), bay = w / bays;
    for (let f = 1; f < floors; f++) {
      const y = GROUND_H + FLOOR_H * (f - 1) + 0.25;
      for (let k = 0; k < bays; k++) {
        const x = bay * k + (bay - 1.8) / 2;
        if ((k + f) % 2 === 0 || bays < 3) ops.push(['mashrabiya', x, y, 1.8, 2.5, 0x47302a]);
        else ops.push(['window', bay * k + (bay - 0.8) / 2, y + 0.6, 0.8, 1.3, { frame: 0x6b4636, lintel: null, head: 'pointed', bars: true }]);
      }
    }
    ops.push(['parapet', B.h - 0.6, 0.35, toneOf(B.wallColor, 1)]);
    return B;
  }

  if (style === 'mosque') {
    const floors = 1 + int(r, 2);                                  // (low, so the minaret's first stage shows over it from the street, looking up)
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 2.0;
    B.wallColor = pick(r, [0xe2d2b0, 0xd8c09a, 0xd6b98a]);
    ops.push(['ablaq', 0.0, B.h - 1.2, 0xc0704c, B.wallColor]);
    const pw = 3.6, px0 = (w - pw) / 2;
    ops.push(['portal', px0, pw, Math.min(B.h - 1.6, 8.5), toneOf(B.wallColor, -1)]);
    door(px0 + pw / 2 - 0.8, 1.6, 'entrance', { mosque: true });
    for (const side of [0, 1]) {
      const xs = side ? [px0 + pw + 0.8, w - 1.6] : [0.8, px0 - 1.8];
      for (let x = xs[0]; x < xs[1]; x += 2.4) {
        ops.push(['window', x, 1.4, 1.0, 1.9, { frame: 0x6b4636, lintel: null, head: 'pointed', bars: true }]);
        if (floors > 1) ops.push(['window', x, GROUND_H + 1.2, 1.0, 2.2, { frame: 0x6b4636, lintel: null, head: 'pointed', bars: true }]);
      }
    }
    ops.push(['crenels', B.h - 0.2, B.wallColor]);
    B.minaret = { x: chance(r, 0.5) ? 1.4 : w - 1.4, h: 26 + int(r, 10), kind: pick(r, ['mamluk', 'ottoman']) };
    B.dome = { x: B.minaret.x < w / 2 ? w * 0.62 : w * 0.38, r: Math.min(4.5, w * 0.22) };
    return B;
  }

  if (style === 'deco') {
    const floors = 6 + int(r, 3);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.8;
    B.wallColor = pick(r, CREAM);
    groundFloor({ shops: 0.7, banner: 0.4 });
    ops.push(['band', GROUND_H, 0xf4efe6]);
    const bays = Math.max(2, Math.round(w / 2.4)), bay = w / bays;
    for (let f = 1; f < floors; f++) {
      const y = GROUND_H + FLOOR_H * (f - 1) + 0.5;
      for (let k = 0; k < bays; k++) ops.push(['window', bay * k + (bay - 1.3) / 2, y, 1.3, 1.6, { frame: 0xdfe2e8, lintel: null, head: 'none', louvres: chance(r, 0.4) ? pick(r, SHUTTERS) : null }]);
      ops.push(['balcony', 0.2, w - 0.2, y - 0.25, 'solid', 0xf4efe6]);
    }
    ops.push(['parapet', B.h - 0.6, 0.4, 0xf4efe6]);
    return B;
  }

  // concrete: the frame and the brick, a floor at a time, the top one never done.
  const floors = 5 + int(r, 4);
  B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.4;
  B.wall = 'brick'; B.wallColor = pick(r, [0xa8503c, 0x9e4a36, 0xb05a40]);
  groundFloor({ shops: 0.9, roller: 0.5, banner: 0.6, entrance: 0.6 });
  const bays = Math.max(2, Math.round(w / 3)), bay = w / bays;
  ops.push(['frame', GROUND_H, floors, FLOOR_H, bays, 0xa8a49c]);
  for (let f = 1; f < floors; f++) {
    const y = GROUND_H + FLOOR_H * (f - 1) + 0.7;
    for (let k = 0; k < bays; k++) {
      if (f === floors - 1 && chance(r, 0.35)) continue;                 // (the top floor's unfinished: a hole in the brick)
      ops.push(['window', bay * k + (bay - 1.2) / 2, y, 1.2, 1.4, { frame: pick(r, [0x8f96a6, 0xdfe2e8, 0x6b4636]), lintel: null, head: 'none', louvres: chance(r, 0.3) ? pick(r, SHUTTERS) : null }]);
    }
    if (chance(r, 0.5)) { const k = int(r, bays); ops.push(['balcony', bay * k + 0.15, bay * (k + 1) - 0.15, y - 0.5, 'solid', 0xa8a49c]); }
  }
  B.unfinished = true;
  return B;
}

// ---------- the dress ----------

// A building's dress: its roof (water tanks, satellite dishes, a pigeon loft, rebar), washing on the
// lines, air conditioners, awnings over the shops, dust down the walls.
const AWNING_SHOPS = /قهوة|مقهى|عصير|فول|كشري|بقالة|حلويات|مطعم|عيش|مخبز/;
function dress(B, L) {
  const w = B.x1 - B.x0, v = { dress: B.style, pipes: [], hanging: [], awnings: [] };
  B.look = v;
  B.roofColor = weighted(L, [[0xa0978a, 3], [0x8f8a84, 2], [0xb4a296, 1.5]]);
  v.roofKit = B.style === 'mosque' ? 'none' : B.unfinished ? 'rebar' : weighted(L, [['dishes', 4], ['tanks', 2.5], ['pigeons', 1], ['ac', 1]]);
  if (B.minaret) { v.minaret = B.minaret; v.dome = B.dome; }
  for (const op of B.ops) {
    if (op[0] !== 'shopfront') continue;
    const sign = B.ops.find(o => o[0] === 'sign' && Math.abs(o[1] - op[1]) < 0.15);
    if (sign?.[6]?.style === 'banner') continue;
    if (chance(L, AWNING_SHOPS.test(sign?.[5] ?? '') ? 0.65 : 0.3)) v.awnings.push({ x0: op[1] - 0.1, x1: op[1] + op[2] + 1.3, color: pick(L, [0x24503a, 0x9e3c36, 0x283f6b, 0xc95c45, 0x356f42]) });
  }
  const extra = [];
  for (const op of B.ops) {
    if (op[0] !== 'window' || op[2] < GROUND_H) continue;
    if (chance(L, 0.18)) op[5] = { ...op[5], ac: pick(L, ['below', 'side']) };
    if (chance(L, 0.04)) op[5] = { ...op[5], sat: true };
  }
  for (const op of B.ops) if (op[0] === 'balcony' && chance(L, 0.45)) extra.push(['laundry', op[1] + 0.2, op[2] - 0.2, op[3] + 1.6]);
  if (B.style !== 'mosque') extra.push(['dust', 0, B.h, B.wall === 'brick']);
  B.ops.push(...extra);
}

// ---------- the street's furniture ----------

/**
 * What else stands on a Cairo street (from its own stream): handcarts at the kerb, between the parked
 * cars; a vendor's stall against a blank stretch of wall; a souk's stalls down both sides.
 */
function furnish(S, { r, block, lamp, inMouth, near, zx }) {
  for (const q of S.squares ?? []) squareFurniture(S, q, r, block, lamp, 'monument', 'palm');
  // Handcarts in the road at the kerb, where there's room between the cars.
  const cars = S.props.filter(p => p.kind === 'car' && p.z < 5);
  for (let k = 0, n = int(r, 3); k < n; k++) {
    const x = S.x0 + 2 + range(r, 0, SECTION_M - 4);
    if (near(x, zx, 2.5) || inMouth(x, 2) || cars.some(c => Math.abs(c.x - x) < 3.3) || S.props.some(p => p.kind === 'cart' && Math.abs(p.x - x) < 2.5)) continue;
    S.props.push({ kind: 'cart', x, z: 0.3, look: weighted(r, [['fruit', 3], ['foul', 2], ['potato', 1.2], ['bread', 1.5], ['bananas', 1.5]]) });
    block(x - 0.95, -0.15, x + 0.95, 0.75, 'cart');
  }
  // A stall against the wall where there's no door: cigarettes, sweets, papers, phone cards.
  if (chance(r, 0.5)) for (let k = 0; k < 6; k++) {
    const x = S.x0 + 2 + range(r, 0, SECTION_M - 4);
    if (inMouth(x, 1.5) || S.doors.some(d => d.z === Z.front && Math.abs(d.x - x) < 2.2) || S.props.some(p => p.z < -4 && Math.abs((p.x ?? p.x0) - x) < 1.5)) continue;
    S.props.push({ kind: 'stall', x, z: -4.68, look: weighted(r, [['kiosk', 2], ['papers', 1.5], ['sweets', 1]]) });
    block(x - 0.7, Z.front, x + 0.7, -4.36, 'stall');
    break;
  }
  // A souk's stalls: down both sides of the passage, clear of its middle (city.js HALF.souk).
  for (const g of S.gapsN) if (g.kind === 'souk') for (let z = Z.front - 2; z > Z.north + 2; z -= 2.2 + range(r, 0, 1.2)) {
    for (const side of [0, 1]) {
      if (!chance(r, 0.75)) continue;
      const x = side ? g.x1 - 0.5 : g.x0 + 0.5;
      S.props.push({ kind: 'souk', x, z, side, look: weighted(r, [['spice', 2], ['cloth', 2], ['lamps', 1.5], ['brass', 1.2], ['fruit', 1]]) });
      block(x - 0.45, z - 0.8, x + 0.45, z + 0.8, 'stall');
    }
  }
}

// ---------- the looks ----------

const LOOKS = {
  pave: [['terrazzo', 3], ['broken', 3], ['pavers', 1.5], ['slabs', 1]],
  kerb: [['painted', 4], ['yellow', 2.5], ['worn', 2]],
  road: [['dusty', 4], ['patched', 2.5], ['worn', 1.5]],
  lanes: [['none', 3], ['dashed', 2], ['solid', 0.6]],
  zebra: [['faded', 3], ['white', 1.5], ['ghost', 2.5]],
  lamp: [['crook', 3], ['modern', 2.5], ['twin', 1]],
  pathLamp: [['globe', 2], ['twin', 2], ['modern', 1]],
  sideLamp: [['crook', 2], ['modern', 2]],
  railing: [['pipe', 3], ['cast', 2], ['mesh', 1]],
  bench: [['backless', 3], ['slats', 2], ['granite', 1.5]],
  bin: [['box', 2], ['tulip', 1]],
  hedge: [['ficus', 3], ['bougainvillea', 2], ['oleander', 2]],
  rowTree: [['ficus', 5], ['palm', 2], ['flame', 1.5]],
  parkTree: [['palm', 3], ['ficus', 3], ['royal', 2], ['flame', 1.5], ['eucalyptus', 1]],
  lane: [['asphalt', 2], ['dirt', 2], ['patched', 2]],
  alley: [['dirt', 3], ['setts', 1.5], ['concrete', 1]],
  souk: [['setts', 2], ['dirt', 2]],
  haret: [['dirt', 3], ['setts', 1.5]],
  car: [['sedan', 4], ['hatch', 2.5], ['van', 1.5], ['boxy', 1.5], ['suv', 0.6]],
  postbox: [['blue', 1]],
  pond: [['stone', 2], ['granite', 1]],
  fountain: [['basin', 2], ['tiers', 2], ['vase', 1]],
  monument: [['statue', 3], ['bust', 1]],
  kiosk: [['cabin', 2], ['plaster', 1.5]],
  beds: [['box', 1], ['flowers', 2]],
};

export const CAIRO = {
  id: 'cairo', name: 'Cairo', country: 'eg', lang: 'ar', geo: { lat: 30.05, lon: 31.24, tz: 2 }, drive: 'right',
  streetName,
  boulevardName: (seed, row) => at(AVENUES, seed, row, 'boulevard'),
  parkName: (seed, row, i) => at(MIDANS, seed, row, Math.floor(i / STRETCH), 'park'),
  gaps, parkShare: 0.35, building, dress, furnish, LOOKS, SHOPS, carColours: CAR_COLOURS, postbox: 'none', taxi: 'cairotaxi',
  // The terrace's shapes (sim/map/street.js terraceOf()): atfas (dead ends) often, lanes that dogleg,
  // a little midan set back now and then, its bronze in the middle.
  lot: 'rubble',                                                  // (beside a dogleg, before its turn)
  terrace: { court: 0.32, square: 0.14, jog: 0.42 },
  courtName: (seed, row, i) => at(['Atfet el-Mesk', 'Atfet el-Kahwa', 'Atfet el-Fawwala', 'Atfet el-Sabbagh', 'Atfet el-Hammam', 'Atfet el-Nahhas', 'Atfet Abu Taleb', 'Atfet el-Shorbagi'], seed, row, i, 'court'),
  squareName: (seed, row, i) => at(['Midan Bab el-Khalq', 'Midan el-Gamaliya', 'Midan Abdin', 'Midan el-Sayeda Aisha', 'Midan el-Hilmiya', 'Midan el-Daher'], seed, row, i, 'square'),
  kiosks: [['مرطبات', 0x24503a], ['جرائد', 0x6e2a2e], ['كشك', 0x283f6b], ['شاي', 0x9e3c36]], news: 'جرائد', stop: { frame: 0x8f6345, roof: 0x9e3c36, sign: ['موقف', 0x283f6b, 0xf4efe6] },
  litter: 0,                                                       // (no autumn on the ground; the dust in the gutters is the ground painter's: src/art/pixeltown.js)
  people: {
    name: (r, sex) => cairoName(r, sex),
    langs: (r) => ({ ar: 'native', ...(chance(r, 0.3) ? { en: pick(r, ['basic', 'working']) } : {}), ...(chance(r, 0.05) ? { fr: 'basic' } : {}) }),
    look: (r, sex, age) => cairoLook(r, sex, age),
  },
};
