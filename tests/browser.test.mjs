// The game in a real browser (heavy: a server and headless Chrome): it boots without an error, the
// keys move the player, a save exported and imported carries on the same game, and an autosave lands
// in IndexedDB. On a port of its own (so its saves never touch the player's), killed after.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { assert, fmt } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;

async function withGame(fn) {
  const server = spawn('python3', [path.join(root, 'tools/serve.py'), String(PORT), root], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${PORT}/VERSION`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
    await fn(page, errors);
  } finally {
    await browser.close();
    server.kill();
  }
}

export default [
  {
    name: 'the title, then the free walk: no errors, keys move, saves carry on the same game',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction("!document.getElementById('title').hidden", null, { timeout: 30000 });
        await page.click('#title .item');
        await page.waitForFunction('window.__ready === true', null, { timeout: 30000 });
        const t0 = Date.now();
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(1500);
        await page.keyboard.up('KeyD');
        const moved = await page.evaluate(() => { const s = window.__tradecraft.state; const me = s.actors.find(a => a.who === s.player); return me.x - 1.5; });
        console.log(`      walked ${fmt(moved, 2)} m east in ${fmt((Date.now() - t0) / 1000, 1)} s of holding D`);
        assert(moved > 1.2, 'the player walked');
        const same = await page.evaluate(() => {
          const h = window.__tradecraft;
          h.pause(true);
          const json = h.save();
          h.step(400, { mx: -1 });
          const a = h.save();
          h.start(json);
          h.pause(true);
          h.step(400, { mx: -1 });
          return [a === h.save(), h.state.actors.length];
        });
        assert(same[0], 'an imported save carried on differently');
        await page.evaluate(() => window.__tradecraft.autosave());
        const auto = await page.evaluate(() => import('./src/ui/store.js').then(m => m.getSave('auto')).then(r => r && { about: r.about, kb: r.json.length / 1024 }));
        console.log(`      autosave: "${auto?.about}", ${fmt(auto?.kb ?? 0)} KB; ${same[1]} on the map`);
        assert(auto && auto.kb > 1, 'an autosave in IndexedDB');
        const fps = await page.evaluate(() => { window.__tradecraft.pause(false); return new Promise(res => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 120) requestAnimationFrame(f); else { const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); res(d[d.length >> 1]); } }; requestAnimationFrame(f); }); });
        console.log(`      median frame ${fmt(fps, 1)} ms`);
        assert(errors.length === 0, errors.join('\n'));
      });
    },
  },
  {
    name: 'mechanic test 1 from the title: the brief, the marker, the instinct, no errors',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction("!document.getElementById('title').hidden", null, { timeout: 30000 });
        await page.getByText('1. Tailing a target').click();
        await page.waitForSelector('.sheet.brief', { timeout: 30000 });
        await page.keyboard.press('Enter');
        await page.waitForFunction('window.__ready === true', null, { timeout: 30000 });
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(4000);
        await page.keyboard.up('KeyD');
        const seen = await page.evaluate(() => ({ marker: !document.querySelector('.marker').hidden, prompt: document.querySelector('.prompt').hidden ? null : document.querySelector('.prompt').textContent, target: window.__tradecraft.state.scenario.target }));
        console.log(`      marker over him: ${seen.marker}; instinct: ${seen.prompt ?? '(quiet)'}`);
        assert(seen.target && seen.marker, 'the target and his marker');
        assert(errors.length === 0, errors.join('\n'));
      });
    },
  },
];
