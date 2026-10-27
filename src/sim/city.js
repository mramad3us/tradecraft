// TRADECRAFT sim: the city as a graph to plan routes on (DESIGN.md: World size, The background game).
//
// The city is rows of streets (sim/map/street.js), each a map. On each row people walk four lines
// running east–west, the middles of the street's lanes (LINE: F the far pavement, N the near one, P the
// boulevard's path, S the far pavement south of it), and pass between them only where the generator
// keeps a way clear: the zebra over the street (F–N) and on through the railing's gap to the path
// (N–P); the far road's zebra or a park's paths (P–S); and, between rows, the side streets and alleys
// (F of a row to S of the row north: the same lanes, from either end; a dogleg's from its mouth on the
// street to its top, round its turn: laneLine()). Each of those ways is clear by construction for
// HALF metres either side of its middle (tests/city.test.mjs walks them all), so a route along them
// can't be blocked: the guarantee the background game rests on.
//
// A place up a dogleg is reached by the lane's mouth and round its turn (laneFoot()); from in one, a
// route goes along it (routeFrom()), to another place in it or out at whichever end the goal lies.
//
// planRoute() finds a way between two places: A* over the portals (where those ways meet), within a
// window of the city round the two ends. Each walker sees the costs a little differently (NOISE, from
// a seed of its own: the same walker plans the same way), so two walkers take different ways. A
// careful walker (evasive) goes by way of VIA points off the straight line, and the route wanders and
// doubles back. A route is a polyline of points { row, x, z, w }: w the half-width of the way from
// that point to the next; a change of row is two points at the two ends of a lane (the map's seam
// between them, `jump` on the second), so its length counts once.
import { section, Z, LANES, SECTION_M, ROW_M, mouthOf, inLane, laneLine, laneLength } from './map/street.js';
import { stream, next, range, int, chance, hash } from './rng.js';
import { cityOf } from './cities/index.js';

const mid = (lane) => (LANES[lane][0] + LANES[lane][1]) / 2;
export const LINE = { F: mid('far'), N: mid('near'), P: mid('path'), S: mid('south') };
// How far either side of a way's middle is clear (m): the lines by their lane's band, less a margin
// for a walker's radius; the crossings and lanes by their width.
export const HALF = { F: 1.0, N: 0.6, P: 1.1, S: 0.8, zebra: 1.0, side: 2.4, alley: 0.6, mews: 2.0, stairs: 1.2, souk: 1.0, haret: 0.8, attach: 0 };
export const NOISE = 0.35;                                         // a walker's costs: × (1 ± this)
export const CROSS_COST = 4;                                       // a zebra's wait, as metres walked
export const WINDOW_M = 220;                                       // the planner looks this far beyond the two ends
export const LANE_M = (LINE.F - Z.north) + (Z.edge - LINE.S);      // F of a row to S of the row north, up a lane

// ---------- the city's sections, kept ----------

// A cache over sim/map/street.js section(): by seed, then row and index in one number (no string
// built a lookup: a route's checks ask hundreds of thousands of times). Each entry keeps its blockers'
// x extent, so clearAt() passes over a section that can't reach the spot, and when it was last used:
// past SECTIONS_KEPT (about 30 MB of them), the quarter used longest ago go (another game's first).
export const SECTIONS_KEPT = 800;
const cache = new Map();                                           // seed → Map(row · 65536 + i → { S, bx0, bx1, used })
let kept = 0, clock = 0, lastSeed = null, last = null;
function entryOf(seed, row, i) {
  if (seed !== lastSeed) {
    lastSeed = seed; last = cache.get(seed);
    if (!last) { last = new Map(); cache.set(seed, last); }
  }
  const k = row * 65536 + i;
  let e = last.get(k);
  if (!e) {
    const S = section(seed, i, row);
    let bx0 = Infinity, bx1 = -Infinity;
    for (const b of S.blockers) { if (b.x0 < bx0) bx0 = b.x0; if (b.x1 > bx1) bx1 = b.x1; }
    e = { S, bx0, bx1, used: 0 };
    last.set(k, e);
    if (++kept > SECTIONS_KEPT) forget();
  }
  e.used = ++clock;
  return e;
}
// Down to three quarters of SECTIONS_KEPT, those used longest ago first (a game left behind, all of it).
function forget() {
  const all = [];
  for (const m of cache.values()) for (const [k, e] of m) all.push([e.used, m, k]);
  all.sort((a, b) => a[0] - b[0]);
  for (let j = 0; kept > SECTIONS_KEPT * 0.75; j++, kept--) all[j][1].delete(all[j][2]);
  for (const [s, m] of cache) if (!m.size && m !== last) cache.delete(s);
}
/** Section i of row `row` (kept: see above). */
export const sectionOf = (seed, row, i) => entryOf(seed, row, i).S;
/** How many sections are kept (for tests). */
export const sectionsKept = () => kept;

/** Where on a row's lines a place (x, z) belongs: the line, and the way off it if it's in a lane. */
export function lineOf(seed, row, x, z) {
  if (z < Z.front) return 'F';                                     // (in a lane north: by its foot)
  if (z <= Z.kerbS) return 'F';
  if (z <= Z.fence + 0.5) return 'N';
  const S = sectionOf(seed, row, Math.floor(x / SECTION_M));
  if (z > Z.south) return 'S';
  if (S.band === 'park') return z < (LINE.P + LINE.S) / 2 ? 'P' : 'S';
  return z < Z.fenceS + 0.4 ? 'P' : 'S';
}

// ---------- the graph, in a window ----------

/**
 * The portals of a window of the city (rows r0 … r1, sections i0 … i1): per row and line, the x of
 * every way off it, and the links between them.
 */
function graphOf(seed, r0, r1, i0, i1) {
  const nodes = new Map();                                         // key → { key, row, line, x, links: [[key, cost, kind, w]] }
  const node = (row, line, x) => {
    const key = `${row}|${line}|${Math.round(x * 100) / 100}`;
    let n = nodes.get(key);
    if (!n) { n = { key, row, line, x, links: [] }; nodes.set(key, n); }
    return n;
  };
  const link = (a, b, cost, kind, w, lane = null) => { a.links.push([b.key, cost, kind, w, lane]); b.links.push([a.key, cost, kind, w, lane]); };
  for (let row = r0; row <= r1; row++) {
    for (let i = i0; i <= i1; i++) {
      const S = sectionOf(seed, row, i);
      for (const c of S.crossings) {
        const x = (c.x0 + c.x1) / 2;
        link(node(row, 'F', x), node(row, 'N', x), LINE.N - LINE.F + CROSS_COST, 'zebra', HALF.zebra);
        link(node(row, 'N', x), node(row, 'P', x), LINE.P - LINE.N, 'gate', HALF.zebra);
      }
      for (const c of S.crossingsS) {
        const x = (c.x0 + c.x1) / 2;
        link(node(row, 'P', x), node(row, 'S', x), LINE.S - LINE.P + (S.band === 'park' ? 0 : CROSS_COST), S.band === 'park' ? 'path' : 'zebra', HALF.zebra);
      }
      if (row > r0) for (const g of S.gapsN) {                    // up a lane to the row north (a dogleg: from its mouth, round its turn, to its top)
        const m = mouthOf(g), x = (g.x0 + g.x1) / 2;
        link(node(row, 'F', (m.x0 + m.x1) / 2), node(row - 1, 'S', x), g.jog ? LANE_M - (LINE.F - Z.north) + (LINE.F - Z.front) + laneLength(g) : LANE_M, g.kind, HALF[g.kind], g.jog ? g : null);
      }
    }
  }
  // Along each line, between neighbouring portals.
  const lines = new Map();
  for (const n of nodes.values()) {
    const k = `${n.row}|${n.line}`;
    if (!lines.has(k)) lines.set(k, []);
    lines.get(k).push(n);
  }
  for (const list of lines.values()) {
    list.sort((a, b) => a.x - b.x);
    for (let j = 1; j < list.length; j++) link(list[j - 1], list[j], list[j].x - list[j - 1].x, 'line', HALF[list[j].line]);
  }
  return { nodes, node, link, lines };
}

/**
 * A place up a dogleg (its turn or beyond, or its mouth): the lane's foot on the street, and the way
 * from there to the place ({ x: the mouth's middle, via: the turn's points before it }); else null (a
 * place in a straight lane, a court or a square is reached straight up from the street below it).
 */
function laneFoot(seed, place) {
  if (place.z >= Z.front) return null;
  const g = sectionOf(seed, place.row, Math.floor(place.x / SECTION_M)).gapsN.find(gp => gp.jog && inLane(gp, place.x, place.z));
  if (!g) return null;
  // (in its mouth: straight up from the street; in its turn: up the mouth to the turn's middle, then
  // along; beyond: round the turn and up)
  const L = laneLine(g), w = g.x1 - g.x0;
  return { x: L[0].x, via: place.z >= g.jog.z ? [] : place.z >= g.jog.z - w ? [L[1]] : [L[1], L[2]] };
}

/** Put a place on the graph: a node on its line at its x, linked to its line's neighbours. */
function attach(g, seed, place) {
  const line = lineOf(seed, place.row, place.x, place.z);
  const k = `${place.row}|${line}`, list = g.lines.get(k) ?? [];
  const n = g.node(place.row, line, place.x);
  if (!list.includes(n)) {
    const left = list.filter(o => o.x < n.x).pop(), right = list.find(o => o.x > n.x);
    if (left) g.link(left, n, n.x - left.x, 'line', HALF[line]);
    if (right) g.link(n, right, right.x - n.x, 'line', HALF[line]);
    list.push(n); list.sort((a, b) => a.x - b.x);
    g.lines.set(k, list);
  }
  return { n, line };
}

// A binary heap of [cost, key].
function heap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(v) { a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop() {
      const top = a[0], last = a.pop();
      if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
      return top;
    },
  };
}

const gz = (row, z) => row * ROW_M + z;                           // a z across rows, for distances

/**
 * The way from place `from` to place `to` ({ row, x, z }), as a route { pts, cum, length, rows }.
 * walker: a seed for this walker's view of the costs; evasive: a roundabout way by VIA points (a
 * number of them, or true for 2–4), drawn from rng (the sim's, or a stream) when given.
 */
export function planRoute(seed, from, to, { walker = 1, evasive = 0, rng = null } = {}) {
  const r = rng ?? stream('route', seed, walker, from.row, Math.round(from.x), to.row, Math.round(to.x));
  const vias = [];
  const k = evasive === true ? 2 + int(r, 3) : evasive | 0;
  for (let j = 0; j < k; j++) {
    // Off the straight line: a row or two beyond either end now and then, back along the way it came.
    const t = (j + 1) / (k + 1) + range(r, -0.25, 0.35);
    const lo = Math.min(from.row, to.row) - 2, hi = Math.max(from.row, to.row) + 2;
    const row = Math.max(lo, Math.min(hi, Math.round(from.row + (to.row - from.row) * t + range(r, -2.5, 2.5))));
    const x = from.x + (to.x - from.x) * t + range(r, -160, 160);
    vias.push({ row, x, z: chance(r, 0.6) ? LINE.F : LINE.S });
  }
  const stops = [from, ...vias, to];
  let route = null;
  for (let j = 1; j < stops.length; j++) {
    const leg = planLeg(seed, stops[j - 1], stops[j], walker + j * 7919);
    route = route ? join(route, leg) : leg;
  }
  return finish(route);
}

/** One stretch: A* between two places, in a window round them (wider, if it has to be). */
export function planLeg(seed, from, to, walker = 1) {
  for (const k of [1, 3]) {
    const pts = planIn(seed, from, to, walker, WINDOW_M * k);
    if (pts) return pts;
  }
  throw new Error(`no way from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
}

function planIn(seed, from, to, walker, windowM) {
  const r0 = Math.min(from.row, to.row) - 1, r1 = Math.max(from.row, to.row) + 1;
  const i0 = Math.floor((Math.min(from.x, to.x) - windowM) / SECTION_M), i1 = Math.floor((Math.max(from.x, to.x) + windowM) / SECTION_M);
  const g = graphOf(seed, r0, r1, i0, i1);
  const fa = laneFoot(seed, from), fb = laneFoot(seed, to);
  const A = attach(g, seed, fa ? { ...from, x: fa.x } : from), B = attach(g, seed, fb ? { ...to, x: fb.x } : to);
  const cost = (a, b, c) => c * (1 + NOISE * (2 * ((hash(walker, a, b) % 10007) / 10007) - 1));
  const h = (n) => Math.hypot(n.x - B.n.x, gz(n.row, LINE[n.line]) - gz(B.n.row, LINE[B.n.line]));
  const best = new Map([[A.n.key, 0]]), prev = new Map(), open = heap();
  open.push([h(A.n), A.n.key]);
  while (open.size) {
    const [, key] = open.pop();
    if (key === B.n.key) break;
    const n = g.nodes.get(key), c0 = best.get(key);
    for (const [k2, c, kind, w, lane] of n.links) {
      const c1 = c0 + cost(key < k2 ? key : k2, key < k2 ? k2 : key, c);
      if (c1 < (best.get(k2) ?? Infinity)) { best.set(k2, c1); prev.set(k2, [key, kind, w, lane]); open.push([c1 + h(g.nodes.get(k2)), k2]); }
    }
  }
  if (!best.has(B.n.key)) return null;
  // Back from the goal: the nodes and the ways between them.
  const path = [];
  for (let key = B.n.key; key; key = prev.get(key)?.[0]) path.unshift([g.nodes.get(key), prev.get(key)]);
  // As points: off the start place onto its line, along, through the portals, off the line to the goal.
  // Each point says what the way on from it is (way: a line's letter, 'zebra', 'gate', 'path', a
  // lane's kind, 'attach') and how wide (w).
  const pts = [{ row: from.row, x: from.x, z: from.z, w: 0, way: 'attach' }];
  const at = (row, x, z, w, way, extra) => { const p = pts[pts.length - 1]; if (p.row === row && Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6) { p.w = w; p.way = way; return; } pts.push({ row, x, z, w, way, ...extra }); };
  if (fa) for (const q of fa.via.slice().reverse()) at(from.row, q.x, q.z, 0, 'attach');   // (down a dogleg, round its turn, to its mouth)
  at(from.row, fa ? fa.x : from.x, LINE[A.line], HALF[A.line], A.line);
  for (let j = 1; j < path.length; j++) {
    const [n, [, kind, w, lane]] = path[j], [p] = path[j - 1];
    const last = pts[pts.length - 1];
    last.w = w; last.way = kind === 'line' ? n.line : kind;
    if (n.row !== p.row) {                                         // a lane: up its length (round a dogleg's turn), the seam, on to the line
      const up = n.row < p.row, turn = lane?.jog ? laneLine(lane).slice(1, -1) : [], tx = lane ? (lane.x0 + lane.x1) / 2 : n.x;
      if (up) for (const q of turn) at(p.row, q.x, q.z, w, kind, { lane: kind });
      at(p.row, tx, up ? Z.north : Z.edge, w, kind, { lane: kind });
      pts.push({ row: n.row, x: tx, z: up ? Z.edge : Z.north, w, way: kind, jump: true });
      if (!up) for (const q of turn.slice().reverse()) at(n.row, q.x, q.z, w, kind, { lane: kind });
      at(n.row, n.x, LINE[n.line], HALF[n.line], n.line);
    } else at(n.row, n.x, LINE[n.line], HALF[n.line], n.line);
  }
  Object.assign(pts[pts.length - 1], { w: 0, way: 'attach' });
  if (fb) for (const q of fb.via) at(to.row, q.x, q.z, 0, 'attach');   // (up a dogleg from its mouth, round its turn)
  at(to.row, to.x, to.z, 0, 'attach');
  return pts;
}

// Join two stretches (the second starts where the first ends).
const join = (a, b) => [...a, ...b.slice(1)];

/** The route's cumulative lengths (a seam counts nothing), and the rows it changes. */
export function finish(pts) {
  const cum = [0];
  let rows = 0;
  for (let j = 1; j < pts.length; j++) {
    const a = pts[j - 1], b = pts[j];
    if (b.jump) rows++;
    cum.push(cum[j - 1] + (b.jump ? 0 : Math.hypot(b.x - a.x, b.z - a.z)));
  }
  return { pts, cum, length: cum[cum.length - 1], rows };
}

/**
 * Where s metres along a route is: { row, x, z, j (the segment), ux, uz (its direction), w (its
 * half-width) }. Past the end: the end.
 */
export function pointAt(route, s) {
  const { pts, cum } = route;
  let j = 1;
  while (j < pts.length - 1 && cum[j] < s) j++;
  const a = pts[j - 1], b = pts[j];
  const len = cum[j] - cum[j - 1];
  const k = len > 1e-9 ? Math.max(0, Math.min(1, (s - cum[j - 1]) / len)) : 1;
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
  // (a segment lies in one row; a seam has no length, and once reached we're on its far side)
  return { row: b.row, x: a.x + dx * k, z: a.z + dz * k, j, ux: dx / d, uz: dz / d, w: a.w ?? 0 };
}

/**
 * Whether a walker (radius r) at (x, z) on a row is clear of everything that blocks, by the row's
 * generated sections (no world needed: for checking routes anywhere in the city).
 */
export function clearAt(seed, row, x, z, r = 0.25) {
  const i = Math.floor(x / SECTION_M);
  for (let k = i - 1; k <= i + 1; k++) {
    const e = entryOf(seed, row, k);
    if (e.bx0 > x + r + 1e-6 || e.bx1 < x - r - 1e-6) continue;     // (nothing in it reaches x: the margin keeps rounding out of it)
    for (const b of e.S.blockers) {
      const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
      if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return false;
    }
  }
  return true;
}

/**
 * Where a walker is, s metres along a route, keeping to fraction f (−1 … 1) of each way's half-width
 * from its middle (left of the way positive): the offset turns from one way's to the next over the
 * first BLEND_M of the new one, so a corner is cut within both ways' widths, never outside them.
 */
export const BLEND_M = 1.2;
export function placeAt(route, s, f = 0) {
  const p = pointAt(route, s), { pts, cum } = route, j = p.j;
  const off = (k) => {
    const A = pts[k - 1], B = pts[k], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d < 1e-9) return [0, 0];
    // (no wider than its narrower end: a step off a line to a seat or a door ends on it, not beside it)
    const w = Math.min(A.w ?? 0, B.w ?? A.w ?? 0) * f;
    return [-dz / d * w, dx / d * w];
  };
  let [ox, oz] = off(j);
  const into = s - cum[j - 1];
  if (j > 1 && into < BLEND_M && !pts[j - 1].jump && pts[j - 2].row === pts[j - 1].row) {
    const [px, pz] = off(j - 1), t = Math.max(0, into) / BLEND_M;
    ox = px + (ox - px) * t; oz = pz + (oz - pz) * t;
  }
  return { row: p.row, x: p.x + ox, z: p.z + oz, ux: p.ux, uz: p.uz, j };
}

/** The nearest walkable way onto a line from a place anywhere walkable: a short search on a grid. */
export const JOIN_CELL = 0.25;
export const JOIN_DEEP_M = 32;                                     // (how far it looks in a city with courts and squares off its streets)
const JOIN_R = 0.27;                                               // a walker's radius, and 2 cm to spare
export function joinLine(seed, row, x, z, maxM = 14) {
  // Already on a line's band?
  for (const [line, lz] of Object.entries(LINE)) if (Math.abs(z - lz) <= HALF[line] && lineOf(seed, row, x, z) === line) return [{ row, x, z, w: 0 }, { row, x, z: lz, w: 0 }];
  // (from the grid's points round the spot that are clear and a straight step away)
  const key = (i, k) => `${i},${k}`, prev = new Map(), queue = [];
  const fi = Math.floor(x / JOIN_CELL), fk = Math.floor(z / JOIN_CELL);
  for (const [i, k] of [[fi, fk], [fi + 1, fk], [fi, fk + 1], [fi + 1, fk + 1]]) {
    const p = { row, x: i * JOIN_CELL, z: k * JOIN_CELL };
    if (clearAt(seed, row, p.x, p.z) && straight(seed, { row, x, z }, p)) { prev.set(key(i, k), null); queue.push([i, k]); }
  }
  const onLine = (zz, xx) => Object.entries(LINE).some(([line, lz]) => Math.abs(zz - lz) < 0.13 && lineOf(seed, row, xx, zz) === line);
  for (let q = 0; q < queue.length && q < 40000; q++) {
    const [i, k] = queue[q], cx = i * JOIN_CELL, cz = k * JOIN_CELL;
    if (onLine(cz, cx)) {
      const path = [];
      for (let c = [i, k]; c; c = prev.get(key(...c))) path.unshift({ row, x: c[0] * JOIN_CELL, z: c[1] * JOIN_CELL, w: 0 });
      path.unshift({ row, x, z, w: 0 });
      return simplify(seed, path);
    }
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = [i + di, k + dk], nk = key(...n);
      if (prev.has(nk) || Math.hypot(n[0] * JOIN_CELL - x, n[1] * JOIN_CELL - z) > maxM) continue;
      // (the step itself clear all along it, with a little to spare: a step past a corner can clip it)
      if (!clearAt(seed, row, n[0] * JOIN_CELL, n[1] * JOIN_CELL) || !straight(seed, { row, x: cx, z: cz }, { row, x: n[0] * JOIN_CELL, z: n[1] * JOIN_CELL }, JOIN_R)) continue;
      prev.set(nk, [i, k]);
      queue.push(n);
    }
  }
  return null;
}
// Drop the grid's needless corners: keep a point only where the straight way past it isn't clear.
function simplify(seed, path) {
  const out = [path[0]];
  let a = 0;
  for (let b = 2; b < path.length; b++) {
    if (!straight(seed, path[a], path[b])) { out.push(path[b - 1]); a = b - 1; }
  }
  out.push(path[path.length - 1]);
  return out;
}
function straight(seed, a, b, r = JOIN_R) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  // (the margin along the way, not at its ends: a walker may stand closer than that already)
  for (let t = 0; t <= d; t += 0.05) if (!clearAt(seed, a.row, a.x + (b.x - a.x) * t / d, a.z + (b.z - a.z) * t / d, t < 0.1 || d - t < 0.1 ? 0.25 : r)) return false;
  return true;
}

/** A route from anywhere walkable (on to a line first, if need be) to a place. */
export function routeFrom(seed, from, to, opts = {}) {
  // In a lane: along it, toward whichever end the goal lies (through the seam to the next row).
  const S = sectionOf(seed, from.row, Math.floor(from.x / SECTION_M));
  const lane = from.z < Z.front ? S.gapsN.find(g => inLane(g, from.x, from.z)) : from.z > Z.hedge ? S.gapsS.find(g => from.x >= g.x0 && from.x <= g.x1) : null;
  if (lane?.jog && from.z < Z.front) {                             // in a dogleg: along it, round its turn, toward whichever end the goal lies
    const onward = to.row < from.row, L = laneLine(lane), w = HALF[lane.kind];
    // (the leg a place is in: the nearest segment of the lane's line, and the point on it)
    const legOf = (q) => {
      let best = null;
      for (let j = 1; j < L.length; j++) { const a = L[j - 1], b = L[j], t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.z - a.z) * (b.z - a.z)) / (((b.x - a.x) ** 2 + (b.z - a.z) ** 2) || 1))), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, d = Math.hypot(x - q.x, z - q.z); if (!best || d < best.d) best = { k: j, x, z, d }; }
      return best;
    };
    const lf = legOf(from), k = lf.k;
    const pts = [{ row: from.row, x: from.x, z: from.z, w: 0 }, { row: from.row, x: lf.x, z: lf.z, w }];
    const tx = (lane.x0 + lane.x1) / 2, mx = (lane.jog.x0 + lane.jog.x1) / 2;
    if (to.row === from.row && to.z < Z.front && inLane(lane, to.x, to.z)) {   // (the goal up the same dogleg: along it, not out to the street and back)
      const lt = legOf(to), turn = lt.k > k ? L.slice(k, lt.k) : lt.k < k ? L.slice(lt.k, k).reverse() : [];
      for (const q of turn) pts.push({ row: from.row, x: q.x, z: q.z, w });
      pts.push({ row: from.row, x: lt.x, z: lt.z, w }, { row: from.row, x: to.x, z: to.z, w: 0 });
      return finish(pts);
    }
    if (onward) {
      for (const q of L.slice(k)) pts.push({ row: from.row, x: q.x, z: q.z, w });
      pts.push({ row: from.row - 1, x: tx, z: Z.edge, w, jump: true });
      const rest = planRoute(seed, { row: from.row - 1, x: tx, z: LINE.S }, to, opts);
      return finish([...pts, ...rest.pts]);
    }
    for (const q of L.slice(0, k).reverse()) pts.push({ row: from.row, x: q.x, z: q.z, w });
    const rest = planRoute(seed, { row: from.row, x: mx, z: LINE.F }, to, opts);
    return finish([...pts, ...rest.pts]);
  }
  if (lane) {
    const gx = (lane.x0 + lane.x1) / 2, north = from.z < Z.front, onward = north ? to.row < from.row : to.row > from.row;
    const pts = [{ row: from.row, x: from.x, z: from.z, w: 0 }, { row: from.row, x: gx, z: from.z, w: HALF[lane.kind] }];
    if (onward) {
      const row = from.row + (north ? -1 : 1);
      pts.push({ row: from.row, x: gx, z: north ? Z.north : Z.edge, w: HALF[lane.kind] }, { row, x: gx, z: north ? Z.edge : Z.north, w: HALF[lane.kind], jump: true });
      const rest = planRoute(seed, { row, x: gx, z: north ? LINE.S : LINE.F }, to, opts);
      return finish([...pts, ...rest.pts]);
    }
    const rest = planRoute(seed, { row: from.row, x: gx, z: north ? LINE.F : LINE.S }, to, opts);
    return finish([...pts, ...rest.pts]);
  }
  const j = joinLine(seed, from.row, from.x, from.z, cityOf(seed).terrace ? JOIN_DEEP_M : 14);   // (a court or a square goes back further than a lawn)
  if (!j) throw new Error(`stranded at ${JSON.stringify(from)}`);
  const last = j[j.length - 1];
  const rest = planRoute(seed, { row: last.row, x: last.x, z: last.z }, to, opts);
  return finish([...j.slice(0, -1), ...rest.pts]);
}
