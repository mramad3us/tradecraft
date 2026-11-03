// TRADECRAFT sim: the reflex (the user, 2026-11-03: "There should be a reflex mode, where time stops when things
// require it (hostile weapon spotted, the NPC we're tailing suddenly turning our way, someone trying to grab us or
// sucker punch us etc.) stuff that justify a sudden reaction").
//
// A moment that wants a sudden reaction, seen coming (the scene's roll: the tail's tell read, sim/scenarios/
// tail.js; an officer going for his gun, an Awareness check, sim/armed.js; a hand reaching for you, Awareness
// against their Deception, sim/scenarios/hunted.js), and time stops (state.reflex: sim/game.js stands still while
// it's there, as for a fight's choice): what can be done about it (offer()'s options: { key, label, do }), each
// taking its time once chosen, or nothing (NONE, and a card closed is nothing). What each `do` is, sim/game.js's
// (react()): 'cover:<act>' one of the street's covers (sim/acts.js: a shop window, the phone, a shoelace), 'draw'
// into shooting (sim/shooting.js readyGun()), 'drop' the gun at your feet, 'run' (RUN_S of a run, away), 'back'
// a step back out of reach (BACK_M), 'edge' meet it with an edge (the fight's opening yours), 'none'.
// A hand reaching for you (reach()): seen coming, a step back or a run makes it miss (the hand's owner can't
// grab for MISS_S: the scene checks missed()), meeting it is the fight with the first edge yours ('edge',
// sim/fight.js begin()'s adv), and each read after the first is harder (READ_AGAIN on their side).
// Reflexes are the played game's (state.$reflexes, set by src/main.js for every game it starts; state.$reflex,
// the moment, is runtime too: a save never holds a stopped clock): the scripted players of the balance tests
// don't answer a card.
import { opposed } from './checks.js';
import { skill } from './skills.js';
import { isGun } from './firearms.js';

export const RUN_S = 3, BACK_M = 1.6, MISS_S = 2, REACH_M = 2.2, READ_AGAIN = 4, READS_MAX = 3;
export const NONE = { key: 'none', label: 'Nothing: let it come', do: 'none' };

/** A moment seen coming: time stops, and the choice is the player's. Returns whether it was offered. */
export function offer(state, bus, { why, title, text = '', options, none = null, ...more }) {
  if (!state.$reflexes || state.$reflex || state.fight || state.shoot || state.talk) return false;
  state.$reflex = { why, title, text, options: [...options, none ? { ...NONE, label: none } : NONE], ms: state.time.ms, ...more };
  bus?.emit('reflex', state.$reflex);
  return true;
}

/** The choice made ('reflex:<key>'): the reflex over, and what it was to do (sim/game.js react()). */
export function chosen(state, key) {
  const R = state.$reflex;
  if (!R) return null;
  state.$reflex = null;
  return R.options.find(o => o.key === key) ?? NONE;
}

/**
 * `a` closing on you to grab (within REACH_M of their reach, `seen`: you're looking their way): your Awareness
 * against their Deception, harder each time; read, time stops. `fight`: { style, owner, line } for meeting it.
 * Returns whether the moment was offered (the scene holds the grab while it stands).
 */
export function reach(state, bus, me, a, { fight, seen, title = 'A hand, reaching for you' }) {
  const ai = a.ai, now = state.time.ms;
  if (!state.$reflexes || !seen || (ai.$reads ?? 0) >= READS_MAX || ai.$readAt > now - MISS_S * 1000) return false;
  const mine = state.people[me.who], them = state.people[a.who], n = ai.$reads ?? 0;
  ai.$readAt = now;
  const r = opposed(state.rng, { skill: 'awareness', value: skill(mine, 'awareness'), body: mine },
    { skill: 'deception', value: skill(them, 'deception') + n * READ_AGAIN, body: them });
  if (!r.ok) return false;
  ai.$reads = n + 1;
  const gun = isArmed(mine);
  return offer(state, bus, { why: 'grab', title, who: a.id, x: a.x, fight, options: [
    { key: 'back', label: 'Step back, out of reach', do: 'back' },
    { key: 'run', label: 'Run', do: 'run' },
    { key: 'edge', label: 'Meet it: get in first', do: 'edge' },
    ...(gun ? [{ key: 'draw', label: 'Your gun', do: 'draw' }] : []),
  ] });
}

/** Whether `a`'s grab has been made to miss (a step back, a run: MISS_S). */
export const missed = (state, a) => (a.ai?.$missUntil ?? 0) > state.time.ms;

/** Whether p has a gun on them, in the hand or carried (sim/firearms.js). */
export const isArmed = (p) => [p?.hand, ...(p?.items ?? [])].some(isGun);
