// Mechanic test 1, tailing: played by the game's own follower (autoplay: sim/agents.js), over many
// evenings, so the balance is read as numbers. Skill against skill: our Deception, Tracking and
// Awareness against his Pathfinding and Awareness, at trained bases from a course (5) to a master
// (20). A better follower should see the meeting more often, a better watcher should make the tail
// more often, and the far corners should be near-certain. These are the game's follower's numbers,
// not a player's: a player who uses the street does better.
import { newGame, start, step } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { skill } from '../src/sim/skills.js';
import { assert, fmt } from './helpers.mjs';

/** An evening in autoplay, the follower's bases f and the watcher's w (null: as drawn). */
export function play(seed, f = null, w = null, limitMin = 45) {
  const g = newGame({ seed, scenario: 'tail', autoplay: { keep: 20 } });
  start(g, null);
  const me = g.people[g.player], o = g.people.orlov;
  if (f !== null) for (const k of ['deception', 'tracking', 'awareness']) me.skills[k] = [f, 1];
  if (w !== null) for (const k of ['pathfinding', 'awareness']) o.skills[k] = [w, 1];
  let rows = 0, row = g.map.row;
  for (let t = 0; t < 20 * 60 * limitMin && !g.scenario.outcome; t++) { step(g, {}, null); if (g.map.row !== row) { rows++; row = g.map.row; } }
  const sc = g.scenario;
  return { outcome: sc.outcome, evening: sc.evening, sightings: sc.sightings.length, warned: sc.warned, minutes: (g.time.ms - sc.began) / 60000, rows,
    eff: `${skill(me, 'deception')} v ${skill(o, 'pathfinding')}` };
}
const share = (runs, o) => runs.filter(r => r.outcome === o).length / runs.length;
const pct = (x) => `${Math.round(100 * x)}%`;

export default [
  {
    name: 'tailing: a save and a load in the middle of a tail (after a change of street) change nothing',
    fn() {
      const run = (cut) => {
        let g = newGame({ seed: 2, scenario: 'tail', autoplay: { keep: 20 } });
        start(g, null);
        let changed = false;
        for (let t = 0; t < 8000; t++) {
          if (t === cut) { assert(changed, 'the cut comes after a change of street (the case this seed tests)'); g = fromJSON(toJSON(g)); start(g, null); }
          const row = g.map.row;
          step(g, {}, null);
          changed ||= g.map.row !== row;
        }
        return toJSON(g);
      };
      const a = run(-1), b = run(3000), c = run(6000);
      assert(a === b && a === c, 'the tail went differently after a load');
      const g = fromJSON(a);
      console.log(`      after ${fmt(8000 / 1200, 1)} game minutes (${g.scenario.evening}): ${g.scenario.phase}, ${g.scenario.outcome ?? 'going on'}, ${g.scenario.rolls} rolls, on street ${g.map.row}`);
    },
  },
  {
    name: 'tailing: every evening ends (the meeting seen or missed, made, lost or blown)',
    fn() {
      const runs = Array.from({ length: 6 }, (_, i) => play(30 + i));
      console.log(`      ${runs.map(r => `${r.evening}: ${r.outcome} after ${fmt(r.minutes, 1)} min and ${r.rows} streets`).join('; ')}`);
      assert(runs.every(r => r.outcome), 'every run ends');
    },
  },
  {
    name: 'tailing: skill against skill, a better follower sees more, a better watcher makes more',
    heavy: true,
    fn() {
      const N = Number(process.env.TAIL_N ?? 24);
      const cell = (f, w) => {
        const runs = Array.from({ length: N }, (_, i) => play(100 + i, f, w));
        const c = { f, w, seen: share(runs, 'seen'), made: share(runs, 'made'), lost: share(runs, 'lost'), sightings: runs.reduce((a, r) => a + r.sightings, 0) / N, eff: runs[0].eff };
        console.log(`      follower ${String(f).padStart(2)} v watcher ${String(w).padStart(2)} (${c.eff}): seen ${pct(c.seen)}, made ${pct(c.made)}, lost ${pct(c.lost)}; seen by him ${fmt(c.sightings, 1)} times an evening`);
        return c;
      };
      const byF = [5, 10, 15, 20].map(f => cell(f, 10)), byW = [5, 10, 15, 20].map(w => cell(15, w));
      const rising = (cs, k, slack) => cs.every((c, i) => i === 0 || c[k] >= cs[i - 1][k] - slack);
      assert(rising(byF, 'seen', 0.1), 'a better follower sees the meeting more often');
      assert(rising(byW, 'made', 0.1), 'a better watcher makes the tail more often');
      assert(byF[0].made >= 0.8, 'a follower off a course is made by a trained man');
      assert(byW[0].seen >= 0.7, 'an expert follower sees a novice\'s meeting');
      assert(byF.concat(byW).every(c => c.lost <= 0.15), 'the follower seldom just loses him');
    },
  },
];
