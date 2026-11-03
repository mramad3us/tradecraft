// TRADECRAFT sim: what you can do with someone at hand (F), the engine's, in any scene (the user,
// 2026-10-26: "the interact button F that when close to someone should open the contextual menu to do
// things like TALK, VIOLENCE … READ").
//
// atHand(state) is whoever's within REACH_M, those in front of you first, then the nearest.
// options(state, them) lists what's open, each { id, label, ok, why } (greyed, with why, when not):
//   - TALK: a conversation, time standing still (sim/talk.js; its minigame, and conversation proper,
//     mechanic test 4, come later);
//   - READ: what you make of them (sim/know.js): their sheet as you guess it; and if they're hurt, a look at
//     that (Medicine: sim/diagnosis.js), as first aid's is (FIRST AID, when there's something to do);
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
// Someone on the ground (downed(): out cold, shot, collapsed, tied) gets no openings: what's done to someone who
// can't fight back is something else (the user, 2026-11-03: "violence in that context should be things like 'tie
// down' or other options to kill them with what we have on us (knife is different than gun or bare hands)"): tie
// them up (TIE_S, with their own belt and laces: they stay down till someone frees them), search them (SEARCH_S:
// what they carry, their weapons taken if there's room), or kill them, by what's in your hand: a blade across the
// throat (THROAT_S), a gun to the head (a shot, heard as any shot is), something heavy (BLUDGEON_S), bare hands
// (STRANGLE_S, longer if your CQC roll against STRANGLE_DC fails). Each is done crouched over them, the busy
// plan's time (sim/game.js busy(): moving before it's over and nothing's done), and seen by whoever's looking
// as a fight is (a killing KILL_HEAT_K times the heat). The dead can only be searched.
import { opposed, check } from './checks.js';
import { isGun, armOf, modelOf, ready, fire, moveArm } from './firearms.js';
import { heard } from './shooting.js';
import { kill } from './health.js';
import { spatter } from './blood.js';
import { TICK_MS } from './clock.js';
import { markViolent } from './emergency.js';
import { skill } from './skills.js';
import { chance, pick, hash } from './rng.js';
import { say } from './log.js';
import { passerby, describe } from './people.js';
import { seesActor } from './perception.js';
import { stateOf, canStand, bleeding } from './health.js';
import { addHeat } from './heat.js';
import { begin as beginFight, exchange, owners, shortName } from './fight.js';
import { read, fought } from './know.js';
import { diagnose } from './diagnosis.js';
import { begin as beginTalk } from './talk.js';
import { wielded, canGrabWith, weaponOf } from './weapons.js';
import { armsOf, fits, thingName } from './items.js';
import { nudge } from './people.js';
import { LINE } from './city.js';
import { rowOf } from './agents.js';
import { dayBand } from './thermal.js';

export const REACH_M = 1.8;
export const GRAB_CQC = 9;
export const DOWN_S = 60;
export const WITNESS_M = 25;
export const WITNESS_HEAT = 1;
export const WITNESS_MAX = 6;
export const KILL_HEAT_K = 4;
export const TIE_S = 60, SEARCH_S = 20, THROAT_S = 4, BLUDGEON_S = 8, STRANGLE_S = 150, STRANGLE_DC = 8, STRANGLE_FAIL_K = 1.6;
export const OPENINGS = ['hit', 'sucker', 'push', 'grab', 'stab'];
const OPENING_WORDS = { hit: 'Hit', sucker: 'Sucker punch', push: 'Push', grab: 'Grab', stab: 'Stab' };

const playerOf = (state) => state.actors.find(a => a.who === state.player);

/** Whoever's within reach: in front of you first, then the nearest. */
export function atHand(state) {
  const me = playerOf(state);
  if (!me || state.fight || me.hidden) return null;                // (out of everyone's reach: indoors, in a cab, behind the flat's curtain)
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
  const down = downed(state, them), dead = !!(them.who && state.people[them.who]?.dead);
  return [
    ...(down ? [] : [{ id: 'talk', label: 'Talk', ok: true }]),
    { id: 'violence', label: 'Violence', ok: true, sub: down ? onGround(state, them, me, w, dead) : violence },
    { id: 'read', label: 'Read', ok: true },
    ...(hurtNow(state, them) ? [{ id: 'aid', label: 'First aid', ok: true }] : []),
  ];
}

/** Whether someone's on the ground and can't fight back: dead, down, tied. */
export function downed(state, a) {
  const p = a.who && state.people[a.who];
  return !!(p?.dead || a.ai?.tied || a.gait === 'down' || (a.ai?.downUntil ?? 0) > state.time.ms || (p && !canStand(p)));
}

/** What's done to someone on the ground: tie, search, kill by what's in your hand. */
function onGround(state, them, me, w, dead) {
  const p = them.who && state.people[them.who], gun = isGun(me.hand), g = gun && armOf(me, me.hand), M = gun && modelOf(me.hand);
  const how = gun ? { id: 'kill', label: `A shot to the head, point blank (${M.short})`, ok: ready(g, M), why: ready(g, M) ? 'loud: a gunshot is heard' : 'it isn\'t ready to fire' }
    : w?.edge ? { id: 'kill', label: `${cap(w.name.replace(/^(a|an) /, 'the '))} across the throat`, ok: true }
    : w ? { id: 'kill', label: `Beat their head in with ${w.name.replace(/^(a|an|half a) /, 'the ')}`, ok: true }
    : { id: 'kill', label: 'Strangle them (minutes, and a CQC roll)', ok: true };
  if (dead) return [{ id: 'search', label: 'Search the body', ok: true }];
  return [
    { id: 'tie', label: 'Tie them up: their belt, their laces', ok: !them.ai?.tied, why: them.ai?.tied ? 'tied already' : null },
    { id: 'search', label: 'Search them', ok: true },
    how,
  ];
}

/** Whether there's something for first aid to do for them: bleeding, a break, down. */
function hurtNow(state, them) {
  const p = them.who && state.people[them.who];
  return !!p && !p.dead && (bleeding(p, state.time.ms) || ['armL', 'armR', 'legL', 'legR'].some(k => stateOf(p, k) === 'out') || !canStand(p));
}

/** Make sure they have a sheet in state.people (a passer-by is made one from their seed: kept from now on). */
export function person(state, them) {
  if (them.who) return state.people[them.who];
  const p = passerby(them.seed, state.map.city, dayBand(state));   // (as they're dressed today: sim/thermal.js)
  p.known = false; p.seen = describe(p.look, p.sex);                // (a stranger: their name's not ours to know)
  p.items = armsOf(them.seed, p.sex);                                // (what they carry, if anything: sim/items.js)
  state.people[p.id] ??= p;
  them.who = p.id;
  return p;
}

/** Do it: 'talk', 'read', or an opening of VIOLENCE ('hit', 'sucker', 'push', 'grab'). Returns what to show (read: the sheet). */
export function act(state, bus, id, them) {
  const me = playerOf(state);
  if (!me || !them || state.fight || me.hidden) return null;
  const p = person(state, them), name = shortName(state, them.who);
  if (id === 'talk') { beginTalk(state, bus, them); return { show: 'talk' }; }
  if (id === 'aid') { diagnose(state, bus, me, them); return { show: 'aid', who: them.who }; }   // (a look first: what it finds, the card shows, sim/diagnosis.js)
  if (id === 'read') {
    const { roll, k } = read(state, me, them);
    say(state, bus, { kind: 'roll', roll, text: roll.ok ? `You size up ${name}: the build, the hands, the eyes.` : `You look ${name} over, and can't make up your mind.` });
    diagnose(state, bus, me, them);                                  // (and if they're hurt, a look at that: Medicine)
    return { show: 'read', who: them.who, k };
  }
  const mine = state.people[state.player];
  // (someone on the ground: tied, searched or killed, crouched over them a while: done when the time's up, sim/game.js)
  if (['tie', 'search', 'kill'].includes(id)) {
    if (!downed(state, them) || (id !== 'search' && p.dead)) return null;
    const o = onGround(state, them, mine, wielded(mine), !!p.dead).find(x => x.id === id);
    if (!o?.ok) return null;
    const w = wielded(mine), gun = isGun(mine.hand);
    const strangle = id === 'kill' && !gun && !w;
    const r = strangle ? check(state.rng, { skill: 'cqc', value: skill(mine, 'cqc'), dc: STRANGLE_DC, body: mine }) : null;
    const s = id === 'tie' ? TIE_S : id === 'search' ? SEARCH_S : gun ? 1 : w?.edge ? THROAT_S : w ? BLUDGEON_S : STRANGLE_S * (r.ok ? 1 : STRANGLE_FAIL_K);
    me.busy = { what: `downed:${id}`, steps: [['wait', Math.round(s * 1000 / TICK_MS), me.face, 'crouch']], wait: 0, done: `downed:${id}:${them.id}`, since: state.time.ms };
    me.vx = me.vz = 0;
    const words = { tie: `You kneel by ${name}, and pull their belt free.`, search: `You go through ${name}'s pockets.`, kill: gun ? `The muzzle to ${name}'s head.` : w?.edge ? `You kneel by ${name}.` : w ? `You stand over ${name}.` : `Your hands round ${name}'s throat.` }[id];
    say(state, bus, r ? { kind: 'roll', roll: r, text: r.ok ? `${words} It'll take a couple of minutes.` : `${words} You can't get your grip right: it's taking too long.` } : { kind: 'note', text: words });
    return { show: null };
  }
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
    // Whoever saw it (and will describe you, when it's called in: sim/emergency.js).
    markViolent(state, playerOf(state));
    const me = playerOf(state), saw = state.actors.filter(a => a !== me && a !== them && !a.hidden && Math.hypot(a.x - me.x, a.z - me.z) < WITNESS_M && seesActor(state, a, me)).length;
    if (saw && state.legend) {
      addHeat(state, Math.min(WITNESS_MAX, saw) * WITNESS_HEAT * (p.dead ? KILL_HEAT_K : 1));
      say(state, bus, { kind: 'note', text: p.dead ? (saw > 1 ? 'Someone screams. People are running, some away, some to phones.' : 'Someone saw it: a face at a window, gone.') : saw > 2 ? 'People stopped to watch. Someone is already on a phone.' : 'Someone saw that.' });
    }
  },
};

/**
 * What was being done to someone on the ground, its time up ('downed:<what>:<their actor id>', sim/game.js busy()):
 * tied, searched, killed. Whoever saw it, as a fight's seen.
 */
export function finishDowned(state, bus, me, key) {
  const [, what, id] = key.split(':'), them = state.actors.find(a => a.id === id), p = them && state.people[them.who], mine = state.people[me.who];
  if (!them || !p || !mine) return;
  const name = shortName(state, them.who), ms = state.time.ms;
  if (what === 'tie') {
    them.ai && (them.ai.tied = ms);
    p.tied = ms;
    say(state, bus, { kind: 'note', text: `${cap(name)}: wrists behind, the belt round them, the laces round the ankles. Nobody's going anywhere for a while.` });
  } else if (what === 'search') {
    const found = [p.hand, ...(p.items ?? [])].filter(Boolean), took = [];
    for (const k of found) if (weaponOf(k) && fits(mine, k)) { if (p.hand === k) p.hand = null; p.items = (p.items ?? []).filter(x => x !== k); (mine.items ??= []).push(k); if (p.arms?.[k]) moveArm(p, mine, k); took.push(k); }
    const rest = found.filter(k => !took.includes(k));
    say(state, bus, { kind: 'note', text: found.length ? `On ${name}: ${found.map(k => thingName(k)).join(', ')}.${took.length ? ` You take ${took.map(k => thingName(k)).join(', ')}.` : ''}${rest.length && !took.length ? ' Nothing worth the room in your pockets.' : ''}` : `${cap(name)}'s pockets: keys, a phone with a cracked screen, receipts. Nothing.` });
  } else if (what === 'kill' && !p.dead) {
    const gun = isGun(mine.hand), w = wielded(mine);
    if (gun) {
      const f = fire(state.rng, mine, mine.hand);
      if (!f.fired) { say(state, bus, { kind: 'note', text: 'Click. It doesn\'t go off.' }); return; }
      heard(state, bus, me, me.x, me.z, modelOf(mine.hand).loud); me.$shot = ms;
      kill(p, ms, 'shot in the head, point blank');
    } else kill(p, ms, w?.edge ? 'a cut throat' : w ? 'beaten to death' : 'strangled');
    spatter(state, them.x, them.z, 0, gun || w?.edge ? 12 : w ? 6 : 0);
    them.gait = 'down'; if (them.ai) them.ai.downUntil = Infinity;
    say(state, bus, { kind: 'note', text: `${cap(name)} is dead.` });
  }
  const saw = state.actors.filter(a => a !== me && a !== them && !a.hidden && Math.hypot(a.x - me.x, a.z - me.z) < WITNESS_M && seesActor(state, a, me)).length;
  if (what !== 'search') markViolent(state, me);                    // (seen at it: described when it's called in, sim/emergency.js)
  if (saw && state.legend && what !== 'search') {
    addHeat(state, Math.min(WITNESS_MAX, saw) * WITNESS_HEAT * (what === 'kill' ? KILL_HEAT_K : 1));
    say(state, bus, { kind: 'note', text: what === 'kill' ? 'Someone saw. A scream, and running feet.' : 'Someone saw you at it, and hurries off.' });
  }
}

/** Off they go, quick, along the street away from you. */
function run(state, a) {
  const me = playerOf(state), dir = Math.sign(a.x - me.x) || 1, row = rowOf(state, a);
  a.ai.plan = { kind: 'way', from: { row, x: a.x, z: a.z }, to: { row, x: a.x + dir * 120, z: a.z < 0 ? LINE.F : LINE.N } };
  Object.assign(a.ai, { route: null, $route: null, s: 0, stop: 0, wait: 0, pace: 1.9 });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
