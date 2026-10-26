// TRADECRAFT sim: the one source of randomness.
//
// sfc32: four 32-bit words of state, kept in the game state as plain data (state.rng), so a save
// carries the dice exactly where they were, and a test can seed them. Everything random in the sim
// draws through these helpers; nothing in the sim calls Math.random.
//
// Things generated from a seed of their own (a map section from the map's seed and its index, a
// passer-by from theirs) must come out the same whatever was rolled before, so they draw from a
// stream of their own: stream(...seeds) makes a fresh state from any mix of numbers and strings.
// The art draws its textures with its own little generator (src/art/pixelart.js rng()): that's
// paint, not the sim.

/** A 32-bit hash of numbers and strings, for deriving seeds (a section from its map, a person from theirs). */
export function hash(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = typeof p === 'number' ? String(p >>> 0) + '#' + String(Math.floor(p / 4294967296)) : String(p);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 0x7c, 0x01000193);
  }
  return h >>> 0;
}

/** A fresh state for a seed: four words from splitmix32, then a few draws thrown away. */
export function seedRng(seed) {
  let s = seed >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const r = [split(), split(), split(), split()];
  for (let i = 0; i < 12; i++) next(r);
  return r;
}

/** A stream of its own, from any mix of numbers and strings. */
export const stream = (...seeds) => seedRng(hash(...seeds));

/** The next number in [0, 1), advancing r (an sfc32 state: [a, b, c, d]). */
export function next(r) {
  let [a, b, c, d] = r;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  r[0] = a >>> 0; r[1] = b; r[2] = c; r[3] = d;
  return t / 4294967296;
}

export const int = (r, n) => Math.floor(next(r) * n);              // 0 … n-1
export const range = (r, a, b) => a + next(r) * (b - a);
export const pick = (r, arr) => arr[int(r, arr.length)];
export const chance = (r, p) => next(r) < p;
export const d20 = (r) => 1 + int(r, 20);
/** An item from [[item, weight]…], by weight. */
export function weighted(r, pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let x = next(r) * total;
  for (const [item, w] of pairs) if ((x -= w) < 0) return item;
  return pairs[pairs.length - 1][0];
}
