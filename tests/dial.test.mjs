// The phone's services and the agency's support (sim/dial.js, sim/support.js, sim/disguise.js; the user, 2026-11-04): the
// support by the posting's kind, spent and back a day; heat never back to nothing; your own phone a watched line; food to the
// flat; a taxi rung for, at your kerb, and where the line's read a team at the other end; the agency's clean gun and a
// disguise kit at a dead drop; a disguise against the hunt's look; a clandestine clinic in a safe house; a clean-up crew; an
// extraction; a safe house's days.
import { newGame, start, step, playerActor, newMap } from '../src/sim/game.js';
import { candidates, newCampaign, pass } from '../src/sim/campaign.js';
import { supportOf, SUPPORT, kindOf } from '../src/sim/support.js';
import { services, ring, dropAt, collect, watchedLine, second as dialSecond, COST, FOOD_USD, TAXI_HEAT, OWN_HEAT } from '../src/sim/dial.js';
import { wear, remove, quality, EQUIPMENT } from '../src/sim/disguise.js';
import { start as startHunt, mods, whoOf, badges } from '../src/sim/hunt.js';
import { heat } from '../src/sim/heat.js';
import { cashOf } from '../src/sim/money.js';
import { isGun } from '../src/sim/firearms.js';
import { kill } from '../src/sim/health.js';
import { person } from '../src/sim/interact.js';
import { DAY, HOUR, MIN } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

// (the campaign's hub in a city, its officer with cash and a burner, on the street outside the embassy)
function hub(city = 'moscow', seed = 4) {
  const level = city === 'london' ? 'junior' : 'handler', c = newCampaign(seed, candidates(seed, city, level)[0], city, level);
  const g = newGame({ seed, scenario: 'campaign', campaign: c }), log = [], papers = [];
  const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); if (k === 'papers') papers.push(...v); }, on() {} };
  start(g, bus);
  newMap(g, bus, { kind: 'street', seed: c.posting.mapSeed, row: 0, i0: null, i1: null, crowd: 1, city: c.posting.city }, 12);   // (out on the street by the embassy, as the hub's goTo() puts you)
  for (let t = 0; t < 20; t++) step(g, {}, bus);
  const p = g.people[g.player];
  Object.assign(p, { cash: 5000, burners: 2 });
  return { g, c, p, bus, log, papers, me: playerActor(g) };
}
const seconds = (w, n) => { for (let t = 0; t < 20 * n; t++) step(w.g, {}, w.bus); };

export default [
  {
    name: 'dial: the agency\'s support by the posting: London\'s first tour 100, back 50 a day; a handler under official cover 80, back 10; spent, and back a day at a time',
    fn() {
      const L = hub('london'), M = hub('moscow');
      const a = supportOf(L.c), b = supportOf(M.c);
      M.c.posting.support.now = 0;
      pass(M.c, M.g.time.ms, M.g.time.ms + 3 * DAY);
      const after = supportOf(M.c).now;
      console.log(`      London's first tour: ${a.now} of ${a.max}, +${a.perDay} a day; Moscow, official cover: ${b.now} of ${b.max}, +${b.perDay}; spent to 0, three days on: ${after}; undercover ${SUPPORT.undercover.max}, illegal ${SUPPORT.illegal.max} (to come)`);
      assert(a.kind === 'firstTour' && a.now === 100 && a.perDay === 50 && b.kind === 'official' && b.now === 80 && b.perDay === 10 && after === 30, JSON.stringify({ a, b, after }));
    },
  },
  {
    name: 'dial: heat never back to nothing: official cover\'s floor, and an unofficial cover\'s 1 once it\'s risen; your own phone a watched line at 1 and over',
    fn() {
      const M = hub('moscow');
      pass(M.c, M.g.time.ms, M.g.time.ms + 60 * DAY);
      const official = M.c.posting.heat;
      const U = hub('moscow', 5);
      Object.assign(U.c.posting, { legend: 'undercover', heat: 0 });
      const clean = watchedLine(U.c);
      U.c.posting.heat = 6; pass(U.c, U.g.time.ms, U.g.time.ms + 60 * DAY);
      console.log(`      official cover, sixty quiet days: heat ${official}, a watched line ${watchedLine(M.c)}; an unofficial cover clean: watched ${clean}; risen to 6, sixty quiet days on: ${U.c.posting.heat}, watched ${watchedLine(U.c)}`);
      assert(official >= 1 && watchedLine(M.c) && !clean && U.c.posting.heat === 1 && watchedLine(U.c) && kindOf(U.c.posting) === 'undercover', 'the floors');
    },
  },
  {
    name: 'dial: a taxi rung for comes to your kerb, stopped for you; on your own phone in Moscow, heat and a team at the other end half the time; in London, nothing',
    fn() {
      const out = {};
      for (const city of ['moscow', 'london']) {
        const w = hub(city), h0 = heat(w.g);
        const r = ring(w.g, w.bus, 'taxi', 'own');
        w.c.rung.taxi.at = w.g.time.ms;                              // (now, for the test)
        let cab = null;
        for (let s = 0; s < 60 && !cab; s++) { seconds(w, 1); cab = w.g.traffic?.cars?.find(c => c.taxi?.rung); }
        out[city] = { ok: r.ok, heat: heat(w.g) - h0, cab: !!cab, mine: cab?.taxi?.hail?.by === w.me.id, tracked: !!w.g.$tracked };
      }
      console.log(`      Moscow, your own phone: heat +${out.moscow.heat}, the cab at your kerb ${out.moscow.cab} (hailed for you ${out.moscow.mine}), the line read ${out.moscow.tracked}; London: heat +${out.london.heat}, read ${out.london.tracked}`);
      assert(out.moscow.ok && out.moscow.cab && out.moscow.mine && out.moscow.heat >= TAXI_HEAT && out.moscow.tracked && !out.london.tracked && out.london.heat === 0, JSON.stringify(out));
    },
  },
  {
    name: 'dial: food to the flat, any phone, no heat; the agency\'s clean gun and a disguise kit at a dead drop, the support spent, a burner\'s nothing to trace and your own phone\'s heat',
    fn() {
      const w = hub('moscow'), S0 = supportOf(w.c).now, h0 = heat(w.g);
      w.g.map.place = 'home';                                         // (at the flat, as far as the services go)
      const food = ring(w.g, w.bus, 'food', 'home'), cash = cashOf(w.p);
      delete w.g.map.place;
      const gun = ring(w.g, w.bus, 'gun', 'burner'), kit = ring(w.g, w.bus, 'kit:disguise', 'own');
      const hAfter = heat(w.g) - h0, S1 = supportOf(w.c).now;
      // (to the drops, when they're ready: the bag, and the kit)
      for (const d of [...w.c.rung.drops]) { w.g.time.ms = d.from + 1; newMap(w.g, w.bus, { kind: 'street', seed: w.c.posting.mapSeed, row: d.at.row, i0: null, i1: null, crowd: 1, city: w.c.posting.city }, d.at.x); w.me = playerActor(w.g); Object.assign(w.me, { x: d.at.x, z: d.at.z }); const at = dropAt(w.g, w.me); assert(at === d, 'at the bench'); collect(w.g, w.bus, d); }
      const clean = (w.p.bag ?? []).map(x => x.item).find(isGun);
      console.log(`      food: ${food.text}; ${fmt(5000 - cash, 0)} spent of the cash (${FOOD_USD} dollars)\n      the gun (a burner) and the kit (your own phone): support ${S0} → ${S1}, heat +${hAfter} (own phone's ${OWN_HEAT}); collected: ${clean} (no history: ${!!w.p.arms[clean]?.clean}), the kit ${w.p.equip?.disguise} uses`);
      assert(food.ok && gun.ok && kit.ok && S1 === S0 - COST.gun - EQUIPMENT.disguise.as && hAfter === OWN_HEAT && clean && w.p.arms[clean].clean && w.p.equip.disguise === EQUIPMENT.disguise.uses, 'rung, spent, collected');
    },
  },
  {
    name: 'dial: a disguise from the kit: what a witness says of you is someone else\'s, the hunt\'s face icon green, a disguise\'s worth on your side of an officer\'s look; off, you again',
    fn() {
      const w = hub('moscow'), p = w.p;
      p.equip = { disguise: 5 };
      startHunt(w.g, null, { why: 'shots', x: w.me.x, who: true, wearing: true, sure: true });
      const before = whoOf(p), icon0 = badges(w.g)[0].state, m0 = mods(w.g, w.g.hunt, p, w.me).map(m => `${m.why} ${m.v}`);
      const line = wear(p), q = quality(p), icon1 = badges(w.g)[0].state, m1 = mods(w.g, w.g.hunt, p, w.me).map(m => `${m.why} ${m.v}`);
      const changed = whoOf(p) !== before;
      remove(p);
      const back = whoOf(p) === before, icon2 = badges(w.g)[0].state;
      console.log(`      ${line}\n      quality ${fmt(q, 2)}; the face: ${icon0} → ${icon1} → ${icon2}; the look's mods: [${m0.slice(0, 2).join(', ')}] → [${m1.slice(0, 3).join(', ')}]`);
      assert(changed && back && icon0 === 'burned' && icon1 === 'clear' && icon2 === 'burned' && m1.some(m => /disguise/.test(m)) && p.equip.disguise === 4, 'on, and off');
    },
  },
  {
    name: 'dial: a clandestine clinic in a safe house: there in a few hours, seen to with no name taken and nothing reported; a clean-up crew takes the dead nobody\'s called in; extraction, hunted, to the embassy',
    fn() {
      const w = hub('moscow'), c = w.c, h0 = heat(w.g);
      const clinic = ring(w.g, w.bus, 'clinic', 'burner');
      assert(clinic.ok && c.rung.clinic, clinic.text);
      // (the clean-up: a passer-by dead at your feet, nobody's called it in)
      const v = w.g.actors.find(a => a !== w.me && a.ai?.civ && !a.hidden && (a.row ?? w.g.map.row) === w.g.map.row);
      Object.assign(v, { x: w.me.x + 3, z: w.me.z });
      kill(person(w.g, v), w.g.time.ms, 'shot');
      c.posting.support.now = 80;                                      // (the clinic's spent 40 of it: back up, for the test)
      const okClean = services(w.g).find(s => s.key === 'cleanup')?.ok;
      const cl = ring(w.g, w.bus, 'cleanup', 'burner'); c.rung.cleanup.at = w.g.time.ms;
      seconds(w, 2);
      const goneBody = !w.g.actors.includes(v);
      // (extraction: hunted, the support there (refilled for the test), the car, and in)
      c.posting.support.now = 80;
      startHunt(w.g, null, { why: 'killed', x: w.me.x, who: true, wearing: true, sure: true });
      const ex = ring(w.g, w.bus, 'extract', 'own'), E = c.rung.extract;
      newMap(w.g, w.bus, { kind: 'street', seed: c.posting.mapSeed, row: E.row, i0: null, i1: null, crowd: 1, city: c.posting.city }, E.x); w.me = playerActor(w.g); Object.assign(w.me, { x: E.x, z: -2.6, row: E.row });
      dialSecond(w.g, w.bus, w.me, { extracted: () => { w.done = true; } });
      seconds(w, 2);
      console.log(`      the clinic: ${clinic.text}\n      the clean-up offered ${okClean}: the body gone ${goneBody}; extraction: ${ex.text.split('.')[0]}; reached: ${!!w.done || !w.g.hunt}`);
      assert(okClean && cl.ok && goneBody && ex.ok && E && w.done, 'the clinic, the clean-up, the extraction');
    },
  },
];
