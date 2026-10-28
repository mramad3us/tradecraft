// TRADECRAFT sim: which shops have a way out the back, and where it comes out (sim/shops.js the going,
// sim/interiors/shop.js the back door; the street, sim/map/street.js, sets the door in the back room's
// wall). By the kind of shop (BACKWAYS: a café's kitchen door, a grocer's yard; never a bank or a
// pharmacy) and the door (a hash: the same every time), and only with a lane beside to come out in:
// the side street or alley nearest the shop on its street (within BACK_REACH_M), BACK_IN_M up it. Pure,
// from the town, the row and the door alone.
import { Z, gapsOf, mouthOf, inLane, SECTION_M } from './map/street.js';
import { hash } from './rng.js';

export const BACK_REACH_M = 30, BACK_IN_M = 7;
// (the kinds of shop with a way out the back, more often than not: a kitchen, a yard, a goods door)
export const BACKWAYS = { cafe: 0.85, restaurant: 0.9, bar: 0.8, shawarma: 0.8, grocery: 0.7, deli: 0.7, bakery: 0.75, beer: 0.7, clothes: 0.5, books: 0.4, shoes: 0.4, flowers: 0.5, tobacco: 0.3, phones: 0.3,
  kebab: 0.8, chips: 0.8, pub: 0.8, koshary: 0.8, foul: 0.8, juice: 0.6, sweets: 0.6, manakish: 0.7, vegetables: 0.6, butcher: 0.6, gym: 0.4, club: 0.4 };

/** The lane a shop's back way comes out in: { x, z } up the side street or alley nearest door d, or null. */
export function backLaneAt(town, row, d) {
  const i = Math.floor(d.x / SECTION_M);
  let best = null;
  for (const j of [i - 1, i, i + 1]) for (const g of gapsOf(town, row, j)) {
    const m = mouthOf(g), x = (m.x0 + m.x1) / 2, z = Math.max(Z.front - BACK_IN_M, (m.z ?? -Infinity) + 0.8), dist = Math.abs(x - d.x);
    if (dist < BACK_REACH_M && inLane(g, x, z) && (!best || dist < best.dist)) best = { dist, x, z };
  }
  return best;
}

/** Whether shop door d has a way out the back: its kind's chance, by a hash of the door; and a lane to come out in. */
export const backWayAt = (town, row, d) => (hash(town, row, Math.round(d.x * 10), 'back') % 100) / 100 < (BACKWAYS[d.shop] ?? 0) && !!backLaneAt(town, row, d);
