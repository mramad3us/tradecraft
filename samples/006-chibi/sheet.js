// Sample 006, ?view=sheet: the cast's sprites flat on a page, a few frames each, in two halves side by
// side (so the sheet, 432 × 136, fits the gallery's 480 × 270 at a whole-number scale).
import { frame, CELL } from '../lib/sprites.js';
import { CAST } from './cast.js';

// ?cols=right:run0,right:run1 picks the frames shown (default: a few of each view).
const COLS = new URLSearchParams(location.search).get('cols')?.split(',').map(c => c.split(':'))
  ?? [['down', 'idle0'], ['down', 'walk0'], ['right', 'idle0'], ['right', 'walk0'], ['right', 'walk2'],
    ['right', 'run0'], ['left', 'walk0'], ['up', 'idle0'], ['down', 'sit']];
const [W, H] = CELL;
const names = Object.keys(CAST), half = Math.ceil(names.length / 2);
const cv = document.createElement('canvas');
cv.width = 2 * COLS.length * W; cv.height = half * H;
const g = cv.getContext('2d');
g.fillStyle = '#a0978a'; g.fillRect(0, 0, cv.width, cv.height);
names.forEach((name, n) => COLS.forEach(([dir, f], i) => {
  const ox = (Math.floor(n / half) * COLS.length + i) * W, oy = (n % half) * H;
  frame(CAST[name], dir, f).forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    g.fillStyle = '#' + c.toString(16).padStart(6, '0');
    g.fillRect(ox + x, oy + y, 1, 1);
  }));
}));
const s = Math.max(1, Math.floor(Math.min(innerWidth / cv.width, innerHeight / cv.height)));
Object.assign(cv.style, { width: `${cv.width * s}px`, height: `${cv.height * s}px`, imageRendering: 'pixelated', display: 'block',
  margin: `${Math.floor((innerHeight - cv.height * s) / 2)}px auto 0` });
document.body.appendChild(cv);
window.__ready = true;
