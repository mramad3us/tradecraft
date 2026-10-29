// TRADECRAFT sim: a game, and its tick.
//
// newGame() makes the state of a new game (a scenario: the game itself later, a mechanic test or
// the free walk now); start() attaches the runtime world to a state, new or loaded; step() advances
// it one tick (TICK_MS). The sim is pure: no DOM, no clock of its own, no Math.random. It takes the
// player's input as data and reports what happens on the bus.
//
// skip() is time passing without ticks (an action that takes time; for now, debug mode's clock keys):
// the world gets outcomes for the gap, not a simulation of it.
//
// The tick, in this order (decisions made in a tick act the next):
//   1. The player's input becomes their velocity, gait and heading (where they face: the way they
//      walk, or, holding E, the way they look).
//   2. Everyone moves, in the order they're listed: the player (and a scenario's walkers) by their
//      velocity, sliding along what blocks them (sim/world.js); agents (passers-by among them) along
//      their routes, on any street (sim/agents.js). The focus through a way off the map (a side street's end, a lane south): the
//      next street is loaded (changeMap(), loadRow()), and the tick goes on there.
//   3. The actor grid is rebuilt, and the player looks: what they see is remembered
//      (sim/perception.js), and that's all the view will show of anyone else. Followers look for
//      their targets, and every ROUTE_EVERY ticks walk the trail anew.
//   4. Everyone else thinks: passers-by on the street mind the player (sim/crowd.js); the scenario's
//      own characters decide what they'll do next tick.
//   5. The scenario's rules (its checks and events).
//   6. Once a second: the map's sections follow the focus (and whatever else the scenario anchors),
//      and the crowd's bubble is kept round the focus: its street and the streets either side. The
//      weather (sim/weather.js): the log says when it turns; running on snow or ice, a slip, maybe.
//   7. The clock advances; an autosave is due every 30 game minutes ('autosave' on the bus).
import { seedRng, chance, stream } from './rng.js';
import { TICK_MS, MIN, DAY, dateText } from './clock.js';
import { SAVE_SCHEMA } from './state.js';
import { attach, refocus, rehash, move, near, exitAt } from './world.js';
import { Z, placeName } from './map/street.js';
import { CITIES, townOf } from './cities/index.js';
import { say } from './log.js';
import { populate, think, walk, facing, isPasserby, noticeAgent } from './crowd.js';
import { look, headOf, faceOf, GLASS_MAX_DEG } from './perception.js';
import { isAgent, onMap, stepAgent, watchTarget, routeFollower, ROUTE_EVERY } from './agents.js';
import { drift, asOfficer } from './people.js';
import { heal, bleeding, bloodTick, bandOf, canStand, kill, BLOOD, COME_ROUND_S } from './health.js';
import { PRESSURE_K, treat } from './aid.js';
import { atKerb, destinations, ride, cabFor, hailedBy, board, rideTick, chaseTick, WALK_OFF_M } from './taxi.js';
import { doWay, insideTick, withinTick, LIVED } from './shops.js';
import * as buses from './buses.js';
import * as metro from './metro.js';
import * as police from './police.js';
import { stationNear, destinations as metroWays } from './metro.js';
import { lessonOf } from './tutorial/index.js';
import { startTutor, tutorTick } from './tutorial/earpiece.js';
import * as traffic from './traffic.js';
import { notice } from './notice.js';
import { learnTick } from './knowledge.js';
import { wetTick, wetDays } from './wet.js';
import { needsTick, strain } from './needs.js';
import { weatherAt, footing, weatherTick, parseWeather, SLIP_S } from './weather.js';
import { shortName } from './fight.js';
import { drips } from './blood.js';
import { glassAhead, affordance, act as doAct } from './acts.js';
import * as fight from './fight.js';
import * as interact from './interact.js';
import * as talk from './talk.js';
import * as items from './items.js';
import { SCENARIOS } from './scenarios/index.js';
import { settle } from './places.js';

export const WALK_MS = 1.45;                                       // the player's walk, m/s
export const STROLL_MS = 0.95;                                     // a stroll (Alt held): to keep a pace without stopping
export const RUN_MS = 3.6;                                         // and run (which draws attention)
export const LOOK_M = 50;                                          // the player looks at whoever's within this (sight's reach)
export const GLANCE_S = 1.2;                                       // a look over the shoulder (E tapped)
export const AUTOSAVE_MS = 30 * MIN;
const DT = TICK_MS / 1000;
const TICKS_PER_S = Math.round(1000 / TICK_MS);
export const SLANT_DEG_S = 70;                                     // (the eyes slanted along a shop's glass, E held: degrees a second)

/**
 * A new game: a scenario (SCENARIOS) from a seed. Call start() before stepping it. autoplay: the
 * player's character played by the game's own AI (an agent: sim/agents.js), with its options (as the
 * scenario reads them, e.g. { keep } for a follower); null, by hand. weather: a pin (sim/weather.js
 * parseWeather(): 'snow-heavy-gale', 'frost', 'clear'), for shots, tests and debugging; none, the
 * city's own.
 */
export function newGame({ seed = 1, scenario = 'walk', version = '', autoplay = null, chapter = null, campaign = null, context = null, city = null, weather = null, lesson = null, character = null, job = null } = {}) {
  // (a lesson of the tutorial: its scene, and Hale in your ear: sim/tutorial/)
  const L = lesson ? lessonOf(lesson) : null;
  if (L) { scenario = L.scenario; chapter = L.chapter ?? chapter; }
  const state = {
    game: 'tradecraft', schema: SAVE_SCHEMA, version, seed, rng: seedRng(seed), tick: 0, time: { ms: 0 }, autoplay,
    scenario: { kind: scenario }, country: 'ru', legend: null, player: null, focus: null,
    people: {}, map: null, actors: [], nextActor: 1, heat: {}, log: [], flags: {}, mind: { seen: {} },
  };
  const pin = parseWeather(weather);
  if (pin) state.weather = pin;
  // (a campaign rides along, the persistent part: sim/campaign.js; context, an assignment's, for its scene's setup)
  state.campaign = campaign;
  state.assignment = context?.assignment ?? null;
  settle(campaign);                                                 // (its embassy and doors on its streets: sim/places.js)
  // The city (sim/cities/): a street map is generated from its profile (state.map.city; none is Moscow).
  const C = city && CITIES[city];
  if (C) state.country = C.country;
  // (a lesson played by the campaign's own officer, in its city, under its cover: src/main.js; the scene makes its player as them)
  SCENARIOS[scenario].setup(state, { chapter, campaign: context, city: C && city !== 'moscow' ? city : null, lesson: L, character });
  if (character) wear(state, character);
  if (job && state.legend && state.legend.id === 'embassy') state.legend.name = job;
  if (L?.beats) startTutor(state, L);
  if (C && city !== 'moscow' && state.map?.kind === 'street') state.map.city ??= city;
  return state;
}

/**
 * The player as someone else: a campaign's officer playing a lesson (the user, 2026-10-27: "gate the
 * tutorial behind the campaign, to make it linked to the character we pick"). Who they are (name, sex,
 * age, look, skills, Tradecraft, background, languages) is the officer's; what the scene gave them to
 * carry stays the scene's.
 */
export function wear(state, character) {
  const me = state.people[state.player];
  if (me) asOfficer(me, character);
}

/** Attach the runtime world (state.$world) to a state, new or loaded, and fill the street if it's new. */
export function start(state, bus) {
  settle(state.campaign);                                           // (a loaded campaign's places marked again)
  const f = focusActor(state);
  attach(state, bus, f?.x ?? 0);
  rehash(state);
  if (!state.flags.populated) { populate(state, f?.x ?? 0, { fill: true }); state.flags.populated = true; rehash(state); }
  SCENARIOS[state.scenario.kind].attach?.(state, bus);
  return state;
}

export const actor = (state, id) => state.actors.find(a => a.id === id);
export const playerActor = (state) => state.actors.find(a => a.who === state.player);
export const focusActor = (state) => (state.focus && actor(state, state.focus)) || playerActor(state);

/**
 * One tick. input: { mx, mz (−1 … 1, z toward the camera), run, slow, look, act: [actions this
 * tick] }. run is Shift held, slow Alt (a stroll); look is E held: the player stands, and mx, mz turn
 * their eyes instead of their feet. Actions go to the scenario (T: 'instinct'); one may give the
 * player something to do (me.busy: a short plan of steps, such as stepping to a shop window to look
 * in it), which moving cancels. 'glance' (E tapped) is the game's own: for GLANCE_S the player's eyes
 * go back over their shoulder (me.glance, ticks left), walking on; the scenario hears of it too, for
 * whoever might see it done.
 */
export function step(state, input = {}, bus) {
  const scenario = SCENARIOS[state.scenario.kind];
  // 1. The player.
  const me = playerActor(state);
  // (frayed nerves: a glance back you didn't decide on, counted by the scenes like any other: sim/needs.js)
  const acts = state.slip ? [...(input.act ?? []), 'glance'] : input.act ?? [];
  delete state.slip;
  for (const act of acts) {
    if (fight.act(state, bus, act, scenario)) continue;            // (a fight's move: sim/fight.js)
    if (String(act).startsWith('talk:')) { talk.choose(state, bus, act.slice(5)); continue; }   // (a conversation's choice: sim/talk.js)
    if (String(act).startsWith('interact:')) {                     // (F's menu, chosen: sim/interact.js)
      const [, id, aid] = act.split(':'), them = state.actors.find(a => a.id === aid);
      const done = interact.act(state, bus, id, them);
      if (done && them) scenario.onInteract?.(state, bus, them, id);   // (a scene's own people, touched: a word, a blow: sim/scenarios/*)
      if (done?.show === 'read') bus?.emit('read', done.who);
      if (done?.show === 'aid') bus?.emit('aid', them.id);          // (first aid for them: the UI's panel, its choice back as 'aid:')
      continue;
    }
    if (String(act).startsWith('aid:')) {                          // (first aid, H or F: 'aid:<actor>:<method>:<arg>', sim/aid.js)
      const [, aid, ...key] = act.split(':'), them = state.actors.find(a => a.id === aid);
      const done = me && them && !state.fight && Math.hypot(them.x - me.x, them.z - me.z) < 2.5 && treat(state, bus, me, them, key.join(':'));
      if (done?.rest) skip(state, bus, done.rest);                  // (a rest: the hours go by: sim/aid.js)
      continue;
    }
    if (String(act).startsWith('metro:')) {                        // (down the steps, the station chosen: sim/metro.js)
      const [id, how] = act.slice(6).split(':'), d = me && !state.fight && stationNear(state, me), to = d && metroWays(state, d).find(o => o.id === id);
      if (to) {
        say(state, bus, { kind: 'note', text: `Down the steps, through the barrier, the platform: ${to.lines.join(', then ')}.${how === 'doors' ? ' On the last train you stand by the doors, and step off as they close: the next one, five minutes on.' : ''}` });
        const m = metro.ride(state, bus, to, { scenario, skip, loadRow, doors: how === 'doors' });
        if (m) say(state, bus, { kind: 'note', text: `${Math.round(m)} minutes later, up the steps into ${placeName(townOf(state.map), state.map.row ?? 0, playerActor(state).x, Z.front + 1)}.` });
      }
      continue;
    }
    if (String(act).startsWith('police:')) { police.answer(state, bus, act.slice(7)); continue; }   // (stopped: your answer, sim/police.js)
    if (String(act).startsWith('shop:')) {                         // (in a shop, at its counter, its table, its back door: what's chosen there, sim/shops.js)
      if (me && !state.fight) doWay(state, bus, me, act.slice(5), scenario);
      continue;
    }
    if (String(act).startsWith('taxi:')) {                         // (a taxi, where to chosen: sim/taxi.js)
      const [id, how] = act.slice(5).split(':'), dest = destinations(state, scenario).find(d => d.id === id), cab = me && cabFor(state, me);
      const to = dest && { ...dest, lose: how === 'lose' };          // (the long way round, losing anyone behind: sim/taxi.js keeps())
      if (to && me && !state.fight && cab) { board(state, bus, me, cab, to); continue; }   // (the taxi stopped for you: in, and off: rideTick())
      if (to && me && !state.fight && atKerb(state, me)) {
        say(state, bus, { kind: 'note', text: `A taxi pulls in. ${cap(to.label)}, you tell him, and he grunts.` });
        const m = ride(state, bus, to, { scenario, skip, loadRow });
        if (m) say(state, bus, { kind: 'note', text: `${Math.round(m)} minutes later, ${placeName(townOf(state.map), state.map.row ?? 0, playerActor(state).x, 0)}: you pay, and get out.` });
      }
      continue;
    }
    if (String(act).startsWith('bus:')) {                          // (on the bus at the stop, where to chosen: sim/buses.js)
      const b = me?.busy?.what === 'shelter' && me.busy.bus && !state.fight ? me.busy : null;
      const to = b && buses.destinations(state, b.stop, b.bus.line, b.bus.dir).find(d => d.id === act.slice(4));
      if (to) {
        say(state, bus, { kind: 'note', text: `On, a coin for the driver, a seat by the window. ${cap(to.label)}.` });
        const m = buses.ride(state, bus, to, { scenario, skip, loadRow });
        if (m) say(state, bus, { kind: 'note', text: `${Math.round(m)} minutes later, ${placeName(townOf(state.map), state.map.row ?? 0, playerActor(state).x, 0)}: off at the stop.` });
      } else if (me?.busy?.what === 'shelter') say(state, bus, { kind: 'note', text: 'Too late: it\'s gone.' });
      continue;
    }
    if (act === 'draw') { if (state.fight) fight.drawMove(state, bus, scenario); else if (me) items.use(state, bus, me, 'draw'); continue; }   // (G: sim/items.js; in a fight, it costs the exchange)
    if (String(act).startsWith('inv:')) { if (me && !state.fight) items.use(state, bus, me, act.slice(4)); continue; }   // (the inventory's buttons)
    if (act === 'glance' && me && !me.glance) me.glance = Math.round(GLANCE_S * TICKS_PER_S);
    // R: what's at hand (sim/acts.js affordance()), whatever the scene's line offers; T is the line's own.
    if (act === 'use') {
      const here = !state.fight && !scenario.holds?.(state) && affordance(state, me);
      if (here) doAct(state, bus, me, here.act, { toward: scenario.toward?.(state, me), scenario });
      continue;
    }
    scenario.act?.(state, bus, act);
  }
  // A fight waiting for a choice, a conversation: time stands still (sim/fight.js, sim/talk.js).
  if (state.fight?.phase === 'choose' || state.talk) return;
  if (me?.inside && LIVED.has(me.inside.way) && (input.mx || input.mz)) Object.assign(me.inside, { until: state.time.ms, cut: true });   // (the window's coffee: moving, you've had enough of it: sim/shops.js)
  if (state.fight || scenario.holds?.(state) || me?.inside || me?.cab) input = { act: me?.cab ? [] : input.act };   // (a fight, the scenario, a shop or a taxi has the player's feet)
  if (me?.inside?.long && !me.inside.skipped) { me.inside.skipped = true; skip(state, bus, me.inside.until - state.time.ms); }   // (what's done in a shop, however it was chosen: an action that takes time, the clock skipped)
  if (me?.inside) insideTick(state, bus, me, scenario);
  if (me && state.map.kind === 'street') withinTick(state, bus, me, scenario);   // (in at a shop's door, or out: sim/shops.js)
  traffic.trafficTick(state, bus);                                 // (the cars on the road: sim/traffic.js)
  // A taxi hailed: stopped for you, it asks where to; walk off, and it goes. In one: with it, then the ride (sim/taxi.js).
  if (me?.cab) {
    const m = rideTick(state, bus, me, { scenario, skip, loadRow });
    if (m) say(state, bus, { kind: 'note', text: `${Math.round(m)} minutes later, ${placeName(townOf(state.map), state.map.row ?? 0, me.x, 0)}: you pay, and get out.` });
  } else if (me) {
    const cab = cabFor(state, me), h = !cab && hailedBy(state, me);
    if (cab && !cab.taxi.offered) { cab.taxi.offered = state.time.ms; if (me.busy?.what === 'hail') me.busy = null; bus?.emit('taxi', destinations(state, scenario)); }
    if (h && me.busy?.what === 'hail' && Math.abs(h.x - me.x) > 18) me.busy.wait = 0;   // (the arm stays up till it's close)
    if ((cab ?? h) && Math.abs((cab ?? h).taxi.hail.x - me.x) > WALK_OFF_M) { (cab ?? h).taxi.hail = null; (cab ?? h).taxi.stopped = 0; }
  }
  buses.waitTick(state, bus, me);                                  // (sat at a stop: the bus comes, waits, goes: sim/buses.js)
  const mine = me && state.people[me.who], fallen = mine && (mine.dead || !canStand(mine));
  if (fallen) input = { act: [] };                                 // (collapsed, out cold or dead: nothing answers)
  if (me && !me.ai) {
    let mx = input.mx ?? 0, mz = input.mz ?? 0;
    const n = Math.hypot(mx, mz);
    if (n > 0.01 && !input.look) me.busy = null;
    me.looking = !!input.look && !me.busy;
    if (me.busy) busy(me);
    else if (input.look) {
      me.vx = me.vz = 0; me.gait = 'idle';
      // (at a shop's glass, left and right slant the eyes along it, a little at a time, as far as the glass
      // shows, and up brings them back to straight in; down turns away from it. The user, 2026-10-27: E
      // held "tends to slant the wrong direction (up instead of left)": left turned you from the window.)
      if (n > 0.01 && me.glass && mz <= 0) {
        const max = GLASS_MAX_DEG * Math.PI / 180, to = mx ? -Math.PI / 2 + Math.sign(mx) * max : -Math.PI / 2, step = SLANT_DEG_S * Math.PI / 180 / TICKS_PER_S;
        const at = Math.max(-Math.PI / 2 - max, Math.min(-Math.PI / 2 + max, me.head > Math.PI / 2 ? me.head - 2 * Math.PI : me.head));
        me.head = at + Math.max(-step, Math.min(step, to - at));
      } else if (n > 0.01) { me.head = Math.atan2(mz, mx); me.face = faceOf(me.head); }
    } else {
      if (n > 1) { mx /= n; mz /= n; }
      const run = input.run && bandOf(mine) !== 'shock';             // (in shock from the blood lost, no running)
      const foot = footing(weatherAt(state));                        // (slower going in snow: sim/weather.js)
      const speed = run ? RUN_MS * foot.run : (input.slow ? STROLL_MS : WALK_MS) * foot.walk;
      me.vx = mx * speed; me.vz = mz * speed;
      me.gait = n > 0.01 ? (run ? 'run' : 'walk') : 'idle';
      if (n > 0.01) { me.head = Math.atan2(mz, mx); me.face = facing(me.vx, me.vz, me.face); }
    }
    // A slip on snow or ice (step 6): a moment's stagger, skidding on, the feet nobody's.
    if (me.skid > 0) { me.skid--; me.vx *= 0.35; me.vz *= 0.35; me.gait = 'stagger'; }
    // A glance back: the eyes over the shoulder, the feet going on; then the eyes come back.
    if (me.glance) {
      me.eyesOn ??= me.head;
      if (n > 0.01 || me.busy) me.eyesOn = me.head;
      me.head = me.eyesOn + Math.PI;
      if (--me.glance === 0) { me.head = me.eyesOn; me.eyesOn = undefined; }
    }
    // Stood at a shop's glass with the eyes into it: looking in the window (since when, for the
    // scenarios: a stop that began as someone looked is a stop they saw begin).
    const pane = !me.vx && !me.vz && glassAhead(state, me);
    me.glass = pane ? (me.glass?.x0 === pane.x0 ? me.glass : { ...pane, since: state.time.ms }) : false;
    if (me.glass) me.face = 'up';
  }
  // 2. Everyone moves; the focus may leave the map. (Someone out cold lies there a while; the dead, for good.)
  for (const a of state.actors) {
    if (a.ai?.downUntil > state.time.ms && !a.ai.fighting) { a.vx = a.vz = 0; a.gait = 'down'; continue; }
    if (isAgent(a)) stepAgent(state, a, scenario, bus);
    else if (a.ai) walk(state, a);
    else if (a.vx || a.vz) a.stride += move(state, a, a.vx * DT, a.vz * DT);
  }
  const way = me && !me.ai && focusActor(state) === me && exitAt(state, me);
  if (way) changeMap(state, bus, way);
  const f = focusActor(state);
  if (f && isAgent(f) && f.row !== state.map.row) loadRow(state, bus, f.row, f.x);
  // 3. The grid, and the player looks; followers look for their targets. 4. Everyone else thinks.
  rehash(state);
  if (me && onMap(state, me)) look(state, me, near(state, me.x, me.z, LOOK_M));
  for (const a of state.actors) {
    if (!a.ai?.follow) continue;
    watchTarget(state, a);
    if ((state.tick + hashId(a.id)) % ROUTE_EVERY === 0) routeFollower(state, a);
  }
  for (const a of state.actors) {
    if (a.ai?.downUntil > state.time.ms) continue;
    if (isPasserby(a)) { if (onMap(state, a)) noticeAgent(state, a); }
    else if (a.ai?.kind === 'walker') think(state, a);
    else if (a.ai) scenario.think?.(state, a, bus);
  }
  // 5. A fight played out (sim/fight.js); the scenario; and what's at hand, for the instinct's line (runtime: sim/acts.js).
  fight.tick(state, bus, scenario);
  scenario.tick?.(state, bus);
  if (state.tutor) tutorTick(state, bus);                          // (a lesson: Hale in your ear: sim/tutorial/earpiece.js)
  state.$offer = me && !state.fight && !scenario.holds?.(state) ? affordance(state, me) : null;   // (nothing's at hand in a fight, or while the scene has your feet)
  if (fallen && me) { me.vx = me.vz = 0; me.gait = 'down'; }
  // 6. The map and the crowd, once a second; and whoever bleeds, their blood (sim/health.js).
  if (state.tick % TICKS_PER_S === 0) {
    drips(state);
    for (const a of state.actors) if (a.who) bloodBeat(state, bus, a, 1);
    notice(state, bus, me);                                         // (blood on you, seen: a face remembered: sim/notice.js)
    needsTick(state, bus, me);                                      // (hunger's clock, the calm coming back, frayed slips: sim/needs.js)
    learnTick(state);                                               // (the streets walked, known: sim/knowledge.js)
    wetTick(state, bus, me);                                        // (rain on you, the cold, a cold: sim/wet.js)
    metro.stepsTick(state);                                         // (whoever rode with you, up the steps after you: sim/metro.js)
    chaseTick(state);                                               // (whoever kept your taxi in sight, out of their car behind you: sim/taxi.js)
    if (scenario.police && !state.tutor) { police.patrolTick(state); police.eyeTick(state, bus); }   // (ordinary law: sim/police.js)
    if (state.tick % (TICKS_PER_S * 60) === 0 && state.people[state.player]) bodyNotes(state, bus, heal(state.people[state.player], 1 / 1440, state.time.ms, { blood: false }));   // (your wounds, a minute on: sim/medicine.js)
    weatherTick(state, bus);                                        // (the weather turning, in the log: sim/weather.js)
    if (me?.gait === 'run' && !me.ai && !state.fight) slipUp(state, bus, me);
    const f = focusActor(state);
    if (f) { refocus(state, bus, [f.x, ...(scenario.anchors?.(state) ?? [])]); populate(state, f.x); }
  }
  // 7. The clock.
  const before = Math.floor(state.time.ms / AUTOSAVE_MS);
  state.time.ms += TICK_MS;
  state.tick++;
  if (Math.floor(state.time.ms / AUTOSAVE_MS) !== before) bus?.emit('autosave', 'clock');
}

/**
 * Running on snow or ice, once a second: a slip, now and then (sim/weather.js footing(): its chance,
 * from a stream of its own, so the game's dice don't move). SLIP_S of a stagger, a word in the log.
 */
function slipUp(state, bus, me) {
  const p = footing(weatherAt(state)).slip;
  if (!p || me.skid || !chance(stream('slip-foot', state.seed, state.tick), p)) return;
  me.skid = Math.round(SLIP_S * TICKS_PER_S);
  const w = weatherAt(state);
  say(state, bus, { kind: 'note', text: w.ice ? 'Your foot goes on the ice and the street tilts; you get it back, just, arms out like a fool.' : 'Your heel skates on the packed snow; you stagger, and keep your feet.' });
}

// The player's busy plan: ['go', x, z] (walk there; given up after a second without getting closer)
// and ['wait', ticks, face, gait].
function busy(me) {
  const b = me.busy, s = b.steps[0];
  if (!s) { me.busy = null; me.vx = me.vz = 0; me.gait = 'idle'; return; }
  if (s[0] === 'go') {
    const dx = s[1] - me.x, dz = s[2] - me.z, d = Math.hypot(dx, dz);
    // (given up when a second's walking hasn't brought it closer than it was a second before)
    const stuck = ++b.wait % TICKS_PER_S === 0 && b.mark !== undefined && d > b.mark - 0.05;
    if (b.wait % TICKS_PER_S === 0) b.mark = d;
    if (d < 0.1 || stuck) { b.steps.shift(); b.wait = 0; b.mark = undefined; return busy(me); }
    me.vx = dx / d * WALK_MS; me.vz = dz / d * WALK_MS; me.gait = 'walk'; me.face = facing(me.vx, me.vz, me.face); me.head = Math.atan2(dz, dx);
    return;
  }
  me.vx = me.vz = 0; me.gait = s[3] ?? 'idle';
  if (s[2]) { me.face = s[2]; me.head = headOf(s[2]); }
  if (++b.wait >= s[1]) { b.steps.shift(); b.wait = 0; }
}

/** Let time pass without ticking (ms ≥ 0): the clock jumps, people's gauges drift and bruises mend, the crowd follows the hour. */
export function skip(state, bus, ms) {
  if (!(ms > 0)) return;
  // (whoever's bleeding bleeds through it, a minute at a time)
  for (const a of state.actors) {
    const p = a.who && state.people[a.who];
    if (!p || p.dead || !bleeding(p, state.time.ms)) continue;
    for (let t = 0; t < ms && !p.dead; t += 60000) { const at = state.time.ms; state.time.ms += Math.min(60000, ms - t); bloodBeat(state, bus, a, Math.min(60, (ms - t) / 1000)); state.time.ms = at; }
  }
  const before = Math.floor(state.time.ms / AUTOSAVE_MS);
  state.time.ms += Math.round(ms / TICK_MS) * TICK_MS;
  for (const [who, p] of Object.entries(state.people)) {
    drift(p, state.time.ms);
    const notes = heal(p, ms / DAY, state.time.ms, { tended: who !== state.player });   // (off the map, people see their own doctors)
    if (who === state.player) { wetDays(p, ms / DAY, state.time.ms); bodyNotes(state, bus, notes); }
  }
  const f = focusActor(state);
  if (f) populate(state, f.x);
  rehash(state);
  if (Math.floor(state.time.ms / AUTOSAVE_MS) !== before) bus?.emit('autosave', 'skip');
}

/**
 * The player goes off the map through `way` (an exit of sim/map/street.js): the next street north or
 * south becomes the map. They arrive at the same way's other end (a row's north lanes are the next
 * row's south ones), facing on; the crowd is the new street's; the scenario keeps whom it carries
 * (carry(): the target who went this way first) and hears of it (mapChanged()). The memory of who was
 * where goes with the old street. An autosave, as on every map change.
 */
export function changeMap(state, bus, way) {
  const scenario = SCENARIOS[state.scenario.kind], me = playerActor(state);
  const from = state.map.row ?? 0, row = from + (way.dir === 'n' ? -1 : 1);
  const carried = scenario.carry?.(state, way) ?? [];
  me.x = Math.max(way.x0 + 0.5, Math.min(way.x1 - 0.5, me.x));
  me.z = way.dir === 'n' ? Z.edge - 1 : Z.north + 1;
  me.row = row;
  for (const id of carried) { const a = actor(state, id); if (a) a.row = row; }
  loadRow(state, bus, row, me.x, { way, from });
}

/**
 * s seconds of someone's blood (sim/health.js bloodTick()): a hand pressed on it holds some back (the
 * player's 'pressure', sim/aid.js); collapsed, they lie there; bled out, they're dead, and if it's the
 * player, the scene's over the engine's way.
 */
export function bloodBeat(state, bus, a, s) {
  const p = state.people[a.who];
  if (!p || p.dead || (p.blood === undefined && !bleeding(p, state.time.ms))) return;
  const pressed = state.actors.some(o => o.busy?.what === 'pressure' && (o.busy.on ?? o.id) === a.id);   // (their own hand, or someone's on it: sim/aid.js)
  let band = bloodTick(p, s, state.time.ms, pressed ? PRESSURE_K : 1);
  if (band === 'collapsed' && p.collapsedAt && !bleeding(p, state.time.ms) && state.time.ms - p.collapsedAt >= COME_ROUND_S * 1000) {
    p.blood = BLOOD.collapse + 0.5; band = bandOf(p);             // (lying flat, nothing bleeding: the blood to the head again)
    if (a.ai) a.ai.downUntil = state.time.ms;
    say(state, bus, { kind: 'note', text: a.who === state.player ? 'You come round on the cold ground, sick and slow. You can stand, carefully; you can\'t run.' : `${shortName(state, a.who)} comes round, and sits up slowly.` });
  }
  if (band === 'dead') {
    kill(p, state.time.ms, 'blood loss');
    a.gait = 'down'; a.vx = a.vz = 0; a.busy = null;
    if (a.ai) a.ai.downUntil = Infinity;
    say(state, bus, { kind: 'note', text: a.who === state.player ? 'The cold comes up from the ground and the light goes down to meet it.' : `${shortName(state, a.who)} doesn't move any more. Bled out.` });
    if (a.who === state.player && !state.scenario.outcome) { Object.assign(state.scenario, { outcome: 'dead', ended: state.time.ms }); bus?.emit('scenario-end', 'dead'); }
  } else if (band === 'collapsed') {
    a.gait = 'down'; a.vx = a.vz = 0;
    if (a.ai) a.ai.downUntil = state.time.ms + 2000;               // (held down while it lasts)
    if (!p.collapsedAt) { p.collapsedAt = state.time.ms; say(state, bus, { kind: 'note', text: a.who === state.player ? 'Your legs go. The pavement is very close, and then it\'s your cheek against it.' : `${shortName(state, a.who)} sways, and goes down.` }); }
  } else if (p.collapsedAt) delete p.collapsedAt;
}

/** What the days did to your body (sim/health.js heal()), in the log; dead of it (sepsis), the end. */
function bodyNotes(state, bus, notes) {
  for (const n of notes) say(state, bus, { kind: n.tone === 'warn' ? 'instinct' : 'note', text: n.text });
  const p = state.people[state.player];
  if (p?.dead && !state.scenario.outcome) {
    const a = state.actors.find(x => x.who === state.player);
    if (a) { a.gait = 'down'; a.vx = a.vz = 0; a.busy = null; }
    say(state, bus, { kind: 'note', text: 'The fever takes the last of it. The room goes very far away.' });
    Object.assign(state.scenario, { outcome: 'dead', ended: state.time.ms }); bus?.emit('scenario-end', 'dead');
  }
}

/** The engine's paper for a player killed (sim/fight.js): what killed them, where, and when. */
export function deathPaper(state) {
  const me = state.people[state.player], d = me?.dead ?? { why: 'something', ms: state.time.ms };
  return {
    stamp: 'DEAD', good: false, title: `${me?.name ?? 'You'}`.toUpperCase(),
    text: `Dead of ${d.why}, on ${dateText(d.ms)}. Somebody will find the body, and somebody else will have to explain it.`,
    notes: [`${state.legend?.name ?? 'Nobody official'}. The fight was the last thing.`],
    stats: dateText(d.ms),
  };
}

/**
 * Another map altogether, round x (a scene's cut: the hall at the Farm to a street in Moscow): only the
 * player and the actors in `keep` stay, on its row; the memory of who was where goes, and the blood on
 * the old floor; the crowd is the new map's.
 */
export function newMap(state, bus, map, x, keep = []) {
  const me = playerActor(state);
  bus?.emit('map-', state.map);
  state.map = { ...map, inPlay: [] };
  state.actors = state.actors.filter(a => a === me || keep.includes(a.id));
  for (const a of state.actors) a.row = map.row ?? 0;
  state.mind = { ...state.mind, seen: {} };
  state.decals = [];
  attach(state, bus, x);
  rehash(state);
  populate(state, x, { fill: true });
  rehash(state);
  bus?.emit('map', state.map);
}

/**
 * Load another street as the map, round x: the passers-by of the last one go, agents stay (on
 * whatever street they're on), the memory of who was where goes with the old street, the crowd is
 * the new one's. The scenario hears of it (mapChanged), a line goes to the log, and an autosave.
 */
export function loadRow(state, bus, row, x, { way = null, from = state.map.row, quiet = false } = {}) {
  const scenario = SCENARIOS[state.scenario.kind], me = playerActor(state);
  bus?.emit('map-', state.map);
  state.map.row = row;
  state.map.inPlay = [];
  state.actors = state.actors.filter(a => a === me || isAgent(a) || (a.ai && a.ai.kind !== 'walker') || a.row === row);
  state.mind = { seen: {} };
  attach(state, bus, x);
  rehash(state);
  populate(state, x, { fill: true });
  rehash(state);
  scenario.mapChanged?.(state, bus, way, from);
  const f = focusActor(state), north = row < from;
  const town = townOf(state.map), lane = way?.name ?? placeName(town, north ? from : row, f.x, north ? Z.front - 10 : Z.front - 10);
  if (!quiet) say(state, bus, { kind: 'note', text: north ? `Up ${lane}, and out onto the far side of ${placeName(town, row, f.x, Z.fence + 5)}.` : `Down ${lane}, toward ${placeName(town, row, f.x, 0)}.` });   // (a taxi tells its own arrival)
  bus?.emit('map', state.map);
  bus?.emit('autosave', 'map');
}

// (a small, stable number from an id, to spread followers' re-routing over the ticks)
const hashId = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
