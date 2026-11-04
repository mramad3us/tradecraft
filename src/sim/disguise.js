// TRADECRAFT sim: special equipment, and a disguise (the user, 2026-11-04: "special equipment dead drop (disguise kit with 5
// uses, make this scalable because we will add more later on)"; and of the hunt's markers, "When we implement disguises, we
// will be able to change our face description+age+build (1 description, disguises will allow us to alter all three
// depending on how good the disguise is)").
//
// **Equipment** (EQUIPMENT: its name, how many uses a delivery brings, what it costs of the agency's support, sim/support.js;
// a new kind is a new entry here, and a way to use it): carried as uses (p.equip: { kind: uses left }), delivered at the
// agency's dead drops (sim/dial.js).
// **A disguise kit**: a use puts a disguise on (wear()): the hair another colour (a wig, a rinse), glasses on or off, a
// moustache on a man without a beard, or off: what a witness says of you (sim/hunt.js whoOf()) is someone else's; how good
// it is (quality(): by Tradecraft and Deception, DISGUISE_Q) is what an officer's look has to see through (the hunt's
// check: sim/hunt.js mods()). Taken off (remove(), no use spent), you're you again, as they described you.
// **Advanced disguises** (0.2's, at the end of the module): a change of face, age and build, kept at a safe house.
import { skill } from './skills.js';
import { check } from './checks.js';

export const EQUIPMENT = { disguise: { name: 'a disguise kit', many: 'disguise kits', uses: 5, as: 5 } };
export const DISGUISE_Q = { base: 0.45, perOs: 1 / 200, perDeception: 1 / 80, min: 0.4, max: 0.95 };
const HAIRS = [0x14151c, 0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb9862e, 0xd6ad7a, 0xc4bba9];

/** How good a disguise p would put on now, 0 … 1. */
export const quality = (p) => Math.max(DISGUISE_Q.min, Math.min(DISGUISE_Q.max, DISGUISE_Q.base + (p.os ?? 20) * DISGUISE_Q.perOs + skill(p, 'deception') * DISGUISE_Q.perDeception));
/** The disguise p has on: its quality, 0 (none) … 1. */
export const disguiseOf = (p) => p?.disguise?.q ?? 0;

/** A disguise put on from the kit (a use spent): its line, or null (none left, or one on already). */
export function wear(p) {
  if (!p?.look || p.disguise || !(p.equip?.disguise > 0)) return null;
  p.equip.disguise--;
  const L = p.look, was = { hair: structuredClone(L.hair ?? null), glasses: L.glasses ?? null, moustache: !!L.moustache };
  const scarf = L.hat?.kind === 'hijab', said = [];
  if (!scarf && L.hair && L.hair.style !== 'bald') {
    const i = HAIRS.indexOf(L.hair.color), color = HAIRS[(i < 0 ? 2 : i + 3) % HAIRS.length];
    L.hair = { ...L.hair, color };
    said.push('the hair another colour');
  } else if (!scarf && L.hair?.style === 'bald') { L.hair = { ...L.hair, style: 'short', color: 0x47302a }; said.push('a wig'); }
  if (L.glasses) { delete L.glasses; said.push('no glasses'); } else { L.glasses = 'specs'; said.push('glasses'); }
  if (p.sex === 'm' && !L.beard) { if (L.moustache) delete L.moustache; else L.moustache = true; said.push(L.moustache ? 'a moustache' : 'the moustache off'); }
  p.disguise = { q: quality(p), was };
  return `In a mirror, five minutes: ${said.join(', ')}. ${p.disguise.q >= 0.8 ? 'Someone else looks back.' : p.disguise.q >= 0.6 ? 'Not quite you.' : 'You, if anyone looks closely.'} (${p.equip.disguise} use${p.equip.disguise === 1 ? '' : 's'} left in the kit.)`;
}

/** The disguise off: you again. Its line, or null (none on). An advanced one, spent (put back at its safe house: sim/scenarios/campaign.js). */
export function remove(p) {
  if (!p?.disguise) return null;
  const W = p.disguise.was, L = p.look, adv = !!p.disguise.adv;
  if (W.hair) L.hair = W.hair;
  if (W.glasses) L.glasses = W.glasses; else delete L.glasses;
  if (W.moustache) L.moustache = true; else delete L.moustache;
  if (adv) { if (W.beard) L.beard = W.beard; else delete L.beard; }
  delete p.disguise;
  return adv ? 'The latex off at a basin, in strips, the glue with it: you again, as they described you, and that face is gone for good.' : 'The wig, the glasses, the rest of it off and into a pocket: you again, as they described you.';
}

// **Advanced disguises** (0.2's, docs/POSTINGS.md; the user, 2026-11-04: "we will be able to change our face description+age+build
// (1 description, disguises will allow us to alter all three depending on how good the disguise is)"; "disguises will begin at
// officer level when we have to manage networks"). A change of look beyond a coat or a kit's rinse (LOOKS: older, heavier, another
// face; each what it makes of your age, your build and your face, and what shows of it on you), made by the agency's disguise
// officer (sim/dial.js: ADV_AS of the support, from a handler's posting on, one with a network to run) and kept at a safe house:
// put on there (ADV_ON_MIN), taken off anywhere (ADV_OFF_MIN; spent, unless it's at its own safe house, put back for the next
// time). How good it is (advQuality(): the disguise officer's craft, ADV_Q, and your Deception to wear it) is on your side of an
// officer's look (ADV_MOD × it, sim/hunt.js mods()), and the description they have isn't yours (sim/hunt.js whoOf(): the age, the
// build, the face it gives you). A good eye reads through it (readThrough(): their Awareness against ADV_READ.base + quality ×
// ADV_READ.k): then it's no disguise, and a reason to look again (ADV_SEEN).
export const LOOKS = {
  older: { name: 'Fifteen years older', age: 15, build: null, face: 'lined', hair: 0xc4bba9, glasses: 'specs', words: 'grey at the temples, lines at the eyes, a slower walk' },
  heavier: { name: 'A heavier build', age: 5, build: 'heavy', face: 'jowl', words: 'a stone of padding, a jowl, a heavier walk' },
  other: { name: 'Another face', age: 0, build: null, face: 'other', beard: true, words: 'another nose, other brows, a beard' },
};
export const ADV_AS = 15, ADV_H = [6, 12], ADV_ON_MIN = 30, ADV_OFF_MIN = 5, ADV_MOD = 8, ADV_SEEN = -3;
export const ADV_Q = { base: 0.5, perOs: 1 / 500, perDeception: 1 / 150, max: 0.97 };
export const ADV_READ = { base: 14, k: 20 };

/** How good an advanced disguise is, made for p: 0 … ADV_Q.max. */
export const advQuality = (p) => Math.round(Math.min(ADV_Q.max, ADV_Q.base + (p?.os ?? 20) * ADV_Q.perOs + skill(p, 'deception') * ADV_Q.perDeception) * 100) / 100;
/** The advanced disguise p has on: { id, look, age, build, face, house }, or null. */
export const advancedOf = (p) => p?.disguise?.adv ?? null;
/** The disguises a safe house keeps, made by the agency's disguise officer for p: [{ id, look, q }]. */
export const madeFor = (p, at) => Object.keys(LOOKS).map(k => ({ id: `${k}${at}`, look: k, q: advQuality(p) }));

/** An advanced disguise d ({ id, look, q }) put on, from safe house `house`: its line, or null (one on already). */
export function wearAdvanced(p, d, house) {
  if (!p?.look || p.disguise || !d || !LOOKS[d.look]) return null;
  const L = p.look, A = LOOKS[d.look], was = { hair: structuredClone(L.hair ?? null), glasses: L.glasses ?? null, moustache: !!L.moustache, beard: L.beard ?? null };
  if (A.hair && L.hair) L.hair = { ...L.hair, color: A.hair, style: L.hair.style === 'bald' ? 'short' : L.hair.style };
  if (A.glasses) L.glasses = A.glasses;
  if (A.beard && p.sex === 'm') L.beard = 'full';
  else if (A.beard) L.glasses = L.glasses ? undefined : 'specs';
  if (L.glasses === undefined) delete L.glasses;
  p.disguise = { q: d.q, was, adv: { id: d.id, look: d.look, age: A.age, build: A.build, face: A.face, house, q: d.q } };
  return `Half an hour at the mirror with the latex and the glue: ${A.words}. ${d.q >= 0.85 ? 'A stranger looks back, and a stranger\'s age.' : d.q >= 0.7 ? 'Someone else, unless they look hard.' : 'Someone else, from across a street.'}`;
}

/** Whether them (an officer's sheet) reads through p's advanced disguise: { roll, through } (none on: null). */
export function readThrough(rng, them, p) {
  const A = advancedOf(p);
  if (!A) return null;
  const roll = check(rng, { skill: 'awareness', value: skill(them, 'awareness'), dc: Math.round(ADV_READ.base + A.q * ADV_READ.k), body: them });
  return { roll, through: roll.ok };
}
