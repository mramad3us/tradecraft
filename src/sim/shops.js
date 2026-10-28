// TRADECRAFT sim: going into a shop (the user, 2026-10-27: "entering businesses to shake a tail"). The
// engine's, in any scene on the street.
//
// At a shop's door (shopNear(): on the pavement, by its door), T offers to go in (sim/acts.js affordance
// 'shop'), and the UI asks how (the bus: 'shop', ways()):
//   - 'front': a minute among the shelves (BROWSE_S), and out the way you came. Natural: people go into
//     shops. Whoever was following waits outside, where they can see the door, and has you again.
//   - 'back': through to the back, the stock room, a yard, and out of its gate into the lane beside
//     the building (BACKWAY_S): the side street or alley nearest the shop on this street (backLane():
//     within BACK_REACH_M), BACK_IN_M up it from the building line, out of sight of the shop's door.
//     (It came out on the next street north once, out of its hedge: the user, 2026-10-27, "it does not
//     make sense ... there should be cross alleyways to drop to when taking that action". The yard
//     behind, and a lane across the backs, wait for the buildings' cutaway: DESIGN.md, Next.) Only
//     where there is a back way (BACKWAYS, by the kind of shop: a café's kitchen door, a grocer's yard;
//     not a bank or a pharmacy) and a lane to come out in. Whoever waited at the front waits for
//     nothing (sim/agents.js: two minutes at the door, then lost).
//   - 'eat' (a café, a bakery, a grocer's…: FOOD): a bite, EAT_S (sim/needs.js), BITE_USD; 'wash' (a
//     café's, a bar's toilet: TOILETS) the blood off your face (sim/notice.js); 'coat' (a clothes shop):
//     a coat off the rail, worn out of the shop (COAT_S, COAT_USD: sim/money.js), a colour you weren't
//     wearing; whoever was looking for the old one looks past you (the scenes: onShop).
// Inside, you're out of sight (a.hidden) and your feet are the shop's (sim/game.js); the time passes as
// it does. The scene hears of it, going in and coming out (scenario.onShop?.(state, bus, phase, way)):
// being tailed's team watches the door, and a back way they saw you take is written down; in Blown the
// hunters who had you wait at the front.
import { Z, gapsOf, mouthOf, inLane, SECTION_M } from './map/street.js';
import { townOf } from './cities/index.js';
import { sectionAt } from './world.js';
import { hash } from './rng.js';
import { say } from './log.js';
import { eat, EAT_S } from './needs.js';
import { price, pay, BITE_USD, COAT_USD } from './money.js';
import { train, learn, shelf, reading, readAnHour, bookOf, bookLine } from './training.js';
import { cityById } from './cities/index.js';
import { HOUR } from './clock.js';

export const BROWSE_S = 40;
export const BACKWAY_S = 55;
export const WASH_S = 90;
export const COAT_S = 150;
export const SIT_S = 180;
// (time put into yourself, the user, 2026-10-27: "time should feel like a currency, meaning gym (trains fitness),
// karate class or other martial arts ... read a book (can buy books in bookstores to learn specific things),
// take a language class": hours in, points out, sim/training.js)
export const GYM_S = 90 * 60, CLASS_S = 120 * 60, LESSON_S = 90 * 60, READ_S = 60 * 60, BUY_S = 180;
export const GYM_USD = 8, CLASS_USD = 12, LESSON_USD = 15, GYM_UP_TO = 14, CLUB_UP_TO = 14;
const LANG_NAME = { ru: 'Russian', en: 'English', ar: 'Arabic' };
// (the language a city's school teaches: its own; London's, the opposition's, since you have the English)
const langHere = (state) => (state.map.city === 'london' ? 'ru' : cityById(state.map.city ?? 'moscow')?.lang ?? 'ru');
// (a table by the window, a coffee: the street watched from inside, out of its sight)
export const WINDOW_TABLES = new Set(['cafe', 'restaurant', 'bar']);
// (coats on the rail: [colour, trim]; one you weren't wearing)
export const COATS = [[0x6b4636, 0x47302a], [0x2f6b62, 0x23252f], [0x8f6345, 0x6b4636], [0x4a2a52, 0x23252f], [0x23252f, 0x14151c], [0x6a7182, 0x3a3f4b], [0x9e3c36, 0x47302a]];
// (the kinds with a toilet a customer can use: a café's, a bar's, a restaurant's; sim/notice.js)
export const TOILETS = new Set(['cafe', 'restaurant', 'bar', 'shawarma', 'beer']);
// (the kinds where you can eat something, quickly: sim/needs.js)
export const FOOD = new Set(['cafe', 'restaurant', 'bar', 'shawarma', 'bakery', 'deli', 'grocery']);
export const DOOR_REACH_M = 0.9;
export const BACK_REACH_M = 30, BACK_IN_M = 7;
// (the kinds of shop with a way out the back, more often than not: a kitchen, a yard, a goods door)
export const BACKWAYS = { cafe: 0.85, restaurant: 0.9, bar: 0.8, shawarma: 0.8, grocery: 0.7, deli: 0.7, bakery: 0.75, beer: 0.7, clothes: 0.5, books: 0.4, shoes: 0.4, flowers: 0.5, tobacco: 0.3, phones: 0.3 };
const WORDS = { cafe: 'the café', restaurant: 'the restaurant', bar: 'the bar', shawarma: 'the shawarma place', grocery: 'the grocer\'s', deli: 'the food hall', bakery: 'the bakery', beer: 'the beer shop',
  clothes: 'the clothes shop', books: 'the bookshop', shoes: 'the shoe shop', flowers: 'the florist\'s', tobacco: 'the tobacconist\'s', phones: 'the phone shop', pharmacy: 'the pharmacy', bank: 'the bank',
  exchange: 'the exchange booth', optician: 'the optician\'s', watches: 'the watchmaker\'s', gym: 'the gym', club: 'the club', school: 'the language school' };
export const shopWord = (kind) => WORDS[kind] ?? 'the shop';

/** The shop door actor a stands at (on the street, on the pavement by it), or null. */
export function shopNear(state, a) {
  if (state.map.kind !== 'street' || a.z < Z.front - 0.3 || a.z > Z.front + 1.6) return null;
  return sectionAt(state, a.x)?.doors.find(d => d.kind === 'shop' && d.z === Z.front && Math.abs(d.x - a.x) < DOOR_REACH_M) ?? null;
}

/** The lane a shop's back way comes out in: the side street or alley nearest it on this street, within BACK_REACH_M; { x, z } BACK_IN_M up it, or null. */
export function backLane(state, d) {
  if (state.map.kind !== 'street') return null;
  const town = townOf(state.map), row = state.map.row ?? 0, i = Math.floor(d.x / SECTION_M);
  let best = null;
  for (const j of [i - 1, i, i + 1]) for (const g of gapsOf(town, row, j)) {
    const m = mouthOf(g), x = (m.x0 + m.x1) / 2, z = Math.max(Z.front - BACK_IN_M, (m.z ?? -Infinity) + 0.8), dist = Math.abs(x - d.x);
    if (dist < BACK_REACH_M && inLane(g, x, z) && (!best || dist < best.dist)) best = { dist, x, z };
  }
  return best;
}

/** Whether this shop has a way out the back (by its kind, and the door: the same every time; and a lane beside to come out in). */
export const backWay = (state, d) => (hash(state.map.seed, state.map.row ?? 0, Math.round(d.x * 10), 'back') % 100) / 100 < (BACKWAYS[d.shop] ?? 0) && !!backLane(state, d);

/** How you could go in: [{ id, label }]. */
export function ways(state, d) {
  const out = [{ id: 'front', label: `Into ${shopWord(d.shop)}: a minute among the shelves, and out the front` }];
  if (backWay(state, d)) out.push({ id: 'back', label: 'Through to the back: the stock room, a yard, out of its gate into the lane beside' });
  const p = state.people[state.player];
  if (FOOD.has(d.shop)) out.push({ id: 'eat', label: `${d.shop === 'grocery' || d.shop === 'bakery' || d.shop === 'deli' ? 'Something to eat: bread, cheese, eaten by the window' : 'A bite and a hot drink at the counter'} (two minutes, ${price(state, BITE_USD)})` });
  if (WINDOW_TABLES.has(d.shop)) out.push({ id: 'sit', label: `A coffee at the window table: three minutes, watching the street from inside (${price(state, BITE_USD)})` });
  // (time put into yourself: the gym, a class, a lesson; a book off the shelf; an hour with one over a coffee)
  if (d.shop === 'gym') out.push({ id: 'train', label: `An hour and a half on the weights and the bag: fitness (${price(state, GYM_USD)})` });
  if (d.shop === 'club') out.push({ id: 'class', label: `A class, two hours on the mat: throws, falls, holds: close combat (${price(state, CLASS_USD)})` });
  if (d.shop === 'school') out.push({ id: 'lesson', label: `A lesson, ninety minutes of ${LANG_NAME[langHere(state)] ?? 'the language'} (${price(state, LESSON_USD)})` });
  if (d.shop === 'books') for (const b of shelf(state.map.seed, state.map.row ?? 0, d.x)) if (!(p?.books ?? []).some(o => o.id === b.id)) out.push({ id: `book:${b.id}`, label: `${b.lang ? `A grammar of ${LANG_NAME[langHere(state)] ?? 'the language'}` : b.title}: ${b.hours} hours' reading (${price(state, b.usd)})` });
  if (WINDOW_TABLES.has(d.shop) && p && reading(p)) out.push({ id: 'read', label: `An hour with ${bookOf(reading(p).id).title} and a coffee (${price(state, BITE_USD)})` });
  if (d.shop === 'clothes') out.push({ id: 'coat', label: `A coat off the rail, worn out of the shop (${price(state, COAT_USD)})` });
  if (TOILETS.has(d.shop) && p?.bloody) out.push({ id: 'wash', label: p.bloody.face ? 'The toilet: wash the blood off your face' : 'The toilet: scrub at the stain on your coat' });
  return out;
}

/** In you go: out of sight, your feet the shop's, for as long as the way takes. */
export function goIn(state, bus, me, d, way, scenario) {
  if (way === 'back' && !backWay(state, d)) way = 'front';
  if (way === 'wash' && !(TOILETS.has(d.shop) && state.people[state.player]?.bloody)) way = 'front';
  if (way === 'eat' && !(FOOD.has(d.shop) && pay(state, bus, BITE_USD, 'a bite'))) way = 'front';
  if (way === 'coat' && !(d.shop === 'clothes' && pay(state, bus, COAT_USD, 'a coat'))) way = 'front';
  if (way === 'sit' && !(WINDOW_TABLES.has(d.shop) && pay(state, bus, BITE_USD, 'a coffee'))) way = 'front';
  const p = state.people[state.player];
  if (way === 'train' && !(d.shop === 'gym' && pay(state, bus, GYM_USD, 'a day at the gym'))) way = 'front';
  if (way === 'class' && !(d.shop === 'club' && pay(state, bus, CLASS_USD, 'the class'))) way = 'front';
  if (way === 'lesson' && !(d.shop === 'school' && pay(state, bus, LESSON_USD, 'the lesson'))) way = 'front';
  if (way === 'read' && !(WINDOW_TABLES.has(d.shop) && p && reading(p) && pay(state, bus, BITE_USD, 'a coffee'))) way = 'front';
  let book = null;
  if (way.startsWith('book:')) {
    book = d.shop === 'books' && shelf(state.map.seed, state.map.row ?? 0, d.x).find(b => `book:${b.id}` === way);
    if (!book || !pay(state, bus, book.usd, 'the book')) { way = 'front'; book = null; }
  }
  const secs = { back: BACKWAY_S, wash: WASH_S, eat: EAT_S, coat: COAT_S, sit: SIT_S, train: GYM_S, class: CLASS_S, lesson: LESSON_S, read: READ_S }[way] ?? (book ? BUY_S : BROWSE_S);
  me.inside = { x: d.x, shop: d.shop, way, book: book?.id, until: state.time.ms + secs * 1000, row: state.map.row ?? 0 };
  Object.assign(me, { hidden: true, vx: 0, vz: 0, busy: null, glass: false, gait: 'idle' });
  if (way === 'sit') Object.assign(me, { face: 'down', head: Math.PI / 2 });   // (looking out through the window at the street)
  say(state, bus, { kind: 'note', text: way === 'back' ? `Into ${shopWord(d.shop)}, past the counter, a nod as if you belong, and through the door at the back.` : way === 'wash' ? `Into ${shopWord(d.shop)}, head down, straight to the toilet at the back, and the bolt across.` : `Into ${shopWord(d.shop)}. You take your time over the shelves.` });
  scenario?.onShop?.(state, bus, 'in', way);
}

/** Each tick while inside: out, when the time's up (the front: the door; the back: the street behind). */
export function insideTick(state, bus, me, scenario, { loadRow }) {
  const ins = me.inside;
  if (!ins || state.time.ms < ins.until) return;
  delete me.inside;
  me.hidden = false;
  const lane = ins.way === 'back' && backLane(state, { x: ins.x });
  if (lane) {
    Object.assign(me, { x: lane.x, z: lane.z, face: 'down', head: Math.PI / 2 });
    say(state, bus, { kind: 'note', text: 'Past the stock room, a yard of bins and crates, a gate: out in the lane beside it, out of sight of the shop\'s door.' });
  } else {
    Object.assign(me, { x: ins.x, z: Z.front + 0.7, face: 'down', head: Math.PI / 2 });
    const p = state.people[state.player];
    if (ins.way === 'coat') {
      // (a colour you weren't wearing; the old one, and whatever was on it, left on the rail)
      const now = p.look?.top?.color, pickC = COATS.filter(([c]) => c !== now), [color, trim] = pickC[hash(state.time.ms, state.map.seed) % pickC.length];
      p.look = { ...p.look, top: { ...(p.look?.top ?? {}), kind: 'coat', color, trim } };
      if (p.bloody?.clothes !== undefined) { delete p.bloody.clothes; if (!Object.keys(p.bloody).length) delete p.bloody; }
      say(state, bus, { kind: 'note', text: 'A coat off the rail, the tags off at the till, and the old one left over a chair. Out you go, in a colour you weren\'t wearing.' });
    } else if (ins.way === 'train' || ins.way === 'class') {
      // (the gym: fitness; the club: close combat; hungry after, as you would be)
      const g = ins.way === 'train' ? train(p, 'fitness', GYM_S / 3600, GYM_UP_TO) : train(p, 'cqc', CLASS_S / 3600, CLUB_UP_TO), what = ins.way === 'train' ? 'Fitness' : 'CQC';
      if (p.needs) p.needs.ate = Math.min(p.needs.ate ?? state.time.ms, state.time.ms - 3 * HOUR);
      say(state, bus, { kind: 'note', text: `${ins.way === 'train' ? 'The weights, the bag, the bike to nowhere: an hour and a half, and a shower.' : 'Two hours of throws and falls, and holds you can\'t get out of until you can.'} ${g.gained ? `${what} up a point: ${g.base}.` : g.toNext === null ? `${ins.way === 'train' ? 'The gym' : 'The club'} has taught you all it can.` : `${Math.ceil(g.toNext)} hours more to the next point.`}` });
    } else if (ins.way === 'lesson') {
      const lang = langHere(state), g = learn(p, lang, LESSON_S / 3600, 'fluent');
      say(state, bus, { kind: 'note', text: `Ninety minutes of ${LANG_NAME[lang] ?? 'the language'}: verbs, a newspaper read aloud, the teacher's patience. ${g.gained ? `Your ${LANG_NAME[lang]} is ${g.level} now.` : g.toNext === null ? 'There\'s nothing more the school can teach you.' : `${Math.ceil(g.toNext)} hours more to the next level.`}` });
    } else if (ins.book) {
      (p.books ??= []).push({ id: ins.book, read: 0 });
      say(state, bus, { kind: 'note', text: `${bookLine(bookOf(ins.book))}: paid for, and in your pocket.` });
    } else if (ins.way === 'read') { eat(p, state.time.ms, 6); say(state, bus, { kind: 'note', text: readAnHour(p, langHere(state)) ?? 'Nothing left to read.' }); }
    else if (ins.way === 'sit') { eat(p, state.time.ms, 12); say(state, bus, { kind: 'note', text: 'The coffee drunk, the street watched: whoever was out there for three minutes, you\'ve seen.' }); }
    else if (ins.way === 'eat') { eat(p, state.time.ms, 8); say(state, bus, { kind: 'note', text: 'Something hot, eaten standing up, and a minute of nobody looking at you. Better.' }); }
    else if (ins.way === 'wash' && p?.bloody) {
      // (the face comes clean in cold water; a coat doesn't: darker, smaller, still there)
      const face = p.bloody.face !== undefined;
      delete p.bloody.face;
      if (!face) delete p.bloody.clothes;
      if (!Object.keys(p.bloody).length) delete p.bloody;
      say(state, bus, { kind: 'note', text: face ? `Cold water, paper towels, a long look in the mirror. Your face is your own again${p.bloody?.clothes ? '; the coat isn\'t: it wants changing' : ''}.` : 'Cold water and a scrub: the stain\'s darker and smaller, and passes for dirt. Out again.' });
    } else say(state, bus, { kind: 'note', text: 'Out again, with nothing bought, the way you went in.' });
  }
  scenario?.onShop?.(state, bus, 'out', ins.way);
}
