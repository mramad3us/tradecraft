// The career into the deep postings (sim/postings.js, sim/legends.js, sim/incubation.js; DESIGN.md, Career: The deep postings): what a posting's
// end offers (an undercover post after a handler's, never where your face is on file, never London; an illegal's for Tradecraft
// 80 and an undercover post carried out), the training and the incubation before it (the clock, the age, the language, the
// legend's history), the legends' start and their pretext, retiring at a posting's end, the deep start from the picker, and the
// long rivalries a deep post draws its purpose from (sim/geopolitics.js).
import { candidates, newCampaign, legendFile, record, LEVELS, heatFloor, pass } from '../src/sim/campaign.js';
import { offers, nextPosting, facesOf, careerEnd, forecast, afterPhases, LEGEND_AFTER } from '../src/sim/postings.js';
import { incubationOf, ciOf, UNDERCOVER_MONTHS, ILLEGAL_YEARS, YEAR, MONTH } from '../src/sim/incubation.js';
import { DEEP, DEEP_CITIES, isDeep } from '../src/sim/legends.js';
import { threads, purposeAt, rivalryOf } from '../src/sim/geopolitics.js';
import { ageOf, ILLEGAL_OS, ILLEGAL_AGE, RETIRE_AGE, planPaper } from '../src/sim/career.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { DAY, HOUR, calendar, at } from '../src/sim/clock.js';
import { heatKey } from '../src/sim/heat.js';
import { assert, fmt } from './helpers.mjs';

const yearOf = (ms) => new Date(Date.UTC(2026, 0, 1) + ms).getUTCFullYear();
const ended = (c, days = 60, why = 'completed') => { c.over = { why, ms: c.posting.startMs + days * DAY }; return c; };
const open = (list, kind) => list.filter(o => o.kind === kind && o.ok).map(o => o.city);

export default [
  {
    name: 'postings: a handler\'s posting done: undercover posts offered where your face isn\'t on file (Beirut, Cairo after Moscow), never London; an illegal\'s only under 30',
    fn() {
      const c = ended(newCampaign(5, candidates(5, 'moscow')[0], 'moscow')), L = offers(c, c.over.ms);
      const uc = open(L, 'undercover'), il = open(L, 'illegal'), why = L.find(o => o.kind === 'undercover' && o.city === 'moscow')?.why;
      const young = ageOf(c.character, c.over.ms) < ILLEGAL_AGE;
      assert(uc.join() === 'beirut,cairo' && il.join() === (young ? 'beirut,cairo' : '') && /face/.test(why) && !L.some(o => o.kind !== 'official' && o.city === 'london') && open(L, 'official').length === 4, `undercover ${uc}, illegal ${il}, Moscow: ${why}`);
      // (a first tour's officer, promoted: only stations; a legend's, straight to a legend)
      const J = ended(newCampaign(6, candidates(6, 'london', 'junior')[0], 'london', 'junior'), 90, 'promoted'), LJ = offers(J, J.over.ms);
      const G = ended(newCampaign(6, legendFile(6, 'london', 'junior'), 'london', 'junior'), 90, 'promoted'), LG = offers(G, G.over.ms);
      assert(!open(LJ, 'undercover').length && open(LG, 'undercover').length === 3, `a junior's undercover ${open(LJ, 'undercover')}; a legend's ${open(LG, 'undercover')}`);
      console.log(`      after Moscow: undercover ${uc.join(', ')} (Moscow: ${why}); illegal: ${L.find(o => o.kind === 'illegal').why}; a first tour: ${LJ.filter(o => o.ok).length} stations; a legend's first tour: undercover ${open(LG, 'undercover').join(', ')}`);
      for (const o of L.filter(x => x.ok && x.kind === 'undercover')) console.log(`      ${o.title}: ${o.about} ${o.words}`);
    },
  },
  {
    name: 'postings: a face on file closes a country for good: every station served under official cover, and a trip abroad where they made you',
    fn() {
      const J = newCampaign(8, candidates(8, 'london', 'junior')[0], 'london', 'junior');
      J.done.push({ trip: 'cairo', outcome: 'made', kind: 'tail' }, { trip: 'moscow', outcome: 'clean', kind: 'sdr' });
      ended(J, 90, 'promoted');
      const H = ended(nextPosting(J, 'beirut', 'official'), 70), F = facesOf(H), L = offers(H, H.over.ms);
      assert(F.includes('gb') && F.includes('eg') && F.includes('lb') && !F.includes('ru') && open(L, 'undercover').join() === 'moscow', `faces ${F}; undercover ${open(L, 'undercover')}`);
      console.log(`      London's tour (made on the Cairo trip, clean in Moscow), then Beirut under official cover: faces on file ${F.join(', ')}; undercover open: ${open(L, 'undercover').join(', ')}`);
    },
  },
  {
    name: 'postings: an undercover post chosen: the training (the language to fluent, the skills to their floors), months of the legend lived, day one a Monday that much later, the officer older, no embassy, heat nothing, the legend\'s history on the file',
    fn() {
      const c = ended(newCampaign(11, candidates(11, 'moscow')[1], 'moscow'), 80), F = forecast(c, 'cairo', 'undercover', c.over.ms), n = nextPosting(c, 'cairo', 'undercover'), p = n.posting, R = record(n, p.startMs);
      const age0 = ageOf(c.character, c.over.ms), age1 = ageOf(n.character, p.startMs), months = p.incubation.months;
      assert(isDeep(p) && p.level === 'undercover' && p.legend === 'undercover' && p.embassy.door && p.heat === 0 && heatFloor(p) === 0 && p.alias && n.character.langs.ar === 'fluent', `${p.rank} ${p.alias} door ${p.embassy.door} heat ${p.heat} ar ${n.character.langs.ar}`);
      assert(months >= UNDERCOVER_MONTHS[0] && months <= UNDERCOVER_MONTHS[1] && calendar(p.startMs).weekday === 0 && p.startMs === F.start && age1 > age0, `incubation ${months} months, a ${calendar(p.startMs).weekday}, age ${age0} → ${age1}`);
      assert(n.character.skills.deception[0] >= 14 && R.deep?.life?.length >= 3 && R.past.some(k => /Training/.test(k.rank)) && R.past.some(k => /legend lived/.test(k.rank)), 'the floors, the history, the file');
      console.log(`      ${c.character.name}, Moscow done ${new Date(Date.UTC(2026, 0, 1) + c.over.ms).toISOString().slice(0, 10)} at ${age0}: ${fmt(F.weeks / 52, 1)} years' training, ${months} months as ${p.alias} (${p.jobShort}); day one ${new Date(Date.UTC(2026, 0, 1) + p.startMs).toISOString().slice(0, 10)} at ${age1}. Tasking: ${p.subject}; the way in: ${p.target.place}; the job's standing ${p.cover}`);
      console.log(`      the file: ${R.deep.life.join(' ')}`);
      console.log(`      before: ${R.past.map(k => k.rank).join(' → ')}`);
    },
  },
  {
    name: 'postings: the incubation by the target\'s security and the country\'s counter-intelligence: undercover 3 to 20 months, an illegal 3 to 14 years',
    fn() {
      const rows = [];
      let lo = Infinity, hi = 0, ylo = Infinity, yhi = 0;
      for (const city of DEEP_CITIES) {
        const um = [], iy = [];
        for (let s = 1; s <= 60; s++) { const u = incubationOf(s, city, 'undercover', 3, at(2030, 1, 1)), i = incubationOf(s, city, 'illegal', 3, at(2030, 1, 1)); um.push(u.months); iy.push(i.months / 12); }
        lo = Math.min(lo, ...um); hi = Math.max(hi, ...um); ylo = Math.min(ylo, ...iy); yhi = Math.max(yhi, ...iy);
        const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        rows.push(`${city} (ci ${ciOf(city)}): undercover ${Math.min(...um)}–${Math.max(...um)} months (mean ${fmt(mean(um), 1)}), illegal ${fmt(Math.min(...iy), 1)}–${fmt(Math.max(...iy), 1)} years (mean ${fmt(mean(iy), 1)})`);
      }
      assert(lo >= UNDERCOVER_MONTHS[0] && hi <= UNDERCOVER_MONTHS[1] && ylo >= ILLEGAL_YEARS[0] && yhi <= ILLEGAL_YEARS[1] && hi - lo >= 6, `undercover ${lo}–${hi}, illegal ${ylo}–${yhi}`);
      for (const r of rows) console.log(`      ${r}`);
      console.log(`      their targets: ${Object.entries(DEEP).map(([c, T]) => `${c}: ${T.map(t => `${t.short} ${t.security}`).join(', ')}`).join('; ')}`);
    },
  },
  {
    name: 'postings: the illegal\'s gate: a posting of your own carried out, under 30 (a first tour alone, not yet; a handler\'s done at 26, open but in its own country; at 30, none; sacked, none; a legend at 50, open); the school (two years, or the language to fluent): the floors and Tradecraft 80 at once, fluent at its end, native on day one; the last posting',
    fn() {
      const mk = (age, legend = false) => { const ch = legend ? legendFile(13, 'london', 'junior') : { ...candidates(13, 'london', 'junior')[0] }; ch.age = age; delete ch.born; return ended(newCampaign(13, ch, 'london', 'junior'), 20, 'promoted'); };
      const J = mk(26), tour = offers(J, J.over.ms).find(o => o.kind === 'illegal');
      const H = ended(nextPosting(J, 'moscow', 'official'), 25), il = open(offers(H, H.over.ms), 'illegal');
      const O = ended(nextPosting(mk(29), 'moscow', 'official'), 400), old = offers(O, O.over.ms).find(o => o.kind === 'illegal' && o.city === 'cairo');
      const S = ended(nextPosting(J, 'moscow', 'official'), 40, 'sacked');
      const G = ended(nextPosting(mk(50, true), 'beirut', 'undercover'), 60), lg = open(offers(G, G.over.ms), 'illegal');
      assert(!tour.ok && /of your own/.test(tour.why) && il.join() === 'beirut,cairo' && !old.ok && /under 30/.test(old.why) && !open(offers(S, S.over.ms), 'illegal').length && lg.join() === 'moscow,cairo',
        `the tour alone: ${tour.why}; a handler's at 26: ${il}; at ${ageOf(O.character, O.over.ms)}: ${old.why}; sacked: ${open(offers(S, S.over.ms), 'illegal')}; a legend: ${lg}`);
      const W = forecast(H, 'cairo', 'illegal', H.over.ms), paper = planPaper(H.character, 'cairo', 'illegal', afterPhases(H, 'cairo', 'illegal', H.over.ms));
      const i = nextPosting(H, 'cairo', 'illegal'), p = i.posting, y = p.incubation.months / 12, school = i.career.find(k => k.level === 'training');
      const schoolY = (school.until - school.from) / YEAR;
      assert(p.level === 'illegal' && i.character.os === ILLEGAL_OS && i.character.langs.ar === 'native' && y >= 3 && y <= 14 && i.character.skills.deception[0] === 20 && i.character.skills.medicine[0] >= 14 && schoolY >= 2 && schoolY <= 3.2
        && paper.lines.some(l => /Tradecraft 80/.test(l)) && paper.lines.some(l => /native comes after/.test(l)) && p.life.lines.some(l => /to native in the first/.test(l)), `illegal: Tradecraft ${i.character.os}, ${i.character.langs.ar}, school ${fmt(schoolY, 1)} y, ${fmt(y, 1)} years`);
      ended(i, 400);
      const brought = ended(nextPosting(H, 'cairo', 'illegal'), 400, 'brought');
      assert(!offers(i, i.over.ms).length && careerEnd(brought, brought.over.ms)?.why === 'last', 'the last posting');
      console.log(`      London alone: "${tour.why}"; a handler's posting done at ${ageOf(H.character, H.over.ms)}: illegal in ${il.join(', ')} (Moscow, its face); at ${ageOf(O.character, O.over.ms)}: "${old.why}"; a legend of ${ageOf(G.character, G.over.ms)} after an undercover post: ${lg.join(', ')}`);
      console.log(`      for Cairo: the school ${fmt(schoolY, 1)} years, Tradecraft ${H.character.os} → ${i.character.os}, fluent → native lying low (${p.life.lines.find(l => /to native/.test(l))}), ${fmt(y, 1)} years of it, activated ${yearOf(p.startMs)} at ${ageOf(i.character, p.startMs)}; the paper: "${paper.lines.find(l => /Tradecraft 80/.test(l))}"`);
    },
  },
  {
    name: 'postings: retiring at a posting\'s end past 60, never mid-post; a legend\'s pretext after two postings past the one they started in',
    fn() {
      const old = { ...candidates(21, 'moscow')[0], age: 58 }; delete old.born;
      const c = newCampaign(21, old, 'moscow'), mid = c.posting.startMs + 3 * YEAR;
      const midPost = careerEnd(c, mid);                                   // (no over: still on it)
      ended(c, 3 * 365);
      const E = careerEnd(c, c.over.ms);
      const L = legendFile(22, 'london', 'junior'); L.age = 40; delete L.born;
      let g = ended(newCampaign(22, L, 'london', 'junior'), 90, 'promoted');
      const seen = [];
      for (const [city, kind] of [['moscow', 'undercover'], ['cairo', 'undercover']]) { g = ended(nextPosting(g, city, kind), 100); seen.push(careerEnd(g, g.over.ms)?.why ?? 'on'); }
      assert(E?.why === 'age' && seen.join() === 'on,pretext' && LEGEND_AFTER === 2 && (!midPost || midPost.why === 'age'), `old: ${E?.why}; a legend: ${seen}`);
      console.log(`      58 at the start, three years on (${ageOf(c.character, c.over.ms)}): ${E.words}; a legend from London: after the first undercover ${seen[0]}, after the second: ${careerEnd(g, g.over.ms).words}`);
    },
  },
  {
    name: 'postings: the picker\'s deep rungs: an undercover officer\'s file (Tradecraft 55–69, fluent, a handler\'s posting behind them, never London); its face on file is elsewhere; an illegal\'s gone at under 30 after a first tour, Tradecraft 80',
    fn() {
      const ids = LEVELS.map(l => l.id), out = [];
      for (const city of ['moscow', 'beirut', 'london']) {
        const ch = candidates(31, city, 'undercover')[0], c = newCampaign(31, ch, city, 'undercover'), p = c.posting, F = facesOf(c);
        assert(isDeep(p) && DEEP_CITIES.includes(p.city) && ch.os >= 55 && ch.os <= 69 && c.career[0].level === 'handler' && !F.includes(p.country), `${city}: ${p.city} os ${ch.os} faces ${F}`);
        out.push(`${city} → ${p.city}: ${ch.name} (${ch.os}), as ${p.alias}; before: ${c.career.map(k => `${k.level} ${k.city}`).join(', ')}`);
      }
      const I = candidates(32, 'cairo', 'illegal')[0], ci = newCampaign(32, I, 'cairo', 'illegal');
      const went = ageOf(ci.character, ci.career.find(k => k.level === 'training').from);
      assert(ids.join() === 'junior,handler,undercover,illegal' && I.os === ILLEGAL_OS && I.langs.ar === 'native' && ci.career[0].level === 'junior' && !ci.career.some(k => k.level === 'undercover') && went < ILLEGAL_AGE, `levels ${ids}; illegal ${I.os} ${I.langs.ar}, went at ${went}`);
      console.log(`      ${out.join('; ')}; an illegal's start (debug): ${I.name} (${I.os}, ${I.age} on day one, gone illegal at ${went}), before: ${ci.career.map(k => `${k.level} ${k.city}`).join(', ')}`);
    },
  },
  {
    name: 'postings: the long rivalries: threads a decade and more each, a deep post\'s purpose the one open when it begins; London has none',
    fn() {
      const out = [];
      for (const city of DEEP_CITIES) {
        const T = threads(4, city), spans = T.map(x => (x.to - x.from) / YEAR), P = purposeAt(4, city, at(2031, 3, 1));
        assert(rivalryOf(city) && spans.every(y => y >= 10 && y <= 25) && P.thread && P.rivalry.years > 40, `${city}: ${spans.map(y => fmt(y, 0))}`);
        out.push(`${city}: ${rivalryOf(city).the} (${T.slice(-5).map(x => `${x.thread} ${yearOf(x.from)}–${yearOf(x.to)}`).join(', ')}); 2031: ${P.subject}`);
      }
      assert(!rivalryOf('london') && purposeAt(4, 'london', at(2031, 3, 1)).thread === null, 'London: a tasking, no rivalry');
      for (const l of out) console.log(`      ${l}`);
    },
  },
  {
    name: 'postings: the hub under a legend: the workplace a plain door (its employer\'s plate), the day\'s work done from it (no arch, no Marine), the job\'s standing up, heat at nothing and not watched',
    fn() {
      const c = newCampaign(41, candidates(41, 'beirut', 'undercover')[0], 'beirut', 'undercover');
      const g = newGame({ seed: 41, scenario: 'campaign', campaign: c }), papers = [], bus = { emit: (k, v) => { if (k === 'papers') papers.push(...v); }, on() {} };
      start(g, null);
      for (let t = 0; t < 21; t++) step(g, {}, bus);
      const p = c.posting, cover0 = p.cover;
      assert(g.legend.cover === 'legend' && g.legend.floor === 0 && g.heat[heatKey('embassy', p.country)] === 0 && p.embassy.x !== undefined && p.embassy.door, `legend ${JSON.stringify(g.legend)}`);
      let day = Math.floor(g.time.ms / DAY);
      while (calendar(day * DAY).weekday >= 5) day++;
      g.time.ms = day * DAY + 8.5 * HOUR;
      step(g, { act: ['desk:work'] }, bus);
      for (let t = 0; t < 21; t++) step(g, {}, bus);
      const k = calendar(g.time.ms), logged = c.log.at(-1)?.text ?? '';
      assert(k.hour === 18 && p.cover > cover0 && g.map.kind === 'street' && g.map.row === p.embassy.row && new RegExp(p.employer).test(logged) && !/embassy/i.test(logged), `out at ${k.hour}, cover ${cover0} → ${p.cover}: ${logged}`);
      const team = g.scenario.tail?.team ?? 'none';
      pass(c, g.time.ms, g.time.ms + 5 * DAY);
      assert(team === 'none' && c.posting.heat === 0, `watched ${team}, heat ${c.posting.heat}`);
      console.log(`      ${p.alias} at ${p.employer} (${p.embassy.sign}): out of its door at ${k.hour}:00, the job's standing ${cover0} → ${p.cover}; "${logged}"; watched out of it: ${team}; heat ${c.posting.heat} after five days`);
    },
  },
];
