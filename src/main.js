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
// skips the title and starts a new game there (for shots and smoke tests), &city=<london | beirut |
// cairo> in another city (sim/cities/; Moscow by default); &autoplay[=<m>] has the
// game's own AI play the character (sim/agents.js; a follower m metres back). ?weather=<kind[-level]
// [-wind]> pins the weather of every new game (sim/weather.js parseWeather(): snow-heavy-gale,
// rain-light, fog-extreme, dust-heavy-strong, frost, clear), with ?play or from the title. window.__tradecraft is
// the debug handle: { state, step(n, input), start(state or JSON), newGame(opts), save() (the JSON),
// skip(ms), autosave(), pause(on), view }.
import { newGame, start, step, skip } from './sim/game.js';
import { createBus } from './sim/bus.js';
import { toJSON, fromJSON } from './sim/state.js';
import { TICK_MS, HOUR, MIN, stampText, hourOfDay, calendar } from './sim/clock.js';
import { SCENARIOS } from './sim/scenarios/index.js';
import { candidates, newCampaign, context, fold, heatWord, KINDS, LEVELS, levelOf, promote, goalOf } from './sim/campaign.js';
import { cityById } from './sim/cities/index.js';
import { shopWord } from './sim/shops.js';
import { price } from './sim/money.js';
import { createView } from './render/view.js';
import { createInput } from './ui/input.js';
import { createUI, RES } from './ui/ui.js';
import { putSave, getSave, exportFile, importFile } from './ui/store.js';
import { briefFor, lessonOf } from './sim/tutorial/index.js';

const VERSION = (await fetch('VERSION').then(r => (r.ok ? r.text() : '?')).catch(() => '?')).trim();
const q = new URLSearchParams(location.search);
const WEATHER = q.get('weather');                                  // (a pinned weather for every new game: debug and shots)
const settings = { debug: (() => { try { return localStorage.getItem('tradecraft.debug') === '1'; } catch { return false; } })() };

const input = createInput();
const FARM_KEY = 'tradecraft.farm';                                // (the Farm's lesson had, in this browser: the title offers it as a memory)
let state = null, bus = null, view = null;
// (the campaign the tutorial was opened from, by the flat's telephone: its hub saved to come back to, and
// its officer, who plays the lessons: the user, 2026-10-27, "gate the tutorial behind the campaign")
let home = null;
let paused = false, running = false, acts = [];
let prev = new Map(), acc = 0, last = performance.now(), frames = 0;

const ui = createUI({ input, cb: {
  // (a test or a lesson; from the flat's telephone, played by the campaign's officer: `home`)
  newGame: (kind, chapter = null, city = null) => launch(newGame({ seed: randomSeed(), scenario: kind, version: VERSION, chapter, city: city ?? home?.city ?? null, weather: WEATHER, character: home?.character, job: home?.job })),
  newLesson: (id) => launch(newGame({ seed: randomSeed(), lesson: id, version: VERSION, weather: WEATHER, character: home?.character, city: home?.city, job: home?.job })),   // (from the flat: the officer, their city, their cover)   // (the tutorial: sim/tutorial/)
  // (the campaign, the game's way in: three officers, one picked, and day one in their flat: sim/campaign.js)
  newCampaign: (city = 'moscow') => pickOfficer(city),
  backHome: () => resumeHome(),                                     // (the tutorial, left for the flat)
  beginPosting: () => resumeHome(true),                             // (the tutorial done with: the posting's brief, and on)
  continue: async () => { home = null; const s = await getSave('auto'); if (s) launch(fromJSON(s.json)); },
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

/** The way into the game: three officers for a posting (another city: three others), one picked, and day one in their flat. */
/**
 * New game: the officers to pick from, at a rung of the career (sim/campaign.js LEVELS): a first tour
 * always; a posting of your own once you've reached the rung above it in some game (CAREER_KEY, the
 * user: "reaching a level unlocks starting at the one below it"), or in debug mode.
 */
function pickOfficer(city = 'moscow', level = null) {
  const best = careerBest(), open = (k) => k === 0 || k <= best - 1 || settings.debug;
  level ??= open(1) ? 'handler' : 'junior';
  if (level === 'junior') city = 'london';
  const seed = randomSeed(), list = candidates(seed, city, level);
  home = null;
  ui.hideTitle();
  ui.showCandidates(list, (i) => launch(newGame({ seed, scenario: 'campaign', version: VERSION, campaign: newCampaign(seed, list[i], city, level), weather: WEATHER })),
    city, { cities: level === 'junior' ? null : (c) => pickOfficer(c, level), back: () => showTitle(), level,
      levels: LEVELS.map((L, k) => ({ id: L.id, name: L.name, open: open(k), why: k ? `Opens when a game of yours reaches the rung above it${settings.debug ? ' (open: debug mode)' : ''}.` : null })), levelTo: (id) => pickOfficer(id === 'junior' ? 'london' : 'moscow', id) });
}

// The career's record across games (sim/campaign.js LEVELS): the highest rung any game reached.
const CAREER_KEY = 'tradecraft.career';
function careerBest() { try { return JSON.parse(localStorage.getItem(CAREER_KEY) ?? '{}').best ?? 0; } catch { return 0; } }
function reached(k) { try { if (k > careerBest()) localStorage.setItem(CAREER_KEY, JSON.stringify({ best: k, at: Date.now() })); } catch {} }

/**
 * The flat's telephone (sim/scenarios/campaign.js): Hale. Day one he offers the exercises (the tutorial,
 * played by this officer) or straight in (the posting's brief); called back later, the exercises again.
 */
function openCall(s, id) {
  if (state !== s) return;
  const c = s.campaign, city = cityById(c.posting.city).name, first = id === 'hale';
  const lines = first ? [
    `"Hale. Welcome to ${city}. You'll meet the station chief soon enough; I wanted to get to you first."`,
    '"Before they let you near anyone who matters, I\'d like some of your evenings: the street work, me in your ear and our own people playing the parts. Seven exercises and the mat at the Farm, if you want it again. Or you go straight in and learn it on the job. Plenty did. Your call."',
  ] : ['"Hale."', '"The exercises? Whenever you like. My door\'s open, and so\'s the street."'];
  ui.showCall({ who: 'HALE', lines, choices: [
    { key: 'tutorial', label: 'The exercises, with Hale', about: 'The tutorial: the work on the street, one lesson at a time, played by your officer. Back to the flat whenever you like.' },
    first ? { key: 'begin', label: 'Straight in', about: 'The posting\'s brief, and on with it. Hale\'s number stays by the phone.' } : { key: 'later', label: 'Not now', about: 'Another time.' },
  ] }, (key) => {
    if (key === 'tutorial') toTutorial(s);
    else if (key === 'begin') ui.showPaper(postingPaper(c), () => {});
  });
}

/** From the flat to the tutorial: the hub kept to come back to, its officer to play the lessons. */
async function toTutorial(s) {
  home = { json: toJSON(s), character: structuredClone(s.people[s.player]), name: s.people[s.player].name, city: s.campaign.posting.city, job: s.campaign.posting.job };
  await autosave();
  stop();
  ui.showTutorial({ home });
}

/** Back to the flat from the tutorial, as it was left; begin: the posting's brief first. */
function resumeHome(begin = false) {
  if (!home) return showTitle();
  const s = fromJSON(home.json);
  home = null;
  launch(s);
  if (begin) ui.showPaper(postingPaper(s.campaign), () => {});
}

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
  lastPhoto = null; snapWanted = null;
  bus = createBus();
  view = createView({ parent: ui.frame, bus, month: () => calendar(s.time.ms).month });   // (the season: the trees' leaves, the hedges', the fallen ones)
  ui.frame.prepend(view.canvas);
  ui.fit();                                                        // (the picture to the window)
  bus.on('log', (e) => ui.toast(e));
  bus.on('read', (who) => ui.openRead(state, who));
  bus.on('aid', (id) => ui.openAid(state, id, (key) => acts.push(`aid:${id}:${key}`)));   // (first aid for someone at hand: sim/aid.js)
  bus.on('autosave', () => autosave());
  // (the campaign: an assignment taken at the desk, launched after this tick; papers the days bring, one after another)
  bus.on('assignment', (id) => setTimeout(() => launchAssignment(s, id), 0));
  bus.on('papers', (list) => showPapers(list));
  bus.on('call', (id) => setTimeout(() => openCall(s, id), 0));    // (the flat's telephone: Hale)
  bus.on('desk-open', () => setTimeout(() => ui.openMind(s, (cmd) => acts.push(`desk:${cmd}`), 'ahead'), 0));   // (the chief's office at the embassy: what's on, the mind's first leaf)
  bus.on('wardrobe', (list) => setTimeout(() => list.length ? ui.openChoices('WARDROBE', 'WHAT TO WEAR, WHAT TO KEEP', list, (key) => acts.push(`desk:dress:${key}`)) : ui.closeOverlays(), 0));   // (the flat's wardrobe: sim/clothes.js)
  bus.on('bed', (list) => ui.openChoices('BED', 'HOW LONG?', list, (key) => acts.push(`desk:${key}`)));   // (the flat's bed by day: sim/scenarios/campaign.js)
  bus.on('photo', (w) => { snapWanted = w; });                    // (sim/scenarios/watch.js: the frame, at the next draw)
  bus.on('shop', ({ shop, ways }) => ui.openChoices('SHOP', shopWord(shop).replace(/^the /, '').toUpperCase(), ways.map(w => ({ key: w.id, label: w.label })), (key) => acts.push(`shop:${key}`)));   // (sim/shops.js)
  bus.on('bus', ({ line, towards, list }) => ui.openChoices('BUS', `THE ${line}, FOR ${String(towards).toUpperCase()}: WHERE TO?`, list.map(d => ({ key: d.id, label: `${d.label.charAt(0).toUpperCase() + d.label.slice(1)} · ${price(state, d.fare)}` })), (key) => acts.push(`bus:${key}`)));   // (sim/buses.js)
  bus.on('metro', ({ name, list }) => ui.openChoices(name === 'Underground' ? 'UNDERGROUND' : 'METRO', 'WHICH STATION?', list.map(d => ({ key: d.id, label: `${d.label} · ${price(state, d.fare)}` })), (key) => acts.push(`metro:${key}`)));   // (sim/metro.js)
  bus.on('taxi', (list) => ui.openChoices('TAXI', 'WHERE TO?', list.map(d => ({ key: d.id, label: `${d.label.charAt(0).toUpperCase() + d.label.slice(1)} · ${price(state, d.fare)}` })), (key) => acts.push(`taxi:${key}`)));   // (sim/taxi.js; the fare, sim/money.js)
  bus.on('scenario-end', () => {
    if (s.scenario.kind === 'dojo' && s.scenario.chapter !== 'remembered') { try { localStorage.setItem(FARM_KEY, 'done'); } catch {} }   // (the lesson had: next time the Farm is a memory)
    setTimeout(() => { if (state === s) result(); }, 1800);
  });
  bus.on('cut', () => ui.flash());                                 // (a scene's cut to another time: sim/scenarios/dojo.js)
  bus.on('brief', (b) => ui.showBrief(b, () => {}, state.map?.city));
  bus.on('map', () => { prev = new Map(); });                      // the next street: no gliding there from the last (the view builds what's on screen of it at once)
  start(state, bus);
  view.flush();                                                    // the street around you, before the first frame
  if (Number.isFinite(hour)) skip(state, bus, ((hour - hourOfDay(state.time.ms)) * HOUR % (24 * HOUR) + 24 * HOUR) % (24 * HOUR));
  ui.hideTitle();
  ui.closeAll();
  ui.clearToasts(state.map?.city ?? null);
  for (const e of state.log.slice(-2)) ui.toast(e);
  prev = new Map(); acc = 0; paused = false; running = true; acts = [];
  const sc = SCENARIOS[state.scenario.kind];
  if (state.scenario.outcome) result();
  else if (sc.brief && state.tick === 0) ui.showBrief(briefFor(state, typeof sc.brief === 'function' ? sc.brief(state) : sc.brief), () => {}, state.map?.city);   // (a lesson's: its framing first: sim/tutorial/)
}

/** A test's result paper, with the ways on. */
function result() {
  const kind = state.scenario.kind, seed = state.seed, chapter = state.scenario.chapter ?? null, city = state.map?.city ?? null;
  if (state.campaign) {
    // (the hub's own end, the posting over: the career's record kept (CAREER_KEY); promoted, the station of your own chosen here)
    const c = state.campaign, over = kind === 'campaign' && state.scenario.outcome;
    if (over) reached(levelOf(c.posting.level) + (over === 'promoted' || over === 'completed' ? 1 : 0));
    const next = over === 'promoted' ? (city) => launch(newGame({ seed: randomSeed(), scenario: 'campaign', version: VERSION, campaign: promote(c, city), weather: WEATHER })) : null;
    return ui.showResult(state, { back: () => backToPosting(state), title: async () => { await autosave(); stop(); showTitle(); }, photo: lastPhoto?.url, next }, settings);
  }
  // (a lesson of the tutorial: again with Hale, on your own, the next one, the directory: sim/tutorial/)
  // (from the flat's telephone, `home`: the campaign's officer plays on, and the way out is back to the flat)
  const character = home?.character;
  const lesson = state.tutor ? {
    again: () => launch(newGame({ seed: randomSeed(), lesson: state.tutor.lesson, version: VERSION, city, weather: WEATHER, character, job: home?.job })),
    alone: () => launch(newGame({ seed: randomSeed(), scenario: kind, version: VERSION, city, weather: WEATHER, character, job: home?.job })),
    next: (id) => launch(newGame({ seed: randomSeed(), lesson: id, version: VERSION, city, weather: WEATHER, character, job: home?.job })),
    tutorial: async () => { stop(); if (home) ui.showTutorial({ home }); else { showTitle(); ui.showTutorial(); } },
  } : null;
  ui.showResult(state, {
    photo: lastPhoto?.url,
    again: () => launch(newGame({ seed: randomSeed(), scenario: kind, version: VERSION, chapter, city, weather: WEATHER, character, job: home?.job })),
    same: () => launch(newGame({ seed, scenario: kind, version: VERSION, chapter, city, weather: WEATHER, character, job: home?.job })),
    title: home ? () => resumeHome() : async () => { await autosave(); stop(); showTitle(); },
    home: !!home,
    lesson,
  }, settings);
}

/** The campaign: an assignment from the desk, its scene with the campaign's context (sim/campaign.js context()). */
function launchAssignment(s, id) {
  const c = s.campaign, a = c?.assignments.find(x => x.id === id);
  if (!a || state !== s) return;
  launch(newGame({ seed: randomSeed(), scenario: KINDS[a.kind].scenario, version: VERSION, campaign: c, context: context(c, a), weather: WEATHER }));
}

/** An assignment over: its outcome into the campaign, the debrief, and back to the hub where it left you. */
function backToPosting(s) {
  const c = s.campaign, a = c.assignments.find(x => x.id === s.assignment);
  const me = s.actors.find(x => x.who === s.player);
  const paper = a ? fold(c, a, s.scenario, s.people[s.player], s.time.ms, Object.values(s.heat)[0]) : { title: 'BACK', lines: [] };
  // (from a trip abroad: the flight home, the flat in London next morning: sim/campaign.js foldTrip())
  c.where = me && !a?.trip ? { row: me.row ?? s.map.row, x: me.x, z: me.z } : null;
  c.now = a?.home ?? s.time.ms;
  ui.showPaper({ stamp: 'DEBRIEF', title: paper.title, lines: paper.lines, note: `Heat: ${heatWord(c.posting.heat)}. Intelligence: ${c.posting.intelligence}.` },
    () => launch(newGame({ seed: randomSeed(), scenario: 'campaign', version: VERSION, campaign: c, weather: WEATHER })));
}

/** Papers the days brought (pay, the week's review), one after another. */
function showPapers(list) {
  const next = () => { const p = list.shift(); if (p) ui.showPaper({ stamp: { pay: 'PAY', review: 'REVIEW', news: 'NEWS', over: 'CABLE' }[p.kind] ?? 'NOTE', title: p.title, lines: p.lines }, next); };
  next();
}

/** The posting's brief, the paper before day one. */
function postingPaper(c) {
  const p = c.posting, me = c.character;
  if (p.level === 'junior') return { stamp: 'FIRST TOUR', title: 'STATION LONDON', go: 'Begin the tour', lines: [
    `${me.name}: ${p.job}. On paper you work for the FBI's people in London; in fact you're the station's liaison with MI5, and its most junior officer.`,
    `The station wants ${p.goal}. With MI5's watchers, you'll follow the residency's people and photograph whom they meet: ${p.targets.map(t => t.name).join(' and ')}.`,
    `Twice in the tour another station will borrow you for a couple of days: ${p.trips.map(t => `${cityById(t.city).name}`).join(', then ')}. Flown out the morning of it, home the morning after.`,
    `Do it well (intelligence ${goalOf(p)}), keep the heat down, and the next posting is a station of your own.`,
    'The embassy expects you nine to six on weekdays: the work is in the evenings. Tab is the desk: what\'s ahead, the day\'s choices.',
  ] };
  return { stamp: 'POSTING', title: `STATION ${cityById(p.city).name.toUpperCase()}`, go: 'Begin the posting', lines: [
    `${me.name}: ${p.job}. Diplomatic immunity: caught, you'd be expelled. The people you run wouldn't be so lucky.`,
    `The station wants ${p.goal}. Every meeting, every tail, is a step toward it.`,
    `Your network: ${p.assets.map(s => `${s.codename}, ${s.role}, in it for ${s.motive}`).join('; ')}.`,
    `Watched: ${p.targets.map(t => `${t.name}, ${t.what}`).join('; ')}.`,
    'The embassy expects you nine to six on weekdays: the work is in the evenings. Tab is the desk: what\'s ahead, the day\'s choices. Heat cools if you let it.',
  ] };
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
  if (action === 'menu') { if (open) { ui.closeOverlays(); if (open === 'menu') paused = false; } else { ui.openMenu(settings); } return; }   // (Esc out of the menu resumes, as its Resume does; out of J or C, a pause stays one)
  if (action === 'log') { if (open === 'log') { ui.closeOverlays(); } else if (!open) ui.openLog(state, settings); return; }
  if (action === 'sheet') { if (open === 'sheet') { ui.closeOverlays(); } else if (!open) ui.openSheet(state); return; }
  if (action === 'interact' && state?.talk) return;               // (in a conversation, F is nothing: its menu would open under the talk box)
  if (action === 'interact') {                                    // (F: what to do with whoever's within reach; the sim does it: sim/interact.js)
    if (open === 'interact') { ui.closeOverlays(); return; }
    if (state.fight) { if (open === 'sheet') ui.closeOverlays(); else if (!open) ui.openRead(state, state.fight.b); return; }   // (in a fight: your read of them, the fight's own: sim/fight.js)
    if (!open && !paused && !ui.openInteract(state, (id, them) => acts.push(`interact:${id}:${them.id}`))) ui.toast({ kind: 'instinct', text: 'Nobody within reach.' });
    return;
  }
  if (action === 'aid') {                                          // (H: tend your own wounds: sim/aid.js)
    const me = state.actors.find(a => a.who === state.player);
    if (open === 'aid') ui.closeOverlays(); else if (!open && me) ui.openAid(state, me.id, (key) => acts.push(`aid:${me.id}:${key}`));
    return;
  }
  if (action === 'mindmap') {                                      // (Tab: in the campaign's hub, the desk: sim/scenarios/campaign.js)
    if (open === 'mind') ui.closeOverlays();
    else if (!open && state.scenario.kind === 'campaign') ui.openMind(state, (cmd) => acts.push(`desk:${cmd}`));   // (Tab: the mind, src/ui/mind.js)
    return;
  }
  if (action === 'inventory') { if (open === 'inventory') ui.closeOverlays(); else if (!open) ui.openInventory(state, (cmd) => acts.push(`inv:${cmd}`)); return; }   // (I: what you carry)
  if (action === 'gun' && !open && !paused) acts.push('draw');     // (G: draw the next weapon carried, or put it away: sim/items.js)
  if (action === 'pause' && !open) paused = !paused;
  if (action === 'help') ui.toggleKeys();                           // ("?": the keys, shown or folded)
  if ((action === 'instinct' || action === 'use' || action === 'glance' || action === 'camera') && !open && !paused) acts.push(action);   // (P: a photograph, where a scene has a camera: sim/scenarios/watch.js)
  if ((action === 'hit' || action === 'grapple' || action === 'guard') && !open && !paused) acts.push(input.poll().run ? `${action}+` : action);   // (Shift held: an edge spent)
});
addEventListener('keydown', (e) => {                               // debug mode: the clock moves on
  if (!running || !settings.debug || ui.overlay() || e.repeat) return;
  if (e.code === 'BracketRight') skip(state, bus, HOUR);
  if (e.code === 'BracketLeft') skip(state, bus, 15 * MIN);
});
addEventListener('pagehide', () => autosave());
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { paused = true; autosave(); } });

// A sim error: told once (the console has it all; the save, exported, replays it), and the game goes on.
const told = new Set();
function broke(e) {
  console.error(e);
  if (told.has(e.message)) return;
  told.add(e.message);
  ui.toast({ kind: 'note', text: `Something in the game broke (${e.message}). It carries on; Esc → Save to a file, to report it.` });
}

// A photograph (sim/scenarios/watch.js, bus 'photo'): the frame as it's drawn, cropped round them,
// kept (the best of the evening) for the result paper.
let snapWanted = null, lastPhoto = null;
function snap() {
  const w = snapWanted; snapWanted = null;
  const cam = view?.camera, pts = w.ids.map(id => view.posOf(id)).filter(Boolean);
  if (!cam || !pts.length || (lastPhoto && lastPhoto.rank > w.rank)) return;
  const cv = view.canvas, k = cv.width / RES[0], cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const PW = 200, PH = 112, sx = RES[0] / 2 + (cx - cam.x) * 16, sy = RES[1] / 2 + (cz - cam.z) * 16 - 1.4 * 16;
  if (sx < 0 || sx > RES[0] || sy < 0 || sy > RES[1]) return;      // (off the picture: nothing of them to keep)
  // (the frame round them, kept inside the picture)
  const x0 = Math.max(0, Math.min(RES[0] - PW, sx - PW / 2)) * k, y0 = Math.max(0, Math.min(RES[1] - PH, sy - PH / 2)) * k;
  const out = document.createElement('canvas'); out.width = PW * 2; out.height = PH * 2;
  const g = out.getContext('2d'); g.imageSmoothingEnabled = false;
  try { g.drawImage(cv, x0, y0, PW * k, PH * k, 0, 0, out.width, out.height); lastPhoto = { url: out.toDataURL('image/png'), rank: w.rank }; } catch {}
}

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (running) {
    const live = !paused && !ui.overlay();
    if (live) {
      acc += dt;
      while (acc >= TICK_MS / 1000) {
        prev = new Map(state.actors.map(a => [a.id, [a.x, a.z, a.stride]]));
        try { step(state, { ...input.poll(), act: acts }, bus); } catch (e) { broke(e); }   // (a bug in a tick costs that tick, not the game)
        acts = [];
        acc -= TICK_MS / 1000;
      }
    }
    view.frame(state, prev, live ? acc / (TICK_MS / 1000) : 1, state.time.ms / 1000);
    if (snapWanted) snap();                                        // (right after the draw, while the buffer holds the frame)
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
  launch(newGame({ seed: Number(q.get('seed') ?? 1), scenario: q.get('play'), version: VERSION, autoplay, chapter: q.get('chapter'), city: q.get('city'), weather: WEATHER }), { hour: q.has('hour') ? Number(q.get('hour')) : null });
}
else if (q.has('lesson') && lessonOf(q.get('lesson'))) launch(newGame({ seed: Number(q.get('seed') ?? 1), lesson: q.get('lesson'), version: VERSION, city: q.get('city'), weather: WEATHER }));   // (a lesson of the tutorial, for shots and tests)
else showTitle();
requestAnimationFrame(frame);
