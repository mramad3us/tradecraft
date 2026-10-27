// A taxi (sim/taxi.js): hailed at the kerb (only there), the ride's minutes, the street there; whoever
// followed on foot has lost you; being tailed's team, lost and the taxi written down if one saw it;
// Blown's driver may have heard the radio.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { atKerb, destinations } from '../src/sim/taxi.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';

const hail = (g) => { const me = playerActor(g); Object.assign(me, { z: Z.kerbN - 0.5, busy: null, glass: false }); };

export default [
  {
    name: 'taxi: only at the kerb; T offers it; the ride takes its minutes and puts you on the street you asked for',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk' });
      start(g, null);
      const me = playerActor(g);
      const asked = [], bus = { emit: (k, v) => { if (k === 'taxi') asked.push(v); }, on() {} };
      assert(!atKerb(g, me), 'not from the middle of the pavement');
      hail(g);
      for (let t = 0; t < 25; t++) step(g, {}, bus);
      step(g, { act: ['instinct'] }, bus);
      const list = asked[0], t0 = g.time.ms;
      step(g, { act: [`taxi:${list.find(d => d.label === 'four streets south').id}`] }, bus);
      console.log(`      the offer: ${g.$offer?.text ?? '(taken)'}; asked where: ${list.map(d => d.label).join(', ')}; four streets south: ${fmt((g.time.ms - t0) / 60000, 1)} min, now row ${g.map.row}`);
      assert(list.length === 4 && g.map.row === 4 && playerActor(g).row === 4 && g.time.ms - t0 > 10 * 60000, 'there, minutes later');
    },
  },
  {
    name: 'taxi: being tailed\'s team loses you (and writes it down if one saw); in Blown, the driver may have heard the radio',
    fn() {
      let lost = 0, flagged = 0, n = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const g = newGame({ seed, scenario: 'sdr' });
        start(g, null);
        if (g.scenario.team === 'none') continue;
        for (let t = 0; t < 20 * 30; t++) step(g, {}, null);
        hail(g); step(g, {}, null);
        step(g, { act: [`taxi:${destinations(g, SCENARIOS.sdr)[2].id}`] }, null);
        n++; lost += g.scenario.teamLost; flagged += g.scenario.flags.some(f => f.kind === 'taxi');
      }
      let caught = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = newGame({ seed, scenario: 'hunted' });
        start(g, null);
        hail(g); step(g, {}, null);
        step(g, { act: ['taxi:car'] }, null);
        caught += g.scenario.outcome === 'captured';
      }
      console.log(`      being tailed, ${n} evenings with a team: lost them ${lost}, written down ${flagged}; Blown, 20 taxis: the driver had heard the radio ${caught}`);
      assert(lost === n && flagged > 0, 'lost them; and they saw it, mostly');
      assert(caught > 1 && caught < 12, 'a risk, in Blown');
    },
  },
];
