// TRADECRAFT sim: mechanic test 1, tailing a target (DESIGN.md: Moment to moment, Tailing; Road to 0.1.0).
//
// Gennady Orlov, once a GRU officer, now in procurement, leaves his office on a Tuesday evening and
// walks east to a meeting. The player follows. The street grows ahead of him as he goes (an endless
// street map), through dusk into the dark. The test ends when the meeting is seen (success), or he
// makes the tail, or he's lost for good, or the meeting is missed or blown.
//
// How it plays, by the design's table of opposed rolls:
//   - **Unseen.** At his moments (a look back, a shop window's reflection, coming out of a shop,
//     crossing the road, doubling back) he rolls Pathfinding against our Deception, if we're where
//     he's looking. The modifiers are the player's choices: distance (under 5 m +6 to him, under 10
//     +3, over 15 −2, over 25 −4, over 35 −6), across the road (−3), people about us (alone +2, among
//     people −2, a crowd −4), the light where we stand (dusk −2, dark −4), running (+6), stopping when
//     he stops (+3), the same pavement right behind him (+1), looking in a window (−2).
//     He wins: a sighting. The first sets him dry-cleaning (he doubles back, looks more); the second
//     and he's made us: the test is lost.
//   - **Kept.** While we have him (a marker over him), we roll Tracking against a difficulty from the
//     distance, the people round him and the dark: every KEEP_EVERY_S while he's more than KEEP_M
//     away, and when he comes out of a shop or crosses the road with us more than 15 m off. Lost, the
//     marker goes; within FIND_M an Awareness roll (every 2 s) finds him again. Lost for LOST_S, he's gone.
//   - **The instinct** (HUD) says what a trained eye would: too close, he's stopped, he's pulling
//     away, he's in the shop. T does what it says when there's something to do: look in a window
//     (a reason to stop: no mirroring, −2 to him).
//   - **The meeting**: he sits on a boulevard bench and a man in a blue beanie joins him. Within
//     WITNESS_M, with him in hand, for WITNESS_S seconds: seen, and a lead. Closer than 5 m, the
//     contact (a professional) gets a roll of his own on us.
// Every roll goes to the log with a line of flavour. The scenario's progress is plain data in
// state.scenario, read by the UI (the marker, the instinct, the brief and the result).
import { at, SEC, TICK_MS } from '../clock.js';
import { handler, sheet, seedFrom } from '../people.js';
import { heatKey, addHeat } from '../heat.js';
import { say } from '../log.js';
import { skill } from '../skills.js';
import { opposed, check } from '../checks.js';
import { range, int, chance, pick, weighted } from '../rng.js';
import { LANES, Z } from '../map/street.js';
import { near, sectionAt } from '../world.js';
import { follow } from '../crowd.js';
import { lightLevel, lightBand } from '../light.js';

export const KEEP_M = 22;
export const KEEP_EVERY_S = 4;
export const FIND_M = 16;
export const LOST_S = 120;
export const WITNESS_M = 18;
export const WITNESS_S = 15;
export const ROUTE_M = [380, 480];
const TPS = 1000 / TICK_MS;

const ORLOV_LOOK = { skin: 'light', hair: { style: 'short', color: 0x8f96a6 }, hat: { kind: 'fedora', color: 0x353947 },
  top: { kind: 'coat', color: 0x6a7182, trim: 0x353947, belt: 0x353947 }, legs: 0x23252f, shoes: 0x14151c, carry: 'briefcase' };
const CONTACT_LOOK = { skin: 'light', hair: { style: 'short', color: 0x47302a }, hat: { kind: 'beanie', color: 0x283f6b, band: 0x1b2541 },
  top: { kind: 'coat', color: 0x23252f, trim: 0x14151c }, legs: 0x283f6b, shoes: 0x14151c, carry: 'paper' };

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
const GONE = 'He\'s gone. Somewhere in Moscow a man in a grey coat is keeping his appointment, and you\'ll never know with whom.';
const MISSED = 'They part. Whatever passed between them, you weren\'t there to see it.';
const made = 'That\'s twice. He\'s made you. He doesn\'t run; he turns for home, and the evening\'s over.';
const lostLines = ['The crowd thickens and the grey coat goes into it. When it thins, he isn\'t there.', 'He was further than you thought, and then he wasn\'t anywhere.', 'A bus disgorges its passengers between you. When they clear, so has he.'];
const foundLines = ['There. Fedora, briefcase, that walk.', 'Grey coat, a little way on. Him.', 'You find him again by the hat.'];

export const tail = {
  name: '1. Tailing a target',
  test: true,
  about: 'Follow a former GRU officer through the Moscow dusk to his meeting. Don\'t be seen twice.',
  brief: {
    title: 'TAILING: GENNADY ORLOV',
    body: [
      'Gennady Orlov, 54. Deputy head of procurement at a defence plant. Twenty years ago an officer of the GRU, and he hasn\'t forgotten all of it.',
      'Every Tuesday he leaves the office early and walks somewhere he doesn\'t tell his wife about. Grey coat, grey fedora, a briefcase.',
      'Follow him and see whom he meets. He will check for a tail. If he sees the same face twice he\'ll go home, and we won\'t get this chance again.',
      'Keep your distance, keep people between you, don\'t stop when he stops. Your instinct will tell you the rest.',
    ],
    footer: 'Station Moscow · Tuesday 3 November 2026 · 16:45',
  },

  setup(state) {
    const r = state.rng;
    state.time.ms = at(2026, 11, 3, 16, 45);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.heat[heatKey('embassy', 'ru')] = 20;
    const me = handler(r);
    state.people[me.id] = me;
    state.player = me.id;
    state.people.orlov = sheet({ id: 'orlov', name: 'Gennady Orlov', sex: 'm', cls: 'spook', os: 20,
      skills: { pathfinding: [10, 0], awareness: [8, 1], deception: [8, 0], social: [5, 1] }, langs: { ru: 'native', en: 'basic' }, look: ORLOV_LOOK, persistent: true });
    state.people.contact = sheet({ id: 'contact', name: 'the man in the blue beanie', sex: 'm', cls: 'spook', os: 30,
      skills: { pathfinding: [10, 2], awareness: [10, 2], deception: [10, 1] }, langs: { ru: 'native' }, look: CONTACT_LOOK, persistent: true });
    state.map = { kind: 'street', seed: seedFrom(r), i0: null, i1: null, crowd: 1 };
    state.actors.push({ id: 'a0', who: me.id, seed: null, x: 0, z: -2.6, vx: 0, vz: 0, face: 'right', gait: 'idle', stride: 0, stuck: 0, ai: null });
    state.scenario = {
      kind: 'tail', phase: 'tail', target: null, contact: null, have: true, lostS: 0, startX: 0, routeM: Math.round(range(r, ...ROUTE_M)),
      sightings: [], mirrorS: 0, witnessS: 0, meetS: 0, closest: 1e9, farthest: 0, prompt: null, outcome: null, lead: null, rolls: 0, began: state.time.ms,
    };
    say(state, null, { kind: 'note', text: `${me.name}. Tuesday, 16:45, on the pavement down from Orlov's office. The light's going.` });
  },

  // The target appears when the street does: out of a door some 20 m on.
  attach(state) {
    const sc = state.scenario;
    if (sc.target) return;
    const doors = [...state.$world.sections.values()].flatMap(S => S.doors).filter(d => d.x > 16 && d.x < 32 && d.kind !== 'arch');
    const d = doors[0] ?? { x: 24 };
    const a = { id: `a${state.nextActor++}`, who: 'orlov', seed: null, x: d.x, z: Z.front + 0.3, vx: 0, vz: 0, face: 'down', gait: 'idle', stride: 0, stuck: 0,
      ai: { kind: 'subject', speed: 1.3, steps: [['wait', 2 * TPS, 'down', 'idle'], ['go', d.x + 1.5, laneMid('far')]], wait: 0, lane: 'far' } };
    state.actors.push(a);
    sc.target = a.id;
    sc.startX = d.x;
  },

  anchors(state) {
    const t = actorOf(state, state.scenario.target);
    return t ? [t.x] : [];
  },

  /** T: do what the instinct says (when there's something to do). */
  act(state, bus, action) {
    const sc = state.scenario, me = playerOf(state);
    if (action !== 'instinct' || !me || sc.outcome) return;
    if (!sc.prompt?.key) return say(state, bus, { kind: 'instinct', text: me.busy ? 'You\'re doing it.' : 'Your instinct has nothing for you. Keep walking.' });
    if (sc.prompt.key === 'window') {
      me.busy = { what: 'window', steps: [['go', me.x, -4.35], ['wait', 4 * TPS, 'up', 'idle']], wait: 0 };
      say(state, bus, { kind: 'instinct', text: 'You find something in a shop window worth a look.' });
    }
  },

  think(state, a, bus) {
    if (a.who === 'orlov') return thinkOrlov(state, a, bus);
    if (a.who === 'contact') return thinkContact(state, a, bus);
    follow(state, a);
  },

  tick(state, bus) {
    const sc = state.scenario;
    if (sc.outcome) return;
    const me = playerOf(state), t = actorOf(state, sc.target);
    if (me && !t && sc.target) return end(state, bus, sc.meetS > 0 ? 'missed' : 'lost', sc.meetS > 0 ? MISSED : GONE);
    if (!me || !t) return;
    const d = Math.hypot(t.x - me.x, t.z - me.z);
    if (!t.hidden) { sc.closest = Math.min(sc.closest, d); if (sc.have) sc.farthest = Math.max(sc.farthest, d); }
    if (state.tick % TPS !== 0) return;                             // the rest once a second
    const stopped = !t.hidden && Math.hypot(t.vx, t.vz) < 0.05, still = Math.hypot(me.vx, me.vz) < 0.05 && !me.busy;
    sc.mirrorS = stopped && still && d < 25 ? sc.mirrorS + 1 : 0;
    // Keeping him, losing him, finding him.
    if (sc.have && !t.hidden && d > KEEP_M) {
      if ((sc.keepS = (sc.keepS ?? 0) + 1) >= KEEP_EVERY_S) { sc.keepS = 0; keep(state, bus, t, d); }
    } else if (!sc.have) {
      sc.lostS++;
      if (!t.hidden && d < FIND_M && sc.lostS % 2 === 0) {
        const light = lightBand(lightLevel(state.$world.lamps, t.x, t.z, state.time.ms));
        const r = check(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), dc: 10,
          mods: [crowdAround(state, t, 3) && { why: 'people round him', v: -crowdAround(state, t, 3) }, light !== 'day' && { why: light === 'dark' ? 'the dark' : 'the dusk', v: light === 'dark' ? -4 : -2 }].filter(Boolean) });
        sc.rolls++;
        if (r.ok) { sc.have = true; say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, foundLines) }); }
      }
      if (sc.lostS >= LOST_S) end(state, bus, 'lost', GONE);
    }
    // The meeting.
    if (sc.phase === 'meet') meeting(state, bus, me, t, d);
    sc.prompt = instinct(state, me, t, d, stopped);
  },
};

// ---------- Orlov ----------

const laneMid = (lane) => (LANES[lane][0] + LANES[lane][1]) / 2;
const actorOf = (state, id) => state.actors.find(a => a.id === id);
const playerOf = (state) => state.actors.find(a => a.who === state.player);

function thinkOrlov(state, a, bus) {
  const ai = a.ai, sc = state.scenario;
  if (!ai.steps.length) ai.steps = nextLeg(state, a);
  const step = ai.steps[0];
  switch (step[0]) {
    case 'moment':                                                // a check for a tail, then on
      ai.steps.shift();
      moment(state, bus, a, step[1], step[2]);
      return thinkOrlov(state, a, bus);
    case 'inside':                                                // in a shop: out of sight
      a.hidden = true; a.vx = a.vz = 0;
      if (++ai.wait >= step[1]) { ai.wait = 0; ai.steps.shift(); a.hidden = false; a.face = 'down'; }
      return;
    case 'sit':
      a.vx = a.vz = 0; a.face = 'down'; a.gait = 'sit';
      if (!sc.contact && sc.phase === 'meet') sc.contact = spawnContact(state, a);
      if (++ai.wait >= step[1]) { ai.wait = 0; ai.steps.shift(); }
      return;
    case 'phase': ai.steps.shift(); sc.phase = step[1]; return thinkOrlov(state, a, bus);
    default: follow(state, a);
  }
}

// His next stretch of route: a leg along his side of the street, then one of his habits; the
// meeting once he's walked far enough; dry cleaning once he's seen someone; home once he's made us.
function nextLeg(state, a) {
  const r = state.rng, sc = state.scenario, lane = a.ai.lane, z = laneMid(lane) + range(r, -0.5, 0.5);
  const S = sectionAt(state, a.x + 20) ?? sectionAt(state, a.x);
  if (sc.outcome) return [['go', a.x - 60, z], ['gone']];
  if (sc.sightings.length === 1 && !sc.dried) {                   // the old trick, a little later: back the way he came
    sc.dried = true;
    const x = a.x + range(r, 20, 35);
    return [['go', x, z], ['wait', TPS, 'left', 'idle'], ['moment', 'double'], ['go', x - range(r, 12, 18), z], ['wait', 2 * TPS, 'right', 'idle']];
  }
  if (a.x - sc.startX >= sc.routeM && sc.phase === 'tail') return toMeeting(state, a);
  const leg = range(r, 35, 70), x = a.x + leg;
  const steps = [['go', x, z]];
  const crossing = S?.crossings.find(c => c.x0 > a.x + 4 && c.x0 < x + 10);
  const shops = (S?.doors ?? []).filter(d => d.kind === 'shop' && d.x > a.x + 6 && d.x < x + 5);
  const habit = weighted(r, [['look', sc.sightings.length ? 5 : 4], ['window', lane === 'far' && shops.length ? 2.5 : 0], ['shop', lane === 'far' && shops.length ? 1.2 : 0],
    ['cross', crossing ? 1.6 : 0], ['pause', 0.8], ['none', 1]]);
  if (habit === 'look') steps.push(['wait', Math.round(0.4 * TPS), 'left', 'idle'], ['moment', 'look'], ['wait', Math.round(range(r, 2, 3.5) * TPS), 'left', 'idle']);
  else if (habit === 'window') {
    const d = pick(r, shops), wx = d.x - 1.6;
    steps[0] = ['go', wx, z];
    steps.push(['go', wx, -4.35], ['wait', TPS, 'up', 'idle'], ['moment', 'window'], ['wait', Math.round(range(r, 4, 7) * TPS), 'up', 'idle'], ['go', wx + 2, z]);
  } else if (habit === 'shop') {
    const d = pick(r, shops);
    steps[0] = ['go', d.x, z];
    steps.push(['go', d.x, Z.front + 0.3], ['inside', Math.round(range(r, 20, 45) * TPS)], ['moment', 'exit'], ['go', d.x + 1, z]);
  } else if (habit === 'cross') {
    const cx = (crossing.x0 + crossing.x1) / 2, to = lane === 'far' ? 'near' : 'far';
    steps[0] = ['go', cx, z];
    steps.push(['moment', 'cross'], ['go', cx, laneMid(to)]);
    a.ai.lane = to;
  } else if (habit === 'pause') steps.push(['wait', Math.round(range(r, 4, 7) * TPS), 'down', 'idle']);   // his phone: no look, a test of nerve
  return steps;
}

// To the meeting: over at the next crossing to the boulevard's path, along it to a bench, sit.
function toMeeting(state, a) {
  const S = [...state.$world.sections.values()].sort((p, q) => p.x0 - q.x0);
  const c = S.flatMap(s => s.crossings).find(c => c.x0 > a.x + 3);
  const bench = c && S.flatMap(s => s.props).find(p => p.kind === 'bench' && p.x > c.x1 + 4);
  if (!c || !bench) return [['go', a.x + 20, a.z]];               // the street hasn't grown that far yet
  const cx = (c.x0 + c.x1) / 2, seat = bench.seats[0];
  a.ai.lane = 'path';
  const steps = [];
  if (a.z < Z.kerbN) steps.push(['go', cx, laneMid('far')], ['moment', 'cross'], ['go', cx, laneMid('near')]);
  else steps.push(['go', cx, laneMid('near')]);
  steps.push(['go', cx, 13.6], ['go', seat, 13.6], ['go', seat, 12.96], ['phase', 'meet'], ['sit', 75 * TPS], ['phase', 'after'], ['go', seat, 13.6], ['go', seat - 80, 13.8], ['gone']);
  return steps;
}

function spawnContact(state, orlov) {
  const seat = orlov.x + 0.9;
  const a = { id: `a${state.nextActor++}`, who: 'contact', seed: null, x: orlov.x + 34, z: 14.6, vx: 0, vz: 0, face: 'left', gait: 'walk', stride: 0, stuck: 0,
    ai: { kind: 'subject', speed: 1.25, steps: [['go', seat, 14.2], ['go', seat, 12.96], ['wait', 60 * TPS, 'down', 'sit'], ['go', seat, 14.2], ['go', seat + 70, 14.4], ['gone']], wait: 0 } };
  state.actors.push(a);
  return a.id;
}

function thinkContact(state, a) {
  follow(state, a);
  if (a.ai.gone) state.actors = state.actors.filter(o => o !== a);
}

// ---------- the dice ----------

/** One of his moments: Pathfinding against our Deception, if we're where he's looking. */
function moment(state, bus, t, kind, looking) {
  const sc = state.scenario, me = playerOf(state);
  if (sc.outcome || !me) return;
  const dx = me.x - t.x, d = Math.hypot(dx, me.z - t.z);
  // Where he looks: back (west, the way he came) for a look, and as he doubles back (turned round, so
  // west again); in a window's glass, the street behind him; both ways crossing or leaving a shop.
  const back = looking === 'right' ? dx > 0 : dx < 0;
  const range_ = { look: 45, window: 22, exit: 28, cross: 32, double: 20 }[kind];
  if (d > range_ || ((kind === 'look' || kind === 'double') && !back && d > 3)) return;
  const mods = exposure(state, me, t, d, kind);
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception') },
    { skill: 'pathfinding', value: skill(state.people.orlov, 'pathfinding'), mods });
  sc.rolls++;
  if ((kind === 'exit' || kind === 'cross') && d > 15 && sc.have) keep(state, bus, t, d, kind === 'exit' ? 'out of a shop' : 'across the road');
  const [unseen, seen] = LINES[kind];
  if (r.ok) { say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, unseen) }); return; }
  sc.sightings.push({ ms: state.time.ms, kind });
  say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, seen) });
  if (sc.sightings.length === 1) say(state, bus, { kind: 'instinct', text: 'He\'s seen you. Once. He\'ll be looking for you now.' });
  else {
    say(state, bus, { kind: 'note', text: made });
    addHeat(state, 5);
    t.ai.steps = [['wait', TPS, 'left', 'idle'], ['go', t.x - 70, laneMid(t.z < Z.kerbN ? 'far' : 'near')], ['gone']];
    end(state, bus, 'made', made);
  }
}

/** What makes us easy or hard for him to spot, as modifiers to his roll. */
function exposure(state, me, t, d, kind) {
  const sc = state.scenario, mods = [];
  if (d < 5) mods.push({ why: 'too close', v: 6 }); else if (d < 10) mods.push({ why: 'close', v: 3 });
  else if (d > 35) mods.push({ why: 'far off', v: -6 }); else if (d > 25) mods.push({ why: 'well back', v: -4 }); else if (d > 15) mods.push({ why: 'a good way back', v: -2 });
  const n = crowdAround(state, me, 5);
  if (n === 0 && crowdAround(state, me, 8) === 0) mods.push({ why: 'alone on the pavement', v: 2 });
  else if (n >= 5) mods.push({ why: 'in a crowd', v: -4 }); else if (n >= 2) mods.push({ why: 'among people', v: -2 });
  const light = lightBand(lightLevel(state.$world.lamps, me.x, me.z, state.time.ms));
  if (light === 'dark') mods.push({ why: 'in the dark', v: -4 }); else if (light === 'dim') mods.push({ why: 'in the dusk', v: -2 });
  if (me.gait === 'run') mods.push({ why: 'running', v: 6 });
  if (sc.mirrorS >= 2) mods.push({ why: 'you stopped when he did', v: 3 });
  if (me.busy?.what === 'window') mods.push({ why: 'busy with a shop window', v: -2 });
  const sameSide = (me.z < Z.kerbN) === (t.z < Z.kerbN);
  if (sameSide && d < 20 && Math.abs(me.z - t.z) < 1.2 && kind !== 'cross') mods.push({ why: 'right behind him', v: 1 });
  if (!sameSide && kind !== 'cross') mods.push({ why: 'across the road', v: -3 });
  if (sc.sightings.length && d < 15) mods.push({ why: 'he\'s looking for you', v: 2 });
  return mods;
}

/** A Tracking roll to keep him; lost on a failure. */
function keep(state, bus, t, d, why = null) {
  const sc = state.scenario;
  const r = check(state.rng, { skill: 'tracking', value: skill(state.people[state.player], 'tracking'), dc: keepDC(state, t, d), mods: why ? [{ why: `he's come ${why}`, v: -3 }] : [] });
  sc.rolls++;
  if (!r.ok) { sc.have = false; sc.lostS = 0; say(state, bus, { kind: 'roll', roll: r, text: pick(state.rng, lostLines) }); }
}

/** Keeping him at a distance: Tracking against this difficulty. */
function keepDC(state, t, d) {
  const light = lightBand(lightLevel(state.$world.lamps, t.x, t.z, state.time.ms));
  return 10 + Math.round((d - KEEP_M) * 0.8) + crowdAround(state, t, 3) + (light === 'dark' ? 3 : light === 'dim' ? 1 : 0) + (t.hidden ? 4 : 0);
}

const crowdAround = (state, who, r) => near(state, who.x, who.z, r).filter(o => o.ai?.kind === 'walker' && !o.hidden).length;

// ---------- the meeting, the instinct, the end ----------

function meeting(state, bus, me, t, d) {
  const sc = state.scenario, c = actorOf(state, sc.contact);
  const together = c && c.gait === 'sit' && Math.abs(c.x - t.x) < 2;
  if (!together) {
    if (sc.meetS > 0) end(state, bus, 'missed', MISSED);
    return;
  }
  sc.meetS++;
  if (d < 5 && !sc.contactLooked) {                                // too close: the other man has eyes too
    sc.contactLooked = true;
    const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception') },
      { skill: 'pathfinding', value: skill(state.people.contact, 'pathfinding'), mods: [{ why: 'right by the bench', v: 6 }] });
    sc.rolls++;
    if (!r.ok) {
      say(state, bus, { kind: 'roll', roll: r, text: 'The other man looks up from his paper, straight at you. He folds it, stands and goes.' });
      c.ai.steps = [['go', c.x, 14.2], ['go', c.x + 70, 14.4], ['gone']];
      return end(state, bus, 'blown', 'The meeting\'s over before it began, and Orlov knows why.');
    }
    say(state, bus, { kind: 'roll', roll: r, text: 'The man with the newspaper glances at you over it, and goes back to the football.' });
  }
  if (sc.have && d < WITNESS_M && Math.abs(t.x - me.x) < 19 && Math.abs(t.z - me.z) < 10) sc.witnessS++;
  if (sc.witnessS >= WITNESS_S) {
    sc.lead = `${clockOf(state)}: Orlov met a man in a blue beanie on a bench on the boulevard. Something passed between them in a newspaper.`;
    say(state, bus, { kind: 'note', text: 'A newspaper changes hands on the bench. He leaves it lighter by an envelope. That\'s the meeting, and you saw it.' });
    end(state, bus, 'seen', sc.sightings.length ? 'You saw the meeting. He saw you once on the way, and put it down to Moscow being a small town.'
      : 'You saw the meeting, and he never knew you were there. The station will want to know who wears that beanie.');
  }
}

const clockOf = (state) => { const m = Math.floor(state.time.ms / 60000) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** What a trained eye tells you now: { text, key } (key: what T does, or null). */
function instinct(state, me, t, d, stopped) {
  const sc = state.scenario;
  const byWall = me.z < LANES.far[1] + 0.3 && me.z > Z.front;
  const window = byWall && !me.busy ? 'window' : null;
  if (sc.phase === 'meet' && sc.contact) return { text: d < WITNESS_M ? 'Someone\'s sat down with him. Watch, and don\'t be seen watching.' : 'He\'s meeting someone. Get where you can see it.', key: null };
  if (!sc.have) return { text: 'You\'ve lost him. Grey coat, grey fedora, a briefcase. Find him.', key: null };
  if (t.hidden) return { text: d < 8 ? 'He\'s in the shop. Don\'t wait by the door.' : 'He\'s gone into a shop. He\'ll come out looking.', key: d < 8 ? null : window };
  if (me.gait === 'run' && d < 30) return { text: 'Don\'t run. Running draws the eye.', key: null };
  if (d < 6) return { text: 'Too close. Let him get ahead.', key: window };
  if (stopped && sc.mirrorS >= 1) return { text: 'He\'s stopped. Don\'t stop with him: walk on, or find a reason.', key: window };
  if (d > KEEP_M + 3) return { text: 'He\'s getting away from you.', key: null };
  return null;
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
