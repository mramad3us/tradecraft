// TRADECRAFT sim: the United Kingdom (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const GB = {
  id: 'gb', name: 'the United Kingdom', lang: 'en',
  currency: { sign: '£', rate: 0.79, round: 1 },
  police: {
    patrolP: 0.12, stopBase: 0.004, awareness: 10, skin: ['light', 'tan', 'brown', 'dark'],
    look: { top: { kind: 'uniform', color: 0x23252f, trim: 0xd6e04a }, legs: 0x23252f, hat: { kind: 'peaked', color: 0x14151c, band: 0xf6f4ee } },
    ask: '"Excuse me. Can I see some identification, please?"',
    order: '"Armed police! Drop the weapon! Drop it now!"',                         // (the order to drop it: sim/armed.js)
    // (patrols unarmed; the Met's armed response vehicles: three officers, a Glock and a SIG MCX; rifles in the open at Parliament, Downing Street, embassies, airports)
    arms: { patrol: [], patrolLong: [], response: ['glock17', 'mcx', 'g36c'], visible: 'armed officers at embassies, Parliament and the airports' },
    response: { unit: 'an armed response vehicle', minutes: [4, 8] },
  },
  // (handguns prohibited since 1997; rifles and shotguns on a certificate with a good reason; no civilian carry)
  law: { handgun: 'banned', long: 'licensed', carry: 'banned', ranges: 'club', diplomats: 'permit' },
  black: { ease: 0.15, models: ['converted', 'glock17'] },
  range: { name: 'a smallbore rifle club', what: ['hunting'] },
};
