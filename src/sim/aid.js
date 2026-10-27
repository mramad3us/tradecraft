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
// On yourself SELF_MOD; with a wounded or broken arm, one-handed, ONE_HAND_MOD. It takes the time it
// takes (DRESS_S…), stooped over it; moving stops it (the effect's already made).
//   - Rest (yourself, nothing bleeding, the blood down; where the scene lets the clock go: the free
//     walk's state.scenario.rest): sit somewhere warm, something sweet to drink, REST_H hours at most,
//     the blood back REGEN_PER_H an hour (sim/health.js); the game skips the clock (sim/game.js).
// bodyLine() is the instinct's word on your own body: bleeding, the blood lost, H to tend it.
import { check } from './checks.js';
import { TICK_MS } from './clock.js';
import { skill } from './skills.js';
import { say } from './log.js';
import { stateOf, bleedRate, bandOf, bloodOf, bleeding, BLOOD, REGEN_PER_H } from './health.js';
import { weaponOf } from './weapons.js';

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
export const SECONDS = { dress: 45, tourniquet: 25, splint: 120 };
const LIMBS = ['armL', 'armR', 'legL', 'legR'];
const SIDE = { armL: 'left arm', armR: 'right arm', legL: 'left leg', legR: 'right leg' };

const depth = (i) => (i.artery ? 'artery' : i.deep ? 'deep' : 'shallow');
/** Something rigid to splint with, in the hand or carried. */
const rigid = (p) => [p.hand, ...(p.items ?? [])].find(k => weaponOf(k)?.splint) ?? null;
const oneHanded = (p) => ['armL', 'armR'].some(k => ['wounded', 'out'].includes(stateOf(p, k)) || p.tourniquets?.[k]);

/** What can be done for patient (a sheet) by medic (a sheet): [{ key, label, ok, why }] (key: 'method:i', i the injury's index, or the limb). */
export function options(state, medic, patient) {
  const ms = state.time.ms, out = [];
  const bleeds = (patient.injuries ?? []).map((i, n) => [i, n]).filter(([i]) => i.bleed > ms);
  for (const [i, n] of bleeds) {
    out.push({ key: `pressure:${n}`, label: `Press on ${i.name}`, ok: true });
    if (!i.dressed || i.artery) out.push({ key: `dress:${n}`, label: `Dress ${i.name}`, ok: true, why: `a strip of your shirt (${IMPROVISED} to the check${i.tries ? `; ${RETRY_MOD * i.tries} for the tries before` : ''})` });
    if (i.part !== 'head' && i.part !== 'torso' && (i.artery || i.deep)) out.push({ key: `tourniquet:${n}`, label: `A tourniquet above ${i.name}`, ok: true, why: `your belt (${IMPROVISED}); the limb's no use while it's on` });
  }
  for (const k of LIMBS) {
    const broken = stateOf(patient, k) === 'out' || (patient.injuries ?? []).some(i => i.part === k && i.kind === 'fracture');
    if (!broken || patient.splints?.[k]) continue;
    const r = rigid(medic);
    out.push({ key: `splint:${k}`, label: `Splint the ${SIDE[k]}`, ok: !!r, why: r ? `with ${weaponOf(r).name}` : 'something rigid to splint it with: a stick, a pipe, an umbrella' });
  }
  if (medic === patient && !bleeds.length && bloodOf(patient) < 100) {
    const h = restHours(patient);
    out.push({ key: 'rest:0', label: `Rest ${h} hour${h === 1 ? '' : 's'}: somewhere warm, something sweet to drink`, ok: !!state.scenario.rest, why: state.scenario.rest ? `the blood back to ${Math.round(Math.min(100, bloodOf(patient) + h * REGEN_PER_H))}%` : 'not now: the time\'s not yours' });
  }
  return out;
}
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
    return { rest: restHours(patient) * 3600000 };
  }
  if (method === 'dress' || method === 'tourniquet') {
    const i = patient.injuries?.[Number(arg)];
    if (!i || !(i.bleed > ms)) return null;
    const r = method === 'dress' ? roll(DRESS_DC[depth(i)], [{ why: 'a strip of your shirt', v: IMPROVISED }, i.tries && { why: 'soaked from the tries before', v: RETRY_MOD * i.tries }].filter(Boolean)) : roll(TOURNIQUET_DC, [{ why: 'a belt for a tourniquet', v: IMPROVISED }]);
    stoop(SECONDS[method], method);
    let text;
    if (method === 'tourniquet') {
      if (r.ok) { i.bleed = ms; (patient.tourniquets ??= {})[i.part] = { ms }; text = `You cinch a belt above ${whose} ${SIDE[i.part]} until it stops. It'll cost the limb if it stays on too long: a hospital, soon.`; }
      else text = `You get the belt round ${whose} ${SIDE[i.part]}, but it won't go tight enough. Still bleeding.`;
    } else if (r.ok) {
      if (i.artery) { i.rate = Math.round(i.rate * ARTERY_HELD * 100) / 100; i.dressed = true; text = `You pack it and bind it hard. It slows, but an artery won't stop for a dressing: a tourniquet, or a surgeon.`; }
      else { i.bleed = ms; i.dressed = true; text = `You tear a strip from your shirt and bind ${self ? 'it' : 'the wound'} tight. The bleeding stops.`; }
    } else { i.tries = (i.tries ?? 0) + 1; text = 'You bind it, but it soaks through in a minute: not tight enough, not in the right place. No better, and messier.'; }
    say(state, bus, { kind: 'roll', roll: r, text });
    return r;
  }
  if (method === 'splint') {
    const k = arg, with_ = rigid(medic);
    if (!with_) return null;
    const r = roll(SPLINT_DC, [{ why: 'a strip of your shirt to tie it', v: IMPROVISED }]);
    stoop(SECONDS.splint, 'splint');
    if (r.ok) (patient.splints ??= {})[k] = { ms };
    say(state, bus, { kind: 'roll', roll: r, text: r.ok ? `You splint ${whose} ${SIDE[k]} with ${weaponOf(with_).name} and strips of shirt. It'll hold, and hurt less used.` : `You try to splint ${whose} ${SIDE[k]}; it won't sit straight, and it hurts more than it helps.` });
    return r;
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
  return null;
}

export { BLOOD };
