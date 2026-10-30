// What the officer knows and believes (sim/knowledge.js, sim/belief.js): streets walked are known, and
// what's on them; the posting's places from the start; a waypoint chosen is where the pointer leads, till
// you're there; the read of heat and cover in words, surer with experience, never a number.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { knownPlaces, knownStreets, setWaypoint, knows } from '../src/sim/knowledge.js';
import { readOf, spreadOf } from '../src/sim/belief.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { createBus } from '../src/sim/bus.js';
import { SECTION_M, Z } from '../src/sim/map/street.js';
import { DAY } from '../src/sim/clock.js';
import { assert } from './helpers.mjs';

export default [
  {
    name: 'knowledge: the posting\'s places (and the assignments\') known from the start; a street walked known, and its shops; a waypoint is where the pointer leads, cleared on arrival',
    fn() {
      const c = newCampaign(51, candidates(51, 'london', 'junior')[0], 'london', 'junior');
      c.calls = [];
      const s = newGame({ seed: 51, scenario: 'campaign', campaign: c }), bus = createBus();
      start(s, bus);
      const before = knownPlaces(c), kinds0 = new Set(before.map(pl => pl.kind));
      step(s, { act: ['desk:travel:embassy'] }, bus);
      const me = playerActor(s), x0 = me.x;
      for (let t = 0; t < 20 * 60; t++) step(s, { mx: 1 }, bus);   // (a minute east along the embassy's street)
      const row = s.map.row, walked = Math.round(me.x - x0), after = knownPlaces(c), shops = after.filter(pl => !['home', 'work', 'safe', 'job'].includes(pl.kind));
      assert(['home', 'work', 'safe', 'job'].every(k => kinds0.has(k)) && before.every(pl => ['home', 'work', 'safe', 'job'].includes(pl.kind)), 'the flat, the embassy, the safe houses, the assignments\' places: known, and nothing else, before a step');
      assert(knows(c, row, Math.floor(me.x / SECTION_M)) && knows(c, row, Math.floor(x0 / SECTION_M)) && shops.length > 0 && knownStreets(c).length === 1, 'the street walked, known, and its shops');
      // (the waypoint: the first shop known; the pointer leads there; there, it's gone)
      const pl = shops[0];
      setWaypoint(c, pl);
      const goal = SCENARIOS.campaign.goal(s);
      Object.assign(me, { x: pl.x, z: Z.front + 0.8 });
      for (let t = 0; t < 25; t++) step(s, {}, bus);
      console.log(`      before a step: ${before.map(p => p.label).join(', ')}; ${walked} m along ${knownStreets(c)[0].name}: ${shops.length} places (${[...new Set(shops.map(p => p.kind))].join(', ')}); the waypoint ${pl.label}: the pointer "${goal?.label}"; there, cleared ${!c.waypoint}`);
      assert(goal?.name === pl.label && !c.waypoint, 'the pointer led to it; there, cleared');
    },
  },
  {
    name: 'belief: heat and cover read in words, never a number; a junior guesses, surer with weeks on the posting; a Handler surer from the start',
    fn() {
      const out = [];
      for (const lvl of ['junior', 'handler']) {
        const c = newCampaign(52, candidates(52, 'london', lvl)[0], 'london', lvl), p = c.character;
        const r0 = readOf(c, p, c.posting.startMs), s0 = spreadOf(p, c);
        c.now = c.posting.startMs + 30 * DAY; c.done = Array(8).fill({});
        const s1 = spreadOf(p, c), r1 = readOf(c, p, c.now);
        out.push(`${lvl}: ${s0.toFixed(1)} → ${s1.toFixed(1)} ("${r0.heat.sure}" → "${r1.heat.sure}")`);
        assert(!/\d/.test(r0.heat.text + r0.cover.text) && s1 < s0, `${lvl}: words, not numbers; surer with time`);
        if (lvl === 'junior') assert(/guess/.test(r0.heat.sure), 'a junior guesses at first');
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
];
