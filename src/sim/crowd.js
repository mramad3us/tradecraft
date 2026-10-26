// TRADECRAFT sim: passers-by. Throwaway people walking the street, so it lives and a spook can hide in it.
//
// A passer-by is an actor with a seed (their sheet and look come from it: sim/people.js passerby())
// and a plan: a list of steps, made when they appear, from the sections in play.
//   ['go', x, z]                walk to a point
//   ['wait', ticks, face, gait] stand (or sit) there, facing a way
//   ['gone']                    leave the map (through a door, off the end of the street)
// They come in from beyond the screen's edges, out of doors and down side streets, and leave the
// same ways, so the count around the focus holds near a target that follows the hour (density()).
// On the way some look in a shop window, cross at the zebra, take the boulevard's path, sit a while
// on a bench, go into a shop or an arch.
//
// Steering is plain: head for the step's point, slow behind someone in the way, and lean away from
// whoever's closer than SPACE_M. Lanes are laid clear of the street's furniture (sim/map/street.js),
// so nobody needs a path search; someone stuck for STUCK_S drops the step.
import { next, int, range, chance, pick, weighted } from './rng.js';
import { LANES, Z } from './map/street.js';
import { near, move, blocked, sectionAt } from './world.js';
import { seedFrom } from './people.js';
import { hourOfDay, TICK_MS } from './clock.js';

export const CROWD_PER_100M = 40;                                  // at the busiest hours, along the street
export const WINDOW_M = 45;                                        // passers-by live within this of the focus
export const SPAWN_M = [27, 40];                                   // and come in from this far (off screen: it's 20 m to an edge)
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
  // Most walk through; some stop at a shop, cross over, sit on a bench, or go in somewhere.
  const choice = weighted(r, [['through', 5], ['browse', lane === 'far' ? 1.2 : 0], ['enter', lane === 'far' ? 1.5 : 0],
    ['cross', S?.crossings.length ? 1.6 : 0], ['sit', lane === 'path' ? 1.2 : 0], ['side', lane === 'far' && S?.side ? 0.8 : 0]]);
  const ahead = (d) => (d.x - x) * dir > 2 && (d.x - x) * dir < 40;
  if (choice === 'browse' || choice === 'enter') {
    const doors = S ? S.doors.filter(d => ahead(d) && (choice === 'enter' || d.kind === 'shop')) : [];
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
  } else if (choice === 'sit') {
    const benches = S ? S.props.filter(p => p.kind === 'bench' && ahead(p)) : [];
    if (benches.length) {
      const b = pick(r, benches), sx = pick(r, b.seats);
      // (a sitter stands just in front of the bench; the renderer sets the card on the seat)
      steps.push(['go', sx, 13.2], ['go', sx, 12.96], ['wait', Math.round(range(r, 20, 120) / DT), 'down', 'sit'], ['go', sx, z]);
    }
  } else if (choice === 'side') {
    const sx = S.side.x0 + range(r, 1.5, 8.5);
    if ((sx - x) * dir > 0) { steps.push(['go', sx, z], ['go', sx, Z.sideEnd + 1.5], ['gone']); return steps; }
  }
  steps.push(['go', end, z], ['gone']);
  return steps;
}

/** Bring a passer-by in: at x (an edge, a door, a side street), on a lane, heading dir. */
function spawn(state, r, x, z, lane, dir, focusX, lead = []) {
  const a = {
    id: `a${state.nextActor++}`, who: null, seed: seedFrom(r), x, z, vx: 0, vz: 0,
    face: dir > 0 ? 'right' : 'left', gait: 'idle', stride: 0, stuck: 0,
    ai: { kind: 'walker', speed: range(r, 1.05, 1.6), steps: [...lead, ...plan(state, r, x, lane, dir, focusX)], wait: 0 },
  };
  state.actors.push(a);
  return a;
}

/** Keep the crowd near its target around focusX: let the gone go, bring new ones in. Once a second. */
export function populate(state, focusX, { fill = false } = {}) {
  const r = state.rng;
  state.actors = state.actors.filter(a => !(a.ai?.kind === 'walker' && (a.ai.gone || Math.abs(a.x - focusX) > WINDOW_M + 6)));
  const target = Math.round(CROWD_PER_100M * (2 * WINDOW_M / 100) * density(state.time.ms) * (state.map.crowd ?? 1));
  const walkers = state.actors.filter(a => a.ai?.kind === 'walker').length;
  const lanes = [['far', 5], ['near', 2.5], ['path', 3]];
  for (let n = walkers; n < target; n++) {
    const lane = weighted(r, lanes);
    if (fill) {                                                    // a map just arrived: people are already about
      const x = focusX + range(r, -WINDOW_M + 2, WINDOW_M - 2);
      spawn(state, r, x, laneZ(r, lane), lane, chance(r, 0.5) ? 1 : -1, focusX);
      continue;
    }
    const where = weighted(r, [['edge', 6], ['door', 2], ['side', 1]]);
    if (where === 'door' || where === 'side') {
      const S = sectionAt(state, focusX + range(r, -SPAWN_M[1], SPAWN_M[1]));
      const d = where === 'door' ? (S?.doors.length ? pick(r, S.doors) : null) : S?.side ? { x: range(r, S.side.x0 + 1.5, S.side.x1 - 1.5), side: true } : null;
      if (d && Math.abs(d.x - focusX) > 21) {                      // out of sight: nobody pops out of a wall on screen
        const dir = chance(r, 0.5) ? 1 : -1, z0 = d.side ? Z.sideEnd + 1.5 : Z.front + 0.3, zl = laneZ(r, 'far');
        spawn(state, r, d.x, z0, 'far', dir, focusX, [['go', d.x, zl]]);
        continue;
      }
    }
    const side = chance(r, 0.5) ? 1 : -1;
    spawn(state, r, focusX + side * range(r, SPAWN_M[0], SPAWN_M[1]), laneZ(r, lane), lane, -side, focusX);
  }
}

/** A passer-by decides how to move next tick (their velocity, gait and facing). */
export function think(state, a) {
  const ai = a.ai;
  const step = ai.steps[0];
  if (!step) { ai.gone = true; return; }
  if (step[0] === 'gone') { ai.gone = true; a.vx = a.vz = 0; return; }
  if (step[0] === 'wait') {
    a.vx = a.vz = 0; a.face = step[2]; a.gait = step[3];
    if (++ai.wait >= step[1]) { ai.wait = 0; ai.steps.shift(); }
    return;
  }
  const [, tx, tz] = step;
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d < 0.15) { ai.steps.shift(); a.stuck = 0; return think(state, a); }
  let ux = dx / d, uz = dz / d, speed = ai.speed;
  // Make room: slow behind someone in the way, lean away from anyone too close.
  let px = 0, pz = 0;
  for (const o of near(state, a.x, a.z, 1.4)) {
    if (o === a) continue;
    const ox = o.x - a.x, oz = o.z - a.z, od = Math.hypot(ox, oz) || 0.01;
    const ahead = (ox * ux + oz * uz) / od;
    if (ahead > 0.7 && od < 1.0) speed = Math.min(speed, Math.max(0.3, (o.vx * ux + o.vz * uz) || 0.5));
    if (od < SPACE_M) { const k = (SPACE_M - od) / SPACE_M; px -= ox / od * k; pz -= oz / od * k; }
    // Someone straight ahead coming the other way: step aside, to the right as people do.
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
