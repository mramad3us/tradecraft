// TRADECRAFT sim: the campaign (DESIGN.md, The player's loop; Career; Postings, assignments and the
// day; the user, 2026-10-27: "Start working on campaign mode … the onion that is Character life >
// Posting > Assignment generation with the mission types that we tested … make sure the generators
// are well oiled and well defined").
//
// state.campaign is the persistent part of a game (plain data, saved with it): who you are, the
// posting, its people and places, the assignments, the gauges. It rides inside every game state, the
// hub's (sim/scenarios/campaign.js: your city, from your door, the desk) and an assignment's (a
// tested mission run with the campaign's context: sim/scenarios/sdr.js, tail.js); when an assignment
// ends, fold() takes its outcome back into the campaign.
//
// **The character** (candidates()): three generated officers to pick from, each a Handler (the first
// playable's rank: an embassy job, official cover, a network to run), with a background, skills by it,
// a language level in the posting's tongue, a look.
// **The posting** (posting()): a city, its country, the cover (Second Secretary at the embassy), a
// goal (a subject the agency wants intelligence on: SUBJECTS by city), the flat and the embassy (doors
// on the city's streets), safe houses, the network (ASSETS: codenamed, each with a yield and a trust),
// the opposition's targets (TARGETS: who to follow), and the gauges: heat (how much the opposition
// knows; sim/heat.js keeps it per legend and country), cover standing (the embassy's view of your
// work), intelligence (the blue thing: DESIGN.md, Intelligence), money (salary, operational fund).
// **The assignments** (plan()): the posting's schedule, made day by day as days begin, from the
// mission types tested (KINDS): an asset meeting by way of a surveillance detection run (sdr: a bench
// at a time, a window to be there in, the opposition's team by the heat), a tail on a target to his
// meeting (tail: his door, his evening). Each has a window; missed, it costs (an asset's trust; a lead
// gone). The generator keeps them apart (never two at once), on working days' evenings and weekends,
// every few days for each asset and target (CADENCE), one a day at most, and only references people
// and places the posting has.
// **The day** (DAY): the cover job 9:00–18:00 on weekdays (work(): the hours pass, cover standing
// up), sleep (rest(): to 7:00, fatigue gone), lying low (a day, heat down), and the assignment's
// window. Skipping time is the engine's (sim/game.js skip()); the campaign keeps the calendar's
// consequences: pay on the 1st, the week's review on Sunday night (review()).
// **What heat costs** (pass()): an asset met with a tail on you is compromised, and each day after may be
// arrested (ARREST_PER_DAY): gone from the network, heat up. Heat at EXPEL_HEAT and the posting's over:
// declared persona non grata (official cover: expelled, not jailed; DESIGN.md, Career), c.over.
// Lying low at a safe house cools faster (SAFE_LOW_K).
// **The goal** (GOAL_INTEL): the posting is done when the station has the intelligence it wanted, a few
// weeks' work done well; c.over = { why: 'completed' }. **Leads** (DESIGN.md, Intelligence and leads): a
// tail that sees the meeting identifies the contact, who becomes a target of his own (CONTACTS), the
// next step; an asset trusted enough (TRUSTED) brings more (yield 2).
import { stream, int, pick, chance, range, weighted, hash } from './rng.js';
import { sheet, streetLook } from './people.js';
import { at, DAY, HOUR, MIN, calendar } from './clock.js';

export const KINDS = {
  sdr: { name: 'An asset meeting', scenario: 'sdr', about: 'Meet the asset clean: a surveillance detection run to the bench, and only sit down if nobody\'s on you.' },
  tail: { name: 'A tail', scenario: 'tail', about: 'Follow the target from his door to whoever he meets, and don\'t be seen.' },
  watch: { name: 'A photograph', scenario: 'watch', about: 'Photograph the target at his meeting, and don\'t let his minder see you do it.' },
};
/** Days between one asset's meetings, and between tails on one target. */
export const CADENCE = { sdr: [3, 6], tail: [4, 8], watch: [5, 9] };
export const WORK = { from: 9, to: 18 };
export const WAKE_H = 7;
export const COVER_PER_DAY = 6;                                   // (a day's work at the embassy, cover standing up)
export const COVER_MISSED = 10;                                   // (a working day missed)
export const HEAT_LOW_PER_DAY = 6;                                // (a day lying low)
export const SAFE_LOW_K = 1.7;                                     // (… at a safe house)
export const ARREST_PER_DAY = 0.25;
export const EXPEL_HEAT = 95;
export const GOAL_INTEL = 10;                                  // (six or seven good operations: two or three weeks, done well)
export const TRUSTED = 4;
const CONTACTS = ['Kirill Belov', 'Arkady Shubin', 'Yuri Golovin', 'Stanislav Vetrov', 'Mikhail Danilov'];
export const SALARY = 7200;
export const TRAVEL = { waitMin: 6, perRowMin: 4 };                 // (the metro or a taxi: a wait, and minutes a street away)                                        // ($ a month, after tax: a GS-12)
export const FUND = 2500;                                          // ($ the operational fund, a month)

const CITY = {
  moscow: { country: 'ru', lang: 'ru', embassy: 'US Embassy', cover: 'Second Secretary, Political Section, US Embassy', service: 'the FSB' },
  london: { country: 'gb', lang: 'en', embassy: 'US Embassy', cover: 'First Secretary, Economic Section, US Embassy', service: 'the Russian residency' },
  beirut: { country: 'lb', lang: 'ar', embassy: 'US Embassy', cover: 'Second Secretary, Political Section, US Embassy', service: 'Hezbollah\'s security' },
  cairo: { country: 'eg', lang: 'ar', embassy: 'US Embassy', cover: 'Second Secretary, Political Section, US Embassy', service: 'the GIS' },
};
/** What the agency wants from a posting, by city: [subject, what it means]. */
export const SUBJECTS = {
  moscow: [['sanctions evasion', 'who in the Kremlin\'s circle moves money and chips past the sanctions, and how'], ['the hypersonic programme', 'how far the new missile has come, and who builds it'],
    ['Unit 29155', 'the GRU unit behind the sabotage in Europe: its officers, its next targets']],
  london: [['the oligarchs\' money', 'whose fortunes in London are the Kremlin\'s, held in trust'], ['the residency', 'the Russian intelligence officers under diplomatic cover, and whom they run']],
  beirut: [['the arms routes', 'how Iran\'s weapons reach Lebanon, by which ports and whose trucks'], ['the hostages', 'who holds the two Westerners taken in the spring, and where']],
  cairo: [['the arms deals', 'what Egypt buys, from whom, paid how'], ['the Sinai networks', 'the jihadist cells in Sinai: their couriers in the city']],
};
const CODENAMES = ['SOLOVEY', 'ZHURAVL', 'SKVORETS', 'KUKUSHKA', 'SINITSA', 'GRACH', 'SOKOL', 'DROZD'];
const ROLES = ['a ministry clerk', 'a defence engineer', 'a banker\'s assistant', 'a journalist', 'a customs officer', 'a translator at a state firm'];
const MOTIVES = ['money', 'ideology', 'ego', 'revenge'];
// What a life before the Agency brings (the user, 2026-10-27: "background should impact starting skills by up
// to +4 points (an ex marine would know how to fight)"): points on top of the training, BG_MAX at most a
// skill, kept apart on the sheet (p.bg: ◆, where practice is •).
export const BG_MAX = 4;
export const BACKGROUNDS = [
  { id: 'marine', text: 'A Marine infantry officer, two tours, then the Farm: knows how to fight, and how to keep going.', skills: { cqc: 4, weapons: 4, fitness: 3, awareness: 1 } },
  { id: 'army', text: 'Army intelligence, then the Farm: a linguist who learned to walk a street.', skills: { awareness: 3, tracking: 2, cqc: 2, fitness: 2 } },
  { id: 'police', text: 'A city detective once: patient on a street, hard to lose, handy in a scuffle.', skills: { tracking: 4, awareness: 2, cqc: 3 } },
  { id: 'econ', text: 'An economist out of Treasury: reads a balance sheet like a face.', skills: { analysis: 4, social: 2, deception: 1 } },
  { id: 'state', text: 'Four years at State before the Agency took them: at home at a reception.', skills: { social: 4, deception: 2, awareness: 1 } },
  { id: 'medic', text: 'A Navy corpsman before the Farm: steady hands, steadier nerves.', skills: { medicine: 4, fitness: 2, awareness: 1 } },
  { id: 'journo', text: 'A foreign correspondent, recruited in Istanbul: knows how to ask.', skills: { social: 3, deception: 3, pathfinding: 1 } },
  { id: 'nsa', text: 'An engineer at NSA who wanted to see the other end of the wire.', skills: { tech: 4, analysis: 3, awareness: 1 } },
  { id: 'wrestler', text: 'A college wrestler, then the Peace Corps in the Caucasus: strong, and at home anywhere.', skills: { fitness: 4, cqc: 3, social: 1, pathfinding: 1 } },
];
const US = { f: ['Rebecca', 'Laura', 'Megan', 'Claire', 'Diane', 'Hannah', 'Julia', 'Sarah'], m: ['Daniel', 'Michael', 'Thomas', 'Andrew', 'Mark', 'Peter', 'James', 'Robert'],
  family: ['Price', 'Walker', 'Brennan', 'Hollis', 'Mercer', 'Dalton', 'Keane', 'Whitlock', 'Sutton', 'Garrett'] };

/** Three officers to pick from, from the campaign's seed. */
export function candidates(seed, city = 'moscow') {
  const r = stream('candidates', seed), used = new Set();
  return [0, 1, 2].map(i => {
    const sex = i === 0 ? 'f' : i === 1 ? 'm' : chance(r, 0.5) ? 'f' : 'm';
    let bg; do bg = pick(r, BACKGROUNDS); while (used.has(bg.id)); used.add(bg.id);
    const age = 29 + int(r, 14);
    const base = { deception: [10, int(r, 3)], tracking: [10, int(r, 3)], pathfinding: [10, int(r, 3)], awareness: [10, int(r, 3)], social: [10, int(r, 3)],
      analysis: [5, int(r, 3)], tech: [5, int(r, 2)], medicine: [5, 0], cqc: [5, 1 + int(r, 2)], weapons: [5, int(r, 2)], fitness: [5, 1 + int(r, 3)] };
    const points = Object.fromEntries(Object.entries(bg.skills).map(([k, v]) => [k, Math.min(BG_MAX, v)]));
    for (const [k, v] of Object.entries(points)) base[k] = [base[k][0], Math.min(9, base[k][1] + v)];
    const lang = CITY[city]?.lang ?? 'ru';
    const p = sheet({ id: 'me', name: `${pick(r, US[sex])} ${pick(r, US.family)}`, sex, cls: 'spook', os: 30 + int(r, 16), skills: base,
      langs: { en: 'native', ...(lang !== 'en' ? { [lang]: pick(r, ['working', 'working', 'fluent']) } : {}) }, persistent: true });
    p.age = age;
    p.background = bg.text;
    p.bg = { id: bg.id, points };                                   // (of the dots, these are the background's: the sheet shows them apart)
    p.look = { skin: pick(r, ['light', 'light', 'tan', 'brown']), hair: { style: sex === 'f' ? pick(r, ['bun', 'long']) : chance(r, age > 38 ? 0.25 : 0.05) ? 'bald' : 'short', color: pick(r, [0x2a1c18, 0x47302a, 0x6b4636, 0x14151c, 0xb9862e]) },
      top: { kind: 'coat', color: pick(r, [0x353947, 0x4c5262, 0x47302a, 0x23252f]), trim: 0x23252f }, legs: 0x23252f, shoes: 0x14151c };
    return p;
  });
}

/** The posting: city, cover, goal, the network and the targets, the flat, the embassy, safe houses, gauges. startMs: day one, morning. */
export function posting(seed, city = 'moscow', startMs = at(2026, 11, 2, WAKE_H)) {
  const r = stream('posting', seed, city), C = CITY[city] ?? CITY.moscow;
  const [subject, goal] = pick(r, SUBJECTS[city] ?? SUBJECTS.moscow);
  const mapSeed = Math.floor(range(r, 0, 4294967296));
  const names = CODENAMES.slice();
  const assets = [0, 1].slice(0, 1 + (chance(r, 0.5) ? 1 : 0)).map(i => {
    const codename = names.splice(int(r, names.length), 1)[0], sex = chance(r, 0.35) ? 'm' : 'm';   // (men for now: the scenes' words say he of an asset)
    return { id: `asset${i}`, codename, sex, role: pick(r, ROLES), motive: pick(r, MOTIVES), trust: 2 + int(r, 2), yield: 1, look: streetLook(r, sex, 35 + int(r, 25)), met: 0, last: null };
  });
  const targets = [{ id: 'target0', name: pick(r, ['Gennady Orlov', 'Viktor Lazarev', 'Oleg Sorokin', 'Pavel Rudnev']), what: `an officer of ${C.service}, under commercial cover`, wary: chance(r, 0.3), followed: 0, last: null, contact: null }];
  return {
    city, country: C.country, agency: 'CIA', rank: 'Handler', job: C.cover, legend: 'embassy', subject, goal,
    // (the embassy on the street the missions start from, "out of the embassy"; the flat a few streets off)
    mapSeed, home: { id: 'home', row: 2 + int(r, 2), label: 'the flat' }, embassy: { id: 'embassy', row: 0, label: C.embassy },
    safehouses: [{ id: 'sh0', row: 1 + int(r, 2), label: 'a flat above a pharmacy', known: true, burned: false }, { id: 'sh1', row: -3 - int(r, 2), label: 'a garage in a courtyard', known: true, burned: false }],
    assets, targets, startMs,
    heat: 20, cover: 70, intelligence: 0, money: { salary: SALARY, fund: FUND, paid: calendar(startMs).month },
  };
}

/** A new campaign: the chosen character, the posting, day one. */
export function newCampaign(seed, character, city = 'moscow') {
  const p = posting(seed, city);
  const c = { seed, character, posting: p, day: dayOf(p.startMs), assignments: [], done: [], plannedTo: dayOf(p.startMs) - 1, worked: {}, log: [], reviews: [], awake: p.startMs, next: { } };
  plan(c, p.startMs);
  return c;
}

export const dayOf = (ms) => Math.floor(ms / DAY);
const weekday = (ms) => calendar(ms).weekday;                      // 0 Monday … 6 Sunday
const isWorkday = (ms) => weekday(ms) < 5;

/**
 * Plan the assignments through the day of `ms` and the six after (a week ahead, as a schedule is):
 * for each asset a meeting every CADENCE.sdr days, for each target a tail every CADENCE.tail, each on an
 * evening (after work) or a weekend afternoon, never two at once, never in the past.
 */
export function plan(c, ms) {
  const p = c.posting, to = dayOf(ms) + 6;
  for (let d = c.plannedTo + 1; d <= to; d++) {
    const r = stream('plan', c.seed, d), dayMs = d * DAY;
    const busy = (from, until) => c.assignments.some(a => a.status === 'open' && a.from < until && a.to > from);
    const slot = (h0, h1) => { for (let k = 0; k < 8; k++) { const from = dayMs + Math.round(range(r, h0, h1) * 60) * MIN; if (!busy(from - 30 * MIN, from + 3 * HOUR)) return from; } return null; };
    const evening = isWorkday(dayMs) ? [18.5, 20.5] : [14, 19];
    const taken = () => c.assignments.some(a => dayOf(a.from) === d);   // (one a day: two meetings in an evening is how networks get rolled up)
    for (const s of p.assets) {
      const due = (s.nextDay ??= dayOf(p.startMs) + 1 + int(r, 2));
      if (d < due) continue;
      if (taken()) { s.nextDay = d + 1; continue; }
      const from = slot(...evening);
      if (from === null) { s.nextDay = d + 1; continue; }
      c.assignments.push({ id: `a${hash(c.seed, d, s.id) % 1e7}`, kind: 'sdr', who: s.id, from, to: from + 15 * MIN, start: from - Math.round(range(r, 25, 40)) * MIN, status: 'open',
        brief: `Meet ${s.codename} (${s.role}) on a boulevard bench, between ${hm(from)} and ${hm(from + 15 * MIN)}. Clean, or not at all.` });
      s.nextDay = d + CADENCE.sdr[0] + int(r, CADENCE.sdr[1] - CADENCE.sdr[0] + 1);
    }
    for (const t of p.targets) {
      const due = (t.nextDay ??= dayOf(p.startMs) + 2 + int(r, 3));
      if (d < due) continue;
      if (taken()) { t.nextDay = d + 1; continue; }
      const from = slot(...(isWorkday(dayMs) ? [17.5, 19.5] : [15, 18]));
      if (from === null) { t.nextDay = d + 1; continue; }
      c.assignments.push({ id: `a${hash(c.seed, d, t.id) % 1e7}`, kind: 'tail', who: t.id, from, to: from + 20 * MIN, start: from, status: 'open',
        brief: `${t.name}, ${t.what}, leaves his office at ${hm(from)}. Follow him to whoever he meets. Don't be seen.` });
      t.nextDay = d + CADENCE.tail[0] + int(r, CADENCE.tail[1] - CADENCE.tail[0] + 1);
    }
    // (a target seen meeting someone: the station knows where he meets now, and wants the photograph)
    for (const t of p.targets) {
      if (!t.contact || d < (t.photoDay ??= d + 2 + int(r, 2))) continue;
      if (taken()) { t.photoDay = d + 1; continue; }
      const from = slot(...(isWorkday(dayMs) ? [12.5, 14] : [13, 17]));
      if (from === null) { t.photoDay = d + 1; continue; }
      c.assignments.push({ id: `a${hash(c.seed, d, t.id, 'photo') % 1e7}`, kind: 'watch', who: t.id, from, to: from + 15 * MIN, start: from - 10 * MIN, status: 'open',
        brief: `${t.name} meets someone outside a café, between ${hm(from)} and ${hm(from + 15 * MIN)}. A photograph of the two of them; his minder mustn't see you take it.` });
      t.photoDay = d + CADENCE.watch[0] + int(r, CADENCE.watch[1] - CADENCE.watch[0] + 1);
    }
  }
  c.plannedTo = Math.max(c.plannedTo, to);
  c.assignments.sort((a, b) => a.from - b.from);
}
const hm = (ms) => { const k = calendar(ms); return `${String(k.hour).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`; };

/** The open assignments at time ms: [{ a, state: 'later' | 'now' | 'missed' }]; the missed are marked (and cost), once. */
export function agenda(c, ms) {
  for (const a of c.assignments) if (a.status === 'open' && ms > a.to) miss(c, a);
  return c.assignments.filter(a => a.status === 'open').map(a => ({ a, when: ms < a.start ? 'later' : 'now' }));
}

/** An assignment missed: what it costs (an asset waited for nothing; a target's evening gone unseen). */
function miss(c, a) {
  a.status = 'missed';
  const p = c.posting;
  if (a.kind === 'sdr') { const s = p.assets.find(x => x.id === a.who); if (s) s.trust = Math.max(-5, s.trust - 1); }
  c.log.push({ ms: a.to, text: a.kind === 'sdr' ? `Missed: ${who(c, a)} waited on the bench for nothing. Trust down.` : `Missed: ${who(c, a)}'s evening, unwatched.` });
  c.done.push(a);
}
const who = (c, a) => (a.kind === 'sdr' ? c.posting.assets.find(x => x.id === a.who)?.codename : c.posting.targets.find(x => x.id === a.who)?.name) ?? 'someone';

/**
 * Time passes in the campaign, from `from` to `to` (ms): the working days missed or worked (worked:
 * by work()), pay on the 1st, the week's review on Sunday night, the plan a week ahead, the missed
 * assignments. Returns the papers it made ([{ kind, title, lines }]).
 */
export function pass(c, from, to) {
  const p = c.posting, papers = [];
  for (let d = dayOf(from); d < dayOf(to); d++) {
    const dayMs = d * DAY;
    if (isWorkday(dayMs) && !c.worked[d] && d >= dayOf(p.startMs)) { p.cover = Math.max(0, p.cover - COVER_MISSED); c.log.push({ ms: dayMs + 18 * HOUR, text: 'A working day missed at the embassy. Someone noticed.' }); }
    const next = calendar((d + 1) * DAY);
    if (next.day === 1 && next.month !== p.money.paid) { p.money.paid = next.month; p.money.bank = (p.money.bank ?? 0) + p.money.salary; p.money.fundLeft = p.money.fund; papers.push({ kind: 'pay', title: 'PAY', lines: [`Salary in: $${p.money.salary}.`, `The operational fund topped up to $${p.money.fund}.`] }); }
    if (weekday(dayMs) === 6) papers.push(review(c, dayMs));
    p.heat = Math.max(20, p.heat - 1);                              // (a day goes by: the opposition's interest cools a little)
    // (a compromised asset may be taken; heat at the top, and you're out)
    const ar = stream('arrest', c.seed, d);
    for (const s of p.assets.filter(x => x.burned && !x.arrested)) if (chance(ar, ARREST_PER_DAY)) {
      s.arrested = dayMs; p.heat = Math.min(100, p.heat + 10);
      papers.push({ kind: 'news', title: `${s.codename}: ARRESTED`, lines: [`The evening news: ${s.role} detained on suspicion of espionage.`, `${s.codename} won't make the next signal, or any. Whoever followed you to the bench made sure of that.`, 'Heat up. The station will want to know how.'] });
      c.log.push({ ms: dayMs + 20 * HOUR, text: `${s.codename} arrested.` });
    }
    if (p.heat >= EXPEL_HEAT && !c.over) {
      c.over = { ms: dayMs + 11 * HOUR, why: 'expelled' };
      papers.push({ kind: 'over', title: 'PERSONA NON GRATA', lines: ['The Foreign Ministry summons the ambassador: you have forty-eight hours to leave the country.', 'Immunity keeps you out of a cell. It doesn\'t keep the posting. Whatever you built here, someone else will have to rebuild.'] });
    }
  }
  plan(c, to);
  agenda(c, to);
  c.posting.assets = p.assets.filter(s => !s.arrested);
  return papers;
}

/** The cover job: from ms to 18:00 (if it's a working day and before then). Returns the time after. */
export function work(c, ms) {
  const k = calendar(ms), d = dayOf(ms);
  if (!isWorkday(ms) || k.hour >= WORK.to) return ms;
  const until = d * DAY + WORK.to * HOUR;
  c.worked[d] = true;
  c.posting.cover = Math.min(100, c.posting.cover + COVER_PER_DAY);
  c.log.push({ ms: until, text: 'A day at the embassy: cables, a meeting about a meeting, the ambassador\'s mood.' });
  return until;
}

/** Sleep: to WAKE_H next morning (or this morning, before it). Fatigue gone. Returns the time after. */
export function rest(c, ms) {
  const d = dayOf(ms), k = calendar(ms);
  const until = (k.hour < WAKE_H ? d : d + 1) * DAY + WAKE_H * HOUR;
  c.awake = until;
  return until;
}

/** Lie low for a day: heat down. Returns the time after (the next morning). */
export function lieLow(c, ms, safe = false) {
  c.posting.heat = Math.max(20, c.posting.heat - Math.round(HEAT_LOW_PER_DAY * (safe ? SAFE_LOW_K : 1)));
  c.log.push({ ms, text: 'A day of nothing: the flat, the embassy canteen, a walk that goes nowhere. Let them get bored.' });
  return rest(c, ms + 12 * HOUR);
}

/** The posting's places one can go to: home, the embassy, the safe houses not burned. [{ id, row, label }]. */
export const places = (c) => [c.posting.home, c.posting.embassy, ...c.posting.safehouses.filter(s => !s.burned)];

/** How long getting from row a to row b takes (ms), and how it's done, in words. */
export function trip(a, b, rng) {
  const rows = Math.abs(a - b), min = TRAVEL.waitMin + rows * TRAVEL.perRowMin;
  const how = rows <= 1 ? 'on foot, the long way round' : rows <= 3 ? 'two stops on the metro' : 'a taxi, the driver silent for once';
  return { ms: min * MIN, how };
}

export const TIRED_H = 16;
export const EXHAUSTED_H = 20;
/** Hours awake since the last sleep, and what it costs every skill (DESIGN.md, Needs): { h, v, word }. */
export function fatigue(c, ms) {
  const h = (ms - (c.awake ?? ms)) / HOUR;
  return { h, v: h > EXHAUSTED_H ? -3 : h > TIRED_H ? -1 : 0, word: h > EXHAUSTED_H ? 'exhausted' : h > TIRED_H ? 'tired' : null };
}

/** The week's review: intelligence against expected, heat, cover standing, assets kept. */
export function review(c, dayMs) {
  const p = c.posting, week = c.done.filter(a => a.ended && a.ended > dayMs - 7 * DAY);
  const intel = week.reduce((n, a) => n + (a.intel ?? 0), 0), expected = 1;
  const grade = intel >= expected + 1 && p.heat < 40 ? 'Excellent' : intel >= expected && p.heat < 55 ? 'Good' : intel > 0 ? 'Adequate' : 'Poor';
  c.reviews.push({ ms: dayMs, grade, intel });
  return { kind: 'review', title: `THE WEEK: ${grade.toUpperCase()}`, lines: [`Intelligence: ${intel} (expected ${expected}).`, `Heat: ${heatWord(p.heat)}. Cover standing: ${p.cover}.`, `The network: ${p.assets.map(s => `${s.codename}, trust ${s.trust}`).join('; ')}.`] };
}
export const heatWord = (h) => (h < 30 ? 'quiet' : h < 45 ? 'noticed' : h < 60 ? 'watched' : h < 75 ? 'hot' : 'burning');

/**
 * The context an assignment's scene is set up with (its setup(state, { campaign })): the character,
 * the city, the time, and the assignment's own: an asset's codename and look, the opposition's team
 * by the heat; a target's name and wariness.
 */
export function context(c, a) {
  const p = c.posting, r = stream('ctx', c.seed, a.id);
  const ctx = { campaign: true, player: structuredClone(c.character), mapSeed: p.mapSeed, startMs: a.start, assignment: a.id, city: p.city, country: p.country };
  if (a.kind === 'sdr') {
    const s = p.assets.find(x => x.id === a.who);
    // (the heat says how hard they're on you: nobody, an overt pair, a covert team)
    const team = weighted(r, [['none', Math.max(1, 70 - p.heat)], ['overt', 20 + p.heat * 0.3], ['covert', Math.max(0, p.heat - 25)]]);
    Object.assign(ctx, { asset: { codename: s.codename, look: s.look, sex: s.sex, role: s.role }, meetFrom: a.from, team, heat: p.heat });
  } else if (a.kind === 'tail' || a.kind === 'watch') {
    const t = p.targets.find(x => x.id === a.who);
    Object.assign(ctx, { target: { name: t.name, what: t.what }, wary: t.wary || t.followed > 2, heat: p.heat, meetFrom: a.from, meetTo: a.to });
  }
  return ctx;
}

/**
 * An assignment's scene is over: its outcome (state.scenario.outcome) into the campaign: intelligence,
 * heat, an asset's trust, a target's wariness, the character's body (wounds, blood, what they carry),
 * the time. Returns a paper ({ title, lines }).
 */
export function fold(c, a, sc, player, endMs, heatNow) {
  const p = c.posting;
  a.status = 'done'; a.ended = endMs; a.outcome = sc.outcome;
  c.done.push(a);
  c.character = { ...structuredClone(player), id: 'me' };
  const lines = [];
  if (heatNow !== undefined) p.heat = Math.max(20, Math.min(100, heatNow));
  if (a.kind === 'sdr') {
    const s = p.assets.find(x => x.id === a.who);
    // (being tailed's endings, sim/scenarios/sdr.js: clean, burned, right, needless, missed)
    if (sc.outcome === 'clean') {
      a.intel = s.yield; p.intelligence += s.yield; s.trust = Math.min(5, s.trust + 1); s.met++;
      lines.push(`${s.codename} handed it over, and nobody saw: intelligence +${s.yield}. Trust up.`);
      if (s.trust >= TRUSTED && s.yield < 2) { s.yield = 2; lines.push(`${s.codename} trusts you now: from here on, more of what matters.`); }
    }
    else if (sc.outcome === 'burned') { a.intel = s.yield; p.intelligence += s.yield; s.trust = Math.max(-5, s.trust - 2); p.heat = Math.min(100, p.heat + 10); s.burned = true; lines.push(`You met ${s.codename} with a tail on you. The intelligence is yours (+${s.yield}); ${s.codename}'s face is theirs. Heat up; the asset is at risk.`); }
    else if (sc.outcome === 'right') lines.push(`You called it off, and you were right: they were on you. ${s.codename} is safe, and will wait for the next signal.`);
    else if (sc.outcome === 'needless') { s.trust = Math.max(-5, s.trust - 1); lines.push(`You called it off, and nobody was on you. ${s.codename} waited, and wonders why. Trust down.`); }
    else { s.trust = Math.max(-5, s.trust - 1); lines.push(`${s.codename} waited for nothing. Trust down.`); }
  } else if (a.kind === 'tail') {
    const t = p.targets.find(x => x.id === a.who);
    t.followed++;
    if (sc.outcome === 'seen') {
      a.intel = 1; p.intelligence += 1; t.contact = (t.contact ?? 0) + 1;
      lines.push(`You saw ${t.name} meet his contact: intelligence +1.`);
      // (a lead: the contact identified, a man to watch in his own right)
      if (!t.led && p.targets.length < 3) {
        const r = stream('lead', c.seed, a.id), name = CONTACTS.filter(n => !p.targets.some(x => x.name === n))[int(r, 3)];
        p.targets.push({ id: `target${p.targets.length}`, name, what: `the man ${t.name} met, by the photograph the station matched`, wary: false, followed: 0, last: null, contact: null, nextDay: Math.floor(endMs / DAY) + 2 });
        t.led = true;
        lines.push(`A lead: the station puts a name to the man he met, ${name}. He'll be worth an evening of your own.`);
      }
    }
    // (the tail's endings, sim/scenarios/tail.js: seen, lost, made, blown)
    else if (sc.outcome === 'made' || sc.outcome === 'blown') { t.wary = true; p.heat = Math.min(100, p.heat + (sc.outcome === 'blown' ? 12 : 6)); lines.push(`${t.name} made you. He'll be careful now, and someone will hear of it.`); }
    else lines.push(`${t.name} got away from you.`);
  } else if (a.kind === 'watch') {
    const t = p.targets.find(x => x.id === a.who);
    // (the photograph's endings, sim/scenarios/watch.js: photo, soft, seen, missed, blown)
    const intel = { photo: 2, soft: 1, seen: 1 }[sc.outcome] ?? 0;
    if (intel) { a.intel = intel; p.intelligence += intel; }
    if (sc.outcome === 'photo') lines.push(`A sharp print of ${t.name} and the man he met: intelligence +2. The station will put a name to the face.`);
    else if (sc.outcome === 'soft') lines.push(`A soft print, but it's ${t.name} and someone: intelligence +1.`);
    else if (sc.outcome === 'seen') lines.push(`No photograph, but you saw ${t.name}'s meeting: intelligence +1.`);
    else if (sc.outcome === 'blown') { t.wary = true; p.heat = Math.min(100, p.heat + 8); lines.push(`His minder made you. ${t.name} will meet somewhere else now, and someone will hear of a man with a camera.`); }
    else lines.push(`${t.name}'s meeting happened where you weren't looking.`);
  }
  if (p.intelligence >= GOAL_INTEL && !c.over) { c.over = { ms: endMs, why: 'completed' }; lines.push(`That's what the station needed on ${p.subject}. The cable home is a short one: done.`); }
  plan(c, endMs);
  return { title: `${KINDS[a.kind].name.toUpperCase()}: ${String(sc.outcome ?? 'over').toUpperCase()}`, lines };
}
