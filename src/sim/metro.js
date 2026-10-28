// TRADECRAFT sim: the metro, where the city has one (sim/transit.js: its lines and stations; a station's
// building, sim/cities/station.js, its door kind 'metro'). The engine's, in any scene on the street.
//
// At a station's door (stationNear(): on the pavement by it), T: down the steps, and the UI asks where to
// (the bus: 'metro', destinations()): every station on the network, the quickest way there, the lines
// taken and the changes, the minutes (transit.js route(): the wait on the platform, a few minutes a
// station, a change). ride(): the fare (FARE_USD: sim/money.js), the scene's say on who saw you go
// down (scenario.onMetro?.(state, bus, to): else whoever followed on foot has lost you, down there in
// the crowd), the clock skipped, the street there loaded, and you up its steps, at its door.
import { MIN } from './clock.js';
import { Z, SECTION_M, streetName, gapsOf } from './map/street.js';
import { sectionAt } from './world.js';
import { section } from './map/street.js';
import { townOf } from './cities/index.js';
import { network, route } from './transit.js';
import { pay } from './money.js';

export const FARE_USD = 2.5, DOOR_REACH_M = 1.8;

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
  return all.map((s, k) => ({ id: `st${k}`, label: `${names[k]}${names.indexOf(names[k]) !== names.lastIndexOf(names[k]) ? `, on ${streetName(town, s.row)}` : ''}: ${s.lines.join(', change to ')}, ${s.minutes} min`, row: s.row, i: s.i, minutes: s.minutes, lines: s.lines, fare: FARE_USD }));
}

/** The ride: the fare, the minutes, the street there, you up the steps at its station's door; followers on foot lost. Returns the minutes, or nothing. */
export function ride(state, bus, to, { scenario, skip, loadRow }) {
  const me = state.actors.find(a => a.who === state.player), from = state.map.row ?? 0;
  if (!pay(state, bus, to.fare, 'the fare')) return;
  scenario?.onMetro?.(state, bus, to);
  if (state.scenario.outcome) return;
  for (const a of state.actors) if (a.ai?.follow?.id === me.id) a.ai.follow.lost = true;
  skip(state, bus, Math.round(to.minutes * MIN));
  const door = section(townOf(state.map), to.i, to.row).doors.find(d => d.kind === 'metro') ?? { x: (to.i + 0.5) * SECTION_M, z: Z.front };
  Object.assign(me, { row: to.row, x: door.x, z: door.z + 0.8, vx: 0, vz: 0, busy: null, glass: false, hidden: false, face: 'down', head: Math.PI / 2 });
  if (to.row !== from) loadRow(state, bus, to.row, door.x, { quiet: true });
  return to.minutes;
}
