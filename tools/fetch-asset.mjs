// TRADECRAFT: fetch CC0 assets from Poly Haven and ambientCG, with a record of where they came from.
//
//   node tools/fetch-asset.mjs find polyhaven textures|models|hdris <words…> [--limit 15]
//   node tools/fetch-asset.mjs find ambientcg <words…> [--limit 15]
//   node tools/fetch-asset.mjs get polyhaven <id> [--res 1k|2k|4k] [--to dir] [--raw]
//   node tools/fetch-asset.mjs get ambientcg <id> [--res 1K|2K|4K] [--to dir]
//
// What "get" makes, in --to (default assets/lib/<source>/<id>/), with <id>.source.json beside it
// (library, id, name, authors, licence, page, resolution, files, date):
//   a texture   its colour, normal (OpenGL), roughness and ambient-occlusion maps, as JPEGs;
//   a model     one .glb, game-sized like the people (textures 1024 px WebP, meshopt) unless --raw;
//   a sky       the .hdr (HDRLoader in the game).
// Both libraries are CC0: no credit needed for the assets (Poly Haven's API terms ask credit only
// for apps that show content from the live API, which the game doesn't). Poly Haven asks that API
// calls carry a recognisable User-Agent: they do. Downloads are data: images and glTF are copied,
// an ambientCG zip is unpacked in a fresh temporary folder and only its images are kept.
import { mkdirSync, writeFileSync, existsSync, statSync, readdirSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'tradecraft-asset-fetch (github.com/mramad3us/tradecraft)' };
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args.splice(i, 1), true) : false; };
const limit = Number(opt('--limit', '15'));
const today = new Date().toISOString().slice(0, 10);

const json = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
const download = async (url, file) => {
  if (existsSync(file) && statSync(file).size > 0) return file;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
};
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;
const record = (dir, id, meta) => {
  writeFileSync(path.join(dir, `${id}.source.json`), JSON.stringify({ ...meta, licence: 'CC0', fetched: today }, null, 1) + '\n');
};

// ---------- Poly Haven ----------
const PH = 'https://api.polyhaven.com';
const PH_TYPES = { hdris: 0, textures: 1, models: 2 };

async function phFind(type, words) {
  if (!(type in PH_TYPES)) throw new Error('polyhaven type: textures, models or hdris');
  const all = await json(`${PH}/assets?type=${type}`);
  const hits = Object.entries(all).filter(([id, a]) => {
    const hay = [id, a.name, ...(a.tags || []), ...(a.categories || [])].join(' ').toLowerCase();
    return words.every(w => hay.includes(w.toLowerCase()));
  }).sort((a, b) => (b[1].download_count || 0) - (a[1].download_count || 0));
  for (const [id, a] of hits.slice(0, limit)) console.log(`${id.padEnd(36)} ${a.name}  [${(a.categories || []).join(', ')}]`);
  console.log(`(${hits.length} match${hits.length === 1 ? '' : 'es'})`);
}

async function phGet(id, res, to, raw) {
  const info = await json(`${PH}/info/${id}`);
  const files = await json(`${PH}/files/${id}`);
  const dir = to || path.join(ROOT, 'assets/lib/polyhaven', id);
  mkdirSync(dir, { recursive: true });
  const out = [];
  if (info.type === 1) {                                     // texture
    const maps = { Diffuse: 'diff', nor_gl: 'nor_gl', Rough: 'rough', AO: 'ao' };
    for (const [key, short] of Object.entries(maps)) {
      const f = files[key]?.[res]?.jpg;
      if (f) out.push(await download(f.url, path.join(dir, `${id}_${short}_${res}.jpg`)));
    }
  } else if (info.type === 2) {                              // model
    const g = files.gltf?.[res]?.gltf;
    if (!g) throw new Error(`no ${res} glTF for ${id}`);
    const tmp = mkdtempSync(path.join(tmpdir(), 'ph-'));
    const gltfFile = await download(g.url, path.join(tmp, path.basename(new URL(g.url).pathname)));
    for (const [rel, inc] of Object.entries(g.include || {})) await download(inc.url, path.join(tmp, rel));
    const glb = path.join(dir, `${id}.glb`);
    const bin = path.join(ROOT, 'node_modules/.bin/gltf-transform');
    if (raw) execFileSync(bin, ['copy', gltfFile, glb], { stdio: 'ignore' });
    else execFileSync(bin, ['optimize', gltfFile, glb, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024'], { stdio: 'ignore' });
    rmSync(tmp, { recursive: true, force: true });
    out.push(glb);
  } else {                                                   // hdri
    const h = files.hdri?.[res]?.hdr;
    if (!h) throw new Error(`no ${res} HDR for ${id}`);
    out.push(await download(h.url, path.join(dir, `${id}_${res}.hdr`)));
  }
  record(dir, id, { library: 'Poly Haven', id, name: info.name, type: ['hdri', 'texture', 'model'][info.type],
    authors: Object.keys(info.authors || {}), page: `https://polyhaven.com/a/${id}`, resolution: res,
    files: out.map(f => path.basename(f)) });
  for (const f of out) console.log(`${path.relative(ROOT, f)}  ${kb(f)}`);
}

// ---------- ambientCG ----------
const ACG = 'https://ambientcg.com/api/v2/full_json';

async function acgFind(words) {
  const q = encodeURIComponent(words.join(' '));
  const r = await json(`${ACG}?type=Material&q=${q}&limit=${limit}&sort=Popular`);
  for (const a of r.foundAssets || []) console.log(`${a.assetId.padEnd(24)} ${a.displayName || ''}  [${a.displayCategory || ''}]`);
  console.log(`(${r.numberOfResults} match${r.numberOfResults === 1 ? '' : 'es'})`);
}

async function acgGet(id, res, to) {
  const r = await json(`${ACG}?id=${encodeURIComponent(id)}&include=downloadData,displayData`);
  const a = r.foundAssets?.[0];
  if (!a) throw new Error(`no ambientCG asset ${id}`);
  const zips = a.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads || [];
  const want = `${res}-JPG`;
  const z = zips.find(d => d.attribute === want);
  if (!z) throw new Error(`no ${want} download for ${id} (has: ${zips.map(d => d.attribute).join(', ')})`);
  const dir = to || path.join(ROOT, 'assets/lib/ambientcg', id);
  mkdirSync(dir, { recursive: true });
  const tmp = mkdtempSync(path.join(tmpdir(), 'acg-'));
  const zip = await download(z.downloadLink, path.join(tmp, `${id}.zip`));
  const unpacked = path.join(tmp, 'x');
  execFileSync('unzip', ['-q', '-o', zip, '-d', unpacked]);
  const maps = { Color: 'diff', NormalGL: 'nor_gl', Roughness: 'rough', AmbientOcclusion: 'ao' };
  const out = [];
  for (const f of readdirSync(unpacked)) {
    const m = Object.keys(maps).find(k => f.endsWith(`_${k}.jpg`));
    if (m) { const dst = path.join(dir, `${id}_${maps[m]}_${res}.jpg`); copyFileSync(path.join(unpacked, f), dst); out.push(dst); }
  }
  rmSync(tmp, { recursive: true, force: true });
  record(dir, id, { library: 'ambientCG', id, name: a.displayName || id, type: 'texture', authors: ['ambientCG'],
    page: `https://ambientcg.com/view?id=${id}`, resolution: res, files: out.map(f => path.basename(f)) });
  for (const f of out) console.log(`${path.relative(ROOT, f)}  ${kb(f)}`);
}

// ---------- main ----------
const raw = flag('--raw');
const res = opt('--res', null);
const to = opt('--to', null);
const [cmd, source, ...rest] = args;
try {
  if (cmd === 'find' && source === 'polyhaven') await phFind(rest[0], rest.slice(1));
  else if (cmd === 'find' && source === 'ambientcg') await acgFind(rest);
  else if (cmd === 'get' && source === 'polyhaven') await phGet(rest[0], res || '1k', to, raw);
  else if (cmd === 'get' && source === 'ambientcg') await acgGet(rest[0], res || '1K', to);
  else { console.log(readFileHead()); process.exitCode = 1; }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
function readFileHead() { return 'usage: see the header of tools/fetch-asset.mjs'; }
