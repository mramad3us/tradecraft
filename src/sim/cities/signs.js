// TRADECRAFT sim: the words on a city's signs (sim/cities/): how wide they'll paint, and which of a
// shop's ways of saying it fits its board.
import { pick } from '../rng.js';

/** How wide words paint in the sign font (src/art/pixelart.js text(): 3 × 5 letters, M W & five; Arabic about 3.6 px a letter), in metres. */
export const wordM = (s) => (/[\u0600-\u06FF]/.test(s) ? [...s].length * 3.6 : [...s].reduce((a, c) => a + ('MW&'.includes(c) ? 6 : c === ' ' ? 3 : 4), -1)) / 16;

/** One of a shop's signs (['عربي|LATIN', 'LATIN', …]) that fits a board wM metres wide: both scripts side by side, or the first alone; else the shortest. */
export function fit(r, words, wM) {
  const ok = words.filter(w => w.split('|').reduce((a, p) => a + wordM(p), 0) + 0.5 <= wM || wordM(w.split('|')[0]) <= wM - 0.3);
  return ok.length ? pick(r, ok) : words.reduce((a, b) => (wordM(a.split('|')[0]) <= wordM(b.split('|')[0]) ? a : b)).split('|')[0];
}
