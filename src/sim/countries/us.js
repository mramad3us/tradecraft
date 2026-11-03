// TRADECRAFT sim: the United States (the Farm's: sim/scenarios/dojo.js; no station there yet).
export const US = {
  id: 'us', name: 'the United States', lang: 'en',
  currency: { sign: '$', rate: 1, round: 1 },
  police: {
    patrolP: 0.2, stopBase: 0.01, awareness: 9, skin: ['light', 'tan', 'brown', 'dark'],
    look: { top: { kind: 'uniform', color: 0x23252f, trim: 0xb9862e }, legs: 0x23252f, hat: { kind: 'peaked', color: 0x23252f, band: 0xb9862e } },
    ask: '"License and ID, please."',
    order: '"Police! Drop the gun! Drop it!"',                         // (the order to drop it: sim/armed.js)
    arms: { patrol: ['glock17'], patrolLong: ['m4', 'rem870'], response: ['m4', 'glock17'], visible: 'patrols' },
    response: { unit: 'SWAT', minutes: [5, 15] },
  },
  law: { handgun: 'licensed', long: 'licensed', carry: 'permit', ranges: 'open', diplomats: 'permit' },
  black: { ease: 0.6, models: ['glock19', 'colt1911', 'model10'] },
  range: { name: 'the Farm\'s range', what: ['glock17', 'p229', 'm4', 'rem870'] },
};
