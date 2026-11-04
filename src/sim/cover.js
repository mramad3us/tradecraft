// TRADECRAFT sim: cover (the user, 2026-11-04: "Build a cover system, where being behind objects that can provide cover move
// the needle in the dice rolls when a shot is computed. Being at the corner of a wall should be better than behind shallow
// cover. There should also be a hide behind cover action when in gun mode and close to cover. I'm sure you can figure out
// this system in a realistic and cheap way (think it through)").
//
// **What's cover, for a shot** (coverOf()): what's on the line of fire in its last COVER_M before the target (nearer the
// shooter, it's the shooter's, and over it they shoot), the street's own things as they stand (its blockers, sim/map/
// street.js: the buildings' mass, a parked car, a pillar box, a bin...), each as COVER has it: how high it stands (h, m),
// how much of a round it stops (stop: a wall all of it, a car's engine block and wheels most, its doors and a bin little,
// glass and a hedge nothing: concealment, not cover), and whether it stands taller than a man (tall: a wall, a phone box, a
// tree's trunk, a lamp post: then how wide it is against a body's BODY_W is what it covers). The strongest of them on the
// line is the one that counts. No line, no extra work: a few dozen rectangles a shot, nothing a tick.
// **How much of you** (share()): by the part the round's aimed at and how you stand (postureOf()): standing, behind a car
// you're hidden to the chest (legs 0–0.85 m, the torso to 1.5, the head to 1.75); down behind it (crouch: the head's top at
// 1.15) nothing shows over a car; up over it to fire (rise), only the head and a shoulder; at a wall's corner, leaning out
// to fire, LEAN of you still behind it, and hidden there, all of you. So a wall's corner beats a car (all of a round stopped,
// against most), and a car beats a bench.
// **A hit roll made** (into()): the share of the aimed-at part behind it takes the round instead, and the cover stops it
// by its stop; through, the round goes on into you as it would have (sim/shooting.js: the player's shots and everyone
// else's, the odds shown with it).
// **Down behind it** (hideSpot(), sim/shooting.js 'cover'): in the stop motion, the nearest cover within HIDE_M, at the side
// of it away from whoever's the threat (an officer after you, else the one you've picked): you crouch there (a.cover: the
// gait 'kneel'). An aim from there has you up over it (rise) till you go down again (the step again, the aim dropped); you
// stay down out of the stop motion till you move.
import { townOf } from './cities/index.js';
import { sectionOf } from './city.js';
import { SECTION_M } from './map/street.js';
import { chance } from './rng.js';

export const COVER_M = 3, HIDE_M = 1.8, BODY_W = 0.55, LEAN = 0.65, HIDE_OUT_M = 0.45;
// (h, m; stop, of a round; tall: taller than a man; w: what of it is really there, where the blocker's padded (a lamp's 15 cm))
export const COVER = {
  building: { h: 9, stop: 1, tall: true, word: 'the wall' },
  monument: { h: 2.5, stop: 1, tall: true, word: 'the monument' },
  car: { h: 1.4, stop: 0.6, word: 'the parked car' },
  postbox: { h: 1.25, stop: 1, w: 0.5, word: 'the post box' },
  fountain: { h: 0.9, stop: 1, word: 'the fountain\'s rim' },
  generator: { h: 1.2, stop: 0.8, word: 'the generator' },
  phonebox: { h: 2.4, stop: 0.35, tall: true, w: 0.9, word: 'the phone box' },
  tree: { h: 4, stop: 0.9, tall: true, w: 0.35, word: 'the tree' },
  lamp: { h: 5, stop: 1, tall: true, w: 0.15, word: 'the lamp post' },
  beacon: { h: 2.5, stop: 1, tall: true, w: 0.1, word: 'the beacon\'s pole' },
  bin: { h: 1.0, stop: 0.35, w: 0.5, word: 'the bin' },
  bench: { h: 0.85, stop: 0.25, word: 'the bench' },
  stall: { h: 1.5, stop: 0.2, word: 'the stall' },
  cart: { h: 1.1, stop: 0.3, word: 'the cart' },
  scooter: { h: 1.0, stop: 0.3, word: 'the scooter' },
  furniture: { h: 1.0, stop: 0.3, word: 'the furniture' },
  notices: { h: 2, stop: 0.2, tall: true, word: 'the notice board' },
  railing: { h: 1.0, stop: 0.1, word: 'the railings' },
  area: { h: 1.0, stop: 0.1, word: 'the railings' },
  hedge: { h: 1.3, stop: 0, word: 'the hedge' },
  stop: { h: 2.4, stop: 0.05, tall: true, word: 'the shelter\'s glass' },
  glass: { h: 2.5, stop: 0.05, tall: true, word: 'the shop window' },
};
const SPANS = { stand: { legs: [0, 0.85], torso: [0.85, 1.5], head: [1.5, 1.75] }, crouch: { legs: [0, 0.4], torso: [0.4, 0.9], head: [0.9, 1.15] } };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How someone stands, for cover: 'stand'; down behind something, 'crouch'; up over it to fire (an aim held from there, or on its way), 'rise'. */
export function postureOf(state, a) {
  if (!a?.cover) return 'stand';
  const sh = a.who === state.player ? state.shoot : null;
  return sh && (sh.aim || sh.doing?.what === 'aim' || sh.doing?.what === 'fire') ? 'rise' : 'crouch';
}

/** How much of the part a cover C (wide: of a body, against the line) hides, standing so. */
function share(C, wide, part, posture) {
  if (C.tall) return wide * (posture === 'rise' ? LEAN : 1);       // (behind it all of you; leaning out to fire, LEAN of you)
  if (posture === 'rise' && C.h >= 1.2) return (part === 'head' ? 0.3 : part === 'torso' ? 0.75 : 1) * wide;   // (up over it: the head, the shoulders and the top of the chest)
  const [lo, hi] = SPANS[posture === 'crouch' ? 'crouch' : 'stand'][part] ?? SPANS.stand.torso;
  return wide * clamp01((C.h - lo) / (hi - lo));
}

/**
 * The cover between a shot from `from` ({ x, z }) and someone at `to` ({ x, z, cover? }), for the part aimed at: { what,
 * word, share (of the part behind it), stop, keeps (share × stop: what of the rounds it keeps off) }, or null. On the street
 * the map's in; posture: how they stand (postureOf()).
 */
export function coverOf(state, from, to, part = 'torso', posture = 'stand') {
  if (state.map?.kind !== 'street' || !from || !to) return null;
  const dx = from.x - to.x, dz = from.z - to.z, d = Math.hypot(dx, dz);
  if (d < 1.2) return null;                                          // (at arm's length: nothing between)
  const ux = dx / d, uz = dz / d, town = townOf(state.map), row = state.map.row ?? 0, seen = new Set();
  let best = null;
  for (let s = 0.25; s <= Math.min(COVER_M, d - 1); s += 0.2) {
    const x = to.x + ux * s, z = to.z + uz * s, i = Math.floor(x / SECTION_M);
    for (const S of [sectionOf(town, row, i)]) for (const b of S.blockers) {
      if (seen.has(b) || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      seen.add(b);
      const C = COVER[b.what];
      if (!C || (b.x0 <= to.x && to.x <= b.x1 && b.z0 <= to.z && to.z <= b.z1)) continue;   // (one you're standing in isn't between)
      const across = Math.abs(ux) * (b.z1 - b.z0) + Math.abs(uz) * (b.x1 - b.x0), wide = clamp01(Math.min(across, C.w ?? Infinity) / BODY_W);
      const sh = share(C, wide, part, posture), keeps = sh * C.stop;
      if (sh <= 0 || (best && keeps <= best.keeps)) continue;
      const corner = b.what === 'building' && (Math.abs(to.x - b.x0) < 1.6 || Math.abs(to.x - b.x1) < 1.6);
      best = { what: b.what, word: corner ? 'the corner of the wall' : C.word, share: sh, stop: C.stop, keeps };
    }
  }
  return best;
}

/** A hit roll made at someone behind cover: where the round goes: null (on into them), or { stopped, word } (into the cover; through it, or not). */
export function into(state, r, from, to, part) {
  const C = coverOf(state, from, to, part, postureOf(state, to));
  if (!C || !chance(r, C.share)) return null;
  return { stopped: chance(r, C.stop), word: C.word, what: C.what };
}

/**
 * Where to get down behind cover from where `me` stands, against a threat at `from` ({ x, z }, or null: the nearest cover's
 * near side): { x, z, word, what, keeps } (the best kept off, crouched, nearest of the best), or null (nothing within HIDE_M).
 */
export function hideSpot(state, me, from, walkable = () => true) {
  if (state.map?.kind !== 'street') return null;
  const town = townOf(state.map), row = state.map.row ?? 0, i0 = Math.floor(me.x / SECTION_M), out = [];
  for (let i = i0 - 1; i <= i0 + 1; i++) for (const b of sectionOf(town, row, i).blockers) {
    const C = COVER[b.what];
    if (!C || C.stop < 0.3) continue;                                // (glass, a hedge, railings: nothing to get behind)
    const cx = Math.max(b.x0, Math.min(b.x1, me.x)), cz = Math.max(b.z0, Math.min(b.z1, me.z));
    if (Math.hypot(cx - me.x, cz - me.z) > HIDE_M) continue;
    // (its sides nearest you and its corners, a step out from it; a building only at its corners, where a lane or a court opens)
    const o = HIDE_OUT_M, pts = b.what === 'building'
      ? [[b.x0 - o, b.z1 - 0.6], [b.x1 + o, b.z1 - 0.6], [b.x0 - o, b.z1 - 1.4], [b.x1 + o, b.z1 - 1.4]]
      : [[cx, b.z0 - o], [cx, b.z1 + o], [b.x0 - o, cz], [b.x1 + o, cz], [b.x0 - o, b.z0 - o], [b.x1 + o, b.z0 - o], [b.x0 - o, b.z1 + o], [b.x1 + o, b.z1 + o]];
    for (const [x, z] of pts) {
      if (Math.hypot(x - me.x, z - me.z) > HIDE_M + 0.6 || !walkable(x, z)) continue;
      const k = from ? coverOf(state, from, { x, z }, 'torso', 'crouch') : { keeps: C.stop, word: C.word, what: b.what };
      if (!k || k.keeps <= 0) continue;
      out.push({ x, z, word: k.word, what: k.what, keeps: k.keeps, d: Math.hypot(x - me.x, z - me.z) });
    }
  }
  if (!out.length) return null;
  out.sort((p, q) => q.keeps - p.keeps || p.d - q.d);
  return out[0];
}
