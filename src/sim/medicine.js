// TRADECRAFT sim: what tends a body, and what an untended one goes through (the user, 2026-10-28: "introduce
// bandages and other healing furniture that we should be able to use on relevant wounds (bandage a bleeding
// wound, disinfect wide wound, apply poultry to bruises etc, set broken limbs etc.), Implement a robust
// health system inspired by Rimworld and Project Zomboid"). The body itself, its parts and injuries and
// blood, is sim/health.js, which runs the days through what's here (heal()); the hands-on care, sim/aid.js.
//
// **Supplies** (SUPPLIES; p.kit: { kind: uses left }): bandages, antiseptic, a suture kit, a splint, a
// tourniquet, painkillers, an arnica poultice, a course of antibiotics; a first-aid kit (KIT) is some of
// the common ones. A chemist's counter sells them all, a grocer's bandages and painkillers (sim/clothes.js
// GOODS); they're carried counted, not placed (sim/clothes.js carry()). The flat's bathroom cabinet has a few
// from the first day (CABINET; taken at the basin: sim/scenarios/campaign.js).
// **What wants care** (needsCare()): an open gash (a deep cut, an artery) neither stitched nor bandaged; an
// infected wound; a broken arm or leg not splinted. Until it has it, it doesn't knit (knitOf(): a deep cut
// open to the air doesn't close; an infected wound doesn't mend; an unsplinted break knits at half the
// pace), and a wounded part doesn't mend at all (sim/health.js heal(): only once tended, p.tended[part],
// with nothing on it wanting care). Stitches knit a deep cut KNIT_STITCHED as fast.
// **Infection** (infectDays()): an open wound (OPEN: a cut of any depth, a split brow) starts dirty: the
// street, the blade, the knuckles. It may go bad (INFECT_P a day, by depth: a hazard summed day by day
// against a threshold the dice set when it was made, i.risk, so a night's sleep or a minute's walk count
// the same): less under a fresh bandage (one goes dirty in BANDAGE_DIRTY_H, a strip of shirt is dirty from
// the start), hardly at all once cleaned with antiseptic; stitched clean, less; stitched dirty, the dirt's
// sewn in; less as it closes (after CLOSING_DAYS). Infected, it's a race (INFECTION): it grows by its depth
// a day, the body fights back (IMMUNE, and Fitness), a course of antibiotics more. A shallow cut's
// infection a body wins; a deep one's it loses, slowly, unless it's fit: feverish (−1 to everything), a high
// fever (−2), delirious (−4), and at INFECTION.sepsis, dead (sim/health.js kill()). An infected wound
// doesn't mend. Off the map, people see their own doctors (heal()'s tended): no infection there.
// **Pain** (painOf(): points, PAIN, by the parts' states and the injuries; infection adds to it): past
// PAIN_BANDS it costs every roll but a fight's (adrenaline: you feel it after; sim/health.js mods()): −1
// in pain, −2 bad pain, −3 agony. Painkillers (DOSE_H) take most of it away for a while; a splinted break
// hurts half as much, a poulticed part half as much (POULTICE_H). Timed things (a dose, a poultice, a
// course) are cleared when they run out (expire(), with the days), so the rolls read them as they stand.
// **Scars** (p.scars: [{ part, name, v }]; scarOf()): what healing leaves. A break that knitted without
// being set knits crooked (v −1 to what the part does, for good: sim/health.js mods()); a deep cut never
// stitched leaves a scar (v 0: it's on your face, or your arm, and stays).
import { stream, next } from './rng.js';
import { DAY, HOUR } from './clock.js';
import { skill } from './skills.js';

export const SUPPLIES = {
  bandage: { name: 'a bandage', many: 'bandages', uses: 1, usd: 3 },
  antiseptic: { name: 'antiseptic', unit: 'uses', uses: 6, usd: 6 },
  sutures: { name: 'a suture kit', unit: 'uses', uses: 3, usd: 25 },
  splint: { name: 'a splint', many: 'splints', uses: 1, usd: 15 },
  tourniquet: { name: 'a tourniquet', many: 'tourniquets', uses: 1, usd: 20 },
  painkillers: { name: 'painkillers', unit: 'doses', uses: 10, usd: 5 },
  poultice: { name: 'an arnica poultice', unit: 'uses', uses: 3, usd: 6 },
  antibiotics: { name: 'a course of antibiotics', many: 'courses of antibiotics', uses: 1, usd: 30 },
};
// (what a counter sells, of these: a chemist's everything and a first-aid kit; a grocer's the everyday)
export const SOLD = { pharmacy: ['firstaid', ...Object.keys(SUPPLIES)], grocery: ['bandage', 'painkillers'] };
export const KIT = { bandage: 4, antiseptic: 3, painkillers: 4, poultice: 1 }, KIT_USD = 28;
export const CABINET = { bandage: 2, antiseptic: 3, painkillers: 6 };

export const OPEN = new Set(['cut', 'split']);
export const BANDAGE_DIRTY_H = 24, POULTICE_H = 24, DOSE_H = 6, DOSE_AGAIN_H = 4, ANTIBIOTIC_DAYS = 5;
export const INFECT_P = { artery: 0.12, deep: 0.12, cut: 0.04, split: 0.015 };   // (a day's chance, dirty and untended)
export const CLOSING_DAYS = 4;
export const INFECTION = { start: 12, grow: { artery: 20, deep: 20, cut: 5, split: 4 }, drugs: 30, clean: 8, sepsis: 100 };
export const IMMUNE = { base: 12, fitness: 0.5 };                     // (a day's fight back: base + Fitness × this)
export const FEVER = [[80, 'delirious with fever', -4], [55, 'a high fever', -2], [25, 'feverish', -1]];
export const PAIN = { bruised: 3, hurt: 9, wounded: 18, out: 30, crack: 8, fracture: 22, cut: 3, deep: 10, artery: 12, split: 2, nose: 1 };
export const PAIN_BANDS = [[70, 'agony', -3], [45, 'bad pain', -2], [25, 'in pain', -1]];
export const KNIT_STITCHED = 1.6, KNIT_UNSPLINTED = 0.5;
const LIMBS = ['armL', 'armR', 'legL', 'legR'];
const SIDE = { armL: 'left', armR: 'right', legL: 'left', legR: 'right' };

/** Uses of a supply someone carries. */
export const kitOf = (p, kind) => p?.kit?.[kind] ?? 0;

/** Use one of a supply. Returns whether there was one. */
export function useSupply(p, kind) {
  if (!(kitOf(p, kind) > 0)) return false;
  if (!--p.kit[kind]) delete p.kit[kind];
  if (!Object.keys(p.kit).length) delete p.kit;
  return true;
}

/** Supplies come in: a kind's uses (a first-aid kit: its contents), or a set of them ({ kind: uses }). */
export function addSupply(p, kind) {
  const add = (k, n) => { if (n > 0) (p.kit ??= {})[k] = (p.kit[k] ?? 0) + n; };
  if (typeof kind === 'object') for (const [k, n] of Object.entries(kind)) add(k, n);
  else if (kind === 'firstaid') for (const [k, n] of Object.entries(KIT)) add(k, n);
  else if (SUPPLIES[kind]) add(kind, SUPPLIES[kind].uses);
}

/** What a kind is called at a counter ('a first-aid kit: …'), and its price in dollars. */
const COUNTER = { antiseptic: 'a bottle of antiseptic', painkillers: 'a packet of painkillers', antibiotics: 'a course of antibiotics (the chemist doesn\'t ask for the prescription)', sutures: 'a suture kit: needles, thread, forceps', splint: 'a splint, folding, and its straps' };
export const goodOf = (kind) => (kind === 'firstaid' ? ['a first-aid kit: bandages, antiseptic, painkillers, a poultice', KIT_USD] : [COUNTER[kind] ?? SUPPLIES[kind].name, SUPPLIES[kind].usd]);

/** One supply in words, with how much of it ('3 bandages', 'antiseptic (5 uses)'). */
export const supplyWord = (k, n) => (SUPPLIES[k].unit ? `${SUPPLIES[k].name} (${n} ${n === 1 ? SUPPLIES[k].unit.replace(/s$/, '') : SUPPLIES[k].unit})` : n === 1 ? SUPPLIES[k].name : `${n} ${SUPPLIES[k].many}`);
/** The supplies on someone, in words, or ''. */
export const kitWords = (kit) => Object.entries(kit ?? {}).filter(([k, n]) => n > 0 && SUPPLIES[k]).map(([k, n]) => supplyWord(k, n)).join(', ');

/** Whether an injury is an open wound; its depth ('artery' | 'deep' | 'cut' | 'split'). */
export const isOpen = (i) => OPEN.has(i.kind);
export const depthOf = (i) => (i.artery ? 'artery' : i.deep ? 'deep' : i.kind);
const gash = (i) => i.kind === 'cut' && (i.deep || i.artery);
/** A wound's dressing: 'fresh', 'dirty' (a day old, or a strip of shirt: wants changing), or null. */
export const bandageOf = (i, ms) => (!i.bandage ? null : i.rag || ms - i.bandage > BANDAGE_DIRTY_H * HOUR ? 'dirty' : 'fresh');
/** Whether a limb is broken (out, or a fracture on it). */
export const broken = (p, k, stateOf) => stateOf(p, k) === 'out' || (p.injuries ?? []).some(i => i.part === k && i.kind === 'fracture');

/** What on a part wants care, in words, or null (stateOf: sim/health.js's, passed in). */
export function needsCare(p, part, stateOf) {
  for (const i of p.injuries ?? []) {
    if (i.part !== part) continue;
    if (i.infection) return `${i.name}, infected`;
    if (gash(i) && !i.stitched && !i.bandage) return `${i.name}, open`;
  }
  if (LIMBS.includes(part) && broken(p, part, stateOf) && !p.splints?.[part]) return 'a break, unsplinted';
  return null;
}

/** How fast an injury knits, × its days (1 as usual; 0 not at all). tended: off the map, a doctor's. */
export function knitOf(p, i, tended = false) {
  if (tended) return 1;
  if (i.infection) return 0;
  if (gash(i)) return i.stitched ? KNIT_STITCHED : i.bandage ? 1 : 0;
  if (i.kind === 'fracture' && LIMBS.includes(i.part) && !p.splints?.[i.part]) return KNIT_UNSPLINTED;
  return 1;
}

/** Timed things run out (a dose, a poultice, a course of antibiotics) at game time ms. */
export function expire(p, ms) {
  if (p.dosed && p.dosed.until <= ms) delete p.dosed;
  if (p.antibiotics && p.antibiotics <= ms) delete p.antibiotics;
  if (p.poultices) { for (const k in p.poultices) if (p.poultices[k] <= ms) delete p.poultices[k]; if (!Object.keys(p.poultices).length) delete p.poultices; }
}

/** An injury's threshold of infection: the dice's, set by when and where it was made (−ln u: the hazard it takes). */
const threshold = (i, salt) => -Math.log(1 - next(stream('infect', salt, i.ms, i.part, i.kind, i.name)) * 0.999999);

/**
 * days pass for a person, to game time ms: each open wound's risk of going bad, each infection's course
 * (against Fitness, and antibiotics while the course lasts). Returns what changed, for the log
 * ([{ text, tone }]); death by sepsis is the caller's (sim/health.js).
 */
export function infectDays(p, days, ms, salt = '') {
  const out = [];
  if (!(days > 0)) return out;
  const immune = IMMUNE.base + skill(p, 'fitness') * IMMUNE.fitness, drugs = p.antibiotics > ms;
  for (const i of p.injuries ?? []) {
    if (!isOpen(i)) continue;
    const d = depthOf(i);
    if (i.infection) {
      const was = i.infection;
      i.infection = Math.round((was + (INFECTION.grow[d] - immune - (drugs ? INFECTION.drugs : 0)) * days) * 1000) / 1000;
      if (i.infection <= 0) { delete i.infection; out.push({ text: `${cap(i.name)}: the redness has gone down, and the heat. It's clean.`, tone: 'note' }); continue; }
      const f = FEVER.find(([at]) => was < at && i.infection >= at);
      if (f) out.push({ text: `${cap(i.name)} is infected, and it's spreading: ${f[1]}.${drugs ? '' : ' Antibiotics: a chemist\'s.'}`, tone: 'warn' });
      continue;
    }
    // (the day's hazard: by depth; a fresh bandage, cleaned, stitched clean, closing: less)
    const b = bandageOf(i, ms), k = (i.clean ? 0.08 : 1) * (b === 'fresh' ? 0.25 : b === 'dirty' ? 1.1 : 1) * (i.stitched ? (i.clean ? 0.6 : 1.4) : 1) * ((ms - i.ms) / DAY > CLOSING_DAYS ? 0.3 : 1);
    i.risk = (i.risk ?? 0) - Math.log(1 - Math.min(0.99, INFECT_P[d] * k)) * days;
    if (i.risk >= threshold(i, salt)) {
      i.infection = INFECTION.start;
      out.push({ text: `${cap(i.name)} is red and hot to the touch, and weeping. Infected.`, tone: 'warn' });
    }
  }
  return out;
}

/** The worst infection on someone (severity), 0 if none. */
export const infectionOf = (p) => Math.max(0, ...(p?.injuries ?? []).map(i => i.infection ?? 0));
/** Fever, by the worst infection: { word, v } or null. */
export function feverOf(p) {
  const f = FEVER.find(([at]) => infectionOf(p) >= at);
  return f ? { word: f[1], v: f[2] } : null;
}

/** Pain, in points (parts' states by stateOf, sim/health.js's; injuries; splints, poultices, painkillers). */
export function painOf(p, stateOf, parts) {
  let pts = 0;
  for (const part of parts) { const w = PAIN[stateOf(p, part)] ?? 0; pts += p.poultices?.[part] ? w / 2 : w; }
  for (const i of p.injuries ?? []) {
    const w = (i.kind === 'cut' ? PAIN[depthOf(i)] : PAIN[i.kind]) ?? 0;
    pts += ((i.kind === 'fracture' || i.kind === 'crack') && p.splints?.[i.part] ? w / 2 : w) + (i.infection ?? 0) / 6;
  }
  return p.dosed ? pts * 0.4 : pts;
}
/** Pain's cost, by its points: { word, v } or null. */
export const painBand = (pts) => { const b = PAIN_BANDS.find(([at]) => pts >= at); return b ? { word: b[1], v: b[2] } : null; };

/** What an injury healed leaves, or null: a break knitted unset, crooked; a deep cut never stitched, a scar. */
export function scarOf(p, i) {
  const limb = LIMBS.includes(i.part) ? `${SIDE[i.part]} ${i.part.startsWith('arm') ? 'forearm' : 'shin'}` : null;
  if (i.kind === 'fracture' && limb && !p.set?.[i.part]) return { part: i.part, name: `an old break in the ${limb}, badly set`, v: -1 };
  if (gash(i) && !i.stitched) return { part: i.part, name: i.part === 'head' ? 'a scar across the face' : i.part === 'torso' ? 'a scar on the ribs' : `a scar on the ${SIDE[i.part]} ${i.part.startsWith('arm') ? 'arm' : 'leg'}`, v: 0 };
  return null;
}

/**
 * A professional's care (the embassy's nurse, a hospital: sim/aid.js), at game time ms: every open wound
 * cleaned, a gash stitched (an artery tied off), all bandaged, the bleeding stopped; a break set and
 * splinted; a tourniquet off; an infection on a course of antibiotics; painkillers; every hurt part tended.
 * stitchArtery: whether they can tie off an artery (a nurse can't: a hospital can). Returns what was done, in words.
 */
export function fullCare(p, ms, { stitchArtery = true } = {}, stateOf = null) {
  const done = new Set();
  for (const i of p.injuries ?? []) {
    if (isOpen(i)) { if (!i.clean) done.add('cleaned'); i.clean = true; delete i.rag; i.bandage = ms; i.dressed = true; if (i.infection) i.infection = Math.max(1, i.infection - INFECTION.clean); }
    if (gash(i) && !i.stitched && (!i.artery || stitchArtery)) { i.stitched = ms; done.add('stitched'); }
    if (i.bleed > ms && (!i.artery || i.stitched)) i.bleed = ms;
    if (i.kind === 'fracture' && LIMBS.includes(i.part)) { (p.set ??= {})[i.part] = { ms }; (p.splints ??= {})[i.part] = { ms }; done.add('set and splinted'); }
  }
  for (const k of LIMBS) if (stateOf && stateOf(p, k) === 'out') { (p.set ??= {})[k] ??= { ms }; (p.splints ??= {})[k] ??= { ms }; done.add('set and splinted'); }
  if (p.tourniquets && Object.keys(p.tourniquets).every(k => !(p.injuries ?? []).some(i => i.part === k && i.artery && !i.stitched))) { delete p.tourniquets; done.add('the tourniquet off'); }
  if (infectionOf(p)) { p.antibiotics = ms + ANTIBIOTIC_DAYS * DAY; done.add('antibiotics'); }
  if ((p.injuries ?? []).length || p.body) { p.dosed = { at: ms, until: ms + DOSE_H * HOUR }; for (const k of Object.keys(p.body ?? {})) (p.tended ??= {})[k] = ms; for (const i of p.injuries ?? []) (p.tended ??= {})[i.part] = ms; }
  return [...done];
}

/** Whether someone has a wound a hospital would report: a cut by a blade, deep, a stab. */
export const reportable = (p) => (p.injuries ?? []).some(i => i.kind === 'cut' && (i.deep || i.artery));

/** An injury's care, in words ('stitched, a fresh bandage', 'infected', ''), at game time ms. */
export function careWords(p, i, ms) {
  const w = [];
  if (i.infection) w.push(FEVER.find(([at]) => i.infection >= at) ? 'infected, spreading' : 'infected');
  if (i.stitched) w.push('stitched');
  if (i.clean && !i.infection) w.push('cleaned');
  const b = bandageOf(i, ms);
  if (b) w.push(i.rag ? 'bound with a strip of shirt' : b === 'fresh' ? 'bandaged' : 'the bandage dirty');
  if (i.kind === 'fracture' || i.kind === 'crack') { if (p.set?.[i.part] && i.kind === 'fracture') w.push('set'); if (p.splints?.[i.part]) w.push('splinted'); }
  return w.join(', ');
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
