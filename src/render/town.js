// TRADECRAFT render: a street section, drawn from its data (src/sim/map/street.js) with the art's
// painters (src/art/pixeltown.js, townsprites.js), in the fine finish.
//
// buildSection(S) is a generator: it yields between its costly parts (the ground, each building, the
// furniture), so the view can spread a section over a few frames (sections arrive 70 m ahead of the
// camera, so there's time), and returns { group, fronts, heads, sprites, dispose }:
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
// Ground tiles repeat every 1 or 3 m, which divides the section's 45 m, so sections join seamlessly;
// the street's own texture takes the section's offset in world pixels for the same reason. Past the
// map's edges, where its ways lead off, a few metres of what's beyond are drawn (the next street's
// pavement and road up a lane; the lane going on south), so a way out looks like one.
import * as THREE from 'three';
import { ground, tile, mat, glow, box, PX_PER_M } from '../art/pixelart.js';
import { street, building, facade, lamp, bench, bin, car, railing } from '../art/pixeltown.js';
import { treeCard, propCard } from '../art/townsprites.js';
import { spritePerson } from '../art/sprites.js';
import { Z } from '../sim/map/street.js';
import { stream, range } from '../sim/rng.js';

const tiles = new Map();
const T = (kind, m) => { const k = `${kind}${m}`; if (!tiles.has(k)) tiles.set(k, mat(0, tile(kind, m))); return tiles.get(k); };
const snap = (v) => Math.round(v * PX_PER_M) / PX_PER_M;
const LAMP_LIT = glow(0xf8e08a);

// A facade's paint operations, run on the art's painter. Shops are lit at night only: by day their
// glass is glass, not the yellow that glows.
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

const run = (ops, night) => (f) => {
  for (const [op, ...args] of ops) {
    if (op === 'shopfront') f.shopfront(args[0], args[1], args[2], { ...args[3], lit: night });
    else f[op](...args);
  }
};

const STONE = 0xa0978a;
const BRONZE = { skin: 'dark', hair: { style: 'short', color: 0x47302a }, top: { kind: 'coat', color: 0x47302a, trim: 0x2a1c18 }, legs: 0x47302a, shoes: 0x2a1c18 };
const KIOSKS = [['ПЕЧАТЬ', 0x24503a], ['КОФЕ', 0x6e2a2e], ['ЦВЕТЫ', 0x283f6b], ['МОРОЖЕНОЕ', 0x3b6296]];

// A park's one thing to see: a pond with a stone rim, a fountain, a bronze man on a plinth, a
// kiosk (its front to the south walk), or two flower beds.
function feature(g, f, sprites) {
  const w = f.x1 - f.x0, d = f.z1 - f.z0, cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
  const put = (m, x, z, y = 0) => { m.position.set(x, y, z); g.add(m); return m; };
  if (f.kind === 'pond' || f.kind === 'fountain') {
    for (const [x, z, ww, dd] of [[cx, f.z0 + 0.15, w, 0.3], [cx, f.z1 - 0.15, w, 0.3], [f.x0 + 0.15, cz, 0.3, d], [f.x1 - 0.15, cz, 0.3, d]]) {
      put(box(ww, 0.3, dd, { sides: mat(STONE), top: mat(0xc4bba9) }), x, z);
    }
    g.add(ground(f.x0 + 0.3, f.z0 + 0.3, f.x1 - 0.3, f.z1 - 0.3, mat(0, tile('water', 3)), 0.12));
    if (f.kind === 'fountain') {
      put(box(1.0, 0.6, 1.0, { sides: mat(STONE), top: mat(0xc4bba9) }), cx, cz);
      put(box(0.3, 0.9, 0.3, { sides: glow(0xdfe2e8), top: glow(0xf6f4ee) }), cx, cz, 0.6);
    }
  } else if (f.kind === 'monument') {
    put(box(w, 1.3, d, { sides: mat(STONE), top: mat(0xc4bba9), front: mat(0x8f96a6) }), cx, cz);
    const man = spritePerson(BRONZE);
    man.root.position.set(cx, 1.3, cz);
    man.root.children[1].visible = false;                          // (no shadow blob up there)
    g.add(man.root);
    sprites.push(man.card);                                        // (tinted by the light where it stands, like the people)
  } else if (f.kind === 'kiosk') {
    const [sign, colour] = KIOSKS[f.seed % KIOSKS.length];
    g.add(building({ x0: f.x0, x1: f.x1, z: f.z1, h: 2.6, d: 2, wall: 'plaster', wallColor: colour, seed: f.seed,
      draw: (fc) => { fc.shopfront(0.2, 2.6 - 0.2, 1.4, { goods: [0xf6f4ee, 0xe7b84a, 0x9e3c36], lit: false }); fc.sign(0.1, 1.75, 2.8, 0.6, sign, { bg: 0xf6f4ee, fg: colour, border: 0x23252f }); } }));
  } else if (f.kind === 'beds') {
    for (const z0 of [f.z0, f.z0 + 2.6]) {
      const bed = box(4, 0.3, 1.6, { sides: mat(0x5c5650), top: mat(0, tile('leaves', 1)) });
      put(bed, f.x0 + 2, z0 + 0.8);
    }
  }
}

export function* buildSection(S) {
  const g = new THREE.Group();
  const fronts = [], heads = [], sprites = [];
  const at = (m, x, z) => { m.position.set(snap(x), 0, snap(z)); g.add(m); return m; };

  // The ground: the street (pavement, road, near pavement); the side streets and alleys north, and a
  // glimpse of the street beyond; the south band (a boulevard and its far road, or a park); the strip
  // behind the hedge, and the lanes going on south through it.
  const c = S.crossings[0], cs = S.crossingsS[0];
  g.add(street({ x0: S.x0, x1: S.x1, zB: Z.front, zK1: Z.kerbN, zK2: Z.kerbS, z1: Z.fence, zebra: c ? [c.x0, c.x1] : null, seed: S.seed % 100000, ox: Math.round(S.x0 * PX_PER_M), calm: true }));
  const lane = (gp, za, zb, y = 0) => {                              // a side street (pavements and a road) or an alley (setts)
    if (gp.kind === 'side') g.add(ground(gp.x0, za, gp.x0 + 2, zb, T('cobble', 1), y), ground(gp.x1 - 2, za, gp.x1, zb, T('cobble', 1), y), ground(gp.x0 + 2, za, gp.x1 - 2, zb, T('asphalt', 3), y));
    else g.add(ground(gp.x0, za, gp.x1, zb, T('cobble', 1), y));
  };
  for (const gp of S.gapsN) {
    lane(gp, Z.north - 4.5, Z.front);
    g.add(ground(gp.x0 - 3, Z.north - 8, gp.x1 + 3, Z.north - 4.5, T('cobble', 1)), ground(gp.x0 - 3, Z.north - 16, gp.x1 + 3, Z.north - 8, T('asphalt', 3)));
  }
  if (S.band === 'boulevard') {
    g.add(ground(S.x0, Z.fence, S.x1, Z.pathN, T('grass', 3)), ground(S.x0, Z.pathN, S.x1, Z.pathS, T('gravel', 3)), ground(S.x0, Z.pathS, S.x1, Z.fenceS, T('grass', 3)));
    if (c) g.add(ground(c.x0, Z.fence, c.x1, Z.pathN, T('gravel', 3), 0.005));     // worn ways across the lawns, from the crossings
    if (cs) g.add(ground(cs.x0, Z.pathS, cs.x1, Z.fenceS, T('gravel', 3), 0.005));
    g.add(street({ x0: S.x0, x1: S.x1, zB: Z.fenceS, zK1: Z.roadN, zK2: Z.roadS, z1: Z.south, zebra: cs ? [cs.x0, cs.x1] : null, seed: (S.seed >>> 3) % 100000, ox: Math.round(S.x0 * PX_PER_M), calm: true }));
  } else {
    g.add(ground(S.x0, Z.fence, S.x1, Z.roadS, T('grass', 3)), ground(S.x0, Z.pathN, S.x1, Z.pathS, T('gravel', 3), 0.004), ground(S.x0, Z.roadS, S.x1, Z.south, T('gravel', 3)));
    for (const p of S.park.paths) g.add(ground(p.x0, p.x0 === c?.x0 ? Z.fence : Z.pathS, p.x1, Z.roadS, T('gravel', 3), 0.005));
    const f = S.park.feature;
    if (f) feature(g, f, sprites);
  }
  g.add(ground(S.x0, Z.south, S.x1, Z.edge + 12, T('grass', 3)));
  for (const gp of S.gapsS) lane(gp, Z.south, Z.edge + 12, 0.006);   // (over the strip's grass)
  yield;

  // The buildings.
  const r = stream('dusk', S.seed);
  for (const B of S.buildings) {
    const spec = { x0: B.x0, x1: B.x1, z: B.z, h: B.h, d: B.d, wall: B.wall, wallColor: B.wallColor, roof: B.roof, draw: run(B.ops, false), seed: B.seed, split: true };
    const b = building(spec);
    g.add(b);
    const body = b.userData.body;
    fronts.push({ body, day: body.material[4], night: null, spec, dusk: range(r, 0.08, 0.7),
      paintNight() { this.night = mat(0, facade({ w: B.x1 - B.x0, h: B.h, wall: B.wall, wallColor: B.wallColor, draw: run(B.ops, true), seed: B.seed, night: true, split: true })); } });
    yield;
  }

  // The furniture.
  for (const p of S.props) {
    switch (p.kind) {
      case 'lamp': {
        const l = lamp(p.x, p.z, { pool: false });
        g.add(l);
        const head = l.userData.head;
        heads.push({ head, day: head.material, night: head.material.map((m, i) => (i === 2 ? m : LAMP_LIT)) });
        break;
      }
      case 'tree': sprites.push(seeThrough(at(treeCard({ seed: p.seed, size: p.size }), p.x, p.z))); break;
      case 'bench': g.add(bench(p.x, p.z)); break;
      case 'bin': g.add(bin(p.x, p.z)); break;
      case 'postbox': sprites.push(seeThrough(at(propCard('postbox'), p.x, p.z))); break;
      case 'railing': {
        if (p.z0 === undefined) { g.add(railing(p.x0, p.x1, p.z)); break; }
        const rl = railing(0, p.z1 - p.z0, 0);                     // across: built along x, turned to run along z
        const pivot = new THREE.Group(); pivot.add(rl); pivot.rotation.y = -Math.PI / 2; pivot.position.set(p.x0, 0, p.z0); g.add(pivot);
        break;
      }
      case 'car': { const m = car(p.color, { seed: p.seed }); m.position.set(snap(p.x), 0, snap(p.z)); g.add(m); break; }
      case 'hedge': {
        const h = box(p.x1 - p.x0, 0.85, Z.hedge - Z.south - 0.1, { sides: mat(0, tile('leaves', 1)), top: mat(0, tile('leaves', 1)) });
        h.position.set((p.x0 + p.x1) / 2, 0, (Z.south + 0.1 + Z.hedge) / 2); g.add(h);
        break;
      }
      case 'shrub': sprites.push(seeThrough(at(propCard('shrub', { seed: p.seed }), p.x, p.z))); break;
    }
  }

  const dispose = () => {
    const done = new Set();
    g.traverse(o => {
      if (o.geometry && !done.has(o.geometry)) { done.add(o.geometry); o.geometry.dispose(); }
      for (const m of [o.material].flat()) {
        // (flat colours are shared materials, kept; so are the ground tiles)
        if (!m?.map || done.has(m) || [...tiles.values()].includes(m)) continue;
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
