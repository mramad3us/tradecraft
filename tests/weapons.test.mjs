// Weapons in the fight (sim/weapons.js, sim/cqc.js): knives and what's to hand, balanced as numbers;
// blocking a blade without something sturdy, a grab with a hand full, the weapon preferred, a kill
// attempt, a disarm, a bottle broken; then the world's (sim/items.js): what lies where, picked up, put
// away, drawn, dropped; and someone carrying a blade drawing it when the fight goes against them.
import { seedRng } from '../src/sim/rng.js';
import { sheet } from '../src/sim/people.js';
import { startFight, resolve, technique, MOVES, THROUGH_CAP } from '../src/sim/cqc.js';
import { takes } from '../src/sim/health.js';
import { WEAPONS, TECHS, weaponOf, SIZES } from '../src/sim/weapons.js';
import { sectionItems, itemNear, placed, armsOf } from '../src/sim/items.js';
import { section } from '../src/sim/map/street.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { isPasserby } from '../src/sim/crowd.js';
import { at } from '../src/sim/clock.js';
import { act as interactAct } from '../src/sim/interact.js';
import { assert, fmt } from './helpers.mjs';

/** Two fighters, CQC bases a and b, each holding what's given. */
function ring(a, b, seed = 1, handA = null, handB = null) {
  const state = { rng: seedRng(seed), people: {}, time: { ms: 0 }, map: { row: 0 } };
  state.people.a = sheet({ id: 'a', name: 'A', cls: 'civilian', skills: { cqc: [a, 0], fitness: [5, 0] } });
  state.people.b = sheet({ id: 'b', name: 'B', cls: 'civilian', skills: { cqc: [b, 0], fitness: [5, 0] } });
  state.people.a.hand = handA; state.people.b.hand = handB;
  return state;
}
const COUNTER = { hit: 'guard', grapple: 'hit', guard: 'grapple', open: 'hit' };
/** A fight to the end (out cold, down, can't stand, dead), our side answering what it reads and guessing otherwise. */
function brawl(a, b, seed, handA, handB) {
  const s = ring(a, b, seed, handA, handB), f = startFight(s, 'a', 'b', {});
  let k = seed * 7 + 1, n = 0;
  const r = () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296);
  while (!f.ended && n++ < 200) { const m = f.read ? COUNTER[f.theirs.move] : MOVES[Math.floor(r() * 3)]; resolve(s, f, { move: m, spend: f.adv.a > 0 && f.read && m === 'hit' }); }
  return { f, s };
}

export default [
  {
    name: 'weapons: the catalogue: knives balanced (no drawback, heavy on a hit, they cut); everything else has a cost; each goes in a pocket, the beltline, or the hand',
    fn() {
      const knives = Object.entries(WEAPONS).filter(([, w]) => w.kind === 'knife');
      assert(knives.length >= 6 && knives.every(([, w]) => w.grab === 0 && w.awkward === 0 && w.edge === 'blade' && w.k >= 1.3), 'six knives at least, no drawback, they cut');
      const rest = Object.entries(WEAPONS).filter(([, w]) => w.kind !== 'knife');
      assert(rest.length >= 12 && rest.every(([k, w]) => w.grab < 0 || w.awkward < 0 || w.k < 1.6 || w.guard === 0 || k === 'screwdriver'), 'what\'s to hand: every one costs something');
      assert(Object.keys(WEAPONS).every(k => SIZES[k]?.length === 2), 'each its length and its bulk (where it fits: sim/items.js placed())');
      console.log(`      ${Object.entries(WEAPONS).map(([k, w]) => `${k} ${w.k}${w.edge ? ' cuts' : ''}${w.grab ? ` grab ${w.grab}` : ''}${w.awkward ? ` awk ${w.awkward}` : ''} guard ${w.guard} ${w.carry}`).join('; ')}`);
    },
  },
  {
    name: 'weapons: armed against bare hands, CQC against CQC: the knife wins far more, what\'s awkward slower; better hands still beat a worse fighter with a blade',
    fn() {
      const rate = (a, b, ha, hb, n = 300) => { let won = 0, rounds = 0, dead = 0; for (let s = 1; s <= n; s++) { const { f, s: st } = brawl(a, b, s, ha, hb); won += f.ended?.by === 'a'; rounds += f.round; dead += !!st.people.b.dead; } return { won: won / n, rounds: rounds / n, dead: dead / n }; };
      const rows = [['10 bare v 10 bare', rate(10, 10, null, null)], ['10 penknife v 10 bare', rate(10, 10, 'penknife', null)], ['10 combat knife v 10 bare', rate(10, 10, 'combat', null)],
        ['10 pipe v 10 bare', rate(10, 10, 'pipe', null)], ['10 shovel v 10 bare', rate(10, 10, 'shovel', null)], ['10 bare v 10 kitchen knife', rate(10, 10, null, 'kitchen')], ['20 bare v 10 kitchen knife', rate(20, 10, null, 'kitchen')]];
      for (const [k, v] of rows) console.log(`      ${k}: won ${Math.round(v.won * 100)}%, ${fmt(v.rounds, 1)} exchanges`);
      const R = Object.fromEntries(rows);
      assert(R['10 penknife v 10 bare'].won > R['10 bare v 10 bare'].won + 0.1 && R['10 combat knife v 10 bare'].won >= R['10 penknife v 10 bare'].won - 0.05, 'a knife wins far more, a bigger knife no less');
      assert(R['10 shovel v 10 bare'].rounds > R['10 penknife v 10 bare'].rounds + 1, 'something awkward does less, slower: the fight runs longer than with a knife');
      assert(R['10 bare v 10 kitchen knife'].won < 0.4 && R['20 bare v 10 kitchen knife'].won > 0.55, 'bare hands lose to a blade, unless they\'re far better');
    },
  },
  {
    name: 'weapons: a blade blocked bare-handed: a clean block by a CQC roll, or a cut through the guard, mostly the forearms, never past a wound; a pipe across it stops it whole',
    fn() {
      const tally = (a, b, guardHand, n = 400) => {
        const c = { clean: 0, through: 0, parts: {}, worst: 0 };
        for (let seed = 1; seed <= n; seed++) {
          const s = ring(a, b, seed, guardHand, 'combat'), f = startFight(s, 'a', 'b', {});
          f.theirs = { move: 'hit', spend: false };
          const o = resolve(s, f, { move: 'guard' });
          if (o.kind !== 'blocked' || !TECHS[o.tech.b]) continue;
          if (o.through) { c.through++; c.parts[o.through.part] = (c.parts[o.through.part] ?? 0) + 1; c.worst = Math.max(c.worst, (s.people.a.body?.[o.through.part] ?? 0) / takes(s.people.a, o.through.part)); }
          else c.clean++;
        }
        return c;
      };
      const even = tally(10, 10, null), better = tally(20, 10, null), worse = tally(10, 20, null), pipe = tally(10, 10, 'pipe');
      const show = (k, c) => console.log(`      ${k}: clean ${c.clean}, cut through ${c.through} (${Object.entries(c.parts).map(([p, v]) => `${p} ${v}`).join(', ')}), worst ${Math.round(c.worst * 100)}% of a part`);
      show('CQC 10 blocking a combat knife at 10, bare-handed', even); show('CQC 20 blocking it at 10', better); show('CQC 10 blocking it at 20', worse); show('CQC 10 blocking it with a pipe', pipe);
      const cleanRate = (c) => c.clean / (c.clean + c.through);
      assert(even.through > 0 && even.clean > 0 && cleanRate(better) > cleanRate(even) && cleanRate(worse) < cleanRate(even), 'the better the blocker, the cleaner');
      assert(Math.max(even.worst, worse.worst) <= THROUGH_CAP + 0.01, 'never past a wound');
      assert((even.parts.armL ?? 0) + (even.parts.armR ?? 0) > even.through / 2, 'the forearms, mostly');
      assert(pipe.through === 0, 'a pipe across it: nothing comes through');
    },
  },
  {
    name: 'weapons: a grab with a hand full fumbles (a pipe a quarter of the time), a knife never; a shovel can\'t grab at all; armed, the trained still kick and knee, never punch with the knife hand',
    fn() {
      let fumbles = 0, knifeFumbles = 0, tries = 0;
      for (let seed = 1; seed <= 300; seed++) {
        for (const [hand, count] of [['pipe', 0], ['penknife', 1]]) {
          const s = ring(10, 10, seed, hand, null), f = startFight(s, 'a', 'b', {});
          f.theirs = { move: 'guard', spend: false };
          const o = resolve(s, f, { move: 'grapple' });
          if (count) knifeFumbles += o.kind === 'fumbled'; else { fumbles += o.kind === 'fumbled'; tries++; }
        }
      }
      const s = ring(10, 10, 1, 'shovel', null), f = startFight(s, 'a', 'b', {});
      f.theirs = { move: 'hit', spend: false };
      const o = resolve(s, f, { move: 'grapple' });
      console.log(`      a pipe in hand, grabbing a cover: fumbled ${Math.round(fumbles / tries * 100)}%; a penknife: ${knifeFumbles}; a shovel: the grab's a ${o.ours}`);
      assert(fumbles / tries > 0.15 && fumbles / tries < 0.35 && knifeFumbles === 0 && o.ours === 'guard', 'fumbles by the weapon; a shovel, no grab');
      const r = seedRng(3), w = WEAPONS.combat, share = (cqc) => { let n = 0, hands = 0; for (let i = 0; i < 2000; i++) { const t = technique(r, 'hit', cqc, w); n += !!t.weapon; hands += ['cross', 'hook', 'palm'].includes(t.id); } return [n / 2000, hands]; };
      const [trained, th] = share(22), [green, gh] = share(5);
      console.log(`      armed, the weapon's hit: CQC 22 ${Math.round(trained * 100)}%, CQC 5 ${Math.round(green * 100)}%; punches with the knife hand: ${th + gh}`);
      assert(trained > 0.65 && trained < 0.85 && green > 0.85 && th + gh === 0, 'the trained mostly, the untrained nearly always; never the knife hand\'s fist');
    },
  },
  {
    name: 'weapons: armed, Shift on someone stunned is to kill; a grab knocks a weapon out of the hand; a bottle breaks into a broken one',
    fn() {
      let killed = 0, botched = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const s = ring(12, 10, seed, 'finka', null), f = startFight(s, 'a', 'b', {});
        Object.assign(f, { status: { a: null, b: 'stunned' }, adv: { a: 1, b: 0 }, theirs: { move: 'open', spend: false } });
        let o; for (let i = 0; i < 20 && !(o?.finish); i++) { o = resolve(s, f, { move: 'hit', spend: true }); if (!o.finish) Object.assign(f, { status: { a: null, b: 'stunned' }, adv: { a: 1, b: 0 }, theirs: { move: 'open', spend: false }, ended: null }); }
        killed += o.kind === 'killed'; botched += o.kind === 'botched';
      }
      let dropped = 0, broke = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const s = ring(22, 10, seed, null, 'kitchen'), f = startFight(s, 'a', 'b', {});
        f.theirs = { move: 'guard', spend: false };
        const o = resolve(s, f, { move: 'grapple' });
        dropped += !!o.dropped && !s.people.b.hand;
        const t = ring(10, 10, seed, 'bottle', null), g = startFight(t, 'a', 'b', {});
        g.theirs = { move: 'grapple', spend: false };
        const x = resolve(t, g, { move: 'hit' });
        broke += !!x.broke && t.people.a.hand === 'brokenbottle';
      }
      console.log(`      a finka on someone stunned, CQC 12 on 10: killed ${killed}, botched ${botched} of 200; a kitchen knife knocked out of the hand by a grab ${dropped} of 200; a bottle broken on a hit ${broke} of 200`);
      assert(killed > 100 && botched > 0, 'mostly a kill; sometimes botched');
      assert(dropped > 20 && broke > 40, 'disarmed now and then; bottles break');
    },
  },
  {
    name: 'items: things lie about by what the street has (the same every time, never inside anything); T picks one up; G puts it away where it fits (a pipe can\'t be); a passer-by mostly carries nothing',
    fn() {
      const n = {}, per = [];
      for (const seed of [11, 22, 33]) for (let i = 0; i < 30; i++) {
        const S = section(seed, i, 0), list = sectionItems(seed, S);
        assert(JSON.stringify(list) === JSON.stringify(sectionItems(seed, section(seed, i, 0))), 'the same every time');
        for (const it of list) { n[it.kind] = (n[it.kind] ?? 0) + 1; assert(!S.blockers.some(b => it.x > b.x0 && it.x < b.x1 && it.z > b.z0 && it.z < b.z1), `${it.kind} inside something`); }
        per.push(list.length);
      }
      console.log(`      ${fmt(per.reduce((a, b) => a + b) / per.length, 1)} things a section (45 m): ${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      assert(Object.keys(n).length >= 8, 'variety');
      // Picked up, put away, drawn, dropped: a penknife; then a pipe, that can only be held.
      const g = newGame({ seed: 5 });
      g.time.ms = at(2026, 11, 2, 13, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      g.items = { taken: {}, dropped: [{ id: 'd1', kind: 'penknife', row: 0, map: 'street', x: me.x + 0.4, z: me.z }, { id: 'd2', kind: 'pipe', row: 0, map: 'street', x: me.x - 0.4, z: me.z }] };
      assert(itemNear(g, me), 'something within reach');
      step(g, { act: ['instinct'] }, null);
      const first = p.hand;
      step(g, { act: ['draw'] }, null);
      const stowed = !p.hand && p.items?.includes(first);
      for (let t = 0; t < 30; t++) step(g, {}, null);
      step(g, { act: ['instinct'] }, null);
      const second = p.hand;
      step(g, { act: ['draw'] }, null);
      console.log(`      picked up ${first}, put away: ${stowed}; then ${second}, and G: in hand ${p.hand}, carried ${p.items} (${placed(p).out.map(o => o.label).join(', ')})`);
      assert(first && stowed && second && second !== first, 'picked up, put away, the other picked up');
      assert((second === 'pipe' && p.hand === 'penknife' && g.items.dropped.some(it => it.kind === 'pipe')) || (second === 'penknife'), 'a pipe can\'t be put away: drawing the knife puts it down');
      const carry = Array.from({ length: 2000 }, (_, i) => armsOf(i + 1, i % 2 ? 'm' : 'f')).filter(a => a.length).length;
      console.log(`      passers-by carrying a blade: ${carry} of 2000`);
      assert(carry > 20 && carry < 140, 'a few');
    },
  },
  {
    name: 'items: a street fight with someone carrying a blade: they draw it when it turns against them, "Steel"; a weapon knocked away lies on the ground',
    fn() {
      let drew = 0, lay = 0;
      for (let seed = 5; seed < 25; seed++) {
        const g = newGame({ seed });
        g.time.ms = at(2026, 11, 2, 13, 0);
        start(g, null);
        for (let t = 0; t < 40; t++) step(g, {}, null);
        const me = playerActor(g), them = g.actors.find(a => isPasserby(a) && (a.row ?? g.map.row) === g.map.row && Math.abs(a.z + 2.7) < 1.5 && !a.hidden);
        if (!them) continue;
        Object.assign(me, { x: them.x - 1, z: them.z, head: 0, face: 'right' });
        interactAct(g, null, 'read', them);                          // (their sheet made: what they carry set before it starts)
        const p = g.people[them.who];
        p.items = ['switchblade']; p.cls = seed % 2 ? 'criminal' : 'civilian';
        interactAct(g, null, 'hit', them);
        for (let t = 0; t < 20 * 60 && g.fight; t++) step(g, { act: g.fight?.phase === 'choose' ? [seed % 3 ? 'grapple' : 'hit'] : [] }, null);
        drew += g.log.some(e => /^Steel/.test(e.text));
        lay += (g.items?.dropped ?? []).some(it => it.kind === 'switchblade');
      }
      console.log(`      twenty fights with someone carrying a switchblade: drawn in ${drew}, knocked to the ground in ${lay}`);
      assert(drew >= 8, 'they draw');
    },
  },
];
