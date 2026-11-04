// The time between postings (sim/career.js): home leave, then the language school for as long as the next station's
// language takes to working (official cover; fluent undercover), by its FSI category; the new posting that much later,
// the officer older, the language on their file, the school on their record.
import { candidates, newCampaign, promote, record } from '../src/sim/campaign.js';
import { between, betweenWords, langWeeks, ageOf, plan, planPaper, YEAR, LEAVE_WEEKS } from '../src/sim/career.js';
import { legendFile } from '../src/sim/campaign.js';
import { DAY } from '../src/sim/clock.js';
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
];
