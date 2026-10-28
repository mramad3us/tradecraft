// TRADECRAFT sim: the embassy's ground floor, where the working day is (the user, 2026-10-27: "I can't get
// inside the embassy?"; DESIGN.md, Next: "the embassy"). A plan (sim/interiors/plan.js) and a map of its
// own (sim/map/interior.js), as the flat is, entered from the street at its door (sim/scenarios/
// campaign.js). In from the street, the lobby: the Marine's desk, the arch of the metal detector and the
// X-ray's belt, the flags, the queue's posts; off it, west, the consular waiting room, its rows of chairs
// and the visa window. Through the arch, the corridor; off it, north: the chief of station's office,
// the station itself behind its vault door (desks, the cabinets, a map of the city on the wall; one of
// the desks yours), and the tank (the secure room: a table, chairs, nothing on the walls).
//
// Who's in it, and when, is its day's (sim/interiors/staffing.js: the Marine round the clock; the chief,
// colleagues at their desks, the consular officer at her window on working days; applicants while the
// visa room's open), from its posts (staff), seats, window and errands here. What's
// done where (spots): 'desk' (yours: the day's work), 'chief' (in front of his desk: what's on). The way
// out (exits): the street door. The city sets the paint; a seed, the rest.
import { stream, int, pick, chance } from '../rng.js';

const LOOK = {
  moscow: { lobby: 0xd9d2c0, station: 0xc8d4dc, floor: 'terrazzo' },
  london: { lobby: 0xe2dac6, station: 0xd0d8c0, floor: 'terrazzo' },
  cairo: { lobby: 0xece6da, station: 0xd6ccb8, floor: 'terrazzo' },
  beirut: { lobby: 0xe8dcc4, station: 0xc8d4dc, floor: 'terrazzo' },
};
export const W_M = 16, D_M = 11, N_M = 4.4, HALL_M = 1.8;              // (its width, its depth; the back band's depth, the corridor's)
const DESKS = [[6.0, 0.6], [9.6, 0.6], [6.0, 2.85], [9.6, 2.85]];     // (the station's desks: their chairs' places, the desk in front)

/** The embassy's plan, from its seed: { city }. */
export function embassyPlan(seed, { city = 'moscow' } = {}) {
  const r = stream('embassy', seed), L = LOOK[city] ?? LOOK.moscow, W = W_M, D = D_M, N = N_M, H = N + HALL_M;
  const rooms = [room('chief', 0, 0, 4.4, N, 'office'), room('station', 4.4, 0, 12, N, 'office'), room('tank', 12, 0, W, N, 'office'),
    room('hall', 0, N, W, H, 'hall'), room('consular', 0, H, 6.5, D, 'lobby'), room('lobby', 6.5, H, W, D, 'lobby')];
  const openings = [
    { axis: 'x', at: D, a: 10.9, b: 12.5, kind: 'doorway' },           // (the street door)
    { axis: 'x', at: H, a: 8.65, b: 9.55, kind: 'doorway' },           // (through the arch)
    { axis: 'z', at: 6.5, a: H + 1.4, b: H + 2.8, kind: 'doorway' },   // (the lobby to the waiting room)
    { axis: 'x', at: N, a: 2.6, b: 3.5, kind: 'door' }, { axis: 'x', at: N, a: 7.6, b: 8.6, kind: 'door' }, { axis: 'x', at: N, a: 13.1, b: 14.0, kind: 'door' },
  ];
  const items = [
    // The lobby: the Marine's desk by the door, the arch and the belt, the flags, the posts of the queue.
    it('securityDesk', 14.6, D - 2.0, 'left'), it('metalDetector', 9.1, H + 0.45), it('xray', 11.25, H + 0.55, 'down'),
    it('flag', 7.0, H + 0.4, 'down', { country: 'us' }), it('flag', W - 0.45, H + 0.4, 'down', { country: city }),
    it('stanchions', 9.1, H + 2.3, 'down'), it('stanchions', 9.1, H + 3.4, 'down'), it('plant', 7.0, D - 0.45),
    // The waiting room: its rows, the visa window.
    it('bankCounter', 3.0, H + 1.15, 'down', { sign: 'VISAS' }), it('waitingChairs', 1.6, H + 2.6, 'down'), it('waitingChairs', 4.4, H + 2.6, 'down'),
    it('waitingChairs', 1.6, H + 3.9, 'down'), it('waitingChairs', 4.4, H + 3.9, 'down'), it('waterCooler', 0.45, D - 0.45),
    // The corridor: the open vault door beside the station's, a plant.
    it('vaultDoor', 6.55, N + 0.25, 'down'), it('plant', W - 0.45, N + 0.4), it('waterCooler', 10.4, N + 0.3),
    // The chief's office.
    it('officeDesk', 2.2, 1.55, 'down'), it('officeChair', 2.2, 0.85, 'down'), it('chair', 1.6, 2.6, 'up'), it('chair', 2.8, 2.6, 'up'),
    it('bookshelf', 0.75, 0.2, 'down', { wood: 'dark' }), it('filingCabinet', 3.9, 0.35), it('flag', 0.45, N - 0.45, 'down', { country: 'us' }),   // (in the corner, clear of the way round his desk)
    // The station: two rows of desks, an aisle between, the cabinets along the back.
    ...DESKS.flatMap(([x, zc]) => [it('officeDesk', x, zc + 0.65, 'down'), it('officeChair', x, zc, 'down')]),
    it('filingCabinet', 11.3, 0.35), it('filingCabinet', 11.75, 0.35), it('filingCabinet', 4.9, 0.35),
    // The tank: a table, chairs round it, nothing else.
    it('diningTable', 14.0, 2.1, 'right', { wood: 'dark' }),
  ];
  // (your desk: one of the station's, the same every time; the others' are taken. Its spot beside its chair: sat in when the work begins)
  const mine = int(r, DESKS.length), [mx, mz] = DESKS[mine];
  const spots = [{ kind: 'desk', x: mx + 0.85, z: mz, face: 'left', seat: { x: mx, z: mz, face: 'down' } }, { kind: 'chief', x: 2.2, z: 3.2, face: 'up' }];
  // The posts (who's at them, when, is the day's: sim/interiors/staffing.js): where each stands or sits, and
  // the spot they walk to it from (a chair's side: a chair's in the way of the feet).
  const staff = [
    { id: 'marine', who: 'marine', x: 15.25, z: D - 2.0, face: 'left', look: MARINE(r) }, { id: 'consular', who: 'consular', x: 3.0, z: H + 0.45, face: 'down' },
    { id: 'chief', who: 'chief', x: 2.2, z: 0.85, face: 'down', gait: 'sit', approach: { x: 2.95, z: 0.85 } },
    ...DESKS.map(([x, z], k) => ({ k, x, z })).filter(d => d.k !== mine).map(({ k, x, z }) => ({ id: `desk${k}`, who: 'colleague', x, z, face: 'down', gait: 'sit', approach: { x: x + 0.85, z } })),
  ];
  // (the waiting room's seats, each with the step in front of it; the visa window's spot; the errands about the place)
  // (sat facing the street; come at from behind, the back row's front being the wall)
  const seats = [[1.6, H + 2.6], [4.4, H + 2.6], [1.6, H + 3.9], [4.4, H + 3.9]].flatMap(([cx, cz]) => [-0.75, -0.25, 0.25, 0.75].map(dx => ({ x: cx + dx, z: cz + 0.05, face: 'down', approach: { x: cx + dx, z: cz - 0.65 } })));
  const window_ = { x: 3.0, z: H + 2.0 };
  const errands = [{ x: 10.4, z: N + 0.95, face: 'up' }, { x: 11.5, z: 1.05, face: 'up' }, { x: 13.55, z: N + 0.6, face: 'up' }, { x: 3.05, z: N + 0.6, face: 'up' }, { x: 7.0, z: N + 1.0, face: 'left' }];
  for (const q of rooms) {
    q.paint = q.kind === 'office' ? (q.id === 'chief' ? 0xd6ccb8 : L.station) : L.lobby;
    q.wall = { kind: 'paint', c1: q.paint };
    q.floor = q.kind === 'office' ? (q.id === 'chief' ? 'carpet' : 'lino') : L.floor;
    q.floorColor = q.floor === 'carpet' ? 0x283f6b : q.floor === 'lino' ? 0x8f96a6 : 0xb48459;
  }
  const lights = rooms.map(q => ({ x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2, r: Math.max(q.x1 - q.x0, q.z1 - q.z0) * 0.6, room: q.id, color: q.id === 'chief' ? 0xf8e0b0 : 0xe0e8f0 }));
  // On the back wall: the city's map over the station's desks, a clock, the President over the chief's.
  const decor = [{ kind: 'picture', x: 7.6, y: 1.35, w: 1.6, h: 1.0, look: { seed: int(r, 1e6), frame: 0x23252f } }, { kind: 'clock', x: 10.2, y: 1.9, w: 0.4, h: 0.4, look: { seed: int(r, 1e6), frame: 0x23252f } },
    { kind: 'picture', x: 2.2, y: 1.5, w: 0.6, h: 0.75, look: { seed: int(r, 1e6), frame: 0xb9862e } }];
  return { kind: 'embassy', seed, x0: 0, z0: 0, x1: W, z1: D, rooms, openings, windows: [], windowsS: [{ a: 1.0, b: 3.4 }, { a: 13.2, b: 15.4 }], items, spots, staff, seats, window: window_, errands, lights, decor,
    exits: [{ id: 'street', x0: 10.9, z0: D - 0.3, x1: 12.5, z1: D + 0.3, to: 'street', side: 's' }], look: { seed: int(r, 1e6), floor: 0xb48459 }, mood: 'cool' };
}

// (the Marine on the desk: dress blues, the white cover)
const MARINE = (r) => ({ skin: pick(r, ['light', 'light', 'tan', 'brown', 'dark']), hair: { style: 'crew', color: pick(r, [0x23252f, 0x47302a, 0x8f6345]) },
  top: { kind: 'uniform', color: 0x1f2a44, trim: 0x9e3c36 }, legs: 0x3b6296, shoes: 0x14151c, hat: { kind: 'peaked', color: 0xf6f4ee, band: 0x14151c } });
const room = (id, x0, z0, x1, z1, kind = id) => ({ id, kind, x0, z0, x1, z1 });
const it = (kind, x, z, face = 'down', look = {}) => ({ kind, x, z, face, look });
