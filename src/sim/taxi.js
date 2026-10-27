// TRADECRAFT sim: a taxi (DESIGN.md, Travel: "fast travel between points of interest by metro, bus, taxi
// … a taxi at the right moment can shake a tail"; the user, 2026-10-27: "transport for fast travel").
// The engine's, in any scene on the street.
//
// At the kerb (on the street, within KERB_M of the road's edge), T hails one (sim/acts.js affordance
// 'taxi'). Where to (destinations()): a few streets off, north or south and along (OFFSETS), and the
// scene's own places if it has some (scenario.destinations?(state): the campaign's flat, embassy, safe
// houses; Blown's car). ride() goes: the wait for one and the ride (HAIL_MIN, PER_ROW_MIN), the clock
// skipped (sim/game.js skip()), the street there loaded (loadRow()), and you out at its kerb. Whoever
// was following on foot has lost you (an agent's follow, lost); the scene hears of it first
// (scenario.onTaxi?(state, bus, to)): being tailed writes it down if one of them saw you get in, and
// the team's lost; in Blown the driver may have heard the radio.
import { MIN } from './clock.js';
import { Z } from './map/street.js';
import { int, range, stream } from './rng.js';
import { place, onStreet } from './instinct.js';

export const KERB_M = 1.2;
export const HAIL_MIN = [1, 4];                                  // (waiting for one to stop)
export const PER_ROW_MIN = 2.5;
export const OFFSETS = [[-2, 'two streets north'], [-4, 'four streets north'], [2, 'two streets south'], [4, 'four streets south']];

/** Whether actor a is at a kerb, where a taxi stops (on the street proper, by the road's edge). */
export function atKerb(state, a) {
  if (state.map.kind !== 'street' || !onStreet(place(state, a))) return false;
  return Math.abs(a.z - Z.kerbN) < KERB_M || Math.abs(a.z - Z.kerbS) < KERB_M;
}

/** Where a taxi from here could go: [{ id, label, row, x }]. */
export function destinations(state, scenario) {
  const me = state.actors.find(a => a.who === state.player), row = state.map.row ?? 0;
  const r = stream('taxi', state.map.seed, row, Math.round(me.x));
  const own = scenario?.destinations?.(state) ?? [];
  return [...own, ...OFFSETS.map(([dr, label]) => ({ id: `off${dr}`, label, row: row + dr, x: me.x + range(r, -120, 120) }))];
}

/** The ride: the wait, the minutes on the road, the street there, you at its kerb; followers lost. */
export function ride(state, bus, to, { scenario, skip, loadRow }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  const r = stream('ride', state.map.seed, state.time.ms);
  const minutes = HAIL_MIN[0] + int(r, HAIL_MIN[1] - HAIL_MIN[0] + 1) + Math.abs(to.row - from) * PER_ROW_MIN + 3;
  scenario?.onTaxi?.(state, bus, to);                             // (the scene's own: who saw you get in, a driver who heard the radio)
  if (state.scenario.outcome) return;
  for (const a of state.actors) if (a.ai?.follow?.id === me.id) a.ai.follow.lost = true;   // (on foot, they can't follow a car)
  skip(state, bus, Math.round(minutes * MIN));
  const z = Z.kerbS + 0.6;
  Object.assign(me, { row: to.row, x: to.x, z, vx: 0, vz: 0, busy: null, glass: false, face: 'down', head: Math.PI / 2 });
  if (to.row !== from) loadRow(state, bus, to.row, to.x, { quiet: true });
  return minutes;
}
