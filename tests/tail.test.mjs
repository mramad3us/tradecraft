// Mechanic test 1, tailing: played by scripted followers over many evenings, so the balance is read as
// numbers. A naive tail (10 m behind him, same pavement) should nearly always be made; a careful one
// (the other pavement, 20 m back, closing in when it's lost him) should see the meeting more often
// than not; a trained one (careful, and doing what the instinct offers when it warns) more often
// still. Over 100 evenings (TAIL_N=100): naive made 91, careful seen 60, trained seen 67.
// These are the bots' numbers, not a player's: a player reads the street better than they do.
import { newGame, start, step } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { assert, fmt } from './helpers.mjs';

function play(seed, follow) {
  const g = newGame({ seed, scenario: 'tail' });
  start(g, null);
  for (let t = 0; t < 20 * 60 * 18 && !g.scenario.outcome; t++) {
    const me = g.actors.find(a => a.who === g.player), tg = g.actors.find(a => a.id === g.scenario.target);
    step(g, tg ? follow(g, me, tg) : {}, null);
  }
  const sc = g.scenario;
  return { outcome: sc.outcome, evening: sc.evening, sightings: sc.sightings.length, warned: sc.warned, mixups: sc.mixups, minutes: (g.time.ms - sc.began) / 60000 };
}
const toward = (me, x, z, slack, extra = {}) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return d > slack ? { mx: dx / d, mz: Math.abs(dz) > 0.3 ? dz / d : 0, ...extra } : { ...extra }; };
const naive = (g, me, t) => (Math.hypot(t.x - me.x, t.z - me.z) > 10 ? toward(me, t.x, t.z, 0) : {});
const careful = (g, me, t) => {
  const sc = g.scenario, meeting = sc.phase === 'meet' || t.z > 11, have = sc.marked === sc.target && sc.unseenS < 3;
  const want = toward(me, t.x - (have ? (meeting ? 8 : 20) : 8), meeting || t.z < -0.5 ? 8.6 : -2.6, 1);
  if (!want.mx && meeting) return { look: true, mx: Math.sign(t.x - me.x) * 0.6, mz: 1 };   // stood: eyes on the bench
  return want;
};
// Trained: careful, and when the instinct warns of a check, it does what it offers (T); it strolls
// when told it's gaining, and stays put while busy at its cover.
const trained = (g, me, t) => {
  const sc = g.scenario, p = sc.prompt;
  if (me.busy && me.busy.what !== 'cross') return sc.tell || sc.scan ? {} : (Math.hypot(t.x - me.x, t.z - me.z) > 26 ? careful(g, me, t) : {});
  if (p?.act && p.tone === 'urgent' && p.act !== 'cross' && Math.hypot(t.x - me.x, t.z - me.z) < 30) return { act: ['instinct'] };
  const c = careful(g, me, t);
  if (p?.id === 'gaining') c.slow = true;
  return c;
};
const tally = (runs) => runs.reduce((o, r) => ((o[r.outcome ?? 'none'] = (o[r.outcome ?? 'none'] || 0) + 1), o), {});
const mean = (runs, k) => fmt(runs.reduce((s, r) => s + r[k], 0) / runs.length, 2);

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
          step(g, tg ? trained(g, me, tg) : {}, null);
        }
        return toJSON(g);
      };
      const a = run(-1), b = run(3000);
      assert(a === b, 'the tail went differently after a load');
      const g = fromJSON(a);
      console.log(`      after 5 game minutes (${g.scenario.evening}): ${g.scenario.phase}, ${g.scenario.outcome ?? 'going on'}, ${g.scenario.rolls} rolls, he's ${fmt(g.actors.find(x => x.who === 'orlov')?.x - g.scenario.startX, 0)} m along`);
    },
  },
  {
    name: 'tailing: a naive tail is made, a careful one often sees the meeting, a trained one more often',
    async fn() {
      const N = Number(process.env.TAIL_N ?? 40);
      const runs = { naive: [], careful: [], trained: [] };
      for (let i = 1; i <= N; i++) { runs.naive.push(play(i, naive)); runs.careful.push(play(i, careful)); runs.trained.push(play(i, trained)); }
      for (const [k, rs] of Object.entries(runs)) {
        console.log(`      ${k.padEnd(8)} ${JSON.stringify(tally(rs))}, ${mean(rs, 'minutes')} game min a run, seen ${mean(rs, 'sightings')} times, checks read ${mean(rs, 'warned')}, wrong man ${mean(rs, 'mixups')}`);
      }
      const byEvening = {};
      for (const r of runs.trained) (byEvening[r.evening] ??= []).push(r.outcome === 'seen' ? 1 : 0);
      console.log(`      trained, seen by evening: ${Object.entries(byEvening).map(([e, v]) => `${e} ${v.reduce((a, b) => a + b, 0)}/${v.length}`).join(', ')}`);
      const t = (k) => tally(runs[k]);
      assert((t('naive').made ?? 0) >= N * 0.7, 'a naive tail should nearly always be made');
      assert((t('careful').seen ?? 0) >= N * 0.35, 'a careful tail should see the meeting often');
      assert((t('trained').seen ?? 0) >= (t('careful').seen ?? 0) - 2, 'doing what the instinct says should help (over 100 evenings: careful 60, trained 67)');
      assert(!t('careful').none && !t('naive').none && !t('trained').none, 'every run ends');
    },
  },
];
