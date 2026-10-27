// TRADECRAFT sim: blood on the ground (the user, 2026-10-26: "pixel level blood splatter on the ground
// and lingering blood traces"). The engine's, wherever it's spilt.
//
// state.decals: [{ row, x, z, dx, n, seed, ms }] plain data, the latest DECALS_MAX kept: a spatter where
// a blow drew blood (n pixels, flung dx the way the blow went), and drips under whoever is bleeding
// (sim/health.js bleeding()), DRIP_S apart. Each is drawn pixel by pixel from its seed (src/render/
// blood.js), the same every time; they stay on the map they fell on.
import { bleeding } from './health.js';
import { int, range } from './rng.js';

export const DECALS_MAX = 120;
export const DRIP_S = [3, 7];

/** A spatter at (x, z) on the map's row: n pixels, flung toward dx (−1 west, 1 east). */
export function spatter(state, x, z, dx, n, seed = int(state.rng, 1e9)) {
  const list = state.decals ??= [];
  list.push({ row: state.map.row ?? 0, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, dx, n, seed, ms: state.time.ms });
  if (list.length > DECALS_MAX) list.splice(0, list.length - DECALS_MAX);
}

/** Once a second: whoever's bleeding drips where they stand, now and then (the next drip kept on the injury). */
export function drips(state) {
  const ms = state.time.ms;
  for (const a of state.actors) {
    const p = a.who && state.people[a.who];
    if (!p || a.hidden || !bleeding(p, ms)) continue;
    const i = p.injuries.find(j => j.bleed > ms);
    i.drip ??= ms + range(state.rng, ...DRIP_S) * 1000;
    if (ms < i.drip) continue;
    i.drip = ms + range(state.rng, ...DRIP_S) * 1000;
    spatter(state, a.x + range(state.rng, -0.15, 0.15), a.z + range(state.rng, -0.1, 0.1), 0, 1 + int(state.rng, 2));
  }
}
