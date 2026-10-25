// TRADECRAFT samples: buildings assembled at runtime from a short description, with cutaways.
//
// The shell (outer walls, floors, roof, interior walls) is plain geometry made here: a wall is
// split into rectangles around its openings, each rectangle a box. The boxes carry UVs in absolute
// metres, so brick courses run on across storeys and around windows, and three materials: the
// facade outside, plaster inside, and on the cut faces (tops, ends) a dark section colour, as in an
// architect's drawing, so a cut wall reads at a glance. What fills the openings (windows, doors,
// shopfronts) and the stairs are kit pieces from tools/blender/kit.py, cloned in.
//
// A building is described in its own metres, x across (0..w) and z deep (0..d), the ground at y 0:
//   { at: [x, z], size: [w, d], storeys: 3, height: 3.0, wall: 0.25, partition: 0.12,
//     openings:   [{ side: 's'|'e'|'n'|'w', storey: 0, at: 2.4, piece: 'shopfront' }, …],
//                 (at: metres along the side, read left to right from outside, to the opening's middle)
//     partitions: [{ storey: 1, from: [x, z], to: [x, z], doors: [{ at: 1.2, piece: 'door_flat' }] }, …],
//     stairs:     [{ storey: 0, at: [x, z], dir: 'n'|'s'|'e'|'w' }, …]  (cuts a hole in the floor above)
//     materials:  { facade, interior, cut, roof, floors: [storey 0, storey 1, …], ceiling } }
//
// update(camera, { walls, storey }) sets the cutaway:
//   walls 'up'    everything standing;
//         'cut'   the outer walls facing the camera, and every interior wall, drop to stubs (STUB m);
//         'down'  every wall is a stub;
//   storey        the highest storey shown: everything above is hidden (and the roof, unless 'up').
// Kit pieces in a stubbed wall are hidden with it.
import * as THREE from 'three';

export const STUB = 0.45;

const SIDES = {
  s: { start: (w, d) => [0, d], dir: [1, 0], normal: [0, 1], length: (w) => w, corner: 1 },
  e: { start: (w, d) => [w, d], dir: [0, -1], normal: [1, 0], length: (w, d) => d, corner: -1 },
  n: { start: (w) => [w, 0], dir: [-1, 0], normal: [0, -1], length: (w) => w, corner: 1 },
  w: { start: () => [0, 0], dir: [0, 1], normal: [-1, 0], length: (w, d) => d, corner: -1 },
};
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Accumulates quads into three material groups, checking each quad's winding against its normal. */
class Builder {
  constructor(groups = 3) { this.g = Array.from({ length: groups }, () => ({ p: [], n: [], uv: [] })); }
  quad(group, pts, normal, uvs) {
    const [a, b, c] = pts;
    const cross = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    let order = [0, 1, 2, 0, 2, 3];
    if (cross.dot(normal) < 0) order = [0, 2, 1, 0, 3, 2];
    const g = this.g[group];
    for (const i of order) {
      g.p.push(pts[i].x, pts[i].y, pts[i].z);
      g.n.push(normal.x, normal.y, normal.z);
      g.uv.push(uvs[i][0], uvs[i][1]);
    }
  }
  geometry() {
    const geo = new THREE.BufferGeometry();
    const p = [], n = [], uv = [];
    let start = 0;
    this.g.forEach((g, i) => {
      p.push(...g.p); n.push(...g.n); uv.push(...g.uv);
      const count = g.p.length / 3;
      if (count) geo.addGroup(start, count, i);
      start += count;
    });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return geo;
  }
}

/** A wall's rectangles, along [a0, a1] and up [0, H], around its openings ({a0, a1, h0, h1}). */
function rects(a0, a1, H, openings) {
  const out = [];
  let at = a0;
  for (const o of [...openings].sort((x, y) => x.a0 - y.a0)) {
    if (o.a0 > at) out.push({ a0: at, a1: o.a0, h0: 0, h1: H });
    if (o.h0 > 0) out.push({ a0: o.a0, a1: o.a1, h0: 0, h1: o.h0 });
    if (o.h1 < H) out.push({ a0: o.a0, a1: o.a1, h0: o.h1, h1: H });
    at = Math.max(at, o.a1);
  }
  if (at < a1) out.push({ a0: at, a1, h0: 0, h1: H });
  return out;
}

/**
 * Wall geometry: rectangles in a wall's own frame (a along `dir` from `origin`, h up from `base`),
 * `t` thick, centred on the line. Groups: 0 the `normal` face, 1 the other face, 2 the cut faces.
 * `uOffset` keeps texture courses running on from one wall to the next.
 */
function wallGeometry(origin, dir, normal, base, t, list, uOffset = 0) {
  const b = new Builder();
  const N = new THREE.Vector3(normal[0], 0, normal[1]), D = new THREE.Vector3(dir[0], 0, dir[1]);
  const at = (a, h, s) => new THREE.Vector3(origin[0] + dir[0] * a + normal[0] * s, base + h, origin[1] + dir[1] * a + normal[1] * s);
  for (const r of list) {
    const o = t / 2, i = -t / 2, u0 = r.a0 + uOffset, u1 = r.a1 + uOffset, v0 = base + r.h0, v1 = base + r.h1;
    b.quad(0, [at(r.a0, r.h0, o), at(r.a1, r.h0, o), at(r.a1, r.h1, o), at(r.a0, r.h1, o)], N, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    b.quad(1, [at(r.a0, r.h0, i), at(r.a1, r.h0, i), at(r.a1, r.h1, i), at(r.a0, r.h1, i)], N.clone().negate(), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    b.quad(2, [at(r.a0, r.h1, i), at(r.a1, r.h1, i), at(r.a1, r.h1, o), at(r.a0, r.h1, o)], new THREE.Vector3(0, 1, 0), [[u0, 0], [u1, 0], [u1, t], [u0, t]]);
    b.quad(2, [at(r.a0, r.h0, i), at(r.a1, r.h0, i), at(r.a1, r.h0, o), at(r.a0, r.h0, o)], new THREE.Vector3(0, -1, 0), [[u0, 0], [u1, 0], [u1, t], [u0, t]]);
    b.quad(2, [at(r.a0, r.h0, i), at(r.a0, r.h0, o), at(r.a0, r.h1, o), at(r.a0, r.h1, i)], D.clone().negate(), [[0, v0], [t, v0], [t, v1], [0, v1]]);
    b.quad(2, [at(r.a1, r.h0, i), at(r.a1, r.h0, o), at(r.a1, r.h1, o), at(r.a1, r.h1, i)], D, [[0, v0], [t, v0], [t, v1], [0, v1]]);
  }
  return b.geometry();
}

/** A slab from (x0, z0) to (x1, z1), between y0 and y1, with rectangular holes. Groups: 0 top, 1 underside, 2 edges. */
function slabGeometry(x0, z0, x1, z1, y0, y1, holes = []) {
  // Strips along x around the holes, as for a wall (x along, z "up").
  const list = rects(x0, x1, z1 - z0, holes.map(h => ({ a0: h.x0, a1: h.x1, h0: h.z0 - z0, h1: h.z1 - z0 })));
  const b = new Builder();
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const r of list) {
    const xa = r.a0, xb = r.a1, za = z0 + r.h0, zb = z0 + r.h1;
    b.quad(0, [v(xa, y1, za), v(xb, y1, za), v(xb, y1, zb), v(xa, y1, zb)], v(0, 1, 0), [[xa, za], [xb, za], [xb, zb], [xa, zb]]);
    b.quad(1, [v(xa, y0, za), v(xb, y0, za), v(xb, y0, zb), v(xa, y0, zb)], v(0, -1, 0), [[xa, za], [xb, za], [xb, zb], [xa, zb]]);
    b.quad(2, [v(xa, y0, za), v(xb, y0, za), v(xb, y1, za), v(xa, y1, za)], v(0, 0, -1), [[xa, y0], [xb, y0], [xb, y1], [xa, y1]]);
    b.quad(2, [v(xa, y0, zb), v(xb, y0, zb), v(xb, y1, zb), v(xa, y1, zb)], v(0, 0, 1), [[xa, y0], [xb, y0], [xb, y1], [xa, y1]]);
    b.quad(2, [v(xa, y0, za), v(xa, y0, zb), v(xa, y1, zb), v(xa, y1, za)], v(-1, 0, 0), [[za, y0], [zb, y0], [zb, y1], [za, y1]]);
    b.quad(2, [v(xb, y0, za), v(xb, y0, zb), v(xb, y1, zb), v(xb, y1, za)], v(1, 0, 0), [[za, y0], [zb, y0], [zb, y1], [za, y1]]);
  }
  return b.geometry();
}

function shadowed(mesh) { mesh.castShadow = mesh.receiveShadow = true; return mesh; }

/** A paved slab (pavements, kerbs): top `y` above ground, UVs in metres; one material, or [top, under, edges]. */
export function slab(x0, z0, x1, z1, y, mat, holes = []) {
  const m = new THREE.Mesh(slabGeometry(x0, z0, x1, z1, 0, y, holes), Array.isArray(mat) ? mat : [mat, mat, mat]);
  m.receiveShadow = true;
  return m;
}

/** Build a building from `spec` with kit pieces from `kit` (the loaded kit.glb scene). */
export function building(kit, spec) {
  const [w, d] = spec.size;
  const H = spec.height ?? 3.0, t = spec.wall ?? 0.25, tp = spec.partition ?? 0.12;
  const M = spec.materials;
  const group = new THREE.Group();
  group.position.set(spec.at[0], 0, spec.at[1]);
  const walls = [];      // { full, stub, pieces, storey, normal (world xz) or null for partitions, centre }
  const storeyNodes = []; // per storey: objects hidden above the viewed storey
  for (let k = 0; k <= spec.storeys; k++) storeyNodes.push([]);

  const piece = (name) => {
    const src = kit.getObjectByName(name);
    if (!src) throw new Error(`no kit piece ${name}`);
    const p = src.clone(true);
    p.traverse(o => { if (o.isMesh) shadowed(o); });
    return p;
  };
  const opening = (p, a, base) => {
    const [ow, oh] = p.userData.opening, sill = p.userData.sill ?? 0;
    return { a0: a - ow / 2, a1: a + ow / 2, h0: sill, h1: Math.min(H - 0.01, sill + oh) };
  };
  const place = (p, origin, dir, normal, a, y) => {
    p.position.set(origin[0] + dir[0] * a, y + (p.userData.sill ?? 0), origin[1] + dir[1] * a);
    p.rotation.y = Math.atan2(normal[0], normal[1]);
  };
  const addWall = (geoFull, geoStub, mats, pieces, k, normal, centre) => {
    const full = shadowed(new THREE.Mesh(geoFull, mats));
    const stub = shadowed(new THREE.Mesh(geoStub, mats));
    stub.visible = false;
    group.add(full, stub, ...pieces);
    const entry = { full, stub, pieces, storey: k, normal, centre };
    walls.push(entry);
    storeyNodes[k].push(full, stub, ...pieces);
    return entry;
  };

  // Outer walls, storey by storey, side by side.
  for (let k = 0; k < spec.storeys; k++) {
    const base = k * H;
    for (const [key, S] of Object.entries(SIDES)) {
      const L = S.length(w, d), origin = S.start(w, d);
      // s and n run past the corners by half a wall, e and w stop short: the corners close.
      const a0 = S.corner > 0 ? -t / 2 : t / 2, a1 = S.corner > 0 ? L + t / 2 : L - t / 2;
      const pieces = [], holes = [];
      for (const o of (spec.openings || []).filter(o => o.side === key && o.storey === k)) {
        const p = piece(o.piece);
        if (p.userData.opening[1] > 0) holes.push(opening(p, o.at, base));   // a balcony fills no hole
        place(p, origin, S.dir, S.normal, o.at, base);
        pieces.push(p);
      }
      const list = rects(a0, a1, H, holes);
      const stubList = list.filter(r => r.h0 < STUB).map(r => ({ ...r, h1: Math.min(r.h1, STUB) }));
      const uOff = { s: 0, e: w, n: w + d, w: 2 * w + d }[key];
      const mats = [M.facade, M.interior, M.cut];
      const centre = [spec.at[0] + origin[0] + S.dir[0] * L / 2, spec.at[1] + origin[1] + S.dir[1] * L / 2];
      addWall(wallGeometry(origin, S.dir, S.normal, base, t, list, uOff), wallGeometry(origin, S.dir, S.normal, base, t, stubList, uOff),
        mats, pieces, k, S.normal, centre);
    }
  }

  // Interior walls.
  for (const pt of spec.partitions || []) {
    const base = pt.storey * H;
    const dx = pt.to[0] - pt.from[0], dz = pt.to[1] - pt.from[1], L = Math.hypot(dx, dz);
    const dir = [dx / L, dz / L], normal = [dir[1], -dir[0]];
    const pieces = [], holes = [];
    for (const dr of pt.doors || []) {
      const p = piece(dr.piece || 'door_flat');
      holes.push(opening(p, dr.at, base));
      place(p, pt.from, dir, normal, dr.at, base);
      pieces.push(p);
    }
    const list = rects(0, L, H, holes);
    const stubList = list.filter(r => r.h0 < STUB).map(r => ({ ...r, h1: Math.min(r.h1, STUB) }));
    const mats = [M.interior, M.interior, M.cut];
    addWall(wallGeometry(pt.from, dir, normal, base, tp, list), wallGeometry(pt.from, dir, normal, base, tp, stubList), mats, pieces, pt.storey, null, null);
  }

  // Floors (with a hole wherever stairs come up through them), and the roof.
  const holesFor = (k) => (spec.stairs || []).filter(s => s.storey === k - 1).map(s => {
    const run = kit.getObjectByName('stairs_straight').userData.run, half = 0.55, [dx, dz] = DIRS[s.dir];
    const xs = [s.at[0] - half * Math.abs(dz), s.at[0] + half * Math.abs(dz), s.at[0] + dx * run];
    const zs = [s.at[1] - half * Math.abs(dx), s.at[1] + half * Math.abs(dx), s.at[1] + dz * run];
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  });
  for (let k = 0; k < spec.storeys; k++) {
    const top = k * H + (k === 0 ? 0.02 : 0);
    const floor = M.floors?.[k] ?? M.floors?.[M.floors.length - 1] ?? M.interior;
    const slab = shadowed(new THREE.Mesh(slabGeometry(t / 2, t / 2, w - t / 2, d - t / 2, top - 0.2, top, holesFor(k)), [floor, M.ceiling ?? M.interior, M.cut]));
    group.add(slab);
    storeyNodes[k].push(slab);
  }
  const roof = shadowed(new THREE.Mesh(slabGeometry(-t / 2, -t / 2, w + t / 2, d + t / 2, spec.storeys * H, spec.storeys * H + 0.25),
    [M.roof ?? M.cut, M.ceiling ?? M.interior, M.cut]));
  group.add(roof);

  // Stairs.
  for (const s of spec.stairs || []) {
    const p = piece('stairs_straight');
    const [dx, dz] = DIRS[s.dir];
    p.position.set(s.at[0], s.storey * H, s.at[1]);
    p.rotation.y = Math.atan2(-dx, -dz);
    group.add(p);
    storeyNodes[s.storey].push(p);
  }

  const camAt = new THREE.Vector3();
  function update(camera, { walls: mode = 'cut', storey = spec.storeys - 1 } = {}) {
    camera.getWorldPosition(camAt);
    for (const wl of walls) {
      let cut = mode === 'down';
      if (mode === 'cut') {
        cut = wl.normal === null ||
          (wl.normal[0] * (camAt.x - wl.centre[0]) + wl.normal[1] * (camAt.z - wl.centre[1])) > 0;
      }
      wl.full.visible = !cut;
      wl.stub.visible = cut;
      for (const p of wl.pieces) p.visible = !cut;
    }
    storeyNodes.forEach((nodes, k) => {
      if (k > storey) for (const o of nodes) o.visible = false;
    });
    roof.visible = mode === 'up' && storey >= spec.storeys - 1;
  }

  /** The storey a height falls on (for hiding people and things above the viewed storey). */
  const storeyAt = (y) => Math.max(0, Math.floor((y + 0.1) / H));

  return { group, update, walls, storeyAt };
}
