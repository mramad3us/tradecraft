// TRADECRAFT sim: what's done where, inside (an interior's plan: sim/interiors/plan.js). Its spots (the
// bed to sleep in, the telephone, the basin, the kitchen table) and its ways out, read off the plan the
// map is drawn from (sim/map/interior.js). The scene decides what each does (the campaign's flat:
// sim/scenarios/campaign.js); walking to a spot is the engine's busy walk (sim/game.js busy()).
import { wayAcross } from './path.js';
import { STEP_M } from './plan.js';

export const SPOT_REACH_M = 1.1;

/** The plan of the interior the map is, or null. */
export const planHere = (state) => (state.map?.kind === 'interior' ? state.$world?.sections.get(0)?.plan ?? null : null);

/** The spot of a kind in the plan (the first), or null. */
export const spotOf = (state, kind) => planHere(state)?.spots.find(s => s.kind === kind) ?? null;

/** The spot within reach of actor a (the nearest), or null. */
export function spotNear(state, a) {
  const plan = planHere(state);
  if (!plan || !a) return null;
  let best = null, bd = SPOT_REACH_M;
  for (const s of plan.spots) { const d = Math.hypot(s.x - a.x, s.z - a.z); if (d < bd) { bd = d; best = s; } }
  return best;
}

/**
 * The way out actor a stands in, or null: the doorway, and the step beyond it up to where the dark stops
 * the feet (sim/map/interior.js blocks it STEP_M past the door). The campaign looks once a second, and a
 * walk crosses the doorway's band in under half of one: without the step, you could stand pressed against
 * the dark just past it and never be let out (the user, 2026-10-28: "The door to exit the embassy is
 * finicky, we have to really try to get out").
 */
export const exitHere = (state, a) => planHere(state)?.exits.find(e => a.x >= e.x0 && a.x <= e.x1 && (e.side === 's' ? a.z >= e.z0 && a.z <= e.z1 + STEP_M : a.z >= e.z0 - STEP_M && a.z <= e.z1)) ?? null;

/** Walk actor a to a spot, round the walls and the furniture (sim/interiors/path.js), and face as it says there (the engine's busy walk). */
export function walkTo(state, a, s) {
  const S = state.$world?.sections.get(0), way = S?.plan ? wayAcross(S, a.x, a.z, s.x, s.z) : null;
  a.busy = { what: `spot:${s.kind}`, steps: [...(way ?? [[s.x, s.z]]).map(([x, z]) => ['go', x, z]), ['wait', 1, s.face, 'idle']], wait: 0 };
}

/** The shop floor (sim/interiors/shop.js) at (x, z) on the street in play: { S, u, k }, or null. */
export function unitAt(state, x, z) {
  if (state.map?.kind !== 'street' || !state.$world) return null;
  for (const S of state.$world.sections.values()) {
    if (x < S.x0 - 1 || x > S.x1 + 1) continue;
    for (let k = 0; k < (S.units?.length ?? 0); k++) { const u = S.units[k]; if (x >= u.x0 && x <= u.x1 && z >= u.z0 && z <= u.z1) return { S, u, k }; }
  }
  return null;
}
