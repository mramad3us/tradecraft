// TRADECRAFT sim: the map being played, at runtime. Sections, what blocks, who's near whom.
//
// The saved state holds only what the map is (state.map: its kind, seed and bounds) and who's on it
// (state.actors). Everything derived is rebuilt on load into state.$world (runtime only, never
// saved): the generated sections in play, a grid of the blockers (BUCKET_M buckets), and a grid of
// the actors rebuilt each tick, so finding who's near someone never walks the whole crowd. The
// buildings' rectangles (walls) are kept apart too: they're what blocks a line of sight
// (sim/perception.js).
//
// The map is one row of the city's streets (state.map.row; sim/map/street.js); its exits lead to the
// rows north and south (exitAt(), and sim/game.js changeMap()). Or a room (state.map.kind: the dojo,
// sim/map/dojo.js), one section with no way out; or an interior (a flat: sim/map/interior.js), one section
// whose ways out are its doors.

/** A section of the map: a street's, or the room (the view builds the next street's ahead with it). */
export const sectionFor = (map, i) => (map.kind === 'dojo' ? dojo(map.seed) : map.kind === 'interior' ? interior(map) : section(townOf(map), i, map.row ?? 0));
//
// Sections come and go around a focus (the player, or a target the scenario follows): those within
// REACH_M are generated, those beyond DROP_M are dropped, and the bus hears of both so the renderer
// builds and frees their meshes. Which are in play is saved (state.map.inPlay), so a loaded game
// carries on with the very same street around it. Bounds: a finite map (i0 … i1) ends in walls at its ends; an endless
// one (i0 = i1 = null) grows as it's walked.
//
// Movement is a circle (RADIUS_M) against the blocker rectangles, axis by axis, so it slides along
// walls. People don't block each other (a crowd would trap the player): passers-by steer round
// whoever's near (sim/crowd.js), and the player walks through a shoulder or two.
import { section, sectionsAround, Z } from './map/street.js';
import { dojo } from './map/dojo.js';
import { interior } from './map/interior.js';
import { townOf } from './cities/index.js';
import { intoCar } from './traffic.js';

export const BUCKET_M = 4;
export const RADIUS_M = 0.25;
export const REACH_M = 70;                                         // sections within this of the focus are in play
export const DROP_M = 115;                                         // and dropped beyond this
export const BOUNDS_Z = [Z.north + 0.2, Z.edge - 0.2];

const key = (ix, iz) => ix * 73856093 ^ iz * 19349663;

/** Build state.$world for state.map, with the sections around x. */
export function attach(state, bus, x = 0) {
  const W = state.$world = { sections: new Map(), grid: new Map(), hash: new Map(), lamps: [], walls: [], bx: [0, 0] };
  for (const i of state.map.inPlay ?? []) { W.sections.set(i, sectionFor(state.map, i)); bus?.emit('section+', W.sections.get(i)); }
  reindex(W);
  refocus(state, bus, x);
  return W;
}

/** Bring the sections in play up to date around x (a number, or several: the focus and others to keep). */
export function refocus(state, bus, x) {
  const W = state.$world, map = state.map, xs = [x].flat();
  const want = [...new Set(xs.flatMap(v => sectionsAround(map, v, REACH_M)))];
  let changed = false;
  for (const i of want) {
    if (W.sections.has(i)) continue;
    W.sections.set(i, sectionFor(map, i));
    bus?.emit('section+', W.sections.get(i));
    changed = true;
  }
  for (const [i, S] of W.sections) {
    if (xs.some(v => Math.abs((S.x0 + S.x1) / 2 - v) <= DROP_M)) continue;
    W.sections.delete(i);
    bus?.emit('section-', S);
    changed = true;
  }
  if (changed) { reindex(W); map.inPlay = [...W.sections.keys()].sort((a, b) => a - b); }
}

function reindex(W) {
  W.grid.clear();
  W.lamps = [];
  W.walls = [];
  let a = Infinity, b = -Infinity;
  for (const S of W.sections.values()) {
    a = Math.min(a, S.x0); b = Math.max(b, S.x1);
    W.lamps.push(...S.lamps);
    for (const b of S.blockers) {
      if (b.what === 'building') W.walls.push(b);
      for (let ix = Math.floor(b.x0 / BUCKET_M); ix <= Math.floor(b.x1 / BUCKET_M); ix++) {
        for (let iz = Math.floor(b.z0 / BUCKET_M); iz <= Math.floor(b.z1 / BUCKET_M); iz++) {
          const k = key(ix, iz);
          if (!W.grid.has(k)) W.grid.set(k, []);
          W.grid.get(k).push(b);
        }
      }
    }
  }
  W.bx = [a + RADIUS_M, b - RADIUS_M];                              // walkable x: the sections in play
}

/** Whether a circle of radius r at (x, z) overlaps a blocker or leaves the walkable bounds. */
export function blocked(state, x, z, r = RADIUS_M) {
  const W = state.$world;
  const [bx0, bx1] = W.bx;
  if (x < bx0 || x > bx1 || z < BOUNDS_Z[0] || z > BOUNDS_Z[1]) return true;
  for (let ix = Math.floor((x - r) / BUCKET_M); ix <= Math.floor((x + r) / BUCKET_M); ix++) {
    for (let iz = Math.floor((z - r) / BUCKET_M); iz <= Math.floor((z + r) / BUCKET_M); iz++) {
      const list = W.grid.get(key(ix, iz));
      if (!list) continue;
      for (const b of list) {
        const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
        if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return true;
      }
    }
  }
  return false;
}

/** Move an actor by (dx, dz), sliding along what blocks it (the map, and the cars on the road: sim/traffic.js). Returns the distance moved. */
export function move(state, a, dx, dz) {
  const x0 = a.x, z0 = a.z, hit = (x, z) => blocked(state, x, z) || intoCar(state, a.x, a.z, x, z);
  if (!hit(a.x + dx, a.z + dz)) { a.x += dx; a.z += dz; }
  else {
    if (dx && !hit(a.x + dx, a.z)) a.x += dx;
    if (dz && !hit(a.x, a.z + dz)) a.z += dz;
  }
  return Math.hypot(a.x - x0, a.z - z0);
}

/** Rebuild the actor grid (once a tick). */
export function rehash(state) {
  const H = state.$world.hash;
  H.clear();
  for (const a of state.actors) {
    if (a.row !== undefined && a.row !== state.map.row) continue;     // (an agent on another street: in the background)
    const k = key(Math.floor(a.x / BUCKET_M), Math.floor(a.z / BUCKET_M));
    if (!H.has(k)) H.set(k, []);
    H.get(k).push(a);
  }
}

/** The actors within r of (x, z), from the grid as last rebuilt. */
export function near(state, x, z, r) {
  const H = state.$world.hash, out = [];
  for (let ix = Math.floor((x - r) / BUCKET_M); ix <= Math.floor((x + r) / BUCKET_M); ix++) {
    for (let iz = Math.floor((z - r) / BUCKET_M); iz <= Math.floor((z + r) / BUCKET_M); iz++) {
      for (const a of H.get(key(ix, iz)) ?? []) if ((a.x - x) ** 2 + (a.z - z) ** 2 <= r * r) out.push(a);
    }
  }
  return out;
}

/** The section holding x, if it's in play. */
export function sectionAt(state, x) {
  for (const S of state.$world.sections.values()) if (x >= S.x0 && x < S.x1) return S;
  return null;
}

/** The way off the map the actor is going through, if any: an exit of its section (sim/map/street.js) crossed. */
export function exitAt(state, a) {
  const S = sectionAt(state, a.x);
  if (!S) return null;
  for (const ex of S.exits) {
    if (a.x < ex.x0 || a.x > ex.x1) continue;
    if (ex.dir === 'n' && a.z < Z.north + 0.5) return ex;
    if (ex.dir === 's' && a.z > Z.edge - 0.5) return ex;
  }
  return null;
}
