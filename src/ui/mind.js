// TRADECRAFT ui: the mind (Tab, in the campaign): what your officer knows and believes, as they have it
// (the user, 2026-10-28: "The TAB key for desk should be the mindmap, the character's knowledge not the desk,
// and the information should also be in a revamped and adjusted UI"; "a section with an actual map (known
// only again, it's our mind) where we can select waypoints"). Not paper: the HUD's own dark glass, its
// headings the picture's plaques (src/ui/plaque.js). Four leaves:
//   - **Ahead:** the assignments, each where it is (sim/places.js missionPlace(): walked to; make it the
//     waypoint), a trip abroad's way to go (flown out); the next one's brief; the day's one choice,
//     lying low (the user, 2026-10-29: no going to work or home from here, "it would skip all the gameplay
//     like shaking watchers": the embassy's desk and the flat's bed are walked to, as everywhere is).
//   - **The city:** the map in your head (sim/knowledge.js: the streets you've walked, what's on them, the
//     posting's places), drawn in the picture's pixels: streets as you know them, a dot a place, coloured
//     by what it is (KIND_COLOUR), you, the waypoint's flag. A place picked: what it is and where; set it as
//     the waypoint (the goal pointer leads there), or clear it.
//   - **People:** your network, the men you watch, your colleagues: as you know them.
//   - **Where you stand:** your read of your heat and your cover (sim/belief.js: words, and how sure),
//     the station's tally, your money, your body.
import { sellerOf, stock } from '../sim/market.js';
import { lessonBook } from '../sim/lessons.js';
import { plaque } from './plaque.js';
import { text as glyphs, textWidth } from '../art/pixelart.js';
import { knownPlaces, knownStreets, setWaypoint, KINDS } from '../sim/knowledge.js';
import { missionPlace } from '../sim/places.js';
import { briefOf } from '../sim/dossier.js';
import { readOf } from '../sim/belief.js';
import { agenda, KINDS as AKINDS, goalOf, expected } from '../sim/campaign.js';
import { clockText, dateText, DAY } from '../sim/clock.js';
import { needsWords } from '../sim/needs.js';
import { fatigue } from '../sim/campaign.js';
import { price, cashOf } from '../sim/money.js';
import { burnersOf } from '../sim/items.js';
import { cityById } from '../sim/cities/index.js';
import { townOf } from '../sim/cities/index.js';
import { streetName, SECTION_M, Z } from '../sim/map/street.js';
import { sectionOf } from '../sim/city.js';
import { callWays, nextMeeting } from '../sim/phone.js';
import { services, supportWords, OPTIONAL } from '../sim/dial.js';

export const KIND_COLOUR = { job: 0xd36bd0, home: 0xe7b84a, work: 0x5d8fc2, safe: 0x76ad4c, food: 0xe8896a, clothes: 0x7a4a86, books: 0x2f6b62, bank: 0xb9862e, club: 0xc95c45, school: 0x3b6296, phones: 0x95c1e3, optician: 0x8f96a6, chemist: 0x356f42, hospital: 0xdfe2e8, police: 0x283f6b, other: 0x6a7182, metro: 0x9e3c36, bus: 0xc4bba9 };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const LEAVES = [['ahead', 'Ahead'], ['city', 'The city'], ['people', 'People'], ['stand', 'Where you stand'], ['phone', 'The phone']];
const ROW_PX = 30, NAME_PX = 92, MAP_W = 320;                     // (a canvas this wide, drawn big: some 350 m across at the first zoom)
// The city's window (the user, 2026-11-03: "the map should be zoomed in our position, showing 2 streets around
// us maximum, and a zooming and arrows control to navigate if we need to see something out of frame, otherwise
// the map is too crushed"): your street and ROWS_HALF either side, along it as much as fits at the zoom
// (ZOOMS: metres a pixel), centred on you; the arrows (on the page, or the keyboard's) move it, + and − zoom.
const ROWS_HALF = 2, ZOOMS = [0.75, 1.1, 1.6, 2.4, 3.6], ZOOM0 = 2, PAN = 0.7;

/**
 * Open the mind on a leaf, into host (the HUD's card). deps: { el, act (a desk command), close, label (a
 * key's label), on: { kinds } (the city's filters, kept between openings) }.
 */
export function openMind(host, state, leaf = 'ahead', deps) {
  const { el } = deps, c = state.campaign, p = c.posting, me = state.people.me, now = state.time.ms;
  const show = (to) => openMind(host, state, to, deps);
  const tabs = el('div', { className: 'mind-tabs' }, ...LEAVES.map(([id, name], k) => el('button', { className: `mind-tab${id === leaf ? ' on' : ''}`, onclick: () => show(id), title: `${k + 1}` }, name)));
  const title = el('div', { className: 'mind-head' }, pix(copy(plaque({ text: 'THE MIND', sub: me.name.toUpperCase(), style: 'way', icon: 'eye', notch: false })), 2), tabs);
  const body = el('div', { className: 'mind-body' }, ...(leaf === 'city' ? cityLeaf(state, deps, show) : leaf === 'people' ? peopleLeaf(state, deps, show) : leaf === 'stand' ? standLeaf(state, deps) : leaf === 'phone' ? phoneLeaf(state, deps, show) : aheadLeaf(state, deps, show)));
  host.replaceChildren(el('div', { className: 'mind' }, title, body, el('p', { className: 'mind-foot' }, `${deps.label('mindmap')} or ${deps.label('menu')} to close · 1–5 the leaves`)));
  host.hidden = false;
  host.dataset.kind = 'mind';
  host.dataset.leaf = leaf;
  host.$mindKey = (e) => { const n = Number(e.key); if (n >= 1 && n <= LEAVES.length) { show(LEAVES[n - 1][0]); return true; } const f = leaf === 'city' && e.code && deps.on.mapKey?.(e.code); if (f) { f(); return true; } return false; };   // (the city's arrows, + and −, C: the window)
}

// (a plaque's canvas copied: the plaque's own is kept, and shared)
function copy(pl) { const cv = document.createElement('canvas'); cv.width = pl.w; cv.height = pl.h; cv.getContext('2d').drawImage(pl.canvas, 0, 0); return cv; }
// (a canvas at the picture's pixels, shown at k of them a pixel, crisp)
function pix(cv, k) { cv.style.width = `${cv.width * k}px`; cv.style.height = `${cv.height * k}px`; cv.style.imageRendering = 'pixelated'; return cv; }

// ---------- Ahead ----------
function aheadLeaf(state, { el, act }, show) {
  const c = state.campaign, now = state.time.ms, today = Math.floor(now / DAY), items = agenda(c, now).slice(0, 6);
  const who = (a) => { const T = a.trip && c.posting.trips?.find(t => t.id === a.who); return T ? `${cityById(T.city).name}, ${T.asset?.codename ?? T.target?.name}` : a.kind === 'lesson' ? (lessonBook(a.lesson)?.title ?? 'the street').toLowerCase() : a.kind === 'sdr' ? c.posting.assets.find(s => s.id === a.who)?.codename : c.posting.targets.find(t => t.id === a.who)?.name; };
  return [
    el('h3', {}, `${dateText(now)}, ${clockText(now)}`),
    items.length ? el('div', { className: 'mind-list' }, ...items.map(({ a, when }) => {
      const sameDay = Math.floor(a.start / DAY) === today, at = missionPlace(c, a), w = c.waypoint;
      // (here: where it is, and the waypoint to it; a trip abroad: flown out, from here)
      const way = at ? el('button', { className: 'mind-go', title: a.brief, onclick: () => { setWaypoint(c, { ...at, kind: 'job' }); show('ahead'); } }, w && w.row === at.row && w.x === at.x ? 'The waypoint' : 'Make it the waypoint')
        : sameDay ? el('button', { className: 'mind-go', title: a.brief, onclick: () => act(`go:${a.id}`) }, when === 'now' ? 'Fly out now' : `Fly out, at ${clockText(a.start)}`) : el('span', { className: 'later' }, 'later');
      return el('div', { className: 'mind-row' }, el('span', { className: 'when' }, `${dateText(a.from).slice(0, -5)}, ${clockText(a.from)}`),
        el('span', { className: 'what' }, `${AKINDS[a.kind].name}: ${who(a)}`, at ? el('span', { className: 'where' }, at.label) : null), way);
    })) : el('p', { className: 'mind-note' }, 'Nothing planned. Days like this are for the cover job.'),
    // (the next one's brief, as the station wrote it: sim/dossier.js)
    items[0] ? el('div', { className: 'mind-brief' }, el('p', { className: 'mind-brief-title' }, briefOf(c, items[0].a).title), ...briefOf(c, items[0].a).body.map(t => el('p', {}, t))) : null,
    // (the station's optional tasks for the network: sim/dial.js OPTIONAL; done, ticked)
    el('h3', {}, 'The station would like, if you can'),
    el('div', { className: 'mind-list' }, ...OPTIONAL.map(O => el('div', { className: `mind-row${O.done(c) ? ' done' : ''}` },
      el('span', { className: 'when' }, O.done(c) ? 'done' : 'optional'), el('span', { className: 'what' }, O.name, el('span', { className: 'where' }, O.about))))),
    el('h3', {}, 'The day'),
    el('div', { className: 'mind-acts' },
      el('button', { onclick: () => act('low'), title: expected(c, now) ? 'A sick day: a day lying low, the heat down; work will notice' : 'A day lying low: the heat down' }, expected(c, now) ? 'Call in sick' : 'Lie low a day'),   // (a working day you're expected: a sick day, sim/campaign.js lieLow())
      el('button', { onclick: () => act(null) }, 'Walk on')),
  ];
}

// ---------- Where you stand ----------
function standLeaf(state, { el }) {
  const c = state.campaign, p = c.posting, me = state.people.me, now = state.time.ms, rd = readOf(c, me, now), nw = needsWords(me, now), tired = fatigue(c, now);
  return [
    el('h3', {}, 'The street'), el('p', {}, rd.heat.text), el('p', { className: 'mind-sure' }, rd.heat.sure),
    el('h3', {}, p.embassy?.door ? cap(p.employer) : 'The embassy'), el('p', {}, rd.cover.text), el('p', { className: 'mind-sure' }, rd.cover.sure),   // (a legend's employer: sim/legends.js)
    ...(p.alias ? [el('h3', {}, 'Your legend'), el('p', {}, `${p.alias}, ${p.nationWord}: ${p.jobShort}.`)] : []),
    el('h3', {}, p.level === 'illegal' ? 'The Center' : 'The station'), el('p', {}, `What they wanted on ${p.subject}: ${p.intelligence} of ${goalOf(p)}, by their own count.${c.reviews.length ? ` The last week, they said: ${c.reviews.at(-1).grade.toLowerCase()}.` : ''}`),
    el('h3', {}, 'Money'), el('p', {}, `${price(state, cashOf(me))} on you; ${price(state, p.money.bank ?? 0)} in the account${p.money.fund ? `; the operational fund, ${price(state, p.money.fundLeft ?? p.money.fund)}` : ''}.`),
    el('h3', {}, 'The agency\'s support'), el('p', {}, `${cap(supportWords(c))}.`),   // (sim/support.js: what the station will do for you, rung for from The phone)
    el('h3', {}, 'You'), el('p', {}, `${nw.fed.charAt(0).toUpperCase() + nw.fed.slice(1)}; ${nw.stress}; ${tired.word ?? 'rested enough'}.`),
  ];
}

// ---------- The phone ----------
// (what you can ring for: sim/dial.js; a service picked, then which phone: a burner, your own (a watched line: heat), the
// flat's; the agency's support beside it, sim/support.js)
function phoneLeaf(state, deps, show) {
  const { el, act } = deps, c = state.campaign, list = services(state), on = deps.on.ring, pick = list.find(s => s.key === on);
  const rows = list.map(sv => el('div', { className: 'mind-acts' },
    el('span', { className: `what${sv.ok ? '' : ' off'}` }, `${sv.label}: `, el('small', {}, sv.why)),
    sv.ok && on !== sv.key ? el('button', { className: 'mind-go', onclick: () => { deps.on.ring = sv.key; show('phone'); } }, 'Ring…') : null));
  const panel = pick && pick.ok ? el('div', { className: 'mind-call' },
    el('p', { className: 'mind-note' }, `${pick.label}: which phone?`),
    el('div', { className: 'mind-acts' }, ...pick.phones.map(ph => el('button', { disabled: !ph.ok, title: ph.why, onclick: () => { deps.on.ring = null; act(`dial:${pick.key}:${ph.key}`); } }, ph.label)),
      el('button', { onclick: () => { deps.on.ring = null; show('phone'); } }, 'Not now'))) : null;
  return [el('h3', {}, 'The agency\'s support'), el('p', {}, `${cap(supportWords(c))}.`), el('h3', {}, 'Ring for'), ...rows, panel];
}

// ---------- People ----------
// (the black market's man, once a barman's given you his number: what he has, at his price, and which phone to ring him
// from; and how the order stands: sim/market.js)
function sellerLeaf(state, deps, show) {
  const { el, act } = deps, c = state.campaign, s = sellerOf(c), me = state.people.me, o = c.order && !c.order.done ? c.order : null, now = state.time.ms;
  if (!s && !o) return [];
  const name = s ? s.name.charAt(0).toUpperCase() + s.name.slice(1) : 'The seller';
  const status = o ? (!o.paid ? `Owed: ${price(state, o.usd)} for ${o.name}, behind a bench by ${clockText(o.pay.by)} ${dateText(o.pay.by).split(' ').slice(0, 3).join(' ')}: ${o.pay.label.toLowerCase()}.`
    : `Paid. ${o.name.charAt(0).toUpperCase() + o.name.slice(1)} behind another bench from ${clockText(o.get.from)} ${dateText(o.get.from).split(' ').slice(0, 3).join(' ')}: ${o.get.label.toLowerCase()}.`) : null;
  const panel = () => {
    const list = stock(c), pick = list.find(x => x.model === deps.on.model) ?? null;
    return el('div', { className: 'mind-call' },
      el('div', { className: 'mind-acts' }, ...list.map(x => el('button', { className: `mind-why${x === pick ? ' on' : ''}`, onclick: () => { deps.on.model = x.model; show('people'); } }, `${x.name} (${price(state, x.usd)})`))),
      pick ? el('p', { className: 'mind-note' }, `${pick.name.charAt(0).toUpperCase() + pick.name.slice(1)}, used, a spare magazine and a box of twenty: ${price(state, pick.usd)}, cash, by dead drop.`) : el('p', { className: 'mind-note' }, 'What do you want from him?'),
      el('div', { className: 'mind-acts' },
        el('button', { disabled: !pick || !(burnersOf(me) > 0), title: 'used once, and dumped', onclick: () => act(`market:${pick.model}:burner`) }, `From a burner (${burnersOf(me)} on you)`),
        el('button', { disabled: !pick, title: 'a diplomat\'s number on a gun dealer\'s bill', onclick: () => act(`market:${pick.model}:own`) }, 'From your own phone: traceable'),
        el('button', { onclick: () => { deps.on.call = null; show('people'); } }, 'Not now')));
  };
  return [
    el('h3', {}, 'Off the books'),
    el('div', { className: 'mind-asset' },
      el('div', { className: 'mind-acts' }, el('span', { className: 'what' }, `${name}: a number off a beer mat. Guns, for cash, by dead drop.${status ? ` ${status}` : ''}`),
        s && !o && deps.on.call !== 'seller' ? el('button', { className: 'mind-go', onclick: () => { deps.on.call = 'seller'; deps.on.model = null; show('people'); } }, 'Call…') : null),
      s && !o && deps.on.call === 'seller' ? panel() : null),
  ];
}

function peopleLeaf(state, deps, show) {
  const { el, act } = deps, c = state.campaign, p = c.posting, me = state.people.me, now = state.time.ms;
  const trust = (t) => (t >= 4 ? 'trusts you' : t >= 2 ? 'warming to you' : t >= 0 ? 'wary of you' : 'not sure of you at all');
  // (a call: what for, then which phone: sim/phone.js; the choice kept on deps.on while the leaf's open)
  const panel = (s) => {
    const ways = callWays(c, s, now), why = ways.find(w => w.key === deps.on.why && w.ok) ?? ways.find(w => w.ok), m = nextMeeting(c, s.id, now);
    return el('div', { className: 'mind-call' },
      el('p', { className: 'mind-note' }, m ? `Next meeting: ${dateText(m.from).split(' ').slice(0, 3).join(' ')}, ${clockText(m.from)}.` : 'No meeting planned.'),
      el('div', { className: 'mind-acts' }, ...ways.map(w => el('button', { className: `mind-why${w === why ? ' on' : ''}`, disabled: !w.ok, title: w.why, onclick: () => { deps.on.why = w.key; show('people'); } }, w.label))),
      why ? el('p', { className: 'mind-note' }, `${why.label}: ${why.why}.`) : el('p', { className: 'mind-note' }, 'Nothing to call about.'),
      el('div', { className: 'mind-acts' },
        el('button', { disabled: !why || !(burnersOf(me) > 0), title: 'used once, and dumped: nothing to trace', onclick: () => act(`phone:${s.id}:burner:${why.key}`) }, `From a burner (${burnersOf(me)} on you)`),
        el('button', { disabled: !why, title: 'on their bill: the opposition reads such things', onclick: () => act(`phone:${s.id}:own:${why.key}`) }, 'From your own phone: traceable'),
        el('button', { onclick: () => { deps.on.call = null; show('people'); } }, 'Not now')));
  };
  return [
    el('h3', {}, p.assets.length ? 'Your network' : 'Your network: none yet'),
    ...p.assets.map(s => el('div', { className: 'mind-asset' },
      el('div', { className: 'mind-acts' }, el('span', { className: 'what' }, `${s.codename}: ${s.role}, in it for ${s.motive}; ${trust(s.trust)}${s.burned ? `. Compromised: ${s.burnedBy === 'call' ? 'they looked at who you rang' : 'they saw you meet'}` : ''}.`),
        deps.on.call === s.id ? null : el('button', { className: 'mind-go', onclick: () => { deps.on.call = s.id; deps.on.why = null; show('people'); } }, 'Call…')),
      deps.on.call === s.id ? panel(s) : null)),
    p.assets.length ? el('p', { className: 'mind-note' }, `A call to bring a meeting forward or put it off, or a word to keep them warm. ${burnersOf(me) ? `${burnersOf(me)} burner${burnersOf(me) === 1 ? '' : 's'} on you.` : 'No burners on you: a phone shop sells them.'}`) : null,
    ...sellerLeaf(state, deps, show),
    el('h3', {}, 'Watched'),
    ...p.targets.map(t => el('p', {}, `${t.name}, ${t.what}.${t.wary ? ' Careful now: he knows someone was there.' : ''}${t.contact ? ' Seen meeting someone.' : ''}`)),
    el('h3', {}, 'The station'),
    el('p', {}, 'Kevin Hale, the station\'s training officer: the one who telephones.'),
    el('p', {}, `The chief of station: his office is off the corridor, behind the arch.`),
  ];
}

// ---------- The city ----------
function cityLeaf(state, deps, show) {
  const { el } = deps, c = state.campaign, P = c.posting, on = (deps.on.kinds ??= Object.fromEntries(Object.keys(KINDS).map(k => [k, !['bus', 'other'].includes(k)])));
  const all = knownPlaces(c), streets = knownStreets(c), shown = all.filter(pl => on[pl.kind]);
  const town = townOf({ seed: P.mapSeed, city: P.city }), meA = state.actors.find(a => a.who === state.player);
  const here = state.map.kind === 'street' && state.map.seed === P.mapSeed ? { row: state.map.row ?? 0, x: meA?.x ?? 0 } : state.map.place === 'home' ? P.home : state.map.place === 'embassy' ? P.embassy : null;
  // The window: the known rows within ROWS_HALF of its centre, x across what fits at its zoom (kept between openings: deps.on.view).
  // (in the flat or the embassy, where you are is its door on its street: its place's x)
  const atDoor = (k) => all.find(pl => pl.kind === k);
  const me0 = here && here.x !== undefined ? here : (state.map.place === 'embassy' ? atDoor('work') : atDoor('home')) ?? here ?? P.home;
  const V = (deps.on.view ??= { row: me0.row ?? 0, x: me0.x ?? 0, z: ZOOM0 });
  const known = [...new Set([...streets.map(s => s.row), ...all.map(pl => pl.row), ...(here ? [here.row] : [])])].sort((a, b) => a - b);
  const rows = known.filter(r => Math.abs(r - V.row) <= ROWS_HALF);
  if (!rows.length) rows.push(V.row);
  const W = MAP_W, H = rows.length * ROW_PX + 10, mpp = ZOOMS[V.z], span = (W - NAME_PX - 8) * mpp, x0 = V.x - span / 2;
  const X = (x) => Math.round(NAME_PX + (x - x0) / mpp), Y = (row) => 8 + rows.indexOf(row) * ROW_PX + 10;
  const inX = (x) => X(x) >= NAME_PX - 2 && X(x) <= W - 2;
  const move = (dx, dr, dz = 0) => { V.x += dx * span * PAN; V.row += dr; V.z = Math.max(0, Math.min(ZOOMS.length - 1, V.z + dz)); show('city'); };
  const centre = () => { Object.assign(V, { row: me0.row ?? 0, x: me0.x ?? 0 }); show('city'); };
  deps.on.mapKey = (code) => ({ ArrowLeft: () => move(-1, 0), ArrowRight: () => move(1, 0), ArrowUp: () => move(0, -1), ArrowDown: () => move(0, 1), Equal: () => move(0, 0, -1), NumpadAdd: () => move(0, 0, -1), Minus: () => move(0, 0, 1), NumpadSubtract: () => move(0, 0, 1), KeyC: centre }[code]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), px = (x, y, w, h, col) => { g.fillStyle = `#${col.toString(16).padStart(6, '0')}`; g.fillRect(x, y, w, h); };
  px(0, 0, W, H, 0x14151c);
  for (const row of rows) {
    const s = streets.find(t => t.row === row), name = streetName(town, row).toUpperCase().slice(0, 22);
    glyphs(px, 4, Y(row) - 2, name, s ? 0x8f96a6 : 0x4c5262);
    px(NAME_PX - 4, Y(row), 2, 1, 0x353947);
    for (const i of s?.sections ?? []) {
      const a0 = Math.max(NAME_PX, X(i * SECTION_M)), a1 = Math.min(W - 2, X((i + 1) * SECTION_M));
      if (a1 <= a0) continue;                                        // (out of the window)
      px(a0, Y(row) - 1, Math.max(1, a1 - a0), 3, 0x4c5262);
      // (its lanes north and south: a side street to the next street known, an alley thinner; a stub where it isn't)
      const S = sectionOf(town, row, i);
      for (const [gaps, dir] of [[S.gapsN ?? [], -1], [S.gapsS ?? [], 1]]) for (const gp of gaps) {
        if (!inX((gp.x0 + gp.x1) / 2)) continue;
        const x = X((gp.x0 + gp.x1) / 2), to = rows.includes(row + dir) ? Y(row + dir) : Y(row) + dir * 6, a = Math.min(Y(row), to), b = Math.max(Y(row), to);
        px(x, a, gp.kind === 'side' ? 2 : 1, b - a, gp.kind === 'side' ? 0x4c5262 : 0x353947);
      }
    }
  }
  const W8 = c.waypoint;
  // (a place: a square of its colour, on its side of the street; the posting's own and the metro bigger, edged)
  const inView = shown.filter(pl => rows.includes(pl.row) && inX(pl.x));
  for (const pl of inView) {
    const col = KIND_COLOUR[pl.kind] ?? 0x8f96a6, x = X(pl.x), y = Y(pl.row) + (pl.z > 2 ? 5 : -5), big = ['home', 'work', 'safe', 'metro', 'job'].includes(pl.kind);
    if (big) { px(x - 3, y - 3, 7, 7, 0x14151c); px(x - 2, y - 2, 5, 5, col); px(x - 2, y - 2, 5, 1, 0xf6f4ee); }
    else { px(x - 2, y - 2, 5, 5, 0x14151c); px(x - 1, y - 1, 3, 3, col); }
  }
  if (W8 && rows.includes(W8.row) && inX(W8.x)) { const x = X(W8.x), y = Y(W8.row) - 9; px(x, y, 1, 8, 0xf6f4ee); px(x + 1, y, 4, 3, 0xe7b84a); }
  if (here && rows.includes(me0.row) && inX(me0.x ?? 0)) { const x = X(me0.x ?? 0), y = Y(me0.row); px(x - 2, y - 2, 5, 5, 0x14151c); px(x - 1, y - 1, 3, 3, 0xf6f4ee); }
  pix(cv, 2);
  Object.assign(cv.style, { width: '100%', maxWidth: `${W * 3}px`, height: 'auto', margin: '0 auto' });   // (the window fits its box, its pixels big: nothing off to the side, nothing crushed)
  cv.className = 'mind-map';
  cv.dataset.shown = String(inView.length);                          // (what's in the window, for the tests)
  const card = el('div', { className: 'mind-place' }, el('p', { className: 'mind-note' }, here ? 'You: the white square. Pick a place.' : 'Pick a place.'));
  const pickAt = (e) => {
    const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W, my = (e.clientY - r.top) / r.height * H;
    let best = null, bd = 7;
    for (const pl of inView) { const d = Math.hypot(X(pl.x) - mx, Y(pl.row) - my); if (d < bd) { bd = d; best = pl; } }
    return best;
  };
  cv.onmousemove = (e) => { const pl = pickAt(e); cv.title = pl ? `${pl.label} · ${streetName(town, pl.row)}` : ''; cv.style.cursor = pl ? 'pointer' : 'default'; };
  cv.onclick = (e) => {
    const pl = pickAt(e);
    if (!pl) return;
    const far = here && here.row !== undefined ? (pl.row === here.row ? `${Math.round(Math.abs(pl.x - (here.x ?? 0)))} m along` : `${Math.abs(pl.row - here.row)} ${Math.abs(pl.row - here.row) === 1 ? 'street' : 'streets'} ${pl.row < here.row ? 'north' : 'south'}`) : '';
    card.replaceChildren(el('h3', {}, pl.label), el('p', {}, `${streetName(town, pl.row)}${far ? `, ${far}` : ''}.`),
      el('div', { className: 'mind-acts' },
        el('button', { onclick: () => { setWaypoint(c, pl); show('city'); } }, c.waypoint?.x === pl.x && c.waypoint?.row === pl.row ? 'The waypoint (set)' : 'Make it the waypoint')));
  };
  const chips = el('div', { className: 'mind-kinds' }, ...Object.entries(KINDS).filter(([k]) => all.some(pl => pl.kind === k)).map(([k, word]) => el('button', { className: `mind-kind${on[k] ? ' on' : ''}`, style: `--dot: #${(KIND_COLOUR[k] ?? 0x8f96a6).toString(16).padStart(6, '0')}`, onclick: () => { on[k] = !on[k]; show('city'); } }, word)));
  return [
    el('p', { className: 'mind-note' }, `${cityById(P.city).name} as you know it: ${streets.length} ${streets.length === 1 ? 'street' : 'streets'} walked, ${all.filter(pl => !['bus', 'metro'].includes(pl.kind)).length} places.`),
    el('div', { className: 'mind-acts mind-nav' }, ...[['◀', () => move(-1, 0), 'West (←)'], ['▶', () => move(1, 0), 'East (→)'], ['▲', () => move(0, -1), 'North (↑)'], ['▼', () => move(0, 1), 'South (↓)'], ['+', () => move(0, 0, -1), 'Closer (+)'], ['−', () => move(0, 0, 1), 'Further (−)']].map(([t, f, why]) => el('button', { onclick: f, title: why }, t)),
      el('button', { onclick: centre, title: 'C' }, here ? 'Centre on you' : 'Centre on the flat'),
      el('span', { className: 'mind-note' }, `${rows.length} of ${known.length} streets known · ${Math.round(span)} m across`)),
    el('div', { className: 'mind-mapbox' }, cv), chips,
    W8 ? el('div', { className: 'mind-acts' }, el('span', { className: 'mind-note' }, `The waypoint: ${W8.label}.`), el('button', { onclick: () => { setWaypoint(c, null); show('city'); } }, 'Clear it')) : null,
    card,
  ];
}
