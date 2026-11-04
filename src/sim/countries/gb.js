// TRADECRAFT sim: the United Kingdom (sim/countries/index.js has the shape; the research, DESIGN.md Firearms).
export const GB = {
  id: 'gb', name: 'the United Kingdom', lang: 'en',
  currency: { sign: '£', rate: 0.79, round: 1 },
  police: {
    patrolP: 0.12, stopBase: 0.004, awareness: 10, skin: ['light', 'tan', 'brown', 'dark'],
    look: { top: { kind: 'uniform', color: 0x23252f, trim: 0xd6e04a }, legs: 0x23252f, hat: { kind: 'peaked', color: 0x14151c, band: 0xf6f4ee } },
    ask: '"Excuse me. Can I see some identification, please?"',
    order: '"Armed police! Drop the weapon! Drop it now!"',                         // (the order to drop it: sim/armed.js; the armed response's)
    shootFleeing: 'armed',                                                          // (an AFO fires on a man running only if he's armed: the threat, not the flight)
    unarmedOrder: '"Police! Put the weapon down! Put it on the ground, now!"',       // (a patrol's, unarmed: from behind a car, a Taser if they have one)
    halt: '"Police! Stand still! Show me your hands!"',     // (and to stand still, your hands empty: sim/armed.js)
    stay: '"Police. Stay where you are for me, please."',     // (a suspect told to wait where they are, to be searched: sim/hunt.js)
    // (patrols unarmed; the Met's armed response vehicles: three officers, a Glock and a SIG MCX; rifles in the open at Parliament, Downing Street, embassies, airports)
    arms: { patrol: [], patrolLong: [], response: ['glock17', 'mcx', 'g36c'], visible: 'armed officers at embassies, Parliament and the airports' },
    response: { unit: 'an armed response vehicle', minutes: [4, 8] },
    // (body armour, sim/armour.js: every officer in a stab-and-ballistic vest, the patrols unarmed as they are; the ARV's carriers dark grey, POLICE across them)
    armour: { patrol: 0.95, color: 0x4c5262, patch: true },
    // (London: an emergency's 15 minutes for the Met, a category 1 call's 7 for the ambulance service, on average 8 or so; Battenburg on both)
    ems: { police: [6, 14], ambulance: [6, 12], policeCar: { body: 0xf6f4ee, stripe: [0x3b6296, 0xf8e08a], word: 'POLICE' }, ambulanceCar: { body: 0xf8e08a, stripe: [0x356f42, 0xf8e08a], word: 'AMBULANCE' }, medic: { top: { kind: 'uniform', color: 0x356f42, trim: 0xf8e08a }, legs: 0x24503a } },
  },
  // (handguns prohibited since 1997; rifles and shotguns on a certificate with a good reason; no civilian carry)
  law: { handgun: 'banned', long: 'licensed', carry: 'banned', ranges: 'club', diplomats: 'permit' },
  black: { ease: 0.15, models: ['converted', 'glock17'] },
  // (its business over the years, sim/geopolitics.js: another country's, played out in London)
  geo: { traits: ['money', 'residency', 'hit'], the: 'Britain', rival: 'the Kremlin' },
  range: { name: 'a smallbore rifle club', what: ['hunting'] },
};
