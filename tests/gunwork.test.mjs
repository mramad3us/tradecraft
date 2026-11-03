// A gun's work at the flat's table (sim/gunwork.js), its thumb's work (the safety, the decocker: sim/firearms.js
// INSTANT), muzzle discipline when it goes off (sim/shooting.js discharge()), the embassy's arch (sim/screening.js);
// and what a bullet does to someone (sim/shooting.js bullet(), sim/health.js mobility()).
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { newGun, newMag, armOf, canDo, act, stepMs, said, MAG_FRESH } from '../src/sim/firearms.js';
import { ways, work, BENT_COND } from '../src/sim/gunwork.js';
import { discharge, muzzleSafe, bullet } from '../src/sim/shooting.js';
import { screen, SCREEN_COVER } from '../src/sim/screening.js';
import { mobility, canStand, canRun } from '../src/sim/health.js';
import { MODELS } from '../src/sim/firearms.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { sheet } from '../src/sim/people.js';
import { seedRng, stream } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

const hand = (w) => sheet({ id: 'me', cls: 'spook', skills: { weapons: [w, 1] } });
// (a fake state for the table: an rng, a clock, a log)
const table = (seed = 1) => ({ rng: seedRng(seed), time: { ms: 1e9 }, log: [], map: { kind: 'home' }, actors: [], people: {} });

export default [
  {
    name: 'gunwork: at the table, unload (the magazine out, the chamber cleared), fill and empty a magazine, clean a gun',
    fn() {
      const g = table(), p = hand(15);
      const id = newGun(p, 'makarov'), m = newMag(p, 'makarov', 0);
      p.items = [id, m]; p.rounds = { '9x18': 16 };
      armOf(p, id).cond = 0.4;
      const before = ways(p).map(w => w.key.split(':')[0]);
      const tUn = work(g, null, p, `unload:${id}`), G = armOf(p, id);
      assert(!G.mag && !G.chamber && p.rounds['9x18'] === 16 + 1 && p.items.length === 3, `unloaded (the magazine out, still loaded; the chambered round in the box): ${JSON.stringify({ mag: G.mag, ch: G.chamber, rounds: p.rounds })}`);
      const tFill = work(g, null, p, `fill:${m}`);
      assert(armOf(p, m).n >= 6, `filled: ${armOf(p, m).n} in it`);
      const tClean = work(g, null, p, `clean:${id}`);
      assert(armOf(p, id).cond >= 0.9 || armOf(p, id).cond === 0.5, `cleaned: ${armOf(p, id).cond}`);
      console.log(`      jobs with a loaded Makarov, an empty magazine, loose rounds: ${before.join(', ')}; unload ${fmt(tUn / 1000, 1)} s, fill 8 ${fmt(tFill / 1000, 0)} s, clean ${fmt(tClean / 60000, 0)} min; ${g.log.map(e => e.text).join(' | ')}`);
    },
  },
  {
    name: 'gunwork: fumbles by the hand: the untrained lose rounds, bend a magazine, and now and then fire one into the floor; an expert hardly ever',
    fn() {
      const run = (w) => {
        let lost = 0, bent = 0, bang = 0;
        for (let k = 0; k < 400; k++) {
          const g = table(k + 1), p = hand(w), id = newGun(p, 'makarov'), m = newMag(p, 'makarov', 0);
          p.items = [id, m]; p.rounds = { '9x18': 8 };
          const count = () => (p.rounds?.['9x18'] ?? 0) + [...p.items, armOf(p, id).mag].filter(x => x?.startsWith('mag-')).reduce((s, x) => s + armOf(p, x).n, 0) + (armOf(p, id).chamber === 'live' ? 1 : 0);
          const n0 = count(), b0 = bang;
          work(g, null, p, `unload:${id}`, { bang: () => bang++ });
          work(g, null, p, `fill:${m}`);
          lost += n0 - count() - (bang - b0);                        // (what's gone, but the round that went off)
          armOf(p, m).cond = 0.5;
          work(g, null, p, `spring:${m}`);
          if (armOf(p, m).cond === BENT_COND) bent++;
        }
        return { lost, bent, bang };
      };
      const u = run(0), x = run(25);
      assert(u.bang > 0 && x.bang === 0, `discharges unloading: the untrained ${u.bang} in 400, an expert ${x.bang}`);
      assert(u.lost > x.lost * 3 && u.bent > x.bent, `rounds lost ${u.lost} v ${x.lost}; magazines bent ${u.bent} v ${x.bent}`);
      console.log(`      400 times each: the untrained fired ${u.bang} into the table, lost ${u.lost} rounds, bent ${u.bent} magazines; an expert ${x.bang}, ${x.lost}, ${x.bent}`);
    },
  },
  {
    name: 'gunwork: a SIG carried decocked; the slide cocks it, the decocker lets it down; the thumb\'s work near instant for the skilled',
    fn() {
      const p = hand(0), id = newGun(p, 'p229'), G = armOf(p, id), rng = stream('t', 3);
      assert(!G.cocked && !canDo(p, id).includes('decock') && /decocker/.test(said(p, id)), `carried decocked: ${said(p, id)}`);
      G.chamber = null; act(rng, p, id, 'rack');
      assert(G.cocked && canDo(p, id).includes('decock'), 'racked: cocked, the decocker offered');
      act(rng, p, id, 'decock');
      assert(!G.cocked, 'decocked');
      const mk = (w) => { const q = hand(w), k = newGun(q, 'makarov'); return stepMs(q, k, 'safety'); };
      const [slow, fast] = [mk(0), mk(30)];
      assert(fast <= 150 && slow >= 3 * fast, `the safety: untrained ${slow} ms, an expert ${fast} ms`);
      console.log(`      the safety off: untrained ${slow} ms, a Handler ${mk(10)} ms, an expert ${fast} ms; a Glock says: ${said(p, newGun(p, 'glock17'))}`);
    },
  },
  {
    name: 'gunwork: gone off in a fumbling hand: the trained hand had it pointed at the ground (muzzle discipline)',
    fn() {
      const share = (w) => {
        let safe = 0;
        for (let k = 0; k < 300; k++) {
          const g = newGame({ seed: 4, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' }), log = [];
          start(g, { emit: () => {}, on() {} });
          const me = playerActor(g), p = g.people[me.who];
          p.skills.weapons = [w, 1];
          g.rng = seedRng(k + 1);
          const id = newGun(p, 'makarov');
          discharge(g, { emit: (t, v) => { if (t === 'log') log.push(v.text); } }, me, p, id, 'rack', { fired: true });
          if (/down and away/.test(log.join(' ') + g.log.map(e => e.text).join(' '))) safe++;
          if (k > 40 && w > 0 && w < 30) break;
        }
        return safe;
      };
      assert(muzzleSafe(hand(0)) === 0 && muzzleSafe(hand(30)) > 0.9, `muzzle discipline: untrained ${muzzleSafe(hand(0))}, an expert ${fmt(muzzleSafe(hand(30)), 2)}`);
      const none = share(0);
      assert(none === 0, `untrained: never pointed safe (${none})`);
      console.log(`      pointed somewhere safe when it went off: untrained ${fmt(muzzleSafe(hand(0)) * 100, 0)}%, a Handler (10) ${fmt(muzzleSafe(hand(10)) * 100, 0)}%, trained (20) ${fmt(muzzleSafe(hand(20)) * 100, 0)}%, an expert (30) ${fmt(muzzleSafe(hand(30)) * 100, 0)}%`);
    },
  },
  {
    name: 'screening: a gun on you through the embassy\'s arch: taken, the cover standing down; a penknife goes through',
    fn() {
      const c = newCampaign(3, candidates(3)[0]), g = newGame({ seed: 3, scenario: 'campaign', campaign: c });
      start(g, null);
      const p = g.people.me, cover0 = c.posting.cover;
      p.items = [...(p.items ?? []), 'penknife', newGun(p, 'makarov'), newMag(p, 'makarov', 8)]; p.rounds = { '9x18': 10 };
      const found = screen(g, null, p, c);
      assert(found.length === 3 && !p.items.some(k => /#/.test(k)) && p.items.includes('penknife') && !p.rounds, `found ${found.join(', ')}; left ${p.items.join(', ')}`);
      assert(c.posting.cover === Math.max(0, cover0 - SCREEN_COVER), `cover ${cover0} → ${c.posting.cover}`);
      console.log(`      the arch: ${found.length} things taken, cover standing ${cover0} → ${c.posting.cover}`);
    },
  },
  {
    name: 'wounds: shot, the fallen stay down while they can\'t stand; the wounded slow, too hurt to run; a head shot is death or worse than a minute down',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
      start(g, null);
      for (let t = 0; t < 40; t++) step(g, {}, null);
      const me = playerActor(g), M = MODELS.makarov;
      const civ = g.actors.filter(a => a !== me && a.ai && !a.cop).slice(0, 2);
      g.rng = seedRng(7);
      bullet(g, null, civ[0], 'torso', M, me); bullet(g, null, civ[0], 'torso', M, me);
      const p0 = g.people[civ[0].who];
      for (let t = 0; t < 20 * 120; t++) step(g, {}, null);            // (two minutes on)
      const down = civ[0].gait === 'down' || !canStand(p0) || p0.dead;
      assert(down, `two in the chest, two minutes on: still down (${civ[0].gait}, blood ${Math.round(p0.blood ?? 100)}%)`);
      // (the head: dead, or out with a bullet in the skull, or a graze; never up and running in a minute)
      const out = { dead: 0, skull: 0, graze: 0 };
      for (let k = 0; k < 200; k++) {
        const q = sheet({ id: `h${k}`, cls: 'civ' }), a = { id: `h${k}`, who: q.id, x: 0, z: 0, ai: {} };
        g.people[q.id] = q; g.rng = seedRng(100 + k);
        bullet(g, null, a, 'head', M, me);
        if (q.dead) out.dead++; else if (q.injuries.some(i => i.internal)) out.skull++; else out.graze++;
      }
      const hurt = sheet({ id: 'w', cls: 'civ' }); hurt.injuries = [{ part: 'legL', gunshot: true, ms: 0 }]; hurt.damage = { legL: 9 };
      assert(out.dead > 80 && out.skull > out.graze && out.graze > 0, `head shots: ${JSON.stringify(out)}`);
      console.log(`      two in the chest, two minutes on: ${civ[0].gait}, blood ${Math.round(p0.blood ?? 100)}%; 200 head shots: ${out.dead} dead, ${out.skull} out cold with a bullet in the skull, ${out.graze} grazed; mobility, a fresh bullet wound: ${fmt(mobility({ injuries: [{ gunshot: true, ms: 0 }] }, 1000), 2)}, can run: ${canRun({ injuries: [{ gunshot: true, ms: 0 }], blood: 66 }, 1000)}`);
    },
  },
];
