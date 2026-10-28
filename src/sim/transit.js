// TRADECRAFT sim: a city's transit network (the user, 2026-10-27: "make sure we can take buses,
// underground (especially in london) where applicable"; "buses and trains would not drop you off
// anywhere, they would have a city network and stations"). Pure data from the town alone (kept by
// town), so a street knows its stops and its station without building anything else.
//
// The streets are rows (row 0; −1 north, +1 south) and along each, sections of SECTION_M; the network
// covers the middle of the city, AREA rows each way and AREA_I sections each way.
//   - **Bus lines** (BUS_LINES of them, numbered as the city numbers its buses): each a route of stops,
//     a stop a section of a street. It runs along a street two to four stops at a time, a section or
//     two apart, then turns up or down a side street to the next street but one, and on along that.
//     Both ways. A section a line stops in has a shelter (sim/map/street.js amenities() puts it, its
//     exact x the street's), the lines on its sign. A bus goes only to the stops of its own line.
//   - **The metro**, where the city has one (METRO: London's Underground, Moscow's metro, Cairo's;
//     Beirut's buses and service taxis are all it has): two or three lines, one along a street with a
//     station every six to nine sections, one across the streets with a station every second one,
//     London's third along another street; where two cross, one station for both (a change). A
//     station is a building of its own on its street (sim/cities/station.js), its sign over a wide
//     door. A ride goes anywhere on the network, changing where it must (route()).
// Names: a stop's, its street's; a station's, its street's (in the city's own way: "Ladbroke Grove",
// "Ostozhenka").
import { stream, int, pick, chance, hash } from './rng.js';
import { cityOf } from './cities/index.js';

export const AREA = 6, AREA_I = 14, BUS_LINES = 6;
export const STOP_MIN = 1.6, STATION_MIN = 2.2, CHANGE_MIN = 4, WAIT_MIN = 3;   // (a bus between stops; a train between stations; a change; the wait on the platform)

// The cities' metros: their lines' names and colours; the cities' bus numbers.
export const METRO = {
  london: { name: 'Underground', lines: [['Central', 0xc4302b], ['Northern', 0x23252f], ['District', 0x24803c]] },
  moscow: { name: 'Metro', lines: [['Sokolnicheskaya', 0xc4302b], ['Zamoskvoretskaya', 0x24803c], ['Koltsevaya', 0x8f6345]] },
  cairo: { name: 'Metro', lines: [['Line 1', 0xc4302b], ['Line 2', 0xe7b84a]] },
};
const BUS_NUMBERS = { london: [7, 23, 28, 31, 52, 70, 94, 148, 295, 452], moscow: [3, 15, 31, 39, 45, 64, 101, 144, 255, 904], cairo: [11, 24, 33, 66, 92, 150, 357, 500], beirut: [2, 4, 5, 6, 8, 12, 15, 24] };

const nets = new Map();
const key = (row, i) => `${row}|${i}`;

/** The town's network: { lines: [{ id, kind: 'bus' | 'metro', name, colour, stops: [{ row, i }] }], at: Map 'row|i' → [line ids], stations: Map 'row|i' → [line ids] }. */
export function network(town) {
  if (nets.has(town)) return nets.get(town);
  const P = cityOf(town), city = P.id ?? 'moscow', r = stream('transit', town), lines = [];
  const inArea = (row, i) => Math.abs(row) <= AREA && Math.abs(i) <= AREA_I;
  // The buses: along a street, up a side street, along the next.
  const numbers = (BUS_NUMBERS[city] ?? BUS_NUMBERS.moscow).slice();
  for (let n = 0; n < BUS_LINES; n++) {
    const no = numbers.splice(int(r, numbers.length), 1)[0];
    let row = int(r, 2 * AREA + 1) - AREA, i = -AREA_I + int(r, 4), dir = 1, run = 0, len = 2 + int(r, 3);
    const stops = [];
    for (let k = 0; k < 40 && stops.length < 16 && inArea(row, i); k++) {
      if (!stops.some(s => s.row === row && s.i === i)) stops.push({ row, i });
      if (++run >= len) { run = 0; len = 2 + int(r, 3); const up = row >= AREA - 1 ? -2 : row <= -AREA + 1 ? 2 : pick(r, [-2, 2]); row += up; }
      i += dir * (1 + int(r, 2));
      if (Math.abs(i) > AREA_I) { dir = -dir; i += 2 * dir * 2; }
    }
    if (stops.length >= 5) lines.push({ id: `bus${no}`, kind: 'bus', name: String(no), colour: 0x9e3c36, stops });
  }
  // (a street none of them runs along gets a local line of its own: every street has its bus)
  for (let row = -AREA; row <= AREA; row++) {
    if (lines.some(L => L.stops.some(s => s.row === row))) continue;
    const no = numbers.length ? numbers.splice(int(r, numbers.length), 1)[0] : 100 + row + AREA, stops = [];
    for (let i = -AREA_I + int(r, 3); i <= AREA_I; i += 3 + int(r, 2)) stops.push({ row, i });
    lines.push({ id: `bus${no}`, kind: 'bus', name: String(no), colour: 0x9e3c36, stops });
  }
  // The metro, if there's one: along a street, across the streets, and in London a second along.
  const M = METRO[city];
  if (M) {
    const rowA = int(r, 3) - 1, iB = int(r, 9) - 4;
    const along = (row, i0, i1) => { const out = []; for (let i = i0; i <= i1; i += 6 + int(r, 4)) out.push({ row, i }); return out; };
    const a = along(rowA, -AREA_I, AREA_I), b = [];
    // (every second street, on the along line's own: where they cross, one station, a change; and the third's, four streets off)
    for (let row = -AREA + Math.abs(rowA % 2); row <= AREA; row += 2) b.push({ row, i: row === rowA ? nearestI(a, iB) : iB + int(r, 3) - 1 });
    lines.push({ id: 'm0', kind: 'metro', name: M.lines[0][0], colour: M.lines[0][1], stops: a });
    lines.push({ id: 'm1', kind: 'metro', name: M.lines[1][0], colour: M.lines[1][1], stops: b });
    if (M.lines[2]) {
      const rowC = rowA + (chance(r, 0.5) ? 4 : -4), c = along(rowC, -AREA_I + 3, AREA_I - 3);
      const cross = b.find(s => s.row === rowC);
      if (cross) { const k = c.reduce((best, s, j) => (Math.abs(s.i - cross.i) < Math.abs(c[best].i - cross.i) ? j : best), 0); c[k] = { row: rowC, i: cross.i }; }
      lines.push({ id: 'm2', kind: 'metro', name: M.lines[2][0], colour: M.lines[2][1], stops: c });
    }
  }
  const at = new Map(), stations = new Map();
  for (const L of lines) for (const s of L.stops) { const m = L.kind === 'bus' ? at : stations; m.set(key(s.row, s.i), [...(m.get(key(s.row, s.i)) ?? []), L.id]); }
  const net = { city, lines, at, stations, metro: M ?? null };
  nets.set(town, net);
  return net;
}
const nearestI = (stops, i) => stops.reduce((best, s) => (Math.abs(s.i - i) < Math.abs(best - i) ? s.i : best), stops[0].i);

/** The bus lines that stop in section i of a row (their names), or []. */
export const busLinesAt = (town, row, i) => (network(town).at.get(key(row, i)) ?? []).map(id => network(town).lines.find(L => L.id === id).name);
/** The metro lines with a station in section i of a row ([{ name, colour }]), or null. */
export function stationAt(town, row, i) {
  const net = network(town), ids = net.stations.get(key(row, i));
  return ids ? ids.map(id => { const L = net.lines.find(x => x.id === id); return { id, name: L.name, colour: L.colour }; }) : null;
}

/** A line by id. */
export const lineOf = (town, id) => network(town).lines.find(L => L.id === id) ?? null;

/**
 * Where a bus of line `id` goes from the stop at (row, i), going `dir` along its route (+1 on, −1 back):
 * the next stops, [{ row, i, n (stops on) }], up to `max`.
 */
export function busOnward(town, id, row, i, dir, max = 8) {
  const L = lineOf(town, id), k = L?.stops.findIndex(s => s.row === row && s.i === i) ?? -1;
  if (k < 0) return [];
  const out = [];
  for (let j = k + dir, n = 1; j >= 0 && j < L.stops.length && out.length < max; j += dir, n++) out.push({ ...L.stops[j], n });
  return out;
}

/**
 * Every station reachable from the one at (row, i), by the quickest way, changing where the lines
 * cross: [{ row, i, lines (the names taken, in order), minutes }], the nearest first.
 */
export function route(town, row, i) {
  const net = network(town), start = key(row, i);
  if (!net.stations.has(start)) return [];
  const best = new Map([[start, { mins: 0, lines: [], via: null }]]), open = [start];
  while (open.length) {
    open.sort((a, b) => best.get(a).mins - best.get(b).mins);
    const at = open.shift(), here = best.get(at);
    for (const id of net.stations.get(at)) {
      const L = net.lines.find(x => x.id === id), k = L.stops.findIndex(s => key(s.row, s.i) === at);
      for (const dir of [-1, 1]) for (let j = k + dir, n = 1; j >= 0 && j < L.stops.length; j += dir, n++) {
        const to = key(L.stops[j].row, L.stops[j].i), change = here.lines.length && here.lines[here.lines.length - 1] !== L.name ? CHANGE_MIN : 0;
        const mins = here.mins + change + n * STATION_MIN, lines = here.lines[here.lines.length - 1] === L.name ? here.lines : [...here.lines, L.name];
        if (!best.has(to) || best.get(to).mins > mins) { best.set(to, { mins, lines }); open.push(to); }
      }
    }
  }
  return [...best].filter(([k]) => k !== start).map(([k, v]) => { const [r0, i0] = k.split('|').map(Number); return { row: r0, i: i0, lines: v.lines, minutes: Math.round(v.mins + WAIT_MIN) }; }).sort((a, b) => a.minutes - b.minutes);
}

/** A stable small number from the town, for a station's look. */
export const stationSeed = (town, row, i) => hash(town, row, i, 'station') % 1000;
