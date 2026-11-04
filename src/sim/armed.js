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
//   - Drop it, or put it away, and keep your hands where they can be seen (COMPLY_S with nothing in them, an
//     officer within ARREST_M): you're taken in (arrest()): the gun taken, the station, the embassy fetching
//     you hours later (HELD_H, the clock skipped), heat (ARREST_HEAT) and, in the campaign, the ambassador's
//     view of you (ARREST_COVER).
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
import { offer, isArmed } from './reflex.js';
import { check } from './checks.js';
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

export const COP_WEAPONS = { patrol: [8, 1], response: [15, 2] };
export const HEARD_M = 60, SHOT_FRESH_S = 30, SEE_GUN_M = 30;
export const COMPLY_S = 3, ARREST_M = 6, ORDER_EVERY_S = 6, LOST_S = 60;
export const CALL_P = 0.12, RESPONDERS = 3;
export const GUN_SEEN_DC = 8, HELD_H = 3, ARREST_HEAT = 25, ARREST_COVER = 30;

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const cops = (state) => state.actors.filter(a => a.cop);

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
  state.$alarm ??= { ms: now, x, ordered: 0 };
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
  const on = cops(state).filter(c => c.alert), A2 = state.$alarm;
  if (on.length && A2) {
    const shouter = on.find(c => seesActor(state, c, me));
    if (now - (A2.ordered ?? 0) >= ORDER_EVERY_S * 1000 && shouter) {
      // (said by one of them who has you in sight: where from, if you can't see them; and heard, the fog lifted round them: sim/sense.js heardFrom())
      A2.ordered = now; A2.since ??= now;
      const order = policeOf(state.map).order ?? '"Police! Drop it!"', unseen = !inView(state, shouter.id);
      say(state, bus, { kind: 'note', text: unseen ? `${cap(whereFrom(me, shouter))}, ${Math.round(Math.hypot(shouter.x - me.x, shouter.z - me.z))} m off, a shout: ${order}` : order });
      heardFrom(state, shouter, 'Police');
    }
    // (hands empty, and one of them close: taken in)
    if (!armed) {
      A2.empty = A2.empty ?? now;
      if (now - A2.empty >= COMPLY_S * 1000 && on.some(c => Math.hypot(c.x - me.x, c.z - me.z) < ARREST_M)) return arrest(state, bus, me);
      // (none close enough: the nearest of them standing comes in to cuff you, the others covering)
      if (now - A2.empty >= COMPLY_S * 1000) {
        const up = on.filter(c => c.gait !== 'down' && !((c.ai?.downUntil ?? 0) > now)).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
        if (up?.ai && !up.ai.closing) {
          up.ai.closing = now; if (up.ai.gunner) up.ai.gunner = null;
          try { setRoute(state, up, routeFrom(townOf(state.map), { row: state.map.row ?? 0, x: up.x, z: up.z }, { row: state.map.row ?? 0, x: me.x + Math.sign(up.x - me.x || 1) * 1.2, z: me.z })); } catch { up.ai.route = null; }
        }
      }
    }
    else delete A2.empty;
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
 * Taken in, hands empty: the gun taken (yours in hand, on you, at your feet), the station, the embassy's man
 * fetching you HELD_H later (the clock skipped), heat, and in the campaign the ambassador's view of you.
 */
export function arrest(state, bus, me) {
  const p = state.people[me.who], taken = [];
  for (const k of [p.hand, ...(p.items ?? [])]) if (isGun(k)) taken.push(k);
  p.hand = isGun(p.hand) ? null : p.hand; p.items = (p.items ?? []).filter(k => !isGun(k));
  for (const k of taken) delete p.arms?.[k];
  const near = (state.items?.dropped ?? []).filter(it => isGun(it.kind) && Math.hypot(it.x - me.x, it.z - me.z) < 4);
  state.items && (state.items.dropped = state.items.dropped.filter(it => !near.includes(it)));
  addHeat(state, ARREST_HEAT); policeHeat(state, POLICE_ARREST);   // (the police's own file on you: sim/police.js)
  const P = state.campaign?.posting;
  if (P) P.cover = Math.max(0, (P.cover ?? 70) - ARREST_COVER);
  for (const c of cops(state)) { c.alert = null; if (c.ai) c.ai.gunner = null; }
  state.actors = state.actors.filter(a => !a.unit);
  delete state.$alarm; delete state.$response;
  say(state, bus, { kind: 'note', text: `Face down on the pavement, a knee in your back, the cuffs. ${taken.length + near.length ? 'The gun goes into an evidence bag. ' : ''}The station, a bench, a long wait; the diplomatic passport, and the calls it takes. ${HELD_H} hours on, a man from the embassy signs for you, and doesn't say a word in the car.` });
  state.$held = HELD_H * HOUR;                                      // (the hours at the station: sim/game.js skips them)
  return true;
}

/** Once a tick (sim/game.js): each gunner's next step, as its last one's time runs out. */
export function tick(state, bus) {
  const me = playerOf(state);
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
