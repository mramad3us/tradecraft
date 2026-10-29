// TRADECRAFT ui: the Underground's map at a station's door (the user, 2026-10-28: "The underground selection
// should be graphical with points of interest drawn on the map"). The network's map, as it hangs in every
// ticket hall: the lines in their colours, a station a white tick, a change a ring, each named; under it,
// faint, the streets, and on them what you know (sim/knowledge.js: the flat, the embassy, the safe houses,
// the shops you've passed, coloured as the mind's map colours them; the waypoint's flag); you, at your
// station. Drawn in the picture's pixels (src/art/pixelart.js), in the HUD's dark glass, like the mind.
// A station picked (a click, or the arrows from where you stand, Enter to ride): its lines and changes, the
// minutes, the fare, what you know near it; ride there. Beside the map, the way to what matters: the station
// nearest each of the posting's places and the waypoint, a key each.
import { plaque } from './plaque.js';
import { text as glyphs, textWidth } from '../art/pixelart.js';
import { KIND_COLOUR } from './mind.js';
import { knownPlaces, knownStreets } from '../sim/knowledge.js';
import { network } from '../sim/transit.js';
import { townOf } from '../sim/cities/index.js';
import { streetName, SECTION_M } from '../sim/map/street.js';
import { AREA, AREA_I } from '../sim/transit.js';

const COL_PX = 12, ROW_PX = 18, PAD = 8, K = 2;
const NEAR_M = 160;                                                 // (what you know this near a station: named on its card)
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const lum = (c) => (0.3 * (c >> 16) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255)) / 255;

/**
 * Open the map into host (the HUD's card). at: { name (the network's), from: { row, i, name }, list (sim/metro.js
 * destinations()) }; deps: { el, ride (a destination's id), close, label, price }.
 */
export function openTubeMap(host, state, at, deps) {
  const { el } = deps, town = townOf(state.map), net = network(town), lines = net.lines.filter(L => L.kind === 'metro');
  const c = state.campaign && state.map.seed === state.campaign.posting.mapSeed ? state.campaign : null;
  const known = c ? knownPlaces(c).filter(pl => !['bus', 'metro'].includes(pl.kind)) : [], streets = c ? knownStreets(c) : [];
  const dest = new Map(at.list.map(d => [`${d.row}|${d.i}`, d])), here = `${at.from.row}|${at.from.i}`;
  const stations = [...net.stations.keys()].map(k => { const [row, i] = k.split('|').map(Number); return { k, row, i, ids: net.stations.get(k), d: dest.get(k), name: dest.get(k)?.name ?? (k === here ? at.from.name : '') }; });
  // The picture: the network's area, a column a section, a row a street.
  const W = PAD * 2 + (2 * AREA_I + 1) * COL_PX + 24, H = PAD * 2 + (2 * AREA) * ROW_PX + 16;
  const X = (i) => PAD + 12 + (i + AREA_I) * COL_PX + Math.floor(COL_PX / 2), Xm = (x) => X(x / SECTION_M - 0.5), Y = (row) => PAD + 6 + (row + AREA) * ROW_PX;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), px = (x, y, w, h, col) => { g.fillStyle = hex(col); g.fillRect(x, y, w, h); };
  let pick = null;
  const draw = () => {
    px(0, 0, W, H, 0x14151c);
    // (the streets, faint; the stretches you've walked brighter)
    for (let row = -AREA; row <= AREA; row++) {
      px(X(-AREA_I) - 6, Y(row), X(AREA_I) - X(-AREA_I) + 12, 1, 0x23252f);
      for (const i of streets.find(s => s.row === row)?.sections ?? []) if (Math.abs(i) <= AREA_I + 1) px(Math.max(0, X(i) - 6), Y(row), COL_PX, 1, 0x4c5262);
    }
    // (what you know: a square of its kind's colour, the posting's own bigger)
    for (const pl of known) {
      const x = Xm(pl.x), y = Y(pl.row) + (pl.z > 2 ? 3 : -3), big = ['home', 'work', 'safe'].includes(pl.kind), col = KIND_COLOUR[pl.kind] ?? 0x8f96a6;
      if (x < 0 || x > W) continue;
      if (big) { px(x - 3, y - 3, 7, 7, 0x14151c); px(x - 2, y - 2, 5, 5, col); px(x - 2, y - 2, 5, 1, 0xf6f4ee); }
      else { px(x - 1, y - 1, 3, 3, col); }
    }
    // (the lines: along a street, straight; between streets, an elbow at the half-way)
    // (a dark line, the Northern's black, cased in light to show on the glass)
    const seg = (x0, y0, x1, y1, w, col) => { if (y0 === y1) px(Math.min(x0, x1) - (w >> 1), y0 - (w >> 1), Math.abs(x1 - x0) + w, w, col); else px(x0 - (w >> 1), Math.min(y0, y1) - (w >> 1), w, Math.abs(y1 - y0) + w, col); };
    for (const pass of [0, 1]) for (const L of lines) {
      const dark = lum(L.colour) < 0.2;
      if (pass === 0 && !dark) continue;
      for (let k = 1; k < L.stops.length; k++) {
        const a = L.stops[k - 1], b = L.stops[k], ax = X(a.i), ay = Y(a.row), bx = X(b.i), by = Y(b.row), my = Math.round((ay + by) / 2);
        const parts = ay === by ? [[ax, ay, bx, by]] : [[ax, ay, ax, my], [ax, my, bx, my], [bx, my, bx, by]];
        for (const [x0, y0, x1, y1] of parts) seg(x0, y0, x1, y1, pass === 0 ? 5 : 3, pass === 0 ? 0x8f96a6 : L.colour);
      }
    }
    // (the waypoint's flag)
    const w8 = c?.waypoint;
    if (w8) { const x = Xm(w8.x), y = Y(w8.row) - 10; px(x, y, 1, 9, 0xf6f4ee); px(x + 1, y, 4, 3, 0xe7b84a); }
    // (the stations: a tick, a change a ring; yours, and the one picked, marked)
    const boxes = [];                                               // (what the names mustn't cover: the ticks, YOU, the names placed: [x0, y0, x1, y1])
    for (const s of stations) {
      const x = X(s.i), y = Y(s.row), change = s.ids.length > 1, me = s.k === here, on = pick?.k === s.k;
      if (change || me || on) { px(x - 4, y - 4, 9, 9, 0x14151c); px(x - 3, y - 3, 7, 7, me ? 0xe7b84a : on ? 0x95c1e3 : 0xf6f4ee); px(x - 1, y - 1, 3, 3, 0x14151c); }
      else { px(x - 2, y - 2, 5, 5, 0x14151c); px(x - 1, y - 1, 3, 3, 0xf6f4ee); }
      boxes.push([x - 4, y - 4, x + 5, y + 5]);
    }
    if (stations.some(s => s.k === here)) { const s = stations.find(t => t.k === here), t = 'YOU', x = X(s.i) - Math.floor(textWidth(t) / 2), y = Y(s.row) - 12; px(x - 1, y - 1, textWidth(t) + 2, 7, 0x14151c); glyphs(px, x, y, t, 0xe7b84a); boxes.push([x - 1, y - 1, x + textWidth(t) + 1, y + 6]); }
    // (the names: yours and the one picked first, then the changes, then the rest; each in the first
    // place it fits (along a street under its tick, then over it, then beside; on the line across, beside
    // it, then under, over), not over another name or a tick nor off the picture; whole, or a word at a
    // time off its end till it fits; yours and the one picked always shown)
    const free = (x0, y0, w) => x0 >= 1 && x0 + w <= W - 1 && !boxes.some(b => x0 - 2 < b[2] && x0 + w + 2 > b[0] && y0 - 1 < b[3] && y0 + 6 > b[1]);
    const order = (s) => (s.k === here ? 0 : pick?.k === s.k ? 1 : s.ids.length > 1 ? 2 : 3);
    for (const s of [...stations].sort((a, b) => order(a) - order(b))) {
      if (!s.name) continue;
      const x = X(s.i), y = Y(s.row), me = s.k === here, on = pick?.k === s.k, change = s.ids.length > 1;
      const along = lines.some(L => L.stops.some(t => t.row === s.row && t.i !== s.i && L.stops.every(u => u.row === s.row)));
      const words = s.name.toUpperCase().split(' ');
      let at = null;
      for (let n = words.length; n >= 1 && !at; n--) {
        const name = words.slice(0, n).join(' '), tw = textWidth(name), mid = x - Math.floor(tw / 2);
        const spots = along ? [[mid, y + 6], [mid, y - 12], [x + 7, y - 2], [x - 7 - tw, y - 2]] : [[x + 7, y - 2], [x - 7 - tw, y - 2], [mid, y + 6], [mid, y - 12]];
        const spot = spots.find(([lx, ly]) => free(lx, ly, tw)) ?? (n === 1 && (me || on) ? [Math.max(2, Math.min(W - tw - 2, spots[0][0])), spots[0][1]] : null);
        if (spot) at = [spot[0], spot[1], name, tw];
      }
      if (!at) continue;
      const [lx, ly, name, tw] = at;
      px(lx - 1, ly - 1, tw + 2, 7, 0x14151c);
      glyphs(px, lx, ly, name, me ? 0xe7b84a : on ? 0x95c1e3 : change ? 0xf6f4ee : 0xb8bdc8);
      boxes.push([lx - 1, ly - 1, lx + tw + 1, ly + 6]);
    }
  };
  // The station's card: where, the lines, the minutes, the fare; what you know near it; ride.
  const card = el('div', { className: 'tube-card' });
  // (what you know near a station: your own places first, then the rest, a name once: 'the café (40 m), 2 shops (60 m)')
  const near = (s) => {
    const by = new Map();
    for (const pl of known) {
      const m = Math.abs(pl.x - (s.i + 0.5) * SECTION_M) + Math.abs(pl.row - s.row) * 70;
      if (m > NEAR_M) continue;
      const o = by.get(pl.label) ?? { pl, m, n: 0, own: ['home', 'work', 'safe'].includes(pl.kind) };
      o.n++; o.m = Math.min(o.m, m); by.set(pl.label, o);
    }
    return [...by.values()].sort((a, b) => b.own - a.own || a.m - b.m).map(o => ({ ...o, word: o.n > 1 ? `${o.n} × ${o.pl.label.replace(/^The /, 'the ')}` : o.pl.label }));
  };
  const choose = (s) => {
    pick = s; draw();
    if (!s) return;
    if (s.k === here) { card.replaceChildren(el('h3', {}, at.from.name), el('p', { className: 'mind-note' }, `You're here, on ${streetName(town, s.row)}.`)); return; }
    const d = s.d, n = near(s).slice(0, 5);
    card.replaceChildren(el('h3', {}, d.name),
      el('p', {}, `On ${streetName(town, s.row)}. ${d.lines.length > 1 ? `The ${d.lines[0]}, change to the ${d.lines.slice(1).join(', then the ')}` : `The ${d.lines[0]}`}: ${d.minutes} minutes, ${deps.price(d.fare)}.`),
      n.length ? el('p', { className: 'mind-note' }, `Near it, that you know: ${n.map(o => `${o.word} (${Math.round(o.m / 10) * 10} m)`).join(', ')}.`) : el('p', { className: 'mind-note' }, 'Nothing you know near it.'),
      el('div', { className: 'mind-acts' }, el('button', { className: 'tube-ride', onclick: () => deps.ride(d.id) }, `Ride there · ${deps.price(d.fare)}`),
        el('button', { title: 'whoever got on after you is carried off; five minutes more', onclick: () => deps.ride(`${d.id}:doors`) }, 'Off as the doors close, the next train')));
    card.querySelector('.tube-ride')?.focus();
  };
  const at_ = (e) => {
    const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W, my = (e.clientY - r.top) / r.height * H;
    let best = null, bd = 9;
    for (const s of stations) { const dd = Math.hypot(X(s.i) - mx, Y(s.row) - my); if (dd < bd && (s.d || s.k === here)) { bd = dd; best = s; } }
    return best;
  };
  cv.onmousemove = (e) => { const s = at_(e); cv.style.cursor = s ? 'pointer' : 'default'; cv.title = s?.d ? `${s.d.name}: ${s.d.minutes} min` : ''; };
  cv.onclick = (e) => { const s = at_(e); if (s) choose(s); };
  // (the way to what matters: the station nearest each of the posting's places, and the waypoint's)
  const goals = [...known.filter(pl => ['home', 'work', 'safe'].includes(pl.kind)), ...(c?.waypoint ? [{ ...c.waypoint, label: `The waypoint: ${c.waypoint.label}` }] : [])].map(pl => {
    const s = stations.filter(t => t.d || t.k === here).map(t => ({ t, m: Math.abs(pl.x - (t.i + 0.5) * SECTION_M) + Math.abs(pl.row - t.row) * 70 })).sort((a, b) => a.m - b.m)[0];
    return s && { pl, s: s.t, m: s.m };
  }).filter(Boolean);
  const quick = el('div', { className: 'tube-quick' }, ...goals.map((o, n) => el('button', { className: 'tube-goal', dataset: { n: n + 1 }, style: `--dot: ${hex(KIND_COLOUR[o.pl.kind] ?? 0xe7b84a)}`, onclick: () => choose(o.s) },
    el('kbd', {}, String(n + 1)), ` ${o.pl.label}: ${o.s.k === here ? 'you\'re at its station' : `${o.s.name}, ${o.s.d.minutes} min, then ${Math.round(o.m / 10) * 10} m on foot`}`)));
  draw();
  cv.style.width = `${W * K}px`; cv.style.height = `${H * K}px`; cv.className = 'mind-map tube-map';
  const title = el('div', { className: 'mind-head' }, pixCopy(plaque({ text: at.name === 'Underground' ? 'UNDERGROUND' : 'METRO', sub: at.from.name.toUpperCase(), style: 'way', icon: 'tube', notch: false })));
  host.replaceChildren(el('div', { className: 'mind tube' }, title,
    el('p', { className: 'mind-note' }, `Where to? Pick a station: a click, or the arrows from where you are; Enter rides.${known.length ? ' The squares are what you know.' : ''}`),
    el('div', { className: 'tube-body' }, el('div', { className: 'mind-mapbox' }, cv), el('div', { className: 'tube-side' }, card, goals.length ? el('h3', {}, 'The way to') : null, goals.length ? quick : null)),
    el('p', { className: 'mind-foot' }, `${deps.label('menu')} to close`)));
  host.hidden = false;
  host.dataset.kind = 'tube';
  choose(stations.find(s => s.k === here) ?? null);
  // (keys: the arrows to the nearest station that way, Enter to ride, a number to a place's station)
  host.$tubeKey = (e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      const from = pick ?? stations.find(s => s.k === here) ?? stations[0];
      let best = null, bd = Infinity;
      for (const s of stations) {
        if (s === from || !(s.d || s.k === here)) continue;
        const dx = X(s.i) - X(from.i), dy = Y(s.row) - Y(from.row), along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        if (along <= 0) continue;
        const score = along + across * 2;
        if (score < bd) { bd = score; best = s; }
      }
      if (best) choose(best);
      return true;
    }
    if (e.key === 'Enter' && pick?.d) { deps.ride(pick.d.id); return true; }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code), o = m && goals[Number(m[1]) - 1];
    if (o) { choose(o.s); return true; }
    return false;
  };
}

// (a plaque's canvas copied, shown at K of the picture's pixels a pixel)
function pixCopy(pl) {
  const cv = document.createElement('canvas'); cv.width = pl.w; cv.height = pl.h; cv.getContext('2d').drawImage(pl.canvas, 0, 0);
  cv.style.width = `${pl.w * K}px`; cv.style.height = `${pl.h * K}px`; cv.style.imageRendering = 'pixelated';
  return cv;
}
