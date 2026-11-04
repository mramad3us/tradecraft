// Hale's exercises booked as the campaign's assignments (sim/campaign.js bookLessons(), sim/lessons.js): on the first
// call, a day each before the desk, the work after it; later, a free slot two hours clear of anything; each lesson's
// scene played on the posting's own streets at its hour, Hale in your ear in the city's own words; folded, a little
// Tradecraft and nothing on the record.
import { newGame, start, step } from '../src/sim/game.js';
import { candidates, newCampaign, bookLessons, lessonsLeft, context, fold, pass, LESSON_BOOK, LESSON_GAP_H } from '../src/sim/campaign.js';
import { missionPlace } from '../src/sim/places.js';
import { DAY, HOUR, stampText, calendar } from '../src/sim/clock.js';
import { createBus } from '../src/sim/bus.js';
import { assert } from './helpers.mjs';

const dayOf = (ms) => Math.floor(ms / DAY);

export default [
  {
    name: 'lessons: booked on Hale\'s first call, a day each from tomorrow at their hours; the desk after the last, the work after the desk; no working day missed before it',
    fn() {
      const c = newCampaign(3, candidates(3)[0]), p = c.posting, now = p.startMs + HOUR, today = dayOf(now);
      const before = c.assignments.filter(a => a.status === 'open').length;
      const got = bookLessons(c, LESSON_BOOK.map(L => L.id), now, true);
      const days = got.map(a => dayOf(a.from) - today), early = c.assignments.filter(a => a.kind !== 'lesson' && a.status === 'open');
      assert(got.length === LESSON_BOOK.length && days.join() === '1,2,3,4,5,6,7' && p.deskFrom === today + 8 && !early.length, `booked ${got.length}, days ${days.join()}, the desk from day ${p.deskFrom - today}; work in the settling week: ${early.length} (${before} before)`);
      const cover = p.cover;
      pass(c, now, p.deskFrom * DAY);                                    // (the week of lessons gone by, as if each were done: the plan a week on from there)
      const real = c.assignments.filter(a => a.kind !== 'lesson' && a.status === 'open');
      assert(p.cover === cover && real.length > 0 && real.every(a => dayOf(a.from) >= p.deskFrom), `cover over the settling days: ${cover} → ${p.cover}; the work from day ${Math.min(...real.map(a => dayOf(a.from))) - today} (${real.length})`);
      console.log(`      ${got.map(a => `${stampText(a.from)} ${a.lesson}`).join('; ')}; the desk from ${stampText(p.deskFrom * DAY).slice(0, 10)}; the first assignment ${stampText(real[0].from)}`);
    },
  },
  {
    name: 'lessons: asked for later, in the first free slot from tomorrow, two hours clear of any assignment, one a day',
    fn() {
      const c = newCampaign(5, candidates(5)[1]), now = c.posting.startMs + 9 * DAY + 10 * HOUR;
      const got = bookLessons(c, ['tailing', 'watching', 'umbrella'], now, false);
      const clear = got.every(a => !c.assignments.some(x => x !== a && x.status === 'open' && x.start < a.to + LESSON_GAP_H * HOUR && x.to > a.start - LESSON_GAP_H * HOUR));
      const oneADay = new Set(got.map(a => dayOf(a.from))).size === got.length;
      assert(got.length === 3 && clear && oneADay && got.every(a => a.start > now), `booked ${got.map(a => stampText(a.from)).join(', ')}; clear ${clear}, one a day ${oneADay}`);
      console.log(`      ${got.map(a => `${a.lesson} ${stampText(a.from)} (${calendar(a.from).weekday < 5 ? 'a working day\'s evening' : 'a day off'})`).join('; ')}`);
    },
  },
  {
    name: 'lessons: each booked one played on the posting\'s streets at its hour, Hale in your ear in the city\'s words (Moscow, London); folded, a little XP, the heat as it was',
    fn() {
      const out = [];
      for (const [seed, city, level] of [[3, 'moscow', 'handler'], [7, 'london', 'junior']]) {
        const c = newCampaign(seed, candidates(seed, city, level)[0], city, level), now = c.posting.startMs + HOUR;
        bookLessons(c, LESSON_BOOK.map(L => L.id), now, true);
        for (const a of c.assignments.filter(x => x.kind === 'lesson')) {
          const at = missionPlace(c, a);
          assert(at, `${city} ${a.lesson}: a place on the streets`);
          a.me = { x: at.x + 4, z: at.z }; a.began = a.start;
          const g = newGame({ seed: 11, lesson: a.lesson, campaign: c, context: context(c, a) }), bus = createBus(), said = [];
          bus.on('log', (e) => { if (e.kind === 'radio') said.push(e.text); });
          start(g, bus);
          for (let t = 0; t < 20 * 40 && !g.scenario.outcome; t++) step(g, {}, bus);
          const wrong = city !== 'moscow' && said.some(t => /Moscow|FSB|Lefortovo/.test(t));
          assert(g.tutor && g.campaign === c && g.map.seed === c.posting.mapSeed && (g.map.city ?? 'moscow') === city && Math.abs(g.time.ms - a.start) < 40 * 60000 + 3 * 60000 && said.length > 0 && !wrong,
            `${city} ${a.lesson}: tutor ${!!g.tutor}, the posting's map ${g.map.seed === c.posting.mapSeed}, ${g.map.city ?? 'moscow'}, Hale said ${said.length}${wrong ? `, in Moscow's words: ${said.find(t => /Moscow|FSB|Lefortovo/.test(t))}` : ''}`);
          const heat = c.posting.heat, paper = fold(c, a, { outcome: g.scenario.outcome ?? 'missed' }, g.people[g.player], g.time.ms, 99);
          assert(/^HALE'S EXERCISE/.test(paper.title) && c.posting.heat === heat && a.status === 'done', `${city} ${a.lesson}: folded "${paper.title}", heat ${heat} → ${c.posting.heat}`);
          out.push(`${city} ${a.lesson}: "${said[0].slice(0, 48)}…"`);
        }
        assert(lessonsLeft(c).length === 0, `${city}: all seven done`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
];
