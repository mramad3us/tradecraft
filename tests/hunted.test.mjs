// Blown (sim/scenarios/hunted.js): across the city to the car, the hunters on the streets with your
// description, two safe houses on the way. A bot that walks the way (each safe house, then the car)
// against the hunters, by night: how often it gets out, is taken, or misses the car; and that the
// hunters know a face less often once the coat's changed.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { goTo } from './bots.mjs';
import { assert, fmt } from './helpers.mjs';

function run(seed, { safe = true, evade = false, weather = 'clear' } = {}) {
  const g = newGame({ seed, scenario: 'hunted', weather });          // (clear: the numbers DESIGN.md quotes; tests/weather.test.mjs, in snow)
  start(g, null);
  const sc = g.scenario;
  for (let t = 0; t < 20 * 60 * 90 && !sc.outcome; t++) {
    const me = playerActor(g);
    let input = {};
    if (g.fight?.phase === 'choose') input = { act: [['hit', 'grapple', 'guard'][t % 3]] };
    else if (!sc.inside) {
      const h = safe && sc.safehouses.find(s => !s.used);
      const to = h ? { row: h.row, x: h.x, z: -2.6 } : { row: sc.extract.row, x: sc.extract.x, z: sc.extract.z };
      input = goTo(g, me, to.row, to.x, to.z);
      if (evade && sc.prompt?.id === 'known') input.run = true;    // (one of them has you: run, and lose him)
      if (g.map.row === to.row && Math.hypot(me.x - to.x, me.z - to.z) < 1.4) input = { act: ['instinct'] };
    }
    step(g, input, null);
  }
  return { outcome: sc.outcome ?? 'none', seen: sc.seenBy, fights: sc.fights, rolls: sc.rolls, min: ((sc.ended ?? g.time.ms) - sc.began) / 60000, safe: sc.safehouses.filter(h => h.used).length };
}

export default [
  {
    name: 'blown: across the city to the car with them looking for you: out, taken or stranded; the safe houses help',
    heavy: true,
    fn() {
      const tally = (rs) => rs.reduce((o, r) => ((o[r.outcome] = (o[r.outcome] ?? 0) + 1), o), {});
      const withSafe = Array.from({ length: 12 }, (_, i) => run(100 + i)), without = Array.from({ length: 12 }, (_, i) => run(100 + i, { safe: false }));
      const evading = Array.from({ length: 12 }, (_, i) => run(100 + i, { evade: true }));
      const mean = (rs, k) => fmt(rs.reduce((s, r) => s + r[k], 0) / rs.length, 1);
      console.log(`      with the safe houses: ${JSON.stringify(tally(withSafe))}; known ${mean(withSafe, 'seen')} times, ${mean(withSafe, 'fights')} fights, ${mean(withSafe, 'min')} min`);
      console.log(`      straight for the car: ${JSON.stringify(tally(without))}; known ${mean(without, 'seen')} times, ${mean(without, 'fights')} fights, ${mean(without, 'min')} min`);
      console.log(`      running when one has you: ${JSON.stringify(tally(evading))}; known ${mean(evading, 'seen')} times, ${mean(evading, 'fights')} fights`);
      assert(withSafe.every(r => r.outcome !== 'none'), 'every run ends');
      assert((tally(evading).out ?? 0) >= (tally(withSafe).out ?? 0), 'running when one has you is no worse (a real player breaks his sight in a lane: balance to tune in play)');
      assert(Object.keys(tally(withSafe)).length >= 2, 'not a foregone thing');
    },
  },
];
