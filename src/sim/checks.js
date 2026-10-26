// TRADECRAFT sim: checks, the one roll of the game (docs/DESIGN.md, Characters: skills and checks).
//
// A check is a d20 plus a skill's value plus modifiers, against a difficulty (DC). A natural 1
// always fails and a natural 20 always succeeds. A contested action is an opposed roll: both sides
// roll their skill, and the higher total wins.
//   - Natural results first: a natural 20 wins and a natural 1 loses, unless both sides rolled the
//     same natural, when the totals decide.
//   - Ties go to our side, the player's (my call).
//   - A hook spent halves the difficulty of a check, or the other side's total in an opposed roll
//     (rounded up).
// Modifiers are [{ why, v }]: their gauges toward us, a need, the environment (light from
// sim/light.js, the crowd, distance). Each is shown in the log by its why, so every number in a
// roll can be read. The result is plain data, stored in the log as is; checkText() is the one way
// it reads, wherever it's shown.
import { d20 } from './rng.js';
import { SKILLS } from './skills.js';

export const DC = { easy: 10, average: 15, hard: 20, veryHard: 25, expert: 30, elite: 40 };

const sumMods = (mods) => mods.reduce((a, m) => a + m.v, 0);
const halve = (x) => Math.ceil(x / 2);

/** One side's roll: { skill, value, roll, mods, total, nat }. */
function side(rng, { skill, value, mods = [] }) {
  const roll = d20(rng);
  return { skill, value, roll, mods, total: roll + value + sumMods(mods), nat: roll === 20 ? 20 : roll === 1 ? 1 : 0 };
}

/** A check: { skill (key), value (its value on the sheet), dc, mods, hook } → result. */
export function check(rng, { skill, value, dc, mods = [], hook = false }) {
  const s = side(rng, { skill, value, mods });
  const against = hook ? halve(dc) : dc;
  const ok = s.nat === 20 ? true : s.nat === 1 ? false : s.total >= against;
  return { kind: 'check', ...s, dc: against, hook, ok, margin: s.total - against };
}

/** An opposed roll: ours and theirs ({ skill, value, mods }) → result, ok when our side wins. */
export function opposed(rng, ours, theirs, { hook = false } = {}) {
  const a = side(rng, ours), b = side(rng, theirs);
  if (hook) { b.raw = b.total; b.total = halve(b.total); }
  let ok;
  if (a.nat && a.nat === b.nat) ok = a.total >= b.total;
  else if (a.nat === 20 || b.nat === 1) ok = true;
  else if (a.nat === 1 || b.nat === 20) ok = false;
  else ok = a.total >= b.total;
  return { kind: 'opposed', ours: a, theirs: b, hook, ok, margin: a.total - b.total };
}

const name = (key) => SKILLS[key]?.name ?? key;
const sum = (s) => [s.roll, s.value, ...s.mods.map(m => `${m.v < 0 ? '− ' + -m.v : m.v} (${m.why})`)].join(' + ').replace(/\+ − /g, '− ')
  + (s.raw !== undefined ? ` = ${s.raw}, halved by a hook to ${s.total}` : ` = ${s.total}`);
const natural = (n) => n === 20 ? ', a natural 20' : n === 1 ? ', a natural 1' : '';

/** The log's line for a roll: 'Deception check: 14 + 12 + 2 (night) = 28 against 15, success.' */
export function checkText(r) {
  if (r.kind === 'check') {
    return `${name(r.skill)} check: ${sum(r)} against ${r.dc}${r.hook ? ' (a hook spent)' : ''}${natural(r.nat)}, ${r.ok ? 'success' : 'failure'}.`;
  }
  return `${name(r.ours.skill)} against ${name(r.theirs.skill)}: ${sum(r.ours)}${natural(r.ours.nat)}, against ${sum(r.theirs)}${natural(r.theirs.nat)}. ${r.ok ? 'Ours' : 'Theirs'}.`;
}
