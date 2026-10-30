// TRADECRAFT sim: a posting's places on its city's streets (the user, 2026-10-27, in Cairo: "took a taxi
// there, but there is no embassy?" and "I can't find my flat"). A posting (sim/campaign.js) names the
// rows; settle() picks, once and from the campaign's seed, which building on the embassy's street is the
// embassy (the widest of its first two sections) and which front door on each other place's street is
// that place's, keeps them in the posting (row, i, x), and marks them on the town (sim/map/marks.js),
// so its streets are drawn with them: the embassy's own building, the doors that are yours. Called
// whenever a campaign's game is made or loaded (sim/game.js).
// **Where the assignments happen** (missionPlace(); the user, 2026-10-29: "we should be able to go to our
// mission without using the fast travel shortcut in TAB"): an assignment in the posting's own city has a
// place on its streets (a.at: { row, x, z, kind, label }), chosen once from the campaign's seed and kept
// with it: a tail at the target's office door (officeOf(): the same door every time he's followed), an
// asset meeting at a bench (in a park, where the street has one), a photograph at the café he meets at.
// A street within MISSION_ROWS of the flat, never the flat's own or the embassy's. You get there
// yourself; at it in its hour, T begins it (sim/scenarios/campaign.js), and the scene is played there.
import { sectionOf, forgetSections } from './city.js';
import { townOf } from './cities/index.js';
import { setMarks } from './map/marks.js';
import { Z } from './map/layout.js';
import { placeName, streetName } from './map/street.js';
import { stream, int, pick } from './rng.js';
import { DAY } from './clock.js';

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

export const MISSION_ROWS = 6;
const CAFES = ['cafe', 'restaurant', 'bar', 'pub', 'juice'];

/** Where an assignment in the posting's city happens (a.at, chosen the first time): null for a trip abroad. */
export function missionPlace(c, a) {
  if (a.at !== undefined || a.trip) return a.at ?? null;
  const p = c.posting, town = townOf({ seed: p.mapSeed, city: p.city });
  if (a.kind === 'tail') { const t = p.targets.find(x => x.id === a.who); return (a.at = t ? officeOf(c, t) : null); }
  // (never a place another assignment has had, two weeks either side: the same bench twice, or the same
  // park, is how a network's found; with none fresh to be had, any)
  const near = [...new Set([...c.assignments, ...c.done])].filter(x => x !== a && x.at && Math.abs(x.from - a.from) < 14 * DAY);
  const used = new Set(near.map(x => x.at.label)), r = stream('mission-place', c.seed, a.id);
  for (const strict of [true, false]) for (let k = 0; k < 12; k++) {
    const row = rowFor(c, r), i0 = int(r, 8) - 3;
    for (const i of [i0, i0 + 1, i0 - 1, i0 + 2]) {
      const S = sectionOf(town, row, i);
      if (a.kind === 'sdr') {
        const b = (k < 6 ? S.band === 'park' : true) && pick(r, S.props.filter(q => q.kind === 'bench'));
        // (its park by name, and its street: a city's parks can share a name)
        const label = b && `A bench in ${placeName(town, row, b.x, 14)}, by ${streetName(town, row)}`;
        if (b && (!strict || !used.has(label))) return (a.at = { row, x: b.seats[0], z: 12.96, seats: b.seats.slice(), kind: 'bench', label });
      } else {
        const d = pick(r, S.doors.filter(o => o.kind === 'shop' && o.z === Z.front && (k < 8 ? CAFES.includes(o.shop) : true)));
        const label = d && `Outside a ${d.shop === 'cafe' ? 'café' : d.shop} on ${streetName(town, row)}`;
        if (d && (!strict || !used.has(label))) return (a.at = { row, x: d.x, z: Z.front + 0.8, shop: d.shop, kind: 'cafe', label });
      }
    }
  }
  return (a.at = null);
}

/** A target's office: a block's front door on a street of the posting's city, the same every time (t.office). */
export function officeOf(c, t) {
  if (t.office) return t.office;
  const p = c.posting, town = townOf({ seed: p.mapSeed, city: p.city }), r = stream('office', c.seed, t.id);
  const ours = (row, x) => [p.home, ...p.safehouses].some(pl => pl.row === row && Math.abs((pl.x ?? 1e9) - x) < SAFE_APART_M);
  for (let k = 0; k < 12; k++) {
    const row = rowFor(c, r), i0 = int(r, 8) - 3;
    const doors = [i0, i0 + 1].flatMap(i => sectionOf(town, row, i).doors).filter(d => d.kind === 'entrance' && d.z === Z.front && !d.mosque && !ours(row, d.x));
    // (its words his file's, sim/dossier.js: "The trade delegation on Sretenka", "Rudnev's chambers on …")
    const words = t.workplace ? t.workplace.replace(/^his /, `${t.name.split(' ').slice(-1)[0]}'s `) : `${t.name}'s office`;
    if (doors.length) { const d = doors[int(r, doors.length)]; return (t.office = { row, x: d.x, z: d.z, kind: 'office', label: `${words.charAt(0).toUpperCase()}${words.slice(1)} on ${streetName(town, row)}` }); }
  }
  return (t.office = { row: p.embassy.row + 1, x: 20, z: Z.front, kind: 'office', label: `${t.name}'s office` });
}

// (a street for it: within MISSION_ROWS of the flat, not the flat's, not the embassy's)
function rowFor(c, r) {
  const p = c.posting, rows = [];
  for (let d = -MISSION_ROWS; d <= MISSION_ROWS; d++) { const row = p.home.row + d; if (row !== p.home.row && row !== p.embassy.row) rows.push(row); }
  return rows[int(r, rows.length)];
}
