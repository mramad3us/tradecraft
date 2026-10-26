// TRADECRAFT sim: perception. Where people look, what they see, and what the player remembers.
//
// Everyone on the map faces a heading (a.head, radians in the ground plane: 0 east, π/2 south toward
// the camera), set by where they walk and where they stop to look. What someone sees (eyes()):
//   - a cone ahead, CONE_DEG wide plus CONE_PER_AWARENESS for each point of Awareness, out to a range
//     set by the light at the spot looked at: SIGHT_M + LIGHT_M × lightLevel (sim/light.js, the one
//     number the dice read). By day the eye reaches 50 m; at night a man under a lamp is seen from
//     34 m, one in the dark between lamps from 22;
//   - all round, a radius of situational awareness, AWARE_M plus AWARE_PER for each point of
//     Awareness: the edge of the eye, footsteps, the sense of someone there;
//   - looking into a shop window (a.glass), the street behind in its glass: a cone of GLASS_DEG,
//     GLASS_K of the range.
// Buildings block the line of sight; people, cars and trees don't (the street is seen over and
// between them).
//
// visibility() is soft (0 … 1: the view dims by it); sees() is its threshold SEEN, what the rules
// read. The screen and the dice use the same function: what's dim on screen is what the character
// isn't aware of.
//
// The player's memory (state.mind.seen, by actor id): [x, z, face, gait, stride, ms, look key], how
// and where each was last seen; state.mind.at is the time of the last look. Looking is passive: every tick the player sees what their eyes take
// in, and the record is renewed. Out of sight, the view draws them as they were, frozen and dimmed;
// when their place is in view again and they aren't there, they're forgotten (and beyond FORGET_M).
import { lightLevel, sky } from './light.js';
import { skill } from './skills.js';

export const CONE_DEG = 100;
export const CONE_PER_AWARENESS = 2;
export const CONE_MAX_DEG = 170;
export const AWARE_M = 2.5;
export const AWARE_PER = 0.2;
export const SIGHT_M = 18;
export const LIGHT_M = 34;
export const GLASS_DEG = 170;
export const GLASS_K = 0.75;
export const SEEN = 0.5;
export const FORGET_M = 70;
export const CIVILIAN_AWARENESS = 4;                               // a passer-by's eyes, for scenes that need them

const TAU = Math.PI * 2;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

/** Headings of the four sprite facings. */
export const HEADS = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
export const headOf = (face) => HEADS[face] ?? 0;
/** The sprite facing nearest a heading. */
export function faceOf(head) {
  const a = wrap(head);
  if (Math.abs(a) <= Math.PI / 4 + 1e-9) return 'right';
  if (Math.abs(a) >= 3 * Math.PI / 4 - 1e-9) return 'left';
  return a > 0 ? 'down' : 'up';
}

/** Someone's eyes: { x, z, head, cone (half-angle), aware (m), glass }. */
export function eyes(state, a) {
  const sheet = a.who ? state.people[a.who] : null;
  const aw = sheet ? skill(sheet, 'awareness') : CIVILIAN_AWARENESS;
  return {
    x: a.x, z: a.z, head: a.head ?? headOf(a.face),
    cone: Math.min(CONE_MAX_DEG, CONE_DEG + CONE_PER_AWARENESS * aw) * Math.PI / 360,
    aware: AWARE_M + AWARE_PER * aw, glass: !!a.glass,
  };
}

/** The sky for this tick, kept so a tick's many looks share one sun (runtime only). */
export function skyNow(state) {
  const c = state.$sky;
  if (c && c.ms === state.time.ms) return c.s;
  const s = sky(state.time.ms);
  state.$sky = { ms: state.time.ms, s };
  return s;
}

/** How lit (x, z) is, as checks read it, this tick. */
export const lightHere = (state, x, z) => lightLevel(state.$world.lamps, x, z, state.time.ms, skyNow(state));

/**
 * How well eyes e take in (x, z), 0 … 1, line of sight not considered. light: the light level there
 * (lightHere()), when it's known.
 */
export function openness(state, e, x, z, light) {
  const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
  if (d < 1) return 1;
  let v = clamp01((e.aware + 0.75 - d) / 1.5);
  if (v >= 1) return 1;
  const range = SIGHT_M + LIGHT_M * (light ?? lightHere(state, x, z));
  const far = clamp01((range + 2 - d) / 4);
  if (far <= v) return v;
  const dir = Math.atan2(dz, dx);
  v = Math.max(v, far * clamp01((e.cone + 0.12 - Math.abs(wrap(dir - e.head))) / 0.24));
  if (e.glass) {
    const back = clamp01((range * GLASS_K + 2 - d) / 4) * clamp01((GLASS_DEG * Math.PI / 360 + 0.12 - Math.abs(wrap(dir - e.head - Math.PI))) / 0.24);
    v = Math.max(v, back);
  }
  return v;
}

/** Whether the segment from (x0, z0) to (x1, z1) passes through no building. */
export function lineClear(state, x0, z0, x1, z1, walls = state.$world.walls) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
  for (const w of walls) {
    if (w.x1 < ax || w.x0 > bx || w.z1 < az || w.z0 > bz) continue;
    if (crosses(x0, z0, x1, z1, w)) return false;
  }
  return true;
}

// Liang–Barsky: does the segment enter the rectangle (shrunk a hair, so a point on a wall's foot,
// where its face is drawn, still counts as seen)?
function crosses(x0, z0, x1, z1, w) {
  const e = 0.05, dx = x1 - x0, dz = z1 - z0;
  let t0 = 0, t1 = 1;
  const edges = [[-dx, x0 - (w.x0 + e)], [dx, (w.x1 - e) - x0], [-dz, z0 - (w.z0 + e)], [dz, (w.z1 - e) - z0]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}

/** How well eyes e see (x, z), 0 … 1, with the line of sight. */
export function visibility(state, e, x, z, light) {
  const v = openness(state, e, x, z, light);
  return v > 0 && !lineClear(state, e.x, e.z, x, z) ? 0 : v;
}

/** Whether eyes e see the spot (x, z): the rules' threshold of visibility(). */
export const sees = (state, e, x, z) => visibility(state, e, x, z) >= SEEN;

/** Whether actor a can see actor b (b's hidden indoors: no). */
export const seesActor = (state, a, b) => !b.hidden && sees(state, eyes(state, a), b.x, b.z);

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * The player looks (once a tick, after everyone's moved): every actor in view is remembered as they
 * are; memories of places now in view where nobody is are dropped, and those far off.
 */
export function look(state, me, nearby) {
  const mind = state.mind, ms = state.time.ms, e = eyes(state, me);
  mind.at = ms;
  for (const a of nearby) {
    if (a === me || a.hidden) continue;
    if (visibility(state, e, a.x, a.z) >= SEEN) mind.seen[a.id] = [r2(a.x), r2(a.z), a.face, a.gait, r2(a.stride), ms, a.who ?? a.seed];
  }
  for (const id in mind.seen) {
    const r = mind.seen[id];
    if (r[5] === ms) continue;
    if (Math.hypot(r[0] - me.x, r[1] - me.z) > FORGET_M || visibility(state, e, r[0], r[1]) >= SEEN) delete mind.seen[id];
  }
}

/** Whether the player saw actor id at their last look (this tick's). */
export const inView = (state, id) => state.mind.at !== undefined && state.mind.seen[id]?.[5] === state.mind.at;
