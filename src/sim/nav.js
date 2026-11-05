// TRADECRAFT sim: getting about a street map, for those who follow someone anywhere (the FSB's
// watchers, a scripted player). Passers-by don't need it: their plans keep to lanes laid clear.
//
// The map (sim/map/street.js) is zones divided by what can be crossed only at gaps:
//   'north'  the side streets and alleys (z < Z.front), entered within a gap of the terrace;
//   'street' the far pavement, the road, the near pavement (Z.front … Z.fence);
//   'band'   the boulevard (to its far railing, Z.fenceS) or the park (to Z.south), entered at the
//            zebra's line through the railing (a gate in a park);
//   'far'    the boulevard's far road and far pavement (Z.fenceS … Z.south), entered at the far
//            road's zebra line; in a park this is open to the band, so it's the band;
//   'south'  the lanes south through the hedge (z > Z.south), entered within a gap.
// waypoint() gives the next point to head for on the way to (x, z): the target itself in the same
// zone, else the gap toward it on the next boundary, reached along the zone's walking line. A
// railing's gap is the one that makes the walk there shortest, of the sections about the way (via()),
// not the nearest, which can be behind you: a watcher took one 25 m back the other way, its back to
// the man it followed, and lost him. It's greedy, one boundary at a time, which is enough for a map
// that's one row of a city. A follower should come within 0.25 m of a waypoint before asking for the next.
import { Z, LANES, SECTION_M, inLane, mouthOf, laneLine } from './map/street.js';
import { sectionAt } from './world.js';

export function zoneOf(state, x, z) {
  if (z < Z.front) return 'north';
  if (z <= Z.fence) return 'street';
  if (z > Z.south) return 'south';
  const S = sectionAt(state, x);
  if (S?.band === 'park') return 'band';
  return z < Z.fenceS + 0.05 ? 'band' : 'far';
}
const ORDER = ['north', 'street', 'band', 'far', 'south'];
const laneMid = (lane) => (LANES[lane][0] + LANES[lane][1]) / 2;

const nearest = (list, x) => list.map(c => (c.x0 + c.x1) / 2).sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
// The gap to cross by, from ax on the way to x: of the crossings (key) of the sections about the way,
// the one that makes the walk shortest, the nearer to ax of two as short. Not merely the nearest to ax,
// which can be behind you, the target crossing just ahead. The street and the band run on from a park
// to a boulevard, so any section's zebra will do; the far road's only one of S's kind (a railing closes
// a boulevard's far road off from a park, whose own ways south are paths in it).
function via(state, S, key, ax, x) {
  const lo = Math.min(ax, x) - SECTION_M, hi = Math.max(ax, x) + SECTION_M;
  let best = null, cost = Infinity, off = Infinity;
  for (const T of state.$world.sections.values()) {
    if ((key === 'crossingsS' && T.band !== S.band) || T.x1 < lo || T.x0 > hi) continue;
    for (const c of T[key]) {
      const cx = (c.x0 + c.x1) / 2, k = Math.abs(ax - cx) + Math.abs(cx - x), o = Math.abs(ax - cx);
      if (k < cost - 1e-6 || (k < cost + 1e-6 && o < off)) { best = cx; cost = k; off = o; }
    }
  }
  return best ?? nearest(S[key], ax);
}
const into = (g, x, m = 0.8) => Math.max(g.x0 + m, Math.min(g.x1 - m, x));

/** The next point for actor a to head for, on the way to (x, z). */
export function waypoint(state, a, x, z) {
  const from = zoneOf(state, a.x, a.z), to = zoneOf(state, x, z);
  if (from === to) return [x, z];
  const S = sectionAt(state, a.x);
  if (!S) return [x, z];
  // (in a park the band runs to the south walk: there's no 'far' there to pass through)
  const order = S.band === 'park' ? ORDER.filter(o => o !== 'far') : ORDER;
  const i = order.indexOf(from), j = order.indexOf(to === 'far' && S.band === 'park' ? 'band' : to);
  if (i < 0 || j < 0 || i === j) return [x, z];
  const down = j > i, step = order[i + (down ? 1 : -1)];
  // Along to the gap's line on the zone's walking line (clear of its lamps and benches), then through it.
  const line = from === 'street' ? (a.z < Z.kerbN ? laneMid('far') : laneMid('near')) : from === 'band' ? laneMid('path') : from === 'far' ? laneMid('south') : a.z;
  const at = (cx, zz) => (Math.abs(a.x - cx) > 0.25 ? [cx, Math.abs(a.x - cx) > 3 ? line : a.z] : [cx, zz]);
  // A lane: the one the target's in (or at), else the nearest.
  const lane = (key) => sectionAt(state, x)?.[key].find(g => (key === 'gapsN' && z < Z.front ? inLane(g, x, z, 0.5) : x >= g.x0 - 0.5 && x <= g.x1 + 0.5))
    ?? [...S[key]].sort((p, q) => Math.abs((p.x0 + p.x1) / 2 - a.x) - Math.abs((q.x0 + q.x1) / 2 - a.x))[0];
  if ((from === 'street' && step === 'north') || (from === 'north' && step === 'street')) {
    const g = from === 'north' ? S.gapsN.find(gp => inLane(gp, a.x, a.z, 0.5)) ?? lane('gapsN') : lane('gapsN');
    if (!g) return [a.x + Math.sign(x - a.x || 1) * 10, a.z];
    const m = mouthOf(g);
    if (from === 'north') {                                        // (out by its mouth: round a dogleg's turn first)
      if (!g.jog || (a.z > g.jog.z && a.x > m.x0 - 0.5 && a.x < m.x1 + 0.5)) return [a.x, Z.front + 0.8];
      const [, leg, top] = laneLine(g);
      return a.z < leg.z - 0.25 ? [top.x, leg.z] : [leg.x, leg.z + 0.5];
    }
    return a.x > m.x0 + 0.5 && a.x < m.x1 - 0.5 ? [into(m, a.x), Z.front - 1] : [into(m, a.x), Math.max(a.z, Z.front + 0.6)];
  }
  if ((from === 'street' && step === 'band') || (from === 'band' && step === 'street')) {
    const cx = via(state, S, 'crossings', a.x, x);
    return at(cx, down ? Z.fence + 0.8 : Z.fence - 0.8);
  }
  if ((from === 'band' && step === 'far') || (from === 'far' && step === 'band')) {
    const cx = via(state, S, 'crossingsS', a.x, x);
    return at(cx, down ? Z.fenceS + 0.9 : Z.fenceS - 0.9);
  }
  if ((from === 'far' && step === 'south') || (from === 'band' && step === 'south') || (from === 'south' && (step === 'far' || step === 'band'))) {
    const g = lane('gapsS');
    if (!g) return [a.x + Math.sign(x - a.x || 1) * 10, a.z];
    if (from === 'south') return [a.x, Z.south - 0.8];
    return a.x > g.x0 + 0.5 && a.x < g.x1 - 0.5 ? [into(g, a.x), Z.south + 1] : [into(g, a.x), Math.min(a.z, Z.south - 0.6)];
  }
  return [x, z];
}
