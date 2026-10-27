// TRADECRAFT sim: buses, and the stops you wait for them at (DESIGN.md, Travel: "fast travel between
// points of interest by metro, bus, taxi"; the user, 2026-10-27: "bus shelters and notice boards"). The
// engine's, in any scene on the street.
//
// A shelter stands at the far kerb every few sections (sim/map/street.js amenities(): S.props kind
// 'stop'), its back to the shops, its bench facing the road. At it, T: you sit and wait (sim/acts.js
// 'shelter'), and the street goes by in front of you: a natural place to sit and watch for as long as
// the bus takes, which nobody writes down. Each stop has its line (lineOf(): a number, the same for
// the street) and its timetable (nextBus(): every EVERY_MIN, by the stop; twice as long at night,
// NIGHT_H). When it comes, it waits DWELL_S with its doors open, going north or south (by the bus:
// one each way in turn), and the UI asks where to (the bus: 'bus', destinations()): a street on, two,
// four (the card stops the clock while you choose). Let it go, and you're still sat there for the next.
// ride(): the fare (FARE_USD: sim/money.js), the minutes on the road (PER_ROW_MIN a street, and the
// stops), the clock skipped, the street there loaded and you off at its stop. Unlike a taxi, nobody
// minds a bus; but a man on foot can get on one too. The scene decides who did (scenario.onBus?(state,
// bus, to, 'board' | 'off'): being tailed's riders get off behind you); without one, whoever was
// following has lost you.
import { MIN, hourOfDay } from './clock.js';
import { hash } from './rng.js';
import { sectionAt } from './world.js';
import { section, SECTION_M, lineNumber } from './map/street.js';
import { townOf } from './cities/index.js';
import { pay } from './money.js';
import { say } from './log.js';

export const EVERY_MIN = [6, 8, 10, 12];
export const NIGHT_H = [22, 6];                                    // (from 22:00 to 06:00, half as many)
export const DWELL_S = 20;
export const FARE_USD = 1;
export const PER_ROW_MIN = 4;
export const STOP_Z = -0.68;                                       // (where you sit in it: the bench along its back)
export const OFF_Z = -0.56;                                        // (where you're stood, off the bus: at its kerb)
export const OFFSETS = [[1, 'one street'], [2, 'two streets'], [4, 'four streets']];

/** The shelter actor a is at (on its bench, or in front of it), or null. */
export function stopNear(state, a) {
  if (state.map.kind !== 'street' || a.z < -2.8 || a.z > -0.3) return null;
  return sectionAt(state, a.x)?.props.find(p => p.kind === 'stop' && Math.abs(p.x - a.x) < 1.8) ?? null;
}

/** The street's line: a number, the same at every stop on it. */
export const lineOf = (state, row = state.map.row ?? 0) => lineNumber(townOf(state.map), row);

const everyOf = (state, stop, ms) => {
  const base = EVERY_MIN[hash(townOf(state.map), state.map.row ?? 0, Math.round(stop.x), 'every') % EVERY_MIN.length] * MIN, h = hourOfDay(ms);
  return h >= NIGHT_H[0] || h < NIGHT_H[1] ? base * 2 : base;
};

/** When the next bus is due at this stop, at or after ms; and which way it goes (+1 south, −1 north). */
export function nextBus(state, stop, ms = state.time.ms) {
  const every = everyOf(state, stop, ms), off = hash(townOf(state.map), state.map.row ?? 0, Math.round(stop.x), 'off') % every;
  const k = Math.ceil((ms - off) / every);
  return { at: k * every + off, dir: k % 2 ? 1 : -1 };
}

/** Where this bus could take you: [{ id, label, row, x, fare }]. */
export function destinations(state, stop, dir) {
  const row = state.map.row ?? 0;
  return OFFSETS.map(([n, words], k) => ({ id: `bus${k}`, label: `${words} ${dir > 0 ? 'south' : 'north'}`, row: row + dir * n, x: stop.x, fare: FARE_USD }));
}

/** The stop on that street nearest x (the bus stops at stops), or a place at its kerb. */
function stopOn(state, row, x) {
  const seed = townOf(state.map), i0 = Math.floor(x / SECTION_M);
  let best = null;
  for (let i = i0 - 8; i <= i0 + 8; i++) for (const p of section(seed, i, row).props) if (p.kind === 'stop' && (!best || Math.abs(p.x - x) < Math.abs(best.x - x))) best = p;
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
  if (!b.bus && now >= b.due.at) {
    b.bus = { at: now, dir: b.due.dir };
    say(state, bus, { kind: 'note', text: `The ${lineOf(state)} pulls in, going ${b.due.dir > 0 ? 'south' : 'north'}, and the doors fold open.` });
    bus?.emit('bus', { line: lineOf(state), dir: b.due.dir, list: destinations(state, b.stop, b.due.dir) });
  } else if (b.bus && now - b.bus.at >= DWELL_S * 1000) {
    say(state, bus, { kind: 'note', text: 'The doors close, and the bus pulls away without you.' });
    b.bus = null; b.due = nextBus(state, b.stop, now + 1000);
  }
}

/** On it: the fare, the ride, the street there, you off at its stop. Returns the minutes, or nothing. */
export function ride(state, bus, to, { scenario, skip, loadRow }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  if (!pay(state, bus, to.fare, 'the fare')) return;
  scenario?.onBus?.(state, bus, to, 'board');                       // (the scene's: who saw you get on, and got on too)
  if (state.scenario.outcome) return;
  for (const a of state.actors) if (a.ai?.follow?.id === me.id) a.ai.follow.lost = true;   // (on foot, whoever didn't get on: the scene brings back any who did)
  const minutes = Math.abs(to.row - from) * PER_ROW_MIN + 1;
  skip(state, bus, Math.round(minutes * MIN));
  Object.assign(me, { row: to.row, busy: null, glass: false, vx: 0, vz: 0, face: 'down', head: Math.PI / 2 });
  if (to.row !== from) loadRow(state, bus, to.row, to.x, { quiet: true });
  const at = stopOn(state, to.row, to.x);
  Object.assign(me, { x: at.x, z: at.z });
  scenario?.onBus?.(state, bus, to, 'off');
  return minutes;
}
