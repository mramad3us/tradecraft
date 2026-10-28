// In a shop (sim/shops.js, its floor sim/interiors/shop.js): walked into at its door (the scene hears),
// T at the counter, a minute there, seen through the window; out the back door, the yard, and out in the
// lane beside it; being tailed's team, seen you go in, watches the door, and loses you out the back (now
// and then, covert, they'd covered it), and writes it down; a café's basin; a coat off the rail.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { atDoor, walk, walkIn, spotOf } from './shopwalk.mjs';
import { follow } from '../src/sim/agents.js';
import { unitAt } from '../src/sim/interiors/use.js';
import { backWay, BROWSE_S, YARD_S, BACK_REACH_M, COAT_S, WASH_S } from '../src/sim/shops.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { mods as showsMods } from '../src/sim/notice.js';
import { bodyLine } from '../src/sim/aid.js';
import { at } from '../src/sim/clock.js';
import { cashOf, price, COAT_USD } from '../src/sim/money.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';


export default [
  {
    name: 'shops: walked in at the door (the scene hears); T at the counter, a minute there, in sight; out the back door: the yard, out in the lane beside',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk' });
      start(g, null);
      const heard = [], asked = [], bus = { emit: (k, v) => { if (k === 'shop') asked.push(v); }, on() {} };
      SCENARIOS.walk.onShop = (state, b, phase, way) => heard.push(`${phase}:${way}`);
      try {
        for (let t = 0; t < 10; t++) step(g, {}, bus);
        const u = atDoor(g, (o) => o.exits.length && o.spots.some(s => s.kind === 'counter')), me = playerActor(g);
        const inside = walkIn(g, u, bus);
        const c = spotOf(u, 'counter'), atC = walk(g, c.x, c.z, bus);
        step(g, {}, bus);
        const offer = g.$offer?.text;
        step(g, { act: ['instinct'] }, bus);
        const t0 = g.time.ms;
        step(g, { act: ['shop:browse'] }, bus);
        const seen = !me.hidden && !!me.inside;
        for (let t = 0; t < 20 * (BROWSE_S + 2) && me.inside; t++) step(g, { mx: 1 }, bus);   // (pushing to walk: the feet are the shop's)
        const browse = (g.time.ms - t0) / 1000;
        const b = spotOf(u, 'back'), atB = walk(g, b.x, b.z, bus);
        step(g, {}, bus);
        const offerB = g.$offer?.text;
        const t1 = g.time.ms;
        step(g, { act: ['instinct'] }, bus);
        const hidden = me.hidden;
        for (let t = 0; t < 20 * (YARD_S + 2) && me.inside; t++) step(g, {}, bus);
        console.log(`      ${u.shop} (${fmt(u.x1 - u.x0, 1)} m wide): in at the door ${inside}; at the counter ${atC}, "${offer}", asked: ${asked[0]?.ways.map(w => w.id).join(', ')}; a browse ${fmt(browse, 0)} s, in sight ${seen}; at the back door ${atB}, "${offerB}"; the yard ${fmt((g.time.ms - t1) / 1000, 0)} s, out of sight ${hidden}; now ${fmt(u.door - me.x, 1)} m along, ${fmt(Z.front - me.z, 1)} m up the lane; the scene heard ${heard.join(', ')}`);
        assert(inside && atC && atB, 'walked in, to the counter, to the back door');
        assert(/counter/.test(offer) && asked[0]?.ways.some(w => w.id === 'browse') && seen && browse >= BROWSE_S, 'the counter offered; a minute there, in sight');
        assert(/back door/.test(offerB) && hidden && !me.hidden && !me.within && g.map.row === 0 && me.z < Z.front - 3 && Math.abs(me.x - u.door) < BACK_REACH_M, 'out the back, out of sight, up the lane beside');
        assert(heard.join() === 'in:front,out:back', 'the scene heard in at the front, out at the back');
      } finally { delete SCENARIOS.walk.onShop; }
    },
  },
  {
    name: 'shops: being tailed, seen going in they watch the door; out the back they lose you (or had it covered) and write it down',
    heavy: true,
    fn() {
      let n = 0, lost = 0, covered = 0, flagged = 0, front = 0, waited = 0;
      for (let seed = 1; n < 14 && seed < 80; seed++) {
        const g = newGame({ seed, scenario: 'sdr' });
        start(g, null);
        if (g.scenario.team === 'none') continue;
        for (let t = 0; t < 20 * 40; t++) step(g, {}, null);
        const sc = g.scenario;
        if (!sc.crew.some(c => c.id) || sc.teamLost) continue;
        const u = atDoor(g, (o) => o.exits.length && backWay(g, { x: o.door, shop: o.shop }));
        if (!u || !walkIn(g, u)) continue;
        if (!sc.inShop?.seen) continue;
        n++;
        const back = n % 2 === 1;
        const c = spotOf(u, 'counter');
        walk(g, c.x, c.z);
        step(g, { act: ['shop:browse'] }, null);
        for (let t = 0; t < 20 * (BROWSE_S + 2) && playerActor(g).inside; t++) step(g, {}, null);
        // (one of them where the door can be seen, out on the street: not in after you)
        waited += sc.crew.some(c => { const a = c.id && g.actors.find(o => o.id === c.id); return a && Math.abs(a.x - u.door) < 15 && a.z > Z.front && !a.within; });
        if (back) {
          const b = spotOf(u, 'back');
          walk(g, b.x, b.z);
          step(g, { act: ['shop:back'] }, null);
          for (let t = 0; t < 20 * (YARD_S + 2) && playerActor(g).inside; t++) step(g, {}, null);
        } else walk(g, u.door, Z.front + 0.8);
        for (let t = 0; t < 20 * 15; t++) step(g, {}, null);
        if (back) { lost += sc.teamLost; covered += !sc.teamLost; flagged += sc.flags.some(f => f.kind === 'backway'); } else front += !sc.teamLost;
      }
      console.log(`      ${n} evenings seen going in: one of them watching the door ${waited}; out the back ${Math.ceil(n / 2)}: lost them ${lost}, covered ${covered}, written down ${flagged}; out the front ${Math.floor(n / 2)}: still on you ${front}`);
      assert(n >= 8 && lost >= 1 && flagged === lost + covered && front >= Math.floor(n / 2) - 2, 'the back loses them, mostly; the front doesn\'t');
      assert(waited >= n / 2, 'they wait on the door');
    },
  },
  {
    name: 'shops: a follower (Blown\'s hunter) doesn\'t come in after you: out on the pavement, a few metres along, waiting on the door',
    fn() {
      let n = 0, ok = 0;
      const where = [];
      for (let seed = 1; seed <= 6; seed++) {
        const g = newGame({ seed, scenario: 'hunted' });
        start(g, null);
        for (let t = 0; t < 40; t++) step(g, {}, null);
        const me = playerActor(g), u = atDoor(g, (o) => o.spots.some(s => s.kind === 'counter')), h = g.actors.find(a => g.scenario.hunters.includes(a.id));
        if (!u || !h) continue;
        Object.assign(h, { x: me.x - 14, z: me.z, row: undefined }); h.ai.route = null;   // (on this street, 14 m back)
        follow(g, h, me, 10);
        for (let t = 0; t < 20 * 3; t++) step(g, {}, null);
        walkIn(g, u);
        const c = spotOf(u, 'counter');
        walk(g, c.x, c.z);
        for (let t = 0; t < 20 * 25; t++) step(g, {}, null);
        const fo = h.ai.follow;
        n++;
        ok += !!(fo && !fo.lost && Math.abs((fo.inside?.x ?? 1e9) - u.door) < 0.5 && h.z > Z.front && !unitAt(g, h.x, h.z));
        where.push(`${fmt(h.x - u.door, 1)} m`);
      }
      console.log(`      ${ok} of ${n} waiting on the door after 25 s inside, at ${where.join(', ')} from it`);
      assert(n >= 4 && ok === n, 'every one waiting on the door, outside');
    },
  },
  {
    name: 'blood shows: people seeing it remember the face (heat), Orlov looks harder; a café\'s basin washes the face clean',
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
      // the basin, at the back of a café
      const u = atDoor(g, (o) => o.spots.some(s => s.kind === 'wash'));
      walkIn(g, u);
      const w = spotOf(u, 'wash'), there = walk(g, w.x, w.z);
      step(g, {}, null);
      const offer = g.$offer?.text;
      step(g, { act: ['instinct'] }, null);
      for (let t = 0; t < 20 * (WASH_S + 5) && me.inside; t++) step(g, {}, null);
      console.log(`      two minutes walking bloody at lunchtime: heat ${heat0} → ${heat1}; the instinct: "${line}"; to a watcher: ${mod}; at ${u.shop}'s basin ${there}: "${offer}"; after it: ${p.bloody ? JSON.stringify(p.bloody) : 'clean'}`);
      assert(heat1 > heat0 && /face/.test(line) && there && /basin/.test(offer) && !p.bloody?.face, 'noticed, said, washed');
    },
  },
  {
    name: 'money: a coat off the rail (another colour, paid for; out the door in it, the scene hears), a taxi\'s fare; short of cash, nothing doing',
    fn() {
      const g = newGame({ seed: 7, scenario: 'walk' });
      g.time.ms = at(2026, 11, 2, 13, 0);
      start(g, null);
      const me = playerActor(g), p = g.people[g.player], heard = [];
      SCENARIOS.walk.onShop = (state, b, phase, way) => heard.push(`${phase}:${way}`);
      try {
        for (let t = 0; t < 10; t++) step(g, {}, null);
        const u = atDoor(g, (o) => o.shop === 'clothes');
        walkIn(g, u);
        const c = spotOf(u, 'counter');
        walk(g, c.x, c.z);
        const cash0 = cashOf(p), coat0 = p.look.top.color;
        step(g, { act: ['shop:coat'] }, null);
        for (let t = 0; t < 20 * (COAT_S + 2) && me.inside; t++) step(g, {}, null);
        const cash1 = cashOf(p), coat1 = p.look.top.color;
        walk(g, u.door, Z.front + 0.8);
        Object.assign(me, { z: Z.kerbN - 0.5, busy: null });
        step(g, {}, null);
        step(g, { act: ['taxi:off2'] }, null);
        const cash2 = cashOf(p), row = g.map.row;
        p.cash = 1;
        Object.assign(playerActor(g), { z: Z.kerbN - 0.5, busy: null });
        step(g, {}, null);
        step(g, { act: ['taxi:off2'] }, null);
        console.log(`      a coat: ${price(g, cash0 - cash1)} (${coat0.toString(16)} → ${coat1.toString(16)}), the scene heard ${heard.join(', ')}; a taxi two streets: ${price(g, cash1 - cash2)}, now row ${row}; with ${price(g, 1)}: row ${g.map.row}, "${g.log.at(-1).text}"`);
        assert(cash1 === cash0 - COAT_USD && coat1 !== coat0 && heard.join() === 'in:front,out:coat', 'the coat, paid for, worn out of the door');
        assert(cash2 < cash1 && row === 2 && g.map.row === 2, 'the fare taken; short, no ride');
      } finally { delete SCENARIOS.walk.onShop; }
    },
  },
];
