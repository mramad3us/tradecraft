// TRADECRAFT ui: what you carry (I), pocket by pocket (the user, 2026-10-28: "most menus need revamping, the
// generic paper isn't adapted to inventory for instance"). The mind's dark glass, its heading a plaque of the
// picture's (src/ui/plaque.js); the clothes you stand in drawn small, their pockets on them; then each pocket
// as it is (sim/items.js placed(): a coat's two, the inside one, the trousers' two, the beltline's two
// places), what's in it drawn in the picture's pixels (src/art/sprites.js heldIcon()) and how full it is;
// the hand; what fits nowhere. Beside it, what's carried but not placed: the money, the phone and any
// burners, the first-aid supplies (sim/medicine.js), the shop's bag. A thing's buttons: take it out, put
// it away, drop it; 1–9 the first button of each, in order.
import { plaque } from './plaque.js';
import { heldIcon } from '../art/sprites.js';
import { placed, fits, SPACES } from '../sim/items.js';
import { weaponOf } from '../sim/weapons.js';
import { worn } from '../sim/clothes.js';
import { cashOf } from '../sim/money.js';
import { SUPPLIES, supplyWord } from '../sim/medicine.js';

const K = 2, ICON_K = 3;
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const GROUPS = [['coat', 'Coat pockets'], ['inside', 'The inside pocket'], ['trousers', 'Trouser pockets'], ['belt', 'The beltline']];
// (the supplies' own small pictures: [rows], a letter a colour)
const SUPPLY_PIX = {
  bandage: ['.www.', 'wwwww', 'wmwmw', 'wwwww', '.www.'], antiseptic: ['.nn.', '.ww.', 'wqqw', 'wqqw', 'wwww'], sutures: ['....m', '...m.', '..m..', '.m...', 'n....'],
  splint: ['ooooooo', '.w.w.w.', 'ooooooo'], tourniquet: ['nnnnnnn', 'n.....i', 'nnnnnnn'], painkillers: ['wwww', 'wqqw', 'wwww'], poultice: ['ggggg', 'gGgGg', 'ggggg'], antibiotics: ['qqww', 'qqww'],
};
const PIX_C = { w: 0xf6f4ee, m: 0x8f96a6, n: 0x353947, q: 0x9e3c36, o: 0x8a5a3c, i: 0xd9a83a, g: 0x76ad4c, G: 0x4f5b3a };

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
  // (a pocket: its things, how full, whether what's in it shows)
  const pocket = (sp, idx, k, pair) => {
    const inIt = P.out.filter(o => o.slot === idx), full = sp.belt ? (sp.used ? 1 : 0) : sp.used / sp.l, shows = inIt.some(o => o.shows);
    return el('div', { className: `pk-pocket${inIt.length ? '' : ' empty'}` },
      el('div', { className: 'pk-pocket-head' }, el('span', {}, sp.belt ? (k ? 'Right side' : 'Left side') : `${pair ? (k ? 'Right ' : 'Left ') : ''}${sp.label.replace(/^(a|the) /, '')}`.replace(/^./, c => c.toUpperCase())),
        el('span', { className: 'pk-fill', title: sp.belt ? (sp.used ? 'taken' : 'free') : `${sp.used.toFixed(2)} of ${sp.l} L` }, el('i', { style: `width: ${Math.round(Math.min(1, full) * 100)}%` })),
        shows ? el('span', { className: 'pk-shows' }, sp.belt ? 'it shows' : 'it bulges') : null),
      ...(inIt.length ? inIt.map(o => thing(o.kind, false)) : [el('p', { className: 'pk-none' }, 'Empty')]));
  };
  const inHand = p.hand ? thing(p.hand, true) : null;   // (the hand's first: 1)
  const groups = GROUPS.map(([id, name]) => {
    const idxs = P.spaces.map((sp, i) => [sp, i]).filter(([sp]) => sp.id === id);
    if (!idxs.length) return null;
    return el('div', { className: 'pk-group' }, el('h3', {}, name), el('div', { className: 'pk-pockets' }, ...idxs.map(([sp, i], k) => pocket(sp, i, k, idxs.length > 1))));
  }).filter(Boolean);
  const nowhere = P.out.filter(o => o.slot < 0);
  const missing = SPACES.filter(S => !P.spaces.some(sp => sp.id === S.id)).map(S => S.id);
  // (not placed: counted, about you)
  const kit = Object.entries(p.kit ?? {}).filter(([k, v]) => v > 0 && SUPPLIES[k]);
  const side = el('div', { className: 'pk-side' },
    el('h3', {}, 'In your hand'), inHand ?? el('p', { className: 'pk-none' }, `Nothing. ${deps.label('use')} picks up what lies about; ${deps.label('gun')} takes out the next thing.`),
    nowhere.length ? el('h3', {}, 'Nowhere to put it') : null, ...nowhere.map(o => thing(o.kind, false)),
    el('h3', {}, 'About you'),
    el('p', {}, `${deps.price(cashOf(p))} in cash. Your phone${p.burners ? `; ${p.burners === 1 ? 'a burner' : `${p.burners} burners`}, prepaid, no name on ${p.burners === 1 ? 'it' : 'them'}` : ''}.`),
    el('h3', {}, 'First aid'),
    kit.length ? el('div', { className: 'pk-kit' }, ...kit.map(([k, v]) => el('div', { className: 'pk-supply' }, pixIcon(SUPPLY_PIX[k]), el('span', {}, cap(supplyWord(k, v))))))
      : el('p', { className: 'pk-none' }, 'Nothing: a chemist\'s sells it.'),
    kit.length ? el('p', { className: 'mind-note' }, `${deps.label('aid')} tends your wounds with it.`) : null,
    p.bag?.length ? el('h3', {}, 'The shop\'s bag, for home') : null,
    p.bag?.length ? el('p', {}, cap(p.bag.map(x => (x.item ? weaponOf(x.item)?.name ?? x.item : x.name)).join(', ')) + '.') : null);
  const title = el('div', { className: 'mind-head' }, pixCanvas(plaque({ text: 'WHAT YOU CARRY', sub: (top?.name ?? 'your clothes').replace(/^the /, '').toUpperCase(), style: 'way', icon: 'key', notch: false })));
  host.replaceChildren(el('div', { className: 'mind pockets' }, title,
    el('div', { className: 'pk-body' }, el('div', { className: 'pk-doll' }, doll(p, P)), el('div', { className: 'pk-main' }, ...groups,
      missing.includes('coat') ? el('p', { className: 'mind-note' }, 'No coat pockets, nor an inside one: not in what you\'re wearing. A coat, a jacket, a suit has them.') : null), side),
    el('p', { className: 'mind-foot' }, `Little, and only where it fits, by its length and its bulk. 1–9 the first button. ${deps.label('inventory')} or ${deps.label('menu')} to close.`)));
  host.hidden = false;
  host.dataset.kind = 'inventory';
  host.querySelector('button[data-n]')?.focus();
}

// (the clothes you stand in, small: the pockets on them, gold where something's in one)
function doll(p, P) {
  const L = p.look ?? {}, W = 30, H = 64, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), px = (x, y, w, h, c) => { g.fillStyle = hex(c); g.fillRect(x, y, w, h); };
  const skin = { light: 0xedc39c, tan: 0xc99a6e, brown: 0x9c6b47, dark: 0x6b4636 }[L.skin] ?? 0xedc39c, coat = L.top?.color ?? 0x353947, trim = L.top?.trim ?? 0x23252f, legs = L.legs ?? 0x283f6b, long = ['coat', 'dress'].includes(L.top?.kind);
  px(11, 2, 8, 8, skin); px(11, 1, 8, 3, L.hair?.color ?? 0x2a1c18);
  px(13, 10, 4, 2, skin);
  px(7, 12, 16, long ? 30 : 22, coat); px(4, 13, 3, 20, coat); px(23, 13, 3, 20, coat); px(4, 33, 3, 3, skin); px(23, 33, 3, 3, skin);
  px(14, 12, 2, long ? 30 : 22, trim);
  px(9, long ? 42 : 34, 5, long ? 18 : 26, legs); px(16, long ? 42 : 34, 5, long ? 18 : 26, legs); px(8, 60, 6, 3, 0x2a1c18); px(16, 60, 6, 3, 0x2a1c18);
  // (the pockets: where they sit; full ones gold)
  const has = (id, k) => P.out.some(o => o.at === id && P.spaces[o.slot] === P.spaces.filter(s => s.id === id)[k]);
  const mark = (x, y, w, h, on) => { px(x, y, w, 1, on ? 0xe7b84a : 0x8f96a6); px(x, y + h - 1, w, 1, on ? 0xe7b84a : 0x8f96a6); px(x, y, 1, h, on ? 0xe7b84a : 0x8f96a6); px(x + w - 1, y, 1, h, on ? 0xe7b84a : 0x8f96a6); };
  if (P.spaces.some(s => s.id === 'coat')) { mark(8, 26, 5, 4, has('coat', 0)); mark(17, 26, 5, 4, has('coat', 1)); }
  if (P.spaces.some(s => s.id === 'inside')) mark(17, 15, 4, 4, has('inside', 0));
  if (P.spaces.some(s => s.id === 'trousers')) { const y = long ? 44 : 36; mark(9, y, 4, 3, has('trousers', 0)); mark(17, y, 4, 3, has('trousers', 1)); }
  if (P.spaces.some(s => s.id === 'belt')) { const y = 31; px(7, y, 16, 1, 0x2a1c18); if (has('belt', 0)) px(9, y - 2, 2, 5, 0xe7b84a); if (has('belt', 1)) px(19, y - 2, 2, 5, 0xe7b84a); }
  cv.style.width = `${W * 4}px`; cv.style.height = `${H * 4}px`; cv.style.imageRendering = 'pixelated';
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
function pixIcon(rows = ['w']) {
  const W = Math.max(...rows.map(r => r.length)), H = rows.length, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (PIX_C[ch]) { g.fillStyle = hex(PIX_C[ch]); g.fillRect(x, y, 1, 1); } }));
  cv.className = 'pk-icon'; cv.style.width = `${W * ICON_K}px`; cv.style.height = `${H * ICON_K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}
function pixCanvas(pl) {
  const cv = document.createElement('canvas'); cv.width = pl.w; cv.height = pl.h; cv.getContext('2d').drawImage(pl.canvas, 0, 0);
  cv.style.width = `${pl.w * K}px`; cv.style.height = `${pl.h * K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
