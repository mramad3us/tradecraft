// TRADECRAFT sim: the United States (the Farm's: sim/scenarios/dojo.js; no station there yet).
export const US = {
  id: 'us', name: 'the United States', lang: 'en',
  currency: { sign: '$', rate: 1, round: 1 },
  police: {
    patrolP: 0.2, stopBase: 0.01, awareness: 9, skin: ['light', 'tan', 'brown', 'dark'],
    look: { top: { kind: 'uniform', color: 0x23252f, trim: 0xb9862e }, legs: 0x23252f, hat: { kind: 'peaked', color: 0x23252f, band: 0xb9862e } },
    ask: '"License and ID, please."',
    order: '"Police! Drop the gun! Drop it!"',                         // (the order to drop it: sim/armed.js)
    halt: '"Police! Don\'t move! Show me your hands!"',     // (and to stand still, your hands empty: sim/armed.js)
    stay: '"Police. Stop right there for me."',     // (a suspect told to wait where they are, to be searched: sim/hunt.js)
    arms: { patrol: ['glock17'], patrolLong: ['m4', 'rem870'], response: ['m4', 'glock17'], visible: 'patrols' },
    response: { unit: 'SWAT', minutes: [5, 15] },
    // (body armour, sim/armour.js: most patrol officers in a soft vest under the shirt, standard issue; SWAT in olive-drab carriers, POLICE across them)
    armour: { patrol: 0.85, color: 0x545e40, patch: true },
    ems: { police: [4, 9], ambulance: [6, 12], policeCar: { body: 0x14151c, stripe: [0xf6f4ee, 0xf6f4ee], word: 'POLICE' }, ambulanceCar: { body: 0xf6f4ee, stripe: [0xc95c45, 0xc95c45], word: 'AMBULANCE' }, medic: { top: { kind: 'uniform', color: 0x283f6b, trim: 0xf6f4ee }, legs: 0x23252f } },
  },
  law: { handgun: 'licensed', long: 'licensed', carry: 'permit', ranges: 'open', diplomats: 'permit' },
  black: { ease: 0.6, models: ['glock19', 'colt1911', 'model10'] },
  // (its business over the years, sim/geopolitics.js: the foreign services at work on American soil)
  geo: { traits: ['residency', 'money'], the: 'the United States', rival: 'Moscow' },
  // (its counter-intelligence, 0 … 1, the FBI's: how hard a legend is to get in unseen, the deep postings' incubation, sim/incubation.js)
  ci: 0.8,
  range: { name: 'the Farm\'s range', what: ['glock17', 'p229', 'm4', 'rem870'] },
};
