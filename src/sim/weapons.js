// TRADECRAFT sim: what can be fought with (the user, 2026-10-26: "knives and environment (create variety
// of knives and improvised weapons to populate the world with) fight is still CQC and works the same").
// The fight's rules for them are sim/cqc.js; where they lie and who carries them, sim/items.js.
//
// WEAPONS, by kind: each { name, kind ('knife' | 'blunt' | 'edged'), edge ('blade' cuts, 'point' stabs,
// null: blunt), k, bleed, guard, grab, awkward, carry, … } (numbers my call, to be tuned in play):
//   - k: a landed hit's weight (a bare fist's technique is 0.85–1.7; a knife 2.2–2.9: "massive damage on
//     direct hits", one clean stab can wound a torso); what it cuts bleeds by `bleed` (sim/health.js);
//   - guard (0–1): how well it stops a blow held across it: 1 a crowbar, nothing gets through it; 0 a
//     knife, the guard is your forearms. Blocking a blade or a heavy weapon (HEAVY_K and over) with
//     less than SOLID_GUARD is a CQC check for a clean block, failing which it comes through the guard
//     (sim/cqc.js, the user: "blocking a knife without a sturdy tool … you still get cut, just not
//     fatally, unless blocking well enough");
//   - grab: what it costs a grab, the hand being full (the user: "some weapons will impede the
//     character's ability to grab effectively"), a modifier to the roll, and a chance to fumble the
//     grab altogether (FUMBLE_PER_PT a point); NO_GRAB and under, no grab at all (a snow shovel);
//   - awkward: what it costs every CQC roll, and a tick longer to come (the user: "lower damage
//     especially weapons that are awkward to wield"): a brick, a chain, a shovel. Knives have none:
//     "the preferred balanced weapons for CQC and have almost no drawback";
//   - carry: where it goes when not in the hand (the user: "no backpack or similar yet, so only pockets
//     and weapons can be shoved in our beltline"; sim/items.js room()): 'pocket' (a penknife, a box
//     cutter), 'belt' (tucked in the beltline, under a coat: a kitchen knife, a hammer), or 'hand' (no
//     hiding it: you hold it or put it down: a bottle, a brick, a pipe);
//   - breaks: the chance a hit breaks it, and into what (a bottle → a broken bottle); splint: rigid and
//     long enough to splint a limb with (first aid, later).
// How it's used (TECHS): a blade slashes and stabs, a point stabs, something blunt clubs, a long one
// thrusts with its end too. Armed, the trained use the weapon most of the time but not always
// (WEAPON_PREF: the user, "skilled characters will prefer hitting with a weapon than kick or elbow
// most of the time but not all the time"); the untrained nearly always.
export const SOLID_GUARD = 0.8;
export const HEAVY_K = 1.5;
export const FUMBLE_PER_PT = 0.08;
export const NO_GRAB = -6;
/** Armed, the chance a hit is the weapon's: trained (TRAINED_CQC and over) and not. */
export const WEAPON_PREF = { trained: 0.75, untrained: 0.92 };
export const TRAINED_CQC = 13;

export const WEAPONS = {
  // Knives: balanced, no drawback; massive on a direct hit, and what they hit bleeds.
  penknife: { name: 'a penknife', kind: 'knife', edge: 'blade', k: 2.2, bleed: 1, guard: 0, grab: 0, awkward: 0, carry: 'pocket' },
  boxcutter: { name: 'a box cutter', kind: 'knife', edge: 'blade', k: 1.6, bleed: 0.9, guard: 0, grab: 0, awkward: 0, carry: 'pocket' },
  switchblade: { name: 'a switchblade', kind: 'knife', edge: 'blade', k: 2.4, bleed: 1.1, guard: 0, grab: 0, awkward: 0, carry: 'pocket' },
  kitchen: { name: 'a kitchen knife', kind: 'knife', edge: 'blade', k: 2.6, bleed: 1.3, guard: 0, grab: 0, awkward: 0, carry: 'belt' },
  finka: { name: 'a finka', kind: 'knife', edge: 'blade', k: 2.7, bleed: 1.3, guard: 0.1, grab: 0, awkward: 0, carry: 'belt' },
  combat: { name: 'a combat knife', kind: 'knife', edge: 'blade', k: 2.9, bleed: 1.4, guard: 0.2, grab: 0, awkward: 0, carry: 'belt' },
  // What's to hand: every one has its drawback.
  screwdriver: { name: 'a screwdriver', kind: 'edged', edge: 'point', k: 1.8, bleed: 0.8, guard: 0, grab: 0, awkward: 0, carry: 'pocket' },
  bottle: { name: 'a bottle', kind: 'blunt', edge: null, k: 1.3, guard: 0.1, grab: -1, awkward: 0, carry: 'hand', breaks: 0.45, into: 'brokenbottle' },
  brokenbottle: { name: 'a broken bottle', kind: 'edged', edge: 'blade', k: 1.6, bleed: 1.1, guard: 0, grab: -1, awkward: -1, carry: 'hand' },
  brick: { name: 'half a brick', kind: 'blunt', edge: null, k: 1.8, guard: 0.2, grab: -2, awkward: -2, carry: 'hand' },
  hammer: { name: 'a hammer', kind: 'blunt', edge: null, k: 1.8, guard: 0.4, grab: -1, awkward: 0, carry: 'belt', crack: 0.3 },
  spanner: { name: 'a spanner', kind: 'blunt', edge: null, k: 1.5, guard: 0.5, grab: -1, awkward: 0, carry: 'belt' },
  pipe: { name: 'a length of pipe', short: 'pipe', kind: 'blunt', edge: null, k: 1.7, guard: 0.85, grab: -3, awkward: -1, carry: 'hand', long: true, splint: true },
  crowbar: { name: 'a crowbar', kind: 'blunt', edge: null, k: 1.9, guard: 0.9, grab: -3, awkward: -1, carry: 'hand', long: true, splint: true },
  stick: { name: 'a stick', kind: 'blunt', edge: null, k: 1.15, guard: 0.6, grab: -2, awkward: 0, carry: 'hand', long: true, splint: true },
  umbrella: { name: 'an umbrella', kind: 'blunt', edge: null, k: 0.8, guard: 0.4, grab: -2, awkward: -1, carry: 'hand', long: true, splint: true },
  shovel: { name: 'a snow shovel', kind: 'blunt', edge: null, k: 1.3, guard: 0.75, grab: -6, awkward: -3, carry: 'hand', long: true },
  bikelock: { name: 'a bike lock', kind: 'blunt', edge: null, k: 1.9, guard: 0.7, grab: -2, awkward: -1, carry: 'hand' },
  chain: { name: 'a chain', kind: 'blunt', edge: null, k: 1.4, guard: 0, grab: -3, awkward: -2, carry: 'hand' },
};

/**
 * How a weapon is used, as techniques (the fight's TECHNIQUES shape, sim/cqc.js): pose (the picture's),
 * at (where it lands), wind; k is the weapon's. id is the technique's, armed: a slash, a stab, a club,
 * a thrust with the end of something long.
 */
export const TECHS = {
  slash: { id: 'slash', pose: 'hook', at: { head: 32, torso: 44, armL: 10, armR: 10, legL: 2, legR: 2 }, wind: 1 },
  stab: { id: 'stab', pose: 'punch', at: { torso: 68, head: 10, armL: 6, armR: 6, legL: 5, legR: 5 }, wind: 1 },
  club: { id: 'club', pose: 'swing', at: { head: 50, torso: 28, armL: 11, armR: 11 }, wind: 2 },
  thrust: { id: 'thrust', pose: 'punch', at: { torso: 60, head: 40 }, wind: 1 },
};

/** The weapon of this kind, or null. */
export const weaponOf = (kind) => (kind && WEAPONS[kind]) || null;
/** What a person has in hand, if a weapon. */
export const wielded = (p) => weaponOf(p?.hand);
/** The ways a weapon is used. */
export const techsOf = (w) => (!w ? [] : w.edge === 'blade' ? [TECHS.slash, TECHS.stab] : w.edge === 'point' ? [TECHS.stab] : w.long ? [TECHS.club, TECHS.thrust] : [TECHS.club]);
/** Whether a grab is possible at all with this in hand. */
export const canGrabWith = (w) => !w || w.grab > NO_GRAB;
/** Its name without the article ('penknife'), for 'the penknife' (short, where the name's a mouthful: 'pipe'). */
export const bare = (w) => w.short ?? w.name.replace(/^(a|an|half a) /, '');
