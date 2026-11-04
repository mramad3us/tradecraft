// TRADECRAFT sim: a range, its lanes live (the user, 2026-11-04: "a firearms training lesson", at "ranges where legal").
// A city's range is a shop on its streets (sim/shops.js RANGES: what a visitor may shoot there); this is an evening
// behind its door, played for real: the room (sim/interiors/range.js), its paper (sim/paper.js), the club's gun, and the
// gun's whole work as the engine has it (sim/firearms.js, sim/shooting.js: the draw, the check, the magazine in, the
// slide, the safety, the aim in the picture, the shot; a stoppage and the tap-rack; the magazine out, the chamber
// cleared; and the bench's work, sim/gunwork.js: the magazines filled from the box). Hale's lesson in it is
// sim/tutorial/range.js; without him, it's an evening on your own.
//   - **The desk** (T there): the book signed, and the club's gun handed over (RANGE_CITY: the city's, as RANGES has it:
//     Moscow's Makarov, London's club .22, a member's guest, handguns banned; Beirut's Glock; Cairo's CZ), empty, its
//     magazines empty beside it, a box of BOX_N; the gun a question till it's checked (known: false). Anything of your
//     own that shoots goes in the club's locker first (the locker: given back as you leave), so the club's is the gun
//     in your hands. Handed back at the desk, clear (no magazine in, nothing in the chamber), and the evening's over.
//   - **Dropped** (a fumble's: the gun out of your hand, a magazine out of your fingers): it lies DROP_BACK_S, and is
//     picked up for you, the gun put back where you carry it (nobody grabs for a falling gun).
//   - **The lane** (LANE, its booth): the bench (T there: its work, sim/gunwork.js ways(), the time skipped); the paper
//     at DISTANCES_M on their stands across the lane (sim/paper.js setPaper(): the city's kind, RANGE_CITY.paper); the
//     other lanes' paper, shot at before tonight (OTHERS).
//   - **Range safety**, watched every tick while a gun's in your hand: the muzzle never uprange (its way is your
//     heading: past UPRANGE_DEG off downrange, and the evening's stopped; past WARN_DEG a word first), never on a
//     person (aimed at anyone at all: stopped), never down another lane (aimed at another's paper: a word; fired at
//     it: stopped); a gun out of its holster stays in the booth (out of it, a word, and OUT_GRACE_S to put it away
//     before you're stopped); a round gone off unasked (a fumble's discharge, the bench's): stopped. Stopped, whoever
//     runs the place takes the gun, and that's the evening (sc.stop: why).
// A range is a room with a door: no passers-by, no police; its shots are what it's for (sim/shooting.js heard()). From
// a campaign (an assignment's context: the lesson booked, sim/campaign.js), the range is the one at C.at's door, and
// you're let out of that door after (sc.out: src/main.js backToPosting()).
import { at, dateText, clockText, TICK_MS } from '../clock.js';
import { heatKey } from '../heat.js';
import { say } from '../log.js';
import { handler, asOfficer, recruit, sheet, streetLook } from '../people.js';
import { haleStream } from '../hale.js';
import { stream, int, range as rnd } from '../rng.js';
import { planOf } from '../map/interior.js';
import { planHere, walkTo, spotNear, exitHere, SPOT_REACH_M } from '../interiors/use.js';
import { wayAcross } from '../interiors/path.js';
import { follow } from '../crowd.js';
import { newGun, newMag, armOf, isGun, isMag, modelOf, calWord, moveArm, MODELS } from '../firearms.js';
import { ways as tableWays, work as gunWork, LIVE_MAX_S } from '../gunwork.js';
import { discharge } from '../shooting.js';
import { setPaper, papers, group, isPaper } from '../paper.js';
import { CITIES, cityById, cityWords } from '../cities/index.js';
import { wrap, headOf } from '../perception.js';
import { skill } from '../skills.js';
import { skip } from '../game.js';
import { LOBBY_M, BOOTH_M, LANE_M, DISTANCES_M, RANGE_NAMES } from '../interiors/range.js';

export const LANE = 3;
export const UPRANGE_DEG = 100, WARN_DEG = 60, WARN_AGAIN_S = 20, OUT_GRACE_S = 8, DROP_BACK_S = 3;
export const BOX_N = 30;
// (the other lanes' paper: never at a distance of yours beside yours, so no two stand one over the other in the picture)
export const OTHERS = [{ lane: 1, m: 15 }, { lane: 2, m: 11 }, { lane: 4, m: 20 }, { lane: 5, m: 25 }];
// The city's range (sim/shops.js RANGES): its gun, its paper, who runs the desk, what it's called.
export const RANGE_CITY = {
  moscow: { gun: 'makarov', paper: 'chest', place: RANGE_NAMES.moscow, name: 'A TIR', ro: 'the instructor', sign: 'Your passport across the desk; the instructor copies it into the book, slowly, and pushes a pen at you.' },
  london: { gun: 'anschutz', paper: 'bull', place: RANGE_NAMES.london, name: 'THE RIFLE CLUB', ro: 'the range officer', sign: 'Your name in the guests\' book, a member\'s signature beside it, and the club\'s rules read out in a bored voice.' },
  beirut: { gun: 'glock17', paper: 'chest', place: RANGE_NAMES.beirut, name: 'THE RANGE', ro: 'the range officer', sign: 'Your passport, a form in French and Arabic, a signature, and a nod.' },
  cairo: { gun: 'cz75', paper: 'chest', place: RANGE_NAMES.cairo, name: 'THE SHOOTING CLUB', ro: 'the club\'s instructor', sign: 'The day pass, your passport photocopied in the back, a signature in a ledger older than you are.' },
};
export const rangeOf = (state) => RANGE_CITY[state.scenario.city] ?? RANGE_CITY.moscow;

const meOf = (state) => state.actors.find(a => a.who === state.player);
const whoActor = (state, who) => state.actors.find(a => a.who === who) ?? null;
const spots = (state) => (planHere(state) ?? planOf(state.map)).spots;
export const spotIn = (state, kind, lane = null) => spots(state).find(s => s.kind === kind && (lane === null || s.lane === lane)) ?? null;
/** The club's gun on you (its id), or null. */
export const clubGun = (state) => state.scenario.gun ?? null;
/** The club's gun's state, and its model. */
export const gunOf = (state) => { const id = clubGun(state), p = state.people[state.player]; return id ? { id, g: armOf(p, id), M: modelOf(id), p } : null; };
/** Whether the gun's clear: no magazine in it, nothing in the chamber, no jam. */
export const isClear = (g) => !!g && !g.mag && !g.chamber && !g.jam;
/** Your lane's paper at m (its actor). */
export const paperAt = (state, m) => papers(state).find(a => { const P = state.people[a.who].paper; return P.lane === LANE && P.m === m; }) ?? null;
/** The group at m: sim/paper.js group(). */
export const groupAt = (state, m) => { const a = paperAt(state, m); return a ? group(state.people[a.who].paper) : null; };
/** Whether actor a stands in your lane's booth (behind the line, between its dividers). */
export function inBooth(state, a) {
  const b = spotIn(state, 'bench', LANE);
  return !!a && !!b && a.x > b.x - BOOTH_M + 0.2 && a.x < b.x + 1 && Math.abs(a.z - b.z) < LANE_M / 2;
}
/** Where the muzzle points against downrange (+x), degrees: the heading of whoever holds it. */
export const muzzleOff = (a) => Math.abs(wrap(a?.head ?? 0)) * 180 / Math.PI;

export const rangeScenario = {
  name: 'At the range',
  about: 'An evening at a range: the club\'s gun from the desk, a lane, paper at 7, 15 and 25 m. Range safety, and what the hand can do.',
  again: { another: ['Again, another evening', 'Another evening at the range: new paper, new dice.'], same: ['Again, the same evening', 'The same lane; the dice fall as you shoot.'] },
  keys: [['instinct', 'what\'s at hand: the desk, the bench'], ['aim', 'the gun: shooting, time standing still (the mouse on the paper: aim, then fire)'], ['log', 'the log']],
  brief(state) {
    const R = rangeOf(state), M = MODELS[R.gun], K = cityById(state.scenario.city);
    return {
      title: `${R.name}: AN EVENING ON THE LANES`,
      body: [
        `${cap(R.place)}, ${K.name}: a door off the street, a desk, five lanes and the smell of it. ${R.place === 'the rifle club' ? 'Handguns have been banned here since 1997; a member\'s guest shoots a club .22.' : 'A visitor shoots the club\'s gun, under the club\'s eye.'}`,
        `At the desk, ${R.ro} signs out ${M.name}, its magazines and a box of ${calWord(M.cal)}. Lane ${LANE} is yours: the bench, and paper at 7, 15 and 25 metres.`,
        'The muzzle points downrange, always: never back up the range, never at a person, never down another lane. A gun out of its holster stays in the booth. Break any of it, and the evening\'s over.',
        `Hand it back at the desk clear: no magazine in, nothing in the chamber.`,
      ],
      footer: `${cap(R.place)}, ${K.name} · ${dateText(state.scenario.began)} · ${clockText(state.scenario.began)}`,
      keys: rangeScenario.keys,
    };
  },

  /** A lived job done at the bench (sim/game.js: busy's done 'scene:bench'): the bench's card again, if there's more. */
  afterBusy(state, bus, what) { const p = state.people[state.player]; if (what === 'bench' && benchWays(p).length) bus?.emit('bench', benchWays(p)); },

  setup(state, { campaign: C = null, city = null, lesson = null, character = null } = {}) {
    const r = state.rng, cityId = CITIES[C?.city ?? city] ? C?.city ?? city : 'moscow', R = RANGE_CITY[cityId];
    state.time.ms = C ? C.startMs : at(2026, 11, 5, 19, 30);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.country = C?.country ?? CITIES[cityId].country ?? 'ru';
    state.heat[heatKey('embassy', state.country)] = C?.heat ?? 20;
    const me = C ? { ...structuredClone(C.player), id: 'me' } : asOfficer(handler(r), character);
    state.people.me = me;
    state.player = 'me';
    // (the range behind the door: from a campaign, the posting's own, the same club every time; its seed only dresses it)
    state.map = { kind: 'interior', plan: 'range', seed: C ? C.mapSeed : int(r, 1e9), row: 0, i0: 0, i1: 0, crowd: 0, city: cityId };
    const plan = planOf(state.map), S = (kind, lane = null) => plan.spots.find(s => s.kind === kind && (lane === null || s.lane === lane));
    const actor = (who, s, face, ai = null, dx = 0, dz = 0) => { const a = { id: who === 'me' ? 'a0' : `a${state.nextActor++}`, who, seed: null, row: 0, x: s.x + dx, z: s.z + dz, vx: 0, vz: 0, face, head: headOf(face), gait: 'idle', stride: 0, stuck: 0, ai }; state.actors.push(a); return a; };
    actor('me', S('door'), 'up', null, 0.4, -0.5);
    // (whoever runs the desk, behind it; Hale, for a lesson, waiting by it: one man, his own dice, sim/hale.js, sixty-five now)
    const ro = sheet({ id: 'ro', name: R.ro, sex: 'm', cls: 'civilian', persistent: false, look: { ...streetLook(stream('range-ro', state.map.seed, cityId), 'm', 52), hat: undefined, carry: undefined, top: { kind: 'sweater', color: 0x356f42, trim: 0x24503a } } });
    state.people.ro = ro;
    actor('ro', S('ro'), 'down');
    if (lesson) {
      const h = recruit(haleStream(), { id: 'hale', cqc: [20, 3], os: 60, age: 65, instructor: true, sex: 'm' });
      h.name = `${h.name.split(' ')[0]} Hale`;
      h.look = { ...h.look, hair: { ...h.look.hair, color: 0xb8bdc8 }, top: { kind: 'jacket', color: 0x4c5262, trim: 0x353947 }, legs: 0x353947, shoes: 0x14151c };
      state.people.hale = h;
      actor('hale', S('desk'), 'left', { kind: 'range', speed: 1.25, steps: [], wait: 0 }, 1.1, 0.4);
    }
    // (the paper: yours fresh at each distance; the other lanes' shot at before you came)
    for (const m of DISTANCES_M) { const s = plan.spots.find(q => q.kind === 'stand' && q.lane === LANE && q.m === m); setPaper(state, { who: `paper${m}`, name: `the ${m} m target`, x: s.x, z: s.z, kind: R.paper, lane: LANE, m }); }
    for (const o of OTHERS) {
      const b = S('bench', o.lane), s = { x: b.x + o.m, z: b.z }, hr = stream('old-holes', state.map.seed, o.lane), n = 3 + int(hr, 6);
      const holes = Array.from({ length: n }, () => { const t = rnd(hr, 0, Math.PI * 2), d = rnd(hr, 0, R.paper === 'bull' ? 5 : 22); return [Math.round(Math.cos(t) * d * 10) / 10, Math.round(Math.sin(t) * d * 10) / 10]; });
      setPaper(state, { who: `lane${o.lane}`, name: `lane ${o.lane}'s target`, x: s.x, z: s.z, kind: R.paper, lane: o.lane, m: o.m, holes });
    }
    state.scenario = { kind: 'range', prompt: null, outcome: null, began: state.time.ms, city: cityId, gun: null, club: [], locker: null, warned: {}, stop: null,
      out: C?.at ? { row: C.at.row, x: C.at.x, z: C.at.z } : null, lesson: !!lesson, checked: false, filled: false, loaded: false, reloads: 0, cleared: 0, rounds: 0, back: false };
    const under = C?.at?.shop && C.at.shop !== 'range' ? `down the stairs under the ${C.at.shop === 'gym' ? 'gym' : 'club'}` : 'through a door off the street';   // (a range in a sports club's basement: sim/places.js rangeDoor())
    say(state, null, { kind: 'note', text: `${me.name}, ${cityById(cityId).name}: ${R.place}, ${under}. Ear defenders on a hook, the smell of solvent, and the flat bangs of someone's evening further down the lanes.` });
  },

  /** The instinct's line from the first moment (a new evening, or one loaded). */
  attach(state) { const me = meOf(state), p = state.people[state.player]; if (me && p && !state.scenario.outcome) state.scenario.prompt = instinct(state, me, p); },

  /** A lit room, small enough to take in whole: the view shows all of it. */
  aware() { return true; },
  place(state) { return `${cap(rangeOf(state).place)}, ${cityById(state.scenario.city).name}`; },

  act(state, bus, action) {
    const sc = state.scenario, me = meOf(state);
    if (sc.outcome || !me) return;
    if (action === 'instinct') return use(state, bus, sc.prompt?.act ?? null);
    if (String(action).startsWith('desk:table:')) return bench(state, bus, action.split(':').slice(2).join(':'));
  },

  /** Hale: by the desk while you're in the club room; at your shoulder, a step behind the booth, once you're through the range door. */
  think(state, a) {
    if (a.who !== 'hale') return;
    const me = meOf(state), goal = me && me.x > LOBBY_M + (planHere(state)?.ox ?? 0) - 0.2 ? spotIn(state, 'hale', LANE) : spotIn(state, 'lobby');
    const ai = a.ai, key = goal && `${goal.kind}:${goal.lane ?? ''}`;
    if (goal && ai.goal !== key) {
      ai.goal = key;
      const S = state.$world?.sections.get(0), way = S?.plan ? wayAcross(S, a.x, a.z, goal.x, goal.z) : null;
      ai.steps = [...(way ?? [[goal.x, goal.z]]).map(([x, z]) => ['go', x, z]), ['wait', 1, goal.face, 'idle']];
      ai.wait = 0;
    }
    if (ai.steps.length) { follow(state, a); return; }
    a.vx = a.vz = 0; a.gait = 'idle';
    // (at the line, watching your hands and the paper; in the club room, you)
    if (goal?.kind === 'hale') { a.face = 'right'; a.head = 0; }
    else if (me) { a.head = Math.atan2(me.z - a.z, me.x - a.x); a.face = Math.abs(wrap(a.head)) < Math.PI / 4 ? 'right' : Math.abs(wrap(a.head)) > 3 * Math.PI / 4 ? 'left' : a.head > 0 ? 'down' : 'up'; }
  },

  tick(state, bus) {
    const sc = state.scenario, me = meOf(state), p = state.people[state.player];
    if (sc.outcome || !me || !p) return;
    if (p.dead) return end(state, bus, 'dead');
    // (the walk to a spot ended: what it was for)
    if (sc.using && !me.busy) { const u = sc.using; sc.using = null; if (spotNear(state, me)?.kind === u.spot) use(state, bus, u.act, true); }
    if (exitHere(state, me)) {                                       // (out of the door: the club's gun stays at the desk, whatever you meant by it)
      if (sc.gun && !sc.back) say(state, bus, { kind: 'note', text: `${cap(rangeOf(state).ro)} has the club's gun off you at the door, and a look that says the evening's over.` });
      return end(state, bus, 'left');
    }
    pickedUp(state, bus, p);
    const G = gunOf(state);
    if (G?.g) {
      safety(state, bus, me, p, G);
      if (sc.outcome) return;
      // (the facts a lesson reads, as they happen: checked clear, loaded, a reload, a stoppage cleared)
      const g = G.g, M = G.M, worked = M.action === 'bolt' || M.action === 'pump';
      if (!sc.checked && g.known && isClear(g)) sc.checked = true;
      if (!sc.filled && sc.club.filter(isMag).every(id => (armOf(p, id)?.n ?? 0) > 0)) sc.filled = true;
      if (g.mag && g.chamber === 'live') sc.loaded = true;
      if (g.mag && sc.lastMag && g.mag !== sc.lastMag) sc.reloads++;
      if (g.mag) sc.lastMag = g.mag;
      const stuck = g.chamber === 'dud' || !!g.jam || (g.chamber === 'case' && !worked);
      if (stuck) { sc.stuck = true; if (g.chamber === 'dud' && sc.dummy && !sc.clicked) sc.clicked = state.time.ms; }   // (a coach's dummy, come up: sim/tutorial/range.js)
      else if (sc.stuck) { sc.stuck = false; sc.cleared++; }
      sc.clearNow = isClear(g);
    }
    sc.prompt = instinct(state, me, p);
  },

  result(state) {
    const sc = state.scenario, R = rangeOf(state), p = state.people[state.player];
    const groups = DISTANCES_M.map(m => [m, groupAt(state, m)]).filter(([, g]) => g?.shots);
    return {
      stamp: { done: 'HANDED BACK', early: 'HANDED BACK EARLY', stopped: 'STOPPED', left: 'LEFT', dead: 'DEAD' }[sc.outcome] ?? 'OVER',
      good: sc.outcome === 'done' || sc.outcome === 'early',
      title: `${R.name}: AN EVENING ON THE LANES`,
      text: sc.stop ? `${cap(R.ro)} takes the gun out of your hands: ${STOP_WORDS[sc.stop.why] ?? 'that\'s the evening over'}.` : sc.outcome === 'left' ? 'Out of the door, the gun left at the desk, the evening cut short.' : groups.length ? 'Paper, a lane, the noise through the ear defenders: an evening of it, and your hand a little surer.' : 'An evening at the range, and not much shooting done.',
      notes: groups.map(([m, g]) => `At ${m} m: ${g.score} of ${g.of}${g.xs ? `, ${g.xs} X` : ''}, ${g.hits} of ${g.shots} on the paper${g.hits > 1 ? `, in ${g.spreadCm} cm` : ''}.`),
      stats: `${Math.round(((sc.ended ?? state.time.ms) - sc.began) / 60000)} min · ${sc.rounds} rounds · Weapon handling ${skill(p, 'weapons')}`,
    };
  },
};

// Why the evening was stopped, as the result says it.
export const STOP_WORDS = { uprange: 'the muzzle came back up the range', person: 'you pointed it at a man', lane: 'you fired down another lane', discharge: 'a round went off you didn\'t mean', walk: 'you walked off the line with it in your hand' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** T, or a step's walk there ending: the desk (the gun out; back), the bench (its work). */
function use(state, bus, act, here = false) {
  const sc = state.scenario, me = meOf(state), p = state.people[state.player];
  if (!act || !me || state.fight || state.shoot) return;
  const s = act === 'desk' ? spotIn(state, 'desk') : act === 'bench' ? spotIn(state, 'bench', LANE) : null;
  if (!s) return;
  if (!here && Math.hypot(me.x - s.x, me.z - s.z) > SPOT_REACH_M) { walkTo(state, me, s); sc.using = { act, spot: s.kind }; return; }
  if (act === 'desk') return desk(state, bus, me, p);
  const list = benchWays(p);
  if (!list.length) return say(state, bus, { kind: 'instinct', text: 'Nothing for the bench to do: the magazines are full, the box is empty, or it\'s all in the gun.' });
  bus?.emit('bench', list);
}

/** At the desk: the club's gun signed out (your own in the locker first); or handed back, clear, and the evening's over. */
function desk(state, bus, me, p) {
  const sc = state.scenario, R = rangeOf(state);
  if (!sc.gun) {
    sc.locker = lockUp(p);
    const id = newGun(p, R.gun, { rounds: null, chamber: false, safety: true, known: false }), M = modelOf(id);
    const mags = [newMag(p, R.gun, 0), newMag(p, R.gun, 0)];
    (p.items ??= []).push(id, ...mags);
    p.rounds = { [M.cal]: BOX_N };
    sc.gun = id; sc.club = [id, ...mags]; sc.handed = state.time.ms;
    say(state, bus, { kind: 'note', text: `${R.sign}${sc.locker.n ? ` Your own goes in the club's locker, ${sc.locker.n === 1 ? 'the key' : 'its key'} on a ring round your finger.` : ''} Then ${M.name} across the desk, its magazines empty beside it, a box of ${calWord(M.cal)}. Ear defenders, glasses. Lane ${LANE}.` });
    return;
  }
  const G = gunOf(state);
  if (G && p.hand === G.id) return say(state, bus, { kind: 'instinct', text: 'Not in your hand across the room: holster it at the line first.' });
  if (G && !isClear(G.g)) return say(state, bus, { kind: 'instinct', text: `${cap(R.ro)} won't take it like that: clear it at the line first, no magazine in, nothing in the chamber.` });
  sc.back = true;
  end(state, bus, DISTANCES_M.every(m => groupAt(state, m)?.done) ? 'done' : 'early');
}

/** What's done at a range's bench (sim/gunwork.js ways()): the magazines, the gun loaded or unloaded; the club cleans its own guns, and its magazines. */
export const benchWays = (p) => tableWays(p).filter(w => !/^(clean|spring):/.test(w.key));

/** The bench's work chosen ('desk:table:<job>'): sim/gunwork.js, the time skipped; and the bench again, if there's more. */
function bench(state, bus, key) {
  const me = meOf(state), p = state.people[state.player];
  if (!me || spotNear(state, me)?.kind !== 'bench') return;
  const ms = gunWork(state, bus, p, key, { bang: (st, b, id) => { discharge(st, b, me, p, id, 'rack', { fired: true }); stop(st, b, 'discharge'); } });
  if (state.scenario.outcome) return;
  if (ms && ms <= LIVE_MAX_S * 1000) { me.busy = { what: 'bench', steps: [['wait', Math.round(ms / TICK_MS), me.face, 'idle']], wait: 0, done: 'scene:bench', since: state.time.ms }; me.vx = me.vz = 0; return; }   // (lived at the bench, the clock running: sim/game.js afterBusy)
  if (ms) skip(state, bus, ms);
  if (benchWays(p).length) bus?.emit('bench', benchWays(p));
}

/**
 * Range safety, each tick a gun's in your hand: the muzzle's way (uprange: stopped; off toward the side: a word), at a
 * person (stopped), down another lane (a word; fired: stopped), out of the booth with it (a word; beyond the club room's
 * door: stopped), a round gone off unasked (stopped). And the rounds fired, counted.
 */
function safety(state, bus, me, p, G) {
  const sc = state.scenario, sh = state.shoot, now = state.time.ms;
  if (me.$shot !== undefined && me.$shot !== sc.lastShot) {             // (a round fired: the trigger's, once a pull; or not the trigger's)
    sc.lastShot = me.$shot;
    if (sh?.doing?.what !== 'fire') return stop(state, bus, 'discharge');
    if (sh.doing.start !== sc.pullAt) { sc.pullAt = sh.doing.start; sc.rounds += sh.doing.rounds ?? 1; }
  }
  for (const a of papers(state)) {                                       // (another lane's paper, fired at)
    const P = state.people[a.who].paper;
    if (P.lane !== LANE && P.shots.some(s => !s.stray)) return stop(state, bus, 'lane');
  }
  if (p.hand !== G.id) { sc.outAt = null; return; }
  const at = sh?.aim?.key ?? (sh?.doing?.what === 'aim' ? sh.doing.key : null), T = at && state.actors.find(o => o.id === at);
  if (T && !isPaper(state, T)) return stop(state, bus, 'person');
  if (T && state.people[T.who].paper.lane !== LANE) warn(state, bus, 'lane', '"That\'s another lane\'s paper. Yours is three: only yours, ever."');
  const off = muzzleOff(me);
  if (off > UPRANGE_DEG) return stop(state, bus, 'uprange');
  if (off > WARN_DEG) warn(state, bus, 'muzzle', '"Muzzle downrange. Always downrange."');
  if (inBooth(state, me)) { sc.outAt = null; return; }
  sc.outAt ??= now;                                                      // (out of the booth with it: a word, and a moment to put it away)
  if (now - sc.outAt > OUT_GRACE_S * 1000) return stop(state, bus, 'walk');
  warn(state, bus, 'walk', '"Not out here. Put it away, and take it to the line: a gun comes out in the booth, nowhere else."');
}

/** A word from Hale (or, on your own, from whoever runs the place), once in WARN_AGAIN_S. */
function warn(state, bus, id, text) {
  const sc = state.scenario, now = state.time.ms, last = sc.warned[id];
  if (last !== undefined && now - last < WARN_AGAIN_S * 1000) return;
  sc.warned[id] = now;
  sc.warnings = (sc.warnings ?? 0) + 1;
  if (sc.lesson && state.tutor) hale(state, bus, text);
  else say(state, bus, { kind: 'note', text: `From the desk, over the speaker: ${text}` });
}

/** Hale, now, ahead of whatever he was going to say (the tutor's line: sim/tutorial/earpiece.js). */
function hale(state, bus, text) {
  const t = state.tutor;
  say(state, bus, { kind: 'radio', who: t?.who ?? 'Hale', via: 'beside you', text: cityWords(text, state.map?.city, state.time.ms) });
  if (t) t.busyUntil = state.time.ms + (t.waitMs ?? 0) + (3.5 + text.split(/\s+/).length * 0.33) * 1000;   // (his lines' clock: sim/tutorial/earpiece.js clockOf())
}

/** The evening stopped: whoever runs the place takes the gun (the reason, sc.stop), and that's it. */
export function stop(state, bus, why) {
  const sc = state.scenario;
  if (sc.outcome) return;
  sc.stop = { why, ms: state.time.ms };
  if (state.shoot) state.shoot = null;
  const me = meOf(state);
  if (me) { delete me.$aim; me.busy = null; }
  const R = rangeOf(state);
  if (sc.lesson && state.tutor) hale(state, bus, { uprange: '"Stop. Stop. Muzzle up the range: you\'ve just pointed it at me and everyone behind you. Give it here."', person: '"Stop. Never at a person. Not loaded, not unloaded, not for a joke. Give it here."',
    lane: '"Cease fire. That was someone else\'s lane. Give it here."', discharge: '"Cease fire. That one went off without you, and that\'s the end of the evening."', walk: '"Stop right there. You don\'t walk about with it out. Give it here."' }[why] ?? '"Stop. Give it here."');
  say(state, bus, { kind: 'note', text: `${cap(R.ro)} is out from behind the desk before it's over, and has the gun out of your hand: ${STOP_WORDS[why] ?? 'that\'s the evening'}.` });
  end(state, bus, 'stopped');
}

function end(state, bus, outcome) {
  const sc = state.scenario;
  if (sc.outcome) return;
  Object.assign(sc, { outcome, ended: state.time.ms, prompt: null });
  if (state.shoot) state.shoot = null;
  giveBack(state);
  bus?.emit('scenario-end', outcome);
}

/**
 * The club's things dropped (a fumble: the gun out of your hand, a magazine out of your fingers): left where they fell
 * DROP_BACK_S, then picked up for you (Hale; on your own, whoever runs the place), the gun put back where it's carried,
 * to be drawn again. Nobody grabs for a falling gun.
 */
function pickedUp(state, bus, p) {
  const sc = state.scenario, list = state.items?.dropped ?? [], now = state.time.ms;
  for (const it of list.filter(o => sc.club.includes(o.kind))) {
    it.$at ??= now;
    if (now - it.$at < DROP_BACK_S * 1000) continue;
    list.splice(list.indexOf(it), 1);
    moveArm(it, p, it.kind);
    (p.items ??= []).push(it.kind);
    const gun = isGun(it.kind), who = sc.lesson && state.people.hale ? 'Hale' : cap(rangeOf(state).ro);
    if (gun && sc.lesson && state.tutor) hale(state, bus, '"Never grab for a falling gun: let it fall. I\'ll get it." He checks it, and puts it back where you carry it.');
    else say(state, bus, { kind: 'note', text: `${who} picks ${gun ? 'the gun' : 'the magazine'} up off the floor, looks it over, and hands it back.` });
  }
}

/** What shoots of your own, into the club's locker (out of your hands and pockets, its states with it): { hand, items, arms, rounds, n }. */
function lockUp(p) {
  const own = (k) => isGun(k) || isMag(k);
  const L = { hand: own(p.hand) ? p.hand : null, items: (p.items ?? []).filter(own), arms: p.arms ?? {}, rounds: p.rounds ?? {}, nextArm: p.nextArm };
  L.n = [L.hand, ...L.items].filter(isGun).length;
  if (L.hand) p.hand = null;
  p.items = (p.items ?? []).filter(k => !own(k));
  p.arms = {};
  p.rounds = {};
  return L;
}
/** The club's things back to the club (wherever they are: in hand, pockets, on the floor), and the locker's to you. */
function giveBack(state) {
  const sc = state.scenario, p = state.people[state.player], club = new Set(sc.club);
  if (!sc.gun) return;
  if (club.has(p.hand)) p.hand = null;
  p.items = (p.items ?? []).filter(k => !club.has(k));
  if (p.bag) p.bag = p.bag.filter(x => !club.has(x.item));
  if (state.items?.dropped) state.items.dropped = state.items.dropped.filter(it => !club.has(it.kind));
  const L = sc.locker ?? { items: [], arms: {}, rounds: {} };
  p.arms = { ...L.arms };
  p.rounds = { ...L.rounds };
  if (!Object.keys(p.rounds).length) delete p.rounds;
  if (L.hand && !p.hand) p.hand = L.hand; else if (L.hand) p.items.push(L.hand);
  p.items.push(...L.items);
  sc.locker = null;
}

/** The instinct's line, each tick: where the desk and the lane are, what T does there. */
function instinct(state, me, p) {
  const sc = state.scenario, R = rangeOf(state), here = spotNear(state, me), G = gunOf(state), L = (id, tone, text, act = null) => ({ id, tone, text, act });
  const name = G?.M.short ?? MODELS[R.gun].short;
  if (!sc.gun) return here?.kind === 'desk' ? L('desk', 'note', `The desk. {instinct}: sign the book, and the club's ${name}.`, 'desk') : L('to-desk', 'calm', `The desk's where the guns are. {instinct}: there.`, 'desk');
  if (here?.kind === 'desk' && sc.rounds) return L('back', 'note', `The desk. {instinct}: the ${name} back, ${sc.clearNow ? 'clear' : 'once it\'s clear (at the line: no magazine in, nothing in the chamber)'}, and the evening's done.`, 'desk');
  if (sc.rounds && sc.clearNow && p.hand !== sc.gun) return L('to-back', 'note', `The ${name} clear and put away. {instinct}: back to the desk with it, and hand it in.`, 'desk');
  if (here?.kind === 'bench' && here.lane === LANE) return L('bench', 'note', `Lane ${LANE}'s bench. {instinct}: its work (the magazines, the box). {aim}: the gun, downrange.`, 'bench');
  if (here?.kind === 'bench') return L('not-lane', 'calm', `Lane ${here.lane}. Yours is ${LANE}.`, 'bench');
  if (inBooth(state, me)) return L('booth', 'calm', `Lane ${LANE}. {aim}: the gun; {instinct}: the bench.`, 'bench');
  return L('to-lane', 'calm', `Lane ${LANE}, through the range door, the booth at the line. {instinct}: there.`, 'bench');
}

/**
 * A coach's dummy round slipped into a magazine of yours that isn't in the gun (the fullest; or, none spare, the one
 * in it), a few rounds down (sim/firearms.js feed(): it comes up and clicks). Returns the magazine, or null.
 */
export function slipDummy(state) {
  const sc = state.scenario, p = state.people[state.player], G = gunOf(state);
  if (!G) return null;
  const spare = sc.club.filter(id => isMag(id) && id !== G.g.mag && (armOf(p, id)?.n ?? 0) >= 3).sort((a, b) => armOf(p, b).n - armOf(p, a).n)[0];
  const id = spare ?? (G.g.mag && (armOf(p, G.g.mag)?.n ?? 0) >= 3 ? G.g.mag : null);
  if (!id) return null;
  const m = armOf(p, id), r = stream('dummy', state.seed, id);
  m.dummy = Math.max(1, m.n - 1 - int(r, Math.min(3, m.n - 1)));      // (the second to the fourth round to come up after it's in)
  sc.dummy = { mag: id, ms: state.time.ms };
  return id;
}
