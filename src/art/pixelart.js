// TRADECRAFT art: pixel art from simple 3D (the look: chibi people in the fine town, picked 2026-10-26).
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
//     ring, as pixel art draws a pool of light, not a smooth falloff the palette would band;
//   - weather (the game's: src/render/view.js sets it each frame from sim/weather.js), in two places.
//     On every lit surface (mat(): WX, shared uniforms, patched into the toon shader), before the light
//     falls on it, so lamps, shadows and night light snow and wet as they light the rest: the wet
//     darkens what faces up (walls a little), stands in puddles on the ground that mirror the sky and,
//     in a streak toward the camera under each, the lamps' heads; snow lies on whatever faces up
//     (roofs and ledges first, pavements in drifts, the roads churned grey), by a noise in the world's
//     metres, so it stays put as the camera moves; a frost silvers what faces up, glinting here and
//     there. And in the composite (setWeather()): what falls (rain in slanted streaks, two layers; snow
//     in flakes of a pixel or two, swaying; sleet, both; dust blown sideways) in screen pixels anchored
//     to the world (the camera's offset), splashes on wet ground, haze by distance from the eyes (fog,
//     dust, and the veil of heavy rain or snow; what the eyes don't take in is the haze's) and a halo
//     round each lamp in it. All of it nothing when there's no weather (the samples never set it).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { arabic, arabicWidth } from './arabic.js';

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

// ---------- colour in OKLCH (perceptual lightness, chroma, hue), and the fine palette ----------

const toLin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toSrgb = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
/** A colour's [L 0..1, chroma, hue in degrees]. */
export function oklch(hex) {
  const r = toLin(((hex >> 16) & 255) / 255), g = toLin(((hex >> 8) & 255) / 255), b = toLin((hex & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * q;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * q;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * q;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
/** The sRGB colour (0xrrggbb) of an OKLCH one, clipped to the gamut. */
export function fromOklch(L, C, h) {
  const A = C * Math.cos(h * Math.PI / 180), B = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const q = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const to8 = (v) => Math.round(Math.min(1, Math.max(0, toSrgb(Math.max(0, v)))) * 255);
  return (to8(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q) << 16)
    | (to8(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q) << 8)
    | to8(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * q);
}
// A pixel artist's hue shift: darker tones turn toward violet, lighter toward yellow.
const toward = (h, target, k) => h + (((target - h + 540) % 360) - 180) * Math.min(1, k);
export const shiftHue = (h, dL) => dL < 0 ? toward(h, 285, -dL * 1.4) : toward(h, 85, dL * 1.6);

// The fine palette (sample 007, after Stoneshard): 14 families of muted, warm-leaning colour, eight
// tones each, hue-shifted as above, chroma easing off at the ends; plus ink, paper and the two glows.
// [hue, chroma] per family.
const FAMILIES = [[60, 0.016], [265, 0.022], [55, 0.05], [75, 0.095], [35, 0.11], [22, 0.13], [50, 0.07],
  [115, 0.07], [145, 0.09], [195, 0.06], [250, 0.08], [275, 0.06], [325, 0.07], [85, 0.04]];
const STEPS = [0.2, 0.29, 0.38, 0.47, 0.56, 0.66, 0.76, 0.86];
/** The palette colour nearest `hex`, measured as the post pass measures it (luma counts most). */
export function nearest(hex, palette) {
  const ch = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const [r, g, b] = ch(hex);
  let best = palette[0], bd = Infinity;
  for (const p of palette) {
    const [pr, pg, pb] = ch(p), dr = r - pr, dg = g - pg, db = b - pb;
    const e = 0.30 * dr * dr + 0.59 * dg * dg + 0.11 * db * db + 0.25 * (dr * dr + dg * dg + db * db);
    if (e < bd) { bd = e; best = p; }
  }
  return best;
}
/** The look's finish: sample 007 sets fine, for richer textures (tile() here, the painters in pixeltown.js). */
export const finish = { fine: false };

const tones = new Map();
/** `hex` lighter (dL > 0) or darker by dL of OKLCH lightness, hue-shifted, a little less chroma the further. */
export function tone(hex, dL) {
  const key = hex * 1000 + Math.round(dL * 500);
  if (!tones.has(key)) {
    const [L, C, h] = oklch(hex);
    tones.set(key, fromOklch(Math.min(0.97, Math.max(0.08, L + dL)), C * (1 - Math.min(0.5, Math.abs(dL))), shiftHue(h, dL)));
  }
  return tones.get(key);
}

/** Smooth value noise, 0..1, at (x, y) in cells of one unit (scale the coordinates), from a seed. */
export function noise(x, y, seed = 1) {
  const hash = (i, j) => { let h = (i * 374761393 + j * 668265263 + seed * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** noise(), but repeating every `period` cells in x and y: for tiles (x / k over a tile of period · k pixels). */
export function tnoise(x, y, period, seed = 1) {
  const hash = (i, j) => { i = ((i % period) + period) % period; j = ((j % period) + period) % period; let h = (i * 374761393 + j * 668265263 + seed * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export const FINE_PALETTE = [
  ...FAMILIES.flatMap(([h, c]) => STEPS.map(L => fromOklch(L, c * (1 - 0.9 * Math.abs(L - 0.55)), shiftHue(h, L - 0.55)))),
  0x1a1214, 0xf4efe6, 0xe7b84a, 0xf8e08a,
];

/**
 * A pixel-art stage: renderer, scene, the 45° camera and a render() that outlines and palettises.
 * The canvas goes into `parent`, shown at the largest whole-number scale that fits the window
 * (unless autoFit is false: the game fits it with its interface).
 *
 * size(w, h, outW, outH): the picture w × h pixels, shown on a canvas of outW × outH device pixels.
 * The last pass scales it up sharp-bilinear: each pixel a solid square, and where a scale that isn't
 * a whole number puts a pixel's edge inside a screen pixel, that one screen pixel blends the two. So
 * every pixel shows the same size at any scale (nearest-neighbour would make some a screen pixel
 * wider than others, and they'd crawl as the camera moves), and a whole-number scale is exact.
 *
 * dispose() frees it, its WebGL context with it.
 *
 * setWeather(o) (src/render/view.js, each frame; nothing set, no weather): rain, snow and dust
 * falling ({ rain, snow, dust } 0–1 densities, slant: pixels across a pixel down, t: seconds, cam: the
 * camera's offset in pixels, so what falls stays put in the world as it pans; drop, flake, grit: their
 * colours), splash (rain landing on the ground, 0–1), haze ({ k, far, col, eye: [x, z] }: toward col
 * with distance from the eyes on the ground, from 0.3 of far to far), halos ([[x, y, strength,
 * radius]] in pixels from the bottom left: each lamp's in the wet air). See the header.
 *
 * setFog(texture, x0, z0, w, h, dimK) dims what lies where a ground-plane mask says it's unseen (to dimK of its light): the mask
 * (one channel, 1 seen … 0 unseen) covers x0 … x0 + w, z0 … z0 + h in world metres, and each pixel
 * looks it up at the ground position under it (from the depth buffer: a wall's pixels at its foot, a
 * person's at their feet), dithered between seen and dimmed. setFog(null) turns it off.
 */
export function pixelStage({ background = 0x23252f, outline = true, palette = PALETTE, zoom = 1, res = RES, grade = 0, parent = document.body, autoFit = true } = {}) {
  let W = Math.round(res[0] / zoom), H = Math.round(res[1] / zoom);
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
  if (autoFit) { fit(); addEventListener('resize', fit); }
  parent.appendChild(canvas);
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
  const rtOut = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });   // the finished picture
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
      outline: { value: outline ? 1 : 0 }, grade: { value: grade },
      tFog: { value: null }, fogOn: { value: 0 }, fogBox: { value: new THREE.Vector4(0, 0, 1, 1) }, invVP: { value: new THREE.Matrix4() }, dimK: { value: 0.48 },
      // (the weather: setWeather())
      wxOn: { value: 0 }, wxFall: { value: new THREE.Vector4() }, wxTime: { value: new THREE.Vector4() }, wxDrop: { value: new THREE.Vector3() },
      wxFlake: { value: new THREE.Vector3() }, wxGrit: { value: new THREE.Vector3() }, wxHaze: { value: new THREE.Vector4() }, wxHazeCol: { value: new THREE.Vector3() },
      wxHalo: { value: Array.from({ length: WX_LAMPS }, () => new THREE.Vector4()) },
      // (padded to the shader's 128: three uploads the array at the declared size)
      pal: { value: Array.from({ length: 128 }, (_, i) => { const c = pal[Math.min(i, pal.length - 1)]; return new THREE.Vector3(c.r, c.g, c.b); }) },
      count: { value: Math.min(pal.length, 128) },
    },
    vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      in vec2 vUv; out vec4 outColor;
      uniform sampler2D tColor, tDepth, tId, tFog; uniform vec2 res; uniform float near, far, outline, grade, fogOn;
      uniform vec3 pal[128]; uniform int count; uniform vec4 fogBox; uniform mat4 invVP; uniform float dimK;
      uniform float wxOn; uniform vec4 wxFall, wxTime, wxHaze; uniform vec3 wxDrop, wxFlake, wxGrit, wxHazeCol; uniform vec4 wxHalo[${WX_LAMPS}];
      float wxh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      // A layer of streaks (rain; dust, turned on its side): a streak of len px in cells of cw × ch,
      // one cell in 1/dens holding one, falling at v px a second along (slant, 1).
      float streaks(vec2 p, float t, float slant, vec2 cell, float len, float v, float dens, float seed) {
        vec2 q = vec2(p.x - slant * p.y, p.y - t * v);
        float col = floor(q.x / cell.x);
        q.y += wxh(vec2(col, seed)) * cell.y * 13.0;
        float row = floor(q.y / cell.y);
        if (wxh(vec2(col, row) + seed) > dens) return 0.0;
        if (floor(q.x - col * cell.x) != floor(wxh(vec2(row, col) + seed * 1.7) * (cell.x - 1.0))) return 0.0;
        float y = q.y - row * cell.y, y0 = floor(wxh(vec2(col * 1.3, row) + seed * 2.1) * (cell.y - len));
        return y >= y0 && y < y0 + len ? 1.0 - 0.5 * (y - y0) / len : 0.0;
      }
      // A layer of flakes: one of size px in cells of c px, falling at v along (slant, 1), swaying.
      float flakes(vec2 p, float t, float slant, float c, float size, float v, float dens, float seed) {
        vec2 q = vec2(p.x - slant * p.y, p.y - t * v), k = floor(q / c);
        float h = wxh(k + seed);
        if (h > dens) return 0.0;
        vec2 o = floor(vec2(wxh(k + seed + 3.1), wxh(k + seed + 7.7)) * (c - size - 4.0)) + 2.0;
        o.x += floor(sin(t * (0.8 + 1.6 * h) + h * 40.0) * 1.6 + 0.5);
        vec2 d = floor(q - k * c) - o;
        return d.x >= 0.0 && d.x < size && d.y >= 0.0 && d.y < size ? 1.0 : 0.0;
      }
      float lin(float d) { return near + d * (far - near); }
      // A 4 × 4 ordered dither: the threshold for this pixel.
      float bayer(vec2 p) {
        int i = int(mod(p.x, 4.0)) + 4 * int(mod(p.y, 4.0));
        float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        return (m[i] + 0.5) / 16.0;
      }
      // Unseen: darker, greyer, a little cold, as a memory of the place; at night much darker (dimK).
      vec3 dim(vec3 c) {
        float l = dot(c, vec3(0.30, 0.59, 0.11));
        return mix(vec3(l), c, 0.3) * dimK + vec3(0.010, 0.016, 0.032) * dimK / 0.48;
      }
      vec3 nearest(vec3 c) {
        vec3 best = pal[0]; float bd = 1e9;
        for (int i = 0; i < 128; i++) {
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
        float raw = texture(tDepth, uv).r;
        float d = lin(raw);
        vec4 w4 = invVP * vec4(uv * 2.0 - 1.0, raw * 2.0 - 1.0, 1.0);
        vec3 wp = w4.xyz / w4.w;                                     // (the world under the pixel)
        bool unseen = false;
        if (fogOn > 0.5 && raw < 0.99999) {
          float v = texture(tFog, (wp.xz - fogBox.xy) / fogBox.zw).r;
          if (v < bayer(gl_FragCoord.xy)) { col = dim(col); unseen = true; }
        }
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
        if (wxOn > 0.5) {
          // The weather in the air: haze by distance on the ground from the eyes, and the lamps' halos in it.
          // (dithered, as the palette would band a smooth one into rings; what the eyes don't take in is
          // the haze's, near or far: in a fog what you can't see is fog, not the dark)
          if (wxHaze.x > 0.0) {
            float dist = raw < 0.99999 ? distance(wp.xz, wxHaze.zw) : 1e3;
            float f = wxHaze.x * (smoothstep(wxHaze.y * 0.3, wxHaze.y, dist) * 0.88 + 0.12);
            if (unseen) f = max(f, wxHaze.x * 0.8);
            col = mix(col, wxHazeCol, clamp(f + (bayer(gl_FragCoord.xy) - 0.5) * 0.16, 0.0, 1.0));
          }
          for (int i = 0; i < ${WX_LAMPS}; i++) {
            vec4 L = wxHalo[i];
            if (L.z <= 0.0) continue;
            vec2 dd = gl_FragCoord.xy - L.xy;
            col += vec3(0.91, 0.72, 0.29) * L.z * exp(-dot(dd, dd) / (L.w * L.w));
          }
          // What falls, in pixels pinned to the world (wxTime.zw: the camera's offset, so it stays put as the camera pans).
          vec2 p = vec2(floor(gl_FragCoord.x), floor(res.y - gl_FragCoord.y)) + wxTime.zw;
          float t = wxTime.x, slant = wxTime.y;
          if (wxFall.x > 0.0) {
            float a = max(streaks(p, t, slant, vec2(9.0, 34.0), 4.0 + 5.0 * wxFall.x, 380.0, 0.08 + 0.55 * wxFall.x, 1.0),
                          0.7 * streaks(p, t, slant * 0.8, vec2(6.0, 23.0), 3.0 + 2.0 * wxFall.x, 270.0, 0.08 + 0.5 * wxFall.x, 2.0));
            col = mix(col, max(col * 1.35 + 0.05, wxDrop), 0.6 * a);
          }
          if (wxFall.y > 0.0) {
            float a = max(flakes(p, t, slant, 15.0, 2.0, 42.0, 0.05 + 0.55 * wxFall.y, 3.0), 0.75 * flakes(p, t, slant * 0.8, 9.0, 1.0, 28.0, 0.06 + 0.6 * wxFall.y, 4.0));
            col = mix(col, max(col * 1.3 + 0.12, wxFlake), 0.9 * a);
          }
          if (wxFall.z > 0.0) {
            float a = streaks(p.yx, t, 0.15, vec2(5.0, 30.0), 3.0, 140.0 * sign(slant + 1e-3), 0.1 + 0.5 * wxFall.z, 5.0);
            col = mix(col, wxGrit, 0.5 * a);
          }
          // Rain landing: a spark on the wet ground, a moment, here and there (cells of a quarter metre).
          if (wxFall.w > 0.0 && raw < 0.99999 && wp.y < 0.15) {
            vec2 c = floor(wp.xz * 4.0);
            float h = wxh(c + 9.0), ph = t * (2.0 + 2.0 * h) + h * 10.0;
            if (fract(ph) < 0.14 && wxh(c + floor(ph) * 0.37) < wxFall.w) {
              vec2 o = floor(fract(wp.xz * 4.0) * 4.0);
              if (o.y == 1.0 && (o.x == 1.0 || o.x == 2.0)) col = max(col * 1.4 + 0.08, wxDrop * 0.9);
            }
          }
        }
        if (grade > 0.0) {
          // A warm grade (the fine look): light a touch warmer, colour a touch muted, shadows toward violet.
          float l = dot(col, vec3(0.30, 0.59, 0.11));
          col = mix(col, vec3(l), 0.18 * grade) * mix(vec3(1.0), vec3(1.05, 1.0, 0.9), grade);
          col += grade * max(0.0, 0.35 - l) * vec3(0.03, -0.01, 0.05);
        }
        outColor = vec4(nearest(col), 1.0);
      }`,
  }));
  const post = new THREE.Scene();
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = quad.material.uniforms;
  // The finished picture onto the canvas, sharp-bilinear (scale: screen pixels a picture pixel).
  const blit = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    uniforms: { tPic: { value: rtOut.texture }, res: { value: new THREE.Vector2(W, H) }, scale: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      in vec2 vUv; out vec4 outColor;
      uniform sampler2D tPic; uniform vec2 res, scale;
      void main() {
        vec2 t = vUv * res, c = fract(t) - 0.5, edge = 0.5 - 0.5 / max(scale, vec2(1.0));
        vec2 f = (c - clamp(c, -edge, edge)) * scale + 0.5;           // (0.5, the pixel's own colour, but at its edge)
        outColor = texture(tPic, (floor(t) + f) / res);
      }`,
  }));
  const out = new THREE.Scene();
  out.add(blit);
  let outW = W, outH = H;
  const size = (w, h, ow = w, oh = h) => {
    W = w; H = h; outW = ow; outH = oh;
    for (const t of [rt, rtId, rtOut]) t.setSize(W, H);
    Object.assign(rt.depthTexture.image, { width: W, height: H });
    Object.assign(camera, { left: -W / PX_PER_M / 2, right: W / PX_PER_M / 2, top: H / PX_PER_M * s45 / 2, bottom: -H / PX_PER_M * s45 / 2 });
    camera.updateProjectionMatrix();
    U.res.value.set(W, H);
    blit.material.uniforms.res.value.set(W, H);
    blit.material.uniforms.scale.value.set(outW / W, outH / H);
    renderer.setSize(outW, outH, false);
  };
  const setFog = (tex, x0 = 0, z0 = 0, w = 1, h = 1, dimK = 0.48) => { U.tFog.value = tex; U.fogOn.value = tex ? 1 : 0; U.fogBox.value.set(x0, z0, w, h); U.dimK.value = dimK; };
  const setWeather = (o = null) => {
    U.wxOn.value = o ? 1 : 0;
    if (!o) return;
    U.wxFall.value.set(o.rain ?? 0, o.snow ?? 0, o.dust ?? 0, o.splash ?? 0);
    U.wxTime.value.set(o.t ?? 0, o.slant ?? 0, o.cam?.[0] ?? 0, o.cam?.[1] ?? 0);
    if (o.drop) U.wxDrop.value.set(...o.drop);
    if (o.flake) U.wxFlake.value.set(...o.flake);
    if (o.grit) U.wxGrit.value.set(...o.grit);
    const hz = o.haze;
    U.wxHaze.value.set(hz?.k ?? 0, hz?.far ?? 1, hz?.eye?.[0] ?? 0, hz?.eye?.[1] ?? 0);
    if (hz?.col) U.wxHazeCol.value.set(...hz.col);
    U.wxHalo.value.forEach((v, i) => { const h = o.halos?.[i]; if (h) v.set(h[0], h[1], h[2], h[3]); else v.set(0, 0, 0, 1); });
  };
  const render = () => {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    U.invVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
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
    renderer.setRenderTarget(rtOut);
    renderer.render(post, postCam);
    renderer.setRenderTarget(null);
    renderer.render(out, postCam);
  };
  // Done with it: its targets freed and its WebGL context given back at once (a browser keeps 16 or
  // so; left to the garbage collector, a seventeenth new game lost the oldest's).
  const dispose = () => {
    for (const t of [rt, rtId, rtOut]) t.dispose();
    rt.depthTexture.dispose();
    for (const m of [quad, blit]) { m.geometry.dispose(); m.material.dispose(); }
    for (const m of idMats.values()) m.dispose();
    sun.shadow.map?.dispose();
    if (autoFit) removeEventListener('resize', fit);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
  return { THREE, renderer, scene, camera, sun, hemi, look, render, setFog, setWeather, size, dispose, get W() { return W; }, get H() { return H; }, lightAt: null };
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
  // Sprites aren't lit by the scene's lights: lightAt(x, z) is the light a sprite standing there takes,
  // what a front face gets from the night sky and the moon, plus the pools it stands in (world space).
  const pools = [];
  stage.scene.traverse(o => { if (o.userData.pool) { const p = o.userData.pool, w = o.localToWorld(new THREE.Vector3(p.x, 0, p.z)); pools.push({ ...p, x: w.x, z: w.z, c: new THREE.Color(p.color) }); } });
  const night = new THREE.Color().setRGB(0.061, 0.118, 0.193);   // linear
  stage.lightAt = (x, z, out = new THREE.Color()) => {
    out.copy(night);
    for (const p of pools) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) out.add(p.c.clone().multiplyScalar(p.core + p.ring));
      else if (d < p.r * 1.5) out.add(p.c.clone().multiplyScalar(p.ring));
    }
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

const emissives = new WeakMap();
/**
 * A painted texture's glow at night: an emissive map holding only its GLOWS pixels (a lit window, a
 * sign's letters), the rest black; null when nothing in it glows. Made once a texture, from where
 * paint() found its glowing colours (userData.glowRuns), not by reading the texture back.
 */
export function emissiveOf(tex) {
  if (emissives.has(tex)) return emissives.get(tex);
  const runs = tex.userData.glowRuns ?? [], lit = (tex.userData.glows ?? []).map(rgba);
  const src = tex.image, cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const img = new ImageData(cv.width, cv.height), u32 = new Uint32Array(img.data.buffer);
  u32.fill(0xff000000);                                          // (black, opaque: only its colour is read)
  for (let j = 0; j < runs.length; j += 3) u32.fill(lit[runs[j + 2]], runs[j], runs[j + 1]);
  const any = runs.length > 0;
  delete tex.userData.glowRuns;                                  // (kept with the result from here on)
  let out = null;
  if (any) {
    cv.getContext('2d').putImageData(img, 0, 0);
    out = new THREE.CanvasTexture(cv);
    out.magFilter = out.minFilter = THREE.NearestFilter;
    out.generateMipmaps = false;
    out.colorSpace = THREE.SRGBColorSpace;
    out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
  }
  emissives.set(tex, out);
  return out;
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
  g.userData.pool = { x: x + aim[0], z: z + aim[1], r, core, ring, color };   // for sprites (lightAt)
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

// ---------- the weather on lit surfaces ----------

export const WX_LAMPS = 10;
/**
 * The weather on every lit surface (mat()), set by the view each frame: wxCover snow lying (0–1.5),
 * wxRime (a frost, 0–1), wxWet (0–1), wxPuddles (0–1: how much of the wet ground stands in water),
 * wxSky (what wet ground mirrors, linear), wxRoad (the roads' z bands: [z0, z1, z0, z1], where snow
 * is churned to slush), wxLamps (the lamps the wet ground mirrors: x, z, strength, their heads' height).
 */
export const WX = {
  wxCover: { value: 0 }, wxRime: { value: 0 }, wxWet: { value: 0 }, wxPuddles: { value: 0 }, wxSky: { value: new THREE.Color(0, 0, 0) },
  wxRoad: { value: new THREE.Vector4(1e9, 1e9, 1e9, 1e9) }, wxLamps: { value: Array.from({ length: WX_LAMPS }, () => new THREE.Vector4()) },
};
const WX_GLSL = /* glsl */`
  varying vec3 vWxPos;
  varying float vWxUp;
  uniform float wxCover, wxRime, wxWet, wxPuddles;
  uniform vec3 wxSky;
  uniform vec4 wxRoad;
  uniform vec4 wxLamps[${WX_LAMPS}];
  float wxHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float wxNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wxHash(i), wxHash(i + vec2(1, 0)), f.x), mix(wxHash(i + vec2(0, 1)), wxHash(i + vec2(1, 1)), f.x), f.y);
  }`;
// Snow, by what it lies on (linear): fresh on roofs, pavements and lawns; churned on the roads.
const SNOW = [0.8, 0.83, 0.88], SLUSH = [0.5, 0.48, 0.46];
const wxPatch = (shader) => {
  Object.assign(shader.uniforms, WX);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n  varying vec3 vWxPos;\n  varying float vWxUp;')
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 wxW = vec4(transformed, 1.0);
      vec3 wxN = objectNormal;
      #ifdef USE_INSTANCING
        wxW = instanceMatrix * wxW; wxN = mat3(instanceMatrix) * wxN;
      #endif
      vWxPos = (modelMatrix * wxW).xyz;
      vWxUp = normalize(mat3(modelMatrix) * wxN).y;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>${WX_GLSL}`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      float wxPuddle = 0.0, wxRim = 0.0;
      bool wxGround = vWxPos.y < 0.15 && vWxUp > 0.9;
      bool wxOnRoad = wxGround && ((vWxPos.z > wxRoad.x && vWxPos.z < wxRoad.y) || (vWxPos.z > wxRoad.z && vWxPos.z < wxRoad.w));
      if (wxRime > 0.0 && vWxUp > 0.55) {
        // A frost: what faces up silvered (the roads, driven on, less), a glint here and there.
        float k = wxRime * (wxOnRoad ? 0.45 : vWxPos.y > 0.3 ? 1.0 : 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.78, 0.86), 0.4 * k);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), k * step(0.982, wxHash(floor(vWxPos.xz * 8.0) + 0.5)));
      }
      if (wxCover > 0.0 || wxWet > 0.0) {
        vec2 g = vWxPos.xz;
        // The wet: darker, what faces up most; puddles in the ground's low spots.
        diffuseColor.rgb *= 1.0 - 0.38 * wxWet * (vWxUp > 0.6 ? 1.0 : 0.35);
        if (wxGround && wxPuddles > 0.0) {
          // (their far edge catches the light: a rim where the ground just north of here is dry)
          float th = 1.0 - 0.26 * wxPuddles;
          wxPuddle = step(th, wxNoise(g * 0.8) * 0.7 + wxNoise(g * 2.6) * 0.3);
          vec2 gn = g - vec2(0.0, 0.07);
          wxRim = wxPuddle * (1.0 - step(th, wxNoise(gn * 0.8) * 0.7 + wxNoise(gn * 2.6) * 0.3));
          diffuseColor.rgb *= 1.0 - 0.55 * wxPuddle;
        }
        // Snow lying on what faces up: roofs and ledges first, pavements in drifts, the roads churned.
        if (wxCover > 0.0 && vWxUp > 0.55) {
          bool road = wxOnRoad;
          float c = wxCover * (vWxPos.y > 0.3 ? 1.5 : road ? 0.9 : 1.0) * 1.3 - 0.12;
          float n = wxNoise(g * 1.3) * 0.6 + wxNoise(g * 4.7) * 0.4;
          float lie = smoothstep(n - 0.05, n + 0.05, c);
          diffuseColor.rgb = mix(diffuseColor.rgb, road ? vec3(${SLUSH}) : vec3(${SNOW}), lie);
          wxPuddle *= 1.0 - lie; wxRim *= 1.0 - lie;
        }
      }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (wxGround && wxWet > 0.3) {
        // What wet ground mirrors: the sky, and each lamp's head, in a rippled streak toward the camera
        // (a head h up is mirrored h further south, as the camera looks down at 45°).
        totalEmissiveRadiance += wxSky * (0.12 * wxWet + 0.55 * wxPuddle + 1.2 * wxRim);
        for (int i = 0; i < ${WX_LAMPS}; i++) {
          vec4 L = wxLamps[i];
          if (L.z <= 0.0) continue;
          vec2 d = vWxPos.xz - vec2(L.x, L.y + L.w);
          float streak = exp(-d.x * d.x / 0.02) * (1.0 - smoothstep(0.3, 1.3, abs(d.y)));
          float ripple = 0.55 + 0.45 * step(0.45, wxHash(vec2(floor(vWxPos.z * 9.0), floor(vWxPos.x * 4.0))));
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.16) * L.z * streak * ripple * (0.35 * wxWet + 0.9 * wxPuddle);
        }
      }`);
};

const mats = new Map();
// (a toon material with the weather in it: every one shares the patch, so one program as before)
const toon = (opts) => { const m = new THREE.MeshToonMaterial(opts); m.onBeforeCompile = wxPatch; m.customProgramCacheKey = () => 'wx1'; return m; };
/** A toon material: a flat colour, or a painted texture (shared when it's just a colour). */
export function mat(color, map = null) {
  if (map) return toon({ color: 0xffffff, map, gradientMap: RAMP });
  if (!mats.has(color)) mats.set(color, toon({ color, gradientMap: RAMP }));
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
 * px(x, y, w, h, colour) filling pixels, y from the top (a negative w or h runs left or up, as a
 * canvas's fillRect does; what's off the texture is left out). `repeat` makes it tile; `glows` lists
 * the colours that light up at night.
 *
 * The pixels go into a typed array, a store each, and onto the canvas in one putImageData: a
 * fillRect a pixel, with a CSS colour string to parse each time, made a street's paint 25–85 ms. The
 * glowing pixels are found in that array as it's finished (glowRuns), so emissiveOf() never has to
 * read the canvas back from the GPU.
 */
export function paint(w, h, draw, { repeat = false, glows = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const img = new ImageData(w, h), u32 = new Uint32Array(img.data.buffer);
  let lastC = null, lastV = 0;
  draw((x, y, ww = 1, hh = 1, c = 0x14151c) => {
    if (ww < 0) { x += ww; ww = -ww; }
    if (hh < 0) { y += hh; hh = -hh; }
    const x0 = Math.max(0, x), x1 = Math.min(w, x + ww), y0 = Math.max(0, y), y1 = Math.min(h, y + hh);
    if (!(x1 > x0 && y1 > y0)) return;
    if (c !== lastC) { lastC = c; lastV = rgba(c); }
    for (let yy = y0; yy < y1; yy++) u32.fill(lastV, yy * w + x0, yy * w + x1);
  }, w, h);
  cv.getContext('2d').putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.size = [w / PX_PER_M, h / PX_PER_M];             // metres one copy covers
  t.userData.glows = glows;
  if (glows) t.userData.glowRuns = glowRuns(u32, glows.map(rgba));
  return t;
}
// A colour 0xrrggbb as the little-endian RGBA word an ImageData's Uint32Array holds, opaque.
function rgba(c) { return (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >>> 16) & 0xff)) >>> 0; }
// Where in a painted texture its glowing colours are: runs [start, end, which glow] of pixel indices.
function glowRuns(u32, lit) {
  const runs = [];
  for (let i = 0; i < u32.length;) {
    const k = lit.indexOf(u32[i]);
    if (k < 0) { i++; continue; }
    const s = i;
    while (++i < u32.length && u32[i] === lit[k]);
    runs.push(s, i, k);
  }
  return runs;
}

/**
 * A repeating pixel texture of m metres square, by kind: grass, cobble, asphalt, brick, plaster, roof, planks, leaves, gravel, water,
 * awning; in the fine finish also the pavements (slabs, squares, granite, pavers, tarmac), the lanes' (patched, roadslabs,
 * concrete, dirt) and the winter's flower beds (kale, boughs, stalks).
 */
export function tile(kind, m = 1) {
  const n = PX_PER_M * m;
  const r = rng(kind.length * 977 + m * 131);
  if (finish.fine && FINE_TILES[kind]) return paint(n, n, (px) => FINE_TILES[kind](px, n, r), { repeat: true });
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
      case 'gravel':
        px(0, 0, n, n, 0xc4bba9);
        speckle([0xa0978a, 0xe2dac6, 0x7d756c], 0.12);
        break;
      case 'water':
        px(0, 0, n, n, 0x283f6b);
        for (let i = 0; i < n * n / 24; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); px(x, y, 3, 1, r() < 0.7 ? 0x3b6296 : 0x5d8fc2); }
        break;
      case 'awning':
        for (let x = 0; x < n; x++) px(x, 0, 1, n, Math.floor(x / 4) % 2 ? 0xf6f4ee : 0x9e3c36);
        break;
      default:
        px(0, 0, n, n, 0xff00ff);
    }
  }, { repeat: true });
}

// The fine finish of the same tiles: more tones, each brick, slab and tile bevelled (lit along the
// top, in shade along the bottom and right), surfaces mottled with noise. They tile: patterns run in
// whole periods of n.
/** Bricks in half bond, w × 3 each, bevelled and varied, in mortar; over x0, y0, ww × hh of px. */
export function fineBricks(px, x0, y0, ww, hh, base, r) {
  px(x0, y0, ww, hh, tone(base, -0.24));                         // mortar, in shadow
  for (let j = 0; j < hh; j += 4) for (let i = ((j / 4) % 2) * 4 - 4; i < ww; i += 8) {
    const a = Math.max(0, i), b = Math.min(ww, i + 7), h = Math.min(3, hh - j);
    if (b <= a) continue;
    const k = r(), d = k < 0.08 ? -0.12 : k < 0.14 ? 0.07 : [-0.05, -0.02, 0, 0.03][Math.floor(r() * 4)];
    px(x0 + a, y0 + j, b - a, h, tone(base, d));
    px(x0 + a, y0 + j, b - a, 1, tone(base, d + 0.06));          // the lit top
    if (h === 3) px(x0 + a, y0 + j + 2, b - a, 1, tone(base, d - 0.06));
    if (b === i + 7) px(x0 + b - 1, y0 + j + 1, 1, h - 1, tone(base, d - 0.06));
    if (r() < 0.35) px(x0 + a + Math.floor(r() * (b - a)), y0 + j + 1, 1, 1, tone(base, d - 0.04));
  }
}
const FINE_TILES = {
  brick: (px, n, r) => fineBricks(px, 0, 0, n, n, 0x9e3c36, r),
  plaster(px, n, r) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = noise(x / 5, y / 5, 3) * 0.6 + noise(x / 2, y / 2, 4) * 0.4;
      px(x, y, 1, 1, tone(0xe2dac6, v < 0.32 ? -0.05 : v > 0.7 ? 0.02 : -0.02));
    }
  },
  roof(px, n, r) {                                               // tiles in rows, each its own tone
    const base = 0x9e3c36;
    for (let y = 0; y < n; y += 4) for (let x = (y / 4) % 2 * 2 - 4; x < n; x += 4) {
      const d = (r() - 0.5) * 0.08;
      px(x, y, 4, 4, tone(base, d)); px(x, y, 4, 1, tone(base, d + 0.07));
      px(x + 3, y, 1, 4, tone(base, d - 0.08)); px(x, y + 3, 4, 1, tone(base, d - 0.14));
    }
  },
  cobble(px, n, r) {                                             // setts, bevelled, dark joints
    px(0, 0, n, n, 0x5c5650);
    for (let y = 0; y < n; y += 4) for (let x = (y / 4) % 2 * 2 - 4; x < n; x += 4) {
      const d = (r() - 0.5) * 0.1, c = 0xa0978a;
      px(x, y, 3, 3, tone(c, d)); px(x, y, 3, 1, tone(c, d + 0.07)); px(x + 2, y + 1, 1, 2, tone(c, d - 0.07));
    }
  },
  planks(px, n, r) {
    for (let x = 0; x < n; x += 4) {
      const d = (r() - 0.5) * 0.08;
      px(x, 0, 4, n, tone(0x8f6345, d)); px(x, 0, 1, n, tone(0x8f6345, d + 0.06)); px(x + 3, 0, 1, n, tone(0x8f6345, -0.16));
      for (let k = 0; k < 3; k++) px(x + 1 + Math.floor(r() * 2), Math.floor(r() * n), 1, 2 + Math.floor(r() * 4), tone(0x8f6345, d - 0.05));   // grain
    }
  },
  asphalt(px, n, r) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = noise(x / 3, y / 3, 9);
      px(x, y, 1, 1, tone(0x4c5262, v < 0.3 ? -0.04 : v > 0.72 ? 0.03 : 0));
    }
  },
  gravel(px, n, r) {                                             // packed sand and fine stones, a boulevard's path
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = noise(x / 3, y / 3, 12);
      px(x, y, 1, 1, tone(0xc4b08a, v < 0.3 ? -0.05 : v > 0.7 ? 0.02 : -0.02));
    }
    for (let i = 0; i < n * n / 7; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n), d = r(); px(x, y, 1, 1, tone(0xc4b08a, d < 0.5 ? -0.12 : d < 0.8 ? 0.06 : -0.2)); }
  },
  water(px, n, r) {                                              // a pond: deep, a slow ripple, a glint here and there
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = noise(x / 6, y / 2.5, 21);
      px(x, y, 1, 1, tone(0x283f6b, v < 0.3 ? -0.05 : v > 0.72 ? 0.05 : 0));
    }
    for (let i = 0; i < n * n / 40; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n), w = 2 + Math.floor(r() * 3); px(x, y, w, 1, r() < 0.75 ? tone(0x3b6296, -0.02) : 0x5d8fc2); }
  },
  grass(px, n, r) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = noise(x / 4, y / 4, 6);
      px(x, y, 1, 1, tone(0x4f8f45, v < 0.35 ? -0.07 : v > 0.68 ? 0.04 : -0.02));
    }
    for (let i = 0; i < n * n / 30; i++) { const x = Math.floor(r() * n), y = 1 + Math.floor(r() * (n - 2)); px(x, y + 1, 1, 1, tone(0x4f8f45, -0.12)); px(x, y, 1, 1, tone(0x4f8f45, 0.08)); }
  },
  // Pavements as tiles (a side street's walks: the street's own makes, sim LOOKS.pave), and the
  // lanes' and alleys' surfaces; each in whole periods of its tile.
  slabs: (px, n, r) => stones(px, n, 12, 10, 6, 0xc4bba9, r),     // (3.75 m: 5 slabs by 6 rows)
  squares: (px, n, r) => stones(px, n, 8, 8, 0, 0xb8b0a4, r),
  granite: (px, n, r) => stones(px, n, 16, 12, 8, 0xb4a296, r, true),
  pavers: (px, n, r) => stones(px, n, 8, 4, 4, 0xa8a49c, r),
  york: (px, n, r) => stones(px, n, 24, 12, 12, 0xb2aa9a, r),      // York stone flags (a lane's walks, London's)
  pcc: (px, n, r) => stones(px, n, 16, 12, 8, 0xa8a6a0, r),        // concrete flags
  terrazzo: (px, n, r) => stones(px, n, 8, 8, 0, 0xb8ae9c, r),     // cement tiles (Cairo's, Beirut's walks)
  broken: (px, n, r) => stones(px, n, 16, 12, 8, 0xaca69c, r),
  roadslabs: (px, n, r) => stones(px, n, 24, 24, 12, 0x8f96a6, r),   // a road of concrete slabs, 1.5 m
  concrete(px, n, r) {                                           // concrete slabs, grass in the joints
    stones(px, n, 24, 24, 0, 0xa8a49c, r);
    for (let i = 0; i < n; i += 24) for (let k = 0; k < n; k++) if (r() < 0.35) { px(i + 23, k, 1, 1, tone(0x4f8f45, -0.05)); px(k, i + 23, 1, 1, tone(0x4f8f45, r() < 0.5 ? -0.05 : 0.03)); }
  },
  tarmac(px, n, r) {                                             // a pavement's tarmac: warmer than a road's, patched
    const base = 0x5f5e63;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = r(); px(x, y, 1, 1, k < 0.08 ? tone(base, -0.05) : k > 0.95 ? tone(base, 0.04) : base); }
    for (let i = 0; i < 2; i++) { const w = 8 + Math.floor(r() * 12), h = 4 + Math.floor(r() * 5), x = Math.floor(r() * (n - w)), y = Math.floor(r() * (n - h)); px(x, y, w, h, tone(base, -0.04)); px(x, y, w, 1, tone(base, 0.03)); }
  },
  patched(px, n, r) {                                            // a lane's asphalt, patch on patch (a 6 m tile: the patches don't beat)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = r(); px(x, y, 1, 1, k < 0.07 ? tone(0x4c5262, -0.05) : k > 0.95 ? tone(0x4c5262, 0.04) : 0x4c5262); }
    for (let i = 0; i < 6; i++) {
      const w = 10 + Math.floor(r() * 24), h = 6 + Math.floor(r() * 18), x = Math.floor(r() * (n - w)), y = Math.floor(r() * (n - h)), d = r() < 0.5 ? -0.045 : 0.035;
      px(x, y, w, h, tone(0x4c5262, d)); if (r() < 0.6) { px(x, y, w, 1, tone(0x4c5262, d + 0.05)); px(x, y + h - 1, w, 1, tone(0x4c5262, d - 0.05)); }
      for (let k = 0; k < (w * h) / 30; k++) px(x + Math.floor(r() * w), y + Math.floor(r() * h), 1, 1, tone(0x4c5262, d - 0.04));
    }
    for (let k = 0; k < 4; k++) { let cx = Math.floor(r() * n), cy = Math.floor(r() * n); for (let i = 0; i < 12 + r() * 14; i++) { px(cx % n, cy % n, 1, 1, tone(0x4c5262, -0.1)); cx++; cy += r() < 0.35 ? (r() < 0.5 ? n - 1 : 1) : 0; } }
  },
  dirt(px, n, r) {                                               // packed earth, gravel in it, a puddle's dark
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = tnoise(x / 4, y / 4, n / 4, 17) * 0.7 + tnoise(x / 2, y / 2, n / 2, 18) * 0.3; px(x, y, 1, 1, v < 0.28 ? tone(0x6b4636, -0.04) : v > 0.7 ? tone(0x8f6345, 0.02) : tone(0x7d6450, 0)); }
    for (let i = 0; i < n * n / 14; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); px(x, y, 1, 1, r() < 0.6 ? 0xa0978a : 0x5c5650); }
  },
  kale(px, n, r) {                                               // ornamental cabbages, November's bed: rosettes on dark soil
    px(0, 0, n, n, 0x47302a);
    for (let i = 0; i < n * n / 6; i++) px(Math.floor(r() * n), Math.floor(r() * n), 1, 1, 0x2a1c18);
    for (let y = 0; y < n; y += 8) for (let x = (y / 8) % 2 * 4; x < n; x += 8) {
      const heart = r() < 0.5 ? [0x7a4a86, 0xc95c8a] : [0xe2dac6, 0xf6f4ee];
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const d = Math.hypot(i, j * 1.2);
        if (d > 3.4) continue;
        px((x + i + n) % n, (y + j + n) % n, 1, 1, d < 1.3 ? heart[1] : d < 2.2 ? heart[0] : (i + j) % 2 ? 0x2f6b62 : 0x76a08a);
      }
    }
  },
  boughs(px, n, r) {                                             // spruce boughs laid over a bed for the winter
    px(0, 0, n, n, 0x47302a);
    for (let k = 0; k < 9; k++) {
      const x0 = Math.floor(r() * n), y0 = Math.floor(r() * n), len = 7 + Math.floor(r() * 6), dir = r() < 0.5 ? 1 : -1;
      for (let t = 0; t < len; t++) { const x = (x0 + t + n) % n, y = (y0 + Math.round(t * 0.5 * dir) + n) % n; px(x, y, 1, 1, 0x47302a); px(x, (y + 1) % n, 1, 1, 0x24503a); px(x, (y + n - 1) % n, 1, 1, t % 2 ? 0x356f42 : 0x173327); }
    }
  },
  stalks(px, n, r) {                                             // a bed cut back: straw, dead stalks
    px(0, 0, n, n, 0x47302a);
    for (let i = 0; i < n * n / 5; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); px(x, y, 2, 1, r() < 0.6 ? 0xb48459 : 0x8f6345); }
    for (let i = 0; i < n * n / 30; i++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); px(x, y, 1, 2, 0x6b4636); }
  },
};
/** Stones (slabs, setts, pavers) pw × ph in courses shifted by `shift`, bevelled, over a tile n square. */
function stones(px, n, pw, ph, shift, base, r, grain = false) {
  px(0, 0, n, n, tone(base, -0.15));                             // the joints
  for (let j = 0, row = 0; j < n; j += ph, row++) for (let i = -((row % 2) * shift); i < n; i += pw) {
    const d = (r() - 0.5) * 0.07 + (r() < 0.05 ? -0.05 : 0), w = pw - 1, h = ph - 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xx = (i + x + n) % n, v = noise(xx / 3, (j + y) / 3, 41);
      px(xx, j + y, 1, 1, tone(base, d + (v < 0.25 ? -0.03 : v > 0.8 ? 0.02 : 0)));
    }
    for (let x = 0; x < w; x++) { px((i + x + n) % n, j, 1, 1, tone(base, d + 0.05)); px((i + x + n) % n, j + h - 1, 1, 1, tone(base, d - 0.06)); }
    px((i + n) % n, j, 1, h, tone(base, d + 0.03));
    if (grain) for (let k = 0; k < 6; k++) px((i + 1 + Math.floor(r() * (w - 2)) + n) % n, j + 1 + Math.floor(r() * (h - 2)), 1, 1, tone(base, k % 3 ? -0.08 : 0.06));
    if (r() < 0.25) px((i + w + n) % n, j + Math.floor(r() * h), 1, 1, tone(0x356f42, -0.06));   // moss in a joint
  }
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
  // Digits and the marks English signs use (FISH & CHIPS, No. 12, W11).
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'], 3: ['110', '001', '010', '001', '110'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'], 6: ['011', '100', '110', '101', '010'], 7: ['111', '001', '010', '010', '010'],
  8: ['010', '101', '010', '101', '010'], 9: ['010', '101', '011', '001', '110'],
  '&': ['0100', '1010', '0100', '1011', '0110'], '.': ['0', '0', '0', '0', '1'], ',': ['0', '0', '0', '1', '1'], '-': ['00', '00', '11', '00', '00'],
  '/': ['001', '001', '010', '100', '100'], 'É': ['111', '100', '110', '100', '111'], '!': ['1', '1', '1', '0', '1'],
  // Cyrillic (the letters that look like Latin ones share their shapes)
  А: ['010', '101', '111', '101', '101'], Б: ['111', '100', '110', '101', '110'], В: ['110', '101', '110', '101', '110'],
  Г: ['111', '100', '100', '100', '100'], Д: ['01110', '01010', '01010', '11111', '10001'], Е: ['111', '100', '110', '100', '111'],
  Ж: ['10101', '10101', '01110', '10101', '10101'], З: ['110', '001', '010', '001', '110'], И: ['1001', '1011', '1101', '1001', '1001'],
  Й: ['1101', '1011', '1101', '1001', '1001'], К: ['101', '101', '110', '101', '101'], Л: ['011', '101', '101', '101', '101'],
  М: ['10001', '11011', '10101', '10001', '10001'], Н: ['101', '101', '111', '101', '101'], О: ['010', '101', '101', '101', '010'],
  П: ['111', '101', '101', '101', '101'], Р: ['110', '101', '110', '100', '100'], С: ['011', '100', '100', '100', '011'],
  Т: ['111', '010', '010', '010', '010'], У: ['101', '101', '011', '001', '110'], Ф: ['01110', '10101', '10101', '01110', '00100'],
  Х: ['101', '101', '010', '101', '101'], Ц: ['1010', '1010', '1010', '1111', '0001'], Ч: ['101', '101', '011', '001', '001'],
  Ш: ['10101', '10101', '10101', '10101', '11111'], Щ: ['101010', '101010', '101010', '111111', '000001'], Ъ: ['1100', '0100', '0110', '0101', '0110'],
  Ы: ['10001', '10001', '11001', '10101', '11001'], Ь: ['100', '100', '110', '101', '110'], Э: ['110', '001', '011', '001', '110'],
  Ю: ['10010', '10101', '11101', '10101', '10010'], Я: ['011', '101', '011', '101', '101'],
};
/** Width in pixels of `str` in the pixel font (Arabic in its own: src/art/arabic.js). */
export const textWidth = (str) => (/[\u0600-\u06FF]/.test(str) ? arabicWidth(str) : [...str].reduce((a, ch) => a + (GLYPHS[ch] ?? GLYPHS[' '])[0].length + 1, -1));
/**
 * Write `str` at (x, y) with px(), in colour c: y is the top of a Latin or Cyrillic line (5 rows); an
 * Arabic one is centred on the same line (its 9 rows from y − 2, its baseline at y + 3), right to left.
 */
export function text(px, x, y, str, c) {
  if (/[\u0600-\u06FF]/.test(str)) return arabic(px, x, y - 2, str, c);
  for (const ch of str) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    g.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(x + i, y + j, 1, 1, c); }));
    x += g[0].length + 1;
  }
}
