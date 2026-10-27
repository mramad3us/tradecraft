// Bleeding out and first aid (sim/health.js blood, sim/aid.js): how fast each wound bleeds, what the
// blood lost costs and when it kills; then a dressing, a tourniquet, a splint, by Medicine; pressure
// held; and the time it takes, bled through when the clock skips.
import { seedRng } from '../src/sim/rng.js';
import { sheet } from '../src/sim/people.js';
import { injure, bloodTick, bloodOf, bandOf, bleedRate, mods, canStand, BLOOD, takes, hurt } from '../src/sim/health.js';
import { options, treat, bodyLine, PRESSURE_K } from '../src/sim/aid.js';
import { newGame, start, step, playerActor, skip } from '../src/sim/game.js';
import { at } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

const person = (med = 5) => sheet({ id: 'p', name: 'P Q', cls: 'civilian', skills: { medicine: [med, 0], fitness: [5, 0] } });
/** Minutes until each band, bleeding from these injuries untended (null: never, within six hours). */
function timeline(p) {
  const out = {};
  for (let s = 0; s < 6 * 3600; s += 10) { const b = bloodTick(p, 10, s * 1000); out[b] ??= Math.round(s / 6) / 10; if (b === 'dead') break; }
  return out;
}

export default [
  {
    name: 'the body in every roll: in shock, a dressing (and any roll naming its roller) carries the −3, not just a fight',
    fn() {
      const g = newGame({ seed: 8 });
      g.time.ms = at(2026, 11, 2, 13, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      injure(p, 'armL', 0.3, g.rng, g.time.ms, { edge: true, deep: true });
      p.blood = 60;
      const r = treat(g, null, me, me, 'dress:0');
      const why = r.mods.map(m => `${m.why} ${m.v}`);
      console.log(`      dressing your own cut at 60% blood: ${why.join(', ')}`);
      assert(why.some(w => /in shock/.test(w)), 'shock counts');
    },
  },
  {
    name: 'blood: a trickle, a shallow cut, a stab, an artery: how fast, and what the loss costs (pale, shock, collapse, dead)',
    fn() {
      const r = seedRng(4), rows = [];
      for (const [label, f] of [['a bloody nose', (p) => { p.injuries = [{ part: 'head', kind: 'nose', bleed: 150000, rate: 0.1 }]; }],
        ['a shallow cut (force 0.2)', (p) => injure(p, 'armL', 0.2, r, 0, { edge: true })],
        ['a stab, clean (force 0.4, a kitchen knife)', (p) => injure(p, 'torso', 0.4, r, 0, { edge: true, deep: true, bleedK: 1.3 })],
        ['an artery (arm, force 0.6)', (p) => { injure(p, 'armR', 0.6, r, 0, { edge: true, deep: true }); const c = p.injuries.find(i => i.kind === 'cut'); Object.assign(c, { artery: true, rate: 12 }); }]]) {
        const p = person(); f(p);
        const rate = bleedRate(p, 0), t = timeline(p);
        rows.push([label, rate, t]);
        console.log(`      ${label}: ${fmt(rate, 2)}%/min; pale at ${t.pale ?? '-'} min, shock ${t.shock ?? '-'}, collapsed ${t.collapsed ?? '-'}, dead ${t.dead ?? '-'}`);
      }
      assert(rows[0][2].dead === undefined && rows[1][2].dead === undefined, 'a trickle, a shallow cut: never deadly');
      assert(rows[2][2].dead > 5 && rows[2][2].dead < 60, 'a stab: dead in a quarter of an hour or so, untended');
      assert(rows[3][2].dead < 6, 'an artery: minutes');
      const p = person(); p.blood = 80; assert(mods(p, 'cqc').some(m => m.v === -1), 'pale: −1');
      p.blood = 60; assert(mods(p, 'cqc').some(m => m.v === -3) && canStand(p), 'shock: −3, still up');
      p.blood = 50; assert(!canStand(p), 'collapsed: down');
    },
  },
  {
    name: 'first aid: a dressing stops a cut, slows an artery; a tourniquet stops it (the limb\'s gone for now); a splint halves a break; Medicine decides; harder on yourself',
    fn() {
      const tally = (med, self, kind, n = 300) => {
        let ok = 0;
        for (let seed = 1; seed <= n; seed++) {
          const s = { rng: seedRng(seed), people: {}, time: { ms: 0 }, log: [] }, m = person(med), q = person();
          q.injuries = [{ part: 'armL', kind: 'cut', name: 'a cut', bleed: 1e9, rate: kind === 'artery' ? 12 : 3, deep: true, artery: kind === 'artery' }];
          s.people.m = m; s.people.q = q;
          const A = { id: 'A', who: 'm', face: 'right' }, B = self ? A : { id: 'B', who: 'q', face: 'left' };
          if (self) { s.people.m.injuries = q.injuries; }
          const r = treat(s, null, A, B, 'dress:0');
          ok += r.ok;
        }
        return ok / n;
      };
      const rows = [['Medicine 5, a deep cut, someone else', tally(5, false, 'deep')], ['Medicine 5, on yourself', tally(5, true, 'deep')], ['Medicine 15, someone else', tally(15, false, 'deep')], ['Medicine 5, an artery', tally(5, false, 'artery')]];
      for (const [k, v] of rows) console.log(`      dressing it, ${k}: ${Math.round(v * 100)}%`);
      assert(rows[2][1] > rows[0][1] && rows[0][1] > rows[1][1] && rows[3][1] < rows[0][1], 'better Medicine, better; on yourself, worse; an artery, harder');
      // What each does.
      const s = { rng: seedRng(2), people: {}, time: { ms: 0 }, log: [] }, m = person(30), q = person();
      q.injuries = [{ part: 'legL', kind: 'cut', name: 'a cut artery', bleed: 1e9, rate: 12, deep: true, artery: true }, { part: 'armR', kind: 'cut', name: 'a stab', bleed: 1e9, rate: 3, deep: true }];
      hurt(q, 'armL', takes(q, 'armL') + 1);
      s.people.m = m; s.people.q = q;
      m.hand = 'stick';
      const A = { id: 'A', who: 'm', face: 'right' }, B = { id: 'B', who: 'q', face: 'left' };
      const keys = options(s, m, q).map(o => o.key);
      treat(s, null, A, B, 'dress:0');
      const held = q.injuries[0].rate;
      treat(s, null, A, B, 'tourniquet:0');
      treat(s, null, A, B, 'dress:1');
      const before = mods(q, 'cqc').find(x => /arm/.test(x.why))?.v;
      treat(s, null, A, B, 'splint:armL');
      const after = mods(q, 'cqc').find(x => /arm/.test(x.why))?.v;
      console.log(`      options: ${keys.join(', ')}; the artery dressed: ${held}%/min; then the tourniquet: bleeding ${bleedRate(q, 1)}%/min; a broken arm ${before} → splinted ${after}`);
      assert(held < 12 && held > 0 && bleedRate(q, 1) === 0, 'a dressing slows an artery; a tourniquet and a dressing stop the rest');
      assert(q.tourniquets?.legL && mods(q, 'cqc').some(x => /tourniquet/.test(x.why)), 'the limb under a tourniquet is out of use');
    },
  },
  {
    name: 'blood in the game: a stab bleeds second by second; pressure held slows it; collapse lies you down; untended, a skip of the clock kills; the instinct says so',
    fn() {
      const g = newGame({ seed: 5 });
      g.time.ms = at(2026, 11, 2, 13, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      injure(p, 'torso', 0.45, g.rng, g.time.ms, { edge: true, deep: true, bleedK: 1.3 });
      const rate = bleedRate(p, g.time.ms);
      for (let t = 0; t < 20 * 60; t++) step(g, {}, null);
      const minute = 100 - bloodOf(p);
      step(g, { act: [`aid:${me.id}:pressure:0`] }, null);
      const b0 = bloodOf(p);
      for (let t = 0; t < 20 * 30; t++) step(g, {}, null);
      const pressed = b0 - bloodOf(p);
      const line = bodyLine(g);
      console.log(`      a stab, ${fmt(rate, 1)}%/min: a minute untended ${fmt(minute, 1)}%; thirty seconds pressed ${fmt(pressed, 2)}% (×${PRESSURE_K}); the instinct: "${line?.text}"`);
      assert(Math.abs(minute - rate) < 0.3 && pressed < rate / 2 * 0.5, 'second by second; pressure holds it back');
      assert(line && /bleeding/.test(line.text), 'the instinct says so');
      skip(g, null, 3 * 3600 * 1000);
      console.log(`      three hours on, untended: ${p.dead ? `dead (${p.dead.why})` : `${Math.round(bloodOf(p))}%`}; the scene: ${g.scenario.outcome}`);
      assert(p.dead && g.scenario.outcome === 'dead', 'bled out, and the scene ends');
    },
  },
  {
    name: 'blood comes back: collapsed with nothing bleeding, you come round; it returns second by second; a rest passes the hours; pressure on someone else counts',
    fn() {
      const g = newGame({ seed: 6 });
      g.time.ms = at(2026, 11, 2, 13, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      p.blood = BLOOD.collapse - 3;
      for (let t = 0; t < 20 * 5; t++) step(g, {}, null);
      const down = !canStand(p) && me.gait === 'down';
      for (let t = 0; t < 20 * 100; t++) step(g, {}, null);
      const round = bloodOf(p), up = canStand(p);
      for (let t = 0; t < 20 * 60 * 10; t++) step(g, {}, null);
      const tenMin = bloodOf(p) - round;
      const rest = options(g, p, p).find(o => o.key === 'rest:0'), t0 = g.time.ms;
      step(g, { act: [`aid:${me.id}:rest:0`] }, null);
      console.log(`      collapsed at ${BLOOD.collapse - 3}%: down ${down}; 100 s on ${fmt(round, 1)}%, standing ${up}; ten minutes later +${fmt(tenMin, 2)}%; "${rest?.label}" → ${fmt((g.time.ms - t0) / 3600000, 1)} h, ${fmt(bloodOf(p), 1)}% (${bandOf(p)})`);
      assert(down && up && round >= BLOOD.collapse, 'down, then round again');
      assert(tenMin > 0.25 && tenMin < 0.45, 'it comes back, a little at a time');
      assert(rest?.ok && bandOf(p) !== 'shock', 'a rest takes you out of shock');
      // (someone else's hands on a wound)
      g.people.q = person();
      const them = { id: 'aq', who: 'q', seed: null, row: me.row, x: me.x + 1, z: me.z, vx: 0, vz: 0, face: 'down', head: 0, gait: 'idle', stride: 0, stuck: 0, ai: null };
      g.actors.push(them);
      const q = g.people.q;
      injure(q, 'torso', 0.45, g.rng, g.time.ms, { edge: true, deep: true, bleedK: 1.3 });
      const rate = bleedRate(q, g.time.ms), b0 = bloodOf(q);
      step(g, { act: [`aid:${them.id}:pressure:0`] }, null);
      for (let t = 0; t < 20 * 30; t++) step(g, {}, null);
      const lost = b0 - bloodOf(q);
      console.log(`      pressing on someone else's stab (${fmt(rate, 1)}%/min): ${fmt(lost, 2)}% in thirty seconds`);
      assert(lost < rate / 2 * 0.5, 'pressure on someone else holds it back');
    },
  },
];
