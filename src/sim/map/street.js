// TRADECRAFT sim: a Moscow street, generated in sections. Pure data: the sim walks it, the renderer
// (src/render/town.js) draws it.
//
// A street map runs east–west (x east, z south, the camera looking north). A section is SECTION_M
// metres of it, generated from the map's seed and the section's index alone, so any section can be
// made again exactly (saves keep only the seed) and a map can grow at either end as someone walks
// on: a tail that reaches the edge carries on into a new, similar section (DESIGN.md, World size).
// Cross-section, north to south (Z):
//
//   a terrace of buildings, fronts on the building line   … −5
//   the far pavement, wide as Moscow's                     −5 … −0.5
//   the road, a lane each way                              −0.5 … 7
//   the near pavement                                      7 … 10
//   a railing, then a boulevard: a lawn with trees,        10 … 19
//   the gravel path, benches facing it, a lawn, a railing
//   the boulevard's far road (not walkable)                19 …
//
// Some sections open a side street (a pereulok) through the terrace, to a building across its end.
// The terrace is pre-revolutionary plaster in Moscow's ochres, pinks and greens with white trim,
// red brick, or a Stalinist block with a heavy base; shops on the ground floor, signs in Cyrillic,
// arches through to the courtyards. A building's facade is a list of paint operations (ops) for the
// art's facade painter (src/art/pixeltown.js): data here, so the sim knows the doors and shops it
// paints. Lengths are chosen so patterns repeat in whole periods across a section (SECTION_M = 45 m:
// 720 pixels, a whole number of slabs, kerb stones and lane dashes), so sections join seamlessly.
//
// What the sim reads: `blockers` (rectangles nobody walks through), `lanes` (where passers-by walk),
// `doors`, `crossings` (zebras, with a gap in the railing), `lamps` (light, sim/light.js), `exits`
// (where the street leaves the map: a side street's far end).
import { stream, int, range, pick, chance, weighted } from '../rng.js';
import { LAMP } from '../light.js';

export const SECTION_M = 45;
export const Z = {
  sideEnd: -24, back: -40, front: -5, kerbN: -0.5, kerbS: 7, fence: 10,
  pathN: 12.5, pathS: 16.5, fenceS: 19, farRoad: 26,
};
// Where passers-by walk, by lane: [zMin, zMax] of their line.
export const LANES = { far: [-4.0, -1.4], near: [7.6, 9.4], path: [13.1, 15.9] };

// Shops: their sign, in Cyrillic, and what they sell (the game's later business: clothes, a phone…).
export const SHOPS = {
  pharmacy: 'АПТЕКА', grocery: 'ПРОДУКТЫ', cafe: 'КАФЕ', flowers: 'ЦВЕТЫ', bakery: 'ХЛЕБ', books: 'КНИГИ',
  optician: 'ОПТИКА', bank: 'БАНК', tobacco: 'ТАБАК', exchange: 'ОБМЕН ВАЛЮТ', bar: 'БАР', clothes: 'ОДЕЖДА',
  shoes: 'ОБУВЬ', watches: 'ЧАСЫ', phones: 'СВЯЗЬ', shawarma: 'ШАУРМА', beer: 'ПИВО', deli: 'ГАСТРОНОМ', restaurant: 'РЕСТОРАН',
};
const SHOP_WEIGHTS = [['grocery', 3], ['pharmacy', 2.5], ['cafe', 3], ['clothes', 2], ['flowers', 1.5], ['bakery', 1.5],
  ['books', 1], ['optician', 1], ['bank', 1.2], ['tobacco', 1], ['exchange', 1], ['bar', 1.2], ['shoes', 1], ['watches', 0.6],
  ['phones', 1.2], ['shawarma', 1], ['beer', 0.8], ['deli', 1], ['restaurant', 1]];
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

const GROUND_H = 4.2;                                              // a ground floor (shops), metres
const FLOOR_H = 3.4;

/** Section i of the street map with this seed. */
export function section(seed, i) {
  const r = stream('street', seed, i);
  const x0 = i * SECTION_M, x1 = x0 + SECTION_M;
  const S = { i, x0, x1, seed: stream('street-art', seed, i)[0], buildings: [], doors: [], props: [], lamps: [], blockers: [], crossings: [], exits: [], side: null };
  const block = (ax, az, bx, bz, what) => S.blockers.push({ x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), what });

  // A side street through the terrace, now and then.
  if (chance(r, 0.4)) {
    const gx = x0 + 10 + int(r, 22);
    S.side = { x0: gx, x1: gx + 10 };
    S.exits.push({ x: gx + 5, z: Z.sideEnd + 2.5, kind: 'side' });
  }
  // The terrace: buildings of 9–18 m filling the section, around the side street.
  const runs = S.side ? [[x0, S.side.x0], [S.side.x1, x1]] : [[x0, x1]];
  for (const [a, b] of runs) {
    let x = a;
    while (b - x > 0.01) {
      let w = 9 + int(r, 10);
      if (b - x - w < 8) w = b - x;                                  // no sliver at the end of a run
      S.buildings.push(building(r, x, x + w, Z.front, S));
      block(x, Z.back, x + w, Z.front, 'building');
      x += w;
    }
  }
  if (S.side) {                                                    // across the side street's end
    const { x0: gx, x1: gx1 } = S.side;
    S.buildings.push(building(r, gx - 3, gx1 + 3, Z.sideEnd, S, { far: true }));
    block(gx, Z.back, gx1, Z.sideEnd, 'building');
    S.props.push({ kind: 'lamp', x: gx + 0.6, z: -9 }, { kind: 'bin', x: gx1 - 0.7, z: -14 });
    S.lamps.push({ ...LAMP, x: gx + 0.6, z: -8.5 });
    block(gx + 0.45, -9.15, gx + 0.75, -8.85, 'lamp');
    block(gx1 - 0.95, -14.25, gx1 - 0.45, -13.75, 'bin');
  }

  // A zebra crossing, and the railing's gap in line with it.
  const zx = x0 + 6 + int(r, 30);
  S.crossings.push({ x0: zx, x1: zx + 3 });
  // Lamps along the far kerb and the path, every 15 m (stepping aside from the crossing's line);
  // trees on both lawns; benches facing the path.
  const aside = (x) => (x > zx - 1.2 && x < zx + 4.2 ? (x < zx + 1.5 ? zx - 1.2 : zx + 4.2) : x);
  for (let x of [x0 + 7.5, x0 + 22.5, x0 + 37.5].map(aside)) {
    S.props.push({ kind: 'lamp', x, z: -0.9 });
    S.lamps.push({ ...LAMP, x, z: -0.4 });
    block(x - 0.16, -1.06, x + 0.16, -0.74, 'lamp');
  }
  for (let x of [x0 + 3, x0 + 18, x0 + 33].map(aside)) {          // (in the lawn's edge, clear of the path)
    S.props.push({ kind: 'lamp', x, z: 12.55 });
    S.lamps.push({ ...LAMP, x, z: 13.05 });
    block(x - 0.16, 12.39, x + 0.16, 12.71, 'lamp');
  }
  const clear = (x, m = 2.2) => x > zx - m && x < zx + 3 + m;      // keep the crossing's line open
  for (const [z, off] of [[11.3, 0], [17.8, 4]]) {
    for (let x = x0 + 1.5 + off + range(r, 0, 1.2); x < x1 - 1; x += 7 + range(r, 0, 2.5)) {
      if (clear(x) || (z < 12 && Math.abs(((x - x0 - 3) % 15 + 15) % 15) < 1.2)) continue;
      S.props.push({ kind: 'tree', x, z, seed: int(r, 1000), size: range(r, 0.85, 1.1) });
      block(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 'tree');
    }
  }
  for (let x = x0 + 9 + int(r, 4); x < x1 - 2; x += 12 + int(r, 6)) {
    if (clear(x, 3) || Math.abs(((x - x0 - 3) % 15 + 15) % 15 - 7.5) > 5.5) continue;   // not by a crossing or a lamp
    S.props.push({ kind: 'bench', x, z: 12.45, seats: [x - 0.45, x + 0.45] });
    block(x - 0.85, 12.15, x + 0.85, 12.7, 'bench');
    if (chance(r, 0.5)) { S.props.push({ kind: 'bin', x: x + 1.3, z: 12.35 }); block(x + 1.05, 12.1, x + 1.55, 12.6, 'bin'); }
  }
  // Railings: along the near pavement and the boulevard's far side, open at the crossing.
  S.props.push({ kind: 'railing', x0, x1: zx - 0.5, z: Z.fence }, { kind: 'railing', x0: zx + 3.5, x1, z: Z.fence }, { kind: 'railing', x0, x1, z: Z.fenceS });
  block(x0, Z.fence - 0.05, zx - 0.5, Z.fence + 0.05, 'railing');
  block(zx + 3.5, Z.fence - 0.05, x1, Z.fence + 0.05, 'railing');
  block(x0, Z.fenceS - 0.05, x1, Z.fenceS + 0.05, 'railing');
  // A post box, now and then, against a wall between doors.
  if (chance(r, 0.35)) {
    const x = x0 + 4 + int(r, 37);
    if (!S.doors.some(d => Math.abs(d.x - x) < 2) && !(S.side && x > S.side.x0 - 1 && x < S.side.x1 + 1)) {
      S.props.push({ kind: 'postbox', x, z: -4.65 }); block(x - 0.25, -4.9, x + 0.25, -4.4, 'postbox');
    }
  }
  // Parked cars along the far kerb, nose east, clear of the crossing and the side street.
  for (let x = x0 + 3 + range(r, 0, 4); x < x1 - 3; x += 5 + range(r, 0, 9)) {
    if (x > zx - 4 && x < zx + 7) continue;
    if (S.side && x > S.side.x0 - 3 && x < S.side.x1 + 3) continue;
    if (!chance(r, 0.55)) continue;
    S.props.push({ kind: 'car', x, z: 0.55, color: pick(r, CAR_COLOURS), seed: int(r, 1000) });
    block(x - 2.1, -0.35, x + 2.1, 1.45, 'car');
  }
  return S;
}

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
      S.doors.push({ x: x0 + x + sw - 0.65, z, w: 1.1, kind: 'shop', shop: kind });
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

// A colour a step or two darker, for bases and joints (the art's tone() does it properly; the sim only
// needs a stable value to hand over).
function toneOf(hex, steps) {
  const k = 1 + steps * 0.09;
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((hex >> s) & 255) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Which sections a street map spans around x, within its bounds (i0 … i1, either null when endless). */
export function sectionsAround(map, x, reachM) {
  let a = Math.floor((x - reachM) / SECTION_M), b = Math.floor((x + reachM) / SECTION_M);
  if (map.i0 !== null) a = Math.max(a, map.i0);
  if (map.i1 !== null) b = Math.min(b, map.i1);
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
