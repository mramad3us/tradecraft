// The cities (sim/cities/): Moscow generated as it always was; London, Beirut and Cairo each their own
// (names, shops, people), and on every one of them the sim's guarantees: sections the same every
// time and joined row to row, the terrace and its lanes, courts, squares and lots filling the front,
// the walking lanes, crossings and ways out clear, every way of the city graph clear at its full width
// (round a dogleg's turn too), routes across ten streets and more walked at every offset, a way onto
// the lines from anywhere walkable (in a court, a square, up a dogleg), followers that keep a careful
// man across the city, and a crowd where nobody vanishes in the open. And the Arabic signs shaped.
import { section, gapsOf, terraceOf, laneLine, inLane, mouthOf, placeName, LANES, Z, SECTION_M } from '../src/sim/map/street.js';
import { sectionOf, clearAt, planRoute, placeAt, routeFrom, joinLine, LINE, HALF, JOIN_DEEP_M } from '../src/sim/city.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { blocked } from '../src/sim/world.js';
import { isPasserby } from '../src/sim/crowd.js';
import { onMap } from '../src/sim/agents.js';
import { passerby } from '../src/sim/people.js';
import { townOf, CITIES } from '../src/sim/cities/index.js';
import { hash, stream, range, int } from '../src/sim/rng.js';
import { createBus } from '../src/sim/bus.js';
import { arabicWidth } from '../src/art/arabic.js';
import { chase } from './agents.test.mjs';
import { assert, fmt } from './helpers.mjs';

const OTHERS = ['london', 'beirut', 'cairo'];
const inBounds = (z) => z > Z.north + 0.3 && z < Z.edge - 0.3;
/** Points along a lane's middle (round a dogleg's turn), with the way's normal: f(x, z, nx, nz). */
const along = (g, f, step = 0.25) => {
  const L = laneLine(g);
  for (let k = 1; k < L.length; k++) {
    const a = L[k - 1], b = L[k], d = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / d, nz = (b.x - a.x) / d;
    for (let t = 0; t <= d; t += step) f(a.x + (b.x - a.x) * t / d, a.z + (b.z - a.z) * t / d, nx, nz);
  }
};

export default [
  {
    name: 'cities: Moscow is generated exactly as it was (sections, routes, passers-by)',
    fn() {
      // (hashes of v0.0.46's output, before there were other cities: change them only on purpose)
      const want = { 7: 3473505852, 77: 2440374664, 1234: 4204233180, people: 2649027127 };
      for (const seed of [7, 77, 1234]) {
        const parts = [];
        for (const row of [-1, 0, 2]) for (let i = -2; i <= 2; i++) parts.push(JSON.stringify(section(seed, i, row)));
        parts.push(JSON.stringify(planRoute(seed, { row: 0, x: 5, z: LINE.F }, { row: -6, x: 260, z: LINE.P }, { walker: 3, evasive: true })));
        assert(hash(...parts) === want[seed], `Moscow's streets with seed ${seed} differ from v0.0.46's`);
      }
      assert(hash(...Array.from({ length: 60 }, (_, k) => JSON.stringify(passerby(k * 101 + 7)))) === want.people, 'Moscow\'s passers-by differ from v0.0.46\'s');
      assert(townOf({ seed: 5 }) === 5 && townOf({ seed: 5, city: 'moscow' }) === 5 && townOf({ seed: 5, city: 'cairo' }) === 'cairo:5', 'a town: the seed in Moscow, city:seed elsewhere');
      console.log('      Moscow: 45 sections × 3 seeds, a careful route and 60 passers-by, as v0.0.46 made them');
    },
  },
  {
    name: 'cities: each its own: names, shops, signs, people',
    fn() {
      for (const city of OTHERS) {
        const town = `${city}:9`, C = CITIES[city], shops = {}, kinds = {}, names = new Set(), langs = {};
        let buildings = 0;
        for (let row = -2; row <= 2; row++) for (let i = -4; i < 6; i++) {
          const S = section(town, i, row);
          buildings += S.buildings.length;
          for (const B of S.buildings) kinds[B.style] = (kinds[B.style] ?? 0) + 1;
          for (const d of S.doors) if (d.shop) shops[d.shop] = (shops[d.shop] ?? 0) + 1;
          for (const g of S.gapsN) names.add(g.name);
        }
        const folk = Array.from({ length: 300 }, (_, k) => passerby(k * 31 + 5, city));
        for (const p of folk) for (const l of Object.keys(p.langs)) langs[l] = (langs[l] ?? 0) + 1;
        const scarves = folk.filter(p => p.sex === 'f' && p.look.hat?.kind === 'hijab').length / folk.filter(p => p.sex === 'f').length;
        const robes = folk.filter(p => p.look.top?.kind === 'robe').length;
        console.log(`      ${C.name}: ${buildings} buildings (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}); ${Object.keys(shops).length} kinds of shop; lanes like ${[...names].slice(0, 3).join(', ')}; e.g. ${folk.slice(0, 3).map(p => p.name).join(', ')}; ${Math.round(scarves * 100)}% of women in a headscarf${robes ? `, ${robes} galabeyas in 300` : ''}; speaking ${Object.entries(langs).map(([k, n]) => `${k} ${n}`).join(', ')}`);
        assert(Object.keys(kinds).length >= 3, `${city}: three kinds of building at least`);
        assert(!folk.some(p => /ov$|ova$|aya$/.test(p.name.split(' ')[1]) && city !== 'london'), `${city}: Russian names in the street`);
        assert(placeName(town, 0, 10, 0) === C.streetName(town, 0), `${city}: the street's name its own`);
      }
      const ar = ['صيدلية', 'بنك', 'مكتبة', 'فلافل'].map(w => arabicWidth(w));
      assert(ar.every(w => w > 6 && w < 40), `Arabic words a sign's width: ${ar}`);
    },
  },
  {
    name: 'cities: sections the same every time, joined row to row, their fronts filled',
    fn() {
      let n = 0, jogs = 0, courts = 0, squares = 0, crescents = 0;
      for (const city of OTHERS) for (const seed of [3, 40]) for (let row = -3; row <= 3; row++) for (let i = -5; i <= 5; i++) {
        const town = `${city}:${seed}`, a = section(town, i, row), b = section(town, i, row);
        assert(JSON.stringify(a) === JSON.stringify(b), `${town} section ${i} row ${row} differs`);
        assert(JSON.stringify(a.gapsS) === JSON.stringify(section(town, i, row + 1).gapsN), `${town} section ${i}: row ${row}'s ways south don't meet row ${row + 1}'s`);
        // The front: buildings (on the line or set back), lanes' mouths, courts and lots, edge to edge.
        const spans = [...a.buildings.filter(B => !B.back).map(B => [B.x0, B.x1]), ...a.gapsN.map(g => [mouthOf(g).x0, mouthOf(g).x1]), ...(a.courts ?? []).map(c => [c.x0, c.x1]), ...(a.lots ?? []).map(l => [l.x0, l.x1])].sort((p, q) => p[0] - q[0]);
        let x = a.x0;
        for (const [s0, s1] of spans) { assert(Math.abs(s0 - x) < 1e-6, `${town} section ${i} row ${row}: the front breaks at ${fmt(x, 2)} (next at ${fmt(s0, 2)})`); x = s1; }
        assert(Math.abs(x - a.x1) < 1e-6, `${town} section ${i} row ${row}: the front ends at ${fmt(x, 2)}`);
        const T = terraceOf(town, row, i);
        jogs += a.gapsN.filter(g => g.jog).length; courts += T.courts.length; squares += T.squares.length; crescents += T.runs.filter(q => q.shape?.kind === 'crescent').length;
        n++;
      }
      console.log(`      ${n} sections of the three cities: ${jogs} doglegs, ${courts} courts, ${squares} squares, ${crescents} crescents`);
      assert(jogs && courts && squares && crescents, 'every shape of terrace somewhere');
    },
  },
  {
    name: 'cities: the walking lanes, the crossings and the ways out are clear, in a game in each city',
    fn() {
      let checked = 0;
      for (const city of OTHERS) for (const seed of [3, 8]) {
        const g = newGame({ seed, city });
        start(g, null);
        for (const S of g.$world.sections.values()) {
          for (const [lane, [z0, z1]] of Object.entries(LANES)) for (const z of [z0, z1]) for (let x = S.x0 + 0.3; x < S.x1 - 0.3; x += 0.25) {
            if (Math.abs(x - g.$world.bx[0]) < 0.3 || Math.abs(x - g.$world.bx[1]) < 0.3) continue;
            assert(!blocked(g, x, z), `${city} ${seed}: ${lane} lane blocked at x ${fmt(x, 2)} z ${z}`);
            checked++;
          }
          for (const c of S.crossings) for (let z = LANES.far[0]; z < LANES.path[1]; z += 0.25) assert(!blocked(g, (c.x0 + c.x1) / 2, z), `${city}: a crossing blocked at z ${z}`);
          for (const c of S.crossingsS) for (let z = LANES.path[0]; z < LANES.south[1]; z += 0.25) assert(!blocked(g, (c.x0 + c.x1) / 2, z), `${city}: the way south blocked at z ${z}`);
          for (const ex of S.exits) {
            if (ex.dir === 'n') {
              along(ex, (x, z) => { if (z > Z.north + 0.3) assert(!blocked(g, x, z), `${city}: ${ex.name} blocked at (${fmt(x, 2)}, ${fmt(z, 2)})`); });
              const m = mouthOf(ex);
              for (let z = Z.front; z < LANES.far[0]; z += 0.25) assert(!blocked(g, (m.x0 + m.x1) / 2, z), `${city}: ${ex.name}'s mouth blocked at z ${z}`);
            } else for (let z = LANES.south[1]; z < Z.edge - 0.3; z += 0.25) assert(!blocked(g, (ex.x0 + ex.x1) / 2, z), `${city}: ${ex.name} blocked at z ${z}`);
          }
          for (const p of S.props.filter(p => p.kind === 'bench')) for (const sx of p.seats) assert(!blocked(g, sx, 12.96), `${city}: a seat is blocked at ${sx}`);
        }
      }
      console.log(`      ${checked} points along the lanes of 6 games in 3 cities: clear`);
    },
  },
  {
    name: 'cities: every way of the city graph is clear at its full width, round every dogleg',
    fn() {
      let checked = 0, doglegs = 0;
      for (const city of OTHERS) for (const seed of [3, 41]) for (let row = -5; row <= 5; row++) for (let i = -5; i <= 5; i++) {
        const town = `${city}:${seed}`, S = sectionOf(town, row, i);
        const probe = (x, z, why) => { checked++; assert(clearAt(town, row, x, z), `${town} row ${row}: ${why} blocked at (${fmt(x, 2)}, ${fmt(z, 2)})`); };
        for (const [line, z] of Object.entries(LINE)) for (let x = S.x0; x < S.x1; x += 0.5) for (const o of [-HALF[line], 0, HALF[line]]) probe(x, z + o, `line ${line}`);
        for (const c of S.crossings) { const x = (c.x0 + c.x1) / 2; for (let z = LINE.F; z <= LINE.P; z += 0.25) for (const o of [-HALF.zebra, 0, HALF.zebra]) probe(x + o, z, 'the zebra and the gate'); }
        for (const c of S.crossingsS) { const x = (c.x0 + c.x1) / 2; for (let z = LINE.P; z <= LINE.S; z += 0.25) for (const o of [-HALF.zebra, 0, HALF.zebra]) probe(x + o, z, 'the way south'); }
        for (const g of S.gapsN) {
          if (g.jog) doglegs++;
          along(g, (x, z, nx, nz) => { if (z >= Z.north + 0.4) for (const o of [-HALF[g.kind], 0, HALF[g.kind]]) probe(x + nx * o, z + nz * o, g.name); });
          const m = mouthOf(g), mx = (m.x0 + m.x1) / 2;
          for (let z = Z.front; z <= LINE.F; z += 0.25) for (const o of [-HALF[g.kind], 0, HALF[g.kind]]) probe(mx + o, z, `${g.name}'s mouth`);
        }
        for (const g of S.gapsS) { const x = (g.x0 + g.x1) / 2; for (let z = LINE.S; z <= Z.edge - 0.4; z += 0.25) for (const o of [-HALF[g.kind], 0, HALF[g.kind]]) probe(x + o, z, `${g.name}, south`); }
      }
      console.log(`      ${checked} points on the ways of 3 cities × 2 towns × 11 streets × 11 sections (${doglegs} doglegs): clear`);
    },
  },
  {
    name: 'cities: routes across ten streets and more, walked at every offset, never blocked',
    fn() {
      const r = stream('cities-routes');
      let n = 0, len = 0, turns = 0;
      for (const city of OTHERS) for (let k = 0; k < 20; k++) {
        const town = `${city}:${1 + int(r, 1e6)}`;
        const from = { row: 0, x: range(r, -100, 100), z: LINE.F }, to = { row: (int(r, 2) ? 1 : -1) * (10 + int(r, 4)), x: from.x + range(r, -600, 600), z: LINE.P };
        const route = planRoute(town, from, to, { walker: k, evasive: k % 4 === 0 });
        for (const f of [-1, 0, 1]) for (let s = 0; s <= route.length; s += 0.2) {
          const p = placeAt(route, s, f);
          assert(!inBounds(p.z) || clearAt(town, p.row, p.x, p.z), `${town}, walker ${k}: blocked at row ${p.row} (${fmt(p.x, 2)}, ${fmt(p.z, 2)}), ${fmt(s, 1)} m along`);
        }
        const end = route.pts[route.pts.length - 1];
        assert(end.row === to.row && Math.abs(end.x - to.x) < 1e-6, 'the route ends at its goal');
        assert(route.rows >= 10, 'ten changes of street at least');
        turns += route.pts.filter((p, j) => j && !p.jump && p.z < Z.front && p.row === route.pts[j - 1].row && Math.abs(p.z - route.pts[j - 1].z) < 1e-6 && Math.abs(p.x - route.pts[j - 1].x) > 0.5).length;
        len += route.length; n++;
      }
      console.log(`      ${n} routes of 10–13 streets in 3 cities: ${fmt(len / n, 0)} m on average, ${turns} times round a dogleg's turn`);
    },
  },
  {
    name: 'cities: from anywhere walkable (a court, a square, up a dogleg), a way onto the lines and on',
    fn() {
      const r = stream('cities-join');
      let n = 0, odd = 0;
      for (const city of OTHERS) for (let k = 0; k < 160; k++) {
        const town = `${city}:${1 + int(r, 1e6)}`, row = int(r, 5) - 2, i = int(r, 9) - 4, S = sectionOf(town, row, i);
        // (half the spots off the street: in a dogleg, a court, a square, if the section has one)
        const T = terraceOf(town, row, i), offs = [...S.gapsN.filter(g => g.jog).map(g => ['jog', g]), ...T.courts.map(c => ['court', c]), ...T.squares.map(q => ['square', q])];
        let x, z, what = 'anywhere';
        if (offs.length && k % 2) {
          const [kind, o] = offs[int(r, offs.length)];
          what = kind;
          if (kind === 'jog') { const L = laneLine(o), j = 1 + int(r, L.length - 1), t = range(r, 0, 1); x = L[j - 1].x + (L[j].x - L[j - 1].x) * t; z = L[j - 1].z + (L[j].z - L[j - 1].z) * t; }
          else { x = range(r, o.x0 + 0.5, o.x1 - 0.5); z = range(r, o.z + 0.5, Z.front - 0.3); }
        } else { x = range(r, S.x0, S.x1); z = range(r, Z.north + 1, Z.edge - 1); }
        if (!clearAt(town, row, x, z)) continue;
        if (z > Z.hedge && !S.gapsS.some(g => x > g.x0 && x < g.x1)) continue;   // (behind the hedge: nobody can get there)
        const inLaneN = z < Z.front && S.gapsN.some(g => inLane(g, x, z));
        if (!inLaneN && z <= Z.hedge) assert(joinLine(town, row, x, z, JOIN_DEEP_M), `stranded in ${what} at ${town} row ${row} (${fmt(x, 2)}, ${fmt(z, 2)})`);
        const route = routeFrom(town, { row, x, z }, { row: row - 1, x: x + 80, z: LINE.F }, { walker: k });
        for (let s = 0; s <= route.length; s += 0.2) { const p = placeAt(route, s, 0); assert(!inBounds(p.z) || clearAt(town, p.row, p.x, p.z), `from ${what} at ${town} row ${row} (${fmt(x, 2)}, ${fmt(z, 2)}): blocked at row ${p.row} (${fmt(p.x, 2)}, ${fmt(p.z, 2)})`); }
        if (what !== 'anywhere') odd++;
        n++;
      }
      console.log(`      ${n} walkable spots in 3 cities (${odd} in doglegs, courts and squares): every one joined a line and routed on`);
    },
  },
  {
    name: 'cities: nobody vanishes in the open on screen, in each city',
    fn() {
      for (const city of OTHERS) {
        const g = newGame({ seed: 9, city }), bus = createBus();
        start(g, bus);
        let vanished = 0, left = 0;
        const where = new Map();
        for (let t = 0; t < 20 * 60 * 3; t++) {
          const me = playerActor(g);
          step(g, t < 20 * 80 ? { mx: 1, mz: 0 } : t < 20 * 160 ? { mx: -1, mz: 0 } : {}, bus);
          const now = new Set(g.actors.filter(a => onMap(g, a)).map(a => a.id));
          for (const [id, [x, z, mx, mz]] of where) {
            if (now.has(id)) continue;
            left++;
            const door = Math.abs(z - (Z.front + 0.3)) < 0.8, edge = z < Z.north + 2 || z > Z.edge - 2;
            if (!door && !edge && Math.abs(x - mx) < 21 && Math.abs(z - mz) < 17) vanished++;
            where.delete(id);
          }
          for (const a of g.actors) if (isPasserby(a) && onMap(g, a)) where.set(a.id, [a.x, a.z, me.x, me.z]);
        }
        console.log(`      ${CITIES[city].name}: 3 game minutes walking the street both ways, ${left} passers-by left, ${vanished} of them in the open on screen; ${g.actors.filter(a => isPasserby(a) && onMap(g, a)).length} on the street`);
        assert(vanished === 0, `${city}: someone vanished in the middle of the street`);
      }
    },
  },
  {
    name: 'cities: a follower stays with a careful man across ten streets and more, in each city',
    heavy: true,
    fn() {
      const N = Number(process.env.CHASE_N ?? (process.env.QUICK ? 2 : 6));
      let failed = 0;
      for (const city of OTHERS) {
        const runs = Array.from({ length: N }, (_, i) => [i, chase(5000 + i, { city, hour: i % 3 === 2 ? 22 : 12, keep: i % 2 ? 25 : 15, evasive: i % 3 === 0 ? true : 1, style: i % 2 ? 'wary' : 'calm' })]);
        const bad = runs.filter(([, x]) => x.blocked || x.lost || !x.arrived || x.d > 45);
        const mean = (k) => fmt(runs.reduce((a, [, x]) => a + x[k], 0) / N, 1);
        console.log(`      ${CITIES[city].name}, ${N} chases (noon and night, 15 and 25 m back): ${mean('length')} m and ${mean('minutes')} min a chase, ${Math.min(...runs.map(([, x]) => x.maps))}–${Math.max(...runs.map(([, x]) => x.maps))} changes of street; ${mean('d')} m behind at the end (furthest ${fmt(Math.max(...runs.map(([, x]) => x.gapMax)), 0)} m)`);
        for (const [i, x] of bad) console.log(`      ✗ ${city} chase ${5000 + i}: ${x.blocked ?? (x.lost ? 'lost him' : !x.arrived ? 'never arrived' : `${fmt(x.d, 0)} m behind`)} after ${fmt(x.minutes, 1)} min, ${x.maps} streets`);
        failed += bad.length;
      }
      assert(!failed, `${failed} chases failed`);
    },
  },
];
