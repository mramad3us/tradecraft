// A taxi (sim/taxi.js): hailed at the kerb (only there), the ride's minutes, the street there; whoever
// followed on foot has lost you; being tailed's team, lost and the taxi written down if one saw it;
// Blown's driver may have heard the radio.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { atKerb, destinations, taxiComing, RIDE_SHOW_S } from '../src/sim/taxi.js';
import { sendTaxi, laneOf, LANE_Z } from '../src/sim/traffic.js';
import { affordance } from '../src/sim/acts.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';

const hail = (g) => { const me = playerActor(g); Object.assign(me, { z: Z.kerbN - 0.5, busy: null, glass: false }); };

// (a free taxi sent along the lane by the north kerb, the road clear of the rest of that way's cars)
const sendOne = (g) => { const dir = laneOf(g, 1) === LANE_Z.north ? 1 : -1; g.traffic.cars = g.traffic.cars.filter(c => c.dir !== dir); return sendTaxi(g, dir); };

export default [
  {
    name: 'taxi: hailed for real: T only with a free one coming; an arm up; it stops by you and asks where; in, away with it, and out of one there; a taken one drives by; walk off and it goes',
    fn() {
      const out = [];
      for (const [seed, city] of [[4, null], [6, 'london'], [8, 'cairo']]) {
        const g = newGame({ seed, scenario: 'walk', city });
        start(g, null);
        const me = playerActor(g), asked = [], bus = { emit: (k, v) => { if (k === 'taxi') asked.push(v); }, on() {} };
        hail(g);
        for (let t = 0; t < 10; t++) step(g, {}, bus);
        g.traffic.cars = g.traffic.cars.filter(c => !c.taxi);
        assert(affordance(g, me)?.act !== 'taxi', `${seed}: no taxi coming, none offered`);
        // (a taken one: no offer, and it drives by)
        const busy = sendOne(g); busy.taxi.free = false;
        for (let t = 0; t < 200 && !(busy.x * busy.dir > me.x * busy.dir); t++) { step(g, {}, bus); assert(affordance(g, me)?.act !== 'taxi', `${seed}: a taken taxi isn't offered`); }
        // (a free one: offered when in sight; T, the arm up; it stops by you, and asks)
        const c = sendOne(g);
        let hailedAt = null;
        for (let t = 0; t < 600 && !asked.length; t++) {
          if (hailedAt === null && taxiComing(g, me)) { assert(affordance(g, me)?.act === 'taxi', `${seed}: offered`); step(g, { act: ['use'] }, bus); hailedAt = (me.x - c.x) * c.dir; assert(me.gait === 'hail', `${seed}: the arm up`); }
          else step(g, {}, bus);
        }
        assert(asked.length && c.taxi.stopped && Math.abs(c.x - me.x) < 2.5 && c.v === 0, `${seed}: stopped by you, and asked where`);
        const to = asked[0].find(d => d.label === 'two streets south'), t0 = g.time.ms;
        step(g, { act: [`taxi:${to.id}`] }, bus);
        assert(me.hidden && me.cab && !c.taxi.free, `${seed}: in, its light dark`);
        const x0 = me.x;
        for (let t = 0; t < (RIDE_SHOW_S - 1) * 20; t++) step(g, {}, bus);
        const went = Math.abs(me.x - x0);
        for (let t = 0; t < 40; t++) step(g, {}, bus);
        const drop = g.traffic.cars.find(o => o.taxi?.drop && Math.abs(o.x - me.x) < 3);
        assert(g.map.row === 2 && !me.hidden && drop && went > 3, `${seed}: away with it (${went.toFixed(1)} m), there, out of a taxi`);
        out.push(`${city ?? 'moscow'}: hailed at ${hailedAt.toFixed(0)} m, rode ${went.toFixed(1)} m in sight, ${((g.time.ms - t0) / 60000).toFixed(0)} min to two streets south`);
        // (hail one and walk off: it goes)
        hail(g); for (let t = 0; t < 10; t++) step(g, {}, bus);
        const c2 = sendOne(g);
        for (let t = 0; t < 600 && !taxiComing(g, me); t++) step(g, {}, bus);
        step(g, { act: ['use'] }, bus);
        me.busy = null; me.x += 8 * -c2.dir;
        for (let t = 0; t < 5; t++) step(g, {}, bus);
        assert(!c2.taxi.hail, `${seed}: walked off, it goes`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'taxi: only at the kerb; T offers it (a free one coming); the ride takes its minutes and puts you on the street you asked for',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk' });
      start(g, null);
      const me = playerActor(g);
      const asked = [], bus = { emit: (k, v) => { if (k === 'taxi') asked.push(v); }, on() {} };
      assert(!atKerb(g, me), 'not from the middle of the pavement');
      hail(g);
      for (let t = 0; t < 25; t++) step(g, {}, bus);
      const c = sendOne(g);
      for (let t = 0; t < 600 && !taxiComing(g, me); t++) step(g, {}, bus);
      step(g, { act: ['use'] }, bus);
      for (let t = 0; t < 600 && !asked.length; t++) step(g, {}, bus);
      const list = asked[0], t0 = g.time.ms;
      step(g, { act: [`taxi:${list.find(d => d.label === 'four streets south').id}`] }, bus);
      for (let t = 0; t < RIDE_SHOW_S * 20 + 5; t++) step(g, {}, bus);
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
