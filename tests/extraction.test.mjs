// The kinetic missions' frame and the extraction (sim/kinetic.js, sim/scenarios/extraction.js; DESIGN.md, The kinetic
// missions (0.2.0 candidates)). The frame: how often a deep posting tasks one (an asset compromised, the station's own), the
// word at a drop, read or never read, the reconnaissance; the scene, played by bots of different minds through the city's
// own streets and systems (straight to the car; by a safe house for other clothes; with a kit on them; with the disguise
// officer's face waiting), by city and by rung: how often it comes out, how long it takes, how it fails; and the fold back.
import { candidates, newCampaign, context, fold, pass, agenda } from '../src/sim/campaign.js';
import { task, debugMission, onBurned, daily, recce, opened, pendingOf, STATION_P, RESCUE_P } from '../src/sim/kinetic.js';
import { newGame, start, step, playerActor, newMap } from '../src/sim/game.js';
import { collect } from '../src/sim/dial.js';
import { outcomeWord } from '../src/sim/outcomes.js';
import { missionPlace } from '../src/sim/places.js';
import { supportOf } from '../src/sim/support.js';
import { DAY, HOUR, MIN } from '../src/sim/clock.js';
import { goTo, toward } from './bots.mjs';
import { here, MEET_M, recognise } from '../src/sim/scenarios/extraction.js';
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
  const stale = !k.route || k.row !== row || !k.to || k.to.row !== to.row || Math.hypot(k.to.x - to.x, k.to.z - to.z) > 2 || now - k.at > 4000;
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
  const P = pointAt(R, best.s + 1.5);
  if (P.row !== row) {                                               // (the lane's end: on through it, onto the next street)
    const j = R.pts.findIndex((q, i) => i > 0 && q.jump && R.pts[i - 1].row === row), A = R.pts[Math.max(0, j - 1)];
    return toward(me, A.x, A.z + (P.row < row ? -3 : 3), 0.05);
  }
  if (best.s + 0.3 >= R.length && row === to.row) return toward(me, to.x, to.z, 0.5);
  return toward(me, P.x, P.z, 0.05);
}

/** An extraction's scene, from the debug start (sim/kinetic.js debugMission()): { g, c, a }. kit: disguise kit uses on you; face: one waiting for them. */
export function scene(seed, { city = 'moscow', level = 'undercover', who = 'asset', kit = 0, face = false } = {}) {
  const { campaign: c, a } = debugMission({ seed, city, level, who, kit, face }, make);
  const g = newGame({ seed, scenario: 'extraction', campaign: c, context: context(c, a) });
  start(g, null);
  return { g, c, a };
}

/**
 * A bot's evening: to the bench (T), then (by mind) the nearest safe house first (T in, its choices, T out), then the car once
 * it's there (T). It strolls when they fall behind, waits for them when they're out of sight, runs after them when they
 * bolt (T at reach), steadies them when the instinct offers, and (fight) goes in at a man who has hold of them.
 */
export function play(g, { house = true, choices = ['clothes', 'kit'], fight = false, maxMin = 150, trace = 0 } = {}) {
  const sc = g.scenario, bus = { emit(k, v) { if (k === 'safehouse') bus.card = v; }, on() {} };
  for (let t = 0; t < 20 * 60 * maxMin && !sc.outcome; t++) {
    const me = playerActor(g), comp = g.actors.find(a => a.id === sc.comp);
    let input = {};
    if (g.fight?.phase === 'choose') input = { act: [['hit', 'grapple', 'guard'][t % 3]] };
    else if (sc.inside) {
      const ways = (bus.card ?? []).map(w => w.key), want = choices.map(k => (k === 'face' ? ways.find(w => w.startsWith('face:')) : ways.includes(k) ? k : null)).find(Boolean);
      bus.card = null;
      input = { act: [want ? `desk:safe:${want}` : 'desk:safe:out'] };
    } else if (sc.held && fight) {
      const h = g.actors.find(a => a.id === sc.held.by);
      input = h && Math.hypot(h.x - me.x, h.z - me.z) < 1.6 ? { act: [`interact:hit:${h.id}`] } : h ? walk(g, me, { row: h.row ?? g.map.row, x: h.x, z: h.z }) : {};
    } else if (sc.held) input = {};
    else if (atAct(g, me, comp, house)) input = { act: ['instinct'] };
    else if (sc.bolt && comp) input = { ...walk(g, me, { row: comp.row ?? g.map.row, x: comp.x, z: comp.z }), run: Math.hypot(comp.x - me.x, comp.z - me.z) > 6 };
    else if (sc.phase === 'wait') input = walk(g, me, { row: sc.at.row, x: sc.at.seats?.[1] ?? sc.at.x + 1.6, z: 14.6 });
    else {
      const left = house && !sc.used.length && sc.houses.length ? sc.houses.slice().sort((x, y) => Math.abs(x.row - g.map.row) - Math.abs(y.row - g.map.row))[0] : null;
      const to = left ? { row: left.row, x: left.x, z: -3.4 } : g.time.ms < sc.mission.outFrom - 2 * MIN && g.map.row === sc.out.row ? { row: sc.out.row, x: sc.out.x + 30, z: -2.6 } : { row: sc.out.row, x: sc.out.x, z: sc.out.z };
      const d = comp ? ((comp.row ?? g.map.row) === g.map.row ? Math.hypot(comp.x - me.x, comp.z - me.z) : 99) : 0;
      input = d > 12 && comp ? {} : walk(g, me, to);
      if (d > 3) input.slow = true;
    }
    step(g, input, bus);
    if (trace && t % (20 * trace) === 0) { const k = (W) => Object.entries(sc.opp).filter(([, w]) => w.knows).length; console.log(`      ${Math.round((g.time.ms - sc.began) / 1000)} s ${sc.phase} me r${g.map.row} ${me.x.toFixed(0)},${me.z.toFixed(1)} comp ${comp ? `r${comp.row ?? g.map.row} ${comp.x.toFixed(0)},${comp.z.toFixed(1)} ${comp.gait}${comp.hidden ? ' hidden' : ''} fo ${comp.ai.follow ? (comp.ai.follow.lost ? 'lost' : Math.round((g.time.ms - comp.ai.follow.seenMs) / 1000)) : '-'}` : '-'} fear ${Math.round(sc.fear)}${sc.bolt ? ' BOLT' : ''}${sc.held ? ' HELD' : ''} knows ${k()} p:${sc.prompt?.id} ${JSON.stringify(input).slice(0, 60)}`); }
  }
  return { outcome: sc.outcome ?? 'none', min: Math.round(((sc.ended ?? g.time.ms) - sc.began) / MIN), stats: sc.stats, linked: sc.linked, used: sc.used.length, dis: sc.dis, fear: Math.round(sc.fear) };
}

/** Whether T does something here, now (the scene's own reckoning: sim/scenarios/extraction.js here()). */
function atAct(g, me, comp, house) {
  const sc = g.scenario, k = here(g, me), dC = comp && (comp.row ?? g.map.row) === g.map.row ? Math.hypot(comp.x - me.x, comp.z - me.z) : 99;
  if (sc.phase === 'wait') return dC < MEET_M;
  if (sc.bolt) return dC <= 2;
  if (k.car) return g.time.ms >= sc.mission.outFrom && dC <= 3.5;
  if (k.house) return house && !sc.used.includes(k.house.id) && dC <= 3.5;
  return sc.prompt?.act === 'calm';
}

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
    name: 'extraction: the evening, by mind, by city and by rung: how often they come out, how long it takes, how it fails (bots on the city\'s own streets)',
    heavy: true,
    fn() {
      const MINDS = { straight: { house: false }, clothes: { house: true, choices: ['clothes'] }, kit: { house: true, choices: ['clothes', 'kit'], kit: 3 }, face: { house: true, choices: ['clothes', 'face'], face: true }, fights: { house: true, choices: ['clothes', 'kit'], kit: 3, fight: true } };
      const N = Number(process.env.EXTRACT_N ?? 6), rows = [];
      for (const level of ['undercover', 'illegal']) for (const city of ['moscow', 'beirut', 'cairo']) {
        const line = [];
        for (const [mind, M] of Object.entries(MINDS)) {
          const rs = Array.from({ length: N }, (_, i) => { const { g } = scene(300 + i, { city, level, kit: M.kit ?? 0, face: M.face }); return play(g, M); });
          rows.push({ level, city, mind, rs });
          line.push(`${mind} ${share(rs)}`);
        }
        console.log(`      ${level} ${city}: ${line.join(', ')} brought out`);
      }
      const all = rows.flatMap(r => r.rs), out = all.filter(r => r.outcome === 'out');
      const by = (f) => Object.entries(rows.reduce((o, r) => { (o[f(r)] ??= []).push(...r.rs); return o; }, {})).map(([k, rs]) => `${k} ${share(rs)}`).join(', ');
      console.log(`      by mind: ${by(r => r.mind)}`);
      console.log(`      by rung: ${by(r => r.level)}; by city: ${by(r => r.city)}`);
      console.log(`      how it ends: ${JSON.stringify(tally(all))}`);
      console.log(`      brought out: ${mean(out, r => r.min)} min on average (${Math.min(...out.map(r => r.min))}–${Math.max(...out.map(r => r.min))}); looked over ${mean(out, r => r.stats.looks)} times, known ${mean(out, r => r.stats.known)}; your face beside theirs ${out.filter(r => r.linked).length}/${out.length}`);
      console.log(`      failed: looked over ${mean(all.filter(r => r.outcome !== 'out'), r => r.stats.looks)} times, known ${mean(all.filter(r => r.outcome !== 'out'), r => r.stats.known)}; bolted ${mean(all, r => r.stats.bolts)} times an evening`);
      assert(all.every(r => r.outcome !== 'none'), 'every evening ends');
      // (a disguise's worth is per look, tested on its own above; over a whole evening the detour to the safe house costs time in
      // the open and the bench's post knows them whatever they wear, so the minds come out close: DESIGN.md, Measured)
      assert(Object.keys(tally(all)).length >= 2 && out.length > all.length * 0.2 && out.length < all.length * 0.9, 'not a foregone thing');
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
        let k = 0; for (let i = 0; i < 600; i++) if (recognise(g, a, W, comp, me, 6).ok) k++;
        return k / 600;
      };
      const clothes = (g, sc) => { const L = g.people.comp.look; g.people.comp.look = { ...L, top: { ...(L.top ?? {}), kind: 'coat', color: L.top?.color === 0x4a2a52 ? 0x2f6b62 : 0x4a2a52 } }; };
      const kit = (g, sc) => { clothes(g, sc); g.people.comp.disguise = { q: Math.round(kitQuality(g.people.me) * 0.85 * 100) / 100, was: {} }; };
      const face = (g, sc) => { clothes(g, sc); wearAdvanced(g.people.comp, { id: 'f', look: 'other', q: 0.62 }, 'sh0'); };
      const r = { bare: odds(() => {}), clothes: odds(clothes), kit: odds(kit), face: odds(face), cop: odds(() => {}, { cop: true }), illegalBare: odds(() => {}, { level: 'illegal' }), illegalKit: odds(kit, { level: 'illegal' }) };
      console.log(`      known at a look: bare ${fmt(r.bare * 100, 0)}%, other clothes ${fmt(r.clothes * 100, 0)}%, clothes and your kit ${fmt(r.kit * 100, 0)}%, clothes and a face ${fmt(r.face * 100, 0)}%; a patrol officer, bare, ${fmt(r.cop * 100, 0)}%; beside an illegal (Deception 20), bare ${fmt(r.illegalBare * 100, 0)}%, with the kit ${fmt(r.illegalKit * 100, 0)}%`);
      assert(r.bare > r.clothes + 0.05 && r.clothes > r.kit + 0.05 && r.clothes > r.face && r.cop < r.bare && r.illegalBare <= r.bare + 0.03, JSON.stringify(r));
    },
  },
];
