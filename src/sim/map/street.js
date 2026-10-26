// TRADECRAFT sim: a Moscow street, generated in sections. Pure data: the sim walks it, the renderer
// (src/render/town.js) draws it.
//
// The city is rows of streets running east–west (x east, z south, the camera looking north), each its
// own map: row 0, the street north of it row −1, south row +1. A map is one row, generated SECTION_M
// metres at a time from the city's seed, the row and the section's index alone, so any section can be
// made again exactly (saves keep only the seed) and a row grows at either end as someone walks on
// (DESIGN.md, World size). Every side leads somewhere:
//   - east and west, the street goes on;
//   - north, side streets (a road between pavements, GAP_M.side wide) and alleys (GAP_M.alley) run
//     through the terrace to the map's edge (Z.north), and on to the next street north;
//   - south, past the boulevard, the boulevard's far road and its far pavement, or a park, and then a
//     hedged strip with gaps where the next street's side streets and alleys come up to meet it (Z.edge).
// A row's north gaps and the south gaps of the row north of it are the same ones (gapsOf()), so a
// way out of one map is a way into the next: exits[] says where, and placeName() what it's called.
// Cross-section, north to south (Z):
//
//   a terrace of buildings, fronts on the building line   −40 (Z.north) … −5
//   the far pavement, wide as Moscow's                     −5 … −0.5
//   the road, a lane each way                              −0.5 … 7
//   the near pavement                                      7 … 10
//   the south band, by stretches of STRETCH sections:
//     a boulevard: a railing, a lawn with trees, the gravel path, benches facing it, a lawn, a
//     railing (10 … 19); its far road (19.8 … 26) and far pavement (26 … 29.5);
//     or a park: lawns and trees, the same gravel path, a pond, a fountain, a monument or a kiosk,
//     paths down to a south walk on the far pavement's line (10 … 29.5)
//   a hedge, and the strip behind it to the map's edge          29.5 … 34 (Z.edge)
//
// The terrace is pre-revolutionary plaster in Moscow's ochres, pinks and greens with white trim, red
// brick, or a Stalinist block with a heavy base; shops on the ground floor, signs in Cyrillic, arches
// through to the courtyards. A building's facade is a list of paint operations (ops) for the art's
// facade painter (src/art/pixeltown.js): data here, so the sim knows the doors and shops it paints.
// Lengths are chosen so patterns repeat in whole periods across a section (SECTION_M = 45 m: 720
// pixels, a whole number of slabs, kerb stones and lane dashes), so sections join seamlessly.
//
// What the sim reads: `blockers` (rectangles nobody walks through), the LANES (where passers-by
// walk), `doors`, `crossings` (zebras over the street, with a gap in the railing), `crossingsS` (the
// way from the boulevard's path to the far pavement: a zebra over the far road, or a park path),
// `lamps` (light, sim/light.js), `exits` (where the map leads off: { dir 'n' | 's', x0, x1, kind,
// name }), `band` ('boulevard' | 'park').
import { stream, int, range, pick, chance, weighted, hash } from '../rng.js';
import { LAMP } from '../light.js';

export const SECTION_M = 45;
export const Z = {
  north: -40, back: -40, front: -5, kerbN: -0.5, kerbS: 7, fence: 10,
  pathN: 12.5, pathS: 16.5, fenceS: 19, roadN: 19.8, roadS: 26, south: 29.5, hedge: 30.4, edge: 34,
};
// Where passers-by walk, by lane: [zMin, zMax] of their line.
export const LANES = { far: [-4.0, -1.4], near: [7.6, 9.4], path: [13.1, 15.9], south: [26.6, 28.8] };
export const GAP_M = { side: 10, alley: 3 };
export const STRETCH = 4;                                          // sections of one band (a boulevard, a park)
export const PARK_SHARE = 0.35;
export const ROW_M = Z.edge - Z.north;                             // one row's depth, north edge to south

// Names. A row is a street (and its boulevard, its parks), each side street a lane.
const STREETS = ['Pokrovka', 'Maroseyka', 'Myasnitskaya', 'Sretenka', 'Solyanka', 'Petrovka', 'Pyatnitskaya', 'Ostozhenka',
  'Prechistenka', 'Bolshaya Ordynka', 'Varvarka', 'Ilyinka', 'Bolshaya Nikitskaya', 'Povarskaya', 'Sivtsev Vrazhek', 'Zabelina'];
const BOULEVARDS = ['Pokrovsky', 'Chistoprudny', 'Yauzsky', 'Rozhdestvensky', 'Sretensky', 'Petrovsky', 'Strastnoy', 'Tverskoy', 'Nikitsky', 'Gogolevsky'];
const PARKS = ['the Lyalin garden', 'the Ilyinsky square', 'the Novopushkinsky garden', 'the Morozov garden', 'the Pokrovsky garden',
  'the Bauman garden', 'the Myasnitsky square', 'the Khitrovka square', 'the Ivanovsky garden', 'the Starosadsky square'];
const LANE_NAMES = ['Kolpachny', 'Armyansky', 'Krivokolenny', 'Potapovsky', 'Lyalin', 'Khokhlovsky', 'Podkopayevsky', 'Starosadsky',
  'Petroverigsky', 'Sverchkov', 'Bobrov', 'Milyutinsky', 'Furkasovsky', 'Kostyansky', 'Lukov', 'Pechatnikov', 'Bolshoy Kozlovsky',
  'Maly Zlatoustinsky', 'Spasoglinishchevsky', 'Barashevsky', 'Durasovsky', 'Lyalin', 'Tokmakov', 'Gusyatnikov'];
const at = (list, ...k) => list[hash(...k) % list.length];
export const streetName = (seed, row) => at(STREETS, seed, row, 'street');
export const boulevardName = (seed, row) => `${at(BOULEVARDS, seed, row, 'boulevard')} Boulevard`;
export const parkName = (seed, row, i) => at(PARKS, seed, row, Math.floor(i / STRETCH), 'park');

/** A row's ways north through its terrace in section i: [{ x0, x1, kind 'side' | 'alley', name }]. */
export function gapsOf(seed, row, i) {
  const r = stream('street-gaps', seed, row, i), x0 = i * SECTION_M, gaps = [];
  if (chance(r, 0.35)) { const gx = x0 + 6 + int(r, 23); gaps.push({ x0: gx, x1: gx + GAP_M.side, kind: 'side' }); }
  if (chance(r, 0.35)) {                                          // an alley, a building's width from anything else
    for (let k = 0; k < 6; k++) {
      const ax = x0 + 8 + int(r, 26);
      if (gaps.every(g => ax + GAP_M.alley < g.x0 - 8 || ax > g.x1 + 8)) { gaps.push({ x0: ax, x1: ax + GAP_M.alley, kind: 'alley' }); break; }
    }
  }
  for (const g of gaps) g.name = g.kind === 'side' ? `${at(LANE_NAMES, seed, row, i, Math.round(g.x0), 'lane')} Lane` : `an alley off ${streetName(seed, row)}`;
  return gaps.sort((a, b) => a.x0 - b.x0);
}

/** A row's south band at section i: a boulevard, or a park, a stretch of STRETCH sections at a time. */
export function bandOf(seed, row, i) {
  return chance(stream('street-band', seed, row, Math.floor(i / STRETCH)), PARK_SHARE) ? 'park' : 'boulevard';
}

/** What a spot is called, for the player: the street, a lane, the boulevard, a park. */
export function placeName(seed, row, x, z) {
  const i = Math.floor(x / SECTION_M);
  if (z < Z.front) return gapsOf(seed, row, i).find(g => x >= g.x0 && x <= g.x1)?.name ?? streetName(seed, row);
  if (z <= Z.fence) return streetName(seed, row);
  if (z >= Z.south) return gapsOf(seed, row + 1, i).find(g => x >= g.x0 && x <= g.x1)?.name ?? streetName(seed, row);
  return bandOf(seed, row, i) === 'park' ? parkName(seed, row, i) : boulevardName(seed, row);
}

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

/** Section i of row `row` (0 by default) of the street map with this seed. */
export function section(seed, i, row = 0) {
  const r = stream('street', seed, row, i);
  const x0 = i * SECTION_M, x1 = x0 + SECTION_M;
  const S = {
    i, row, x0, x1, seed: stream('street-art', seed, row, i)[0], band: bandOf(seed, row, i), west: bandOf(seed, row, i - 1), east: bandOf(seed, row, i + 1),
    buildings: [], doors: [], props: [], lamps: [], blockers: [], crossings: [], crossingsS: [], exits: [], park: null,
    gapsN: gapsOf(seed, row, i), gapsS: gapsOf(seed, row + 1, i),
  };
  const block = (ax, az, bx, bz, what) => S.blockers.push({ x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), what });
  const lamp = (x, z, lightZ = z) => { S.props.push({ kind: 'lamp', x, z }); S.lamps.push({ ...LAMP, x, z: lightZ }); block(x - 0.16, z - 0.16, x + 0.16, z + 0.16, 'lamp'); };
  for (const g of S.gapsN) S.exits.push({ dir: 'n', ...g });
  for (const g of S.gapsS) S.exits.push({ dir: 's', ...g });
  const inGap = (gaps, x, m = 0) => gaps.some(g => x > g.x0 - m && x < g.x1 + m);

  // The terrace: buildings of 9–18 m filling the section between its gaps north.
  const runs = [];
  let a = x0;
  for (const g of S.gapsN) { runs.push([a, g.x0]); a = g.x1; }
  runs.push([a, x1]);
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
  // The ways north: a side street has its lamps and a bin; an alley is dark, with a bin.
  for (const g of S.gapsN) {
    if (g.kind === 'side') {
      lamp(g.x0 + 0.6, -12); lamp(g.x1 - 0.6, -29);
      S.props.push({ kind: 'bin', x: g.x1 - 0.7, z: -18 }); block(g.x1 - 0.95, -18.25, g.x1 - 0.45, -17.75, 'bin');
    } else { S.props.push({ kind: 'bin', x: g.x0 + 0.4, z: -23 }); block(g.x0 + 0.15, -23.25, g.x0 + 0.65, -22.75, 'bin'); }
  }

  // The zebra over the street: at a side street's mouth if there's one, and the railing's gap in
  // line with it. The way south from the boulevard's path: over the far road at the next street's
  // side street if one comes up to meet it, else in line with the zebra.
  const side = S.gapsN.find(g => g.kind === 'side'), sideS = S.gapsS.find(g => g.kind === 'side');
  const zx = side ? (side.x0 + side.x1) / 2 - 1.5 : x0 + 6 + int(r, 30);
  const sx = sideS ? (sideS.x0 + sideS.x1) / 2 - 1.5 : zx;
  S.crossings.push({ x0: zx, x1: zx + 3 });
  S.crossingsS.push({ x0: sx, x1: sx + 3 });
  const near = (x, c, m) => x > c - m && x < c + 3 + m;
  // Lamps along the far kerb every 15 m, stepping aside from the zebra's line.
  const aside = (x, c) => (x > c - 1.2 && x < c + 4.2 ? (x < c + 1.5 ? c - 1.2 : c + 4.2) : x);
  for (const x of [x0 + 7.5, x0 + 22.5, x0 + 37.5].map(x => aside(x, zx))) lamp(x, -0.9, -0.4);
  // The railing along the near pavement, open at the zebra (and at the park's gates).
  S.props.push({ kind: 'railing', x0, x1: zx - 0.5, z: Z.fence }, { kind: 'railing', x0: zx + 3.5, x1, z: Z.fence });
  block(x0, Z.fence - 0.05, zx - 0.5, Z.fence + 0.05, 'railing');
  block(zx + 3.5, Z.fence - 0.05, x1, Z.fence + 0.05, 'railing');
  // A post box, now and then, against a wall between doors.
  if (chance(r, 0.35)) {
    const x = x0 + 4 + int(r, 37);
    if (!S.doors.some(d => Math.abs(d.x - x) < 2) && !inGap(S.gapsN, x, 1)) {
      S.props.push({ kind: 'postbox', x, z: -4.65 }); block(x - 0.25, -4.9, x + 0.25, -4.4, 'postbox');
    }
  }
  // Parked cars along the far kerb, nose east, clear of the zebra and the side streets.
  for (let x = x0 + 3 + range(r, 0, 4); x < x1 - 3; x += 5 + range(r, 0, 9)) {
    if (near(x, zx, 4) || inGap(S.gapsN, x, 3) || !chance(r, 0.55)) continue;
    S.props.push({ kind: 'car', x, z: 0.55, color: pick(r, CAR_COLOURS), seed: int(r, 1000) });
    block(x - 2.1, -0.35, x + 2.1, 1.45, 'car');
  }

  if (S.band === 'boulevard') boulevard(r, S, zx, sx, block, lamp, near, aside);
  else park(r, S, zx, sx, block, lamp, near, aside);

  // The hedge along the south, open where the next street's lanes come up to meet it.
  let hx = x0;
  for (const g of [...S.gapsS, { x0: x1, x1 }]) {
    if (g.x0 - hx > 0.1) { S.props.push({ kind: 'hedge', x0: hx, x1: g.x0, z: Z.south }); block(hx, Z.south + 0.1, g.x0, Z.hedge, 'hedge'); }
    hx = g.x1;
  }
  for (const g of S.gapsS) {                                       // the gap's sides, out to the edge
    block(g.x0 - 0.3, Z.hedge, g.x0, Z.edge + 1, 'hedge'); block(g.x1, Z.hedge, g.x1 + 0.3, Z.edge + 1, 'hedge');
  }
  return S;
}

// The boulevard: a railing, lawns with trees, the gravel path with benches and lamps, a railing; the
// far road with its zebra (sx), lamps and parked cars along the far pavement; the road shut off with a
// railing where a park begins.
function boulevard(r, S, zx, sx, block, lamp, near, aside) {
  const { x0, x1 } = S;
  for (const x of [x0 + 3, x0 + 18, x0 + 33].map(x => aside(aside(x, zx), sx))) lamp(x, 12.55, 13.05);   // (in the lawn's edge, clear of the path)
  for (const [z, off, c] of [[11.3, 0, zx], [17.8, 4, sx]]) {
    for (let x = x0 + 1.5 + off + range(r, 0, 1.2); x < x1 - 1; x += 7 + range(r, 0, 2.5)) {
      if (near(x, c, 2.2) || (z < 12 && Math.abs(((x - x0 - 3) % 15 + 15) % 15) < 1.2)) continue;
      S.props.push({ kind: 'tree', x, z, seed: int(r, 1000), size: range(r, 0.85, 1.1) });
      block(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 'tree');
    }
  }
  benches(r, S, zx, block, near);
  S.props.push({ kind: 'railing', x0, x1: sx - 0.5, z: Z.fenceS }, { kind: 'railing', x0: sx + 3.5, x1, z: Z.fenceS });
  block(x0, Z.fenceS - 0.05, sx - 0.5, Z.fenceS + 0.05, 'railing');
  block(sx + 3.5, Z.fenceS - 0.05, x1, Z.fenceS + 0.05, 'railing');
  for (const x of [x0 + 7.5, x0 + 22.5, x0 + 37.5].map(x => aside(x, sx))) lamp(x, Z.roadS + 0.15, Z.roadS + 0.65);
  for (let x = x0 + 3 + range(r, 0, 4); x < x1 - 3; x += 5 + range(r, 0, 10)) {
    if (near(x, sx, 4) || S.gapsS.some(g => x > g.x0 - 3 && x < g.x1 + 3) || !chance(r, 0.45)) continue;
    if ((S.west === 'park' && x < x0 + 3) || (S.east === 'park' && x > x1 - 3)) continue;
    S.props.push({ kind: 'car', x, z: 25.0, color: pick(r, CAR_COLOURS), seed: int(r, 1000), flip: true });
    block(x - 2.1, 24.1, x + 2.1, 25.9, 'car');
  }
  if (S.west === 'park') { S.props.push({ kind: 'railing', x0, x1: x0, z0: Z.fenceS, z1: Z.roadS }); block(x0, Z.fenceS, x0 + 0.1, Z.roadS, 'railing'); }
  if (S.east === 'park') { S.props.push({ kind: 'railing', x0: x1, x1, z0: Z.fenceS, z1: Z.roadS }); block(x1 - 0.1, Z.fenceS, x1, Z.roadS, 'railing'); }
}

// Benches along the path, facing it, not by a crossing or a lamp; a bin by some.
function benches(r, S, zx, block, near) {
  const { x0, x1 } = S;
  for (let x = x0 + 9 + int(r, 4); x < x1 - 2; x += 12 + int(r, 6)) {
    if (near(x, zx, 3) || Math.abs(((x - x0 - 3) % 15 + 15) % 15 - 7.5) > 5.5) continue;
    S.props.push({ kind: 'bench', x, z: 12.45, seats: [x - 0.45, x + 0.45] });
    block(x - 0.85, 12.15, x + 0.85, 12.7, 'bench');
    if (chance(r, 0.5)) { S.props.push({ kind: 'bin', x: x + 1.3, z: 12.35 }); block(x + 1.05, 12.1, x + 1.55, 12.6, 'bin'); }
  }
}

// A park: the gate in line with the zebra, lawns and trees, the gravel path and its benches, paths
// down to the south walk (from the gate, and to the lanes that come up from the south), and one
// thing to see: a pond, a fountain, a monument, a kiosk or flower beds.
function park(r, S, zx, sx, block, lamp, near, aside) {
  const { x0, x1 } = S;
  const paths = [{ x0: zx, x1: zx + 3 }];
  if (Math.abs(sx - zx) > 4) paths.push({ x0: sx, x1: sx + 3 });
  for (const g of S.gapsS) if (!paths.some(p => g.x0 < p.x1 + 2 && g.x1 > p.x0 - 2)) paths.push({ x0: (g.x0 + g.x1) / 2 - 1.5, x1: (g.x0 + g.x1) / 2 + 1.5 });
  S.crossingsS = paths.map(p => ({ x0: p.x0, x1: p.x1 }));
  const onPath = (x, m) => paths.some(p => x > p.x0 - m && x < p.x1 + m);
  for (const x of [x0 + 3, x0 + 18, x0 + 33].map(x => aside(x, zx))) lamp(x, 12.55, 13.05);
  for (const x of [x0 + 10.5, x0 + 34.5]) if (!onPath(x, 1)) lamp(x, Z.south - 0.22, Z.south - 0.72);
  benches(r, S, zx, block, near);
  // The thing to see, in the lawn between the path and the south walk, clear of the paths.
  const kind = weighted(r, [['pond', 3], ['fountain', 1.5], ['monument', 2], ['kiosk', 1.5], ['beds', 1]]);
  const size = { pond: [8 + int(r, 6), 4 + int(r, 2)], fountain: [4, 4], monument: [1.8, 1.8], kiosk: [3, 2], beds: [4, 1.6] }[kind];
  let fx = null;
  for (let k = 0; k < 12 && fx === null; k++) {
    const x = x0 + 2 + range(r, 0, SECTION_M - 4 - size[0]);
    if (!paths.some(p => x < p.x1 + 1.5 && x + size[0] > p.x0 - 1.5)) fx = x;
  }
  S.park = { paths, feature: null };
  if (fx !== null) {
    const fz = kind === 'kiosk' ? 23.2 : 21 - size[1] / 2 + range(r, -1, 1);
    const f = { kind, x0: fx, x1: fx + size[0], z0: fz, z1: fz + size[1], seed: int(r, 1000) };
    S.park.feature = f;
    if (kind === 'beds') { block(fx, fz, fx + 4, fz + 1.6, 'bed'); block(fx, fz + 2.6, fx + 4, fz + 4.2, 'bed'); f.z1 = fz + 4.2; }
    else block(fx, fz, fx + size[0], fz + size[1], kind === 'kiosk' ? 'building' : kind);
    if (kind === 'kiosk') S.doors.push({ x: fx + 1.5, z: fz + 2, w: 1, kind: 'kiosk' });
  }
  const free = (x, z) => !onPath(x, 1.2) && !(S.park.feature && x > S.park.feature.x0 - 1.8 && x < S.park.feature.x1 + 1.8 && z > S.park.feature.z0 - 1.8 && z < S.park.feature.z1 + 1.8);
  // Trees: the lawn by the railing, and clumps across the big lawn.
  for (let x = x0 + 1.5 + range(r, 0, 1.2); x < x1 - 1; x += 5 + range(r, 0, 2.5)) {
    if (!free(x, 11.3) || Math.abs(((x - x0 - 3) % 15 + 15) % 15) < 1.2) continue;
    S.props.push({ kind: 'tree', x, z: 11.3, seed: int(r, 1000), size: range(r, 0.85, 1.15) });
    block(x - 0.25, 11.05, x + 0.25, 11.55, 'tree');
  }
  for (let k = 0; k < 9; k++) {
    const x = x0 + 1 + range(r, 0, SECTION_M - 2), z = 17.6 + range(r, 0, 7.6);
    if (!free(x, z) || S.props.some(p => p.kind === 'tree' && Math.hypot(p.x - x, p.z - z) < 2.6)) continue;
    S.props.push({ kind: 'tree', x, z, seed: int(r, 1000), size: range(r, 0.8, 1.15) });
    block(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 'tree');
  }
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
