// TRADECRAFT sim: what the player can do on a street with T, whatever the scene: the instinct offers
// it (a scenario's instinct, or the free walk's), act() does it.
//   - 'window': step to a shop window and look in it (its glass shows the street behind:
//     sim/perception.js), a reason to stop;
//   - 'bench': sit on a bench on the boulevard's path, until you move;
//   - 'lace': stop to tie a shoelace (not again within LACE_AGAIN_S: twice is a story);
//   - 'cross': over the street at its zebra, or over the boulevard's far road at its own.
// Each becomes the player's busy plan (sim/game.js busy()), which moving cancels; busy.since is when
// it began (a scenario may care whether that was before or after someone looked).
// Also here, the bits of the street they read: where the crossings are, and a calm way to pick a line
// of the instinct's without touching the dice.
import { TICK_MS } from './clock.js';
import { hash } from './rng.js';
import { LANES, Z } from './map/street.js';
import { sectionAt } from './world.js';
import { say } from './log.js';

export const LACE_AGAIN_S = 40;
const TPS = 1000 / TICK_MS;

export const laneMid = (lane) => (LANES[lane][0] + LANES[lane][1]) / 2;

/** A line from a few, the same for a while (no dice: the instinct mustn't move the game's rolls). */
export const say1 = (state, id, lines) => lines[hash(id, Math.floor(state.time.ms / 12000)) % lines.length];

/** The zebra over the street the actor stands in line with, if any. */
export const crossingAt = (state, a) => sectionAt(state, a.x)?.crossings.find(c => a.x > c.x0 - 0.5 && a.x < c.x1 + 0.5) ?? null;

/** A crossing within m of the actor, by the side of the road they're on: { c, road: 'main' | 'far' }. */
export function crossingNear(state, a, m = 6) {
  const S = sectionAt(state, a.x);
  if (!S) return null;
  const close = (c) => Math.abs((c.x0 + c.x1) / 2 - a.x) < m;
  if (a.z < Z.fence + 0.5) { const c = S.crossings.find(close); return c ? { c, road: 'main' } : null; }
  if (S.band === 'boulevard' && a.z > Z.pathS - 0.5) { const c = S.crossingsS.find(close); return c ? { c, road: 'far' } : null; }
  return null;
}

/** The nearest bench seat within reach of the actor on the path, or null. */
export function benchNear(state, a) {
  if (a.z < 11.8 || a.z > 16) return null;
  const seats = (sectionAt(state, a.x)?.props ?? []).filter(p => p.kind === 'bench').flatMap(p => p.seats);
  const s = seats.map(x => [x, Math.abs(x - a.x)]).sort((p, q) => p[1] - q[1])[0];
  return s && s[1] < 2.6 ? s[0] : null;
}

/** What gives the actor a reason to stop here: 'window' (a shop's glass at hand), 'bench' (a seat), 'lace', or null. */
export function coverHere(state, a) {
  const S = sectionAt(state, a.x);
  if (!S) return null;
  if (a.z < LANES.far[1] + 0.4 && a.z > Z.front && S.doors.some(d => d.kind === 'shop' && Math.abs(d.x - a.x) < 3.2)) return 'window';
  if (benchNear(state, a) !== null) return 'bench';
  return state.time.ms - (state.scenario.laceMs ?? -1e12) > LACE_AGAIN_S * 1000 ? 'lace' : null;
}

/** Do it: the player's busy plan for act. */
export function act(state, bus, me, what) {
  act1(state, bus, me, what);
  if (me.busy) me.busy.since = state.time.ms;
}

function act1(state, bus, me, what) {
  if (what === 'window') {
    const S = sectionAt(state, me.x), door = S.doors.filter(d => d.kind === 'shop').sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
    const wx = Math.abs(me.x - door.x) < 0.9 ? door.x + (me.x < door.x ? -1.4 : 1.4) : me.x;   // beside the door, at the glass
    me.busy = { what: 'window', steps: [['go', wx, -4.35], ['wait', 5 * TPS, 'up', 'idle']], wait: 0 };
    say(state, bus, { kind: 'instinct', text: 'You find something in a shop window worth a look. In the glass, the street behind you.' });
  } else if (what === 'bench') {
    const sx = benchNear(state, me);
    me.busy = { what: 'bench', steps: [['go', sx, 13.3], ['go', sx, 12.96], ['wait', 3600 * TPS, 'down', 'sit']], wait: 0 };
    say(state, bus, { kind: 'instinct', text: 'You sit, as people do on a boulevard. Moving gets you up.' });
  } else if (what === 'lace') {
    state.scenario.laceMs = state.time.ms;
    me.busy = { what: 'lace', steps: [['wait', 3 * TPS, me.face, 'crouch']], wait: 0 };
    say(state, bus, { kind: 'instinct', text: 'You stop to tie a shoelace that didn\'t need it.' });
  } else if (what === 'cross') {
    const near = crossingNear(state, me, 7);
    if (!near) return;
    const { c, road } = near, cx = Math.max(c.x0 + 0.5, Math.min(c.x1 - 0.5, me.x));
    if (road === 'main') {
      const far = me.z < Z.kerbN;
      me.busy = { what: 'cross', steps: [['go', cx, far ? -1.0 : 7.5], ['go', cx, far ? laneMid('near') : laneMid('far')]], wait: 0 };
    } else {
      const north = me.z < Z.roadN;
      me.busy = { what: 'cross', steps: [['go', cx, north ? Z.fenceS - 0.6 : Z.roadS + 0.6], ['go', cx, north ? laneMid('south') : laneMid('path')]], wait: 0 };
    }
  }
}
