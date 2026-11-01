// TRADECRAFT ui: what you carry (I), pocket by pocket (the user, 2026-10-28: "most menus need revamping, the
// generic paper isn't adapted to inventory for instance"). The mind's dark glass, its heading a plaque of the
// picture's (src/ui/plaque.js); you, in the clothes you stand in, your pockets on them (src/art/doll.js); then
// each pocket as it is (sim/items.js placed(): a coat's two, the inside one, the trousers' two, the beltline's
// two places), everything in it (the wallet, the phone, burners, the first-aid supplies as well as what's
// fought with: all of it takes room) drawn in the picture's pixels (src/art/sprites.js heldIcon()) and how
// full it is. Beside it the hand, what fits nowhere, the shop's bag. A weapon's buttons: take it out, put it
// away, drop it; 1–9 the first button of each, in order. A supply or a burner can be thrown away, by a click
// only: a stray digit shouldn't cost you your bandages.
import { plaque } from './plaque.js';
import { heldIcon } from '../art/sprites.js';
import { doll as figure, W as DOLL_W, H as DOLL_H } from '../art/doll.js';
import { placed, fits, SPACES, ALWAYS } from '../sim/items.js';
import { weaponOf } from '../sim/weapons.js';
import { worn } from '../sim/clothes.js';
import { cashOf } from '../sim/money.js';
import { bagWord } from '../sim/clothes.js';
import { SUPPLIES, supplyWord } from '../sim/medicine.js';

const K = 2, ICON_K = 3;
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const GROUPS = [['coat', 'Coat pockets'], ['inside', 'The inside pocket'], ['trousers', 'Trouser pockets'], ['belt', 'The beltline']];
// (the small things' own pictures: [rows], a letter a colour)
const SUPPLY_PIX = {
  wallet: ['bbbbbb', 'bBBBBb', 'bbbbbb', 'bbbbbb'], phone: ['nnnn', 'neen', 'neen', 'neen', 'nnnn'], burner: ['nnn', 'nen', 'nmn', 'nnn'],
  bandage: ['.www.', 'wwwww', 'wmwmw', 'wwwww', '.www.'], antiseptic: ['.nn.', '.ww.', 'wqqw', 'wqqw', 'wwww'], sutures: ['....m', '...m.', '..m..', '.m...', 'n....'],
  splint: ['ooooooo', '.w.w.w.', 'ooooooo'], tourniquet: ['nnnnnnn', 'n.....i', 'nnnnnnn'], painkillers: ['wwww', 'wqqw', 'wwww'], poultice: ['ggggg', 'gGgGg', 'ggggg'], antibiotics: ['qqww', 'qqww'],
};
const PIX_C = { w: 0xf6f4ee, m: 0x8f96a6, n: 0x4c5262, q: 0x9e3c36, o: 0x8a5a3c, i: 0xd9a83a, g: 0x76ad4c, G: 0x4f5b3a, b: 0x8a5a3c, B: 0xd6ad7a, e: 0x95c1e3 };

/** Open what you carry into host (the HUD's card). deps: { el, act (an inventory command: wield:k, stow, drop:k), label, price }. */
export function openPockets(host, state, deps) {
  const { el } = deps, p = state.people[state.player], P = placed(p), top = worn(p, 'top');
  let n = 0;
  const go = (cmd) => () => deps.act(cmd);
  // (a thing: its picture, its name, its buttons)
  const thing = (kind, inHand) => {
    const w = weaponOf(kind), first = inHand ? (fits(p, kind) ? ['stow', 'Put away'] : [`drop:${kind}`, 'Put down']) : [`wield:${kind}`, 'Take out'];
    const k = ++n;
    return el('div', { className: 'pk-thing' }, icon(kind), el('span', { className: 'pk-name' }, cap(w?.name ?? kind)),
      el('span', { className: 'pk-btns' }, el('button', { dataset: { n: k }, onclick: go(first[0]) }, el('kbd', {}, String(k)), ` ${first[1]}`),
        first[0].startsWith('drop:') ? null : el('button', { onclick: go(`drop:${kind}`) }, 'Drop')));
  };
  // (something small: its picture, its name, thrown away if it can be)
  const small = ({ kind, n }) => {
    const word = kind === 'wallet' ? `Wallet: ${deps.price(cashOf(p))}` : kind === 'phone' ? 'Your phone' : kind === 'burner' ? (n > 1 ? `${n} burners` : 'A burner') : cap(supplyWord(kind, n));
    return el('div', { className: 'pk-thing' }, pixIcon(SUPPLY_PIX[kind]), el('span', { className: 'pk-name' }, word),
      ALWAYS.includes(kind) ? null : el('span', { className: 'pk-btns' }, el('button', { className: 'pk-bin', title: 'Throw it away, to make room', onclick: go(`discard:${kind}:${n}`) }, 'Bin')));
  };
  // (what's in a place: a weapon by itself, the same small things together)
  const row = (list) => {
    const out = [];
    for (const o of list) {
      if (weaponOf(o.kind)) { out.push({ ...o }); continue; }
      const had = out.find(x => x.kind === o.kind);
      if (had) had.n += o.n ?? 1; else out.push({ ...o, n: o.n ?? 1 });
    }
    return out.map(o => (weaponOf(o.kind) ? thing(o.kind, false) : small(o)));
  };
  // (a pocket: its things, how full, whether what's in it shows)
  const pocket = (sp, idx, k, pair) => {
    const inIt = P.out.filter(o => o.slot === idx), full = sp.belt ? (sp.used ? 1 : 0) : sp.used / sp.l, shows = inIt.some(o => o.shows);
    return el('div', { className: `pk-pocket${inIt.length ? '' : ' empty'}` },
      el('div', { className: 'pk-pocket-head' }, el('span', {}, sp.belt ? (k ? 'Right side' : 'Left side') : `${pair ? (k ? 'Right ' : 'Left ') : ''}${sp.label.replace(/^(a|the) /, '')}`.replace(/^./, c => c.toUpperCase())),
        el('span', { className: 'pk-fill', title: sp.belt ? (sp.used ? 'taken' : 'free') : `${sp.used.toFixed(2)} of ${sp.l} L` }, el('i', { style: `width: ${Math.round(Math.min(1, full) * 100)}%` })),
        shows ? el('span', { className: 'pk-shows' }, sp.belt ? 'it shows' : 'it bulges') : null),
      ...(inIt.length ? row(inIt) : [el('p', { className: 'pk-none' }, 'Empty')]));
  };
  const inHand = p.hand ? thing(p.hand, true) : null;   // (the hand's first: 1)
  const groups = GROUPS.map(([id, name]) => {
    const idxs = P.spaces.map((sp, i) => [sp, i]).filter(([sp]) => sp.id === id);
    if (!idxs.length) return null;
    return el('div', { className: 'pk-group' }, el('h3', {}, name), el('div', { className: 'pk-pockets' }, ...idxs.map(([sp, i], k) => pocket(sp, i, k, idxs.length > 1))));
  }).filter(Boolean);
  const nowhere = P.out.filter(o => o.slot < 0);
  const missing = SPACES.filter(S => !P.spaces.some(sp => sp.id === S.id)).map(S => S.id);
  const side = el('div', { className: 'pk-side' },
    el('h3', {}, 'In your hand'), inHand ?? el('p', { className: 'pk-none' }, `Nothing. ${deps.label('use')} picks up what lies about; ${deps.label('gun')} takes out the next thing.`),
    nowhere.length ? el('h3', {}, 'Nowhere to put it') : null, ...row(nowhere),
    p.bag?.length ? el('h3', {}, 'The shop\'s bag, for home') : null,
    p.bag?.length ? el('p', {}, cap(p.bag.map(bagWord).join(', ')) + '.') : null,
    Object.keys(p.kit ?? {}).length || p.bag?.some(x => x.supply) ? el('p', { className: 'mind-note' }, `${deps.label('aid')} tends your wounds with what you have on you.`) : null);
  const title = el('div', { className: 'mind-head' }, pixCanvas(plaque({ text: 'WHAT YOU CARRY', sub: (top?.name ?? 'your clothes').replace(/^the /, '').toUpperCase(), style: 'way', icon: 'key', notch: false })));
  host.replaceChildren(el('div', { className: 'mind pockets' }, title,
    el('div', { className: 'pk-body' }, el('div', { className: 'pk-doll' }, doll(p, P)), el('div', { className: 'pk-main' }, ...groups,
      missing.includes('coat') ? el('p', { className: 'mind-note' }, 'No coat pockets, nor an inside one: not in what you\'re wearing. A coat, a jacket, a suit has them.') : null), side),
    el('p', { className: 'mind-foot' }, `Little, and only where it fits, by its length and its bulk. 1–9 the first button. ${deps.label('inventory')} or ${deps.label('menu')} to close.`)));
  host.hidden = false;
  host.dataset.kind = 'inventory';
  host.querySelector('button[data-n]')?.focus();
}

// (you, in the clothes you stand in: each pocket on them free, used, or showing; what's in your hands: src/art/doll.js)
function doll(p, P) {
  const marks = {};
  for (const { id } of SPACES) {
    const here = P.spaces.map((sp, i) => (sp.id === id ? i : -1)).filter(i => i >= 0);
    if (here.length) marks[id] = here.map(i => { const inIt = P.out.filter(o => o.slot === i); return !inIt.length ? 'free' : inIt.some(o => o.shows) ? 'shows' : 'used'; });
  }
  const rows = figure({ look: p.look ?? {}, sex: p.sex, marks, hand: p.hand, bag: !!p.bag?.length });
  const cv = document.createElement('canvas'); cv.width = DOLL_W; cv.height = DOLL_H;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => row.forEach((c, x) => { g.fillStyle = hex(c); g.fillRect(x, y, 1, 1); }));
  cv.style.width = `${DOLL_W * K}px`; cv.style.height = `${DOLL_H * K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}

// (a thing's picture, from its shape in the hand, haloed so a dark one shows on the glass)
function icon(kind) {
  const cells = heldIcon(kind), W = 12, H = 5, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const set = new Set(cells.map(([x, y]) => `${x}|${y}`));
  g.fillStyle = '#4c5262';
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!set.has(`${x + dx}|${y + dy}`)) g.fillRect(x + dx + 1, y + dy, 1, 1);
  for (const [x, y, c] of cells) { g.fillStyle = hex(c); g.fillRect(x + 1, y, 1, 1); }
  cv.className = 'pk-icon'; cv.style.width = `${W * ICON_K}px`; cv.style.height = `${H * ICON_K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}
// (a small thing's picture, in the middle of the same box as a weapon's, so the names line up)
function pixIcon(rows = ['w']) {
  const W = 12, H = 5, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), ox = Math.floor((W - Math.max(...rows.map(r => r.length))) / 2), oy = Math.floor((H - rows.length) / 2);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (PIX_C[ch]) { g.fillStyle = hex(PIX_C[ch]); g.fillRect(ox + x, oy + y, 1, 1); } }));
  cv.className = 'pk-icon'; cv.style.width = `${W * ICON_K}px`; cv.style.height = `${H * ICON_K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}
function pixCanvas(pl) {
  const cv = document.createElement('canvas'); cv.width = pl.w; cv.height = pl.h; cv.getContext('2d').drawImage(pl.canvas, 0, 0);
  cv.style.width = `${pl.w * K}px`; cv.style.height = `${pl.h * K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
