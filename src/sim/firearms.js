// TRADECRAFT sim: firearms, the guns themselves (the user, 2026-11-03: "model every part of a weapon that
// way (safety, loaded or unloaded, magazine or single bullet, can contain a chambered bullet and no clip,
// can be jammed and require servicing, can misfire if in bad condition etc. All actions on a weapon should
// require rolls against weapon handling"). How they're fought with, in stop motion, is sim/shooting.js.
//
// **A gun is a thing with a state of its own**, kept by whoever has it: on their sheet (p.arms, by its id),
// or, lying where it was dropped, on that thing (it.arms: sim/items.js drop(), pickUp()), so it goes where
// the gun goes (into a mission and back with the character, into the flat's drawer). What's carried or held
// is the id (p.hand, p.items: `${model}#${owner}.${n}`, so its size and its name come from the model; a gun
// dropped is the same gun picked up, loaded or not, safety on or off). Its state ({ type: 'gun' }):
//   - model (MODELS: a pistol's name, calibre, magazine size, safety, size, how it shoots);
//   - mag: the magazine in it, by id (a state.arms entry of its own, { type: 'mag', fits, n }), or null;
//   - chamber: 'live' (a round in the chamber, ready), 'dud' (a round that didn't go off: a misfire), 'case'
//     (a spent case caught in the ejection port: a stovepipe), or null (empty). A round can be chambered
//     with no magazine in (one shot, then nothing);
//   - jam: null, or 'double' (two rounds fighting for the chamber: a double feed, cleared only by the drill,
//     clear()); a dud or a case in the chamber is a stoppage too, cleared by racking the slide (tap-rack);
//   - locked: the slide locked back on an empty magazine (the last round fired);
//   - safety: on or off, where the model has one (MODELS safety 'manual'); a Glock has none to work;
//   - cond (0–1): its condition, worn by every round fired (WEAR) and by neglect; under COND_SERVICE it
//     misfires and jams far more often (misfire(), jamChance()), and below BROKEN it won't fire at all
//     until it's serviced (service(): stripped and cleaned, at a table, SERVICE_MIN);
//   - known: the holder knows what's in it (their own, loaded by them; a gun picked up is a question
//     until checked: check(), a press-check and a look at the magazine).
// Magazines are things too (`mag-${model}#n`, sized as one, named for the model they're made for), their rounds counted; loose rounds go by the calibre
// (p.rounds: { '9x19': 30 }), a box of BOX rounds at a time taking room on you (sim/items.js things()).
//
// **Every action on a gun takes its time and a roll** against Weapon handling (ACTIONS: base seconds and
// a DC; act()): time is base × pace(skill) (a master in half the time, the untrained in 1.6×), and the
// roll, failed, costs FUMBLE_K more of it; failed by MISHAP_BY or more (or a natural 1 short by NAT1_BY) is a mishap: the
// gun or the magazine dropped, or, a round chambered and the safety off, a shot where it pointed (the
// caller's to resolve: act() says so). Stress and the dark make every action harder (the caller's
// mods: being shot at, hands shaking, no light to see the gun by).
import { check } from './checks.js';
import { skill } from './skills.js';
import { chance } from './rng.js';

export const MODELS = {
  makarov: { name: 'a Makarov PM', short: 'Makarov', cal: '9x18', cap: 8, safety: 'manual', size: [16, 0.35], acc: 1.1, dmg: 0.9, recoil: 0.9 },
  pya: { name: 'a Yarygin PYa', short: 'Yarygin', cal: '9x19', cap: 17, safety: 'manual', size: [20, 0.55], acc: 1, dmg: 1, recoil: 1 },
  glock17: { name: 'a Glock 17', short: 'Glock', cal: '9x19', cap: 17, safety: 'none', size: [20, 0.5], acc: 1, dmg: 1, recoil: 0.95 },
  p229: { name: 'a SIG P229', short: 'SIG', cal: '9x19', cap: 13, safety: 'none', size: [18, 0.5], acc: 0.95, dmg: 1, recoil: 1 },
  browning: { name: 'a Browning Hi-Power', short: 'Browning', cal: '9x19', cap: 13, safety: 'manual', size: [20, 0.5], acc: 1, dmg: 1, recoil: 1 },
  helwan: { name: 'a Helwan', short: 'Helwan', cal: '9x19', cap: 8, safety: 'manual', size: [21, 0.55], acc: 1.1, dmg: 1, recoil: 1.05 },
  tokarev: { name: 'a Tokarev TT', short: 'Tokarev', cal: '7.62x25', cap: 8, safety: 'none', size: [19, 0.45], acc: 1.1, dmg: 1.05, recoil: 1.15 },
};
/** What a model's makers and users are, by city: who carries what (sim/shooting.js NPCs; my calls). */
export const CITY_ARMS = { moscow: ['makarov', 'pya'], london: ['glock17'], beirut: ['browning', 'glock17', 'tokarev'], cairo: ['helwan', 'browning'] };
export const CALIBRES = { '9x18': { dmg: 0.9 }, '9x19': { dmg: 1 }, '7.62x25': { dmg: 1.05 } };
export const MAG_SIZE = [12, 0.06];                               // (a pistol's magazine: cm, litres)
export const BOX = 20, BOX_SIZE = [9, 0.12];                      // (loose rounds, by the box)

export const WEAR = 0.0008;                                       // (condition lost a round fired)
export const COND_SERVICE = 0.6, BROKEN = 0.25;
export const SERVICE_MIN = 30;
export const MISFIRE = 0.002, MISFIRE_WORN = 0.05;                 // (a round that doesn't go off: new, and as the gun goes to BROKEN)
export const JAM = 0.004, JAM_WORN = 0.12, JAM_LIMP = 0.03, LIMP_BELOW = 6;   // (a stoppage as it cycles; a weak grip's, Weapon handling under LIMP_BELOW)
export const DOUBLE_SHARE = 0.3;                                   // (of stoppages, a double feed; the rest a stovepipe)
export const FUMBLE_K = 0.6, MISHAP_BY = 8, NAT1_BY = 3;
export const PACE = { min: 0.5, max: 1.6, per: 1 / 30 };          // (time × max − skill × per, between min and max)

// The actions, each { label, s (seconds, at pace 1), dc }; draw's time and DC are where it's drawn from (DRAW).
export const ACTIONS = {
  draw: { label: 'Draw', s: 1.2, dc: 8 },
  holster: { label: 'Put it away', s: 1.3, dc: 6 },
  safety: { label: 'Safety', s: 0.4, dc: 6 },
  rack: { label: 'Rack the slide', s: 0.8, dc: 8 },
  dropMag: { label: 'Drop the magazine', s: 0.5, dc: 5 },
  stowMag: { label: 'Magazine out, in a pocket', s: 1.4, dc: 7 },
  insertMag: { label: 'A magazine in', s: 1.4, dc: 9 },
  release: { label: 'Slide release', s: 0.3, dc: 6 },
  clear: { label: 'Clear the jam', s: 4, dc: 12 },
  check: { label: 'Check it', s: 1.6, dc: 6 },
  chamber1: { label: 'A round in the chamber, by hand', s: 3, dc: 10 },
  fill: { label: 'Fill a magazine', s: 2.2, dc: 4 },               // (a round's worth: s × the rounds)
};
// Drawn from where it's carried (sim/items.js SPACES): the beltline's an inside-the-waistband holster, the rest pockets.
export const DRAW = { belt: { s: 1.0, dc: 8 }, inside: { s: 1.7, dc: 10 }, coat: { s: 1.6, dc: 10 }, trousers: { s: 2.3, dc: 12 }, bag: { s: 4, dc: 12 } };

export const isGun = (id) => typeof id === 'string' && MODELS[id.split('#')[0]] !== undefined && id.includes('#');
export const isMag = (id) => typeof id === 'string' && id.startsWith('mag-') && id.includes('#');
export const isArm = (id) => isGun(id) || isMag(id);
export const magModel = (id) => (isMag(id) ? id.slice(4, id.indexOf('#')) : null);
/** A gun's or a magazine's name, from its id alone (for the pockets, the drawer, the log). */
export const armName = (id) => (isGun(id) ? modelOf(id).name : isMag(id) ? `a ${MODELS[magModel(id)]?.short ?? 'pistol'} magazine` : null);
export const modelOf = (id) => (isGun(id) ? MODELS[id.split('#')[0]] : null);
/** A gun's or a magazine's state ({ type, … }), kept by its holder h (a sheet, or a thing lying about: h.arms), or null. */
export const armOf = (h, id) => h?.arms?.[id] ?? null;
/** What travels with a gun or a magazine moved from one holder to another: its state, and a gun's magazine's. */
export function moveArm(from, to, id) {
  const g = armOf(from, id);
  if (!g) return;
  (to.arms ??= {})[id] = g; delete from.arms[id];
  if (g.type === 'gun' && g.mag && from.arms[g.mag]) { to.arms[g.mag] = from.arms[g.mag]; delete from.arms[g.mag]; }
}

/**
 * A new gun of a model, on p (p.arms), and its id: loaded ({ mag: rounds in its magazine, chamber: a
 * round in it, safety, cond }), its magazine made too. Spare magazines are newMag().
 */
export function newGun(p, model, { mag = MODELS[model].cap, chamber = true, safety = true, cond = 0.95, known = true } = {}) {
  const id = `${model}#${nextId(p)}`, m = mag === null ? null : newMag(p, model, mag);
  const M = MODELS[model];
  p.arms[id] = { type: 'gun', model, mag: m, chamber: chamber ? 'live' : null, jam: null, locked: false, safety: M.safety === 'manual' ? safety : false, cond, known, by: p.id ?? null };
  return id;
}
/** A magazine for a model (its family: one fits the model it's made for), with n rounds in it, p's. */
export function newMag(p, model, n = 0) {
  const id = `mag-${model}#${nextId(p)}`;
  p.arms[id] = { type: 'mag', fits: model, n: Math.max(0, Math.min(MODELS[model].cap, n)) };
  return id;
}
// (unique wherever it goes: its first holder's id, and their count)
const nextId = (p) => { p.arms ??= {}; p.nextArm = (p.nextArm ?? 0) + 1; return `${p.id ?? 'x'}.${p.nextArm}`; };

/** Weapon handling's pace: a master's twice as fast as the trained, the untrained slower. */
export const pace = (p) => Math.max(PACE.min, Math.min(PACE.max, PACE.max - skill(p, 'weapons') * PACE.per));

/**
 * What can be done with gun g (its state), held or carried at `where` (a SPACES id, or 'hand'), by someone
 * with these magazines and rounds on them (p): [action ids], in a sensible order.
 */
export function canDo(p, id, where = 'hand') {
  const g = armOf(p, id), M = modelOf(id);
  if (!g || !M) return [];
  if (where !== 'hand') return ['draw'];
  const out = [];
  const spare = sparesFor(p, g.model).filter(m => armOf(p, m).n > 0);
  if (g.jam === 'double') out.push('clear');
  else if (g.chamber === 'dud' || g.chamber === 'case') out.push('rack');
  if (M.safety === 'manual') out.push('safety');
  if (!g.jam && g.chamber !== 'dud' && g.chamber !== 'case') {
    if (g.mag && g.locked && armOf(p, g.mag)?.n > 0) out.push('release');
    if (g.mag && !g.locked && armOf(p, g.mag)?.n > 0 && !g.chamber) out.push('rack');
    if (g.chamber === 'live' && !g.mag) out.push('rack');            // (to empty it)
  }
  if (g.mag) out.push('dropMag', 'stowMag');
  else if (spare.length || sparesFor(p, g.model).length) out.push('insertMag');
  if (!g.mag && !g.chamber && (p.rounds?.[M.cal] ?? 0) > 0) out.push('chamber1');
  if (!g.known) out.push('check');
  out.push('holster');
  return [...new Set(out)];
}
/** The magazines someone carries that fit a model, fullest first. */
export const sparesFor = (p, model) => (p.items ?? []).filter(k => isMag(k) && armOf(p, k)?.fits === model).sort((a, b) => armOf(p, b).n - armOf(p, a).n);

/**
 * Do it: the time it took (ms) and how it went. p: who (their sheet: Weapon handling, the body's mods);
 * id: the gun; action: ACTIONS's; opts: { from (draw: a SPACES id), mods (the moment's: stress, the dark),
 * mag (insertMag: which), rng }. Returns { ms, ok, roll, mishap: null | 'dropped' | 'dropMag' | 'discharge',
 * text }, the gun's state changed for what was done (a fumble costs time, not the result; a mishap
 * spoils it). Moving the gun or a magazine between hand, pockets and the ground is the caller's
 * (sim/shooting.js), by what this returns: did (what was done) and mishap.
 */
export function act(rng, p, id, action, opts = {}) {
  const g = armOf(p, id), M = modelOf(id), A = ACTIONS[action];
  if (!g || !M || !A) return { ms: 0, ok: false, text: 'Nothing to do that with.' };
  const base = action === 'draw' ? (DRAW[opts.from] ?? DRAW.coat) : action === 'fill' ? { s: A.s * (opts.n ?? 1), dc: A.dc } : A;
  const roll = check(rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: base.dc ?? A.dc, mods: opts.mods ?? [], body: p });
  let s = base.s * pace(p);
  if (!roll.ok) s *= 1 + FUMBLE_K;
  const out = { ms: Math.round(s * 1000), ok: roll.ok, roll, mishap: null, did: action, text: '' };
  if (!roll.ok && (roll.margin <= -MISHAP_BY || (roll.nat === 1 && roll.margin <= -NAT1_BY))) {   // (a natural 1 alone is a fumble: a mishap only in a poor hand)
    // (a mishap: what a fumbling hand does with a gun)
    if (g.chamber === 'live' && !g.safety && !g.jam && ['draw', 'holster', 'safety', 'check', 'insertMag'].includes(action)) { out.mishap = 'discharge'; fire(rng, p, id); }
    else if (['insertMag', 'dropMag', 'stowMag'].includes(action)) out.mishap = 'dropMag';
    else out.mishap = 'dropped';
    out.text = { discharge: 'Your finger was on the trigger: it went off.', dropMag: 'The magazine slips out of your fingers.', dropped: 'It slips out of your hand.' }[out.mishap];
    if (out.mishap !== 'dropMag') return out;
  }
  const mag = g.mag && armOf(p, g.mag);
  switch (action) {
    case 'safety': g.safety = !g.safety; out.text = g.safety ? 'Safety on.' : 'Safety off.'; break;
    case 'rack': {
      if (g.jam === 'double') { out.text = 'The slide won\'t close: two rounds fighting for the chamber. It wants clearing.'; break; }
      const was = g.chamber;
      g.chamber = mag && mag.n > 0 ? (mag.n--, 'live') : null;
      g.locked = !!mag && !g.chamber;
      out.ejected = was === 'live' || was === 'dud' ? 'round' : null;   // (a live round or a dud flies out: on the ground)
      out.text = was === 'case' || was === 'dud' ? (g.chamber ? 'Tap, rack: it\'s clear, and there\'s one in.' : 'Tap, rack: clear, and nothing comes up after it.')
        : g.chamber ? (was === 'live' ? 'A round flies out; another goes in.' : 'One in the chamber.') : 'The slide goes forward on nothing.';
      g.known = true;
      break;
    }
    case 'release': if (mag && mag.n > 0) { mag.n--; g.chamber = 'live'; g.locked = false; out.text = 'The slide slams home on a fresh round.'; } break;
    case 'dropMag': case 'stowMag': out.mag = g.mag; g.mag = null; out.text = action === 'dropMag' ? 'The magazine drops.' : 'Magazine out, and into a pocket.'; break;
    case 'insertMag': {
      const m = opts.mag ?? sparesFor(p, g.model)[0];
      if (!m || g.mag) { out.text = 'No magazine for it.'; out.ok = false; break; }
      if (out.mishap === 'dropMag') { out.mag = m; break; }
      g.mag = m; out.mag = m; out.text = `A magazine in: ${armOf(p, m).n} rounds.`;
      break;
    }
    case 'clear':
      if (g.jam === 'double') { g.jam = null; g.chamber = mag && mag.n > 0 ? (mag.n--, 'live') : null; out.text = 'Lock, strip, rack, rack, rack, in, rack: clear.'; out.ejected = 'round'; }
      break;
    case 'chamber1': {
      const r = p.rounds?.[M.cal] ?? 0;
      if (r > 0 && !g.chamber && !g.mag) { p.rounds[M.cal] = r - 1; g.chamber = 'live'; g.locked = false; out.text = 'One round, by hand, and the slide closed on it.'; }
      break;
    }
    case 'check': g.known = true; out.text = said(p, id); break;
    case 'draw': out.text = `${M.short} out.`; break;
    case 'holster': out.text = `${M.short} away.`; break;
  }
  return out;
}

/** What's in it, in words (a check's, or the sheet's for the holder who knows). */
export function said(h, id) {
  const g = armOf(h, id), M = modelOf(id), mag = g?.mag && armOf(h, g.mag);
  if (!g) return '';
  const ch = { live: 'one in the chamber', dud: 'a dud in the chamber', case: 'a case stuck in the port', null: 'nothing in the chamber' }[g.chamber];
  return `${M.short}: ${ch}, ${mag ? `a magazine with ${mag.n} of ${M.cap}` : 'no magazine'}${g.jam === 'double' ? ', jammed: a double feed' : ''}${M.safety === 'manual' ? `, safety ${g.safety ? 'on' : 'off'}` : ''}${g.cond < COND_SERVICE ? ', and it wants cleaning' : ''}.`;
}

/** Whether a trigger pull can fire it (a round chambered, the safety off, no jam, not broken). */
export const ready = (g, M) => !!g && g.chamber === 'live' && !(M.safety === 'manual' && g.safety) && !g.jam && g.cond >= BROKEN;
/** The chance a chambered round doesn't go off, by condition. */
export const misfire = (g) => MISFIRE + MISFIRE_WORN * Math.max(0, Math.min(1, (1 - g.cond) / (1 - BROKEN)));
/** The chance it jams as it cycles, by condition and the grip (Weapon handling). */
export const jamChance = (g, value) => JAM + JAM_WORN * Math.max(0, Math.min(1, (1 - g.cond) / (1 - BROKEN))) ** 2 + (value < LIMP_BELOW ? JAM_LIMP : 0);

/**
 * The trigger pulled: { fired: did a round go off, why (if not: 'safety', 'empty', 'jammed', 'dud',
 * 'broken'), stoppage (it fired, and jammed cycling: 'case' | 'double'), empty (the last round: the slide
 * locked back) }. The shot's flight is the caller's (sim/shooting.js).
 */
export function fire(rng, p, id) {
  const g = armOf(p, id), M = modelOf(id);
  if (!g) return { fired: false, why: 'empty' };
  if (M.safety === 'manual' && g.safety) return { fired: false, why: 'safety' };
  if (g.cond < BROKEN) return { fired: false, why: 'broken' };
  if (g.jam) return { fired: false, why: 'jammed' };
  if (g.chamber !== 'live') return { fired: false, why: g.chamber ? 'jammed' : 'empty' };
  if (chance(rng, misfire(g))) { g.chamber = 'dud'; return { fired: false, why: 'dud' }; }
  g.cond = Math.max(0, g.cond - WEAR);
  const mag = g.mag && armOf(p, g.mag);
  if (chance(rng, jamChance(g, skill(p, 'weapons')))) {
    const double = chance(rng, DOUBLE_SHARE) && mag && mag.n > 0;
    g.chamber = double ? null : 'case'; g.jam = double ? 'double' : null;
    return { fired: true, stoppage: double ? 'double' : 'case' };
  }
  if (mag && mag.n > 0) { mag.n--; g.chamber = 'live'; return { fired: true }; }
  g.chamber = null; g.locked = !!mag;
  return { fired: true, empty: true };
}

/** Stripped and cleaned (SERVICE_MIN, at a table): its condition back, and any jam out. */
export function service(p, id) {
  const g = armOf(p, id);
  if (!g) return;
  g.cond = Math.max(g.cond, 0.95); g.jam = null;
  if (g.chamber === 'dud' || g.chamber === 'case') g.chamber = null;
}

/** Rounds into a magazine from what's loose (p.rounds by calibre): how many went in. */
export function fillMag(p, magId, n = Infinity) {
  const m = armOf(p, magId), M = MODELS[m?.fits];
  if (!m || !M) return 0;
  const k = Math.min(n, M.cap - m.n, p.rounds?.[M.cal] ?? 0);
  if (k <= 0) return 0;
  m.n += k; p.rounds[M.cal] -= k;
  return k;
}
