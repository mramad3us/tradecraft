// Cover (sim/cover.js; the user, 2026-11-04): what of a round the things on the street keep off, by the part and how you
// stand; a wall's corner better than a car, a car better than a bench; getting down behind it in the stop motion, and up.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { coverOf, postureOf, COVER } from '../src/sim/cover.js';
import { toggle, options, choose } from '../src/sim/shooting.js';
import { newGun } from '../src/sim/firearms.js';
import { townOf } from '../src/sim/cities/index.js';
import { sectionOf } from '../src/sim/city.js';
import { SECTION_M } from '../src/sim/map/street.js';
import { sheet } from '../src/sim/people.js';
import { makeAgent } from '../src/sim/agents.js';
import { assert, fmt } from './helpers.mjs';

function scene(city = 'london') {
  const g = newGame({ seed: 4, scenario: 'walk', city, hour: 12, weather: 'clear' }), bus = { emit() {}, on() {} };
  start(g, bus);
  for (let t = 0; t < 20; t++) step(g, {}, bus);
  return { g, bus, me: playerActor(g) };
}
// (a parked car on the street near x, and a lane's mouth with a building's corner by it)
function find(g, x) {
  const town = townOf(g.map), row = g.map.row ?? 0, i0 = Math.floor(x / SECTION_M);
  let car = null, corner = null;
  for (let k = 0; k < 6 && (!car || !corner); k++) for (const i of [i0 + k, i0 - k]) {
    const S = sectionOf(town, row, i);
    car ??= S.blockers.find(b => b.what === 'car' && b.z1 < 5);
    if (!corner) for (const gp of S.gapsN) { const b = S.blockers.find(o => o.what === 'building' && Math.abs(o.x0 - gp.x1) < 0.3 && o.z1 >= -5.1); if (b) { corner = b; break; } }
  }
  return { car, corner };
}

export default [
  {
    name: 'cover: what of an officer\'s rounds it keeps off, by how you stand: in the open none; behind a parked car, to the chest; down behind it, all but the doors\' share; at a wall\'s corner the most; a bench little',
    fn() {
      const w = scene(), { car, corner } = find(w.g, w.me.x);
      assert(car && corner, 'a car and a corner');
      const cx = (car.x0 + car.x1) / 2, at = (x, z, cover) => ({ x, z, cover }), keeps = (from, to, part, posture) => coverOf(w.g, from, to, part, posture)?.keeps ?? 0;
      const across = { x: cx, z: 8.5 };                               // (an officer on the far pavement, across the road)
      const behindCar = at(cx, -1.0);
      const rows = {
        open: keeps(across, at(cx + 30, -1.0), 'torso', 'stand'),
        carStand: keeps(across, behindCar, 'torso', 'stand'), carStandHead: keeps(across, behindCar, 'head', 'stand'), carStandLegs: keeps(across, behindCar, 'legs', 'stand'),
        carDown: keeps(across, behindCar, 'torso', 'crouch'), carUp: keeps(across, behindCar, 'torso', 'rise'), carUpHead: keeps(across, behindCar, 'head', 'rise'),
      };
      // (at the corner of a building by a lane's mouth, an officer down the pavement)
      const along = { x: corner.x0 + 9, z: -2.7 }, round = at(corner.x0 - 0.45, -5.6);
      rows.cornerLean = keeps(along, round, 'torso', 'rise'); rows.cornerDown = keeps(along, round, 'torso', 'crouch');
      rows.benchDown = COVER.bench.stop * 0.9;                        // (a bench, down behind it: the share of you, ×its stop)
      console.log(`      kept off a round at the chest: in the open ${fmt(rows.open, 2)}; behind a parked car standing ${fmt(rows.carStand, 2)} (the head ${fmt(rows.carStandHead, 2)}, the legs ${fmt(rows.carStandLegs, 2)}), down behind it ${fmt(rows.carDown, 2)}, up over it to fire ${fmt(rows.carUp, 2)} (the head ${fmt(rows.carUpHead, 2)}); at a wall's corner leaning out ${fmt(rows.cornerLean, 2)}, hidden round it ${fmt(rows.cornerDown, 2)}; down behind a bench ${fmt(rows.benchDown, 2)}`);
      assert(rows.open === 0 && rows.carStandHead === 0 && rows.carStand > 0.4 && rows.carDown >= 0.59 && rows.carUpHead < 0.25 && rows.carUp < rows.carDown && rows.cornerDown === 1 && rows.cornerLean > rows.carStand && rows.carStand > rows.benchDown, JSON.stringify(rows));
    },
  },
  {
    name: 'cover: in the stop motion by a parked car, an officer across the road: "Get down behind the parked car", and you\'re down behind it, the gait a crouch; an aim has you up over it, and down again',
    fn() {
      const w = scene(), { car } = find(w.g, w.me.x), cx = (car.x0 + car.x1) / 2, p = w.g.people[w.me.who];
      Object.assign(w.me, { x: cx + 0.6, z: -1.6, head: Math.PI / 2, face: 'down' });
      w.g.people.copX = sheet({ id: 'copX', name: 'a police officer', cls: 'cop' });
      const c = makeAgent(w.g, { who: 'copX', row: w.g.map.row ?? 0, x: cx, z: 8.5, speed: 1.1, face: 'up' });
      Object.assign(c, { cop: true, alert: { since: w.g.time.ms } }); c.ai.route = null; c.ai.wait = 20 * 600;
      p.hand = newGun(p, 'glock17');
      for (let t = 0; t < 4; t++) step(w.g, {}, w.bus);
      toggle(w.g, w.bus);
      const o = options(w.g).find(x => x.key === 'cover');
      choose(w.g, w.bus, 'cover');
      for (let t = 0; t < 40 && w.g.shoot?.phase === 'act'; t++) step(w.g, {}, w.bus);
      const down = { cover: w.me.cover?.word, gait: w.me.gait, posture: postureOf(w.g, w.me), keeps: coverOf(w.g, c, w.me, 'torso', postureOf(w.g, w.me))?.keeps ?? 0 };
      w.g.shoot.aim = { key: c.id, settled: w.g.time.ms };              // (an aim held at him: up over it)
      const up = { posture: postureOf(w.g, w.me), again: options(w.g).find(x => x.key === 'cover')?.label };
      console.log(`      offered: "${o?.label}" (${o?.ms} ms); then ${down.gait}, behind ${down.cover}, ${fmt(down.keeps, 2)} of his rounds kept off; aiming, ${up.posture}, and "${up.again}"`);
      assert(o && down.cover && down.gait === 'kneel' && down.posture === 'crouch' && down.keeps >= 0.5 && up.posture === 'rise' && /Down behind/.test(up.again ?? ''), JSON.stringify({ o, down, up }));
    },
  },
];
