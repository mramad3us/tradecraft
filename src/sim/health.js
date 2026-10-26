// TRADECRAFT sim: health, part by part (DESIGN.md, Health; the user, 2026-10-26: "health bodypart by
// bodypart").
//
// The body is six parts (PARTS): the head, the torso, the arms, the legs. Each takes damage in points
// (sheet.body: { part: points }, missing is unhurt) against what it can take: PARTS[part].takes, more
// with Fitness (× 1 + Fitness / FITNESS_K). How far through that it is reads as a state (stateOf()):
//   - unhurt;
//   - bruised: any damage at all;
//   - hurt: a third of what it takes;
//   - wounded: two thirds: serious, and it won't mend without care (Medicine);
//   - out: all of it. A broken arm or leg, the torso down, the head out cold.
// What it costs (mods()): modifiers to the checks the part is used in, shown in the log like any other
// (a hurt arm −1 to CQC and Weapon handling, wounded −3, broken: no grapple and −6 with a gun; a head
// hurt or worse dulls every check). The legs slow the walk (paceOf()).
// It mends by the day (heal()): bruises and hurts by HEAL_PER_DAY of what the part takes; a wound, or
// worse, only with care, which comes later.
import { skill } from './skills.js';

export const PARTS = {
  head: { name: 'Head', takes: 6 },
  torso: { name: 'Torso', takes: 12 },
  armL: { name: 'Left arm', takes: 8 },
  armR: { name: 'Right arm', takes: 8 },
  legL: { name: 'Left leg', takes: 9 },
  legR: { name: 'Right leg', takes: 9 },
};
export const FITNESS_K = 20;                                       // Fitness 10: half as much again
export const HEAL_PER_DAY = 0.2;
const OUT = { head: 'out cold', torso: 'down', armL: 'broken', armR: 'broken', legL: 'broken', legR: 'broken' };
export const STATES = ['unhurt', 'bruised', 'hurt', 'wounded', 'out'];

/** What a part of this person can take, in points. */
export const takes = (p, part) => PARTS[part].takes * (1 + skill(p, 'fitness') / FITNESS_K);

/** Damage on a part, in points. */
export const damageOf = (p, part) => p.body?.[part] ?? 0;

/** A part's state: 'unhurt' | 'bruised' | 'hurt' | 'wounded' | 'out'. */
export function stateOf(p, part) {
  const d = damageOf(p, part), f = d / takes(p, part);
  return d <= 0 ? 'unhurt' : f < 1 / 3 ? 'bruised' : f < 2 / 3 ? 'hurt' : f < 1 ? 'wounded' : 'out';
}

/** A part's state in words ('out' named for the part: broken, down, out cold). */
export const stateText = (p, part) => { const s = stateOf(p, part); return s === 'out' ? OUT[part] : s; };

/** Damage a part (points ≥ 0). Returns its state after. */
export function hurt(p, part, points) {
  p.body ??= {};
  p.body[part] = Math.round((damageOf(p, part) + Math.max(0, points)) * 10) / 10;
  return stateOf(p, part);
}

const ARMS = ['armL', 'armR'], LEGS = ['legL', 'legR'];
const level = (s) => STATES.indexOf(s);

/**
 * What this person's hurts cost a check of skill key: [{ why, v }]. The head dulls everything; the
 * torso and the legs, the body's work (CQC, Fitness); the arms, what's done with the hands.
 */
export function mods(p, key) {
  const out = [];
  const h = level(stateOf(p, 'head'));
  if (h >= 2) out.push({ why: h >= 3 ? 'dazed, a head wound' : 'a hurt head', v: h >= 3 ? -3 : -1 });
  if (key === 'cqc' || key === 'fitness') {
    const t = level(stateOf(p, 'torso'));
    if (t >= 2) out.push({ why: t >= 3 ? 'a torso wound' : 'hurt ribs', v: t >= 3 ? -3 : -1 });
    const l = Math.max(...LEGS.map(k => level(stateOf(p, k))));
    if (l >= 2) out.push({ why: l >= 4 ? 'a broken leg' : l >= 3 ? 'a wounded leg' : 'a hurt leg', v: l >= 4 ? -4 : l >= 3 ? -2 : -1 });
  }
  if (key === 'cqc' || key === 'weapons') {
    const a = Math.max(...ARMS.map(k => level(stateOf(p, k))));
    if (a >= 2) out.push({ why: a >= 4 ? 'a broken arm' : a >= 3 ? 'a wounded arm' : 'a hurt arm', v: a >= 4 ? (key === 'weapons' ? -6 : -4) : a >= 3 ? -3 : -1 });
  }
  return out;
}

/** Whether this person can grapple (two working arms) and stand (one working leg at least). */
export const canGrapple = (p) => ARMS.every(k => stateOf(p, k) !== 'out');
export const canStand = (p) => LEGS.some(k => stateOf(p, k) !== 'out') && stateOf(p, 'torso') !== 'out' && stateOf(p, 'head') !== 'out';

/** The walk's pace for these legs, × the usual: a wounded leg slows it, a broken one more. */
export function paceOf(p) {
  const l = Math.max(...LEGS.map(k => level(stateOf(p, k))));
  return l >= 4 ? 0.5 : l >= 3 ? 0.8 : 1;
}

/** Days pass: bruises and hurts mend; wounds wait for care. */
export function heal(p, days) {
  if (!p.body || !(days > 0)) return;
  for (const part in p.body) {
    if (level(stateOf(p, part)) >= 3) continue;
    p.body[part] = Math.max(0, Math.round((p.body[part] - HEAL_PER_DAY * takes(p, part) * days) * 10) / 10);
    if (!p.body[part]) delete p.body[part];
  }
}
