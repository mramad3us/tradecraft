// TRADECRAFT art: pixel sprites for people, drawn from templates, shaded like a pixel artist.
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
// sheet(spec) draws every frame (FRAMES across, DIRS down) onto one canvas: 37 × 4 cells. Frames are
// poses of the parts, not drawings of their own: a bob of the body, arms forward or back, legs
// standing, stepping or striding, so a new hat or coat animates for free. A fight's are drawn side on,
// where fighters face each other: a guard (fists up before the face), a fist cocked back and thrown
// (a beginner's wide swing; a hook; an elbow), a knee, kicks (to the middle, the head, the thigh), a
// grab, a throw and a sweep, a parry, a slip, and what a blow does (a reel, a stagger, standing
// dazed); seen from the front they're a stance. Lying down is no frame: the view lays the card down
// (src/render/crowd.js).
//
// **What's in the hand** (spec.hand, a weapon kind: sim/weapons.js): drawn from the near hand outward,
// the way the pose holds it (HOLD: hanging at the side, up in a guard, out in a thrust, raised in a
// swing), from its shape (HELD: grip and blade or shaft, and what's on the end: a hammer's head, a
// shovel's blade), in its own colours (v steel, n a dark grip, o wood, d green glass, j brick, i
// yellow, u black), shaded and outlined like the rest. The cell is PAD pixels wider each side than the
// figure, so a blade held out has somewhere to go. Seen from behind, the body hides it.
//
// **A gun in the hands** (spec.hand 'pistol' or 'rifle', a gun's picture: src/render/view.js; the user,
// 2026-11-03: "when aiming, the sprites should show us aiming, there should be aiming, carrying and shooting
// animations with muzzle flash etc"): the arms are the gun's rig (gunRig()), not the swing, in the street's
// frames and the gun's own (GUN_FRAMES); a fight's, sitting, a phone keep the gun in the hand as above.
//   - Carried (standing, walking, running: the legs go on, the arms hold it): at the low ready. Side on, held
//     out and down the way it points (CARRY_TILT below level: a handgun in close, a long gun's butt still in
//     the shoulder); from the front, a handgun's two hands low before the belt, its muzzle down, a long gun
//     across the body, butt at the right shoulder, muzzle at the left knee; from behind, the arms bent
//     forward out of sight, a long gun's muzzle low past the left hip.
//   - Aimed (aim, aimhi, aimlo): side on, out at shoulder height, a handgun at arm's length in both hands
//     (the wrists taking half the turn, so that aimed high the hands stay under the chin), a long gun
//     shouldered, all one piece turned about the butt, the near hand at its grip, the far one under the
//     handguard; hi and lo turned up or down the picture by AIM_TILT. From the front, the hands together
//     before the chest and the muzzle at you, a ring of steel round the bore (a long gun's at the right
//     cheek); from behind, the arms up along the jaw into the head's shadow, a long gun's barrel up past it
//     on the right. Seen from the front or behind, hi and lo turn it to the picture's right or left.
//   - Fired (fire, firehi, firelo): the same aim kicked, the muzzle thrown up KICK_TILT and the gun back a
//     pixel (from the front, a pixel up). The flash is no part of the sheet (flashOf(): its pixels and where
//     they go, a burst forward side on, a star at you or over the head behind): src/render/crowd.js draws it.
// Side on, every part of a rig is a shape turned about its pivot (turned(): each pixel looks up where it
// came from, so a turned line steps cleanly); from the front and behind, small clusters placed by hand.
import * as THREE from 'three';
import { PX_PER_M } from './pixelart.js';

export const PAD = 2;
export const CELL = [24 + 2 * PAD, 34];
/** A gun aimed, and fired (its kick): straight the way they face, or turned up or down the picture (hi, lo). See "A gun in the hands". */
export const GUN_FRAMES = ['aim', 'aimhi', 'aimlo', 'fire', 'firehi', 'firelo'];
export const FRAMES = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'run0', 'run1', 'run2', 'run3', 'sit', 'guard', 'punch', 'grab', 'reel',
  'chamber', 'swing', 'hook', 'elbow', 'knee', 'kick', 'highkick', 'lowkick', 'throw', 'sweep', 'parry', 'slip', 'stagger', 'stun', 'hail', 'phone', ...GUN_FRAMES];
/** The posed frames (a fight's, sim/cqcshow.js; an arm up for a taxi, sim/taxi.js): a gait of one of these is drawn as that frame. */
export const FIGHT_FRAMES = FRAMES.slice(11, FRAMES.indexOf('aim'));
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
const FIXED = { V: 0x95c1e3, e: 0x14151c, k: 0x14151c, g: 0xe7b84a, G: 0xb9862e, l: 0x6a7182, m: 0x8f96a6, c: 0xe8896a, q: 0x9e3c36, Q: 0x6e2a2e };
// Blood worn (spec.blood: { face, clothes }; sim/health.js p.bloody): under the nose and down the chin,
// and spots down the front.
const BLOOD = {
  face: { down: [9, 15, ['.q.Q.', '.Q.q.', '..Q..', '..q..']], right: [15, 15, ['.qq', 'qQq', '.Q.', '.q.']] },
  clothes: { down: [8, 20, ['..q....', '.Qq..q.', '....Q..', '..q....']], right: [10, 20, ['..qq', '.Q..', '..q.']] },
};
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
    // (the user, 2026-10-27: "more haircuts: women bob/ponytail, men crew/side part")
    crew: {
      down: [4, 6, [
        '....hhhhhhh....',
        '...hhhhhhhhh...',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh.',
        '.h...........h.']],
      up: [4, 6, [
        '....hhhhhhh....',
        '...hhhhhhhhh...',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh.',
        '..hhhhhhhhhhh..']],
      right: [4, 6, [
        '.....hhhhhh....',
        '...hhhhhhhhhh..',
        '..hhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh.',
        '.hhhhhhhhhhhh..',
        '.hhhhhhhhh.....',
        '.hhhhh.........',
        '.hhhh..........',
        '..hh...........']],
    },
    side: {
      down: [4, 5, [
        '....hhhhhhh....',
        '..hhhhHhhhhhh..',
        '.hhhhhHhhhhhhh.',
        'hhhhhhhHhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhh.hh',
        'hh........hhhhh']],
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
        '.hhhhhhhhhhhhh.',
        '..hhhhhhhhhhh..']],
      right: [4, 5, [
        '.....hhhhhh....',
        '...hhhhhhhhhh..',
        '..hhhhhhhhhhhhh',
        '.hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh.',
        'hhhhhhhhhhhhh..',
        'hhhhhhhhhhhh...',
        'hhhhhhhh.......',
        'hhhhh..........',
        'hhhh...........',
        '.hhh...........']],
    },
    bob: {
      down: [3, 5, [
        '.....hhhhhhh.....',
        '...hhhhhhhhhhh...',
        '..hhhhhhhhhhhhh..',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhhhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhh...........hhh',
        'hhhh.........hhhh',
        '.hhHh.......hHhh.']],
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
        '.hhhhhhhhhhhhhhh.',
        '..HHHHHHHHHHHHH..']],
      right: [3, 5, [
        '......hhhhhh....',
        '....hhhhhhhhhh..',
        '...hhhhhhhhhhhh.',
        '..hhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh..',
        'hhhhhhhhhhhhhh..',
        'hhhhhhhhh.......',
        'hhhhhhh.........',
        'hhhhhh..........',
        'hhhhhh..........',
        '.hhhhhh.........',
        '..HHHH..........']],
    },
    ponytail: {
      down: [4, 3, [
        '......HhH......',
        '.....hhhhh.....',
        '....hhhhhhh....',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhh.........hhh',
        'hh...........hh',
        '...............',
        '...............',
        '...............',
        '.............hH',
        '.............hH',
        '..............H']],
      up: [4, 5, [
        '....hhhhhhh....',
        '..hhhhhhhhhhh..',
        '.hhhhhhhhhhhhh.',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhh.',
        '..hhhhhbhhhhh..',
        '......hbh......',
        '......hhh......',
        '......hhh......',
        '......hhh......',
        '......hHh......',
        '.......h.......']],
      right: [1, 5, [
        '........hhhhhh....',
        '......hhhhhhhhhh..',
        '.....hhhhhhhhhhhh.',
        '....hhhhhhhhhhhhhh',
        '..hbhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhh..',
        '.hhh.hhhhhhhhhh...',
        '.hh..hhhhh........',
        '.hh..hh...........',
        '.hh...............',
        '..H...............']],
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
  // ----- rainwear (the weather's: src/render/view.js): a hood up, in the coat's colour; an umbrella -----
  hood: {
    down: [3, 4, [
      '.....ttttttt.....',
      '...ttttttttttt...',
      '..ttttttttttttt..',
      '.ttttttttttttttt.',
      '.ttttttttttttttt.',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      'tttTTTTTTTTTTTttt',
      'ttT...........Ttt',
      'ttT...........Ttt',
      'ttT...........Ttt',
      'ttt...........ttt',
      'tttt.........tttt',
      '.tttt.......tttt.',
      '..ttttttttttttt..']],
    up: [3, 4, [
      '.....ttttttt.....',
      '...ttttttttttt...',
      '..ttttttttttttt..',
      '.ttttttttttttttt.',
      '.ttttttttttttttt.',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      'ttttttttttttttttt',
      '.ttttttttttttttt.',
      '..ttttttttttttt..',
      '...TTTTTTTTTTT...']],
    right: [4, 4, [
      '.....tttttt.....',
      '...tttttttttt...',
      '..tttttttttttt..',
      '.ttttttttttttt..',
      'tttttttttttttTt.',
      'tttttttttttTT...',
      'ttttttttttT.....',
      'ttttttttttT.....',
      'ttttttttttT.....',
      'tttttttttT......',
      'tttttttttT......',
      '.tttttttt.......',
      '..ttttttt.......']],
  },
  umbrella: {
    canopy: [1, 0, [
      '.......uuuuuuuu.......',
      '...uuuuuuuuuuuuuuuu...',
      '.uuuuuuuuuuuuuuuuuuuu.',
      'uUuuUuuUuuUuuUuuUuuUuu',
      'U..U..U..U..U..U..U..U']],
    shaft: { down: [4, 5, ['n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n']], right: [11, 5, ['n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n']] },
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
    // A headscarf (hijab): over the head and round the face, down over the shoulders (Cairo's, Beirut's, London's).
    hijab: {
      down: [3, 5, [
        '.....aaaaaaa.....',
        '...aaaaaaaaaaa...',
        '..aaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaa.........aaa.',
        '.aa...........aa.',
        '.aa...........aa.',
        '.aa...........aa.',
        '.aa...........aa.',
        '.aaa.........aaa.',
        '..aaa.......aaa..',
        '..AAaaa...aaaAA..',
        '.aaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaa']],
      up: [3, 5, [
        '.....aaaaaaa.....',
        '...aaaaaaaaaaa...',
        '..aaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '..aaaaaaaaaaaaa..',
        '..AAAAAAAAAAAAA..',
        '.aaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaa']],
      right: [4, 5, [
        '....aaaaaa......',
        '..aaaaaaaaaa....',
        '.aaaaaaaaaaaa...',
        'aaaaaaaaaaaaaa..',
        'aaaaaaaaaaaaaa..',
        'aaaaaaaaa.......',
        'aaaaaaaa........',
        'aaaaaaaa........',
        'aaaaaaaa........',
        'aaaaaaaa........',
        'aaaaaaaaa.......',
        'aaaaaaaaaa......',
        '.AAAAaaaaaaa....',
        'aaaaaaaaaaaa....',
        'aaaaaaaaaaa.....']],
    },
    // A skullcap (a taqiyah): a white knitted cap on the crown (Cairo's older men).
    skullcap: {
      down: [5, 6, ['...aaaaaaa...', '.aaaaaaaaaaa.', 'aayayayayayaa', 'AAAAAAAAAAAAA']],
      up: [5, 6, ['...aaaaaaa...', '.aaaaaaaaaaa.', 'aaaaaaaaaaaaa', 'AAAAAAAAAAAAA']],
      right: [5, 6, ['....aaaaaa....', '..aaaaaaaaaa..', '.aayayayayaa..', '.AAAAAAAAAAA..']],
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
  // A galabeya: a long robe to the ankles, its neck slit, its hem flaring a little.
  if (kind === 'robe') { x = 6; out = ['..ttttttt..', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', '.ttttttttt.', 'ttttttttttt', 'ttttttttttt', 'ttttttttttt', 'TTTTTTTTTTT']; }
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
    case 'robe': put(0, mid, 's'); put(1, mid, 'y'); put(2, mid, 'y'); put(3, mid, 'y'); break;
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
  // (an arm up, out from the shoulder past the head: a taxi hailed)
  if (reach === 'up') {
    const up = ['......ss', '......ss', '.....tt.', '....tt..', '...tt...', '..tt....', '.tt.....', 'tt......', 'tt......', 't.......'];
    return side > 0 ? [x0, 10, up] : [x0 - 6, 10, up.map(r => [...r].reverse().join(''))];
  }
  // (a phone looked at: the forearm in to the chest, the hands together under it)
  if (reach === 'phone') {
    const bent = ['tt....', 'tt....', 'tt....', '.tt...', '..ttss'];
    return side < 0 ? [x0, 19, bent] : [x0 - 4, 19, bent.map(r => [...r].reverse().join(''))];
  }
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
  if (kind === 'robe') { x = 7; rows = ['..tttt.', '.tttttt', '.tttttt', '.tttttt', '.tttttt', '.tttttt', '.tttttt', '.tttttt', '.tttttt', 'ttttttt', 'ttttttt', 'ttttttt', 'TTTTTTT']; }
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
    2: [10, 20, [`${sl(0)}${sl(0)}...`, `.${sl(1)}${sl(1)}..`, `..${sl(2)}${hand}${hand}`, `...${hand}${hand}`]],   // running: bent, the fist at the chest
    [-1]: [8, 20, [`..${sl(0)}${sl(0)}`, `.${sl(1)}${sl(1)}.`, `.${sl(2)}${sl(2)}.`, `${sl(3)}${sl(3)}..`, `${sl(4)}${sl(4)}..`, `${hand}${hand}..`]],
    [-2]: [7, 20, [`...${sl(0)}${sl(0)}`, `..${sl(1)}${sl(1)}.`, `.${hand}${hand}..`, `.${hand}${hand}..`]],                   // running: bent, the fist at the hip
    // A fight's: fists up, the near one before the eyes, the far one at the chin; a fist thrown at
    // the face; both hands reaching for cloth.
    guard: far ? [11, 16, [`.......${hand}${hand}`, `......${hand}${hand}.`, `.....${sl(2)}${sl(2)}..`, `....${sl(2)}${sl(2)}...`, `${sl(0)}${sl(0)}${sl(1)}${sl(1)}.....`]]
      : [10, 14, [`.....${hand}${hand}`, `.....${hand}${hand}`, `.....${sl(2)}${sl(2)}`, `.....${sl(2)}${sl(2)}`, `.....${sl(2)}${sl(2)}`, `....${sl(1)}${sl(1)}${sl(1)}`, `${sl(0)}${sl(0)}${sl(1)}${sl(1)}${sl(1)}..`]],
    punch: [10, 17, [`..........${hand}${hand}`, `......${sl(2)}${sl(2)}${sl(3)}${sl(3)}${hand}${hand}`, `${sl(0)}${sl(0)}${sl(1)}${sl(1)}${sl(1)}${sl(1)}${sl(2)}${sl(2)}....`, `${sl(0)}${sl(0)}..........`]],
    grab: [10, 20, [`${sl(0)}${sl(0)}${sl(1)}${sl(1)}${sl(2)}${sl(2)}${hand}${hand}${hand}`, `.${sl(1)}${sl(1)}${sl(2)}${sl(2)}${sl(3)}${hand}${hand}.`]],
    // The fist cocked back by the cheek; a wide swing, high; a hook coming round; an elbow, the point forward.
    chamber: [9, 15, [`..${hand}${hand}`, `..${hand}${hand}`, `..${sl(2)}${sl(2)}`, `.${sl(1)}${sl(1)}.`, `${sl(0)}${sl(0)}..`]],
    swing: [10, 12, [`..........${hand}${hand}`, `.........${hand}${hand}${hand}`, `........${sl(2)}${sl(2)}..`, `......${sl(2)}${sl(2)}....`, `.....${sl(1)}${sl(1)}.....`, `...${sl(1)}${sl(1)}.......`, `.${sl(0)}${sl(1)}.........`, `${sl(0)}${sl(0)}..........`]],
    hook: [10, 14, [`.......${hand}${hand}${hand}.`, `.......${hand}${hand}${hand}.`, `........${sl(2)}${sl(2)}`, `.......${sl(2)}${sl(2)}.`, `....${sl(1)}${sl(1)}${sl(1)}${sl(1)}..`, `${sl(0)}${sl(0)}${sl(1)}${sl(1)}......`]],
    elbow: [10, 15, [`..${hand}${hand}${sl(2)}${sl(2)}${sl(2)}${sl(2)}${sl(1)}.`, `...${sl(1)}${sl(1)}${sl(1)}${sl(1)}${sl(1)}${sl(1)}${sl(1)}`, `..${sl(1)}${sl(1)}${sl(1)}......`, `${sl(0)}${sl(0)}${sl(0)}.......`]],
    parry: [10, 19, [`${sl(0)}${sl(0)}......`, `.${sl(1)}${sl(1)}${sl(1)}....`, `....${sl(2)}${sl(2)}${hand}${hand}`, `......${hand}${hand}`]],
    // An arm up for a taxi: forward and high, the hand over the head's front.
    hail: [11, 11, [`..........${hand}${hand}`, `.........${hand}${hand}${hand}`, `........${sl(1)}${sl(1)}..`, `.......${sl(1)}${sl(1)}...`, `.....${sl(0)}${sl(0)}${sl(0)}....`, `...${sl(0)}${sl(0)}${sl(0)}......`, `.${sl(0)}${sl(0)}${sl(0)}........`, `${sl(0)}${sl(0)}..........`]],
  };
  const s = shapes[swing];
  return far && ['punch', 'grab', 'swing', 'hook', 'elbow', 'parry', 'chamber'].includes(swing) ? [s[0] - 2, s[1] + 1, s[2]] : s;   // (the far arm a little behind and below)
}

// Side legs (right): stand, stride (near leg forward or back), pass (one knee up), sit.
function legsSide(pose, near) {
  const shapes = {
    stand: [9, 27, ['pppp..', 'pppp..', 'pppp..', 'pppp..', 'ffffff', 'ffffff']],
    fwd: [9, 27, ['pppp....', '.pppp...', '..pppp..', '..pppp..', '..ffffff', '..fffff.']],
    back: [5, 27, ['....pppp', '...pppp.', '..pppp..', '.pppp...', 'ffff....', '.fff....']],
    lift: [8, 27, ['.pppp.', '.ppppp', '..pppp', '.fffff', '..ffff']],
    runfwd: [9, 27, ['pppp.....', '.pppp....', '...ppp...', '....ppp..', '....ffff.', '....fffff']],
    runback: [5, 27, ['....pppp', 'ff.pppp.', 'ffpppp..', '.pppp...']],          // knee bent, the foot kicked up behind
    runlift: [9, 27, ['ppppp.', '.ppppp', '....pp', '....fff']],                // the knee up, in the air
    runtrail: [7, 27, ['..pppp', '..ppp.', '.ppp..', '.pp...', 'fff...']],
    sit: [9, 27, ['pppppppp', 'pppppppp', '......pp', '......pp', '......ffff']],
    // A fight's: a kick to the middle, to the head, to the thigh; a knee driven up; a sweep along the floor.
    kick: [9, 25, ['.........fff', 'ppppppppppff', 'pppppp......']],
    highkick: [9, 14, ['........fff', '.......ppff', '.......pp..', '......pp...', '......pp...', '.....pp....', '.....pp....', '....pp.....', '...ppp.....', '..ppp......', '.ppp.......', 'pppp.......', 'ppp........']],
    lowkick: [9, 27, ['pppp......', '.ppppp....', '...ppppppf', '.......pff']],
    knee: [9, 23, ['..pppp', 'pppppp', 'ppp.pp', '....pp', '....ff']],
    sweep: [7, 28, ['.pppp......', '..ppppp....', '....pppppff', '.........ff']],
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
  run1: { bob: -1, reach: [0, 0], swing: [-1, 1], front: 0, side: ['runlift', 'runtrail'], lean: 1 },
  run2: { bob: 1, reach: [-1, 1], swing: [2, -2], front: 1, side: ['runback', 'runfwd'], lean: 1 },
  run3: { bob: -1, reach: [0, 0], swing: [1, -1], front: 0, side: ['runtrail', 'runlift'], lean: 1 },
  sit: { bob: 2, reach: [0, 0], swing: [0, 0], front: 0, side: ['sit', 'sit'], sit: true },
  guard: { bob: 1, reach: [-1, -1], swing: ['guard', 'guard'], front: 0, side: ['fwd', 'back'], over: true },
  punch: { bob: 0, reach: [1, -1], swing: ['punch', 'guard'], front: 0, side: ['fwd', 'back'], lean: 1, over: true },
  grab: { bob: 1, reach: [1, 1], swing: ['grab', 'grab'], front: 0, side: ['fwd', 'back'], lean: 1 },
  reel: { bob: 0, reach: [-1, -1], swing: [-1, 1], front: 0, side: ['stand', 'back'], lean: -1 },
  chamber: { bob: 1, reach: [-1, -1], swing: ['chamber', 'guard'], front: 0, side: ['fwd', 'back'], lean: -1, over: true },
  swing: { bob: 0, reach: [1, -1], swing: ['swing', 'guard'], front: 0, side: ['fwd', 'back'], lean: 2, over: true },
  hook: { bob: 0, reach: [1, -1], swing: ['hook', 'guard'], front: 0, side: ['fwd', 'back'], lean: 1, over: true },
  elbow: { bob: 0, reach: [1, -1], swing: ['elbow', 'guard'], front: 0, side: ['fwd', 'back'], lean: 1, over: true },
  knee: { bob: -1, reach: [1, 1], swing: ['grab', 'grab'], front: 0, side: ['knee', 'stand'], lean: 1 , legOver: true },
  kick: { bob: 0, reach: [-1, -1], swing: ['guard', 'guard'], front: 0, side: ['kick', 'stand'], lean: -1, over: true , legOver: true },
  highkick: { bob: 0, reach: [-1, -1], swing: ['guard', 'guard'], front: 0, side: ['highkick', 'stand'], lean: -2, over: true , legOver: true },
  lowkick: { bob: 0, reach: [-1, -1], swing: ['guard', 'guard'], front: 0, side: ['lowkick', 'stand'], lean: -1, over: true , legOver: true },
  throw: { bob: 2, reach: [1, 1], swing: ['grab', 'grab'], front: 0, side: ['fwd', 'back'], lean: 2 },
  sweep: { bob: 1, reach: [1, 1], swing: ['grab', 'grab'], front: 0, side: ['sweep', 'stand'], lean: -1 , legOver: true },
  parry: { bob: 1, reach: [1, -1], swing: ['parry', 'guard'], front: 0, side: ['fwd', 'back'], lean: 0, over: true },
  slip: { bob: 2, reach: [-1, -1], swing: ['guard', 'guard'], front: 0, side: ['stand', 'back'], lean: -2, over: true },
  stagger: { bob: 1, reach: [-1, 1], swing: [-1, 1], front: 0, side: ['back', 'stand'], lean: -2 },
  stun: { bob: 2, reach: [0, 0], swing: [0, 0], front: 0, side: ['stand', 'stand'], lean: -1 },
  hail: { bob: 0, reach: [0, 'up'], swing: ['hail', 0], front: 0, side: ['stand', 'stand'], over: true, armOver: true },
  phone: { bob: 0, reach: ['phone', 'phone'], swing: [2, 2], front: 0, side: ['stand', 'stand'], head: 1, phone: true },   // (looking at a phone: the head bowed to it)
  // (a gun aimed or fired: the arms are the gun's, its rig below; side on, a shooter's stance, the near foot forward)
  ...Object.fromEntries(GUN_FRAMES.map(f => [f, { bob: 0, reach: [0, 0], swing: [0, 0], front: 0, side: ['fwd', 'back'] }])),
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
      const X = x + i + dx + PAD, Y = y + j + dy;
      if (ch === '.' || X < 0 || Y < 0 || X >= W || Y >= H) return;
      cells[Y][X] = { ch, part };
    }));
  };
  let hand = 0;                                                    // (the near hand's part: what's held is drawn from it)
  const bob = P.bob, lean = view === 'right' ? (P.lean ?? 0) : 0;
  const pick = (byView) => byView?.[view] ?? (view === 'up' ? byView?.down : undefined);
  const hat = spec.hat ? T.hat[spec.hat.kind] : null;
  if (spec.hand && /#/.test(spec.hand) && !spec.hand.startsWith('mag-')) spec = { ...spec, hand: 'pistol' };   // (a gun's id: its picture's the pistol's)
  // (a gun in the hands: carried on the street, aimed, fired; its rig is the arms, the hands and the gun)
  const rig = GUN_RIGS[spec.hand] ? gunRig(spec.hand, view, frame, kind) : null;
  const drawAll = (list, dx) => { for (const t of list) draw(t, dx, bob); };

  if (view === 'right') {
    // Far side first: the far arm and leg, shaded; then the near leg, the body, the near arm.
    const air = Math.min(0, bob);                                // in the air, the legs rise with the body
    if (rig) drawAll(rig.under, lean); else draw(armSide(kind, P.swing[1], true), lean, bob);
    draw(legsSide(P.side[1], false), 0, air);
    if (!P.legOver) draw(legsSide(P.side[0], true), 0, air);
    draw(torsoSide(kind), lean, bob);
    if (P.legOver) draw(legsSide(P.side[0], true), 0, air);        // (a kick: the leg comes in front)
    if (rig) drawAll(rig.body, lean);
    else if (!P.over) { draw(armSide(kind, P.swing[0], false), lean, bob); hand = part; }
  } else {
    draw(legsFront(view === 'up' ? -P.front : P.front, P.sit));
    draw(torsoFront(kind, view === 'up'), 0, bob);
    const [l, r] = view === 'up' ? [P.reach[1], P.reach[0]] : P.reach;
    // (an arm up, drawn after the head, over it where they cross: below)
    if (rig) drawAll(rig.body, 0);
    else {
      if (l !== 'up') draw(armFront(5, kind, l, -1), 0, bob);
      hand = part;
      if (r !== 'up') draw(armFront(16, kind, r, 1), 0, bob);
    }
  }
  if (P.phone && view !== 'up') draw(view === 'right' ? [12, 21, ['kk', 'kV', 'kk']] : [9, 23, ['kkkk', 'kVVk', 'kkkk']], view === 'right' ? lean : 0, bob);   // (the phone, its screen lit)
  if (spec.carry && view !== 'up') {                              // in the hand nearest the camera's left
    const item = spec.carry === 'briefcase'
      ? (view === 'right' ? [10, 25, ['.kk.', 'xxxxx', 'xxxxx', 'xxxxx', 'XXXXX']] : [3, 25, ['.kk.', 'xxxx', 'xxxx', 'xxxx', 'XXXX']])
      : (view === 'right' ? [9, 21, ['wwww', 'WWWW']] : [4, 21, ['ww', 'ww', 'WW']]);
    draw(item, view === 'right' ? lean : 0, bob);
  }
  // (an umbrella's shaft, from the hand up: before the head, which hides it where they cross)
  const rain = spec.rainwear;
  if (rain === 'umbrella') draw(view === 'right' ? T.umbrella.shaft.right : T.umbrella.shaft.down, view === 'right' ? lean : 0, bob);
  // The head and everything on it.
  const hb = bob + (P.head ?? 0);
  draw(pick(T.head) ?? T.head.down, lean, hb);
  if (view !== 'up') draw(pick(T.face), lean, hb, true);
  if (spec.beard && view !== 'up') draw(pick(T.beard), lean, hb);
  else if (spec.moustache && view !== 'up') draw(pick(T.moustache), lean, hb);
  const hair = T.hair[style];
  const cropped = ['short', 'crew', 'side'].includes(style);       // (a short cut is all under a hat; longer hair shows below it)
  if (rain === 'hood') {}                                          // (the hood's over it all)
  else if (!(hat && cropped)) draw(hair[view] ?? hair.down, lean, hb);
  else if (view === 'up') draw(hair.up, lean, hb);
  // (under a hat, a short cut shows only at the temples, inside the head's outline: a crew cut not at all; the
  // tufts once stood a pixel outside it, and under a peaked cap read as long hair: the user, 2026-11-03)
  else if (style !== 'crew') draw(view === 'right' ? [5, 12, ['hh.', 'h..']] : [4, 12, ['.h...........h.', 'h.............h']], lean, hb);
  if (spec.glasses && view !== 'up') draw(T.glasses[spec.glasses][view], lean, hb);
  if (spec.blood?.face && view !== 'up') draw(BLOOD.face[view], lean, hb, true);
  if (spec.blood?.clothes && view !== 'up') draw(BLOOD.clothes[view], lean, bob, true);
  if (rain === 'hood') draw(T.hood[view] ?? T.hood.down, lean, hb);
  else if (hat) draw(hat[view] ?? hat.down, lean, hb);
  if (rain === 'umbrella') draw(T.umbrella.canopy, view === 'right' ? lean : 0, hb);
  if (rig) { drawAll(rig.over, lean); return cells; }              // (a gun up before the face: drawn over the head)
  if (P.over && view === 'right') { draw(armSide(kind, P.swing[0], false), lean, bob); hand = part; }   // (a fist before the face)
  if (P.armOver && view !== 'right') {                             // (an arm up past the head: a taxi hailed)
    const [l, r] = view === 'up' ? [P.reach[1], P.reach[0]] : P.reach;
    if (l === 'up') draw(armFront(5, kind, 'up', -1), 0, bob);
    if (r === 'up') draw(armFront(16, kind, 'up', 1), 0, bob);
  }
  if (spec.hand && view !== 'up' && HELD[spec.hand] && !(spec.hand === 'umbrella' && spec.rainwear === 'umbrella')) held(   // (an umbrella up is the canopy and its shaft, not the furled one)
    cells, W, H, hand, ++part, HELD[spec.hand], view === 'right' ? (HOLD[frame] ?? [0, 1]) : [0, 1]);
  return cells;
}

/**
 * How each weapon is drawn in the hand: `line`, its roles from the fist outward (the grip mostly in the
 * fist), and `end`, what's across its far end ([along, across] offsets from the tip and a role), or
 * `block`, something held whole in the fist (a brick).
 */
const HELD = {
  penknife: { line: 'nvv' }, boxcutter: { line: 'ivv' }, switchblade: { line: 'nvvv' }, kitchen: { line: 'ovvvv' },
  finka: { line: 'nvvvv' }, combat: { line: 'nvvvvv', end: [[-4, 1, 'n'], [-4, -1, 'n']] }, screwdriver: { line: 'iivv' },
  bottle: { line: 'dddd', end: [[0, 1, 'd'], [-1, 1, 'd'], [-2, 1, 'd']] }, brokenbottle: { line: 'ddd', end: [[0, 1, 'd'], [1, -1, 'd']] },
  brick: { block: [[0, 0, 'j'], [1, 0, 'j'], [0, 1, 'j'], [1, 1, 'j'], [2, 0, 'j'], [2, 1, 'j']] },
  hammer: { line: 'oooo', end: [[0, 1, 'v'], [0, -1, 'v'], [0, -2, 'v']] }, spanner: { line: 'vvvvv', end: [[1, 1, 'v'], [1, -1, 'v']] },
  pipe: { line: 'vvvvvvvvvv' }, crowbar: { line: 'vvvvvvvvv', end: [[1, 1, 'v'], [0, 1, 'v']] }, stick: { line: 'oooooooooo' },
  umbrella: { line: 'nuuuuuuuuu', end: [[0, 1, 'u'], [-1, 1, 'u']] }, shovel: { line: 'ooooooo', end: [[1, 0, 'v'], [1, 1, 'v'], [1, -1, 'v'], [2, 0, 'v'], [2, 1, 'v'], [2, -1, 'v']] },
  bikelock: { line: 'iv', end: [[1, 1, 'v'], [1, -1, 'v'], [2, 1, 'v'], [2, -1, 'v'], [3, 0, 'v']] }, chain: { line: 'v.v.v.v' },
  pistol: { line: 'nnnn', end: [[-3, 1, 'n'], [-3, 2, 'n']] },   // (a handgun, any model: sim/firearms.js; the slide forward, the grip in the hand)
  rifle: { line: 'nnnnnnnnnn', end: [[-9, 1, 'n'], [-7, 1, 'n'], [-5, 1, 'n'], [-5, 2, 'n']] },   // (a long gun: the stock back, the grip and the magazine below)
};
/** Which way what's held points, by frame (side on): [dx, dy], x forward, y down. Anything else hangs. */
const HOLD = {
  punch: [1, 0], grab: [1, 0], throw: [1, 0], sweep: [1, 0], parry: [1, -1],
  swing: [1, -1], hook: [1, -1], chamber: [0, -1], elbow: [1, -1], guard: [0, -1], slip: [0, -1],
  kick: [0, -1], highkick: [0, -1], lowkick: [0, -1], knee: [0, -1],
};

const HELD_ROLES = new Set(['v', 'n', 'o', 'd', 'j', 'i', 'u']);

/** A thing that's held, lying flat, as the UI draws it (src/ui/pockets.js): [[x, y, colour]], the grip at the left, the tip at the right. */
export function heldIcon(kind) {
  const shape = HELD[/#/.test(kind ?? '') && !String(kind).startsWith('mag-') ? 'pistol' : kind], C = colours({}), out = [];
  if (!shape) return out;
  if (shape.block) { for (const [a, b, r] of shape.block) out.push([a, 1 + b, C[r]]); return out; }
  const line = [...shape.line], tip = line.length - 1;
  line.forEach((r, k) => { if (r !== '.') out.push([k, 2, C[r]]); });
  for (const [a, b, r] of shape.end ?? []) out.push([tip + a, 2 - b, C[r]]);
  return out;
}

/** Draw a weapon (shape) out of the hand's part, pointing d (tilted up, if that way it'd mostly run off the cell), as part `part`. */
function held(cells, W, H, hand, part, shape, d0) {
  const hs = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = cells[y][x]; if (c && c.part === hand && (c.ch === 's' || c.ch === 'S')) hs.push([x, y]); }
  if (!hs.length) return;
  // (the fist's pixel furthest the way it points: the weapon leaves the hand there)
  const n = shape.line?.length ?? 2, inside = (d, [x, y]) => { let k = 0; for (let i = 1; i <= n; i++) { const X = x + d[0] * i, Y = y + d[1] * i; if (X >= 0 && Y >= 0 && X < W && Y < H) k++; } return k; };
  const tip = (d) => hs.reduce((b, p) => (p[0] * d[0] + p[1] * d[1] > b[0] * d[0] + b[1] * d[1] ? p : b));
  const d = [d0, [d0[0], -1], [0, -1]].find(c => inside(c, tip(c)) >= n * 0.7) ?? [0, -1];
  const [hx, hy] = tip(d);
  const put = (x, y, ch) => { if (x >= 0 && y >= 0 && x < W && y < H && ch !== '.') cells[y][x] = { ch, part }; };
  const across = [-d[1] || 0, d[0] || 0];                          // (perpendicular: the side of the shaft)
  if (shape.block) { for (const [a, b, ch] of shape.block) put(hx + d[0] * a + across[0] * b, hy + d[1] * a + across[1] * b, ch); return; }
  [...shape.line].forEach((ch, i) => put(hx + d[0] * (i + 1), hy + d[1] * (i + 1), ch));
  for (const [a, b, ch] of shape.end ?? []) put(hx + d[0] * (n + a) + across[0] * b, hy + d[1] * (n + a) + across[1] * b, ch);
}

// ---------- a gun in the hands: carried, aimed, fired ----------

// (the street's frames: a gun in the hand is carried at the low ready through them)
const CARRIED = new Set(['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'run0', 'run1', 'run2', 'run3']);
// (each gun frame's turn, up the picture or to its right: 1, down or to its left: -1; and whether it's the kick)
const AIMED = { aim: [0, 0], aimhi: [1, 0], aimlo: [-1, 0], fire: [0, 1], firehi: [1, 1], firelo: [-1, 1] };
/** Side on (radians, by gun): a turn up or down the picture; the kick's throw of the muzzle; carried, how far below level it points. */
export const AIM_TILT = { pistol: 0.42, rifle: 0.28 }, KICK_TILT = { pistol: 0.3, rifle: 0.14 }, CARRY_TILT = { pistol: 0.8, rifle: 0.6 };

const span = (a0, a1, b0, b1, ch) => { const o = []; for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) o.push([a, b, typeof ch === 'function' ? ch(a, b) : ch]); return o; };
/** A template ([x, y, rows]) from cells [[x, y, ch]]: null if there are none. */
function tplOf(cells) {
  if (!cells.length) return null;
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  const rows = Array.from({ length: Math.max(...ys) - y0 + 1 }, () => Array(Math.max(...xs) - x0 + 1).fill('.'));
  for (const [x, y, ch] of cells) rows[y - y0][x - x0] = ch;
  return [x0, y0, rows.map(r => r.join(''))];
}
/**
 * Cells of a shape ([[along, across, ch]]) turned by th (radians, y down) about (x0, y0): each pixel looks up
 * where it came from (inverse-mapped), so a turned line steps cleanly and never breaks up.
 */
function turned(shape, x0, y0, th) {
  if (!shape.length) return [];
  const c = Math.cos(th), s = Math.sin(th), at = new Map(shape.map(([a, b, ch]) => [`${a},${b}`, ch]));
  const xs = shape.map(([a, b]) => x0 + a * c - b * s), ys = shape.map(([a, b]) => y0 + a * s + b * c), out = [];
  for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)) + 1; y++)
    for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x++) {
      const dx = x - x0, dy = y - y0, ch = at.get(`${Math.round(dx * c + dy * s) || 0},${Math.round(-dx * s + dy * c) || 0}`);
      if (ch !== undefined) out.push([x, y, ch]);
    }
  return out;
}
const turnPt = ([a, b], x0, y0, th) => [Math.round(x0 + a * Math.cos(th) - b * Math.sin(th)), Math.round(y0 + a * Math.sin(th) + b * Math.cos(th))];
/** A sleeve's role along an arm, k pixels from the shoulder: a tee's goes bare past the elbow, a dress's sooner. */
const sleeve = (kind, far) => (k) => (k >= (kind === 'tee' ? 3 : kind === 'dress' ? 2 : 99) ? (far ? 'S' : 's') : (far ? 'T' : 't'));
/** An arm two pixels thick from the shoulder (x0, y0) to the wrist (x1, y1), its sleeve by the top's kind. */
function limb(kind, x0, y0, x1, y1, far = false) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy), 1), role = sleeve(kind, far), out = [];
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + dx * i / n), y = Math.round(y0 + dy * i / n);
    out.push([x, y, role(i)], Math.abs(dx) >= Math.abs(dy) ? [x, y + 1, role(i)] : [x + 1, y, role(i)]);
  }
  return out;
}

/**
 * Side on, a gun's rig: every part a shape in [along, across] (across: down, when it's level). The arm and the
 * hands turn about the near shoulder (`at`) by `armK` of the aim's angle, the gun about the hands (`grip`, on
 * the arm) by all of it: a handgun held out at arm's length, both hands on it, the wrists taking half the turn
 * (so that aimed high, the hands stay under the chin and the gun clears the face); a long gun shouldered, all
 * one piece turned about the butt in the shoulder, the near hand at its grip, the far one under the handguard.
 * `reach`: the arm's length, aimed and carried (a handgun's held in closer at the low ready). `muzzle`: where
 * the flash comes out, on the gun.
 */
const SIDE_RIG = {
  pistol: {
    at: [10, 20], armK: 0.5, reach: { aim: 6, carry: 4 },
    grip: (r) => [r + 1, 0], muzzle: [7, -1],
    parts: (kind, r) => ({
      near: span(0, r, 0, 1, sleeve(kind)),
      hand: span(r + 1, r + 2, 0, 1, 's'),
      gun: [...span(0, 6, -1, -1, 'n'), [2, 0, 'n'], [5, -1, 'v']],      // (from the fists: the slide over them, the trigger guard under it, a glint on top)
    }),
  },
  rifle: {
    at: [9, 19], armK: 1, reach: { aim: 0, carry: 0 },
    grip: () => [0, 0], muzzle: [16, 0],
    parts: (kind) => ({
      far: span(6, 9, 2, 2, sleeve(kind, true)),                          // (the far arm, under it, reaching for the handguard)
      farHand: span(10, 11, 1, 2, 'S'),
      near: [...span(0, 1, 1, 3, sleeve(kind)), ...span(2, 3, 2, 3, sleeve(kind))],
      gun: [...span(0, 3, 0, 0, 'n'), ...span(0, 1, 1, 1, 'n'), ...span(4, 8, 0, 1, 'n'), ...span(9, 11, 0, 0, 'n'), ...span(9, 10, 1, 1, 'n'),
        ...span(12, 15, 0, 0, 'n'), [13, -1, 'n'], [7, 2, 'u'], [8, 2, 'u'], [8, 3, 'u'], [9, 3, 'u'], ...span(5, 8, 0, 0, 'v')],   // (stock, receiver, handguard, barrel, front sight; the magazine curving forward; the receiver's top lit)
      hand: span(4, 5, 2, 3, 's'),
    }),
  },
};
const GUN_RIGS = SIDE_RIG;

/**
 * A gun's rig for a frame (null: the frame isn't one a gun changes, a fight's, sitting, a phone): templates
 * drawn under the body (`under`: side on, the far arm), on it (`body`) and over the head (`over`: a gun up
 * before the face), the muzzle (template coordinates) and the flash's kind ('side', turned th; 'front', at
 * you; 'back', behind the head).
 */
function gunRig(gun, view, frame, kind) {
  const aimed = AIMED[frame];
  if (!aimed && !CARRIED.has(frame)) return null;
  const [turn, kick] = aimed ?? [null, 0];
  return (view === 'right' ? sideRig : view === 'down' ? frontRig : backRig)(gun, kind, turn, kick);
}

function sideRig(gun, kind, turn, kick) {
  const R = SIDE_RIG[gun], carry = turn === null, r = carry ? R.reach.carry : R.reach.aim;
  // (the kick: the gun back a pixel, its muzzle thrown up)
  const th = carry ? CARRY_TILT[gun] : -turn * AIM_TILT[gun], aim = carry ? th : th - kick * KICK_TILT[gun], arm = carry || R.armK === 1 ? aim : th * R.armK;   // (a long gun's one piece with the arms)
  const x0 = R.at[0] - kick, y0 = R.at[1], p = R.parts(kind, r), [gx, gy] = turnPt(R.grip(r), x0, y0, arm);
  const t = (shape, a = arm, x = x0, y = y0) => shape && tplOf(turned(shape, x, y, a));
  const mine = [t(p.near), t(p.gun, aim, gx, gy), t(p.hand)].filter(Boolean);
  return { under: [t(p.far), t(p.farHand)].filter(Boolean), body: carry ? mine : [], over: carry ? [] : mine,
    muzzle: turnPt(R.muzzle, gx, gy, aim), flash: { kind: 'side', th: aim } };
}

// From the front, aimed: the hands together before the chest, the muzzle at you (a handgun's in the middle, a
// long gun's at the right cheek, on the picture's left), the arms in to them; turned, they're two pixels to the
// picture's right or left; the kick, a pixel up. Carried: a handgun low before the belt, its muzzle down; a long
// gun across the body, the butt at the right shoulder, the muzzle at the left knee.
function frontRig(gun, kind, turn, kick) {
  const out = { under: [], body: [], over: [] };
  if (turn === null && gun === 'pistol') {
    out.body = [tplOf(limb(kind, 5, 20, 8, 23)), tplOf(limb(kind, 16, 20, 13, 23)), tplOf([...span(11, 11, 26, 28, 'v'), ...span(12, 12, 26, 27, 'n')]),
      tplOf([...span(9, 13, 24, 24, 's'), ...span(10, 12, 25, 25, 's')])];
    out.muzzle = [11, 29]; out.flash = { kind: 'front' };
    return out;
  }
  if (turn === null) {                                             // (a long gun across the body)
    const th = Math.atan2(10, 11), x0 = 6, y0 = 19;
    const rifle = [...span(0, 15, 0, 0, 'n'), ...span(0, 1, 1, 1, 'n'), ...span(4, 8, 1, 1, 'n'), [7, 2, 'u'], [8, 2, 'u'], [8, 3, 'u'], ...span(5, 8, 0, 0, 'v')];
    const grip = turnPt([5, 2], x0, y0, th), fore = turnPt([10, -1], x0, y0, th);
    out.body = [tplOf(limb(kind, 5, 20, grip[0] - 1, grip[1] - 1)), tplOf(limb(kind, 16, 20, fore[0], fore[1] - 1)), tplOf(turned(rifle, x0, y0, th)),
      tplOf(span(grip[0], grip[0] + 1, grip[1], grip[1] + 1, 's')), tplOf(span(fore[0], fore[0] + 1, fore[1], fore[1] + 1, 's'))];
    out.muzzle = turnPt([16, 0], x0, y0, th); out.flash = { kind: 'front' };
    return out;
  }
  // (the muzzle at you: a ring of steel round the bore, the slide or the barrel's top dark over it)
  const ring = (x, y) => [[x - 1, y - 1, 'n'], [x, y - 1, 'v'], [x + 1, y - 1, 'n'], [x - 1, y, 'v'], [x, y, 'k'], [x + 1, y, 'v'], [x - 1, y + 1, 'n'], [x, y + 1, 'v'], [x + 1, y + 1, 'n']];
  const cx = (gun === 'pistol' ? 11 : 9) + 2 * turn, cy = 21 - kick;     // (kicked, a pixel up: still under the chin)
  if (gun === 'pistol') {
    out.over = [tplOf(limb(kind, 5, 20, cx - 3, cy + 1)), tplOf(limb(kind, 16, 20, cx + 2, cy + 1)),
      tplOf([...span(cx - 2, cx + 2, cy + 2, cy + 2, 's'), ...span(cx - 1, cx + 1, cy + 3, cy + 3, 's')]), tplOf(ring(cx, cy))];
  } else {
    // (shouldered at the right, the cheek on the stock: the receiver behind the muzzle, the magazine under it, the
    // near hand at the grip below, the far arm across the chest to the handguard)
    out.over = [tplOf(limb(kind, 5, 20, cx - 4, cy + 3)), tplOf(limb(kind, 16, 20, cx + 3, cy + 1)),
      tplOf([[cx - 2, cy - 2, 'n'], [cx - 1, cy - 2, 'n'], [cx - 2, cy - 1, 'n'], ...ring(cx, cy), [cx - 1, cy + 2, 'u'], [cx - 1, cy + 3, 'u']]),
      tplOf(span(cx - 3, cx - 2, cy + 2, cy + 3, 's')), tplOf(span(cx + 2, cx + 3, cy + 1, cy + 2, 's'))];
  }
  out.muzzle = [cx, cy]; out.flash = { kind: 'front' };
  return out;
}

// From behind: carried, the upper arms down at the sides, the forearms forward out of sight (and a long gun's
// muzzle low past the left hip); aimed, the arms up into the head's shadow, a long gun's barrel up past it on the
// right, turned with the aim; the flash, behind the head.
function backRig(gun, kind, turn, kick) {
  const out = { under: [], body: [], over: [] };
  if (turn === null) {
    // (the shoulder's top row a pixel in, as the hanging arm's: armFront())
    out.body = [tplOf(span(5, 6, 19, 23, (a, b) => (b === 19 && a === 5 ? '.' : sleeve(kind)(b - 19)))), tplOf(span(16, 17, 19, 23, (a, b) => (b === 19 && a === 17 ? '.' : sleeve(kind)(b - 19))))];
    if (gun === 'rifle') out.body.push(tplOf([[4, 28, 'n'], [3, 29, 'n']]), tplOf([[17, 18, 'n'], [18, 17, 'n']]));
    out.muzzle = [3, 30]; out.flash = { kind: 'back' };
    return out;
  }
  // (the upper arms up along the jaw, elbows a little out, and in behind the head to the hands)
  out.body = [tplOf([...limb(kind, 5, 20, 4, 16), ...limb(kind, 4, 15, 8 + turn, 13 - kick)]), tplOf([...limb(kind, 16, 20, 17, 16), ...limb(kind, 17, 15, 13 + turn, 13 - kick)])];
  out.flash = { kind: 'back', behind: true };
  if (gun === 'rifle') {
    // (its barrel up past the head's right, clear of a cap's brim; its flash over all, unless the aim swings it behind the head)
    const th = -Math.PI / 2 + turn * AIM_TILT.rifle, x0 = 19, y0 = 20 - kick;
    out.body.push(tplOf(turned([...span(0, 13, 0, 0, 'n'), ...span(0, 4, -1, -1, 'n')], x0, y0, th)));
    out.muzzle = turnPt([14, 0], x0, y0, th);
    out.flash.behind = turn < 0;
  } else out.muzzle = [11 + 2 * turn, 4 - 2 * kick];               // (a handgun's flash, from behind, over the crown: over a cap's too)
  return out;
}

// The muzzle flash: white-hot at the muzzle, then yellow, an orange tip (paper and the two glows: the palette's
// brightest). Side on, a burst forward with a prong either side, turned with the gun; at you, or behind the head, a star.
const FW = 0xf6f4ee, FY = 0xf8e08a, FO = 0xe7b84a;
const FLASH = {
  side: [[0, 0, FW], [1, 0, FW], [2, 0, FW], [3, 0, FW], [4, 0, FY], [5, 0, FO], [1, -1, FY], [2, -1, FW], [1, 1, FY], [2, 1, FW], [3, -2, FY], [3, 2, FY]],
  star: [[0, 0, FW], [1, 0, FW], [-1, 0, FW], [0, 1, FW], [0, -1, FW], [2, 0, FO], [-2, 0, FO], [0, 2, FO], [0, -2, FO], [1, 1, FY], [-1, -1, FY], [1, -1, FY], [-1, 1, FY]],
};
const flashes = new Map();
/**
 * A shot's flash for a frame (fire, firehi, firelo; anything else, null): { x, y, px, behind }, px its rows of
 * colours (null clear) with their top-left at (x, y) in the cell (it may run past the cell's edge: it's drawn
 * on its own, src/render/crowd.js), behind: drawn behind the figure (from behind, past the head).
 */
export function flashOf(gun, dir, name) {
  const key = `${gun}|${dir}|${name}`;
  if (flashes.has(key)) return flashes.get(key);
  const rig = GUN_RIGS[gun] && AIMED[name]?.[1] ? gunRig(gun, dir === 'left' ? 'right' : dir, name, 'suit') : null;   // (the clothes don't move the muzzle)
  let out = null;
  if (rig) {
    const [mx, my] = rig.muzzle, f = rig.flash;
    const cells = f.kind === 'side' ? turned(FLASH.side, mx, my, f.th) : FLASH.star.map(([a, b, c]) => [mx + a, my + b, c]);
    const x0 = Math.min(...cells.map(c => c[0])), y0 = Math.min(...cells.map(c => c[1])), w = Math.max(...cells.map(c => c[0])) - x0 + 1, h = Math.max(...cells.map(c => c[1])) - y0 + 1;
    const px = Array.from({ length: h }, () => Array(w).fill(null));
    for (const [x, y, c] of cells) px[y - y0][x - x0] = c;
    out = dir === 'left' ? { x: CELL[0] - 1 - (x0 + PAD + w - 1), y: y0, px: px.map(r => r.slice().reverse()), behind: false }
      : { x: x0 + PAD, y: y0, px, behind: !!f.behind };
  }
  flashes.set(key, out);
  return out;
}

// ---------- shading and colour ----------

export const SKIN = { light: 0xedc39c, tan: 0xc48a62, brown: 0x8c5a3f, dark: 0x5e3a2a };

function colours(spec) {
  return {
    s: SKIN[spec.skin] ?? spec.skin ?? SKIN.light, h: spec.hair?.color ?? 0x2a1c18, t: spec.top?.color ?? 0x3b6296,
    p: spec.legs ?? 0x283f6b, f: spec.shoes ?? 0x2a1c18, a: spec.hat?.color ?? 0x353947,
    r: spec.beard === true ? (spec.hair?.color ?? 0x2a1c18) : (spec.beard ?? spec.hair?.color ?? 0x2a1c18),
    y: spec.top?.trim ?? spec.top?.tie ?? 0x9e3c36, x: 0x6b4636, w: 0xf6f4ee,
    // (what's in the hand: steel, a dark grip, wood, green glass, brick, yellow plastic, black cloth)
    v: 0x9aa1ae, n: 0x353947, o: 0x8a5a3c, d: 0x3f6b4a, j: 0xb5493c, i: 0xd9a83a, u: 0x23252f,
  };
}

const INNER = [[1, 0], [-1, 0], [0, 1]];
/**
 * Shade a grid of { ch, part } cells into colours: `col` gives each role letter its palette colour
 * (the person's roles, or a prop's own). See the header for the rules. Returns rows of colours.
 */
export function shade(cells, col, { outline = INK } = {}) {
  const H = cells.length, W = cells[0].length;
  const ramps = Object.fromEntries(Object.entries(col).map(([k, v]) => [k, ramp(v)]));
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? cells[y][x] : null);
  // (each cell's role worked out once: the edge tests below ask for a neighbour's again and again)
  const roles = cells.map(row => row.map(c => { const lc = c?.ch.toLowerCase(); return c && col[lc] !== undefined ? lc : null; }));
  const roleAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? roles[y][x] : null);
  const same = (c, r, x, y) => { const o = at(x, y); return o && o.part === c.part && roles[y][x] === r; };
  const out = Array.from({ length: H }, () => Array(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cells[y][x];
    if (!c) continue;
    if (FIXED[c.ch] !== undefined) { out[y][x] = FIXED[c.ch]; continue; }
    if (c.ch === 'b' && ramps.h) { out[y][x] = ramps.h.dark; continue; }
    if (c.ch === 'z' && ramps.s) { out[y][x] = ramps.s.dark; continue; }
    if (c.ch === 'W') { out[y][x] = 0xdfe2e8; continue; }
    const r = roles[y][x];
    if (!r) continue;
    const R = ramps[r];
    if (HELD_ROLES.has(c.ch)) { out[y][x] = R.base; continue; }      // (a weapon a pixel wide: its own colour, or it'd vanish into a coat)
    let tone = c.ch === c.ch.toUpperCase() ? R.shade : R.base;
    if (tone === R.base) {
      const up = at(x, y - 1);
      if (up && up.part > c.part && roles[y - 1][x] && !FIXED[up.ch]) tone = R.shade;   // in the shadow of a part above
      else if (!same(c, r, x + 1, y) || !same(c, r, x, y + 1)) tone = R.shade;           // the right and bottom edges
      else if (!same(c, r, x, y - 1) && same(c, r, x + 1, y)) tone = R.light;            // the top edge
    }
    // A part lying over another: its edge is drawn in its darkest tone (an inner line).
    for (const [dx, dy] of INNER) {
      const o = at(x + dx, y + dy);
      if (o && o.part < c.part && roleAt(x + dx, y + dy)) { tone = R.dark; break; }
    }
    out[y][x] = tone;
  }
  // The outline: ink round the silhouette (4-neighbours).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y][x] !== null) continue;
    if (cells[y][x + 1] || cells[y][x - 1] || cells[y + 1]?.[x] || cells[y - 1]?.[x]) out[y][x] = outline;
  }
  return out;
}

/** One frame as rows of colours (null transparent): for tests and close looks. */
export function frame(spec, dir, name) {
  const px = shade(compose(spec, dir, name), colours(spec));
  return dir === 'left' ? px.map(row => row.slice().reverse()) : px;
}

/**
 * Every frame of a person (or those named), FRAMES across, DIRS down, as rows of colours (null
 * transparent): facing left is facing right mirrored, so those frames are drawn once, not twice.
 */
export function frames(spec, names = FRAMES) {
  const right = new Map();
  return DIRS.map(dir => names.map(name => {
    if (dir === 'left' && right.has(name)) return right.get(name).map(row => row.slice().reverse());
    const px = frame(spec, dir, name);
    if (dir === 'right') right.set(name, px);
    return px;
  }));
}

/** Every frame of a person on one canvas: FRAMES across, DIRS down. */
export function sheet(spec) {
  const [W, H] = CELL;
  const cv = document.createElement('canvas');
  cv.width = W * FRAMES.length; cv.height = H * DIRS.length;
  const g = cv.getContext('2d');
  frames(spec).forEach((facing, j) => facing.forEach((px, i) => blit(g, px, i * W, j * H)));
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

/**
 * Rows of colours onto a canvas (at ox, oy), where it's still clear: a null is written transparent.
 * One putImageData, not a fillRect a pixel (a person's sheet is 110,000 pixels).
 */
export function blit(g, px, ox = 0, oy = 0) {
  const h = px.length, w = px[0]?.length ?? 0;
  if (!w) return;
  const img = new ImageData(w, h), d = img.data;
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p += 4) {
    const c = px[y][x];
    if (c === null) continue;
    d[p] = (c >> 16) & 255; d[p + 1] = (c >> 8) & 255; d[p + 2] = c & 255; d[p + 3] = 255;
  }
  g.putImageData(img, ox, oy);
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
    const f = Math.floor(t * FPS), mod = (n, k) => ((n % k) + k) % k;   // (game time runs negative before 2026)
    const name = state === 'walk' ? `walk${mod(f, 4)}` : state === 'run' ? `run${mod(f, 4)}` : state === 'sit' ? 'sit' : `idle${mod(Math.floor(t * 2), 2)}`;
    show(dir, name);
  };
  pose();
  return { root, turn, pose, material, card };
}
