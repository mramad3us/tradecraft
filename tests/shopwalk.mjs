// Tests' feet in a shop (sim/shops.js): to a shop's door, in at it, and about its floor (sim/interiors/
// shop.js) by the stick, round its walls and furniture (sim/interiors/path.js), as a player would walk it.
import { step, playerActor } from '../src/sim/game.js';
import { unitAt } from '../src/sim/interiors/use.js';
import { wayAcross } from '../src/sim/interiors/path.js';
import { Z, SECTION_M } from '../src/sim/map/street.js';
import { refocus } from '../src/sim/world.js';
import { sectionOf } from '../src/sim/city.js';
import { townOf } from '../src/sim/cities/index.js';

/** The player outside the door of the nearest shop on this street that `ok` likes, the street there in play. */
export function atDoor(g, ok = () => true) {
  const me = playerActor(g), town = townOf(g.map), row = g.map.row ?? 0, i0 = Math.floor(me.x / SECTION_M);
  for (let k = 0; k < 30; k++) for (const i of k ? [i0 + k, i0 - k] : [i0]) {
    const u = sectionOf(town, row, i).units?.filter(o => ok(o)).sort((a, b) => Math.abs(a.door - me.x) - Math.abs(b.door - me.x))[0];
    if (!u) continue;
    Object.assign(me, { x: u.door, z: Z.front + 0.6, busy: null, glass: false });
    refocus(g, null, u.door);
    step(g, {}, null);
    return u;
  }
  return null;
}

/** Walk the player to (x, z): round the shop's walls and furniture if in one, by the stick. */
export function walk(g, x, z, bus = null) {
  const me = playerActor(g), at0 = unitAt(g, me.x, me.z) ?? unitAt(g, x, z);
  const pts = (at0 && wayAcross({ plan: at0.u, blockers: at0.S.blockers }, me.x, me.z, x, z)) ?? [[x, z]];
  for (const [px, pz] of pts) for (let t = 0; t < 20 * 10; t++) {
    const dx = px - me.x, dz = pz - me.z, d = Math.hypot(dx, dz);
    if (d < 0.12) break;
    step(g, { mx: dx / d, mz: dz / d }, bus);
  }
  for (let t = 0; t < 3; t++) step(g, {}, bus);
  return Math.hypot(me.x - x, me.z - z) < 0.3;
}

/** In at the door: walked up from the pavement. */
export function walkIn(g, u, bus = null) {
  walk(g, u.door, u.z1 - 1.2, bus);
  return !!playerActor(g).within;
}

/** A spot of a shop's floor by kind ('counter', 'sit', 'wash'), or its back door's ('back'). */
export const spotOf = (u, kind) => kind === 'back' ? { x: (u.exits[0].x0 + u.exits[0].x1) / 2, z: u.exits[0].z1 + 0.35 } : u.spots.find(s => s.kind === kind);
