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
// asset meeting at a bench (in a park, where the street has one), a photograph at the café he meets at, an extraction's
// pickup at a bench too (sim/kinetic.js: whoever's to be brought out waits on it), NEAR_ROWS from the safe house the station
// means you to use.
// A street within MISSION_ROWS of the flat, never the flat's own or the embassy's. You get there
// yourself; at it in its hour, T begins it (sim/scenarios/campaign.js), and the scene is played there.
// Hale's evening at the range (sim/lessons.js place 'range') is at a range's door (a shop of that kind, sim/shops.js):
// the nearest the flat (rangeOf(): RANGE_ROWS either way, RANGE_SECTIONS along), the same club every time.
import { sectionOf, forgetSections } from './city.js';
import { townOf } from './cities/index.js';
import { setMarks } from './map/marks.js';
import { Z } from './map/layout.js';
import { placeName, streetName } from './map/street.js';
import { stream, int, pick } from './rng.js';
import { DAY } from './clock.js';
import { lessonBook } from './lessons.js';
import { RANGE_NAMES } from './interiors/range.js';

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
  if (p.embassy.i !== undefined && !p.embassy.door) marks.push({ kind: 'embassy', row: p.embassy.row, i: p.embassy.i, b: p.embassy.b });
  for (const pl of [p.home, ...p.safehouses, ...(p.embassy.door ? [p.embassy] : [])]) if (pl.i !== undefined) marks.push({ kind: 'door', row: pl.row, i: pl.i, x: pl.x, place: pl.id });
  if (setMarks(town, marks)) forgetSections(town);
}

function choose(c, town) {
  const p = c.posting;
  // The embassy: the widest building on the front of its street's first two sections (no mosque, no church). A deep posting's
  // workplace in its place (p.embassy.door: a legend's employer, sim/legends.js) is a plain front door, as the flat's is.
  if (!p.embassy.door) {
    const lots = [0, 1].flatMap(i => sectionOf(town, p.embassy.row, i).buildings.map((B, b) => ({ i, b, B })))
      .filter(o => o.B.z === Z.front && !o.B.minaret && !o.B.dome && !o.B.spire && o.B.style !== 'station');
    const best = lots.sort((a, b) => (b.B.x1 - b.B.x0) - (a.B.x1 - a.B.x0))[0];
    if (best) Object.assign(p.embassy, { i: best.i, b: best.b, x: (best.B.x0 + best.B.x1) / 2, z: best.B.z });
    else p.embassy.x = 12;
  }
  // The flat, the safe houses: a block's front door each, never the same one twice, and a safe house
  // never a few doors from the flat (one tail to the flat, and they'd have both).
  const taken = new Set();
  for (const pl of [p.home, ...p.safehouses, ...(p.embassy.door ? [p.embassy] : [])]) {
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
export const signOf = (pl) => pl.sign ?? (pl.id === 'embassy' ? 'US Embassy' : pl.id === 'home' ? 'Home' : 'Safe house');   // (a legend's workplace: its employer's plate)

export const MISSION_ROWS = 6;
const CAFES = ['cafe', 'restaurant', 'bar', 'pub', 'juice'];

/** Where an assignment in the posting's city happens (a.at, chosen the first time): null for a trip abroad. */
export function missionPlace(c, a) {
  if (a.at !== undefined || a.trip) return a.at ?? null;
  const p = c.posting, town = townOf({ seed: p.mapSeed, city: p.city });
  if (a.kind === 'tail') { const t = p.targets.find(x => x.id === a.who); return (a.at = t ? officeOf(c, t) : null); }
  // (Hale's exercises, sim/lessons.js: the door its scene's laid out from, on the posting's row 0; else a bench, or a door)
  const L = a.kind === 'lesson' ? lessonBook(a.lesson) : null;
  if (L?.place === 'entrance0' || L?.place === 'door0') {
    const doors = [0, 1].flatMap(i => sectionOf(town, 0, i).doors);
    const d = L.place === 'entrance0' ? doors.find(o => o.kind === 'entrance' && o.z === Z.front) ?? { x: 14 } : doors.find(o => o.x > 14 && o.x < 26 && o.kind !== 'arch' && o.z === Z.front) ?? { x: 20 };
    return (a.at = { row: 0, x: d.x, z: Z.front + 0.8, kind: 'door', label: `${L.place === 'entrance0' ? 'A block\'s door' : 'A door'} on ${streetName(town, 0)}` });
  }
  if (L?.place === 'range') { const d = rangeDoor(c); return (a.at = d ? { ...d } : null); }   // (the posting's club, the same every time: its own copy)
  const kind = L ? (L.place === 'bench' ? 'sdr' : 'door') : a.kind === 'extract' ? 'sdr' : a.kind;   // (an extraction's pickup: a bench, as a meeting's: sim/kinetic.js)
  // (never a place another assignment has had, two weeks either side: the same bench twice, or the same
  // park, is how a network's found; with none fresh to be had, any)
  const near = [...new Set([...c.assignments, ...c.done])].filter(x => x !== a && x.at && Math.abs(x.from - a.from) < 14 * DAY);
  const used = new Set(near.map(x => x.at.label)), r = stream('mission-place', c.seed, a.id);
  for (const strict of [true, false]) for (let k = 0; k < 12; k++) {
    const row = rowFor(c, r, a), i0 = int(r, 8) - 3;
    for (const i of [i0, i0 + 1, i0 - 1, i0 + 2]) {
      const S = sectionOf(town, row, i);
      if (kind === 'sdr') {
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

// (ranges are few on the streets, a shop in a few hundred: where none's within reach, the club's range is down in the
// basement of a sports club's building, a gym's or a fight club's, its door the club's: RANGE_UNDER)
export const RANGE_ROWS = 6, RANGE_SECTIONS = 8, RANGE_UNDER = ['gym', 'club'], RANGE_PREFER_M = 240;   // (a range of its own, if it's no more than this further than a club's)
/**
 * The range nearest the flat (a shop door of its kind, sim/shops.js; or, none within RANGE_ROWS, the range under the
 * nearest gym or club), kept (posting.range): { row, x, z, shop, kind: 'range', label }, or null.
 */
export function rangeDoor(c) {
  const p = c.posting;
  if (p.range !== undefined) return p.range;
  const town = townOf({ seed: p.mapSeed, city: p.city }), hx = p.home.x ?? 0, found = { range: null, under: null };
  for (let k = 0; k <= RANGE_ROWS; k++) for (const row of k ? [p.home.row - k, p.home.row + k] : [p.home.row]) for (let i = -RANGE_SECTIONS; i <= RANGE_SECTIONS; i++) {
    for (const d of sectionOf(town, row, i).doors) {
      const which = d.kind !== 'shop' || d.z !== Z.front ? null : d.shop === 'range' ? 'range' : RANGE_UNDER.includes(d.shop) ? 'under' : null;
      if (!which) continue;
      const far = Math.abs(row - p.home.row) * 80 + Math.abs(d.x - hx);   // (a street over is about a block's walk)
      if (!found[which] || far < found[which].far) found[which] = { far, row, x: d.x, shop: d.shop };
    }
  }
  const R = found.range, U = found.under, o = R && (!U || R.far <= U.far + RANGE_PREFER_M) ? R : U ?? R, name = cap(RANGE_NAMES[p.city] ?? 'the range');
  return (p.range = o && { row: o.row, x: o.x, z: Z.front + 0.8, shop: o.shop, kind: 'range', label: o.shop === 'range' ? `${name} on ${streetName(town, o.row)}` : `${name}, down under the ${o.shop === 'gym' ? 'gym' : 'club'} on ${streetName(town, o.row)}` });
}
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

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
function rowFor(c, r, a = null) {
  const p = c.posting, rows = [], near = a?.mission?.near;
  // (an extraction's bench: the station picks one within NEAR_ROWS of the safe house it means you to use, sim/kinetic.js)
  if (near !== undefined) { for (let d = -NEAR_ROWS; d <= NEAR_ROWS; d++) { const row = near + d; if (row !== p.home.row && row !== p.embassy.row) rows.push(row); } if (rows.length) return rows[int(r, rows.length)]; }
  for (let d = -MISSION_ROWS; d <= MISSION_ROWS; d++) { const row = p.home.row + d; if (row !== p.home.row && row !== p.embassy.row) rows.push(row); }
  return rows[int(r, rows.length)];
}
export const NEAR_ROWS = 2;
