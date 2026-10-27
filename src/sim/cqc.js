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
// **Techniques** (the user, 2026-10-26: "we could also hit with other body parts depending on the
// CQC level, beginners would only punch"; the list and the levels my call): how a move is done is the
// fighter's level, not a choice (TECHNIQUES). Under 7 CQC a hit is a swing, slow to come; then jabs
// and crosses, hooks, a front kick; past 17 elbows and knees, low kicks, a palm to the jaw; past 26 a
// kick to the head. A grab is a shove at first, then a hip throw, a sweep, an arm lock, a choke. A
// cover is a block, then a parry or a slip, which can leave the attacker off balance. Each has its
// targets, its weight (k), how long it takes to come (wind: the picture's, sim/cqcshow.js), and what
// it can do besides hurt.
// **Staggered, dazed, stunned**, for the next exchange, each a handicap (the user: "stuns and dazes
// should have effects like preventing blocks or hit or grab"; HANDICAP): staggered, off balance, no
// grab (no footing to throw from) and STAGGER_MOD; dazed, no cover (the hands come up too slow) and
// DAZE_MOD; stunned, nothing at all (the move 'open'): whatever comes lands. None of the three reads
// anyone. A blow that takes STAGGER_AT of what a part can take in one go staggers, as do a low kick,
// a parry, a slip, a shove; one to the head that takes DAZE_AT may daze, STUN_AT may stun (a palm, a
// head kick, a choke, likelier); a riposte dazes.
// **The riposte** (the user: "blocking a hit with advantage should result in a riposte that does even
// more damage than a direct hit and dazes … when you block normally you get an advantage, when you
// block with shift, you keep the advantage point and also hit back"): a cover with an edge in hand,
// Shift held, that meets a hit answers it at once, RIPOSTE_K a hit's damage, mostly to the head, and
// the hitter is dazed; the edge is kept. A plain cover earns an edge, as ever. So hitting into someone
// better, who reads it and covers, costs every time.
// **Spending an edge, their side** (the user: "using it when you can't read the opponent … or block
// and riposte without losing the advantage"): not reading you, they spend one on whatever they do
// (SPEND_BLIND); reading you, they keep it, for the riposte; holding all they can, now and then.
// **Injuries** besides the hurt (sim/health.js injure(): a crack, a split brow or lip, a bloody nose),
// and blood flying from a blow that drew it, or landed on a face already bleeding (out.blood: how much;
// the picture flings it, sim/cqcshow.js, onto the floor, sim/blood.js).
// **The end.** A bout (sparring: f.bout) pulls its blows (BOUT_K the damage; a drill's f.pull, less)
// and is scored, a hit or a shove a point and a throw, a lock or a choke two, first to f.to; it's
// stopped sooner if a head or a torso is wounded (f.stop). A real fight ends when someone can't go on:
// out cold, down, or unable to stand (sim/health.js).
import { skill } from './skills.js';
import { opposed } from './checks.js';
import { int, chance, weighted } from './rng.js';
import { hurt, injure, stateOf, takes, mods as hurtMods, canGrapple, canStand } from './health.js';

export const MOVES = ['hit', 'grapple', 'guard'];
export const BEATS = { guard: 'hit', hit: 'grapple', grapple: 'guard' };   // each beats the one it names
const BEATEN_BY = { hit: 'guard', grapple: 'hit', guard: 'grapple' };
export const STAGGER_AT = 0.3;
export const DAZE_AT = 0.25;
export const STUN_AT = 0.5;
export const STAGGER_MOD = -3;
export const DAZE_MOD = -4;
export const RIPOSTE_K = 1.5;
export const SPEND_BLIND = 0.7;
/** What each status forbids, for the next exchange. */
export const HANDICAP = { staggered: 'grapple', dazed: 'guard' };
/** Whether a fighter under `status` may make `move`. */
export const allowed = (status, move) => HANDICAP[status] !== move && status !== 'stunned';
const LEGS = { legL: 50, legR: 50 }, ARMS = { armL: 50, armR: 50 };
/** How each move is done, by CQC (from … below): pose (the picture's), at (where it lands), k, wind, and what else it does. */
export const TECHNIQUES = {
  hit: [
    { id: 'swing', below: 7, pose: 'swing', at: { head: 40, torso: 50, armL: 5, armR: 5 }, k: 1, wind: 3 },
    { id: 'jab', from: 6, pose: 'punch', at: { head: 60, torso: 36, armL: 2, armR: 2 }, k: 0.85, wind: 1 },
    { id: 'cross', from: 8, pose: 'punch', at: { head: 55, torso: 45 }, k: 1.1, wind: 2 },
    { id: 'hook', from: 11, pose: 'hook', at: { head: 75, torso: 25 }, k: 1.2, wind: 2 },
    { id: 'kick', from: 13, pose: 'kick', at: { torso: 76, legL: 12, legR: 12 }, k: 1.2, wind: 2 },
    { id: 'elbow', from: 17, pose: 'elbow', at: { head: 85, torso: 15 }, k: 1.4, wind: 1 },
    { id: 'knee', from: 17, pose: 'knee', at: { torso: 80, head: 20 }, k: 1.4, wind: 1 },
    { id: 'lowkick', from: 19, pose: 'lowkick', at: LEGS, k: 1.1, wind: 1, stagger: 0.7 },
    { id: 'palm', from: 22, pose: 'punch', at: { head: 90, torso: 10 }, k: 1.1, wind: 1, stun: 0.25 },
    { id: 'roundhouse', from: 26, pose: 'highkick', at: { head: 80, torso: 20 }, k: 1.7, wind: 2, stun: 0.35 },
  ],
  grapple: [
    { id: 'shove', below: 9, pose: 'grab', at: { torso: 1 }, k: 0.6, stagger: 1, pts: 1 },
    { id: 'hip', from: 9, pose: 'throw', at: { torso: 1 }, k: 1, down: true, pts: 2 },
    { id: 'sweep', from: 14, pose: 'sweep', at: { torso: 70, ...{ legL: 15, legR: 15 } }, k: 1, down: true, pts: 2 },
    { id: 'armlock', from: 21, pose: 'grab', at: ARMS, k: 1.5, pts: 2 },
    { id: 'choke', from: 27, pose: 'grab', at: { head: 1 }, k: 0.8, stun: 0.5, pts: 2 },
  ],
  guard: [
    { id: 'block', pose: 'guard' },
    { id: 'parry', from: 12, pose: 'parry', stagger: 0.4 },
    { id: 'slip', from: 20, pose: 'slip', stagger: 0.6 },
  ],
};

/** The technique a fighter of this CQC does a move with: one of what they know, the newer the likelier. */
export function technique(r, move, cqc) {
  const known = (TECHNIQUES[move] ?? []).filter(t => (t.from ?? 0) <= cqc && (t.below ?? Infinity) > cqc);
  if (!known.length) return null;
  return weighted(r, known.map(t => [t, 1 + Math.max(0, Math.min(10, cqc - (t.from ?? 0))) / 10]));
}
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
  const f = state.fight = { a, b, bout, to, style, script, tell, pull, stop, round: 0, adv: { a: 0, b: 0 }, score: { a: 0, b: 0 }, status: { a: null, b: null }, seen: [], theirs: null, read: false, last: null, ended: null, phase: 'choose' };
  prepare(state, f);
  return f;
}

/** The chance a fights b's intent: READ_PER_PT a point of CQC over theirs (none, staggered, dazed or stunned). */
export const readChance = (state, a, b, f = state.fight) => {
  const s = f && (a === f.a ? f.status?.a : a === f.b ? f.status?.b : null);
  return s ? 0 : Math.min(READ_MAX, Math.max(0, cqcOf(state, a) - cqcOf(state, b)) * READ_PER_PT);
};

/** The next exchange: their move (and whether they'll spend a point), and whether we read it. A stunned fighter does nothing. */
export function prepare(state, f) {
  const r = state.rng;
  const move = f.status?.b === 'stunned' ? 'open' : f.script ? f.script[f.round % f.script.length] : choose(state, f);
  // (an edge: spent when they can't read you; kept, for the riposte, when they can; now and then when they hold all they can)
  const blind = readChance(state, f.b, f.a, f) < 0.2, full = f.adv.b >= advMax(state, f.b);
  const spend = move !== 'open' && f.adv.b > 0 && !f.script && chance(r, blind ? SPEND_BLIND : full ? 0.35 : 0.05);
  f.theirs = { move, spend };
  f.read = move === 'open' || f.tell || chance(r, readChance(state, f.a, f.b, f));
}

/** Their choice: their style's mix, turned against what we lean on the better they fight. */
export function choose(state, f) {
  const r = state.rng, me = state.people[f.b], st = f.status?.b;
  const ok = (m) => (m !== 'grapple' || canGrapple(me)) && allowed(st, m);
  const adapt = Math.min(ADAPT_MAX, cqcOf(state, f.b) * ADAPT_PER_CQC);
  if (f.seen.length >= 2 && chance(r, adapt)) {
    const counts = MOVES.map(m => [m, f.seen.filter(x => x === m).length]).sort((p, q) => q[1] - p[1]);
    const counter = BEATEN_BY[counts[0][0]];
    if (ok(counter)) return counter;
  }
  const mix = STYLES[f.style] ?? STYLES.even;
  return weighted(r, MOVES.filter(ok).map(m => [m, mix[m]]));
}

/** Where a blow lands: the technique's targets (clean: the head more often). */
function partHit(r, at, clean) {
  return weighted(r, Object.entries(at ?? HIT_AT).map(([k, w]) => [k, k === 'head' && clean ? w * 1.5 : w]));
}

/**
 * Our move ({ move, spend }) against theirs: the exchange, resolved. Returns what happened, for the
 * log and the picture: { ours, theirs (moves, 'open' for someone stunned), tech: { a, b } (how each
 * did it), kind ('blocked' | 'landed' | 'thrown' | 'shoved' | 'locked' | 'choked' | 'circle' |
 * 'fended' | 'absorbed'), by ('a' | 'b' | null: who came out on top), part, dmg, force (the blow, as a
 * share of what the part can take), roll, spent: { a, b }, gained, status: { a, b } (staggered or
 * stunned by it, for the next exchange) }.
 */
export function resolve(state, f, ours) {
  const r = state.rng, A = state.people[f.a], B = state.people[f.b];
  const was = { ...f.status };
  const forced = (st, m) => (st === 'stunned' ? 'open' : allowed(st, m) ? m : 'open');   // (what a handicap forbids does nothing)
  const moves = { a: forced(was.a, ours.move === 'grapple' && !canGrapple(A) ? 'guard' : ours.move), b: forced(was.b, f.theirs.move) };
  // (the better one, if it's them, may see ours coming and answer it)
  const answer = BEATEN_BY[moves.a];
  if (moves.b !== 'open' && moves.a !== 'open' && !f.script && (answer !== 'grapple' || canGrapple(B)) && allowed(was.b, answer) && chance(r, readChance(state, f.b, f.a, f))) {
    moves.b = answer; f.theirs.read = true;
    if (answer === 'guard' && f.adv.b > 0) f.theirs.spend = true;  // (they see the hit coming, an edge in hand: the riposte)
  }
  const tech = { a: (ours.tech && TECHNIQUES[moves.a]?.find(t => t.id === ours.tech)) || technique(r, moves.a, cqcOf(state, f.a)), b: technique(r, moves.b, cqcOf(state, f.b)) };
  const wants = { a: !!ours.spend && f.adv.a > 0 && moves.a !== 'open', b: !!f.theirs.spend && f.adv.b > 0 };
  const out = { round: f.round, ours: moves.a, theirs: moves.b, tech: { a: tech.a?.id ?? null, b: tech.b?.id ?? null }, kind: 'circle', by: null, part: null, dmg: 0, force: 0, roll: null,
    spent: { a: false, b: false }, gained: null, read: f.read, status: { a: null, b: null }, was };
  f.status = { a: null, b: null };
  // Who comes out on top: the triangle (someone stunned loses to anything but a cover), or, the same move both ways, the dice.
  let by = null;
  if (moves.a === 'open' || moves.b === 'open') by = moves.a === moves.b ? null : moves.a === 'open' ? (moves.b === 'guard' ? null : 'b') : (moves.a === 'guard' ? null : 'a');
  else if (moves.a !== moves.b) by = BEATS[moves.a] === moves.b ? 'a' : 'b';
  else if (moves.a !== 'guard') {
    const off = (s) => (was[s] === 'staggered' ? [{ why: 'off balance', v: STAGGER_MOD }] : was[s] === 'dazed' ? [{ why: 'dazed', v: DAZE_MOD }] : []);
    const roll = opposed(r, { skill: 'cqc', value: cqcOf(state, f.a), mods: [...hurtMods(A, 'cqc'), ...off('a')] }, { skill: 'cqc', value: cqcOf(state, f.b), mods: [...hurtMods(B, 'cqc'), ...off('b')] });
    out.roll = roll;
    by = roll.ok ? 'a' : 'b';
  }
  out.by = by;
  if (by) {
    const win = moves[by], lose = moves[other(by)], w = by, l = other(by), T = tech[w];
    const W = by === 'a' ? f.a : f.b, L = by === 'a' ? f.b : f.a, LP = state.people[L];
    if (win === 'guard' && wants[w]) {                              // a hit, covered with an edge held ready (Shift): the riposte, the edge kept
      out.kind = 'riposte';
      out.part = partHit(r, { head: 70, torso: 30 }, true);
      out.dmg = damage(state, f, (int(r, HIT_PTS[1] - HIT_PTS[0] + 1) + HIT_PTS[0]) * RIPOSTE_K, W, L);
      out.status[l] = 'dazed';
    } else if (win === 'guard') {                                   // a hit, guarded (parried, slipped: off balance, perhaps)
      out.kind = 'blocked';
      if (f.adv[w] < advMax(state, W)) { f.adv[w]++; out.gained = w; }
      if (T?.stagger && chance(r, T.stagger)) out.status[l] = 'staggered';
    } else if (win === 'grapple') {                                 // a throw, a shove, a lock, a choke
      if (lose === 'guard' && wants[l]) { f.adv[l]--; out.spent[l] = true; out.kind = 'fended'; }
      else {
        out.part = partHit(r, T?.at ?? { torso: 1 }, false);
        out.kind = T?.down ? 'thrown' : T?.id === 'shove' ? 'shoved' : T?.id === 'armlock' ? 'locked' : T?.id === 'choke' ? 'choked' : 'thrown';
        out.dmg = damage(state, f, (int(r, THROW_PTS[1] - THROW_PTS[0] + 1) + THROW_PTS[0]) * (T?.k ?? 1), W, L);
        if (T?.stagger) out.status[l] = 'staggered';
      }
    } else {                                                        // a blow lands (on someone grabbing, or open, or the other's hit beaten)
      const clean = lose === 'grapple' || lose === 'open';
      out.part = partHit(r, T?.at, clean);
      if (lose === 'grapple' && wants[l]) { f.adv[l]--; out.spent[l] = true; out.kind = 'absorbed'; }
      else {
        let pts = (int(r, HIT_PTS[1] - HIT_PTS[0] + 1) + HIT_PTS[0]) * (T?.k ?? 1);
        if (clean) pts *= CLEAN_K;
        if (wants[w]) { f.adv[w]--; out.spent[w] = true; pts *= 2; }
        out.kind = 'landed';
        out.dmg = damage(state, f, pts, W, L);
        if (T?.stagger && chance(r, T.stagger)) out.status[l] = 'staggered';
      }
    }
    if (out.dmg) {
      out.force = Math.round(out.dmg / takes(LP, out.part) * 100) / 100;
      hurt(LP, out.part, out.dmg);
      // What else it did (a crack, a split, a bloody nose), and whether it drew blood to fly.
      out.injuries = injure(LP, out.part, out.force, r, state.time.ms);
      out.blood = out.injuries.some(i => i.bleed) || (out.part === 'head' && LP.injuries?.some(i => i.bleed > state.time.ms)) ? Math.round(4 + out.force * 20) : 0;
      // A heavy blow staggers; a hard one to the head dazes, a very hard one stuns (likelier for a technique made for it).
      const head = out.part === 'head', t = T?.stun ?? 0;
      if (head && out.force >= STUN_AT && chance(r, Math.min(0.9, 0.6 + t))) out.status[l] = 'stunned';
      else if ((head && out.force >= DAZE_AT && chance(r, Math.min(0.9, 0.5 + t))) || (t && chance(r, t))) out.status[l] = out.status[l] === 'stunned' ? 'stunned' : 'dazed';
      if (!out.status[l] && out.force >= STAGGER_AT) out.status[l] = 'staggered';
      if (f.bout) f.score[w] += T?.pts ?? (out.kind === 'thrown' ? 2 : 1);
    }
  }
  f.status = out.status;
  if (moves.a !== 'open') { f.seen.push(moves.a); if (f.seen.length > SEEN_MOVES) f.seen.shift(); }
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
