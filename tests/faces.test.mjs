// Advanced disguises (sim/disguise.js LOOKS; DESIGN.md, Cover, heat and the hunt: Disguise): a change of face, age and build made by the agency's disguise
// officer (from a handler's posting on, one with a network to run), kept at a safe house, put on there; the description the hunt
// has isn't yours while it's on; a good eye reads through it, the better the disguise the rarer; taken off at its safe house it's
// kept, anywhere else it's spent.
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { services, ring, second as dialSecond } from '../src/sim/dial.js';
import { LOOKS, advQuality, readThrough, wearAdvanced, remove, madeFor, ADV_READ } from '../src/sim/disguise.js';
import { whoOf, mods, start as startHunt } from '../src/sim/hunt.js';
import { sheet } from '../src/sim/people.js';
import { stream } from '../src/sim/rng.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { HOUR } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

function hub(seed, city = 'moscow', level = 'handler') {
  const c = newCampaign(seed, level === 'junior' ? candidates(seed, 'london', 'junior')[0] : candidates(seed, city, level)[0], level === 'junior' ? 'london' : city, level);
  for (const k of c.calls ?? []) k.done = c.posting.startMs;
  c.where = { row: c.posting.home.row, x: c.posting.home.x, z: -2.6 };
  const g = newGame({ seed, scenario: 'campaign', campaign: c }), papers = [], choices = [], bus = { emit: (k, v) => { if (k === 'papers') papers.push(...v); if (k === 'safehouse') choices.push(v); }, on() {} };
  start(g, null);
  for (let t = 0; t < 21; t++) step(g, {}, bus);
  return { c, g, bus, papers, choices, me: playerActor(g) };
}

export default [
  {
    name: 'faces: the agency\'s disguise officer from a handler\'s posting on (not a first tour, nor without a network); three faces at a safe house; at its door, one put on (half an hour), the description another\'s; off at its door, kept',
    fn() {
      const J = hub(61, 'london', 'junior');
      assert(!services(J.g).some(s => s.key === 'adv'), 'a first tour: none');
      const w = hub(62, 'cairo', 'undercover'), c = w.c, p = w.g.people.me;
      const sv = services(w.g).find(s => s.key === 'adv');
      assert(sv?.ok, `undercover: ${sv?.why}`);
      const r = ring(w.g, w.bus, 'adv', 'burner') ;
      const own = r.ok ? null : ring(w.g, w.bus, 'adv', 'own');
      const R = c.rung.adv, h = c.posting.safehouses.find(x => x.id === R.house);
      w.g.time.ms = R.at + 60000;
      dialSecond(w.g, w.bus, w.me);
      assert(h.disguises?.length === Object.keys(LOOKS).length, `kept: ${h.disguises?.length}`);
      // (at its door: the instinct's offer, the card, one put on)
      w.g.map.row = h.row; Object.assign(w.me, { x: h.x, z: -2.6 });
      for (let t = 0; t < 21; t++) step(w.g, {}, w.bus);
      const offer = w.g.scenario.prompt;
      step(w.g, { act: ['instinct'] }, w.bus);
      const who0 = whoOf(p), t0 = w.g.time.ms, card = w.choices.at(-1);
      step(w.g, { act: [`desk:safe:${card[0].key}`] }, w.bus);
      const on = p.disguise?.adv, who1 = whoOf(p), min = (w.g.time.ms - t0) / 60000;
      assert(/face/.test(offer?.text ?? '') && on && who1 !== who0 && whoOf(p, true) === who0 && min >= 30 && h.disguises.length === 2, `offer ${offer?.text}; on ${!!on}; ${fmt(min, 0)} min`);
      for (let t = 0; t < 21; t++) step(w.g, {}, w.bus);
      step(w.g, { act: ['instinct'] }, w.bus);
      assert(!p.disguise && h.disguises.length === 3 && whoOf(p) === who0, `off at its door: kept ${h.disguises.length}`);
      console.log(`      a first tour: no disguise officer; undercover in Cairo: ${sv.why}; ${h.label}: ${card.map(x => x.label).join(' / ')}; "${offer.text}"; put on in ${fmt(min, 0)} min: the description ${who0} → ${who1}; off at its door, kept (${h.disguises.length})`);
    },
  },
  {
    name: 'faces: how good, and how often a good eye reads through it: a patrolman\'s Awareness against an expert watcher\'s; the hunt\'s mods with it on, read through, and off',
    fn() {
      const rows = [];
      for (const [label, os, dec] of [['a handler', 40, [10, 2]], ['an undercover officer', 62, [14, 2]], ['an illegal', 85, [20, 3]]]) {
        const p = sheet({ id: 'me', name: 'X', sex: 'm', cls: 'spook', os, skills: { deception: dec }, look: { skin: 'light', hair: { style: 'short', color: 0x2a1c18 } } }); p.age = 44;
        const q = advQuality(p), d = madeFor(p, 0)[0];
        wearAdvanced(p, d, 'sh0');
        const rate = (aw) => { const them = sheet({ id: 'c', name: 'C', cls: 'cop', skills: { awareness: [aw, 0] } }); let n = 0; for (let k = 0; k < 400; k++) if (readThrough(stream('rt', k, aw), them, p).through) n++; return n / 400; };
        rows.push(`${label} (Tradecraft ${os}): quality ${q}, read through by a patrolman (Awareness 9) ${fmt(rate(9) * 100, 0)}%, a sharp one (14) ${fmt(rate(14) * 100, 0)}%, an expert (20) ${fmt(rate(20) * 100, 0)}% (DC ${Math.round(ADV_READ.base + q * ADV_READ.k)})`);
        assert(rate(9) < rate(20) && rate(9) < 0.3, `${label}: ${rate(9)} vs ${rate(20)}`);
      }
      // (the hunt's mods: on, it isn't the face they have, a change of face for you; read through, against you; off, the face they have)
      const w = hub(63, 'moscow'), p = w.g.people.me, me = w.me;
      const H = startHunt(w.g, w.bus, { why: 'gun', x: me.x, who: true, wearing: false });
      wearAdvanced(p, madeFor(p, 1)[2], 'sh0');
      const sum = (m) => m.reduce((t, x) => t + x.v, 0), on = mods(w.g, H, p, me), through = mods(w.g, H, p, me, true);
      remove(p);
      const off = mods(w.g, H, p, me);
      assert(sum(on) > sum(off) && sum(through) <= sum(off) && on.some(m => /change of face/.test(m.why)) && through.some(m => /read through/.test(m.why)), `on ${sum(on)}, read through ${sum(through)}, off ${sum(off)}`);
      for (const r of rows) console.log(`      ${r}`);
      console.log(`      a hunt that has your face: on ${on.map(m => `${m.v > 0 ? '+' : ''}${m.v} ${m.why}`).join(', ')}; read through ${through.map(m => `${m.v > 0 ? '+' : ''}${m.v} ${m.why}`).join(', ')}; off ${off.map(m => `${m.v > 0 ? '+' : ''}${m.v} ${m.why}`).join(', ')}`);
    },
  },
];
