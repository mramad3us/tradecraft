// TRADECRAFT sim: passers-by round someone down (the user, 2026-11-04, of passers-by walking over a police officer
// bleeding on the pavement: "they seem to not care about stepping over a cop that is bleeding out, they would either
// steer wide away, or pool around the bodies with their phones out, looking around them until emergency services
// establish a cordon").
//
// A passer-by on the street in play looks once a second (see(), from sim/agents.js stepAgent(), each on a tick of
// its own so the crowd's spread over the second; a spatial query, NOTICE_M round them) for a casualty (sim/health.js
// casualty(): dead, down, sat against a wall shot) they can see, and makes up their mind about it once (ai.saw), on
// dice of their own (a stream by their seed and the casualty's id):
//   - GATHER_P of them, if it lies still, come to look (ai.look): to a spot of their own in a loose ring round it,
//     RING_M off (on the pavement, clear of the street's things and of the others, at most RING_MAX of them), and
//     stand there, PHONE_P of them with a phone out, filming or calling, the rest looking at it and about them (a
//     glance round every GLANCE_S); they go on their way again (their own route, from where they stand) after
//     ONLOOK_S, or once the police tape's up round it (state.cordons: sim/emergency.js), or it's gone (taken off,
//     up and walked away);
//   - the rest give it a wide berth: if their way comes within CLEAR_M of it in the next LOOK_AHEAD_M, they step
//     round it on the far side of the pavement (sim/agents.js's detour, PAST_M either side of it), or, where the
//     pavement's too narrow to pass it MIN_CLEAR_M off, turn back the way they came.
// Whoever's running from the shots (fled in the last FLED_S, or hurrying), hurt themselves, or busy at a stop doesn't
// stop to look. The 999 call itself is sim/emergency.js's (its caller stands on the phone, then comes back to this).
import { townOf } from './cities/index.js';
import { routeFrom, placeAt, clearAt, LINE } from './city.js';
import { Z } from './map/street.js';
import { near } from './world.js';
import { seesActor, faceOf } from './perception.js';
import { casualty } from './health.js';
import { stream, chance, range, hash } from './rng.js';
import { TICK_MS } from './clock.js';
import { PLANNERS } from './agents.js';                              // (used in functions only: agents.js imports this module)

export const NOTICE_M = 12, GATHER_P = 0.4, PHONE_P = 0.5, RING_M = [2.2, 3.4], RING_ARC = 1.4, RING_MAX = 8, ONLOOK_S = [90, 300], GLANCE_S = 4;
export const CLEAR_M = 2, MIN_CLEAR_M = 1.2, LOOK_AHEAD_M = 12, PAST_M = 2.5, STEP_OFF_M = 2.5, FLED_S = 30, TURN_BACK_M = 80;
const TPS = 1000 / TICK_MS;
// (each pavement's walkable band across, for stepping round and standing about: the far pavement, the near one, the path, the south walk)
export const BAND = { F: [Z.front + 0.4, Z.kerbN - 0.4], N: [Z.kerbS + 0.4, Z.fence - 0.4], P: [Z.pathN + 0.3, Z.pathS - 0.3], S: [Z.roadS + 0.4, Z.south - 0.4] };
const lineNear = (z) => Object.keys(LINE).reduce((b, k) => (Math.abs(LINE[k] - z) < Math.abs(LINE[b] - z) ? k : b), 'F');
const rowOf = (state, a) => a.row ?? state.map.row ?? 0;
const actor = (state, id) => state.actors.find(o => o.id === id);
const taped = (state, row, x, z) => (state.cordons ?? []).some(k => k.row === row && k.until > state.time.ms && Math.hypot(k.x - x, k.z - z) < k.r + 1);

/** Whether passer-by a is free to stop and look, or step round: not running from it, not hurt, not at a stop. */
const free = (state, a) => !a.hidden && !a.ai.hurt && !a.ai.waiting && !a.ai.visit && !a.ai.detour && (a.ai.pace ?? 1) <= 1.3 && !(a.ai.fled > state.time.ms - FLED_S * 1000);

/** Once a second, a passer-by on the street in play: someone down in sight, NOTICE_M off: come to look, or keep clear (see the header). */
export function see(state, a) {
  if (!state.$world || rowOf(state, a) !== (state.map.row ?? 0) || a.ai.look || !free(state, a)) return;
  const row = rowOf(state, a);
  let best = null, bd = Infinity;
  for (const o of near(state, a.x, a.z, NOTICE_M)) {
    if (o === a || o.hidden || !o.who) continue;
    const p = state.people[o.who], d = Math.hypot(o.x - a.x, o.z - a.z);
    if (d < bd && casualty(p, o) && !o.ems && seesActor(state, a, o)) { best = o; bd = d; }
  }
  if (!best) return;
  const still = Math.hypot(best.vx ?? 0, best.vz ?? 0) < 0.1;
  if (a.ai.saw !== best.id) {
    a.ai.saw = best.id;
    const r = stream('onlook', a.seed ?? a.id, best.id);
    const ring = state.actors.filter(x => x.ai?.look?.id === best.id).length;
    if (still && !taped(state, row, best.x, best.z) && ring < RING_MAX && chance(r, GATHER_P) && gather(state, a, best, r)) return;
  }
  keepClear(state, a, best);
}

/** To a spot in the ring round o, and stand there a while (ai.look). False: nowhere to stand, or no way there. */
function gather(state, a, o, r) {
  // (a spot on their side of it, so the way there doesn't go over it: within RING_ARC of the line from it to them)
  const seed = townOf(state.map), row = rowOf(state, a), B = BAND[lineNear(o.z)], R = range(r, ...RING_M), to = Math.atan2(a.z - o.z, a.x - o.x), t0 = range(r, -RING_ARC, RING_ARC);
  const others = state.actors.filter(x => x.ai?.look?.id === o.id);
  for (let k = 0; k < 8; k++) {
    const t = to + Math.max(-RING_ARC, Math.min(RING_ARC, t0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35)), x = o.x + Math.cos(t) * R, z = Math.max(B[0], Math.min(B[1], o.z + Math.sin(t) * R));
    if (Math.hypot(x - o.x, z - o.z) < RING_M[0] - 0.3 || !clearAt(seed, row, x, z, 0.3) || others.some(q => Math.hypot(q.ai.look.x - x, q.ai.look.z - z) < 0.8)) continue;
    // (straight there across the pavement, where that's clear and keeps off it; else by the street's ways)
    const from = { row, x: a.x, z: a.z }, kind = clearWay(seed, row, from, { x, z }) && offSeg(from, { x, z }, o) > MIN_CLEAR_M ? 'straight' : 'way';
    let route;
    try { route = PLANNERS[kind](state, { kind, from, to: { row, x, z } }); } catch { continue; }
    if (passes(route, o, row)) continue;                            // (the way there goes by it too close: another spot)
    const now = state.time.ms;
    a.ai.look = { id: o.id, x, z, ox: o.x, oz: o.z, since: now, until: now + Math.round(range(r, ...ONLOOK_S) * 1000), phone: chance(r, PHONE_P), back: a.ai.plan ?? null };
    Object.assign(a.ai, { plan: { kind, from, to: { row, x, z } }, route: null, $route: route, s: 0, stop: 0, wait: 0, detour: null });
    return true;
  }
  return false;
}

/**
 * An onlooker's tick (sim/agents.js stepAgent()): true if it was had here (stood in the ring); false, walk the way there.
 * The ring broken (the tape up, the time up, it gone), they go on their way again.
 */
export function step(state, a) {
  const L = a.ai.look, o = actor(state, L.id), now = state.time.ms, row = rowOf(state, a);
  const gone = !o || o.hidden || !casualty(state.people[o.who], o) || Math.hypot(o.x - L.ox, o.z - L.oz) > 3;
  if (gone || now >= L.until || taped(state, row, L.ox, L.oz)) { goOn(state, a); return false; }
  const R = a.ai.$route ?? a.ai.route;
  if (!(R ? a.ai.s >= R.length - 1e-6 : Math.hypot(a.x - L.x, a.z - L.z) < 0.2)) return false;
  // (stood there: on the phone, or looking; at it, and now and then round about them)
  a.vx = a.vz = 0; a.gait = L.phone ? 'phone' : 'idle';
  const at = Math.atan2(o.z - a.z, o.x - a.x), k = Math.floor((now - L.since) / (GLANCE_S * 1000));
  const off = !L.phone && hash(a.seed ?? 0, L.id, k) % 3 === 0 ? ((hash(k, a.seed ?? 0) % 1000) / 1000 - 0.5) * 3 : 0;   // (a third of the time, a look round: who else is here, is anyone coming)
  a.head = at + off; a.face = faceOf(a.head);
  return true;
}

/**
 * Off again: a step away from it along their side of the pavement (STEP_OFF_M), then their own way on from there (their
 * plan), or along the street if they had none; if that goes back past it, they keep clear of it as anyone does.
 */
function goOn(state, a) {
  const L = a.ai.look, back = L.back;
  delete a.ai.look;
  if (a.gait === 'phone') a.gait = 'idle';
  const dir = Math.sign(a.x - L.ox) || 1;
  onFrom(state, a, dir, back, dir);
}
// (a step of STEP_OFF_M along x by dir, if it's clear, and the plan (or a way along the street by far) from there)
function onFrom(state, a, dir, plan, far) {
  const seed = townOf(state.map), row = rowOf(state, a), here = { row, x: a.x, z: a.z }, P = { row, x: a.x + dir * STEP_OFF_M, z: a.z }, from = clearWay(seed, row, here, P) ? P : here;
  let route = null;
  plan = plan ? { ...plan, from } : null;
  try { route = plan && PLANNERS[plan.kind](state, plan); } catch { route = null; }
  if (!route) { plan = { kind: 'way', from, to: { row, x: from.x + far * TURN_BACK_M, z: LINE[lineNear(a.z)] } }; try { route = PLANNERS.way(state, plan); } catch { plan = null; route = null; } }
  Object.assign(a.ai, { plan, route: null, $route: route, s: 0, stop: 0, wait: 0, detour: from === P ? { pts: [{ x: P.x, z: P.z }], sAfter: 0, until: state.time.ms + 10000 } : null });
}

/**
 * Keep clear of o: their way ahead coming within CLEAR_M of it, round it on the far side of the pavement (the detour
 * sim/agents.js walks: up to it, past it, back on the way beyond), or back the way they came where there's no room.
 */
function keepClear(state, a, o) {
  const route = a.ai.$route ?? a.ai.route;
  if (!route) return;
  let close = false, dir = 0;
  for (let s = a.ai.s; s <= Math.min(route.length, a.ai.s + LOOK_AHEAD_M); s += 0.5) {
    const q = placeAt(route, s, a.ai.f);
    if (q.row !== rowOf(state, a)) break;
    if (Math.hypot(q.x - o.x, q.z - o.z) < CLEAR_M) { close = true; dir = Math.sign(q.x - a.x) || Math.sign(o.x - a.x) || 1; break; }
  }
  if (!close) return;
  const seed = townOf(state.map), row = rowOf(state, a), B = BAND[lineNear(o.z)];
  // (along the side of the pavement they're on, as far from it as the pavement goes; or, no room there, the other side)
  const mine = Math.sign(a.z - o.z) || 1, sides = [mine, -mine].map(k => Math.max(B[0], Math.min(B[1], o.z + k * (CLEAR_M + 0.3))));
  for (const z of sides) {
    if (Math.abs(z - o.z) < MIN_CLEAR_M) continue;
    const x1 = o.x - dir * PAST_M, x2 = o.x + dir * PAST_M;
    let sAfter = null;
    for (let s = a.ai.s; s <= route.length; s += 0.5) { const q = placeAt(route, s, a.ai.f); if (q.row !== row) break; if ((q.x - x2) * dir > 0.5) { sAfter = s; break; } }
    if (sAfter === null) continue;
    // (up to it on that side; already beside it, a step aside first)
    const Q = placeAt(route, sAfter, a.ai.f), pts = [(x1 - a.x) * dir > 0.3 ? { x: x1, z } : { x: a.x, z }, { x: x2, z }, { x: Q.x, z: Q.z }];
    if (![{ x: a.x, z: a.z }, ...pts].every((p, k, A) => !k || clearWay(seed, row, A[k - 1], p))) continue;
    a.ai.detour = { pts, sAfter, until: state.time.ms + 30000 };
    return;
  }
  // (no room to pass it: back the way they came, a step back along their side first)
  onFrom(state, a, -dir, null, -dir);
}
// (whether a route comes within MIN_CLEAR_M of o anywhere on this row)
const passes = (route, o, row) => { for (let s = 0; s <= route.length; s += 0.4) { const q = placeAt(route, s, 0); if (q.row === row && Math.hypot(q.x - o.x, q.z - o.z) < MIN_CLEAR_M) return true; } return false; };
// (how close the straight way from p to q comes to o)
const offSeg = (p, q, o) => { const dx = q.x - p.x, dz = q.z - p.z, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((o.x - p.x) * dx + (o.z - p.z) * dz) / L2)); return Math.hypot(p.x + dx * t - o.x, p.z + dz * t - o.z); };
const clearWay = (seed, row, p, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); for (let t = 0; t <= d; t += 0.25) if (!clearAt(seed, row, p.x + (q.x - p.x) * t / (d || 1), p.z + (q.z - p.z) * t / (d || 1), 0.25)) return false; return true; };

/** Whether a passer-by's due its look about this tick (once a second, each on a tick of its own). */
export const due = (state, a) => (state.tick + (Number(a.seed) || 0)) % TPS === 0;
