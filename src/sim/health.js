// TRADECRAFT sim: health, part by part (DESIGN.md, Health; the user, 2026-10-26: "health bodypart by
// bodypart").
//
// The body is six parts (PARTS): the head, the torso, the arms, the legs. Each takes damage in points
// (sheet.body: { part: points }, missing is unhurt) against what it can take: PARTS[part].takes, more
// with Fitness (× 1 + Fitness / FITNESS_K). How far through that it is reads as a state (stateOf()):
//   - unhurt;
//   - bruised: any damage at all;
//   - hurt: a third of what it takes;
//   - wounded: two thirds: serious, and it won't mend without care (Medicine);
//   - out: all of it. A broken arm or leg, the torso down, the head out cold.
// What it costs (mods()): modifiers to the checks the part is used in, shown in the log like any other
// (a hurt arm −1 to CQC and Weapon handling, wounded −3, broken: no grapple and −6 with a gun; a head
// hurt or worse dulls every check). The legs slow the walk (paceOf()).
// It mends by the day (heal()): bruises and hurts by HEAL_PER_DAY of what the part takes; a wound, or
// worse, only with care, which comes later.
//
// **Injuries** (p.injuries: [{ part, kind, name, ms, until, bleed }]; the user, 2026-10-26: "a lot of
// damage could trigger cracks and some types of damages can cut (not bare handed) and blood can be
// drawn from getting hit in the face hard enough"): what a blow did besides hurt (injure(), INJURIES).
// One that takes CRACK_AT of what the part can take may crack it (a rib, a forearm, a shin, a
// cheekbone: CRACK_MOD to what the part does, three weeks to knit). A hard one to the face may split
// the skin (SPLIT_AT: a brow, a lip) or bloody the nose (NOSE_AT); a blade, glass, an edge, cuts. What
// bleeds bleeds a while (bleed: until when; sim/blood.js drips it on the ground) and is worn on the
// face or the clothes until cleaned (p.bloody, src/art/sprites.js). They mend by their days (heal()).
// A **fracture** (a broken jaw, a fractured eye socket, broken ribs, a fractured forearm or shin) is
// what a fight ender gone wrong leaves (sim/cqc.js finish()): FRACTURE_MOD to what the part does (the
// jaw: −2 to everything), six weeks to knit.
//
// **Blood** (p.blood: what's left of it, % of the body's; the user, 2026-10-26: "work on the bleeding out
// system, with blood-pressure health stat"): whatever bleeds bleeds at its rate (i.rate, % a minute):
// a bloody nose a trickle (0.1), a split lip 0.15, a shallow cut (through the guard) under 1, a blade
// that lands clean several (1 + 8 × force, × the weapon's bleed), and a cut artery (ARTERY_CHANCE of
// a deep cut to a limb or the neck) 10–15. A shallow cut stops on its own (bleed: until when); a deep
// one or an artery doesn't, short of care (sim/aid.js). bloodTick() takes it out, a second at a time;
// with nothing bleeding it comes back, REGEN_PER_H (the body drawing fluid back into the vessels: a
// litre in half a day, roughly; resting, sim/aid.js rest(), passes the hours). What the loss costs
// (BLOOD, the pressure falling): pale (−1 to everything), in shock (−3, and no running), collapsed
// (down, out: can't stand), dead (bled out). Collapsed with nothing bleeding any more, lying flat,
// you come round after COME_ROUND_S (the blood to the head again), in shock (sim/game.js bloodBeat()).
// The figures are the textbook's classes of haemorrhage, roughly.
//
// **Death** (p.dead: { ms, why }; kill()): someone dead is out of everything: they can't stand, a fight
// with them is over, they lie where they fell (sim/game.js). A blow can kill (sim/cqc.js deathChance():
// a knockout, a slam onto the floor, worse on someone already beaten up); bleeding out comes later.
import { skill } from './skills.js';
import { chance, pick, range } from './rng.js';
import { DAY } from './clock.js';

export const PARTS = {
  head: { name: 'Head', takes: 6 },
  torso: { name: 'Torso', takes: 12 },
  armL: { name: 'Left arm', takes: 8 },
  armR: { name: 'Right arm', takes: 8 },
  legL: { name: 'Left leg', takes: 9 },
  legR: { name: 'Right leg', takes: 9 },
};
export const FITNESS_K = 20;                                       // Fitness 10: half as much again
export const HEAL_PER_DAY = 0.2;
const OUT = { head: 'out cold', torso: 'down', armL: 'broken', armR: 'broken', legL: 'broken', legR: 'broken' };
export const STATES = ['unhurt', 'bruised', 'hurt', 'wounded', 'out'];

/** What a part of this person can take, in points. */
export const takes = (p, part) => PARTS[part].takes * (1 + skill(p, 'fitness') / FITNESS_K);

/** Damage on a part, in points. */
export const damageOf = (p, part) => p.body?.[part] ?? 0;

/** A part's state: 'unhurt' | 'bruised' | 'hurt' | 'wounded' | 'out'. */
export function stateOf(p, part) {
  const d = damageOf(p, part), f = d / takes(p, part);
  return d <= 0 ? 'unhurt' : f < 1 / 3 ? 'bruised' : f < 2 / 3 ? 'hurt' : f < 1 ? 'wounded' : 'out';
}

/** A part's state in words ('out' named for the part: broken, down, out cold). */
export const stateText = (p, part) => { const s = stateOf(p, part); return s === 'out' ? OUT[part] : s; };

/** Damage a part (points ≥ 0). Returns its state after. */
export function hurt(p, part, points) {
  p.body ??= {};
  p.body[part] = Math.round((damageOf(p, part) + Math.max(0, points)) * 10) / 10;
  return stateOf(p, part);
}

const ARMS = ['armL', 'armR'], LEGS = ['legL', 'legR'];
const level = (s) => STATES.indexOf(s);

/**
 * What this person's hurts cost a check of skill key: [{ why, v }]. The head dulls everything; the
 * torso and the legs, the body's work (CQC, Fitness); the arms, what's done with the hands.
 */
export function mods(p, key) {
  const out = [];
  // (the blood's pressure falling: pale, light-headed; then shock)
  const band = bandOf(p);
  if (band === 'pale') out.push({ why: 'pale, light-headed', v: -1 });
  else if (band !== 'steady') out.push({ why: 'in shock, from the blood lost', v: -3 });
  const h = level(stateOf(p, 'head'));
  if (h >= 2) out.push({ why: h >= 3 ? 'dazed, a head wound' : 'a hurt head', v: h >= 3 ? -3 : -1 });
  if (key === 'cqc' || key === 'fitness') {
    const t = level(stateOf(p, 'torso'));
    if (t >= 2) out.push({ why: t >= 3 ? 'a torso wound' : 'hurt ribs', v: t >= 3 ? -3 : -1 });
    const l = Math.max(...LEGS.map(k => limbLevel(p, k))), ls = LEGS.some(k => p.splints?.[k] && limbLevel(p, k) >= 4);
    if (l >= 2) out.push({ why: l >= 4 ? (LEGS.some(k => p.tourniquets?.[k]) ? 'a tourniquet on a leg' : ls ? 'a splinted leg' : 'a broken leg') : l >= 3 ? 'a wounded leg' : 'a hurt leg', v: l >= 4 ? (ls ? -2 : -4) : l >= 3 ? -2 : -1 });
  }
  if (key === 'cqc' || key === 'weapons') {
    const a = Math.max(...ARMS.map(k => limbLevel(p, k))), as = ARMS.some(k => p.splints?.[k] && limbLevel(p, k) >= 4);
    if (a >= 2) out.push({ why: a >= 4 ? (ARMS.some(k => p.tourniquets?.[k]) ? 'a tourniquet on an arm' : as ? 'a splinted arm' : 'a broken arm') : a >= 3 ? 'a wounded arm' : 'a hurt arm', v: a >= 4 ? Math.round((key === 'weapons' ? -6 : -4) / (as ? 2 : 1)) : a >= 3 ? -3 : -1 });
  }
  // A crack or a fracture, where the part is used (a cheekbone, a jaw: everything).
  for (const i of (p.injuries ?? []).filter(j => j.kind === 'crack' || j.kind === 'fracture')) {
    const uses = i.part === 'head' ? true : i.part === 'torso' || i.part.startsWith('leg') ? key === 'cqc' || key === 'fitness' : key === 'cqc' || key === 'weapons';
    if (uses) out.push({ why: i.name, v: i.part === 'head' ? (i.kind === 'fracture' ? -2 : -1) : i.kind === 'fracture' ? FRACTURE_MOD : CRACK_MOD });
  }
  return out;
}

export const CRACK_AT = 0.5;
export const SPLIT_AT = 0.3;
export const NOSE_AT = 0.2;
export const CRACK_MOD = -2;
export const BLOOD = { pale: 85, shock: 70, collapse: 55, dead: 45 };
export const REGEN_PER_H = 2;
export const COME_ROUND_S = 90;
export const ARTERY_CHANCE = 0.15;
export const DEEP_H = 6;                                          // (a deep cut bleeds this long, untended: as good as forever)
export const FRACTURE_MOD = -3;
const SIDE = { armL: 'left', armR: 'right', legL: 'left', legR: 'right' };
export const INJURIES = {
  crack: { days: 21, name: (part) => ({ head: 'a cracked cheekbone', torso: 'a cracked rib' }[part] ?? `a cracked ${SIDE[part]} ${part.startsWith('arm') ? 'forearm' : 'shin'}`) },
  split: { days: 7, bleedS: [120, 300], name: (part, r) => pick(r, ['a split brow', 'a split lip']) },
  nose: { days: 1, bleedS: [60, 150], name: () => 'a bloody nose' },
  fracture: { days: 42, name: (part, r) => (part === 'head' ? pick(r, ['a broken jaw', 'a fractured eye socket', 'a broken cheekbone']) : part === 'torso' ? 'broken ribs' : `a fractured ${SIDE[part]} ${part.startsWith('arm') ? 'forearm' : 'shin'}`) },
  cut: { days: 10, bleedS: [180, 600], name: (part) => (part === 'head' ? 'a cut on the face' : part === 'torso' ? 'a cut across the ribs' : `a cut on the ${SIDE[part]} ${part.startsWith('arm') ? 'arm' : 'leg'}`) },
};
const has = (p, part, kind) => (p.injuries ?? []).some(i => i.part === part && i.kind === kind);

/**
 * What a blow of `force` (its share of what the part can take) did besides hurt, at game time ms:
 * the new injuries, kept on p.injuries (edge: a blade's, which cuts). r: the dice.
 */
export function injure(p, part, force, r, ms, { edge = false, fracture = 0, bleedK = 1, crackK = 0, deep = false } = {}) {
  const out = [];
  // (bleedK: a weapon's, how much what it cuts bleeds; crackK: a hammer's, how likely it cracks; deep: a blade that landed clean)
  const add = (kind) => {
    const K = INJURIES[kind], i = { part, kind, name: K.name(part, r), ms, until: ms + K.days * DAY, bleed: K.bleedS ? ms + Math.round(range(r, ...K.bleedS) * (kind === 'cut' ? bleedK : 1)) * 1000 : 0 };
    if (kind === 'nose') i.rate = 0.1;
    if (kind === 'split') i.rate = 0.15;
    if (kind === 'cut') {
      const artery = deep && part !== 'torso' && force >= 0.35 && chance(r, ARTERY_CHANCE + force * 0.2);
      i.rate = Math.round((artery ? range(r, 10, 15) : deep ? (1 + force * 8) * bleedK : (0.3 + force * 3) * bleedK) * 100) / 100;
      if (deep || artery) { i.deep = true; i.bleed = ms + DEEP_H * 3600 * 1000; }
      if (artery) { i.artery = true; i.name = part === 'head' ? 'a cut to the neck, an artery' : `a cut artery in the ${SIDE[part]} ${part.startsWith('arm') ? 'arm' : 'thigh'}`; }
      else if (deep) i.name = part === 'torso' ? 'a stab wound in the side' : `a deep cut on the ${part === 'head' ? 'face' : `${SIDE[part]} ${part.startsWith('arm') ? 'arm' : 'leg'}`}`;
    }
    (p.injuries ??= []).push(i);
    out.push(i);
    if (i.bleed) (p.bloody ??= {})[part === 'head' ? 'face' : 'clothes'] = ms;
  };
  // (fracture: the chance a blow that goes wrong breaks the bone outright: a fight ender's, sim/cqc.js)
  if (fracture && !has(p, part, 'fracture') && chance(r, fracture)) add('fracture');
  else if (force >= CRACK_AT - crackK && !has(p, part, 'crack') && chance(r, Math.min(1, 0.4 + crackK + (force - CRACK_AT) * 2))) add('crack');
  if (edge && force > 0.05) add('cut');
  else if (part === 'head') {
    if (force >= SPLIT_AT && chance(r, 0.45)) add('split');
    else if (force >= NOSE_AT && !has(p, 'head', 'nose') && chance(r, 0.4)) add('nose');
  }
  return out;
}

/** What's left of their blood, % of the body's. */
export const bloodOf = (p) => p?.blood ?? 100;
/** How fast they bleed at game time ms, % a minute (k: what holds it back, a hand pressed on it). */
export const bleedRate = (p, ms, k = 1) => (p.injuries ?? []).reduce((a, i) => a + (i.bleed > ms ? (i.rate ?? 0.2) : 0), 0) * k;
/** The blood's state: 'steady', 'pale', 'shock', 'collapsed', 'dead'. */
export function bandOf(p) {
  const b = bloodOf(p);
  return b >= BLOOD.pale ? 'steady' : b >= BLOOD.shock ? 'pale' : b >= BLOOD.collapse ? 'shock' : b >= BLOOD.dead ? 'collapsed' : 'dead';
}
/** s seconds pass at game time ms: what bleeds takes its blood; nothing bleeding, it comes back. Returns the band after. k: as bleedRate. */
export function bloodTick(p, s, ms, k = 1) {
  const rate = bleedRate(p, ms, k);
  const b = rate > 0 ? bloodOf(p) - rate * s / 60 : Math.min(100, bloodOf(p) + REGEN_PER_H * s / 3600);
  if (b >= 100 && p.blood === undefined) return 'steady';
  p.blood = Math.max(0, b);                                       // (unrounded: a second's regen is a ten-thousandth of a point)
  if (p.blood >= 100) delete p.blood;
  return bandOf(p);
}

/** Whether someone is bleeding at game time ms. */
export const bleeding = (p, ms) => !!p.injuries?.some(i => i.bleed > ms);

/** Their injuries on a part, in words ('a cracked rib, a split lip'), or ''. */
export const injuriesOn = (p, part) => (p.injuries ?? []).filter(i => i.part === part).map(i => i.name).join(', ');

/** Whether this person can grapple (two working arms) and stand (one working leg at least). */
export const canGrapple = (p) => ARMS.every(k => stateOf(p, k) !== 'out' && !p.tourniquets?.[k]);
export const canStand = (p) => !p.dead && bloodOf(p) >= BLOOD.collapse && LEGS.some(k => stateOf(p, k) !== 'out') && stateOf(p, 'torso') !== 'out' && stateOf(p, 'head') !== 'out';

/** Dead, at game time ms, of `why` ('a blow to the head', …). */
export function kill(p, ms, why) { p.dead ??= { ms, why }; }
export const isDead = (p) => !!p?.dead;

/** How beaten up someone is, all told: the head's and the torso's damage, as shares of what each takes, averaged (0 fresh, 1 both gone). */
export const wear = (p) => (Math.min(1, damageOf(p, 'head') / takes(p, 'head')) + Math.min(1, damageOf(p, 'torso') / takes(p, 'torso'))) / 2;

/** The walk's pace for these legs, × the usual: a wounded leg slows it, a broken one more. */
export function paceOf(p) {
  const l = Math.max(...LEGS.map(k => limbLevel(p, k)));
  return l >= 4 ? (LEGS.some(k => p.splints?.[k] && !p.tourniquets?.[k]) ? 0.75 : 0.5) : l >= 3 ? 0.8 : 1;
}

/** A limb's level, as what it costs goes (a tourniquet on it: as good as broken; sim/aid.js). */
function limbLevel(p, k) { return p.tourniquets?.[k] ? 4 : level(stateOf(p, k)); }

/** Days pass (to game time ms): bruises and hurts mend; injuries by their days; wounds wait for care; blood washes off in a day. */
export function heal(p, days, ms = null) {
  if (ms !== null && p.injuries) { p.injuries = p.injuries.filter(i => i.until > ms); if (!p.injuries.length) delete p.injuries; }
  if (ms !== null && p.bloody) { for (const k in p.bloody) if (ms - p.bloody[k] > DAY) delete p.bloody[k]; if (!Object.keys(p.bloody).length) delete p.bloody; }
  if (days > 0 && p.blood !== undefined && !bleeding(p, ms ?? 0)) { p.blood = Math.min(100, p.blood + REGEN_PER_H * 24 * days); if (p.blood >= 100) delete p.blood; }
  if (!p.body || !(days > 0)) return;
  for (const part in p.body) {
    if (level(stateOf(p, part)) >= 3) continue;
    p.body[part] = Math.max(0, Math.round((p.body[part] - HEAL_PER_DAY * takes(p, part) * days) * 10) / 10);
    if (!p.body[part]) delete p.body[part];
  }
}
