// TRADECRAFT sim: what you can do with someone at hand (F), the engine's, in any scene (the user,
// 2026-10-26: "the interact button F that when close to someone should open the contextual menu to do
// things like TALK, VIOLENCE … READ").
//
// atHand(state) is whoever's within REACH_M, those in front of you first, then the nearest.
// options(state, them) lists what's open, each { id, label, ok, why } (greyed, with why, when not):
//   - TALK: a conversation, time standing still (sim/talk.js; its minigame, and conversation proper,
//     mechanic test 4, come later);
//   - READ: what you make of them (sim/know.js): their sheet as you guess it;
//   - VIOLENCE, an opening (OPENINGS): a hit; a sucker punch, if they don't see it coming (out of their
//     sight, or your Deception against their Awareness): it lands on them open, with all your weight,
//     and may stun; a push (a shove: off balance, and no more unless they want more); a grab (CQC
//     GRAB_CQC and over); a stab (a blade drawn: there are none yet).
// act(state, bus, id, them) does it. An opening is a fight's first exchange (sim/fight.js), them caught
// open if they didn't see it coming. After every exchange, someone who won't fight on runs (NERVE:
// hurt, outclassed, a civilian); out cold, they lie a while (DOWN_S) and then get up and go. A fight
// in the street is seen: whoever saw it remembers a face (heat, WITNESS_HEAT each, up to WITNESS_MAX;
// a killing, KILL_HEAT_K times that). Someone killed lies there for good (sim/fight.js); a broken arm
// gives up and goes, holding it.
import { opposed } from './checks.js';
import { skill } from './skills.js';
import { chance, pick, hash } from './rng.js';
import { say } from './log.js';
import { passerby, describe } from './people.js';
import { seesActor } from './perception.js';
import { stateOf, canStand, bleeding } from './health.js';
import { addHeat } from './heat.js';
import { begin as beginFight, exchange, owners, shortName } from './fight.js';
import { read, fought } from './know.js';
import { begin as beginTalk } from './talk.js';
import { wielded, canGrabWith } from './weapons.js';
import { armsOf } from './items.js';
import { nudge } from './people.js';
import { LINE } from './city.js';
import { rowOf } from './agents.js';

export const REACH_M = 1.8;
export const GRAB_CQC = 9;
export const DOWN_S = 60;
export const WITNESS_M = 25;
export const WITNESS_HEAT = 1;
export const WITNESS_MAX = 6;
export const KILL_HEAT_K = 4;
export const OPENINGS = ['hit', 'sucker', 'push', 'grab', 'stab'];
const OPENING_WORDS = { hit: 'Hit', sucker: 'Sucker punch', push: 'Push', grab: 'Grab', stab: 'Stab' };

const playerOf = (state) => state.actors.find(a => a.who === state.player);

/** Whoever's within reach: in front of you first, then the nearest. */
export function atHand(state) {
  const me = playerOf(state);
  if (!me || state.fight) return null;
  const h = me.head ?? 0;
  const cands = state.actors.filter(a => a !== me && !a.hidden && (a.row ?? state.map.row) === (me.row ?? state.map.row) && Math.hypot(a.x - me.x, a.z - me.z) <= REACH_M);
  const score = (a) => Math.hypot(a.x - me.x, a.z - me.z) - 1.2 * Math.cos(Math.atan2(a.z - me.z, a.x - me.x) - h);
  return cands.sort((p, q) => score(p) - score(q))[0] ?? null;
}

/** Whether they'd see it coming: you're in their sight. */
const seesUs = (state, them) => seesActor(state, them, playerOf(state));

/** What's open to do with them: the menu, and VIOLENCE's openings. */
export function options(state, them) {
  const me = state.people[state.player], cqc = skill(me, 'cqc'), w = wielded(me), cuts = !!w?.edge;
  const grabs = cqc >= GRAB_CQC && canGrabWith(w);
  const violence = [
    { id: 'hit', label: w && !cuts ? `Hit them with ${w.name.replace(/^(a|an|half a) /, 'the ')}` : OPENING_WORDS.hit, ok: true },
    { id: 'sucker', label: OPENING_WORDS.sucker, ok: true, why: seesUs(state, them) ? 'they\'re looking: it has to be quick' : null },
    { id: 'push', label: OPENING_WORDS.push, ok: true },
    { id: 'grab', label: OPENING_WORDS.grab, ok: grabs, why: grabs ? null : cqc < GRAB_CQC ? `CQC ${GRAB_CQC} and over (yours: ${cqc})` : 'your hand is full' },
    { id: 'stab', label: cuts ? `Stab: ${w.name.replace(/^(a|an) /, 'the ')}` : OPENING_WORDS.stab, ok: cuts, why: cuts ? null : 'no blade drawn (G draws one)' },
  ];
  return [
    { id: 'talk', label: 'Talk', ok: true },
    { id: 'violence', label: 'Violence', ok: true, sub: violence },
    { id: 'read', label: 'Read', ok: true },
    ...(hurtNow(state, them) ? [{ id: 'aid', label: 'First aid', ok: true }] : []),
  ];
}

/** Whether there's something for first aid to do for them: bleeding, a break, down. */
function hurtNow(state, them) {
  const p = them.who && state.people[them.who];
  return !!p && !p.dead && (bleeding(p, state.time.ms) || ['armL', 'armR', 'legL', 'legR'].some(k => stateOf(p, k) === 'out') || !canStand(p));
}

/** Make sure they have a sheet in state.people (a passer-by is made one from their seed: kept from now on). */
function person(state, them) {
  if (them.who) return state.people[them.who];
  const p = passerby(them.seed, state.map.city);
  p.known = false; p.seen = describe(p.look, p.sex);                // (a stranger: their name's not ours to know)
  p.items = armsOf(them.seed, p.sex);                                // (what they carry, if anything: sim/items.js)
  state.people[p.id] ??= p;
  them.who = p.id;
  return p;
}

/** Do it: 'talk', 'read', or an opening of VIOLENCE ('hit', 'sucker', 'push', 'grab'). Returns what to show (read: the sheet). */
export function act(state, bus, id, them) {
  const me = playerOf(state);
  if (!me || !them || state.fight) return null;
  const p = person(state, them), name = shortName(state, them.who);
  if (id === 'talk') { beginTalk(state, bus, them); return { show: 'talk' }; }
  if (id === 'aid') return { show: 'aid', who: them.who };
  if (id === 'read') {
    const { roll, k } = read(state, me, them);
    say(state, bus, { kind: 'roll', roll, text: roll.ok ? `You size up ${name}: the build, the hands, the eyes.` : `You look ${name} over, and can't make up your mind.` });
    return { show: 'read', who: them.who, k };
  }
  const mine = state.people[state.player];
  if (!OPENINGS.includes(id) || (id === 'stab' && !wielded(mine)?.edge) || (id === 'grab' && (skill(mine, 'cqc') < GRAB_CQC || !canGrabWith(wielded(mine))))) return null;
  // The opening: the fight's first exchange, ours; them caught open if they didn't see it coming.
  const f = beginFight(state, bus, them, { style: 'even', owner: 'street' });
  f.opening = id;
  let open = !seesUs(state, them);
  if (id === 'sucker' && !open) {
    const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] }, { skill: 'awareness', value: skill(p, 'awareness'), body: p });
    open = r.ok;
    if (!r.ok) say(state, bus, { kind: 'roll', roll: r, text: `${cap(name)} sees it coming.` });
  }
  if (open) { f.theirs = { move: 'open', spend: false }; f.read = true; }
  if (id === 'sucker' && open) f.adv.a = 1;                            // (all your weight behind it: an edge, spent)
  const move = id === 'push' || id === 'grab' ? 'grapple' : 'hit';
  exchange(state, bus, { move, spend: id === 'sucker' && open, tech: id === 'push' ? 'shove' : id === 'stab' ? 'stab' : undefined }, null);
  return { show: null };
}

// A street fight's own end of things: after each exchange, do they fight on? At the end, what's seen.
owners.street = {
  onExchange(state, bus, out) {
    const f = state.fight, p = state.people[f.b];
    if (f.ended) return;
    // (nerve: a civilian hurt, or outclassed, or both, runs; a trained one rarely)
    const hurt = out.dmg && out.by === 'a', outclassed = skill(state.people[state.player], 'cqc') - skill(p, 'cqc');
    const flee = ((p.cls === 'civilian' ? 0.25 : 0.05) + (hurt ? 0.3 : 0) + Math.max(0, outclassed) * 0.03 + (out.status.b ? 0.15 : 0)) * (p.hand ? 0.35 : 1);   // (a blade in the hand: they fight)
    if (chance(state.rng, Math.min(0.9, flee))) f.ended = { by: 'a', why: 'fled' };
  },
  onFightEnd(state, bus, f) {
    const them = state.actors.find(a => a.who === f.b), p = state.people[f.b], name = shortName(state, f.b);
    fought(state, f.b, f.ended.by === 'a');
    nudge(p, 'fear', 3, state.time.ms); nudge(p, 'affinity', -2, state.time.ms);   // (they'll remember you)
    if (them && p.dead) say(state, bus, { kind: 'note', text: `${cap(name)} lies where ${p.sex === 'f' ? 'she' : 'he'} fell, and doesn't breathe.` });
    else if (them && (stateOf(p, 'head') === 'out' || stateOf(p, 'torso') === 'out' || !canStand(p))) {
      if (them?.ai) them.ai.downUntil = state.time.ms + DOWN_S * 1000;
      say(state, bus, { kind: 'note', text: `${cap(name)} lies where ${p.sex === 'f' ? 'she' : 'he'} fell.` });
    } else if ((f.ended.why === 'fled' || f.ended.why === 'broken') && them) {
      run(state, them);
      say(state, bus, { kind: 'note', text: pick(state.rng, [`${cap(name)} backs off, then runs.`, `${cap(name)} has had enough, and goes, fast.`, `${cap(name)} turns and runs.`]) });
    }
    // Whoever saw it.
    const me = playerOf(state), saw = state.actors.filter(a => a !== me && a !== them && !a.hidden && Math.hypot(a.x - me.x, a.z - me.z) < WITNESS_M && seesActor(state, a, me)).length;
    if (saw && state.legend) {
      addHeat(state, Math.min(WITNESS_MAX, saw) * WITNESS_HEAT * (p.dead ? KILL_HEAT_K : 1));
      say(state, bus, { kind: 'note', text: p.dead ? (saw > 1 ? 'Someone screams. People are running, some away, some to phones.' : 'Someone saw it: a face at a window, gone.') : saw > 2 ? 'People stopped to watch. Someone is already on a phone.' : 'Someone saw that.' });
    }
  },
};

/** Off they go, quick, along the street away from you. */
function run(state, a) {
  const me = playerOf(state), dir = Math.sign(a.x - me.x) || 1, row = rowOf(state, a);
  a.ai.plan = { kind: 'way', from: { row, x: a.x, z: a.z }, to: { row, x: a.x + dir * 120, z: a.z < 0 ? LINE.F : LINE.N } };
  Object.assign(a.ai, { route: null, $route: null, s: 0, stop: 0, wait: 0, pace: 1.9 });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
