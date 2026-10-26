// TRADECRAFT sim: passers-by. Throwaway people walking the street, so it lives and a spook can hide in it.
//
// A passer-by is an actor with a seed (their sheet and look come from it: sim/people.js passerby())
// and a plan: a list of steps, made when they appear, from the sections in play.
//   ['go', x, z]                walk to a point
//   ['wait', ticks, face, gait] stand (or sit) there, facing a way
//   ['gone']                    leave the map (through a door, off the end of the street: never in the
//                               open on screen, where they walk on instead)
// They come in from beyond the screen's edges, out of doors, down the side streets and alleys from the
// north and up the lanes from the south, never where the player would see them appear, and leave the
// same ways, so the count around the focus holds near a target that follows the hour (density()).
// On the way some look in a shop window, cross at the zebra, cross to the far pavement (or through
// the park to its south walk), sit a while on a bench, go into a shop or an arch, or turn off north
// or south.
//
// Steering is plain: head for the step's point, slow behind someone in the way, and lean away from
// whoever's closer than SPACE_M. Lanes are laid clear of the street's furniture (sim/map/street.js),
// so nobody needs a path search; someone stuck for STUCK_S drops the step.
import { next, int, range, chance, pick, weighted } from './rng.js';
import { LANES, Z } from './map/street.js';
import { near, move, blocked, sectionAt } from './world.js';
import { eyes, sees } from './perception.js';
import { seedFrom } from './people.js';
import { hourOfDay, TICK_MS } from './clock.js';
import { headOf } from './perception.js';

export const CROWD_PER_100M = 40;                                  // at the busiest hours, along the street
export const WINDOW_M = 45;                                        // passers-by live within this of the focus
export const SPAWN_M = [27, 40];                                   // and come in from this far (off screen: it's 20 m to an edge)
export const SCREEN_HALF_M = [23, 19];                             // the screen round the player, and a margin (nobody leaves in it)
export const SPACE_M = 0.8;
export const STUCK_S = 3;
const DT = TICK_MS / 1000;

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

const laneZ = (r, lane) => range(r, LANES[lane][0], LANES[lane][1]);

/** A passer-by's plan from (x, z) on `lane`, heading `dir` (±1). */
function plan(state, r, x, lane, dir, focusX) {
  const steps = [];
  let z = laneZ(r, lane);
  const end = focusX + dir * (WINDOW_M + 3);
  const S = sectionAt(state, x + dir * 6) ?? sectionAt(state, x);
  const ahead = (v) => (v - x) * dir > 2 && (v - x) * dir < 40;
  // Most walk through; some stop at a shop, cross over, sit on a bench, go in somewhere, or turn off.
  const north = S?.gapsN.filter(g => ahead(g.x0)) ?? [], south = S?.gapsS.filter(g => ahead(g.x0)) ?? [];
  const choice = weighted(r, [['through', 5], ['browse', lane === 'far' ? 1.2 : 0], ['enter', lane === 'far' ? 1.5 : 0],
    ['cross', S?.crossings.length && lane !== 'south' ? 1.6 : 0], ['crossS', S?.crossingsS.length && (lane === 'path' || lane === 'south') ? 1.2 : 0],
    ['sit', lane === 'path' ? 1.2 : 0], ['north', lane === 'far' && north.length ? 1.1 : 0], ['south', lane === 'south' && south.length ? 1.1 : 0]]);
  if (choice === 'browse' || choice === 'enter') {
    const doors = S ? S.doors.filter(d => d.z === Z.front && ahead(d.x) && (choice === 'enter' || d.kind === 'shop')) : [];
    if (doors.length) {
      const d = pick(r, doors);
      if (choice === 'browse') {
        const bx = d.x + (chance(r, 0.5) ? 1.6 : -1.6);
        steps.push(['go', bx, -4.3], ['wait', Math.round(range(r, 3, 12) / DT), 'up', 'idle'], ['go', bx + dir * 2, z]);
      } else {
        steps.push(['go', d.x, -4.4], ['go', d.x, Z.front + 0.3], ['gone']);   // at the door: in
        return steps;
      }
    }
  } else if (choice === 'cross') {
    const c = S.crossings[0], cx = range(r, c.x0 + 0.4, c.x1 - 0.4);
    if ((cx - x) * dir > 0) {
      const to = lane === 'far' ? pick(r, ['near', 'path']) : 'far';
      const z2 = laneZ(r, to === 'path' ? 'near' : to);
      steps.push(['go', cx, z], ['go', cx, z2]);
      if (to === 'path') { z = laneZ(r, 'path'); steps.push(['go', cx, z]); } else z = z2;
    }
  } else if (choice === 'crossS') {                                // over the far road, or through the park
    const c = S.crossingsS[0], cx = range(r, c.x0 + 0.5, c.x1 - 0.5);
    if ((cx - x) * dir > 0) {
      z = laneZ(r, lane === 'path' ? 'south' : 'path');
      steps.push(['go', cx, lane === 'path' ? LANES.path[1] : LANES.south[0]], ['go', cx, z]);
    }
  } else if (choice === 'sit') {
    const benches = S ? S.props.filter(p => p.kind === 'bench' && ahead(p.x)) : [];
    if (benches.length) {
      const b = pick(r, benches), sx = pick(r, b.seats);
      // (a sitter stands just in front of the bench; the renderer sets the card on the seat)
      steps.push(['go', sx, 13.2], ['go', sx, 12.96], ['wait', Math.round(range(r, 20, 120) / DT), 'down', 'sit'], ['go', sx, z]);
    }
  } else if (choice === 'north' || choice === 'south') {         // up a side street or an alley, or down a lane south
    const g = pick(r, choice === 'north' ? north : south), gx = range(r, g.x0 + 0.7, g.x1 - 0.7);
    steps.push(['go', gx, z], ['go', gx, choice === 'north' ? Z.north + 0.6 : Z.edge - 0.4], ['gone']);
    return steps;
  }
  steps.push(['go', end, z], ['gone']);
  return steps;
}

/** Bring a passer-by in: at x (an edge, a door, a side street), on a lane, heading dir. */
function spawn(state, r, x, z, lane, dir, focusX, lead = []) {
  const a = {
    id: `a${state.nextActor++}`, who: null, seed: seedFrom(r), x, z, vx: 0, vz: 0,
    face: dir > 0 ? 'right' : 'left', head: dir > 0 ? 0 : Math.PI, gait: 'idle', stride: 0, stuck: 0,
    ai: { kind: 'walker', speed: range(r, 1.05, 1.6), steps: [...lead, ...plan(state, r, x, lane, dir, focusX)], wait: 0 },
  };
  state.actors.push(a);
  return a;
}

/** Keep the crowd near its target around focusX: let the gone go, bring new ones in. Once a second. */
export function populate(state, focusX, { fill = false } = {}) {
  const r = state.rng;
  state.actors = state.actors.filter(a => !(a.ai?.gone || (a.ai?.kind === 'walker' && Math.abs(a.x - focusX) > WINDOW_M + 6)));
  const target = Math.round(CROWD_PER_100M * (2 * WINDOW_M / 100) * density(state.time.ms) * (state.map.crowd ?? 1));
  const walkers = state.actors.filter(a => a.ai?.kind === 'walker').length;
  const lanes = [['far', 5], ['near', 3.5], ['path', 3], ['south', 2]];
  // Nobody appears where the player would see it happen: on screen and in their sight.
  const me = state.actors.find(a => a.who === state.player), e = me && !fill ? eyes(state, me) : null;
  const unseen = (x, z) => !e || Math.abs(x - me.x) > 21 || Math.abs(z - me.z) > 17 || !sees(state, e, x, z);
  for (let n = walkers; n < target; n++) {
    const lane = weighted(r, lanes);
    if (fill) {                                                    // a map just arrived: people are already about
      const x = focusX + range(r, -WINDOW_M + 2, WINDOW_M - 2);
      spawn(state, r, x, laneZ(r, lane), lane, chance(r, 0.5) ? 1 : -1, focusX);
      continue;
    }
    const where = weighted(r, [['edge', 6], ['door', 2], ['north', 1], ['south', 0.6]]);
    if (where !== 'edge') {
      const S = sectionAt(state, focusX + range(r, -SPAWN_M[1], SPAWN_M[1]));
      let x = null, z0, zl, l = 'far';
      if (where === 'door' && S?.doors.length) { const d = pick(r, S.doors.filter(d => d.z === Z.front)); if (d) { x = d.x; z0 = Z.front + 0.3; } }
      else if (where === 'north' && S?.gapsN.length) { const g = pick(r, S.gapsN); x = range(r, g.x0 + 0.7, g.x1 - 0.7); z0 = Z.north + 0.6; }
      else if (where === 'south' && S?.gapsS.length) { const g = pick(r, S.gapsS); x = range(r, g.x0 + 0.7, g.x1 - 0.7); z0 = Z.edge - 0.4; l = 'south'; }
      if (x !== null && unseen(x, z0)) {
        const dir = chance(r, 0.5) ? 1 : -1;
        zl = laneZ(r, l);
        spawn(state, r, x, z0, l, dir, focusX, [['go', x, zl]]);
        continue;
      }
    }
    const side = chance(r, 0.5) ? 1 : -1;
    spawn(state, r, focusX + side * range(r, SPAWN_M[0], SPAWN_M[1]), laneZ(r, lane), lane, -side, focusX);
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

/** A passer-by decides how to move next tick (their plan done, they've gone), and minds the player. */
export const think = (state, a) => { if (!follow(state, a)) a.ai.gone = true; else notice(state, a); };

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
const TPS = 1000 / TICK_MS;
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
