// TRADECRAFT sim: a book, sat somewhere (the user, 2026-10-31: "a way when sitting on a bench, to just read a
// book we bought (which is in inventory) for as long as we want (one way to pass time, in chunks of 10min),
// also when drinking coffee at a bar or other places this mechanic would make sense"). The engine's.
//
// A book is a thing you own (p.books: { id, read: hours, at: 'pocket' | 'bag' | 'home' }, sim/training.js) and
// takes room like anything else (sim/items.js): a paperback goes in a coat pocket, not a pair of jeans; what
// won't fit rides in the shop's bag and is unpacked at the flat, onto its shelf, where you can pick it up again.
// **Where** (seat()): sat on a bench, in a bus shelter (the bus comes when it comes), at a café's ledge over a
// coffee (a bar's, a pub's: another every COFFEE_EVERY_MIN), or in the flat's armchair (any book you own). R
// offers it (the armchair: T), and a card reads on READ_MIN at a time, for as long as you like: the clock skipped
// (sim/game.js skip(); the campaign's pass(), for what the days bring), hours into the book's subject as
// training (sim/training.js readFor()), a little calm. A book finished can be read again: it passes the time.
// **Not** in the dark, on a bench (BLOCKED), nor in rain or snow, which would have the pages.
// **In a scene that's lived** (a tail, a meeting: not PASTIME: skipping would leave the people in it standing),
// a book is cover instead: me.busy.book, the street over the top of it, no time skipped.
import { MIN } from './clock.js';
import { say } from './log.js';
import { soothe } from './needs.js';
import { pay, BITE_USD } from './money.js';
import { taughtIn } from './cities/index.js';
import { LANG_NAME } from './langs.js';
import { lightBand } from './light.js';
import { lightHere } from './perception.js';
import { weatherAt, FALLS } from './weather.js';
import { bookOf, readFor, finished } from './training.js';
import { spotNear } from './interiors/use.js';
import { fits } from './items.js';
import { SKILLS } from './skills.js';

export const READ_MIN = 10, READ_CALM = 3, COFFEE_EVERY_MIN = 40, LEDGE_MS = 12 * 60 * MIN;
export const PASTIME = new Set(['campaign', 'walk']);              // (scenes with time to spend)
const langHere = (state) => taughtIn(state.map.city);              // (a grammar teaches what the city's schools do: sim/cities/ taughtIn())

/** Whether the book's about you (pockets or the shop's bag), not on the flat's shelf. */
export const onYou = (b) => b.at !== 'home';

/** Where you're sat to read here: 'ledge', 'bench', 'shelter', 'chair', or null. */
export function seat(state, me) {
  if (me.inside?.way === 'sit' || me.inside?.way === 'read') return 'ledge';
  if (me.gait === 'sit' && (me.busy?.what === 'bench' || me.busy?.what === 'shelter')) return me.busy.what;
  return state.map.place === 'home' && spotNear(state, me)?.kind === 'read' ? 'chair' : null;
}

/** Why you can't read here, in words, or null. */
export function blocked(state, me, where) {
  if (where !== 'bench' && where !== 'shelter') return null;
  const w = weatherAt(state);
  if (where === 'bench' && FALLS.has(w.kind) && w.level) return w.kind === 'snow' ? 'The snow would have the pages.' : 'The rain would have the pages.';
  return lightBand(lightHere(state, me.x, me.z)) === 'dark' ? 'Too dark to read here.' : null;
}

/** The books within reach here, the one on the go first, what's finished last. */
function within(p, where) {
  const list = (p.books ?? []).filter(b => where === 'chair' || onYou(b));
  return [...list].sort((a, b) => Number(finished(a)) - Number(finished(b)));
}

/** R, sat somewhere with a book: { act, text } for the HUD (sim/acts.js affordance()), or null. */
export function offer(state, me) {
  if (!me || me.ai || me.busy?.book || (me.inside && !PASTIME.has(state.scenario.kind))) return null;
  const where = seat(state, me);
  if (!where || where === 'chair') return null;                     // (the armchair's the instinct's line, on T)
  const b = within(state.people[me.who] ?? {}, where)[0];
  if (!b) return null;
  const why = blocked(state, me, where);
  return why ? { act: null, text: ` ${why}` } : { act: 'read', text: ` {use} read ${bookOf(b.id).title}.` };
}

const spent = (h) => { const m = Math.round(h * 60), H = Math.floor(m / 60); return `${H ? `${H} h ` : ''}${m % 60 ? `${String(m % 60).padStart(H ? 2 : 1, '0')} min` : ''}`.trim(); };

/** The card: the books within reach, ten more minutes of each; at the armchair, what to take or leave. { title, list: [{ key, label, off }] }. */
export function cardOf(state, me) {
  const p = state.people[me.who], where = seat(state, me), why = blocked(state, me, where), rows = [];
  for (const b of within(p, where)) {
    const B = bookOf(b.id);
    rows.push({ key: `on:${b.id}`, label: `${B.title}: ${finished(b) ? 'read, and again for the pleasure of it' : `${b.read ? `${spent(b.read)} of ${B.hours} h` : `${B.hours} h, not begun`}`}`, off: why });
  }
  if (where === 'chair') for (const b of p.books ?? []) {
    const t = bookOf(b.id).title;
    if (!onYou(b)) rows.push({ key: `take:${b.id}`, label: `Take ${t} with you`, off: fits(p, 'book') ? null : 'no room about you' });
    else if (b.at !== 'bag') rows.push({ key: `leave:${b.id}`, label: `Leave ${t} on the shelf` });
  }
  rows.push({ key: 'close', label: 'Shut the book' });
  return { title: `${READ_MIN} MINUTES AT A TIME`, list: rows };
}

/** Opened (R; T at the armchair): the card, with time to spend; in a lived scene, cover. */
export function open(state, bus, me) {
  const where = seat(state, me), p = state.people[me.who];
  if (!where) return;
  const b = within(p, where)[0], why = blocked(state, me, where);
  if (why) return say(state, bus, { kind: 'instinct', text: why });
  if (!b) return where === 'chair' ? say(state, bus, { kind: 'instinct', text: 'The armchair, and nothing to read but the takeaway menus. A bookshop would help.' }) : undefined;
  if (PASTIME.has(state.scenario.kind)) {
    if (me.inside?.way === 'sit') Object.assign(me.inside, { way: 'read', until: state.time.ms + LEDGE_MS });   // (the coffee in hand becomes the coffee you read over)
    return bus?.emit('reading', cardOf(state, me));
  }
  if (!me.busy) return;
  me.busy.book = b.id;
  say(state, bus, { kind: 'instinct', text: `You open ${bookOf(b.id).title} on your knee. The street goes on over the top of it.` });
}

/** The card's choice: READ_MIN of a book, or a book taken from the shelf or left on it. */
export function act(state, bus, me, key, scenario, skip) {
  const [what, id] = key.split(':'), p = state.people[me.who], where = seat(state, me), b = (p.books ?? []).find(x => x.id === id);
  if (what === 'close' || !where) { if (what === 'close' && me.inside?.way === 'read') Object.assign(me.inside, { until: state.time.ms }); return; }
  if (!b) return;
  if (what === 'take' || what === 'leave') {
    if (where !== 'chair' || (what === 'take' && !fits(p, 'book'))) return;
    b.at = what === 'take' ? 'pocket' : 'home';
    say(state, bus, { kind: 'note', text: what === 'take' ? `${bookOf(id).title}, off the shelf and into a pocket.` : `${bookOf(id).title}, back on the shelf.` });
    return bus?.emit('reading', cardOf(state, me));
  }
  if (what !== 'on' || blocked(state, me, where) || !PASTIME.has(state.scenario.kind) || (where !== 'chair' && !onYou(b))) return;
  const ms = READ_MIN * MIN;
  if (scenario.pass) scenario.pass(state, bus, ms); else skip(state, bus, ms);
  if (state.scenario.outcome || state.people[me.who]?.dead) return;
  const B = bookOf(id), lang = typeof B.lang === 'string' ? B.lang : langHere(state), g = readFor(p, b, lang, READ_MIN / 60);
  soothe(p, READ_CALM);
  if (g.gained) say(state, bus, { kind: 'note', text: B.lang ? `Your ${LANG_NAME[lang] ?? 'grasp of the language'} is ${g.level} now.` : `${B.title}: ${SKILLS[B.skill].name} up a point, ${g.base}.` });
  if (g.last) say(state, bus, { kind: 'note', text: `The last page of ${B.title}.${B.skill || B.lang ? ` ${g.toNext === null ? 'It\'s taught you all it can.' : ''}` : ''}`.trim() });
  if (me.inside?.way === 'read') {                                  // (the ledge's coffee: another, now and then, or you're asked to go)
    const ins = me.inside;
    ins.mins = (ins.mins ?? 0) + READ_MIN;
    if (ins.mins % COFFEE_EVERY_MIN === 0 && !pay(state, bus, BITE_USD, 'another coffee')) { say(state, bus, { kind: 'note', text: 'Nothing left to pay for another, and the look from the counter says so.' }); ins.until = state.time.ms; return; }
  }
  bus?.emit('reading', cardOf(state, me));
}
