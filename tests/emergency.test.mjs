// The emergency services (sim/emergency.js): someone down in the street, seen, and it's called in; police and an
// ambulance in the country's minutes, your instinct's guess at how long by your Tradecraft; the paramedics work and
// carry them off, the police tape the place off for a day with an officer at it; seen at it, you're described, and
// an officer who sees you dressed so knows you, till you change.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { bullet } from '../src/sim/shooting.js';
import { MODELS } from '../src/sim/firearms.js';
import { etaOf, waiting, seenLook, markViolent, CORDON_H } from '../src/sim/emergency.js';
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
    name: 'emergency: seen at it, you\'re described: an officer who sees you dressed so knows you; a change of coat, and he doesn\'t',
    fn() {
      const w = scene();
      markViolent(w.g, w.me);
      while (!(w.g.calls ?? []).length) seconds(w, 1);
      const W = w.g.wanted, p = w.g.people[w.g.player];
      assert(W && W.look === seenLook(p.look), 'described as you are');
      // (an officer by you, looking at you)
      const c = w.g.calls[0]; c.at.police = w.g.time.ms + 15000; c.at.ambulance = w.g.time.ms + 1e9;
      const v = scene(); markViolent(v.g, v.me); while (!(v.g.calls ?? []).length) seconds(v, 1);
      v.g.people[v.g.player].look = { ...v.g.people[v.g.player].look, top: { kind: 'coat', color: 0x123456 } };   // (another coat)
      for (let s = 0; s < 120 && !w.g.$alarm; s++) seconds(w, 1);
      const vc = v.g.calls[0]; vc.at.police = v.g.time.ms + 15000; vc.at.ambulance = v.g.time.ms + 1e9;
      for (let s = 0; s < 120; s++) seconds(v, 1);
      assert(w.g.$alarm && !v.g.$alarm, `known: ${!!w.g.$alarm}; in another coat: ${!!v.g.$alarm}`);
      console.log(`      described: ${W.look}; the officers who came knew you (${w.log.find(l => /description/.test(l)) ?? '?'}); in another coat, they didn't`);
    },
  },
];
