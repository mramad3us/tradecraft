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
// It mends by the day (heal()): bruises and hurts by HEAL_PER_DAY of what the part takes (POULTICED as fast
// under a poultice); a wound, or worse, only once tended (p.tended[part]: any care given to it, sim/aid.js)
// and with nothing on it still wanting care (sim/medicine.js needsCare()), at WOUND_HEAL of that pace.
// What care is, what an untended wound goes through (infection, fever, sepsis), pain and what it costs,
// and the scars healing leaves: sim/medicine.js. heal() runs the days one at a time, so what goes bad and
// what mends take their turns; off the map (tended) people see their own doctors.
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
// jaw: −2 to everything), six weeks to knit. A round body armour stopped leaves a bruise behind it, bleeding
// nothing (kind 'blunt', named for what did it: sim/armour.js stoppedInjury()), and may crack a rib (addInjury()).
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
// **Moving bleeds** (the user, 2026-11-04: "Moving away should increase blood loss if realistic"): the heart going
// harder and the wound worked open, whatever bleeds bleeds faster on the move (exertion(), EXERTION: crawling ×1.25,
// walking ×1.5, running ×2.5; lying, sitting or standing still as it is), under a hand pressed on it or not; the
// player's as everyone's (sim/game.js bloodBeat()).
//
// **Down from a shot, and for how long** (the user, 2026-11-04: "being knocked down is a logical result of getting
// shot. Staying down should be justified (pain level, shot in legs, blood loss, loss of consciousness)"): a bullet
// puts anyone down (sim/shooting.js bullet()), for the knock of it (knockS(): KNOCK_S by where it went in, an arm a
// few seconds, a leg ten to thirty, the body twenty to a minute, a graze along the skull about half a minute;
// longer in pain, KNOCK_PAIN by the pain's band, and with the blood lost, KNOCK_BLOOD; the trained TRAINED_K of
// it; KNOCK_MIN_S to KNOCK_MAX_S). Past that, only the body keeps them down (staysDown()): out cold (outCold():
// dead, bled past collapse, the cold or the heat, a bullet in the skull), the chest gone from a gunshot, or both
// legs gone; and whoever's down only for the legs, awake, with an arm to pull with, can crawl (canCrawl(), at
// crawlMs()). The rest get up and get away (sim/wounded.js). Whom a witness calls an ambulance for: casualty().
//
// **Death** (p.dead: { ms, why }; kill()): someone dead is out of everything: they can't stand, a fight
// with them is over, they lie where they fell (sim/game.js). A blow can kill (sim/cqc.js deathChance():
// a knockout, a slam onto the floor, worse on someone already beaten up); bleeding out comes later.
import { skill } from './skills.js';
import { chance, pick, range } from './rng.js';
import { DAY, HOUR } from './clock.js';
import { painOf, painBand, feverOf, infectDays, infectionOf, needsCare, knitOf, expire, scarOf, careWords, broken, INFECTION } from './medicine.js';
import { thermalMods, thermalDown } from './thermal.js';
import { mobilityOf as armourMobility } from './armour.js';

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
export const POULTICED = 1.6, WOUND_HEAL = 0.5;
export const TOURNIQUET_SAFE_H = 2, TOURNIQUET_HARM_H = 0.15;     // (a tourniquet on longer: the limb starved, this share of what it takes an hour)
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

const ARMS = ['armL', 'armR'], LEGS = ['legL', 'legR'], LIMBS = [...ARMS, ...LEGS];
const level = (s) => STATES.indexOf(s);

/**
 * What this person's hurts cost a check of skill key: [{ why, v }]. The head dulls everything; the
 * torso and the legs, the body's work (CQC, Fitness); the arms, what's done with the hands.
 */
export function mods(p, key) {
  const out = [...thermalMods(p)];                                 // (the cold or the heat in you: sim/thermal.js)
  // (fever, from an infected wound; pain, but not in a fight: adrenaline, you feel it after; sim/medicine.js)
  const fever = feverOf(p), pain = key === 'cqc' ? null : painBand(painOf(p, stateOf, Object.keys(PARTS)));
  if (fever) out.push({ why: fever.word, v: fever.v });
  // (wet through in the cold; a cold, unless painkillers are working: sim/wet.js)
  if (p.shiver) out.push({ why: 'shivering, wet through', v: -1 });
  if (p.sick?.kind === 'cold' && !p.dosed) out.push({ why: 'a heavy cold', v: -1 });
  if (pain) out.push({ why: pain.word, v: pain.v });
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
  // (a scar that costs something, for good: a break knitted crooked)
  for (const sc of (p.scars ?? []).filter(x => x.v)) {
    if (sc.part.startsWith('leg') ? key === 'cqc' || key === 'fitness' : key === 'cqc' || key === 'weapons') out.push({ why: sc.name, v: sc.v });
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
  surge(p, ms);                                                    // (hurt: the adrenaline, a while)
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

/** An injury of a kind (INJURIES') on a part at game time ms, bleeding nothing: a rib cracked behind a vest (sim/shooting.js). The injury, or null if the part has one. */
export function addInjury(p, part, kind, ms, r = null) {
  if (has(p, part, kind)) return null;
  const K = INJURIES[kind], i = { part, kind, name: K.name(part, r), ms, until: ms + K.days * DAY, bleed: 0 };
  (p.injuries ??= []).push(i);
  return i;
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

/** Their injuries on a part, in words ('a cracked rib, a split lip'; at game time ms, with their care: 'a deep cut (stitched)'), and its scars, or ''. */
export const injuriesOn = (p, part, ms = null) => counted([...(p.injuries ?? []).filter(i => i.part === part).map(i => { const w = ms === null ? '' : careWords(p, i, ms); return w ? `${i.name} (${w})` : i.name; }),
  ...(p.scars ?? []).filter(x => x.part === part).map(x => x.name)]).join(', ');
// (the same words twice or more: once, with how many; ten bullets in the chest are one line, not ten)
const counted = (words) => { const n = new Map(); for (const w of words) n.set(w, (n.get(w) ?? 0) + 1); return [...n].map(([w, k]) => (k > 1 ? `${w} (×${k})` : w)); };

/** Whether this person can grapple (two working arms) and stand (one working leg at least). */
export const canGrapple = (p) => ARMS.every(k => stateOf(p, k) !== 'out' && !p.tourniquets?.[k]);
export const canStand = (p) => !p.dead && !thermalDown(p) && bloodOf(p) >= BLOOD.collapse && LEGS.some(k => stateOf(p, k) !== 'out') && stateOf(p, 'torso') !== 'out' && stateOf(p, 'head') !== 'out';

// How well someone moves, wounded (the user, 2026-11-03: "wounds should slow everyone down especially gunshot
// wounds"): a factor on the walk and the run, each leg's and the torso's state, the blood lost, a fresh bullet
// wound's pain (GUNSHOT_DAYS old at most), and what they wear (a plate carrier's 11 kg: sim/armour.js MOBILITY);
// under RUN_BELOW, no running at all. The player's feet (sim/game.js) and everyone else's (sim/agents.js) both go by it.
export const MOBILITY = { legs: { hurt: 0.85, wounded: 0.55, out: 0.3 }, torso: { hurt: 0.9, wounded: 0.65 }, blood: { pale: 0.85, shock: 0.6 }, gunshot: 0.8 };
export const RUN_BELOW = 0.7, GUNSHOT_DAYS = 3;
export function mobility(p, ms = 0) {
  if (!p) return 1;
  let k = 1;
  for (const leg of ['legL', 'legR']) k *= MOBILITY.legs[stateOf(p, leg)] ?? 1;
  k *= MOBILITY.torso[stateOf(p, 'torso')] ?? 1;
  k *= MOBILITY.blood[bandOf(p)] ?? 1;
  if ((p.injuries ?? []).some(i => i.gunshot && ms - i.ms < GUNSHOT_DAYS * DAY)) k *= MOBILITY.gunshot;
  return k * armourMobility(p);
}
export const canRun = (p, ms = 0) => mobility(p, ms) >= RUN_BELOW && bandOf(p) !== 'shock';

/** Out cold whatever the clock says: dead, collapsed from the blood lost, the cold or the heat, a bullet in the skull. */
export const outCold = (p) => !!p.dead || thermalDown(p) || bloodOf(p) < BLOOD.collapse || (p.injuries ?? []).some(i => i.internal && i.part === 'head');
const chestGone = (p) => stateOf(p, 'torso') === 'out' && (p.injuries ?? []).some(i => i.gunshot && i.part === 'torso');
const armFree = (p, k) => stateOf(p, k) !== 'out' && !p.tourniquets?.[k];

/**
 * Down whatever an agent's clock says (sim/agents.js): out cold (outCold()), both legs gone, the chest gone from a
 * gunshot. Out cold from a blow isn't this: they come round on their clock (sim/interact.js DOWN_S), the head's
 * damage mending by the day as before.
 */
export const staysDown = (p) => outCold(p) || LEGS.every(k => stateOf(p, k) === 'out') || chestGone(p);
/** Down only for the legs, awake, an arm to pull with: they can crawl (sim/wounded.js), drawn lying. */
export const canCrawl = (p) => !!p && staysDown(p) && !outCold(p) && !chestGone(p) && ARMS.some(k => armFree(p, k));
// (a crawl's pace, m/s, on the elbows and the good arm: the torso's hurt and the blood lost slow it as they slow a walk; one arm, CRAWL_ONE_ARM of it)
export const CRAWL_MS = 0.25, CRAWL_ONE_ARM = 0.6;
export const crawlMs = (p) => CRAWL_MS * (MOBILITY.torso[stateOf(p, 'torso')] ?? 1) * (MOBILITY.blood[bandOf(p)] ?? 1) * (ARMS.every(k => armFree(p, k)) ? 1 : CRAWL_ONE_ARM);

export const KNOCK_S = { arm: [4, 12], leg: [10, 30], torso: [20, 60], head: [15, 35] };
export const KNOCK_PAIN = { 'in pain': 1.3, 'bad pain': 2, agony: 3 };   // (by the pain's band after the hit: sim/medicine.js PAIN_BANDS)
export const KNOCK_BLOOD = { pale: 1.3, shock: 2 };
export const KNOCK_MIN_S = 2, KNOCK_MAX_S = 180, TRAINED_K = 0.4;
/** How long a bullet's knock keeps p down, in seconds, by where it went in (a PARTS key), the pain and the blood after it; trained: TRAINED_K of it. r: the dice. */
export function knockS(p, part, r, trained = false) {
  const K = KNOCK_S[part.startsWith('arm') ? 'arm' : part.startsWith('leg') ? 'leg' : part] ?? KNOCK_S.torso;
  const pain = painBand(painOf(p, stateOf, Object.keys(PARTS)));
  const s = range(r, ...K) * (KNOCK_PAIN[pain?.word] ?? 1) * (KNOCK_BLOOD[bandOf(p)] ?? 1) * (trained ? TRAINED_K : 1);
  return Math.round(Math.max(KNOCK_MIN_S, Math.min(KNOCK_MAX_S, s)) * 10) / 10;
}

export const EXERTION = { crawl: 1.25, walk: 1.5, run: 2.5 };
const EXERTS = { walk: EXERTION.walk, stagger: EXERTION.walk, run: EXERTION.run, down: EXERTION.crawl };   // (moving 'down' is a crawl: sim/wounded.js)
/** How much faster actor a bleeds for how they're moving now (× bleedRate): still, 1. */
// Adrenaline (the user, 2026-11-04: "Adrenaline should be modelled as a short term pain reduction thing"): a surge on
// being hurt (injure()), and for whoever's in danger for as long as it lasts (sim/wounded.js); ADRENALINE.k of the pain
// off for holdS, fading to nothing over fadeS. p.$adrenaline, the last surge's time, and p.$adrenal, the share off the
// pain now (kept once a second, sim/game.js bloodBeat(); read by sim/medicine.js painOf()): runtime, a save mid-surge
// loses it.
export const ADRENALINE = { k: 0.6, holdS: 40, fadeS: 80 };
export const surge = (p, ms) => { if (p && !p.dead) p.$adrenaline = ms; };
/** Adrenaline's level at ms, 0 … 1. */
export const adrenalK = (p, ms) => { const t = p?.$adrenaline; if (t === undefined) return 0; const s = (ms - t) / 1000; return s < 0 ? 0 : s < ADRENALINE.holdS ? 1 : Math.max(0, 1 - (s - ADRENALINE.holdS) / ADRENALINE.fadeS); };
/** Kept once a second: the share of the pain adrenaline takes off now. */
export const adrenalTick = (p, ms) => { if (!p) return; const k = adrenalK(p, ms); if (k > 0) p.$adrenal = ADRENALINE.k * k; else { delete p.$adrenal; if (p.$adrenaline !== undefined && ms - p.$adrenaline > (ADRENALINE.holdS + ADRENALINE.fadeS) * 1000) delete p.$adrenaline; } };
// What someone can bear (the user: "Pain resistance should be linked to fitness level, over a certain pain threshold,
// people just lit up against a wall or lie down"): PAIN_LIMIT points of pain (sim/medicine.js PAIN: a bullet through the
// arm or the leg is 28, a break in it 50, two in the body 50 or more), more with Fitness; past it they stop where they
// are, sat against a wall or down; FLOOR_K past it, down.
export const PAIN_LIMIT = { base: 30, perFit: 2 }, FLOOR_K = 1.4, DIZZY_HEAD_MIN = 10;
export const painLimit = (p) => PAIN_LIMIT.base + PAIN_LIMIT.perFit * Math.max(0, skill(p, 'fitness'));
/**
 * What the wounds do to someone now (the user: "wounds should have effects (pain, blood loss, shock, dizziness) and these
 * effects should trigger reactions"): { pain (as felt: adrenaline's off it), limit, over (past it), floored (far past it, or
 * in shock: lying down), dizzy (pale from the blood lost, or a blow to the head in the last DIZZY_HEAD_MIN), shock }.
 */
export function woundsNow(p, ms) {
  const pain = painOf(p, stateOf, Object.keys(PARTS)), limit = painLimit(p), b = bloodOf(p), shock = b < BLOOD.shock;
  const head = (p.injuries ?? []).some(i => i.part === 'head' && ms - (i.ms ?? -Infinity) < DIZZY_HEAD_MIN * 60000);
  return { pain, limit, over: pain >= limit, floored: shock || pain >= limit * FLOOR_K, dizzy: b < BLOOD.pale || head, shock };
}
/** Past what they can bear, or in shock: they've stopped, wherever they are (an officer drops out of it, sim/armed.js). */
export const incapacitated = (p, ms) => !!p && (p.injuries?.length > 0 || bloodOf(p) < BLOOD.pale) && (bloodOf(p) < BLOOD.shock || painOf(p, stateOf, Object.keys(PARTS)) >= painLimit(p));

export const exertion = (a) => (a && !a.hidden && Math.hypot(a.vx ?? 0, a.vz ?? 0) > 0.05 ? EXERTS[a.gait] ?? 1 : 1);

/**
 * Whom a witness calls an ambulance for (sim/emergency.js report()): the dead, whoever's down or can't stand, and
 * whoever's been shot and is getting away from it or sat against a wall after it (a.ai.hurt: sim/wounded.js).
 */
export const casualty = (p, a) => !!p && (!!p.dead || a?.gait === 'down' || !canStand(p) || !!a?.ai?.hurt);

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

/**
 * Days pass (to game time ms; a day at a time): what's timed runs out; open wounds go bad or don't, and
 * infections run their course (sim/medicine.js); injuries knit by their days, as fast as their care lets
 * them, and leave what they leave (scars); bruises and hurts mend, wounds once tended; a tourniquet left
 * on starves the limb; blood washes off in a day, and comes back (blood: false, when the second's beat
 * already brings it back: sim/game.js). tended: off the map, a doctor's care (no infection, everything
 * knits). Returns what changed, for the log ([{ text, tone }]); sepsis kills (kill()).
 */
export function heal(p, days, ms = null, { tended = false, blood = true } = {}) {
  const out = [], n = Math.max(1, Math.ceil(days));
  for (let k = 1; k <= n && !p.dead; k++) healDay(p, days / n, ms === null ? null : ms - days * DAY + (k * days / n) * DAY, tended, blood, out);
  return out;
}

function healDay(p, days, ms, tended, blood, out) {
  if (ms !== null) {
    expire(p, ms);
    if (!tended) {
      out.push(...infectDays(p, days, ms, p.id ?? ''));
      if (infectionOf(p) >= INFECTION.sepsis) { kill(p, ms, 'sepsis, from an infected wound'); return; }
    }
    // (a tourniquet on too long: the limb starved of blood)
    for (const [k, t] of Object.entries(p.tourniquets ?? {})) {
      const over = Math.min(days * 24, (ms - t.ms) / HOUR - TOURNIQUET_SAFE_H);
      if (over > 0) { const was = stateOf(p, k); hurt(p, k, TOURNIQUET_HARM_H * takes(p, k) * over); if (was !== 'out' && stateOf(p, k) === 'out') out.push({ text: `The ${SIDE[k]} ${k.startsWith('arm') ? 'arm' : 'leg'}'s gone cold and grey under the tourniquet. Dead weight.`, tone: 'warn' }); }
    }
    if (p.injuries) {
      for (const i of p.injuries) i.until += (1 - knitOf(p, i, tended)) * days * DAY;
      for (const i of p.injuries.filter(j => j.until <= ms)) {
        const sc = !tended && scarOf(p, i);
        if (sc) { (p.scars ??= []).push(sc); out.push({ text: `${i.name.charAt(0).toUpperCase() + i.name.slice(1)} has healed, and left ${sc.name}.`, tone: sc.v ? 'warn' : 'note' }); }
      }
      p.injuries = p.injuries.filter(i => i.until > ms); if (!p.injuries.length) delete p.injuries;
    }
    if (p.bloody) { for (const k in p.bloody) if (ms - p.bloody[k] > DAY) delete p.bloody[k]; if (!Object.keys(p.bloody).length) delete p.bloody; }
  }
  if (blood && days > 0 && p.blood !== undefined && !bleeding(p, ms ?? 0)) { p.blood = Math.min(100, p.blood + REGEN_PER_H * 24 * days); if (p.blood >= 100) delete p.blood; }
  if (p.body && days > 0) {
    for (const part in p.body) {
      const lv = level(stateOf(p, part)), poulticed = p.poultices?.[part];
      // (a wound mends once tended, and nothing on it wants care; a bruise faster under a poultice)
      const k = lv >= 3 ? ((tended || p.tended?.[part] !== undefined) && !needsCare(p, part, stateOf) && (lv < 4 || !LIMBS.includes(part) || tended || p.splints?.[part]) ? WOUND_HEAL : 0) : poulticed ? POULTICED : 1;
      if (!k) continue;
      p.body[part] = Math.max(0, Math.round((p.body[part] - HEAL_PER_DAY * k * takes(p, part) * days) * 1000) / 1000);
      if (!p.body[part]) { delete p.body[part]; if (p.tended) delete p.tended[part]; }
    }
  }
  // (a break knitted and the limb whole again: the splint off, the setting done)
  for (const key of ['splints', 'set']) {
    if (!p[key]) continue;
    for (const k in p[key]) if (!broken(p, k, stateOf) && !(p.injuries ?? []).some(i => i.part === k && i.kind === 'crack')) { delete p[key][k]; if (key === 'splints') out.push({ text: `The splint off the ${SIDE[k]} ${k.startsWith('arm') ? 'arm' : 'leg'}: it's knitted.`, tone: 'note' }); }
    if (!Object.keys(p[key]).length) delete p[key];
  }
  if (p.tended && !Object.keys(p.tended).length) delete p.tended;
}
