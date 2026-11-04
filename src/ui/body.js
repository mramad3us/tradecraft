// TRADECRAFT ui: a body, as a look at it shows it (the user, 2026-11-03: "should include graphical representations
// (high quality based on inventory screen), same thing with the reading people screen"). Your read of someone (F,
// Read), first aid (F, First aid; H) and your own sheet (C: "the char sheet should also be refactored to match the
// 'read' sheet for health representation") all show it, from sim/diagnosis.js findings(): the person, close to, in
// what they're wearing (the inventory's figure, src/art/doll.js), every wound drawn on them where it is (the hole,
// the stain, the drips as fast as it bleeds, a dressing, a tourniquet, a splint, a ring round what bleeds inside),
// and beside it each one's number on a small plaque of the picture's (src/ui/plaque.js: red what's bad, gold what
// wants care, pale what's tended or minor), a leader line from it to the wound; then the words, row by row under the
// same plaques: what you see, and what your look found (the Medicine roll, at the top), and what it'll take; the
// sheet adds its own lines (more: the pain, the cold, the hours awake) to the ones everyone sees.
// optionTag() puts a wound's plaque on first aid's options, so "Press on the first …" carries its number too.
import { plaque, STYLES } from './plaque.js';
import { doll, backdropAt, W as DOLL_W, H as DOLL_H } from '../art/doll.js';
import { checkShort } from '../sim/checks.js';
import { pictureOf as armourPicture } from '../sim/armour.js';

const MARGIN = 15;                                                 // (a margin each side of the figure for the plaques)
/** The figure's pixels at two of the screen's, as the inventory's; your read's at three where the window's tall enough to take it (first aid's options want the room). */
const scale = () => (typeof innerHeight === 'number' && innerHeight >= 860 ? 3 : 2);
export const TAG_STYLE = { bad: 'tail', mid: 'home', ok: 'seen', calm: 'seen' };
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** A wound's number on its plaque, as a canvas at k of the screen's pixels a pixel. */
export function tagCanvas(n, tone, k = 2) {
  const pl = plaque({ text: String(n), style: TAG_STYLE[tone] ?? 'seen', notch: false }), cv = document.createElement('canvas');
  cv.width = pl.w; cv.height = pl.h; cv.getContext('2d').drawImage(pl.canvas, 0, 0);
  Object.assign(cv.style, { width: `${pl.w * k}px`, height: `${pl.h * k}px`, imageRendering: 'pixelated' });
  cv.className = 'bp-tag'; cv.dataset.n = String(n);
  return cv;
}

/** The figure: p (their sheet: the look, the sex, what's in the hand) as findings f mark them, the plaques in the margins. A canvas; big: three of the screen's pixels a pixel where the window's tall enough. */
export function figure(p, f, { big = false } = {}) {
  const who = { look: p.look ?? {}, sex: p.sex, hand: p.hand ?? null, armour: armourPicture(p) }, rows = doll({ ...who, wounds: f.marks }), bare = doll(who), w = DOLL_W + 2 * MARGIN, h = DOLL_H;   // (a plate carrier over the top: sim/armour.js)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x - MARGIN, c = dx >= 0 && dx < DOLL_W ? rows[y][dx] : backdropAt(dx, y); g.fillStyle = hex(c); g.fillRect(x, y, 1, 1); }
  // (the plaques: each wound's to its side of the figure, at its height, pushed apart where two would touch; a leader to the wound)
  const spots = [...new Map(rows.spots.map(s => [s.n, s])).values()].sort((a, b) => a.y - b.y);
  for (const left of [true, false]) {
    let next = 1;
    for (const s of spots.filter(o => (o.x < DOLL_W / 2) === left)) {
      const pl = plaque({ text: String(s.n), style: TAG_STYLE[s.tone] ?? 'seen', notch: false }), ty = Math.min(h - pl.h - 1, Math.max(next, s.y - Math.floor(pl.h / 2)));
      const tx = left ? 1 : w - pl.w - 1;
      next = ty + pl.h + 1;
      // (the leader: from the plaque's inner edge to a pixel short of the wound, in the plaque's lit colour, a dark pixel under it so it shows on a pale shirt;
      // under what's drawn on them, not over it: it skips the pixels a mark changed, so a break's jag or a splint's tie shows through)
      const x0 = left ? tx + pl.w - 1 : tx, y0 = ty + Math.floor((pl.h - 1) / 2), x1 = s.x + MARGIN + (left ? -2 : 3), y1 = s.y;
      const S = STYLES[TAG_STYLE[s.tone] ?? 'seen'], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + (x1 - x0) * k / Math.max(1, n)), y = Math.round(y0 + (y1 - y0) * k / Math.max(1, n));
        const marked = (yy) => { const dx = x - MARGIN; return dx >= 0 && dx < DOLL_W && rows[yy]?.[dx] !== bare[yy]?.[dx]; };
        if (k % 2 || marked(y)) continue;                          // (dotted: the figure shows through it)
        if (!marked(y + 1)) { g.fillStyle = 'rgba(20, 21, 28, 0.6)'; g.fillRect(x, y + 1, 1, 1); }
        g.fillStyle = hex(S.hi); g.fillRect(x, y, 1, 1);
      }
      g.drawImage(pl.canvas, tx, ty);
    }
  }
  const K = big ? scale() : 2;
  Object.assign(cv.style, { width: `${w * K}px`, height: `${h * K}px`, imageRendering: 'pixelated' });
  cv.className = 'bp-figure';
  cv.dataset.wounds = String(spots.length);
  return cv;
}

/**
 * The words: the look (its roll), the lines everyone sees, each wound's row under its plaque, what it'll take. el: ui.js's maker.
 * more: lines of the body's besides ({ text, tone }: the pain, the cold, the hours awake; the character sheet's), after the lines everyone sees.
 */
export function words(el, f, { self = false, more = [] } = {}) {
  const look = f.look ? el('p', { className: `bp-look ${f.look.ok ? 'made' : 'fail'}` }, f.look.ok ? `Your look: ${lookWord(f.look.margin)}.` : 'Your look: you can\'t make sense of it.', el('span', { className: 'num' }, ` ${checkShort(f.look.roll)}`))
    : f.rows.length || f.status.some(s => s.tone !== 'calm') ? el('p', { className: 'bp-look' }, self ? 'What you can see and feel; a closer look takes Medicine.' : 'What anyone can see; a closer look takes Medicine.') : null;
  return el('div', { className: 'bp-words' }, look,
    el('ul', { className: 'bp-status' }, ...[...f.status, ...more].map(s => el('li', { className: s.tone }, s.text))),
    f.rows.length ? el('ul', { className: 'bp-rows' }, ...f.rows.map(r => el('li', { className: r.tone },
      tagCanvas(r.n, r.tone), el('span', { className: 'bp-text' }, el('b', {}, r.words), r.detail ? el('span', { className: 'bp-detail' }, `: ${r.detail}`) : null, r.care ? el('span', { className: 'bp-care' }, ` (${r.care})`) : null))))
      : el('p', { className: 'bp-none' }, f.dead ? '' : self ? 'Not a mark on you.' : 'Nothing wrong that shows.'),
    f.needs.length ? el('div', { className: 'bp-needs' }, el('h3', {}, 'What it\'ll take'), el('ul', {}, ...f.needs.map(n => el('li', { className: n.tone }, n.text)))) : null);
}
/** What a look found, by its margin, in brief. */
const lookWord = (m) => (m >= 8 ? 'the whole of it, inside and out' : m >= 4 ? 'the wounds, what made them, what they\'ll need' : m >= 0 ? 'what the wounds are, and how they bleed' : 'little');

/** The plaque of the wound an option of first aid's is for (its key 'method:arg': an injury's index, or a part), or null. */
const ON_WOUND = new Set(['pressure', 'dress', 'tourniquet', 'clean', 'stitch', 'bandage']), ON_PART = new Set(['set', 'splint', 'loosen', 'poultice']);
export function optionTag(f, key) {
  const [method, arg = ''] = String(key).split(':');
  const row = key === 'none' ? f.rows.find(r => r.mark?.kind === 'inside')
    : ON_WOUND.has(method) ? f.rows.find(r => r.idx === Number(arg))
      : ON_PART.has(method) ? f.rows.find(r => r.part === arg && (r.mark?.kind === 'break' || !f.rows.some(q => q.part === arg && q.mark?.kind === 'break'))) : null;   // (pills, a hospital: for the whole of them)
  return row ? tagCanvas(row.n, row.tone) : null;
}
