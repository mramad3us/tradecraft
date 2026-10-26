// TRADECRAFT ui: the screens. The title sheet, the frame the picture sits in, the HUD over it (the
// watch, the log's lines as they come, the keys, a scenario's marker over its target and the
// instinct's line), and the sheets laid over it: the menu (Esc), the log (J), a test's brief before
// it starts and its result when it ends. Plain DOM over the canvas, sized to it: the canvas shows at a whole-number scale of
// 640 × 360, centred, and the HUD is the same box, so nothing sits off the picture.
//
// It shows the state and routes the player's choices to the callbacks it's given (src/main.js); it
// never changes the state itself. Times are game time (sim/clock.js); rolls read through checkText().
import { clockText, stampText, dateText } from '../sim/clock.js';
import { checkText } from '../sim/checks.js';
import { SCENARIOS } from '../sim/scenarios/index.js';

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k);
  return e;
};
export const RES = [640, 360];
const TOAST_S = 8;

export function createUI({ input, cb }) {
  const frame = el('div', { id: 'frame' });
  const watch = el('div', { className: 'watch' }, el('div', { className: 'time' }), el('div', { className: 'date' }));
  const toasts = el('div', { className: 'toasts' });
  const keys = el('div', { className: 'keys' });
  const banner = el('div', { className: 'banner', textContent: 'PAUSED' });
  const marker = el('div', { className: 'marker', hidden: true });
  const prompt = el('div', { className: 'prompt', hidden: true });
  const hud = el('div', { id: 'hud' }, marker, prompt, watch, toasts, keys, banner);
  const menu = el('div', { className: 'overlay', hidden: true });
  const log = el('div', { className: 'overlay', hidden: true });
  const paper = el('div', { className: 'overlay', hidden: true });     // a brief, a result
  frame.append(hud, menu, log, paper);
  const title = el('div', { id: 'title', hidden: true });
  document.body.append(frame, title);

  function fit() {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / RES[0], innerHeight / RES[1])));
    Object.assign(frame.style, { width: `${RES[0] * s}px`, height: `${RES[1] * s}px`, left: `${Math.floor((innerWidth - RES[0] * s) / 2)}px`, top: `${Math.floor((innerHeight - RES[1] * s) / 2)}px` });
  }
  fit();
  addEventListener('resize', fit);

  const keyHints = () => {
    const k = (a) => `<kbd>${input.label(a)}</kbd>`;
    keys.innerHTML = `${k('up')}${k('left')}${k('down')}${k('right')} walk · ${k('run')} run · ${k('log')} log · ${k('pause')} pause · ${k('menu')} menu`;
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
      el('button', { className: 'item', disabled: true }, '2. Being tailed', el('small', { textContent: 'Next: spot the tail, lose it, on a street and in the metro.' })),
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
    frame.classList.toggle('paused', paused && menu.hidden && log.hidden && paper.hidden);
    // The target's marker: over their head while we have them, at the frame's edge when they're off it.
    const sc = state.scenario, t = sc.target && !sc.outcome && sc.have && view?.posOf(sc.target);
    const hiddenT = sc.target && state.actors.find(a => a.id === sc.target)?.hidden;
    marker.hidden = !t || hiddenT;
    if (t && !hiddenT) {
      const k = frame.clientWidth / RES[0], cam = view.camera;
      const sx = RES[0] / 2 + (t[0] - cam.x) * 16, sy = RES[1] / 2 + (t[1] - cam.z) * 16 - 2.45 * 16;
      const cx = Math.max(6, Math.min(RES[0] - 6, sx)), cy = Math.max(8, Math.min(RES[1] - 8, sy));
      const off = cx !== sx || cy !== sy;
      marker.classList.toggle('off', off);
      marker.style.transform = `translate(${Math.round(cx * k)}px, ${Math.round(cy * k)}px) rotate(${off ? Math.atan2(sy - cy, sx - cx) * 180 / Math.PI - 90 : 0}deg)`;
      marker.style.setProperty('--k', k);
    }
    // The instinct.
    const p = !sc.outcome && sc.prompt;
    prompt.hidden = !p;
    if (p) {
      const text = p.text + (p.key === 'window' ? '  (look in a window)' : '');
      if (prompt.dataset.text !== text + p.key) {
        prompt.dataset.text = text + p.key;
        prompt.replaceChildren(...(p.key ? [el('kbd', { textContent: input.label('instinct') }), ' '] : []), el('span', { textContent: text }));
      }
    }
    const now = performance.now();
    for (const t of [...toasts.children]) {
      if (now - t.born > TOAST_S * 1000 && !t.classList.contains('gone')) t.classList.add('gone');
      if (now - t.born > (TOAST_S + 1.5) * 1000) t.remove();
    }
  }
  function toast(e) {
    const t = el('div', { className: `toast ${e.kind}${e.roll && !e.roll.ok ? ' fail' : ''}` }, e.text ?? '', e.roll ? el('span', { className: 'num', textContent: checkText(e.roll) }) : null);
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
  function openLog(state) {
    const items = state.log.slice().reverse().map(e => el('li', { className: e.roll && !e.roll.ok ? 'fail' : '' },
      el('time', { textContent: stampText(e.ms) }), e.text ?? '', e.roll ? el('span', { className: 'num', textContent: checkText(e.roll) }) : null));
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
      el('button', { className: 'item go', onclick: begin }, 'Begin', el('small', { textContent: `${input.label('instinct')} does what your instinct says; ${input.label('log')} is the log.` })),
    ));
    paper.hidden = false;
    paper.dataset.kind = 'brief';
    paper.querySelector('.go').focus();
  }
  const OUTCOMES = { seen: 'SEEN', made: 'MADE', lost: 'LOST', missed: 'MISSED', blown: 'BLOWN' };
  function showResult(state, { again, same, title }) {
    const sc = state.scenario, secs = Math.round((sc.ended - sc.began) / 1000);
    const go = (fn) => () => { paper.hidden = true; paper.dataset.kind = ''; fn(); };
    paper.replaceChildren(el('div', { className: 'sheet result' },
      el('span', { className: `stamp ${sc.outcome === 'seen' ? 'good' : ''}`, textContent: OUTCOMES[sc.outcome] ?? sc.outcome }),
      el('h2', { textContent: SCENARIOS[sc.kind].name.toUpperCase() }), el('hr'),
      el('p', { textContent: sc.endText }),
      sc.lead ? el('p', { className: 'lead', textContent: `Lead. ${sc.lead}` }) : null,
      el('p', { className: 'note', textContent: `${Math.floor(secs / 60)} min ${secs % 60} s on his tail · seen ${sc.sightings.length} time${sc.sightings.length === 1 ? '' : 's'} · closest ${sc.closest < 1e8 ? sc.closest.toFixed(1) : '?'} m · ${sc.rolls} rolls (the ones that mattered are in the log, ${input.label('log')})` }),
      el('hr'),
      el('p', { className: 'note', textContent: 'How did it play? A score out of 100, and what felt off, in the chat: that\'s what this test is for.' }),
      el('button', { className: 'item', onclick: go(again) }, 'Again, another evening', el('small', { textContent: 'A new street, a new route, new dice.' })),
      el('button', { className: 'item', onclick: go(same) }, 'Again, the same evening', el('small', { textContent: 'The same street and route; the dice fall as you play.' })),
      el('button', { className: 'item', onclick: go(title) }, 'Back to the title'),
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
