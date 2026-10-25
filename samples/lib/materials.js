// TRADECRAFT samples: materials from the CC0 texture sets tools/fetch-asset.mjs brings in
// (assets/lib/<library>/<id>/<id>_diff|nor_gl|rough|ao_<res>.jpg).
//
// Geometry made by the samples' builders carries UVs in metres, so a texture's repeat is simply
// 1 / its real size: `tile` metres across, and down in proportion to the image (some sets aren't
// square). Only the maps a set has are loaded (its .source.json lists them). Every texture's upload
// is tracked: await loaded(draw) before telling the tools a sample is drawn, or the first screenshot
// catches grey placeholders.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const pending = [];
const LIB = new URL('../../assets/lib/', import.meta.url).href;

/**
 * A PBR material from a texture set. `set` is '<library>/<id>' (e.g. 'ambientcg/WoodFloor051'),
 * `tile` the metres one image covers across. Options: res ('1K' ambientCG, '1k' Poly Haven), tint
 * (multiplies the colour), roughness (scales the map), side.
 */
export function textured(set, tile, { res, tint, roughness = 1, side } = {}) {
  const id = set.split('/').pop();
  const r = res || (set.startsWith('polyhaven/') ? '1k' : '1K');
  const m = new THREE.MeshStandardMaterial({ roughness, side });
  if (tint) m.color.set(tint);
  m.name = id;
  // Which maps the set has comes from its .source.json (not every set has an AO map).
  pending.push(fetch(`${LIB}${set}/${id}.source.json`).then(reply => reply.json()).then(src => {
    const has = (map) => src.files.includes(`${id}_${map}_${r}.jpg`);
    if (has('diff')) m.map = load('diff', true);
    if (has('nor_gl')) m.normalMap = load('nor_gl');
    if (has('rough')) m.roughnessMap = load('rough');
    if (has('ao')) m.aoMap = load('ao');
    m.needsUpdate = true;
  }));
  return m;
  function load(map, srgb) {
    const fit = (t) => t.repeat.set(1 / tile, 1 / (tile * t.image.height / t.image.width));
    const t = loader.load(`${LIB}${set}/${id}_${map}_${r}.jpg`, fit);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / tile, 1 / tile);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    pending.push(new Promise((ok) => { t.onUpdate = ok; }));   // fires once the GPU has it
    return t;
  }
}

/** A flat colour, for the cut tops of walls and anything that needs no texture. */
export function plain(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

/**
 * Resolves once every texture made so far is on the GPU (or after `ms`, whichever first). Textures
 * only upload when first drawn, so `draw` (a render call) is invoked as the maps arrive.
 */
export async function loaded(draw, ms = 20000) {
  const until = Date.now() + ms;
  let seen = -1;
  while (seen !== pending.length && Date.now() < until) {
    seen = pending.length;
    draw?.();
    await Promise.race([Promise.all(pending.slice()), new Promise(ok => setTimeout(ok, Math.max(0, until - Date.now())))]);
  }
}
