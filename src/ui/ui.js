// TRADECRAFT ui: the screens. The title sheet, the frame the picture sits in, the HUD over it (the
// watch and where you are, the log's lines as they come, the keys, a scenario's marker over its target and the
// instinct's line), and the sheets laid over it: the menu (Esc), the log (J), a test's brief before
// it starts and its result when it ends. Plain DOM over the canvas, sized to it: the picture fills the
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

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
  return e;
};
export const RES = [640, 360];                                     // (live: fit() sets it)
export const RES_BASE = [640, 360];
export const RES_MAX = [2 * SCREEN_HALF_M[0] * 16, 430];
const TOAST_S = 8;

export function createUI({ input, cb }) {
  const frame = el('div', { id: 'frame' });
  const watch = el('div', { className: 'watch' }, el('div', { className: 'time' }), el('div', { className: 'date' }), el('div', { className: 'place' }));
  const toasts = el('div', { className: 'toasts' });
  const keys = el('div', { className: 'keys' });
  const banner = el('div', { className: 'banner', textContent: 'PAUSED' });
  const marker = el('div', { className: 'marker', hidden: true });
  const bubble = el('div', { className: 'bubble', hidden: true });   // what a character's just become aware of: ? or !
  const tags = el('div', { className: 'tags' });                   // faces you've marked: seen before, a tail
  const goal = el('div', { className: 'goal', hidden: true });      // where you're going, when it's off the picture
  const prompt = el('div', { className: 'prompt', hidden: true });
  const hud = el('div', { id: 'hud' }, tags, marker, bubble, goal, prompt, watch, toasts, keys, banner);
  const menu = el('div', { className: 'overlay', hidden: true });
  const log = el('div', { className: 'overlay', hidden: true });
  const paper = el('div', { className: 'overlay', hidden: true });     // a brief, a result
  frame.append(hud, menu, log, paper);
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
    keys.innerHTML = `${k('up')}${k('left')}${k('down')}${k('right')} walk · ${k('slow')} stroll · ${k('run')} run · ${k('watch')} look · ${k('log')} log · ${k('pause')} pause · ${k('menu')} menu`;
  };
  keyHints();
  setTimeout(keyHints, 300);                                       // once the keyboard's layout is known

  // ---------- the title ----------
  function showTitle({ version, auto }) {
    title.replaceChildren(el('div', { className: 'sheet' },
      el('h1', { textContent: 'TRADECRAFT' }),
      el('p', { className: 'sub', textContent: `v${version} · in development: the skeleton, and the first look at the street` }),
      el('hr'),
      auto ? el('button', { className: 'item', onclick: () => cb.continue() }, 'Continue', el('small', { textContent: auto.about })) : null,
      ...Object.entries(SCENARIOS).filter(([, s]) => !s.test).map(([key, s]) => el('button', { className: 'item', onclick: () => cb.newGame(key) }, s.name, el('small', { textContent: s.about }))),
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
    if (me && state.map?.kind === 'street') watch.querySelector('.place').textContent = placeName(state.map.seed, state.map.row ?? 0, me.x, me.z);
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
    // The instinct: always a line, its tone in its border; {key} in the text shows as that key.
    const p = !sc.outcome && sc.prompt;
    prompt.hidden = !p;
    if (p && prompt.dataset.text !== p.text + p.tone) {
      prompt.dataset.text = p.text + p.tone;
      prompt.className = `prompt ${p.tone}`;
      prompt.replaceChildren(...keyed(p.text));
    }
    const now = performance.now();
    for (const t of [...toasts.children]) {
      if (now - t.born > TOAST_S * 1000 && !t.classList.contains('gone')) t.classList.add('gone');
      if (now - t.born > (TOAST_S + 1.5) * 1000) t.remove();
    }
  }
  // A line with {key} placeholders, the keys as this player has them (a prompt, a toast, the log).
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
  // ---------- a test's papers: the brief, the result ----------
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
  function showResult(state, { again, same, title }, { debug = false } = {}) {
    const sc = state.scenario, secs = Math.round((sc.ended - sc.began) / 1000);
    const go = (fn) => () => { paper.hidden = true; paper.dataset.kind = ''; fn(); };
    const ways = [
      el('hr'),
      el('p', { className: 'note', textContent: 'How did it play? A score out of 100, and what felt off, in the chat: that\'s what this test is for.' }),
      el('button', { className: 'item', onclick: go(again) }, 'Again, another evening', el('small', { textContent: 'A new street, a new evening, new dice.' })),
      el('button', { className: 'item', onclick: go(same) }, 'Again, the same evening', el('small', { textContent: 'The same streets and the same people; the dice fall as you play.' })),
      el('button', { className: 'item', onclick: go(title) }, 'Back to the title'),
    ];
    const own = SCENARIOS[sc.kind].result?.(state, { debug });
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
      el('h2', { textContent: SCENARIOS[sc.kind].name.toUpperCase() }), el('hr'),
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

  const closeOverlays = () => { menu.hidden = log.hidden = true; };
  const closeAll = () => { menu.hidden = log.hidden = paper.hidden = true; paper.dataset.kind = ''; };
  const overlay = () => (!menu.hidden ? 'menu' : !log.hidden ? 'log' : !paper.hidden ? paper.dataset.kind : null);

  return { frame, fit, showTitle, hideTitle, update, toast, clearToasts, openMenu, openLog, showBrief, showResult, closeOverlays, closeAll, overlay, hud };
}
