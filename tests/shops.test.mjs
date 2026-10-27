// Into a shop (sim/shops.js): T at its door offers it; the front a minute and out the same door; the
// back a minute more and out on the street behind; being tailed's team, seen you go in, watches the
// door, and loses you out the back (now and then, covert, they'd covered it), and writes it down.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { shopNear, backWay, ways, TOILETS, BROWSE_S, BACKWAY_S } from '../src/sim/shops.js';
import { mods as showsMods } from '../src/sim/notice.js';
import { bodyLine } from '../src/sim/aid.js';
import { at } from '../src/sim/clock.js';
import { Z } from '../src/sim/map/street.js';
import { sectionAt } from '../src/sim/world.js';
import { assert, fmt } from './helpers.mjs';

/** The player at the door of a shop with a back way (or any shop), on this street. */
function atDoor(g, back = true) {
  const me = playerActor(g);
  for (let x = me.x; x < me.x + 400; x += 2) {
    const d = sectionAt(g, x)?.doors.find(o => o.kind === 'shop' && o.z === Z.front && Math.abs(o.x - x) < 1 && (!back || backWay(g, o)));
    if (d) { Object.assign(me, { x: d.x, z: Z.front + 0.6, busy: null, glass: false }); return d; }
  }
  return null;
}

export default [
  {
    name: 'shops: T at a door offers it; out the front after a minute, at the door; out the back onto the street behind',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk' });
      start(g, null);
      const asked = [], bus = { emit: (k, v) => { if (k === 'shop') asked.push(v); }, on() {} };
      for (let t = 0; t < 10; t++) step(g, {}, bus);
      const d = atDoor(g);
      step(g, {}, bus);
      const offer = g.$offer?.text;
      step(g, { act: ['instinct'] }, bus);
      const me = playerActor(g), t0 = g.time.ms;
      step(g, { act: ['shop:front'] }, bus);
      const hidden = me.hidden;
      for (let t = 0; t < 20 * (BROWSE_S + 2) && me.inside; t++) step(g, { mx: 1 }, bus);   // (pushing to walk: the feet are the shop's)
      const front = { s: (g.time.ms - t0) / 1000, at: Math.abs(me.x - d.x) < 0.5 && !me.hidden };
      const t1 = g.time.ms;
      step(g, { act: ['shop:back'] }, bus);
      for (let t = 0; t < 20 * (BACKWAY_S + 2) && me.inside; t++) step(g, {}, bus);
      console.log(`      at ${d.shop}'s door: "${offer}"; asked: ${asked[0]?.ways.map(w => w.id).join(', ')}; the front: ${fmt(front.s, 0)} s, out at the door ${front.at}; the back: ${fmt((g.time.ms - t1) / 1000, 0)} s, now row ${g.map.row}`);
      assert(/go into/.test(offer) && ['front', 'back'].every(k => asked[0]?.ways.some(w => w.id === k)) && hidden, 'offered, the front and the back, out of sight inside');
      assert(front.at && g.map.row === -1 && !me.hidden, 'out the front at the door; out the back a street north');
    },
  },
  {
    name: 'shops: being tailed, seen going in they watch the door; out the back they lose you (or had it covered) and write it down',
    heavy: true,
    fn() {
      let n = 0, lost = 0, covered = 0, flagged = 0, front = 0;
      for (let seed = 1; n < 14 && seed < 80; seed++) {
        const g = newGame({ seed, scenario: 'sdr' });
        start(g, null);
        if (g.scenario.team === 'none') continue;
        for (let t = 0; t < 20 * 40; t++) step(g, {}, null);
        const sc = g.scenario;
        if (!sc.crew.some(c => c.id) || sc.teamLost) continue;
        if (!atDoor(g)) continue;
        step(g, {}, null);
        const back = n % 2 === 0;
        step(g, { act: [`shop:${back ? 'back' : 'front'}`] }, null);
        if (!sc.inShop?.seen) continue;
        n++;
        for (let t = 0; t < 20 * 70 && playerActor(g).inside; t++) step(g, {}, null);
        for (let t = 0; t < 20 * 15; t++) step(g, {}, null);
        if (back) { lost += sc.teamLost; covered += !sc.teamLost; flagged += sc.flags.some(f => f.kind === 'backway'); } else front += !sc.teamLost;
      }
      console.log(`      ${n} evenings seen going in: out the back ${n / 2}: lost them ${lost}, covered ${covered}, written down ${flagged}; out the front ${n / 2}: still on you ${front}`);
      assert(n >= 8 && lost >= 1 && flagged === lost + covered && front >= n / 2 - 2, 'the back loses them, mostly; the front doesn\'t');
    },
  },
  {
    name: 'blood shows: people seeing it remember the face (heat), Orlov looks harder; a café\'s toilet washes the face clean',
    fn() {
      const g = newGame({ seed: 5, scenario: 'walk' });
      g.time.ms = at(2026, 11, 2, 13, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      p.bloody = { face: g.time.ms };
      const heat0 = Object.values(g.heat)[0];
      for (let t = 0; t < 20 * 120; t++) step(g, { mx: t % 400 < 200 ? 1 : -1 }, null);
      const heat1 = Object.values(g.heat)[0];
      const line = bodyLine(g)?.text;
      const mod = showsMods(p).map(m => `${m.why} +${m.v}`).join(', ');
      // the toilet
      let d = null;
      for (let x = me.x - 300; x < me.x + 300 && !d; x += 2) d = sectionAt(g, x)?.doors.find(o => o.kind === 'shop' && o.z === Z.front && Math.abs(o.x - x) < 1 && TOILETS.has(o.shop));
      Object.assign(me, { x: d.x, z: Z.front + 0.6, busy: null, glass: false });
      step(g, {}, null);
      const offered = ways(g, d).some(w => w.id === 'wash');
      step(g, { act: ['shop:wash'] }, null);
      for (let t = 0; t < 20 * 95 && me.inside; t++) step(g, {}, null);
      console.log(`      two minutes walking bloody at lunchtime: heat ${heat0} → ${heat1}; the instinct: "${line}"; to a watcher: ${mod}; ${d.shop}'s toilet offered ${offered}, after it: ${p.bloody ? JSON.stringify(p.bloody) : 'clean'}`);
      assert(heat1 > heat0 && /face/.test(line) && offered && !p.bloody?.face, 'noticed, said, washed');
    },
  },
];
