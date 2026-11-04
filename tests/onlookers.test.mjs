// Passers-by round someone down (sim/onlookers.js): nobody walks over a body; some stop to look, in a ring a couple of
// metres off, phones out or looking about; the rest step round it, or turn back; the ring breaks up when the police tape
// goes up, or after a while.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { kill } from '../src/sim/health.js';
import { person } from '../src/sim/interact.js';
import { LINE } from '../src/sim/city.js';
import { RING_M, RING_MAX, ONLOOK_S } from '../src/sim/onlookers.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon, you across the road, a dead man on the far pavement's walking line; ticks over s seconds, the tape at tapeS)
function watch(seed, s = 300, tapeS = 220) {
  const g = newGame({ seed, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
  start(g, null);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g), row = g.map.row ?? 0;
  me.z = LINE.N;
  const a = g.actors.find(x => x !== me && x.ai?.civ && !x.hidden && (x.row ?? row) === row), p = person(g, a);
  Object.assign(a, { x: me.x + 4, z: LINE.F, gait: 'down', vx: 0, vz: 0 }); kill(p, g.time.ms, 'shot'); a.ai.downUntil = Infinity;
  const by = new Set(), over = new Set(), ring = new Set(), phones = new Set(), stood = [];
  let closest = Infinity, after = null, gaps = Infinity;
  for (let t = 0; t < 20 * s; t++) {
    step(g, {}, null);
    if (t === 20 * tapeS) (g.cordons ??= []).push({ id: 'tapeT', row, x: a.x, z: a.z, r: 4.5, until: g.time.ms + 86400000 });
    if (t === 20 * (tapeS + 15)) after = g.actors.filter(o => o.ai?.look?.id === a.id && !o.hidden).length;
    for (const o of g.actors) {
      if (o === a || o === me || !o.ai?.civ || o.hidden || (o.row ?? row) !== row) continue;
      const d = Math.hypot(o.x - a.x, o.z - a.z);
      if (d < 6) by.add(o.id);
      if (d < 0.8) over.add(o.id);
      closest = Math.min(closest, d);
      if (o.ai.look?.id === a.id) { ring.add(o.id); if (o.ai.look.phone) phones.add(o.id); }
    }
    if (t % (20 * 30) === 0) {
      const R = g.actors.filter(o => o.ai?.look?.id === a.id && Math.hypot(o.x - o.ai.look.x, o.z - o.ai.look.z) < 0.3);
      stood.push(R.length);
      for (const q of R) gaps = Math.min(gaps, Math.hypot(q.x - a.x, q.z - a.z));
    }
  }
  return { by: by.size, over: over.size, ring: ring.size, phones: phones.size, stood, closest, after, gaps };
}

export default [
  {
    name: 'onlookers: nobody walks over a body; some stop and look, a ring a couple of metres off, phones out; the rest go round it; gone when the tape goes up',
    fn() {
      const rows = [];
      let ring = 0, phones = 0;
      for (const seed of [4, 5]) {
        const o = watch(seed);
        rows.push(`seed ${seed}: ${o.by} passed within 6 m, ${o.over} within 0.8 m (closest ${fmt(o.closest, 2)} m); ${o.ring} stopped to look (${o.phones} with a phone out), stood in the ring every 30 s: ${o.stood.join(' ')}, nearest of them ${fmt(o.gaps, 1)} m off; 15 s after the tape, ${o.after} still looking`);
        assert(o.over === 0, `seed ${seed}: nobody over it (${o.over})`);
        assert(o.ring > 0 && Math.max(...o.stood) <= RING_MAX && o.gaps >= RING_M[0] - 0.4, `seed ${seed}: a ring, a couple of metres off`);
        assert(o.after === 0, `seed ${seed}: gone when the tape's up (${o.after})`);
        ring += o.ring; phones += o.phones;
      }
      console.log(`      ${rows.join('\n      ')}`);
      assert(phones > 0 && phones < ring, `some on the phone, not all (${phones} of ${ring})`);
    },
  },
  {
    name: 'onlookers: no tape, and the ring breaks up after a while of its own',
    fn() {
      const o = watch(6, ONLOOK_S[1] + 120, 1e9);
      console.log(`      stood in the ring every 30 s: ${o.stood.join(' ')} (each a ${ONLOOK_S[0]}–${ONLOOK_S[1]} s look)`);
      assert(o.ring > 0 && o.stood.at(-1) < Math.max(...o.stood), 'fewer at the end than at its height');
    },
  },
];
