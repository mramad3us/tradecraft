// TRADECRAFT sim: a careful walker's habits on the way somewhere: the checks for a tail that a
// trained man makes without thinking (DESIGN.md: Tailing; The background game).
//
// withHabits() takes a planned route (sim/city.js) and adds them as stops (sim/agents.js), and the
// short detours some need as points:
//   - 'look': on a stretch of pavement now and then (every LOOK_EVERY_M), he slows (the tell, slowM)
//     and stops to look back the way he came;
//   - 'window': along a row of shops (a chance a stretch), he steps to a window and studies the street
//     behind in the glass;
//   - 'shop': or he goes into one (out of sight a while; once a walk) and comes out looking both ways
//     ('exit');
//   - 'cross': at a zebra's kerb, a look both ways (wide);
//   - 'turn': at a lane's mouth, before he turns into it, a look back along the street;
//   - 'pause': he stops, on his phone: no look, but a test of nerve for whoever stops with him.
// All but the pause are checks (stop.check: a follower looks away). How often, by style (STYLES): a
// calm man, a wary one. A detour only where its way is clear (checked
// against the street: clearAt), so a route with habits is as walkable as without.
import { finish, clearAt, sectionOf, LINE } from './city.js';
import { Z, SECTION_M } from './map/street.js';
import { range, chance } from './rng.js';
import { TICK_MS } from './clock.js';

const TPS = 1000 / TICK_MS;
// (A long walk crosses a dozen roads and turns a dozen corners: a check at every one would be one
// every half-minute, so they're a chance each. Calm, some 14 checks on a walk across ten streets;
// wary, some 23.)
export const STYLES = {
  calm: { lookEvery: [55, 100], window: 0.3, shop: 0.12, pause: 0.12, cross: 0.35, turn: 0.45, tell: [1.6, 2.6] },
  wary: { lookEvery: [35, 65], window: 0.4, shop: 0.15, pause: 0.12, cross: 0.6, turn: 0.75, tell: [1.0, 1.8] },
  none: { lookEvery: [1e9, 1e9], window: 0, shop: 0, pause: 0, cross: 0, turn: 0, tell: [1, 1] },
};
const LINES = new Set(['F', 'N', 'P', 'S']);
const ticks = (r, a, b) => Math.round(range(r, a, b) * TPS);

// Which way is back, for someone walking (ux, uz): the sprite facing.
const backOf = (ux, uz) => (Math.abs(ux) >= Math.abs(uz) ? (ux > 0 ? 'left' : 'right') : (uz > 0 ? 'up' : 'down'));

/** A clear straight way between two points on a row (a detour's spur). */
function spur(seed, row, x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0);
  for (let t = 0; t <= d; t += 0.1) if (!clearAt(seed, row, x0 + (x1 - x0) * t / d, z0 + (z1 - z0) * t / d)) return false;
  return true;
}

/**
 * The route with a walker's habits: { pts, cum, length, rows, stops }. r: the dice (the sim's rng);
 * style: STYLES' key. Stops say what they are (kind) for the scenario to act on.
 */
export function withHabits(seed, route, r, style = 'calm') {
  const H = STYLES[style] ?? STYLES.calm;
  const out = [], marks = [];                                      // marks: [point index, stop]
  const push = (p) => { out.push(p); return out.length - 1; };
  let toLook = range(r, ...H.lookEvery), shopDone = false;
  const pts = route.pts;
  push({ ...pts[0] });
  for (let j = 1; j < pts.length; j++) {
    const a = pts[j - 1], b = pts[j], len = b.jump ? 0 : Math.hypot(b.x - a.x, b.z - a.z);
    const ux = len ? (b.x - a.x) / len : 0, uz = len ? (b.z - a.z) / len : 0;
    const iA = out.length - 1;
    // At a zebra's kerb, a look both ways; at a lane's mouth going in, a look back along the street.
    if (a.way === 'zebra' && chance(r, H.cross)) marks.push([iA, { kind: 'cross', check: true, ticks: ticks(r, 1.2, 2), face: uz > 0 ? 'down' : 'up', wide: true, slowM: 1.5 }]);
    if ((a.way === 'side' || a.way === 'alley') && !a.jump && Math.abs(uz) > 0.9 && chance(r, H.turn)) {
      const prev = pts[j - 2], pux = prev ? Math.sign(a.x - prev.x) : 1;
      marks.push([iA, { kind: 'turn', check: true, ticks: ticks(r, 1.2, 2.2), face: pux >= 0 ? 'left' : 'right', slowM: range(r, ...H.tell), lane: a.way }]);
    }
    if (LINES.has(a.way) && len > 0) {
      // Along a stretch of pavement: the looks back at their distances, and along shopfronts (his
      // own pavement, walking along it) a chance of a window or a shop.
      const events = [];
      let t = 0;
      while (t + toLook < len - 2) { t += toLook; toLook = range(r, ...H.lookEvery); events.push({ t, kind: 'look' }); }
      toLook -= len - t;
      if (a.way === 'F' && Math.abs(uz) < 0.1 && len > 8) {
        const c = range(r, 0, 1), lo = Math.min(a.x, b.x) + 3, hi = Math.max(a.x, b.x) - 3;
        const doors = [...new Set([Math.floor(lo / SECTION_M), Math.floor(hi / SECTION_M)])].flatMap(i => sectionOf(seed, a.row, i).doors)
          .filter(d => d.kind === 'shop' && d.z === Z.front && d.x > lo && d.x < hi);
        if (doors.length && c < H.window + (shopDone ? 0 : H.shop)) {
          const door = doors[Math.floor(range(r, 0, doors.length))];
          events.push({ t: (door.x - a.x) * ux, kind: c < H.window ? 'window' : 'shop', door });
        }
      }
      events.sort((p, q) => p.t - q.t);
      for (const ev of events) {
        const x = a.x + ux * ev.t, z = a.z + uz * ev.t;
        const i = push({ row: a.row, x, z, w: a.w, way: a.way });
        if (ev.kind === 'window') {
          const gx = ev.door.x + (chance(r, 0.5) ? 1.4 : -1.4), gz = -4.35;
          if (spur(seed, a.row, gx, z, gx, gz) && spur(seed, a.row, x, z, gx, z)) {
            push({ row: a.row, x: gx, z, w: 0, way: 'attach' });
            const g = push({ row: a.row, x: gx, z: gz, w: 0, way: 'attach' });
            marks.push([g, { kind: 'window', check: true, ticks: ticks(r, 4, 7), face: 'up', glass: true, slowM: range(r, ...H.tell) }]);
            push({ row: a.row, x: gx, z, w: 0, way: 'attach' });
            push({ row: a.row, x, z, w: a.w, way: a.way });
          }
          continue;
        }
        if (ev.kind === 'shop') {
          const dz = Z.front + 0.3;
          if (spur(seed, a.row, x, z, x, dz)) {
            shopDone = true;
            const g = push({ row: a.row, x, z: dz, w: 0, way: 'attach', shop: ev.door.shop });
            marks.push([g, { kind: 'shop', ticks: ticks(r, 20, 45), face: 'up', hidden: true, shop: ev.door.shop }]);
            marks.push([g, { kind: 'exit', check: true, ticks: ticks(r, 1.5, 2.5), face: 'down', wide: true }]);
            push({ row: a.row, x, z, w: a.w, way: a.way });
          }
          continue;
        }
        if (range(r, 0, 1) < H.pause) marks.push([i, { kind: 'pause', ticks: ticks(r, 4, 7), face: 'down' }]);
        else marks.push([i, { kind: 'look', check: true, ticks: ticks(r, 2, 3.5), face: backOf(ux, uz), slowM: range(r, ...H.tell) }]);
      }
    }
    push({ ...b });
  }
  const done = finish(out);
  done.stops = marks.map(([i, st]) => ({ ...st, s: done.cum[i] })).sort((p, q) => p.s - q.s);
  return done;
}

/** Add a stop at the end of a route (a bench to sit on: { kind, ticks, face, gait }). */
export function withEnd(route, stop) {
  route.stops = [...(route.stops ?? []), { ...stop, s: route.length }];
  return route;
}

export { LINE };
