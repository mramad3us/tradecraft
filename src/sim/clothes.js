// TRADECRAFT sim: what you wear, what you own, what you buy and take home (the user, 2026-10-28: "is there a
// way to change in the flat ? We should be able to, also we should be able to buy objects and clothes in
// stores and bring them home").
//
// What's worn is the look (sim/people.js): its top (a coat, a jacket, a jumper, a suit), its hat, its
// glasses; one piece in each slot (SLOTS). What else a person owns waits at home: p.wardrobe, pieces
// { id, slot, name, look } (the look the slot's: a top's { kind, color, trim, belt }, a hat's { kind,
// color, band }, glasses' 'specs' or 'shades'); and p.stash, things left in the flat's drawer (kinds of
// sim/weapons.js: a penknife, a bottle, an umbrella).
//
// Bought (sim/shops.js): a piece off a shop's rail (RAIL, by the kind of shop: a clothes shop's coats,
// jackets, jumpers and hats, a hood on the parka and the anorak for the rain (the view's: src/render/view.js
// rainwearOf(); without one, an umbrella in the hand or wet); an optician's glasses) is put on there and then, a change of clothes that
// whoever was looking for the old ones looks past; what it replaced goes into the shop's bag. A thing
// (GOODS: an umbrella, a penknife, a bottle of wine, a kitchen knife; a burner, a prepaid phone, counted
// on p.burners; a chemist's supplies, a grocer's bandages and painkillers, counted on p.kit:
// sim/medicine.js) goes into the hand if it's a weapon and that's empty, a pocket if there's room
// (sim/items.js: burners and supplies take up room like anything else), else the bag. The bag (p.bag) is
// carried, and shows (a carrier bag in the hand); at home it's unpacked (unpack()): clothes into the
// wardrobe, things into the drawer, supplies into the bathroom cabinet.
// At the wardrobe (dress()): a piece put on (what it replaces hung up), a hat or glasses taken off,
// something carried left in the drawer, something in the drawer taken. A top with fewer pockets leaves
// things with nowhere to go: they go in the bag (shed()), so at home they're put away.
// At the basin (cabinetWays(), cabinetDo()): the cabinet over it, what's in it taken out one thing at a
// time, if there's room, and what's on you put back. Nothing comes out of it unasked (the user,
// 2026-10-31: "i never asked to take the medication when washing up").
import { weaponOf } from './weapons.js';
import { armName, isBox, boxCal, boxWord } from './firearms.js';
import { bookOf } from './training.js';
import { fits, fitsSupply, placed, ALWAYS } from './items.js';
import { hash } from './rng.js';
import { SOLD, KIT, goodOf, addSupply, SUPPLIES, packsOf, supplyWord } from './medicine.js';

export const SLOTS = ['top', 'hat', 'glasses'];
export const DRESS_S = 4 * 60;                                     // (changing, at home)
const COLOURS = {
  0x353947: 'charcoal', 0x4c5262: 'grey', 0x23252f: 'black', 0x47302a: 'brown', 0x6b4636: 'brown', 0x8f6345: 'camel', 0xd6ad7a: 'beige',
  0x24503a: 'green', 0x283f6b: 'navy', 0x6e2a2e: 'maroon', 0x6a7182: 'grey', 0x2f6b62: 'teal', 0x4a2a52: 'plum', 0x9e3c36: 'red',
  0xc95c45: 'rust', 0x3b6296: 'blue', 0x4f5b3a: 'olive', 0xb8a27a: 'stone', 0xf6f4ee: 'white', 0x8f96a6: 'pale grey',
};
const TOPS = { coat: 'coat', suit: 'suit', sweater: 'jumper', tee: 'T-shirt', dress: 'dress', jacket: 'jacket', uniform: 'uniform' };
const HATS = { fedora: 'fedora', cap: 'flat cap', beanie: 'beanie', peaked: 'peaked cap', skullcap: 'skullcap', hijab: 'headscarf' };
const GLASSES = { specs: 'reading glasses', shades: 'sunglasses' };

// What's on the rails, by the kind of shop: { id, slot, name, look, usd }.
const top = (id, kind, color, usd, extra = {}) => ({ id, slot: 'top', look: { kind, color, trim: extra.trim ?? 0x23252f, ...(extra.belt ? { belt: extra.belt } : {}), ...(extra.hood ? { hood: true } : {}) }, usd, name: extra.name });
export const RAIL = {
  clothes: [
    top('coat-charcoal', 'coat', 0x353947, 160), top('coat-camel', 'coat', 0x8f6345, 180), top('coat-navy', 'coat', 0x283f6b, 150),
    top('trench', 'coat', 0xd6ad7a, 170, { belt: 0x8f6345, name: 'the beige trench coat' }), top('parka', 'coat', 0x4f5b3a, 130, { trim: 0x47302a, name: 'the olive parka', hood: true }), top('anorak', 'jacket', 0x283f6b, 90, { name: 'the navy anorak', hood: true }),
    top('jacket-black', 'jacket', 0x23252f, 140, { name: 'the black leather jacket' }), top('jacket-brown', 'jacket', 0x6b4636, 140, { name: 'the brown leather jacket' }),
    top('jumper-grey', 'sweater', 0x6a7182, 45), top('jumper-navy', 'sweater', 0x283f6b, 45), top('jumper-maroon', 'sweater', 0x6e2a2e, 45),
    { id: 'cap', slot: 'hat', look: { kind: 'cap', color: 0x6b4636, band: 0x47302a }, usd: 25 }, { id: 'beanie-black', slot: 'hat', look: { kind: 'beanie', color: 0x23252f, band: 0x23252f }, usd: 15 },
    { id: 'beanie-red', slot: 'hat', look: { kind: 'beanie', color: 0x9e3c36, band: 0x9e3c36 }, usd: 15 }, { id: 'fedora', slot: 'hat', look: { kind: 'fedora', color: 0x4c5262, band: 0x23252f }, usd: 60 },
  ],
  optician: [{ id: 'specs', slot: 'glasses', look: 'specs', usd: 40 }, { id: 'shades', slot: 'glasses', look: 'shades', usd: 30 }],
};
// Things a shop sells, by its kind: [kind (sim/weapons.js), what it is, $].
export const GOODS = {
  clothes: [['umbrella', 'an umbrella', 20]], tobacco: [['penknife', 'a penknife', 15]], phones: [['burner', 'a burner: a prepaid phone, no name on it', 25]],
  grocery: [['bottle', 'a bottle of wine', 8], ['kitchen', 'a kitchen knife', 12]], deli: [['bottle', 'a bottle of wine', 14]], beer: [['bottle', 'a bottle of beer', 3]],
};
for (const [shop, kinds] of Object.entries(SOLD)) for (const k of kinds) (GOODS[shop] ??= []).push([k, ...goodOf(k)]);

/** A piece's name ("the camel coat", "the flat cap", "the sunglasses"). */
export function nameOf(slot, look) {
  if (slot === 'glasses') return `the ${GLASSES[look] ?? 'glasses'}`;
  if (slot === 'hat') return `the ${look.kind === 'beanie' || look.kind === 'cap' ? `${COLOURS[look.color] ?? 'dark'} ` : ''}${HATS[look.kind] ?? 'hat'}`;
  return `the ${COLOURS[look.color] ?? 'dark'} ${TOPS[look.kind] ?? 'coat'}`;
}

/** What's worn in a slot, as a piece (null if nothing). */
export function worn(p, slot) {
  const look = p.look?.[slot];
  if (!look) return null;
  return { id: `own-${hash(JSON.stringify(look)) % 1e8}`, slot, look: structuredClone(look), name: nameOf(slot, look) };
}

/** Put a piece on; what was worn in its slot comes off (returned, a piece, or null). A hat is never forced off a headscarf. */
export function putOn(p, piece) {
  const was = worn(p, piece.slot);
  p.look = { ...p.look, [piece.slot]: structuredClone(piece.look) };
  return was;
}

/** Take off what's worn in a slot (a hat, glasses): returned as a piece. */
export function takeOff(p, slot) {
  const was = worn(p, slot);
  if (was) { const { [slot]: _, ...rest } = p.look; p.look = rest; }
  return was;
}

/** A rail's pieces at a kind of shop, named, without what the person's wearing now. */
export const railOf = (shop, p) => (RAIL[shop] ?? []).map(x => ({ ...x, name: x.name ?? nameOf(x.slot, x.look) })).filter(x => JSON.stringify(x.look) !== JSON.stringify(p?.look?.[x.slot]));

const thingName = (k) => weaponOf(k)?.name ?? armName(k) ?? (k === 'burner' ? 'a burner' : k);
/** What's in the shop's bag, in words: a thing, some supplies, a piece of clothing. */
export const bagWord = (x) => (x.supply ? supplyWord(x.supply, x.n) : x.item ? thingName(x.item) : x.book ? bookOf(x.book).title : x.name);
// (supplies into the bag: one entry a kind, so they stay counted)
const bagSupply = (p, kind, n) => { const had = p.bag?.find(x => x.supply === kind); if (had) had.n += n; else (p.bag ??= []).push({ supply: kind, n }); };

/** A thing bought or taken: a weapon into the hand if empty, then a pocket if there's room, else the bag. Where it went: 'hand' | 'pocket' | 'bag' | 'some' (a first-aid kit: part of each). */
export function carry(p, kind) {
  if (kind === 'burner') {
    if (fits(p, 'burner')) { p.burners = (p.burners ?? 0) + 1; return 'pocket'; }
    (p.bag ??= []).push({ item: 'burner' });
    return 'bag';
  }
  if (kind === 'firstaid' || SUPPLIES[kind]) {
    let pocket = 0, bag = 0;
    for (const [k, n] of Object.entries(kind === 'firstaid' ? KIT : { [kind]: SUPPLIES[kind].uses })) for (const uses of packsOf(k, n)) {
      if (fitsSupply(p, k, uses)) { addSupply(p, { [k]: uses }); pocket++; } else { bagSupply(p, k, uses); bag++; }
    }
    return !bag ? 'pocket' : pocket ? 'some' : 'bag';
  }
  if (!p.hand && weaponOf(kind)) { p.hand = kind; return 'hand'; }
  if (fits(p, kind)) { (p.items ??= []).push(kind); return 'pocket'; }
  (p.bag ??= []).push({ item: kind });
  return 'bag';
}

/** A top changed: what no longer has anywhere to go (not the wallet and the phone, which stay with you whatever you wear), into the bag. Returns how many things. */
export function shed(p) {
  const gone = placed(p).out.filter(o => o.at === null && !ALWAYS.includes(o.kind));
  for (const o of gone) {
    if (o.kind === 'burner') { if (!--p.burners) delete p.burners; (p.bag ??= []).push({ item: 'burner' }); }
    else if (o.kind === 'book') { p.books.find(b => b.id === o.id).at = 'bag'; (p.bag ??= []).push({ book: o.id }); }
    else if (SUPPLIES[o.kind]) { p.kit[o.kind] -= o.n; if (!(p.kit[o.kind] > 0)) delete p.kit[o.kind]; if (!Object.keys(p.kit).length) delete p.kit; bagSupply(p, o.kind, o.n); }
    else { p.items.splice(p.items.indexOf(o.kind), 1); (p.bag ??= []).push({ item: o.kind }); }
  }
  return gone.length;
}

/** Home: the bag unpacked, clothes into the wardrobe, things into the drawer, supplies into the cabinet (the campaign's, if given). Returns what was in it, in words, or null. */
export function unpack(p, cabinet = null) {
  if (!p.bag?.length) return null;
  const words = p.bag.map(bagWord);
  for (const x of p.bag) {
    if (x.supply) { if (cabinet) cabinet[x.supply] = (cabinet[x.supply] ?? 0) + x.n; else addSupply(p, { [x.supply]: x.n }); }
    else if (x.book) { const b = p.books?.find(o => o.id === x.book); if (b) b.at = 'home'; }   // (onto the flat's shelf: sim/reading.js)
    else if (x.item) (p.stash ??= []).push(x.item);
    else (p.wardrobe ??= []).push(x);
  }
  delete p.bag;
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0];
}

/** At the basin: [{ key, label, off: why not, if it can't }]: each thing in the cabinet to take, each supply on you to put back. */
export function cabinetWays(p, cabinet) {
  const out = [];
  for (const [k, n] of Object.entries(cabinet ?? {})) {
    if (!(n > 0) || !SUPPLIES[k]) continue;
    const u = packsOf(k, n)[0];
    out.push({ key: `take:${k}`, label: `Take ${supplyWord(k, u)}${n > u ? `, of the ${n} there` : ''}`, off: fitsSupply(p, k, u) ? null : 'no room about you' });
  }
  for (const [k, n] of Object.entries(p.kit ?? {})) {
    if (!(n > 0) || !SUPPLIES[k]) continue;
    const u = packsOf(k, n).at(-1);
    out.push({ key: `put:${k}`, label: `Put ${supplyWord(k, u)} in the cabinet${n > u ? `, of the ${n} on you` : ''}` });
  }
  return out;
}

/** Do a cabinet's way (cabinetWays()), one thing at a time: a line for the log, or null if it couldn't be done. */
export function cabinetDo(p, cabinet, key) {
  const [what, k] = key.split(':');
  if (what === 'take') {
    const n = cabinet[k] ?? 0, u = packsOf(k, n)[0];
    if (!u || !fitsSupply(p, k, u)) return null;
    if (n > u) cabinet[k] = n - u; else delete cabinet[k];
    addSupply(p, { [k]: u });
    return `From the cabinet, into a pocket: ${supplyWord(k, u)}.`;
  }
  if (what === 'put') {
    const n = p.kit?.[k] ?? 0, u = packsOf(k, n).at(-1);
    if (!u) return null;
    if (n > u) p.kit[k] = n - u; else { delete p.kit[k]; if (!Object.keys(p.kit).length) delete p.kit; }
    cabinet[k] = (cabinet[k] ?? 0) + u;
    return `Back in the cabinet: ${supplyWord(k, u)}.`;
  }
  return null;
}

/**
 * At the wardrobe: what can be done ([{ key, label }]): a piece hung up put on; a hat, glasses taken off;
 * what's carried left in the drawer; what's in the drawer taken.
 */
export function wardrobeWays(p) {
  const out = [];
  for (const x of p.wardrobe ?? []) out.push({ key: `wear:${x.id}`, label: `Put on ${x.name}${p.look?.[x.slot] ? `, for ${nameOf(x.slot, p.look[x.slot])}` : ''}` });
  for (const slot of ['hat', 'glasses']) if (p.look?.[slot] && p.look[slot].kind !== 'hijab') out.push({ key: `off:${slot}`, label: `Take off ${nameOf(slot, p.look[slot])}` });
  for (const k of [p.hand, ...(p.items ?? [])].filter(Boolean)) out.push({ key: `leave:${k}`, label: `Leave ${thingName(k)} in the drawer` });
  for (const [cal, n] of Object.entries(p.rounds ?? {})) if (n > 0) out.push({ key: `leave:box-${cal}`, label: `Leave ${boxWord(cal, n)} in the drawer` });   // (loose rounds, by the box: sim/firearms.js)
  (p.stash ?? []).forEach((k, i) => out.push({ key: `take:${i}`, label: `Take ${isBox(k) ? boxWord(boxCal(k), p.stashN?.[k] ?? 0) : thingName(k)} from the drawer` }));
  return out;
}

/** Do a wardrobe's way (wardrobeWays()): a line for the log, or null if it couldn't be done. */
export function dress(p, key) {
  const [what, arg] = key.split(':');
  if (what === 'wear') {
    const i = (p.wardrobe ?? []).findIndex(x => x.id === arg);
    if (i < 0) return null;
    const piece = p.wardrobe.splice(i, 1)[0], was = putOn(p, piece), wet = (p.wet ?? 0) >= 30;
    if (was) p.wardrobe.push(was);
    delete p.wet; delete p.shiver;                                   // (dry clothes: sim/wet.js)
    return `${cap(piece.name)} on${was ? `, ${was.name} on its hanger${wet ? ' to dry' : ''}` : ''}.${wet ? ' Dry, at last.' : ''}`;
  }
  if (what === 'off') {
    const was = takeOff(p, arg);
    if (!was) return null;
    (p.wardrobe ??= []).push(was);
    return `${cap(was.name)} off, and put away.`;
  }
  if (what === 'leave' && isBox(arg)) {                               // (a box of rounds: the lot of that calibre, counted, p.stashN)
    const cal = boxCal(arg), n = p.rounds?.[cal] ?? 0;
    if (!n) return null;
    delete p.rounds[cal];
    if (!(p.stash ??= []).includes(arg)) p.stash.push(arg);
    (p.stashN ??= {})[arg] = (p.stashN[arg] ?? 0) + n;
    return `${cap(boxWord(cal, p.stashN[arg]))} in the drawer.`;
  }
  if (what === 'leave') {
    if (p.hand === arg) p.hand = null;
    else { const i = (p.items ?? []).indexOf(arg); if (i < 0) return null; p.items.splice(i, 1); }
    (p.stash ??= []).push(arg);
    return `${cap(thingName(arg))} in the drawer.`;
  }
  if (what === 'take') {
    const k = p.stash?.[Number(arg)];
    if (!k) return null;
    p.stash.splice(Number(arg), 1);
    if (isBox(k)) { const cal = boxCal(k), n = p.stashN?.[k] ?? 0; delete p.stashN?.[k]; (p.rounds ??= {})[cal] = (p.rounds[cal] ?? 0) + n; return `${cap(boxWord(cal, n))} from the drawer, in a pocket.`; }
    const at = carry(p, k);
    return `${cap(thingName(k))} from the drawer, ${at === 'hand' ? 'in your hand' : at === 'pocket' ? 'in a pocket' : 'in the bag'}.`;
  }
  return null;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
