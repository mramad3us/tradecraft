// TRADECRAFT sim: fitness kept up, or let go (the user, 2026-11-03: "fitness should remain a skill, but there should be a
// shadow skill called effective fitness, that goes down the longer we go without exercising. Walking would be part of
// exercising … the amount of 'points' we put a week in working out … should bring the effective fitness up from base
// fitness up to three points before moving the actual fitness skill up one point, and the same should be true downward
// … The higher we go the harder it gets to exceed base fitness … to model real life fitness maintenance and the fact that
// high level athletes require more training than lambda joes trying to stay fit").
//
// **Base and effective.** The Fitness skill is the base (its base and practice: baseOf()); effective fitness is the base
// and an offset (p.fit.off, −BAND … capOf()), and it's the effective one the body uses: skills.js skill('fitness').
// **The week's load** (p.fit.load: Monday to Sunday, the calendar's): a session at the gym SESSION_PTS, a class on the mat
// CLASS_PTS (sim/shops.js), each kilometre walked WALK_PTS_KM and run RUN_PTS_KM (sim/game.js, once a second; in a
// plate carrier, a load carried, half as much again: sim/armour.js LOAD).
// **The week's end** (rollWeeks(): once a second, and after time skipped): its load against what the base asks:
// upNeed() or more, the offset up a point (to capOf()); under holdNeed(), down a point (to −BAND); between, held. Base 10
// asks 45 to go up (four sessions and some walking) and 22 to hold. At the top of the band two weeks running, the base
// itself up a point, the offset down one, so effective stays where it is (+3 becomes +2, to climb again); at its bottom
// two weeks running, the base down a point the same way. The higher the base, the more it asks (holdNeed() grows faster
// past 12), and the less room above it (capOf(): 3, then 2, 1 and none as the base nears FIT_MAX): at the top, effective
// is never above the base, and holding it takes a session nearly every day.
import { DAY } from './clock.js';
import { say } from './log.js';
import { loadOf } from './armour.js';

export const SESSION_PTS = 10, CLASS_PTS = 7, WALK_PTS_KM = 0.6, RUN_PTS_KM = 2.5;
export const BAND = 3, FIT_MAX = 24;
export const upNeed = (b) => 4.5 * b;
export const holdNeed = (b) => 2.2 * b + 2 * Math.max(0, b - 12);
export const capOf = (b) => Math.max(0, Math.min(BAND, FIT_MAX - b));
export const weekOf = (ms) => Math.floor((Math.floor(ms / DAY) + 3) / 7);   // (Monday to Sunday: day 0 a Thursday)

/** The Fitness skill, unmultiplied: its base and its practice. */
export const baseOf = (p) => (p?.skills?.fitness?.[0] ?? 0) + (p?.skills?.fitness?.[1] ?? 0);
/** The offset effective fitness is from the base (skills.js skill() adds it). */
export const offsetOf = (p) => p?.fit?.off ?? 0;
/** p's fitness record, begun this week if it wasn't. */
export function fitOf(p, ms) { return (p.fit ??= { off: 0, load: 0, week: weekOf(ms), last: 0 }); }

/** pts of exercise at game time ms (the week ended first, if it has). */
export function exercise(state, bus, p, pts, ms = state.time.ms) {
  if (!p || !(pts > 0)) return;
  rollWeeks(state, bus, p, ms);
  fitOf(p, ms).load += pts;
}
/** So many metres on foot, walked or run (in a plate carrier, a load carried: more, sim/armour.js LOAD). */
export const onFoot = (state, bus, p, walkM, runM) => exercise(state, bus, p, (walkM * WALK_PTS_KM + runM * RUN_PTS_KM) / 1000 * loadOf(p));

/** Every week ended since p's was last: its load weighed, the offset moved, the base too at a band's edge held two weeks. */
export function rollWeeks(state, bus, p, ms = state.time.ms) {
  if (!p?.skills) return;
  const f = fitOf(p, ms), now = weekOf(ms);
  while (f.week < now) { endWeek(state, bus, p, f); f.week++; f.load = 0; }
}

function endWeek(state, bus, p, f) {
  const b = baseOf(p), cap = capOf(b), was = f.off;
  if (f.load >= upNeed(b) && f.off < cap) f.off++;
  else if (f.load < holdNeed(b) && f.off > -BAND) f.off--;
  f.off = Math.min(f.off, cap);                                     // (a base risen near the top has less room above it)
  const s = (p.skills.fitness ??= [0, 0]), player = p.id === state.player;
  let note = null;
  if (cap > 0 && f.off === cap && f.last === cap) {                 // (the top held two weeks: the body's new normal)
    s[0]++; f.off--;
    note = `A month of it shows: your fitness is ${baseOf(p)} now, and you've some way still to go above it.`;
  } else if (f.off === -BAND && f.last === -BAND && baseOf(p) > 1) {   // (the bottom two weeks: what it was is gone)
    if (s[1] > 0) s[1]--; else s[0]--;
    f.off++;
    note = `Weeks without it: your fitness is down to ${baseOf(p)}.`;
  } else if (f.off !== was) note = f.off > was ? 'The week\'s training tells: you\'re fitter than you were.' : 'A week with too little of it: you\'re less fit than you were.';
  f.last = f.off;
  if (note && player) say(state, bus, { kind: 'note', text: note });
}

/** This week's load and what the base asks, for the sheet (src/ui/ui.js): { load, hold, up, off, cap, base }. */
export function weekWords(p, ms) {
  const f = fitOf(p, ms), b = baseOf(p);
  return { load: Math.round(f.load), hold: Math.round(holdNeed(b)), up: f.off < capOf(b) ? Math.round(upNeed(b)) : null, off: f.off, cap: capOf(b), base: b };
}
