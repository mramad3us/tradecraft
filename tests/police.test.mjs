// Ordinary law (sim/police.js): patrols by city; what draws them (what shows, the city's habit, heat); a
// stop: a diplomat's passport handed back and your name written down; questions by Deception; walking
// away; searched, what shows found and pockets by their eyes against yours; a weapon taken, reported.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { patrolTick, stopChance, answer, PATROL_P } from '../src/sim/police.js';
import { createBus } from '../src/sim/bus.js';
import { heat } from '../src/sim/heat.js';
import { stream, chance } from '../src/sim/rng.js';
import { HOUR } from '../src/sim/clock.js';
import { assert } from './helpers.mjs';

const walk = (city = 'moscow', seed = 3) => { const g = newGame({ seed, city, weather: 'clear' }), bus = createBus(), said = []; bus.on('police', (o) => said.push(o)); start(g, bus); return { g, bus, said, me: playerActor(g), p: g.people[g.player] }; };
// (a patrol now, by hand: the hour's dice aside; and the stop, the pair at your elbow)
function stopped(g, bus) {
  g.flags.patrol = null;
  for (let h = 0; h < 48 && !g.actors.some(a => a.cop); h++) { g.time.ms += HOUR; patrolTick(g); }
  const cops = g.actors.filter(a => a.cop), me = playerActor(g);
  Object.assign(me, { x: cops[0].x - 1, z: cops[0].z });             // (you, at their elbow: an agent's place is its route's)
  g.$stop = { lead: cops[0].id };
  for (let t = 0; t < 40 && !g.$stop.asked; t++) step(g, {}, bus);
  return cops;
}

export default [
  {
    name: 'police: patrols by city (Moscow\'s everywhere, London\'s seldom); what draws them: what shows, the city\'s habit, your heat',
    fn() {
      const share = (city) => { let n = 0; for (let row = -6; row <= 6; row++) for (let h = 0; h < 40; h++) n += chance(stream('patrol', 5, row, 400000 + h), PATROL_P[city]); return n / (13 * 40); };
      const { g, p } = walk('moscow');
      const clean = stopChance(g);
      p.bloody = { face: g.time.ms }; const face = stopChance(g);
      p.hand = 'kitchen'; const both = stopChance(g);
      delete p.bloody; delete p.hand;
      g.heat[Object.keys(g.heat)[0]] = 70; const hot = stopChance(g);
      const L = walk('london'), lclean = stopChance(L.g);
      console.log(`      a patrol on a street in an hour: Moscow ${Math.round(share('moscow') * 100)}%, Cairo ${Math.round(share('cairo') * 100)}%, London ${Math.round(share('london') * 100)}%; the chance a patrol that sees you stops you (Moscow): clean ${Math.round(clean * 100)}%, blood on your face ${Math.round(face * 100)}%, and a knife in hand ${Math.round(both * 100)}%, clean at heat 70 ${Math.round(hot * 100)}%; London, clean ${(lclean * 100).toFixed(1)}%`);
      assert(share('moscow') > share('london') * 2 && clean < face && face < both && hot > clean && lclean < clean, 'by city; what shows; heat');
    },
  },
  {
    name: 'police: stopped, a diplomat\'s passport handed back (your name written down); walking away the embassy hears of; questions by Deception; a knife in your pocket found or not, taken and reported',
    fn() {
      const a = walk('moscow', 4);
      stopped(a.g, a.bus);
      const asked = a.said.length, h0 = heat(a.g);
      answer(a.g, a.bus, 'papers');
      const papers = heat(a.g) - h0, last = a.g.log.at(-1).text;
      const b = walk('moscow', 5); stopped(b.g, b.bus); const hb = heat(b.g);
      answer(b.g, b.bus, 'walk');
      const walked = heat(b.g) - hb;
      // (questions, by Deception; a kitchen knife at the belt under a coat, found or not)
      const rows = [];
      for (const dec of [3, 12, 24]) {
        let ok = 0, found = 0, n = 40;
        for (let k = 0; k < n; k++) {
          const c = walk('moscow', 100 + k); c.p.skills.deception = [dec, 0]; c.p.items = ['kitchen'];
          stopped(c.g, c.bus); answer(c.g, c.bus, 'talk');
          const r = c.g.log.filter(l => l.roll).at(-1)?.roll;
          ok += !!r?.ok; found += !c.p.items?.includes('kitchen');
        }
        rows.push(`Deception ${dec}: talked out ${Math.round(100 * ok / n)}%, the knife found ${Math.round(100 * found / n)}%`);
      }
      console.log(`      asked: ${asked}; papers: +${papers} heat ("${last}"); walked away: +${walked} heat; ${rows.join('; ')}`);
      assert(asked >= 1 && papers === 2 && walked === 4, 'papers: +2; walking away: +4');
      const pct = rows.map(r => [...r.matchAll(/(\d+)%/g)].map(m => Number(m[1])));
      assert(pct[2][0] > pct[0][0] && pct[2][1] < pct[0][1], 'the better liar talks out more, and loses the knife less');
    },
  },
];
