// TRADECRAFT sim: what's done where, inside (an interior's plan: sim/interiors/plan.js). Its spots (the
// bed to sleep in, the telephone, the basin, the kitchen table) and its ways out, read off the plan the
// map is drawn from (sim/map/interior.js). The scene decides what each does (the campaign's flat:
// sim/scenarios/campaign.js); walking to a spot is the engine's busy walk (sim/game.js busy()).
import { wayAcross } from './path.js';

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

/** The way out actor a stands in, or null. */
export const exitHere = (state, a) => planHere(state)?.exits.find(e => a.x >= e.x0 && a.x <= e.x1 && a.z >= e.z0 && a.z <= e.z1) ?? null;

/** Walk actor a to a spot, round the walls and the furniture (sim/interiors/path.js), and face as it says there (the engine's busy walk). */
export function walkTo(state, a, s) {
  const S = state.$world?.sections.get(0), way = S?.plan ? wayAcross(S, a.x, a.z, s.x, s.z) : null;
  a.busy = { what: `spot:${s.kind}`, steps: [...(way ?? [[s.x, s.z]]).map(([x, z]) => ['go', x, z]), ['wait', 1, s.face, 'idle']], wait: 0 };
}
