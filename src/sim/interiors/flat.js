// TRADECRAFT sim: a flat, as a plan (sim/interiors/plan.js): yours on a posting (the user, 2026-10-27:
// "when we start the campaign, it should be in the appartment of the starter character"), and, in time,
// anyone's up any stairwell; never two alike ("make sure appartments are generated to a point, meaning
// that colors, decorations, ambiance, layouts needs variability").
//
// A layout (LAYOUTS), by the flat's seed; then the city's way of keeping house (HOME), by the seed too:
//   - **bands**: two bands of rooms; along the back (north, the courtyard's side, its wall standing to
//     the ceiling with the windows in it) the bedroom, the bathroom and the hall with the front door
//     from the landing; along the street side the living room and the kitchen. Hall → kitchen →
//     living room → bedroom; the bathroom off the hall.
//   - **corridor**: along the back the kitchen, the hall and the bathroom; a corridor across the flat
//     under them; along the street side the living room and the bedroom, off the corridor.
//   - **studio**: along the back a kitchenette open to the room, the bathroom, the hall; the rest one
//     room, the bed at one end and the sofa before the television at the other.
// Each is mirrored or not, its size within its range. The HOME a city keeps: its walls (paint, or a
// paper with a pattern: damask, stripes, small flowers), its floors by room (herringbone or straight
// parquet, planks, carpet, lino, chequered lino, bathroom tiles, terrazzo, patterned cement tiles),
// its woods and fabrics, the telephone's colour, what hangs on the back wall (pictures, a mirror, a
// clock, a calendar; in Moscow a carpet over the bed, as Moscow does), and the light (a mood: warm,
// soft, or a kitchen's cool tube). The furniture's own looks (sim/interiors/furniture.js, drawn by
// src/art/furniture.js) take the flat's woods and fabrics and their own seeds. A flat not yet moved
// into (`boxes`) has moving boxes about. What's done where (spots): the bed, the telephone, the basin,
// the table, the cooker, the street-side window (sim/scenarios/campaign.js: out of it, the street below),
// the wardrobe (the studio's drawers: what you wear and what you keep, sim/clothes.js);
// the way out (exits): the front door.
import { stream, int, pick, chance, range } from '../rng.js';
import { mirror } from './plan.js';

// The cities' ways of keeping house.
const HOME = {
  moscow: { walls: ['damask', 'stripes', 'flowers', 'paint'], paints: [[0xd9c9a3, 0xb8a27a], [0xc9d3b4, 0x9fae86], [0xd6c0b0, 0xb08c7c], [0xe2dac6, 0xc4bba9], [0xcfd6dc, 0xa7b4bf]],
    floors: { living: ['herringbone'], bedroom: ['herringbone', 'parquet'], kitchen: ['lino', 'checker'], bath: ['tiles'], hall: ['parquet'] }, floorWood: [0xa8784f, 0x8f6345, 0xb48459],
    woods: ['walnut', 'teak', 'dark'], fabrics: ['brown', 'green', 'red', 'mustard'], phones: ['red', 'cream'], rugs: ['persian', 'persian', 'kilim'], wallCarpet: 0.6, moods: ['warm', 'warm', 'soft'] },
  london: { walls: ['paint', 'paint', 'stripes', 'flowers'], paints: [[0xb4bfa0, 0x8f9c7c], [0xe8dcc4, 0xc9b99a], [0xb8c4cc, 0x8f9faa], [0xd6ccb8, 0xb0a48c], [0xd8bcb0, 0xb89488]],
    floors: { living: ['planks', 'carpet'], bedroom: ['carpet'], kitchen: ['lino', 'checker'], bath: ['tiles', 'lino'], hall: ['planks'] }, floorWood: [0xb48459, 0xd6ad7a, 0x8f6345],
    woods: ['oak', 'pine', 'white'], fabrics: ['navy', 'grey', 'green', 'cream', 'teal'], phones: ['black', 'cream'], rugs: ['kilim', 'plain', 'persian'], wallCarpet: 0, moods: ['soft', 'soft', 'cool'] },
  cairo: { walls: ['paint', 'paint', 'stripes'], paints: [[0xe2d2b0, 0xc4b08a], [0xd0d8c0, 0xaab89a], [0xc8d4dc, 0xa0b0bc], [0xece6da, 0xcfc6b4]],
    floors: { living: ['terrazzo', 'cement'], bedroom: ['terrazzo', 'parquet'], kitchen: ['cement'], bath: ['tiles'], hall: ['terrazzo'] }, floorWood: [0x8f6345, 0x6b4636],
    woods: ['dark', 'teak', 'walnut'], fabrics: ['red', 'mustard', 'teal', 'brown'], phones: ['black', 'green'], rugs: ['kilim', 'persian'], wallCarpet: 0, moods: ['cool', 'soft', 'warm'] },
  beirut: { walls: ['paint', 'paint', 'flowers'], paints: [[0xe8dcc4, 0xc9b99a], [0xd8c8d0, 0xb4a0ac], [0xd0d8c0, 0xaab89a], [0xece6da, 0xcfc6b4]],
    floors: { living: ['cement', 'cement', 'terrazzo'], bedroom: ['cement', 'parquet'], kitchen: ['cement'], bath: ['tiles'], hall: ['cement'] }, floorWood: [0xb48459, 0x8f6345],
    woods: ['teak', 'walnut', 'white'], fabrics: ['plum', 'teal', 'red', 'cream'], phones: ['cream', 'green'], rugs: ['kilim', 'persian'], wallCarpet: 0, moods: ['warm', 'soft'] },
};
export const MOODS = { warm: 0xf8dca8, soft: 0xf8e8c8, cool: 0xe0e8f0 };
export const CEMENT = [[0x9e3c36, 0xe2d2b0], [0x283f6b, 0xe2dac6], [0x356f42, 0xe2d2b0], [0x6b4636, 0xd6c6a8]];
const DECOR = ['picture', 'picture', 'picture', 'mirror', 'clock', 'calendar'];

/** A flat's plan, from its seed: { city, boxes: moving boxes about, layout: to choose it }. */
export function flatPlan(seed, { city = 'moscow', boxes = false, layout = null } = {}) {
  const r = stream('flat', seed), H = HOME[city] ?? HOME.moscow;
  const which = layout ?? pick(r, ['bands', 'bands', 'corridor', 'corridor', 'studio']);
  const look = { wood: pick(r, H.woods), fabric: pick(r, H.fabrics), fabric2: pick(r, H.fabrics), phone: pick(r, H.phones), rug: pick(r, H.rugs), seed: int(r, 1e6) };
  const plan = LAYOUTS[which](r, look);
  plan.kind = 'flat'; plan.layout = which; plan.seed = seed;
  dress(plan, r, H, look);
  if (boxes) unpacked(plan, r);
  return chance(r, 0.5) ? mirror(plan) : plan;
}

// ---------- the layouts ----------

export const LAYOUTS = {
  bands(r, look) {
    const W = pick(r, [10.5, 11, 11.5, 12]), D = pick(r, [7.6, 8, 8.4]), N = 3.6;
    const bx = W - 6, hx = W - 3.4, kx = W - 4.2, L = D - N, bedX = bx / 2 + 0.6;
    const rooms = [room('bedroom', 0, 0, bx, N), room('bath', bx, 0, hx, N), room('hall', hx, 0, W, N), room('living', 0, N, kx, D), room('kitchen', kx, N, W, D)];
    const openings = [door('x', N, 0.45, 1.35), door('z', hx, 1.45, 2.35), way('x', N, W - 1.0, W - 0.1), way('z', kx, N + 0.9, N + 2.3), front(W - 2.3, W - 1.3)];
    const windows = [win(1.55, 2.35), win(bedX - 0.5, bedX + 0.5), win(hx - 1.0, hx - 0.3)];
    const items = [
      it('bed', bedX, 1.2, 'down', { duvet: look.fabric2 }), it('bedsideTable', bedX - 1.1, 0.35), it('bedsideTable', bedX + 1.1, 0.35, 'down', { on: chance(r, 0.5) }),
      it('wardrobe', 0.7, 0.32, 'down', { wood: look.wood }),
      it('bathtub', bx + 0.95, 0.45), it('washbasin', hx - 0.4, 0.25), it('toilet', hx - 0.37, N - 0.55, 'left'),
      it('coatRack', W - 0.45, 1.2, 'left'), it('shoeRack', hx + 0.5, 0.3),
      it('rug', 2.9, N + L * 0.45, 'down', { pattern: look.rug }), it('sofa', 2.9, N + 0.55, 'down', { fabric: look.fabric }), it('coffeeTable', 2.9, N + 1.75, 'down', { wood: look.wood }),
      it('phoneTable', 4.3, N + 0.3, 'down', { phone: look.phone }), it('floorLamp', 1.62, N + 0.3, 'down', { on: true }), it('bookshelf', kx - 0.55, N + 0.25, 'down', { wood: look.wood }),
      it('armchair', 0.6, N + 2.0, 'right', { fabric: look.fabric }), it('tv', 2.9, D - 0.3, 'up'), it('desk', kx - 1.0, D - 0.63, 'up', { wood: look.wood }), it('plant', 4.3, D - 0.35),
      it('fridge', kx + 0.4, N + 0.4), it('sink', kx + 1.2, N + 0.38), it('cooker', kx + 2.0, N + 0.38), it('kitchenShelf', kx + 1.2, N + 0.2),
      it('diningTable', kx + 1.35, D - 0.85, 'right', { wood: look.wood }),
    ];
    const spots = [spot('dress', 0.7, 1.15, 'up'), spot('sleep', bedX, 2.65, 'up'), spot('phone', 4.3, N + 0.85, 'up'), spot('wash', hx - 0.4, 0.95, 'up'), spot('eat', kx + 1.35, D - 1.85, 'down'), spot('cook', kx + 2.0, N + 1.05, 'up'), spot('window', 1.1, D - 0.6, 'down'), spot('read', 1.3, N + 2.0, 'left')];
    return { x0: 0, z0: 0, x1: W, z1: D, rooms, openings, windows, windowsS: [win(0.6, 1.6)], items, spots, exits: [exit(W - 2.3, W - 1.3)] };
  },

  corridor(r, look) {
    const W = pick(r, [11, 11.5, 12, 12.5]), D = pick(r, [8.4, 8.8, 9.2]), N = 3.2, C = 1.4, S = N + C;
    const kx = Math.round(W * 0.38 * 4) / 4, hx = kx + 2.6, lx = Math.round(W * 0.52 * 4) / 4, bedX = lx + 2.9;
    const rooms = [room('kitchen', 0, 0, kx, N), room('hall', kx, 0, hx, N), room('bath', hx, 0, W, N), room('corridor', 0, N, W, S, 'hall'), room('living', 0, S, lx, D), room('bedroom', lx, S, W, D)];
    const openings = [front(kx + 0.95, kx + 1.9), way('x', N, kx + 0.3, hx - 0.3), door('x', N, kx - 1.3, kx - 0.4), door('x', N, hx + 0.3, hx + 1.2), door('x', S, lx - 1.4, lx - 0.5), door('x', S, lx + 0.5, lx + 1.4)];
    const windows = [win(1.2, 2.4), win(hx + 1.6, hx + 2.2)];
    const items = [
      it('fridge', 0.4, 0.4), it('counter', 1.3, 0.38, 'down', { wood: look.wood }), it('sink', 2.4, 0.38), it('cooker', 3.2, 0.38), it('kitchenShelf', 1.3, 0.2),
      it('diningTable', 1.6, 1.75, 'right', { wood: look.wood }),
      it('coatRack', hx - 0.3, 0.35), it('shoeRack', kx + 0.45, 0.3),   // (either side of the front door, clear of it)
      it('bathtub', hx + 1.1, 0.45), it('washbasin', W - 0.4, 0.25), it('toilet', W - 0.37, N - 0.6, 'left'),
      it('phoneTable', 0.45, N + 0.3, 'down', { phone: look.phone }), it('radiator', W - 1.2, N + 0.1),
      it('rug', 1.7, S + (D - S) * 0.5, 'down', { pattern: look.rug }), it('sofa', 1.7, S + 0.55, 'down', { fabric: look.fabric }), it('coffeeTable', 1.7, S + 1.75, 'down', { wood: look.wood }),
      it('tv', 1.7, D - 0.3, 'up'), it('armchair', lx - 0.7, D - 1.3, 'left', { fabric: look.fabric }), it('floorLamp', 0.35, D - 0.4, 'down', { on: true }), it('plant', lx - 0.4, S + 0.35),
      it('bed', bedX, S + 1.2, 'down', { duvet: look.fabric2 }), it('bedsideTable', bedX - 1.1, S + 0.35, 'down', { on: chance(r, 0.5) }), it('bedsideTable', bedX + 1.1, S + 0.35),
      it('drawers', bedX, D - 0.3, 'up', { wood: look.wood }), it('wardrobe', W - 0.32, D - 1.0, 'left', { wood: look.wood }),
    ];
    const spots = [spot('dress', W - 1.15, D - 1.0, 'right'), spot('sleep', bedX, S + 2.65, 'up'), spot('phone', 0.45, N + 0.85, 'up'), spot('wash', W - 0.4, 0.95, 'up'), spot('eat', 1.6, 2.75, 'up'), spot('cook', 3.2, 1.05, 'up'), spot('window', 3.4, D - 0.6, 'down'), spot('read', lx - 1.45, D - 1.3, 'right')];
    return { x0: 0, z0: 0, x1: W, z1: D, rooms, openings, windows, windowsS: [win(2.9, 3.9)], items, spots, exits: [exit(kx + 0.95, kx + 1.9)] };
  },

  studio(r, look) {
    const W = pick(r, [8.5, 9, 9.5]), D = pick(r, [6.8, 7.2]), N = 2.8, kx = 3.4, hx = kx + 2.2;
    const rooms = [room('kitchen', 0, 0, kx, N), room('bath', kx, 0, hx, N), room('hall', hx, 0, W, N), room('living', 0, N, W, D)];
    const openings = [way('x', N, 0.3, kx - 0.3), door('z', hx, 0.9, 1.8), way('x', N, hx + 0.3, W - 0.3), front(W - 1.8, W - 0.8)];
    const windows = [win(0.6, 1.4), win(kx + 1.3, kx + 1.9)];
    const bedX = kx + 1.6;                                         // (east of the way between the sofa and the kitchenette)
    const items = [
      it('fridge', 0.4, 0.4), it('sink', 1.2, 0.38), it('cooker', 2.0, 0.38), it('kitchenShelf', 1.2, 0.2),
      it('bathtub', kx + 0.95, 0.45), it('toilet', hx - 0.37, N - 0.5, 'left'), it('washbasin', kx + 0.3, N - 0.6, 'right'),
      it('coatRack', W - 0.4, 0.35, 'left'),
      // (the bed by the bathroom's wall, a lamp beside it; the sofa a step off the kitchenette's opening, the way between them open)
      it('bed', bedX, N + 1.2, 'down', { duvet: look.fabric2 }), it('floorLamp', bedX - 1.05, N + 0.3, 'down', { on: true }),
      it('rug', 1.6, N + 2.5, 'down', { pattern: look.rug }), it('sofa', 1.6, N + 1.5, 'down', { fabric: look.fabric }), it('coffeeTable', 1.6, N + 2.6, 'down', { wood: look.wood }), it('tv', 1.6, D - 0.3, 'up'),
      it('desk', W - 1.2, D - 0.63, 'up', { wood: look.wood }), it('phoneTable', W - 0.3, N + 1.2, 'left', { phone: look.phone }), it('plant', W - 0.35, D - 1.55),
      it('drawers', bedX + 1.5, D - 0.3, 'up', { wood: look.wood }),
    ];
    const spots = [spot('dress', bedX + 1.5, D - 1.05, 'down'), spot('sleep', bedX, N + 2.65, 'up'), spot('phone', W - 0.95, N + 1.2, 'right'), spot('wash', kx + 0.85, N - 0.6, 'left'), spot('eat', 1.2, 1.15, 'up'), spot('cook', 2.0, 1.05, 'up'), spot('window', 3.1, D - 0.6, 'down'), spot('read', 3.0, N + 1.5, 'left')];
    return { x0: 0, z0: 0, x1: W, z1: D, rooms, openings, windows, windowsS: [win(2.6, 3.6)], items, spots, exits: [exit(W - 1.8, W - 0.8)] };
  },
};

const room = (id, x0, z0, x1, z1, kind = id) => ({ id, kind, x0, z0, x1, z1 });
const door = (axis, at, a, b) => ({ axis, at, a, b, kind: 'door' });
const way = (axis, at, a, b) => ({ axis, at, a, b, kind: 'doorway' });
const front = (a, b) => ({ axis: 'x', at: 0, a, b, kind: 'front' });
const win = (a, b) => ({ axis: 'x', at: 0, a, b });
const exit = (x0, x1) => ({ id: 'front', x0, z0: -0.3, x1, z1: 0.3, to: 'landing' });
const it = (kind, x, z, face = 'down', look = {}) => ({ kind, x, z, face, look });
const spot = (kind, x, z, face) => ({ kind, x, z, face });

// ---------- the dressing ----------

/** The city's way of keeping house: walls, floors, what hangs on the back wall, the light; the furniture's woods and fabrics. */
function dress(plan, r, H, look) {
  // (a paper or a paint for the flat, a shade of it a room; the bathroom's tiles, the kitchen's own paint)
  const wall = pick(r, H.walls), base = pick(r, H.paints), floorWood = pick(r, H.floorWood);
  for (const q of plan.rooms) {
    const [c1, c2] = q.kind === 'bath' ? [0xe8ecef, 0xc8d0d8] : q.kind === 'kitchen' ? pick(r, H.paints) : chance(r, 0.35) ? pick(r, H.paints) : base;
    q.wall = { kind: q.kind === 'bath' || q.kind === 'kitchen' ? 'paint' : wall, c1, c2 };
    q.paint = c1;
    q.floor = pick(r, H.floors[q.kind] ?? H.floors.hall);
    q.floorColor = q.floor === 'carpet' ? pick(r, [0x8f6345, 0x6a7182, 0x9e3c36, 0x356f42, 0xc4bba9]) : q.floor === 'cement' ? int(r, CEMENT.length) : floorWood;
  }
  plan.look = { ...look, floor: floorWood };
  plan.mood = pick(r, H.moods);
  plan.lights = plan.rooms.map(q => ({ x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2, r: Math.max(q.x1 - q.x0, q.z1 - q.z0) * 0.7, room: q.id,
    color: q.kind === 'kitchen' && plan.mood === 'cool' ? MOODS.cool : MOODS[plan.mood] }));
  // What hangs on the back wall, room by room: clear of the windows, the front door and anything tall against it.
  const busy = [...plan.windows.map(w => [w.a - 0.15, w.b + 0.15]), ...plan.openings.filter(o => o.kind === 'front').map(o => [o.a - 0.2, o.b + 0.2]),
    ...plan.items.filter(i => ['wardrobe', 'bookshelf', 'fridge', 'kitchenShelf', 'coatRack', 'mirror'].includes(i.kind) && i.z < 0.7).map(i => [i.x - 0.7, i.x + 0.7])];
  const free = (a, b) => !busy.some(([p, q]) => a < q && b > p);
  plan.decor = [];
  for (const q of plan.rooms.filter(q => q.z0 === plan.z0 && q.kind !== 'bath')) {
    // (Moscow's carpet over the bed, as Moscow hangs them)
    const bed = plan.items.find(i => i.kind === 'bed' && i.x > q.x0 && i.x < q.x1 && i.z < 1.5);
    if (bed && chance(r, H.wallCarpet) && free(bed.x - 0.9, bed.x + 0.9)) { plan.decor.push({ kind: 'carpet', x: bed.x, y: 1.05, w: 1.7, h: 1.3, look: { pattern: look.rug, seed: int(r, 1e6) } }); busy.push([bed.x - 0.95, bed.x + 0.95]); }
    for (let n = 0, tries = 0; n < 2 && tries < 12; tries++) {
      const kind = pick(r, DECOR), w = kind === 'picture' ? range(r, 0.4, 0.9) : kind === 'mirror' ? 0.5 : kind === 'clock' ? 0.32 : 0.36;
      if (q.x1 - q.x0 < w + 0.7) continue;
      const x = range(r, q.x0 + 0.3 + w / 2, q.x1 - 0.3 - w / 2);
      if (!free(x - w / 2 - 0.1, x + w / 2 + 0.1)) continue;
      const h = kind === 'picture' ? w * range(r, 0.6, 1.2) : kind === 'mirror' ? 0.7 : kind === 'clock' ? 0.32 : 0.5;
      plan.decor.push({ kind, x, y: kind === 'clock' ? 1.9 : 1.35, w, h, look: { seed: int(r, 1e6), frame: pick(r, [0x6b4636, 0xb9862e, 0x23252f, 0xe2dac6]) } });
      busy.push([x - w / 2 - 0.1, x + w / 2 + 0.1]);
      n++;
    }
  }
}

/** Moving boxes about a flat not yet unpacked: in the corners of the living room and the bedroom, where the floor's free (a corner walls nothing off). */
function unpacked(plan, r) {
  const taken = (x, z) => plan.items.some(i => Math.abs(i.x - x) < 1.1 && Math.abs(i.z - z) < 1.0) || plan.spots.some(s => Math.hypot(s.x - x, s.z - z) < 1.3)
    || plan.openings.some(o => (o.axis === 'x' ? Math.abs(o.at - z) < 1.2 && x > o.a - 0.7 && x < o.b + 0.7 : Math.abs(o.at - x) < 1.2 && z > o.a - 0.7 && z < o.b + 0.7));
  for (const q of plan.rooms.filter(q => q.kind === 'living' || q.kind === 'bedroom')) {
    const corners = [[q.x0 + 0.5, q.z0 + 0.45], [q.x1 - 0.5, q.z0 + 0.45], [q.x0 + 0.5, q.z1 - 0.45], [q.x1 - 0.5, q.z1 - 0.45]].filter(([x, z]) => !taken(x, z));
    for (let n = 0; n < 2 && corners.length; n++) { const [x, z] = corners.splice(int(r, corners.length), 1)[0]; plan.items.push(it('cartons', x, z)); }
  }
}
