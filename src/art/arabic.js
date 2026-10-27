// TRADECRAFT art: Arabic in pixels, for the signs of Beirut and Cairo (src/art/pixelart.js text()).
//
// The script joins: most letters take one of four forms by their neighbours (isolated, final, initial,
// medial), seven only ever join the letter before them (ا د ذ ر ز و and ة, ى), and it runs right to
// left. So a word is shaped (its letters' forms chosen by who they join) and laid from its right end
// leftward, each joined pair linked by a pixel of the baseline (a kashida), the way a sign painter's
// stroke runs on.
//
// The glyphs sit on a grid of ROWS rows: the baseline is row BASE; tall letters (alef, lam, kaf, tah)
// rise from row 0, and tails (reh, waw, the final forms of noon, yeh, ain, hah, meem, qaf) hang to the
// last row. At this size a letter is a few pixels, so each is drawn for what tells it apart: the
// height of its stroke, its teeth, its loop, its tail, its dots (one pixel each, two side by side a
// pixel apart, three in a triangle).
//
// A glyph is rows of '.' and 'x' (ink), top row first; its width is the rows' length.

export const ROWS = 9, BASE = 5;

// Forms: i isolated, f final (joined to the letter before, on its right), b initial (joined to the
// next, on its left), m medial. A letter that only joins before has i and f.
const pad = (rows) => { const w = Math.max(...rows.map(r => r.length)); return Array.from({ length: ROWS }, (_, k) => (rows[k] ?? '').padEnd(w, '.')); };
const G = {};
const def = (chars, forms) => { for (const ch of chars) G[ch] = Object.fromEntries(Object.entries(forms).map(([k, v]) => [k, pad(v)])); };
// A dot pattern added over a base form: rows indexed from the top, each a string the form's width.
const dots = (base, extra) => Object.fromEntries(Object.entries(base).map(([k, rows]) => [k, pad(rows).map((row, j) => {
  const e = extra[k]?.[j] ?? extra.all?.[j];
  if (!e) return row;
  const w = row.length, at = Math.floor((w - e.length) / 2) + (extra.shift?.[k] ?? 0);
  return [...row].map((c, i) => (e[i - at] === 'x' ? 'x' : c)).join('');
})]));

// ---- the letters ----

// alef: a stroke from the top to the baseline; final, the baseline comes in from the right.
const ALEF = { i: ['', 'x', 'x', 'x', 'x', 'x'], f: ['', 'x.', 'x.', 'x.', 'x.', 'xx'] };
def('اأإآٱ', ALEF);
// beh's family: a boat (alone or last), a tooth (first or between); dots tell them apart.
const BOAT = { i: ['', '', '', 'x.....', 'x....x', 'xxxxxx'], f: ['', '', '', 'x.....', 'x....x', 'xxxxxx'], b: ['', '', '', '.x.', '.x.', 'xxx'], m: ['', '', '', '.x.', '.x.', 'xxx'] };
def('ب', dots(BOAT, { i: { 7: 'x' }, f: { 7: 'x' }, b: { 7: 'x' }, m: { 7: 'x' } }));
def('ت', dots(BOAT, { i: { 2: 'x.x' }, f: { 2: 'x.x' }, b: { 1: 'x.x' }, m: { 1: 'x.x' } }));
def('ث', dots(BOAT, { i: { 1: 'x', 2: 'x.x' }, f: { 1: 'x', 2: 'x.x' }, b: { 0: 'x', 1: 'x.x' }, m: { 0: 'x', 1: 'x.x' } }));
// noon: a deep bowl alone or last, a dot over it; a tooth otherwise.
def('ن', dots({ i: ['', '', '', 'x..x', 'x..x', 'x..x', '.xx.'], f: ['', '', '', 'x..x', 'x..x', 'x..x', '.xx.'], b: BOAT.b, m: BOAT.m },
  { i: { 1: 'x' }, f: { 1: 'x' }, b: { 1: 'x' }, m: { 1: 'x' } }));
// yeh: its tail sweeping back under itself; two dots below; ى without them, ئ with a hamza over.
const YEH = { i: ['', '', '', '...xx', '..x..', '...xx', 'x....', '.xxxx'], f: ['', '', '', '...x.', '..x.x', '...xx', 'x....', '.xxxx'], b: BOAT.b, m: BOAT.m };
def('ي', dots(YEH, { b: { 7: 'x.x' }, m: { 7: 'x.x' }, i: { 8: '' }, f: { 8: '' } }));
def('ى', YEH);
def('ئ', dots(YEH, { b: { 1: 'x' }, m: { 1: 'x' }, i: { 1: 'x' }, f: { 1: 'x' } }));
// jeem, hah, khah: a head like a cup tipped forward; alone or last, its tail curls round below.
const HAH = { i: ['', '', '', 'xxxx', '..x.', '.x..', 'x...', 'x...', '.xxx'], f: ['', '', '', 'xxx..', '..xxx', '.x...', 'x....', 'x....', '.xxx.'],
  b: ['', '', '', 'xxx', '..x', 'xxx'], m: ['', '', '', 'xxx.', '..x.', 'xxxx'] };
def('ح', HAH);
def('ج', dots(HAH, { i: { 6: '..x' }, f: { 6: '..x' }, b: { 7: '.x' }, m: { 7: '.x' }, shift: { i: 1, f: 1 } }));
def('خ', dots(HAH, { i: { 1: 'x' }, f: { 1: 'x' }, b: { 1: 'x' }, m: { 1: 'x' } }));
// dal, thal: an angle on the baseline.
def('د', { i: ['', '', '', 'x..', '.x.', 'xxx'], f: ['', '', '', 'x..', '.x.', 'xxx'] });
def('ذ', { i: ['', 'x..', '', 'x..', '.x.', 'xxx'], f: ['', 'x..', '', 'x..', '.x.', 'xxx'] });
// reh, zain: a stroke down from the baseline, curving away left.
def('ر', { i: ['', '', '', '', '..x', '..x', '.x.', 'x..'], f: ['', '', '', '', '...', '.xx', '.x.', 'x..'] });
def('ز', { i: ['', '', '..x', '', '..x', '..x', '.x.', 'x..'], f: ['', '', '.x.', '', '...', '.xx', '.x.', 'x..'] });
// seen, sheen: three teeth; alone or last, a bowl after them.
const SEEN = { i: ['', '', '', '', 'x.x.x.x', 'x.xxxxx', '.x.....'], f: ['', '', '', '', 'x.x.x.x', 'x.xxxxx', '.x.....'],
  b: ['', '', '', '', 'x.x.x', 'xxxxx'], m: ['', '', '', '', 'x.x.x', 'xxxxx'] };
def('س', SEEN);
def('ش', dots(SEEN, { i: { 1: 'x', 2: 'x.x' }, f: { 1: 'x', 2: 'x.x' }, b: { 1: 'x', 2: 'x.x' }, m: { 1: 'x', 2: 'x.x' }, shift: { i: 1, f: 1 } }));
// sad, dad: a long loop on the baseline (and a tooth after it); alone or last, a bowl.
const SAD = { i: ['', '', '', '..xxx', 'x.x.x', 'xxxxx'], f: ['', '', '', '..xxx', 'x.x.x', 'xxxxx'], b: ['', '', '', '.xxx', 'x..x', 'xxxx'], m: ['', '', '', '.xxx', 'x..x', 'xxxx'] };
def('ص', SAD);
def('ض', dots(SAD, { all: { 1: 'x' } }));
// tah, zah: the loop under a tall stroke.
const TAH = { i: ['.x..', '.x..', '.x..', '.xxx', '.x.x', 'xxxx'], f: ['.x..', '.x..', '.x..', '.xxx', '.x.x', 'xxxx'], b: ['.x..', '.x..', '.x..', '.xxx', '.x.x', 'xxxx'], m: ['.x..', '.x..', '.x..', '.xxx', '.x.x', 'xxxx'] };
def('ط', TAH);
def('ظ', dots(TAH, { all: { 1: '..x' } }));
// ain, ghain: an open hook first, a closed knot between; alone or last, the tail below.
const AIN = { i: ['', '', '.xx', 'x..', '.xx', 'x..', 'x..', '.xxx'], f: ['', '', '', 'xxx', 'x.x', 'xxx', 'x..', '.xx'],
  b: ['', '', '', '.xx', 'x..', 'xxx'], m: ['', '', '', 'xxx', 'x.x', 'xxx'] };
def('ع', AIN);
def('غ', dots(AIN, { all: { 1: 'x' } }));
// feh, qaf: a small loop; feh's tail flat, qaf's a deep bowl.
def('ف', dots({ i: ['', '', '', '....xx', 'x...xx', 'xxxxxx'], f: ['', '', '', '....xx', 'x...xx', 'xxxxxx'], b: ['', '', '', '.xx', 'x.x', 'xxx'], m: ['', '', '', '.xx', 'x.x', 'xxx'] },
  { i: { 1: '....x.' }, f: { 1: '....x.' }, b: { 1: '.x' }, m: { 1: '.x' } }));
def('ق', dots({ i: ['', '', '', '..xx', '..xx', 'x..x', 'x..x', '.xx.'], f: ['', '', '', '..xx', '..xx', 'x..x', 'x..x', '.xx.'], b: ['', '', '', '.xx', 'x.x', 'xxx'], m: ['', '', '', '.xx', 'x.x', 'xxx'] },
  { i: { 1: '..x.x' }, f: { 1: '..x.x' }, b: { 1: 'x.x' }, m: { 1: 'x.x' } }));
// kaf: a tall stroke with its slanting cap; alone or last, an L with a mark in it.
def('ك', { i: ['....x', '....x', '....x', '.x..x', 'x...x', 'xxxxx'], f: ['....x', '....x', '....x', '.x..x', 'x...x', 'xxxxx'],
  b: ['x...', '.x..', '..x.', '...x', '...x', 'xxxx'], m: ['x...', '.x..', '..x.', '...x', '...x', 'xxxx'] });
// lam: a tall stroke; alone or last, a bowl under it.
def('ل', { i: ['...x', '...x', '...x', '...x', '...x', 'x..x', '.xx.'], f: ['...x', '...x', '...x', '...x', '...x', 'x..x', '.xx.'],
  b: ['.x', '.x', '.x', '.x', '.x', 'xx'], m: ['.x', '.x', '.x', '.x', '.x', 'xx'] });
// meem: a small knot on the baseline; alone or last, its tail straight down.
def('م', { i: ['', '', '', '', '.xx', 'xxx', 'x..', 'x..', 'x..'], f: ['', '', '', '', '.xx', 'xxx', 'x..', 'x..', 'x..'], b: ['', '', '', '', 'xx.', 'xxx'], m: ['', '', '', '', '.x.', 'xxx', '.x.'] });
// heh: a round knot alone, a hanging loop last, a hump first, a figure of eight between; teh marbuta,
// heh's last form with two dots.
def('ه', { i: ['', '', '', '.x.', 'x.x', '.x.'], f: ['', '', '', '.xx', 'x.x', 'xxx'], b: ['', '', '.x.', 'x.x', 'x.x', 'xxx'], m: ['', '', '', '.x.', 'xxx', 'xxx', '.x.'] });
def('ة', { i: ['', 'x.x', '', '.x.', 'x.x', '.x.'], f: ['', 'x.x', '', '.xx', 'x.x', 'xxx'] });
// waw: a loop on the baseline, its tail down to the left.
def('و', { i: ['', '', '', '.xx', '.x.x', '..xx', '...x', '..x.', 'xx..'], f: ['', '', '', '.xx', '.x.x', '..xx', '...x', '..x.', 'xx..'] });
def('ؤ', G['و']);
// hamza alone (a small mark), and the lam–alef ligature.
def('ء', { i: ['', '', '', '.xx', 'x..', 'xx.'], f: ['', '', '', '.xx', 'x..', 'xx.'] });
const LAMALEF = { i: pad(['x...x', 'x...x', '.x..x', '..x.x', '...xx', 'xxxxx']), f: pad(['x...x', 'x...x', '.x..x', '..x.x', '...xx', 'xxxxx']) };

// Letters that join only the letter before them.
const RIGHT_ONLY = new Set([...'اأإآٱدذرزوؤةىء']);
export const isArabic = (ch) => /[؀-ۿ]/.test(ch);

/** A word or a phrase shaped: [{ rows, joinLeft }], in reading order (right to left as drawn). */
const LIGS = { 'لا': '\uFEFB', 'لأ': '\uFEF7', 'لإ': '\uFEF9', 'لآ': '\uFEF5' };
const isLig = (ch) => Object.values(LIGS).includes(ch);
const lettered = (ch) => !!ch && (!!G[ch] || isLig(ch));
const joinsNext = (ch) => lettered(ch) && !RIGHT_ONLY.has(ch) && !isLig(ch);
function shape(str) {
  let t = str;
  for (const [k, v] of Object.entries(LIGS)) t = t.split(k).join(v);
  const chars = [...t], out = [];
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    if (!lettered(ch)) { if (ch === ' ') out.push({ space: true }); continue; }
    const before = joinsNext(chars[k - 1]), after = joinsNext(ch) && lettered(chars[k + 1]);
    const form = before && after ? 'm' : before ? 'f' : after ? 'b' : 'i';
    const g = isLig(ch) ? LAMALEF : G[ch];
    out.push({ rows: g[form] ?? (before ? g.f : g.i), joinLeft: after });
  }
  return out;
}

/** Width in pixels of an Arabic string, as arabic() draws it. */
export function arabicWidth(str) {
  let w = 0;
  const parts = shape(str);
  parts.forEach((p, k) => { w += p.space ? 3 : p.rows[0].length; if (k < parts.length - 1 && !p.space && !parts[k + 1].space) w += 1; });
  return w;
}

/**
 * Draw an Arabic string with px() in colour c: its right end at x + arabicWidth(str), so it occupies
 * x … x + width like a Latin string; y the top row (the baseline is y + BASE).
 */
export function arabic(px, x, y, str, c) {
  const parts = shape(str);
  let right = x + arabicWidth(str);                                  // the pen, from the right end leftward
  parts.forEach((p, k) => {
    if (p.space) { right -= 3; return; }
    const w = p.rows[0].length, left = right - w;
    p.rows.forEach((row, j) => [...row].forEach((b, i) => { if (b === 'x') px(left + i, y + j, 1, 1, c); }));
    right = left;
    if (k < parts.length - 1 && !parts[k + 1].space) {               // the gap to the next letter: the baseline runs on if they join
      if (p.joinLeft) px(right - 1, y + BASE, 1, 1, c);
      right -= 1;
    }
  });
}
