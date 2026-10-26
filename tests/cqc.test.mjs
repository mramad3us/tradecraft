// Close combat (sim/cqc.js) and its tutorial, the dojo (sim/scenarios/dojo.js): the triangle, the
// same move both ways, edges earned and spent, the intent read, how a bout and a fight end; then the
// balance, bouts between fighters of different CQC, as numbers; then the dojo played through.
import { seedRng } from '../src/sim/rng.js';
import { sheet } from '../src/sim/people.js';
import { startFight, resolve, readChance, MOVES, BEATS } from '../src/sim/cqc.js';
import { stateOf } from '../src/sim/health.js';
import { newGame, start, step } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { assert, fmt } from './helpers.mjs';

/** Two fighters, CQC bases a and b (trained, no over-skill: their CQC is the base). */
function ring(a, b, seed = 1) {
  const state = { rng: seedRng(seed), people: {} };
  state.people.a = sheet({ id: 'a', name: 'A', cls: 'civilian', skills: { cqc: [a, 0], fitness: [5, 0] } });
  state.people.b = sheet({ id: 'b', name: 'B', cls: 'civilian', skills: { cqc: [b, 0], fitness: [5, 0] } });
  return state;
}
const COUNTER = { hit: 'guard', grapple: 'hit', guard: 'grapple' };

/** A bout to `to`, our side answering what it reads and guessing otherwise. */
function bout(a, b, seed, to = 3) {
  const s = ring(a, b, seed), f = startFight(s, 'a', 'b', { bout: true, to, style: 'even' });
  let k = seed * 7 + 1;
  const r = () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296);
  let n = 0;
  while (!f.ended && n++ < 200) {
    const m = f.read ? COUNTER[f.theirs.move] : MOVES[Math.floor(r() * 3)];
    resolve(s, f, { move: m, spend: f.adv.a > 0 && f.read && m === 'hit' });
  }
  return { won: f.ended?.by === 'a', rounds: f.round, why: f.ended?.why };
}

export default [
  {
    name: 'cqc: cover beats a hit (an edge), a hit beats a grab (clean), a grab beats cover (a throw); the same move is a roll',
    fn() {
      const s = ring(10, 10);
      for (const ours of MOVES) for (const theirs of MOVES) {
        const f = startFight(s, 'a', 'b', { script: [theirs] });
        const o = resolve(s, f, { move: ours });
        const want = ours === theirs ? (ours === 'guard' ? null : o.by) : BEATS[ours] === theirs ? 'a' : 'b';
        assert(o.by === want, `${ours} against ${theirs}: ${o.by}`);
        assert((ours === theirs && ours !== 'guard') === !!o.roll, `a roll only when it's the same move, and not two covers (${ours}/${theirs})`);
        if (o.by) assert(o.kind === { guard: 'blocked', hit: 'landed', grapple: 'thrown' }[ours === theirs ? ours : o.by === 'a' ? ours : theirs], `${ours}/${theirs}: ${o.kind}`);
      }
      const f = startFight(s, 'a', 'b', { script: ['hit'] });
      resolve(s, f, { move: 'guard' });
      assert(f.adv.a === 1, 'a hit covered earns an edge');
      resolve(s, f, { move: 'guard' });
      assert(f.adv.a === 1, 'held up to one per 10 CQC: at 10, one');
    },
  },
  {
    name: 'cqc: an edge spent does double a hit, shrugs off a punch walked into, stops a throw; and only when it does something',
    fn() {
      const spend = (ours, theirs) => {
        const s = ring(10, 10, 3), f = startFight(s, 'a', 'b', { script: [theirs] });
        f.adv.a = 1;
        return { o: resolve(s, f, { move: ours, spend: true }), f };
      };
      const plain = (() => { const s = ring(10, 10, 3), f = startFight(s, 'a', 'b', { script: ['grapple'] }); return resolve(s, f, { move: 'hit' }); })();
      const dbl = spend('hit', 'grapple');
      assert(dbl.o.spent.a && dbl.o.dmg === plain.dmg * 2, `double: ${dbl.o.dmg} against ${plain.dmg}`);
      const shrug = spend('grapple', 'hit');
      assert(shrug.o.kind === 'absorbed' && shrug.o.dmg === 0 && shrug.f.adv.a === 0, 'a punch walked into, shrugged off');
      const stop = spend('guard', 'grapple');
      assert(stop.o.kind === 'fended' && stop.o.dmg === 0, 'a throw stopped');
      const kept = spend('guard', 'hit');
      assert(!kept.o.spent.a && kept.f.adv.a === 1, 'covering a hit needs no edge: it\'s kept');
    },
  },
  {
    name: 'cqc: the better fighter reads what\'s coming; a fight ends out cold or down, a bout on points or stopped',
    fn() {
      const s = ring(15, 5);
      assert(readChance(s, 'a', 'b') > 0.5 && readChance(s, 'b', 'a') === 0, `ten points over: a read ${fmt(readChance(s, 'a', 'b') * 100, 0)}% of the time, and none the other way`);
      let reads = 0;
      const f = startFight(s, 'a', 'b', { style: 'even' });
      for (let i = 0; i < 200 && !f.ended; i++) { reads += f.read; resolve(s, f, { move: f.read ? COUNTER[f.theirs.move] : 'guard' }); }
      // A real fight between those two: the weaker one ends it out cold or down, not on points.
      assert(f.ended && f.ended.by === 'a' && ['out cold', 'down', 'can\'t stand'].includes(f.ended.why), `a real fight ends on the body: ${JSON.stringify(f.ended)}`);
      assert(stateOf(s.people.b, f.ended.why === 'out cold' ? 'head' : 'torso') === 'out' || f.ended.why === 'can\'t stand', 'and it shows on the body');
      console.log(`      CQC 15 against 5: read ${reads} of ${f.round} exchanges; over in ${f.round}, ${f.ended.why}`);
    },
  },
  {
    name: 'cqc: bouts to three, CQC against CQC (the better fighter reads more, and wins more)',
    fn() {
      const N = 200, rows = [];
      for (const [a, b] of [[8, 2], [8, 8], [8, 14], [8, 30], [20, 10], [30, 8]]) {
        const runs = Array.from({ length: N }, (_, i) => bout(a, b, 1000 + i));
        const won = runs.filter(r => r.won).length / N, rounds = runs.reduce((x, r) => x + r.rounds, 0) / N, stopped = runs.filter(r => r.why === 'stopped').length / N;
        rows.push({ a, b, won, rounds, stopped });
        console.log(`      CQC ${String(a).padStart(2)} against ${String(b).padStart(2)}: won ${fmt(won * 100, 0)}%, ${fmt(rounds, 1)} exchanges, stopped ${fmt(stopped * 100, 0)}%`);
      }
      const w = (a, b) => rows.find(r => r.a === a && r.b === b).won;
      assert(w(8, 2) > 0.7 && w(8, 30) < 0.15, 'a much better fighter wins most bouts');
      assert(w(8, 8) > 0.35 && w(8, 8) < 0.65, 'even: about even');
      assert(w(8, 2) > w(8, 8) && w(8, 8) > w(8, 14) && w(8, 14) > w(8, 30), 'the better, the more');
    },
  },
  {
    name: 'dojo: the lesson plays through, drills and bouts, and a save in the middle of a fight changes nothing',
    fn() {
      const COUNT = { hit: 'guard', grapple: 'hit', guard: 'grapple' };
      const play = (seed, cut = -1) => {
        let g = newGame({ seed, scenario: 'dojo' });
        start(g, null);
        let k = seed, cutDone = false;
        const rnd = () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let t = 0; t < 20 * 60 * 10 && !g.scenario.outcome; t++) {
          if (cut >= 0 && t >= cut && g.fight && !cutDone) { cutDone = true; g = fromJSON(toJSON(g)); start(g, null); }   // (the first fight from tick cut on)
          const f = g.fight, act = [];
          if (g.scenario.phase === 'ready' && t % 20 === 0) act.push('instinct');
          if (f?.phase === 'choose') {
            let m = f.read ? COUNT[f.theirs.move] : MOVES[Math.floor(rnd() * 3)], spend = f.adv.a > 0 && f.read && m === 'hit';
            if (g.scenario.step === 4 && f.read) { m = f.theirs.move === 'hit' ? 'grapple' : 'guard'; spend = true; }
            act.push(spend ? `${m}+` : m);
          }
          step(g, { act }, null);
        }
        return g;
      };
      const runs = Array.from({ length: 6 }, (_, i) => play(20 + i));
      console.log(`      ${runs.map(g => `${g.scenario.outcome}: ${g.scenario.bouts.map(b => `${b.name} ${b.won ? 'won' : 'lost'} ${b.score.a}–${b.score.b}`).join(', ')}`).join('; ')}`);
      assert(runs.every(g => g.scenario.outcome), 'every lesson ends');
      assert(runs.every(g => g.scenario.bouts.length === 3 || g.scenario.bouts.some(b => b.why === 'stopped')), 'three bouts, unless someone was sent to the bench');
      assert(runs.filter(g => g.scenario.bouts[0].won).length >= 4, 'the weaker classmate is beaten, mostly (the bot guesses when it can\'t read)');
      assert(runs.every(g => g.scenario.bouts.length < 3 || !g.scenario.bouts[2].won), 'Hale is not');
      const a = toJSON(play(31)), b = toJSON(play(31, 700));
      assert(a === b, 'a save and a load in a fight play on the same');
    },
  },
];
