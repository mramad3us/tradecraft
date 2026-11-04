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
// (markViolent(): a shot fired, a killing, a fight, seen), the caller describes you: your look then (seenLook(): what
// you wear, your hat, your hair) goes out to every officer in the city (state.wanted, WANTED_DAYS).
// **What you know of it** (etaOf(): the instinct's timer on the watch, src/ui/ui.js): a caller you can see or hear
// (KNOW_M) tells you it's been called, and your Tradecraft guesses how long they'll be: the guess off by an error drawn
// once a call (ERR_K × what you lack of 100), said as exactly as your feel for it goes (70 and over, to the minute; 40
// and over, about so many; under, "a few minutes", "any moment", "a while").
// **They come.** Each by its car (sim/traffic.js sendEms()), lights going, pulled up at the kerb by the place; its crew
// of two out of it and to the casualties. The ambulance's kneel and work (TREAT_S: what bleeds outside is dressed as
// they start), then carry them to it on the stretcher, and go: the dead too, under a sheet. Taken, someone's in
// hospital (what bleeds inside stopped); you, the hours there (HOSPITAL_H), then out, and if they've your description,
// the police are waiting (sim/armed.js arrest()). The police's tape off the place (state.cordons: CORDON_M round it,
// CORDON_H), one of them posted at it for as long (back at it whenever you come back to that street), the other
// taking statements (STATEMENT_S), and gone. Off the street you're on, a call plays out unseen: the tape's there
// when you come back.
// **Your description.** An officer who sees you (EYE_M) dressed as you were described knows you: the alarm (sim/armed.js
// call(): the order, the cuffs, the armed response if you're armed), and in the campaign your cover standing takes
// DESCRIBED_COVER, once. Change what you wear (and the hat, the hair) and you're someone else.
import { policeHeat, POLICE_WANTED } from './police.js';
import { stream, range, chance, pick, next } from './rng.js';
import { say } from './log.js';
import { seesActor } from './perception.js';
import { isPasserby } from './crowd.js';
import { makeAgent, setRoute, rowOf } from './agents.js';
import { routeFrom, LINE } from './city.js';
import { townOf } from './cities/index.js';
import { sheet } from './people.js';
import { policeOf } from './countries/index.js';
import { canStand } from './health.js';
import { sendEms } from './traffic.js';
import { armCop, call as raiseAlarm, arrest } from './armed.js';
import { addHeat } from './heat.js';
import { shortName } from './fight.js';
import { MIN, HOUR, DAY } from './clock.js';

export const SEE_DOWN_M = 25, CALL_P = 0.1, KNOW_M = 18, ON_PHONE_S = 40, VIOLENT_S = 120, MERGE_M = 30;
export const DRIVE_S = 14, TREAT_S = [60, 150], STATEMENT_S = 120, CORDON_H = 24, CORDON_M = 4.5, HOSPITAL_H = 8;
export const WANTED_DAYS = 4, EYE_M = 14, DESCRIBED_COVER = 35, LINE_WARN_S = 30, ERR_K = 0.7;
const DEFAULT_EMS = { police: [8, 15], ambulance: [10, 20] };

const playerOf = (state) => state.actors.find(a => a.who === state.player);
/** What a witness says of someone: the top they wear and its colour, the hat, the hair. Another of any, someone else. */
export const seenLook = (look = {}) => [look.top?.kind, look.top?.color, look.hat?.kind ?? 'bare', look.hat?.color, look.hair?.style, look.hair?.color].join('|');

/** You at it, and seen (a shot fired, a killing, a fight: sim/shooting.js, sim/interact.js): whoever sees you now will describe you. */
export function markViolent(state, me) {
  if (!me) return;
  const seen = state.actors.some(a => a !== me && a.ai && !a.hidden && isPasserby(a) && Math.hypot(a.x - me.x, a.z - me.z) < SEE_DOWN_M && seesActor(state, a, me));
  if (seen) state.$violent = { ms: state.time.ms, look: seenLook(state.people[me.who]?.look) };
}

/** Once a second, on a street with police (sim/game.js): the calls made, the services on their way and at work, your description. */
export function second(state, bus, me) {
  if (state.map.kind !== 'street' || !me) return;
  const now = state.time.ms, row = state.map.row ?? 0;
  report(state, bus, me, now, row);
  for (const c of state.calls ?? []) if (!c.done) (c.row === row ? play : offstage)(state, bus, me, c, now);
  state.calls = (state.calls ?? []).filter(c => !c.done || now - c.ms < DAY);
  state.cordons = (state.cordons ?? []).filter(k => k.until > now);
  posted(state, bus, me, now, row);
  recognise(state, bus, me, now);
}

// Someone down, seen: a call, or one more casualty on a call already made.
function report(state, bus, me, now, row) {
  for (const a of state.actors) {
    const p = a.who && state.people[a.who];
    if (!p || a.hidden || p.reported || rowOf(state, a) !== row || a.ems) continue;
    const down = p.dead || a.gait === 'down' || !canStand(p);
    if (!down) continue;
    const near = state.actors.filter(w => w !== a && w.ai && !w.hidden && isPasserby(w) && !(w.ai.fled > now - 20000 && Math.hypot(w.x - a.x, w.z - a.z) > 12) && Math.hypot(w.x - a.x, w.z - a.z) < SEE_DOWN_M && seesActor(state, w, a));
    if (!near.length || !chance(state.rng, 1 - (1 - CALL_P) ** near.length)) continue;
    p.reported = now;
    const caller = pick(state.rng, near);
    Object.assign(caller, { gait: 'phone', vx: 0, vz: 0 }); caller.ai.wait = ON_PHONE_S * 20;
    let c = (state.calls ?? []).find(k => !k.done && k.row === row && Math.hypot(k.x - a.x, k.z - a.z) < MERGE_M);
    if (c) { c.who.push(a.id); continue; }
    const E = policeOf(state.map)?.ems ?? DEFAULT_EMS, r = stream('ems', state.map.seed, now);
    const V = state.$violent && now - state.$violent.ms < VIOLENT_S * 1000 ? state.$violent : null;
    c = { id: `call${now}`, row, x: a.x, z: a.z, ms: now, who: [a.id], described: V?.look ?? null, known: false,
      at: { police: now + Math.round(range(r, ...E.police) * MIN), ambulance: now + Math.round(range(r, ...E.ambulance) * MIN) },
      err: { police: gauss(r), ambulance: gauss(r) }, police: { stage: 'coming' }, ambulance: { stage: 'coming' } };
    (state.calls ??= []).push(c);
    if (c.described) {
      state.wanted = { look: c.described, ms: now, until: now + WANTED_DAYS * DAY, city: state.map.city ?? null, hit: false };
      if (state.legend) addHeat(state, 10);
      policeHeat(state, POLICE_WANTED);                         // (your description out to every officer: the police's own file, sim/police.js)
    }
    // (in your sight or your hearing: you know it's been called, and your instinct guesses how long)
    if (Math.hypot(caller.x - me.x, caller.z - me.z) < KNOW_M || seesActor(state, me, caller)) {
      c.known = true;
      const eta = etaOf(state, c);
      say(state, bus, { kind: 'instinct', text: `Someone's on the phone, looking at ${a === me ? 'you' : shortName(state, a.who)}: police, an ambulance.${c.described ? ' And they\'re describing you as they talk.' : ''} ${cap(eta.map(e => `${e.word}: ${e.text}`).join(', '))}.${state.actors.some(o => o.cop && !o.unit && !o.hidden) ? ' A patrol\'s already on the street, though: they won\'t wait for the call.' : ''}` });   // (the call's squad and the patrol here: not the same men)
    }
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
/** The call you know of and are waiting on, its guesses: for the watch (src/ui/ui.js), or null. */
export function waiting(state) {
  const c = (state.calls ?? []).filter(k => k.known && !k.done && k.row === (state.map.row ?? 0)).at(-1);
  if (!c) return null;
  const eta = etaOf(state, c).filter(e => e.text !== 'here');
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

// You, taken in: the hours in a hospital bed, stitched and dressed; out at the end of it, onto the street where it happened. Described, the police are at the bedside.
function hospital(state, bus, me, c) {
  const p = state.people[me.who], ms = state.time.ms;
  for (const i of p.injuries ?? []) { if (i.bleed > ms) i.bleed = ms; i.dressed = true; if (i.deep) i.stitched = true; i.clean = true; }
  p.blood = Math.max(p.blood ?? 100, 80); if (p.blood >= 100) delete p.blood;
  me.hidden = false; me.gait = 'idle';
  say(state, bus, { kind: 'note', text: 'The ambulance\'s ceiling, then a corridor\'s, then a ward\'s. Stitches, a drip, a doctor who asks how it happened and doesn\'t believe the answer.' });
  state.$hospital = { ms: HOSPITAL_H * HOUR, arrest: !!(state.wanted && state.wanted.until > ms && seenLook(p.look) === state.wanted.look) };   // (the hours, skipped after the tick: sim/game.js)
}

/** The hours in hospital (sim/game.js, after the tick, as an arrest's are): skipped; then, if they've your description, the police. */
export function afterHospital(state, bus, me, skip) {
  const H = state.$hospital;
  if (!H) return;
  delete state.$hospital;
  skip(state, bus, H.ms);
  say(state, bus, { kind: 'note', text: 'They let you go at the end of it, with a bag of dressings and a leaflet.' });
  if (H.arrest && me) { say(state, bus, { kind: 'note', text: 'An officer has been waiting in the corridor the whole time. He has your description in his notebook.' }); arrest(state, bus, me); }
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

// Your description: an officer who sees you dressed as you were described, and knows you.
function recognise(state, bus, me, now) {
  const W = state.wanted;
  if (!W || W.until <= now || (W.city && W.city !== (state.map.city ?? null)) || state.$alarm) return;
  const p = state.people[me.who];
  if (seenLook(p?.look) !== W.look) return;
  const cop = state.actors.find(a => a.cop && !a.hidden && Math.hypot(a.x - me.x, a.z - me.z) < EYE_M && seesActor(state, a, me));
  if (!cop) return;
  cop.alert = now;
  raiseAlarm(state, bus, me.x, 'the description');
  say(state, bus, { kind: 'note', text: `${cap(shortName(state, cop.who))} looks at you, at the notebook, at you again: they have your description.` });
  if (state.campaign?.posting && !W.hit) {
    W.hit = true;
    state.campaign.posting.cover = Math.max(0, state.campaign.posting.cover - DESCRIBED_COVER);
    state.campaign.log?.push({ ms: now, text: `The police had a description from the shooting, and it was you: the embassy's view of you, −${DESCRIBED_COVER}.` });
  }
}

const actorOf = (state, id) => state.actors.find(a => a.id === id);
const carOf = (state, id) => state.traffic?.cars?.find(c => c.id === id);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
