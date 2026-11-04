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
// rain-light, fog-extreme, dust-heavy-strong, frost, clear), with ?play or from the title. In the free walk,
// ?armour=heavy puts a plate carrier on you for the soft vest it gives (?armour=none, nothing). window.__tradecraft is
// the debug handle: { state, step(n, input), start(state or JSON), newGame(opts), save() (the JSON),
// skip(ms), autosave(), pause(on), view }.
import { newGame, start, step, skip } from './sim/game.js';
import { createBus } from './sim/bus.js';
import { toJSON, fromJSON } from './sim/state.js';
import { TICK_MS, HOUR, MIN, DAY, stampText, dateText, hourOfDay, calendar } from './sim/clock.js';
import { SCENARIOS } from './sim/scenarios/index.js';
import { haleCall } from './sim/hale.js';
import { options as shootOptions } from './sim/shooting.js';
import { newGun, newMag, isGun } from './sim/firearms.js';
import { wear as wearArmour } from './sim/armour.js';
import { candidates, legendFile, newCampaign, context, fold, heatWord, KINDS, LEVELS, levelOf, promote, goalOf, bookLessons, lessonsLeft, lessonBook } from './sim/campaign.js';
import { missionPlace } from './sim/places.js';
import { cityById, CITY_IDS, FIRST_TOUR_CITY } from './sim/cities/index.js';
import { shopWord } from './sim/shops.js';
import { price } from './sim/money.js';
import { LOSE_USD, LOSE_MIN } from './sim/taxi.js';
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
  newCampaign: (city = CITY_IDS[0]) => pickOfficer(city),
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
function pickOfficer(city = CITY_IDS[0], level = null) {
  const best = careerBest(), open = (k) => k === 0 || k <= best - 1 || settings.debug;
  level ??= open(1) ? 'handler' : 'junior';
  if (level === 'junior') city = FIRST_TOUR_CITY;                  // (a first tour is at its station: sim/cities/)
  const seed = randomSeed(), list = candidates(seed, city, level);
  home = null;
  ui.hideTitle();
  // (the legends: a fourth file, Tradecraft 95, a different one each time, debug mode or not: sim/campaign.js LEGENDS; the user, 2026-11-03)
  let n = 0;
  const show = () => {
    list[3] = legendFile(seed, city, level, n);
    ui.showCandidates(list, (i) => launch(newGame({ seed, scenario: 'campaign', version: VERSION, campaign: newCampaign(seed, list[i], city, level), weather: WEATHER })),
      city, { cities: level === 'junior' ? null : (c) => pickOfficer(c, level), back: () => showTitle(), level, another: () => { n++; show(); },
        levels: LEVELS.map((L, k) => ({ id: L.id, name: L.name, open: open(k), why: k ? `Opens when a game of yours reaches the rung above it${settings.debug ? ' (open: debug mode)' : ''}.` : null })), levelTo: (id) => pickOfficer(id === 'junior' ? FIRST_TOUR_CITY : CITY_IDS[0], id) });
  };
  show();
}

// The career's record across games (sim/campaign.js LEVELS): the highest rung any game reached.
const CAREER_KEY = 'tradecraft.career';
function careerBest() { try { return JSON.parse(localStorage.getItem(CAREER_KEY) ?? '{}').best ?? 0; } catch { return 0; } }
function reached(k) { try { if (k > careerBest()) localStorage.setItem(CAREER_KEY, JSON.stringify({ best: k, at: Date.now() })); } catch {} }

/**
 * The flat's telephone (sim/scenarios/campaign.js): Hale. Day one he offers the exercises, booked (bookCard()), or
 * straight in (the posting's brief); called back later, the exercises again, in a free evening. His words are
 * sim/hale.js haleCall()'s: to a file from the basement, not a new officer's.
 */
function openCall(s, id) {
  if (state !== s) return;
  const c = s.campaign, first = id === 'hale';
  ui.showCall({ who: 'HALE', ...haleCall(c, cityById(c.posting.city).name, first) }, (key) => {   // (his words: sim/hale.js; to a file from the basement, he knows who he's talking to)
    if (key === 'book') bookCard(s, first && !c.done.length && c.posting.deskFrom === undefined);
    else if (key === 'begin') ui.showPaper(postingPaper(c), () => {});
  });
}

/**
 * Hale's exercises to book (the user, 2026-11-04: "should book the tutorial as an assignment we have to move to"):
 * all of them, or one at a time till you've enough (sim/campaign.js bookLessons(): settling, the first call's, the
 * days before your desk; else a free evening); then what's booked, on a paper, and (day one) the posting's brief.
 */
function bookCard(s, settling, booked = []) {
  if (state !== s) return;
  const c = s.campaign, left = lessonsLeft(c);
  const brief = () => { if (settling) ui.showPaper(postingPaper(c), () => {}); };
  const done = () => {
    if (!booked.length) return brief();
    ui.showPaper({ stamp: 'BOOKED', title: 'HALE\'S EXERCISES', lines: [
      ...booked.map(a => `${stampText(a.from)}: ${lessonBook(a.lesson)?.title ?? 'an exercise'}. ${missionPlace(c, a)?.label ?? ''}.`),
      settling ? `Your desk at the embassy from ${dateText(c.posting.deskFrom * DAY)}, and the station's work after it.` : 'Like any assignment: be there at its hour. Ahead, on the mind (Tab), has them.'] }, brief);
  };
  if (!left.length) return done();
  const list = [...(left.length > 1 ? [{ key: 'all', label: `All ${left.length}, ${settling ? 'a day each from tomorrow' : 'in the first free evenings'}` }] : []),
    ...left.map(L => ({ key: L.id, label: L.title })), { key: 'done', label: booked.length ? 'That\'s enough' : 'None, after all' }];
  ui.openChoices('HALE', settling ? 'THE EXERCISES, BEFORE THE DESK' : 'AN EVENING OF THE EXERCISES', list, (key) => {
    if (key === 'done') return done();
    booked.push(...bookLessons(c, key === 'all' ? left.map(L => L.id) : [key], s.time.ms, settling));
    if (key === 'all') return done();
    setTimeout(() => bookCard(s, settling, booked), 0);
  });
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
  if (!state || !running || home) return;                          // (a lesson from the flat's telephone: the campaign stays the autosave, not the lesson)
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
  if (!s.autoplay) s.$reflexes = true;                              // (the played game's: time stops for a moment seen coming, sim/reflex.js)
  if ((s.scenario.kind === 'walk' && !s.tutor && !s.campaign) || (settings.debug && q.has('gun') && !s.campaign)) armDebug(s);   // (the free walk, the sandbox: a pistol on you to try the guns (the user, 2026-11-03: "give us a gun in free walk"), and a soft vest under your top (?armour=heavy a plate carrier); elsewhere debug mode and ?gun; never in a campaign, where guns are rare: sim/firearms.js)
  lastPhoto = null; snapWanted = null;
  bus = createBus();
  view = createView({ parent: ui.frame, bus, month: () => calendar(s.time.ms).month });   // (the season: the trees' leaves, the hedges', the fallen ones)
  ui.frame.prepend(view.canvas);
  ui.fit();                                                        // (the picture to the window)
  bus.on('log', (e) => ui.toast(e));
  bus.on('read', (who) => ui.openRead(state, who, { aid: (id) => acts.push(`interact:aid:${id}`) }));   // (your read; first aid from it, if they're in reach: sim/interact.js)
  bus.on('aid', (id) => ui.openAid(state, id, (key) => acts.push(`aid:${id}:${key}`)));   // (first aid for someone at hand: sim/aid.js)
  bus.on('autosave', () => autosave());
  // (the campaign: an assignment taken at the desk, launched after this tick; papers the days bring, one after another)
  bus.on('assignment', (id) => setTimeout(() => launchAssignment(s, id), 0));
  bus.on('papers', (list) => showPapers(list));
  bus.on('call', (id) => setTimeout(() => openCall(s, id), 0));    // (the flat's telephone: Hale)
  bus.on('desk-open', () => setTimeout(() => ui.openMind(s, (cmd) => acts.push(`desk:${cmd}`), 'ahead'), 0));
  bus.on('chief', (list) => setTimeout(() => ui.openChoices('CHIEF', 'THE CHIEF\'S OFFICE', list, (key) => acts.push(`desk:chief:${key}`)), 0));   // (what's on, a sidearm, a vest: sim/armoury.js)   // (the chief's office at the embassy: what's on, the mind's first leaf)
  bus.on('door', (list) => setTimeout(() => ui.openChoices('DOOR', 'OUT: THE COAT, THE UMBRELLA', list, (key) => acts.push(`desk:door:${key}`)), 0));   // (the flat's door: what to wear out: sim/clothes.js doorWays())
  bus.on('table', (list) => setTimeout(() => ui.openChoices('TABLE', 'THE KITCHEN TABLE', list, (key) => acts.push(`desk:table:${key}`)), 0));   // (the flat's kitchen table: a meal, or a gun's work: sim/gunwork.js)
  bus.on('wardrobe', (list) => setTimeout(() => list.length ? ui.openChoices('WARDROBE', 'WHAT TO WEAR, WHAT TO KEEP', list, (key) => acts.push(`desk:dress:${key}`)) : ui.closeOverlays(), 0));   // (the flat's wardrobe: sim/clothes.js)
  bus.on('basin', (list) => setTimeout(() => ui.openChoices('BASIN', 'WASH, OR THE CABINET', list, (key) => acts.push(`desk:basin:${key}`)), 0));   // (the flat's basin, and the cabinet over it: sim/clothes.js)
  bus.on('reading', (c) => setTimeout(() => { if (state === s) ui.openBooks(c, (key) => acts.push(`read:${key}`)); }, 0));   // (the shelf: one row a book, src/ui/ui.js openBooks())   // (a book, ten minutes at a time: sim/reading.js)
  bus.on('bed', (list) => ui.openChoices('BED', 'HOW LONG?', list, (key) => acts.push(`desk:${key}`)));   // (the flat's bed by day: sim/scenarios/campaign.js)
  bus.on('photo', (w) => { snapWanted = w; });                    // (sim/scenarios/watch.js: the frame, at the next draw)
  bus.on('shop', ({ shop, ways }) => ui.openChoices('SHOP', shopWord(shop).replace(/^the /, '').toUpperCase(), ways.map(w => ({ key: w.id, label: w.label, off: w.off ?? undefined })), (key) => acts.push(`shop:${key}`)));   // (sim/shops.js)
  // (sim/buses.js; stood by the doors, off as they close: the same stops, a second card)
  bus.on('reflex', (R) => ui.openChoices('REFLEX', R.title, R.options.map(o => ({ key: o.key, label: o.label })), (key) => acts.push(`reflex:${key}`)));   // (a moment seen coming: sim/reflex.js)
  bus.on('bus', ({ line, towards, list }) => {
    const card = (doors) => ui.openChoices('BUS', doors ? `THE ${line}: OFF AS THE DOORS CLOSE` : `THE ${line}, FOR ${String(towards).toUpperCase()}: WHERE TO?`, [
      ...list.map(d => ({ key: doors ? `${d.id}:doors` : d.id, label: `${d.label.charAt(0).toUpperCase() + d.label.slice(1)} · ${price(state, d.fare)}` })),
      ...(doors ? [] : [{ key: 'doors', label: 'Stand by the doors, and step off as they close ▸' }]),
    ], (key) => (key === 'doors' ? card(true) : acts.push(`bus:${key}`)));
    card(false);
  });
  bus.on('metro', (at) => ui.openTube(state, at, (key) => acts.push(`metro:${key}`)));   // (the network's map: src/ui/tubemap.js; sim/metro.js)
  bus.on('police', ({ line, ways }) => { if (!ui.overlay()) ui.openChoices('POLICE', line, ways, (key) => acts.push(`police:${key}`)); });   // (stopped: sim/police.js)
  // (sim/taxi.js; the fare, sim/money.js; the long way round, losing anyone behind: the same places, a second card)
  bus.on('taxi', (list) => {
    const card = (lose) => ui.openChoices('TAXI', lose ? 'THE LONG WAY' : 'WHERE TO?', [
      ...list.map(d => ({ key: lose ? `${d.id}:lose` : d.id, label: `${d.label.charAt(0).toUpperCase() + d.label.slice(1)} · ${price(state, d.fare + (lose ? LOSE_USD : 0))}` })),
      ...(lose ? [] : [{ key: 'lose', label: `The long way round, losing anyone behind us (${price(state, LOSE_USD)} and ${LOSE_MIN} minutes more) ▸` }]),
    ], (key) => (key === 'lose' ? card(true) : acts.push(`taxi:${key}`)));
    card(false);
  });
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
    // (the hub's own end, the posting over: the career's record kept (CAREER_KEY); promoted, the station of your own chosen here;
    // no way back to a posting that's over)
    const c = state.campaign, over = kind === 'campaign' && state.scenario.outcome;
    if (over) reached(levelOf(c.posting.level) + (over === 'promoted' || over === 'completed' ? 1 : 0));
    const next = over === 'promoted' ? (city) => launch(newGame({ seed: randomSeed(), scenario: 'campaign', version: VERSION, campaign: promote(c, city), weather: WEATHER })) : null;
    return ui.showResult(state, { back: over ? null : () => backToPosting(state), title: async () => { await autosave(); stop(); showTitle(); }, photo: lastPhoto?.url, next }, settings);
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
  // (Hale's exercise: its lesson's scene, on the posting's streets at its hour, Hale in your ear: sim/tutorial/, sim/campaign.js context())
  if (a.kind === 'lesson') return launch(newGame({ seed: randomSeed(), lesson: a.lesson, version: VERSION, campaign: c, context: context(c, a), weather: WEATHER }));
  launch(newGame({ seed: randomSeed(), scenario: KINDS[a.kind].scenario, version: VERSION, campaign: c, context: context(c, a), weather: WEATHER }));
}

/** Debug mode: the player has a gun on them (the station's SIG, loaded, a spare magazine and a box of rounds), if they've none. */
function armDebug(s) {
  const p = s.people?.[s.player];
  // (body armour to try: a soft vest under the top, once; ?armour=heavy a plate carrier over it, ?armour=none none: sim/armour.js)
  const want = q.get('armour') ?? 'light';
  if (p && !p.$armoured) { p.$armoured = true; if (want === 'none') delete p.armour; else if (!p.armour || q.has('armour')) wearArmour(p, want === 'heavy' ? 'heavy' : 'light', { color: 0x545e40 }); }
  if (!p || isGun(p.hand) || (p.items ?? []).some(isGun) || (p.stash ?? []).some(isGun)) return;
  (p.items ??= []).push(newGun(p, 'p229'), newMag(p, 'p229', 13));
  p.rounds = { ...(p.rounds ?? {}), '9x19': (p.rounds?.['9x19'] ?? 0) + 20 };
}

/** An assignment over: its outcome into the campaign, the debrief, and back to the hub where it left you. */
function backToPosting(s) {
  const c = s.campaign, a = c.assignments.find(x => x.id === s.assignment);
  const me = s.actors.find(x => x.who === s.player);
  const paper = a ? fold(c, a, s.scenario, s.people[s.player], s.time.ms, Object.values(s.heat)[0]) : { title: 'BACK', lines: [] };
  // (from a trip abroad: the flight home, the flat at home next morning: sim/campaign.js foldTrip())
  c.where = me && !a?.trip ? { row: me.row ?? s.map.row, x: me.x, z: me.z } : null;
  c.now = a?.home ?? s.time.ms;
  ui.showPaper({ stamp: 'DEBRIEF', title: paper.title, lines: paper.lines, note: `Heat: ${heatWord(c.posting.heat)}. Intelligence: ${c.posting.intelligence}.` },
    () => launch(newGame({ seed: randomSeed(), scenario: 'campaign', version: VERSION, campaign: c, weather: WEATHER })));
}

/** Papers the days brought (pay, the week's review), one after another. */
function showPapers(list) {
  const next = () => { const p = list.shift(); if (p) ui.showPaper({ stamp: { pay: 'PAY', review: 'REVIEW', news: 'NEWS', over: 'CABLE', cable: 'CABLE' }[p.kind] ?? 'NOTE', title: p.title, lines: p.lines }, next); };
  next();
}

/** The posting's brief, the paper before day one. */
function postingPaper(c) {
  const p = c.posting, me = c.character, K = cityById(p.city);
  // (a first tour's: its station's words, sim/cities/ firstTour)
  if (p.level === 'junior') return { stamp: 'FIRST TOUR', title: `STATION ${K.name.toUpperCase()}`, go: 'Begin the tour', lines: [
    `${me.name}: ${p.job}. ${K.station.firstTour.paper}, and${me.legend ? ', for the record,' : ''} its most junior officer.`,
    `The station wants ${p.goal}. ${K.station.firstTour.work}: ${p.targets.map(t => t.name).join(' and ')}.`,
    `Twice in the tour another station will borrow you for a couple of days: ${p.trips.map(t => `${cityById(t.city).name}`).join(', then ')}. Flown out the morning of it, home the morning after.`,
    `Do it well (intelligence ${goalOf(p)}), keep the heat down, and the next posting is a station of your own.`,
    'The embassy expects you nine to six on weekdays: the work is in the evenings, where it happens. Tab is your mind: what\'s ahead and where, the city as you know it. You get there yourself.',
  ] };
  return { stamp: 'POSTING', title: `STATION ${K.name.toUpperCase()}`, go: 'Begin the posting', lines: [
    `${me.name}: ${p.job}. Diplomatic immunity: caught, you'd be expelled. The people you run wouldn't be so lucky.`,
    `The station wants ${p.goal}. Every meeting, every tail, is a step toward it.`,
    `Your network: ${p.assets.map(s => `${s.codename}, ${s.role}, in it for ${s.motive}`).join('; ')}.`,
    `Watched: ${p.targets.map(t => `${t.name}, ${t.what}`).join('; ')}.`,
    'The embassy expects you nine to six on weekdays: the work is in the evenings, where it happens. Tab is your mind: what\'s ahead and where, the city as you know it. You get there yourself. Heat cools if you let it.',
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
  if (action === 'sheet') { if (open === 'sheet' || open === 'read') { ui.closeOverlays(); } else if (!open) ui.openSheet(state); return; }   // (C closes your read too: its foot says so)
  if (action === 'interact' && state?.talk) return;               // (in a conversation, F is nothing: its menu would open under the talk box)
  if (action === 'interact') {                                    // (F: what to do with whoever's within reach; the sim does it: sim/interact.js)
    if (open === 'interact') { ui.closeOverlays(); return; }
    if (state.fight) { if (open === 'read') ui.closeOverlays(); else if (!open) ui.openRead(state, state.fight.b); return; }   // (in a fight: your read of them, the fight's own: sim/fight.js)
    if (!open && !paused && !ui.openInteract(state, (id, them) => acts.push(`interact:${id}:${them.id}`))) ui.toast({ kind: 'instinct', text: 'Nobody within reach.' });
    return;
  }
  if (action === 'aid') {                                          // (H: tend your own wounds: sim/aid.js; over your read of someone, first aid for them)
    const me = state.actors.find(a => a.who === state.player);
    if (open === 'aid') ui.closeOverlays();
    else if (open === 'read') ui.readAid();
    else if (!open && me && paused) ui.openAid(state, me.id, (key) => acts.push(`aid:${me.id}:${key}`));   // (paused, no tick to take a look in: the card on the last one)
    else if (!open && me) acts.push(`tend:${me.id}`);                // (a look at yourself first, the sim's: sim/diagnosis.js; it opens the card)
    return;
  }
  if (action === 'mindmap') {                                      // (Tab: in the campaign's hub, the desk: sim/scenarios/campaign.js)
    if (open === 'mind') ui.closeOverlays();
    else if (!open && state.scenario.kind === 'campaign' && state.fight) ui.toast({ kind: 'instinct', text: 'Not with a fight on your hands.' });
    else if (!open && state.scenario.kind === 'campaign') ui.openMind(state, (cmd) => acts.push(`desk:${cmd}`));   // (Tab: the mind, src/ui/mind.js)
    return;
  }
  if (action === 'inventory') { if (open === 'inventory') ui.closeOverlays(); else if (!open) ui.openInventory(state, (cmd) => acts.push(`inv:${cmd}`)); return; }   // (I: what you carry)
  if (action === 'gun' && !open && !paused) acts.push('draw');     // (G: draw the next weapon carried, or put it away: sim/items.js)
  if (action === 'aim' && !open && !paused) acts.push('aim');      // (X: shooting, in stop motion, in or out: sim/shooting.js)
  if (action === 'pause' && !open) paused = !paused;
  if (action === 'help') ui.toggleKeys();                           // ("?": the keys, shown or folded)
  if ((action === 'instinct' || action === 'use' || action === 'glance' || action === 'camera') && !open && !paused) acts.push(action);   // (P: a photograph, where a scene has a camera: sim/scenarios/watch.js)
  if ((action === 'hit' || action === 'grapple' || action === 'guard') && !open && !paused) acts.push(input.poll().run ? `${action}+` : action);   // (Shift held: an edge spent)
});
addEventListener('keydown', (e) => {                               // (shooting's choice, time standing still: a digit, a step: sim/shooting.js options())
  if (!running || ui.overlay() || paused || e.repeat || state?.shoot?.phase !== 'choose') return;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code), o = m && shootOptions(state)[Number(m[1]) - 1];
  if (o) { e.preventDefault(); acts.push(`shoot:${o.key}`); return; }
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && state.shoot.pick) { e.preventDefault(); acts.push(`shoot:aim:${state.shoot.pick}`); return; }   // (Enter: aim at the one the brackets are round)
  // (the move keys, by where they sit: left and right the target across the picture, up and down the head, the body, the legs)
  const mv = { KeyA: 'pick:-1', ArrowLeft: 'pick:-1', KeyD: 'pick:1', ArrowRight: 'pick:1', KeyW: 'part:-1', ArrowUp: 'part:-1', KeyS: 'part:1', ArrowDown: 'part:1' }[e.code];
  if (mv) { e.preventDefault(); acts.push(`shoot:${mv}`); }
});
// Shooting with the mouse (the user, 2026-11-03: "Make aiming more natural … but no list"): over someone in the
// picture, the brackets go on them (sim/shooting.js 'pick='); a click aims at them, and a click on whoever's aimed at fires.
const shooting = () => running && state?.shoot?.phase === 'choose' && !ui.overlay() && !paused;
addEventListener('mousemove', (e) => {
  if (!shooting()) return;
  const key = ui.pickAt(state, view, e.clientX, e.clientY);
  if (key && key !== state.shoot.pick) acts.push(`shoot:pick=${key}`);
});
addEventListener('mousedown', (e) => {
  if (!shooting() || e.button !== 0) return;
  const key = ui.pickAt(state, view, e.clientX, e.clientY);
  if (!key) return;
  e.preventDefault();
  acts.push(state.shoot.aim?.key === key ? 'shoot:fire' : `shoot:aim:${key}`);
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
    if (live && state.$reflex && !acts.some(k => String(k).startsWith('reflex:'))) acts.push('reflex:none');   // (the reflex's card closed without a choice: nothing, and time goes on: sim/reflex.js)
    if (live) {
      acc += dt;
      while (acc >= TICK_MS / 1000) {
        prev = new Map(state.actors.map(a => [a.id, [a.x, a.z, a.stride]]));
        try { step(state, { ...input.poll(), act: acts, frame: ui.frameBox(view) }, bus); } catch (e) { broke(e); }   // (a bug in a tick costs that tick, not the game)
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
