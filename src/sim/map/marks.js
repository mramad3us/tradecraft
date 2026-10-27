// TRADECRAFT sim: marks on a town's streets, the few places on them that aren't like the rest: a
// posting's embassy, the flat, the safe houses (sim/places.js says which; sim/map/street.js section()
// reads them). Kept by town (sim/cities/index.js townOf()), set when a campaign's game is made or
// loaded; a town with none, as every mechanic test's, is exactly as generated.
//   - { kind: 'embassy', row, i, b }: section i's building b is the embassy (sim/cities/embassy.js);
//   - { kind: 'door', row, i, x, place }: the entrance at x is someone's (door.place: 'home', 'sh0'…).
const marks = new Map(), NONE = [];

/** A town's marks set (an empty list clears them). Returns whether they changed. */
export function setMarks(town, list) {
  if (JSON.stringify(marks.get(town) ?? NONE) === JSON.stringify(list)) return false;
  if (list.length) marks.set(town, list); else marks.delete(town);
  return true;
}

/** The marks in section i of row `row` of a town. */
export const marksAt = (town, row, i) => marks.get(town)?.filter(m => m.row === row && m.i === i) ?? NONE;
