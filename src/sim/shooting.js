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
// no aim, a point shot (POINT), and only at what's in front of you (POINT_DEG).
//
// **The shot** (shot()): the gun's trigger (firearms.js fire(): a click, a dud, a stoppage); fired, a roll of
// Weapon handling against the distance (SHOT.dc + SHOT.perM a metre and SHOT.perM2 its square, × the gun's acc), the part aimed at
// (PART_DC), the target's movement, the light on them, the aim held, your body; then TRIGGER_S and the
// recoil's recovery (RECOVER_S × the gun's recoil × the pace) before the next. A hit lands where it was
// aimed (bullet(): BULLET points × the calibre, the gun; a wound that bleeds deep, sim/health.js injure();
// to the head, HEAD_KILL of the time, dead); a miss goes on, and may find someone behind (STRAY).
// **A gunshot is heard** (heard()): passers-by within HEAR_M run from it, the way away from it; in the
// campaign, a shooting in the street is heat (SHOT_HEAT, once a minute).
import { CALIBRES, armOf, modelOf, isGun, act as gunAct, fire, canDo, ACTIONS, DRAW, pace, ready } from './firearms.js';
import { placed, drop, lyingAbout } from './items.js';
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
export const POINT = -4, POINT_DEG = 25;
export const TRIGGER_S = 0.15, RECOVER_S = 0.35;
export const SHOT = { dc: 6, perM: 0.45, perM2: 0.01 };           // (a pistol's DC by the metre, and the square: past 15 m it gets hard fast)
export const PART_DC = { torso: 0, head: 6, legs: 3 };
export const PARTS = ['head', 'torso', 'legs'];
export const MAX_M = 60;
export const BULLET = 7, HEAD_KILL = 0.6;
export const STRAY = { widthM: 0.7, rangeM: 80, hit: 0.25 };
export const HEAR_M = 70, SHOT_HEAT = 8;
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
  const add = (key, x, z, name) => { const d = Math.hypot(x - me.x, z - me.z); if (d > 0.4 && d <= MAX_M) out.push({ key, x, z, name, d, off: wrap(Math.atan2(z - me.z, x - me.x) - (me.head ?? 0)) }); };
  for (const a of state.actors) if (a !== me && !a.hidden && rowOf(state, a) === row && inView(state, a.id)) add(a.id, a.x, a.z, null);
  for (const it of lyingAbout(state)) if (Math.hypot(it.x - me.x, it.z - me.z) <= 30 && sees(state, e, it.x, it.z)) add(`item:${it.id}`, it.x, it.z, weaponOf(it.kind)?.name ?? 'something');
  return out.sort((p, q) => p.x - q.x || p.z - q.z);
}
const targetOf = (state, key) => {
  if (!key) return null;
  if (key.startsWith('item:')) { const it = lyingAbout(state).find(o => o.id === key.slice(5)); return it && { key, x: it.x, z: it.z, item: it }; }
  const a = state.actors.find(o => o.id === key);
  return a && !a.hidden && { key, x: a.x, z: a.z, a };
};

/** How long an aim at (x, z) takes from where you face, in ms, and its turn (radians). */
export function aimMs(p, me, x, z) {
  const v = skill(p, 'weapons'), off = Math.abs(wrap(Math.atan2(z - me.z, x - me.x) - (me.head ?? 0))) * 180 / Math.PI;
  const arc = Math.min(AIM.arc.max, AIM.arc.base + AIM.arc.per * v);
  const s = AIM.sight * pace(p) + off / (AIM.turn.base + AIM.turn.per * v) + (off > arc ? AIM.feet * pace(p) : 0);
  return Math.round(s * 1000);
}

/** The shot's odds now at the picked target (0–1), and its DC and modifiers (the panel shows them). */
export function odds(state, me, p, key = state.shoot?.pick, part = state.shoot?.part ?? 'torso') {
  const T = targetOf(state, key), id = state.shoot?.gun;
  if (!T || !id) return null;
  const M = modelOf(id), d = Math.hypot(T.x - me.x, T.z - me.z), mods = [];
  const aim = state.shoot?.aim;
  if (aim?.key === key && aim.settled !== undefined) { const held = (state.time.ms - aim.settled) / 1000; mods.push(held >= 0 ? { why: 'the aim held', v: Math.round(Math.min(HELD_MAX, held * HELD)) } : { why: 'still coming down from the last', v: -2 }); }
  else mods.push({ why: 'no aim: a point shot', v: POINT });
  const sp = T.a ? Math.hypot(T.a.vx ?? 0, T.a.vz ?? 0) : 0;
  if (sp > 2.5) mods.push({ why: 'running', v: -5 }); else if (sp > 0.3) mods.push({ why: 'walking', v: -2 });
  const band = lightBand(lightHere(state, T.x, T.z));
  if (band === 'dark') mods.push({ why: 'the dark', v: -4 }); else if (band === 'dim') mods.push({ why: 'poor light', v: -2 });
  if ((state.shoot?.shotAt ?? -1e9) > state.time.ms - 5000) mods.push({ why: 'being shot at', v: -4 });
  const dc = Math.round(SHOT.dc + (d * SHOT.perM + d * d * SHOT.perM2) * M.acc + (T.item ? 4 : PART_DC[part] ?? 0));
  const need = dc - skill(p, 'weapons') - mods.filter(m => m.v).reduce((s, m) => s + m.v, 0);
  return { d, dc, mods: mods.filter(m => m.v), p: Math.max(0.05, Math.min(0.95, (21 - need) / 20)) };
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
  const eta = (a, from) => Math.round((a === 'draw' ? (DRAW[from] ?? DRAW.coat).s : ACTIONS[a]?.s ?? 0) * pace(p) * 1000);
  if (g.where !== 'hand') return [{ key: 'draw', label: `Draw ${modelOf(g.id).short}`, ms: eta('draw', g.where) }];
  const out = [];
  const T = targetOf(state, sh.pick);
  const gun = armOf(p, g.id), M = modelOf(g.id);
  out.push({ key: 'fire', label: 'Fire', ms: Math.round((TRIGGER_S + RECOVER_S * M.recoil * pace(p)) * 1000), off: !ready(gun, M) ? notReady(gun, M) : null });
  if (T && sh.aim?.key !== sh.pick) out.push({ key: 'aim', label: T.item ? `Aim at ${weaponOf(T.item.kind)?.name ?? 'it'}` : 'Aim', ms: aimMs(p, me, T.x, T.z) });
  for (const a of canDo(p, g.id, 'hand')) out.push({ key: a, label: a === 'safety' ? (gun.safety ? 'Safety off' : 'Safety on') : ACTIONS[a].label, ms: eta(a) });
  return out;
}
const notReady = (g, M) => (M.safety === 'manual' && g.safety ? 'the safety\'s on' : g.jam ? 'jammed' : g.chamber === 'dud' || g.chamber === 'case' ? 'a stoppage' : !g.chamber ? 'nothing in the chamber' : g.cond < 0.25 ? 'it wants servicing' : null);

/**
 * A step chosen ('shoot:<key>', or the move keys' 'shoot:pick:±1' and 'shoot:part:±1', which take no time).
 * Its time starts: the world runs for it (phase 'act'), and it ends in tick().
 */
export function choose(state, bus, key) {
  const sh = state.shoot, me = playerOf(state), p = me && state.people[me.who];
  if (!sh || !p || sh.phase !== 'choose') return false;
  const [k, arg] = key.split(':');
  if (k === 'pick') {                                               // (the next target across the picture)
    const t = targets(state, me);
    if (!t.length) return true;
    const i = t.findIndex(o => o.key === sh.pick), n = Number(arg) || 1;
    sh.pick = t[(i < 0 ? 0 : i + n + t.length) % t.length].key;
    return true;
  }
  if (k === 'part') { sh.part = PARTS[Math.max(0, Math.min(PARTS.length - 1, PARTS.indexOf(sh.part) + (Number(arg) || 0)))]; return true; }
  const o = options(state).find(x => x.key === k);
  if (!o) return true;
  const g = gunsOf(p).find(x => x.id === sh.gun) ?? gunsOf(p)[0];
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
  } else {
    const r = gunAct(state.rng, p, g.id, k, { from: g.where, mods });
    ms = r.ms; text = r.text;
    sh.doing.r = r;
    if (r.roll) say(state, bus, { kind: 'roll', roll: r.roll, text: r.ok ? text : `${text} Fumbled, it takes longer.`.trim() });
    if (r.mishap === 'discharge') heard(state, bus, me, me.x, me.z);
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
  if ((state.shoot?.shotAt ?? -1e9) > state.time.ms - 5000) out.push({ why: 'being shot at', v: -3 });
  return out;
}

/**
 * G with a gun, out of the mode (sim/game.js): it comes out, or goes away, in its time and with its roll,
 * as you walk (me.$gun; the end in tick()). Returns whether it was a gun's to do (a knife's is sim/items.js).
 */
export function quickDraw(state, bus, me, want = null) {
  const p = me && state.people[me.who];
  if (!p || me.$gun) return !!me?.$gun;
  const next = want ?? (p.items ?? []).find(k => weaponOf(k) && k !== p.hand), id = isGun(p.hand) && (!want || want === p.hand || !isGun(want)) ? p.hand : isGun(next) && !p.hand ? next : null;
  if (!id) return false;
  const what = p.hand === id ? 'holster' : 'draw', from = what === 'draw' ? gunsOf(p).find(o => o.id === id)?.where : 'hand';
  const r = gunAct(state.rng, p, id, what, { from, mods: stress(state, me) });
  me.$gun = { what, id, until: state.time.ms + r.ms, r };
  if (r.roll && !r.ok) say(state, bus, { kind: 'roll', roll: r.roll, text: `You fumble ${modelOf(id).short} ${what === 'draw' ? 'out' : 'away'}.` });
  if (r.mishap === 'discharge') heard(state, bus, me, me.x, me.z);
  return true;
}

/** Once a tick (sim/game.js): a quick draw's end; a step playing out (the aim coming round), and its end. */
export function tick(state, bus) {
  const sh = state.shoot, me = playerOf(state), p = me && state.people[me.who];
  if (me?.$gun && state.time.ms >= me.$gun.until && p) {
    const { what, id, r } = me.$gun;
    delete me.$gun;
    if (r.mishap === 'dropped') { take(p, id); if (p.hand === id) p.hand = null; drop(state, p, me, id); say(state, bus, { kind: 'note', text: `${modelOf(id).short} slips out of your hand and clatters on the ground.` }); }
    else if (what === 'draw') { if (p.hand && p.hand !== id) stowHand(state, p, me); take(p, id); p.hand = id; say(state, bus, { kind: 'note', text: `${modelOf(id).short} in your hand.` }); }
    else { p.hand = null; (p.items ??= []).push(id); if (!placed(p).out.find(o => o.kind === id)?.at) { p.items.pop(); p.hand = id; say(state, bus, { kind: 'note', text: 'There\'s nowhere on you to put it.' }); } else say(state, bus, { kind: 'note', text: `${modelOf(id).short} away.` }); }
  }
  if (!sh) return;
  if (!me || !p || p.dead || !canStand(p)) { state.shoot = null; return; }
  const now = state.time.ms, d = sh.doing;
  me.vx = me.vz = 0;
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
}
const setHead = (me, h) => { me.head = h; me.face = faceOf(h); };

/** A step's end: what it moves (the gun to the hand, a magazine to the ground), the aim settled; back to choosing. */
function finish(state, bus, me, p) {
  const sh = state.shoot, d = sh.doing, r = d.r;
  if (d.what === 'draw') {
    if (r?.mishap === 'dropped') { take(p, sh.gun); drop(state, p, me, sh.gun); say(state, bus, { kind: 'note', text: `${modelOf(sh.gun).short} slips out of your hand and clatters on the ground.` }); }
    else if (!r?.mishap) { if (p.hand && p.hand !== sh.gun) stowHand(state, p, me); take(p, sh.gun); p.hand = sh.gun; }
  } else if (d.what === 'holster') {
    if (r?.mishap === 'dropped') drop(state, p, me, sh.gun);
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
  const sh = state.shoot, M = modelOf(id), T = targetOf(state, sh?.pick);
  const f = fire(state.rng, p, id);
  if (!f.fired) {
    say(state, bus, { kind: 'note', text: { safety: 'The trigger won\'t move: the safety\'s on.', empty: 'Click. Nothing in the chamber.', jammed: 'The trigger\'s dead: it\'s jammed.', dud: 'Click. A dud: the round didn\'t go off.', broken: 'Nothing: it wants servicing.' }[f.why] ?? 'Nothing.' });
    if (armOf(p, id)) armOf(p, id).known = true;
    return f;
  }
  heard(state, bus, me, me.x, me.z);
  const aimedAt = T && (sh.aim?.key === T.key || Math.abs(wrap(Math.atan2(T.z - me.z, T.x - me.x) - (me.head ?? 0))) * 180 / Math.PI <= POINT_DEG) ? T : null;
  const o = aimedAt && odds(state, me, p, aimedAt.key, sh.part);
  let text;
  if (aimedAt && o) {
    const roll = check(state.rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: o.dc, mods: o.mods, body: p });
    if (roll.ok) text = aimedAt.item ? hitThing(state, aimedAt.item) : bullet(state, bus, aimedAt.a, sh.part, M, me);
    else text = stray(state, bus, me, aimedAt, M) ?? `The shot goes past ${aimedAt.a ? 'them' : 'it'}.`;
    say(state, bus, { kind: 'roll', roll, text: `Bang. ${text}` });
  } else say(state, bus, { kind: 'note', text: 'Bang. The shot goes where the gun was pointing.' });
  if (f.stoppage) say(state, bus, { kind: 'note', text: f.stoppage === 'double' ? 'The slide jams half-open: a double feed.' : 'The case doesn\'t clear: a stovepipe.' });
  else if (f.empty) say(state, bus, { kind: 'note', text: 'The slide locks back: empty.' });
  if (sh?.aim) sh.aim.settled = state.time.ms + Math.round(RECOVER_S * M.recoil * pace(p) * 1000);   // (the muzzle comes down: steady again after)
  return f;
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
  hurt(p, at, dmg);
  const force = dmg / takes(p, at);
  for (const i of injure(p, at, force, r, ms, { edge: true, deep: true, bleedK: at === 'torso' ? 2.4 : 1.6 })) if (i.kind === 'cut') { i.gunshot = true; i.name = i.artery ? `a bullet through an artery in the ${WORD[at]}` : `a gunshot wound in the ${WORD[at]}`; }
  if (at === 'head' && chance(r, HEAD_KILL)) kill(p, ms, 'shot');
  spatter(state, a.x, a.z, Math.sign(a.x - from.x) || 1, at === 'head' ? 8 : 5);
  const down = p.dead || !canStand(p);
  if (down) { a.gait = 'down'; a.vx = a.vz = 0; if (a.ai) a.ai.downUntil = p.dead ? Infinity : ms + OUT_MS; if (a.who === state.player && p.dead) bus?.emit('scenario-end', 'dead'); }
  else if (a.ai && isPasserby(a)) flee(state, a, from.x);
  const who = a.who === state.player ? 'You' : cap(p.known === false ? p.seen ?? 'someone' : p.name ?? 'someone'), you = who === 'You';
  return p.dead ? `${who}, hit in the ${WORD[at]}, ${you ? 'drop' : 'drops'}, and ${you ? 'don\'t' : 'doesn\'t'} move.` : down ? `${who}, hit in the ${WORD[at]}, ${you ? 'go' : 'goes'} down.` : `${who}: hit in the ${WORD[at]}.`;
}

/** A shot heard: passers-by within HEAR_M run, away from it; in the campaign, heat (once a minute). */
export function heard(state, bus, shooter, x, z) {
  const row = state.map.row ?? 0;
  let ran = 0;
  for (const a of state.actors) if (a !== shooter && isPasserby(a) && !a.hidden && a.gait !== 'down' && rowOf(state, a) === row && Math.hypot(a.x - x, a.z - z) < HEAR_M) { flee(state, a, x); ran++; }
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
