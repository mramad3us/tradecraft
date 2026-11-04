// TRADECRAFT sim: Egypt (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const EG = {
  id: 'eg', name: 'Egypt', lang: 'ar',
  currency: { sign: 'E£', rate: 48, round: 5, after: false },
  police: {
    patrolP: 0.4, stopBase: 0.04, awareness: 7, skin: ['tan', 'brown'],
    look: { top: { kind: 'uniform', color: 0xe6e2d8, trim: 0x14151c }, legs: 0x14151c, hat: { kind: 'peaked', color: 0x14151c, band: 0x14151c } },
    ask: '"Your passport, please."',
    order: '"Drop the gun! On the ground!"',                         // (the order to drop it: sim/armed.js)
    halt: '"Stop where you are! Hands up!"',     // (and to stand still, your hands empty: sim/armed.js)
    // (a CZ 75, a Glock or a revolver at the belt; rifles and submachine guns at the stations, the MP5 with special units; the embassy streets in Garden City guarded)
    arms: { patrol: ['cz75', 'helwan', 'sw686'], patrolLong: ['akm'], response: ['mp5', 'akm'], visible: 'the guards on the embassy streets of Garden City' },
    response: { unit: 'the Central Security Forces', minutes: [6, 15] },
    // (body armour, sim/armour.js: the CSF in carriers, black; a patrol's vest rare)
    armour: { patrol: 0.1, color: 0x23252f, patch: true, helmet: 0x23252f },
    // (Cairo: 122 for the police, 123 for the ambulance, and the traffic between)
    ems: { police: [10, 30], ambulance: [12, 30], policeCar: { body: 0xf6f4ee, stripe: [0x283f6b, 0x14151c], word: 'شرطة' }, ambulanceCar: { body: 0xf6f4ee, stripe: [0xc95c45, 0x3b6296], word: 'إسعاف' }, medic: { top: { kind: 'uniform', color: 0x3b6296, trim: 0xf6f4ee }, legs: 0x283f6b } },
  },
  // (pistols and shotguns on an Interior Ministry licence, at the minister's discretion)
  law: { handgun: 'licensed', long: 'licensed', carry: 'permit', ranges: 'club', diplomats: 'unclear' },
  black: { ease: 0.6, models: ['helwan', 'tokarev', 'browning', 'akm', 'model10'] },
  // (its business over the years, sim/geopolitics.js)
  geo: { traits: ['arms', 'insurgency', 'water', 'smuggling'], the: 'Egypt', region: 'Sinai', neighbour: 'Libyan' },
  range: { name: 'the Egyptian Shooting Club', what: ['helwan', 'cz75', 'rem870'] },
};
