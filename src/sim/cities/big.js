// TRADECRAFT sim: the city's big buildings (the user, 2026-11-04: "these small shop like structures should read clinic
// instead of hospital, the hospital should be a separate structure somewhere in the city that takes a whole map street
// (almost) and where a lot of emergency vehicules are and move in and out. A big structure. Same with police stations,
// there should also be a big structure somewhere that is a precinct (smaller than a hospital)").
//
// **Where** (bigPlan(), by the town's key, the same every time): the hospital along BIG.hospital.n sections of a street
// east of the centre, the precinct (the police's headquarters for the district) along BIG.precinct.n west of it; never
// a section with a metro station (sim/transit.js), never the sections the campaign's places are chosen in (sim/places.js:
// -4 to 4) nor the ones the city's generation is checked by (tests/cities.test.mjs: -2 to 2).
// **What** (bigBuildings(), from sim/map/street.js section(), after the terrace is built): each run of the front between
// the lanes' mouths one building of it (a hospital's pale concrete, five storeys, its windows in ribbons; a precinct's
// brick or concrete, four, its windows in a grid), the lots that were there gone, their doors with them; in its middle
// section its one door: the hospital's A&E under a canopy (a door of kind 'shop', 'hospital': its desk, sim/shops.js
// 'treat'), the precinct's front desk (kind 'shop', 'police': its guards, sim/hunt.js; its cars, sim/map/street.js
// stationCars()), its name across the top in the city's words (WORDS). Who comes and goes: sim/traffic.js depot().
import { hash } from '../rng.js';
import { stationAt } from '../transit.js';
import { Z } from '../map/layout.js';

export const BIG = {
  hospital: { n: 3, from: 5, to: 9, h: 17.5, floors: 4, style: 'hospital' },
  precinct: { n: 2, from: -11, to: -7, h: 13.5, floors: 3, style: 'precinct' },
};
// (the names across the top, the entrance's word: in the city's language, a second line where its signs have one)
const WORDS = {
  london: { hospital: 'ST MARY\'S HOSPITAL', ae: 'A&E', precinct: 'METROPOLITAN POLICE' },
  moscow: { hospital: 'ГОРОДСКАЯ БОЛЬНИЦА', ae: 'ПРИЕМНОЕ', precinct: 'УПРАВЛЕНИЕ МВД' },
  cairo: { hospital: 'مستشفى|HOSPITAL', ae: 'طوارئ|EMERGENCY', precinct: 'مديرية الأمن|POLICE' },
  beirut: { hospital: 'مستشفى|HÔPITAL', ae: 'طوارئ|URGENCES', precinct: 'قوى الأمن|POLICE' },
};
const WALLS = { hospital: { london: 0xdcd8cf, moscow: 0xe2dac6, cairo: 0xe8dcc0, beirut: 0xe2dac6 }, precinct: { london: 0x8c4a3a, moscow: 0xc8c0ae, cairo: 0xd6c8a8, beirut: 0xc4bba9 } };

const plans = new Map();
/** The town's big buildings: { hospital: { row, i0, n }, precinct: { row, i0, n } }. */
export function bigPlan(town) {
  if (plans.has(town)) return plans.get(town);
  const out = {};
  for (const [kind, K] of Object.entries(BIG)) {
    const rows = [-3, -2, -1, 1, 2, 3].sort((a, b) => hash(town, kind, a) - hash(town, kind, b));
    let got = null;
    for (const row of rows) {
      if (out.hospital && out.hospital.row === row) continue;        // (never the two on one street)
      for (let i0 = K.from; i0 + K.n - 1 <= K.to && !got; i0++) {
        let clear = true;
        for (let i = i0; i < i0 + K.n; i++) if (stationAt(town, row, i)) clear = false;
        if (clear) got = { row, i0, n: K.n };
      }
      if (got) break;
    }
    out[kind] = got ?? { row: 3, i0: K.from, n: K.n };
  }
  plans.set(town, out);
  return out;
}
/** Section i of row `row`: part of a big building? { kind, part, n, main } or null. */
export function bigAt(town, row, i) {
  for (const [kind, P] of Object.entries(bigPlan(town))) if (P.row === row && i >= P.i0 && i < P.i0 + P.n) return { kind, part: i - P.i0, n: P.n, main: i - P.i0 === Math.floor(P.n / 2) };
  return null;
}

/**
 * The big building in section S (big: bigAt()'s): the front's runs between the mouths made one building each, the lots
 * that stood there and their doors gone; in the main section, its door. city: the city's id.
 */
export function bigBuildings(S, big, city) {
  const front = S.buildings.filter(B => B.z === Z.front && B.style !== 'embassy' && B.style !== 'station');
  if (!front.length) return;
  // (runs: buildings side by side, nothing between)
  const runs = [];
  for (const B of [...front].sort((a, b) => a.x0 - b.x0)) { const R = runs.at(-1); if (R && Math.abs(R.x1 - B.x0) < 0.05) R.x1 = B.x1; else runs.push({ x0: B.x0, x1: B.x1, seed: B.seed, d: B.d }); }
  S.buildings = S.buildings.filter(B => !front.includes(B));
  // (their masses one block a run too, as the shops' floors are carved from: sim/map/street.js shopFloors())
  for (const R of runs) {
    const mine = S.blockers.filter(o => o.what === 'building' && Math.abs(o.z1 - Z.front) < 0.01 && o.x0 >= R.x0 - 0.01 && o.x1 <= R.x1 + 0.01);
    if (!mine.length) continue;
    const z0 = Math.min(...mine.map(o => o.z0));
    S.blockers = S.blockers.filter(o => !mine.includes(o));
    S.blockers.push({ x0: R.x0, z0, x1: R.x1, z1: Z.front, what: 'building' });
  }
  S.doors = S.doors.filter(d => !front.some(B => d.x > B.x0 - 0.01 && d.x < B.x1 + 0.01 && Math.abs(d.z - B.z) < 1));
  const main = big.main ? runs.reduce((b, R) => (R.x1 - R.x0 > b.x1 - b.x0 ? R : b)) : null;
  for (const R of runs) S.buildings.push(building(S, big.kind, city, R, R === main));
}

function building(S, kind, city, R, main) {
  const K = BIG[kind], W = WORDS[city] ?? WORDS.london, w = R.x1 - R.x0, mid = w / 2, ops = [], G = 4.6, F = (K.h - G - 1.2) / K.floors;
  const wall = WALLS[kind][city] ?? 0xdcd8cf, brick = kind === 'precinct' && city === 'london';
  const B = { x0: R.x0, x1: R.x1, z: Z.front, d: R.d ?? 35, h: K.h, wall: brick ? 'brick' : 'concrete', wallColor: wall, roof: 'flat', roofColor: 0x6a7182, style: K.style, ops, seed: R.seed,
    look: { dress: K.style, roofKit: kind === 'hospital' ? 'antenna' : 'none', pipes: [], hanging: [], awnings: [] } };
  ops.push(brick ? ['bricks', 0, 0, w, K.h, wall] : ['concrete', 0, 0, w, K.h, wall]);
  ops.push(['rect', 0, 0, w, G, kind === 'hospital' ? 0xc8ccd2 : brick ? 0x6e3a30 : 0xa8a49c], ['band', G, kind === 'hospital' ? 0x8f96a6 : 0xc4bba9]);
  // (the floors: a hospital's ribbons of glass, a precinct's grid of windows)
  for (let f = 0; f < K.floors; f++) {
    const y = G + F * f + 0.8;
    if (kind === 'hospital') ops.push(['ribbon', 0.6, y, w - 1.2, F - 1.4, 0x8f96a6]);
    else for (let x = 0.8; x + 1.3 < w - 0.6; x += 2.6) ops.push(['window', x, y, 1.3, F - 1.3, { frame: brick ? 0xe2dac6 : 0x8f96a6, lintel: brick ? 0xe2dac6 : null }]);
  }
  ops.push(['parapet', K.h - 0.6, 0.6, kind === 'hospital' ? 0xc8ccd2 : brick ? 0xe2dac6 : 0xb8b0a0]);
  // (the ground floor: tall windows along it, none where the way in is)
  const dw = kind === 'hospital' ? 4.6 : 3.2, door = main ? [mid - dw / 2 - 1.2, mid + dw / 2 + 1.2] : null;
  for (let x = 0.8; x + 1.8 < w - 0.6; x += 3.2) if (!door || x + 1.8 < door[0] || x > door[1]) ops.push(['window', x, 1.0, 1.8, 2.4, { frame: 0x6a7182, lintel: null }]);
  if (!main) return B;
  // (its name along the band over the ground floor, wide, where the street sees it; the way in: a hospital's A&E under its
  // canopy, a precinct's doors under its own)
  const sw = Math.min(w - 2, Math.max(10, w * 0.6));
  ops.push(['sign', mid - sw / 2, G + 0.25, sw, 1.0, W[kind], kind === 'hospital' ? { bg: 0x1f5aa6, fg: 0xf6f4ee, border: 0xdfe2e8, style: 'board' } : { bg: 0x283f6b, fg: 0xf6f4ee, border: 0xdfe2e8, style: 'board' }]);
  const px = mid - dw / 2, pw = dw - 1.3;
  ops.push(['canopy', px - 1.0, px + dw + 1.0, 3.5, kind === 'hospital' ? 0xdfe2e8 : 0x6a7182]);
  ops.push(['shopfront', px, pw, 2.75, { frame: 0x8f96a6 }]);
  ops.push(['door', px + dw - 1.2, 1.1, 2.45, { color: 0x6a7182, frame: 0x8f96a6, glass: true }]);
  if (kind === 'hospital') ops.push(['sign', px - 0.6, 3.75, dw + 1.2, 0.75, W.ae, { bg: 0xb33a34, fg: 0xf6f4ee, border: 0xf6f4ee, style: 'fascia' }]);
  S.doors.push({ x: R.x0 + px + dw - 0.65, z: Z.front, w: 1.1, kind: 'shop', shop: kind === 'hospital' ? 'hospital' : 'police', big: kind, pane: { x0: R.x0 + px, x1: R.x0 + px + pw, z: Z.front } });
  return B;
}
