// Someone on the ground (sim/interact.js downed(), onGround(), finishDowned()): no openings, but tie them up,
// search them, or kill them by what's in your hand, each crouched over them for its time; moving off before it's
// done and nothing's done; tied, they stay down past their clock.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { options, act, downed, TIE_S, STRANGLE_S } from '../src/sim/interact.js';
import { newGun } from '../src/sim/firearms.js';
import { person } from '../src/sim/interact.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon, and a passer-by out cold at your feet)
function scene(hand = null, seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
  start(g, null);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g), p = g.people[me.who];
  p.items = []; p.hand = hand === 'gun' ? newGun(p, 'makarov', { safety: false }) : hand;
  const a = g.actors.find(x => x !== me && x.ai && !x.cop);
  person(g, a);
  Object.assign(a, { x: me.x + 1, z: me.z, gait: 'down', vx: 0, vz: 0 }); a.ai.downUntil = g.time.ms + 90000; delete a.ai.route;
  return { g, me, p, a, them: g.people[a.who] };
}
const sub = (g, a) => options(g, a).find(o => o.id === 'violence').sub;
const until = (g, me, max = 20 * 400) => { let n = 0; while (me.busy && n++ < max) step(g, {}, null); return n; };

export default [
  {
    name: 'downed: someone out cold: no hitting them, but tie them, search them, kill them by what\'s in your hand',
    fn() {
      const rows = [];
      for (const hand of [null, 'kitchen', 'pipe', 'gun']) {
        const w = scene(hand), list = sub(w.g, w.a);
        assert(downed(w.g, w.a) && !list.some(o => o.id === 'hit') && list.some(o => o.id === 'tie') && list.some(o => o.id === 'kill'), `${hand}: ${list.map(o => o.id).join(',')}`);
        const t0 = w.g.time.ms;
        act(w.g, null, 'kill', w.a);
        const ticks = until(w.g, w.me);
        rows.push(`${hand ?? 'bare hands'}: "${list.find(o => o.id === 'kill').label}", ${fmt((w.g.time.ms - t0) / 1000, 0)} s, ${w.them.dead ? `dead (${w.them.dead.why})` : 'alive'}`);
        assert(w.them.dead, `${hand}: dead after ${ticks} ticks`);
        assert(!options(w.g, w.a).find(o => o.id === 'violence').sub.some(o => o.id === 'kill'), 'the dead: only searched');
      }
      console.log(`      ${rows.join('; ')}`);
    },
  },
  {
    name: 'downed: tied, they stay down when they come round; moving off mid-strangle and nothing\'s done',
    fn() {
      const w = scene();
      act(w.g, null, 'tie', w.a);
      until(w.g, w.me);
      for (let t = 0; t < 20 * 120; t++) step(w.g, {}, null);              // (past their clock: they'd be up)
      assert(w.a.ai.tied && w.a.gait === 'down', `tied, still down two minutes on: ${w.a.gait}`);
      const v = scene();
      act(v.g, null, 'kill', v.a);
      for (let t = 0; t < 20 * 10; t++) step(v.g, {}, null);
      for (let t = 0; t < 10; t++) step(v.g, { mx: 1 }, null);            // (up and off)
      for (let t = 0; t < 20 * STRANGLE_S * 2; t++) step(v.g, {}, null);
      assert(!v.them.dead, 'let go: alive');
      console.log(`      tied in ${TIE_S} s, down two minutes past their clock; a strangling let go of after 10 s: ${v.them.dead ? 'dead' : 'alive'}`);
    },
  },
];
