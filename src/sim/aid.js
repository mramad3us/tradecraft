// TRADECRAFT sim: first aid (the user, 2026-10-26: "bandaging, splinting and other kinds of medical first
// aid. Also make sure we have the right skills to drive how good we are with medical stuff"): Medicine
// (sim/skills.js) drives it. For yourself (H) or for someone at hand (F, First aid): options() lists
// what can be done, each greyed with why when it can't; treat() does it.
//   - Press on it: hands on the wound; while you hold still (PRESS_S), it bleeds PRESSURE_K as fast
//     (sim/game.js bloodBeat()). No roll.
//   - Dress it: a pressure dressing; with nothing better, a strip torn from your shirt (IMPROVISED).
//     A Medicine check against DRESS_DC by the wound (shallow, deep, an artery); made, a cut stops
//     bleeding, an artery slows to ARTERY_HELD of its rate (a dressing alone won't hold it); missed,
//     it soaks through and nothing's changed, and the next try on that wound is RETRY_MOD harder
//     (a soaked, messy wound).
//   - Tourniquet (an arm or a leg): your belt, against TOURNIQUET_DC; made, it stops, but the limb's
//     no use while it's on (sim/health.js mods(): as broken), until a hospital takes it off.
//   - Splint it (a broken arm or leg, a fracture): something rigid (sim/weapons.js splint: a stick, a
//     pipe, an umbrella, a crowbar) and a strip to tie it, against SPLINT_DC; made, the break costs
//     half (sim/health.js mods()).
// With supplies (sim/medicine.js; the user, 2026-10-28: "bandage a bleeding wound, disinfect wide wound,
// apply poultry to bruises etc, set broken limbs etc."), each where it fits:
//   - A bandage, for the strip of shirt: no IMPROVISED, and it keeps a wound clean (a strip is dirty from
//     the start); on a wound that's stopped bleeding, a bandage put on or changed (a day old, it's dirty).
//   - Antiseptic: an open wound cleaned (no roll): it hardly goes bad after; on an infected one, a little
//     of the infection off (INFECTION.clean).
//   - A suture kit: a deep cut stitched (STITCH_DC; an artery tied off first, harder; on the face, finer
//     work): the bleeding stops, it knits faster and leaves no scar. Clean it first: stitched dirty, the
//     dirt's sewn in.
//   - A tourniquet, for the belt: no IMPROVISED. Loosened, what's under it bleeds again, unless the
//     artery's tied off; left on past two hours, the limb starves (sim/health.js).
//   - Set the bone (a broken arm or leg; SET_DC; it hurts): set, it knits straight; not, crooked, for
//     good (sim/medicine.js scarOf()). A splint (the kit's, for something rigid and strips of shirt).
//   - An arnica poultice on a part bruised, hurt or wounded: the pain halved and the mending faster for a
//     day (sim/medicine.js POULTICE_H).
//   - Painkillers (no sooner than DOSE_AGAIN_H after the last), a course of antibiotics (an infection, or
//     a deep wound).
// Any care given to a part marks it tended (p.tended): a wound mends only once tended (sim/health.js).
// On yourself SELF_MOD; with a wounded or broken arm, one-handed, ONE_HAND_MOD. It takes the time it
// takes (SECONDS), stooped over it; moving stops it (the effect's already made).
//   - Rest (yourself, nothing bleeding, the blood down; where the scene lets the clock go: the free
//     walk's state.scenario.rest): sit somewhere warm, something sweet to drink, REST_H hours at most,
//     the blood back REGEN_PER_H an hour (sim/health.js); the game skips the clock (sim/game.js).
// bodyLine() is the instinct's word on your own body: bleeding, the blood lost, H to tend it.
import { check } from './checks.js';
import { TICK_MS } from './clock.js';
import { skill } from './skills.js';
import { say } from './log.js';
import { stateOf, bleedRate, bandOf, bloodOf, bleeding, PARTS, BLOOD, REGEN_PER_H } from './health.js';
import { SUPPLIES, kitOf, useSupply, supplyWord, isOpen, depthOf, bandageOf, broken, infectionOf, feverOf, painOf, painBand, needsCare, INFECTION, DOSE_H, DOSE_AGAIN_H, ANTIBIOTIC_DAYS, POULTICE_H } from './medicine.js';
import { DAY, HOUR } from './clock.js';
import { weaponOf } from './weapons.js';
import { eat, needsWords } from './needs.js';

export const PRESSURE_K = 0.35;
export const PRESS_S = 60;
export const DRESS_DC = { shallow: 8, deep: 12, artery: 16 };
export const TOURNIQUET_DC = 10;
export const SPLINT_DC = 12;
export const IMPROVISED = -2;
export const SELF_MOD = -2;
export const ONE_HAND_MOD = -4;
export const ARTERY_HELD = 0.3;
export const RETRY_MOD = -2;
export const REST_H = 8;
export const STITCH_DC = { deep: 13, artery: 18 }, FACE_MOD = -2;
export const SET_DC = 14;
export const SECONDS = { dress: 45, tourniquet: 25, splint: 120, clean: 30, stitch: 240, bandage: 40, set: 60, poultice: 40, painkillers: 5, antibiotics: 5, loosen: 10 };
const LIMBS = ['armL', 'armR', 'legL', 'legR'];
const DEEP_BLEED_H = 6;
const SIDE = { armL: 'left arm', armR: 'right arm', legL: 'left leg', legR: 'right leg' };

const depth = (i) => (i.artery ? 'artery' : i.deep ? 'deep' : 'shallow');
/** Something rigid to splint with, in the hand or carried. */
const rigid = (p) => [p.hand, ...(p.items ?? [])].find(k => weaponOf(k)?.splint) ?? null;
const oneHanded = (p) => ['armL', 'armR'].some(k => ['wounded', 'out'].includes(stateOf(p, k)) || p.tourniquets?.[k]);

/** What can be done for patient (a sheet) by medic (a sheet), with what the medic carries (sim/medicine.js): [{ key, label, ok, why }] (key: 'method:i', i the injury's index, or the limb, or the part). */
export function options(state, medic, patient) {
  const ms = state.time.ms, out = [], has = (k) => kitOf(medic, k), left = (k) => supplyWord(k, has(k));
  const wounds = (patient.injuries ?? []).map((i, n) => [i, n]);
  // (what bleeds, first)
  for (const [i, n] of wounds.filter(([i]) => i.bleed > ms)) {
    out.push({ key: `pressure:${n}`, label: `Press on ${i.name}`, ok: true });
    if (!i.dressed || i.artery) out.push({ key: `dress:${n}`, label: `Bandage ${i.name}`, ok: true, why: has('bandage') ? left('bandage') : `a strip of your shirt (${IMPROVISED} to the check, and it won't keep it clean${i.tries ? `; ${RETRY_MOD * i.tries} for the tries before` : ''})` });
    if (i.part !== 'head' && i.part !== 'torso' && (i.artery || i.deep) && !patient.tourniquets?.[i.part]) out.push({ key: `tourniquet:${n}`, label: `A tourniquet above ${i.name}`, ok: true, why: `${has('tourniquet') ? left('tourniquet') : `your belt (${IMPROVISED})`}; the limb's no use while it's on` });
  }
  // (open wounds: cleaned, stitched, kept bandaged)
  for (const [i, n] of wounds.filter(([i]) => isOpen(i))) {
    const deep = i.kind === 'cut' && (i.deep || i.artery);
    if (!i.clean || i.infection) out.push({ key: `clean:${n}`, label: `Clean ${i.name}${i.infection ? ', infected as it is' : ''}`, ok: has('antiseptic') > 0, why: has('antiseptic') ? `${left('antiseptic')}: it stings` : 'antiseptic, from a chemist\'s' });
    if (deep && !i.stitched) out.push({ key: `stitch:${n}`, label: i.artery ? `Tie off the artery and stitch ${i.name}` : `Stitch ${i.name}`, ok: has('sutures') > 0, why: has('sutures') ? `${left('sutures')}${i.clean ? '' : '; clean it first, or the dirt\'s sewn in'}` : 'a suture kit, from a chemist\'s' });
    const b = bandageOf(i, ms);
    if (!(i.bleed > ms) && b !== 'fresh') out.push({ key: `bandage:${n}`, label: `${b ? 'Change the dressing on' : 'Bandage'} ${i.name}`, ok: has('bandage') > 0, why: has('bandage') ? `${left('bandage')}${b ? `: ${i.rag ? 'a strip of shirt isn\'t clean' : 'a day old, and dirty'}` : ': it keeps it clean'}` : 'a bandage, from a chemist\'s or a grocer\'s' });
  }
  // (a tourniquet on: loosened, what's under it)
  for (const k of Object.keys(patient.tourniquets ?? {})) {
    const under = wounds.find(([i]) => i.part === k && i.artery)?.[0];
    out.push({ key: `loosen:${k}`, label: `Loosen the tourniquet on the ${SIDE[k]}`, ok: true, why: !under || under.stitched ? 'nothing under it to bleed now' : `the artery under it will bleed again${(state.time.ms - patient.tourniquets[k].ms) / HOUR > 1.5 ? '; but it\'s been on too long' : ''}` });
  }
  // (breaks: set, splinted; a cracked limb splinted, for the pain)
  for (const k of LIMBS) {
    const brk = broken(patient, k, stateOf), crack = (patient.injuries ?? []).some(i => i.part === k && i.kind === 'crack');
    if (brk && !patient.set?.[k]) out.push({ key: `set:${k}`, label: `Set the bone in the ${SIDE[k]}`, ok: true, why: `Medicine against ${SET_DC}, and it hurts; set, it knits straight` });
    if ((brk || crack) && !patient.splints?.[k]) {
      const r = rigid(medic);
      out.push({ key: `splint:${k}`, label: `Splint the ${SIDE[k]}`, ok: !!(has('splint') || r), why: has('splint') ? left('splint') : r ? `with ${weaponOf(r).name} and strips of shirt (${IMPROVISED})` : 'a splint, or something rigid: a stick, a pipe, an umbrella' });
    }
  }
  // (bruises and worse: a poultice; then the pills)
  for (const part of Object.keys(PARTS)) {
    const st = stateOf(patient, part);
    if (!['bruised', 'hurt', 'wounded'].includes(st) || patient.poultices?.[part]) continue;
    out.push({ key: `poultice:${part}`, label: `A poultice on the ${PART_WORD[part]}`, ok: has('poultice') > 0, why: has('poultice') ? `${left('poultice')}: ${st}; the swelling down, the pain halved, it mends faster` : `${st}: an arnica poultice, from a chemist's` });
  }
  const pain = painOf(patient, stateOf, Object.keys(PARTS));
  if (pain >= 8) {
    const soon = patient.dosed && (ms - patient.dosed.at) / HOUR < DOSE_AGAIN_H;
    out.push({ key: 'painkillers:0', label: `${medic === patient ? 'Take' : 'Give them'} painkillers`, ok: has('painkillers') > 0 && !soon, why: soon ? `too soon: the last dose is still working (${DOSE_AGAIN_H} hours apart)` : has('painkillers') ? `${left('painkillers')}: most of the pain gone, ${DOSE_H} hours` : 'painkillers, from a chemist\'s or a grocer\'s' });
  }
  if ((infectionOf(patient) || wounds.some(([i]) => i.kind === 'cut' && (i.deep || i.artery))) && !(patient.antibiotics > ms)) out.push({ key: 'antibiotics:0', label: 'Start a course of antibiotics', ok: has('antibiotics') > 0, why: has('antibiotics') ? `${left('antibiotics')}: ${ANTIBIOTIC_DAYS} days${infectionOf(patient) ? '' : ', to be safe'}` : 'antibiotics, from a chemist\'s' });
  if (medic === patient && !wounds.some(([i]) => i.bleed > ms) && bloodOf(patient) < 100) {
    const h = restHours(patient);
    out.push({ key: 'rest:0', label: `Rest ${h} hour${h === 1 ? '' : 's'}: somewhere warm, something sweet to drink`, ok: !!state.scenario.rest, why: state.scenario.rest ? `the blood back to ${Math.round(Math.min(100, bloodOf(patient) + h * REGEN_PER_H))}%` : 'not now: the time\'s not yours' });
  }
  return out;
}
const PART_WORD = { head: 'head', torso: 'ribs', armL: 'left arm', armR: 'right arm', legL: 'left leg', legR: 'right leg' };
/** The hours a rest takes: back out of shock and pale if it can, REST_H at most. */
const restHours = (p) => Math.max(1, Math.min(REST_H, Math.ceil((BLOOD.pale + 1 - bloodOf(p)) / REGEN_PER_H)));

/**
 * Do it: medicActor tends patientActor (the same, for yourself), by key (options()). The roll, the
 * effect, the time it takes (the medic stooped over it), the line in the log. Returns the roll, if any.
 */
export function treat(state, bus, medicActor, patientActor, key) {
  const medic = state.people[medicActor.who], patient = state.people[patientActor.who], ms = state.time.ms;
  const [method, arg] = key.split(':');
  const self = medicActor === patientActor, whose = self ? 'your' : `${patient.known === false ? patient.seen : patient.name.split(' ').slice(-1)[0]}'s`;
  const mods = [self && { why: 'on yourself', v: SELF_MOD }, oneHanded(medic) && { why: 'one-handed', v: ONE_HAND_MOD }].filter(Boolean);
  const roll = (dc, extra = []) => check(state.rng, { skill: 'medicine', value: skill(medic, 'medicine'), body: medic, dc, mods: [...mods, ...extra] });
  // (a busy plan's wait is in ticks)
  const stoop = (s, what) => { medicActor.busy = { what, on: patientActor.id, steps: [['wait', Math.round(s * 1000 / TICK_MS), medicActor.face, 'crouch']], wait: 0, since: ms }; };
  if (method === 'pressure') {
    stoop(PRESS_S, 'pressure');
    say(state, bus, { kind: 'note', text: `You press hard on ${self ? 'it' : 'the wound'}. Hold still a minute: while you do, it bleeds a third as fast. Moving lets go.` });
    return null;
  }
  if (method === 'rest') {
    if (!self || !state.scenario.rest || bleeding(patient, ms)) return null;
    say(state, bus, { kind: 'note', text: 'A café\'s back corner, sweet tea, then another; nothing sudden. The hours go by, and the colour comes back.' });
    eat(patient, ms + restHours(patient) * 3600000, 30);            // (fed, and calmer: sim/needs.js)
    return { rest: restHours(patient) * 3600000 };
  }
  const tend = (part) => { (patient.tended ??= {})[part] = ms; };
  const say_ = (text, r = null) => { say(state, bus, r ? { kind: 'roll', roll: r, text } : { kind: 'note', text }); return r; };
  if (method === 'dress' || method === 'tourniquet') {
    const i = patient.injuries?.[Number(arg)];
    if (!i || !(i.bleed > ms)) return null;
    // (the kit's, if there's one: no penalty; else a strip of shirt, a belt)
    const kit = method === 'dress' ? useSupply(medic, 'bandage') : useSupply(medic, 'tourniquet');
    const r = method === 'dress' ? roll(DRESS_DC[depth(i)], [!kit && { why: 'a strip of your shirt', v: IMPROVISED }, i.tries && { why: 'soaked from the tries before', v: RETRY_MOD * i.tries }].filter(Boolean)) : roll(TOURNIQUET_DC, kit ? [] : [{ why: 'a belt for a tourniquet', v: IMPROVISED }]);
    stoop(SECONDS[method], method);
    tend(i.part);
    let text;
    if (method === 'tourniquet') {
      if (r.ok) { i.bleed = ms; (patient.tourniquets ??= {})[i.part] = { ms }; text = `You cinch ${kit ? 'the tourniquet' : 'a belt'} above ${whose} ${SIDE[i.part]} until it stops. Two hours, no more: tie off the artery and loosen it, or the limb pays.`; }
      else text = `You get ${kit ? 'the tourniquet' : 'the belt'} round ${whose} ${SIDE[i.part]}, but it won't go tight enough. Still bleeding.`;
    } else if (r.ok) {
      Object.assign(i, { dressed: true, bandage: ms }); if (kit) delete i.rag; else i.rag = true;
      if (i.artery) { i.rate = Math.round(i.rate * ARTERY_HELD * 100) / 100; text = `You pack it and bind it hard. It slows, but an artery won't stop for a dressing: a tourniquet, or tie it off.`; }
      else { i.bleed = ms; text = kit ? `You bind ${self ? 'it' : 'the wound'} with a bandage, tight. The bleeding stops.` : `You tear a strip from your shirt and bind ${self ? 'it' : 'the wound'} tight. The bleeding stops; it isn't clean.`; }
    } else { i.tries = (i.tries ?? 0) + 1; text = 'You bind it, but it soaks through in a minute: not tight enough, not in the right place. No better, and messier.'; }
    return say_(text, r);
  }
  if (method === 'clean' || method === 'bandage' || method === 'stitch') {
    const i = patient.injuries?.[Number(arg)];
    if (!i || !isOpen(i)) return null;
    if (method === 'clean') {
      if (!useSupply(medic, 'antiseptic')) return null;
      stoop(SECONDS.clean, 'clean'); tend(i.part);
      i.clean = true;
      if (i.infection) { i.infection = Math.max(1, i.infection - INFECTION.clean); return say_(`You clean ${whose === 'your' ? 'it' : 'the wound'} out, the antiseptic fizzing pink in it. It's still angry: it needs antibiotics.`); }
      return say_(`Antiseptic on ${self ? 'it' : 'the wound'}: it stings like fire, then nothing. Clean.`);
    }
    if (method === 'bandage') {
      if (i.bleed > ms || !useSupply(medic, 'bandage')) return null;
      stoop(SECONDS.bandage, 'bandage'); tend(i.part);
      const was = i.bandage;
      Object.assign(i, { bandage: ms, dressed: true }); delete i.rag;
      return say_(was ? 'The old dressing off, stiff and brown; a fresh one on.' : `A clean bandage over ${i.name}, snug.`);
    }
    if (!(i.kind === 'cut' && (i.deep || i.artery)) || i.stitched || !useSupply(medic, 'sutures')) return null;
    const r = roll(STITCH_DC[i.artery ? 'artery' : 'deep'], [i.part === 'head' && { why: 'the face: fine work', v: FACE_MOD }].filter(Boolean));
    stoop(SECONDS.stitch, 'stitch'); tend(i.part);
    if (r.ok) {
      i.stitched = ms; i.bleed = Math.min(i.bleed, ms);
      return say_(`${i.artery ? 'You find the vessel and tie it off, then close' : 'You close'} ${self ? 'it' : 'the wound'} with a row of neat knots${i.clean ? '' : ': the dirt sewn in with it, mind'}. It'll knit.`, r);
    }
    i.tries = (i.tries ?? 0) + 1;
    return say_('The needle won\'t go where you want it, and the thread pulls through the edge. Nothing closed; one use of the kit gone.', r);
  }
  if (method === 'loosen') {
    const k = arg, t = patient.tourniquets?.[k];
    if (!t) return null;
    delete patient.tourniquets[k]; if (!Object.keys(patient.tourniquets).length) delete patient.tourniquets;
    stoop(SECONDS.loosen, 'loosen');
    const i = (patient.injuries ?? []).find(j => j.part === k && j.artery && !j.stitched);
    if (i) { i.bleed = ms + DEEP_BLEED_H * HOUR; return say_(`You loosen it. The blood comes back into ${whose} ${SIDE[k]}, and out of the wound with it.`); }
    return say_(`You loosen it. The colour comes back into ${whose} ${SIDE[k]}, slowly, pins and needles.`);
  }
  if (method === 'set') {
    const k = arg;
    if (!LIMBS.includes(k) || patient.set?.[k] || !broken(patient, k, stateOf)) return null;
    const r = roll(SET_DC, self ? [{ why: 'your own bone', v: SELF_MOD }] : []);
    stoop(SECONDS.set, 'set'); tend(k);
    if (r.ok) (patient.set ??= {})[k] = { ms };
    return say_(r.ok ? `A pull, a grind, a sound you won't forget, and ${whose} ${SIDE[k]} is straight. It'll knit true.` : `You pull, and it grates and won't go back: not straight. Try again, or it knits as it lies.`, r);
  }
  if (method === 'splint') {
    const k = arg, kit = kitOf(medic, 'splint') > 0, with_ = kit ? null : rigid(medic);
    if (!kit && !with_) return null;
    if (kit) useSupply(medic, 'splint');
    const r = roll(SPLINT_DC, kit ? [] : [{ why: 'a strip of your shirt to tie it', v: IMPROVISED }]);
    stoop(SECONDS.splint, 'splint'); tend(k);
    if (r.ok) (patient.splints ??= {})[k] = { ms };
    return say_(r.ok ? `You splint ${whose} ${SIDE[k]} with ${kit ? 'the splint and its straps' : `${weaponOf(with_).name} and strips of shirt`}. It'll hold, and hurt less used.` : `You try to splint ${whose} ${SIDE[k]}; it won't sit straight, and the knots slip.`, r);
  }
  if (method === 'poultice') {
    if (!PARTS[arg] || !useSupply(medic, 'poultice')) return null;
    stoop(SECONDS.poultice, 'poultice'); tend(arg);
    (patient.poultices ??= {})[arg] = ms + POULTICE_H * HOUR;
    return say_(`An arnica poultice on the ${PART_WORD[arg]}, cool and bitter-smelling, bound on. The ache eases.`);
  }
  if (method === 'painkillers') {
    if (!useSupply(medic, 'painkillers')) return null;
    patient.dosed = { at: ms, until: ms + DOSE_H * HOUR };
    return say_(self ? 'Two pills, dry. In twenty minutes the edges come off everything.' : 'Two pills, and a swallow of water.');
  }
  if (method === 'antibiotics') {
    if (!useSupply(medic, 'antibiotics')) return null;
    patient.antibiotics = ms + ANTIBIOTIC_DAYS * DAY;
    return say_(`The first of the capsules: ${ANTIBIOTIC_DAYS} days of them.`);
  }
  return null;
}

/** The instinct's word on your own body, or null: bleeding (how fast), the blood lost, collapsed. { id, tone, text }. */
export function bodyLine(state) {
  const p = state.people[state.player];
  if (!p || p.dead) return null;
  const rate = bleedRate(p, state.time.ms), band = bandOf(p), b = Math.round(bloodOf(p));
  if (band === 'collapsed') return { id: 'body-collapsed', tone: 'urgent', text: `You're down, and the world's gone grey at the edges. ${b}% of your blood left.${rate > 0 ? ' {aid} stop it, or this is where it ends.' : ' Lie still: it\'ll pass.'}` };
  if (rate >= 8) return { id: 'body-artery', tone: 'urgent', text: `You're bleeding fast, pumping. Minutes, not hours: {aid} tend it now.` };
  if (rate >= 0.8) return { id: 'body-bleeding', tone: band === 'steady' ? 'warn' : 'urgent', text: `You're bleeding${band === 'steady' ? '' : `, and it's telling: ${band === 'pale' ? 'pale, light-headed' : 'shock coming on'}`}. {aid} tend it.` };
  if (band === 'shock') return { id: 'body-shock', tone: 'warn', text: `${b}% of your blood: in shock. No running, and everything's harder. ${state.scenario.rest ? '{aid} rest: hours, somewhere warm.' : 'It comes back with rest: hours, not minutes.'}` };
  if (rate > 0) return { id: 'body-trickle', tone: 'note', text: 'A trickle of blood. It\'ll stop on its own; {aid} tend it, if you like.' };
  if (band === 'pale') return { id: 'body-pale', tone: 'note', text: `${b}% of your blood. Pale, and a little light-headed: it comes back, slowly.` };
  // (what the wounds want: sim/medicine.js)
  const ms = state.time.ms, fever = feverOf(p), inf = (p.injuries ?? []).find(i => i.infection);
  const tq = Object.entries(p.tourniquets ?? {}).find(([, t]) => (ms - t.ms) / HOUR > 1.5);
  if (tq) return { id: 'body-tourniquet', tone: 'urgent', text: `The tourniquet's been on ${Math.floor((ms - tq[1].ms) / HOUR * 2) / 2} hours: your ${SIDE[tq[0]]}'s going cold. Tie the artery off and loosen it ({aid}), or lose the use of it.` };
  if (fever && fever.v <= -2) return { id: 'body-fever', tone: 'urgent', text: `${fever.word === 'a high fever' ? 'Burning up, shaking' : 'The room swims; you\'re not sure of the time'}: ${inf?.name ?? 'the wound'}'s infection is in your blood. Antibiotics, now: a chemist's, then {aid}.` };
  if (inf) return { id: 'body-infected', tone: 'warn', text: `${inf.name.charAt(0).toUpperCase() + inf.name.slice(1)} is infected: hot, red, weeping. Antibiotics (a chemist's), and keep it clean: {aid}.` };
  const gash = (p.injuries ?? []).find(i => i.kind === 'cut' && (i.deep || i.artery) && !i.stitched && !i.bandage);
  if (gash) return { id: 'body-gash', tone: 'warn', text: `${gash.name.charAt(0).toUpperCase() + gash.name.slice(1)}, open to the air: it won't close on its own. Stitch it, or bandage it at least: {aid}.` };
  const brk = LIMBS.find(k => needsCare(p, k, stateOf) === 'a break, unsplinted');
  if (brk) return { id: 'body-break', tone: 'warn', text: `Your ${SIDE[brk]}'s broken, and nothing holds it. Set it, splint it ({aid}): a splint, or something rigid.` };
  const dirty = (p.injuries ?? []).find(i => isOpen(i) && bandageOf(i, ms) === 'dirty');
  if (dirty) return { id: 'body-dressing', tone: 'note', text: `The dressing on ${dirty.name} wants changing: ${dirty.rag ? 'a strip of shirt isn\'t clean' : 'a day old'}. {aid}, with a bandage.` };
  const pain = painBand(painOf(p, stateOf, Object.keys(PARTS)));
  if (pain) return { id: 'body-pain', tone: pain.v <= -2 ? 'warn' : 'note', text: `${pain.word === 'agony' ? 'Agony: it\'s hard to think of anything else' : pain.word === 'bad pain' ? 'It hurts badly, all the time' : 'It hurts'}: ${-pain.v} to everything but a fight. Painkillers take the edge off ({aid}); a splint, a poultice.` };
  if (fever) return { id: 'body-feverish', tone: 'note', text: `Feverish: ${inf?.name ?? 'something\'s'} not right. Antibiotics, a chemist's.` };
  // (wet and cold: sim/wet.js)
  if (p.shiver) return { id: 'body-shiver', tone: 'warn', text: 'Shivering, wet through: −1 to everything. In, somewhere warm, or home for dry clothes; or you\'ll catch something.' };
  if (p.sick?.kind === 'cold' && p.sick.until > ms) return { id: 'body-cold', tone: 'note', text: `A heavy cold: ${p.dosed ? 'the painkillers are holding it off' : '−1 to everything, and you\'ll sneeze. Painkillers take the edge off'}.` };
  if ((p.wet ?? 0) >= 60) return { id: 'body-wet', tone: 'calm', text: 'Wet through. An umbrella, a hood; or in, and dry off.' };
  // (the needs: sim/needs.js)
  const nw = needsWords(p, state.time.ms);
  if (nw.edgy && (p.needs?.stress ?? 0) >= 75) return { id: 'need-frayed', tone: 'warn', text: 'Frayed: your eyes keep going over your shoulder on their own. Somewhere to sit, a hot drink, and it passes.' };
  if (nw.hungry) return { id: 'need-hungry', tone: 'calm', text: `Hungry: ${nw.fed.replace(/^hungry \(|^starving \(/, '').replace(/\)$/, '')} since you ate. A café, a bakery: in, and {use} at the counter: two minutes.` };
  if (nw.edgy) return { id: 'need-edge', tone: 'calm', text: 'On edge. It shows in the little things: a bench, a café, a few minutes, and it eases.' };
  // (nothing bleeding, but it shows: sim/notice.js; a café's toilet washes it off, sim/shops.js)
  if (p.bloody?.face !== undefined) return { id: 'body-bloody', tone: 'note', text: 'Blood on your face: people remember a face like that. A café\'s or a bar\'s toilet will wash it off.' };
  if (p.bloody?.clothes !== undefined) return { id: 'body-stained', tone: 'calm', text: 'Blood on your coat. It shows, if anyone looks: a café\'s toilet, and some scrubbing.' };
  return null;
}

export { BLOOD };
