// TRADECRAFT sim: Lebanon (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const LB = {
  id: 'lb', name: 'Lebanon', lang: 'ar',
  currency: { sign: '$', rate: 1, round: 1 },
  police: {
    patrolP: 0.3, stopBase: 0.03, awareness: 7, skin: ['tan', 'brown'],
    look: { top: { kind: 'uniform', color: 0x3b4a5e, trim: 0xb9862e }, legs: 0x3b4a5e, hat: { kind: 'peaked', color: 0x3b4a5e, band: 0xb9862e } },
    ask: '"Your papers?"',
    order: '"Drop it! On the ground, now!"',                         // (the order to drop it: sim/armed.js)
    // (the ISF and the army bear arms; army checkpoints and patrols in the city; their rifles, M16s and M4s and AKs: uncertain)
    arms: { patrol: ['glock17', 'browning'], patrolLong: ['m16a4', 'm4'], response: ['m4', 'akm'], visible: 'army checkpoints with rifles' },
    response: { unit: 'the army', minutes: [5, 15] },
    // (Beirut: the Internal Security Forces slow to come; the Lebanese Red Cross is the ambulance, and quicker)
    ems: { police: [10, 25], ambulance: [8, 18], policeCar: { body: 0xf6f4ee, stripe: [0x283f6b, 0x283f6b], word: 'POLICE' }, ambulanceCar: { body: 0xf6f4ee, stripe: [0xc95c45, 0xf6f4ee], word: 'RED CROSS' }, medic: { top: { kind: 'uniform', color: 0xf6f4ee, trim: 0xc95c45 }, legs: 0x23252f } },
  },
  // (a pistol held and carried on a Ministry of Defence permit, a year at a time, mostly the connected; diplomats' permits exempt from the freezes)
  law: { handgun: 'permit', long: 'licensed', carry: 'permit', ranges: 'club', diplomats: 'permit' },
  black: { ease: 0.95, models: ['canik', 'glock17', 'browning', 'tokarev', 'akm', 'ak74m', 'm16a4', 'uzi'] },
  range: { name: 'the ISF Shooting Club', what: ['glock17', 'browning', 'm16a4', 'akm'] },
};
