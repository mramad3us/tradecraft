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
//   1. The player's input becomes their velocity, gait and facing.
//   2. Everyone moves by their velocity, sliding along what blocks them (sim/world.js), in the
//      order they're listed.
//   3. The actor grid is rebuilt.
//   4. Everyone else thinks: the velocity they'll move by next tick (sim/crowd.js for passers-by).
//   5. The scenario's rules (its checks and events).
//   6. Once a second: the map's sections follow the focus, and the crowd is kept to its count.
//   7. The clock advances; an autosave is due every 30 game minutes ('autosave' on the bus).
import { seedRng } from './rng.js';
import { TICK_MS, MIN } from './clock.js';
import { SAVE_SCHEMA } from './state.js';
import { attach, refocus, rehash, move } from './world.js';
import { populate, think, walk, facing } from './crowd.js';
import { drift } from './people.js';
import { SCENARIOS } from './scenarios/index.js';

export const WALK_MS = 1.45;                                       // the player's walk, m/s
export const RUN_MS = 3.6;                                         // and run (which draws attention)
export const AUTOSAVE_MS = 30 * MIN;
const DT = TICK_MS / 1000;
const TICKS_PER_S = Math.round(1000 / TICK_MS);

/** A new game: a scenario (SCENARIOS) from a seed. Call start() before stepping it. */
export function newGame({ seed = 1, scenario = 'walk', version = '' } = {}) {
  const state = {
    game: 'tradecraft', schema: SAVE_SCHEMA, version, seed, rng: seedRng(seed), tick: 0, time: { ms: 0 },
    scenario: { kind: scenario }, country: 'ru', legend: null, player: null, focus: null,
    people: {}, map: null, actors: [], nextActor: 1, heat: {}, log: [], flags: {},
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

/** One tick. input: { mx, mz (−1 … 1, z toward the camera), run }. */
export function step(state, input = {}, bus) {
  const scenario = SCENARIOS[state.scenario.kind];
  // 1. The player.
  const me = playerActor(state);
  if (me && !me.ai) {
    let mx = input.mx ?? 0, mz = input.mz ?? 0;
    const n = Math.hypot(mx, mz);
    if (n > 1) { mx /= n; mz /= n; }
    const speed = input.run ? RUN_MS : WALK_MS;
    me.vx = mx * speed; me.vz = mz * speed;
    me.gait = n > 0.01 ? (input.run ? 'run' : 'walk') : 'idle';
    me.face = facing(me.vx, me.vz, me.face);
  }
  // 2. Everyone moves.
  for (const a of state.actors) {
    if (a.ai?.kind === 'walker') walk(state, a);
    else if (a.vx || a.vz) a.stride += move(state, a, a.vx * DT, a.vz * DT);
  }
  // 3. The grid. 4. Everyone else thinks.
  rehash(state);
  for (const a of state.actors) if (a.ai?.kind === 'walker') think(state, a);
  // 5. The scenario.
  scenario.tick?.(state, bus);
  // 6. The map and the crowd, once a second.
  if (state.tick % TICKS_PER_S === 0) {
    const f = focusActor(state);
    if (f) { refocus(state, bus, f.x); populate(state, f.x); }
  }
  // 7. The clock.
  const before = Math.floor(state.time.ms / AUTOSAVE_MS);
  state.time.ms += TICK_MS;
  state.tick++;
  if (Math.floor(state.time.ms / AUTOSAVE_MS) !== before) bus?.emit('autosave', 'clock');
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
