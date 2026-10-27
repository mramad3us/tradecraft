// TRADECRAFT sim: needs (DESIGN.md, Characters: "Needs are meters that cost check penalties (Q149):
// tired, hungry (every 6 h or so), stressed: it rises with danger and falls with sleep and leisure, and
// high stress brings mistakes"; the user, 2026-10-27: "hunger and stress needs"). The player's, kept on
// their sheet (p.needs: { ate, stress }); tired is the campaign's (sim/campaign.js fatigue()), hurt the
// body's (sim/health.js).
//   - **Hungry:** hours since you ate (p.needs.ate). HUNGRY_H on, −1 to everything; STARVING_H, −2. A
//     bite in a café, a bakery, a shawarma place (T at its door: sim/shops.js 'eat', EAT_S), a rest
//     (sim/aid.js), the campaign's days (lunch at the embassy, breakfast and dinner at home) feed you.
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
  if (h >= STARVING_H) out.push({ why: 'starving', v: -2 });
  else if (h >= HUNGRY_H) out.push({ why: 'hungry', v: -1 });
  if (s >= FRAYED && EDGY.includes(skill)) out.push({ why: 'frayed nerves', v: -2 });
  else if (s >= ON_EDGE && EDGY.includes(skill)) out.push({ why: 'on edge', v: -1 });
  return out;
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
  // (frayed: once a minute, the chance of a glance back you didn't decide on)
  if (n.stress >= FRAYED && state.map.kind === 'street' && !me.hidden && !state.fight && Math.floor(ms / 1000) % 60 === 0 && chance(stream('slip', state.seed, Math.floor(ms / MIN)), SLIP_CHANCE)) {
    state.slip = true;                                              // (next tick, a glance back, unmeant: sim/game.js, as if E were tapped)
    say(state, bus, { kind: 'note', text: 'Before you can stop yourself, you\'ve looked back over your shoulder.' });
  }
}

/** The needs in words, for the sheet and the instinct: { fed, stress } words, or null when fine. */
export function needsWords(p, ms) {
  const h = hoursFed(p, ms), s = stressOf(p);
  return {
    fed: h >= STARVING_H ? `starving (${Math.floor(h)} h since you ate)` : h >= HUNGRY_H ? `hungry (${Math.floor(h)} h)` : `fed (${Math.max(0, Math.floor(h))} h ago)`,
    stress: s >= FRAYED ? 'frayed' : s >= ON_EDGE ? 'on edge' : s >= 25 ? 'wary' : 'calm',
    hungry: h >= HUNGRY_H, edgy: s >= ON_EDGE,
  };
}
