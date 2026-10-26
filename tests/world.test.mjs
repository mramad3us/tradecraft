// The street and the tick: sections generate the same and join up, lanes stay clear, the crowd keeps
// its count, and a game runs the same twice, and across a save and a load.
import { section, SECTION_M, LANES, Z } from '../src/sim/map/street.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { blocked } from '../src/sim/world.js';
import { isPasserby } from '../src/sim/crowd.js';
import { onMap } from '../src/sim/agents.js';
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
      for (let i = -3; i <= 3; i++) for (const row of [0, -1, 2]) {
        const a = section(77, i, row), b = section(77, i, row);
        assert(JSON.stringify(a) === JSON.stringify(b), `section ${i} of row ${row} differs`);
        const front = a.buildings.filter(B => B.z === Z.front).reduce((w, B) => w + B.x1 - B.x0, 0) + a.gapsN.reduce((w, g) => w + g.x1 - g.x0, 0);
        assert(Math.abs(front - SECTION_M) < 1e-6, `section ${i}: terrace + side streets and alleys ${front} m, not ${SECTION_M}`);
        // A row's ways south are the next row's ways north: the same lanes, from either end.
        assert(JSON.stringify(a.gapsS) === JSON.stringify(section(77, i, row + 1).gapsN), `section ${i}: the ways south of row ${row} don't meet row ${row + 1}'s`);
      }
      const many = Array.from({ length: 40 }, (_, i) => section(5, i));
      const n = (f) => many.reduce((k, S) => k + f(S), 0);
      console.log(`      40 sections: ${n(S => S.buildings.length)} buildings, ${n(S => S.doors.filter(d => d.kind === 'shop').length)} shops, ${n(S => S.doors.filter(d => d.kind === 'arch').length)} arches, ${n(S => S.gapsN.filter(g => g.kind === 'side').length)} side streets and ${n(S => S.gapsN.filter(g => g.kind === 'alley').length)} alleys north, ${n(S => S.gapsS.length)} ways south, ${n(S => S.band === 'park' ? 1 : 0)} of park, ${n(S => S.props.filter(p => p.kind === 'car').length)} parked cars, ${n(S => S.lamps.length)} lamps`);
      console.log(`      e.g. ${many.flatMap(S => S.gapsN).slice(0, 3).map(g => g.name).join(', ')}; a park: ${many.find(S => S.park?.feature)?.park.feature.kind}`);
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
        for (const c of S.crossingsS) for (let z = LANES.path[0]; z < LANES.south[1]; z += 0.25) {
          assert(!blocked(g, (c.x0 + c.x1) / 2, z), `the way south blocked at z ${z} (section ${S.i}, ${S.band})`);
        }
        for (const ex of S.exits) for (let z = ex.dir === 'n' ? Z.north + 0.3 : LANES.south[1]; ex.dir === 'n' ? z < LANES.far[0] : z < Z.edge - 0.3; z += 0.25) {
          assert(!blocked(g, (ex.x0 + ex.x1) / 2, z), `${ex.name} blocked at z ${z} (section ${S.i})`);
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
    name: 'exits: up a lane to the street north and back down it; the crowd comes and goes by them',
    fn() {
      const g = newGame({ seed: 8 });
      const bus = createBus(), notes = [];
      bus.on('log', e => notes.push(e.text));
      start(g, bus);
      const me = playerActor(g);
      const way = [...g.$world.sections.values()].flatMap(S => S.exits).filter(e => e.dir === 'n').sort((a, b) => Math.abs(a.x0) - Math.abs(b.x0))[0];
      assert(way, 'a way north near the start');
      const mx = (way.x0 + way.x1) / 2;
      const go = (x, z, max = 4000) => { for (let t = 0; t < max; t++) { const m = playerActor(g), dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz); if (d < 0.3) return true; step(g, { mx: dx / d, mz: dz / d }, bus); if (g.map.row !== row0) return true; } return false; };
      let row0 = 0;
      assert(go(mx, -2.6), 'to the mouth of the lane');
      assert(go(mx, Z.north - 2), 'up the lane');
      assert(g.map.row === -1, `in the row north (row ${g.map.row})`);
      const m1 = playerActor(g);
      assert(!blocked(g, m1.x, m1.z), 'arrived somewhere free');
      const back = g.$world.sections.size && [...g.$world.sections.values()].flatMap(S => S.exits).find(e => e.dir === 's' && m1.x >= e.x0 && m1.x <= e.x1);
      assert(back, 'the way back south is where we came out');
      row0 = -1;
      for (let t = 0; t < 400; t++) step(g, {}, bus);
      assert(go(m1.x, Z.edge + 2), 'back down');
      assert(g.map.row === 0 && playerActor(g).z < Z.front, `back in the first street, in the lane (row ${g.map.row}, z ${fmt(playerActor(g).z)})`);
      console.log(`      ${notes.filter(t => /^(Up|Down)/.test(t)).join(' / ')}`);
      // Over four game minutes, people go off north and south, and come in from there.
      let north = 0, south = 0;
      const seenAt = new Map();
      for (let t = 0; t < 20 * 240; t++) { step(g, {}, bus); for (const a of g.actors) if (isPasserby(a) && onMap(g, a)) { if (a.z < Z.north + 1) north++; if (a.z > Z.edge - 1) south++; seenAt.set(a.id, a); } }
      console.log(`      people in the lanes' far ends over 4 min: ${north} ticks north, ${south} south`);
      assert(north > 0 && south > 0, 'the crowd uses the ways north and south');
    },
  },
  {
    name: 'crowd: nobody vanishes in the open on screen (they go in at doors, or off the map up a lane)',
    fn() {
      // The player walks along the street one way, then the other, at the lunchtime rush: passers-by
      // planned their way off the street when it was off screen, and the screen comes to them.
      const g = newGame({ seed: 9 });
      const bus = createBus();
      start(g, bus);
      let vanished = 0, left = 0;
      const where = new Map();
      for (let t = 0; t < 20 * 60 * 6; t++) {
        const me = playerActor(g);
        step(g, t < 20 * 150 ? { mx: 1, mz: 0 } : t < 20 * 300 ? { mx: -1, mz: 0 } : {}, bus);
        const now = new Set(g.actors.filter(a => onMap(g, a)).map(a => a.id));   // (gone in, or off to another street)
        for (const [id, [x, z, mx, mz]] of where) {
          if (now.has(id)) continue;
          left++;
          const door = Math.abs(z - (Z.front + 0.3)) < 0.8, edge = z < Z.north + 2 || z > Z.edge - 2;
          if (!door && !edge && Math.abs(x - mx) < 21 && Math.abs(z - mz) < 17) vanished++;
          where.delete(id);
        }
        for (const a of g.actors) if (isPasserby(a) && onMap(g, a)) where.set(a.id, [a.x, a.z, me.x, me.z]);
      }
      console.log(`      6 game minutes walking the street both ways (${fmt(playerActor(g).x, 0)} m from where we began): ${left} passers-by left, ${vanished} of them in the open on screen`);
      assert(vanished === 0, 'someone vanished in the middle of the street');
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
        if (t % (20 * 30) === 0) counts.push(g.actors.filter(a => isPasserby(a) && onMap(g, a)).length);
        for (const a of g.actors) { stuckMax = Math.max(stuckMax, a.stuck); if (a.stuck > 2.9) gaveUp++; }
        seen = Math.max(seen, g.nextActor);
      }
      console.log(`      passers-by on the street every 30 s, 15:40–15:44: ${counts.join(', ')}; ${seen} came and went (the streets either side too); longest stuck ${fmt(stuckMax, 2)} s, ${gaveUp} gave up a step`);
      assert(gaveUp === 0, 'passers-by get stuck');
      assert(Math.min(...counts) >= 12 && Math.max(...counts) <= 45, 'the crowd holds');
      const me = playerActor(g);
      assert(me && !blocked(g, me.x, me.z), 'the player stands somewhere free');
    },
  },
];
