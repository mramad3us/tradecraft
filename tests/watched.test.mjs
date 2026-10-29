// Watched in your own hours (sim/campaign.js watched(), sim/scenarios/campaign.js outing()): out of the
// flat's door, the hour's dice by the heat and the city put being tailed's team on you or not; the
// flat's window shows them waiting; on the street they follow and write down what you do (heat at
// once); a trip from the desk keeps them or loses them by its way; lying low at a safe house with them
// on you burns it by the next morning's cable; an asset meeting begun with them on you has them.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { candidates, newCampaign, watched, watchedOdds, covertShare, context, places, trip } from '../src/sim/campaign.js';
import { HOUR } from '../src/sim/clock.js';
import { heatKey } from '../src/sim/heat.js';
import { planOf } from '../src/sim/map/interior.js';
import { FLAG_HEAT } from '../src/sim/scenarios/sdr.js';
import { assert, fmt } from './helpers.mjs';

const busOf = () => { const papers = []; return { papers, emit: (k, v) => { if (k === 'papers') papers.push(...v); }, on() {} }; };
const heatOf = (g) => g.heat[heatKey('embassy', g.campaign.posting.country)];

/** A posting's hub in the flat, its heat set, the clock on to the first hour the flat's door has `want` at it (null: none such). */
function inFlat(seed, city, heat, want) {
  const c = newCampaign(seed, candidates(seed, city)[0], city);
  c.posting.heat = heat;
  const g = newGame({ seed, scenario: 'campaign', campaign: c }), bus = busOf();
  start(g, null);
  step(g, {}, bus);
  let h = 0;
  while (h < 48 && watched(c, 'home', g.time.ms + h * HOUR, heat) !== want) h++;
  if (h === 48) return null;
  g.time.ms += h * HOUR;
  c.awake = g.time.ms;                                              // (rested: no tiredness in it)
  for (const k of c.calls ?? []) k.done = g.time.ms;                // (Hale's call on day one: had)
  return { c, g, bus };
}
/** Out of the flat's door, onto the street. */
function out(g, bus) {
  const me = playerActor(g), e = planOf(g.map).exits[0];
  Object.assign(me, { x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2 });
  for (let k = 0; k < 25 && g.map.kind !== 'street'; k++) step(g, {}, bus);
  assert(g.map.kind === 'street', 'out on the street');
}
const onYou = (g) => { const t = g.scenario.tail; return t && !t.teamLost ? t.crew.filter(x => x.id && g.actors.some(a => a.id === x.id)).length + t.pending.length : 0; };

export default [
  {
    name: 'watched: the odds of a team on you out of a door, by the heat and the city (an overt pair, a covert team as it climbs)',
    fn() {
      const rows = [];
      for (const city of ['moscow', 'cairo', 'beirut', 'london']) {
        const c = newCampaign(3, candidates(3, city)[0], city), seen = {};
        for (const heat of [20, 30, 45, 60, 80]) {
          const n = { none: 0, overt: 0, covert: 0 };
          for (let h = 0; h < 2000; h++) n[watched(c, 'home', c.posting.startMs + h * HOUR, heat)]++;
          seen[heat] = n;
          const on = (n.overt + n.covert) / 2000;
          assert(Math.abs(on - watchedOdds(heat, city)) < 0.04, `the dice keep the odds (${city} ${heat}: ${fmt(on, 2)} v ${fmt(watchedOdds(heat, city), 2)})`);
          if (n.overt + n.covert > 50) assert(Math.abs(n.covert / (n.overt + n.covert) - covertShare(heat)) < 0.08, 'and the covert share');
        }
        rows.push(`${city}: ${[20, 30, 45, 60, 80].map(h => `${h} ${fmt(100 * (seen[h].overt + seen[h].covert) / 2000, 0)}%${seen[h].covert ? ` (${fmt(100 * seen[h].covert / (seen[h].overt + seen[h].covert), 0)}% covert)` : ''}`).join(', ')}`);
      }
      console.log(`      on you out of a door, by the heat: ${rows.join('; ')}`);
      assert(watchedOdds(20, 'moscow') > 0.1 && watchedOdds(20, 'moscow') < 0.25, 'a handler in Moscow starts with some surveillance');
      assert(watchedOdds(20, 'london') < 0.06, 'a junior in London very little');
      assert(covertShare(20) === 0 && covertShare(60) > 0.5, 'an overt pair at first, a covert team as it climbs');
    },
  },
  {
    name: 'watched: from the window, the pair by the kerb below; out of the door, the same faces on you, following; running in front of them is written down, heat at once',
    fn() {
      const { c, g, bus } = inFlat(5, 'moscow', 50, 'overt');
      // (the window: by the kerb below, standing, the two of them)
      const me = playerActor(g), w = planOf(g.map).spots.find(s => s.kind === 'window');
      Object.assign(me, { x: w.x, z: w.z });
      for (let k = 0; k < 21; k++) step(g, {}, bus);
      step(g, { act: ['instinct'] }, bus);
      assert(g.scenario.window, 'at the window');
      const posts = g.actors.filter(a => a.ai?.kind === 'post');
      const faces = posts.map(a => JSON.stringify(g.people[a.who].look));
      console.log(`      from the window: ${posts.length} by the kerb below (${posts.map(a => `${g.people[a.who].name} at ${fmt(a.x - (c.posting.home.x ?? 12), 1)} m from the door`).join('; ')})`);
      assert(posts.length === 2 && posts.every(a => a.z > -1.5 && a.z < -0.5), 'the overt pair, by the kerb below');
      for (let k = 0; k < 21; k++) step(g, {}, bus);
      step(g, { act: ['instinct'] }, bus);                          // (back into the room)
      assert(g.map.kind === 'interior' && !g.scenario.window, 'back in the flat');
      out(g, bus);
      const t = g.scenario.tail;
      assert(t?.team === 'overt' && !t.teamLost, 'an overt pair on you');
      assert(t.crew.every(x => faces.includes(JSON.stringify(g.people[x.who].look))), 'the same faces as from the window');
      // (along the street a minute: they keep with you)
      let far = 0;
      for (let k = 0; k < 60 * 20; k++) {
        step(g, { mx: 1, slow: false }, bus);
        if (k % 20 === 0) far = Math.max(far, ...t.crew.map(x => { const a = g.actors.find(o => o.id === x.id); return a ? Math.hypot(a.x - me.x, a.z - me.z) : 0; }));
      }
      const kept = onYou(g);
      // (then ten seconds' running, in front of them)
      const heat0 = heatOf(g);
      for (let k = 0; k < 10 * 20; k++) step(g, { mx: 1, run: true }, bus);
      for (let k = 0; k < 40; k++) step(g, { mx: 1 }, bus);
      const ran = t.flags.filter(f => f.kind === 'ran').length;
      console.log(`      out of the door: ${t.crew.length} on you; a minute's walk later ${kept} with you (furthest ${fmt(far, 0)} m back); ten seconds' run: ${ran} note${ran === 1 ? '' : 's'} of it, heat ${heat0} → ${heatOf(g)}`);
      assert(kept === 2 && far < 40, 'they keep with you on foot');
      assert(ran >= 1, 'the run written down');
      assert(heatOf(g) >= heat0 + FLAG_HEAT * ran, 'heat for it, at once');
    },
  },
  {
    name: 'watched: a trip from the desk with them on you keeps them or loses them by its way; a safe house they see you lie low in is blown by morning',
    heavy: true,
    fn() {
      const by = {}, sh = { seen: 0, burned: 0, clean: 0, cleanBurned: 0 };
      for (let seed = 1; seed <= 40; seed++) {
        const s = inFlat(seed, 'moscow', 55, seed % 2 ? 'overt' : 'covert');
        if (!s) continue;
        const { c, g, bus } = s;
        out(g, bus);
        for (let k = 0; k < 10 * 20; k++) step(g, { mx: 1 }, bus);     // (ten seconds along, them behind)
        const house = c.posting.safehouses[0], from = g.map.row ?? 0, way = trip(from, house.row).by;
        step(g, { act: [`desk:travel:${house.id}`] }, bus);
        for (let k = 0; k < 20 * 20; k++) step(g, {}, bus);            // (at its door twenty seconds: up the steps, out of the car)
        const kept = onYou(g) > 0, team = g.scenario.tail?.team;
        const b = by[`${way} ${team === 'none' ? (seed % 2 ? 'overt' : 'covert') : team}`] ??= [0, 0];
        b[0]++; if (kept) b[1]++;
        step(g, { act: ['desk:low'] }, bus);
        const blown = bus.papers.some(p => p.title === 'CABLE: A SAFE HOUSE') && !!house.burned && !places(c).some(p => p.id === house.id);
        if (kept) { sh.seen++; if (blown) sh.burned++; } else { sh.clean++; if (blown) sh.cleanBurned++; }
      }
      console.log(`      a trip with them on you, kept: ${Object.entries(by).map(([k, [n, kept]]) => `${k} ${kept} of ${n}`).join(', ')}; lying low at the safe house: with them on you ${sh.burned} of ${sh.seen} blown, without ${sh.cleanBurned} of ${sh.clean}`);
      assert(sh.seen >= 3 && sh.burned === sh.seen, 'seen going in: blown, every time');
      assert(sh.clean >= 3 && sh.cleanBurned === 0, 'lost on the way: safe');
    },
  },
  {
    name: 'watched: an asset meeting begun with them on you has them for its team; otherwise the heat\'s dice',
    fn() {
      const c = newCampaign(6, candidates(6, 'moscow')[0], 'moscow');
      const a = c.assignments.find(x => x.kind === 'sdr');
      assert(a, 'an asset meeting');
      const rolled = context(c, a).team;
      a.tailedBy = 'covert';
      assert(context(c, a).team === 'covert', 'theirs, still on you');
      a.tailedBy = null;
      assert(context(c, a).team === rolled, 'else the dice, as before');
      console.log(`      the dice said ${rolled}; begun with a covert team on you: covert`);
    },
  },
];
