// Test 5, the brush pass and the dead drop (sim/scenarios/sdr.js brushTest, dropTest): being tailed's
// evening, but SOLOVEY comes along a park's path and you take a newspaper from him passing, at arm's
// length, without stopping; or nobody comes, and a tin goes behind a bench's leg and a chalk mark on a
// lamppost. A bot that goes straight there (no checking its back) and does it: by team, how often it's
// clean, burned (a watcher saw it) or missed.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { goTo } from './bots.mjs';
import { laneMid } from '../src/sim/acts.js';
import { assert } from './helpers.mjs';

function run(seed, { stop = false } = {}) {
  const g = newGame({ seed, scenario: 'brush', weather: 'clear' });
  start(g, null);
  const sc = g.scenario, m = sc.meet, z = laneMid('path');
  for (let t = 0; t < 20 * 60 * 25 && !sc.outcome; t++) {
    const me = playerActor(g), s = g.actors.find(a => a.who === 'solovey');
    let input;
    if (g.map.row !== m.row || (!s && Math.hypot(me.x - (m.seat - 20), me.z - z) > 1.5)) input = goTo(g, me, m.row, m.seat - 20, z);
    else if (s) {
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      input = sc.prompt?.act === 'pass' ? { act: ['instinct'] } : stop && d < 4 ? {} : { mx: Math.sign(s.x - me.x), mz: Math.sign(s.z - me.z) * 0.3 };
    } else input = {};
    step(g, input, null);
  }
  return sc;
}

function drop(seed) {
  const g = newGame({ seed, scenario: 'drop', weather: 'clear' });
  start(g, null);
  const sc = g.scenario, d = sc.drop;
  let load = 0, mark = 0;
  for (let t = 0; t < 25 * 60 * 25 && !sc.outcome; t++) {
    const me = playerActor(g), at = d.loaded ? d.mark : d.site, standZ = d.loaded ? at.z : at.z + 0.34;
    let input = {};
    if (me.busy || d.doing) input = {};
    else if (sc.prompt?.act === (d.loaded ? 'mark' : 'load')) { input = { act: ['instinct'] }; d.loaded ? mark++ : load++; }
    else input = goTo(g, me, at.row, at.x, standZ);
    step(g, input, null);
  }
  return { sc, load, mark };
}

export default [
  {
    name: 'dead drop: the tin behind the bench, the chalk on the post; seen loading by a team on you, burned',
    heavy: true,
    fn() {
      const by = { none: {}, overt: {}, covert: {} };
      let marks = [], ms = [];
      for (let seed = 1; seed <= 24; seed++) {
        const { sc } = drop(seed);
        by[sc.team][sc.outcome] = (by[sc.team][sc.outcome] ?? 0) + 1;
        marks.push(Math.round(Math.abs(sc.drop.mark.x - sc.drop.site.x)));
        if (sc.met) ms.push((sc.ended - sc.began) / 60000);
      }
      console.log(`      straight there, load and mark: none ${JSON.stringify(by.none)}; overt ${JSON.stringify(by.overt)}; covert ${JSON.stringify(by.covert)}; the post ${Math.min(...marks)}–${Math.max(...marks)} m from the bench; done in ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)} min`);
      assert((by.none.clean ?? 0) >= 4, 'with nobody behind you, it goes');
      assert((by.overt.burned ?? 0) + (by.covert.burned ?? 0) >= 3, 'a team on you sees you at it, often');
    },
  },
  {
    name: 'brush pass: on his path, the paper passed walking; seen by a team that\'s on you, burned; no team, clean',
    heavy: true,
    fn() {
      const by = { none: {}, overt: {}, covert: {} };
      for (let seed = 1; seed <= 24; seed++) { const sc = run(seed); by[sc.team][sc.outcome] = (by[sc.team][sc.outcome] ?? 0) + 1; }
      console.log(`      straight there, the pass walking: none ${JSON.stringify(by.none)}; overt ${JSON.stringify(by.overt)}; covert ${JSON.stringify(by.covert)}`);
      assert((by.none.clean ?? 0) >= 4, 'with nobody behind you, it goes');
      assert((by.overt.burned ?? 0) >= 2, 'an overt pair on you sees it');
    },
  },
];
