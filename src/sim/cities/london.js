// TRADECRAFT sim: London, as a city profile (sim/cities/index.js). West London's streets: Notting
// Hill, Bayswater, Kensington; terraces and garden squares, a high street now and then.
//
// A street is either a high street (shop parades, a pub, mansion blocks) or a residential one
// (terraces of houses), by its name's hash, so a row keeps its character along its length. The
// terraces (building()):
//   - Georgian and Victorian brick: London stock brick, yellow-brown, or red; three or four storeys
//     over a basement; sash windows, the first floor's tall, with iron balconettes; a door with a
//     fanlight; a Victorian's bay window on the two lower floors, its door under a porch;
//   - stucco: painted white, cream or a Notting Hill pastel, rusticated below, a portico of two
//     columns at each door, a balcony across the first floor;
//   - the houses of both stand behind their areas: the lightwell to the basement, in front of the
//     house, behind black railings, bridged by the steps to each door (furnish(): the area is
//     blocked, the railings drawn, the doors left open to the pavement);
//   - a parade of shops: brick or stucco storeys over shopfronts with their fascias, the consoles
//     between them, a door to the flats above;
//   - a pub: its ground floor painted dark, its name in gold across the fascia, etched glass, hanging
//     baskets, the sign with its picture hung over the pavement;
//   - an Edwardian mansion block in red brick banded with white stone, its name over the door;
//   - a post-war council block of brown brick, its walkways stacked on its front.
// Signs in English. On the street: red pillar boxes and telephone boxes at the kerb, Belisha beacons
// at the zebras (white stripes, zigzags along the kerbs, LOOK RIGHT), black cabs among the parked
// cars, plane trees, York stone flags, rain-dark. Mews (cobbled lanes of old stables), passages and
// side streets lead north; the street's name plate on the corner. Cars drive on the left.
import { stream, int, range, pick, chance, weighted, hash } from '../rng.js';
import { SECTION_M, GAP_M, STRETCH, Z, GROUND_H, FLOOR_H, at, toneOf } from '../map/layout.js';
import { londonName, londonLook } from './folk.js';
import { squareFurniture } from './square.js';
import { wordM, fit } from './signs.js';

// ---------- names ----------

const STREETS = ['Ledbury Road', 'Westbourne Grove', 'Elgin Crescent', 'Portobello Road', 'Lansdowne Road', 'Pembridge Road',
  'Ladbroke Grove', 'Talbot Road', 'Chepstow Villas', 'Kensington Park Road', 'Hereford Road', 'Clarendon Road', 'Blenheim Crescent',
  'Westbourne Park Road', 'Holland Park Avenue', 'Campden Hill Road', 'Kensington Church Street', 'Moscow Road', 'Queensway', 'Leinster Terrace'];
const HIGH = new Set(['Westbourne Grove', 'Portobello Road', 'Pembridge Road', 'Holland Park Avenue', 'Kensington Church Street', 'Queensway', 'Ladbroke Grove', 'Talbot Road']);
const GARDENS = ['Ladbroke Gardens', 'Kensington Park Gardens', 'Pembridge Gardens', 'Arundel Gardens', 'Stanley Gardens', 'Lansdowne Gardens',
  'Ennismore Gardens', 'Cornwall Gardens', 'Onslow Gardens', 'Clanricarde Gardens'];
const SQUARES = ['Ladbroke Square', 'Powis Square', 'Norland Square', 'Edwardes Square', 'Kensington Square', 'Leinster Square',
  'Princes Square', 'Porchester Square', 'Hanover Square', 'Pembridge Square', 'Colville Square', 'Talbot Square'];
const SIDE = ['Denbigh Terrace', 'Colville Road', 'Basing Street', 'Lonsdale Road', 'Artesian Road', 'Needham Road', 'Dawson Place',
  'Horbury Crescent', 'Ruston Close', 'Codrington Road', 'Powis Terrace', 'Aldridge Road Villas', 'Bark Place', 'Garway Road',
  'Chepstow Place', 'Pembridge Villas', 'Ossington Street', 'Linden Gardens', 'Uxbridge Street', 'Peel Street'];
const MEWS = ['Pembridge Mews', 'Ledbury Mews', 'Kensington Park Mews', 'Lancaster Mews', 'St Petersburgh Mews', 'Princes Mews',
  'Hesper Mews', 'Kynance Mews', 'Holland Park Mews', 'Clarendon Mews', 'Colville Mews', 'Chepstow Mews', 'Linden Mews', 'Callcott Mews'];
const PASSAGE = ['Hayden\'s Place', 'Portobello Court', 'Tavistock Piazza', 'Clarendon Walk', 'Wilby Mews Passage', 'Vernon Yard',
  'Archer Street Passage', 'Rede Place', 'Pember Yard', 'Ledbury Walk', 'Uxbridge Passage', 'Bark Yard'];
const streetName = (seed, row) => at(STREETS, seed, row, 'street');
/** A street's character: a high street (shops, a pub) or a residential one (terraces). */
export const highStreet = (seed, row) => HIGH.has(streetName(seed, row));

/**
 * A row's ways north in section i: a side street now and then, a mews (cobbles, 6 m), a passage; and
 * every other section one at least. Each a building's width from the next.
 */
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
  if (chance(r, 0.3)) add('side', 5, 24);
  if (chance(r, 0.28)) add('mews', 6, 30);
  if (chance(r, 0.3) || (!out.length && (i % 2 + 2) % 2 === 0)) add('alley', 8, 30);
  for (const g of out) {
    const k = [seed, row, i, Math.round(g.x0), 'lane'];
    g.name = g.kind === 'side' ? at(SIDE, ...k) : g.kind === 'mews' ? at(MEWS, ...k) : hash(...k) % 3 ? at(PASSAGE, ...k) : `a passage off ${streetName(seed, row)}`;
  }
  return out;
}

// ---------- shops ----------

// Their kinds (the sim's: what they sell) and the words on the fascia, a few ways each.
const SHOPS = {
  pharmacy: ['CHEMIST', 'PHARMACY'], grocery: ['FOOD & WINE', 'GROCER', 'MINI MARKET'], cafe: ['CAFE', 'COFFEE', 'CAFE & BAR'],
  flowers: ['FLORIST', 'FLOWERS'], bakery: ['BAKERY', 'PATISSERIE'], books: ['BOOKS', 'BOOKSHOP'], optician: ['OPTICIANS'],
  bank: ['BANK'], tobacco: ['NEWSAGENT', 'NEWS'], exchange: ['BUREAU DE CHANGE'], clothes: ['TAILOR', 'MENSWEAR', 'VINTAGE'],
  shoes: ['SHOES', 'SHOE REPAIRS'], watches: ['JEWELLER'], phones: ['MOBILE'], kebab: ['KEBAB'], beer: ['OFF LICENCE', 'WINES'],
  deli: ['DELI'], restaurant: ['TANDOORI', 'TRATTORIA', 'BISTRO'], chips: ['FISH & CHIPS'], laundry: ['LAUNDERETTE', 'DRY CLEANERS'],
  estate: ['ESTATE AGENTS'], barber: ['BARBER'], bookie: ['BETTING'],
};
const SHOP_WEIGHTS = [['grocery', 3], ['cafe', 3.5], ['pharmacy', 1.5], ['estate', 2], ['clothes', 1.5], ['flowers', 1], ['bakery', 1.2],
  ['books', 0.8], ['optician', 0.8], ['bank', 0.8], ['tobacco', 1.5], ['exchange', 0.5], ['shoes', 0.6], ['watches', 0.5], ['phones', 1],
  ['kebab', 0.8], ['beer', 1], ['deli', 1], ['restaurant', 1.5], ['chips', 0.8], ['laundry', 1], ['barber', 1], ['bookie', 0.6]];
// Fascias: [ground, letters, border] — London's: dark grounds and gold, black and white, cream.
const FASCIAS = [[0x173327, 0xe7b84a, 0x0e1f18], [0x23252f, 0xf6f4ee, 0x14151c], [0x1b2541, 0xf8e08a, 0x14151c], [0x6e2a2e, 0xf8e08a, 0x3f1a22],
  [0xf4efe6, 0x23252f, 0x8f96a6], [0x283f6b, 0xf6f4ee, 0x1b2541], [0x4c5262, 0xf6f4ee, 0x23252f], [0x9e3c36, 0xf6f4ee, 0x6e2a2e]];
const PUBS = ['THE CROWN', 'THE RED LION', 'THE KINGS ARMS', 'THE ROSE & CROWN', 'THE WHITE HART', 'THE PRINCE ALBERT', 'THE GEORGE',
  'THE ANCHOR', 'THE GRAPES', 'THE CASTLE', 'THE SUN', 'THE STAR', 'THE PLOUGH', 'THE BELL'];
const PUB_PAINT = [0x173327, 0x3f1a22, 0x23252f, 0x1b2541, 0x6e2a2e];

// ---------- the buildings ----------

const STOCK = [0xc9a46a, 0xb8956a, 0xc4a070, 0xb48459];             // London stock brick, yellow to brown
const RED = [0x9e3c36, 0xa8503c, 0x8f3a30];
const STUCCO = [0xf4efe6, 0xf4efe6, 0xf4efe6, 0xece4d4, 0xe2dac6];
const PASTEL = [0xe8c4b8, 0xc4d4dc, 0xcfe0c4, 0xf0dca0, 0xd8c8dc, 0xe8d0a8];   // Notting Hill's painted houses
const WHITE = 0xf4efe6;
const DOORS = [0x23252f, 0x23252f, 0x173327, 0x6e2a2e, 0x1b2541, 0x9e3c36, 0x356f42, 0xe7b84a, 0x4a2a52, 0x2f6b62];
const CAR_COLOURS = [0x23252f, 0x23252f, 0xb8bdc8, 0xdfe2e8, 0xf6f4ee, 0x1b2541, 0x283f6b, 0x9e3c36, 0x6a7182, 0x4c5262, 0x47302a];
// Styles by the street's character: [style, weight].
const STYLES = {
  high: [['parade', 5], ['pub', 1.2], ['mansion', 2], ['terrace', 0.8], ['stucco', 0.6], ['council', 0.4]],
  home: [['terrace', 4], ['stucco', 3.5], ['parade', 0.8], ['pub', 0.5], ['mansion', 1], ['council', 0.6]],
};

/**
 * A building and its facade: { x0, x1, z, h, d, wall, wallColor, roof, ops, style, seed } and, for a
 * terrace, its houses ({ x0, x1, door }) and its area ([x0, x1] spans, absolute: the lightwell's,
 * between the doors). See the header for the styles.
 */
function building(r, x0, x1, z, S) {
  const w = x1 - x0, high = highStreet(S.town, S.row);
  const pubHere = S.doors.some(d => d.shop === 'pub');
  // (a crescent's houses are stucco; round a square, houses)
  const bowed = z < Z.front - 0.25 && z > Z.front - 6, back = z <= Z.front - 6;
  const style = bowed ? 'stucco' : weighted(r, STYLES[high && !back ? 'high' : 'home'].map(([s, k]) => [s, (s === 'mansion' || s === 'council') && w < 13 ? 0 : s === 'pub' && (pubHere || w > 15) ? 0 : k]));
  const ops = [], seed = int(r, 1e6);
  const B = { x0, x1, z, h: 0, d: 35, wall: 'brick', wallColor: pick(r, STOCK), roof: 'flat', ops, style, seed, houses: [], area: [] };
  const door = (x, w, kind, extra = {}) => S.doors.push({ x: x0 + x + w / 2, z, w, kind, ...extra });
  const shop = (x, sw, words = null) => {                         // a shopfront: window, door, fascia
    const kind = weighted(r, SHOP_WEIGHTS), [bg, fg, border] = pick(r, FASCIAS);
    ops.push(['shopfront', x, sw - 1.3, 2.75, { goods: [pick(r, [0xf6f4ee, 0xdfe2e8]), pick(r, [0x9e3c36, 0x3b6296, 0x356f42, 0xe7b84a]), pick(r, [0x8f6345, 0xc95c45, 0x5d8fc2])] }]);
    ops.push(['door', x + sw - 1.2, 1.1, 2.45, { color: 0x23252f, frame: 0x23252f }]);
    ops.push(['sign', x, 3.0, sw - 0.1, 0.8, words ?? fit(r, SHOPS[kind], sw - 0.1), { bg, fg, border, style: 'fascia' }]);
    S.doors.push({ x: x0 + x + sw - 0.65, z, w: 1.1, kind: 'shop', shop: kind, pane: { x0: x0 + x, x1: x0 + x + sw - 1.3, z } });
  };

  if (style === 'terrace' || style === 'stucco') {
    // A terrace: houses of 4.4–6.4 m, doors paired at the party walls (mirrored), each house over its
    // basement, behind its area.
    const stucco = style === 'stucco', victorian = !stucco && chance(r, 0.45);
    const floors = (stucco ? 4 : 3) + int(r, 2);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.9;
    if (stucco) { B.wall = 'stucco'; B.wallColor = chance(r, 0.3) ? pick(r, PASTEL) : pick(r, STUCCO); }
    else B.wallColor = chance(r, 0.25) ? pick(r, RED) : pick(r, STOCK);
    const n = Math.max(1, Math.round(w / range(r, 4.8, 6.0))), hw = w / n, flip = int(r, 2);
    B.houses = [];
    for (let k = 0; k < n; k++) {
      const a = k * hw, left = (k + flip) % 2 === 0, dx = left ? a + 0.4 : a + hw - 1.5;   // (doors in pairs at the party walls)
      const colour = stucco ? (chance(r, 0.6) ? 0x23252f : pick(r, DOORS)) : pick(r, DOORS);
      ops.push(['door', dx, 1.1, 2.45, { color: colour, frame: stucco ? WHITE : 0xe2dac6, style: 'arched', fan: true }]);
      door(dx, 1.1, 'entrance');
      // The windows: the ground floor's beside the door, the floors' over the door and them.
      const rest = left ? [dx + 1.1 + 0.3, a + hw - 0.25] : [a + 0.25, dx - 0.3], room = rest[1] - rest[0];
      const two = room > 2.7, ww = 1.0;
      const cols = two ? [rest[0] + (room / 2 - ww) / 2, rest[0] + room / 2 + (room / 2 - ww) / 2] : [rest[0] + (room - ww) / 2];
      const bay = victorian && room > 2.4;
      if (bay) ops.push(['bay', rest[0] + 0.1, room - 0.2, 0.6, GROUND_H + FLOOR_H - 0.5, { frame: WHITE, stone: 0xe2dac6 }]);
      else for (const cx of cols) ops.push(['window', cx, 0.9, ww, 1.9, { frame: WHITE, lintel: stucco ? null : 0xe2dac6, sash: true, head: stucco ? 'none' : null }]);
      const xs = [dx + 0.05, ...cols].sort((p, q) => p - q);
      for (let f = 1; f < floors; f++) {
        const y = GROUND_H + FLOOR_H * (f - 1) + 0.35, wh = f === 1 ? 2.35 : f === floors - 1 && floors > 3 ? 1.35 : 1.8;
        for (const cx of xs) {
          if (bay && f === 1 && cx !== xs[left ? 0 : xs.length - 1]) continue;   // (the bay rises through the first floor)
          ops.push(['window', cx, y, ww, wh, { frame: WHITE, lintel: stucco ? null : 0xe2dac6, sash: true, head: stucco && f === 1 ? 'hood' : stucco ? 'none' : f === 1 && !victorian ? 'segment' : null, surround: victorian && !stucco ? 0xe2dac6 : null }]);
          if (f === 1 && !stucco && chance(r, 0.6)) ops.push(['balcony', cx - 0.15, cx + ww + 0.15, y - 0.1, 'rail', 0x23252f]);
        }
      }
      if (stucco) ops.push(['portico', dx - 0.35, 1.8, 3.2, WHITE]);
      else if (victorian) ops.push(['porch', dx - 0.2, 1.5, 2.95, 0xe2dac6]);
      if (k > 0) ops.push(['party', a, B.h - 0.9]);
      B.houses.push({ x0: x0 + a, x1: x0 + a + hw, door: [x0 + dx - 0.15, x0 + dx + 1.25] });
      // The area: the house's front but its door.
      const lo = x0 + a + (k === 0 ? 0.05 : 0), hi = x0 + a + hw - (k === n - 1 ? 0.05 : 0);
      if (x0 + dx - 0.15 - lo > 0.3) B.area.push([lo, x0 + dx - 0.15]);
      if (hi - (x0 + dx + 1.25) > 0.3) B.area.push([x0 + dx + 1.25, hi]);
    }
    if (stucco) {
      ops.unshift(['rustic', 0.45, GROUND_H, toneOf(B.wallColor, -1)]);   // (under the doors and windows: the first thing painted)
      ops.push(['band', GROUND_H, WHITE]);
      ops.push(['balcony', 0.2, w - 0.2, GROUND_H + 0.2, 'stone', WHITE]);
      ops.push(['cornice', B.h - 0.75, 0.45, WHITE]);
    } else {
      ops.push(['band', GROUND_H, 0xe2dac6]);
      ops.push(['parapet', B.h - 0.6, 0.35, 0xe2dac6]);
    }
    ops.unshift(['rect', 0, 0, w, 0.5, stucco ? toneOf(B.wallColor, -2) : 0x5c5650]);
    return B;
  }

  if (style === 'pub') {
    // The pub: a ground floor painted dark, the name in gold the whole width, two big windows of
    // etched glass either side of the doors; brick over it, a cornice.
    const floors = 3 + int(r, 2), paint = pick(r, PUB_PAINT), name = fit(r, PUBS, w - 0.6);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.9;
    B.wallColor = chance(r, 0.5) ? pick(r, STOCK) : pick(r, RED);
    ops.push(['rect', 0, 0, w, GROUND_H, paint]);
    const dw = 1.6, dx = w / 2 - dw / 2;
    ops.push(['shopfront', 0.4, dx - 0.7, 2.9, { frame: paint, goods: [0xe7b84a, 0x6e2a2e, 0xf6f4ee], etched: true }]);
    ops.push(['shopfront', dx + dw + 0.3, w - (dx + dw + 0.3) - 0.4, 2.9, { frame: paint, goods: [0xe7b84a, 0x6e2a2e, 0xf6f4ee], etched: true }]);
    ops.push(['door', dx, dw, 2.6, { color: paint, frame: paint, style: 'shop' }]);
    ops.push(['sign', 0.2, 3.1, w - 0.4, 0.85, name, { bg: paint, fg: 0xe7b84a, border: toneOf(paint, -2), style: 'fascia' }]);
    S.doors.push({ x: x0 + dx + dw / 2, z, w: dw, kind: 'shop', shop: 'pub', pane: { x0: x0 + 0.4, x1: x0 + dx - 0.3, z } });
    B.pub = { name, sign: pick(r, ['crown', 'lion', 'hart', 'anchor', 'rose', 'star', 'bell']), paint };
    ops.push(['band', GROUND_H, paint]);
    const bays = Math.max(2, Math.round(w / 2.6)), bay = w / bays;
    for (let f = 1; f < floors; f++) for (let k = 0; k < bays; k++) {
      ops.push(['window', bay * k + (bay - 1.0) / 2, GROUND_H + FLOOR_H * (f - 1) + 0.5, 1.0, f === 1 ? 2.0 : 1.7, { frame: WHITE, lintel: 0xe2dac6, sash: true, surround: 0xe2dac6 }]);
    }
    ops.push(['cornice', B.h - 0.75, 0.45, 0xe2dac6]);
    return B;
  }

  if (style === 'mansion' || style === 'council') {
    const mansion = style === 'mansion', floors = mansion ? 5 + int(r, 2) : 5 + int(r, 3);
    B.h = GROUND_H + FLOOR_H * (floors - 1) + (mansion ? 1.0 : 0.6);
    B.wallColor = mansion ? pick(r, RED) : pick(r, [0x8f6345, 0x6b4636, 0xb48459]);
    ops.push(['rect', 0, 0, w, 0.5, 0x5c5650]);
    let x = 0.5;
    const shops = mansion && high && chance(r, 0.75);
    const entrance = 0.5 + int(r, Math.max(1, Math.floor(w - 3)));
    while (x < w - 1.4) {
      const room = w - 0.5 - x;
      if (x >= entrance && room > 2.2 && !B.entered) {             // the block's door: a canopy, its name over it
        B.entered = true;
        ops.push(['door', x + 0.3, 1.6, 2.7, { color: mansion ? 0x23252f : 0x6a7182, frame: mansion ? WHITE : 0x4c5262, style: mansion ? 'glazed' : 'metal', canopy: mansion }]);
        door(x + 0.3, 1.6, 'entrance');
        if (mansion) {                                             // (carved over the door, as wide as it needs)
          const name = pick(r, ['ALBANY MANSIONS', 'PEMBRIDGE MANSIONS', 'CLARENDON COURT', 'ELGIN MANSIONS', 'HEREFORD MANSIONS', 'YORK MANSIONS', 'ST JOHNS COURT']), nw = Math.min(w - 0.4, wordM(name) + 0.4);
          ops.push(['sign', Math.max(0.2, Math.min(w - 0.2 - nw, x + 1.1 - nw / 2)), 3.35, nw, 0.55, name, { bg: B.wallColor, fg: 0xf4efe6, border: B.wallColor, style: 'letters' }]);
        }
        x += 2.4 + range(r, 0, 0.5); continue;
      }
      if (shops && room > 3.6 && chance(r, 0.7)) { const sw = Math.min(room, 3.6 + int(r, 3) * 0.8); shop(x, sw); x += sw + 0.4; continue; }
      if (room > 1.4) ops.push(['window', x, 1.0, 1.2, 1.7, { frame: mansion ? WHITE : 0xdfe2e8, lintel: mansion ? 0xe2dac6 : null, sash: mansion, head: mansion ? null : 'none', bars: !mansion && chance(r, 0.3) }]);
      x += 1.2 + 0.8 + range(r, 0, 0.5);
    }
    ops.push(['band', GROUND_H, mansion ? WHITE : 0xa0978a]);
    const bays = Math.max(2, Math.round(w / (mansion ? 2.4 : 2.2))), bay = w / bays;
    for (let f = 1; f < floors; f++) {
      const y = GROUND_H + FLOOR_H * (f - 1) + 0.55;
      for (let k = 0; k < bays; k++) ops.push(['window', bay * k + (bay - 1.1) / 2, y, 1.1, mansion ? 1.8 : 1.5, { frame: mansion ? WHITE : 0xdfe2e8, lintel: mansion ? WHITE : null, sash: mansion, head: mansion ? null : 'none', surround: null }]);
      if (mansion) ops.push(['band', y - 0.3, WHITE]);
    }
    if (mansion) { ops.push(['cornice', B.h - 0.8, 0.5, WHITE]); ops.push(['frieze', B.h - 1.3, 0.45, 'garland', WHITE]); }
    else { ops.push(['decks', GROUND_H, floors, FLOOR_H, 0xa0978a]); ops.push(['parapet', B.h - 0.6, 0.3, 0xa0978a]); }
    return B;
  }

  // A parade of shops: storeys over shopfronts, consoles between them, a door to the flats now and then.
  const floors = 3 + int(r, 2), stucco = chance(r, 0.3);
  B.h = GROUND_H + FLOOR_H * (floors - 1) + 0.8;
  if (stucco) { B.wall = 'stucco'; B.wallColor = chance(r, 0.4) ? pick(r, PASTEL) : pick(r, STUCCO); }
  else B.wallColor = chance(r, 0.35) ? pick(r, RED) : pick(r, STOCK);
  ops.push(['rect', 0, 0, w, 0.45, 0x5c5650]);
  let x = 0.4 + range(r, 0, 0.3);
  const consoles = [];
  while (x < w - 1.4) {
    const room = w - 0.4 - x;
    if (room > 3.4 && chance(r, 0.8)) { const sw = Math.min(room, 3.6 + int(r, 3) * 0.8); shop(x, sw); consoles.push(x - 0.2, x + sw - 0.05); x += sw + 0.35; continue; }
    if (room > 1.4) { ops.push(['door', x, 1.1, 2.45, { color: pick(r, DOORS), frame: 0xe2dac6, style: 'panel', fan: true }]); door(x, 1.1, 'entrance'); x += 1.1 + 0.5; continue; }
    x += 1;
  }
  ops.push(['consoles', [...new Set(consoles.map(v => Math.round(v * 100) / 100))].filter(v => v > 0.1 && v < w - 0.1), 3.0, 0.8]);
  ops.push(['band', GROUND_H, stucco ? WHITE : 0xe2dac6]);
  const bays = Math.max(2, Math.round(w / 2.6)), bay = w / bays;
  for (let f = 1; f < floors; f++) {
    const y = GROUND_H + FLOOR_H * (f - 1) + 0.45;
    for (let k = 0; k < bays; k++) ops.push(['window', bay * k + (bay - 1.0) / 2, y, 1.0, f === 1 ? 2.0 : 1.7, { frame: WHITE, lintel: 0xe2dac6, sash: true, surround: stucco ? null : chance(r, 0.5) ? 0xe2dac6 : null, head: stucco && f === 1 ? 'hood' : null }]);
  }
  ops.push(stucco ? ['cornice', B.h - 0.75, 0.4, WHITE] : ['parapet', B.h - 0.6, 0.35, 0xe2dac6]);
  return B;
}

// ---------- the dress ----------

// A building's dress (from the looks' stream): the roof (slate) and its chimneys with their pots,
// awnings over cafés and the like, hanging baskets on a pub, its sign; ivy or wisteria up a terrace,
// window boxes, scaffolding (London is always mending something), satellite dishes on a council block.
const AWNING_SHOPS = /CAFE|COFFEE|BAKERY|PATISSERIE|FLORIST|FLOWERS|DELI|TRATTORIA|BISTRO|TANDOORI|GROCER|FOOD/;
function dress(B, L) {
  const w = B.x1 - B.x0, v = { dress: B.style, pipes: [], hanging: [], awnings: [] };
  B.look = v;
  B.roofColor = weighted(L, [[0x4c5262, 3], [0x6a7182, 2], [0x353947, 1.5]]);
  v.roofKit = B.style === 'council' ? weighted(L, [['hut', 2], ['antenna', 1]]) : B.style === 'mansion' ? weighted(L, [['pots', 2], ['hut', 1]]) : 'pots';
  if (B.houses?.length) v.party = B.houses.slice(1).map(h => h.x0 - B.x0);
  for (const op of B.ops) {
    if (op[0] !== 'shopfront' || op[4]?.etched) continue;
    const sign = B.ops.find(o => o[0] === 'sign' && Math.abs(o[1] - op[1]) < 0.05);
    if (chance(L, AWNING_SHOPS.test(sign?.[5] ?? '') ? 0.6 : 0.12)) v.awnings.push({ x0: op[1] - 0.1, x1: op[1] + op[2] + 1.3, color: pick(L, [0x24503a, 0x6e2a2e, 0x23252f, 0x283f6b, 0x9e3c36]) });
  }
  const extra = [];
  if (B.pub) { v.pubSign = B.pub; extra.push(['baskets', [0.7, w - 0.7, ...(w > 10 ? [w / 2 - 1.5, w / 2 + 1.5] : [])], 4.05]); }
  if ((B.style === 'terrace' || B.style === 'stucco') && chance(L, 0.18)) extra.push(['ivy', 0.3 + range(L, 0, Math.max(0.1, w - 4)), 2.5 + range(L, 0, 2), 4 + range(L, 0, 4), chance(L, 0.4) ? 'wisteria' : 'ivy']);
  for (const op of B.ops) if (op[0] === 'window' && op[2] > GROUND_H && op[2] < GROUND_H + FLOOR_H && chance(L, 0.12)) op[5] = { ...op[5], flowers: pick(L, [[0xc95c45, 0xe8896a, 0xf8e08a], [0x9e3c36, 0xf6f4ee], [0x7a4a86, 0xe8896a]]) };
  if (B.style === 'council') for (const op of B.ops) if (op[0] === 'window' && op[2] > GROUND_H && chance(L, 0.07)) op[5] = { ...op[5], sat: true };
  for (const x of [0.18, w - 0.38]) if (B.style !== 'council' && chance(L, 0.35)) v.pipes.push(x);
  for (const x of v.pipes) extra.push(['pipe', x, B.h - 0.75, pick(L, [0x23252f, 0x353947])]);
  if (B.h > GROUND_H + FLOOR_H && chance(L, 0.08)) extra.push(['scaffold', GROUND_H + 0.3, B.h - 0.6, pick(L, [0x6a7182, 0x4c5262, 0x283f6b]), FLOOR_H]);
  B.ops.push(...extra);
}

// ---------- the street's furniture ----------

/**
 * What else stands on a London street (from its own stream): the areas and their railings in front of
 * the terraces; Belisha beacons at the zebras; a telephone box now and then at the kerb; the
 * street's name on a plate at a lane's corner.
 */
function furnish(S, { r, block, lamp, inMouth, near, zx, sx }) {
  const AREA_M = 0.62;                                             // the lightwell's depth: clear of the pavement's walking band
  for (const B of S.buildings) for (const [a, b] of B.area ?? []) {
    if (b - a < 0.3) continue;
    S.props.push({ kind: 'area', x0: a, x1: b, z: B.z + AREA_M });
    block(a, B.z, b, B.z + AREA_M, 'area');
  }
  // A square set back from the street: a garden in it, railed, a tree; lamps at its corners.
  for (const q of S.squares ?? []) squareFurniture(S, q, r, block, lamp, 'garden');
  // A mews has lanterns on its walls.
  for (const g of S.gapsN) if (g.kind === 'mews') {
    if (!g.jog) { lamp(g.x0 + 0.3, -15); lamp(g.x1 - 0.3, -31); continue; }
    lamp(g.jog.x0 + 0.3, (Z.front + g.jog.z) / 2); lamp(g.x1 - 0.3, (g.jog.z - (g.x1 - g.x0) + Z.north) / 2);   // (a dogleg's: one before its turn, one after)
  }
  // Belisha beacons: a pole each side of each zebra, on both kerbs (the far road's too).
  const beacon = (x, z) => { S.props.push({ kind: 'beacon', x, z }); block(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 'beacon'); };
  for (const c of S.crossings) for (const x of [c.x0 - 0.45, c.x1 + 0.45]) { beacon(x, -0.85); beacon(x, 7.2); }
  if (S.band === 'boulevard') for (const c of S.crossingsS) for (const x of [c.x0 - 0.45, c.x1 + 0.45]) { beacon(x, 19.4); beacon(x, 26.2); }
  // A red telephone box at the kerb, clear of the lamps, the zebra, the lanes and the pillar box.
  if (chance(r, 0.22)) {
    for (let k = 0; k < 6; k++) {
      const x = S.x0 + 2 + range(r, 0, SECTION_M - 4);
      if (near(x, zx, 2) || inMouth(x, 1.2) || S.props.some(p => (p.kind === 'lamp' || p.kind === 'postbox' || p.kind === 'beacon') && p.z < 0 && Math.abs(p.x - x) < 1.5)) continue;
      S.props.push({ kind: 'phonebox', x, z: -0.8 }); block(x - 0.45, -1.15, x + 0.45, -0.45, 'phonebox');
      break;
    }
  }
  // The lane's name on the corner, on the building beside its mouth (paint: the dress keeps it).
  for (const g0 of S.gapsN) {
    const g = { ...g0, ...(g0.jog ? { x0: g0.jog.x0, x1: g0.jog.x1 } : {}) };          // (at the lane's mouth)
    const B = S.buildings.find(b => !b.back && Math.abs(b.x1 - g.x0) < 0.01) ?? S.buildings.find(b => !b.back && Math.abs(b.x0 - g.x1) < 0.01);
    if (!B || g.name.startsWith('a ')) continue;
    // (a long name in two lines, the street's word under it)
    const words = g.name.toUpperCase().replace(/'/g, ''), sp = words.lastIndexOf(' '), two = wordM(words) > 2.4 && sp > 0;
    const lines = two ? [words.slice(0, sp), words.slice(sp + 1)] : [words], wM = Math.max(...lines.map(wordM)) + 0.4, hM = two ? 0.82 : 0.5;
    if (wM > B.x1 - B.x0 - 0.4) continue;
    B.ops.push(['plate', Math.abs(B.x1 - g.x0) < 0.01 ? B.x1 - B.x0 - wM - 0.2 : 0.2, GROUND_H - 0.12 - hM, wM, hM, lines.join('\n')]);
  }
}

// ---------- the looks ----------

const LOOKS = {
  pave: [['york', 4], ['pcc', 3], ['asphalt', 1.2], ['granite', 0.5]],
  kerb: [['granite', 5], ['concrete', 2], ['worn', 1.2]],
  road: [['worn', 3], ['fresh', 1.5], ['patched', 2.5], ['grey', 1]],
  lanes: [['dashed', 4], ['long', 1.5], ['solid', 0.5]],
  zebra: [['belisha', 1]],
  lamp: [['lantern', 3], ['modern', 2.5], ['twin', 0.8]],
  pathLamp: [['lantern', 3], ['globe', 1]],
  sideLamp: [['lantern', 2.5], ['modern', 2]],
  railing: [['spears', 4], ['cast', 1.5], ['hoops', 1.5]],
  bench: [['slats', 3], ['sofa', 2.5], ['backless', 1]],
  bin: [['london', 3], ['box', 1], ['basket', 0.6]],
  hedge: [['privet', 3], ['holly', 2], ['yew', 1.5], ['laurel', 1.5]],
  rowTree: [['plane', 7], ['lime', 1.5], ['chestnut', 1]],
  parkTree: [['plane', 4], ['lime', 2], ['chestnut', 1.5], ['oak', 1], ['birch', 0.6], ['cherry', 1.2]],
  lane: [['asphalt', 3], ['setts', 1.2], ['patched', 2]],
  alley: [['setts', 2], ['asphalt', 1.5], ['york', 2]],
  mews: [['setts', 4], ['york', 0.6]],
  car: [['sedan', 2], ['hatch', 3], ['estate', 1.5], ['van', 1], ['suv', 1.5]],
  postbox: [['pillar-red', 1]],
  pond: [['stone', 2], ['reeds', 1], ['fenced', 1.5]],
  fountain: [['basin', 2], ['tiers', 1.5], ['vase', 1]],
  monument: [['statue', 2], ['seated', 1.5], ['bust', 1.5], ['soldier', 1]],
  kiosk: [['cabin', 1.5], ['glass', 1.5], ['news', 1]],
  beds: [['box', 1.5], ['kale', 1.5], ['stalks', 1.5]],
};

export const LONDON = {
  id: 'london', name: 'London', country: 'gb', lang: 'en', geo: { lat: 51.51, lon: -0.19, tz: 0 }, drive: 'left',
  streetName,
  boulevardName: (seed, row) => at(GARDENS, seed, row, 'boulevard'),
  parkName: (seed, row, i) => at(SQUARES, seed, row, Math.floor(i / STRETCH), 'park'),
  gaps, parkShare: 0.4, building, dress, furnish, LOOKS, SHOPS, carColours: CAR_COLOURS, postbox: 'kerb', taxi: 'cab',
  // The terrace's shapes (sim/map/street.js terraceOf()): a court now and then, a crescent bowed back
  // from the street, a passage that doglegs behind a house; a square set back, rarely.
  lot: 'garden',                                                  // (beside a dogleg, before its turn)
  terrace: { court: 0.14, square: 0.05, crescent: 0.22, jog: 0.35 },
  courtName: (seed, row, i) => at(['Ledbury Court', 'Pember Yard', 'Archer Court', 'Rede Yard', 'Talbot Court', 'Elgin Yard', 'Basing Court', 'Hayden Court', 'Vernon Court'], seed, row, i, 'court'),
  squareName: (seed, row, i) => at(['Ladbroke Place', 'Pembridge Place', 'Clarendon Place', 'Lansdowne Place', 'Chepstow Place'], seed, row, i, 'square'),
  kiosks: [['CAFE', 0x173327], ['TEAS', 0x6e2a2e], ['NEWS', 0x1b2541], ['ICES', 0x283f6b]], news: 'NEWS',
  people: {
    name: (r, sex) => londonName(r, sex),
    langs: (r) => ({ en: 'native', ...(chance(r, 0.25) ? { [pick(r, ['fr', 'es', 'pl', 'ar', 'hi', 'pt'])]: pick(r, ['working', 'fluent', 'native']) } : {}) }),
    look: (r, sex, age) => londonLook(r, sex, age),
  },
};
