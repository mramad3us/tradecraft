// TRADECRAFT samples: people at a finer finish, after Stoneshard (the user's reference, 2026-10-26).
//
// Measured on Stoneshard's own screenshots (ref/stoneshard, not committed), its people are not taller
// than ours so much as finer: about 33 px, a head of 14 (hair included), so 2.4 heads tall, close to
// sample 006's chibi. What differs is the finish, and that's what this module draws:
//   - a cell of 24 × 36: a 12 × 12 head, hair a pixel proud of it, a 10-px torso, legs that show,
//     boots, hands (sample 006: 24 × 34, a 15-wide head over a body of 14 px);
//   - a face: 2 × 2 eyes with a glint, brows, the shadow of the nose, cheeks, a mouth; a blink;
//   - six tones a colour, hue-shifted as a pixel artist does (shadows toward violet, lights toward
//     yellow): darkest, dark, shade, base, light, highlight;
//   - the selective outline: a silhouette's top and left edges inked in the part's own darkest tone,
//     its bottom and right in a warm near-black, so the light side reads soft;
//   - limbs drawn from joints (a capsule of pixels from shoulder to elbow to wrist, hip to knee to
//     ankle), so the in-between frames cost nothing: an 8-frame walk, a 6-frame run, a breathing idle.
//
// The drawing works as sprites.js does: parts are laid down one over another into cells
// { r: role, p: part, t: tone }, then shaded by rule. Roles: s skin, h hair, t top, p legs, f shoes,
// a hat, r beard, y trim (a tie, a collar, a belt), w white (a shirt), x a thing carried; fixed: e eye,
// o its glint, k ink, g gold, l lens, m frame; from the skin and hair: c cheek, z mouth, b brow. A tone left null is
// found by the rules: light on a top edge, shade on the right and bottom edges and under a part laid
// over this one, dark where this part's edge lies over another (a line inside the figure).
import * as THREE from 'three';
import { PX_PER_M, oklch, fromOklch, shiftHue } from './pixelart.js';

export const CELL = [24, 40];
const OY = 4;                                                    // rows of headroom: hats reach y -3, feet y 35
export const DIRS = ['down', 'up', 'right', 'left'];
const WALK = 8, RUN = 6, IDLE = 4;
export const FRAMES = [...Array.from({ length: IDLE }, (_, i) => `idle${i}`), 'blink',
  ...Array.from({ length: WALK }, (_, i) => `walk${i}`), ...Array.from({ length: RUN }, (_, i) => `run${i}`), 'sit'];
export const FPS = { idle: 3, walk: 10, run: 12 };
export const INK = 0x1a1214;

// ---------- colour: six hue-shifted tones of any base colour ----------

export function ramp(hex) {
  const [L, C, h] = oklch(hex);
  const tone = (dL, kc) => fromOklch(Math.min(0.97, Math.max(0.1, L + dL)), C * kc, shiftHue(h, dL));
  return { dark2: tone(-0.3, 0.75), dark: tone(-0.2, 0.85), shade: tone(-0.1, 0.95), base: hex, light: tone(0.07, 1.0), hi: tone(0.14, 0.85) };
}
const FIXED = { e: 0x231a1e, o: 0xf4efe6, k: INK, g: 0xd8a845, l: 0x7f88a0, m: 0x9aa0ae };

// ---------- the canvas of cells, and how parts are drawn into it ----------

function grid() {
  const [W, H] = CELL;
  const cells = Array.from({ length: H }, () => Array(W).fill(null));
  let part = 0;
  const g = {
    cells,
    part: () => ++part,                                          // start a new part
    put(x, y, r, t = null, p = part) {
      x = Math.round(x); y = Math.round(y) + OY;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      cells[y][x] = { r, p, t };
    },
    rect(x, y, w, h, r, t = null) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.put(x + i, y + j, r, t); },
    // A row-template: chars map to [role, tone]; '.' leaves what's under.
    tpl(x, y, rows, map) {
      rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && map[ch]) g.put(x + i, y + j, ...map[ch]); }));
    },
    // Every pixel whose centre lies within r of the segments through pts: a limb.
    capsule(pts, r, role, t = null) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      for (let y = Math.floor(Math.min(...ys) - r); y <= Math.ceil(Math.max(...ys) + r); y++)
        for (let x = Math.floor(Math.min(...xs) - r); x <= Math.ceil(Math.max(...xs) + r); x++) {
          const cx = x + 0.5, cy = y + 0.5;
          for (let i = 0; i < pts.length - 1; i++) {
            const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
            const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
            const u = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / L2));
            if (Math.hypot(cx - ax - u * dx, cy - ay - u * dy) <= r) { g.put(x, y, role, t); break; }
          }
        }
    },
  };
  return g;
}

// ---------- heads and faces ----------

const HEAD = {
  down: ['....ssss....', '..ssssssss..', '.ssssssssss.', '.ssssssssss.', 'ssssssssssss', 'ssssssssssss',
    'ssssssssssss', 'ssssssssssss', '.ssssssssss.', '.ssssssssss.', '..ssssssss..', '....ssss....'],
  right: ['...ssssss....', '..ssssssss...', '.ssssssssss..', '.sssssssssss.', 'ssssssssssss.', 'ssssssssssss.',
    'ssssssssssss.', 'sssssssssssss', 'ssssssssssss.', '.ssssssssss..', '..sssssssss..', '....ssssss...'],
};
const HX = 6, HY = 3;                                            // the head's top left in the cell
// Faces, laid on the head (the same part): b brow, w glint, e eye, S skin in shade, c cheek, z mouth.
const FACE = {
  down: ['............', '............', '............', '............', '..bbb..bbb..', '...oe..oe...',
    '...ee..ee...', '......S.....', '..c......c..', '.....zz.....', '............', '............'],
  right: ['.............', '.............', '.............', '.............', '........bbb..', '.........o...',
    '.........e...', '....S...c....', '....S......S.', '..........z..', '.............', '.............'],
};
const FACE_BLINK = { down: (rows) => rows.map((r, j) => j === 5 ? '............' : r),
  right: (rows) => rows.map((r, j) => j === 5 ? '.............' : r) };
const faceMap = { b: ['b'], o: ['o'], e: ['e'], S: ['s', 'shade'], c: ['c'], z: ['z'] };

// ---------- hair, by style and view (procedural over the head) ----------

function hair(g, style, view, hb, lean) {
  const H = (x, y, w = 1, h = 1, t = null) => g.rect(x + lean, y + hb, w, h, 'h', t);
  const hi = (x, y) => g.put(x + lean, y + hb, 'h', 'hi');
  g.part();
  const knot = (x, y) => { H(x + 1, y, 4); H(x, y + 1, 6, 2); H(x + 1, y + 3, 4); hi(x + 1, y + 1); hi(x + 2, y); };
  if (view === 'down') {
    if (style === 'bald') { H(5, 7, 2, 3); H(17, 7, 2, 3); return; }
    if (style === 'long') {                                      // full, parted in the middle, to the shoulders
      H(8, 1, 8); H(6, 2, 12); H(5, 3, 14, 3);
      H(5, 6, 5); H(14, 6, 5); H(4, 6, 3, 13); H(17, 6, 3, 13); H(5, 19, 1); H(18, 19, 1);
    } else if (style === 'bun') {                                // swept back from the brow, a knot on top
      knot(9, -2); H(8, 2, 8); H(7, 3, 10); H(6, 4, 12); H(6, 5, 2, 3); H(16, 5, 2, 3);
    } else {                                                     // short: close to the head, a ragged fringe
      H(8, 1, 8); H(7, 2, 10); H(6, 3, 12, 3);
      H(7, 6, 3); H(11, 6, 2); H(14, 6, 3); H(6, 7, 2); H(16, 7, 2); H(6, 8); H(17, 8);
    }
    hi(9, 2); hi(10, 2); hi(10, 3); hi(13, 3); hi(14, 3);        // strands catching the light
  } else if (view === 'up') {
    if (style === 'bald') { H(5, 7, 2, 4); H(17, 7, 2, 4); H(7, 11, 10, 2); return; }
    if (style === 'bun') knot(9, -2);
    const w = style === 'long' ? 1 : 0;
    H(8, 1, 8); H(7 - w, 2, 10 + 2 * w); H(6 - w, 3, 12 + 2 * w, 8); H(6, 11, 12); H(7, 12, 10);
    if (style === 'long') { H(5, 13, 14, 6); H(6, 19, 12); }
    hi(9, 2); hi(9, 3); hi(13, 2); hi(14, 3); hi(11, 5);
  } else {                                                       // right: the face to the right
    if (style === 'bald') { H(5, 7, 4, 3); H(6, 10, 3); return; }
    if (style === 'bun') { knot(3, 1); H(8, 2, 7); H(6, 3, 10); H(5, 4, 9); H(5, 5, 6, 2); H(5, 7, 4, 4); H(6, 11, 3); }
    else {
      H(9, 1, 6); H(7, 2, 10); H(6, 3, 12, 3); H(6, 6, 8); H(6, 7, 4, 4); H(7, 11, 2);
      if (style === 'long') { H(4, 6, 5, 13); H(5, 19, 3); H(5, 3, 1, 3); }
      else H(15, 6, 2);                                          // a lock over the brow
    }
    hi(10, 2); hi(11, 2); hi(13, 3); hi(8, 4);
  }
}

// ---------- hats ----------

function hat(g, spec, view, hb, lean) {
  const k = spec.hat?.kind;
  if (!k) return;
  g.part();
  const A = (x, y, w = 1, h = 1, t = null, r = 'a') => g.rect(x + lean, y + hb, w, h, r, t);
  const side = view === 'right';
  if (k === 'fedora') {
    if (!side) { A(9, -2, 6); A(11, -2, 2, 1, 'shade'); A(8, -1, 8, 2); A(8, 1, 8, 1, 'dark'); A(6, 2, 12, 1); A(4, 3, 16, 1, 'shade'); }
    else { A(9, -2, 5); A(8, -1, 7, 2); A(8, 1, 7, 1, 'dark'); A(5, 2, 14, 1); A(4, 3, 16, 1, 'shade'); }
    A(9, -1, 2, 1, 'hi');
  } else if (k === 'cap') {
    if (!side) { A(8, 0, 8); A(6, 1, 12, 4); A(6, 5, 12, 1, 'shade'); A(7, 6, 10, 1, 'dark'); A(10, 1, 2, 1, 'hi'); }
    else { A(8, 0, 7); A(6, 1, 11, 4); A(15, 4, 5, 1, 'shade'); A(16, 5, 4, 1, 'dark'); A(9, 1, 2, 1, 'hi'); }
  } else if (k === 'beanie') {
    const band = spec.hat.band ?? null;
    if (!side) { A(8, -1, 8); A(6, 0, 12, 4); A(5, 4, 14, 3, null, band ? 'y' : 'a'); for (let x = 6; x < 18; x += 2) A(x, 5, 1, 2, 'shade', band ? 'y' : 'a'); A(9, 0, 2, 1, 'hi'); }
    else { A(8, -1, 7); A(6, 0, 11, 4); A(5, 4, 13, 3, null, band ? 'y' : 'a'); for (let x = 6; x < 18; x += 2) A(x, 5, 1, 2, 'shade', band ? 'y' : 'a'); A(9, 0, 2, 1, 'hi'); }
  } else if (k === 'peaked') {
    if (!side) {
      A(4, -1, 16, 1, 'light'); A(4, 0, 16, 3); A(5, 3, 14, 1, 'shade');
      A(6, 4, 12, 2, null, 'y'); A(11, 3, 2, 2, null, 'g');     // the band and its badge
      A(7, 6, 10, 1, null, 'k'); A(9, 6, 2, 1, null, 'l');      // the peak, shining
    } else {
      A(4, -1, 13, 1, 'light'); A(4, 0, 13, 3); A(5, 3, 12, 1, 'shade');
      A(6, 4, 11, 2, null, 'y'); A(15, 4, 1, 1, null, 'g');
      A(15, 6, 5, 1, null, 'k');
    }
  }
}

// ---------- beards, moustaches, glasses ----------

function faceGear(g, spec, view, hb, lean) {
  const R = (x, y, w = 1, h = 1, t = null) => g.rect(x + lean, y + hb, w, h, 'r', t);
  if (spec.beard) {
    g.part();
    if (view === 'down') { R(6, 10, 2, 2); R(16, 10, 2, 2); R(6, 12, 4); R(14, 12, 4); R(9, 11, 6); R(7, 13, 10); R(8, 14, 8); R(9, 15, 6); R(10, 16, 4); R(11, 12, 2, 1, 'dark'); }
    else if (view === 'right') { R(8, 10, 2, 2); R(8, 12, 9); R(14, 11, 4); R(9, 13, 8); R(10, 14, 6); R(11, 15, 4); }
  } else if (spec.moustache && view !== 'up') {
    g.part();
    if (view === 'down') { R(9, 11, 6); R(9, 12, 1); R(14, 12, 1); }
    else R(15, 11, 3);
  }
  if (spec.glasses && view !== 'up') {
    g.part();
    const P = (x, y, r, t = null) => g.put(x + lean, y + hb, r, t);
    if (spec.glasses === 'shades') {
      if (view === 'down') { for (const x of [8, 9, 10, 11, 12, 13, 14, 15]) P(x, 8, 'k'); for (const x of [8, 9, 10, 13, 14, 15]) P(x, 9, 'k'); P(9, 8, 'l'); P(13, 8, 'l'); }
      else { for (let x = 13; x < 18; x++) P(x, 8, 'k'); P(14, 9, 'k'); P(15, 9, 'k'); P(14, 8, 'l'); }
    } else {
      if (view === 'down') { for (let x = 8; x < 16; x++) { P(x, 7, 'm'); P(x, 10, 'm'); } for (const x of [8, 11, 12, 15]) { P(x, 8, 'm'); P(x, 9, 'm'); } }
      else { for (let x = 13; x < 17; x++) { P(x, 7, 'm'); P(x, 10, 'm'); } for (const x of [13, 16]) { P(x, 8, 'm'); P(x, 9, 'm'); } for (let x = 9; x < 13; x++) P(x, 8, 'm'); }
    }
  }
}

// ---------- bodies ----------

// The torso from the front (or back): 10 wide at x 7..16, y 15..24, by kind; a coat runs to y 29,
// a dress flares from the waist to y 30. Details are tones and roles laid on the shape.
function torsoFront(g, kind, back, bob) {
  g.part();
  const T = (x, y, w = 1, h = 1, r = 't', t = null) => g.rect(x, y + bob, w, h, r, t);
  T(8, 15, 8); T(7, 16, 10, 9);
  if (kind === 'coat') { T(7, 25, 10, 2); T(6, 27, 12, 3); }
  if (kind === 'dress') { T(7, 22, 10, 2); T(6, 24, 12, 3); T(5, 27, 14, 3); T(5, 30, 14, 1, 't', 'shade'); }
  if (kind === 'suit') T(7, 25, 10, 1);
  if (back) {
    if (kind === 'coat') { T(7, 21, 10, 1, 'y'); T(11, 25, 2, 5, 't', 'shade'); }
    if (kind === 'sweater') { T(7, 23, 10, 2, 'y'); for (let x = 7; x < 17; x += 2) T(x, 23, 1, 2, 'y', 'shade'); }
    if (kind === 'uniform') T(7, 23, 10, 1, 'k');
    if (kind === 'dress') T(7, 21, 10, 1, 'y');
    T(11, 17, 2, 4, 't', 'shade');                               // the seam down the back
    return;
  }
  switch (kind) {
    case 'tee': T(10, 15, 4, 1, 's'); T(11, 16, 2, 1, 's'); T(9, 21, 1, 3, 't', 'shade'); T(14, 21, 1, 3, 't', 'shade'); break;
    case 'sweater':
      T(9, 15, 6, 1, 'y'); T(10, 16, 4, 1, 'y', 'shade');
      T(7, 23, 10, 2, 'y'); for (let x = 7; x < 17; x += 2) T(x, 23, 1, 2, 'y', 'shade');
      T(9, 19, 1, 3, 't', 'shade'); T(14, 19, 1, 3, 't', 'shade');
      break;
    case 'suit':
      T(10, 15, 4, 2, 'w'); T(11, 17, 2, 2, 'w');                // the shirt in the V
      T(11, 16, 2, 1, 'y', 'dark'); T(11, 17, 2, 4, 'y'); T(11, 21, 2, 1, 'y', 'shade');   // the tie
      T(9, 15, 1, 4, 't', 'shade'); T(14, 15, 1, 4, 't', 'shade'); T(10, 17, 1, 2, 't', 'dark'); T(13, 17, 1, 2, 't', 'dark');
      T(8, 21, 2, 1, 't', 'dark'); T(14, 21, 2, 1, 't', 'dark'); // pockets
      T(12, 22, 1, 1, 'k'); T(12, 24, 1, 1, 'k');               // buttons
      break;
    case 'coat':
      T(10, 15, 4, 1, 'w'); T(11, 16, 2, 1, 'y');
      T(8, 15, 2, 2, 't', 'shade'); T(14, 15, 2, 2, 't', 'shade'); // the collar turned up
      T(9, 17, 1, 4, 't', 'dark'); T(14, 17, 1, 4, 't', 'dark');   // the lapels' edges
      T(7, 21, 10, 1, 'y'); T(11, 21, 2, 1, 'g');                // the belt and its buckle
      T(9, 18, 1, 1, 'k'); T(14, 18, 1, 1, 'k'); T(9, 23, 1, 1, 'k'); T(14, 23, 1, 1, 'k');
      T(11, 22, 1, 8, 't', 'dark');                              // where it closes, to the hem
      T(8, 26, 1, 4, 't', 'shade'); T(15, 26, 1, 4, 't', 'shade');
      break;
    case 'dress':
      T(10, 15, 4, 1, 's'); T(11, 16, 2, 1, 's');
      T(7, 21, 10, 1, 'y');
      T(8, 25, 1, 5, 't', 'shade'); T(11, 23, 1, 7, 't', 'shade'); T(15, 25, 1, 5, 't', 'shade');
      break;
    case 'uniform':
      T(10, 15, 4, 1, 's'); T(11, 16, 2, 1, 's');
      T(7, 16, 2, 1, 't', 'light'); T(15, 16, 2, 1, 't', 'light');   // shoulder boards
      T(8, 18, 3, 2, 't', 'shade'); T(13, 18, 3, 2, 't', 'shade');   // pockets
      T(9, 18, 1, 1, 'g');                                        // the badge
      T(11, 17, 1, 6, 't', 'dark');                               // the placket
      T(7, 23, 10, 1, 'k'); T(11, 23, 2, 1, 'g');                 // the belt
      break;
  }
}

function torsoSide(g, kind, bob, lean) {
  g.part();
  const T = (x, y, w = 1, h = 1, r = 't', t = null) => g.rect(x + lean, y + bob, w, h, r, t);
  T(9, 15, 6); T(8, 16, 8, 9);
  if (kind === 'coat') { T(8, 25, 8, 2); T(7, 27, 9, 3); T(14, 21, 1, 9, 't', 'dark'); }
  if (kind === 'dress') { T(8, 22, 8, 2); T(7, 24, 9, 3); T(6, 27, 11, 3); T(6, 30, 11, 1, 't', 'shade'); }
  if (kind === 'suit') { T(8, 25, 8, 1); T(15, 15, 1, 3, 'w'); T(15, 17, 1, 4, 'y'); T(14, 16, 1, 5, 't', 'dark'); }
  if (kind === 'coat') { T(14, 15, 2, 2, 't', 'shade'); T(8, 21, 8, 1, 'y'); T(15, 21, 1, 1, 'g'); }
  if (kind === 'sweater') { T(8, 23, 8, 2, 'y'); T(13, 15, 2, 1, 'y'); }
  if (kind === 'uniform') { T(8, 23, 8, 1, 'k'); T(13, 18, 2, 2, 't', 'shade'); T(14, 15, 1, 1, 's'); }
  if (kind === 'tee' || kind === 'dress') T(14, 15, 1, 1, 's');
}

// Legs from the front: trousers y 25..31, boots y 32..35; lift raises a foot (it's stepping), by px.
function legsFront(g, kind, lift = [0, 0], air = 0) {
  g.part();
  const show = kind === 'coat' ? 29 : kind === 'dress' ? 30 : 25;
  for (const [i, x0] of [[0, 7], [1, 13]]) {
    const up = lift[i] - air, bx = x0 - (i === 0 ? 1 : 0);
    for (let y = show + Math.min(0, air); y < 32 - up; y++) g.rect(x0, y, 4, 1, 'p');
    g.rect(bx, 32 - up, 5, 1, 'f', 'light');
    g.rect(bx, 33 - up, 5, 2, 'f');
    g.rect(bx, 35 - up, 5, 1, 'f', 'dark');
  }
  if (show <= 26) g.rect(7, 25 + air, 10, 2, 'p');                 // the seat of the trousers
}

// A leg from the side: hip, knee, ankle (x right, y down, in cell pixels), then the boot, toe forward.
function legSide(g, hip, knee, ankle, far, kind) {
  g.part();
  const t = far ? 'shade' : null;
  if (kind !== 'dress') { g.capsule([hip, knee], 2.0, 'p', t); g.capsule([knee, ankle], 1.75, 'p', t); }
  else { g.capsule([[knee[0], Math.max(knee[1], 30)], ankle], 1.3, 'p', t); }
  const [ax, ay] = ankle.map(Math.round);
  g.rect(ax - 2, ay, 5, 1, 'f', far ? 'shade' : 'light');
  g.rect(ax - 2, ay + 1, 6, 1, 'f', far ? 'shade' : null);
  g.rect(ax - 2, ay + 2, 6, 1, 'f', 'dark');
}

// An arm: shoulder, elbow, wrist; the sleeve to the wrist (a tee's to the elbow), then the hand.
function arm(g, pts, kind, far) {
  g.part();
  const t = far ? 'shade' : null;
  const sleeveTo = kind === 'tee' || kind === 'dress' ? 1 : 2;
  g.capsule(pts.slice(0, sleeveTo + 1), 1.5, 't', t);
  if (sleeveTo < 2) g.capsule(pts.slice(1), 1.25, 's', t);
  const [wx, wy] = pts[2], [ex, ey] = pts[1];
  const L = Math.hypot(wx - ex, wy - ey) || 1;
  g.capsule([[wx, wy], [wx + (wx - ex) / L * 0.8, wy + (wy - ey) / L * 0.8]], 1.2, 's', t);
}

// ---------- poses ----------

// Side legs, near leg, by phase: [knee, ankle] relative to the hip (11.5, 25); the far leg runs half a
// cycle behind. An 8-frame walk, a 6-frame run.
const WALK_LEG = [[1.6, 4.0, 3.3, 8.0], [1.1, 4.1, 1.8, 8.0], [0.2, 4.1, 0, 8.0], [-0.8, 4.1, -1.8, 8.0],
  [-1.3, 4.0, -3.3, 7.5], [-0.8, 3.7, -3.2, 6.3], [1.0, 3.5, -0.4, 6.6], [2.0, 3.8, 2.8, 7.3]];
const RUN_LEG = [[1.6, 3.8, 2.8, 7.6], [0.8, 4.0, 0.6, 8.0], [-0.6, 4.0, -2.4, 7.4], [-0.8, 3.4, -3.6, 5.0],
  [1.0, 2.6, -1.0, 5.2], [2.2, 2.8, 2.8, 6.2]];
const WALK_BOB = [0, 1, 0, 0, 0, 1, 0, 0], RUN_BOB = [0, 1, 0, -1, -1, 0];

function sideArm(phase, n, swing, bent, bob, lean) {
  // phase 0: the near leg forward, so the near arm back.
  const s = Math.cos(2 * Math.PI * phase / n);
  const a1 = -s * swing, a2 = a1 + (bent ? 1.4 : 0.25);
  const sh = [11.5 + lean, 16.5 + bob];
  const el = [sh[0] + 4 * Math.sin(a1), sh[1] + 4 * Math.cos(a1)];
  const wr = [el[0] + 3.6 * Math.sin(a2), el[1] + 3.6 * Math.cos(a2)];
  return [sh, el, wr];
}

function compose(spec, dir, frame) {
  const g = grid();
  const view = dir === 'left' ? 'right' : dir;
  const kind = spec.top?.kind ?? 'tee';
  const style = spec.hair?.style ?? 'short';
  let bob = 0, lean = 0, blink = frame === 'blink';
  const m = frame.match(/^(idle|walk|run)(\d)$/);
  const state = m?.[1] ?? (frame === 'sit' ? 'sit' : 'idle'), ph = Number(m?.[2] ?? 0);
  if (state === 'idle') bob = [0, 0, 1, 1][ph] ?? 0;
  if (state === 'walk') bob = WALK_BOB[ph];
  if (state === 'run') { bob = RUN_BOB[ph]; lean = view === 'right' ? 1 : 0; }
  const sit = state === 'sit';
  if (sit) bob = 4;
  const air = Math.min(0, bob);

  if (view === 'right') {
    const hip = [11.5, 25 + bob];                               // in the air (bob < 0), the legs rise with it
    if (sit) {
      arm(g, [[11.5, 16.5 + bob], [12.5, 20.5 + bob], [15.5, 22.5 + bob]], kind, true);
      legSide(g, [hip[0] - 1, hip[1]], [17, hip[1] + 0.5], [16.5, 32.5], true, kind);
      legSide(g, hip, [16.5, hip[1]], [16, 32.5], false, kind);
      torsoSide(g, kind, bob, 0);
      arm(g, [[11.5, 16.5 + bob], [13, 20.5 + bob], [16, 22 + bob]], kind, false);
    } else {
      const legs = state === 'run' ? RUN_LEG : state === 'walk' ? WALK_LEG : null;
      const n = legs?.length ?? 1;
      const at = (p) => legs ? legs[p % n] : [0.2, 4.3, 0, 8.5];
      const farP = (ph + n / 2) % n;
      const [k1, k2, a1, a2] = at(farP), [n1, n2, b1, b2] = at(ph);
      const swing = state === 'run' ? 0.75 : state === 'walk' ? 0.62 : 0.04;
      const bent = state === 'run';
      arm(g, sideArm(ph + n / 2, n, swing, bent, bob, lean), kind, true);
      const foot = (y) => Math.min(y, 33);                     // a planted foot stays on the ground as the body dips
      legSide(g, [hip[0] - 0.5, hip[1]], [hip[0] + k1, hip[1] + k2], [hip[0] + a1, foot(hip[1] + a2)], true, kind);
      legSide(g, hip, [hip[0] + n1, hip[1] + n2], [hip[0] + b1, foot(hip[1] + b2)], false, kind);
      torsoSide(g, kind, bob, lean);
      arm(g, sideArm(ph, n, swing, bent, bob, lean), kind, false);
    }
  } else {
    const back = view === 'up';
    let lift = [0, 0], reach = [0, 0];
    if (state === 'walk') { lift = [[0, 0], [0, 0], [0, 1], [0, 1], [0, 0], [0, 0], [1, 0], [1, 0]][ph]; reach = [Math.cos(Math.PI * ph / 4), -Math.cos(Math.PI * ph / 4)]; }
    if (state === 'run') { lift = [[0, 0], [0, 1], [0, 2], [0, 1], [1, 0], [2, 0]][ph]; reach = [1, -1].map(s => s * Math.cos(2 * Math.PI * ph / RUN)); }
    if (back) { lift = [lift[1], lift[0]]; reach = [reach[1], reach[0]]; }
    if (sit) {
      g.part(); g.rect(7, 29, 4, 2, 'p'); g.rect(13, 29, 4, 2, 'p'); g.rect(7, 28, 10, 1, 'p', 'light');
      g.rect(7, 31, 4, 2, 'p', 'shade'); g.rect(13, 31, 4, 2, 'p', 'shade');
      g.rect(6, 33, 5, 2, 'f'); g.rect(13, 33, 5, 2, 'f'); g.rect(6, 35, 5, 1, 'f', 'dark'); g.rect(13, 35, 5, 1, 'f', 'dark');
    } else legsFront(g, kind, lift, air);
    torsoFront(g, kind, back, bob);
    const run = state === 'run';
    for (const [i, x] of [[0, 5.5], [1, 18.5]]) {
      const out = i === 0 ? -1 : 1, r = reach[i];
      const sh = [x, 16.6 + bob];
      // Running, the arms pump: one fist up at the chest while the other is down by the hip.
      const wr = run ? [x - out * (0.8 + 0.5 * Math.max(0, r)), 22.2 + bob - 2 * r] : sit ? [x - out * 1.5, 23.5 + bob] : [x + out * 0.3 - out * 0.5 * Math.max(0, r), 23.6 + bob - 0.8 * Math.max(0, r)];
      const el = run ? [x + out * 0.7, 20.6 + bob - 0.5 * r] : [(sh[0] + wr[0]) / 2 + out * 0.2, (sh[1] + wr[1]) / 2];
      arm(g, [sh, el, wr], kind, false);
    }
  }
  // A thing carried, in the hand nearest the camera's left.
  if (spec.carry && view !== 'up') {
    g.part();
    if (spec.carry === 'briefcase') {
      if (view === 'right') { g.rect(9 + lean, 26 + bob, 7, 5, 'x'); g.rect(11 + lean, 25 + bob, 3, 1, 'k'); g.rect(9 + lean, 26 + bob, 7, 1, 'x', 'light'); }
      else { g.rect(2, 25 + bob, 5, 6, 'x'); g.rect(3, 24 + bob, 3, 1, 'k'); g.rect(2, 25 + bob, 5, 1, 'x', 'light'); }
    } else {                                                      // a newspaper under the arm
      if (view === 'right') { g.rect(9 + lean, 19 + bob, 6, 2, 'w'); g.rect(9 + lean, 21 + bob, 6, 1, 'w', 'shade'); }
      else { g.rect(4, 19 + bob, 3, 4, 'w'); g.rect(4, 22 + bob, 3, 1, 'w', 'shade'); }
    }
  }
  // The head, the face, and what's on it.
  const hb = bob, hl = lean;
  g.part();
  const head = HEAD[view === 'up' ? 'down' : view];
  g.tpl(HX + hl, HY + hb, head, { s: ['s'] });
  if (view !== 'up') {
    let face = FACE[view];
    if (blink) face = FACE_BLINK[view](face);
    g.tpl(HX + hl, HY + hb, face, faceMap);
    // the ear, from the side
    if (view === 'right') { g.put(HX + 4 + hl, HY + 5 + hb, 's', 'shade'); g.put(HX + 5 + hl, HY + 6 + hb, 's', 'shade'); }
  }
  // the neck
  if (view !== 'right') g.rect(10, 14 + hb, 4, 1, 's', 'shade'); else g.rect(10 + hl, 14 + hb, 3, 1, 's', 'shade');
  faceGear(g, spec, view, hb, hl);
  hair(g, style, view, hb, hl);
  hat(g, spec, view, hb, hl);
  return g.cells;
}

// ---------- shading ----------

export const SKIN = { light: 0xf0c4a0, tan: 0xc8906a, brown: 0x8e5c42, dark: 0x5c3a2c };

function colours(spec) {
  const skin = SKIN[spec.skin] ?? spec.skin ?? SKIN.light;
  const hairC = spec.hair?.color ?? 0x2a1c18;
  const [L, C, h] = oklch(skin);
  return {
    s: skin, h: hairC, t: spec.top?.color ?? 0x3b6296, p: spec.legs ?? 0x283f6b, f: spec.shoes ?? 0x2a1c18,
    a: spec.hat?.color ?? 0x353947, r: spec.beard === true ? hairC : (spec.beard ?? hairC),
    y: spec.hat?.band && spec.hat.kind === 'beanie' ? spec.hat.band : (spec.top?.trim ?? spec.top?.tie ?? 0x9e3c36),
    x: 0x6b4636, w: 0xf4efe6,
    c: fromOklch(L - 0.05, C + 0.035, 28),                       // cheeks: the skin, rosier
  };
}

/** Shade a grid of cells into rows of colours (null transparent): see the header for the rules. */
export function shade(cells, col) {
  const H = cells.length, W = cells[0].length;
  const ramps = Object.fromEntries(Object.entries(col).map(([k, v]) => [k, ramp(v)]));
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? cells[y][x] : null);
  const same = (c, x, y) => { const o = at(x, y); return o && o.p === c.p && o.r === c.r; };
  const out = Array.from({ length: H }, () => Array(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cells[y][x];
    if (!c) continue;
    if (FIXED[c.r] !== undefined) { out[y][x] = FIXED[c.r]; continue; }
    if (c.r === 'b') { out[y][x] = ramps.h.dark2; continue; }
    if (c.r === 'z') { out[y][x] = ramps.s.dark; continue; }
    if (c.r === 'c') { out[y][x] = col.c; continue; }
    const R = ramps[c.r];
    if (!R) continue;
    let t = c.t;
    if (!t) {
      const up = at(x, y - 1);
      t = 'base';
      if (up && up.p > c.p && up.r !== c.r) t = 'shade';                       // under a part laid over this one
      else if (!same(c, x, y - 1) && same(c, x + 1, y)) t = 'light';             // a top edge
      if (!same(c, x + 1, y) || !same(c, x, y + 1)) t = 'shade';                // the right and bottom edges
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {                       // over another part: an inner line
        const o = at(x + dx, y + dy);
        if (o && o.p < c.p && o.r !== c.r && ramps[o.r]) { t = c.r === 's' ? 'shade' : 'dark'; break; }
      }
    }
    out[y][x] = R[t] ?? R.base;
  }
  // The selective outline: on the top and left of the silhouette, the part's own darkest; else ink.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cells[y][x]) continue;
    const right = at(x + 1, y), below = at(x, y + 1), left = at(x - 1, y), above = at(x, y - 1);
    const lit = right ?? below;
    if (lit && !left && !above) out[y][x] = ramps[lit.r]?.dark2 ?? INK;
    else if (lit || left || above) out[y][x] = INK;
  }
  return out;
}

/** One frame as rows of colours (null transparent). */
export function frame(spec, dir, name) {
  const px = shade(compose(spec, dir, name), colours(spec));
  return dir === 'left' ? px.map(row => row.slice().reverse()) : px;
}

/** Every frame of a person on one canvas: FRAMES across, DIRS down. */
export function sheet(spec) {
  const [W, H] = CELL;
  const cv = document.createElement('canvas');
  cv.width = W * FRAMES.length; cv.height = H * DIRS.length;
  const g = cv.getContext('2d');
  DIRS.forEach((dir, j) => FRAMES.forEach((name, i) => {
    frame(spec, dir, name).forEach((row, y) => row.forEach((c, x) => {
      if (c === null) return;
      g.fillStyle = '#' + c.toString(16).padStart(6, '0');
      g.fillRect(i * W + x, j * H + y, 1, 1);
    }));
  }));
  return cv;
}

/**
 * A person standing in the 3D world as an upright card one texel a pixel, with a blob of shadow:
 * the same shape as sprites.js's spritePerson ({ root, turn, pose(state, t), material, card }).
 * Idle breathes and blinks now and then; walk and run have their own frame rates (FPS).
 */
export function finePerson(spec) {
  const [W, H] = CELL;
  const tex = new THREE.CanvasTexture(sheet(spec));
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / FRAMES.length, 1 / DIRS.length);
  const material = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 });
  const geo = new THREE.PlaneGeometry(W / PX_PER_M, H / PX_PER_M);
  geo.translate(0, H / PX_PER_M / 2, 0);                         // columns 11 | 12 either side of the feet
  const card = new THREE.Mesh(geo, material);
  card.userData.noId = true;
  const root = new THREE.Group();
  root.add(card);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.45, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.scale.y = 0.55;
  blob.position.y = 0.02;
  blob.userData.noId = true;
  root.add(blob);
  const turn = { rotation: { y: 0 } };
  const show = (dir, name) => {
    const i = FRAMES.indexOf(name), j = DIRS.indexOf(dir);
    tex.offset.set(i / FRAMES.length, 1 - (j + 1) / DIRS.length);
  };
  const pose = (state = 'idle', t = 0) => {
    const a = ((turn.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const dir = a < Math.PI / 4 || a >= 7 * Math.PI / 4 ? 'down' : a < 3 * Math.PI / 4 ? 'right' : a < 5 * Math.PI / 4 ? 'up' : 'left';
    let name;
    if (state === 'walk') name = `walk${Math.floor(t * FPS.walk) % WALK}`;
    else if (state === 'run') name = `run${Math.floor(t * FPS.run) % RUN}`;
    else if (state === 'sit') name = 'sit';
    else name = (t % 3.7) < 0.14 && dir !== 'up' ? 'blink' : `idle${Math.floor(t * FPS.idle) % IDLE}`;
    show(dir, name);
  };
  pose();
  return { root, turn, pose, material, card };
}
