// TRADECRAFT sim: the dojo, a training hall at the Farm (Camp Peary, Virginia), where the agency's
// young officers learn to fight (the user's: "a CIA dojo where young agents are taught how to fight").
// One room, the shape of a street section (sim/map/street.js) so the world and the view take it as
// one: blockers, walls, doors, props, lamps; no exits.
//
// Plan (x east, z south, the camera looking north), DOJO_W metres wide:
//   the back wall, its front at Z_BACK: high windows, the flag, a sign; benches along it;
//   the floor, planks; the mats: the main one (MAT) in the middle, where the fights are, a second for
//   drills west of it; at the east end, heavy bags on their stands, a rack;
//   the side walls; the near wall cut away (the view looks in over it), a low sill (Z_FRONT).
// Where people stand: SPOTS (the fighters face each other across the main mat's middle; the class
// along its north edge; the instructor at its head).
export const DOJO_W = 45;
export const Z_BACK = -6;
export const Z_FRONT = 9;
export const MAT = { x0: 15.5, x1: 29.5, z0: -3, z1: 5 };
export const MAT2 = { x0: 4, x1: 12, z0: -2.5, z1: 4 };
export const FIGHT = { x: (MAT.x0 + MAT.x1) / 2, z: 1, gap: 1.5 };   // the fighters, gap apart
export const SPOTS = {
  instructor: { x: FIGHT.x, z: -1.6 },
  class: [17.0, 18.6, 26.4, 28.0, 20.2].map(x => ({ x, z: -2.4 })),
  door: { x: 1.4, z: 2 },
};

/** The dojo as a section: { i: 0, x0, x1, kind: 'dojo', … }. */
export function dojo(seed) {
  const S = { i: 0, x0: 0, x1: DOJO_W, seed, kind: 'dojo', band: 'dojo', park: null,
    buildings: [], doors: [], props: [], lamps: [], blockers: [], crossings: [], crossingsS: [], exits: [], gapsN: [], gapsS: [] };
  const block = (ax, az, bx, bz, what) => S.blockers.push({ x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), what });
  // The walls: the back (a building, for sight), the sides, the cut-away near sill.
  block(-2, Z_BACK - 4, DOJO_W + 2, Z_BACK, 'building');
  block(-2, Z_BACK, 0, Z_FRONT + 2, 'building');
  block(DOJO_W, Z_BACK, DOJO_W + 2, Z_FRONT + 2, 'building');
  block(0, Z_FRONT, DOJO_W, Z_FRONT + 0.4, 'sill');
  S.buildings.push({ kind: 'hall', x0: 0, x1: DOJO_W, z: Z_BACK, h: 5.2, d: 4 });
  S.doors.push({ x: 0.2, z: 2, w: 1.4, kind: 'hall' });
  // Benches along the back wall; the bags and a rack at the east end; a water cooler.
  for (const x of [6, 14, 31, 39]) { S.props.push({ kind: 'bench', x, z: Z_BACK + 0.55, len: 3.6, wall: true }); block(x - 1.8, Z_BACK, x + 1.8, Z_BACK + 0.85, 'bench'); }
  for (const x of [36, 39, 42]) { S.props.push({ kind: 'bag', x, z: 3.5 }); block(x - 0.3, 3.2, x + 0.3, 3.8, 'bag'); }
  S.props.push({ kind: 'rack', x: 43.6, z: -3 }); block(43.1, -4.2, 44.6, -1.8, 'rack');
  S.props.push({ kind: 'cooler', x: 2.2, z: Z_BACK + 0.5 }); block(1.9, Z_BACK, 2.5, Z_BACK + 0.8, 'cooler');
  // The lights: the hall's, over the floor (it's day: the windows do most of it).
  for (let x = 4; x < DOJO_W; x += 9) for (const z of [-2, 5]) S.lamps.push({ r: 4.5, color: 0xf6f4ee, core: 0.25, ring: 0.1, x, z });
  return S;
}
