// TRADECRAFT sim: a posting's places on its city's streets (the user, 2026-10-27, in Cairo: "took a taxi
// there, but there is no embassy?" and "I can't find my flat"). A posting (sim/campaign.js) names the
// rows; settle() picks, once and from the campaign's seed, which building on the embassy's street is the
// embassy (the widest of its first two sections) and which front door on each other place's street is
// that place's, keeps them in the posting (row, i, x), and marks them on the town (sim/map/marks.js),
// so its streets are drawn with them: the embassy's own building, the doors that are yours. Called
// whenever a campaign's game is made or loaded (sim/game.js).
import { sectionOf, forgetSections } from './city.js';
import { townOf } from './cities/index.js';
import { setMarks } from './map/marks.js';
import { Z } from './map/layout.js';
import { stream, int } from './rng.js';

export const SAFE_APART_M = 25;
const placesOf = (p) => [p.embassy, p.home, ...p.safehouses];

/** The posting's places chosen (the first time) and marked on its town. */
export function settle(c) {
  const p = c?.posting;
  if (!p) return;
  const town = townOf({ seed: p.mapSeed, city: p.city });
  if (placesOf(p).some(pl => pl.x === undefined)) {
    if (setMarks(town, [])) forgetSections(town);                   // (chosen from the streets as they'd be without)
    choose(c, town);
  }
  const marks = [];
  if (p.embassy.i !== undefined) marks.push({ kind: 'embassy', row: p.embassy.row, i: p.embassy.i, b: p.embassy.b });
  for (const pl of [p.home, ...p.safehouses]) if (pl.i !== undefined) marks.push({ kind: 'door', row: pl.row, i: pl.i, x: pl.x, place: pl.id });
  if (setMarks(town, marks)) forgetSections(town);
}

function choose(c, town) {
  const p = c.posting;
  // The embassy: the widest building on the front of its street's first two sections (no mosque, no church).
  const lots = [0, 1].flatMap(i => sectionOf(town, p.embassy.row, i).buildings.map((B, b) => ({ i, b, B })))
    .filter(o => o.B.z === Z.front && !o.B.minaret && !o.B.dome && !o.B.spire && o.B.style !== 'station');
  const best = lots.sort((a, b) => (b.B.x1 - b.B.x0) - (a.B.x1 - a.B.x0))[0];
  if (best) Object.assign(p.embassy, { i: best.i, b: best.b, x: (best.B.x0 + best.B.x1) / 2, z: best.B.z });
  else p.embassy.x = 12;
  // The flat, the safe houses: a block's front door each, never the same one twice, and a safe house
  // never a few doors from the flat (one tail to the flat, and they'd have both).
  const taken = new Set();
  for (const pl of [p.home, ...p.safehouses]) {
    const near = (d) => pl !== p.home && p.home.row === pl.row && Math.abs(d.x - p.home.x) < SAFE_APART_M;
    // (the street's first two sections; a street of nothing but shops there, further out, both ways)
    let free = [];
    for (const span of [[0, 1], [-1, 2], [-2, 3], [-3, 4]]) {
      free = free.concat(span.flatMap(i => sectionOf(town, pl.row, i).doors.filter(d => d.kind === 'entrance' && !d.mosque && !near(d)).map(d => ({ i, d })))
        .filter(o => !taken.has(`${pl.row}:${o.d.x}`)));
      if (free.length) break;
    }
    const front = free.filter(o => o.d.z === Z.front), pool = front.length ? front : free;
    const o = pool.length ? pool[int(stream('place', c.seed, pl.id), pool.length)] : null;
    if (o) { taken.add(`${pl.row}:${o.d.x}`); Object.assign(pl, { i: o.i, x: o.d.x, z: o.d.z }); }
    else pl.x = 12;
  }
}

/** What a place is called on the street, over its door. */
export const signOf = (pl) => (pl.id === 'embassy' ? 'US Embassy' : pl.id === 'home' ? 'Home' : 'Safe house');
