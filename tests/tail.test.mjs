// Mechanic test 1, tailing: played by two scripted followers over many evenings, so the balance is
// read as numbers. A naive tail (10 m behind him, same pavement) should nearly always be made; a
// careful one (the other pavement, 20 m back, closing in when it's lost him) should mostly see the
// meeting. These are the bots' numbers, not a player's: a player has more tricks (crowds, windows, T).
import { newGame, start, step } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { assert, fmt } from './helpers.mjs';

function play(seed, follow) {
  const g = newGame({ seed, scenario: 'tail' });
  start(g, null);
  for (let t = 0; t < 20 * 60 * 16 && !g.scenario.outcome; t++) {
    const me = g.actors.find(a => a.who === g.player), tg = g.actors.find(a => a.id === g.scenario.target);
    step(g, tg ? follow(g, me, tg) : {}, null);
  }
  const sc = g.scenario;
  return { outcome: sc.outcome, sightings: sc.sightings.length, minutes: (g.time.ms - sc.began) / 60000 };
}
const toward = (me, x, z, slack) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return d > slack ? { mx: dx / d, mz: Math.abs(dz) > 0.3 ? dz / d : 0 } : {}; };
const naive = (g, me, t) => (Math.hypot(t.x - me.x, t.z - me.z) > 10 ? toward(me, t.x, t.z, 0) : {});
const careful = (g, me, t) => {
  const sc = g.scenario, meeting = sc.phase === 'meet' || t.z > 11;
  return toward(me, t.x - (sc.have ? (meeting ? 6 : 20) : 6), meeting || t.z < -0.5 ? 8.6 : -2.6, 1);
};
const tally = (runs) => runs.reduce((o, r) => ((o[r.outcome ?? 'none'] = (o[r.outcome ?? 'none'] || 0) + 1), o), {});

export default [
  {
    name: 'tailing: a save and a load in the middle of a tail change nothing',
    fn() {
      const run = (cut) => {
        let g = newGame({ seed: 9, scenario: 'tail' });
        start(g, null);
        for (let t = 0; t < 6000; t++) {
          if (t === cut) { g = fromJSON(toJSON(g)); start(g, null); }
          const me = g.actors.find(a => a.who === g.player), tg = g.actors.find(a => a.id === g.scenario.target);
          step(g, tg ? careful(g, me, tg) : {}, null);
        }
        return toJSON(g);
      };
      const a = run(-1), b = run(3000);
      assert(a === b, 'the tail went differently after a load');
      const g = fromJSON(a);
      console.log(`      after 5 game minutes: ${g.scenario.phase}, ${g.scenario.outcome ?? 'going on'}, ${g.scenario.rolls} rolls, he's ${fmt(g.actors.find(x => x.who === 'orlov')?.x - g.scenario.startX, 0)} m along`);
    },
  },
  {
    name: 'tailing: a naive tail is made, a careful one sees the meeting',
    async fn() {
      const N = 30;
      const a = Array.from({ length: N }, (_, i) => play(i + 1, naive));
      const b = Array.from({ length: N }, (_, i) => play(i + 1, careful));
      const ta = tally(a), tb = tally(b);
      console.log(`      naive, 10 m behind:   ${JSON.stringify(ta)}`);
      console.log(`      careful, other side:  ${JSON.stringify(tb)}, ${fmt(b.reduce((s, r) => s + r.minutes, 0) / N)} game min a run, seen ${fmt(b.reduce((s, r) => s + r.sightings, 0) / N, 2)} times a run`);
      assert((ta.made ?? 0) >= N * 0.75, 'a naive tail should nearly always be made');
      assert((tb.seen ?? 0) >= N * 0.55, 'a careful tail should mostly see the meeting');
      assert(!tb.none && !ta.none, 'every run ends');
    },
  },
];
