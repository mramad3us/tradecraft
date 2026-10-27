// TRADECRAFT sim: things lying about, and things carried (the user, 2026-10-26: "create variety of knives
// and improvised weapons to populate the world with"). What they do in a fight is sim/weapons.js and
// sim/cqc.js; how they look, src/render/items.js and src/art/sprites.js.
//
// **Lying about.** Each section of a street has its loose things, made from the city's seed, the row and
// the section alone (sectionItems(): its own stream, so the street's own dice never move), placed by
// what the street has there (PLACES): bottles by the bins; pipes, bricks, a spanner, now and then a
// crowbar or a bike lock, down the alleys; a snow shovel or a brick by a courtyard's arch; a fallen
// stick under the trees; a box cutter or a screwdriver dropped by a shop's door; junk along the hedge.
// Each has an id (`${row}:${i}:${n}`); one picked up is gone from there for good (state.items.taken);
// whatever's dropped (or knocked out of a hand in a fight) lies where it fell (state.items.dropped).
// Nothing is placed inside anything (the section's blockers).
//
// **Carried.** A person's p.hand is what they hold (a weapon kind, or nothing) and p.items what they
// carry (kinds), each where it fits (sim/weapons.js carry) and only if there's room (room()): POCKETS in
// the trousers, more in a coat or a jacket; BELT_SLOTS in the beltline, under whatever's on top; no
// bags yet. A pipe is held or put down. (Volumes, clothes and money are the inventory's, to come.) Passers-by mostly carry nothing to fight
// with; some men a penknife, fewer a switchblade or a box cutter (armsOf(): from their seed, its own
// stream, so who they are doesn't change).
//   - pickUp(): into the hand; what was in it goes where it's carried, or is dropped;
//   - draw(): the next weapon carried into the hand, and the hand's put away (G); stow(), drop().
import { mouthOf } from './map/street.js';
import { townOf } from './cities/index.js';
import { stream, hash, int, chance, pick, range, weighted } from './rng.js';
import { WEAPONS, weaponOf } from './weapons.js';
import { say } from './log.js';

export const POCKETS = { base: 2, coat: 2, suit: 2, jacket: 2 };   // (the trousers', and what a top adds)
export const BELT_SLOTS = 2;
/** Room left where a weapon of this carry goes: pockets by the clothes, the beltline's slots. */
export function room(p, carry) {
  const used = (p.items ?? []).filter(k => weaponOf(k)?.carry === carry).length;
  if (carry === 'pocket') return POCKETS.base + (POCKETS[p.look?.top?.kind] ?? 0) - used;
  if (carry === 'belt') return BELT_SLOTS - used;
  return 0;
}
export const REACH_M = 1.1;                                        // close enough to pick up

/**
 * Where things lie, by what's there: [chance, what (weighted), where]. Picked per place, in order;
 * `at` gives a spot near the place (x, z) for a die r.
 */
const PLACES = {
  bin: [0.3, [['bottle', 6], ['brokenbottle', 2], ['boxcutter', 0.5]]],
  alley: [0.7, [['pipe', 4], ['brick', 4], ['bottle', 2], ['spanner', 1.5], ['stick', 1.5], ['crowbar', 1.5], ['bikelock', 1], ['chain', 1], ['hammer', 1], ['kitchen', 0.2]]],
  arch: [0.3, [['shovel', 4], ['brick', 3], ['bottle', 2], ['stick', 1], ['pipe', 1], ['umbrella', 1]]],
  tree: [0.012, [['stick', 1]]],
  shop: [0.05, [['boxcutter', 2], ['screwdriver', 1]]],
  hedge: [0.15, [['bottle', 3], ['brick', 2], ['pipe', 1], ['brokenbottle', 1], ['stick', 1]]],
};

/** The loose things of section S (sim/map/street.js section()) of the city `seed`: [{ id, kind, x, z }]. */
export function sectionItems(seed, S) {
  const r = stream('items', seed, S.row ?? 0, S.i), out = [];
  const free = (x, z) => !S.blockers.some(b => x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15);
  const put = (place, x, z) => {
    const [p, kinds] = PLACES[place];
    if (!chance(r, p)) return;
    const kind = weighted(r, kinds);
    for (let k = 0; k < 6; k++) {                                   // (a spot near it that's clear)
      const px = x + range(r, -0.9, 0.9), pz = z + range(r, -0.6, 0.6);
      if (px > S.x0 + 0.3 && px < S.x1 - 0.3 && free(px, pz)) { out.push({ id: `${S.row ?? 0}:${S.i}:${out.length}`, kind, x: round(px), z: round(pz) }); return; }
    }
  };
  for (const p of S.props) {
    if (p.kind === 'bin') put('bin', p.x, p.z + 0.6);
    else if (p.kind === 'tree') put('tree', p.x + 0.6, p.z + 0.5);
    else if (p.kind === 'hedge') for (let x = p.x0 + 4; x < p.x1 - 2; x += 12) put('hedge', x, p.z + 1.4);
  }
  for (const g of S.gapsN ?? []) if (g.kind === 'alley') put('alley', (mouthOf(g).x0 + mouthOf(g).x1) / 2, g.jog ? range(r, g.jog.z + 1, -9) : range(r, -26, -9));   // (a dogleg's: before its turn)
  for (const d of S.doors) {
    if (d.kind === 'arch') put('arch', d.x, d.z + 0.8);
    else if (d.kind === 'shop') put('shop', d.x + 0.8, d.z + 0.7);
  }
  return out;
}
const round = (v) => Math.round(v * 100) / 100;

/** The things lying on the row's sections in play, less what's been taken, plus what's been dropped there. */
export function lyingAbout(state) {
  const W = state.$world, row = state.map.row ?? 0, taken = state.items?.taken ?? {}, out = [];
  if (state.map.kind === 'street' && W) for (const S of W.sections.values()) for (const it of (S.$items ??= sectionItems(townOf(state.map), S))) if (!taken[it.id]) out.push(it);
  for (const it of state.items?.dropped ?? []) if (it.row === row && state.map.kind === (it.map ?? 'street')) out.push(it);
  return out;
}

/** The nearest thing lying within REACH_M of actor a, or null. */
export function itemNear(state, a) {
  let best = null, bd = REACH_M;
  for (const it of lyingAbout(state)) { const d = Math.hypot(it.x - a.x, it.z - a.z); if (d < bd) { bd = d; best = it; } }
  return best;
}

/** Take it off the ground (gone from there), into p's hand; what was in hand goes where it's carried, or down where it was. Returns what was dropped, if anything. */
export function pickUp(state, p, a, it) {
  const items = state.items ??= { taken: {}, dropped: [] };
  const i = items.dropped.indexOf(it);
  if (i >= 0) items.dropped.splice(i, 1); else items.taken[it.id] = state.time.ms;
  let off = null;
  if (p.hand) off = stow(p) ? null : drop(state, p, a);
  p.hand = it.kind;
  return off;
}

/** The hand's weapon put away where it's carried: true if it had somewhere to go. */
export function stow(p) {
  const w = weaponOf(p.hand);
  if (!w) return false;
  if (room(p, w.carry) <= 0) return false;
  (p.items ??= []).push(p.hand);
  p.hand = null;
  return true;
}

/** Drop what's in the hand where actor a stands; it lies there. Returns the dropped item. */
export function drop(state, p, a, kind = p.hand) {
  if (!kind) return null;
  if (p.hand === kind) p.hand = null;
  const items = state.items ??= { taken: {}, dropped: [] };
  const it = { id: `d${hash(state.tick, a.id, kind)}`, kind, row: state.map.row ?? 0, map: state.map.kind, x: round(a.x + range(state.rng, -0.4, 0.4)), z: round(a.z + range(state.rng, 0.1, 0.5)) };
  items.dropped.push(it);
  if (items.dropped.length > 60) items.dropped.shift();
  return it;
}

/** The next weapon carried into the hand (the hand's put away first, or dropped); none left, the hand empty. Returns what's in hand. */
export function draw(state, p, a) {
  const list = p.items ?? [];
  const was = p.hand;
  if (was && !stow(p)) drop(state, p, a);
  const i = list.findIndex(k => weaponOf(k) && k !== was);
  if (i < 0) return p.hand;                                         // (only the one: it's put away; or nothing to draw)
  p.hand = list.splice(i, 1)[0];
  return p.hand;
}

/**
 * The player's hands and pockets, from a key or the inventory (sim/game.js): 'draw' (G: the next one
 * out, or put away), 'wield:<kind>' (that one out), 'stow' (put away), 'drop:<kind>'. A line in the log.
 */
export function use(state, bus, a, cmd) {
  const p = state.people[a.who], [verb, kind] = cmd.split(':'), was = p.hand;
  if (verb === 'draw') {
    const now = draw(state, p, a), down = was && was !== now && !(p.items ?? []).includes(was);   // (held only: it went on the ground)
    const put = was && (down ? `You put ${weaponOf(was).name} down: it won't go in a pocket.` : `You put ${weaponOf(was).name} away.`);
    if (now !== was) say(state, bus, { kind: 'note', text: now ? `${put && down ? `${put} ` : ''}You take out ${weaponOf(now).name}.` : put });
  } else if (verb === 'wield' && (p.items ?? []).includes(kind)) {
    if (was && !stow(p)) drop(state, p, a);
    p.items.splice(p.items.indexOf(kind), 1);
    p.hand = kind;
    say(state, bus, { kind: 'note', text: `You take out ${weaponOf(kind).name}.` });
  } else if (verb === 'stow' && was) {
    say(state, bus, { kind: 'note', text: stow(p) ? `You put ${weaponOf(was).name} away.` : `Nowhere to put ${weaponOf(was).name}.` });
  } else if (verb === 'drop' && kind) {
    if (p.hand !== kind && (p.items ?? []).includes(kind)) { p.items.splice(p.items.indexOf(kind), 1); drop(state, p, a, kind); }
    else if (p.hand === kind) drop(state, p, a);
    else return;
    say(state, bus, { kind: 'note', text: `You drop ${weaponOf(kind).name}.` });
  }
}

/** What a passer-by carries to fight with, from their seed (its own stream): mostly nothing. */
export function armsOf(seed, sex) {
  const r = stream('arms', seed);
  const roll = int(r, 1000) / 1000, men = sex === 'm';
  if (roll < (men ? 0.05 : 0.01)) return ['penknife'];
  if (roll < (men ? 0.065 : 0.015)) return [pick(r, ['switchblade', 'boxcutter'])];
  if (roll < (men ? 0.07 : 0.017)) return ['screwdriver'];
  return [];
}

/** Every kind there is, for the tests and the art. */
export const KINDS = Object.keys(WEAPONS);
