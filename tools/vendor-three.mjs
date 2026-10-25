// TRADECRAFT: copy three.js into vendor/three/, so the game needs no npm and no network to run.
//
//   node tools/vendor-three.mjs
//
// The version is the one pinned in package.json (devDependencies, installed by `npm install`).
// The core build is copied whole; from the add-ons (examples/jsm) only those named in ADDONS
// below, with every file they import in turn, so the vendored tree stays small. The game loads
// them through an import map:
//   { "imports": { "three": "./vendor/three/build/three.module.js",
//                  "three/addons/": "./vendor/three/examples/jsm/" } }
// To use another add-on, add it to ADDONS and run this again. The copy is replaced whole.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ADDONS = [
  'loaders/GLTFLoader.js',
  'loaders/HDRLoader.js',
  'libs/meshopt_decoder.module.js',
  'utils/SkeletonUtils.js',
  'controls/OrbitControls.js',
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/OutputPass.js',
  'postprocessing/GTAOPass.js',
  'postprocessing/UnrealBloomPass.js',
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/three');
const dst = path.join(root, 'vendor/three');
if (!existsSync(src)) { console.error('three is not installed: run `npm install` first.'); process.exit(1); }
const version = JSON.parse(readFileSync(path.join(src, 'package.json'), 'utf8')).version;

rmSync(dst, { recursive: true, force: true });
const copy = rel => {
  mkdirSync(path.dirname(path.join(dst, rel)), { recursive: true });
  copyFileSync(path.join(src, rel), path.join(dst, rel));
};

// The core: three.module.js imports three.core.js.
for (const f of ['build/three.module.js', 'build/three.core.js', 'LICENSE']) copy(f);

// The add-ons and, transitively, their relative imports (bare 'three' goes through the import map).
const seen = new Set();
const todo = ADDONS.map(a => path.join('examples/jsm', a));
while (todo.length) {
  const rel = path.normalize(todo.pop());
  if (seen.has(rel)) continue;
  seen.add(rel);
  copy(rel);
  const text = readFileSync(path.join(src, rel), 'utf8');
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    todo.push(path.join(path.dirname(rel), m[1]));
  }
}

writeFileSync(path.join(dst, 'VERSION'), version + '\n');
console.log(`three ${version}: core + ${seen.size} add-on files in vendor/three/`);
