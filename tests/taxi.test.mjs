// A taxi (sim/taxi.js): hailed at the kerb (only there), the ride's minutes, the street there; follow that
// cab: whoever followed on foot and saw you get in may find one of their own and keep yours, a team's car
// more often, the long way round less; their car pulls in behind yours and they get out and follow on;
// being tailed's team writes the taxi down; Blown's driver may have heard the radio.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { atKerb, destinations, taxiComing, watching, chase, RIDE_SHOW_S, CHASE_BACK_M } from '../src/sim/taxi.js';
import { sendTaxi, laneOf, LANE_Z, freeShare } from '../src/sim/traffic.js';
import { makeAgent, follow } from '../src/sim/agents.js';
import { sheet } from '../src/sim/people.js';
import { createBus } from '../src/sim/bus.js';
import { calendar } from '../src/sim/clock.js';
import { affordance } from '../src/sim/acts.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';

const hail = (g) => { const me = playerActor(g); Object.assign(me, { z: Z.kerbN - 0.5, busy: null, glass: false }); };

// (a free taxi sent along the lane by the north kerb, the road clear of the rest of that way's cars)
const sendOne = (g) => { const dir = laneOf(g, 1) === LANE_Z.north ? 1 : -1; g.traffic.cars = g.traffic.cars.filter(c => c.dir !== dir); return sendTaxi(g, dir); };

// (London, seed 7: you at the north kerb, a follower behind you on the pavement, after you)
function atKerbFollowed({ tracking = 10, pathfinding = 10, back = 6 } = {}) {
  const g = newGame({ seed: 7, city: 'london', weather: 'clear' }), bus = createBus();
  start(g, bus);
  const me = playerActor(g), row = g.map.row ?? 0;
  Object.assign(me, { z: Z.kerbN - 0.5, face: 'up' });
  g.people.me.skills.pathfinding = [pathfinding, 0];
  g.people.fsb = sheet({ id: 'fsb', name: 'a watcher', sex: 'm', cls: 'civilian', skills: { tracking: [tracking, 0], awareness: [8, 0] } });
  const a = makeAgent(g, { who: 'fsb', row, x: me.x - back, z: Z.kerbN - 1.2, face: 'right' });
  follow(g, a, me, 8);
  for (let t = 0; t < 3; t++) step(g, {}, bus);
  return { g, bus, me, a };
}

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
    name: 'taxi: follow that cab: a follower who saw you get in finds a cab of their own (the hour\'s free ones) and keeps yours, by their Tracking against the driver\'s way; told to lose them, your Pathfinding; out of sight or too far back, lost',
    fn() {
      const N = 400, rows = [];
      const rate = (opts, lose = false) => {
        const { g, me, a } = atKerbFollowed(opts), to = { ...destinations(g, null).find(d => d.label === 'two streets south'), lose }, seen = watching(g, me);
        let kept = 0;
        for (let k = 0; k < N; k++) { a.ai.follow.lost = false; kept += chase(g, me, to, g.map.row ?? 0, seen).length; }
        return { r: kept / N, g };
      };
      for (const [label, opts] of [['even (Tracking 10)', {}], ['a better watcher (18)', { tracking: 18 }]]) {
        const plain = rate(opts), long = rate({ ...opts, pathfinding: 16 }, true), pro = rate({ ...opts, pathfinding: 24 }, true), raw = rate({ ...opts, pathfinding: 2 }, true);
        rows.push([label, plain.r, long.r, pro.r, raw.r]);
      }
      const far = rate({ back: 40 }), { g } = rate({}), k = calendar(g.time.ms);
      for (const [label, a, b, c, d] of rows) console.log(`      ${label}: kept your cab ${Math.round(a * 100)}%; the long way round, told by an officer (Pathfinding 16) ${Math.round(b * 100)}%, a better one (24) ${Math.round(c * 100)}%, a stranger to the city (2) ${Math.round(d * 100)}%`);
      console.log(`      40 m back: ${Math.round(far.r * 100)}% (at ${k.hour}:${String(k.minute).padStart(2, '0')}, free cabs ${Math.round(freeShare(g.time.ms) * 100)}%)`);
      const [even, better] = rows;
      assert(even[1] > 0.05 && even[1] < 0.4 && better[1] > even[1], 'a cab of their own now and then; the better watcher more');
      assert(even[2] < even[1] && even[3] <= even[2] && better[2] < better[1] && even[4] > even[1], 'the long way loses them more, the better you know the streets; badly told, worse than the driver\'s way');
      assert(far.r === 0, 'too far back: lost at the kerb');
    },
  },
  {
    name: 'taxi: follow that cab, played: a dogged watcher\'s cab comes along the lane after yours, stops a way behind you, and lets him out; he follows on',
    fn() {
      for (let tries = 0; tries < 20; tries++) {
        const { g, bus, me, a } = atKerbFollowed({ tracking: 30, pathfinding: 0 }), asked = [];
        bus.on('taxi', (v) => asked.push(v));
        for (let t = 0; t < tries * 3; t++) step(g, {}, bus);          // (each try its own dice)
        const c = sendOne(g);
        for (let t = 0; t < 600 && !asked.length; t++) step(g, { act: taxiComing(g, me) && !me.busy ? ['use'] : [] }, bus);
        if (!asked.length) continue;
        step(g, { act: [`taxi:${asked[0].find(d => d.label === 'two streets south').id}`] }, bus);
        for (let t = 0; t < (RIDE_SHOW_S + 1) * 20; t++) step(g, {}, bus);
        if (a.ai.follow.lost) continue;
        const hid = a.hidden, behindM = (me.x - a.x) * (laneOf(g, 1) === LANE_Z.south ? 1 : -1);
        let outS = null, cab = null;
        for (let t = 0; t < 60 * 20 && outS === null; t++) { step(g, {}, bus); if (!a.hidden) { outS = t / 20; cab = g.traffic.cars.find(o => o.taxi?.drop && Math.abs(o.x - a.x) < 4); } }
        for (let t = 0; t < 20 * 15; t++) step(g, { mx: 0.6 }, bus);
        const d = Math.hypot(a.x - me.x, a.z - me.z);
        console.log(`      a dogged watcher kept your cab (try ${tries + 1}): on your street ${a.row === g.map.row}, out of sight at first ${hid}, ${Math.round(behindM)} m behind you; out of a taxi ${!!cab} ${outS} s after you; fifteen seconds' walk on: ${Math.round(d)} m behind, still on you ${!a.ai.follow.lost}`);
        assert(hid && behindM >= CHASE_BACK_M[0] - 1 && behindM <= CHASE_BACK_M[1] + 1 && cab && outS > 2 && outS < 46, 'his cab along the lane, stopped behind you, him out of it');
        assert(!a.ai.follow.lost && d < 50, 'and on you still');
        return;
      }
      assert(false, 'a Tracking 30 watcher never kept a cab');
    },
  },
  {
    name: 'taxi: being tailed\'s team writes it down; a covert team\'s car keeps yours some evenings, an overt pair\'s cab fewer, the long way round fewer again, and they\'re out of it behind you; in Blown, the driver may have heard the radio',
    fn() {
      const tally = { overt: { n: 0, plain: 0, long: 0, out: 0 }, covert: { n: 0, plain: 0, long: 0, out: 0 } };
      let flagged = 0, rides = 0;
      for (let seed = 1; seed <= 40; seed++) {
        for (const lose of [false, true]) {
          const g = newGame({ seed, scenario: 'sdr' });
          start(g, null);
          if (g.scenario.team === 'none') break;
          for (let t = 0; t < 20 * 30; t++) step(g, {}, null);
          hail(g); step(g, {}, null);
          step(g, { act: [`taxi:${destinations(g, SCENARIOS.sdr)[2].id}${lose ? ':lose' : ''}`] }, null);
          const T = tally[g.scenario.team], kept = !g.scenario.teamLost;
          if (!lose) T.n++;
          T[lose ? 'long' : 'plain'] += kept; rides++;
          flagged += g.scenario.flags.some(f => f.kind === 'taxi');
          if (kept) { for (let t = 0; t < 20 * 50; t++) step(g, {}, null); T.out += g.scenario.crew.some(c => c.id && g.actors.find(a => a.id === c.id && !a.hidden)); }
        }
      }
      let caught = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = newGame({ seed, scenario: 'hunted' });
        start(g, null);
        hail(g); step(g, {}, null);
        step(g, { act: ['taxi:car'] }, null);
        caught += g.scenario.outcome === 'captured';
      }
      const pct = (a, n) => `${Math.round(100 * a / Math.max(1, n))}%`, { overt: o, covert: c } = tally;
      console.log(`      being tailed, two streets by taxi: a covert team kept you ${pct(c.plain, c.n)} of ${c.n} evenings, the long way round ${pct(c.long, c.n)}; an overt pair ${pct(o.plain, o.n)} of ${o.n}, the long way ${pct(o.long, o.n)}; kept, out of their car behind you within fifty seconds ${o.out + c.out} of ${o.plain + o.long + c.plain + c.long}; written down ${flagged} of ${rides}; Blown, 20 taxis: the driver had heard the radio ${caught}`);
      assert(c.plain / c.n > o.plain / o.n && c.plain > 0 && c.plain < c.n, 'a team\'s car keeps you more often than a pair on foot; not always');
      assert(c.long + o.long < c.plain + o.plain, 'the long way round loses them more');
      assert(o.out + c.out === o.plain + o.long + c.plain + c.long && flagged > rides / 2, 'kept, they\'re out behind you; and they saw it, mostly');
      assert(caught > 1 && caught < 12, 'a risk, in Blown');
    },
  },
];
