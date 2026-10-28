// TRADECRAFT sim: a taxi (DESIGN.md, Travel: "fast travel between points of interest by metro, bus, taxi
// … a taxi at the right moment can shake a tail"; the user, 2026-10-27: "transport for fast travel").
// The engine's, in any scene on the street.
//
// A taxi is one of the street's traffic (sim/traffic.js), its light lit when it's free (the user,
// 2026-10-27: "hailing a taxi should be fully animated, and only available when a taxi is close ? and
// they could be already busy and ignore us"). At the kerb (on the street, within KERB_M of the road's
// edge), with a free one coming along the lane on your side (taxiComing(): HAIL_NEAR_M … HAIL_FAR_M off,
// room to stop), T hails it (sim/acts.js affordance 'taxi', hail()): an arm up (the gait 'hail'); it
// brakes, pulls over and stops with its back door by you, and waits (TAXI_WAIT_S). Stopped, it asks
// where to (the bus: 'taxi', destinations()): a few streets off, north or south and along (OFFSETS),
// and the scene's own places if it has some (scenario.destinations?(state): the campaign's flat,
// embassy, safe houses; Blown's car). Told, you get in (board()), its light goes dark, and it pulls
// out with you in it, the picture going with it (RIDE_SHOW_S); then ride(): the minutes on the road
// (PER_ROW_MIN), the clock skipped (sim/game.js skip()), the street there loaded (loadRow()), a taxi
// pulled in at its kerb and you getting out of it (sim/traffic.js dropTaxi()). A taken taxi drives by;
// walk off from one you hailed and it goes. A scene (or a test) may still call a ride straight from
// the kerb with no car in sight: the old way, the wait for one counted in (HAIL_MIN). Whoever
// was following on foot has lost you (an agent's follow, lost); the scene hears of it first
// (scenario.onTaxi?(state, bus, to)): being tailed writes it down if one of them saw you get in, and
// the team's lost; in Blown the driver may have heard the radio.
import { MIN, TICK_MS } from './clock.js';
import { Z } from './map/street.js';
import { int, range, stream } from './rng.js';
import { place, onStreet } from './instinct.js';
import { pay } from './money.js';
import { LANE_Z, laneOf, dropTaxi } from './traffic.js';
import { say } from './log.js';

export const KERB_M = 1.2;
export const HAIL_NEAR_M = 12, HAIL_FAR_M = 90;                 // (a free taxi this far off up the lane: in sight, and room to stop)
export const HAIL_HOLD_S = 5, RIDE_SHOW_S = 3.5, WALK_OFF_M = 6;
export const HAIL_MIN = [1, 4];                                  // (waiting for one to stop)
export const PER_ROW_MIN = 2.5;
export const OFFSETS = [[-2, 'two streets north'], [-4, 'four streets north'], [2, 'two streets south'], [4, 'four streets south']];

/** Whether actor a is at a kerb, where a taxi stops (on the street proper, by the road's edge). */
export function atKerb(state, a) {
  if (state.map.kind !== 'street' || !onStreet(place(state, a))) return false;
  return Math.abs(a.z - Z.kerbN) < KERB_M || Math.abs(a.z - Z.kerbS) < KERB_M;
}

/** The free taxi coming along the lane on actor a's side of the road, in sight and with room to stop for them, or null. */
export function taxiComing(state, a) {
  if (!atKerb(state, a)) return null;
  const lane = Math.abs(a.z - Z.kerbN) < KERB_M ? LANE_Z.north : LANE_Z.south;
  let best = null;
  for (const c of state.traffic?.cars ?? []) {
    if (!c.taxi?.free || c.taxi.hail || c.taxi.drop || Math.abs(c.z - lane) > 1.2) continue;
    const d = (a.x - c.x) * c.dir;                                 // (how far up the lane from you: its way is toward you)
    if (d >= HAIL_NEAR_M && d <= HAIL_FAR_M && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}

/** An arm up at the kerb for the free taxi coming: it's yours to stop for (sim/traffic.js). Whether one was. */
export function hail(state, bus, me) {
  const c = taxiComing(state, me);
  if (!c) { say(state, bus, { kind: 'instinct', text: 'No taxi coming with its light on.' }); return false; }
  c.taxi.hail = { x: me.x, by: me.id };
  const face = Math.abs(me.z - Z.kerbN) < KERB_M ? 'down' : 'up';
  me.busy = { what: 'hail', steps: [['wait', Math.round(HAIL_HOLD_S * 1000 / TICK_MS), face, 'hail']], wait: 0 };
  say(state, bus, { kind: 'note', text: 'An arm up at the kerb. The taxi\'s indicator blinks.' });
  return true;
}

/** The taxi hailed by me that's stopped for me, or null. */
export const cabFor = (state, me) => state.traffic?.cars.find(c => c.taxi?.hail?.by === me.id && c.taxi.stopped) ?? null;
/** The taxi hailed by me (stopped or not), or null. */
export const hailedBy = (state, me) => state.traffic?.cars.find(c => c.taxi?.hail?.by === me.id) ?? null;

/** In you get: the light goes dark, and it pulls out with you in the back (you ride with it a moment: rideTick()). */
export function board(state, bus, me, c, to) {
  say(state, bus, { kind: 'note', text: `In the back. ${to.label.charAt(0).toUpperCase() + to.label.slice(1)}, you tell him, and he pulls out.` });
  c.taxi = { free: false, fare: true };
  Object.assign(me, { hidden: true, vx: 0, vz: 0, busy: null, glass: false, cab: { car: c.id, to, since: state.time.ms } });
}

/** Each tick in a taxi: with it as it goes; then the ride (a taxi gone from the road, or RIDE_SHOW_S up). Returns the minutes, when it's over. */
export function rideTick(state, bus, me, { scenario, skip, loadRow }) {
  const k = me.cab, c = state.traffic?.cars.find(o => o.id === k.car);
  if (c) Object.assign(me, { x: c.x, z: c.z });
  if (c && state.time.ms - k.since < RIDE_SHOW_S * 1000) return null;
  me.cab = undefined; me.hidden = false;
  return ride(state, bus, k.to, { scenario, skip, loadRow, cab: true });
}

/** Where a taxi from here could go: [{ id, label, row, x, fare (dollars: sim/money.js) }]. */
export function destinations(state, scenario) {
  const me = state.actors.find(a => a.who === state.player), row = state.map.row ?? 0;
  const r = stream('taxi', state.map.seed, row, Math.round(me.x));
  const own = scenario?.destinations?.(state) ?? [];
  return [...own, ...OFFSETS.map(([dr, label]) => ({ id: `off${dr}`, label, row: row + dr, x: me.x + range(r, -120, 120) }))].map(d => ({ ...d, fare: fareOf(row, d.row) }));
}
/** A ride's fare, in dollars: FARE_USD and FARE_PER_ROW_USD a street. */
export const FARE_USD = 4, FARE_PER_ROW_USD = 1.5;
export const fareOf = (from, to) => FARE_USD + Math.abs(to - from) * FARE_PER_ROW_USD;

/** The ride: the wait (if there was no car: cab false), the minutes on the road, the street there, you at its kerb, out of a taxi; followers lost. */
export function ride(state, bus, to, { scenario, skip, loadRow, cab = false }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  const r = stream('ride', state.map.seed, state.time.ms);
  const minutes = (cab ? 0 : HAIL_MIN[0] + int(r, HAIL_MIN[1] - HAIL_MIN[0] + 1)) + Math.abs(to.row - from) * PER_ROW_MIN + 3;
  if (!pay(state, bus, fareOf(from, to.row), 'the fare')) return;  // (sim/money.js)
  scenario?.onTaxi?.(state, bus, to);                             // (the scene's own: who saw you get in, a driver who heard the radio)
  if (state.scenario.outcome) return;
  for (const a of state.actors) if (a.ai?.follow?.id === me.id) a.ai.follow.lost = true;   // (on foot, they can't follow a car)
  skip(state, bus, Math.round(minutes * MIN));
  const z = Z.kerbS + 0.6;
  Object.assign(me, { row: to.row, x: to.x, z, vx: 0, vz: 0, busy: null, glass: false, face: 'down', head: Math.PI / 2 });
  if (to.row !== from) loadRow(state, bus, to.row, to.x, { quiet: true });
  dropTaxi(state, to.x);                                           // (the taxi you got out of, pulling away)
  return minutes;
}
