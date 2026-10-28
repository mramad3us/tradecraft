// TRADECRAFT sim: what the player can do on a street with T, whatever the scene. It's the engine's,
// not a scenario's (the user, 2026-10-26: "it's a game engine thing"): affordance() is what's at hand
// (a shop window, a free seat, a zebra), shown at the end of the instinct's line whenever the scene's
// own line offers nothing (and isn't urgent), and T does it (sim/game.js). A scene may still offer a
// cover of its own (a shoelace, a window as he looks), and acts of its own (sit with him, call it off).
// act() does it:
//   - 'window': step to a shop window's glass and look in it (it shows the street behind:
//     sim/perception.js), a reason to stop: at the end of the pane that has the glass run the way
//     you'd watch (opts.toward: −1 west, 1 east; by default back the way you were going). Looking in
//     a window is being stood at its pane with the eyes into it (glassAhead()), however you got
//     there; the eyes can slant along it (E held).
//   - 'bench': sit on a bench on the boulevard's path, until you move;
//   - 'lace': stop to tie a shoelace (not again within LACE_AGAIN_S: twice is a story);
//   - 'cross': over the street at its zebra, or over the boulevard's far road at its own;
//   - 'pickup': something lying within reach (sim/items.js), into the hand, stooping for it;
//   - 'taxi': at the kerb, hail a taxi (sim/taxi.js): where to is the UI's to ask (the bus: 'taxi');
//   - in a shop (sim/shops.js, walked into at its door): 'counter' (what it sells: which is the UI's to
//     ask, the bus: 'shop'), 'table' (a café's ledge in its window: a coffee, or the book on the go), 'basin'
//     (the toilet, bloody), 'backdoor' (out the back, where it has one).
// Each becomes the player's busy plan (sim/game.js busy()), which moving cancels; busy.since is when
// it began (a scenario may care whether that was before or after someone looked).
// Also here, the bits of the street they read: where the crossings and the shop windows are, the
// instinct's offer of what T would do here, and a calm way to pick a line of the instinct's without
// touching the dice.
import { townOf } from './cities/index.js';
import { TICK_MS } from './clock.js';
import { hash } from './rng.js';
import { LANES, Z, SECTION_M } from './map/street.js';
import { sectionOf } from './city.js';
import { sectionAt } from './world.js';
import { say } from './log.js';
import { GLASS_REACH_M, intoGlass } from './perception.js';
import { stopNear, nextBus, linesOf, STOP_Z } from './buses.js';
import { itemNear, pickUp } from './items.js';
import { atKerb, taxiComing, hail } from './taxi.js';
import { stationNear, metroName, destinations as metroWays } from './metro.js';
import { spotIn, ways, doWay } from './shops.js';
import { pay } from './money.js';
import { weaponOf } from './weapons.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// (in a shop: the spot's act, and the instinct's words for it)
const IN_SHOP = { counter: 'counter', sit: 'table', wash: 'basin', back: 'backdoor' };
const SHOP_COVER = { counter: (k) => (k === 'gym' || k === 'club' || k === 'school' ? 'ask at the desk' : 'go to the counter'), sit: () => 'have a coffee at the window', wash: () => 'wash at the basin', back: () => 'slip out the back door' };

export const LACE_AGAIN_S = 40;
const TPS = 1000 / TICK_MS;

export const laneMid = (lane) => (LANES[lane][0] + LANES[lane][1]) / 2;

/** A line from a few, the same for a while (no dice: the instinct mustn't move the game's rolls). */
export const say1 = (state, id, lines) => lines[hash(id, Math.floor(state.time.ms / 12000)) % lines.length];

/** The zebra over the street the actor stands in line with, if any. */
export const crossingAt = (state, a) => sectionAt(state, a.x)?.crossings.find(c => a.x > c.x0 - 0.5 && a.x < c.x1 + 0.5) ?? null;

/** A crossing within m of the actor, by the side of the road they're on: { c, road: 'main' | 'far' }. */
export function crossingNear(state, a, m = 6) {
  const S = sectionAt(state, a.x);
  if (!S) return null;
  const close = (c) => Math.abs((c.x0 + c.x1) / 2 - a.x) < m;
  // (from the street it crosses only: not from up a lane, nor from behind the hedge)
  if (a.z > Z.front - 0.5 && a.z < Z.fence + 0.5) { const c = S.crossings.find(close); return c ? { c, road: 'main' } : null; }
  if (S.band === 'boulevard' && a.z > Z.pathS - 0.5 && a.z < Z.south + 0.5) { const c = S.crossingsS.find(close); return c ? { c, road: 'far' } : null; }
  return null;
}

export const SEAT_Z = 12.96;
/**
 * Whether the seat at x (on the map's row) is taken: someone else sat there, or kept for a scene
 * (state.scenario.seats: [{ row, x }], a meeting's bench, which only the scene's own moves sit on).
 */
export function seatTaken(state, x, who = null, row = state.map.row) {
  if (state.actors.some(o => o !== who && o.gait === 'sit' && (o.row ?? state.map.row) === row && Math.abs(o.x - x) < 0.6 && Math.abs(o.z - SEAT_Z) < 0.6)) return true;
  return !!state.scenario.seats?.some(s => s.row === row && Math.abs(s.x - x) < 0.3);
}

/** The nearest free bench seat within reach of the actor on the path, or null. */
export function benchNear(state, a) {
  if (a.z < 11.8 || a.z > 16) return null;
  const seats = (sectionAt(state, a.x)?.props ?? []).filter(p => p.kind === 'bench').flatMap(p => p.seats).filter(x => !seatTaken(state, x, a));
  const s = seats.map(x => [x, Math.abs(x - a.x)]).sort((p, q) => p[1] - q[1])[0];
  return s && s[1] < 2.6 ? s[0] : null;
}

/**
 * A place to watch the street from, within reach (the user, 2026-10-27: "lateral observation spots";
 * "bus shelters and notice boards"): a kiosk (Moscow's; Cairo's paper stalls): buy a paper and read it
 * there (KIOSK_S); a phone box (London's): a call to nobody, behind glass (PHONE_S); a bus shelter: sat
 * on its bench till the bus comes (sim/buses.js), the street in front of you; a park's notice board:
 * the notices read (NOTICES_S), the path at the corner of your eye. { kind: 'kiosk' | 'phone' |
 * 'shelter' | 'notices', x, z (where you stand or sit), face } or null.
 */
export const KIOSK_S = 25, PHONE_S = 45, NOTICES_S = 30;
export function spotNear(state, a) {
  const S = sectionAt(state, a.x);
  if (!S) return null;
  const k = S.doors.find(d => d.kind === 'kiosk' && Math.hypot(d.x - a.x, d.z - a.z) < 1.6);
  if (k) return { kind: 'kiosk', x: k.x, z: k.z, face: 'up' };
  const st = S.props.find(p => p.kind === 'stall' && (p.look === 'kiosk' || p.look === 'papers') && Math.abs(p.x - a.x) < 1.4 && Math.abs(a.z - (p.z + 0.8)) < 1.2);
  if (st) return { kind: 'kiosk', x: st.x, z: st.z + 0.8, face: 'up' };
  const ph = S.props.find(p => p.kind === 'phonebox' && Math.abs(p.x - a.x) < 1.2 && Math.abs(a.z - (p.z - 0.7)) < 1.2);
  if (ph) return { kind: 'phone', x: ph.x, z: ph.z - 0.7, face: 'down' };
  const sh = stopNear(state, a);
  if (sh) return { kind: 'shelter', x: Math.max(sh.x - 0.9, Math.min(sh.x + 0.9, a.x)), z: STOP_Z, face: 'down', stop: sh };
  const nb = S.props.find(p => p.kind === 'notices' && Math.abs(p.x - a.x) < 1.2 && Math.abs(a.z - (p.z + 0.6)) < 1.0);
  if (nb) return { kind: 'notices', x: nb.x, z: nb.z + 0.6, face: 'up' };
  return null;
}

/** The pane of a shop window within m along the shops' pavement from the actor ({ x0, x1, z }), or null. */
export function paneNear(state, a, m = 1.5) {
  if (a.z < Z.front || a.z > LANES.far[1] + 0.4) return null;
  return sectionAt(state, a.x)?.doors.find(d => d.pane && a.x > d.pane.x0 - m && a.x < d.pane.x1 + m)?.pane ?? null;
}

/** The pane in front of (x, z) on a row (the map's, unless said), close enough to look in (GLASS_REACH_M), or null. */
export function paneAt(state, x, z, row = state.map.row) {
  if (z <= Z.front || z - Z.front > GLASS_REACH_M) return null;
  return sectionOf(townOf(state.map), row, Math.floor(x / SECTION_M)).doors.find(d => d.pane && x > d.pane.x0 - 0.3 && x < d.pane.x1 + 0.3)?.pane ?? null;
}

/** The pane the actor is looking into, stood at it with the eyes into it, or null. */
export const glassAhead = (state, a) => (intoGlass(a.head ?? 0) ? paneAt(state, a.x, a.z) : null);

/** What gives the actor a reason to stop here: 'window' (a shop's glass at hand), 'bench' (a seat), 'lace', or null. */
export function coverHere(state, a) {
  if (!sectionAt(state, a.x)) return null;
  if (!a.glass && paneNear(state, a)) return 'window';
  if (benchNear(state, a) !== null) return 'bench';
  return state.time.ms - (state.scenario.laceMs ?? -1e12) > LACE_AGAIN_S * 1000 ? 'lace' : null;
}

const COVER = { window: 'look in the window', bench: 'sit on the bench', lace: 'tie a shoelace', cross: 'cross', taxi: 'hail a taxi', kiosk: 'buy a paper at the kiosk', phone: 'make a call from the phone box', shelter: 'wait for a bus', notices: 'read the notices' };

/** What's at hand for T, the engine's: a shop window, a free seat, a zebra ({ act, text }), or null. */
export function affordance(state, me) {
  if (!me || me.ai || me.busy || me.inside || me.glass || me.gait === 'sit') return null;
  const it = itemNear(state, me);
  if (it) return { act: 'pickup', text: ` {instinct} pick up ${weaponOf(it.kind)?.name ?? 'it'}.` };
  if (state.map.kind !== 'street' || !sectionAt(state, me.x)) return null;
  // (at the kerb: the zebra if it's there, else a taxi; the window behind you is for the pavement)
  const kerb = atKerb(state, me), cross = crossingNear(state, me, 4);
  // (in a shop: its counter, its window ledge, its basin, its back door; sim/shops.js)
  if (me.within) {
    const sp = spotIn(state, me), w = sp && ways(state, sp.door, sp.kind);
    return w?.length ? { act: IN_SHOP[sp.kind], text: ` {instinct} ${SHOP_COVER[sp.kind](sp.door.shop)}.` } : null;
  }
  const station = !kerb && stationNear(state, me);                  // (at a station's door: down; sim/metro.js)
  const spot = !station && spotNear(state, me);                      // (a kiosk, a phone box: somewhere to watch from)
  if (station) return { act: 'metro', text: ` {instinct} down into the ${metroName(state) === 'Underground' ? 'Underground' : 'metro'}.` };
  const act = kerb && cross ? 'cross' : spot ? spot.kind : kerb && taxiComing(state, me) ? 'taxi' : paneNear(state, me) ? 'window' : benchNear(state, me) !== null ? 'bench' : cross ? 'cross' : null;
  return act && { act, text: ` {instinct} ${COVER[act]}.` };
}
/** What T would do here, for the end of an instinct's line: { act, text } (only: the covers allowed). */
export function offer(state, me, only = null) {
  const c = coverHere(state, me), ok = c && (!only || only.includes(c));
  return { act: ok ? c : null, text: ok ? ` {instinct} ${COVER[c]}.` : '' };
}

/** Do it: the player's busy plan for act. */
export function act(state, bus, me, what, opts = {}) {
  act1(state, bus, me, what, opts);
  if (me.busy) me.busy.since = state.time.ms;
}

function act1(state, bus, me, what, { toward = Math.cos(me.head ?? 0) >= 0 ? -1 : 1, scenario = null } = {}) {
  if (what === 'taxi') { if (atKerb(state, me)) hail(state, bus, me); return; }   // (an arm up: it stops, and asks where: sim/game.js)
  if (Object.values(IN_SHOP).includes(what)) {                     // (in a shop: one thing to do, done; more, the UI asks which)
    const sp = spotIn(state, me), w = sp && IN_SHOP[sp.kind] === what ? ways(state, sp.door, sp.kind) : [];
    if (w.length === 1) doWay(state, bus, me, w[0].id, scenario);
    else if (w.length) bus?.emit('shop', { shop: sp.door.shop, ways: w });
    return;
  }
  if (what === 'metro') { const d = stationNear(state, me); if (d) bus?.emit('metro', { name: metroName(state), list: metroWays(state, d) }); return; }   // (where to: sim/metro.js)
  if (what === 'pickup') {
    const it = itemNear(state, me), p = state.people[me.who];
    if (!it || !p) return;
    const off = pickUp(state, p, me, it), w = weaponOf(it.kind);
    me.busy = { what: 'pickup', steps: [['wait', Math.round(600 / TICK_MS), me.face, 'crouch']], wait: 0 };   // (stooped for it, 0.6 s)
    say(state, bus, { kind: 'note', text: `You pick up ${w.name}.${off ? ` ${cap(weaponOf(off.kind).name)} goes down where you stood: nowhere to put it.` : ''}` });
    return;
  }
  if (what === 'kiosk' || what === 'phone') {
    const sp = spotNear(state, me);
    if (!sp || sp.kind !== what) return;
    const paid = what === 'kiosk' && pay(state, null, 1, 'a paper');
    // (stood at it, the business of it, the street over the top of the paper, or through the glass)
    me.busy = { what, steps: [['go', sp.x, sp.z], ['wait', (what === 'kiosk' ? KIOSK_S : PHONE_S) * TPS, sp.face, 'idle']], wait: 0, since: state.time.ms };
    say(state, bus, { kind: 'instinct', text: what === 'kiosk' ? (paid ? 'A paper from the kiosk, and the front page read standing, the street over the top of it.' : 'You read the headlines off the kiosk\'s rack, the street over the top of them.') : 'Into the phone box, a call to nobody, the receiver to your ear: the glass shows the street all round.' });
    return;
  }
  if (what === 'shelter') {
    const sp = spotNear(state, me);
    if (!sp || sp.kind !== what) return;
    // (sat on its bench, facing the road, till the bus: sim/buses.js waitTick(); up and off, and you've stopped waiting)
    const due = nextBus(state, sp.stop), st = sp.stop, h = st.w / 2;
    // (from the pavement behind it, round its nearer end and in at the open front: its back's in the way)
    const ex = st.x + (me.x >= st.x ? 1 : -1) * (h + 0.45), round = me.z < -1.1 ? [['go', ex, Math.min(me.z, -1.7)], ['go', ex, -0.56], ['go', sp.x, -0.56]] : [];
    me.busy = { what, steps: [...round, ['go', sp.x, sp.z], ['wait', 12 * 3600 * TPS, 'down', 'sit']], wait: 0, since: state.time.ms, stop: st, due };
    const m = Math.max(1, Math.round((due.at - state.time.ms) / 60000));
    const ls = linesOf(st), board = ls.length > 1 ? `the ${ls.slice(0, -1).join(', the ')} and the ${ls[ls.length - 1]}` : `the ${ls[0] ?? 'bus'}`;
    say(state, bus, { kind: 'instinct', text: `You sit in the shelter. ${board.charAt(0).toUpperCase() + board.slice(1)} stop here, says the board; the next, the ${due.line}, in ${m === 1 ? 'a minute' : `${m} minutes`} or so. The street goes by in front of you.` });
    return;
  }
  if (what === 'notices') {
    const sp = spotNear(state, me);
    if (!sp || sp.kind !== what) return;
    me.busy = { what, steps: [['go', sp.x, sp.z], ['wait', NOTICES_S * TPS, 'up', 'idle']], wait: 0, since: state.time.ms };
    say(state, bus, { kind: 'instinct', text: say1(state, 'notices', ['A lost cat, a choir, a flat to let, a concert last month: you read them all, slowly, the path at the corner of your eye.', 'The notices: lessons, a dog found, the council\'s plans for the pond. You read them, and the path behind you in the edge of your sight.']) });
    return;
  }
  if (what === 'window') {
    const pane = paneNear(state, me);
    if (!pane) return;
    const wx = toward < 0 ? pane.x1 - 0.4 : pane.x0 + 0.4;          // (at the glass, and stood there after: moving takes you off)
    me.busy = { what: 'window', steps: [['go', wx, pane.z + 0.65], ['wait', 1, 'up', 'idle']], wait: 0 };
    say(state, bus, { kind: 'instinct', text: 'You find something in a shop window worth a look. In the glass, the street behind you.' });
  } else if (what === 'bench') {
    const sx = benchNear(state, me);
    if (sx === null) return;
    me.busy = { what: 'bench', steps: [['go', sx, 13.3], ['go', sx, SEAT_Z], ['wait', 3600 * TPS, 'down', 'sit']], wait: 0 };
    say(state, bus, { kind: 'instinct', text: 'You sit, as people do on a boulevard. Moving gets you up.' });
  } else if (what === 'lace') {
    state.scenario.laceMs = state.time.ms;
    me.busy = { what: 'lace', steps: [['wait', 3 * TPS, me.face, 'crouch']], wait: 0 };
    say(state, bus, { kind: 'instinct', text: 'You stop to tie a shoelace that didn\'t need it.' });
  } else if (what === 'cross') {
    const near = crossingNear(state, me, 7);
    if (!near) return;
    const { c, road } = near, cx = Math.max(c.x0 + 0.5, Math.min(c.x1 - 0.5, me.x));
    if (road === 'main') {
      const far = me.z < Z.kerbN;
      me.busy = { what: 'cross', steps: [['go', cx, far ? -1.0 : 7.5], ['go', cx, far ? laneMid('near') : laneMid('far')]], wait: 0 };
    } else {
      const north = me.z < Z.roadN;
      me.busy = { what: 'cross', steps: [['go', cx, north ? Z.fenceS - 0.6 : Z.roadS + 0.6], ['go', cx, north ? laneMid('south') : laneMid('path')]], wait: 0 };
    }
  }
}
