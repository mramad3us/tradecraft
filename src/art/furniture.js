// TRADECRAFT art: furniture for the interiors, every kind in src/sim/interiors/furniture.js, drawn
// the way the town's props are (pixeltown.js: cafeTable, bench, phonebox, cart, stall).
//
// A piece is a few boxes with painted faces, measured in pixels (PX_PER_M a metre). Every box's
// edges fall on whole pixels and the piece stands on the pixel grid (its x, z rounded to 1/16 m), so
// a face's texture, painted to the face's exact size, puts one texel on one screen pixel (a box an
// odd number of pixels wide, centred on the grid, would have its texels astride two and smear).
// The camera looks north and 45° down, so what reads is the top and the south (+z) face of each
// box: that's where the detail goes (a bed's duvet and pillows, a shelf's goods, a cooker's rings, a
// desk's papers), painted rather than modelled, as a 2D game would draw it. Sides are painted
// plainly but properly, since a piece turned left or right shows one of them to the camera; the
// backs of freestanding pieces too (a sofa turned 'up' shows its back). A wall piece's back is never
// seen. A piece's chairs (a dining table's, a desk's) are mirrored rather than turned, to stay on
// the grid.
//
// Outlines (pixelart.js) are drawn where one part meets another behind it, so a piece is split into
// parts where an ink line helps it read: a sofa's frame and each seat cushion, a bed's frame, its
// bedding and each pillow, a table and each of its chairs, a monitor and the desk under it. A part's
// plain boxes are merged into one mesh a colour (compact(), from pixeltown.js). The outline pass inks
// every pixel of anything under three pixels across that stands before something far, so thin
// things whose colour matters (a brass pole, a rope, a chrome rail) are drawn THIN: no outline, their
// own colour. Glass (a display case's, a bank's screen, a cake's dome) is see-through, lit as the rest
// is, and outlined with its part: a display case reads as one box with its goods inside.
//
// furniture(item) builds { kind, x, z, face = 'down', look = {}, seed = 1 } as a THREE.Group, centred
// on (x, z) on the floor (y 0), turned to its face (its footprint as the sim's footprint()). `look`
// varies a piece where the layouts want it to; what it doesn't give is picked from the seed, so a
// block of flats isn't one flat repeated. Textures are made once a look (keep(), shared with the
// town's), a seed's detail (which books, which goods) in four variants. The looks, by key (a colour
// may be a name from WOODS or FABRICS, or a number):
//   wood       most wooden things (bed, wardrobe, drawers, tables, desk, shelves, counters, bar, rack…)
//   fabric     sofa, armchair, chairs' seats, barStool, officeChair, waitingChairs
//   duvet, pattern ('checks' | 'stripes' | 'flowers' | 'quilt')                 bed, singleBed
//   front, top    a kitchen unit's doors and worktop (counter, sink); front 'white' | 'steel' (cooker, fridge)
//   goods      shelving, gondola: 'groceries' | 'books' | 'boxes' | 'shoes' | 'bottles' | 'phones' | 'tins';
//              displayCase: 'bread' | 'pastries' | 'cheese' | 'meat' | 'cakes'
//   colours    rug [field, border], coatRack [coat, hat], clothesRail and flowerBuckets [...]
//   pattern    rug: 'persian' | 'kilim' | 'plain'
//   on         bedsideTable, floorLamp, desk (its lamp), tv: lit; officeDesk: on unless false
//   kind, pot  plant: 'ficus' | 'snake'; 'terracotta' | 'white' | 'blue' | 'grey'
//   phone      phoneTable: 'red' | 'black' | 'cream' | 'green'
//   tread, rail, runner   stairs ('stone' | 'wood' | 'terrazzo'; a wood; a fabric, or false)
//   colour     shelving's frame, checkout's stripe, drinksFridge's brand, cafeCounter's tiles,
//              displayCase's cabinet, filingCabinet; metal: mailboxes, stanchions; rope: stanchions
//   curtain    fittingRoom; cloth ('white' | 'checks') restaurantTable; sign (its word) bankCounter;
//   water      bathtub (true: filled)
//
// What lights up: a lamp's shade, a TV's screen, a monitor, a drinks fridge, a till's display are
// painted in glow() (shown as painted, day or night) when on; signs' letters, a lift's floor, ovens'
// fires and a back bar's strip light are GLOWS colours, which light at night as a shop's do. A lamp
// that's on says where its light is (userData.light: { x, y, z } from the piece's centre, in metres,
// before it's turned) for the view to give it a pool(). A phone table's telephone is userData.phone
// (to shake it as it rings).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PX_PER_M, GLOWS, mat, glow, paint, box, roundedBox, part, rng, tone, noise, text, textWidth } from './pixelart.js';
import { keep } from './pixeltown.js';
import { FURNITURE } from '../sim/interiors/furniture.js';

const M = PX_PER_M;
const P = (m) => Math.max(1, Math.round(m * M));                 // metres → whole pixels
const TURN = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };

// ---------- colours ----------

const INK = 0x1a1214, PAPER = 0xf4efe6, SHEET = 0xe2dac6, LINEN = 0xf4efe6, ENAMEL = 0xe6e2da;
const STEEL = 0xb8bdc8, STEEL_D = 0x8f96a6, BLACK = 0x23252f, BRASS = 0xb9862e, CHROME = 0xdfe2e8;
const WOODS = { pine: 0xd6ad7a, oak: 0xb48459, teak: 0x8f6345, walnut: 0x6b4636, dark: 0x47302a, white: 0xe2dac6, grey: 0x8f96a6 };
const FABRICS = { green: 0x356f42, blue: 0x3b6296, red: 0x9e3c36, mustard: 0xb9862e, grey: 0x6a7182, plum: 0x7a4a86, teal: 0x2f6b62, brown: 0x8f6345, cream: 0xc4bba9, navy: 0x283f6b };
const BOOKS = [0x9e3c36, 0x6e2a2e, 0x283f6b, 0x3b6296, 0x24503a, 0x356f42, 0xb9862e, 0x7a5a22, 0x47302a, 0xe2dac6, 0x2f6b62, 0x4a2a52, 0xc95c45, 0x23252f];
const LABELS = [0x9e3c36, 0x3b6296, 0x356f42, 0xe7b84a, 0xc95c45, 0xf4efe6, 0x7a4a86, 0xb9862e, 0x2f6b62, 0x5d8fc2];
const FLOWERS = [0x9e3c36, 0xe7b84a, 0xf4efe6, 0xe8896a, 0x7a4a86, 0xc95c45, 0xf8e08a];

const pick = (r, list) => list[Math.floor(r() * list.length)];
const named = (v, table) => (typeof v === 'number' ? v : table[v]);
const woodOf = (v, r, list = ['oak', 'teak', 'walnut', 'pine']) => named(v, WOODS) ?? WOODS[pick(r, list)];
const fabricOf = (v, r, list = ['green', 'blue', 'red', 'mustard', 'grey', 'plum', 'teal']) => named(v, FABRICS) ?? FABRICS[pick(r, list)];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// ---------- materials ----------

/** A face's material, w × h pixels painted by draw(px, w, h, r) (r a random seeded by the key), made once a key. */
function tex(key, w, h, draw, { lit = false, glows = null } = {}) {
  return keep(`furn:${key}:${w}x${h}:${lit ? 1 : 0}`, () => {
    const t = paint(w, h, (px) => draw(px, w, h, rng(hash(key) + w * 31 + h)), glows ? { glows } : {});
    return lit ? glow(0, t) : mat(0, t);
  });
}
/** A repeating texture n pixels square (fabric, leaves, petals), for faces of any size. */
function rep(key, n, draw) {
  return keep(`furn-rep:${key}:${n}`, () => mat(0, paint(n, n, (px) => draw(px, n, n, rng(hash(key))), { repeat: true })));
}
// The toon ramp mat() uses (pixelart.js RAMP, not exported there): lit 1.0, turned from the sun 0.55.
const RAMP = (() => {
  const v = [0.55, 0.55, 1.0, 1.0, 1.0].map(x => Math.round(x * 255));
  const t = new THREE.DataTexture(new Uint8Array(v.flatMap(x => [x, x, x, 255])), v.length, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
// Glass: a pale tint, see-through, lit as the rest is (dark at night), casting no shadow; it's in
// the outline pass with the part it's in, so a display case is outlined as one box, the goods
// inside seen through it.
const GLASS = () => keep('furn:glass', () => new THREE.MeshToonMaterial({ color: 0xc8dde6, gradientMap: RAMP, transparent: true, opacity: 0.22 }));
// A thin thing's colour (a brass pole, a rope, a chrome rail): the outline pass inks every pixel of
// anything under three pixels across standing before something far, which would turn them all
// black. Drawn after the solid things, writing no depth and left out of the ID pass, it draws no
// outline and keeps its colour.
const THIN = (c) => keep(`furn:thin:${c}`, () => new THREE.MeshToonMaterial({ color: c, gradientMap: RAMP, transparent: true, depthWrite: false }));
// Faces given as colours or materials: { sides, top, front, … } (or one colour for all).
function F(f) {
  if (typeof f === 'number') return { sides: mat(f) };
  const o = {};
  for (const k of Object.keys(f)) o[k] = typeof f[k] === 'number' ? mat(f[k]) : f[k];
  return o;
}

// ---------- the kit: boxes in pixels, in parts ----------

/**
 * A prop's plain parts (one flat colour on every face) merged into one mesh a colour. From
 * pixeltown.js (not exported there), but leaving alone what's see-through or thin (glass, THIN).
 */
function compact(g) {
  const byMat = new Map();
  for (const m of [...g.children]) {
    if (!m.isMesh || m.userData.noId) continue;
    const mats = [m.material].flat();
    if (mats.some(x => x !== mats[0]) || mats[0].map || mats[0].transparent) continue;
    m.updateMatrix();
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    geo.clearGroups();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!byMat.has(mats[0])) byMat.set(mats[0], []);
    byMat.get(mats[0]).push(geo);
    g.remove(m); m.geometry.dispose();
  }
  for (const [material, geos] of byMat) {
    const mesh = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], material);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

/**
 * A piece being built: comp() starts a part (a group: its own outline), whose box(w, h, d, faces,
 * x, y, z) puts a box w × h × d pixels with its bottom centre at (x, y, z) pixels from the piece's
 * centre on the floor; round() a rounded one (corners r px); glass() a pane; thin() a thin thing
 * (THIN); beam(a, b, t, colour, thin) a bar t px thick from a to b ([x, y, z] px: a rope, a rail).
 * done() merges and numbers the parts.
 */
function kit() {
  const g = new THREE.Group(), comps = [];
  const comp = () => {
    const c = new THREE.Group();
    g.add(c); comps.push(c);
    const put = (m, x, y, z) => { m.position.set(x / M, y / M, z / M); c.add(m); return m; };
    // A box's west, bottom and north edges on whole pixels, so its texels are the screen's pixels
    // (a box an odd number of pixels wide, centred on the grid, would have them astride two; every
    // half-pixel goes the same way, so boxes that meet still meet).
    const putBox = (m, w, h, d, x, y, z) => put(m, Math.round(x - w / 2) + w / 2, Math.round(y), Math.round(z - d / 2) + d / 2);
    return {
      group: c,
      box: (w, h, d, faces, x = 0, y = 0, z = 0) => putBox(box(w / M, h / M, d / M, F(faces)), w, h, d, x, y, z),
      round: (w, h, d, rr, faces, x = 0, y = 0, z = 0) => putBox(roundedBox(w / M, h / M, d / M, rr / M, F(faces)), w, h, d, x, y, z),
      glass(w, h, d, x = 0, y = 0, z = 0) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w / M, h / M, d / M).translate(0, h / M / 2, 0), GLASS());
        m.renderOrder = 2;
        return putBox(m, w, h, d, x, y, z);
      },
      /** A thin thing in its own colour, drawing no outline (THIN). */
      thin(w, h, d, colour, x = 0, y = 0, z = 0) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w / M, h / M, d / M).translate(0, h / M / 2, 0), THIN(colour));
        m.userData.noId = true;
        m.castShadow = true;
        m.renderOrder = 1;
        return putBox(m, w, h, d, x, y, z);
      },
      beam(a, b, t, colour, thin = false) {
        const A = new THREE.Vector3(...a).divideScalar(M), B = new THREE.Vector3(...b).divideScalar(M);
        const m = new THREE.Mesh(new THREE.BoxGeometry(t / M, t / M, A.distanceTo(B)), thin ? THIN(colour) : mat(colour));
        m.position.copy(A).add(B).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.clone().sub(A).normalize());
        m.castShadow = true; m.receiveShadow = !thin;
        if (thin) { m.userData.noId = true; m.renderOrder = 1; }
        c.add(m);
        return m;
      },
      add: put,
    };
  };
  return { g, comp, done() { for (const c of comps) { compact(c); part(c); } return g; } };
}

// ---------- painting (px(x, y, w, h, colour), y from the top) ----------

/** A frame's bevel: lit along the top and left, in shade along the bottom and right. */
function bevel(px, x, y, w, h, c, k = 1) {
  px(x, y, w, 1, tone(c, 0.06 * k)); px(x, y, 1, h, tone(c, 0.04 * k));
  px(x, y + h - 1, w, 1, tone(c, -0.1 * k)); px(x + w - 1, y, 1, h, tone(c, -0.08 * k));
}
/** A sunk panel: in shade along the top and left, lit along the bottom and right. */
function sunk(px, x, y, w, h, c) {
  px(x, y, w, h, c);
  px(x, y, w, 1, tone(c, -0.1)); px(x, y, 1, h, tone(c, -0.08));
  px(x, y + h - 1, w, 1, tone(c, 0.05)); px(x + w - 1, y + 1, 1, h - 1, tone(c, 0.04));
}
/** Wood: grain in streaks of a tone either way along x (or y), a knot now and then. */
function grain(px, x, y, w, h, c, r, vertical = false) {
  px(x, y, w, h, c);
  for (let i = 0, n = Math.ceil(w * h / 7); i < n; i++) {
    const len = 2 + Math.floor(r() * 5), d = r() < 0.55 ? -0.04 : 0.03;
    const xx = x + Math.floor(r() * w), yy = y + Math.floor(r() * h);
    if (vertical) px(xx, yy, 1, Math.min(len, y + h - yy), tone(c, d)); else px(xx, yy, Math.min(len, x + w - xx), 1, tone(c, d));
  }
  if (w * h > 60 && r() < 0.5) px(x + Math.floor(r() * (w - 1)), y + Math.floor(r() * (h - 1)), 1, 1, tone(c, -0.1));
}
/** Fabric: a soft mottle of the cloth's own tones. */
function cloth(px, x, y, w, h, c, seed = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = noise((x + i) / 3, (y + j) / 3, seed);
    px(x + i, y + j, 1, 1, v < 0.26 ? tone(c, -0.035) : v > 0.78 ? tone(c, 0.02) : c);
  }
}
/** A filled ellipse centred at (cx, cy) (a pixel's centre is +0.5), radii rx, ry. */
function oval(px, cx, cy, rx, ry, c) {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
    const a = (i + 0.5 - cx) / rx, b = (j + 0.5 - cy) / ry;
    if (a * a + b * b <= 1.0) px(i, j, 1, 1, c);
  }
}
/** A wooden top seen from above: grain along x, its front edge (the bottom row) catching the light. */
const woodTop = (c, w, h) => tex(`woodtop-${c}`, w, h, (px, W, H, r) => { grain(px, 0, 0, W, H, c, r); px(0, H - 1, W, 1, tone(c, 0.05)); });
/** A plain side panel: its colour, bevelled. */
const panel = (c, w, h, key = '') => tex(`panel-${c}-${key}`, w, h, (px, W, H) => { px(0, 0, W, H, c); bevel(px, 0, 0, W, H, c); });
/** A wood side panel: grain, bevelled. */
const woodSide = (c, w, h, vertical = true) => tex(`woodside-${c}-${vertical}`, w, h, (px, W, H, r) => { grain(px, 0, 0, W, H, c, r, vertical); bevel(px, 0, 0, W, H, c); });

/**
 * A cabinet's front, w × h in colour c: rows from the top, each { h, n, kind } split into n cells,
 * kind 'drawer' (a raised panel, a handle in its middle), 'door' (a panel, its handle by the pair's
 * middle), 'open' (a dark recess), 'glass' (a pane); a plinth at the foot.
 */
function cabinet(px, w, h, c, rows, { handle = STEEL_D, plinth = 1, gap = 1, frame = 1, r = null } = {}) {
  if (r) grain(px, 0, 0, w, h, c, r, true); else px(0, 0, w, h, c);
  bevel(px, 0, 0, w, h, c);
  if (plinth) px(0, h - plinth, w, plinth, tone(c, -0.25));
  let y = frame;
  for (const row of rows) {
    const cw = (w - 2 * frame - (row.n - 1) * gap) / row.n;
    for (let i = 0; i < row.n; i++) {
      const x0 = Math.round(frame + i * (cw + gap)), x1 = Math.round(frame + i * (cw + gap) + cw), ww = x1 - x0, hh = row.h;
      if (row.kind === 'open') { px(x0, y, ww, hh, tone(c, -0.32)); px(x0, y, ww, 1, tone(c, -0.42)); continue; }
      if (row.kind === 'glass') { px(x0, y, ww, hh, 0x4c5a66); px(x0 + 1, y + 1, 1, Math.max(1, hh - 2), 0x7d93a3); continue; }
      bevel(px, x0, y, ww, hh, c);
      if (row.kind === 'door') {
        if (ww >= 5 && hh >= 6) sunk(px, x0 + 1, y + 1, ww - 2, hh - 2, tone(c, -0.02));
        const hx = row.n === 1 ? x1 - 2 : i % 2 === 0 ? x1 - 2 : x0 + 1;
        px(hx, y + Math.min(2, hh - 2), 1, Math.min(2, hh - 2), handle);
      } else {
        const hw = ww >= 6 ? 2 : 1;
        px(x0 + Math.floor((ww - hw) / 2), y + Math.floor((hh - 1) / 2), hw, 1, handle);
      }
    }
    y += row.h + gap;
  }
}

// ---------- goods on shelves (painted onto a shelf's front, standing on its board) ----------

// Each goods kind draws one thing at x on a shelf whose top is `floor` (exclusive), in a compartment
// h high, and says how wide it was (and the gap after it).
const GOODS = {
  groceries(px, x, floor, h, r) {
    const k = r(), c = pick(r, LABELS);
    if (k < 0.38) { const hh = Math.min(h - 1, 4 + Math.floor(r() * 2)); px(x, floor - hh, 3, hh, c); px(x, floor - hh, 3, 1, tone(c, 0.1)); px(x, floor - hh + 2, 3, 1, PAPER); px(x + 2, floor - hh + 1, 1, hh - 1, tone(c, -0.1)); return 3; }   // a box
    if (k < 0.6) { px(x, floor - 3, 2, 3, c); px(x, floor - 3, 2, 1, STEEL); px(x, floor - 2, 1, 1, tone(c, 0.12)); return 2; }   // a jar
    if (k < 0.82) { px(x, floor - 3, 3, 3, c); px(x + 1, floor - 2, 1, 1, PAPER); px(x, floor - 3, 3, 1, tone(c, -0.08)); return 3; }   // a packet
    px(x, floor - 4, 1, 4, c); px(x, floor - 5, 1, 1, PAPER); return 1;   // a bottle
  },
  books(px, x, floor, h, r) {
    if (r() < 0.07) return 1;                                     // (a gap)
    const c = pick(r, BOOKS);
    if (r() < 0.08) { const n = 1 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { const cc = pick(r, BOOKS); px(x, floor - 1 - i, 4, 1, cc); px(x + 3, floor - 1 - i, 1, 1, tone(cc, -0.1)); } return 4; }   // lying flat
    const w = r() < 0.65 ? 1 : 2, hh = Math.max(2, h - 1 - Math.floor(r() * 3));
    px(x, floor - hh, w, hh, c);
    if (hh > 3) px(x, floor - hh + 1, w, 1, tone(c, 0.14));        // a band on the spine
    if (w === 2) px(x + 1, floor - hh, 1, hh, tone(c, -0.08));
    return w;
  },
  boxes(px, x, floor, h, r) {                                     // a pharmacy's: white boxes with a stripe, small bottles
    if (r() < 0.2) { const c = pick(r, [0x7a5a22, PAPER, 0x3b6296]); px(x, floor - 2, 1, 2, c); px(x, floor - 3, 1, 1, PAPER); return 1; }
    const s = pick(r, [0x356f42, 0x3b6296, 0x9e3c36, 0x2f6b62, 0xe7b84a]), stack = h >= 5 && r() < 0.5 ? 2 : 1;
    for (let i = 0; i < stack; i++) { const y = floor - 2 * (i + 1); px(x, y, 3, 2, i ? 0xdfe2e8 : PAPER); px(x, y + 1, 3, 1, s); px(x + 2, y, 1, 2, tone(i ? 0xdfe2e8 : PAPER, -0.08)); }
    return 3;
  },
  shoes(px, x, floor, h, r) {
    const c = pick(r, [0x47302a, 0x23252f, 0x6b4636, 0xf4efe6, 0x9e3c36, 0x283f6b, 0xb48459]), sole = c === 0xf4efe6 ? 0x8f96a6 : tone(c, -0.15);
    const boot = h >= 5 && r() < 0.3;
    for (const dx of [0, 3]) {
      if (boot) { px(x + dx, floor - 4, 2, 3, c); px(x + dx, floor - 1, 3, 1, sole); px(x + dx + 2, floor - 2, 1, 1, c); }
      else { px(x + dx, floor - 2, 2, 1, c); px(x + dx, floor - 1, 3, 1, sole); px(x + dx + 2, floor - 2, 1, 1, tone(c, 0.08)); }
    }
    return 7;
  },
  bottles(px, x, floor, h, r) {
    const c = pick(r, [0x24503a, 0x356f42, 0x6b4636, 0x47302a, 0xb8bdc8, 0x6e2a2e, 0xb9862e]), hh = Math.min(h - 1, 5);
    px(x, floor - hh + 2, 2, hh - 2, c); px(x, floor - hh, 1, 2, tone(c, -0.05)); px(x, floor - hh, 1, 1, pick(r, [0x9e3c36, BRASS, PAPER, BLACK]));
    px(x, floor - 2, 2, 1, PAPER); px(x + 1, floor - hh + 2, 1, hh - 2, tone(c, -0.1));
    return 2;
  },
  phones(px, x, floor, h, r) {
    if (r() < 0.35) { px(x, floor - 2, 3, 2, PAPER); px(x + 1, floor - 2, 1, 1, BLACK); px(x + 2, floor - 2, 1, 2, 0xdfe2e8); return 3; }   // a boxed one
    px(x, floor - 4, 2, 4, BLACK); px(x, floor - 4, 1, 3, pick(r, [0x95c1e3, 0x5d8fc2, 0x76ad4c, 0xe8896a])); px(x, floor - 1, 2, 1, STEEL_D);
    return 2;
  },
  tins(px, x, floor, h, r) {
    const c = pick(r, [0x9e3c36, 0x3b6296, 0x356f42, 0xe7b84a, 0xc95c45]), stack = h >= 6 ? 2 : 1;
    for (let i = 0; i < stack; i++) { const y = floor - 3 * (i + 1); px(x, y, 2, 3, c); px(x, y, 2, 1, STEEL); px(x, y + 1, 2, 1, PAPER); px(x + 1, y + 1, 1, 2, tone(c, -0.1)); }
    return 2;
  },
  bread(px, x, floor, h, r) {                                     // loaves on a rack: boules and bâtards, crust ramps
    const c = pick(r, [0xb48459, 0x8f6345, 0xd6ad7a, 0xb9862e]);
    if (r() < 0.5) { px(x + 1, floor - 3, 2, 1, tone(c, 0.08)); px(x, floor - 2, 4, 2, c); px(x + 1, floor - 2, 1, 1, tone(c, 0.12)); px(x + 3, floor - 2, 1, 2, tone(c, -0.1)); return 4; }
    px(x, floor - 2, 5, 2, c); px(x + 1, floor - 2, 1, 1, tone(c, 0.12)); px(x + 3, floor - 2, 1, 1, tone(c, 0.12)); px(x, floor - 1, 5, 1, tone(c, -0.1));
    return 5;
  },
};
/** Goods along a shelf: x0 … x0 + w, standing on `floor`, in a compartment h high. */
function stock(px, x0, floor, w, h, goods, r) {
  const draw = GOODS[goods] ?? GOODS.groceries;
  for (let x = x0; x < x0 + w;) {
    const before = x;
    // (painted into a scratch so a thing too wide for what's left isn't drawn)
    const marks = [];
    const n = draw((a, b, c, d, e) => marks.push([a, b, c, d, e]), x, floor, h, r);
    if (x + n > x0 + w) break;
    for (const m of marks) px(...m);
    x += n + (goods === 'tins' || goods === 'books' ? 0 : 1);
    if (x === before) break;
  }
}
/** A shelf unit's front, w × h: uprights, a kick plate, `rows` shelves of goods, price strips on their edges. */
function shelfFront(px, w, h, goods, r, { rows = 5, side = 0x6a7182, back = 0x3a3036, edge = 0xdfe2e8, kick = 0x4c5262, top = 0 } = {}) {
  px(0, 0, w, h, back);
  const kickH = 3, body = h - kickH - top, ch = Math.floor((body - rows) / rows);
  px(0, h - kickH, w, kickH, kick); px(0, h - kickH, w, 1, tone(kick, 0.08));
  let y = top + (body - rows * (ch + 1));
  for (let i = 0; i < rows; i++) {
    px(1, y, w - 2, 1, tone(back, -0.08));                       // (the shade under the shelf above)
    stock(px, 1, y + ch, w - 2, ch, goods, r);
    px(0, y + ch, w, 1, edge);                                   // the shelf's edge, a price tag here and there
    for (let x = 2 + Math.floor(r() * 3); x < w - 2; x += 4 + Math.floor(r() * 3)) px(x, y + ch, 1, 1, r() < 0.3 ? 0xe7b84a : PAPER);
    y += ch + 1;
  }
  px(0, 0, 1, h, side); px(w - 1, 0, 1, h, tone(side, -0.08));
}

// ---------- shared pieces ----------

/**
 * A wooden dining chair at (x, z) in a part c, its seat facing +z (turned: −z, mirrored rather than
 * rotated, so it stays on the pixel grid): legs, a seat, a ladder back.
 */
function woodChair(c, wood, seat, x, z, turned = false) {
  const s = turned ? -1 : 1;
  const back = tex(`chairback-${wood}`, 7, 8, (px, w, h) => { px(0, 0, w, h, wood); bevel(px, 0, 0, w, h, wood); px(1, 2, w - 2, 1, tone(wood, -0.3)); px(1, 4, w - 2, 1, tone(wood, -0.3)); px(1, 6, w - 2, 2, tone(wood, -0.3)); });
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) c.box(1, 7, 1, tone(wood, -0.08), x + lx, 0, z + lz);
  c.box(7, 1, 7, { sides: wood, top: seat }, x, 7, z);
  c.box(7, 8, 1, { sides: wood, front: back, back }, x, 8, z - 3 * s);
}
const seatTop = (c) => tex(`seat-${c}`, 7, 7, (px, w, h) => { px(0, 0, w, h, c); px(1, 1, w - 2, h - 2, tone(c, 0.04)); px(0, h - 1, w, 1, tone(c, -0.08)); });

/** A tiled splashback behind a kitchen's worktop: white metro tiles, 2 × 1 px, in a grey joint. */
const splash = (w, h) => tex('splash', w, h, (px, W, H) => {
  px(0, 0, W, H, 0xb8bdc8);
  for (let y = 0; y < H; y++) for (let x = (y % 2) * 2 - 2; x < W; x += 4) { px(x, y, 3, 1, y % 3 ? 0xe6e2da : 0xdfe2e8); }
  px(0, H - 1, W, 1, 0x8f96a6);
});

/** A worktop seen from above: laminate or wood, an edge, things on it by variant. */
function worktop(px, w, h, c, r) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, tone(c, noise(x / 3, y / 2, 7) < 0.3 ? -0.03 : 0));
  px(0, h - 1, w, 1, tone(c, 0.06));
}

// ---------- the makers, kind by kind (px; the piece's back at BK, its front at FR) ----------

function bedMaker(k, o, n) {
  const { W, D, BK, FR, look, r } = o;
  const wood = woodOf(look.wood, r), duvet = fabricOf(look.duvet, r), pattern = look.pattern ?? pick(r, ['checks', 'stripes', 'flowers', 'quilt']);
  const HB = n === 2 ? 16 : 14;
  const frame = k.comp();
  frame.box(W, HB, 2, { sides: wood, top: tone(wood, 0.05), front: tex(`headboard-${wood}-${n}`, W, HB, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr, true); bevel(px, 0, 0, w, h, wood);
    px(0, 0, w, 2, tone(wood, 0.04)); px(0, 1, w, 1, tone(wood, -0.06));
    const np = n === 2 ? 3 : 2, pw = Math.floor((w - 2 - (np + 1)) / np);
    for (let i = 0; i < np; i++) sunk(px, 2 + i * (pw + 1) + Math.floor((w - 2 - np * (pw + 1)) / 2), 3, pw, h - 7, tone(wood, -0.03));
  }) }, 0, 0, BK + 1);
  frame.box(W, 5, D - 2, { sides: woodSide(wood, D - 2, 5, false), top: wood, front: tex(`bedbase-${wood}`, W, 5, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr); bevel(px, 0, 0, w, h, wood); px(2, h - 1, w - 4, 1, tone(wood, -0.3));
  }) }, 0, 0, BK + 2 + (D - 2) / 2);
  const bedding = k.comp();
  bedding.box(W - 2, 3, D - 3, { sides: SHEET, top: tex('sheet', W - 2, D - 3, (px, w, h) => { cloth(px, 0, 0, w, h, SHEET, 5); }) }, 0, 5, BK + 2 + (D - 3) / 2);
  const DL = Math.round((D - 2) * 0.62);
  const fold = 3;
  const dTop = tex(`duvet-${duvet}-${pattern}`, W, DL, (px, w, h, rr) => {
    drawPattern(px, 0, fold, w, h - fold, duvet, pattern, rr);
    px(0, 0, w, fold, LINEN); px(0, 0, w, 1, tone(LINEN, 0.02)); px(0, fold - 1, w, 1, tone(SHEET, -0.1));   // folded back: the cover's lining
    px(0, fold, w, 1, tone(duvet, -0.14));
    for (let y = fold + 1; y < h; y += 1) { px(0, y, 1, 1, tone(duvet, -0.08)); px(w - 1, y, 1, 1, tone(duvet, -0.12)); }
  });
  const dFront = tex(`duvetfront-${duvet}-${pattern}`, W, 4, (px, w, h, rr) => { drawPattern(px, 0, 0, w, h, duvet, pattern, rr); px(0, h - 1, w, 1, tone(duvet, -0.16)); px(0, 0, w, 1, tone(duvet, 0.05)); });
  const dSide = tex(`duvetside-${duvet}-${pattern}`, DL, 4, (px, w, h, rr) => { drawPattern(px, 0, 0, w, h, duvet, pattern, rr); px(0, h - 1, w, 1, tone(duvet, -0.16)); px(0, 0, w, 1, LINEN); });
  bedding.box(W, 4, DL, { sides: dSide, top: dTop, front: dFront }, 0, 5, FR - DL / 2);
  const pw = n === 2 ? Math.floor((W - 6) / 2) : W - 5;
  for (let i = 0; i < n; i++) {
    const x = n === 2 ? (i ? 1 : -1) * (pw / 2 + 1) : 0;
    k.comp().round(pw, 2, 6, 0.8, { sides: PAPER, top: tex(`pillow-${pw}`, pw, 6, (px, w, h) => { px(0, 0, w, h, PAPER); px(0, h - 1, w, 1, tone(SHEET, -0.04)); px(1, 2, w - 2, 1, tone(PAPER, -0.05)); px(w - 1, 0, 1, h, tone(SHEET, -0.03)); }) }, x, 8, BK + 2.5 + 3);
  }
}
/** A duvet's or a rug's field: checks, stripes, flowers, quilt. */
function drawPattern(px, x0, y0, w, h, c, pattern, r) {
  const lo = tone(c, -0.07), hi = tone(c, 0.1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let col = c;
    if (pattern === 'checks') col = ((x >> 1) + (y >> 1)) % 2 ? hi : c, col = (x % 4 === 3 || y % 4 === 3) ? lo : col;
    else if (pattern === 'stripes') col = x % 4 < 2 ? c : tone(c, 0.16);
    else if (pattern === 'quilt') col = (x % 5 === 0 || y % 5 === 0) ? lo : noise(x / 2, y / 2, 3) > 0.65 ? hi : c;
    px(x0 + x, y0 + y, 1, 1, col);
  }
  if (pattern === 'flowers') for (let y = 1; y < h - 1; y += 4) for (let x = 1 + (y % 8 ? 2 : 0); x < w - 1; x += 5) {
    const fx = x0 + x + Math.floor(r() * 2), fy = y0 + y;
    px(fx, fy, 1, 1, 0xf8e08a); px(fx - 1, fy, 1, 1, PAPER); px(fx + 1, fy, 1, 1, PAPER); px(fx, fy - 1, 1, 1, PAPER); px(fx, fy + 1, 1, 1, tone(c, -0.1));
  }
}

function bedsideTable(k, o) {
  const { W, D, look, r } = o, wood = woodOf(look.wood, r);
  k.comp().box(W, 9, D, { sides: woodSide(wood, D, 9), top: woodTop(wood, W, D), front: tex(`bedside-${wood}`, W, 9, (px, w, h, rr) => cabinet(px, w, h, wood, [{ h: 3, n: 1, kind: 'drawer' }, { h: 3, n: 1, kind: 'open' }], { handle: BRASS, r: rr })) });
  lampOn(k, o, { x: -1, y: 9, z: -0.5, stem: 2, shade: 5, sh: 4 });
  k.comp().box(3, 1, 2, { sides: 0x6e2a2e, top: tex('booktop', 3, 2, (px) => { px(0, 0, 3, 2, 0x6e2a2e); px(0, 1, 3, 1, PAPER); }) }, 2, 9, 1);
}
/** A small lamp: a base, a stem, a shade (lit when look.on). */
function lampOn(k, o, { x, y, z, stem, shade, sh, base = BRASS, colour = 0xe2dac6 }) {
  const on = !!o.look.on, c = k.comp();
  c.box(2, 1, 2, base, x, y, z);
  c.thin(1, stem, 1, base, x, y + 1, z);
  const s = on
    ? tex(`shade-on-${shade}-${sh}`, shade, sh, (px, w, h) => { px(0, 0, w, h, 0xf8e08a); px(0, h - 1, w, 1, PAPER); px(w - 1, 0, 1, h, 0xe7b84a); }, { lit: true })
    : tex(`shade-${colour}-${shade}-${sh}`, shade, sh, (px, w, h) => { cloth(px, 0, 0, w, h, colour, 2); px(0, h - 1, w, 1, tone(colour, -0.08)); px(w - 1, 0, 1, h, tone(colour, -0.06)); });
  const top = on ? tex(`shadetop-on-${shade}`, shade, shade, (px, w, h) => { px(0, 0, w, h, 0xe7b84a); px(1, 1, w - 2, h - 2, PAPER); }, { lit: true }) : tex(`shadetop-${colour}-${shade}`, shade, shade, (px, w, h) => { px(0, 0, w, h, colour); px(1, 1, w - 2, h - 2, tone(colour, -0.2)); });
  c.box(shade, sh, shade, { sides: s, top }, x, y + 1 + stem, z);
  if (on) o.light = { x: x / M, y: (y + 1 + stem + sh / 2) / M, z: z / M };
}

function wardrobe(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r, ['oak', 'teak', 'walnut', 'white']);
  const body = k.comp();
  body.box(W, 1, D - 1, tone(wood, -0.3), 0, 0, -0.5);
  body.box(W, 31, D, { sides: woodSide(wood, D, 31), top: woodTop(wood, W, D), front: tex(`wardrobe-${wood}`, W, 31, (px, w, h, rr) => {
    cabinet(px, w, h, wood, [{ h: h - 4, n: 2, kind: 'door' }], { handle: BRASS, plinth: 0, frame: 2, r: rr });
    px(0, 0, w, 2, tone(wood, 0.05)); px(0, 1, w, 1, tone(wood, -0.08));          // the cornice
    px(Math.floor(w / 2) - 2, 13, 1, 3, BRASS); px(Math.floor(w / 2) + 1, 13, 1, 3, BRASS);
    px(Math.floor(w / 2) - 2, 17, 1, 1, INK);
  }) }, 0, 1, 0);
  if (v % 2 === 0) k.comp().box(10, 3, 6, { sides: 0x6b4636, top: tex('suitcase', 10, 6, (px, w, h) => { px(0, 0, w, h, 0x6b4636); px(0, 0, w, 1, 0x8f6345); px(4, 2, 2, 1, BRASS); px(0, h - 1, w, 1, 0x47302a); }), front: tex('suitcasefront', 10, 3, (px, w, h) => { px(0, 0, w, h, 0x6b4636); px(1, 1, w - 2, 1, 0x47302a); px(4, 0, 2, 1, BRASS); }) }, -2, 32, 0);
}

function drawers(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r);
  k.comp().box(W, 14, D, { sides: woodSide(wood, D, 14), top: woodTop(wood, W, D), front: tex(`drawers-${wood}`, W, 14, (px, w, h, rr) => cabinet(px, w, h, wood, [{ h: 2, n: 2, kind: 'drawer' }, { h: 3, n: 1, kind: 'drawer' }, { h: 3, n: 1, kind: 'drawer' }], { handle: BRASS, r: rr, plinth: 2 })) });
  const c = k.comp();                                            // a framed photo, a bowl
  c.box(2, 3, 1, { sides: BLACK, front: tex('photo', 2, 3, (px) => { px(0, 0, 2, 3, BLACK); px(0, 1, 2, 1, 0x95c1e3); px(0, 2, 2, 1, 0x76ad4c); }) }, -4, 14, -1);
  if (v % 2) c.box(3, 1, 3, { sides: 0x3b6296, top: tex('bowl', 3, 3, (px) => { px(0, 0, 3, 3, 0x3b6296); px(1, 1, 1, 1, 0xe7b84a); }) }, 3, 14, 0);
}

function sofaMaker(k, o, seats, A = 3) {
  const { W, D, BK, FR, look, r } = o;
  const f = fabricOf(look.fabric, r, ['green', 'blue', 'red', 'mustard', 'plum', 'teal', 'brown']), legs = woodOf(look.wood, r, ['walnut', 'dark', 'teak']);
  const fab = rep(`fabric-${f}`, 16, (px, w, h) => cloth(px, 0, 0, w, h, f, hash(String(f)) % 97));
  const seat = tone(f, 0.07), lit = tone(f, 0.1);                // (the cushions a shade lighter than the frame, the arms' and back's tops lit)
  // A back the whole width, the arms forward of it and lower, the seat cushions between them.
  const frame = k.comp(), BD = 4, IN = W - 2 * A, backH = 9, armH = 10;
  for (const [x, z] of [[-W / 2 + 1, BK + 1], [W / 2 - 1, BK + 1], [-W / 2 + 1, FR - 1], [W / 2 - 1, FR - 1]]) frame.box(1, 1, 1, legs, x, 0, z);
  frame.box(W, 4, D, { sides: fab, front: tex(`sofabase-${f}-${W}`, W, 4, (px, w, h) => { cloth(px, 0, 0, w, h, f, 3); px(0, 0, w, 1, tone(f, 0.06)); px(0, h - 1, w, 1, tone(f, -0.12)); }), back: tex(`sofabaseback-${f}-${W}`, W, 4, (px, w, h) => { cloth(px, 0, 0, w, h, tone(f, -0.1), 3); px(0, h - 1, w, 1, tone(f, -0.2)); }) }, 0, 1, 0);
  frame.round(W, backH, BD, 1, { sides: tex(`sofabackside-${f}`, BD, backH, (px, w, h) => { cloth(px, 0, 0, w, h, f, 5); px(0, 0, w, 1, tone(f, 0.07)); }), top: tex(`sofabacktop-${f}-${W}`, W, BD, (px, w, h) => { cloth(px, 0, 0, w, h, lit, 4); px(0, 0, w, 1, f); px(0, h - 1, w, 1, tone(lit, 0.05)); }), front: tex(`sofaback-${f}-${W}-${seats}`, W, backH, (px, w, h) => {
    cloth(px, 0, 0, w, h, f, 6);
    px(0, 0, w, 1, tone(f, 0.08));
    for (let i = 0; i <= seats; i++) { const x = A + Math.round(i * (w - 2 * A) / seats); if (i > 0 && i < seats) px(x, 1, 1, h - 1, tone(f, -0.14)); }
    for (let i = 0; i < seats; i++) { const x = A + Math.round((i + 0.5) * (w - 2 * A) / seats); px(x, 3, 1, 1, tone(f, -0.12)); }   // a button a cushion
    px(0, h - 1, w, 1, tone(f, -0.12));
  }), back: tex(`sofabackback-${f}-${W}`, W, backH, (px, w, h) => { cloth(px, 0, 0, w, h, f, 7); px(0, 0, w, 1, tone(f, 0.1)); px(0, 1, w, 1, tone(f, 0.05)); px(0, 2, w, 1, tone(f, -0.08)); for (let x = 3; x < w - 2; x += 6) px(x, 3, 1, h - 4, tone(f, -0.06)); px(0, h - 1, w, 1, tone(f, -0.14)); }) }, 0, 5, BK + BD / 2);
  const AD = D - BD;
  const armSide = tex(`sofaarmside-${f}-${AD}`, AD, armH, (px, w, h) => { cloth(px, 0, 0, w, h, f, 8); px(0, 0, w, 1, tone(f, 0.07)); px(0, h - 1, w, 1, tone(f, -0.12)); });
  for (const s of [-1, 1]) frame.round(A, armH, AD, 0.9, { sides: armSide, top: tex(`sofaarmtop-${f}-${A}-${AD}`, A, AD, (px, w, h) => { cloth(px, 0, 0, w, h, lit, 9); px(0, h - 1, w, 1, tone(lit, 0.06)); px(w - 1, 0, 1, h, f); }), front: tex(`sofaarm-${f}`, A, armH, (px, w, h) => { cloth(px, 0, 0, w, h, f, 10); px(0, 0, w, 1, tone(f, 0.08)); px(w - 1, 0, 1, h, tone(f, -0.1)); px(0, h - 1, w, 1, tone(f, -0.14)); }) }, s * (W / 2 - A / 2), 1, FR - AD / 2);
  const edges = Array.from({ length: seats + 1 }, (_, i) => -IN / 2 + Math.round(i * IN / seats));
  for (let i = 0; i < seats; i++) {
    const cw = edges[i + 1] - edges[i];
    k.comp().round(cw, 2, AD, 0.7, { sides: tone(seat, -0.04), top: tex(`cushion-${seat}-${cw}-${AD}`, cw, AD, (px, w, h) => { cloth(px, 0, 0, w, h, seat, 11); px(0, 0, w, 2, tone(f, -0.08)); px(1, h - 1, w - 2, 1, tone(seat, 0.07)); px(0, 0, 1, h, tone(f, -0.06)); px(w - 1, 0, 1, h, tone(f, -0.08)); }), front: tex(`cushionfront-${seat}-${cw}`, cw, 2, (px, w, h) => { px(0, 0, w, h, seat); px(0, 0, w, 1, tone(seat, 0.08)); px(0, h - 1, w, 1, tone(seat, -0.1)); }) }, (edges[i] + edges[i + 1]) / 2, 5, FR - AD / 2);
  }
}

function coffeeTable(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r);
  const c = k.comp();
  for (const [x, z] of [[-W / 2 + 1, -D / 2 + 1], [W / 2 - 1, -D / 2 + 1], [-W / 2 + 1, D / 2 - 1], [W / 2 - 1, D / 2 - 1]]) c.box(1, 6, 1, tone(wood, -0.1), x, 0, z);
  c.box(W - 2, 1, D - 2, { sides: wood, top: tex(`magazines-${wood}-${v}`, W - 2, D - 2, (px, w, h, rr) => { grain(px, 0, 0, w, h, tone(wood, -0.04), rr); px(2, 1, 5, 4, 0xe7b84a); px(2, 1, 5, 1, 0x9e3c36); px(4, 3, 4, 3, 0x5d8fc2); px(4, 3, 4, 1, PAPER); }) }, 0, 2, 0);
  c.box(W, 1, D, { sides: wood, top: tex(`coffeetop-${wood}-${v}`, W, D, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr); px(0, h - 1, w, 1, tone(wood, 0.05)); bevel(px, 0, 0, w, h, wood, 0.5);
    px(3, 2, 6, 4, PAPER); px(3, 2, 6, 1, 0x23252f); px(4, 4, 4, 1, 0x8f96a6); px(4, 5, 3, 1, 0x8f96a6); px(8, 2, 1, 4, tone(PAPER, -0.08));   // the paper
    px(w - 5, 3, 2, 2, PAPER); px(w - 5, 3, 1, 1, 0x47302a);       // a mug
  }) }, 0, 6, 0);
}

function tvMaker(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r, ['walnut', 'dark', 'oak', 'white']);
  k.comp().box(W, 8, D, { sides: woodSide(wood, D, 8), top: woodTop(wood, W, D), front: tex(`tvstand-${wood}`, W, 8, (px, w, h, rr) => {
    cabinet(px, w, h, wood, [{ h: 2, n: 1, kind: 'open' }, { h: 3, n: 2, kind: 'door' }], { handle: STEEL_D, r: rr });
    px(3, 2, 4, 1, BLACK); px(w - 7, 2, 3, 1, 0x8f96a6);                // a box, a player, in the open shelf
  }) });
  const set = k.comp();
  set.box(6, 1, 3, BLACK, 0, 8, -1);
  const on = !!look.on;
  const screen = on
    ? tex(`tv-on-${v % 2}`, 16, 9, (px, w, h) => {
      px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x3b6296);
      if (v % 2) { px(1, 1, w - 2, 3, 0x95c1e3); px(1, 4, w - 2, 4, 0x76ad4c); px(9, 3, 3, 2, 0xf4efe6); }   // a match
      else { px(6, 2, 4, 3, 0xc48a62); px(6, 2, 4, 1, 0x47302a); px(5, 5, 6, 3, 0x283f6b); px(7, 5, 2, 2, PAPER); px(1, 6, w - 2, 2, 0x9e3c36); px(2, 6, 5, 1, PAPER); }   // the news
    }, { lit: true })
    : tex('tv-off', 16, 9, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x2a2e3a); for (let i = 0; i < 4; i++) px(3 + i, 1 + i, 1, 1, 0x4c5262); px(w - 1, 0, 1, h, 0x14151c); });
  set.box(16, 9, 1, { sides: BLACK, front: screen }, 0, 9, -1);
}

function bookshelf(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r);
  k.comp().box(W, 31, D, { sides: woodSide(wood, D, 31), top: woodTop(wood, W, D), front: tex(`bookshelf-${wood}-${v}`, W, 31, (px, w, h, rr) => {
    const back = tone(wood, -0.34);
    px(0, 0, w, h, back);
    const rows = 5, ch = 5;
    let y = 1;
    for (let i = 0; i < rows; i++) {
      px(1, y, w - 2, 1, tone(back, -0.06));
      stock(px, 1, y + ch, w - 2, ch, 'books', rr);
      px(0, y + ch, w, 1, tone(wood, 0.06));
      y += ch + 1;
    }
    px(0, 0, w, 1, tone(wood, 0.08)); px(0, y, w, h - y, wood); px(0, h - 1, w, 1, tone(wood, -0.2));
    px(0, 0, 1, h, tone(wood, 0.04)); px(w - 1, 0, 1, h, tone(wood, -0.1));
  }) });
}

function diningTable(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r), seat = seatTop(fabricOf(look.fabric, r, ['red', 'green', 'cream', 'mustard']));
  const TD = 14, t = k.comp();
  for (const [x, z] of [[-W / 2 + 1, -TD / 2 + 1], [W / 2 - 1, -TD / 2 + 1], [-W / 2 + 1, TD / 2 - 1], [W / 2 - 1, TD / 2 - 1]]) t.box(1, 11, 1, tone(wood, -0.1), x, 0, z);
  t.box(W - 2, 1, TD - 2, wood, 0, 10, 0);
  t.box(W, 1, TD, { sides: wood, top: tex(`diningtop-${wood}-${v % 2}`, W, TD, (px, w, h, rr) => {
    for (let y = 0; y < h; y += 4) grain(px, 0, y, w, Math.min(4, h - y), tone(wood, (y / 4) % 2 ? -0.02 : 0.01), rr);
    for (let y = 3; y < h; y += 4) px(0, y, w, 1, tone(wood, -0.08));
    px(0, h - 1, w, 1, tone(wood, 0.05));
    for (const [cx, cy] of [[w / 2 - 5.5, 3], [w / 2 + 5.5, 3], [w / 2 - 5.5, h - 3], [w / 2 + 5.5, h - 3]]) { oval(px, cx, cy, 2.2, 1.6, PAPER); px(Math.floor(cx), Math.floor(cy) - 0, 1, 1, tone(PAPER, -0.08)); }
    if (v % 2) { oval(px, w / 2, h / 2, 2, 1.5, 0x3b6296); px(w / 2 - 1, h / 2 - 1, 2, 1, 0xe7b84a); px(w / 2, h / 2, 1, 1, 0xc95c45); }   // a fruit bowl
    else { px(w / 2 - 1, h / 2 - 1, 2, 2, 0xb8bdc8); px(w / 2 - 1, h / 2 - 2, 2, 1, 0x356f42); px(w / 2, h / 2 - 3, 1, 1, 0xc95c45); }      // a vase, a flower
  }) }, 0, 11, 0);
  for (const [x, z, turned] of [[-5.5, -D / 2 + 3.5, false], [5.5, -D / 2 + 3.5, false], [-5.5, D / 2 - 3.5, true], [5.5, D / 2 - 3.5, true]]) woodChair(k.comp(), wood, seat, x, z, turned);
}
function chairKind(k, o) { const { look, r } = o; woodChair(k.comp(), woodOf(look.wood, r), seatTop(fabricOf(look.fabric, r, ['red', 'green', 'cream', 'mustard'])), 0, 0, false); }

function desk(k, o) {
  const { W, D, BK, look, r, v } = o, wood = woodOf(look.wood, r);
  const DD = 10, zc = BK + DD / 2, t = k.comp();
  t.box(1, 11, DD - 1, { sides: woodSide(wood, DD - 1, 11) }, -W / 2 + 0.5, 0, zc);
  t.box(6, 11, DD - 1, { sides: woodSide(wood, DD - 1, 11), front: tex(`deskped-${wood}`, 6, 11, (px, w, h, rr) => cabinet(px, w, h, wood, [{ h: 2, n: 1, kind: 'drawer' }, { h: 2, n: 1, kind: 'drawer' }, { h: 3, n: 1, kind: 'drawer' }], { handle: BRASS, r: rr })) }, W / 2 - 3, 0, zc);
  t.box(W - 8, 5, 1, wood, -3, 6, BK + 1.5);
  t.box(W, 1, DD, { sides: wood, top: tex(`desktop-${wood}-${v % 2}`, W, DD, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr); px(0, h - 1, w, 1, tone(wood, 0.05)); bevel(px, 0, 0, w, h, wood, 0.5);
    px(5, 3, 5, 4, PAPER); px(6, 4, 3, 1, 0x8f96a6); px(6, 5, 2, 1, 0x8f96a6); px(9, 2, 4, 4, tone(PAPER, -0.06)); px(10, 3, 2, 1, 0x8f96a6);   // papers
    px(13, 4, 3, 1, 0x283f6b); px(15, 4, 1, 1, BRASS);             // a pen
    if (v % 2) { px(w - 5, 2, 3, 4, 0x6e2a2e); px(w - 5, 2, 3, 1, 0x9e3c36); }   // a book
  }) }, 0, 11, zc);
  const lamp = k.comp();                                          // a banker's lamp: brass, a green shade
  lamp.box(3, 1, 2, BRASS, -6, 12, BK + 3);
  lamp.thin(1, 3, 1, BRASS, -6, 13, BK + 3);
  const on = !!look.on;
  lamp.box(5, 2, 2, { sides: on ? 0x76ad4c : 0x24503a, top: 0x356f42, front: on ? tex('banker-on', 5, 2, (px, w, h) => { px(0, 0, w, h, 0x4f8f45); px(0, h - 1, w, 1, 0xf8e08a); }, { lit: true }) : tex('banker', 5, 2, (px, w, h) => { px(0, 0, w, h, 0x24503a); px(0, 0, w, 1, 0x4f8f45); px(1, 0, 1, 1, 0xa6cc5e); }) }, -6, 16, BK + 3);
  if (on) o.light = { x: -6 / M, y: 16 / M, z: (BK + 3) / M };
  const ch = k.comp();
  woodChair(ch, wood, seatTop(fabricOf(look.fabric, r, ['green', 'red', 'cream'])), -2, BK + DD + 4, true);
}

/** A kitchen base unit: plinth, cupboard front, worktop; a tiled splashback against the wall. */
function kitchenBase(k, o, frontRows, topDraw, topKey) {
  const { W, D, BK, look, r } = o;
  const front = named(look.front, WOODS) ?? pick(r, [0xe2dac6, 0x4f8f45, 0xe6e2da, 0x3b6296, 0xb48459]);
  const top = named(look.top, WOODS) ?? pick(r, [0x8f6345, 0xa0978a, 0x4c5262, 0xd6ad7a]);
  const c = k.comp();
  c.box(W, 1, D - 2, tone(front, -0.35), 0, 0, -1);
  c.box(W, 12, D - 1, { sides: panel(front, D - 1, 12), front: tex(`kitchen-${front}-${frontRows}`, W, 12, (px, w, h) => cabinet(px, w, h, front, KROWS[frontRows], { handle: STEEL_D, plinth: 0 })) }, 0, 1, -0.5);
  c.box(W, 1, D, { sides: tone(top, -0.05), top: tex(`worktop-${top}-${topKey}`, W, D, (px, w, h, rr) => { worktop(px, w, h, top, rr); topDraw?.(px, w, h, rr); }) }, 0, 13, 0);
  k.comp().box(W, 8, 1, { sides: 0xdfe2e8, front: splash(W, 8) }, 0, 14, BK + 0.5);
  return { front, top };
}
const KROWS = {
  counter: [{ h: 2, n: 2, kind: 'drawer' }, { h: 7, n: 2, kind: 'door' }],
  sink: [{ h: 2, n: 1, kind: 'drawer' }, { h: 7, n: 2, kind: 'door' }],
  narrow: [{ h: 2, n: 1, kind: 'drawer' }, { h: 7, n: 1, kind: 'door' }],
};
function counterKind(k, o) {
  const { v } = o;
  kitchenBase(k, o, 'counter', (px, w, h) => {
    if (v % 4 === 1) { px(2, 2, 6, 5, 0xb48459); px(2, 2, 6, 1, 0xd6ad7a); px(7, 4, 1, 1, 0x6b4636); }   // a chopping board
  }, `counter${v % 4}`);
  const c = k.comp();
  if (v % 4 === 0) { c.box(2, 3, 2, { sides: 0xb8bdc8, top: 0x8f96a6 }, 5, 14, -1); c.box(1, 1, 1, PAPER, 2, 14, 1); }        // a kettle, a mug
  else if (v % 4 === 2) { c.box(4, 2, 2, { sides: 0x9e3c36, top: tex('toaster', 4, 2, (px) => { px(0, 0, 4, 2, 0x9e3c36); px(1, 0, 2, 1, BLACK); px(1, 1, 2, 1, BLACK); }) }, 4, 14, -1.5); }   // a toaster
  else if (v % 4 === 3) { c.round(4, 2, 3, 0.6, { sides: 0xe2dac6, top: tex('fruitbowl', 4, 3, (px) => { px(0, 0, 4, 3, 0xe2dac6); px(1, 1, 1, 1, 0xe7b84a); px(2, 1, 1, 1, 0xc95c45); px(2, 0, 1, 1, 0x76ad4c); }) }, -4, 14, 0); }
}
function sinkKind(k, o) {
  kitchenBase(k, o, 'sink', (px, w, h) => {
    const sx = 2, sy = 2, sw = 7, sh = 6;
    px(sx - 1, sy - 1, sw + 2, sh + 2, 0xdfe2e8);
    px(sx, sy, sw, sh, 0x8f96a6); px(sx, sy, sw, 2, 0x6a7182); px(sx + 3, sy + 3, 1, 1, BLACK);
    for (let x = sx + sw + 2; x < w - 1; x += 2) px(x, sy, 1, sh, 0xb8bdc8);   // the drainer's grooves
    px(sx + sw + 1, sy - 1, w - sx - sw - 2, sh + 2, 0xdfe2e8);
    for (let x = sx + sw + 2; x < w - 1; x += 2) px(x, sy, 1, sh, 0xb8bdc8);
  }, 'sink');
  const c = k.comp();
  c.box(1, 3, 1, CHROME, 5.5 - o.W / 2, 14, o.BK + 1.5);
  c.box(1, 1, 2, CHROME, 5.5 - o.W / 2, 16, o.BK + 2.5);
  if (o.v % 2) { c.box(3, 3, 1, { sides: 0xdfe2e8 }, o.W / 2 - 3, 14, -1); c.box(3, 2, 1, { sides: 0x95c1e3 }, o.W / 2 - 3, 14, 1); }   // plates in the rack
}
function cooker(k, o) {
  const { W, D, BK, look, r, v } = o;
  const body = named(look.front, { white: ENAMEL, steel: STEEL, black: BLACK }) ?? pick(r, [ENAMEL, STEEL, ENAMEL]);
  const c = k.comp();
  c.box(W, 14, D - 1, { sides: panel(body, D - 1, 14), top: tex(`hob-${body}`, W, D - 1, (px, w, h) => {
    px(0, 0, w, h, body); px(0, h - 1, w, 1, tone(body, 0.04));
    px(1, 1, w - 2, h - 2, 0x2a2e3a);
    for (const [x, y] of [[1, 1], [w - 5, 1], [1, h - 5], [w - 5, h - 5]]) { px(x + 1, y + 1, 3, 3, 0x4c5262); px(x + 2, y + 2, 1, 1, BLACK); }
  }), front: tex(`cooker-${body}`, W, 14, (px, w, h) => {
    px(0, 0, w, h, body); bevel(px, 0, 0, w, h, body);
    px(1, 1, w - 2, 2, tone(body, -0.06)); for (let x = 2; x < w - 1; x += 2) px(x, 1, 1, 1, BLACK);   // the knobs
    px(1, 4, w - 2, 7, tone(body, -0.03)); px(1, 4, w - 2, 1, CHROME);                               // the oven's door, its bar
    px(2, 6, w - 4, 4, 0x23252f); px(3, 7, 2, 1, 0x4c5262);
    px(1, h - 2, w - 2, 1, tone(body, -0.12));
  }) }, 0, 0, -0.5);
  k.comp().box(W, 8, 1, { sides: 0xdfe2e8, front: splash(W, 8) }, 0, 14, BK + 0.5);
  if (v % 2 === 0) k.comp().box(3, 2, 3, { sides: STEEL, top: tex('pot', 3, 3, (px) => { px(0, 0, 3, 3, STEEL); px(1, 1, 1, 1, 0x6a7182); }) }, -1.5, 14, -1.5);
  const hood = k.comp();                                          // the hood, up out of the way
  hood.box(W, 3, 6, { sides: STEEL, top: STEEL_D, front: tex('hood', W, 3, (px, w, h) => { px(0, 0, w, h, STEEL); px(0, h - 1, w, 1, STEEL_D); px(1, 1, w - 2, 1, CHROME); }) }, 0, 25, BK + 3);
  hood.box(4, 6, 3, { sides: STEEL_D, front: STEEL }, 0, 28, BK + 1.5);
}
function fridge(k, o) {
  const { W, D, look, r, v } = o;
  const body = named(look.front, { white: ENAMEL, steel: STEEL }) ?? pick(r, [ENAMEL, STEEL, ENAMEL]);
  k.comp().box(W, 29, D, { sides: panel(body, D, 29), top: tex(`fridgetop-${body}`, W, D, (px, w, h) => { px(0, 0, w, h, body); px(0, h - 1, w, 1, tone(body, 0.04)); }), front: tex(`fridge-${body}-${v}`, W, 29, (px, w, h, rr) => {
    px(0, 0, w, h, body); bevel(px, 0, 0, w, h, body);
    px(0, 18, w, 1, tone(body, -0.2));                             // fridge over freezer
    px(1, 3, 1, 6, STEEL_D); px(1, 20, 1, 4, STEEL_D);
    for (let i = 0; i < 4; i++) px(3 + Math.floor(rr() * 5), 3 + Math.floor(rr() * 10), 1, 1, pick(rr, [0x9e3c36, 0xe7b84a, 0x3b6296, 0x356f42]));   // magnets
    px(4, 6, 3, 4, PAPER); px(5, 7, 1, 1, 0x8f96a6); px(5, 8, 1, 1, 0x8f96a6);                                // a note
    px(1, h - 2, w - 2, 1, tone(body, -0.14));
  }) });
}
function kitchenShelf(k, o) {
  const { W, D, BK, look, r, v } = o, wood = woodOf(look.wood, r), Y = P(1.45);
  const c = k.comp();
  for (const x of [-W / 2 + 2, W / 2 - 2]) c.box(1, 2, D - 1, tone(wood, -0.2), x, Y - 2, BK + (D - 1) / 2);
  c.box(W, 1, D, { sides: wood, top: woodTop(wood, W, D) }, 0, Y, 0);
  const jars = k.comp();
  let x = -W / 2 + 2;
  for (const [cc, h] of [[0xe7b84a, 3], [0x6b4636, 3], [PAPER, 2], [0x9e3c36, 2]]) { jars.box(2, h, 2, { sides: tex(`jar-${cc}-${h}`, 2, h, (px, w, hh) => { px(0, 0, w, hh, cc); px(0, 0, w, 1, STEEL); px(1, 1, 1, hh - 1, tone(cc, -0.1)); }), top: STEEL }, x + 1, Y + 1, 0); x += 3; }
  const pl = k.comp();
  pl.box(2, 2, 2, 0xc95c45, W / 2 - 3, Y + 1, 0);
  pl.round(3, 2, 3, 0.6, { sides: leaves(), top: leaves() }, W / 2 - 3, Y + 3, 0);
  if (v % 2) jars.box(4, 1, 3, { sides: PAPER }, x + 2, Y + 1, 0);
}

function bathtub(k, o) {
  const { W, D, BK, look } = o;
  const water = !!look.water;
  k.comp().box(W, 9, D, { sides: panel(ENAMEL, D, 9), front: tex('tubfront', W, 9, (px, w, h) => { px(0, 0, w, h, ENAMEL); px(0, 0, w, 1, PAPER); px(1, 2, w - 2, h - 4, tone(ENAMEL, -0.03)); px(1, 2, w - 2, 1, tone(ENAMEL, -0.07)); px(0, h - 1, w, 1, tone(ENAMEL, -0.14)); }), top: tex(`tubtop-${water}`, W, D, (px, w, h) => {
    // From 45° up: the rim; inside, the far wall lit, the bottom in its own shade, the near rim's shadow on it.
    px(0, 0, w, h, PAPER);
    const x0 = 2, y0 = 2, iw = w - 4, ih = h - 4;
    px(x0, y0, iw, ih, 0xb8c6d2);
    px(x0, y0, iw, 3, 0xe6e8ec); px(x0, y0 + 3, iw, 1, 0xd4dae2);
    px(x0, y0 + ih - 1, iw, 1, 0x8f9fb0);
    px(x0, y0, 1, ih, 0xc8d2dc); px(x0 + iw - 1, y0, 1, ih, 0xa8b6c4);
    if (water) { px(x0 + 1, y0 + 3, iw - 2, ih - 4, 0x95c1e3); px(x0 + 4, y0 + 4, 5, 1, PAPER); px(x0 + 12, y0 + 5, 3, 1, PAPER); }
    px(x0 + 2, y0 + Math.floor(ih / 2) + 1, 1, 1, 0x4c5262);     // the drain
    px(0, h - 1, w, 1, tone(PAPER, -0.03)); px(0, 0, w, 1, tone(PAPER, -0.02));
  }) });
  const taps = k.comp();                                          // the taps at the head end, the shower on the wall
  taps.box(2, 2, 1, CHROME, -W / 2 + 1, 9, BK + 0.5);
  taps.box(1, 1, 2, CHROME, -W / 2 + 2, 10, BK + 1.5);
  taps.thin(1, 12, 1, CHROME, -W / 2 + 1, 11, BK + 0.5);
  taps.box(2, 1, 2, CHROME, -W / 2 + 1, 23, BK + 1);
}
function toilet(k, o) {
  const { BK } = o, c = k.comp();
  c.box(7, 7, 3, { sides: ENAMEL, top: tex('cistern', 7, 3, (px, w, h) => { px(0, 0, w, h, PAPER); px(3, 1, 1, 1, CHROME); }), front: tex('cisternfront', 7, 7, (px, w, h) => { px(0, 0, w, h, ENAMEL); px(0, 0, w, 1, PAPER); px(w - 1, 0, 1, h, tone(ENAMEL, -0.08)); }) }, 0, 6, BK + 1.5);
  c.box(4, 3, 5, ENAMEL, 0, 0, BK + 6);
  k.comp().round(6, 3, 8, 0.8, { sides: tex('bowlside', 8, 3, (px, w, h) => { px(0, 0, w, h, ENAMEL); px(0, 0, w, 1, PAPER); px(0, h - 1, w, 1, tone(ENAMEL, -0.1)); }), top: tex('seat', 6, 8, (px, w, h) => {
    px(0, 0, w, h, ENAMEL); oval(px, w / 2, h / 2 + 0.5, 3, 4, PAPER); oval(px, w / 2, h / 2 + 0.5, 1.8, 2.6, 0x95c1e3); oval(px, w / 2, h / 2, 1.2, 1.5, 0x5d8fc2);
  }), front: tex('bowlfront', 6, 3, (px, w, h) => { px(0, 0, w, h, ENAMEL); px(0, 0, w, 1, PAPER); px(0, h - 1, w, 1, tone(ENAMEL, -0.12)); }) }, 0, 3, BK + 7);
}
function washbasin(k, o) {
  const { W, D, BK } = o, c = k.comp();
  c.box(3, 10, 3, { sides: ENAMEL, front: tex('pedestal', 3, 10, (px, w, h) => { px(0, 0, w, h, ENAMEL); px(w - 1, 0, 1, h, tone(ENAMEL, -0.08)); }) }, 0, 0, BK + 2.5);
  k.comp().round(W, 3, D, 0.8, { sides: ENAMEL, top: tex('basintop', W, D, (px, w, h) => {
    px(0, 0, w, h, PAPER); oval(px, w / 2, h / 2 + 0.5, w / 2 - 1, h / 2 - 1, tone(ENAMEL, -0.06)); oval(px, w / 2, h / 2 + 1, w / 2 - 2, h / 2 - 2, tone(ENAMEL, -0.02)); px(Math.floor(w / 2), Math.floor(h / 2), 1, 1, 0x6a7182);
    px(0, h - 1, w, 1, tone(ENAMEL, 0.02));
  }), front: tex('basinfront', W, 3, (px, w, h) => { px(0, 0, w, h, ENAMEL); px(0, 0, w, 1, PAPER); px(0, h - 1, w, 1, tone(ENAMEL, -0.12)); }) }, 0, 10, 0);
  const t = k.comp();
  t.box(1, 2, 1, CHROME, 0, 13, BK + 0.5); t.box(1, 1, 2, CHROME, 0, 14, BK + 1.5);
  t.box(1, 2, 1, 0x5d8fc2, 3, 13, BK + 0.5);                       // a cup, a toothbrush
  const m = k.comp();
  m.box(8, 1, 2, { sides: 0xdfe2e8 }, 0, 16, BK + 1);
  m.box(8, 10, 1, { sides: 0xb8bdc8, front: mirrorTex(8, 10, 0xb8bdc8) }, 0, 17, BK + 0.5);
}
const mirrorTex = (w, h, frame) => tex(`mirror-${frame}`, w, h, (px, W, H) => {
  px(0, 0, W, H, frame); bevel(px, 0, 0, W, H, frame);
  px(1, 1, W - 2, H - 2, 0x8fa8b8);
  for (let y = 1; y < H - 1; y++) px(1, y, W - 2, 1, y > H * 0.55 ? 0x7d93a3 : 0x9dbbcc);   // (what it shows: a lighter room above, the floor below)
  for (let i = 0; i < Math.min(W, H) - 3; i++) { px(2 + i, H - 3 - i - 2, 1, 1, 0xdfe2e8); if (i < Math.min(W, H) - 5) px(4 + i, H - 3 - i - 2, 1, 1, 0xc8dde6); }
});
function radiator(k, o) {
  const { W, D } = o, c = k.comp();
  for (const x of [-W / 2 + 2, W / 2 - 2]) c.box(1, 2, 1, 0xdfe2e8, x, 0, 0);
  c.box(W, 8, D, { sides: 0xdfe2e8, top: tex('radtop', W, D, (px, w, h) => { for (let x = 0; x < w; x++) px(x, 0, 1, h, x % 2 ? 0xb8bdc8 : PAPER); }), front: tex('radiator', W, 8, (px, w, h) => {
    for (let x = 0; x < w; x++) px(x, 0, 1, h, x % 2 ? 0xc4c8d0 : 0xe6e8ec);
    px(0, 0, w, 1, PAPER); px(0, h - 1, w, 1, 0x8f96a6); px(w - 1, h - 3, 1, 2, 0x9e3c36);   // the valve
  }) }, 0, 2, 0);
}
function rug(k, o) {
  const { W, D, look, r } = o;
  const pattern = look.pattern ?? pick(r, ['persian', 'kilim', 'plain']);
  const [field, border] = look.colours ?? (pattern === 'persian' ? [pick(r, [0x9e3c36, 0x6e2a2e, 0x283f6b]), pick(r, [0x283f6b, 0x1b2541, 0x6e2a2e])] : [pick(r, [0xc4bba9, 0xb9862e, 0x7d756c, 0x8f96a6]), pick(r, [0x9e3c36, 0x283f6b, 0x47302a])]);
  const t = tex(`rug-${pattern}-${field}-${border}`, W, D, (px, w, h, rr) => {
    px(0, 0, w, h, border);
    for (let y = 0; y < h; y++) { px(0, y, 1, 1, y % 2 ? PAPER : SHEET); px(w - 1, y, 1, 1, y % 2 ? PAPER : SHEET); }   // the fringe at the ends
    px(2, 1, w - 4, h - 2, tone(border, 0.06)); px(3, 2, w - 6, h - 4, border);
    px(4, 3, w - 8, h - 6, field);
    if (pattern === 'persian') {
      for (let y = 3; y < h - 3; y++) for (let x = 4; x < w - 4; x++) if ((x + y) % 4 === 0 && noise(x / 2, y / 2, 4) > 0.5) px(x, y, 1, 1, tone(field, 0.08));
      const cx = w / 2, cy = h / 2;
      for (let j = -4; j <= 4; j++) for (let i = -7; i <= 7; i++) { const d = Math.abs(i) / 7 + Math.abs(j) / 4; if (d <= 1) px(Math.floor(cx + i), Math.floor(cy + j), 1, 1, d > 0.75 ? border : d > 0.45 ? 0xe7b84a : tone(field, -0.1)); }
      for (const [x, y] of [[5, 4], [w - 6, 4], [5, h - 5], [w - 6, h - 5]]) px(x, y, 1, 1, 0xe7b84a);
      for (let x = 4; x < w - 4; x += 2) { px(x, 2, 1, 1, 0xe2dac6); px(x, h - 3, 1, 1, 0xe2dac6); }
    } else if (pattern === 'kilim') {
      for (let x = 4; x < w - 4; x++) for (let y = 3; y < h - 3; y++) {
        const b = Math.floor((x - 4) / 6), dx = Math.abs(((x - 4) % 6) - 2.5), dy = Math.abs(y - h / 2);
        if (dx + dy * 0.6 < 3) px(x, y, 1, 1, b % 2 ? border : tone(field, -0.14));
      }
    } else for (let y = 5; y < h - 5; y += 2) px(5, y, w - 10, 1, tone(field, -0.03));
  });
  const geo = new THREE.PlaneGeometry(W / M, D / M);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, t);
  m.position.y = 0.006;
  m.receiveShadow = true;
  k.comp().add(m, 0, 0.1, 0);
}
function floorLamp(k, o) {
  const { look } = o, c = k.comp();
  c.box(4, 1, 4, BLACK, 0, 0, 0);
  c.thin(1, 19, 1, BRASS, 0, 1, 0);
  const on = !!look.on, cream = 0xe2dac6;
  const s = on
    ? tex('flshade-on', 6, 5, (px, w, h) => { px(0, 0, w, h, 0xf8e08a); px(0, h - 1, w, 1, PAPER); px(w - 1, 0, 1, h, 0xe7b84a); px(0, 0, w, 1, 0xe7b84a); }, { lit: true })
    : tex('flshade', 6, 5, (px, w, h) => { cloth(px, 0, 0, w, h, cream, 2); px(0, 0, w, 1, tone(cream, 0.04)); px(0, h - 1, w, 1, tone(cream, -0.1)); px(w - 1, 0, 1, h, tone(cream, -0.07)); px(2, 1, 1, h - 2, tone(cream, -0.04)); });
  const top = on ? tex('flshadetop-on', 6, 6, (px, w, h) => { px(0, 0, w, h, 0xe7b84a); px(1, 1, w - 2, h - 2, PAPER); }, { lit: true }) : tex('flshadetop', 6, 6, (px, w, h) => { px(0, 0, w, h, cream); px(1, 1, w - 2, h - 2, 0x8f6345); px(2, 2, 2, 2, 0x6b4636); });
  k.comp().box(6, 5, 6, { sides: s, top }, 0, 20, 0);
  if (on) o.light = { x: 0, y: 22 / M, z: 0 };
}
const leaves = (base = 0x356f42) => rep(`leaves-${base}`, 8, (px, w, h, r) => {
  px(0, 0, w, h, tone(base, -0.12));
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); px(x, y, 2, 1, base); px(x, y + 1, 1, 1, tone(base, -0.06)); }
  for (let i = 0; i < 6; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); px(x, y, 1, 1, tone(base, 0.1)); }
});
function plant(k, o) {
  const { look, r } = o, kind = look.kind ?? pick(r, ['ficus', 'snake']);
  const pot = named(look.pot, { terracotta: 0xc95c45, white: ENAMEL, blue: 0x3b6296, grey: 0x7d756c }) ?? pick(r, [0xc95c45, ENAMEL, 0x7d756c]);
  k.comp().box(5, 5, 5, { sides: tex(`pot-${pot}`, 5, 5, (px, w, h) => { px(0, 0, w, h, pot); px(0, 0, w, 1, tone(pot, 0.08)); px(0, 1, w, 1, tone(pot, -0.08)); px(w - 1, 1, 1, h - 1, tone(pot, -0.08)); }), top: tex(`potsoil-${pot}`, 5, 5, (px, w, h) => { px(0, 0, w, h, pot); px(1, 1, w - 2, h - 2, 0x47302a); px(2, 2, 1, 1, 0x2a1c18); }) });
  const g = k.comp();
  if (kind === 'snake') {
    for (const [x, z, h] of [[-1.5, 0, 10], [0, -1, 12], [1.5, 0.5, 9], [-0.5, 1.5, 8], [1, -1.5, 11]]) g.box(1, h, 1, { sides: tex(`blade-${h}`, 1, h, (px, w, hh) => { for (let y = 0; y < hh; y++) px(0, y, 1, 1, y % 3 ? 0x356f42 : 0x76ad4c); px(0, 0, 1, 1, 0xa6cc5e); }), top: 0xa6cc5e }, x, 5, z);
  } else {
    // A ficus: a stem, a crown of leaves wider than its pot, in clumps.
    g.box(1, 4, 1, 0x6b4636, 0, 5, 0);
    g.round(8, 5, 7, 1.5, { sides: leaves(), top: leaves(0x4f8f45) }, 0, 7, 0);
    g.round(6, 5, 6, 1.5, { sides: leaves(), top: leaves(0x4f8f45) }, -2, 10, -0.5);
    g.round(5, 5, 5, 1.4, { sides: leaves(0x4f8f45), top: leaves(0x76ad4c) }, 2, 11, 0.5);
    g.round(4, 3, 4, 1.2, { sides: leaves(0x4f8f45), top: leaves(0x76ad4c) }, -0.5, 15, -0.5);
  }
}
function phoneTable(k, o) {
  const { W, D, look, r } = o, wood = woodOf(look.wood, r, ['walnut', 'teak', 'oak']);
  const t = k.comp();
  for (const [x, z] of [[-W / 2 + 0.5, -D / 2 + 0.5], [W / 2 - 0.5, -D / 2 + 0.5], [-W / 2 + 0.5, D / 2 - 0.5], [W / 2 - 0.5, D / 2 - 0.5]]) t.box(1, 11, 1, tone(wood, -0.1), x, 0, z);
  t.box(W - 2, 1, D - 1, wood, 0, 3, 0);
  t.box(W - 1, 2, D - 1, { sides: wood, front: tex(`phonedrawer-${wood}`, W - 1, 2, (px, w, h) => { px(0, 0, w, h, wood); px(0, h - 1, w, 1, tone(wood, -0.1)); px(Math.floor(w / 2), 0, 1, 1, BRASS); }) }, 0, 9, 0);
  t.box(W, 1, D, { sides: wood, top: tex(`phonetop-${wood}`, W, D, (px, w, h, rr) => { grain(px, 0, 0, w, h, wood, rr); px(0, h - 1, w, 1, tone(wood, 0.06)); px(w - 2, 1, 2, 3, PAPER); px(w - 2, 2, 2, 1, 0x8f96a6); }) }, 0, 11, 0);
  // The directory on the shelf, yellow.
  k.comp().box(5, 1, 4, { sides: 0xe7b84a, top: tex('directory', 5, 4, (px, w, h) => { px(0, 0, w, h, 0xe7b84a); px(0, 1, w, 1, BLACK); px(w - 1, 0, 1, h, PAPER); }) }, -0.5, 4, 0);
  // The telephone, an old landline: a body with its dial in front, the handset lying across its
  // cradle (a bar with its ends turned down, in a colour against the body's), so it reads at a glance.
  const body = named(look.phone, { red: 0x9e3c36, black: BLACK, cream: 0xe2dac6, green: 0x24503a }) ?? 0x9e3c36;
  const hand = body === BLACK ? 0x9e3c36 : BLACK, dial = body === 0xe2dac6 ? BLACK : PAPER;
  const ph = k.comp();
  ph.box(5, 2, 4, { sides: tone(body, -0.06), top: tex(`phonebody-${body}`, 5, 4, (px, w, h) => { px(0, 0, w, h, body); px(1, 2, 3, 2, dial); px(2, 3, 1, 1, body); px(0, 0, w, 1, tone(body, -0.08)); }), front: tex(`phonefront-${body}`, 5, 2, (px, w, h) => { px(0, 0, w, h, body); px(0, h - 1, w, 1, tone(body, -0.14)); px(1, 0, 3, 1, tone(body, 0.06)); }) }, -1, 12, 0.5);
  ph.box(1, 1, 2, hand, -3.5, 14, -0.5); ph.box(1, 1, 2, hand, 1.5, 14, -0.5);
  ph.box(7, 1, 2, { sides: hand, top: tone(hand, 0.1) }, -1, 15, -0.5);
  o.phone = ph.group;
}
function coatRack(k, o) {
  const { look, r } = o, wood = woodOf(look.wood, r, ['walnut', 'dark', 'teak']);
  const [coat, hat] = look.colours ?? [pick(r, [0xd6ad7a, 0x4c5262, 0x283f6b, 0x6b4636, 0x24503a]), pick(r, [0x4c5262, 0x47302a, 0x23252f])];
  const c = k.comp();
  c.box(7, 1, 1, tone(wood, -0.1), 0, 0, 0); c.box(1, 1, 7, tone(wood, -0.1), 0, 0, 0);
  c.box(1, 27, 1, wood, 0, 1, 0);
  c.box(2, 1, 2, wood, 0, 28, 0);
  for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.box(1, 1, 1, BRASS, x, 26, z);
  k.comp().box(5, 12, 2, { sides: tone(coat, -0.06), top: coat, front: tex(`coat-${coat}`, 5, 12, (px, w, h) => {
    px(0, 0, w, h, coat); px(1, 0, 3, 2, tone(coat, -0.12)); px(2, 0, 1, 3, tone(coat, 0.06));
    px(2, 3, 1, h - 3, tone(coat, -0.1)); px(1, 4, 1, 1, tone(coat, -0.2)); px(1, 7, 1, 1, tone(coat, -0.2));
    px(0, 6, w, 1, tone(coat, -0.14)); px(w - 1, 0, 1, h, tone(coat, -0.08)); px(0, h - 1, w, 1, tone(coat, -0.14));
  }) }, 0, 14, 1.5);
  const ht = k.comp();
  ht.box(4, 1, 4, tone(hat, -0.04), 0, 29, 0);
  ht.box(3, 2, 3, { sides: tex(`hatband-${hat}`, 3, 2, (px, w, h) => { px(0, 0, w, h, hat); px(0, h - 1, w, 1, BLACK); }), top: tone(hat, 0.06) }, 0, 30, 0);
  k.comp().box(1, 13, 1, BLACK, 3, 0, -2);                           // an umbrella against it
  k.comp().box(2, 1, 1, BLACK, 2.5, 13, -2);
}
function shoeRack(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r);
  k.comp().box(W, 8, D, { sides: woodSide(wood, D, 8), top: tex(`shoetop-${wood}-${v % 2}`, W, D, (px, w, h, rr) => { grain(px, 0, 0, w, h, wood, rr); px(0, h - 1, w, 1, tone(wood, 0.05)); if (v % 2) { px(2, 1, 2, 2, BRASS); px(3, 2, 1, 1, STEEL); } px(w - 5, 1, 3, 2, 0x47302a); }), front: tex(`shoerack-${wood}-${v}`, W, 8, (px, w, h, rr) => {
    px(0, 0, w, h, tone(wood, -0.32));
    stock(px, 1, 4, w - 2, 3, 'shoes', rr); stock(px, 1, 7, w - 2, 3, 'shoes', rr);
    px(0, 0, w, 1, tone(wood, 0.06)); px(0, 4, w, 1, wood); px(0, 7, w, 1, tone(wood, -0.1));
    px(0, 0, 1, h, wood); px(w - 1, 0, 1, h, tone(wood, -0.1));
  }) });
}

// ---------- stairwell ----------

function stairs(k, o) {
  const { W, FR, look, r } = o;
  const tread = named(look.tread, { stone: 0xa0978a, wood: 0x8f6345, terrazzo: 0xb8ae9c }) ?? pick(r, [0xa0978a, 0x8f6345, 0xb8ae9c]);
  const rail = named(look.rail, WOODS) ?? pick(r, [0x47302a, BLACK, 0x6b4636]);
  const runner = look.runner === false ? null : named(look.runner, FABRICS) ?? FABRICS.red;
  // Ten steps of 4 px (0.25 m) going, 3 px (0.19 m) rising, toward the back; each a solid block from
  // the floor, so nothing shows under them. The treads lit, the risers in shade, a runner up the
  // middle (look.runner: a colour, or false for bare stone), the nosings catching the light.
  const N = 10, T = 4, R = 3, s = k.comp(), rw = Math.round(W * 0.5), rx = Math.floor((W - rw) / 2);
  const top = tex(`tread-${tread}-${runner}`, W, T, (px, w, h, rr) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, tone(tread, noise(x / 2, y / 2, 13) < 0.3 ? 0.02 : 0.05));
    if (runner) { px(rx, 0, rw, h, runner); px(rx, 0, 1, h, 0xe7b84a); px(rx + rw - 1, 0, 1, h, 0xe7b84a); px(rx + 1, h - 1, rw - 2, 1, tone(runner, 0.08)); }
    px(0, h - 1, rx, 1, tone(tread, 0.12)); px(rx + rw, h - 1, w - rx - rw, 1, tone(tread, 0.12));   // the nosing
    if (!runner) for (let x = Math.floor(w / 2) - 3; x < w / 2 + 3; x++) if (rr() < 0.4) px(x, 1 + Math.floor(rr() * 2), 1, 1, tone(tread, -0.04));   // worn in the middle
  });
  for (let i = 0; i < N; i++) {
    const h = R * (i + 1);
    s.box(W, h, T, { sides: tone(tread, -0.12), top, front: tex(`riser-${tread}-${runner}-${h}`, W, h, (px, w, hh) => {
      px(0, 0, w, hh, tone(tread, -0.22));
      px(0, 0, w, R, tone(tread, -0.12)); px(0, R - 1, w, 1, tone(tread, -0.2));
      if (runner) { px(rx, 0, rw, R, tone(runner, -0.1)); px(rx, 0, 1, R, 0xb9862e); px(rx + rw - 1, 0, 1, R, 0xb9862e); }
    }) }, 0, 0, FR - T * i - T / 2);
  }
  // The banisters: a post a step, a rail along the pitch.
  const b = k.comp(), H = 14;
  for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) {
    for (let i = 0; i < N; i++) b.thin(1, H, 1, rail, x, R * (i + 1), FR - T * i - T / 2);
    b.box(1, H + 4, 1, rail, x, 0, FR - 0.5);
    b.beam([x, R + H, FR - T / 2], [x, R * N + H, FR - T * (N - 1) - T / 2], 1, tone(rail, 0.08));
  }
}
function mailboxes(k, o) {
  const { W, D, look, r } = o, Y = P(0.8);
  const metal = named(look.metal, { steel: 0x8f96a6, olive: 0x76805a, brass: 0xb9862e, green: 0x356f42 }) ?? pick(r, [0x8f96a6, 0x7d8a6a, 0xa0978a]);
  k.comp().box(W, 15, D, { sides: tone(metal, -0.08), top: tone(metal, 0.04), front: tex(`mailboxes-${metal}`, W, 15, (px, w, h, rr) => {
    px(0, 0, w, h, tone(metal, -0.22)); bevel(px, 0, 0, w, h, metal);
    const cols = 4, rows = 3, cw = Math.floor((w - 1) / cols), chh = Math.floor((h - 1) / rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = 1 + i * cw, y = 1 + j * chh;
      px(x, y, cw - 1, chh - 1, metal); bevel(px, x, y, cw - 1, chh - 1, metal);
      px(x + 1, y + 1, cw - 3, 1, INK);                            // the slot
      px(x + 1, y + 2, 2, 1, PAPER);                               // the name
      px(x + cw - 3, y + 3, 1, 1, BRASS);                          // the lock
      if (rr() < 0.18) px(x + 1, y, cw - 3, 1, pick(rr, [PAPER, 0xe7b84a, 0x95c1e3]));   // post sticking out
    }
  }) }, 0, Y, 0);
}
function liftDoor(k, o) {
  const { W, D } = o;
  k.comp().box(W, 37, D, { sides: STEEL_D, top: STEEL_D, front: tex('liftdoor', W, 37, (px, w, h, rr) => {
    px(0, 0, w, h, 0x8f96a6); bevel(px, 0, 0, w, h, 0x8f96a6);
    const dx = 2, dw = w - 4 - 3, dy = 5, dh = h - dy;
    for (let x = 0; x < dw; x++) for (let y = 0; y < dh; y++) px(dx + x, dy + y, 1, 1, (x * 7 + y * 3) % 11 === 0 ? 0xc4c8d0 : 0xb8bdc8);   // brushed steel
    px(dx, dy, dw, 1, 0x6a7182); px(dx + Math.floor(dw / 2), dy, 1, dh, 0x4c5262);
    px(dx + 1, dy + 2, 1, dh - 3, 0xdfe2e8); px(dx + Math.floor(dw / 2) + 1, dy + 2, 1, dh - 3, 0xdfe2e8);
    px(4, 1, w - 8, 3, 0x14151c); px(6, 2, 1, 1, 0xe7b84a); px(8, 2, 3, 1, 0xe7b84a);   // the floor it's at, lit
    px(w - 3, 14, 2, 5, 0x6a7182); px(w - 3, 15, 1, 1, 0xe7b84a); px(w - 3, 17, 1, 1, 0xdfe2e8);   // the call buttons
  }, { glows: [GLOWS[0]] }) });
}

// ---------- shops ----------

function shelving(k, o) {
  const { W, D, look, r, v } = o, goods = look.goods ?? pick(r, ['groceries', 'tins', 'bottles']);
  const side = named(look.colour, { white: 0xdfe2e8, grey: 0x6a7182, wood: 0x8f6345 }) ?? (goods === 'books' ? 0x6b4636 : goods === 'shoes' ? 0x8f6345 : 0x6a7182);
  const wooden = side === 0x6b4636 || side === 0x8f6345;
  k.comp().box(W, 32, D, { sides: tex(`shelfside-${side}`, D, 32, (px, w, h) => { px(0, 0, w, h, side); bevel(px, 0, 0, w, h, side); if (!wooden) for (let y = 2; y < h - 3; y += 2) px(1, y, 1, 1, tone(side, -0.15)); }), top: tex(`shelftop-${side}-${goods}`, W, D, (px, w, h) => { px(0, 0, w, h, side); px(0, h - 1, w, 1, tone(side, 0.06)); px(1, 1, w - 2, h - 3, tone(side, -0.04)); }), front: tex(`shelving-${goods}-${side}-${v}`, W, 32, (px, w, h, rr) => {
    shelfFront(px, w, h, goods, rr, { side, back: wooden ? tone(side, -0.36) : 0x3a3036, edge: wooden ? tone(side, 0.08) : 0xdfe2e8, kick: wooden ? tone(side, -0.1) : 0x4c5262, top: 2 });
    const band = wooden ? tone(side, 0.04) : pick(rr, [0x9e3c36, 0x3b6296, 0x356f42]);
    px(0, 0, w, 2, band); px(0, 1, w, 1, tone(band, -0.12));
  }) });
}
function gondola(k, o) {
  const { W, D, look, r, v } = o, goods = look.goods ?? pick(r, ['groceries', 'tins', 'bottles', 'boxes']);
  const front = tex(`gondola-${goods}-${v}`, W, 22, (px, w, h, rr) => shelfFront(px, w, h, goods, rr, { rows: 4 }));
  const back = tex(`gondola-${goods}-${(v + 1) % 4}`, W, 22, (px, w, h, rr) => shelfFront(px, w, h, goods, rr, { rows: 4 }));
  const end = tex(`gondolaend-${goods}`, D, 22, (px, w, h, rr) => {
    px(0, 0, w, h, 0x6a7182); bevel(px, 0, 0, w, h, 0x6a7182);
    px(1, 1, w - 2, 5, 0x9e3c36); px(2, 2, w - 4, 1, PAPER); px(2, 4, 4, 1, 0xf8e08a);   // an offer
    px(1, 7, w - 2, h - 10, 0x3a3036); stock(px, 1, 13, w - 2, 6, goods, rr); px(0, 13, w, 1, 0xdfe2e8); stock(px, 1, 19, w - 2, 6, goods, rr); px(0, 19, w, 1, 0xdfe2e8);
    px(0, h - 2, w, 2, 0x4c5262);
  });
  const top = tex(`gondolatop-${goods}-${v}`, W, D, (px, w, h, rr) => {
    px(0, 0, w, h, 0x6a7182);
    const half = Math.floor((h - 2) / 2);
    for (const [y0, hh] of [[0, half], [half + 2, h - half - 2]]) {
      px(0, y0, w, hh, 0x3a3036);
      for (let x = 1; x < w - 1;) { const c = pick(rr, goods === 'bottles' ? [0x24503a, 0x6b4636, 0x6e2a2e, 0xb8bdc8] : LABELS), ww = goods === 'tins' ? 2 : 2 + Math.floor(rr() * 2); px(x, y0 + 1, ww, hh - 2, c); if (goods === 'tins' || goods === 'bottles') for (let y = y0 + 1; y < y0 + hh - 1; y += 2) px(x, y, ww, 1, goods === 'tins' ? STEEL : tone(c, 0.1)); else px(x, y0 + 1, ww, 1, tone(c, 0.1)); x += ww + 1; }
    }
    px(0, half, w, 2, 0x8f96a6); px(0, half, w, 1, 0xb8bdc8);   // the spine
    px(0, h - 1, w, 1, 0xdfe2e8); px(0, 0, w, 1, 0xdfe2e8);
  });
  const c = k.comp();
  c.box(W, 2, D - 2, 0x4c5262, 0, 0, 0);
  c.box(W, 22, D, { sides: end, front, back, top }, 0, 2, 0);
}
function shopCounter(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r, ['teak', 'walnut', 'oak']);
  const c = k.comp();
  c.box(W, 15, D, { sides: woodSide(wood, D, 15), front: tex(`shopcounter-${wood}`, W, 15, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr, true); bevel(px, 0, 0, w, h, wood);
    for (let x = 2; x + 6 <= w - 1; x += 8) sunk(px, x, 3, 6, h - 6, tone(wood, -0.03));
    px(0, h - 2, w, 2, tone(wood, -0.3));
  }) }, 0, 0, 0);
  c.box(W, 1, D, { sides: tone(wood, 0.05), top: tex(`shopcountertop-${v % 2}`, W, D, (px, w, h, rr) => {
    worktop(px, w, h, 0xa0978a, rr); px(0, h - 1, w, 1, 0xc4bba9);
    px(2, 2, 6, 5, PAPER); px(2, 2, 6, 1, 0x9e3c36); px(3, 4, 4, 1, 0x8f96a6); px(3, 5, 3, 1, 0x8f96a6);   // the papers
    px(w - 12, 6, 2, 2, BLACK);                                   // the card reader's pad
    if (v % 2) for (let i = 0; i < 4; i++) px(10 + i, 2, 1, 2, pick(rr, LABELS));
  }) }, 0, 15, 0);
  const till = k.comp();
  till.box(6, 2, 5, { sides: BLACK, top: tex('tilltop', 6, 5, (px, w, h) => { px(0, 0, w, h, BLACK); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x += 1) px(x, y, 1, 1, (x + y) % 2 ? 0x6a7182 : 0xb8bdc8); px(w - 2, 1, 1, 1, 0x9e3c36); }), front: tex('tillfront', 6, 2, (px, w, h) => { px(0, 0, w, h, 0x353947); px(2, 1, 2, 1, STEEL_D); }) }, 7, 16, -0.5);
  till.box(1, 2, 1, BLACK, 7, 18, -2);
  till.box(4, 2, 1, { sides: BLACK, front: tex('tilldisplay', 4, 2, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 0, 2, 1, 0x76ad4c); }, { lit: true }), back: tex('tilldisplay', 4, 2, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 0, 2, 1, 0x76ad4c); }, { lit: true }) }, 7, 20, -2);
  k.comp().box(1, 1, 2, BLACK, 3, 16, 2);
  const sweets = k.comp();                                        // a stand of sweets by the till
  sweets.box(4, 3, 2, { sides: 0xdfe2e8, front: tex('sweets', 4, 3, (px, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, LABELS[(x * 3 + y * 5) % LABELS.length]); }) }, -9, 16, -1);
}
function checkout(k, o) {
  const { W, D, look, r } = o, stripe = named(look.colour, FABRICS) ?? pick(r, [0x9e3c36, 0x356f42, 0x3b6296, 0xe7b84a]);
  const c = k.comp();
  c.box(W, 13, D, { sides: panel(0xdfe2e8, D, 13), front: tex(`checkout-${stripe}`, W, 13, (px, w, h) => {
    px(0, 0, w, h, 0xdfe2e8); bevel(px, 0, 0, w, h, 0xdfe2e8);
    px(0, 2, w, 2, stripe); px(0, 3, w, 1, tone(stripe, -0.1));
    for (let x = 4; x < w - 4; x += 8) px(x, 6, 6, 4, tone(0xdfe2e8, -0.05));
    px(0, h - 2, w, 2, 0x4c5262);
  }), top: tex('checkouttop', W, D, (px, w, h) => {
    px(0, 0, w, h, 0xb8bdc8); px(0, h - 1, w, 1, 0xdfe2e8);
    px(w - 13, 2, 4, 3, 0x283f6b); px(w - 12, 3, 2, 1, 0xc95c45);  // the scanner's glass
    px(w - 8, h - 6, 7, 5, 0x8f96a6); px(w - 8, h - 6, 7, 1, 0xdfe2e8);   // where it's bagged
  }) });
  c.box(20, 1, 6, { sides: 0x4c5262, top: tex('belt', 20, 6, (px, w, h) => { px(0, 0, w, h, 0x23252f); for (let x = 1; x < w; x += 3) px(x, 1, 1, h - 2, 0x353947); px(0, 0, w, 1, STEEL); px(0, h - 1, w, 1, STEEL); }) }, -W / 2 + 10.5, 13, 2.5);
  const g = k.comp();
  g.box(1, 1, 5, 0x9e3c36, -2, 14, 2.5);                          // the divider
  g.box(2, 2, 2, 0xe7b84a, -9, 14, 2); g.box(3, 1, 2, 0x3b6296, -6, 14, 3); g.box(1, 3, 1, 0x356f42, -12, 14, 2);
  const till = k.comp();
  till.box(5, 2, 4, { sides: BLACK, top: tex('tilltop5', 5, 4, (px, w, h) => { px(0, 0, w, h, BLACK); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) px(x, y, 1, 1, (x + y) % 2 ? 0x6a7182 : 0xb8bdc8); }) }, W / 2 - 5, 13, -3.5);
  till.box(4, 2, 1, { sides: BLACK, front: tex('tilldisplay', 4, 2, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 0, 2, 1, 0x76ad4c); }, { lit: true }) }, W / 2 - 5, 16, -5);
  till.box(1, 1, 1, BLACK, W / 2 - 5, 15, -5);
  till.box(2, 1, 2, 0x353947, W / 2 - 11, 13, -1);
  const pole = k.comp();                                          // the lane's number on its pole
  pole.thin(1, 17, 1, STEEL_D, -W / 2 + 2, 13, -D / 2 + 1);
  pole.box(4, 4, 2, { sides: 0x283f6b, front: tex('lane', 4, 4, (px, w, h) => { px(0, 0, w, h, 0x283f6b); px(1, 0, 2, 1, PAPER); px(2, 1, 1, 1, PAPER); px(1, 2, 2, 1, PAPER); px(2, 3, 1, 1, PAPER); px(1, 3, 1, 1, PAPER); }, { lit: true }) }, -W / 2 + 2, 30, -D / 2 + 1);
}
function drinksFridge(k, o) {
  const { W, D, look, r, v } = o, brand = named(look.colour, FABRICS) ?? pick(r, [0x9e3c36, 0x3b6296, 0x356f42]);
  const c = k.comp();
  c.box(W, 29, D, { sides: panel(0xdfe2e8, D, 29), top: 0xb8bdc8, front: tex(`drinksfridge-${v}`, W, 29, (px, w, h, rr) => {
    px(0, 0, w, h, 0xb8bdc8);
    px(1, 1, w - 2, h - 3, 0xc8dde6);
    for (let y = 2; y < h - 3; y += 5) {
      for (let x = 2; x < w - 2; x += 2) { const cc = pick(rr, [0x9e3c36, 0x356f42, 0xe7b84a, 0x3b6296, 0xc95c45, 0x95c1e3, PAPER]); px(x, y + 1, 1, 3, cc); px(x, y, 1, 1, tone(cc, -0.1)); }
      px(1, y + 4, w - 2, 1, 0x8f96a6);
    }
    px(1, 1, w - 2, 1, PAPER);                                    // the light along its top
    px(w - 2, 8, 1, 8, 0x6a7182);                                 // the handle
    px(2, 3, 1, 4, 0xf4efe6); px(3, 2, 1, 2, 0xf4efe6);              // (the glass catching the light)
    px(0, h - 2, w, 2, 0x4c5262);
  }, { lit: true }) }, 0, 0, 0);
  c.box(W, 3, D, { sides: brand, top: 0xb8bdc8, front: tex(`fridgehead-${brand}`, W, 3, (px, w, h) => { px(0, 0, w, h, brand); px(1, 1, w - 2, 1, PAPER); px(3, 1, 2, 1, brand); px(0, h - 1, w, 1, tone(brand, -0.12)); }, { glows: [PAPER] }) }, 0, 29, 0);
}
function chestFreezer(k, o) {
  const { W, D, v } = o, c = k.comp();
  c.box(W, 14, D, { sides: panel(ENAMEL, D, 14), front: tex('freezer', W, 14, (px, w, h) => {
    px(0, 0, w, h, ENAMEL); bevel(px, 0, 0, w, h, ENAMEL);
    px(0, 2, w, 7, 0x3b6296); px(0, 2, w, 1, 0x5d8fc2);
    text(px, Math.floor((w - textWidth('ICE')) / 2), 3, 'ICE', PAPER);
    for (let x = 2; x < w - 2; x += 2) px(x, h - 3, 1, 1, 0x8f96a6);   // the vents
    px(0, h - 1, w, 1, 0x6a7182);
  }), top: tex(`freezertop-${v}`, W, D, (px, w, h, rr) => {
    px(0, 0, w, h, ENAMEL);
    for (const x0 of [1, Math.floor(w / 2)]) {
      const lw = Math.floor(w / 2) - 1;
      px(x0, 1, lw, h - 2, 0x95b8cc);
      for (let y = 2; y < h - 2; y += 3) for (let x = x0 + 1; x < x0 + lw - 1; x += 3) { const cc = pick(rr, [0x9e3c36, 0x356f42, 0xe7b84a, 0x3b6296, PAPER, 0x7a4a86]); px(x, y, 2, 2, tone(cc, 0.1)); }
      for (let i = 0; i < 4; i++) px(x0 + 2 + i, 1 + i, 1, 1, PAPER);
      px(x0, 1, lw, 1, 0xdfe2e8);
    }
    px(0, h - 1, w, 1, PAPER);
  }) });
}
function baskets(k, o) {
  const { W, D } = o, red = 0x9e3c36;
  const mesh = (w, h) => tex(`basketmesh-${w}-${h}`, w, h, (px, W2, H2) => { px(0, 0, W2, H2, tone(red, -0.1)); for (let y = 0; y < H2; y += 2) px(0, y, W2, 1, red); for (let y = 1; y < H2; y += 2) for (let x = 1; x < W2; x += 2) px(x, y, 1, 1, tone(red, -0.32)); px(0, 0, W2, 1, tone(red, 0.08)); });
  k.comp().box(W, 9, D, { sides: mesh(D, 9), front: mesh(W, 9), top: tex('baskettop', W, D, (px, w, h) => { px(0, 0, w, h, red); px(1, 1, w - 2, h - 2, tone(red, -0.3)); for (let y = 2; y < h - 1; y += 2) for (let x = 2; x < w - 1; x += 2) px(x, y, 1, 1, tone(red, -0.18)); px(1, 1, w - 2, 1, BLACK); px(1, h - 2, w - 2, 1, BLACK); }) });
}
// Cardboard: a darker tan than it shows (a front comes out lighter and warmer through the grade; this lands on a tan, not a peach).
const CARD = 0x9c7650;
const cardboard = (w, h, key, light = 0) => tex(`cardboard-${key}`, w, h, (px, W2, H2, r) => {
  const c = tone(CARD, light);
  px(0, 0, W2, H2, c);
  for (let i = 0; i < W2 * H2 / 10; i++) px(Math.floor(r() * W2), Math.floor(r() * H2), 1, 1, tone(c, -0.03));
  px(Math.floor(W2 / 2) - 1, 0, 2, Math.min(3, H2), tone(c, 0.1));  // tape over the top edge
  px(1, H2 - 3, 3, 2, PAPER); px(1, H2 - 2, 3, 1, 0x8f96a6);          // a label
  if (W2 > 7) { px(W2 - 4, 2, 1, 2, INK); px(W2 - 5, 2, 3, 1, INK); }    // this way up
  bevel(px, 0, 0, W2, H2, c, 0.6);
});
const cardTop = (w, h, key, light = 0) => tex(`cardtop-${key}`, w, h, (px, W2, H2) => { const c = tone(CARD, light + 0.02); px(0, 0, W2, H2, c); px(0, Math.floor(H2 / 2), W2, 1, tone(c, -0.12)); px(Math.floor(W2 / 2) - 1, 0, 2, H2, tone(c, 0.1)); px(0, H2 - 1, W2, 1, tone(c, 0.05)); });
function crates(k, o) {
  const { W, D, v } = o;
  // Cartons stacked smaller on bigger, each set back so the one under shows its top: that's what makes a stack read.
  k.comp().box(11, 7, 10, { sides: cardboard(10, 7, 'a-side'), front: cardboard(11, 7, 'a'), top: cardTop(11, 10, 'a') }, -3.5, 0, 1);
  k.comp().box(8, 6, 7, { sides: cardboard(7, 6, 'b-side', 0.05), front: cardboard(8, 6, 'b', 0.05), top: cardTop(8, 7, 'b', 0.05) }, -5, 7, -0.5);
  if (v % 2 === 0) k.comp().box(5, 3, 4, { sides: cardboard(4, 3, 'c', -0.05), front: cardboard(5, 3, 'c', -0.05), top: cardTop(5, 4, 'c', -0.05) }, -5.5, 13, -1);
  const wood = 0xa0784a;
  k.comp().box(8, 7, 10, { sides: tex('crateside', 10, 7, (px, w, h) => { px(0, 0, w, h, tone(wood, -0.3)); for (let y = 0; y < h; y += 3) px(0, y, w, 2, wood); px(0, 0, 1, h, tone(wood, -0.1)); px(w - 1, 0, 1, h, tone(wood, -0.1)); }), front: tex('cratefront', 8, 7, (px, w, h) => { px(0, 0, w, h, tone(wood, -0.3)); for (let y = 0; y < h; y += 3) { px(0, y, w, 2, wood); px(0, y, w, 1, tone(wood, 0.06)); } px(0, 0, 1, h, tone(wood, -0.08)); px(w - 1, 0, 1, h, tone(wood, -0.12)); px(2, 3, 4, 1, 0x6b4636); }), top: tex('cratetop', 8, 10, (px, w, h) => { px(0, 0, w, h, tone(wood, -0.3)); for (let x = 0; x < w; x += 3) px(x, 0, 2, h, wood); px(0, 0, w, 1, tone(wood, 0.05)); px(0, h - 1, w, 1, tone(wood, 0.05)); }) }, 5.5, 0, 0);
  const blue = 0x3b6296;
  k.comp().box(7, 4, 9, { sides: tex('plasticcrate', 9, 4, (px, w, h) => { px(0, 0, w, h, blue); for (let x = 1; x < w - 1; x += 2) px(x, 1, 1, 2, tone(blue, -0.25)); px(0, 0, w, 1, tone(blue, 0.08)); }), top: tex('bottletops', 7, 9, (px, w, h) => { px(0, 0, w, h, tone(blue, -0.2)); for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) px(x, y, 1, 1, 0x6b4636); px(0, 0, w, 1, blue); px(0, h - 1, w, 1, blue); }) }, 5.5, 7, 0);
}
// Moving boxes, taped, two or three stacked smaller on bigger: a flat not yet unpacked.
function cartons(k, o) {
  const { v } = o;
  k.comp().box(11, 7, 10, { sides: cardboard(10, 7, 'm-side'), front: cardboard(11, 7, 'm'), top: cardTop(11, 10, 'm') }, 0, 0, 0.5);
  k.comp().box(8, 6, 7, { sides: cardboard(7, 6, 'n-side', 0.05), front: cardboard(8, 6, 'n', 0.05), top: cardTop(8, 7, 'n', 0.05) }, v % 2 ? -1 : 1, 7, -0.5);
  if (v % 3 === 0) k.comp().box(6, 4, 5, { sides: cardboard(5, 4, 'o', -0.05), front: cardboard(6, 4, 'o', -0.05), top: cardTop(6, 5, 'o', -0.05) }, 0, 13, -1);
}
function pallet(k, o) {
  const { W, D } = o, wood = 0xc4a27a;
  k.comp().box(W, 2, D, { sides: tex('palletside', D, 2, (px, w, h) => { px(0, 0, w, h, wood); px(1, 1, Math.floor(w / 2) - 2, 1, INK); px(Math.floor(w / 2) + 1, 1, Math.floor(w / 2) - 2, 1, INK); }), front: tex('pallet', W, 2, (px, w, h) => { px(0, 0, w, h, wood); px(0, 0, w, 1, tone(wood, 0.06)); px(2, 1, 6, 1, INK); px(w - 8, 1, 6, 1, INK); }) });
  const load = k.comp();
  load.box(W - 1, 18, D - 1, { sides: tex('wrapside', D - 1, 18, (px, w, h, r) => wrapped(px, w, h, r)), front: tex('wrapfront', W - 1, 18, (px, w, h, r) => wrapped(px, w, h, r)), top: tex('wraptop', W - 1, D - 1, (px, w, h) => { px(0, 0, w, h, CARD); for (let x = 0; x < w; x += 6) px(x, 0, 1, h, tone(CARD, -0.12)); px(0, Math.floor(h / 2), w, 1, tone(CARD, -0.12)); for (let i = 0; i < 5; i++) px(2 + i * 2, 1 + i, 2, 1, 0xe2dac6); px(0, h - 1, w, 1, tone(CARD, 0.06)); }) }, 0, 2, 0);
}
/** Boxes stacked and wrapped in film: a grid of cartons, tape, labels, the film's sheen across. */
function wrapped(px, w, h, r) {
  px(0, 0, w, h, tone(CARD, -0.14));
  for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? -3 : 0; x < w; x += 6) { px(x, y, 5, 5, CARD); px(x, y, 5, 1, tone(CARD, 0.06)); px(x + 2, y, 1, 5, tone(CARD, 0.08)); if (r() < 0.4) px(x + 3, y + 3, 2, 1, PAPER); }
  for (let i = 0; i < w + h; i += 7) for (let t = 0; t < 4; t++) px(i - t, t + (i % 5), 1, 1, 0xe2dac6);
  for (let x = 0; x < w; x++) if ((x * 3) % 7 < 2) px(x, Math.floor(h * 0.4) + (x % 3), 1, 1, 0xd6ccb8);
}
function clothesRail(k, o) {
  const { W, D, look, r, v } = o;
  const cols = look.colours ?? [0x283f6b, 0x9e3c36, 0x4c5262, 0xd6ad7a, 0x24503a, 0x6b4636, 0xe2dac6, 0x7a4a86];
  const c = k.comp();
  for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) { c.box(1, 1, D, STEEL_D, x, 0, 0); c.thin(1, 25, 1, CHROME, x, 1, 0); }
  c.thin(W, 1, 1, CHROME, 0, 25, 0);
  const g = k.comp(), rr = rng(o.seed * 7 + 3);
  for (let x = -W / 2 + 2, i = 0; x + 2 <= W / 2 - 1; x += 2, i++) {
    const col = cols[(i * 3 + v) % cols.length], long = rr() < 0.5, hh = long ? 15 : 10, dd = 7 - (i % 2);
    g.box(2, hh, dd, { sides: tone(col, -0.05), top: tone(col, 0.06), front: tex(`garment-${col}-${hh}`, 2, hh, (px, w, h) => { px(0, 0, w, h, col); px(1, 0, 1, h, tone(col, -0.12)); px(0, 0, w, 1, tone(col, 0.08)); px(0, h - 1, w, 1, tone(col, -0.16)); }) }, x + 1, 24 - hh, 0);
  }
}
function fittingRoom(k, o) {
  const { W, D, BK, FR, look, r } = o, curtain = fabricOf(look.curtain, r, ['red', 'grey', 'navy', 'green']);
  const wall = named(look.wood, WOODS) ?? 0xe2dac6;
  const s = k.comp();
  for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) s.box(1, 32, D, { sides: panel(wall, D, 32, 'fit'), top: wall, front: tone(wall, -0.05) }, x, 0, 0);
  s.box(W, 2, 1, { sides: wall, front: tex(`fitheader-${wall}`, W, 2, (px, w, h) => { px(0, 0, w, h, tone(wall, -0.04)); px(0, 0, w, 1, tone(wall, 0.04)); }) }, 0, 32, FR - 0.5);
  s.box(W - 2, 1, 1, CHROME, 0, 31, FR - 1.5);
  const inside = k.comp();
  inside.box(6, 12, 1, { sides: 0x8f6345, front: mirrorTex(6, 12, 0x8f6345) }, 0, 10, BK + 0.5);
  inside.box(3, 4, 3, { sides: 0x6b4636, top: 0x8f6345 }, 4, 0, -2);
  inside.box(1, 1, 2, BRASS, -5, 24, BK + 1); inside.box(3, 8, 1, 0x5d8fc2, -5, 16, BK + 1.5);   // a shirt on the hook
  const cw = W - 6;
  k.comp().box(cw, 29, 1, { sides: tone(curtain, -0.1), top: curtain, front: tex(`curtain-${curtain}-${cw}`, cw, 29, (px, w, h) => {
    for (let x = 0; x < w; x++) px(x, 0, 1, h, x % 3 === 0 ? tone(curtain, 0.07) : x % 3 === 2 ? tone(curtain, -0.1) : curtain);
    px(0, h - 1, w, 1, tone(curtain, -0.18)); for (let x = 0; x < w; x += 2) px(x, 0, 1, 1, CHROME);
  }) }, -W / 2 + 1 + cw / 2, 2, FR - 1.5);
}
function mirrorKind(k, o) {
  const { W, D, BK, look, r } = o, frame = woodOf(look.wood, r, ['walnut', 'dark', 'oak']);
  const c = k.comp();
  c.box(W, 1, D, tone(frame, -0.1), 0, 0, 0);
  c.box(W, 28, 1, { sides: frame, front: mirrorTex(W, 28, frame) }, 0, 1, BK + 1.5);
}

// The display counters' goods, seen from above (a tray w × h) and from the front (h rows), by kind.
function trayTop(px, w, h, goods, r) {
  const tray = { bread: 0x6b4636, pastries: PAPER, cakes: 0xdfe2e8, cheese: 0xdfe2e8, meat: PAPER }[goods] ?? PAPER;
  px(0, 0, w, h, tray); px(0, h - 1, w, 1, tone(tray, 0.05));
  const cy = (h - 1) / 2;
  for (let x = 1, i = 0; x < w - 3; i++) {
    if (goods === 'bread') {
      const c = pick(r, [0xb48459, 0xb9862e, 0x8f6345]);
      if (i % 3 === 2) { for (const y of [1, 3]) { px(x, y, 5, 1, 0xd6ad7a); px(x + 1, y, 1, 1, 0xb48459); px(x + 3, y, 1, 1, 0xb48459); } x += 6; continue; }   // baguettes
      oval(px, x + 2, cy + 0.5, 2.2, 1.9, c); px(x + 1, 1, 2, 1, tone(c, 0.12)); px(x + 2, 2, 1, 1, tone(c, -0.12));     // a boule, its cut
      x += 5;
    } else if (goods === 'pastries') {
      if (i % 3 === 0) { px(x, 1, 3, 2, 0xb9862e); px(x + 1, 1, 1, 1, 0xe7b84a); px(x, 3, 1, 1, 0x7a5a22); px(x + 2, 3, 1, 1, 0x7a5a22); }   // a croissant
      else if (i % 3 === 1) { px(x, 1, 3, 3, 0xd6ad7a); px(x, 2, 3, 1, 0x47302a); px(x, 1, 3, 1, 0xe2c08a); }                            // pain au chocolat
      else { oval(px, x + 1.5, 2, 1.6, 1.6, 0xd6ad7a); px(x + 1, 1, 1, 2, pick(r, [0x9e3c36, 0xe7b84a, 0x7a4a86])); px(x + 2, 2, 1, 1, pick(r, [0x9e3c36, 0x4f8f45])); }   // a tart
      x += 4;
    } else if (goods === 'cakes') {
      const c = [0x47302a, 0xe8896a, 0xf8e08a, 0xf4efe6, 0x9e3c36][i % 5];
      oval(px, x + 2.5, cy + 0.5, 2.9, 2.2, PAPER);              // the board
      oval(px, x + 2.5, cy + 0.5, 2.3, 1.7, c);
      px(x + 1, 1, 2, 1, tone(c, 0.12));
      if (i % 2) { px(x + 3, 2, 2, 2, 0xd6ad7a); px(x + 3, 2, 2, 1, PAPER); }   // a slice gone: the sponge, its cream
      else for (const [dx, dy] of [[1, 2], [3, 1], [2, 3]]) px(x + dx, dy, 1, 1, c === 0x9e3c36 ? PAPER : 0x9e3c36);
      x += 6;
    } else if (goods === 'cheese') {
      const c = [0xe7b84a, 0xf8e08a, 0xe2dac6, 0xd6ad7a][i % 4];
      if (i % 3 === 2) { for (let j = 0; j < 3; j++) px(x, 1 + j, 3 - j, 1, c); px(x, 1, 1, 3, tone(c, -0.14)); x += 4; continue; }   // a wedge
      oval(px, x + 2, cy + 0.5, 2.2, 1.9, tone(c, -0.16)); oval(px, x + 2, cy + 0.5, 1.5, 1.2, c);
      if (c === 0xe2dac6) { px(x + 1, 2, 1, 1, 0x3b6296); px(x + 3, 3, 1, 1, 0x3b6296); }   // a blue
      x += 5;
    } else {                                                      // meat
      if (i % 3 === 2) { oval(px, x + 2, cy + 0.5, 2, 1.8, 0x8c5a3f); oval(px, x + 2, cy + 0.5, 1, 0.8, PAPER); px(x + 2, 2, 1, 1, 0x8c5a3f); }   // a coil of sausage
      else { px(x, 1, 4, 3, i % 2 ? 0x9e3c36 : 0xc95c45); px(x + 1, 2, 2, 1, 0xe8896a); px(x, 1, 4, 1, tone(i % 2 ? 0x9e3c36 : 0xc95c45, 0.08)); }   // steaks, their fat
      px(x + 3, 0, 1, 1, 0x4f8f45);                              // parsley
      x += 5;
    }
  }
  for (let x = 3; x < w - 2; x += 7) px(x, h - 1, 2, 1, 0xf4efe6);   // the price cards
}
function displayCase(k, o) {
  const { W, D, BK, FR, look, r, v } = o, goods = look.goods ?? pick(r, ['bread', 'pastries', 'cakes']);
  const body = named(look.colour, WOODS) ?? (goods === 'meat' || goods === 'cheese' ? 0xdfe2e8 : pick(r, [0x6b4636, 0xe2dac6, 0x8f6345]));
  // The cabinet; the goods on two tiers stepped up toward the back, so both show over the front
  // glass; the glass, a pane in front and one over the top, the case's outline round it all.
  const c = k.comp(), T = 5;
  c.box(W, 11, D, { sides: panel(body, D, 11), front: tex(`casefront-${body}`, W, 11, (px, w, h) => {
    px(0, 0, w, h, body); bevel(px, 0, 0, w, h, body);
    px(0, 0, w, 1, STEEL); px(0, 1, w, 1, tone(body, -0.12));
    for (let x = 2; x + 5 <= w - 1; x += 6) sunk(px, x, 3, 5, h - 6, tone(body, -0.02));
    px(0, h - 2, w, 2, tone(body, -0.3));
  }), top: STEEL }, 0, 0, 0);
  c.box(W - 2, 1, T, { sides: STEEL, top: tex(`tier-${goods}-${v}`, W - 2, T, (px, w, h, rr) => trayTop(px, w, h, goods, rr)) }, 0, 11, FR - 1 - T / 2);
  c.box(W - 2, 4, T, { sides: STEEL, top: tex(`tier-${goods}-${(v + 1) % 4}`, W - 2, T, (px, w, h, rr) => trayTop(px, w, h, goods, rr)), front: tex(`tierfront-${goods}-${v}`, W - 2, 4, (px, w, h, rr) => trayFront(px, w, h, goods, rr)) }, 0, 11, FR - 1 - T - T / 2);
  c.glass(W, 8, 1, 0, 11, FR - 0.5);
  c.glass(W, 1, D - 2, 0, 19, FR - (D - 2) / 2);
}
function breadRack(k, o) {
  const { W, D, look, r, v } = o, wood = woodOf(look.wood, r, ['oak', 'teak', 'pine']);
  k.comp().box(W, 29, D, { sides: woodSide(wood, D, 29), top: tex(`breadracktop-${wood}`, W, D, (px, w, h, rr) => { grain(px, 0, 0, w, h, wood, rr); px(0, h - 1, w, 1, tone(wood, 0.05)); px(w - 7, 1, 6, h - 2, 0xb48459); for (let x = w - 6; x < w - 1; x += 1) px(x, 1, 1, 1, 0xe7b84a); }), front: tex(`breadrack-${wood}-${v}`, W, 29, (px, w, h, rr) => {
    px(0, 0, w, h, tone(wood, -0.34));
    const split = w - 7;
    for (let y = 2, i = 0; i < 4; y += 6, i++) { px(1, y, split - 1, 1, tone(wood, -0.42)); stock(px, 1, y + 5, split - 2, 5, 'bread', rr); px(0, y + 5, split, 1, wood); }
    px(split, 0, 1, h, wood);
    px(split + 1, 8, w - split - 2, h - 11, 0x6b4636);            // the baguettes' basket, wicker
    for (let x = split + 1; x < w - 1; x++) for (let y = 9; y < h - 3; y += 2) px(x, y + (x % 2), 1, 1, 0x8f6345);
    for (let x = split + 1; x < w - 1; x++) { const top = 1 + Math.floor(rr() * 4); px(x, top, 1, 10 - top, x % 2 ? 0xb9862e : 0xd6ad7a); px(x, top, 1, 1, 0xe7b84a); }
    px(0, 0, w, 1, tone(wood, 0.06)); px(0, h - 3, w, 3, wood); px(0, h - 1, w, 1, tone(wood, -0.2));
    px(0, 0, 1, h, tone(wood, 0.04)); px(w - 1, 0, 1, h, tone(wood, -0.1));
  }) });
}
function deckOven(k, o) {
  const { W, D } = o, c = k.comp();
  c.box(W, 4, D - 1, { sides: STEEL_D, front: tex('ovenstand', W, 4, (px, w, h) => { px(0, 0, w, h, 0x4c5262); px(1, 0, 1, h, STEEL_D); px(w - 2, 0, 1, h, STEEL_D); px(2, 1, w - 4, 2, 0x353947); }) }, 0, 0, -0.5);
  c.box(W, 24, D, { sides: panel(STEEL, D, 24), top: tex('oventop', W, D, (px, w, h) => { px(0, 0, w, h, STEEL_D); for (let x = 2; x < w - 2; x += 3) px(x, 2, 1, h - 4, 0x6a7182); px(0, h - 1, w, 1, STEEL); }), front: tex('deckoven', W, 24, (px, w, h) => {
    px(0, 0, w, h, STEEL); bevel(px, 0, 0, w, h, STEEL);
    const cw = w - 7;
    for (let i = 0; i < 3; i++) {
      const y = 1 + i * 8;
      px(1, y, cw, 7, 0xc4c8d0); bevel(px, 1, y, cw, 7, 0xc4c8d0);
      px(2, y + 1, cw - 2, 1, CHROME);                             // the handle
      px(3, y + 3, cw - 4, 3, 0x353947); px(3, y + 5, cw - 4, 1, GLOWS[0]); px(4, y + 4, cw - 6, 1, 0xc95c45);   // the fire through the glass
      for (let x = 5; x < cw - 2; x += 4) px(x, y + 4, 2, 1, 0x8f6345);   // loaves baking
    }
    px(w - 6, 1, 5, h - 2, 0x4c5262);
    for (let i = 0; i < 3; i++) { const y = 2 + i * 8; px(w - 5, y, 1, 1, PAPER); px(w - 3, y, 1, 1, PAPER); px(w - 5, y + 2, 3, 1, 0x76ad4c); px(w - 2, y + 4, 1, 1, 0x9e3c36); }
  }, { glows: [GLOWS[0]] }) }, 0, 4, 0);
  c.box(W, 2, D, { sides: STEEL_D, front: tex('ovenlip', W, 2, (px, w, h) => { px(0, 0, w, h, STEEL_D); px(0, 0, w, 1, STEEL); }) }, 0, 28, 0);
}
function workTable(k, o) {
  const { W, D, look, r, v } = o;
  const c = k.comp();
  for (const [x, z] of [[-W / 2 + 1, -D / 2 + 1], [W / 2 - 1, -D / 2 + 1], [-W / 2 + 1, D / 2 - 1], [W / 2 - 1, D / 2 - 1]]) c.box(1, 12, 1, STEEL_D, x, 0, z);
  c.box(W - 2, 1, D - 2, STEEL, 0, 2, 0);
  const wood = 0xb48459;
  c.box(W, 2, D, { sides: tex('blockside', D, 2, (px, w, h) => { for (let x = 0; x < w; x++) px(x, 0, 1, h, x % 2 ? wood : tone(wood, -0.06)); }), front: tex('blockfront', W, 2, (px, w, h) => { for (let x = 0; x < w; x++) px(x, 0, 1, h, x % 3 ? wood : tone(wood, -0.08)); px(0, h - 1, w, 1, tone(wood, -0.12)); }), top: tex(`kneadtop-${v % 2}`, W, D, (px, w, h, rr) => {
    for (let y = 0; y < h; y++) px(0, y, w, 1, y % 2 ? wood : tone(wood, -0.04));
    for (let i = 0; i < 70; i++) { const x = 4 + Math.floor(rr() * (w - 8)), y = 1 + Math.floor(rr() * (h - 2)); px(x, y, 1, 1, rr() < 0.6 ? 0xf4efe6 : 0xe2dac6); }   // flour
    px(w - 10, 3, 8, 1, 0xd6ad7a); px(w - 11, 3, 1, 1, 0x8f6345); px(w - 2, 3, 1, 1, 0x8f6345);   // the rolling pin
    px(3, h - 4, 3, 2, 0xb8bdc8);                                  // a scraper
    px(0, h - 1, w, 1, tone(wood, 0.06));
  }) }, 0, 12, 0);
  const dough = k.comp();
  dough.round(4, 2, 3, 0.8, { sides: 0xe2dac6, top: 0xf4efe6 }, -5, 14, 0);
  if (v % 2) dough.round(3, 2, 3, 0.8, { sides: 0xe2dac6, top: 0xf4efe6 }, 1, 14, -1);
  for (const [x, cc] of [[-9, 0xe2dac6], [-1.5, 0xd6ccb8], [6, 0xe2dac6]]) k.comp().round(7, 7, 7, 1.2, { sides: tex(`sack-${cc}`, 7, 7, (px, w, h) => { px(0, 0, w, h, cc); px(0, 0, w, 1, tone(cc, -0.1)); px(1, 3, w - 2, 2, 0x9e3c36); px(3, 3, 1, 2, 0xe7b84a); px(w - 1, 0, 1, h, tone(cc, -0.08)); }), top: tex(`sacktop-${cc}`, 7, 7, (px, w, h) => { px(0, 0, w, h, cc); px(1, 3, w - 2, 1, tone(cc, -0.12)); }) }, x, 3, 0);
}
function cafeCounter(k, o) {
  const { W, D, look, r, v } = o;
  const tile = named(look.colour, FABRICS) ?? pick(r, [0x356f42, 0xe2dac6, 0x2f6b62, 0x3b6296]);
  const c = k.comp();
  c.box(W, 16, D, { sides: panel(tile, D, 16), front: tex(`cafefront-${tile}`, W, 16, (px, w, h) => {
    px(0, 0, w, h, tone(tile, -0.12));
    for (let y = 3; y < h - 2; y += 2) for (let x = (y / 2) % 2 ? -1 : 0; x < w; x += 3) px(x, y, 2, 1, (x * 3 + y) % 11 === 0 ? tone(tile, 0.08) : tile);   // metro tiles
    px(0, 0, w, 3, 0x6b4636); px(0, 0, w, 1, 0x8f6345); px(0, 2, w, 1, 0x47302a); px(0, h - 2, w, 2, 0x47302a);
  }) }, 0, 0, 0);
  c.box(W, 1, D, { sides: 0x6b4636, top: tex(`cafetop-${v % 2}`, W, D, (px, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, noise(x / 4, y / 2, 21) > 0.7 ? 0xdfe2e8 : 0xe6e2da); px(0, h - 1, w, 1, PAPER); px(w - 13, 3, 2, 2, 0x47302a); px(w - 12, 3, 1, 1, PAPER); px(3, 6, 2, 2, 0x47302a); px(4, 6, 1, 1, PAPER); }) }, 0, 16, 0);
  // The espresso machine, its back to the room: steel, a red band, its gauge, cups warming on top.
  const m = k.comp();
  m.box(10, 6, 7, { sides: tex('machineside', 7, 6, (px, w, h) => { px(0, 0, w, h, STEEL); px(0, 0, w, 1, CHROME); px(0, 2, w, 2, 0x9e3c36); px(0, h - 1, w, 1, STEEL_D); }), top: tex('machinetop', 10, 7, (px, w, h) => { px(0, 0, w, h, 0x4c5262); for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) { px(x, y, 1, 1, PAPER); } px(0, 0, w, 1, CHROME); px(0, h - 1, w, 1, CHROME); px(0, 0, 1, h, CHROME); px(w - 1, 0, 1, h, CHROME); }), front: tex('machine', 10, 6, (px, w, h) => {
    px(0, 0, w, h, STEEL); px(0, 0, w, 1, CHROME); px(0, 2, w, 2, 0x9e3c36); px(0, 2, w, 1, 0xc95c45);
    px(4, 1, 2, 2, PAPER); px(4, 1, 1, 1, 0x23252f);             // the gauge
    px(0, h - 1, w, 1, STEEL_D); px(w - 1, 0, 1, h, STEEL_D); px(1, 4, 1, 1, CHROME); px(w - 3, 4, 1, 1, CHROME);
  }) }, -8, 17, -1.5);
  const gr = k.comp();
  gr.box(3, 4, 3, { sides: BLACK, front: tex('grinder', 3, 4, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, 1, 1, CHROME); px(0, h - 1, w, 1, 0x353947); }) }, 0, 17, -2);
  gr.box(3, 3, 3, { sides: tex('hopper', 3, 3, (px, w, h) => { px(0, 0, w, h, 0x6b4636); px(0, 0, w, 1, 0xc8dde6); px(1, 1, 1, 1, 0x47302a); }), top: 0xc8dde6 }, 0, 21, -2);
  const cake = k.comp();
  cake.box(5, 1, 5, PAPER, 6, 17, 0);
  cake.round(4, 2, 4, 0.7, { sides: tex('cakeside', 4, 2, (px, w, h) => { px(0, 0, w, h, 0x47302a); px(0, 0, w, 1, PAPER); }), top: tex('caketop', 4, 4, (px, w, h) => { px(0, 0, w, h, PAPER); px(1, 1, 2, 2, 0x9e3c36); }) }, 6, 18, 0);
  cake.glass(5, 4, 5, 6, 18, 0);
  const cups = k.comp();
  cups.box(2, 3, 2, { sides: tex('cups', 2, 3, (px, w, h) => { px(0, 0, w, h, PAPER); px(0, 1, w, 1, 0xdfe2e8); px(1, 0, 1, h, tone(PAPER, -0.06)); }), top: 0x8f96a6 }, 11, 17, 1);
  cups.box(4, 2, 3, { sides: BLACK, top: tex('tilltop4', 4, 3, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, 2, 1, 0xb8bdc8); }) }, 14, 17, -2);
}
function bar(k, o) {
  const { W, D, FR, look, r } = o, wood = woodOf(look.wood, r, ['walnut', 'dark', 'teak']);
  const c = k.comp();
  c.box(W, 16, D - 1, { sides: woodSide(wood, D - 1, 16), front: tex(`barfront-${wood}`, W, 16, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr, true);
    for (let x = 1; x + 6 <= w - 1; x += 7) { bevel(px, x, 2, 6, h - 5, tone(wood, 0.02)); sunk(px, x + 1, 3, 4, h - 7, tone(wood, -0.05)); }
    px(0, 0, w, 1, tone(wood, -0.2)); px(0, h - 2, w, 2, tone(wood, -0.3));
  }) }, 0, 0, -0.5);
  c.box(W, 2, D, { sides: tone(wood, 0.04), front: tex(`barlip-${wood}`, W, 2, (px, w, h) => { px(0, 0, w, h, tone(wood, 0.04)); px(0, 0, w, 1, tone(wood, 0.12)); px(0, h - 1, w, 1, tone(wood, -0.1)); }), top: tex(`bartop-${wood}`, W, D, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, tone(wood, 0.04), rr); px(0, h - 1, w, 1, tone(wood, 0.14)); px(0, h - 2, w, 1, tone(wood, 0.08));
    for (let x = 3; x < w - 3; x += 9) { px(x, 4, 2, 2, PAPER); px(x, 4, 2, 1, 0x9e3c36); }   // beer mats
    px(14, 1, 7, 2, BLACK); for (let x = 15; x < 21; x += 2) px(x, 1, 1, 2, 0x353947);           // the drip mat
    for (let i = 0; i < 6; i++) px(4 + Math.floor(rr() * (w - 8)), 2 + Math.floor(rr() * 4), 3, 1, tone(wood, 0.16));   // the polish
  }) }, 0, 16, 0);
  c.box(W - 2, 1, 1, BRASS, 0, 2, FR - 0.5);                      // the foot rail
  for (let x = -W / 2 + 3; x < W / 2 - 2; x += 8) c.box(1, 2, 1, BRASS, x, 1, FR - 1);
  const taps = k.comp();
  taps.box(1, 3, 1, CHROME, 0, 18, -2);
  taps.box(7, 1, 2, CHROME, 0, 21, -2);
  for (const [x, cc] of [[-2, 0x9e3c36], [0, BLACK], [2, BRASS]]) taps.box(1, 2, 1, cc, x, 22, -2);
  const gl = k.comp();
  gl.box(1, 2, 1, { sides: 0xe7b84a, top: PAPER }, 7, 18, 1);
  gl.box(1, 2, 1, { sides: 0xc8dde6, top: 0xdfe2e8 }, -9, 18, 0);
  gl.box(1, 1, 1, { sides: 0x6e2a2e, top: 0x9e3c36 }, -13, 18, 1);
}
function barShelf(k, o) {
  const { W, D, BK, look, r, v } = o, wood = woodOf(look.wood, r, ['walnut', 'dark', 'teak']);
  k.comp().box(W, 14, D, { sides: woodSide(wood, D, 14), top: woodTop(wood, W, D), front: tex(`barlower-${wood}`, W, 14, (px, w, h, rr) => cabinet(px, w, h, wood, [{ h: 3, n: 4, kind: 'drawer' }, { h: 8, n: 4, kind: 'door' }], { handle: BRASS, r: rr, plinth: 1 })) });
  k.comp().box(W, 20, 3, { sides: woodSide(wood, 3, 20), top: tone(wood, 0.04), front: tex(`barback-${wood}-${v}`, W, 20, (px, w, h, rr) => {
    px(0, 0, w, h, 0x7d93a3);
    for (let y = 3; y < h; y++) for (let x = 2; x < w - 2; x++) if ((x + y * 2) % 13 === 0) px(x, y, 1, 1, 0x9dbbcc);   // the mirror
    for (const y of [9, 15, 20]) { stock(px, 2, y, w - 4, 5, 'bottles', rr); px(1, y, w - 2, 1, 0xc8dde6); }
    px(0, 0, w, 2, wood); px(0, 2, w, 1, GLOWS[1]);                // the cornice, the strip light under it
    px(0, 0, 2, h, wood); px(w - 2, 0, 2, h, tone(wood, -0.08)); px(Math.floor(w / 2), 3, 1, h - 3, wood);
  }, { glows: [GLOWS[1]] }) }, 0, 14, BK + 1.5);
}
function barStool(k, o) {
  const { look, r } = o, seat = fabricOf(look.fabric, r, ['red', 'brown', 'navy', 'green']);
  const c = k.comp();
  c.box(5, 1, 5, STEEL_D, 0, 0, 0);
  c.box(1, 10, 1, CHROME, 0, 1, 0);
  c.box(5, 1, 1, CHROME, 0, 4, 2); c.box(5, 1, 1, CHROME, 0, 4, -2); c.box(1, 1, 3, CHROME, 2, 4, 0); c.box(1, 1, 3, CHROME, -2, 4, 0);
  k.comp().round(6, 1.5, 6, 0.7, { sides: tone(seat, -0.08), top: tex(`stool-${seat}`, 6, 6, (px, w, h) => { px(0, 0, w, h, seat); px(1, 1, 2, 1, tone(seat, 0.12)); px(0, h - 1, w, 1, tone(seat, -0.1)); }) }, 0, 11, 0);
}
function restaurantTable(k, o) {
  const { W, D, look, r, v } = o;
  const cloth_ = look.cloth ?? pick(r, ['white', 'checks']);
  const red = 0x9e3c36, white = 0xf4efe6;
  const at = (x, y) => (cloth_ === 'checks' ? (((x >> 1) + (y >> 1)) % 2 ? red : white) : white);
  const c = k.comp();
  c.box(5, 1, 5, BLACK, 0, 0, 0); c.box(1, 6, 1, BLACK, 0, 1, 0);
  k.comp().box(W, 6, W, { sides: tex(`clothside-${cloth_}-${W}`, W, 6, (px, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, at(x, y));
    for (let x = 1; x < w; x += 3) px(x, 1, 1, h - 1, cloth_ === 'checks' ? tone(at(x, 2), -0.12) : 0xdfe2e8);   // its folds
    px(0, 0, w, 1, cloth_ === 'checks' ? tone(red, 0.06) : PAPER); px(0, h - 1, w, 1, cloth_ === 'checks' ? tone(red, -0.16) : 0xb8bdc8);
  }), top: tex(`clothtop-${cloth_}-${W}-${v % 2}`, W, W, (px, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, at(x, y));
    for (const cy of [2, h - 5]) {                               // two places laid: plate, knife and fork, a glass
      oval(px, w / 2, cy + 1.5, 2.4, 1.8, 0x8f96a6); oval(px, w / 2, cy + 1.5, 1.8, 1.2, PAPER);
      px(Math.floor(w / 2) - 4, cy, 1, 3, 0x4c5262); px(Math.floor(w / 2) + 3, cy, 1, 3, 0x4c5262);
      px(Math.floor(w / 2) + 4, cy < h / 2 ? cy + 3 : cy - 1, 1, 1, 0x5d8fc2);
    }
    if (v % 2) { px(Math.floor(w / 2) - 3, Math.floor(h / 2) - 1, 2, 2, 0x6e2a2e); px(Math.floor(w / 2) - 3, Math.floor(h / 2) - 1, 1, 1, 0x9e3c36); }   // the wine
    px(0, h - 1, w, 1, cloth_ === 'checks' ? tone(red, 0.06) : PAPER);
  }) }, 0, 6, 0);
  const cd = k.comp();
  cd.box(1, 2, 1, { sides: 0x9e3c36, top: 0x6e2a2e }, 0, 12, 0);
  cd.box(1, 1, 1, { sides: glow(0xf8e08a) }, 0, 14, 0);
  const wood = 0x6b4636, seat = seatTop(0x6e2a2e);
  woodChair(k.comp(), wood, seat, 0, -D / 2 + 3.5, false);
  woodChair(k.comp(), wood, seat, 0, D / 2 - 3.5, true);
}
function range(k, o) {
  const { W, D, BK, v } = o, c = k.comp();
  c.box(W, 14, D, { sides: panel(STEEL, D, 14), front: tex('range', W, 14, (px, w, h) => {
    px(0, 0, w, h, STEEL); bevel(px, 0, 0, w, h, STEEL);
    px(1, 1, w - 2, 2, STEEL_D); for (let x = 2; x < w - 1; x += 3) px(x, 1, 1, 1, BLACK);   // the knobs
    for (const x0 of [1, Math.floor(w / 2) + 1]) { const dw = Math.floor(w / 2) - 2; px(x0, 4, dw, 8, 0xc4c8d0); bevel(px, x0, 4, dw, 8, 0xc4c8d0); px(x0 + 1, 5, dw - 2, 1, CHROME); }
    px(0, h - 2, w, 2, 0x4c5262);
  }), top: tex('rangetop', W, D, (px, w, h) => {
    px(0, 0, w, h, STEEL_D); px(0, h - 1, w, 1, CHROME); px(0, h - 2, w, 1, STEEL);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { const x = 1 + i * 6, y = 1 + j * 5; px(x, y, 5, 5, 0x23252f); px(x + 2, y, 1, 5, 0x4c5262); px(x, y + 2, 5, 1, 0x4c5262); px(x + 2, y + 2, 1, 1, BLACK); }
  }) });
  c.box(W, 5, 2, { sides: STEEL, front: tex('rangeback', W, 5, (px, w, h) => { px(0, 0, w, h, STEEL); px(0, 0, w, 1, CHROME); px(0, h - 1, w, 1, STEEL_D); }) }, 0, 14, BK + 1);
  const pots = k.comp();
  pots.round(5, 5, 5, 0.8, { sides: tex('stockpot', 5, 5, (px, w, h) => { px(0, 0, w, h, STEEL); px(0, 0, w, 1, CHROME); px(0, 2, w, 1, STEEL_D); px(w - 1, 0, 1, h, STEEL_D); }), top: tex('stockpottop', 5, 5, (px, w, h) => { px(0, 0, w, h, STEEL); px(1, 1, w - 2, h - 2, 0x8c5a3f); px(2, 1, 1, 1, 0xc48a62); }) }, -5.5, 14, 0);
  pots.box(5, 1, 4, { sides: BLACK, top: tex('pan', 5, 4, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x353947); if (v % 2) { px(1, 1, 2, 1, 0xe7b84a); px(2, 2, 1, 1, PAPER); } }) }, 4.5, 14, 2);
  pots.box(1, 1, 3, BLACK, 4.5, 14, 5);
  const hood = k.comp();
  hood.box(W, 5, 10, { sides: STEEL, top: STEEL_D, front: tex('rangehood', W, 5, (px, w, h) => { px(0, 0, w, h, STEEL); px(0, 0, w, 1, CHROME); for (let x = 1; x < w - 1; x += 3) px(x, 1, 2, 3, 0x8f96a6); px(0, h - 1, w, 1, STEEL_D); }) }, 0, 30, BK + 5);
}
function steelSink(k, o) {
  const { W, D, BK } = o, c = k.comp();
  for (const [x, z] of [[-W / 2 + 1, -D / 2 + 1], [W / 2 - 1, -D / 2 + 1], [-W / 2 + 1, D / 2 - 1], [W / 2 - 1, D / 2 - 1]]) c.box(1, 12, 1, STEEL_D, x, 0, z);
  c.box(W - 2, 1, D - 2, STEEL, 0, 3, 0);
  c.box(8, 2, 6, { sides: STEEL_D, top: tex('trays', 8, 6, (px, w, h) => { px(0, 0, w, h, STEEL_D); px(0, 0, w, 1, STEEL); px(0, 3, w, 1, STEEL); }) }, -4, 4, 0);
  c.box(4, 4, 4, { sides: 0x3b6296, top: tex('bucket', 4, 4, (px, w, h) => { px(0, 0, w, h, 0x3b6296); px(1, 1, w - 2, h - 2, 0x283f6b); }) }, 5, 4, 0);
  c.box(W, 2, D, { sides: STEEL, front: tex('steelapron', W, 2, (px, w, h) => { px(0, 0, w, h, STEEL); px(0, 0, w, 1, CHROME); }), top: tex('steelsinktop', W, D, (px, w, h) => {
    px(0, 0, w, h, STEEL); px(0, h - 1, w, 1, CHROME);
    for (const x0 of [1, 9]) { px(x0, 2, 7, 7, 0x6a7182); px(x0, 2, 7, 2, 0x8f96a6); px(x0 + 3, 6, 1, 1, BLACK); }
    for (let x = 17; x < w - 1; x++) if (x % 2) px(x, 2, 1, 7, STEEL_D);
  }) }, 0, 12, 0);
  c.box(W, 3, 1, STEEL, 0, 14, BK + 0.5);
  const tap = k.comp();                                          // the pre-rinse: a column, its arm, the spray on its spring
  tap.thin(1, 11, 1, CHROME, -4.5, 14, BK + 1.5);
  tap.thin(5, 1, 1, CHROME, -2.5, 24, BK + 1.5);
  tap.thin(1, 5, 1, STEEL_D, -0.5, 19, BK + 1.5);
  tap.box(1, 2, 1, BLACK, -0.5, 17, BK + 1.5);
}
function flowerBuckets(k, o) {
  const { W, D, BK, FR, look, r, v } = o, wood = 0x6b4636;
  const cols = look.colours ?? FLOWERS;
  const c = k.comp();
  c.box(W, 3, D, { sides: woodSide(wood, D, 3, false), front: woodSide(wood, W, 3, false), top: woodTop(wood, W, D) });
  c.box(W, 4, 4, { sides: woodSide(wood, 4, 4, false), front: woodSide(wood, W, 4, false), top: woodTop(wood, W, 4) }, 0, 3, BK + 2);
  const zinc = tex('zinc', 4, 4, (px, w, h) => { px(0, 0, w, h, 0x8f96a6); px(0, 0, w, 1, 0xdfe2e8); px(0, 2, w, 1, 0xb8bdc8); px(w - 1, 1, 1, h - 1, 0x6a7182); });
  const rows = [[3, FR - 2.5], [7, BK + 2]];
  let i = v;
  for (const [y, z] of rows) for (const x of [-7, -2.5, 2, 6.5]) {
    const col = cols[i++ % cols.length];
    const b = k.comp();
    b.box(4, 4, 4, { sides: zinc, top: 0x283f6b }, x, y, z);
    b.round(5, 3, 5, 1, { sides: petals(col), top: petals(col) }, x, y + 4, z);
  }
}
const petals = (c) => rep(`petals-${c}`, 8, (px, w, h, r) => {
  px(0, 0, w, h, 0x356f42);
  for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2; x < w; x += 2) { px(x, y, 1, 1, c); if (r() < 0.5) px(x + 1, y, 1, 1, tone(c, -0.1)); }
  for (let i = 0; i < 6; i++) px(Math.floor(r() * w), Math.floor(r() * h), 1, 1, tone(c, 0.12));
  for (let i = 0; i < 5; i++) px(Math.floor(r() * w), Math.floor(r() * h), 1, 1, 0x4f8f45);
});
function bankCounter(k, o) {
  const { W, D, look, r } = o, wood = woodOf(look.wood, r, ['walnut', 'teak', 'dark']);
  const sign = look.sign ?? 'CHANGE';
  const c = k.comp();
  c.box(W, 16, D, { sides: woodSide(wood, D, 16), front: tex(`bankfront-${wood}`, W, 16, (px, w, h, rr) => {
    grain(px, 0, 0, w, h, wood, rr, true); bevel(px, 0, 0, w, h, wood);
    for (let x = 2; x + 6 <= w - 1; x += 7) { sunk(px, x, 2, 6, h - 5, tone(wood, -0.04)); px(x + 2, 5, 2, h - 11, tone(wood, 0.03)); }
    px(0, h - 2, w, 1, BRASS); px(0, h - 1, w, 1, tone(wood, -0.3));
  }) }, 0, 0, 0);
  c.box(W, 1, D, { sides: 0xc4bba9, top: tex('marble', W, D, (px, w, h, rr) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, 1, 1, noise(x / 3, y / 3, 31) > 0.68 ? 0xc4bba9 : 0xe2dac6);
    for (let i = 0; i < 3; i++) { let x = Math.floor(rr() * w), y = 0; while (y < h) { px(x, y, 1, 1, 0xa0978a); y++; x += rr() < 0.5 ? 1 : 0; } }
    for (const x of [Math.floor(w / 4) - 3, Math.floor(3 * w / 4) - 3]) { px(x, Math.floor(h / 2), 6, 2, 0x5c5650); px(x, Math.floor(h / 2), 6, 1, 0x47302a); }   // the deal trays, under the glass
    px(0, h - 1, w, 1, PAPER);
  }) }, 0, 16, 0);
  const fr = k.comp();
  for (const x of [-W / 2 + 0.5, -0.5, W / 2 - 0.5]) fr.thin(1, 13, 1, STEEL_D, x, 17, 0);
  for (const x of [-W / 4, W / 4]) fr.box(2, 2, 1, { sides: STEEL_D, front: tex('grille', 2, 2, (px) => { px(0, 0, 2, 2, 0x4c5262); px(0, 0, 1, 1, 0x8f96a6); px(1, 1, 1, 1, 0x8f96a6); }) }, x, 22, 0.5);
  fr.box(W, 7, 1, { sides: 0x1b2541, front: tex(`banksign-${sign}`, W, 7, (px, w, h) => {
    px(0, 0, w, h, 0x1b2541); px(0, 0, w, 1, BRASS); px(0, h - 1, w, 1, BRASS);
    const s = textWidth(sign) <= w - 2 ? sign : sign.slice(0, Math.floor((w - 2) / 4));
    text(px, Math.floor((w - textWidth(s)) / 2), 1, s, GLOWS[0]);
  }, { glows: [GLOWS[0]] }) }, 0, 31, 0);
  const gl = k.comp();
  for (const [x0, x1] of [[-W / 2 + 1, -1], [0, W / 2 - 1]]) gl.glass(x1 - x0, 13, 0.5, (x0 + x1) / 2, 17, 0);
}

// ---------- office and embassy ----------

function officeDesk(k, o) {
  const { W, D, BK, look, r, v } = o;
  const top = named(look.top, { grey: 0xc4c8d0, white: 0xe6e2da, wood: 0xb48459 }) ?? pick(r, [0xc4c8d0, 0xe6e2da, 0xb48459]);
  const leg = 0x6a7182, c = k.comp();
  c.box(1, 11, D - 1, { sides: panel(leg, D - 1, 11) }, -W / 2 + 0.5, 0, 0);
  c.box(1, 11, D - 1, { sides: panel(leg, D - 1, 11) }, W / 2 - 0.5, 0, 0);
  c.box(W - 2, 5, 1, leg, 0, 6, BK + 1.5);
  c.box(6, 10, D - 2, { sides: panel(0x8f96a6, D - 2, 10), front: tex('officeped', 6, 10, (px, w, h) => cabinet(px, w, h, 0x8f96a6, [{ h: 2, n: 1, kind: 'drawer' }, { h: 2, n: 1, kind: 'drawer' }, { h: 2, n: 1, kind: 'drawer' }], { handle: 0x353947 })) }, W / 2 - 4.5, 0, -0.5);
  c.box(W, 1, D, { sides: tone(top, -0.06), top: tex(`officetop-${top}-${v % 2}`, W, D, (px, w, h, rr) => {
    px(0, 0, w, h, top); px(0, h - 1, w, 1, tone(top, 0.05)); bevel(px, 0, 0, w, h, top, 0.4);
    px(w - 7, 2, 4, 3, PAPER); px(w - 6, 3, 2, 1, 0x8f96a6); px(w - 8, 4, 4, 3, tone(PAPER, -0.06));   // papers
    if (v % 2) { px(2, 2, 3, 4, 0xd6ad7a); px(2, 2, 3, 1, 0xb48459); }   // a folder
    px(w - 3, h - 4, 1, 1, PAPER); px(w - 3, h - 3, 1, 1, 0x47302a);
  }) }, 0, 11, 0);
  const pc = k.comp();
  pc.box(4, 1, 2, BLACK, -2, 12, BK + 3);
  pc.box(1, 2, 1, BLACK, -2, 13, BK + 3);
  const on = look.on !== false;
  pc.box(9, 6, 1, { sides: BLACK, back: tex('monitorback', 9, 6, (px, w, h) => { px(0, 0, w, h, 0x353947); px(3, 2, 3, 2, BLACK); }), front: on ? tex(`screen-${v % 2}`, 9, 6, (px, w, h) => {
    px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x3b6296);
    px(2, 1, 5, 4, PAPER); px(2, 1, 5, 1, 0x283f6b); px(3, 2, 3, 1, 0x8f96a6); px(3, 3, 2, 1, 0x8f96a6);
    px(1, h - 2, w - 2, 1, 0x283f6b);
  }, { lit: true }) : tex('screenoff', 9, 6, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x2a2e3a); px(2, 1, 1, 1, 0x4c5262); }) }, -2, 15, BK + 3);
  const kb = k.comp();
  kb.box(7, 1, 2, { sides: 0x353947, top: tex('keys', 7, 2, (px, w, h) => { for (let x = 0; x < w; x++) { px(x, 0, 1, 1, x % 2 ? 0xb8bdc8 : 0x8f96a6); px(x, 1, 1, 1, x % 2 ? 0x8f96a6 : 0xb8bdc8); } }) }, -2, 12, 2);
  kb.box(1, 1, 1, BLACK, 3, 12, 2);
  kb.box(1, 1, 1, PAPER, W / 2 - 3, 12, -2);                      // a mug
}
function officeChair(k, o) {
  const { look, r } = o, f = fabricOf(look.fabric, r, ['grey', 'navy', 'blue', 'grey']);
  const c = k.comp();
  c.box(9, 1, 1, BLACK, 0, 0, 0); c.box(1, 1, 9, BLACK, 0, 0, 0);
  c.box(1, 5, 1, CHROME, 0, 1, 0);
  c.box(1, 3, 1, BLACK, 0, 6, -3.5);
  for (const x of [-4.5, 4.5]) { c.box(1, 2, 1, BLACK, x, 8, 0); c.box(1, 1, 4, 0x353947, x, 10, 0); }
  k.comp().round(8, 2, 8, 0.8, { sides: tone(f, -0.1), top: tex(`officeseat-${f}`, 8, 8, (px, w, h) => { cloth(px, 0, 0, w, h, f, 3); px(1, h - 2, w - 2, 1, tone(f, 0.05)); px(0, 0, w, 1, tone(f, -0.1)); }) }, 0, 6, 0.5);
  k.comp().round(7, 8, 1.5, 0.6, { sides: tone(f, -0.12), front: tex(`officeback-${f}`, 7, 8, (px, w, h) => { cloth(px, 0, 0, w, h, f, 4); px(0, 0, w, 1, tone(f, 0.08)); px(w - 1, 0, 1, h, tone(f, -0.1)); for (let y = 2; y < h - 1; y += 2) px(1, y, w - 2, 1, tone(f, -0.05)); }), back: tex('officebackback', 7, 8, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x353947); }) }, 0, 8, -3.5);
}
function filingCabinet(k, o) {
  const { W, D, look, r, v } = o, metal = named(look.colour, { grey: 0x8f96a6, olive: 0x7d8a6a, beige: 0xc4bba9 }) ?? pick(r, [0x8f96a6, 0x7d8a6a, 0xc4bba9]);
  k.comp().box(W, 21, D, { sides: panel(metal, D, 21), top: tex(`filingtop-${metal}`, W, D, (px, w, h) => { px(0, 0, w, h, metal); px(0, h - 1, w, 1, tone(metal, 0.05)); }), front: tex(`filing-${metal}`, W, 21, (px, w, h) => {
    px(0, 0, w, h, tone(metal, -0.2)); bevel(px, 0, 0, w, h, metal);
    for (let i = 0; i < 4; i++) { const y = 1 + i * 5; px(1, y, w - 2, 4, metal); bevel(px, 1, y, w - 2, 4, metal); px(3, y + 1, 2, 1, PAPER); px(3, y + 2, 2, 1, 0x353947); }
    px(w - 2, 1, 1, 1, BRASS);
  }) });
  if (v % 2) k.comp().box(4, 1, 5, { sides: 0xd6ad7a, top: tex('folders', 4, 5, (px, w, h) => { px(0, 0, w, h, 0xd6ad7a); px(0, 2, w, 1, 0xb48459); px(1, 0, 2, 1, 0x9e3c36); }) }, 0, 21, 0);
}
function securityDesk(k, o) {
  const { W, D, BK, FR } = o;
  const navy = 0x1b2541, c = k.comp();
  c.box(W, 18, 2, { sides: navy, front: tex('securityfront', W, 18, (px, w, h) => {
    px(0, 0, w, h, navy); bevel(px, 0, 0, w, h, 0x283f6b);
    px(0, 1, w, 1, BRASS);
    const cx = w / 2, cy = 8;
    oval(px, cx, cy, 4, 4, BRASS); oval(px, cx, cy, 3, 3, 0x283f6b); oval(px, cx, cy, 2, 2, PAPER);   // the seal
    px(Math.floor(cx) - 1, cy - 1, 2, 2, 0x6b4636); px(Math.floor(cx) - 2, cy - 1, 1, 1, 0x6b4636); px(Math.floor(cx) + 1, cy - 1, 1, 1, 0x6b4636);
    px(0, h - 2, w, 2, 0x14151c);
  }) }, 0, 0, FR - 1);
  c.box(W, 1, 4, { sides: 0x283f6b, top: tex('ledge', W, 4, (px, w, h) => { px(0, 0, w, h, 0xc4bba9); px(0, h - 1, w, 1, 0xe2dac6); px(4, 0, 5, 3, PAPER); px(6, 0, 1, 3, 0x8f96a6); px(5, 1, 1, 1, 0x8f96a6); px(10, 1, 3, 1, 0x283f6b); }) }, 0, 18, FR - 2);
  for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) c.box(1, 18, D - 2, navy, x, 0, BK + (D - 2) / 2);
  c.box(W - 2, 1, D - 4, { sides: 0x353947, top: tex('securitywork', W - 2, D - 4, (px, w, h) => { px(0, 0, w, h, 0x4c5262); px(3, 2, 5, 4, PAPER); px(w - 9, 2, 6, 2, 0x8f96a6); }) }, 0, 11, BK + (D - 4) / 2);
  const mon = k.comp();
  for (const x of [-6, 6]) { mon.box(6, 5, 3, { sides: 0x353947, back: tex('cctvback', 6, 5, (px, w, h) => { px(0, 0, w, h, 0x353947); px(1, 1, w - 2, 1, 0x23252f); }), front: tex('cctv', 6, 5, (px, w, h) => { px(0, 0, w, h, BLACK); px(1, 1, w - 2, h - 2, 0x6a7182); px(1, 1, 2, 2, 0x8f96a6); px(3, 3, 2, 1, 0xb8bdc8); }, { lit: true }) }, x, 12, BK + 2.5); }
}
function metalDetector(k, o) {
  const { W, D } = o, body = 0xc4bba9, c = k.comp();
  const post = tex('detpost', 3, 32, (px, w, h) => { px(0, 0, w, h, body); px(w - 1, 0, 1, h, tone(body, -0.1)); for (let y = 3; y < 28; y += 3) px(1, y, 1, 1, y < 10 ? 0x76ad4c : y < 20 ? 0xe7b84a : 0x9e3c36); px(0, h - 2, w, 2, 0x5c5650); });
  for (const s of [-1, 1]) c.box(3, 32, D, { sides: tex('detside', D, 32, (px, w, h) => { px(0, 0, w, h, body); bevel(px, 0, 0, w, h, body); px(2, 10, w - 4, 3, 0x6a7182); px(0, h - 2, w, 2, 0x5c5650); }), front: post, back: post, top: tone(body, 0.04) }, s * (W / 2 - 1.5), 0, 0);
  c.box(W, 3, D, { sides: tone(body, -0.04), top: tone(body, 0.06), front: tex('dethead', W, 3, (px, w, h) => { px(0, 0, w, h, 0x6a7182); px(0, 0, w, 1, 0x8f96a6); px(2, 1, 4, 1, BLACK); px(3, 1, 1, 1, 0x76ad4c); px(w - 4, 1, 2, 1, 0xb8bdc8); }, { glows: [0x76ad4c] }) }, 0, 32, 0);
}
function xray(k, o) {
  const { W, D, BK } = o, body = 0xc4c8d0, c = k.comp();
  const rollers = tex('rollers', 12, D - 4, (px, w, h) => { px(0, 0, w, h, 0x4c5262); for (let x = 0; x < w; x += 2) px(x, 1, 1, h - 2, 0x8f96a6); px(0, 0, w, 1, STEEL); px(0, h - 1, w, 1, STEEL); });
  for (const s of [-1, 1]) {
    c.box(12, 1, D - 4, { sides: STEEL_D, top: rollers }, s * (W / 2 - 6), 11, 0);
    for (const x of [s * (W / 2 - 1), s * (W / 2 - 11)]) for (const z of [-(D - 4) / 2 + 0.5, (D - 4) / 2 - 0.5]) c.box(1, 11, 1, STEEL_D, x, 0, z);
  }
  const hw = W - 24;
  c.box(hw, 21, D, { sides: tex('xrayend', D, 21, (px, w, h) => { px(0, 0, w, h, body); bevel(px, 0, 0, w, h, body); px(2, 3, w - 4, 6, 0x14151c); for (let x = 3; x < w - 3; x += 2) px(x, 3, 1, 5, 0x353947); px(0, h - 2, w, 2, 0x4c5262); }), top: tex('xraytop', hw, D, (px, w, h) => { px(0, 0, w, h, body); for (let x = 3; x < w - 3; x += 2) px(x, 3, 1, h - 6, tone(body, -0.1)); px(0, h - 1, w, 1, tone(body, 0.05)); }), front: tex('xray', hw, 21, (px, w, h) => {
    px(0, 0, w, h, body); bevel(px, 0, 0, w, h, body);
    px(0, 3, w, 2, 0x283f6b);
    const tx = 3, ty = 8;                                          // the radiation warning
    for (let j = 0; j < 5; j++) px(tx + 2 - Math.floor(j / 2), ty + j, 1 + 2 * Math.floor(j / 2), 1, 0xe7b84a);
    px(tx + 2, ty + 2, 1, 2, INK);
    px(w - 7, 9, 5, 3, 0x4c5262); px(w - 6, 10, 1, 1, 0x76ad4c); px(w - 4, 10, 1, 1, 0x9e3c36);
    px(0, h - 2, w, 2, 0x4c5262);
  }) }, 0, 0, 0);
  const t = k.comp();
  t.box(6, 1, 5, { sides: 0x6a7182, top: tex('xraytray', 6, 5, (px, w, h) => { px(0, 0, w, h, 0x6a7182); px(1, 1, w - 2, h - 2, 0x8f96a6); }) }, -W / 2 + 6, 12, 0);
  t.round(4, 2, 3, 0.6, { sides: 0x47302a, top: tex('bag', 4, 3, (px, w, h) => { px(0, 0, w, h, 0x6b4636); px(1, 0, 2, 1, 0x2a1c18); }) }, -W / 2 + 6, 13, 0);
  const mon = k.comp();
  mon.thin(1, 8, 1, STEEL_D, W / 2 - 3, 12, BK + 1);
  mon.box(5, 4, 1, { sides: 0x353947 }, W / 2 - 3, 20, BK + 1);
}
function stanchions(k, o) {
  const { W, look, r } = o, rope = fabricOf(look.rope, r, ['red', 'navy']);
  const metal = named(look.metal, { brass: BRASS, chrome: CHROME }) ?? BRASS;
  const c = k.comp(), X = W / 2 - 2;
  for (const s of [-1, 1]) { c.box(4, 1, 4, tone(metal, -0.06), s * X, 0, 0); c.thin(1, 14, 1, metal, s * X, 1, 0); c.thin(2, 1, 2, tone(metal, 0.08), s * X, 15, 0); }
  const N = 8, Y0 = 13.5, SAG = 4;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const x = -X + (2 * X * i) / N, t = x / X, y = Y0 - SAG * (1 - t * t);
    if (prev) c.beam([prev[0], prev[1], 0], [x, y, 0], 1, rope, true);
    prev = [x, y];
  }
}
function flag(k, o) {
  const c = k.comp(), px0 = -2.5;                                // (the flag hangs out over the footprint's east edge, above head height)
  c.box(5, 1, 5, 0x6b4636, px0, 0, 0); c.box(3, 1, 3, BRASS, px0, 1, 0);
  c.thin(1, 36, 1, BRASS, px0, 2, 0);
  c.thin(2, 2, 2, 0xe7b84a, px0, 38, 0);
  c.thin(10, 1, 1, BRASS, px0 + 4.5, 36, 0);
  const us = (mirror) => tex(`usflag-${mirror}`, 9, 14, (px, w, h) => {
    for (let i = 0; i < 13; i++) px(0, i, w, 1, i % 2 ? PAPER : 0x9e3c36);
    const cw = 4, chh = 7, cx = mirror ? w - cw : 0;
    px(cx, 0, cw, chh, 0x283f6b);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) if ((x + y) % 2 === 0) px(cx + x, y, 1, 1, PAPER);
    for (let x = 2; x < w; x += 3) for (let y = 0; y < 13; y++) if (!(y < chh && x >= cx && x < cx + cw)) px(x, y, 1, 1, tone(y % 2 ? PAPER : 0x9e3c36, -0.08));   // the drape's folds
    px(0, h - 1, w, 1, 0xe7b84a);                                  // the fringe
    px(mirror ? 0 : w - 1, 0, 1, h - 1, 0xe7b84a);
  });
  k.comp().box(9, 14, 1, { sides: 0x9e3c36, front: us(false), back: us(true) }, px0 + 5, 22, 0);
}
function waitingChairs(k, o) {
  const { W, D, look, r } = o, f = fabricOf(look.fabric, r, ['blue', 'grey', 'navy', 'teal']);
  const c = k.comp();
  c.box(W - 2, 1, 1, BLACK, 0, 5, 0);
  for (const x of [-W / 2 + 4, W / 2 - 4]) { c.box(1, 5, 1, BLACK, x, 0, 0); c.box(1, 1, D - 2, BLACK, x, 0, 0); }
  for (let i = 0; i < 4; i++) {
    const x = -W / 2 + 4 + i * 8, s = k.comp();
    s.box(7, 1, 7, { sides: tone(f, -0.1), top: tex(`waitseat-${f}`, 7, 7, (px, w, h) => { px(0, 0, w, h, f); px(1, 1, w - 2, h - 3, tone(f, 0.04)); px(0, h - 1, w, 1, tone(f, -0.12)); }) }, x, 6, 0.5);
    s.box(7, 7, 1, { sides: tone(f, -0.1), front: tex(`waitback-${f}`, 7, 7, (px, w, h) => { px(0, 0, w, h, f); px(0, 0, w, 1, tone(f, 0.08)); px(1, 2, w - 2, 3, tone(f, 0.03)); px(w - 1, 0, 1, h, tone(f, -0.1)); }), back: tone(f, -0.14) }, x, 7, -2.5);
  }
}
function vaultDoor(k, o) {
  const { W, D, BK } = o, steel = 0x8f96a6, c = k.comp();
  const FD = 4, fz = BK + FD / 2, front = BK + FD;
  c.box(W, 37, FD, { sides: steel, top: tone(steel, 0.04), front: tex('vaultframe', W, 37, (px, w, h) => {
    px(0, 0, w, h, steel); bevel(px, 0, 0, w, h, steel);
    for (let x = 1; x < w - 1; x += 3) { px(x, 1, 1, 1, 0xdfe2e8); px(x, h - 2, 1, 1, 0x6a7182); }
    for (let y = 3; y < h - 2; y += 3) { px(1, y, 1, 1, 0xdfe2e8); px(w - 2, y, 1, 1, 0x6a7182); }
    oval(px, w / 2 - 1, h - 20, 11.5, 11.5, 0x353947);           // the opening round the door
    px(w - 5, 15, 3, 5, BLACK); for (let y = 16; y < 19; y++) px(w - 4, y, 1, 1, 0x8f96a6); px(w - 4, 15, 1, 1, 0x9e3c36);   // the keypad
  }) }, 0, 0, fz);
  const cap = tex('vaultface', 20, 20, (px, w, h) => {
    px(0, 0, w, h, 0x6a7182);
    oval(px, w / 2, h / 2, 10, 10, 0xb8bdc8); oval(px, w / 2, h / 2, 8.5, 8.5, 0x8f96a6); oval(px, w / 2, h / 2, 5, 5, 0xb8bdc8); oval(px, w / 2, h / 2, 3.5, 3.5, 0x8f96a6);
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; px(Math.floor(w / 2 + Math.cos(t) * 9.2), Math.floor(h / 2 + Math.sin(t) * 9.2), 1, 1, 0x4c5262); }   // the bolts round its rim
  });
  const geo = new THREE.CylinderGeometry(10 / M, 10 / M, 2 / M, 32);
  geo.rotateX(Math.PI / 2);
  const disc = new THREE.Mesh(geo, [mat(0x8f96a6), cap, cap]);
  disc.castShadow = disc.receiveShadow = true;
  const d = k.comp();
  d.add(disc, -1, 20, front + 1);
  d.box(2, 3, 2, 0x4c5262, -11, 11, front);
  d.box(2, 3, 2, 0x4c5262, -11, 25, front);
  const h = k.comp(), cy = 20, cz = front + 2.5;
  h.box(3, 3, 1, CHROME, -1, cy - 1.5, cz);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + Math.PI / 2, dx = Math.cos(a) * 6, dy = Math.sin(a) * 6;
    h.beam([-1 - dx, cy - dy, cz], [-1 + dx, cy + dy, cz], 1, 0xdfe2e8);
  }
}
function waterCooler(k, o) {
  const c = k.comp();
  c.box(6, 15, 6, { sides: panel(ENAMEL, 6, 15), top: PAPER, front: tex('cooler', 6, 15, (px, w, h) => {
    px(0, 0, w, h, ENAMEL); bevel(px, 0, 0, w, h, ENAMEL);
    px(1, 2, w - 2, 4, tone(ENAMEL, -0.1)); px(1, 2, w - 2, 1, tone(ENAMEL, -0.18)); px(1, 3, 1, 1, 0x3b6296); px(w - 2, 3, 1, 1, 0x9e3c36);
    px(1, 6, w - 2, 1, 0x8f96a6);
    px(0, h - 1, w, 1, tone(ENAMEL, -0.14));
  }) });
  k.comp().round(5, 6, 5, 0.8, { sides: tex('jug', 5, 6, (px, w, h) => { px(0, 0, w, h, 0x5d8fc2); px(0, 0, w, 1, 0x3b6296); px(1, 1, 1, h - 2, 0x95c1e3); px(w - 1, 0, 1, h, 0x3b6296); px(0, 2, w, 1, 0x95c1e3); }), top: tex('jugtop', 5, 5, (px, w, h) => { px(0, 0, w, h, 0x5d8fc2); px(1, 1, 3, 3, 0x95c1e3); px(2, 2, 1, 1, 0x3b6296); }) }, 0, 15, 0);
}

function trayFront(px, w, h, goods, r) {
  const tray = { bread: 0x6b4636, pastries: PAPER, cakes: 0xdfe2e8, cheese: 0xdfe2e8, meat: PAPER }[goods] ?? PAPER;
  px(0, 0, w, h, tone(tray, -0.12));
  const floor = h - 1;
  for (let x = 1, i = 0; x < w - 3; i++) {
    if (goods === 'bread') { const n = GOODS.bread(px, x, floor, h, r); x += n + 1; continue; }
    if (goods === 'pastries') { px(x, floor - 2, 3, 2, i % 2 ? 0xb9862e : 0xd6ad7a); px(x + 1, floor - 2, 1, 1, 0xe7b84a); x += 4; continue; }
    if (goods === 'cakes') { const c = [0x47302a, 0xe8896a, 0xf8e08a, 0xf4efe6, 0x9e3c36][(i + 2) % 5]; px(x, floor - 3, 5, 1, c); px(x, floor - 2, 5, 2, 0xd6ad7a); px(x, floor - 2, 5, 1, PAPER); px(x + 4, floor - 3, 1, 3, tone(0xd6ad7a, -0.1)); x += 6; continue; }
    if (goods === 'cheese') { const c = [0xe7b84a, 0xf8e08a, 0xd6ad7a][i % 3]; px(x, floor - 2, 5, 2, c); px(x, floor - 2, 5, 1, tone(c, 0.08)); px(x + 4, floor - 2, 1, 2, tone(c, -0.14)); if (i % 2) px(x + 1, floor - 3, 3, 1, tone(c, -0.06)); x += 6; continue; }
    px(x, floor - 2, 4, 2, i % 2 ? 0x9e3c36 : 0xc95c45); px(x + 1, floor - 2, 2, 1, 0xe8896a); x += 5;   // meat
  }
  px(0, h - 1, w, 1, tray);
}

const MAKERS = {
  bed: (k, o) => bedMaker(k, o, 2), singleBed: (k, o) => bedMaker(k, o, 1), bedsideTable, wardrobe, drawers,
  sofa: (k, o) => sofaMaker(k, o, 3), armchair: (k, o) => sofaMaker(k, o, 1, 3), coffeeTable, tv: tvMaker, bookshelf, diningTable,
  chair: chairKind, desk, counter: counterKind, sink: sinkKind, cooker, fridge, kitchenShelf, bathtub, toilet, washbasin, radiator,
  rug, floorLamp, plant, phoneTable, coatRack, shoeRack,
  stairs, mailboxes, liftDoor,
  shelving, gondola, shopCounter, checkout, drinksFridge, chestFreezer, baskets, crates, cartons, pallet, clothesRail, fittingRoom,
  mirror: mirrorKind, displayCase, breadRack, deckOven, workTable, cafeCounter, bar, barShelf, barStool, restaurantTable, range,
  steelSink, flowerBuckets, bankCounter,
  officeDesk, officeChair, filingCabinet, securityDesk, metalDetector, xray, stanchions, flag, waitingChairs, vaultDoor, waterCooler,
};

/**
 * A piece of furniture, `{ kind, x, z, face, look, seed }` (src/sim/interiors/furniture.js), as a
 * THREE.Group centred on (x, z) on the floor and turned to its face. userData: kind, light (a lamp
 * that's on), phone (a phone table's telephone).
 */
export function furniture({ kind, x = 0, z = 0, face = 'down', look = {}, seed = 1 }) {
  const spec = FURNITURE[kind], make = MAKERS[kind];
  if (!spec || !make) throw new Error(`furniture: no kind '${kind}'`);
  const W = P(spec.w), D = P(spec.d);
  const o = { W, D, BK: -D / 2, FR: D / 2, look, seed, v: ((seed % 4) + 4) % 4, r: rng(hash(kind) ^ (seed * 2654435761)), spec, light: null, phone: null };
  const k = kit();
  make(k, o);
  const g = k.done();
  g.position.set(Math.round(x * M) / M, 0, Math.round(z * M) / M);   // (on the pixel grid, as the camera is)
  g.rotation.y = TURN[face] ?? 0;
  g.userData.kind = kind;
  if (o.light) g.userData.light = o.light;
  if (o.phone) g.userData.phone = o.phone;
  return g;
}

/** Every kind furniture() draws. */
export const KINDS = Object.keys(MAKERS);
