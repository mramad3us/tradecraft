// TRADECRAFT sim: mechanic test 1, tailing a target (DESIGN.md: Moment to moment, Tailing; Road to 0.1.0).
//
// Gennady Orlov, once a GRU officer, now in procurement, leaves his office and walks to a meeting on a
// bench ten streets and more away (MEET_ROWS): an agent (sim/agents.js) on a route planned across the
// city (sim/city.js), with a careful man's habits on the way (sim/habits.js: looks back, windows, a
// shop, glances at the zebras and the lanes' mouths). The player follows: by hand, or in autoplay as
// the game's own follower (state.autoplay). An evening (EVENINGS) sets the hour, so the light and the
// crowd, and his mood: a wary man takes a roundabout way, checks more often and gives less warning.
// The test ends when the meeting is seen (success), or he makes the tail, or he's lost for good, or
// the meeting is missed or blown.
//
// It's played through perception (sim/perception.js): the player sees what their character's eyes
// take in, and so does he.
//   - **His checks.** Between stretches of walking he checks for a tail: a look back, a shop window's
//     glass, coming out of a shop, crossing, and once he's seen someone, doubling back. Most come with
//     a tell first (TELL_S: he slows, drifts to the glass, glances at the kerb), and a trained eye
//     can read it: an Awareness roll, if he's in view, and the instinct says what's coming. The check
//     itself is a scan: for its length he looks a way, and the first moment we're in his sight (his
//     cone, his reach in this light, no wall between) he rolls Pathfinding against our Deception.
//     The modifiers are our choices (exposure()): distance, the other pavement, people about us, the
//     light we stand in, running, stopping when he stops, standing about with nothing to do, staring
//     at him, and what we were doing when he looked (a shop window, a bench, a shoelace, waiting to
//     cross). He wins: a sighting. The first sets him dry-cleaning; the second, he's made us.
//   - **His alertness** (0–100) rises with what he half-notices and falls slowly; it brings his checks
//     closer together and sharpens them, and the instinct reads it.
//   - **Keeping him.** The marker is over whom we take for him. While he's in view beyond KEEP_M with
//     people round him, we roll Tracking to keep him (every KEEP_EVERY_S) against the distance, those
//     people and the dark; failing it near a man who looks like him (his twins, TWINS grey coats and hats about the
//     street), we follow the wrong man until we're close enough to see it (REVEAL_M). Out of view the
//     marker stays where we last saw him; lost, we look for him (Awareness, every FIND_EVERY_S, the
//     grey coats in view, nearest first: the wrong one may pass). Not seen for LOST_S, he's gone.
//   - **The instinct** speaks all the time, the voice of training (instinct()): the gap and its
//     trend, his tells, the light, the crowd, crossing, where to stand. T does what it offers: look in
//     a shop window (its glass shows the street behind), sit on a bench, tie a shoelace, cross here.
//   - **The meeting:** he sits on a boulevard bench and a man in a blue beanie joins him. Both in
//     view, within WITNESS_M, for WITNESS_S seconds: seen, and a lead. Closer than CONTACT_M the
//     contact (a professional) gets a look of his own.
// Every roll goes to the log with a line of flavour. The scenario's progress is plain data in
// state.scenario, read by the UI (the marker, the instinct, the brief and the result).
import { at, TICK_MS } from '../clock.js';
import { handler, sheet, seedFrom } from '../people.js';
import { heatKey, addHeat } from '../heat.js';
import { say } from '../log.js';
import { skill } from '../skills.js';
import { opposed, check } from '../checks.js';
import { range, int, chance, pick, weighted, hash } from '../rng.js';
import { act, coverHere, crossingAt, crossingNear, say1 } from '../acts.js';
import { LANES, Z, SECTION_M } from '../map/street.js';
import { near, sectionAt } from '../world.js';
import { planRoute, routeFrom, sectionOf, pointAt, LINE } from '../city.js';
import { withHabits, withEnd } from '../habits.js';
import { makeAgent, setRoute, follow as followTarget, rowOf, onMap } from '../agents.js';
import { lightBand } from '../light.js';
import { eyes, sees, seesActor, inView, lightHere, openAir, wrap } from '../perception.js';

export const KEEP_M = 22;
export const KEEP_EVERY_S = 6;
export const FIND_EVERY_S = 2;
export const REVEAL_M = 9;
export const LOST_S = 90;
export const WITNESS_M = 20;
export const WITNESS_S = 12;
export const CONTACT_M = 6;
export const MEET_ROWS = [10, 12];                                  // how many streets away his bench is
export const MEET_EAST_M = [150, 550];                             // and how far along, east or west
export const TELL_S = { calm: [1.6, 2.6], wary: [1.0, 1.8] };
export const SCAN_M = { look: 45, window: 25, exit: 30, cross: 32, double: 22 };
export const TWINS = 3;
const RANK = { calm: 0, note: 1, warn: 2, urgent: 3 };
export const HOLD_S = { calm: 7, note: 5, warn: 3, urgent: 2 };      // the least time the instinct's line holds, by tone
export const TWIN_CHANCE = 0.02;                                 // a second, for each twin not about
const TPS = 1000 / TICK_MS;

// Evenings: the hour (light and crowd) and his mood. "Again, another evening" draws one.
export const EVENINGS = [
  { id: 'dusk', h: 16, m: 45, wary: false, w: 3, light: 'The light\'s going.' },
  { id: 'night', h: 19, m: 40, wary: false, w: 2, light: 'It\'s dark, and the lamps are on.' },
  { id: 'lunch', h: 13, m: 5, wary: false, w: 1.5, light: 'Broad daylight, and the lunchtime crowd.' },
  { id: 'wary', h: 17, m: 30, wary: true, w: 1.5, light: 'Dark already, and word is he\'s been jumpy this week.' },
];

const ORLOV_LOOK = { skin: 'light', hair: { style: 'short', color: 0x8f96a6 }, hat: { kind: 'fedora', color: 0x353947 },
  top: { kind: 'coat', color: 0x6a7182, trim: 0x353947, belt: 0x353947 }, legs: 0x23252f, shoes: 0x14151c, carry: 'briefcase' };
const CONTACT_LOOK = { skin: 'light', hair: { style: 'short', color: 0x47302a }, hat: { kind: 'beanie', color: 0x283f6b, band: 0x1b2541 },
  top: { kind: 'coat', color: 0x23252f, trim: 0x14151c }, legs: 0x283f6b, shoes: 0x14151c, carry: 'paper' };
// His twins: a grey coat and a hat, from a few paces off much like him. Each has the one thing that
// gives him away up close.
const TWIN_LOOKS = [
  [{ ...ORLOV_LOOK, top: { kind: 'coat', color: 0x6a7182, trim: 0x353947 }, carry: null }, 'no briefcase'],
  [{ ...ORLOV_LOOK, hat: { kind: 'fedora', color: 0x23252f }, top: { kind: 'coat', color: 0x4c5262, trim: 0x353947, belt: 0x353947 }, hair: { style: 'short', color: 0x47302a } }, 'a darker coat, and twenty years younger'],
  [{ ...ORLOV_LOOK, hat: { kind: 'cap', color: 0x353947 } }, 'a cap, not a fedora'],
  [{ ...ORLOV_LOOK, top: { kind: 'coat', color: 0x8f96a6, trim: 0x4c5262 }, carry: 'paper', glasses: 'specs' }, 'glasses, and a newspaper where the briefcase should be'],
];

const LINES = {
  look: [['He stops and looks back along the street. His eyes slide over you and on.', 'He turns to check the street behind him. You\'re a coat among coats.', 'A look over the shoulder. Nothing in it for him.'],
    ['He looks back, and his eyes stop on you. Half a second. Long enough.', 'He turns. You\'re the one person not going anywhere in particular, and he notices.']],
  window: [['He studies a shop window: not the goods, the street behind him in the glass. You\'re not in it.', 'He takes an interest in the reflection, not the display. It shows him nothing.'],
    ['In the glass of the window he finds you. You can tell by how his shoulders set.']],
  exit: [['He comes out and takes in the street, left, right. You\'re part of it.', 'Out of the shop, a glance each way. The street gives nothing away, you included.'],
    ['He comes out of the shop and looks straight at you.']],
  cross: [['He crosses with a glance each way, as his mother taught him and someone else trained him.', 'A glance up and down the road as he crosses. You\'re furniture.'],
    ['Halfway across, his glance catches on you.']],
  double: [['He turns on his heel and walks back the way he came, past you. You don\'t exist.', 'He doubles back, the old trick. It finds nothing.'],
    ['He doubles back, and you\'re face to face. He\'s seen that face before today.']],
};
const NAG = ['Something nags at him. He walks on, but he\'s thinking about it.', 'He looks a moment longer than he needs to, then walks on.'];
const GONE = 'He\'s gone. Somewhere in Moscow a man in a grey coat is keeping his appointment, and you\'ll never know with whom.';
const MISSED = 'They part. Whatever passed between them, you weren\'t there to see it.';
const MADE = 'That\'s twice. He\'s made you. He doesn\'t run; he turns for home, and the evening\'s over.';
const SPOOKED = 'He stops dead, looks at nothing for a long moment, and turns back the way he came. Something spooked him. Maybe you. The evening\'s over either way.';
const lostLines = ['The crowd thickens and the grey coat goes into it. When it thins, he isn\'t there.', 'He was further than you thought, and then he wasn\'t anywhere.', 'A knot of people at the corner, and when it loosens he\'s gone from it.'];
const foundLines = ['There. Fedora, briefcase, that walk.', 'Grey coat, a little way on. Him.', 'You find him again by the hat.'];
const wrongLines = ['There: grey coat, the hat. You fall in behind him.', 'A grey coat going east. Him, surely.'];
const SHOPS = { pharmacy: 'the pharmacy', grocery: 'the grocer\'s', cafe: 'the café', flowers: 'the florist\'s', bakery: 'the bakery', books: 'the bookshop',
  optician: 'the optician\'s', bank: 'the bank', tobacco: 'the tobacconist\'s', exchange: 'the exchange booth', bar: 'the bar', clothes: 'the clothes shop',
  shoes: 'the shoe shop', watches: 'the watchmaker\'s', phones: 'the phone shop', shawarma: 'the shawarma stall', beer: 'the beer shop', deli: 'the gastronom', restaurant: 'the restaurant' };

export const tail = {
  name: '1. Tailing a target',
  test: true,
  about: 'Follow a former GRU officer through Moscow to his meeting. Don\'t be seen twice. Each evening is different.',
  brief(state) {
    const ev = eveningOf(state);
    return {
      title: 'TAILING: GENNADY ORLOV',
      body: [
        'Gennady Orlov, 54. Deputy head of procurement at a defence plant. Twenty years ago an officer of the GRU, and he hasn\'t forgotten all of it.',
        'Some days he leaves the office and walks somewhere he doesn\'t tell his wife about. Grey coat, grey fedora, a briefcase. Plenty of men in Moscow wear a grey coat.',
        'Follow him and see whom he meets. He will check for a tail. If he sees the same face twice he\'ll go home, and we won\'t get this chance again.',
        `${ev.light} Keep him in sight, keep people between you, keep his pace, and don't stop when he stops. Your instinct will talk you through it.`,
      ],
      footer: `Station Moscow · Tuesday 3 November 2026 · ${hhmm(ev.h, ev.m)}`,
      keys: [['instinct', 'does what your instinct offers'], ['slow', 'held: stroll, to keep his pace'], ['watch', 'held: stop and look, the move keys turning your eyes'], ['log', 'the log']],
    };
  },

  setup(state) {
    const r = state.rng;
    const ev = weighted(r, EVENINGS.map(e => [e, e.w]));
    state.time.ms = at(2026, 11, 3, ev.h, ev.m);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.heat[heatKey('embassy', 'ru')] = 20;
    const me = handler(r);
    state.people[me.id] = me;
    state.player = me.id;
    state.people.orlov = sheet({ id: 'orlov', name: 'Gennady Orlov', sex: 'm', cls: 'spook', os: 20,
      skills: { pathfinding: [10, 0], awareness: [8, 1], deception: [8, 0], social: [5, 1] }, langs: { ru: 'native', en: 'basic' }, look: ORLOV_LOOK, persistent: true });
    state.people.contact = sheet({ id: 'contact', name: 'the man in the blue beanie', sex: 'm', cls: 'spook', os: 30,
      skills: { pathfinding: [10, 2], awareness: [10, 2], deception: [10, 1] }, langs: { ru: 'native' }, look: CONTACT_LOOK, persistent: true });
    const looks = TWIN_LOOKS.slice();
    for (let i = 0; i < TWINS; i++) {
      const [look, tell] = looks.splice(int(r, looks.length), 1)[0];
      state.people[`twin${i}`] = { ...sheet({ id: `twin${i}`, name: 'a man in a grey coat', sex: 'm', look, skills: { awareness: [2, 0] } }), tell };
    }
    state.map = { kind: 'street', seed: seedFrom(r), row: 0, i0: null, i1: null, crowd: 1 };
    const seed = state.map.seed;
    // His office: a door near the middle of the street.
    const door = [0, 1].flatMap(i => sectionOf(seed, 0, i).doors).find(d => d.x > 14 && d.x < 26 && d.kind !== 'arch' && d.z === Z.front) ?? { x: 20 };
    // His bench: ten streets and more away, a few hundred metres along.
    const dir = chance(r, 0.6) ? -1 : 1, row = dir * (MEET_ROWS[0] + int(r, MEET_ROWS[1] - MEET_ROWS[0] + 1));
    const along = door.x + (chance(r, 0.7) ? 1 : -1) * range(r, ...MEET_EAST_M);
    const bench = benchNear(seed, row, along);
    const meet = { row, x: bench.seats[0], z: 12.96, seat2: bench.seats[1], place: null };
    // The way there, his way: a little roundabout always; a wary man much more.
    const route = withEnd(withHabits(seed, planRoute(seed, { row: 0, x: door.x, z: Z.front + 0.3 }, meet, { walker: hash(seed, 'orlov'), evasive: ev.wary ? 4 : 1, rng: r }), r, ev.wary ? 'wary' : 'calm'),
      { kind: 'meet', ticks: 75 * TPS, face: 'down', gait: 'sit' });
    route.stops.unshift({ kind: 'leave', s: 0, ticks: 2 * TPS, face: 'down' });
    const t = makeAgent(state, { who: 'orlov', row: 0, x: door.x, z: Z.front + 0.3, speed: range(r, 1.2, 1.4), f: range(r, -0.6, 0.6), face: 'down' });
    setRoute(state, t, route);
    // We wait on his pavement, behind the way he'll go: his first way along the street.
    const first = route.pts.find(p => Math.abs(p.x - door.x) > 3), dirX = first ? Math.sign(first.x - door.x) : 1;
    const mePlace = { id: 'a0', who: me.id, seed: null, row: 0, x: door.x - dirX * range(r, 17, 22), z: LINE.F, vx: 0, vz: 0, face: dirX > 0 ? 'right' : 'left', head: dirX > 0 ? 0 : Math.PI, gait: 'idle', stride: 0, stuck: 0, ai: null };
    state.actors.unshift(mePlace);
    state.scenario = {
      kind: 'tail', evening: ev.id, wary: ev.wary, phase: 'tail', target: t.id, contact: null, twins: [], meet,
      marked: t.id, lastSeen: { row: 0, x: t.x, z: t.z, ms: state.time.ms }, lastSeenT: state.time.ms, unseenS: 0, keepS: 0, findS: 0, startX: door.x,
      alert: ev.wary ? 25 : 0, sightings: [], scan: null, lastScanMs: null, tell: null, shop: null, warned: 0, mixups: 0, stillS: 0, mirrorMs: -1e12, gap: [],
      witnessS: 0, meetS: 0, closest: 1e9, farthest: 0, prompt: null, outcome: null, lead: null, rolls: 0, began: state.time.ms, turn: null,
      streets: route.rows, routeM: Math.round(route.length),
    };
    // Autoplay: the player's character is the game's own follower, 20 m back in his footsteps.
    if (state.autoplay) {
      Object.assign(mePlace, { ai: { kind: 'agent', route: null, s: 0, stop: 0, wait: 0, speed: 1.45, f: 0, f0: 0 } });
      followTarget(state, mePlace, t, state.autoplay.keep ?? 20);
    }
    say(state, null, { kind: 'note', text: `${me.name}. ${hhmm(ev.h, ev.m)}, on the pavement down from Orlov's office. ${ev.light}` });
  },

  anchors(state) {
    const t = actorOf(state, state.scenario.target);
    return t && onMap(state, t) ? [t.x] : [];
  },

  /** On another street: what we knew of where he was is of the last one. */
  mapChanged(state) {
    const sc = state.scenario;
    sc.gap = [];
  },

  /** His stops (sim/agents.js): the tells, the checks, the shop, the bench; and ours, in autoplay. */
  onStop(state, a, stop, phase, bus) {
    const sc = state.scenario;
    if (a.who === 'orlov') return orlovStop(state, a, stop, phase, bus);
    if (a.who === 'contact' && phase === 'end') setRoute(state, a, planRoute(state.map.seed, { row: rowOf(state, a), x: a.x, z: a.z }, { row: rowOf(state, a), x: a.x + 70, z: LINE.P }));
    if (a.who === state.player) {
      if (phase === 'start') a.ai.cover = { what: stop.kind, since: state.time.ms };
      if (phase === 'end') { a.ai.cover = null; a.ai.hold = 0; }
    }
  },

  /** T: do what the instinct offers. E tapped: a glance back, which he may catch. */
  act(state, bus, action) {
    const sc = state.scenario, me = playerOf(state);
    if (!me || sc.outcome) return;
    if (action === 'glance') return glanced(state, bus, me);
    if (action !== 'instinct') return;
    const p = sc.prompt;
    if (!p?.act) return say(state, bus, { kind: 'instinct', text: me.busy || me.ai?.cover ? 'You\'re at it. Moving stops it.' : 'Nothing to do but walk. Keep him in sight.' });
    if (me.ai) return agentCover(state, bus, me, p.act);
    act(state, bus, me, p.act);
  },

  think(state, a, bus) {
    // (agents walk by themselves; in autoplay the player's character does what its instinct offers)
    if (a.who === state.player && state.autoplay) autoplay(state, a, bus);
  },

  tick(state, bus) {
    const sc = state.scenario;
    if (sc.outcome) return;
    const me = playerOf(state), t = actorOf(state, sc.target);
    if (!me || !t) return;
    const same = rowOf(state, t) === rowOf(state, me);
    const d = same ? Math.hypot(t.x - me.x, t.z - me.z) : Infinity;
    if (!t.hidden && same) sc.closest = Math.min(sc.closest, d);
    if (sc.scan?.kind === 'double' && t.ai.s >= sc.scan.untilS) endScan(state, t);
    if (same && onMap(state, t)) scanning(state, bus, me, t, d);
    if (state.tick % TPS !== 0) return;                             // the rest once a second
    second(state, bus, me, t, d);
  },
};

// ---------- Orlov ----------

const actorOf = (state, id) => (id ? state.actors.find(a => a.id === id) : null);
const playerOf = (state) => state.actors.find(a => a.who === state.player);
const ticks = (r, [a, b]) => Math.round(range(r, a, b) * TPS);
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
export const eveningOf = (state) => EVENINGS.find(e => e.id === state.scenario.evening) ?? EVENINGS[0];

/** A bench on a row near x (the nearest section along with one). */
function benchNear(seed, row, x) {
  const i0 = Math.floor(x / SECTION_M);
  for (let k = 0; k < 12; k++) for (const i of [i0 + k, i0 - k]) {
    const b = sectionOf(seed, row, i).props.find(p => p.kind === 'bench');
    if (b) return b;
  }
  throw new Error('no bench');
}

// His stops: a tell (the Awareness read), a check (a scan: he looks, and rolls if we're in his sight),
// the shop (out of sight), the bench (the meeting: the contact comes), and after it, away.
const SCANS = { look: 'look', turn: 'look', window: 'window', cross: 'cross', exit: 'exit' };
function orlovStop(state, t, stop, phase, bus) {
  const sc = state.scenario;
  if (phase === 'tell') return tell(state, bus, t, stop.kind === 'turn' ? 'turn' : stop.kind);
  if (phase === 'start') {
    if (SCANS[stop.kind]) { sc.scan = { kind: SCANS[stop.kind], rolled: false, ms: state.time.ms }; sc.tell = null; }
    if (stop.kind === 'shop') sc.shop = stop.shop;
    if (stop.kind === 'meet') { sc.phase = 'meet'; sc.contact = spawnContact(state, t); }
    return;
  }
  if (SCANS[stop.kind]) endScan(state, t);
  if (stop.kind === 'exit') sc.shop = null;
  if (stop.kind === 'meet') {                                      // the meeting's over: he walks away west along the path
    sc.phase = 'after';
    if (!sc.outcome) end(state, bus, 'missed', MISSED);             // (seen, it ended when we'd seen enough)
    setRoute(state, t, planRoute(state.map.seed, { row: rowOf(state, t), x: t.x, z: t.z }, { row: rowOf(state, t), x: t.x - 120, z: LINE.P }));
  }
}

/** The contact comes along the path from the east to the bench's other seat, sits a minute, goes. */
function spawnContact(state, orlov) {
  const sc = state.scenario, row = rowOf(state, orlov), seed = state.map.seed;
  const c = makeAgent(state, { who: 'contact', row, x: orlov.x + 34, z: LINE.P, speed: 1.25, face: 'left' });
  const route = planRoute(seed, { row, x: c.x, z: LINE.P }, { row, x: sc.meet.seat2, z: 12.96 });
  route.stops = [{ kind: 'sit', s: route.length, ticks: 60 * TPS, face: 'down', gait: 'sit' }];
  setRoute(state, c, route);
  return c.id;
}

/** After his first sighting of us: he dry-cleans. Back the way he came a little, then on, the long way. */
function dryClean(state, t) {
  const sc = state.scenario, seed = state.map.seed, r = state.rng;
  const back = pointAt(t.ai.route, Math.max(0, t.ai.s - range(r, 14, 22)));
  const here = { row: rowOf(state, t), x: t.x, z: t.z };
  const leg1 = routeFrom(seed, here, { row: back.row, x: back.x, z: back.z });
  const leg2 = planRoute(seed, { row: back.row, x: back.x, z: back.z }, sc.meet, { walker: hash(seed, 'orlov', state.time.ms), evasive: 2, rng: r });
  const route = withEnd(withHabits(seed, { ...leg2, pts: [...leg1.pts, ...leg2.pts.slice(1)] }, r, 'wary'), { kind: 'meet', ticks: 75 * TPS, face: 'down', gait: 'sit' });
  setRoute(state, t, route);
  sc.scan = { kind: 'double', rolled: false, ms: state.time.ms, untilS: leg1.length };
}

/** Made: he turns for home, the way he came. */
function goHome(state, t) {
  const seed = state.map.seed;
  setRoute(state, t, routeFrom(seed, { row: rowOf(state, t), x: t.x, z: t.z }, { row: 0, x: state.scenario.startX, z: LINE.F }));
}

/** In autoplay: the player's character does what its instinct offers when it warns of a check. */
function autoplay(state, me, bus) {
  const sc = state.scenario, p = sc.prompt;
  if (sc.outcome || !p || me.ai.cover || me.ai.hold > state.time.ms) return;
  if (p.tone === 'urgent' && (p.act === 'window' || p.act === 'lace' || p.act === 'bench') && state.tick % TPS === 1) agentCover(state, bus, me, p.act);
}

/** Cover for an agent player (the autoplay, or T in autoplay): a short detour or a stop, then on. */
function agentCover(state, bus, me, what) {
  const seed = state.map.seed, row = rowOf(state, me), here = { row, x: me.x, z: me.z, w: 0, way: 'attach' };
  let pts = [here, { ...here }], stop;
  if (what === 'window') {
    const S = sectionAt(state, me.x), door = S?.doors.filter(d => d.kind === 'shop').sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
    if (!door) return;
    const gx = Math.abs(me.x - door.x) < 0.9 ? door.x + (me.x < door.x ? -1.4 : 1.4) : me.x;
    pts = [here, { row, x: gx, z: me.z, w: 0 }, { row, x: gx, z: -4.35, w: 0 }];
    stop = { kind: 'window', ticks: 5 * TPS, face: 'up', glass: true };
  } else if (what === 'lace') { stop = { kind: 'lace', ticks: 3 * TPS, face: me.face, gait: 'crouch' }; state.scenario.laceMs = state.time.ms; }
  else if (what === 'bench') {
    const seats = (sectionAt(state, me.x)?.props ?? []).filter(p => p.kind === 'bench').flatMap(p => p.seats).sort((a, b) => Math.abs(a - me.x) - Math.abs(b - me.x));
    if (!seats.length) return;
    pts = [here, { row, x: seats[0], z: me.z, w: 0 }, { row, x: seats[0], z: 12.96, w: 0 }];
    stop = { kind: 'bench', ticks: 8 * TPS, face: 'down', gait: 'sit' };
  } else return;
  const route = { ...finishPts(pts) };
  route.stops = [{ ...stop, s: route.length }];
  me.ai.route = route; me.ai.s = 0; me.ai.stop = 0; me.ai.f = 0;
  me.ai.hold = state.time.ms + 12000;
  say(state, bus, { kind: 'instinct', text: { window: 'You find something in a shop window worth a look. In the glass, the street behind you.', lace: 'You stop to tie a shoelace that didn\'t need it.', bench: 'You sit, as people do on a boulevard.' }[what] });
}
const finishPts = (pts) => { const cum = [0]; for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].z - pts[j - 1].z)); return { pts, cum, length: cum[cum.length - 1], rows: 0 }; };

// His twins: now and then one turns up out of our sight and walks the street (a passer-by with a
// sheet of their own, so a look of their own), and goes as passers-by go. Most come up from behind,
// quicker than him, on his pavement, and overtake him: the ones you could swap him for. Some come out
// of a shop ahead of him; the rest come the other way.
function twins(state, t) {
  const sc = state.scenario, r = state.rng, me = playerOf(state);
  sc.twins = sc.twins.filter(id => actorOf(state, id));
  for (let i = 0; i < TWINS; i++) {
    const who = `twin${i}`;
    if (state.actors.some(a => a.who === who) || !chance(r, TWIN_CHANCE)) continue;
    const his = t.z < Z.kerbN ? 'far' : t.z > LANES.south[0] - 0.5 ? 'south' : t.z > 11 ? 'path' : 'near';
    const how = weighted(r, [['behind', 4], ['shop', his === 'far' ? 2 : 0], ['ahead', 2]]);
    let x, z, east, speed, lane = his;
    if (how === 'behind') { x = me.x - range(r, 24, 30); east = true; speed = range(r, 1.75, 1.95); }
    else if (how === 'ahead') { lane = weighted(r, [['far', 3], ['near', 2], ['path', 1]]); x = Math.max(t.x, me.x) + range(r, 26, 36); east = false; speed = range(r, 1.1, 1.5); }
    else {
      const door = [...state.$world.sections.values()].flatMap(S => S.doors).find(d => d.kind === 'shop' && d.x > t.x + 4 && d.x < t.x + 30);
      if (!door) continue;
      x = door.x; z = Z.front + 0.3; east = chance(r, 0.5); speed = range(r, 1.2, 1.5);
    }
    z ??= range(r, LANES[lane][0], LANES[lane][1]);
    if (Math.abs(x - me.x) < 21 && sees(state, eyes(state, me), x, z)) continue;   // (never out of thin air in front of us)
    const zl = how === 'shop' ? range(r, LANES.far[0], LANES.far[1]) : z;
    const a = { id: `a${state.nextActor++}`, who, seed: null, x, z, vx: 0, vz: 0, face: east ? 'right' : 'left', head: east ? 0 : Math.PI, gait: 'walk', stride: 0, stuck: 0,
      ai: { kind: 'walker', speed, steps: [...(how === 'shop' ? [['go', x, zl]] : []), ['go', east ? x + 150 : x - 90, zl], ['gone']], wait: 0 } };
    state.actors.push(a);
    sc.twins.push(a.id);
  }
}

// ---------- the dice ----------

/** He's about to check: do we read it coming? (Awareness, if we're watching him.) */
function tell(state, bus, t, kind) {
  const sc = state.scenario, me = playerOf(state);
  sc.tell = { kind, ms: state.time.ms, read: false };
  if (!me || sc.outcome || sc.marked !== t.id) return;
  const d = Math.hypot(t.x - me.x, t.z - me.z);
  if (!inView(state, t.id)) return;                               // we weren't looking
  const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'),
    dc: 10 + (sc.wary ? 3 : 0) + Math.round(sc.alert / 25) + (d > 35 ? 6 : d > 25 ? 3 : 0) });
  sc.rolls++;
  if (r.ok) { sc.tell.read = true; sc.warned++; }
}

/** A check under way: the first moment we're in his sight, he rolls. */
function scanning(state, bus, me, t, d) {
  const sc = state.scenario;
  if (!sc.scan || sc.scan.rolled) return;
  if (d > SCAN_M[sc.scan.kind] || !seesActor(state, t, me)) return;
  sc.scan.rolled = true;
  moment(state, bus, me, t, d, sc.scan.kind);
}

function endScan(state, t) {
  const sc = state.scenario;
  t.glass = t.wide = false;
  if (sc.scan?.kind === 'exit') sc.shop = null;
  sc.scan = null;
  sc.lastScanMs = state.time.ms;
}

/** One of his checks, with us in his sight: Pathfinding against our Deception. */
function moment(state, bus, me, t, d, kind) {
  const sc = state.scenario;
  if (sc.outcome) return;
  const mods = exposure(state, me, t, d, kind);
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception') },
    { skill: 'pathfinding', value: skill(state.people.orlov, 'pathfinding'), mods });
  sc.rolls++;
  if ((kind === 'exit' || kind === 'cross') && d > 15 && sc.marked === t.id) keep(state, bus, t, d, kind === 'exit' ? 'out of a shop' : 'across the road');
  // We know what he saw only if we saw him look: a check we didn't see goes in the log unseen, for
  // the result paper (what you didn't see).
  const [unseen, seen] = LINES[kind], watching = inView(state, t.id), hidden = !watching || undefined;
  if (r.ok) {
    if (r.margin < 3) { sc.alert = Math.min(100, sc.alert + 12); mark(state, t, '?', watching); say(state, bus, { kind: 'roll', roll: r, hidden, text: pick(state.rng, NAG) }); }
    else say(state, bus, { kind: 'roll', roll: r, hidden, text: pick(state.rng, unseen) });
    return;
  }
  sc.sightings.push({ ms: state.time.ms, kind, seen: watching });
  sc.alert = Math.min(100, sc.alert + 40);
  mark(state, t, '!', watching);
  say(state, bus, { kind: 'roll', roll: r, hidden, text: pick(state.rng, seen) });
  if (sc.sightings.length === 1) {
    if (watching) say(state, bus, { kind: 'instinct', text: 'He\'s seen your face. Once. He\'ll be looking for it now.' });
    else sc.sensed = false;                                        // (you may notice the change in him later)
    if (sc.phase === 'tail') dryClean(state, t);                   // the old trick: back the way he came, then the long way round
  } else {
    // We know he's made us if we saw him do it; otherwise we see only what he does next.
    const text = watching ? MADE : SPOOKED;
    sc.madeSeen = watching;
    say(state, bus, { kind: 'note', text });
    addHeat(state, 5);
    goHome(state, t);
    end(state, bus, 'made', text);
  }
}

/**
 * What he's just become aware of, over his head for MARK_S, if we're watching him to see it: '?' (he
 * half-noticed something), '!' (he's seen us). The UI draws state.scenario.mark.
 */
export const MARK_S = 2.5;
function mark(state, t, glyph, watching) {
  if (watching) state.scenario.mark = { id: t.id, glyph, until: state.time.ms + MARK_S * 1000 };
}

/** What makes us easy or hard for him to spot, as modifiers to his roll. */
function exposure(state, me, t, d, kind) {
  const sc = state.scenario, mods = [];
  if (d < 5) mods.push({ why: 'too close', v: 6 }); else if (d < 10) mods.push({ why: 'close', v: 3 });
  else if (d > 35) mods.push({ why: 'far off', v: -6 }); else if (d > 25) mods.push({ why: 'well back', v: -4 }); else if (d > 15) mods.push({ why: 'a good way back', v: -2 });
  const n = crowdAround(state, me, 5);
  if (n === 0 && crowdAround(state, me, 8) === 0) mods.push({ why: 'alone on the pavement', v: 2 });
  else if (n >= 5) mods.push({ why: 'in a crowd', v: -4 }); else if (n >= 2) mods.push({ why: 'among people', v: -2 });
  const lit = lightHere(state, me.x, me.z), light = lightBand(lit);
  if (light === 'dark') mods.push({ why: 'in the dark', v: -4 }); else if (light === 'dim') mods.push({ why: 'in the dusk', v: -2 });
  else if (lit > openAir(state) + 0.2) mods.push({ why: 'in the lamplight', v: 2 });
  if (me.gait === 'run') mods.push({ why: 'running', v: 6 });
  if (me.z > Z.kerbN + 0.3 && me.z < Z.kerbS - 0.3 && !crossingAt(state, me)) mods.push({ why: 'crossing away from the zebra', v: 2 });
  if (me.glance) mods.push({ why: 'looking back over your shoulder', v: 2 });
  if (state.time.ms - sc.mirrorMs < 20000) mods.push({ why: 'you stopped when he did', v: 3 });
  const doing = coverNow(state, me);
  if (doing) mods.push(doing);
  else if (sc.stillS >= 2) mods.push({ why: 'standing about with nothing to do', v: 2 });
  const toHim = Math.abs(wrap(Math.atan2(t.z - me.z, t.x - me.x) - (me.head ?? 0)));
  if (toHim < 0.5 && (d < 15 || sc.stillS >= 2) && !me.glass) mods.push({ why: 'looking straight at him', v: 2 });
  else if (toHim > 2.2) mods.push({ why: 'your back to him', v: -1 });
  const sameSide = (me.z < Z.kerbN) === (t.z < Z.kerbN);
  if (sameSide && d < 20 && Math.abs(me.z - t.z) < 1.2 && kind !== 'cross') mods.push({ why: 'right behind him', v: 1 });
  if (!sameSide && kind !== 'cross') mods.push({ why: 'across the road', v: -3 });
  if (sc.alert >= 25) mods.push({ why: 'he\'s on edge', v: Math.min(4, Math.floor(sc.alert / 25)) });
  if (sc.sightings.length && d < 15) mods.push({ why: 'he\'s looking for you', v: 2 });
  return mods;
}


/** What we're doing that gives us a reason to be where we are, as a modifier to his roll (or null). */
function coverNow(state, me) {
  const ac = me.ai?.cover;                                          // (an agent player's cover: a stop)
  if (ac) {
    if (state.scenario.scan && ac.since >= state.scenario.scan.ms) return { why: 'stopping short as he looked', v: 2 };
    return { window: { why: 'busy at a shop window', v: -3 }, bench: { why: 'sitting on a bench', v: -3 }, lace: { why: 'tying a shoelace', v: -1 } }[ac.what] ?? null;
  }
  const b = me.busy, s = b?.steps[0];
  if (b && state.scenario.scan && b.since >= state.scenario.scan.ms) return { why: 'stopping short as he looked', v: 2 };
  if (b?.what === 'window' && s?.[0] === 'wait') return { why: 'busy at a shop window', v: -3 };
  if (b?.what === 'bench' && me.gait === 'sit') return { why: 'sitting on a bench', v: -3 };
  if (b?.what === 'lace' && s?.[0] === 'wait') return { why: 'tying a shoelace', v: -1 };
  if (!b && crossingAt(state, me) && me.gait === 'idle' && (Math.abs(me.z - Z.kerbN) < 1.6 || Math.abs(me.z - Z.kerbS) < 1.6)) return { why: 'waiting to cross', v: -1 };
  return null;
}

/**
 * We glanced back over our shoulder. Someone who checks behind them has something behind them: if he
 * has us in his sight, our Deception against his Awareness says whether he noticed it.
 */
function glanced(state, bus, me) {
  const sc = state.scenario, t = actorOf(state, sc.target);
  if (!t || t.hidden || !seesActor(state, t, me)) return;
  const d = Math.hypot(t.x - me.x, t.z - me.z);
  if (d > 30) return;
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception') },
    { skill: 'awareness', value: skill(state.people.orlov, 'awareness'), mods: [d < 10 ? { why: 'close', v: 3 } : d > 20 ? { why: 'a good way back', v: -3 } : null].filter(Boolean) });
  sc.rolls++;
  if (r.ok) return;
  sc.alert = Math.min(100, sc.alert + 15);
  mark(state, t, '?', inView(state, t.id));
  say(state, bus, { kind: 'roll', roll: r, hidden: !inView(state, t.id) || undefined,
    text: 'He catches you checking behind you. People who watch their backs have something behind them, and he files it away.' });
}

/**
 * A Tracking roll to keep him at a distance; failed, we lose him, or take a twin for him. why: what
 * makes it harder; twin: a grey coat passing close by him, the moment you could swap them.
 */
function keep(state, bus, t, d, why = null, passing = null) {
  const sc = state.scenario;
  const mods = [why && { why: `he's come ${why}`, v: -3 }, passing && { why: 'another grey coat beside him', v: -3 }].filter(Boolean);
  const r = check(state.rng, { skill: 'tracking', value: skill(state.people[state.player], 'tracking'), dc: keepDC(state, t, d), mods });
  sc.rolls++;
  if (r.ok) { if (passing && r.margin < 4) say(state, bus, { kind: 'roll', roll: r, text: 'Two grey coats, side by side for a moment. You keep your eyes on the right one: the briefcase.' }); return; }
  const twin = passing ?? sc.twins.map(id => actorOf(state, id)).find(o => o && inView(state, o.id) && Math.hypot(o.x - t.x, o.z - t.z) < 7);
  if (twin) {
    sc.marked = twin.id; sc.mixups++;
    say(state, bus, { kind: 'roll', roll: r, text: 'People pass between you, and when they\'ve gone you pick up the grey coat again.' });
  } else {
    sc.marked = null; sc.findS = 0;
    say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, lostLines) });
  }
}

/** Keeping him at a distance: Tracking against this difficulty. */
function keepDC(state, t, d) {
  const light = lightBand(lightHere(state, t.x, t.z));
  return 8 + Math.round(Math.max(0, d - KEEP_M) * 0.8) + 2 * crowdAround(state, t, 3) + (light === 'dark' ? 3 : light === 'dim' ? 1 : 0);
}

const crowdAround = (state, who, r) => near(state, who.x, who.z, r).filter(o => o.ai?.kind === 'walker' && !o.hidden).length;

// ---------- once a second: keeping him, finding him, his mood, the meeting, the instinct ----------

function second(state, bus, me, t, d) {
  const sc = state.scenario;
  const still = Math.hypot(me.vx, me.vz) < 0.05 && !me.busy && !me.ai?.cover;
  const same = rowOf(state, t) === rowOf(state, me);
  sc.stillS = still ? sc.stillS + 1 : 0;
  // Mirroring: he's stopped (a pause, a window, a look) and so have we, in the open, near him.
  const stopped = !t.hidden && Math.hypot(t.vx, t.vz) < 0.05;
  if (stopped && still && d < 30 && !coverNow(state, me) && sc.stillS >= 2) sc.mirrorMs = state.time.ms;
  sc.alert = Math.max(sc.wary ? 15 : 0, sc.alert - 0.15);
  if (same) { sc.gap.push(Math.round(d * 10) / 10); if (sc.gap.length > 6) sc.gap.shift(); } else sc.gap = [];
  if (same && onMap(state, t)) twins(state, t);
  // His way into a lane: which, and did we see him take it?
  if (onMap(state, t) && (t.z < Z.front - 0.5 || t.z > Z.south + 0.5)) {
    const S = sectionAt(state, t.x), north = t.z < 0, g = (north ? S?.gapsN : S?.gapsS)?.find(g => t.x >= g.x0 - 0.5 && t.x <= g.x1 + 0.5);
    if (g && sc.turn?.x0 !== g.x0) sc.turn = { name: g.name, x0: g.x0, x1: g.x1, row: rowOf(state, t), north, seen: false };
  }
  // Whom we take for him.
  if (sc.marked && !actorOf(state, sc.marked)) { sc.marked = null; sc.findS = 0; }   // (a twin who's walked off)
  if (inView(state, t.id)) {
    sc.lastSeenT = state.time.ms;
    if (sc.marked === t.id) sc.lastSeen = { row: rowOf(state, t), x: t.x, z: t.z, ms: state.time.ms };
    if (sc.turn && sc.turn.row === rowOf(state, t) && (t.z < Z.front + 0.5 || t.z > Z.south - 0.5) && sc.marked === t.id) sc.turn.seen = true;   // we saw him go into it
  }
  sc.unseenS = Math.floor((state.time.ms - (sc.lastSeenT ?? sc.began)) / 1000);
  if (sc.marked === t.id) {
    // (in the open he's simply there to see: it's people round him he's lost among, and a twin
    // passing close by him is the moment to keep your eyes on the right one)
    const twin = sc.twins.map(id => actorOf(state, id)).find(o => o && inView(state, o.id) && Math.hypot(o.x - t.x, o.z - t.z) < 2.5);
    if (twin && d > 12 && sc.swapped !== twin.id) { sc.swapped = twin.id; keep(state, bus, t, d, null, twin); }
    else if (inView(state, t.id) && d > KEEP_M && crowdAround(state, t, 3) >= 2 && ++sc.keepS >= KEEP_EVERY_S) { sc.keepS = 0; keep(state, bus, t, d); }
  } else if (sc.marked) {
    const w = actorOf(state, sc.marked), wd = Math.hypot(w.x - me.x, w.z - me.z);
    if (inView(state, w.id)) sc.lastSeen = { row: rowOf(state, w), x: w.x, z: w.z, ms: state.time.ms };
    const reveal = REVEAL_M * (lightBand(lightHere(state, w.x, w.z)) === 'dark' ? 0.6 : 1);
    if (inView(state, w.id) && wd < reveal) {
      sc.marked = null; sc.findS = 0; sc.mixupsKnown = (sc.mixupsKnown ?? 0) + 1;
      say(state, bus, { kind: 'instinct', text: `That's not him: ${state.people[w.who].tell}. Somewhere back there you swapped him for a stranger, who's having a perfectly ordinary evening.` });
    }
  } else if (++sc.findS >= FIND_EVERY_S) {
    sc.findS = 0;
    find(state, bus, me, t);
  }
  if (sc.sensed === false && inView(state, t.id) && d < 35) {    // he saw us when we weren't looking: does it show?
    const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), dc: 15 });
    sc.rolls++;
    sc.sensed = r.ok;
    if (r.ok) say(state, bus, { kind: 'roll', roll: r, text: 'Something\'s changed in how he walks: shorter steps, his head up. He\'s seen something behind him. Possibly you.' });
  }
  if (sc.unseenS >= LOST_S) return end(state, bus, 'lost', GONE);
  if (sc.marked === t.id && same) sc.farthest = Math.max(sc.farthest, d);
  if (sc.phase === 'meet') meeting(state, bus, me, t, d);
  if (sc.outcome) return;
  const p = instinct(state, me, t, d, still);
  if (sc.prompt && p.id === sc.prompt.id) Object.assign(sc.prompt, { text: p.text, act: p.act });
  else if (!sc.prompt || RANK[p.tone] > RANK[sc.prompt.tone] || state.time.ms - sc.prompt.ms >= HOLD_S[sc.prompt.tone] * 1000) {
    // (a line holds a while, the calmer the longer, unless something more pressing comes)
    sc.prompt = { id: p.id, tone: p.tone, text: p.text, act: p.act, ms: state.time.ms };
    if (p.log) say(state, bus, { kind: 'instinct', text: p.text.replace(/\s*\{[a-z]+\}.*$/, '') });
  }
}

/** Lost: the grey coats in view, nearest first, and an Awareness roll on each to tell if it's him. */
function find(state, bus, me, t) {
  const sc = state.scenario;
  const candidates = [t, ...sc.twins.map(id => actorOf(state, id))].filter(o => o && !o.hidden && inView(state, o.id))
    .map(o => [o, Math.hypot(o.x - me.x, o.z - me.z)]).filter(([, dd]) => dd < 32).sort((a, b) => a[1] - b[1]);
  for (const [o, dd] of candidates) {
    const light = lightBand(lightHere(state, o.x, o.z)), crowd = crowdAround(state, o, 3);
    const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), dc: 10,
      mods: [dd > 15 && { why: 'at a distance', v: -Math.round((dd - 15) / 4) }, crowd && { why: 'people round him', v: -crowd },
        light !== 'day' && { why: light === 'dark' ? 'the dark' : 'the dusk', v: light === 'dark' ? -4 : -2 }].filter(Boolean) });
    sc.rolls++;
    if (o === t) {
      if (r.ok) { sc.marked = t.id; sc.lastSeen = { x: t.x, z: t.z, ms: state.time.ms }; say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, foundLines) }); }
      return;
    }
    if (!r.ok && dd > REVEAL_M) {                                  // a grey coat, and we take it for his
      sc.marked = o.id; sc.mixups++; sc.lastSeen = { x: o.x, z: o.z, ms: state.time.ms };
      say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, wrongLines) });
      return;
    }
  }
}

function meeting(state, bus, me, t, d) {
  const sc = state.scenario, c = actorOf(state, sc.contact);
  const together = c && c.gait === 'sit' && Math.abs(c.x - t.x) < 2;
  if (!together) {
    if (sc.meetS > 0) end(state, bus, 'missed', MISSED);
    return;
  }
  sc.meetS++;
  const dc = Math.hypot(c.x - me.x, c.z - me.z);
  if (dc < CONTACT_M && !sc.contactLooked && seesActor(state, c, me)) {   // too close: the other man has eyes too
    sc.contactLooked = true;
    const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception') },
      { skill: 'pathfinding', value: skill(state.people.contact, 'pathfinding'), mods: [{ why: 'right by the bench', v: 6 }] });
    sc.rolls++;
    if (!r.ok) {
      say(state, bus, { kind: 'roll', roll: r, text: 'The other man looks up from his paper, straight at you. He folds it, stands and goes.' });
      setRoute(state, c, planRoute(state.map.seed, { row: rowOf(state, c), x: c.x, z: c.z }, { row: rowOf(state, c), x: c.x + 70, z: LINE.P }));
      return end(state, bus, 'blown', 'The meeting\'s over before it began, and Orlov knows why.');
    }
    say(state, bus, { kind: 'roll', roll: r, text: 'The man with the newspaper glances at you over it, and goes back to the football.' });
  }
  if (d < WITNESS_M && inView(state, t.id) && inView(state, c.id)) sc.witnessS++;
  if (sc.witnessS >= WITNESS_S) {
    sc.lead = `${clockOf(state)}: Orlov met a man in a blue beanie on a bench on the boulevard. Something passed between them in a newspaper.`;
    say(state, bus, { kind: 'note', text: 'A newspaper changes hands on the bench. He leaves it lighter by an envelope. That\'s the meeting, and you saw it.' });
    end(state, bus, 'seen', sc.sightings.length ? 'You saw the meeting. He saw you once on the way, and put it down to Moscow being a small town.'
      : 'You saw the meeting, and he never knew you were there. The station will want to know who wears that beanie.');
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clockOf = (state) => { const m = Math.floor(state.time.ms / 60000) % 1440; return hhmm(Math.floor(m / 60), m % 60); };

// ---------- the instinct ----------

const COVER = { window: 'look in the window', bench: 'sit on the bench', lace: 'tie a shoelace' };
const offer = (state, me) => { const c = coverHere(state, me); return { act: c, text: c ? ` {instinct} ${COVER[c]}` : '' }; };

/**
 * What a trained eye tells you now: { id, text, tone ('calm' | 'note' | 'warn' | 'urgent'), act,
 * log }. act is what T does ('window', 'bench', 'lace', 'cross'); {instinct}, {slow}, {watch} in the
 * text show as those keys. The first rule that holds speaks.
 */
function instinct(state, me, t, d, still) {
  const sc = state.scenario, seen = inView(state, t.id), marked = sc.marked === t.id;
  const L = (id, tone, text, extra = {}) => ({ id, tone, text: Array.isArray(text) ? say1(state, id, text) : text, act: null, ...extra });
  const busy = me.busy?.what ?? me.ai?.cover?.what;
  // The meeting.
  if (sc.phase === 'meet' && sc.contact && seen) {
    const c = actorOf(state, sc.contact), both = c && inView(state, c.id);
    if (c && Math.hypot(c.x - me.x, c.z - me.z) < CONTACT_M + 1) return L('meet-close', 'urgent', 'Too close to the bench. The other one is a professional.');
    if (both && d < WITNESS_M) return L('meet-watch', 'note', ['Someone\'s sat down with him. Watch, and don\'t be seen watching.', 'That\'s the meeting. Hold still, eyes on the bench.']);
    if (!both) return L('meet-see', 'warn', 'He\'s meeting someone. Get them both in view: hold {watch} and look.');
    return L('meet-near', 'warn', 'He\'s meeting someone. Get closer, but not too close.');
  }
  if (sc.phase === 'meet' && !seen && marked) return L('meet-lost', 'warn', 'He\'s sat down somewhere on the boulevard. Find the bench.');
  // His tells, read in time; his checks under way.
  if (sc.tell?.read && !sc.scan && state.time.ms - sc.tell.ms < 4000) {
    const o = offer(state, me);
    const what = { turn: 'He\'s slowing at the corner. He\'ll look back before he turns.', look: 'He\'s slowing. He\'s going to look back.', window: 'He\'s drifting to a shop window. He\'ll use the glass.', cross: 'He\'s going to cross. He\'ll look both ways, and that means at you.', double: 'He\'s stopping short. He\'s going to turn round.' }[sc.tell.kind];
    if (busy) return L(`tell-${sc.tell.kind}`, 'urgent', `${what} Stay at it.`, { log: true });
    return L(`tell-${sc.tell.kind}`, 'urgent', `${what}${d < 12 ? ' Don\'t be the face behind him.' : ''}${o.text}`, { act: o.act, log: true });
  }
  if (sc.scan && seen && !busy && d < 25) {                      // (too late for cover: stopping now is the thing he'd see)
    if (sc.scan.kind === 'double') return L('double', 'urgent', ['He\'s coming back this way. Don\'t meet his eyes. Walk on.', 'He\'s doubling back. Keep walking, look at anything but him.']);
    return L('scan', 'urgent', ['He\'s looking. Be part of the street. Nothing sudden.', 'His eyes are on the street. Keep doing what you\'re doing.']);
  }
  if (me.gait === 'run' && d < 40) return L('run', 'urgent', ['Don\'t run. Running is the one thing everyone sees.', 'Don\'t run. Nobody runs in Moscow in November unless something\'s on fire.']);
  // Lost, or not in sight.
  if (!sc.marked) {
    if (!sc.lastSeen) return L('lost', 'warn', 'You\'ve lost him. Grey coat, grey fedora, a briefcase. Find him.');
    const ago = Math.round(Math.hypot(sc.lastSeen.x - me.x, sc.lastSeen.z - me.z));
    return L('lost', 'warn', [`You've lost him. Last seen ${ago} m off, heading east. Look for the grey coat and the briefcase.`,
      `You have no idea where he went. He was ${ago} m off, heading east, which narrows it down to most of Moscow.`,
      `Lost him. Grey coat, fedora, briefcase: there can't be more than a few thousand. He was heading east.`]);
  }
  if (!marked) {                                                  // a twin, unbeknown: the instinct is as sure as you are
    const w = actorOf(state, sc.marked), wd = w ? Math.hypot(w.x - me.x, w.z - me.z) : 99;
    if (wd < 14) return L('twin-close', 'warn', 'Closer than you\'d like. Is that the briefcase? Hard to say from here.');
    return L('twin', 'calm', ['Steady. Keep him in sight.', 'Grey coat, a good way on. Keep the pace.']);
  }
  // Through a lane to another street: we know it only if we saw him take it.
  if (rowOf(state, t) !== rowOf(state, me) && sc.turn?.seen && sc.turn.row === rowOf(state, me)) {
    const w = sc.turn, inLane = me.x > w.x0 - 0.5 && me.x < w.x1 + 0.5 && (w.north ? me.z < Z.front : me.z > Z.south);
    const gd = Math.round(inLane ? (w.north ? me.z - Z.north : Z.edge - me.z) : Math.abs((w.x0 + w.x1) / 2 - me.x) + (Z.front - Z.north));
    return L('away', 'warn', [`He's gone ${w.north ? 'up' : 'down'} ${w.name}: ${gd} m to the far end. Through it after him, or you've lost him.`, `${cap(w.name)}: he's through it and out the other end by now. Follow, or lose him.`]);
  }
  if (sc.turn?.seen && sc.turn.row === rowOf(state, t) && (t.z < Z.front + 0.5 || t.z > Z.south - 0.5) && seen) return L('turn', 'warn', [`He's turned ${sc.turn.north ? 'up' : 'down'} ${sc.turn.name}. Give him the corner: it's empty in there, and narrow.`, `${cap(sc.turn.name)}. Don't follow him straight in: let him get to the far end.`]);
  if (t.hidden && rowOf(state, t) === rowOf(state, me)) {
    const shop = SHOPS[sc.shop] ?? 'a shop', o = offer(state, me);
    if (d < 8) return L('shop-door', 'warn', [`He's in ${shop}. Don't hover at the door: walk on, or cross over.`, `He's in ${shop}. Hovering at the door is how you end up in the same queue. Walk on.`]);
    if (o.act === 'window' && !busy) return L('shop-wait', 'note', `He's in ${shop}. Wait where you can see the door.${o.text}`, { act: o.act });
    return L('shop', 'note', `He's gone into ${shop}. He'll come out looking: be somewhere you'd be anyway.`);
  }
  if (!seen && sc.unseenS >= 3) {
    const ld = sc.lastSeen ? Math.round(Math.hypot(sc.lastSeen.x - me.x, sc.lastSeen.z - me.z)) : null;
    const where = ld === null ? 'ahead' : ld < 5 ? 'right about here' : `${ld} m ${sc.lastSeen.x > me.x ? 'east' : 'west'} of you`;
    if (sc.unseenS > 20) return L('unseen-long', 'warn', [`You haven't seen him for ${sc.unseenS} seconds. That's generally considered a problem. He was ${where}.`, `Still no sign of him. He was ${where}. Get eyes on him.`]);
    return L('unseen', 'warn', `You can't see him. ${sc.unseenS > 12 ? 'You\'re losing him: he' : 'He'} was ${where}. Get eyes on him.`);
  }
  // Distance and its trend (m/s; more, he's pulling away).
  const trend = sc.gap.length >= 4 ? (sc.gap[sc.gap.length - 1] - sc.gap[0]) / (sc.gap.length - 1) : 0;
  if (d < 5) { const o = offer(state, me); return L('far-too-close', 'urgent', `Far too close. Peel off.${o.text}`, { act: o.act }); }
  if (d < 9 && !busy) return L('too-close', 'warn', ['Too close. Let him get ahead.', 'You\'re on his heels. Drop back.', 'Any closer and you\'ll be carrying his briefcase. Drop back.']);
  const stopped = Math.hypot(t.vx, t.vz) < 0.05;
  if (stopped && still && d < 30) { const o = offer(state, me); return L('mirror', 'warn', `He's stopped. Don't stop with him: walk on, or find a reason.${o.text}`, { act: o.act }); }
  if (still && sc.stillS >= 3 && d < 35 && !coverNow(state, me)) { const o = offer(state, me); return L('loiter', 'warn', [`Standing about draws the eye. Give yourself a reason.${o.text}`, `Standing in the middle of the pavement. Very natural. Give yourself a reason.${o.text}`], { act: o.act }); }
  const toHim = Math.abs(wrap(Math.atan2(t.z - me.z, t.x - me.x) - (me.head ?? 0)));
  if (toHim < 0.5 && still && d < 18 && !busy) return L('stare', 'warn', ['You\'re staring at him. Look at something else.', 'You\'re staring at him. Moscow has other things to look at. Try a lamp post.']);
  const air = openAir(state), lampLit = air < 0.3 && lightHere(state, me.x, me.z) > air + 0.2;
  if (lampLit && d < 28 && !busy) return L('lamp', 'note', ['You\'re in the lamplight. Out of it before he turns.', 'You\'re lit up like a shop window. Out of the lamplight.']);
  if (sc.alert >= 50 && d < 22) return L('alert', 'warn', 'He\'s on edge, checking more. Give him more room.');
  if (trend < -0.35 && d < 20) return L('gaining', 'warn', ['You\'re gaining on him. Ease off: {slow} stroll.', 'Too quick. Match his pace: {slow} stroll.']);
  if (d > 34) return L('too-far', 'warn', 'Too far. You\'ll lose him at this. Close up.');
  if (trend > 0.3 && d > 22) return L('pulling', 'note', ['He\'s pulling away. Close up.', 'He\'s quickened. Keep up with him.']);
  // The street round him.
  const twinNear = sc.twins.map(id => actorOf(state, id)).find(o => o && inView(state, o.id) && Math.hypot(o.x - t.x, o.z - t.z) < 8);
  if (twinNear && d > 12) return L('twin-near', 'note', ['Another grey coat near him. Watch which one you follow.', 'Two grey coats now. His has the briefcase. Probably.']);
  const crowdT = crowdAround(state, t, 6), crowdMe = crowdAround(state, me, 6);
  if (crowdT >= 5 && d > 18) return L('crowd-ahead', 'note', 'People round him. Close up a little, or you\'ll lose him in them.');
  if (crowdMe === 0 && crowdT === 0 && d < 22) return L('empty', 'note', ['The street\'s emptied. Hang back further.', 'The street\'s emptied: just you, him and your conscience. Hang back.']);
  // The sides of the street.
  const sameSide = (me.z < Z.kerbN) === (t.z < Z.kerbN);
  const c = crossingNear(state, me)?.road === 'main';
  if (sameSide && d < 16 && c && t.z < Z.kerbN && !busy) return L('cross-offer', 'note', 'A crossing. Take the other pavement and keep level with him: {instinct} cross here.', { act: 'cross' });
  if (!sameSide && d > 26 && c && !busy) return L('cross-back', 'note', 'He\'s pulling ahead across the road. Cross back here: {instinct} cross.', { act: 'cross' });
  if (!sameSide) return L('parallel', 'calm', ['Good. Across the road and level with him. Hold it.', 'Parallel him. He looks behind, not across.']);
  if (sc.sightings.length) return L('seen-once', 'note', 'He\'s seen your face once. Distance, the other pavement, people between you.');
  if (state.time.ms - (sc.lastScanMs ?? sc.began) > 50000 && d < 30) return L('quiet', 'calm', ['He hasn\'t checked behind him in a while. He will.', 'He hasn\'t looked back in a while. They always do, eventually.']);
  return L('good', 'calm', ['Good. People between you. Hold it.', 'Steady. Keep his pace.', 'Let him lead. You\'re just walking home.', 'Good distance. Keep it.', 'Good. You\'re nobody. Keep being nobody.']);
}

function end(state, bus, outcome, text) {
  const sc = state.scenario;
  if (sc.outcome) return;
  sc.outcome = outcome;
  sc.phase = 'done';
  sc.endText = text;
  sc.ended = state.time.ms;
  bus?.emit('scenario-end', outcome);
}
