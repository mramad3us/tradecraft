// TRADECRAFT sim: the hunt for you (the user, 2026-11-04: "when being hunted (which should be the case when burned, or when
// police has been called on us), tradecraft rolls should be made to establish if police knows who to look for"; "Police should
// arrive not only on the scene of crime, but patrols should start (in 3 streets for small disruptions like a fight, but
// essentially the whole city with nowhere to hide except safe houses or home for something like a gunfight) during a long phase
// of search (on foot and cars with flashing lights) looking for the description given by whoever called it in"; "they don't
// search as hard when it's a minor incident like a fist fight"; "chasing police will enter cafés, shops etc or at least look in
// the windows"). The engine's, on any street with police (sim/game.js: second() once a second, after the alarm's and the
// emergency services'; tick() every tick).
//
// **What starts one** (start()): a call that describes you (sim/emergency.js report(): you seen at it in the VIOLENT_S before,
// a shot, a fight), an officer with eyes on you while the alarm's up (sighted(): a gun seen, the shots), a passer-by's call
// about a gun. One a city at a time: a worse one makes it worse (ORDER), never lighter. Its kind (HUNTS) sets how hard they
// look: how many streets round it (rows: a fist fight's three, someone shot the whole city), how long the search goes on
// (searchH), how long every officer keeps your description after (keepD), how often a unit comes down a street in it
// (every, in minutes), how many of them are cars, and how hard they look at a face (eye). Deployed only once the first
// responders are there (H.deploy: the call's police, or an officer's own sighting DEPLOY_MIN on); while an armed one's out,
// another call in its streets is answered in a quarter of the time (onAlert(), sim/emergency.js ON_ALERT_K).
// **What they know** (state.hunt): three markers. Who you are (your face, your age, your hair: whoOf(); the one description,
// which a disguise will change, Queued), what you wear (your top and its colour, a hat, glasses: wearOf()), and where they
// last had you (where: the street, the place, the time). A caller has what you wear nearly always (wearP(), less in the dark)
// and your face by how close they were and the light (faceP()); an officer who's seen you, all of it.
// **What you know of it** (know()): your Tradecraft reads each marker (a d20 + Tradecraft / 5 against READ_DC): made, you know
// whether they have it; missed, you can't tell; a natural 1, you've got it wrong. You know there's a hunt at all once you've
// seen or heard the call, an officer's had a look at you, or a unit of it's on your street. Then three icons at the top of the
// picture (src/ui/ui.js; badges()) say what you think, as you are now: red, they have it; green, they don't, or you've changed
// since they had it; grey, you can't tell. Where: red inside their perimeter (perimeterM(): PERIM0_M round where they last had
// you, growing PERIM_MS a second, as they reckon you've walked on, out to the hunt's streets), green outside it, and green once
// the search is called off.
// **The search** (units()): in the hunt's streets, while it's on, a unit down the street you're on every so often (twice as
// seldom outside the perimeter): a pair on foot along your pavement, looking in at the windows, and now and then in at the door
// of the shop you're in (LOOK_IN_P); or a car, slow, its lights going, its crew looking out (sim/traffic.js cruiser()).
// **An officer who sees you** (looked()): one check a unit an hour (a patrol's pair, a hunt's unit, a car's crew, the one at a
// tape, a call's), for every officer in the city has your description: your Deception against their Awareness, with mods()
// (your face, your clothes, where you are against their perimeter, the hunt's kind, blood or something in your hand), and a
// natural 1 fails whatever the sum (looking very nervous at a patrol going by). Made, their eyes go past you. Missed, you're
// flagged (flag()): they call it in, and all three markers are as you are now, here.
// **Flagged**: matched on all they had (your face and your clothes), or once you've run from them, you're who they want: the
// alarm (sim/armed.js call(): "stand still", the cuffs, the takedown, arrested for the worse of what's in front of them and the
// hunt's kind: armed.js HUNT_TIER). Else a suspect (suspect()): they come up to you, "stay where you are", and at your side the
// moment's yours (a reflex): stand for the search, or run, shove, fight, draw, every one of them guilty() (the alarm, and
// resisting on the file); walk off STOP_M first and you've failed to stop, the same. Searched (searched()): something on you
// they can hold you on (a weapon, blood), arrested; nothing, taken in for questioning (questioned(): QUESTION's hours at the
// station, its costs, a paper), and out on its steps. Either way the hunt's over: they've had you.
// **Into a shop after you** (routeInto()): an officer coming to cuff you, or to stop a suspect, follows you in at the door and
// across the floor; with you in a shop out of their sight, one of them goes in to look.
// Queued (docs/DESIGN.md): disguises (the who marker changed by how good one is: disguise()); the investigation behind a hard
// crime (the scene's evidence, CCTV where a city has it, detectives with the witnesses, a knock at the door).
import { stream, range, chance, pick } from './rng.js';
import { say } from './log.js';
import { HOUR, DAY, MIN } from './clock.js';
import { seesActor, inView } from './perception.js';
import { opposed, check } from './checks.js';
import { skill } from './skills.js';
import { makeAgent, setRoute } from './agents.js';
import { routeFrom, LINE, finish, sectionOf } from './city.js';
import { townOf } from './cities/index.js';
import { sheet } from './people.js';
import { policeOf } from './countries/index.js';
import { armCop, call as raiseAlarm, arrest, pin, able, underGuard, GRAB_M, CLOSE_PACE, RESIST_POLICE, SHOVE_DC, SHOVED_S } from './armed.js';
import { policeHeat, searchOf, take, STOP_M, SPAWN_M, POLICE_WANTED } from './police.js';
import { addHeat } from './heat.js';
import { nearestDoor, hoursWords, ROW_WALK_M } from './services.js';
import { offer, isArmed, RUN_S } from './reflex.js';
import { mods as shows } from './notice.js';
import { cruiser, pullOver } from './traffic.js';
import { unitAt } from './interiors/use.js';
import { wayAcross } from './interiors/path.js';
import { Z, streetName, SECTION_M, mouthOf } from './map/street.js';
import { heardFrom } from './sense.js';
import { isGun } from './firearms.js';
import { thingName } from './items.js';
import { disguiseOf } from './disguise.js';
import { SCREEN_HALF_M } from './crowd.js';
import { noImmunity, questionedDeep } from './prison.js';

export const ORDER = ['fight', 'gun', 'shots', 'wounded', 'killed', 'blown'];
const CITY = Infinity;
// (posts: officers stood at the street's corners, the lanes' mouths, on every street in it; most: units walking or driving
// it at once; armed: the armed response's (soldiers where it's the army), long guns, at a jog. The user, 2026-11-04: "For
// shooting people, police would deploy patrols (armed police running around, standing at every corner up and down streets,
// police cars with lights on) every street in the city for at least 36 hours")
export const HUNTS = {
  fight: { rows: 3, searchH: 1, keepD: 1, every: [14, 24], cars: 0, eye: 2, posts: 0, most: 1, armed: false, what: 'a fight' },
  gun: { rows: 4, searchH: 2, keepD: 2, every: [9, 15], cars: 0.35, eye: 0, posts: 0, most: 1, armed: false, what: 'a gun seen' },
  shots: { rows: 8, searchH: 24, keepD: 3, every: [5, 9], cars: 0.45, eye: 0, posts: 1, most: 1, armed: true, what: 'shots fired' },
  wounded: { rows: CITY, searchH: 36, keepD: 5, every: [2, 4], cars: 0.45, eye: -1, posts: 2, most: 2, armed: true, what: 'someone shot' },
  killed: { rows: CITY, searchH: 48, keepD: 7, every: [1.5, 3], cars: 0.45, eye: -2, posts: 3, most: 3, armed: true, what: 'a killing' },
  // (blown under a legend, 0.2's: the counter-intelligence's and the police's hunt for a foreign spy, the whole city, days of it;
  // your face from their own file: sim/campaign.js pass(), docs/POSTINGS.md)
  blown: { rows: CITY, searchH: 72, keepD: 14, every: [2, 4], cars: 0.4, eye: -2, posts: 2, most: 2, armed: true, what: 'a foreign spy' },
};
export const JOG_PACE = 1.6, POST_NEAR_M = 70;                     // (an armed pair's pace; how far along a post stands from you, at most)
// (the perimeter: round where they last had you, growing as they reckon you'd walk; units outside it this much more seldom)
export const PERIM0_M = 120, PERIM_MS = 1.2, OUTSIDE_SLOW = 2;
// (an officer's look: how far on foot, from a car; a unit's check this often at most; a pair in at a shop's door, and for how long)
export const EYE_M = 14, CAR_EYE_M = 18, UNIT_CHECK_H = 1, LOOK_IN_P = 0.5, LOOK_IN_S = 12, LOOK_IN_M = 7, OWN_SIDE_P = 0.85, CAR_WAIT_S = 15;
// (a caller's: what you wear, by the light; your face, by how close (FACE_M: past it, hardly) and the light)
export const WEAR_P = { day: 0.97, dim: 0.9, dark: 0.75 }, FACE_M = 14;
// (your Tradecraft's read of each marker: d20 + Tradecraft / 5 against these)
export const READ_DC = { who: 14, wearing: 10, where: 12 };
// (the check's mods, yours: they have your face, or it's not the one they have, or nobody saw it; the same for your clothes)
export const MOD = { disguise: 5, face: -3, faceOther: 2, faceNone: 4, wear: -4, wearOther: 4, wearNone: 1, deep: -3, inside: -1, outside: 2, far: 5, over: 2, blood: -4, held: -3 };
// (taken in for questioning: the hours, heat, the ambassador's view of you, by the hunt's kind; the police's file)
export const QUESTION = { fight: { h: 1.5, heat: 4, cover: 5 }, gun: { h: 2, heat: 8, cover: 10 }, shots: { h: 3, heat: 12, cover: 15 }, wounded: { h: 4, heat: 15, cover: 20 }, killed: { h: 6, heat: 20, cover: 25 }, blown: { h: 6, heat: 20, cover: 25 } };
export const POLICE_QUESTION = 10, HUNT_HEAT = 10, DEPLOY_MIN = 4;

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const TPS = 20;
const ageBand = (age) => (age == null ? '' : age < 30 ? '20s' : age < 40 ? '30s' : age < 50 ? '40s' : age < 60 ? '50s' : '60+');
/** Who someone is, as a witness says it: sex, skin, age, hair, a beard. One description (a disguise's to change: Queued). */
export const whoOf = (p) => { const L = p?.look ?? {}; return [p?.sex, L.skin, ageBand(p?.age), L.hair?.style, L.hair?.color, L.beard ?? '', L.moustache ? 'm' : ''].join('|'); };
/** What someone wears, as a witness says it: the top and its colour, a hat, glasses. Another of any, other clothes. */
export const wearOf = (p) => { const L = p?.look ?? {}; return [L.top?.kind, L.top?.color, L.hat?.kind ?? 'bare', L.hat?.color ?? '', L.glasses ?? ''].join('|'); };
/** How good a disguise someone has on, 0 … 1 (sim/disguise.js: a kit's). */
export const disguise = (p) => disguiseOf(p);
/** The worse of two kinds. */
export const worse = (a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a);
/** A caller's chance of your face: close and lit, nearly sure; FACE_M off, hardly; in the dark, half. */
export const faceP = (d, light = 1) => Math.max(0.05, Math.min(0.95, (1.15 - d / FACE_M) * (light >= 0.6 ? 1 : light >= 0.25 ? 0.8 : 0.5)));
/** A caller's chance of what you wear, by the light. */
export const wearP = (light = 1) => (light >= 0.6 ? WEAR_P.day : light >= 0.25 ? WEAR_P.dim : WEAR_P.dark);
/** The hunt on in this city now, or null. */
export function huntOf(state) {
  const H = state.hunt;
  return H && H.until > state.time.ms && (H.city ?? null) === (state.map?.city ?? null) ? H : null;
}
/** Whether p matches all they have (their face and their clothes, both known): the full description. */
export function fullMatch(state, p) {
  const H = huntOf(state);
  return !!H && H.who.known && H.wearing.known && H.who.look === whoOf(p) && !disguise(p) && H.wearing.look === wearOf(p);
}
/**
 * A street the city's armed search covers now (a gun fired, someone shot, a killing: deployed, in its window, its streets;
 * before its first responders are there it's the same incident still): the police already out on them, so a call there is answered in ON_ALERT_K of the time (sim/emergency.js; the user, 2026-11-04:
 * "while inside the window police has been called and is patrolling ... an other incident triggers a response in 1/4 of
 * the normal response time").
 */
export function onAlert(state, row = state.map.row ?? 0, now = state.time.ms) {
  const H = huntOf(state), S = H && HUNTS[H.why];
  return !!S && S.armed && now >= (H.deploy ?? 0) && now < H.search && (!H.city || H.city === (state.map.city ?? null)) && (S.rows === CITY || Math.abs(row - H.origin.row) <= S.rows);
}
/** How far round where they last had you they're looking now, in metres of walking (a street over ROW_WALK_M), as far as the hunt's streets. */
export function perimeterM(H, now) {
  const S = HUNTS[H.why], most = S.rows === CITY ? Infinity : (S.rows + 0.5) * ROW_WALK_M;
  return Math.min(most, PERIM0_M + PERIM_MS * Math.max(0, now - H.where.ms) / 1000);
}
/** How far you are from where they last had you, in metres of walking. */
export const fromM = (state, H, me) => Math.abs((me.row ?? state.map.row ?? 0) - H.where.row) * ROW_WALK_M + Math.abs(me.x - H.where.x);
const inArea = (state, H) => HUNTS[H.why].rows === CITY || Math.abs((state.map.row ?? 0) - H.origin.row) <= HUNTS[H.why].rows;

/**
 * A hunt begun, or made worse and brought up to date: why (ORDER), where (row, x), who and wearing (they have your face, your
 * clothes, as you are now), what (its words), aware (you know of it now), sure (you know what they have: an officer's look at
 * you), first (when its first unit comes: the call's police). The hunt.
 */
export function start(state, bus, { why, row = state.map.row ?? 0, x, who = false, wearing = false, what = null, aware = false, sure = false, first = null }) {
  const now = state.time.ms, p = state.people[state.player], H0 = huntOf(state), w = H0 ? worse(H0.why, why) : why, S = HUNTS[w];
  const fresh = {
    // (where they had you last is where the search is centred: a sighting or a new call moves it, the user, 2026-11-04:
    // "reset at our location everytime we get spotted again")
    id: H0?.id ?? `hunt${now}`, city: state.map.city ?? null, why: w, ms: H0?.ms ?? now, origin: { row, x },
    search: Math.max(H0?.search ?? 0, now + S.searchH * HOUR), until: Math.max(H0?.until ?? 0, now + S.keepD * DAY),
    who: who ? { known: true, look: whoOf(p) } : H0?.who ?? { known: false },
    wearing: wearing ? { known: true, look: wearOf(p) } : H0?.wearing ?? { known: false },
    wore: [...new Set([...(H0?.wore ?? []), ...(wearing && H0?.wearing?.known && H0.wearing.look !== wearOf(p) ? [H0.wearing.look] : [])])],   // (what they'd been told you wore before: still theirs, in a bag on you)
    seen: { who: whoOf(p), wearing: wearOf(p) },                   // (how you looked when they had you, as you know it: what the icons weigh you against)
    where: { row, x, ms: now },
    what: what ?? (H0 && w === H0.why ? H0.what : `${cap(S.what)} on ${streetName(townOf(state.map), row)}`),
    units: H0?.units ?? {}, next: H0?.next ?? first ?? now + range(stream('hunt-first', now), 2, 5) * MIN, n: H0?.n ?? 0,
    fled: H0?.fled ?? false, read: H0?.read ?? null, aware: H0?.aware ?? null, reads: H0?.reads ?? 0,
    // (the search deployed only once the first responders are there: the call's police; an officer's own sighting, a few
    // minutes on; the user, 2026-11-04: "they are FIRST responders")
    // (a search called off and up again: its first responders again first)
    deploy: H0 && now < H0.search ? H0.deploy ?? now : first ?? now + DEPLOY_MIN * MIN,
  };
  const H = H0 ? Object.assign(H0, fresh) : (state.hunt = fresh);   // (the same hunt brought up to date: whoever holds it holds this one)
  if (!H0 || w !== H0.why) { if (state.legend) addHeat(state, HUNT_HEAT); policeHeat(state, POLICE_WANTED); }   // (your description out to every officer: the police's own file, sim/police.js)
  if (sure) know(state, bus, true);
  else if (aware || H.aware) know(state, bus);
  return H;
}

/** You know of the hunt, or more of it now: your Tradecraft's read of what they have (sure: an officer's look, you know it all). */
export function know(state, bus, sure = false) {
  const H = state.hunt, p = state.people[state.player], now = state.time.ms;
  if (!H || !p) return;
  if (sure && H.read?.sure) { H.read.ms = now; return; }
  H.aware ??= now;
  if (sure) {
    H.read = { who: true, wearing: true, where: true, sure: true, ms: now };
    say(state, bus, { kind: 'instinct', text: 'They\'ve had a good look at you: your face, what you\'re wearing, and where you are.' });
    return;
  }
  const r = stream('hunt-read', H.id, ++H.reads), v = Math.round((p.os ?? 20) / 5);
  const roll = (k, truth) => { const c = check(r, { skill: 'Tradecraft', value: v, dc: READ_DC[k] }); return c.nat === 1 ? !truth : c.ok ? truth : null; };
  H.read = { who: roll('who', H.who.known), wearing: roll('wearing', H.wearing.known), where: roll('where', true) || null, ms: now };
  const R = H.read, street = streetName(townOf(state.map), H.where.row);
  const face = R.who === true ? 'your face' : R.who === false ? 'not your face (nobody had a good look at it)' : 'your face, perhaps (who saw it, you can\'t tell)';
  const wear = R.wearing === true ? 'what you\'re wearing' : R.wearing === false ? 'not what you\'re wearing' : 'what you\'re wearing, perhaps';
  const where = R.where ? `and where: ${street}, and they'll widen it as the minutes go by` : `and somewhere about ${street}`;
  say(state, bus, { kind: 'instinct', text: `${cap(HUNTS[H.why].what)}: they'll be looking for you. What they'll have: ${face}; ${wear}; ${where}.` });
}

/**
 * The three icons (src/ui/ui.js): what you think they have of you, as you are now: [{ key: 'face' | 'clothes' | 'place', state:
 * 'burned' | 'clear' | 'unknown' }], or null (no hunt you know of).
 */
export function badges(state) {
  const H = huntOf(state), me = playerOf(state), p = state.people[state.player];
  if (!H?.aware || !me || !p) return null;
  const R = H.read ?? {}, now = state.time.ms;
  const mark = (k, look) => (R[k] === false || look !== H.seen[k] ? 'clear' : R[k] === true ? 'burned' : 'unknown');
  const where = now >= H.search || state.map.kind !== 'street' ? 'clear' : !R.where ? 'unknown' : fromM(state, H, me) < perimeterM(H, now) ? 'burned' : 'clear';
  return [{ key: 'face', state: mark('who', disguise(p) ? `${whoOf(p)}|d` : whoOf(p)) }, { key: 'clothes', state: mark('wearing', wearOf(p)) }, { key: 'place', state: where }];
}

/** The mods on your side of an officer's look (the check: your Deception against their Awareness). */
export function mods(state, H, p, me) {
  const out = [], now = state.time.ms, S = HUNTS[H.why];
  if (H.who.known) out.push(H.who.look === whoOf(p) && !disguise(p) ? { why: 'they have your face', v: MOD.face } : { why: 'not the face they have', v: MOD.faceOther });
  else out.push({ why: 'nobody had a good look at your face', v: MOD.faceNone });
  if (disguise(p)) out.push({ why: 'a disguise', v: Math.round(disguise(p) * MOD.disguise) });   // (how good it is: sim/disguise.js)
  if (H.wearing.known) out.push(H.wearing.look === wearOf(p) ? { why: 'dressed as they described you', v: MOD.wear } : { why: 'not dressed as they described you', v: MOD.wearOther });
  else out.push({ why: 'they don\'t know what you wore', v: MOD.wearNone });
  if (now < H.search) {
    const d = fromM(state, H, me), P = perimeterM(H, now);
    out.push(d < P * 0.35 ? { why: 'right where they\'re looking', v: MOD.deep } : d < P ? { why: 'inside their perimeter', v: MOD.inside } : d < P * 2 ? { why: 'outside their perimeter', v: MOD.outside } : { why: 'far outside their perimeter', v: MOD.far });
  } else out.push({ why: 'the search called off', v: MOD.over });
  if (S.eye) out.push({ why: S.eye > 0 ? `nobody looks hard for ${S.what}` : `every officer wants the one for ${S.what}`, v: S.eye });
  const s = shows(p);
  if (s.some(m => /blood/.test(m.why))) out.push({ why: 'blood on you', v: MOD.blood });
  if (s.some(m => /hand/.test(m.why))) out.push({ why: 'something in your hand', v: MOD.held });
  return out;
}

/** Once a second, on a street with police (sim/game.js): the hunt's eyes, its units, its stops. */
export function second(state, bus, me) {
  if (state.map.kind !== 'street' || !me) return;
  const now = state.time.ms;
  if (state.hunt && state.hunt.until <= now) {
    const was = state.hunt;
    delete state.hunt;
    if (was.aware) say(state, bus, { kind: 'instinct', text: 'Days since it happened now: the description in their notebooks is old news.' });
  }
  sighted(state, bus, me, now);
  chaseIn(state, me, now);
  guards(state, me, now);
  const H = huntOf(state);
  // (the search called off, or the hunt over (they've had you): the corners stood down)
  if ((!H || now >= H.search) && state.actors.some(a => a.huntPost && !a.alert)) state.actors = state.actors.filter(a => !a.huntPost || a.alert);
  if (!H) return;
  const T = state.$takedown;
  if (T?.suspect) return approach(state, bus, me, H, T, now);
  if (H.pull) return pulled(state, bus, me, H, now);
  gone(state);
  if (state.$alarm || T || state.fight || state.$stop?.asked) return;
  noticed(state, bus, me, H);
  units(state, bus, me, H, now);
  lookIn(state, me, H, now);
  looked(state, bus, me, H, now);
}

// The alarm's up and an officer has you in sight: they know you as you are, and where (the hunt begun, or kept up to date);
// up on a passer-by's call about a gun, with no officer to see you: what you wear, and your face perhaps.
function sighted(state, bus, me, now) {
  const A = state.$alarm;
  if (!A) return;
  const row = state.map.row ?? 0, shot = state.$shotBy && now - state.$shotBy.ms < 30000;
  const eyes = state.actors.some(c => c.cop && c.alert && c.$seen === now && (c.row ?? row) === row);
  if (eyes) { start(state, bus, { why: shot ? 'shots' : 'gun', x: me.x, who: true, wearing: true, sure: true }); return; }
  if (!A.hunted && A.why === 'a passer-by') {
    A.hunted = true;
    start(state, bus, { why: shot ? 'shots' : 'gun', x: A.x ?? me.x, wearing: true, who: chance(stream('hunt-caller', now), 0.35) });
  }
}

// The way in for an officer after you into a shop: the closing officer of a takedown, or with nobody in sight of you there
// while the alarm's up, the nearest of them, to have a look (sim/armed.js routes them to where you stand, which the street's
// ways can't reach: re-routed here, after it, each second).
function chaseIn(state, me, now) {
  if (!me.within) return;
  const T = state.$takedown, row = state.map.row ?? 0;
  let c = T && !T.suspect && T.stage === 'closing' ? state.actors.find(a => a.id === T.cop) : null;
  if (!c && state.$alarm && !T) {
    const on = state.actors.filter(a => a.cop && a.alert && a.ai && (a.row ?? row) === row && able(state, a));
    if (on.length && !on.some(a => seesActor(state, a, me))) c = on.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  }
  if (!c?.ai) return;
  const r = routeInto(state, c, me.x + (Math.sign(c.x - me.x) || 1) * 0.8, me.z);
  if (r) { setRoute(state, c, r); c.ai.pace = CLOSE_PACE; c.ai.closing = now; }
}

/**
 * A way for a in at the door of the shop at (tx, tz) and across its floor to it (sim/interiors/path.js): a route (sim/city.js
 * finish()), or null. From inside the same shop already, only across its floor.
 */
export function routeInto(state, a, tx, tz) {
  const at = unitAt(state, tx, tz) ?? unitAt(state, tx, tz + 0.4);
  if (!at) return null;
  const row = state.map.row ?? 0, u = at.u, plan = { plan: u, blockers: at.S.blockers };
  const pt = (x, z) => ({ row, x, z, w: 0 });
  const here = unitAt(state, a.x, a.z);
  if (here?.u === u) {
    const way = wayAcross(plan, a.x, a.z, tx, tz);
    return way ? finish([pt(a.x, a.z), ...way.map(([x, z]) => pt(x, z))]) : null;
  }
  let street;
  try { street = routeFrom(townOf(state.map), { row, x: a.x, z: a.z }, { row, x: u.door, z: Z.front + 0.4 }); } catch { return null; }
  const inside = [u.door, u.z1 - 0.6], way = wayAcross(plan, inside[0], inside[1], tx, tz);
  if (!way) return null;
  return finish([...street.pts, pt(u.door, Z.front - 0.05), pt(inside[0], inside[1]), ...way.map(([x, z]) => pt(x, z))]);
}
// (out of a shop's door and along the pavement to x: a route, or null)
function routeOut(state, a, x) {
  const at = unitAt(state, a.x, a.z), row = state.map.row ?? 0, pt = (px, pz) => ({ row, x: px, z: pz, w: 0 });
  if (!at) { try { return routeFrom(townOf(state.map), { row, x: a.x, z: a.z }, { row, x, z: LINE.N }); } catch { return null; } }
  const u = at.u, inside = [u.door, u.z1 - 0.6], way = wayAcross({ plan: u, blockers: at.S.blockers }, a.x, a.z, inside[0], inside[1]);
  let street;
  try { street = routeFrom(townOf(state.map), { row, x: u.door, z: Z.front + 0.4 }, { row, x, z: LINE.N }); } catch { return null; }
  return finish([pt(a.x, a.z), ...(way ?? []).map(([px, pz]) => pt(px, pz)), pt(u.door, Z.front - 0.05), ...street.pts]);
}

// You learn there's a hunt: one of its units on your street in your sight, or its car's lights (and your read of it).
function noticed(state, bus, me, H) {
  if (H.aware) return;
  const row = state.map.row ?? 0;
  const unit = state.actors.some(a => a.hunt && (a.row ?? row) === row && inView(state, a.id));
  const car = (state.traffic?.cars ?? []).some(c => c.ems?.hunt && Math.abs(c.x - me.x) < 45);
  if (!unit && !car) return;
  say(state, bus, { kind: 'note', text: car ? 'A police car comes down the street at a crawl, its lights going and no siren, its crew looking at the pavements.' : 'Two police officers along the pavement, slowly, looking at faces: they\'re looking for someone.' });
  know(state, bus);
}

// A unit sent down the street you're on, while the search is on and you're in its streets, every so often: a pair on foot, or a car.
function units(state, bus, me, H, now) {
  const S = HUNTS[H.why], row = state.map.row ?? 0;
  if (now >= H.search || !inArea(state, H) || now < (H.deploy ?? 0)) return;   // (nothing deployed before the first responders are on the scene)
  const K = policeOf(state.map), hot = fromM(state, H, me) < perimeterM(H, now), at = `${state.map.seed}:${row}`;
  // (a street you've come to inside their perimeter (the place icon red): police on it, every time, at once: a car where the
  // hunt has them, else a pair on foot, and a corner where it's more than a fight; the user, 2026-11-04: "when the location
  // indicator is red, police should be spawned on the map we travel to systematically, both car patrols and cops at corners")
  if (H.$at !== at) { H.$at = at; if (hot) { H.next = Math.min(H.next, now); H.$car = S.cars > 0; } }
  posts(state, me, H, hot && H.why !== 'fight' ? Math.max(1, S.posts) : S.posts, K, row, S.armed);
  // (a car waiting for room at an end of the stretch, as a call's does: tried each second, CAR_WAIT_S, then the pair on foot)
  if (H.car) {
    const P = H.car, d = P.dir;
    if (cruiser(state, P.id, P.crew, d) || cruiser(state, P.id, P.crew, -d)) { delete H.car; return; }
    if (now - P.ms < CAR_WAIT_S * 1000) return;
    delete H.car; delete state.people[P.crew];
    return foot(state, P.id, stream('hunt-unit-foot', P.id), me, K, S.armed);
  }
  if (now < H.next) return;
  const moving = new Set([...state.actors.filter(a => a.hunt && !a.huntPost && (a.row ?? row) === row).map(a => a.hunt), ...(state.traffic?.cars ?? []).filter(c => c.ems?.hunt).map(c => c.ems.hunt)]);
  if (moving.size >= S.most) return;
  // (the next: every so often, S.most of them about at once; twice as seldom outside the perimeter, where it's streets
  // round a place, not the whole city)
  const r = stream('hunt-unit', H.id, H.n), inside = S.rows === CITY || fromM(state, H, me) < perimeterM(H, now), id = `${H.id}u${H.n++}`;
  H.next = now + range(r, ...S.every) * MIN / S.most * (inside ? 1 : OUTSIDE_SLOW);
  const car = H.$car || chance(r, S.cars);
  H.$car = false;
  if (car) {
    const crew = `${id}c`, d = chance(r, 0.5) ? 1 : -1;
    officerSheet(state, crew, K, r, S.armed);
    if (cruiser(state, id, crew, d) || cruiser(state, id, crew, -d)) return;   // (from the other end, where a car's at this one)
    H.car = { id, crew, dir: d, ms: now };                           // (no room at either end yet: tried again each second)
    return;
  }
  foot(state, id, r, me, K, S.armed);
}
// (an officer's sheet: the country's uniform, armed as its patrols are; or the armed response's, long guns in hand, soldiers
// where the response is the army)
function officerSheet(state, who, K, r, armed = false) {
  const army = armed && !!K.response?.soldiers, resp = armed && (K.arms?.response?.length ?? 0) > 0;
  state.people[who] = sheet({ id: who, name: army ? 'a soldier' : resp ? 'an armed officer' : 'a police officer', sex: chance(r, 0.25) ? 'f' : 'm', cls: army ? 'soldier' : 'cop', skills: { awareness: [(K.awareness ?? 8) + (resp ? 2 : 0), 0], cqc: [resp ? 10 : 6, resp ? 1 : 0], tracking: [resp ? 8 : 6, 0] },
    look: { skin: pick(r, K.skin ?? ['light']), hair: { style: 'crew', color: pick(r, [0x23252f, 0x47302a]) }, shoes: 0x14151c, ...structuredClone(resp ? K.response?.look ?? K.look ?? {} : K.look ?? {}) } });
  armCop(state, state.people[who], resp ? 'response' : 'patrol', r);
  return state.people[who];
}

// Officers stood at the street's corners while the search is on (S.posts of them on the street you're on, at the lanes'
// mouths nearest you within POST_NEAR_M; one a second as you come): each a unit of its own, checking whoever passes it.
function posts(state, me, H, n, K, row, armed) {
  if (!n) return;
  const here = state.actors.filter(a => a.huntPost && (a.row ?? row) === row);
  // (one come in from out of the picture, at its corner: stood there, facing the street)
  for (const a of here) if (a.ai?.route && !a.alert && a.ai.s >= a.ai.route.length - 0.05 && Math.hypot(a.x - a.huntPost.x, a.z - a.huntPost.z) < 1) { a.ai.route = null; a.ai.pace = undefined; a.face = 'down'; a.head = Math.PI / 2; }
  if (here.length >= n) return;
  const town = townOf(state.map), i0 = Math.floor(me.x / SECTION_M), corners = [];
  for (let i = i0 - 2; i <= i0 + 2; i++) for (const g of sectionOf(town, row, i).gapsN) { const m = mouthOf(g); corners.push({ x: m.x1 + 0.6, z: LINE.F - 0.4, face: 'down' }, { x: m.x0 - 0.6, z: LINE.F - 0.4, face: 'down' }); }
  const free = corners.filter(c => Math.abs(c.x - me.x) < POST_NEAR_M && !here.some(a => Math.abs(a.huntPost.x - c.x) < 4)).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
  const c = free[0];
  if (!c) return;
  const id = `${H.id}p${row}:${Math.round(c.x)}`, who = `${id}o`, r = stream('hunt-post', id);
  officerSheet(state, who, K, r, armed);
  const a = postAt(state, me, who, row, c.x, c.z, armed);
  Object.assign(a, { cop: true, hunt: id, huntPost: { x: c.x, z: c.z } });
}
// (someone posted at x, z: there already if it's out of the picture; in it, from out of it, at a run if armed, to their place,
// facing the street once there; the user, 2026-11-04: "police tends to spawn on top of us if we're close to their corners")
function postAt(state, me, who, row, x, z, armed = false) {
  const seen = Math.abs(x - me.x) < SCREEN_HALF_M[0] && Math.abs(z - me.z) < SCREEN_HALF_M[1];
  if (!seen) { const a = makeAgent(state, { who, row, x, z, speed: 1.1, face: 'down' }); a.ai.route = null; a.head = Math.PI / 2; return a; }
  const side = x >= me.x ? 1 : -1, from = me.x + side * (SCREEN_HALF_M[0] + 4), town = townOf(state.map);
  const a = makeAgent(state, { who, row, x: from, z: LINE.F, speed: 1.1, face: side > 0 ? 'left' : 'right' });
  try { setRoute(state, a, routeFrom(town, { row, x: a.x, z: a.z }, { row, x, z })); } catch { a.ai.route = null; a.x = x; a.z = z; }
  if (armed) a.ai.pace = JOG_PACE;
  return a;
}
// Officers at a police station's door, always (the user, 2026-11-04: "at least one (can be more when high alert) armed police
// officer in front of the police stations"): the armed response's (soldiers where it's the army), stood by the door facing
// the street, GUARDS of them, more with a search out in the city (the city's whole for someone shot or killed); there while
// you're within GUARD_M of the door, on its street, and an ordinary officer's eyes on what they see (sim/police.js eyeTick).
export const GUARD_M = 80, GUARDS = { calm: 1, search: 2, city: 3 };
function guards(state, me, now) {
  const row = state.map.row ?? 0, town = townOf(state.map), i0 = Math.floor(me.x / SECTION_M), H = huntOf(state);
  const out = state.actors.filter(a => a.guard && !a.alert && ((a.row ?? row) !== row || Math.abs(a.guard.x - me.x) > GUARD_M * 1.5));
  if (out.length) state.actors = state.actors.filter(a => !out.includes(a));
  // (one drawn off by an alarm and let go: back to the door, and facing the street again)
  for (const a of state.actors) {
    if (!a.guard || a.alert || !a.ai || (a.row ?? row) !== row) continue;
    const off = Math.hypot(a.x - a.guard.x, a.z - a.guard.z);
    if (off > 0.6 && (!a.ai.route || a.ai.s >= a.ai.route.length - 0.05)) try { setRoute(state, a, routeFrom(town, { row, x: a.x, z: a.z }, { row, x: a.guard.x, z: a.guard.z })); } catch { a.ai.route = null; }
    else if (off <= 0.6 && a.ai.route) { a.ai.route = null; a.face = 'down'; a.head = Math.PI / 2; }
  }
  const on = H && now >= (H.deploy ?? 0) && now < H.search, n = on ? (HUNTS[H.why].rows === CITY ? GUARDS.city : GUARDS.search) : GUARDS.calm;
  let K = null;
  for (let i = i0 - 2; i <= i0 + 2; i++) for (const d of sectionOf(town, row, i).doors) {
    if (d.shop !== 'police' || d.z > Z.kerbN || Math.abs(d.x - me.x) > GUARD_M) continue;
    for (let k = 0; k < n; k++) {
      const id = `guard:${row}:${Math.round(d.x)}:${k}`;
      if (state.actors.some(a => a.guard?.id === id)) continue;
      const x = d.x + [1.4, -1.4, 2.8][k], z = d.z + 0.7, who = `${id}o`;   // (a step out from its door: on a square's or a crescent's front too)
      K ??= policeOf(state.map);
      if (!state.people[who]) officerSheet(state, who, K, stream('station-guard', id), true);
      const a = postAt(state, me, who, row, x, z, false);           // (out of the picture at the door; in it, from out of it, walking to it)
      Object.assign(a, { cop: true, guard: { id, x, z }, squad: id });
      return;                                                       // (one a second, as you come)
    }
  }
  // (fewer once the search is over: the extra ones back inside)
  const extra = state.actors.filter(a => a.guard && !a.alert && Number(a.guard.id.split(':').at(-1)) >= n);
  if (extra.length) state.actors = state.actors.filter(a => !extra.includes(a));
}

// (a pair on foot: from the far end of the stretch in play, past you, along your pavement mostly, a pace apart)
function foot(state, id, r, me, K, armed = false) {
  const row = state.map.row ?? 0;
  const dir = chance(r, 0.5) ? 1 : -1, north = Math.abs(me.z - LINE.N) < Math.abs(me.z - LINE.F), mine = chance(r, OWN_SIDE_P), z = (mine ? north : !north) ? LINE.N : LINE.F, town = townOf(state.map);
  for (let k = 0; k < 2; k++) {
    const who = `${id}p${k}`;
    officerSheet(state, who, K, r, armed);
    const a = makeAgent(state, { who, row, x: me.x - dir * SPAWN_M - dir * k * 1.3, z: z + k * 0.4, speed: 1.1, face: dir > 0 ? 'right' : 'left' });
    Object.assign(a, { cop: true, hunt: id });
    try { setRoute(state, a, routeFrom(town, { row, x: a.x, z: a.z }, { row, x: me.x + dir * (SPAWN_M + 20), z: a.z })); } catch { a.ai.route = null; }
    if (armed) a.ai.pace = JOG_PACE;                              // (the armed response's at a jog)
  }
}

// A hunt's pair walked past and gone (or left on another street): off the map; and its cars gone off the stretch.
function gone(state) {
  const row = state.map.row ?? 0, out = new Set();
  for (const a of state.actors) {
    if (!a.hunt || a.alert || a.ai?.look) continue;
    if (a.huntPost) { if ((a.row ?? row) !== row) out.add(a); continue; }   // (a post: on its corner while you're on its street)
    if ((a.row ?? row) !== row || !a.ai?.route || a.ai.s >= a.ai.route.length - 0.05) out.add(a);
  }
  if (out.size) state.actors = state.actors.filter(a => !out.has(a));
}

// You in a shop on the street, a unit's pair walking past it, you out of their sight through its window: now and then one goes
// in at the door to have a look round, LOOK_IN_S, and comes out and on.
function lookIn(state, me, H, now) {
  const row = state.map.row ?? 0;
  for (const a of state.actors) {
    if (!a.hunt || !a.ai || (a.row ?? row) !== row) continue;
    const L = a.ai.look;
    if (L) {
      if (!L.out && now >= L.until) { L.out = true; const r = routeOut(state, a, L.on); if (r) setRoute(state, a, r); else a.ai.route = null; }
      if (L.out && !unitAt(state, a.x, a.z)) { a.ai.look = null; a.ai.pace = undefined; }
      continue;
    }
    if (!me.within || a.ai.looked === me.within.x || Math.abs(a.x - me.within.x) > LOOK_IN_M || now - (H.units[a.hunt] ?? -Infinity) < UNIT_CHECK_H * HOUR) continue;
    a.ai.looked = me.within.x;                                      // (once a door a pair)
    if (seesActor(state, a, me) || !chance(stream('hunt-look', H.id, a.id, me.within.x), LOOK_IN_P)) continue;
    const r = routeInto(state, a, me.x + 1, me.z);
    if (!r) continue;
    const on = a.ai.route?.pts?.at(-1)?.x ?? a.x + (a.face === 'left' ? -60 : 60);
    setRoute(state, a, r);
    a.ai.look = { until: now + LOOK_IN_S * 1000 + r.length / 1.1 * 1000, on, out: false };
  }
}

// Every officer on the street who sees you, a check a unit an hour: on foot, and from a hunt's car.
function looked(state, bus, me, H, now) {
  if (me.hidden) return;
  const row = state.map.row ?? 0, hour = Math.floor(now / HOUR), p = state.people[me.who];
  for (const c of state.actors) {
    if (!c.cop || c.hidden || c.alert || !c.ai || (c.row ?? row) !== row || !able(state, c)) continue;
    if (Math.hypot(c.x - me.x, c.z - me.z) > EYE_M || !seesActor(state, c, me)) continue;
    const key = c.hunt ?? c.squad ?? (c.ems ? `call:${c.ems}` : c.unit ? 'response' : c.id);
    if (now - (H.units[key] ?? -Infinity) < UNIT_CHECK_H * HOUR) continue;
    H.units[key] = now;
    if (!checked(state, bus, me, H, c, p, inView(state, c.id))) flag(state, bus, me, H, c);
    return;                                                         // (a look a second at most)
  }
  for (const car of state.traffic?.cars ?? []) {
    const crew = car.ems?.crew;
    if (!crew || car.ems.hold || !state.people[crew]) continue;
    const eyes = { x: car.x, z: car.z, head: Math.atan2(me.z - car.z, me.x - car.x), who: crew };
    if (Math.hypot(car.x - me.x, car.z - me.z) > CAR_EYE_M || !seesActor(state, eyes, me)) continue;
    const key = car.ems.hunt;
    if (now - (H.units[key] ?? -Infinity) < UNIT_CHECK_H * HOUR) continue;
    H.units[key] = now;
    if (checked(state, bus, me, H, { ...eyes, id: car.id, car: true }, p, true)) return;
    const full = H.fled || fullMatch(state, p);
    start(state, bus, { why: H.why, x: me.x, who: true, wearing: true, sure: true });   // (called in: as you are now, here)
    pullOver(state, car, me.x);
    H.pull = { car: car.id, full, ms: now };
    say(state, bus, { kind: 'note', text: 'The police car slows beside you, and stops. The doors open.' });
    return;
  }
}

// The check: your Deception against their Awareness, with the hunt's mods; a natural 1 fails whatever the sum. True if you pass.
function checked(state, bus, me, H, c, p, seen) {
  const them = state.people[c.who];
  const r = opposed(state.rng, { skill: 'deception', value: skill(p, 'deception'), body: p, mods: mods(state, H, p, me) }, { skill: 'awareness', value: skill(them, 'awareness'), body: them });
  const ok = r.ok && r.ours.nat !== 1, who = c.car ? 'the car\'s crew' : 'the officer', he = them?.sex === 'f' ? 'she' : 'he';
  if (seen) say(state, bus, { kind: 'roll', roll: r, text: ok ? `${cap(who)}'s eyes go over you, and on.` : r.ours.nat === 1 ? `You look at ${c.car ? 'the car' : who} a moment too long, and ${c.car ? 'they look' : `${he} looks`} back.` : `${cap(who)}'s eyes find you, and stay.` });
  return ok;
}

// Flagged by an officer on foot: called in (the markers as you are now, here); the full description, or run from them before,
// and you're who they want (the alarm); else a suspect, to be searched.
function flag(state, bus, me, H, c) {
  const p = state.people[me.who], full = H.fled || fullMatch(state, p), his = state.people[c.who], he = his?.sex === 'f' ? 'she' : 'he';
  start(state, bus, { why: H.why, x: me.x, who: true, wearing: true, sure: true });
  say(state, bus, { kind: 'note', text: `A word into the radio on ${his?.sex === 'f' ? 'her' : 'his'} shoulder, low, and ${he}'s coming your way.` });
  if (full) return guilty(state, bus, me, c, null);
  suspect(state, bus, me, c);
}
// (a car pulled over by you: once it's stopped, its crew out, and on with it)
function pulled(state, bus, me, H, now) {
  const P = H.pull, car = (state.traffic?.cars ?? []).find(c => c.id === P.car);
  if (!car || now - P.ms > 30000) { delete H.pull; if (car) { car.ems.hold = false; car.taxi.hail = null; } return; }
  if (!car.taxi?.stopped) return;
  delete H.pull;
  const row = state.map.row ?? 0, ids = [car.ems.crew, `${car.ems.hunt}c2`], K = policeOf(state.map), r = stream('hunt-crew', car.ems.hunt);
  state.people[ids[1]] ??= sheet({ id: ids[1], name: 'a police officer', sex: chance(r, 0.25) ? 'f' : 'm', cls: 'cop', skills: { awareness: [K.awareness ?? 8, 0], cqc: [6, 0], tracking: [6, 0] },
    look: { skin: pick(r, K.skin ?? ['light']), hair: { style: 'crew', color: 0x23252f }, shoes: 0x14151c, ...structuredClone(K.look ?? {}) } });
  if (!state.people[ids[1]].items?.length) armCop(state, state.people[ids[1]], 'patrol', r);
  const crew = ids.map((who, k) => Object.assign(makeAgent(state, { who, row, x: car.x + (k ? 1.2 : -1.2), z: LINE.F, speed: 1.2, face: me.x > car.x ? 'right' : 'left' }), { cop: true, hunt: car.ems.hunt }));
  const lead = crew.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  if (P.full || H.fled) return guilty(state, bus, me, lead, null);
  suspect(state, bus, me, lead);
}

// A suspect: they come up to you, and tell you to stay where you are.
function suspect(state, bus, me, c) {
  const K = policeOf(state.map);
  state.$takedown = { cop: c.id, since: state.time.ms, stage: 'closing', why: 'the description', suspect: true, at: { x: me.x, z: me.z, row: state.map.row ?? 0 } };
  say(state, bus, { kind: 'note', text: K.stay ?? '"Police. Stay where you are, please."' });
  heardFrom(state, c, 'Police');
}
// (each second of a suspect's stop: walked off from where they told you to stay, and you've failed to stop; else they come on)
function approach(state, bus, me, H, T, now) {
  const c = state.actors.find(a => a.id === T.cop);
  if (!c?.ai) { state.$takedown = null; return; }
  if ((me.row ?? state.map.row ?? 0) !== T.at.row || Math.hypot(me.x - T.at.x, me.z - T.at.z) > STOP_M) return guilty(state, bus, me, c, 'ran');
  if (!able(state, c)) return;
  const side = Math.sign(c.x - me.x) || 1, row = state.map.row ?? 0;
  const r = me.within ? routeInto(state, c, me.x + side * 0.9, me.z) : null;
  if (r) setRoute(state, c, r);
  else try { setRoute(state, c, routeFrom(townOf(state.map), { row, x: c.x, z: c.z }, { row, x: me.x + side * 0.9, z: me.z })); } catch { c.ai.route = null; }
  for (const o of state.actors) if (o !== c && o.hunt && o.hunt === c.hunt && o.ai) try { setRoute(state, o, routeFrom(townOf(state.map), { row, x: o.x, z: o.z }, { row, x: me.x - side * 1.4, z: me.z + 0.4 })); } catch { o.ai.route = null; }
}

/** Every tick (sim/game.js): a suspect's stop, the officer at your side: the moment's yours (a reflex), or the search. */
export function tick(state, bus) {
  const T = state.$takedown, me = playerOf(state);
  if (!T?.suspect || T.offered || !me || state.$reflex || state.fight) return;
  const c = state.actors.find(a => a.id === T.cop);
  if (!c || !able(state, c) || Math.hypot(c.x - me.x, c.z - me.z) > GRAB_M) return;
  T.offered = true;
  c.vx = c.vz = 0; if (c.ai) c.ai.route = null;
  const mine = state.people[me.who], his = state.people[c.who], he = his?.sex === 'f' ? 'her' : 'him';
  if (offer(state, bus, { why: 'suspect', title: `${cap(his?.name ?? 'an officer')}, at your side: "Your hands on the wall, please."`, who: c.id, x: c.x, none: 'Nothing: let them search you',
    fight: { style: 'even', owner: 'street', line: `You turn on ${he} before ${his?.sex === 'f' ? 'she' : 'he'} can put a hand on you.` }, options: [
      { key: 'submit', label: 'Hands on the wall: let them search you', do: 'submit' },
      { key: 'run', label: 'Run for it', do: 'run' },
      { key: 'shove', label: `Shove ${he} off, and run`, do: 'shove' },
      { key: 'edge', label: `Fight ${he}`, do: 'edge' },
      ...(isArmed(mine) ? [{ key: 'draw', label: 'Your gun', do: 'draw' }] : []),
    ] })) return;
  searched(state, bus, me, c);
}

/** Your answer to a suspect's stop (sim/game.js react(), before the usual): true if it's dealt with here. */
export function suspectChoice(state, bus, me, o, R) {
  const T = state.$takedown, c = R?.who && state.actors.find(a => a.id === R.who);
  if (!T?.suspect || !c) return false;
  if (o.do === 'submit' || o.do === 'none') { searched(state, bus, me, c); return true; }
  if (o.do === 'shove') {
    const mine = state.people[me.who], his = state.people[c.who], he = his?.sex === 'f' ? 'her' : 'him', now = state.time.ms;
    const r = opposed(state.rng, { skill: 'cqc', value: skill(mine, 'cqc'), body: mine }, { skill: 'cqc', value: skill(his, 'cqc') + SHOVE_DC, body: his });
    guilty(state, bus, me, c, 'shove');
    if (r.ok) {
      state.$takedown.shoved = true;
      c.gait = 'stagger'; c.vx = c.vz = 0; if (c.ai) c.ai.downUntil = now + SHOVED_S * 1000;
      me.$flee = { until: now + RUN_S * 1000, dir: Math.sign(me.x - c.x) || 1, run: true };
      say(state, bus, { kind: 'roll', roll: r, text: `Both hands into ${he}, hard, and ${his?.sex === 'f' ? 'she' : 'he'} goes back a step: you're away.` });
    } else {
      say(state, bus, { kind: 'roll', roll: r, text: `You get your hands on ${he}, and ${his?.sex === 'f' ? 'she\'s' : 'he\'s'} ready for it.` });
      pin(state, bus, me, c, 'shove');
    }
    return true;
  }
  guilty(state, bus, me, c, o.do === 'edge' ? 'fought' : o.do === 'draw' ? 'drew' : 'ran');
  return false;                                                     // (the run, the fight, the gun: the usual reaction does them)
}

/**
 * Who they want (the full description matched, or a suspect who ran, fought, shoved, drew): the alarm (sim/armed.js: the order,
 * the cuffs, the takedown), the officer and the rest of the unit with it; how (resisting) on the file, and on the hunt: run
 * once, flagged again is the alarm at once.
 */
export function guilty(state, bus, me, c, how = null) {
  const now = state.time.ms, H = state.hunt;
  if (H && how) H.fled = true;
  for (const a of state.actors) if (a.cop && (a === c || (c.hunt && a.hunt === c.hunt))) a.alert = now;
  raiseAlarm(state, bus, me.x, 'the description');
  const T = state.$takedown;
  if (T?.suspect) { T.suspect = false; T.offered = false; if (how) T.how = how === 'fought' ? 'fought' : how === 'ran' ? 'ran' : 'shove'; }
  if (how) { state.$alarm.resisted = how; policeHeat(state, RESIST_POLICE); }
  if (how === 'ran') say(state, bus, { kind: 'note', text: '"Stop! Police!" Behind you, and then running feet.' });
}

/** Searched, against the wall: something on you they can hold you on (a weapon, blood), arrested; nothing, taken in for questioning. */
export function searched(state, bus, me, c) {
  const p = state.people[me.who], them = state.people[c.who], he = them?.sex === 'f' ? 'she' : 'he';
  const blood = shows(p).some(m => /blood/.test(m.why)), found = searchOf(state, them), coat = describedIn(huntOf(state), p.bag);
  say(state, bus, { kind: 'note', text: `Hands on the wall. ${cap(he)} pats you down, coat, pockets, waistband, ankles, while the other one watches your hands${p.bag?.length ? ', and looks in the bag' : ''}.` });
  if (coat) {                                                     // (the clothes they're looking for, in a shop's bag: the user, 2026-11-04)
    say(state, bus, { kind: 'note', text: `In the shop's bag, folded: ${coat.name}. ${cap(he)} holds it up, and looks at you. "You're under arrest."` });
    state.$takedown = null;
    return arrest(state, bus, me, 'searched', 'the description', { found: [`${coat.name}, from the shop's bag`, ...found.filter(k => !isGun(k)).map(k => thingName(k))] });
  }
  if (found.length || blood) {
    const words = found.filter(k => !isGun(k)).map(k => thingName(k));
    take(p, found.filter(k => !isGun(k)));                          // (a gun: arrest() takes it, into evidence)
    say(state, bus, { kind: 'note', text: `${found.length ? `${cap(found.map(k => thingName(k)).join(', '))}. ` : ''}${blood ? 'And the blood on you. ' : ''}"You're under arrest."` });
    state.$takedown = null;
    return arrest(state, bus, me, 'searched', found.length ? 'what they found' : 'the blood on you', { found: words });
  }
  questioned(state, bus, me);
}

/** The clothes they described, in a bag (a shop's, with what you took off in it): the piece, or null. */
export function describedIn(H, bag) {
  if (!bag?.length || !H) return null;
  const looks = [...(H.wearing?.known ? [H.wearing.look] : []), ...(H.wore ?? [])];   // (as they have you now, and as they had you before)
  for (const L of looks) {
    const [top, topC, hat, hatC] = L.split('|');
    const x = bag.find(y => y.look && ((y.slot === 'top' && y.look.kind === top && String(y.look.color) === topC) || (y.slot === 'hat' && hat !== 'bare' && y.look.kind === hat && String(y.look.color ?? '') === hatC)));
    if (x) return x;
  }
  return null;
}

/** Taken in for questioning: the hours at the station (sim/game.js skips them; out on its steps: sim/armed.js released()), the costs, a paper. The hunt over. */
export function questioned(state, bus, me) {
  const H = huntOf(state), Q = QUESTION[H?.why ?? 'fight'], now = state.time.ms, st = nearestDoor(state, 'police'), station = st ? low(st.label) : 'the station';
  addHeat(state, Q.heat); policeHeat(state, POLICE_QUESTION);
  const P = state.campaign?.posting, cover0 = P?.cover;
  if (P) P.cover = Math.max(0, (P.cover ?? 70) - Q.cover);
  for (const a of state.actors) if (a.cop) { a.alert = null; if (a.ai) { a.ai.gunner = null; a.ai.closing = null; a.ai.pace = undefined; } }
  delete state.$alarm; delete state.$response; delete state.hunt; state.$takedown = null;
  const ward = underGuard(state.people[me.who], now);              // (hurt: a hospital first, under guard)
  // (under a legend, no diplomatic passport: its papers read, the legend looked into, sim/prison.js; it breaks, and you're theirs)
  const deep = noImmunity(state);
  if (deep && !questionedDeep(state, bus, me)) return true;
  const lines = [
    `What they wanted you for: ${low(H?.what ?? 'a description that fitted you')}.`,
    'Searched against the wall: nothing on you they could hold you on.',
    ...(ward ? [ward.line] : []),
    `${hoursWords(Q.h)} at ${station}, in a room with a table and two chairs: where you were, and when, and who can say so. ${deep ? `${P.alias}'s papers, read twice, and a call to ${P.employer} at an hour that will be remarked on.` : 'The diplomatic passport, and the calls it takes.'} They let you go: there's nothing to keep you on.`,
    `Heat +${Q.heat}; the police's file on you +${POLICE_QUESTION}${P ? `; ${deep ? 'the job\'s standing' : 'the ambassador\'s view of you'} ${cover0} → ${P.cover}` : ''}.`,
    'Your name on their list of those questioned: if it ever comes back to you, it starts there.',
  ];
  say(state, bus, { kind: 'note', text: `The car, and ${station}: ${low(hoursWords(Q.h))} of questions, and they let you go.` });
  state.campaign?.log?.push({ ms: now, text: `Taken in for questioning: ${low(H?.what ?? 'a description that fitted')}; ${hoursWords(Q.h).toLowerCase()} at the station; ${deep ? 'the job\'s standing' : 'the ambassador\'s view of you'} −${Q.cover}.` });
  bus?.emit('papers', [{ kind: 'questioned', title: 'TAKEN IN FOR QUESTIONING', lines }]);
  state.$held = (Q.h + (ward?.h ?? 0)) * HOUR;
  state.$released = true;
  return true;
}
