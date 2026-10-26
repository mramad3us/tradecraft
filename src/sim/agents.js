// TRADECRAFT sim: agents, the people who go places (DESIGN.md: World size, The background game).
//
// An agent is an actor with a.ai.kind 'agent' and a street of its own (a.row). It walks a route
// (sim/city.js) by the clock, kinematically, at its own fraction f of each way's width (placeAt), so
// nothing can block it; on the loaded street it slows behind people in its way and leans aside,
// within the way's width. Off the loaded street it walks on all the same, in the background: unseen,
// undrawn, and where it should be when its street is loaded. The loaded street follows the focus
// (sim/game.js): an agent that's the focus takes the map with it through a lane.
//
// A route can carry stops (route.stops, sorted by s: { s, ticks, face, gait, hidden, glass, wide,
// kind, check, slowM }): the agent slows over the slowM metres before one (a tell), then waits there,
// facing a way, perhaps out of sight (a shop) or at a window's glass; the scenario hears of each
// (onStop: 'tell', 'start', 'end'). A stop that's a check (stop.check) is one a follower looks away
// from.
//
// A follower (ai.follow: { id, keep, trail, … }) walks in its target's footsteps, as far as it has
// seen them: the trail is the places it saw them, bridged by the planner where it lost sight of them
// a while. It keeps `keep` metres of trail behind, never more than KEEP_SIGHT of the eye's reach in
// the open air; it looks away when they stop to check where they could see it, walks on ahead when
// they come its way, and cuts across where their trail loops back (LOOP_M). Off the trail it plans its
// way back on, and walks that way out before it thinks again (it never dithers). Out of sight it
// hurries (HURRY), goes right up to where it last saw them, and guesses: up the lane they were in or
// walking straight at (LANE_HEAD_M), the trail carried through the lane's seam; in at the door they
// were seen going in by, waited on (DOOR_WAIT_S); otherwise it looks about there and walks on a little
// their way (SEARCH_S), and not finding them on the street, watches the shopfronts nearby from the
// pavement (DOOR_WAIT_S). Then it's lost them. Its eyes stay on them while they're anywhere it can
// turn its head to.
import { TICK_MS } from './clock.js';
import { placeAt, routeFrom, finish, sectionOf, clearAt, LINE } from './city.js';
import { Z, SECTION_M } from './map/street.js';
import { near } from './world.js';
import { seesActor, headOf, openAir, SIGHT_M, LIGHT_M } from './perception.js';

const DT = TICK_MS / 1000;
const TPS = 1000 / TICK_MS;
export const LEAN = 0.04;                                          // how fast a walker leans aside, of its way's width a tick
export const ROUTE_EVERY = 10;                                     // a follower re-reads the trail every this many ticks
export const SEARCH_S = 8;                                         // out of sight at the end of what it knows: how long it looks about
export const KEEP_SIGHT = 0.6;                                     // a follower keeps back at most this much of the eye's reach
export const DOOR_WAIT_S = 120;                                    // seen going in at a door (or guessed to): how long they're waited for
export const LANE_HEAD_M = 11;                                     // walking straight at a lane's mouth this close (over the road): gone up it
export const LOOP_M = 2;                                           // a later stretch of trail this much further off still wins
export const HURRY = 1.6;                                          // the pace, × speed, of a follower catching up out of their sight
export const TRAIL_STEP_M = 0.4;

// The line a z is nearest (where someone last seen there would walk on).
const lineZ = (z) => Object.values(LINE).reduce((b, l) => (Math.abs(l - z) < Math.abs(b - z) ? l : b), LINE.F);

/** The door someone at p would have gone in by, if any (a shop's, a house's: on the street's front). */
function doorAt(seed, p) {
  if (!p || p.z > Z.front + 1.2 || p.z < Z.front - 0.6) return null;
  return sectionOf(seed, p.row, Math.floor(p.x / SECTION_M)).doors.find(d => d.z === Z.front && Math.abs(d.x - p.x) < 1.6) ?? null;
}

/** Whether the straight way from a to b (on a row) is clear for a walker. */
function segClear(seed, row, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  for (let t = 0; t <= d; t += 0.2) if (!clearAt(seed, row, a.x + (b.x - a.x) * t / d, a.z + (b.z - a.z) * t / d, 0.25)) return false;
  return true;
}

/**
 * The lane a trail ends in, or heads into ({ g, north }): last seen in its mouth or up it, or within
 * LANE_HEAD_M of its mouth walking straight at it (v: their velocity when last seen).
 */
function laneOf(seed, T, v) {
  const p = T[T.length - 1], sp = Math.hypot(v?.vx ?? 0, v?.vz ?? 0), uz = sp > 0.3 ? v.vz / sp : 0;
  // (heading straight for it: on its pavement, or crossing the road to it)
  const north = p.z < Z.front + 0.6 || (p.z < Z.kerbS && uz < -0.85 && p.z < Z.front + LANE_HEAD_M);
  const south = p.z > Z.south - 0.6 || (p.z > Z.fenceS && uz > 0.85 && p.z > Z.south - LANE_HEAD_M);
  if (!north && !south) return null;
  const S = sectionOf(seed, p.row, Math.floor(p.x / SECTION_M));
  const g = (north ? S.gapsN : S.gapsS).find(g => p.x >= g.x0 - 0.6 && p.x <= g.x1 + 0.6);
  if (!g) return null;
  // (Not the lane they're coming out of, or were in a few metres ago.)
  const inLane = (q) => q.row === p.row && q.x >= g.x0 - 0.6 && q.x <= g.x1 + 0.6 && (north ? q.z < Z.front - 0.5 : q.z > Z.south + 0.5);
  if (inLane(p)) return (north ? uz > 0.3 : uz < -0.3) ? null : { g, north };
  for (let j = T.length - 1, len = 0; j > 0 && len < 12; j--) {
    if (inLane(T[j - 1])) return null;
    len += T[j].jump ? 0 : Math.hypot(T[j].x - T[j - 1].x, T[j].z - T[j - 1].z);
  }
  return { g, north };
}

/** The shop door nearest p on its street's front, within m metres (where someone who left the street near p went). */
function doorNear(seed, p, m) {
  if (!p || p.z > LINE.N) return null;                             // (the far side, the park: no shops)
  const i = Math.floor(p.x / SECTION_M);
  const doors = [i - 1, i, i + 1].flatMap(k => sectionOf(seed, p.row, k).doors).filter(d => d.kind === 'shop' && d.z === Z.front && Math.abs(d.x - p.x) < m);
  return doors.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] ?? null;
}

export const rowOf = (state, a) => a.row ?? state.map.row;
export const onMap = (state, a) => rowOf(state, a) === state.map.row;
export const isAgent = (a) => a.ai?.kind === 'agent';

/** A new agent actor at a place, with a look's owner (who) or a passer-by's seed. */
export function makeAgent(state, { who = null, seed = null, row, x, z, speed = 1.35, f = 0, face = 'right' }) {
  const a = { id: `a${state.nextActor++}`, who, seed, row, x, z, vx: 0, vz: 0, face, head: headOf(face), gait: 'idle', stride: 0, stuck: 0,
    ai: { kind: 'agent', route: null, s: 0, stop: 0, wait: 0, speed, f, f0: f, slow: false } };
  state.actors.push(a);
  return a;
}

/** Give an agent a route (from where it stands: the route's first point should be here). */
export function setRoute(state, a, route) {
  Object.assign(a.ai, { route, s: 0, stop: 0, wait: 0, slow: false, told: -1 });
  if (a.ai.waiting) endStop(state, a);
}

/** A route for an agent from where it is to a place (on to a line first, if need be). */
export function routeTo(state, a, to, opts = {}) {
  return routeFrom(state.map.seed, { row: rowOf(state, a), x: a.x, z: a.z }, to, opts);
}

// ---------- walking ----------

/** One tick of an agent (step 2 of the tick): along its route, or waiting at a stop. */
export function stepAgent(state, a, scenario, bus) {
  const ai = a.ai, x0 = a.x, z0 = a.z, row0 = a.row;
  if (ai.wait > 0) {
    a.vx = a.vz = 0;
    if (--ai.wait === 0) endStop(state, a, scenario, bus);
    return;
  }
  const route = ai.route;
  const stop = route?.stops?.[ai.stop];
  if (stop && stop.s <= ai.s + 1e-6) { startStop(state, a, stop, scenario, bus); return; }
  if (!route || ai.s >= route.length - 1e-6) { a.vx = a.vz = 0; a.gait = ai.sit ? 'sit' : 'idle'; return; }
  let v = ai.speed * (ai.pace ?? 1);
  if (stop && stop.slowM && stop.s - ai.s <= stop.slowM) {        // a tell: slowing before a check
    if (ai.told !== ai.stop) { ai.told = ai.stop; scenario?.onStop?.(state, a, stop, 'tell', bus); }
    v *= 0.5;
  }
  const here = onMap(state, a);
  if (here) v = yieldTo(state, a, v);
  let s1 = Math.min(route.length, ai.s + v * DT);
  if (stop && stop.s <= s1) s1 = stop.s;
  const p = placeAt(route, s1, ai.f);
  a.row = p.row;
  a.x = p.x; a.z = p.z; ai.s = s1;
  if (a.row !== row0) { a.vx = p.ux * v; a.vz = p.uz * v; }       // (through a seam: no leap of velocity)
  else { a.vx = (a.x - x0) / DT; a.vz = (a.z - z0) / DT; a.stride += Math.hypot(a.x - x0, a.z - z0); }
  a.gait = Math.hypot(a.vx, a.vz) > 0.05 ? 'walk' : 'idle';
  if (Math.hypot(p.ux, p.uz) > 0.5 && Math.hypot(a.vx, a.vz) > 0.05) { a.face = faceFor(p.ux, p.uz, a.face); if (!ai.eyesOn) a.head = Math.atan2(p.uz, p.ux); }
  if (stop && ai.s >= stop.s - 1e-6) startStop(state, a, stop, scenario, bus);
}

/** Slow behind someone in the way, and lean aside from them, within the way's width. */
function yieldTo(state, a, v) {
  const ai = a.ai, p = placeAt(ai.route, ai.s, ai.f), ux = p.ux, uz = p.uz;
  let ahead = null, lean = 0;
  for (const o of near(state, a.x, a.z, 1.6)) {
    if (o === a || o.hidden) continue;
    const dx = o.x - a.x, dz = o.z - a.z, along = dx * ux + dz * uz, side = -dx * uz + dz * ux;
    if (along > 0.2 && along < 1.3 && Math.abs(side) < 0.55) { ahead = o; lean = side >= 0 ? -1 : 1; }
  }
  if (ahead) {
    ai.f = Math.max(-1, Math.min(1, ai.f + lean * LEAN));
    const theirs = (ahead.vx * ux + ahead.vz * uz) || 0;
    return Math.max(0.35, Math.min(v, theirs > 0 ? theirs : v * 0.6));
  }
  ai.f += Math.sign(ai.f0 - ai.f) * Math.min(Math.abs(ai.f0 - ai.f), LEAN / 2);   // back to its own side, slowly
  return v;
}

function startStop(state, a, stop, scenario, bus) {
  const ai = a.ai;
  ai.stop++;
  ai.waiting = stop;
  ai.wait = Math.max(1, stop.ticks | 0);
  a.vx = a.vz = 0;
  a.gait = stop.gait ?? 'idle';
  ai.sit = stop.gait === 'sit';
  if (stop.face) { a.face = stop.face; a.head = headOf(stop.face); }
  a.glass = !!stop.glass; a.wide = !!stop.wide; a.hidden = !!stop.hidden;
  scenario?.onStop?.(state, a, stop, 'start', bus);
}

function endStop(state, a, scenario, bus) {
  const ai = a.ai, stop = ai.waiting;
  ai.waiting = null; ai.wait = 0; ai.sit = false;
  a.glass = a.wide = a.hidden = false;
  a.gait = 'idle';
  if (stop) scenario?.onStop?.(state, a, stop, 'end', bus);
}

/** The sprite's facing for a direction, keeping the old one near the diagonals. */
function faceFor(ux, uz, was) {
  const ax = Math.abs(ux), az = Math.abs(uz);
  const horizontal = (was === 'left' || was === 'right') ? ax > az * 0.8 : ax > az * 1.25;
  return horizontal ? (ux > 0 ? 'right' : 'left') : (uz > 0 ? 'down' : 'up');
}

// ---------- following ----------

/**
 * Make agent a follow actor `id`, keeping `keep` metres of trail behind. The trail starts with a
 * planned way from the follower to where the target is now (they know where to pick them up).
 */
export function follow(state, a, target, keep) {
  a.ai.follow = { id: target.id, keep, trail: [], seenMs: state.time.ms, lost: false, search: 0 };
  const way = routeFrom(state.map.seed, { row: rowOf(state, a), x: a.x, z: a.z }, { row: rowOf(state, target), x: target.x, z: target.z });
  a.ai.follow.trail = way.pts.map(p => ({ row: p.row, x: p.x, z: p.z, jump: p.jump }));
}

/** A follower watches (each tick, after everyone's moved): what it sees of its target goes on the trail. */
export function watchTarget(state, a) {
  const fo = a.ai.follow, t = fo && state.actors.find(o => o.id === fo.id);
  if (!fo || fo.lost || !t) return;
  const both = onMap(state, a) && onMap(state, t);
  // (two agents both off the loaded street: abstractly, near on the same street is in sight)
  const sees = both ? seesActor(state, a, t) : !onMap(state, a) && !onMap(state, t) && rowOf(state, a) === rowOf(state, t) && !t.hidden && Math.hypot(t.x - a.x, t.z - a.z) < fo.keep * 2 + 8;
  // Stopped to check (stop.check: a look back, a glance from a kerb, the glass of a window) where they
  // can see us: eyes elsewhere, as anyone's would be. (We know where they're standing.)
  const toUs = both && !t.hidden && t.ai?.waiting?.check && state.time.ms - fo.seenMs < 2000 && seesActor(state, t, a);
  if (toUs) {
    a.ai.eyesOn = true; a.ai.averted = true; fo.seenMs = state.time.ms;
    a.head = Math.atan2(t.z - a.z, t.x - a.x) + Math.PI / 2;        // (off to the side: walking behind them, ahead is them)
    return;
  }
  a.ai.averted = false;
  if (both && !t.hidden && state.time.ms - fo.seenMs < 2000) {   // eyes on them, whichever way the feet go
    const to = Math.atan2(t.z - a.z, t.x - a.x), d = Math.abs(((to - a.head + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    a.ai.eyesOn = d < 2.4; if (a.ai.eyesOn) a.head = to;
  } else if (fo.inside) {                                          // gone in somewhere along here: the shopfronts, both ways
    a.ai.eyesOn = true;
    a.head = (Z.front < a.z ? -Math.PI / 2 : Math.PI / 2) + 1.3 * Math.sin(2 * Math.PI * state.time.ms / 6000);
  } else if (fo.door) { a.ai.eyesOn = true; a.head = Math.atan2(Z.front - a.z, fo.door.x - a.x); }   // the door they went in by
  else if (fo.search > 0) { a.ai.eyesOn = true; a.head += 2 * Math.PI / (3 * TPS); }   // looking about: a turn of the head every 3 s
  else a.ai.eyesOn = false;
  if (!sees) return;
  fo.seenMs = state.time.ms; fo.search = 0; fo.door = fo.inside = null; fo.triedDoor = false;
  if (Math.hypot(t.vx, t.vz) > 0.3) fo.v = { vx: t.vx, vz: t.vz };   // (which way they were going when last seen)
  const here = { row: rowOf(state, t), x: t.x, z: t.z };
  if (fo.trail.at(-1)?.guess) { unguess(fo.trail, here); fo.rev = (fo.rev ?? 0) + 1; }   // (the trail's been revised)
  const last = fo.trail[fo.trail.length - 1];
  if (!last) { fo.trail.push(here); return; }
  const d = Math.hypot(here.x - last.x, here.z - last.z);
  if (last.row === here.row && d < TRAIL_STEP_M) return;
  if (last.row === here.row && d < 1.5) { fo.trail.push(here); return; }
  // A gap (they moved out of sight and back): bridge it with a planned way.
  try {
    const way = routeFrom(state.map.seed, last, here);
    for (const p of way.pts.slice(1)) fo.trail.push({ row: p.row, x: p.x, z: p.z, jump: p.jump });
  } catch { fo.trail.push(here); }
}

/**
 * Nothing on the street where they should be: they've gone in somewhere near where they were last
 * seen (the nearest shop: wait on its door), or, with no shop near, they're lost.
 */
function giveUp(state, a, fo) {
  const seed = state.map.seed, door = !fo.triedDoor && doorNear(seed, fo.trail.at(-1), 15);
  fo.triedDoor = true; fo.guessing = false;
  if (!door) { fo.lost = true; return; }
  fo.inside = door; fo.door = door; fo.search = 0;
  // (out to the pavement, a few metres along from the door: where the shopfronts can be seen)
  const row = rowOf(state, a), side = Math.sign(a.x - door.x) || 1;
  try { Object.assign(a.ai, { route: routeFrom(seed, { row, x: a.x, z: a.z }, { row, x: door.x + side * 6, z: LINE.F }), s: 0, stop: 0, f: 0, pace: 1 }); } catch {}
}

/**
 * Seen again after a guess at their way (through a lane): the guess stands as far as the stretch of it
 * nearest where they are now, and goes after that, so the trail never runs on past them and back.
 */
function unguess(T, here) {
  let j = T.length - 1;
  while (j > 0 && T[j].guess) j--;
  let bk = -1, bd = Infinity, bp = null;
  for (let k = j; k + 1 < T.length; k++) {
    const p = T[k], q = T[k + 1];
    if (q.jump || p.row !== here.row || q.row !== here.row) continue;
    const dx = q.x - p.x, dz = q.z - p.z, L2 = dx * dx + dz * dz;
    const u = L2 > 1e-9 ? Math.max(0, Math.min(1, ((here.x - p.x) * dx + (here.z - p.z) * dz) / L2)) : 0;
    const x = p.x + dx * u, z = p.z + dz * u, d = Math.hypot(here.x - x, here.z - z);
    if (d < bd) { bd = d; bk = k; bp = { row: p.row, x, z }; }
  }
  T.length = bk >= 0 ? bk + 1 : j + 1;
  for (const p of T) delete p.guess;
  if (bp) T.push(bp);
  return true;
}

/**
 * A follower's next stretch (every ROUTE_EVERY ticks). What it's doing comes first: waiting on a door
 * they went in by; walking on ahead of them while they come its way; a way back on to the trail
 * under way (walked out before it thinks again, so it never dithers); looking about where they were
 * last seen. Otherwise, along the trail to `keep` metres short of its end.
 */
export function routeFollower(state, a) {
  const fo = a.ai.follow;
  if (!fo || fo.lost || a.ai.hold > state.time.ms || a.ai.waiting) return;   // (busy with a stop of its own)
  const T = fo.trail, seed = state.map.seed, row = rowOf(state, a);
  const t = state.actors.find(o => o.id === fo.id), unseen = (state.time.ms - fo.seenMs) / 1000;
  // How far back: never further than KEEP_SIGHT of how far the eye reaches (perception.js) in the
  // open air's light, not a lamp's: they'll walk out of the lamplight.
  const keepNow = Math.min(fo.keep, KEEP_SIGHT * (SIGHT_M + LIGHT_M * openAir(state)));
  const walking = () => a.ai.route && a.ai.s < a.ai.route.length - 0.05;
  const go = (route, pace = 1) => { Object.assign(a.ai, { route, s: 0, stop: 0, f: 0, pace }); };
  throughLane(state, fo);
  // Waiting on a door we think they went in by (from a spot on the pavement that sees the shopfronts).
  if (fo.inside) {
    if (!walking()) a.ai.route = null;
    if (++fo.search * ROUTE_EVERY > DOOR_WAIT_S * TPS) fo.lost = true;
    return;
  }
  // Coming our way, close (a double-back, a turn): walk on ahead of them, the way they're going,
  // and let them by. Never close on a face.
  if (t && rowOf(state, t) === row && !t.hidden && unseen < 1) {
    const dx = a.x - t.x, dz = a.z - t.z, d = Math.hypot(dx, dz) || 1, coming = (t.vx * dx + t.vz * dz) / d;
    if (d < Math.max(8, keepNow * 0.7) && coming > 0.4) {
      if (!fo.ahead || !walking()) {
        const ux = Math.sign(t.vx) || Math.sign(dx) || 1;
        try { go(routeFrom(seed, { row, x: a.x, z: a.z }, { row, x: a.x + ux * 12, z: lineZ(a.z) })); } catch {}
        fo.ahead = true; fo.joinS = 0;
      }
      return;
    }
  }
  fo.ahead = false;
  // A way back on to the trail, under way (walked out, unless the trail's been revised or they're
  // close by: never overtake on a plan); a look about, under way.
  const close = t && rowOf(state, t) === row && unseen < 1 && Math.hypot(t.x - a.x, t.z - a.z) < keepNow * 0.6;
  if (fo.joinS && walking() && a.ai.s < fo.joinS && fo.joinRev === fo.rev && !close) return;
  fo.joinS = 0;
  if (fo.guessing && unseen > 3 && walking()) { if (++fo.search * ROUTE_EVERY > SEARCH_S * TPS) giveUp(state, a, fo); return; }
  fo.guessing = false;
  // Drop the trail already walked: up to the stretch of it nearest the follower (on its street). Off
  // the trail (it walked on ahead, or looked about), the latest stretch about as near (LOOP_M) and
  // straight there, so a trail that loops back on itself (a double-back) is cut, not walked round.
  const near = [];
  for (let j = 0; j + 1 < T.length; j++) {
    const p = T[j], q = T[j + 1];
    if (p.row !== row || q.row !== row || q.jump) continue;
    const dx = q.x - p.x, dz = q.z - p.z, L2 = dx * dx + dz * dz;
    const k = L2 > 1e-9 ? Math.max(0, Math.min(1, ((a.x - p.x) * dx + (a.z - p.z) * dz) / L2)) : 0;
    near.push({ j, x: p.x + dx * k, z: p.z + dz * k, d: Math.hypot(p.x + dx * k - a.x, p.z + dz * k - a.z) });
  }
  const bd = Math.min(Infinity, ...near.map(n => n.d));
  let best = near.reduce((m, n) => (n.d <= bd + 1e-6 ? n.j : m), 0);
  if (bd > 1) {
    for (const n of near.filter(n => n.d <= bd + LOOP_M && n.j > best).reverse()) if (segClear(seed, row, a, n)) { best = n.j; break; }
  }
  if (best > 0) T.splice(0, best);
  // Out of sight a while: right up to where they were last seen (or, after a guess at their way, out
  // to where you can look along the street), since a follower has to see to follow. Gone in at a
  // door: stand off a little and watch it.
  fo.door = unseen > 1 ? doorAt(seed, T[T.length - 1]) : null;
  const keep = fo.door ? keepNow * 0.6 : unseen > 3 ? 0 : keepNow;
  // From here along the trail; off it, back on to it by a planned way, unless the straight one's clear.
  // (No trail on our street at all: a planned way to its end, through whatever seams it takes.)
  if (!near.length && T.length > 1) T.splice(0, T.length - 2);
  let head = [{ row, x: a.x, z: a.z, w: 0 }], planned = false;
  const T1 = T[1];
  if (T1 && (T1.row !== row || (bd > 0.3 && !segClear(seed, row, a, T1)))) {
    try { head = routeFrom(seed, { row, x: a.x, z: a.z }, { row: T1.row, x: T1.x, z: T1.z }).pts.slice(0, -1).map(p => ({ ...p, w: 0 })); planned = true; } catch {}
    if (!planned && T1.row !== row) return;                      // (no way there we can find: stand, and think again)
  }
  const pts = [...head, ...T.slice(1).map((p, j) => ({ ...p, w: 0, jump: j === 0 && planned ? false : p.jump }))];
  let cut = pts.length - 1, back = 0;
  while (cut > 0) {
    const p = pts[cut], q = pts[cut - 1], len = p.jump ? 0 : Math.hypot(p.x - q.x, p.z - q.z);
    if (back + len >= keep) {                                      // the cut falls within this stretch
      const k = (keep - back) / (len || 1);
      pts[cut] = { ...q, x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k, jump: false, w: 0 };
      break;
    }
    back += len; cut--;
  }
  // All the trail we have is shorter than keep (cut short across a loop), but they're further off
  // than keep as the crow flies: on to the trail, to follow it from there.
  const straight = t && rowOf(state, t) === row && unseen < 1 ? Math.hypot(t.x - a.x, t.z - a.z) : 0;
  if (cut === 0 && straight >= keepNow && pts.length > head.length) cut = head.length;
  // Never stop short of a seam they went through: on the far side is where they can be seen again.
  const seam = pts.findIndex((p, j) => j > cut && p.jump);
  if (seam > 0) cut = Math.min(pts.length - 1, seam + 1);
  const route = finish(pts.slice(0, Math.max(1, cut + 1)));
  if ((route.length < 0.3 && !route.rows) || pts.length < 2) {      // (a step short of a seam is not there yet)
    a.ai.route = null;
    if (unseen > 3) {                                              // at the end of what we know, and nothing: look about,
      fo.search++;                                                 // and walk on a little the way they were going
      if (fo.door) { if (fo.search * ROUTE_EVERY > DOOR_WAIT_S * TPS) fo.lost = true; return; }
      if (fo.search === 1 && Math.abs(fo.v?.vx ?? 0) > 0.4) {      // (no way along the street to go by: stand and look both ways)
        const p = T[T.length - 1], ux = Math.sign(fo.v.vx);
        try { go(routeFrom(seed, { row, x: a.x, z: a.z }, { row, x: a.x + ux * 15, z: lineZ(p.z) })); fo.guessing = true; } catch {}
      }
      if (fo.search * ROUTE_EVERY > SEARCH_S * TPS) giveUp(state, a, fo);
    }
    return;
  }
  // Pace: close up when far behind (quicker still while they're out of sight: they can't see the
  // hurry), ease off when close.
  const gap = route.length + keep;
  go(route, gap > keep + 8 ? (unseen > 2 ? HURRY : 1.35) : gap < keep - 2 ? 0.6 : 1);
  if (planned) { fo.joinS = route.cum[Math.min(head.length, route.cum.length - 1)] ?? 0; fo.joinRev = fo.rev; }
}

/**
 * Last seen in a lane, or heading straight for one's mouth: they went up it and out at the other end,
 * so the trail goes on through (guessed). A lane has two ends; it's the obvious guess, and a good one.
 */
function throughLane(state, fo) {
  const T = fo.trail, last = T[T.length - 1];
  if (state.time.ms - fo.seenMs < 600) fo.through = false;
  if (!last || state.time.ms - fo.seenMs <= 900 || fo.through) return;
  const lane = laneOf(state.map.seed, T, fo.v);
  if (!lane) return;
  const { g, north } = lane, gx = (g.x0 + g.x1) / 2, row = last.row + (north ? -1 : 1), mouthZ = north ? Z.front - 1 : Z.south + 1;
  try {
    const mouth = routeFrom(state.map.seed, last, { row: last.row, x: gx, z: mouthZ });
    for (const p of mouth.pts.slice(1)) T.push({ row: p.row, x: p.x, z: p.z, guess: true });
  } catch { T.push({ row: last.row, x: gx, z: mouthZ, guess: true }); }
  T.push({ row: last.row, x: gx, z: north ? Z.north : Z.edge, guess: true },
    { row, x: gx, z: north ? Z.edge : Z.north, jump: true, guess: true }, { row, x: gx, z: north ? LINE.S : LINE.F, guess: true });
  fo.through = true;
}
