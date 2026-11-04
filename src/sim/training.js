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
import { LANG_NAME } from './langs.js';

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
 * The bookshops' books, by what they teach (`skill`), how long they take to read (`hours`: ten minutes at
 * a time, sat somewhere: sim/reading.js), how far they take you (`upTo`), their price in dollars
 * (sim/money.js). A grammar of each language the city's schools teach is the bookshop's too (`lang`: its code; the
 * old 'grammar', of the city's own, is kept for the books bought before), and a novel, which teaches nothing.
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
  ...Object.keys(LANG_NAME).filter(l => l !== 'en').map(l => ({ id: `grammar-${l}`, title: `A Grammar of ${LANG_NAME[l]}`, lang: l, hours: 20, upTo: 'basic', usd: 22 })),
  // (and for nothing but the reading: sim/reading.js)
  { id: 'karenina', title: 'Anna Karenina', hours: 34, usd: 9 },
  { id: 'master', title: 'The Master and Margarita', hours: 16, usd: 9 },
  { id: 'coldspy', title: 'The Spy Who Came In from the Cold', hours: 7, usd: 8 },
  { id: 'havana', title: 'Our Man in Havana', hours: 7, usd: 8 },
];

/** A book on the shelf of the bookshop at door x (three of them, the grammars of three of `langs`, the city's schools': its first always), the same every time. */
export function shelf(town, row, x, langs = []) {
  const k = hash(town, row, Math.round(x * 10), 'shelf'), skills = BOOKS.filter(b => b.skill), novels = BOOKS.filter(b => !b.skill && !b.lang);
  return [0, 1, 2].map(j => skills[(k + j * 3) % skills.length]).filter((b, j, l) => l.indexOf(b) === j).concat(shelfLangs(langs, k).map(l => bookOf(`grammar-${l}`)).filter(Boolean), novels[k % novels.length]);
}
// (the grammars a shop keeps: the first of the city's languages, and two of the others, by the shop)
function shelfLangs(langs, k) {
  const rest = langs.slice(1), out = langs.slice(0, 1);
  for (let j = 0; j < 2 && rest.length; j++) out.push(rest.splice((k >>> (j * 4)) % rest.length, 1)[0]);
  return out;
}

export const bookOf = (id) => BOOKS.find(b => b.id === id);
/** Whether a book owned ({ id, read }) has been read to its end. */
export const finished = (b) => b.read >= bookOf(b.id).hours;
/** A book's title, its subject, its hours. */
export const bookLine = (b) => `${b.title}: ${b.lang ? (LANG_NAME[b.lang] ?? 'the language') : b.skill ? SKILLS[b.skill]?.name ?? b.skill : 'a novel'}, ${b.hours} hours' reading`;

/**
 * Time with a book owned (on: { id, read }; lang: the city's, for a grammar): the hours on it, and what they
 * teach, up to what it can; a book already read passes the time and no more. { gained, base, level, toNext, last: this was its end }.
 */
export function readFor(p, on, lang, hours) {
  const b = bookOf(on.id), left = Math.max(0, b.hours - on.read), h = Math.min(hours, left);
  if (!h) return { gained: 0, last: false, toNext: null };
  on.read = Math.round((on.read + h) * 60) / 60;
  const g = b.lang ? learn(p, typeof b.lang === 'string' ? b.lang : lang, h, b.upTo) : b.skill ? train(p, b.skill, h, b.upTo) : { gained: 0, toNext: null };
  return { ...g, last: on.read >= b.hours };
}
