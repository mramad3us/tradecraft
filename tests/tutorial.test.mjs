// The tutorial (sim/tutorial/): each lesson a mechanic test's scene with Hale on the earpiece. Every
// lesson starts with his greeting, his lines given their time to read (never on top of each other),
// no script slips; the brief framed as an exercise; and lesson 1, played by the game's own follower,
// ticks off its steps.
import { newGame, start, step } from '../src/sim/game.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { LESSONS, briefFor } from '../src/sim/tutorial/index.js';
import { READ_S } from '../src/sim/tutorial/earpiece.js';
import { assert, fmt } from './helpers.mjs';

export default [
  {
    name: 'tutorial: every lesson, Hale greets you first, his lines each given their time, no slips in the scripts; the brief an exercise',
    fn() {
      for (const L of LESSONS.filter(l => l.beats)) {
        const g = newGame({ seed: 5, lesson: L.id });
        start(g, null);
        for (let k = 0; k < 25 * 60 * 3 && !g.scenario.outcome; k++) step(g, {}, null);
        const lines = g.log.filter(e => e.kind === 'radio'), gaps = lines.slice(1).map((e, i) => (e.ms - lines[i].ms) / 1000);
        const b = briefFor(g, SCENARIOS[g.scenario.kind].brief(g));
        console.log(`      ${L.id}: ${lines.length} lines in ${fmt((g.time.ms - g.scenario.began) / 60000, 1)} min, the shortest gap ${gaps.length ? fmt(Math.min(...gaps), 1) : '-'} s; steps ${g.tutor.steps.filter(s => s.done).length}/${g.tutor.steps.length}; "${lines[0]?.text.slice(0, 50)}…"`);
        assert(lines.length >= 2 && /^"Hale\./.test(lines[0].text), `${L.id}: Hale greets you first`);
        assert(gaps.every(s => s >= READ_S - 0.01), `${L.id}: each line its time to read`);
        assert(!g.tutor.errors?.length, `${L.id}: the script slipped: ${g.tutor.errors?.join('; ')}`);
        assert(b.stamp === 'EXERCISE' && b.title.startsWith('TUTORIAL') && b.body.length > SCENARIOS[g.scenario.kind].brief(g).body.length, `${L.id}: the brief framed as an exercise`);
      }
    },
  },
  {
    name: 'tutorial: lesson 1 played by the game\'s own follower ticks off its steps, and Hale says why',
    heavy: true,
    fn() {
      const ticked = {}, outcomes = {};
      let runs = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const g = newGame({ seed, lesson: 'tailing', autoplay: { keep: 20 } });
        start(g, null);
        for (let k = 0; k < 25 * 60 * 40 && !g.scenario.outcome; k++) step(g, {}, null);
        for (let k = 0; k < 25 * 20; k++) step(g, {}, null);       // (his last words)
        runs++;
        outcomes[g.scenario.outcome] = (outcomes[g.scenario.outcome] ?? 0) + 1;
        for (const s of g.tutor.steps) if (s.done) ticked[s.id] = (ticked[s.id] ?? 0) + 1;
        assert(!g.tutor.errors?.length, `the script slipped: ${g.tutor.errors?.join('; ')}`);
      }
      console.log(`      ${runs} evenings: ${JSON.stringify(outcomes)}; steps ticked: ${JSON.stringify(ticked)}`);
      assert((ticked.pick ?? 0) >= runs / 2 && (ticked.gap ?? 0) >= runs / 2, 'the follower picks him out and keeps its distance');
    },
  },
];
