// TRADECRAFT sim: what the tutorial's lessons (sim/tutorial/*.js) ask of a scene, in a word each.
import { rowOf } from '../agents.js';
import { inView } from '../perception.js';
import { lightBand } from '../light.js';
import { lightHere } from '../perception.js';
import { ASIDES } from '../hale.js';

export const me = (state) => state.actors.find(a => a.who === state.player);
export const actorId = (state, id) => (id ? state.actors.find(a => a.id === id) : null) ?? null;
export const actorWho = (state, who) => state.actors.find(a => a.who === who) ?? null;
/** How far apart two actors are (on different streets: Infinity). */
export const gap = (state, a, b) => (a && b && rowOf(state, a) === rowOf(state, b) ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
/** Seconds since the lesson began. */
export const secs = (state) => (state.time.ms - (state.scenario.began ?? state.time.ms)) / 1000;
export const sees = (state, a) => !!a && inView(state, a.id);
export const still = (a) => !!a && Math.hypot(a.vx, a.vz) < 0.2;
export const dark = (state, a) => !!a && lightBand(lightHere(state, a.x, a.z)) === 'dark';
/** People within r of actor a (passers-by and agents alike), a and the player aside. */
export const around = (state, a, r) => (a ? state.actors.filter(o => o !== a && o.who !== state.player && !o.hidden && Math.hypot(o.x - a.x, o.z - a.z) < r).length : 0);
/** Whether the player's doing something with a reason to it: a window, a bench, a kiosk, a phone box, a shelter, a café's table. */
export const busyAtSomething = (a) => !!a && (!!a.glass || ['bench', 'kiosk', 'phone', 'shelter', 'notices', 'lace', 'mobile', 'window', 'car'].includes(a.busy?.what) || a.inside?.way === 'sit');

/**
 * The first lesson's opening, as it's played: from the title, a first month at the station; booked in a campaign
 * (sim/campaign.js bookLessons()), the first days; for a legend (sim/campaign.js LEGENDS), Hale knows better than
 * to teach them, and asks for the evening anyway.
 */
export function opening(state) {
  const p = state.people?.[state.player];
  if (p?.legend) return 'Hale runs the station\'s training, and he asked for an evening of yours all the same, "to watch", he says: an earpiece in your ear, him on the radio from a car somewhere about.';
  return `Your first ${state.campaign ? 'days' : 'month'} at the station. Hale, who taught you hand to hand at the Farm, runs its training now, and tonight he runs you: an earpiece in your ear, him on the radio from a car somewhere about.`;
}

/** Hale's aside in a lesson (sim/hale.js ASIDES): once, after afterS seconds, when he's said nothing for twenty. */
export const aside = (id, afterS) => ({ id: 'aside', when: (s) => secs(s) >= afterS && !s.tutor?.queue.length && s.time.ms + (s.tutor?.waitMs ?? 0) - (s.tutor?.busyUntil ?? 0) > 20000, say: ASIDES[id] });   // (his lines' clock: sim/tutorial/earpiece.js clockOf())
