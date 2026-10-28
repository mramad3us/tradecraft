// TRADECRAFT sim: a way across an interior (sim/interiors/plan.js), round its walls and furniture: a grid
// of CELL_M squares over the plan, a square free if a person (RADIUS_M: the mover's circle) standing in its middle touches no
// blocker, and the shortest way over the free ones (eight ways round, a diagonal only where both its
// sides are free), pulled straight wherever a straight line stays on free squares. A flat is a few
// hundred squares: worked out when asked, nothing kept.
import { RADIUS_M as BODY_M } from '../world.js';

export const CELL_M = 0.25, RADIUS_M = BODY_M + 0.02;            // (the mover's circle, sim/world.js, and a hair)

/** Waypoints [[x, z]…] from (ax, az) to (bx, bz) over the section's interior, or null (no way). */
export function wayAcross(S, ax, az, bx, bz) {
  const p = S.plan, x0 = p.x0 - 0.5, z0 = p.z0 - 0.5, nx = Math.ceil((p.x1 - p.x0 + 1) / CELL_M), nz = Math.ceil((p.z1 - p.z0 + 1) / CELL_M);
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * CELL_M, cz = z0 + (j + 0.5) * CELL_M;
    free[j * nx + i] = S.blockers.some(b => cx > b.x0 - RADIUS_M && cx < b.x1 + RADIUS_M && cz > b.z0 - RADIUS_M && cz < b.z1 + RADIUS_M) ? 0 : 1;
  }
  const cell = (x, z) => [Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / CELL_M))), Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / CELL_M)))];
  // (the nearest free square to an end: someone standing at a table's edge)
  const near = ([i, j]) => { let best = null, bd = Infinity; for (let q = 0; q < nx * nz; q++) if (free[q]) { const d = (q % nx - i) ** 2 + (Math.floor(q / nx) - j) ** 2; if (d < bd) { bd = d; best = q; } } return best; };
  const [ai, aj] = cell(ax, az), [bi, bj] = cell(bx, bz), A = free[aj * nx + ai] ? aj * nx + ai : near([ai, aj]), B = free[bj * nx + bi] ? bj * nx + bi : near([bi, bj]);
  if (A === null || B === null) return null;
  const dist = new Float64Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz);
  dist[A] = 0;
  const open = [A];
  while (open.length) {
    let k = 0;
    for (let q = 1; q < open.length; q++) if (dist[open[q]] + h(open[q]) < dist[open[k]] + h(open[k])) k = q;
    const u = open.splice(k, 1)[0];
    if (u === B) break;
    if (done[u]) continue;
    done[u] = 1;
    const ui = u % nx, uj = Math.floor(u / nx);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const vi = ui + di, vj = uj + dj, v = vj * nx + vi;
      if (vi < 0 || vj < 0 || vi >= nx || vj >= nz || !free[v] || done[v]) continue;
      if (di && dj && !(free[uj * nx + vi] && free[vj * nx + ui])) continue;
      const nd = dist[u] + (di && dj ? Math.SQRT2 : 1);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; open.push(v); }
    }
  }
  function h(q) { return Math.hypot(q % nx - B % nx, Math.floor(q / nx) - Math.floor(B / nx)); }
  if (A !== B && prev[B] < 0) return null;
  const cells = [];
  for (let q = B; q !== -1 && q !== A; q = prev[q]) cells.unshift(q);
  // (pulled straight: from each kept point, as far along as a line of free squares reaches)
  const pt = (q) => [x0 + (q % nx + 0.5) * CELL_M, z0 + (Math.floor(q / nx) + 0.5) * CELL_M];
  const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL_M / 2)); for (let s = 1; s < n; s++) { const [i, j] = cell(a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n); if (!free[j * nx + i]) return false; } return true; };
  const out = [];
  let at = [ax, az];
  for (let k = 0; k < cells.length;) {
    let far = k;
    while (far + 1 < cells.length && clear(at, pt(cells[far + 1]))) far++;
    at = pt(cells[far]); out.push(at); k = far + 1;
  }
  out.push([bx, bz]);
  return out;
}
