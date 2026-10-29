// Buses (sim/buses.js): shelters at the far kerb in every city where the network's lines stop
// (sim/transit.js), room to walk round into them, and notice boards in the parks (sim/map/street.js
// amenities()); sat at one, the bus comes on its timetable, waits, and takes you to a stop on its own
// line, for its fare; being tailed's team
// gets on with you if they saw you and were near enough (an overt pair; a covert team's nearest, and
// its car), and gets off behind you; nobody minds a bus (it isn't written down). Whoever follows you
// gets on too, and off behind you; off as the doors close, by your Deception against their Tracking,
// they may be carried on.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { makeAgent, follow } from '../src/sim/agents.js';
import { sheet } from '../src/sim/people.js';
import { riders } from '../src/sim/buses.js';
import { Z } from '../src/sim/map/street.js';
import { section, SECTION_M } from '../src/sim/map/street.js';
import { townOf } from '../src/sim/cities/index.js';
import { cashOf } from '../src/sim/money.js';
import { OFF_Z, EVERY_MIN, DWELL_S, destinations } from '../src/sim/buses.js';
import { network, busLinesAt } from '../src/sim/transit.js';
import { goTo } from './bots.mjs';
import { assert, fmt } from './helpers.mjs';

/** The stop on the player's street nearest them. */
function nearestStop(g) {
  const me = playerActor(g), i0 = Math.floor(me.x / SECTION_M);
  let best = null;
  for (let i = i0 - 14; i <= i0 + 14; i++) for (const p of section(townOf(g.map), i, g.map.row ?? 0).props) if (p.kind === 'stop' && (!best || Math.abs(p.x - me.x) < Math.abs(best.x - me.x))) best = p;
  return best;
}

/** Walk to the stop, sit, wait for the bus, and take it `which` (bus0: a street on); returns what happened. */
function takeBus(g, which = 'bus0', bus = null, doors = false) {
  const st = nearestStop(g), sc = g.scenario;
  let t = 0;
  for (; t < 25 * 60 * 6 && !(playerActor(g).busy?.what === 'shelter'); t++) {
    const me = playerActor(g);
    const input = Math.abs(me.x - st.x) < 1.2 && me.z > -2.8 && me.z < -1.6 ? { act: ['use'] } : goTo(g, me, g.map.row ?? 0, st.x + 0.6, -2.3);
    step(g, input, bus);
    if (sc.outcome) return null;
  }
  const sat = g.time.ms, row = g.map.row ?? 0, cash = cashOf(g.people[g.player]);
  for (t = 0; t < 25 * 60 * 30 && !playerActor(g).busy?.bus; t++) step(g, {}, bus);
  const came = g.time.ms, dir = playerActor(g).busy?.bus?.dir, line = playerActor(g).busy?.bus?.line;
  if (!dir) return { stop: st, waited: (came - sat) / 60000 };
  const list = destinations(g, st, line, dir), want = list.find(d => d.id === which) ?? list[0];
  step(g, { act: [`bus:${want?.id ?? which}${doors ? ':doors' : ''}`] }, bus);
  const there = nearestStop(g);
  return { stop: st, waited: (came - sat) / 60000, dir, line, want, rode: (g.time.ms - came) / 60000, rows: (g.map.row ?? 0) - row, paid: cash - cashOf(g.people[g.player]), to: there?.x };
}

/** London, seed 7: you, and a follower behind you on the pavement, after you. */
function followed({ tracking = 10, deception = 10, back = 6 } = {}) {
  const g = newGame({ seed: 7, city: 'london', weather: 'clear' });
  start(g, null);
  const me = playerActor(g), row = g.map.row ?? 0;
  g.people.me.skills.deception = [deception, 0];
  g.people.fsb = sheet({ id: 'fsb', name: 'a watcher', sex: 'm', cls: 'civilian', skills: { tracking: [tracking, 0], awareness: [8, 0] } });
  Object.assign(me, { face: 'right', z: -2.3 });
  const a = makeAgent(g, { who: 'fsb', row, x: me.x - back, z: -2.6, face: 'right' });
  follow(g, a, me, 8);
  for (let t = 0; t < 3; t++) step(g, {}, null);
  return { g, me, a };
}

export default [
  {
    name: 'buses: whoever follows you and saw you get on gets on too; off as the doors close, by your Deception against their Tracking, carried on; too far back, left at the stop',
    fn() {
      const N = 400, rows = [];
      const rate = (opts, doors) => { const { g, me, a } = followed(opts); let on = 0; for (let k = 0; k < N; k++) { a.ai.follow.lost = false; on += riders(g, me, doors).length; } return on / N; };
      for (const [label, opts] of [['even (10 v 10)', {}], ['a better watcher (10 v 18)', { tracking: 18 }], ['a better officer (18 v 10)', { deception: 18 }]]) rows.push([label, rate(opts, false), rate(opts, true)]);
      const far = rate({ back: 40 }, false);
      for (const [label, plain, doors] of rows) console.log(`      ${label}: on with you ${Math.round(plain * 100)}%, still with you off as the doors close ${Math.round(doors * 100)}%`);
      console.log(`      40 m back: ${Math.round(far * 100)}%`);
      const [even, watcher, officer] = rows;
      assert(rows.every(r => r[1] === 1), 'seen getting on, near: on with you');
      assert(watcher[2] > even[2] && even[2] > officer[2] && even[2] < 0.8, 'the doors: Tracking keeps you, Deception loses them');
      assert(far === 0, 'too far back: left at the stop');
    },
  },
  {
    name: 'buses: a follower on the bus with you gets off behind you, a few seconds on, and follows on',
    fn() {
      const { g, me, a } = followed({ tracking: 30, deception: 0 });
      const r = takeBus(g);
      assert(r?.dir, 'a bus came');
      const hid = a.hidden, row = a.row === g.map.row;
      let offS = null;
      for (let t = 0; t < 20 * 10 && offS === null; t++) { step(g, {}, null); if (!a.hidden) offS = t / 20; }
      for (let t = 0; t < 20 * 15; t++) step(g, { mx: 0.6 }, null);
      const d = Math.hypot(a.x - me.x, a.z - me.z);
      console.log(`      a watcher on the bus with you: on your street ${row}, out of sight at first ${hid}, off ${offS} s after you; fifteen seconds' walk on: ${Math.round(d)} m behind, still on you ${!a.ai.follow.lost}`);
      assert(row && hid && offS >= 1.5 && offS <= 5.5 && !a.ai.follow.lost && d < 30, 'off after you, and on you still');
    },
  },
  {
    name: 'buses: a shelter where the network\'s lines stop, in every city, its lines on it, room at its ends; notice boards in half the parks',
    fn() {
      for (const [city, town] of [['Moscow', 7], ['London', 'london:7'], ['Beirut', 'beirut:7'], ['Cairo', 'cairo:7']]) {
        let n = 0, stops = 0, parks = 0, boards = 0, wanted = 0, stray = 0;
        for (let row = -4; row <= 4; row++) for (let i = 0; i < 13; i++) {
          const S = section(town, i, row), lines = busLinesAt(town, row, i);
          n++; wanted += lines.length > 0;
          for (const st of S.props.filter(p => p.kind === 'stop')) {
            stops++;
            if (!lines.length || st.lines.join() !== lines.join()) stray++;
            // (round its ends, at a walker's width: clear)
            for (const x of [st.x - st.w / 2 - 0.45, st.x + st.w / 2 + 0.45]) for (const z of [-1.7, -1.0, -0.56])
              assert(!S.blockers.some(b => x + 0.25 > b.x0 && x - 0.25 < b.x1 && z + 0.25 > b.z0 && z - 0.25 < b.z1), `${city} row ${row}: the end of the shelter at ${fmt(st.x, 1)} blocked at (${fmt(x, 1)}, ${z})`);
            assert(!S.blockers.some(b => b.what === 'car' && Math.abs((b.x0 + b.x1) / 2 - st.x) < 4.6 && b.z1 < 5), `${city}: a car parked in the bus's bay`);
          }
          if (S.band === 'park' || S.band === 'boulevard') { parks++; boards += S.props.filter(p => p.kind === 'notices').length; }
        }
        const net = network(town);
        console.log(`      ${city}: ${net.lines.filter(L => L.kind === 'bus').map(L => L.name).join(', ')}: ${stops} shelters for ${wanted} stops in ${n} sections (one every ${fmt(n * SECTION_M / stops, 0)} m of street); notice boards in ${boards} of ${parks} parks and boulevards`);
        assert(stray === 0 && stops >= wanted * 0.85 && boards >= parks / 4, `${city}: a shelter at the stops (${stops} of ${wanted}), none elsewhere (${stray}); boards`);
      }
    },
  },
  {
    name: 'buses: sat in the shelter, the bus comes on its timetable; on it, one of its own line\'s stops for its fare, off at the stop there',
    fn() {
      const got = [];
      for (let seed = 1; seed <= 6; seed++) {
        const g = newGame({ seed, scenario: 'walk', weather: 'clear' });
        start(g, null);
        const asked = [], bus = { emit: (k, v) => { if (k === 'bus') asked.push(v); }, on() {} };
        const r = takeBus(g, seed % 2 ? 'bus0' : 'bus1', bus);
        const me = playerActor(g);
        got.push(r);
        assert(r?.dir && asked.length >= 1 && asked[0].list.length >= 1 && asked[0].list.every(d => busLinesAt(townOf(g.map), d.row, d.i).includes(r.line)), `seed ${seed}: the bus came and asked where to: its own line's stops`);
        assert(r.waited <= 3 * Math.max(...EVERY_MIN) + DWELL_S / 60, `seed ${seed}: waited ${fmt(r.waited, 1)} min`);
        assert(g.map.row === r.want.row && r.paid === 1 && Math.abs(me.z - OFF_Z) < 0.01 && Math.abs(me.x - r.to) < 0.01, `seed ${seed}: there, at the stop, paid`);
      }
      console.log(`      waited ${got.map(r => fmt(r.waited, 1)).join(', ')} min; the ${got.map(r => `${r.line} to ${r.want.label} (${fmt(r.rode, 0)} min)`).join('; the ')}`);
    },
  },
  {
    name: 'buses: being tailed\'s team gets on with you if they saw you and were near (overt both, covert one, and a car); the bus itself written down never',
    heavy: true,
    fn() {
      const by = { overt: { n: 0, kept: 0, riders: 0 }, covert: { n: 0, kept: 0, riders: 0, car: 0 } };
      let flags = 0; const kinds = [];
      for (let seed = 1; seed <= 20; seed++) {
        const g = newGame({ seed, scenario: 'sdr', weather: 'clear' });
        start(g, null);
        const sc = g.scenario;
        if (sc.team === 'none') continue;
        for (let t = 0; t < 25 * 40; t++) step(g, goTo(g, playerActor(g), g.map.row ?? 0, playerActor(g).x + 30, -2.7), null);   // (a walk first: the team takes up behind)
        const r = takeBus(g);
        if (!r?.dir) continue;
        const b = by[sc.team];
        b.n++; b.riders += sc.riders.length;
        if (sc.team === 'covert' && sc.carKeeps) b.car++;
        for (let t = 0; t < 25 * 180; t++) step(g, goTo(g, playerActor(g), g.map.row ?? 0, playerActor(g).x + 30, -2.7), null);
        if (!sc.teamLost) b.kept++;
        flags += sc.flags.length; kinds.push(...sc.flags.map(f => f.kind));
      }
      console.log(`      overt: ${by.overt.riders} rode with you in ${by.overt.n} rides, kept you ${by.overt.kept}; covert: ${by.covert.riders} rode, the car kept up ${by.covert.car}, kept you ${by.covert.kept} of ${by.covert.n}; things written down: ${flags} (${[...new Set(kinds)].join(', ')})`);
      assert(by.overt.n && by.overt.kept / by.overt.n >= 0.5, 'an overt pair mostly gets on with you');
      assert(by.covert.n && by.covert.kept < by.covert.n, 'a covert team loses you, sometimes');
      assert(!kinds.includes('taxi') && !kinds.includes('bus'), 'a bus is what people take: nothing to write down (the bot\'s own walk may be)');
    },
  },
  {
    name: 'buses: being tailed\'s riders, off as the doors close: whoever doesn\'t beat your Deception is carried on',
    heavy: true,
    fn() {
      let rode = 0, carried = 0, lost = 0, n = 0, noted = 0, withSome = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = newGame({ seed, scenario: 'sdr', weather: 'clear' });
        start(g, null);
        const sc = g.scenario;
        if (sc.team === 'none') continue;
        for (let t = 0; t < 25 * 40; t++) step(g, goTo(g, playerActor(g), g.map.row ?? 0, playerActor(g).x + 30, -2.7), null);
        const r = takeBus(g, 'bus0', null, true);
        if (!r?.dir || sc.outcome) continue;                         // (the evening over before the bus came: the meeting missed)
        n++; rode += sc.riders.length + (sc.carried ?? 0); carried += sc.carried ?? 0; lost += sc.teamLost; noted += sc.flags.some(f => f.kind === 'doors'); withSome += sc.riders.length + (sc.carried ?? 0) > 0;
      }
      console.log(`      ${n} rides off as the doors closed: ${rode} of the team rode with you, ${carried} carried on; the team lost ${lost} times (the doors, or nobody got on); written down ${noted} of the ${withSome} with one of them aboard`);
      assert(rode > 0 && carried > 0 && carried < rode, 'some carried on, not all');
      assert(noted === withSome, 'whoever rode with you saw it: written down');
    },
  },
];
