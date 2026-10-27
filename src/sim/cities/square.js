// TRADECRAFT sim: what stands in a square set back from the street (sim/map/street.js terraceOf()),
// for the cities' furnish(): something in the middle (a railed garden and its tree, London's; a bronze
// on its plinth, Cairo's midan; a fountain, Beirut's place), palms or a tree either side, a lamp at
// each back corner. Kept 4 m from the back facade (its doors) and from the building line.
import { range, pick, chance, int } from '../rng.js';
import { Z } from '../map/layout.js';

/** Furnish square q ({ x0, x1, z }) of section S, its centrepiece of kind `kind` ('garden', 'monument', 'fountain'); trees of `tree`. */
export function squareFurniture(S, q, r, block, lamp, kind, tree = null) {
  const cx = (q.x0 + q.x1) / 2, cz = (q.z + Z.front) / 2, room = Math.min(q.x1 - q.x0 - 6, 8), deep = Z.front - q.z - 8;
  const [w, d] = kind === 'monument' ? [1.8, 1.8] : kind === 'fountain' ? [Math.min(4, room), Math.min(4, deep)] : [Math.min(6, room), Math.min(3.5, deep)];
  const f = { kind, x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, seed: int(r, 1000), square: true };
  S.square = f;
  block(f.x0, f.z0, f.x1, f.z1, kind === 'garden' ? 'railing' : kind);
  for (const x of [q.x0 + 1.2, q.x1 - 1.2]) lamp(x, q.z + 1.2);
  if (tree) for (const x of [f.x0 - 2.2, f.x1 + 2.2]) if (x > q.x0 + 1.5 && x < q.x1 - 1.5 && chance(r, 0.8)) {
    S.props.push({ kind: 'tree', x, z: cz + range(r, -1, 1), seed: int(r, 1000), size: range(r, 0.9, 1.1), species: tree });
    block(x - 0.25, cz - 1.25, x + 0.25, cz + 1.25, 'tree');
  }
}
