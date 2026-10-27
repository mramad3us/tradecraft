// TRADECRAFT sim: the street's layout, shared by the generator (sim/map/street.js) and the cities'
// profiles (sim/cities/): the cross-section's lines, the section's length, the lanes' widths, the
// storeys. Every city is laid on the same cross-section (DESIGN.md, World size), so the city graph
// (sim/city.js) is one for all of them; what a city changes is what stands on it and how it looks.
import { hash } from '../rng.js';

export const SECTION_M = 45;
export const Z = {
  north: -40, back: -40, front: -5, kerbN: -0.5, kerbS: 7, fence: 10,
  pathN: 12.5, pathS: 16.5, fenceS: 19, roadN: 19.8, roadS: 26, south: 29.5, hedge: 30.4, edge: 34,
};
// Where passers-by walk, by lane: [zMin, zMax] of their line.
export const LANES = { far: [-4.0, -1.4], near: [7.6, 9.4], path: [13.1, 15.9], south: [26.6, 28.8] };
// The ways north through a terrace, by kind: a side street (a road between pavements), an alley; and
// the cities' own: a mews (London: cobbles between garages), stairs (Beirut's escaliers), a souk
// passage (Cairo: stalls down both sides), a haret (Cairo: a narrow lane of houses).
export const GAP_M = { side: 10, alley: 3, mews: 6, stairs: 4, souk: 5, haret: 3.4 };
export const STRETCH = 4;                                          // sections of one band (a boulevard, a park)
export const ROW_M = Z.edge - Z.north;                             // one row's depth, north edge to south

export const GROUND_H = 4.2;                                       // a ground floor (shops), metres
export const FLOOR_H = 3.4;

/** An item of a list, by a hash of keys (a name for a street, a lane: stable, no stream drawn). */
export const at = (list, ...k) => list[hash(...k) % list.length];

// A colour a step or two darker, for bases and joints (the art's tone() does it properly; the sim only
// needs a stable value to hand over).
export function toneOf(hex, steps) {
  const k = 1 + steps * 0.09;
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((hex >> s) & 255) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
