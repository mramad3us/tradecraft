// Mechanic test 2, being tailed: played by scripted players over many evenings (tests/bots.mjs). An
// oblivious one walks straight to the meeting; a checker checks its back on the way and calls it off
// when it's sure; a pro also tries to shake a face it's marked, up a lane nobody it's marked sees it
// take. The numbers to read: how often each meets clean, burns him, calls it off rightly or for
// nothing, and how much the FSB writes down.
import { newGame, start, step } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { oblivious, checker, pro } from './bots.mjs';
import { teamOf, READ_S, LOSE_S } from '../src/sim/scenarios/sdr.js';
import { seesActor } from '../src/sim/perception.js';
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

// (an evening with a team on you, walked to where they have you: the game, its team, you; null without one)
function onYou(seed) {
  const g = newGame({ seed, scenario: 'sdr', weather: 'clear' });
  start(g, null);
  const sc = teamOf(g), me = () => g.actors.find(a => a.who === g.player), crew = () => sc.crew.map(c => g.actors.find(a => a.id === c.id)).filter(Boolean);
  if (sc.team === 'none') return null;
  for (let t = 0; t < 20 * 240 && !g.scenario.outcome; t++) { step(g, oblivious(g, me()), null); if (t > 20 * 60 && crew().length >= 2 && crew().some(w => seesActor(g, w, me()))) return { g, sc, me, crew }; }
  return null;
}

export default [
  {
    name: 'being tailed: they go by what they\'ve seen, never where you are; losing sight of you, they roll (their Tracking, your Pathfinding)',
    fn() {
      const rows = [];
      for (const master of [true, false]) {
        let n = 0, read = 0, toward = 0, lost = 0;
        for (let seed = 1; seed <= 40 && n < 6; seed++) {
          const o = onYou(seed);
          if (!o) continue;
          const { g, sc, me, crew } = o, you = g.people[g.player];
          if (master) Object.assign(you, { os: 95, skills: { ...you.skills, pathfinding: [20, 3] } });
          // (out of every eye, and 30 m on along the street the other way: the yard behind a shop, as far as their eyes go)
          const m = me(), read0 = sc.read ?? 0, d0 = Math.min(...crew().map(w => Math.hypot(w.x - m.x - 30, w.z - m.z)));
          m.hidden = true; m.x += 30;
          for (let t = 0; t < 20 * (LOSE_S[sc.team] + 5); t++) step(g, {}, null);
          n++;
          const readNow = (sc.read ?? 0) > read0;
          if (readNow) read++;
          const near = crew().length ? Math.min(...crew().map(w => Math.hypot(w.x - me().x, w.z - me().z))) : null;
          if (near !== null && near < d0 - 8) toward++;
          if (sc.teamLost) lost++;
          if (master) assert(!readNow && (near === null || near >= d0 - 8), `seed ${seed}: a master's out of sight, and they don't come for where you went (${near?.toFixed(1)} m, from ${d0.toFixed(1)})`);
        }
        assert(n >= 5, `evenings with a team on you: ${n}`);
        if (master) assert(lost === n, `a master out of their sight ${LOSE_S.overt} s and more: lost every time (${lost} of ${n})`);
        rows.push(`${master ? 'a master (Pathfinding 45)' : 'a Handler'}: ${n} evenings, read where you went ${read}, came your way ${toward}, lost you ${lost}`);
      }
      console.log(`      out of sight and moved 30 m: ${rows.join('; ')} (they read it for ${READ_S} s)`);
    },
  },
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
