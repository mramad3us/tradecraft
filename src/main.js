// TRADECRAFT: the game in the browser. Wires the pure sim (src/sim) to the view (src/render), the
// keyboard and the screens (src/ui), and runs the loop.
//
// The loop: real time accumulates, and the sim steps in fixed ticks (TICK_MS) while nothing is open
// over the picture (the menu, the log) and the game isn't paused (Space) or hidden (another tab);
// the view draws every frame, between the last two ticks. Time is real (a second for a second): the
// only way to make it pass faster is an action that takes time (and, in debug mode, ] and [).
//
// Saves: an autosave every 30 game minutes, on leaving the page and on quitting to the title
// (src/ui/store.js); the menu exports and imports save files. ?play=<scenario>&seed=<n>&hour=<h>
// skips the title and starts a new game there (for shots and smoke tests); &autoplay[=<m>] has the
// game's own AI play the character (sim/agents.js; a follower m metres back). window.__tradecraft is
// the debug handle: { state, step(n, input), start(state or JSON), newGame(opts), save() (the JSON),
// skip(ms), autosave(), pause(on), view }.
import { newGame, start, step, skip } from './sim/game.js';
import { createBus } from './sim/bus.js';
import { toJSON, fromJSON } from './sim/state.js';
import { TICK_MS, HOUR, MIN, stampText, hourOfDay } from './sim/clock.js';
import { SCENARIOS } from './sim/scenarios/index.js';
import { createView } from './render/view.js';
import { createInput } from './ui/input.js';
import { createUI } from './ui/ui.js';
import { putSave, getSave, exportFile, importFile } from './ui/store.js';

const VERSION = (await fetch('VERSION').then(r => (r.ok ? r.text() : '?')).catch(() => '?')).trim();
const q = new URLSearchParams(location.search);
const settings = { debug: (() => { try { return localStorage.getItem('tradecraft.debug') === '1'; } catch { return false; } })() };

const input = createInput();
const FARM_KEY = 'tradecraft.farm';                                // (the Farm's lesson had, in this browser: the title offers it as a memory)
let state = null, bus = null, view = null;
let paused = false, running = false, acts = [];
let prev = new Map(), acc = 0, last = performance.now(), frames = 0;

const ui = createUI({ input, cb: {
  newGame: (kind, chapter = null) => launch(newGame({ seed: randomSeed(), scenario: kind, version: VERSION, chapter })),
  continue: async () => { const s = await getSave('auto'); if (s) launch(fromJSON(s.json)); },
  importSave: async () => {
    const text = await importFile();
    if (!text) return;
    try { launch(fromJSON(text)); } catch (e) { ui.toast({ kind: 'note', text: `That file won't load: ${e.message}.` }); }
  },
  exportSave: () => state && exportFile(toJSON(state), `tradecraft-${state.scenario.kind}-${stampText(state.time.ms).replace(/[ ,:]+/g, '-')}.json`),
  saveManual: () => state && putSave('manual', toJSON(state), about(state), VERSION).then(() => ui.toast({ kind: 'note', text: 'Saved (debug).' })),
  loadManual: async () => { const s = await getSave('manual'); if (s) launch(fromJSON(s.json)); },
  resume: () => { ui.closeOverlays(); paused = false; },
  quit: async () => { await autosave(); stop(); showTitle(); },
  setDebug: (on) => { settings.debug = on; try { localStorage.setItem('tradecraft.debug', on ? '1' : '0'); } catch {} },
  fit: (w, h, outW, outH) => view?.resize(w, h, outW, outH),
  talk: (id) => acts.push(`talk:${id}`),                        // (a conversation's choice: sim/talk.js)
} });

function randomSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
const about = (s) => `${SCENARIOS[s.scenario.kind]?.name ?? s.scenario.kind} · ${s.people[s.player]?.name ?? ''} · ${stampText(s.time.ms)}`;

async function autosave() {
  if (!state || !running) return;
  try { await putSave('auto', toJSON(state), about(state), VERSION); } catch (e) { console.warn('autosave failed', e); }
}

function stop() {
  running = false;
  view?.dispose();
  view = null;
  state = null;
}

/** Play a state (new or loaded); hour (from ?hour) moves its clock on to that hour first. */
function launch(s, { hour = null } = {}) {
  stop();
  state = s;
  bus = createBus();
  view = createView({ parent: ui.frame, bus });
  ui.frame.prepend(view.canvas);
  ui.fit();                                                        // (the picture to the window)
  bus.on('log', (e) => ui.toast(e));
  bus.on('read', (who) => ui.openRead(state, who));
  bus.on('autosave', () => autosave());
  bus.on('scenario-end', () => {
    if (s.scenario.kind === 'dojo' && s.scenario.chapter !== 'remembered') { try { localStorage.setItem(FARM_KEY, 'done'); } catch {} }   // (the lesson had: next time the Farm is a memory)
    setTimeout(() => { if (state === s) result(); }, 1800);
  });
  bus.on('cut', () => ui.flash());                                 // (a scene's cut to another time: sim/scenarios/dojo.js)
  bus.on('brief', (b) => ui.showBrief(b, () => {}));
  bus.on('map', () => { prev = new Map(); view.flush(); });         // the next street: no gliding there from the last
  start(state, bus);
  view.flush();                                                    // the street around you, before the first frame
  if (Number.isFinite(hour)) skip(state, bus, ((hour - hourOfDay(state.time.ms)) * HOUR % (24 * HOUR) + 24 * HOUR) % (24 * HOUR));
  ui.hideTitle();
  ui.closeAll();
  ui.clearToasts();
  for (const e of state.log.slice(-2)) ui.toast(e);
  prev = new Map(); acc = 0; paused = false; running = true; acts = [];
  const sc = SCENARIOS[state.scenario.kind];
  if (state.scenario.outcome) result();
  else if (sc.brief && state.tick === 0) ui.showBrief(typeof sc.brief === 'function' ? sc.brief(state) : sc.brief, () => {});
}

/** A test's result paper, with the ways on. */
function result() {
  const kind = state.scenario.kind, seed = state.seed, chapter = state.scenario.chapter ?? null;
  ui.showResult(state, {
    again: () => launch(newGame({ seed: randomSeed(), scenario: kind, version: VERSION, chapter })),
    same: () => launch(newGame({ seed, scenario: kind, version: VERSION, chapter })),
    title: async () => { await autosave(); stop(); showTitle(); },
  }, settings);
}

async function showTitle() {
  let auto = null;
  try { auto = await getSave('auto'); } catch {}
  let farm = false;
  try { farm = localStorage.getItem(FARM_KEY) === 'done'; } catch {}
  ui.showTitle({ version: VERSION, auto, farm });
}

// Keys: the actions the UI owns. Movement is polled each tick.
input.onAction((action) => {
  if (!running) return;
  const open = ui.overlay();
  if (open === 'brief' || open === 'result') return;              // a paper waits for its choice
  if (action === 'menu' && state?.talk && !open) { acts.push('talk:leave'); return; }   // (Esc in a conversation: leave it there)
  if (action === 'menu') { if (open) { ui.closeOverlays(); paused = false; } else { ui.openMenu(settings); } return; }
  if (action === 'log') { if (open === 'log') { ui.closeOverlays(); } else if (!open) ui.openLog(state, settings); return; }
  if (action === 'sheet') { if (open === 'sheet') { ui.closeOverlays(); } else if (!open) ui.openSheet(state); return; }
  if (action === 'interact') {                                    // (F: what to do with whoever's within reach; the sim does it: sim/interact.js)
    if (open === 'interact') { ui.closeOverlays(); return; }
    if (state.fight) { if (open === 'sheet') ui.closeOverlays(); else if (!open) ui.openRead(state, state.fight.b); return; }   // (in a fight: your read of them, the fight's own: sim/fight.js)
    if (!open && !paused && !ui.openInteract(state, (id, them) => acts.push(`interact:${id}:${them.id}`))) ui.toast({ kind: 'instinct', text: 'Nobody within reach.' });
    return;
  }
  if (action === 'pause' && !open) paused = !paused;
  if ((action === 'instinct' || action === 'glance') && !open && !paused) acts.push(action);
  if ((action === 'hit' || action === 'grapple' || action === 'guard') && !open && !paused) acts.push(input.poll().run ? `${action}+` : action);   // (Shift held: an edge spent)
});
addEventListener('keydown', (e) => {                               // debug mode: the clock moves on
  if (!running || !settings.debug || ui.overlay() || e.repeat) return;
  if (e.code === 'BracketRight') skip(state, bus, HOUR);
  if (e.code === 'BracketLeft') skip(state, bus, 15 * MIN);
});
addEventListener('pagehide', () => autosave());
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { paused = true; autosave(); } });

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (running) {
    const live = !paused && !ui.overlay();
    if (live) {
      acc += dt;
      while (acc >= TICK_MS / 1000) {
        prev = new Map(state.actors.map(a => [a.id, [a.x, a.z, a.stride]]));
        step(state, { ...input.poll(), act: acts }, bus);
        acts = [];
        acc -= TICK_MS / 1000;
      }
    }
    view.frame(state, prev, live ? acc / (TICK_MS / 1000) : 1, state.time.ms / 1000);
    ui.update(state, paused, view);
    if (++frames === 3) window.__ready = true;
  }
  requestAnimationFrame(frame);
}

window.__tradecraft = {
  get state() { return state; },
  get view() { return view; },
  step(n = 1, inp = {}) { for (let i = 0; i < n; i++) { prev = new Map(state.actors.map(a => [a.id, [a.x, a.z, a.stride]])); step(state, inp, bus); } },
  start: (s) => launch(typeof s === 'string' ? fromJSON(s) : s),
  newGame: (opts) => launch(newGame({ version: VERSION, ...opts })),
  save: () => toJSON(state),
  pause: (p = true) => { paused = p; },
  skip: (ms) => skip(state, bus, ms),
  autosave,
};

if (q.has('play') && SCENARIOS[q.get('play')]) {
  const autoplay = q.has('autoplay') ? { keep: Number(q.get('autoplay')) || 20 } : null;
  launch(newGame({ seed: Number(q.get('seed') ?? 1), scenario: q.get('play'), version: VERSION, autoplay, chapter: q.get('chapter') }), { hour: q.has('hour') ? Number(q.get('hour')) : null });
}
else showTitle();
requestAnimationFrame(frame);
