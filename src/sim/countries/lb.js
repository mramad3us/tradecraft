// TRADECRAFT sim: Lebanon (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const LB = {
  id: 'lb', name: 'Lebanon', lang: 'ar',
  currency: { sign: '$', rate: 1, round: 1 },
  police: {
    patrolP: 0.3, stopBase: 0.03, awareness: 7, skin: ['tan', 'brown'],
    look: { top: { kind: 'uniform', color: 0x3b4a5e, trim: 0xb9862e }, legs: 0x3b4a5e, hat: { kind: 'peaked', color: 0x3b4a5e, band: 0xb9862e } },
    ask: '"Your papers?"',
    order: '"Drop it! On the ground, now!"',                         // (the order to drop it: sim/armed.js)
    halt: '"Stop! Don\'t move! Hands up!"',     // (and to stand still, your hands empty: sim/armed.js)
    // (the ISF and the army bear arms; army checkpoints and patrols in the city; their rifles, M16s and M4s and AKs: uncertain)
    arms: { patrol: ['glock17', 'browning'], patrolLong: ['m16a4', 'm4'], response: ['m4', 'akm'], visible: 'army checkpoints with rifles' },
    // (the response is soldiers: the army's olive, a soldier each, sim/armed.js; in plate carriers)
    response: { unit: 'the army', minutes: [5, 15], soldiers: true, look: { top: { kind: 'uniform', color: 0x545e40, trim: 0x3d4530 }, legs: 0x545e40, hat: { kind: 'peaked', color: 0x545e40, band: 0x3d4530 } } },
    // (body armour, sim/armour.js: the army's carriers coyote brown over the olive; an ISF patrol's soft vest now and then)
    armour: { patrol: 0.3, color: 0x8f6345, helmet: 0x545e40 },
    // (Beirut: the Internal Security Forces slow to come; the Lebanese Red Cross is the ambulance, and quicker)
    ems: { police: [10, 25], ambulance: [8, 18], policeCar: { body: 0xf6f4ee, stripe: [0x283f6b, 0x283f6b], word: 'POLICE' }, ambulanceCar: { body: 0xf6f4ee, stripe: [0xc95c45, 0xf6f4ee], word: 'RED CROSS' }, medic: { top: { kind: 'uniform', color: 0xf6f4ee, trim: 0xc95c45 }, legs: 0x23252f } },
  },
  // (a pistol held and carried on a Ministry of Defence permit, a year at a time, mostly the connected; diplomats' permits exempt from the freezes)
  law: { handgun: 'permit', long: 'licensed', carry: 'permit', ranges: 'club', diplomats: 'permit' },
  black: { ease: 0.95, models: ['canik', 'glock17', 'browning', 'tokarev', 'akm', 'ak74m', 'm16a4', 'uzi'] },
  // (its business over the years, sim/geopolitics.js)
  geo: { traits: ['routes', 'hostages', 'vaults', 'border'], the: 'Lebanon', patron: 'Iran', border: 'border war in the south' },
  range: { name: 'the ISF Shooting Club', what: ['glock17', 'browning', 'm16a4', 'akm'] },
};
