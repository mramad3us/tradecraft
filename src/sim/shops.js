// TRADECRAFT sim: going into a shop (the user, 2026-10-27: "entering businesses to shake a tail"). The
// engine's, in any scene on the street.
//
// At a shop's door (shopNear(): on the pavement, by its door), T offers to go in (sim/acts.js affordance
// 'shop'), and the UI asks how (the bus: 'shop', ways()):
//   - 'front': a minute among the shelves (BROWSE_S), and out the way you came. Natural: people go into
//     shops. Whoever was following waits outside, where they can see the door, and has you again.
//   - 'back': through to the back, the stock room, a yard, and out on the street behind (BACKWAY_S):
//     the next street north, on its pavement along the backs (LINE.S). Only where there is a back way
//     (BACKWAYS, by the kind of shop: a café's kitchen door, a grocer's yard; not a bank or a pharmacy).
//     Whoever waited at the front waits for nothing (sim/agents.js: two minutes at the door, then lost).
// Inside, you're out of sight (a.hidden) and your feet are the shop's (sim/game.js); the time passes as
// it does. The scene hears of it, going in and coming out (scenario.onShop?.(state, bus, phase, way)):
// being tailed's team watches the door, and a back way they saw you take is written down; in Blown the
// hunters who had you wait at the front.
import { Z } from './map/street.js';
import { LINE } from './city.js';
import { sectionAt } from './world.js';
import { hash } from './rng.js';
import { say } from './log.js';
import { eat, EAT_S } from './needs.js';

export const BROWSE_S = 40;
export const BACKWAY_S = 55;
export const WASH_S = 90;
// (the kinds with a toilet a customer can use: a café's, a bar's, a restaurant's; sim/notice.js)
export const TOILETS = new Set(['cafe', 'restaurant', 'bar', 'shawarma', 'beer']);
// (the kinds where you can eat something, quickly: sim/needs.js)
export const FOOD = new Set(['cafe', 'restaurant', 'bar', 'shawarma', 'bakery', 'deli', 'grocery']);
export const DOOR_REACH_M = 0.9;
// (the kinds of shop with a way out the back, more often than not: a kitchen, a yard, a goods door)
export const BACKWAYS = { cafe: 0.85, restaurant: 0.9, bar: 0.8, shawarma: 0.8, grocery: 0.7, deli: 0.7, bakery: 0.75, beer: 0.7, clothes: 0.5, books: 0.4, shoes: 0.4, flowers: 0.5, tobacco: 0.3, phones: 0.3 };
const WORDS = { cafe: 'the café', restaurant: 'the restaurant', bar: 'the bar', shawarma: 'the shawarma place', grocery: 'the grocer\'s', deli: 'the food hall', bakery: 'the bakery', beer: 'the beer shop',
  clothes: 'the clothes shop', books: 'the bookshop', shoes: 'the shoe shop', flowers: 'the florist\'s', tobacco: 'the tobacconist\'s', phones: 'the phone shop', pharmacy: 'the pharmacy', bank: 'the bank',
  exchange: 'the exchange booth', optician: 'the optician\'s', watches: 'the watchmaker\'s' };
export const shopWord = (kind) => WORDS[kind] ?? 'the shop';

/** The shop door actor a stands at (on the street, on the pavement by it), or null. */
export function shopNear(state, a) {
  if (state.map.kind !== 'street' || a.z < Z.front - 0.3 || a.z > Z.front + 1.6) return null;
  return sectionAt(state, a.x)?.doors.find(d => d.kind === 'shop' && d.z === Z.front && Math.abs(d.x - a.x) < DOOR_REACH_M) ?? null;
}

/** Whether this shop has a way out the back (by its kind, and the door: the same every time). */
export const backWay = (state, d) => (hash(state.map.seed, state.map.row ?? 0, Math.round(d.x * 10), 'back') % 100) / 100 < (BACKWAYS[d.shop] ?? 0);

/** How you could go in: [{ id, label }]. */
export function ways(state, d) {
  const out = [{ id: 'front', label: `Into ${shopWord(d.shop)}: a minute among the shelves, and out the front` }];
  if (backWay(state, d)) out.push({ id: 'back', label: 'Through to the back: the stock room, a yard, out on the street behind' });
  const p = state.people[state.player];
  if (FOOD.has(d.shop)) out.push({ id: 'eat', label: d.shop === 'grocery' || d.shop === 'bakery' || d.shop === 'deli' ? 'Something to eat: bread, cheese, eaten by the window (two minutes)' : 'A bite and a hot drink at the counter (two minutes)' });
  if (TOILETS.has(d.shop) && p?.bloody) out.push({ id: 'wash', label: p.bloody.face ? 'The toilet: wash the blood off your face' : 'The toilet: scrub at the stain on your coat' });
  return out;
}

/** In you go: out of sight, your feet the shop's, for as long as the way takes. */
export function goIn(state, bus, me, d, way, scenario) {
  if (way === 'back' && !backWay(state, d)) way = 'front';
  if (way === 'wash' && !(TOILETS.has(d.shop) && state.people[state.player]?.bloody)) way = 'front';
  if (way === 'eat' && !FOOD.has(d.shop)) way = 'front';
  me.inside = { x: d.x, shop: d.shop, way, until: state.time.ms + (way === 'back' ? BACKWAY_S : way === 'wash' ? WASH_S : way === 'eat' ? EAT_S : BROWSE_S) * 1000, row: state.map.row ?? 0 };
  Object.assign(me, { hidden: true, vx: 0, vz: 0, busy: null, glass: false, gait: 'idle' });
  say(state, bus, { kind: 'note', text: way === 'back' ? `Into ${shopWord(d.shop)}, past the counter, a nod as if you belong, and through the door at the back.` : way === 'wash' ? `Into ${shopWord(d.shop)}, head down, straight to the toilet at the back, and the bolt across.` : `Into ${shopWord(d.shop)}. You take your time over the shelves.` });
  scenario?.onShop?.(state, bus, 'in', way);
}

/** Each tick while inside: out, when the time's up (the front: the door; the back: the street behind). */
export function insideTick(state, bus, me, scenario, { loadRow }) {
  const ins = me.inside;
  if (!ins || state.time.ms < ins.until) return;
  delete me.inside;
  me.hidden = false;
  if (ins.way === 'back') {
    const row = ins.row - 1;
    Object.assign(me, { row, x: ins.x, z: LINE.S, face: 'down', head: Math.PI / 2 });
    loadRow(state, bus, row, ins.x, { quiet: true });
    say(state, bus, { kind: 'note', text: 'A yard of bins and crates, a gate, a passage: out on the street behind, nobody on your heels.' });
  } else {
    Object.assign(me, { x: ins.x, z: Z.front + 0.7, face: 'down', head: Math.PI / 2 });
    const p = state.people[state.player];
    if (ins.way === 'eat') { eat(p, state.time.ms, 8); say(state, bus, { kind: 'note', text: 'Something hot, eaten standing up, and a minute of nobody looking at you. Better.' }); }
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
