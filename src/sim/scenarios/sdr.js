// TRADECRAFT sim: mechanic test 2, being tailed: a surveillance detection run to a meeting
// (DESIGN.md: Being tailed; the first playable's first assignment, a surveillance detection run).
//
// SOLOVEY, a source in the Ministry of Defence, will sit on a bench a street or two away for a few
// minutes (MEET_AFTER_MIN, MEET_FOR_MIN). The player walks there from the embassy's street. Behind
// them there may be surveillance, and the evening decides (TEAMS): none; an overt pair of FSB
// officers, close and barely hiding (in Russia they follow embassy staff and don't much care to be
// seen); or a covert team of three, well back, handing over to each other (HANDOVER_S). The test is
// to know which, and act on it: meet him clean, or call it off rather than walk them to him.
//
// It's played through perception (sim/perception.js), both ways:
//   - **Spotting them.** At the moments a person checks their back (a glance over the shoulder, E
//     tapped; a shop window's glass, as you come to it and every few seconds you stay; crossing the
//     road; standing still a while; and, weakly, all the time) the player rolls Pathfinding against the Deception of each face in view (look()). A face
//     noticed again counts again if it's copied a move of ours it had no reason to copy (stood behind
//     us, close, when we stood STOP_MOVE_S, at a window or anywhere; came over the road when we did;
//     turned when we turned; not a lane, which people going places take too), or simply stayed with us (STAYED_S and
//     STAYED_M on), and not from ahead of us: twice is familiar, three times is a tail.
//     Passers-by are faces too, going places of their own: one may go your way long enough to look
//     like a tail. Whoever comes up a lane after you is noticed more easily; in the rain or the snow,
//     under hoods and umbrellas, everyone less (sim/weather.js weatherMods()).
//   - **Being followed.** The watchers keep KEEP metres back, on your pavement or the other, and go
//     where you go (sim/nav.js), up lanes too. Out of all their sight for LOSE_S they've lost you.
//     Take a lane none of them saw you take, and they never know where you went.
//   - **What they write down.** Seen by a watcher, the conspicuous things are noted (flag()), and the
//     character doesn't know it unless they catch the watcher at it (their Awareness against the
//     watcher's Deception, with the watcher in view): a hedged line, and a face counted. Running,
//     glancing back (your Deception against their Awareness), using a shop window to look (the same
//     roll, GLASS_COVER on your side: people do look in windows; GLASS_AGAIN_COVER at another within
//     GLASS_AGAIN_S), crossing away from the zebra, doubling back, each kind at most FLAGS_MAX times. Each costs FLAG_HEAT at the end; two or more and they
//     know what you are.
//   - **The meeting.** T by the bench sits you beside him for MEET_S seconds. A watcher's eyes on
//     you then and he's burned. Or T calls it off, when the instinct thinks you're followed.
// The instinct talks you through it (instinct()): the way to him, the time, the faces, the lessons.
// Everything shown is what the character knows: the result paper too (result()), with the rest told
// later by the world (epilogue()), and in full only in debug mode.
import { townOf } from '../cities/index.js';
import { at, TICK_MS, clockText, dateText } from '../clock.js';
import { handler, sheet, streetLook, describe, passerby } from '../people.js';
import { heatKey, addHeat } from '../heat.js';
import { say, speak } from '../log.js';
import { strain } from '../needs.js';
import { settle } from '../instinct.js';
import { skill } from '../skills.js';
import { opposed, check } from '../checks.js';
import { range, int, chance, pick, weighted, stream } from '../rng.js';
import { LANES, Z, SECTION_M, section, placeName, streetName } from '../map/street.js';
import { near, sectionAt } from '../world.js';
import { follow, steer, isPasserby } from '../crowd.js';
import { lightBand } from '../light.js';
import { eyes, sees, seesActor, inView, lightHere, gazeInto } from '../perception.js';
import { act, paneAt, paneNear, crossingAt, laneMid, say1 } from '../acts.js';
import { waypoint, zoneOf } from '../nav.js';
import { weatherMods } from '../weather.js';
import { shown as shownOn } from '../notice.js';

const TPS = 1000 / TICK_MS;
export const MEET_AFTER_MIN = [5, 6.5];
export const MEET_FOR_MIN = 8;
export const MEET_S = 20;
export const LOSE_S = { overt: 40, covert: 30 };
export const KEEP_M = { overt: [8, 13], covert: [17, 26] };
export const HANDOVER_S = [70, 110];
export const STOP_MOVE_S = 5;                                     // standing this long is a move a tail must copy
export const STAYED_S = 90;                                        // or a face still behind us this long
export const STAYED_M = 100;                                       // and this far on
export const FLAG_HEAT = 3;
export const GLASS_COVER = 5;                                      // a look in a shop window: to the eye, someone looking at the goods
export const GLASS_AGAIN_COVER = 1;                                // less so at every window on the way
export const GLASS_AGAIN_S = 60;
export const TEAMS = [['none', 3], ['overt', 3.5], ['covert', 3.5]];
export const HOURS = [{ id: 'afternoon', h: 15, m: 20, w: 1 }, { id: 'dusk', h: 16, m: 40, w: 2 }, { id: 'night', h: 19, m: 30, w: 1.5 }];

const SOLOVEY_LOOK = { skin: 'light', hair: { style: 'bald', color: 0x8f96a6 }, glasses: 'specs', top: { kind: 'coat', color: 0x47302a, trim: 0x2a1c18 },
  legs: 0x23252f, shoes: 0x14151c, carry: 'paper' };

export const sdr = {
  name: '2. Being tailed',
  test: true,
  about: 'Walk to a meeting with a source. Find out whether the FSB is behind you, and don\'t take them to him. Each evening is different.',
  brief(state) {
    const sc = state.scenario, g = sc.meet;
    return subAll(state, {
      title: 'MEETING: SOLOVEY',
      body: [
        `SOLOVEY works in the Ministry of Defence and has been ours for two years. Tonight he'll sit on a bench in ${g.place}, ${rowsText(g.row)}, from ${clockText(g.from)} until ${clockText(g.to)}. Bald, glasses, a brown coat, a newspaper.`,
        'The FSB follows embassy staff when it likes. Some evenings nobody. Some evenings two of them, close, not caring if you see. Some evenings a proper team you won\'t see unless you look.',
        'Find out which, before you go near him. Check your back the way people do: a shop window, a crossing, a reason to turn. Glance over your shoulder if you must, but they\'ll see you do it.',
        'If they\'re on you, lose them where they can\'t see you do it, or don\'t go. Walking them to him ends him. Running, doubling back, crossing anywhere: they write it all down, and then they know what you are.',
      ],
      footer: `Station Moscow · Thursday 5 November 2026 · ${clockText(sc.began)}`,
      keys: [['watch', 'tapped: glance back; held: stop and look'], ['instinct', 'does what your instinct offers (a window, a bench, cross, sit with him, call it off)'], ['slow', 'held: stroll'], ['log', 'the log']],
    });
  },

  setup(state, opts = {}) {
    const { campaign: C = null, city = null } = opts;
    const r = state.rng;
    // (from a campaign, its context: the character, the time, the city, the asset, the team by the heat: sim/campaign.js context())
    const hour = C ? { id: 'campaign', h: 0, m: 0 } : weighted(r, HOURS.map(h => [h, h.w])), team = C?.team ?? weighted(r, opts.lesson?.options?.teams ?? TEAMS);   // (a lesson's own odds: sim/tutorial/)
    state.time.ms = C ? C.startMs : at(2026, 11, 5, hour.h, hour.m);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.country = C?.country ?? 'ru';
    state.heat[heatKey('embassy', state.country)] = C ? C.heat : team === 'none' ? 22 : team === 'overt' ? 34 : 44;
    const me = C ? { ...structuredClone(C.player), id: 'me' } : handler(r);
    state.people[me.id] = me;
    state.player = me.id;
    state.people.solovey = sheet({ id: 'solovey', name: C?.asset?.codename ?? 'SOLOVEY', sex: 'm', look: C?.asset?.look ?? SOLOVEY_LOOK, persistent: true, skills: { awareness: [3, 0], cqc: [2, 0] } });
    state.map = { kind: 'street', seed: C ? C.mapSeed : Math.floor(range(r, 0, 4294967296)), row: 0, i0: null, i1: null, crowd: 1, city: C?.city ?? city ?? undefined };
    state.actors.push({ id: 'a0', who: me.id, seed: null, x: 0, z: -2.6, vx: 0, vz: 0, face: 'right', head: 0, gait: 'idle', stride: 0, stuck: 0, ai: null });
    const meet = placeMeeting(state, r);
    meet.from = C?.meetFrom ?? state.time.ms + Math.round(range(r, ...MEET_AFTER_MIN) * 60) * 1000;
    meet.to = meet.from + MEET_FOR_MIN * 60000;
    // The team, if there is one: its people, how they keep (who's the eye, who backs up, a spare).
    const roles = team === 'overt' ? ['eye', 'back'] : team === 'covert' ? ['eye', 'back', 'spare'] : [];
    const crew = roles.map((role, i) => {
      const sex = chance(r, team === 'covert' ? 0.4 : 0.15) ? 'f' : 'm';
      const who = `fsb${i}`;
      const look = streetLook(r, sex, 28 + int(r, 20));
      delete look.carry;
      state.people[who] = sheet({ id: who, name: `an FSB officer (${describe(look, sex)})`, sex, cls: 'spook', os: team === 'covert' ? 35 : 20, look,
        skills: { deception: team === 'covert' ? [12, 1] : [4, 0], tracking: [10, 1], awareness: [9, 1], pathfinding: [8, 0], cqc: [12 + int(stream('cqc', who, state.map.seed), 7), 1] } });   // (trained to take people: 12–18)
      return { who, role, keep: Math.round(range(r, ...KEEP_M[team])), side: role === 'back' && team === 'covert' ? 'across' : role === 'back' ? pick(r, ['same', 'across']) : 'same', id: null };
    });
    state.scenario = {
      kind: 'sdr', hour: hour.id, team, crew, meet, seats: meet.seats.map(x => ({ row: meet.row, x })), phase: 'walk', asset: null, teamLost: team === 'none', teamSeenMs: state.time.ms, pending: [],
      nextHandover: state.time.ms + Math.round(range(r, ...HANDOVER_S)) * 1000, heading: { dir: 1, s: 0 },
      faces: {}, suspects: {}, flags: [], flagged: {}, checks: 0, glances: 0, windows: 0, glassS: 0, stillS: 0, onRoad: false, sinceMap: null, check: null, moves: 0, snap: null,
      prompt: null, outcome: null, rolls: 0, began: state.time.ms, met: false, burned: false,
      role: C?.asset?.role ?? null, campaign: !!C,
    };
    say(state, null, { kind: 'note', text: sub(state, `${me.name}. ${clockText(state.time.ms)}, out of the embassy on ${streetName(townOf(state.map), 0)}. SOLOVEY: ${meet.place}, ${rowsText(meet.row)}, from ${clockText(meet.from)}.`) });
  },

  // The team picks you up as you come out: behind you, off the screen's edge.
  attach(state) {
    const sc = state.scenario;
    if (sc.started) return;
    sc.started = true;
    for (const c of sc.crew) if (c.role !== 'spare') join(state, c, -range(state.rng, 21, 25));
    sc.teamSeenMs = state.time.ms + 60000;                          // (they know the door you came out of)
  },

  act(state, bus, action) {
    const sc = state.scenario, me = playerOf(state);
    if (!me || sc.outcome) return;
    if (action === 'glance') return glanced(state, bus, me);
    if (action !== 'instinct') return;
    const p = sc.prompt;
    if (sc.phase === 'meet') return;                               // (sitting with him: nothing to do but talk)
    if (p?.act === 'meet') return sitDown(state, bus, me);
    if (p?.act === 'pass') return brushPass(state, bus, me);
    if (p?.act === 'load' || p?.act === 'mark') return dropAct(state, bus, me, p.act);
    if (p?.act === 'abort') return callOff(state, bus);
    if (p?.act) act(state, bus, me, p.act, { toward: -sc.heading.dir });   // (a window: its glass running back the way you came)
    else say(state, bus, { kind: 'instinct', text: me.busy || me.glass ? 'You\'re at it. Moving stops it.' : 'Nothing to do here but walk, and look.' });
  },

  think(state, a, bus) {
    if (a.ai.kind === 'watcher') return thinkWatcher(state, a);
    follow(state, a);
    if (a.ai.gone) state.actors = state.actors.filter(o => o !== a);
  },

  anchors(state) { return []; },

  /** A shop window's glass, to run back the way you came. */
  toward(state) { return -state.scenario.heading.dir; },

  /** A taxi (sim/taxi.js): it loses them, and whoever saw you get in writes it down (evasive, and they know what that means). */
  onTaxi(state, bus) {
    const sc = state.scenario;
    flag(state, bus, 'taxi');
    if (sc.crew.some(c => c.id)) {
      const ids = sc.crew.map(c => c.id).filter(Boolean);
      loseUs(state, bus);
      sc.lostHow = 'in a taxi';
      state.actors = state.actors.filter(a => !ids.includes(a.id));   // (left on the street behind you)
    }
  },

  /**
   * A bus (sim/buses.js): nothing written down (people take buses), but a man on foot can get on one
   * too. Getting on: whoever of them saw you, near enough the doors (BUS_BOARD_M: an overt pair runs
   * for it), gets on (an overt pair both; a covert team its nearest, and the car may keep the bus in
   * sight, BUS_CAR_KEEPS). Getting off: they get off behind you (off the bus after you, their faces
   * easier to know), and you look, as anyone would; the car's man gets out a way behind you a minute
   * or two later.
   * Nobody saw you get on, or nobody made it: lost.
   */
  onBus(state, bus, to, phase) {
    const sc = state.scenario, me = playerOf(state), now = state.time.ms;
    if (phase === 'board') {
      sc.riders = []; sc.carKeeps = false;
      if (sc.teamLost) return;
      const dist = (a) => Math.hypot(a.x - me.x, a.z - me.z);
      const saw = sc.crew.map((c, k) => ({ k, a: actorOf(state, c.id) })).filter(o => o.a && dist(o.a) < BUS_SEEN_M && seesActor(state, o.a, me)).sort((p, q) => dist(p.a) - dist(q.a));
      const made = saw.filter(o => dist(o.a) < BUS_BOARD_M[sc.team]);
      sc.riders = (sc.team === 'overt' ? made : made.slice(0, 1)).map(o => o.k);
      sc.carKeeps = sc.team === 'covert' && saw.length > 0 && chance(stream('bus-car', state.map.seed, now), BUS_CAR_KEEPS);
      const ids = sc.crew.map(c => c.id).filter(Boolean);
      for (const c of sc.crew) c.id = null;
      state.actors = state.actors.filter(a => !ids.includes(a.id));   // (left at the stop, or on the bus with you: brought back at the other end)
      sc.pending = [];
      if (!sc.riders.length && !sc.carKeeps) { sc.teamLost = true; sc.lostHow = 'on a bus'; }
      return;
    }
    sc.arrival = { x: me.x, z: me.z };
    sc.riders.forEach((k, n) => sc.pending.push({ crew: k, at: now + 1200 + n * 900, bus: true }));
    const car = sc.carKeeps && sc.crew.findIndex((c, k) => !sc.riders.includes(k));
    if (car !== false && car >= 0) sc.pending.push({ crew: car, at: now + Math.round(range(stream('bus-car', state.map.seed, now), 60, 150) * 1000), car: true });
    sc.teamSeenMs = now;
    sc.check = { tick: state.tick + 3 * TPS, why: 'alight', bonus: 1 };   // (who gets off with you: anyone looks)
  },

  /** Where you're going, for the picture's edge: the bench, until it's done. */
  goal(state) {
    const sc = state.scenario, g = sc.meet;
    if (sc.phase !== 'walk') return null;
    const me = playerOf(state), dr = g.row - state.map.row;
    const far = dr ? rowsText(dr) : `${Math.round(Math.abs(g.x - me.x))} m`;
    return { row: g.row, x: g.x, z: g.z, label: sub(state, `SOLOVEY · ${far}`) };
  },

  /**
   * Through a lane: the watchers who saw you go in follow you through it, a little behind. Back down
   * the same lane before they're through, and you meet them in it: they turn and come back with you,
   * and they've seen you double back. Through another way, whoever was still in the lane has lost you.
   */
  carry(state, way) {
    const sc = state.scenario, me = playerOf(state), was = sc.pending, now = state.time.ms;
    const back = !!sc.lastWay && way.dir !== sc.lastWay.dir && way.x1 > sc.lastWay.x0 && way.x0 < sc.lastWay.x1 && (state.map.row ?? 0) === sc.lastWay.to;
    sc.lastWay = { x0: way.x0, x1: way.x1, dir: way.dir, to: (state.map.row ?? 0) + (way.dir === 'n' ? -1 : 1) };
    sc.pending = [];
    if (sc.teamLost) return [];
    if (back && was.length) {
      for (const p of was) sc.pending.push({ crew: p.crew, at: now + 1500 + Math.round(range(state.rng, 0, 1500)) });
      const who = sc.crew[was[0].crew].who;
      if (sc.flags.filter(f => f.kind === 'doubled').length < FLAGS_MAX) {
        sc.flags.push({ kind: 'doubled', ms: now, who });
        sc.flagged.doubled = now;
        say(state, null, { kind: 'note', hidden: true, text: `${cap(describe(state.people[who].look, state.people[who].sex))} met you in the lane, coming back, and made a note of it.` });
      }
    }
    for (const c of sc.crew) {
      const a = c.id && actorOf(state, c.id);
      if (!a || a.ai.steps?.length) continue;
      const d = Math.hypot(a.x - me.x, a.z - me.z);
      if (now - (a.ai.seenMs ?? -1e12) < 4000 && d < 45) sc.pending.push({ crew: sc.crew.indexOf(c), at: now + Math.round(d / 1.7 * 1000) + 1500 });
    }
    if (!sc.pending.length && (sc.crew.some(c => c.id) || was.length)) { sc.teamLost = true; sc.lostHow = `up ${way.name}`; }
    for (const c of sc.crew) c.id = null;                         // (they're left on the old street; the pending come through)
    return [];
  },

  mapChanged(state) {
    const sc = state.scenario;
    sc.sinceMap = state.time.ms;
    sc.asset = null;
    sc.suspects = {};
    sc.arrival = { x: playerOf(state).x, z: playerOf(state).z };
  },

  /**
   * Into a shop (sim/shops.js): seen going in, they watch the door (they don't lose you while you're
   * in it); out the back, they wait for nothing, and they know what that means (backway). A covert
   * team covers a back way BACK_COVERED of the time: the spare's in the street behind.
   */
  onShop(state, bus, phase, way) {
    const sc = state.scenario, me = playerOf(state);
    if (sc.outcome || sc.teamLost) return;
    if (phase === 'in') { sc.inShop = { seen: sc.crew.some(c => { const a = actorOf(state, c.id); return a && seesActor(state, a, { ...me, hidden: false }); }) }; return; }
    const seen = sc.inShop?.seen;
    sc.inShop = null;
    // (out the front in another coat: watching the door for the old one, they may look straight past you;
    // if they don't, they've seen a change of clothes, and know what it means)
    if (way === 'coat' && seen && sc.crew.some(c => c.id)) {
      if (chance(stream('coat', state.map.seed, state.time.ms), COAT_MISSED[sc.team] ?? 0.3)) {
        const ids = sc.crew.filter(c => c.id).map(c => c.id);
        loseUs(state, bus); sc.lostHow = 'in a new coat';
        state.actors = state.actors.filter(a => !ids.includes(a.id));
        say(state, bus, { kind: 'note', hidden: true, text: 'They watched the door for a coat that never came out.' });
      } else if (sc.flags.filter(f => f.kind === 'changed').length < FLAGS_MAX) sc.flags.push({ kind: 'changed', ms: state.time.ms, who: sc.crew[0].who });
      return;
    }
    if (way !== 'back' || !seen || !sc.crew.some(c => c.id)) return;
    if (sc.team === 'covert' && chance(stream('back', state.map.seed, state.time.ms), BACK_COVERED)) {
      const ids = sc.crew.filter(c => c.id).map(c => c.id);
      loseUs(state, bus); sc.teamLost = false;                      // (off the old street: the one in the street behind comes on)
      state.actors = state.actors.filter(a => !ids.includes(a.id));
      sc.pending = sc.crew.slice(0, 2).map((c, k) => ({ crew: sc.crew.indexOf(c), at: state.time.ms + 4000 + k * 6000 }));
      sc.arrival = { x: me.x + 12, z: me.z };
      say(state, bus, { kind: 'note', hidden: true, text: 'The street behind had someone in it already. They\'d covered the back.' });
    } else {
      const ids = sc.crew.filter(c => c.id).map(c => c.id);
      loseUs(state, bus); sc.lostHow = 'out the back of a shop';
      state.actors = state.actors.filter(a => !ids.includes(a.id));
      say(state, bus, { kind: 'note', hidden: true, text: 'They waited on the shop door, went in at last, and found the back door.' });
    }
    if (sc.flags.filter(f => f.kind === 'backway').length < FLAGS_MAX) sc.flags.push({ kind: 'backway', ms: state.time.ms, who: sc.crew[0].who });
  },

  /**
   * F on someone (sim/interact.js): a word with one of them tells them you've made them; a blow is an
   * incident, with your name on it (ASSAULT_HEAT), and they don't lose you for it. A blow on SOLOVEY
   * ends it (when the fight's over).
   */
  onInteract(state, bus, them, id) {
    const sc = state.scenario;
    if (sc.outcome || id === 'read' || id === 'aid') return;
    const crew = sc.crew.find(c => c.id === them.id);
    if (crew) {
      const kind = id === 'talk' ? 'spoke' : 'assaulted';
      if (sc.flags.filter(f => f.kind === kind).length < FLAGS_MAX) sc.flags.push({ kind, ms: state.time.ms, who: them.who });
      if (kind === 'assaulted') addHeat(state, ASSAULT_HEAT);
      sc.teamSeenMs = state.time.ms;
      say(state, bus, { kind: 'note', hidden: true, text: kind === 'spoke' ? 'That was one of them, and now they know you know.' : 'That was one of them. There\'ll be an incident report with your name on it by morning.' });
    }
    if (them.who === 'solovey' && id !== 'talk' && !sc.after) sc.after = ['incident', 'You turned on your own source, in the street, in front of whoever was watching. Whatever SOLOVEY was, he isn\'t yours any more.'];
  },

  tick(state, bus) {
    const sc = state.scenario;
    if (sc.outcome) return;
    if (sc.after) { if (!state.fight) { const [outcome, text] = sc.after; sc.after = null; end(state, bus, outcome, text); } return; }
    const me = playerOf(state);
    if (!me) return;
    // Watchers coming up the lane after us.
    for (const p of sc.pending.filter(p => state.time.ms >= p.at)) {
      sc.pending = sc.pending.filter(q => q !== p);
      // (the car's man gets out a way behind you, wherever you've walked to since; the others come up the way you came)
      const c = sc.crew[p.crew], a = p.car ? join(state, c, -Math.sign(me.vx || 1) * range(state.rng, 18, 30)) : join(state, c, 0, sc.arrival);
      a.ai.seenMs = state.time.ms; a.ai.fromLane = !p.bus; a.ai.fromBus = !!p.bus;
      sc.teamSeenMs = state.time.ms;
    }
    if (sc.check && state.tick >= sc.check.tick) { look(state, bus, sc.check.why, sc.check.bonus); sc.check = null; }
    if (state.tick % TPS !== 0) return;
    second(state, bus, me);
  },

  /**
   * The result paper: only what the character knows. What they did and saw; the faces they marked;
   * what they think a watcher caught them at. What really happened comes later, as the world tells
   * it (an epilogue: his next signal, or an arrest in the papers; a car outside the building more
   * often). In debug mode, the truth too, for tuning.
   */
  result(state, { debug = false } = {}) {
    const sc = state.scenario;
    const marked = Object.values(sc.faces).filter(f => f.n >= 2);
    const caught = sc.caught ?? [];
    const notes = [
      marked.length ? `Faces you'd marked: ${list(marked.map(f => `${f.look} (${f.sure ? 'a tail, you\'d say' : 'seen before'})`))}.` : 'You marked no face as following you.',
      caught.length ? `You think ${list(caught.map(c => `${c.look} saw you ${CAUGHT[c.kind]}`))}.` : null,
      epilogue(state),
    ];
    if (debug) {
      const crew = sc.crew.map(c => describe(state.people[c.who].look, state.people[c.who].sex));
      const truth = sc.team === 'none' ? 'nobody was behind you' : `${sc.team === 'overt' ? 'an overt pair' : 'a covert team of three'} (${list(crew)}), ${sc.teamLost ? `who lost you${sc.lostHow ? ` ${sc.lostHow}` : ''}` : 'with you to the end'}`;
      const kinds = [...new Set(sc.flags.map(f => f.kind))].map(k => `${FLAGS[k]}${sc.flags.filter(f => f.kind === k).length > 1 ? ' (twice)' : ''}`);
      notes.push(`Debug, what really happened: ${truth}; the meeting was ${sc.outcome}; written down: ${kinds.length ? list(kinds) : 'nothing'}.`);
    }
    return subAll(state, {
      stamp: OUTCOMES[sc.outcome] ?? sc.outcome, good: sc.met,
      title: sc.campaign ? `MEETING: ${state.people.solovey.name}` : sdr.name.toUpperCase(), text: sc.endText,
      lead: sc.met ? `${clockText(sc.ended)}: SOLOVEY handed over a folded newspaper. Inside, next month's procurement schedule for the Western Military District.` : null,
      notes: notes.filter(Boolean),
      stats: `${Math.floor((sc.ended - sc.began) / 60000)} min ${Math.round((sc.ended - sc.began) / 1000) % 60} s · ${sc.checks} checks of your back (${sc.glances} glances, ${sc.windows ?? 0} shop windows)${shownRolls(state) ? ` · ${shownRolls(state)} rolls in the log (J)` : ''}`,
    });
  },
};

/**
 * From a campaign, the asset is theirs, not SOLOVEY of the Ministry of Defence: the scene's words are
 * the test's, and this puts the campaign's codename, role, look, city and date in, where words leave
 * the scene (the brief, the log, the instinct, the ending, the result paper). Standalone, nothing changes.
 */
function sub(state, t) {
  const sc = state.scenario, s = state.people.solovey;
  if (typeof t !== 'string' || !sc?.campaign) return t;
  return t.replace(/SOLOVEY/g, s.name)
    .replace('works in the Ministry of Defence and has been ours for two years', `is ${sc.role ?? 'one of ours'}, and has been ours a while`)
    .replace('a Ministry of Defence official', sc.role ?? 'an official')
    .replace('Bald, glasses, a brown coat, a newspaper.', `${cap(describe(s.look, s.sex))}, with a newspaper.`)
    .replace(/Station Moscow · Thursday 5 November 2026/, `Station ${CITY_NAME[state.map.city] ?? 'Moscow'} · ${dateText(sc.began)}`)
    .replace('Inside, next month\'s procurement schedule for the Western Military District.', 'Inside: what the agency asked for.');
}
const subAll = (state, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => (typeof x === 'string' ? sub(state, x) : x)) : sub(state, v)]));
const CITY_NAME = { moscow: 'Moscow', london: 'London', beirut: 'Beirut', cairo: 'Cairo' };

// The rolls the character saw (those that reached the log not hidden): a count of all of them would
// hint at what they didn't see.
export const shownRolls = (state) => state.log.filter(e => e.roll && !e.hidden && e.ms >= state.scenario.began).length;

// What the world tells you later: how it went for SOLOVEY, and the signs of what the FSB made of you.
function epilogue(state) {
  const sc = state.scenario;
  const him = sc.outcome === 'incident' ? 'SOLOVEY never signals again. The embassy\'s told nothing, which tells it everything.'
    : sc.outcome === 'burned' ? 'Three weeks later SOLOVEY misses his signal, and the one after. In December the evening papers report the arrest of a Ministry of Defence official for espionage.'
    : sc.outcome === 'clean' ? 'Later: SOLOVEY\'s next signal comes on time, and the one after that.'
      : 'A week later SOLOVEY makes the fallback meeting, nervous, but whole.';
  // The signs are there to be read, and only a good eye reads them. Unread, a month of them reads
  // exactly as a month without any: no clue to what the character doesn't know.
  const signs = sc.signs?.level && sc.signs.read
    ? (sc.signs.level >= 2 ? ' Through the rest of November there\'s a car outside your building more often than not.' : ' Now and then that month, the same face twice on your way to work.')
    : ' November passes quietly.';
  return `${him}${signs}`;
}

// (the stamp says what the character knows: whether they sat down with him, not how it went)
const OUTCOMES = { clean: 'MET', burned: 'MET', right: 'CALLED OFF', needless: 'CALLED OFF', missed: 'MISSED', incident: 'INCIDENT' };
const CAUGHT_LINE = {
  bloody: (who) => `${who} looks at the blood on you a moment too long.`,
  armed: (who) => `${who}'s eyes go to your hand, and stay there.`,
  ran: (who) => `${who} turns to watch you run, and keeps watching a beat too long.`,
  checked: (who) => `As you turn back, ${who[0].toLowerCase() + who.slice(1)} looks away a moment too late. They may have seen you check.`,
  glassed: (who) => `In the glass, ${who[0].toLowerCase() + who.slice(1)} is watching you, not the street. They may know what you were looking at.`,
  jaywalked: (who) => `${who} watches you cross, and doesn't look away when you look up.`,
  doubled: (who) => `When you turn round, ${who[0].toLowerCase() + who.slice(1)} stops too, and finds a shop window very interesting.`,
};
const CAUGHT = { bloody: 'walk about bloody', armed: 'carry a weapon in your hand', ran: 'run', checked: 'look back', glassed: 'check behind you in a shop window', jaywalked: 'cross away from the zebra', doubled: 'double back' };
const FLAGS = { changed: 'you went into a shop in one coat and came out in another', bloody: 'you walked about with blood on you', backway: 'you went into a shop and out the back', armed: 'you walked the street with a weapon showing', assaulted: 'you went for one of them', spoke: 'you spoke to one of them', ran: 'you ran', checked: 'you checked behind you', glassed: 'you used a shop window to check behind you', jaywalked: 'you crossed away from the zebra', doubled: 'you doubled back', taxi: 'you jumped into a taxi', marked: 'you chalked a mark on a lamppost' };
const SAW = { changed: 'saw you come out in another coat', bloody: 'saw the blood on you', backway: 'waited on a shop door for nothing', armed: 'saw the weapon on you', assaulted: 'took it from you', spoke: 'had a word from you', ran: 'saw you run', checked: 'saw you check behind you', glassed: 'saw you use a shop window to check behind you', jaywalked: 'saw you cross away from the zebra', doubled: 'saw you double back', taxi: 'saw you jump into a taxi', marked: 'saw you chalk a lamppost' };
export const FLAGS_MAX = 2;
export const ASSAULT_HEAT = 12;
export const BACK_COVERED = 0.3;
export const COAT_MISSED = { overt: 0.5, covert: 0.3 };              // (out the front in a new coat: they look past you)                                    // (a covert team with the back of a shop covered)
export const NET_FLAGS = 2;
export const BUS_SEEN_M = 30, BUS_BOARD_M = { overt: 25, covert: 12 }, BUS_CAR_KEEPS = 0.5;                                        // (lost after this many things written down: the wider net)
export const NET_CHANCE = 0.5;                                    // (an FSB officer assaulted: an incident, a note to the embassy)                                        // times a kind of thing is written down, at most
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const actorOf = (state, id) => (id ? state.actors.find(a => a.id === id) : null);
const playerOf = (state) => state.actors.find(a => a.who === state.player);
export const rowsText = (row) => (row === 0 ? 'on this street' : `${Math.abs(row) === 1 ? 'a street' : `${Math.abs(row)} streets`} ${row < 0 ? 'north' : 'south'}`);

// The bench: in a park (or failing that on a boulevard) a street or two north (now and then south),
// some 200–500 m east.
function placeMeeting(state, r) {
  const seed = townOf(state.map), row = weighted(r, [[-1, 3], [-2, 2], [1, 1.5]]);
  const pickIn = (S) => { const b = pick(r, S.props.filter(p => p.kind === 'bench')); return b && { row, i: S.i, x: b.seats[0], z: 12.96, seat: b.seats[0], seat2: b.seats.at(-1), seats: b.seats.slice() }; };   // (the far end: room between)
  let found = null;
  for (let i = 4; i <= 11 && !found; i++) { const S = section(seed, i, row); if (S.band === 'park') found = pickIn(S); }
  for (let i = 5; i <= 11 && !found; i++) found = pickIn(section(seed, i, row));
  found.place = placeName(seed, row, found.x, 14);
  return found;
}

// ---------- the team ----------

/** A watcher steps onto the street (behind us by dx, or at a lane's end `from`). */
function join(state, c, dx, from = null) {
  const me = playerOf(state), r = state.rng;
  const x = from ? from.x + range(r, -0.6, 0.6) : me.x + dx, z = from ? from.z : (c.side === 'across' ? laneMid('near') : laneMid('far'));
  const a = { id: `a${state.nextActor++}`, who: c.who, seed: null, x, z, vx: 0, vz: 0, face: 'right', head: 0, gait: 'walk', stride: 0, stuck: 0,
    ai: { kind: 'watcher', speed: 1.5, steps: [], wait: 0, seenMs: state.time.ms } };
  state.actors.push(a);
  c.id = a.id;
  return a;
}

const crewOf = (state, a) => state.scenario.crew.find(c => c.id === a.id);

// A watcher: the eye walks KEEP metres behind us on our pavement (or level across the road, for a
// back-up), goes where we go, and stops when we stop (an overt one facing us; a covert one at a
// window, us in its glass). Peeling off (a handover, or lost us), it walks a plan out of the map.
function thinkWatcher(state, a) {
  const sc = state.scenario, me = playerOf(state), c = crewOf(state, a);
  if (a.ai.steps.length || !c || !me) {
    if (!follow(state, a)) a.ai.gone = true;
    if (a.ai.gone) state.actors = state.actors.filter(o => o !== a);
    return;
  }
  if (seesActor(state, a, me)) a.ai.seenMs = state.time.ms;
  const dir = sc.heading.dir, zone = zoneOf(state, me.x, me.z);
  // (they have to see you to follow you: closer in the dark, and closer still out of sight a while)
  const blind = state.time.ms - (a.ai.seenMs ?? 0) > 4000, dark = lightHere(state, me.x, me.z) < 0.25;
  const keep = (c.role === 'eye' ? c.keep : c.keep + 8) * (dark ? 0.55 : 1) * (blind ? 0.5 : 1);
  let tx, tz;
  if (zone === 'north' || zone === 'south') { tx = me.x; tz = me.z + (zone === 'north' ? 1 : -1) * keep * 0.7; }
  else if (c.side === 'across' && zone === 'street') { tx = me.x - dir * keep * 0.5; tz = me.z < Z.kerbN ? laneMid('near') : laneMid('far'); }
  else { tx = me.x - dir * keep; tz = me.z; }
  const [wx, wz] = waypoint(state, a, tx, tz);
  const d = Math.hypot(tx - a.x, tz - a.z);
  if (d < 1) {
    a.vx = a.vz = 0; a.gait = 'idle';
    const toMe = Math.atan2(me.z - a.z, me.x - a.x);
    if (sc.team === 'overt') { a.head = toMe; a.face = Math.abs(Math.cos(toMe)) > Math.abs(Math.sin(toMe)) ? (Math.cos(toMe) > 0 ? 'right' : 'left') : (Math.sin(toMe) > 0 ? 'down' : 'up'); }
    else if (paneAt(state, a.x, a.z)) {                               // (at a shop's glass: watching us in it)
      a.glass ||= { ...paneAt(state, a.x, a.z), since: state.time.ms };
      a.face = 'up'; a.head = gazeInto(a.glass, a.x, a.z, me.x, me.z);
    } else { a.head = toMe; a.face = Math.cos(toMe) > 0 ? 'right' : 'left'; }
    return;
  }
  a.glass = false;
  steer(state, a, wx, wz, d > 8 ? 2.1 : d > 3 ? 1.6 : 1.15, d > 4);
  // (their eyes on you, whichever way their feet go: that's the job)
  const toMe = Math.atan2(me.z - a.z, me.x - a.x);
  if (Math.abs(((toMe - a.head + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 2.2) a.head = toMe;
}

/** Lost us: the team drifts off, the way they were going. */
function loseUs(state, bus) {
  const sc = state.scenario;
  sc.teamLost = true;
  for (const c of sc.crew) {
    const a = actorOf(state, c.id);
    if (a) a.ai.steps = [['go', a.x + (chance(state.rng, 0.5) ? 50 : -50), laneMid(a.z < Z.kerbN ? 'far' : a.z > Z.roadS ? 'south' : a.z > 11 ? 'path' : 'near')], ['gone']];
    c.id = null;
  }
  sc.pending = [];
}

// A handover (a covert team): the eye peels off into a shop or walks on past, the back-up takes the
// eye, the spare joins as the new back-up, from behind.
function handover(state) {
  const sc = state.scenario, me = playerOf(state), r = state.rng;
  const eye = sc.crew.find(c => c.role === 'eye' && c.id), back = sc.crew.find(c => c.role === 'back' && c.id), spare = sc.crew.find(c => c.role === 'spare' || (c.role !== 'eye' && c.role !== 'back' && !c.id));
  if (!eye || !back) return;
  const a = actorOf(state, eye.id);
  const door = a && (sectionAt(state, a.x)?.doors ?? []).filter(d => d.kind === 'shop' && Math.abs(d.x - a.x) < 12 && a.z < Z.kerbN)[0];
  if (a) a.ai.steps = door ? [['go', door.x, -4.4], ['go', door.x, Z.front + 0.3], ['gone']] : [['go', a.x + sc.heading.dir * 70, a.z], ['gone']];
  eye.id = null; eye.role = 'spare';
  back.role = 'eye'; back.side = 'same';
  if (spare) { spare.role = 'back'; spare.side = 'across'; if (zoneOf(state, me.x, me.z) === 'street') join(state, spare, -sc.heading.dir * range(r, 28, 34)); }
}

// ---------- what we see, and what they see ----------

/**
 * We check our back (why: 'glance', 'window', 'cross', 'stop', 'passive'): every face in view, our
 * Pathfinding against their Deception, and a face noticed again is counted.
 */
function look(state, bus, why, bonus = 0) {
  const sc = state.scenario, me = playerOf(state);
  if (!me) return;
  if (why !== 'passive') sc.checks++;
  sc.lastCheck = why;
  const ours = skill(state.people[state.player], 'pathfinding'), reach = why === 'passive' ? 12 : 32;
  const faces = weatherMods(state);                                 // (hoods up, umbrellas: faces are harder to know: sim/weather.js)
  for (const a of near(state, me.x, me.z, reach)) {
    if (a === me || a.hidden || a.who === 'solovey' || !inView(state, a.id)) continue;
    const d = Math.hypot(a.x - me.x, a.z - me.z), crowd = near(state, a.x, a.z, 3).filter(o => o !== a && isPasserby(o)).length;
    const light = lightBand(lightHere(state, a.x, a.z));
    const mods = [bonus && { why: { glance: 'a straight look', cross: 'crossing, looking both ways', window: 'in the glass', stop: 'stood, looking about', passive: 'not looking', kiosk: 'over the top of a paper', cafe: 'from a café window', phone: 'through a phone box\'s glass', shelter: 'waiting for a bus', notices: 'over the notices', alight: 'watching who gets off with you' }[why], v: bonus },
      d > 20 ? { why: 'far off', v: -3 } : d > 12 ? { why: 'a way off', v: -1 } : null, crowd >= 2 && { why: 'among people', v: -2 },
      light === 'dark' && { why: 'in the dark', v: -2 }, a.ai?.fromLane && state.time.ms - sc.sinceMap < 30000 && { why: 'up the lane after you', v: 4 }, a.ai?.fromBus && state.time.ms - sc.sinceMap < 30000 && { why: 'off the bus after you', v: 4 }, ...faces].filter(Boolean);
    const theirs = a.who ? skill(state.people[a.who], 'deception') : 2;
    const r = opposed(state.rng, { skill: 'pathfinding', value: ours, mods, body: state.people[state.player] }, { skill: 'deception', value: theirs });
    sc.rolls++;
    if (r.ok) sighting(state, bus, a, r);
  }
}

// Which side of the road a z is on.
const sideOf = (z) => (z < (Z.kerbN + Z.kerbS) / 2 ? 'n' : 's');

/**
 * At the start of a move of ours a tail would have to copy (a stop, a crossing, a doubling back),
 * what everyone about was doing: so that afterwards, someone who copied it can be told from someone
 * who was doing it already (sat on a bench, crossing anyway).
 */
function snapshot(state, kind) {
  const sc = state.scenario, me = playerOf(state), faces = {};
  for (const a of near(state, me.x, me.z, 45)) if (a !== me) faces[a.id] = { moving: Math.hypot(a.vx, a.vz) >= 0.5, side: sideOf(a.z), dir: Math.sign(a.vx), behind: (a.x - me.x) * sc.heading.dir < -2 };
  sc.snap = { kind, side: sideOf(me.z), faces };
}

/** A face we noticed: counted again when it's followed us (it copied a move of ours, or stayed with us). */
function sighting(state, bus, a, roll) {
  const sc = state.scenario, me = playerOf(state), key = String(a.who ?? a.seed);
  const p = a.who ? state.people[a.who] : null, look = p?.look ?? null;
  const f = sc.faces[key] ??= { n: 0, look: a.who ? describe(look, p.sex) : null, crew: !!a.who?.startsWith('fsb'), last: null, rows: [], places: [] };
  if (!f.look) f.look = describeSeed(a.seed, state.map.city);
  f.id = a.id;                                                      // (who, as they're drawn now: the instinct's pointer, src/ui/ui.js)
  const row = state.map.row, place = placeName(townOf(state.map), row, me.x, me.z);
  // A first look at a face behind you, going your way, is worth a word: it may be nothing.
  if (f.n === 0 && roll.ours && sc.lastCheck !== 'passive') {
    const behind = (a.x - me.x) * sc.heading.dir < -3, along = Math.sign(a.vx) === sc.heading.dir && Math.abs(a.vx) > 0.4;
    if (behind && along && Math.hypot(a.x - me.x, a.z - me.z) < 28) sc.lead = { look: f.look, ms: state.time.ms, id: a.id };
  }
  // Evidence is following, not merely going the same way (the crowd goes places too, by the same
  // lanes): a face counts again when it's copied a move of ours it had no reason to copy (moving when
  // we stopped, and stood now; on the side we crossed from, and on ours now; going our old way when we
  // turned, and our new way now: once a move, by snapshot()), or when it's simply
  // stayed with us, STAYED_S and STAYED_M on from its last count. And not from ahead of us: going our
  // way in front isn't following (stood still: ahead of the way we were going, so someone who walks
  // past us as we stand has shown they aren't).
  const sp = Math.hypot(me.vx, me.vz), ahead = sp > 0.5 ? ((a.x - me.x) * me.vx + (a.z - me.z) * me.vz) / sp > 3 : (a.x - me.x) * sc.heading.dir > 3;
  const was = sc.snap?.faces[a.id], still = Math.hypot(a.vx, a.vz) < 0.5, sn = sc.snap, d = Math.hypot(a.x - me.x, a.z - me.z);
  const behind = (a.x - me.x) * sc.heading.dir < -2 && sideOf(a.z) === sideOf(me.z);
  const copied = f.last && was && sc.moves > f.last.moves && {
    stop: was.moving && still && behind && d < 30,                 // (stood behind us when we stood: not anyone who happened to stop)
    cross: was.behind && was.side === sn.side && sideOf(a.z) === sideOf(me.z) && sideOf(me.z) !== sn.side && d > 3 && d < 40,   // (after us, not beside us)
    double: was.dir === -sc.heading.dir && (still || Math.sign(a.vx) === sc.heading.dir) && d < 40,
  }[sn.kind];
  const stayed = f.last && state.time.ms - f.last.ms >= STAYED_S * 1000 && (f.last.row !== row || Math.abs(me.x - f.last.x) >= STAYED_M);
  if (f.last && (ahead || !(copied || stayed))) return;
  if (!copied && f.n >= 2) return;                                // (time alone makes a face familiar; only a copied move makes a tail)
  f.n++; f.last = { row, x: me.x, ms: state.time.ms, ax: a.x, az: a.z, moves: sc.moves };
  if (!f.rows.includes(row)) f.rows.push(row);
  f.places.push(place);
  // (Three times is a tail. Twice, even on two streets, could be someone going your way: the crowd
  // goes places too, and by the same lanes.)
  const sure = f.n >= 3;
  sc.suspects[a.id] = sure ? 2 : f.n >= 2 ? 1 : 0;
  if (f.n === 2 && !sure) say(state, bus, { kind: 'roll', roll, text: `${cap(f.look)} again: ${f.places[0] === place ? 'here before, and here still' : `on ${f.places[0]} before, and now here`}. Could be nothing.` });
  else if (sure && !f.sure) {
    f.sure = true;
    say(state, bus, { kind: 'roll', roll, text: `${cap(f.look)}, ${f.rows.length >= 2 ? 'three times now, and on two streets' : 'three times now'}. That's not Moscow being a small town. That's a tail.` });
  }
}

const describeSeed = (seed, city) => { const p = passerby(seed, city); return describe(p.look, p.sex); };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Something conspicuous, if a watcher sees us do it: they write it down (once in a while, per kind). */
function flag(state, bus, kind) {
  const sc = state.scenario, me = playerOf(state);
  if (sc.teamLost || state.time.ms - (sc.flagged[kind] ?? -1e12) < 15000 || sc.flags.filter(f => f.kind === kind).length >= FLAGS_MAX) return false;
  const w = sc.crew.map(c => actorOf(state, c.id)).find(a => a && !a.ai.steps.length && seesActor(state, a, me));
  if (!w) return false;
  sc.flagged[kind] = state.time.ms;
  sc.flags.push({ kind, ms: state.time.ms, who: w.who });
  const look = describe(state.people[w.who].look, state.people[w.who].sex);
  say(state, bus, { kind: 'note', hidden: true, text: `${cap(look)} ${SAW[kind]}, and made a note of it.` });
  // Do we catch them catching us? Only if they're in our view: our Awareness against their Deception.
  if (inView(state, w.id)) {
    const r = opposed(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player] }, { skill: 'deception', value: skill(state.people[w.who], 'deception'), body: state.people[w.who] });
    sc.rolls++;
    if (r.ok) {
      (sc.caught ??= []).push({ kind, look });
      strain(state, bus, 6);                                          // (you caught them catching you: sim/needs.js)
      say(state, bus, { kind: 'roll', roll: r, text: `${CAUGHT_LINE[kind](cap(look))} Maybe it's nothing.` });
      sighting(state, bus, w, r);
    }
  }
  return true;
}

/** A glance over the shoulder: a look back (in half a second, when the eyes are round), and a risk. */
function glanced(state, bus, me) {
  const sc = state.scenario;
  sc.glances++;
  sc.check = { why: 'glance', bonus: 2, tick: state.tick + Math.round(TPS / 2) };
  if (sc.teamLost) return;
  const w = sc.crew.map(c => actorOf(state, c.id)).find(a => a && !a.ai.steps.length && seesActor(state, a, me) && Math.hypot(a.x - me.x, a.z - me.z) < 25);
  if (!w) return;
  const d = Math.hypot(w.x - me.x, w.z - me.z);
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player], mods: d < 8 ? [{ why: 'close', v: -3 }] : [] },
    { skill: 'awareness', value: skill(state.people[w.who], 'awareness'), body: state.people[w.who] });
  sc.rolls++;
  if (!r.ok) flag(state, bus, 'checked');
}

/**
 * At a shop window, looking in: people do, so a watcher who sees us at it takes it for the goods,
 * mostly (GLASS_COVER on our side; GLASS_AGAIN_COVER at another so soon after the last).
 */
function glassed(state, bus, me) {
  const sc = state.scenario, again = state.time.ms - (sc.glassMs ?? -1e12) < GLASS_AGAIN_S * 1000;
  sc.glassMs = state.time.ms; sc.windows = (sc.windows ?? 0) + 1;
  if (sc.teamLost) return;
  const w = sc.crew.map(c => actorOf(state, c.id)).find(a => a && !a.ai.steps.length && seesActor(state, a, me) && Math.hypot(a.x - me.x, a.z - me.z) < 25);
  if (!w) return;
  const r = opposed(state.rng, { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player], mods: [again ? { why: 'another window, so soon', v: GLASS_AGAIN_COVER } : { why: 'at a shop window, as people are', v: GLASS_COVER }] },
    { skill: 'awareness', value: skill(state.people[w.who], 'awareness'), body: state.people[w.who] });
  sc.rolls++;
  if (!r.ok) flag(state, bus, 'glassed');
}

// ---------- once a second ----------

function second(state, bus, me) {
  const sc = state.scenario, now = state.time.ms;
  const still = Math.hypot(me.vx, me.vz) < 0.05 && !me.busy;
  sc.stillS = still ? sc.stillS + 1 : 0;
  if (state.people[state.player]?.hand || shownOn(state.people[state.player]).belt) flag(state, bus, 'armed');   // (a weapon in the hand, or at an uncovered belt, seen: written down)
  if (state.people[state.player]?.bloody) flag(state, bus, 'bloody');   // (blood on you: sim/notice.js)
  // Our heading along the street, and doubling back (a sharp reversal after a steady stretch).
  const vdir = Math.abs(me.vx) > 0.5 ? Math.sign(me.vx) : 0;
  if (vdir && vdir !== sc.heading.dir) { if (sc.heading.s >= 8) { flag(state, bus, 'doubled'); snapshot(state, 'double'); sc.moves++; } sc.heading = { dir: vdir, s: 0 }; }
  sc.stopS = still ? (sc.stopS ?? 0) + 1 : 0;                     // (stood: at a shop's window too)
  if (sc.stopS === 1) snapshot(state, 'stop');
  if (sc.stopS === STOP_MOVE_S) sc.moves++;
  else if (vdir) sc.heading.s++;
  // The team.
  if (!sc.teamLost) {
    const onUs = sc.crew.some(c => { const a = actorOf(state, c.id); return a && seesActor(state, a, me); });
    if (onUs || (me.inside && sc.inShop?.seen)) sc.teamSeenMs = now;   // (in a shop they saw you go into: they're watching its door)
    if (sc.crew.some(c => c.id) && !sc.pending.length && now - sc.teamSeenMs > LOSE_S[sc.team] * 1000) { loseUs(state, bus); sc.lostHow = sc.lostHow ?? 'in the crowd'; }
    if (sc.team === 'covert' && now >= sc.nextHandover) { handover(state); sc.nextHandover = now + Math.round(range(state.rng, ...HANDOVER_S)) * 1000; }
    if (me.gait === 'run') flag(state, bus, 'ran');
    const onRoad = me.z > Z.kerbN + 0.3 && me.z < Z.kerbS - 0.3;
    if (onRoad && !sc.onRoad && !crossingAt(state, me)) flag(state, bus, 'jaywalked');
  }
  // Our checks: crossing (looking both ways), a shop window's glass (as we come to it, and every
  // few seconds we stay: after STOP_MOVE_S, it shows who stopped when we did), standing a while;
  // weakly, always.
  const onRoad = me.z > Z.kerbN + 0.3 && me.z < Z.kerbS - 0.3;
  if (onRoad && !sc.onRoad) { snapshot(state, 'cross'); sc.moves++; look(state, bus, 'cross', 1); }
  sc.onRoad = onRoad;
  sc.glassS = me.glass ? (sc.glassS ?? 0) + 1 : 0;
  if (sc.glassS === 1) { glassed(state, bus, me); look(state, bus, 'window', 0); }
  else if (sc.glassS && sc.glassS % 6 === 0) look(state, bus, 'window', 0);
  else if (!me.glass && sc.stillS >= 3 && sc.stillS % 6 === 3) look(state, bus, 'stop', -1);
  else if (me.inside?.way === 'sit' && (sc.spotS = (sc.spotS ?? 0) + 1) % 6 === 1) look(state, bus, 'cafe', 2);   // (a café's window: sim/shops.js)
  else if (['kiosk', 'phone', 'shelter', 'notices'].includes(me.busy?.what) && me.busy.steps?.[0]?.[0] === 'wait' && (sc.spotS = (sc.spotS ?? 0) + 1) % 6 === 1) look(state, bus, me.busy.what, me.busy.what === 'phone' || me.busy.what === 'shelter' ? 2 : 1);   // (a kiosk's paper, a phone box's glass: a natural stop, a look at the street: sim/acts.js)
  else if (state.tick % (8 * TPS) === 0) look(state, bus, 'passive', -3);
  for (const id in sc.suspects) if (!actorOf(state, id)) delete sc.suspects[id];
  // SOLOVEY, on his bench from meet.from to meet.to, if we're on his street.
  meeting(state, bus, me);
  if (sc.outcome) return;
  sc.prompt = settle(sc.prompt, [instinct(state, me, still)], now);   // (the line that applies now: sim/instinct.js)
  if (sc.prompt && sc.campaign) sc.prompt.text = sub(state, sc.prompt.text);
}

function meeting(state, bus, me) {
  const sc = state.scenario, g = sc.meet, now = state.time.ms;
  if (sc.brush) return brushMeeting(state, bus, me);
  if (sc.drop) return dropMeeting(state, bus, me);
  const here = state.map.row === g.row;
  let s = actorOf(state, sc.asset);
  if (here && !s && !sc.met && now >= g.from && now < g.to) {
    // On his bench already; or, if we're watching it, walking up the path to it from the east.
    const watching = sees(state, eyes(state, me), g.seat, g.z);
    const sit = [['wait', Math.round((g.to - now) / TICK_MS), 'down', 'sit'], ['go', g.seat, 14], ['go', g.seat - 60, 14.2], ['gone']];
    const a = { id: `a${state.nextActor++}`, who: 'solovey', seed: null, x: watching ? g.seat + 24 : g.seat, z: watching ? 14.4 : g.z, vx: 0, vz: 0, face: watching ? 'left' : 'down',
      head: watching ? Math.PI : Math.PI / 2, gait: watching ? 'walk' : 'sit', stride: 0, stuck: 0,
      ai: { kind: 'subject', speed: 1.2, steps: watching ? [['go', g.seat, 14], ['go', g.seat, g.z], ...sit] : sit, wait: 0 } };
    state.actors.push(a);
    sc.asset = a.id;
    s = a;
  }
  if (sc.phase === 'meet') {
    const w = !sc.teamLost && sc.crew.map(c => actorOf(state, c.id)).find(a => a && seesActor(state, a, me));
    if (w) {
      sc.burned = true;
      // Do we notice them at it? Our Awareness against their Deception, if they're in our view.
      if (!sc.sawWatching && inView(state, w.id) && !sc.triedSaw?.[w.id]) {
        (sc.triedSaw ??= {})[w.id] = true;
        const r = opposed(state.rng, { skill: 'awareness', value: skill(state.people[state.player], 'awareness'), body: state.people[state.player] }, { skill: 'deception', value: skill(state.people[w.who], 'deception'), body: state.people[w.who] });
        sc.rolls++;
        if (r.ok) sc.sawWatching = describe(state.people[w.who].look, state.people[w.who].sex);
      }
    }
    if (me.busy?.what !== 'meet') return end(state, bus, 'missed', 'You got up and walked away. SOLOVEY waits a minute, folds his paper and goes home wondering.');
    if (now - sc.meetMs >= MEET_S * 1000) {
      sc.met = true;
      const saw = sc.sawWatching;                                 // (a watcher we noticed, watching us at it)
      const text = saw ? `Twenty seconds about the weather, and a folded newspaper changes hands. Across the path ${saw} is looking at nothing in particular, for too long. You hope you're wrong.`
        : 'Twenty seconds about the weather, and a folded newspaper changes hands. You saw nobody watching. SOLOVEY goes home lighter.';
      // (lost by someone they'd already caught at it twice: they don't just shrug. A description out, a car
      // round the parks and the boulevards, the static posts told: NET_CHANCE that someone sees the bench anyway)
      const evasive = sc.flags.reduce((n, f) => n + (f.kind === 'ran' || f.kind === 'assaulted' ? 2 : 1), 0);   // (running from them, or a blow: the loudest, counted twice)
      if (!sc.burned && sc.teamLost && sc.team !== 'none' && evasive >= NET_FLAGS && chance(stream('net', state.map.seed, sc.flags.length), NET_CHANCE)) { sc.burned = true; sc.net = true; }
      if (sc.burned) addHeat(state, 10);
      return end(state, bus, sc.burned ? 'burned' : 'clean', text);
    }
    return;
  }
  if (now > g.to + 20000) {
    end(state, bus, 'missed', 'The time came and went, and you never sat down with him. SOLOVEY waited his eight minutes, and went home wondering.');
  }
}

/**
 * The brush pass, the design's test 5 ("two seconds on the platform"; numbers my calls): being tailed's
 * evening (the team or none, what they write down, the epilogue), but SOLOVEY doesn't sit. At the
 * minute he comes along the park's path from the east, a folded newspaper under his arm, and walks on.
 * You're on the path, walking his way; at arm's length (PASS_M), T: the paper changes hands, neither of
 * you breaking step. Any of them who can see it within PASS_SEEN_M rolls his Tracking (watching hands
 * is their trade; a covert team's eye +5) against your Deception (both walking −1, people round you,
 * the dark, a way off (−2 past 12 m, −4 past 25): harder for him; stopped to do it, +3): seen, burned. Past the place with the paper still under his arm: missed. Call it off as ever.
 */
export const brushTest = {
  ...sdr,
  name: '5a. A brush pass',
  about: 'A second on a park path: a newspaper from his arm to your hand, neither of you stopping. Find out first whether the FSB is behind you.',
  brief(state) {
    const sc = state.scenario, g = sc.meet;
    return subAll(state, {
      title: 'A BRUSH PASS: SOLOVEY',
      body: [
        `SOLOVEY has something for us that won't wait for a bench. At ${clockText(g.from)} he'll come along the path through ${g.place}, ${rowsText(g.row)}, from the east, a newspaper folded under his arm. He won't stop, and nor should you.`,
        'Be on the path, walking his way. As you pass, at arm\'s length, take the paper. A second, and you\'re both walking on.',
        'The FSB may be on you, as on any evening: nobody, an overt pair, a covert team. Check your back on the way. If they\'re on you, don\'t go near him: a pass they see ends him.',
      ],
      footer: `Station Moscow · Thursday 5 November 2026 · ${clockText(sc.began)}`,
      keys: [['watch', 'tapped: glance back; held: stop and look'], ['instinct', 'does what your instinct offers (a window, cross, the pass, call it off)'], ['slow', 'held: stroll'], ['log', 'the log']],
    });
  },
  setup(state, opts) {
    sdr.setup(state, opts);
    Object.assign(state.scenario, { kind: 'brush', brush: true, seats: [] });   // (no bench kept: he walks)
  },
  result(state, o) {
    const sc = state.scenario, r = sdr.result(state, o);
    return { ...r, title: sc.campaign ? r.title : brushTest.name.toUpperCase(), stamp: sc.outcome === 'clean' || sc.outcome === 'burned' ? 'PASSED' : r.stamp,
      lead: sc.met ? `${clockText(sc.ended)}: a newspaper from SOLOVEY's arm to your hand. Inside, next month's procurement schedule for the Western Military District.` : null };
  },
};

// ---------- the dead drop (the design's test 5's other half: dropTest, below) ----------

export const DROP_S = 6, MARK_S = 2;
export const DROP_SEEN_M = 35;
export const DROP_REACH_M = 1.8;
export const DROP_LATE_MIN = 10;                                    // (after the meeting's window: the time the drop's good till)
export const MARK_M = [25, 90];                                     // (the post: this far from the bench)

/** T at the site (load) or the lamppost (mark): stooped, or at the post, a few seconds. */
function dropAct(state, bus, me, what) {
  const sc = state.scenario, d = sc.drop, at = what === 'load' ? d.site : d.mark;
  if (Math.hypot(me.x - at.x, me.z - at.z) > DROP_REACH_M) return;
  me.busy = { what, wait: 0, since: state.time.ms, steps: what === 'load'
    ? [['go', at.x, at.z + 0.34], ['go', at.x, at.z], ['wait', DROP_S * TPS, 'down', 'sit']]          // (the bench's end, a shoelace: the tin behind its leg)
    : [['go', at.x, at.z], ['wait', MARK_S * TPS, at.face, 'idle']] };
  d.doing = { what, since: state.time.ms, seen: {} };
  say(state, bus, { kind: 'instinct', text: what === 'load' ? 'On the end of the bench, a shoelace to retie, and the tin goes in behind its leg.' : 'A stub of chalk from your pocket, a short line on the post at waist height, and on.' });
}

/** Done: each of them who saw any of it rolls once, from as close as they came (a load seen, burned; the chalk, written down). */
function dropSeen(state, bus, me, doing) {
  const sc = state.scenario, now = state.time.ms;
  for (const [who, e] of Object.entries(doing.seen)) {
    sc.rolls++;
    const crowd = state.actors.filter(o => o !== me && !o.hidden && Math.hypot(o.x - me.x, o.z - me.z) < 4).length;
    const r = opposed(state.rng, { skill: 'tracking', value: skill(state.people[who], 'tracking'), body: state.people[who],
      mods: [e.role === 'eye' && sc.team === 'covert' && { why: 'the eye, watching for exactly this', v: 5 }, doing.what === 'load' && e.s >= DROP_S - 1 && { why: 'all of it, at a bench', v: 2 },
        crowd && { why: 'people round you', v: -Math.min(3, crowd) }, lightBand(lightHere(state, me.x, me.z)) === 'dark' && { why: 'the dark', v: -3 },
        e.m > 25 ? { why: 'far off', v: -3 } : e.m > 12 ? { why: 'a way off', v: -1 } : null].filter(Boolean) },
    { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] });
    const them = cap(describe(state.people[who].look, state.people[who].sex));
    if (!r.ok) say(state, bus, { kind: 'roll', roll: r, hidden: true, text: doing.what === 'load' ? `${them} saw someone retie a shoe on a bench, and looked away.` : `${them} saw someone lean on a lamppost.` });   // (his roll first: ok, he won)
    else if (doing.what === 'load') { sc.burned = true; say(state, bus, { kind: 'roll', roll: r, hidden: true, text: `${them} saw your hand go behind the bench's leg, and noted the place.` }); }
    else { if (sc.flags.filter(f => f.kind === 'marked').length < FLAGS_MAX) sc.flags.push({ kind: 'marked', ms: now, who }); say(state, bus, { kind: 'roll', roll: r, hidden: true, text: `${them} saw the chalk go on the post.` }); }
  }
}

/** Each second of the drop: loading or marking, watched or not; done when the time's done; missed when it's long gone. */
function dropMeeting(state, bus, me) {
  const sc = state.scenario, d = sc.drop, g = sc.meet, now = state.time.ms;
  if (d.doing) {
    const doing = d.doing, held = me.busy?.what === doing.what;
    // (whoever of them sees you at it, any second of it: how close they came, and for how long)
    if (held && state.tick % TPS === 0) for (const c of sc.teamLost ? [] : sc.crew) {
      const w = actorOf(state, c.id);
      if (!w || Math.hypot(w.x - me.x, w.z - me.z) > DROP_SEEN_M || !seesActor(state, w, me)) continue;
      const e = (doing.seen[c.who] ??= { s: 0, m: Infinity, role: c.role });
      e.s++; e.m = Math.min(e.m, Math.hypot(w.x - me.x, w.z - me.z));
    }
    if (!held) {
      const done = now - doing.since >= ((doing.what === 'load' ? DROP_S : MARK_S) * 1000) - 120;
      d.doing = null;
      if (done) dropSeen(state, bus, me, doing);
      if (!done) say(state, bus, { kind: 'instinct', text: doing.what === 'load' ? 'You stood up too soon: the tin\'s still in your pocket.' : 'No mark: you moved on before it was made.' });
      else if (doing.what === 'load') { d.loaded = true; say(state, bus, { kind: 'note', text: 'Loaded. Now the signal, or he\'ll never know.' }); }
      else {
        d.marked = true; sc.met = true;
        if (sc.burned) addHeat(state, 10);
        return end(state, bus, sc.burned ? 'burned' : 'clean', sc.burned ? 'The tin behind the bench, the chalk on the post. Tomorrow SOLOVEY will stoop by the bench for his shoelace, and someone will be watching him do it.' : 'The tin behind the bench, the chalk on the post. Tomorrow SOLOVEY will pass, see the mark, and stoop for his shoelace. You saw nobody watching.');
      }
    }
  }
  if (!sc.outcome && now > d.by) end(state, bus, 'missed', d.loaded ? 'The tin\'s behind the bench, but there\'s no mark on the post: SOLOVEY walks past both, and never knows.' : 'The evening goes, and the tin\'s still in your pocket.');
}

/**
 * The dead drop, test 5's other half (numbers my calls): being tailed's evening, but nobody to meet. A
 * tin for SOLOVEY goes behind a bench's leg in the park, and a chalk mark on a lamppost a way along the
 * path tells him it's there (he'll walk past it tomorrow). At the bench, T: DROP_S on its end retying a
 * shoelace; then at the post, T: MARK_S with the chalk. Any of them who saw any second of it, within
 * DROP_SEEN_M, rolls his Tracking against your Deception once it's done, from as close as he came (the
 * covert eye +5; all of a load +2; people round you, the dark −3, a way off −1 past 12 m, −3 past 25):
 * the drop seen is burned (SOLOVEY taken when he empties it); the chalk seen is a thing written down. Loaded and marked by DROP_LATE_MIN after the
 * meeting's window, or it's missed. Stand up too soon, or walk off the post, and it isn't done.
 */
export const dropTest = {
  ...sdr,
  name: '5b. A dead drop',
  about: 'A tin behind a bench\'s leg, a chalk mark on a lamppost to say it\'s there. Nobody to meet; just nobody watching.',
  brief(state) {
    const sc = state.scenario, g = sc.meet;
    return subAll(state, {
      title: 'A DEAD DROP FOR SOLOVEY',
      body: [
        `SOLOVEY's money and his next instructions are in a tin in your pocket. It goes behind the leg of a bench in ${g.place}, ${rowsText(g.row)}, by ${clockText(sc.drop.by)}. Then a chalk mark on a lamppost along the path, so that tomorrow, walking past, he knows to look.`,
        'Six seconds on the end of the bench, a shoelace; two at the post. Nobody to meet, nobody to wait for: the risk is only who sees you stoop.',
        'The FSB may be on you, as on any evening. Check your back on the way. A drop they see is a trap they sit on, and he walks into it. If they\'re on you, call it off.',
      ],
      footer: `Station Moscow · Thursday 5 November 2026 · ${clockText(sc.began)}`,
      keys: [['watch', 'tapped: glance back; held: stop and look'], ['instinct', 'does what your instinct offers (a window, cross, load the drop, the chalk, call it off)'], ['slow', 'held: stroll'], ['log', 'the log']],
    });
  },
  setup(state, opts) {
    sdr.setup(state, opts);
    const sc = state.scenario, g = sc.meet, seed = townOf(state.map), r = stream('drop', state.map.seed);
    // (the post: a lamp on the bench's street, MARK_M along, stood at on the side its light falls)
    const posts = [];
    for (let i = g.i - 3; i <= g.i + 3; i++) {
      if (i < 0) continue;
      const S = section(seed, i, g.row);
      for (const p of S.props) if (p.kind === 'lamp' && Math.abs(p.x - g.seat) >= MARK_M[0] && Math.abs(p.x - g.seat) <= MARK_M[1]) {
        const l = S.lamps.find(l => l.x === p.x && Math.abs(l.z - p.z) < 0.8), side = Math.sign((l?.z ?? p.z + 1) - p.z) || 1;   // (its own light: two posts can share an x across the road)
        posts.push({ row: g.row, x: p.x, z: p.z + side * 0.55, face: side > 0 ? 'up' : 'down' });
      }
    }
    const along = posts.filter(p => Math.abs(p.z - g.z) < 4);            // (along the path, as the brief says, where there are)
    const mark = pick(r, along.length ? along : posts) ?? { row: g.row, x: g.seat + 40, z: laneMid('path'), face: 'up' };
    Object.assign(sc, { kind: 'drop', seats: [], drop: { site: { row: g.row, x: g.seat, z: g.z }, mark, by: g.to + DROP_LATE_MIN * 60000, loaded: false, marked: false, doing: null } });
  },
  result(state, o) {
    const sc = state.scenario, r = sdr.result(state, o);
    return { ...r, title: sc.campaign ? r.title : dropTest.name.toUpperCase(), stamp: sc.outcome === 'clean' || sc.outcome === 'burned' ? 'LOADED' : r.stamp,
      lead: sc.met ? `${clockText(sc.ended)}: the tin behind the bench, the chalk on the post. Tomorrow SOLOVEY collects his money and his instructions.` : null };
  },
};

// ---------- the brush pass (the design's test 5: brushTest, below) ----------

export const PASS_M = 1.5;                                          // (arm's length, passing)
export const PASS_SEEN_M = 35;
const PATH_Z = () => laneMid('path');

/** He comes along the path from the east at the minute, the paper under his arm, and walks on. */
function brushMeeting(state, bus, me) {
  const sc = state.scenario, g = sc.meet, now = state.time.ms, here = state.map.row === g.row;
  let s = actorOf(state, sc.asset);
  if (here && !s && !sc.met && now >= g.from - 40000 && now < g.to) {
    const a = { id: `a${state.nextActor++}`, who: 'solovey', seed: null, x: g.seat + 48, z: PATH_Z(), vx: 0, vz: 0, face: 'left', head: Math.PI, gait: 'walk', stride: 0, stuck: 0,
      ai: { kind: 'subject', speed: 1.15, steps: [['go', g.seat - 90, PATH_Z()], ['gone']], wait: 0 } };
    state.actors.push(a);
    sc.asset = a.id;
    s = a;
  }
  if (sc.met) return;
  // (he's by: well past the place, no paper's changed hands)
  if (s && s.x < g.seat - 40) return end(state, bus, 'missed', 'SOLOVEY walks on along the path, the paper still under his arm, and out of the park. Whatever was in it goes home with him.');
  if (!s && now > g.to + 20000) end(state, bus, 'missed', 'The minute came and went, and you weren\'t on his path. SOLOVEY walked through the park with his newspaper, and home.');
}

/** T at arm's length, passing: the paper changes hands; whoever of them could see it rolls to have seen it. */
function brushPass(state, bus, me) {
  const sc = state.scenario, s = actorOf(state, sc.asset);
  if (!s || sc.met || Math.hypot(s.x - me.x, s.z - me.z) > PASS_M) return say(state, bus, { kind: 'instinct', text: 'Not yet: arm\'s length, as he passes.' });
  sc.met = true; sc.burned = false;
  const stopped = Math.hypot(me.vx, me.vz) < 0.3, crowd = state.actors.filter(o => o !== me && o !== s && !o.hidden && Math.hypot(o.x - me.x, o.z - me.z) < 4).length;
  const light = lightBand(lightHere(state, me.x, me.z));
  for (const c of sc.teamLost ? [] : sc.crew) {
    const w = actorOf(state, c.id);
    if (!w || Math.hypot(w.x - me.x, w.z - me.z) > PASS_SEEN_M || !seesActor(state, w, me)) continue;
    sc.rolls++;
    // (their trade: watching a man's hands, Tracking; a covert team's eye is on nothing else)
    const r = opposed(state.rng, { skill: 'tracking', value: skill(state.people[w.who], 'tracking'), body: state.people[w.who],
      mods: [c.role === 'eye' && sc.team === 'covert' && { why: 'the eye, watching for exactly this', v: 5 }, stopped && { why: 'you stopped to do it', v: 3 }, !stopped && { why: 'both of you walking on', v: -1 }, crowd && { why: 'people round you', v: -Math.min(3, crowd) },
        light === 'dark' && { why: 'the dark', v: -3 }, (() => { const dw = Math.hypot(w.x - me.x, w.z - me.z); return dw > 25 ? { why: 'far off', v: -4 } : dw > 12 ? { why: 'a way off', v: -2 } : null; })()].filter(Boolean) },
    { skill: 'deception', value: skill(state.people[state.player], 'deception'), body: state.people[state.player] });
    say(state, bus, { kind: 'roll', roll: r, hidden: true, text: !r.ok ? `${cap(describe(state.people[w.who].look, state.people[w.who].sex))} was looking, and saw two people pass.` : `${cap(describe(state.people[w.who].look, state.people[w.who].sex))} saw the paper change hands.` });
    if (r.ok) { sc.burned = true; break; }                          // (his roll first: ok, he won)
  }
  const evasive = sc.flags.reduce((n, f) => n + (f.kind === 'ran' || f.kind === 'assaulted' ? 2 : 1), 0);
  if (!sc.burned && sc.teamLost && sc.team !== 'none' && evasive >= NET_FLAGS && chance(stream('net', state.map.seed, sc.flags.length), NET_CHANCE)) { sc.burned = true; sc.net = true; }
  if (sc.burned) addHeat(state, 10);
  end(state, bus, sc.burned ? 'burned' : 'clean', stopped ? 'You stop, he stops, a newspaper goes from one hand to another. It took a second, and it looked like what it was.'
    : 'Two strangers on a path; a newspaper goes from his arm to your hand without either of you breaking step. A second, and you\'re both walking on.');
}

function sitDown(state, bus, me) {
  const sc = state.scenario, g = sc.meet;
  sc.phase = 'meet'; sc.meetMs = state.time.ms; sc.burned = false;
  me.busy = { what: 'meet', steps: [['go', g.seat2, 13.3], ['go', g.seat2, 12.96], ['wait', 3600 * TPS, 'down', 'sit']], wait: 0, since: state.time.ms };
  speak(state, bus, me.id, 'You sit down at the other end of his bench. "Cold, for November." He agrees it is.', 'You sit down at the other end of his bench. He agrees it is cold.');
}

function callOff(state, bus) {
  const sc = state.scenario, followed = !sc.teamLost && sc.crew.some(c => c.id);
  // (we can't know which it was: the text is the same, the outcome kept for the tests and debug)
  end(state, bus, followed ? 'right' : 'needless', 'You turn for home without going near him, and buy bread on the way, as a diplomat would. Whether anyone followed you to your door, you\'ll never be quite sure. SOLOVEY waits his eight minutes and goes home with the newspaper still under his arm.');
}

function end(state, bus, outcome, text) {
  const sc = state.scenario;
  if (sc.outcome) return;
  sc.outcome = outcome;
  sc.phase = 'done';
  sc.endText = sub(state, text);
  sc.ended = state.time.ms;
  if (sc.flags.length) addHeat(state, FLAG_HEAT * sc.flags.length);
  // What they made of you shows in the weeks after, to whoever can read it (Pathfinding): a car
  // outside the building (DC 13), a face twice on the way to work (DC 18).
  const level = sc.flags.length >= 2 ? 2 : sc.flags.length;
  if (level) {
    const r = check(state.rng, { skill: 'pathfinding', value: skill(state.people[state.player], 'pathfinding'), body: state.people[state.player], dc: level >= 2 ? 13 : 18 });
    sc.signs = { level, read: r.ok };
  }
  bus?.emit('scenario-end', outcome);
}

// ---------- the instinct ----------


/** The way to SOLOVEY from here, in words. */
function wayText(state, me) {
  const g = state.scenario.meet, dr = g.row - state.map.row, dx = Math.round(g.x - me.x);
  const along = Math.abs(dx) < 15 ? 'right here' : `${Math.abs(dx)} m ${dx > 0 ? 'east' : 'west'}`;
  if (!dr) return `${g.place}, ${along}`;
  return `${g.place}: ${rowsText(dr)}, ${along}. ${dr < 0 ? 'Up a lane or an alley' : 'Down a lane south of the boulevard'}.`;
}

function instinct(state, me, still) {
  const sc = state.scenario, now = state.time.ms, g = sc.meet;
  const L = (id, tone, text, act = null) => ({ id, tone, text: Array.isArray(text) ? say1(state, id, text) : text, act });
  const s = actorOf(state, sc.asset);
  const sure = Object.values(sc.faces).some(f => f.sure), familiar = Object.values(sc.faces).filter(f => f.n >= 2 && !f.sure);
  if (sc.phase === 'meet') return L('meet', 'note', ['The weather, the traffic, his wife\'s sister. Twenty seconds. Don\'t look round.', 'Talk about nothing. The paper goes under his arm, then under yours.']);
  // (the dead drop: the site, then the post)
  if (sc.drop) {
    const d = sc.drop, site = d.site, post = d.mark, on = (p) => state.map.row === p.row && Math.hypot(me.x - p.x, me.z - p.z) <= DROP_REACH_M;
    if (d.doing) return L('drop-doing', 'note', d.doing.what === 'load' ? 'Stooped at the bench. Don\'t look round; don\'t hurry.' : 'The chalk, and on.');
    if (!d.loaded && on(site)) return L('load', 'warn', 'The bench\'s leg: the drop. {instinct} load it: six seconds on its end, a shoelace. Nobody watching?', 'load');
    if (d.loaded && on(post)) return L('mark', 'warn', 'The lamppost: the signal. {instinct} a chalk mark, and walk on.', 'mark');
    if (d.loaded) return L('to-post', 'note', `Loaded. The signal: a chalk mark on the lamppost ${post.row === state.map.row ? `${Math.round(Math.abs(post.x - me.x))} m ${post.x > me.x ? 'east' : 'west'}` : rowsText(post.row - state.map.row)}.`);
  }
  // (the brush pass: on his path, coming his way; at arm's length, the pass)
  if (sc.brush && s) {
    const d = Math.hypot(s.x - me.x, s.z - me.z);
    if (d <= PASS_M) return L('pass', 'urgent', 'Now, as he passes: {instinct} the pass. Don\'t stop.', 'pass');
    if (d < 25 && inView(state, s.id)) return { ...L('coming', 'warn', `SOLOVEY, coming along the path, the paper under his arm, ${Math.round(d)} m. Walk to meet him, and pass close.`), at: s.id };
  }
  if (me.gait === 'run') return L('run', 'urgent', ['Don\'t run. If anyone\'s behind you, that goes in the report.', 'Running: the one thing a diplomat buying bread never does.']);
  // At the bench.
  if (s && !sc.brush && Math.hypot(s.x - me.x, s.z - me.z) < 3.2 && me.z > 11) {
    if (sure) return L('bench-sure', 'urgent', 'You\'ve a tail, and you\'re at his bench. Walk past him. {instinct} call it off.', 'abort');
    return L('bench', 'warn', 'There he is: bald, glasses, the paper. If you\'re sure you\'re clean, {instinct} sit down beside him.', 'meet');
  }
  if (sure) return L('sure', 'warn', [`You've a tail. Don't take them to him: {instinct} call it off, or lose them first where they can't see you do it.`, 'They\'re on you. A lane they don\'t see you take, or home. {instinct} call it off.'], 'abort');
  const A = (line) => line;                                       // (what's at hand ends the line: the engine's)
  if (sc.sinceMap && now - sc.sinceMap < 20000) {
    if (still) return L('lane-watch', 'note', ['Good. Watch the mouth of the lane. Whoever comes out after you may be going your way, or may be coming for you: the second kind stops when you do.', 'Watch the lane\'s mouth. People come through lanes all day; the one who comes for you looks for you when they come out.']);
    return A(L('lane-out', 'note', 'Out of the lane. Stop somewhere natural and watch the mouth of it: whoever comes out after you, see what they do when you don\'t move.'));
  }
  // (a face seen before is enough to call it off, if you'd rather be safe: the reviewer found one sighting left you wandering till you'd missed him)
  if (familiar.length && !me.glass) return { ...L('familiar', 'note', `${cap(familiar[0].look)}: seen before. Could be nothing: check again somewhere else, or {instinct} call it off, to be safe.`, 'abort'), at: familiar[0].id };
  if (sc.lead && now - sc.lead.ms < 12000) return A({ at: sc.lead.id, ...L(`lead-${sc.lead.ms}`, 'note', [`Behind you, going your way: ${sc.lead.look}. You'll know that face again.`, `${cap(sc.lead.look)}, a way back, walking your way. Probably nothing. Remember the face.`]) });
  // At a shop window: what it shows, and how to use it.
  if (me.glass && now < g.to) return L(sc.glassS < 7 ? 'glass' : 'glass-stay', 'calm', sc.glassS < 7
    ? ['In the glass, the street behind you, all but the middle of it: that\'s your own back. Who stops when you stop?', 'The glass shows the road behind you. Hold {watch} and slant your eyes along it for the pavement.']
    : ['Long enough at one window and it\'s not the goods you\'re looking at. Walk on when you\'ve seen what you need.', 'Slant your eyes along the glass ({watch} held) for the pavement behind you; straight in, it\'s the road.']);
  const due = sc.drop ? sc.drop.by : g.to;
  if (now < g.from - 30000 && !sc.drop) {
    if (paneNear(state, me)) return L('early', 'calm', 'A shop window: the glass shows who\'s behind you.');
    return L('early', 'calm', `SOLOVEY from ${clockText(g.from)}: ${wayText(state, me)} Time to check your back on the way.`);
  }
  if (now < due) {
    if (state.map.row === g.row && Math.abs(g.x - me.x) < 30) return A(L('near', 'warn', sc.drop ? 'The bench with the drop behind its leg is here. Last chance to check your back before you stoop.' : sc.brush ? `This is his path: he comes along it from the east, the paper under his arm. Be on it, walking his way. Last chance to check your back.` : `He's there, on the bench${s && inView(state, s.id) ? '' : ' somewhere ahead'}. Last chance to check your back before you sit down with him.`));
    return A(L('due', 'warn', sc.drop ? `The drop, behind a bench's leg in ${g.place}, by ${clockText(sc.drop.by)}: ${wayText(state, me)}` : sc.brush ? `SOLOVEY comes along the path at ${clockText(g.from)}: ${wayText(state, me)}` : `SOLOVEY is on his bench until ${clockText(g.to)}: ${wayText(state, me)}`));
  }
  return L('late', 'warn', sc.drop ? 'The drop\'s time is gone.' : 'He\'s leaving. You\'re too late.');
}
