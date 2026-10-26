// TRADECRAFT sim: close combat, hand to hand (DESIGN.md, CQC; the dojo, sim/scenarios/dojo.js).
//
// A fight is a run of exchanges, a second each, and time stands still until you choose (the design's):
// K hit, L grapple, M guard (MOVES). Guard beats hit, hit beats grapple, grapple beats guard:
//   - a guard against a hit: blocked, and the guard earns an advantage point;
//   - a hit against a grapple: it lands clean on someone coming in open (CLEAN_K the damage, and
//     more often the head);
//   - a grapple against a guard: a throw, onto the back (THROW_PTS to the torso);
//   - the same move both ways: an opposed CQC roll, ties to us. Two hits: the winner's lands. Two
//     grapples: the winner throws. Two guards: nothing; they circle.
// A hit lands on a part (HIT_AT) for HIT_PTS, and EDGE_PER_PT more for each point of CQC the hitter
// has over the other; damage goes on the body (sim/health.js), and what it hurts costs that fighter's
// CQC from the next exchange on, shown in the rolls.
// **Advantage points** (the design's): one for each hit guarded, held up to one per 10 CQC (at least
// one). One is spent with a move (Shift held), and only if it does something: with a hit, the hit
// does double if it lands; with a grapple, a hit taken does nothing; with a guard, a grapple is
// fended off (no throw).
// **The intent read** (the design's): a better fighter may see what the other is about to do:
// READ_PER_PT a point of CQC over theirs, at most READ_MAX. Ours, before we choose: their choice is
// made first and shown over them, so what's read is what comes; otherwise a '?'. Theirs, as we move:
// they answer our move with what beats it. Only the better of two reads at all, so neither read
// undoes the other.
// **Their choice** (choose()): their style's mix (STYLES), and the better they fight, the more they
// play against what you lean on: they keep count of your last moves (SEEN_MOVES) and, ADAPT_PER_CQC a
// point of CQC (at most ADAPT_MAX), pick what beats the move you've made most. A scripted fight (a
// drill: f.script) takes its moves in turn, and may show them (f.tell).
// **The end.** A bout (sparring: f.bout) pulls its blows (BOUT_K the damage; a drill's f.pull, less)
// and is scored, a hit a point and a throw two, first to f.to; it's stopped sooner if a head or a
// torso is wounded (f.stop). A real fight ends when someone can't go on: out cold, down, or unable to
// stand (sim/health.js).
import { skill } from './skills.js';
import { opposed } from './checks.js';
import { int, chance, weighted } from './rng.js';
import { hurt, stateOf, mods as hurtMods, canGrapple, canStand } from './health.js';

export const MOVES = ['hit', 'grapple', 'guard'];
export const BEATS = { guard: 'hit', hit: 'grapple', grapple: 'guard' };   // each beats the one it names
const BEATEN_BY = { hit: 'guard', grapple: 'hit', guard: 'grapple' };
export const HIT_PTS = [2, 5];
export const EDGE_PER_PT = 5;                                      // a point more damage for each 5 of CQC over
export const CLEAN_K = 1.5;
export const THROW_PTS = [3, 5];
export const BOUT_K = 0.5;
export const ADV_PER_CQC = 10;
export const READ_PER_PT = 0.06;
export const READ_MAX = 0.9;
export const SEEN_MOVES = 4;
export const ADAPT_PER_CQC = 0.02;
export const ADAPT_MAX = 0.7;
export const HIT_AT = { head: 30, torso: 45, armL: 8, armR: 8, legL: 4.5, legR: 4.5 };
export const STYLES = {
  even: { hit: 1, grapple: 1, guard: 1 },
  striker: { hit: 1.8, grapple: 0.6, guard: 1 },
  wrestler: { hit: 0.7, grapple: 1.8, guard: 0.8 },
  careful: { hit: 0.8, grapple: 0.8, guard: 1.6 },
};

const other = (s) => (s === 'a' ? 'b' : 'a');
export const cqcOf = (state, who) => skill(state.people[who], 'cqc');
export const advMax = (state, who) => Math.max(1, Math.floor(cqcOf(state, who) / ADV_PER_CQC));

/**
 * A fight between a (us) and b (people's ids). opts: { bout, to, style (theirs), script, tell, pull
 * (the damage done, × : a bout's BOUT_K), stop (a bout's: stopped when a head or torso is wounded) }.
 * Returns the fight (state.fight), its first exchange prepared.
 */
export function startFight(state, a, b, { bout = false, to = 3, style = 'even', script = null, tell = false, pull = bout ? BOUT_K : 1, stop = bout } = {}) {
  const f = state.fight = { a, b, bout, to, style, script, tell, pull, stop, round: 0, adv: { a: 0, b: 0 }, score: { a: 0, b: 0 }, seen: [], theirs: null, read: false, last: null, ended: null, phase: 'choose' };
  prepare(state, f);
  return f;
}

/** The chance a fights b's intent: READ_PER_PT a point of CQC over theirs. */
export const readChance = (state, a, b) => Math.min(READ_MAX, Math.max(0, cqcOf(state, a) - cqcOf(state, b)) * READ_PER_PT);

/** The next exchange: their move (and whether they'll spend a point), and whether we read it. */
export function prepare(state, f) {
  const r = state.rng;
  const move = f.script ? f.script[f.round % f.script.length] : choose(state, f);
  const spend = f.adv.b > 0 && !f.script && chance(r, move === 'hit' ? 0.5 : 0.25);
  f.theirs = { move, spend };
  f.read = f.tell || chance(r, readChance(state, f.a, f.b));
}

/** Their choice: their style's mix, turned against what we lean on the better they fight. */
export function choose(state, f) {
  const r = state.rng, me = state.people[f.b];
  const allowed = (m) => m !== 'grapple' || canGrapple(me);
  const adapt = Math.min(ADAPT_MAX, cqcOf(state, f.b) * ADAPT_PER_CQC);
  if (f.seen.length >= 2 && chance(r, adapt)) {
    const counts = MOVES.map(m => [m, f.seen.filter(x => x === m).length]).sort((p, q) => q[1] - p[1]);
    const counter = BEATEN_BY[counts[0][0]];
    if (allowed(counter)) return counter;
  }
  const mix = STYLES[f.style] ?? STYLES.even;
  return weighted(r, MOVES.filter(allowed).map(m => [m, mix[m]]));
}

/** Where a hit lands (clean: the head more often). */
function partHit(r, clean) {
  return weighted(r, Object.entries(HIT_AT).map(([k, w]) => [k, k === 'head' && clean ? w * 1.5 : w]));
}

/**
 * Our move ({ move, spend }) against theirs: the exchange, resolved. Returns what happened, for the
 * log and the picture: { ours, theirs, kind ('blocked' | 'landed' | 'thrown' | 'circle' | 'fended' |
 * 'absorbed'), by ('a' | 'b' | null: who came out on top), part, dmg, roll, spent: { a, b }, gained }.
 */
export function resolve(state, f, ours) {
  const r = state.rng, A = state.people[f.a], B = state.people[f.b];
  const moves = { a: ours.move === 'grapple' && !canGrapple(A) ? 'guard' : ours.move, b: f.theirs.move };
  // (the better one, if it's them, may see ours coming and answer it)
  const answer = BEATEN_BY[moves.a];
  if (!f.script && (answer !== 'grapple' || canGrapple(B)) && chance(r, readChance(state, f.b, f.a))) { moves.b = answer; f.theirs.read = true; }
  const wants = { a: !!ours.spend && f.adv.a > 0, b: !!f.theirs.spend && f.adv.b > 0 };
  const out = { round: f.round, ours: moves.a, theirs: moves.b, kind: 'circle', by: null, part: null, dmg: 0, roll: null, spent: { a: false, b: false }, gained: null, read: f.read };
  // Who comes out on top: the triangle, or, the same move both ways, the dice.
  let by = null;
  if (moves.a !== moves.b) by = BEATS[moves.a] === moves.b ? 'a' : 'b';
  else if (moves.a !== 'guard') {
    const roll = opposed(r, { skill: 'cqc', value: cqcOf(state, f.a), mods: hurtMods(A, 'cqc') }, { skill: 'cqc', value: cqcOf(state, f.b), mods: hurtMods(B, 'cqc') });
    out.roll = roll;
    by = roll.ok ? 'a' : 'b';
  }
  out.by = by;
  if (by) {
    const win = moves[by], lose = moves[other(by)], w = by, l = other(by);
    const W = by === 'a' ? f.a : f.b, L = by === 'a' ? f.b : f.a;
    if (win === 'guard') {                                          // a hit, guarded
      out.kind = 'blocked';
      if (f.adv[w] < advMax(state, W)) { f.adv[w]++; out.gained = w; }
    } else if (win === 'grapple') {                                 // a throw (a guard, or the other's grapple, beaten)
      if (lose === 'guard' && wants[l]) { f.adv[l]--; out.spent[l] = true; out.kind = 'fended'; }
      else {
        out.kind = 'thrown'; out.part = 'torso';
        out.dmg = damage(state, f, int(r, THROW_PTS[1] - THROW_PTS[0] + 1) + THROW_PTS[0], W, L);
      }
    } else {                                                        // a hit lands (on a grapple, or the other's hit beaten)
      const clean = lose === 'grapple';
      out.part = partHit(r, clean);
      if (lose === 'grapple' && wants[l]) { f.adv[l]--; out.spent[l] = true; out.kind = 'absorbed'; }
      else {
        let pts = int(r, HIT_PTS[1] - HIT_PTS[0] + 1) + HIT_PTS[0];
        if (clean) pts *= CLEAN_K;
        if (wants[w]) { f.adv[w]--; out.spent[w] = true; pts *= 2; }
        out.kind = 'landed';
        out.dmg = damage(state, f, pts, W, L);
      }
    }
    if (out.dmg) {
      hurt(state.people[L], out.part, out.dmg);
      if (f.bout) f.score[w] += out.kind === 'thrown' ? 2 : 1;
    }
  }
  f.seen.push(moves.a); if (f.seen.length > SEEN_MOVES) f.seen.shift();
  f.last = out;
  f.round++;
  f.ended = ended(state, f);
  if (!f.ended) prepare(state, f);
  return out;
}

/** Damage done: the edge the winner has, a bout's pulled blows. */
function damage(state, f, pts, W, L) {
  const edge = Math.max(0, cqcOf(state, W) - cqcOf(state, L)) / EDGE_PER_PT;
  return Math.round((pts + edge) * f.pull * 10) / 10;
}

/** Over? { by: 'a' | 'b' (who won), why ('points' | 'stopped' | 'out cold' | 'down' | 'can't stand') } or null. */
export function ended(state, f) {
  for (const s of ['a', 'b']) {
    const p = state.people[s === 'a' ? f.a : f.b];
    const why = stateOf(p, 'head') === 'out' ? 'out cold' : stateOf(p, 'torso') === 'out' ? 'down' : !canStand(p) ? 'can\'t stand' : null;
    if (why) return { by: other(s), why };
    if (f.stop && ['head', 'torso'].some(k => stateOf(p, k) === 'wounded')) return { by: other(s), why: 'stopped' };
  }
  if (f.bout) for (const s of ['a', 'b']) if (f.score[s] >= f.to) return { by: s, why: 'points' };
  return null;
}
