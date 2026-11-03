// What you wear and what you own (sim/clothes.js): a coat chosen off a clothes shop's rail and worn out of
// it, the old one in the shop's bag; an umbrella bought, in the hand; home, the bag unpacked into the
// wardrobe; at the wardrobe, the old coat back on, the new one on its hanger; the umbrella left in the
// drawer, and taken again; glasses at an optician's.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { doorWays, goOut, carry, unpack } from '../src/sim/clothes.js';
import { RAIL, wardrobeWays } from '../src/sim/clothes.js';
import { atDoor, walkIn, walk, spotOf } from './shopwalk.mjs';
import { createBus } from '../src/sim/bus.js';
import { Z } from '../src/sim/map/street.js';
import { assert } from './helpers.mjs';

export default [
  {
    name: 'clothes: a coat off the rail worn out, the old one in the bag; an umbrella in the hand; home, the bag unpacked; the wardrobe: the old coat back on; in at the door, the coat on its hook and the umbrella in the stand, and out with them',
    fn() {
      const c = newCampaign(41, candidates(41, 'london', 'junior')[0], 'london', 'junior');
      c.calls = [];
      const s = newGame({ seed: 41, scenario: 'campaign', campaign: c }), bus = createBus(), menus = [];
      bus.on('shop', (v) => menus.push(v.ways.map(w => w.id)));
      bus.on('wardrobe', (v) => menus.push(v.map(w => w.key)));
      start(s, bus);
      const p = s.people.me, me = () => playerActor(s);
      p.cash = 5000;
      const coat0 = structuredClone(p.look.top);
      step(s, { act: ['desk:travel:embassy'] }, bus);
      for (let t = 0; t < 10; t++) step(s, {}, bus);
      // (a clothes shop: its rail, a coat; an umbrella)
      const u = atDoor(s, (o) => o.shop === 'clothes');
      walkIn(s, u);
      const k = spotOf(u, 'counter');
      walk(s, k.x, k.z, bus);
      step(s, { act: ['shop:rail:top'] }, bus);
      const coat = menus.at(-1).find(id => id.startsWith('piece:coat') && RAIL.clothes.find(x => `piece:${x.id}` === id).look.color !== coat0.color);
      step(s, { act: [`shop:${coat}`] }, bus);
      step(s, { act: ['shop:buy:umbrella'] }, bus);
      const worn = p.look.top.color, bag = p.bag?.map(x => x.name), hand = p.hand;
      // (home: up from the door, the bag unpacked)
      walk(s, u.door, Z.front + 0.8, bus);
      step(s, { act: ['desk:travel:home'] }, bus);
      for (let t = 0; t < 30; t++) step(s, {}, bus);
      step(s, { act: ['instinct'] }, bus);
      const home = s.map.place === 'home', owned = (p.wardrobe ?? []).map(x => x.name), unpacked = !p.bag;
      const hooked = p.hook?.name ?? null, stood = p.stand ?? 0;      // (in at the door: the coat on its hook, the umbrella in the stand: sim/clothes.js comeIn())
      // (the wardrobe: walked to, its ways)
      s.scenario.prompt = { act: 'dress' };
      step(s, { act: ['instinct'] }, bus);
      for (let t = 0; t < 1200 && !menus.at(-1)?.some(x => x.startsWith('wear:')); t++) step(s, {}, bus);
      const ways = wardrobeWays(p).map(w => w.key), back = ways.find(x => x.startsWith('wear:'));
      step(s, { act: [`desk:dress:${back}`] }, bus);
      const again = p.look.top.color, hung = (p.wardrobe ?? []).map(x => x.name);
      // (out by the door: the coat on its hook back on, the umbrella from the stand: sim/clothes.js doorWays(), goOut())
      const out = doorWays(p, true);
      goOut(p, out[0].key);
      console.log(`      bought: ${RAIL.clothes.find(x => `piece:${x.id}` === coat).id} worn (${coat0.color.toString(16)} → ${worn.toString(16)}), in the bag: ${bag}, in hand: ${hand}; home ${home}, unpacked ${unpacked}, the wardrobe: ${owned}; ways: ${ways.join(', ')}; the old coat back on (${again.toString(16)}), hung: ${hung}; the umbrella left ${hooked}/${stood}, taken: ${p.hand}`);
      assert(worn !== coat0.color && bag?.length === 1 && hand === 'umbrella', 'the coat worn out, the old one bagged, the umbrella in hand');
      assert(home && unpacked && owned.length === 1, 'home, the bag unpacked into the wardrobe');
      assert(again === coat0.color && hung.length === 1 && hung[0] !== owned[0], 'the old coat back on, the new one hung up');
      assert(hooked && stood === 1, `in: the coat on the hook (${hooked}), the umbrella in the stand (${stood})`);
      assert(p.hand === 'umbrella' && p.look.top.kind === 'coat' && !p.hook, `out: ${out[0].label}`);
    },
  },
  {
    name: 'clothes: an optician\'s glasses, put on there; the pair worn not offered again',
    fn() {
      const g = newGame({ seed: 8, scenario: 'walk', city: 'london' });
      start(g, null);
      const p = g.people[g.player], asked = [], bus = { emit: (k, v) => { if (k === 'shop') asked.push(v); }, on() {} };
      p.cash = 5000;
      delete p.look.glasses;
      const u = atDoor(g, (o) => o.shop === 'optician');
      if (!u) { console.log('      (no optician on this street)'); return; }
      walkIn(g, u);
      const k = spotOf(u, 'counter');
      walk(g, k.x, k.z);
      step(g, { act: ['shop:rail:glasses'] }, bus);
      step(g, { act: [`shop:${asked.at(-1).ways[0].id}`] }, bus);
      step(g, { act: ['shop:rail:glasses'] }, bus);
      console.log(`      at the optician's: ${p.look.glasses} on; offered again: ${asked.at(-1).ways.map(w => w.id).join(', ')}`);
      assert(p.look.glasses && !asked.at(-1).ways.some(w => w.id === `piece:${p.look.glasses}`), 'glasses on; the pair worn not offered again');
    },
  },
  {
    name: 'clothes: the flat\'s larder: six meals in, eaten down to nothing, then a grocer\'s week of them carried home and put away',
    fn() {
      const c = newCampaign(3, candidates(3)[0]), g = newGame({ seed: 3, scenario: 'campaign', campaign: c });
      start(g, null);
      const said = [], bus = { emit: (k, v) => { if (k === 'log') said.push(v.text ?? ''); }, on() {} };
      g.time.ms += 0;
      for (let k = 0; k < 7; k++) step(g, { act: ['desk:table:eat'] }, bus);   // (at the kitchen table, as if walked to it)
      const p = g.people.me, empty = c.larder?.meals;
      carry(p, 'groceries7');
      const bagged = p.bag?.find(x => x.groceries)?.groceries;
      unpack(p, c.cabinet ??= {}, c.larder);
      assert(empty === 0 && said.some(t => /mustard/.test(t)) && bagged === 7 && c.larder.meals === 7, `eaten to ${empty}, bagged ${bagged}, put away: ${c.larder.meals}`);
      console.log(`      six meals eaten, the seventh: "${said.find(t => /mustard/.test(t))}"; a week's groceries home: ${c.larder.meals} meals in`);
    },
  },
];
