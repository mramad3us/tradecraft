// The long rivalries (sim/geopolitics.js RIVALRIES, THREADS; DESIGN.md, 0.2: the deep postings): decades-long rivalries between the agency's country
// and another, from the countries' profiles; a deep post's purpose drawn from them, not the stations' few-years business; the news
// of them between postings; an illegal's taskings over decades following their threads.
import { RIVALRIES, THREADS, threads, threadAt, purposeAt, rivalryNews, taskingAt, timeline, rivalryOf } from '../src/sim/geopolitics.js';
import { candidates, newCampaign, nextTasking } from '../src/sim/campaign.js';
import { deepPaper } from '../src/sim/postings.js';
import { at } from '../src/sim/clock.js';
import { YEAR } from '../src/sim/incubation.js';
import { assert, fmt } from './helpers.mjs';

const yearOf = (ms) => new Date(Date.UTC(2026, 0, 1) + ms).getUTCFullYear();

export default [
  {
    name: 'rivalries: from the countries\' profiles (Moscow since 1947, Tehran by way of the party since 1983, Moscow\'s courtship of Cairo since 1955; none in Britain); every thread a known one, a decade and more; the same world the same threads',
    fn() {
      const list = RIVALRIES.map(R => `${R.country}: ${R.the} since ${R.since} (${R.threads.join(', ')})`);
      assert(RIVALRIES.length === 3 && !RIVALRIES.some(R => R.country === 'gb') && RIVALRIES.every(R => R.agency === 'us' && R.threads.every(t => THREADS[t])), list.join('; '));
      const a = threads(9, 'moscow').map(x => x.thread).join(), b = threads(9, 'moscow').map(x => x.thread).join(), d = threads(10, 'moscow').map(x => x.thread).join();
      const station = timeline(9, 'ru', 'moscow').filter(I => I.from > at(2026, 1, 1) && I.from < at(2046, 1, 1)).length, deep = threads(9, 'moscow').filter(I => I.from > at(2026, 1, 1) && I.from < at(2046, 1, 1)).length;
      assert(a === b && a !== d && deep < station, `same world ${a === b}, another ${a !== d}; in twenty years: the station's issues ${station}, the rivalry's threads ${deep}`);
      for (const l of list) console.log(`      ${l}`);
      console.log(`      2026–2046 in Moscow, one world: the station's business turns over ${station} times, the long war's ${deep}`);
    },
  },
  {
    name: 'rivalries: a deep post\'s purpose is the thread open on its first day, not the station\'s tasking; its brief says the long war, and what it did while you were away',
    fn() {
      const out = [];
      for (const city of ['moscow', 'beirut', 'cairo']) {
        const c = newCampaign(71, candidates(71, city, 'undercover')[0], city, 'undercover'), p = c.posting, T = threadAt(c.world, city, p.startMs), S = taskingAt(c.world, city, p.startMs);
        const B = deepPaper(c), news = rivalryNews(c.world, city, at(2000, 1, 1), p.startMs);
        assert(p.thread === T.thread && p.subject === T.subject && p.subject !== S?.[0] && B.lines.some(l => l.includes(rivalryOf(city).the.slice(1))) && news.length, `${city}: ${p.subject} / ${T.subject} / ${S?.[0]}`);
        out.push(`${city}: ${p.subject} (the station's own: ${S?.[0]}); since 2000: ${news.slice(-2).join(' ')}`);
      }
      for (const o of out) console.log(`      ${o}`);
    },
  },
  {
    name: 'rivalries: an illegal\'s decades: each tasking done, the Center\'s next, along the thread open then (the next question while it runs, another thread when it\'s turned)',
    fn() {
      const c = newCampaign(72, candidates(72, 'moscow', 'illegal')[0], 'moscow', 'illegal'), p = c.posting, seen = [`${yearOf(p.startMs)} ${p.thread}: ${p.goal}`];
      for (const y of [2, 9, 17, 26]) { nextTasking(c, p.startMs + y * YEAR); seen.push(`${yearOf(p.startMs + y * YEAR)} ${p.thread}: ${p.goal}`); }
      const threadsSeen = new Set(seen.map(s => s.split(' ')[1].replace(':', '')));
      assert(p.taskings === 4 && threadsSeen.size >= 2 && c.signals.length === 4, `${p.taskings} taskings, threads ${[...threadsSeen]}`);
      for (const s of seen) console.log(`      ${s}`);
    },
  },
];
