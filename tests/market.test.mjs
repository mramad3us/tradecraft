// The black market (sim/market.js): a seller found at a bar by Social, harder where guns are rare; an order by phone,
// its two dead drops; the envelope left, the goods collected into the bag; a scam, a sting; an envelope never left;
// and the police's own heat (sim/police.js policeHeat()): up for a sting, doubling a patrol's odds at 40.
import { newGame, start } from '../src/sim/game.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { ask, order, atDrop, lapse, stock, ASK_DC, SCAM, STING, sellerOf, PAY_H } from '../src/sim/market.js';
import { stopChance, policeHeat, policeHeatOf, POLICE_STOP_K } from '../src/sim/police.js';
import { cashOf } from '../src/sim/money.js';
import { HOUR } from '../src/sim/clock.js';
import { createBus } from '../src/sim/bus.js';
import { assert } from './helpers.mjs';

// (the campaign's hub in a city, its officer with cash and a burner)
function hub(city, seed = 4) {
  const level = city === 'london' ? 'junior' : 'handler', c = newCampaign(seed, candidates(seed, city, level)[0], city, level);
  const g = newGame({ seed, scenario: 'campaign', campaign: c }), bus = createBus(), said = [];
  bus.on('log', (e) => said.push(e.text ?? ''));
  start(g, bus);
  const p = g.people[g.player];
  Object.assign(p, { cash: 5000, burners: 2 });
  return { g, c, p, bus, said };
}

export default [
  {
    name: 'market: by city, how hard a seller is to find, what goes wrong, what he has and what it costs (Beirut easy and cheap, London hard and dear)',
    fn() {
      const out = [];
      for (const city of ['beirut', 'cairo', 'moscow', 'london']) {
        const { c } = hub(city), s = stock(c);
        out.push(`${city}: DC ${ASK_DC(city)}, a scam ${Math.round(SCAM(city) * 100)}%, a sting ${Math.round(STING(city) * 100)}%; ${s.map(x => `${x.model} $${x.usd}`).join(', ')}`);
        assert(s.length > 0 && s.every(x => x.usd >= 50), `${city}: stock`);
      }
      assert(ASK_DC('beirut') < ASK_DC('moscow') && ASK_DC('moscow') < ASK_DC('london') && STING('london') > STING('beirut'), 'harder where guns are rare');
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'market: Beirut, a seller found at the bar, an order from a burner, the envelope left, the pistol collected the day after, into the bag; in London, a sting: taken in, cover and the police\'s file',
    fn() {
      const { g, c, p, bus } = hub('beirut');
      p.skills.social = [20, 2];
      const line = ask(g, bus, p), seller = sellerOf(c);
      assert(seller && /beer mat/.test(line), `the bar: ${line}`);
      const r = order(g, bus, 'canik', 'burner'), o = c.order;
      assert(r.ok && o && p.burners === 1 && o.pay.label && o.get.label, `the order: ${r.text}`);
      Object.assign(o, { scam: false, sting: false });
      const cash = cashOf(p), paid = atDrop(g, bus, p, 'pay');
      assert(cashOf(p) === cash - o.usd && o.paid, `the envelope: ${paid}`);
      const early = atDrop(g, bus, p, 'get');
      g.time.ms = o.get.from + HOUR;
      const got = atDrop(g, bus, p, 'get'), gun = p.bag?.find(x => x.item && p.arms?.[x.item]?.type === 'gun')?.item;
      assert(/Nothing behind it yet/.test(early) && gun && p.arms[gun].model === 'canik' && o.done === 'got', `the bench a day on: ${got}`);
      // (London: a sting)
      const L = hub('london');
      L.p.skills.social = [24, 2];
      ask(L.g, L.bus, L.p);
      order(L.g, L.bus, L.c.posting && stock(L.c)[0].model, 'burner');
      Object.assign(L.c.order, { scam: false, sting: true });
      atDrop(L.g, L.bus, L.p, 'pay');
      L.g.time.ms = L.c.order.get.from + HOUR;
      const cover = L.c.posting.cover, police = policeHeatOf(L.g), sting = atDrop(L.g, L.bus, L.p, 'get');
      assert(/police, plain clothes/.test(sting) && L.c.posting.cover < cover && policeHeatOf(L.g) >= police + 50 && !L.p.bag?.some(x => x.item && L.p.arms?.[x.item]?.type === 'gun'), `the sting: cover ${cover} → ${L.c.posting.cover}, the police ${police} → ${policeHeatOf(L.g)}`);
      console.log(`      Beirut: ${o.name} for $${o.usd}, paid at ${o.pay.label}, collected at ${o.get.label}; London's sting: cover ${cover} → ${L.c.posting.cover}, the police's file ${police} → ${policeHeatOf(L.g)}`);
    },
  },
  {
    name: 'market: an envelope never left by the night after, the deal\'s off and his number with it; the police\'s heat makes a patrol likelier to stop you (twice at 40)',
    fn() {
      const { g, c, p, bus } = hub('cairo');
      p.skills.social = [24, 2];
      ask(g, bus, p);
      order(g, bus, stock(c)[0].model, 'own');
      g.time.ms += (PAY_H + 1) * HOUR;
      lapse(g, bus);
      assert(c.order.done === 'lapsed' && !sellerOf(c), `unpaid: ${c.order.done}, the seller ${!!sellerOf(c)}`);
      const w = newGame({ seed: 3, city: 'moscow', weather: 'clear' });
      start(w, null);
      w.campaign = { posting: { police: 0 } };
      const base = stopChance(w); policeHeat(w, 40); const hot = stopChance(w);
      assert(Math.abs(hot / base - (1 + 40 / POLICE_STOP_K)) < 0.01, `a patrol's odds: ${base.toFixed(3)} → ${hot.toFixed(3)} at 40`);
      console.log(`      Cairo, never paid: ${c.order.done}; a patrol's odds of stopping you ${base.toFixed(3)}, at the police's 40: ${hot.toFixed(3)}`);
    },
  },
];
