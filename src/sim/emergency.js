// TRADECRAFT sim: the emergency services (the user, 2026-11-03: "people are just ignoring this shot woman on the
// ground, they should call the emergency services, police and ambulance, which means you need to implement emergency
// services and how they behave and carry bodies away. Also, police would cordon crimescenes for at least a day and keep
// agents posted there for that long. If they were called with our description, they should recognize us citywide of
// course, being seen shooting someone and the police being called on us should be massive hit to our cover unless we can
// change our appearance enough to not be recognized"; "Add a timer (tradecraft instinct) hinting at how long we expect
// the emergency services will make it on scene"). The engine's, on any street with police (sim/game.js, once a second).
//
// **The call.** Someone down in the street (shot, knocked flat, collapsed, dead: you too), seen by passers-by within
// SEE_DOWN_M: each second each of them may make the call (CALL_P), and stands there on the phone a while. A call
// (state.calls) is a place and its casualties, and the times the police and an ambulance will be there: the country's
// minutes (its police profile's ems: sim/countries/), from the call. If you were seen at it in the last VIOLENT_S
// (markViolent(): a shot fired, a killing, a fight, seen; how near the nearest who saw it, and the light), the caller
// describes you, and the hunt for you begins (sim/hunt.js start(): what you wear nearly always, your face by how near
// and how lit they were; as bad as the casualties make it, gravity(): a killing, someone shot, shots fired, a fight).
// **Shots, nobody hit** (heard()): passers-by within SHOTS_HEARD_M of your shots may call the police (SHOTS_CALL_P a
// second each, SHOTS_CALL_S after them): a call for the police alone, to where the shots were, and the hunt for the gunman
// (described if you were seen firing).
// **What you know of it** (etaOf(): the instinct's timer on the watch, src/ui/ui.js): a caller you can see or hear
// (KNOW_M) tells you it's been called, and your Tradecraft guesses how long they'll be: the guess off by an error drawn
// once a call (ERR_K × what you lack of 100), said as exactly as your feel for it goes (70 and over, to the minute; 40
// and over, about so many; under, "a few minutes", "any moment", "a while").
// **They come.** Each by its car (sim/traffic.js sendEms()), lights going, pulled up at the kerb by the place; its crew
// of two out of it and to the casualties. The ambulance's kneel and work (TREAT_S: what bleeds outside is dressed as
// they start), then carry them to it on the stretcher, and go: the dead too, under a sheet. Taken, someone's in
// hospital (what bleeds inside stopped); you, a hospital's care (sim/services.js care(): what a walk-in at its desk
// would get) and the hours there (HOSPITAL_H), then out on the pavement in front of the hospital nearest where you fell
// (sim/services.js outside()), and if they've your description (described()), the police are waiting (sim/armed.js
// arrest()). A walk-in's hours at a hospital's desk (sim/services.js admit()) are skipped the same way, and what an
// official hospital costs counted at the end of them: your name in its records (VISIT_HEAT), a gunshot or a knife wound
// reported (sim/aid.js HOSPITAL_HEAT, sim/police.js POLICE_HOSPITAL).
// The police's tape off the place (state.cordons: CORDON_M round it, CORDON_H), one of them posted at it for as long
// (back at it whenever you come back to that street), the other taking statements (STATEMENT_S), and gone. Off the
// street you're on, a call plays out unseen: the tape's there when you come back.
// **Your description** is the hunt's (sim/hunt.js): every officer who sees you weighs you against it, a check a unit an
// hour, and your face, your clothes and how far you've gone since count. described(): all they have matches you as you
// are now (a hospital's corridor: the officer waiting there).
import { policeHeat, POLICE_HOSPITAL } from './police.js';
import { stream, range, chance, pick, next } from './rng.js';
import { say } from './log.js';
import { seesActor } from './perception.js';
import { isPasserby, lies } from './crowd.js';
import { makeAgent, setRoute, rowOf } from './agents.js';
import { routeFrom, LINE } from './city.js';
import { streetName } from './map/street.js';
import { townOf } from './cities/index.js';
import { sheet } from './people.js';
import { policeOf } from './countries/index.js';
import { canStand, casualty } from './health.js';
import { sendEms } from './traffic.js';
import { armCop, arrest } from './armed.js';
import { addHeat } from './heat.js';
import { shortName } from './fight.js';
import { care, needsOf, outside, hoursWords, VISIT_HEAT, bedHours, discharged } from './services.js';
import { HOSPITAL_HEAT } from './aid.js';
import { start as startHunt, know, fullMatch, faceP, wearP, onAlert } from './hunt.js';
import { lightHere } from './perception.js';
import { MIN, HOUR, DAY } from './clock.js';

export const SEE_DOWN_M = 25, CALL_P = 0.1, KNOW_M = 18, ON_PHONE_S = 40, VIOLENT_S = 120, MERGE_M = 30;
export const DRIVE_S = 14, TREAT_S = [60, 150], STATEMENT_S = 120, CORDON_H = 24, CORDON_M = 4.5, HOSPITAL_H = 8;
export const LINE_WARN_S = 30, ERR_K = 0.7;
export const SHOTS_HEARD_M = 60, SHOTS_CALL_P = 0.15, SHOTS_CALL_S = 90;   // (shots with nobody hit: who hears them, how soon one of them calls, how long after the last)
const DEFAULT_EMS = { police: [8, 15], ambulance: [10, 20] };
// (a call on a street the city's armed search is out on, in its window: answered in a quarter of the time, the police
// already on the corners and the ambulances standing by: sim/hunt.js onAlert(); the user, 2026-11-04)
export const ON_ALERT_K = 0.25;
const responseMin = (state, row, now, span, r) => range(r, ...span) * (onAlert(state, row, now) ? ON_ALERT_K : 1);

const playerOf = (state) => state.actors.find(a => a.who === state.player);
/** What a witness says of someone: the top they wear and its colour, the hat, the hair. Another of any, someone else. */
export const seenLook = (look = {}) => [look.top?.kind, look.top?.color, look.hat?.kind ?? 'bare', look.hat?.color, look.hair?.style, look.hair?.color].join('|');
/** Whether the police here have p's full description, as p looks now (their face and their clothes: sim/hunt.js). */
export const described = (state, p) => fullMatch(state, p);

/** You at it, and seen (a shot fired, a killing, a fight: sim/shooting.js, sim/interact.js): whoever sees you now will describe you (how near the nearest, the light: what they'll have, sim/hunt.js). */
export function markViolent(state, me) {
  if (!me) return;
  const seers = state.actors.filter(a => a !== me && a.ai && !a.hidden && isPasserby(a) && Math.hypot(a.x - me.x, a.z - me.z) < SEE_DOWN_M && seesActor(state, a, me));
  if (seers.length) state.$violent = { ms: state.time.ms, look: seenLook(state.people[me.who]?.look), d: Math.min(...seers.map(a => Math.hypot(a.x - me.x, a.z - me.z))), light: state.$world ? lightHere(state, me.x, me.z) : 1, x: me.x };
}
// (your doing, though nobody saw you: someone your rounds hit, or your shots, lately)
const yours = (state, c, now) => c.who.some(id => { const q = state.people[actorOf(state, id)?.who]; return q?.hitBy?.id === state.player && now - q.hitBy.ms < VIOLENT_S * 1000; }) || (state.$shotBy && now - state.$shotBy.ms < VIOLENT_S * 1000);
// (how bad it is, for the hunt: someone dead, someone shot, shots fired, or a fight)
function gravity(state, c, now) {
  const hurt = c.who.map(id => state.people[actorOf(state, id)?.who]).filter(Boolean);
  if (hurt.some(q => q.dead)) return 'killed';
  if (hurt.some(q => (q.injuries ?? []).some(i => i.gunshot))) return 'wounded';
  if (state.$shotBy && now - state.$shotBy.ms < VIOLENT_S * 1000) return 'shots';
  return 'fight';
}

/** Once a second, on a street with police (sim/game.js): the calls made, the services on their way and at work, your description. */
export function second(state, bus, me) {
  if (state.map.kind !== 'street' || !me) return;
  const now = state.time.ms, row = state.map.row ?? 0;
  report(state, bus, me, now, row);
  heard(state, bus, me, now, row);
  found(state, now, row);
  for (const c of state.calls ?? []) if (!c.done) (c.row === row ? play : offstage)(state, bus, me, c, now);
  state.calls = (state.calls ?? []).filter(c => !c.done || now - c.ms < DAY);
  state.cordons = (state.cordons ?? []).filter(k => k.until > now);
  posted(state, bus, me, now, row);
}

// Someone down, seen: a call, or one more casualty on a call already made.
function report(state, bus, me, now, row) {
  for (const a of state.actors) {
    const p = a.who && state.people[a.who];
    if (!p || a.hidden || p.reported || rowOf(state, a) !== row || a.ems) continue;
    const down = casualty(p, a);                                  // (down, or shot and sat against a wall after it: sim/health.js)
    if (!down || (a === me && state.$takedown?.stage === 'pin' && canStand(p))) continue;
    a.fell ??= now;                                               // (when they were first seen lying there: found(), if you leave them to it)   // (you face down under an officer's knee: the police have it in hand, nobody calls an ambulance: sim/armed.js)
    const near = state.actors.filter(w => w !== a && w.ai && !w.hidden && isPasserby(w) && !(w.ai.fled > now - 20000 && Math.hypot(w.x - a.x, w.z - a.z) > 12) && Math.hypot(w.x - a.x, w.z - a.z) < SEE_DOWN_M && seesActor(state, w, a));
    if (!near.length || !chance(state.rng, 1 - (1 - CALL_P) ** near.length)) continue;
    p.reported = now;
    const caller = pick(state.rng, near);
    Object.assign(caller, { gait: 'phone', vx: 0, vz: 0 }); caller.ai.wait = ON_PHONE_S * 20;
    let c = (state.calls ?? []).find(k => !k.done && k.row === row && Math.hypot(k.x - a.x, k.z - a.z) < MERGE_M);
    if (c) {
      c.who.push(a.id);
      if (c.shots && c.ambulance.stage === 'done') { const E2 = policeOf(state.map)?.ems ?? DEFAULT_EMS, r2 = stream('ems-late', state.map.seed, now); c.ambulance = { stage: 'coming' }; c.at.ambulance = now + Math.round(responseMin(state, row, now, E2.ambulance, r2) * MIN); c.err.ambulance = gauss(r2); }   // (someone hurt after all: an ambulance too)
      continue;
    }
    const E = policeOf(state.map)?.ems ?? DEFAULT_EMS, r = stream('ems', state.map.seed, now);
    const V = state.$violent && now - state.$violent.ms < VIOLENT_S * 1000 ? state.$violent : null;
    c = { id: `call${now}`, city: state.map.city ?? null, row, x: a.x, z: a.z, ms: now, who: [a.id], described: V?.look ?? null, known: false,
      at: { police: now + Math.round(responseMin(state, row, now, E.police, r) * MIN), ambulance: now + Math.round(responseMin(state, row, now, E.ambulance, r) * MIN) },   // (before the hunt it may start: its window's)
      err: { police: gauss(r), ambulance: gauss(r) }, police: { stage: 'coming' }, ambulance: { stage: 'coming' } };
    (state.calls ??= []).push(c);
    // (you know it's been called: you saw or heard the caller, or it's your doing on this street (someone you shot or fought,
    // your shots, you seen at it): with people down in the street, someone always calls. The user, 2026-11-04, three shot and
    // two knocked out, and neither the logos nor the icons: the caller had been out of sight)
    const sawCaller = Math.hypot(caller.x - me.x, caller.z - me.z) < KNOW_M || seesActor(state, me, caller), mine = !!c.described || yours(state, c, now);
    const knows = sawCaller || mine;
    // (described: the hunt for you, with what the caller had: your clothes nearly always, your face by how near and how lit; sim/hunt.js)
    if (c.described) {
      const w = stream('hunt-witness', state.map.seed, now);
      startHunt(state, bus, { why: gravity(state, c, now), row, x: V.x ?? a.x, who: chance(w, faceP(V.d ?? 10, V.light ?? 1)), wearing: chance(w, wearP(V.light ?? 1)), first: c.at.police, aware: false });
    } else if (yours(state, c, now)) startHunt(state, bus, { why: gravity(state, c, now), row, x: a.x, first: c.at.police, aware: false });   // (nobody saw who: the hunt for whoever did it, with nothing of you to go on; the user, 2026-11-04, after shooting people unseen, one patrol six streets on)
    // (in your sight or your hearing: you know it's been called, and your instinct guesses how long)
    if (knows) {
      c.known = true;
      const eta = etaOf(state, c);
      say(state, bus, { kind: 'instinct', text: `${sawCaller ? `Someone's on the phone, looking at ${a === me ? 'you' : shortName(state, a.who)}: police, an ambulance.${c.described ? ' And they\'re describing you as they talk.' : ''}` : `${a === me ? 'You, down in the street' : 'People down in the street'}: someone will have called it in by now, somewhere out of sight.`} ${cap(eta.map(e => `${e.word}: ${e.text}`).join(', '))}.${state.actors.some(o => o.cop && !o.unit && !o.hidden && (o.row ?? row) === row) ? ' A patrol\'s already on the street, though: they won\'t wait for the call.' : ''}` });   // (the call's squad and the patrol here: not the same men)
      if (mine) know(state, bus);                                 // (and what they'll have of you: your Tradecraft's read, sim/hunt.js)
    }
  }
}
// Your shots heard, nobody hit (the user, 2026-11-04: "gunshots with no victims seem to not trigger a police call ? It should"):
// passers-by within SHOTS_HEARD_M may call it in (SHOTS_CALL_P a second each, for SHOTS_CALL_S after the last shot), a call
// for the police alone, to where the shots were; you described if you were seen firing, and the hunt for the gunman either
// way (sim/hunt.js: with nothing of you to go on, if nobody saw you).
function heard(state, bus, me, now, row) {
  const S = state.$shotBy;
  if (!S || S.called || now - S.ms > SHOTS_CALL_S * 1000) return;
  const x = S.x ?? me.x, z = S.z ?? me.z;
  if ((state.calls ?? []).some(k => !k.done && k.row === row && Math.hypot(k.x - x, k.z - z) < MERGE_M && now - k.ms < SHOTS_CALL_S * 1000)) { S.called = now; return; }   // (called in already, with its casualties)
  const near = state.actors.filter(w => w.ai && !w.hidden && isPasserby(w) && rowOf(state, w) === row && Math.hypot(w.x - x, w.z - z) < SHOTS_HEARD_M);
  if (!near.length || !chance(state.rng, 1 - (1 - SHOTS_CALL_P) ** near.length)) return;
  S.called = now;
  const caller = pick(state.rng, near);
  Object.assign(caller, { gait: 'phone', vx: 0, vz: 0 }); caller.ai.wait = ON_PHONE_S * 20;
  const E = policeOf(state.map)?.ems ?? DEFAULT_EMS, r = stream('ems', state.map.seed, now), at = now + Math.round(responseMin(state, row, now, E.police, r) * MIN);
  const V = state.$violent && now - state.$violent.ms < VIOLENT_S * 1000 ? state.$violent : null;
  const c = { id: `call${now}`, city: state.map.city ?? null, row, x, z, ms: now, who: [], shots: true, described: V?.look ?? null, known: false, at: { police: at, ambulance: at },
    err: { police: gauss(r), ambulance: 0 }, police: { stage: 'coming' }, ambulance: { stage: 'done' } };
  (state.calls ??= []).push(c);
  const w = stream('hunt-witness', state.map.seed, now);
  startHunt(state, bus, { why: 'shots', row, x, who: !!V && chance(w, faceP(V.d ?? 10, V.light ?? 1)), wearing: !!V && chance(w, wearP(V.light ?? 1)), first: at, aware: false });
  // (your shots, heard: you know someone's calling them in, whether you see who or not)
  {
    const saw = Math.hypot(caller.x - me.x, caller.z - me.z) < KNOW_M || seesActor(state, me, caller);
    c.known = true;
    const eta = etaOf(state, c);
    say(state, bus, { kind: 'instinct', text: `${saw ? `Someone's on the phone, looking back the way the shots came from: the police.${V ? ' And they\'re describing you as they talk.' : ''}` : 'Shots on a street like this: someone\'s calling it in, somewhere out of sight.'} ${cap(eta.map(e => `${e.word}: ${e.text}`).join(', '))}.` });
    know(state, bus);
  }
}

const gauss = (r) => { let s = 0; for (let k = 0; k < 4; k++) s += next(r); return (s - 2) / 0.577; };   // (about a standard normal, from four uniforms)

/** Your guess at how long they'll be (the call's), by your Tradecraft: [{ kind, word, text }], those still to come. */
export function etaOf(state, c, now = state.time.ms) {
  const p = state.people[state.player], os = p?.os ?? 20, out = [];
  for (const kind of ['police', 'ambulance']) {
    const s = c[kind].stage, word = kind === 'police' ? 'the police' : 'an ambulance';
    if (s !== 'coming' && s !== 'driving') { if (s === 'working' || s === 'walking') out.push({ kind, word, text: 'here' }); continue; }
    const left = Math.max(0, c.at[kind] - now), guess = Math.max(0, left * (1 + c.err[kind] * ERR_K * (1 - os / 100))), m = guess / MIN;
    const text = os >= 70 ? (m < 1 ? 'under a minute' : `${Math.round(m)} min`) : os >= 40 ? (m < 2 ? 'any moment' : `about ${Math.max(2, Math.round(m / 2) * 2)} min`) : m < 3 ? 'any moment' : m < 9 ? 'a few minutes' : 'a while yet';
    out.push({ kind, word, text, ms: guess });
  }
  return out;
}
/**
 * The two logos by the watch (src/ui/ui.js; the user, 2026-11-04: "two pixel art logos always visible in top right close to
 * the time and flashing when inbound with the time underneath"): [police, ambulance], each { kind, state: 'inbound' | 'here'
 * | 'none', short (the guess, a few letters: '12M', '~8M', 'SOON'), where (its street, off yours) }; the call you know of,
 * on whatever street.
 */
export function emsBadges(state) {
  const none = (kind) => ({ kind, state: 'none', short: '' });
  if (state.map?.kind !== 'street') return [none('police'), none('ambulance')];
  const row = state.map.row ?? 0, mine = (state.calls ?? []).filter(k => k.known && !k.done && (!k.city || k.city === (state.map.city ?? null)));
  const c = mine.filter(k => k.row === row).at(-1) ?? mine.at(-1);
  if (!c) return [none('police'), none('ambulance')];
  const eta = etaOf(state, c), os = state.people[state.player]?.os ?? 20, where = c.row !== row ? streetName(townOf(state.map), c.row) : null;
  return ['police', 'ambulance'].map(kind => {
    const S = c[kind].stage, e = eta.find(x => x.kind === kind);
    if (S === 'working' || S === 'walking') return { kind, state: 'here', short: 'HERE', where };
    if (!e || (S !== 'coming' && S !== 'driving')) return none(kind);
    const m = Math.round((e.ms ?? 0) / MIN);
    return { kind, state: 'inbound', short: os >= 70 ? (m < 1 ? 'NOW' : `${m}M`) : os >= 40 ? (m < 2 ? 'NOW' : `${Math.max(2, Math.round(m / 2) * 2)}M`) : m < 3 ? 'NOW' : m < 9 ? 'SOON' : 'LATER', where };
  });
}

/**
 * The call you know of and are waiting on, its guesses: for the watch (src/ui/ui.js), or null. On whatever street it is (the
 * user, 2026-11-04: "I moved up a few streets as police had been called and the 'timer' for emergency services dissapeared"):
 * off yours, each guess says where ({ where: the street's name }).
 */
export function waiting(state) {
  if (state.map?.kind !== 'street') return null;
  const row = state.map.row ?? 0, mine = (state.calls ?? []).filter(k => k.known && !k.done && (!k.city || k.city === (state.map.city ?? null)));
  const c = mine.filter(k => k.row === row).at(-1) ?? mine.at(-1);
  if (!c) return null;
  const where = c.row !== row ? streetName(townOf(state.map), c.row) : null;
  const eta = etaOf(state, c).filter(e => e.text !== 'here').map(e => (where ? { ...e, where } : e));
  return eta.length ? eta : null;
}

// A call on the street you're on, played out: the cars sent, the crews out of them and at work, the cars gone.
function play(state, bus, me, c, now) {
  for (const kind of ['ambulance', 'police']) {
    const S = c[kind];
    if (S.stage === 'coming' && now >= c.at[kind] - DRIVE_S * 1000) {
      const car = sendEms(state, kind, c.x, c.id);
      if (car) { S.stage = 'driving'; S.car = car.id; if (c.known || Math.abs(me.x - c.x) < 60) say(state, bus, { kind: 'note', text: kind === 'police' ? 'A siren, coming closer: the police.' : 'A siren, the other kind: an ambulance.' }); }
    } else if (S.stage === 'driving') {
      const car = carOf(state, S.car);
      if (!car) { S.stage = 'coming'; continue; }
      // (pulled up at the place, or as near as it gets: behind the other one, held up a moment within reach of it)
      if (!car.taxi?.stopped && car.v < 0.2 && Math.abs(car.x - c.x) < 25) { S.still = S.still ?? now; if (now - S.still > 2000) car.taxi.stopped = now; } else if (car.v >= 0.2) S.still = null;
      if (car.taxi?.stopped) { S.crew = crew(state, kind, c, car); S.stage = 'walking'; }
    } else if (S.stage === 'walking') {
      const A = S.crew.map(id => actorOf(state, id)).filter(Boolean);
      if (!A.length) { S.stage = 'done'; continue; }
      if (A.every(a => Math.hypot(a.x - c.x, a.z - c.z) < 2.2 || !a.ai.route)) begin(state, bus, me, c, kind, S, A, now);
    } else if (S.stage === 'working') {
      const A = S.crew.map(id => actorOf(state, id)).filter(Boolean);
      if (kind === 'ambulance') for (const a of A) { a.gait = 'crouch'; a.vx = a.vz = 0; }
      if (now >= S.until) { kind === 'ambulance' ? load(state, bus, me, c, S, A) : leave(state, c, S, A, true); }
    } else if (S.stage === 'leaving') {
      const A = S.crew.map(id => actorOf(state, id)).filter(Boolean), car = carOf(state, S.car);
      if (!car || A.every(a => Math.hypot(a.x - car.x, a.z - car.z) < 2.5 || !a.ai.route) || now - S.left > 60000) finish(state, bus, me, c, kind, S, A, car);
    }
  }
  if (c.ambulance.stage === 'done' && c.police.stage === 'done') c.done = true;
}

// Off the street you're on: when they'd have been and gone, the casualties are gone and the tape's up.
function offstage(state, bus, me, c, now) {
  if (now < Math.max(c.at.police, c.at.ambulance) + 10 * MIN) return;
  cordon(state, c, now);
  c.done = true;
  // (and who was lying there taken: the living to a hospital, the dead to the morgue; never you, who's here)
  const gone = new Set(c.who.filter(id => id !== me?.id));
  if (gone.size) state.actors = state.actors.filter(a => !gone.has(a.id));
}

// Who's lying on a street you've left, nobody having called it in (FOUND_MIN after you'd seen them there, or they fell): found
// and called in, the emergency services' call there played out off it (offstage()), and taken; the user, 2026-11-04.
export const FOUND_MIN = [8, 25];
function found(state, now, row) {
  for (const a of state.actors) {
    const p = a.who && state.people[a.who];
    if (!p || p.reported || a.ems || rowOf(state, a) === row || !lies(state, a)) continue;
    a.fell ??= now;
    if (now - a.fell < range(stream('found', a.id), ...FOUND_MIN) * MIN) continue;
    p.reported = now;
    const c = (state.calls ?? []).find(k => !k.done && k.row === a.row && Math.hypot(k.x - a.x, k.z - a.z) < MERGE_M);
    if (c) { c.who.push(a.id); continue; }
    const E = policeOf(state.map)?.ems ?? DEFAULT_EMS, r = stream('ems-found', a.id);
    (state.calls ??= []).push({ id: `call${now}${a.id}`, city: state.map.city ?? null, row: rowOf(state, a), x: a.x, z: a.z, ms: now, who: [a.id], described: null, known: false,
      at: { police: now + Math.round(range(r, ...E.police) * MIN), ambulance: now + Math.round(range(r, ...E.ambulance) * MIN) }, err: { police: 0, ambulance: 0 }, police: { stage: 'coming' }, ambulance: { stage: 'coming' } });
  }
}

/**
 * After a time skip (sim/game.js skip()): a call on your street long since dealt with (its times and OFFSTAGE_MIN past)
 * played out as one off it is, its cordon up and its people taken; one still due, on its way as it was.
 */
export function caughtUp(state, bus) {
  if (state.map?.kind !== 'street') return;
  const now = state.time.ms, me = state.actors.find(a => a.who === state.player);
  const idle = (S) => S.stage === 'coming' || S.stage === 'done';   // (not one of them on the street at it: that plays out as it is)
  for (const c of state.calls ?? []) if (!c.done && idle(c.police) && idle(c.ambulance) && now >= Math.max(c.at.police, c.at.ambulance) + 30 * MIN) offstage(state, bus, me, c, now);
}

// The crew out of the car: two of the ambulance's in their jackets, or two officers armed as the country's are.
function crew(state, kind, c, car) {
  const K = policeOf(state.map), E = K?.ems ?? {}, r = stream('ems-crew', state.map.seed, c.ms, kind), town = townOf(state.map), row = c.row, ids = [];
  for (let k = 0; k < 2; k++) {
    const who = `${kind}${c.ms % 1e7}${k}`;
    state.people[who] = sheet({ id: who, name: kind === 'police' ? 'a police officer' : 'a paramedic', sex: chance(r, 0.35) ? 'f' : 'm', cls: kind === 'police' ? 'cop' : 'civ',
      skills: kind === 'police' ? { awareness: [(K?.awareness ?? 8), 0], cqc: [8, 1], tracking: [6, 0] } : { medicine: [14, 2], awareness: [6, 0] },
      look: { skin: pick(r, K?.skin ?? ['light']), hair: { style: pick(r, ['crew', 'short', 'bun']), color: pick(r, [0x23252f, 0x47302a, 0x8f6a3b]) }, shoes: 0x14151c, ...structuredClone(kind === 'police' ? K?.look ?? {} : E.medic ?? {}) } });
    if (kind === 'police') armCop(state, state.people[who], 'patrol', r);
    const a = makeAgent(state, { who, row, x: car.x + (k ? 1.2 : -1.2), z: LINE.F, speed: 1.6, face: c.x > car.x ? 'right' : 'left' });
    Object.assign(a, { ems: c.id, ...(kind === 'police' ? { cop: true } : {}) });
    try { setRoute(state, a, routeFrom(town, { row, x: a.x, z: a.z }, { row, x: c.x + (k ? 0.9 : -0.9), z: c.z })); } catch { a.ai.route = null; }
    ids.push(a.id);
  }
  return ids;
}

// At the place: the ambulance's to work on them (what bleeds outside dressed at once), the police's to the tape and the statements.
function begin(state, bus, me, c, kind, S, A, now) {
  S.stage = 'working';
  if (kind === 'ambulance') {
    S.until = now + Math.round(range(state.rng, ...TREAT_S) * 1000);
    for (const id of c.who) {
      const p = state.people[actorOf(state, id)?.who];
      if (!p || p.dead) continue;
      for (const i of p.injuries ?? []) if (i.bleed > now && !i.internal) { i.dressed = true; i.bleed = now; }
    }
    say(state, bus, { kind: 'note', text: `The paramedics kneel by ${c.who.length > 1 ? 'them' : 'the one down'}: scissors through the clothes, pressure, a mask.` });
  } else {
    cordon(state, c, now);
    const [post, other] = A;
    if (post) { post.ai.posted = c.id; post.ai.route = null; Object.assign(post, { x: c.x + CORDON_M + 0.4, z: c.z, vx: 0, vz: 0, face: 'left' }); }
    S.until = now + STATEMENT_S * 1000;
    if (other) other.ai.wait = STATEMENT_S * 20;
    if (Math.abs(me.x - c.x) < 40) say(state, bus, { kind: 'note', text: 'The police string tape round the place, post one of theirs at it, and start asking who saw what.' });
  }
}

// The stretcher: the casualties on it and carried to the ambulance; the crew after them.
function load(state, bus, me, c, S, A) {
  for (const id of c.who) { const a = actorOf(state, id); if (a && a !== me) a.hidden = true; }
  leave(state, c, S, A, false);
  if (c.who.includes(me.id)) return;                                  // (you: at the hospital, when they've put you in: finish())
  say(state, bus, { kind: 'note', text: c.who.some(id => state.people[actorOf(state, id)?.who]?.dead) ? 'A sheet over the face, and onto the stretcher, and away.' : 'Onto the stretcher, a drip held up over them, and into the back.' });
}
// The crew back to the car (the posted officer stays at the tape).
function leave(state, c, S, A, police) {
  S.stage = 'leaving'; S.left = state.time.ms;
  const car = carOf(state, S.car), town = townOf(state.map);
  for (const a of A) {
    if (police && a.ai.posted) continue;
    a.ai.wait = 0; a.gait = 'idle';
    if (car) try { setRoute(state, a, routeFrom(town, { row: c.row, x: a.x, z: a.z }, { row: c.row, x: car.x, z: LINE.F })); } catch { a.ai.route = null; }
  }
}
// In and away: the crew gone, the casualties gone to hospital (you, the hours there), the car let go.
function finish(state, bus, me, c, kind, S, A, car) {
  const gone = new Set(A.filter(a => !(kind === 'police' && a.ai.posted)).map(a => a.id));
  if (kind === 'ambulance') {
    for (const id of c.who) {
      const a = actorOf(state, id), p = a && state.people[a.who];
      if (!p) continue;
      if (!p.dead) { for (const i of p.injuries ?? []) if (i.internal) i.bleed = state.time.ms; p.hospital = state.time.ms; }
      if (a === me) hospital(state, bus, me, c); else gone.add(a.id);
    }
  }
  state.actors = state.actors.filter(a => !gone.has(a.id));
  if (car?.ems) { car.ems.hold = false; car.ems.lights = kind === 'ambulance'; }
  S.stage = 'done';
}

// You, taken in: a hospital's care (sim/services.js care(): stitched, dressed, the blood put back), the hours in a bed;
// out at the end of it in front of the hospital nearest where it happened. Described, the police are at the bedside.
function hospital(state, bus, me, c) {
  const p = state.people[me.who], ms = state.time.ms, N = needsOf(p, ms);   // (what's wrong, before it's seen to: a gunshot or a knife wound reported)
  care(p, ms);                                                     // (the blood put back too, under TRANSFUSE_BELOW)
  me.hidden = false; me.gait = 'idle';
  say(state, bus, { kind: 'note', text: 'The ambulance\'s ceiling, then a corridor\'s, then a ward\'s. Stitches, a drip, a doctor who asks how it happened and doesn\'t believe the answer.' });
  state.$hospital = { ms: (HOSPITAL_H + bedHours(p, ms, HOSPITAL_H)) * HOUR, arrest: described(state, p), from: { row: c.row, x: c.x }, out: 'hospital', charged: true, report: N.reported };   // (an official hospital: its costs as a walk-in's, the user, 2026-11-04)   // (the hours, skipped after the tick: sim/game.js)
}

/**
 * The hours in hospital (sim/game.js, after the tick, as an arrest's are; the ambulance's patient's, or a walk-in's at a
 * hospital's desk: sim/services.js admit()): skipped; at an official hospital, either way, what it costs (its records,
 * VISIT_HEAT in the campaign; a gunshot or a knife wound reported, HOSPITAL_HEAT more and POLICE_HOSPITAL on the police's
 * own file); out on the pavement in front of the hospital nearest where you were (H.from: where you fell, or the desk's
 * door; H.out null, where you are), the log naming it; then, if they've your description, the police.
 */
export function afterHospital(state, bus, me, skip) {
  const H = state.$hospital;
  if (!H) return;
  delete state.$hospital;
  skip(state, bus, H.ms);
  const p = me && state.people[me.who], official = H.official !== false;
  if (p) discharged(p, state.time.ms);                               // (sent out on painkillers, a packet with you: sim/services.js)
  if ((H.walkin || H.charged) && official) {
    if (state.campaign && state.legend) addHeat(state, VISIT_HEAT + (H.report ? HOSPITAL_HEAT : 0));
    if (H.report) policeHeat(state, POLICE_HOSPITAL);                // (the police's own file: the hospital's report, sim/police.js)
  }
  const at = me && H.out !== null ? outside(state, bus, H.out ?? 'hospital', H.from ?? null) : null, h = H.ms / HOUR;
  const out = at ? `: out through the doors of ${at.label.charAt(0).toLowerCase()}${at.label.slice(1)}` : '';
  say(state, bus, { kind: 'note', text: H.walkin ? `${hoursWords(h)}, all told. They let you go with a bag of dressings and a leaflet${out}.` : `They let you go at the end of it, with a bag of dressings and a leaflet${out}.` });
  if ((H.arrest ?? (H.walkin && official && described(state, p))) && me) { say(state, bus, { kind: 'note', text: 'An officer has been waiting in the corridor the whole time. He has your description in his notebook.' }); arrest(state, bus, me, 'submitted', 'the description'); }
}

// The tape: round the place, a day.
function cordon(state, c, now) {
  if ((state.cordons ?? []).some(k => k.row === c.row && Math.hypot(k.x - c.x, k.z - c.z) < CORDON_M)) return;
  (state.cordons ??= []).push({ id: `tape${now}`, row: c.row, x: c.x, z: c.z, r: CORDON_M, until: now + CORDON_H * HOUR });
}

// The officer at the tape: there while it is (back when you come back to the street: onMap()); "Police line" if you come too close.
function posted(state, bus, me, now, row) {
  for (const k of state.cordons ?? []) {
    if (k.row !== row) continue;
    const d = Math.hypot(me.x - k.x, me.z - k.z);
    if (d < k.r + 0.8 && now - (k.warned ?? 0) > LINE_WARN_S * 1000) { k.warned = now; say(state, bus, { kind: 'note', text: '"Police line. Back, please." The officer at the tape doesn\'t take his eyes off you.' }); }
  }
}

/** Into a street (sim/game.js newMap()): the officers posted at its tape, back at their posts. */
export function onMap(state) {
  const row = state.map.row ?? 0, now = state.time.ms, K = policeOf(state.map);
  for (const k of state.cordons ?? []) {
    if (k.row !== row || k.until <= now || state.actors.some(a => a.ai?.posted === k.id)) continue;
    const r = stream('tape-post', state.map.seed, k.id), who = `post${k.id}`;
    state.people[who] ??= sheet({ id: who, name: 'a police officer', sex: chance(r, 0.3) ? 'f' : 'm', cls: 'cop', skills: { awareness: [(K?.awareness ?? 8), 0], cqc: [8, 1], tracking: [6, 0] },
      look: { skin: pick(r, K?.skin ?? ['light']), hair: { style: 'crew', color: 0x23252f }, shoes: 0x14151c, ...structuredClone(K?.look ?? {}) } });
    if (!state.people[who].items?.length && !state.people[who].hand) armCop(state, state.people[who], 'patrol', r);
    const a = makeAgent(state, { who, row, x: k.x + k.r + 0.4, z: k.z, speed: 1.2, face: 'left' });
    Object.assign(a, { cop: true, ems: k.id }); a.ai.posted = k.id; a.ai.route = null;
  }
}

const actorOf = (state, id) => state.actors.find(a => a.id === id);
const carOf = (state, id) => state.traffic?.cars?.find(c => c.id === id);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
