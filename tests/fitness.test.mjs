// Fitness kept up or let go (sim/fitness.js), and skills going rusty (sim/rust.js), over the weeks: a week's training
// against what the base asks, the effective a point either way to ±3, the base itself moved by two weeks at the edge;
// the top of the scale held only by hard work; a legend's close combat rusting unpractised, and back at the club.
import { exercise, onFoot, rollWeeks, baseOf, upNeed, holdNeed, capOf, SESSION_PTS, FIT_MAX } from '../src/sim/fitness.js';
import { practise, rustRoll, PERIOD_DAYS } from '../src/sim/rust.js';
import { skill } from '../src/sim/skills.js';
import { sheet } from '../src/sim/people.js';
import { DAY } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

const WEEK = 7 * DAY, MONDAY = 4 * DAY;                             // (day 4, 2026-01-05, a Monday)
const world = (p) => ({ time: { ms: MONDAY }, player: p.id, people: { [p.id]: p }, log: [], campaign: {} });
// (weeks of it: `sessions` at the gym a week and `km` on foot; the effective and the base at each week's end)
function weeks(p, n, sessions, km) {
  const g = world(p), out = [];
  for (let w = 0; w < n; w++) {
    const t0 = MONDAY + w * WEEK;
    for (let s = 0; s < sessions; s++) exercise(g, null, p, SESSION_PTS, t0 + (s + 0.5) * DAY);
    onFoot(g, null, p, km * 1000, 0); g.time.ms = t0 + 6.9 * DAY;
    rollWeeks(g, null, p, t0 + WEEK + 1);
    out.push(`${baseOf(p)}${p.fit.off >= 0 ? '+' : ''}${p.fit.off}`);
  }
  return out;
}

export default [
  {
    name: 'fitness: base 10, four sessions a week: a point up a week to +3, then the base itself up, +2 to climb again; nothing, down the same way',
    fn() {
      const p = sheet({ id: 'me', cls: 'spook', skills: { fitness: [10, 0] } });
      const up = weeks(p, 6, 4, 10);
      assert(up[0] === '10+1' && up[2] === '10+3' && up[3] === '11+2', `four sessions and 10 km a week: ${up.join(' → ')}`);
      const q = sheet({ id: 'me', cls: 'spook', skills: { fitness: [10, 0] } });
      const down = weeks(q, 5, 0, 3);
      assert(down[2] === '10-3' && down[3] === '9-2', `nothing but 3 km a week: ${down.join(' → ')}`);
      const e = sheet({ id: 'me', cls: 'spook', skills: { fitness: [10, 0] } }); weeks(e, 2, 4, 10);
      assert(skill(e, 'fitness') === 12, `effective fitness in the rolls: ${skill(e, 'fitness')}`);
      console.log(`      base 10, four sessions and 10 km a week: ${up.join(' → ')}; nothing but 3 km: ${down.join(' → ')}; what it asks at 10: ${holdNeed(10)} to hold, ${upNeed(10)} to climb`);
    },
  },
  {
    name: 'fitness: the higher the base the more it asks, and the less room above it; at the top, never above the base, held only by training nearly every day',
    fn() {
      const rows = [10, 14, 18, 22, FIT_MAX].map(b => `${b}: hold ${Math.round(holdNeed(b))}, climb ${capOf(b) ? Math.round(upNeed(b)) : '—'}, room +${capOf(b)}`);
      const top = sheet({ id: 'me', cls: 'spook', skills: { fitness: [FIT_MAX, 0] } });
      const hard = weeks(top, 3, 7, 25), easy = weeks(sheet({ id: 'me', cls: 'spook', skills: { fitness: [FIT_MAX, 0] } }), 3, 4, 10);
      assert(capOf(FIT_MAX) === 0 && hard.every(w => w === `${FIT_MAX}+0`) && easy[0] === `${FIT_MAX}-1`, `the top: seven sessions a week ${hard.join(' → ')}; four ${easy.join(' → ')}`);
      console.log(`      ${rows.join('; ')}; at ${FIT_MAX}, seven sessions and 25 km a week: ${hard.join(' → ')}; four: ${easy.join(' → ')}`);
    },
  },
  {
    name: 'rust: a legend\'s CQC of 30 unpractised: a level a month, to 22 at three months; the club twice brings it back; rolls in the field keep a skill',
    fn() {
      const p = sheet({ id: 'me', cls: 'spook', os: 95, skills: { cqc: [18, 2], tracking: [18, 2] } }), g = world(p), M = PERIOD_DAYS * DAY;
      rustRoll(g, null, p, MONDAY);
      const at = [skill(p, 'cqc')], fresh = skill(p, 'tracking');
      for (let m = 1; m <= 3; m++) {
        for (let k = 0; k < 8; k++) practise(g, null, p, 'tracking', 0.25, MONDAY + (m - 1) * M + k * DAY);   // (tracking used in the field: eight rolls a month)
        rustRoll(g, null, p, MONDAY + m * M + 1); at.push(skill(p, 'cqc'));
      }
      const kept = skill(p, 'tracking');
      practise(g, null, p, 'cqc', 1, MONDAY + 3 * M + 2 * DAY); const once = skill(p, 'cqc');
      practise(g, null, p, 'cqc', 1, MONDAY + 3 * M + 9 * DAY); const twice = skill(p, 'cqc');
      assert(at[0] === 30 && at[3] <= 23 && at[1] < at[0] && twice > at[3] && kept === fresh, `CQC by the month: ${at.join(' → ')}; the club once ${once}, twice ${twice}; tracking, used: ${kept} of ${fresh}`);
      console.log(`      CQC 30 unpractised, by the month: ${at.join(' → ')}; a class at the club: ${once}, another: ${twice}; tracking, eight rolls a month: ${kept}, as it was (${fresh})`);
    },
  },
];
