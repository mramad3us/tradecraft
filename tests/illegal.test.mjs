// The illegal's posting (DESIGN.md, Cover, heat and the hunt: Under a legend; sim/campaign.js nextTasking(), sim/legends.js, sim/support.js, sim/dial.js): no
// embassy at all, the Center by dead drop and signal, support next to nothing, the last posting there is (no goal ends it: each
// tasking done, the Center's next; a job lost, another found; it runs till they take you, you die, or the Center brings you out).
import { candidates, newCampaign, pass, fold, goalOf } from '../src/sim/campaign.js';
import { offers, careerEnd, nextPosting } from '../src/sim/postings.js';
import { supportOf } from '../src/sim/support.js';
import { services } from '../src/sim/dial.js';
import { deepPaper } from '../src/sim/postings.js';
import { GOAL_DEEP } from '../src/sim/legends.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { DAY, HOUR } from '../src/sim/clock.js';
import { ageOf } from '../src/sim/career.js';
import { YEAR } from '../src/sim/incubation.js';
import { assert, fmt } from './helpers.mjs';

const illegal = (seed, city = 'moscow') => newCampaign(seed, candidates(seed, city, 'illegal')[0], city, 'illegal');

export default [
  {
    name: 'illegal: activated by the Center\'s signal: no embassy, a citizen\'s papers, native, Tradecraft 80+, a handler who is a retired illegal; support 20 at most, back 2 a day (a clean gun, never a clinic)',
    fn() {
      const out = [];
      for (const city of ['moscow', 'beirut', 'cairo']) {
        const c = illegal(51, city), p = c.posting, S = supportOf(c), lang = { moscow: 'ru', beirut: 'ar', cairo: 'ar' }[city], B = deepPaper(c);
        const g = newGame({ seed: 51, scenario: 'campaign', campaign: c }); start(g, null); for (let t = 0; t < 21; t++) step(g, {}, { emit() {}, on() {} });
        const sv = Object.fromEntries(services(g).map(s => [s.key, s.ok]));
        assert(p.level === 'illegal' && p.embassy.door && c.character.langs[lang] === 'native' && c.character.os >= 80 && p.handler?.name && S.max === 20 && S.perDay === 2 && B.stamp === 'THE SIGNAL' && sv.gun && !sv.clinic && !('extract' in sv), `${city}: ${JSON.stringify({ lang: c.character.langs[lang], os: c.character.os, S, sv })}`);
        out.push(`${city}: ${p.alias}, ${p.jobShort}; lived ${p.incubation.years} years; handler ${p.handler.name}, ${p.handler.line}`);
      }
      for (const o of out) console.log(`      ${o}`);
      console.log(`      the paper: ${deepPaper(illegal(51, 'cairo')).lines.slice(0, 3).join(' ')}`);
    },
  },
  {
    name: 'illegal: the last posting: a tasking done is the Center\'s next, never "posting complete"; a job lost, another; nothing offered, no retirement, however old',
    fn() {
      const c = illegal(52, 'beirut'), p = c.posting, goal0 = goalOf(p), sub0 = p.subject;
      p.intelligence = goal0 - 1;
      const a = { id: 'x', kind: 'watch', who: p.targets[0].id, from: p.startMs + DAY, to: p.startMs + DAY + 900000, start: p.startMs + DAY, status: 'open' };
      c.assignments.push(a);
      const paper = fold(c, a, { outcome: 'photo' }, c.character, a.to, 0);
      assert(!c.over && p.taskings === 1 && goalOf(p) === 2 * GOAL_DEEP.illegal && c.signals?.some(s => s.paper.title === 'THE CENTER: A NEW TASKING'), `over ${c.over?.why}, taskings ${p.taskings}, goal ${goalOf(p)}`);
      p.cover = 3;
      const papers = pass(c, a.to, a.to + 2 * DAY);
      assert(!c.over && p.cover > 0 && papers.some(x => x.title === 'ANOTHER JOB'), `job lost: over ${c.over?.why}, cover ${p.cover}`);
      const old = c.posting.startMs + 30 * YEAR;
      assert(careerEnd(c, old) === null && !offers(c, old).length, 'no end but the game\'s');
      console.log(`      ${paper.lines.at(-1)} The next: ${p.goal} (goal ${goal0} → ${goalOf(p)}; the subject ${sub0} → ${p.subject}); the job lost: ${papers.find(x => x.title === 'ANOTHER JOB').lines[0]}; thirty years on, at ${ageOf(c.character, old)}: still on it`);
    },
  },
];
