// TRADECRAFT: build the samples gallery.
//
//   node tools/gallery.mjs [filter]       (only samples whose folder name holds filter)
//
// Every samples/<NNN-name>/ with a sample.json ({ title, about, views: [{ name, query }] }) gets each
// view shot in headless Chrome on the GPU (tools/shot.mjs, which fails on page errors and missing
// files), saved as samples/<NNN-name>/shots/<view>.jpg (800 px wide). Then samples/index.json lists
// them all for samples/index.html (the gallery: open with ./play.sh --dev, then /samples/), and
// samples/contact.jpg puts every view on one sheet. A view that fails is reported and left out.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = path.join(ROOT, 'samples');
const PORT = 8112;
const filter = process.argv[2] || '';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const server = spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(PORT), ROOT], { stdio: 'ignore' });
await new Promise(ok => setTimeout(ok, 700));

const index = existsSync(path.join(SAMPLES, 'index.json')) ? JSON.parse(readFileSync(path.join(SAMPLES, 'index.json'), 'utf8')) : { samples: [] };
const byId = new Map(index.samples.map(s => [s.id, s]));
const failed = [];
try {
  for (const id of readdirSync(SAMPLES).filter(d => /^\d{3}-/.test(d)).sort()) {
    const meta = path.join(SAMPLES, id, 'sample.json');
    if (!existsSync(meta) || (filter && !id.includes(filter))) continue;
    const s = JSON.parse(readFileSync(meta, 'utf8'));
    const shots = path.join(SAMPLES, id, 'shots');
    mkdirSync(shots, { recursive: true });
    const views = [];
    for (const v of s.views) {
      const png = path.join(shots, `${slug(v.name)}.png`), jpg = png.replace(/\.png$/, '.jpg');
      const url = `http://127.0.0.1:${PORT}/samples/${id}/${v.query ? '?' + v.query : ''}`;
      try {
        execFileSync('node', [path.join(ROOT, 'tools/shot.mjs'), url, png, '--size', '1600x1000', '--timeout', '90000'], { stdio: 'pipe' });
        execFileSync('magick', [png, '-resize', '800x', '-quality', '82', jpg]);
        rmSync(png);
        views.push({ name: v.name, query: v.query, shot: `${id}/shots/${slug(v.name)}.jpg` });
        console.log(`  ✓ ${id} · ${v.name}`);
      } catch (e) {
        failed.push(`${id} · ${v.name}: ${(e.stdout || e.message).toString().trim().split('\n').slice(-3).join(' / ')}`);
        console.log(`  ✗ ${id} · ${v.name}`);
      }
    }
    // Shots of views that no longer exist go (a renamed view would otherwise leave its old picture).
    const keep = new Set(views.map(v => path.basename(v.shot)));
    if (views.length === s.views.length) {
      for (const f of readdirSync(shots)) if (f.endsWith('.jpg') && !keep.has(f)) rmSync(path.join(shots, f));
    }
    byId.set(id, { id, title: s.title, about: s.about, views });
  }
} finally {
  server.kill();
}

const all = [...byId.values()].filter(s => existsSync(path.join(SAMPLES, s.id))).sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(SAMPLES, 'index.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 16), samples: all }, null, 1) + '\n');

// One sheet of every view, labelled.
const tiles = all.flatMap(s => s.views.map(v => ['-label', `${s.id} · ${v.name}`, path.join(SAMPLES, v.shot)])).flat();
const font = ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf'].find(f => existsSync(f));
if (tiles.length) {
  try {
    execFileSync('magick', ['montage', ...(font ? ['-font', font] : []), ...tiles, '-tile', '4x', '-geometry', '400x250+6+6',
      '-background', '#15171c', '-fill', '#cfd3da', '-pointsize', '13', path.join(SAMPLES, 'contact.jpg')], { stdio: 'pipe' });
  } catch (e) {
    console.log(`contact sheet failed: ${e.stderr?.toString().trim()}`);
  }
}
console.log(`\n${all.reduce((n, s) => n + s.views.length, 0)} views in samples/index.json; samples/contact.jpg`);
if (failed.length) { console.log('failed:\n  ' + failed.join('\n  ')); process.exitCode = 1; }
