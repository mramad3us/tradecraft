// TRADECRAFT ui: the keyboard. Keys are read by physical position (KeyboardEvent.code), so the game
// plays the same on any layout; labels on screen show the player's own layout where the browser can
// tell (navigator.keyboard.getLayoutMap(), Chrome), so an AZERTY player reads Z Q S D, not W A S D.
// The bindings are DESIGN.md's (Controls). Arrow keys move too.
//
// poll() is what the sim gets each tick: { mx, mz, run }, from the keys held. Everything else is an
// action fired once on the key going down (pause, the log, the menu…), for the UI to route.
export const KEYS = {
  up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', run: 'ShiftLeft',
  interact: 'KeyF', inventory: 'KeyI', instinct: 'KeyT', watch: 'KeyE', camera: 'KeyC',
  hit: 'KeyK', grapple: 'KeyL', guard: 'Semicolon', gun: 'KeyG', reload: 'KeyR',
  mindmap: 'Tab', log: 'KeyJ', pause: 'Space', menu: 'Escape',
};
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const ACTIONS = Object.fromEntries(Object.entries(KEYS).filter(([a]) => !['up', 'left', 'down', 'right', 'run'].includes(a)).map(([a, c]) => [c, a]));
const QWERTY = { Semicolon: ';', Space: 'Space', Escape: 'Esc', Tab: 'Tab', ShiftLeft: 'Shift' };

export function createInput(target = window) {
  const held = new Set();
  const handlers = new Set();
  let layout = null;
  navigator.keyboard?.getLayoutMap?.().then(m => { layout = m; }).catch(() => {});
  const down = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;                 // leave the browser's shortcuts alone
    if (e.target?.closest?.('input, textarea, select')) return;
    if (MOVE[e.code] || ['Tab', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    const action = ACTIONS[e.code];
    if (action) for (const h of handlers) h(action, e);
  };
  const up = (e) => held.delete(e.code);
  const blur = () => held.clear();                                 // keys let go while away stay down otherwise
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return {
    onAction(fn) { handlers.add(fn); return () => handlers.delete(fn); },
    poll() {
      let mx = 0, mz = 0;
      for (const c of held) if (MOVE[c]) { mx += MOVE[c][0]; mz += MOVE[c][1]; }
      return { mx: Math.sign(mx), mz: Math.sign(mz), run: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    clear: blur,
    /** What the key for an action (or a code) is labelled on the player's keyboard. */
    label(actionOrCode) {
      const code = KEYS[actionOrCode] ?? actionOrCode;
      if (QWERTY[code]) return QWERTY[code];
      const l = layout?.get(code);
      return (l ?? code.replace(/^Key|^Digit/, '')).toUpperCase();
    },
    dispose() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); window.removeEventListener('blur', blur); },
  };
}
