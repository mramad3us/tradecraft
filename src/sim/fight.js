// TRADECRAFT sim: a fight as the game runs it, wherever it happens: the dojo's drills and bouts, a brawl
// on the street (sim/interact.js). The rules are sim/cqc.js, the picture sim/cqcshow.js, the words
// sim/cqctext.js.
//
// begin(state, bus, them, opts) puts the player against actor `them`, each on a mark (where they
// stand, FIGHT_GAP_M apart, facing), with cqc.startFight's options; and holds the opponent's own feet
// (ai.fighting) while it lasts. Each move (K L M; Shift spends an edge) is an exchange (act()): it's
// resolved, told in the log, and played out (tick(): the timeline, then the next choice, which time
// waits for: sim/game.js). Dazed, there's no choice: it comes at you. The scene that owns the fight
// hears of each exchange and of the end (scenario.onExchange(state, bus, out), onFightEnd(state, bus,
// f)); without one (a brawl), the end is the engine's (sim/interact.js afterFight()).
// While a fight is on, the player's feet are the fight's: the move keys do nothing.
import { startFight, resolve, allowed, MOVES } from './cqc.js';
import { exchangeText } from './cqctext.js';
import { animate, length } from './cqcshow.js';
import { say } from './log.js';
import { headOf } from './perception.js';

export const FIGHT_GAP_M = 1.5;
/** Owners of fights that aren't a scene's: their hooks, by name (sim/interact.js registers 'street'). */
export const owners = {};
const hooksOf = (f, scene) => (!f.owner ? null : owners[f.owner] ?? scene);

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const actorOfWho = (state, who) => state.actors.find(a => a.who === who);
/** What the log calls them: a family name, or how they look. */
export const shortName = (state, who) => {
  const p = state.people[who];
  if (who === 'hale') return 'Hale';
  return p?.known === false ? p.seen ?? 'they' : p?.name?.split(' ').slice(-1)[0] ?? 'they';
};

/**
 * The player against actor `them` (a person on the map, who: a sheet in state.people). opts: cqc's
 * (bout, to, style, script, tell, pull, stop), and marks ({ a, b }: where each stands; by default
 * where they are, a pace apart along the street, facing). Returns the fight.
 */
export function begin(state, bus, them, opts = {}) {
  const me = playerOf(state);
  const f = startFight(state, state.player, them.who, opts);
  if (opts.adv) f.adv.a = opts.adv;
  const dir = them.x >= me.x ? 1 : -1;
  f.marks = opts.marks ?? { a: { x: me.x, z: me.z }, b: { x: me.x + dir * FIGHT_GAP_M, z: me.z } };
  f.flip = dir < 0;                                                 // (they're west of us: we face west)
  f.owner = opts.owner ?? null;
  f.phase = 'choose';
  me.busy = null; me.glass = false;
  if (them.ai) them.ai.fighting = true;
  return f;
}

/** A move of ours (K, L, M; '+' spends an edge): an exchange, when the fight's waiting for one. scene: the scenario. */
export function act(state, bus, action, scene) {
  const f = state.fight, move = String(action).replace('+', '');
  if (!f || !MOVES.includes(move) || f.phase !== 'choose' || f.status?.a === 'stunned') return false;
  if (!allowed(f.status?.a, move)) return true;                     // (staggered, no grab; dazed, no cover: the key does nothing)
  exchange(state, bus, { move, spend: action.endsWith('+') }, scene);
  return true;
}

/** An exchange: resolved, told, and set going (its owner, the scene, told of it). */
export function exchange(state, bus, ours, scene) {
  const f = state.fight;
  const out = resolve(state, f, ours);
  say(state, bus, { kind: out.roll ? 'roll' : 'note', roll: out.roll ?? undefined, text: exchangeText(out, shortName(state, f.b), state.people[f.b], state.map.seed) });
  f.phase = 'show';
  f.shown = state.tick;
  f.until = state.tick + length(state, f, out);
  hooksOf(f, scene)?.onExchange?.(state, bus, out);
  return out;
}

/** Each tick: the exchange played out; then the next choice, or the end. */
export function tick(state, bus, scene) {
  const f = state.fight;
  if (!f) return;
  if (f.phase === 'show' && state.tick >= f.until) {
    if (f.ended) return end(state, bus, scene);
    f.phase = 'choose';
    if (f.status.a === 'stunned') exchange(state, bus, { move: 'open' }, scene);
  }
  const sides = { a: playerOf(state), b: actorOfWho(state, f.b) };
  animate(state, f, sides);
  if (f.flip) for (const s of ['a', 'b']) if (sides[s]) { sides[s].face = sides[s].face === 'right' ? 'left' : 'right'; sides[s].head = headOf(sides[s].face); sides[s].x = 2 * f.marks[s].x - sides[s].x; }
}

function end(state, bus, scene) {
  const f = state.fight;
  state.fight = null;
  const them = actorOfWho(state, f.b), me = playerOf(state);
  if (me) me.gait = 'idle';
  if (them) { them.gait = them.gait === 'down' ? 'down' : 'idle'; if (them.ai) them.ai.fighting = false; }
  hooksOf(f, scene)?.onFightEnd?.(state, bus, f);
  bus?.emit('fight-end', f);
  return f;
}
