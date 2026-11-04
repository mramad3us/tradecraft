// TRADECRAFT sim: the city's services, as places on its streets (the user, 2026-11-04: "place several [police]
// stations in cities", to be let out in front of one after an arrest; "place hospitals across the city so we can get
// official healing from stuff like internal bleeding, also a place to respawn when rescued by ambulance. Going to an
// official hospital will increase heat").
//
// **Where they are.** A police station and a hospital are shops of their kinds ('police', 'hospital': sim/cities/*.js,
// each a weight split from a kind beside it, so nothing else on the streets moved), one in every 650 to 900 m of street
// or so: their fronts signed in the city's words (ПОЛИЦИЯ, POLICE STATION, الشرطة, قسم شرطة; БОЛЬНИЦА, HOSPITAL A&E,
// مستشفى), a London station's blue lamp over its door (src/render/town.js); inside (sim/interiors/shop.js), a front desk
// behind glass with its word over it and someone at it in the country's police uniform or a nurse's (deskLook()),
// chairs to wait on, a notice board. nearestDoor() finds the nearest of a kind in the city from a place: its own street
// first, then the streets either side, a street over counted as ROW_WALK_M of walking (as sim/places.js rangeDoor()
// counts it), SERVICE_ROWS either way at most and SERVICE_SECTIONS along, the search stopped as soon as nothing further
// out could be nearer. outside() puts the player on the pavement in front of its door, the street loaded if it's
// another (sim/game.js loadRow()): someone the ambulance took comes out of the hospital nearest where they fell
// (sim/emergency.js afterHospital()); someone the police took in, of their station (sim/armed.js arrest()).
// **A hospital's desk** (sim/shops.js ways(): 'treat'): what a doctor would do for you (needsOf()), each its hours
// (TREAT_H): the wait first (seen at once if it's bad, urgent: bleeding inside, an artery, in shock, bleeding fast; else
// a plastic chair, TREAT_H.wait), then the work: the bleeding inside stopped in theatre, an artery tied off, a bullet's
// wound cleaned out and closed, a deep cut stitched, a break set and plastered, an X-ray for a crack, the blood put back
// (a transfusion, under TRANSFUSE_BELOW), an infection on a drip, cuts cleaned and dressed, a wound looked at;
// TREAT_MAX_H at most. Nothing a doctor's wanted for (a bruise, a hurt, what's already been seen to), the desk says so,
// and no time goes. Taken in (admit()), it's all done at once (care(): nothing bleeds through the wait), and the hours
// are skipped after the tick as an ambulance's patient's are (state.$hospital: sim/emergency.js afterHospital(), from
// sim/game.js), and out in front of its door. What an official hospital costs is counted there, at the end of the
// hours: your name written down (VISIT_HEAT, in the campaign), a gunshot or a knife wound reported to the police
// (sim/aid.js HOSPITAL_HEAT more, and the police's own file: sim/police.js POLICE_HOSPITAL), and if the police have your
// description, an officer waiting in the corridor. admit()'s `official: false` is a doctor who asks no questions (a
// clandestine clinic at a safe house, later: DESIGN.md, Next): the same care and hours, no name taken, nothing
// reported, and where you come out its own (out: a kind of door, or none: you stay where you are).
// **Its imports** are the engine's leaves only (the city, the body, the clock): the shops, the emergency services and
// the police all import this, and they're in one import cycle with the engine's agents; a module of theirs imported
// here would change the order they load in (an agent's planners used before they're made, 2026-11-04). The one thing
// of the engine's it needs, loadRow(), sim/game.js puts in ENGINE as it loads.
import { sectionOf } from './city.js';
import { townOf } from './cities/index.js';
import { bigPlan } from './cities/big.js';
import { policeOf } from './countries/index.js';
import { SECTION_M, Z, streetName } from './map/street.js';
import { fullCare, isOpen, infectionOf, addSupply, DOSE_H } from './medicine.js';
import { stateOf, bloodOf, bleedRate, BLOOD, PARTS, heal, incapacitated, canStand } from './health.js';
import { say } from './log.js';
import { HOUR, DAY } from './clock.js';

// (the engine's own, given by sim/game.js as it loads: see the header)
export const ENGINE = { loadRow: null };
// (what they're called: sim/shops.js WORDS has them too)
export const SERVICE_WORDS = { police: 'the police station', hospital: 'the hospital', clinic: 'the clinic' };
export const SERVICES = ['police', 'clinic', 'hospital'];
export const SERVICE_ROWS = 8, SERVICE_SECTIONS = 30, ROW_WALK_M = 80, OUT_M = 0.8;   // (OUT_M: out of the door onto the pavement)
// A doctor's hours, by what's done (my calls, from an A&E's own): the wait (seen at once if it's bad), then each thing.
export const TREAT_H = { feed: 2, seen: 0.25, wait: 1.5, inside: 4, artery: 1.5, bullet: 1, stitch: 0.5, set: 1.5, xray: 0.5, blood: 1, drip: 1, dress: 0.25, look: 0.5, tourniquet: 0.25 };
export const TREAT_MAX_H = 12, TRANSFUSE_BELOW = BLOOD.pale, TRANSFUSE_PER = 15, URGENT_RATE = 1;   // (a transfusion's hour a TRANSFUSE_PER % lost; bleeding URGENT_RATE % a minute, straight through)
export const VISIT_HEAT = 2;                                       // (an official hospital's records: in the campaign, at the end of the hours, sim/emergency.js afterHospital())
// What a desk officer and a nurse wear (deskLook()): the country's police uniform (its cap and all), a nurse's tunic.
export const NURSE = { top: { kind: 'uniform', color: 0xf4efe6, trim: 0x5d8fc2 }, legs: 0xf4efe6, shoes: 0xf4efe6 };

const LIMBS = ['armL', 'armR', 'legL', 'legR'];
const SIDE = { armL: 'left arm', armR: 'right arm', legL: 'left leg', legR: 'right leg' };
const PART_WORD = { head: 'head', torso: 'ribs', ...SIDE };
const playerOf = (state) => state.actors.find(a => a.who === state.player);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const deepCut = (i) => i.kind === 'cut' && (i.deep || i.artery);
const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Hours in words, to the half hour: "An hour and a half", "Five hours", "Six and a half hours" (the desk's, the log's). */
export function hoursWords(h) {
  if (h >= 36) { const d = Math.round(h / 24); return `${cap(NUMBERS[d] ?? String(d))} days`; }   // (days in a bed, past a day and a half: bedHours())
  const n = Math.floor(h), half = h - n >= 0.375 && h - n < 0.875, w = n + (h - n >= 0.875 ? 1 : 0);
  if (w === 0) return half ? 'Half an hour' : 'A quarter of an hour';
  return w === 1 ? (half ? 'An hour and a half' : 'An hour') : `${cap(NUMBERS[w] ?? String(w))}${half ? ' and a half' : ''} hours`;
}

/**
 * The nearest door of a kind ('police' | 'hospital') in the city the map's in, from { row, x } (the player, if none):
 * { row, x, z (on the pavement before it), label ("The hospital on Pokrovka"), kind, far (metres, a street over
 * ROW_WALK_M) }, or null (not on a street, or none within reach). Only a door you can go in at (its floor set into its
 * building: sim/map/street.js shopFloors()).
 */
export function nearestDoor(state, kind, from = null) {
  if (state.map?.kind !== 'street') return null;
  const me = playerOf(state), f = from ?? (me && { row: state.map.row ?? 0, x: me.x });
  if (!f) return null;
  const town = townOf(state.map), lo = state.map.i0 ?? null, hi = state.map.i1 ?? null, c = Math.floor(f.x / SECTION_M);
  let best = null;
  for (let k = 0; k <= SERVICE_ROWS && !(best && best.far <= k * ROW_WALK_M); k++) {
    for (const row of k ? [f.row - k, f.row + k] : [f.row]) {
      for (let j = 0; j <= SERVICE_SECTIONS; j++) {
        if (best && k * ROW_WALK_M + (j - 1) * SECTION_M >= best.far) break;   // (no section further along could hold a nearer one)
        for (const i of j ? [c - j, c + j] : [c]) {
          if ((lo !== null && i < lo) || (hi !== null && i > hi)) continue;
          for (const d of sectionOf(town, row, i).doors) {
            if (d.kind !== 'shop' || d.shop !== kind || d.z !== Z.front || d.unit === undefined) continue;
            const far = k * ROW_WALK_M + Math.abs(d.x - f.x);
            if (!best || far < best.far) best = { far, row, x: d.x };
          }
        }
      }
    }
  }
  // (the city's one hospital, its one headquarters, further off than the search goes: there all the same, sim/cities/big.js)
  if (!best && kind === 'hospital') {
    const P = bigPlan(town).hospital, i = P.i0 + Math.floor(P.n / 2), d = sectionOf(town, P.row, i).doors.find(o => o.big === 'hospital');
    if (d) best = { far: Math.abs(P.row - f.row) * ROW_WALK_M + Math.abs(d.x - f.x), row: P.row, x: d.x };
  }
  return best && { row: best.row, x: best.x, z: Z.front + OUT_M, label: `${cap(SERVICE_WORDS[kind] ?? 'the door')} on ${streetName(town, best.row)}`, kind, far: Math.round(best.far) };
}

/**
 * The player out on the pavement in front of the nearest door of a kind (nearestDoor(), from `from` or where they
 * stand), facing the street, another street loaded if it's on one: the place, or null (and nothing moves).
 */
export function outside(state, bus, kind, from = null, { loadRow = ENGINE.loadRow } = {}) {
  const me = playerOf(state), at = me && nearestDoor(state, kind, from);
  if (!at || (at.row !== (state.map.row ?? 0) && !loadRow)) return null;
  const row = state.map.row ?? 0;
  Object.assign(me, { row: at.row, x: at.x, z: at.z, vx: 0, vz: 0, busy: null, glass: false, hidden: false, gait: 'idle', face: 'down', head: Math.PI / 2 });
  delete me.inside;                                                // (whatever was being done in a shop: over; out of its floor, sim/shops.js withinTick() hears it)
  if (at.row !== row) loadRow(state, bus, at.row, at.x, { quiet: true });
  return at;
}

/**
 * What a doctor would do for p at game time ms: { needs: [{ key, words, h, report? ('gunshot' | 'knife') }], hours (the
 * wait and the work, TREAT_MAX_H at most; 0 with nothing to do), urgent (straight through), reported (a hospital
 * tells the police: 'gunshot' | 'knife' | null) }.
 */
export function needsOf(p, ms) {
  const out = [], once = new Set();
  const add = (key, words, h, report = null) => { if (once.has(`${key}:${words}`)) return; once.add(`${key}:${words}`); out.push({ key, words, h, ...(report ? { report } : {}) }); };
  for (const i of (p?.injuries ?? []).filter(j => !(j.until <= ms))) {
    const why = i.gunshot ? 'gunshot' : deepCut(i) ? 'knife' : null;
    if (i.internal) { if (i.bleed > ms) add('inside', i.part === 'head' ? 'the skull opened and the bleed inside it stopped' : 'theatre, for the bleeding inside', TREAT_H.inside, why); continue; }
    if (deepCut(i) && !i.stitched) {
      if (i.artery) add('artery', 'the artery tied off', TREAT_H.artery, why);
      else if (i.gunshot) add(`bullet${out.length}`, 'a bullet wound cleaned out and closed', TREAT_H.bullet, why);
      else add(`stitch${out.length}`, i.part === 'head' ? 'the face stitched, finely' : 'a deep cut stitched', TREAT_H.stitch, why);
      continue;
    }
    if (i.kind === 'fracture' && LIMBS.includes(i.part) && !p.set?.[i.part]) { add('set', `the ${SIDE[i.part]} set and plastered`, TREAT_H.set); continue; }
    if ((i.kind === 'crack' || i.kind === 'fracture') && !((p.tended?.[i.part] ?? -Infinity) >= i.ms)) { add('xray', 'an X-ray', TREAT_H.xray); continue; }
    if (isOpen(i) && (i.bleed > ms || !i.clean)) add('dress', 'cuts cleaned and dressed', TREAT_H.dress);
  }
  for (const k of LIMBS) if (stateOf(p, k) === 'out' && !p.set?.[k]) add('set', `the ${SIDE[k]} set and plastered`, TREAT_H.set);
  if (p?.tourniquets && !out.some(n => n.key === 'artery')) add('tourniquet', 'the tourniquet off', TREAT_H.tourniquet);
  if (infectionOf(p)) add('drip', 'antibiotics on a drip', TREAT_H.drip);
  if (p?.needs?.ate !== undefined && (ms - p.needs.ate) / HOUR >= 48) add('feed', 'a drip, and something to eat, slowly', TREAT_H.feed);   // (weak from hunger, or worse: sim/needs.js WEAK_H)
  if (bloodOf(p) < TRANSFUSE_BELOW) add('blood', 'the blood put back, a bag at a time', TREAT_H.blood * Math.ceil((100 - bloodOf(p)) / TRANSFUSE_PER));
  for (const k of Object.keys(PARTS)) if (['wounded', 'out'].includes(stateOf(p, k)) && p.tended?.[k] === undefined) add('look', `the ${PART_WORD[k]} looked at`, TREAT_H.look);
  const urgent = out.some(n => n.key === 'inside' || n.key === 'artery') || bloodOf(p) < BLOOD.shock || bleedRate(p, ms) >= URGENT_RATE;
  const work = out.reduce((s, n) => s + n.h, 0), hours = out.length ? Math.min(TREAT_MAX_H, Math.round(((urgent ? TREAT_H.seen : TREAT_H.wait) + work) * 4) / 4) : 0;
  const reported = out.some(n => n.report === 'gunshot') ? 'gunshot' : out.some(n => n.report) ? 'knife' : null;
  return { needs: out, hours, urgent, reported };
}

/**
 * A doctor's care, at game time ms: everything needsOf() finds, done (sim/medicine.js fullCare(): every open wound cleaned,
 * dressed, a gash stitched and an artery tied off, the bleeding stopped, a break set and splinted, the tourniquet off,
 * antibiotics, painkillers, every hurt part tended); the bleeding inside stopped; the blood put back if it's down
 * under TRANSFUSE_BELOW. Returns what was done, in words (needsOf()'s).
 */
export function care(p, ms) {
  const N = needsOf(p, ms);
  fullCare(p, ms, { stitchArtery: true }, stateOf);
  for (const i of p.injuries ?? []) if (i.bleed > ms) i.bleed = ms;  // (what's inside, and anything left: stopped in theatre)
  if (N.needs.some(n => n.key === 'blood')) delete p.blood;
  p.hospital = ms;
  return N.needs.map(n => n.words);
}

/**
 * How long in a hospital bed after the work is done (the user, 2026-11-04: "we should stay in hospital long enough to be able
 * to move"): none if, on the painkillers they send you out on, you can stand and walk at the end of it (sim/health.js
 * incapacitated()); else a day at a time of mending in the bed (heal(), tended) till you can, BED_DAYS at most. In hours.
 */
export const BED_DAYS = 21;
export function bedHours(p, ms, workH) {
  const end = ms + workH * HOUR, q = structuredClone(p), dose = (t) => { q.dosed = { at: t, until: t + DOSE_H * HOUR }; }, able = (t) => canStand(q) && !incapacitated(q, t);
  dose(end);
  if (able(end)) return 0;
  for (let d = 1; d <= BED_DAYS; d++) { heal(q, 1, end + d * DAY, { tended: true }); dose(end + d * DAY); if (able(end + d * DAY)) return d * 24; }
  return BED_DAYS * 24;
}
/** Out of the hospital, or a cell: fed (their meals), dosed as you go, and a packet of painkillers with you if you've none on you. */
export function discharged(p, ms) {
  if (!p) return;
  const n = (p.needs ??= { stress: 0 }); n.ate = ms; n.ms = ms; delete p.faint;   // (sim/needs.js: fed, as eat() does; this module imports the engine's leaves only)
  if (!(p.injuries?.length || p.body)) return;
  p.dosed = { at: ms, until: ms + DOSE_H * HOUR };
  if (!(p.kit?.painkillers > 0) && !(p.bag ?? []).some(x => x.supply === 'painkillers')) addSupply(p, { painkillers: 4 });
}

/**
 * Taken in at a hospital's desk (sim/shops.js doWay(): 'treat'; door: its door, to come out of): cared for at once, and
 * the hours set to be skipped (state.$hospital: sim/emergency.js afterHospital(), which counts what an official
 * hospital costs at the end of them). official false: a doctor who asks no questions (no name, no report); out: the kind
 * of door to come out at after (the nearest to `door`), or null to stay where you are. Returns needsOf()'s, or null
 * with nothing for a doctor to do (nothing done, no time).
 */
export function admit(state, bus, me, { official = true, door = null, out = 'hospital' } = {}) {
  const p = state.people[me.who], ms = state.time.ms, N = needsOf(p, ms);
  if (!N.needs.length) return null;
  const done = care(p, ms), report = official ? N.reported : null, bed = bedHours(p, ms, N.hours);
  N.hours += bed; N.bed = bed;                                       // (and the days in a bed till you can walk out: bedHours())
  state.$hospital = { ms: Math.round(N.hours * HOUR), from: door ? { row: state.map.row ?? 0, x: door.x } : null, walkin: true, official, report, out };
  const list = done.length > 2 ? `${done.slice(0, -1).join('; ')}; and ${done.at(-1)}` : done.join(' and ');   // (its words have their own commas and ands)
  say(state, bus, { kind: 'note', text: `${N.urgent ? 'One look, and the nurse at the desk calls for a trolley: straight through, past the waiting room.' : official ? 'Your name and your passport at the desk, a form, a plastic chair, and a long wait under the strip lights.' : 'No forms, no names: a back room, and a doctor who doesn\'t ask.'} Then ${list}.${report ? ` ${report === 'gunshot' ? 'A gunshot wound' : 'A knife wound'}, though: they call the police, as they must, and an officer comes to the curtain with a notebook and questions about where you were.` : ''}` });
  return N;
}

/**
 * Whoever's behind a police station's or a hospital's front desk (sim/interiors/shop.js staff.dress), as the view draws
 * them (src/render/view.js): their own face and hair (`base`, a passer-by's look), in the country's police uniform, cap
 * and all, or a nurse's tunic (NURSE; a headscarf kept).
 */
export function deskLook(map, dress, base = {}) {
  const { skin, hair, beard, moustache, glasses, hat } = base;
  const face = { skin, hair, ...(beard ? { beard } : {}), ...(moustache ? { moustache } : {}), ...(glasses ? { glasses } : {}) };
  if (dress === 'police') return { ...face, shoes: 0x14151c, ...structuredClone(policeOf(map)?.look ?? {}) };
  return { ...face, ...structuredClone(NURSE), ...(hat?.kind === 'hijab' ? { hat } : {}) };
}
