// TRADECRAFT sim: armed police, and their guns used in real time (the user, 2026-11-03: "There should be armed
// police where this exists also in real life, with openly armed (rifles etc) or handguns in holsters where it
// makes sense … NPCs shooting at us should just move time forward normally as they do the things to ready
// their weapons … weapons handling is important when … tracked by police and being targeted for shooting").
// The guns are sim/firearms.js; the player's own shooting, in stop motion, sim/shooting.js.
//
// **Who's armed**: a patrol carries its country's sidearm holstered (sim/countries/ police.arms.patrol; none
// in London: its patrols are unarmed), at COP_WEAPONS.patrol; its armed response (police.arms.response) comes
// with long guns, in the hand, ready, at COP_WEAPONS.response. Body armour with them (sim/armour.js issue()): the
// response in plate carriers over the uniform; a patrol officer in a soft vest under the shirt, their country's
// share of the time (police.armour.patrol). Where the response is the army (Beirut's), it's soldiers.
// **A gun seen** (second()): you with a gun in your hand, in an officer's sight, or a shot of yours heard
// (HEARD_M, SHOT_FRESH_S), and the alarm's up (state.$alarm): they shout (ORDER), and the papers can wait.
//   - Drop it, or put it away, and keep your hands where they can be seen (COMPLY_S with nothing in them): the
//     nearest of them able to (able(): alive, on their feet; the user, 2026-11-04: a dead officer arrested him)
//     comes in to cuff you (state.$takedown), jogging after you if you walk off, the others covering, and the
//     shout's no longer to drop it but to stand still (police.halt). Within GRAB_M of you, the moment is yours (a
//     reflex: down on your knees; shove him off and run, your CQC against his + SHOVE_DC; fight him; your gun);
//     down already, or nothing chosen, he takes you down: you face down on the pavement, him kneeling on your back,
//     PIN_S of it (the user, 2026-11-04: "without an animation of the cop nailing me to the ground"). Then you're
//     taken in (arrest()): what they had you for (TIERS: a description, a gun seen, shots fired, someone hit by
//     your rounds, someone dead), its hours at the station (the clock skipped), heat, the police's file, the
//     ambassador's view of you; the paper that says it all (ARRESTED); and you're let out on the station's steps.
//     Resisting (a shove, a fight, a run, a gun) is on the file too (RESIST_POLICE). Afterwards the street's alarm
//     is over: their description of you closed, nobody still shouting (the user's, the same day).
//   - Keep it in your hand past COMPLY_S, or fire, and an armed officer engages (a gunner, below); an unarmed
//     one backs off and calls it in.
//   - Passers-by who see it run (sim/shooting.js flee()); now and then one calls the police (CALL_P a second).
// **The armed response** (respond()): called (by an officer, or a passer-by, or the shots), it comes in its
// country's minutes (police.response.minutes), RESPONDERS of them at the stretch's edge, toward where you were;
// on you with a gun, the same: an order, then they shoot. Out of their sight LOST_S, they stand down and go.
// **A gunner** (an NPC readying and firing, tick()): the same steps as the player's (firearms.js act(): its time
// by their Weapon handling, its roll), one after another in real time: the draw, the safety or the selector, a
// round chambered, a stoppage cleared, the aim (sim/shooting.js aimMs()), the shot (sim/shooting.js npcShot(),
// the same odds as yours), the recovery. They stand while they do it (sim/agents.js: ai.gunner).
import { whereFrom, heardFrom } from './sense.js';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
import { policeHeat, POLICE_ARREST } from './police.js';
import { isGun, armOf, modelOf, newGun, act as gunAct, ready, canDo, MODELS, KINDS } from './firearms.js';
import { policeOf } from './countries/index.js';
import { aimMs, npcShot, flee } from './shooting.js';
import { seesActor, inView } from './perception.js';
import { offer, isArmed, RUN_S } from './reflex.js';
import { check, opposed } from './checks.js';
import { skill } from './skills.js';
import { isPasserby } from './crowd.js';
import { makeAgent, setRoute } from './agents.js';
import { routeFrom, LINE } from './city.js';
import { townOf } from './cities/index.js';
import { sheet } from './people.js';
import { addHeat } from './heat.js';
import { canStand, staysDown } from './health.js';
import { stream, chance, pick, range } from './rng.js';
import { issue } from './armour.js';
import { say } from './log.js';
import { HOUR } from './clock.js';
import { outside, nearestDoor } from './services.js';
const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export const COP_WEAPONS = { patrol: [8, 1], response: [15, 2] };
export const HEARD_M = 60, SHOT_FRESH_S = 30, SEE_GUN_M = 30;
export const COMPLY_S = 3, ORDER_EVERY_S = 6, LOST_S = 60;
export const CALL_P = 0.12, RESPONDERS = 3;
export const GUN_SEEN_DC = 8, HELD_H = 3, ARREST_HEAT = 25, ARREST_COVER = 30;
// (the takedown: how close he has to be, how long he holds you down, a shove's odds against him, a second shove's, a shove's stagger)
export const GRAB_M = 1.3, PIN_S = 6, PIN_BODY_M = 0.9, PIN_AT_M = 0.35, SHOVE_DC = 4, SHOVE_AGAIN_DC = 6, SHOVED_S = 2.5, CLOSE_PACE = 1.8, RESIST_POLICE = 20;
// (what they had you for: the hours held, heat, the ambassador's view of you lost; the worst of what's true)
export const TIERS = {
  described: { h: 2, heat: 15, cover: 20 },
  gun: { h: HELD_H, heat: ARREST_HEAT, cover: ARREST_COVER },
  shots: { h: 5, heat: 35, cover: 40 },
  wounded: { h: 8, heat: 50, cover: 55 },
  killed: { h: 14, heat: 80, cover: 80 },
};
export const HIT_RECENT_H = 2;                                       // (who your rounds hit counts against you this long: p.hitBy, sim/shooting.js)

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const cops = (state) => state.actors.filter(a => a.cop);
/** Whether officer c can act: alive, on their feet, not knocked flat, out on the street. */
export function able(state, c) {
  const q = state.people[c.who];
  return !!q && !q.dead && canStand(q) && !staysDown(q) && c.gait !== 'down' && !((c.ai?.downUntil ?? 0) > state.time.ms) && !c.hidden;
}

/** An officer's gun, by their role and their country (patrol: holstered, or none; response: a long gun, in the hand, ready). Returns its id or null. */
export function armCop(state, p, role = 'patrol', r = state.rng) {
  const K = policeOf(state.map), list = K.arms?.[role] ?? [];
  p.skills.weapons = [...COP_WEAPONS[role]];
  issue(p, role, K, `${state.seed ?? ''}|${p.id ?? ''}`);          // (body armour: the response's carrier, a patrol's vest, by its country: sim/armour.js, on dice of its own)
  if (!list.length) return null;
  // (the response: a long gun in the hand, on semi and ready, and a pistol at the belt if they have one; a patrol, its pistol holstered)
  const long = list.filter(m => MODELS[m] && KINDS[MODELS[m].kind]?.hands > 1), side = list.filter(m => MODELS[m] && !(KINDS[MODELS[m].kind]?.hands > 1));
  const id = newGun(p, pick(r, role === 'response' && long.length ? long : list), { safety: role === 'patrol' });
  if (role === 'response') {
    p.hand = id; const g = armOf(p, id), M = modelOf(id);
    if (g.mode) g.mode = M.modes.includes('semi') ? 'semi' : M.modes[0]; g.safety = false;
    if (side.length && long.length) (p.items ??= []).push(newGun(p, pick(r, side)));
  } else (p.items ??= []).push(id);
  return id;
}

/** The alarm's raised (a gun seen, a shot heard, a call): the armed response is on its way, if it isn't. */
export function call(state, bus, x, why = 'a call') {
  const now = state.time.ms, K = policeOf(state.map);
  state.$alarm ??= { ms: now, x, ordered: 0, why };
  if (state.$response || !K.arms?.response?.length) return;
  const [lo, hi] = K.response?.minutes ?? [5, 12], r = stream('response', state.map.seed, Math.floor(now / 60000));
  state.$response = { at: now + Math.round(range(r, lo, hi) * 60000), x, row: state.map.row ?? 0, why };
}

/** Once a second (sim/game.js): who's seen the gun, the order, compliance, the call, the response. */
export function second(state, bus, me) {
  if (!me || state.map.kind !== 'street') return;
  const p = state.people[me.who], now = state.time.ms, armed = isGun(p?.hand), A = state.$alarm;
  const shot = state.$shotBy && now - state.$shotBy.ms < SHOT_FRESH_S * 1000 ? state.$shotBy : null;
  // (passers-by who see it, run; one in a while calls it in)
  if (armed) for (const a of state.actors) if (isPasserby(a) && !a.hidden && !a.ai?.fled && Math.hypot(a.x - me.x, a.z - me.z) < SEE_GUN_M && seesActor(state, a, me)) {
    flee(state, a, me.x);
    if (chance(state.rng, CALL_P)) call(state, bus, me.x, 'a passer-by');
  }
  if (shot) call(state, bus, shot.x, 'the shots');
  // (an officer who sees you armed, or heard you fire: the alarm, the order)
  for (const c of cops(state)) {
    const sees = seesActor(state, c, me), heard = shot && Math.hypot(c.x - shot.x, c.z - shot.z) < HEARD_M;
    if (sees) c.$seen = now;
    if (!c.alert && ((sees && armed && Math.hypot(c.x - me.x, c.z - me.z) < SEE_GUN_M) || heard)) { c.alert = now; call(state, bus, me.x, 'an officer'); }
  }
  const on = cops(state).filter(c => c.alert && able(state, c)), A2 = state.$alarm, T = state.$takedown;
  if (on.length && A2) {
    const shouter = on.find(c => seesActor(state, c, me));
    if (now - (A2.ordered ?? 0) >= ORDER_EVERY_S * 1000 && shouter && T?.stage !== 'pin') {
      // (said by one of them who has you in sight: where from, if you can't see them; and heard, the fog lifted round them: sim/sense.js heardFrom())
      // (a gun in your hand: drop it; your hands empty: stand still, show them)
      A2.ordered = now; if (armed) A2.since ??= now;
      const K = policeOf(state.map), order = armed ? K.order ?? '"Police! Drop it!"' : K.halt ?? '"Police! Stand still! Hands where we can see them!"', unseen = !inView(state, shouter.id);
      say(state, bus, { kind: 'note', text: unseen ? `${cap(whereFrom(me, shouter))}, ${Math.round(Math.hypot(shouter.x - me.x, shouter.z - me.z))} m off, a shout: ${order}` : order });
      heardFrom(state, shouter, 'Police');
    }
    // (hands empty: the nearest of them able comes in to cuff you, the others covering; after you, if you go: the takedown, tick())
    if (!armed) {
      A2.empty = A2.empty ?? now;
      if (now - A2.empty >= COMPLY_S * 1000 && !T) {
        const up = on.filter(c => c.ai).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
        if (up) state.$takedown = { cop: up.id, since: now, stage: 'closing', why: A2.why ?? null, ...(A2.resisted ? { how: A2.resisted } : {}) };   // (resisted before: still on the file)
      }
      const c = T?.stage === 'closing' && state.actors.find(a => a.id === T.cop);
      if (c?.ai) {                                                   // (each second, to where you are now)
        c.ai.closing = now; if (c.ai.gunner) c.ai.gunner = null; c.ai.wait = 0; c.ai.pace = CLOSE_PACE;
        try { setRoute(state, c, routeFrom(townOf(state.map), { row: state.map.row ?? 0, x: c.x, z: c.z }, { row: state.map.row ?? 0, x: me.x + Math.sign(c.x - me.x || 1) * 0.9, z: me.z })); } catch { c.ai.route = null; }
      }
    }
    else { delete A2.empty; if (T?.stage === 'closing') state.$takedown = null; }   // (a gun back in your hand: it's the order again)
    // (still armed past the order, or firing: they engage; the unarmed back off)
    const defiant = armed && A2.since && now - A2.since >= COMPLY_S * 1000;
    for (const c of on) {
      const q = state.people[c.who], gun = isGun(q?.hand) ? q.hand : (q?.items ?? []).find(isGun);
      if (gun && (defiant || shot)) c.ai.gunner ??= { gun, until: now, aimed: null };
      else if (!gun && armed) c.ai.wait = Math.max(c.ai.wait ?? 0, 200);   // (unarmed: they hold back, and radio it in)
      if (!defiant && !shot && c.ai.gunner) c.ai.gunner.hold = true; else if (c.ai.gunner) c.ai.gunner.hold = false;
    }
  }
  // (the armed response, come; and gone again, when they've lost you)
  const R = state.$response;
  if (R && !R.came && now >= R.at && (state.map.row ?? 0) === R.row) respond(state, bus, me, R);
  if (R?.came && cops(state).filter(c => c.unit).every(c => now - (c.$seen ?? R.came) > LOST_S * 1000)) standDown(state, bus);
}

/** The armed response, at the stretch's edge toward where you were: RESPONDERS officers, long guns ready, alarmed. */
function respond(state, bus, me, R) {
  const K = policeOf(state.map), r = stream('responders', state.map.seed, R.at), dir = chance(r, 0.5) ? 1 : -1, town = townOf(state.map), row = state.map.row ?? 0;
  R.came = state.time.ms;
  for (let k = 0; k < RESPONDERS; k++) {
    const who = `unit${R.at % 100000}${k}`;
    const army = !!K.response?.soldiers;                             // (Beirut's response is the army: soldiers, in its olive)
    state.people[who] = sheet({ id: who, name: army ? 'a soldier' : 'an armed officer', sex: chance(r, 0.2) ? 'f' : 'm', cls: army ? 'soldier' : 'cop', skills: { awareness: [(K.awareness ?? 8) + 2, 0], cqc: [10, 1], tracking: [8, 0] },
      look: { skin: pick(r, K.skin ?? ['light']), hair: { style: 'crew', color: pick(r, [0x23252f, 0x47302a]) }, shoes: 0x14151c, ...structuredClone(K.response?.look ?? K.look) } });
    armCop(state, state.people[who], 'response', r);
    const a = makeAgent(state, { who, row, x: me.x + dir * (40 + k * 1.5), z: LINE.F + k * 0.6, speed: 2.2, face: dir > 0 ? 'left' : 'right' });
    Object.assign(a, { cop: true, unit: true, alert: state.time.ms });
    try { setRoute(state, a, routeFrom(town, { row, x: a.x, z: a.z }, { row, x: R.x, z: a.z })); } catch { a.ai.route = null; }
  }
  say(state, bus, { kind: 'note', text: `Sirens, and boots: ${K.response?.unit ?? 'the armed police'}, long guns up, coming down the street.` });
}

/** They've lost you: the unit stands down and goes; the alarm's over. */
function standDown(state, bus) {
  for (const c of cops(state).filter(c => c.unit)) { c.ai.gunner = null; c.alert = null; }
  state.actors = state.actors.filter(a => !a.unit);
  delete state.$alarm; delete state.$response;
  say(state, bus, { kind: 'note', text: 'The sirens go off, a street over, and then not at all.' });
}

/**
 * Taken in: the gun taken (yours in hand, on you, at your feet), what they had you for (TIERS: the worst that's true),
 * its hours at the station (state.$held: sim/game.js skips them, then released()), heat, the police's file, the
 * ambassador's view of you; the paper (ARRESTED) that says it all. The street's alarm over with it: their
 * description of you closed (they've had you, and let you go on the passport), nobody left shouting.
 */
export function arrest(state, bus, me, how = 'submitted', because = null) {
  const p = state.people[me.who], taken = [], now = state.time.ms;
  for (const k of [p.hand, ...(p.items ?? [])]) if (isGun(k)) taken.push(k);
  const names = taken.map(k => modelOf(k)?.short ?? 'the gun');
  p.hand = isGun(p.hand) ? null : p.hand; p.items = (p.items ?? []).filter(k => !isGun(k));
  for (const k of taken) delete p.arms?.[k];
  const near = (state.items?.dropped ?? []).filter(it => isGun(it.kind) && Math.hypot(it.x - me.x, it.z - me.z) < 4);
  state.items && (state.items.dropped = state.items.dropped.filter(it => !near.includes(it)));
  for (const it of near) names.push(modelOf(it.kind)?.short ?? 'the gun at your feet');
  // (what they had you for: who your rounds hit, lately, here; the shots; the gun; a description)
  const hit = state.actors.map(a => state.people[a.who]).filter(q => q && q !== p && q.hitBy?.id === state.player && now - q.hitBy.ms < HIT_RECENT_H * HOUR);
  const dead = hit.filter(q => q.dead), copsDead = dead.filter(q => q.cls === 'cop' || q.cls === 'soldier'), copsHit = hit.filter(q => q.cls === 'cop' || q.cls === 'soldier');
  const why = because ?? state.$takedown?.why ?? state.$alarm?.why ?? null;
  const tier = dead.length ? 'killed' : hit.length ? 'wounded' : state.$shotBy && now - state.$shotBy.ms < HIT_RECENT_H * HOUR ? 'shots' : why === 'the description' && !taken.length && !near.length ? 'described' : 'gun';
  const T = TIERS[tier], resisted = how !== 'submitted', st = nearestDoor(state, 'police'), station = st ? low(st.label) : 'the station';   // (the nearest's: where you're let out, released())
  addHeat(state, T.heat); policeHeat(state, POLICE_ARREST + (resisted ? RESIST_POLICE : 0));   // (the police's own file on you: sim/police.js)
  const P = state.campaign?.posting, cover0 = P?.cover;
  if (P) P.cover = Math.max(0, (P.cover ?? 70) - T.cover);
  // (the street's alarm over: nobody left shouting, their description of you closed; the unit gone)
  for (const c of cops(state)) { c.alert = null; if (c.ai) { c.ai.gunner = null; c.ai.closing = null; c.ai.pace = undefined; } }
  state.actors = state.actors.filter(a => !a.unit);
  delete state.$alarm; delete state.$response; delete state.$shotBy; delete state.wanted; state.$takedown = null;
  me.gait = 'idle';
  const n = (k, one, many) => `${k === 1 ? one : `${k} ${many}`}`;
  const what = {
    described: 'A patrol with your description from the shooting, and you in front of them in the same clothes.',
    gun: 'A gun in your hand on a public street, and police who saw it.',
    shots: 'Shots fired in the street, and you with the gun that fired them.',
    wounded: `${cap(n(hit.length, 'someone', 'people'))} hit by your rounds${copsHit.length ? `, ${copsHit.length === hit.length ? (copsHit.length === 1 ? 'a police officer' : 'all of them police') : `${n(copsHit.length, 'one of them', 'of them')} police`}` : ''}.`,
    killed: `${cap(n(dead.length, 'someone', 'people'))} dead by your rounds${copsDead.length ? `, ${copsDead.length === dead.length ? (copsDead.length === 1 ? 'a police officer' : 'all of them police') : `${n(copsDead.length, 'one of them', 'of them')} police`}` : ''}.`,
  }[tier];
  const lines = [
    `What they had you for: ${what.charAt(0).toLowerCase()}${what.slice(1)}`,
    how === 'submitted' ? 'You went down when he came for you, and kept your hands where they could see them.' : how === 'shove' ? 'You tried to shove him off. Resisting arrest is on the file too.' : 'You fought them. Resisting arrest is on the file too.',
    names.length ? `Taken, into evidence bags: ${names.join(', ')}.` : 'They took nothing: there was nothing on you to take.',
    `${T.h} hours at ${station}: a bench, a long wait; the diplomatic passport, and the calls it takes. A man from the embassy signs for you, and doesn't say a word in the car.`,
    `Heat +${T.heat}; the police's file on you +${POLICE_ARREST + (resisted ? RESIST_POLICE : 0)}${P ? `; the ambassador's view of you ${cover0} → ${P.cover}` : ''}.`,
    ...(copsDead.length ? ['A police officer dead: the Foreign Ministry will have the ambassador in by the morning.'] : tier === 'killed' ? ['A death on a diplomat\'s hands: the Foreign Ministry will hear of it, and the ambassador from them.'] : []),
  ];
  say(state, bus, { kind: 'note', text: `The cuffs, and the car. ${names.length ? 'The gun goes into an evidence bag. ' : ''}${cap(station)}, ${T.h} hours of it; the diplomatic passport, and the calls it takes. The embassy's man signs for you, and doesn't say a word in the car.` });
  state.campaign?.log?.push({ ms: now, text: `Arrested: ${what.charAt(0).toLowerCase()}${what.slice(1)} ${T.h} hours at the station; the ambassador's view of you −${T.cover}.` });
  bus?.emit('papers', [{ kind: 'arrest', title: 'ARRESTED', lines }]);
  state.$held = T.h * HOUR;                                         // (the hours at the station: sim/game.js skips them, then released())
  state.$released = true;
  return true;
}

/** Out of the station, its hours over (sim/game.js, after they're skipped): on its steps, the nearest station's (sim/services.js). */
export function released(state, bus, me) {
  if (!state.$released) return;
  delete state.$released;
  const at = outside(state, bus, 'police');
  say(state, bus, { kind: 'note', text: at ? `Out onto the steps of ${low(at.label)}, the embassy's car already gone.` : 'Out onto the street again, the embassy\'s car already gone.' });
}

/**
 * The takedown, once a tick: the officer coming in (second() routes him), at your side the moment's yours (a reflex),
 * then the pin: you face down, him kneeling on you, PIN_S; then arrest(). He's down or gone: it's off (the next of
 * them comes, the next second). Returns nothing.
 */
function takedown(state, bus, me) {
  const T = state.$takedown;
  if (!T || !me) return;
  const c = state.actors.find(a => a.id === T.cop), now = state.time.ms, mine = state.people[me.who];
  const q = c && state.people[c.who];
  if (!c || !q || q.dead || staysDown(q) || c.hidden || (c.row ?? state.map.row ?? 0) !== (me.row ?? state.map.row ?? 0)) { state.$takedown = null; return; }   // (down for good, or gone: the next of them comes)
  if (!able(state, c)) return;                                      // (staggered by a shove, knocked flat a moment: he gets up and comes on)
  if (T.stage === 'closing') {
    if (state.$reflex || state.fight || Math.hypot(c.x - me.x, c.z - me.z) > GRAB_M) return;
    if (isGun(mine?.hand)) { state.$takedown = null; return; }
    const down = me.gait === 'down' || !canStand(mine);
    if (!down && state.$reflexes && !T.offered) {
      T.offered = true;
      const his = state.people[c.who], name = cap(his?.name ?? 'an officer'), he = his?.sex === 'f' ? 'her' : 'him';
      if (offer(state, bus, { why: 'arrest', title: `${name}, at your side with the cuffs out`, who: c.id, x: c.x, none: `Nothing: let ${he}`,
        fight: { style: 'even', owner: 'street', line: `You turn on ${he} before the cuffs are on.` }, options: [
          { key: 'submit', label: 'Down on your knees, hands out', do: 'submit' },
          { key: 'shove', label: `Shove ${he} off, and run`, do: 'shove' },
          { key: 'edge', label: `Fight ${he}`, do: 'edge' },
          ...(isArmed(mine) ? [{ key: 'draw', label: 'Your gun', do: 'draw' }] : []),
        ] })) return;
    }
    return pin(state, bus, me, c, T.how ?? 'submitted');
  }
  if (T.stage === 'pin') {                                          // (held there: you face down, him on one knee on your back)
    me.vx = me.vz = 0; me.gait = 'down'; me.face = T.face;
    c.vx = c.vz = 0; c.gait = 'kneel'; c.x = T.x; c.z = T.z; c.face = T.cface; if (c.ai) { c.ai.route = null; c.ai.wait = 20; }
    if (now >= T.until) arrest(state, bus, me, T.how ?? 'submitted');
  }
}
// (taken down: face to the pavement, the knee, the cuffs; PIN_S of it)
function pin(state, bus, me, c, how) {
  // (you fall away from him, face down, your middle PIN_BODY_M on from your feet as a body lying is drawn (src/render/crowd.js
  // DOWN); he kneels at your back, a little behind you up the picture, facing you, so you're seen under his hands)
  const T = state.$takedown, side = Math.sign(c.x - me.x) || 1, mid = me.x - side * PIN_BODY_M;
  Object.assign(T, { stage: 'pin', how, until: state.time.ms + PIN_S * 1000, x: mid + side * PIN_AT_M, z: me.z - 0.3, face: side > 0 ? 'left' : 'right', cface: side > 0 ? 'left' : 'right' });
  if (c.ai) c.ai.pace = undefined;
  const his = state.people[c.who], he = his?.sex === 'f' ? 'she' : 'he';
  say(state, bus, { kind: 'note', text: how === 'submitted' ? `Down on your knees, and ${he} has you face down on the pavement before you're all the way there: a knee in your back, your arms behind you, the cuffs.`
    : `${cap(he)} takes you down hard: your arm up your back, your face on the pavement, a knee between your shoulders, the cuffs.` });
}

/** Your answer to the takedown's moment (sim/game.js react(), before the usual): true if it's dealt with here. */
export function arrestChoice(state, bus, me, o, R) {
  const T = state.$takedown, c = R?.who && state.actors.find(a => a.id === R.who);
  if (!T || !c) return false;
  const now = state.time.ms;
  if (o.do === 'submit' || o.do === 'none') { pin(state, bus, me, c, T.how ?? 'submitted'); return true; }   // (resisted before, it's still on the file)
  if (o.do === 'shove') {
    const mine = state.people[me.who], his = state.people[c.who], he = his?.sex === 'f' ? 'her' : 'him';
    const r = opposed(state.rng, { skill: 'cqc', value: skill(mine, 'cqc'), body: mine }, { skill: 'cqc', value: skill(his, 'cqc') + (T.shoved ? SHOVE_AGAIN_DC : SHOVE_DC), body: his });
    if (r.ok) {
      T.shoved = true; T.offered = false; T.how = 'shove'; if (state.$alarm) state.$alarm.resisted = 'shove';
      c.gait = 'stagger'; c.vx = c.vz = 0; if (c.ai) c.ai.downUntil = now + SHOVED_S * 1000;
      me.$flee = { until: now + RUN_S * 1000, dir: Math.sign(me.x - c.x) || 1, run: true };
      policeHeat(state, RESIST_POLICE);
      say(state, bus, { kind: 'roll', roll: r, text: `Both hands into ${he}, hard, and ${his?.sex === 'f' ? 'she' : 'he'} goes back a step, off balance: you're away.` });
    } else {
      say(state, bus, { kind: 'roll', roll: r, text: `You get your hands on ${he}, and ${his?.sex === 'f' ? 'she\'s' : 'he\'s'} ready for it.` });
      pin(state, bus, me, c, 'shove');
    }
    return true;
  }
  // (a fight, a run, a gun: resisting; the usual reaction does the rest, and he comes again after it)
  T.how = o.do === 'edge' ? 'fought' : 'shove'; T.offered = false;
  if (state.$alarm) state.$alarm.resisted = T.how;
  policeHeat(state, RESIST_POLICE);
  return false;
}

/** Once a tick (sim/game.js): each gunner's next step, as its last one's time runs out. */
export function tick(state, bus) {
  const me = playerOf(state);
  takedown(state, bus, me);
  for (const a of state.actors) { if (a.ai?.gunner) gunner(state, bus, a, me); if (!a.ai?.gunner && a.$aim && a !== me) delete a.$aim; }
}

function gunner(state, bus, a, me) {
  const G = a.ai.gunner, p = state.people[a.who], now = state.time.ms;
  if (!p || p.dead || !canStand(p) || !me) { a.ai.gunner = null; delete a.$aim; return; }
  a.vx = a.vz = 0;
  // (down themselves, shot or knocked flat: nothing from them till they're up; the user's save, 2026-11-03: two
  // officers shot down went on firing from the ground)
  if (a.gait === 'down' || (a.ai.downUntil ?? 0) > now || staysDown(p)) { G.aimed = null; delete a.$aim; return; }
  // (you down, or your hands empty: they keep you covered and shout, and don't fire)
  const mine = state.people[me.who];
  if (!mine || mine.dead || !canStand(mine) || me.gait === 'down' || !isGun(mine.hand)) G.hold = true;
  const to = Math.atan2(me.z - a.z, me.x - a.x);
  if (now < G.until) return;
  const id = G.gun, g = armOf(p, id), M = modelOf(id);
  if (!g) { a.ai.gunner = null; return; }
  // (the moment it starts, seen: your Awareness against the distance, and the reflex, sim/reflex.js)
  if (G.read === undefined) {
    G.read = false;
    const d = Math.hypot(me.x - a.x, me.z - a.z), mine = state.people[me.who];
    if (state.$reflexes && inView(state, a.id) && check(state.rng, { skill: 'awareness', value: skill(mine, 'awareness'), body: mine, dc: GUN_SEEN_DC + Math.round(d / 5) }).ok) {
      G.read = true;
      const held = isGun(mine.hand), who = p.name ?? 'the officer';
      if (offer(state, bus, { why: 'gun', title: `${who.charAt(0).toUpperCase() + who.slice(1)}, ${p.hand === id ? 'bringing his gun up' : 'going for his gun'}`, x: a.x, who: a.id, options: [
        ...(held ? [{ key: 'drop', label: 'Drop it, show your hands', do: 'drop' }] : []),
        ...(isArmed(mine) ? [{ key: 'draw', label: held ? 'Aim at him' : 'Your gun', do: 'draw' }] : []),
        { key: 'run', label: 'Run for it', do: 'run' },
      ] })) return;
    }
  }
  const step = (action, opts = {}) => { const r = gunAct(state.rng, p, id, action, opts); G.until = now + r.ms; if (r.mishap === 'dropped') { p.hand = null; a.ai.gunner = null; } };
  if (p.hand !== id) { p.items = (p.items ?? []).filter(k => k !== id); p.hand = id; return step('draw', { from: 'belt' }); }
  if (M.safety === 'manual' && g.safety) return step('safety');
  if (M.safety === 'selector' && g.mode === 'safe') return step('selector');
  if (!ready(g, M)) { const fix = canDo(p, id).find(k => ['clear', 'rack', 'release', 'insertMag', 'closeCyl'].includes(k)); if (fix) return step(fix); a.ai.gunner = null; return; }
  if (!seesActor(state, a, me)) { a.head = to; G.aimed = null; G.until = now + 250; delete a.$aim; return; }
  if (G.hold) { a.head = to; a.$aim = { x: me.x, z: me.z, ms: now }; G.aimed = null; G.until = now + 250; return; }   // (covering you: aimed, the finger off the trigger)
  a.$aim = { x: me.x, z: me.z, ms: G.aimed ?? now };                // (where the gun points, for the figure's pose: src/art)
  if (G.aimed === null || G.aimed === undefined) { G.aimed = now + aimMs(p, a, me.x, me.z, id); a.head = to; a.face = Math.abs(Math.cos(to)) > Math.abs(Math.sin(to)) ? (Math.cos(to) > 0 ? 'right' : 'left') : (Math.sin(to) > 0 ? 'down' : 'up'); G.until = G.aimed; return; }
  a.head = to;
  G.until = now + npcShot(state, bus, a, p, id, me, (now - G.aimed) / 1000);
}
