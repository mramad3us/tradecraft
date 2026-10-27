// TRADECRAFT ui: the screens. The title sheet, the frame the picture sits in, the HUD over it (the
// watch and where you are, the log's lines as they come, the keys, a scenario's marker over its target and the
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
// never changes the state itself. Times are game time (sim/clock.js); rolls read through checkText().
import { clockText, stampText, dateText } from '../sim/clock.js';
import { checkText } from '../sim/checks.js';
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
import { options as aidOptions, bodyLine } from '../sim/aid.js';
import { agenda as agendaOf, heatWord as heatWordOf, places as placesOf, KINDS as KINDS_ } from '../sim/campaign.js';
import { streetName as streetNameOf } from '../sim/map/street.js';
import { calendar as calendarOf, DAY as DAY_MS } from '../sim/clock.js';
import { bleedRate, bloodOf, bandOf, BLOOD } from '../sim/health.js';
import { RANK as RANKS } from '../sim/instinct.js';

const BAND_WORDS = { steady: 'steady', pale: 'pale, light-headed', shock: 'in shock', collapsed: 'collapsed', dead: 'gone' };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
import { knownOf, classOf, READABLE } from '../sim/know.js';
import { passerby, describe } from '../sim/people.js';
import { CHOICES as TALK_CHOICES } from '../sim/talk.js';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
  return e;
};
export const RES = [640, 360];                                     // (live: fit() sets it)
export const RES_BASE = [640, 360];
export const RES_MAX = [2 * SCREEN_HALF_M[0] * 16, 430];
const TOAST_S = 16;                                                // (a log line at the top left lingers: the user, 2026-10-26, twice the 8 s it was)

export function createUI({ input, cb }) {
  const frame = el('div', { id: 'frame' });
  const watch = el('div', { className: 'watch' }, el('div', { className: 'time' }), el('div', { className: 'date' }), el('div', { className: 'place' }), el('div', { className: 'hand' }));
  const toasts = el('div', { className: 'toasts' });
  const keys = el('div', { className: 'keys' });
  const banner = el('div', { className: 'banner', textContent: 'PAUSED' });
  const marker = el('div', { className: 'marker', hidden: true });
  const bubble = el('div', { className: 'bubble', hidden: true });   // what a character's just become aware of: ? or !
  const intent = el('div', { className: 'intent', hidden: true });   // in a fight: what they're about to do, if we read it
  const bout = el('div', { className: 'bout', hidden: true });       // in a fight: the two of them, the score, the edges
  const moves = el('div', { className: 'moves', hidden: true });    // in a fight: the three moves and their keys, while we choose
  const ask = el('div', { className: 'ask', hidden: true });           // F's menu, over whoever's within reach
  const reach = el('div', { className: 'reach', hidden: true });       // a key over whoever's within reach
  const talkbox = el('div', { className: 'ask talkbox', hidden: true }); // a conversation, over them (time stands still)
  const states = [0, 1].map(() => el('div', { className: 'fstate', hidden: true }));   // staggered, dazed: over a fighter
  const tags = el('div', { className: 'tags' });                   // faces you've marked: seen before, a tail
  const goal = el('div', { className: 'goal', hidden: true });      // where you're going, when it's off the picture
  const prompt = el('div', { className: 'prompt', hidden: true });
  const veil = el('div', { className: 'bloodveil' });                 // (the blood lost: the world dims and reddens at the edges)
  const hud = el('div', { id: 'hud' }, veil, tags, marker, bubble, intent, ...states, reach, ask, talkbox, bout, moves, goal, prompt, watch, toasts, keys, banner);
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
    RES[0] = w; RES[1] = h;
    Object.assign(frame.style, { width: `${fw}px`, height: `${fh}px`, left: `${Math.floor((ww - fw) / 2)}px`, top: `${Math.floor((wh - fh) / 2)}px` });
    cb.fit?.(w, h, Math.round(fw * dpr), Math.round(fh * dpr));
  }
  fit();
  addEventListener('resize', fit);

  const keyHints = () => {
    const k = (a) => `<kbd>${input.label(a)}</kbd>`;
    keys.innerHTML = `${k('up')}${k('left')}${k('down')}${k('right')} walk · ${k('slow')} stroll · ${k('run')} run · ${k('watch')} look · ${k('interact')} interact · ${k('inventory')} carry · ${k('gun')} draw · ${k('sheet')} sheet · ${k('log')} log · ${k('pause')} pause · ${k('menu')} menu`;
  };
  keyHints();
  setTimeout(keyHints, 300);                                       // once the keyboard's layout is known

  // ---------- the title ----------
  function showTitle({ version, auto, farm = false }) {
    // The Farm: the lesson, or, the lesson had, a memory first (sim/scenarios/dojo.js, chapter 'remembered').
    const entry = (key, s) => key !== 'dojo' ? [el('button', { className: 'item', onclick: () => cb.newGame(key) }, s.name, el('small', { textContent: s.about }))] : [
      el('button', { className: 'item', onclick: () => cb.newGame('dojo', farm ? 'remembered' : 'lesson') }, farm ? 'The Farm, remembered' : s.name,
        el('small', { textContent: farm ? 'The bouts you remember, three of your class and Hale; and what brought them back, years on, in Moscow.' : s.about })),
      el('button', { className: 'item', onclick: () => cb.newGame('dojo', farm ? 'lesson' : 'remembered') }, farm ? 'The Farm: the whole lesson again' : 'The Farm, remembered',
        el('small', { textContent: farm ? s.about : 'Straight to the bouts, and what they bring back, years on. For after the lesson.' }))];
    title.replaceChildren(el('div', { className: 'sheet' },
      el('h1', { textContent: 'TRADECRAFT' }),
      el('p', { className: 'sub', textContent: `v${version} · in development: the skeleton, and the first look at the street` }),
      el('hr'),
      auto ? el('button', { className: 'item', onclick: () => cb.continue() }, 'Continue', el('small', { textContent: auto.about })) : null,
      el('button', { className: 'item campaign', onclick: () => cb.newCampaign?.() }, 'Campaign: a posting in Moscow', el('small', { textContent: 'A Handler at the US embassy: a network to run, men to watch, the heat to keep down. Days and weeks of it, as long as it lasts.' })),
      ...Object.entries(SCENARIOS).filter(([, s]) => !s.test && !s.campaign).flatMap(([key, s]) => entry(key, s)),
      el('h3', { className: 'section', textContent: 'Mechanic tests' }),
      el('p', { className: 'note', textContent: 'One mechanic each, to play and score before they\'re joined into the game.' }),
      ...Object.entries(SCENARIOS).filter(([, s]) => s.test).map(([key, s]) => el('button', { className: 'item', onclick: () => cb.newGame(key) }, s.name, el('small', { textContent: s.about }))),
      el('button', { className: 'item', disabled: true }, '3. Watching and photographing', el('small', { textContent: 'Next: watch someone without being caught at it, and catch a meeting on film.' })),
      el('hr'),
      el('button', { className: 'item', onclick: () => cb.importSave() }, 'Load a save file…', el('small', { textContent: 'A .json save exported from the menu.' })),
      el('hr'),
      el('p', { className: 'note', textContent: 'Keys are read by where they sit on the keyboard, so they work on any layout.' }),
    ));
    title.hidden = false;
    title.querySelector('.item')?.focus();
  }
  const hideTitle = () => { title.hidden = true; };

  // ---------- the HUD ----------
  /** view: { posOf(id) → [x, z] as drawn, camera { x, z } }, for the marker over a scenario's target. */
  function update(state, paused, view) {
    watch.querySelector('.time').textContent = clockText(state.time.ms);
    watch.querySelector('.date').textContent = stampText(state.time.ms).split(',')[0];
    const me = state.actors.find(a => a.who === state.player);
    const held = weaponOf(state.people[state.player]?.hand);       // (what's in your hand, under the watch: sim/items.js)
    watch.querySelector('.hand').textContent = held ? `in hand: ${bare(held)}` : '';
    if (me && state.map?.kind === 'street') watch.querySelector('.place').textContent = placeName(state.map.seed, state.map.row ?? 0, me.x, me.z);
    else watch.querySelector('.place').textContent = SCENARIOS[state.scenario.kind]?.place?.(state) ?? '';
    frame.classList.toggle('paused', paused && menu.hidden && log.hidden && paper.hidden);
    // The marker: over whom we take for the target (sc.marked), as we last saw them (live, or their
    // memory in the dimmed street), at the frame's edge when they're off it; hollow when out of view.
    // Only until sc.markUntil, when a scenario says so (the tail: from there on, our eyes).
    const sc = state.scenario, mk = sc.marked && !sc.outcome && !(sc.markUntil && state.time.ms >= sc.markUntil) ? sc.marked : null;
    const ls = sc.lastSeen && (sc.lastSeen.row ?? state.map.row) === state.map.row ? sc.lastSeen : null;   // (of this street)
    const t = mk && (view?.posOf(mk) ?? (ls && [ls.x, ls.z]));
    marker.hidden = !t;
    if (t) {
      marker.classList.toggle('memory', state.mind?.seen?.[mk]?.[5] !== state.mind?.at);
      const k = frame.clientWidth / RES[0], cam = view.camera;
      const sx = RES[0] / 2 + (t[0] - cam.x) * 16, sy = RES[1] / 2 + (t[1] - cam.z) * 16 - 2.45 * 16;
      const cx = Math.max(6, Math.min(RES[0] - 6, sx)), cy = Math.max(8, Math.min(RES[1] - 8, sy));
      const off = cx !== sx || cy !== sy;
      marker.classList.toggle('off', off);
      marker.style.transform = `translate(${Math.round(cx * k)}px, ${Math.round(cy * k)}px) rotate(${off ? Math.atan2(sy - cy, sx - cx) * 180 / Math.PI - 90 : 0}deg)`;
      marker.style.setProperty('--k', k);
    }
    // Faces you've marked (a scenario's suspects: { actor id: 1 seen before, 2 a tail }), over them as drawn.
    const k0 = frame.clientWidth / RES[0], cam0 = view?.camera;
    const sus = !sc.outcome && sc.suspects ? Object.entries(sc.suspects).filter(([, v]) => v >= 1) : [];
    while (tags.children.length < sus.length) tags.append(el('div', { className: 'tag' }));
    [...tags.children].forEach((t, i) => {
      const at = sus[i] && view?.posOf(sus[i][0]);
      t.hidden = !at;
      if (!at) return;
      t.textContent = sus[i][1] >= 2 ? 'tail' : 'seen before';
      t.classList.toggle('sure', sus[i][1] >= 2);
      t.style.transform = `translate(${Math.round((RES[0] / 2 + (at[0] - cam0.x) * 16) * k0)}px, ${Math.round((RES[1] / 2 + (at[1] - cam0.z) * 16 - 2.6 * 16) * k0)}px)`;
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
      // (clear of the watch at the top right and the instinct's line at the foot)
      const cy = Math.max(26, Math.min(RES[1] - 80, gy)), cx = Math.max(14, Math.min(cy < 70 ? RES[0] - 150 : RES[0] - 14, gx));
      goal.textContent = `${gl.label} ${gy < 26 ? '↑' : gy > RES[1] - 80 ? '↓' : gx < 14 ? '←' : '→'}`;
      goal.style.transform = `translate(${Math.round(cx * k0)}px, ${Math.round(cy * k0)}px)`;
      goal.classList.toggle('left', cx < RES[0] / 2);
    }
    // A mark over a character who's just noticed something, while it lasts and they're in view.
    const mk2 = sc.mark && sc.mark.until > state.time.ms && !sc.outcome && view?.posOf(sc.mark.id);
    bubble.hidden = !mk2;
    if (mk2) {
      const k = frame.clientWidth / RES[0], cam = view.camera;
      const bx = RES[0] / 2 + (mk2[0] - cam.x) * 16, by = RES[1] / 2 + (mk2[1] - cam.z) * 16 - 3.0 * 16;
      bubble.textContent = sc.mark.glyph;
      bubble.className = `bubble ${sc.mark.glyph === '!' ? 'alarm' : ''}`;
      bubble.style.transform = `translate(${Math.round(bx * k)}px, ${Math.round(by * k)}px)`;
    }
    // Whoever's within reach of F, marked with its key; F's menu over them while it's open.
    const near = !sc.outcome && !state.fight && ask.hidden && atHand(state), nearAt = near && view?.posOf(near.id);
    reach.hidden = !nearAt;
    if (nearAt && view?.camera) {
      const k = frame.clientWidth / RES[0], cam = view.camera;
      if (reach.dataset.key !== input.label('interact')) { reach.dataset.key = input.label('interact'); reach.replaceChildren(el('kbd', { textContent: input.label('interact') })); }
      reach.style.transform = `translate(${Math.round((RES[0] / 2 + (nearAt[0] - cam.x) * 16) * k)}px, ${Math.round((RES[1] / 2 + (nearAt[1] - cam.z) * 16 - 2.2 * 16) * k)}px)`;   // (the point just over the head)
    }
    if (!ask.hidden && askFor) {
      const at = view?.posOf(askFor.id), k = frame.clientWidth / RES[0], cam = view?.camera;
      // (beside them, kept inside the picture)
      if (at && cam) {
        const W = frame.clientWidth, H = frame.clientHeight, w = ask.offsetWidth, h = ask.offsetHeight;
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
        const k = frame.clientWidth / RES[0], cam = view.camera, W = frame.clientWidth, H = frame.clientHeight, w = talkbox.offsetWidth, h = talkbox.offsetHeight;
        const x = Math.max(8, Math.min(W - w - 8, (RES[0] / 2 + (tAt[0] - cam.x) * 16 + 14) * k)), y = Math.max(h / 2 + 8, Math.min(H - h / 2 - 8, (RES[1] / 2 + (tAt[1] - cam.z) * 16 - 2.6 * 16) * k));
        talkbox.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
    }
    // A fight (sim/cqc.js): over the other one, what we read they're about to do (an icon and a word,
    // brass; a '?' when we can't), while we choose; over either, staggered or dazed; at the top, the
    // two of them, a bout's score and the edges each holds; at the foot, the three moves and their keys.
    const fi = !sc.outcome && state.fight, sides = fi ? [state.actors.find(a => a.who === fi.a), state.actors.find(a => a.who === fi.b)] : [];
    const kk = frame.clientWidth / RES[0], camF = view?.camera, over = (a, up) => { const p = a && view?.posOf(a.id); return p && camF && `translate(${Math.round((RES[0] / 2 + (p[0] - camF.x) * 16) * kk)}px, ${Math.round((RES[1] / 2 + (p[1] - camF.z) * 16 - up * 16) * kk)}px)`; };
    const choosing = fi && fi.phase === 'choose' && fi.status?.a !== 'stunned';
    const at = choosing && over(sides[1], 2.45);
    intent.hidden = !at;
    if (at) {
      const m = fi.theirs.move, read = fi.read && m !== 'open', key = read ? m : '?';
      if (intent.dataset.key !== key) {
        intent.dataset.key = key;
        intent.replaceChildren(...[read && el('img', { src: icon(m), alt: '' }), el('span', { textContent: read ? MOVE_WORD[m] : '?' })].filter(Boolean));
        intent.className = `intent ${read ? 'read' : ''}`;
      }
      intent.style.transform = at;
    }
    states.forEach((t, i) => {
      const st = fi?.status?.[i ? 'b' : 'a'], at2 = st && over(sides[i], fi.phase === 'choose' && i === 1 ? 3.3 : 2.45);
      t.hidden = !at2;
      if (!at2) return;
      t.textContent = { stunned: 'STUNNED', dazed: 'DAZED', staggered: 'STAGGERED' }[st];
      t.className = `fstate ${st}`;
      t.style.transform = at2;
    });
    const lost = Math.max(0, Math.min(1, (100 - bloodOf(state.people[state.player])) / (100 - BLOOD.dead)));
    veil.style.opacity = String(Math.round(lost * 100) / 100);
    bout.hidden = !fi;
    if (fi) {
      const name = (who) => (who === state.player ? 'You' : cap(shortName(state, who)));
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
    const body = bodyLine(state), scene = sc.prompt && body && RANKS[body.tone] <= RANKS[sc.prompt.tone] ? sc.prompt : body ?? sc.prompt;
    const sp = !sc.outcome && ((state.fight?.phase === 'choose' && statusLine(state)) || scene), off = !sc.outcome && !sp?.act && sp?.tone !== 'urgent' && state.$offer;
    const p = sp || off ? { tone: sp?.tone ?? 'calm', text: `${sp?.text ?? ''}${off ? off.text : ''}`.trim() } : null;
    prompt.hidden = !p;
    if (p && prompt.dataset.text !== p.text + p.tone) {
      prompt.dataset.text = p.text + p.tone;
      prompt.className = `prompt ${p.tone}`;
      prompt.replaceChildren(...keyed(p.text));
    }
    // (the move panel sits above the instinct, however many lines it runs to)
    if (!moves.hidden) moves.style.bottom = `${p ? 58 + prompt.offsetHeight + 8 : 96}px`;
    const now = performance.now();
    for (const t of [...toasts.children]) {
      if (now - t.born > TOAST_S * 1000 && !t.classList.contains('gone')) t.classList.add('gone');
      if (now - t.born > (TOAST_S + 1.5) * 1000) t.remove();
    }
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

  const keyed = (text) => text.split(/(\{[a-z]+\})/).filter(Boolean).map(part => {
    const m = part.match(/^\{([a-z]+)\}$/);
    return m ? el('kbd', { textContent: input.label(m[1]) }) : el('span', { textContent: part });
  });

  function toast(e) {
    if (e.hidden) return;                                          // (what the character didn't see)
    const t = el('div', { className: `toast ${e.kind}${e.roll && !e.roll.ok ? ' fail' : ''}` }, ...keyed(e.text ?? ''), e.roll ? el('span', { className: 'num', textContent: checkText(e.roll) }) : null);
    t.born = performance.now();
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }
  const clearToasts = () => toasts.replaceChildren();

  // ---------- the menu (Esc) ----------
  function openMenu({ debug }) {
    const toggle = el('label', { className: 'toggle' },
      el('input', { type: 'checkbox', checked: debug, onchange: (e) => { cb.setDebug(e.target.checked); openMenu({ debug: e.target.checked }); } }),
      el('span', {}, 'Debug mode', el('small', { className: 'note', style: 'display:block', textContent: 'Manual save and load. ] moves the clock on an hour, [ a quarter of an hour.' })));
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
  const LANGS = { en: 'English', ru: 'Russian', es: 'Spanish', fr: 'French', de: 'German', ar: 'Arabic', zh: 'Chinese' };
  function openSheet(state) {
    const p = state.people[state.player], cls = CLASSES[p.cls], os = p.os ?? 0;
    const rows = Object.entries(SKILLS).map(([k, sk]) => {
      const [base = 0, practice = 0] = p.skills?.[k] ?? [], w = cls?.weights[k] ?? 0;
      return el('tr', { className: base ? '' : 'none' },
        el('td', { textContent: sk.name, title: sk.about }),
        el('td', { className: 'lvl', textContent: `${LEVEL[base] ?? `base ${base}`}${practice ? ` ${'•'.repeat(practice)}` : ''}` }),
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
      list.length ? el('table', { className: 'skills' }, el('tbody', {}, list.map(o => el('tr', { className: o.ok ? '' : 'none' },
        el('td', { textContent: o.label }), el('td', { className: 'where', textContent: o.why ?? '' }),
        el('td', {}, o.ok ? el('button', { className: 'small', onclick: go(o.key) }, 'do it') : null)))))
        : el('p', { textContent: 'Nothing first aid can do: nothing bleeding, nothing broken.' }),
      el('p', { className: 'note', textContent: `It takes time, stooped over it; moving stops it. ${input.label('aid')} or ${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'aid';
    menu.hidden = log.hidden = true;
  }

  /** A few choices on a card ([{ key, label }]), each a button that closes it and does it (a taxi's where to). */
  function openChoices(stamp, title, list, act) {
    card.replaceChildren(el('div', { className: 'sheet charsheet choices' },
      el('span', { className: 'stamp', textContent: stamp }), el('h2', { textContent: title }), el('hr'),
      ...list.map(o => el('button', { className: 'item', onclick: () => { closeOverlays(); act(o.key); } }, o.label)),
      el('p', { className: 'note', textContent: `${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'choices';
    menu.hidden = log.hidden = true;
    card.querySelector('.item')?.focus();
  }

  /** I: what you carry, and what's in your hand; each a button (take out, put away, drop) that closes it and does it. */
  function openInventory(state, act) {
    const p = state.people[state.player], go = (cmd) => () => { closeOverlays(); act(cmd); };
    const row = (kind, inHand) => {
      const w = weaponOf(kind);
      return el('tr', {}, el('td', { textContent: w?.name ?? kind }), el('td', { className: 'where', textContent: inHand ? 'in hand' : w?.carry ?? '' }),
        el('td', {}, inHand ? (w?.carry !== 'hand' ? el('button', { className: 'small', onclick: go('stow') }, 'put away') : null) : el('button', { className: 'small', onclick: go(`wield:${kind}`) }, 'take out'),
          el('button', { className: 'small', onclick: go(`drop:${kind}`) }, 'drop')));
    };
    const list = [...(p.hand ? [row(p.hand, true)] : []), ...(p.items ?? []).map(k => row(k, false))];
    card.replaceChildren(el('div', { className: 'sheet charsheet inventory' },
      el('span', { className: 'stamp', textContent: 'CARRIED' }),
      el('h2', { textContent: 'WHAT YOU CARRY' }),
      el('p', { className: 'note', textContent: 'Little, and only where it fits: a pocket, or tucked in the beltline under your coat. Anything else is held, or put down.' }), el('hr'),
      list.length ? el('table', { className: 'skills' }, el('tbody', {}, list)) : el('p', { textContent: 'Nothing to fight with. Things lie about: T picks one up.' }),
      el('p', { className: 'note', textContent: `${input.label('gun')} takes out the next one, or puts it away (in a fight, that exchange you only cover). ${input.label('inventory')} or ${input.label('menu')} to close.` })));
    card.hidden = false;
    card.dataset.kind = 'inventory';
    menu.hidden = log.hidden = true;
  }

  // ---------- F: what to do with whoever's within reach (sim/interact.js) ----------
  let askFor = null, askKeys = null;
  /** The menu over them; choose(id, them) does it (an opening of VIOLENCE, or TALK, or READ). Returns whether it opened. */
  function openInteract(state, choose) {
    const them = atHand(state);
    if (!them) return false;
    askFor = them;
    const p = them.who ? state.people[them.who] : null, q = !p && them.seed !== null ? passerby(them.seed) : null;
    const whoText = p ? (p.known === false ? p.seen : p.name) : q ? describe(q.look, q.sex) : 'someone';
    const show = (list, sub) => {
      ask.replaceChildren(el('div', { className: 'who', textContent: whoText.charAt(0).toUpperCase() + whoText.slice(1) }),
        ...list.map((o, i) => el('button', { className: `opt${o.ok ? '' : ' off'}`, disabled: !o.ok, onclick: () => pick(o) },
          el('kbd', { textContent: String(i + 1) }), el('span', { textContent: `${o.label}${o.sub ? ' ▸' : ''}` }), o.why ? el('small', { textContent: o.why }) : null)),
        el('div', { className: 'foot', textContent: sub ? `Backspace: back · ${input.label('interact')} or ${input.label('menu')}: close` : `${input.label('interact')} or ${input.label('menu')}: close` }));
      askKeys = (e) => {
        const n = Number(e.key);
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
  addEventListener('keydown', (e) => {
    if (!ask.hidden && askKeys) askKeys(e);
    else if (!talkbox.hidden) { const n = Number(e.key); if (n >= 1 && n <= TALK_CHOICES.length) { e.preventDefault(); cb.talk?.(TALK_CHOICES[n - 1].id); } }
  });

  /** Their sheet as you guess it: what you know of them (sim/know.js). */
  function openRead(state, who) {
    const p = state.people[who], k = knownOf(state, who), title = p.known === false ? p.seen : p.name;
    const rows = Object.entries(SKILLS).map(([key, sk]) => {
      const r = k?.skills?.[key];
      return el('tr', { className: r ? '' : 'none' }, el('td', { textContent: sk.name }), el('td', { className: 'val', textContent: r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : '?' }),
        el('td', { className: 'lvl', textContent: r ? '' : READABLE.includes(key) ? 'not read yet' : 'doesn\'t show at a glance' }));
    });
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
  function showCandidates(list, onPick) {
    const top = (p) => Object.entries(p.skills).map(([k, [b, x]]) => [k, b + x]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => SKILLS[k]?.name ?? k).join(', ');
    paper.replaceChildren(el('div', { className: 'sheet brief candidates' },
      el('span', { className: 'stamp', textContent: 'PERSONNEL' }),
      el('h2', { textContent: 'WHO GOES' }),
      el('p', { className: 'note', textContent: 'Station Moscow needs a Handler under official cover. Three files on the desk.' }), el('hr'),
      ...list.map((p, i) => el('button', { className: 'item cand', onclick: () => { paper.hidden = true; paper.dataset.kind = ''; onPick(i); } },
        `${p.name}, ${p.age}`, el('small', { textContent: `${p.background} Best at: ${top(p)}. Russian: ${p.langs.ru ?? 'none'}. Tradecraft ${p.os}.` })))));
    paper.hidden = false;
    paper.dataset.kind = 'brief';
    paper.querySelector('.cand')?.focus();
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

  function showBrief(brief, onBegin) {
    const begin = () => { paper.hidden = true; paper.dataset.kind = ''; onBegin(); };
    paper.replaceChildren(el('div', { className: 'sheet brief' },
      el('span', { className: 'stamp', textContent: 'SECRET' }),
      el('h2', { textContent: brief.title }), el('hr'),
      ...brief.body.map(t => el('p', { textContent: t })),
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
  function showResult(state, { again, same, title, back = null }, { debug = false } = {}) {
    const sc = state.scenario, secs = Math.round((sc.ended - sc.began) / 1000);
    const go = (fn) => () => { paper.hidden = true; paper.dataset.kind = ''; fn(); };
    // (in a campaign: back to the posting, the outcome folded in; or, the character gone, the title)
    const ways = state.campaign ? [el('hr'),
      back && !state.people[state.player]?.dead ? el('button', { className: 'item', onclick: go(back) }, 'Back to the posting', el('small', { textContent: 'The debrief, and on with it.' })) : null,
      el('button', { className: 'item', onclick: go(title) }, 'Back to the title')] : [
      el('hr'),
      el('p', { className: 'note', textContent: 'How did it play? A score out of 100, and what felt off, in the chat: that\'s what this test is for.' }),
      el('button', { className: 'item', onclick: go(again) }, 'Again, another evening', el('small', { textContent: 'A new street, a new evening, new dice.' })),
      el('button', { className: 'item', onclick: go(same) }, 'Again, the same evening', el('small', { textContent: 'The same streets and the same people; the dice fall as you play.' })),
      el('button', { className: 'item', onclick: go(title) }, 'Back to the title'),
    ];
    const own = sc.outcome === 'dead' ? deathPaper(state) : SCENARIOS[sc.kind].result?.(state, { debug });   // (killed: the engine's paper, whatever the scene)
    if (own) {                                                     // a scenario that writes its own paper
      paper.replaceChildren(el('div', { className: 'sheet result' },
        el('span', { className: `stamp ${own.good ? 'good' : ''}`, textContent: own.stamp }),
        el('h2', { textContent: own.title }), el('hr'),
        el('p', { textContent: own.text }),
        own.lead ? el('p', { className: 'lead', textContent: `Lead. ${own.lead}` }) : null,
        ...own.notes.map(t => el('p', { className: 'truth', textContent: t })),
        el('p', { className: 'note', textContent: own.stats }),
        ...ways));
    } else paper.replaceChildren(el('div', { className: 'sheet result' },
      el('span', { className: `stamp ${sc.outcome === 'seen' ? 'good' : ''}`, textContent: stampOf(sc) }),
      el('h2', { textContent: (state.campaign && sc.kind === 'tail' ? `Tailing: ${state.people.orlov?.name ?? ''}` : SCENARIOS[sc.kind].name).toUpperCase() }), el('hr'),
      el('p', { textContent: sc.endText }),
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

  return { frame, fit, flash, openInventory, openAid, openDesk, openChoices, showCandidates, showPaper, showTitle, hideTitle, update, toast, clearToasts, openMenu, openLog, openSheet, openInteract, openRead, showBrief, showResult, closeOverlays, closeAll, overlay, hud };
}
