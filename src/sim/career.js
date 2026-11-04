// TRADECRAFT sim: the time between postings (the user, 2026-11-04: "we should track the year in game, because between
// stations, there may be mandatory trainings and long periods of time can pass"; "to take a regular officer post in a
// country we require at least working language training (in the local language) to get thrown in, which means as long
// as necessary to learn it (time skip between postings as we pick the posting). To be an undercover officer or illegal we
// need fluent level"). The years go by in a career, and the officer ages with them.
//
// **Between postings** (between()): home leave (LEAVE_WEEKS), then the language school (the Foreign Service Institute's)
// for as long as the next station's language takes to the level its post needs (NEED: working under official cover,
// fluent undercover): weeks by the language's FSI category (LANG_WEEKS: to working from nothing; from basic, the rest;
// fluent, FLUENT_K more), full time. A station whose language you have already: leave, and straight on.
// **Age** (ageOf()): the file's age at the campaign's start, and the years gone by since (p.born, set once: born()).
import { DAY } from './clock.js';
import { cityById } from './cities/index.js';
import { LANG_LEVELS } from './skills.js';
import { LANG_NAME } from './langs.js';
import { hash } from './rng.js';

export const YEAR = 365.25 * DAY, WEEK = 7 * DAY, LEAVE_WEEKS = 3;
// (weeks of full-time study to working proficiency from nothing, by the FSI's categories: I 30, II 36, III 44, IV 88)
export const LANG_WEEKS = { fr: 30, es: 30, it: 30, pt: 30, de: 36, ru: 44, fa: 44, hi: 44, hy: 44, pl: 44, ar: 88, zh: 88, en: 0 };
export const BASIC_K = 0.25, FLUENT_K = 0.8, NATIVE_K = 1;
// (an illegal's is native: no accent, nothing (the user, 2026-10-26); the last step a year and more of living in it, NATIVE_K of the category's weeks)
export const NEED = { official: 'working', undercover: 'fluent', illegal: 'native' };

/** Weeks of full-time language school from level `have` to `want` in lang (0 if you have it). */
export function langWeeks(lang, have = 'none', want = 'working') {
  const W = LANG_WEEKS[lang] ?? 44, at = Math.max(0, LANG_LEVELS.indexOf(have ?? 'none')), to = LANG_LEVELS.indexOf(want);
  if (at >= to) return 0;
  const step = { basic: BASIC_K * W, working: (1 - BASIC_K) * W, fluent: FLUENT_K * W, native: NATIVE_K * W };
  let weeks = 0;
  for (let i = at + 1; i <= to; i++) weeks += step[LANG_LEVELS[i]] ?? 0;
  return Math.round(weeks);
}

/** The time before a station: { lang, langName, have, need, langW, leaveW, weeks }. cover: 'official' | 'undercover' | 'illegal'. */
export function between(character, city, cover = 'official') {
  const lang = cityById(city).lang, have = character?.langs?.[lang] ?? 'none', need = NEED[cover] ?? 'working';
  const langW = lang === 'en' ? 0 : langWeeks(lang, have, need);
  return { lang, langName: LANG_NAME[lang] ?? lang, have, need, langW, leaveW: LEAVE_WEEKS, weeks: LEAVE_WEEKS + langW };
}
/** The time before a station, in a line for the picker. */
export function betweenWords(character, city, cover = 'official') {
  const b = between(character, city, cover);
  if (!b.langW) return `${b.leaveW} weeks' home leave, then out: ${b.lang === 'en' ? 'the language is yours' : `your ${b.langName} is ${b.have}`}.`;
  const t = b.langW >= 52 ? `${Math.round(b.langW / 52 * 10) / 10} years` : `${b.langW} weeks`;
  return `${b.leaveW} weeks' home leave, then ${t} of ${b.langName} at the Foreign Service Institute, to ${b.need}.`;
}

// **The plan, as a paper** (plan(), planPaper(): the user, 2026-11-04, "make them fit whatever we're doing"): each phase,
// where and for how long, in its own words: the leave, the Institute's language; and for an undercover or an illegal
// post (0.2's: sim/postings.js), the language to fluent and the skills to the post's floors (FLOORS: an illegal's the
// core four to master, close combat, fitness and the gun to 18, the rest to 14), each phase with the people who'd teach
// it (SCHOOLS), at WEEKS_PER_POINT a point, harder the higher it is.
// (an undercover officer's, 0.2's: the core four and Social a few points past a handler's 10, Deception most: a year and a little
// more of it for a handler, nothing for a legend; docs/POSTINGS.md)
export const FLOORS = { illegal: { deception: 20, tracking: 20, pathfinding: 20, awareness: 20, cqc: 18, fitness: 18, weapons: 18, social: 14, analysis: 14, tech: 14, medicine: 14 },
  undercover: { deception: 14, awareness: 13, tracking: 12, pathfinding: 12, social: 12 } };
export const WEEKS_PER_POINT = (base) => 2 + 0.25 * base;
// (the illegal's branch, the user, 2026-11-04: "we'll ask for a successful posting and age under 30, illegal being a career ending
// move, officers won't be expecting to get out of alive ... their tradecraft is boosted to 80 as they end their illegal training":
// offered under ILLEGAL_AGE at a posting done well, sim/postings.js; Tradecraft at least ILLEGAL_OS when the training ends)
export const ILLEGAL_OS = 80, ILLEGAL_AGE = 30;
// (who teaches what, for a post where nobody comes for you: the phase's name, its place, its line)
const SCHOOLS = [
  { skills: ['tracking', 'awareness'], who: 'with the Secret Service\'s protective detail school', line: 'watching crowds for the one face that matters, and being that face' },
  { skills: ['deception', 'pathfinding'], who: 'on the Farm\'s long course, the one that isn\'t on the syllabus', line: 'a year as somebody else in a city that isn\'t told, and a team trying to catch you at it' },
  { skills: ['cqc', 'fitness'], who: 'with Delta\'s selection cadre at Bragg', line: 'until the body stops arguing' },
  { skills: ['weapons'], who: 'with Ground Branch', line: 'every gun you might find over there, and every way it can fail you' },
  { skills: ['medicine'], who: 'in a trauma bay in Baltimore, nights', line: 'other people\'s blood, until your hands stop shaking in it' },
  { skills: ['tech'], who: 'in the Directorate of Science and Technology\'s workshops', line: 'locks, radios, cameras, and the things you build from what\'s in a hardware shop' },
  { skills: ['social', 'analysis'], who: 'at the Sherman Kent School, and on a borrowed embassy\'s cocktail circuit', line: 'reading rooms, and reading people in them' },
];
/** The training before a post: [{ what, where, weeks, line }] (home leave, the language; undercover or an illegal's, the skills to FLOORS). */
export function plan(character, city, cover = 'official') {
  const out = [{ what: 'home leave', where: null, weeks: LEAVE_WEEKS, line: 'boxes, a dentist, people who ask what it\'s like and don\'t want to know' }];
  const lang = cityById(city).lang, need = NEED[cover] ?? 'working', have = character?.langs?.[lang] ?? 'none';
  const lw = lang === 'en' ? 0 : langWeeks(lang, have, need);
  if (lw) out.push({ what: `${LANG_NAME[lang] ?? lang} to ${need}`, where: need === 'native' ? 'at the Institute, then a year and more abroad among its speakers, under a name not your own' : 'at the Foreign Service Institute, Arlington', weeks: lw,
    line: need === 'native' ? 'until a stranger in a queue there would take you for one of them, and your dreams have no accent' : need === 'fluent' ? 'until you dream in it, and the instructors stop correcting your accent' : 'grammar in the morning, newspapers in the afternoon, a teacher who won\'t speak English to you' });
  const F = FLOORS[cover];
  if (F) for (const S of SCHOOLS) {
    let weeks = 0;
    for (const k of S.skills) { const b = (character?.skills?.[k]?.[0] ?? 0); for (let v = b; v < (F[k] ?? 0); v++) weeks += WEEKS_PER_POINT(v); }
    if (weeks) out.push({ what: S.skills.map(k => SKILL_NAMES[k] ?? k).join(' and '), where: S.who, weeks: Math.round(weeks), line: S.line });
  }
  return out;
}
const SKILL_NAMES = { deception: 'Deception', tracking: 'Tracking', pathfinding: 'Pathfinding', awareness: 'Awareness', social: 'Social', analysis: 'Analysis', tech: 'Tech', medicine: 'Medicine', cqc: 'CQC', weapons: 'Weapon handling', fitness: 'Fitness' };
const span = (w) => { if (w >= 52) { const y = Math.round(w / 52 * 10) / 10; return `${y} year${y === 1 ? '' : 's'}`; } return w >= 9 ? `${Math.round(w / 4.35)} months` : `${w} week${w === 1 ? '' : 's'}`; };
/**
 * The paper of it: { stamp, title, lines } (its opening the post's: an illegal's the hard word; an undercover officer's, the legend's).
 * after: phases after the training ([{ what, where, weeks, line }]: a deep post's incubation, sim/incubation.js), in the total.
 */
export function planPaper(character, city, cover = 'official', after = []) {
  const P = [...plan(character, city, cover), ...after], total = P.reduce((t, x) => t + x.weeks, 0), K = cityById(city);
  const open = cover === 'illegal' ? '"You\'re very good. At this level, over there, you\'ll be dead in a month. You won\'t get any backup: no embassy, no passport that means anything, nobody who\'ll admit you were ever ours. So first, this."'
    : cover === 'undercover' ? `"${K.name}, under a legend: no diplomatic passport, nobody at the embassy who knows your name. If they take you, it's their prison, and we were never there. So you'll be very good before you go."`
    : P.length > 1 ? `Station ${K.name} wants its officers to speak the language before they land. The personnel office has your next ${span(total)} worked out.` : `Station ${K.name}: you have what it needs. Leave, and then out.`;
  const deep = cover === 'illegal' || cover === 'undercover', os = Math.max(character?.os ?? 0, ILLEGAL_OS);
  // (an illegal's: Tradecraft at least ILLEGAL_OS when it's done, and no way back from what comes after it)
  const end = cover === 'illegal' ? [`At its end, Tradecraft ${os}: as good as the Agency makes them. Then the legend, and the life in it, for as long as it lasts. Nobody comes home from an illegal's post on a pension: you go knowing you won't.`] : [];
  return { stamp: deep ? 'TRAINING' : 'ORDERS', title: deep ? `BEFORE ${K.name.toUpperCase()}` : `TO STATION ${K.name.toUpperCase()}`,
    lines: [open, ...P.map(x => `${cap(span(x.weeks))}: ${x.what}${x.where ? `, ${x.where}` : ''}: ${x.line}.`), ...end, `${cap(span(total))} in all, before you're anywhere near ${K.name}.`] };
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// **Retirement and the next officer** (the user, 2026-11-04: "Officers retire when they cross 60 years old and reach the end of
// a posting (they don't retire mid-post)"; the world goes on, its date and its business, when an officer's lost or retires
// and the next is picked): RETIRE_AGE at a posting's end; the next officer's first day SUCCESSOR_WEEKS after the last's
// career ended, a Monday, in the same world (c.world).
export const RETIRE_AGE = 60, SUCCESSOR_WEEKS = 8;
/** Whether p retires at a posting's end at ms. */
export const retires = (p, ms) => (ageOf(p, ms) ?? 0) >= RETIRE_AGE;
/** The next officer's first morning (wakeH local) after a career ended at ms. */
export function successorStart(ms, wakeH = 7) {
  const d = Math.floor(ms / DAY) + SUCCESSOR_WEEKS * 7, k = new Date(Date.UTC(2026, 0, 1) + d * DAY).getUTCDay(), monday = d + ((8 - k) % 7);
  return monday * DAY + wakeH * 3600000;
}

/** p's birth, set once from the file's age at ms (a day of the year by their name, so it's always the same). */
export function born(p, ms) {
  if (p && p.born === undefined && Number.isFinite(p.age)) p.born = ms - (p.age + (hash(p.name ?? '', 'born') % 1000) / 1000) * YEAR;
  return p?.born;
}
/** p's age at ms: from their birth if known, else the file's. */
export const ageOf = (p, ms) => (p?.born !== undefined ? Math.floor((ms - p.born) / YEAR) : p?.age ?? null);
