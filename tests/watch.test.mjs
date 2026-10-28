// Watching and photographing (sim/scenarios/watch.js): Volkov meets a man in a camel coat outside a
// café; a minder across the road looks at faces. Bots: one who stands about in the open across the
// road and stares (the minder should make him, often), one who waits at a shop window across from
// the café (a reason to be there) and photographs the meeting; how often each gets the photograph,
// sharp or soft, witnesses it, or is made.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { goTo } from './bots.mjs';
import { assert } from './helpers.mjs';
import { Z } from '../src/sim/map/street.js';
import { sectionAt } from '../src/sim/world.js';

/** A bot at (x, z), eyes on the café while it waits, a frame every 2 s while they're together. */
function run(seed, how) {
  const g = newGame({ seed, scenario: 'watch', weather: 'clear' });   // (the baseline: sim/weather.js)
  start(g, null);
  const sc = g.scenario;
  for (let t = 0; t < 20 * 60 * 40 && !sc.outcome; t++) {
    const me = playerActor(g);
    // (the open: across the road, 6 m along; at a window: the shopfront opposite, on our own side, glass)
    const spot = how === 'open' ? { x: sc.cafe.x + 6 * sc.side, z: 8.5 } : { x: sc.cafe.x + 14 * sc.side, z: Z.front + 0.7 };
    let input;
    if (Math.abs(me.x - spot.x) > 1.2 || Math.abs(me.z - spot.z) > 1.2) input = goTo(g, me, 0, spot.x, spot.z);
    else {
      const dx = sc.cafe.x - me.x, dz = sc.cafe.z - me.z, n = Math.hypot(dx, dz) || 1;
      input = how === 'open' ? { look: true, mx: dx / n, mz: dz / n } : {};   // (the open: staring; the window: just waiting)
      if (how === 'window' && !me.busy && !me.glass && t % 20 === 0) input = { act: ['use'] };
    }
    if (sc.phase === 'meet' && t % 40 === 0) input = { ...input, act: ['camera'] };
    step(g, input, null);
  }
  return sc;
}

export default [
  {
    name: 'watching: stand about staring and the minder makes you; wait at a window and photograph the meeting',
    heavy: true,
    fn() {
      const tally = (how) => {
        const out = {};
        for (let seed = 1; seed <= 12; seed++) { const sc = run(seed, how); out[sc.outcome] = (out[sc.outcome] ?? 0) + 1; }
        return out;
      };
      const open = tally('open'), win = tally('window');
      console.log(`      staring from the open: ${JSON.stringify(open)}; from a shop window opposite: ${JSON.stringify(win)}`);
      assert((open.blown ?? 0) >= 3, 'the minder makes a man who stands about staring');
      assert((win.photo ?? 0) + (win.soft ?? 0) > (open.photo ?? 0) + (open.soft ?? 0), 'a reason to be there gets the photograph more');
    },
  },
];
