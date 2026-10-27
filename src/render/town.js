// TRADECRAFT render: a street section, drawn from its data (src/sim/map/street.js) with the art's
// painters (src/art/pixeltown.js, townsprites.js), in the fine finish.
//
// buildSection(S, { month }) is a generator: it yields between its costly parts (the ground, each
// building, the furniture a few pieces at a time), so the view can spread a section over a few
// frames (sections arrive 70 m ahead of the camera, so there's time), and returns { group, fronts,
// heads, sprites, dispose }:
//   - fronts: each building's box and its front face, painted for day; its night face (some rooms
//     lit) is painted when dusk first needs it, one a frame (src/render/view.js), so a street doesn't
//     stall the frame it arrives in. Each building has its own moment (dusk) to switch, so the lights
//     come on along the street one house at a time.
//   - heads: the lamps' heads, lit as the lamps come on (their light is the view's: a few pools of
//     light kept on the lamps nearest the camera).
//   - sprites: cards drawn as pixel art (trees, a post box): not lit by the scene's lights but tinted
//     by the light where they stand (sim/light.js lightAt), like the people. A card standing in front
//     of the player can be seen through (userData.see.value = 1: every other pixel left out, a
//     checkerboard, as pixel art shows something behind), so a tree never hides who you're playing.
// Everything is drawn as its look says (the sim's S.look, a prop's `look`, a tree's `species`, a
// building's dress: sim/map/street.js): the street's pavements, kerbs, road and zebra, the lanes' and
// alleys' surfaces, each make of lamp, bench, bin, railing, hedge, post box and car, the park's
// pond, fountain, monument, kiosk or beds in their versions. The month (the clock's) sets the trees'
// leaves, the hedges' and the leaves fallen on the ground.
// Ground tiles repeat every 1, 3 or 3.75 m, which divides the section's 45 m, so sections join
// seamlessly; the street's own texture takes the section's offset in world pixels for the same reason.
// Past the map's edges, where its ways lead off, a few metres of what's beyond are drawn (the next
// street's pavement and road up a lane; the lane going on south), so a way out looks like one.
// Textures are shared by make and kept (pixeltown.js keep()); a section frees only its own.
import * as THREE from 'three';
import { ground, tile, mat, glow, box, roundedBox, paint, PX_PER_M } from '../art/pixelart.js';
import { street, building, facade, lamp, bench, bin, car, railing, awning, hangingSign, hedgeLeaves, keep } from '../art/pixeltown.js';
import { treeCard, propCard } from '../art/townsprites.js';
import { spritePerson, frame, card } from '../art/sprites.js';
import { Z } from '../sim/map/street.js';
import { stream, range } from '../sim/rng.js';

const tiles = new Map();
const T = (kind, m) => { const k = `${kind}${m}`; if (!tiles.has(k)) tiles.set(k, mat(0, tile(kind, m))); return tiles.get(k); };
const snap = (v) => Math.round(v * PX_PER_M) / PX_PER_M;
const LAMP_LIT = glow(0xf8e08a);

/** Let a card be seen through on demand: a checkerboard of its pixels left out while see.value is 1. */
function seeThrough(mesh) {
  const m = mesh.material, see = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSee = see;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uSee;\nvoid main() {\n  if (uSee > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;');
  };
  m.customProgramCacheKey = () => 'see-through';
  mesh.userData.see = see;
  return mesh;
}

// A facade's paint operations, run on the art's painter. Shops are lit at night only: by day their
// glass is glass, not the yellow that glows.
const run = (ops, night) => (f) => {
  for (const [op, ...args] of ops) {
    if (op === 'shopfront') f.shopfront(args[0], args[1], args[2], { ...args[3], lit: night });
    else f[op](...args);
  }
};

// The ground's tiles by make: a pavement kind (the street's, sim LOOKS.pave) as a repeating tile, and
// the lanes' and alleys' surfaces.
const PAVE_TILE = { slabs: ['slabs', 3.75], squares: ['squares', 1], granite: ['granite', 3], pavers: ['pavers', 1], asphalt: ['tarmac', 3] };
const paveT = (kind) => T(...(PAVE_TILE[kind] ?? PAVE_TILE.slabs));
const LANE_T = { asphalt: ['asphalt', 3], setts: ['cobble', 1], patched: ['patched', 6], slabs: ['roadslabs', 3], concrete: ['concrete', 3], dirt: ['dirt', 3] };
const laneT = (kind) => T(...(LANE_T[kind] ?? LANE_T.asphalt));

// The far road's scheme, from a stretch's: its own pavement and asphalt, the street's kerbs.
const farLooks = new WeakMap();
const far = (s) => { if (!farLooks.has(s)) farLooks.set(s, { paveN: s.farPave, paveS: s.farPave, kerb: s.kerb, road: s.farRoad, lanes: 'dashed' }); return farLooks.get(s); };
// The autumn on the ground, by month (the trees' own leaves are townsprites.js leafState()).
export const LEAF_LITTER = { 9: 0.15, 10: 0.8, 11: 0.55, 12: 0.1 };

const STONE = 0xa0978a;
// Bronze people (sprites.js specs): in a coat, a poet with his hair long (green with age), a soldier.
const BRONZE = { skin: 'dark', hair: { style: 'short', color: 0x47302a }, top: { kind: 'coat', color: 0x47302a, trim: 0x2a1c18 }, legs: 0x47302a, shoes: 0x2a1c18 };
const PATINA = { skin: 0x2f6b62, hair: { style: 'long', color: 0x2f6b62 }, beard: 0x2f6b62, top: { kind: 'coat', color: 0x2f6b62, trim: 0x173327 }, legs: 0x2f6b62, shoes: 0x173327 };
const SOLDIER = { skin: 'dark', hair: { style: 'short', color: 0x47302a }, hat: { kind: 'peaked', color: 0x47302a }, top: { kind: 'uniform', color: 0x47302a, trim: 0x2a1c18 }, legs: 0x47302a, shoes: 0x2a1c18 };
const KIOSKS = [['ПЕЧАТЬ', 0x24503a], ['КОФЕ', 0x6e2a2e], ['ЦВЕТЫ', 0x283f6b], ['МОРОЖЕНОЕ', 0x3b6296]];

/** A bust: a bronze person's head and shoulders (the top of their sprite), as a card. */
function bustCard(spec) {
  const rows = frame(spec, 'down', 'idle0').slice(0, 21);
  const cv = document.createElement('canvas');
  cv.width = rows[0].length; cv.height = rows.length;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => row.forEach((c, x) => { if (c !== null) { g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillRect(x, y, 1, 1); } }));
  for (let x = 0; x < cv.width; x++) {                           // cut square across the chest, as a bust is
    if (rows[20][x] !== null) { g.fillStyle = '#14151c'; g.fillRect(x, 20, 1, 1); }
  }
  return card(cv, { ox: 11 });
}

// A park's one thing to see, in its version (f.look): a pond (a stone or granite rim, a reedy bank, a
// low fence), a fountain (off for the winter: still water round its column, a dry basin with a vase,
// its sculpture boxed in planks, tiered bowls), a bronze on a plinth (a man in a coat, a poet green
// with age, a seated figure, a bust on a column, a soldier with flowers at his feet), a kiosk (its
// front to the south walk: plaster, a newsstand, a glass pavilion, a cabin), or two flower beds (clipped
// box, ornamental cabbages, spruce boughs over them for the winter, dead stalks).
export function feature(g, f, sprites) {
  const w = f.x1 - f.x0, d = f.z1 - f.z0, cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, look = f.look;
  const put = (m, x, z, y = 0) => { m.position.set(x, y, z); g.add(m); return m; };
  const rim = (t, sides, top) => { for (const [x, z, ww, dd] of [[cx, f.z0 + t / 2, w, t], [cx, f.z1 - t / 2, w, t], [f.x0 + t / 2, cz, t, d - 2 * t], [f.x1 - t / 2, cz, t, d - 2 * t]]) put(box(ww, 0.3, dd, { sides: mat(sides), top: mat(top) }), x, z); };
  if (f.kind === 'pond') {
    if (look === 'reeds') {                                      // a muddy bank, dry reeds at its ends
      g.add(ground(f.x0, f.z0, f.x1, f.z1, T('dirt', 3), 0.006));
      g.add(ground(f.x0 + 0.35, f.z0 + 0.3, f.x1 - 0.35, f.z1 - 0.3, T('water', 3), 0.01));
      const r = stream('reeds', f.seed);
      for (let k = 0; k < 7; k++) { const x = k < 4 ? f.x0 + 0.3 + range(r, 0, 1.2) : f.x1 - 0.3 - range(r, 0, 1.2), z = f.z0 + 0.2 + range(r, 0, d - 0.4); sprites.push(seeThrough(put(propCard('reeds', { seed: f.seed + k }), snap(x), snap(z)))); }
      return;
    }
    const granite = look === 'granite';
    rim(granite ? 0.45 : 0.3, granite ? 0x5c5650 : STONE, granite ? 0x7d756c : 0xc4bba9);
    g.add(ground(f.x0 + 0.3, f.z0 + 0.3, f.x1 - 0.3, f.z1 - 0.3, T('water', 3), 0.12));
    if (look === 'fenced') {                                     // a low fence of hoops on the rim
      for (const z of [f.z0 + 0.05, f.z1 - 0.05]) { const rl = railing(f.x0, f.x1, z, { kind: 'hoops' }); rl.position.y = 0.3; g.add(rl); }
      for (const x of [f.x0 + 0.05, f.x1 - 0.05]) { const pivot = new THREE.Group(); pivot.add(railing(0, d - 0.1, 0, { kind: 'hoops' })); pivot.rotation.y = -Math.PI / 2; pivot.position.set(x, 0.3, f.z0 + 0.05); g.add(pivot); }
    }
    return;
  }
  if (f.kind === 'fountain') {
    const dry = look === 'vase' || look === 'boxed';
    rim(0.3, STONE, 0xc4bba9);
    g.add(ground(f.x0 + 0.3, f.z0 + 0.3, f.x1 - 0.3, f.z1 - 0.3, dry ? T('dirt', 3) : T('water', 3), 0.12));
    if (look === 'boxed') {                                      // its sculpture boxed in planks for the winter
      put(box(1.3, 1.5, 1.3, { sides: keep('planks-grey', () => mat(0, tile('planks', 1))), top: mat(0x6b4636) }), cx, cz);
    } else if (look === 'vase') {
      put(box(0.6, 0.5, 0.6, { sides: mat(STONE), top: mat(0xc4bba9) }), cx, cz);
      put(roundedBox(0.9, 0.55, 0.9, 0.2, { sides: mat(0xc4bba9), top: mat(0x5c5650) }), cx, cz, 0.5);
    } else if (look === 'tiers') {                               // tiered bowls on a column
      put(box(0.5, 1.1, 0.5, { sides: mat(STONE) }), cx, cz);
      put(roundedBox(1.6, 0.18, 1.6, 0.08, { sides: mat(0xc4bba9), top: mat(0x7d756c) }), cx, cz, 0.7);
      put(box(0.3, 0.6, 0.3, { sides: mat(STONE) }), cx, cz, 0.88);
      put(roundedBox(0.8, 0.14, 0.8, 0.06, { sides: mat(0xc4bba9), top: mat(0x7d756c) }), cx, cz, 1.4);
    } else {                                                     // still water round its column (off for the winter)
      put(box(1.0, 0.6, 1.0, { sides: mat(STONE), top: mat(0xc4bba9) }), cx, cz);
      put(box(0.3, 0.9, 0.3, { sides: mat(0xc4bba9), top: mat(0xdfe2e8) }), cx, cz, 0.6);
    }
    return;
  }
  if (f.kind === 'monument') {
    const plinth = { poet: [0x6e2a2e, 0x9e3c36, 0x6e2a2e], soldier: [0x353947, 0x4c5262, 0x23252f], bust: [STONE, 0xc4bba9, 0x8f96a6] }[look] ?? [STONE, 0xc4bba9, 0x8f96a6];
    if (look === 'bust') {                                       // a bust on a tall column
      put(box(w, 0.4, d, { sides: mat(plinth[0]), top: mat(plinth[1]) }), cx, cz);
      put(box(0.8, 1.5, 0.8, { sides: mat(plinth[0]), top: mat(plinth[1]), front: mat(plinth[2]) }), cx, cz, 0.4);
      const b = put(bustCard(BRONZE), cx, cz + 0.42, 1.9);          // (on the column's front edge, or its top hides his shoulders)
      sprites.push(b);
      return;
    }
    put(box(w, 1.3, d, { sides: mat(plinth[0]), top: mat(plinth[1]), front: mat(plinth[2]) }), cx, cz);
    const man = spritePerson(look === 'poet' ? PATINA : look === 'soldier' ? SOLDIER : BRONZE);
    if (look === 'seated') {                                     // in a bronze armchair: its back over his shoulders, its arms
      put(box(1.0, 1.2, 0.25, { sides: mat(0x47302a), top: mat(0x6b4636) }), cx, cz - 0.4, 1.3);
      for (const sx of [-0.5, 0.5]) put(box(0.16, 0.55, 0.7, { sides: mat(0x47302a), top: mat(0x6b4636) }), cx + sx, cz - 0.05, 1.3);
      man.pose('sit');
    }
    man.root.position.set(cx, 1.3, cz);
    man.root.children[1].visible = false;                        // (no shadow blob up there)
    g.add(man.root);
    sprites.push(man.card);                                      // (tinted by the light where it stands, like the people)
    if (look === 'soldier') {                                    // carnations laid at his feet
      const fl = keep('carnations', () => mat(0, paint(16, 6, (px) => { for (let x = 0; x < 16; x += 2) { px(x, 2 + (x % 4 ? 1 : 0), 1, 3, 0x356f42); px(x, 1 + (x % 4 ? 1 : 0), 2, 1, 0x9e3c36); } })));
      put(box(1.0, 0.04, 0.35, { sides: mat(0x356f42), top: fl }), cx, f.z1 + 0.2);
    }
    return;
  }
  if (f.kind === 'kiosk') {
    const [sign, colour] = KIOSKS[f.seed % KIOSKS.length];
    const spec = { x0: f.x0, x1: f.x1, z: f.z1, h: 2.6, d: 2, wall: 'plaster', wallColor: colour, seed: f.seed, kit: 'none' };
    if (look === 'news') {                                       // a newsstand: glass all round, papers in it, a blue roof
      g.add(building({ ...spec, wallColor: 0x8f96a6, roofColor: 0x3b6296,
        draw: (fc) => { fc.shopfront(0.1, 2.8, 2.0, { frame: 0x6a7182, goods: [0xf6f4ee, 0xe2dac6, 0x9e3c36, 0x3b6296], lit: false }); fc.sign(0.1, 2.1, 2.8, 0.45, 'ПЕЧАТЬ', { bg: 0x3b6296, fg: 0xf6f4ee, border: 0x283f6b }); } }));
    } else if (look === 'glass') {                               // a pavilion: a white frame, its counter behind glass
      g.add(building({ ...spec, wallColor: 0xdfe2e8, roofColor: 0x6a7182,
        draw: (fc) => { fc.shopfront(0.15, 1.9, 1.9, { frame: 0xb8bdc8, goods: [0x6b4636, 0xf6f4ee, 0xe7b84a], lit: false }); fc.door(2.2, 0.65, 1.9, { color: 0xb8bdc8, frame: 0xb8bdc8, style: 'shop' }); fc.sign(0.1, 2.05, 2.8, 0.45, sign, { bg: 0xf6f4ee, fg: colour, border: 0xb8bdc8, style: 'lightbox' }); } }));
    } else if (look === 'cabin') {                               // a metal cabin with a serving hatch
      g.add(building({ ...spec, wall: 'plaster', wallColor: 0xb8bdc8, roofColor: 0x8f96a6,
        draw: (fc) => { fc.rect(0, 0, 3, 2.6, 0xc8ccd2); for (let x = 0.2; x < 3; x += 0.25) fc.rect(x, 0.1, 0.0625, 2.4, 0xa8adb8); fc.shopfront(0.6, 1.4, 1.0, { frame: 0x4c5262, goods: [0xe7b84a, 0x9e3c36], lit: false }); fc.rect(0.5, 1.0, 1.6, 0.08, 0x6a7182); fc.sign(0.2, 2.05, 2.6, 0.45, sign, { bg: colour, fg: 0xf6f4ee, border: 0x23252f }); } }));
    } else {
      g.add(building({ ...spec,
        draw: (fc) => { fc.shopfront(0.2, 2.6 - 0.2, 1.4, { goods: [0xf6f4ee, 0xe7b84a, 0x9e3c36], lit: false }); fc.sign(0.1, 1.75, 2.8, 0.6, sign, { bg: 0xf6f4ee, fg: colour, border: 0x23252f }); } }));
    }
    return;
  }
  if (f.kind === 'beds') {
    const top = { kale: T('kale', 1), boughs: T('boughs', 1), stalks: T('stalks', 1) }[look] ?? T('leaves', 1);
    for (const z0 of [f.z0, f.z0 + 2.6]) put(box(4, 0.3, 1.6, { sides: mat(0x5c5650), top }), f.x0 + 2, z0 + 0.8);
  }
}

export function* buildSection(S, { month = 11 } = {}) {
  const g = new THREE.Group();
  const fronts = [], heads = [], sprites = [];
  const at = (m, x, z) => { m.position.set(snap(x), 0, snap(z)); g.add(m); return m; };
  const L = S.look, leaves = LEAF_LITTER[month] ?? 0;

  // The ground: the street (pavement, road, near pavement); the side streets and alleys north, and a
  // glimpse of the street beyond; the south band (a boulevard and its far road, or a park); the strip
  // behind the hedge, and the lanes going on south through it.
  const c = S.crossings[0], cs = S.crossingsS[0];
  g.add(street({ x0: S.x0, x1: S.x1, zB: Z.front, zK1: Z.kerbN, zK2: Z.kerbS, z1: Z.fence, zebra: c ? [c.x0, c.x1] : null, seed: S.seed % 100000, ox: Math.round(S.x0 * PX_PER_M), calm: true,
    look: { a: L.a, b: L.b, breakX: L.breakN }, zebraKind: L.zebra, rowSeed: L.rowSeed, leaves }));
  const lane = (gp, look, za, zb, y = 0) => {                       // a side street (pavements and a road) or an alley
    if (gp.kind === 'side') g.add(ground(gp.x0, za, gp.x0 + 2, zb, paveT(look.walks), y), ground(gp.x1 - 2, za, gp.x1, zb, paveT(look.walks), y), ground(gp.x0 + 2, za, gp.x1 - 2, zb, laneT(look.ground), y));
    else g.add(ground(gp.x0, za, gp.x1, zb, laneT(look.ground), y));
  };
  S.gapsN.forEach((gp, k) => {
    lane(gp, L.lanesN[k], Z.north - 4.5, Z.front);
    g.add(ground(gp.x0 - 3, Z.north - 8, gp.x1 + 3, Z.north - 4.5, T('cobble', 1)), ground(gp.x0 - 3, Z.north - 16, gp.x1 + 3, Z.north - 8, T('asphalt', 3)));
  });
  if (S.band === 'boulevard') {
    g.add(ground(S.x0, Z.fence, S.x1, Z.pathN, T('grass', 3)), ground(S.x0, Z.pathN, S.x1, Z.pathS, T('gravel', 3)), ground(S.x0, Z.pathS, S.x1, Z.fenceS, T('grass', 3)));
    if (c) g.add(ground(c.x0, Z.fence, c.x1, Z.pathN, T('gravel', 3), 0.005));     // worn ways across the lawns, from the crossings
    if (cs) g.add(ground(cs.x0, Z.pathS, cs.x1, Z.fenceS, T('gravel', 3), 0.005));
    const fa = far(L.a), fb = L.a === L.b ? fa : far(L.b);
    g.add(street({ x0: S.x0, x1: S.x1, zB: Z.fenceS, zK1: Z.roadN, zK2: Z.roadS, z1: Z.south, zebra: cs ? [cs.x0, cs.x1] : null, seed: (S.seed >>> 3) % 100000, ox: Math.round(S.x0 * PX_PER_M), calm: true,
      look: { a: fa, b: fb, breakX: L.breakS }, zebraKind: L.zebraS, rowSeed: L.rowSeed + 1, leaves: leaves * 0.6 }));
  } else {
    g.add(ground(S.x0, Z.fence, S.x1, Z.roadS, T('grass', 3)), ground(S.x0, Z.pathN, S.x1, Z.pathS, T('gravel', 3), 0.004), ground(S.x0, Z.roadS, S.x1, Z.south, T('gravel', 3)));
    for (const p of S.park.paths) g.add(ground(p.x0, p.x0 === c?.x0 ? Z.fence : Z.pathS, p.x1, Z.roadS, T('gravel', 3), 0.005));
    const f = S.park.feature;
    if (f) feature(g, f, sprites);
  }
  g.add(ground(S.x0, Z.south, S.x1, Z.edge + 12, T('grass', 3)));
  S.gapsS.forEach((gp, k) => lane(gp, L.lanesS[k], Z.south, Z.edge + 12, 0.006));   // (over the strip's grass)
  yield;

  // The buildings, each in its dress; awnings over some shops.
  const r = stream('dusk', S.seed);
  for (const B of S.buildings) {
    const spec = { x0: B.x0, x1: B.x1, z: B.z, h: B.h, d: B.d, wall: B.wall, wallColor: B.wallColor, roof: B.roof, roofColor: B.roofColor, kit: B.look?.roofKit, draw: run(B.ops, false), seed: B.seed, split: true };
    const b = building(spec);
    g.add(b);
    for (const a of B.look?.awnings ?? []) g.add(awning(B.x0 + a.x0, B.x0 + a.x1, 3.0, B.z, { depth: 0.7, drop: 0.35, color: a.color }));
    for (const s of B.look?.hanging ?? []) g.add(hangingSign(B.x0 + s.x, 3.0, B.z, s.text, { bg: s.bg, fg: s.fg }));
    const body = b.userData.body;
    fronts.push({ body, day: body.material[4], night: null, spec, dusk: range(r, 0.08, 0.7),
      paintNight() { this.night = mat(0, facade({ w: B.x1 - B.x0, h: B.h, wall: B.wall, wallColor: B.wallColor, draw: run(B.ops, true), seed: B.seed, night: true, split: true })); } });
    yield;
  }

  // The furniture, a few pieces at a time (a tree is the costliest).
  let cost = 0;
  for (const p of S.props) {
    switch (p.kind) {
      case 'lamp': {
        const l = lamp(p.x, p.z, { pool: false, kind: p.look, reach: p.reach ?? 0.5 });
        g.add(l);
        for (const head of l.userData.heads) heads.push({ head, day: head.material, night: head.material.map((m, i) => (i === 2 ? m : LAMP_LIT)) });
        cost += 1;
        break;
      }
      case 'tree': sprites.push(seeThrough(at(treeCard({ seed: p.seed, size: p.size, species: p.species, month }), p.x, p.z))); cost += 4; break;
      case 'bench': g.add(bench(p.x, p.z, { len: p.len, kind: p.look })); break;
      case 'bin': g.add(bin(p.x, p.z, { kind: p.look })); break;
      case 'postbox': sprites.push(seeThrough(at(propCard(p.look && p.look !== 'red' ? `postbox-${p.look}` : 'postbox'), p.x, p.z))); break;
      case 'railing': {
        if (p.z0 === undefined) { g.add(railing(p.x0, p.x1, p.z, { kind: p.look })); break; }
        const rl = railing(0, p.z1 - p.z0, 0, { kind: p.look });   // across: built along x, turned to run along z
        const pivot = new THREE.Group(); pivot.add(rl); pivot.rotation.y = -Math.PI / 2; pivot.position.set(p.x0, 0, p.z0); g.add(pivot);
        break;
      }
      case 'car': { const m = car(p.color, { seed: p.seed, kind: p.look }); m.position.set(snap(p.x), 0, snap(p.z)); g.add(m); cost += 1; break; }
      case 'hedge': {
        const leavesM = hedgeLeaves(p.look, month), hh = { thuja: 1.05, hawthorn: 0.8, twigs: 0.75 }[p.look] ?? 0.85;
        const h = box(p.x1 - p.x0, hh, Z.hedge - Z.south - 0.1, { sides: leavesM, top: leavesM });
        h.position.set((p.x0 + p.x1) / 2, 0, (Z.south + 0.1 + Z.hedge) / 2); g.add(h);
        break;
      }
      case 'shrub': sprites.push(seeThrough(at(propCard('shrub', { seed: p.seed }), p.x, p.z))); break;
    }
    if (cost >= 12) { cost = 0; yield; }
  }

  const dispose = () => {
    const done = new Set();
    g.traverse(o => {
      if (o.geometry && !done.has(o.geometry)) { done.add(o.geometry); o.geometry.dispose(); }
      for (const m of [o.material].flat()) {
        // (flat colours are shared materials, kept; so are the ground tiles and the makes' textures)
        if (!m?.map || done.has(m) || m.userData.keep || [...tiles.values()].includes(m)) continue;
        done.add(m);
        if (m.map && !done.has(m.map)) { done.add(m.map); m.map.dispose(); }
        if (m.emissiveMap && !done.has(m.emissiveMap)) { done.add(m.emissiveMap); m.emissiveMap.dispose(); }
        m.dispose();
      }
    });
    for (const f of fronts) if (f.night) { f.night.map.dispose(); f.night.emissiveMap?.dispose(); f.night.dispose(); }
  };
  return { group: g, fronts, heads, sprites, dispose };
}
