// TRADECRAFT art: the figure on the inventory's screen (src/ui/pockets.js): you, standing, in what you're
// wearing, with your pockets on you (the user, 2026-10-31: "improve the character outline, it's not as good
// as it should be"); and anyone, wounded, on your read of them and on first aid's card (src/ui/body.js). It's
// where the game looks at a person close to, so it's a figure of its own, not a sprite blown up: W × H, drawn at half the size of the picture's pixels, a real proportion (six
// and a half heads tall, the light from the upper left, an ink line round it as the sprites have).
//
// **How it's drawn.** As a pixel artist would, in shapes and clusters, not by a formula across every row
// (shading each span like a cylinder is what made its first arms and legs look turned on a lathe). A part
// is a polygon (scan()), its contour placed by hand and smoothed where it should curve (smooth()). On it go
// its shadows and lights, each a shape of its own within that part (g.on(), ribbon() for a fold), in four
// tones of its colour (cloth(), flesh()), with a half step for the lit planes: so a thigh's light stops at
// the knee, a sleeve's creases gather at the elbow. A part laid over an earlier one gets a dark line where it ends; the ink goes round the lot.
// The figure stands easy, its weight on the viewer's left leg, so it isn't a mirror image.
//
// **What's worn.** A coat, a jacket or a suit (sim/items.js POCKETED, the tops with pockets) hangs open, so
// that everything has a place you can see: the outside pockets on its skirts, the inside one on the lining
// where the right side falls back, the shirt and the belt between, the trousers' pockets at the hips where
// it parts below the belt. A jumper or a T-shirt is closed, and a dress has no pockets at all. The hair, the
// hat, the glasses, the beard and the skin are the sprite's look (src/art/sprites.js), the same spec.
//
// **Marks** ({ coat: [left, right], inside: [one], trousers: [left, right], belt: [left, right] }, each
// 'free', 'used' or 'shows', a space missing where the clothes have none): a pocket is part of the garment.
// Free, it's only its seam, in the cloth's own tones; with something in it, a gold bag fills under its lip;
// where that shows it's rust, and on a bare hip the cloth swells out beside it. What's at the belt stands up
// out of it. Left and right are the wearer's list order, the viewer's left first. The marks go on after the dark
// lines, so that no seam crosses them, and the trousers' before the top, so that a coat's edge falls over them.
// What's in the hand (a weapon kind) hangs from it, drawn from its shape (heldIcon()) to its length; a shop's
// bag from the other. The fingers close over what they hold.
//
// **Wounds** (wounds: sim/diagnosis.js findings().marks; the user, 2026-11-03: "graphical representations (high
// quality based on inventory screen)"): each where it lies, a part's in turn at its places (SLOTS; a graze in the
// hair, a split brow or lip, a nose, a break on the shin or the forearm, at their own), their right on our left as
// they face us. Blood in four tones of its own (BL): what's soaked into the cloth a stain in its own pixels,
// darkened toward blood and ragged at the edge; what runs fresh bright, in drips as long as it bleeds fast. A
// bullet's entry a dark hole with a wet rim and a glint; a cut a slant, a gash a deeper one, an artery spurting
// aside; a bruise on the face; a break or a crack a jag across the limb, light on dark cloth and dark on light.
// What's on them: a dressing (a taped pad on the body, wound round a limb in its turns; a strip of shirt greyer),
// blood come through it where it still bleeds; a tourniquet's strap high on the limb, its buckle outside; a
// splint's two staves outside the limb's line, tied; bleeding inside a dashed ring round the belly, in the rust
// of what shows, as a diagram marks it. They go on last, before the ink, and rows.spots says where each
// numbered one is, for its plaque (src/ui/body.js).
import { SKIN, heldIcon } from './sprites.js';
import { sizeOf } from '../sim/weapons.js';

export const W = 64, H = 140;
const DROP = 2, ROWS = H - DROP;                                   // (it's drawn from row 0, a bun or a hat's crown up there, then set down: air over the head, and room for the ink)
const MID = W / 2;                                                 // (the figure's middle, between two columns)
const INK = 0x14151c, PX_PER_CM = 0.72;                            // (175 cm over 126 rows: what's held, to its length)
const GOLD = 0xe7b84a, RUST = 0xe8896a;
// (the rows everything hangs from)
const WAIST_Y = 52, BELT_Y = 58, CROTCH_Y = 72, KNEE_Y = 101, ANKLE_Y = 124, FLOOR_Y = 132;

// ---------- colour ----------

const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t); };
const lum = (c) => { const [r, g, b] = rgb(c); return 0.3 * r + 0.59 * g + 0.11 * b; };
/** A cloth's tones: lit, half lit, itself, in shade, deep. A dark cloth is lifted a little, or black reads as a hole. */
function cloth(c) {
  const v = lum(c), base = v < 42 ? mix(c, 0x6a7182, 0.13) : c;
  const light = mix(base, 0xdfe2e8, v < 70 ? 0.2 : 0.26);
  return { light, soft: mix(base, light, 0.45), base, shade: mix(base, 0x16172a, v > 170 ? 0.2 : 0.32), deep: mix(base, INK, v > 170 ? 0.42 : 0.62) };
}
/** Skin's tones: its shadows go warm, not grey. */
const flesh = (c) => { const light = mix(c, 0xffe9d2, lum(c) < 100 ? 0.15 : 0.32); return { light, soft: mix(c, light, 0.5), base: c, shade: mix(c, 0x6b2f2a, 0.3), deep: mix(c, 0x3a1a1c, 0.55) }; };

// ---------- the grid ----------

function grid() {
  const col = Array.from({ length: ROWS }, () => Array(W).fill(null)), part = Array.from({ length: ROWS }, () => Array(W).fill(0)), edgeFrom = [], quiet = new Set();
  let n = 0;
  const put = (x, y, c, id) => { if (x >= 0 && y >= 0 && x < W && y < ROWS) { col[y][x] = c; if (id !== undefined) part[y][x] = id; } };
  return {
    col, part, edgeFrom, quiet, put,
    /** A new part, one colour, over what's there; its dark line starts at row `from` (a sleeve runs into its shoulder unbroken). */
    add(spans, c, from = 0) { const id = ++n; edgeFrom[id] = from; for (const [y, a, b] of spans) for (let x = a; x <= b; x++) put(x, y, c, id); return id; },
    /** A shape in a colour, on a part's own pixels only. */
    on(id, spans, c) { for (const [y, a, b] of spans) for (let x = a; x <= b; x++) if (part[y]?.[x] === id) col[y][x] = c; },
    /** A shape in a colour, over anything drawn: it joins the part beneath it. */
    over(spans, c) { for (const [y, a, b] of spans) for (let x = a; x <= b; x++) if (col[y]?.[x] !== null && col[y]?.[x] !== undefined) col[y][x] = c; },
    /** A row of pixels, belonging to no new part. */
    span(y, a, b, c, id) { for (let x = a; x <= b; x++) put(x, y, c, id); },
  };
}

// (polygons are in pixel corners: a span runs over the pixels whose centres lie inside)
/** Spans [[y, x0, x1]…] of a polygon. */
function scan(pts) {
  const ys = pts.map(p => p[1]), out = [];
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + (bx - ax) * (yc - ay) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) { const a = Math.round(xs[i]), b = Math.round(xs[i + 1]) - 1; if (b >= a) out.push([y, a, b]); }
  }
  return out;
}
/** A closed contour rounded through its points (Catmull-Rom). */
function smooth(pts, steps = 5) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, c = (a, b, d, e) => 0.5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (3 * b - a - 3 * d + e) * t * t * t);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}
/** A fold: a stroke along a path, width w at its middle, tapering to nothing at the ends; a polygon. */
function ribbon(path, w) {
  const a = [], b = [], n = path.length - 1;
  path.forEach(([x, y], i) => {
    const [px, py] = path[Math.max(0, i - 1)], [qx, qy] = path[Math.min(n, i + 1)], l = Math.hypot(qx - px, qy - py) || 1, k = Math.sin(Math.PI * i / n) * w / 2 + 0.01;
    a.push([x + (qy - py) / l * k, y - (qx - px) / l * k]); b.push([x - (qy - py) / l * k, y + (qx - px) / l * k]);
  });
  return [...a, ...b.reverse()];
}
// (a part drawn in half: offsets from the middle, [d, y], to the viewer's left, right, or both)
const lf = (pts) => pts.map(([d, y]) => [MID - d, y]);
const rt = (pts) => pts.map(([d, y]) => [MID + d, y]);
const both = (pts) => [...lf(pts), ...rt(pts).reverse()];
/** Spans grown by a pixel all round: what a pocket's dark edge is drawn from. */
function halo(spans) {
  const out = spans.map(([y, a, b]) => [y, a - 1, b + 1]), ys = spans.map(s => s[0]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (const [y, a, b] of spans) { if (y === y0) out.push([y - 1, a, b]); if (y === y1) out.push([y + 1, a, b]); }
  return out;
}
/** Spans with a hole taken out of them. */
const minus = (spans, hole) => spans.flatMap(([y, a, b]) => { const h = hole.find(s => s[0] === y); return h ? [[y, a, h[1] - 1], [y, h[2] + 1, b]].filter(s => s[2] >= s[1]) : [[y, a, b]]; });
const folds = (g, id, list, c) => { for (const [path, w] of list) g.on(id, scan(ribbon(path, w)), c); };

// ---------- the body ----------

// (half-widths from the middle; an arm's contour runs from the shoulder down its outside to the wrist, and back up its inside)
const BODY = {
  m: { neck: 4.6, shoulder: 20.4, chest: 16.2, waist: 13.6, hip: 14.6, knee: 13.2, hem: 12.6, gap: 3, ankle: [4.4, 10],
    armOut: [[12, 29.4], [17, 30.6], [19.8, 33], [21, 38], [21.6, 46], [22.4, 53], [22.6, 60], [22, 70]], armIn: [[16.2, 70], [16.4, 60], [15.8, 53], [15.2, 47], [15, 41], [13, 36]], hand: 19.2 },
  f: { neck: 3.5, shoulder: 17.6, chest: 14.4, waist: 10.4, hip: 14.6, knee: 11.6, hem: 10.8, gap: 2.2, ankle: [4, 9.4], small: true,
    armOut: [[10, 29.6], [14.5, 30.6], [17, 33], [18.4, 38], [19.4, 46], [20.6, 53], [21, 60], [20.4, 71]], armIn: [[15.8, 71], [16, 60], [15, 53], [14.2, 46], [13.4, 41], [11.5, 36]], hand: 18 },
};

function legs(g, B, look, dress) {
  const T = cloth(look.legs ?? 0x283f6b);
  if (dress) {
    // (legs, not trousers: under the skirt, the knee, the calf, the fine of the ankle)
    const leg = [[2, 90], [B.hip - 1.6, 90], [B.knee + 0.2, KNEE_Y - 1], [B.knee + 0.4, 108], [B.ankle[1] + 0.2, ANKLE_Y + 1], [B.ankle[0], ANKLE_Y + 1], [3.1, 110], [3.6, KNEE_Y - 1]];
    const a = g.add(scan(lf(leg)), T.base), b = g.add(scan(rt(leg.map(([d, y]) => [d + (y > 100 ? 0.6 : 0), y]))), T.base);
    g.on(a, scan(lf([[B.knee + 1, 102], [B.knee - 2, 104], [B.ankle[1] - 1.4, 120], [B.ankle[1] + 1, 120]])), T.soft);
    g.on(a, scan(lf([[6, 90], [5.6, 104], [5.6, ANKLE_Y + 1], [0, ANKLE_Y + 1], [0, 90]])), T.shade);
    g.on(b, scan(rt([[B.knee - 3.4, 90], [B.knee - 3.2, 106], [B.ankle[1] - 2, ANKLE_Y + 1], [B.knee + 3, ANKLE_Y + 1], [B.knee + 3, 90]])), T.shade);
    return { a, b, T };
  }
  // (the near leg takes the weight, straight down; the other stands easy, its knee a little out)
  const firm = [[0, BELT_Y], [B.hip, BELT_Y], [B.hip + 0.4, 66], [B.hip - 0.2, 82], [B.knee, KNEE_Y], [B.hem, ANKLE_Y + 1], [B.gap, ANKLE_Y + 1], [B.gap - 1, KNEE_Y], [0.5, 80], [0, CROTCH_Y]];
  const easy = [[0, BELT_Y], [B.hip, BELT_Y], [B.hip + 0.6, 66], [B.hip + 0.4, 82], [B.knee + 1, KNEE_Y], [B.hem + 1.8, ANKLE_Y + 1], [B.gap + 1, ANKLE_Y + 1], [B.gap, KNEE_Y], [0.5, 80], [0, CROTCH_Y]];
  const a = g.add(scan(lf(firm)), T.base), b = g.add(scan(rt(easy)), T.base);
  // (each leg's light a broad plane down its near side, the thigh and then the shin, broken at the knee; its far side in shade)
  g.on(a, scan(lf([[B.hip + 1, 70], [B.hip - 4.4, 74], [B.knee - 4.2, 94], [B.knee - 2, 99], [B.knee + 1, 99]])), T.soft);
  g.on(a, scan(lf([[B.knee + 1, 104], [B.knee - 3.6, 106], [B.hem - 3.6, 118], [B.hem - 1.6, 121], [B.hem + 1, 121]])), T.soft);
  g.on(a, scan(lf([[5.4, 74], [5, 88], [5.2, 100], [6, 112], [6, ANKLE_Y + 1], [0, ANKLE_Y + 1], [0, 74]])), T.shade);
  g.on(b, scan(rt([[0, 70], [B.gap + 0.4, 74], [B.gap + 2.4, 96], [B.gap, 99], [0, 96]])), T.soft);
  g.on(b, scan(rt([[B.gap + 1, 104], [B.gap + 3.4, 106], [B.gap + 3.6, 120], [B.gap + 1, 120]])), T.soft);
  g.on(b, scan(rt([[B.hip - 5, 64], [B.hip - 5, 84], [B.knee - 4, 100], [B.hem - 3, 112], [B.hem - 2.4, ANKLE_Y + 1], [B.hem + 4, ANKLE_Y + 1], [B.hip + 3, 64]])), T.shade);
  // (the shadow where the legs meet; the knee's creases; the trouser breaking on the shoe)
  g.on(a, scan(lf([[0, CROTCH_Y - 1], [3.4, CROTCH_Y + 1], [1, 86], [0, 86]])), T.deep); g.on(b, scan(rt([[0, CROTCH_Y - 1], [3.4, CROTCH_Y + 1], [1, 86], [0, 86]])), T.deep);
  folds(g, a, [[lf([[B.knee, 100], [B.knee - 3, 101.6], [B.knee - 6, 102.4]]), 1.5], [lf([[B.hem, 121.4], [B.hem - 4, 122.6], [B.hem - 8, 122]]), 1.5]], T.shade);
  folds(g, b, [[rt([[3, 100], [6, 101.6], [9, 101]]), 1.5], [rt([[5, 122], [9, 122.8], [13, 121.4]]), 1.5]], mix(T.shade, T.deep, 0.5));
  return { a, b, T };
}
function shoes(g, B, look, dress) {
  const c = look.shoes ?? 0x2a1c18, T = cloth(c), pale = lum(c) > 170, [x0, x1] = dress ? B.ankle : [B.gap, B.hem];
  // (from the front, a little turned out, the easy foot more: the upper, the toe's light, the sole; a pale shoe is a trainer, laced)
  const firm = smooth([[x1 - 0.6, ANKLE_Y], [x1 + 0.4, 126.6], [x1 + 2, 129.6], [x1 + 1.6, FLOOR_Y], [x0 + 0.4, FLOOR_Y], [x0 - 0.2, 129], [x0 + 0.4, ANKLE_Y]]);
  const easy = smooth([[x0 + 0.8, ANKLE_Y], [x0 + 0.4, 129], [x0 + 0.8, FLOOR_Y], [x1 + 3.4, FLOOR_Y], [x1 + 4.2, 129.6], [x1 + 2.6, 126.6], [x1 + 1.4, ANKLE_Y]]);
  for (const pts of [lf(firm), rt(easy)]) {
    const id = g.add(scan(pts), T.base), xs = pts.map(p => p[0]), a = Math.min(...xs), b = Math.max(...xs), mid = (a + b) / 2;
    g.on(id, scan([[mid + 1, ANKLE_Y], [b + 1, ANKLE_Y], [b + 1, FLOOR_Y], [mid + 2, FLOOR_Y]]), T.shade);
    g.on(id, scan(smooth([[a + 1.6, 128], [a + 3.4, 126.8], [mid + 0.4, 127.4], [mid, 129.4], [a + 2.4, 129.8]], 3)), pale ? T.base : T.soft);
    if (pale) { g.on(id, [[FLOOR_Y - 2, 0, W]], cloth(0x8f96a6).base); for (const y of [125, 127]) g.on(id, [[y, Math.round(mid) - 1, Math.round(mid) + 1]], T.deep); }
    g.on(id, [[FLOOR_Y - 1, 0, W]], T.deep);
  }
}

// ---------- what's worn ----------

// (under an open top: a shirt, its collar, a tie if there's one; under a jacket a plain crew-necked vest)
function shirt(g, B, look, top) {
  const S = flesh(SKIN[look.skin] ?? look.skin ?? SKIN.light), plain = top.kind === 'jacket', c = plain ? 0x8f96a6 : 0xc9cdd6, T = cloth(c), id = g.add(scan(both([[B.neck - 1, 26], [B.neck + 3, 30], [10, 38], [11, BELT_Y + 1]])), T.base);
  g.on(id, scan(rt([[2, 30], [4, 42], [3.5, BELT_Y + 1], [12, BELT_Y + 1], [12, 28]])), T.shade);
  folds(g, id, [[[[MID - 4, 40], [MID - 3, 48], [MID - 4, 56]], 1.6]], T.shade);
  const tie = top.tie ?? (top.kind === 'suit' ? 0x6e2a2e : null);
  if (plain) { const n = scan(both([[B.neck - 1.5, 26], [3.5, 30.5], [0, 32]])); g.over(n, S.base); return; }
  if (tie) {
    const K = cloth(tie), t = g.add(scan(both([[1.6, 29], [2.2, 31.5], [1.3, 33], [2.8, 48], [0, 51.5]])), K.base);
    g.on(t, scan(rt([[0.4, 28], [1, 33], [1, 52], [4, 52], [4, 28]])), K.shade);
    g.on(t, [[32, 0, W], [31, MID, W]], K.deep); g.on(t, scan(lf([[1.2, 29.5], [1.2, 31], [0.4, 31]])), K.light);
  } else for (let y = 34; y < BELT_Y - 1; y += 6) g.put(MID - 1, y, T.deep);
  // (the collar's two points, standing away from the neck)
  for (const pts of [lf([[0.4, 30.4], [B.neck - 0.6, 25], [B.neck + 1.6, 28], [3.4, 34]]), rt([[0.4, 30.4], [B.neck - 0.6, 25], [B.neck + 1.6, 28], [3.4, 34]])]) { const k = g.add(scan(pts), T.light, 0); g.on(k, [[32, 0, W], [33, 0, W]], T.base); }
}
function belt(g, half, c = 0x2a1c18) {
  const T = cloth(c), id = g.add(scan(both([[half, BELT_Y], [half, BELT_Y + 3]])), T.base);
  g.on(id, [[BELT_Y, 0, W]], T.light); g.on(id, [[BELT_Y + 2, 0, W]], T.shade);
  const buckle = 0xb9862e;
  for (let y = BELT_Y; y <= BELT_Y + 2; y++) { g.put(MID - 2, y, buckle); g.put(MID + 1, y, buckle); }
  g.span(BELT_Y, MID - 2, MID + 1, buckle); g.span(BELT_Y + 2, MID - 2, MID + 1, buckle);
}

// (the cut of an open top: where it ends, how it stands off the hip, and the line of its front edge from the waist down)
const CUT = {
  coat: { hem: 105, ease: 3, flare: 5.4, edge: [[5.4, WAIST_Y], [6.8, 62], [10.6, 76], [12.4, 105]], lapel: [11.6, 50] },
  suit: { hem: 77, ease: 1.8, flare: 2.2, edge: [[5, WAIST_Y], [6.4, 61], [10, 77]], lapel: [10, 49] },
  jacket: { hem: 71, ease: 2, flare: 1.6, edge: [[5.6, WAIST_Y], [6.8, 62], [8, 71]], lapel: null },
};
const isOpen = (top) => top.kind in CUT;
/** Where a contour of [d, y], in order of y, is at row y. */
const edgeOf = (table, y) => { for (let i = 0; i + 1 < table.length; i++) if (y <= table[i + 1][1]) return table[i][0] + (table[i + 1][0] - table[i][0]) * (y - table[i][1]) / (table[i + 1][1] - table[i][1]); return table.at(-1)[0]; };

// (what's behind the legs: the coat's back, seen where it parts, in its own shadow)
function backOf(g, B, top) {
  const cut = CUT[top.kind], T = cloth(top.color ?? 0x353947);
  g.add(scan(both([[B.hip, BELT_Y], [B.hip + cut.flare - 1, cut.hem - 1]])), T.deep);
}
// (a parka's or an anorak's hood, down: a fold of cloth behind the neck, standing past it each side)
function hood(g, B, top) {
  const T = cloth(top.color ?? 0x353947), id = g.add(scan(smooth(both([[0, 20], [B.neck + 3.6, 20.6], [B.neck + 6.6, 24.6], [B.neck + 8, 30], [0, 32]]), 3)), T.shade);
  g.on(id, scan(both([[B.neck + 2.4, 22.4], [B.neck + 3.6, 30], [0, 30]])), T.deep);
  g.on(id, scan(lf(smooth([[B.neck + 3.4, 21], [B.neck + 6, 24.6], [B.neck + 7, 28], [B.neck + 5, 25]], 3))), T.base);
}
function openTop(g, B, look, top) {
  const cut = CUT[top.kind], { hem } = cut, T = cloth(top.color ?? 0x353947), hipD = B.hip + cut.ease, far = B.hip + cut.flare, long = hem > 90;
  // (a skirt's hem isn't ruled: it wanders a pixel with the folds)
  const foot = long ? [[far, hem], [far - 3, hem + 1], [far - 5, hem], [cut.edge.at(-1)[0] + 1.6, hem + 1]] : [[far, hem]];
  const outer = [[B.neck + 0.5, 25.4], [B.neck + 5, 28.6], [B.shoulder - 4, 30.6], [B.shoulder - 1, 33], [B.chest + 1, 41], [B.waist + cut.ease, WAIST_Y], [hipD, BELT_Y + 7], ...foot];
  const inner = [...cut.edge].reverse().concat([[4.4, 44], [3.2, 31.5], [B.neck - 1, 25.8]]);
  const panel = [...outer, ...inner];
  const a = g.add(scan(lf(panel)), T.base), b = g.add(scan(rt(panel)), T.base);
  // (the shoulders lit; the left panel takes the light, the right falls away into shade but for its front edge)
  g.on(a, scan(lf([[B.shoulder, 30], [B.neck + 3, 27], [B.neck + 4, 30], [B.chest - 2, 33.5], [B.chest - 1, 38], [B.shoulder, 36]])), T.soft);
  g.on(b, scan(rt([[B.neck + 2, 27], [B.chest - 4, 30], [B.chest - 6, 32.5], [B.neck + 3, 30]])), T.soft);
  g.on(b, scan(rt([[9, 34], [8.4, 52], [10, 62], [cut.edge.at(-1)[0] + 3, hem + 2], [far + 3, hem + 2], [far + 3, 34]])), T.shade);
  // (under the arm, the cloth drawn in to the waist)
  g.on(a, scan(lf([[B.chest + 2, 41], [B.chest - 2.4, 45], [B.waist + 0.6, 53], [B.waist + 1, 58], [B.hip + cut.ease + 2, 62]])), T.shade);
  if (long) {
    // (the folds of a long skirt: wedges, fine at the hip, opening to the hem)
    g.on(a, scan(lf([[14.4, 68], [13, hem + 2], [16.4, hem + 2]])), T.shade);
    g.on(a, scan(lf([[17.4, 76], [18.6, hem + 2], [21, hem + 2]])), T.shade);
    g.on(a, scan(lf([[11.4, 74], [12.6, hem + 2], [13, hem + 2]])), T.soft);
    g.on(b, scan(rt([[15, 70], [14.8, hem + 2], [18.4, hem + 2]])), T.deep);
  } else g.on(a, scan(lf([[13.4, 62], [13, hem + 1], [15.6, hem + 1]])), T.shade);
  // (the front edges catch the light, or a dark coat melts into dark trousers)
  for (let y = 53; y < hem; y++) { const d = Math.round(edgeOf(cut.edge, y)); g.on(a, [[y, MID - d - 2, MID - d - 2]], T.soft); g.on(b, [[y, MID + d + 1, MID + d + 1]], T.base); }
  // (the hem's shadow)
  g.on(a, [[hem, 0, W]], T.shade); g.on(b, [[hem, 0, W]], T.deep);
  if (long) { g.on(a, [[hem - 1, 0, W]], T.shade); g.on(a, [[hem + 1, 0, W]], T.deep); g.on(b, [[hem + 1, 0, W]], T.deep); }
  return { a, b, T, hem };
}
// (the lapels and collar, last, over the panels; what's under the right one: the lining, where that side falls back)
function collar(g, B, top, P) {
  const cut = CUT[top.kind], T = P.T;
  // (the lining: a long triangle of the coat's inside, turned back under the lapel)
  const N = cloth(mix(top.trim ?? 0x23252f, T.deep, 0.5)), fall = [[4.8, 34], [12, 37], [12.6, 44], [10, 52], [7, 60], [5.6, 54]], back = g.add(scan(rt(fall)), N.base);
  g.on(back, scan(rt([[9, 36], [11, 44], [8, 56], [13, 56], [13, 36]])), N.shade);
  if (cut.lapel) {
    const [w, end] = cut.lapel;
    const lapel = [[3.1, 31], [6.5, 31.5], [8, 34.6], [w + 1, 33.4], [w + 0.4, 37], [5.2, end + 3], [4.1, 44]];
    const col = [[B.neck - 0.2, 25], [B.neck + 3, 26.4], [B.neck + 5, 30], [9.2, 33.6], [7.4, 35], [5.8, 31.5], [3.6, 30], [B.neck - 1.6, 26.4]];
    for (const [side, lit] of [[lf, T.light], [rt, T.base]]) {
      const l = g.add(scan(side(lapel)), lit);
      g.on(l, scan(side([[w + 2, 33], [w + 1, 38.6], [6, end + 3], [7, end + 3], [w + 2, 40]])), side === lf ? T.base : T.shade);
      const k = g.add(scan(side(col)), side === lf ? T.base : T.shade);
      g.on(k, scan(side([[B.neck, 24], [B.neck + 5, 29], [B.neck + 3, 26]])), lit);
    }
  } else {
    // (a jacket's: a short turned collar)
    const col = [[B.neck - 0.4, 25], [B.neck + 3.4, 26.6], [B.neck + 5.4, 31], [8.8, 35.5], [5.8, 34], [3.8, 30]];
    for (const [side, lit] of [[lf, T.light], [rt, T.base]]) { const k = g.add(scan(side(col)), lit); g.on(k, scan(side([[B.neck + 5.4, 31.5], [8.8, 36], [5.6, 34.6], [6.4, 33], [8, 33.4]])), T.shade); }
  }
  // (the buttons, down the left front)
  if (top.kind !== 'jacket') { const c = T.deep, ys = top.kind === 'coat' ? [50, 62, 74] : [52]; for (const y of ys) { const d = Math.round(edgeOf(cut.edge, y)) + 2; g.put(MID - d - 1, y, c); g.put(MID - d, y, c); g.put(MID - d - 1, y + 1, c); g.put(MID - d, y + 1, T.shade); } }
  if (top.belt && top.kind === 'coat') {
    const K = cloth(top.belt);
    for (const [id, side] of [[P.a, lf], [P.b, rt]]) { g.on(id, scan(side([[0, WAIST_Y - 1], [40, WAIST_Y - 1], [40, WAIST_Y + 2], [0, WAIST_Y + 2]])), K.base); g.on(id, [[WAIST_Y - 1, 0, W]], K.light); g.on(id, [[WAIST_Y + 1, 0, W]], K.shade); }
    // (tied, not buckled: its knot on the left, an end hanging)
    g.on(P.a, scan(ribbon(lf([[9.4, WAIST_Y + 1], [10, WAIST_Y + 7], [9.4, WAIST_Y + 13]]), 3)), K.base);
    g.on(P.a, scan(lf([[8.4, WAIST_Y - 2], [11.4, WAIST_Y - 2], [11.4, WAIST_Y + 2.6], [8.4, WAIST_Y + 2.6]])), K.light);
    g.on(P.a, [[WAIST_Y + 2, MID - 12, MID - 9]], K.deep);
  }
}

function closedTop(g, B, look, top) {
  const { kind } = top, T = cloth(top.color ?? 0x3b6296), dress = kind === 'dress', tucked = kind === 'tee', hem = dress ? 100 : kind === 'uniform' ? 66 : tucked ? BELT_Y + 1 : 65;
  const ease = kind === 'tee' ? 0.8 : kind === 'sweater' ? 1.6 : 1;
  const shoulders = dress ? [[B.neck + 0.6, 26], [B.neck + 3.5, 28.4], [B.shoulder - 3, 30.8], [B.shoulder - 2.5, 33]] : [[B.neck + 0.5, 25.6], [B.neck + 4.5, 28.5], [B.shoulder - 4, 30.6], [B.shoulder - 1, 33]];
  const skirt = dress ? [[B.waist + 0.3, WAIST_Y], [B.hip + 0.8, 66], [B.hip + 4.4, 84], [B.hip + 7, hem], [B.hip + 3, hem + 1], [B.hip - 3, hem], [8, hem + 1], [3, hem]] : [[B.waist + ease, WAIST_Y], [B.hip + ease, BELT_Y + 2], [B.hip + ease, hem]];
  const id = g.add(scan(both([...shoulders, [B.chest + (dress ? -0.5 : ease), 41], ...skirt])), T.base);
  // (light on the left of the chest and the shoulders, the right side falling away, cloth pulled from the arm to the waist)
  g.on(id, scan(lf([[B.chest + 2, 41], [B.chest - 2, 31], [B.neck + 3, 28], [B.neck + 5, 31], [B.chest - 4, 34], [B.chest - 2, 42], [B.waist + 1, 50]])), T.soft);
  g.on(id, scan(smooth(rt([[B.neck + 3, 27], [B.chest - 5, 36], [B.chest - 3.4, 43], [B.waist - 3.6, WAIST_Y], [B.waist - 2, 58], [B.hip - 2.4, hem + 2], [B.hip + 9, hem + 2], [B.hip + 9, 27]]), 3)), T.shade);
  g.on(id, scan(rt([[B.chest + 3, 40], [B.chest - 0.6, 42], [B.waist - 0.4, WAIST_Y], [B.hip + 1, 58], [B.hip + 3, 60]])), T.deep);
  if (dress) {
    // (the skirt falls in cones from the waist: wedges, fine at the top, opening to the hem)
    g.on(id, scan(lf([[B.waist - 3, 56], [4, hem + 2], [9, hem + 2]])), T.shade);
    g.on(id, scan(lf([[B.waist + 2, 60], [15, hem + 2], [20, hem + 2]])), T.shade);
    g.on(id, scan(lf([[B.waist, 62], [11, hem + 2], [14, hem + 2]])), T.soft);
    g.on(id, scan(rt([[1, 62], [-1, hem + 2], [3, hem + 2]])), T.shade);
    g.on(id, scan(rt([[B.waist + 3, 60], [15, hem + 2], [19, hem + 2]])), T.deep);
    g.on(id, [[hem, 0, W]], T.deep); g.on(id, [[hem + 1, 0, W]], T.deep);
    const K = cloth(top.trim ?? T.deep);
    g.on(id, scan(both([[20, WAIST_Y - 1], [20, WAIST_Y + 1]])), K.base);
  } else {
    folds(g, id, [[lf([[B.chest - 1, 41], [9, 47], [5, 50]]), 1.8], [lf([[B.waist, 54], [8, 57], [4, 57]]), 1.6]], T.shade);
    if (kind !== 'tee') g.on(id, [[hem - 1, 0, W]], T.deep);
  }
  if (kind === 'sweater') {
    const R = cloth(T.shade);
    for (let y = hem - 4; y < hem; y++) for (let x = 0; x < W; x++) if (g.part[y][x] === id) g.col[y][x] = x % 2 ? R.light : R.base;
    g.on(id, [[hem - 5, 0, W]], T.shade);
  }
  if (kind === 'uniform') {
    const K = cloth(top.trim ?? 0xb9862e);
    for (let y = 33; y < hem - 2; y += 7) { g.put(MID - 1, y, K.base); }
    g.on(id, scan(both([[20, WAIST_Y + 3], [20, WAIST_Y + 6]])), cloth(0x14151c).base);
    g.over(scan(lf([[B.shoulder - 2, 30], [B.neck + 5, 28], [B.neck + 5, 30.4], [B.shoulder - 2, 32.6]])), K.base);
    g.over(scan(rt([[B.shoulder - 2, 30], [B.neck + 5, 28], [B.neck + 5, 30.4], [B.shoulder - 2, 32.6]])), K.shade);
    flap(g, MID - 12, 37, 7, 'free', T); flap(g, MID + 5, 37, 7, 'free', T);
    g.span(WAIST_Y + 3, MID - 2, MID + 1, K.base); g.span(WAIST_Y + 4, MID - 2, MID + 1, K.shade); g.span(WAIST_Y + 5, MID - 2, MID + 1, K.shade);
  }
  // (the neckline)
  const skin = flesh(SKIN[look.skin] ?? look.skin ?? SKIN.light);
  if (dress) {
    const n = g.add(scan(both([[B.neck + 0.6, 25], [B.neck + 2, 29], [5, 34], [0, 36]])), skin.base, H);
    g.on(n, scan(rt([[1, 24], [2, 36], [10, 36], [10, 24]])), skin.shade);
  } else if (kind === 'uniform') {
    const K = cloth(top.color ?? 0x23252f), c = g.add(scan(both([[B.neck + 0.6, 25.4], [B.neck + 1.4, 30], [0, 33]])), K.base, H);
    g.on(c, scan(rt([[0.5, 25], [0.5, 34], [9, 34], [9, 25]])), K.shade);
  } else {
    const ring = kind === 'sweater' ? cloth(top.trim ?? T.shade) : T, c = g.add(scan(both([[B.neck + 0.5, 25.4], [B.neck + 2, 28.4], [4, 31.4], [0, 32.2]])), ring.base, H);
    g.on(c, scan(rt([[1, 24], [1, 33], [10, 33], [10, 24]])), ring.shade);
    const n = g.add(scan(both([[B.neck - 0.4, 24], [B.neck, 27.4], [3, 29.8], [0, 30.4]])), skin.base, H);
    g.on(n, scan(both([[6, 24], [6, 27.6], [0, 27.6]])), skin.shade);
    g.on(n, scan(rt([[1, 24], [1, 31], [8, 31], [8, 24]])), skin.deep);
  }
  return { id, T, hem };
}

function arms(g, B, look, top) {
  const bare = top.kind === 'tee' || top.kind === 'dress', c = top.color ?? 0x353947, S = flesh(SKIN[look.skin] ?? look.skin ?? SKIN.light), T = cloth(c), loose = ['coat', 'jacket'].includes(top.kind) ? 1 : 0.4, sewn = bare ? 0 : loose;
  const armpit = 40, cuffY = B.armIn[0][1], A = bare ? S : T;
  // (a sleeve stands off the arm, more so a coat's)
  const out = B.armOut.map(([d, y], i) => [d + (i ? sewn : 0), y]), inn = B.armIn.map(([d, y], i) => [d - (i < 4 ? sewn * 0.5 : 0), y]);
  const across = (y) => { const a = edgeOf(out, y), b = edgeOf([...inn].reverse(), y); return [a, b]; };
  // (the weight on the near leg drops that shoulder: the far arm hangs a row higher, so the two aren't a mirror)
  for (const [flat, far] of [[lf, 0], [rt, 1]]) {
    const side = (pts) => flat(pts).map(([x, y]) => [x, y - far]);
    const id = g.add(scan(side(smooth([...out, ...inn], 3))), A.base, armpit), lit = far ? A.base : A.soft, dark = far ? A.deep : A.shade;
    const inner = (y, k = 0) => across(y)[1] + k, outer = (y, k = 0) => across(y)[0] + k;
    if (far) {
      // (it turns from the light: in shade, all but a strip down its near side)
      g.on(id, scan(side([[outer(36) - 2.4, 33], [outer(46) - 2.4, 46], [outer(53) - 2.4, 53], [outer(60) - 2.4, 60], [outer(68) - 2.2, cuffY + 1], [outer(68) + 3, cuffY + 1], [outer(46) + 3, 46], [outer(36) + 3, 33]])), A.shade);
    } else {
      g.on(id, scan(side([[inner(44, 2.4), 41], [inner(53, 2.4), 53], [inner(60, 2.4), 60], [inner(68, 2.2), cuffY + 1], [inner(68, -3), cuffY + 1], [inner(44, -3), 40]])), A.shade);
      g.on(id, scan(side([[outer(34) + 2, 31], [outer(36) - 1.4, 33], [outer(44) - 1.6, 46], [outer(49) - 1.4, 49.6], [outer(49) + 2, 50]])), lit);
      g.on(id, scan(side([[outer(57) + 2, 57], [outer(58) - 1.4, 58], [outer(64) - 1.4, 64], [outer(66) + 2, 67]])), lit);
    }
    if (!bare) {
      // (the creases at the elbow)
      const e = (outer(52) + inner(52)) / 2;
      folds(g, id, [[side([[e + 3.4, 49.6], [e, 52], [e - 3.4, 51]]), 1.5], [side([[e + 3.4, 54], [e + 0.4, 56.4], [e - 3.4, 55]]), 1.5]], dark);
    }
    hands(g, B, flat, S, far);
    if (!bare) {                                                   // (the cuff; a line of shirt under a suit's)
      const rib = cloth(T.shade), y0 = cuffY - 3 - far;
      if (top.kind === 'sweater') for (let y = y0; y <= cuffY - far; y++) for (let x = 0; x < W; x++) if (g.part[y][x] === id) g.col[y][x] = x % 2 ? rib.light : rib.base;
      else g.on(id, [[y0, 0, W]], T.deep);
      if (top.kind === 'suit') { const [a, b] = across(cuffY - 1); g.over(scan(side([[a, cuffY], [b, cuffY], [b, cuffY + 1], [a, cuffY + 1]])), 0xdfe2e8); }
    }
    if (top.kind === 'tee') {
      // (the short sleeve: the arm's own shoulder, cut off above the elbow, a little loose)
      const end = 47.4, sleeve = [...B.armOut.filter(p => p[1] < end).map(([d, y], i) => [d + (i ? 0.8 : 0), y]), [edgeOf(B.armOut, end) + 1.2, end], [edgeOf([...B.armIn].reverse(), end) - 0.8, end + 0.4], ...B.armIn.filter(p => p[1] < end).map(([d, y]) => [d - 0.4, y])];
      const s = g.add(scan(side(smooth(sleeve, 3))), T.base, armpit);
      g.on(s, [[46 - far, 0, W], [47 - far, 0, W]], far ? T.deep : T.shade);
      if (far) g.on(s, scan(side([[B.shoulder - 3, 31], [B.shoulder - 3, 49], [10, 49], [10, 31]])), T.shade);
      else g.on(s, scan(side([[B.shoulder - 3, 31], [B.shoulder, 33], [B.shoulder + 0.6, 45], [B.shoulder - 2.6, 45]])), T.soft);
    }
  }
}

// (the hand, hanging easy, seen from the thumb's side: the wrist, the back of the hand, the fingers curled in,
// the thumb lying along the inside. Letters are the skin's tones; the viewer's left hand, flipped for the other.)
const HAND = [
  '.bbbbbs..',
  '.lbbbbbs.',
  'lbbbbbbbs',
  'lbbbbbsbs',
  'lbbbbbsbs',
  'lbbbbsbbs',
  'lbbbbsbs.',
  'lbsbbsss.',
  'bbsbsbs..',
  'bbsbsb...',
  '.bbbb....',
];
/** One hand, from its wrist; a woman's a row and a column smaller. */
function hands(g, B, side, S, far) {
  const y0 = B.armIn[0][1] - 1 - far, x0 = Math.round(MID - B.hand) - 4, rows = B.small ? HAND.filter((_, i) => i !== 4).map(r => r.slice(0, 3) + r.slice(4)) : HAND, pts = [];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] !== '.') pts.push([y, x]);
  const id = g.add([], 0);
  for (const [y, x] of pts) {
    const ch = rows[y][x], c = { l: far ? S.base : S.light, b: S.base, s: far ? S.deep : S.shade }[ch];
    g.put(side === lf ? x0 + x : W - 1 - x0 - x, y0 + y, c, id);
  }
}

// ---------- the head ----------

function head(g, B, look, sex) {
  const skin = SKIN[look.skin] ?? look.skin ?? SKIN.light, S = flesh(skin), f = sex === 'f';
  // (the shadow the head casts on the neck)
  const neck = g.add(scan(both([[B.neck, 20], [B.neck + 0.4, 25], [B.neck + 1, 28]])), S.base, H);
  g.quiet.add(neck);                                               // (nothing lays a dark line on it: the head's shadow is what parts them)
  g.on(neck, scan(both([[B.neck + 1, 20], [B.neck + 1, 27], [2, 27.6], [0, 27.8]])), S.shade);
  g.on(neck, scan(rt([[1, 20], [1, 29], [10, 29], [10, 20]])), S.deep);
  // (ears, set behind the face, unless hair or a scarf covers them)
  if (!['long', 'bob'].includes(look.hair?.style) && look.hat?.kind !== 'hijab') for (const [side, c] of [[lf, S.base], [rt, S.shade]]) { const e = g.add(scan(side([[7.4, 12.6], [9.8, 13], [10, 16], [9, 18.8], [7.2, 19]])), c); g.on(e, scan(side([[8, 14.4], [9, 14.4], [9, 17], [8, 17]])), side === lf ? S.shade : S.deep); }
  const half = f ? [[0, 5.6], [3.2, 6], [5.8, 7.4], [7.4, 10], [7.9, 13.5], [7.5, 17], [6.3, 20.6], [4.2, 23.6], [2, 25], [0, 25.2]]
    : [[0, 5.4], [3.4, 5.8], [6, 7.2], [7.8, 10], [8.2, 13.5], [8, 17.5], [7.2, 20.5], [5.6, 23.4], [3, 25.2], [0, 25.6]];
  const face = g.add(scan(smooth([...lf(half.slice(0, -1)), ...rt(half.slice(1)).reverse()], 4)), S.base);
  // (the side away from the light, a crescent down the cheek to the jaw; the lit brow and cheekbone)
  g.on(face, scan(smooth([[MID + 5, 6], [MID + 6, 11], [MID + 5, 17], [MID + 3.4, 21], [MID, 25], [MID + 3, 27], [MID + 10, 22], [MID + 10, 8]], 3)), S.shade);
  g.on(face, scan(smooth([[MID - 6.4, 8.6], [MID - 2, 6.6], [MID + 1, 7], [MID - 3, 9], [MID - 6, 11.6]], 3)), S.light);
  g.on(face, scan(smooth([[MID - 6.8, 17], [MID - 5.4, 16.8], [MID - 5, 18.4], [MID - 6.4, 19]], 2)), S.soft);
  g.on(face, [[25, MID - 3, MID + 2]], S.shade); g.on(face, [[24, MID + 1, MID + 3]], S.shade);
  // (the brows, the eyes under their lids, the nose's shadow to the right, the mouth)
  const hairC = look.hair?.color ?? 0x2a1c18, brow = mix(hairC, S.deep, f ? 0.45 : 0.15), lid = mix(0x2a1c18, S.deep, 0.25), white = mix(0xf6f4ee, skin, 0.15), iris = 0x2a1c18;
  for (const [a, b] of [[MID - 6, MID - 3], [MID + 2, MID + 5]]) { g.span(12, a, b, brow); }
  if (!f) { g.put(MID - 6, 13, brow); g.put(MID + 5, 13, brow); }
  for (const x0 of [MID - 6, MID + 3]) { g.span(14, x0, x0 + 2, lid); g.put(x0, 15, white); g.put(x0 + 1, 15, iris); g.put(x0 + 2, 15, white); }
  g.put(MID, 16, S.shade); g.put(MID, 17, S.shade); g.put(MID, 18, S.shade); g.put(MID - 1, 19, S.shade); g.put(MID, 19, S.deep); g.put(MID + 1, 19, S.shade); g.put(MID - 1, 18, S.light);
  if (f) { g.span(22, MID - 2, MID + 1, mix(S.deep, 0x9e3c36, 0.5)); g.span(23, MID - 1, MID, mix(S.shade, 0x9e3c36, 0.35)); }
  else { g.span(22, MID - 2, MID + 1, S.deep); g.put(MID - 3, 22, S.shade); g.put(MID + 2, 22, S.shade); g.span(23, MID - 1, MID, S.shade); }
  if (look.beard) {
    const b = look.beard === true ? hairC : look.beard, K = cloth(b);
    for (const [y, a, q] of scan(both([[8, 16], [8.2, 18], [7.2, 20.5], [5.6, 23.4], [3, 25.4], [0, 25.8]]))) for (let x = a; x <= q; x++) if (g.part[y]?.[x] === face && (y > 19 || Math.abs(x + 0.5 - MID) > 6)) g.col[y][x] = x > MID + 3 ? K.shade : K.base;
    g.span(20, MID - 4, MID + 3, K.base);
    g.span(21, MID - 3, MID + 2, K.base);
    g.span(22, MID - 2, MID + 1, S.deep);
    g.on(face, [[23, MID - 1, MID]], K.light);
  } else if (look.moustache) {
    const m = look.hair?.color ?? 0x2a1c18;
    g.span(20, MID - 4, MID + 3, m); g.span(21, MID - 4, MID - 3, m); g.span(21, MID + 2, MID + 3, m);
  }
}

// (hair, drawn in clumps: a mass, its lit top, a dark where it turns under)
function hair(g, look, back) {
  const style = look.hair?.style ?? 'short', c = look.hair?.color ?? 0x2a1c18, T = cloth(c);
  if (style === 'bald' || look.hat?.kind === 'hijab') return;
  if (back) {
    if (style === 'long') { const a = g.add(scan(smooth([[MID - 9, 8], [MID - 10.6, 22], [MID - 11, 34], [MID - 8, 41], [MID + 8, 41], [MID + 11, 34], [MID + 10.6, 22], [MID + 9, 8]], 3)), T.shade); g.on(a, scan(rt([[3, 8], [3, 42], [12, 42], [12, 8]])), T.deep); }
    if (style === 'bob') { const a = g.add(scan(smooth([[MID - 9, 8], [MID - 10.4, 18], [MID - 9.4, 25.6], [MID + 9.4, 25.6], [MID + 10.4, 18], [MID + 9, 8]], 3)), T.shade); g.on(a, scan(rt([[3, 8], [3, 27], [12, 27], [12, 8]])), T.deep); }
    if (style === 'bun' && !look.hat) { const a = g.add(scan(smooth([[MID - 2, 5], [MID - 4.4, 3.4], [MID - 3.6, 0.8], [MID, 0.2], [MID + 3.6, 0.8], [MID + 4.4, 3.4], [MID + 2, 5]], 3)), T.base); g.on(a, scan(rt([[1, 0], [1, 6], [6, 6], [6, 0]])), T.shade); g.on(a, [[1, MID - 3, MID - 1]], T.light); }
    return;
  }
  const cap = {
    short: [[23.6, 15], [23.2, 11], [24, 7.6], [26.6, 4.8], [31, 3.4], [36, 3.8], [39, 5.6], [40.6, 8.6], [40.8, 12], [40.2, 15], [39.2, 15], [38.8, 11.6], [36.6, 10.4], [33, 10.6], [29, 9.2], [26.8, 10.4], [25.6, 11.6], [24.8, 15]],
    crew: [[24, 14], [23.6, 11], [24.4, 8], [26.8, 5.6], [31, 4.4], [36, 4.6], [38.8, 6.2], [40.2, 8.6], [40.4, 11], [40, 14], [39.2, 14], [38.8, 11], [37, 9.8], [32, 9.4], [27, 9.8], [25.2, 11], [24.8, 14]],
    side: [[23.8, 14.6], [23, 11], [23.6, 7.4], [26, 4.6], [31, 3], [36.4, 3.4], [39.6, 5.4], [41.2, 8.6], [41.2, 12], [40.4, 15], [39.4, 15], [38.8, 12.4], [35, 11.4], [30, 9.6], [27.4, 8.4], [26.4, 10.8], [25.2, 12], [24.8, 14.6]],
    long: [[23.2, 22], [22.8, 12], [23.8, 7.4], [26.4, 4.6], [31, 3.4], [36, 3.8], [39.2, 6], [41, 10], [41.2, 22], [39.6, 22], [39.8, 12], [37.4, 8.6], [33, 8], [30.6, 7.4], [28, 8.8], [25, 12.6], [24.6, 22]],
    bob: [[23.4, 20], [22.8, 12], [23.8, 7.4], [26.4, 4.6], [31, 3.4], [36, 3.8], [39.2, 6], [41, 10], [41.4, 20], [39.8, 20], [39.8, 12.4], [38, 10.6], [30, 10.6], [26, 10.6], [24.2, 12.6], [24.4, 20]],
    bun: [[24.2, 14], [23.8, 10.4], [24.8, 7.4], [27, 5], [31, 4], [36, 4.2], [38.6, 6], [40, 8.4], [40.2, 10.4], [39.8, 14], [39.2, 14], [38.4, 10.6], [35, 8.4], [32, 7.8], [29, 8.4], [25.8, 10.6], [24.8, 14]],
  };
  cap.ponytail = cap.bun;
  const pts = cap[style] ?? cap.short, id = g.add(scan(smooth(pts, 2)), T.base);
  // (the lit crown, a turn of shade down the far side)
  g.on(id, scan(smooth([[26, 6.6], [30, 4.6], [34.6, 4.8], [31, 6.4], [27.6, 8.4]], 3)), T.light);
  g.on(id, scan(rt([[3.6, 2], [5.6, 8], [6, 14], [6.4, 24], [12, 24], [12, 2]])), T.shade);
  if (style === 'ponytail') {
    // (drawn forward over the far shoulder, tied at the neck, thinning to its end)
    const tail = g.add(scan(rt(smooth([[8, 21], [10.4, 21.6], [12, 27], [12, 35], [10.6, 43], [9, 46], [8.4, 38], [8.2, 31], [7.6, 26]], 3))), T.base);
    g.on(tail, scan(rt([[9, 19], [10, 30], [9.6, 40], [8, 47], [6, 47], [6, 19]])), T.soft);
    g.on(tail, scan(rt(smooth([[11, 25], [12.6, 30], [12.6, 38], [10.4, 46], [10.2, 36]], 3))), T.shade);
    g.on(tail, [[24, 0, W], [25, 0, W]], cloth(0x23252f).base);
  }
  if (style === 'long') {
    // (it falls in front of the shoulders, thinning to its ends)
    for (const [side, far] of [[lf, 0], [rt, 1]]) {
      const lock = g.add(scan(side(smooth([[9.6, 11], [11, 20], [12, 30], [10.8, 38], [8.4, 42], [6.8, 35], [6.6, 27], [7.4, 19], [8, 13]], 3))), far ? T.shade : T.base);
      g.on(lock, scan(side([[7.4, 22], [8.4, 22], [8.4, 34], [6.4, 42], [5, 42], [5, 22]])), far ? T.deep : T.shade);
      if (!far) g.on(lock, scan(side(smooth([[10, 14], [10.8, 22], [11, 29], [9.8, 26], [9.2, 18]], 3))), T.soft);
    }
  }
}

// (what a brim throws on the face: darkens what's there, so the brows stay brows)
const dim = (g, y, a, b, k) => { for (let x = a; x <= b; x++) if (g.col[y][x] !== null) g.col[y][x] = mix(g.col[y][x], INK, k); };
function hat(g, look) {
  const h = look.hat;
  if (!h) return;
  const T = cloth(h.color ?? 0x353947), B = cloth(h.band ?? T.deep), add = (pts, c) => g.add(scan(pts), c);
  if (h.kind === 'fedora') {
    const crown = add([[MID - 8.8, 10], [MID - 8.2, 4.6], [MID - 6.4, 2.4], [MID - 2.4, 2.8], [MID, 3.8], [MID + 2.4, 2.8], [MID + 6.4, 2.4], [MID + 8.2, 4.6], [MID + 8.8, 10]], T.base);
    g.on(crown, scan(rt([[3, 0], [4, 12], [12, 12], [12, 0]])), T.shade);
    g.on(crown, scan(smooth([[MID - 7.4, 7], [MID - 7, 4.4], [MID - 5, 3.4], [MID - 3.6, 5]], 3)), T.light);
    g.on(crown, scan([[MID - 1, 3], [MID + 1.4, 3], [MID + 0.6, 7], [MID - 0.4, 7]]), T.deep);        // (the pinch)
    g.on(crown, [[7, 0, W], [8, 0, W]], B.base);
    const brim = add(smooth([[MID - 14.4, 10], [MID - 8, 9.6], [MID + 8, 9.6], [MID + 14.4, 10], [MID + 12.6, 12], [MID + 6, 12.8], [MID - 6, 12.8], [MID - 12.6, 12]], 4), T.base);
    g.on(brim, [[9, 0, W], [10, 0, MID - 2]], T.light); g.on(brim, [[12, 0, W]], T.deep); g.on(brim, scan(rt([[6, 9], [6, 13], [16, 13], [16, 9]])), T.shade);
    dim(g, 13, MID - 8, MID + 7, 0.3);
  } else if (h.kind === 'cap') {
    const top = add(smooth([[MID - 9.4, 10], [MID - 10.6, 7], [MID - 8, 3.6], [MID - 2, 2.2], [MID + 6, 2.6], [MID + 9.8, 5], [MID + 9.8, 8], [MID + 9, 10]], 4), T.base);
    g.on(top, scan(smooth([[MID - 8.6, 6], [MID - 5, 3.6], [MID + 2, 3.2], [MID - 3, 5.4]], 3)), T.light);
    g.on(top, scan(rt([[3, 2], [5, 11], [13, 11], [13, 2]])), T.shade);
    const brim = add(smooth([[MID - 9, 9.6], [MID + 9, 9.6], [MID + 7.4, 12], [MID - 7.4, 12]], 3), B.base);
    g.on(brim, [[11, 0, W]], B.deep); g.on(brim, scan(rt([[4, 9], [4, 13], [12, 13], [12, 9]])), B.shade);
  } else if (h.kind === 'peaked') {
    const top = add(smooth([[MID - 10.6, 7], [MID - 12, 4.6], [MID - 8, 2], [MID + 8, 2], [MID + 12, 4.6], [MID + 10.6, 7]], 4), T.base);
    g.on(top, [[2, 0, W], [3, 0, MID - 2]], T.light); g.on(top, scan(rt([[5, 1], [5, 8], [13, 8], [13, 1]])), T.shade);
    const band = add(scan(both([[9.4, 6.4], [9, 10]])), B.base);
    g.on(band, [[9, 0, W]], B.shade); g.on(band, scan(rt([[6, 6], [6, 10], [10, 10], [10, 6]])), B.shade);
    const peak = add(smooth([[MID - 9, 9.6], [MID + 9, 9.6], [MID + 6.6, 12.6], [MID - 6.6, 12.6]], 3), 0x14151c);
    g.on(peak, [[10, MID - 7, MID - 2]], 0x4c5262);
    g.put(MID - 1, 7, GOLD); g.put(MID, 7, GOLD); g.put(MID - 1, 8, GOLD); g.put(MID, 8, 0xb9862e);
  } else if (h.kind === 'beanie') {
    const top = add(smooth([[MID - 9.2, 9], [MID - 8.6, 5], [MID - 4, 1.8], [MID + 4, 1.8], [MID + 8.6, 5], [MID + 9.2, 9]], 4), T.base);
    g.on(top, scan(smooth([[MID - 7.8, 6.4], [MID - 4, 3.2], [MID + 1, 2.8], [MID - 3.4, 5.4]], 3)), T.light);
    g.on(top, scan(rt([[3, 1], [5, 9], [11, 9], [11, 1]])), T.shade);
    const fold = add(scan(both([[9.6, 8], [9.6, 12]])), B.base);
    for (let y = 8; y < 12; y++) for (let x = 0; x < W; x++) if (g.part[y][x] === fold) g.col[y][x] = x % 3 === 0 ? (x > MID + 3 ? B.deep : B.shade) : x > MID + 3 ? B.shade : B.base;
  } else if (h.kind === 'skullcap') {
    const top = add(smooth([[MID - 7.8, 8], [MID - 6, 4.4], [MID, 3.2], [MID + 6, 4.4], [MID + 7.8, 8], [MID, 8.8]], 4), T.base);
    g.on(top, scan(rt([[3, 2], [4, 9], [10, 9], [10, 2]])), T.shade); g.on(top, [[5, MID - 5, MID - 1]], T.light);
  } else if (h.kind === 'hijab') {
    // (the scarf, wrapped close round the face and falling on the shoulders; the opening's what frames the face)
    const opening = scan(smooth([[MID, 8.6], [MID - 5, 9.6], [MID - 6.8, 14], [MID - 6.2, 19], [MID - 3.6, 24], [MID, 25.2], [MID + 3.6, 24], [MID + 6.2, 19], [MID + 6.8, 14], [MID + 5, 9.6]], 4));
    const shawl = g.add(minus(scan(smooth([[MID, 2.6], [MID - 6.6, 3.6], [MID - 10, 8], [MID - 10.6, 16], [MID - 10, 23], [MID - 13, 28], [MID - 18, 33], [MID - 12, 38], [MID, 41], [MID + 12, 38], [MID + 18, 33], [MID + 13, 28], [MID + 10, 23], [MID + 10.6, 16], [MID + 10, 8], [MID + 6.6, 3.6]], 4)), opening), T.base);
    g.on(shawl, scan(rt([[3, 1], [5, 26], [1, 42], [20, 42], [20, 1]])), T.shade);
    g.on(shawl, scan(smooth([[MID - 9, 9], [MID - 6, 4.8], [MID - 1, 4], [MID - 5, 6.6], [MID - 8, 12]], 3)), T.light);
    folds(g, shawl, [[[[MID - 7, 26], [MID - 2, 33], [MID + 4, 34]], 2], [[[MID + 7, 26], [MID + 2, 31], [MID - 5, 37]], 2]], T.deep);
    g.span(9, MID - 3, MID + 2, T.shade);
  }
}
function glasses(g, look) {
  const kind = look.glasses;
  if (!kind) return;
  if (kind === 'shades') {
    for (const x0 of [MID - 7, MID + 1]) { g.span(14, x0, x0 + 5, INK); g.span(15, x0, x0 + 5, INK); g.span(16, x0 + 1, x0 + 4, INK); g.put(x0 + 1, 14, 0x6a7182); g.put(x0 + 2, 15, 0x4c5262); }
    g.span(14, MID - 1, MID, INK); g.put(MID - 8, 14, INK); g.put(MID + 7, 14, INK);
    return;
  }
  const c = 0x8f96a6, glass = 0xdfe2e8;
  for (const x0 of [MID - 7, MID + 2]) { g.span(13, x0 + 1, x0 + 3, c); g.span(17, x0 + 1, x0 + 3, c); for (let y = 14; y <= 16; y++) { g.put(x0, y, c); g.put(x0 + 4, y, c); } g.put(x0 + 1, 14, glass); }
  g.span(14, MID - 2, MID + 1, c); g.put(MID - 8, 14, c); g.put(MID + 7, 14, c);
}

// ---------- pockets ----------

// (every pocket speaks the same way: a lip of the cloth's own, over a bag; the lip alone while it's free, the bag
// filling gold under it when there's something in it, seated on the cloth by a dark line down its sides and foot)
const fillOf = (m) => { const c = m === 'shows' ? RUST : GOLD; return { light: mix(c, 0xfff4d0, 0.3), base: c, shade: mix(c, 0x6b3a1c, 0.4), edge: mix(c, INK, 0.78) }; };
/** The bag: x, y its top left, w × h, its foot's corners turned; on one part, or over all. */
function pouch(g, x, y, w, h, m, id) {
  const F = fillOf(m), rows = [];
  for (let r = 0; r < h; r++) { const i = r === h - 1 ? 1 : 0; rows.push([y + r, x + i, x + w - 1 - i]); }
  const paint = id === undefined ? (sp, c) => g.over(sp, c) : (sp, c) => g.on(id, sp, c);
  paint(halo(rows).filter(([yy]) => yy >= y), F.edge); paint(rows, F.base);
  for (const [yy, , b] of rows) paint([[yy, b, b]], F.shade);
  paint([[y + h - 1, x + 1, x + w - 2]], F.shade);
}

// (the trousers' pockets go on before the top does, so a coat's edge falls over them as it would)
/** A trouser pocket: its slit slanting down to the outside; d0, d1 across, y its top. */
function thigh(g, id, side, [d0, d1, y], m, T) {
  const w = d1 - d0, x = side === lf ? MID - d1 : MID + d0;
  if (m !== 'free') pouch(g, x, y + 1, w, 7, m, id);
  for (let k = 0; k < w; k++) {
    const yy = y + (k >= w / 2 ? 1 : 0), xx = side === lf ? MID - d0 - 1 - k : MID + d0 + k;
    g.on(id, [[yy, xx, xx]], T.light); g.on(id, [[yy + 1, xx, xx]], m === 'free' ? T.deep : fillOf(m).edge);
  }
}
function onTrousers(g, B, M, top, L) {
  if (!M.trousers) return;
  const open = isOpen(top), at = open ? [2, 8, 62] : top.kind === 'tee' ? [8, 14, 63] : [8, 14, 66];   // (open: at the hips, just under the belt, not down on the thighs where two of them sit either side of the fly)
  // (something that bulges, with nothing over the hip, swells the hip's line, out into the gap by the arm)
  [[L.a, lf], [L.b, rt]].forEach(([id, side], i) => {
    if (!open && M.trousers[i] === 'shows') for (const [y, a, b] of scan(side([[B.hip, at[2] + 2], [B.hip + 1.8, at[2] + 4], [B.hip + 1.8, at[2] + 7], [B.hip, at[2] + 9]]))) g.span(y, a, b, L.T.base, id);
    thigh(g, id, side, at, M.trousers[i], L.T);
  });
}
/** The beltline: free, a belt loop (over a jumper the belt's hidden, so a stitch in the knit); in use, what's tucked there stands up out of it. */
function tuck(g, d, side, m, knit) {
  const x = side === lf ? MID - d - 2 : MID + d, y = BELT_Y;
  if (m === 'free') { const c = knit ? knit.shade : cloth(0x6b4636).base, lx = side === lf ? x + 1 : x; for (let yy = y; yy <= y + 2; yy++) g.put(lx, yy, c); return; }
  pouch(g, x, y - 6, 2, 7, m);
  const F = fillOf(m);
  g.span(y - 6, x, x + 1, F.light); g.span(y - 7, x, x + 1, F.edge); g.put(x - 1, y - 6, F.edge); g.put(x + 2, y - 6, F.edge);
  g.span(y, x, x + 1, F.base); g.span(y + 1, x, x + 1, F.shade); g.span(y + 2, x, x + 1, F.shade);
}
/** A flap pocket on a skirt: x, y its top left, w across. */
function flap(g, x, y, w, m, T) {
  if (m === 'free') {
    for (let yy = y + 3; yy < y + 7; yy++) { g.put(x, yy, T.shade); g.put(x + w - 1, yy, T.deep); }
    g.span(y + 6, x + 1, x + w - 2, T.deep);
  } else pouch(g, x, y + 2, w, 6, m);
  g.span(y, x, x + w - 1, T.light); g.span(y + 1, x, x + w - 1, T.base); g.span(y + 2, x, x + w - 1, m === 'free' ? T.deep : mix(T.deep, INK, 0.4));
}
function onTop(g, M, top, P) {
  const open = isOpen(top);
  if (M.belt) { const d = open ? 3 : 9, knit = top.kind === 'tee' || open ? null : P.T; tuck(g, d, lf, M.belt[0], knit); tuck(g, d, rt, M.belt[1], knit); }
  if (M.coat) { const y = top.kind === 'suit' ? 61 : 60, x = MID - 16; flap(g, x, y, 7, M.coat[0], P.T); flap(g, W - x - 7, y, 7, M.coat[1], P.T); }
  if (M.inside) {
    const m = M.inside[0], x = MID + 7, y = 41, N = cloth(top.trim ?? 0x23252f);
    if (m !== 'free') pouch(g, x, y + 1, 4, 6, m);
    g.span(y, x, x + 3, N.light); g.span(y + 1, x, x + 3, m === 'free' ? INK : mix(N.deep, INK, 0.4));
  }
}

// ---------- what's in the hands ----------

function heldThing(g, kind, [hx, hy]) {
  const cells = heldIcon(kind);
  if (!cells.length) return;
  const n = Math.max(...cells.map(c => c[0])) + 1, want = Math.round(sizeOf(kind)[0] * PX_PER_CM), step = Math.max(2, Math.min(want, FLOOR_Y - hy - 1) / n), id = g.add([], 0);
  for (const [x, y, c] of cells) {
    const y0 = Math.round(hy - 2 + x * step), y1 = Math.round(hy - 2 + (x + 1) * step);
    for (let yy = y0; yy < y1; yy++) { const dx = (y - 2) * 2; g.put(hx + dx, yy, mix(c, 0x8f96a6, 0.35), id); g.put(hx + dx + 1, yy, mix(c, 0x8f96a6, 0.12), id); }
  }
}
function bagIn(g, [hx, hy]) {
  const T = cloth(0xdfe2e8), y0 = hy + 9, id = g.add(scan([[hx - 6, y0], [hx + 7, y0], [hx + 7.6, y0 + 19], [hx - 6.6, y0 + 19]]), T.base);
  g.on(id, scan([[hx + 2, y0], [hx + 8, y0], [hx + 8, y0 + 20], [hx + 3, y0 + 20]]), T.shade);
  g.on(id, [[y0, 0, W]], T.light); g.on(id, [[y0 + 18, 0, W]], T.deep);
  for (let y = hy + 2; y < y0; y++) { g.put(hx - 2, y, T.base, id); g.put(hx + 3, y, T.shade, id); }
  g.span(hy + 2, hx - 2, hx + 3, T.base, id);
}

// ---------- wounds ----------

// (what a look at someone shows, on the figure: sim/diagnosis.js findings().marks. Blood in four tones of its own: what
// runs fresh, bright; what's soaked into the cloth, dark, the cloth's own pixels deepened toward it, not painted over)
const BL = { light: 0xe0574a, base: 0xb3282c, shade: 0x6b1a20, deep: 0x3a0c12 };
const HOLE = 0x1a0508;
const BANDAGE = cloth(0xeeeae0), RAG = cloth(0xb9b2a0), STRAP = cloth(0x2c2e38), WOOD = cloth(0xd2a468), BUCKLE = 0xd9a83a;
const BRUISE = [0x6a4a7a, 0x4a2a5a];
// (where wounds go on each part, in turn, [across from the middle (the viewer's left negative), row]; a limb's at its
// own middle on that row; some kinds have a place of their own: a graze in the hair, a split brow, a nose, a black eye)
const SLOTS = { head: [[-3, 8], [4, 10], [-5, 18], [5, 19]], torso: [[-6, 39], [5, 42], [-2, 48], [7, 50], [-8, 45], [2, 35]],
  arm: [44, 58, 51, 38], leg: [80, 111, 94, 70] };
const OWN = { graze: [2, 5], split: [-4, 11], lip: [1, 22], nose: [0, 20], bruise: [-5, 17] };
const BREAK_Y = { arm: 58, leg: 111 };                             // (a break, a crack, on a limb: the forearm's, the shin's)
const SIDE_OF = { armR: lf, armL: rt, legR: lf, legL: rt };        // (they face us: their right is on our left)
const TEMPLE = [[6, 9], [6, 10], [6, 11], [7, 12], [7, 13], [7, 14], [7, 15], [6, 16], [6, 17], [6, 18], [5, 19], [5, 20], [4, 21], [4, 22], [3, 23]];   // (the run of blood from a scalp wound, down the shaded side of the face)
const TOURNIQUET_Y = { arm: 37, leg: 65 }, SPLINT_Y = { arm: [45, 67], leg: [82, 121] };
/** A leg's two edges at row y, as distances from the middle [inner, outer] (its stance as drawn above). */
function legAt(B, k, y) {
  const easy = k === 'legL', outer = easy ? [[B.hip, BELT_Y], [B.hip + 0.6, 66], [B.hip + 0.4, 82], [B.knee + 1, KNEE_Y], [B.hem + 1.8, ANKLE_Y + 1]] : [[B.hip, BELT_Y], [B.hip + 0.4, 66], [B.hip - 0.2, 82], [B.knee, KNEE_Y], [B.hem, ANKLE_Y + 1]];
  const inner = easy ? [[0.5, BELT_Y], [0.5, 80], [B.gap, KNEE_Y], [B.gap + 1, ANKLE_Y + 1]] : [[0.5, BELT_Y], [0.5, 80], [B.gap - 1, KNEE_Y], [B.gap, ANKLE_Y + 1]];
  return [edgeOf(inner, y), edgeOf(outer, y)];
}
/** A limb's span at row y, in pixels [left, right]: an arm's sleeve as it's drawn (its own part, to its edges), a leg's by its stance. */
function spanAt(g, B, k, y) {
  if (k.startsWith('arm')) {
    const d = (edgeOf([...B.armIn].reverse(), y) + edgeOf(B.armOut, y)) / 2, x = Math.round(SIDE_OF[k] === lf ? MID - d - 0.5 : MID + d - 0.5), id = g.part[y]?.[x];
    let l = x, h = x;
    while (id && g.part[y][l - 1] === id) l--;
    while (id && g.part[y][h + 1] === id) h++;
    return [l, h];
  }
  const [a, b] = legAt(B, k, y);
  return SIDE_OF[k] === lf ? [Math.round(MID - b), Math.round(MID - a) - 1] : [Math.round(MID + a), Math.round(MID + b) - 1];
}
/** Where on the figure a part's nth wound goes (x, y in its pixels, before the drop), a kind's own place first. */
export function woundSpot(sex, part, n, kind = null) {
  const B = BODY[sex] ?? BODY.m;
  if (part === 'head' || part === 'torso') { const [d, y] = (part === 'head' && OWN[kind]) || SLOTS[part][n % SLOTS[part].length]; return [Math.round(MID + d), y]; }
  const limb = part.startsWith('arm') ? 'arm' : 'leg', ys = SLOTS[limb], y = (kind === 'break' || kind === 'crack' ? BREAK_Y[limb] : ys[n % ys.length]) - (part === 'armL' ? 1 : 0);
  const d = part.startsWith('arm') ? (edgeOf([...B.armIn].reverse(), y) + edgeOf(B.armOut, y)) / 2 : legAt(B, part, y).reduce((a, b) => a + b) / 2;
  return [Math.round(SIDE_OF[part] === lf ? MID - d - 0.5 : MID + d - 0.5), y];
}
/** One pixel deepened toward a colour, only where the figure is (blood doesn't run onto the wall). */
const tint = (g, x, y, c, t) => { if (g.col[y]?.[x] !== null && g.col[y]?.[x] !== undefined) g.col[y][x] = mix(g.col[y][x], c, t); };
const dab = (g, x, y, c) => { if (g.col[y]?.[x] !== null && g.col[y]?.[x] !== undefined) g.col[y][x] = c; };
/** A stain soaked into what's there, round (x, y), r across, running down more than out, darkest where it's wettest; ragged at its edge. */
function stain(g, x, y, r, t = 0.7) {
  for (let dy = -r; dy <= r + 2; dy++) for (let dx = -r; dx <= r; dx++) {
    const e = Math.hypot(dx / (r + 0.4), (dy > 0 ? dy / (r + 1.6) : dy / (r + 0.2)));
    if (e > 1) continue;
    if (e > 0.7 && ((x + dx) * 7 + (y + dy) * 13) % 3 === 0) continue;
    tint(g, x + dx, y + dy, e < 0.45 ? BL.deep : BL.shade, e < 0.45 ? t : e < 0.75 ? t * 0.8 : t * 0.55);
  }
}
/** What runs from a wound: drips down from (x, y), as long as it bleeds fast, lit at the top, the drop at the end darker. */
function drips(g, x, y, level) {
  const L = [0, 2, 5, 9][level] ?? 0, one = (x0, y0, n) => { for (let k = 0; k < n; k++) dab(g, x0, y0 + k, k === n - 1 ? BL.shade : k === 0 && n > 2 ? BL.light : BL.base); };
  one(x, y, L);
  if (level >= 2) one(x + 1, y + 1, Math.ceil(L / 2));
  if (level >= 3) one(x - 1, y + 2, L - 3);
}
/** A pad on a wound: a dressing (a bandage, or a strip of shirt), taped; soaking through where it still bleeds. */
function pad(g, x, y, kind, wet, wide = 6) {
  const T = kind === 'rag' ? RAG : BANDAGE, x0 = x - Math.floor(wide / 2) + 1, x1 = x0 + wide - 1;
  for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x0; xx <= x1; xx++) dab(g, xx, yy, yy === y - 2 ? T.light : yy === y + 2 || xx === x1 ? T.shade : xx === x0 ? T.soft : T.base);
  for (const yy of [y - 1, y + 1]) { dab(g, x0 - 1, yy, T.soft); dab(g, x1 + 1, yy, T.shade); }   // (the tape, past the pad)
  if (kind === 'rag') { dab(g, x0 + 1, y, T.shade); dab(g, x1 - 1, y - 1, T.shade); }
  if (wet) soak(g, x, y, wet);
}
/** Blood come through a dressing: a spot in its middle, bigger the faster it's still going. */
function soak(g, x, y, wet) { dab(g, x, y, BL.base); dab(g, x + 1, y, BL.shade); dab(g, x, y + 1, BL.shade); if (wet >= 2) { dab(g, x - 1, y, BL.base); dab(g, x + 1, y + 1, BL.base); dab(g, x, y - 1, BL.shade); } }
/** A band round a limb at row y (a tourniquet's strap, a bandage wound round, a splint's tie): across it and a pixel past each edge. Returns [left, right]. */
function band(g, B, k, y, T, rows = 2) {
  const [l, h] = spanAt(g, B, k, y), x0 = l - 1, x1 = h + 1;
  for (let r = 0; r < rows; r++) for (let x = x0; x <= x1; x++) g.put(x, y + r, r === 0 ? (x === x0 ? T.soft : T.light) : r === rows - 1 && rows > 1 ? (x === x1 ? T.deep : T.shade) : x === x1 ? T.shade : T.base);
  if (rows > 3) for (let r = 1; r < rows - 1; r++) for (let x = x0 + 1; x < x1; x++) if ((x + r * 2) % 4 === 0) g.put(x, y + r, T.shade);   // (wound round: the turns of it, slanting)
  return [x0, x1];
}
/** The marks: what bleeds inside (a ring marked on the body, as a diagram's is), each wound where it lies, the tourniquets and splints, blood worn. Returns where each numbered one is. */
function wounds(g, B, sex, M) {
  const spots = [], count = {};
  // (blood worn with no wound to show for it here: someone else's, or run down from the face)
  if (M.bloody?.clothes && !M.wounds.some(w => w.part === 'torso' && w.kind !== 'inside')) { stain(g, MID - 7, 45, 2, 0.5); stain(g, MID + 4, 53, 1, 0.45); }
  if (M.bloody?.face && !M.wounds.some(w => w.part === 'head' && ['nose', 'split', 'graze', 'hole'].includes(w.kind))) { dab(g, MID - 1, 20, BL.shade); dab(g, MID - 1, 21, BL.base); tint(g, MID - 4, 21, BL.shade, 0.4); tint(g, MID + 2, 24, BL.shade, 0.4); }
  for (const w of M.wounds) {
    // (each part's wounds take its places in turn; those with a place of their own don't use one up)
    const n = (OWN[w.kind] && w.part === 'head') || w.kind === 'inside' || ((w.kind === 'break' || w.kind === 'crack') && w.part in SIDE_OF) ? 0 : (count[w.part] = (count[w.part] ?? -1) + 1);
    const [x, y] = w.kind === 'inside' ? [MID, 50] : woundSpot(sex, w.part, n, w.kind);
    spots.push({ n: w.n, tone: w.tone, x, y, part: w.part });
    const lv = w.bleed ?? 0, limb = w.part in SIDE_OF;
    if (w.kind === 'inside') {
      // (a dashed ring round the belly, in the rust of what shows (the pockets' word for it): marked there, under the skin, as a diagram marks it)
      const ring = new Set();
      for (let k = 0; k < 96; k++) { const t = (k / 96) * Math.PI * 2; ring.add(`${Math.round(MID - 0.5 + Math.cos(t) * 7.5)},${Math.round(52 + Math.sin(t) * 4.5)}`); }
      [...ring].map(c => c.split(',').map(Number)).sort((a, b) => Math.atan2(a[1] - 52, a[0] - MID) - Math.atan2(b[1] - 52, b[0] - MID)).forEach(([xx, yy], k) => { if (k % 3 < 2) dab(g, xx, yy, yy < 52 ? RUST : mix(RUST, BL.shade, 0.35)); });
    } else if (w.kind === 'hole') {
      if (w.dressed) { if (limb) { band(g, B, w.part, y - 2, w.dressed === 'rag' ? RAG : BANDAGE, 4); if (lv) soak(g, x, y, lv); } else pad(g, x, y, w.dressed, lv); if (lv > 1) drips(g, x, y + 3, lv - 1); continue; }
      stain(g, x, y + 1, lv >= 3 ? 4 : lv >= 2 ? 3 : 2);
      // (the hole: dark, a wet rim round its foot, a glint where it catches the light)
      dab(g, x, y, HOLE); dab(g, x + 1, y, HOLE); dab(g, x, y + 1, HOLE); dab(g, x + 1, y + 1, BL.deep);
      dab(g, x - 1, y, BL.shade); dab(g, x, y - 1, BL.shade); dab(g, x + 1, y - 1, BL.shade); dab(g, x - 1, y + 1, BL.base); dab(g, x + 2, y + 1, BL.base); dab(g, x + 2, y, BL.shade);
      if (lv) { dab(g, x - 1, y - 1, BL.light); drips(g, x, y + 2, lv); }
    } else if (w.kind === 'graze') {
      // (a furrow along the skull, where the hair or the hat's torn; what runs from it comes down the temple, by the face's edge)
      for (let k = -2; k <= 2; k++) dab(g, x + k, y + (k > 0 ? 1 : 0), Math.abs(k) < 2 ? BL.deep : BL.shade);
      dab(g, x - 1, y - 1, BL.base);
      if (w.dressed) for (let k = -5; k <= 5; k++) { dab(g, MID + k, 9, BANDAGE.light); dab(g, MID + k, 10, BANDAGE.base); dab(g, MID + k, 11, k > 3 ? BANDAGE.deep : BANDAGE.shade); }
      if (lv) TEMPLE.slice(0, 3 + 3 * lv).forEach(([dx, yy], k) => { dab(g, MID + dx, yy, k === 0 ? BL.base : k % 5 === 4 ? BL.shade : BL.base); if (k < 3) dab(g, MID + dx - 1, yy, BL.shade); });
    } else if (w.kind === 'cut' || w.kind === 'gash') {
      const long = w.kind === 'gash' ? 3 : 2;
      if (w.dressed) { if (limb) { band(g, B, w.part, y - 2, w.dressed === 'rag' ? RAG : BANDAGE, 4); if (lv) soak(g, x, y, lv); } else pad(g, x, y, w.dressed, lv); if (lv > 1) drips(g, x, y + 3, lv - 1); continue; }
      if (lv || w.kind === 'gash') stain(g, x, y + 1, w.kind === 'gash' ? 2 + Math.min(2, lv) : 1, 0.55);
      for (let k = -long; k <= long; k++) { dab(g, x + k, y + Math.round(k * 0.6), w.kind === 'gash' && Math.abs(k) < long ? HOLE : BL.shade); if (w.kind === 'gash') dab(g, x + k, y + Math.round(k * 0.6) + 1, BL.base); }
      if (w.stitched) for (let k = -long + 1; k < long; k += 2) { dab(g, x + k, y + Math.round(k * 0.6) - 1, INK); dab(g, x + k, y + Math.round(k * 0.6) + 1, INK); }
      if (lv) drips(g, x + 1, y + 2, lv);
      if (w.spurt) for (const [dx, dy] of [[3, -2], [5, -1], [6, 1], [4, -3]]) dab(g, x + (SIDE_OF[w.part] === rt ? dx : -dx), y + dy, dy < -1 ? BL.light : BL.base);
    } else if (w.kind === 'split' || w.kind === 'lip') {
      dab(g, x, y, BL.deep); dab(g, x + 1, y, BL.shade); dab(g, x, y + 1, BL.base);
      if (lv) drips(g, x, y + 2, Math.min(2, lv));
    } else if (w.kind === 'nose') {
      if (lv || M.bloody?.face) { dab(g, MID - 1, 20, BL.shade); dab(g, MID, 20, BL.shade); dab(g, MID - 1, 21, BL.base); if (lv) { dab(g, MID - 1, 22, BL.base); dab(g, MID, 21, BL.base); } }
    } else if (w.kind === 'bruise' && w.part === 'head') {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 2; dx++) { const e = Math.hypot(dx / 3, dy / 2.2); if (e < 1) tint(g, x + dx, y + dy, e < 0.5 ? BRUISE[1] : BRUISE[0], e < 0.5 ? 0.5 : 0.32); }
    } else if (w.kind === 'crack' || w.kind === 'break') {
      // (a break's jag across the limb, or a crack's short one on the ribs: a line in the part's own darkest, a row up and down)
      // (on a dark cloth, the line's light; on a light one, dark: it has to show)
      const [l, h] = limb ? spanAt(g, B, w.part, y) : [x - (w.kind === 'crack' ? 2 : 3), x + (w.kind === 'crack' ? 2 : 3)];
      for (let xx = l; xx <= h; xx++) { const yy = y + ((xx - l) % 2), c = g.col[yy]?.[xx]; if (c !== null && c !== undefined) tint(g, xx, yy, lum(c) < 100 ? 0xf6f4ee : INK, lum(c) < 100 ? 0.5 : w.kind === 'break' ? 0.75 : 0.6); }
    }
  }
  // (a tourniquet high on the limb: its strap, the buckle at the outside; a splint: two staves down the limb, outside its line, tied)
  for (const k of M.tourniquets ?? []) {
    if (!(k in SIDE_OF)) continue;
    const y = TOURNIQUET_Y[k.startsWith('arm') ? 'arm' : 'leg'] - (k === 'armL' ? 1 : 0), [l, h] = band(g, B, k, y, STRAP), x = SIDE_OF[k] === lf ? l : h;
    g.put(x, y, BUCKLE); g.put(x, y + 1, mix(BUCKLE, INK, 0.45));
  }
  for (const k of M.splints ?? []) {
    if (!(k in SIDE_OF)) continue;
    const [y0, y1] = SPLINT_Y[k.startsWith('arm') ? 'arm' : 'leg'].map(y => y - (k === 'armL' ? 1 : 0));
    for (let y = y0; y <= y1; y++) {
      const [l, h] = spanAt(g, B, k, y);
      g.put(l - 1, y, y === y0 ? WOOD.light : WOOD.soft); g.put(h + 1, y, y === y0 ? WOOD.base : WOOD.shade);
    }
    for (const t of [0.15, 0.5, 0.85]) band(g, B, k, Math.round(y0 + (y1 - y0) * t), BANDAGE, 1);
  }
  return spots;
}

// ---------- the backdrop ----------

// (a wall and a floor, flat: a tone lighter than the darkest clothes, so a black coat has an edge)
const WALL = 0x383c4a, FLOOR = 0x2b2e3a, FLOOR_DARK = 0x1f2029;
function backdrop(x, y) {
  if (y < 118) return WALL;
  return Math.hypot((x - MID - 2) / 25, (y - FLOOR_Y - 0.5) / 4.2) < 1 ? FLOOR_DARK : FLOOR;   // (the shadow it stands in, thrown a little right)
}

/** The backdrop at a pixel of the rows (x may be past the figure's sides: the wall goes on, for a frame round it: src/ui/body.js). */
export const backdropAt = (x, y) => backdrop(x, y - DROP);

// ---------- the figure ----------

/** Rows of colours, H × W, nothing clear: the backdrop and the figure on it. { look, sex, marks, hand, bag, wounds }; with wounds, rows.spots: where each numbered one is (x, y on the rows). */
export function doll({ look = {}, sex = 'm', marks = {}, hand = null, bag = false, wounds: hurts = null } = {}) {
  const g = grid(), B = BODY[sex] ?? BODY.m, top = look.top ?? { kind: 'coat' }, dress = top.kind === 'dress', wrist = B.armIn[0][1];
  hair(g, look, true);
  if (isOpen(top) && CUT[top.kind].hem > 90) backOf(g, B, top);
  const leg = legs(g, B, look, dress);
  shoes(g, B, look, dress);
  if (!dress) onTrousers(g, B, marks, top, leg);
  let P = null;
  if (isOpen(top)) {
    if (top.hood) hood(g, B, top);
    shirt(g, B, look, top);
    belt(g, 12);
    P = openTop(g, B, look, top);
    collar(g, B, top, P);
  } else {
    P = closedTop(g, B, look, top);
    if (top.kind === 'tee') belt(g, B.hip + 0.8);
  }
  // (before the arms: the fingers close over what they hold)
  if (hand) heldThing(g, hand, [Math.round(MID - B.hand), wrist + 3]);
  if (bag) bagIn(g, [Math.round(MID + B.hand) - 1, wrist + 2]);
  arms(g, B, look, top);
  head(g, B, look, sex);
  glasses(g, look);
  hair(g, look, false);
  hat(g, look);
  // Where a part lies over an earlier one, its edge goes dark (before the marks: a seam mustn't cross a pocket's gold).
  const seams = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < W; x++) {
    const c = g.col[y][x], p = g.part[y][x];
    if (c === null || !p || y < g.edgeFrom[p]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
      const q = g.part[y + dy]?.[x + dx];
      if (q && q < p && !g.quiet.has(q) && g.col[y + dy][x + dx] !== null) { seams.push([x, y, mix(c, INK, 0.55)]); break; }
    }
  }
  for (const [x, y, c] of seams) g.col[y][x] = c;
  onTop(g, marks, top, P);
  const spots = hurts ? wounds(g, B, sex, hurts) : [];             // (the wounds over it all, as the pockets are: sim/diagnosis.js)
  // Then the ink, round the lot, on the wall.
  const rows = [...Array.from({ length: DROP }, () => Array(W).fill(null)), ...g.col], out = rows.map(r => [...r]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (rows[y][x] !== null) continue;
    out[y][x] = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? null) !== null) ? INK : backdrop(x, y - DROP);
  }
  out.spots = spots.map(o => ({ ...o, y: o.y + DROP }));
  return out;
}
