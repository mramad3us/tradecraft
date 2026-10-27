// TRADECRAFT sim: passers-by. Throwaway people going about the city round the player, so it lives, a
// spook can hide in it, and anyone in it can be tailed somewhere real.
//
// A passer-by is an agent (sim/agents.js; ai.civ) with a seed (their sheet and look come from it:
// sim/people.js passerby()) and somewhere to go: a door (a shop, a block of flats, a courtyard's arch)
// DEST_ROWS streets from where they appear, some way along, by a way of their own across the city
// (sim/city.js), with a civilian's habits on it (sim/habits.js 'civil': a shop window, a bench on the
// boulevard, a call). Followed, a passer-by leads somewhere: the tail ends at their door.
//
// The bubble: passers-by live on the focus's street and the streets either side (BUBBLE_ROWS), within
// WINDOW_M of the focus along them, and are let go beyond, or once in at their door. So whoever was on
// our street when we crossed to the next is still about on the one behind us, and lives on there;
// whoever crosses after us arrives; the street we come to was already full of people going about their
// business. Crossing again, the street two back is let go. (A scenario's people are never passers-by:
// they're kept.)
//
// On the street in view they come in from beyond the screen's edges or out of doors, never where the
// player would see them appear, and leave by their doors or off the screen; on the streets either side
// (unseen) they appear anywhere along it. The count on each street holds near a target that follows the
// hour (density()).
//
// A passer-by's route isn't saved (2 KB): it keeps its plan (ai.plan: where from, where to, who) and
// the route is planned again on load, the same (agents.js PLANNERS).
//
// The steering below (follow, steer, walk) is for a scenario's own people who walk a plan of steps.
import { range, int, chance, weighted, stream } from './rng.js';
import { LANES, Z, SECTION_M } from './map/street.js';
import { near, move, blocked, sectionAt } from './world.js';
import { eyes, sees, headOf } from './perception.js';
import { seedFrom } from './people.js';
import { hourOfDay, TICK_MS } from './clock.js';
import { routeFrom, sectionOf, finish, LINE } from './city.js';
import { makeAgent, rowOf, PLANNERS } from './agents.js';
import { withHabits, withEnd, spur } from './habits.js';

export const CROWD_PER_100M = 40;                                  // at the busiest hours, along a street
export const WINDOW_M = 45;                                        // passers-by live within this of the focus, along the street
export const BUBBLE_ROWS = 1;                                      // and on the streets this many either side
export const DEST_ROWS = [2, 5];                                   // where they're going: this many streets from where they appear
export const DEST_ALONG_M = [120, 600];                            // and this far along (most of a walk is along streets)
export const SPAWN_M = [27, 40];                                   // on the street in view, in from this far (off screen: it's 20 m to an edge)
export const SCREEN_HALF_M = [24, 22];                             // the picture round the player (its widest, and the camera's lean: src/render/view.js LEAD_M), and a margin: nobody comes or goes in it
export const SPEED_MS = [1.05, 1.6];
export const SPACE_M = 0.8;
export const STUCK_S = 3;
const DT = TICK_MS / 1000;
const TPS = 1000 / TICK_MS;
const LINES_W = [['F', 5], ['N', 3.5], ['P', 3], ['S', 2]];        // which pavement, by how busy

export const isPasserby = (a) => !!a.ai?.civ;

/** How busy the street is at a game time, 0..1 of CROWD_PER_100M. */
export function density(ms) {
  const h = hourOfDay(ms);
  const curve = [[0, 0.12], [5, 0.06], [7, 0.5], [8.5, 1], [10, 0.7], [13, 0.85], [15, 0.75], [18, 1], [20, 0.7], [22, 0.35], [24, 0.12]];
  for (let i = 1; i < curve.length; i++) if (h <= curve[i][0]) {
    const [h0, v0] = curve[i - 1], [h1, v1] = curve[i];
    return v0 + (v1 - v0) * (h - h0) / (h1 - h0);
  }
  return 0.12;
}

/** Where to: a door DEST_ROWS streets from `from`, some way along (toward dir, if given), its way in clear. */
function destination(seed, r, from, dir = 0) {
  for (let k = 0; k < 8; k++) {
    const n = DEST_ROWS[0] + int(r, DEST_ROWS[1] - DEST_ROWS[0] + 1), row = from.row + (chance(r, 0.5) ? n : -n);
    const x = from.x + (dir || (chance(r, 0.5) ? 1 : -1)) * range(r, ...DEST_ALONG_M), i = Math.floor(x / SECTION_M);
    const doors = [i - 1, i, i + 1].flatMap(j => sectionOf(seed, row, j).doors)
      .filter(d => d.z === Z.front && d.kind !== 'kiosk' && spur(seed, row, d.x, LINE.F, d.x, Z.front + 0.3));
    if (doors.length) { const d = doors[int(r, doors.length)]; return { row, x: d.x, door: d.kind, shop: d.shop ?? null }; }
  }
  return null;
}

/** A passer-by's route, from its plan: the way to the door, with a civilian's habits, and in. */
function passerRoute(state, plan) {
  const seed = state.map.seed;
  const way = routeFrom(seed, plan.from, { row: plan.to.row, x: plan.to.x, z: LINE.F }, { walker: plan.seed });
  const route = withHabits(seed, way, stream('passer', plan.seed), 'civil');
  const end = route.pts[route.pts.length - 1];
  const done = finish([...route.pts, { row: end.row, x: end.x, z: Z.front + 0.3, w: 0, way: 'attach' }]);
  done.stops = route.stops;
  return withEnd(done, { kind: 'enter', ticks: 3600 * TPS, face: 'up', hidden: true });
}
PLANNERS.passer = passerRoute;

/** Someone new, at `from` ({ row, x, z }), going somewhere (toward dir along the street, if given). */
function spawn(state, r, from, dir = 0) {
  const to = destination(state.map.seed, r, from, dir);
  if (!to) return null;
  const plan = { kind: 'passer', seed: seedFrom(r), from, to };
  let route;
  try { route = passerRoute(state, plan); } catch { return null; }
  const a = makeAgent(state, { who: null, seed: plan.seed, row: from.row, x: from.x, z: from.z, speed: range(r, ...SPEED_MS), f: range(r, -0.8, 0.8) });
  Object.assign(a.ai, { civ: true, plan, $route: route });
  return a;
}

/** Whether a passer-by stays: in the bubble, not in at their door. */
function stays(state, a, rows, focusX) {
  if (a.ai.waiting?.kind === 'enter') return false;
  return rows.includes(rowOf(state, a)) && Math.abs(a.x - focusX) <= WINDOW_M + 6;
}

/**
 * Keep the bubble round the focus at x (once a second, and when the map changes): let go whoever's
 * left it or gone in, and bring new people in, street by street, up to the hour's target. fill: the
 * street in view too may have people appear anywhere (a game just begun).
 */
export function populate(state, focusX, { fill = false } = {}) {
  if (state.map.kind !== 'street') return;                         // (a room has no passers-by)
  const r = state.rng, R = state.map.row, seed = state.map.seed, rows = [];
  for (let k = -BUBBLE_ROWS; k <= BUBBLE_ROWS; k++) rows.push(R + k);
  state.actors = state.actors.filter(a => !isPasserby(a) || stays(state, a, rows, focusX));
  const target = Math.round(CROWD_PER_100M * (2 * WINDOW_M / 100) * density(state.time.ms) * (state.map.crowd ?? 1));
  const count = new Map(rows.map(row => [row, 0]));
  for (const a of state.actors) if (isPasserby(a)) { const row = rowOf(state, a); if (count.has(row)) count.set(row, count.get(row) + 1); }
  // Nobody appears where the player would see it happen: on screen and in their sight.
  const me = state.actors.find(a => a.who === state.player), e = me && !fill ? eyes(state, me) : null;
  const unseen = (x, z) => !e || Math.abs(x - me.x) > SCREEN_HALF_M[0] || Math.abs(z - me.z) > SCREEN_HALF_M[1] || !sees(state, e, x, z);
  const doorNear = (row, x0, x1) => {
    const i0 = Math.floor(x0 / SECTION_M), i1 = Math.floor(x1 / SECTION_M), doors = [];
    for (let i = i0; i <= i1; i++) doors.push(...sectionOf(seed, row, i).doors.filter(d => d.z === Z.front && d.x > x0 && d.x < x1 && d.kind !== 'kiosk'));
    return doors.length ? doors[int(r, doors.length)] : null;
  };
  for (const row of rows) {
    const inView = row === R && !fill;
    for (let n = count.get(row); n < target; n++) {
      let from = null, dir = 0;
      if (chance(r, 0.25)) {                                       // out of a door
        const d = inView ? doorNear(row, focusX - SPAWN_M[1], focusX + SPAWN_M[1]) : doorNear(row, focusX - WINDOW_M, focusX + WINDOW_M);
        if (d && (!inView || unseen(d.x, Z.front + 0.3))) from = { row, x: d.x, z: Z.front + 0.3 };
      } else if (inView) {                                         // in from beyond the screen's edge, inward
        const side = chance(r, 0.5) ? 1 : -1, x = focusX + side * range(r, ...SPAWN_M), z = LINE[weighted(r, LINES_W)];
        if (unseen(x, z)) { from = { row, x, z }; dir = -side; }
      } else from = { row, x: focusX + range(r, -WINDOW_M + 2, WINDOW_M - 2), z: LINE[weighted(r, LINES_W)] };
      if (from) spawn(state, r, from, dir);
    }
  }
}

/**
 * Follow a plan of steps (['go', x, z], ['wait', ticks, face, gait], ['gone']): the velocity, gait and
 * facing for next tick. Returns the step being worked on (null when the plan's done), so a caller
 * with steps of its own (a scenario's character) can handle those and leave these to it.
 */
export function follow(state, a) {
  const ai = a.ai;
  const step = ai.steps[0];
  if (!step) { a.vx = a.vz = 0; a.gait = 'idle'; return null; }
  if (step[0] === 'gone') {
    // Gone through a door or off the map's edge, in sight or not; gone anywhere else (the end of a
    // walk that was out of sight when it was planned, a step given up) only out of sight: in sight,
    // walk on along the street, away from the player, until they're off the screen.
    if (inOpenSight(state, a)) {
      const me = playerOf(state), away = Math.sign(a.x - me.x) || Math.sign(a.vx) || 1;
      ai.steps = [['go', a.x + away * 15, laneOf(a.z)], ['gone']];
      return follow(state, a);
    }
    ai.gone = true; a.vx = a.vz = 0; return step;
  }
  if (step[0] === 'wait') {
    a.vx = a.vz = 0; a.gait = step[3] ?? 'idle';
    if (step[2]) { a.face = step[2]; a.head = headOf(step[2]); }
    if (++ai.wait >= step[1]) { ai.wait = 0; ai.steps.shift(); }
    return step;
  }
  if (step[0] !== 'go') return step;
  const [, tx, tz] = step;
  if (Math.hypot(tx - a.x, tz - a.z) < 0.15) { ai.steps.shift(); a.stuck = 0; return follow(state, a); }
  steer(state, a, tx, tz, ai.speed);
  return step;
}

const playerOf = (state) => state.actors.find(o => o.who === state.player);

// The lane band nearest a z (a passer-by out in the street walks on along it).
function laneOf(z) {
  let best = LANES.far, bd = Infinity;
  for (const b of Object.values(LANES)) { const d = Math.abs(z - (b[0] + b[1]) / 2); if (d < bd) { bd = d; best = b; } }
  return Math.min(best[1], Math.max(best[0], z));
}

/** Whether a passer-by stands out in the street (not at a door, not at the map's edge) on the player's screen. */
function inOpenSight(state, a) {
  const me = playerOf(state);
  if (!me || Math.abs(a.x - me.x) > SCREEN_HALF_M[0] || Math.abs(a.z - me.z) > SCREEN_HALF_M[1]) return false;
  if (a.z < Z.north + 2 || a.z > Z.edge - 2) return false;         // (off the map's edge, up or down a lane)
  if (Math.abs(a.z - (Z.front + 0.3)) < 0.8) return !sectionAt(state, a.x)?.doors.some(d => d.z === Z.front && Math.abs(d.x - a.x) < 1.5);
  return true;
}

/** A walker on a plan of steps decides how to move next tick (their plan done, they've gone), and minds the player. */
export const think = (state, a) => { if (!follow(state, a)) a.ai.gone = true; else notice(state, a); };

/** A passer-by (an agent) minds the player: its eyes go to them while it notices (the feet walk on). */
export function noticeAgent(state, a) {
  notice(state, a);
  a.ai.eyesOn = !!a.noticing;
}

// What a passer-by is aware of, shown: someone running past, or staring at them from close by, draws
// their eyes. They turn their head to the player for NOTICE_S (walking on), so you see what they see.
export const NOTICE_S = 1.5;
export const RUN_NOTICE_M = 9;
export const STARE_M = 6;
export const STARE_S = 1.5;
function notice(state, a) {
  const me = state.$me?.tick === state.tick ? state.$me.a : (state.$me = { tick: state.tick, a: state.actors.find(o => o.who === state.player) }).a;
  if (!me || a.hidden) return;
  const dx = me.x - a.x, dz = me.z - a.z, d = Math.hypot(dx, dz);
  if (d > RUN_NOTICE_M) { a.stared = 0; return; }
  const toMe = Math.atan2(dz, dx);
  if (!a.noticing) {
    // Staring: the player stood, E held, looking straight at them, close.
    const at = me.looking && d < STARE_M && Math.abs(((Math.atan2(-dz, -dx) - me.head + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.3;
    a.stared = at ? (a.stared ?? 0) + 1 : 0;
    const running = me.gait === 'run' && Math.abs(((toMe - (a.head ?? 0) + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 1.2;
    if (running || a.stared >= STARE_S * TPS) { a.noticing = Math.round(NOTICE_S * TPS); a.stared = 0; }
  }
  if (a.noticing) {
    a.noticing--;
    a.head = toMe; a.face = facingOf(toMe);
  }
}
const facingOf = (h) => { const c = Math.cos(h), s = Math.sin(h); return Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'right' : 'left') : (s > 0 ? 'down' : 'up'); };

/**
 * Head for (tx, tz) at `speed`: slow behind someone in the way (unless `push`: someone in a hurry
 * goes round), lean away from anyone too close, step aside (to the right, as people do) for someone
 * coming the other way, keep to the lane.
 */
export function steer(state, a, tx, tz, speed, push = false) {
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz) || 0.01;
  let ux = dx / d, uz = dz / d;
  let px = 0, pz = 0;
  for (const o of near(state, a.x, a.z, 1.4)) {
    if (o === a || o.hidden) continue;
    const ox = o.x - a.x, oz = o.z - a.z, od = Math.hypot(ox, oz) || 0.01;
    const ahead = (ox * ux + oz * uz) / od;
    if (ahead > 0.7 && od < 1.0) {
      if (push) { px += -uz * 0.9; pz += ux * 0.9; }                // round them, on the left
      else speed = Math.min(speed, Math.max(0.3, (o.vx * ux + o.vz * uz) || 0.5));
    }
    if (od < SPACE_M) { const k = (SPACE_M - od) / SPACE_M; px -= ox / od * k; pz -= oz / od * k; }
    if (ahead > 0.85 && od < 1.4 && (o.vx * ux + o.vz * uz) < 0) { px += -uz * 0.6; pz += ux * 0.6; }
  }
  // Walking along a lane, stay in it: the lanes are laid clear of lamps and kerbs, the margins aren't.
  const band = Object.values(LANES).find(([z0, z1]) => tz >= z0 - 0.01 && tz <= z1 + 0.01);
  if (band && Math.abs(dx) > Math.abs(dz)) {
    if (a.z > band[1]) { pz = Math.min(pz, 0) - 0.5; } else if (a.z < band[0]) { pz = Math.max(pz, 0) + 0.5; }
  }
  ux += px; uz += pz;
  const n = Math.hypot(ux, uz) || 1;
  a.vx = ux / n * speed; a.vz = uz / n * speed;
  a.gait = 'walk';
  a.face = facing(a.vx, a.vz, a.face);
  a.head = Math.atan2(a.vz, a.vx);
}

/** The sprite's facing for a velocity, keeping the old one near the diagonals (no flicker). */
export function facing(vx, vz, was) {
  const ax = Math.abs(vx), az = Math.abs(vz);
  if (ax < 0.01 && az < 0.01) return was;
  const horizontal = (was === 'left' || was === 'right') ? ax > az * 0.8 : ax > az * 1.25;
  return horizontal ? (vx > 0 ? 'right' : 'left') : (vz > 0 ? 'down' : 'up');
}

/** Move a passer-by by their velocity, stepping aside round what blocks them; notice when they're stuck. */
export function walk(state, a) {
  const want = Math.hypot(a.vx, a.vz) * DT;
  let moved = want ? move(state, a, a.vx * DT, a.vz * DT) : 0;
  if (want > 0.01 && moved < want * 0.25) {
    // Blocked (a lamp post, someone's pushed them against the kerb): step sideways, toward their
    // step's point if both ways are free.
    const ux = a.vx / (want / DT), uz = a.vz / (want / DT), side = want * 0.8;
    const step = a.ai.steps[0], tz = step?.[0] === 'go' ? step[2] : a.z;
    const sides = [[-uz, ux], [uz, -ux]].sort((p, q) => Math.abs(a.z + q[1] * side - tz) - Math.abs(a.z + p[1] * side - tz));
    for (const [px, pz] of sides) if (!blocked(state, a.x + px * side, a.z + pz * side)) { moved += move(state, a, px * side, pz * side); break; }
  }
  a.stride += moved;
  if (want > 0.01 && moved < want * 0.25) {
    if ((a.stuck += DT) > STUCK_S) { a.ai.steps.shift(); a.stuck = 0; }
  } else a.stuck = 0;
}
