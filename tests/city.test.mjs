// The city graph and its routes: every way the planner may send someone is clear at its full width
// (the guarantee the background game rests on), routes reach their goals across many streets,
// different walkers go different ways, a careful walker's way wanders, and from anywhere walkable
// there's a way onto the lines.
import { planRoute, placeAt, clearAt, sectionOf, joinLine, routeFrom, LINE, HALF } from '../src/sim/city.js';
import { Z } from '../src/sim/map/street.js';
import { stream, range, int } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

const inBounds = (z) => z > Z.north + 0.3 && z < Z.edge - 0.3;

/** Walk a route as an agent does (placeAt: offset f of each way's half-width, blended at corners): every step clear? */
function walks(seed, route, f) {
  for (let s = 0; s <= route.length; s += 0.2) {
    const p = placeAt(route, s, f);
    if (inBounds(p.z) && !clearAt(seed, p.row, p.x, p.z)) return `blocked at row ${p.row} (${fmt(p.x, 2)}, ${fmt(p.z, 2)}), ${fmt(s, 1)} m along`;
  }
  return null;
}

/** The ways of a route at their full width, corners included: every point clear? */
function walkable(seed, route, f) {
  const { pts } = route;
  const normal = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return [-dz / d, dx / d]; };
  for (let j = 1; j < pts.length; j++) {
    const a = pts[j - 1], b = pts[j];
    if (b.jump) continue;
    const [nx, nz] = normal(a, b), w = a.w ?? 0, len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let t = 0; t <= len; t += 0.25) {
      const x = a.x + (b.x - a.x) * t / len + nx * w * f, z = a.z + (b.z - a.z) * t / len + nz * w * f;
      if (inBounds(z) && !clearAt(seed, a.row, x, z)) return `blocked at row ${a.row} (${fmt(x, 2)}, ${fmt(z, 2)}) on the way ${j} (w ${w})`;
    }
    // A turn into the next way: both offsets at once.
    const c = pts[j + 1];
    if (c && !c.jump && c.row === b.row && Math.abs(normal(b, c)[0] * nx + normal(b, c)[1] * nz) < 0.99) {
      const [mx, mz] = normal(b, c), w2 = b.w ?? 0;
      for (const p of [-1, 0, 1]) for (const q of [-1, 0, 1]) {
        const x = b.x + nx * w * p * Math.abs(f) + mx * w2 * q * Math.abs(f), z = b.z + nz * w * p * Math.abs(f) + mz * w2 * q * Math.abs(f);
        if (inBounds(z) && !clearAt(seed, b.row, x, z)) return `corner blocked at row ${b.row} (${fmt(x, 2)}, ${fmt(z, 2)})`;
      }
    }
  }
  return null;
}

export default [
  {
    name: 'city: every way between the lines is clear at its full width, on every street',
    fn() {
      let checked = 0;
      for (const seed of [3, 41, 977]) for (let row = -6; row <= 6; row++) for (let i = -6; i <= 6; i++) {
        const S = sectionOf(seed, row, i);
        const probe = (x, z, why) => { checked++; assert(clearAt(seed, row, x, z), `seed ${seed} row ${row}: ${why} blocked at (${fmt(x, 2)}, ${fmt(z, 2)})`); };
        for (const [line, z] of Object.entries(LINE)) for (let x = S.x0; x < S.x1; x += 0.5) for (const o of [-HALF[line], 0, HALF[line]]) probe(x, z + o, `line ${line}`);
        for (const c of S.crossings) { const x = (c.x0 + c.x1) / 2; for (let z = LINE.F; z <= LINE.P; z += 0.25) for (const o of [-HALF.zebra, 0, HALF.zebra]) probe(x + o, z, 'the zebra and the gate'); }
        for (const c of S.crossingsS) { const x = (c.x0 + c.x1) / 2; for (let z = LINE.P; z <= LINE.S; z += 0.25) for (const o of [-HALF.zebra, 0, HALF.zebra]) probe(x + o, z, 'the way south'); }
        for (const g of S.gapsN) { const x = (g.x0 + g.x1) / 2; for (let z = Z.north + 0.4; z <= LINE.F; z += 0.25) for (const o of [-HALF[g.kind], 0, HALF[g.kind]]) probe(x + o, z, g.name); }   // (Moscow's lanes run straight: tests/cities.test.mjs walks the other cities' doglegs)
        for (const g of S.gapsS) { const x = (g.x0 + g.x1) / 2; for (let z = LINE.S; z <= Z.edge - 0.4; z += 0.25) for (const o of [-HALF[g.kind], 0, HALF[g.kind]]) probe(x + o, z, `${g.name}, south`); }
      }
      console.log(`      ${checked} points on the ways of 3 cities × 13 streets × 13 sections: clear`);
    },
  },
  {
    name: 'city: routes across ten streets and more, walked at every offset, never blocked',
    fn() {
      const r = stream('city-test');
      let n = 0, rowsMin = Infinity, len = 0;
      const t0 = performance.now();
      for (let k = 0; k < 60; k++) {
        const seed = 1 + int(r, 1e6);
        const from = { row: 0, x: range(r, -100, 100), z: LINE.F };
        const to = { row: (int(r, 2) ? 1 : -1) * (10 + int(r, 4)), x: from.x + range(r, -600, 600), z: LINE.P };
        const route = planRoute(seed, from, to, { walker: k });
        for (const f of [-1, 0, 1]) { const bad = walkable(seed, route, f) ?? walks(seed, route, f); assert(!bad, `seed ${seed}, walker ${k}: ${bad}`); }
        const end = route.pts[route.pts.length - 1];
        assert(end.row === to.row && Math.abs(end.x - to.x) < 1e-6, 'the route ends at its goal');
        rowsMin = Math.min(rowsMin, route.rows); len += route.length; n++;
      }
      console.log(`      ${n} routes of 10–13 streets: ${fmt(len / n, 0)} m on average, at least ${rowsMin} changes of street, planned and walked in ${fmt(performance.now() - t0, 0)} ms`);
      assert(rowsMin >= 10, 'ten streets apart is ten changes of street at least');
    },
  },
  {
    name: 'city: two walkers take different ways; a careful one wanders and doubles back',
    fn() {
      const seed = 4242, from = { row: 0, x: 0, z: LINE.F }, to = { row: -10, x: 400, z: LINE.P };
      const sig = (route) => route.pts.filter(p => p.jump).map(p => `${p.row}@${Math.round(p.x)}`).join(' ');
      const ways = new Set(Array.from({ length: 8 }, (_, w) => sig(planRoute(seed, from, to, { walker: w + 1 }))));
      const direct = planRoute(seed, from, to, { walker: 1 });
      const careful = Array.from({ length: 8 }, (_, w) => planRoute(seed, from, to, { walker: w + 1, evasive: true }));
      const back = careful.filter(rt => rt.pts.some((p, j) => p.jump && Math.sign(p.row - rt.pts[j - 1].row) !== Math.sign(to.row - from.row))).length;
      for (const rt of careful) for (const f of [-1, 1]) { const bad = walkable(seed, rt, f) ?? walks(seed, rt, f); assert(!bad, `a careful route: ${bad}`); }
      console.log(`      8 walkers, 10 streets north: ${ways.size} different ways; direct ${fmt(direct.length, 0)} m and ${direct.rows} changes; careful ${fmt(careful.reduce((a, rt) => a + rt.length, 0) / 8, 0)} m and ${fmt(careful.reduce((a, rt) => a + rt.rows, 0) / 8, 1)} changes on average, ${back} of 8 doubling back a street`);
      assert(ways.size >= 4, 'walkers should differ');
      assert(careful.every(rt => rt.length > direct.length * 0.9) && careful.reduce((a, rt) => a + rt.rows, 0) / 8 > direct.rows, 'careful routes wander');
    },
  },
  {
    name: 'city: from anywhere walkable, a way onto the lines and on',
    fn() {
      const r = stream('join-test');
      let n = 0;
      for (let k = 0; k < 400; k++) {
        const seed = 1 + int(r, 1e6), row = int(r, 7) - 3, x = range(r, -200, 200), z = range(r, Z.north + 1, Z.edge - 1);
        if (!clearAt(seed, row, x, z)) continue;
        const S = sectionOf(seed, row, Math.floor(x / 45));
        if (z > Z.hedge && !S.gapsS.some(g => x > g.x0 && x < g.x1)) continue;   // (behind the hedge: nobody can get there)
        const inLane = z < Z.front || z > Z.hedge;
        if (!inLane) assert(joinLine(seed, row, x, z), `stranded at row ${row} (${fmt(x, 2)}, ${fmt(z, 2)}), seed ${seed}`);
        const route = routeFrom(seed, { row, x, z }, { row: row - 1, x: x + 80, z: LINE.F }, { walker: k });
        const bad = walks(seed, route, 0);
        assert(!bad, `from row ${row} (${fmt(x, 2)}, ${fmt(z, 2)}): ${bad}`);
        n++;
      }
      console.log(`      ${n} random walkable spots (lawns, pavements, the road, lanes, behind the hedge): every one joined a line and routed on`);
    },
  },
];
