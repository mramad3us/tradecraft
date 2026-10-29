// TRADECRAFT ui: the mind (Tab, in the campaign): what your officer knows and believes, as they have it
// (the user, 2026-10-28: "The TAB key for desk should be the mindmap, the character's knowledge not the desk,
// and the information should also be in a revamped and adjusted UI"; "a section with an actual map (known
// only again, it's our mind) where we can select waypoints"). Not paper: the HUD's own dark glass, its
// headings the picture's plaques (src/ui/plaque.js). Four leaves:
//   - **Ahead:** the assignments, today's with their way to go; the next one's brief; the day's choices
//     (work, sleep, lie low, walk on).
//   - **The city:** the map in your head (sim/knowledge.js: the streets you've walked, what's on them, the
//     posting's places), drawn in the picture's pixels: streets as you know them, a dot a place, coloured
//     by what it is (KIND_COLOUR), you, the waypoint's flag. A place picked: what it is and where; set it as
//     the waypoint (the goal pointer leads there), or clear it; the posting's places, go there.
//   - **People:** your network, the men you watch, your colleagues: as you know them.
//   - **Where you stand:** your read of your heat and your cover (sim/belief.js: words, and how sure),
//     the station's tally, your money, your body.
import { plaque } from './plaque.js';
import { text as glyphs, textWidth } from '../art/pixelart.js';
import { knownPlaces, knownStreets, setWaypoint, KINDS } from '../sim/knowledge.js';
import { readOf } from '../sim/belief.js';
import { agenda, places, KINDS as AKINDS, goalOf } from '../sim/campaign.js';
import { calendar, clockText, dateText, DAY } from '../sim/clock.js';
import { needsWords } from '../sim/needs.js';
import { fatigue } from '../sim/campaign.js';
import { price, cashOf } from '../sim/money.js';
import { cityById } from '../sim/cities/index.js';
import { townOf } from '../sim/cities/index.js';
import { streetName, SECTION_M, Z } from '../sim/map/street.js';
import { trip } from '../sim/campaign.js';
import { sectionOf } from '../sim/city.js';

export const KIND_COLOUR = { home: 0xe7b84a, work: 0x5d8fc2, safe: 0x76ad4c, food: 0xe8896a, clothes: 0x7a4a86, books: 0x2f6b62, bank: 0xb9862e, club: 0xc95c45, school: 0x3b6296, phones: 0x95c1e3, optician: 0x8f96a6, chemist: 0x356f42, other: 0x6a7182, metro: 0x9e3c36, bus: 0xc4bba9 };
const LEAVES = [['ahead', 'Ahead'], ['city', 'The city'], ['people', 'People'], ['stand', 'Where you stand']];
const M_PER_PX = 3, ROW_PX = 22, NAME_PX = 92;

/**
 * Open the mind on a leaf, into host (the HUD's card). deps: { el, act (a desk command), close, label (a
 * key's label), on: { kinds } (the city's filters, kept between openings) }.
 */
export function openMind(host, state, leaf = 'ahead', deps) {
  const { el } = deps, c = state.campaign, p = c.posting, me = state.people.me, now = state.time.ms;
  const show = (to) => openMind(host, state, to, deps);
  const tabs = el('div', { className: 'mind-tabs' }, ...LEAVES.map(([id, name], k) => el('button', { className: `mind-tab${id === leaf ? ' on' : ''}`, onclick: () => show(id), title: `${k + 1}` }, name)));
  const title = el('div', { className: 'mind-head' }, pix(copy(plaque({ text: 'THE MIND', sub: me.name.toUpperCase(), style: 'way', icon: 'eye', notch: false })), 2), tabs);
  const body = el('div', { className: 'mind-body' }, ...(leaf === 'city' ? cityLeaf(state, deps, show) : leaf === 'people' ? peopleLeaf(state, deps) : leaf === 'stand' ? standLeaf(state, deps) : aheadLeaf(state, deps)));
  host.replaceChildren(el('div', { className: 'mind' }, title, body, el('p', { className: 'mind-foot' }, `${deps.label('mindmap')} or ${deps.label('menu')} to close · 1–4 the leaves`)));
  host.hidden = false;
  host.dataset.kind = 'mind';
  host.dataset.leaf = leaf;
  host.$mindKey = (e) => { const n = Number(e.key); if (n >= 1 && n <= LEAVES.length) { show(LEAVES[n - 1][0]); return true; } return false; };
}

// (a plaque's canvas copied: the plaque's own is kept, and shared)
function copy(pl) { const cv = document.createElement('canvas'); cv.width = pl.w; cv.height = pl.h; cv.getContext('2d').drawImage(pl.canvas, 0, 0); return cv; }
// (a canvas at the picture's pixels, shown at k of them a pixel, crisp)
function pix(cv, k) { cv.style.width = `${cv.width * k}px`; cv.style.height = `${cv.height * k}px`; cv.style.imageRendering = 'pixelated'; return cv; }

// ---------- Ahead ----------
function aheadLeaf(state, { el, act }) {
  const c = state.campaign, now = state.time.ms, k = calendar(now), today = Math.floor(now / DAY), items = agenda(c, now).slice(0, 6);
  const who = (a) => { const T = a.trip && c.posting.trips?.find(t => t.id === a.who); return T ? `${cityById(T.city).name}, ${T.asset?.codename ?? T.target?.name}` : a.kind === 'sdr' ? c.posting.assets.find(s => s.id === a.who)?.codename : c.posting.targets.find(t => t.id === a.who)?.name; };
  const workday = k.weekday < 5 && k.hour < 18 && !c.worked[today];
  return [
    el('h3', {}, `${dateText(now)}, ${clockText(now)}`),
    items.length ? el('div', { className: 'mind-list' }, ...items.map(({ a, when }) => {
      const sameDay = Math.floor(a.start / DAY) === today;
      return el('div', { className: 'mind-row' }, el('span', { className: 'when' }, `${dateText(a.from).slice(0, -5)}, ${clockText(a.from)}`), el('span', { className: 'what' }, `${AKINDS[a.kind].name}: ${who(a)}`),
        sameDay ? el('button', { className: 'mind-go', title: a.brief, onclick: () => act(`go:${a.id}`) }, when === 'now' ? 'Go now' : `Go, at ${clockText(a.start)}`) : el('span', { className: 'later' }, 'later'));
    })) : el('p', { className: 'mind-note' }, 'Nothing planned. Days like this are for the cover job.'),
    items[0] ? el('p', { className: 'mind-brief' }, items[0].a.brief) : null,
    el('h3', {}, 'The day'),
    el('div', { className: 'mind-acts' },
      workday ? el('button', { onclick: () => act('work') }, 'Go to work, till six') : null,
      el('button', { onclick: () => act('sleep') }, k.hour >= 20 || k.hour < 6 ? 'Sleep, till seven' : 'Home, and sleep till seven'),
      el('button', { onclick: () => act('low') }, 'Lie low for a day'),
      el('button', { onclick: () => act(null) }, 'Walk on')),
  ];
}

// ---------- Where you stand ----------
function standLeaf(state, { el }) {
  const c = state.campaign, p = c.posting, me = state.people.me, now = state.time.ms, rd = readOf(c, me, now), nw = needsWords(me, now), tired = fatigue(c, now);
  return [
    el('h3', {}, 'The street'), el('p', {}, rd.heat.text), el('p', { className: 'mind-sure' }, rd.heat.sure),
    el('h3', {}, 'The embassy'), el('p', {}, rd.cover.text), el('p', { className: 'mind-sure' }, rd.cover.sure),
    el('h3', {}, 'The station'), el('p', {}, `What they wanted on ${p.subject}: ${p.intelligence} of ${goalOf(p)}, by their own count.${c.reviews.length ? ` The last week, they said: ${c.reviews.at(-1).grade.toLowerCase()}.` : ''}`),
    el('h3', {}, 'Money'), el('p', {}, `${price(state, cashOf(me))} on you; ${price(state, p.money.bank ?? 0)} in the account${p.money.fund ? `; the operational fund, ${price(state, p.money.fundLeft ?? p.money.fund)}` : ''}.`),
    el('h3', {}, 'You'), el('p', {}, `${nw.fed.charAt(0).toUpperCase() + nw.fed.slice(1)}; ${nw.stress}; ${tired.word ?? 'rested enough'}.`),
  ];
}

// ---------- People ----------
function peopleLeaf(state, { el }) {
  const c = state.campaign, p = c.posting;
  const trust = (t) => (t >= 4 ? 'trusts you' : t >= 2 ? 'warming to you' : t >= 0 ? 'wary of you' : 'not sure of you at all');
  return [
    el('h3', {}, p.assets.length ? 'Your network' : 'Your network: none yet'),
    ...p.assets.map(s => el('p', {}, `${s.codename}: ${s.role}, in it for ${s.motive}; ${trust(s.trust)}${s.burned ? '. Compromised: they saw you meet' : ''}.`)),
    el('h3', {}, 'Watched'),
    ...p.targets.map(t => el('p', {}, `${t.name}, ${t.what}.${t.wary ? ' Careful now: he knows someone was there.' : ''}${t.contact ? ' Seen meeting someone.' : ''}`)),
    el('h3', {}, 'The station'),
    el('p', {}, 'Kevin Hale, the station\'s training officer: the one who telephones.'),
    el('p', {}, `The chief of station: his office is off the corridor, behind the arch.`),
  ];
}

// ---------- The city ----------
function cityLeaf(state, deps, show) {
  const { el, act } = deps, c = state.campaign, P = c.posting, on = (deps.on.kinds ??= Object.fromEntries(Object.keys(KINDS).map(k => [k, !['bus', 'other'].includes(k)])));
  const all = knownPlaces(c), streets = knownStreets(c), shown = all.filter(pl => on[pl.kind]);
  const town = townOf({ seed: P.mapSeed, city: P.city }), meA = state.actors.find(a => a.who === state.player);
  const here = state.map.kind === 'street' && state.map.seed === P.mapSeed ? { row: state.map.row ?? 0, x: meA?.x ?? 0 } : state.map.place === 'home' ? P.home : state.map.place === 'embassy' ? P.embassy : null;
  // The picture: the rows known (and the posting's), x across the stretches known.
  const rows = [...new Set([...streets.map(s => s.row), ...all.map(pl => pl.row), ...(here ? [here.row] : [])])].sort((a, b) => a - b);
  const xs = [...streets.flatMap(s => s.sections.flatMap(i => [i * SECTION_M, (i + 1) * SECTION_M])), ...all.map(pl => pl.x), ...(here?.x !== undefined ? [here.x] : [])];
  const x0 = Math.min(...xs) - 20, x1 = Math.max(...xs) + 20, W = Math.min(560, Math.max(260, NAME_PX + Math.ceil((x1 - x0) / M_PER_PX) + 8)), H = rows.length * ROW_PX + 10;
  const mpp = Math.max(M_PER_PX, (x1 - x0) / (W - NAME_PX - 8));
  const X = (x) => Math.round(NAME_PX + (x - x0) / mpp), Y = (row) => 8 + rows.indexOf(row) * ROW_PX + 8;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), px = (x, y, w, h, col) => { g.fillStyle = `#${col.toString(16).padStart(6, '0')}`; g.fillRect(x, y, w, h); };
  px(0, 0, W, H, 0x14151c);
  for (const row of rows) {
    const s = streets.find(t => t.row === row), name = streetName(town, row).toUpperCase().slice(0, 22);
    glyphs(px, 4, Y(row) - 2, name, s ? 0x8f96a6 : 0x4c5262);
    px(NAME_PX - 4, Y(row), 2, 1, 0x353947);
    for (const i of s?.sections ?? []) {
      px(X(i * SECTION_M), Y(row) - 1, Math.max(1, X((i + 1) * SECTION_M) - X(i * SECTION_M)), 3, 0x4c5262);
      // (its lanes north and south: a side street to the next street known, an alley thinner; a stub where it isn't)
      const S = sectionOf(town, row, i);
      for (const [gaps, dir] of [[S.gapsN ?? [], -1], [S.gapsS ?? [], 1]]) for (const gp of gaps) {
        const x = X((gp.x0 + gp.x1) / 2), to = rows.includes(row + dir) ? Y(row + dir) : Y(row) + dir * 6, a = Math.min(Y(row), to), b = Math.max(Y(row), to);
        px(x, a, gp.kind === 'side' ? 2 : 1, b - a, gp.kind === 'side' ? 0x4c5262 : 0x353947);
      }
    }
  }
  const W8 = c.waypoint;
  // (a place: a square of its colour, on its side of the street; the posting's own and the metro bigger, edged)
  for (const pl of shown) {
    const col = KIND_COLOUR[pl.kind] ?? 0x8f96a6, x = X(pl.x), y = Y(pl.row) + (pl.z > 2 ? 4 : -4), big = ['home', 'work', 'safe', 'metro'].includes(pl.kind);
    if (big) { px(x - 3, y - 3, 7, 7, 0x14151c); px(x - 2, y - 2, 5, 5, col); px(x - 2, y - 2, 5, 1, 0xf6f4ee); }
    else { px(x - 2, y - 2, 5, 5, 0x14151c); px(x - 1, y - 1, 3, 3, col); }
  }
  if (W8) { const x = X(W8.x), y = Y(W8.row) - 9; px(x, y, 1, 8, 0xf6f4ee); px(x + 1, y, 4, 3, 0xe7b84a); }
  if (here) { const x = X(here.x ?? 0), y = Y(here.row); px(x - 2, y - 2, 5, 5, 0x14151c); px(x - 1, y - 1, 3, 3, 0xf6f4ee); }
  const K = 2;
  pix(cv, K);
  cv.className = 'mind-map';
  const card = el('div', { className: 'mind-place' }, el('p', { className: 'mind-note' }, here ? 'You: the white square. Pick a place.' : 'Pick a place.'));
  const pickAt = (e) => {
    const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W, my = (e.clientY - r.top) / r.height * H;
    let best = null, bd = 7;
    for (const pl of shown) { const d = Math.hypot(X(pl.x) - mx, Y(pl.row) - my); if (d < bd) { bd = d; best = pl; } }
    return best;
  };
  cv.onmousemove = (e) => { const pl = pickAt(e); cv.title = pl ? `${pl.label} · ${streetName(town, pl.row)}` : ''; cv.style.cursor = pl ? 'pointer' : 'default'; };
  cv.onclick = (e) => {
    const pl = pickAt(e);
    if (!pl) return;
    const posting = places(c).find(q => q.id === pl.id), far = here && here.row !== undefined ? (pl.row === here.row ? `${Math.round(Math.abs(pl.x - (here.x ?? 0)))} m along` : `${Math.abs(pl.row - here.row)} ${Math.abs(pl.row - here.row) === 1 ? 'street' : 'streets'} ${pl.row < here.row ? 'north' : 'south'}`) : '';
    card.replaceChildren(el('h3', {}, pl.label), el('p', {}, `${streetName(town, pl.row)}${far ? `, ${far}` : ''}.`),
      el('div', { className: 'mind-acts' },
        el('button', { onclick: () => { setWaypoint(c, pl); show('city'); } }, c.waypoint?.x === pl.x && c.waypoint?.row === pl.row ? 'The waypoint (set)' : 'Make it the waypoint'),
        posting && posting.row !== (state.map.row ?? 0) ? el('button', { onclick: () => act(`travel:${posting.id}`) }, `Go there (${trip(state.map.row ?? 0, posting.row).how.split(',')[0]})`) : null));
  };
  const chips = el('div', { className: 'mind-kinds' }, ...Object.entries(KINDS).filter(([k]) => all.some(pl => pl.kind === k)).map(([k, word]) => el('button', { className: `mind-kind${on[k] ? ' on' : ''}`, style: `--dot: #${(KIND_COLOUR[k] ?? 0x8f96a6).toString(16).padStart(6, '0')}`, onclick: () => { on[k] = !on[k]; show('city'); } }, word)));
  return [
    el('p', { className: 'mind-note' }, `${cityById(P.city).name} as you know it: ${streets.length} ${streets.length === 1 ? 'street' : 'streets'} walked, ${all.filter(pl => !['bus', 'metro'].includes(pl.kind)).length} places.`),
    el('div', { className: 'mind-mapbox' }, cv), chips,
    W8 ? el('div', { className: 'mind-acts' }, el('span', { className: 'mind-note' }, `The waypoint: ${W8.label}.`), el('button', { onclick: () => { setWaypoint(c, null); show('city'); } }, 'Clear it')) : null,
    card,
  ];
}
