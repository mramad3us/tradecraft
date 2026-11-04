// TRADECRAFT sim: an indoor shooting range, as a plan (sim/interiors/plan.js; the user, 2026-11-04: "a firearms training
// lesson", at "ranges where legal": a city's range is a shop on its streets, sim/shops.js RANGES, and this is what's
// behind its door when a lesson's played there, sim/scenarios/range.js). One room deep, laid along the camera's width so
// its lanes run across the picture, the firing line on the west and the trap on the east wall:
//   - **the club room** (the lobby, LOBBY_M wide): the street door in the street side's wall; the desk, where the gun's
//     signed out and handed back, whoever runs the place behind it (the range officer's spot, 'ro'); the lockers, the
//     shelf of ammunition, chairs along the wall;
//   - **the gallery** behind the line, through the range door: the booths, LANES of them LANE_M wide, each a bench at
//     the firing line (its spot, 'bench': where one stands to shoot, facing downrange, and the bench's work is done:
//     sim/gunwork.js) between dividers BOOTH_M long, cut low as the cutaway's walls are (CUT_H's kin) so the shooter
//     shows over them; Hale's place at your shoulder ('hale', a step behind);
//   - **the lanes**, LINE_X on, concrete, the firing line red across them, a yellow line at each of DISTANCES_M from where
//     you stand, and the stands ('stand': lane, m), where the paper targets are set (sim/paper.js); the steel trap
//     against the east wall, stepped up to it.
// Lit as a range is, well and evenly (cool strip lights, their pool stronger than a flat's: core, ring). No windows.
// Every range is this one, for now; the city chooses its paint (PAINT) and the scene its paper.
import { CITIES } from '../cities/index.js';

export const LANES = 5, LANE_M = 1.8, LOBBY_M = 5.2, LINE_X = 9.0, BOOTH_M = 1.6, STAND_BACK_M = 0.8;
export const DISTANCES_M = [7, 15, 25];
export const SHOOT_X = LINE_X - STAND_BACK_M;                      // (where a shooter stands, the bench before them; distances are from here)
export const TRAP_M = 1.4, W_M = SHOOT_X + 25 + 2.2 + TRAP_M - 0.2, D_M = LANES * LANE_M;
export const laneZ = (n) => (n - 0.5) * LANE_M;                    // (lane n's middle, 1 the northmost)
// (the stands in a lane: across it a little, so the line to one doesn't run through another's paper)
export const STAND_DZ = { 7: 0, 15: -0.45, 25: 0.45 };
const PAINT = { moscow: 0x7d9a7a, london: 0xc4bba9, beirut: 0xd6ccb8, cairo: 0xd0c4a0 };
/** What a city's range is called (its sign's word: sim/cities/; the scene's, sim/scenarios/range.js; where a lesson's booked, sim/places.js). */
export const RANGE_NAMES = { moscow: 'the tir', london: 'the rifle club', beirut: 'the range', cairo: 'the shooting club' };

/** The range's plan: { city } its lobby's paint; the rest is a range's. */
export function rangePlan(seed, { city = 'moscow' } = {}) {
  const W = Math.round(W_M * 100) / 100, D = D_M, paint = PAINT[city] ?? PAINT.moscow;
  const rooms = [
    { id: 'lobby', kind: 'lobby', x0: 0, z0: 0, x1: LOBBY_M, z1: D, floor: 'lino', floorColor: 2, paint, wall: { kind: 'paint', c1: paint } },
    { id: 'gallery', kind: 'gallery', x0: LOBBY_M, z0: 0, x1: LINE_X, z1: D, floor: 'lino', floorColor: 3, paint: 0x8f96a6, wall: { kind: 'paint', c1: 0x8f96a6 } },
    { id: 'lanes', kind: 'lanes', x0: LINE_X, z0: 0, x1: W, z1: D, floor: 'concrete', floorColor: 0x8a8780, paint: 0x6a7182, wall: { kind: 'stripes', c1: 0x6a7182, c2: 0x5d6474 } },
  ];
  const openings = [
    { axis: 'x', at: D, a: 1.0, b: 2.1, kind: 'doorway' },        // (the street door)
    { axis: 'z', at: LOBBY_M, a: D - 2.0, b: D - 0.9, kind: 'door' },   // (the range door, ear defenders past it)
    { axis: 'z', at: LINE_X, a: 0, b: D, kind: 'line' },           // (the firing line: no wall, the benches across it)
  ];
  const it = (kind, x, z, face = 'down', look = {}) => ({ kind, x, z, face, look });
  const items = [
    it('shopCounter', 2.7, 2.3, 'down'),
    it('filingCabinet', 0.42, 0.31, 'down', { colour: 0x6a7182 }), it('filingCabinet', 0.92, 0.31, 'down', { colour: 0x6a7182 }), it('filingCabinet', 1.42, 0.31, 'down', { colour: 0x6a7182 }),
    it('shelving', 4.35, 0.23, 'down', { goods: 'boxes' }),
    it('waitingChairs', 3.5, D - 0.42, 'up'), it('coatRack', 0.45, D - 1.3),
    it('waterCooler', LOBBY_M - 0.35, D - 3.0),
    it('waitingChairs', LOBBY_M + 0.45, 2.4, 'right'),
  ];
  for (let k = 1; k < LANES; k++) items.push(it('boothDivider', LINE_X - BOOTH_M / 2, k * LANE_M, 'down', { n: k + 1 }));
  for (let n = 1; n <= LANES; n++) items.push(it('rangeBench', LINE_X - 0.225, laneZ(n), 'left'));
  for (let n = 1; n <= LANES; n++) items.push(it('bulletTrap', W - TRAP_M / 2, laneZ(n), 'left'));
  const spots = [
    { kind: 'desk', x: 2.7, z: 3.15, face: 'up' }, { kind: 'ro', x: 3.05, z: 1.6, face: 'down' }, { kind: 'door', x: 1.55, z: D - 0.6, face: 'down' },
    { kind: 'lobby', x: 2.2, z: 4.4, face: 'right' },
  ];
  for (let n = 1; n <= LANES; n++) {
    spots.push({ kind: 'bench', lane: n, x: SHOOT_X, z: laneZ(n), face: 'right' }, { kind: 'hale', lane: n, x: LINE_X - BOOTH_M - 0.45, z: laneZ(n) + 0.55, face: 'right' });
    for (const m of DISTANCES_M) spots.push({ kind: 'stand', lane: n, m, x: SHOOT_X + m, z: laneZ(n) + STAND_DZ[m], face: 'left' });
  }
  const lights = [
    { x: 2.6, z: D / 2, r: 3.6, core: 0.45, ring: 0.15, room: 'lobby', color: 0xf8e8c8 },
    { x: (LOBBY_M + LINE_X) / 2, z: D / 2, r: 4.6, core: 0.5, ring: 0.15, room: 'gallery', color: 0xe8eef8 },
    ...[13.5, 20.5, 27.5, 34].map(x => ({ x, z: D / 2, r: 5.4, core: 0.55, ring: 0.12, room: 'lanes', color: 0xe8eef8 })),
  ];
  const decor = [
    { kind: 'board', x: 2.75, y: 1.25, w: 1.1, h: 0.75, look: { seed: seed % 997 } },
    { kind: 'clock', x: 3.8, y: 1.95, w: 0.32, h: 0.32, look: {} },
    { kind: 'rules', x: (LOBBY_M + LINE_X) / 2, y: 1.2, w: 1.3, h: 0.9, look: { seed: 3 } },
    { kind: 'number', n: 1, x: LINE_X - 0.5, y: 1.15, w: 0.32, h: 0.44 },   // (lane one's number, on the wall at its booth: the others' are on their dividers)
  ];
  // (on the floor, whole pixels wide: the firing line, red; a yellow line across the lanes at each distance; the lanes' edges)
  const PX = 1 / 16, marks = [{ x0: LINE_X, z0: 0, x1: LINE_X + 2 * PX, z1: D, color: 0xb5493c },
    ...DISTANCES_M.map(m => ({ x0: SHOOT_X + m, z0: 0, x1: SHOOT_X + m + PX, z1: D, color: 0xc9a23a })),
    ...Array.from({ length: LANES - 1 }, (_, k) => ({ x0: LINE_X + 2 * PX, z0: (k + 1) * LANE_M, x1: W - TRAP_M, z1: (k + 1) * LANE_M + PX, color: 0xa8a59c }))];
  return {
    kind: 'range', seed, city: CITIES[city] ? city : 'moscow', x0: 0, z0: 0, x1: W, z1: D, rooms, openings, windows: [], windowsS: [], items, spots, lights, decor, marks, mood: 'cool',
    exits: [{ id: 'street', x0: 1.0, z0: D - 0.3, x1: 2.1, z1: D + 0.3, to: 'street', side: 's' }],
    look: { floor: 0x8a8780, seed },
  };
}
