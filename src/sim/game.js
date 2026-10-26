// TRADECRAFT sim: a game, and its tick.
//
// newGame() makes the state of a new game (a scenario: the game itself later, a mechanic test or
// the free walk now); start() attaches the runtime world to a state, new or loaded; step() advances
// it one tick (TICK_MS). The sim is pure: no DOM, no clock of its own, no Math.random. It takes the
// player's input as data and reports what happens on the bus.
//
// skip() is time passing without ticks (an action that takes time; for now, debug mode's clock keys):
// the world gets outcomes for the gap, not a simulation of it.
//
// The tick, in this order (decisions made in a tick act the next):
//   1. The player's input becomes their velocity, gait and heading (where they face: the way they
//      walk, or, holding E, the way they look).
//   2. Everyone moves, in the order they're listed: the player (and a scenario's walkers) by their
//      velocity, sliding along what blocks them (sim/world.js); agents (passers-by among them) along
//      their routes, on any street (sim/agents.js). The focus through a way off the map (a side street's end, a lane south): the
//      next street is loaded (changeMap(), loadRow()), and the tick goes on there.
//   3. The actor grid is rebuilt, and the player looks: what they see is remembered
//      (sim/perception.js), and that's all the view will show of anyone else. Followers look for
//      their targets, and every ROUTE_EVERY ticks walk the trail anew.
//   4. Everyone else thinks: passers-by on the street mind the player (sim/crowd.js); the scenario's
//      own characters decide what they'll do next tick.
//   5. The scenario's rules (its checks and events).
//   6. Once a second: the map's sections follow the focus (and whatever else the scenario anchors),
//      and the crowd's bubble is kept round the focus: its street and the streets either side.
//   7. The clock advances; an autosave is due every 30 game minutes ('autosave' on the bus).
import { seedRng } from './rng.js';
import { TICK_MS, MIN } from './clock.js';
import { SAVE_SCHEMA } from './state.js';
import { attach, refocus, rehash, move, near, exitAt } from './world.js';
import { Z, placeName } from './map/street.js';
import { say } from './log.js';
import { populate, think, walk, facing, isPasserby, noticeAgent } from './crowd.js';
import { look, headOf, faceOf } from './perception.js';
import { isAgent, onMap, stepAgent, watchTarget, routeFollower, ROUTE_EVERY } from './agents.js';
import { drift } from './people.js';
import { glassAhead } from './acts.js';
import { SCENARIOS } from './scenarios/index.js';

export const WALK_MS = 1.45;                                       // the player's walk, m/s
export const STROLL_MS = 0.95;                                     // a stroll (Alt held): to keep a pace without stopping
export const RUN_MS = 3.6;                                         // and run (which draws attention)
export const LOOK_M = 50;                                          // the player looks at whoever's within this (sight's reach)
export const GLANCE_S = 1.2;                                       // a look over the shoulder (E tapped)
export const AUTOSAVE_MS = 30 * MIN;
const DT = TICK_MS / 1000;
const TICKS_PER_S = Math.round(1000 / TICK_MS);

/**
 * A new game: a scenario (SCENARIOS) from a seed. Call start() before stepping it. autoplay: the
 * player's character played by the game's own AI (an agent: sim/agents.js), with its options (as the
 * scenario reads them, e.g. { keep } for a follower); null, by hand.
 */
export function newGame({ seed = 1, scenario = 'walk', version = '', autoplay = null } = {}) {
  const state = {
    game: 'tradecraft', schema: SAVE_SCHEMA, version, seed, rng: seedRng(seed), tick: 0, time: { ms: 0 }, autoplay,
    scenario: { kind: scenario }, country: 'ru', legend: null, player: null, focus: null,
    people: {}, map: null, actors: [], nextActor: 1, heat: {}, log: [], flags: {}, mind: { seen: {} },
  };
  SCENARIOS[scenario].setup(state);
  return state;
}

/** Attach the runtime world (state.$world) to a state, new or loaded, and fill the street if it's new. */
export function start(state, bus) {
  const f = focusActor(state);
  attach(state, bus, f?.x ?? 0);
  rehash(state);
  if (!state.flags.populated) { populate(state, f?.x ?? 0, { fill: true }); state.flags.populated = true; rehash(state); }
  SCENARIOS[state.scenario.kind].attach?.(state, bus);
  return state;
}

export const actor = (state, id) => state.actors.find(a => a.id === id);
export const playerActor = (state) => state.actors.find(a => a.who === state.player);
export const focusActor = (state) => (state.focus && actor(state, state.focus)) || playerActor(state);

/**
 * One tick. input: { mx, mz (−1 … 1, z toward the camera), run, slow, look, act: [actions this
 * tick] }. run is Shift held, slow Alt (a stroll); look is E held: the player stands, and mx, mz turn
 * their eyes instead of their feet. Actions go to the scenario (T: 'instinct'); one may give the
 * player something to do (me.busy: a short plan of steps, such as stepping to a shop window to look
 * in it), which moving cancels. 'glance' (E tapped) is the game's own: for GLANCE_S the player's eyes
 * go back over their shoulder (me.glance, ticks left), walking on; the scenario hears of it too, for
 * whoever might see it done.
 */
export function step(state, input = {}, bus) {
  const scenario = SCENARIOS[state.scenario.kind];
  // 1. The player.
  const me = playerActor(state);
  for (const act of input.act ?? []) {
    if (act === 'glance' && me && !me.glance) me.glance = Math.round(GLANCE_S * TICKS_PER_S);
    scenario.act?.(state, bus, act);
  }
  if (me && !me.ai) {
    let mx = input.mx ?? 0, mz = input.mz ?? 0;
    const n = Math.hypot(mx, mz);
    if (n > 0.01 && !input.look) me.busy = null;
    me.looking = !!input.look && !me.busy;
    if (me.busy) busy(me);
    else if (input.look) {
      me.vx = me.vz = 0; me.gait = 'idle';
      if (n > 0.01) { me.head = Math.atan2(mz, mx); me.face = faceOf(me.head); }
    } else {
      if (n > 1) { mx /= n; mz /= n; }
      const speed = input.run ? RUN_MS : input.slow ? STROLL_MS : WALK_MS;
      me.vx = mx * speed; me.vz = mz * speed;
      me.gait = n > 0.01 ? (input.run ? 'run' : 'walk') : 'idle';
      if (n > 0.01) { me.head = Math.atan2(mz, mx); me.face = facing(me.vx, me.vz, me.face); }
    }
    // A glance back: the eyes over the shoulder, the feet going on; then the eyes come back.
    if (me.glance) {
      me.eyesOn ??= me.head;
      if (n > 0.01 || me.busy) me.eyesOn = me.head;
      me.head = me.eyesOn + Math.PI;
      if (--me.glance === 0) { me.head = me.eyesOn; me.eyesOn = undefined; }
    }
    // Stood at a shop's glass with the eyes into it: looking in the window (since when, for the
    // scenarios: a stop that began as someone looked is a stop they saw begin).
    const pane = !me.vx && !me.vz && glassAhead(state, me);
    me.glass = pane ? (me.glass?.x0 === pane.x0 ? me.glass : { ...pane, since: state.time.ms }) : false;
    if (me.glass) me.face = 'up';
  }
  // 2. Everyone moves; the focus may leave the map.
  for (const a of state.actors) {
    if (isAgent(a)) stepAgent(state, a, scenario, bus);
    else if (a.ai) walk(state, a);
    else if (a.vx || a.vz) a.stride += move(state, a, a.vx * DT, a.vz * DT);
  }
  const way = me && !me.ai && focusActor(state) === me && exitAt(state, me);
  if (way) changeMap(state, bus, way);
  const f = focusActor(state);
  if (f && isAgent(f) && f.row !== state.map.row) loadRow(state, bus, f.row, f.x);
  // 3. The grid, and the player looks; followers look for their targets. 4. Everyone else thinks.
  rehash(state);
  if (me && onMap(state, me)) look(state, me, near(state, me.x, me.z, LOOK_M));
  for (const a of state.actors) {
    if (!a.ai?.follow) continue;
    watchTarget(state, a);
    if ((state.tick + hashId(a.id)) % ROUTE_EVERY === 0) routeFollower(state, a);
  }
  for (const a of state.actors) {
    if (isPasserby(a)) { if (onMap(state, a)) noticeAgent(state, a); }
    else if (a.ai?.kind === 'walker') think(state, a);
    else if (a.ai) scenario.think?.(state, a, bus);
  }
  // 5. The scenario.
  scenario.tick?.(state, bus);
  // 6. The map and the crowd, once a second.
  if (state.tick % TICKS_PER_S === 0) {
    const f = focusActor(state);
    if (f) { refocus(state, bus, [f.x, ...(scenario.anchors?.(state) ?? [])]); populate(state, f.x); }
  }
  // 7. The clock.
  const before = Math.floor(state.time.ms / AUTOSAVE_MS);
  state.time.ms += TICK_MS;
  state.tick++;
  if (Math.floor(state.time.ms / AUTOSAVE_MS) !== before) bus?.emit('autosave', 'clock');
}

// The player's busy plan: ['go', x, z] (walk there; given up after a second without getting closer)
// and ['wait', ticks, face, gait].
function busy(me) {
  const b = me.busy, s = b.steps[0];
  if (!s) { me.busy = null; me.vx = me.vz = 0; me.gait = 'idle'; return; }
  if (s[0] === 'go') {
    const dx = s[1] - me.x, dz = s[2] - me.z, d = Math.hypot(dx, dz);
    b.best = Math.min(b.best ?? d, d);
    if (d < 0.1 || (b.wait++ > 20 && d > b.best - 0.05)) { b.steps.shift(); b.wait = 0; b.best = undefined; return busy(me); }
    me.vx = dx / d * WALK_MS; me.vz = dz / d * WALK_MS; me.gait = 'walk'; me.face = facing(me.vx, me.vz, me.face); me.head = Math.atan2(dz, dx);
    return;
  }
  me.vx = me.vz = 0; me.gait = s[3] ?? 'idle';
  if (s[2]) { me.face = s[2]; me.head = headOf(s[2]); }
  if (++b.wait >= s[1]) { b.steps.shift(); b.wait = 0; }
}

/** Let time pass without ticking (ms ≥ 0): the clock jumps, people's gauges drift, the crowd follows the hour. */
export function skip(state, bus, ms) {
  if (!(ms > 0)) return;
  const before = Math.floor(state.time.ms / AUTOSAVE_MS);
  state.time.ms += Math.round(ms / TICK_MS) * TICK_MS;
  for (const p of Object.values(state.people)) drift(p, state.time.ms);
  const f = focusActor(state);
  if (f) populate(state, f.x);
  rehash(state);
  if (Math.floor(state.time.ms / AUTOSAVE_MS) !== before) bus?.emit('autosave', 'skip');
}

/**
 * The player goes off the map through `way` (an exit of sim/map/street.js): the next street north or
 * south becomes the map. They arrive at the same way's other end (a row's north lanes are the next
 * row's south ones), facing on; the crowd is the new street's; the scenario keeps whom it carries
 * (carry(): the target who went this way first) and hears of it (mapChanged()). The memory of who was
 * where goes with the old street. An autosave, as on every map change.
 */
export function changeMap(state, bus, way) {
  const scenario = SCENARIOS[state.scenario.kind], me = playerActor(state);
  const from = state.map.row ?? 0, row = from + (way.dir === 'n' ? -1 : 1);
  const carried = scenario.carry?.(state, way) ?? [];
  me.x = Math.max(way.x0 + 0.5, Math.min(way.x1 - 0.5, me.x));
  me.z = way.dir === 'n' ? Z.edge - 1 : Z.north + 1;
  me.row = row;
  for (const id of carried) { const a = actor(state, id); if (a) a.row = row; }
  loadRow(state, bus, row, me.x, { way, from });
}

/**
 * Load another street as the map, round x: the passers-by of the last one go, agents stay (on
 * whatever street they're on), the memory of who was where goes with the old street, the crowd is
 * the new one's. The scenario hears of it (mapChanged), a line goes to the log, and an autosave.
 */
export function loadRow(state, bus, row, x, { way = null, from = state.map.row } = {}) {
  const scenario = SCENARIOS[state.scenario.kind], me = playerActor(state);
  bus?.emit('map-', state.map);
  state.map.row = row;
  state.map.inPlay = [];
  state.actors = state.actors.filter(a => a === me || isAgent(a) || (a.ai && a.ai.kind !== 'walker') || a.row === row);
  state.mind = { seen: {} };
  attach(state, bus, x);
  rehash(state);
  populate(state, x, { fill: true });
  rehash(state);
  scenario.mapChanged?.(state, bus, way, from);
  const f = focusActor(state), north = row < from;
  const lane = way?.name ?? placeName(state.map.seed, north ? from : row, f.x, north ? Z.front - 10 : Z.front - 10);
  say(state, bus, { kind: 'note', text: north ? `Up ${lane}, and out onto the far side of ${placeName(state.map.seed, row, f.x, Z.fence + 5)}.` : `Down ${lane}, toward ${placeName(state.map.seed, row, f.x, 0)}.` });
  bus?.emit('map', state.map);
  bus?.emit('autosave', 'map');
}

// (a small, stable number from an id, to spread followers' re-routing over the ticks)
const hashId = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); };
