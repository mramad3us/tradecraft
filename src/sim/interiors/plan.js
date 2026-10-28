// TRADECRAFT sim: an interior's plan (the user, 2026-10-27: "let's build a lot of interiors, like
// appartments, there should be a lot of multiroom interiors including buildings in cities, supermarkets
// etc, bakeries should be built etc"). Pure data, as a street section is: the rooms, the walls round and
// between them, the openings in those walls, the furniture in the rooms (its sizes:
// sim/interiors/furniture.js), the lights, the ways out. A flat's plan is a map of its own
// (state.map.kind 'interior': sim/map/interior.js); the ground floors of the street's buildings will be
// plans set into the street.
//
// Coordinates as the street's: x east, z south, metres; a plan's rooms tile its rectangle (x0 … x1,
// z0 … z1), the north wall's inner face at z0. What a plan holds:
//   - rooms: [{ id, kind ('living', 'bedroom', 'kitchen', 'bath', 'hall'…), x0, z0, x1, z1, floor, paint }];
//   - openings: [{ axis, at, a, b, kind: 'doorway' | 'door' | 'front' }]: a gap in the wall on the line
//     `at` (axis 'x': a wall running east–west at z = at, from x a to b; axis 'z': north–south at x = at);
//   - windows: [{ axis, at, a, b }]: glass in an outer wall;
//   - items: the furniture, [{ kind, x, z, face, look }] (x, z its middle);
//   - exits: [{ id, x0, z0, x1, z1, to }]: step into one and you leave by it;
//   - spots: [{ kind ('sleep', 'phone'…), x, z, face, item }]: what's done where (sim/interiors/use.js).
// walls() turns the rooms and openings into wall runs: every room's edges, merged where two rooms share
// one, less the openings. Their heights are for the camera (north, 45° down): the outer north, east and
// west walls stand to the ceiling (WALL_H); every other wall, the street side's and the ones between
// rooms, is cut to CUT_H, so no wall hides the room behind it (the cutaway: DESIGN.md, Look).
export const WALL_H = 2.8, CUT_H = 1.0, WALL_T = 0.16, OUTER_T = 0.3;

const r2 = (v) => Math.round(v * 100) / 100;

/** A plan's walls: [{ axis, at, a, b, h, outer, side }] (side: which outer wall, or null). */
export function walls(plan) {
  const lines = new Map();
  const add = (axis, at, a, b) => { const k = `${axis}${r2(at)}`; (lines.get(k) ?? lines.set(k, { axis, at: r2(at), runs: [] }).get(k)).runs.push([r2(a), r2(b)]); };
  for (const r of plan.rooms) { add('x', r.z0, r.x0, r.x1); add('x', r.z1, r.x0, r.x1); add('z', r.x0, r.z0, r.z1); add('z', r.x1, r.z0, r.z1); }
  const out = [];
  for (const L of lines.values()) {
    // (the runs on one line merged, then the openings on it cut out)
    let runs = L.runs.sort((p, q) => p[0] - q[0]).reduce((acc, [a, b]) => { const l = acc[acc.length - 1]; if (l && a <= l[1] + 0.01) l[1] = Math.max(l[1], b); else acc.push([a, b]); return acc; }, []);
    for (const o of plan.openings.filter(o => o.axis === L.axis && Math.abs(o.at - L.at) < 0.01)) runs = runs.flatMap(([a, b]) => (o.b <= a || o.a >= b ? [[a, b]] : [[a, o.a], [o.b, b]].filter(([p, q]) => q - p > 0.05)));
    const side = L.axis === 'x' ? (Math.abs(L.at - plan.z0) < 0.01 ? 'n' : Math.abs(L.at - plan.z1) < 0.01 ? 's' : null) : (Math.abs(L.at - plan.x0) < 0.01 ? 'w' : Math.abs(L.at - plan.x1) < 0.01 ? 'e' : null);
    for (const [a, b] of runs) out.push({ axis: L.axis, at: L.at, a, b, side, outer: !!side, h: side && side !== 's' ? WALL_H : CUT_H });
  }
  return out;
}

/** A wall run as the rectangle it stands on (an outer wall's thickness outside the plan). */
export function wallRect(w) {
  const t = w.outer ? OUTER_T : WALL_T / 2, o = w.outer ? 0 : WALL_T / 2;
  // (an outer wall: its inner face on the line, its thickness out; an inner one: astride the line)
  const lo = w.side === 'n' || w.side === 'w' ? w.at - t : w.at - o, hi = w.side === 'n' || w.side === 'w' ? w.at : w.side ? w.at + t : w.at + o;
  return w.axis === 'x' ? { x0: w.a - (w.outer ? OUTER_T : 0), x1: w.b + (w.outer ? OUTER_T : 0), z0: lo, z1: hi } : { x0: lo, x1: hi, z0: w.a, z1: w.b };
}

/** The room a point is in, or null. */
export const roomAt = (plan, x, z) => plan.rooms.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) ?? null;

/** A plan mirrored east–west about its middle (the same flat, the other way round): a fresh copy. */
export function mirror(plan) {
  const m = (x) => r2(plan.x0 + plan.x1 - x), face = { left: 'right', right: 'left' };
  const flip = (o) => ({ ...o, x0: m(o.x1), x1: m(o.x0) });
  return {
    ...plan,
    rooms: plan.rooms.map(flip),
    openings: plan.openings.map(o => (o.axis === 'x' ? { ...o, a: m(o.b), b: m(o.a) } : { ...o, at: m(o.at) })),
    windows: plan.windows.map(o => (o.axis === 'x' ? { ...o, a: m(o.b), b: m(o.a) } : { ...o, at: m(o.at) })),
    items: plan.items.map(it => ({ ...it, x: m(it.x), face: face[it.face] ?? it.face })),
    exits: plan.exits.map(flip),
    spots: plan.spots.map(s => ({ ...s, x: m(s.x), face: face[s.face] ?? s.face })),
    lights: plan.lights.map(l => ({ ...l, x: m(l.x) })),
    decor: (plan.decor ?? []).map(d => ({ ...d, x: m(d.x) })),
  };
}
