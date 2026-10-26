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
// kind, slowM }): the agent slows over the slowM metres before one (a tell), then waits there, facing
// a way, perhaps out of sight (a shop) or at a window's glass; the scenario hears of each (onStop:
// 'tell', 'start', 'end').
//
// A follower (ai.follow: { id, keep, … }) walks in its target's footsteps, as far as it has seen
// them: the trail is the places it saw the target, bridged by the planner where it lost sight of
// them for a while, and carried through a lane's seam when it saw them go up it. It keeps `keep`
// metres of trail behind; out of sight, it walks to where it last saw them, looks about (SEARCH_S),
// and loses them. Its eyes stay on the target while they're anywhere it can turn its head to.
import { TICK_MS } from './clock.js';
import { placeAt, routeFrom, finish, LINE } from './city.js';
import { Z } from './map/street.js';
import { near } from './world.js';
import { seesActor, headOf } from './perception.js';

const DT = TICK_MS / 1000;
const TPS = 1000 / TICK_MS;
export const LEAN = 0.04;                                          // how fast a walker leans aside, of its way's width a tick
export const ROUTE_EVERY = 10;                                     // a follower re-reads the trail every this many ticks
export const SEARCH_S = 8;
export const TRAIL_STEP_M = 0.4;

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
  if (!route || ai.s >= route.length - 1e-6) { a.vx = a.vz = 0; a.gait = ai.sit ? 'sit' : 'idle'; return; }
  const stop = route.stops?.[ai.stop];
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
  if (both && !t.hidden) {                                        // eyes on them, whichever way the feet go
    const to = Math.atan2(t.z - a.z, t.x - a.x), d = Math.abs(((to - a.head + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    a.ai.eyesOn = d < 2.4; if (a.ai.eyesOn) a.head = to;
  } else a.ai.eyesOn = false;
  if (!sees) return;
  fo.seenMs = state.time.ms; fo.search = 0;
  const last = fo.trail[fo.trail.length - 1], here = { row: rowOf(state, t), x: t.x, z: t.z };
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

/** A follower's next stretch (every ROUTE_EVERY ticks): along the trail to `keep` metres short of its end. */
export function routeFollower(state, a) {
  const fo = a.ai.follow;
  if (!fo || fo.lost) return;
  const T = fo.trail;
  // Seen going up a lane to its end: they came out at the other end, so the trail goes on through.
  const last = T[T.length - 1];
  if (last && (last.z < Z.north + 2.5 || last.z > Z.edge - 2.5) && state.time.ms - fo.seenMs > 600 && !fo.through) {
    const north = last.z < 0, row = last.row + (north ? -1 : 1);
    T.push({ row: last.row, x: last.x, z: north ? Z.north : Z.edge }, { row, x: last.x, z: north ? Z.edge : Z.north, jump: true }, { row, x: last.x, z: north ? LINE.S : LINE.F });
    fo.through = true;
  }
  if (state.time.ms - fo.seenMs < 600) fo.through = false;
  // Drop the trail already walked: up to the point nearest the follower (on its street).
  let best = 0, bd = Infinity;
  for (let j = 0; j < T.length; j++) { if (T[j].row !== rowOf(state, a)) continue; const d = Math.hypot(T[j].x - a.x, T[j].z - a.z); if (d < bd) { bd = d; best = j; } }
  if (best > 0) T.splice(0, best);
  // From here along the trail, stopping keep metres short of its end.
  const pts = [{ row: rowOf(state, a), x: a.x, z: a.z, w: 0 }, ...T.slice(1).map(p => ({ ...p, w: 0 }))];
  let cut = pts.length - 1, back = 0;
  while (cut > 0 && back < fo.keep) { const p = pts[cut], q = pts[cut - 1]; back += p.jump ? 0 : Math.hypot(p.x - q.x, p.z - q.z); cut--; }
  const route = finish(pts.slice(0, Math.max(1, cut + 1)));
  const unseen = (state.time.ms - fo.seenMs) / 1000;
  if (route.length < 0.3 || pts.length < 2) {
    a.ai.route = null;
    if (unseen > 3) {                                              // at the end of what we know, and nothing: look about
      fo.search++;
      if (fo.search * ROUTE_EVERY > SEARCH_S * TPS) fo.lost = true;
    }
    return;
  }
  // Pace: close up when far behind, ease off when close.
  const gap = route.length + fo.keep;
  a.ai.pace = gap > fo.keep + 8 ? 1.35 : gap < fo.keep - 2 ? 0.6 : 1;
  a.ai.route = route; a.ai.s = 0; a.ai.stop = 0; a.ai.f = 0;
}
