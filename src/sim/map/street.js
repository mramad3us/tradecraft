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
// Each wears a dress of its style (pediments, rustication, pilasters, an Art Nouveau frieze, a
// constructivist's ribbon windows; brick dressed in white, yellow, arched or painted over; a
// Stalinist block ornate or tiled, or in its place a panel block or a white-brick one of the
// seventies), and so does everything else on the street: see the looks, below.
// Lengths are chosen so patterns repeat in whole periods across a section (SECTION_M = 45 m: 720
// pixels, a whole number of slabs, kerb stones and lane dashes), so sections join seamlessly.
//
// What the sim reads: `blockers` (rectangles nobody walks through), the LANES (where passers-by
// walk), `doors` (a shop's has its window's glass: pane { x0, x1, z }, west of the door), `crossings` (zebras over the street, with a gap in the railing), `crossingsS` (the
// way from the boulevard's path to the far pavement: a zebra over the far road, or a park path),
// `lamps` (light, sim/light.js), `exits` (where the map leads off: { dir 'n' | 's', x0, x1, kind,
// name }), `band` ('boulevard' | 'park'). The looks (S.look, a prop's `look`, a tree's `species`, a
// building's dress) are paint: the sim never reads them.
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
  // An alley, a building's width from anything else; and every other section has one at least, so a
  // way north is never more than two sections off.
  if (chance(r, 0.35) || (!gaps.length && (i % 2 + 2) % 2 === 0)) {
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
  dress(S, seed, row, zx, sx);
  return S;
}

// The boulevard: a railing, lawns with trees, the gravel path with benches and lamps, a railing; the
// far road with its zebra (sx), lamps and parked cars along the far pavement; the road shut off with a
// railing where a park begins.
function boulevard(r, S, zx, sx, block, lamp, near, aside) {
  const { x0, x1 } = S;
  for (const x of [x0 + 3, x0 + 18, x0 + 33].map(x => aside(x, zx))) lamp(x, 12.55, 13.05);   // (in the lawn's edge, clear of the path and the gate's line)
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

// Benches along the path, facing it, not by a crossing or a lamp; a bin by some. Two seats with room
// between them (SEAT_GAP_M: the figures are drawn 1.25 m wide, their heads big: 40 cm of air), or (BENCH3)
// three; whoever sits takes a seat (seats: the x of each).
export const SEAT_GAP_M = 1.65;
export const BENCH = { 2: { len: SEAT_GAP_M + 1, seats: [-SEAT_GAP_M / 2, SEAT_GAP_M / 2] }, 3: { len: 2 * SEAT_GAP_M + 1, seats: [-SEAT_GAP_M, 0, SEAT_GAP_M] } };
export const BENCH3 = 0.35;
function benches(r, S, zx, block, near) {
  const { x0, x1 } = S;
  for (let x = x0 + 9 + int(r, 4); x < x1 - 2; x += 12 + int(r, 6)) {
    const B = BENCH[chance(r, BENCH3) ? 3 : 2], half = B.len / 2;
    if (near(x, zx, 2.1 + half) || Math.abs(((x - x0 - 3) % 15 + 15) % 15 - 7.5) > 6.4 - half) continue;
    S.props.push({ kind: 'bench', x, z: 12.45, len: B.len, seats: B.seats.map(o => x + o) });
    block(x - half, 12.15, x + half, 12.7, 'bench');
    if (chance(r, 0.5)) { S.props.push({ kind: 'bin', x: x + half + 0.45, z: 12.35 }); block(x + half + 0.2, 12.1, x + half + 0.7, 12.6, 'bin'); }
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
  for (const x of [x0 + 10.5, x0 + 34.5]) if (!onPath(x, 1) && !S.gapsS.some(g => x > g.x0 - 1 && x < g.x1 + 1)) lamp(x, Z.south - 0.22, Z.south - 0.72);
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

// A colour a step or two darker, for bases and joints (the art's tone() does it properly; the sim only
// needs a stable value to hand over).
function toneOf(hex, steps) {
  const k = 1 + steps * 0.09;
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((hex >> s) & 255) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ---------- the looks: what each thing is drawn as ----------
//
// Paint, never geometry. What a thing is (a lamp here, a bench there, a building this wide with these
// doors) is drawn from the section's own stream above; what it looks like (which lamp, which bench,
// which dress on the facade) is drawn here from streams of their own, so not one of the sim's picks
// moves, and it's added as keys the sim doesn't read: S.look, a prop's `look` (a lamp's `reach` too:
// where its head hangs, over its light), a tree's `species`, a building's `look`, `roofColor` and
// the paint ops of its dress, a park feature's `look`.
//   - Per stretch of STRETCH sections, a scheme (scheme()): the pavements, kerbs, road and its lane
//     marks, the lamps of each line, railings, benches, bins, the boulevard's trees. A street is laid
//     and furnished a stretch at a time. The change comes at a natural break, never mid-pavement: in a
//     stretch's first section, at the zebra's line (breakN: the main street, its kerb lamps and
//     railing, the boulevard's north half and a park) or the far road's crossing (breakS: the
//     boulevard's south half, the far road and its pavement). lookAt() says which scheme rules where.
//   - Per crossing, its zebra; per lane north or south, its surfaces and lamps (laneLook(): from the
//     lane's own row and place, so the two rows a lane joins agree); per run of hedge between two
//     gaps, its plants; per building, its dress; per tree in a park, its species; per car, its make;
//     per park feature, its version.
export const LOOKS = {
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

/** The scheme a street is laid and furnished with, stretch k of a row (see the looks, above). Made once (a few kept). */
const schemes = new Map();
export function scheme(seed, row, k) {
  const key = `${seed}|${row}|${k}`;
  if (schemes.has(key)) return schemes.get(key);
  const L = stream('street-scheme', seed, row, k), w = (key) => weighted(L, LOOKS[key]);
  const paveN = w('pave');
  const s = { paveN, paveS: chance(L, 0.55) ? paveN : w('pave'), kerb: w('kerb'), road: w('road'), lanes: w('lanes'), zebra: w('zebra'),
    lamp: w('lamp'), pathLamp: w('pathLamp'), farLamp: chance(L, 0.5) ? null : w('lamp'), railN: w('railing'), railS: w('railing'),
    bench: w('bench'), bin: w('bin'), treesN: w('rowTree'), treesS: chance(L, 0.5) ? null : w('rowTree'), farPave: w('pave'), farRoad: w('road') };
  schemes.set(key, s);
  if (schemes.size > 400) schemes.delete(schemes.keys().next().value);
  return s;
}

/** The scheme in force at (x, z) of section S (`band`: a boulevard's or a park's furniture). */
export function lookAt(S, x, z, band = false) {
  const L = S.look;
  if (band && S.west !== S.band) return L.b;                       // (a band begun at this section's edge is the new stretch's)
  return x < (z > Z.pathS && S.band === 'boulevard' ? L.breakS : L.breakN) ? L.a : L.b;
}

/** A lane's look ({ ground, walks, lamp }), from its own row (the terrace it runs through) and place. */
export function laneLook(seed, row, g) {
  const L = stream('street-lane', seed, row, Math.round(g.x0));
  if (g.kind === 'alley') return { ground: weighted(L, LOOKS.alley), lamp: null };
  return { ground: weighted(L, LOOKS.lane), walks: weighted(L, LOOKS.pave), lamp: weighted(L, LOOKS.sideLamp) };
}

/** The hedge's plants on the run that x is on: one kind from one gap south to the next. */
function hedgeLook(seed, row, x) {
  let from = -Infinity;
  for (let i = Math.floor(x / SECTION_M); i > Math.floor(x / SECTION_M) - 4 && from === -Infinity; i--) {
    for (const g of gapsOf(seed, row + 1, i)) if (g.x1 <= x + 0.01) from = Math.max(from, g.x1);
  }
  return weighted(stream('street-hedge', seed, row, Math.round(from === -Infinity ? 0 : from)), LOOKS.hedge);
}

// Dress a section: its looks (above), on new keys and paint ops only.
function dress(S, seed, row, zx, sx) {
  const L = stream('street-look', seed, row, S.i), k = Math.floor(S.i / STRETCH), w = (key) => weighted(L, LOOKS[key]);
  const b = scheme(seed, row, k), a = S.i % STRETCH === 0 ? scheme(seed, row, k - 1) : b;
  S.look = { a, b, breakN: zx + 1.5, breakS: sx + 1.5, rowSeed: hash(seed, row, 'paint') % 100000,
    zebra: chance(L, 0.7) ? b.zebra : w('zebra'), zebraS: chance(L, 0.7) ? b.zebra : w('zebra'),
    lanesN: S.gapsN.map(g => laneLook(seed, row, g)), lanesS: S.gapsS.map(g => laneLook(seed, row + 1, g)) };
  const lane = (x, z) => { const k2 = S.gapsN.findIndex(g => x >= g.x0 - 0.01 && x <= g.x1 + 0.01); return z < Z.front && k2 >= 0 ? S.look.lanesN[k2] : null; };
  for (const p of S.props) {
    const at = lookAt(S, p.x ?? p.x0, p.z ?? p.z0, (p.z ?? p.z0) > Z.fence);
    switch (p.kind) {
      case 'lamp': {
        const light = S.lamps.find(l => l.x === p.x && Math.abs(l.z - p.z) < 0.8);
        p.reach = light ? light.z - p.z : 0;
        const ln = lane(p.x, p.z);
        p.look = ln ? ln.lamp : p.z < Z.kerbS ? at.lamp : p.z > Z.roadS - 0.5 && p.z < Z.south - 1 && S.band === 'boulevard' ? at.farLamp ?? at.lamp : at.pathLamp;
        break;
      }
      case 'tree': p.species = S.band === 'park' && !(p.z < 12) ? weighted(stream('street-tree', seed, row, Math.round(p.x * 16), Math.round(p.z * 16)), LOOKS.parkTree)
        : p.z < 12 ? at.treesN : at.treesS ?? at.treesN; break;
      case 'bench': p.look = at.bench; break;
      case 'bin': p.look = p.z < Z.front ? (lane(p.x, p.z)?.ground === 'setts' ? 'urn' : 'tulip') : at.bin; break;
      case 'railing': p.look = p.z === Z.fence ? at.railN : at.railS; break;
      case 'hedge': p.look = hedgeLook(seed, row, p.x0); break;
      case 'postbox': p.look = w('postbox'); break;
      case 'car': p.look = chance(L, 0.08) ? 'taxi' : w('car'); break;
    }
  }
  const f = S.park?.feature;
  if (f) f.look = w(f.kind);
  for (const B of S.buildings) dressBuilding(B, L);
}

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

/** Which sections a street map spans around x, within its bounds (i0 … i1, either null when endless). */
export function sectionsAround(map, x, reachM) {
  let a = Math.floor((x - reachM) / SECTION_M), b = Math.floor((x + reachM) / SECTION_M);
  if (map.i0 !== null) a = Math.max(a, map.i0);
  if (map.i1 !== null) b = Math.min(b, map.i1);
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
