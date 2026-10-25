// TRADECRAFT samples: pixel art from simple 3D (the "chibi town" direction, 2026-10-25).
//
// The look of a handheld top-down RPG, made from a few boxes:
//   - a fixed, small resolution (RES, 480 × 270; `zoom` divides it, to look closer), shown scaled by a
//     whole number with hard pixel edges: the canvas *is* the low-res image, CSS scales it;
//   - a camera looking straight ahead and down at 45°, orthographic, so that one metre is PX_PER_M
//     pixels along the ground, up a wall and across: tiles and building fronts come out square, as
//     they're drawn in a 2D game. It snaps to the pixel grid, so nothing shimmers as it moves;
//   - toon light from the upper left, calibrated so a front shows exactly its painted colour (what is
//     painted is what shows, so the palette snap keeps it), a top about 17% brighter, a face turned
//     from the sun 0.69 and a cast shadow about half, tinted by a cool sky; hard pixel shadows;
//   - outlines as a sprite artist draws them: a dark pixel wherever one part meets another behind it
//     (hat over face, head over body, a person over the street), from a part-ID pass (every mesh's
//     userData.part, set by part()), and wherever depth jumps;
//   - every pixel snapped to the nearest colour of one hand-picked PALETTE, which is what makes pixel
//     art hold together;
//   - detail painted, not modelled: paint() draws a texture pixel by pixel at PX_PER_M a metre, and
//     box() maps it so one texel is one screen pixel (a facade, a face, a car's side);
//   - night (nightfall()): a moonlit sky fill, and the pixels a painted texture says glow (its
//     `glows` colours: a lit window, a shop, a sign's letters, headlights) light up. Lamps bring
//     their own light (pool()): cones of even light with hard edges, a bright core and a dimmer
//     ring, as pixel art draws a pool of light, not a smooth falloff the palette would band.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const RES = [480, 270];
export const GLOWS = [0xe7b84a, 0xf8e08a];                    // lit windows and shops: these glow at night
export const PX_PER_M = 16;

// The palette: ramps of hue-shifted colours (shadows cooler, lights warmer), sRGB.
export const PALETTE = [
  // night and greys (cool)
  0x14151c, 0x23252f, 0x353947, 0x4c5262, 0x6a7182, 0x8f96a6, 0xb8bdc8, 0xdfe2e8, 0xf6f4ee,
  // greens (towards teal in shadow, yellow in light)
  0x173327, 0x24503a, 0x356f42, 0x4f8f45, 0x76ad4c, 0xa6cc5e,
  // earth and wood
  0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb48459, 0xd6ad7a,
  // stone and pavement (warm greys)
  0x5c5650, 0x7d756c, 0xa0978a, 0xc4bba9, 0xe2dac6,
  // reds and brick
  0x3f1a22, 0x6e2a2e, 0x9e3c36, 0xc95c45, 0xe8896a,
  // blues
  0x1b2541, 0x283f6b, 0x3b6296, 0x5d8fc2, 0x95c1e3,
  // yellows and ochre
  0x7a5a22, 0xb9862e, 0xe7b84a, 0xf8e08a,
  // skin
  0x5e3a2a, 0x8c5a3f, 0xc48a62, 0xedc39c,
  // accents
  0x4a2a52, 0x7a4a86, 0x2f6b62,
];

/**
 * A pixel-art stage: renderer, scene, the 45° camera and a render() that outlines and palettises.
 * The canvas is shown at the largest whole-number scale that fits the window.
 */
export function pixelStage({ background = 0x23252f, outline = true, palette = PALETTE, zoom = 1 } = {}) {
  const W = Math.round(RES[0] / zoom), H = Math.round(RES[1] / zoom);
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;            // hard-edged, pixel shadows
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { imageRendering: 'pixelated', display: 'block', margin: '0 auto' });
  const fit = () => {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
    canvas.style.marginTop = `${Math.floor((innerHeight - H * s) / 2)}px`;
  };
  fit();
  addEventListener('resize', fit);
  document.body.appendChild(canvas);
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'webgl';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  // 45° down, looking along -z. A metre of ground (z) or of wall (y) projects to sin 45° camera units,
  // so the camera's vertical span is H / PX_PER_M · sin 45° for both to be PX_PER_M pixels.
  const s45 = Math.SQRT1_2;
  const camera = new THREE.OrthographicCamera(-W / PX_PER_M / 2, W / PX_PER_M / 2, H / PX_PER_M * s45 / 2, -H / PX_PER_M * s45 / 2, 1, 200);

  // Light, in three's physical units (a Lambert surface gives back intensity / π). The sky fill gives
  // a front 0.31 of its colour and a top 0.48; the sun (in the top band for both, RAMP) adds 0.69.
  // So a front shows its painted colour (1.0), a top 1.17, a face turned away 0.69, shadows 0.3-0.5.
  const hemi = new THREE.HemisphereLight(0xdde6ff, 0x9a8a78, 0.6 * Math.PI);
  const sun = new THREE.DirectionalLight(0xfff2dc, 0.79 * Math.PI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun, sun.target);

  const look = (target) => {
    // Snap to the pixel grid: 1/PX_PER_M m in x is a pixel, and so is 1/PX_PER_M m in z.
    const x = Math.round(target.x * PX_PER_M) / PX_PER_M, z = Math.round(target.z * PX_PER_M) / PX_PER_M, y = target.y ?? 0;
    camera.position.set(x, y + 60 * s45, z + 60 * s45);
    camera.lookAt(x, y, z);
    sun.target.position.set(x, 0, z);                          // the sun from the upper left, a little in front
    sun.position.set(x - 8, 15, z + 5);
  };
  look({ x: 0, z: 0 });

  // The composite: outline (part IDs and depth) and palette (nearest colour).
  const rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H) });
  const rtId = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const idMats = new Map();
  const idMat = (id) => {
    if (!idMats.has(id)) idMats.set(id, new THREE.MeshBasicMaterial({ color: new THREE.Color(((id * 2654435761) >>> 8 & 0xffffff) || 1) }));
    return idMats.get(id);
  };
  const pal = palette.map(h => new THREE.Color().setHex(h, THREE.SRGBColorSpace).convertLinearToSRGB());
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tId: { value: rtId.texture },
      res: { value: new THREE.Vector2(W, H) }, near: { value: camera.near }, far: { value: camera.far },
      outline: { value: outline ? 1 : 0 },
      // (padded to the shader's 64: three uploads the array at the declared size)
      pal: { value: Array.from({ length: 64 }, (_, i) => { const c = pal[Math.min(i, pal.length - 1)]; return new THREE.Vector3(c.r, c.g, c.b); }) },
      count: { value: Math.min(pal.length, 64) },
    },
    vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      in vec2 vUv; out vec4 outColor;
      uniform sampler2D tColor, tDepth, tId; uniform vec2 res; uniform float near, far, outline;
      uniform vec3 pal[64]; uniform int count;
      float lin(float d) { return near + d * (far - near); }
      vec3 nearest(vec3 c) {
        vec3 best = pal[0]; float bd = 1e9;
        for (int i = 0; i < 64; i++) {
          if (i >= count) break;
          vec3 d = c - pal[i];
          float e = dot(d * d, vec3(0.30, 0.59, 0.11)) + 0.25 * dot(d, d);   // luma counts most
          if (e < bd) { bd = e; best = pal[i]; }
        }
        return best;
      }
      void main() {
        vec2 px = 1.0 / res, uv = (floor(vUv * res) + 0.5) * px;
        vec3 col = pow(clamp(texture(tColor, uv).rgb, 0.0, 1.0), vec3(1.0 / 2.2));
        float d = lin(texture(tDepth, uv).r);
        if (outline > 0.5) {
          vec3 id = texture(tId, uv).rgb;
          float edge = 1.0;
          vec2 o[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));
          for (int i = 0; i < 4; i++) {
            float dn = lin(texture(tDepth, uv + o[i] * px).r);
            vec3 idn = texture(tId, uv + o[i] * px).rgb;
            // Another part behind this pixel, or a big depth jump: this pixel is the nearer part's
            // edge. (A pixel further down a wall, or up the ground, is 0.044 m further: hence 0.02.)
            // A silhouette (far behind) is inked darker than a line between touching parts.
            bool other = distance(idn, id) > 0.01;
            if ((other && dn > d + 0.35) || dn > d + 0.6) edge = min(edge, 0.12);
            else if (other && dn > d + 0.02) edge = min(edge, 0.4);
          }
          col *= edge;
        }
        outColor = vec4(nearest(col), 1.0);
      }`,
  }));
  const post = new THREE.Scene();
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const render = () => {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    if (outline) {
      // The part-ID pass: each mesh drawn flat in its part's colour.
      const saved = [];
      // Things marked noId (a blob of shadow) stay out of it, so they draw no outline.
      scene.traverse(o => { if (o.isMesh && o.visible) { saved.push([o, o.material, o.visible]); if (o.userData.noId) o.visible = false; else o.material = idMat(o.userData.part ?? 0); } });
      const bg = scene.background;
      scene.background = null;
      renderer.setRenderTarget(rtId);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, camera);
      scene.background = bg;
      for (const [o, m, v] of saved) { o.material = m; o.visible = v; }
    }
    renderer.setRenderTarget(null);
    renderer.render(post, postCam);
  };
  return { THREE, renderer, scene, camera, sun, hemi, look, render, W, H };
}

/**
 * Night on a stage: a dark sky, the sun turned to a cool moon, and every painted texture's GLOWS
 * pixels made emissive (an emissive map drawn from the texture itself). Call it once the scene is built.
 */
export function nightfall(stage) {
  stage.scene.background = new THREE.Color(0x14151c);
  stage.hemi.color.set(0x5d8fc2); stage.hemi.groundColor.set(0x1b2541); stage.hemi.intensity = 0.26 * Math.PI;
  stage.sun.color.set(0x95c1e3); stage.sun.intensity = 0.15 * Math.PI;
  stage.sun.castShadow = false;                                // moon shadows only streak the lamps' pools
  const maps = new Map();
  const emissiveOf = (tex) => {
    if (maps.has(tex)) return maps.get(tex);
    const glowing = tex.userData.glows.map(h => [(h >> 16) & 255, (h >> 8) & 255, h & 255]);
    const src = tex.image, cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
    let any = false;
    for (let i = 0; i < d.length; i += 4) {
      const lit = glowing.some(([r, gg, b]) => d[i] === r && d[i + 1] === gg && d[i + 2] === b);
      if (lit) any = true; else d[i] = d[i + 1] = d[i + 2] = 0;
    }
    g.putImageData(img, 0, 0);
    let out = null;
    if (any) {
      out = new THREE.CanvasTexture(cv);
      out.magFilter = out.minFilter = THREE.NearestFilter;
      out.generateMipmaps = false;
      out.colorSpace = THREE.SRGBColorSpace;
      out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
    }
    maps.set(tex, out);
    return out;
  };
  stage.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      if (!m.isMeshToonMaterial || !m.map?.userData.glows) continue;
      const e = emissiveOf(m.map);
      if (e) { m.emissiveMap = e; m.emissive.set(0xffffff); m.emissiveIntensity = 1; m.needsUpdate = true; }
    }
  });
}

/**
 * A pool of light from a lamp at (x, y, z) onto the ground under it: two cones of even light (no
 * falloff), a core of radius r and a ring out to 1.5 r. Returns a group to add to the scene.
 */
export function pool(x, y, z, { r = 2, color = 0xe7b84a, core = 0.5, ring = 0.2, aim = [0, 0] } = {}) {
  const g = new THREE.Group();
  for (const [radius, k] of [[r, core], [r * 1.5, ring]]) {
    const spot = new THREE.SpotLight(color, k * Math.PI, 0, Math.atan(radius / y), 0, 0);
    spot.position.set(x, y, z);
    spot.target.position.set(x + aim[0], 0, z + aim[1]);
    g.add(spot, spot.target);
  }
  return g;
}

// ---------- parts, materials and painted textures ----------

let nextPart = 1;
/** Give everything under `obj` one part ID (outlines are drawn where parts meet). Returns obj. */
export function part(obj, id = nextPart++) {
  obj.traverse(o => { if (o.isMesh) o.userData.part = id; });
  return obj;
}

// Two light bands: lit (fronts and tops, which the sky fill tells apart), and turned from the sun.
const RAMP = (() => {
  const v = [0.55, 0.55, 1.0, 1.0, 1.0].map(x => Math.round(x * 255));
  const t = new THREE.DataTexture(new Uint8Array(v.flatMap(x => [x, x, x, 255])), v.length, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const mats = new Map();
/** A toon material: a flat colour, or a painted texture (shared when it's just a colour). */
export function mat(color, map = null) {
  if (map) return new THREE.MeshToonMaterial({ color: 0xffffff, map, gradientMap: RAMP });
  if (!mats.has(color)) mats.set(color, new THREE.MeshToonMaterial({ color, gradientMap: RAMP }));
  return mats.get(color);
}
/** An unlit material (a lit window, a lamp), shown as painted. */
export function glow(color, map = null) {
  return new THREE.MeshBasicMaterial({ color: map ? 0xffffff : color, map });
}

export const hex = (h) => '#' + h.toString(16).padStart(6, '0');

// A seeded random, so every texture is drawn the same each time.
export function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/**
 * A painted texture, w × h pixels (so w / PX_PER_M × h / PX_PER_M metres): draw(px, w, h) paints it,
 * px(x, y, w, h, colour) filling pixels, y from the top. `repeat` makes it tile; `glows` lists the
 * colours that light up at night.
 */
export function paint(w, h, draw, { repeat = false, glows = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw((x, y, ww = 1, hh = 1, c = 0x14151c) => { g.fillStyle = hex(c); g.fillRect(x, y, ww, hh); }, w, h, g);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.size = [w / PX_PER_M, h / PX_PER_M];             // metres one copy covers
  t.userData.glows = glows;
  return t;
}

/** A repeating pixel texture of m metres square, by kind: grass, cobble, asphalt, brick, plaster, roof, planks, leaves, awning. */
export function tile(kind, m = 1) {
  const n = PX_PER_M * m;
  const r = rng(kind.length * 977 + m * 131);
  return paint(n, n, (px) => {
    const speckle = (cols, k) => { for (let i = 0; i < n * n * k; i++) px(Math.floor(r() * n), Math.floor(r() * n), 1, 1, cols[Math.floor(r() * cols.length)]); };
    switch (kind) {
      case 'grass':
        px(0, 0, n, n, 0x4f8f45);
        speckle([0x356f42, 0x356f42, 0x76ad4c], 0.18);
        for (let i = 0; i < n * n / 40; i++) {             // tufts: a light blade over a dark one
          const x = Math.floor(r() * n), y = 1 + Math.floor(r() * (n - 2));
          px(x, y + 1, 1, 1, 0x24503a); px(x, y, 1, 1, 0x76ad4c); if (r() < 0.4) px(x, y - 1, 1, 1, 0xa6cc5e);
        }
        break;
      case 'cobble':
        px(0, 0, n, n, 0x7d756c);
        for (let y = 0; y < n; y += 4) for (let x = (y / 4) % 2 * 2; x < n; x += 4) { px(x, y, 3, 3, r() < 0.5 ? 0xa0978a : 0xc4bba9); px(x, y, 1, 1, 0xe2dac6); }
        break;
      case 'asphalt':
        px(0, 0, n, n, 0x4c5262);
        speckle([0x353947, 0x6a7182], 0.08);
        break;
      case 'brick':                                        // 4 px courses, half-bond, a mortar line
        px(0, 0, n, n, 0xa0978a);
        for (let y = 0; y < n; y += 4) for (let x = ((y / 4) % 2) * 4 - 4; x < n; x += 8) {
          px(x, y, 7, 3, r() < 0.2 ? 0xc95c45 : r() < 0.2 ? 0x6e2a2e : 0x9e3c36);
        }
        break;
      case 'plaster':
        px(0, 0, n, n, 0xe2dac6);
        speckle([0xc4bba9, 0xf6f4ee], 0.04);
        break;
      case 'roof':                                         // tiles in rows, shadowed under each row
        px(0, 0, n, n, 0x9e3c36);
        for (let y = 0; y < n; y += 4) { px(0, y + 3, n, 1, 0x6e2a2e); for (let x = (y / 4) % 2 * 2; x < n; x += 4) px(x, y, 1, 3, 0x6e2a2e); px(0, y, n, 1, 0xc95c45); }
        break;
      case 'planks':
        px(0, 0, n, n, 0x8f6345);
        for (let x = 0; x < n; x += 4) px(x, 0, 1, n, 0x6b4636);
        speckle([0x6b4636, 0xb48459], 0.04);
        break;
      case 'leaves':                                       // clumps: dark ground, mid leaves, lit tips
        px(0, 0, n, n, 0x24503a);
        for (let i = 0; i < n * n / 9; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); px(x, y, 3, 2, 0x356f42); px(x + 1, y, 1, 1, 0x4f8f45); }
        for (let i = 0; i < n * n / 30; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); px(x, y, 2, 1, 0x76ad4c); if (r() < 0.3) px(x, y, 1, 1, 0xa6cc5e); }
        break;
      case 'awning':
        for (let x = 0; x < n; x++) px(x, 0, 1, n, Math.floor(x / 4) % 2 ? 0xf6f4ee : 0x9e3c36);
        break;
      default:
        px(0, 0, n, n, 0xff00ff);
    }
  }, { repeat: true });
}

// ---------- shapes ----------

// BoxGeometry's faces, in its group order: +x, -x, +y, -y, +z, -z.
function faceMaterials({ sides, top = sides, bottom = top, front = sides, back = sides, left = sides, right = sides }) {
  return [right, left, top, bottom, front, back];
}
// Scale each face's UVs (0..1 across it) to its size over its texture's size in metres.
function fitUVs(geo, w, h, d, materials) {
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geo.attributes.uv;
  geo.groups.forEach((g, f) => {
    const [mu, mv] = materials[f].map?.userData.size ?? [1, 1];
    const verts = new Set();
    for (let i = g.start; i < g.start + g.count; i++) verts.add(geo.index ? geo.index.getX(i) : i);
    for (const v of verts) uv.setXY(v, uv.getX(v) * dims[f][0] / mu, uv.getY(v) * dims[f][1] / mv);
  });
}

/**
 * A box w × h × d (metres), bottom at y 0, with a material per face: { sides, top, bottom, front,
 * back, left, right } (front is +z, towards the camera). A painted texture covers its size in metres
 * (userData.size), so one texel stays one pixel; a texture painted to a face's exact size fits it.
 */
export function box(w, h, d, faces) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  const materials = faceMaterials(faces);
  fitUVs(geo, w, h, d, materials);
  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** A rounded box (corners of radius r metres), like box(): for heads and bodies, where a pixel of rounding takes the corners off. */
export function roundedBox(w, h, d, r, faces) {
  const geo = new RoundedBoxGeometry(w, h, d, 1, r);
  geo.translate(0, h / 2, 0);
  const materials = faceMaterials(faces);
  fitUVs(geo, w, h, d, materials);
  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** A flat rectangle at height y, x0..x1 × z0..z1 (z0 the far edge); a texture painted to its size fits it, a repeating one tiles. */
export function ground(x0, z0, x1, z1, material, y = 0) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const [mu, mv] = material.map?.userData.size ?? [1, 1];
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / mu, (z1 - p.getZ(i)) / mv);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- a pixel font (3 × 5), for signs ----------

const GLYPHS = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'], M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['1001', '1101', '1011', '1001', '1001'], O: ['010', '101', '101', '101', '010'], P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'], W: ['10001', '10001', '10101', '11011', '10001'],
  Y: ['101', '101', '010', '010', '010'], X: ['101', '101', '010', '101', '101'], Z: ['111', '001', '010', '100', '111'],
  J: ['001', '001', '001', '101', '010'], Q: ['010', '101', '101', '110', '011'], "'": ['1', '1', '0', '0', '0'],
  ' ': ['00', '00', '00', '00', '00'],
};
/** Width in pixels of `str` in the pixel font. */
export const textWidth = (str) => [...str].reduce((a, ch) => a + (GLYPHS[ch] ?? GLYPHS[' '])[0].length + 1, -1);
/** Write `str` at (x, y) with px(), in colour c. */
export function text(px, x, y, str, c) {
  for (const ch of str) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    g.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(x + i, y + j, 1, 1, c); }));
    x += g[0].length + 1;
  }
}
