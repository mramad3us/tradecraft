// The street and the tick: sections generate the same and join up, lanes stay clear, the crowd keeps
// its count, and a game runs the same twice, and across a save and a load.
import { section, SECTION_M, LANES, Z } from '../src/sim/map/street.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { blocked } from '../src/sim/world.js';
import { createBus } from '../src/sim/bus.js';
import { stream, range } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

// A walk that wanders: input from its own stream, changing every second or so.
function wander(seed) {
  const r = stream('wander', seed);
  let input = { mx: 0, mz: 0, run: false }, left = 0;
  return () => {
    if (--left <= 0) { left = 10 + Math.floor(range(r, 0, 40)); input = { mx: Math.round(range(r, -1.4, 1.4)), mz: Math.round(range(r, -1.4, 1.4)), run: range(r, 0, 1) < 0.2 }; }
    return input;
  };
}

export default [
  {
    name: 'street: a section is the same every time, and its terrace fills it',
    fn() {
      for (let i = -3; i <= 3; i++) {
        const a = section(77, i), b = section(77, i);
        assert(JSON.stringify(a) === JSON.stringify(b), `section ${i} differs`);
        const front = a.buildings.filter(B => B.z === Z.front).reduce((w, B) => w + B.x1 - B.x0, 0) + (a.side ? 10 : 0);
        assert(Math.abs(front - SECTION_M) < 1e-6, `section ${i}: terrace + side street ${front} m, not ${SECTION_M}`);
      }
      const many = Array.from({ length: 40 }, (_, i) => section(5, i));
      const n = (f) => many.reduce((k, S) => k + f(S), 0);
      console.log(`      40 sections: ${n(S => S.buildings.length)} buildings, ${n(S => S.doors.filter(d => d.kind === 'shop').length)} shops, ${n(S => S.doors.filter(d => d.kind === 'arch').length)} arches, ${n(S => S.side ? 1 : 0)} side streets, ${n(S => S.props.filter(p => p.kind === 'car').length)} parked cars, ${n(S => S.lamps.length)} lamps`);
    },
  },
  {
    name: 'street: the lanes, the crossings and the sitters\' spots are clear of what blocks',
    fn() {
      const g = newGame({ seed: 3 });
      start(g, null);
      let checked = 0;
      for (const S of g.$world.sections.values()) {
        for (const [lane, [z0, z1]] of Object.entries(LANES)) for (const z of [z0, z1]) for (let x = S.x0 + 0.3; x < S.x1 - 0.3; x += 0.25) {
          if (Math.abs(x - g.$world.bx[0]) < 0.3 || Math.abs(x - g.$world.bx[1]) < 0.3) continue;
          assert(!blocked(g, x, z), `${lane} lane blocked at x ${fmt(x, 2)} z ${z} (section ${S.i})`);
          checked++;
        }
        for (const c of S.crossings) for (let z = LANES.far[0]; z < LANES.path[1]; z += 0.25) {
          assert(!blocked(g, (c.x0 + c.x1) / 2, z), `crossing blocked at z ${z} (section ${S.i})`);
        }
        for (const p of S.props.filter(p => p.kind === 'bench')) for (const sx of p.seats) assert(!blocked(g, sx, 12.96), `a seat is blocked at ${sx}`);
      }
      console.log(`      ${checked} points along the lanes: clear`);
    },
  },
  {
    name: 'tick: a game runs the same twice, and the same across a save and a load',
    fn() {
      const run = (ticks, cut = null) => {
        let g = newGame({ seed: 11 });
        start(g, createBus());
        const input = wander(1);
        for (let t = 0; t < ticks; t++) {
          if (t === cut) { g = fromJSON(toJSON(g)); start(g, createBus()); }
          step(g, input(), null);
        }
        return toJSON(g);
      };
      const t0 = performance.now();
      const a = run(3000);
      const ms = performance.now() - t0;
      const b = run(3000), c = run(3000, 1500);
      assert(a === b, 'two runs differ');
      assert(a === c, 'a save and a load changed the course of the game');
      const g = fromJSON(a);
      console.log(`      3000 ticks (2.5 game minutes) in ${fmt(ms, 0)} ms (${fmt(ms / 3000 * 1000, 0)} µs a tick), ${g.actors.length} on the map, save ${fmt(a.length / 1024)} KB`);
    },
  },
  {
    name: 'crowd: the street holds its people through the day, and nobody stays stuck',
    fn() {
      const g = newGame({ seed: 5 });
      const bus = createBus();
      start(g, bus);
      const counts = [];
      let stuckMax = 0, gaveUp = 0, seen = 0;
      for (let t = 0; t < 20 * 60 * 4; t++) {                     // four game minutes
        step(g, {}, bus);
        if (t % (20 * 30) === 0) counts.push(g.actors.length);
        for (const a of g.actors) { stuckMax = Math.max(stuckMax, a.stuck); if (a.stuck > 2.9) gaveUp++; }
        seen = Math.max(seen, g.nextActor);
      }
      console.log(`      people on the map every 30 s, 15:40–15:44: ${counts.join(', ')}; ${seen} came and went; longest stuck ${fmt(stuckMax, 2)} s, ${gaveUp} gave up a step`);
      assert(gaveUp === 0, 'passers-by get stuck');
      assert(Math.min(...counts) >= 12 && Math.max(...counts) <= 45, 'the crowd holds');
      const me = playerActor(g);
      assert(me && !blocked(g, me.x, me.z), 'the player stands somewhere free');
    },
  },
];
