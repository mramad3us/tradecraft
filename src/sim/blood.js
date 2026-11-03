// TRADECRAFT sim: blood on the ground (the user, 2026-10-26: "pixel level blood splatter on the ground
// and lingering blood traces"). The engine's, wherever it's spilt.
//
// state.decals: [{ row, x, z, dx, n, seed, ms }] plain data, the latest DECALS_MAX kept: a spatter where
// a blow drew blood (n pixels, flung dx the way the blow went), and drips under whoever is bleeding
// (sim/health.js bleeding()), DRIP_S apart. Each is drawn pixel by pixel from its seed (src/render/
// blood.js), the same every time; they stay on the map they fell on.
// Washed away (wash(), the user, 2026-11-03: "things like rain should clean up blood stains over time"): out in
// the street each decal's wash (0–1) rises by WASH_H an hour in rain or sleet, by its level (a downpour takes a
// spatter in under an hour), and by DRY_WASH_H in dry weather (feet, the sweepers: days); at 1 it's gone. A
// decal spilt indoors (inside) stays till it's cleaned; snow lying over it keeps it.
import { bleeding } from './health.js';
import { int, range } from './rng.js';

export const DECALS_MAX = 120;
export const WASH_H = [0, 0.6, 1.5, 3], DRY_WASH_H = 1 / 72;
export const DRIP_S = [3, 7];

/** A spatter at (x, z) on the map's row: n pixels, flung toward dx (−1 west, 1 east). */
export function spatter(state, x, z, dx, n, seed = int(state.rng, 1e9)) {
  const list = state.decals ??= [];
  list.push({ row: state.map.row ?? 0, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, dx, n, seed, ms: state.time.ms, ...(state.map.kind === 'street' ? {} : { inside: true }) });
  if (list.length > DECALS_MAX) list.splice(0, list.length - DECALS_MAX);
}

/** minutes of this weather (w: sim/weather.js weatherAt()) on the street's blood: washed, and gone when it's washed out. */
export function wash(state, w, minutes) {
  if (!state.decals?.length || !w || state.map.kind !== 'street' || minutes <= 0) return;
  const rate = (w.kind === 'rain' || w.kind === 'sleet' ? WASH_H[w.level ?? 1] : w.cover >= 0.3 ? 0 : DRY_WASH_H) * minutes / 60;
  if (!rate) return;
  for (const d of state.decals) if (!d.inside) d.wash = Math.min(1, (d.wash ?? 0) + rate);
  state.decals = state.decals.filter(d => (d.wash ?? 0) < 1);
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
