// In a shop (sim/shops.js, its floor sim/interiors/shop.js): walked into at its door (the scene hears),
// T at the counter, a minute there, seen through the window; out the back door, the yard, and out in the
// lane beside it; being tailed's team, seen you go in, watches the door, and loses you out the back (now
// and then, covert, they'd covered it), and writes it down; a café's basin; a coat off the rail.
import { newGame, start, step, playerActor, loadRow } from '../src/sim/game.js';
import { newCampaign, candidates } from '../src/sim/campaign.js';
import { createBus } from '../src/sim/bus.js';
import { atDoor, walk, walkIn, spotOf } from './shopwalk.mjs';
import { follow } from '../src/sim/agents.js';
import { unitAt } from '../src/sim/interiors/use.js';
import { KEEP_USD, CLUB_MONTH_USD, backWay, BROWSE_S, YARD_S, BACK_REACH_M, COAT_S, WASH_S } from '../src/sim/shops.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { mods as showsMods } from '../src/sim/notice.js';
import { bodyLine } from '../src/sim/aid.js';
import { at } from '../src/sim/clock.js';
import { cashOf, price } from '../src/sim/money.js';
import { RAIL } from '../src/sim/clothes.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';


export default [
  {
    name: 'shops: walked in at the door (the scene hears); T at the counter, a minute\'s browse (the clock skips it, the feet free at once); out the back door: the yard, out in the lane beside',
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
        step(g, { act: ['use'] }, bus);
        const t0 = g.time.ms;
        step(g, { act: ['shop:browse'] }, bus);
        const browse = (g.time.ms - t0) / 1000, free = !me.inside && !me.hidden && !!me.within;   // (skipped: the minute gone, still in the shop, free to walk)
        const b = spotOf(u, 'back'), atB = walk(g, b.x, b.z, bus);
        step(g, {}, bus);
        const offerB = g.$offer?.text;
        const t1 = g.time.ms;
        step(g, { act: ['use'] }, bus);
        const yard = (g.time.ms - t1) / 1000;
        console.log(`      ${u.shop} (${fmt(u.x1 - u.x0, 1)} m wide): in at the door ${inside}; at the counter ${atC}, "${offer}", asked: ${asked[0]?.ways.map(w => w.id).join(', ')}; a browse ${fmt(browse, 0)} s of the clock, free at once ${free}; at the back door ${atB}, "${offerB}"; the yard ${fmt(yard, 0)} s of the clock; now ${fmt(u.door - me.x, 1)} m along, ${fmt(Z.front - me.z, 1)} m up the lane; the scene heard ${heard.join(', ')}`);
        assert(inside && atC && atB, 'walked in, to the counter, to the back door');
        assert(/counter/.test(offer) && asked[0]?.ways.some(w => w.id === 'browse') && free && browse >= BROWSE_S, 'the counter offered; a minute of the clock, free at once');
        assert(/back door/.test(offerB) && yard >= YARD_S && !me.hidden && !me.within && g.map.row === 0 && me.z < Z.front - 3 && Math.abs(me.x - u.door) < BACK_REACH_M, 'out the back, out of sight, up the lane beside');
        assert(heard.join() === 'in:front,out:back', 'the scene heard in at the front, out at the back');
      } finally { delete SCENARIOS.walk.onShop; }
    },
  },
  {
    name: 'shops: what\'s bought is skipped (a book: the clock three minutes on, the feet free at once); the window\'s coffee is lived, the street watched, and moving ends it',
    fn() {
      const g = newGame({ seed: 6, scenario: 'walk' });
      start(g, null);
      const me = playerActor(g), p = g.people[g.player];
      p.cash = 5000;
      for (let t = 0; t < 10; t++) step(g, {}, null);
      const b = atDoor(g, (o) => o.shop === 'books');
      walkIn(g, b);
      const c = spotOf(b, 'counter');
      walk(g, c.x, c.z);
      const t0 = g.time.ms, tick0 = g.tick;
      step(g, { act: ['shop:book:grammar'] }, null);
      const book = { mins: (g.time.ms - t0) / 60000, ticks: g.tick - tick0, free: !me.inside, got: p.books?.some(x => x.id === 'grammar') };
      walk(g, b.door, Z.front + 0.8);
      const u = atDoor(g, (o) => o.spots.some(s => s.kind === 'sit'));
      walkIn(g, u);
      const w = spotOf(u, 'sit');
      walk(g, w.x, w.z);
      step(g, {}, null);
      step(g, { act: ['shop:sit'] }, null);                              // (the coffee, of the two the window offers now: a book's on the go)
      const way = me.inside?.way, t1 = g.time.ms;
      for (let t = 0; t < 20 * 20; t++) step(g, {}, null);
      const still = me.inside?.way === 'sit';
      step(g, { mx: 1 }, null);
      const lived = (g.time.ms - t1) / 1000;
      console.log(`      a grammar: ${fmt(book.mins, 1)} min of the clock in ${book.ticks} tick, free at once ${book.free}, in the pocket ${book.got}; at ${u.shop}'s window: "${way}", 20 s in still at it ${still}, moved: done after ${fmt(lived, 0)} s lived (${g.log.at(-1).text})`);
      assert(book.mins >= 3 && book.ticks <= 1 && book.free && book.got, 'the book: skipped, bought');
      assert(way === 'sit' && still && !me.inside && lived < 25, 'the coffee: lived, ended by moving');
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
        for (let t = 0; t < 20 * 15; t++) step(g, {}, null);              // (a while in there, lived: the browse itself is skipped)
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
      step(g, { act: ['use'] }, null);
      for (let t = 0; t < 20 * (WASH_S + 5) && me.inside; t++) step(g, {}, null);
      console.log(`      two minutes walking bloody at lunchtime: heat ${heat0} → ${heat1}; the instinct: "${line}"; to a watcher: ${mod}; at ${u.shop}'s basin ${there}: "${offer}"; after it: ${p.bloody ? JSON.stringify(p.bloody) : 'clean'}`);
      assert(heat1 > heat0 && /face/.test(line) && there && /basin/.test(offer) && !p.bloody?.face, 'noticed, said, washed');
    },
  },
  {
    name: 'money: a coat chosen off the rail (paid for, worn out of the door, the scene hears; the old one in the shop\'s bag), a taxi\'s fare; short of cash, nothing doing',
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
        const cash0 = cashOf(p), coat0 = p.look.top.color, asked = [], bus = { emit: (k, v) => { if (k === 'shop') asked.push(v); }, on() {} };
        step(g, { act: ['shop:rail:top'] }, bus);                       // (the rail: which coat, asked)
        const pick = asked[0]?.ways.find(w => w.id.startsWith('piece:coat')), piece = RAIL.clothes.find(x => `piece:${x.id}` === pick?.id);
        step(g, { act: [`shop:${pick.id}`] }, null);                   // (as the UI sends it back: src/main.js)
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
        assert(cash1 === cash0 - piece.usd && coat1 === piece.look.color && coat1 !== coat0 && p.bag?.length === 1 && heard.join() === 'in:front,out:coat', 'the coat chosen off the rail, paid for, worn out of the door, the old one in the bag');
        assert(cash2 < cash1 && row === 2 && g.map.row === 2, 'the fare taken; short, no ride');
      } finally { delete SCENARIOS.walk.onShop; }
    },
  },
  {
    name: 'money: the account opens with the first month\'s pay; a bank draws from it and takes cash in; a gym\'s month paid, its sessions free till then',
    fn() {
      const c = newCampaign(43, candidates(43, 'london', 'junior')[0], 'london', 'junior');
      c.calls = [];
      const s = newGame({ seed: 43, scenario: 'campaign', campaign: c }), bus = createBus(), acct = c.posting.money, p = () => s.people.me;
      start(s, bus);
      const opened = acct.bank;
      step(s, { act: ['desk:travel:embassy'] }, bus);
      for (let t = 0; t < 10; t++) step(s, {}, bus);
      // (a bank, and a gym, on one of the streets about)
      const find = (kind) => { for (const row of [0, 1, -1, 2, -2, 3, -3]) { if (row !== s.map.row) loadRow(s, bus, row, 0, { quiet: true }); const u = atDoor(s, (o) => o.shop === kind); if (u) return u; } return null; };
      const b = find('bank');
      walkIn(s, b);
      const k = spotOf(b, 'counter');
      walk(s, k.x, k.z, bus);
      const cash0 = cashOf(p());
      step(s, { act: ['shop:withdraw:500'] }, bus);
      const drawn = { cash: cashOf(p()) - cash0, bank: opened - acct.bank };
      step(s, { act: [`shop:deposit:${Math.floor(cashOf(p()) - KEEP_USD)}`] }, bus);
      const paidIn = cashOf(p());
      walk(s, b.door, Z.front + 0.8, bus);
      const g = find('gym');
      walkIn(s, g);
      const gk = spotOf(g, 'counter');
      walk(s, gk.x, gk.z, bus);
      const before = cashOf(p());
      step(s, { act: ['shop:join'] }, bus);
      const joined = before - cashOf(p());
      const fit0 = p().training?.fitness ?? 0, sk0 = JSON.stringify(p().skills.fitness);
      step(s, { act: ['shop:train'] }, bus);
      const session = before - joined - cashOf(p());
      console.log(`      the account opened with ${price(s, opened)}; drawn ${price(s, drawn.cash)} (the account down ${price(s, drawn.bank)}); paid in, ${price(s, paidIn)} kept on you; the gym's month ${price(s, joined)}, a session after it ${session ? price(s, session) : 'nothing'} (fitness ${sk0} → ${JSON.stringify(p().skills.fitness)})`);
      assert(opened === acct.salary && drawn.cash === 500 && drawn.bank === 500, 'the first month in the account; drawn from it');
      assert(Math.abs(paidIn - KEEP_USD) < 1, 'paid in, but what\'s kept back');
      assert(joined === CLUB_MONTH_USD.gym && session === 0, 'a month paid; a session free');
    },
  },
];
