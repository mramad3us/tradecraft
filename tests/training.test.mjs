// Time spent on yourself (sim/training.js, sim/shops.js, the flat's armchair): hours in, points out, slower
// the higher the skill, no further than the teacher; a language by levels; at a gym, a club, a language
// school, an hour or two for its fee, and the skill it trains; a bookshop's shelf; an hour's reading,
// at home or over a coffee.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { train, learn, hoursFor, BOOKS, shelf } from '../src/sim/training.js';
import { ways, GYM_UP_TO } from '../src/sim/shops.js';
import { atDoor, walkIn, walk, spotOf } from './shopwalk.mjs';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { cashOf } from '../src/sim/money.js';
import { assert, fmt } from './helpers.mjs';

/** The nearest shop of a kind on the player's street, walked into, the player at its counter (or its window table: `spot`). */
function atShop(g, kind, spot = 'counter') {
  const u = atDoor(g, (o) => o.shop === kind && !!spotOf(o, spot));
  if (!u) return null;
  walkIn(g, u);
  const s = spotOf(u, spot);
  walk(g, s.x, s.z);
  return { x: u.door, shop: u.shop };
}

export default [
  {
    name: 'training: hours in, a point for so many (more the higher it is), no further than the teacher; a language by its levels',
    fn() {
      const p = { skills: { fitness: [5, 0] }, langs: { en: 'native' } };
      let h = 0;
      while (p.skills.fitness[0] < 8) { train(p, 'fitness', 1); h++; }
      const p2 = { skills: { cqc: [12, 0] } }; const g = train(p2, 'cqc', 100, 14);
      const p3 = { skills: {}, langs: {} }; let lh = 0;
      while (p3.langs.ru !== 'working') { learn(p3, 'ru', 1.5); lh += 1.5; }
      console.log(`      fitness 5 → 8: ${h} hours (${hoursFor(5)}, ${hoursFor(6)}, ${hoursFor(7)}); CQC 12 with a teacher to 14, a hundred hours: ${p2.skills.cqc[0]}; Russian none → working: ${lh} hours`);
      assert(h === Math.ceil(hoursFor(5) + hoursFor(6) + hoursFor(7)) || h === Math.floor(hoursFor(5) + hoursFor(6) + hoursFor(7)), 'the hours add up');
      assert(p2.skills.cqc[0] === 14 && g.toNext === null, 'no further than the teacher');
      assert(p3.langs.ru === 'working', 'a language by levels');
    },
  },
  {
    name: 'training: a gym, a club, a language school, a bookshop in every city; an hour or two for the fee, the skill it trains; a book bought, read over a coffee',
    fn() {
      const out = [];
      for (const city of ['moscow', 'london', 'cairo', 'beirut']) {
        const found = {};
        for (const kind of ['gym', 'club', 'school', 'books']) {
          let got = null;
          for (let seed = 1; seed <= 8 && !got; seed++) {
            const g = newGame({ seed, scenario: 'walk', city: city === 'moscow' ? null : city, weather: 'clear' });
            start(g, null);
            const d = atShop(g, kind);
            if (!d) continue;
            const p = g.people[g.player], me = playerActor(g);
            p.cash = 2000;
            const w = ways(g, d, 'counter').map(o => o.id), way = { gym: 'train', club: 'class', school: 'lesson' }[kind] ?? w.find(x => x.startsWith('book:'));
            assert(w.includes(way), `${city} ${kind}: offered (${w.join(', ')})`);
            const t0 = g.time.ms, cash0 = cashOf(p), before = JSON.stringify([p.skills, p.langs, p.training]);
            step(g, { act: [`shop:${way}`] }, null);
            for (let t = 0; t < 20 * 200 && me.inside; t++) step(g, {}, null);   // (a book's three minutes at the counter; the hours of the rest, skipped by the game)
            const mins = (g.time.ms - t0) / 60000;
            assert(cashOf(p) < cash0 && (kind === 'books' ? p.books?.length === 1 : JSON.stringify([p.skills, p.langs, p.training]) !== before), `${city} ${kind}: paid, and something for it`);
            if (kind === 'books') {
              // (and an hour of it over a coffee: at a café, 'read')
              const c = atShop(g, 'cafe', 'sit');
              if (c) { step(g, { act: ['shop:read'] }, null); for (let t = 0; t < 40 && me.inside; t++) step(g, {}, null); assert(p.books[0].read === 1, `${city}: an hour's reading over a coffee`); }
            }
            got = `${kind} ${fmt(mins, 0)} min`;
          }
          found[kind] = got;
        }
        out.push(`${city}: ${Object.values(found).filter(Boolean).join(', ')}`);
        assert(Object.values(found).filter(Boolean).length >= 3, `${city}: most of them found (${JSON.stringify(found)})`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'training: at home, the armchair and the book on the go: an hour of it; with nothing to read, nothing offered',
    fn() {
      const c = newCampaign(5, candidates(5, 'moscow')[0], 'moscow'); c.calls = [];
      const g = newGame({ seed: 5, scenario: 'campaign', campaign: c });
      start(g, null);
      g.scenario.prompt = { act: 'read' };
      step(g, { act: ['instinct'] }, null);
      for (let t = 0; t < 600 && playerActor(g).busy; t++) step(g, {}, null);
      for (let t = 0; t < 30; t++) step(g, {}, null);
      const none = g.scenario.prompt?.act;
      g.people.me.books = [{ id: 'thinking', read: 0 }];
      const t0 = g.time.ms;
      for (let t = 0; t < 30; t++) step(g, {}, null);
      const offered = g.scenario.prompt?.act;
      step(g, { act: ['instinct'] }, null);
      console.log(`      no book: ${none ?? 'nothing offered'}; a book: ${offered}; after: ${g.log.at(-1)?.text}`);
      assert(!none && offered === 'read' && g.people.me.books[0].read === 1 && (g.time.ms - t0) / 60000 >= 60, 'an hour at home with the book');
    },
  },
];
