// TRADECRAFT samples: looks. The same scene, rendered several ways, so a look is picked by seeing it.
//
//   real          as built: PBR materials, ACES tone mapping, the perspective iso camera
//   pixel         3D pixel art: an orthographic camera; colour, depth and normals rendered at a third
//                 of the screen's resolution; toon lighting (four bands); one-pixel outlines where a
//                 surface stands in front of another (darker) and on creases (lighter); colour
//                 quantised with ordered dithering; shown with hard pixel edges
//   pixel-chunky  the same at a fifth of the resolution
//   toon          full resolution: flat colours (each texture averaged to one), three light bands,
//                 bold outlines
//   flat          low-poly toy: one colour per material, faceted shading, soft light, no outlines
//
// applyLook(name, stage, { target }) restyles stage.scene's materials (after the textures have
// loaded: the flat colours are averaged from them) and returns { render, camera }. The pixel looks
// render with their own orthographic camera, framed like stage.camera looking at `target`.
import * as THREE from 'three';

const LOOKS = {
  real: {},
  pixel: { pixel: 3, toon: 4, outline: true, levels: 16, dither: 0.25, saturate: 1.25, stylised: true },
  'pixel-chunky': { pixel: 5, toon: 4, outline: true, levels: 12, dither: 0.3, saturate: 1.3, stylised: true },
  toon: { pixel: 1, toon: 3, flat: true, palette: true, outline: true, outlineWidth: 2, levels: 0, saturate: 1.1, stylised: true },
  flat: { flat: true, palette: true, faceted: true, stylised: true },
};

// A stylised palette for the flat-coloured looks, by material name (texture sets and kit materials):
// averaged photographs come out muddy, and a cartoon needs chosen colours. Anything not listed (the
// people) is its texture's average, lifted and saturated.
const PALETTE = {
  red_brick_03: 0xb5654a, PaintedPlaster017: 0xefe6d6, Concrete034: 0xa9aeb3, Tiles074: 0xdcd4c6,
  WoodFloor051: 0xb7854f, Asphalt033: 0x5a5f66, PavingStones138: 0xcfbf98,
  frame: 0xf2efe6, frame_dark: 0x2c3038, glass: 0x7fa6c0, stone: 0xd9d3c7, door_paint: 0x2f6b4f,
  metal: 0xc9a24a, wood: 0x9a6b42, bark: 0x6b4a33, leaves: 0x6c9a45, iron: 0x2c3038, lantern: 0xffe7a8,
};
export const lookNames = Object.keys(LOOKS);

function gradient(steps) {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = Math.round(95 + 160 * (i / (steps - 1)));          // the darkest band is still a third lit
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, steps, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** A texture's average colour (in sRGB, as seen), from its image shrunk to 8 × 8. */
const averages = new WeakMap();
function average(tex) {
  if (!tex?.image) return null;
  if (averages.has(tex)) return averages.get(tex);
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(tex.image, 0, 0, 8, 8); } catch { return null; }
  const d = g.getImageData(0, 0, 8, 8).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  const col = n ? new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace) : null;
  averages.set(tex, col);
  return col;
}

function restyle(scene, L) {
  const ramp = L.toon ? gradient(L.toon) : null;
  const done = new Map();
  const convert = (m) => {
    if (done.has(m)) return done.get(m);
    let out = m;
    let color = m.color ? m.color.clone() : new THREE.Color(1, 1, 1);
    if (L.palette && PALETTE[m.name] !== undefined) {
      color = new THREE.Color(PALETTE[m.name]);
    } else if (L.flat) {
      const avg = average(m.map);
      if (avg) {
        color.multiply(avg);
        if (L.palette) color.offsetHSL(0, 0.12, 0.08);          // lift what the palette doesn't name
      }
    }
    const common = { color, alphaTest: m.alphaTest, transparent: m.transparent, opacity: m.opacity, side: m.side,
      map: L.flat ? null : m.map, name: m.name };
    if (m.emissive) Object.assign(common, { emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity ?? 1 });
    if (m.alphaTest > 0 && L.flat) common.map = m.map;        // cut-outs (hair) keep their alpha
    if (ramp) out = new THREE.MeshToonMaterial({ ...common, gradientMap: ramp });
    else if (L.faceted) out = new THREE.MeshStandardMaterial({ ...common, roughness: 0.92, metalness: 0, flatShading: true });
    if (out !== m && m.alphaToCoverage) out.alphaToCoverage = true;
    done.set(m, out);
    return out;
  };
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
  });
}

const VERT = `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor, tDepth, tNormal;
uniform vec2 res;
uniform float near, far, ortho, levels, dither, width, outline, saturate;
float lin(float d) { return ortho > 0.5 ? near + d * (far - near) : (near * far) / (far - d * (far - near)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[y * 4 + x]) + 0.5) / 16.0;
}
void main() {
  vec2 px = 1.0 / res;
  vec2 cell = floor(vUv * res);
  vec2 uv = (cell + 0.5) * px;
  vec3 col = texture(tColor, uv).rgb;
  float d = lin(texture(tDepth, uv).r);
  vec3 n = texture(tNormal, uv).rgb * 2.0 - 1.0;
  if (outline > 0.5) {
    float front = 0.0, crease = 0.0;
    vec2 offs[4] = vec2[4](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1));
    for (int i = 0; i < 4; i++) {
      vec2 o = uv + offs[i] * px * width;
      float dn = lin(texture(tDepth, o).r);
      vec3 nn = texture(tNormal, o).rgb * 2.0 - 1.0;
      front += clamp(dn - d - 0.25, 0.0, 1.0);                         // a neighbour well behind: our silhouette
      if (abs(dn - d) < 0.25) crease += clamp(dot(n - nn, vec3(0.6, 0.6, 0.53)), 0.0, 1.0);   // a fold facing the light
    }
    if (front > 0.0) col *= 0.22;
    else if (crease > 0.4) col *= 1.4;
  }
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(l), col, saturate), 0.0, 1.0);
  if (levels > 0.0) col = floor(col * levels + (bayer(cell) - 0.5) * dither + 0.5) / levels;
  outColor = vec4(col, 1.0);
}`;

export function applyLook(name, stage, { target = new THREE.Vector3() } = {}) {
  const L = LOOKS[name];
  if (!L) throw new Error(`no look ${name}: ${lookNames.join(', ')}`);
  const { renderer, scene, camera } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if (name === 'real') return { render: () => renderer.render(scene, camera), camera };

  restyle(scene, L);
  if (L.stylised) {
    // Stylised light: a strong cool sky fill, so shadows stay readable and tinted, never black.
    scene.traverse(o => {
      if (o.isHemisphereLight) { o.color.set(0xcfe0ff); o.groundColor.set(0x7a6650); o.intensity = 1.5; }
      if (o.isDirectionalLight) { o.color.set(0xfff0d8); }
    });
  }
  if (L.faceted) return { render: () => renderer.render(scene, camera), camera };

  // The pixel looks see the scene through an orthographic camera framed like the iso one.
  let cam = camera;
  if (L.pixel > 1) {
    const dist = camera.position.distanceTo(target);
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const a = innerWidth / innerHeight;
    cam = new THREE.OrthographicCamera(-h * a / 2, h * a / 2, h / 2, -h / 2, 0.1, 400);
    cam.position.copy(camera.position);
    cam.lookAt(target);
  }
  const w = Math.max(1, Math.floor(innerWidth * devicePixelRatio / L.pixel));
  const hgt = Math.max(1, Math.floor(innerHeight * devicePixelRatio / L.pixel));
  const rt = (depth) => new THREE.WebGLRenderTarget(w, hgt, {
    type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    ...(depth ? { depthTexture: new THREE.DepthTexture(w, hgt) } : {}),   // (undefined breaks three's setter: leave it out)
  });
  const color = rt(true), normals = rt(false);
  const normalMat = new THREE.MeshNormalMaterial();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: color.texture }, tDepth: { value: color.depthTexture }, tNormal: { value: normals.texture },
      res: { value: new THREE.Vector2(w, hgt) }, near: { value: cam.near }, far: { value: cam.far },
      ortho: { value: cam.isOrthographicCamera ? 1 : 0 }, levels: { value: L.levels || 0 }, dither: { value: L.dither || 0 },
      saturate: { value: L.saturate || 1 },
      width: { value: L.outlineWidth || 1 }, outline: { value: L.outline ? 1 : 0 },
    },
  }));
  const post = new THREE.Scene();
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const render = () => {
    const tm = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;           // the composite tone-maps, once
    renderer.setRenderTarget(color);
    renderer.render(scene, cam);
    const bg = scene.background;
    scene.overrideMaterial = normalMat;
    scene.background = null;
    renderer.setRenderTarget(normals);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    scene.background = bg;
    renderer.setRenderTarget(null);
    renderer.render(post, postCam);
    renderer.toneMapping = tm;
  };
  return { render, camera: cam };
}
