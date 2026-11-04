// TRADECRAFT sim: body armour (the user, 2026-11-04: "we'll implement body armor heavy worn as outside clothes for
// military grade and used by soldiers and armed police, light is concealable but noticeable when inspected from up
// close and worn under clothing. It should protect realistically from bullets, and a little from knives and other
// cutting implements (realistically)"). What it stops is here; the bullet that meets it is sim/shooting.js bullet(),
// the blade sim/cqc.js, the body behind it sim/health.js.
//
// **The kinds** (KINDS), worn on the sheet (p.armour: { kind, hits: { soft, plate }, color, patch }; nothing, no armour):
//   - light: a soft concealable vest, aramid panels front and back in a thin carrier, worn under the top (NIJ IIIA
//     or so, 2.5 kg). It stops the common handgun rounds and no rifle round, and isn't drawn: up close, a read may
//     notice it (vestCheck(), sim/know.js: the stiff line of the panels, the straps at the shoulders; Awareness
//     against VEST_DC, harder a metre off, under a coat, in the dark; a T-shirt shows it).
//   - heavy: a plate carrier, hard plates front and back (NIJ III/IV-like, steel) over soft armour, a cummerbund of
//     soft panels round the sides, pouches on the front (11 kg), worn over the top: drawn (src/art/sprites.js,
//     src/art/doll.js), seen by anyone (sim/notice.js), and the embassy's arch rings for the steel (sim/screening.js).
// **Where it covers** (COVER): the torso only, and not all of it. A torso hit lands on the protected area by its
// share: a soft vest wraps the chest, the back and the belly to the navel (0.75 of hits); a carrier's plates are the
// box over the heart and the lungs (0.5), its soft panels a quarter more round them, the shoulders, the flanks, the
// lower belly bare. A limb, the head, the neck: nothing (no helmets yet).
// **What stops what** (STOP, of the rounds that land on it, by the calibre: sim/firearms.js CALIBRES): soft armour
// every common handgun round (a .380, a Makarov, a 9 mm, a .38, a .45 all but always; a .357 nearly), buckshot mostly;
// a Tokarev's fast steel-cored 7.62×25 half the time up close (CLOSE_M), most of the time further off (FAR_M); the
// MP7's 4.6×30 and the Val's 9×39, made to go through it, hardly ever; no rifle round at all. Plates stop every
// handgun round and most rifle rounds: 5.45 and 7.62×39 nineteen in twenty or so, 5.56 a little less (fast, a steel
// penetrator), 7.62×51 nine in ten, 7.62×54R's steel core 85%. Each round stopped wears the layer it hit (WEAR a
// hit, at most WEAR_MAX off). A round that goes through is slowed (PEN_K: through soft, most of it left; through a
// plate, little more than half): a wound as ever, smaller.
// **A stopped round** (bullet(): stopped) isn't harmless: the energy goes into the body behind it (behind-armour
// blunt trauma). BLUNT's k of the bullet's points on the torso (a 9 mm into a vest: a bruise the size of a fist; a
// rifle round on a plate: a black one the size of a hand, hurt ribs), a cracked rib BLUNT's crack × the calibre's
// weight squared of the time (a 9 mm into a vest one in twenty, a 7.62×54R on a plate one in four), no bleeding; and
// a moment's knock (KNOCK_S × the calibre: seconds winded, the aim lost; someone else knocked off their feet BLUNT's
// knock × the calibre of the time). The injury it leaves (stoppedInjury(), kind 'blunt') says what did it: "a bruise the size
// of a fist, where the vest stopped a round".
// **Blades** (blow(): cqc.js, on a torso hit that lands on it): a plate stops what lands on it, a blade or a blow
// (BLOW.plate: a fifth of it felt); soft armour isn't made for edges, but its aramid and its carrier turn a slash
// more often than not (BLOW.soft.slash: 70%, the rest a shallow cut at 0.6 of it), a knife's thrust a quarter of the
// time (the rest still deep, at 0.85), a point (a screwdriver, a spike: it parts the weave) one time in ten. A blunt
// blow is spread a little (BLOW.soft.blunt, BLOW.plate.blunt). A fight ender (cqc.js finish()) goes where the armour
// isn't: under it, the throat.
// **What it costs**: warmth (WARM: thermal.js reads it with the top; a carrier's front and back panels hold heat in
// a summer street like a jacket more, and keep out the cold far less, WARM_COLD), the legs (MOBILITY: 11 kg slows
// a run, sim/health.js mobility()), the week's training (LOAD: walking in a carrier is carrying a load,
// sim/fitness.js onFoot()), and being seen (sim/notice.js:
// a carrier on someone who isn't police or a soldier is the first thing anyone remembers).
// **Who wears it** (issue()): the armed response, soldiers among them, a carrier over the uniform (sim/armed.js);
// a patrol, its country's share of officers in a soft vest under the shirt (police.armour.patrol: most in London
// and in the US, where it's standard issue; few in Moscow, Beirut, Cairo); now and then a bodyguard (BODYGUARD_P).
// The free walk gives the player a soft vest (src/main.js), the wardrobe takes one on and off (sim/clothes.js).
// Every roll here is from a stream of its own (the wearer, the moment, how many hits they've taken), so the game's
// dice run as they did for everyone who wears none. (My calls on the numbers, from the NIJ levels; tests print them.)
import { stream, chance, range, hash } from './rng.js';
import { DAY } from './clock.js';

export const KINDS = {
  light: { id: 'light', name: 'a soft vest', short: 'soft vest', word: 'soft armour, concealable, under the top', over: false, cover: { soft: 0.75 }, kg: 2.5, metal: false, color: 0x4c5262 },
  heavy: { id: 'heavy', name: 'a plate carrier', short: 'plate carrier', word: 'steel plates front and back over soft armour, worn over the top', over: true, cover: { plate: 0.5, soft: 0.25 }, kg: 11, metal: true, color: 0x23252f },
};
export const COVER = Object.fromEntries(Object.entries(KINDS).map(([k, K]) => [k, K.cover]));
// (a handgun round stopped all but always, a rifle round never, by soft armour; a plate stops all but the hottest
// rifle rounds; [close, far]: by the distance, CLOSE_M to FAR_M, a round that's still fast up close)
export const STOP = {
  soft: { '9x17': 1, '9x18': 0.99, '9x19': 0.98, '.38': 0.99, '.45': 0.99, '.357': 0.95, '7.62x25': [0.45, 0.8], '10x28T': 1, '4.6x30': [0.1, 0.3], '9x39': 0.1, '12ga': 0.95,
    '5.45x39': 0, '5.56x45': 0, '7.62x39': 0, '7.62x51': 0, '7.62x54R': 0 },
  plate: { '9x17': 1, '9x18': 1, '9x19': 1, '.38': 1, '.45': 1, '.357': 1, '7.62x25': 1, '10x28T': 1, '4.6x30': 0.99, '9x39': 0.85, '12ga': 1,
    '5.45x39': 0.95, '5.56x45': 0.92, '7.62x39': 0.96, '7.62x51': 0.9, '7.62x54R': 0.85 },
};
export const CLOSE_M = 10, FAR_M = 40;
export const WEAR = { soft: 0.02, plate: 0.03 }, WEAR_MAX = 0.3;          // (stop chance off a round already stopped by that layer)
export const PEN_K = { soft: 0.85, plate: 0.6 };                          // (a round through: that share of its damage left)
// A stopped round: k of the bullet's points on the torso; a cracked rib crack × the calibre's weight squared; knocked
// off their feet (someone else) knock × the calibre; winded KNOCK_S seconds × the calibre.
export const BLUNT = { soft: { k: 0.22, crack: 0.05, knock: 0.1 }, plate: { k: 0.3, crack: 0.06, knock: 0.15 } };
export const KNOCK_S = [1, 3], BLUNT_DAYS = 10;
// A blow that lands on it: stop (no cut: k of it felt), or through (k of it, deep or not). A plate stops anything.
export const BLOW = {
  plate: { stop: 1, k: 0.2, blunt: 0.7 },
  soft: { slash: { stop: 0.7, k: 0.35, through: 0.6, deep: false }, stab: { stop: 0.25, k: 0.35, through: 0.85, deep: true }, point: { stop: 0.1, k: 0.35, through: 0.9, deep: true }, blunt: 0.9 },
};
// What it costs: the core's warmth (a top's points, sim/thermal.js: all of it against the heat, WARM_COLD of it against the
// cold: panels front and back hold the sweat in, and keep only the chest warm), the legs, the week's training (× the
// km's points), being seen.
export const WARM = { light: 0.5, heavy: 1 }, WARM_COLD = 0.4;
export const MOBILITY = { light: 1, heavy: 0.92 };
export const LOAD = { light: 1.05, heavy: 1.5 };
export const SEEN_MOD = 4;
// Noticing a vest under the top (spotted()): Awareness against VEST_DC, VEST_PER_M a metre past the first, the top over
// it (a T-shirt shows its line, a coat hides it), the light; past VEST_M, not at all.
export const VEST_DC = 15, VEST_PER_M = 2, VEST_M = 4;
export const VEST_TOP = { tee: -3, dress: -2, sweater: 0, uniform: 0, suit: 2, jacket: 2, robe: 3, coat: 7 };
// Who wears it: a bodyguard, a soft vest this share of the time (the patrols' are their country's: police.armour.patrol).
export const BODYGUARD_P = 0.35;

/** The kind of armour someone wears (KINDS'), or null. */
export const armourOf = (p) => KINDS[p?.armour?.kind] ?? null;
/** Armour on: a fresh one of a kind (KINDS), its colour (a carrier's cloth) and a patch (POLICE across it) if given. */
export function wear(p, kind, { color = null, patch = false } = {}) {
  if (!KINDS[kind]) return;
  p.armour = { kind, hits: {}, ...(color !== null && color !== undefined ? { color } : {}), ...(patch ? { patch: true } : {}) };
}
/** Off: what was worn ({ kind, hits, color }), or null. */
export function takeOffArmour(p) { const a = p.armour ?? null; delete p.armour; return a; }
/** The warmth it adds to the top (sim/thermal.js: against the heat; cold, against the cold), the legs' factor (sim/health.js), the training's (sim/fitness.js). */
export const warmthOf = (p, cold = false) => (WARM[p?.armour?.kind] ?? 0) * (cold ? WARM_COLD : 1);
export const mobilityOf = (p) => MOBILITY[p?.armour?.kind] ?? 1;
export const loadOf = (p) => LOAD[p?.armour?.kind] ?? 1;
/** Whether it shows to anyone (a carrier, over the top). */
export const showsArmour = (p) => !!armourOf(p)?.over;
/** A carrier's cloth colour, for the picture (its own, or the kind's). */
export const colorOf = (p) => p?.armour?.color ?? armourOf(p)?.color ?? 0x23252f;
/** What the picture draws of it (src/art/sprites.js, src/art/doll.js): a carrier's { color, patch }, or null (none, or a vest under the top). */
export const pictureOf = (p) => (showsArmour(p) ? { color: colorOf(p), ...(p.armour.patch ? { patch: true } : {}) } : null);

/** Where a torso hit lands on what they wear: 'plate', 'soft', or null (where it doesn't cover). r: the dice. */
export function layerHit(p, r) {
  const C = armourOf(p)?.cover;
  if (!C) return null;
  const u = r ? range(r, 0, 1) : 0.5;
  if (u < (C.plate ?? 0)) return 'plate';
  if (u < (C.plate ?? 0) + (C.soft ?? 0)) return 'soft';
  return null;
}
/** The chance a layer stops a round of calibre cal from d metres, worn by `hits` rounds it already stopped. */
export function stopChance(layer, cal, d = 15, hits = 0) {
  const s = STOP[layer]?.[cal] ?? (layer === 'plate' ? 0.9 : 0), base = Array.isArray(s) ? s[0] + (s[1] - s[0]) * Math.max(0, Math.min(1, (d - CLOSE_M) / (FAR_M - CLOSE_M))) : s;
  return Math.max(0, base - Math.min(WEAR_MAX, (WEAR[layer] ?? 0) * hits));
}
/** The dice for p's armour now: a stream of its own (the wearer, the moment, their hits and wounds), so nobody else's change. */
export const dice = (p, ms, salt = '') => stream('armour', p?.id ?? '', ms, salt, (p?.armour?.hits?.soft ?? 0) + 10 * (p?.armour?.hits?.plate ?? 0), p?.injuries?.length ?? 0);

/**
 * A bullet of calibre cal (its weight, dmg: sim/firearms.js CALIBRES) into p's torso, bulletPts its points, from d
 * metres: null where it missed the armour; else { layer, stopped, k (a round through: its damage × this), blunt
 * (points on the torso), crack (a rib cracked), knockS (winded, seconds), down (knocked off their feet) }. The layer's
 * hits counted (p.armour.hits).
 */
export function bullet(p, cal, calDmg, bulletPts, d, r) {
  const layer = layerHit(p, r);
  if (!layer) return null;
  const hits = p.armour.hits?.[layer] ?? 0, stopped = chance(r, stopChance(layer, cal, d, hits));
  if (!stopped) return { layer, stopped: false, k: PEN_K[layer] };
  (p.armour.hits ??= {})[layer] = hits + 1;
  const B = BLUNT[layer], w = Math.max(0.2, calDmg);
  return { layer, stopped: true, k: 0, blunt: Math.round(bulletPts * B.k * 10) / 10, crack: chance(r, Math.min(0.5, B.crack * w * w)), knockS: Math.round(range(r, ...KNOCK_S) * w * 10) / 10, down: chance(r, Math.min(0.6, B.knock * w)) };
}

/**
 * A blow landing on p's torso (cqc.js): edge ('blade', 'point' or null: blunt), how (the technique: 'slash', 'stab',
 * 'thrust', …). null where it missed the armour; else { layer, stopped, k (× the blow's damage), deep (a blade still
 * deep, or not), how ('slash' | 'stab' | 'point' | 'blunt') }.
 */
export function blow(p, edge, how, r) {
  const layer = layerHit(p, r);
  if (!layer) return null;
  const kind = !edge ? 'blunt' : edge === 'point' ? 'point' : how === 'slash' ? 'slash' : 'stab';
  if (layer === 'plate') return kind === 'blunt' ? { layer, stopped: false, k: BLOW.plate.blunt, deep: false, how: kind } : { layer, stopped: true, k: BLOW.plate.k, deep: false, how: kind };
  if (kind === 'blunt') return { layer, stopped: false, k: BLOW.soft.blunt, deep: false, how: kind };
  const B = BLOW.soft[kind];
  return chance(r, B.stop) ? { layer, stopped: true, k: B.k, deep: false, how: kind } : { layer, stopped: false, k: B.through, deep: B.deep, how: kind };
}

/**
 * The injury a stopped round leaves (kind 'blunt': no bleeding, sim/health.js), at game time ms: its name says what
 * did it (layer: bullet()'s; a rifle round, buckshot or a pistol's, by the calibre).
 */
export function stoppedInjury(layer, cal, calDmg, ms) {
  const rifle = calDmg >= 1.4 && cal !== '12ga', buck = cal === '12ga';
  const name = layer === 'plate'
    ? (rifle ? 'a black bruise the size of a hand, where a plate stopped a rifle round' : 'a red welt where a plate stopped a round')
    : buck ? 'a spread of bruises, where the vest stopped the shot' : 'a bruise the size of a fist, where the vest stopped a round';
  return { part: 'torso', kind: 'blunt', name, ms, until: ms + BLUNT_DAYS * DAY, bleed: 0, stopped: layer };
}
/** What a stopped round shows to plain sight, before a look finds what it is (sim/diagnosis.js seenName()). */
export const stoppedSeen = (i, kind) => (kind === 'heavy' || i.stopped === 'plate' ? 'a round\'s strike on the carrier, and no blood' : 'a hole in the clothes over the ribs, and no blood under it');

/**
 * What noticing a vest under p's top asks, d metres off, in light ('dark' | 'dim' | 'lit'): { dc, mods } for an
 * Awareness check (sim/know.js read(): VEST_DC, the distance, the top over it, the light), or null when there's
 * nothing to see that way (no vest; a carrier, which anyone sees; past VEST_M).
 */
export function vestCheck(p, d, light = 'lit') {
  const A = armourOf(p);
  if (!A || A.over || d > VEST_M) return null;
  const top = p.look?.top?.kind ?? 'tee', mods = [
    { why: `${top === 'coat' ? 'a coat' : top === 'tee' ? 'a T-shirt' : 'the top'} over it`, v: -(VEST_TOP[top] ?? 0) },
    d > 1 ? { why: 'the distance', v: -Math.round((d - 1) * VEST_PER_M) } : null,
    light === 'dark' ? { why: 'in the dark', v: -3 } : light === 'dim' ? { why: 'in the dusk', v: -1 } : null].filter(m => m && m.v);
  return { dc: VEST_DC, mods };
}

/** What's seen of someone's armour, in a line (findings: sim/diagnosis.js); self: your own. */
export function armourLine(p, self = false) {
  const A = armourOf(p);
  if (!A) return null;
  const top = p.look?.top?.kind, under = top === 'coat' ? 'the coat' : top === 'tee' ? 'the T-shirt' : top === 'uniform' ? 'the uniform shirt' : top === 'sweater' ? 'the jumper' : top === 'suit' ? 'the shirt' : 'the top';
  const hits = (p.armour.hits?.soft ?? 0) + (p.armour.hits?.plate ?? 0), struck = hits ? ` ${hits === 1 ? 'A round' : `${hits} rounds`} stopped in it.` : '';
  if (self) return A.over ? `You're in a plate carrier: steel plates front and back, 11 kg of it.${struck}` : `A soft vest under ${under.replace(/^the /, 'your ')}: it stops a pistol round, not a rifle's.${struck}`;
  return A.over ? `In a plate carrier: plates front and back, pouches on the front.${struck}` : `Under ${under}: the stiff, square line of a vest, the straps at the shoulders.${struck}`;
}

/** The words for a blow the armour took (cqc.js; out.armour), ours (us: we landed it) or theirs. salt: the exchange's. */
export function blowWords(A, us, salt = 0) {
  const pick = (list) => list[hash('armour-blow', salt) % list.length];
  if (!A) return '';
  if (A.layer === 'plate' && A.how !== 'blunt') return pick(us ? [' It skids off something hard under the cloth: a plate.', ' Steel under it: the blade stops dead.'] : [' It stops on your plate.', ' It skids off the plate.']);
  if (A.layer === 'plate') return pick(us ? [' Most of it goes into the plate.'] : [' The plate takes most of it.']);
  if (A.how === 'blunt') return '';
  if (A.stopped) return A.how === 'slash' ? pick(us ? [' The edge drags across something stiff under the shirt: a vest.', ' It doesn\'t cut: there\'s a vest under there.'] : [' The vest turns the edge.', ' It catches in the vest, and doesn\'t cut you.']) : pick(us ? [' The point stops in something under the shirt: a vest.'] : [' The point stops in the vest.']);
  return A.how === 'slash' ? pick(us ? [' Through the vest\'s cloth, a shallow cut.'] : [' It cuts through the vest, but not deep.']) : pick(us ? [' It goes through the vest.'] : [' It goes through the vest.']);
}

/**
 * Who wears what (sim/armed.js armCop(), the scenes' bodyguards): role 'response' a carrier, over the uniform (its
 * country's colour, K.armour.color; POLICE across it, K.armour.patch); 'patrol' a soft vest under the shirt, its country's share of the time
 * (K.armour.patrol); 'bodyguard' a soft vest, BODYGUARD_P of the time. K: the police (sim/countries/), salt the
 * person's (their id), so who wears one never moves the game's dice.
 */
export function issue(p, role, K = null, salt = p?.id ?? '') {
  const r = stream('armour-issue', salt, role);
  if (role === 'response') return wear(p, 'heavy', { color: K?.armour?.color ?? KINDS.heavy.color, patch: !!K?.armour?.patch });
  const share = role === 'patrol' ? K?.armour?.patrol ?? 0 : role === 'bodyguard' ? BODYGUARD_P : 0;
  if (share > 0 && chance(r, share)) wear(p, 'light');
}
