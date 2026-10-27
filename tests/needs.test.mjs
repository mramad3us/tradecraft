// Needs (sim/needs.js): hunger by the hours since you ate (−1, then −2, in every roll), fed by a bite in
// a café; stress up with danger (a fight), down with time and sitting; frayed, the glance back you
// didn't mean; on edge, −1 to Deception, Social, Awareness.
import { newGame, start, step, playerActor, skip } from '../src/sim/game.js';
import { mods, hoursFed, stressOf, HUNGRY_H, FRAYED } from '../src/sim/needs.js';
import { check } from '../src/sim/checks.js';
import { skill } from '../src/sim/skills.js';
import { at, HOUR } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

export default [
  {
    name: 'needs: hungry after six hours (a roll pays), a bite feeds you; a fight frays you, sitting calms you; frayed, a glance back slips out',
    fn() {
      const g = newGame({ seed: 9 });
      g.time.ms = at(2026, 11, 2, 9, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      for (let t = 0; t < 40; t++) step(g, {}, null);
      skip(g, null, 6 * HOUR);
      for (let t = 0; t < 40; t++) step(g, {}, null);
      const h = hoursFed(p, g.time.ms), r = check(g.rng, { skill: 'awareness', value: skill(p, 'awareness'), body: p, dc: 10 });
      const hungry = r.mods.map(m => m.why);
      p.needs.ate = g.time.ms;                                      // (as a bite does: sim/shops.js 'eat')
      for (let t = 0; t < 40; t++) step(g, {}, null);
      const fed = mods(p, 'awareness').map(m => m.why);
      // (stress: frayed, a slip within a few minutes; and it eases)
      p.needs.stress = FRAYED + 15;
      let slips = 0, n0 = g.log.length;
      for (let t = 0; t < 20 * 60 * 20; t++) step(g, {}, null);
      slips = g.log.slice(n0).filter(e => /looked back over your shoulder/.test(e.text)).length;
      const after = stressOf(p);
      console.log(`      ${fmt(h, 1)} h since breakfast: a roll carries ${hungry.join(', ') || 'nothing'}; fed: ${fed.join(', ') || 'nothing'}; frayed at ${FRAYED + 15}: ${slips} glance(s) back in 20 min, stress ${fmt(after, 1)} after`);
      assert(hungry.includes('hungry') && !fed.includes('hungry'), 'hungry costs; a bite feeds');
      assert(slips >= 2 && after < FRAYED + 15, 'frayed slips; it eases');
    },
  },
];
