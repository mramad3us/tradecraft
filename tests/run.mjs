// TRADECRAFT test runner: `npm test` or `node tests/run.mjs [filter]`.
// Each *.test.mjs default-exports an array of { name, fn, heavy? } (fn may be async).
// QUICK=1 (`npm run test:quick`) leaves out the heavy ones (timed, long, machine-loading):
// use it whenever the user may be playing, since their game shares the machine.
// SKIP=a,b leaves out the tests whose names hold any of those.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const quick = !!process.env.QUICK;
const skip = (process.env.SKIP || '').split(',').map(x => x.trim()).filter(Boolean);
const files = readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort();

let pass = 0, fail = 0, left = 0;
for (const file of files) {
  const tests = (await import(pathToFileURL(path.join(dir, file)).href)).default;
  for (const t of tests) {
    const full = `${file.replace('.test.mjs', '')} › ${t.name}`;
    if (filter && !full.includes(filter)) continue;
    if ((quick && t.heavy) || skip.some(k => full.includes(k))) { left++; continue; }
    const t0 = performance.now();
    try {
      await t.fn();
      pass++;
      console.log(`  ✓ ${full} (${(performance.now() - t0).toFixed(0)} ms)`);
    } catch (e) {
      fail++;
      console.log(`  ✗ ${full}\n      ${(e.stack || e.message).split('\n').slice(0, 4).join('\n      ')}`);
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed${left ? `, ${left} left out` : ''}`);
process.exitCode = fail ? 1 : 0;
