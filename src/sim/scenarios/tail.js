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
//     cross); and what neither of us chose, the weather (hoods up, umbrellas: sim/weather.js
//     weatherMods(), on his roll, and on ours when we look for him among the grey coats). He wins: a
//     sighting. The first sets him dry-cleaning; the second, he's made us.
//   - **His alertness** (0–100) rises with what he half-notices and falls slowly; it brings his checks
//     closer together and sharpens them, and the instinct reads it.
//   - **Keeping him.** No arrow over him (the user): a marker shows him for MARKER_S out of his door,
//     then it's our eyes, and whom we take for him (sc.marked) is the character's belief, which the
//     instinct speaks from. While he's in view beyond KEEP_M with people round him, we roll Tracking
//     to keep him (every KEEP_EVERY_S) against the distance, those people and the dark; failing it
//     near a man who looks like him (his twins, TWINS grey coats and hats about the street, passers-by
//     going past him), we follow the wrong man until we're close enough to see it (REVEAL_M). A close
//     look (E held on a grey coat for CLOSE_LOOK_S, within CLOSE_LOOK_M) rolls Awareness and tells
//     him from a twin. Lost, we look for him (Awareness, every FIND_EVERY_S, the grey coats in view,
//     nearest first: the wrong one may pass), and the instinct says where. Not seen for LOST_S, he's
//     gone.
//   - **The instinct** speaks all the time, the voice of training (instinct()): the gap and its
//     trend, his tells, the light, the crowd, crossing, where to stand. T does what it offers: look in
//     a shop window (its glass shows the street behind), sit on a bench, tie a shoelace, cross here.
//   - **The meeting:** he sits on a boulevard bench and a man in a blue beanie joins him. Both in
//     view, within WITNESS_M, for WITNESS_S seconds: seen, and a lead. Closer than CONTACT_M the
//     contact (a professional) gets a look of his own.
// Every roll goes to the log with a line of flavour. The scenario's progress is plain data in
// state.scenario, read by the UI (the marker, the instinct, the brief and the result).
import { townOf } from '../cities/index.js';
import { at, TICK_MS, calendar, dateText } from '../clock.js';
import { handler, sheet, seedFrom, streetLook, describe, asOfficer } from '../people.js';
import { heatKey, addHeat } from '../heat.js';
import { say as logSay, speak } from '../log.js';
import { CRAFT, sigOf, twinsOf } from '../dossier.js';
import { skill } from '../skills.js';
import { opposed, check } from '../checks.js';
import { range, int, chance, pick, weighted, hash, stream } from '../rng.js';
import { act, offer, paneNear, seatTaken, crossingAt, crossingNear, say1 } from '../acts.js';
import { settle, place, onStreet } from '../instinct.js';
import { Z, SECTION_M, inLane, streetName } from '../map/street.js';
import { near, sectionAt } from '../world.js';
import { planRoute, routeFrom, sectionOf, pointAt, finish, LINE } from '../city.js';
import { withHabits, withEnd } from '../habits.js';
import { mods as showsMods } from '../notice.js';
import { weatherMods, weatherAt } from '../weather.js';
import { sendBus, busLeadMs, pulledIn, release } from '../traffic.js';
import { begin as beginFight } from '../fight.js';
import { strain } from '../needs.js';
import { makeAgent, setRoute, follow as followTarget, rowOf, onMap } from '../agents.js';
import { isPasserby } from '../crowd.js';
import { lightBand } from '../light.js';
import { eyes, sees, seesActor, inView, lightHere, openAir, wrap } from '../perception.js';

export const KEEP_M = 22;
export const KEEP_EVERY_S = 6;
export const FIND_EVERY_S = 2;
export const REVEAL_M = 9;
export const MARKER_S = 30;                                        // the marker over him, from his door: this long, then it's our eyes
export const CLOSE_LOOK_S = 2;                                     // eyes held on a grey coat (E) this long: a close look
export const CLOSE_LOOK_M = 24;
export const CLOSE_LOOK_AGAIN_S = 8;
export const LOST_S = 90;
export const WITNESS_M = 20;
export const WITNESS_S = 12;
export const CONTACT_M = 6;
export const MEET_ROWS = [10, 12];                                  // how many streets away his bench is
export const MEET_EAST_M = [150, 550];                             // and how far along, east or west
export const TELL_S = { calm: [1.6, 2.6], wary: [1.0, 1.8] };
export const SCAN_M = { look: 45, window: 25, exit: 30, cross: 32, double: 22 };
export const DOUBLE_GRACE_S = 2.5;                                 // (his turn on his heel takes a moment: time to look away, walk on)
export const MIRROR_GRACE_S = 8;                                   // (the evening's first seconds: you've only just got your feet)
export const TWINS = 3;
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
    const ev = eveningOf(state), B = state.scenario.brief;
    if (B) return { title: B.title, body: B.body, footer: `Station ${CITY_NAME[state.map.city] ?? 'Moscow'} · ${dateText(state.scenario.began)} · ${hhmm(ev.h, ev.m)}`, keys: tail.keys.map(([k, v]) => [k, sub(state, v)]) };   // (a campaign's: its own words, sim/dossier.js)
    return subAll(state, {
      title: 'TAILING: GENNADY ORLOV',
      body: [
        'Gennady Orlov, 54. Deputy head of procurement at a defence plant. Twenty years ago an officer of the GRU, and he hasn\'t forgotten all of it.',
        'Some days he leaves the office and walks somewhere he doesn\'t tell his wife about. Grey coat, grey fedora, a briefcase. Plenty of men in Moscow wear a grey coat.',
        'Follow him and see whom he meets. He will check for a tail. If he sees the same face twice he\'ll go home, and we won\'t get this chance again.',
        `${ev.light} You'll see which man he is as he comes out. After that it's your eyes and your training: keep him in sight, keep people between you, keep his pace, and don't stop when he stops. Your instinct will talk you through it.`,
      ],
      footer: `Station Moscow · Tuesday 3 November 2026 · ${hhmm(ev.h, ev.m)}`,
      keys: tail.keys,
    });
  },
  keys: [['instinct', 'does what your instinct offers'], ['use', 'what\'s at hand (a window, a bench, a zebra)'], ['slow', 'held: stroll, to keep his pace'], ['watch', 'held: stop and look, the move keys turning your eyes (at a shop window, along its glass); on a grey coat, a close look'], ['log', 'the log']],

  setup(state, { campaign: C = null, city = null, lesson = null, character = null } = {}) {
    const r = state.rng;
    // (from a campaign, its context: the character, the time, the city, the target: sim/campaign.js context(); in a lesson, its evening)
    const ev = C ? campaignEvening(C) : EVENINGS.find(e => e.id === lesson?.options?.evening) ?? weighted(r, EVENINGS.map(e => [e, e.w]));
    state.time.ms = C ? C.startMs : at(2026, 11, 3, ev.h, ev.m);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.country = C?.country ?? 'ru';
    state.heat[heatKey('embassy', state.country)] = C?.heat ?? 20;
    const me = C ? { ...structuredClone(C.player), id: 'me' } : asOfficer(handler(r), character);
    state.people[me.id] = me;
    state.player = me.id;
    // (a campaign's target is his file's (sim/dossier.js): his look, how careful he is (CRAFT), the man he
    // meets, the men who could be him from a few paces; the test's, Orlov)
    const F = C?.target?.craft ? CRAFT[C.target.craft] : null, look = C?.target?.look ?? ORLOV_LOOK, cLook = C?.target?.contact?.look ?? CONTACT_LOOK;
    state.people.orlov = sheet({ id: 'orlov', name: C?.target?.name ?? 'Gennady Orlov', sex: 'm', cls: 'spook', os: 20,
      skills: { pathfinding: [F?.pathfinding ?? 10, 0], awareness: [F?.awareness ?? 8, 1], deception: [8, 0], social: [5, 1], cqc: [10, 0] }, langs: { ru: 'native', en: 'basic' }, look, persistent: true });   // (ex-GRU: he had the course, years ago)
    state.people.contact = sheet({ id: 'contact', name: C?.target?.contact ? describe(cLook, 'm') : 'the man in the blue beanie', sex: 'm', cls: 'spook', os: 30,
      skills: { pathfinding: [10, 2], awareness: [10, 2], deception: [10, 1], cqc: [15, 0] }, langs: { ru: 'native' }, look: cLook, persistent: true });
    const looks = C?.target?.look ? twinsOf(look, stream('twins', C.target.name, C.startMs)) : TWIN_LOOKS.slice();
    for (let i = 0; i < TWINS; i++) {
      const [tl, tell] = looks.splice(int(r, looks.length), 1)[0];
      state.people[`twin${i}`] = { ...sheet({ id: `twin${i}`, name: 'a man in a grey coat', sex: 'm', look: tl, skills: { awareness: [2, 0] } }), tell };
    }
    // (a campaign's tail is at his office's door on the posting's streets, walked to: sim/places.js officeOf(); R its street)
    const R = C?.at?.row ?? 0;
    state.map = { kind: 'street', seed: C ? C.mapSeed : seedFrom(r), row: R, i0: null, i1: null, crowd: 1, city: C?.city ?? city ?? undefined };
    const seed = townOf(state.map);
    // His office: a door near the middle of the street.
    const door = C?.at ? { x: C.at.x } : [0, 1].flatMap(i => sectionOf(seed, 0, i).doors).find(d => d.x > 14 && d.x < 26 && d.kind !== 'arch' && d.z === Z.front) ?? { x: 20 };
    // His bench: ten streets and more away, a few hundred metres along.
    const dir = chance(r, 0.6) ? -1 : 1, row = R + dir * (MEET_ROWS[0] + int(r, MEET_ROWS[1] - MEET_ROWS[0] + 1));
    const along = door.x + (chance(r, 0.7) ? 1 : -1) * range(r, ...MEET_EAST_M);
    const bench = benchNear(seed, row, along);
    const meet = { row, x: bench.seats[0], z: 12.96, seat2: bench.seats.at(-1), place: null, seats: bench.seats.slice() };   // (the contact at the far end)
    // The way there, his way: a little roundabout always; a wary man much more.
    const evasive = F ? (C.made ? 4 : F.evasive) : ev.wary ? 4 : 1;   // (how roundabout: his craft, or made of us before)
    const route = withEnd(withHabits(seed, planRoute(seed, { row: R, x: door.x, z: Z.front + 0.3 }, meet, { walker: hash(seed, 'orlov'), evasive, rng: r }), r, ev.wary ? 'wary' : 'calm'),
      { kind: 'meet', ticks: 75 * TPS, face: 'down', gait: 'sit' });
    route.stops.unshift({ kind: 'leave', s: 0, ticks: 2 * TPS, face: 'down' });
    const t = makeAgent(state, { who: 'orlov', row: R, x: door.x, z: Z.front + 0.3, speed: range(r, 1.2, 1.4), f: range(r, -0.6, 0.6), face: 'down' });
    setRoute(state, t, route);
    // We wait on his pavement, behind the way he'll go: his first way along the street. Walked to, where we stand.
    const first = route.pts.find(p => Math.abs(p.x - door.x) > 3), dirX = first ? Math.sign(first.x - door.x) : 1;
    const stand = C?.me ? { x: C.me.x, z: C.me.z } : { x: door.x - dirX * range(r, 17, 22), z: LINE.F }, facing = Math.sign(door.x - stand.x) || dirX;
    const mePlace = { id: 'a0', who: me.id, seed: null, row: R, x: stand.x, z: stand.z, vx: 0, vz: 0, face: facing > 0 ? 'right' : 'left', head: facing > 0 ? 0 : Math.PI, gait: 'idle', stride: 0, stuck: 0, ai: null };
    state.actors.unshift(mePlace);
    state.scenario = {
      kind: 'tail', evening: ev.id, ev: C ? ev : undefined, campaign: !!C, what: C?.target?.what ?? undefined, wary: ev.wary, phase: 'tail', target: t.id, contact: null, twins: [], meet,
      seats: meet.seats.map(x => ({ row: meet.row, x })),           // (his bench, kept for them: nobody else sits there)
      marked: t.id, lastSeen: { row: R, x: t.x, z: t.z, ms: state.time.ms }, lastSeenT: state.time.ms, unseenS: 0, keepS: 0, findS: 0, startX: door.x, startRow: R,
      alert: F ? (C.made ? 25 : F.alert) : ev.wary ? 25 : 0, sightings: [], scan: null, lastScanMs: null, tell: null, shop: null, warned: 0, mixups: 0, stillS: 0, mirrorMs: -1e12, gap: [],
      witnessS: 0, meetS: 0, closest: 1e9, farthest: 0, prompt: null, outcome: null, lead: null, rolls: 0, began: state.time.ms, turn: null,
      streets: route.rows, routeM: Math.round(route.length), markUntil: state.time.ms + MARKER_S * 1000, lookAt: null, looked: {},
      sig: C?.target?.look ? sigOf(look) : undefined, contactSig: C?.target?.contact ? sigOf(cLook) : undefined, brief: C?.brief, month: C ? calendar(state.time.ms).month : undefined,
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
    if (a.who === 'contact' && phase === 'end') setRoute(state, a, planRoute(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, { row: rowOf(state, a), x: a.x + 70, z: LINE.P }));
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
    if (!p?.act) return say(state, bus, { kind: 'instinct', text: me.busy || me.ai?.cover || me.glass ? 'You\'re at it. Moving stops it.' : 'Nothing to do but walk. Keep him in sight.' });
    if (me.ai) return agentCover(state, bus, me, p.act);
    act(state, bus, me, p.act, { toward: tail.toward(state, me) });
  },

  /** Where the picture leans: whom we take for him, while he's in sight (src/render/view.js). */
  watch(state) { const sc = state.scenario, a = sc.marked && !sc.outcome && inView(state, sc.marked) && actorOf(state, sc.marked); return a && onMap(state, a) ? { x: a.x, z: a.z } : null; },

  /** A shop window's glass, to run his way: he's watched in it. */
  toward(state, me) { const t = actorOf(state, state.scenario.target); return t ? Math.sign(t.x - me.x) || 1 : undefined; },

  think(state, a, bus) {
    // (agents walk by themselves; in autoplay the player's character does what its instinct offers)
    if (a.who === state.player && state.autoplay) autoplay(state, a, bus);
  },

  /**
   * F on someone (sim/interact.js): a word with him (or his contact) makes the tail, face to face; a
   * blow blows it, and the meeting with it. It ends when the fight's over (sc.after).
   */
  onInteract(state, bus, them, id) {
    const sc = state.scenario;
    if (sc.outcome || sc.after || !['orlov', 'contact'].includes(them.who) || id === 'read' || id === 'aid') return;
    const who = them.who === 'orlov' ? 'the man you were sent to follow' : 'the man he came to meet';
    sc.after = id === 'talk' ? ['made', `You spoke to ${who}, face to face, and he'll know that face again anywhere. Orlov goes home the long way, and the meeting never happens.`]
      : ['blown', `You put hands on ${who}. Whatever was meant to happen tonight won't now, and by morning someone will be asking the embassy about an attack in the street.`];
  },

  tick(state, bus) {
    const sc = state.scenario;
    if (sc.outcome) return;
    if (sc.after) { if (!state.fight) { const [outcome, text] = sc.after; sc.after = null; end(state, bus, outcome, text); } return; }
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
export const eveningOf = (state) => state.scenario.ev ?? EVENINGS.find(e => e.id === state.scenario.evening) ?? EVENINGS[0];

/** A campaign's evening: the time it starts, the light by the hour, his wariness the campaign's. */
function campaignEvening(C) {
  const k = calendar(C.startMs), h = k.hour + k.minute / 60;
  return { id: 'campaign', h: k.hour, m: k.minute, wary: !!C.wary, w: 0,
    light: `${h < 15.5 ? 'Broad daylight.' : h < 17 ? 'The light\'s going.' : 'It\'s dark, and the lamps are on.'}${C.made ? ' He\'s been jumpy since the last time.' : ''}` };
}

/**
 * From a campaign, the target is theirs: the test's words with the campaign's name, what he is, the
 * city and the date put in, where words leave the scene. Standalone, nothing changes.
 */
function sub(state, t) {
  const sc = state.scenario, name = state.people.orlov?.name ?? 'Gennady Orlov', family = name.split(' ').slice(-1)[0];
  if (typeof t !== 'string' || !sc?.campaign) return t;
  if (sc.sig) t = sigWords(t, sc.sig, sc.contactSig, CITY_NAME[state.map.city] ?? 'Moscow', sc.month);
  return t.replace(/Gennady Orlov, 54\. Deputy head of procurement at a defence plant\. Twenty years ago an officer of the GRU, and he hasn't forgotten all of it\./, `${name}: ${sc.what ?? 'a man the station wants watched'}.`)
    .replace(/GENNADY ORLOV/g, name.toUpperCase()).replace(/Gennady Orlov/g, name).replace(/Orlov/g, family)
    .replace(/Station Moscow · Tuesday 3 November 2026/, `Station ${CITY_NAME[state.map.city] ?? 'Moscow'} · ${dateText(sc.began)}`);
}
/**
 * The test's words for Orlov (grey coat, grey fedora, a briefcase; Moscow; the man in the blue beanie)
 * in a campaign's target's own (sim/dossier.js sigOf(): "navy coat", "flat cap", "newspaper"; his city;
 * the man he meets), wherever the scene says them: the instinct, the log, the endings.
 */
export function sigWords(t, s, c, city, month) {
  const C = (w) => w.charAt(0).toUpperCase() + w.slice(1), an = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
  const carry = s.carry === 'walk' ? 'way he walks' : s.carry;
  t = t.replace(/Grey coat, grey fedora, a briefcase/g, `${C(s.coat)}, ${s.hat}, ${an(carry)}`).replace(/grey coat, grey fedora, a briefcase/g, `${s.coat}, ${s.hat}, ${an(carry)}`)
    .replace(/Grey coat, fedora, briefcase/g, `${C(s.coat)}, ${s.hatShort}, ${carry}`).replace(/grey coat, fedora, briefcase/g, `${s.coat}, ${s.hatShort}, ${carry}`)
    .replace(/Fedora, briefcase/g, `${C(s.hatShort)}, ${carry}`).replace(/the grey fedora/g, `the ${s.hat}`).replace(/grey fedora/g, s.hat)
    .replace(/the fedora/g, `the ${s.hatShort}`).replace(/the hat\b/g, `the ${s.hatShort}`).replace(/, a hat\./g, `, ${an(s.hatShort)}.`)
    .replace(/[Gg]rey coats/g, (m) => (m[0] === 'G' ? C(s.coats) : s.coats)).replace(/[Gg]rey coat/g, (m) => (m[0] === 'G' ? C(s.coat) : s.coat))
    .replace(/briefcase/g, carry).replace(/Moscow/g, city);
  if (c) t = t.replace(/the man in the blue beanie/g, c.man).replace(/a man in a blue beanie/g, c.man.replace(/^the /, 'a ').replace(/ the /, ' a ')).replace(/blue beanie/g, c.man.replace(/^the man in the /, ''));
  if (month) t = t.replace(/in November/g, `in ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]}`);
  return t;
}
/** The scene's log, in the campaign's words (sub()). */
const say = (state, bus, e) => logSay(state, bus, e && typeof e.text === 'string' ? { ...e, text: sub(state, e.text) } : e);
const subAll = (state, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => (typeof x === 'string' ? sub(state, x) : x)) : sub(state, v)]));
const CITY_NAME = { moscow: 'Moscow', london: 'London', beirut: 'Beirut', cairo: 'Cairo' };

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
    if (stop.kind === 'bus' && sc.hit && !sc.hit.waiting) { sc.hit.waiting = true; sc.hit.busAt = state.time.ms + Math.round(range(state.rng, ...BUS_WAIT_S) * 1000); }   // (at his stop: the umbrella)
    return;
  }
  if (SCANS[stop.kind]) endScan(state, t);
  if (stop.kind === 'exit') sc.shop = null;
  if (stop.kind === 'meet') {                                      // the meeting's over: he walks away west along the path
    sc.phase = 'after';
    if (!sc.outcome) end(state, bus, 'missed', MISSED);             // (seen, it ended when we'd seen enough)
    setRoute(state, t, planRoute(townOf(state.map), { row: rowOf(state, t), x: t.x, z: t.z }, { row: rowOf(state, t), x: t.x - 120, z: LINE.P }));
  }
}

/** The contact comes along the path from the east to the bench's other seat, sits a minute, goes. */
function spawnContact(state, orlov) {
  const sc = state.scenario, row = rowOf(state, orlov), seed = townOf(state.map);
  const c = makeAgent(state, { who: 'contact', row, x: orlov.x + 34, z: LINE.P, speed: 1.25, face: 'left' });
  const route = planRoute(seed, { row, x: c.x, z: LINE.P }, { row, x: sc.meet.seat2, z: 12.96 });
  route.stops = [{ kind: 'sit', s: route.length, ticks: 60 * TPS, face: 'down', gait: 'sit' }];
  setRoute(state, c, route);
  return c.id;
}

/** After his first sighting of us: he dry-cleans. Back the way he came a little, then on, the long way. */
function dryClean(state, t) {
  const sc = state.scenario, seed = townOf(state.map), r = state.rng;
  const back = pointAt(t.ai.route, Math.max(0, t.ai.s - range(r, 14, 22)));
  const here = { row: rowOf(state, t), x: t.x, z: t.z };
  const leg1 = routeFrom(seed, here, { row: back.row, x: back.x, z: back.z });
  const leg2 = planRoute(seed, { row: back.row, x: back.x, z: back.z }, sc.meet, { walker: hash(seed, 'orlov', state.time.ms), evasive: 2, rng: r });
  const route = withEnd(withHabits(seed, { ...leg2, pts: [...leg1.pts, ...leg2.pts.slice(1)] }, r, 'wary'), sc.hit ? { kind: 'bus', ticks: 45 * 60 * TPS, face: 'down', gait: 'idle' } : { kind: 'meet', ticks: 75 * TPS, face: 'down', gait: 'sit' });
  setRoute(state, t, route);
  sc.scan = { kind: 'double', rolled: false, ms: state.time.ms, untilS: leg1.length };
}

/** Made: he turns for home, the way he came. */
function goHome(state, t) {
  const seed = townOf(state.map);
  setRoute(state, t, routeFrom(seed, { row: rowOf(state, t), x: t.x, z: t.z }, { row: state.scenario.startRow ?? 0, x: state.scenario.startX, z: LINE.F }));
}

/** In autoplay: the player's character does what its instinct offers when it warns of a check. */
function autoplay(state, me, bus) {
  const sc = state.scenario, p = sc.prompt;
  if (sc.outcome || !p || me.ai.cover || me.ai.hold > state.time.ms) return;
  if (p.tone === 'urgent' && (p.act === 'window' || p.act === 'lace' || p.act === 'mobile' || p.act === 'bench') && state.tick % TPS === 1) agentCover(state, bus, me, p.act);
}

/** Cover for an agent player (the autoplay, or T in autoplay): a short detour or a stop, then on. */
function agentCover(state, bus, me, what) {
  const seed = townOf(state.map), row = rowOf(state, me), here = { row, x: me.x, z: me.z, w: 0, way: 'attach' };
  let pts = [here, { ...here }], stop;
  if (what === 'window') {
    // (at the end of the pane away from him, so the glass runs his way: he's watched in it)
    const p = paneNear(state, me), t = actorOf(state, state.scenario.target);
    if (!p) return;
    const gx = t && t.x > me.x ? p.x0 + 0.4 : p.x1 - 0.4;
    pts = [here, { row, x: gx, z: me.z, w: 0 }, { row, x: gx, z: p.z + 0.65, w: 0 }];
    stop = { kind: 'window', ticks: 5 * TPS, face: 'up', glass: true };
  } else if (what === 'lace') { stop = { kind: 'lace', ticks: 3 * TPS, face: me.face, gait: 'crouch' }; state.scenario.laceMs = state.time.ms; }
  else if (what === 'mobile') { stop = { kind: 'mobile', ticks: 6 * TPS, face: me.face, gait: 'phone' }; state.scenario.mobileMs = state.time.ms; }
  else if (what === 'bench') {
    const seats = (sectionAt(state, me.x)?.props ?? []).filter(p => p.kind === 'bench').flatMap(p => p.seats).filter(x => !seatTaken(state, x, me)).sort((a, b) => Math.abs(a - me.x) - Math.abs(b - me.x));
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
// sheet of their own, so a look of their own), and goes as passers-by go (the crowd's bubble lets them
// go, well past). Most come up from behind, quicker than him, on his pavement, and overtake him: the
// ones you could swap him for. Some come out of a shop ahead of him; the rest come the other way.
function twins(state, t) {
  const sc = state.scenario, r = state.rng, me = playerOf(state), seed = townOf(state.map), row = rowOf(state, t);
  sc.twins = sc.twins.filter(id => actorOf(state, id));
  const dir = Math.sign(t.vx) || Math.sign(t.x - me.x) || 1, his = lineNear(t.z);
  for (let i = 0; i < TWINS; i++) {
    const who = `twin${i}`;
    if (state.actors.some(a => a.who === who) || !chance(r, TWIN_CHANCE)) continue;
    const how = weighted(r, [['behind', 4], ['shop', his === LINE.F ? 2 : 0], ['ahead', 2]]);
    let x, z = his, z1 = his, heading, speed;
    if (how === 'behind') { x = me.x - dir * range(r, 24, 30); heading = dir; speed = range(r, 1.75, 1.95); }
    else if (how === 'ahead') { z = z1 = weighted(r, [[LINE.F, 3], [LINE.N, 2], [LINE.P, 1]]); x = (dir > 0 ? Math.max(t.x, me.x) : Math.min(t.x, me.x)) + dir * range(r, 26, 36); heading = -dir; speed = range(r, 1.1, 1.5); }
    else {
      const door = [...state.$world.sections.values()].flatMap(S => S.doors).find(d => d.kind === 'shop' && d.z === Z.front && (d.x - t.x) * dir > 4 && (d.x - t.x) * dir < 30);
      if (!door) continue;
      x = door.x; z = Z.front + 0.3; heading = chance(r, 0.5) ? 1 : -1; speed = range(r, 1.2, 1.5);
    }
    if (Math.abs(x - me.x) < 21 && sees(state, eyes(state, me), x, z)) continue;   // (never out of thin air in front of us)
    const plan = { kind: 'way', from: { row, x, z }, to: { row, x: x + heading * 150, z: z1 } };
    const a = makeAgent(state, { who, row, x, z, speed, f: range(r, -0.6, 0.6), face: heading > 0 ? 'right' : 'left' });
    try { Object.assign(a.ai, { civ: true, plan, $route: routeFrom(seed, plan.from, plan.to) }); } catch { state.actors = state.actors.filter(o => o !== a); continue; }
    sc.twins.push(a.id);
  }
}
const lineNear = (z) => Object.values(LINE).reduce((b, l) => (Math.abs(l - z) < Math.abs(b - z) ? l : b), LINE.F);

// ---------- the dice ----------

/** He's about to check: do we read it coming? (Awareness, if we're watching him.) */
function tell(state, bus, t, kind) {
  const sc = state.scenario, me = playerOf(state);
  sc.tell = { kind, ms: state.time.ms, read: false };
  if (!me || sc.outcome || sc.marked !== t.id) return;
  const d = Math.hypot(t.x - me.x, t.z - me.z);
  if (!inView(state, t.id)) return;                               // we weren't looking
  const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player],
    dc: 10 + (sc.wary ? 3 : 0) + Math.round(sc.alert / 25) + (d > 35 ? 6 : d > 25 ? 3 : 0) });
  sc.rolls++;
  if (r.ok) { sc.tell.read = true; sc.warned++; }
}

/** A check under way: the first moment we're in his sight, he rolls. */
function scanning(state, bus, me, t, d) {
  const sc = state.scenario;
  if (!sc.scan || sc.scan.rolled) return;
  if (sc.scan.kind === 'double' && state.time.ms - sc.scan.ms < DOUBLE_GRACE_S * 1000) return;
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
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] },
    { skill: 'pathfinding', value: skill(state.people.orlov, 'pathfinding'), body: state.people.orlov, mods: [...mods, ...inHand(state), ...weatherMods(state)] });
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
  if (watching) strain(state, bus, 8);                             // (you saw him see you: sim/needs.js)
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
  // (in the dark, a face behind is a shape: close counts for little unless it's right behind him)
  const dark = lightBand(lightHere(state, me.x, me.z)) === 'dark';
  if (d < 5) mods.push({ why: 'too close', v: 6 }); else if (d < 10) mods.push({ why: 'close', v: dark ? 1 : 3 });
  else if (d > 35) mods.push({ why: 'far off', v: -6 }); else if (d > 25) mods.push({ why: 'well back', v: -4 }); else if (d > 15) mods.push({ why: 'a good way back', v: -2 });
  const n = crowdAround(state, me, 5);
  if (n === 0 && crowdAround(state, me, 8) === 0) mods.push({ why: 'alone on the pavement', v: 2 });
  else if (n >= 5) mods.push({ why: 'in a crowd', v: -4 }); else if (n >= 2) mods.push({ why: 'among people', v: -2 });
  const lit = lightHere(state, me.x, me.z), light = lightBand(lit);
  if (light === 'dark') mods.push({ why: 'in the dark', v: -5 }); else if (light === 'dim') mods.push({ why: 'in the dusk', v: -2 });
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
    return { window: { why: 'busy at a shop window', v: -3 }, bench: { why: 'sitting on a bench', v: -3 }, mobile: { why: 'looking at a phone', v: -2 }, lace: { why: 'tying a shoelace', v: -1 } }[ac.what] ?? null;
  }
  const b = me.busy, s = b?.steps[0], scan = state.scenario.scan;
  if (b && scan && b.since >= scan.ms) return { why: 'stopping short as he looked', v: 2 };
  if (me.glass) return scan && me.glass.since >= scan.ms ? { why: 'stopping short as he looked', v: 2 } : { why: 'busy at a shop window', v: -3 };
  if (b?.what === 'bench' && me.gait === 'sit') return { why: 'sitting on a bench', v: -3 };
  if (b?.what === 'lace' && s?.[0] === 'wait') return { why: 'tying a shoelace', v: -1 };
  if (b?.what === 'mobile' && s?.[0] === 'wait') return { why: 'looking at a phone', v: -2 };   // (the street's own: everyone does it)
  if (b?.what === 'kiosk' && s?.[0] === 'wait') return { why: 'reading a paper at the kiosk', v: -2 };   // (sim/acts.js spotNear())
  if (b?.what === 'phone' && s?.[0] === 'wait') return { why: 'on the phone in a phone box', v: -3 };
  if (b?.what === 'shelter' && s?.[0] === 'wait') return { why: 'waiting for a bus', v: -3 };
  if (b?.what === 'notices' && s?.[0] === 'wait') return { why: 'reading a notice board', v: -2 };
  if (!b && crossingAt(state, me) && me.gait === 'idle' && (Math.abs(me.z - Z.kerbN) < 1.6 || Math.abs(me.z - Z.kerbS) < 1.6)) return { why: 'waiting to cross', v: -1 };
  if (!b && state.scenario.hit && atStop(state, me)) return { why: 'waiting at a bus stop', v: -2 };   // (the umbrella: his own stop)
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
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] },
    { skill: 'awareness', value: skill(state.people.orlov, 'awareness'), body: state.people.orlov, mods: [d < 10 ? { why: 'close', v: 3 } : d > 20 ? { why: 'a good way back', v: -3 } : null, ...inHand(state)].filter(Boolean) });
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
  const r = check(state.rng, { skill: 'tracking', value: skill(state.people[state.player], 'tracking'), body: state.people[state.player], dc: keepDC(state, t, d), mods });
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

const crowdAround = (state, who, r) => near(state, who.x, who.z, r).filter(o => isPasserby(o) && !o.hidden).length;

// ---------- once a second: keeping him, finding him, his mood, the meeting, the instinct ----------

function second(state, bus, me, t, d) {
  const sc = state.scenario;
  const still = Math.hypot(me.vx, me.vz) < 0.05 && !me.busy && !me.ai?.cover;
  const same = rowOf(state, t) === rowOf(state, me);
  sc.stillS = still ? sc.stillS + 1 : 0;
  // Mirroring: he's stopped (a pause, a window, a look) and so have we, in the open, near him.
  const stopped = !t.hidden && Math.hypot(t.vx, t.vz) < 0.05;
  if (stopped && still && d < 30 && !coverNow(state, me) && sc.stillS >= 2 && state.time.ms - sc.began > MIRROR_GRACE_S * 1000) sc.mirrorMs = state.time.ms;
  sc.alert = Math.max(sc.wary ? 15 : 0, sc.alert - 0.15);
  if (same) { sc.gap.push(Math.round(d * 10) / 10); if (sc.gap.length > 6) sc.gap.shift(); } else sc.gap = [];
  if (same && onMap(state, t)) twins(state, t);
  // His way into a lane: which, and did we see him take it?
  if (onMap(state, t) && (t.z < Z.front - 0.5 || t.z > Z.south + 0.5)) {
    const S = sectionAt(state, t.x), north = t.z < 0, g = north ? S?.gapsN.find(g => inLane(g, t.x, t.z, 0.5)) : S?.gapsS.find(g => t.x >= g.x0 - 0.5 && t.x <= g.x1 + 0.5);
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
    const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player], dc: 15 });
    sc.rolls++;
    sc.sensed = r.ok;
    if (r.ok) say(state, bus, { kind: 'roll', roll: r, text: 'Something\'s changed in how he walks: shorter steps, his head up. He\'s seen something behind him. Possibly you.' });
  }
  closeLook(state, bus, me, t);
  if (sc.markUntil && state.time.ms >= sc.markUntil && !sc.markGone) {
    sc.markGone = true;
    say(state, bus, { kind: 'instinct', text: 'That\'s him, and from here on it\'s your eyes: the grey fedora, the briefcase. Plenty of grey coats in Moscow. Hold {watch} on one for a close look.' });
  }
  if (sc.unseenS >= LOST_S) {
    if (!sc.hit) return end(state, bus, 'lost', GONE);
    if (sc.marked === t.id) { sc.marked = null; sc.findS = 0; }      // (the umbrella: he'll come to his stop; pick him out when he does)
  }
  if (sc.marked === t.id && same) sc.farthest = Math.max(sc.farthest, d);
  if (sc.hit) hitSecond(state, bus, me, t, d);
  else if (sc.phase === 'meet') meeting(state, bus, me, t, d);
  if (sc.outcome) return;
  // (every rule that fires, and the engine's choice: the line up stays while it still applies: sim/instinct.js)
  const was = sc.prompt?.id;
  sc.prompt = settle(sc.prompt, [...instinct(state, me, t, d, still)].map(l => l && { ...l, text: sub(state, l.text) }), state.time.ms);
  if (sc.prompt && sc.campaign) sc.prompt.text = sub(state, sc.prompt.text);
  if (sc.prompt?.log && sc.prompt.id !== was) say(state, bus, { kind: 'instinct', text: sc.prompt.text.replace(/\s*\{[a-z]+\}.*$/, '') });
}

/** Lost: the grey coats in view, nearest first, and an Awareness roll on each to tell if it's him. */
function find(state, bus, me, t) {
  const sc = state.scenario;
  const candidates = [t, ...sc.twins.map(id => actorOf(state, id))].filter(o => o && !o.hidden && inView(state, o.id))
    .map(o => [o, Math.hypot(o.x - me.x, o.z - me.z)]).filter(([, dd]) => dd < 32).sort((a, b) => a[1] - b[1]);
  for (const [o, dd] of candidates) {
    const light = lightBand(lightHere(state, o.x, o.z)), crowd = crowdAround(state, o, 3);
    const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player], dc: 10,
      mods: [dd > 15 && { why: 'at a distance', v: -Math.round((dd - 15) / 4) }, crowd && { why: 'people round him', v: -crowd },
        light !== 'day' && { why: light === 'dark' ? 'the dark' : 'the dusk', v: light === 'dark' ? -4 : -2 }, ...weatherMods(state)].filter(Boolean) });
    sc.rolls++;
    if (o === t) {
      if (r.ok) { sc.marked = t.id; sc.lastSeen = { row: rowOf(state, t), x: t.x, z: t.z, ms: state.time.ms }; say(state, bus, { kind: 'roll', roll: r, text: `${pick(state.rng, foundLines)} ${cap(whereIs(me, t))}.` }); }
      return;
    }
    if (!r.ok && dd > REVEAL_M) {                                  // a grey coat, and we take it for his
      sc.marked = o.id; sc.mixups++; sc.lastSeen = { row: rowOf(state, o), x: o.x, z: o.z, ms: state.time.ms };
      say(state, bus, { kind: 'roll', roll: r, text: `${pick(state.rng, wrongLines)} ${cap(whereIs(me, o))}.` });
      return;
    }
  }
}

/**
 * A close look (E held, eyes on a grey coat for CLOSE_LOOK_S): Awareness, against the distance, the
 * light and the people round them, tells him from his twins. Once a second.
 */
function closeLook(state, bus, me, t) {
  const sc = state.scenario;
  if (!me.looking) { sc.lookAt = null; return; }
  const coats = [t, ...sc.twins.map(id => actorOf(state, id))].filter(o => o && !o.hidden && onMap(state, o) && inView(state, o.id));
  let best = null, ba = 0.35;
  for (const o of coats) {
    const dd = Math.hypot(o.x - me.x, o.z - me.z), da = Math.abs(wrap(Math.atan2(o.z - me.z, o.x - me.x) - me.head));
    if (dd < CLOSE_LOOK_M && da < ba) { best = o; ba = da; }
  }
  if (!best || (sc.looked[best.id] ?? -1e12) > state.time.ms - CLOSE_LOOK_AGAIN_S * 1000) { sc.lookAt = null; return; }
  sc.lookAt = sc.lookAt?.id === best.id ? { id: best.id, s: sc.lookAt.s + 1 } : { id: best.id, s: 1 };
  if (sc.lookAt.s < CLOSE_LOOK_S) return;
  sc.looked[best.id] = state.time.ms; sc.lookAt = null;
  const dd = Math.hypot(best.x - me.x, best.z - me.z), light = lightBand(lightHere(state, best.x, best.z)), crowd = crowdAround(state, best, 3);
  const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player], dc: 8,
    mods: [dd > 8 && { why: 'at a distance', v: -Math.round((dd - 8) / 3) }, crowd && { why: 'people round him', v: -crowd },
      light !== 'day' && { why: light === 'dark' ? 'the dark' : 'the dusk', v: light === 'dark' ? -4 : -2 }, ...weatherMods(state)].filter(Boolean) });
  sc.rolls++;
  if (!r.ok) return say(state, bus, { kind: 'roll', roll: r, text: 'A grey coat, a hat. From here, it could be anyone\'s. Closer, or better light.' });
  if (best === t) {
    if (sc.marked && sc.marked !== t.id) { sc.mixupsKnown = (sc.mixupsKnown ?? 0) + 1; say(state, bus, { kind: 'roll', roll: r, text: 'That\'s him: the fedora, the briefcase, that walk. The one you were behind was someone else entirely.' }); }
    else say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, ['That\'s him: the fedora, the briefcase, that walk.', 'Him. The briefcase gives it away, and the way he holds it.']) });
    sc.marked = t.id; sc.findS = 0; sc.lastSeen = { row: rowOf(state, t), x: t.x, z: t.z, ms: state.time.ms };
    return;
  }
  const tell = state.people[best.who]?.tell ?? 'not him';
  if (sc.marked === best.id) { sc.marked = null; sc.findS = 0; sc.mixupsKnown = (sc.mixupsKnown ?? 0) + 1; }
  say(state, bus, { kind: 'roll', roll: r, text: `Not him: ${tell}.` });
}

/** Where someone is, from where we stand, in words (there's no arrow over him: just this). */
function whereIs(me, o) {
  const dx = o.x - me.x, d = Math.hypot(dx, o.z - me.z);
  const how = d < 6 ? 'a few steps off' : d < 15 ? 'close' : d < 30 ? 'a way off' : 'a good way off';
  const side = Math.abs(dx) < 4 ? '' : dx < 0 ? ', to your left' : ', to your right';
  const on = o.z < Z.front ? 'in the lane' : o.z < Z.kerbN ? 'by the shops' : o.z < Z.kerbS ? 'crossing the road'
    : o.z < Z.fence ? 'on the near pavement' : o.z < Z.fenceS ? 'on the boulevard' : o.z < Z.south ? 'on the far side' : 'in the lane south';
  return `${on}, ${how}${side}`;
}

function meeting(state, bus, me, t, d) {
  const sc = state.scenario, c = actorOf(state, sc.contact);
  const together = c && c.gait === 'sit' && Math.abs(c.x - t.x) < 3.5;
  if (!together) {
    if (sc.meetS > 0) end(state, bus, 'missed', MISSED);
    return;
  }
  sc.meetS++;
  const dc = Math.hypot(c.x - me.x, c.z - me.z);
  if (dc < CONTACT_M && !sc.contactLooked && seesActor(state, c, me)) {   // too close: the other man has eyes too
    sc.contactLooked = true;
    const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] },
      { skill: 'pathfinding', value: skill(state.people.contact, 'pathfinding'), body: state.people.contact, mods: [{ why: 'right by the bench', v: 6 }] });
    sc.rolls++;
    if (!r.ok) {
      say(state, bus, { kind: 'roll', roll: r, text: 'The other man looks up from his paper, straight at you. He folds it, stands and goes.' });
      setRoute(state, c, planRoute(townOf(state.map), { row: rowOf(state, c), x: c.x, z: c.z }, { row: rowOf(state, c), x: c.x + 70, z: LINE.P }));
      return end(state, bus, 'blown', 'The meeting\'s over before it began, and Orlov knows why.');
    }
    say(state, bus, { kind: 'roll', roll: r, text: 'The man with the newspaper glances at you over it, and goes back to the football.' });
  }
  if (d < WITNESS_M && inView(state, t.id) && inView(state, c.id)) sc.witnessS++;
  if (sc.witnessS >= WITNESS_S) {
    sc.lead = sub(state, `${clockOf(state)}: Orlov met a man in a blue beanie on a bench on the boulevard. Something passed between them in a newspaper.`);
    say(state, bus, { kind: 'note', text: 'A newspaper changes hands on the bench. He leaves it lighter by an envelope. That\'s the meeting, and you saw it.' });
    end(state, bus, 'seen', sc.sightings.length ? 'You saw the meeting. He saw you once on the way, and put it down to Moscow being a small town.'
      : 'You saw the meeting, and he never knew you were there. The station will want to know who wears that beanie.');
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** What shows on you (sim/notice.js: blood, a weapon in your hand): the eye goes to it, and to you. */
const inHand = (state) => (state.scenario?.hit ? umbrellaMods(state) : showsMods(state.people[state.player]));
const clockOf = (state) => { const m = Math.floor(state.time.ms / 60000) % 1440; return hhmm(Math.floor(m / 60), m % 60); };

// ---------- the instinct ----------

/**
 * What a trained eye tells you now: { id, text, tone ('calm' | 'note' | 'warn' | 'urgent'), act,
 * log }. act is what T does ('window', 'bench', 'lace', 'cross'); {instinct}, {slow}, {watch} in the
 * text show as those keys. The first rule that holds speaks. What's at hand ends a line with nothing
 * of its own to offer (the engine's: sim/acts.js affordance()), but an urgent one: as he looks,
 * stopping is the thing he'd see.
 */
function* instinct(state, me, t, d, still) {
  const sc = state.scenario, seen = inView(state, t.id), marked = sc.marked === t.id;
  const L = (id, tone, text, extra = {}) => ({ id, tone, text: Array.isArray(text) ? say1(state, id, text) : text, act: null, ...extra });
  const busy = me.busy?.what ?? me.ai?.cover?.what ?? (me.glass ? 'window' : null);
  const here = place(state, me), there = place(state, t);
  // (the umbrella's own lines first; in reach, or closing in on him at his stop, the tail's advice to keep back is beside the point)
  if (sc.hit) { const own = [...hitInstinct(state, me, t, d)]; yield* own; if (own.some(l => l.act === 'jab' || l.id === 'wait-stop') || (sc.hit.waiting && d < 12)) return; }
  // The meeting.
  if (sc.phase === 'meet' && sc.contact && seen) {
    const c = actorOf(state, sc.contact), both = c && inView(state, c.id);
    if (c && Math.hypot(c.x - me.x, c.z - me.z) < CONTACT_M + 1) yield L('meet-close', 'urgent', 'Too close to the bench. The other one is a professional.');
    if (both && d < WITNESS_M) yield L('meet-watch', 'note', ['Someone\'s sat down with him. Watch, and don\'t be seen watching.', 'That\'s the meeting. Hold still, eyes on the bench.']);
    else if (!both) yield L('meet-see', 'warn', 'He\'s meeting someone. Get them both in view: hold {watch} and look.');
    else yield L('meet-near', 'warn', `He's meeting someone, ${Math.round(d)} m off. Closer, but not too close.`);
    return;
  }
  if (sc.phase === 'meet' && !seen && marked) { yield L('meet-lost', 'warn', 'He\'s sat down somewhere on the boulevard. Find the bench.'); return; }
  // His tells, read in time; his checks under way.
  if (sc.tell?.read && !sc.scan && state.time.ms - sc.tell.ms < 4000) {
    const o = offer(state, me);
    const what = { turn: 'He\'s slowing at the corner. He\'ll look back before he turns.', look: 'He\'s slowing. He\'s going to look back.', window: 'He\'s drifting to a shop window. He\'ll use the glass.', cross: 'He\'s going to cross. He\'ll look both ways, and that means at you.', double: 'He\'s stopping short. He\'s going to turn round.' }[sc.tell.kind];
    if (busy) yield L(`tell-${sc.tell.kind}`, 'urgent', `${what} Stay at it.`, { log: true });
    else yield L(`tell-${sc.tell.kind}`, 'urgent', `${what}${d < 12 ? ' Don\'t be the face behind him.' : ''}${o.text}`, { act: o.act, log: true });
  }
  if (sc.scan && seen && !busy && d < 25) {                      // (too late for cover: stopping now is the thing he'd see)
    if (sc.scan.kind === 'double') yield L('double', 'urgent', ['He\'s coming back this way. Don\'t meet his eyes. Walk on.', 'He\'s doubling back. Keep walking, look at anything but him.']);
    else yield L('scan', 'urgent', ['He\'s looking. Be part of the street. Nothing sudden.', 'His eyes are on the street. Keep doing what you\'re doing.']);
  }
  if (me.gait === 'run' && d < 40) yield L('run', 'urgent', ['Don\'t run. Running is the one thing everyone sees.', 'Don\'t run. Nobody runs in Moscow in November unless something\'s on fire.']);
  // Lost, or someone else taken for him: nothing about the gap (the instinct knows what you know).
  if (!sc.marked) {
    if (!sc.lastSeen) { yield L('lost', 'warn', 'You\'ve lost him. Grey coat, grey fedora, a briefcase. Find him.'); return; }
    const ago = Math.round(Math.hypot(sc.lastSeen.x - me.x, sc.lastSeen.z - me.z)), dir = sc.lastSeen.x > me.x ? 'east' : 'west';
    yield L('lost', 'warn', [`You've lost him. Last seen ${ago} m ${dir} of here. Look for the grey coat and the briefcase.`,
      `Lost him. He was ${ago} m ${dir} of you; grey coat, fedora, briefcase, like a few thousand others.`]);
    return;
  }
  if (!marked) {
    const w = actorOf(state, sc.marked), wd = w ? Math.hypot(w.x - me.x, w.z - me.z) : 99;
    // (a twin, unbeknown: the instinct is as sure as you are, and says what it would say of him)
    yield wd < 14 ? L('twin-close', 'warn', 'Closer than you\'d like. Is that the briefcase? Hard to say from here.') : L('status', 'calm', `${Math.round(wd)} m behind him.`);
    return;
  }
  // Through a lane to another street: known only if we saw him take it.
  if (rowOf(state, t) !== rowOf(state, me) && sc.turn?.seen && sc.turn.row === rowOf(state, me)) {
    const w = sc.turn, inLane = me.x > w.x0 - 0.5 && me.x < w.x1 + 0.5 && (w.north ? me.z < Z.front : me.z > Z.south);
    const gd = Math.round(inLane ? (w.north ? me.z - Z.north : Z.edge - me.z) : Math.abs((w.x0 + w.x1) / 2 - me.x) + (Z.front - Z.north));
    yield L('away', 'warn', [`He's gone ${w.north ? 'up' : 'down'} ${w.name}: ${gd} m to the far end. Through it after him, or you've lost him.`, `${cap(w.name)}: he's through it and out the other end by now. Follow, or lose him.`]);
    return;
  }
  if (sc.turn?.seen && sc.turn.row === rowOf(state, t) && there.at === 'lane' && here.at !== 'lane' && seen) yield L('turn', 'warn', [`He's turned ${sc.turn.north ? 'up' : 'down'} ${sc.turn.name}. Give him the corner: it's empty in there, and narrow.`, `${cap(sc.turn.name)}. Don't follow him straight in: let him get to the far end.`]);
  // In a lane with him: narrow, empty, nowhere to be but behind him.
  if (here.at === 'lane' && there.at === 'lane' && seen) {
    if (d < 25) yield L('lane-close', 'warn', [`In a lane there's nowhere to be but behind him, ${Math.round(d)} m. Hang back till he's out the far end.`, `${Math.round(d)} m, in a lane: he only has to turn his head. Let him clear the far end.`]);
    else yield L('lane', 'calm', `${Math.round(d)} m behind him in the lane. Good: when he's out the other end, close up.`);
  }
  if (t.hidden && rowOf(state, t) === rowOf(state, me)) {
    const shop = SHOPS[sc.shop] ?? 'a shop', o = offer(state, me);
    if (d < 8) yield L('shop-door', 'warn', [`He's in ${shop}. Don't hover at the door: walk on, or cross over.`, `He's in ${shop}. Hovering at the door is how you end up in the same queue. Walk on.`]);
    else if (o.act === 'window' && !busy) yield L('shop-wait', 'note', `He's in ${shop}. Wait where you can see the door.${o.text}`, { act: o.act });
    else yield L('shop', 'note', `He's gone into ${shop}. He'll come out looking: be somewhere you'd be anyway, with the door in sight.`);
    return;
  }
  if (me.glass && !seen && sc.unseenS >= 2) yield L('glass-lost', 'warn', ['He\'s not in the glass. Hold {watch} and slant your eyes along it his way, or walk on.', 'The glass shows you the street, not him. Slant your eyes along it ({watch} held), or move.']);
  if (me.glass && seen && d >= 9 && state.time.ms - me.glass.since < 6000) yield L('glass', 'calm', [`There he is, in the glass, ${Math.round(d)} m off. Keep him in it.`, 'You have him in the glass, and he has your back. Keep it that way.']);
  if (!seen && sc.unseenS >= 3) {
    const ld = sc.lastSeen ? Math.round(Math.hypot(sc.lastSeen.x - me.x, sc.lastSeen.z - me.z)) : null;
    const where = ld === null ? 'ahead' : ld < 5 ? 'right about here' : `${ld} m ${sc.lastSeen.x > me.x ? 'east' : 'west'} of you`;
    yield sc.unseenS > 20 ? L('unseen-long', 'warn', [`You haven't seen him for ${sc.unseenS} seconds. That's generally considered a problem. He was ${where}.`, `Still no sign of him. He was ${where}. Get eyes on him.`])
      : L('unseen', 'warn', `You can't see him. ${sc.unseenS > 12 ? 'You\'re losing him: he' : 'He'} was ${where}. Get eyes on him.`);
    return;                                                         // (out of sight: nothing about the gap)
  }
  // Distance and its trend (m/s; more, he's pulling away).
  const trend = sc.gap.length >= 4 ? (sc.gap[sc.gap.length - 1] - sc.gap[0]) / (sc.gap.length - 1) : 0;
  if (d < 5) { const o = offer(state, me); yield L('far-too-close', 'urgent', `Far too close: ${Math.round(d)} m. Peel off.${o.text}`, { act: o.act }); }
  if (d < 9 && !busy) yield L('too-close', 'warn', [`Too close: ${Math.round(d)} m. Let him get ahead.`, 'You\'re on his heels. Drop back.', 'Any closer and you\'ll be carrying his briefcase. Drop back.']);
  const stopped = Math.hypot(t.vx, t.vz) < 0.05;
  if (stopped && still && d < 30 && !me.glass && state.time.ms - sc.began > MIRROR_GRACE_S * 1000) { const o = offer(state, me); yield L('mirror', 'warn', `He's stopped. Don't stop with him: walk on, or find a reason.${o.text}`, { act: o.act }); }
  if (still && sc.stillS >= 3 && d < 35 && !coverNow(state, me)) { const o = offer(state, me); yield L('loiter', 'warn', [`Standing about draws the eye. Give yourself a reason.${o.text}`, `Standing in the middle of the pavement. Very natural. Give yourself a reason.${o.text}`], { act: o.act }); }
  const toHim = Math.abs(wrap(Math.atan2(t.z - me.z, t.x - me.x) - (me.head ?? 0)));
  if (toHim < 0.5 && still && d < 18 && !busy) yield L('stare', 'warn', ['You\'re staring at him. Look at something else.', 'You\'re staring at him. Moscow has other things to look at. Try a lamp post.']);
  const air = openAir(state), lampLit = air < 0.3 && lightHere(state, me.x, me.z) > air + 0.2;
  if (lampLit && d < 28 && !busy) yield L('lamp', 'note', ['You\'re in the lamplight. Out of it before he turns.', 'You\'re lit up like a shop window. Out of the lamplight.']);
  if (sc.alert >= 50 && d < 22) yield L('alert', 'warn', `He's on edge, checking more. Give him more room than ${Math.round(d)} m.`);
  if (trend < -0.35 && d < 20) yield L('gaining', 'warn', ['You\'re gaining on him. Ease off: {slow} stroll.', 'Too quick. Match his pace: {slow} stroll.']);
  if (d > 34) yield L('too-far', 'warn', `Too far: ${Math.round(d)} m. You'll lose him at this. Close up.`);
  if (trend > 0.3 && d > 22) yield L('pulling', 'note', ['He\'s pulling away. Close up.', 'He\'s quickened. Keep up with him.']);
  // The street round him (the street's, not a lane's).
  const twinNear = sc.twins.map(id => actorOf(state, id)).find(o => o && inView(state, o.id) && Math.hypot(o.x - t.x, o.z - t.z) < 8);
  if (twinNear && d > 12) yield L('twin-near', 'note', ['Another grey coat near him. Watch which one you follow.', 'Two grey coats now. His has the briefcase. Probably.']);
  const crowdT = crowdAround(state, t, 6), crowdMe = crowdAround(state, me, 6);
  if (crowdT >= 5 && d > 18) yield L('crowd-ahead', 'note', 'People round him. Close up a little, or you\'ll lose him in them.');
  if (crowdMe === 0 && crowdT === 0 && d < 22 && onStreet(here)) yield L('empty', 'note', ['The street\'s emptied. Hang back further.', 'The street\'s emptied: just you, him and your conscience. Hang back.']);
  // The sides of the street: only on the street itself, both of you.
  if (onStreet(here) && onStreet(there)) {
    const sameSide = (me.z < Z.kerbN) === (t.z < Z.kerbN), c = crossingNear(state, me)?.road === 'main';
    if (sameSide && d < 16 && c && t.z < Z.kerbN && !busy) yield L('cross-offer', 'note', 'A crossing. Take the other pavement and keep level with him: {instinct} cross here.', { act: 'cross' });
    if (!sameSide && d > 26 && c && !busy) yield L('cross-back', 'note', 'He\'s pulling ahead across the road. Cross back here: {instinct} cross.', { act: 'cross' });
    if (!sameSide) yield L('parallel', 'calm', [`Across the road and level with him, ${Math.round(d)} m. Hold it.`, 'Parallel him. He looks behind, not across.']);
  }
  if (sc.sightings.length) yield L('seen-once', 'note', 'He\'s seen your face once. Distance, the other pavement, people between you.');
  if (state.time.ms - (sc.lastScanMs ?? sc.began) > 50000 && d < 30) yield L('quiet', 'calm', ['He hasn\'t checked behind him in a while. He will.', 'He hasn\'t looked back in a while. They always do, eventually.']);
  // How things stand: the gap, its trend, who's between you.
  const n = between(state, me, t);
  yield L('status', 'calm', `${Math.round(d)} m behind him, the gap ${trend < -0.15 ? 'closing' : trend > 0.15 ? 'opening' : 'steady'}. ${n ? `${n === 1 ? 'Someone' : `${n} people`} between you.` : 'Nobody between you.'}`);
}

/** The people between us and him: in sight, on his line, nearer than he is. */
function between(state, me, t) {
  const d = Math.hypot(t.x - me.x, t.z - me.z);
  return state.actors.filter(a => a !== me && a !== t && !a.hidden && inView(state, a.id) && Math.abs(a.z - t.z) < 3 && Math.sign(a.x - me.x) === Math.sign(t.x - me.x) && Math.hypot(a.x - me.x, a.z - me.z) < d).length;
}

function end(state, bus, outcome, text) {
  const sc = state.scenario;
  if (sc.outcome) return;
  sc.outcome = outcome;
  sc.phase = 'done';
  sc.endText = sub(state, text);
  sc.ended = state.time.ms;
  bus?.emit('scenario-end', outcome);
}

// ---------- the umbrella (mechanic test 6: umbrellaTest) ----------

/**
 * An assassination (the user, 2026-10-27: "full creative license on assassination mission"; numbers
 * my calls), on the tail's evening with another man at the end of it. Colonel Pavel Kostin of the
 * GRU, who has poisoned two defectors abroad and flies out on Friday for a third, walks from his office
 * to his bus stop three to five streets away (STOP_ROWS), his minder a few paces behind
 * (MINDER_KEEP_M), the tail's grey coats about. Nobody signs for it: an umbrella with a pellet in its
 * tip came in a pouch addressed to no one (Markov, Waterloo Bridge, 1978).
 *   - **The approach** is the tail's, all of it: his checks, seen twice and he's made you, keeping
 *     him among the grey coats. His minder weighs whoever comes within CLOSE_M of him, every
 *     EYES_EVERY_S: his Awareness against your Deception (people round you, umbrellas in the rain, the
 *     dark, against him; right by his man, for him). Won, his eyes are on you, which your own
 *     Awareness may catch, until you've kept away a while (EYES_FORGET_S). An umbrella in the hand
 *     counts as nothing in the rain, and for a little on a dry evening (umbrellaMods()).
 *   - **The stop.** He waits at its shelter among those waiting with him (COMMUTERS) for the bus
 *     (BUS_WAIT_S; the one you see, sim/traffic.js), and boards at its doors with them: the crowd you
 *     want, and the minutes you have.
 *   - **The jab** (T, the umbrella in your hand, whom you take for him within JAB_M): a sting at the
 *     back of his thigh, and he turns. His Awareness against your Deception (to you: people round you
 *     +1 each, up to 4; umbrellas everywhere in the rain +3, the only one on a dry evening −2; the dark
 *     +1; the crush at the doors +2; stopped to do it −2): his, he's seen your face. His minder, if he
 *     can see you within MINDER_SEE_M: his Awareness (his eyes already on you +5; the crowd, the rain,
 *     the dark, the distance, against him): his, he saw it, and comes for you, a grab at GRAB_M: a
 *     fight. Anyone else near enough to see (WITNESS_NEAR_M), now and then (WITNESS_CHANCE), remembers.
 *   - **Away.** Walk. Clear when you're CLEAR_M from him (or he's gone) and CLEAR_S have passed with
 *     nobody on you.
 *   - **Outcomes:** done (how cleanly is in the notes: his look, the minder, witnesses: heat), wrong
 *     (a grey coat that wasn't him: a stranger dies), taken (his minder had you), missed (he got on
 *     his bus), made and lost (the tail's), off (called off).
 */
export const JAB_M = 1.3, CLOSE_M = 7, MINDER_KEEP_M = 4, MINDER_SEE_M = 14, EYES_EVERY_S = 5, EYES_STILL_S = 20, EYES_FORGET_S = 40, GRAB_M = 1.6;
export const CHASE_M = 20, RUN_MS = 3.0;                           // (his minder, after you: in sight within CHASE_M, straight at you at a run)
export const STOP_ROWS = [3, 5], BUS_WAIT_S = [80, 170], COMMUTERS = [3, 5], CLEAR_M = 40, CLEAR_S = 30;
export const WITNESS_NEAR_M = 3.5, WITNESS_CHANCE = 0.2, FACE_HEAT = 15, MINDER_HEAT = 10, WITNESS_HEAT = 3;
export const SPACE_M = 0.95, SPACE_DEEP_M = 1.7, STOP_SIT_Z = -0.68;   // (those waiting at his stop: a pace apart, more in depth; sat in the shelter, on its bench: sim/buses.js STOP_Z)
const UMBRELLA_EVENINGS = [
  { id: 'rush', h: 18, m: 5, wary: false, w: 3, light: 'Dark, and the evening rush.' },
  { id: 'late', h: 19, m: 25, wary: false, w: 1.5, light: 'Dark, and the streets thinning out.' },
  { id: 'jumpy', h: 17, m: 50, wary: true, w: 1.5, light: 'Dark already, and he\'s been careful all week.' },
];
const DOOR_Z = -0.62;                                              // (at the bus's doors, the kerb by the shelter)
const rowsText = (row) => (row === 0 ? 'on this street' : `${Math.abs(row) === 1 ? 'a street' : `${Math.abs(row)} streets`} ${row < 0 ? 'north' : 'south'}`);
const rainy = (state) => ['rain', 'sleet'].includes(weatherAt(state).kind);
/** What shows on you for his eyes and his minder's: the scene's own word on an umbrella in the hand. */
function umbrellaMods(state) {
  const p = state.people[state.player], out = showsMods(p).filter(m => !(m.why === 'something in your hand' && p.hand === 'umbrella'));
  if (p.hand === 'umbrella' && !rainy(state)) out.push({ why: 'an umbrella on a dry evening', v: 1 });
  return out;
}

/** The shelter on that street nearest x. */
function stopNear(seed, row, x) {
  const i0 = Math.floor(x / SECTION_M);
  for (let k = 0; k < 14; k++) for (const i of [i0 + k, i0 - k]) {
    const s = sectionOf(seed, row, i).props.find(p => p.kind === 'stop');
    if (s) return s;
  }
  throw new Error('no stop');
}

/** Someone stood (or sat in the shelter) a long while, waiting for the bus, facing the road. */
function standing(state, r, row, x, z, sit = false) {
  const a = makeAgent(state, { seed: int(r, 1e6), row, x, z, speed: 1.2, face: 'down' });
  const route = finish([{ row, x, z, w: 0 }, { row, x: x + 0.01, z, w: 0 }]);
  route.stops = [{ kind: 'wait', s: route.length, ticks: 45 * 60 * TPS, face: 'down', gait: sit ? 'sit' : 'idle' }];
  setRoute(state, a, route);
  return a.id;
}

export const umbrellaTest = {
  ...tail,
  name: '6. The umbrella',
  about: 'A GRU colonel who poisons defectors, his bus stop, an umbrella with a pellet in its tip. Be sure it\'s him; never run.',
  brief(state) {
    const sc = state.scenario, ev = eveningOf(state);
    return {
      title: 'THE UMBRELLA',
      body: [
        'Colonel Pavel Kostin, 51, GRU. In March a defector in Vienna died of what the coroner called heart failure; in July, one in Lisbon. Kostin was in both cities that week. On Friday he flies to Helsinki, and the name on his list this time is one of ours.',
        'Nobody signs for this. Executive Order 12333 says the United States does not do it, and officially it doesn\'t. The umbrella came in a pouch addressed to no one. Its tip carries a pellet the size of a pinhead: a press against his leg, a sting like a wasp\'s, and in three days a fever no hospital in Moscow will understand.',
        `He leaves his office at the end of the day and takes the bus home from the stop on ${streetName(townOf(state.map), sc.hit.stop.row)}, ${rowsText(sc.hit.stop.row)}. He has a minder a few paces behind him, and he was trained to look. Follow him from his door, or be at his stop before him, waiting like everyone else; and pick your moment where people crowd round him: the stop, the doors. Then walk away. Never run.`,
        `Be sure it's him: grey coat, grey fedora, a briefcase, like a lot of men in Moscow. ${ev.light}${rainy(state) ? ' It\'s raining: everyone has an umbrella.' : ' It\'s dry: an umbrella will be noticed, a little.'}`,
      ],
      footer: `Station Moscow · Wednesday 4 November 2026 · ${hhmm(ev.h, ev.m)}`,
      keys: [['instinct', 'what your instinct offers; at arm\'s length, the umbrella; calling it off'], ['use', 'what\'s at hand: a shelter, a window'], ['watch', 'held: stop and look; on a grey coat, a close look'], ['slow', 'held: stroll'], ['log', 'the log']],
    };
  },

  setup(state, { city = null, lesson = null, character = null } = {}) {
    const r = state.rng, ev = UMBRELLA_EVENINGS.find(e => e.id === lesson?.options?.evening) ?? weighted(r, UMBRELLA_EVENINGS.map(e => [e, e.w]));
    state.time.ms = at(2026, 11, 4, ev.h, ev.m);
    if (!state.weather) state.weather = lesson?.options?.weather ?? (weighted(r, [['rain', 3], ['rain-heavy', 1.5], ['', 2]]) || null);   // (rain more often than not: the umbrella's cover)
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.country = 'ru';
    state.heat[heatKey('embassy', state.country)] = 20;
    const me = asOfficer(handler(r), character);
    me.hand = 'umbrella';
    state.people[me.id] = me;
    state.player = me.id;
    state.people.orlov = sheet({ id: 'orlov', name: 'Colonel Pavel Kostin', sex: 'm', cls: 'spook', os: 25,
      skills: { pathfinding: [11, 1], awareness: [10, 1], deception: [9, 1], social: [5, 1], cqc: [12, 1] }, langs: { ru: 'native', de: 'good', en: 'good' }, look: ORLOV_LOOK, persistent: true });
    const looks = TWIN_LOOKS.slice();
    for (let i = 0; i < TWINS; i++) {
      const [look, tell] = looks.splice(int(r, looks.length), 1)[0];
      state.people[`twin${i}`] = { ...sheet({ id: `twin${i}`, name: 'a man in a grey coat', sex: 'm', look, skills: { awareness: [2, 0] } }), tell };
    }
    const minderLook = streetLook(r, 'm', 34);
    delete minderLook.carry;
    state.people.minder = sheet({ id: 'minder', name: 'his minder', sex: 'm', cls: 'spook', os: 30, look: minderLook,
      skills: { awareness: [11, 1], tracking: [10, 1], deception: [8, 0], cqc: [15, 1] }, langs: { ru: 'native' } });
    state.people.minder.seen = describe(minderLook, 'm');
    state.map = { kind: 'street', seed: seedFrom(r), row: 0, i0: null, i1: null, crowd: 1, city: city ?? undefined };
    const seed = townOf(state.map);
    const door = [0, 1].flatMap(i => sectionOf(seed, 0, i).doors).find(d => d.x > 14 && d.x < 26 && d.kind !== 'arch' && d.z === Z.front) ?? { x: 20 };
    // His stop: three to five streets away, a little way along; he waits at its end, on the pavement.
    const row = (chance(r, 0.5) ? -1 : 1) * (STOP_ROWS[0] + int(r, STOP_ROWS[1] - STOP_ROWS[0] + 1));
    const stop = stopNear(seed, row, door.x + range(r, -150, 150)), side = chance(r, 0.5) ? -1 : 1;
    const stand = { row, x: stop.x + side * (stop.w / 2 + 0.7), z: -1.75 };
    const route = withEnd(withHabits(seed, planRoute(seed, { row: 0, x: door.x, z: Z.front + 0.3 }, stand, { walker: hash(seed, 'kostin'), evasive: ev.wary ? 3 : 1, rng: r }), r, ev.wary ? 'wary' : 'calm'),
      { kind: 'bus', ticks: 45 * 60 * TPS, face: 'down', gait: 'idle' });
    route.stops.unshift({ kind: 'leave', s: 0, ticks: 2 * TPS, face: 'down' });
    const t = makeAgent(state, { who: 'orlov', row: 0, x: door.x, z: Z.front + 0.3, speed: range(r, 1.2, 1.35), f: range(r, -0.5, 0.5), face: 'down' });
    setRoute(state, t, route);
    // (his minder a pace along from the door: the first such spot he can walk from; a London terrace's railings fence some)
    const near = [[1.2, 0.6], [-1.2, 0.6], [1.2, 1.4], [-1.2, 1.4], [2.4, 1.4], [-2.4, 1.4], [0.6, 2.2]].map(([dx, dz]) => ({ x: door.x + dx, z: Z.front + dz }))
      .find(p => { try { routeFrom(seed, { row: 0, ...p }, { row: 0, x: door.x, z: Z.front + 0.3 }); return true; } catch { return false; } }) ?? { x: door.x + 1.2, z: Z.front + 0.6 };
    const m = makeAgent(state, { who: 'minder', row: 0, x: near.x, z: near.z, speed: 1.45, face: 'down' });
    followTarget(state, m, t, MINDER_KEEP_M);
    // Those waiting at his stop, spread out as people at a stop are, and as the picture needs them: a pace
    // apart side by side (SPACE_M), more one behind another (SPACE_DEEP_M: the camera looks down, and a man a
    // metre behind another stands head over his feet); some sat on the shelter's bench, the rest about its
    // ends (most at his: where the doors will open), out of the walkers' way.
    const commuters = [], spots = [], h = stop.w / 2;
    const free = (x, z) => [stand, ...spots].every(p => Math.hypot((p.x - x) / SPACE_M, (p.z - z) / SPACE_DEEP_M) >= 1);
    for (let tries = 0, n = COMMUTERS[0] + int(r, COMMUTERS[1] - COMMUTERS[0] + 1); spots.length < n && tries < 120; tries++) {
      const sit = chance(r, 0.35), end = chance(r, 0.7) ? side : -side;   // (most at his end: where the doors will open)
      const x = sit ? stop.x + pick(r, [-0.9, 0, 0.9]) : stop.x + end * (h + range(r, 0.45, 4.5)), z = sit ? STOP_SIT_Z : range(r, -2.2, -0.8);
      if (free(x, z)) spots.push({ x, z, sit });
    }
    for (const s of spots) commuters.push(standing(state, r, row, s.x, s.z, s.sit));
    const first = route.pts.find(p => Math.abs(p.x - door.x) > 3), dirX = first ? Math.sign(first.x - door.x) : 1;
    state.actors.unshift({ id: 'a0', who: me.id, seed: null, row: 0, x: door.x - dirX * range(r, 17, 22), z: LINE.F, vx: 0, vz: 0, face: dirX > 0 ? 'right' : 'left', head: dirX > 0 ? 0 : Math.PI, gait: 'idle', stride: 0, stuck: 0, ai: null });
    state.scenario = {
      kind: 'umbrella', evening: ev.id, ev, campaign: false, wary: ev.wary, phase: 'tail', target: t.id, contact: null, twins: [], meet: stand, seats: [],
      marked: t.id, lastSeen: { row: 0, x: t.x, z: t.z, ms: state.time.ms }, lastSeenT: state.time.ms, unseenS: 0, keepS: 0, findS: 0, startX: door.x,
      alert: ev.wary ? 25 : 0, sightings: [], scan: null, lastScanMs: null, tell: null, shop: null, warned: 0, mixups: 0, stillS: 0, mirrorMs: -1e12, gap: [],
      witnessS: 0, meetS: 0, closest: 1e9, farthest: 0, prompt: null, outcome: null, lead: null, rolls: 0, began: state.time.ms, turn: null,
      streets: route.rows, routeM: Math.round(route.length), markUntil: state.time.ms + MARKER_S * 1000, lookAt: null, looked: {},
      hit: { stop: { row, x: stop.x, w: stop.w }, stand, minder: m.id, commuters, eyes: 0, eyesAt: 0, eyesSeen: false, away: 0, waiting: false, busAt: null, busId: undefined,
        boarding: 0, gone: 0, releaseAt: null, done: null, chased: false, loud: false, witnesses: 0, clearS: 0 },
    };
    // (autoplay: the player's character is the game's own follower, as in the tail)
    if (state.autoplay) {
      const mePlace = state.actors[0];
      Object.assign(mePlace, { ai: { kind: 'agent', route: null, s: 0, stop: 0, wait: 0, speed: 1.45, f: 0, f0: 0 } });
      followTarget(state, mePlace, t, state.autoplay.keep ?? 20);
    }
    say(state, null, { kind: 'note', text: `${me.name}. ${hhmm(ev.h, ev.m)}, on the pavement down from Kostin's office, an umbrella in your hand. ${ev.light}` });
  },

  act(state, bus, action) {
    const sc = state.scenario, me = playerOf(state);
    if (!me || sc.outcome) return;
    if (action === 'instinct' && sc.prompt?.act === 'jab') return jab(state, bus, me);
    if (action === 'instinct' && sc.prompt?.act === 'abort') return end(state, bus, 'off', 'You walk past him, and keep walking. There may be another evening. There may never have been one.');
    if (sc.hit.done && action === 'instinct' && !sc.prompt?.act) return say(state, bus, { kind: 'instinct', text: 'Nothing to do now but walk.' });
    return tail.act(state, bus, action);
  },

  tick(state, bus) {
    const sc = state.scenario, h = sc.hit;
    if (sc.outcome) return;
    if (sc.after) return tail.tick(state, bus);
    // (once it's done, his checks and keeping him are behind you: there's only getting away)
    if (h.done) { busTick(state, bus); if (state.tick % TPS === 0) away(state, bus); return; }
    if (!actorOf(state, sc.target)) return end(state, bus, 'missed', 'The bus pulls away with him on it, his umbrella dripping on its floor. Friday he flies to Helsinki.');
    tail.tick(state, bus);
  },

  /** Where you're going, for the picture's edge: his stop, until it's done. */
  goal(state) {
    const sc = state.scenario, h = sc.hit, me = playerOf(state);
    if (h.done || !me) return null;
    const dr = h.stop.row - state.map.row;
    return { row: h.stop.row, x: h.stand.x, z: h.stand.z, label: `his stop · ${dr ? rowsText(dr) : `${Math.round(Math.abs(h.stand.x - me.x))} m`}` };
  },

  /** His minder's grab, and how it ends: down, you walk on (loudly); you down, taken. */
  onFightEnd(state, bus, f) {
    const sc = state.scenario, m = actorOf(state, sc.hit.minder);
    if (f.ended.by === 'a') {
      if (m) { delete m.ai.follow; m.ai.downUntil = state.time.ms + 10 * 60000; }
      sc.hit.chased = false; sc.hit.loud = true;
      say(state, bus, { kind: 'note', text: 'He\'s down, and people are looking. Walk. Now.' });
    } else end(state, bus, state.people[state.player].dead ? 'dead' : 'taken', 'An arm round your throat, your face on the wet pavement, his knee in your back, and a car with no markings already at the kerb. Whatever becomes of Kostin now, you go nowhere for a long time.');
  },

  result(state) {
    const sc = state.scenario, h = sc.hit, d = h.done;
    const stamp = { done: 'DONE', wrong: 'WRONG MAN', taken: 'TAKEN', missed: 'MISSED', made: 'MADE', lost: 'LOST', off: 'CALLED OFF', dead: 'DEAD' }[sc.outcome] ?? sc.outcome;
    const notes = [];
    if (d && !d.wrong) {
      notes.push('By midnight he has a fever of forty. On Saturday the doctors at the Burdenko call it sepsis of unknown origin; on Sunday he dies. Nobody flies to Helsinki.');
      if (d.face) notes.push('He saw your face when he turned. Before the fever took his words he described it, carefully, to a man from his own service.');
      if (d.minder) notes.push(h.loud ? 'His minder saw it, and you put him on the pavement in front of half the street.' : 'His minder saw it. A description of you is on every desk at the Aquarium by morning.');
      if (h.witnesses) notes.push(`${h.witnesses === 1 ? 'Someone' : `${h.witnesses} people`} at the stop remembered a stranger with an umbrella.`);
      if (!d.face && !d.minder && !h.witnesses) notes.push('Nobody connected the wasp in November with the stranger who said sorry.');
    }
    if (d?.wrong) notes.push(`It wasn't him: ${d.tell}. On Sunday a retired engineer dies of a fever the doctors can't name. Colonel Kostin flies to Helsinki on Friday.`);
    notes.push(`The way to his stop: ${sc.streets} streets, ${sc.routeM} m. ${sc.sightings.length ? `He saw your face ${sc.sightings.length === 1 ? 'once' : 'twice'} on the way.` : 'He never saw your face on the way.'}${h.eyesSeen ? ' His minder had his eyes on you, and you knew it.' : h.eyes ? ' His minder had his eyes on you.' : ''}`);
    return {
      stamp, good: sc.outcome === 'done', title: 'THE UMBRELLA', text: sc.endText, notes,
      stats: `${Math.round(((sc.ended ?? state.time.ms) - sc.began) / 60000)} min · ${sc.rolls} rolls (in the log, J)`,
    };
  },
};

/** The bus: sent for when he's waited his while; he and the others crowd to its doors and are gone. */
function busTick(state, bus) {
  const sc = state.scenario, h = sc.hit, now = state.time.ms;
  if (!h.waiting || h.gone) return;
  const here = state.map.row === h.stop.row;
  if (here && h.busId === undefined && now >= h.busAt - busLeadMs(state, h.stop)) { const id = sendBus(state, h.stop, h.busAt); if (id || now >= h.busAt) h.busId = id; }
  const come = h.busId ? pulledIn(state, h.busId) : now >= h.busAt;
  const riders = [sc.target, h.chased ? null : h.minder, ...h.commuters].filter(Boolean);
  if (come && !h.boarding) {
    h.boarding = now;
    for (const id of riders) {
      const a = actorOf(state, id);
      if (!a) continue;
      delete a.ai.follow;
      const x = h.stop.x + range(state.rng, -0.4, 0.4);
      const route = finish([{ row: h.stop.row, x: a.x, z: a.z, w: 0 }, { row: h.stop.row, x: a.x, z: DOOR_Z, w: 0 }, { row: h.stop.row, x, z: DOOR_Z, w: 0 }]);
      route.stops = [];
      setRoute(state, a, route);
    }
    if (here) say(state, bus, { kind: 'note', text: 'The bus pulls in and the doors fold open. They crowd to them.' });
  }
  if (!h.boarding) return;
  for (const id of riders) {
    const a = actorOf(state, id);
    if (a && (Math.hypot(a.x - h.stop.x, a.z - DOOR_Z) < 0.7 || (!here && now - h.boarding > 20000))) state.actors = state.actors.filter(o => o !== a);
  }
  if (!actorOf(state, sc.target) && !h.gone) { h.gone = now; h.releaseAt = now + 3000; }
  if (h.releaseAt && now >= h.releaseAt) { if (h.busId) release(state, h.busId); h.releaseAt = null; }
}

/** Once a second, before it's done: the bus, and his minder's eyes on whoever comes close. */
function hitSecond(state, bus, me, t, d) {
  const sc = state.scenario, h = sc.hit, now = state.time.ms, m = actorOf(state, h.minder);
  busTick(state, bus);
  // (someone waiting at the stop like the others is weighed now and then; someone coming close, often)
  if (m && rowOf(state, m) === rowOf(state, me) && d < CLOSE_M && seesActor(state, m, me) && now - h.eyesAt >= (atStop(state, me) ? EYES_STILL_S : EYES_EVERY_S) * 1000) {
    h.eyesAt = now;
    const dm = Math.hypot(m.x - me.x, m.z - me.z), crowd = crowdAround(state, me, 2.5);
    const r = opposed(state.rng, { skill: 'awareness', value: skill(state.people.minder, 'awareness'), body: state.people.minder,
      mods: [h.eyes && { why: 'his eyes already on you', v: 3 }, d < 3 && { why: 'right by his man', v: 2 }, crowd ? { why: 'people round you', v: -Math.min(4, crowd) } : !atStop(state, me) && Math.hypot(me.vx, me.vz) > 0.3 && { why: 'walking up behind his man on an empty pavement', v: 2 },
        rainy(state) && { why: 'umbrellas everywhere', v: -2 }, lightBand(lightHere(state, me.x, me.z)) === 'dark' && { why: 'the dark', v: -2 }, dm > 8 && { why: 'a way off', v: -1 },
        atStop(state, me) && { why: 'waiting at the stop like the others', v: -2 }, ...umbrellaMods(state)].filter(Boolean) },
    { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] });
    sc.rolls++;
    say(state, bus, { kind: 'roll', roll: r, hidden: true, text: r.ok ? 'His minder\'s eyes settle on you, and stay.' : 'His minder\'s eyes pass over you.' });   // (his roll first: ok, he won)
    if (r.ok) {
      const fresh = !h.eyes;
      h.eyes = now;
      if (fresh) {
        const c = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player], dc: 12 });
        sc.rolls++;
        h.eyesSeen = c.ok;
        if (c.ok) say(state, bus, { kind: 'roll', roll: c, text: `${cap(state.people.minder.seen)}, a pace behind him, is watching you. Not the street: you.` });
        strain(state, bus, 6);
      }
    }
  }
  // (kept away a while, out of mind)
  if (h.eyes && (d > 15 || rowOf(state, t) !== rowOf(state, me))) { if (++h.away >= EYES_FORGET_S) { h.eyes = 0; h.eyesSeen = false; h.away = 0; } } else h.away = 0;
}

/** T at arm's length: the umbrella. */
function jab(state, bus, me) {
  const sc = state.scenario, h = sc.hit, p = state.people[state.player], v = actorOf(state, sc.marked), now = state.time.ms;
  if (!v || p.hand !== 'umbrella' || state.fight || h.done || Math.hypot(v.x - me.x, v.z - me.z) > JAB_M) return;
  const him = state.people[v.who] ?? state.people.orlov, wrong = v.id !== sc.target, m = actorOf(state, h.minder);
  const crowd = near(state, me.x, me.z, 2.5).filter(o => o !== me && o !== v && !o.hidden).length;
  const doors = h.boarding && Math.hypot(me.x - h.stop.x, me.z - DOOR_Z) < 4, stopped = Math.hypot(me.vx, me.vz) < 0.2, dark = lightBand(lightHere(state, me.x, me.z)) === 'dark';
  const yours = [crowd ? { why: 'people round you', v: Math.min(4, crowd) } : { why: 'nobody round you but him', v: -3 }, rainy(state) ? { why: 'umbrellas everywhere', v: 3 } : { why: 'the only umbrella on a dry evening', v: -2 },
    dark && { why: 'the dark', v: 1 }, doors && { why: 'the crush at the doors', v: 2 }, stopped && { why: 'you stopped to do it', v: -2 }].filter(Boolean);
  // He feels it, and turns: does he see who?
  const felt = opposed(state.rng, { skill: 'deception', value: skill(p, 'deception'), body: p, mods: yours }, { skill: 'awareness', value: skill(him, 'awareness'), body: him });
  sc.rolls++;
  const face = !felt.ok;
  say(state, bus, { kind: 'roll', roll: felt, text: face ? 'A press of the tip against the back of his thigh. He flinches and turns, and his eyes find your face. "Izvinite," you say, and he looks a second too long.'
    : 'A press of the tip against the back of his thigh, the crowd shifting round you both. He flinches, rubs his leg, looks for the wasp in November. You\'re already moving on.' });
  // His minder: did he see it?
  let minder = false;
  if (!wrong && m && rowOf(state, m) === rowOf(state, me) && Math.hypot(m.x - me.x, m.z - me.z) < MINDER_SEE_M && seesActor(state, m, me)) {
    const dm = Math.hypot(m.x - me.x, m.z - me.z);
    const r = opposed(state.rng, { skill: 'awareness', value: skill(state.people.minder, 'awareness'), body: state.people.minder,
      mods: [h.eyes && { why: 'his eyes already on you', v: 5 }, crowd ? { why: 'people between', v: -Math.min(4, crowd) } : { why: 'an empty pavement', v: 3 }, dm < 3 && { why: 'right by him', v: 2 }, rainy(state) && { why: 'umbrellas everywhere', v: -2 },
        dark && { why: 'the dark', v: -2 }, dm > 6 && { why: 'a way off', v: -Math.round((dm - 6) / 3) }].filter(Boolean) },
    { skill: 'deception', value: skill(p, 'deception'), body: p, mods: yours.filter(y => y.why !== 'people round you' && y.why !== 'nobody round you but him') });
    sc.rolls++;
    minder = r.ok;                                                    // (his roll first: ok, he won)
    say(state, bus, { kind: 'roll', roll: r, hidden: !minder, text: minder ? `His minder saw your hand, and the umbrella's tip. He's coming.` : 'His minder\'s looking at the bus.' });
  }
  // Anyone else near enough to have seen.
  for (const o of near(state, me.x, me.z, WITNESS_NEAR_M)) if (o !== me && o !== v && o !== m && !o.hidden && seesActor(state, o, me) && chance(state.rng, WITNESS_CHANCE)) h.witnesses++;
  h.done = { ms: now, who: v.id, wrong, tell: wrong ? state.people[v.who]?.tell : null, face, minder };
  strain(state, bus, 12);
  if (face) addHeat(state, FACE_HEAT);
  if (h.witnesses) addHeat(state, WITNESS_HEAT * h.witnesses);
  if (minder) {
    h.chased = true; addHeat(state, MINDER_HEAT);
    m.ai.speed = 2.2;
    followTarget(state, m, me, 0);
  }
}

/** After it: walk away. Clear far enough from him with nobody on you a while; his minder, if he saw, comes for you. */
function away(state, bus) {
  const sc = state.scenario, h = sc.hit, me = playerOf(state), t = actorOf(state, sc.target), m = actorOf(state, h.minder);
  if (!me || state.fight) return;
  const sameRow = m && rowOf(state, m) === rowOf(state, me), dm = m ? Math.hypot(m.x - me.x, m.z - me.z) : 99;
  if (h.chased && m && (sameRow ? !m.ai.follow?.lost || dm < CHASE_M : false)) {
    if (dm <= GRAB_M && !me.hidden) {
      speak(state, bus, m.id, 'A hand like a vice on your arm. "Stoi."', 'A hand like a vice on your arm.');
      beginFight(state, bus, m, { style: 'wrestler', owner: 'umbrella' });
      return;
    }
    // (in sight and near: straight at you, running; out of sight, after your trail, which can lose you)
    if (dm < CHASE_M && !me.hidden && seesActor(state, m, me)) {
      delete m.ai.follow;
      m.ai.speed = RUN_MS;
      setRoute(state, m, finish([{ row: rowOf(state, m), x: m.x, z: m.z, w: 0 }, { row: rowOf(state, m), x: me.x, z: me.z, w: 0 }]));
    } else if (!m.ai.follow) { m.ai.speed = 2.2; followTarget(state, m, me, 0); }
    h.clearS = 0;
  } else {
    if (h.chased && (!m || m.ai.follow?.lost || rowOf(state, m) !== rowOf(state, me))) h.chased = false;
    const far = !t || rowOf(state, t) !== rowOf(state, me) || Math.hypot(t.x - me.x, t.z - me.z) > CLEAR_M;
    h.clearS = far || state.time.ms - h.done.ms > 90000 ? h.clearS + 1 : 0;
  }
  sc.prompt = settle(sc.prompt, [h.chased && m ? { id: 'chased', tone: 'urgent', text: `His minder's after you, ${Math.round(Math.hypot(m.x - me.x, m.z - me.z))} m back. Lose him: people, a lane, a shop's back door, a bus. Or turn and fight.`, act: null, at: m.id }
    : me.gait === 'run' ? { id: 'run', tone: 'urgent', text: 'Don\'t run. A running man is a man who did something.', act: null }
    : { id: 'walk', tone: 'warn', text: 'Walk. Don\'t look back, don\'t hurry. Away from him.', act: null }], state.time.ms);
  if (h.clearS >= CLEAR_S) end(state, bus, h.done.wrong ? 'wrong' : 'done', h.done.wrong ? 'You walk away into the evening with an umbrella and a clear conscience you haven\'t earned.' : h.loud ? 'You walk away fast, your coat torn, half the street looking after you.' : 'You walk away into the evening, an umbrella over your head like everyone else\'s.');
}

/** Whether actor a is waiting at his stop (in its shelter, or stood by it). */
const atStop = (state, a) => { const h = state.scenario.hit; return state.map.row === h.stop.row && Math.abs(a.x - h.stop.x) < h.stop.w / 2 + 4 && a.z > -3.2 && a.z < -0.3 && Math.hypot(a.vx, a.vz) < 0.3; };

/** The instinct's own lines for the umbrella, ahead of the tail's (yielded first: the most pressing win). */
function* hitInstinct(state, me, t, d) {
  const sc = state.scenario, h = sc.hit, p = state.people[state.player], v = sc.marked && actorOf(state, sc.marked);
  const L = (id, tone, text, act = null, extra = {}) => ({ id, tone, text, act, ...extra });
  if (p.hand !== 'umbrella') { yield L('no-umbrella', 'warn', 'The umbrella isn\'t in your hand. Without it there\'s nothing to do here but follow.'); return; }
  const dv = v ? Math.hypot(v.x - me.x, v.z - me.z) : 99, around = v ? crowdAround(state, v, 3) : 0;
  if (v && dv <= JAB_M && !v.hidden) {
    yield L('jab', 'urgent', h.eyes && h.eyesSeen ? 'Arm\'s length, and his minder\'s watching you. {instinct} the umbrella now and he\'ll see it.' : around >= 2 || h.boarding ? 'Arm\'s length, people round you both. {instinct} the umbrella: a press, and walk on.' : 'Arm\'s length, and nobody round you. {instinct} the umbrella, if it has to be here.', 'jab', { at: v.id });
  }
  if (h.eyesSeen && d < 15) yield L('eyes', 'warn', 'His minder\'s eyes are on you. Drop back and let him forget you, or {instinct} call it off.', 'abort');
  if (h.boarding && actorOf(state, sc.target)) yield L('doors', 'urgent', 'The doors are open and they\'re crowding to them. Now or never: close in behind him.');
  if (h.waiting && !h.boarding && d < 25 && rowOf(state, t) === rowOf(state, me)) yield L('stop', 'warn', around >= 2 ? 'He\'s waiting for his bus, people round him. Close in among them, behind him.' : 'He\'s at his stop. Wait for others to gather, or the doors.');
  // (at his stop, not seeing him: he'll come; nothing of the tail's about having lost him)
  if (!sc.marked && atStop(state, me) && !h.boarding) yield L('wait-stop', 'warn', h.waiting ? 'He should be here. Grey coat, fedora, briefcase: which one is he? Hold {watch} on a grey coat for a close look.' : 'His stop. Wait like everyone else: he\'ll come. Pick him out when he does: grey coat, fedora, the briefcase.');
  if (sc.sightings.length && d < 30) yield L('seen-once', 'warn', 'He\'s seen your face once. Again and he\'s gone. Or {instinct} call it off.', 'abort');
  if (v && dv < 9 && !h.waiting) yield L('close-street', 'warn', around >= 2 ? 'Close, with people round him. Ease in behind, if you mean it here.' : 'Close, and the pavement\'s thin. Not here: his stop, the crowd at the doors.');
}
