// TRADECRAFT sim: what we know of other people (DESIGN.md, Reading people; the user, 2026-10-26: "READ
// (which is read someone, display the guessed character sheet of someone else, analysis skill drives
// how good we are at it, as well as what we discovered about them").
//
// state.mind.known[who]: { reads, at, skills: { key: [lo, hi] }, cls, trained, fights: { won, lost } }:
// plain data, kept between encounters. read() is an Analysis check (DC READ_DC; worse in the dark, at
// a distance): what shows of someone is their build (Fitness), how they carry themselves (CQC), how
// they watch (Awareness), how they'd hold a gun (Weapon handling): READABLE. Each such skill gets a
// range that holds the truth, wider the worse the read (WIDTH by margin), not centred on it (a guess
// is a guess), and a new read narrows what's known (the ranges meet). A good read sees what they are
// (CLASS_AT: a civilian, police, a soldier, one of the trade), a very good one how well trained
// (TRAINED_AT). The rest of a sheet (Social, Analysis, Tech, Deception…) doesn't show at a glance: it
// takes talking, and watching, which come later. A fight tells bounds (fought()): beaten by someone,
// their CQC is near yours or over; beating them, it isn't far over yours.
import { skill, CLASSES } from './skills.js';
import { check } from './checks.js';
import { range } from './rng.js';
import { lightHere } from './perception.js';
import { lightBand } from './light.js';

export const READABLE = ['fitness', 'cqc', 'awareness', 'weapons'];
export const READ_DC = 12;
export const CLASS_AT = 4;
export const TRAINED_AT = 12;
/** A read's range half-width, by its margin (a failure: wide). */
export const WIDTH = (margin) => (margin < 0 ? 12 : Math.max(1, Math.round(8 - margin / 2.5)));

const known = (state, who) => (state.mind.known ??= {})[who] ??= { reads: 0, at: null, skills: {}, cls: null, trained: null, fights: { won: 0, lost: 0 } };

/** Read actor `them`: the Analysis check, and what it shows, kept. Returns { roll, k (what's known) }. */
export function read(state, me, them) {
  const r = state.rng, p = state.people[them.who], mine = state.people[state.player];
  const d = Math.hypot(them.x - me.x, them.z - me.z), light = lightBand(lightHere(state, them.x, them.z));
  const mods = [d > 6 && { why: 'at a distance', v: -2 }, light === 'dark' && { why: 'in the dark', v: -3 }, light === 'dim' && { why: 'in the dusk', v: -1 }].filter(Boolean);
  const roll = check(r, { skill: 'analysis', value: skill(mine, 'analysis'), body: mine, dc: READ_DC, mods });
  const k = known(state, them.who), w = WIDTH(roll.margin);
  for (const key of READABLE) {
    const v = skill(p, key), off = range(r, -w / 2, w / 2);
    const lo = Math.max(0, Math.round(v - w + off)), hi = Math.round(v + w + off);
    const now = [Math.min(lo, v), Math.max(hi, v)], was = k.skills[key];
    k.skills[key] = was ? [Math.max(was[0], now[0]), Math.min(was[1], now[1])] : now;
    if (k.skills[key][0] > k.skills[key][1]) k.skills[key] = now;   // (they can't not meet, but should two reads disagree, the new one stands)
  }
  if (roll.margin >= CLASS_AT) k.cls = p.cls;
  if (roll.margin >= TRAINED_AT) k.trained = (p.os ?? 0) < 15 ? 'little' : p.os < 40 ? 'some' : p.os < 70 ? 'much' : 'elite';
  k.reads++; k.at = state.time.ms;
  return { roll, k };
}

/** After a fight with them (won: whether we did): what it showed of their CQC. */
export function fought(state, who, won) {
  const k = known(state, who), ours = skill(state.people[state.player], 'cqc'), was = k.skills.cqc ?? [0, 46];
  if (won) { k.fights.won++; k.skills.cqc = [was[0], Math.max(was[0], Math.min(was[1], ours + 4))]; }
  else { k.fights.lost++; k.skills.cqc = [Math.min(was[1], Math.max(was[0], ours - 2)), was[1]]; }
}

/** What we know of them, for their sheet as we guess it. */
export const knownOf = (state, who) => state.mind.known?.[who] ?? null;

/** What they seem to be, in words. */
export const CLASS_WORDS = { civilian: 'a civilian', spook: 'one of the trade', soldier: 'a soldier', cop: 'police', criminal: 'a criminal' };
export const TRAINED_WORDS = { little: 'little trained', some: 'trained', much: 'well trained', elite: 'very well trained' };
export const classOf = (k) => (k?.cls ? `${CLASS_WORDS[k.cls] ?? CLASSES[k.cls]?.name ?? k.cls}${k.trained ? `, ${TRAINED_WORDS[k.trained]}` : ''}` : null);
