// TRADECRAFT sim: blown, and hunted (DESIGN.md, Cover, heat and the hunt: "Blown. The game switches to the
// hunted state. You get to a predefined extraction point across generated map sections, with safe
// houses as stops to regroup and get resources … Capture is game over"; the user, 2026-10-27: "build the
// stuff like safe houses for hunted mode").
//
// An officer under a legend (no immunity) learns at dusk that the network is rolled up and they have
// the face. The station has a driver waiting across the city (EXTRACT_ROWS streets away, a few hundred
// metres along) until a deadline (DEADLINE_MIN): get to him (T, by him: go). On the way, two safe houses
// (doors on the streets between): in and out (T at the door), a change of coat (the description they
// carry no longer fits: DISGUISE_MOD), a minute out of sight (whoever's following loses you).
// **The hunters** (HUNTERS, by the heat): plain-clothes men with the description, city agents (sim/
// agents.js) walking search legs round where you were last known, on every street, loaded or not. One
// that sees you within SEE_M rolls his Awareness against your Deception every RECOG_EVERY_S (the
// description, matched or not; the dark; people round you; the distance) and, knowing you, follows in
// your footsteps closing to arm's reach, and radios it (the others make for where you were seen). At
// CAPTURE_M he takes hold: a fight (sim/fight.js), real; down, he stays down a while; lose it, you're
// taken. The rolls you can't see are hidden from the log until the end (as being tailed's are).
// Outcomes: 'out' (in the car), 'captured', 'stranded' (the deadline gone: the driver left), 'dead'.
import { at, TICK_MS, MIN, clockText, dateText } from '../clock.js';
import { handler, sheet, streetLook, describe } from '../people.js';
import { heatKey } from '../heat.js';
import { say, speak } from '../log.js';
import { townOf } from '../cities/index.js';
import { settle } from '../instinct.js';
import { skill } from '../skills.js';
import { opposed } from '../checks.js';
import { range, int, chance, pick, weighted, stream } from '../rng.js';
import { Z, SECTION_M, streetName } from '../map/street.js';
import { sectionOf, routeFrom, LINE } from '../city.js';
import { makeAgent, setRoute, follow, rowOf } from '../agents.js';
import { seesActor, inView, lightHere } from '../perception.js';
import { lightBand } from '../light.js';
import { begin as beginFight } from '../fight.js';
import { canStand } from '../health.js';

const TPS = 1000 / TICK_MS;
export const HUNTERS = [3, 5];
export const EXTRACT_ROWS = [3, 5];
export const DEADLINE_MIN = 80;
export const SEE_M = 28;
export const RECOG_EVERY_S = 3;
export const CAPTURE_M = 1.6;
export const DISGUISE_MOD = -8;
export const SAFE_REST_S = 60;
export const KEEP_M = 1.2;
export const TAXI_RADIO = 0.3;                                    // (the driver heard your description on the radio)                                        // (a hunter who knows you: right up behind you)
const COATS = [[0x6b4636, 0x47302a], [0x2f6b62, 0x23252f], [0x8f6345, 0x6b4636], [0x4a2a52, 0x23252f]];

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const actorOf = (state, id) => state.actors.find(a => a.id === id);
const rowsText = (dr) => (dr === 0 ? 'on this street' : `${Math.abs(dr)} street${Math.abs(dr) > 1 ? 's' : ''} ${dr < 0 ? 'north' : 'south'}`);

export const hunted = {
  name: '4. Blown',
  test: true,
  about: 'Your network is rolled up and they have your face. A car waits across the city for an hour and a quarter. Get to it, and don\'t get taken.',
  brief(state) {
    const sc = state.scenario, e = sc.extract;
    return {
      title: 'BLOWN',
      body: [
        `${state.people[state.player].name}: under a legend, no immunity. At ${clockText(sc.began)} the phone in the flat rang twice and stopped. That's the signal: the network's rolled up, and they have your face.`,
        `The station has a car for you, ${rowsText(e.row)} and a way along, by ${streetName(townOf(state.map), e.row)}: a driver in a dark cap, until ${clockText(sc.deadline)}. After that he's gone, and so are you.`,
        `They'll be looking: men in plain clothes with your description, ${sc.hunters.length} of them on the streets round here, and they talk to each other. Don't run, don't look at them, keep to people and the dark.`,
        'Two safe houses on the way: in and out, a different coat, a minute to breathe. If one of them gets hold of you, fight, or that\'s the end.',
      ],
      footer: `${dateText(sc.began)} · ${clockText(sc.began)}`,
      keys: [['instinct', 'at a safe house door: in and out; by the driver: go'], ['slow', 'held: stroll'], ['watch', 'held: stop and look'], ['hit', 'in a fight: hit (L grab, M cover)']],
    };
  },

  setup(state, { campaign: C = null, city = null } = {}) {
    const r = state.rng;
    state.time.ms = C?.startMs ?? at(2026, 11, 6, 18, 40);
    state.legend = { id: 'legend', name: 'A translator at a news agency (your legend)', cover: 'legend', floor: 40 };
    state.country = C?.country ?? 'ru';
    state.heat[heatKey('legend', state.country)] = C?.heat ?? 90;
    const me = C ? { ...structuredClone(C.player), id: 'me' } : handler(r);
    state.people.me = me;
    state.player = 'me';
    const seed = C?.mapSeed ?? Math.floor(range(r, 0, 4294967296));
    state.map = { kind: 'street', seed, row: 0, i0: null, i1: null, crowd: 1, city: C?.city ?? city ?? undefined };
    const town = townOf(state.map);
    const home = [0, 1].flatMap(i => sectionOf(town, 0, i).doors).find(d => d.kind === 'entrance' && d.z === Z.front) ?? { x: 14 };
    state.actors.push({ id: 'a0', who: 'me', seed: null, row: 0, x: home.x, z: -2.6, vx: 0, vz: 0, face: 'down', head: Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: null });
    // The car: a driver on a pavement streets away, a way along.
    const dir = chance(r, 0.5) ? -1 : 1, erow = dir * (EXTRACT_ROWS[0] + int(r, EXTRACT_ROWS[1] - EXTRACT_ROWS[0] + 1));
    const ex = home.x + (chance(r, 0.5) ? 1 : -1) * range(r, 60, 160);
    state.people.driver = sheet({ id: 'driver', name: 'the driver', sex: 'm', look: { skin: 'light', hair: { style: 'short', color: 0x14151c }, hat: { kind: 'cap', color: 0x23252f }, top: { kind: 'coat', color: 0x23252f, trim: 0x14151c }, legs: 0x23252f, shoes: 0x14151c } });
    const extract = { row: erow, x: Math.round(ex * 10) / 10, z: LINE.N ?? 8.5 };
    state.actors.push({ id: `a${state.nextActor++}`, who: 'driver', seed: null, row: erow, x: extract.x, z: extract.z, vx: 0, vz: 0, face: 'up', head: -Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: { kind: 'stand', steps: [], wait: 0 } });
    // Two safe houses on the way: a block's entrance on a street between, roughly on the line there.
    const safehouses = [1, 2].map(k => {
      const row = Math.round(erow * k / 3) || dir, along = home.x + (ex - home.x) * k / 3;
      const S = sectionOf(town, row, Math.floor(along / SECTION_M));
      const d = S.doors.filter(o => o.kind === 'entrance' && o.z === Z.front).sort((a, b) => Math.abs(a.x - along) - Math.abs(b.x - along))[0] ?? { x: Math.floor(along / SECTION_M) * SECTION_M + 12 };
      return { row, x: d.x, used: false };
    });
    // The hunters: on the streets round the flat, on search legs.
    const n = HUNTERS[0] + int(r, HUNTERS[1] - HUNTERS[0] + 1), hunters = [];
    for (let i = 0; i < n; i++) {
      const sex = chance(r, 0.2) ? 'f' : 'm', look = streetLook(r, sex, 28 + int(r, 20));
      delete look.carry;
      const who = `hunter${i}`;
      state.people[who] = sheet({ id: who, name: `a man with your description (${describe(look, sex)})`, sex, cls: 'spook', os: 30, look,
        skills: { awareness: [9 + int(r, 3), 1], tracking: [8, 1], cqc: [11 + int(r, 4), 1], fitness: [8, 1], deception: [6, 0] } });
      state.people[who].known = false; state.people[who].seen = describe(look, sex);
      const row = int(r, 3) - 1, x = home.x + (chance(r, 0.5) ? 1 : -1) * range(r, 35, 90);
      const a = makeAgent(state, { who, row, x, z: chance(r, 0.5) ? LINE.F : LINE.N, speed: range(r, 1.25, 1.45), f: range(r, -0.5, 0.5) });
      hunters.push(a.id);
    }
    state.scenario = {
      kind: 'hunted', phase: 'run', extract, safehouses, hunters, desc: { coat: me.look.top.color }, disguised: false,
      known: {}, lastSeen: { row: 0, x: home.x, ms: state.time.ms - 5 * MIN }, recogAt: {}, inside: null,
      deadline: state.time.ms + DEADLINE_MIN * MIN, prompt: null, outcome: null, began: state.time.ms, rolls: 0, seenBy: 0, fights: 0, campaign: !!C,
    };
    for (const id of hunters) leg(state, actorOf(state, id));
    say(state, null, { kind: 'note', text: `${clockText(state.time.ms)}. The phone rings twice, and stops. Out, now: the car's ${rowsText(erow)}, until ${clockText(state.scenario.deadline)}.` });
  },

  attach() {},

  /** In a safe house, or fighting: the player's feet are the scene's. */
  holds(state) { return !!state.scenario.inside; },

  think(state, a) { if (a.ai?.kind === 'stand') { a.vx = a.vz = 0; a.gait = 'idle'; } },

  act(state, bus, action) {
    const sc = state.scenario, me = playerOf(state);
    if (action !== 'instinct' || sc.outcome || !me || sc.inside) return;
    const e = sc.extract;
    if (rowOf(state, me) === e.row && Math.hypot(me.x - e.x, me.z - e.z) < 2.5) return end(state, bus, 'out', 'The driver opens the back door without a word. You lie down across the seat, and the city goes past upside down. By morning you\'re somebody else, somewhere else.');
    const h = sc.safehouses.find(s => !s.used && s.row === state.map.row && Math.abs(s.x - me.x) < 1.6 && me.z < Z.front + 2.2);
    if (h) {
      h.used = true;
      sc.inside = { until: state.time.ms + SAFE_REST_S * 1000, h };
      me.hidden = true; me.vx = me.vz = 0;
      // (a different coat: the description they carry no longer fits)
      const [color, trim] = pick(state.rng, COATS.filter(([c]) => c !== state.people.me.look.top.color));
      state.people.me.look = { ...state.people.me.look, top: { ...state.people.me.look.top, kind: 'coat', color, trim } };
      sc.disguised = true;
      for (const id of sc.hunters) { const a = actorOf(state, id); if (a?.ai?.follow) { delete a.ai.follow; leg(state, a); } }
      say(state, bus, { kind: 'note', text: 'Up the stairs, the key under the mat, the door shut behind you. A different coat from the wardrobe, a glass of water, a minute with the lights off. Then out again.' });
    }
  },

  tick(state, bus) {
    const sc = state.scenario, me = playerOf(state), now = state.time.ms;
    if (sc.outcome || !me) return;
    if (sc.inside) {
      if (now >= sc.inside.until) { me.hidden = false; sc.inside = null; say(state, bus, { kind: 'note', text: 'Out again, in a coat they\'ve never seen.' }); }
      sc.prompt = { id: 'inside', tone: 'calm', text: 'Inside. A minute, and out again.', ms: now };
      return;
    }
    if (now >= sc.deadline) return end(state, bus, 'stranded', 'The time comes and goes. Somewhere across the city a driver in a dark cap starts his engine and leaves, as he was told to. You\'re on your own now, and they know it.');
    if (state.tick % TPS !== 0) return;
    // The hunters: new search legs, eyes on the street, closing in.
    for (const id of sc.hunters) {
      const a = actorOf(state, id), p = a && state.people[a.who];
      if (!a || !p || p.dead || !canStand(p) || state.fight) continue;
      if (a.ai.follow?.lost) { delete a.ai.follow; delete sc.known[id]; leg(state, a); }
      if (!a.ai.follow && (!a.ai.route || a.ai.s >= a.ai.route.length - 0.05)) leg(state, a);
      if (rowOf(state, a) !== state.map.row) continue;
      const d = Math.hypot(a.x - me.x, a.z - me.z);
      if (sc.known[id]) {
        sc.lastSeen = { row: state.map.row, x: me.x, ms: now };
        if (d <= CAPTURE_M && !state.fight) { grab(state, bus, a); return; }
        continue;
      }
      if (d > SEE_M || !seesActor(state, a, me)) continue;
      if (now - (sc.recogAt[id] ?? 0) < RECOG_EVERY_S * 1000) continue;
      sc.recogAt[id] = now;
      const crowd = state.actors.filter(o => o !== me && o !== a && !o.hidden && Math.hypot(o.x - me.x, o.z - me.z) < 4).length;
      const light = lightBand(lightHere(state, me.x, me.z));
      const roll = opposed(state.rng, { skill: 'awareness', value: skill(p, 'awareness'), mods: [
        sc.disguised ? { why: 'a different coat from the description', v: DISGUISE_MOD } : { why: 'the description fits', v: 2 },
        light === 'dark' && { why: 'the dark', v: -3 }, light === 'dim' && { why: 'the dusk', v: -1 },
        crowd && { why: 'people round you', v: -Math.min(4, crowd) }, d > 15 && { why: 'at a distance', v: -Math.round((d - 15) / 4) },
        me.gait === 'run' && { why: 'running', v: 6 }].filter(Boolean) },
      { skill: 'deception', value: skill(state.people.me, 'deception') });
      sc.rolls++;
      say(state, bus, { kind: 'roll', roll, hidden: true, text: roll.ok ? `${cap(p.seen)} knows you.` : `${cap(p.seen)} looks you over, and looks away.` });
      if (roll.ok) {
        sc.known[id] = now; sc.seenBy++;
        follow(state, a, me, KEEP_M);
        sc.lastSeen = { row: state.map.row, x: me.x, ms: now };
        for (const other of sc.hunters) { const o = actorOf(state, other); if (o && o !== a && !o.ai.follow) leg(state, o, sc.lastSeen); }   // (the radio)
      }
    }
    sc.prompt = settle(sc.prompt, [...instinct(state, me, now)], now);
  },

  /** A fight with one of them (sim/fight.js): won, he's down; lost, you're taken. */
  onFightEnd(state, bus, f) {
    const sc = state.scenario, a = state.actors.find(o => o.who === f.b);
    sc.fights++;
    if (f.ended.by === 'a') {
      if (a) { delete a.ai.follow; delete sc.known[a.id]; a.ai.downUntil = state.time.ms + 5 * MIN; }
      say(state, bus, { kind: 'note', text: 'He\'s down. The others will have heard: move.' });
    } else end(state, bus, state.people[state.player].dead ? 'dead' : 'captured', 'Hands on you, a knee in your back, the cold of cuffs. A car with no markings is already at the kerb. Lefortovo, then, and the long questions.');
  },

  /** A taxi (sim/taxi.js): close to the car, or anywhere; but drivers listen to the radio. */
  destinations(state) {
    const e = state.scenario.extract;
    return [{ id: 'car', label: 'a street near the car', row: e.row, x: e.x + (e.x > 0 ? -45 : 45) }];
  },
  onTaxi(state, bus) {
    const sc = state.scenario;
    if (chance(state.rng, TAXI_RADIO)) end(state, bus, 'captured', 'The driver\'s eyes in the mirror, a second too long; then he doesn\'t take the turn you asked for. The doors lock themselves. He\'d heard the radio: a description, and a reward.');
    else sc.lastSeen = { row: state.map.row, x: playerOf(state).x, ms: state.time.ms };
  },

  goal(state) {
    const sc = state.scenario, e = sc.extract, me = playerOf(state);
    if (sc.outcome || !me) return null;
    const dr = e.row - state.map.row;
    return { row: e.row, x: e.x, z: e.z, label: `the car · ${dr ? rowsText(dr) : `${Math.round(Math.abs(e.x - me.x))} m`}` };
  },

  result(state) {
    const sc = state.scenario, stamp = { out: 'OUT', captured: 'TAKEN', stranded: 'STRANDED', dead: 'DEAD' }[sc.outcome] ?? sc.outcome;
    return {
      stamp, good: sc.outcome === 'out', title: 'BLOWN', text: sc.endText,
      notes: [`They knew you ${sc.seenBy} time${sc.seenBy === 1 ? '' : 's'} on the way; you fought ${sc.fights}; ${sc.safehouses.filter(h => h.used).length} safe house${sc.safehouses.filter(h => h.used).length === 1 ? '' : 's'} used.`].filter(Boolean),
      stats: `${Math.round((sc.ended - sc.began) / 60000)} min on the run · ${sc.rolls} of their looks at you`,
    };
  },
};

/** A hunter's next search leg: toward where you were last known (recently), else about there. */
function leg(state, a, to = null) {
  const sc = state.scenario, r = stream('leg', state.map.seed, a.id, state.time.ms);
  const last = to ?? sc.lastSeen;
  const recent = state.time.ms - last.ms < 4 * MIN;
  const row = recent ? last.row : last.row + int(r, 5) - 2, x = last.x + (recent ? range(r, -6, 6) : range(r, -90, 90));
  try { setRoute(state, a, routeFrom(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, { row, x, z: chance(r, 0.5) ? LINE.F : LINE.N })); } catch {}
}

/** One of them has hold of you: a fight. */
function grab(state, bus, a) {
  const me = playerOf(state);
  speak(state, bus, a.id, `A hand on your arm: ${state.people[a.who].seen}. "Come with us, quietly."`, `A hand on your arm: ${state.people[a.who].seen}.`);
  beginFight(state, bus, a, { style: 'wrestler', owner: 'hunted' });
}

/** The instinct, on the run (sim/instinct.js): them, the time, the way, the doors. */
function* instinct(state, me, now) {
  const sc = state.scenario, L = (id, tone, text, act = null) => ({ id, tone, text, act });
  const near = sc.hunters.map(id => actorOf(state, id)).filter(a => a && rowOf(state, a) === state.map.row && inView(state, a.id)).map(a => [a, Math.hypot(a.x - me.x, a.z - me.z)]).sort((p, q) => p[1] - q[1]);
  const knows = near.find(([a]) => sc.known[a.id]);
  if (knows) yield L('known', 'urgent', `${cap(state.people[knows[0].who].seen)} has you, ${Math.round(knows[1])} m back, closing. Lose him: people, a lane, a door. Or turn and fight.`);
  if (me.gait === 'run' && near.length) yield L('run', 'urgent', 'Don\'t run. A running man is the one they\'re looking for.');
  const e = sc.extract, left = Math.round((sc.deadline - now) / MIN), dr = e.row - state.map.row;
  if (dr === 0 && Math.abs(e.x - me.x) < 2.5) yield L('car', 'warn', 'The driver. {instinct} go.', 'go');
  const h = sc.safehouses.find(s => !s.used && s.row === state.map.row && Math.abs(s.x - me.x) < 1.6 && me.z < Z.front + 2.2);
  if (h) yield L('safehouse', 'note', 'The safe house door. {instinct} in and out: another coat, a minute out of sight.', 'safe');
  if (near.length && near[0][1] < SEE_M) yield L('looking', 'warn', `${near.length > 1 ? `${near.length} of them` : cap(state.people[near[0][0].who].seen)} on this street, looking at faces. Keep to people and the shadows; don't look at them.`);
  if (left <= 15) yield L('late', 'warn', `${left} minutes before the car goes. ${dr ? rowsText(dr) : `${Math.round(Math.abs(e.x - me.x))} m ${e.x > me.x ? 'east' : 'west'}`}.`);
  const nextH = sc.safehouses.find(s => !s.used && s.row === state.map.row);
  if (nextH && !h) yield L('safehouse-here', 'calm', `A safe house on this street, ${Math.round(Math.abs(nextH.x - me.x))} m ${nextH.x > me.x ? 'east' : 'west'}: the block's entrance.`);
  yield L('way', 'calm', `The car: ${dr ? rowsText(dr) : `${Math.round(Math.abs(e.x - me.x))} m ${e.x > me.x ? 'east' : 'west'}`}, ${left} minutes.`);
}

function end(state, bus, outcome, text) {
  const sc = state.scenario;
  if (sc.outcome) return;
  Object.assign(sc, { outcome, phase: 'done', endText: text, ended: state.time.ms });
  for (const e of state.log) if (e.hidden && e.ms >= sc.began) e.hidden = false;   // (what they did, shown at the end)
  bus?.emit('scenario-end', outcome);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
