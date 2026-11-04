// At the range (sim/scenarios/range.js, sim/paper.js, sim/tutorial/range.js): paper targets aimed at and hit through
// the engine's own shooting, scored by the roll; Hale's lesson played by a scripted shooter, every step ticked, no
// police, no blood, nobody running; range safety stopping it; a coach's dummy round that clicks and clears; and the
// lesson booked on a posting's streets, at a range's door, played inside, folded (Weapon handling practised, a little
// Tradecraft, the heat as it was) and let out of that door after.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { createBus } from '../src/sim/bus.js';
import { options } from '../src/sim/shooting.js';
import { newGun, newMag, armOf, fire, act, MODELS } from '../src/sim/firearms.js';
import { work } from '../src/sim/gunwork.js';
import { groupAt, gunOf, spotIn, LANE, RANGE_CITY } from '../src/sim/scenarios/range.js';
import { group } from '../src/sim/paper.js';
import { candidates, newCampaign, bookLessons, context, fold, lessonBook } from '../src/sim/campaign.js';
import { missionPlace, settle } from '../src/sim/places.js';
import { sectionOf } from '../src/sim/city.js';
import { townOf } from '../src/sim/cities/index.js';
import { calendar, stampText } from '../src/sim/clock.js';
import { heatKey } from '../src/sim/heat.js';
import { stream } from '../src/sim/rng.js';
import { shootRange, frameOf } from './rangebot.mjs';
import { assert, fmt } from './helpers.mjs';

// (the club's gun in hand at your lane's bench, loaded, the safety off: through the shooting steps, the magazine
// topped up between shots as the bench would, so only the hand's odds are counted)
function atTheLine(city, weapons, seed = 2) {
  const g = newGame({ seed, scenario: 'range', city }), bus = createBus();
  start(g, bus);
  const me = playerActor(g), p = g.people[g.player], frame = frameOf(g);
  p.skills.weapons = [weapons, 0];
  const S = (n = 1, input = {}) => { for (let i = 0; i < n; i++) step(g, { frame, ...input }, bus); };
  S(2); S(1, { act: ['instinct'] }); for (let i = 0; i < 2000 && (me.busy || g.scenario.using); i++) S(1);   // (the desk)
  const b = spotIn(g, 'bench', LANE);
  Object.assign(me, { x: b.x, z: b.z, face: 'right', head: 0, vx: 0, vz: 0 });
  const G = gunOf(g), M = G.M;
  for (const id of g.scenario.club.slice(1)) armOf(p, id).n = M.cap;
  const take = (key) => { S(1, { act: [`shoot:${key}`] }); for (let n = 0; n < 3000 && g.shoot?.phase === 'act'; n++) S(1); };
  S(1, { act: ['aim'] });
  return { g, me, p, S, take, M };
}
function shoot(L, m, n) {
  const { g, p, take, M } = L, a = g.actors.find(o => o.who === `paper${m}`), P = g.people[a.who].paper;
  for (let k = 0; P.shots.length < n && k < n * 3; k++) {
    const G = gunOf(g);
    if (!G?.g || g.scenario.outcome) break;
    if (p.hand !== G.id) { take('draw'); continue; }
    if (G.g.jam) { take('clear'); continue; }
    if (G.g.chamber === 'dud' || G.g.chamber === 'case') { take('rack'); continue; }
    if (!G.g.mag) { take('insertMag'); continue; }
    if (armOf(p, G.g.mag).n < 2) armOf(p, G.g.mag).n = M.cap;     // (the bench's work, done between)
    if (!G.g.chamber) { take(options(g).some(o => o.key === 'release') ? 'release' : 'rack'); continue; }
    if (M.safety === 'manual' && G.g.safety) { take('safety'); continue; }
    if (g.shoot?.aim?.key !== a.id) take(`aim:${a.id}`);
    take('fire');
  }
  const groups = [];
  for (let i = 0; i + 5 <= P.shots.length; i += 5) groups.push(group({ shots: P.shots.slice(i, i + 5) }));
  const hits = P.shots.filter(s => s.hit), score = hits.reduce((t, s) => t + s.score, 0);
  return { n: P.shots.length, hits: hits.length, perShot: score / Math.max(1, P.shots.length), spread: groups.filter(q => q.hits > 1).reduce((t, q) => t + q.spreadCm, 0) / Math.max(1, groups.filter(q => q.hits > 1).length) };
}

export default [
  {
    name: 'range: paper hit through the engine\'s own shot, scored by the roll; Weapon handling 6 against 18, at 7, 15 and 25 m (Moscow\'s Makarov, London\'s club .22)',
    fn() {
      const N = 40, out = [];
      for (const city of ['moscow', 'london']) {
        const row = {};
        for (const wh of [6, 18]) {
          const L = atTheLine(city, wh);
          row[wh] = Object.fromEntries([7, 15, 25].map(m => [m, shoot(L, m, N)]));
          assert(!L.g.scenario.outcome, `${city} ${wh}: still on the lanes (${L.g.scenario.outcome} ${JSON.stringify(L.g.scenario.stop)})`);
          assert(!L.g.decals?.length && !L.g.$shotBy && !L.g.$violent, `${city} ${wh}: no blood, nobody's calling it in`);
          for (const m of [7, 15, 25]) assert(row[wh][m].n === N, `${city} ${wh}: ${row[wh][m].n} rounds at ${m} m`);
        }
        const pct = (o) => `${fmt(100 * o.hits / o.n, 0)}% (${fmt(o.perShot, 1)} a round, groups ${fmt(o.spread, 0)} cm)`;
        out.push(`${city} (${MODELS[RANGE_CITY[city].gun].short}): ` + [7, 15, 25].map(m => `${m} m: WH 6 ${pct(row[6][m])}, WH 18 ${pct(row[18][m])}`).join('; '));
        assert(row[18][7].hits / N >= 0.85 && row[18][25].perShot > row[6][25].perShot + 1 && row[18][15].perShot >= row[6][15].perShot, `${city}: the trained hand the better, and further the more so`);
        assert(row[6][25].hits <= row[6][7].hits, `${city}: the weak hand worse at 25 than at 7`);
      }
      for (const l of out) console.log(`      ${l}`);
    },
  },
  {
    name: 'range: Hale\'s lesson played by a scripted shooter (Moscow, London, Beirut, Cairo): every step ticked, the groups in his debrief, no police, no blood, nothing written down',
    fn() {
      const out = [];
      for (const [city, seed] of [['moscow', 3], ['london', 5], ['beirut', 7], ['cairo', 9]]) {
        const g = newGame({ seed, lesson: 'range', city }), bus = createBus(), events = [];
        bus.on('log', (e) => { if (/police|ambulance|siren|scream/i.test(e.text ?? '')) events.push(e.text); });
        start(g, bus);
        const heat = g.heat[heatKey('embassy', g.country)];
        const r = shootRange(g, bus, { think: 20 });
        const done = g.tutor.steps.filter(s => s.done).map(s => s.id);
        const words = r.said.join(' ');
        assert(g.scenario.outcome === 'done' && done.length === g.tutor.steps.length, `${city}: ${g.scenario.outcome} ${JSON.stringify(g.scenario.stop)}; steps ${done.join(',')}`);
        assert(!g.tutor.errors?.length, `${city}: the script slipped: ${g.tutor.errors?.join('; ')}`);
        assert(!events.length && !g.decals?.length && !g.$shotBy && !g.$violent && g.heat[heatKey('embassy', g.country)] === heat && !g.actors.some(a => a.ai?.fled), `${city}: no police, no blood, nobody ran, the heat as it was (${events.join(' / ')})`);
        assert(/\d+ of 50/.test(words) && r.said.length >= 8, `${city}: Hale scores the groups (${r.said.length} lines)`);
        const p = g.people[g.player];
        assert(!(p.items ?? []).some(k => g.scenario.club.includes(k)) && !Object.keys(p.arms ?? {}).some(k => g.scenario.club.includes(k)), `${city}: the club's things handed back`);
        out.push(`${city} ${MODELS[RANGE_CITY[city].gun].short}, WH ${p.skills.weapons[0]}: ${[7, 15, 25].map(m => { const q = groupAt(g, m); return `${m} m ${q.score}/50 (${q.hits} on, ${q.spreadCm} cm)`; }).join(', ')}; ${g.scenario.rounds} rounds, ${g.scenario.reloads} reloads, ${g.scenario.cleared} stoppage cleared, ${r.said.length} lines from Hale, ${fmt((g.scenario.ended - g.scenario.began) / 60000, 1)} min`);
      }
      for (const l of out) console.log(`      ${l}`);
    },
  },
  {
    name: 'range: safety stops the lesson: the muzzle swept up the range; another lane\'s paper fired at; a gun pointed at Hale',
    fn() {
      const out = [];
      const run = (opts) => {
        const g = newGame({ seed: 4, lesson: 'range', city: 'moscow' }), bus = createBus(), said = [];
        bus.on('log', (e) => { if (e.kind === 'radio') said.push(e.text); });
        start(g, bus);
        shootRange(g, bus, { maxS: 400, ...opts });
        return { g, said };
      };
      const up = run({ turn: Math.PI });
      assert(up.g.scenario.outcome === 'stopped' && up.g.scenario.stop?.why === 'uprange' && !gunOf(up.g)?.g, `swept uprange: ${up.g.scenario.outcome} ${up.g.scenario.stop?.why}`);
      out.push(`uprange: "${up.said.at(-1)?.slice(0, 60)}…"`);
      const lane = run({ stray: 'lane2' });
      assert(lane.g.scenario.stop?.why === 'lane' && lane.said.some(t => /another lane/.test(t)), `another lane's paper: ${lane.g.scenario.stop?.why}; warned first: ${lane.said.some(t => /another lane/.test(t))}`);
      out.push(`another lane: warned, then "${lane.said.at(-1)?.slice(0, 40)}…"`);
      // (the gun out and loaded at the line, as the scripted shooter leaves it after its first group: now aimed at Hale)
      const g = newGame({ seed: 4, lesson: 'range', city: 'moscow' }), bus = createBus();
      start(g, bus);
      shootRange(g, bus, { order: [7], skip: ['unload'], maxS: 400 });
      if (!g.scenario.outcome) {
        const hale = g.actors.find(a => a.who === 'hale'), frame = frameOf(g);
        if (!g.shoot) step(g, { frame, act: ['aim'] }, bus);
        if (g.people.me.hand !== gunOf(g).id) { step(g, { frame, act: ['shoot:draw'] }, bus); for (let n = 0; n < 200 && g.shoot?.phase === 'act'; n++) step(g, { frame }, bus); }
        step(g, { frame, act: [`shoot:aim:${hale.id}`] }, bus);
        for (let n = 0; n < 60; n++) step(g, { frame }, bus);
      }
      assert(g.scenario.stop?.why === 'person', `aimed at Hale: ${g.scenario.outcome} ${g.scenario.stop?.why}`);
      out.push(`at Hale: ${g.scenario.stop.why}`);
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'range: a coach\'s dummy round in the magazine comes up, clicks, and taps and racks out; emptied at the table, it\'s no round for the box',
    fn() {
      const p = { id: 'me', skills: { weapons: [12, 0] } }, r = stream('dummy-test', 1);
      const id = newGun(p, 'makarov'), g = armOf(p, id), mag = armOf(p, g.mag);
      g.safety = false;
      mag.dummy = mag.n - 2;                                        // (the third round to come up: the chamber's, then two)
      const pulls = [];
      for (let k = 0; k < 6; k++) { const f = fire(r, p, id); pulls.push(f.fired ? 'bang' : f.why + (f.dummy ? '(dummy)' : '')); if (!f.fired) break; }
      assert(pulls.join() === 'bang,bang,bang,dud(dummy)' && g.chamber === 'dud', `the pulls: ${pulls.join(', ')}`);
      act(r, p, id, 'rack');
      assert(g.chamber === 'live' && !g.snap && fire(r, p, id).fired, 'tap, rack: a live one, and it fires');
      const q = { id: 'q', skills: { weapons: [15, 0] }, rounds: {} }, id2 = newGun(q, 'makarov'), m2 = armOf(q, armOf(q, id2).mag);
      m2.dummy = 3; (q.items ??= []).push(armOf(q, id2).mag); armOf(q, id2).mag = null;
      const before = m2.n;
      work({ rng: stream('table', 2), time: { ms: 0 }, log: [], player: 'q', people: { q } }, null, q, `empty:${q.items[0]}`);
      assert(m2.n === 0 && (q.rounds['9x18'] ?? 0) <= before - 1, `emptied: ${before} in it, ${q.rounds['9x18'] ?? 0} into the box`);
      console.log(`      a dummy three down: ${pulls.join(', ')}; racked, a live round; emptied at the table, ${q.rounds['9x18'] ?? 0} of ${before} to the box`);
    },
  },
  {
    name: 'range: booked like the others: at a range\'s door near the flat (or the range under a gym), an evening or a weekend afternoon; played inside on the posting\'s map, folded: Weapon handling practised, a little XP, the heat as it was, out of its door',
    fn() {
      const out = [];
      for (const [seed, city, level] of [[3, 'moscow', 'handler'], [4, 'london', 'junior'], [7, 'cairo', 'handler']]) {
        const c = newCampaign(seed, candidates(seed, city, level)[0], city, level), now = c.posting.startMs + 9 * 86400000 + 10 * 3600000;
        settle(c);
        const [a] = bookLessons(c, ['range'], now, false), k = calendar(a.from), hour = k.hour + k.minute / 60;
        assert(a && (k.weekday < 5 ? hour >= 18.75 : [14, 15.5, 17, 19.5].includes(hour)), `${city}: booked ${stampText(a.from)} (${k.weekday < 5 ? 'a working day' : 'a day off'})`);
        const at = missionPlace(c, a), town = townOf({ seed: c.posting.mapSeed, city: c.posting.city });
        const door = [-1, 0, 1].flatMap(d => sectionOf(town, at.row, Math.floor(at.x / 45) + d).doors).find(d => Math.abs(d.x - at.x) < 0.01);
        assert(at.kind === 'range' && door?.kind === 'shop' && ['range', 'gym', 'club'].includes(door.shop), `${city}: its place, ${at.label} (a ${door?.shop} door)`);
        a.me = { x: at.x + 2, z: at.z }; a.began = a.start;
        const g = newGame({ seed: 11, lesson: 'range', campaign: c, context: context(c, a) }), bus = createBus();
        start(g, bus);
        assert(g.map.kind === 'interior' && g.map.plan === 'range' && g.map.seed === c.posting.mapSeed && g.map.city === city && g.tutor, `${city}: the range's lanes, the posting's, Hale there`);
        shootRange(g, bus, { think: 10 });
        const heat = c.posting.heat, xp0 = c.character.xp ?? 0, pr0 = c.character.practice?.weapons ?? 0;
        const paper = fold(c, a, g.scenario, g.people[g.player], g.time.ms, 99);
        const pr1 = c.character.practice?.weapons ?? 0;
        assert(/^HALE'S EXERCISE: AT THE RANGE/.test(paper.title) && c.posting.heat === heat && (c.character.xp ?? 0) > xp0 && pr1 >= pr0 + 1, `${city}: folded "${paper.title}", heat ${heat} → ${c.posting.heat}, XP ${xp0} → ${c.character.xp}, practice ${pr0} → ${pr1}`);
        assert(g.scenario.out && g.scenario.out.row === at.row && g.scenario.out.x === at.x, `${city}: out of its door after (${JSON.stringify(g.scenario.out)})`);
        out.push(`${city}: ${stampText(a.from)}, ${at.label}; ${g.scenario.outcome}, ${fmt((c.character.xp ?? 0) - xp0, 1)} XP, Weapon handling practised ${fmt(pr0, 2)} → ${fmt(pr1, 2)}; "${paper.lines.slice(0, 2).join(' ')}"`);
      }
      assert(lessonBook('range').scene === 'range', 'in the book');
      for (const l of out) console.log(`      ${l}`);
    },
  },
];
