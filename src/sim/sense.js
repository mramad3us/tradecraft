// TRADECRAFT sim: the feel (the user, 2026-10-31: "Tradecraft and other skills like tracking should give us
// some sort of instinct that allows us to 'feel' when we're being watched (to an extent, dice rolls) giving us
// a sort of intuition materialized by seeing what we're not looking at (reveal part of the map in our blind
// spots). The same logic should show us where whoever we're tailing has gone to. It so that some operative
// with 80 tradecraft+ is sort of a super officer capable of tailing from insane distances with zero chances
// of being made in effect, while being almost impossible to tail without them knowing."). The engine's: a
// scene says who's watching (scenario.eyesOn(state)) and whom you're after (scenario.quarry(state)).
//
// **The dice.** A check, not an opposed roll, with the over-skill on top of what it already multiplies:
//     d20 + skill + tradecraftMod(os)     tradecraftMod = os² / 400: 30 → 2, 40 → 4, 60 → 9, 80 → 16, 95 → 23
//   - **Eyes on you**, every EYES_EVERY_S, for each of those with you in their sight, whether or not you can
//     see them: Awareness against EYES_DC + their Deception + a point every 8 m. So a Handler (Tradecraft
//     38, Awareness 15) feels an overt pair (Deception 5) about one roll in two, and a covert team (18) only on
//     a natural 20; at 60 a covert team one roll in three; at 80, always, a natural 1 aside.
//   - **Your quarry**, every QUARRY_EVERY_S, whenever your eyes don't have them: Tracking against QUARRY_DC, a
//     point every QUARRY_PER_M metres, more if they're indoors or on another street.
//     So a Handler has a man out of sight 30 m off one roll in three, and one 200 m off never; at 80 and a good
//     base, 120 m off nearly every roll; at 95, 300 m off most rolls.
//   - Neither reaches past feelM(): 12 m + (the total)² / 10, some 45 m for a Handler, 200 at 80, 470 at 95.
//     Stream dice of their own, so nothing else's rolls move; a miss says nothing (we only know what we know).
// **What it comes to.** By the margin (GRADES): a flash of a small patch, a little out, for a few seconds; a
// clear one; or a wide, true one that lasts till the next roll, so that it never lets go. state.mind.felt, by
// actor id: { ox, oz (how far out), r, k, until, why ('eyes' | 'quarry'), grade, ms, path }. sim/perception.js
// lays the patches over what the eyes take in, no wall in the way, so the fog lifts there (src/render/view.js,
// tinted) and whoever's in it is in view, for the rolls as for the screen. Someone felt off the picture, or on
// another street, is a plaque at its edge (src/ui/ui.js), the way they lie. A quarry leaves a dim trail of the
// way they went (path). The scene hears (scenario.onFelt(state, bus, a, roll, grade, why)): being tailed counts
// a face felt beyond doubt as a face that followed (sim/scenarios/sdr.js); the tail takes back the man it lost.
// **A hunch** (hunch()): below FALSE_ALARM_V a nerve can be wrong. Now and then, with nobody on you, a flash
// round some passer-by, worded as the faint real thing: a beginner's feeling is only a feeling.
import { TICK_MS } from './clock.js';
import { skill, CLASSES } from './skills.js';
import { check } from './checks.js';
import { stream, range, chance, pick } from './rng.js';
import { say } from './log.js';
import { eyes, seesActor, visibility, SEEN, wrap } from './perception.js';
import { Z } from './map/street.js';
import { isPasserby } from './crowd.js';
import { near } from './world.js';

export const EYES_EVERY_S = 6, QUARRY_EVERY_S = 4;
export const EYES_DC = 24, EYES_PER_M = 8;
export const QUARRY_DC = 30, QUARRY_PER_M = 8, QUARRY_INDOORS = 3, QUARRY_STREET = 4;
export const FEEL_BASE_M = 12, FEEL_K = 10;
export const TOLD_AGAIN_S = 45;                                    // (the log says so once in a while, not each roll)
export const TRAIL_EVERY_M = 2, TRAIL_MAX = 9;
export const HUNCH_EVERY_S = 40, FALSE_ALARM_V = 30, HUNCH_PER_V = 0.004;
export const ROW_M = Z.edge - Z.north;                             // (from one street's pavement to the next's)
// (margin at least, patch radius m, strength, seconds, how far out m)
export const GRADES = [[10, 6.5, 1, 9, 0], [4, 5, 0.85, 6, 0.6], [0, 3.5, 0.65, 3.5, 1.5]];

/** What Tradecraft adds to the feel, past what it already multiplies. */
export const tradecraftMod = (os = 0) => Math.round(os * os / 400);
/** The feel's value in a skill: the skill, and the over-skill on top (only a class that has one). */
export const feelOf = (p, key) => skill(p, key) + (CLASSES[p.cls]?.overskill ? tradecraftMod(p.os) : 0);
/** How far the feel reaches in a skill, in metres. */
export const feelM = (p, key) => FEEL_BASE_M + feelOf(p, key) ** 2 / FEEL_K;
const modsOf = (p) => (CLASSES[p.cls]?.overskill && tradecraftMod(p.os) ? [{ why: CLASSES[p.cls].overskill, v: tradecraftMod(p.os) }] : []);

/** Whether the player has this actor felt now: their record, or null. */
export const feltOf = (state, id) => { const f = state.mind?.felt?.[id]; return f && f.until >= state.time.ms ? f : null; };

/** What's felt now, for the HUD: [{ id, why, grade, k, x, z, row, a }]. */
// (a voice, a shot, heard from somewhere you can't see: where it came from, felt a few seconds, the fog lifted round it and
// a plaque at the picture's edge if it's off it; the user, 2026-11-04, "who shouts to drop it ? I don't see any police near me")
export const HEARD_S = 5;
/** Actor a heard (a shout, a shot): a felt patch round them for HEARD_S, labelled (the plaque's word: 'Police'). */
export function heardFrom(state, a, label = 'A voice') {
  if (!a || !state.mind) return;
  (state.mind.felt ??= {})[a.id] = { ox: 0, oz: 0, r: 3.5, k: 0.85, until: state.time.ms + HEARD_S * 1000, why: 'heard', grade: 1, ms: state.time.ms, path: [], label };
}

export function feltList(state) {
  const out = [];
  for (const id in state.mind?.felt ?? {}) {
    const f = feltOf(state, id), a = f && state.actors.find(o => o.id === id);
    if (a) out.push({ id, why: f.why, label: f.label, grade: f.grade, k: f.k, x: a.x + f.ox, z: a.z + f.oz, row: a.row ?? state.map.row ?? 0, hidden: !!a.hidden, a });
  }
  return out;
}

// The player's own eyes, without what's felt: whether they'd have this one anyway.
const inOwnEyes = (state, me, a) => !a.hidden && (a.row ?? state.map.row) === (state.map.row ?? 0) && visibility(state, { ...eyes(state, me), felt: null }, a.x, a.z) >= SEEN;

/** Where someone is from you, in words, by the way you're facing. */
export function whereFrom(me, a) {
  const off = Math.abs(wrap(Math.atan2(a.z - me.z, a.x - me.x) - (me.head ?? 0))), side = wrap(Math.atan2(a.z - me.z, a.x - me.x) - (me.head ?? 0)) > 0 ? 'right' : 'left';
  return off > 2.4 ? 'right behind you' : off > 1.4 ? `behind you, to your ${side}` : off > 0.7 ? `off to your ${side}` : 'ahead of you';
}
const LINES = {
  faint: (w) => [`A prickle at the back of your neck: someone, ${w}. Or nobody.`, `Something ${w} you can't put a name to. You don't turn round.`],
  clear: (w) => [`Eyes on you, ${w}. You don't turn your head. You don't need to.`, `Someone has you in their sight, ${w}: you could point to them with your eyes shut.`],
  sure: (w, m) => [`You know where they are the way you know where your own hands are: ${w}, ${m} m, and looking at you.`, `${m} m, ${w}, and they've not looked away. The street's told you everything but their name.`],
};
const QUARRY_LINES = {
  faint: (w) => [`Something tells you ${w}.`, `You couldn't say why, but ${w}.`],
  clear: (w) => [`You don't need to see the way he's gone: ${w}.`, `The street tells you: ${w}.`],
  sure: (w) => [`You could follow him with your eyes shut: ${w}.`, `He's as good as on a string: ${w}.`],
};
const GRADE_WORD = ['faint', 'clear', 'sure'];

/** A hit: the patch laid, the log told (now and then), the scene told. */
function feel(state, bus, me, a, roll, why, scenario) {
  const g = GRADES.findIndex(([m]) => roll.margin >= m), [, r, k, s, err] = GRADES[g < 0 ? GRADES.length - 1 : g], grade = GRADES.length - 1 - (g < 0 ? GRADES.length - 1 : g);
  const F = (state.mind.felt ??= {}), was = F[a.id], now = state.time.ms, dice = stream('sense-out', state.seed, state.tick, a.id);
  const ox = err ? range(dice, -err, err) : 0, oz = err ? range(dice, -err, err) : 0;
  F[a.id] = { ox, oz, r, k, until: now + s * 1000, why, grade, ms: now, path: was?.path ?? [] };
  const told = (state.mind.told ??= {}), key = why === 'eyes' ? 'eyes' : a.id;   // (a team's eyes are told once, not one by one)
  if (now - (told[key] ?? -1e12) >= TOLD_AGAIN_S * 1000) {
    told[key] = now;
    const m = Math.round(Math.hypot(a.x - me.x, a.z - me.z)), w = whereFrom(me, a), word = GRADE_WORD[grade];
    if (why === 'eyes') say(state, bus, { kind: 'roll', roll, text: pick(dice, LINES[word](w, m)) });
    else if ((a.row ?? state.map.row) === state.map.row && !a.hidden) say(state, bus, { kind: 'roll', roll, text: pick(dice, QUARRY_LINES[word](`he's ${m} m off, ${w}`)) });
    else say(state, bus, { kind: 'roll', roll, text: pick(dice, QUARRY_LINES[word](a.hidden ? 'he\'s gone indoors' : `he's a street away, and going on`)) });
  }
  scenario?.onFelt?.(state, bus, a, roll, grade, why);
}

/** Once a second: those with their eyes on you, whoever you're after, and what's felt, kept. The dice have a stream of their own. */
export function senseTick(state, bus, me, scenario) {
  const F = state.mind?.felt, now = state.time.ms;
  for (const id in F ?? {}) if (F[id].until < now) delete F[id];
  const p = me && state.people[me.who];
  if (!p || me.hidden || p.dead || state.fight || state.map.kind !== 'street' || scenario.aware?.(state)) return;
  const R = (state.mind.rolled ??= {}), row = state.map.row ?? 0, due = (id, s) => now - (R[id] ?? -1e12) >= s * 1000;
  const dice = (id) => stream('sense', state.seed, state.tick, id);
  for (const a of scenario.eyesOn?.(state) ?? []) {
    if (!a || a.hidden || (a.row ?? row) !== row || a.who === state.player) continue;
    const d = Math.hypot(a.x - me.x, a.z - me.z), them = state.people[a.who];
    if (!them || d > feelM(p, 'awareness') || !due(a.id, EYES_EVERY_S) || !seesActor(state, a, me)) continue;   // (a look's felt whether or not you can see who's giving it)
    R[a.id] = now;
    const r = check(dice(a.id), { skill: 'awareness', value: skill(p, 'awareness'), body: p, mods: modsOf(p), dc: EYES_DC + skill(them, 'deception') + Math.round(d / EYES_PER_M) });
    if (r.ok) feel(state, bus, me, a, r, 'eyes', scenario);
  }
  for (const a of scenario.quarry?.(state) ?? []) {
    if (!a) continue;
    const rows = Math.abs((a.row ?? row) - row), d = rows * ROW_M + (rows ? Math.abs(a.x - me.x) : Math.hypot(a.x - me.x, a.z - me.z));
    trail(state, a);
    if (d > feelM(p, 'tracking') || !due(a.id, QUARRY_EVERY_S) || inOwnEyes(state, me, a)) continue;
    R[a.id] = now;
    const r = check(dice(a.id), { skill: 'tracking', value: skill(p, 'tracking'), body: p, mods: modsOf(p), dc: QUARRY_DC + Math.round(d / QUARRY_PER_M) + (a.hidden ? QUARRY_INDOORS : 0) + (rows ? QUARRY_STREET : 0) });
    if (r.ok) feel(state, bus, me, a, r, 'quarry', scenario);
  }
  if (state.tick % (HUNCH_EVERY_S * Math.round(1000 / TICK_MS)) === 0) hunch(state, bus, me, p, scenario);
}

// (where a quarry's been, while they're felt: a breadcrumb every TRAIL_EVERY_M on this street)
function trail(state, a) {
  const f = state.mind.felt?.[a.id];
  if (!f || (a.row ?? state.map.row) !== (state.map.row ?? 0)) return;
  const last = f.path.at(-1);
  if (last && Math.hypot(last[0] - a.x, last[1] - a.z) < TRAIL_EVERY_M) return;
  f.path.push([Math.round(a.x * 10) / 10, Math.round(a.z * 10) / 10]);
  if (f.path.length > TRAIL_MAX) f.path.shift();
}

// (a nerve that's wrong now and then: a flash round a passer-by behind you, as faint as a real one)
function hunch(state, bus, me, p, scenario) {
  if (!scenario.eyesOn) return;
  const v = feelOf(p, 'awareness'), dice = stream('hunch', state.seed, state.tick);
  if (v >= FALSE_ALARM_V || !chance(dice, (FALSE_ALARM_V - v) * HUNCH_PER_V)) return;
  if ((scenario.eyesOn(state) ?? []).some(a => a && !a.hidden)) return;
  const by = near(state, me.x, me.z, 22).filter(a => a !== me && isPasserby(a) && !a.hidden && !inOwnEyes(state, me, a));
  if (!by.length) return;
  const a = pick(dice, by), [, r, k, s, err] = GRADES.at(-1);
  (state.mind.felt ??= {})[a.id] = { ox: range(dice, -err, err), oz: range(dice, -err, err), r, k, until: state.time.ms + s * 1000, why: 'eyes', grade: 0, ms: state.time.ms, path: [] };
  say(state, bus, { kind: 'instinct', text: pick(dice, LINES.faint(whereFrom(me, a))) });
}

/** What the feel comes to, for the sheet: its reach, and how often it'd tell you of a team, each way. */
export function feelWords(p) {
  const chanceAt = (v, dc) => { const n = Math.max(1, Math.min(19, 21 - (dc - v))); return n / 20; };
  const word = (x) => (x >= 0.9 ? 'always' : x >= 0.6 ? 'mostly' : x >= 0.3 ? 'often' : x >= 0.1 ? 'sometimes' : 'seldom');
  const eyesV = feelOf(p, 'awareness'), tr = feelOf(p, 'tracking');
  return {
    eyesM: Math.round(feelM(p, 'awareness')), quarryM: Math.round(feelM(p, 'tracking')),
    overt: word(chanceAt(eyesV, EYES_DC + 5 + 2)), covert: word(chanceAt(eyesV, EYES_DC + 18 + 3)), quarry: word(chanceAt(tr, QUARRY_DC + Math.round(60 / QUARRY_PER_M))),
  };
}
