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
    name: 'the campaign from the title: a first tour (a posting of your own locked), three juniors, day one in the flat, Hale on the telephone, straight in, the mind (Tab), a day at the embassy, no errors',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction("!document.getElementById('title').hidden", null, { timeout: 30000 });
        await page.locator('#title .campaign').click();                      // (the way in: pick your officer)
        await page.waitForSelector('.candidates', { timeout: 30000 });
        // (a new career starts at the bottom: a first tour, Station London; a posting of your own locked till a game reaches above it)
        const rungs = await page.evaluate(() => [...document.querySelectorAll('.candidates .cities button')].map(b => `${b.textContent}${b.classList.contains('on') ? '*' : ''}${b.disabled ? '!' : ''}`));
        const names = await page.locator('.cand').count();
        await page.locator('.cand').first().click();
        await page.waitForFunction('window.__ready === true && window.__tradecraft.state?.scenario.kind === "campaign"', null, { timeout: 30000 });
        const flat = await page.evaluate(() => window.__tradecraft.state.map.place), level = await page.evaluate(() => window.__tradecraft.state.campaign.posting.level);
        await page.evaluate(() => window.__tradecraft.step(300));            // (the telephone rings, twelve seconds in)
        await page.keyboard.press('KeyT');                                   // (to the telephone, round the furniture, and pick up)
        await page.waitForSelector('.sheet.call', { timeout: 30000 });
        await page.locator('.sheet.call button', { hasText: 'Straight in' }).click();
        await page.locator('.overlay:not([hidden]) .sheet.brief .go').click();   // (the posting's brief)
        await page.keyboard.press('Tab');                                     // (the mind: what's ahead, the day's choices: src/ui/mind.js)
        await page.waitForSelector('.mind', { timeout: 5000 });
        const ahead = await page.locator('.mind .mind-row').count();
        await page.evaluate(() => [...document.querySelectorAll('.mind button')].find(b => /Go to work/.test(b.textContent))?.click());
        await page.waitForTimeout(1500);
        const s = await page.evaluate(() => { const st = window.__tradecraft.state; return { hour: new Date(st.time.ms).getUTCHours(), cover: st.campaign.posting.cover, log: st.log.at(-1)?.text, map: st.map.kind }; });
        console.log(`      start as: ${rungs.join(', ')}; ${names} officers, a ${level}; day one in the ${flat === 'home' ? 'flat' : flat}; ${ahead} assignments ahead in the mind; after work: cover ${s.cover}, on the ${s.map}; ${s.log}`);
        assert(rungs[0] === 'A first tour*' && /locked/.test(rungs[1]) && rungs[1].endsWith('!'), 'a first tour, the posting of your own locked');
        assert(names === 3 && level === 'junior' && flat === 'home' && ahead >= 2 && s.cover > 70 && s.map === 'street', 'picked, in the flat, the call, at the desk, a day worked, out of the embassy');
        assert(errors.length === 0, errors.join('\n'));
      });
    },
  },
  {
    name: 'the title, then the free walk: no errors, keys move, saves carry on the same game',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction("!document.getElementById('title').hidden", null, { timeout: 30000 });
        await page.locator('#title .item.walk:not(.campaign) .cities button', { hasText: 'Moscow' }).click();   // (the free walk: a button per city)
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
    name: 'mechanic test 2 by its address: the brief, the way to the bench, the instinct, no errors',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/?play=sdr&seed=4`);           // (the plain test: the tutorial's, on your own)
        await page.waitForSelector('.sheet.brief', { timeout: 30000 });
        await page.keyboard.press('Enter');
        await page.waitForFunction('window.__ready === true', null, { timeout: 30000 });
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(3000);
        await page.keyboard.up('KeyD');
        await page.keyboard.press('KeyE');                                   // a glance back
        await page.waitForTimeout(1500);
        const seen = await page.evaluate(() => ({ goal: document.querySelector('.goal').hidden ? null : document.querySelector('.goal').dataset.text,
          prompt: document.querySelector('.prompt').hidden ? null : document.querySelector('.prompt').textContent, team: window.__tradecraft.state.scenario.team, glances: window.__tradecraft.state.scenario.glances }));
        console.log(`      ${seen.team} evening; the way: ${seen.goal}; instinct: ${seen.prompt}; glances ${seen.glances}`);
        assert(seen.goal && seen.prompt && seen.glances === 1, 'the way to the bench, the instinct, and a glance taken');
        assert(errors.length === 0, errors.join('\n'));
      });
    },
  },
  {
    name: 'the tutorial from the flat\'s telephone and back, then lesson 1 played by the officer picked: the brief, the marker, the instinct, Hale on the earpiece, the checklist, no errors',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/`);
        await page.waitForFunction("!document.getElementById('title').hidden", null, { timeout: 30000 });
        await page.locator('#title .campaign').click();
        await page.waitForSelector('.candidates', { timeout: 30000 });
        await page.locator('.cand').first().click();
        await page.waitForFunction('window.__ready === true && window.__tradecraft.state?.scenario.kind === "campaign"', null, { timeout: 30000 });
        const officer = await page.evaluate(() => window.__tradecraft.state.people.me.name);
        await page.evaluate(() => window.__tradecraft.step(300));
        await page.keyboard.press('KeyT');
        await page.waitForSelector('.sheet.call', { timeout: 30000 });
        await page.locator('.sheet.call button', { hasText: 'The exercises' }).click();   // (the tutorial, from the telephone: sim/tutorial/)
        await page.locator('#title button', { hasText: 'Back to the flat' }).click();     // (back as it was left; and Hale's number, by the telephone)
        await page.waitForFunction('window.__ready === true && window.__tradecraft.state?.map.place === "home"', null, { timeout: 30000 });
        await page.keyboard.press('KeyT');
        await page.waitForSelector('.sheet.call', { timeout: 30000 });
        await page.locator('.sheet.call button', { hasText: 'The exercises' }).click();
        await page.locator('#title button', { hasText: '1. Tailing a man' }).click();
        await page.waitForSelector('.sheet.brief', { timeout: 30000 });
        await page.keyboard.press('Enter');
        await page.waitForFunction('window.__ready === true', null, { timeout: 30000 });
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(4000);
        await page.keyboard.up('KeyD');
        const seen = await page.evaluate(() => ({ marker: !document.querySelector('.marker').hidden, prompt: document.querySelector('.prompt').hidden ? null : document.querySelector('.prompt').textContent, target: window.__tradecraft.state.scenario.target,
          hale: document.querySelector('.earpiece .line')?.textContent ?? null, lesson: document.querySelector('.watch .lesson')?.hidden === false }));
        const who = await page.evaluate(() => window.__tradecraft.state.people.me.name);
        console.log(`      ${who} (picked: ${officer}); marker over him: ${seen.marker}; instinct: ${seen.prompt ?? '(quiet)'}; Hale: ${seen.hale ?? '(nothing)'}; the checklist: ${seen.lesson}`);
        assert(seen.target && seen.marker, 'the target and his marker');
        assert(seen.hale && seen.lesson, 'Hale on the earpiece, the lesson\'s checklist');
        assert(who === officer, 'played by the officer picked');
        assert(errors.length === 0, errors.join('\n'));
      });
    },
  },
  {
    name: 'the Farm by its address: the brief, onto the mat, an exchange (C, the sheet), no errors',
    heavy: true,
    async fn() {
      await withGame(async (page, errors) => {
        await page.goto(`http://localhost:${PORT}/?play=dojo&chapter=lesson&seed=2`);   // (the Farm: lesson 0 of the tutorial)
        await page.waitForSelector('.sheet.brief', { timeout: 30000 });
        await page.keyboard.press('Enter');
        await page.waitForFunction('window.__ready === true', null, { timeout: 30000 });
        await page.keyboard.press('KeyT');
        await page.waitForFunction('window.__tradecraft.state.fight?.phase === "choose"', null, { timeout: 20000 });
        const before = await page.evaluate(() => ({ intent: document.querySelector('.intent').hidden ? null : document.querySelector('.intent').textContent, bout: document.querySelector('.bout').textContent }));
        await page.keyboard.press('Semicolon');                     // (cover: Hale's first is a hit)
        await page.waitForTimeout(1500);
        await page.keyboard.press('KeyC');
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => ({ log: window.__tradecraft.state.log.at(-1)?.text, sheet: !document.querySelector('.charsheet')?.closest('.overlay').hidden, edges: window.__tradecraft.state.fight?.adv.a }));
        console.log(`      over Hale: ${before.intent}; at the top: ${before.bout.trim()}; then: ${after.log}`);
        assert(before.intent === 'HIT', 'Hale\'s hit called over the head');
        assert(after.edges === 1 && after.sheet, 'covered, an edge; the sheet opens');
        assert(errors.length === 0, errors.join('\n'));
      });
    },
  },
];
