// TRADECRAFT samples: pixel sprites for people, drawn from templates, shaded like a pixel artist.
//
// The boxes of chibi.js read as boxes from the front. A handheld RPG's people are drawn, so these are
// too: every part (head, face, hair, hat, beard, glasses, torso, arms, legs, feet, things carried)
// is a small template of pixels in three views, down (facing the camera), up (away) and right
// (left is right mirrored), placed on a CELL of 24 × 34 with the feet at the bottom. A template's
// letters are roles, not colours: s skin, h hair, t top, p legs, f shoes, a hat, r beard, y trim
// (a tie, a collar, a belt), w white (a shirt), x a thing carried. A spec gives each role a palette
// colour, and its ramp (RAMPS) gives the tones. Fixed letters: e eye and k ink (near-black), b brow
// (the hair's darkest), g gold, l a lens' glint, m a spectacle frame, z the skin's darkest (a mouth).
// An upper-case role letter is forced into shade.
//
// Then the shading, done the way a pixel artist does it, light from the upper left:
//   - a pixel on a part's top edge takes the light tone, on its right or bottom edge the shade;
//   - a pixel just under another part (the face under the fringe, the chest under the chin, the legs
//     under a coat) is in that part's shadow;
//   - where a part lies over another (an arm over the body, hair over the face), its edge pixel takes
//     its role's darkest tone: a line inside the figure, softer than the outline;
//   - an outline of ink round the whole silhouette.
//
// sheet(spec) draws every frame (FRAMES across, DIRS down) onto one canvas: 11 × 4 cells. Frames are
// poses of the parts, not drawings of their own: a bob of the body, arms forward or back, legs
// standing, stepping or striding, so a new hat or coat animates for free.
import * as THREE from 'three';
import { PX_PER_M } from './pixelart.js';

export const CELL = [24, 34];
export const FRAMES = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'run0', 'run1', 'run2', 'run3', 'sit'];
export const DIRS = ['down', 'up', 'right', 'left'];
export const FPS = 8;

// Palette ramps, dark to light: a colour's tones are its neighbours in its ramp.
const RAMPS = [
  [0x2a1c18, 0x5e3a2a, 0x8c5a3f, 0xc48a62, 0xedc39c],                                 // skin
  [0x14151c, 0x23252f, 0x353947, 0x4c5262, 0x6a7182, 0x8f96a6, 0xb8bdc8, 0xdfe2e8, 0xf6f4ee],
  [0x173327, 0x24503a, 0x356f42, 0x4f8f45, 0x76ad4c, 0xa6cc5e],
  [0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb48459, 0xd6ad7a],
  [0x47302a, 0x5c5650, 0x7d756c, 0xa0978a, 0xc4bba9, 0xe2dac6],
  [0x14151c, 0x3f1a22, 0x6e2a2e, 0x9e3c36, 0xc95c45, 0xe8896a],
  [0x14151c, 0x1b2541, 0x283f6b, 0x3b6296, 0x5d8fc2, 0x95c1e3],
  [0x47302a, 0x7a5a22, 0xb9862e, 0xe7b84a, 0xf8e08a],
  [0x14151c, 0x4a2a52, 0x7a4a86, 0xe8896a],
  [0x14151c, 0x173327, 0x2f6b62, 0x76ad4c],
];
function ramp(c) {
  for (const r of RAMPS) {
    const i = r.indexOf(c);
    if (i >= 0) return { dark: r[Math.max(0, i - 2)], shade: r[Math.max(0, i - 1)], base: c, light: r[Math.min(r.length - 1, i + 1)] };
  }
  return { dark: 0x14151c, shade: c, base: c, light: c };
}
const FIXED = { e: 0x14151c, k: 0x14151c, g: 0xe7b84a, G: 0xb9862e, l: 0x6a7182, m: 0x8f96a6, c: 0xe8896a };
const INK = 0x14151c;

// ---------- templates: [x, y, rows] in cell coordinates; '.' leaves what's under ----------

const T = {
  // ----- heads -----
  head: {
    down: [4, 7, [
      '.....sssss.....',
      '...sssssssss...',
      '..sssssssssss..',
      '.sssssssssssss.',
      '.sssssssssssss.',
      '.sssssssssssss.',
      'sssssssssssssss',
      'sssssssssssssss',
      '.sssssssssssss.',
      '.sssssssssssss.',
      '..sssssssssss..',
      '....sssssss....']],
    right: [5, 7, [
      '....ssssss....',
      '..ssssssssss..',
      '.ssssssssssss.',
      'sssssssssssss.',
      'sssssssssssss.',
      'sssssssssssss.',
      'ssssssssssssss',
      'ssssssssssssss',
      'sssssssssssss.',
      '.ssssssssssss.',
      '..ssssssssss..',
      '....sssssss...']],
  },
  face: {
    down: [4, 7, [
      '...............', '...............', '...............', '...............', '...............',
      '...bbb...bbb...',
      '....e.....e....',
      '....e.....e....',
      '...............',
      '......SzS......']],
    right: [5, 7, [
      '..............', '..............', '..............', '..............', '..............',
      '.........bbb..',
      '....SS....e...',
      '....Ss....e...',
      '....SS.......S',
      '...........z..']],
  },
  // ----- hair: per style; 'up' is the back of the head -----
  hair: {
    short: {
      down: [4, 5, [
        '....hhhhhhh....',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhh.hhhhhhh.hhh',
        'hh...........hh']],
      up: [4, 5, [
        '....hhhhhhh....',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'shhhhhhhhhhhhhs',
        'shhhhhhhhhhhhhs',
        '.hhhhhhhhhhhhh.',
        '..hhhhhhhhhhh..']],
      right: [4, 5, [
        '.....hhhhhh....',
        '...hhhhhhhhhh..',
        '..hhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh.',
        'hhhhhhhhhhhhh..',
        'hhhhhhhhhhhh...',
        'hhhhhhhh.......',
        'hhhhh..........',
        'hhhh...........',
        '.hhh...........']],
    },
    long: {
      down: [3, 5, [
        '.....hhhhhhh.....',
        '...hhhhhhhhhhh...',
        '..hhhhhhhhhhhhh..',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        'hhhhhhh.hhhhhhhhh',
        'hhhh.........hhhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhhh.........hhhh',
        '.hhh.........hhh.',
        '.hhh.........hhh.',
        '..h...........h..']],
      up: [3, 5, [
        '.....hhhhhhh.....',
        '...hhhhhhhhhhh...',
        '..hhhhhhhhhhhhh..',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        '..hhhhhhhhhhhhh..',
        '...hhhhhhhhhhh...',
        '....hhhhhhhhh....']],
      right: [3, 5, [
        '......hhhhhh....',
        '....hhhhhhhhhh..',
        '...hhhhhhhhhhhh.',
        '..hhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh..',
        'hhhhhhhhhhhhh...',
        'hhhhhhhhh.......',
        'hhhhhhh.........',
        'hhhhhh..........',
        'hhhhhh..........',
        'hhhhhh..........',
        'hhhhhh..........',
        '.hhhhh..........',
        '.hhhh...........',
        '..hhh...........',
        '..hh............']],
    },
    bun: {
      down: [4, 2, [
        '......hhh......',
        '.....hhhhh.....',
        '......hhh......',
        '....hhhhhhh....',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhh.......hhhh',
        'hh...........hh']],
      up: [4, 2, [
        '......hhh......',
        '.....hhhhh.....',
        '......hhh......',
        '....hhhhhhh....',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'shhhhhhhhhhhhhs',
        '.hhhhhhhhhhhhh.',
        '..hhhhhhhhhhh..']],
      right: [2, 3, [
        '.hhh.............',
        'hhhhh............',
        '.hhhhhhhhhhh.....',
        '.hhhhhhhhhhhhh...',
        '...hhhhhhhhhhhh..',
        '..hhhhhhhhhhhhhh.',
        '..hhhhhhhhhhhhh..',
        '..hhhhhhhhhhhh...',
        '..hhhhhhhhh......',
        '..hhhhhh.........',
        '..hhhh...........']],
    },
    bald: {
      down: [4, 12, [
        'hh...........hh',
        'h.............h']],
      up: [4, 12, [
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhh.']],
      right: [5, 12, [
        'hhhh..........',
        'hhh...........',
        'hh............']],
    },
  },
  // ----- hats -----
  hat: {
    fedora: {
      down: [2, 2, [
        '......aaaaaaa......',
        '.....aaaaaaaaa.....',
        '.....aaaaaaaaa.....',
        '.....aaaaaaaaa.....',
        '.....kkkkkkkkk.....',
        '.aaaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaa',
        '.AAAAAAAAAAAAAAAAA.']],
      up: [2, 2, [
        '......aaaaaaa......',
        '.....aaaaaaaaa.....',
        '.....aaaaaaaaa.....',
        '.....aaaaaaaaa.....',
        '.....kkkkkkkkk.....',
        '.aaaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaa',
        '.AAAAAAAAAAAAAAAAA.']],
      right: [2, 2, [
        '.......aaaaaa......',
        '......aaaaaaaa.....',
        '......aaaaaaaa.....',
        '......aaaaaaaa.....',
        '......kkkkkkkk.....',
        '..aaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaa',
        '.AAA..........AAAA.']],
    },
    cap: {
      down: [4, 4, [
        '....aaaaaaa....',
        '..aaaaaaaaaaa..',
        '.aaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        '.AAAAAAAAAAAAA.',
        '..AAAAAAAAAAA..']],
      up: [4, 4, [
        '....aaaaaaa....',
        '..aaaaaaaaaaa..',
        '.aaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'aaaaaayyyaaaaaa']],
      right: [4, 4, [
        '.....aaaaaa.......',
        '...aaaaaaaaaa.....',
        '..aaaaaaaaaaaa....',
        '.aaaaaaaaaaaaaa...',
        'aaaaaaaaaaaaaaa...',
        'aaaaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaAAAAAAA']],
    },
    beanie: {
      down: [4, 3, [
        '......a........',
        '....aaaaaaa....',
        '..aaaaaaaaaaa..',
        '.aaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'yyyyyyyyyyyyyyy',
        'yyyyyyyyyyyyyyy']],
      up: [4, 3, [
        '......a........',
        '....aaaaaaa....',
        '..aaaaaaaaaaa..',
        '.aaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaa',
        'yyyyyyyyyyyyyyy',
        'yyyyyyyyyyyyyyy']],
      right: [4, 3, [
        '.......a.......',
        '.....aaaaaa....',
        '...aaaaaaaaaa..',
        '..aaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaa..',
        'yyyyyyyyyyyyy..',
        'yyyyyyyyyyyy...']],
    },
    peaked: {
      down: [3, 3, [
        '..aaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaa',
        '.AAAAAAAAAAAAAAA.',
        '..yyyyyyggyyyyy..',
        '..yyyyyyyyyyyyy..',
        '...kkkkkkkkkkk...',
        '....kkkkkkkkk....']],
      up: [3, 3, [
        '..aaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaa',
        '.AAAAAAAAAAAAAAA.',
        '..yyyyyyyyyyyyy..',
        '..yyyyyyyyyyyyy..']],
      right: [3, 3, [
        '...aaaaaaaaaaa....',
        '.aaaaaaaaaaaaaaa..',
        'aaaaaaaaaaaaaaaaa.',
        '.AAAAAAAAAAAAAAA..',
        '...yyyyyyyyyyygg..',
        '...yyyyyyyyyyyyy..',
        '..............kkkk',
        '...............kkk']],
    },
  },
  // ----- beards and moustaches -----
  beard: {
    down: [5, 14, [
      '.............',
      'rr.........rr',
      'rrr.rrrrr.rrr',
      'rrrr.zzz.rrrr',
      '.rrrrrrrrrrr.',
      '..rrrrrrrrr..',
      '....rrrrr....']],
    right: [9, 14, [
      '.........',
      'rr.......',
      'rrr..rrrr',
      'rrrrrrzr.',
      '.rrrrrrr.',
      '..rrrrr..',
      '....rr...']],
  },
  moustache: {
    down: [8, 16, ['..rrrrr..', '..r...r..']],
    right: [15, 16, ['.rrr', '.r..']],
  },
  glasses: {
    shades: { down: [5, 12, ['..kkkkk.kkkkk..', '..klkkkkklkkk..', '...kkk...kkk...']], right: [14, 12, ['kkkk', 'lkkk', '.kk.']] },
    specs: { down: [5, 12, ['..mmmm...mmmm..', '..m..mmmmm..m..', '...mm.....mm...']], right: [13, 12, ['mmmmm', 'm..m.', '.mm..']] },
  },
};

// ---------- bodies: torso, arms, legs, by kind of top and pose ----------

// Front torso (down/up), 9 wide at x 7..15, y 19..26; a coat runs to y 29, a dress flares to y 28.
function torsoFront(kind, back) {
  const rows = [
    '.ttttttt.',
    'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt', 'ttttttttt'];
  let x = 7;
  let out = rows.slice();
  if (kind === 'dress') { x = 5; out = ['...ttttttt...', '..ttttttttt..', '..ttttttttt..', '..ttttttttt..', '..yyyyyyyyy..', '..ttttttttt..', '.ttttttttttt.', '.ttttttttttt.', 'ttttttttttttt', 'ttttttttttttt']; }
  if (kind === 'coat') { x = 6; out = ['..ttttttt..', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', 'ttttttttttt', 'ttttttttttt', 'ttttttttttt']; }
  if (back) return [x, 19, out];
  // Front details, drawn into the rows (x relative to the template).
  const put = (r, c, ch) => { out[r] = out[r].slice(0, c) + ch + out[r].slice(c + 1); };
  const mid = (out[0].length - 1) / 2;
  switch (kind) {
    case 'tee': put(0, mid - 1, 's'); put(0, mid, 's'); put(0, mid + 1, 's'); put(1, mid, 's'); break;
    case 'suit':
      for (const [r, c] of [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [1, -1], [1, 1], [2, 0]]) put(r, mid + c, 'w');
      for (let r = 1; r <= 4; r++) put(r, mid, 'y');
      put(1, mid - 2, 'T'); put(2, mid - 2, 'T'); put(2, mid - 1, 'T'); put(1, mid + 2, 'T'); put(2, mid + 2, 'T'); put(2, mid + 1, 'T');
      put(5, mid, 'k');
      break;
    case 'coat':
      for (const [r, c] of [[0, -1], [0, 0], [0, 1], [1, 0]]) put(r, mid + c, 'w');
      put(1, mid, 'y'); put(2, mid, 'y');
      put(0, mid - 2, 'T'); put(1, mid - 2, 'T'); put(1, mid - 1, 'T'); put(0, mid + 2, 'T'); put(1, mid + 2, 'T'); put(1, mid + 1, 'T');
      for (let c = 1; c < out[5].length - 1; c++) put(5, c, 'y'); put(5, mid, 'g');
      put(3, mid - 2, 'k'); put(3, mid + 2, 'k'); put(7, mid - 2, 'k'); put(7, mid + 2, 'k');
      for (let r = 6; r < out.length; r++) put(r, mid, 'T');
      break;
    case 'dress': for (const c of [-1, 0, 1]) put(0, mid + c, 's'); put(1, mid, 's'); break;
    case 'uniform':
      put(0, mid - 1, 's'); put(0, mid, 's'); put(0, mid + 1, 's');
      for (let r = 1; r < 7; r++) put(r, mid, 'T');
      put(2, mid - 3, 'T'); put(2, mid - 2, 'T'); put(2, mid + 2, 'T'); put(2, mid + 3, 'T'); put(2, mid - 3, 'g');
      for (let c = 0; c < 9; c++) put(6, c, 'k'); put(6, mid, 'g');
      break;
    case 'sweater': for (const c of [-2, -1, 0, 1, 2]) put(0, mid + c, 'y'); for (let c = 0; c < 9; c++) put(3, c, 'y'); break;
  }
  return [x, 19, out];
}

// A front arm at column x0 (2 wide): the sleeve to the wrist (a tee's stops short), then the hand.
// reach: 0 hanging, 1 forward (the hand a pixel lower), -1 back (a pixel higher).
function armFront(x0, kind, reach, side) {
  const len = 5 + reach, rows = [];
  rows.push(side < 0 ? '.t' : 't.');
  for (let i = 0; i < len; i++) rows.push(kind === 'tee' && i >= 2 || kind === 'dress' && i >= 1 ? 'ss' : 'tt');
  rows.push('ss', 'ss');
  return [x0, 19, rows];
}

// Front legs: stand, or step (one foot lifted a pixel: it's behind), at x 7..15, y 27..32.
function legsFront(step, sit) {
  if (sit) return [7, 29, ['.ppppppp.', '.ppp.ppp.', 'ffff.ffff', 'ffff.ffff']];
  const L = ['.ppppppp.', '.ppp.ppp.', '.ppp.ppp.', '.ppp.ppp.', 'ffff.ffff', 'ffff.ffff'];
  if (step < 0) return [7, 27, ['.ppppppp.', '.ppp.ppp.', '.ppp.ppp.', '.ppp.FFFF', 'ffff.FFFF', 'ffff.....']];
  if (step > 0) return [7, 27, ['.ppppppp.', '.ppp.ppp.', '.ppp.ppp.', 'FFFF.ppp.', 'FFFF.ffff', '.....ffff']];
  return [7, 27, L];
}

// Side torso (right), 6 deep at x 8..13; a coat or dress flares behind.
function torsoSide(kind) {
  let rows = ['.tttt.', 'tttttt', 'tttttt', 'tttttt', 'tttttt', 'tttttt', 'tttttt', 'tttttt'];
  let x = 8;
  if (kind === 'coat') { x = 7; rows = ['..tttt.', '.tttttt', '.tttttt', '.tttttt', '.tttttt', '.yyyyyy', '.tttttt', '.tttttt', 'ttttttt', 'ttttttt', 'tttttt.']; }
  if (kind === 'dress') { x = 6; rows = ['...tttt.', '..tttttt', '..tttttt', '..tttttt', '..yyyyyy', '..tttttt', '.ttttttt', '.ttttttt', 'tttttttt', 'tttttttt']; }
  const put = (r, c, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };
  const front = rows[1].length - 1;
  if (kind === 'suit') { put(0, front - 1, 'w'); put(1, front, 'w'); put(2, front, 'y'); put(3, front, 'y'); }
  if (kind === 'coat') { put(0, front - 1, 'w'); put(1, front, 'T'); }
  if (kind === 'tee' || kind === 'uniform' || kind === 'dress') put(0, front - 1, 's');
  if (kind === 'uniform') { put(2, front - 1, 'g'); for (let c = 0; c <= front; c++) put(6, c, 'k'); }
  if (kind === 'sweater') { put(0, front - 1, 'y'); for (let c = 0; c <= front; c++) put(3, c, 'y'); }
  return [x, 19, rows];
}

// A side arm (the near one): hanging, forward or back by `swing` (-2..2), bent when running.
function armSide(kind, swing, far) {
  const sl = (i) => (kind === 'tee' && i >= 2) || (kind === 'dress' && i >= 1) ? 's' : far ? 'T' : 't';
  const hand = far ? 'S' : 's';
  const shapes = {
    0: [10, 20, [`${sl(0)}${sl(0)}`, `${sl(1)}${sl(1)}`, `${sl(2)}${sl(2)}`, `${sl(3)}${sl(3)}`, `${sl(4)}${sl(4)}`, `${hand}${hand}`, `${hand}${hand}`]],
    1: [10, 20, [`${sl(0)}${sl(0)}..`, `.${sl(1)}${sl(1)}.`, `.${sl(2)}${sl(2)}.`, `..${sl(3)}${sl(3)}`, `..${sl(4)}${sl(4)}`, `..${hand}${hand}`]],
    2: [10, 20, [`${sl(0)}${sl(0)}...`, `.${sl(1)}${sl(1)}..`, `..${sl(2)}${sl(2)}.`, `...${sl(3)}${hand}`, `...${hand}${hand}`]],
    [-1]: [8, 20, [`..${sl(0)}${sl(0)}`, `.${sl(1)}${sl(1)}.`, `.${sl(2)}${sl(2)}.`, `${sl(3)}${sl(3)}..`, `${sl(4)}${sl(4)}..`, `${hand}${hand}..`]],
    [-2]: [7, 20, [`...${sl(0)}${sl(0)}`, `..${sl(1)}${sl(1)}.`, `.${sl(2)}${sl(2)}..`, `${hand}${sl(3)}...`, `${hand}${hand}...`]],
  };
  return shapes[swing];
}

// Side legs (right): stand, stride (near leg forward or back), pass (one knee up), sit.
function legsSide(pose, near) {
  const shapes = {
    stand: [9, 27, ['pppp..', 'pppp..', 'pppp..', 'pppp..', 'ffffff', 'ffffff']],
    fwd: [9, 27, ['pppp....', '.pppp...', '..pppp..', '..pppp..', '..ffffff', '..fffff.']],
    back: [5, 27, ['....pppp', '...pppp.', '..pppp..', '.pppp...', 'ffff....', '.fff....']],
    lift: [8, 27, ['.pppp.', '.ppppp', '..pppp', '.fffff', '..ffff']],
    runfwd: [9, 26, ['pppp.....', '.ppppp...', '...pppp..', '....pppp.', '....pppp.', '....ffffff', '.....ffff.']],
    runback: [3, 26, ['......pppp', '.....pppp.', '...pppp...', '.pppp.....', 'fppp......', 'fff.......']],
    sit: [9, 27, ['pppppppp', 'pppppppp', '......pp', '......pp', '......ffff']],
  };
  const [x, y, rows] = shapes[pose];
  return [x, y, near ? rows : rows.map(r => r.toUpperCase())];   // the far leg in shade
}

// ---------- composing a frame ----------

// What each frame does: the body's bob (down), arms (front: reach; side: swing), legs.
const POSES = {
  idle0: { bob: 0, reach: [0, 0], swing: [0, 0], front: 0, side: ['stand', 'stand'] },
  idle1: { bob: 1, reach: [0, 0], swing: [0, 0], front: 0, side: ['stand', 'stand'] },
  walk0: { bob: 1, reach: [1, -1], swing: [-1, 1], front: -1, side: ['fwd', 'back'] },
  walk1: { bob: 0, reach: [0, 0], swing: [0, 0], front: 0, side: ['stand', 'lift'] },
  walk2: { bob: 1, reach: [-1, 1], swing: [1, -1], front: 1, side: ['back', 'fwd'] },
  walk3: { bob: 0, reach: [0, 0], swing: [0, 0], front: 0, side: ['lift', 'stand'] },
  run0: { bob: 1, reach: [1, -1], swing: [-2, 2], front: -1, side: ['runfwd', 'runback'], lean: 1 },
  run1: { bob: -1, reach: [0, 0], swing: [0, 0], front: 0, side: ['lift', 'stand'], lean: 1 },
  run2: { bob: 1, reach: [-1, 1], swing: [2, -2], front: 1, side: ['runback', 'runfwd'], lean: 1 },
  run3: { bob: -1, reach: [0, 0], swing: [0, 0], front: 0, side: ['stand', 'lift'], lean: 1 },
  sit: { bob: 2, reach: [0, 0], swing: [0, 0], front: 0, side: ['sit', 'sit'], sit: true },
};

function compose(spec, dir, frame) {
  const [W, H] = CELL;
  const view = dir === 'left' ? 'right' : dir;
  const P = POSES[frame];
  const kind = spec.top?.kind ?? 'tee';
  const style = spec.hair?.style ?? 'short';
  const cells = Array.from({ length: H }, () => Array(W).fill(null));   // { ch, part }
  let part = 0;
  // Each template is a part of its own (outlines and shadows fall between parts), unless `same`:
  // the face is painted on the head, not laid over it.
  const draw = (tpl, dx = 0, dy = 0, same = false) => {
    if (!tpl) return;
    const [x, y, rows] = tpl;
    if (!same) part++;
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const X = x + i + dx, Y = y + j + dy;
      if (ch === '.' || X < 0 || Y < 0 || X >= W || Y >= H) return;
      cells[Y][X] = { ch, part };
    }));
  };
  const bob = P.bob, lean = view === 'right' ? (P.lean ?? 0) : 0;
  const pick = (byView) => byView?.[view] ?? (view === 'up' ? byView?.down : undefined);
  const hat = spec.hat ? T.hat[spec.hat.kind] : null;

  if (view === 'right') {
    // Far side first: the far arm and leg, shaded; then the near leg, the body, the near arm.
    draw(armSide(kind, P.swing[1], true), lean, bob);
    draw(legsSide(P.side[1], false));
    draw(legsSide(P.side[0], true));
    draw(torsoSide(kind), lean, bob);
    draw(armSide(kind, P.swing[0], false), lean, bob);
  } else {
    draw(legsFront(view === 'up' ? -P.front : P.front, P.sit));
    draw(torsoFront(kind, view === 'up'), 0, bob);
    const [l, r] = view === 'up' ? [P.reach[1], P.reach[0]] : P.reach;
    draw(armFront(5, kind, l, -1), 0, bob);
    draw(armFront(16, kind, r, 1), 0, bob);
  }
  if (spec.carry && view !== 'up') {                              // in the hand nearest the camera's left
    const item = spec.carry === 'briefcase'
      ? (view === 'right' ? [10, 25, ['.kk.', 'xxxxx', 'xxxxx', 'xxxxx', 'XXXXX']] : [3, 25, ['.kk.', 'xxxx', 'xxxx', 'xxxx', 'XXXX']])
      : (view === 'right' ? [9, 21, ['wwww', 'WWWW']] : [4, 21, ['ww', 'ww', 'WW']]);
    draw(item, view === 'right' ? lean : 0, bob);
  }
  // The head and everything on it.
  const hb = bob + (P.sit ? 0 : 0);
  draw(pick(T.head) ?? T.head.down, lean, hb);
  if (view !== 'up') draw(pick(T.face), lean, hb, true);
  if (spec.beard && view !== 'up') draw(pick(T.beard), lean, hb);
  else if (spec.moustache && view !== 'up') draw(pick(T.moustache), lean, hb);
  const hair = T.hair[style];
  if (!(hat && style === 'short')) draw(hair[view] ?? hair.down, lean, hb);
  else if (view === 'up') draw(hair.up, lean, hb);
  else draw([4, 12, view === 'right' ? ['hhhh', 'hhh.', 'hh..'] : ['hh...........hh', 'h.............h']], lean, hb);
  if (spec.glasses && view !== 'up') draw(T.glasses[spec.glasses][view], lean, hb);
  if (hat) draw(hat[view] ?? hat.down, lean, hb);
  return cells;
}

// ---------- shading and colour ----------

export const SKIN = { light: 0xedc39c, tan: 0xc48a62, brown: 0x8c5a3f, dark: 0x5e3a2a };

function colours(spec) {
  return {
    s: SKIN[spec.skin] ?? spec.skin ?? SKIN.light, h: spec.hair?.color ?? 0x2a1c18, t: spec.top?.color ?? 0x3b6296,
    p: spec.legs ?? 0x283f6b, f: spec.shoes ?? 0x2a1c18, a: spec.hat?.color ?? 0x353947,
    r: spec.beard === true ? (spec.hair?.color ?? 0x2a1c18) : (spec.beard ?? spec.hair?.color ?? 0x2a1c18),
    y: spec.top?.trim ?? spec.top?.tie ?? 0x9e3c36, x: 0x6b4636, w: 0xf6f4ee,
  };
}

/**
 * Shade a grid of { ch, part } cells into colours: `col` gives each role letter its palette colour
 * (the person's roles, or a prop's own). See the header for the rules. Returns rows of colours.
 */
export function shade(cells, col, { outline = INK } = {}) {
  const H = cells.length, W = cells[0].length;
  const ramps = Object.fromEntries(Object.entries(col).map(([k, v]) => [k, ramp(v)]));
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? cells[y][x] : null);
  const role = (c) => c && col[c.ch.toLowerCase()] !== undefined ? c.ch.toLowerCase() : null;
  const same = (c, x, y) => { const o = at(x, y); return o && o.part === c.part && role(o) === role(c); };
  const out = Array.from({ length: H }, () => Array(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cells[y][x];
    if (!c) continue;
    if (FIXED[c.ch] !== undefined) { out[y][x] = FIXED[c.ch]; continue; }
    if (c.ch === 'b' && ramps.h) { out[y][x] = ramps.h.dark; continue; }
    if (c.ch === 'z' && ramps.s) { out[y][x] = ramps.s.dark; continue; }
    if (c.ch === 'W') { out[y][x] = 0xdfe2e8; continue; }
    const r = role(c);
    if (!r) continue;
    const R = ramps[r];
    let tone = c.ch === c.ch.toUpperCase() ? R.shade : R.base;
    if (tone === R.base) {
      const up = at(x, y - 1);
      if (up && up.part > c.part && role(up) && !FIXED[up.ch]) tone = R.shade;           // in the shadow of a part above
      else if (!same(c, x + 1, y) || !same(c, x, y + 1)) tone = R.shade;                   // the right and bottom edges
      else if (!same(c, x, y - 1) && same(c, x + 1, y)) tone = R.light;                    // the top edge
    }
    // A part lying over another: its edge is drawn in its darkest tone (an inner line).
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
      const o = at(x + dx, y + dy);
      if (o && o.part < c.part && role(o)) { tone = R.dark; break; }
    }
    out[y][x] = tone;
  }
  // The outline: ink round the silhouette (4-neighbours).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y][x] !== null) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells[y + dy]?.[x + dx])) out[y][x] = outline;
  }
  return out;
}

/** One frame as rows of colours (null transparent): for tests and close looks. */
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
 * A prop's sprite from layers of templates ([x, y, rows], each a part): w × h, `col` a colour per
 * role letter. Returns rows of colours (null transparent).
 */
export function drawSprite(w, h, layers, col, opts) {
  const cells = Array.from({ length: h }, () => Array(w).fill(null));
  layers.forEach(([x, y, rows], part) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.' && x + i >= 0 && y + j >= 0 && x + i < w && y + j < h) cells[y + j][x + i] = { ch, part: part + 1 };
  })));
  return shade(cells, col, opts);
}

/** Rows of colours onto a canvas (at ox, oy). */
export function blit(g, px, ox = 0, oy = 0) {
  px.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    g.fillStyle = '#' + c.toString(16).padStart(6, '0');
    g.fillRect(ox + x, oy + y, 1, 1);
  }));
}

/**
 * An upright card in the world showing a canvas one texel a pixel, its bottom on the ground and
 * column `ox` over its origin; `frames` side by side make it animatable (card.show(i)).
 */
export function card(canvas, { ox = canvas.width / 2, frames = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / frames, 1);
  const w = canvas.width / frames, h = canvas.height;
  const geo = new THREE.PlaneGeometry(w / PX_PER_M, h / PX_PER_M);
  geo.translate((w / 2 - ox - 0.5) / PX_PER_M, h / PX_PER_M / 2, 0);
  // Its shadow is its silhouette (three's shadow pass takes the map and alphaTest from the material),
  // from both sides: by default a one-sided card draws only its back face into the shadow map, and
  // the sun sees its front.
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, shadowSide: THREE.DoubleSide }));
  mesh.userData.noId = true;
  mesh.userData.sprite = true;                                   // lit by stage.lightAt, not the lights
  mesh.show = (i) => tex.offset.set(i / frames, 0);
  return mesh;
}

/**
 * A person as a sprite standing in the 3D world: an upright card facing the camera, one texel a
 * pixel (a metre is PX_PER_M pixels both up a wall and across), with a blob of shadow. Same shape as
 * chibi(): { root, turn, pose(state, t) }, turn.rotation.y picking the view (0 faces the camera).
 * `tint` (a THREE.Color) is the light it stands in (day: white).
 */
export function spritePerson(spec) {
  const [W, H] = CELL;
  const tex = new THREE.CanvasTexture(sheet(spec));
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / FRAMES.length, 1 / DIRS.length);
  const material = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 });
  const geo = new THREE.PlaneGeometry(W / PX_PER_M, H / PX_PER_M);
  geo.translate(0.5 / PX_PER_M, H / PX_PER_M / 2, 0);            // column 11 over the feet, the bottom on the ground
  const card = new THREE.Mesh(geo, material);
  card.userData.noId = true;                                     // it brings its own outline
  const root = new THREE.Group();
  root.add(card);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.4, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.scale.y = 0.6;
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
    const f = Math.floor(t * FPS);
    const name = state === 'walk' ? `walk${f % 4}` : state === 'run' ? `run${f % 4}` : state === 'sit' ? 'sit' : `idle${Math.floor(t * 2) % 2}`;
    show(dir, name);
  };
  pose();
  return { root, turn, pose, material, card };
}
