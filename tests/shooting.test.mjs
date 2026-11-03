// Shooting, in stop motion (sim/shooting.js): time stands still while a step's chosen and runs for its time
// once it is; the aim takes longer the further off your front, quicker with the skill; a hit's odds by the
// distance, the aim held and the skill; a bullet's wound; a gunshot heard empties the street.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { newGun, newMag, armOf, said } from '../src/sim/firearms.js';
import { toggle, options, choose, targets, aimMs, odds, bullet, MAX_M } from '../src/sim/shooting.js';
import { MODELS } from '../src/sim/firearms.js';
import { sheet } from '../src/sim/people.js';
import { skill } from '../src/sim/skills.js';
import { check } from '../src/sim/checks.js';
import { stream } from '../src/sim/rng.js';
import { stateOf } from '../src/sim/health.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon, a Handler with a Makarov at their belt and a spare magazine)
function armed(seed = 4, weapons = [5, 1]) {
  const g = newGame({ seed, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
  start(g, null);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g), p = g.people[me.who];
  p.skills.weapons = weapons;
  const id = newGun(p, 'makarov');
  (p.items ??= []).push(id, newMag(p, 'makarov', 8));
  return { g, me, p, id };
}
// (a step chosen, and played out to its end)
function take(g, key) {
  const t0 = g.time.ms;
  step(g, { act: [`shoot:${key}`] }, null);
  for (let n = 0; n < 600 && g.shoot?.phase === 'act'; n++) step(g, {}, null);
  return g.time.ms - t0;
}

export default [
  {
    name: 'shooting: X stops time; each step runs the world for its time (the draw, the safety, the aim, the shot); a gunshot empties the street',
    fn() {
      const { g, me, p, id } = armed();
      step(g, { act: ['aim'] }, null);
      assert(g.shoot?.phase === 'choose' && g.shoot.pick, 'in the mode, a target picked');
      const t0 = g.time.ms;
      for (let i = 0; i < 40; i++) step(g, { mx: 1 }, null);
      assert(g.time.ms === t0 && Math.abs(me.vx) < 1e-9, 'choosing: time stands still, and your feet with it');
      assert(options(g).map(o => o.key).join() === 'draw', `first, the draw: ${options(g).map(o => o.label)}`);
      const draw = take(g, 'draw'), safety = take(g, 'safety');
      assert(p.hand === id && !armOf(p, id).safety, `drawn and the safety off: ${said(p, id)}`);
      const T = targets(g, me).find(o => o.key === g.shoot.pick), before = odds(g, me, p).p;
      const aim = take(g, 'aim');
      assert(Math.abs(aim - aimMs(p, { ...me, head: me.head }, T.x, T.z)) < 1500 && g.shoot.aim, 'aimed, in its time');
      for (let i = 0; i < 20; i++) step(g, {}, null);              // (still choosing: the aim's held as long as you like? no: time stands still)
      const fire = take(g, 'fire');
      const ran = g.actors.filter(a => a.ai?.fled).length;
      assert(armOf(p, armOf(p, id).mag).n === 7 && ran > 5, `a shot: ${ran} passers-by running`);
      assert(draw > 1000 && draw < 3500 && safety > 200 && fire > 300, 'the steps took time');
      console.log(`      a Handler (Weapon handling ${skill(p, 'weapons')}): drawn in ${fmt(draw / 1000, 2)} s, the safety ${fmt(safety / 1000, 2)} s, an aim ${fmt(aim / 1000, 2)} s (odds ${fmt(before * 100, 0)}% → ${fmt(odds(g, me, p).p * 100, 0)}%), the shot and its recovery ${fmt(fire / 1000, 2)} s; ${ran} ran`);
      step(g, { act: ['aim'] }, null);
      assert(!g.shoot, 'X again: out of it');
    },
  },
  {
    name: 'shooting: the aim takes longer the further off your front, quicker with the skill; behind you is seconds',
    fn() {
      const me = { x: 0, z: 0, head: 0 }, rows = [];
      for (const [who, base, os] of [['the untrained', 0, 0], ['a Handler', 5, 38], ['an expert', 15, 60], ['a master', 20, 95]]) {
        const p = sheet({ id: who, cls: 'spook', os, skills: { weapons: [base, 1] } });
        const t = [0, 45, 90, 180].map(deg => aimMs(p, me, Math.cos(deg * Math.PI / 180) * 10, Math.sin(deg * Math.PI / 180) * 10));
        for (let i = 1; i < t.length; i++) assert(t[i] > t[i - 1], `${who}: further round, longer`);
        rows.push({ who, t });
      }
      for (let i = 1; i < rows.length; i++) assert(rows[i].t[3] < rows[i - 1].t[3], `${rows[i].who} turns round quicker than ${rows[i - 1].who}`);
      assert(rows[1].t[3] > 2000 && rows[3].t[3] < 1300, `behind: a Handler over 2 s (${rows[1].t[3]}), a master under 1.3 (${rows[3].t[3]})`);
      console.log(`      an aim, in front / 45° / 90° / behind: ${rows.map(r => `${r.who} ${r.t.map(v => fmt(v / 1000, 2)).join(' / ')} s`).join('; ')}`);
    },
  },
  {
    name: 'shooting: a hit\'s odds by distance, the aim held and the skill (rolled, not just read off)',
    fn() {
      const rng = stream('shots', 1), rows = [];
      for (const [who, base, os] of [['a Handler', 5, 38], ['an expert', 15, 60], ['a master', 20, 95]]) {
        const p = sheet({ id: who, cls: 'spook', os, skills: { weapons: [base, 1] } });
        const g = { shoot: { gun: 'makarov#x.1', pick: 'a1', part: 'torso', aim: null }, time: { ms: 10000 }, actors: [], $world: { lamps: [] }, map: { row: 0 } };
        const at = (d, held) => {
          g.actors = [{ id: 'a1', x: d, z: 0, vx: 0, vz: 0 }];
          g.shoot.aim = held === null ? null : { key: 'a1', settled: 10000 - held * 1000 };
          const o = odds(g, { x: 0, z: 0, head: 0 }, p);
          let hits = 0;
          for (let i = 0; i < 1000; i++) if (check(rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: o.dc, mods: o.mods }).ok) hits++;
          return hits / 1000;
        };
        rows.push({ who, point: [3, 7, 15].map(d => at(d, null)), aimed: [3, 7, 15, 25, 40].map(d => at(d, 1.5)) });
      }
      for (const r of rows) for (let i = 1; i < r.aimed.length; i++) assert(r.aimed[i] <= r.aimed[i - 1] + 0.03, `${r.who}: further, harder`);
      assert(rows[0].aimed[1] > rows[0].point[1] + 0.1, 'an aim held beats a point shot');
      assert(rows[2].aimed[3] > rows[0].aimed[3] + 0.3, 'a master hits at 25 m far more often than a Handler');
      assert(rows[1].aimed[4] < 0.4 && rows[0].aimed[4] < 0.1, `at 40 m a pistol's hard for all but a master (an expert ${fmt(rows[1].aimed[4] * 100, 0)}%)`);
      console.log(`      hit rates (body, daylight, standing): ${rows.map(r => `${r.who}: point shot 3/7/15 m ${r.point.map(v => fmt(v * 100, 0)).join('/')}%, aimed 1.5 s 3/7/15/25/40 m ${r.aimed.map(v => fmt(v * 100, 0)).join('/')}%`).join('; ')}`);
    },
  },
  {
    name: 'shooting: a bullet wounds deep and bleeds; to the head it can kill; whoever can\'t stand goes down',
    fn() {
      const { g, me } = armed(5);
      const M = MODELS.makarov, rows = { torso: 0, head: 0, down: 0, dead: 0 };
      for (let i = 0; i < 40; i++) {
        const a = g.actors.find(o => o.ai?.civ && !o.who && o !== me);
        if (!a) break;
        const part = i % 2 ? 'head' : 'torso', words = bullet(g, null, a, part, M, me), p = g.people[a.who];
        rows[part]++;
        if (p.dead) rows.dead++; else if (a.gait === 'down') rows.down++;
        assert(p.injuries.some(j => j.gunshot && j.deep) && words.length > 5, `wounded: ${words}`);
      }
      assert(rows.dead > 0 && rows.dead < rows.head + 1, `some head shots kill: ${rows.dead} of ${rows.head}`);
      console.log(`      ${rows.torso} shot in the body, ${rows.head} in the head: ${rows.dead} dead, ${rows.down} more down`);
    },
  },
  {
    name: 'shooting: a rifle reaches where a pistol can\'t; a shotgun\'s spread helps close; a burst climbs; a suppressed gun is heard close only; rubber bruises',
    fn() {
      const p = sheet({ id: 'x', cls: 'spook', os: 60, skills: { weapons: [15, 1] } }), me = { x: 0, z: 0, head: 0 };
      const g = { shoot: { gun: null, pick: 'a1', part: 'torso', aim: { key: 'a1', settled: 8500 } }, time: { ms: 10000 }, actors: [], $world: { lamps: [] }, map: { row: 0 } };
      const at = (model, d) => { g.shoot.gun = `${model}#x.1`; g.actors = [{ id: 'a1', x: d, z: 0, vx: 0, vz: 0 }]; return odds(g, me, p).p; };
      const rows = ['glock17', 'mp5', 'm4', 'ak74m', 'svd', 'rem870'].map(m => [m, [5, 25, 50, 100].map(d => at(m, d))]);
      const R = Object.fromEntries(rows);
      assert(R.m4[2] > R.glock17[2] + 0.4 && R.svd[3] > R.m4[3], 'at 50 m a carbine, at 100 m a marksman\'s rifle');
      assert(R.rem870[0] >= R.glock17[0] && R.rem870[2] < R.m4[2], 'a shotgun: easy close, nothing far');
      console.log(`      an expert, aimed, at 5/25/50/100 m: ${rows.map(([m, v]) => `${m} ${v.map(x => fmt(x * 100, 0)).join('/')}%`).join('; ')}`);
      // (a burst on auto: four rounds, each its own roll; a suppressed one heard close only)
      const run = (model) => {
        const w = armed(6, [15, 1]), id = newGun(w.p, model, { safety: false });
        w.p.hand = id;
        step(w.g, { act: ['aim'] }, null);
        const t = targets(w.g, w.me).sort((a, b) => a.d - b.d)[0];
        w.g.shoot.gun = id; w.g.shoot.pick = t.key;
        const gun = armOf(w.p, id);
        if (gun.mode) gun.mode = 'auto';
        const before = armOf(w.p, gun.mag)?.n;
        take(w.g, 'fire');
        return { used: before - armOf(w.p, gun.mag).n, ran: w.g.actors.filter(a => a.ai?.fled).length };
      };
      const ak = run('ak74m'), val = run('asval');
      assert(ak.used === 4 && val.used === 4, `a burst of four: ${ak.used}, ${val.used}`);
      assert(val.ran < ak.ran / 2, `the AS Val heard close only: ${val.ran} ran, against the AK's ${ak.ran}`);
      console.log(`      a burst on auto: the AK-74M ${ak.used} rounds, ${ak.ran} ran; the AS Val (suppressed) ${val.used} rounds, ${val.ran} ran`);
      const w = armed(7), a = w.g.actors.find(o => o.ai?.civ && !o.who);
      bullet(w.g, null, a, 'torso', MODELS.traumatic, w.me);
      const hit = w.g.people[a.who];
      assert(!hit.dead && !hit.injuries?.some(i => i.gunshot), 'a rubber round: no gunshot wound');
    },
  },
];
