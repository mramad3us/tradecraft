// The emergency services (sim/emergency.js): someone down in the street, seen, and it's called in; police and an
// ambulance in the country's minutes, your instinct's guess at how long by your Tradecraft; the paramedics work and
// carry them off, the police tape the place off for a day with an officer at it; seen at it, you're described, and
// an officer who sees you dressed so knows you, till you change.
import { newGame, start, step, playerActor, loadRow, newMap, skip } from '../src/sim/game.js';
import { MIN } from '../src/sim/clock.js';
import { bullet } from '../src/sim/shooting.js';
import { MODELS } from '../src/sim/firearms.js';
import { etaOf, waiting, seenLook, markViolent, CORDON_H } from '../src/sim/emergency.js';
import { wearOf, faceP } from '../src/sim/hunt.js';
import { policeOf } from '../src/sim/countries/index.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon, and someone shot down near you, people about)
function scene(city = 'moscow', seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city, hour: 12, weather: 'clear' }), log = [];
  const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); }, on() {} };
  start(g, bus);
  for (let t = 0; t < 40; t++) step(g, {}, bus);
  const me = playerActor(g);
  const a = g.actors.filter(x => x !== me && x.ai && !x.cop && !x.hidden && (x.row ?? g.map.row) === (me.row ?? g.map.row)).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z))[0];
  Object.assign(a, { x: me.x + 6, z: me.z });
  bullet(g, bus, a, 'torso', MODELS.makarov, me);
  return { g, bus, log, me, a, p: g.people[a.who] };
}
const seconds = (w, n) => { for (let t = 0; t < 20 * n; t++) step(w.g, {}, w.bus); };

export default [
  {
    name: 'emergency: someone shot down and seen: it\'s called in; police and an ambulance due in the city\'s minutes; your guess at how long, by your Tradecraft',
    fn() {
      const rows = [];
      for (const city of ['moscow', 'london']) {
        const w = scene(city);
        let n = 0; while (!(w.g.calls ?? []).length && n++ < 120) seconds(w, 1);
        const c = w.g.calls?.[0];
        assert(c, `${city}: called in within two minutes`);
        const mins = (k) => (c.at[k] - c.ms) / 60000, E = policeOf(w.g.map).ems;
        assert(mins('police') >= E.police[0] && mins('police') <= E.police[1] && mins('ambulance') >= E.ambulance[0] && mins('ambulance') <= E.ambulance[1], `${city}: in its minutes`);
        rows.push(`${city}: called after ${n} s; police ${fmt(mins('police'), 1)} min, ambulance ${fmt(mins('ambulance'), 1)} min`);
      }
      // (the guess: a Tradecraft 95 to the minute, a 20's in words)
      const w = scene();
      while (!(w.g.calls ?? []).length) seconds(w, 1);
      const c = w.g.calls[0]; c.known = true;
      const p = w.g.people[w.g.player];
      p.os = 95; const sharp = etaOf(w.g, c).map(e => `${e.word} ${e.text}`).join(', ');
      p.os = 20; const vague = etaOf(w.g, c).map(e => `${e.word} ${e.text}`).join(', ');
      assert(/\d+ min/.test(sharp) && !/\d/.test(vague), `the guess: ${sharp} / ${vague}`);
      console.log(`      ${rows.join('; ')}; the guess at Tradecraft 95: ${sharp}; at 20: ${vague}; the watch: ${JSON.stringify(waiting(w.g)?.map(e => e.text))}`);
    },
  },
  {
    name: 'emergency: they come: the ambulance pulls up, the paramedics work and carry them off; the police tape it off, an officer posted for a day',
    fn() {
      const w = scene();
      while (!(w.g.calls ?? []).length) seconds(w, 1);
      const c = w.g.calls[0], now = w.g.time.ms;
      c.at.ambulance = now + 20000; c.at.police = now + 25000;           // (sooner, for the test: the minutes are the test above's)
      const seen = { car: false, working: false };
      for (let s = 0; s < 600 && !(c.ambulance.stage === 'done' && c.police.stage === 'done'); s++) {
        seconds(w, 1);
        if (w.g.traffic?.cars?.some(x => x.ems)) seen.car = true;
        if (c.ambulance.stage === 'working') seen.working = true;
      }
      const tape = (w.g.cordons ?? [])[0], post = w.g.actors.find(a => a.ai?.posted);
      assert(seen.car && seen.working && c.ambulance.stage === 'done', `the ambulance: ${JSON.stringify(seen)} ${c.ambulance.stage}`);
      assert(!w.g.actors.includes(w.a) && w.p.hospital, 'carried off, in hospital');
      assert(tape && Math.abs(tape.until - tape.id.slice(4) - CORDON_H * 3600000) < 1000 && post, `taped off a day, an officer posted (${!!post})`);
      console.log(`      the ambulance came, worked, carried them off; the tape up for ${CORDON_H} h, an officer at it; ${w.log.filter(l => /paramedic|stretcher|tape/.test(l)).join(' | ')}`);
    },
  },
  {
    name: 'emergency: shots fired and nobody hit: a passer-by who heard them calls the police (the police alone, to where the shots were), and the hunt for the gunman begins (the user, 2026-11-04)',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' }), log = [];
      const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); }, on() {} };
      start(g, bus);
      for (let t = 0; t < 40; t++) step(g, {}, bus);
      const me = playerActor(g);
      g.$shotBy = { ms: g.time.ms, x: me.x, z: me.z };
      let n = 0;
      for (; n < 60 && !(g.calls ?? []).length; n++) for (let t = 0; t < 20; t++) step(g, {}, bus);
      const c = (g.calls ?? [])[0], H = g.hunt;
      assert(c && c.shots && !c.who.length && c.ambulance.stage === 'done' && c.police.stage !== 'done' && H?.why === 'shots', `call ${JSON.stringify(c && { shots: c.shots, who: c.who, amb: c.ambulance.stage, pol: c.police.stage })}; the hunt ${H?.why}`);
      console.log(`      called in ${n} s after the shot: the police in ${fmt((c.at.police - c.ms) / 60000, 1)} min, no ambulance; the hunt: ${H.what}, your face ${H.who.known ? 'described' : 'not'}, your clothes ${H.wearing.known ? 'described' : 'not'}`);
    },
  },
  {
    name: 'emergency: seen at it, you\'re described: the call starts the hunt for you, as bad as its casualties (here someone shot), with what the caller had (your clothes; your face by how near and how lit)',
    fn() {
      const w = scene();
      markViolent(w.g, w.me);
      while (!(w.g.calls ?? []).length) seconds(w, 1);
      const H = w.g.hunt, p = w.g.people[w.g.player], V = w.g.$violent;
      assert(H && H.why === 'wounded' && H.where.row === (w.g.map.row ?? 0) && Math.abs(H.where.x - V.x) < 0.01 && H.wearing.known === (H.wearing.look === wearOf(p)) && H.next >= w.g.calls[0].at.police - 1, `the hunt: ${JSON.stringify(H && { why: H.why, who: H.who.known, wearing: H.wearing.known })}`);
      const out = [0.5, 3, 7, 12, 20].map(d => `${d} m ${Math.round(faceP(d, 1) * 100)}%`).join(', '), dark = Math.round(faceP(3, 0.1) * 100);
      console.log(`      ${H.what}: the caller ${fmt(V.d, 1)} m off; your clothes ${H.wearing.known ? 'described' : 'not'}, your face ${H.who.known ? 'described' : 'not'}; a caller's chance of your face by day: ${out}; 3 m in the dark ${dark}%`);
    },
  },
  {
    name: 'emergency: the shot stay where they fell: a street on and back, a shop and out, ten minutes gone by, and they\'re there; left to it, found and called in, and taken when it\'s done (the user, 2026-11-04)',
    fn() {
      const w = scene('london'), row = w.g.map.row ?? 0, here = () => w.g.actors.some(a => a.id === w.a.id && (a.row ?? w.g.map.row) === row);
      seconds(w, 2);
      const t0 = here();
      loadRow(w.g, w.bus, row + 1, w.me.x, { quiet: true }); seconds(w, 20);
      loadRow(w.g, w.bus, row, w.me.x, { quiet: true }); seconds(w, 2);
      const t1 = here();
      const street = { ...w.g.map };
      newMap(w.g, w.bus, { kind: 'shop', seed: 1, row }, 0); newMap(w.g, w.bus, street, w.me.x); seconds(w, 2);
      const t2 = here();
      skip(w.g, w.bus, 10 * MIN); seconds(w, 2);
      const t3 = here();
      // (a street on, and away for an hour: found if nobody had called, the call played out off it, and taken)
      loadRow(w.g, w.bus, row + 2, w.me.x, { quiet: true });
      for (let m = 0; m < 70; m++) { w.g.time.ms += MIN; seconds(w, 1); }
      const gone = !w.g.actors.some(a => a.id === w.a.id), call = (w.g.calls ?? []).find(c => c.who.includes(w.a.id));
      console.log(`      lying there: at first ${t0}; a street on and back ${t1}; into a shop and out ${t2}; ten minutes skipped ${t3}; an hour off the street: the call ${call ? (call.done ? 'done' : 'not done') : 'none'}, taken ${gone}`);
      assert(t0 && t1 && t2 && t3 && gone && call?.done, JSON.stringify({ t0, t1, t2, t3, gone, call: !!call }));
    },
  },
];
