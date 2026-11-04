// TRADECRAFT sim: the wounded, after the shot (the user, 2026-11-04: "being knocked down is a logical result of
// getting shot. Staying down should be justified (pain level, shot in legs, blood loss, loss of consciousness).
// Otherwise people will try to get away from us even very slowly, and take a sit against a wall where they think we
// can't see them after a while. Moving away should increase blood loss if realistic").
//
// A passer-by a bullet goes into (sim/shooting.js bullet()) goes down for the knock of it (sim/health.js knockS():
// seconds to a couple of minutes, by the wound, the pain and the blood) and is marked hurt (shot(): ai.hurt, who shot
// them and from where; wherever they were going, forgotten). Past the knock, their tick is here first (step(), from
// sim/agents.js stepAgent()), and it's the body's say:
//   - out cold, or the chest gone (sim/health.js staysDown(), and not canCrawl()): they lie where they fell;
//   - the legs gone, awake: they crawl, CRAWL_AWAY_M along and to the wall (on their back, pushing with the arms,
//     drawn lying: gait 'down', moving, at sim/health.js crawlMs());
//   - otherwise up, a moment on a knee first (GET_UP_S, longer the worse they move, at most GET_UP_MAX_S), and then what
//     the wounds do to them decides, each second (choose(); the user, 2026-11-04: "wounds should have effects (pain,
//     blood loss, shock, dizziness) and these effects should trigger reactions like sitting down when dizzy and feeling
//     safe rather than running away. If we're still there with a gun out, they would run for their lives"; sim/health.js
//     woundsNow(): the pain as felt, adrenaline's share off it; what they can bear, by Fitness; the blood lost):
//       - in shock, or far past what they can bear: down where they are, lying;
//       - past what they can bear: against the wall right there (SIT_WALL_M at most: wallSpot()), or down;
//       - whoever shot them still in their sight with a gun out (danger(): within DANGER_M): away for their lives, along
//         their pavement, as fast as the body lets them (FLEE_PACE × their walk × mobility(); no running past canRun()),
//         the fear keeping the adrenaline up (sim/health.js surge()), and running bleeding them the faster;
//       - hands on them, or help on its way: sat where they are, waiting;
//       - dizzy (pale from the blood lost, a blow to the head), and safe: sat at the wall right there;
//       - none of it, and whoever shot them still in their sight: walking away from it, LEG_M at a time, at a walk;
//       - out of his sight (they're safe, as far as they can tell): stood where they are, on the phone for help, till
//         the blood lost or the pain sits them down.
//     The legs gone, awake: crawling, to the wall, CRAWL_AWAY_M. Sat, they stay sat unless the danger's back and they can
//     still go; down, they stay down. A leg walked, another the same way.
// Hands on them (first aid: a busy plan on them, sim/aid.js), or help on its way for them (their call's police or
// ambulance past 'coming': the siren, sim/emergency.js), and they sit down where they are and wait. They're casualties
// all the while (sim/health.js casualty()): whoever sees them may call it in; and while nobody's yet on the way, a call
// that's about them alone keeps its place where they are (follow()), so the paramedics come to them, not to where they
// fell. Shot again, it starts over.
import { townOf } from './cities/index.js';
import { routeFrom, sectionOf, clearAt, LINE } from './city.js';
import { Z, SECTION_M, mouthOf } from './map/street.js';
import { eyes, sees, headOf } from './perception.js';
import { staysDown, canCrawl, mobility, woundsNow, surge } from './health.js';
import { isGun } from './firearms.js';
import { TICK_MS } from './clock.js';

export const LEG_M = 25, CRAWL_AWAY_M = 5, SIT_WALL_M = 3, DANGER_M = 40, FLEE_PACE = 2.4, WALK_PACE = 1, GET_UP_S = 2, GET_UP_MAX_S = 6, STUCK_S = 3;
const TPS = 1000 / TICK_MS;
// (each pavement's wall, the z its middle comes to sitting against it, and the way they face sat there)
export const WALL = { F: { z: Z.front + 0.3, face: 'down' }, N: { z: Z.fence - 0.3, face: 'up' }, P: { z: Z.pathS - 0.3, face: 'up' }, S: { z: Z.south - 0.3, face: 'up' } };
// (the line nearest z: off the pavement, on the road, the nearer one's)
const lineNear = (z) => Object.keys(LINE).reduce((b, k) => (Math.abs(LINE[k] - z) < Math.abs(LINE[b] - z) ? k : b), 'F');

/** Shot (sim/shooting.js bullet(), a passer-by): hurt, by whom and from where; whatever they were at, and wherever they were going, dropped. */
export function shot(state, a, from) {
  const ai = a.ai;
  if (!ai) return;
  ai.hurt = { by: from?.id ?? null, x: from?.x ?? a.x, z: from?.z ?? a.z, ms: state.time.ms };
  if (ai.waiting || ai.visit) { a.glass = false; a.wide = false; a.hidden = false; }
  Object.assign(ai, { plan: null, route: null, $route: null, s: 0, stop: 0, wait: 0, waiting: null, visit: null, sit: false, detour: null, eyesOn: false });
}

/** Whether a hurt agent's walking its route as a crawl (the legs gone): sim/agents.js, its pace and its gait. */
export const crawling = (a, body) => !!a.ai?.hurt && !!body && staysDown(body);

/**
 * A hurt agent's tick past the knock (sim/agents.js stepAgent()). True if it was had here (lying, getting up, sat,
 * kept still); false, and it walks its route as any agent does (the getaway, or a crawl: crawling()).
 */
export function step(state, a, body) {
  const ai = a.ai, H = ai.hurt, now = state.time.ms, second = state.tick % TPS === 0;
  if (second) follow(state, a);
  if (!body || (staysDown(body) && !canCrawl(body))) return still(a, 'down');   // (out cold, the chest gone: where they fell)
  const crawl = staysDown(body);
  if (second || !H.mode) choose(state, a, body, H, now, crawl);
  if (H.mode === 'lie') return still(a, 'down');
  if (H.mode === 'sat') return still(a, 'slump', H.face);
  if (H.mode === 'wait') return sit(a, H);
  if (H.mode === 'stand') { Object.assign(ai, { route: null, $route: null }); H.to = null; return still(a, 'phone'); }   // (out of his sight: stood there, on the phone for help)
  if (!crawl) { H.up ??= now; if (now - H.up < getUpMs(body, now)) return still(a, 'crouch'); }   // (getting up: a moment on a knee)
  H.up ??= now;
  const R = ai.$route ?? ai.route, there = H.to && ((R && ai.s >= R.length - 1e-6) || Math.hypot(a.x - H.to.x, a.z - H.to.z) < 0.15);
  // (stuck, someone stood in the way or the way shut: STUCK_S of no headway, and they sit where they are, or try another way)
  if (second && H.to && !there) { H.stuck = Math.abs((ai.s ?? 0) - (H.lastS ?? -1)) < 0.05 ? (H.stuck ?? 0) + 1 : 0; H.lastS = ai.s ?? 0; }
  if ((H.stuck ?? 0) >= STUCK_S) { H.stuck = 0; if (H.mode === 'sit' || H.mode === 'crawl' || H.tried) return sit(a, H); H.tried = true; H.to = null; }
  if (H.mode === 'sit') {                                          // (to the wall right there, and down against it)
    if (!H.to && !plan(state, a, H, 0, SIT_WALL_M)) return sit(a, H);
    return there ? sit(a, H) : false;
  }
  // (flee, walk, crawl: a leg along their pavement, away from it; another when it's walked, or the pace changes)
  if (!H.to || there || H.leg !== H.mode) { if (!plan(state, a, H, crawl ? CRAWL_AWAY_M : LEG_M)) return sit(a, H); }
  return false;
}

/** What they do now, by what the wounds do to them and whether whoever shot them is still there with a gun (the header). */
function choose(state, a, body, H, now, crawl) {
  const fx = woundsNow(body, now), threat = danger(state, a, H);
  if (threat) surge(body, now);                                    // (afraid for their life: the adrenaline kept up)
  // (safe: he can't see them, as far as they can tell; there, not dizzy, not past it: they stop and call for help)
  const m = fx.floored ? 'lie' : fx.over ? 'sit' : threat ? 'flee' : keptStill(state, a) ? 'wait' : fx.dizzy || (crawl && H.leg === 'crawl') ? 'sit' : crawl ? 'crawl' : seen(state, a, H) ? 'walk' : 'stand';
  H.fx = { pain: Math.round(fx.pain), limit: fx.limit, dizzy: fx.dizzy, shock: fx.shock };   // (for a look, and the tests)
  if (H.mode === 'lie') return;                                    // (down, they stay down)
  if (H.mode === 'sat' && !(m === 'flee' && !crawl) && m !== 'lie') return;   // (sat, unless the danger's back and they can go)
  if (m === H.mode || (H.mode === 'sit' && m === 'wait')) return;
  if (m === 'lie') { Object.assign(a.ai, { plan: null, route: null, $route: null, s: 0 }); H.to = null; }
  H.mode = m; H.to = null;
}

/** Whether whoever shot them is still there and dangerous to them: in their sight, within DANGER_M, a gun in his hand. */
function danger(state, a, H) {
  const by = H.by && state.actors.find(o => o.id === H.by), q = by && state.people[by.who];
  return !!by && !!q && !q.dead && isGun(q.hand) && Math.hypot(by.x - a.x, by.z - a.z) < DANGER_M && seen(state, a, H);
}

// (still, in a gait; sat, facing the way they sit)
function still(a, gait, face = null) {
  a.vx = a.vz = 0; a.gait = gait;
  if (face) { a.face = face; a.head = headOf(face); }
  return true;
}
function sit(a, H) {
  const W = WALL[lineNear(a.z)], wall = H.to && Math.hypot(a.x - H.to.x, a.z - H.to.z) < 0.4 ? H.to.face : Math.abs(a.z - W.z) < 0.4 ? W.face : null;
  Object.assign(H, { sat: true, mode: 'sat', to: null, face: wall ?? a.face });
  Object.assign(a.ai, { plan: null, route: null, $route: null, s: 0 });
  return still(a, 'slump', H.face);
}
const getUpMs = (body, ms) => Math.min(GET_UP_MAX_S, GET_UP_S / Math.max(1 / 3, mobility(body, ms))) * 1000;

/** Whether someone's hands are on them (first aid), or help's on its way for them (their call's police or ambulance past 'coming'). */
function keptStill(state, a) {
  return state.actors.some(o => o.busy?.on === a.id) || (state.calls ?? []).some(c => !c.done && c.who.includes(a.id) && (c.police?.stage !== 'coming' || c.ambulance?.stage !== 'coming'));
}

/** A call about them alone, nobody yet on the way: its place where they are now (the caller's still on the line, telling them). */
function follow(state, a) {
  for (const c of state.calls ?? []) if (!c.done && c.who.length === 1 && c.who[0] === a.id && c.police?.stage === 'coming' && c.ambulance?.stage === 'coming' && c.row === (a.row ?? state.map.row)) { c.x = a.x; c.z = a.z; }
}

/** Whether they can see whoever shot them, looking back over the shoulder (so, they think, he can see them). Off the street in play, or him gone: no. */
function seen(state, a, H) {
  const row = a.row ?? state.map.row, by = H.by && state.actors.find(o => o.id === H.by);
  if (!by || by.hidden || (by.row ?? state.map.row) !== row || row !== state.map.row || !state.$world) return false;
  const e = eyes(state, a);
  e.head = Math.atan2(by.z - a.z, by.x - a.x); e.glass = null;
  return sees(state, e, by.x, by.z);
}

/**
 * The way on (their plan: sim/agents.js PLANNERS 'way', so it's planned again on load): alongM along their pavement,
 * away from the shooter (the way set once, from where he is as they get up), and to the wall there. False: no way.
 */
function plan(state, a, H, alongM, nearM = Infinity) {
  const seed = townOf(state.map), row = a.row ?? state.map.row ?? 0;
  const by = H.by && state.actors.find(o => o.id === H.by), sx = by && (by.row ?? state.map.row) === row ? by.x : H.x;
  if (H.dir === undefined || H.mode === 'flee') { H.dir = Math.sign(a.x - sx) || H.dir || 1; H.x0 ??= a.x; }   // (away from him: where he is now, if they're running from him)
  const to = wallSpot(seed, row, a.x + H.dir * alongM, lineNear(a.z), H.dir), from = { row, x: a.x, z: a.z };
  if (Math.abs(to.x - a.x) > Math.max(alongM, 0) + nearM) return false;   // (no wall near enough: sat, or down, where they are)
  let route;
  try { route = routeFrom(seed, from, { row, x: to.x, z: to.z }); } catch { return false; }
  H.to = to; H.leg = H.mode;
  Object.assign(a.ai, { plan: { kind: 'way', from, to: { row, x: to.x, z: to.z } }, route: null, $route: route, s: 0, stop: 0, wait: 0, pace: H.mode === 'flee' ? FLEE_PACE : WALK_PACE, detour: null });
  return true;
}

/**
 * Where to sit, at or past x0 (going dir) on a row by a line's pavement: against its wall, as far back from the line
 * as it's clear all the way (a step, a bin, the railing's post keep them off it), not in a doorway, not in a lane's
 * mouth: { row, x, z, face }. Nowhere within a dozen metres: on the line itself.
 */
export function wallSpot(seed, row, x0, line, dir = 1) {
  const W = WALL[line], lz = LINE[line], dz = Math.sign(W.z - lz);
  for (let k = 0; k < 16; k++) {
    const x = x0 + dir * k * 0.75, i = Math.floor(x / SECTION_M), S = [i - 1, i, i + 1].map(j => sectionOf(seed, row, j));
    if (line === 'F' && S.some(s => s.doors.some(d => d.z === Z.front && Math.abs(d.x - x) < 1.4) || s.gapsN.some(g => { const m = mouthOf(g); return x > m.x0 - 0.8 && x < m.x1 + 0.8; }))) continue;
    if (line === 'S' && S.some(s => s.gapsS.some(g => x > g.x0 - 0.8 && x < g.x1 + 0.8))) continue;
    let z = lz;
    while (dz * (W.z - (z + dz * 0.1)) >= -1e-9 && clearAt(seed, row, x, z + dz * 0.1, 0.3)) z += dz * 0.1;
    if (Math.abs(z - lz) > 0.6) return { row, x, z: Math.round(z * 100) / 100, face: W.face };
  }
  return { row, x: x0, z: lz, face: null };
}
