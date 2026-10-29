// Who rides the metro with you (sim/metro.js riders(), ride()): a follower close enough who saw you go
// down gets on; each leg your Deception against their Tracking; a change of line, another chance to lose
// them; off as the doors close, a better one; out of sight or far back, lost at the barrier. Kept, they
// come up the steps after you, a few seconds on, and follow on.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { makeAgent, follow } from '../src/sim/agents.js';
import { sheet } from '../src/sim/people.js';
import { stationNear, destinations, riders } from '../src/sim/metro.js';
import { network } from '../src/sim/transit.js';
import { townOf } from '../src/sim/cities/index.js';
import { section, Z } from '../src/sim/map/street.js';
import { createBus } from '../src/sim/bus.js';
import { assert } from './helpers.mjs';

// (London, seed 7: a station on the first street; you at its door, a follower behind you)
function atStation(seed, { tracking = 10, deception = 10, back = 6 } = {}) {
  const g = newGame({ seed: 7, city: 'london', weather: 'clear' }), bus = createBus();
  start(g, bus);
  const town = townOf(g.map), row = g.map.row ?? 0, me = playerActor(g);
  const [, i] = [...network(town).stations.keys()].map(k => k.split('|').map(Number)).filter(([r]) => r === row).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
  const door = section(town, i, row).doors.find(d => d.kind === 'metro');
  Object.assign(me, { x: door.x, z: Z.front + 0.8, face: 'up' });
  g.people.me.skills.deception = [deception, 0];
  g.people.fsb = sheet({ id: 'fsb', name: 'a watcher', sex: 'm', cls: 'civilian', skills: { tracking: [tracking, 0], awareness: [8, 0] } });
  const a = makeAgent(g, { who: 'fsb', row, x: door.x - back, z: Z.front + 0.9, face: 'right' });
  follow(g, a, me, 8);
  for (let t = 0; t < 3 + seed * 3; t++) step(g, {}, bus);         // (each trial its own dice: a few ticks more)
  return { g, bus, me, a, d: stationNear(g, me) };
}

export default [
  {
    name: 'riders: who gets on with you and stays, by your Deception against their Tracking; a change of line and the doors\' trick lose them more; too far back, lost at the barrier',
    fn() {
      const N = 200, rows = [];
      const rate = (opts, pick) => {
        let kept = 0;
        const { g, me, a, d } = atStation(0, opts), all = destinations(g, d), to = pick(all);
        for (let k = 0; k < N; k++) { a.ai.follow.lost = false; kept += riders(g, me, to, opts.doors).length; }
        return { r: kept / N, to };
      };
      const one = (all) => all.find(x => x.lines.length === 1), two = (all) => all.find(x => x.lines.length >= 2);
      for (const [label, opts] of [['even (10 v 10)', {}], ['a better watcher (10 v 18)', { tracking: 18 }], ['a better officer (18 v 10)', { deception: 18 }]]) {
        const a = rate(opts, one), b = rate(opts, two), c = rate({ ...opts, doors: true }, one);
        rows.push([label, a.r, b.r, c.r]);
      }
      const far = rate({ back: 40 }, one);
      for (const [label, a, b, c] of rows) console.log(`      ${label}: one line ${Math.round(a * 100)}% stay with you, a change ${Math.round(b * 100)}%, off as the doors close ${Math.round(c * 100)}%`);
      console.log(`      40 m back: ${Math.round(far.r * 100)}%`);
      const [even, watcher, officer] = rows;
      assert(watcher[1] > even[1] && even[1] > officer[1], 'Tracking keeps you, Deception loses them');
      assert(even[2] < even[1] && even[3] < even[1], 'a change, and the doors, lose them more');
      assert(far.r === 0, 'too far back: lost at the barrier');
    },
  },
  {
    name: 'riders: kept, they come up the steps after you, a few seconds on, out of sight till then, and follow on',
    fn() {
      // (a dogged watcher, one line: until he rides with you)
      for (let tries = 0; tries < 20; tries++) {
        const { g, bus, me, a, d } = atStation(tries, { tracking: 30, deception: 0 }), to = destinations(g, d).find(x => x.lines.length === 1);
        step(g, { act: [`metro:${to.id}`] }, bus);
        if (a.ai.follow.lost) continue;
        const hid = a.hidden, row = a.row === g.map.row;
        let upS = null;
        for (let t = 0; t < 20 * 20 && upS === null; t++) { step(g, {}, bus); if (!a.hidden) upS = t / 20; }
        for (let t = 0; t < 20 * 15; t++) step(g, { mx: 0.6 }, bus);
        const d2 = Math.hypot(a.x - me.x, a.z - me.z);
        console.log(`      a dogged watcher rode with you (try ${tries + 1}): on your street ${row}, out of sight at first ${hid}, up the steps ${upS} s after you; fifteen seconds' walk on: ${Math.round(d2)} m behind, still on you ${!a.ai.follow.lost}`);
        assert(row && hid && upS >= 3 && upS <= 13 && !a.ai.follow.lost && d2 < 30, 'up after you, and on you still');
        return;
      }
      assert(false, 'a Tracking 30 watcher never rode with a Deception 0 officer');
    },
  },
];
