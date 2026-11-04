// Career runs under the illegal's branch (the user, 2026-11-04: "we'll ask for a successful posting and age under 30 … their
// tradecraft is boosted to 80 as they end their illegal training … can you tell me how the runs go with these new parameters ?";
// then the lead's calls on it: a posting of one's own carried out, the Center's two-year school, native lying low, legends exempt
// from the age, their day one at LEGEND_DAY_ONE_MAX at most).
// A posting's length isn't played here: it's run on the campaign's own planner (sim/campaign.js plan(): its cadences, its one a
// day, its trips), every assignment gone to and folded back (fold(): the intelligence, the trust, the goal), each succeeding
// SUCCESS of the time by the run's own dice; the posting ends where the real one would, at its goal. Then the career's own
// sums (sim/postings.js offers(), forecast(): the training, the incubation, day one) for every branch offered.
import { candidates, newCampaign, plan, fold, agenda, legendFile } from '../src/sim/campaign.js';
import { offers, forecast, nextPosting, careerEnd, LEGEND_DAY_ONE_MAX } from '../src/sim/postings.js';
import { ageOf, ILLEGAL_AGE, ILLEGAL_OS, RETIRE_AGE, plan as trainingPlan } from '../src/sim/career.js';
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
      let under = 0, offered = 0, mismatch = 0, checked = 0, longer = 0;
      for (let s = 1; s <= SEEDS; s++) {
        const ch = candidates(s, 'london', 'junior')[s % 3], J = newCampaign(s, ch, 'london', 'junior');
        S.start.push(ageOf(J.character, J.posting.startMs));
        const endJ = run(J); if (!endJ) continue;
        const aJ = ageOf(J.character, endJ); S.tourEnd.push(aJ); S.tourDays.push((endJ - J.posting.startMs) / DAY);
        const L = offers(J, endJ), il = L.filter(o => o.kind === 'illegal' && o.ok);
        if (aJ < ILLEGAL_AGE) under++;
        if (il.length) offered++;                                    // (none: a first tour alone isn't a posting of your own)
        // (the official ladder: a first handler's posting at every station, its school first)
        for (const city of CITY_IDS) {
          const H = nextPosting(J, city, 'official'), endH = run(H); if (!endH) continue;
          const aH = ageOf(H.character, endH);
          (S.h[city] ??= []).push(aH); (S.hDays[city] ??= []).push((endH - H.posting.startMs) / DAY);
          // (an undercover post never takes longer to train for than an illegal's in the same city: two schools, the same language)
          for (const dc of DEEP_CITIES) { const w = (k) => trainingPlan(H.character, dc, k).reduce((t, x) => t + x.weeks, 0); if (w('undercover') > w('illegal')) longer++; }
          for (const o of offers(H, endH).filter(x => x.ok && x.kind !== 'official')) {
            const F = forecast(H, o.city, o.kind, endH), A = ageOf(H.character, F.start);
            if (o.kind === 'illegal') {
              assert(aH < ILLEGAL_AGE, `offered at ${aH}`); (S.ill.hand[o.city] ??= []).push({ trainY: F.weeks / 52, incY: F.I.ms / YEAR, age: A, os: Math.max(H.character.os, ILLEGAL_OS), went: aH });
              // (now and then one made for real, the forecast's numbers held to it)
              if ((s + city.length) % 9 === 0 && o.city === 'cairo') { const n = nextPosting(H, o.city, 'illegal'); checked++; if (n.posting.startMs !== F.start || n.character.os < ILLEGAL_OS || n.character.langs.ar !== 'native') mismatch++; }
            }
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
      for (const [from, T] of [['after a first handler\'s posting', S.ill.hand]]) for (const city of DEEP_CITIES) {
        const X = T[city] ?? [];
        if (!X.length) { console.log(`      illegal, ${city}, ${from}: nobody`); continue; }
        const age = q(X.map(x => x.age));
        console.log(`      illegal, ${city}, ${from} (${X.length}): gone at ${row(q(X.map(x => x.went)))}; training ${row(q(X.map(x => x.trainY)), 1)} y; lying low ${row(q(X.map(x => x.incY)), 1)} y; age on day one ${row(age)}; Tradecraft ${row(q(X.map(x => x.os)))}; years left before ${RETIRE_AGE}: ${row(q(X.map(x => RETIRE_AGE - x.age)))}`);
      }
      for (const city of DEEP_CITIES) { const X = S.uc[city] ?? []; console.log(`      undercover, ${city}, after a first handler's posting (${X.length}): gone at ${row(q(X.map(x => x.went)))}; training ${row(q(X.map(x => x.trainY)), 1)} y; the legend lived ${row(q(X.map(x => x.incY * 12)))} months; age on day one ${row(q(X.map(x => x.age)))}`); }
      console.log(`      ${checked} illegal postings made for real: day one, Tradecraft and the language as forecast in ${checked - mismatch}`);
      const all = Object.values(S.ill.hand).flat();
      assert(longer === 0 && tq.min >= 24 && tq.max <= 29 && offered === 0 && mismatch === 0 && checked > 5 && all.length && all.every(x => x.os >= ILLEGAL_OS && x.went < ILLEGAL_AGE), 'the ages, the gate, the boost');
    },
  },
  {
    name: 'runs: the legends, exempt from the age: London\'s first tour, an undercover post, then an illegal\'s; who retires on the way (past 60 at a posting\'s end), and the day one of those who go, at LEGEND_DAY_ONE_MAX at most',
    fn() {
      const went = [], out = { files: 0, retiredLondon: 0, retiredUc: 0 }, byWhy = {};
      for (let s = 1; s <= 6; s++) for (let n = 0; n < 12; n++) {
        const ch = legendFile(s, 'london', 'junior', n), J = newCampaign(s * 100 + n, ch, 'london', 'junior'); out.files++;
        const a0 = ageOf(J.character, J.posting.startMs), endJ = run(J); if (!endJ) continue;
        if (careerEnd(J, endJ)) { out.retiredLondon++; continue; }
        const ucs = offers(J, endJ).filter(o => o.kind === 'undercover' && o.ok), uc = ucs[(s + n) % (ucs.length || 1)]; if (!uc) continue;   // (the undercover city in turn)
        const U = nextPosting(J, uc.city, 'undercover'), endU = run(U); if (!endU) continue;
        const E = careerEnd(U, endU); if (E) { out.retiredUc++; (byWhy[E.why] ??= 0); byWhy[E.why]++; continue; }
        for (const o of offers(U, endU).filter(x => x.kind === 'illegal' && x.ok)) {
          const F = forecast(U, o.city, 'illegal', endU), A = ageOf(U.character, F.start);
          went.push({ legend: ch.legend, a0, ucAge: ageOf(U.character, endU), school: F.weeks / 52, incY: F.I.ms / YEAR, age: A, capped: !!F.I.capped, city: o.city });
        }
      }
      const reasons = new Set(went.map(x => x.legend));
      console.log(`      ${out.files} legend files from London: ${out.retiredLondon} retire after London (past ${RETIRE_AGE}), ${out.retiredUc} after their undercover post; ${went.length} illegal offers to ${reasons.size} of the 12 reasons (${[...reasons].join(', ')})`);
      console.log(`      age at London's start ${row(q(went.map(x => x.a0)))}; at the undercover post's end ${row(q(went.map(x => x.ucAge)))}; the school ${row(q(went.map(x => x.school)), 1)} y; lying low ${row(q(went.map(x => x.incY)), 1)} y (cut short for ${went.filter(x => x.capped).length}); day one ${row(q(went.map(x => x.age)))}`);
      for (const city of DEEP_CITIES) { const X = went.filter(x => x.city === city); console.log(`      legend, illegal, ${city} (${X.length}): day one ${row(q(X.map(x => x.age)))}, lying low ${row(q(X.map(x => x.incY)), 1)} y`); }
      assert(went.length && went.every(x => x.age <= LEGEND_DAY_ONE_MAX && x.incY >= 3 - 0.05) && out.retiredLondon > 0, `day one at most ${Math.max(...went.map(x => x.age))}`);
    },
  },
];
