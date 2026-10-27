// Mechanic test 2, being tailed: played by scripted players over many evenings (tests/bots.mjs). An
// oblivious one walks straight to the meeting; a checker checks its back on the way and calls it off
// when it's sure; a pro also tries to shake a face it's marked, up a lane nobody it's marked sees it
// take. The numbers to read: how often each meets clean, burns him, calls it off rightly or for
// nothing, and how much the FSB writes down.
import { newGame, start, step } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { oblivious, checker, pro } from './bots.mjs';
import { assert, fmt } from './helpers.mjs';

function play(seed, bot) {
  const g = newGame({ seed, scenario: 'sdr', weather: 'clear' });   // (clear: the numbers DESIGN.md quotes)
  start(g, null);
  for (let t = 0; t < 20 * 60 * 20 && !g.scenario.outcome; t++) {
    const me = g.actors.find(a => a.who === g.player);
    step(g, bot(g, me), null);
  }
  const sc = g.scenario;
  return { outcome: sc.outcome ?? 'none', team: sc.team, flags: sc.flags.length, lost: sc.teamLost, checks: sc.checks, minutes: ((sc.ended ?? g.time.ms) - sc.began) / 60000, marked: Object.values(sc.faces).filter(f => f.n >= 2).length, wrong: Object.values(sc.faces).filter(f => f.n >= 2 && !f.crew).length };
}
const tally = (rs) => rs.reduce((o, r) => ((o[r.outcome] = (o[r.outcome] || 0) + 1), o), {});
const mean = (rs, k) => fmt(rs.reduce((s, r) => s + r[k], 0) / Math.max(1, rs.length), 2);

export default [
  {
    name: 'being tailed: a save and a load in the middle play on the same',
    fn() {
      const run = (cut) => {
        let g = newGame({ seed: 3, scenario: 'sdr' });
        start(g, null);
        for (let t = 0; t < 6000; t++) {
          if (t === cut) { g = fromJSON(toJSON(g)); start(g, null); }
          step(g, checker(g, g.actors.find(a => a.who === g.player)), null);
        }
        return toJSON(g);
      };
      const a = run(-1), b = run(2500);
      assert(a === b, 'the run went differently after a load');
      const g = fromJSON(a);
      console.log(`      after 5 game minutes (${g.scenario.team}, ${g.scenario.hour}): ${g.scenario.phase}, ${g.scenario.outcome ?? 'going on'}, row ${g.map.row}, ${g.scenario.rolls} rolls`);
    },
  },
  {
    name: 'being tailed: every evening ends, with a team or without',
    fn() {
      const rs = [1, 2, 3, 4].map(i => play(i, checker));
      console.log(`      ${rs.map(r => `${r.team}: ${r.outcome} after ${fmt(r.minutes, 1)} min`).join('; ')}`);
      assert(rs.every(r => r.outcome !== 'none'), 'every run ends');
    },
  },
  {
    name: 'being tailed: walking straight there burns him when they\'re on you; checking calls it off',
    heavy: true,
    fn() {
      const N = Number(process.env.SDR_N ?? 30);
      const bots = { oblivious, checker, pro };
      for (const [name, bot] of Object.entries(bots)) {
        const rs = Array.from({ length: N }, (_, i) => play(i + 1, bot));
        const by = (team) => rs.filter(r => r.team === team);
        console.log(`      ${name.padEnd(9)} ${['none', 'overt', 'covert'].map(t => `${t} ${JSON.stringify(tally(by(t)))}`).join('  ')}`);
        console.log(`                flags ${mean(rs, 'flags')} a run, ${mean(rs, 'checks')} checks, faces marked ${mean(rs, 'marked')} (${mean(rs, 'wrong')} passers-by), team lost ${rs.filter(r => r.lost && r.team !== 'none').length}/${rs.filter(r => r.team !== 'none').length}, ${mean(rs, 'minutes')} min`);
        bots[name] = rs;
      }
      const o = bots.oblivious, c = bots.checker;
      const burned = (rs) => rs.filter(r => r.team !== 'none' && r.outcome === 'burned').length;
      assert(burned(o) > o.filter(r => r.team !== 'none').length * 0.5, 'walking straight there with a team on you should mostly burn him');
      assert(o.every(r => r.outcome !== 'none') && c.every(r => r.outcome !== 'none'), 'every run ends');
      assert(burned(c) < burned(o), 'checking your back should burn him less often');
    },
  },
];
