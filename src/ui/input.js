// TRADECRAFT ui: the keyboard. Keys are read by physical position (KeyboardEvent.code), so the game
// plays the same on any layout; labels on screen show the player's own layout where the browser can
// tell (navigator.keyboard.getLayoutMap(), Chrome), and AZERTY where it can't or hasn't yet (the
// user's, the only player: "don't give me the QWERTY keybinds"), so the keys read Z Q S D and M.
// The bindings are DESIGN.md's (Controls). Arrow keys move too.
//
// poll() is what the sim gets each tick: { mx, mz, run, slow, look }, from the keys held: Shift runs,
// Alt (Option on a Mac) strolls, E held (longer than TAP_MS) stands still and looks, the move keys
// turning the eyes. E tapped is the action 'glance': a look over the shoulder, walking on.
// Everything else is an action fired once on the key going down (pause, the log, the menu…), for the
// UI to route.
export const KEYS = {
  up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', run: 'ShiftLeft', slow: 'AltLeft',
  interact: 'KeyF', inventory: 'KeyI', aid: 'KeyH', instinct: 'KeyT', watch: 'KeyE', sheet: 'KeyC', camera: 'KeyP',
  hit: 'KeyK', grapple: 'KeyL', guard: 'Semicolon', gun: 'KeyG', reload: 'KeyR',
  mindmap: 'Tab', log: 'KeyJ', pause: 'Space', menu: 'Escape',
};
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const ACTIONS = Object.fromEntries(Object.entries(KEYS).filter(([a]) => !['up', 'left', 'down', 'right', 'run', 'slow'].includes(a)).map(([a, c]) => [c, a]));
export const TAP_MS = 220;
const NAMES = { Space: 'Space', Escape: 'Esc', Tab: 'Tab', ShiftLeft: 'Shift', AltLeft: /Mac/.test(globalThis.navigator?.platform ?? '') ? 'Option' : 'Alt' };
const AZERTY = { KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', Semicolon: 'M', KeyM: ',', Comma: ';', Period: ':' };

export function createInput(target = window) {
  const held = new Set();
  let eDown = 0;
  const handlers = new Set();
  let layout = null;
  navigator.keyboard?.getLayoutMap?.().then(m => { layout = m; }).catch(() => {});
  const down = (e) => {
    if (e.metaKey || e.ctrlKey) return;                             // leave the browser's shortcuts alone
    if (e.target?.closest?.('input, textarea, select')) return;
    // (Alt is the stroll: held with the move keys, it mustn't type, nor wake the browser's menu)
    if (MOVE[e.code] || ['Tab', 'Space', 'AltLeft', 'AltRight'].includes(e.code) || e.altKey) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    if (e.code === KEYS.watch) { eDown = performance.now(); return; }   // (a tap or a hold: known when it's let go)
    const action = ACTIONS[e.code];
    if (action) for (const h of handlers) h(action, e);
  };
  const up = (e) => {
    held.delete(e.code);
    if (e.code.startsWith('Alt')) e.preventDefault();
    if (e.code === KEYS.watch && eDown && performance.now() - eDown < TAP_MS) for (const h of handlers) h('glance', e);
    if (e.code === KEYS.watch) eDown = 0;
  };
  const blur = () => held.clear();                                 // keys let go while away stay down otherwise
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return {
    onAction(fn) { handlers.add(fn); return () => handlers.delete(fn); },
    poll() {
      let mx = 0, mz = 0;
      for (const c of held) if (MOVE[c]) { mx += MOVE[c][0]; mz += MOVE[c][1]; }
      return { mx: Math.sign(mx), mz: Math.sign(mz), run: held.has('ShiftLeft') || held.has('ShiftRight'),
        slow: held.has('AltLeft') || held.has('AltRight'), look: held.has(KEYS.watch) && performance.now() - eDown >= TAP_MS };
    },
    clear: blur,
    /** What the key for an action (or a code) is labelled on the player's keyboard. */
    label(actionOrCode) {
      const code = KEYS[actionOrCode] ?? actionOrCode;
      if (NAMES[code]) return NAMES[code];
      const l = layout?.get(code);
      return (l ?? AZERTY[code] ?? code.replace(/^Key|^Digit/, '')).toUpperCase();
    },
    dispose() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); window.removeEventListener('blur', blur); },
  };
}
