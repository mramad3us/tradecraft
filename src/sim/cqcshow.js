// TRADECRAFT sim: an exchange as it looks (sim/cqc.js resolve()): a timeline in ticks from when it was
// resolved, for each fighter a pose (the gait the view draws) and how far from their mark, toward the
// other. Pure sim: the state holds it, the view draws it, and a save in the middle plays on the same.
//
// Quick, and it lands (the user, 2026-10-26: "animations should be sped up and have more impact";
// "take CQC level into account for the animations"):
//   - the level sets the pace (pace()): a beginner winds up long and strikes slow, an expert's blow
//     is a flick, out and back; a technique's own wind-up (TECHNIQUES[].wind) on top;
//   - a blow lands on its strike's first tick, and everything holds there HITSTOP ticks (the beat
//     where you feel it); the one struck is knocked back (KNOCK_M, more for a heavier blow), reels,
//     then staggers or stands dazed if it left them so; a cover gives a little;
//   - a throw puts them down, DOWN_M back from their mark, and they get up through a kneel onto it;
//   - two covers: a shuffle in and out, watching.
// animate() sets both fighters' gaits and places each tick of the show; length() is how long it runs;
// f.impact is the moment of the blow (tick, who, how hard), for the view's shake; a blow that drew blood
// flings it then, the way it went, onto the floor (sim/blood.js).
import { TECHNIQUES } from './cqc.js';
import { skill } from './skills.js';
import { spatter } from './blood.js';

export const HITSTOP = 3;
export const RIPOSTE_T = 2;
export const KNOCK_M = [0.35, 0.85];
export const DOWN_M = 0.7;
const LUNGE_M = { hit: 0.42, grapple: 0.5 };
const LUNGE = { kick: 0.15, highkick: 0.08, lowkick: 0.2, knee: 0.55, elbow: 0.5, swing: 0.5 };

const techOf = (move, id) => TECHNIQUES[move]?.find(t => t.id === id);

/** A fighter's pace by CQC: { wind (extra ticks to wind up), strike, recover } (ticks). */
export function pace(cqc) {
  if (cqc < 8) return { wind: 3, strike: 4, recover: 4 };
  if (cqc < 15) return { wind: 1, strike: 3, recover: 3 };
  if (cqc < 25) return { wind: 0, strike: 2, recover: 2 };
  return { wind: -1, strike: 2, recover: 2 };
}

/** The timeline of one exchange: for each side its phases, the impact tick (before the hold), and the length. */
export function plan(state, f, out) {
  const P = { a: pace(skill(state.people[f.a], 'cqc')), b: pace(skill(state.people[f.b], 'cqc')) };
  const side = (s) => {
    const move = s === 'a' ? out.ours : out.theirs, t = techOf(move, out.tech[s]);
    const acts = move === 'hit' || move === 'grapple';
    const wind = acts ? Math.max(1, (t?.wind ?? 1) + P[s].wind) : 0;
    return { move, t, acts, wind, strike: P[s].strike, recover: P[s].recover };
  };
  const A = side('a'), B = side('b');
  const w = out.by, hitter = w && (w === 'a' ? A : B);
  // The moment: the winner's blow (or grip) arriving; a cover's, when the blow it stops arrives.
  const attacker = hitter?.acts ? hitter : (w === 'a' ? B : A);
  const impact = attacker?.acts ? attacker.wind : (A.acts ? A.wind : B.acts ? B.wind : 2);
  const ends = [A, B].map(x => (x.acts ? x.wind + x.strike + x.recover : 0));
  const struck = w && out.kind !== 'circle' && out.kind !== 'fended' && out.kind !== 'blocked' && out.kind !== 'absorbed' ? (w === 'a' ? 'b' : 'a') : null;
  // (a riposte: the cover meets the blow, then hits back RIPOSTE_T later: that's the impact)
  if (out.kind === 'riposte') return { A, B, impact: impact + RIPOSTE_T, covered: impact, struck, length: impact + RIPOSTE_T + 6 + HITSTOP + 1 };
  let tail = 3;
  if (struck) tail = out.kind === 'thrown' ? 1 + 6 + 4 : out.status[struck] === 'staggered' ? 8 : out.kind === 'locked' || out.kind === 'choked' ? 8 : 5;
  return { A, B, impact, struck, length: Math.max(...ends, impact + tail) + HITSTOP + 1 };
}

/** The pose and the distance from the mark (toward the other: +) of side s, k ticks into the show (the hold taken out). */
function at(pl, out, s, k) {
  const me = s === 'a' ? pl.A : pl.B, I = pl.impact;
  const hit = pl.struck === s;
  const status = out.status[s];
  // The one struck: from the impact, by what struck them.
  if (hit && k >= I) {
    const t = k - I;
    const back = -(KNOCK_M[0] + (KNOCK_M[1] - KNOCK_M[0]) * Math.min(1, out.force / 0.5));
    if (out.kind === 'thrown') {
      if (t < 1) return { gait: 'reel', off: back * 0.5 };
      if (t < 7) return { gait: 'down', off: -DOWN_M };
      if (t < 11) return { gait: 'crouch', off: -DOWN_M * (1 - (t - 7) / 4) };
      return { gait: 'guard', off: 0 };
    }
    if (out.kind === 'locked' || out.kind === 'choked') return { gait: t < 8 ? 'stun' : 'guard', off: t < 8 ? 0.1 : 0 };
    if (out.kind === 'shoved') return t < 6 ? { gait: 'stagger', off: back * Math.min(1, (t + 1) / 3) } : { gait: 'guard', off: back * Math.max(0, 1 - (t - 6) / 3) };
    if (t < 2) return { gait: 'reel', off: back * (t + 1) / 2 };
    if (status === 'stunned' || status === 'dazed') return { gait: status === 'stunned' ? 'stun' : 'reel', off: back };
    if (status === 'staggered') return t < 6 ? { gait: 'stagger', off: back * 1.3 } : { gait: 'guard', off: back * Math.max(0, 1.3 - (t - 6) * 0.5) };
    return { gait: 'guard', off: back * Math.max(0, 1 - (t - 2) / 3) };
  }
  if (me.acts) {
    const { wind, strike, recover, move, t } = me;
    const lunge = LUNGE[t?.pose] ?? LUNGE_M[move];
    const cut = (s === 'a' ? pl.B : pl.A).acts && out.by && out.by !== s && k >= I;   // (beaten to it: the blow cut short)
    if (k < wind) return { gait: move === 'hit' ? 'chamber' : 'guard', off: move === 'hit' ? -0.06 : 0.12 * (k + 1) / wind };
    if (k < wind + strike && !cut) return { gait: t?.pose ?? (move === 'hit' ? 'punch' : 'grab'), off: lunge };
    if (k < wind + strike + recover) return { gait: 'guard', off: lunge * (1 - (k - wind - strike + 1) / (recover + 1)) };
    return { gait: status === 'staggered' ? 'stagger' : 'guard', off: 0 };
  }
  // A riposte: the cover meets the blow, and hits straight back.
  if (out.kind === 'riposte' && out.by === s) return k < pl.covered ? { gait: 'guard', off: 0 } : k < I ? { gait: 'guard', off: -0.08 } : k < I + 3 ? { gait: 'hook', off: 0.35 } : { gait: 'guard', off: 0 };
  // A cover (or nothing, dazed): it gives a little when the blow arrives.
  const t = s === 'a' ? out.tech.a : out.tech.b, pose = me.move === 'open' ? 'stun' : techOf('guard', t)?.pose ?? 'guard';
  if (out.kind === 'circle') return { gait: 'guard', off: 0.12 * Math.sin(Math.PI * k / 8) };
  if (k >= I && k < I + 3) return { gait: pose, off: out.by === s ? -0.12 : 0 };
  return { gait: me.move === 'open' ? 'stun' : status === 'staggered' && k >= I ? 'stagger' : 'guard', off: 0 };
}

/** The show's length, in ticks. */
export const length = (state, f, out) => plan(state, f, out).length;

/**
 * Pose and place both fighters (actors sides: { a, b }) k ticks into the show of f.last; the hold
 * at the impact. Facing each other across their marks (f.marks); between exchanges, guard up.
 */
export function animate(state, f, sides) {
  const out = f.last, k0 = state.tick - (f.shown ?? state.tick);
  const pl = f.phase === 'show' && out ? (f.$plan?.round === out.round ? f.$plan : (f.$plan = { round: out.round, ...plan(state, f, out) })) : null;
  if (pl && k0 === pl.impact && pl.struck) {
    f.impact = { tick: state.tick, side: pl.struck, force: out.force, kind: out.kind };
    const hit = sides[pl.struck];
    if (out.blood && hit) spatter(state, hit.x, hit.z, pl.struck === 'a' ? -1 : 1, out.blood, (state.map.seed ^ (out.round * 7919)) >>> 0);
  }
  const k = !pl ? 0 : k0 < pl.impact ? k0 : k0 < pl.impact + HITSTOP ? pl.impact : k0 - HITSTOP;
  for (const s of ['a', 'b']) {
    const a = sides[s], m = f.marks?.[s];
    if (!a || !m) continue;
    const dir = s === 'a' ? 1 : -1;
    const p = pl ? at(pl, out, s, k) : { gait: f.status?.[s] === 'stunned' ? 'stun' : f.status?.[s] === 'staggered' ? 'stagger' : 'guard', off: 0 };
    a.vx = a.vz = 0;
    a.face = s === 'a' ? 'right' : 'left';
    a.gait = p.gait;
    a.x = m.x + dir * p.off; a.z = m.z;
  }
}
