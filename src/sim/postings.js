// TRADECRAFT sim: the career into the deep postings (docs/POSTINGS.md; DESIGN.md, Career: ranks and classes, and Toward 0.2).
// A posting's end offers the next (offers()); one chosen, the time before it goes by and the officer with it (nextPosting()).
//
// **What's offered** (offers(): at a posting's end, done well; nothing to a career that's over, nor to an illegal, whose post
// is the last):
//   - **A station under official cover** (a handler's: every station, as before; after a deep post that ended badly, the
//     only kind on offer: recalled, sacked, out of a prison).
//   - **An undercover post** (DEEP_CITIES: Moscow, Beirut, Cairo; never London) after a handler's posting carried out, or
//     for a legend straight from London's first tour (the user, 2026-11-04: "they are allowed to go from London starting
//     posting to undercover, then illegal"). Never where your face is on file (facesOf(): every country you've served in
//     under official cover, and wherever you were made on a trip abroad, or blown; the user, 2026-11-04: "if our face is in
//     GRU/FSB files as a diplomatic employee, no amount of time will suffice to go unnoticed").
//   - **An illegal's post**: Tradecraft ILLEGAL_OS (80) and an undercover post carried out to its end (the user: "only
//     available for 80+ tradecraft officers who succesfully achieved a full undercover assignment"); never where your face
//     is on file. Neither deep post (my call, to settle) where you've lived another legend already (servedDeep()).
// **The end of a career** (careerEnd()): past RETIRE_AGE at a posting's end (never in the middle of one), or a legend's last
// (LEGEND_AFTER postings after the one they started in: the user, "the already old officer should have a pretext to retire
// (can be terminal disease) after two postings at most"; my reading, DESIGN's: the two are the undercover and the illegal
// after London's start, the illegal's running to the end as any does; to settle) with their pretext (PRETEXTS).
// **The next posting** (nextPosting()): a station under official cover as before (sim/campaign.js promote(): the leave, the
// language to working); a deep one, the training (sim/career.js plan(): the language to fluent, or native for an illegal, the
// skills to the post's floors, FLOORS, all of it put on the sheet), then the incubation (sim/incubation.js: months, or
// years, of the legend lived), the posting's first day the Monday after, the officer that much older, the street's craft
// rusty with it. The career's file keeps each phase (training, the legend lived) and how each posting ended (how).
import { CITY_IDS, cityById } from './cities/index.js';
import { countryOfCity } from './countries/index.js';
import { plan, born, ageOf, retires, ILLEGAL_OS, FLOORS, NEED, RETIRE_AGE } from './career.js';
import { incubationOf, lived, MONTH, YEAR } from './incubation.js';
import { DEEP_CITIES, DEEP_LEVELS, targetOf } from './legends.js';
import { newCampaign, promote, dayOf, WAKE_H } from './campaign.js';
import { DAY, calendar } from './clock.js';
import { hash } from './rng.js';

export const WEEK = 7 * DAY, LEGEND_AFTER = 2;
// (how a posting can end, and what the career makes of it: on to the next, the official kind only (a deep post gone wrong), or over)
export const GOES_ON = new Set(['completed', 'promoted']), RECALLED = new Set(['sacked', 'exfiltrated', 'released']), OVER = new Set(['expelled', 'taken', 'dead', 'brought']);
// (a legend's reason to stop, at last: the user, "can be terminal disease")
export const PRETEXTS = [
  'the scan the Agency\'s doctors asked about, twice, and the oncologist who didn\'t need to',
  'the heart: the cardiologist says it plainly, and for once they listen',
  'a diagnosis they\'d kept from everyone for a year, and can\'t any longer',
  'the tremor in the right hand that a neurologist has a name for',
];
const OFFICIAL = new Set(['junior', 'handler']);
const span = (w) => (w >= 52 ? `${Math.round(w / 52 * 10) / 10} years` : w >= 9 ? `${Math.round(w / 4.35)} months` : `${Math.round(w)} weeks`);

/** The countries where p's face is on file: served in under official cover, made on a trip there, blown in. [id]. */
export function facesOf(c) {
  const out = new Set(c.faces ?? []), P = c.posting;
  for (const k of c.career ?? []) if (k.city && (OFFICIAL.has(k.level) || ['taken', 'exfiltrated', 'released', 'blown'].includes(k.how))) out.add(countryOfCity(k.city)?.id);
  if (P && OFFICIAL.has(P.level)) out.add(P.country ?? countryOfCity(P.city)?.id);
  if (P && DEEP_LEVELS.has(P.level) && (c.blown || ['exfiltrated', 'taken', 'released'].includes(c.over?.why))) out.add(P.country);
  // (a trip abroad on a first tour where they made you: their service has a face, and a name off a diplomatic passport)
  for (const a of c.done ?? []) if (a.trip && ['burned', 'made', 'blown'].includes(a.outcome)) out.add(countryOfCity(a.trip)?.id);
  out.delete(undefined);
  return [...out];
}
/** The countries where p has lived a legend already (an undercover post, an illegal's). [id]. */
export function servedDeep(c) {
  const out = new Set();
  for (const k of c.career ?? []) if (DEEP_LEVELS.has(k.level) && k.city) out.add(countryOfCity(k.city)?.id);
  if (DEEP_LEVELS.has(c.posting?.level)) out.add(c.posting.country);
  return out;
}
/** Postings so far, the one now among them (the career's file: training, the language school and the legend lived aren't). */
export const postingsOf = (c) => (c.career ?? []).filter(k => !['school', 'training', 'incubation'].includes(k.level)).length + 1;
/** Whether an undercover post's been carried out to its end in this career (now, or before). */
export const undercoverDone = (c) => (c.career ?? []).some(k => k.level === 'undercover' && k.how === 'completed') || (c.posting?.level === 'undercover' && c.over?.why === 'completed');
/** Whether a handler's posting's been carried out (the way to an undercover one, a legend's aside). */
const handlerDone = (c) => (c.career ?? []).some(k => k.level === 'handler' && (k.how ?? 'completed') === 'completed') || (c.posting?.level === 'handler' && c.over?.why === 'completed');

/**
 * Whether the career's over at the end of this posting, at ms: { retire, why ('age' | 'pretext' | 'last'), words }, or null
 * (it goes on). An illegal's post is the last: brought out, the career's over too.
 */
export function careerEnd(c, ms) {
  const p = c.character, how = c.over?.why;
  if (OVER.has(how) && how !== 'brought') return null;              // (lost, not retired: the next officer all the same, src/main.js)
  if (how === 'brought') return { retire: true, why: 'last', words: `${p.name} comes home, and the Agency gives them a medal nobody may see` };
  if (retires(p, ms)) return { retire: true, why: 'age', words: `${p.name} retires, ${ageOf(p, ms)}` };
  if (p.legend && postingsOf(c) > LEGEND_AFTER && GOES_ON.has(how)) return { retire: true, why: 'pretext', words: `${p.name} stops at last: ${PRETEXTS[hash(p.name ?? '', 'pretext') % PRETEXTS.length]}` };
  return null;
}

/** The seed a next posting of `kind` at city is made from (offers() reads it for the incubation's words; nextPosting() makes it). */
export const seedFor = (c, city, kind) => (kind === 'official' ? hash(c.seed, 'promoted') % 1e9 : hash(c.seed, 'deep', kind, city) % 1e9);

/**
 * What the career offers at the end of this posting (at ms): [{ city, kind ('official' | 'undercover' | 'illegal'), ok, why, title,
 * about, words (the time it takes) }]; none if the career's over (careerEnd()) or the post doesn't end in a next one.
 */
export function offers(c, ms) {
  const how = c.over?.why, me = c.character;
  if (!GOES_ON.has(how) && !RECALLED.has(how)) return [];
  if (careerEnd(c, ms) || DEEP_LEVELS.has(c.posting.level) && c.posting.level === 'illegal') return [];
  const faces = new Set(facesOf(c)), deep = servedDeep(c), out = [];
  for (const city of CITY_IDS) {
    const K = cityById(city);
    out.push({ city, kind: 'official', ok: true, title: `Station ${K.name}`, about: K.station.about, words: timeWords(c, city, 'official', ms) });
  }
  if (!GOES_ON.has(how)) return out;                                 // (a deep post gone wrong: back on the official ladder for now)
  const legend = !!me.legend, may = legend || handlerDone(c);
  for (const kind of ['undercover', 'illegal']) for (const city of DEEP_CITIES) {
    const country = countryOfCity(city)?.id, K = cityById(city);
    const why = kind === 'undercover' && !may ? 'a handler\'s posting carried out first'
      : kind === 'illegal' && (me.os ?? 0) < ILLEGAL_OS ? `Tradecraft ${ILLEGAL_OS} first (yours is ${me.os ?? 0})`
      : kind === 'illegal' && !undercoverDone(c) ? 'an undercover post carried out to its end first'
      : faces.has(country) ? `your face is in their files: ${countryOfCity(city)?.name ?? K.name} is closed to you`
      : deep.has(country) ? `you've lived a legend there already`
      : null;
    const T = forecast(c, city, kind, ms).T?.target;
    out.push({ city, kind, ok: !why, why, title: `${kind === 'illegal' ? 'Illegal' : 'Undercover'}, ${K.name}`, about: T ? `Inside ${T.place}.` : '', words: why ? null : timeWords(c, city, kind, ms) });
  }
  return out;
}

/**
 * A next deep posting of `kind` at city, as it would be if chosen at ms: { weeks (the training), ms0 (its end: the legend's first
 * day), I (the incubation, sim/incubation.js), T (the target and the job, sim/legends.js), start (day one: the Monday after) }.
 * The thread open on day one decides the target, so the incubation's reckoned once more from there (nextPosting() makes the same).
 */
export function forecast(c, city, kind, ms) {
  const weeks = plan(c.character, city, kind).reduce((t, x) => t + x.weeks, 0), ms0 = ms + weeks * WEEK, seed = seedFor(c, city, kind), w = c.world ?? c.seed;
  let I = incubationOf(seed, city, kind, w, ms0);
  I = incubationOf(seed, city, kind, w, ms0 + I.ms);
  const from = dayOf(ms0 + I.ms), monday = from + ((7 - calendar(from * DAY).weekday) % 7);
  return { weeks, ms0, I, T: targetOf(seed, city, kind, I.thread), start: monday * DAY + WAKE_H * 3600000 };
}

/** The time a next posting takes before its first day, in a line (the training, the incubation). */
export function timeWords(c, city, kind, ms) {
  const ch = c.character, P = plan(ch, city, kind), weeks = P.reduce((t, x) => t + x.weeks, 0);
  const extra = P.filter(x => x.what !== 'home leave').map(x => x.what);
  if (kind === 'official') return extra.length ? `${span(weeks)} first: home leave, ${extra.join(', ')}.` : `${span(weeks)}' home leave, then out.`;
  const I = forecast(c, city, kind, ms).I;
  return `${extra.length ? `${span(weeks)} of training (${extra.join('; ')})` : `${span(weeks)}' home leave`}, then ${kind === 'illegal' ? `${Math.round(I.months / 12 * 10) / 10} years lying low` : `${I.months} months living the legend`} before day one.`;
}

/** The officer trained for a post of `kind` at city: the language to its need, the skills to its floors (sim/career.js). p, changed. */
export function trained(p, city, kind) {
  const lang = cityById(city).lang, need = NEED[kind];
  if (need && lang !== 'en') p.langs = { ...(p.langs ?? {}), [lang]: need };
  for (const [k, f] of Object.entries(FLOORS[kind] ?? {})) { const v = p.skills?.[k] ?? [0, 0]; if (v[0] < f) (p.skills ??= {})[k] = [f, v[1] ?? 0]; }
  return p;
}

/**
 * The next posting chosen (offers()): a new campaign for the same officer, the career's file brought along (how this one ended,
 * the training, the legend lived), the faces on file, the account. Official: sim/campaign.js promote(). Deep: the training
 * (trained()), the incubation (sim/incubation.js), day one the Monday after.
 */
export function nextPosting(c, city, kind = 'official') {
  const end = c.over?.ms ?? c.now ?? c.posting.startMs, how = c.over?.why ?? null, faces = facesOf(c);
  if (kind === 'official') {
    const next = promote(c, city);
    next.career = next.career.map((k, i) => (i === (c.career ?? []).length ? { ...k, how } : k));
    next.faces = faces;
    return next;
  }
  const ch = { ...structuredClone(c.character), id: 'me' };
  born(ch, c.posting.startMs);
  const F = forecast(c, city, kind, end);                            // (the training's weeks reckoned from the sheet before it)
  trained(ch, city, kind);
  lived(ch, kind, F.start);
  const next = newCampaign(seedFor(c, city, kind), ch, city, kind, F.start, c.world ?? c.seed);
  next.career = [...(c.career ?? []), { level: c.posting.level, city: c.posting.city, until: end, how },
    { level: 'training', kind, city, from: end, until: F.ms0 }, { level: 'incubation', kind, city, from: next.posting.incubation.from, until: F.start }];
  next.faces = faces;
  next.posting.money.bank += c.posting.money.bank ?? 0;
  return next;
}

/** How long a deep posting's been coming, for its papers: '2.3 years' / '14 months'. */
export const lengthWords = (ms) => (ms >= YEAR ? `${Math.round(ms / YEAR * 10) / 10} years` : `${Math.round(ms / MONTH)} months`);
export { RETIRE_AGE };

/** The phases after a deep post's training, for its paper (sim/career.js planPaper()'s after): the legend lived. [] for a station. */
export function afterPhases(c, city, kind, ms) {
  if (kind === 'official') return [];
  const { I, T } = forecast(c, city, kind, ms);
  return [{ what: kind === 'illegal' ? 'the legend lived, lying low' : 'the legend lived', where: `in ${cityById(city).name}, as ${T?.job?.[0] ?? 'someone else'}`, weeks: Math.round(I.ms / WEEK),
    line: kind === 'illegal' ? 'a life, a real one, and nothing of the trade in it till the Center calls: the length of it by how hard the place is to get near, and how good their counter-intelligence is' : 'a job, a flat, a name, before the work begins: as long as it takes them to stop looking at a newcomer' }];
}

/** A deep posting's brief, its first day's paper (src/main.js postingPaper()): away, the news while you were (lines). */
export function deepPaper(c, away = []) {
  const p = c.posting, me = c.character, K = cityById(p.city), I = p.incubation, ill = p.level === 'illegal', R = p.rivalry;
  return { stamp: ill ? 'THE SIGNAL' : 'UNDER A LEGEND', title: `${K.name.toUpperCase()}: ${String(p.alias).toUpperCase()}`, go: 'Begin the posting', lines: [
    `${me.name}, as ${p.alias}, ${p.nationWord}: ${p.jobShort}, at ${p.employer}. ${ill ? 'Every paper you carry is genuine, and every one is a lie.' : `${cap(p.papers)}.`} No diplomatic passport: caught, it's their prison, and nobody will say you were ours.`,
    ill ? `${lengthWords(I.ms)} lying low, and this morning on your way to work, the signal: a chalk mark on a lamp post where there's never been one. The Center wants you.` : `${lengthWords(I.ms)} of the legend lived before today: long enough, they reckon, for ${p.target?.short ?? 'them'} to stop looking at a newcomer.`,
    `${R ? `${cap(R.the)}, ${R.years} years of it. ` : ''}${ill ? 'The Center' : 'The station'} wants ${p.goal}. Your way in: ${p.target?.place ?? 'what your job puts you near'}.`,
    ...away,
    p.assets.length ? `${ill ? 'Those the Center gives you to run' : 'Handed to you by the station'}, met by signal and never by phone: ${p.assets.map(s => `${s.codename}, ${s.role}, in it for ${s.motive}`).join('; ')}.` : 'Nobody to run yet.',
    `Watched: ${p.targets.map(t => `${t.name}, ${t.what}`).join('; ')}.`,
    `${p.employer} expects you nine to six on weekdays: the work is the legend's, and losing the job loses the posting. ${ill ? 'The Center is a dead drop and a chalk mark: no embassy, nobody to ring.' : 'The station is a chalk mark and a dead drop, never the embassy\'s door.'}`,
    `If it all goes wrong: ${p.exfil.label}, by your own means. Nobody is coming for you.${ill ? ' It\'s the last posting there is: it runs till they take you, or you die, or the Center brings you out, which it almost never can.' : ''}`,
  ] };
}
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
