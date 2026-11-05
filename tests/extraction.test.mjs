// The kinetic missions' frame and the extraction (sim/kinetic.js, sim/scenarios/extraction.js; DESIGN.md, The kinetic
// missions (0.2.0 candidates)). The frame: how often a deep posting tasks one (an asset compromised, the station's own), the
// word at a drop, read or never read, the reconnaissance; the scene, played by bots of different minds through the city's
// own streets and systems (straight to the car; by a safe house for other clothes; with a kit on them; with the disguise
// officer's face waiting), by city and by rung: how often it comes out, how long it takes, how it fails; and the fold back.
import { candidates, newCampaign, context, fold, pass, agenda } from '../src/sim/campaign.js';
import { task, debugMission, onBurned, daily, recce, opened, guestFaces, STATION_P } from '../src/sim/kinetic.js';
import { newGame, start, step, playerActor, newMap, loadRow } from '../src/sim/game.js';
import { collect } from '../src/sim/dial.js';
import { outcomeWord } from '../src/sim/outcomes.js';
import { missionPlace } from '../src/sim/places.js';
import { supportOf } from '../src/sim/support.js';
import { DAY, HOUR, MIN } from '../src/sim/clock.js';
import { goTo, toward } from './bots.mjs';
import { Z } from '../src/sim/map/street.js';
import { extraction, here, recognise, addSearcher, MEET_M, FEAR_REST, FEAR_CLOSE, CAUGHT_FEAR, POST_RADIO_S, LOSE_S, LEAVE_S } from '../src/sim/scenarios/extraction.js';
import { waitingCar, carOf } from '../src/sim/traffic.js';
import { start as startHunt } from '../src/sim/hunt.js';
import { quality as kitQuality } from '../src/sim/disguise.js';
import { wearAdvanced } from '../src/sim/disguise.js';
import { routeFrom, pointAt } from '../src/sim/city.js';
import { townOf } from '../src/sim/cities/index.js';
import { assert, fmt } from './helpers.mjs';

const make = (seed, city, level) => newCampaign(seed, candidates(seed, city, level)[0], city, level);

/**
 * A bot's feet along the city's own ways (sim/city.js routeFrom(): the lines, the crossings, the lanes), so it walks where a
 * person would and never into a bench's back: the route planned again every few seconds or when the goal moves, steered a
 * step and a half ahead of where it is along it; a change of street, through the lane's end and on.
 */
export function walk(g, me, to) {
  const k = (me.bot ??= {}).ap ??= {}, now = g.time.ms, row = g.map.row ?? 0;
  // (planned again only when the goal's moved, the street's changed, or it's strayed off the way: a timer flipped it between two
  // crossings about as near, and it walked back and forth between them for the evening)
  const stale = !k.route || k.row !== row || !k.to || k.to.row !== to.row || Math.hypot(k.to.x - to.x, k.to.z - to.z) > 2 || k.off;
  if (stale) {
    try { k.route = routeFrom(townOf(g.map), { row, x: me.x, z: me.z }, to); } catch { k.route = null; }
    Object.assign(k, { row, to: { ...to }, at: now });
  }
  const R = k.route;
  if (!R) return goTo(g, me, to.row, to.x, to.z);
  let best = null;
  for (let j = 1; j < R.pts.length; j++) {
    const A = R.pts[j - 1], B = R.pts[j];
    if (A.row !== row || B.row !== row || B.jump) continue;
    const dx = B.x - A.x, dz = B.z - A.z, L2 = dx * dx + dz * dz, t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((me.x - A.x) * dx + (me.z - A.z) * dz) / L2)) : 0;
    const d = Math.hypot(A.x + dx * t - me.x, A.z + dz * t - me.z), at = R.cum[j - 1] + Math.sqrt(L2) * t;
    if (!best || d < best.d - 0.3 || (d < best.d + 0.3 && at > best.s)) best = { d, s: at };   // (of the stretches about as near, the furthest along: a route that starts back at the line isn't walked back to it)
  }
  if (!best) return goTo(g, me, to.row, to.x, to.z);
  k.off = best.d > 3;
  const P = pointAt(R, best.s + 1.5);
  if (P.row !== row) {                                               // (the lane's end: on through it, onto the next street)
    const j = R.pts.findIndex((q, i) => i > 0 && q.jump && R.pts[i - 1].row === row), A = R.pts[Math.max(0, j - 1)];
    return toward(me, A.x, A.z + (P.row < row ? -3 : 3), 0.05);
  }
  if (best.s + 0.3 >= R.length && row === to.row) return toward(me, to.x, to.z, 0.5);
  return toward(me, P.x, P.z, 0.05);
}

/** An extraction's scene, from the debug start (sim/kinetic.js debugMission()): { g, c, a }. kit: disguise kit uses on you; face: one waiting for them at the house it routes past; team: on you as it begins. */
export function scene(seed, { city = 'moscow', level = 'undercover', who = 'asset', kit = 0, face = false, team = 'none' } = {}) {
  const { campaign: c, a } = debugMission({ seed, city, level, who, kit, face, team }, make);
  const g = newGame({ seed, scenario: 'extraction', campaign: c, context: context(c, a) });
  start(g, null);
  return { g, c, a };
}

/**
 * A bot's evening, by its mind (MINDS):
 *   - careless (care false): to the bench, and straight on to the car at its own walk, whatever's behind;
 *   - careful: a team on it shaken first (shake: a taxi the long way round to the safe house's street); the bench (the danger
 *     signal when the instinct offers it, and the fallback); the safe house the mission routes past (its choices: other
 *     clothes, their face, the kit); strolling when they fall behind; a word when they're frightened; after them when they
 *     bolt; in at a man who has hold of them (fight); a taxi to the car's street (taxi), or on foot; T at the car.
 */
export const MINDS = {
  bare: { care: false, house: false },
  careful: { care: true, house: true, choices: ['clothes', 'face', 'kit'], face: true, kit: 3, shake: true },
  fights: { care: true, house: true, choices: ['clothes', 'face', 'kit'], face: true, kit: 3, shake: true, fight: true },
  kit: { care: true, house: true, choices: ['clothes', 'kit'], kit: 3, shake: true },
  taxi: { care: true, house: true, choices: ['clothes', 'face', 'kit'], face: true, kit: 3, shake: true, taxi: true },
  tailed: { care: true, house: true, choices: ['clothes', 'face', 'kit'], face: true, kit: 3, shake: false, team: 'covert' },
  shaken: { care: true, house: true, choices: ['clothes', 'face', 'kit'], face: true, kit: 3, shake: true, team: 'covert' },
};
export function play(g, { care = true, house = true, choices = ['clothes', 'kit'], fight = false, shake = false, taxi = false, maxMin = 150, trace = 0, each = null } = {}) {
  const sc = g.scenario, bus = { emit(k, v) { if (k === 'safehouse') bus.card = v; }, on() {} }, mem = { shook: false, rode: false };
  const via = () => sc.houses.find(h => h.id === sc.mission.via && !sc.used.includes(h.id)) ?? (sc.used.length ? null : sc.houses.slice().sort((x, y) => Math.abs(x.row - g.map.row) - Math.abs(y.row - g.map.row))[0]);
  for (let t = 0; t < 20 * 60 * maxMin && !sc.outcome; t++) {
    const me = playerActor(g), comp = g.actors.find(a => a.id === sc.comp), dC = comp && !comp.hidden && (comp.row ?? g.map.row) === g.map.row ? Math.hypot(comp.x - me.x, comp.z - me.z) : 99;
    let input = {};
    if (g.fight?.phase === 'choose') input = { act: [['hit', 'grapple', 'guard'][t % 3]] };
    else if (me.cab || sc.leaving || me.busy?.what === 'meet') input = {};
    else if (sc.inside) {
      // (each only if there's time for it and the walk to the car after: a face half an hour, the kit ten minutes)
      const ways = (bus.card ?? []).map(w => w.key), walkMin = Math.abs(sc.out.row - g.map.row) * 2.5 + 3, fits = (m) => g.time.ms + (m + walkMin) * MIN < sc.mission.outUntil - 2 * MIN;
      const want = choices.map(k => (k === 'face' ? (fits(30) ? ways.find(w => w.startsWith('face:')) : null) : ways.includes(k) && fits({ clothes: 5, kit: 10 }[k] ?? 0) ? k : null)).find(Boolean);
      bus.card = null;
      input = { act: [want ? `desk:safe:${want}` : 'desk:safe:out'] };
    } else if (sc.held && fight) {
      const h = g.actors.find(a => a.id === sc.held.by);
      input = h && Math.hypot(h.x - me.x, h.z - me.z) < 1.6 ? { act: [`interact:hit:${h.id}`] } : h ? { ...walk(g, me, { row: h.row ?? g.map.row, x: h.x, z: h.z }), run: true } : {};
    } else if (sc.held) input = {};
    else if (sc.bolt && comp) input = dC <= 2 ? { act: ['instinct'] } : { ...walk(g, me, { row: comp.row ?? g.map.row, x: comp.x, z: comp.z }), run: dC > 6 };
    else if (sc.phase === 'wait') {
      if (care && shake && sc.tail && !sc.tail.teamLost && !mem.shook) {        // (the team on it: a taxi the long way round, to the house's street)
        const h = via();
        if (Math.abs(me.z - Z.kerbN) < 0.6) { mem.shook = true; input = { act: [`taxi:${h ? h.id : 'off2'}:lose`] }; }
        else input = walk(g, me, { row: g.map.row, x: me.x, z: Z.kerbN - 0.3 });
      } else if (care && sc.prompt?.act === 'signal' && !sc.signalled) input = { act: ['instinct'] };
      else if (dC < MEET_M && !sc.arrive) input = { act: ['instinct'] };
      else if (care && (sc.arrive || comp?.hidden)) {                // (careful: off a way along the path till they're sat, to see the bench first)
        mem.side ??= Math.sign(me.x - sc.at.x) || 1;
        input = g.map.row === sc.at.row && Math.abs(me.x - (sc.at.x + mem.side * 12)) < 1.5 && Math.abs(me.z - 14.5) < 1 ? {} : walk(g, me, { row: sc.at.row, x: sc.at.x + mem.side * 12, z: 14.5 });
      } else input = walk(g, me, { row: sc.at.row, x: sc.at.seats?.[1] ?? sc.at.x + 1.6, z: 14.6 });
    } else {
      // (the safe house only if there's time to get there, change, and make the car after: else straight on)
      const k = here(g, me), v = house ? via() : null, rowsMin = (a, b) => Math.abs(a - b) * 2.5 + 3;
      const h = v && (sc.inside || g.time.ms + (rowsMin(g.map.row, v.row) + 5 + rowsMin(v.row, sc.out.row)) * MIN < sc.mission.outUntil - 2 * MIN) ? v : null;
      if (k.car && g.time.ms >= sc.mission.outFrom && sc.driver && dC <= 3.5) input = { act: ['instinct'] };
      else if (k.house && h && k.house.id === h.id && dC <= 3.5) input = { act: ['instinct'] };
      else if (care && sc.fear >= 65 && dC <= 4 && g.time.ms - sc.calmAt >= 30000) input = { act: ['instinct'] };
      else if (care && sc.prompt?.id === 'closing' && (mem.evaded ?? 0) < 2 && dC <= 4) {   // (one of theirs on them, and seen: a taxi, the two of you, the long way round)
        if (Math.abs(me.z - Z.kerbN) < 0.6) { mem.evaded = (mem.evaded ?? 0) + 1; input = { act: [`taxi:${h ? h.id : 'out'}:lose`] }; }
        else input = walk(g, me, { row: g.map.row, x: me.x, z: Z.kerbN - 0.3 });
      }
      else if (taxi && !mem.rode && !h && g.map.row !== sc.out.row && dC <= 2.5) {   // (a taxi to the car's street, them in with you)
        if (Math.abs(me.z - Z.kerbN) < 0.6) { mem.rode = true; input = { act: ['taxi:out'] }; }
        else input = walk(g, me, { row: g.map.row, x: me.x, z: Z.kerbN - 0.3 });
      } else {
        const to = h ? { row: h.row, x: h.x, z: -3.4 } : g.time.ms < sc.mission.outFrom - MIN && g.map.row === sc.out.row ? { row: sc.out.row, x: sc.out.x + 30, z: sc.out.z } : { row: sc.out.row, x: sc.out.x, z: sc.out.z };
        input = care && dC > 12 && dC < 99 ? {} : walk(g, me, to);
        if (care && dC > 3) input.slow = true;
      }
    }
    step(g, input, bus);
    if (each && t % 20 === 0) each(g);
    if (trace && t % (20 * trace) === 0) { const k = Object.entries(sc.opp).filter(([, w]) => w.knows).length; console.log(`      ${Math.round((g.time.ms - sc.began) / 1000)} s ${sc.phase} me r${g.map.row} ${me.x.toFixed(0)},${me.z.toFixed(1)} comp ${comp ? `r${comp.row ?? g.map.row} ${comp.x.toFixed(0)},${comp.z.toFixed(1)} ${comp.gait}${comp.hidden ? ' hidden' : ''}` : '-'} fear ${Math.round(sc.fear)}${sc.bolt ? ' BOLT' : ''}${sc.held ? ' HELD' : ''} knows ${k} team ${sc.tail ? (sc.tail.teamLost ? 'lost' : 'on') : '-'} p:${sc.prompt?.id} ${JSON.stringify(input).slice(0, 50)}`); }
  }
  return { outcome: sc.outcome ?? 'none', min: Math.round(((sc.ended ?? g.time.ms) - sc.began) / MIN), stats: sc.stats, linked: sc.linked, used: sc.used.length, dis: sc.dis, fear: Math.round(sc.fear), met: !!sc.metAt, signalled: sc.signalled, teamLost: sc.tail ? !!sc.tail.teamLost : null, posts: sc.mission.posts };
}

const compOf = (g) => g.actors.find(a => a.id === g.scenario.comp);
/** A cell's own street: no searchers, no posts, none coming. */
function quiet(g) {
  const sc = g.scenario;
  for (const id of Object.keys(sc.opp)) { g.actors = g.actors.filter(a => a.id !== id); delete sc.opp[id]; }
  sc.reinforced = 99;
}
/** One of theirs for a cell, put away streets off till it's placed: { a, W }. */
function addOne(g) {
  const sc = g.scenario, a = addSearcher(g, sc.opp, null, sc.mission, { row: (g.map.row ?? 0) + 6, x: 0 }, 50 + Object.keys(sc.opp).length);
  a.ai.route = null;
  return { a, W: sc.opp[a.id] };
}
/** Straight past the bench: met, them `gap` m behind you, a second on. */
function withThem(g, gap = 1.2) {
  const sc = g.scenario, me = playerActor(g), comp = compOf(g);
  Object.assign(sc, { phase: 'with', arrive: null, metAt: g.time.ms });
  Object.assign(comp, { hidden: false, row: g.map.row, x: me.x - gap, z: me.z, gait: 'idle' });
  comp.ai.sit = false;
  for (const W of Object.values(sc.opp)) if (W.kind === 'post' && W.at === 'pickup') { W.knows = null; W.watching = false; }
  step(g, {}, null);
  return { sc, me, comp };
}
/** A seed whose debug start has a man of theirs at the bench. */
function postSeed() { for (let seed = 300; seed < 400; seed++) if (debugMission({ seed, city: 'moscow' }, make).a?.mission.posts?.pickup) return seed; return null; }

const tally = (rs) => rs.reduce((o, r) => ((o[r.outcome] = (o[r.outcome] ?? 0) + 1), o), {});
const share = (rs, k = 'out') => `${rs.filter(r => r.outcome === k).length}/${rs.length}`;
const mean = (rs, f) => fmt(rs.reduce((s, r) => s + f(r), 0) / rs.length, 1);

export default [
  {
    name: 'kinetic: tasked only under a legend; an asset compromised brings the word to bring him out (rarer undercover); the word at a drop, the bench and the way out on the streets',
    fn() {
      const out = [];
      for (const level of ['handler', 'undercover', 'illegal']) {
        let tasked = 0, n = 0;
        for (let seed = 1; seed <= 40; seed++) {
          const c = make(seed, 'moscow', level), s = c.posting.assets[0];
          if (!s) continue;
          n++; s.burned = true;
          if (onBurned(c, s, c.posting.startMs + 8 * DAY)) tasked++;
        }
        out.push(`${level}: ${tasked}/${n} compromised assets get the word`);
        if (level === 'handler') assert(tasked === 0, 'never under official cover');
      }
      const c = make(9, 'moscow', 'undercover'), s = c.posting.assets[0];
      s.burned = true;
      let a = null;
      for (let k = 0; k < 20 && !a; k++) { delete s.rescue; a = task(c, 'extract', s, c.posting.startMs + (8 + k) * DAY); }
      const at = missionPlace(c, a), m = a.mission;
      assert(a.status === 'word' && c.signals.some(x => x.mission === a.id) && at?.kind === 'bench' && m.out.row !== at.row && s.rescue === a.id, `tasked: ${JSON.stringify({ status: a.status, at, out: m.out })}`);
      assert(!task(c, 'extract', null, a.from), 'one at a time');
      assert(!agenda(c, a.word.from).some(x => x.a.id === a.id), 'not on the schedule till read');
      opened(c, a.id, a.word.from + HOUR);
      assert(agenda(c, a.word.from + HOUR).some(x => x.a.id === a.id), 'on it once read');
      for (const o of out) console.log(`      ${o}`);
      console.log(`      the word: from ${new Date(a.word.from).toISOString().slice(5, 16)}; the bench ${at.label} at ${new Date(a.from).toISOString().slice(11, 16)}, ${(a.from - a.word.from) / HOUR} h on; the way out ${m.out.label}, ${Math.abs(m.out.row - at.row)} streets off, open ${(m.outUntil - m.outFrom) / MIN} min; ${m.searchers} searchers; posts ${JSON.stringify(m.posts)}`);
    },
  },
  {
    name: 'kinetic: the station\'s own business: a colleague\'s extraction tasked by day, rarer undercover (STATION_P), commoner as an illegal; never in a posting\'s first days',
    fn() {
      const out = [];
      for (const level of ['undercover', 'illegal']) {
        let n = 0, days = 0, first = [];
        for (let seed = 1; seed <= 12; seed++) {
          const c = make(seed, 'cairo', level), d0 = Math.floor(c.posting.startMs / DAY);
          for (let d = d0; d < d0 + 120; d++) { days++; const a = daily(c, d); if (a) { n++; first.push(d - d0); c.assignments = c.assignments.filter(x => x !== a); c.signals = []; c.done.push({ ...a, kind: 'extract', ended: d * DAY, status: 'done' }); } }
        }
        out.push(`${level}: ${n} in ${days} posting-days (one every ${fmt(days / Math.max(1, n), 0)} days; STATION_P ${fmt(1 / STATION_P[level], 0)}), the first on day ${Math.min(...first)}`);
        assert(Math.min(...first) >= 5, 'never in the first days');
      }
      for (const o of out) console.log(`      ${o}`);
    },
  },
  {
    name: 'extraction: the debug start: the bench, the companion on it, the searchers out, the car on the streets; the word T sits you down and they heel',
    fn() {
      const { g, a } = scene(11), sc = g.scenario, me = playerActor(g), comp = g.actors.find(x => x.id === sc.comp);
      assert(sc.phase === 'wait' && sc.arrive && comp.hidden && Object.values(sc.opp).filter(W => W.kind === 'searcher').length >= 3 && sc.out.row !== sc.at.row, `set up: ${JSON.stringify({ phase: sc.phase, arrive: sc.arrive, opp: Object.values(sc.opp).map(W => W.kind) })}`);
      for (let k = 0; k < 20 * 300 && sc.arrive; k++) step(g, {}, null);
      assert(!sc.arrive && comp.gait === 'sit' && !comp.hidden && Math.abs(comp.x - (sc.at.seats?.[0] ?? sc.at.x)) < 0.1, `come to the bench, and sat: ${comp.gait} at ${fmt(comp.x)}`);
      const sat = Math.round((g.time.ms - sc.began) / 1000);
      let t = 0;
      for (; t < 20 * 180 && sc.prompt?.act !== 'meet'; t++) step(g, walk(g, me, { row: sc.at.row, x: sc.at.seats?.[1] ?? sc.at.x + 1.6, z: 14.6 }), null);
      step(g, { act: ['instinct'] }, null);
      assert(sc.phase === 'with', `met: ${sc.prompt?.text}`);
      for (let k = 0; k < 20 * 40; k++) step(g, walk(g, me, { row: g.map.row, x: me.x + 30, z: 14.5 }), null);
      const d = Math.hypot(comp.x - me.x, comp.z - me.z);
      for (let k = 0; k < 20 * 30; k++) step(g, { ...walk(g, me, { row: g.map.row, x: me.x + 30, z: 14.5 }), slow: true }, null);
      const d2 = Math.hypot(comp.x - me.x, comp.z - me.z);
      assert(d > 3 && d < 15 && d2 < 4, `heeling: ${fmt(d)} m behind at your walk, ${fmt(d2)} m at a stroll`);
      console.log(`      sat on the bench ${sat} s in (${Math.round((sc.meetFrom - sc.began) / 1000)} s before its hour); met after ${fmt(t / 20, 0)} s more; 40 s of walking on, ${sc.call} ${fmt(d)} m behind (their pace ${comp.ai.speed} m/s), 30 s of a stroll and ${fmt(d2)} m; fear ${Math.round(sc.fear)}; the instinct: "${sc.prompt?.text}"`);
    },
  },
  {
    name: 'extraction: with them into a taxi (decided as you get in), onto a bus, down the metro, through a shop and out its back: inside with you is beside you (no fright, no bolt); left at the kerb, they\'re left',
    fn() {
      const out = [];
      // (a taxi that stopped for you: in at once, both of you; out beside you at the other end)
      const cab = (gap, seed = 21) => {
        const { g } = scene(seed); quiet(g); const { sc, me, comp } = withThem(g, gap);
        const c = waitingCar(g, me.x + 2);
        Object.assign(c.taxi, { held: false, plain: false, hail: { x: me.x, by: me.id }, stopped: g.time.ms });
        const f0 = sc.fear, row0 = g.map.row;
        step(g, { act: ['taxi:off2'] }, null);
        if (sc.outcome) return cab(gap, seed + 1);                   // (a driver who'd seen the evening news: TAXI_KNOWS; another evening)
        const boarded = { cab: !!me.cab, hidden: !!comp.hidden, rideWith: sc.rideWith, fear: Math.round(sc.fear - f0) };
        for (let k = 0; k < 20 * 30 && me.cab; k++) step(g, {}, null);
        step(g, {}, null);
        return { seed, boarded, moved: g.map.row !== row0, d: comp.hidden || comp.row !== g.map.row ? null : fmt(Math.hypot(comp.x - me.x, comp.z - me.z)), sc };
      };
      const both = cab(1.2), left = cab(16);
      assert(both.boarded.cab && both.boarded.hidden && both.boarded.rideWith && both.moved && both.d !== null && Number(both.d) < 2.5, `in together: ${JSON.stringify({ ...both, sc: undefined })}`);
      assert(left.boarded.cab && !left.boarded.hidden && !left.boarded.rideWith && left.boarded.fear >= 30, `left at the kerb: ${JSON.stringify({ ...left, sc: undefined })}`);
      out.push(`a taxi: in together (${both.d} m apart at the other end); from 16 m back, left at the kerb, fear +${left.boarded.fear}`);
      // (a bus, the metro: the rides' own hooks, as sim/buses.js and sim/metro.js call them; a minute aboard at fear 99)
      for (const [how, on, off] of [['bus', 'board', 'off'], ['metro', undefined, 'up']]) {
        const { g } = scene(22); quiet(g); const { sc, me, comp } = withThem(g), hook = how === 'bus' ? extraction.onBus : extraction.onMetro, to = { row: g.map.row, x: me.x };
        hook(g, null, to, on);
        sc.fear = 99;
        const hid = comp.hidden;
        for (let k = 0; k < 20 * 60; k++) step(g, {}, null);
        const f = Math.round(sc.fear), bolts = sc.stats.bolts;
        hook(g, null, to, off);
        assert(hid && !sc.bolt && bolts === 0 && f < 99 && !comp.hidden && Math.hypot(comp.x - me.x, comp.z - me.z) < 2, `${how}: ${JSON.stringify({ hid, f, bolts })}`);
        out.push(`${how}: aboard with you a minute at fear 99, ${f} after, no bolt`);
      }
      // (a shop: in with you; twenty seconds at its counter at fear 99; out by the front, and whoever had them has them still; by the back, he's waiting at the front for nothing)
      const shop = (way) => {
        const { g } = scene(23); quiet(g); const { sc, me, comp } = withThem(g), s = addOne(g);
        Object.assign(s.a, { row: g.map.row, x: me.x + 40, z: me.z }); Object.assign(s.W, { knows: g.time.ms, seen: { row: g.map.row, x: comp.x, z: comp.z, ms: g.time.ms } });
        extraction.onShop(g, null, 'in', 'front');
        sc.fear = 99;
        const inside = sc.inShop && comp.hidden;
        for (let k = 0; k < 20 * 20; k++) step(g, {}, null);
        const f = Math.round(sc.fear);
        extraction.onShop(g, null, 'out', way);
        return { inside, f, bolts: sc.stats.bolts, hidden: comp.hidden, knows: !!s.W.knows };
      };
      const front = shop('front'), back = shop('back');
      assert(front.inside && front.bolts === 0 && front.f < 99 && !front.hidden && front.knows && !back.knows, `a shop: ${JSON.stringify({ front, back })}`);
      out.push(`a shop: twenty seconds inside at fear 99, ${front.f} after, no bolt; out the front, he has them still; out the back, he's lost them`);
      for (const o of out) console.log(`      ${o}`);
    },
  },
  {
    name: 'extraction: their fear is what they can see: settled beside you whatever\'s out there (a hunt for you streets off); one of theirs coming at them in their sight frightens them; caught after a bolt, steadier; the word reaches them at your heel',
    fn() {
      const { g } = scene(24); quiet(g); const { sc, me, comp } = withThem(g);
      startHunt(g, null, { why: 'exfil', row: g.map.row + 3, x: me.x, who: true, wearing: true });   // (a hunt out, out of their sight)
      sc.fear = 60;
      for (let k = 0; k < 20 * 60; k++) step(g, { ...walk(g, me, { row: g.map.row, x: me.x + 40, z: me.z }), slow: true }, null);
      const settled = Math.round(sc.fear);
      assert(settled <= FEAR_REST + 2 && !sc.bolt, `beside you with a hunt out: fear ${settled}`);
      // (one of theirs closing on them, in their sight)
      const [id, W] = Object.entries(g.scenario.opp)[0] ?? [];
      const s = addOne(g), f0 = sc.fear;
      Object.assign(s.a, { row: g.map.row, x: comp.x + 11, z: comp.z }); Object.assign(s.W, { knows: g.time.ms, close: true, seen: { row: g.map.row, x: comp.x, z: comp.z, ms: g.time.ms } });
      comp.head = 0; comp.face = 'right'; s.a.head = Math.PI;
      for (let k = 0; k < 20 * 3; k++) step(g, {}, null);
      const rose = Math.round(sc.fear - f0);
      assert(rose >= FEAR_CLOSE, `one of theirs coming at them: fear +${rose}`);
      quiet(g);
      // (a bolt, caught: steadier a while, and no bolt however frightened)
      sc.bolt = { since: g.time.ms }; sc.fear = 100; comp.ai.route = null;
      Object.assign(comp, { x: me.x + 1, z: me.z });
      step(g, { act: ['instinct'] }, null);
      const caught = !sc.bolt && sc.steadyUntil > g.time.ms && sc.fear <= CAUGHT_FEAR;
      sc.fear = 99;
      for (let k = 0; k < 20 * 60; k++) step(g, {}, null);
      assert(caught && !sc.bolt && sc.stats.bolts === 0, `caught, then a minute at fear 99: ${JSON.stringify({ caught, bolt: !!sc.bolt })}`);
      // (the word, at your heel: 3 m back)
      sc.fear = 75; sc.calmAt = 0;
      Object.assign(comp, { x: me.x - 3, z: me.z });
      step(g, {}, null); for (let k = 0; k < 20; k++) step(g, {}, null);
      const offered = sc.prompt?.act === 'calm', f1 = sc.fear;
      step(g, { act: ['instinct'] }, null);
      assert(offered && sc.stats.calms === 1 && sc.fear < f1, `the word at 3 m: ${sc.prompt?.text}`);
      console.log(`      a minute beside you with a hunt out three streets off: fear 60 → ${settled}; one of theirs coming at them, 3 s: +${rose}; caught after a bolt: a minute at fear 99, no bolt; the word at 3 m: ${Math.round(f1)} → ${Math.round(sc.fear)}`);
    },
  },
  {
    name: 'extraction: theirs: the bench\'s post knows the face all along, goes after them when they get up, radios POST_RADIO_S on unless he\'s lost them first (a taxi); a patrol officer who lost them is the patrol\'s again; the danger signal sends them to the fallback',
    fn() {
      const seed = postSeed();
      // (met under his eyes, then on foot: he radios)
      const run = (taxi) => {
        const { g } = scene(seed), sc = g.scenario, me = playerActor(g), comp = compOf(g), [pid, P] = Object.entries(sc.opp).find(([, W]) => W.kind === 'post' && W.at === 'pickup');
        for (const [id, W] of Object.entries(sc.opp)) if (W.kind === 'searcher') { g.actors = g.actors.filter(a => a.id !== id); delete sc.opp[id]; }
        sc.reinforced = 99;
        for (let k = 0; k < 20 * 300 && sc.arrive; k++) step(g, {}, null);
        for (let k = 0; k < 20 * 3; k++) step(g, {}, null);
        const watched = P.watching && !!P.knows;
        for (let t = 0; t < 20 * 180 && sc.phase === 'wait'; t++) step(g, sc.prompt?.act === 'meet' ? { act: ['instinct'] } : walk(g, me, { row: sc.at.row, x: sc.at.seats?.[1] ?? sc.at.x + 1.6, z: 14.6 }), null);
        for (let t = 0; t < 20 * 90 && me.busy; t++) step(g, {}, null);
        for (let k = 0; k < 20 * 2; k++) step(g, {}, null);
        const after = { watching: P.watching, knows: !!P.knows, radioIn: P.radioAt ? Math.round((P.radioAt - g.time.ms) / 1000) : null };
        if (taxi) {
          for (let t = 0; t < 20 * 30 && Math.abs(me.z - Z.kerbS) > 0.8; t++) step(g, walk(g, me, { row: g.map.row, x: me.x, z: Z.kerbS + 0.4 }), null);
          step(g, { act: ['taxi:off2'] }, null);
        }
        for (let k = 0; k < 20 * (POST_RADIO_S + 10) && !sc.outcome; k++) step(g, taxi ? {} : { ...walk(g, me, { row: g.map.row, x: me.x + 40, z: me.z }), slow: true }, null);
        return { watched, after, radioed: !!sc.lastSeen && !P.radioAt, knows: !!P.knows, outcome: sc.outcome };
      };
      const walked = run(false), rode = run(true);
      assert(walked.watched && !walked.after.watching && walked.after.knows && walked.after.radioIn > 60 && walked.radioed, `walked on: ${JSON.stringify(walked)}`);
      assert(!rode.knows && !rode.radioed, `a taxi before he called it in: ${JSON.stringify(rode)}`);
      // (a patrol officer who knew them and lost them: back to his patrol)
      const { g } = scene(25); quiet(g, true); withThem(g);
      const s = addOne(g);
      s.a.cop = true; s.a.scene = 'extraction'; Object.assign(s.a, { row: g.map.row + 3 });
      Object.assign(s.W, { kind: 'cop', knows: g.time.ms - 100000, seen: { row: g.map.row, x: 0, z: 0, ms: g.time.ms - (LOSE_S + 5) * 1000 } });
      for (let k = 0; k < 40; k++) step(g, {}, null);
      assert(!s.a.scene && !s.W.knows && s.a.ai.route, `the officer: ${JSON.stringify({ scene: s.a.scene, knows: s.W.knows, route: !!s.a.ai.route })}`);
      // (the danger signal: a post you've made, them sat, you a dozen metres off: a hand to your hat; the fallback)
      const G2 = scene(seed).g, sc = G2.scenario, me = playerActor(G2), comp = compOf(G2), [pid] = Object.entries(sc.opp).find(([, W]) => W.kind === 'post' && W.at === 'pickup');
      sc.opp[pid].spotted = true;
      for (let k = 0; k < 20 * 300 && sc.arrive; k++) step(G2, {}, null);
      const at0 = sc.at, from0 = sc.meetFrom, out0 = sc.mission.outFrom, side = Math.sign(me.x - at0.x) || 1;
      for (let t = 0; t < 20 * 120 && sc.prompt?.act !== 'signal'; t++) step(G2, walk(G2, me, { row: at0.row, x: at0.x + side * 12, z: 14.5 }), null);
      const line = sc.prompt?.text;
      step(G2, { act: ['instinct'] }, null);
      for (let k = 0; k < 20 * 40; k++) step(G2, {}, null);
      const shift = Math.round((sc.meetFrom - from0) / MIN);
      assert(sc.signalled && sc.at !== at0 && shift >= 40 && Math.round((sc.mission.outFrom - out0) / MIN) === shift && !sc.opp[pid] && comp.hidden, `signalled: ${JSON.stringify({ line, signalled: sc.signalled, shift, post: !!sc.opp[pid], hidden: comp.hidden })}`);
      G2.time.ms = sc.arrive.at - 1000;
      for (let k = 0; k < 20 * 90 && sc.arrive; k++) step(G2, {}, null);
      assert(!sc.arrive && comp.gait === 'sit' && Math.abs(comp.x - (sc.at.seats?.[0] ?? sc.at.x)) < 0.2, `at the fallback: ${comp.gait} ${fmt(comp.x)} vs ${fmt(sc.at.x)}`);
      console.log(`      the bench's post (seed ${seed}): eyes on them while they sat; after the minute he goes after them, the radio in ${walked.after.radioIn} s, and walked on, it's called in; a taxi first, and he's lost them, nothing called in`);
      console.log(`      a patrol officer who lost them: the patrol's again; the signal ("${line}"): the fallback ${sc.at.label}, ${shift} min on, the car's hours with it; they sit down there`);
    },
  },
  {
    name: 'extraction: the team that was on you comes into the scene: picked up where you stand; one of them with your face to him and them beside you has you both; the car comes, takes them, and drives off',
    fn() {
      const { g } = scene(26, { team: 'covert' }), sc = g.scenario, me = playerActor(g);
      const crew = g.actors.filter(a => a.ai?.kind === 'watcher');
      assert(sc.tail && sc.tail.crew.length >= 2 && crew.length >= 1, `the team: ${JSON.stringify({ tail: !!sc.tail, crew: crew.length })}`);
      quiet(g); const { comp } = withThem(g);
      const w = crew[0];
      Object.assign(w, { row: g.map.row, x: me.x + 8, z: me.z, head: Math.PI, face: 'left' }); me.head = 0; me.face = 'right'; w.hidden = false;
      for (let k = 0; k < 20 * 3 && !sc.linked; k++) step(g, {}, null);
      assert(sc.linked, 'a watcher with your face to him, them beside you: linked');
      // (the car: its street, its hours; it pulls in, its driver by it; T with them beside you, and it drives off)
      const G2 = scene(27).g, s2 = G2.scenario; quiet(G2);
      const bus = { emit() {}, on() {} };
      const m2 = playerActor(G2); Object.assign(m2, { row: s2.out.row, x: s2.out.x - 0.5, z: s2.out.z });
      loadRow(G2, bus, s2.out.row, s2.out.x - 0.5);
      G2.time.ms = s2.mission.outFrom + MIN;
      const c2 = withThem(G2, 1).comp;
      for (let k = 0; k < 20 * 60 && !s2.driver; k++) step(G2, {}, null);
      const car = s2.car && carOf(G2, s2.car), driver = !!s2.driver;
      Object.assign(m2, { x: s2.out.x - 0.5, z: s2.out.z }); Object.assign(c2, { x: s2.out.x - 1.5, z: s2.out.z });
      step(G2, {}, null);
      step(G2, { act: ['instinct'] }, null);
      const x0 = car?.x;
      for (let k = 0; k < 20 * (LEAVE_S + 1) && !s2.outcome; k++) step(G2, {}, null);
      for (let k = 0; k < 20 * 2; k++) step(G2, {}, null);
      const moved = car ? Math.abs(car.x - x0) : 0;
      assert(car && driver && s2.outcome === 'out' && c2.hidden && moved > 2, `the car: ${JSON.stringify({ car: !!car, driver, outcome: s2.outcome, moved })}`);
      console.log(`      the team (${sc.tail.crew.length}) picked up on you; one with your face to him at 8 m, them beside you: linked; the car pulled in, ${sc.call ?? s2.call} in, and it drove ${fmt(moved)} m off before the end`);
    },
  },
  {
    name: 'extraction: one of theirs takes hold of them: the moment is offered only within reach of him, not from across the street; the line says close in',
    fn() {
      const { g } = scene(28); quiet(g, true); const { sc, me, comp } = withThem(g);
      g.$reflexes = true;
      const s = addOne(g);
      Object.assign(comp, { x: me.x + 8, z: me.z }); Object.assign(s.a, { row: g.map.row, x: comp.x + 1.5, z: comp.z });
      Object.assign(s.W, { knows: g.time.ms - 200000, close: true, seen: { row: g.map.row, x: comp.x, z: comp.z, ms: g.time.ms } });
      for (let k = 0; k < 20 * 4 && !sc.held; k++) step(g, {}, null);
      const far = { held: !!sc.held, reflex: !!g.$reflex, line: sc.prompt?.text };
      for (let k = 0; k < 20 * 8 && !g.$reflex; k++) step(g, walk(g, me, { row: g.map.row, x: s.a.x - 1, z: s.a.z }), null);
      assert(far.held && !far.reflex && /close in/.test(far.line) && g.$reflex?.why === 'held', `${JSON.stringify(far)}; then ${JSON.stringify(g.$reflex?.title)}`);
      console.log(`      held from 8 m off: no moment, the line "${far.line}"; within reach: "${g.$reflex.title}"`);
    },
  },
  {
    name: 'extraction: the words: instinct lines a clause, twelve words at most; keys and the card\'s buttons short; women theirs and ours said right; the brief lower-cases the service mid-sentence',
    fn() {
      const lines = new Set(), words = (t) => t.replace(/\{[a-z]+\}/g, 'K').split(/\s+/).filter(Boolean).length;
      for (const [seed, M] of [[300, MINDS.bare], [301, MINDS.careful]]) {
        const { g } = scene(seed, { kit: M.kit ?? 0, face: !!M.face });
        play(g, { ...M, each: (G) => { if (G.scenario.prompt?.text) lines.add(G.scenario.prompt.text); } });
      }
      const long = [...lines].filter(t => words(t) > 12);
      assert(!long.length, `long lines: ${long.join(' | ')}`);
      const keys = extraction.keys.filter(([, t]) => words(t) > 4);
      assert(!keys.length, `long keys: ${JSON.stringify(keys)}`);
      // (a woman of theirs, a woman of ours)
      const { g } = scene(29); quiet(g, true); const { sc, comp } = withThem(g);
      g.people.comp.sex = 'f';
      const s = addOne(g); g.people[s.a.who].sex = 'f'; g.people[s.a.who].skills.awareness = [24, 1];   // (a sharp one: she knows her at a look)
      Object.assign(s.a, { row: g.map.row, x: comp.x + 5, z: comp.z, head: Math.PI }); comp.head = 0;
      for (let k = 0; k < 20 * 30 && !s.W.knows; k++) { s.W.looked = 0; step(g, {}, null); }
      const said = g.log.filter(e => e.kind === 'roll' && /looks/.test(e.text ?? '')).map(e => e.text).at(-1) ?? '';
      assert(/\bshe\b/.test(said) && !/\bhe\b/.test(said) && /\bher\b/.test(said), `the look: "${said}"`);
      const B = context(...(() => { const D = debugMission({ seed: 7, city: 'moscow' }, make); return [D.campaign, D.a]; })()).brief.body.join(' ');
      assert(!/[a-z,] The FSB/.test(B) && /the FSB|The FSB/.test(B), `the brief: ${B.slice(0, 200)}`);
      console.log(`      ${lines.size} lines seen in two evenings, the longest ${Math.max(...[...lines].map(words))} words: "${[...lines].sort((x, y) => words(y) - words(x))[0]}"; a woman's look: "${said}"`);
    },
  },
  {
    name: 'extraction: played through to the fold, as the hub does it (sim/campaign.js fold() on the scene\'s own state): brought out, the asset gone from the network; taken, arrested',
    fn() {
      const outs = [];
      for (const [seed, M] of [[301, MINDS.careful], [302, MINDS.bare]]) {
        const { g, c, a } = scene(seed, { kit: M.kit ?? 0, face: !!M.face }), p = c.posting, s = p.assets.find(x => x.id === a.who);
        const r = play(g, M), intel0 = p.intelligence;
        const paper = fold(c, a, g.scenario, g.people[g.player], g.time.ms, Object.values(g.heat)[0]);
        const gone = s && !p.assets.includes(s), news = (c.after ?? []).map(x => x.title);
        if (r.outcome === 'out') assert(gone && p.intelligence > intel0 && /BROUGHT OUT/.test(paper.title), `out: ${paper.title}`);
        if (r.outcome === 'taken') assert(s?.arrested && news.some(t => /ARRESTED/.test(t)), `taken: ${JSON.stringify({ arrested: s?.arrested, news })}`);
        outs.push(`seed ${seed}, ${M === MINDS.bare ? 'bare' : 'careful'}: ${r.outcome} in ${r.min} min → "${paper.title}"${news.length ? `, then ${news.join(', ')}` : ''}`);
      }
      for (const o of outs) console.log(`      ${o}`);
    },
  },
  {
    name: 'kinetic: a pass of days never tasks what\'s over before you could act on it; an evening set aside for the word says so in the log; ?play= with no campaign makes one up',
    fn() {
      let checked = 0;
      for (let seed = 1; seed <= 30 && checked < 3; seed++) {
        const c = make(seed, 'cairo', 'illegal'), d0 = Math.floor(c.posting.startMs / DAY);
        for (let d = d0 + 6; d < d0 + 80; d++) {
          const C2 = structuredClone(c), a = daily(C2, d);
          if (!a) continue;
          const late = daily(structuredClone(c), d, a.from - HOUR);
          assert(!late, `tasked with its hour behind the pass: ${new Date(a.from).toISOString()}`);
          checked++; break;
        }
      }
      assert(checked >= 1, 'found a day to task');
      const g = newGame({ seed: 5, scenario: 'extraction' });
      start(g, null);
      for (let k = 0; k < 20 * 30; k++) step(g, {}, null);
      assert(g.scenario.kind === 'extraction' && g.campaign && g.assignment, '?play=extraction');
      console.log(`      ${checked} passes checked: nothing tasked with its hour behind it; ?play=extraction: ${g.scenario.call}, ${g.scenario.mission.companion.kind}`);
    },
  },
  {
    name: 'extraction: the evening by mind (bare: straight to the car; careful: a tail shaken, the danger signal when it\'s called for, the safe house on the way, other clothes and the face or the kit, at their pace), by rung and by whom; and in Beirut and Cairo',
    heavy: true,
    fn() {
      const N = Number(process.env.EXTRACT_N ?? 8), cells = [];
      const run = (mind, opts, seeds) => seeds.map(seed => { const M = MINDS[mind], { g } = scene(seed, { ...opts, kit: M.kit ?? 0, face: !!M.face, team: M.team ?? 'none' }); return play(g, M); });
      const seeds = (n) => Array.from({ length: n }, (_, i) => 300 + i);
      for (const level of ['undercover', 'illegal']) for (const who of ['asset', 'colleague']) {
        const line = [];
        for (const mind of ['bare', 'careful']) { const rs = run(mind, { level, who }, seeds(N)); cells.push({ level, who, mind, city: 'moscow', rs }); line.push(`${mind} ${share(rs)} ${JSON.stringify(tally(rs))}`); }
        console.log(`      Moscow, ${level}, ${who}: ${line.join('; ')}`);
      }
      for (const city of ['beirut', 'cairo']) {
        const line = [];
        for (const mind of ['bare', 'careful']) { const rs = run(mind, { city }, seeds(Math.ceil(N / 2))); cells.push({ level: 'undercover', who: 'asset', mind, city, rs }); line.push(`${mind} ${share(rs)}`); }
        console.log(`      ${city}, undercover, asset: ${line.join('; ')}`);
      }
      const tailed = run('tailed', {}, seeds(Math.ceil(N / 2))), shaken = run('shaken', {}, seeds(Math.ceil(N / 2)));
      console.log(`      a team on you at the bench: kept ${share(tailed)} (linked ${tailed.filter(r => r.linked).length}), shaken first by a taxi ${share(shaken)} (team lost ${shaken.filter(r => r.teamLost).length})`);
      const pool = (f) => cells.filter(f).flatMap(c => c.rs), rate = (rs) => rs.filter(r => r.outcome === 'out').length / rs.length, pct = (x) => `${Math.round(x * 100)}%`;
      const bare = pool(c => c.mind === 'bare'), careful = pool(c => c.mind === 'careful'), uc = pool(c => c.mind === 'careful' && c.level === 'undercover' && c.city === 'moscow'), il = pool(c => c.mind === 'careful' && c.level === 'illegal');
      const all = [...bare, ...careful, ...tailed, ...shaken], out = all.filter(r => r.outcome === 'out');
      console.log(`      bare ${pct(rate(bare))}, careful ${pct(rate(careful))}; careful undercover (Moscow) ${pct(rate(uc))}, careful illegal ${pct(rate(il))}; how it ends: ${JSON.stringify(tally(all))}`);
      console.log(`      brought out: ${mean(out, r => r.min)} min on average; looked over ${mean(out, r => r.stats.looks)} times, known ${mean(out, r => r.stats.known)}; phoned in ${mean(all, r => r.stats.tips ?? 0)} times an evening; bolted ${mean(all, r => r.stats.bolts)}; the danger signal ${all.filter(r => r.signalled).length} times`);
      // (no evening ends undecided, and none is the bot's failing: 'missed' would be the bot never reaching the bench)
      assert(all.every(r => r.outcome !== 'none') && !all.some(r => r.outcome === 'missed'), `every evening ends, and in the scene: ${JSON.stringify(tally(all))}`);
      assert(rate(careful) >= rate(bare) + 0.25, `careful play wins clearly more: ${pct(rate(careful))} vs ${pct(rate(bare))}`);
      assert(rate(il) < rate(uc), `an illegal's done-well below an undercover's: ${pct(rate(il))} vs ${pct(rate(uc))}`);
    },
  },
  {
    name: 'kinetic: in the hub, the word at its bench read (on the schedule now), the bench and the way out walked past (the recce), T at the bench in its hour begins it; never read, the asset is arrested',
    fn() {
      const bus = { said: [], papers: [], ran: [], emit(k, v) { if (k === 'papers') this.papers.push(...v); if (k === 'assignment') this.ran.push(v); if (k === 'log') this.said.push(v.text); }, on() {} };
      let c, a, s;
      for (let seed = 30; seed < 60 && !a; seed++) { c = make(seed, 'moscow', 'undercover'); s = c.posting.assets[0]; if (!s) continue; s.burned = true; a = task(c, 'extract', s, c.posting.startMs + 8 * DAY); }
      const p = c.posting, g = newGame({ seed: c.seed, scenario: 'campaign', campaign: c });
      start(g, null);
      for (const k of c.calls ?? []) k.done = 0;
      g.time.ms = a.word.from + HOUR; c.awake = g.time.ms - 2 * HOUR;
      for (let k = 0; k < 21; k++) step(g, {}, bus);
      const d = c.rung?.drops?.find(x => x.mission === a.id);
      assert(d && a.status === 'word', `the word at a drop: ${JSON.stringify({ d: !!d, status: a.status })}`);
      const said = collect(g, bus, d);
      assert(a.status === 'open' && bus.papers.some(x => x.title.includes('BRING HIM OUT')), `read: ${a.status}; ${bus.papers.map(x => x.title).join(', ')}`);
      // (walked past the bench the day before: the recce)
      const at = missionPlace(c, a), me = playerActor(g);
      Object.assign(me, { x: at.x - 20, z: -2.6 }); newMap(g, bus, { kind: 'street', seed: p.mapSeed, row: at.row, i0: null, i1: null, crowd: 1, city: p.city }, at.x - 20);
      for (let k = 0; k < 41; k++) step(g, {}, bus);
      assert(a.mission.recce.pickup, 'the bench looked over in passing');
      // (its hour, at the bench: T begins it)
      g.time.ms = a.from - 5 * MIN; me.x = at.x - 10;
      for (let k = 0; k < 41; k++) step(g, {}, bus);
      const line = g.scenario.prompt?.text;
      step(g, { act: ['instinct'] }, bus);
      assert(bus.ran.includes(a.id), `begun: "${line}"`);
      const ctx = context(c, a);
      assert(ctx.mission && ctx.at && ctx.houses.length && ctx.brief.title.startsWith('BRING'), 'its context');
      console.log(`      the paper: "${bus.papers.find(x => x.title.includes('BRING')).lines[0].slice(0, 120)}…"; read: ${said.slice(0, 60)}…; the recce: ${JSON.stringify(a.mission.recce.pickup)}; at the bench: "${line}"`);
      // (another, never read: by the drop's end the asset is arrested)
      let c2, a2;
      for (let seed = 60; seed < 90 && !a2; seed++) { c2 = make(seed, 'cairo', 'illegal'); const s2 = c2.posting.assets[0]; if (!s2) continue; s2.burned = true; a2 = task(c2, 'extract', s2, c2.posting.startMs + 8 * DAY); }
      const g2 = newGame({ seed: c2.seed, scenario: 'campaign', campaign: c2 }), bus2 = { papers: [], emit(k, v) { if (k === 'papers') this.papers.push(...v); }, on() {} };
      start(g2, null); g2.time.ms = a2.word.from + HOUR; for (let k = 0; k < 21; k++) step(g2, {}, bus2);
      g2.time.ms = a2.word.until + MIN; for (let k = 0; k < 21; k++) step(g2, {}, bus2);
      const s2 = c2.posting.assets.find(x => x.id === a2.who) ?? null;
      assert(a2.status === 'missed' && a2.outcome === 'unread' && bus2.papers.some(x => x.title.includes('ARRESTED')), `unread: ${a2.status} ${a2.outcome}; ${bus2.papers.map(x => x.title).join(', ')}`);
      console.log(`      never read (an illegal in Cairo): ${bus2.papers.find(x => x.title.includes('ARRESTED')).lines.join(' ')}`);
    },
  },
  {
    name: 'kinetic: folded back: brought out, the asset gone from the network, intelligence, support, the others\' trust; taken with your face beside his, heat up; the debrief\'s words',
    fn() {
      const out = [];
      for (const [o, linked] of [['out', false], ['out', true], ['taken', true], ['bolted', false], ['stranded', false]]) {
        const { campaign: c, a } = debugMission({ seed: 41, city: 'beirut', level: 'undercover' }, make), p = c.posting, s = p.assets.find(x => x.id === a.who);
        const intel0 = p.intelligence, heat0 = p.heat, S0 = supportOf(c).now, trust0 = p.assets.filter(x => x !== s).map(x => x.trust);
        if (s) p.support.now = Math.max(0, S0 - 20);
        const paper = fold(c, a, { outcome: o, linked }, c.character, a.from + HOUR, p.heat);
        const gone = !p.assets.includes(s), news = (c.after ?? []).map(x => x.title);
        if (o === 'out') assert(gone && p.intelligence === intel0 + 3 && supportOf(c).now > S0 - 20 && p.assets.every((x, i) => x.trust >= trust0[i]), `out: ${JSON.stringify({ gone, intel: p.intelligence - intel0 })}`);
        if (o === 'taken') assert(s.arrested && p.heat >= heat0 + 30 && news.some(t => t.includes('ARRESTED')), `taken: ${JSON.stringify({ arrested: s.arrested, heat: p.heat - heat0, news })}`);
        if (linked) assert(p.heat >= heat0 + 30, 'your face beside theirs: heat');
        out.push(`${o}${linked ? ' (linked)' : ''}: "${paper.title}"; intelligence +${p.intelligence - intel0}, heat +${p.heat - heat0}${news.length ? `, then ${news.join(', ')}` : ''}`);
      }
      for (const o of out) console.log(`      ${o}`);
      assert(outcomeWord('extract', 'out') === 'brought out', 'its words');
    },
  },
  {
    name: 'extraction: a look\'s odds (one of theirs 6 m off, at night, with you beside them): bare, other clothes, your kit on them, the disguise officer\'s face; a patrol officer\'s; by your Deception',
    fn() {
      const odds = (setup, { cop = false, level = 'undercover' } = {}) => {
        const { g } = scene(77, { level }), sc = g.scenario, comp = g.actors.find(a => a.id === sc.comp), me = playerActor(g);
        sc.phase = 'with'; sc.arrive = null;
        Object.assign(comp, { hidden: false, row: g.map.row, x: me.x + 1.2, z: me.z });
        const [id, W] = Object.entries(sc.opp).find(([, w]) => w.kind === 'searcher'), a = g.actors.find(x => x.id === id);
        Object.assign(a, { row: g.map.row, x: comp.x + 6, z: comp.z }); if (cop) a.cop = true;
        setup(g, sc, comp);
        let k = 0; for (let i = 0; i < 3000; i++) if (recognise(g, a, W, comp, me, 6).ok) k++;
        return k / 3000;
      };
      const clothes = (g, sc) => { const L = g.people.comp.look; g.people.comp.look = { ...L, top: { ...(L.top ?? {}), kind: 'coat', color: L.top?.color === 0x4a2a52 ? 0x2f6b62 : 0x4a2a52 } }; };
      const kit = (g, sc) => { clothes(g, sc); g.people.comp.disguise = { q: Math.round(kitQuality(g.people.me) * 0.85 * 100) / 100, was: {} }; };
      // (the disguise officer's face, as the station's leaves it, FACE_Q: sim/kinetic.js guestFaces(); the Center's, worse)
      const face = (level) => (g, sc) => { clothes(g, sc); const D = debugMission({ seed: 77, city: 'moscow', level }, make); wearAdvanced(g.people.comp, { ...guestFaces(D.campaign, D.a, 0)[0], look: 'other' }, 'sh0'); };
      const r = { bare: odds(() => {}), clothes: odds(clothes), kit: odds(kit), face: odds(face('undercover')), cop: odds(() => {}, { cop: true }), illegalFace: odds(face('illegal'), { level: 'illegal' }), illegalBare: odds(() => {}, { level: 'illegal' }) };
      console.log(`      known at a look: bare ${fmt(r.bare * 100, 0)}%, other clothes ${fmt(r.clothes * 100, 0)}%, clothes and your kit ${fmt(r.kit * 100, 0)}%, clothes and the station's face ${fmt(r.face * 100, 0)}%; a patrol officer, bare, ${fmt(r.cop * 100, 0)}%; an illegal's: bare ${fmt(r.illegalBare * 100, 0)}%, clothes and the Center's face ${fmt(r.illegalFace * 100, 0)}%`);
      assert(r.bare > r.clothes + 0.05 && r.clothes > r.kit + 0.05 && r.kit > r.face && r.cop < r.bare && r.illegalFace > r.face, JSON.stringify(r));
    },
  },
];
