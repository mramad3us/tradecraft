// TRADECRAFT ui: the screens. The title sheet, the frame the picture sits in, the HUD over it (the
// watch, where you are and the weather, the log's lines as they come, the keys, a scenario's marker over its target and the
// instinct's line), and the sheets laid over it: the menu (Esc), the log (J), the character sheet (C:
// the over-skill, the skills, health part by part), a test's brief before it starts and its result
// when it ends; F's menu over whoever's within reach (Talk, Violence and its openings, Read:
// sim/interact.js), and their sheet as you guess it (sim/know.js). Plain DOM over the canvas, sized
// to it: the picture fills the
// window (fit()), centred, and the HUD is the same box, so nothing sits off the picture.
//
// The picture is RES pixels: 640 × 360, or on a window of another shape a little more street on its
// longer side, up to RES_MAX (as far as the street is kept alive off screen: sim/crowd.js,
// SCREEN_HALF_M, where nobody comes or goes in view), and a border only beyond that. It's scaled to
// fill (any scale: the view's last pass keeps every pixel the same size, src/art/pixelart.js).
//
// It shows the state and routes the player's choices to the callbacks it's given (src/main.js); it
// never changes the state itself. Times are game time (sim/clock.js); rolls read through checkShort() at the top left, checkText() (the whole sum) in the log.
import { townOf, localize, cityById } from '../sim/cities/index.js';
import { shopWord } from '../sim/shops.js';
import { needsWords } from '../sim/needs.js';
import { price, cashOf } from '../sim/money.js';
import { clockText, stampText, dateText } from '../sim/clock.js';
import { checkText, checkShort } from '../sim/checks.js';
import { SCENARIOS } from '../sim/scenarios/index.js';
import { placeName } from '../sim/map/street.js';
import { shownRolls } from '../sim/scenarios/sdr.js';
import { SCREEN_HALF_M } from '../sim/crowd.js';
import { SKILLS, CLASSES, TRAINED, skill } from '../sim/skills.js';
import { PARTS, stateOf, stateText, injuriesOn, FITNESS_K } from '../sim/health.js';
import { atHand, options as interactOptions } from '../sim/interact.js';
import { allowed, cqcOf, BREAK_CQC } from '../sim/cqc.js';
import { deathPaper } from '../sim/game.js';
import { shortName, statusLine } from '../sim/fight.js';
import { weaponOf, bare } from '../sim/weapons.js';
import { placed, fits } from '../sim/items.js';
import { options as aidOptions, bodyLine } from '../sim/aid.js';
import { agenda as agendaOf, heatWord as heatWordOf, places as placesOf, KINDS as KINDS_ } from '../sim/campaign.js';
import { streetName as streetNameOf } from '../sim/map/street.js';
import { calendar as calendarOf, DAY as DAY_MS } from '../sim/clock.js';
import { bleedRate, bloodOf, bandOf, BLOOD } from '../sim/health.js';
import { RANK as RANKS } from '../sim/instinct.js';
import { weatherAt } from '../sim/weather.js';

const BAND_WORDS = { steady: 'steady', pale: 'pale, light-headed', shock: 'in shock', collapsed: 'collapsed', dead: 'gone' };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
import { knownOf, classOf, READABLE } from '../sim/know.js';
import { passerby, describe } from '../sim/people.js';
import { CHOICES as TALK_CHOICES } from '../sim/talk.js';
import { LESSONS, FARM, lessonOf, numberOf, nextLesson } from '../sim/tutorial/index.js';
import { READ_S, WORD_S } from '../sim/tutorial/earpiece.js';
import { HEARSAY } from '../sim/hale.js';
import { plaque, place } from './plaque.js';

// (a place's glyph on its plaque; how far, in the plaque's few letters: "2 streets north" → "2 ST N")
const PLACE_ICON = { embassy: 'star', home: 'house', safe: 'key' };
const shortFar = (far) => String(far).replace(/^a street/, '1 street').replace(/streets?/, 'st').replace(/north/, 'n').replace(/south/, 's').replace(/on this street/, 'here');

const el = (tag, { dataset, ...props } = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  if (dataset) Object.assign(e.dataset, dataset);                  // (dataset is a getter: its entries, one by one)
  for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
  return e;
};
export const RES = [640, 360];                                     // (live: fit() sets it)
export const RES_BASE = [640, 360];
export const RES_MAX = [2 * SCREEN_HALF_M[0] * 16, 430];
const TOAST_S = 16;
let hudMs = 0, lastReal = 0;                                      // (the HUD's clock: it runs while the game does)                                                // (a log line at the top left lingers: the user, 2026-10-26, twice the 8 s it was)

export function createUI({ input, cb }) {
  const frame = el('div', { id: 'frame' });
  const watch = el('div', { className: 'watch' }, el('div', { className: 'time' }), el('div', { className: 'date' }), el('div', { className: 'place' }), el('div', { className: 'sky' }), el('div', { className: 'hand' }));
  // (a lesson of the tutorial: Hale on the earpiece, his line at a time, and the lesson's checklist under the watch: sim/tutorial/)
  const earpiece = el('div', { className: 'earpiece', hidden: true }, el('div', { className: 'who' }), el('div', { className: 'line' }));
  const lessonBox = el('div', { className: 'lesson', hidden: true });
  watch.append(lessonBox);
  const toasts = el('div', { className: 'toasts' });
  const keys = el('div', { className: 'keys' });
  const banner = el('div', { className: 'banner', textContent: 'PAUSED' });
  const marker = el('div', { className: 'marker', hidden: true });
  const bubble = el('div', { className: 'bubble', hidden: true });   // what a character's just become aware of: ? or !
  const speech = el('div', { className: 'speech' });                // what's said aloud, in balloons over whoever said it
  const you = el('div', { className: 'you', hidden: true });         // which one is you, when someone's at arm's length
  const pointed = el('div', { className: 'you pointed', hidden: true });   // whom the instinct's line names (prompt.at)
  const intent = el('div', { className: 'intent', hidden: true });   // in a fight: what they're about to do, if we read it
  const bout = el('div', { className: 'bout', hidden: true });       // in a fight: the two of them, the score, the edges
  const moves = el('div', { className: 'moves', hidden: true });    // in a fight: the three moves and their keys, while we choose
  const ask = el('div', { className: 'ask', hidden: true });           // F's menu, over whoever's within reach
  const reach = el('div', { className: 'reach', hidden: true });       // a key over whoever's within reach
  const talkbox = el('div', { className: 'ask talkbox', hidden: true }); // a conversation, over them (time stands still)
  const states = [0, 1].map(() => el('div', { className: 'fstate', hidden: true }));   // staggered, dazed: over a fighter
  const tags = el('div', { className: 'tags' });                   // faces you've marked: seen before, a tail
  const signs = el('div', { className: 'tags' });                  // the places that are yours, over their doors (a scenario's signs())
  const goal = el('canvas', { className: 'plaque goal', hidden: true });   // where you're going, when it's off the picture (src/ui/plaque.js)
  const prompt = el('div', { className: 'prompt', hidden: true });
  const veil = el('div', { className: 'bloodveil' });                 // (the blood lost: the world dims and reddens at the edges)
  const hud = el('div', { id: 'hud' }, veil, signs, tags, marker, bubble, intent, ...states, you, pointed, speech, reach, ask, talkbox, bout, moves, goal, prompt, watch, toasts, earpiece, keys, banner);
  const menu = el('div', { className: 'overlay', hidden: true });
  const log = el('div', { className: 'overlay', hidden: true });
  const paper = el('div', { className: 'overlay', hidden: true });     // a brief, a result
  const card = el('div', { className: 'overlay', hidden: true });      // the character sheet
  frame.append(hud, menu, log, card, paper);
  const title = el('div', { id: 'title', hidden: true });
  document.body.append(frame, title);

  /** The picture to the window: its size in pixels (RES), the frame's, and the view told (cb.fit: the canvas in device pixels). */
  function fit() {
    const ww = innerWidth, wh = innerHeight, dpr = devicePixelRatio || 1;
    let w = RES_BASE[0], h = RES_BASE[1];
    if (ww * h > wh * w) w = Math.min(RES_MAX[0], Math.round(h * ww / wh)); else h = Math.min(RES_MAX[1], Math.round(w * wh / ww));
    const s = Math.min(ww / w, wh / h), fw = Math.round(w * s), fh = Math.round(h * s);
    // (the HUD's type and panels scale with the picture: 1 at 1280 wide (2× the art), 1.5 at 1920, 0.85 at 1024)
    document.documentElement.style.setProperty('--ui', String(Math.round(Math.max(0.85, Math.min(1.5, s / 2)) * 100) / 100));
    RES[0] = w; RES[1] = h;
    Object.assign(frame.style, { width: `${fw}px`, height: `${fh}px`, left: `${Math.floor((ww - fw) / 2)}px`, top: `${Math.floor((wh - fh) / 2)}px` });
    cb.fit?.(w, h, Math.round(fw * dpr), Math.round(fh * dpr));
  }
  fit();
  addEventListener('resize', fit);

  // The keys at the bottom right, for what you're doing: on the street, in a fight, in a conversation.
  // (the keys in play: behind "?", the user's, folded to a hint until it's pressed; the choice kept for this browser)
  let hintsFor = null, keysOpen = false;
  try { keysOpen = localStorage.getItem('tradecraft.keys') === 'open'; } catch {}
  const keyHints = (mode = hintsFor ?? 'street') => {
    hintsFor = mode;
    const k = (a) => `<kbd>${input.label(a)}</kbd>`;
    keys.classList.toggle('folded', !keysOpen);
    if (!keysOpen) { keys.innerHTML = '<kbd>?</kbd> keys'; return; }
    keys.innerHTML = mode === 'fight' ? `${k('hit')} hit · ${k('grapple')} grab · ${k('guard')} cover · ${k('run')} held: spend an edge · ${k('gun')} draw · ${k('interact')} your read · ${k('log')} log · ${k('pause')} pause`
      : mode === 'talk' ? `<kbd>1</kbd>–<kbd>4</kbd> say · ${k('menu')} leave it there`
      : `${k('up')}${k('left')}${k('down')}${k('right')} walk · ${k('slow')} stroll · ${k('run')} run · ${k('watch')} look (tap: glance) · ${k('instinct')} instinct · ${k('interact')} people · ${k('aid')} first aid · ${k('inventory')} carry · ${k('gun')} draw · ${k('sheet')} sheet · ${k('log')} log · ${k('pause')} pause · ${k('menu')} menu`;
  };
  keyHints();
  setTimeout(() => keyHints(), 300);                               // once the keyboard's layout is known
  /** "?": the keys shown, or folded away. */
  const toggleKeys = () => { keysOpen = !keysOpen; try { localStorage.setItem('tradecraft.keys', keysOpen ? 'open' : 'folded'); } catch {} keyHints(); };

  // ---------- the title ----------
  let titleWas = null;
  function showTitle({ version, auto, farm = false }) {
    titleWas = { version, auto, farm };
    // The Farm: the lesson, or, the lesson had, a memory first (sim/scenarios/dojo.js, chapter 'remembered').
    // (the free walk in any of the cities, one entry: sim/cities/; the line under it says where the pointer is)
    const CITY_WALKS = [['moscow', 'Moscow', 'A boulevard in central Moscow: plaster and Stalinist stone, the lanes north and south, the sun down at ten to five.'],
      ['london', 'London', 'Notting Hill\'s terraces and pubs, a November afternoon, the pavements wet.'], ['beirut', 'Beirut', 'Gemmayzeh and Achrafieh: old houses, stairs up the hill, cables everywhere.'], ['cairo', 'Cairo', 'Downtown and the lanes off it: dust, signs in Arabic, a minaret.']];
    const walkEntry = (key, s) => {
      const about = el('small', { textContent: 'Walk, look, get the feel of it, a November afternoon in whatever weather the day brings: in Moscow, London, Beirut or Cairo.' });
      return [el('div', { className: 'item walk' }, s.name, about, el('div', { className: 'cities' }, ...CITY_WALKS.map(([c, name, words]) =>
        el('button', { className: 'small', onclick: () => cb.newGame(key, null, c === 'moscow' ? null : c), onmouseenter: () => { about.textContent = words; }, onfocus: () => { about.textContent = words; } }, name))))];
    };
    // (the game's way in: an officer for a posting, and day one in their flat; the city's chosen with the officer)
    const campaignEntry = () => el('button', { className: 'item campaign', onclick: () => cb.newCampaign?.('moscow') }, 'New game: pick your officer',
      el('small', { textContent: 'Three officers for a posting at a US embassy (Moscow, London, Beirut or Cairo). Pick one, and day one starts in their flat. Hale will call.' }));
    const entry = (key, s) => key === 'walk' ? walkEntry(key, s)
      : key !== 'dojo' ? [el('button', { className: 'item', onclick: () => cb.newGame(key) }, s.name, el('small', { textContent: s.about }))] : [
      el('button', { className: 'item', onclick: () => cb.newGame('dojo', farm ? 'remembered' : 'lesson') }, farm ? 'The Farm, remembered' : s.name,
        el('small', { textContent: farm ? 'The bouts you remember, three of your class and Hale; and what brought them back, years on, in Moscow.' : s.about })),
      el('button', { className: 'item', onclick: () => cb.newGame('dojo', farm ? 'lesson' : 'remembered') }, farm ? 'The Farm: the whole lesson again' : 'The Farm, remembered',
        el('small', { textContent: farm ? s.about : 'Straight to the bouts, and what they bring back, years on. For after the lesson.' }))];
    title.replaceChildren(el('div', { className: 'sheet' },
      el('h1', { textContent: 'TRADECRAFT' }),
      el('p', { className: 'sub', textContent: `v${version} · ${/-rc/.test(version) ? 'release candidate: the first playable' : 'in development'}` }),
      el('hr'),
      auto ? el('button', { className: 'item', onclick: () => cb.continue() }, 'Continue', el('small', { textContent: auto.about })) : null,
      campaignEntry(),
      el('hr'),
      ...Object.entries(SCENARIOS).filter(([key, s]) => !s.test && !s.campaign && key !== 'dojo').flatMap(([key, s]) => entry(key, s)),
      el('button', { className: 'item', onclick: () => cb.importSave() }, 'Load a save file…', el('small', { textContent: 'A .json save exported from the menu.' })),
      el('hr'),
      el('p', { className: 'note', textContent: 'The tutorial is Hale\'s: he\'ll call your flat on day one. Keys are read by where they sit on the keyboard, so they work on any layout. In play, ? shows them.' }),
    ));
    title.hidden = false;
    title.querySelector('.item')?.focus();
  }
  const hideTitle = () => { title.hidden = true; };

  /**
   * The tutorial's directory (sim/tutorial/index.js): its lessons in order, each with Hale, and (but the
   * Farm, which is a lesson whatever) on your own: the plain mechanic test.
   */
  function showTutorial({ home = null } = {}) {
    const farm = titleWas?.farm, city = home ? cityById(home.city).name : null;
    const row = (L, n) => L.farm
      ? el('div', { className: 'row' },
        el('button', { className: 'item', onclick: () => cb.newGame('dojo', 'lesson') }, `${n}. ${L.title}`, el('small', { textContent: L.about })),
        farm && !home ? el('button', { className: 'item alone', title: 'The bouts, and years on, Moscow', onclick: () => cb.newGame('dojo', 'remembered') }, 'Remembered') : null)
      : el('div', { className: 'row' },
        el('button', { className: 'item', onclick: () => cb.newLesson?.(L.id) }, `${n}. ${L.title}`, el('small', { textContent: L.about })),
        el('button', { className: 'item alone', title: 'The plain test: no Hale', onclick: () => cb.newGame(L.scenario) }, 'On your own'));
    title.replaceChildren(el('div', { className: 'sheet directory' },
      el('h1', { textContent: home ? 'HALE\'S EXERCISES' : 'TUTORIAL' }),
      el('p', { className: 'sub', textContent: home ? `${home.name}, your first weeks at Station ${city}. Hale runs the station's training: before you're trusted with the real thing, he takes you through it on the street, an earpiece in your ear, our own people playing the parts. Each lesson is yours to play, or to skip.` : 'Your first month at the station. Hale, who taught you at the Farm, runs its training: before you\'re trusted with the real thing, he takes you through it on the street, an earpiece in your ear, the station\'s own people playing the parts.' }),
      el('p', { className: 'note hearsay', textContent: `They say things about Hale, in the canteen. ${HEARSAY[Math.floor(Math.random() * HEARSAY.length)]}` }),
      el('hr'),
      el('div', { className: 'lessons' }, ...LESSONS.map((L, n) => row(L, n))),
      el('hr'),
      ...(home ? [
        el('button', { className: 'item', onclick: () => cb.beginPosting?.() }, 'Begin the posting', el('small', { textContent: 'Enough exercises: the station\'s brief, and the real thing. Hale\'s number stays by the phone.' })),
        el('button', { className: 'item', onclick: () => cb.backHome?.() }, 'Back to the flat', el('small', { textContent: 'As you left it.' }))]
        : [el('button', { className: 'item', onclick: () => showTitle(titleWas ?? {}) }, 'Back to the title')])));
    title.hidden = false;
    title.querySelector('.item')?.focus();
  }

  // ---------- the HUD ----------
  // (every frame: the frame's width read before anything's written, and text written only when it
  // changes, so the HUD forces no layout of its own and leaves the page's untouched when nothing moves)
  const put = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  /** view: { posOf(id) → [x, z] as drawn, camera { x, z } }, for the marker over a scenario's target. */
  function update(state, paused, view) {
    here = state.map?.city ?? null;
    const mode = state.fight && !state.fight.ended ? 'fight' : state.talk ? 'talk' : 'street';
    if (mode !== hintsFor) keyHints(mode);
    const fw = frame.clientWidth, watchL = watch.offsetLeft, watchB = watch.offsetTop + watch.offsetHeight;   // (read before anything's written: the watch's corner, for the way's plaque)
    put(watch.querySelector('.time'), clockText(state.time.ms));
    put(watch.querySelector('.date'), stampText(state.time.ms).split(',')[0]);
    const me = state.actors.find(a => a.who === state.player);
    const held = weaponOf(state.people[state.player]?.hand);       // (what's in your hand, under the watch: sim/items.js)
    put(watch.querySelector('.hand'), held ? `in hand: ${bare(held)}` : '');
    if (me && state.map?.kind === 'street') put(watch.querySelector('.place'), placeName(townOf(state.map), state.map.row ?? 0, me.x, me.z));
    else put(watch.querySelector('.place'), SCENARIOS[state.scenario.kind]?.place?.(state) ?? '');
    put(watch.querySelector('.sky'), weatherAt(state).words);      // (the weather, in a few words: sim/weather.js)
    // (a lesson's checklist, under the watch: redrawn only when a step's done)
    const tu = state.tutor, L = tu && lessonOf(tu.lesson);
    if (L) {
      const key = `${L.id}:${tu.steps.map(s => (s.done ? 1 : 0)).join('')}`;
      if (lessonBox.dataset.key !== key) {
        lessonBox.dataset.key = key;
        lessonBox.replaceChildren(el('div', { className: 'title', textContent: `LESSON ${numberOf(L.id)} · ${L.title}` }),
          ...tu.steps.map(s => el('div', { className: `step${s.done ? ' done' : ''}` }, el('span', { className: 'box', textContent: s.done ? '✓' : '' }), ...keyed(s.text))));
      }
      lessonBox.hidden = false;
    } else lessonBox.hidden = true;
    frame.classList.toggle('paused', paused && menu.hidden && log.hidden && paper.hidden);
    if (paused && banner.dataset.key !== input.label('pause')) { banner.dataset.key = input.label('pause'); banner.textContent = `PAUSED · ${input.label('pause')}`; }
    // The marker: over whom we take for the target (sc.marked), as we last saw them (live, or their
    // memory in the dimmed street), at the frame's edge when they're off it; hollow when out of view.
    // Only until sc.markUntil, when a scenario says so (the tail: from there on, our eyes).
    const sc = state.scenario, mk = sc.marked && !sc.outcome && !(sc.markUntil && state.time.ms >= sc.markUntil) ? sc.marked : null;
    const ls = sc.lastSeen && (sc.lastSeen.row ?? state.map.row) === state.map.row ? sc.lastSeen : null;   // (of this street)
    const t = mk && (view?.posOf(mk) ?? (ls && [ls.x, ls.z]));
    marker.hidden = !t;
    if (t) {
      marker.classList.toggle('memory', state.mind?.seen?.[mk]?.[5] !== state.mind?.at);
      const k = fw / RES[0], cam = view.camera;
      const sx = RES[0] / 2 + (t[0] - cam.x) * 16, sy = RES[1] / 2 + (t[1] - cam.z) * 16 - 2.45 * 16;
      const cx = Math.max(6, Math.min(RES[0] - 6, sx)), cy = Math.max(8, Math.min(RES[1] - 8, sy));
      const off = cx !== sx || cy !== sy;
      marker.classList.toggle('off', off);
      marker.style.transform = `translate(${Math.round(cx * k)}px, ${Math.round(cy * k)}px) rotate(${off ? Math.atan2(sy - cy, sx - cx) * 180 / Math.PI - 90 : 0}deg)`;
      marker.style.setProperty('--k', k);
    }
    // Faces you've marked (a scenario's suspects: { actor id: 1 seen before, 2 a tail }), over them as drawn.
    const k0 = fw / RES[0], cam0 = view?.camera;
    const sus = !sc.outcome && sc.suspects ? Object.entries(sc.suspects).filter(([, v]) => v >= 1) : [];
    while (tags.children.length < sus.length) tags.append(el('canvas', { className: 'plaque' }));
    [...tags.children].forEach((t, i) => {
      const at = sus[i] && view?.posOf(sus[i][0]);
      t.hidden = !at;
      if (!at) return;
      const sure = sus[i][1] >= 2;
      place(t, plaque({ text: sure ? 'tail' : 'seen before', style: sure ? 'tail' : 'seen', icon: 'eye' }), RES[0] / 2 + (at[0] - cam0.x) * 16, RES[1] / 2 + (at[1] - cam0.z) * 16 - 2.4 * 16, k0);
    });
    // The places that are yours on this street (a scenario's signs(): [{ x, z, label }]), over their doors.
    const sgs = (!sc.outcome && cam0 && SCENARIOS[sc.kind]?.signs?.(state)) || [];
    while (signs.children.length < sgs.length) signs.append(el('canvas', { className: 'plaque' }));
    [...signs.children].forEach((t, i) => {
      const s = sgs[i], sx = s && RES[0] / 2 + (s.x - cam0.x) * 16, sy = s && RES[1] / 2 + (s.z - cam0.z) * 16 - 3.0 * 16;
      t.hidden = !s || sx < -40 || sx > RES[0] + 40 || sy < 0 || sy > RES[1];
      if (t.hidden) return;
      place(t, plaque({ text: s.label, style: s.kind ?? 'way', icon: PLACE_ICON[s.kind] ?? 'pin' }), sx, sy, k0);
    });
    // Where you're going (a scenario's goal(): { row, x, z, label }), at the picture's edge when it's off it.
    const gl = !sc.outcome && SCENARIOS[sc.kind]?.goal?.(state);
    goal.hidden = !gl;
    if (gl && cam0) {
      let gx = RES[0] / 2 + (gl.x - cam0.x) * 16, gy = RES[1] / 2 + (gl.z - cam0.z) * 16;
      const other = gl.row !== (state.map.row ?? 0);
      if (other) gy = gl.row < state.map.row ? -1e3 : 1e3;
      const on = !other && gx > 20 && gx < RES[0] - 20 && gy > 20 && gy < RES[1] - 20;
      goal.hidden = on;
      // (clear of the watch at the top right and the instinct's line at the foot; the arrow the way it lies)
      const cy = Math.max(14, Math.min(RES[1] - 44, gy)), cx = Math.max(8, Math.min((cy + 8) * k0 < watchB ? watchL / k0 - 6 : RES[0] - 8, gx));
      const way = gy < 14 ? 'up' : gy > RES[1] - 44 ? 'down' : gx < 8 ? 'left' : 'right';
      // (a scene's label "NAME · how far" read as its two parts: the name, and how far, quieter)
      const [name, far] = gl.name ? [gl.name, gl.far] : String(gl.label).split(' · ');
      place(goal, plaque({ text: name, sub: far ? shortFar(far) : null, style: gl.kind ?? 'way', icon: way, notch: false }), cx, cy, k0, cx < RES[0] / 2 ? 'left' : 'right');
    }
    // A mark over a character who's just noticed something, while it lasts and they're in view.
    const mk2 = sc.mark && sc.mark.until > state.time.ms && !sc.outcome && view?.posOf(sc.mark.id);
    bubble.hidden = !mk2;
    if (mk2) {
      const k = fw / RES[0], cam = view.camera;
      const bx = RES[0] / 2 + (mk2[0] - cam.x) * 16, by = RES[1] / 2 + (mk2[1] - cam.z) * 16 - 3.0 * 16;
      bubble.textContent = sc.mark.glyph;
      bubble.className = `bubble ${sc.mark.glyph === '!' ? 'alarm' : ''}`;
      bubble.style.transform = `translate(${Math.round(bx * k)}px, ${Math.round(by * k)}px)`;
    }
    // Whoever's within reach of F, marked with its key; F's menu over them while it's open.
    const near = !sc.outcome && !state.fight && ask.hidden && atHand(state), nearAt = near && view?.posOf(near.id);
    reach.hidden = !nearAt;
    if (nearAt && view?.camera) {
      const k = fw / RES[0], cam = view.camera;
      if (reach.dataset.key !== input.label('interact')) { reach.dataset.key = input.label('interact'); reach.replaceChildren(el('kbd', { textContent: input.label('interact') })); }
      reach.style.transform = `translate(${Math.round((RES[0] / 2 + (nearAt[0] - cam.x) * 16) * k)}px, ${Math.round((RES[1] / 2 + (nearAt[1] - cam.z) * 16 - 2.2 * 16) * k)}px)`;   // (the point just over the head)
    }
    if (!ask.hidden && askFor) {
      const at = view?.posOf(askFor.id), k = fw / RES[0], cam = view?.camera;
      // (beside them, kept inside the picture)
      if (at && cam) {
        const W = fw, H = frame.clientHeight, w = ask.offsetWidth, h = ask.offsetHeight;
        const x = Math.max(8, Math.min(W - w - 8, (RES[0] / 2 + (at[0] - cam.x) * 16 + 14) * k)), y = Math.max(h / 2 + 8, Math.min(H - h / 2 - 8, (RES[1] / 2 + (at[1] - cam.z) * 16 - 2.6 * 16) * k));
        ask.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    }
    // A conversation (sim/talk.js): what's been said, and what to say, over them; time stands still.
    const tk = !sc.outcome && state.talk, tAt = tk && view?.posOf(tk.id);
    talkbox.hidden = !tk;
    if (tk) {
      const key = `${tk.who}:${tk.round}`;
      if (talkbox.dataset.key !== key) {
        talkbox.dataset.key = key;
        const p = state.people[tk.who], name = p.known === false ? p.seen : p.name;
        talkbox.replaceChildren(el('div', { className: 'who', textContent: `Talking to ${name}` }),
          ...tk.said.slice(-3).map(x => el('div', { className: 'said' }, el('i', { textContent: x.ours }), el('div', { textContent: x.theirs }))),
          ...TALK_CHOICES.map((c, i) => el('button', { className: 'opt', onclick: () => cb.talk?.(c.id) }, el('kbd', { textContent: String(i + 1) }), el('span', { textContent: c.label }))),
          el('div', { className: 'foot', textContent: `Time stands still while you talk · ${input.label('menu')}: leave it there` }));
      }
      if (tAt && view?.camera) {
        const k = fw / RES[0], cam = view.camera, W = fw, H = frame.clientHeight, w = talkbox.offsetWidth, h = talkbox.offsetHeight;
        const x = Math.max(8, Math.min(W - w - 8, (RES[0] / 2 + (tAt[0] - cam.x) * 16 + 14) * k)), y = Math.max(h / 2 + 8, Math.min(H - h / 2 - 8, (RES[1] / 2 + (tAt[1] - cam.z) * 16 - 2.6 * 16) * k));
        talkbox.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    }
    // A fight (sim/cqc.js): over the other one, what we read they're about to do (an icon and a word,
    // brass; a '?' when we can't), while we choose; over either, staggered or dazed; at the top, the
    // two of them, a bout's score and the edges each holds; at the foot, the three moves and their keys.
    const fi = !sc.outcome && state.fight, sides = fi ? [state.actors.find(a => a.who === fi.a), state.actors.find(a => a.who === fi.b)] : [];
    // (each label nudged outward, away from the other fighter, so two labels never read as one)
    const kk = fw / RES[0], camF = view?.camera, pos = (a) => a && view?.posOf(a.id);
    const out = (i) => { const p = pos(sides[i]), q = pos(sides[1 - i]); return p && q ? Math.sign(p[0] - q[0] || (i ? 1 : -1)) * 0.75 : 0; };
    const over = (a, up, dx = 0) => { const p = pos(a); return p && camF && `translate(${Math.round((RES[0] / 2 + (p[0] + dx - camF.x) * 16) * kk)}px, ${Math.round((RES[1] / 2 + (p[1] - camF.z) * 16 - up * 16) * kk)}px)`; };
    const choosing = fi && fi.phase === 'choose' && fi.status?.a !== 'stunned';
    const at = choosing && over(sides[1], 2.45, out(1));
    intent.hidden = !at;
    if (at) {
      // (stunned, they've nothing coming: OPEN, not the '?' of a move we can't read)
      const m = fi.theirs.move, open = m === 'open', read = fi.read && !open, key = open ? 'open' : read ? m : '?';
      if (intent.dataset.key !== key) {
        intent.dataset.key = key;
        intent.replaceChildren(...[read && el('img', { src: icon(m), alt: '' }), el('span', { textContent: open ? 'OPEN' : read ? MOVE_WORD[m] : '?' })].filter(Boolean));
        intent.className = `intent ${read ? 'read' : ''}${open ? ' open' : ''}`;
      }
      intent.style.transform = at;
    }
    states.forEach((t, i) => {
      const st = fi?.status?.[i ? 'b' : 'a'], at2 = st && over(sides[i], fi.phase === 'choose' && i === 1 ? 3.3 : 2.45, out(i));
      t.hidden = !at2;
      if (!at2) return;
      t.textContent = `${i ? '' : 'YOU · '}${{ stunned: 'STUNNED', dazed: 'DAZED', staggered: 'STAGGERED' }[st]}`;
      t.className = `fstate ${st}`;
      t.style.transform = at2;
    });
    const lost = Math.max(0, Math.min(1, (100 - bloodOf(state.people[state.player])) / (100 - BLOOD.dead)));
    const vo = String(Math.round(lost * 100) / 100);
    if (veil.style.opacity !== vo) veil.style.opacity = vo;
    bout.hidden = !fi;
    if (fi) {
      const name = (who) => { if (who === state.player) return 'You'; const n = shortName(state, who); return /^(the|a|an) /.test(n) ? n : cap(n); };   // ('You vs the man in the red beanie')
      const key = `${name(fi.a)}|${fi.adv.a}|${fi.bout ? `${fi.score.a}:${fi.score.b}` : '-'}|${fi.adv.b}|${name(fi.b)}`;
      if (bout.dataset.key !== key) {
        bout.dataset.key = key;
        const pips = (n, s) => el('span', { className: `pips ${s}`, title: 'edges' }, ...Array.from({ length: Math.max(n, 0) }, () => el('i')));
        bout.replaceChildren(el('b', { textContent: name(fi.a) }), pips(fi.adv.a, 'a'),
          el('span', { className: 'score', textContent: fi.bout ? `${fi.score.a} – ${fi.score.b}` : fi.tell ? 'drill' : 'vs' }), pips(fi.adv.b, 'b'), el('b', { textContent: name(fi.b) }));
      }
    }
    moves.hidden = !choosing;
    if (choosing && moves.dataset.adv !== `${fi.adv.a}${fi.status?.a}${fi.status?.b}`) {
      moves.dataset.adv = `${fi.adv.a}${fi.status?.a}${fi.status?.b}`;
      // (them stunned, an edge in hand: a fight ender, sim/cqc.js finish(); in a bout, a foul)
      const ender = fi.adv.a > 0 && fi.status?.b === 'stunned', breaks = cqcOf(state, fi.a) >= BREAK_CQC;
      const why = { staggered: 'off balance', dazed: 'too slow' }[fi.status?.a];
      moves.replaceChildren(...['hit', 'grapple', 'guard'].map(m => el('div', { className: `move${allowed(fi.status?.a, m) ? '' : ' off'}`, title: allowed(fi.status?.a, m) ? '' : why },
        el('kbd', { textContent: input.label(m) }), el('img', { src: icon(m), alt: '' }), el('span', { textContent: allowed(fi.status?.a, m) ? MOVE_WORD[m].toLowerCase() : `${MOVE_WORD[m].toLowerCase()}: ${why}` }))),
        ...(ender ? [el('div', { className: `move spend ender${fi.bout ? ' foul' : ''}`, title: `They can't defend. A CQC check: a hit knocks them out; a grab ${breaks ? 'breaks an arm or a leg' : 'slams them into the floor'}. Failed, it still does double, and likely breaks something. It can kill.` },
          el('kbd', { textContent: input.label('run') }), el('span', { textContent: `+ hit: knock out · + grab: ${breaks ? 'break a limb' : 'slam down'}${fi.bout ? ' · a foul' : ''}` }))]
          : fi.adv.a ? [el('div', { className: 'move spend', title: 'Held with a move, an edge: a hit lands double; a grab shrugs off a punch; a cover hits back, and keeps the edge' },
          el('kbd', { textContent: input.label('run') }), el('span', { textContent: `+ a key: an edge (${fi.adv.a}); with a cover, hit back` }))] : []));
    }
    // The instinct: always a line, its tone in its border; {key} in the text shows as that key.
    // What's at hand (the engine's: sim/acts.js affordance()) ends a line that offers nothing itself.
    // (in a fight, someone stunned, dazed or staggered: the engine's line on it comes first: sim/fight.js)
    // (in a fight, how things stand; then your own body, if it's more pressing than the scene's line: sim/aid.js)
    // (in a shop: where you are, in place of the scene's line, unless it's urgent: sim/shops.js)
    const inShop = state.actors.find(a => a.who === state.player)?.inside;
    const shopLine = inShop && { id: 'inside', tone: 'calm', text: inShop.way === 'back' ? `In ${shopWord(inShop.shop)}, through to the back: out on the street behind in a moment.` : inShop.way === 'wash' ? `In ${shopWord(inShop.shop)}'s toilet, the bolt across, cleaning up.` : inShop.way === 'eat' ? `In ${shopWord(inShop.shop)}, eating, your back to the wall.` : inShop.way === 'coat' ? `In ${shopWord(inShop.shop)}, along the rails, a coat that fits.` : inShop.way === 'sit' ? `At ${shopWord(inShop.shop)}'s window table, a coffee, the street outside: who stops when you do?` : `In ${shopWord(inShop.shop)}, among the shelves. Out again in a minute.` };
    const sceneP = shopLine && sc.prompt?.tone !== 'urgent' ? shopLine : sc.prompt;
    const body = bodyLine(state), scene = sceneP && body && RANKS[body.tone] <= RANKS[sceneP.tone] ? sceneP : body ?? sceneP;
    const sp = !sc.outcome && ((state.fight?.phase === 'choose' && statusLine(state)) || scene), off = !sc.outcome && !sp?.act && sp?.tone !== 'urgent' && state.$offer;
    // (the offer a chip of its own after the line, not run on into its sentence)
    const p = sp || off ? { tone: sp?.tone ?? 'calm', text: (sp?.text ?? '').trim(), offer: off ? off.text.trim() : '' } : null;
    prompt.hidden = !p;
    if (p && prompt.dataset.text !== p.text + p.offer + p.tone) {
      prompt.dataset.text = p.text + p.offer + p.tone;
      prompt.className = `prompt ${p.tone}`;
      prompt.replaceChildren(...keyed(p.text), ...(p.offer ? [el('span', { className: `offer${p.text ? '' : ' alone'}` }, ...keyed(p.offer))] : []));
    }
    // (the move panel sits above the instinct, however many lines it runs to)
    if (!moves.hidden) moves.style.bottom = `${p ? 58 + prompt.offsetHeight + 8 : 96}px`;
    if (!earpiece.hidden) earpiece.style.bottom = `${(p ? 58 + prompt.offsetHeight + 8 : 58) + (moves.hidden ? 0 : moves.offsetHeight + 8)}px`;   // (Hale over the instinct's line, which he supplements)
    // (a log line's 16 s run while the game does: not under a brief, a sheet, a paper or the pause)
    const real = performance.now(), cover = overlay();
    if (!paused && !cover && lastReal) hudMs += real - lastReal;
    lastReal = real;
    frame.classList.toggle('covered', !!cover && cover !== 'interact');
    const now = hudMs;
    for (const t of [...toasts.children]) {
      if (now - t.born > TOAST_S * 1000 && !t.classList.contains('gone')) t.classList.add('gone');
      if (now - t.born > (TOAST_S + 1.5) * 1000) t.remove();
    }
    if (!earpiece.hidden && now - earpiece.born > earpiece.life) { earpiece.classList.add('gone'); if (now - earpiece.born > earpiece.life + 1500) earpiece.hidden = true; }
    seenView = view;
    placeBalloons(view, now, fw);
    // (you, marked: a brass caret over your head while someone stands within reach of you, out of a fight)
    const meA = state.actors.find(a => a.who === state.player), meAt = meA && view?.posOf(meA.id), camY = view?.camera;
    const crowded = meA && !state.fight && state.actors.some(o => o !== meA && !o.hidden && (o.row ?? state.map.row) === (meA.row ?? state.map.row) && Math.hypot(o.x - meA.x, o.z - meA.z) < 1.3);
    you.hidden = !(crowded && meAt && camY);
    // (the one the instinct's line names, over their head while it's said and they're in sight)
    const atP = !sc.outcome && sc.prompt?.at && view?.posOf(sc.prompt.at);
    pointed.hidden = !(atP && camY);
    if (!pointed.hidden) pointed.style.transform = `translate(${Math.round((RES[0] / 2 + (atP[0] - camY.x) * 16) * (fw / RES[0]))}px, ${Math.round((RES[1] / 2 + (atP[1] - camY.z) * 16 - 2.4 * 16) * (fw / RES[0]))}px)`;
    if (!you.hidden) you.style.transform = `translate(${Math.round((RES[0] / 2 + (meAt[0] - camY.x) * 16) * (fw / RES[0]))}px, ${Math.round((RES[1] / 2 + (meAt[1] - camY.z) * 16 - 2.15 * 16) * (fw / RES[0]))}px)`;
  }
  // A line with {key} placeholders, the keys as this player has them (a prompt, a toast, the log).
  // Pixel icons for the three moves: a fist, an open hand, a cover (12 × 12, '#' ink, 'o' the fill).
  const MOVE_WORD = { hit: 'HIT', grapple: 'GRAB', guard: 'COVER' };
  const ICONS = {
    hit: ['....####....', '...#oooo##..', '..#oo#oo#o#.', '..#oo#oo#o#.', '..#oooooooo#', '..#oooooooo#', '..#ooooooo#.', '...#oooooo#.', '...#ooooo#..', '....#####...'],
    grapple: ['..#.#.#.....', '.#o#o#o#....', '.#o#o#o#.#..', '.#o#o#o##o#.', '.#ooooooo#..', '.#ooooooo#..', '..#ooooo#...', '..#ooooo#...', '...#####....'],
    guard: ['.##########.', '#oooooooooo#', '#ooo####ooo#', '#oooooooooo#', '.#oooooooo#.', '.#oooooooo#.', '..#oooooo#..', '...#oooo#...', '....####....'],
  };
  const iconCache = {};
  function icon(name) {
    if (iconCache[name]) return iconCache[name];
    const rows = ICONS[name], cv = document.createElement('canvas');
    cv.width = 12; cv.height = 12;
    const g = cv.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '.') return; g.fillStyle = c === '#' ? '#14151c' : '#f4efe6'; g.fillRect(x, y + Math.floor((12 - rows.length) / 2), 1, 1); }));
    return (iconCache[name] = cv.toDataURL());
  }

  let here = null;                                                 // (the city the game's in: its words for a Moscow scene's: sim/cities/ localize())
  const keyed = (text) => localize(here, text).split(/(\{[a-z]+\})/).filter(Boolean).map(part => {
    const m = part.match(/^\{([a-z]+)\}$/);
    return m ? el('kbd', { textContent: input.label(m[1]) }) : el('span', { textContent: part });
  });

  function toast(e) {
    if (e.hidden) return;                                          // (what the character didn't see)
    if (e.kind === 'radio') return radioLine(e);
    if (e.says && speakOver(e)) { if (e.aside) toast({ kind: e.kind, text: e.aside }); return; }   // (said aloud: a balloon; the rest top left)
    const t = el('div', { className: `toast ${e.kind}${e.roll && !e.roll.ok ? ' fail' : ''}` }, ...keyed(e.text ?? ''), e.roll ? el('span', { className: 'num', textContent: checkShort(e.roll), title: checkText(e.roll) }) : null);   // (in brief: the whole sum is the log's, J)
    t.born = hudMs;
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }
  /** Hale on the earpiece: his line in its box, for as long as it takes to read and a little (sim/tutorial/earpiece.js). */
  function radioLine(e) {
    put(earpiece.querySelector('.who'), `${(e.who ?? 'Hale').toUpperCase()} · EARPIECE`);
    earpiece.querySelector('.line').replaceChildren(...keyed(e.text ?? ''));
    earpiece.born = hudMs;
    earpiece.life = (READ_S + String(e.text ?? '').split(/\s+/).length * WORD_S + 5) * 1000;
    earpiece.hidden = false;
    earpiece.classList.remove('gone');
  }
  /** A new game: the HUD's lines and balloons cleared, and its city's words (sim/cities/ localize()) from now on. */
  const clearToasts = (city = here) => { toasts.replaceChildren(); speech.replaceChildren(); balloons.clear(); earpiece.hidden = true; here = city; };

  // ---------- speech: a balloon over whoever said it (a log line's says: { id, words }: sim/log.js) ----------
  const balloons = new Map();                                      // actor id → the balloon (its lines, each with when it was said)
  let seenView = null;                                             // (the view as update() last had it: where people are drawn)
  /** Over them, if they're in the picture; else false (the top left has it). */
  function speakOver(e) {
    const at = seenView?.posOf(e.says.id), cam = seenView?.camera;
    if (!at || !cam || Math.abs(at[0] - cam.x) * 16 > RES[0] / 2 + 8 || !e.says.words) return false;
    let b = balloons.get(e.says.id);
    if (!b) { b = el('div', { className: 'balloon' }); balloons.set(e.says.id, b); speech.append(b); }
    const line = el('p', {}, ...keyed(e.says.words));
    line.born = hudMs;
    b.append(line);
    while (b.children.length > 3) b.firstChild.remove();
    return true;
  }
  /** Each line its TOAST_S, as a line at the top left (the same clock); over the speaker's head, kept inside the picture. */
  function placeBalloons(view, now, W) {
    const k = W / RES[0], cam = view?.camera;
    const o = speech.getBoundingClientRect(), tagBoxes = balloons.size ? [intent, reach, bubble, ...states].filter(e => !e.hidden && e.isConnected)
      .map(e => { const r = e.getBoundingClientRect(); return { left: r.left - o.left, right: r.right - o.left, top: r.top - o.top, bottom: r.bottom - o.top }; })
      .sort((a, b) => b.top - a.top) : [];
    for (const [id, b] of balloons) {
      for (const p of [...b.children]) {
        if (now - p.born > TOAST_S * 1000 && !p.classList.contains('gone')) p.classList.add('gone');
        if (now - p.born > (TOAST_S + 1.5) * 1000) p.remove();
      }
      if (!b.children.length) { b.remove(); balloons.delete(id); continue; }
      const at = view?.posOf(id);
      b.hidden = !at || !cam;
      if (b.hidden) continue;
      const w = b.offsetWidth, h = b.offsetHeight, cx = (RES[0] / 2 + (at[0] - cam.x) * 16) * k;
      const x = Math.max(8, Math.min(W - w - 8, cx - w / 2));
      let y = (RES[1] / 2 + (at[1] - cam.z) * 16 - 2.6 * 16) * k;
      // (over the tags it would cover, a fighter's next move, a key, a ? or a !: lifted clear of each, its tail too)
      for (const r of tagBoxes) if (r.left < x + w && r.right > x && r.top < y + 9 && r.bottom > y - h) y = r.top - 9;
      y = Math.max(h + 8, y);
      b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      b.style.setProperty('--tail', `${Math.round(Math.max(10, Math.min(w - 10, cx - x)))}px`);   // (the tail points at them, wherever the balloon's pushed)
    }
  }

  // ---------- the menu (Esc) ----------
  function openMenu({ debug }) {
    const toggle = el('label', { className: 'toggle' },
      el('input', { type: 'checkbox', checked: debug, onchange: (e) => { cb.setDebug(e.target.checked); openMenu({ debug: e.target.checked }); } }),
      el('span', {}, 'Debug mode', el('small', { className: 'note', style: 'display:block', textContent: `Manual save and load. ${input.label('BracketRight')} moves the clock on an hour, ${input.label('BracketLeft')} a quarter of an hour.` })));
    menu.replaceChildren(el('div', { className: 'sheet' },
      el('h2', { textContent: 'MENU' }), el('hr'),
      el('button', { className: 'item', onclick: () => cb.resume() }, 'Resume'),
      el('button', { className: 'item', onclick: () => cb.exportSave() }, 'Save to a file', el('small', { textContent: 'The game as it is now, as a .json file: to keep, or to send with a bug.' })),
      el('button', { className: 'item', onclick: () => cb.importSave() }, 'Load a save file…'),
      debug ? el('button', { className: 'item', onclick: () => cb.saveManual() }, 'Save (debug)') : null,
      debug ? el('button', { className: 'item', onclick: () => cb.loadManual() }, 'Load the debug save') : null,
      el('button', { className: 'item', onclick: () => cb.quit() }, 'Quit to the title', el('small', { textContent: 'The game is saved first.' })),
      el('hr'), toggle,
    ));
    menu.hidden = false;
    log.hidden = true;
    menu.querySelector('.item')?.focus();
  }

  // ---------- the log (J) ----------
  // The log shows what the character knows: what they didn't see (e.hidden) only in debug mode, once
  // the scene's over.
  function openLog(state, { debug = false } = {}) {
    const over = !!state.scenario.outcome && debug;
    const items = state.log.filter(e => over || !e.hidden).reverse().map(e => el('li', { className: `${e.roll && !e.roll.ok ? 'fail' : ''}${e.hidden ? ' unseen' : ''}` },
      el('time', { textContent: stampText(e.ms) }), e.hidden ? el('em', { textContent: 'Unseen: ' }) : null, ...keyed(e.text ?? ''), e.roll ? el('span', { className: 'num', textContent: checkText(e.roll) }) : null));
    log.replaceChildren(el('div', { className: 'sheet logsheet' },
      el('h2', { textContent: 'LOG' }), el('p', { className: 'note', textContent: `${dateText(state.time.ms)}. ${input.label('log')} or ${input.label('menu')} to close.` }), el('hr'),
      el('ol', {}, items)));
    log.hidden = false;
    menu.hidden = true;
  }
  // ---------- the character sheet (C) ----------
  const LEVEL = Object.fromEntries(Object.entries(TRAINED).map(([k, v]) => [v, k]));
  const LANGS = { en: 'English', ru: 'Russian', es: 'Spanish', fr: 'French', de: 'German', ar: 'Arabic', zh: 'Chinese', pl: 'Polish', pt: 'Portuguese', hi: 'Hindi', hy: 'Armenian' };
  function openSheet(state) {
    const p = state.people[state.player], cls = CLASSES[p.cls], os = p.os ?? 0;
    const rows = Object.entries(SKILLS).map(([k, sk]) => {
      const [base = 0, practice = 0] = p.skills?.[k] ?? [], w = cls?.weights[k] ?? 0, bg = Math.min(practice, p.bg?.points?.[k] ?? 0);
      return el('tr', { className: base ? '' : 'none' },
        el('td', { textContent: sk.name, title: sk.about }),
        el('td', { className: 'lvl', textContent: `${LEVEL[base] ?? `base ${base}`}${practice ? ` ${'◆'.repeat(bg)}${'•'.repeat(practice - bg)}` : ''}`, title: bg ? `${bg} from your background` : '' }),
        el('td', { className: 'mult', textContent: w && os ? `× ${(1 + w * os / 100).toFixed(2)}` : '' }),
        el('td', { className: 'val', textContent: String(skill(p, k)) }));
    });
    const part = (k) => el('div', { className: `part ${k} ${stateOf(p, k)}`, title: `${PARTS[k].name}: ${stateText(p, k)}` });
    const fit = skill(p, 'fitness');
    card.replaceChildren(el('div', { className: 'sheet charsheet' },
      el('span', { className: 'stamp', textContent: 'PERSONNEL' }),
      el('h2', { textContent: p.name.toUpperCase() }),
      el('p', { className: 'note', textContent: [state.legend?.name, cls?.name].filter(Boolean).join(' · ') }), el('hr'),
      cls?.overskill ? el('div', { className: 'os' }, el('span', { textContent: cls.overskill }), el('span', { className: 'bar' }, el('i', { style: `width: ${os}%` })), el('b', { textContent: `${os} / 100` })) : null,
      cls?.overskill ? el('p', { className: 'note', textContent: `The over-skill: it multiplies the skills that matter to a ${cls.name.toLowerCase()} (the × column).` }) : null,
      el('div', { className: 'cols' },
        el('div', {},
          el('table', { className: 'skills' }, el('tbody', {}, rows)),
          el('p', { className: 'note', textContent: `The level is the training you had (a course, advanced…); each • is practice since, ${p.bg ? 'each ◆ what your background brought, ' : ''}a point each.` }),
          (() => { const nw = needsWords(p, state.time.ms); return el('p', { className: 'langs', textContent: `${nw.fed[0].toUpperCase()}${nw.fed.slice(1)} · ${nw.stress}${nw.hungry || nw.edgy ? ' (it costs: see a roll\'s modifiers)' : ''} · ${price(state, cashOf(p))} on you` }); })(),
          el('p', { className: 'langs', textContent: Object.entries(p.langs ?? {}).map(([c, l]) => `${LANGS[c] ?? c}: ${l}`).join(' · ') }),
          el('p', { className: 'langs', textContent: `Carrying: ${[p.hand && `${weaponOf(p.hand).name}, in hand`, ...(p.items ?? []).map(k => weaponOf(k)?.name ?? k)].filter(Boolean).join('; ') || 'nothing to fight with'}. (${input.label('inventory')})` })),
        el('div', { className: 'body' },
          el('div', { className: 'figure' }, part('head'), part('armR'), part('torso'), part('armL'), part('legR'), part('legL')),
          el('ul', {}, Object.keys(PARTS).map(k => el('li', { className: `${stateOf(p, k)}${injuriesOn(p, k) ? ' injured' : ''}` }, el('span', { textContent: PARTS[k].name }), el('span', { textContent: stateText(p, k) }),
            injuriesOn(p, k) ? el('small', { textContent: injuriesOn(p, k) }) : null))),
          p.strain ? el('p', { className: 'blood pale', textContent: `Tired: ${p.strain} to every skill, until you sleep.` }) : null,
          el('p', { className: `blood ${bandOf(p)}`, textContent: `Blood ${Math.round(bloodOf(p))}%: ${BAND_WORDS[bandOf(p)]}${bleedRate(p, state.time.ms) ? `; bleeding ${bleedRate(p, state.time.ms) >= 8 ? 'fast' : bleedRate(p, state.time.ms) >= 0.8 ? 'steadily' : 'a little'} (${input.label('aid')}: first aid)` : ''}.` }),
          el('p', { className: 'note', textContent: `Fitness ${fit}: the body takes ${fit ? `${Math.round(100 * fit / FITNESS_K)}% more` : 'only what it takes'} before it gives.` }))),
      el('p', { className: 'note', textContent: `${input.label('sheet')} or ${input.label('menu')} to close.` }),
    ));
    card.hidden = false;
    card.dataset.kind = '';
    menu.hidden = log.hidden = true;
  }

  /** H (or F, First aid): what can be done for someone's wounds (sim/aid.js options()), each a button that closes this and does it. */
  function openAid(state, actorId, act) {
    const a = state.actors.find(x => x.id === actorId), p = a && state.people[a.who], medic = state.people[state.player];
    if (!p) return;
    const self = a.who === state.player, go = (key) => () => { closeOverlays(); act(key); };
    const list = aidOptions(state, medic, p), rate = bleedRate(p, state.time.ms), b = Math.round(bloodOf(p));
    const name = self ? 'YOUR WOUNDS' : (p.known === false ? p.seen : p.name).toUpperCase();
    card.replaceChildren(el('div', { className: 'sheet charsheet aid' },
      el('span', { className: 'stamp', textContent: 'FIRST AID' }),
      el('h2', { textContent: name }),
      el('p', { className: 'note', textContent: `Blood ${b}% (${BAND_WORDS[bandOf(p)]})${rate ? `; bleeding ${rate >= 8 ? 'fast, pumping' : rate >= 0.8 ? 'steadily' : 'a trickle'}` : ''}. Medicine ${skill(medic, 'medicine')}: it decides how well it's done${self ? '; on yourself, harder' : ''}.` }), el('hr'),
      list.length ? el('table', { className: 'skills' }, el('tbody', {}, numbered(list, o => o.ok).map(([o, n]) => el('tr', { className: o.ok ? '' : 'none' },
        el('td', {}, n ? el('kbd', { textContent: String(n) }) : null), el('td', { textContent: o.label }), el('td', { className: 'where', textContent: o.why ?? '' }),
        el('td', {}, o.ok ? el('button', { className: 'small', dataset: { n }, onclick: go(o.key) }, 'do it') : null)))))
        : el('p', { textContent: 'Nothing first aid can do: nothing bleeding, nothing broken.' }),
      el('p', { className: 'note', textContent: `1–9 or a click does it. It takes time, stooped over it; moving stops it. ${input.label('aid')} or ${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'aid';
    menu.hidden = log.hidden = true;
    card.querySelector('button[data-n]')?.focus();
  }
  /** [item, its number (1…, for the ones that can be chosen), or 0]. */
  const numbered = (list, ok = () => true) => { let k = 0; return list.map(o => [o, ok(o) ? ++k : 0]); };

  /** A few choices on a card ([{ key, label }]), each a button that closes it and does it (a taxi's where to). */
  function openChoices(stamp, title, list, act) {
    card.replaceChildren(el('div', { className: 'sheet charsheet choices' },
      el('span', { className: 'stamp', textContent: stamp }), el('h2', { textContent: title }), el('hr'),
      ...list.map((o, i) => el('button', { className: 'item', dataset: { n: i + 1 }, onclick: () => { closeOverlays(); act(o.key); } }, el('kbd', { textContent: String(i + 1) }), ` ${o.label}`)),
      el('p', { className: 'note', textContent: `1–9 or a click. ${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'choices';
    menu.hidden = log.hidden = true;
    card.querySelector('.item')?.focus();
  }

  /** I: what you carry, and what's in your hand; each a button (take out, put away, drop) that closes it and does it. */
  function openInventory(state, act) {
    const p = state.people[state.player], go = (cmd) => () => { closeOverlays(); act(cmd); };
    let n = 0;
    const where = placed(p).out, room = placed(p).spaces;
    const row = (kind, inHand, k = -1) => {
      const w = weaponOf(kind), first = inHand ? (fits(p, kind) ? ['stow', 'put away'] : ['drop:' + kind, 'put down']) : [`wield:${kind}`, 'take out'];
      const at = inHand ? 'in hand' : where[k]?.label ? `${where[k].label}${where[k].shows ? (where[k].at === 'belt' ? ' (it shows)' : ' (it bulges)') : ''}` : 'nowhere it fits';
      n++;
      return el('tr', {}, el('td', {}, el('kbd', { textContent: String(n) })), el('td', { textContent: w?.name ?? kind }), el('td', { className: 'where', textContent: at }),
        el('td', {}, el('button', { className: 'small', dataset: { n }, onclick: go(first[0]) }, first[1]),
          first[0].startsWith('drop:') ? null : el('button', { className: 'small', onclick: go(`drop:${kind}`) }, 'drop')));
    };
    const list = [...(p.hand ? [row(p.hand, true)] : []), ...(p.items ?? []).map((kind, k) => row(kind, false, k))];
    // (the room left, space by space: pockets in litres, the beltline in things)
    const left = ['trousers', 'inside', 'coat', 'belt'].map(id => { const sp = room.filter(s => s.id === id); if (!sp.length) return null;
      const free = sp.reduce((a, s) => a + (s.l - s.used), 0), cap = sp.reduce((a, s) => a + s.l, 0);
      return `${{ trousers: 'trouser pockets', inside: 'inside pocket', coat: 'coat pockets', belt: 'beltline' }[id]} ${id === 'belt' ? `${sp.filter(s => !s.used).length} of ${sp.length} free` : `${free.toFixed(2)} of ${cap.toFixed(1)} L free`}`; }).filter(Boolean);
    card.replaceChildren(el('div', { className: 'sheet charsheet inventory' },
      el('span', { className: 'stamp', textContent: 'CARRIED' }),
      el('h2', { textContent: 'WHAT YOU CARRY' }),
      el('p', { className: 'note', textContent: 'Little, and only where it fits, by its length and its bulk: a pocket, or tucked in the beltline (under a coat, a jacket or a jumper, or it shows). Anything else is held, or put down.' }),
      el('p', { className: 'note', textContent: `Room: ${left.join('; ') || 'none'}.` }), el('hr'),
      list.length ? el('table', { className: 'skills' }, el('tbody', {}, list)) : el('p', { textContent: 'Nothing to fight with. Things lie about: T picks one up.' }),
      el('p', { className: 'note', textContent: `1–9: the first button on its row. ${input.label('gun')} takes out the next thing, or puts it away; in a fight, drawing costs you the exchange (you can only cover while you do). ${input.label('inventory')} or ${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'inventory';
    menu.hidden = log.hidden = true;
    card.querySelector('button[data-n]')?.focus();
  }

  // ---------- F: what to do with whoever's within reach (sim/interact.js) ----------
  let askFor = null, askKeys = null;
  /** The menu over them; choose(id, them) does it (an opening of VIOLENCE, or TALK, or READ). Returns whether it opened. */
  function openInteract(state, choose) {
    const them = atHand(state);
    if (!them) return false;
    askFor = them;
    const p = them.who ? state.people[them.who] : null, q = !p && them.seed !== null ? passerby(them.seed, state.map.city) : null;
    const whoText = p ? (p.known === false ? p.seen : p.name) : q ? describe(q.look, q.sex) : 'someone';
    const show = (list, sub) => {
      ask.replaceChildren(el('div', { className: 'who', textContent: whoText.charAt(0).toUpperCase() + whoText.slice(1) }),
        ...list.map((o, i) => el('button', { className: `opt${o.ok ? '' : ' off'}`, disabled: !o.ok, onclick: () => pick(o) },
          el('kbd', { textContent: String(i + 1) }), el('span', { textContent: `${o.label}${o.sub ? ' ▸' : ''}` }), o.why ? el('small', { textContent: o.why }) : null)),
        el('div', { className: 'foot', textContent: sub ? `Backspace: back · ${input.label('interact')} or ${input.label('menu')}: close` : `${input.label('interact')} or ${input.label('menu')}: close` }));
      askKeys = (e) => {
        const n = digit(e);
        if (n >= 1 && n <= list.length) { e.preventDefault(); pick(list[n - 1]); }
        else if (e.key === 'Backspace' && sub) { e.preventDefault(); show(interactOptions(state, them), false); }
      };
    };
    const pick = (o) => {
      if (!o.ok) return;
      if (o.sub) return show(o.sub, true);
      closeAsk();
      choose(o.id, them);
    };
    show(interactOptions(state, them), false);
    ask.hidden = false;
    reach.hidden = true;
    return true;
  }
  const closeAsk = () => { ask.hidden = true; askFor = null; askKeys = null; };
  // (a number by the key's place, not its character: on AZERTY the top row types & é " ' without Shift)
  const digit = (e) => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); return m ? Number(m[1]) : 0; };
  addEventListener('keydown', (e) => {
    if (!ask.hidden && askKeys) askKeys(e);
    else if (!talkbox.hidden) { const n = digit(e); if (n >= 1 && n <= TALK_CHOICES.length) { e.preventDefault(); cb.talk?.(TALK_CHOICES[n - 1].id); } }
    else if (!card.hidden && ['aid', 'inventory', 'choices'].includes(card.dataset.kind)) { const n = digit(e); const b = n && card.querySelector(`button[data-n="${n}"]`); if (b) { e.preventDefault(); b.click(); } }
  });

  /** Their sheet as you guess it: what you know of them (sim/know.js). */
  function openRead(state, who) {
    const p = state.people[who], k = knownOf(state, who), title = p.known === false ? p.seen : p.name;
    // (what you've read first, then what a read could show but hasn't, then one line for what never shows at a glance)
    const all = Object.entries(SKILLS), got = all.filter(([key]) => k?.skills?.[key]), could = all.filter(([key]) => !k?.skills?.[key] && READABLE.includes(key));
    const hidden = all.filter(([key]) => !k?.skills?.[key] && !READABLE.includes(key)).map(([, sk]) => sk.name);
    const rows = [...got, ...could].map(([key, sk]) => {
      const r = k?.skills?.[key];
      return el('tr', { className: r ? '' : 'none' }, el('td', { textContent: sk.name }), el('td', { className: 'val', textContent: r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : '?' }),
        el('td', { className: 'lvl', textContent: r ? '' : 'not read yet' }));
    });
    if (hidden.length) rows.push(el('tr', { className: 'none' }, el('td', { colSpan: 3, className: 'lvl', textContent: `Not to be read at a glance: ${hidden.join(', ')}.` })));
    const bloodied = p.bloody?.face !== undefined;
    const seen = Object.keys(PARTS).filter(part => ['hurt', 'wounded', 'out'].includes(stateOf(p, part)) || (part === 'head' && bloodied));
    card.replaceChildren(el('div', { className: 'sheet charsheet readsheet' },
      el('span', { className: 'stamp', textContent: 'YOUR READ' }),
      el('h2', { textContent: title.toUpperCase() }),
      el('p', { className: 'note', textContent: `${classOf(k) ? `By the look of them: ${classOf(k)}.` : 'What they are, you can\'t yet say.'} Read ${k?.reads ?? 0} time${k?.reads === 1 ? '' : 's'}${k?.fights?.won || k?.fights?.lost ? `; fought ${k.fights.won + k.fights.lost} time${k.fights.won + k.fights.lost === 1 ? '' : 's'} (${k.fights.won} won)` : ''}.` }), el('hr'),
      el('div', { className: 'cols' },
        el('div', {}, el('table', { className: 'skills' }, el('tbody', {}, rows)),
          el('p', { className: 'note', textContent: 'Each range holds the truth; a better read (your Analysis) narrows it, and so does every read after. A fight shows bounds.' })),
        el('div', { className: 'body' },
          el('ul', {}, seen.length ? seen.map(part => el('li', { className: stateOf(p, part) }, el('span', { textContent: PARTS[part].name }),
            el('span', { textContent: part === 'head' && bloodied && stateOf(p, part) === 'unhurt' ? 'bloodied' : stateText(p, part) }))) : [el('li', {}, el('span', { textContent: 'Nothing shows on them' }))]))),
      el('p', { className: 'note', textContent: `${state.fight ? `${input.label('interact')}, ` : ''}${input.label('sheet')} or ${input.label('menu')} to close.` }),
    ));
    card.hidden = false;
    card.dataset.kind = '';
    menu.hidden = log.hidden = true;
  }

  // ---------- a test's papers: the brief, the result ----------
  /** The campaign's three candidates (sim/campaign.js candidates()): pick one. */
  function showCandidates(list, onPick, city = 'moscow', { cities = null, back = null } = {}) {
    const C = cityById(city), lang = C.lang ?? 'ru';
    // (the posting's city: another one, three other officers)
    const tabs = cities && el('div', { className: 'cities' }, el('span', { className: 'note', textContent: 'Posted to: ' }),
      ...[['moscow', 'Moscow'], ['london', 'London'], ['beirut', 'Beirut'], ['cairo', 'Cairo']].map(([c, name]) =>
        el('button', { className: `small${c === city ? ' on' : ''}`, onclick: () => { if (c !== city) cities(c); } }, name)));
    const top = (p) => Object.entries(p.skills).map(([k, [b, x]]) => [k, b + x]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => SKILLS[k]?.name ?? k).join(', ');
    paper.replaceChildren(el('div', { className: 'sheet brief candidates' },
      el('span', { className: 'stamp', textContent: 'PERSONNEL' }),
      el('h2', { textContent: 'WHO GOES' }),
      el('p', { className: 'note', textContent: `Station ${C.name} needs a Handler under official cover. Three files on the desk.` }), tabs, el('hr'),
      ...list.map((p, i) => el('button', { className: 'item cand', onclick: () => { paper.hidden = true; paper.dataset.kind = ''; onPick(i); } },
        `${p.name}, ${p.age}`, el('small', { textContent: `${p.background} ${p.bg ? `From it: ${Object.entries(p.bg.points).map(([k, v]) => `${SKILLS[k]?.name ?? k} +${v}`).join(', ')}. ` : ''}Best at: ${top(p)}. ${LANGS[lang] ?? lang}: ${p.langs[lang] ?? 'none'}. Tradecraft ${p.os}.` })))));
    if (back) paper.firstChild.append(el('hr'), el('button', { className: 'item', onclick: () => { paper.hidden = true; paper.dataset.kind = ''; back(); } }, 'Back to the title'));
    paper.hidden = false;
    paper.dataset.kind = 'brief';
    paper.querySelector('.cand')?.focus();
  }

  /** The telephone: who's on the line, what they say, and the ways to answer ({ key, label, about }). */
  function showCall({ who, lines = [], choices = [] }, onPick) {
    const close = (key) => () => { paper.hidden = true; paper.dataset.kind = ''; onPick?.(key); };
    paper.replaceChildren(el('div', { className: 'sheet brief call' },
      el('span', { className: 'stamp', textContent: 'TELEPHONE' }),
      el('h2', { textContent: `${who}, ON THE LINE` }), el('hr'),
      ...lines.map(t => el('p', { textContent: t })), el('hr'),
      ...choices.map(c => el('button', { className: 'item go', onclick: close(c.key) }, c.label, c.about ? el('small', { textContent: c.about }) : null))));
    paper.hidden = false;
    paper.dataset.kind = 'brief';
    paper.querySelector('.go')?.focus();
  }

  /** A paper on the desk: { stamp, title, lines, note }, and one button to go on. */
  function showPaper({ stamp = 'NOTE', title, lines = [], note = null, go = 'Go on' }, onClose) {
    const close = () => { paper.hidden = true; paper.dataset.kind = ''; onClose?.(); };
    paper.replaceChildren(el('div', { className: 'sheet brief' },
      el('span', { className: 'stamp', textContent: stamp }),
      el('h2', { textContent: title }), el('hr'),
      ...lines.map(t => el('p', { textContent: t })),
      note ? el('p', { className: 'note', textContent: note }) : null, el('hr'),
      el('button', { className: 'item go', onclick: close }, go)));
    paper.hidden = false;
    paper.dataset.kind = 'brief';
    paper.querySelector('.go').focus();
  }

  /** The desk (Tab, in the campaign's hub): today, the posting's gauges, what's ahead, and the day's choices, each a button that closes it and does it. */
  function openDesk(state, act) {
    const c = state.campaign, p = c.posting, now = state.time.ms, k = calendarOf(now), go = (cmd) => () => { closeOverlays(); act(cmd); };
    const items = agendaOf(c, now).slice(0, 6), today = Math.floor(now / DAY_MS);
    const row = (a, when) => {
      const name = a.kind === 'sdr' ? p.assets.find(s => s.id === a.who)?.codename : p.targets.find(t => t.id === a.who)?.name;
      const sameDay = Math.floor(a.start / DAY_MS) === today;
      return el('tr', {}, el('td', { textContent: `${dateText(a.from).slice(0, -5)}, ${clockText(a.from)}` }), el('td', { textContent: `${KINDS_[a.kind].name}: ${name}` }),
        el('td', {}, sameDay ? el('button', { className: 'small', onclick: go(`go:${a.id}`), title: a.brief }, when === 'now' ? 'go now' : `go (at ${clockText(a.start)})`) : el('span', { className: 'where', textContent: 'later' })));
    };
    const workday = k.weekday < 5 && k.hour < 18 && !c.worked[today];
    card.replaceChildren(el('div', { className: 'sheet charsheet desk' },
      el('span', { className: 'stamp', textContent: 'STATION' }),
      el('h2', { textContent: `${dateText(now)}, ${clockText(now)}` }),
      el('p', { className: 'note', textContent: `${state.people.me.name}, ${p.job}. The posting: ${p.subject} (${p.goal}).` }), el('hr'),
      el('p', { textContent: `Heat: ${heatWordOf(p.heat)}. Cover standing: ${p.cover}/100. Intelligence: ${p.intelligence}. In the bank: $${p.money.bank ?? 0}; the operational fund: $${p.money.fundLeft ?? p.money.fund}.` }),
      el('p', { textContent: `The network: ${p.assets.map(s => `${s.codename} (${s.role}, trust ${s.trust}${s.burned ? ', compromised' : ''})`).join('; ')}. Watched: ${p.targets.map(t => `${t.name}${t.wary ? ' (wary)' : ''}`).join('; ')}.` }),
      el('h3', { className: 'section', textContent: 'Ahead' }),
      items.length ? el('table', { className: 'skills' }, el('tbody', {}, items.map(({ a, when }) => row(a, when)))) : el('p', { textContent: 'Nothing planned. Days like this are for the cover job.' }),
      items[0] ? el('p', { className: 'note', textContent: items[0].a.brief }) : null,
      el('h3', { className: 'section', textContent: 'Places' }),
      el('div', { className: 'deskacts' }, ...placesOf(c).filter(pl => pl.row !== (state.map.row ?? 0)).map(pl => el('button', { className: 'small', onclick: go(`travel:${pl.id}`), title: `${streetNameOf(p.mapSeed, pl.row)}` }, `To ${pl.label}`))),
      el('h3', { className: 'section', textContent: 'The day' }),
      el('div', { className: 'deskacts' },
        workday ? el('button', { className: 'small', onclick: go('work') }, 'Go to work (till 18:00)') : null,
        el('button', { className: 'small', onclick: go('sleep') }, k.hour >= 20 || k.hour < 6 ? 'Sleep (till 7:00)' : 'Home, and sleep (till 7:00 tomorrow)'),
        el('button', { className: 'small', onclick: go('low') }, 'Lie low for a day'),
        el('button', { className: 'small', onclick: () => closeOverlays() }, 'Walk')),
      ...(c.log.length ? [el('h3', { className: 'section', textContent: 'Lately' }), ...c.log.slice(-4).reverse().map(e => el('p', { className: 'note', textContent: `${dateText(e.ms).slice(0, -5)}: ${e.text}` }))] : []),
      el('p', { className: 'note', textContent: `${input.label('mindmap')} or ${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'desk';
    menu.hidden = log.hidden = true;
  }

  function showBrief(brief, onBegin, city = here) {
    const begin = () => { paper.hidden = true; paper.dataset.kind = ''; onBegin(); };
    paper.replaceChildren(el('div', { className: 'sheet brief' },
      el('span', { className: 'stamp', textContent: brief.stamp ?? 'SECRET' }),
      el('h2', { textContent: brief.title }), el('hr'),
      ...brief.body.map(t => el('p', { textContent: localize(city, t) })),
      el('p', { className: 'note', textContent: brief.footer }), el('hr'),
      brief.keys ? el('ul', { className: 'keylist' }, brief.keys.map(([k, what]) => el('li', {}, el('kbd', { textContent: input.label(k) }), ` ${what}`))) : null,
      el('button', { className: 'item go', onclick: begin }, 'Begin', el('small', { textContent: `${input.label('instinct')} does what your instinct offers; ${input.label('log')} is the log.` })),
    ));
    paper.hidden = false;
    paper.dataset.kind = 'brief';
    paper.querySelector('.go').focus();
  }
  // What happened that the character never saw: his checks behind their back, revealed after.
  function unseenOf(state) {
    const hid = state.log.filter(e => e.hidden && e.ms >= state.scenario.began);
    if (!hid.length) return [];
    return [el('p', { className: 'note', textContent: 'Debug, what you didn\'t see:' }),
      el('ul', { className: 'unseenlist' }, hid.slice(-6).map(e => el('li', {}, el('time', { textContent: clockText(e.ms) }), ` ${e.text}`)))];
  }
  const OUTCOMES = { seen: 'SEEN', made: 'MADE', lost: 'LOST', missed: 'MISSED', blown: 'BLOWN' };
  // (made, but you didn't see him make you: you know only that something spooked him)
  // (his sightings of you that you saw happen; the rest you can only suspect)
  const seenText = (sc) => { const n = sc.sightings.filter(x => x.seen !== false).length; return `you saw him spot you ${n} time${n === 1 ? '' : 's'}`; };
  const stampOf = (sc) => (sc.outcome === 'made' && sc.madeSeen === false ? 'SPOOKED' : OUTCOMES[sc.outcome] ?? sc.outcome);
  function showResult(state, { again, same, title, back = null, photo = null, lesson = null, home = false }, { debug = false } = {}) {
    const sc = state.scenario, secs = Math.round((sc.ended - sc.began) / 1000);
    const go = (fn) => () => { paper.hidden = true; paper.dataset.kind = ''; fn(); };
    // (the scene's own words for going again: an evening, a lesson, a walk; the score asked for only in a mechanic test)
    const S = SCENARIOS[sc.kind], w = S.again ?? { another: ['Again, another evening', 'A new street, a new evening, new dice.'], same: ['Again, the same evening', 'The same streets and the same people; the dice fall as you play.'] };
    // (in a campaign: back to the posting, the outcome folded in; or, the character gone, the title)
    // (a lesson: Hale's word after it, the checklist as it stood, and the ways on through the tutorial)
    const L = state.tutor && lessonOf(state.tutor.lesson), next = L && nextLesson(L.id);
    const debrief = L ? el('div', { className: 'debrief' }, el('h3', { textContent: 'HALE, AFTER' }),
      ...(L.debrief?.(state) ?? []).map(t => el('p', {}, ...keyed(t))),
      el('div', { className: 'steps' }, ...state.tutor.steps.map(s => el('div', { className: s.done ? 'done' : 'not' }, s.done ? '✓ ' : '✗ ', ...keyed(s.text))))) : null;
    const ways = L && lesson ? [el('hr'),
      el('p', { className: 'note', textContent: 'What was unclear, or too much hand-holding, or too little: in the chat. The tutorial\'s for refining.' }),
      el('button', { className: 'item', onclick: go(lesson.again) }, 'Again, with Hale', el('small', { textContent: 'The same lesson, another evening.' })),
      el('button', { className: 'item', onclick: go(lesson.alone) }, 'On your own', el('small', { textContent: 'The same work, no earpiece: the plain test.' })),
      next ? el('button', { className: 'item', onclick: go(() => lesson.next(next.id)) }, `Next: ${numberOf(next.id)}. ${next.title}`, el('small', { textContent: next.about })) : null,
      el('button', { className: 'item', onclick: go(lesson.tutorial) }, 'The tutorial', el('small', { textContent: 'The lessons, all of them.' })),
      el('button', { className: 'item', onclick: go(title) }, home ? 'Back to the flat' : 'Back to the title')]
      : state.campaign ? [el('hr'),
      back && !state.people[state.player]?.dead ? el('button', { className: 'item', onclick: go(back) }, 'Back to the posting', el('small', { textContent: 'The debrief, and on with it.' })) : null,
      el('button', { className: 'item', onclick: go(title) }, home ? 'Back to the flat' : 'Back to the title')] : [
      el('hr'),
      S.test ? el('p', { className: 'note', textContent: 'How did it play? A score out of 100, and what felt off, in the chat: that\'s what this test is for.' }) : null,
      el('button', { className: 'item', onclick: go(again) }, w.another[0], el('small', { textContent: w.another[1] })),
      el('button', { className: 'item', onclick: go(same) }, w.same[0], el('small', { textContent: w.same[1] })),
      el('button', { className: 'item', onclick: go(title) }, home ? 'Back to the flat' : 'Back to the title'),
    ];
    const own = sc.outcome === 'dead' ? deathPaper(state) : SCENARIOS[sc.kind].result?.(state, { debug });   // (killed: the engine's paper, whatever the scene)
    // (the last lines before it, which the paper covers: quoted, so they're read)
    const ends = [own?.text, sc.endText].filter(Boolean), lastLines = state.log.filter(e => !e.hidden && e.kind !== 'roll' && e.ms >= (sc.ended ?? 0) - 20000 && !ends.includes(e.text)).slice(-2);
    const last = lastLines.length ? el('p', { className: 'note last' }, ...lastLines.flatMap((e, i) => [i ? ' ' : '', ...keyed(e.text)])) : null;
    if (own) {                                                     // a scenario that writes its own paper
      paper.replaceChildren(el('div', { className: 'sheet result' },
        el('span', { className: `stamp ${own.good ? 'good' : ''}`, textContent: own.stamp }),
        el('h2', { textContent: own.title }), el('hr'),
        last,
        photo ? el('img', { className: 'photo', src: photo, alt: 'your photograph' }) : null,   // (the frame you took: src/main.js snap())
        el('p', { textContent: localize(state.map?.city, own.text) }),
        debrief,
        own.lead ? el('p', { className: 'lead', textContent: `Lead. ${own.lead}` }) : null,
        ...own.notes.map(t => el('p', { className: 'truth', textContent: localize(state.map?.city, t) })),
        el('p', { className: 'note', textContent: own.stats }),
        ...ways));
    } else paper.replaceChildren(el('div', { className: 'sheet result' },
      el('span', { className: `stamp ${sc.outcome === 'seen' ? 'good' : ''}`, textContent: stampOf(sc) }),
      el('h2', { textContent: (state.campaign && sc.kind === 'tail' ? `Tailing: ${state.people.orlov?.name ?? ''}` : S.name.replace(/^\d+\.\s*/, '')).toUpperCase() }), el('hr'),
      last,
      el('p', { textContent: localize(state.map?.city, sc.endText) }),
      debrief,
      sc.lead ? el('p', { className: 'lead', textContent: `Lead. ${sc.lead}` }) : null,
      ...(debug ? unseenOf(state) : []),
      el('p', { className: 'note', textContent: `${Math.floor(secs / 60)} min ${secs % 60} s on his tail · ${seenText(sc)} · closest ${sc.closest < 1e8 ? sc.closest.toFixed(1) : '?'} m`
        + `${sc.warned !== undefined ? ` · his checks read in time: ${sc.warned}` : ''}${sc.mixupsKnown ? ` · followed the wrong man ${sc.mixupsKnown} time${sc.mixupsKnown === 1 ? '' : 's'} that you know of` : ''} · ${shownRolls(state)} rolls (in the log, ${input.label('log')})` }),
      ...ways,
    ));
    paper.hidden = false;
    paper.dataset.kind = 'result';
    paper.querySelector('.item').focus();
  }

  const closeOverlays = () => { menu.hidden = log.hidden = card.hidden = true; closeAsk(); };
  const closeAll = () => { menu.hidden = log.hidden = card.hidden = paper.hidden = true; paper.dataset.kind = ''; closeAsk(); };
  const overlay = () => (!menu.hidden ? 'menu' : !log.hidden ? 'log' : !card.hidden ? (card.dataset.kind || 'sheet') : !ask.hidden ? 'interact' : !paper.hidden ? paper.dataset.kind : null);

  /** A white flash over the picture, fading: a blow, and another time. */
  function flash() {
    const f = el('div', { className: 'flash' });
    frame.append(f);
    setTimeout(() => f.remove(), 1600);
  }

  return { frame, fit, flash, openInventory, openAid, openDesk, openChoices, showCandidates, showPaper, showCall, showTitle, showTutorial, toggleKeys, hideTitle, update, toast, clearToasts, openMenu, openLog, openSheet, openInteract, openRead, showBrief, showResult, closeOverlays, closeAll, overlay, hud };
}
