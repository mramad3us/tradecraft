// Close combat (sim/cqc.js) and its tutorial, the dojo (sim/scenarios/dojo.js): the triangle, the
// same move both ways, edges earned and spent, the intent read, how a bout and a fight end; then the
// balance, bouts between fighters of different CQC, as numbers; then the dojo played through.
import { seedRng } from '../src/sim/rng.js';
import { sheet } from '../src/sim/people.js';
import { startFight, resolve, prepare, readChance, technique, MOVES, BEATS } from '../src/sim/cqc.js';
import { stateOf, injure, bleeding, heal, takes } from '../src/sim/health.js';
import { spatter } from '../src/sim/blood.js';
import { newGame, start, step } from '../src/sim/game.js';
import { statusLine } from '../src/sim/fight.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { skill } from '../src/sim/skills.js';
import { assert, fmt } from './helpers.mjs';

/** A bot: what it reads, it answers (an edge spent on a hit); what it can't, a guess. drill: the edge drill's answer, with an edge. */
const COUNT = { hit: 'guard', grapple: 'hit', guard: 'grapple', open: 'hit' };
function bot(f, rnd, drill = false) {
  let m = f.read ? COUNT[f.theirs.move] : MOVES[Math.floor(rnd() * 3)], spend = f.adv.a > 0 && f.read && m === 'hit';
  if (drill && f.read) { m = f.theirs.move === 'hit' ? 'grapple' : 'guard'; spend = true; }
  return spend ? `${m}+` : m;
}

/** Two fighters, CQC bases a and b (trained, no over-skill: their CQC is the base). */
function ring(a, b, seed = 1) {
  const state = { rng: seedRng(seed), people: {}, time: { ms: 0 }, map: { row: 0 } };
  state.people.a = sheet({ id: 'a', name: 'A', cls: 'civilian', skills: { cqc: [a, 0], fitness: [5, 0] } });
  state.people.b = sheet({ id: 'b', name: 'B', cls: 'civilian', skills: { cqc: [b, 0], fitness: [5, 0] } });
  return state;
}
const COUNTER = { hit: 'guard', grapple: 'hit', guard: 'grapple', open: 'hit' };

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
      assert(dbl.o.spent.a && Math.abs(dbl.o.dmg - plain.dmg * 2) <= 0.11, `double: ${dbl.o.dmg} against ${plain.dmg}`);
      const shrug = spend('grapple', 'hit');
      assert(shrug.o.kind === 'absorbed' && shrug.o.dmg === 0 && shrug.f.adv.a === 0, 'a punch walked into, shrugged off');
      const stop = spend('guard', 'grapple');
      assert(stop.o.kind === 'fended' && stop.o.dmg === 0, 'a throw stopped');
      const kept = spend('guard', 'hit');
      assert(!kept.o.spent.a && kept.f.adv.a === 1, 'covering a hit needs no edge: it\'s kept');
    },
  },
  {
    name: 'cqc: a cover with Shift held meets a hit and hits back (the edge kept); staggered, no grab; dazed, no cover; always hitting into a better fighter loses, fast',
    fn() {
      const s = ring(10, 10, 5), f = startFight(s, 'a', 'b', { script: ['hit'] });
      resolve(s, f, { move: 'guard' });
      assert(f.adv.a === 1, 'a plain cover earns an edge');
      const o = resolve(s, f, { move: 'guard', spend: true });
      assert(o.kind === 'riposte' && o.dmg > 0 && o.status.b === 'dazed' && f.adv.a === 1, `a Shift cover: a riposte that dazes, the edge kept (${o.kind}, ${o.status.b}, ${f.adv.a})`);
      // What a status forbids does nothing: the move goes open.
      const t = ring(10, 10, 6), g = startFight(t, 'a', 'b', { script: ['guard'] });
      g.status.a = 'staggered';
      assert(resolve(t, g, { move: 'grapple' }).ours === 'open', 'staggered: a grab is nothing');
      g.status.a = 'dazed';
      g.theirs = { move: 'hit', spend: false };
      const d = resolve(t, g, { move: 'guard' });
      assert(d.ours === 'open' && d.kind === 'landed', 'dazed: no cover, and the hit lands');
      // Hitting every time into someone far better: they read it, cover, and riposte.
      let rounds = 0, ripostes = 0, won = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const u = ring(8, 26, seed), h = startFight(u, 'a', 'b', { bout: true, to: 3 });
        for (let i = 0; i < 60 && !h.ended; i++) { const x = resolve(u, h, { move: 'hit' }); ripostes += x.kind === 'riposte'; }
        rounds += h.round; won += h.ended?.by === 'a';
      }
      console.log(`      CQC 8 hitting every time into 26, 30 bouts: ${fmt(rounds / 30, 1)} exchanges a bout, ${ripostes} ripostes, ${won} won`);
      assert(rounds / 30 < 8 && ripostes > 15 && won === 0, 'no stalemate: the better fighter answers with ripostes, and wins');
    },
  },
  {
    name: 'cqc: fight enders: an edge on someone stunned is a knockout, a broken limb or a slam, by a CQC check; failed, it still breaks things; it can kill, likelier on someone beaten up; a foul in a bout; done to you too',
    fn() {
      const tally = (a, b, move, worn = 0, n = 400) => {
        const c = { n, ok: 0, dead: 0, fails: 0, fractures: 0, kinds: {}, dc: 0 };
        for (let seed = 1; seed <= n; seed++) {
          const s = ring(a, b, seed), f = startFight(s, 'a', 'b', {}), B = s.people.b;
          if (worn) B.body = { head: takes(B, 'head') * worn, torso: takes(B, 'torso') * worn };
          Object.assign(f, { status: { a: null, b: 'stunned' }, adv: { a: 1, b: 0 }, theirs: { move: 'open', spend: false } });
          const o = resolve(s, f, { move, spend: true });
          if (!o.finish) throw new Error(`no fight ender: ${o.kind}`);
          c.dc = o.roll.dc; c.ok += o.finish.ok; c.dead += !!o.killed; c.kinds[o.kind] = (c.kinds[o.kind] ?? 0) + 1;
          if (!o.finish.ok) { c.fails++; c.fractures += (o.injuries ?? []).some(i => i.kind === 'fracture' || i.kind === 'crack'); }
          if (o.finish.ok && o.kind !== 'botched') assert(f.ended, `a fight ender that comes off ends it (${o.kind})`);
        }
        return c;
      };
      const show = (label, c) => console.log(`      ${label}: DC ${c.dc}, came off ${Math.round(c.ok / c.n * 100)}%, killed ${fmt(c.dead / c.n * 100, 1)}%; failed, broke something ${c.fails ? Math.round(c.fractures / c.fails * 100) : 0}%; ${Object.entries(c.kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      const even = tally(10, 10, 'hit'), up = tally(10, 20, 'hit'), down = tally(30, 24, 'hit'), worn = tally(10, 10, 'hit', 0.6);
      const brk = tally(25, 10, 'grapple'), slam = tally(10, 10, 'grapple');
      show('CQC 10 knocking out 10', even); show('CQC 10 knocking out 20', up); show('CQC 30 knocking out 24', down);
      show('CQC 10 knocking out 10, beaten up', worn); show('CQC 25 grabbing 10', brk); show('CQC 10 grabbing 10', slam);
      assert(even.ok / even.n > 0.6 && even.ok / even.n < 0.85 && up.ok / up.n < 0.4 && down.ok / down.n > 0.6, 'the check: about 2 in 3 between equals, worse up, better down');
      assert(even.dead / even.n < 0.06 && worn.dead / worn.n > 0.08 && worn.dead > even.dead, 'it can kill: rarely someone fresh, more often someone beaten up');
      assert(even.fractures / even.fails > 0.3, 'failed, it still breaks things, often');
      assert(brk.kinds.broken > 0 && !brk.kinds.slammed && slam.kinds.slammed > 0 && !slam.kinds.broken, 'a grab breaks a limb from CQC 21; below, a slam');
      // A foul in a bout: the bout lost by whoever did it.
      const s = ring(10, 10, 3), f = startFight(s, 'a', 'b', { bout: true });
      Object.assign(f, { status: { a: null, b: 'stunned' }, adv: { a: 1, b: 0 }, theirs: { move: 'open', spend: false } });
      const o = resolve(s, f, { move: 'hit', spend: true });
      assert(o.foul && f.ended?.by === 'b' && ['fouled', 'dead'].includes(f.ended.why), `a foul loses the bout (${f.ended?.why})`);
      // Done to you: stunned, them holding an edge, in a real fight (never in a bout).
      let tried = 0, inBout = 0;
      for (let seed = 1; seed <= 50; seed++) {
        for (const bout of [false, true]) {
          const t = ring(10, 10, seed), g = startFight(t, 'a', 'b', { bout });
          Object.assign(g, { status: { a: 'stunned', b: null }, adv: { a: 0, b: 1 } });
          prepare(t, g);
          const x = resolve(t, g, { move: 'guard' });
          if (bout) inBout += !!x.finish; else tried += !!x.finish && x.by === 'b';
        }
      }
      console.log(`      stunned, them with an edge: a fight ender ${tried} times in 50 real fights, ${inBout} in 50 bouts`);
      assert(tried === 50 && inBout === 0, 'they finish it in a real fight, never in a bout');
    },
  },
  {
    name: 'cqc: the instinct says how things stand: you or them stunned, dazed, off balance; a fight ender offered, or a foul warned of',
    fn() {
      const line = (us, them, adv, bout = false) => {
        const s = ring(12, 12, 1), f = startFight(s, 'a', 'b', { bout });
        Object.assign(f, { status: { a: us, b: them }, adv: { a: adv, b: 0 } });
        return statusLine(s);
      };
      assert(line(null, null, 0) === null, 'nothing to say, nothing said');
      for (const [us, them, adv, bout, want, tone] of [
        ['stunned', null, 0, false, /You're stunned/, 'urgent'], ['dazed', null, 0, false, /no \{guard\} cover/, 'warn'], ['staggered', null, 0, false, /no \{grapple\} grab/, 'warn'],
        [null, 'stunned', 1, false, /\{run\} with \{hit\} or \{grapple\} finishes it/, 'note'], [null, 'stunned', 1, true, /a foul/, 'urgent'], [null, 'stunned', 0, false, /whatever you do lands/, 'note'],
        [null, 'dazed', 0, false, /B is dazed/, 'note'], [null, 'staggered', 0, false, /B is off balance/, 'note'], ['dazed', 'staggered', 0, false, /You're dazed.*B is off balance/, 'warn'],
      ]) {
        const l = line(us, them, adv, bout);
        assert(l && want.test(l.text) && l.tone === tone, `${us}/${them}${bout ? ' (a bout)' : ''}: ${l?.text} (${l?.tone})`);
      }
      console.log(`      e.g. ${line('dazed', 'stunned', 1).text}`);
    },
  },
  {
    name: 'cqc: an expert has variety: no one technique, and not all kicks',
    fn() {
      const r = seedRng(9), n = {};
      for (let i = 0; i < 3000; i++) { const t = technique(r, 'hit', 30); n[t.id] = (n[t.id] ?? 0) + 1; }
      const share = (ids) => ids.reduce((a, k) => a + (n[k] ?? 0), 0) / 3000;
      console.log(`      CQC 30, a hit: ${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / 30)}%`).join(', ')}`);
      assert(Object.values(n).every(v => v / 3000 < 0.25), 'no one technique a quarter of the time');
      assert(share(['kick', 'lowkick', 'roundhouse']) < 0.4 && share(['jab', 'cross', 'hook', 'palm']) > 0.3, 'kicks, but punches more');
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
    name: 'cqc: hard blows crack and split and bloody, and blood flies and drips onto the floor',
    fn() {
      const tally = { crack: 0, split: 0, nose: 0, cut: 0 };
      let decals = 0, fights = 0, faces = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const s = ring(28, 6, seed);
        s.actors = []; s.decals = [];
        const f = startFight(s, 'a', 'b', { style: 'even' });
        f.marks = { a: { x: 0, z: 0 }, b: { x: 1.5, z: 0 } };
        for (let i = 0; i < 40 && !f.ended; i++) {
          const o = resolve(s, f, { move: f.read ? COUNTER[f.theirs.move] : 'hit' });
          if (o.blood) spatter(s, 1.5, 0, 1, o.blood, seed * 100 + i);
        }
        fights++;
        for (const p of [s.people.a, s.people.b]) for (const i of p.injuries ?? []) tally[i.kind]++;
        faces += 'face' in (s.people.b.bloody ?? {});
        decals += s.decals.length;
      }
      console.log(`      ${fights} fights, CQC 28 against 6: ${tally.crack} cracks, ${tally.split} split brows or lips, ${tally.nose} bloody noses; ${faces} faces bloodied, ${decals} spatters on the floor`);
      assert(tally.crack > 0 && tally.split + tally.nose > 0, 'hard fights leave cracks, and blood from the face');
      assert(decals > 0 && faces > 0, 'blood on the floor, and on the face');
      assert(tally.cut === 0, 'bare hands don\'t cut');
      // Bleeding drips; a day washes the face; a crack mends in three weeks, a bloody nose in a day.
      const p = s0();
      function s0() { const s = ring(5, 5); const q = s.people.a; injure(q, 'head', 0.25, seedRng(3), 0); injure(q, 'torso', 0.9, seedRng(4), 0); return q; }
      assert(bleeding(p, 30000) || !p.injuries.some(i => i.kind === 'nose'), 'a fresh nosebleed bleeds');
      heal(p, 2, 2 * 86400000);
      assert(!p.injuries?.some(i => i.kind === 'nose') && !p.bloody, 'two days on: the nose has mended, the blood washed off');
      assert(p.injuries?.some(i => i.kind === 'crack') ?? true, 'the crack is still knitting');
      heal(p, 30, 32 * 86400000);
      assert(!p.injuries, 'a month on, all mended');
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
    name: 'dojo, remembered: straight to the bouts, three of the class and Hale; then the cobbles, years on, an illegal as good as Hale was against an FSB man, to the end',
    fn() {
      const play = (seed) => {
        const g = newGame({ seed, scenario: 'dojo', chapter: 'remembered' });
        start(g, null);
        let k = seed, street = false, rounds = 0;
        const rnd = () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let t = 0; t < 20 * 60 * 10 && !g.scenario.outcome; t++) {
          const f = g.fight, act = [];
          if (g.scenario.phase === 'ready' && t % 20 === 0) act.push('instinct');
          if (f?.phase === 'choose') { act.push(bot(f, rnd)); if (g.scenario.with === 'fsb') rounds++; }
          step(g, { act }, null);
          street ||= g.map.kind === 'street';
        }
        return { g, street, rounds };
      };
      const runs = Array.from({ length: 16 }, (_, i) => play(40 + i)), won = runs.filter(r => r.g.scenario.outcome === 'won').length;
      const { g } = runs[0], cqc = (w) => skill(g.people[w], 'cqc');
      console.log(`      CQC now ${cqc('me')} (Hale's then ${cqc('hale')}), the FSB man ${cqc('fsb')}; the bouts: ${g.scenario.bouts.map(b => b.name).join(', ')}`);
      console.log(`      16 nights: won ${won}, ${fmt(runs.reduce((a, r) => a + r.rounds, 0) / 16, 1)} exchanges a fight; ${runs.map(r => `${r.g.scenario.bouts.map(b => (b.won ? 'W' : 'L')).join('')}→${r.g.scenario.outcome}`).join(' ')}`);
      assert(runs.every(r => r.g.scenario.outcome && r.street), 'every memory ends on the cobbles');
      assert(runs.every(r => r.g.scenario.bouts[0]?.id === 'read' && r.g.scenario.bouts.length === 4), 'no drills, and no bench: the four bouts');
      assert(cqc('me') === cqc('hale') && cqc('fsb') < cqc('me') && cqc('fsb') >= cqc('me') - 8, 'as good as Hale was; he\'s strong, but you\'re better');
      assert(won >= 10 && won < 16, 'you win, mostly; not always');
    },
  },
  {
    name: 'dojo: the lesson plays through, drills and bouts, and a save in the middle of a fight changes nothing',
    fn() {
      const play = (seed, cut = -1) => {
        let g = newGame({ seed, scenario: 'dojo' });
        start(g, null);
        let k = seed, cutDone = false;
        const rnd = () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let t = 0; t < 20 * 60 * 10 && !g.scenario.outcome; t++) {
          if (cut >= 0 && t >= cut && g.fight && !cutDone) { cutDone = true; g = fromJSON(toJSON(g)); start(g, null); }   // (the first fight from tick cut on)
          const f = g.fight, act = [];
          if (g.scenario.phase === 'ready' && t % 20 === 0) act.push('instinct');
          if (f?.phase === 'choose') act.push(bot(f, rnd, g.scenario.step === 4));
          step(g, { act }, null);
        }
        return g;
      };
      const runs = Array.from({ length: 6 }, (_, i) => play(20 + i));
      console.log(`      ${runs.map(g => `${g.scenario.outcome}: ${g.scenario.bouts.map(b => `${b.name} ${b.won ? 'won' : 'lost'} ${b.score.a}–${b.score.b}`).join(', ')}`).join('; ')}`);
      assert(runs.every(g => g.scenario.outcome), 'every lesson ends');
      assert(runs.every(g => g.scenario.bouts.length === 4 || g.scenario.bouts.some(b => b.why === 'stopped')), 'four bouts, unless someone was sent to the bench');
      assert(runs.filter(g => g.scenario.bouts[0].won).length >= 4, 'the weaker classmate is beaten, mostly (the bot guesses when it can\'t read)');
      assert(runs.every(g => g.scenario.bouts.length < 4 || !g.scenario.bouts[3].won), 'Hale is not');
      const a = toJSON(play(31)), b = toJSON(play(31, 700));
      assert(a === b, 'a save and a load in a fight play on the same');
    },
  },
];
