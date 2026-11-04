// TRADECRAFT sim: firearms, the guns themselves (the user, 2026-11-03: "model every part of a weapon that
// way (safety, loaded or unloaded, magazine or single bullet, can contain a chambered bullet and no clip,
// can be jammed and require servicing, can misfire if in bad condition etc. All actions on a weapon should
// require rolls against weapon handling"; "implement many kinds of firearms right away (many kinds of
// assault rifles, many kinds of handguns etc)"). How they're fought with, in stop motion, is sim/shooting.js.
//
// **A gun is a thing with a state of its own**, kept by whoever has it: on their sheet (p.arms, by its id),
// or, lying where it was dropped, on that thing (it.arms: sim/items.js drop(), pickUp()), so it goes where
// the gun goes (into a mission and back with the character, into the flat's drawer). What's carried or held
// is the id (p.hand, p.items: `${model}#${owner}.${n}`, so its size and its name come from the model; a gun
// dropped is the same gun picked up, loaded or not, safety on or off).
//
// **The models** (MODELS): what kind (KINDS: a pistol, a revolver, a submachine gun, a carbine, a rifle, a
// marksman's rifle, a shotgun: how far it reaches, how it's aimed and carried), its calibre (CALIBRES: what
// a round does), how it feeds (feed: a box magazine, of its family, FAMILIES: 'mag'; a tube or an internal
// magazine, loaded a round at a time: 'tube'; a revolver's cylinder: 'cylinder'), how it cycles (action:
// 'semi' itself; 'pump', 'bolt' by hand after every shot; 'da' a revolver's double action), its safety
// ('manual', 'none', or a 'selector': safe and its fire modes, modes: semi, burst, auto), whether the slide or
// bolt locks back on the last round (holdOpen), its size (cm, litres: where it can be carried), and how it
// shoots (acc, dmg, recoil, loud: a suppressed one is heard far less far; unreliable: a converted
// blank-firer's misfires and jams, multiplied).
//
// **Its state** ({ type: 'gun' }):
//   - mag: the box magazine in it, by id (a state of its own, { type: 'mag', fam, n }, its rounds counted:
//     `mag-${family}#…`), or null; tube: the rounds in its tube; cyl: a revolver's chambers ('live', 'spent',
//     'dud', null), pos the one under the hammer, open its cylinder swung out;
//   - chamber: 'live' (ready), 'dud' (a round that didn't go off), 'case' (a spent case caught in the port: a
//     stovepipe; a pump's or a bolt's after every shot till it's worked), or null; a round can be chambered
//     with no magazine in (one shot, then nothing);
//   - jam: null, or 'double' (a double feed: cleared only by the drill, clear()); a dud or a case is cleared
//     by racking (tap-rack); locked: the slide or bolt locked back on an empty magazine;
//   - safety (on or off: 'manual'), or mode (a selector's: 'safe', or one of its modes);
//   - cond (0–1): worn by every round fired (WEAR); under COND_SERVICE it misfires and jams far more
//     (misfire(), jamChance()); below BROKEN it won't fire until it's serviced (SERVICE_MIN, at a table);
//   - known: its holder knows what's in it (their own; a gun picked up is a question until checked: 'check').
//   - snap: the round in the chamber is a dummy (a drill's: a magazine's mag.dummy, the count at which it comes up,
//     slipped in by a coach: sim/tutorial/range.js), which looks live to whoever holds it, and clicks: feed().
// Loose rounds go by the calibre (p.rounds: { '9x19': 30 }), a box of BOX at a time taking room on you.
//
// **Every action on a gun takes its time and a roll** against Weapon handling (ACTIONS: base seconds and a
// DC; act()): time is base × pace(skill) (a long gun's 15% slower in the hands), and the roll, failed, costs
// FUMBLE_K more of it; failed worse (DROP_BY), the gun or the magazine dropped; worse still (DISCHARGE_BY), and
// ready to fire, a shot where it pointed (the caller's to resolve: act() says so). Only a poor hand fails by that
// much: a master's natural 1 is a fumble, an untrained hand's can be a shot.
// Stress and the dark make every action harder (the caller's mods).
import { check } from './checks.js';
import { skill } from './skills.js';
import { chance, next } from './rng.js';

// What each kind of gun is like to use: how far it reaches (sim/shooting.js: a DC by the metre and the
// metre's square), aimed (sight: the sight picture, turn: how quickly it comes round, × a pistol's), held
// (hands: two is a sling, not a pocket), and the most it's aimed out to. A shotgun's shot spreads: easier
// close (close: a DC off within closeM). (My calls, to be tuned in play.)
export const KINDS = {
  pistol: { word: 'a pistol', perM: 0.45, perM2: 0.01, sight: 1, turn: 1, hands: 1, maxM: 60 },
  revolver: { word: 'a revolver', perM: 0.45, perM2: 0.01, sight: 1, turn: 1, hands: 1, maxM: 60 },
  smg: { word: 'a submachine gun', perM: 0.3, perM2: 0.004, sight: 1.05, turn: 0.95, hands: 2, maxM: 100 },
  carbine: { word: 'a carbine', perM: 0.18, perM2: 0.0018, sight: 1.15, turn: 0.85, hands: 2, maxM: 250 },
  rifle: { word: 'a rifle', perM: 0.14, perM2: 0.001, sight: 1.2, turn: 0.8, hands: 2, maxM: 400 },
  dmr: { word: 'a marksman\'s rifle', perM: 0.08, perM2: 0.0004, sight: 1.35, turn: 0.7, hands: 2, maxM: 600 },
  shotgun: { word: 'a shotgun', perM: 0.3, perM2: 0.02, sight: 1.1, turn: 0.85, hands: 2, maxM: 50, close: -3, closeM: 12 },
};
// What a round does (dmg: × the bullet's points, sim/shooting.js); less: less-lethal (a traumatic pistol's rubber).
// word: the cartridge by its name (the user, 2026-11-03: "ammunition shouldn't be 'rounds' it should be very specific
// calibers based on specific caliber magazines used on specific weapons"): a box of it is a box of that.
export const CALIBRES = {
  '9x17': { dmg: 0.8, word: '.380 ACP (9×17 mm)' }, '9x18': { dmg: 0.9, word: '9×18 mm Makarov' }, '9x19': { dmg: 1, word: '9×19 mm Parabellum' },
  '7.62x25': { dmg: 1.05, word: '7.62×25 mm Tokarev' }, '.45': { dmg: 1.15, word: '.45 ACP' }, '.38': { dmg: 0.95, word: '.38 Special' }, '.357': { dmg: 1.25, word: '.357 Magnum' },
  '10x28T': { dmg: 0.2, less: true, word: '10×28 mm T rubber' }, '4.6x30': { dmg: 1.05, word: '4.6×30 mm' }, '9x39': { dmg: 1.45, word: '9×39 mm subsonic' },
  '5.45x39': { dmg: 1.5, word: '5.45×39 mm' }, '5.56x45': { dmg: 1.5, word: '5.56×45 mm NATO' }, '7.62x39': { dmg: 1.7, word: '7.62×39 mm' },
  '7.62x51': { dmg: 2, word: '7.62×51 mm NATO' }, '7.62x54R': { dmg: 2.05, word: '7.62×54 mmR' }, '12ga': { dmg: 2.2, word: '12-gauge buckshot' },
  '.22LR': { dmg: 0.35, word: '.22 Long Rifle' },                   // (a club's rimfire: a target round, sim/scenarios/range.js)
};
/** A calibre by its name ('9×19 mm Parabellum'). */
export const calWord = (cal) => CALIBRES[cal]?.word ?? cal;
/** Every gun, magazine and round off a person: in hand, carried, in the drawer (p.stash), and their states. */
export function disarm(p) {
  if (!p) return;
  const arm = (k) => isGun(k) || isMag(k) || isBox(k);
  if (arm(p.hand)) p.hand = null;
  if (p.items) p.items = p.items.filter(k => !arm(k));
  if (p.stash) p.stash = p.stash.filter(k => !arm(k));
  if (p.stashN) for (const k of Object.keys(p.stashN)) if (isBox(k)) delete p.stashN[k];
  delete p.arms; delete p.rounds;
}

/** A box of loose rounds, as a thing on the ground or in the drawer: `box-${calibre}` (its count kept beside it). */
export const isBox = (id) => typeof id === 'string' && id.startsWith('box-') && !!CALIBRES[id.slice(4)];
export const boxCal = (id) => (isBox(id) ? id.slice(4) : null);
export const boxWord = (cal, n) => `a box of ${calWord(cal)}${n !== undefined ? ` (${n})` : ''}`;
// A box magazine's family: its rounds and its size (one made for a pistol is its model's, MAG_SIZE).
export const FAMILIES = {
  ak545: { word: 'an AK-74 magazine', cap: 30, size: [23, 0.3] }, ak762: { word: 'an AKM magazine', cap: 30, size: [24, 0.32] },
  stanag: { word: 'a STANAG magazine', cap: 30, size: [19, 0.25] }, g36: { word: 'a G36 magazine', cap: 30, size: [20, 0.28] },
  fal: { word: 'a FAL magazine', cap: 20, size: [21, 0.28] }, svd: { word: 'an SVD magazine', cap: 10, size: [16, 0.18] },
  mp5: { word: 'an MP5 magazine', cap: 30, size: [22, 0.2] }, uzi: { word: 'an Uzi magazine', cap: 32, size: [25, 0.2] },
  saiga: { word: 'a Saiga-12 magazine', cap: 8, size: [24, 0.45] }, val: { word: 'an AS Val magazine', cap: 20, size: [18, 0.22] },
  bizon: { word: 'a Bizon\'s helical magazine', cap: 64, size: [30, 0.6] }, mp7: { word: 'an MP7 magazine', cap: 30, size: [18, 0.12] },
  anschutz: { word: 'an Anschütz magazine', cap: 5, size: [8, 0.03] },
};
// The guns (my calls on their numbers; who carries which is their country's).
const P = (o) => ({ kind: 'pistol', action: 'semi', feed: 'mag', safety: 'manual', holdOpen: true, acc: 1, dmg: 1, recoil: 1, loud: 1, ...o });
const L = (o) => ({ action: 'semi', feed: 'mag', safety: 'selector', modes: ['semi', 'auto'], holdOpen: false, acc: 1, dmg: 1, recoil: 0.7, loud: 1.4, ...o });
export const MODELS = {
  // Pistols.
  makarov: P({ name: 'a Makarov PM', short: 'Makarov', cal: '9x18', cap: 8, size: [16, 0.35], acc: 1.1, dmg: 0.9, recoil: 0.9 }),
  pl15: P({ name: 'a Lebedev PL-15K', short: 'PL-15', cal: '9x19', cap: 14, size: [18, 0.4], acc: 0.95, recoil: 0.95 }),
  pya: P({ name: 'a Yarygin PYa', short: 'Yarygin', cal: '9x19', cap: 17, size: [20, 0.55] }),
  gsh18: P({ name: 'a GSh-18', short: 'GSh-18', cal: '9x19', cap: 18, safety: 'none', size: [18, 0.45], recoil: 1.05 }),
  glock17: P({ name: 'a Glock 17', short: 'Glock', cal: '9x19', cap: 17, safety: 'none', size: [20, 0.5], recoil: 0.95 }),
  glock19: P({ name: 'a Glock 19', short: 'Glock 19', cal: '9x19', cap: 15, safety: 'none', size: [18, 0.42] }),
  glock26: P({ name: 'a Glock 26', short: 'Glock 26', cal: '9x19', cap: 10, safety: 'none', size: [16, 0.33], acc: 1.15, recoil: 1.1 }),
  p229: P({ name: 'a SIG P229', short: 'SIG', cal: '9x19', cap: 13, safety: 'none', decocker: true, size: [18, 0.5], acc: 0.95 }),
  p226: P({ name: 'a SIG P226', short: 'P226', cal: '9x19', cap: 15, safety: 'none', decocker: true, size: [20, 0.55], acc: 0.95, recoil: 0.95 }),
  beretta92: P({ name: 'a Beretta 92', short: 'Beretta', cal: '9x19', cap: 15, size: [22, 0.6], acc: 0.95, recoil: 0.95 }),
  cz75: P({ name: 'a CZ 75', short: 'CZ', cal: '9x19', cap: 16, size: [21, 0.55], acc: 0.95, recoil: 0.95 }),
  browning: P({ name: 'a Browning Hi-Power', short: 'Browning', cal: '9x19', cap: 13, size: [20, 0.5] }),
  helwan: P({ name: 'a Helwan', short: 'Helwan', cal: '9x19', cap: 8, size: [21, 0.55], acc: 1.1, recoil: 1.05 }),
  tokarev: P({ name: 'a Tokarev TT', short: 'Tokarev', cal: '7.62x25', cap: 8, safety: 'none', size: [19, 0.45], acc: 1.1, recoil: 1.15 }),
  colt1911: P({ name: 'a Colt 1911', short: '1911', cal: '.45', cap: 7, size: [22, 0.6], acc: 0.95, recoil: 1.25 }),
  ppk: P({ name: 'a Walther PPK', short: 'PPK', cal: '9x17', cap: 7, size: [15, 0.28], acc: 1.15, recoil: 0.9 }),
  canik: P({ name: 'a Canik TP9', short: 'Canik', cal: '9x19', cap: 18, safety: 'none', size: [20, 0.5], acc: 1.05 }),
  converted: P({ name: 'a converted blank-firer', short: 'converted pistol', cal: '9x17', cap: 7, safety: 'none', size: [17, 0.4], acc: 1.4, dmg: 0.9, recoil: 1.1, unreliable: 4 }),
  traumatic: P({ name: 'a traumatic pistol', short: 'traumatic', cal: '10x28T', cap: 10, size: [18, 0.45], acc: 1.3, recoil: 0.9, loud: 0.8 }),
  // Revolvers.
  model10: P({ kind: 'revolver', name: 'a Smith & Wesson Model 10', short: 'Model 10', cal: '.38', cap: 6, action: 'da', feed: 'cylinder', safety: 'none', holdOpen: false, size: [24, 0.55] }),
  sw686: P({ kind: 'revolver', name: 'a Smith & Wesson 686', short: '686', cal: '.357', cap: 6, action: 'da', feed: 'cylinder', safety: 'none', holdOpen: false, size: [26, 0.7], acc: 0.95, recoil: 1.3 }),
  // Submachine guns.
  mp5: L({ kind: 'smg', name: 'an MP5', short: 'MP5', cal: '9x19', cap: 30, mag: 'mp5', size: [55, 2.6], acc: 0.95, recoil: 0.6, loud: 1 }),
  mp5sd: L({ kind: 'smg', name: 'an MP5SD', short: 'MP5SD', cal: '9x19', cap: 30, mag: 'mp5', size: [66, 3], dmg: 0.9, recoil: 0.5, loud: 0.2 }),
  uzi: L({ kind: 'smg', name: 'an Uzi', short: 'Uzi', cal: '9x19', cap: 32, mag: 'uzi', size: [47, 3.5], acc: 1.15, loud: 1 }),
  bizon: L({ kind: 'smg', name: 'a PP-19 Bizon', short: 'Bizon', cal: '9x18', cap: 64, mag: 'bizon', modes: ['auto', 'semi'], size: [46, 2.8], acc: 1.05, dmg: 0.9, recoil: 0.6, loud: 1 }),
  pp2000: L({ kind: 'smg', name: 'a PP-2000', short: 'PP-2000', cal: '9x19', cap: 20, size: [34, 1.4], acc: 1.1, recoil: 0.8, loud: 1 }),
  skorpion: L({ kind: 'smg', name: 'a Skorpion', short: 'Skorpion', cal: '9x17', cap: 20, size: [27, 1], acc: 1.2, dmg: 0.8, recoil: 0.85, loud: 1 }),
  mp7: L({ kind: 'smg', name: 'an MP7', short: 'MP7', cal: '4.6x30', cap: 30, mag: 'mp7', holdOpen: true, size: [42, 1.6], acc: 0.95, recoil: 0.5, loud: 1 }),
  // Assault rifles and carbines.
  ak74m: L({ kind: 'rifle', name: 'an AK-74M', short: 'AK-74M', cal: '5.45x39', cap: 30, mag: 'ak545', modes: ['auto', 'semi'], size: [94, 5] }),
  ak12: L({ kind: 'rifle', name: 'an AK-12', short: 'AK-12', cal: '5.45x39', cap: 30, mag: 'ak545', modes: ['semi', 'burst', 'auto'], burst: 2, holdOpen: true, size: [94, 5.2], acc: 0.92, recoil: 0.65 }),
  aks74u: L({ kind: 'carbine', name: 'an AKS-74U', short: 'AKS-74U', cal: '5.45x39', cap: 30, mag: 'ak545', modes: ['auto', 'semi'], size: [49, 3.2], acc: 1.15, dmg: 0.95, recoil: 0.85, loud: 1.6 }),
  akm: L({ kind: 'rifle', name: 'an AKM', short: 'AKM', cal: '7.62x39', cap: 30, mag: 'ak762', modes: ['auto', 'semi'], size: [88, 4.8], acc: 1.05, recoil: 0.9 }),
  asval: L({ kind: 'carbine', name: 'an AS Val', short: 'Val', cal: '9x39', cap: 20, mag: 'val', size: [62, 3.2], loud: 0.15 }),
  m4: L({ kind: 'carbine', name: 'an M4 carbine', short: 'M4', cal: '5.56x45', cap: 30, mag: 'stanag', holdOpen: true, size: [76, 4], acc: 0.95, recoil: 0.6 }),
  m16a4: L({ kind: 'rifle', name: 'an M16A4', short: 'M16', cal: '5.56x45', cap: 30, mag: 'stanag', modes: ['semi', 'burst'], burst: 3, holdOpen: true, size: [100, 4.5], acc: 0.9, recoil: 0.55 }),
  hk416: L({ kind: 'carbine', name: 'an HK416', short: 'HK416', cal: '5.56x45', cap: 30, mag: 'stanag', holdOpen: true, size: [80, 4.2], acc: 0.9, recoil: 0.55 }),
  mcx: L({ kind: 'carbine', name: 'a SIG MCX', short: 'MCX', cal: '5.56x45', cap: 30, mag: 'stanag', holdOpen: true, size: [65, 3.6], acc: 0.92, recoil: 0.55 }),
  g36c: L({ kind: 'carbine', name: 'a G36C', short: 'G36C', cal: '5.56x45', cap: 30, mag: 'g36', size: [50, 3.4], acc: 0.98, dmg: 0.95, recoil: 0.65, loud: 1.5 }),
  fal: L({ kind: 'rifle', name: 'an FN FAL', short: 'FAL', cal: '7.62x51', cap: 20, mag: 'fal', holdOpen: true, size: [109, 6], acc: 0.95, recoil: 1.2, loud: 1.6 }),
  // Marksman's rifles, and a hunter's.
  svd: L({ kind: 'dmr', name: 'an SVD Dragunov', short: 'SVD', cal: '7.62x54R', cap: 10, mag: 'svd', modes: ['semi'], size: [122, 6], acc: 0.9, recoil: 1.1, loud: 1.6 }),
  hunting: L({ kind: 'dmr', name: 'a bolt-action hunting rifle', short: 'hunting rifle', cal: '7.62x51', cap: 4, action: 'bolt', feed: 'tube', safety: 'manual', modes: undefined, size: [110, 5], acc: 0.9, recoil: 1.2, loud: 1.6 }),
  // A club's target rifle (London's rifle clubs: handguns banned since 1997, a member's guest shoots a .22): a bolt
  // worked after every shot, a five-round box magazine of its own, light, quiet, and very accurate.
  anschutz: L({ kind: 'rifle', name: 'an Anschütz 1416 .22 rifle', short: 'Anschütz', cal: '.22LR', cap: 5, mag: 'anschutz', action: 'bolt', safety: 'manual', modes: undefined, size: [101, 3], acc: 0.85, recoil: 0.25, loud: 0.5 }),
  // Shotguns.
  rem870: L({ kind: 'shotgun', name: 'a Remington 870', short: '870', cal: '12ga', cap: 4, action: 'pump', feed: 'tube', safety: 'manual', modes: undefined, size: [106, 5], recoil: 1.4, loud: 1.6 }),
  saiga12: L({ kind: 'shotgun', name: 'a Saiga-12', short: 'Saiga', cal: '12ga', cap: 8, mag: 'saiga', modes: ['semi'], size: [95, 5], acc: 1.05, recoil: 1.3, loud: 1.6 }),
};
export const MAG_SIZE = [12, 0.06];                               // (a pistol's magazine: cm, litres)
export const BOX = 20, BOX_SIZE = [9, 0.12];                      // (loose rounds, by the box)

export const WEAR = 0.0008;                                       // (condition lost a round fired)
export const COND_SERVICE = 0.6, BROKEN = 0.25;
// (a magazine's own condition, its spring and its lips: fresh MAG_FRESH; worn, it feeds badly, MAG_JAM a shot at none;
// dropped on the ground, MAG_DROP_WEAR off; reconditioned at a table, sim/gunwork.js)
export const MAG_FRESH = 0.95, MAG_JAM = 0.3, MAG_DROP_WEAR = 0.04;
export const SERVICE_MIN = 30;
export const MISFIRE = 0.002, MISFIRE_WORN = 0.05;                 // (a round that doesn't go off: new, and as the gun goes to BROKEN)
export const JAM = 0.004, JAM_WORN = 0.12, JAM_LIMP = 0.03, LIMP_BELOW = 6;   // (a stoppage as it cycles; a weak grip's on a pistol, Weapon handling under LIMP_BELOW)
export const DOUBLE_SHARE = 0.3;                                   // (of stoppages, a double feed; the rest a stovepipe)
// A roll failed (the user, 2026-11-03: "fumbling should have consequences … the consequence should depend on weapons
// handling skill … could result in accidental discharge"): short by under DROP_BY, a fumble, FUMBLE_K more time; by
// DROP_BY, it's dropped (the magazine, putting one in or taking it out); by DISCHARGE_BY, and ready to fire, it
// goes off (sim/shooting.js discharge()). A natural 1 is the hand's: under NAT1_DROP_BELOW Weapon handling a drop,
// NAT1_DROP of the time; under NAT1_SHOT_BELOW (the untrained) a shot NAT1_SHOT of the time too, if it's ready;
// the rest, and better hands always, a fumble.
export const DA_GUARD = 5;                                          // (a fumble decocked: this much worse before it goes off, sim/firearms.js act())
export const FUMBLE_K = 0.6, DROP_BY = 6, DISCHARGE_BY = 10, NAT1_DROP_BELOW = 10, NAT1_SHOT_BELOW = 5, NAT1_SHOT = 0.4, NAT1_DROP = 0.4;
export const PACE = { min: 0.5, max: 1.6, per: 1 / 30 };          // (time × max − skill × per, between min and max)
export const LONG_K = 1.15;                                         // (a long gun's actions, slower in the hands)
export const AUTO_ROUNDS = 4;                                      // (a short burst, on auto: sim/shooting.js)

// The actions, each { label, s (seconds, at pace 1), dc }; draw's time and DC are where it's drawn from (DRAW).
export const ACTIONS = {
  draw: { label: 'Draw', s: 1.2, dc: 8 },
  holster: { label: 'Put it away', s: 1.3, dc: 6 },
  safety: { label: 'Safety', s: 0.4, dc: 6 },
  decock: { label: 'Decock: the hammer down', s: 0.4, dc: 5 },
  selector: { label: 'Selector', s: 0.4, dc: 6 },
  rack: { label: 'Rack the slide', s: 0.8, dc: 8 },
  dropMag: { label: 'Drop the magazine', s: 0.5, dc: 5 },
  stowMag: { label: 'Magazine out, in a pocket', s: 1.4, dc: 7 },
  insertMag: { label: 'A magazine in', s: 1.4, dc: 9 },
  release: { label: 'Slide release', s: 0.3, dc: 6 },
  clear: { label: 'Clear the jam', s: 4, dc: 12 },
  check: { label: 'Check it', s: 1.6, dc: 6 },
  chamber1: { label: 'A round in the chamber, by hand', s: 3, dc: 10 },
  load1: { label: 'A round in', s: 0.9, dc: 6 },
  openCyl: { label: 'Swing the cylinder out', s: 0.6, dc: 5 },
  eject: { label: 'Eject the cylinder', s: 0.7, dc: 5 },
  closeCyl: { label: 'Close the cylinder', s: 0.4, dc: 5 },
  fill: { label: 'Fill a magazine', s: 2.2, dc: 4 },               // (a round's worth: s × the rounds)
};
// Drawn from where it's carried (sim/items.js SPACES): the beltline's an inside-the-waistband holster, the rest pockets; a long gun from its sling.
export const DRAW = { belt: { s: 1.0, dc: 8 }, inside: { s: 1.7, dc: 10 }, coat: { s: 1.6, dc: 10 }, trousers: { s: 2.3, dc: 12 }, sling: { s: 1.6, dc: 9 }, bag: { s: 4, dc: 12 } };

export const isGun = (id) => typeof id === 'string' && MODELS[id.split('#')[0]] !== undefined && id.includes('#');
export const isMag = (id) => typeof id === 'string' && id.startsWith('mag-') && id.includes('#');
export const isArm = (id) => isGun(id) || isMag(id);
export const modelOf = (id) => (isGun(id) ? MODELS[id.split('#')[0]] : null);
export const kindOf = (id) => KINDS[modelOf(id)?.kind] ?? null;
/** A model's magazine family (a pistol's own, by its model), and a family's rounds. */
export const famOf = (model) => MODELS[model]?.mag ?? model;
export const famCap = (fam) => FAMILIES[fam]?.cap ?? MODELS[fam]?.cap ?? 0;
export const magModel = (id) => (isMag(id) ? id.slice(4, id.indexOf('#')) : null);
export const magSize = (id) => FAMILIES[magModel(id)]?.size ?? MAG_SIZE;
/** A gun's or a magazine's name, from its id alone (for the pockets, the drawer, the log). */
export const armName = (id) => (isGun(id) ? modelOf(id).name : isMag(id) ? `${FAMILIES[magModel(id)]?.word ?? `a ${(MODELS[magModel(id)]?.name ?? 'a pistol').replace(/^an? /, '')} magazine`}, ${calWord(famCal(magModel(id)))}` : isBox(id) ? boxWord(boxCal(id)) : null);
/** Whether a long gun (two hands: a sling, not a pocket). */
export const isLong = (id) => (kindOf(id)?.hands ?? 1) > 1;
/** A gun's or a magazine's state ({ type, … }), kept by its holder h (a sheet, or a thing lying about: h.arms), or null. */
export const armOf = (h, id) => h?.arms?.[id] ?? null;
/** What travels with a gun or a magazine moved from one holder to another: its state, and a gun's magazine's. */
export function moveArm(from, to, id) {
  const g = armOf(from, id);
  if (!g) return;
  (to.arms ??= {})[id] = g; delete from.arms[id];
  if (g.type === 'gun' && g.mag && from.arms[g.mag]) { to.arms[g.mag] = from.arms[g.mag]; delete from.arms[g.mag]; }
}

/**
 * A new gun of a model, on p (p.arms), and its id: loaded by default (its magazine full and one in the
 * chamber; a tube full and one chambered; a cylinder full), the safety on (a selector on safe). rounds: how
 * many to load (null: none, and no magazine in).
 */
export function newGun(p, model, { rounds = undefined, chamber = true, safety = true, cond = 0.95, known = true } = {}) {
  const M = MODELS[model], id = `${model}#${nextId(p)}`, n = rounds === undefined ? M.cap : rounds;
  const g = { type: 'gun', model, mag: null, chamber: null, jam: null, locked: false, safety: M.safety === 'manual' ? safety : false, cond, known, by: p.id ?? null };
  if (M.safety === 'selector') g.mode = safety ? 'safe' : M.modes[0];
  if (M.decocker) g.cocked = false;                                 // (a SIG carried as it should be: the hammer down)
  if (M.feed === 'cylinder') { g.cyl = Array.from({ length: M.cap }, (_, i) => (n !== null && i < n ? 'live' : null)); g.pos = M.cap - 1; g.open = false; }
  else if (M.feed === 'tube') { g.tube = n === null ? 0 : Math.min(M.cap, n); if (chamber && n !== null) g.chamber = 'live'; }
  else { if (n !== null) g.mag = newMag(p, model, n); if (chamber && n !== null) g.chamber = 'live'; }
  p.arms[id] = g;
  return id;
}
/** A box magazine made for a model's family, with n rounds in it, p's. */
export function newMag(p, model, n = 0) {
  const fam = famOf(model), id = `mag-${fam}#${nextId(p)}`;
  p.arms[id] = { type: 'mag', fam, n: Math.max(0, Math.min(famCap(fam), n)) };
  return id;
}
// (unique wherever it goes: its first holder's id, and their count)
const nextId = (p) => { p.arms ??= {}; p.nextArm = (p.nextArm ?? 0) + 1; return `${p.id ?? 'x'}.${p.nextArm}`; };

// (the thumb's work, safety, selector, decocker: the pace squared, so the skilled do it as the gun comes up, and
// the untrained fumble for it: the user, 2026-11-03, "high skill makes this virtually instant")
export const INSTANT = new Set(['safety', 'selector', 'decock']);
/** An action's time on this gun for p, in ms (from: where it's drawn from), before any fumble. */
export const stepMs = (p, id, action, from) => Math.round(baseOf(id, action, from).s * (INSTANT.has(action) ? pace(p) ** 2 : pace(p)) * 1000);

/** Weapon handling's pace: a master's twice as fast as the trained, the untrained slower. */
export const pace = (p) => Math.max(PACE.min, Math.min(PACE.max, PACE.max - skill(p, 'weapons') * PACE.per));
/** An action's label on this gun (racking a pump is pumping it). */
export function labelOf(id, action) {
  const M = modelOf(id);
  if (action === 'rack') return M.action === 'pump' ? 'Pump it' : M.action === 'bolt' ? 'Work the bolt' : M.kind === 'pistol' ? 'Rack the slide' : 'Work the charging handle';
  if (action === 'release') return M.kind === 'pistol' ? 'Slide release' : 'Bolt release';
  if (action === 'load1') return M.feed === 'cylinder' ? 'A round in the cylinder' : M.action === 'pump' ? 'A shell in the tube' : 'A round in the magazine';
  return ACTIONS[action]?.label ?? action;
}
/** An action's time on a gun, at pace 1 (seconds): drawn from where, a long gun slower in the hands. */
export function baseOf(id, action, from) {
  const M = modelOf(id), A = ACTIONS[action];
  if (action === 'draw') return DRAW[from] ?? DRAW.coat;
  const s = action === 'load1' && M?.feed === 'cylinder' ? 1.2 : A?.s ?? 0;
  return { s: s * (isLong(id) && action !== 'holster' ? LONG_K : 1), dc: A?.dc ?? 8 };
}

/**
 * What can be done with gun id (its state), held or carried at `where` (a SPACES id, or 'hand'), by p (their
 * magazines and loose rounds): [action ids], in a sensible order.
 */
export function canDo(p, id, where = 'hand') {
  const g = armOf(p, id), M = modelOf(id);
  if (!g || !M) return [];
  if (where !== 'hand') return ['draw'];
  const out = [], loose = p.rounds?.[M.cal] ?? 0;
  if (M.safety === 'manual') out.push('safety');
  if (M.safety === 'selector') out.push('selector');
  if (M.decocker && g.cocked && M.feed === 'mag') out.push('decock');
  if (M.feed === 'cylinder') {
    if (!g.open) out.push('openCyl');
    else { if (g.cyl.some(Boolean)) out.push('eject'); if (g.cyl.some(c => !c) && loose > 0) out.push('load1'); out.push('closeCyl'); }
  } else if (M.feed === 'tube') {
    if (g.chamber || g.tube > 0) out.push('rack');
    if (g.tube < M.cap && loose > 0) out.push('load1');
  } else {
    const mag = g.mag && armOf(p, g.mag);
    if (g.jam === 'double') out.push('clear');
    else if (g.chamber === 'dud' || g.chamber === 'case') out.push('rack');
    else {
      if (mag && g.locked && mag.n > 0) out.push('release');
      if (mag && !g.locked && mag.n > 0 && !g.chamber) out.push('rack');
      if (g.chamber === 'live' && !mag) out.push('rack');           // (to empty it)
    }
    if (g.mag) out.push('dropMag', 'stowMag');
    else if (sparesFor(p, g.model).length) out.push('insertMag');
    if (!g.mag && !g.chamber && loose > 0) out.push('chamber1');
  }
  if (!g.known) out.push('check');
  out.push('holster');
  return [...new Set(out)];
}
/** The magazines someone carries that fit a model, fullest first. */
export const sparesFor = (p, model) => (p.items ?? []).filter(k => isMag(k) && armOf(p, k)?.fam === famOf(model)).sort((a, b) => armOf(p, b).n - armOf(p, a).n);

/**
 * Do it: the time it took (ms) and how it went. p: who (their sheet: Weapon handling, the body's mods);
 * id: the gun; action: ACTIONS's; opts: { from (draw: a SPACES id), mods (the moment's: stress, the dark),
 * mag (insertMag: which), n (fill: how many) }. Returns { ms, ok, roll, mishap: null | 'dropped' | 'dropMag'
 * | 'discharge', did, text, mag (a magazine moved), ejected }, the gun's state changed for what was done (a
 * fumble costs time, not the result; a mishap spoils it). Moving the gun or a magazine between hand, pockets
 * and the ground is the caller's (sim/shooting.js).
 */
export function act(rng, p, id, action, opts = {}) {
  const g = armOf(p, id), M = modelOf(id), A = ACTIONS[action];
  if (!g || !M || !A) return { ms: 0, ok: false, text: 'Nothing to do that with.' };
  const base = action === 'fill' ? { s: A.s * (opts.n ?? 1), dc: A.dc } : baseOf(id, action, opts.from);
  const roll = check(rng, { skill: 'weapons', value: skill(p, 'weapons'), dc: base.dc, mods: opts.mods ?? [], body: p });
  let s = base.s * (INSTANT.has(action) ? pace(p) ** 2 : pace(p));
  if (!roll.ok) s *= 1 + FUMBLE_K;
  const out = { ms: Math.round(s * 1000), ok: roll.ok, roll, mishap: null, did: action, text: '' };
  // (a natural 1's own die: what the hand does with it, by the hand)
  const u = !roll.ok && roll.nat === 1 && roll.value < NAT1_DROP_BELOW ? next(rng) : 1;
  const da = M.decocker && !g.cocked;                                // (the hammer down: a fumbling finger has the long double-action pull to get through)
  const shot = !roll.ok && (roll.margin <= -(DISCHARGE_BY + (da ? DA_GUARD : 0)) || (!da && roll.value < NAT1_SHOT_BELOW && u < NAT1_SHOT));
  const drop = !roll.ok && (shot || roll.margin <= -DROP_BY || u < (roll.value < NAT1_SHOT_BELOW ? NAT1_SHOT : 0) + NAT1_DROP);
  if (drop) {
    // (a mishap: what a fumbling hand does with a gun, worse the worse the hand)
    if (shot && ready(g, M) && ['draw', 'holster', 'safety', 'selector', 'check', 'insertMag', 'closeCyl', 'rack', 'release'].includes(action)) { out.mishap = 'discharge'; out.fired = fire(rng, p, id); }
    else if (['insertMag', 'dropMag', 'stowMag'].includes(action)) out.mishap = 'dropMag';
    else out.mishap = 'dropped';
    out.text = { discharge: 'Your finger\'s inside the trigger guard, and it goes off.', dropMag: 'The magazine slips out of your fingers and clatters away.', dropped: `${M.short} slips out of your hand and clatters on the ground.` }[out.mishap];
    if (out.mishap !== 'dropMag') return out;
  } else if (!roll.ok) out.fumbled = true;
  const mag = g.mag && armOf(p, g.mag), loose = p.rounds?.[M.cal] ?? 0;
  if (M.decocker && (action === 'rack' || action === 'release' || action === 'chamber1')) g.cocked = true;   // (the slide's run: the hammer cocked)
  switch (action) {
    case 'safety': g.safety = !g.safety; out.text = g.safety ? 'Safety on.' : 'Safety off.'; break;
    case 'decock': g.cocked = false; out.text = 'The hammer down: safe to carry, the first pull a long one.'; break;
    case 'selector': { const ring = ['safe', ...M.modes]; g.mode = ring[(ring.indexOf(g.mode) + 1) % ring.length]; out.text = `The selector to ${g.mode === 'safe' ? 'safe' : g.mode}.`; break; }
    case 'rack': {
      if (g.jam === 'double') { out.text = 'It won\'t close: two rounds fighting for the chamber. It wants clearing.'; break; }
      const was = g.chamber, worked = M.action === 'pump' || M.action === 'bolt';
      if (M.feed === 'tube') { g.chamber = g.tube > 0 ? (g.tube--, 'live') : null; delete g.snap; }
      else { if (mag && mag.n > 0) feed(g, mag); else { g.chamber = null; delete g.snap; } g.locked = !!mag && !g.chamber && M.holdOpen; }
      out.ejected = was === 'live' || was === 'dud' ? 'round' : was === 'case' ? 'case' : null;   // (a live round or a dud flies out: on the ground)
      out.text = was === 'dud' ? (g.chamber ? 'The dud out, and there\'s one in.' : 'The dud out, and nothing comes up after it.')
        : was === 'case' ? (worked ? (g.chamber ? `${M.action === 'pump' ? 'Pumped' : 'The bolt worked'}: the case out, one in.` : `The case out, and nothing in the ${M.feed === 'tube' ? 'tube' : 'magazine'}.`) : g.chamber ? 'Tap, rack: it\'s clear, and there\'s one in.' : 'Tap, rack: clear, and nothing comes up after it.')
        : g.chamber ? (was === 'live' ? 'A round flies out; another goes in.' : 'One in the chamber.') : 'It closes on nothing.';
      g.known = true;
      break;
    }
    case 'release': if (mag && mag.n > 0) { feed(g, mag); g.locked = false; out.text = 'It slams home on a fresh round.'; } break;
    case 'dropMag': case 'stowMag': out.mag = g.mag; if (action === 'dropMag' && mag) mag.cond = Math.max(0, (mag.cond ?? MAG_FRESH) - MAG_DROP_WEAR); g.mag = null; out.text = action === 'dropMag' ? 'The magazine drops.' : 'Magazine out, and into a pocket.'; break;
    case 'insertMag': {
      const m = opts.mag ?? sparesFor(p, g.model)[0];
      if (!m || g.mag) { out.text = 'No magazine for it.'; out.ok = false; break; }
      if (out.mishap === 'dropMag') { out.mag = m; break; }
      g.mag = m; out.mag = m; out.text = `A magazine in: ${armOf(p, m).n} rounds.`;
      break;
    }
    case 'clear':
      if (g.jam === 'double') { g.jam = null; if (mag && mag.n > 0) feed(g, mag); else { g.chamber = null; delete g.snap; } out.text = 'Lock, strip, rack, rack, rack, in, rack: clear.'; out.ejected = 'round'; }
      break;
    case 'chamber1':
      if (loose > 0 && !g.chamber && !g.mag) { p.rounds[M.cal] = loose - 1; g.chamber = 'live'; delete g.snap; g.locked = false; out.text = 'One round, by hand, and closed on it.'; }
      break;
    case 'load1':
      if (loose > 0 && M.feed === 'cylinder' && g.open) { const i = g.cyl.indexOf(null); if (i >= 0) { g.cyl[i] = 'live'; p.rounds[M.cal] = loose - 1; out.text = `A round in: ${g.cyl.filter(c => c === 'live').length} of ${M.cap}.`; } }
      else if (loose > 0 && M.feed === 'tube' && g.tube < M.cap) { g.tube++; p.rounds[M.cal] = loose - 1; out.text = `A round in: ${g.tube} in the tube.`; }
      break;
    case 'openCyl': g.open = true; out.text = 'The cylinder swings out.'; break;
    case 'eject': { const live = g.cyl.filter(c => c === 'live').length; out.ejected = live ? 'round' : 'case'; g.cyl = g.cyl.map(() => null); out.text = live ? `Out they come: the empties, and ${live} live on the ground.` : 'The empties tinkle on the ground.'; break; }
    case 'closeCyl': g.open = false; g.known = true; g.pos = g.cyl.length - 1; out.text = 'The cylinder clicks shut.'; break;
    case 'check': g.known = true; out.text = said(p, id); break;
    case 'draw': out.text = `${M.short} out.`; break;
    case 'holster': out.text = `${M.short} away.`; break;
  }
  return out;
}

/** What's in it, in words (a check's, or the sheet's for the holder who knows). */
export function said(h, id) {
  const g = armOf(h, id), M = modelOf(id), mag = g?.mag && armOf(h, g.mag);
  if (!g) return '';
  const safe = M.safety === 'manual' ? `, safety ${g.safety ? 'on' : 'off'}` : M.safety === 'selector' ? `, ${g.mode === 'safe' ? 'on safe' : `on ${g.mode}`}` : M.decocker ? `, the hammer ${g.cocked ? 'cocked' : 'down'} (no safety: a decocker)` : M.feed === 'cylinder' ? '' : ', no manual safety';
  const worn = g.cond < COND_SERVICE ? ', and it wants cleaning' : '';
  if (M.feed === 'cylinder') return `${M.short}: ${g.cyl.filter(c => c === 'live').length} of ${M.cap} loaded${g.open ? ', the cylinder open' : ''}${worn}.`;
  const ch = { live: 'one in the chamber', dud: 'a dud in the chamber', case: M.action === 'pump' || M.action === 'bolt' ? 'a spent case in the chamber' : 'a case stuck in the port', null: 'nothing in the chamber' }[g.chamber];
  const feed = M.feed === 'tube' ? `${g.tube} in the tube` : mag ? `a magazine with ${mag.n} of ${famCap(mag.fam)}` : 'no magazine';
  return `${M.short}: ${ch}, ${feed}${g.jam === 'double' ? ', jammed: a double feed' : ''}${safe}${worn}.`;
}

/** Whether a trigger pull can fire it (a round ready, the safety off, no jam, not broken). */
export function ready(g, M) {
  if (!g || g.cond < BROKEN) return false;
  if (M.safety === 'manual' && g.safety) return false;
  if (M.safety === 'selector' && g.mode === 'safe') return false;
  if (M.feed === 'cylinder') return !g.open && g.cyl.some(c => c === 'live');
  return g.chamber === 'live' && !g.jam;
}
/** The chance a round doesn't go off, by condition (and a converted gun's unreliability). */
export const misfire = (g, M = MODELS[g.model]) => (MISFIRE + MISFIRE_WORN * Math.max(0, Math.min(1, (1 - g.cond) / (1 - BROKEN)))) * (M?.unreliable ?? 1);
/** The chance it jams as it cycles, by condition and the grip (Weapon handling: a pistol's). */
export const jamChance = (g, value, M = MODELS[g.model]) => (JAM + JAM_WORN * Math.max(0, Math.min(1, (1 - g.cond) / (1 - BROKEN))) ** 2 + (value < LIMP_BELOW && M?.kind === 'pistol' ? JAM_LIMP : 0)) * (M?.unreliable ?? 1);

/**
 * The trigger pulled, one round: { fired: did it go off, why (if not: 'safety', 'empty', 'jammed', 'dud',
 * 'broken', 'open', 'case'), stoppage (it fired, and jammed cycling: 'case' | 'double'), empty (the last round
 * gone) }. A pump or a bolt leaves its case in the chamber till it's worked; a revolver turns to the next
 * chamber and fires that. The shot's flight is the caller's (sim/shooting.js).
 */
export function fire(rng, p, id) {
  const g = armOf(p, id), M = modelOf(id);
  if (!g) return { fired: false, why: 'empty' };
  if ((M.safety === 'manual' && g.safety) || (M.safety === 'selector' && g.mode === 'safe')) return { fired: false, why: 'safety' };
  if (g.cond < BROKEN) return { fired: false, why: 'broken' };
  if (M.feed === 'cylinder') {
    if (g.open) return { fired: false, why: 'open' };
    g.pos = (g.pos + 1) % M.cap;                                    // (double action: the pull turns the cylinder, and drops the hammer)
    if (g.cyl[g.pos] !== 'live') return { fired: false, why: 'empty' };
    if (chance(rng, misfire(g, M))) { g.cyl[g.pos] = 'dud'; return { fired: false, why: 'dud' }; }
    g.cyl[g.pos] = 'spent'; g.cond = Math.max(0, g.cond - WEAR);
    return { fired: true, empty: !g.cyl.some(x => x === 'live') };
  }
  if (g.jam) return { fired: false, why: 'jammed' };
  if (g.chamber !== 'live') return { fired: false, why: g.chamber === 'case' && (M.action === 'pump' || M.action === 'bolt') ? 'case' : g.chamber ? 'jammed' : 'empty' };
  if (g.snap) { delete g.snap; g.chamber = 'dud'; return { fired: false, why: 'dud', dummy: true }; }   // (a drill's dummy round: it clicks, as a dud does)
  if (chance(rng, misfire(g, M))) { g.chamber = 'dud'; return { fired: false, why: 'dud' }; }
  g.cond = Math.max(0, g.cond - WEAR);
  const mag = g.mag && armOf(p, g.mag);
  if (M.action === 'pump' || M.action === 'bolt') { g.chamber = 'case'; return { fired: true, empty: M.feed === 'tube' ? g.tube === 0 : !mag || mag.n === 0 }; }
  if (chance(rng, jamChance(g, skill(p, 'weapons'), M) + (mag ? MAG_JAM * Math.max(0, 0.9 - (mag.cond ?? MAG_FRESH)) : 0))) {
    const double = chance(rng, DOUBLE_SHARE) && mag && mag.n > 0;
    g.chamber = double ? null : 'case'; g.jam = double ? 'double' : null;
    return { fired: true, stoppage: double ? 'double' : 'case' };
  }
  if (M.decocker) g.cocked = true;                                  // (the slide's run back: the hammer cocked for the next)
  if (mag && mag.n > 0) { feed(g, mag); return { fired: true }; }
  g.chamber = null; g.locked = !!mag && M.holdOpen;
  return { fired: true, empty: true };
}

/**
 * The top round off magazine `mag` into gun g's chamber: live, or the dummy a coach slipped in (mag.dummy, the count
 * at which it comes up: then g.snap, a round that looks live and clicks, fire()). Every way a round's chambered from a
 * magazine goes through here (the trigger's cycle, a rack, the slide release, a jam cleared, sim/gunwork.js load).
 */
export function feed(g, mag) {
  const dummy = mag.dummy !== undefined && mag.dummy === mag.n;
  mag.n--;
  if (mag.dummy !== undefined && (dummy || mag.dummy > mag.n)) delete mag.dummy;
  g.chamber = 'live';
  if (dummy) g.snap = true; else delete g.snap;
}

/** Stripped and cleaned (SERVICE_MIN, at a table): its condition back, and any jam out. */
export function service(p, id) {
  const g = armOf(p, id);
  if (!g) return;
  g.cond = Math.max(g.cond, 0.95); g.jam = null;
  if (g.chamber === 'dud' || g.chamber === 'case') g.chamber = null;
  delete g.snap;
}

/** The calibre a magazine family takes (any model it's made for). */
export const famCal = (fam) => MODELS[fam]?.cal ?? Object.values(MODELS).find(M => M.mag === fam)?.cal ?? null;
/** Rounds into a magazine from what's loose (p.rounds by calibre): how many went in. */
export function fillMag(p, magId, n = Infinity) {
  const m = armOf(p, magId), cal = m && famCal(m.fam);
  if (!m || !cal) return 0;
  const k = Math.min(n, famCap(m.fam) - m.n, p.rounds?.[cal] ?? 0);
  if (k <= 0) return 0;
  m.n += k; p.rounds[cal] -= k;
  return k;
}
