// TRADECRAFT sim: furniture, as the sim knows it (the pieces the interiors are furnished with: a
// flat's, a shop's, a bakery's, a bar's, an embassy's).
//
// A piece in a room is a kind and a place, { kind, x, z, face }: x, z its centre on the floor in
// metres (x east, z south, toward the camera), face the way its front points: 'down' (+z, toward the
// camera: a sofa you see the seat of, a wardrobe's doors), 'up' (−z: its back to the camera), 'left'
// (−x), 'right' (+x). FURNITURE gives each kind as it stands facing 'down', in metres, in real
// proportions against a 1.7 m person:
//   w along x, d along z (turned left or right they swap: footprint()), h its height: the top of what
//     a person can't see through (a counter 0.9, a wardrobe 2.0); what hangs above head height (a
//     cooker's hood, a mirror over a basin, a lift's floor indicator) isn't counted;
//   block: people can't walk through it (a rug and a walk-through metal detector they can);
//   wall: it stands with its back to a wall, its back on the footprint's back edge (−z facing 'down');
//   y0: hung on the wall that high (a shelf, the mailboxes), nothing under it but the wall;
//   use: what it's for, which the sim offers there: 'sleep', 'sit', 'eat', 'cook', 'wash', 'toilet',
//     'phone', 'work', 'read', 'watch', 'store' (doors and drawers: a place to hide a thing), 'buy',
//     'pay', 'drink', 'bake', 'change' (a fitting room), 'post', 'lift', 'stairs', 'screen' (a
//     checkpoint's), 'exchange', 'door', 'coat', 'basket';
//   seats: where people sit or lie on it, { dx, dz, face }: from its centre as it faces 'down', face
//     the way the sitter looks (seatsOf() turns them with the piece);
//   spot: where one stands to use it (at a sink, before a till), the same way;
//   staff: where who works it stands or sits (behind a counter, at a checkout's till).
// Pieces with chairs of their own (a dining table, a desk, a restaurant's table) count the chairs in
// their footprint, and seat people on them; a chair alone is `chair` (or `officeChair`, `barStool`).
// The art is src/art/furniture.js: it draws every kind here to these sizes, within a pixel.

const S = (dx, dz, face = 'down') => ({ dx, dz, face });

export const FURNITURE = {
  // ---------- home ----------
  bed:          { w: 1.6, d: 2.1, h: 1.0, block: true, wall: true, use: 'sleep', seats: [S(-0.4, 0.1), S(0.4, 0.1)] },
  singleBed:    { w: 0.9, d: 2.0, h: 0.9, block: true, wall: true, use: 'sleep', seats: [S(0, 0.1)] },
  bedsideTable: { w: 0.45, d: 0.4, h: 0.55, block: true, wall: true, use: 'store' },
  wardrobe:     { w: 1.2, d: 0.6, h: 2.0, block: true, wall: true, use: 'store', spot: S(0, 0.6, 'up') },
  drawers:      { w: 0.9, d: 0.5, h: 0.85, block: true, wall: true, use: 'store', spot: S(0, 0.55, 'up') },
  sofa:         { w: 2.1, d: 0.9, h: 0.85, block: true, wall: false, use: 'sit', seats: [S(-0.6, 0.1), S(0, 0.1), S(0.6, 0.1)] },
  armchair:     { w: 0.9, d: 0.85, h: 0.85, block: true, wall: false, use: 'sit', seats: [S(0, 0.1)] },
  coffeeTable:  { w: 1.1, d: 0.6, h: 0.42, block: true, wall: false },
  tv:           { w: 1.2, d: 0.45, h: 1.1, block: true, wall: true, use: 'watch' },
  bookshelf:    { w: 0.9, d: 0.32, h: 1.95, block: true, wall: true, use: 'read', spot: S(0, 0.45, 'up') },
  diningTable:  { w: 1.4, d: 1.9, h: 0.75, block: true, wall: false, use: 'eat',
                  seats: [S(-0.35, -0.72), S(0.35, -0.72), S(-0.35, 0.72, 'up'), S(0.35, 0.72, 'up')] },
  chair:        { w: 0.45, d: 0.45, h: 0.9, block: true, wall: false, use: 'sit', seats: [S(0, 0)] },
  desk:         { w: 1.2, d: 1.15, h: 0.75, block: true, wall: true, use: 'work', seats: [S(0, 0.35, 'up')] },
  counter:      { w: 1.2, d: 0.6, h: 0.9, block: true, wall: true, use: 'store', spot: S(0, 0.6, 'up') },
  sink:         { w: 1.0, d: 0.6, h: 0.9, block: true, wall: true, use: 'wash', spot: S(-0.15, 0.6, 'up') },
  cooker:       { w: 0.6, d: 0.6, h: 0.9, block: true, wall: true, use: 'cook', spot: S(0, 0.6, 'up') },
  fridge:       { w: 0.6, d: 0.65, h: 1.8, block: true, wall: true, use: 'store', spot: S(0, 0.65, 'up') },
  kitchenShelf: { w: 1.0, d: 0.25, h: 1.75, y0: 1.45, block: false, wall: true },
  bathtub:      { w: 1.7, d: 0.75, h: 0.55, block: true, wall: true, use: 'wash', seats: [S(0.15, 0)] },
  toilet:       { w: 0.4, d: 0.7, h: 0.8, block: true, wall: true, use: 'toilet', seats: [S(0, 0.1)] },
  washbasin:    { w: 0.55, d: 0.45, h: 0.85, block: true, wall: true, use: 'wash', spot: S(0, 0.5, 'up') },
  radiator:     { w: 0.8, d: 0.12, h: 0.6, block: true, wall: true },
  rug:          { w: 2.0, d: 1.4, h: 0.01, block: false, wall: false },
  floorLamp:    { w: 0.35, d: 0.35, h: 1.6, block: true, wall: false },
  plant:        { w: 0.45, d: 0.45, h: 1.1, block: true, wall: false },
  phoneTable:   { w: 0.5, d: 0.35, h: 0.75, block: true, wall: true, use: 'phone', spot: S(0, 0.45, 'up') },
  coatRack:     { w: 0.5, d: 0.5, h: 1.8, block: true, wall: false, use: 'coat', spot: S(0, 0.5, 'up') },
  shoeRack:     { w: 0.8, d: 0.3, h: 0.5, block: true, wall: true },

  // ---------- stairwell ----------
  // The flight rises toward its back (−z facing 'down'): ten steps of 0.25 m, 0.19 m each, so 1.9 m
  // up, a half-landing's or a mezzanine's. The sim says where it leads (it blocks as a piece).
  stairs:       { w: 1.2, d: 2.5, h: 1.9, block: true, wall: false, use: 'stairs', spot: S(0, 1.45, 'up') },
  mailboxes:    { w: 1.2, d: 0.3, h: 1.75, y0: 0.8, block: true, wall: true, use: 'post', spot: S(0, 0.45, 'up') },
  liftDoor:     { w: 1.2, d: 0.2, h: 2.3, block: true, wall: true, use: 'lift', spot: S(0, 0.5, 'up') },

  // ---------- shops ----------
  shelving:     { w: 1.2, d: 0.45, h: 2.0, block: true, wall: true, use: 'buy', spot: S(0, 0.55, 'up') },
  gondola:      { w: 1.8, d: 0.9, h: 1.5, block: true, wall: false, use: 'buy', spot: S(0, 0.75, 'up') },
  shopCounter:  { w: 1.6, d: 0.6, h: 1.0, block: true, wall: false, use: 'pay', spot: S(0, 0.6, 'up'), staff: S(0.35, -0.65) },
  checkout:     { w: 2.0, d: 0.8, h: 0.9, block: true, wall: false, use: 'pay', spot: S(0, 0.7, 'up'), staff: S(0.7, -0.7) },
  drinksFridge: { w: 0.7, d: 0.7, h: 2.0, block: true, wall: true, use: 'buy', spot: S(0, 0.7, 'up') },
  chestFreezer: { w: 1.5, d: 0.7, h: 0.85, block: true, wall: false, use: 'buy', spot: S(0, 0.65, 'up') },
  baskets:      { w: 0.45, d: 0.35, h: 0.6, block: true, wall: false, use: 'basket' },
  crates:       { w: 1.2, d: 0.8, h: 1.1, block: true, wall: false },
  cartons:      { w: 0.8, d: 0.7, h: 0.8, block: true, wall: false },   // (moving boxes, taped: a flat not yet unpacked)
  pallet:       { w: 1.2, d: 0.8, h: 1.25, block: true, wall: false },
  clothesRail:  { w: 1.4, d: 0.55, h: 1.6, block: true, wall: false, use: 'buy', spot: S(0, 0.6, 'up') },
  fittingRoom:  { w: 1.0, d: 1.0, h: 2.1, block: true, wall: true, use: 'change', seats: [S(0.2, -0.2)] },
  mirror:       { w: 0.6, d: 0.2, h: 1.8, block: true, wall: true, spot: S(0, 0.7, 'up') },
  displayCase:  { w: 1.4, d: 0.8, h: 1.2, block: true, wall: false, use: 'buy', spot: S(0, 0.7, 'up'), staff: S(0, -0.7) },
  breadRack:    { w: 1.2, d: 0.45, h: 1.8, block: true, wall: true, use: 'buy', spot: S(0, 0.55, 'up') },
  deckOven:     { w: 1.6, d: 1.0, h: 1.9, block: true, wall: true, use: 'bake', spot: S(0, 0.85, 'up') },
  workTable:    { w: 1.8, d: 0.8, h: 0.9, block: true, wall: false, use: 'bake', spot: S(0, 0.7, 'up') },
  cafeCounter:  { w: 2.0, d: 0.7, h: 1.05, block: true, wall: false, use: 'buy', spot: S(0.4, 0.65, 'up'), staff: S(-0.4, -0.65) },
  bar:          { w: 2.4, d: 0.7, h: 1.1, block: true, wall: false, use: 'drink', spot: S(0, 0.65, 'up'), staff: S(0, -0.65) },
  barShelf:     { w: 2.0, d: 0.35, h: 2.1, block: true, wall: true },
  barStool:     { w: 0.4, d: 0.4, h: 0.75, block: true, wall: false, use: 'sit', seats: [S(0, 0)] },
  restaurantTable: { w: 0.8, d: 1.9, h: 0.75, block: true, wall: false, use: 'eat', seats: [S(0, -0.72), S(0, 0.72, 'up')] },
  range:        { w: 1.2, d: 0.8, h: 0.9, block: true, wall: true, use: 'cook', spot: S(0, 0.7, 'up') },
  steelSink:    { w: 1.2, d: 0.7, h: 0.9, block: true, wall: true, use: 'wash', spot: S(0, 0.65, 'up') },
  flowerBuckets: { w: 1.2, d: 0.5, h: 0.9, block: true, wall: false, use: 'buy', spot: S(0, 0.55, 'up') },
  bankCounter:  { w: 1.8, d: 0.7, h: 1.05, block: true, wall: false, use: 'exchange', spot: S(0, 0.65, 'up'), staff: S(0, -0.65) },

  // ---------- office and embassy ----------
  officeDesk:   { w: 1.4, d: 0.7, h: 0.75, block: true, wall: false, use: 'work', spot: S(-0.15, 0.6, 'up') },
  officeChair:  { w: 0.6, d: 0.6, h: 1.0, block: true, wall: false, use: 'sit', seats: [S(0, 0.05)] },
  filingCabinet: { w: 0.47, d: 0.62, h: 1.32, block: true, wall: true, use: 'store', spot: S(0, 0.65, 'up') },
  securityDesk: { w: 2.0, d: 0.8, h: 1.15, block: true, wall: false, use: 'screen', spot: S(0, 0.7, 'up'), staff: S(0, -0.6) },
  metalDetector: { w: 0.9, d: 0.6, h: 2.2, block: false, wall: false, use: 'screen' },
  xray:         { w: 2.6, d: 0.9, h: 1.3, block: true, wall: false, use: 'screen', spot: S(-1.0, 0.7, 'up'), staff: S(1.0, -0.75) },
  stanchions:   { w: 1.6, d: 0.3, h: 1.0, block: true, wall: false },
  flag:         { w: 0.6, d: 0.6, h: 2.5, block: true, wall: false },
  waitingChairs: { w: 2.0, d: 0.6, h: 0.85, block: true, wall: false, use: 'sit',
                   seats: [S(-0.75, 0.05), S(-0.25, 0.05), S(0.25, 0.05), S(0.75, 0.05)] },
  vaultDoor:    { w: 1.6, d: 0.45, h: 2.3, block: true, wall: true, use: 'door', spot: S(0, 0.6, 'up') },
  waterCooler:  { w: 0.35, d: 0.35, h: 1.3, block: true, wall: false, use: 'drink', spot: S(0, 0.45, 'up') },
};

/** An offset (dx, dz) from a piece's centre as it faces 'down', turned to its face. */
export function turn(face, dx, dz) {
  if (face === 'up') return [-dx, -dz];
  if (face === 'left') return [-dz, dx];                         // (its front, +z, to −x)
  if (face === 'right') return [dz, -dx];
  return [dx, dz];
}
const FACES = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const faceOf = ([x, z]) => (Math.abs(x) > Math.abs(z) ? (x < 0 ? 'left' : 'right') : (z < 0 ? 'up' : 'down'));

/** What an item `{ kind, x, z, face }` covers on the floor: { x0, z0, x1, z1 } (w and d swapped facing left or right). */
export function footprint({ kind, x, z, face = 'down' }) {
  const f = FURNITURE[kind];
  const side = face === 'left' || face === 'right';
  const w = side ? f.d : f.w, d = side ? f.w : f.d;
  return { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 };
}

/** An item's seats (or `which`: 'spot', 'staff') in the room: [{ x, z, face }], turned with it. */
export function seatsOf(item, which = 'seats') {
  const f = FURNITURE[item.kind], face = item.face ?? 'down';
  return [f[which] ?? []].flat().map(s => {
    const [dx, dz] = turn(face, s.dx, s.dz);
    return { x: item.x + dx, z: item.z + dz, face: faceOf(turn(face, ...FACES[s.face])) };
  });
}
