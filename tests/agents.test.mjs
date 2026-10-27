// The background game's agents: a target walking a long careful route across the city (its habits'
// stops and detours, lanes to ten streets and more away), a follower behind it by what it sees, the
// map following the follower. Day or night, near or far behind, every run must end with the follower
// still on him at the end of his way, both always somewhere walkable, and the map changed ten times
// at least: the game's own follower never loses a man who isn't trying to lose it.
import { newGame, start, step } from '../src/sim/game.js';
import { makeAgent, setRoute, follow, rowOf } from '../src/sim/agents.js';
import { planRoute, clearAt, sectionOf, LINE } from '../src/sim/city.js';
import { withHabits } from '../src/sim/habits.js';
import { at } from '../src/sim/clock.js';
import { Z } from '../src/sim/map/street.js';
import { townOf } from '../src/sim/cities/index.js';
import { stream, range, int, chance } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

/** A run: a target off ten streets and more, a follower after him. → what happened. */
export function chase(seed, { hour = 12, evasive = 1, keep = 18, style = 'calm', limitMin = 50, city = null } = {}) {
  const g = newGame({ seed, scenario: 'walk', city });
  g.time.ms = at(2026, 11, 2, hour, 0);
  start(g, null);
  const r = stream('chase', seed), s = townOf(g.map);
  const rows = (chance(r, 0.5) ? 1 : -1) * (10 + int(r, 3));
  const door = sectionOf(s, 0, 0).doors.find(d => d.z === Z.front && d.kind !== 'arch') ?? { x: 20 };
  const goal = { row: rows, x: door.x + range(r, -500, 500), z: LINE.P };
  const t = makeAgent(g, { who: null, seed: 4242, row: 0, x: door.x, z: Z.front + 0.3, speed: 1.3, f: range(r, -0.5, 0.5) });
  setRoute(g, t, withHabits(s, planRoute(s, { row: 0, x: door.x, z: Z.front + 0.3 }, goal, { walker: seed, evasive, rng: r }), r, style));
  const f = makeAgent(g, { who: null, seed: 777, row: 0, x: door.x - 25, z: LINE.F, speed: 1.45 });
  follow(g, f, t, keep);
  g.focus = f.id;
  // (the human player stands out of the way: the focus is the follower)
  g.actors = g.actors.filter(a => a.who !== g.player);
  let maps = 0, row = g.map.row, blocked = null, gapMax = 0;
  const limit = limitMin * 60 * 20;
  let k = 0;
  for (; k < limit; k++) {
    step(g, {}, null);
    if (g.map.row !== row) { maps++; row = g.map.row; }
    if (k % 20 === 0) {
      for (const a of [t, f]) if (!clearAt(s, rowOf(g, a), a.x, a.z, 0.2) && !blocked) blocked = `${a === t ? 'target' : 'follower'} in something at row ${rowOf(g, a)} (${fmt(a.x, 2)}, ${fmt(a.z, 2)}) after ${fmt(k / 1200, 1)} min`;
      if (rowOf(g, t) === rowOf(g, f)) gapMax = Math.max(gapMax, Math.hypot(t.x - f.x, t.z - f.z));
    }
    if (t.ai.s >= t.ai.route.length - 0.01 && t.ai.wait === 0 && !t.ai.waiting) break;
    if (f.ai.follow.lost) break;
  }
  const d = rowOf(g, t) === rowOf(g, f) ? Math.hypot(t.x - f.x, t.z - f.z) : Infinity;
  return { arrived: t.ai.s >= t.ai.route.length - 0.01, lost: f.ai.follow.lost, d, maps, blocked, minutes: k / 1200, length: t.ai.route.length, gapMax };
}

export default [
  {
    name: 'agents: a follower stays with a careful man across ten streets and more, every time, day or night',
    fn() {
      const N = Number(process.env.CHASE_N ?? (process.env.QUICK ? 5 : 16));
      const sets = [[12, 18, 1000], [22, 18, 2000], [17, 30, 3000], [12, 10, 4000]];   // [hour, keep m, seeds]
      let failed = 0;
      for (const [hour, keep, base] of sets) {
        const runs = Array.from({ length: N }, (_, i) => chase(base + i, { hour, keep, evasive: i % 3 === 0 ? true : 1, style: i % 2 ? 'wary' : 'calm' }));
        const bad = runs.map((x, i) => [x, i]).filter(([x]) => x.blocked || x.lost || !x.arrived || x.d > 45);
        const mean = (k) => fmt(runs.reduce((a, x) => a + x[k], 0) / N, 1);
        console.log(`      ${hour}:00, ${keep} m back, ${N} chases: ${mean('length')} m and ${mean('minutes')} min a chase, ${Math.min(...runs.map(x => x.maps))}–${Math.max(...runs.map(x => x.maps))} changes of street; ${mean('d')} m behind at the end (furthest ${fmt(Math.max(...runs.map(x => x.gapMax)), 0)} m)`);
        for (const [x, i] of bad) console.log(`      ✗ chase ${base + i}: ${x.blocked ?? (x.lost ? 'lost him' : !x.arrived ? 'never arrived' : `${fmt(x.d, 0)} m behind`)} after ${fmt(x.minutes, 1)} min, ${x.maps} streets`);
        failed += bad.length;
        assert(runs.every(x => x.maps >= 10 || x.lost), 'ten changes of street at least');
      }
      assert(!failed, `${failed} chases failed`);
    },
  },
];
