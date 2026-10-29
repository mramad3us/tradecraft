// TRADECRAFT sim: the metro, where the city has one (sim/transit.js: its lines and stations; a station's
// building, sim/cities/station.js, its door kind 'metro'). The engine's, in any scene on the street.
//
// At a station's door (stationNear(): on the pavement by it), T: down the steps, and the UI asks where to
// (the bus: 'metro', destinations()): every station on the network, the quickest way there, the lines
// taken and the changes, the minutes (transit.js route(): the wait on the platform, a few minutes a
// station, a change). ride(): the fare (FARE_USD: sim/money.js), the scene's say on who saw you go
// down (scenario.onMetro?.(state, bus, to); and again, 'up', once you're up), the clock skipped, the street
// there loaded, and you up its steps, at its door.
// **Who rides with you** (riders(); DESIGN.md, Being tailed: "still to come: the metro"): a follower
// within BOARD_M who saw you go down can get on the same train; then each leg (a line; a change is a
// second) is your Deception against their Tracking, they +NEAR_MOD on your heels (NEAR_M), you +RUSH_MOD
// in the rush hours' crowd (RUSH_H), and on the last, if you step off as the doors close (the ride's
// 'doors', LAST_MIN more on the clock), +LAST_MOD. Lost on any leg, they're lost; kept, they come up the
// steps behind you (RIDER_S after you), still on you. Out of sight or too far back, lost at the barrier.
import { MIN } from './clock.js';
import { Z, SECTION_M, streetName, gapsOf } from './map/street.js';
import { sectionAt } from './world.js';
import { section } from './map/street.js';
import { townOf } from './cities/index.js';
import { network, route } from './transit.js';
import { pay } from './money.js';
import { opposed } from './checks.js';
import { skill } from './skills.js';
import { seesActor } from './perception.js';
import { calendar } from './clock.js';
import { range } from './rng.js';

export const FARE_USD = 2.5, DOOR_REACH_M = 1.8;
export const BOARD_M = 25, NEAR_M = 8, NEAR_MOD = 2, RUSH_MOD = 2, LAST_MOD = 4, LAST_MIN = 5, RIDER_S = [4, 12];
export const RUSH_H = [[7.5, 9.5], [17, 19]];

/** The station door actor a stands at (on the pavement by it), or null. */
export function stationNear(state, a) {
  if (state.map.kind !== 'street' || a.z < Z.front - 0.3 || a.z > Z.front + 1.8) return null;
  return sectionAt(state, a.x)?.doors.find(d => d.kind === 'metro' && Math.abs(d.x - a.x) < DOOR_REACH_M) ?? null;
}

/** The network's name in the city (the Underground, the metro). */
export const metroName = (state) => network(townOf(state.map)).metro?.name ?? 'Metro';

/**
 * A station's name: the side street nearest it (stations along one street can't all be named for it),
 * or, with none near, its street's.
 */
export function stationName(town, row, i) {
  const at = (i + 0.5) * SECTION_M;
  let best = null;
  for (const j of [i, i - 1, i + 1]) for (const g of gapsOf(town, row, j)) if (g.name && g.kind === 'side' && (!best || Math.abs((g.x0 + g.x1) / 2 - at) < Math.abs((best.x0 + best.x1) / 2 - at))) best = g;
  return best?.name ?? streetName(town, row);
}

/** Where you can go from this station: [{ id, label, row, i, minutes, lines, fare }], the nearest first. */
export function destinations(state, d) {
  const town = townOf(state.map), row = state.map.row ?? 0, i = Math.floor(d.x / SECTION_M);
  const all = route(town, row, i), names = all.map(s => stationName(town, s.row, s.i));
  // (two of a name: each with its street)
  return all.map((s, k) => ({ id: `st${k}`, label: `${names[k]}${names.indexOf(names[k]) !== names.lastIndexOf(names[k]) ? `, on ${streetName(town, s.row)}` : ''}: ${s.lines.join(', change to ')}, ${s.minutes} min`, name: names[k], row: s.row, i: s.i, minutes: s.minutes, lines: s.lines, fare: FARE_USD }));
}

/** Whoever's following you that gets on your train and stays with you to the end ([actors]); the rest lost. doors: off as they close, on the last leg. */
export function riders(state, me, to, doors = false) {
  const out = [];
  for (const a of state.actors) {
    const f = a.ai?.follow;
    if (f?.id !== me.id || f.lost) continue;
    const them = state.people[a.who], d = Math.hypot(a.x - me.x, a.z - me.z);
    if (d <= BOARD_M && seesActor(state, a, me) && !!them && stays(state, them, to, d, doors)) out.push(a); else f.lost = true;
  }
  return out;
}

/**
 * Whether one who went down after you (them: a sheet; d: how far back they were) stays with you to the
 * end of the ride to: each leg your Deception against their Tracking (sim/scenarios/sdr.js onMetro() too).
 */
export function stays(state, them, to, d, doors = false) {
  const k = calendar(state.time.ms), h = k.hour + k.minute / 60, rush = k.weekday < 5 && RUSH_H.some(([a, b]) => h >= a && h < b), you = state.people[state.player];
  for (let leg = 0; leg < Math.max(1, to.lines.length); leg++) {
    const last = leg === Math.max(1, to.lines.length) - 1;
    const r = opposed(state.rng, { skill: 'deception', value: skill(you, 'deception'), body: you, mods: [rush && { why: 'the rush hour\'s crowd', v: RUSH_MOD }, last && doors && { why: 'off as the doors close', v: LAST_MOD }].filter(Boolean) },
      { skill: 'tracking', value: skill(them, 'tracking'), body: them, mods: d <= NEAR_M ? [{ why: 'on your heels', v: NEAR_MOD }] : [] });
    if (r.ok) return false;
  }
  return true;
}

/** Once a second: whoever rode with you comes up the steps when it's time. */
export function stepsTick(state) {
  for (const a of state.actors) if (a.steps && a.steps <= state.time.ms) { delete a.steps; a.hidden = false; }
}

/** The ride: the fare, the minutes, the street there, you up the steps at its station's door; whoever rode with you up after you (riders()). Returns the minutes, or nothing. */
export function ride(state, bus, to, { scenario, skip, loadRow, doors = false }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  if (!pay(state, bus, to.fare, 'the fare')) return;
  scenario?.onMetro?.(state, bus, { ...to, doors });                // (the scene's: who saw you go down, and went down too)
  if (state.scenario.outcome) return;
  const with_ = riders(state, me, to, doors), minutes = to.minutes + (doors ? LAST_MIN : 0);
  skip(state, bus, Math.round(minutes * MIN));
  const door = section(townOf(state.map), to.i, to.row).doors.find(d => d.kind === 'metro') ?? { x: (to.i + 0.5) * SECTION_M, z: Z.front };
  Object.assign(me, { row: to.row, x: door.x, z: door.z + 0.8, vx: 0, vz: 0, busy: null, glass: false, hidden: false, face: 'down', head: Math.PI / 2 });
  // (up the steps a few seconds after you, on you still: down in the station till then, out of sight; their trail starts again at the door)
  for (const a of with_) {
    const up = state.time.ms + Math.round(range(state.rng, ...RIDER_S) * 1000);
    Object.assign(a, { row: to.row, x: door.x + range(state.rng, -0.6, 0.6), z: door.z + 0.5, vx: 0, vz: 0, gait: 'idle', hidden: true, steps: up });
    a.ai.downUntil = up;
    Object.assign(a.ai.follow, { trail: [], seenMs: up, contactUntil: up + 8000, search: 0 });
  }
  if (to.row !== from) loadRow(state, bus, to.row, door.x, { quiet: true });
  scenario?.onMetro?.(state, bus, { ...to, doors }, 'up');          // (up: the scene's own who kept with you, being tailed's)
  return minutes;
}
