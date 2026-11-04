// A community centre's clubs (sim/clubs.js): its week at the desk, the club meeting now open and the rest saying
// when; a session waited for and sat through, paid, its practice taking a level of rust off its skill, half a
// session on its other, its hours in the skill; a club that isn't meeting, not today.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { ways, RANGES } from '../src/sim/shops.js';
import { CLUBS, whenText } from '../src/sim/clubs.js';
import { at, calendar } from '../src/sim/clock.js';
import { cashOf } from '../src/sim/money.js';
import { atDoor, walkIn, walk, spotOf } from './shopwalk.mjs';
import { assert, fmt } from './helpers.mjs';

// (the nearest shop of a kind (a community centre, a range) on the player's street, walked into, the player at its desk; a few towns tried)
function atCentre(city, kind = 'culture') {
  for (let seed = 1; seed <= 12; seed++) {
    const g = newGame({ seed, scenario: 'walk', city, weather: 'clear' });
    start(g, null);
    const u = atDoor(g, (o) => o.shop === kind && !!spotOf(o, 'counter'));
    if (!u) continue;
    walkIn(g, u);
    const s = spotOf(u, 'counter');
    walk(g, s.x, s.z);
    return { g, d: { x: u.door, shop: u.shop }, seed };
  }
  return null;
}

export default [
  {
    name: 'clubs: Tuesday 18:40 at a centre, the amateur dramatics open (twenty minutes\' wait, two and a half hours), the radio club not today; sat through, a level of rust off Deception',
    fn() {
      const out = [];
      for (const city of [null, 'london', 'beirut', 'cairo']) {
        const c = atCentre(city);
        assert(c, `${city ?? 'moscow'}: a community centre within a dozen towns`);
        const { g, d } = c, me = playerActor(g), p = g.people[g.player], said = [];
        g.time.ms = at(2026, 1, 6, 18, 40);                            // (a Tuesday)
        assert(calendar(g.time.ms).weekday === 1, 'a Tuesday');
        const w = ways(g, d, 'counter'), drama = w.find(o => o.id === 'club:drama'), radio = w.find(o => o.id === 'club:radio');
        assert(drama && !drama.off && radio?.off && w.filter(o => o.id.startsWith('club:')).length === CLUBS.length, `the desk: ${w.map(o => `${o.id}${o.off ? ' (off)' : ''}`).join(', ')}`);
        p.cash = 2000; p.rust = { deception: 2 };
        const t0 = g.time.ms, cash0 = cashOf(p), dec0 = p.training?.deception ?? 0, sk0 = p.skills.deception?.[0] ?? 0;
        const bus = { emit: (k, v) => { if (k === 'log') said.push(v.text ?? ''); }, on() {} };
        step(g, { act: ['shop:club:drama'] }, bus);
        for (let t = 0; t < 20 * 200 && me.inside; t++) step(g, {}, bus);
        const mins = (g.time.ms - t0) / 60000, trained = (p.skills.deception?.[0] ?? 0) > sk0 || (p.training?.deception ?? 0) > dec0;
        assert(Math.abs(mins - 170) < 3 && cashOf(p) < cash0 && p.rust.deception === 1 && trained && (p.practice?.social ?? 0) === 0.5, `${city ?? 'moscow'}: ${fmt(mins, 0)} min, paid ${cashOf(p) < cash0}, Deception's rust ${p.rust.deception}, trained ${trained}, Social's practice ${p.practice?.social}`);
        const before = g.time.ms;
        step(g, { act: ['shop:club:radio'] }, bus);
        assert(!me.inside && g.time.ms - before < 1000 && said.some(t => /^Not today: it meets/.test(t)), `the radio club on a Tuesday: ${said.at(-1)}`);
        out.push(`${city ?? 'moscow'} (seed ${c.seed}) ${fmt(mins, 0)} min`);
      }
      console.log(`      the dramatics, Tuesday 18:40: ${out.join('; ')}; the radio club: "Not today: it meets ${whenText(CLUBS.find(c => c.id === 'radio'))}"`);
    },
  },
  {
    name: 'clubs: a shooting range in each city, what a visitor may shoot there (London: a club .22, no pistol); a session an hour and a quarter, paid, Weapon handling practised and trained',
    fn() {
      const out = [];
      for (const city of [null, 'london', 'beirut', 'cairo']) {
        const c = atCentre(city, 'range');
        assert(c, `${city ?? 'moscow'}: a range within a dozen towns`);
        const { g, d } = c, me = playerActor(g), p = g.people[g.player];
        const w = ways(g, d, 'counter').filter(o => o.id.startsWith('range:')), want = RANGES[city ?? 'moscow'];
        assert(w.length === want.length && (city !== 'london' || !w.some(o => /pistol/i.test(o.id))), `${city ?? 'moscow'}: ${w.map(o => o.id).join(', ')}`);
        p.cash = 5000; p.rust = { weapons: 1 };
        const t0 = g.time.ms, cash0 = cashOf(p), tr0 = p.training?.weapons ?? 0, sk0 = p.skills.weapons?.[0] ?? 0;
        step(g, { act: [`shop:${w[0].id}`] }, null);
        for (let t = 0; t < 20 * 200 && me.inside; t++) step(g, {}, null);
        const mins = (g.time.ms - t0) / 60000, trained = (p.skills.weapons?.[0] ?? 0) > sk0 || (p.training?.weapons ?? 0) > tr0;
        assert(Math.abs(mins - 75) < 2 && cashOf(p) < cash0 && trained && !p.rust.weapons, `${city ?? 'moscow'}: ${fmt(mins, 0)} min, paid ${cashOf(p) < cash0}, trained ${trained}, rust ${p.rust.weapons}`);
        out.push(`${city ?? 'moscow'} (seed ${c.seed}): ${w.map(o => o.id.slice(6)).join(' or ')}, ${fmt(mins, 0)} min`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
];
