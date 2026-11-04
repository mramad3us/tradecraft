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
import { skill } from './skills.js';

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

/** The disguise off: you again. Its line, or null (none on). */
export function remove(p) {
  if (!p?.disguise) return null;
  const W = p.disguise.was, L = p.look;
  if (W.hair) L.hair = W.hair;
  if (W.glasses) L.glasses = W.glasses; else delete L.glasses;
  if (W.moustache) L.moustache = true; else delete L.moustache;
  delete p.disguise;
  return 'The wig, the glasses, the rest of it off and into a pocket: you again, as they described you.';
}
