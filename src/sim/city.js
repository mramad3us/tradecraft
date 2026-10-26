// TRADECRAFT sim: the city as a graph to plan routes on (DESIGN.md: World size, The background game).
//
// The city is rows of streets (sim/map/street.js), each a map. On each row people walk four lines
// running east–west, the middles of the street's lanes (LINE: F the far pavement, N the near one, P the
// boulevard's path, S the far pavement south of it), and pass between them only where the generator
// keeps a way clear: the zebra over the street (F–N) and on through the railing's gap to the path
// (N–P); the far road's zebra or a park's paths (P–S); and, between rows, the side streets and alleys
// (F of a row to S of the row north: the same lanes, from either end). Each of those ways is clear
// by construction for HALF metres either side of its middle (tests/city.test.mjs walks them all), so
// a route along them can't be blocked: the guarantee the background game rests on.
//
// planRoute() finds a way between two places: A* over the portals (where those ways meet), within a
// window of the city round the two ends. Each walker sees the costs a little differently (NOISE, from
// a seed of its own: the same walker plans the same way), so two walkers take different ways. A
// careful walker (evasive) goes by way of VIA points off the straight line, and the route wanders and
// doubles back. A route is a polyline of points { row, x, z, w }: w the half-width of the way from
// that point to the next; a change of row is two points at the two ends of a lane (the map's seam
// between them, `jump` on the second), so its length counts once.
import { section, Z, LANES, SECTION_M, ROW_M } from './map/street.js';
import { stream, next, range, int, chance, hash } from './rng.js';

const mid = (lane) => (LANES[lane][0] + LANES[lane][1]) / 2;
export const LINE = { F: mid('far'), N: mid('near'), P: mid('path'), S: mid('south') };
// How far either side of a way's middle is clear (m): the lines by their lane's band, less a margin
// for a walker's radius; the crossings and lanes by their width.
export const HALF = { F: 1.0, N: 0.6, P: 1.1, S: 0.8, zebra: 1.0, side: 2.4, alley: 0.6, attach: 0 };
export const NOISE = 0.35;                                         // a walker's costs: × (1 ± this)
export const CROSS_COST = 4;                                       // a zebra's wait, as metres walked
export const WINDOW_M = 220;                                       // the planner looks this far beyond the two ends
export const LANE_M = (LINE.F - Z.north) + (Z.edge - LINE.S);      // F of a row to S of the row north, up a lane

// ---------- the city's sections, kept ----------

const cache = new Map();
/** Section i of row `row` (a cache over sim/map/street.js section()). */
export function sectionOf(seed, row, i) {
  const k = `${seed}|${row}|${i}`;
  let S = cache.get(k);
  if (!S) {
    S = section(seed, i, row);
    cache.set(k, S);
    if (cache.size > 6000) cache.delete(cache.keys().next().value);
  }
  return S;
}

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
  const link = (a, b, cost, kind, w) => { a.links.push([b.key, cost, kind, w]); b.links.push([a.key, cost, kind, w]); };
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
      if (row > r0) for (const g of S.gapsN) {                    // up a lane to the row north
        const x = (g.x0 + g.x1) / 2;
        link(node(row, 'F', x), node(row - 1, 'S', x), LANE_M, g.kind, HALF[g.kind]);
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
  const A = attach(g, seed, from), B = attach(g, seed, to);
  const cost = (a, b, c) => c * (1 + NOISE * (2 * ((hash(walker, a, b) % 10007) / 10007) - 1));
  const h = (n) => Math.hypot(n.x - B.n.x, gz(n.row, LINE[n.line]) - gz(B.n.row, LINE[B.n.line]));
  const best = new Map([[A.n.key, 0]]), prev = new Map(), open = heap();
  open.push([h(A.n), A.n.key]);
  while (open.size) {
    const [, key] = open.pop();
    if (key === B.n.key) break;
    const n = g.nodes.get(key), c0 = best.get(key);
    for (const [k2, c, kind, w] of n.links) {
      const c1 = c0 + cost(key < k2 ? key : k2, key < k2 ? k2 : key, c);
      if (c1 < (best.get(k2) ?? Infinity)) { best.set(k2, c1); prev.set(k2, [key, kind, w]); open.push([c1 + h(g.nodes.get(k2)), k2]); }
    }
  }
  if (!best.has(B.n.key)) return null;
  // Back from the goal: the nodes and the ways between them.
  const path = [];
  for (let key = B.n.key; key; key = prev.get(key)?.[0]) path.unshift([g.nodes.get(key), prev.get(key)]);
  // As points: off the start place onto its line, along, through the portals, off the line to the goal.
  const pts = [{ row: from.row, x: from.x, z: from.z, w: 0 }];
  const at = (row, x, z, w, extra) => { const p = pts[pts.length - 1]; if (p.row === row && Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6) { p.w = w; return; } pts.push({ row, x, z, w, ...extra }); };
  at(from.row, from.x, LINE[A.line], HALF[A.line]);
  for (let j = 1; j < path.length; j++) {
    const [n, [, kind, w]] = path[j], [p] = path[j - 1];
    pts[pts.length - 1].w = w;
    if (n.row !== p.row) {                                         // a lane: up its length, the seam, on to the line
      const up = n.row < p.row;
      at(p.row, n.x, up ? Z.north : Z.edge, w, { lane: kind });
      pts.push({ row: n.row, x: n.x, z: up ? Z.edge : Z.north, w, jump: true });
      at(n.row, n.x, LINE[n.line], HALF[n.line]);
    } else at(n.row, n.x, LINE[n.line], kind === 'line' ? w : HALF[n.line]);
  }
  pts[pts.length - 1].w = 0;
  at(to.row, to.x, to.z, 0);
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
  for (const k of [i - 1, i, i + 1]) {
    for (const b of sectionOf(seed, row, k).blockers) {
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
    const w = (A.w ?? 0) * f;
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
      // (the step itself clear, not only its ends: a step past a corner can clip it)
      if (!clearAt(seed, row, n[0] * JOIN_CELL, n[1] * JOIN_CELL) || !clearAt(seed, row, (i + di / 2) * JOIN_CELL, (k + dk / 2) * JOIN_CELL)) continue;
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
function straight(seed, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  for (let t = 0; t <= d; t += 0.1) if (!clearAt(seed, a.row, a.x + (b.x - a.x) * t / d, a.z + (b.z - a.z) * t / d)) return false;
  return true;
}

/** A route from anywhere walkable (on to a line first, if need be) to a place. */
export function routeFrom(seed, from, to, opts = {}) {
  // In a lane: along it, toward whichever end the goal lies (through the seam to the next row).
  const S = sectionOf(seed, from.row, Math.floor(from.x / SECTION_M));
  const lane = from.z < Z.front ? S.gapsN.find(g => from.x >= g.x0 && from.x <= g.x1) : from.z > Z.hedge ? S.gapsS.find(g => from.x >= g.x0 && from.x <= g.x1) : null;
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
  const j = joinLine(seed, from.row, from.x, from.z);
  if (!j) throw new Error(`stranded at ${JSON.stringify(from)}`);
  const last = j[j.length - 1];
  const rest = planRoute(seed, { row: last.row, x: last.x, z: last.z }, to, opts);
  return finish([...j.slice(0, -1), ...rest.pts]);
}
