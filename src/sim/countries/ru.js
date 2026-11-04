// TRADECRAFT sim: Russia (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const RU = {
  id: 'ru', name: 'Russia', lang: 'ru',
  currency: { sign: '₽', rate: 95, round: 50, after: true },
  police: {
    patrolP: 0.45, stopBase: 0.06, awareness: 9, skin: ['light'],
    look: { top: { kind: 'uniform', color: 0x4c5262, trim: 0x9e3c36 }, legs: 0x353947, hat: { kind: 'peaked', color: 0x4c5262, band: 0x9e3c36 } },
    ask: '"Документы, пожалуйста." Documents, please.',
    order: '"Полиция! Бросай оружие!" Police! Drop it!',                         // (the order to drop it: sim/armed.js)
    halt: '"Полиция! Стоять! Руки!" Police! Stand still! Hands!',     // (and to stand still, your hands empty: sim/armed.js)
    stay: '"Полиция. Остановитесь, пожалуйста." Police. Stop there, please.',     // (a suspect told to wait where they are, to be searched: sim/hunt.js)
    // (a holstered pistol on every patrol: the Makarov still about, the PL-15K since 2021; some patrols an AKS-74U; Rosgvardia's AK-74M)
    arms: { patrol: ['pl15', 'makarov'], patrolLong: ['aks74u'], response: ['ak74m', 'pya'], visible: 'Rosgvardia at events and stations' },
    response: { unit: 'Rosgvardia', minutes: [6, 12] },
    // (body armour, sim/armour.js: Rosgvardia in plate carriers, olive; a patrol's soft vest now and then, under the jacket)
    armour: { patrol: 0.2, color: 0x6f7a55, patch: true, helmet: 0x545e40 },
    // (the emergency services, sim/emergency.js: their minutes to a call, my calls from the services' own norms: Moscow's ambulance has 20 minutes by law, and takes it; their cars, and the medics' jackets)
    ems: { police: [8, 15], ambulance: [12, 25], policeCar: { body: 0xf6f4ee, stripe: [0x3b6296, 0x3b6296], word: 'ПОЛИЦИЯ' }, ambulanceCar: { body: 0xf6f4ee, stripe: [0xc95c45, 0xc95c45], word: 'СКОРАЯ' }, medic: { top: { kind: 'uniform', color: 0x3b6296, trim: 0xc95c45 }, legs: 0x283f6b } },
  },
  // (no live-ammunition handguns for civilians; a smoothbore first, a rifle after five years, on Rosgvardia's licence; only a traumatic pistol carried)
  law: { handgun: 'banned', long: 'licensed', carry: 'traumatic', ranges: 'open', diplomats: 'unclear' },
  black: { ease: 0.5, models: ['makarov', 'tokarev', 'traumatic', 'aks74u', 'pya'] },
  // (its business over the years, sim/geopolitics.js: the kinds it has, and the names they need)
  geo: { traits: ['sanctions', 'weapons', 'succession', 'proxies'], the: 'Russia', leader: 'the man in the Kremlin', leaderShort: 'man in the Kremlin' },
  // (its counter-intelligence, 0 … 1, the FSB's: how hard a legend is to get in unseen, the deep postings' incubation, sim/incubation.js)
  ci: 0.9,
  // (the long rivalry the agency's country plays out here, decades of it: a deep posting's purpose, sim/geopolitics.js rivalryOf())
  rivalry: { us: { since: 1947, the: 'the long war with Moscow', rival: 'Moscow', threads: ['command', 'programme', 'inner', 'illegals', 'influence'] } },
  range: { name: 'a DOSAAF shooting club', what: ['makarov', 'pya', 'ak74m', 'saiga12'] },
};
