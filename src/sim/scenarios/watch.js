// TRADECRAFT sim: watching and photographing, the third mechanic test (DESIGN.md, Road to 0.1.0, 3;
// Observation: "Hold E to watch someone … Staring too long risks their Awareness … Meetings you
// witness are noted by themselves. P takes a photo if you carry a camera"). Numbers my calls.
//
// A man from the defence ministry (the subject: his look is in the brief) meets someone outside a café
// on this street (the café: in the brief), some time in a window of WINDOW_MIN, for MEET_S, and goes.
// You have a camera. A photograph of the two of them together, faces to the lens, is what the station
// wants; a meeting witnessed, without one, is something.
// **The minder** (FSB, counter-surveillance): at his post across the road from the café, before the
// meeting and through it, looking over the faces about every SCAN_S. Whoever he can see, he weighs:
// standing about in the open near the café (no reason: a shop window, a kiosk, a bench, a café's
// table are reasons, sim/acts.js and sim/shops.js), staring at the café or the subject (E held, eyes
// that way), a camera raised. Each a roll, his Awareness against your Deception (−3 loitering, −4
// staring, −6 a camera; at a distance, in a crowd, in the dark, easier). Lost, you're made: a word
// into his collar, and the subject walks past the café as if it were any other: blown.
// **The photograph** (P, sim/game.js passes 'camera' to the scene): both of them in your sight (the
// eyes', sim/perception.js) within PHOTO_M; then Tech against a DC by the distance, the light, your
// feet (moving), glass (from inside a café: you can't be seen, but the window's in the way). Made by 3
// or more, sharp; made, soft; missed, a blur. The best is kept; the UI keeps the frame (bus 'photo').
// Outcomes: 'photo' (sharp, both), 'soft', 'seen' (witnessed: both in sight together for WITNESS_S),
// 'missed', 'blown'.
import { at, TICK_MS, MIN, clockText, dateText } from '../clock.js';
import { handler, sheet, streetLook, describe } from '../people.js';
import { heatKey, addHeat } from '../heat.js';
import { say } from '../log.js';
import { settle, place, onStreet } from '../instinct.js';
import { skill } from '../skills.js';
import { opposed, check } from '../checks.js';
import { range, int, chance, pick } from '../rng.js';
import { Z, streetName } from '../map/street.js';
import { sectionOf, routeFrom, LINE } from '../city.js';
import { townOf } from '../cities/index.js';
import { makeAgent, setRoute, rowOf, onMap } from '../agents.js';
import { withEnd } from '../habits.js';
import { seesActor, lightHere } from '../perception.js';
import { lightBand } from '../light.js';
import { mods as showsMods } from '../notice.js';
import { strain } from '../needs.js';
import { shopWord } from '../shops.js';

const TPS = 1000 / TICK_MS;
export const WINDOW_MIN = [6, 16];                                 // (from the start: when the subject's due)
export const MEET_S = 100;
export const SCAN_S = 8;
export const NEAR_CAFE_M = 30;
export const LOITER_S = 40;
export const PHOTO_M = { day: 32, dim: 20, dark: 12 };
export const WITNESS_S = 10;
const SWEEP = [-Math.PI / 2, -Math.PI * 0.8, -Math.PI * 0.2, Math.PI, 0, -Math.PI / 2];   // (the minder's eyes, scan by scan: across, along, down his own pavement)
const SUBJECT_LOOK = { skin: 'light', hair: { style: 'short', color: 0x8f96a6 }, glasses: 'specs', top: { kind: 'coat', color: 0x23252f, trim: 0x14151c }, legs: 0x23252f, shoes: 0x14151c, carry: 'briefcase' };
const CONTACT_LOOK = { skin: 'light', hair: { style: 'short', color: 0x47302a }, top: { kind: 'coat', color: 0xd6ad7a, trim: 0x8f6345 }, legs: 0x353947, shoes: 0x47302a };

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const actorOf = (state, who) => state.actors.find(a => a.who === who);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** The subject by the campaign's name for him (a target of the posting: sim/campaign.js), or Volkov. */
const sub = (state, text) => { const n = state.scenario?.subject; return !n || !text ? text : text.replace(/Arkady Volkov/g, n).replace(/Volkov/g, n.split(' ').slice(-1)[0]); };
const tell = (state, bus, e) => say(state, bus, { ...e, text: sub(state, e.text) });

export const watchTest = {
  name: '3. Watching and photographing',
  test: true,
  about: 'A man from the defence ministry meets someone outside a café on this street, some time in the next quarter of an hour. Get a photograph of the two of them together, and don\'t let the man watching his back see you do it.',
  again: { another: ['Again, another afternoon', 'Another café, another hour, new dice.'], same: ['Again, the same afternoon', 'The same street and the same people; the dice fall as you play.'] },

  brief(state) {
    const sc = state.scenario;
    return {
      title: 'A PHOTOGRAPH',
      body: [
        `${state.people[state.player].name}: the station wants a photograph. Arkady Volkov, of the defence ministry's procurement office, meets someone this afternoon outside ${shopWord(sc.cafeShop)} on ${streetName(townOf(state.map), 0)}, ${sc.cafeAlong}. Between ${clockText(sc.window[0])} and ${clockText(sc.window[1])}, they think.`,
        'Volkov: grey hair, round glasses, a dark coat, a briefcase. Who he meets, nobody knows: that\'s what the photograph is for. Both faces, together.',
        'He won\'t be alone. The FSB minds its procurement officers, and the minder will be looking at faces round the café before Volkov comes. Don\'t stand about in the open, don\'t stare, and don\'t let him see a camera. A shop window, a kiosk, a café\'s window table across the way: reasons to be where you are.',
      ].map(t => sub(state, t)),
      footer: `Station Moscow · ${dateText(sc.began)} · ${clockText(sc.began)}`,
      keys: [['camera', 'a photograph (both of them in sight)'], ['watch', 'held: stop and watch'], ['instinct', 'does what your instinct offers (a window, a kiosk, a café)'], ['log', 'the log']],
    };
  },

  setup(state, { campaign: C = null, city = null } = {}) {
    const r = state.rng;
    const hour = pick(r, [[12, 40, 'lunch'], [15, 10, 'afternoon'], [16, 50, 'dusk']]);
    state.time.ms = C?.startMs ?? at(2026, 11, 4, hour[0], hour[1]);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.heat[heatKey('embassy', state.country)] = C?.heat ?? 28;
    const me = C ? { ...structuredClone(C.player), id: 'me' } : handler(r);
    state.people[me.id] = me;
    state.player = me.id;
    state.map = { kind: 'street', seed: C ? C.mapSeed : Math.floor(range(r, 0, 4294967296)), row: 0, i0: null, i1: null, crowd: 1, city: C?.city ?? city ?? undefined };
    const town = townOf(state.map);
    // The café: a café's, a bar's, a restaurant's door on this street, near the middle.
    const doors = [-2, -1, 0, 1, 2, 3].flatMap(i => sectionOf(town, 0, i).doors).filter(d => d.kind === 'shop' && d.z === Z.front);
    const cafe = doors.find(d => ['cafe', 'restaurant', 'bar'].includes(d.shop)) ?? doors[0] ?? { x: 40, shop: 'cafe' };
    const side = chance(r, 0.5) ? -1 : 1;
    const startX = cafe.x + side * range(r, 55, 80);
    state.actors.push({ id: 'a0', who: me.id, seed: null, row: 0, x: startX, z: LINE.F, vx: 0, vz: 0, face: side < 0 ? 'right' : 'left', head: side < 0 ? 0 : Math.PI, gait: 'idle', stride: 0, stuck: 0, ai: null });
    // (when he's due: the desk's window in a campaign, else WINDOW_MIN from now)
    const t0 = state.time.ms, win = C?.meetFrom ? [C.meetFrom, C.meetTo] : [t0 + WINDOW_MIN[0] * MIN, t0 + WINDOW_MIN[1] * MIN];
    const due = win[0] + range(r, 0, Math.max(60000, win[1] - win[0] - 2 * MIN));
    state.people.volkov = sheet({ id: 'volkov', name: C?.target?.name ?? 'Arkady Volkov', sex: 'm', cls: 'civilian', look: SUBJECT_LOOK, persistent: true, skills: { awareness: [6, 0], cqc: [3, 0] } });
    state.people.contact = sheet({ id: 'contact', name: 'a man in a camel coat', sex: 'm', cls: 'civilian', look: CONTACT_LOOK, skills: { awareness: [8, 0], cqc: [6, 0] } });
    state.people.contact.known = false; state.people.contact.seen = 'the man in the camel coat';
    const minderLook = streetLook(r, 'm', 38); delete minderLook.carry;
    state.people.minder = sheet({ id: 'minder', name: `an FSB officer (${describe(minderLook, 'm')})`, sex: 'm', cls: 'spook', os: 35, look: minderLook, skills: { awareness: [11, 1], deception: [10, 1], cqc: [14, 1] } });
    state.people.minder.known = false; state.people.minder.seen = describe(minderLook, 'm');
    // The minder: at his post across the road, there from the start, looking at faces.
    const post = { row: 0, x: cafe.x - side * range(r, 8, 16), z: LINE.N };
    const m = makeAgent(state, { who: 'minder', row: 0, x: post.x + side * 40, z: LINE.N, speed: 1.3, face: side < 0 ? 'right' : 'left' });
    setRoute(state, m, withEnd(routeFrom(town, { row: 0, x: m.x, z: m.z }, post), { kind: 'post', ticks: 3600 * TPS, face: 'up', gait: 'idle', wide: true }));
    state.scenario = {
      kind: 'watch', phase: 'wait', cafe: { x: cafe.x, z: Z.front + 0.8 }, cafeShop: cafe.shop, cafeAlong: Math.abs(cafe.x - startX) > 30 ? `${Math.round(Math.abs(cafe.x - startX) / 10) * 10} m ${cafe.x > startX ? 'east' : 'west'} of you` : 'right here',
      side, due, window: win, began: t0, spawned: false, minder: m.id,
      subject: C?.target?.name ?? null, suspicion: 0, made: false, loiterS: 0, stareS: 0, scanAt: 0, witnessS: 0, witnessed: false, photo: null, shots: 0, rolls: 0, prompt: null, outcome: null, meetEnd: null,
    };
    tell(state, null, { kind: 'note', text: `${me.name}. ${clockText(t0)}, ${streetName(town, 0)}. Volkov is due at ${shopWord(cafe.shop)} between ${clockText(state.scenario.window[0])} and ${clockText(state.scenario.window[1])}.` });
  },

  anchors(state) { const sc = state.scenario; return [sc.cafe.x]; },
  toward(state, me) { return Math.sign(state.scenario.cafe.x - me.x) || 1; },

  /** A stop's start and end (sim/agents.js): the meeting begun; over. */
  onStop(state, a, stop, phase, bus) {
    const sc = state.scenario;
    // (the meeting over, each his own way: Volkov on, the contact back the way he came)
    if (phase === 'end' && (stop.kind === 'meet' || stop.kind === 'meetc')) {
      try { setRoute(state, a, routeFrom(townOf(state.map), { row: rowOf(state, a), x: a.x, z: a.z }, { row: 0, x: a.x + (stop.kind === 'meet' ? sc.side : -sc.side) * 150, z: LINE.F })); } catch {}
    }
    if (stop.kind !== 'meet' || a.who !== 'volkov') return;
    if (phase === 'start' && sc.phase === 'walk') {
      sc.phase = 'meet';
      tell(state, bus, { kind: 'note', text: 'Volkov stops outside the café and looks at his watch.' });
      // (inside the very café, at its window: the minder looks in as he comes, as a minder does)
      const me = playerOf(state), m = actorOf(state, 'minder');
      if (me?.inside && Math.abs(me.inside.x - sc.cafe.x) < 1 && m && !sc.made) {
        sc.rolls++;
        const roll = opposed(state.rng, { skill: 'awareness', value: skill(state.people.minder, 'awareness'), body: state.people.minder, mods: [{ why: 'a face at the window of the very café', v: 4 }] },
          { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] });
        if (!roll.ok) made(state, bus, roll, 'at the café\'s own window');
      }
    }
    if (phase === 'end' && sc.phase === 'meet') { sc.phase = 'after'; sc.meetEnd = state.time.ms; }
  },

  act(state, bus, action) {
    if (action !== 'camera') return;
    const sc = state.scenario, me = playerOf(state);
    if (sc.outcome || !me) return;
    photograph(state, bus, me);
  },

  tick(state, bus) {
    const sc = state.scenario, me = playerOf(state), now = state.time.ms;
    if (sc.outcome || !me) return;
    // The two of them, set walking so as to arrive about when they're due.
    if (!sc.spawned && now >= sc.due - 110 * 1000) spawn(state);
    if (state.tick % TPS !== 0) return;
    const v = actorOf(state, 'volkov'), c = actorOf(state, 'contact'), m = actorOf(state, 'minder');
    // Witnessed: both of them in your sight together, near the café, a while.
    if (v && c && Math.hypot(v.x - c.x, v.z - c.z) < 3 && seesActor(state, me, v) && seesActor(state, me, c)) {
      if (++sc.witnessS === WITNESS_S && !sc.witnessed) { sc.witnessed = true; tell(state, bus, { kind: 'note', text: 'Volkov and the man in the camel coat, together: a handshake, heads close. You\'ve seen it.' }); }
    }
    // The minder, every SCAN_S: whoever he can see, weighed.
    if (m && !sc.made && now - sc.scanAt >= SCAN_S * 1000) { sc.scanAt = now; minderLooks(state, bus, me, m); }
    const near = Math.abs(me.x - sc.cafe.x) < NEAR_CAFE_M && !me.hidden;
    const reason = me.busy || me.glass || me.inside || me.vx || me.vz;
    sc.loiterS = near && !reason ? sc.loiterS + 1 : Math.max(0, sc.loiterS - 2);
    const lookingAt = me.looking && [v, sc.phase === 'wait' ? { x: sc.cafe.x, z: sc.cafe.z } : null].filter(Boolean).some(t => Math.abs(angle(me.head, Math.atan2(t.z - me.z, t.x - me.x))) < 0.5);
    sc.stareS = lookingAt ? sc.stareS + 1 : 0;
    // The end: they've gone their ways (or the window's long past and he never came).
    if (sc.phase === 'after' && now - sc.meetEnd > 30 * 1000) return end(state, bus);
    if (sc.made && sc.phase !== 'meet' && sc.madeAt && now - sc.madeAt > 60 * 1000) return end(state, bus);
    if (now > sc.window[1] + 20 * MIN) return end(state, bus);
    sc.prompt = settle(sc.prompt, [...instinct(state, me, now, { v, c, m, near, reason })].map(l => l && { ...l, text: sub(state, l.text) }), now);
  },

  goal(state) {
    const sc = state.scenario, me = playerOf(state);
    if (sc.outcome || !me || Math.abs(sc.cafe.x - me.x) < 30) return null;
    return { row: 0, x: sc.cafe.x, z: sc.cafe.z, label: `the café · ${Math.round(Math.abs(sc.cafe.x - me.x))} m` };
  },

  result(state) {
    const sc = state.scenario, stamp = { photo: 'PHOTOGRAPHED', soft: 'A SOFT PRINT', seen: 'WITNESSED', missed: 'MISSED', blown: 'MADE' }[sc.outcome];
    const text = {
      photo: 'The print comes up in the tray: Volkov, and the man in the camel coat, faces to the lens, sharp. Somebody at Langley will know who he is by Friday.',
      soft: 'The print comes up soft: two men outside a café, one of them Volkov. The other could be anyone with a camel coat. It\'s something.',
      seen: 'No photograph, but you saw it: Volkov and a man in a camel coat, a handshake, heads together. You write down everything you can of the other man\'s face.',
      missed: 'The afternoon goes by. Whoever Volkov met, he met them where you weren\'t looking.',
      blown: 'Volkov walks past the café as if it were any other, and doesn\'t look back. The minder across the road watched you the whole way: they knew. Whoever the meeting was with, it\'s somewhere else now.',
    }[sc.outcome];
    return {
      stamp, good: sc.outcome === 'photo' || sc.outcome === 'soft', title: 'A PHOTOGRAPH', text: sub(state, text),
      notes: [sc.photo ? `Your best frame: ${sc.photo.q}, at ${Math.round(sc.photo.d)} m${sc.photo.glass ? ', through a café window' : ''}.` : sc.shots ? `${sc.shots} frame${sc.shots === 1 ? '' : 's'}, none of them any use.` : null,
        sc.made ? 'The minder made you. Somewhere a report will mention a man who took too much interest in a café.' : null].filter(Boolean),
      stats: `${Math.round(((sc.ended ?? state.time.ms) - sc.began) / 60000)} min · ${sc.shots} frame${sc.shots === 1 ? '' : 's'} · ${sc.rolls} of the minder's looks at you`,
    };
  },
};

/** Volkov and his contact, each from a way off, to the café's door: the meeting, then their ways. */
function spawn(state) {
  const sc = state.scenario, town = townOf(state.map), r = state.rng, s = sc.side;
  sc.spawned = true; sc.phase = 'walk';
  const spot = sc.cafe;
  const v = makeAgent(state, { who: 'volkov', row: 0, x: spot.x - s * range(r, 120, 160), z: LINE.F, speed: 1.25 });
  setRoute(state, v, withEnd(routeFrom(town, { row: 0, x: v.x, z: v.z }, { row: 0, x: spot.x - 0.5, z: spot.z }), { kind: 'meet', ticks: MEET_S * TPS, face: 'right', gait: 'idle' }));
  const c = makeAgent(state, { who: 'contact', row: 0, x: spot.x + s * range(r, 120, 170), z: LINE.F, speed: 1.3 });
  setRoute(state, c, withEnd(routeFrom(town, { row: 0, x: c.x, z: c.z }, { row: 0, x: spot.x + 0.6, z: spot.z }), { kind: 'meetc', ticks: (MEET_S + 25) * TPS, face: 'left', gait: 'idle' }));
}

/** The minder looks over the faces: you, if he can see you, weighed by what you're doing. */
function minderLooks(state, bus, me, m) {
  const sc = state.scenario;
  // (his eyes work the street: across at the café, along it each way, his own pavement)
  if (m.ai?.waiting?.kind === 'post') m.head = SWEEP[(sc.sweep = ((sc.sweep ?? 0) + 1) % SWEEP.length)];
  if (me.hidden || !seesActor(state, m, me)) return;
  const d = Math.hypot(me.x - m.x, me.z - m.z);
  const reasons = [sc.loiterS >= LOITER_S && { why: 'standing about near the café', v: 3 }, sc.stareS >= 3 && { why: 'staring', v: 4 }].filter(Boolean);
  if (!reasons.length) return;
  const crowd = state.actors.filter(o => o !== me && !o.hidden && Math.hypot(o.x - me.x, o.z - me.z) < 4).length;
  const light = lightBand(lightHere(state, me.x, me.z));
  sc.rolls++;
  const roll = opposed(state.rng, { skill: 'awareness', value: skill(state.people.minder, 'awareness'), body: state.people.minder,
    mods: [...reasons, crowd && { why: 'people round you', v: -Math.min(3, crowd) }, light === 'dark' && { why: 'the dark', v: -3 }, d > 20 && { why: 'at a distance', v: -2 }, ...showsMods(state.people[state.player])].filter(Boolean) },
  { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] });
  if (!roll.ok) return made(state, bus, roll, reasons[0].why);
  tell(state, bus, { kind: 'roll', roll, hidden: true, text: `The man across the road looks you over, and moves on.` });
}

function made(state, bus, roll, why) {
  const sc = state.scenario;
  sc.made = true; sc.madeAt = state.time.ms;
  strain(state, bus, 10);
  tell(state, bus, { kind: 'roll', roll, hidden: true, text: `The man across the road watches you a beat too long (${why}), and says something into his collar.` });
  // (Volkov is told: he walks past the café without stopping; the contact turns back)
  const v = actorOf(state, 'volkov'), c = actorOf(state, 'contact'), town = townOf(state.map);
  for (const a of [v, c].filter(Boolean)) {
    try { setRoute(state, a, routeFrom(town, { row: rowOf(state, a), x: a.x, z: a.z }, { row: 0, x: a.x + (a === v ? sc.side : -sc.side) * 140, z: LINE.F })); } catch {}
  }
  sc.phase = sc.phase === 'meet' ? 'after' : sc.phase;
  if (!sc.meetEnd) sc.meetEnd = state.time.ms;
}

/** P: a frame. Both of them in sight within reach; Tech against the distance, the light, your feet, glass. */
function photograph(state, bus, me) {
  const sc = state.scenario, v = actorOf(state, 'volkov'), c = actorOf(state, 'contact'), m = actorOf(state, 'minder');
  sc.shots++;
  const inSight = [v, c].filter(a => a && onMap(state, a) && seesActor(state, me, a));
  if (!inSight.length) return tell(state, bus, { kind: 'note', text: 'A frame of the street, and nobody in it who matters.' });
  const d = Math.max(...inSight.map(a => Math.hypot(a.x - me.x, a.z - me.z))), light = lightBand(lightHere(state, inSight[0].x, inSight[0].z));
  if (d > PHOTO_M[light]) return tell(state, bus, { kind: 'note', text: `Too far for this light: ${Math.round(d)} m. Closer, or wait.` });
  const glass = !!me.inside;
  const roll = check(state.rng, { skill: 'tech', value: skill(state.people[state.player], 'tech'), body: state.people[state.player], dc: 8 + Math.round(d / 3),
    mods: [light === 'dim' && { why: 'the light going', v: -2 }, light === 'dark' && { why: 'lamplight', v: -4 }, (me.vx || me.vz) && { why: 'on the move', v: -4 }, glass && { why: 'through the café\'s window', v: -2 }].filter(Boolean) });
  const both = inSight.length === 2 && v && c && Math.hypot(v.x - c.x, v.z - c.z) < 3;
  const q = !roll.ok ? 'a blur' : roll.margin >= 3 && both ? 'sharp, both faces' : both ? 'soft, both of them' : 'one of them';
  const rank = { 'sharp, both faces': 3, 'soft, both of them': 2, 'one of them': 1, 'a blur': 0 }[q];
  if (!sc.photo || rank > sc.photo.rank) sc.photo = { q, rank, d, glass, ms: state.time.ms };
  tell(state, bus, { kind: 'roll', roll, text: `The shutter, quiet as you can make it: ${q}.` });
  bus?.emit('photo', { rank, ids: inSight.map(a => a.id) });
  // (a camera raised where the minder can see it)
  if (m && !sc.made && !me.hidden && seesActor(state, m, me)) {
    sc.rolls++;
    const r2 = opposed(state.rng, { skill: 'awareness', value: skill(state.people.minder, 'awareness'), body: state.people.minder, mods: [{ why: 'a camera raised', v: 6 }] },
      { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] });
    if (!r2.ok) made(state, bus, r2, 'a camera raised');
  }
}

/** The instinct, watching: where to wait, the minder, the time, the moment. */
function* instinct(state, me, now, { v, c, m, near, reason }) {
  const sc = state.scenario, L = (id, tone, text, act = null, extra = {}) => ({ id, tone, text, act, ...extra });
  if (sc.phase === 'meet' && v && c && Math.hypot(v.x - c.x, v.z - c.z) < 3) {
    const vis = seesActor(state, me, v) && seesActor(state, me, c);
    yield L('moment', 'urgent', vis ? 'They\'re together. {camera}: a photograph, while both faces are yours. Steady.' : 'They\'re together, and you can\'t see them both. Get the angle, quickly.');
  }
  if (sc.stareS >= 2 && m && seesActor(state, m, me)) yield L('stare', 'warn', 'You\'re staring, and the man across the road can see you do it. Look at anything else.', null, { at: m.id });
  if (sc.loiterS >= LOITER_S - 10 && !reason) yield L('loiter', 'warn', 'You\'ve stood here too long for no reason. A shop window, a kiosk, a café: be somewhere for something.');
  if (m && onMap(state, m) && Math.hypot(m.x - me.x, m.z - me.z) < 40 && !sc.made) yield L('minder', 'note', `${cap(state.people.minder.seen)}, across the road from the café, isn't waiting for anyone. He's looking at faces.`, null, { at: m.id });
  if (sc.phase === 'walk' && v && seesActor(state, me, v)) yield L('volkov', 'note', 'There: grey hair, glasses, the briefcase. Volkov, coming to his café.', null, { at: v.id });
  if (!near) yield L('way', 'calm', `${cap(shopWord(sc.cafeShop))}: ${Math.round(Math.abs(sc.cafe.x - me.x))} m ${sc.cafe.x > me.x ? 'east' : 'west'}. Volkov's due between ${clockText(sc.window[0])} and ${clockText(sc.window[1])}.`);
  if (near && sc.phase === 'wait') yield L('wait', 'calm', `Somewhere to wait with a view of the café's door: a shop window opposite, a kiosk, a café's table of your own. Due by ${clockText(sc.window[1])}.`);
}

function end(state, bus) {
  const sc = state.scenario;
  if (sc.outcome) return;
  sc.outcome = sc.made && (!sc.photo || sc.photo.rank < 2) ? 'blown' : sc.photo?.rank >= 3 ? 'photo' : sc.photo?.rank >= 2 ? 'soft' : sc.witnessed ? 'seen' : sc.made ? 'blown' : 'missed';
  sc.ended = state.time.ms;
  if (sc.made) addHeat(state, 6);
  for (const e of state.log) if (e.hidden && e.ms >= sc.began) e.hidden = false;
  bus?.emit('scenario-end', sc.outcome);
}
const angle = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
