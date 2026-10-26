// Sample 007, ?view=sheet: the cast in the fine finish, flat, a few frames each, in two halves side by
// side, every colour snapped to the fine palette as the street's post pass would.
import { frame, CELL } from '../lib/finepeople.js';
import { FINE_PALETTE, nearest } from '../lib/pixelart.js';
import { CAST } from '../006-chibi/cast.js';

// ?cols=right:walk0,right:walk1 picks the frames shown (default: a few of each view).
const COLS = new URLSearchParams(location.search).get('cols')?.split(',').map(c => c.split(':'))
  ?? [['down', 'idle0'], ['down', 'blink'], ['down', 'walk2'], ['right', 'idle0'], ['right', 'walk0'], ['right', 'walk2'],
    ['right', 'walk5'], ['right', 'run3'], ['left', 'walk0'], ['up', 'idle0'], ['up', 'walk6'], ['down', 'sit'], ['right', 'sit']];
const [W, H] = CELL;
const names = Object.keys(CAST), half = Math.ceil(names.length / 2);
const cv = document.createElement('canvas');
cv.width = 2 * COLS.length * W; cv.height = half * H;
const g = cv.getContext('2d');
g.fillStyle = '#8a8178'; g.fillRect(0, 0, cv.width, cv.height);
const snap = new Map();
names.forEach((name, n) => COLS.forEach(([dir, f], i) => {
  const ox = (Math.floor(n / half) * COLS.length + i) * W, oy = (n % half) * H;
  frame(CAST[name], dir, f).forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    if (!snap.has(c)) snap.set(c, nearest(c, FINE_PALETTE));
    g.fillStyle = '#' + snap.get(c).toString(16).padStart(6, '0');
    g.fillRect(ox + x, oy + y, 1, 1);
  }));
}));
const s = Math.max(1, Math.floor(Math.min(innerWidth / cv.width, innerHeight / cv.height)));
Object.assign(cv.style, { width: `${cv.width * s}px`, height: `${cv.height * s}px`, imageRendering: 'pixelated', display: 'block',
  margin: `${Math.floor((innerHeight - cv.height * s) / 2)}px auto 0` });
document.body.appendChild(cv);
window.__ready = true;
