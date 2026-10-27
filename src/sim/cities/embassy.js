// TRADECRAFT sim: the US embassy's building, on whichever street a posting puts it (sim/places.js marks
// it; sim/map/street.js section() sets it in place of the building that stood there). The same in every
// city, as embassies are: dressed stone at the foot, three floors of tall windows over it, a portico at
// its one door, UNITED STATES EMBASSY over that in letters you can read across the street, and the
// flag on its pole beside them. Paint, all of it (src/art/pixeltown.js), but its door: kind 'embassy',
// which nobody but the staff goes in at.
const STONE = 0xd9d2c0, TRIM = 0xe2dac6, G = 4.4, F = 3.3, FLOORS = 4;

/** The embassy in place of building B0 (its lot: x0, x1, z, depth). */
export function embassyBuilding(B0) {
  const w = B0.x1 - B0.x0, mid = w / 2, ops = [];
  const B = { x0: B0.x0, x1: B0.x1, z: B0.z, d: B0.d, h: G + F * (FLOORS - 1) + 1.2, wall: 'plaster', wallColor: STONE, roof: 'flat', roofColor: 0x8f96a6, style: 'embassy', ops, seed: B0.seed,
    look: { dress: 'embassy', roofKit: 'antenna', pipes: [], hanging: [], awnings: [] } };   // (its own dress: no city's)
  ops.push(['ashlar', 0, 0, w, G, 0xc8c0ae]);
  // The ground floor: barred windows either side of the door, none near it.
  for (let x = 0.7; x + 1.1 < mid - 2.2; x += 2.2) ops.push(['window', x, 1.3, 1.1, 1.7, { frame: 0x5c5650, lintel: null, bars: true }], ['window', w - x - 1.1, 1.3, 1.1, 1.7, { frame: 0x5c5650, lintel: null, bars: true }]);
  ops.push(['band', G, TRIM]);
  // The name, over the portico; the flag beside it, where a window would be.
  const sw = Math.min(w - 1, 6.2), fw = 1.9, fh = 1.15, fx = Math.min(w - fw - 0.5, mid + sw / 2 + 0.6), fy = G + 0.9;
  const bays = Math.max(3, Math.round(w / 2.6)), bay = w / bays;
  for (let f = 1; f < FLOORS; f++) {
    const y = G + F * (f - 1) + 1.0;
    for (let k = 0; k < bays; k++) {
      const x = bay * k + (bay - 1.2) / 2;
      if (f === 1 && x < fx + fw + 0.2 && x + 1.2 > fx - 0.2) continue;   // (the flag's place)
      ops.push(['window', x, y, 1.2, 1.9, { frame: TRIM, lintel: TRIM }]);
    }
  }
  ops.push(['cornice', B.h - 1.0, 0.6, TRIM]);
  ops.push(['door', mid - 0.8, 1.6, 2.8, { color: 0x23252f, frame: 0x8f96a6, glass: true, style: 'panel' }]);
  ops.push(['portico', mid - 1.7, 3.4, 3.6, 0xf4efe6]);
  ops.push(['sign', mid - sw / 2, G + 0.12, sw, 0.62, 'UNITED STATES EMBASSY', { bg: 0xf4efe6, fg: 0x1b2541, border: 0x8f96a6, style: 'board' }]);
  // (the flag: its pole along the top, seven stripes, the canton with its stars)
  ops.push(['rect', fx - 0.15, fy + fh, fw + 0.3, 0.07, 0x8f96a6], ['rect', fx + fw + 0.1, fy + fh - 0.03, 0.1, 0.13, 0xb9862e]);
  for (let k = 0; k < 7; k++) ops.push(['rect', fx, fy + fh - (k + 1) * fh / 7, fw, fh / 7, k % 2 ? 0xf6f4ee : 0xb33a34]);
  ops.push(['rect', fx, fy + fh * 3 / 7, fw * 0.42, fh * 4 / 7, 0x283f6b]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ops.push(['rect', fx + 0.1 + i * 0.25, fy + fh * 3 / 7 + 0.12 + j * 0.22, 0.07, 0.07, 0xf6f4ee]);
  return B;
}
