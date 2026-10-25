// The release tooling's one invariant: VERSION is a plain MAJOR.MINOR.PATCH and CHANGELOG.md has
// its Unreleased section for the next release to fill.
import { readFileSync } from 'node:fs';
import { assert } from './helpers.mjs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

export default [
  {
    name: 'VERSION is MAJOR.MINOR.PATCH',
    fn: () => assert(/^\d+\.\d+\.\d+\n?$/.test(read('VERSION')), `VERSION reads ${JSON.stringify(read('VERSION'))}`),
  },
  {
    name: 'CHANGELOG.md keeps an Unreleased section',
    fn: () => assert(/^## Unreleased$/m.test(read('CHANGELOG.md')), 'no "## Unreleased" heading'),
  },
];
