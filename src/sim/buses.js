// TRADECRAFT sim: buses, and the stops you wait for them at (DESIGN.md, Travel: "fast travel between
// points of interest by metro, bus, taxi"; the user, 2026-10-27: "bus shelters and notice boards"). The
// engine's, in any scene on the street.
//
// A shelter stands at the far kerb where the city's bus lines stop (sim/transit.js, the network; sim/map/
// street.js amenities(): S.props kind 'stop', its lines on it), its back to the shops, its bench facing
// the road. At it, T: you sit and wait (sim/acts.js 'shelter'), and the street goes by in front of you:
// a natural place to sit and watch for as long as the bus takes, which nobody writes down. The stop's
// timetable (nextBus(): a bus every EVERY_MIN, by the stop; twice as long at night, NIGHT_H) takes its
// lines in turn, each one way then the other along its route. It's sent for on the road in time
// (sim/traffic.js sendBus(): it comes a little early and pulls in at the shelter, its doors at it; with
// no road behind it in play, or late past LATE_S, the clock alone). When it comes, it waits DWELL_S
// with its doors open, its line and the end it's going to on it, and the UI asks where to (the bus:
// 'bus', destinations()): the next stops on its route that way, and only those (the user, 2026-10-27:
// "buses and trains would not drop you off anywhere, they would have a city network and stations").
// Let it go, and you're still sat there for the next. ride(): the fare (FARE_USD: sim/money.js), the
// minutes on the road (STOP_MIN a stop), the clock skipped, the street there loaded and you off at its stop. Unlike a taxi, nobody
// minds a bus; but a man on foot can get on one too. The scene decides who did (scenario.onBus?(state,
// bus, to, 'board' | 'off'): being tailed's riders get off behind you); without one, whoever was
// following has lost you.
import { MIN, hourOfDay } from './clock.js';
import { hash } from './rng.js';
import { sectionAt } from './world.js';
import { section, SECTION_M, streetName } from './map/street.js';
import { lineOf as routeOf, busOnward, STOP_MIN } from './transit.js';
import { townOf } from './cities/index.js';
import { pay } from './money.js';
import { say } from './log.js';
import * as traffic from './traffic.js';

export const EVERY_MIN = [6, 8, 10, 12];
export const NIGHT_H = [22, 6];                                    // (from 22:00 to 06:00, half as many)
export const DWELL_S = 20;
export const LATE_S = 90;
export const FARE_USD = 1;
export const BUS_SHOWN = 8;                                        // (the stops on that a bus's card lists)
export const STOP_Z = -0.68;                                       // (where you sit in it: the bench along its back)
export const OFF_Z = -0.56;                                        // (where you're stood, off the bus: at its kerb)

/** The shelter actor a is at (on its bench, or in front of it), or null. */
export function stopNear(state, a) {
  if (state.map.kind !== 'street' || a.z < -2.8 || a.z > -0.3) return null;
  return sectionAt(state, a.x)?.props.find(p => p.kind === 'stop' && Math.abs(p.x - a.x) < 1.8) ?? null;
}

/** The lines a stop serves (their numbers). */
export const linesOf = (stop) => stop?.lines ?? (stop?.line ? String(stop.line).split(' ') : []);

const everyOf = (state, stop, ms) => {
  const base = EVERY_MIN[hash(townOf(state.map), state.map.row ?? 0, Math.round(stop.x), 'every') % EVERY_MIN.length] * MIN, h = hourOfDay(ms);
  return h >= NIGHT_H[0] || h < NIGHT_H[1] ? base * 2 : base;
};

/** When the next bus is due at this stop, at or after ms; which line it is, and which way along its route it goes (+1 on, −1 back). */
export function nextBus(state, stop, ms = state.time.ms) {
  const every = everyOf(state, stop, ms), off = hash(townOf(state.map), state.map.row ?? 0, Math.round(stop.x), 'off') % every;
  const k = Math.ceil((ms - off) / every), lines = linesOf(stop), n = Math.max(1, lines.length);
  return { at: k * every + off, line: lines[k % n] ?? '?', dir: Math.floor(k / n) % 2 ? 1 : -1 };
}

/** The end of its route a bus is going to, that way: the street it ends on. */
export function terminus(state, line, dir) {
  const L = routeOf(townOf(state.map), `bus${line}`), s = L && (dir > 0 ? L.stops[L.stops.length - 1] : L.stops[0]);
  return s ? streetName(townOf(state.map), s.row) : 'the depot';
}

/** Where this bus could take you: its next stops that way, [{ id, label, row, i, x, n (stops on), fare }]. */
export function destinations(state, stop, line, dir) {
  const town = townOf(state.map), row = state.map.row ?? 0, i = Math.floor(stop.x / SECTION_M);
  return busOnward(town, `bus${line}`, row, i, dir, BUS_SHOWN).map((s, k) => ({ id: `bus${k}`, label: `${streetName(town, s.row)}, ${s.n === 1 ? 'the next stop' : `${s.n} stops`}`, row: s.row, i: s.i, x: (s.i + 0.5) * SECTION_M, n: s.n, fare: FARE_USD }));
}

/** The stop on that street in section i (the line's), else the nearest x, or a place at its kerb. */
function stopOn(state, row, x, i = null) {
  const seed = townOf(state.map), i0 = i ?? Math.floor(x / SECTION_M);
  let best = null;
  if (i !== null) best = section(seed, i, row).props.find(p => p.kind === 'stop') ?? null;
  if (!best) for (let k = i0 - 8; k <= i0 + 8; k++) for (const p of section(seed, k, row).props) if (p.kind === 'stop' && (!best || Math.abs(p.x - x) < Math.abs(best.x - x))) best = p;
  return best ? { x: best.x, z: OFF_Z } : { x, z: OFF_Z };
}

/**
 * Each tick, while you're sat at a stop (busy 'shelter'): the bus comes (the UI asks where to), waits
 * DWELL_S, and goes; and you're sat there for the next.
 */
export function waitTick(state, bus, me) {
  const b = me?.busy;
  if (b?.what !== 'shelter' || !b.stop) return;
  const now = state.time.ms;
  // (sent for, to pull in at the minute: sim/traffic.js; with no road behind it in play, or late past LATE_S, the clock alone)
  if (!b.bus && b.sent === undefined && now >= b.due.at - traffic.busLeadMs(state, b.stop)) { const id = traffic.sendBus(state, b.stop, b.due.at); if (id || now >= b.due.at) b.sent = id; }
  const here = b.sent ? traffic.pulledIn(state, b.sent) : now >= b.due.at;
  if (!b.bus && (here || now >= b.due.at + LATE_S * 1000)) {
    b.bus = { at: now, dir: b.due.dir, line: b.due.line };
    const to = terminus(state, b.due.line, b.due.dir), list = destinations(state, b.stop, b.due.line, b.due.dir);
    // (at the end of its route that way: everyone off, and it goes out of service)
    if (!list.length) { say(state, bus, { kind: 'note', text: `The ${b.due.line} pulls in: the end of its line. Everyone off, and it goes out of service.` }); b.bus.at -= DWELL_S * 1000; }
    else {
      say(state, bus, { kind: 'note', text: `The ${b.due.line} pulls in, for ${to}, and the doors fold open.` });
      bus?.emit('bus', { line: b.due.line, towards: to, list });
    }
  } else if (b.bus && now - b.bus.at >= DWELL_S * 1000) {
    say(state, bus, { kind: 'note', text: 'The doors close, and the bus pulls away without you.' });
    if (b.sent) traffic.release(state, b.sent);
    b.bus = null; b.sent = undefined; b.due = nextBus(state, b.stop, now + 1000);
  }
}

/** On it: the fare, the ride, the street there, you off at its stop. Returns the minutes, or nothing. */
export function ride(state, bus, to, { scenario, skip, loadRow }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  if (!pay(state, bus, to.fare, 'the fare')) return;
  scenario?.onBus?.(state, bus, to, 'board');                       // (the scene's: who saw you get on, and got on too)
  if (state.scenario.outcome) return;
  for (const a of state.actors) if (a.ai?.follow?.id === me.id) a.ai.follow.lost = true;   // (on foot, whoever didn't get on: the scene brings back any who did)
  const minutes = (to.n ?? 1) * STOP_MIN + 1;
  skip(state, bus, Math.round(minutes * MIN));
  Object.assign(me, { row: to.row, busy: null, glass: false, vx: 0, vz: 0, face: 'down', head: Math.PI / 2 });
  if (to.row !== from) loadRow(state, bus, to.row, to.x, { quiet: true });
  const at = stopOn(state, to.row, to.x, to.i);
  Object.assign(me, { x: at.x, z: at.z });
  scenario?.onBus?.(state, bus, to, 'off');
  return minutes;
}
