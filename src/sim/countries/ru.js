// TRADECRAFT sim: Russia (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const RU = {
  id: 'ru', name: 'Russia', lang: 'ru',
  currency: { sign: '₽', rate: 95, round: 50, after: true },
  police: {
    patrolP: 0.45, stopBase: 0.06, awareness: 9, skin: ['light'],
    look: { top: { kind: 'uniform', color: 0x4c5262, trim: 0x9e3c36 }, legs: 0x353947, hat: { kind: 'peaked', color: 0x4c5262, band: 0x9e3c36 } },
    ask: '"Документы, пожалуйста." Documents, please.',
    order: '"Полиция! Бросай оружие!" Police! Drop it!',                         // (the order to drop it: sim/armed.js)
    // (a holstered pistol on every patrol: the Makarov still about, the PL-15K since 2021; some patrols an AKS-74U; Rosgvardia's AK-74M)
    arms: { patrol: ['pl15', 'makarov'], patrolLong: ['aks74u'], response: ['ak74m', 'pya'], visible: 'Rosgvardia at events and stations' },
    response: { unit: 'Rosgvardia', minutes: [6, 12] },
  },
  // (no live-ammunition handguns for civilians; a smoothbore first, a rifle after five years, on Rosgvardia's licence; only a traumatic pistol carried)
  law: { handgun: 'banned', long: 'licensed', carry: 'traumatic', ranges: 'open', diplomats: 'unclear' },
  black: { ease: 0.5, models: ['makarov', 'tokarev', 'traumatic', 'aks74u', 'pya'] },
  range: { name: 'a DOSAAF shooting club', what: ['makarov', 'pya', 'ak74m', 'saiga12'] },
};
