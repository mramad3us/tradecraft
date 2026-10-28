// TRADECRAFT sim: a shop's ground floor, behind its door and its window on the street (the user,
// 2026-10-27: "let's build a lot of interiors ... supermarkets etc, bakeries should be built etc, and doing
// the things like going out the back should be a thing we do when inside and not abstracted"). A plan
// (sim/interiors/plan.js) in the street's own coordinates, set into its building by the street
// (sim/map/street.js section()): the front room behind the window, its glass in the street side's wall
// (cut low for the camera), the door you came in by beside it; the back room behind, through a staff
// door; and, where the shop has a way out the back, the back door in the back room's wall, out through
// the yard into the lane beside (sim/shops.js backLane()). Its walls block the eyes; its window doesn't,
// either way: whoever's on the pavement sees in, and you see out.
//
// What's in it, by the kind of shop (FIT), from the furniture kit (sim/interiors/furniture.js): a
// grocer's shelves and drinks fridges and, wide enough, an aisle; a bakery's display case, its bread
// racks, the oven and the work table at the back; a café's (a bar's, a restaurant's, a kebab shop's)
// counter, its ledge along the window, the kitchen and its toilet at the back; a clothes shop's rails,
// its fitting room and mirror; a bookshop's shelves; a florist's buckets; a bank's or a bureau's
// counter behind its glass; a gym's mats, a club's, a school's desks; and anything else, shelves.
// Every one has its counter, someone behind it, and what's done where (spots): 'counter' (what the
// shop sells: sim/shops.js ways()), 'sit' (a café's ledge in its window: the street watched through
// the glass), 'wash' (a café's toilet). The way out the back (exits) is the back door's.
import { stream, int, pick, chance, range } from '../rng.js';
import { FURNITURE } from './furniture.js';

export const FRONT_M = 4.8, BACK_M = 3.0;                           // (the rooms' depths, front to back)
const KIND = {
  grocery: 'grocer', deli: 'grocer', vegetables: 'grocer', spices: 'grocer', butcher: 'grocer', beer: 'grocer', tobacco: 'kiosk',
  bakery: 'bakery', sweets: 'bakery', manakish: 'bakery',
  cafe: 'cafe', restaurant: 'cafe', bar: 'cafe', pub: 'cafe', shawarma: 'cafe', kebab: 'cafe', chips: 'cafe', koshary: 'cafe', foul: 'cafe', juice: 'cafe',
  clothes: 'clothes', shoes: 'clothes', books: 'books', flowers: 'flowers', pharmacy: 'chemist', optician: 'chemist', phones: 'chemist', watches: 'chemist',
  bank: 'bank', exchange: 'bank', bookie: 'bank', estate: 'office', school: 'school', gym: 'gym', club: 'gym', barber: 'office', laundry: 'kiosk',
};
/** What a kind of shop's floor is ('grocer', 'bakery', 'cafe', 'clothes'…): what's in it. */
export const floorKind = (shop) => KIND[shop] ?? 'kiosk';
const FLOOR = { grocer: 'tiles', kiosk: 'lino', bakery: 'terrazzo', cafe: 'planks', clothes: 'planks', books: 'planks', flowers: 'tiles', chemist: 'tiles', bank: 'terrazzo', office: 'lino', school: 'lino', gym: 'lino' };
const PAINT = { grocer: 0xe8ecef, kiosk: 0xd6ccb8, bakery: 0xe8dcc4, cafe: 0xc9a27a, clothes: 0xe2dac6, books: 0xb4bfa0, flowers: 0xd0d8c0, chemist: 0xe8ecef, bank: 0xd9d2c0, office: 0xd6ccb8, school: 0xd0d8c0, gym: 0xc8d4dc };

/**
 * The ground floor behind shop door d (its pane west of it) in building B: a plan, or null if there's no
 * room. back: whether it has a way out the back.
 */
export function shopUnit(B, d, { seed, back = false } = {}) {
  const kind = floorKind(d.shop), r = stream('shop-unit', seed, Math.round(d.x * 10));
  const x0 = Math.max(B.x0 + 0.15, (d.pane?.x0 ?? d.x - 2.5) - 0.2), x1 = Math.min(B.x1 - 0.15, d.x + d.w / 2 + 0.25), W = x1 - x0;
  if (W < 3) return null;
  const z1 = B.z, zf = z1 - FRONT_M, z0 = zf - BACK_M;
  const rooms = [{ id: 'front', kind: 'shop', x0, z0: zf, x1, z1 }, { id: 'back', kind: 'stock', x0, z0, x1, z1: zf }];
  // (the staff door at the room's west end, the counter at its east by the door you came in at; the back door over the staff door's way)
  const sx = x0 + 0.3, openings = [
    { axis: 'x', at: z1, a: d.x - d.w / 2, b: d.x + d.w / 2, kind: 'doorway' },
    { axis: 'x', at: zf, a: sx, b: sx + 0.9, kind: 'door' },
    ...(back ? [{ axis: 'x', at: z0, a: x0 + 0.4, b: x0 + 1.3, kind: 'back' }] : []),
  ];
  const items = [], spots = [];
  const put = (k, x, z, face = 'down', look = {}) => { items.push({ kind: k, x, z, face, look }); return items[items.length - 1]; };
  const along = (kinds, z, from, to, look = {}) => { let x = from; for (const k of kinds) { const w = FURNITURE[k].w; if (x + w > to) break; put(k, x + w / 2, z + FURNITURE[k].d / 2, 'down', look); x += w + 0.05; } };
  // The counter: by the street door, facing into the room; behind it, whoever serves.
  const counter = kind === 'cafe' ? 'cafeCounter' : kind === 'bank' ? 'bankCounter' : kind === 'bakery' ? 'displayCase' : 'shopCounter';
  const cw = FURNITURE[counter].w, cx = Math.min(x1 - cw / 2 - 0.15, Math.max(x0 + 1.4 + cw / 2, d.x - 0.2)), cz = zf + 1.3;
  put(counter, cx, cz, 'down', counter === 'displayCase' ? { goods: pick(r, ['bread', 'pastries', 'cakes']) } : {});
  spots.push({ kind: 'counter', x: cx, z: cz + FURNITURE[counter].d / 2 + 0.55, face: 'up' });
  const staff = { x: cx, z: cz - FURNITURE[counter].d / 2 - 0.45 };
  // Along the front room's back wall, east of the staff door: the kind's own.
  const wallFrom = sx + 1.0, wallTo = x1 - 0.1;
  if (kind === 'grocer' || kind === 'kiosk') along(['shelving', 'drinksFridge', 'shelving', 'shelving'], zf + 0.02, wallFrom, wallTo, { goods: pick(r, ['groceries', 'tins', 'bottles']) });
  else if (kind === 'bakery') along(['breadRack', 'breadRack', 'breadRack'], zf + 0.02, wallFrom, wallTo);
  else if (kind === 'cafe') along([d.shop === 'bar' || d.shop === 'pub' ? 'barShelf' : 'shelving'], zf + 0.02, wallFrom, wallTo, { goods: 'bottles' });
  else if (kind === 'clothes') { along(['mirror', 'fittingRoom'], zf + 0.02, wallFrom, wallTo); }
  else if (kind === 'books') along(['shelving', 'shelving', 'shelving', 'shelving'], zf + 0.02, wallFrom, wallTo, { goods: 'books' });
  else if (kind === 'chemist') along(['shelving', 'shelving', 'shelving'], zf + 0.02, wallFrom, wallTo, { goods: d.shop === 'phones' ? 'phones' : 'boxes' });
  else if (kind === 'flowers') along(['flowerBuckets', 'flowerBuckets', 'flowerBuckets'], zf + 0.02, wallFrom, wallTo);
  else if (kind === 'bank') along(['filingCabinet', 'filingCabinet'], zf + 0.02, wallFrom, wallTo);
  else along(['shelving', 'shelving'], zf + 0.02, wallFrom, wallTo, { goods: 'boxes' });
  // The room's middle, west of the counter, where there's room: an aisle, the rails, a table or two.
  const mid0 = x0 + 0.5, mid1 = cx - cw / 2 - 0.6;
  if (mid1 - mid0 >= 1.9) {
    const mx = (mid0 + mid1) / 2, mz = zf + 2.3;
    if (kind === 'grocer' && mid1 - mid0 >= 2.0) put('gondola', mx, mz, 'down', { goods: 'groceries' });
    else if (kind === 'clothes') put('clothesRail', mx, mz, 'down');
    else if (kind === 'books') put('gondola', mx, mz, 'down', { goods: 'books' });
    else if (kind === 'bank' || kind === 'office' || kind === 'school') put('waitingChairs', mx, z1 - 0.6, 'up');
    else if (kind === 'gym') put('rug', mx, mz, 'down', { pattern: 'plain', colours: [0x3b6296, 0x283f6b] });
  }
  // A café's ledge along its window: a coffee stood at it, the street on the other side of the glass.
  if (kind === 'cafe' && d.pane && d.pane.x1 - d.pane.x0 >= 1.8) {
    const bw = FURNITURE.windowBar.w, bx = Math.max(x0 + bw / 2 + 0.1, Math.min(d.pane.x1 - bw / 2 - 0.1, (d.pane.x0 + d.pane.x1) / 2)), bz = z1 - 0.18 - FURNITURE.windowBar.d / 2;
    put('windowBar', bx, bz, 'down');
    spots.push({ kind: 'sit', x: bx - 0.35, z: bz - FURNITURE.windowBar.d / 2 - 0.32, face: 'down' });
  }
  // The back room: stock, or the bakery's oven, or the kitchen and the toilet.
  if (kind === 'bakery') { along(['deckOven'], z0 + 0.02, x0 + 1.6, x1 - 0.1); put('workTable', Math.min(x1 - 1.0, x0 + 2.6), zf - 1.1); }
  else if (kind === 'cafe') {
    along(['range', 'steelSink'], z0 + 0.02, x0 + 1.6, x1 - 1.1);
    put('toilet', x1 - 0.4, z0 + 0.45, 'down');
    put('washbasin', x1 - 0.4, zf - 0.35, 'up');
    spots.push({ kind: 'wash', x: x1 - 1.05, z: zf - 0.6, face: 'right' });
  } else along(['crates', 'pallet'], z0 + 0.05, x0 + 1.6, x1 - 0.1);
  // (its lights, lamps of the street's kind (sim/light.js): the front room's well back from the glass, so its
  // light falls on whoever's inside, not on the pavement; strip lights' blue-white in a grocer's, a bank, warm elsewhere)
  const cool = kind === 'grocer' || kind === 'chemist' || kind === 'bank' || kind === 'gym';
  const lights = [{ x: (x0 + x1) / 2, z: z1 - 2.6, r: 1.9, core: 0.55, ring: 0.18, room: 'front', color: cool ? 0xe0e8f0 : 0xf8e0b0 },
    { x: (x0 + x1) / 2, z: (z0 + zf) / 2, r: 1.5, core: 0.4, ring: 0.12, room: 'back', color: 0xf8e0b0 }];
  rooms[0].floor = FLOOR[kind]; rooms[0].paint = PAINT[kind]; rooms[0].wall = { kind: 'paint', c1: PAINT[kind] };
  rooms[1].floor = 'lino'; rooms[1].paint = 0xc4bba9; rooms[1].wall = { kind: 'paint', c1: 0xc4bba9 };
  rooms[0].floorColor = 0xb48459; rooms[1].floorColor = 1;
  return {
    kind: 'shop', shop: d.shop, door: d.x, x0, z0, x1, z1, rooms, openings, items, spots, lights, staff,
    windows: [], windowsS: d.pane ? [{ a: d.pane.x0 + 0.05, b: d.pane.x1 - 0.05 }] : [],
    exits: back ? [{ id: 'back', x0: x0 + 0.4, z0: z0 - 0.3, x1: x0 + 1.3, z1: z0 + 0.3, to: 'lane' }] : [],
    look: { floor: 0xb48459, seed: int(r, 1e6) }, decor: [],
  };
}
