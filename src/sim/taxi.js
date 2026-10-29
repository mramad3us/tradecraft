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
// the kerb with no car in sight: the old way, the wait for one counted in (HAIL_MIN). The scene hears
// of it first (scenario.onTaxi?(state, bus, to)): being tailed writes it down if one of them saw you
// get in; in Blown the driver may have heard the radio; and again once you're out ('out').
// **Follow that cab** (chase(); DESIGN.md, Being tailed: "still to come: … cabs"). Whoever was
// following you on foot and saw you get in (watching(): within CHASE_SEE_M, you in sight) needs a cab
// of their own: one comes along free at the hour's share (sim/traffic.js freeShare()) × CAB_FLAG (a
// team's own car is always there); then the ride is one roll (keeps()): their Tracking against the
// driver's way through the traffic (DRIVER), or, if you told him to lose anyone behind (to.lose:
// LOSE_USD and LOSE_MIN more), your Pathfinding +LOSE_MOD, eyes on the back window, saying where to
// turn (badly told, worse than his way). Yours +RUSH_MOD in the rush hours' traffic, +1 a street past
// the second; theirs +NIGHT_MOD on the night's empty roads. Lost, lost. Kept, their car comes along the lane a few seconds after yours
// and stops CHASE_BACK_M behind where you got out (behind(), chaseTick()), and they get out and follow
// on: a cab pulling in behind yours is the tell. Being tailed's team goes the same way (its covert
// car, or an overt pair's cab: sim/scenarios/sdr.js onTaxi()).
import { MIN, TICK_MS, SEC, calendar } from './clock.js';
import { Z } from './map/street.js';
import { int, range, stream, chance } from './rng.js';
import { place, onStreet } from './instinct.js';
import { pay } from './money.js';
import { LANE_Z, laneOf, dropTaxi, freeShare, sendFare, DROP_S } from './traffic.js';
import { say } from './log.js';
import { opposed } from './checks.js';
import { skill } from './skills.js';
import { seesActor } from './perception.js';
import { RUSH_H } from './metro.js';

export const KERB_M = 1.2;
export const HAIL_NEAR_M = 12, HAIL_FAR_M = 90;                 // (a free taxi this far off up the lane: in sight, and room to stop)
export const HAIL_HOLD_S = 5, RIDE_SHOW_S = 3.5, WALK_OFF_M = 6;
export const HAIL_MIN = [1, 4];                                  // (waiting for one to stop)
export const PER_ROW_MIN = 2.5;
export const OFFSETS = [[-2, 'two streets north'], [-4, 'four streets north'], [2, 'two streets south'], [4, 'four streets south']];
export const CHASE_SEE_M = 30, CAB_FLAG = 0.8, DRIVER = 14, LOSE_MOD = 6, LOSE_USD = 5, LOSE_MIN = 3, RUSH_MOD = 2, NIGHT_MOD = 2;
export const CHASE_BACK_M = [25, 45], CHASE_WAIT_S = 45;          // (stopped this far behind where you got out; out of it by then, car or not)

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
  say(state, bus, { kind: 'note', text: `In the back. ${to.label.charAt(0).toUpperCase() + to.label.slice(1)}${to.lose ? ', the long way round, and lose anyone behind us' : ''}, you tell him, and he pulls out.` });
  const seen = watching(state, me);                               // (who saw you get in: before you're out of sight in the back)
  c.taxi = { free: false, fare: true };
  Object.assign(me, { hidden: true, vx: 0, vz: 0, busy: null, glass: false, cab: { car: c.id, to, since: state.time.ms, seen } });
}

/** Each tick in a taxi: with it as it goes; then the ride (a taxi gone from the road, or RIDE_SHOW_S up). Returns the minutes, when it's over. */
export function rideTick(state, bus, me, { scenario, skip, loadRow }) {
  const k = me.cab, c = state.traffic?.cars.find(o => o.id === k.car);
  if (c) Object.assign(me, { x: c.x, z: c.z });
  if (c && state.time.ms - k.since < RIDE_SHOW_S * 1000) return null;
  me.cab = undefined; me.hidden = false;
  return ride(state, bus, k.to, { scenario, skip, loadRow, cab: true, seen: k.seen });
}

/** The ride: the wait (if there was no car: cab false), the minutes on the road, the street there, you at its kerb, out of a taxi; whoever followed on foot lost, unless they caught a cab and kept yours (chase()). */
export function ride(state, bus, to, { scenario, skip, loadRow, cab = false, seen = null }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  const r = stream('ride', state.map.seed, state.time.ms);
  const minutes = (cab ? 0 : HAIL_MIN[0] + int(r, HAIL_MIN[1] - HAIL_MIN[0] + 1)) + Math.abs(to.row - from) * PER_ROW_MIN + 3 + (to.lose ? LOSE_MIN : 0);
  if (!pay(state, bus, fareOf(from, to.row) + (to.lose ? LOSE_USD : 0), 'the fare')) return;  // (sim/money.js)
  scenario?.onTaxi?.(state, bus, to);                             // (the scene's own: who saw you get in, a driver who heard the radio)
  if (state.scenario.outcome) return;
  const kept = chase(state, me, to, from, seen ?? watching(state, me));
  skip(state, bus, Math.round(minutes * MIN));
  const z = Z.kerbS + 0.6;
  Object.assign(me, { row: to.row, x: to.x, z, vx: 0, vz: 0, busy: null, glass: false, face: 'down', head: Math.PI / 2 });
  for (const a of kept) Object.assign(a, { row: to.row, x: to.x, z, vx: 0, vz: 0, hidden: true });   // (in the car behind: out of it soon, behind())
  if (to.row !== from) loadRow(state, bus, to.row, to.x, { quiet: true });
  dropTaxi(state, to.x);                                           // (the taxi you got out of, pulling away)
  behind(state, kept);
  scenario?.onTaxi?.(state, bus, to, 'out');                      // (out: the scene's own who kept up, being tailed's)
  return minutes;
}

/** Whoever's following you that sees you get in, now (within CHASE_SEE_M, you in sight): their ids. */
export const watching = (state, me) => state.actors.filter(a => a.ai?.follow?.id === me.id && !a.ai.follow.lost && !a.hidden && Math.hypot(a.x - me.x, a.z - me.z) <= CHASE_SEE_M && seesActor(state, a, me)).map(a => a.id);

/**
 * Whether a car behind keeps yours in sight to the end of the ride (from row → to.row): their Tracking
 * (them: a sheet) against the driver's way through the traffic, or, told to lose them (to.lose), your
 * Pathfinding +LOSE_MOD.
 */
export function keeps(state, them, to, from) {
  const k = calendar(state.time.ms), h = k.hour + k.minute / 60, you = state.people[state.player], streets = Math.abs(to.row - from);
  const rush = k.weekday < 5 && RUSH_H.some(([a, b]) => h >= a && h < b), night = h >= 22 || h < 6;
  const mods = [rush && { why: 'the rush hour\'s traffic', v: RUSH_MOD }, streets > 2 && { why: 'more lights, more turns', v: streets - 2 }].filter(Boolean);
  const ours = to.lose ? { skill: 'pathfinding', value: skill(you, 'pathfinding'), body: you, mods: [{ why: 'told to lose them', v: LOSE_MOD }, ...mods] } : { skill: 'pathfinding', value: DRIVER, mods };
  const r = opposed(state.rng, ours, { skill: 'tracking', value: skill(them, 'tracking'), body: them, mods: night ? [{ why: 'the night\'s empty roads', v: NIGHT_MOD }] : [] });
  return !r.ok;
}

/** Whoever was following you on foot: those who saw you get in (seen: ids), found a free cab and kept yours to the end ([actors]); the rest lost. */
export function chase(state, me, to, from, seen) {
  const out = [];
  for (const a of state.actors) {
    const f = a.ai?.follow, them = state.people[a.who];
    if (f?.id !== me.id || f.lost) continue;
    if (them && seen.includes(a.id) && chance(state.rng, freeShare(state.time.ms) * CAB_FLAG) && keeps(state, them, to, from)) out.push(a);
    else f.lost = true;
  }
  return out;
}

/**
 * The car after yours, on this street (you just out of yours): its people out of sight in it till it's
 * sent along the lane and stops CHASE_BACK_M behind you (chaseTick()). plain: a team's own car, not a taxi.
 */
export function behind(state, actors, { plain = false } = {}) {
  if (!actors.length) return;
  if (!state.$world) { for (const a of actors) a.hidden = false; return; }   // (no street to drive along: out at once, where they are)
  const me = state.actors.find(a => a.who === state.player), dir = laneOf(state, 1) === LANE_Z.south ? 1 : -1, [x0, x1] = state.$world.bx;
  const x = Math.min(x1 - 4, Math.max(x0 + 4, me.x - dir * range(state.rng, ...CHASE_BACK_M))), until = state.time.ms + CHASE_WAIT_S * SEC;
  for (const a of actors) { Object.assign(a, { row: state.map.row ?? 0, x, z: Z.kerbS + 0.6, vx: 0, vz: 0, gait: 'idle', hidden: true }); a.ai.downUntil = until; }
  (state.chase ??= []).push({ ids: actors.map(a => a.id), row: state.map.row ?? 0, x, plain, until, car: null });
}

/** Once a second: the car after yours sent along the lane (room at the edge permitting); stopped, its people out at its back door; CHASE_WAIT_S up, out anyway. */
export function chaseTick(state) {
  if (!state.chase?.length) return;
  const now = state.time.ms;
  state.chase = state.chase.filter(k => {
    const who = k.ids.map(id => state.actors.find(a => a.id === id)).filter(Boolean);
    let c = k.car && state.traffic?.cars.find(o => o.id === k.car);
    if (!k.car && k.row === (state.map.row ?? 0)) { c = sendFare(state, k.x, k.plain); if (c) k.car = c.id; }
    const there = !!c?.taxi?.stopped;
    if (!there && now < k.until && who.length) return true;
    if (there) c.taxi = { free: false, plain: k.plain, drop: now + DROP_S * SEC };   // (they're out: it goes)
    who.forEach((a, n) => {
      Object.assign(a, { x: k.x + (n ? 0.5 : 0) * (n % 2 ? 1 : -1), hidden: false, gait: 'idle' });
      Object.assign(a.ai, { downUntil: 0, outOfCab: now, seenMs: now });
      if (a.ai.follow) Object.assign(a.ai.follow, { trail: [], seenMs: now, contactUntil: now + 8000, search: 0 });
    });
    return false;
  });
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

