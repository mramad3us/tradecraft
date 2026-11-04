// TRADECRAFT sim: needs (DESIGN.md, Characters: "Needs are meters that cost check penalties (Q149):
// tired, hungry (every 6 h or so), stressed: it rises with danger and falls with sleep and leisure, and
// high stress brings mistakes"; the user, 2026-10-27: "hunger and stress needs"). The player's, kept on
// their sheet (p.needs: { ate, stress }); tired is the campaign's (sim/campaign.js fatigue()), hurt the
// body's (sim/health.js).
//   - **Hungry:** hours since you ate (p.needs.ate). HUNGRY_H on, −1 to everything; STARVING_H, −2. A
//     bite in a café, a bakery, a shawarma place (sim/shops.js 'eat', EAT_S), a rest (sim/aid.js), the
//     campaign's days (lunch at the embassy; at home, the kitchen table) feed you; sleep doesn't (soothe()).
//     Asleep, the hours go on: you wake as long from your last meal as it's been.
//     Past starving (the user, 2026-11-04: "there should be a limit to how hungry we get before we pass out and die or get
//     taken to a hospital"): WEAK_H, weak, −3 and no running (p.needs.weak); FAINT_H, faint spells, a chance an hour
//     (FAINT_P, more each day past it) of passing out where you stand for FAINT_MIN (p.faint: down, sim/health.js
//     canStand(); on a street, someone calls an ambulance, sim/emergency.js, and the hospital feeds you); DIE_H, dead.
//     A hospital's stay and a cell's end in a meal (sim/services.js discharged()).
//   - **Stress,** 0–100: up with danger (strain(): a fight begun, a wound, being seen by the man you're
//     following, a hunter who knows you, a watcher catching you at it), down by itself (CALM_PER_MIN a
//     minute; SIT_CALM_PER_MIN sitting on a bench, inside, at a table), and with a meal, a rest, a
//     night's sleep. ON_EDGE on: −1 to Deception, Social and Awareness; FRAYED: −2, and the mistakes
//     high stress brings: now and then (SLIP_CHANCE a minute) a glance back over the shoulder you
//     didn't mean to make (the scenes count it as one: sim/scenarios/sdr.js, tail.js).
// mods(p, skill) goes into every roll the player makes (sim/checks.js, with the body's).
import { HOUR, MIN } from './clock.js';
import { say } from './log.js';
import { chance, stream } from './rng.js';

export const HUNGRY_H = 6;
export const STARVING_H = 14;
export const WEAK_H = 48, FAINT_H = 72, DIE_H = 21 * 24, FAINT_P = 0.2, FAINT_MIN = [4, 12];
export const EAT_S = 120;
export const ON_EDGE = 50, FRAYED = 75;
export const CALM_PER_MIN = 0.5, SIT_CALM_PER_MIN = 2;
export const SLIP_CHANCE = 0.35;
const EDGY = ['deception', 'social', 'awareness'];

/** Hours since they ate (a sheet without needs yet: two hours, lunch not long ago). */
export const hoursFed = (p, ms) => (ms - (p.needs?.ate ?? ms - 2 * HOUR)) / HOUR;
export const stressOf = (p) => p.needs?.stress ?? 0;

/** What the needs cost a roll of this skill: [{ why, v }]. */
export function mods(p, skill) {
  if (!p?.needs) return [];
  const out = [], h = (p.needs.ms ?? 0) && hoursFed(p, p.needs.ms), s = stressOf(p);
  if (p.needs.weak) out.push({ why: 'weak from hunger', v: -3 });   // (the campaign's: starve())
  else if (h >= STARVING_H) out.push({ why: 'starving', v: -2 });
  else if (h >= HUNGRY_H) out.push({ why: 'hungry', v: -1 });
  if (s >= FRAYED && EDGY.includes(skill)) out.push({ why: 'frayed nerves', v: -2 });
  else if (s >= ON_EDGE && EDGY.includes(skill)) out.push({ why: 'on edge', v: -1 });
  return out;
}

/**
 * Calmer, not fed: a night's sleep (the user, 2026-10-28: "when sleeping, the hunger meter is frozen":
 * a night used to end in breakfast, so you always woke fed; now you wake as many hours from your last
 * meal as there were, and the kitchen's there for it).
 */
export function soothe(p, calm) {
  const n = (p.needs ??= { stress: 0 });
  n.stress = Math.max(0, (n.stress ?? 0) - calm);
}

/** Fed, now. */
export function eat(p, ms, calm = 5) {
  const n = (p.needs ??= { stress: 0 });
  n.ate = ms; n.ms = ms;
  n.stress = Math.max(0, (n.stress ?? 0) - calm);
}

/** Danger: stress up by v (and the log says so when it crosses a line). */
export function strain(state, bus, v) {
  const p = state.people[state.player];
  if (!p || p.dead) return;
  const n = (p.needs ??= { stress: 0, ate: state.time.ms - 2 * HOUR }), was = n.stress ?? 0;
  n.stress = Math.min(100, was + v);
  n.ms = state.time.ms;
  if (was < FRAYED && n.stress >= FRAYED) say(state, bus, { kind: 'note', text: 'Your hands want something to do, and your eyes keep going over your shoulder. Frayed: it shows.' });
  else if (was < ON_EDGE && n.stress >= ON_EDGE) say(state, bus, { kind: 'note', text: 'Your heart\'s going faster than the walk needs. On edge.' });
}

/** Once a second: the clock on hunger, the calm coming back, and the slips frayed nerves make. */
export function needsTick(state, bus, me) {
  const p = state.people[state.player];
  if (!p || p.dead || !me) return;
  const n = (p.needs ??= { stress: 0, ate: state.time.ms - 2 * HOUR }), ms = state.time.ms;
  n.ms = ms;
  const sitting = me.hidden || me.busy?.what === 'bench' || me.gait === 'sit';
  n.stress = Math.max(0, (n.stress ?? 0) - (sitting ? SIT_CALM_PER_MIN : CALM_PER_MIN) / 60);
  const h = hoursFed(p, ms);
  if (h >= HUNGRY_H && !n.toldHungry) { n.toldHungry = true; say(state, bus, { kind: 'note', text: 'Your stomach reminds you it\'s been a while: hungry.' }); }
  if (h < HUNGRY_H) n.toldHungry = false;
  starve(state, bus, p, n, h, ms);
  // (frayed: once a minute, the chance of a glance back you didn't decide on)
  if (n.stress >= FRAYED && state.map.kind === 'street' && !me.hidden && !state.fight && Math.floor(ms / 1000) % 60 === 0 && chance(stream('slip', state.seed, Math.floor(ms / MIN)), SLIP_CHANCE)) {
    state.slip = true;                                              // (next tick, a glance back, unmeant: sim/game.js, as if E were tapped)
    say(state, bus, { kind: 'note', text: 'Before you can stop yourself, you\'ve looked back over your shoulder.' });
  }
}

// Past starving: weak, then faint spells, then dead (the header's). The campaign's: a life's hours, not a scene's (a memory
// years on, a lesson) whose clock jumps with nobody fed.
function starve(state, bus, p, n, h, ms) {
  if (!state.campaign) { delete n.weak; delete p.faint; return; }
  if (p.faint && ms >= p.faint.until) { delete p.faint; say(state, bus, { kind: 'note', text: 'The ground, close and cold, and then the sky. You\'ve fainted. You get up slowly, and the street tilts.' }); }
  const weak = h >= WEAK_H;
  if (weak && !n.weak) say(state, bus, { kind: 'note', text: 'Two days without food: your legs are someone else\'s, and your hands shake. Weak: you couldn\'t run if you had to.' });
  n.weak = weak || undefined;
  if (h >= DIE_H) {
    p.dead ??= { ms, why: 'starvation' };                           // (sim/health.js kill()'s, without its import)
    say(state, bus, { kind: 'note', text: 'Three weeks without food. The body stops asking, and then it stops.' });
    if (!state.scenario.outcome) { Object.assign(state.scenario, { outcome: 'dead', ended: ms }); bus?.emit('scenario-end', 'dead'); }
    return;
  }
  if (h < FAINT_H || p.faint || Math.floor(ms / 1000) % 3600 !== 0) return;
  // (once an hour, a chance of passing out, more each day past it)
  const days = (h - FAINT_H) / 24, r = stream('faint', state.seed, Math.floor(ms / HOUR));
  if (!chance(r, Math.min(0.9, FAINT_P * (1 + days)))) return;
  const min = FAINT_MIN[0] + (FAINT_MIN[1] - FAINT_MIN[0]) * Math.min(1, days / 7);
  p.faint = { at: ms, until: ms + Math.round(min * MIN) };
  say(state, bus, { kind: 'note', text: 'The edges of everything go grey, and then there\'s nothing under your feet.' });
}

/** The needs in words, for the sheet and the instinct: { fed, stress } words, or null when fine. */
export function needsWords(p, ms) {
  const h = hoursFed(p, ms), s = stressOf(p);
  return {
    fed: p.needs?.weak && h >= FAINT_H ? `fainting from hunger (${Math.floor(h / 24)} days since you ate)` : p.needs?.weak ? `weak from hunger (${Math.floor(h)} h since you ate)` : h >= STARVING_H ? `starving (${Math.floor(h)} h since you ate)` : h >= HUNGRY_H ? `hungry (${Math.floor(h)} h)` : `fed (${Math.max(0, Math.floor(h))} h ago)`,
    stress: s >= FRAYED ? 'frayed' : s >= ON_EDGE ? 'on edge' : s >= 25 ? 'wary' : 'calm',
    hungry: h >= HUNGRY_H, edgy: s >= ON_EDGE,
  };
}
