// Career runs under the illegal's branch (the user, 2026-11-04: "we'll ask for a successful posting and age under 30 … their
// tradecraft is boosted to 80 as they end their illegal training … can you tell me how the runs go with these new parameters ?").
// A posting's length isn't played here: it's run on the campaign's own planner (sim/campaign.js plan(): its cadences, its one a
// day, its trips), every assignment gone to and folded back (fold(): the intelligence, the trust, the goal), each succeeding
// SUCCESS of the time by the run's own dice; the posting ends where the real one would, at its goal. Then the career's own
// sums (sim/postings.js offers(), forecast(): the training, the incubation, day one) for every branch offered.
import { candidates, newCampaign, plan, fold, agenda } from '../src/sim/campaign.js';
import { offers, forecast, nextPosting } from '../src/sim/postings.js';
import { ageOf, ILLEGAL_AGE, ILLEGAL_OS, RETIRE_AGE } from '../src/sim/career.js';
import { DEEP_CITIES } from '../src/sim/legends.js';
import { CITY_IDS } from '../src/sim/cities/index.js';
import { stream, chance } from '../src/sim/rng.js';
import { DAY } from '../src/sim/clock.js';
import { YEAR } from '../src/sim/incubation.js';
import { assert, fmt } from './helpers.mjs';

const SEEDS = 80, SUCCESS = 0.6;
const WIN = { sdr: 'clean', tail: 'seen', watch: 'photo' }, LOSE = { sdr: 'needless', tail: 'lost', watch: 'missed' };
// (a posting played to its goal: the next assignment from now, gone to, a success SUCCESS of the time; ends at c.over or after a year)
function run(c, p = SUCCESS) {
  const r = stream('runs', c.seed);
  let ms = c.posting.startMs;
  for (let k = 0; k < 600 && !c.over && ms - c.posting.startMs < YEAR; k++) {
    plan(c, ms); agenda(c, ms);
    const a = c.assignments.filter(x => x.status === 'open' && x.start >= ms).sort((x, y) => x.from - y.from)[0];
    if (!a) { ms += DAY; continue; }
    fold(c, a, { outcome: chance(r, p) ? WIN[a.kind] : LOSE[a.kind], team: 'none' }, c.character, a.to, c.posting.heat);
    ms = a.home ?? a.to;
  }
  return c.over ? c.over.ms : null;
}
const q = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? { min: s[0], med: s[Math.floor(s.length / 2)], max: s.at(-1), n: s.length } : { n: 0 }; };
const row = (Q, d = 0) => (Q.n ? `${fmt(Q.min, d)} / ${fmt(Q.med, d)} / ${fmt(Q.max, d)}` : '—');
const pct = (n, of) => `${of ? Math.round(n / of * 100) : 0}%`;

export default [
  {
    name: 'runs: the illegal\'s branch, 80 careers from the picker\'s first tour: ages at the start, at the first tour\'s end, at a first handler\'s posting\'s end; who\'s under 30; for those who go, the training, the years lying low, the age on day one and Tradecraft; the undercover branch beside it',
    fn() {
      const S = { start: [], tourEnd: [], tourDays: [], h: {}, hDays: {}, hand: [], ill: { tour: {}, hand: {} }, uc: {} };
      let under = 0, offered = 0, mismatch = 0, checked = 0;
      for (let s = 1; s <= SEEDS; s++) {
        const ch = candidates(s, 'london', 'junior')[s % 3], J = newCampaign(s, ch, 'london', 'junior');
        S.start.push(ageOf(J.character, J.posting.startMs));
        const endJ = run(J); if (!endJ) continue;
        const aJ = ageOf(J.character, endJ); S.tourEnd.push(aJ); S.tourDays.push((endJ - J.posting.startMs) / DAY);
        const L = offers(J, endJ), il = L.filter(o => o.kind === 'illegal' && o.ok);
        if (aJ < ILLEGAL_AGE) under++;
        if (il.length) offered++;
        assert(!il.length || aJ < ILLEGAL_AGE, `an illegal's post offered at ${aJ}`);
        for (const o of il) {
          const F = forecast(J, o.city, 'illegal', endJ), A = ageOf(J.character, F.start);
          (S.ill.tour[o.city] ??= []).push({ trainY: F.weeks / 52, incY: F.I.ms / YEAR, age: A, os: Math.max(J.character.os, ILLEGAL_OS), went: aJ });
        }
        // (one of them actually made, the forecast's numbers held to it)
        if (il.length && s % 4 === 0) { const o = il[s % il.length], n = nextPosting(J, o.city, 'illegal'), F = forecast(J, o.city, 'illegal', endJ); checked++; if (n.posting.startMs !== F.start || n.character.os < ILLEGAL_OS) mismatch++; }
        // (the official ladder: a first handler's posting at every station, its school first)
        for (const city of CITY_IDS) {
          const H = nextPosting(J, city, 'official'), endH = run(H); if (!endH) continue;
          const aH = ageOf(H.character, endH);
          (S.h[city] ??= []).push(aH); (S.hDays[city] ??= []).push((endH - H.posting.startMs) / DAY);
          for (const o of offers(H, endH).filter(x => x.ok && x.kind !== 'official')) {
            const F = forecast(H, o.city, o.kind, endH), A = ageOf(H.character, F.start);
            if (o.kind === 'illegal') { assert(aH < ILLEGAL_AGE, `offered at ${aH}`); (S.ill.hand[o.city] ??= []).push({ trainY: F.weeks / 52, incY: F.I.ms / YEAR, age: A, os: Math.max(H.character.os, ILLEGAL_OS), went: aH }); }
            else (S.uc[o.city] ??= []).push({ trainY: F.weeks / 52, incY: F.I.ms / YEAR, age: A, went: aH, from: city });
          }
        }
        // (the picker's handler start, for comparison: its file, its posting)
        const hc = CITY_IDS[s % 4], Hs = newCampaign(s, candidates(s, hc)[s % 3], hc), eH = run(Hs); if (eH) S.hand.push(ageOf(Hs.character, eH));
      }
      const tq = q(S.start), te = q(S.tourEnd);
      console.log(`      the picker's first-tour files (${SEEDS}): age at the start ${row(tq)} (min / median / max); the tour, played to its goal at ${SUCCESS * 100}% success, ${row(q(S.tourDays))} days; age at its end ${row(te)}; under ${ILLEGAL_AGE} then ${pct(under, S.tourEnd.length)}, offered an illegal's post ${pct(offered, S.tourEnd.length)}`);
      for (const city of CITY_IDS) { const A = S.h[city] ?? []; console.log(`      a first handler's posting at ${city}: the posting ${row(q(S.hDays[city] ?? []))} days; age at its end ${row(q(A))}; under ${ILLEGAL_AGE} ${pct(A.filter(a => a < ILLEGAL_AGE).length, A.length)}`); }
      console.log(`      the picker's own handler files (a posting of your own from day one): age at their first posting's end ${row(q(S.hand))}; under ${ILLEGAL_AGE} ${pct(S.hand.filter(a => a < ILLEGAL_AGE).length, S.hand.length)}`);
      for (const [from, T] of [['after the first tour', S.ill.tour], ['after a first handler\'s posting', S.ill.hand]]) for (const city of DEEP_CITIES) {
        const X = T[city] ?? [];
        if (!X.length) { console.log(`      illegal, ${city}, ${from}: nobody`); continue; }
        const age = q(X.map(x => x.age));
        console.log(`      illegal, ${city}, ${from} (${X.length}): gone at ${row(q(X.map(x => x.went)))}; training ${row(q(X.map(x => x.trainY)), 1)} y; lying low ${row(q(X.map(x => x.incY)), 1)} y; age on day one ${row(age)}; Tradecraft ${row(q(X.map(x => x.os)))}; years left before ${RETIRE_AGE}: ${row(q(X.map(x => RETIRE_AGE - x.age)))}`);
      }
      for (const city of DEEP_CITIES) { const X = S.uc[city] ?? []; console.log(`      undercover, ${city}, after a first handler's posting (${X.length}): gone at ${row(q(X.map(x => x.went)))}; training ${row(q(X.map(x => x.trainY)), 1)} y; the legend lived ${row(q(X.map(x => x.incY * 12)))} months; age on day one ${row(q(X.map(x => x.age)))}`); }
      console.log(`      ${checked} illegal postings made for real: day one and Tradecraft as forecast in ${checked - mismatch}`);
      assert(tq.min >= 24 && tq.max <= 29 && mismatch === 0 && Object.values(S.ill.tour).flat().every(x => x.os >= ILLEGAL_OS && x.went < ILLEGAL_AGE), 'the ages, the gate, the boost');
    },
  },
];
