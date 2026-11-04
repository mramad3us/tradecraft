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
//   - otherwise up, a moment on a knee first (GET_UP_S, longer the worse they move, at most GET_UP_MAX_S), and away
//     from whoever shot them along their own pavement, as fast as the body lets them (AWAY_PACE × their walk ×
//     sim/health.js mobility(); a limp, a hobble; no running past canRun()): AWAY_M a leg, by the street's own
//     ways (sim/city.js routeFrom()), never off their street.
// Once they can't see the shooter any more (a look back over the shoulder: sim/perception.js sees(), so the dark and
// the distance hide them as a wall does, and someone who can see the shooter under a lamp thinks he's seen) and are
// AWAY_MIN_M along from where they got up; or after AWAY_S of it; or in shock from the blood lost: they make for the
// wall right there (wallSpot(): the building line on the far pavement, the boulevard's railing on the near one, the
// path's edge, the hedge on the south walk; never in a doorway or a lane's mouth), sit against it (gait 'slump': on
// the ground, drawn as a crouch is: src/render/crowd.js), and stay. A leg walked out still in the shooter's sight,
// they go on another. Moving bleeds them faster as it goes (sim/health.js exertion()).
// Hands on them (first aid: a busy plan on them, sim/aid.js), or help on its way for them (their call's police or
// ambulance past 'coming': the siren, sim/emergency.js), and they sit down where they are and wait. They're casualties
// all the while (sim/health.js casualty()): whoever sees them may call it in; and while nobody's yet on the way, a call
// that's about them alone keeps its place where they are (follow()), so the paramedics come to them, not to where they
// fell. Shot again, it starts over.
import { townOf } from './cities/index.js';
import { routeFrom, sectionOf, clearAt, LINE } from './city.js';
import { Z, SECTION_M, mouthOf } from './map/street.js';
import { eyes, sees, headOf } from './perception.js';
import { staysDown, canCrawl, bandOf, mobility } from './health.js';
import { TICK_MS } from './clock.js';

export const AWAY_M = 30, CRAWL_AWAY_M = 5, AWAY_MIN_M = 6, AWAY_S = 60, AWAY_PACE = 1.6, GET_UP_S = 2, GET_UP_MAX_S = 6;
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
  const ai = a.ai, H = ai.hurt, now = state.time.ms;
  if (state.tick % TPS === 0) follow(state, a);
  if (!body || (staysDown(body) && !canCrawl(body))) return still(a, 'down');   // (out cold, the chest gone: where they fell)
  if (H.sat) return still(a, 'slump');
  if (keptStill(state, a)) return sit(a, H);                       // (hands on them, a siren coming: they wait)
  const crawl = staysDown(body);
  if (!crawl) { H.up ??= now; if (now - H.up < getUpMs(body, now)) return still(a, 'crouch'); }   // (getting up: a moment on a knee)
  H.up ??= now;
  const R = ai.$route ?? ai.route, there = H.to && ((R && ai.s >= R.length - 1e-6) || Math.hypot(a.x - H.to.x, a.z - H.to.z) < 0.15);
  if (!H.to) { if (!plan(state, a, H, crawl ? CRAWL_AWAY_M : AWAY_M)) return sit(a, H); }
  else if (there) {
    // (a leg walked, and still in the shooter's sight, still in time: another; otherwise down against the wall)
    if (crawl || H.settle || now - H.up >= AWAY_S * 1000 || !seen(state, a, H) || !plan(state, a, H, AWAY_M)) return sit(a, H);
  } else if (!H.settle && state.tick % TPS === 0 && (now - H.up >= AWAY_S * 1000 || bandOf(body) === 'shock' || (Math.abs(a.x - H.x0) >= AWAY_MIN_M && !seen(state, a, H)))) {
    H.settle = true;                                              // (out of sight, enough of it, or too weak: the wall right here)
    if (!plan(state, a, H, 1)) return sit(a, H);
  }
  return false;
}

// (still, in a gait; sat, facing the way they sit)
function still(a, gait, face = null) {
  a.vx = a.vz = 0; a.gait = gait;
  if (face) { a.face = face; a.head = headOf(face); }
  return true;
}
function sit(a, H) {
  const W = WALL[lineNear(a.z)], wall = H.to && Math.hypot(a.x - H.to.x, a.z - H.to.z) < 0.4 ? H.to.face : Math.abs(a.z - W.z) < 0.4 ? W.face : null;
  Object.assign(H, { sat: true, to: null, face: wall ?? a.face });
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
function plan(state, a, H, alongM) {
  const seed = townOf(state.map), row = a.row ?? state.map.row ?? 0;
  if (H.dir === undefined) {
    const by = H.by && state.actors.find(o => o.id === H.by), sx = by && (by.row ?? state.map.row) === row ? by.x : H.x;
    H.dir = Math.sign(a.x - sx) || 1; H.x0 = a.x;
  }
  const to = wallSpot(seed, row, a.x + H.dir * alongM, lineNear(a.z), H.dir), from = { row, x: a.x, z: a.z };
  let route;
  try { route = routeFrom(seed, from, { row, x: to.x, z: to.z }); } catch { return false; }
  H.to = to;
  Object.assign(a.ai, { plan: { kind: 'way', from, to: { row, x: to.x, z: to.z } }, route: null, $route: route, s: 0, stop: 0, wait: 0, pace: AWAY_PACE, detour: null });
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
