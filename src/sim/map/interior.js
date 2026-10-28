// TRADECRAFT sim: an interior as a map (state.map.kind 'interior'): a plan (sim/interiors/plan.js) set in
// the middle of one section's width, in the shape of a street section (sim/map/street.js) so the world
// and the view take it as they take the Farm's hall (sim/map/dojo.js): blockers, lamps, the plan itself
// for the view, and its ways out (S.exits: step into one and you leave by it: sim/interiors/use.js).
// The walls block the eyes as a building does; the furniture only the feet (a rug, a chair, not even
// those). Which plan: the map's `plan` ('flat', 'embassy') and `seed`.
import { SECTION_M } from './layout.js';
import { walls, wallRect } from '../interiors/plan.js';
import { flatPlan } from '../interiors/flat.js';
import { embassyPlan } from '../interiors/embassy.js';
import { FURNITURE, footprint } from '../interiors/furniture.js';

const PLANS = { flat: flatPlan, embassy: embassyPlan };

/** The plan a map shows, set in place (x offset so it sits in the middle of the section). */
export function planOf(map) {
  const p = (PLANS[map.plan] ?? flatPlan)(map.seed, { city: map.city, boxes: !!map.boxes, layout: map.layout ?? null }), ox = Math.round((SECTION_M / 2 - (p.x0 + p.x1) / 2) * 16) / 16;
  const sx = (o) => ({ ...o, x0: o.x0 + ox, x1: o.x1 + ox });
  return {
    ...p, ox, x0: p.x0 + ox, x1: p.x1 + ox,
    rooms: p.rooms.map(sx), exits: p.exits.map(sx),
    openings: p.openings.map(o => (o.axis === 'x' ? { ...o, a: o.a + ox, b: o.b + ox } : { ...o, at: o.at + ox })),
    windows: p.windows.map(o => (o.axis === 'x' ? { ...o, a: o.a + ox, b: o.b + ox } : { ...o, at: o.at + ox })),
    windowsS: (p.windowsS ?? []).map(o => ({ ...o, a: o.a + ox, b: o.b + ox })),
    items: p.items.map(it => ({ ...it, x: it.x + ox })), spots: p.spots.map(s => ({ ...s, x: s.x + ox, ...(s.seat ? { seat: { ...s.seat, x: s.seat.x + ox } } : {}) })), lights: p.lights.map(l => ({ ...l, x: l.x + ox })),
    decor: (p.decor ?? []).map(d => ({ ...d, x: d.x + ox })),
    // (an embassy's people's places: sim/interiors/staffing.js)
    staff: (p.staff ?? []).map(s => ({ ...s, x: s.x + ox, ...(s.approach ? { approach: { ...s.approach, x: s.approach.x + ox } } : {}) })),
    seats: (p.seats ?? []).map(s => ({ ...s, x: s.x + ox, approach: { ...s.approach, x: s.approach.x + ox } })), window: p.window && { ...p.window, x: p.window.x + ox },
    errands: (p.errands ?? []).map(e => ({ ...e, x: e.x + ox })),
  };
}

/** The interior as a section: { i: 0, kind: 'interior', plan, walls, blockers, lamps, exits, … }. */
export function interior(map) {
  const plan = planOf(map), W = walls(plan);
  const S = { i: 0, x0: 0, x1: SECTION_M, seed: map.seed, kind: 'interior', band: 'interior', park: null, plan, walls: W,
    buildings: [], doors: [], props: [], lamps: [], blockers: [], crossings: [], crossingsS: [], exits: [], gapsN: [], gapsS: [] };
  const block = (b, what) => S.blockers.push({ ...b, what });
  for (const w of W) block(wallRect(w), 'building');
  // (beyond a door out: a step into it, no further; the dark round the plan, solid. A door in the back wall, or in the street side's)
  for (const e of plan.exits) block(e.side === 's' ? { x0: e.x0 - 0.3, z0: e.z1 + 0.4, x1: e.x1 + 0.3, z1: e.z1 + 1.2 } : { x0: e.x0 - 0.3, z0: e.z0 - 1.2, x1: e.x1 + 0.3, z1: e.z0 - 0.4 }, 'building');
  for (const it of plan.items) if (FURNITURE[it.kind]?.block !== false) block(footprint(it), 'furniture');
  // The lights: one a room, over its middle (sim/light.js reads them as the street's lamps).
  for (const l of plan.lights) S.lamps.push({ r: l.r, color: l.color ?? 0xf8e8c0, core: 0.3, ring: 0.1, x: l.x, z: l.z });
  return S;
}
