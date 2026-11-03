// TRADECRAFT sim: shooting, in stop motion (the user, 2026-11-03: "Shooting is going to be integrated in a
// stop motion way, heavily relying on the weapons skill … time stops while we get the weapon ready
// (unholster, load if needed, remove safety, aim etc), each step to ready a weapon has to be acted on by the
// player and will have time move forward as we do … Shooting mode is going to be a very specific mode
// explicitly entered and should only stop time if we're trying to shoot"). The guns themselves are
// sim/firearms.js.
//
// **The mode** (state.shoot: { phase, gun, pick, part, aim, doing }): entered on purpose (X), left the same
// way. In it, time stands still while you choose (phase 'choose': sim/game.js stops the tick, as a fight's
// choice does), and each step chosen (options(): the gun drawn from where it's carried, the safety off, a
// round chambered, a magazine in, the jam cleared, the aim, the shot) plays out in the world for its time
// (phase 'act', doing.until), your feet held, everyone else going about it; then it stands still again. The
// step's time and its roll are the gun's (firearms.js act()); what it moves (the gun to the hand, a
// magazine to the ground) is moved here as it ends.
//
// **The aim** (aimMs()): at someone, or at a thing lying about, picked with the move keys (left and right:
// the next one across the picture; up and down: the head, the body, the legs). From where you face, a
// sight picture (AIM.sight × the pace) and the turn: AIM.turn degrees a second, faster with the skill, and
// past the arms' arc (AIM.arc, wider with the skill) the feet have to come round too (AIM.feet). So a target
// behind you takes a Handler two seconds and more, a master one. Held on them, the aim follows them as they
// move; the longer it's held, the steadier (HELD a second, up to HELD_MAX); fired from where you face with
// no aim, no shot at anything (the user, 2026-11-03: "if you're not aiming you can't shoot"): Fire waits on an aim.
//
// **The shot** (shot()): the gun's trigger (firearms.js fire(): a click, a dud, a stoppage); fired, a roll of
// Weapon handling against the distance (SHOT.dc + the kind's perM a metre and perM2 its square, × the gun's acc: a
// rifle reaches far, a shotgun's spread helps close), the part aimed at
// (PART_DC), the target's movement, the light on them, the aim held, your body; then TRIGGER_S and the
// recoil's recovery (RECOVER_S × the gun's recoil × the pace) before the next. A hit lands where it was
// aimed (bullet(): BULLET points × the calibre, the gun; a wound that bleeds deep, sim/health.js injure();
// to the head, HEAD_KILL of the time, dead); a miss goes on, and may find someone behind (STRAY).
// **A gunshot is heard** (heard()): passers-by within HEAR_M run from it, the way away from it; in the
// campaign, a shooting in the street is heat (SHOT_HEAT, once a minute).
import { CALIBRES, KINDS, armOf, modelOf, kindOf, isGun, act as gunAct, fire, canDo, labelOf, baseOf, pace, ready, stepMs, AUTO_ROUNDS } from './firearms.js';
import { placed, drop, lyingAbout, thingName } from './items.js';
import { shortName } from './fight.js';
import { passerby, describe } from './people.js';
import { dayBand } from './thermal.js';
import { skill } from './skills.js';
import { check } from './checks.js';
import { range, chance, pick } from './rng.js';
import { say } from './log.js';
import { inView, eyes, sees, wrap, faceOf, lightHere } from './perception.js';
import { lightBand } from './light.js';
import { hurt, injure, takes, kill, canStand } from './health.js';
import { spatter } from './blood.js';
import { isPasserby } from './crowd.js';
import { rowOf } from './agents.js';
import { LINE } from './city.js';
import { weaponOf } from './weapons.js';
import { person } from './interact.js';
import { addHeat } from './heat.js';
import { TICK_MS } from './clock.js';

export const AIM = { sight: 0.6, turn: { base: 90, per: 6 }, arc: { base: 30, per: 2, max: 100 }, feet: 0.4 };
export const HELD = 3, HELD_MAX = 4;                              // (DC off a second the aim's held, at most)
export const TRIGGER_S = 0.15, RECOVER_S = 0.35;
export const SHOT = { dc: 6 };                                    // (and the kind's DC by the metre and the metre's square: sim/firearms.js KINDS; a pistol's gets hard fast past 15 m)
export const BURST_K = 2, BURST_GAP_S = 0.1;                       // (each round of a burst after the first: its DC off, × the recoil; the time between)
export const PART_DC = { torso: 0, head: 6, legs: 3 };
export const PARTS = ['head', 'torso', 'legs'];
export const MAX_M = 60;
export const BULLET = 7, HEAD_KILL = 0.6, HEAD_GRAZE = 0.3, DAZE_S = 25, BRAIN_BLEED = 1.2;
// Shot, and down (the user, 2026-11-03: "both these NPCs just got up after a minute after I shot them"): hit in the
// body, someone goes down and stays down SHOT_DOWN_MIN minutes, shock and the pain (the trained, TOUGH of that); a
// bullet in the chest bleeds inside too, CHEST_BLEED of the blood a minute for CHEST_BLEED_H, past first aid.
export const SHOT_DOWN_MIN = { torso: [10, 40], leg: [1, 4] }, TOUGH = 0.25, CHEST_BLEED = 0.25, CHEST_BLEED_H = 3;   // (a bullet in the skull: % of the blood a minute, inside, past first aid)
export const STRAY = { widthM: 0.7, rangeM: 80, hit: 0.25 };
export const HEAR_M = 70, SHOT_HEAT = 8;
// A fumbled gun going off (firearms.js act()'s 'discharge'): where it pointed, give or take DISCHARGE_SPREAD (radians);
// drawing or holstering, SELF_SHOT of the time into your own leg; who's in its line, STRAY's, DISCHARGE_HIT of the time.
export const DISCHARGE_SPREAD = 0.5, SELF_SHOT = { draw: 0.35, holster: 0.45 }, DISCHARGE_HIT = 0.6;
// Muzzle discipline (the user, 2026-11-03: "high weapons skill should at least protect in ways of muzzle discipline
// allowing us not to shoot some random civilian in the head"): a gun that goes off in a trained hand was pointed
// somewhere safe, down and away, MUZZLE's share of the time by Weapon handling (none untrained, nearly always a master).
export const MUZZLE = { from: 4, to: 28, max: 0.97 };
export const muzzleSafe = (p) => Math.max(0, Math.min(MUZZLE.max, (skill(p, 'weapons') - MUZZLE.from) / (MUZZLE.to - MUZZLE.from)));
// A decocked gun's first pull (sim/firearms.js decocker): longer, and a little off.
export const DA_S = 0.15, DA_MOD = -1;
const OUT_MS = 60000;

const playerOf = (state) => state.actors.find(a => a.who === state.player);
/** The guns someone has: in hand, or carried (by where: a SPACES id). */
export function gunsOf(p) {
  const out = [];
  if (isGun(p?.hand)) out.push({ id: p.hand, where: 'hand' });
  for (const o of placed(p).out) if (isGun(o.kind)) out.push({ id: o.kind, where: o.at ?? 'bag' });
  for (const x of p?.bag ?? []) if (isGun(x.item)) out.push({ id: x.item, where: 'bag' });
  return out;
}

/** Into the mode (X), or out of it. A line for the log when it can't be. */
export function toggle(state, bus) {
  const me = playerOf(state), p = me && state.people[me.who];
  if (state.shoot) { if (state.shoot.phase === 'choose') { state.shoot = null; say(state, bus, { kind: 'note', text: 'You let the moment go.' }); } return; }
  if (!me || !p || state.fight || state.talk || me.cab || me.hidden) return;
  const guns = gunsOf(p);
  if (!guns.length) { say(state, bus, { kind: 'note', text: 'You\'ve no gun.' }); return; }
  state.shoot = { phase: 'choose', gun: guns[0].id, pick: null, part: 'torso', aim: null, doing: null };
  const t = targets(state, me);
  state.shoot.pick = t.length ? t.reduce((b, o) => (Math.abs(o.off) < Math.abs(b.off) ? o : b)).key : null;   // (whoever's most in front of you)
}

/** What can be aimed at: people in view, and things lying about in view, within MAX_M: [{ key, x, z, name, d, off (radians from your facing) }], left to right. */
export function targets(state, me) {
  const out = [], row = state.map.row ?? 0, e = eyes(state, me);
  const far = kindOf(state.shoot?.gun)?.maxM ?? MAX_M;
  const add = (key, x, z, name) => { const d = Math.hypot(x - me.x, z - me.z); if (d > 0.4 && d <= far) out.push({ key, x, z, name, d, off: wrap(Math.atan2(z - me.z, x - me.x) - (me.head ?? 0)) }); };
  for (const a of state.actors) if (a !== me && !a.hidden && rowOf(state, a) === row && inView(state, a.id)) add(a.id, a.x, a.z, null);
  for (const it of lyingAbout(state)) if (Math.hypot(it.x - me.x, it.z - me.z) <= 30 && sees(state, e, it.x, it.z)) add(`item:${it.id}`, it.x, it.z, thingName(it.kind, it.n));
  return out.sort((p, q) => p.x - q.x || p.z - q.z);
}
const targetOf = (state, key) => {
  if (!key) return null;
  if (key.startsWith('item:')) { const it = lyingAbout(state).find(o => o.id === key.slice(5)); return it && { key, x: it.x, z: it.z, item: it }; }
  const a = state.actors.find(o => o.id === key);
  return a && !a.hidden && { key, x: a.x, z: a.z, a };
};

/** How long an aim at (x, z) takes from where you face, in ms, and its turn (radians). */
export function aimMs(p, me, x, z, id = null) {
  const v = skill(p, 'weapons'), off = Math.abs(wrap(Math.atan2(z - me.z, x - me.x) - (me.head ?? 0))) * 180 / Math.PI, K = kindOf(id) ?? KINDS.pistol;
  const arc = Math.min(AIM.arc.max, AIM.arc.base + AIM.arc.per * v);
  const s = AIM.sight * pace(p) * K.sight + off / ((AIM.turn.base + AIM.turn.per * v) * K.turn) + (off > arc ? AIM.feet * pace(p) : 0);   // (a long gun's sight picture slower, and it comes round slower)
  return Math.round(s * 1000);
}

/** The shot's odds now at the picked target (0–1), and its DC and modifiers (the panel shows them). */
export function odds(state, me, p, key = state.shoot?.pick, part = state.shoot?.part ?? 'torso') {
  const T = targetOf(state, key), id = state.shoot?.gun;
  if (!T || !id) return null;
  const M = modelOf(id), K = kindOf(id), d = Math.hypot(T.x - me.x, T.z - me.z), mods = [];
  const aim = state.shoot?.aim;
  if (aim?.key === key && aim.settled !== undefined) { const held = (state.time.ms - aim.settled) / 1000; mods.push(held >= 0 ? { why: 'the aim held', v: Math.round(Math.min(HELD_MAX, held * HELD)) } : { why: 'still coming down from the last', v: -2 }); }
  if ((state.$shotAtMs ?? -1e9) > state.time.ms - 5000) mods.push({ why: 'being shot at', v: -4 });
  const o = shotOf(state, M, K, d, T, part, mods);
  const need = o.dc - skill(p, 'weapons') - o.mods.reduce((s, m) => s + m.v, 0);
  return { d, dc: o.dc, mods: o.mods, p: Math.max(0.05, Math.min(0.95, (21 - need) / 20)) };
}

/** A shot's DC and the moment's modifiers at a target T ({ x, z, a?, item? }) d away: its movement, the light on it, a shotgun's spread close, the part; mods: the shooter's own (the aim). */
function shotOf(state, M, K, d, T, part, mods = []) {
  const out = [...mods], sp = T.a ? Math.hypot(T.a.vx ?? 0, T.a.vz ?? 0) : 0;
  if (sp > 2.5) out.push({ why: 'running', v: -5 }); else if (sp > 0.3) out.push({ why: 'walking', v: -2 });
  const band = lightBand(lightHere(state, T.x, T.z));
  if (band === 'dark') out.push({ why: 'the dark', v: -4 }); else if (band === 'dim') out.push({ why: 'poor light', v: -2 });
  if (K.close && d <= K.closeM) out.push({ why: 'the spread of the shot', v: -K.close });
  return { dc: Math.round(SHOT.dc + (d * K.perM + d * d * K.perM2) * M.acc + (T.item ? 4 : PART_DC[part] ?? 0)), mods: out.filter(m => m.v) };
}

/**
 * Someone else's trigger pulled at a (the player, or anyone), the aim held heldS (sim/armed.js): the rounds the
 * selector sends, each a roll of their Weapon handling at your odds' DC; a hit's a bullet (bullet()). Returns the
 * time it took, the recovery with it (ms). The player's "being shot at" from now (state.$shotAtMs).
 */
export function npcShot(state, bus, a, p, id, target, heldS = 0) {
  const M = modelOf(id), K = kindOf(id), g = armOf(p, id), n = roundsOf(g, M), d = Math.hypot(target.x - a.x, target.z - a.z);
  let fired = 0, hits = 0, last = null, f = null;
  for (let k = 0; k < n; k++) {
    f = fire(state.rng, p, id);
    if (!f.fired) break;
    if (!fired) { heard(state, bus, a, a.x, a.z, M.loud); a.$shot = state.time.ms; }   // (the muzzle's flash: src/art)
    fired++;
    const o = shotOf(state, M, K, d, { x: target.x, z: target.z, a: target }, 'torso', [{ why: 'the aim held', v: Math.round(Math.min(HELD_MAX, Math.max(0, heldS) * HELD)) }, k ? { why: 'the muzzle climbing', v: -Math.round(BURST_K * k * M.recoil) } : { v: 0 }]);
    const roll = check(state.rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: o.dc, mods: o.mods, body: p });
    if (roll.ok) { hits++; last = bullet(state, bus, target, 'torso', M, a); }
    if (f.stoppage || f.empty || state.people[target.who]?.dead) break;
  }
  if (target.who === state.player) state.$shotAtMs = state.time.ms;
  const who = cap(p.known === false ? p.seen ?? p.name ?? 'someone' : p.name ?? 'someone');
  if (fired) say(state, bus, { kind: 'note', text: `${who} fires${fired > 1 ? `, ${fired} rounds` : ''}. ${hits ? last : 'Wide.'}` });
  return fired ? fireMs(p, M, fired) : 400;
}

/**
 * What can be done now ([{ key, label, ms, off? }]): the gun drawn (from where it's carried), or what its
 * state allows (firearms.js canDo()), the aim at the picked target, the trigger, put away.
 */
export function options(state) {
  const sh = state.shoot, me = playerOf(state), p = me && state.people[me.who];
  if (!sh || !p) return [];
  const g = gunsOf(p).find(o => o.id === sh.gun) ?? gunsOf(p)[0];
  if (!g) return [];
  const eta = (a, from) => stepMs(p, g.id, a, from);
  if (g.where !== 'hand') return [{ key: 'draw', label: `Draw ${modelOf(g.id).short}`, ms: eta('draw', g.where) }];
  // (Aim…: what to aim at, a list, each its time from where you face; the user, 2026-11-03: "there should be a 'aim'
  // action before shoot, which should take time, which should ask at what we want to aim at")
  if (sh.menu === 'aim') {
    const list = targets(state, me).sort((a, b) => Math.abs(a.off) - Math.abs(b.off) || a.d - b.d).slice(0, AIM_LIST);
    return [...list.map(t => ({ key: `aim:${t.key}`, label: `${cap(nameOf(state, t))} · ${Math.round(t.d)} m, ${sideOf(t.off)}${sh.aim?.key === t.key ? ' (aimed)' : ''}`, ms: aimMs(p, me, t.x, t.z, g.id), at: t.key })),
      { key: 'back', label: 'Back', ms: null }];
  }
  const out = [];
  const gun = armOf(p, g.id), M = modelOf(g.id), A = sh.aim && targetOf(state, sh.aim.key);
  const n = roundsOf(gun, M);
  out.push({ key: 'fire', label: `${n > 1 ? `Fire a burst of ${n}` : 'Fire'}${A ? ` at ${nameOf(state, A)}` : ''}`, ms: fireMs(p, M, n) + (M.decocker && !gun.cocked ? DA_S * 1000 : 0), off: !A ? 'aim first' : !ready(gun, M) ? notReady(gun, M) : null });
  out.push({ key: 'aim', label: A ? 'Aim at something else…' : 'Aim…', ms: null });
  for (const a of canDo(p, g.id, 'hand')) out.push({ key: a, label: a === 'safety' ? (gun.safety ? 'Safety off' : 'Safety on') : a === 'selector' ? `Selector to ${nextMode(gun, M)}` : labelOf(g.id, a), ms: eta(a) });
  return out;
}
const AIM_LIST = 7;
/** What a target's called, as you see them: their name if you know it, their look if not, a thing's name. */
export function nameOf(state, T) {
  if (T.item) return thingName(T.item.kind, T.item.n);
  if (String(T.key).startsWith('item:')) return T.name ?? 'something';
  const a = T.a ?? state.actors.find(o => o.id === T.key);
  if (!a) return 'it';
  if (a.who) return shortName(state, a.who);
  const sh = state.shoot, k = a.seed;
  if (sh) { sh.$names ??= {}; if (sh.$names[k]) return sh.$names[k]; }
  const q = passerby(a.seed, state.map.city, dayBand(state)), word = describe(q.look, q.sex);
  if (sh) sh.$names[k] = word;
  return word;
}
/** Where off your facing: ahead, so many degrees left or right, behind you. */
const sideOf = (off) => { const d = Math.round(Math.abs(off) * 180 / Math.PI / 5) * 5; return d <= 10 ? 'ahead' : d >= 150 ? 'behind you' : `${d}° ${off > 0 ? 'right' : 'left'}`; };
const notReady = (g, M) => (M.safety === 'manual' && g.safety ? 'the safety\'s on' : M.safety === 'selector' && g.mode === 'safe' ? 'on safe' : M.feed === 'cylinder' ? (g.open ? 'the cylinder\'s open' : 'empty') : g.jam ? 'jammed' : g.chamber === 'dud' ? 'a dud in it' : g.chamber === 'case' ? (M.feed === 'tube' ? 'it wants working' : 'a stoppage') : !g.chamber ? 'nothing in the chamber' : g.cond < 0.25 ? 'it wants servicing' : null);
/** How many rounds a pull sends, by the selector (a burst's, a short burst on auto). */
export const roundsOf = (g, M) => (M.safety === 'selector' ? (g.mode === 'auto' ? AUTO_ROUNDS : g.mode === 'burst' ? M.burst ?? 3 : 1) : 1);
const nextMode = (g, M) => { const ring = ['safe', ...M.modes]; return ring[(ring.indexOf(g.mode) + 1) % ring.length]; };
/** A pull's time: the trigger, the rounds of a burst, and the recoil's recovery after. */
const fireMs = (p, M, n = 1) => Math.round((TRIGGER_S + (n - 1) * BURST_GAP_S + RECOVER_S * M.recoil * pace(p) * (1 + 0.3 * (n - 1))) * 1000);

/**
 * A step chosen ('shoot:<key>', or the move keys' 'shoot:pick:±1' and 'shoot:part:±1', which take no time).
 * Its time starts: the world runs for it (phase 'act'), and it ends in tick().
 */
export function choose(state, bus, key) {
  const sh = state.shoot, me = playerOf(state), p = me && state.people[me.who];
  if (!sh || !p || sh.phase !== 'choose') return false;
  const [k, arg] = key.split(':');
  if (k === 'pick') {                                               // (the next target across the picture, in the aim list)
    sh.menu = 'aim';
    const t = targets(state, me);
    if (!t.length) return true;
    const i = t.findIndex(o => o.key === sh.pick), n = Number(arg) || 1;
    sh.pick = t[(i < 0 ? 0 : i + n + t.length) % t.length].key;
    return true;
  }
  if (k === 'part') { sh.part = PARTS[Math.max(0, Math.min(PARTS.length - 1, PARTS.indexOf(sh.part) + (Number(arg) || 0)))]; return true; }
  if (k === 'aim' && !arg) { sh.menu = 'aim'; return true; }        // (the list: no time, the clock stood still)
  if (k === 'back') { sh.menu = null; return true; }
  const g = gunsOf(p).find(x => x.id === sh.gun) ?? gunsOf(p)[0];
  let o;
  if (k === 'aim') {                                                // ('aim:<target>': that one, in view, picked and aimed at)
    const T = targetOf(state, key.slice(4));
    if (!T || !g || g.where !== 'hand' || !targets(state, me).some(t => t.key === T.key)) return true;
    sh.pick = T.key; o = { key, ms: aimMs(p, me, T.x, T.z, g.id) };
  } else o = options(state).find(x => x.key === key);
  sh.menu = null;
  if (!o || o.off === 'aim first') return true;
  const now = state.time.ms, mods = stress(state, me);
  let ms = o.ms, text = '';
  sh.doing = { what: k, from: g.where, head0: me.head ?? 0, start: now };
  if (k === 'aim') {
    const T = targetOf(state, sh.pick);
    sh.doing.to = Math.atan2(T.z - me.z, T.x - me.x); sh.doing.key = sh.pick;
    sh.aim = null;
    text = `You bring ${modelOf(g.id).short} round onto ${T.a ? 'them' : 'it'}.`;
  } else if (k === 'fire') {
    shot(state, bus, me, p, g.id);
    if (!state.shoot) return true;                                  // (the shot ended it: you're down)
    ms = sh.doing.ms ?? ms;                                          // (a burst cut short: the rounds that went)
  } else {
    const r = gunAct(state.rng, p, g.id, k, { from: g.where, mods });
    ms = r.ms; text = r.text;
    sh.doing.r = r;
    if (r.roll) say(state, bus, { kind: 'roll', roll: r.roll, text: r.ok ? text : `${text} Fumbled, it takes longer.`.trim() });
    if (r.mishap === 'discharge') discharge(state, bus, me, p, g.id, k, r.fired);
    if (['dropMag', 'insertMag', 'release', 'rack', 'clear', 'chamber1', 'safety'].includes(k) && sh.aim) sh.aim.settled = now + ms;   // (hands off the aim: it settles again after)
  }
  sh.doing.until = now + Math.max(TICK_MS, ms);
  sh.phase = 'act';
  return true;
}

/** Being shot at, hands shaking, no light to see the gun by: what every action on it costs now. */
function stress(state, me) {
  const out = [];
  if (lightBand(lightHere(state, me.x, me.z)) === 'dark') out.push({ why: 'no light to see it by', v: -2 });
  if ((state.$shotAtMs ?? -1e9) > state.time.ms - 5000) out.push({ why: 'being shot at', v: -3 });
  return out;
}

/**
 * G (or the pockets' Take out) with a gun (sim/game.js): drawing it is meaning to use it (the user, 2026-11-03: "we
 * shouldn't be able to draw a firearm out by pressing G … taking it out should imply we intend on using it,
 * meaning that time stops and we enter the weapon ready sequence"): into the mode, that gun its gun, the draw its
 * first step. Returns whether it was a gun's to do (a knife's is sim/items.js).
 */
export function readyGun(state, bus, me, want = null) {
  const p = me && state.people[me.who];
  if (!p) return false;
  const next = want ?? (p.items ?? []).find(k => weaponOf(k) && k !== p.hand), id = isGun(want) ? want : isGun(p.hand) ? p.hand : isGun(next) && !p.hand ? next : null;
  if (!id) return false;
  if (!state.shoot) toggle(state, bus);
  if (state.shoot) state.shoot.gun = id;
  return true;
}

/** Once a tick (sim/game.js): a step playing out (the aim coming round), and its end. */
export function tick(state, bus) {
  const sh = state.shoot, me = playerOf(state), p = me && state.people[me.who];
  if (!sh) { if (me?.$aim) delete me.$aim; return; }
  if (!me || !p || p.dead || !canStand(p)) { state.shoot = null; if (me) delete me.$aim; return; }
  const now = state.time.ms, d = sh.doing;
  me.vx = me.vz = 0;
  if (d?.what === 'fire' && d.rounds > 1) { const k = Math.floor((now - d.start) / (BURST_GAP_S * 1000)); if (k < d.rounds) me.$shot = d.start + k * BURST_GAP_S * 1000; }   // (a burst: a flash a round)
  if (sh.phase === 'act' && d) {
    if (d.what === 'aim' && d.to !== undefined) {                  // (the turn, as it takes its time)
      const k = Math.min(1, (now - d.start) / Math.max(1, d.until - d.start));
      setHead(me, d.head0 + wrap(d.to - d.head0) * k);
    }
    if (now >= d.until) finish(state, bus, me, p);
  }
  // (an aim held follows them as they move, inside the arms' arc)
  if (sh.aim && !(sh.phase === 'act' && d?.what === 'aim')) {
    const T = targetOf(state, sh.aim?.key);
    if (!T) sh.aim = null;
    else {
      const to = Math.atan2(T.z - me.z, T.x - me.x), arc = Math.min(AIM.arc.max, AIM.arc.base + AIM.arc.per * skill(p, 'weapons')) * Math.PI / 180;
      if (Math.abs(wrap(to - (me.head ?? 0))) > arc) sh.aim = null; else setHead(me, to);
    }
  }
  // (where the gun points, for the figure's pose: src/art; aimed, or coming round onto them)
  const at = sh.aim ? targetOf(state, sh.aim.key) : d?.what === 'aim' ? targetOf(state, d.key) : null;
  if (at && isGun(p.hand)) me.$aim = { x: at.x, z: at.z, ms: sh.aim?.settled ?? d?.start ?? now }; else delete me.$aim;
}
const setHead = (me, h) => { me.head = h; me.face = faceOf(h); };

/** A step's end: what it moves (the gun to the hand, a magazine to the ground), the aim settled; back to choosing. */
function finish(state, bus, me, p) {
  const sh = state.shoot, d = sh.doing, r = d.r;
  if (d.what === 'draw') {
    if (r?.mishap === 'dropped') { take(p, sh.gun); drop(state, p, me, sh.gun); }   // (it's on the ground at your feet: the roll's line said so)
    else { if (p.hand && p.hand !== sh.gun) stowHand(state, p, me); take(p, sh.gun); p.hand = sh.gun; }   // (out, fumbled or not; gone off as it came out, out all the same)
  } else if (d.what === 'holster') {
    if (r?.mishap === 'dropped') drop(state, p, me, sh.gun);
    else if (r?.mishap === 'discharge') { sh.doing = null; sh.phase = 'choose'; return; }   // (it went off going in: still in your hand)
    else { p.hand = null; (p.items ??= []).push(sh.gun); if (!placed(p).out.find(o => o.kind === sh.gun)?.at) { p.items.pop(); p.hand = sh.gun; say(state, bus, { kind: 'note', text: 'There\'s nowhere on you to put it.' }); } }
    state.shoot = null;
    return;
  } else if (d.what === 'aim') {
    setHead(me, d.to);
    sh.aim = { key: d.key, settled: state.time.ms };
  } else if (r?.mishap === 'dropped') drop(state, p, me, sh.gun);
  if (d.what === 'dropMag' && r?.mag) drop(state, p, me, r.mag);
  if (d.what === 'stowMag' && r?.mag) (p.items ??= []).push(r.mag);
  if (d.what === 'insertMag' && r?.mag) { take(p, r.mag); if (r.mishap === 'dropMag') drop(state, p, me, r.mag); }
  if (r?.ejected) say(state, bus, { kind: 'note', hidden: true, text: 'A round on the ground.' });
  sh.doing = null;
  sh.phase = 'choose';
}
const take = (p, id) => { const i = (p.items ?? []).indexOf(id); if (i >= 0) p.items.splice(i, 1); const j = (p.bag ?? []).findIndex(x => x.item === id); if (j >= 0) p.bag.splice(j, 1); };
const stowHand = (state, p, me) => { const k = p.hand; p.hand = null; (p.items ??= []).push(k); if (!placed(p).out.find(o => o.kind === k)?.at) { p.items.pop(); drop(state, p, me, k); } };

/** The trigger pulled at the picked target (or where you face): the gun's say, the round's flight, its wound. */
export function shot(state, bus, me, p, id) {
  const sh = state.shoot, M = modelOf(id), T = targetOf(state, sh?.aim?.key ?? sh?.pick), g = armOf(p, id), n = roundsOf(g, M), da = M.decocker && !g?.cocked;
  const aimedAt = T && sh.aim?.key === T.key ? T : null;             // (no aim, no shot at anything: the user, 2026-11-03, "if you're not aiming you can't shoot")
  let f = null, fired = 0, hits = 0, first = null, words = [], last = null;
  for (let k = 0; k < n; k++) {                                      // (a burst: each round its own roll, the muzzle climbing)
    f = fire(state.rng, p, id);
    if (!f.fired) break;
    if (!fired) heard(state, bus, me, me.x, me.z, M.loud);
    fired++;
    const o = aimedAt && odds(state, me, p, aimedAt.key, sh.part);
    if (o && da && !k) o.mods = [...o.mods, { why: 'the long double-action pull', v: DA_MOD }];
    if (!k) me.$shot = state.time.ms;                                 // (the muzzle's flash, and the kick: src/art; a burst's rounds after, in tick())
    if (aimedAt && o && !(aimedAt.a && state.people[aimedAt.a.who]?.dead)) {
      const roll = check(state.rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: o.dc, mods: k ? [...o.mods, { why: 'the muzzle climbing', v: -Math.round(BURST_K * k * M.recoil) }] : o.mods, body: p });
      first ??= roll;
      if (roll.ok) { hits++; last = aimedAt.item ? hitThing(state, aimedAt.item) : bullet(state, bus, aimedAt.a, sh.part, M, me); }   // (a burst's hits on them: the last one's words say how they are)
      else { const w = stray(state, bus, me, aimedAt, M); if (w) words.push(w); }
    }
    if (f.stoppage || f.empty) break;
  }
  if (!fired) {
    say(state, bus, { kind: 'note', text: { safety: 'The trigger won\'t move: it\'s on safe.', empty: 'Click. Nothing to fire.', jammed: 'The trigger\'s dead: it\'s jammed.', dud: 'Click. A dud: the round didn\'t go off.', broken: 'Nothing: it wants servicing.', open: 'The cylinder\'s open.', case: 'Click: it wants working first.' }[f?.why] ?? 'Nothing.' });
    if (g) g.known = true;
    return f;
  }
  const bang = fired > 1 ? `${fired} rounds` : 'Bang';
  if (last) words.unshift(last);
  if (aimedAt && first) say(state, bus, { kind: 'roll', roll: first, text: `${bang}. ${words.length ? [...new Set(words)].join(' ') : `The shot${fired > 1 ? 's go' : ' goes'} past ${aimedAt.a ? 'them' : 'it'}.`}${fired > 1 ? ` (${hits} of ${fired} hit.)` : ''}` });
  else say(state, bus, { kind: 'note', text: `${bang}. The shot${fired > 1 ? 's go' : ' goes'} where the gun was pointing.` });
  if (f?.stoppage) say(state, bus, { kind: 'note', text: f.stoppage === 'double' ? 'It jams half-open: a double feed.' : 'The case doesn\'t clear: a stovepipe.' });
  else if (f?.empty) say(state, bus, { kind: 'note', text: M.feed === 'cylinder' ? 'Click: the cylinder\'s spent.' : M.holdOpen ? 'It locks back: empty.' : 'Empty.' });
  if (sh?.aim) sh.aim.settled = state.time.ms + Math.round(RECOVER_S * M.recoil * pace(p) * (1 + 0.3 * (fired - 1)) * 1000);   // (the muzzle comes down: steady again after)
  if (sh?.doing) { sh.doing.ms = fireMs(p, M, fired) + (da ? DA_S * 1000 : 0); sh.doing.rounds = fired; }
  return f;
}

/**
 * A gun gone off in a fumbling hand (firearms.js act()'s mishap): heard; drawing or holstering, likely into your
 * own leg; otherwise where it pointed, give or take, into whoever's in its line, or the ground.
 */
export function discharge(state, bus, me, p, id, action, f = null) {
  if (f && !f.fired) { say(state, bus, { kind: 'note', text: 'Click: a dud, and the luckiest one you\'ll ever have.' }); return; }
  const M = modelOf(id), r = state.rng, row = state.map.row ?? 0;
  heard(state, bus, me, me.x, me.z, M.loud);
  me.$shot = state.time.ms;
  if (chance(r, muzzleSafe(p))) {                                    // (pointed where it should be: the ground, the floor)
    say(state, bus, { kind: 'note', text: `Bang. The muzzle was where it should be, down and away: the round goes into the ${state.map.kind === 'street' ? 'ground a step away' : 'floor'}${state.map.kind === 'street' ? ', and everyone looks at you' : ''}.` });
    return;
  }
  if (chance(r, SELF_SHOT[action] ?? 0.1)) { say(state, bus, { kind: 'note', text: `Bang. It goes into your own leg. ${bullet(state, bus, me, 'legs', M, me)}` }); return; }
  const head = (me.head ?? 0) + range(r, -DISCHARGE_SPREAD, DISCHARGE_SPREAD), ux = Math.cos(head), uz = Math.sin(head);
  const hit = state.actors.filter(a => a !== me && !a.hidden && rowOf(state, a) === row).map(a => ({ a, along: (a.x - me.x) * ux + (a.z - me.z) * uz, off: Math.abs((a.x - me.x) * uz - (a.z - me.z) * ux) }))
    .filter(o => o.along > 0.3 && o.along < STRAY.rangeM && o.off < STRAY.widthM).sort((p1, p2) => p1.along - p2.along)[0];
  if (hit && chance(r, DISCHARGE_HIT)) say(state, bus, { kind: 'note', text: `Bang. The round goes where the gun was pointing. ${bullet(state, bus, hit.a, pick(r, ['torso', 'legs', 'torso']), M, me)}` });
  else say(state, bus, { kind: 'note', text: `Bang. The round ${chance(r, 0.5) ? 'goes into the ground a step away' : 'goes off down the street and hits nothing'}, and everyone looks at you.` });
}

/** A thing lying about, hit: a bottle breaks; the rest jump. */
function hitThing(state, it) {
  if (it.kind === 'bottle') { it.kind = 'brokenbottle'; return 'The bottle bursts.'; }
  return `It jumps across the ${it.z > 0 && it.z < 7 ? 'road' : 'pavement'}.`;
}

/** A miss: the first one behind them on the line of the shot, within STRAY's width, may take it. */
function stray(state, bus, me, T, M) {
  const dx = T.x - me.x, dz = T.z - me.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, row = state.map.row ?? 0;
  const behind = state.actors.filter(a => a !== me && a !== T.a && !a.hidden && rowOf(state, a) === row).map(a => {
    const along = (a.x - me.x) * ux + (a.z - me.z) * uz, off = Math.abs((a.x - me.x) * uz - (a.z - me.z) * ux);
    return { a, along, off };
  }).filter(o => o.along > d && o.along < STRAY.rangeM && o.off < STRAY.widthM).sort((p, q) => p.along - q.along)[0];
  if (behind && chance(state.rng, STRAY.hit)) return `It misses, and hits someone behind: ${bullet(state, bus, behind.a, pick(state.rng, ['torso', 'legs']), M, me)}`;
  return null;
}

const WORD = { head: 'head', torso: 'chest', armL: 'left arm', armR: 'right arm', legL: 'left leg', legR: 'right leg' };
/**
 * A bullet into actor a, at the part aimed at (legs: one of them): hurt and a deep wound that bleeds
 * (sim/health.js), to the head HEAD_KILL of the time dead; down if they can't stand. Passers-by get a
 * sheet as they're hit (sim/interact.js person()). Returns the words.
 */
export function bullet(state, bus, a, part, M, from) {
  const p = person(state, a), r = state.rng, ms = state.time.ms;
  const at = part === 'legs' ? pick(r, ['legL', 'legR']) : part === 'torso' && chance(r, 0.12) ? pick(r, ['armL', 'armR']) : part;
  const dmg = BULLET * (CALIBRES[M.cal]?.dmg ?? 1) * M.dmg * range(r, 0.8, 1.25);
  const less = CALIBRES[M.cal]?.less;                               // (a traumatic pistol's rubber: a bruise, a broken rib at worst)
  hurt(p, at, dmg);
  const force = dmg / takes(p, at);
  if (less) injure(p, at, force, r, ms, { crackK: 0.5 });
  else for (const i of injure(p, at, force, r, ms, { edge: true, deep: true, bleedK: (at === 'torso' ? 2.4 : 1.6) * Math.min(1.6, CALIBRES[M.cal]?.dmg ?? 1) })) if (i.kind === 'cut') { i.gunshot = true; i.name = i.artery ? `a bullet through an artery in the ${WORD[at]}` : `a gunshot wound in the ${WORD[at]}`; }
  if (!less && at === 'head' && chance(r, Math.min(0.95, HEAD_KILL * Math.max(1, CALIBRES[M.cal]?.dmg ?? 1)))) kill(p, ms, 'shot');
  else if (!less && at === 'head') {
    // (a head shot that didn't kill: a graze along the skull, dazed and bleeding; or in, out cold and bleeding inside,
    // which no first aid reaches: a hospital's, or dead within the hour; the user, 2026-11-03: "shot in the head should mean something")
    if (chance(r, HEAD_GRAZE)) {
      const i = p.injuries.at(-1); if (i?.gunshot) i.name = 'a bullet graze along the skull';
      if (a.ai) a.ai.downUntil = Math.max(a.ai.downUntil ?? 0, ms + DAZE_S * 1000);
    } else {
      hurt(p, 'head', takes(p, 'head'));
      (p.injuries ??= []).push({ part: 'head', kind: 'cut', name: 'a bullet in the skull', ms, until: ms + 60 * 86400000, bleed: ms + 12 * 3600000, rate: BRAIN_BLEED, deep: true, gunshot: true, internal: true });
    }
  }
  if (!less && at === 'torso') (p.injuries ??= []).push({ part: 'torso', kind: 'cut', name: 'bleeding inside, from a chest wound', ms, until: ms + 30 * 86400000, bleed: ms + CHEST_BLEED_H * 3600000, rate: CHEST_BLEED, deep: true, gunshot: true, internal: true });
  const fell = !less && !p.dead && a.ai && (at === 'torso' || at.startsWith('leg')) ? range(r, ...SHOT_DOWN_MIN[at === 'torso' ? 'torso' : 'leg']) * (p.cls === 'civ' || isPasserby(a) ? 1 : TOUGH) : 0;
  if (fell) a.ai.downUntil = Math.max(a.ai.downUntil ?? 0, ms + fell * 60000);
  spatter(state, a.x, a.z, Math.sign(a.x - from.x) || 1, at === 'head' ? 8 : 5);
  const down = p.dead || !canStand(p) || fell > 0;
  if (down) { a.gait = 'down'; a.vx = a.vz = 0; if (a.ai) a.ai.downUntil = p.dead ? Infinity : Math.max(a.ai.downUntil ?? 0, ms + OUT_MS); if (a.who === state.player && p.dead) bus?.emit('scenario-end', 'dead'); }
  else if (a.ai && isPasserby(a)) flee(state, a, from.x);
  const who = a.who === state.player ? 'You' : cap(p.known === false ? p.seen ?? 'someone' : p.name ?? 'someone'), you = who === 'You';
  return p.dead ? `${who}, hit in the ${WORD[at]}, ${you ? 'drop' : 'drops'}, and ${you ? 'don\'t' : 'doesn\'t'} move.` : down ? `${who}, hit in the ${WORD[at]}, ${you ? 'go' : 'goes'} down.` : `${who}: hit in the ${WORD[at]}.`;
}

/** A shot heard: passers-by within HEAR_M run, away from it; in the campaign, heat (once a minute). */
export function heard(state, bus, shooter, x, z, loud = 1) {
  const row = state.map.row ?? 0, R = HEAR_M * loud;            // (a suppressed gun is heard a fraction as far: its loud)
  if (shooter?.who === state.player && loud >= 0.5) state.$shotBy = { ms: state.time.ms, x, z };   // (yours, heard: the police come for it, sim/armed.js; a suppressed one isn't)
  let ran = 0;
  for (const a of state.actors) if (a !== shooter && isPasserby(a) && !a.hidden && a.gait !== 'down' && rowOf(state, a) === row && Math.hypot(a.x - x, a.z - z) < R) { flee(state, a, x); ran++; }
  if (ran && (state.$panicMs ?? -1e9) < state.time.ms - 20000) say(state, bus, { kind: 'note', text: 'The crack of it rolls down the street. Someone screams; people run.' });
  state.$panicMs = state.time.ms;
  if (state.legend && shooter.who === state.player && (state.shotHeatMs ?? -1e9) < state.time.ms - 60000) { state.shotHeatMs = state.time.ms; addHeat(state, SHOT_HEAT); }
}

/** Away from x along the street, running (a passer-by's way: sim/agents.js PLANNERS 'way'). */
export function flee(state, a, x) {
  const dir = Math.sign(a.x - x) || 1, row = rowOf(state, a);
  a.ai.plan = { kind: 'way', from: { row, x: a.x, z: a.z }, to: { row, x: a.x + dir * 120, z: a.z < 0 ? LINE.F : LINE.N } };
  Object.assign(a.ai, { route: null, $route: null, s: 0, stop: 0, wait: 0, pace: 1.9, fled: state.time.ms });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
