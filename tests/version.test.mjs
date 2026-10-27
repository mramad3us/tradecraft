// The release tooling's one invariant: VERSION is MAJOR.MINOR.PATCH (a release candidate's with its
// -rcN, as tools/release.sh writes it) and CHANGELOG.md has its Unreleased section for the next release.
import { readFileSync } from 'node:fs';
import { assert } from './helpers.mjs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

export default [
  {
    name: 'VERSION is MAJOR.MINOR.PATCH, or a candidate\'s MAJOR.MINOR.PATCH-rcN',
    fn: () => assert(/^\d+\.\d+\.\d+(-rc\d+)?\n?$/.test(read('VERSION')), `VERSION reads ${JSON.stringify(read('VERSION'))}`),
  },
  {
    name: 'CHANGELOG.md keeps an Unreleased section',
    fn: () => assert(/^## Unreleased$/m.test(read('CHANGELOG.md')), 'no "## Unreleased" heading'),
  },
];
