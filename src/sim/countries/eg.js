// TRADECRAFT sim: Egypt (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const EG = {
  id: 'eg', name: 'Egypt', lang: 'ar',
  currency: { sign: 'E£', rate: 48, round: 5, after: false },
  police: {
    patrolP: 0.4, stopBase: 0.04, awareness: 7, skin: ['tan', 'brown'],
    look: { top: { kind: 'uniform', color: 0xe6e2d8, trim: 0x14151c }, legs: 0x14151c, hat: { kind: 'peaked', color: 0x14151c, band: 0x14151c } },
    ask: '"Your passport, please."',
    // (a CZ 75, a Glock or a revolver at the belt; rifles and submachine guns at the stations, the MP5 with special units; the embassy streets in Garden City guarded)
    arms: { patrol: ['cz75', 'helwan', 'sw686'], patrolLong: ['akm'], response: ['mp5', 'akm'], visible: 'the guards on the embassy streets of Garden City' },
    response: { unit: 'the Central Security Forces', minutes: [6, 15] },
  },
  // (pistols and shotguns on an Interior Ministry licence, at the minister's discretion)
  law: { handgun: 'licensed', long: 'licensed', carry: 'permit', ranges: 'club', diplomats: 'unclear' },
  black: { ease: 0.6, models: ['helwan', 'tokarev', 'browning', 'akm', 'model10'] },
  range: { name: 'the Egyptian Shooting Club', what: ['helwan', 'cz75', 'rem870'] },
};
