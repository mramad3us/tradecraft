// The time between postings (sim/career.js): home leave, then the language school for as long as the next station's
// language takes to working (official cover; fluent undercover), by its FSI category; the new posting that much later,
// the officer older, the language on their file, the school on their record.
import { candidates, newCampaign, promote, record, lieLow, expected, pass, context, plan as planDays, SICK_COVER } from '../src/sim/campaign.js';
import { between, betweenWords, langWeeks, ageOf, plan, planPaper, retires, successorStart, YEAR, LEAVE_WEEKS, RETIRE_AGE, SUCCESSOR_WEEKS } from '../src/sim/career.js';
import { legendFile } from '../src/sim/campaign.js';
import { DAY } from '../src/sim/clock.js';
import { timeline, taskingAt, newsBetween } from '../src/sim/geopolitics.js';
import { assert } from './helpers.mjs';

const yearOf = (ms) => new Date(Date.UTC(2026, 0, 1) + ms).getUTCFullYear();

export default [
  {
    name: 'career: weeks of language school by the FSI\'s categories (French 30, German 36, Russian 44, Arabic 88 to working; fluent 80% more; from basic, the rest)',
    fn() {
      const w = { fr: langWeeks('fr'), de: langWeeks('de'), ru: langWeeks('ru'), ar: langWeeks('ar'), arFromBasic: langWeeks('ar', 'basic'), arFluent: langWeeks('ar', 'none', 'fluent'), ruHave: langWeeks('ru', 'working') };
      assert(w.fr === 30 && w.de === 36 && w.ru === 44 && w.ar === 88 && w.arFromBasic === 66 && w.arFluent === Math.round(88 + 0.8 * 88) && w.ruHave === 0, JSON.stringify(w));
      console.log(`      to working: French ${w.fr} weeks, German ${w.de}, Russian ${w.ru}, Arabic ${w.ar} (from basic ${w.arFromBasic}); Arabic to fluent ${w.arFluent}; Russian already working: ${w.ruHave}`);
    },
  },
  {
    name: 'career: a first tour over, a station asked for: Beirut after London is the best part of two years at the Institute first (Arabic to working), the officer older, the Arabic and the school on the file; Moscow with Russian, three weeks\' leave',
    fn() {
      const out = [];
      for (const city of ['beirut', 'moscow']) {
        const ch = candidates(5, 'london', 'junior')[0], c = newCampaign(5, ch, 'london', 'junior');
        c.over = { why: 'promoted', ms: c.posting.startMs + 120 * DAY };
        const age0 = ageOf(c.character, c.over.ms), B = between(c.character, city), next = promote(c, city), start = next.posting.startMs;
        const weeks = (start - c.over.ms) / (7 * DAY), age1 = ageOf(next.character, start), R = record(next, start);
        const school = R.past.find(k => /Foreign Service Institute/.test(k.rank));
        if (city === 'beirut') assert(B.langW === 88 - (ch.langs?.ar === 'basic' ? 22 : 0) || B.langW > 0, `Beirut's school: ${B.langW} weeks`);
        assert(Math.abs(weeks - (LEAVE_WEEKS + B.langW)) < 1.2 && (B.langW ? next.character.langs[B.lang] === 'working' && school : !school) && age1 >= age0 + Math.floor((start - c.over.ms) / YEAR),
          `${city}: ${weeks.toFixed(1)} weeks on (${B.langW} of school), ${B.lang} ${next.character.langs[B.lang]}, age ${age0} → ${age1}, school on the file ${!!school}`);
        out.push(`${city}: ${betweenWords(c.character, city)} The posting from ${new Date(Date.UTC(2026, 0, 1) + start).toISOString().slice(0, 10)} (${yearOf(start)}), age ${age0} → ${age1}`);
      }
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'career: an illegal\'s training (0.2.x\'s post, planned now): the language to fluent and every skill to its floor, a phase a school; a legend\'s is short, a regular officer\'s very long; the paper opens with the hard word',
    fn() {
      const L = legendFile(5, 'moscow', 'handler', 2), R = candidates(5, 'moscow')[0];
      const yl = plan(L, 'beirut', 'illegal').reduce((t, x) => t + x.weeks, 0) / 52, yr = plan(R, 'beirut', 'illegal').reduce((t, x) => t + x.weeks, 0) / 52;
      const paper = planPaper(L, 'beirut', 'illegal');
      assert(yl < yr && yr > 4 && /dead in a month/.test(paper.lines[0]) && paper.lines.some(t => /Delta|Ground Branch|Farm/.test(t)), `a legend ${yl.toFixed(1)} years, a regular officer ${yr.toFixed(1)}`);
      console.log(`      an illegal's training for Beirut: a legend ${yl.toFixed(1)} years, a regular officer ${yr.toFixed(1)}; the legend's: ${plan(L, 'beirut', 'illegal').map(x => `${x.what} ${x.weeks} wk`).join(', ')}`);
    },
  },
  {
    name: 'career: the stations\' business over the years (sim/geopolitics.js): issues rising and settled a few years each, cycling; a posting\'s tasking the one live at its start, the same for a career\'s world; promoted years on, the news of what changed',
    fn() {
      const T = timeline(77, 'ru', 'moscow'), spans = T.slice(0, 6).map(I => (I.to - I.from) / (365.25 * DAY));
      const t1 = taskingAt(77, 'moscow', T[2].from + DAY), c = newCampaign(77, candidates(77)[0]);
      assert(spans.every(y => y >= 1.5 && y <= 4) && t1[0] === T[2].subject && c.posting.subject === taskingAt(77, 'moscow', c.posting.startMs)[0], `spans ${spans.map(y => y.toFixed(1))}; tasking ${t1[0]}; the posting's ${c.posting.subject}`);
      const news = newsBetween(77, 'moscow', c.posting.startMs, c.posting.startMs + 6 * 365.25 * DAY);
      assert(news.length >= 2, `six years of news: ${news.length}`);
      console.log(`      Moscow's business: ${T.slice(0, 5).map(I => `${I.subject} ${new Date(Date.UTC(2026, 0, 1) + I.from).getUTCFullYear()}–${new Date(Date.UTC(2026, 0, 1) + I.to).getUTCFullYear()}`).join('; ')}; the 2026 posting's: ${c.posting.subject}; six years on: ${news.slice(0, 2).join(' ')}`);
    },
  },
  {
    name: 'career: lying low on a working day is a sick day (the section rung; the first in a month free, the next counted against your standing; no day missed); a trip\'s officer lands fed and rested',
    fn() {
      const c = newCampaign(9, candidates(9)[0]), mon = c.posting.startMs + 3 * 3600000;
      const day = (ms) => Math.floor(ms / DAY);
      const exp = expected(c, mon), cover = c.posting.cover;
      lieLow(c, mon);
      const after1 = c.posting.cover, mon2 = mon + 2 * DAY;
      lieLow(c, mon2);
      const after2 = c.posting.cover;
      c.worked[day(mon) + 1] = true;                                     // (the day between at the desk)
      pass(c, mon, mon2 + DAY);
      assert(exp && after1 === cover && after2 === cover - SICK_COVER && c.worked[day(mon)] === 'sick' && c.posting.cover === after2, `expected ${exp}; cover ${cover} → ${after1} → ${after2} → after the days ${c.posting.cover}`);
      const J = newCampaign(5, candidates(5, 'london', 'junior')[0], 'london', 'junior');
      planDays(J, J.posting.startMs + 60 * DAY);
      const a = J.assignments.find(x => x.trip);
      const ctx = a && context(J, a);
      assert(!a || (ctx.player.strain === 0 && ctx.player.needs?.ate > a.start - 2 * 3600000), `the trip's officer: strain ${ctx?.player.strain}, ate ${ctx && (a.start - ctx.player.needs?.ate) / 60000} min before`);
      console.log(`      two sick days in a week: cover ${cover} → ${after1} → ${after2}; a trip to ${a?.trip ?? '(none planned)'}: landed fed and rested`);
    },
  },
  {
    name: 'career: the world goes on: the next officer\'s first day eight weeks after the last\'s career ended, a Monday, the same world\'s business at that date; an officer past 60 retires at a posting\'s end',
    fn() {
      const c = newCampaign(31, candidates(31)[0]), end = c.posting.startMs + 400 * DAY, start = successorStart(end);
      const n = newCampaign(32, candidates(32)[2], 'moscow', 'handler', start, c.world);
      const weekday = new Date(Date.UTC(2026, 0, 1) + start).getUTCDay();
      assert(n.world === c.world && weekday === 1 && start - end >= SUCCESSOR_WEEKS * 7 * DAY && n.posting.subject === taskingAt(c.world, 'moscow', start)[0], `world ${n.world} of ${c.world}, a ${weekday}, ${((start - end) / DAY).toFixed(0)} days on, tasked ${n.posting.subject}`);
      const old = { ...candidates(33)[0], age: 59 }; delete old.born;
      const o = newCampaign(33, old), atEnd = o.posting.startMs + 2 * YEAR;
      assert(!retires(o.character, o.posting.startMs) && retires(o.character, atEnd), `59 at the start: retires then ${retires(o.character, o.posting.startMs)}, two years on (${ageOf(o.character, atEnd)}) ${retires(o.character, atEnd)}`);
      console.log(`      the next officer from ${new Date(Date.UTC(2026, 0, 1) + start).toISOString().slice(0, 10)}, tasked with ${n.posting.subject} in the same world; 59 at the start, ${ageOf(o.character, atEnd)} two years on: retires (${RETIRE_AGE})`);
    },
  },
];
