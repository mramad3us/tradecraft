// The umbrella, mechanic test 6 (sim/scenarios/tail.js umbrellaTest): an assassination on the tail's
// evening. The jab measured where it's done: alone with him on an empty pavement, his minder a pace
// behind; and with people round you, as at his stop. Then the wrong man (a grey coat that wasn't
// him), the bus he gets on if you don't, and whole evenings by bots: one that tails him to his stop
// and does it at the doors, one that rushes him on the street.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { makeAgent } from '../src/sim/agents.js';
import { LINE } from '../src/sim/city.js';
import { goTo } from './bots.mjs';
import { assert, fmt } from './helpers.mjs';

/** Set the scene on his street: him and his minder stood still, you at arm's length behind him, and n people round you. */
function scene(seed, crowd, weather) {
  const g = newGame({ seed, scenario: 'umbrella', weather });
  start(g, null);
  const sc = g.scenario, t = g.actors.find(a => a.id === sc.target), m = g.actors.find(a => a.id === sc.hit.minder), me = playerActor(g);
  for (let k = 0; k < 25 * 4; k++) step(g, {}, null);
  const x = me.x + 30;
  Object.assign(t, { x, z: LINE.F, row: 0 }); Object.assign(t.ai, { wait: 1e6 });
  delete m.ai.follow; Object.assign(m, { x: x - 4, z: LINE.F - 0.4, row: 0, face: 'right', head: 0 }); Object.assign(m.ai, { wait: 1e6 });
  Object.assign(me, { x: x - 0.95, z: LINE.F, face: 'right', head: 0 });
  for (let k = 0; k < crowd; k++) { const a = makeAgent(g, { seed: 900 + k, row: 0, x: x - 1.6 + (k % 3) * 0.9, z: LINE.F + (k < 3 ? -1 : 1) * 0.9, speed: 1.2, face: 'right' }); a.ai.wait = 1e6; }
  sc.marked = t.id;
  for (let k = 0; k < 25 * 2 && sc.prompt?.act !== 'jab'; k++) step(g, {}, null);
  step(g, { act: ['instinct'] }, null);
  return sc.hit.done;
}

export default [
  {
    name: 'umbrella: alone with him on an empty pavement, his minder sees it and he sees you; with people round you in the rain, mostly neither',
    fn() {
      const tally = (crowd, weather) => {
        let n = 0, face = 0, minder = 0;
        for (let seed = 1; seed <= 40; seed++) { const d = scene(seed, crowd, weather); if (!d) continue; n++; face += d.face; minder += d.minder; }
        return { n, face: face / n, minder: minder / n };
      };
      const lone = tally(0, 'clear'), crowd = tally(5, 'rain');
      console.log(`      alone with him on a dry evening: he saw your face ${fmt(lone.face * 100, 0)}%, his minder saw it ${fmt(lone.minder * 100, 0)}% (${lone.n} tries)`);
      console.log(`      five people round you in the rain: he saw your face ${fmt(crowd.face * 100, 0)}%, his minder saw it ${fmt(crowd.minder * 100, 0)}% (${crowd.n} tries)`);
      assert(lone.n >= 35 && crowd.n >= 35, 'at arm\'s length, T is the umbrella');
      assert(lone.minder > crowd.minder + 0.3 && lone.face > crowd.face, 'the crowd and the rain are the cover');
    },
  },
  {
    name: 'umbrella: a grey coat that wasn\'t him is the wrong man; the bus takes him if you don\'t',
    fn() {
      // (the wrong man: a twin marked for him, at arm's length)
      const g = newGame({ seed: 3, scenario: 'umbrella', weather: 'rain' });
      start(g, null);
      const sc = g.scenario, me = playerActor(g);
      for (let k = 0; k < 25 * 4; k++) step(g, {}, null);
      const twin = makeAgent(g, { who: 'twin0', row: 0, x: me.x + 0.9, z: me.z, speed: 1.2, face: 'right' });
      // (taken for him, and struck in the same moment: before a close enough look would have shown it, as in a crush in the dark)
      twin.ai.wait = 1e6; sc.twins.push(twin.id); sc.marked = twin.id; sc.prompt = { id: 'jab', tone: 'urgent', text: '', act: 'jab' };
      step(g, { act: ['instinct'] }, null);
      for (let k = 0; k < 25 * 60 * 4 && !sc.outcome; k++) step(g, g.fight ? { act: ['hit'] } : goTo(g, playerActor(g), g.map.row, playerActor(g).x - 40, LINE.F), null);
      console.log(`      a grey coat taken for him: ${sc.outcome} (${sc.hit.done?.tell})`);
      assert(sc.hit.done?.wrong && sc.outcome === 'wrong', 'the wrong man');
      // (left alone: he walks to his stop, waits, and the bus takes him)
      const h = newGame({ seed: 4, scenario: 'umbrella', weather: 'rain' });
      start(h, null);
      for (let k = 0; k < 25 * 60 * 30 && !h.scenario.outcome; k++) step(h, {}, null);
      console.log(`      nobody following: ${h.scenario.outcome} after ${fmt((h.time.ms - h.scenario.began) / 60000, 1)} min (the doors opened ${h.scenario.hit.boarding ? fmt((h.scenario.hit.boarding - h.scenario.hit.busAt) / 1000, 0) : '?'} s from his bus's time)`);
      assert(['missed', 'lost'].includes(h.scenario.outcome) && h.scenario.hit.boarding, 'he got on his bus');
    },
  },
  {
    name: 'umbrella: whole evenings, by a bot that tails him to his stop and one that rushes him on the street',
    heavy: true,
    fn() {
      const run = (style) => {
        const out = {};
        for (let seed = 1; seed <= 16; seed++) {
          const g = newGame({ seed, scenario: 'umbrella', autoplay: { keep: 18 } });
          start(g, null);
          const sc = g.scenario, h = sc.hit;
          for (let k = 0; k < 25 * 60 * 40 && !sc.outcome; k++) {
            const me = playerActor(g), t = g.actors.find(a => a.id === sc.target);
            if (g.fight) { step(g, g.fight.phase === 'choose' ? { act: [['hit', 'grapple', 'guard'][k % 3]] } : {}, null); continue; }
            let input = {};
            const go = !h.done && t && (t.row ?? g.map.row) === g.map.row && (style === 'rush' ? Math.hypot(t.x - me.x, t.z - me.z) < 30 : h.waiting);
            if (go) { me.ai = null; input = sc.prompt?.act === 'jab' ? { act: ['instinct'] } : goTo(g, me, g.map.row, t.x - Math.sign(t.x - me.x || 1) * 0.6, t.z - 0.4); }
            else if (h.done) { me.ai = null; input = goTo(g, me, g.map.row, me.x + (me.x > (t?.x ?? 0) ? 40 : -40), LINE.F); }
            step(g, input, null);
          }
          out[sc.outcome] = (out[sc.outcome] ?? 0) + 1;
        }
        return out;
      };
      const tailed = run('tail'), rushed = run('rush');
      console.log(`      tailed to his stop: ${JSON.stringify(tailed)}; rushed on the street: ${JSON.stringify(rushed)}`);
      assert((tailed.done ?? 0) >= 3 && (rushed.taken ?? 0) >= 3, 'it can be done; rushing him gets you taken');
    },
  },
];
