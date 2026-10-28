// TRADECRAFT sim: time spent on yourself (the user, 2026-10-27: "pass the time things should be natural
// and time should feel like a currency, meaning gym (trains fitness), karate class or other martial
// arts, bed (nap, sleep, rest), read a book (can buy books in bookstores to learn specific things), take
// a language class"). Hours put in, not points bought.
//
// A skill's trained base (sim/skills.js: [base, practice]) rises a point for every hoursFor(base) hours
// of training in it: slower the higher it is (HOURS_BASE + HOURS_PER × base: 8 h at 5, four classes; 12 at
// 10, 16 at 15). What's put in is kept on the sheet (p.training: { skill: hours toward the next point }). Each
// teacher teaches only so far (`upTo`): a gym makes you fit, not an athlete; a club's sensei takes you
// a long way; a book only to a course's level. A language is the same in levels (sim/skills.js
// LANG_LEVELS): LANG_HOURS more to each next one, a school's up to fluent. What it costs besides the
// hours (money, tiredness, hunger) is the scene's to charge: the places and their prices are the
// campaign's.
import { LANG_LEVELS, SKILLS } from './skills.js';
import { hash } from './rng.js';

export const HOURS_BASE = 4, HOURS_PER = 0.8;
export const LANG_HOURS = { basic: 25, working: 70, fluent: 160 };   // (to reach each level from the one below)

/** Hours of training for the next point of a skill at this base. */
export const hoursFor = (base) => HOURS_BASE + HOURS_PER * base;

/**
 * Hours of training in a skill, as far as the teacher goes (upTo, a base): the points it comes to,
 * kept on the sheet. Returns { gained, base, toNext (hours) }.
 */
export function train(p, key, hours, upTo = 20) {
  const s = (p.skills[key] ??= [0, 0]), t = (p.training ??= {});
  let have = (t[key] ?? 0) + hours, gained = 0;
  while (s[0] < upTo && have >= hoursFor(s[0])) { have -= hoursFor(s[0]); s[0]++; gained++; }
  t[key] = s[0] >= upTo ? 0 : have;
  return { gained, base: s[0], toNext: s[0] >= upTo ? null : hoursFor(s[0]) - have };
}

/** Hours of a language's lessons, up to a level (upTo): the levels gained, kept. Returns { gained, level, toNext }. */
export function learn(p, lang, hours, upTo = 'fluent') {
  const langs = (p.langs ??= {}), t = (p.training ??= {}), key = `lang:${lang}`, top = LANG_LEVELS.indexOf(upTo);
  let at = Math.max(0, LANG_LEVELS.indexOf(langs[lang] ?? 'none')), have = (t[key] ?? 0) + hours, gained = 0;
  while (at < top && have >= LANG_HOURS[LANG_LEVELS[at + 1]]) { have -= LANG_HOURS[LANG_LEVELS[at + 1]]; at++; gained++; }
  if (at > 0) langs[lang] = LANG_LEVELS[at];
  t[key] = at >= top ? 0 : have;
  return { gained, level: LANG_LEVELS[at], toNext: at >= top ? null : LANG_HOURS[LANG_LEVELS[at + 1]] - have };
}

/**
 * The bookshops' books, by what they teach (`skill`), how long they take to read (`hours`, read an hour
 * at a sitting), how far they take you (`upTo`), their price in dollars (sim/money.js). A grammar of
 * the posting's language is the bookshop's too (`lang`: the city's own).
 */
export const BOOKS = [
  { id: 'firstaid', title: 'First Aid Manual', skill: 'medicine', hours: 8, upTo: 8, usd: 18 },
  { id: 'influence', title: 'Influence: The Psychology of Persuasion', skill: 'social', hours: 10, upTo: 9, usd: 16 },
  { id: 'thinking', title: 'Thinking, Fast and Slow', skill: 'analysis', hours: 12, upTo: 10, usd: 20 },
  { id: 'radio', title: 'The Radio Amateur\'s Handbook', skill: 'tech', hours: 12, upTo: 9, usd: 24 },
  { id: 'smallarms', title: 'Jane\'s Small Arms', skill: 'weapons', hours: 8, upTo: 7, usd: 30 },
  { id: 'memory', title: 'The Art of Memory', skill: 'awareness', hours: 9, upTo: 8, usd: 14 },
  { id: 'disguise', title: 'Stagecraft and Make-up', skill: 'deception', hours: 9, upTo: 8, usd: 15 },
  { id: 'maps', title: 'A Walker\'s Atlas of the City', skill: 'pathfinding', hours: 7, upTo: 8, usd: 12 },
  { id: 'grammar', title: 'A Grammar of the Language', lang: true, hours: 20, upTo: 'basic', usd: 22 },
];

/** A book on the shelf of the bookshop at door x (three of them, and a grammar of the city's language), the same every time. */
export function shelf(town, row, x) {
  const k = hash(town, row, Math.round(x * 10), 'shelf'), skills = BOOKS.filter(b => !b.lang);
  return [0, 1, 2].map(j => skills[(k + j * 3) % skills.length]).filter((b, j, l) => l.indexOf(b) === j).concat(BOOKS.filter(b => b.lang));
}

/** The book a person has on the go (the first not finished), or null. */
export const reading = (p) => (p.books ?? []).find(b => b.read < bookOf(b.id).hours) ?? null;
export const bookOf = (id) => BOOKS.find(b => b.id === id);
/** A book's title, its subject, its hours. */
export const bookLine = (b) => `${b.title}: ${b.lang ? 'the language' : SKILLS[b.skill]?.name ?? b.skill}, ${b.hours} hours' reading`;

/** An hour with the book on the go (lang: the city's, for a grammar): what it came to, in words; or null with nothing to read. */
export function readAnHour(p, lang) {
  const on = reading(p);
  if (!on) return null;
  const b = bookOf(on.id);
  on.read += 1;
  const g = b.lang ? learn(p, lang, 1, b.upTo) : train(p, b.skill, 1, b.upTo), done = on.read >= b.hours;
  return `An hour with ${b.title}${done ? ', and the last page' : ` (${on.read} of ${b.hours})`}. ${g.gained ? (b.lang ? `Your ${lang === 'ru' ? 'Russian' : lang === 'ar' ? 'Arabic' : 'English'} is ${g.level} now.` : `${SKILLS[b.skill].name} up a point: ${g.base}.`) : g.toNext === null ? 'It\'s taught you all it can.' : `${Math.ceil(g.toNext)} hours more to the next point.`}`;
}
