// TRADECRAFT sim: traffic on the street's road (the user's list: "moving cars"). The engine's, on a
// street (state.traffic: plain data, saved with the game, so a game runs the same across a save and
// a load), and only where the sections are in play: far away, there's no traffic to speak of (the
// scale rule).
//
// The road between the kerbs (Z.kerbN, Z.kerbS) has two lanes, one each way, the city's side of the
// road (its profile's `drive`: on the right, eastbound in the south lane; London on the left); the
// parked cars' strip along the north kerb is the bus's bay at a stop. Cars come in at the upstream
// edge of what's in play, every few seconds by day (GAP_S, by the hour), and go at the other: a make
// and colour of the city's, now and then a taxi, and buses (BUS_SHARE) on the line, which pull in at
// each stop they pass for BUS_DWELL_S. Each tick a car keeps to its lane's speed (VMAX_MS), less what
// it must: the car ahead (a gap of GAP_M behind where it could stop), a zebra with anyone on it or at its kerb
// (they stop for people, every time), anyone on the road in front of it, a bus waiting to pull out
// ahead of it (they let it out); someone stood still in its way a while, it eases round, within its
// lane (SWERVE_M). A bus pulls in at a stop, its doors at the shelter; it pulls out when there's a
// gap; a car passing one in its bay eases toward the middle (PASS_NUDGE_M). It never stops on a
// zebra, and never for someone on the pavement. It brakes at BRAKE_MS2; a
// person who steps out closer than that stops it hard, a horn, and you're shaken (a near miss: the
// player's stress up). Nobody's hit: they're city drivers at 40 km/h.
// The bus you're waiting for (sim/buses.js) is sent for: it comes in time to pull in at the minute,
// and stays (held) until it's taken or let go.
// A taxi (the city's make, TAXI_SHARE of cars) has its light lit when it's free (freeShare(), by the
// hour: fewer at the rushes) and dark when it's taken; a free one hailed (sim/taxi.js hail(): the user,
// 2026-10-27, "hailing a taxi should be fully animated, and only available when a taxi is close ? and
// they could be already busy and ignore us") brakes, eases toward the kerb, and stops with its back
// door by whoever hailed it (c.taxi.stopped), and waits there (TAXI_WAIT_S) until they get in or go;
// a taken one drives by.
import { Z } from './map/street.js';
import { townOf, cityOf } from './cities/index.js';
import { TICK_MS, hourOfDay, SEC } from './clock.js';
import { stream, range, chance, pick, weighted, int } from './rng.js';
import { say } from './log.js';
import { strain } from './needs.js';

export const LANE_Z = { north: 2.6, south: 5.1 };
export const BAY_Z = 0.85;                                         // (pulled in to the kerb, in the parked cars' strip)
export const PASS_NUDGE_M = 0.5;                                   // (a car passing a bus in its bay eases toward the middle of the road)
export const VMAX_MS = [9, 12.5];                                  // (32–45 km/h)
export const BUS_MS = 9;
export const ACCEL_MS2 = 2.2, BRAKE_MS2 = 4.5, HARD_MS2 = 9;
export const GAP_M = 2;
export const BUS_SHARE = 0.07, TAXI_SHARE = 0.12;
export const BUS_DWELL_S = 6;
export const TAXI_WAIT_S = 25, TAXI_KERB_M = 0.7, DROP_S = 3;                 // (a hailed taxi waits this long; eased this far from its lane's middle toward the kerb)
export const HOLD_S = 22;                                          // (the one sent for: its doors open while you choose, sim/buses.js DWELL_S, and a little)
export const NEAR_MISS_S = 20;
export const ZEBRA_STOP_M = 1.2;                                   // (the car's front this far short of the stripes)
export const DOOR_M = 1.4;                                         // (a bus's front doors, behind its nose)
export const TOUCH_M = 0.2;
export const SWERVE_M = 0.5, SWERVE_AFTER_S = 2;                   // (round someone stood in its way: no further, or it's in the other lane)                                        // (beside it, closer than this: touching; people stop a body's radius off it, 0.25: sim/world.js)
const DT = TICK_MS / 1000;

/** The share of taxis that are free at this hour: fewer at the rushes, more in the small hours. */
export function freeShare(ms) {
  const h = hourOfDay(ms);
  return (h >= 7 && h < 10) || (h >= 17 && h < 20) ? 0.35 : h >= 10 && h < 17 ? 0.55 : h >= 20 ? 0.5 : 0.7;
}

/** Seconds between cars, each way, at this hour (busy by day, a trickle at night). */
export function gapS(ms) {
  const h = hourOfDay(ms);
  return h >= 7 && h < 20 ? 8 : h >= 20 && h < 23 ? 13 : h >= 6 && h < 7 ? 16 : 32;
}

/** The lane a car going dir (+1 east) keeps to, in this city. */
export const laneOf = (state, dir) => ((cityOf(townOf(state.map)).drive === 'left') === (dir > 0) ? LANE_Z.north : LANE_Z.south);

/** The way buses go along the north kerb, where the stops are. */
export const busDir = (state) => (laneOf(state, 1) === LANE_Z.north ? 1 : -1);

const T = (state) => state.traffic;

/** Fresh traffic for the street in play: a car here and there, already on its way. */
export function resetTraffic(state) {
  const W = state.$world;
  state.traffic = { cars: [], n: 0, next: { 1: 0, [-1]: 0 }, row: state.map.row ?? 0, nearMiss: -1e12 };
  if (state.map.kind !== 'street' || !W) return;
  const r = stream('traffic-start', state.map.seed, state.map.row ?? 0), [x0, x1] = W.bx;
  for (const dir of [1, -1]) for (let x = x0 + range(r, 4, 20); x < x1 - 6; x += gapS(state.time.ms) * VMAX_MS[0] * range(r, 0.7, 1.6)) spawn(state, dir, x);
}

function spawn(state, dir, x, opts = {}) {
  const t = T(state), P = cityOf(townOf(state.map)), r = stream('traffic', state.map.seed, t.row, t.n);
  const bus = opts.bus ?? (chance(r, BUS_SHARE) && dir === busDir(state));
  const kind = opts.kind ?? (bus ? 'bus' : chance(r, TAXI_SHARE) ? P.taxi : weighted(r, P.LOOKS.car));
  const len = bus ? (P.bus?.len ?? 11) : kind === 'van' ? 4.8 : 4.2, w = bus ? (P.bus?.kind === 'van' ? 1.95 : 2.5) : 1.8;
  const c = { id: `v${t.n++}`, kind, color: pick(r, P.carColours), seed: int(r, 1000), dir, x, z: laneOf(state, dir), len, w, v: bus ? BUS_MS : range(r, VMAX_MS[0], VMAX_MS[1]),
    vmax: bus ? BUS_MS : range(r, VMAX_MS[0], VMAX_MS[1]), px: x, pz: laneOf(state, dir), ...(bus ? { bus: { served: [] } } : {}), ...opts.extra };
  // (a taxi: its light lit or not, from a stream of its own, so nothing else on the road moves)
  if (kind === P.taxi && !c.taxi) c.taxi = { free: chance(stream('taxi-light', state.map.seed, t.row, c.id), freeShare(state.time.ms)) };
  t.cars.push(c);
  return c;
}

/** Send a bus to this stop, to pull in at `at` and stay until let go (sim/buses.js). Its id. */
export function sendBus(state, stop, at) {
  const t = T(state);
  if (!t || state.map.kind !== 'street') return null;
  const dir = busDir(state), [x0, x1] = state.$world.bx, from = dir > 0 ? x0 + 2 : x1 - 2;
  if ((dir > 0 && from > stop.x - 30) || (dir < 0 && from < stop.x + 30)) return null;   // (no road behind it in play: sim/buses.js waits on the clock)
  if (t.cars.some(c => c.dir === dir && Math.abs(c.x - from) < 14)) return null;          // (no room at the edge yet: asked again)
  if (onZebra(state, stop, { dir, len: cityOf(townOf(state.map)).bus?.len ?? 11 })) return null;   // (it couldn't pull in there: the clock alone)
  const c = spawn(state, dir, from, { bus: true, extra: { bus: { served: [], hold: stop.x, at } } });
  return c.id;
}

/** A free taxi sent along the lane toward x, from the upstream edge (the scenes', and the tests'): the car, or null if there's no room. */
export function sendTaxi(state, dir = 1) {
  const t = T(state);
  if (!t || state.map.kind !== 'street') return null;
  const [x0, x1] = state.$world.bx, from = dir > 0 ? x0 + 2 : x1 - 2;
  if (t.cars.some(c => c.dir === dir && Math.abs(c.x - from) < 14)) return null;
  return spawn(state, dir, from, { bus: false, kind: cityOf(townOf(state.map)).taxi, extra: { taxi: { free: true } } });
}

/** The taxi you've just got out of, stopped at the south kerb by x, its light dark; it goes in a moment, free again. */
export function dropTaxi(state, x) {
  if (state.map.kind !== 'street' || !state.$world) return null;
  if (!T(state) || T(state).row !== (state.map.row ?? 0)) resetTraffic(state);
  const dir = laneOf(state, 1) === LANE_Z.south ? 1 : -1, t = T(state);
  t.cars = t.cars.filter(o => !(o.dir === dir && Math.abs(o.x - x) < 7));   // (room for it at the kerb)
  const c = spawn(state, dir, x + dir * 0.6, { bus: false, kind: cityOf(townOf(state.map)).taxi, extra: { taxi: { free: false, drop: state.time.ms + DROP_S * SEC } } });
  Object.assign(c, { v: 0, z: LANE_Z.south + TAXI_KERB_M, pz: LANE_Z.south + TAXI_KERB_M });
  return c;
}

/** How long a bus sent from its edge takes to the stop, in ms. */
export function busLeadMs(state, stop) {
  const dir = busDir(state), [x0, x1] = state.$world?.bx ?? [stop.x - 100, stop.x + 100];
  return (Math.abs(stop.x - (dir > 0 ? x0 + 2 : x1 - 2)) / (BUS_MS * 0.55) + 4) * SEC;   // (time for the zebras on the way: early, it waits at the stop)
}

/** How far a body of radius r at (x, z) is into a car (0: clear of them all). */
export function carDepth(state, x, z, r = 0.25) {
  const t = T(state);
  if (!t || (state.map && state.map.kind !== 'street') || z < Z.kerbN - 1 || z > Z.kerbS + 1) return 0;   // (indoors, the street's cars are nowhere: a flat's floor shares their z)
  let deep = 0;
  for (const c of t.cars) {
    const cx = Math.max(c.x - c.len / 2, Math.min(x, c.x + c.len / 2)), cz = Math.max(c.z - c.w / 2, Math.min(z, c.z + c.w / 2));
    const d = Math.hypot(cx - x, cz - z), inside = x > c.x - c.len / 2 && x < c.x + c.len / 2 && z > c.z - c.w / 2 && z < c.z + c.w / 2;
    deep = Math.max(deep, inside ? r + Math.min(x - (c.x - c.len / 2), c.x + c.len / 2 - x, z - (c.z - c.w / 2), c.z + c.w / 2 - z) : r - d);
  }
  return deep;
}
/** Whether a step from (x0, z0) to (x, z) would take a body into a car, or further in (people walk round them: sim/world.js move(), sim/agents.js). */
export const intoCar = (state, x0, z0, x, z) => { const d = carDepth(state, x, z); return d > 0 && d > carDepth(state, x0, z0) + 1e-6; };
/** The car such a step would take a body into, or null. */
export function carInWay(state, x0, z0, x, z) {
  if (!intoCar(state, x0, z0, x, z)) return null;
  let best = null, deep = 0;
  for (const c of T(state).cars) { const d = carDepth({ traffic: { cars: [c] } }, x, z); if (d > deep) { deep = d; best = c; } }
  return best;
}

/** The car by id, or null. */
export const carOf = (state, id) => T(state)?.cars.find(c => c.id === id) ?? null;

/** Whether the bus sent for the stop is pulled in at it. */
export const pulledIn = (state, id) => { const c = carOf(state, id); return !!c?.bus?.stopped && c.bus.hold !== null && Math.abs(c.bus.bayX - c.bus.hold) < 0.5; };

/** Let it go: the doors close, and on. */
export function release(state, id) { const b = carOf(state, id)?.bus; if (b) { b.hold = null; b.until = 0; } }

/** Whether someone at a zebra holds a car in the lane at z: on the road in or near its lane, or heading into it; at the kerb, stepping off. */
function holds(a, z) {
  const into = Math.sign(z - a.z) === Math.sign(a.vz) && Math.abs(a.vz) > 0.2;
  if (a.z > Z.kerbN && a.z < Z.kerbS) return Math.abs(a.z - z) < 2.2 || into;
  return into && (a.z > Z.kerbN - 0.5 && a.z < Z.kerbS + 0.5);
}

/** Whether a bus pulled in at this stop would stand on a zebra (the next section's: this one's keeps clear, sim/map/street.js). */
function onZebra(state, stop, c) {
  const nose = stop.x + c.dir * DOOR_M, tail = nose - c.dir * c.len, lo = Math.min(nose, tail) - 1, hi = Math.max(nose, tail) + 1;
  for (const S of state.$world.sections.values()) for (const zb of S.crossings) if (zb.x1 > lo && zb.x0 < hi) return true;
  return false;
}

/** Each tick on a street: cars in, cars on, cars out. */
export function trafficTick(state, bus) {
  if (state.map.kind !== 'street' || !state.$world) return;
  if (!T(state) || T(state).row !== (state.map.row ?? 0)) resetTraffic(state);
  const t = T(state), now = state.time.ms, [x0, x1] = state.$world.bx;
  // In at the upstream edges, when there's room.
  for (const dir of [1, -1]) {
    if (now < t.next[dir]) continue;
    const from = dir > 0 ? x0 + 2 : x1 - 2;
    if (t.cars.some(c => c.dir === dir && Math.abs(c.x - from) < 14)) continue;
    spawn(state, dir, from);
    t.next[dir] = now + gapS(now) * range(stream('traffic-gap', state.map.seed, t.n), 0.5, 1.6) * SEC;
  }
  const row = state.map.row ?? 0, people = state.actors.filter(a => !a.hidden && (a.row ?? row) === row && a.z > Z.kerbN - 0.9 && a.z < Z.kerbS + 0.9);   // (on this street: an agent on another walks there, unseen)
  const zebras = [];
  for (const S of state.$world.sections.values()) for (const c of S.crossings) zebras.push(c);
  const me = state.actors.find(a => a.who === state.player);
  for (const c of t.cars) {
    c.px = c.x; c.pz = c.z;
    const front = c.x + c.dir * c.len / 2, ahead = (x) => (x - front) * c.dir;   // (how far in front of its nose)
    let stopAt = Infinity, shaken = null, why = null;
    const hold = (d, what) => { if (d < stopAt) { stopAt = d; why = what; } };
    // The car in front, in its lane: room to stop behind wherever it could stop (its own braking ahead
    // of it), less a gap and a moment's reaction.
    for (const o of t.cars) if (o !== c && o.dir === c.dir && Math.abs(o.z - c.z) < (o.w + c.w) / 2 + 0.05) {
      const d = ahead(o.x - o.dir * o.len / 2);
      if (d > -0.5 && d < 80) hold(d - GAP_M + o.v * o.v / (2 * BRAKE_MS2) - c.v * 0.4, o.id);
    }
    // A zebra with someone on it in its lane or coming into it, or stepping off the kerb onto it
    // (someone past its lane, walking away, doesn't hold it; nor someone walking by along the pavement).
    // And never stops on one: no room past it, behind the car in front, it waits at the line.
    for (const zb of zebras) {
      const line = c.dir > 0 ? zb.x0 - ZEBRA_STOP_M : zb.x1 + ZEBRA_STOP_M, d = ahead(line);
      if (d < -0.3 || d > 45) continue;
      const p = people.find(a => a.x > zb.x0 - 0.6 && a.x < zb.x1 + 0.6 && holds(a, c.z));
      if (p) { hold(d, `zebra:${p.id}`); continue; }
      const past = ahead(c.dir > 0 ? zb.x1 + 0.3 : zb.x0 - 0.3) + c.len + GAP_M;   // (its nose this far on, its tail clear of the stripes)
      const lead = t.cars.find(o => o !== c && o.dir === c.dir && Math.abs(o.z - c.z) < (o.w + c.w) / 2 + 0.05 && ahead(o.x - o.dir * o.len / 2) > -0.5 && ahead(o.x - o.dir * o.len / 2) < past && o.v < 2);
      if (lead) hold(d, `box:${lead.id}`);
    }
    // Anyone in the road in front of it, in its way or stepping into it (or touching its body: it stops
    // dead). Someone stood beside it, clear of it, or stood at its lane's edge waiting for a gap, holds
    // nobody: they wait for it to go by (sim/world.js move(), sim/agents.js).
    for (const a of people) {
      if (a.z < Z.kerbN || a.z > Z.kerbS) continue;                // (on the pavement: never in a car's way, not even a bus's at its kerb)
      const d = ahead(a.x), dz = Math.abs(a.z - c.z), stepping = Math.sign(c.z - a.z) === Math.sign(a.vz) && Math.abs(a.vz) > 0.2;
      if (d < -c.len + 0.3 || d > 40 || dz > (d < 0 ? c.w / 2 + TOUCH_M : stepping ? c.w / 2 + 0.6 : c.w / 2 + 0.3)) continue;   // (behind its tail: it's going away from them)
      const room = d - 1.2;
      if (room < 0) { hold(-1, a.id); if (a === me) shaken = a; continue; }
      if (c.v * c.v / (2 * HARD_MS2) > room && c.v > 3 && a === me) shaken = a;
      hold(room, a.id);
    }
    // A bus waiting to pull out of its bay, just ahead: let it out.
    for (const o of t.cars) if (o.bus?.leaving && o.dir === c.dir && !c.bus) { const d = ahead(o.x - o.dir * o.len / 2); if (d > 0.5 && d < 15) hold(d - 3, `out:${o.id}`); }   // (well back: room for it to pull out; one already alongside goes by)
    // A bus: in at each stop it passes (the one sent for: held there till let go).
    if (c.bus) busStops(state, t, c, ahead, (d) => hold(d, 'stop'));
    if (c.taxi?.hail) taxiStop(state, c, ahead, (d) => hold(d, 'hail'));
    if (c.taxi?.drop) { if (now < c.taxi.drop) hold(-1, 'drop'); else c.taxi = { free: true }; }   // (you out, it goes, its light lit)
    c.held = why;                                                  // (what holds it, if anything: a car's id, zebra:<id>, someone's id, out:<bus>, stop)
    // (held a while by someone stood still in its way: it eases round them, within its lane)
    const holder = why && people.find(a => a.id === why);
    if (holder && Math.hypot(holder.vx, holder.vz) < 0.2) { c.heldSince ??= now; if (now - c.heldSince > SWERVE_AFTER_S * SEC) c.swerve = (c.z >= holder.z ? 1 : -1) * SWERVE_M; }
    else { c.heldSince = undefined; if (!holder && c.swerve && !people.some(a => Math.abs(a.z - c.z) < c.w / 2 + 0.6 && Math.abs(a.x - c.x) < c.len / 2 + 2)) c.swerve = 0; }
    // The speed it may go to stop in what room it has; brake (hard if it must), or pick up speed.
    const may = stopAt === Infinity ? c.vmax : stopAt <= 0 ? 0 : Math.min(c.vmax, Math.sqrt(2 * BRAKE_MS2 * stopAt));
    c.v = may < c.v ? Math.max(may, c.v - (stopAt < c.v * c.v / (2 * BRAKE_MS2) ? HARD_MS2 : BRAKE_MS2) * DT) : Math.min(may, c.v + ACCEL_MS2 * DT);
    if (stopAt <= 0) c.v = 0;
    c.x += c.dir * c.v * DT;
    // (a bus eases into the bay for its stop, and out again; a car passing one in its bay, out a little toward the middle)
    const lane = laneOf(state, c.dir), byBus = !c.bus && lane === LANE_Z.north && t.cars.some(o => o.bus && o.z < LANE_Z.north - 0.5 && Math.abs(o.x - c.x) < (o.len + c.len) / 2 + 3);
    const kerbward = lane === LANE_Z.north ? -TAXI_KERB_M : TAXI_KERB_M;   // (a hailed taxi pulls over toward its kerb)
    const zWant = c.bus?.bayX !== undefined && Math.abs(c.bus.bayX - c.x) < 18 ? BAY_Z : (c.taxi?.hail && Math.abs(c.taxi.hail.x - c.x) < 25) || c.taxi?.drop ? lane + kerbward : byBus ? lane + PASS_NUDGE_M : lane + (c.swerve ?? 0);
    c.z += Math.sign(zWant - c.z) * Math.min(Math.abs(zWant - c.z), 1.1 * DT);
    if (shaken && now - t.nearMiss > NEAR_MISS_S * SEC) {
      t.nearMiss = now;
      say(state, bus, { kind: 'note', text: c.kind === 'bus' ? 'Air brakes, a horn like a ship\'s: the bus stops a yard from you. The driver\'s face says the rest.' : 'Brakes, a horn: the car stops a foot from your knees. The driver says what he thinks of you through the glass.' });
      strain(state, bus, 8);
    }
  }
  // Out at the downstream edges.
  t.cars = t.cars.filter(c => (c.dir > 0 ? c.x - c.len < x1 + 4 : c.x + c.len > x0 - 4));
}

/**
 * A hailed taxi: its back door by whoever hailed it (its middle a little past them), braking for it, and
 * stopped there (c.taxi.stopped) until TAXI_WAIT_S is up or it's let go (sim/taxi.js). One too close to
 * stop in time, or past them already, drives on.
 */
function taxiStop(state, c, ahead, stopAt) {
  const h = c.taxi.hail, now = state.time.ms, d = ahead(h.x + c.dir * (c.len / 2 - 0.9));
  if (c.taxi.stopped) {
    if (now - c.taxi.stopped < TAXI_WAIT_S * SEC) return stopAt(-1);
    c.taxi.hail = null; c.taxi.stopped = 0; return;
  }
  if (d < -0.5 || (d < c.v * c.v / (2 * HARD_MS2) && c.v > 2)) { c.taxi.hail = null; return; }   // (too late to stop: on it goes)
  stopAt(d);
  if (d < 0.3 && c.v < 0.3) c.taxi.stopped = now;
}

/** A bus's stops: the next one ahead on its kerb, pulled in at for BUS_DWELL_S (or held, if it's the one sent for). */
function busStops(state, t, c, ahead, stopAt) {
  const b = c.bus, now = state.time.ms;
  const held = b.hold !== null && b.hold !== undefined;
  if (b.stopped) {
    if (now < b.until) { stopAt(-1); return; }
    // (out of the bay when there's a gap in the lane beside it and behind)
    // (alongside it, or coming up behind and not slowing for it: wait; those holding back for it let it out)
    const beside = (o) => Math.abs(o.x - c.x) < (o.len + c.len) / 2, coming = (o) => (o.x - c.x) * c.dir < 0 && (c.x - o.x) * c.dir < (o.len + c.len) / 2 + 10 && o.v > 2;
    if (t.cars.some(o => o !== c && o.dir === c.dir && o.z > BAY_Z + 1 && (beside(o) || coming(o)))) { b.leaving = true; stopAt(-1); return; }
    b.leaving = false;
    b.stopped = false; b.served.push(Math.round(b.bayX)); b.bayX = undefined; b.hold = null;
  }
  // (the next stop ahead on its kerb; the one sent for, only that one)
  let next = null;
  for (const S of state.$world.sections.values()) for (const p of S.props) if (p.kind === 'stop' && !b.served.includes(Math.round(p.x)) && (!held || Math.abs(p.x - b.hold) < 0.5) && !onZebra(state, p, c)) {
    const d = ahead(p.x + c.dir * DOOR_M);                          // (its front doors at the shelter)
    if (d > -0.5 && (!next || d < next.d)) next = { d, x: p.x };
  }
  if (!next || next.d > 60) return;
  b.bayX = next.x;
  stopAt(next.d);
  if (next.d < 0.3 && c.v < 0.3) { b.stopped = true; b.until = now + (held ? HOLD_S : BUS_DWELL_S) * SEC; }
}
