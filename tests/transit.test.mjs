// The city's transit network (sim/transit.js): bus lines on every street of the middle of the city, the
// metro's lines and stations where the city has one (London, Moscow, Cairo; not Beirut), every station
// reachable from every other; a station a building of its own with its one wide door; at it, T, the
// stations listed the quickest way, and a ride that leaves you at the one you chose, up its steps
// (sim/metro.js).
import { newGame, start, step, playerActor, loadRow } from '../src/sim/game.js';
import { network, route, stationAt, AREA } from '../src/sim/transit.js';
import { stationNear, destinations, stationName } from '../src/sim/metro.js';
import { affordance } from '../src/sim/acts.js';
import { sectionOf } from '../src/sim/city.js';
import { townOf } from '../src/sim/cities/index.js';
import { Z } from '../src/sim/map/street.js';
import { cashOf } from '../src/sim/money.js';
import { assert, fmt } from './helpers.mjs';

export default [
  {
    name: 'metro: every station a name of its own (a line across runs up one side street: the next side street near it, or its own street)',
    fn() {
      let n = 0, dup = 0, towns = 0;
      for (const city of ['london', 'moscow', 'cairo']) for (let seed = 1; seed <= 40; seed++) {
        const town = `${city}:${seed}`, net = network(town);
        if (!net.stations.size) continue;
        const names = [...net.stations.keys()].map(k => { const [row, i] = k.split('|').map(Number); return stationName(town, row, i); });
        n += names.length; dup += names.length - new Set(names).size; towns++;
      }
      console.log(`      ${n} stations in ${towns} towns' networks: ${dup} sharing a name`);
      assert(dup === 0, 'no two stations of a network share a name');
    },
  },
  {
    name: 'transit: a bus line on every street of the middle of the city; the metro where the city has one, every station reachable, each a building with its door',
    fn() {
      const out = [];
      for (const city of ['london', 'moscow', 'cairo', 'beirut']) for (let seed = 1; seed <= 25; seed++) {
        const town = townOf({ seed, city }), net = network(town), buses = net.lines.filter(L => L.kind === 'bus'), metro = net.lines.filter(L => L.kind === 'metro');
        for (let row = -AREA; row <= AREA; row++) assert(buses.some(L => L.stops.some(s => s.row === row)), `${city} ${seed}: a bus on street ${row}`);
        if (city === 'beirut') { assert(!metro.length && !net.stations.size, 'Beirut: buses, no metro'); continue; }
        assert(metro.length >= 2, `${city} ${seed}: a metro`);
        const [r0, i0] = [...net.stations.keys()][0].split('|').map(Number);
        assert(route(town, r0, i0).length === net.stations.size - 1, `${city} ${seed}: every station reachable`);
        if (seed <= 3) for (const k of net.stations.keys()) {
          const [row, i] = k.split('|').map(Number), S = sectionOf(town, row, i), d = S.doors.filter(o => o.kind === 'metro');
          assert(d.length === 1 && S.buildings.some(B => B.style === 'station' && d[0].x > B.x0 && d[0].x < B.x1), `${city} ${seed}: the station at ${k}, a building with its door`);
        }
        if (seed === 1) out.push(`${city}: ${buses.length} bus lines, ${metro.map(L => `${L.name} (${L.stops.length})`).join(', ')}`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'transit: at a station\'s door, T: down; the stations the quickest way, changes and all; the ride leaves you at the one you chose, up its steps, the fare paid',
    fn() {
      const out = [];
      for (const [city, seed] of [['london', 4], ['moscow', 6], ['cairo', 8]]) {
        const g = newGame({ seed, scenario: 'walk', city, weather: 'clear' });
        start(g, null);
        const town = townOf(g.map), me = playerActor(g), asked = [], bus = { emit: (k, v) => { if (k === 'metro') asked.push(v); }, on() {} };
        const [row, i] = [...network(town).stations.keys()].map(k => k.split('|').map(Number)).sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]))[0];
        const door = sectionOf(town, row, i).doors.find(d => d.kind === 'metro');
        if (row !== (g.map.row ?? 0)) loadRow(g, null, row, door.x, { quiet: true });
        Object.assign(me, { row, x: door.x, z: Z.front + 0.8, busy: null });
        for (let t = 0; t < 10; t++) step(g, {}, bus);
        assert(stationNear(g, me) && affordance(g, me)?.act === 'metro', `${city}: at the station's door, R offers it`);
        step(g, { act: ['use'] }, bus);
        const list = asked[0]?.list ?? [];
        assert(list.length === network(town).stations.size - 1 && list.every((d, k) => !k || d.minutes >= list[k - 1].minutes), `${city}: every other station, the nearest first`);
        const to = list[list.length - 1], t0 = g.time.ms, cash = cashOf(g.people[g.player]);
        step(g, { act: [`metro:${to.id}`] }, bus);
        const there = sectionOf(town, to.row, to.i).doors.find(d => d.kind === 'metro');
        assert(g.map.row === to.row && Math.abs(me.x - there.x) < 0.01 && !me.hidden && cashOf(g.people[g.player]) < cash, `${city}: at ${to.label}, up its steps, paid`);
        out.push(`${city}: from ${stationName(town, row, i)} to ${to.label} (${fmt((g.time.ms - t0) / 60000, 0)} min)`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
];
