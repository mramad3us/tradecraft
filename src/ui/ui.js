// TRADECRAFT ui: the screens. The title sheet, the frame the picture sits in, the HUD over it (the
// watch, the log's lines as they come, the keys), and the sheets laid over it: the menu (Esc) and the
// log (J). Plain DOM over the canvas, sized to it: the canvas shows at a whole-number scale of
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
const TOAST_S = 9;

export function createUI({ input, cb }) {
  const frame = el('div', { id: 'frame' });
  const watch = el('div', { className: 'watch' }, el('div', { className: 'time' }), el('div', { className: 'date' }));
  const toasts = el('div', { className: 'toasts' });
  const keys = el('div', { className: 'keys' });
  const banner = el('div', { className: 'banner', textContent: 'PAUSED' });
  const hud = el('div', { id: 'hud' }, watch, toasts, keys, banner);
  const menu = el('div', { className: 'overlay', hidden: true });
  const log = el('div', { className: 'overlay', hidden: true });
  frame.append(hud, menu, log);
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
      ...Object.entries(SCENARIOS).map(([key, s]) => el('button', { className: 'item', onclick: () => cb.newGame(key) }, s.name, el('small', { textContent: s.about }))),
      el('button', { className: 'item', disabled: true }, 'Mechanic tests', el('small', { textContent: 'Next: 1. Tailing a target. Each to be played and scored before they\'re joined.' })),
      el('button', { className: 'item', onclick: () => cb.importSave() }, 'Load a save file…', el('small', { textContent: 'A .json save exported from the menu.' })),
      el('hr'),
      el('p', { className: 'note', textContent: 'Keys are read by where they sit on the keyboard, so they work on any layout.' }),
    ));
    title.hidden = false;
    title.querySelector('.item')?.focus();
  }
  const hideTitle = () => { title.hidden = true; };

  // ---------- the HUD ----------
  function update(state, paused) {
    watch.querySelector('.time').textContent = clockText(state.time.ms);
    watch.querySelector('.date').textContent = stampText(state.time.ms).split(',')[0];
    frame.classList.toggle('paused', paused && menu.hidden && log.hidden);
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
    while (toasts.children.length > 4) toasts.firstChild.remove();
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
  const closeOverlays = () => { menu.hidden = log.hidden = true; };
  const overlay = () => (!menu.hidden ? 'menu' : !log.hidden ? 'log' : null);

  return { frame, fit, showTitle, hideTitle, update, toast, clearToasts, openMenu, openLog, closeOverlays, overlay, hud };
}
