// TRADECRAFT sim: in a shop (the user, 2026-10-27: "entering businesses to shake a tail"; "doing the things
// like going out the back should be a thing we do when inside and not abstracted"). The engine's, in any
// scene on the street.
//
// A shop's ground floor is walked into (sim/interiors/shop.js, set into its building by the street): in
// at its door, and you're in it (me.within, withinTick()); out at its door, and you're not. The scene
// hears of both (scenario.onShop?.(state, bus, 'in' | 'out', way): the way out 'front', or 'coat' in a
// coat bought there, or 'back'). Its walls hide you; its window doesn't: whoever's on the pavement sees
// in, and whoever was following, seeing you go in, waits on the door (sim/agents.js). Inside, T at:
//   - the counter: what the shop sells (ways()): 'browse' (a minute's look and a question, BROWSE_S:
//     natural, people go into shops); 'eat' (a café, a bakery, a grocer's…: FOOD) a bite, EAT_S
//     (sim/needs.js), BITE_USD; off a rail (sim/clothes.js RAIL: a clothes shop's coats, jackets,
//     jumpers and hats; an optician's glasses), the one chosen, put on there (COAT_S), what it replaced
//     into the shop's bag to take home, so that whoever was looking for the old one
//     looks past you as you come out; a thing (sim/clothes.js GOODS: an umbrella, a penknife, a bottle,
//     a kitchen knife), into the hand or a pocket or the bag; a book (a bookshop's shelf: sim/training.js); the gym's, the
//     club's, the school's hours (sim/training.js; the hours skipped, as an action that takes time);
//   - the ledge in the window (a café's, a bar's, a kebab shop's: WINDOW_TABLES): a coffee stood at it,
//     watching the street through the glass (SIT_S, lived through: move, and you've had enough of it),
//     or an hour there with the book on the go;
//   - the basin (a café's toilet: TOILETS), the blood off your face (sim/notice.js);
//   - the back door (where the shop has one: sim/backways.js): the yard behind and its gate, out of
//     sight (YARD_S), and out in the lane beside the building (BACK_IN_M up it). Whoever waited at the
//     front waits for nothing (sim/agents.js: two minutes at the door, then lost). The yard itself, and a
//     lane across the backs, wait for the blocks' insides (DESIGN.md, Next).
// What's done takes its time (me.inside: { way, until }), skipped as any action that takes time is
// (sim/game.js skip()): the clock moves on, and you're free at once, where you stood. Only the window's
// coffee is lived through (LIVED), your feet the window's till it's drunk or you move. Seen through the
// window if you're in sight of it; only the yard has you out of sight (a.hidden).
import { Z } from './map/street.js';
import { backLaneAt, backWayAt, BACK_REACH_M, BACK_IN_M, BACKWAYS } from './backways.js';
import { townOf } from './cities/index.js';
import { sectionAt } from './world.js';
import { hash } from './rng.js';
import { say } from './log.js';
import { eat, EAT_S } from './needs.js';
import { price, pay, cashOf, BITE_USD } from './money.js';
import { RAIL, GOODS, SLOTS, railOf, putOn, carry } from './clothes.js';
import { weaponOf } from './weapons.js';
import { train, learn, shelf, reading, readAnHour, bookOf, bookLine } from './training.js';
import { cityById } from './cities/index.js';
import { HOUR, DAY, calendar } from './clock.js';
import { unitAt, SPOT_REACH_M } from './interiors/use.js';
import { floorKind } from './interiors/shop.js';

export const BROWSE_S = 40;
export const YARD_S = 20;                                          // (the yard and its gate)
// (what's done in a shop is an action that takes time: the clock skips it, and your feet are yours again at
// once; the user, 2026-10-28: "went to buy a book in a bookstore, never came out even after 3 minutes".
// Only the window's coffee is lived through, the street watched in real time, and moving ends it)
export const LIVED = new Set(['sit']);
export const WASH_S = 90;
export const COAT_S = 150;
export const SIT_S = 180;
// (time put into yourself, the user, 2026-10-27: "time should feel like a currency, meaning gym (trains fitness),
// karate class or other martial arts ... read a book (can buy books in bookstores to learn specific things),
// take a language class": hours in, points out, sim/training.js)
export const GYM_S = 90 * 60, CLASS_S = 120 * 60, LESSON_S = 90 * 60, READ_S = 60 * 60, BUY_S = 180;
export const GYM_USD = 8, CLASS_USD = 12, LESSON_USD = 15, GYM_UP_TO = 14, CLUB_UP_TO = 14;
// (a month's membership of one gym or club: its sessions free till then; the user, 2026-10-28: "implement clubs with subscriptions")
export const CLUB_MONTH_USD = { gym: 45, club: 70 }, MEMBER_DAYS = 30;
// (a bank: what's kept back on you, paying in; how long at the counter)
export const KEEP_USD = 50, BANK_S = 4 * 60;
/** Whether you're a member of the gym or club at door d (p.clubs: { 'row:x': until }). */
export const memberOf = (state, d) => (state.people[state.player]?.clubs?.[`${state.map.row ?? 0}:${Math.round(d.x * 10)}`] ?? 0) > state.time.ms;
const LANG_NAME = { ru: 'Russian', en: 'English', ar: 'Arabic' };
// (the language a city's school teaches: its own; London's, the opposition's, since you have the English)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayText = (ms) => { const k = calendar(ms); return `${k.day} ${MONTHS[k.month - 1]}`; };
const langHere = (state) => (state.map.city === 'london' ? 'ru' : cityById(state.map.city ?? 'moscow')?.lang ?? 'ru');
// (the kinds whose floor is a café's (sim/interiors/shop.js): a table by the window, where the room has one, a coffee, the street
// watched from inside; a toilet at the back, a customer's to use (sim/notice.js))
const CAFES = ['cafe', 'restaurant', 'bar', 'pub', 'shawarma', 'kebab', 'chips', 'koshary', 'foul', 'juice'].filter(k => floorKind(k) === 'cafe');
export const WINDOW_TABLES = new Set(CAFES), TOILETS = new Set(CAFES);
// (a rail's slots, as the counter offers them)
const RAIL_WORDS = { top: 'Off the rail: a coat, a jacket, a jumper, put on there and then', hat: 'A hat, put on there and then', glasses: 'Glasses, put on there and then' };
// (the kinds where you can eat something, quickly: sim/needs.js)
export const FOOD = new Set([...CAFES, 'bakery', 'sweets', 'manakish', 'deli', 'grocery']);
export { BACK_REACH_M, BACK_IN_M, BACKWAYS };
const WORDS = { cafe: 'the café', restaurant: 'the restaurant', bar: 'the bar', shawarma: 'the shawarma place', grocery: 'the grocer\'s', deli: 'the food hall', bakery: 'the bakery', beer: 'the beer shop',
  clothes: 'the clothes shop', books: 'the bookshop', shoes: 'the shoe shop', flowers: 'the florist\'s', tobacco: 'the tobacconist\'s', phones: 'the phone shop', pharmacy: 'the pharmacy', bank: 'the bank',
  exchange: 'the exchange booth', optician: 'the optician\'s', watches: 'the watchmaker\'s', gym: 'the gym', club: 'the club', school: 'the language school' };
export const shopWord = (kind) => WORDS[kind] ?? 'the shop';

/** The shop floor actor a stands in (sim/interiors/use.js unitAt()): { S, u, k }, or null. */
export const shopHere = (state, a) => (a && !a.hidden && state.map.kind === 'street' ? unitAt(state, a.x, a.z) : null);

/** The door of the shop a stands in ({ x, z, shop }), or null. */
export function doorOf(state, a) {
  const at = shopHere(state, a);
  return at && { x: at.u.door, z: Z.front, shop: at.u.shop };
}

/**
 * What's within reach where actor a stands in a shop: 'counter', 'sit' (the window's ledge), 'wash' (the
 * basin), or 'back' (the back door): { kind, x, z, face, door }, or null.
 */
export function spotIn(state, a) {
  const at = shopHere(state, a);
  if (!at) return null;
  const all = [...at.u.spots, ...at.u.exits.map(e => ({ kind: 'back', x: (e.x0 + e.x1) / 2, z: e.z1 + 0.35, face: 'up' }))];
  let best = null, bd = SPOT_REACH_M;
  for (const s of all) { const d = Math.hypot(s.x - a.x, s.z - a.z); if (d < bd) { bd = d; best = s; } }
  return best && { ...best, door: { x: at.u.door, z: Z.front, shop: at.u.shop } };
}

/** The lane a shop's back way comes out in (sim/backways.js): { x, z }, or null. */
export const backLane = (state, d) => (state.map.kind === 'street' ? backLaneAt(townOf(state.map), state.map.row ?? 0, d) : null);

/** Whether this shop has a way out the back (sim/backways.js: by its kind and the door, the same every time; and a lane beside to come out in). */
export const backWay = (state, d) => state.map.kind === 'street' && backWayAt(townOf(state.map), state.map.row ?? 0, d);

/** What can be done at a spot in shop d ('counter', 'sit', 'wash', 'back'): [{ id, label }]. */
export function ways(state, d, spot = 'counter') {
  const p = state.people[state.player], out = [];
  if (spot === 'back') return backWay(state, d) ? [{ id: 'back', label: 'Out the back: the yard, its gate, the lane beside' }] : [];
  if (spot === 'wash') return TOILETS.has(d.shop) && p?.bloody ? [{ id: 'wash', label: p.bloody.face ? 'Wash the blood off your face' : 'Scrub at the stain on your coat' }] : [];
  if (spot === 'sit') {
    if (WINDOW_TABLES.has(d.shop)) out.push({ id: 'sit', label: `A coffee at the ledge in the window: three minutes, watching the street from inside (${price(state, BITE_USD)})` });
    if (WINDOW_TABLES.has(d.shop) && p && reading(p)) out.push({ id: 'read', label: `An hour with ${bookOf(reading(p).id).title} and a coffee (${price(state, BITE_USD)})` });
    return out;
  }
  out.push({ id: 'browse', label: 'A look at what they have, a question at the counter: a minute, nothing bought' });
  if (FOOD.has(d.shop)) out.push({ id: 'eat', label: `${d.shop === 'grocery' || d.shop === 'bakery' || d.shop === 'deli' ? 'Something to eat: bread, cheese, eaten by the window' : 'A bite and a hot drink at the counter'} (two minutes, ${price(state, BITE_USD)})` });
  // (time put into yourself: the gym, a class, a lesson; a book off the shelf)
  // (a gym's, a club's sessions: paid each time, or free on a month's membership of this one: CLUB_MONTH_USD)
  const member = memberOf(state, d);
  if (d.shop === 'gym') out.push({ id: 'train', label: `An hour and a half on the weights and the bag: fitness (${member ? 'a member' : price(state, GYM_USD)})` });
  if (d.shop === 'club') out.push({ id: 'class', label: `A class, two hours on the mat: throws, falls, holds: close combat (${member ? 'a member' : price(state, CLASS_USD)})` });
  if ((d.shop === 'gym' || d.shop === 'club') && !member) out.push({ id: 'join', label: `A month's membership: every ${d.shop === 'gym' ? 'session' : 'class'} till ${dayText(state.time.ms + MEMBER_DAYS * DAY)} without paying (${price(state, CLUB_MONTH_USD[d.shop])})` });
  // (a bank's counter: your account, in the campaign: money out, money in)
  const acct = state.campaign?.posting?.money;
  if (d.shop === 'bank' && acct) {
    for (const usd of [100, 500, 1000]) if ((acct.bank ?? 0) >= usd) out.push({ id: `withdraw:${usd}`, label: `Draw ${price(state, usd)} from your account (${price(state, acct.bank ?? 0)} in it)` });
    if (cashOf(p) > KEEP_USD) out.push({ id: `deposit:${Math.floor(cashOf(p) - KEEP_USD)}`, label: `Pay in what's on you but ${price(state, KEEP_USD)}: ${price(state, Math.floor(cashOf(p) - KEEP_USD))}` });
  }
  if (d.shop === 'school') out.push({ id: 'lesson', label: `A lesson, ninety minutes of ${LANG_NAME[langHere(state)] ?? 'the language'} (${price(state, LESSON_USD)})` });
  if (d.shop === 'books') for (const b of shelf(state.map.seed, state.map.row ?? 0, d.x)) if (!(p?.books ?? []).some(o => o.id === b.id)) out.push({ id: `book:${b.id}`, label: `${b.lang ? `A grammar of ${LANG_NAME[langHere(state)] ?? 'the language'}` : b.title}: ${b.hours} hours' reading (${price(state, b.usd)})` });
  // (a rail: which piece, asked next (doWay()); what a shop sells to take away)
  if (RAIL[d.shop]) for (const slot of SLOTS) if (railOf(d.shop, p).some(x => x.slot === slot)) out.push({ id: `rail:${slot}`, label: RAIL_WORDS[slot] });
  for (const [kind, what, usd] of GOODS[d.shop] ?? []) out.push({ id: `buy:${kind}`, label: `${what.charAt(0).toUpperCase() + what.slice(1)} (${price(state, usd)})` });
  return out;
}

/**
 * In and out of a shop's floor, each tick (on the street): in at its door, the scene hears of it; out
 * at its door, the scene hears of it, and of the coat you came out in.
 */
export function withinTick(state, bus, me, scenario) {
  if (me.inside || me.hidden) return;
  const at = shopHere(state, me);
  if (at && !me.within) {
    me.within = { x: at.u.door, shop: at.u.shop, row: state.map.row ?? 0 };
    scenario?.onShop?.(state, bus, 'in', 'front');
  } else if (!at && me.within) {
    const w = me.within;
    delete me.within;
    scenario?.onShop?.(state, bus, 'out', w.coat ? 'coat' : 'front');
  }
}

/** Do `way` at the spot you're at in the shop you're in (ways()): paid for, your feet the shop's while it takes. Returns whether it's begun. */
export function doWay(state, bus, me, way, scenario) {
  const sp = me.within && !me.inside && spotIn(state, me);
  if (!sp) return false;
  const d = sp.door, p = state.people[state.player];
  // (a rail: its pieces in that slot, for the UI to ask which (the bus: 'shop'); chosen, it comes back as piece:<id>)
  if (way.startsWith('rail:') && ways(state, d, sp.kind).some(w => w.id === way)) {
    bus?.emit('shop', { shop: d.shop, ways: railOf(d.shop, p).filter(x => x.slot === way.slice(5)).map(x => ({ id: `piece:${x.id}`, label: `${x.name.charAt(0).toUpperCase() + x.name.slice(1)} (${price(state, x.usd)})` })) });
    return false;
  }
  const piece = way.startsWith('piece:') && sp.kind === 'counter' ? railOf(d.shop, p).find(x => `piece:${x.id}` === way) : null;
  const good = way.startsWith('buy:') && sp.kind === 'counter' ? (GOODS[d.shop] ?? []).find(([k]) => `buy:${k}` === way) : null;
  if (!piece && !good && !ways(state, d, sp.kind).some(w => w.id === way)) return false;
  if (piece && !pay(state, bus, piece.usd, piece.name)) return false;
  if (good && !pay(state, bus, good[2], good[1])) return false;
  const member = memberOf(state, d);
  const cost = { eat: [BITE_USD, 'a bite'], sit: [BITE_USD, 'a coffee'], read: [BITE_USD, 'a coffee'], train: member ? null : [GYM_USD, 'a day at the gym'], class: member ? null : [CLASS_USD, 'the class'], lesson: [LESSON_USD, 'the lesson'], join: [CLUB_MONTH_USD[d.shop], 'the membership'] }[way];
  const [bankWay, bankUsd] = way.split(':'), acct = state.campaign?.posting?.money;
  if (bankWay === 'withdraw' && !((acct?.bank ?? 0) >= Number(bankUsd))) return false;
  if (bankWay === 'deposit' && !(cashOf(p) >= Number(bankUsd))) return false;
  const book = way.startsWith('book:') ? shelf(state.map.seed, state.map.row ?? 0, d.x).find(b => `book:${b.id}` === way) : null;
  if (cost && !pay(state, bus, ...cost)) return false;
  if (book && !pay(state, bus, book.usd, 'the book')) return false;
  const secs = { back: YARD_S, wash: WASH_S, eat: EAT_S, sit: SIT_S, train: GYM_S, class: CLASS_S, lesson: LESSON_S, read: READ_S, join: BUY_S, withdraw: BANK_S, deposit: BANK_S }[bankWay === 'withdraw' || bankWay === 'deposit' ? bankWay : way] ?? (piece ? COAT_S : book || good ? BUY_S : BROWSE_S);
  me.inside = { x: d.x, shop: d.shop, way, book: book?.id, ...(bankWay === 'withdraw' || bankWay === 'deposit' ? { bank: bankWay, usd: Number(bankUsd) } : {}), ...(piece ? { piece: { id: piece.id, slot: piece.slot, name: piece.name, look: piece.look } } : {}), ...(good ? { good: good[0], what: good[1] } : {}), until: state.time.ms + secs * 1000, row: state.map.row ?? 0, long: !LIVED.has(way) };
  Object.assign(me, { x: sp.x, z: sp.z, vx: 0, vz: 0, busy: null, glass: false, gait: 'idle', face: sp.face ?? 'up' });
  me.head = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[me.face] ?? -Math.PI / 2;
  if (way === 'back') me.hidden = true;                             // (the yard: out of everyone's sight)
  say(state, bus, { kind: 'note', text: {
    back: 'Through the back door, a nod as if you belong: a yard of bins and crates, and its gate.',
    wash: 'The toilet, the bolt across, cold water.',
    eat: `Something from ${shopWord(d.shop)}'s counter, eaten there.`,
    sit: 'A coffee, stood at the ledge in the window: the street goes by on the other side of the glass.',
    read: 'A coffee at the ledge in the window, the book open on it.',
    train: 'The changing room, and the gym floor.', class: 'Into a gi, and on to the mat.', lesson: 'A classroom upstairs, a table, a teacher.',
  }[way] ?? (piece ? `Along the rail: ${piece.name}, the tags off at the till.` : good ? `${good[1].charAt(0).toUpperCase() + good[1].slice(1)}, paid for at the counter.` : book ? 'The book from the shelf, paid for at the counter.' : 'A look along the shelves, and a question at the counter.') });
  return true;
}

/** Each tick while something's being done in a shop: done, when the time's up (the back door: out in the lane). */
export function insideTick(state, bus, me, scenario) {
  const ins = me.inside;
  if (!ins || state.time.ms < ins.until) return;
  delete me.inside;
  me.gait = 'idle';
  if (ins.way !== 'back' && me.hidden) Object.assign(me, { hidden: false, x: ins.x, z: Z.front + 0.7 });   // (a save from before the shops were walked in: out at the door)
  const lane = ins.way === 'back' && backLane(state, { x: ins.x });
  if (ins.way === 'back') {
    me.hidden = false;
    delete me.within;
    if (lane) Object.assign(me, { x: lane.x, z: lane.z, face: 'down', head: Math.PI / 2 });
    else Object.assign(me, { x: ins.x, z: Z.front + 0.7, face: 'down', head: Math.PI / 2 });   // (no gate after all: round by the front)
    say(state, bus, { kind: 'note', text: lane ? 'Out of the gate, into the lane beside the building, out of sight of the shop\'s door.' : 'The gate\'s locked: back through, and out the front.' });
    scenario?.onShop?.(state, bus, 'out', lane ? 'back' : 'front');
    return;
  }
  const p = state.people[state.player];
  if (ins.way === 'join') {
    (p.clubs ??= {})[`${ins.row}:${Math.round(ins.x * 10)}`] = state.time.ms + MEMBER_DAYS * DAY;
    say(state, bus, { kind: 'note', text: `A card with your photograph on it, and your name in the book: a member till ${dayText(state.time.ms + MEMBER_DAYS * DAY)}.` });
  } else if (ins.bank) {
    const acct = state.campaign?.posting?.money;
    if (ins.bank === 'withdraw' && acct && (acct.bank ?? 0) >= ins.usd) { acct.bank -= ins.usd; p.cash = Math.round((cashOf(p) + ins.usd) * 100) / 100; }
    if (ins.bank === 'deposit' && acct && cashOf(p) >= ins.usd) { acct.bank = (acct.bank ?? 0) + ins.usd; p.cash = Math.round((cashOf(p) - ins.usd) * 100) / 100; }
    say(state, bus, { kind: 'note', text: `${ins.bank === 'withdraw' ? `${price(state, ins.usd)} counted out at the window` : `${price(state, ins.usd)} paid in`}: ${price(state, acct?.bank ?? 0)} in the account, ${price(state, cashOf(p))} on you.` });
  } else if (ins.piece) {
    // (on there and then; what it replaced, and whatever was on it, folded into the shop's bag to take home: sim/clothes.js)
    const was = putOn(p, ins.piece);
    if (was) (p.bag ??= []).push(was);
    if (ins.piece.slot === 'top' && p.bloody?.clothes !== undefined) { delete p.bloody.clothes; if (!Object.keys(p.bloody).length) delete p.bloody; }
    if (me.within) me.within.coat = true;                      // (out the door changed: the scene hears so)
    say(state, bus, { kind: 'note', text: `${ins.piece.name.charAt(0).toUpperCase() + ins.piece.name.slice(1)} on, there and then${was ? `; ${was.name} folded into the shop's bag` : ''}. Out you go, not as you came in.` });
  } else if (ins.good) {
    const at = carry(p, ins.good);
    say(state, bus, { kind: 'note', text: `${ins.what.charAt(0).toUpperCase() + ins.what.slice(1)}: ${at === 'hand' ? 'in your hand' : at === 'pocket' ? 'in a pocket' : 'in the shop\'s bag, no room for it about you'}.` });
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
  else if (ins.way === 'sit') { eat(p, state.time.ms, ins.cut ? 6 : 12); say(state, bus, { kind: 'note', text: ins.cut ? 'Half the coffee left on the ledge: you\'ve seen enough of the street.' : 'The coffee drunk, the street watched: whoever was out there for three minutes, you\'ve seen.' }); }
  else if (ins.way === 'eat') { eat(p, state.time.ms, 8); say(state, bus, { kind: 'note', text: 'Something hot, eaten standing up, and a minute of nobody looking at you. Better.' }); }
  else if (ins.way === 'wash' && p?.bloody) {
    // (the face comes clean in cold water; a coat doesn't: darker, smaller, still there)
    const face = p.bloody.face !== undefined;
    delete p.bloody.face;
    if (!face) delete p.bloody.clothes;
    if (!Object.keys(p.bloody).length) delete p.bloody;
    say(state, bus, { kind: 'note', text: face ? `Cold water, paper towels, a long look in the mirror. Your face is your own again${p.bloody?.clothes ? '; the coat isn\'t: it wants changing' : ''}.` : 'Cold water and a scrub: the stain\'s darker and smaller, and passes for dirt. Out again.' });
  } else say(state, bus, { kind: 'note', text: 'Nothing you need, and nobody minds.' });
}
