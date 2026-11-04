// Needs (sim/needs.js): hunger by the hours since you ate (−1, then −2, in every roll), fed by a bite in
// a café; stress up with danger (a fight), down with time and sitting; frayed, the glance back you
// didn't mean; on edge, −1 to Deception, Social, Awareness.
import { newGame, start, step, playerActor, skip, newMap } from '../src/sim/game.js';
import { newCampaign, candidates } from '../src/sim/campaign.js';
import { mods, hoursFed, stressOf, needsWords, HUNGRY_H, FRAYED, WEAK_H, FAINT_H, DIE_H } from '../src/sim/needs.js';
import { canRun } from '../src/sim/health.js';
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
  {
    name: 'needs: past starving: weak at two days (no running, −3), faint spells from three (six days on: within the hour or two), on a street an ambulance and the hospital feeds you; three weeks, dead (the user, 2026-11-04)',
    fn() {
      // (the campaign's: an officer in London, out on the street by the embassy)
      const life = (seed) => {
        const c = newCampaign(seed, candidates(seed, 'london', 'junior')[0], 'london', 'junior'), g = newGame({ seed, scenario: 'campaign', campaign: c });
        start(g, bus); newMap(g, bus, { kind: 'street', seed: c.posting.mapSeed, row: 0, i0: null, i1: null, crowd: 1, city: c.posting.city }, 12);
        for (let t = 0; t < 20; t++) step(g, {}, bus);
        return g;
      };
      const bus = { emit() {}, on() {} }, g = life(4);
      const me = playerActor(g), p = g.people[me.who], sec = () => { for (let t = 0; t < 20; t++) step(g, {}, bus); };
      p.needs = { stress: 0, ate: g.time.ms - (WEAK_H + 1) * HOUR, ms: g.time.ms }; sec();
      const weak = { run: canRun(p, g.time.ms), mod: mods(p, 'deception').find(m => /hunger/.test(m.why))?.v, words: needsWords(p, g.time.ms).fed };
      p.needs.ate = g.time.ms - (FAINT_H + 72) * HOUR;                  // (six days: a faint spell most hours)
      let fainted = null, fed = null;
      for (let s = 0; s < 24 * 3600 && fed === null; s++) { sec(); if (fainted === null && p.faint) fainted = s / 3600; if (fainted !== null && hoursFed(p, g.time.ms) < 1) fed = s / 3600; }
      const g2 = life(5);
      const p2 = g2.people[g2.player]; p2.needs = { stress: 0, ate: g2.time.ms - DIE_H * HOUR, ms: g2.time.ms };
      for (let t = 0; t < 40; t++) step(g2, {}, bus);
      console.log(`      two days: ${weak.words}, running ${weak.run}, ${weak.mod}; six days: fainted after ${fmt(fainted, 1)} h, in the hospital and fed ${fmt(fed - fainted, 2)} h after; three weeks: ${p2.dead?.why}, the scene ${g2.scenario.outcome}`);
      assert(!weak.run && weak.mod === -3 && fainted !== null && fed !== null && p2.dead?.why === 'starvation' && g2.scenario.outcome === 'dead', JSON.stringify({ weak, fainted, fed }));
    },
  },
];
