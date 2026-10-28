// TRADECRAFT sim: a metro station's building, where the city's network has one (sim/transit.js), in
// place of the building that stood in its section (sim/map/street.js section()). The city's own:
//   - London: the Underground's ox-blood glazed tiles, two storeys of arched windows, the roundel (a red
//     ring, a blue bar, UNDERGROUND) over a wide way in;
//   - Moscow: a pale pavilion, its columns, МЕТРО along the frieze and the big red M over the door;
//   - Cairo: a concrete front, the network's M and مترو | METRO over a wide way in.
// The lines it serves are on a board by the door, each in its colour. Paint, all of it
// (src/art/pixeltown.js); its door, kind 'metro', is the way down (sim/metro.js).
const STYLE = {
  london: { wall: 0x7a2a26, trim: 0x9e3c36, h: 8.4 },
  moscow: { wall: 0xe2dac6, trim: 0xf4efe6, h: 6.6 },
  cairo: { wall: 0xc4bba9, trim: 0xa8a49c, h: 6.0 },
};

/** The station in place of building B0 (its lot), the lines it serves ([{ name, colour }]). */
export function stationBuilding(B0, city, lines) {
  const S = STYLE[city] ?? STYLE.moscow, w = B0.x1 - B0.x0, mid = w / 2, ops = [], dw = Math.min(3.6, w - 2);
  const B = { x0: B0.x0, x1: B0.x1, z: B0.z, d: B0.d, h: S.h, wall: 'plaster', wallColor: S.wall, roof: 'flat', roofColor: 0x6a7182, style: 'station', ops, seed: B0.seed,
    look: { dress: 'station', roofKit: 'none', pipes: [], hanging: [], awnings: [] } };
  if (city === 'london') {
    ops.push(['rect', 0, 0, w, S.h, S.wall]);
    for (let y = 0.6; y < S.h; y += 0.6) ops.push(['rect', 0, y, w, 0.05, 0x6e2a2e]);               // (the glazed courses)
    for (let x = 0.9; x + 1.2 < w - 0.6; x += 2.4) if (Math.abs(x + 0.6 - mid) > dw / 2 + 0.9) ops.push(['window', x, 1.2, 1.2, 2.0, { frame: 0xe2dac6, lintel: null, head: 'round' }]);
    for (let x = 0.9; x + 1.2 < w - 0.6; x += 2.4) ops.push(['window', x, 4.9, 1.2, 2.2, { frame: 0xe2dac6, lintel: null, head: 'round' }]);
    ops.push(['cornice', S.h - 0.6, 0.4, S.trim]);
    roundel(ops, mid, 3.55, 'UNDERGROUND', 0xc4302b, 0x283f6b);
  } else if (city === 'cairo') {
    ops.push(['concrete', 0, 0, w, S.h, S.wall]);
    ops.push(['band', 3.6, S.trim]);
    ops.push(['sign', mid - 2.6, 3.75, 5.2, 0.8, 'مترو|METRO', { bg: 0x283f6b, fg: 0xf6f4ee, border: 0xa8a49c, style: 'board' }]);
    roundel(ops, mid - 3.3, 4.15, 'M', 0xc4302b, null);
  } else {
    ops.push(['rect', 0, 0, w, S.h, S.wall]);
    ops.push(['portico', mid - dw / 2 - 0.5, dw + 1.0, 3.4, S.trim]);
    ops.push(['sign', mid - 2.2, 4.4, 4.4, 0.7, 'МЕТРО', { bg: S.trim, fg: 0xc4302b, border: 0xc4bba9, style: 'board' }]);
    ops.push(['cornice', S.h - 0.7, 0.5, S.trim]);
    bigM(ops, mid, 5.3, 0xc4302b);
  }
  // (the way in: wide, dark, and the board of its lines beside it)
  ops.push(['door', mid - dw / 2, dw, 2.7, { color: 0x14151c, frame: city === 'london' ? 0x6e2a2e : 0x8f96a6, glass: false, style: 'panel' }]);
  lines.forEach((L, k) => ops.push(['rect', mid + dw / 2 + 0.25, 2.2 - k * 0.32, 0.9, 0.24, L.colour], ['rect', mid + dw / 2 + 0.25, 2.2 - k * 0.32, 0.06, 0.24, 0xf6f4ee]));
  return B;
}

// The roundel: a ring of rects (a pixel circle), the bar across it with its word.
function roundel(ops, cx, cy, word, ring, bar) {
  const R = 0.62, t = 0.16;
  for (let a = 0; a < 32; a++) {
    const th = (a / 32) * Math.PI * 2, x = cx + Math.cos(th) * (R - t / 2), y = cy + Math.sin(th) * (R - t / 2);
    ops.push(['rect', x - t / 2, y - t / 2, t, t, ring]);
  }
  if (bar) ops.push(['sign', cx - 1.15, cy - 0.17, 2.3, 0.36, word, { bg: bar, fg: 0xf6f4ee, border: bar, style: 'board' }]);
  else ops.push(['rect', cx - 0.25, cy - 0.25, 0.5, 0.5, 0xf6f4ee], ['sign', cx - 0.25, cy - 0.2, 0.5, 0.4, word, { bg: 0xf6f4ee, fg: ring, border: 0xf6f4ee, style: 'board' }]);
}

// Moscow's M: two legs, the V between, red on the pale front.
function bigM(ops, cx, y, c) {
  const h = 0.9, t = 0.16;
  ops.push(['rect', cx - 0.55, y, t, h, c], ['rect', cx + 0.55 - t, y, t, h, c]);
  for (let k = 0; k < 5; k++) { const dy = h - (k + 1) * 0.15; ops.push(['rect', cx - 0.4 + k * 0.08, y + dy, t, 0.16, c], ['rect', cx + 0.4 - k * 0.08 - t, y + dy, t, 0.16, c]); }
}
