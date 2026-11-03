// Every module parses (node --check): the screens and the drawing aren't loaded by the other quick tests, so
// a slip there (a comment that swallowed the rest of a line, 0.1.3) would only show in a browser.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap(f => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });

export default [
  {
    name: 'syntax: every module in src parses',
    fn() {
      const files = walk(path.join(root, 'src')), bad = [];
      for (const f of files) { try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push(`${path.relative(root, f)}: ${String(e.stderr).split('\n').find(l => /Error/.test(l)) ?? e.message}`); } }
      assert(!bad.length, bad.join('\n'));
      console.log(`      ${files.length} modules parse`);
    },
  },
];
