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
// **Advantage points** (the design's; zero-sum, the user: "when gaining advantage if the opponent has
// points, it should remove their points before adding some to us"): a hit guarded takes one of
// theirs away if they hold any, and only then earns one; held up to one per 10 CQC (at least
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
// **Fight enders** (the user, 2026-10-26: "when hitting a stunned opponent with advantage, we attempt a
// fight ender since they can't defend, hits try to knock them out, grabs try breaking limbs (if skilled
// enough, otherwise it's just a crazy charge and we slam them against the floor …) it's a CQC check
// against a difficulty derived from their CQC and fitness. If check is failed, damage is still
// increased and likely to result in a crack, fracture or other long term injury. Doing so during a
// friendly bout is considered a breach of ethics … such a hit can result in death"; finish()): an edge
// spent (Shift) on a hit or a grab against someone stunned is a CQC check against FINISH_DC + their
// CQC + half their Fitness. A hit: a knockout, out cold. A grab: from BREAK_CQC, an arm or a leg
// broken, and they give up; below it, a charge that slams them into the floor, down. Failed: double
// a blow's damage anyway, and a fracture likely (FRACTURE_ON_BOTCH), or a crack. A knockout or a slam
// may kill (deathChance(): DEATH_BASE, and DEATH_WEAR_K for how beaten up they were before it, up to
// DEATH_MAX; a botched one half that). Their side does it to a stunned player too, in a real fight. In
// a bout it's a foul: nothing pulled, and the bout is lost by whoever did it (f.fouled).
// **Weapons** (the user, 2026-10-26: "fight is still CQC and works the same"; sim/weapons.js): what's in a
// fighter's hand changes how, not what. Armed, a hit is mostly the weapon's (a slash, a stab, a club, a
// thrust: technique()), its weight the weapon's k, a blade or a point cutting what it lands on (bleeding
// by the weapon's bleed); the trained still kick or knee or elbow now and then, never a cross with the
// knife hand. A cover is held with the weapon if it's any good for it (guard 0.4 and over). Blocking
// a blade, or a heavy weapon (HEAVY_K), with less than SOLID_GUARD in your hands is a CQC roll for a
// clean block (the guard's worth adds GUARD_PER_PT × 8): lost, it comes through the guard, mostly into
// the forearms (THROUGH_AT), THROUGH_K of a hit, never past a wound (THROUGH_CAP). A grab with a hand
// full costs the weapon's grab on the roll and may fumble (FUMBLE_PER_PT a point); an awkward weapon
// costs every roll. A grab that lands may knock the weapon out of the hand (DISARM, by how it was
// done); a bottle may break into a broken one. Armed, Shift with a hit on someone stunned is an attempt
// to kill (finish(): 'kill'; the user, "if wielding a weapon, shift hitting a stunned opponent is us
// attempting a kill"). An armed fighter hits more and grabs less (choose()).
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
import { check } from './checks.js';
import { wielded, techsOf, canGrabWith, bare, WEAPON_PREF, TRAINED_CQC, SOLID_GUARD, HEAVY_K, FUMBLE_PER_PT, TECHS } from './weapons.js';
import { hurt, injure, stateOf, takes, mods as hurtMods, canGrapple, canStand, kill, wear } from './health.js';

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
export const FINISH_DC = 4;
export const THROUGH_K = 0.4;
export const THROUGH_CAP = 0.6;                                    // (a cut through the guard never takes a part past this share)
export const THROUGH_AT = { armL: 36, armR: 36, head: 11, torso: 11, legL: 3, legR: 3 };
export const GUARD_PER_PT = 8;
export const DISARM = { armlock: 0.5, hip: 0.15, sweep: 0.15, choke: 0.2, shove: 0.08 };
const HAND = new Set(['cross', 'hook', 'palm']);                    // (the weapon hand isn't a fist)
export const BREAK_CQC = 21;
export const FRACTURE_ON_BOTCH = 0.45;
export const DEATH_BASE = 0.02;
export const DEATH_WEAR_K = 0.5;
export const DEATH_MAX = 0.6;
/** The difficulty of finishing who: FINISH_DC + their CQC + half their Fitness. */
export const finishDC = (state, who) => FINISH_DC + cqcOf(state, who) + Math.floor(skill(state.people[who], 'fitness') / 2);
/** The chance a knockout or a slam kills, by how beaten up they were before it (wear: sim/health.js); a botched one, half. */
export const deathChance = (before, ok = true) => Math.min(DEATH_MAX, DEATH_BASE + DEATH_WEAR_K * Math.max(0, before - 0.35)) * (ok ? 1 : 0.5);
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

/** The weapon's way of doing a move, as a technique: its weight, and a tick longer to come for something awkward. */
const armed = (t, w) => ({ ...t, k: w.k, weapon: true, wind: (t.wind ?? 1) + (w.awkward <= -2 ? 1 : 0) });

/**
 * The technique a fighter of this CQC does a move with: one of what they know, the newer the likelier.
 * Armed (w: sim/weapons.js), a hit is mostly the weapon's (WEAPON_PREF), and a cover is made with it if
 * it's any good for that.
 */
export function technique(r, move, cqc, w = null) {
  if (w && move === 'hit' && chance(r, cqc >= TRAINED_CQC ? WEAPON_PREF.trained : WEAPON_PREF.untrained)) { const ts = techsOf(w); return armed(ts[int(r, ts.length)], w); }
  if (w && move === 'guard' && w.guard >= 0.4) return { id: 'wblock', pose: 'guard', weapon: true };
  let known = (TECHNIQUES[move] ?? []).filter(t => (t.from ?? 0) <= cqc && (t.below ?? Infinity) > cqc);
  if (w && move === 'hit' && known.some(t => !HAND.has(t.id))) known = known.filter(t => !HAND.has(t.id));
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
  // (us stunned, an edge in hand, a real fight: they go to finish it, a grab from a fighter who can break an arm)
  if (f.status?.a === 'stunned' && f.status?.b !== 'stunned' && f.adv.b > 0 && !f.bout && !f.script) {
    const B = state.people[f.b], grab = canGrapple(B) && canGrabWith(wielded(B)) && !wielded(B) && chance(r, cqcOf(state, f.b) >= BREAK_CQC ? 0.4 : 0.25);
    f.theirs = { move: grab ? 'grapple' : 'hit', spend: true };
    f.read = true;
    return;
  }
  const move = f.status?.b === 'stunned' ? 'open' : f.script ? f.script[f.round % f.script.length] : choose(state, f);
  // (an edge: spent when they can't read you; kept, for the riposte, when they can; now and then when they hold all they can)
  const blind = readChance(state, f.b, f.a, f) < 0.2, full = f.adv.b >= advMax(state, f.b);
  // (in a bout, never on someone stunned: that would be a fight ender, a foul, and a sparring partner doesn't)
  const spend = move !== 'open' && f.adv.b > 0 && !f.script && !(f.bout && f.status?.a === 'stunned') && chance(r, blind ? SPEND_BLIND : full ? 0.35 : 0.05);
  f.theirs = { move, spend };
  f.read = move === 'open' || f.tell || chance(r, readChance(state, f.a, f.b, f));
}

/** Their choice: their style's mix, turned against what we lean on the better they fight. */
export function choose(state, f) {
  const r = state.rng, me = state.people[f.b], st = f.status?.b;
  const W = wielded(me);
  const ok = (m) => (m !== 'grapple' || (canGrapple(me) && canGrabWith(W))) && allowed(st, m);
  const adapt = Math.min(ADAPT_MAX, cqcOf(state, f.b) * ADAPT_PER_CQC);
  if (f.seen.length >= 2 && chance(r, adapt)) {
    const counts = MOVES.map(m => [m, f.seen.filter(x => x === m).length]).sort((p, q) => q[1] - p[1]);
    const counter = BEATEN_BY[counts[0][0]];
    if (ok(counter)) return counter;
  }
  const base = STYLES[f.style] ?? STYLES.even;
  // (armed: they hit more, and grab less the more the weapon's in the way)
  const mix = W ? { hit: base.hit * 1.5, grapple: base.grapple * Math.max(0.15, 1 + W.grab / 6), guard: base.guard } : base;
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
  const arms = { a: wielded(A), b: wielded(B) };
  const moves = { a: forced(was.a, ours.move === 'grapple' && (!canGrapple(A) || !canGrabWith(arms.a)) ? 'guard' : ours.move), b: forced(was.b, f.theirs.move) };
  // (the better one, if it's them, may see ours coming and answer it)
  const answer = BEATEN_BY[moves.a];
  if (moves.b !== 'open' && moves.a !== 'open' && !f.script && (answer !== 'grapple' || (canGrapple(B) && canGrabWith(arms.b))) && allowed(was.b, answer) && chance(r, readChance(state, f.b, f.a, f))) {
    moves.b = answer; f.theirs.read = true;
    if (answer === 'guard' && f.adv.b > 0) f.theirs.spend = true;  // (they see the hit coming, an edge in hand: the riposte)
  }
  const asked = ours.tech && (TECHNIQUES[moves.a]?.find(t => t.id === ours.tech) ?? (arms.a && TECHS[ours.tech] && armed(TECHS[ours.tech], arms.a)));   // (an opening's: a stab, a shove)
  const tech = { a: asked || technique(r, moves.a, cqcOf(state, f.a), arms.a), b: technique(r, moves.b, cqcOf(state, f.b), arms.b) };
  const wants = { a: !!ours.spend && f.adv.a > 0 && moves.a !== 'open', b: !!f.theirs.spend && f.adv.b > 0 };
  const out = { round: f.round, ours: moves.a, theirs: moves.b, tech: { a: tech.a?.id ?? null, b: tech.b?.id ?? null }, kind: 'circle', by: null, part: null, dmg: 0, force: 0, roll: null,
    spent: { a: false, b: false }, gained: null, read: f.read, status: { a: null, b: null }, was, arms: { a: A.hand ?? null, b: B.hand ?? null } };
  f.status = { a: null, b: null };
  // Who comes out on top: the triangle (someone stunned loses to anything but a cover), or, the same move both ways, the dice.
  let by = null;
  if (moves.a === 'open' || moves.b === 'open') by = moves.a === moves.b ? null : moves.a === 'open' ? (moves.b === 'guard' ? null : 'b') : (moves.a === 'guard' ? null : 'a');
  else if (moves.a !== moves.b) by = BEATS[moves.a] === moves.b ? 'a' : 'b';
  else if (moves.a !== 'guard') {
    const off = (s) => (was[s] === 'staggered' ? [{ why: 'off balance', v: STAGGER_MOD }] : was[s] === 'dazed' ? [{ why: 'dazed', v: DAZE_MOD }] : []);
    // (a weapon: awkward costs every roll; a hand full, a grab)
    const held = (s) => { const w = arms[s]; return !w ? [] : [...(w.awkward ? [{ why: `${bare(w)}, awkward`, v: w.awkward }] : []), ...(moves[s] === 'grapple' && w.grab ? [{ why: 'a hand full', v: w.grab }] : [])]; };
    const roll = opposed(r, { skill: 'cqc', value: cqcOf(state, f.a), mods: [...hurtMods(A, 'cqc'), ...off('a'), ...held('a')] }, { skill: 'cqc', value: cqcOf(state, f.b), mods: [...hurtMods(B, 'cqc'), ...off('b'), ...held('b')] });
    out.roll = roll;
    by = roll.ok ? 'a' : 'b';
  }
  out.by = by;
  if (by) {
    const win = moves[by], lose = moves[other(by)], w = by, l = other(by), T = tech[w];
    const W = by === 'a' ? f.a : f.b, L = by === 'a' ? f.b : f.a, LP = state.people[L];
    if (win !== 'guard' && lose === 'open' && was[l] === 'stunned' && wants[w]) {
      finish(state, f, out, w, l, win, T);                          // (they can't defend: a fight ender)
    } else if (win === 'guard' && wants[w]) {                              // a hit, covered with an edge held ready (Shift): the riposte, the edge kept
      throughGuard(state, f, out, w, l, tech, arms);
      out.kind = 'riposte';
      out.part = partHit(r, { head: 70, torso: 30 }, true);
      out.dmg = damage(state, f, (int(r, HIT_PTS[1] - HIT_PTS[0] + 1) + HIT_PTS[0]) * RIPOSTE_K, W, L);
      out.status[l] = 'dazed';
    } else if (win === 'guard') {                                   // a hit, guarded (parried, slipped: off balance, perhaps)
      out.kind = 'blocked';
      if (f.adv[l] > 0) { f.adv[l]--; out.taken = l; }                // (zero-sum: theirs goes first)
      else if (f.adv[w] < advMax(state, W)) { f.adv[w]++; out.gained = w; }
      if (T?.stagger && chance(r, T.stagger)) out.status[l] = 'staggered';
      throughGuard(state, f, out, w, l, tech, arms);
    } else if (win === 'grapple') {                                 // a throw, a shove, a lock, a choke
      if (lose === 'guard' && wants[l]) { f.adv[l]--; out.spent[l] = true; out.kind = 'fended'; }
      else if (lose === 'guard' && arms[w]?.grab < 0 && chance(r, -arms[w].grab * FUMBLE_PER_PT)) out.kind = 'fumbled';   // (a hand full: the grip won't take)
      else {
        out.part = partHit(r, T?.at ?? { torso: 1 }, false);
        out.kind = T?.down ? 'thrown' : T?.id === 'shove' ? 'shoved' : T?.id === 'armlock' ? 'locked' : T?.id === 'choke' ? 'choked' : 'thrown';
        out.dmg = damage(state, f, (int(r, THROW_PTS[1] - THROW_PTS[0] + 1) + THROW_PTS[0]) * (T?.k ?? 1) * (1 + Math.min(0, arms[w]?.grab ?? 0) * 0.05), W, L);
        if (T?.stagger) out.status[l] = 'staggered';
        if (arms[l] && chance(r, DISARM[T?.id] ?? 0.1)) { out.dropped = { side: l, kind: LP.hand }; LP.hand = null; }   // (knocked out of the hand)
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
    if (out.dmg && !out.finish) {
      out.force = Math.round(out.dmg / takes(LP, out.part) * 100) / 100;
      hurt(LP, out.part, out.dmg);
      // What else it did (a crack, a split, a bloody nose), and whether it drew blood to fly.
      const wpn = T?.weapon ? arms[w] : null;
      out.injuries = injure(LP, out.part, out.force, r, state.time.ms, { edge: !!wpn?.edge, bleedK: wpn?.bleed ?? 1, crackK: wpn?.crack ?? 0 });
      if (wpn?.breaks && chance(r, wpn.breaks)) { out.broke = { side: w, from: state.people[W].hand, into: wpn.into ?? null }; state.people[W].hand = wpn.into ?? null; }
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
  if (out.foul) f.ended = { by: other(out.by), why: f.ended?.why === 'dead' ? 'dead' : 'fouled' };   // (a foul loses the bout, whatever else)
  else if (!f.ended && out.kind === 'broken') f.ended = { by: out.by, why: 'broken' };                 // (a broken limb: they give up)
  if (!f.ended) prepare(state, f);
  return out;
}

/**
 * A fight ender: w, an edge spent on `win` (a hit or a grab), against l, stunned. A CQC check against
 * finishDC: a knockout, a broken limb (BREAK_CQC and over) or a slam onto the floor; failed, double a
 * blow's damage and likely a fracture. Nothing pulled, even in a bout (where it's a foul). May kill.
 */
function finish(state, f, out, w, l, win, T) {
  const r = state.rng, W = w === 'a' ? f.a : f.b, L = w === 'a' ? f.b : f.a, LP = state.people[L], ms = state.time.ms;
  f.adv[w]--; out.spent[w] = true;
  const wpn = win === 'hit' && T?.weapon ? wielded(state.people[W]) : null;   // (armed, a hit on someone stunned is to kill)
  const how = wpn ? 'kill' : win === 'hit' ? 'knockout' : cqcOf(state, W) >= BREAK_CQC ? 'break' : 'slam';
  const roll = check(r, { skill: 'cqc', value: cqcOf(state, W), dc: finishDC(state, L), mods: hurtMods(state.people[W], 'cqc') });
  const before = wear(LP), edge = Math.max(0, cqcOf(state, W) - cqcOf(state, L)) / EDGE_PER_PT;
  out.roll = roll;
  out.finish = { how, ok: roll.ok };
  if (f.bout) out.foul = true;
  const blow = (part, pts, fracture) => {                          // (damage, and what else it did)
    out.part = part;
    out.dmg = Math.round((pts + edge) * 10) / 10;
    out.force = Math.round(out.dmg / takes(LP, part) * 100) / 100;
    hurt(LP, part, out.dmg);
    out.injuries = injure(LP, part, out.force, r, ms, { fracture, edge: !!wpn?.edge, bleedK: wpn?.bleed ?? 1 });
  };
  const roll1 = (lo, hi) => int(r, hi - lo + 1) + lo;
  if (how === 'kill') {
    const part = wpn.edge ? weighted(r, [['torso', 6], ['head', 4]]) : 'head';
    if (roll.ok) {
      blow(part, Math.max(0, takes(LP, part) - (LP.body?.[part] ?? 0)) + 0.1, 0);
      kill(LP, ms, wpn.edge ? (part === 'head' ? 'a knife across the throat' : 'a knife under the ribs') : 'a blow to the skull');
      out.killed = true; out.kind = 'killed';
    } else {
      blow(part, roll1(...HIT_PTS) * wpn.k * 2, FRACTURE_ON_BOTCH);
      out.kind = 'botched';
      out.status[l] = 'dazed';
      if (chance(r, deathChance(before, false) + (wpn.edge ? 0.15 : 0.05))) { kill(LP, ms, wpn.edge ? 'a knife wound' : 'a blow to the head'); out.killed = true; }
    }
  } else if (how === 'break') {
    const limbs = ['armL', 'armR', 'legL', 'legR'].filter(k => stateOf(LP, k) !== 'out');
    const part = limbs.length ? weighted(r, limbs.map(k => [k, k.startsWith('arm') ? 7 : 3])) : 'torso';
    if (roll.ok) { blow(part, Math.max(0, takes(LP, part) - (LP.body?.[part] ?? 0)) + 0.1, 1); out.kind = 'broken'; }
    else { blow(part, roll1(...THROW_PTS) * 1.5, FRACTURE_ON_BOTCH); out.kind = 'botched'; out.status[l] = 'staggered'; }
  } else {
    const part = how === 'knockout' ? 'head' : 'torso';
    if (roll.ok) {
      blow(part, Math.max(0, takes(LP, part) - (LP.body?.[part] ?? 0)) + 0.1, 0);
      if (how === 'slam') hurt(LP, 'head', takes(LP, 'head') * 0.3);   // (the head hits the floor too)
      out.kind = how === 'knockout' ? 'knockout' : 'slammed';
    } else {
      blow(part, (how === 'knockout' ? roll1(...HIT_PTS) * (T?.k ?? 1) * CLEAN_K : roll1(...THROW_PTS)) * 2, FRACTURE_ON_BOTCH);
      out.kind = 'botched';
      out.status[l] = how === 'knockout' ? 'dazed' : 'staggered';
    }
    if (chance(r, deathChance(before, roll.ok))) { kill(LP, ms, how === 'knockout' ? 'a blow to the head' : 'slammed into the floor'); out.killed = true; }
  }
  out.blood = out.injuries?.some(i => i.bleed) || (out.part === 'head' && out.force > 0.4) ? Math.round(6 + out.force * 20) : 0;
}

/**
 * A hit stopped by w's cover, from l armed: a blade, or a heavy weapon, against less than SOLID_GUARD in
 * w's hands is a CQC roll for a clean block (the guard's worth helps); lost, it comes through, into the
 * forearms mostly, THROUGH_K of a hit, never past THROUGH_CAP of what the part takes. out.through: { part, dmg, injuries }; out.clean.
 */
function throughGuard(state, f, out, w, l, tech, arms) {
  const r = state.rng, aw = tech[l]?.weapon ? arms[l] : null;
  if (!aw || !(aw.edge || aw.k >= HEAVY_K)) return;
  const g = tech[w]?.weapon ? arms[w]?.guard ?? 0 : 0;
  if (g >= SOLID_GUARD) { out.clean = 'tool'; return; }
  const Wd = w === 'a' ? f.a : f.b, La = w === 'a' ? f.b : f.a, P = state.people[Wd];
  const roll = opposed(r, { skill: 'cqc', value: cqcOf(state, Wd), mods: [...hurtMods(P, 'cqc'), ...(g ? [{ why: `${bare(arms[w])} across it`, v: Math.round(g * GUARD_PER_PT) }] : [])] }, { skill: 'cqc', value: cqcOf(state, La) });
  out.guardRoll = roll;
  if (roll.ok) { out.clean = 'block'; return; }
  const part = weighted(r, Object.entries(THROUGH_AT));
  const pts = (int(r, HIT_PTS[1] - HIT_PTS[0] + 1) + HIT_PTS[0]) * aw.k * THROUGH_K * (1 - g) * f.pull;
  const dmg = Math.round(Math.min(pts, Math.max(0, takes(P, part) * THROUGH_CAP - (P.body?.[part] ?? 0))) * 10) / 10;
  if (!dmg) { out.clean = 'block'; return; }
  hurt(P, part, dmg);
  const force = Math.round(dmg / takes(P, part) * 100) / 100;
  out.through = { part, dmg, force, injuries: injure(P, part, force, r, state.time.ms, { edge: !!aw.edge, bleedK: (aw.bleed ?? 1) * 0.6 }) };
  out.blood = Math.max(out.blood ?? 0, aw.edge ? 6 : 0);
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
    if (p.dead) return { by: other(s), why: 'dead' };
    const why = stateOf(p, 'head') === 'out' ? 'out cold' : stateOf(p, 'torso') === 'out' ? 'down' : !canStand(p) ? 'can\'t stand' : null;
    if (why) return { by: other(s), why };
    if (f.stop && ['head', 'torso'].some(k => stateOf(p, k) === 'wounded')) return { by: other(s), why: 'stopped' };
  }
  if (f.bout) for (const s of ['a', 'b']) if (f.score[s] >= f.to) return { by: s, why: 'points' };
  return null;
}
