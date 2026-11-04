// TRADECRAFT sim: the words on a city's signs (sim/cities/): how wide they'll paint, and which of a
// shop's ways of saying it fits its board; and the colours a police station's and a hospital's boards
// wear in every city (livery()), so they're known at a glance across a street.
import { pick } from '../rng.js';

// (a police station's: navy, white letters; a hospital's: white, green letters (no cross: the emblems are the Red Cross's
// and the Red Crescent's); a board's [ground, letters, border], a banner's [ground, letters, band])
export const LIVERY = { police: [0x283f6b, 0xf6f4ee, 0x1b2541], hospital: [0xf6f4ee, 0x24503a, 0x356f42], clinic: [0xf6f4ee, 0x24503a, 0x356f42] };
/** A board's colours for a shop of this kind: its livery (LIVERY), or the ones drawn for it (drawn first, so the streets' dice are as they were). */
export const livery = (kind, drawn) => LIVERY[kind] ?? drawn;
/** A board's style for a shop of this kind: a liveried one's on a board where the dice said letters on the wall (white letters lost on pale plaster). */
export const boardOf = (kind, drawn) => (LIVERY[kind] && drawn === 'letters' ? 'board' : drawn);

/** How wide words paint in the sign font (src/art/pixelart.js text(): 3 × 5 letters, M W & five; Arabic about 3.6 px a letter), in metres. */
export const wordM = (s) => (/[\u0600-\u06FF]/.test(s) ? [...s].length * 3.6 : [...s].reduce((a, c) => a + ('MW&'.includes(c) ? 6 : c === ' ' ? 3 : 4), -1)) / 16;

/** One of a shop's signs (['عربي|LATIN', 'LATIN', …]) that fits a board wM metres wide: both scripts side by side, or the first alone; else the shortest. */
export function fit(r, words, wM) {
  const ok = words.filter(w => w.split('|').reduce((a, p) => a + wordM(p), 0) + 0.5 <= wM || wordM(w.split('|')[0]) <= wM - 0.3);
  return ok.length ? pick(r, ok) : words.reduce((a, b) => (wordM(a.split('|')[0]) <= wordM(b.split('|')[0]) ? a : b)).split('|')[0];
}
