// TRADECRAFT sim: a city's street, generated in sections. Pure data: the sim walks it, the renderer
// (src/render/town.js) draws it. Moscow's, or another city's: what's the city's own (its names, its
// buildings and their dress, the makes of things, what else stands on its streets, the shapes of its
// terraces, its people) is its profile (sim/cities/), read from the *town* each function takes (the
// seed in Moscow, `city:seed` elsewhere: sim/cities/index.js townOf()). What follows is how every
// city's street is laid; the Moscow of it is sim/cities/moscow.js.
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
// The terrace is the city's (in Moscow: pre-revolutionary plaster in ochres, pinks and greens with
// white trim, red brick, or a Stalinist block with a heavy base; shops on the ground floor, signs in
// Cyrillic, arches through to the courtyards). A building's facade is a list of paint operations
// (ops) for the art's facade painter (src/art/pixeltown.js): data here, so the sim knows the doors and
// shops it paints. Each wears a dress of its style, and so does everything else on the street: see
// the looks, below. In a city with a terrace plan (terraceOf()), the terrace takes shapes of its own:
// courts (dead ends), squares and crescents set back from the street, lanes that dogleg behind the
// houses (gapsOf(): a lane's mouth on the street, and its top at the north edge; laneRects(),
// laneLine(), inLane() say where it runs), and lanes of other kinds (mews, stairs, souk passages,
// harets: GAP_M).
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
import { SECTION_M, Z, LANES, GAP_M, STRETCH, ROW_M } from './layout.js';
import { cityOf } from '../cities/index.js';
import { marksAt } from './marks.js';
import { embassyBuilding } from '../cities/embassy.js';
import { stationBuilding } from '../cities/station.js';
import { stationAt, busLinesAt } from '../transit.js';

export { SECTION_M, Z, LANES, GAP_M, STRETCH, ROW_M };
export const PARK_SHARE = 0.35;                                    // (Moscow's; a city's own is its profile's parkShare)

// Names, the city's (its profile: sim/cities/). A row is a street (and its boulevard, its parks), each
// side street a lane. `seed` here and below is the town: the map's seed in Moscow, `city:seed`
// elsewhere (sim/cities/index.js townOf()).
export const streetName = (seed, row) => cityOf(seed).streetName(seed, row);
export const boulevardName = (seed, row) => cityOf(seed).boulevardName(seed, row);
export const parkName = (seed, row, i) => cityOf(seed).parkName(seed, row, i);

/**
 * A row's ways north through its terrace in section i: [{ x0, x1, kind 'side' | 'alley' | …, name,
 * jog? }]. x0 … x1 is where the lane reaches the map's north edge (and the next street's south: the
 * same lane from its other end). A narrow lane may dogleg (a city's terrace.jog, from a stream of its
 * own): `jog` { x0, x1, z } is then its mouth on the street, from the front back to z, where it turns
 * along the back of the building beside it and on north at x0 … x1 (laneRects()).
 */
export function gapsOf(seed, row, i) {
  const P = cityOf(seed), gaps = P.gaps(seed, row, i).sort((a, b) => a.x0 - b.x0);
  if (P.terrace?.jog) dogleg(stream('street-jog', seed, row, i), gaps, i * SECTION_M, P.terrace.jog);
  return gaps;
}
const JOGS = new Set(['alley', 'haret', 'mews']);
function dogleg(r, gaps, x0, p) {
  const x1 = x0 + SECTION_M;
  for (const g of gaps) {
    if (!JOGS.has(g.kind) || !chance(r, p)) continue;
    const w = g.x1 - g.x0, dir = chance(r, 0.5) ? 1 : -1, shift = w + 1.5 + int(r, 4);
    const m0 = g.x0 - dir * shift, z = -14 - int(r, 12);
    // (the building beside it, over the turn, ends 1.5 m past the lane's top; it and every other lane a building's width apart)
    const span = dir > 0 ? [m0, g.x1 + 1.5] : [g.x0 - 1.5, m0 + w];
    if (m0 < x0 + 6 || m0 + w > x1 - 6 || span[0] < x0 + 0.5 || span[1] > x1 - 0.5) continue;   // (no sliver of a house between it and the section's end)
    if (gaps.some(o => o !== g && ((o.jog ?? o).x0 < span[1] + 7 && (o.jog ?? o).x1 > span[0] - 7 || o.x0 < span[1] + 7 && o.x1 > span[0] - 7))) continue;
    g.jog = { x0: m0, x1: m0 + w, z };
  }
}

/** A lane's mouth on the street ({ x0, x1 }): where it leaves the front, a dogleg's or its own. */
export const mouthOf = (g) => g.jog ?? g;
/** A lane's floor through the terrace (north of the front): rectangles [{ x0, x1, z0, z1 }], one, or a dogleg's three. */
export function laneRects(g) {
  if (!g.jog) return [{ x0: g.x0, x1: g.x1, z0: Z.north, z1: Z.front }];
  const j = g.jog, w = g.x1 - g.x0;
  return [{ x0: j.x0, x1: j.x1, z0: j.z, z1: Z.front }, { x0: Math.min(j.x0, g.x0), x1: Math.max(j.x1, g.x1), z0: j.z - w, z1: j.z }, { x0: g.x0, x1: g.x1, z0: Z.north, z1: j.z - w }];
}
/** Whether (x, z), north of the front, is in lane g (m: a margin round it). */
export const inLane = (g, x, z, m = 0) => laneRects(g).some(q => x >= q.x0 - m && x <= q.x1 + m && z >= q.z0 - m && z <= q.z1 + m);
/** A lane's middle from its mouth at the front to the map's north edge: [{ x, z }], two points, or a dogleg's four. */
export function laneLine(g) {
  const tx = (g.x0 + g.x1) / 2;
  if (!g.jog) return [{ x: tx, z: Z.front }, { x: tx, z: Z.north }];
  const mx = (g.jog.x0 + g.jog.x1) / 2, lz = g.jog.z - (g.x1 - g.x0) / 2;
  return [{ x: mx, z: Z.front }, { x: mx, z: lz }, { x: tx, z: lz }, { x: tx, z: Z.north }];
}
/** The lane's length from its mouth to the north edge (a dogleg's longer by its turn). */
export const laneLength = (g) => laneLine(g).reduce((a, p, k, l) => a + (k ? Math.hypot(p.x - l[k - 1].x, p.z - l[k - 1].z) : 0), 0);

/** A row's south band at section i: a boulevard, or a park, a stretch of STRETCH sections at a time. */
export function bandOf(seed, row, i) {
  return chance(stream('street-band', seed, row, Math.floor(i / STRETCH)), cityOf(seed).parkShare) ? 'park' : 'boulevard';
}

/** What a spot is called, for the player: the street, a lane, the boulevard, a park. */
export function placeName(seed, row, x, z) {
  const i = Math.floor(x / SECTION_M);
  if (z < Z.front) {
    const T = terraceOf(seed, row, i), inside = (c) => x >= c.x0 && x <= c.x1 && z >= c.z - 0.5;
    return gapsOf(seed, row, i).find(g => inLane(g, x, z))?.name ?? T?.courts.find(inside)?.name ?? T?.squares.find(inside)?.name ?? streetName(seed, row);
  }
  if (z <= Z.fence) return streetName(seed, row);
  if (z >= Z.south) return gapsOf(seed, row + 1, i).find(g => x >= g.x0 && x <= g.x1)?.name ?? streetName(seed, row);
  return bandOf(seed, row, i) === 'park' ? parkName(seed, row, i) : boulevardName(seed, row);
}

/** Section i of row `row` (0 by default) of the street map with this seed. */
export function section(seed, i, row = 0) {
  const P = cityOf(seed), r = stream('street', seed, row, i);
  const x0 = i * SECTION_M, x1 = x0 + SECTION_M;
  const S = {
    i, row, x0, x1, seed: stream('street-art', seed, row, i)[0], band: bandOf(seed, row, i), west: bandOf(seed, row, i - 1), east: bandOf(seed, row, i + 1),
    buildings: [], doors: [], props: [], lamps: [], blockers: [], crossings: [], crossingsS: [], exits: [], park: null,
    gapsN: gapsOf(seed, row, i), gapsS: gapsOf(seed, row + 1, i),
  };
  if (P.id !== 'moscow') { S.city = P.id; S.town = seed; }         // (the renderer's to know; Moscow's sections are as they were)
  const block = (ax, az, bx, bz, what) => S.blockers.push({ x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), what });
  const lamp = (x, z, lightZ = z) => { S.props.push({ kind: 'lamp', x, z }); S.lamps.push({ ...LAMP, x, z: lightZ }); block(x - 0.16, z - 0.16, x + 0.16, z + 0.16, 'lamp'); };
  for (const g of S.gapsN) S.exits.push({ dir: 'n', ...g });
  for (const g of S.gapsS) S.exits.push({ dir: 's', ...g });
  const inGap = (gaps, x, m = 0) => gaps.some(g => x > g.x0 - m && x < g.x1 + m);
  const mouths = S.gapsN.map(mouthOf);                             // (where the lanes leave the front: a dogleg's mouth isn't its top)

  // The terrace: buildings of 9–18 m filling the section between its gaps north. In another city
  // than Moscow (its profile's terrace), from a stream of its own: a court, a dead end, cut into it
  // now and then (a 3 m gap at the front, a house at its end); a run of it set back round a square,
  // or bowed back into a crescent; and a dogleg's building cut short over the turn.
  const T = terraceOf(seed, row, i);
  if (T) { S.courts = T.courts; S.squares = T.squares; }
  const runs = [];
  if (T) runs.push(...T.runs.map(q => [q.a, q.b, q]));
  else {
    let a = x0;
    for (const m of mouths) { runs.push([a, m.x0]); a = m.x1; }
    runs.push([a, x1]);
  }
  for (const [a, b, q] of runs) {
    if (T?.jogs.some(j => Math.abs(a - j.span[0]) < 0.01 && Math.abs(b - j.span[1]) < 0.01)) continue;   // (a dogleg's lot: turnBlocks())
    let x = a;
    while (b - x > 0.01) {
      let w = 9 + int(r, 10);
      if (b - x - w < 8) w = b - x;                                  // no sliver at the end of a run
      const z = q ? Z.front - setbackAt(q, x + w / 2) : Z.front;      // (a square's or a crescent's front stands back)
      S.buildings.push(P.building(r, x, x + w, z, S));
      block(x, Z.back, x + w, z, 'building');
      x += w;
    }
  }
  if (T) turnBlocks(S, T, block, P.lot ?? 'garden');
  // A posting's places (sim/places.js, sim/map/marks.js): the embassy in place of the building that
  // stood there, its one door; the entrances that are someone's.
  for (const m of marksAt(seed, row, i)) {
    if (m.kind === 'embassy' && S.buildings[m.b]) {
      const B = S.buildings[m.b];
      S.doors = S.doors.filter(d => !(d.x > B.x0 && d.x < B.x1 && Math.abs(d.z - B.z) < 1));
      S.buildings[m.b] = embassyBuilding(B);
      S.doors.push({ x: (B.x0 + B.x1) / 2, z: B.z, w: 1.6, kind: 'embassy', place: 'embassy' });
    } else if (m.kind === 'door') { const d = S.doors.find(o => o.kind === 'entrance' && Math.abs(o.x - m.x) < 0.01); if (d) d.place = m.place; }
  }
  // A metro station, where the city's network has one in this section (sim/transit.js): the widest
  // building on the front (never the embassy, a mosque, a church) is the station, its one wide door the way down.
  const lines = stationAt(seed, row, i);
  if (lines) {
    // (the widest on the front, 9 m or more; else the widest there is, set back round a square or narrow)
    const score = (B) => (B.style === 'embassy' || B.minaret || B.dome ? -1 : (B.x1 - B.x0) + (B.z === Z.front && B.x1 - B.x0 >= 9 ? 100 : 0));
    const k = S.buildings.reduce((best, B, j) => (score(B) > 0 && (best < 0 || score(B) > score(S.buildings[best])) ? j : best), -1);
    if (k >= 0) {
      const B = S.buildings[k];
      S.doors = S.doors.filter(d => !(d.x > B.x0 && d.x < B.x1 && Math.abs(d.z - B.z) < 1));
      S.buildings[k] = stationBuilding(B, P.id, lines);
      S.doors.push({ x: (B.x0 + B.x1) / 2, z: B.z, w: 3, kind: 'metro', lines });
    }
  }
  // The ways north: a side street has its lamps and a bin; an alley is dark, with a bin.
  for (const g of S.gapsN) {
    if (g.kind === 'side') {
      lamp(g.x0 + 0.6, -12); lamp(g.x1 - 0.6, -29);
      S.props.push({ kind: 'bin', x: g.x1 - 0.7, z: -18 }); block(g.x1 - 0.95, -18.25, g.x1 - 0.45, -17.75, 'bin');
    } else if (g.kind === 'alley' && !g.jog) { S.props.push({ kind: 'bin', x: g.x0 + 0.4, z: -23 }); block(g.x0 + 0.15, -23.25, g.x0 + 0.65, -22.75, 'bin'); }   // (a city's own kinds of lane are furnished by its profile)
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
    if (P.postbox === 'wall' && !S.doors.some(d => Math.abs(d.x - x) < 2) && !inGap(mouths, x, 1)) {
      S.props.push({ kind: 'postbox', x, z: -4.65 }); block(x - 0.25, -4.9, x + 0.25, -4.4, 'postbox');
    }
    // (a pillar box stands at the kerb, in the street furniture's line: clear of the lamps and the zebra)
    if (P.postbox === 'kerb' && !near(x, zx, 1.5) && !inGap(mouths, x, 1) && !S.props.some(p => p.kind === 'lamp' && p.z < 0 && Math.abs(p.x - x) < 1.2)) {
      S.props.push({ kind: 'postbox', x, z: -0.85 }); block(x - 0.25, -1.1, x + 0.25, -0.6, 'postbox');
    }
  }
  // Parked cars along the far kerb, nose east, clear of the zebra and the side streets.
  for (let x = x0 + 3 + range(r, 0, 4); x < x1 - 3; x += 5 + range(r, 0, 9)) {
    if (near(x, zx, 4) || inGap(mouths, x, 3) || !chance(r, 0.55)) continue;
    S.props.push({ kind: 'car', x, z: 0.55, color: pick(r, P.carColours), seed: int(r, 1000) });
    block(x - 2.1, -0.35, x + 2.1, 1.45, 'car');
  }

  if (S.band === 'boulevard') boulevard(r, S, zx, sx, block, lamp, near, aside, P);
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
  // What else stands on this city's streets (none in Moscow): from a stream of its own.
  P.furnish?.(S, { seed, row, r: stream('street-city', seed, row, i), block, lamp, inGap, inMouth: (x, m = 0) => inGap(mouths, x, m) || inGap(S.courts ?? [], x, m) || inGap(S.squares ?? [], x, m), near, zx, sx });
  dress(S, seed, row, zx, sx, P);
  amenities(S, stream('amenities', seed, row, i), busLinesAt(seed, row, i), P, zx, block, near, (x, m = 0) => inGap(mouths, x, m) || inGap(S.courts ?? [], x, m) || inGap(S.squares ?? [], x, m));
  return S;
}

// A bus shelter at the far kerb where the city's bus lines stop (sim/transit.js: the section has a stop;
// its place in it where its bay is clear of parked cars, and a bus pulled in there keeps off the zebra), its lines on its sign: its back to the shops, clear of the walkers' lane, its sides, a bench along its back
// (sat at, sim/buses.js). A notice board at the park path's edge, in some parks and boulevards (NOTICES_SHARE): read
// standing on the path (sim/acts.js). From a stream of their own, so nothing else on the street moves.
export const NOTICES_SHARE = 0.5, STOP_W = 3.2;
/** The street's bus line: a number, the same at every stop on it (sim/buses.js). */
export const lineNumber = (seed, row) => 3 + hash(seed, row, 'line') % 89;
function amenities(S, r, lines, P, zx, block, near, inMouth) {
  // (a bus pulled in, its front doors at the shelter: its body from DOOR_M ahead of it to its length behind, the way the
  // buses go along this kerb, the city's side of the road: sim/traffic.js)
  const way = P.drive === 'left' ? 1 : -1, len = P.bus?.len ?? 11, body = (x) => way > 0 ? [x - (len - 1.4) - 1, x + 1.4 + 1] : [x - 1.4 - 1, x + (len - 1.4) + 1];
  const clear = (ax, az, bx, bz) => !S.blockers.some(b => b.x1 > ax && b.x0 < bx && b.z1 > az && b.z0 < bz);
  // (room at its ends to walk round into it; and the bus's bay, which nobody may park in: a car that's there isn't)
  if (lines.length) for (let k = 0; k < 24; k++) {
    const x = S.x0 + 3 + range(r, 0, SECTION_M - 6), h = STOP_W / 2;
    const [b0, b1] = body(x);
    if (near(x, zx, h + 1) || (b1 > zx && b0 < zx + 3) || inMouth(x, h + 0.6) || !clear(x - h - 0.8, -1.5, x + h + 0.8, -0.4)) continue;
    const bay = (o) => o.z1 < 5 && Math.max(b0, o.x0) < Math.min(b1, o.x1);
    for (let j = S.blockers.length - 1; j >= 0; j--) if (S.blockers[j].what === 'car' && bay(S.blockers[j])) S.blockers.splice(j, 1);
    S.props = S.props.filter(p => !(p.kind === 'car' && p.z < 5 && p.x + 2.1 > b0 && p.x - 2.1 < b1));
    S.props.push({ kind: 'stop', x, z: -0.825, w: STOP_W, line: lines.join(' '), lines });       // (0.65 m deep, the kerb's strip: its back a walker's width off the passers-by's lane, its roof out over the kerb)
    block(x - h, -1.15, x + h, -1.08, 'stop'); block(x - h, -1.15, x - h + 0.08, -0.85, 'stop'); block(x + h - 0.08, -1.15, x + h, -0.85, 'stop');   // (its roof held from the back: the front open)
    break;
  }
  if ((S.band === 'park' || S.band === 'boulevard') && chance(r, NOTICES_SHARE)) for (let k = 0; k < 8; k++) {
    const x = S.x0 + 2 + range(r, 0, SECTION_M - 4);
    if (near(x, zx, 3) || !clear(x - 1.2, 12.0, x + 1.2, 12.8)) continue;
    S.props.push({ kind: 'notices', x, z: 12.4, seed: int(r, 1000) });
    block(x - 0.85, 12.32, x + 0.85, 12.48, 'notices');
    break;
  }
}

/**
 * A section's terrace plan, in a city that has one (its profile's `terrace`: the chance of each shape),
 * from the town, the row and the section alone (a stream of its own; kept), so a place can be named
 * without building the section: { cuts (the front's gaps: the lanes' mouths, the courts', and a
 * dogleg's building's two ends), runs [{ a, b, shape }], courts, squares, jogs }.
 *   - a court (`court`): a dead end 3 m wide, 9 to 22 m deep, a house across its end (its door the
 *     court's: not on the front, so not a passer-by's), cut where it leaves a building's width either
 *     side ({ x0, x1, z, name }: z the end house's front);
 *   - a square (`square`): a run of 14 to 36 m, with no court in it, set back 11 to 16 m, its ground
 *     paved, something in the middle of it (the city's furnish()) ({ x0, x1, z, name });
 *   - a crescent (`crescent`): a run of 20 m and more bowed back, each house a little further back
 *     toward the middle, up to 2.5 to 4.5 m;
 *   - a dogleg (gapsOf()): beside the lane, before its turn, no building but a walled lot, low (a
 *     garden, a car park, a vacant lot: its city's `lot`), so the turn behind it shows in the picture
 *     (the camera looks north: a lane running east–west behind a house would be out of sight); behind
 *     the turn, the terrace goes on in two blocks either side of the lane's top (a `back` building
 *     each: walls the turn looks at, no shops, no doors on the street).
 */
const plans = new Map();
export function terraceOf(seed, row, i) {
  const P = cityOf(seed), p = P.terrace;
  if (!p) return null;
  const key = `${seed}|${row}|${i}`;
  if (plans.has(key)) return plans.get(key);
  const r = stream('street-terrace', seed, row, i), x0 = i * SECTION_M, x1 = x0 + SECTION_M, gaps = gapsOf(seed, row, i);
  const cuts = gaps.map(g => ({ x0: mouthOf(g).x0, x1: mouthOf(g).x1 })), courts = [], squares = [];
  const jogs = gaps.filter(g => g.jog).map(g => ({ g, span: g.jog.x0 < g.x0 ? [g.jog.x1, g.x1 + 1.5] : [g.x0 - 1.5, g.jog.x0] }));
  const free = (a, b) => [...cuts, ...jogs.map(j => ({ x0: j.span[0], x1: j.span[1] }))].every(c => b < c.x0 - 9 || a > c.x1 + 9) && a > x0 + 9 && b < x1 - 9;
  if (p.court && chance(r, p.court)) for (let k = 0; k < 5; k++) {
    const cx = x0 + 9 + range(r, 0, SECTION_M - 21);
    if (!free(cx, cx + 3)) continue;
    const c = { x0: cx, x1: cx + 3, z: Z.front - 9 - int(r, 13), name: P.courtName?.(seed, row, i) ?? `a court off ${P.streetName(seed, row)}` };
    cuts.push(c); courts.push(c);
    break;
  }
  for (const j of jogs) cuts.push({ x0: j.span[0], x1: j.span[0] }, { x0: j.span[1], x1: j.span[1] });   // (zero-width cuts: the building over the turn is laid alone)
  cuts.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
  const runs = [];
  let a = x0;
  for (const c of cuts) { if (c.x0 > a + 0.01) runs.push({ a, b: c.x0 }); a = Math.max(a, c.x1); }
  runs.push({ a, b: x1 });
  for (const q of runs) {
    const len = q.b - q.a;
    q.shape = null;
    if (len < 14 || jogs.some(j => j.span[0] < q.b && j.span[1] > q.a)) continue;
    if (p.square && len <= 36 && chance(r, p.square)) {
      q.shape = { kind: 'square', d: 11 + int(r, 6) };
      squares.push({ x0: q.a, x1: q.b, z: Z.front - q.shape.d, name: P.squareName?.(seed, row, i) ?? `a square off ${P.streetName(seed, row)}` });
    } else if (p.crescent && len >= 20 && chance(r, p.crescent)) q.shape = { kind: 'crescent', d: 2.5 + range(r, 0, 2) };
  }
  const plan = { cuts, runs, courts, squares, jogs };
  plans.set(key, plan);
  if (plans.size > 2000) plans.delete(plans.keys().next().value);
  return plan;
}
/** How far back the front stands at x on a run of a terrace plan (0: on the building line). */
export function setbackAt(q, x) {
  if (!q.shape) return 0;
  if (q.shape.kind === 'square') return q.shape.d;
  return Math.round(q.shape.d * Math.sin(Math.PI * Math.max(0, Math.min(1, (x - q.a) / (q.b - q.a)))) * 2) / 2;
}
/** By a dogleg's turn: the lot before it (walled, low, out of bounds), and behind, two blocks either side of the lane's top. */
function turnBlocks(S, T, block, lotKind) {
  for (const j of T.jogs) {
    const g = j.g, w = g.x1 - g.x0, east = g.jog.x0 < g.x0, [x0, x1] = j.span;
    const lot = { x0, x1, z: g.jog.z, kind: lotKind, seed: Math.round(x0 * 7) };
    S.lots = [...(S.lots ?? []), lot];
    block(x0, g.jog.z, x1, Z.front, 'lot');
    const like = S.buildings.filter(b => !b.back).sort((p, q) => Math.min(Math.abs(p.x1 - x0), Math.abs(p.x0 - x1)) - Math.min(Math.abs(q.x1 - x0), Math.abs(q.x0 - x1)))[0];
    const backs = east ? [[g.jog.x0, g.x0, g.jog.z - w], [g.x1, x1, g.jog.z]] : [[x0, g.x0, g.jog.z], [g.x1, g.jog.x1, g.jog.z - w]];
    for (const [a, b, z] of backs) if (b - a > 0.05 && like) { block(a, Z.back, b, z, 'building'); S.buildings.push(backWall(a, b, z, like)); }
  }
  for (const c of T.courts) {                                      // the house at a court's end
    S.buildings.push(backWall(c.x0, c.x1, c.z, S.buildings.find(b => Math.abs(b.x1 - c.x0) < 0.01) ?? S.buildings[0], true));
    block(c.x0, Z.back, c.x1, c.z, 'building');
    S.doors.push({ x: (c.x0 + c.x1) / 2, z: c.z, w: 1.2, kind: 'entrance', court: true });
  }
}
/** A wall at the back of a dogleg's turn, or a house across a court's end: plain, a few windows, its neighbour's colours and height. */
function backWall(x0, x1, z, like, door = false) {
  const w = x1 - x0, ops = [['rect', 0, 0, w, 0.45, 0x5c5650]];
  if (door) ops.push(['door', w / 2 - 0.6, 1.2, 2.4, { color: 0x47302a, frame: 0xe2dac6 }]);
  for (let y = 4.6; y < like.h - 2; y += 3.4) for (let x = 0.4; x < w - 1.2; x += 2.6) ops.push(['window', x + (w < 3.5 ? (w - 1.2) / 2 - 0.4 : 0), y, 1.0, 1.5, { frame: 0xdfe2e8, lintel: null, head: 'none' }]);
  return { x0, x1, z, h: like.h, d: z - Z.back, wall: like.wall, wallColor: like.wallColor, roof: 'flat', ops, style: 'back', seed: Math.round(x0 * 100), back: true };
}

// The boulevard: a railing, lawns with trees, the gravel path with benches and lamps, a railing; the
// far road with its zebra (sx), lamps and parked cars along the far pavement; the road shut off with a
// railing where a park begins.
function boulevard(r, S, zx, sx, block, lamp, near, aside, P) {
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
    S.props.push({ kind: 'car', x, z: 25.0, color: pick(r, P.carColours), seed: int(r, 1000), flip: true });
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

/** The scheme a street is laid and furnished with, stretch k of a row (see the looks, above). Made once (a few kept). */
const schemes = new Map();
export function scheme(seed, row, k) {
  const key = `${seed}|${row}|${k}`;
  if (schemes.has(key)) return schemes.get(key);
  const LOOKS = cityOf(seed).LOOKS, L = stream('street-scheme', seed, row, k), w = (key) => weighted(L, LOOKS[key]);
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
  const LOOKS = cityOf(seed).LOOKS, L = stream('street-lane', seed, row, Math.round(g.x0));
  if (g.kind === 'alley') return { ground: weighted(L, LOOKS.alley), lamp: null };
  if (g.kind !== 'side') return { ground: weighted(L, LOOKS[g.kind] ?? LOOKS.alley), lamp: weighted(L, LOOKS.sideLamp) };   // (a city's own kind of lane: a mews, stairs, a souk)
  return { ground: weighted(L, LOOKS.lane), walks: weighted(L, LOOKS.pave), lamp: weighted(L, LOOKS.sideLamp) };
}

/** The hedge's plants on the run that x is on: one kind from one gap south to the next. */
function hedgeLook(seed, row, x) {
  let from = -Infinity;
  for (let i = Math.floor(x / SECTION_M); i > Math.floor(x / SECTION_M) - 4 && from === -Infinity; i--) {
    for (const g of gapsOf(seed, row + 1, i)) if (g.x1 <= x + 0.01) from = Math.max(from, g.x1);
  }
  return weighted(stream('street-hedge', seed, row, Math.round(from === -Infinity ? 0 : from)), cityOf(seed).LOOKS.hedge);
}

// Dress a section: its looks (above), on new keys and paint ops only.
function dress(S, seed, row, zx, sx, P) {
  const LOOKS = P.LOOKS, L = stream('street-look', seed, row, S.i), k = Math.floor(S.i / STRETCH), w = (key) => weighted(L, LOOKS[key]);
  const b = scheme(seed, row, k), a = S.i % STRETCH === 0 ? scheme(seed, row, k - 1) : b;
  S.look = { a, b, breakN: zx + 1.5, breakS: sx + 1.5, rowSeed: hash(seed, row, 'paint') % 100000,
    zebra: chance(L, 0.7) ? b.zebra : w('zebra'), zebraS: chance(L, 0.7) ? b.zebra : w('zebra'),
    lanesN: S.gapsN.map(g => laneLook(seed, row, g)), lanesS: S.gapsS.map(g => laneLook(seed, row + 1, g)) };
  const lane = (x, z) => { const k2 = S.gapsN.findIndex(g => inLane(g, x, z, 0.01)); return z < Z.front && k2 >= 0 ? S.look.lanesN[k2] : null; };
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
      case 'tree': if (p.z < Z.front) break;                      // (a square's trees come with their species)
        p.species = S.band === 'park' && !(p.z < 12) ? weighted(stream('street-tree', seed, row, Math.round(p.x * 16), Math.round(p.z * 16)), LOOKS.parkTree)
        : p.z < 12 ? at.treesN : at.treesS ?? at.treesN; break;
      case 'bench': p.look = at.bench; break;
      case 'bin': p.look = p.z < Z.front ? (lane(p.x, p.z)?.ground === 'setts' ? 'urn' : 'tulip') : at.bin; break;
      case 'railing': p.look = p.z === Z.fence ? at.railN : at.railS; break;
      case 'hedge': p.look = hedgeLook(seed, row, p.x0); break;
      case 'postbox': p.look = w('postbox'); break;
      case 'car': p.look = chance(L, 0.08) ? P.taxi : w('car'); break;
    }
  }
  const f = S.park?.feature;
  if (f) f.look = w(f.kind);
  if (S.square && LOOKS[S.square.kind]) S.square.look = w(S.square.kind);
  for (const B of S.buildings) if (B.style !== 'embassy' && B.style !== 'station') P.dress(B, L, S);   // (the embassy and a station wear their own: sim/cities/)
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
