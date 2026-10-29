// TRADECRAFT sim: what the officer knows of their city, and where they mean to go (the user, 2026-10-28: "The
// mindmap should have a section with an actual map (known only again, it's our mind) where we can select
// waypoints"; "a way to set a waypoint like our flat to get directions there"; its places "stores all
// kinds, flat, safehouses, workplace, activites/clubs").
//
// **Known** (c.known: 'row|i' → 1): a stretch of street is known once walked, every section within SEEN_M
// of where you've been on foot (learnTick(): once a second, in the campaign's city; a trip abroad's streets
// aren't London's). What's on a known stretch is known (knownPlaces()): its shops by what they are
// (KINDS: food, clothes, books, a bank, a gym or a club, a school, phones, an optician, a chemist,
// anything else), a metro station's doors, a bus stop's shelter. The posting's own places are known from
// the start: the flat, the embassy (where you work), the safe houses (sim/places.js puts their doors).
// **The waypoint** (c.waypoint: { row, x, z, label, kind }): one place chosen on the mind's map; the goal
// pointer leads there (sim/scenarios/campaign.js goal()) until you're at its door, or it's cleared.
import { sectionOf } from './city.js';
import { townOf } from './cities/index.js';
import { SECTION_M, Z, streetName } from './map/street.js';
import { places } from './campaign.js';
import { signOf } from './places.js';
import { shopWord } from './shops.js';

export const SEEN_M = 40, ARRIVED_M = 4;
// (what a kind of shop is, to the mind's map: its group, and the group's word)
const GROUP = {
  food: ['grocery', 'deli', 'vegetables', 'spices', 'butcher', 'bakery', 'sweets', 'manakish', 'cafe', 'restaurant', 'bar', 'pub', 'shawarma', 'kebab', 'chips', 'koshary', 'foul', 'juice', 'beer'],
  clothes: ['clothes', 'shoes'], books: ['books'], bank: ['bank', 'exchange'], club: ['gym', 'club'], school: ['school'], phones: ['phones'], optician: ['optician'], chemist: ['pharmacy'],
};
export const KINDS = { food: 'food and drink', clothes: 'clothes', books: 'books', bank: 'banks', club: 'gyms and clubs', school: 'schools', phones: 'phones', optician: 'opticians', chemist: 'chemists', other: 'other shops', metro: 'the metro', bus: 'bus stops', home: 'home', work: 'work', safe: 'safe houses' };
const groupOf = (shop) => Object.keys(GROUP).find(g => GROUP[g].includes(shop)) ?? 'other';

/** Once a second: the stretch round you, known (in the campaign's own city, on foot). */
export function learnTick(state) {
  const c = state.campaign, me = state.actors.find(a => a.who === state.player);
  if (!c || !me || me.hidden || state.map.kind !== 'street' || state.map.seed !== c.posting.mapSeed) return;
  const row = state.map.row ?? 0, known = (c.known ??= {});
  for (let i = Math.floor((me.x - SEEN_M) / SECTION_M); i <= Math.floor((me.x + SEEN_M) / SECTION_M); i++) known[`${row}|${i}`] = 1;
}

/** Whether a stretch is known. */
export const knows = (c, row, i) => !!c.known?.[`${row}|${i}`];

/**
 * Everything the mind's map can show: [{ id, kind (KINDS), label, row, x, z, i }]: the posting's places,
 * and on every known stretch its shops, its metro station, its bus stop.
 */
export function knownPlaces(c) {
  const town = townOf({ seed: c.posting.mapSeed, city: c.posting.city }), out = [];
  for (const pl of places(c)) if (pl.x !== undefined) out.push({ id: pl.id, kind: pl.id === 'home' ? 'home' : pl.id === 'embassy' ? 'work' : 'safe', label: signOf(pl), row: pl.row, x: pl.x, z: pl.z ?? Z.front, i: Math.floor(pl.x / SECTION_M) });
  for (const key of Object.keys(c.known ?? {})) {
    const [row, i] = key.split('|').map(Number), S = sectionOf(town, row, i);
    for (const d of S.doors) {
      if (d.kind === 'shop' && d.z === Z.front) out.push({ id: `${row}:${Math.round(d.x * 10)}`, kind: groupOf(d.shop), label: cap(shopWord(d.shop)), shop: d.shop, row, x: d.x, z: d.z, i });
      else if (d.kind === 'metro') out.push({ id: `m${row}:${i}`, kind: 'metro', label: `The ${c.posting.city === 'london' ? 'Underground' : 'metro'}`, row, x: d.x, z: d.z, i });
    }
    for (const st of S.props.filter(q => q.kind === 'stop')) out.push({ id: `b${row}:${Math.round(st.x)}`, kind: 'bus', label: `A bus stop: the ${(st.lines ?? []).join(', ')}`, row, x: st.x, z: st.z, i });
  }
  return out;
}

/** The streets known: [{ row, name, i0, i1 }], north to south (a street's known stretches as one span, for the map). */
export function knownStreets(c) {
  const town = townOf({ seed: c.posting.mapSeed, city: c.posting.city }), rows = new Map();
  for (const key of Object.keys(c.known ?? {})) {
    const [row, i] = key.split('|').map(Number), r = rows.get(row) ?? { row, name: streetName(town, row), sections: [] };
    r.sections.push(i);
    rows.set(row, r);
  }
  return [...rows.values()].sort((a, b) => a.row - b.row);
}

/** Set the waypoint (a place of knownPlaces()), or clear it (null). */
export function setWaypoint(c, pl) {
  if (!pl) { delete c.waypoint; return; }
  c.waypoint = { row: pl.row, x: pl.x, z: pl.z, label: pl.label, kind: pl.kind };
}

/** There: the waypoint reached and cleared; returns whether it was. */
export function arrived(state) {
  const c = state.campaign, w = c?.waypoint, me = state.actors.find(a => a.who === state.player);
  if (!w || !me || state.map.kind !== 'street' || (state.map.row ?? 0) !== w.row || Math.hypot(me.x - w.x, me.z - (w.z ?? Z.front)) > ARRIVED_M) return false;
  delete c.waypoint;
  return true;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
