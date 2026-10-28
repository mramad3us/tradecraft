// TRADECRAFT sim: the campaign's hub (sim/campaign.js): between assignments, the posting's city from your
// own door, the campaign's clock, your character as the campaign has them (wounds, blood and all).
// Walk where you like; the instinct says what's next ("SKVORETS at 19:31: leave by 18:50"); Tab opens
// the desk (src/ui/ui.js openDesk()), whose choices come back as actions:
//   - 'desk:work': the embassy until 18:00, a working day (cover standing up);
//   - 'desk:sleep': home, and sleep till 7:00;
//   - 'desk:low': lie low for a day (heat down);
//   - 'desk:travel:<place>': to the flat, the embassy, a safe house: the metro or a taxi (sim/campaign.js
//     trip(): the minutes it takes), and the place's street, from its door;
//   - 'desk:go:<id>': an assignment: wait (the clock skipped) until its start if it's later today, and
//     go: the game tells the bus ('assignment'), and the UI launches it (src/main.js) with the
//     campaign's context (sim/campaign.js context()).
// Every skip of the clock is the engine's (sim/game.js skip(): what bleeds bleeds, what heals heals),
// and the calendar's consequences are the campaign's (pass(): days worked or missed, pay, the week's
// review), told as papers on the bus ('papers').
import { TICK_MS, DAY, HOUR, MIN, calendar, clockText } from '../clock.js';
import { heatKey } from '../heat.js';
import { say } from '../log.js';
import { Z, streetName } from '../map/street.js';
import { townOf, cityById } from '../cities/index.js';
import { skip, newMap } from '../game.js';
import { eat } from '../needs.js';
import { agenda, pass, work, rest, lieLow, heatWord, places, trip, fatigue, KINDS, WORK } from '../campaign.js';
import { signOf } from '../places.js';
import { reading, bookOf, readAnHour } from '../training.js';
import { planOf } from '../map/interior.js';
import { spotNear, spotOf, exitHere, walkTo, SPOT_REACH_M } from '../interiors/use.js';
import { hash } from '../rng.js';
import { headOf } from '../perception.js';
import { rowsText } from './sdr.js';

const TPS = 1000 / TICK_MS;

export const campaignHub = {
  name: 'Campaign',
  about: 'A Handler at a US embassy, for as long as it lasts: a network to run, a man to watch, the heat to keep down.',
  campaign: true,

  setup(state) {
    const c = state.campaign, p = c.posting;
    state.time.ms = c.now ?? p.startMs;
    state.legend = { id: 'embassy', name: p.job, cover: 'official', floor: 20 };
    state.country = p.country;
    state.heat[heatKey('embassy', p.country)] = p.heat;
    state.people.me = structuredClone(c.character);
    state.player = 'me';
    const row = c.where?.row ?? p.home.row, flat = !c.where || c.where.inside === 'home';
    // (day one, and whenever the last of the day left you there: the flat; else wherever the last
    // assignment left you, on its street)
    state.map = flat ? homeMap(c) : { kind: 'street', seed: p.mapSeed, row, i0: null, i1: null, crowd: 1, city: p.city };
    const bed = flat && planOf(state.map).spots.find(s => s.kind === 'sleep');
    const x = c.where?.x ?? (flat ? bed.x : p.home.x ?? 12), z = c.where?.z ?? (flat ? bed.z : -2.6);
    state.actors.push({ id: 'a0', who: 'me', seed: null, row, x, z, vx: 0, vz: 0, face: flat ? 'left' : 'down', head: flat ? Math.PI : Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: null });
    state.scenario = { kind: 'campaign', prompt: null, outcome: null, began: state.time.ms };
    const street = streetName(townOf({ seed: p.mapSeed, city: p.city }), row);
    say(state, null, { kind: 'note', text: c.where ? `${clockText(state.time.ms)}, ${flat ? 'the flat' : street}.` : `${state.people.me.name}, ${p.job}. Day one of the posting: ${clockText(state.time.ms)}, the flat the embassy rents you on ${street}. Boxes not yet unpacked. Tab: the desk.` });
  },

  act(state, bus, action) {
    const c = state.campaign;
    if (action === 'instinct') return use(state, bus, state.scenario.prompt?.act);
    if (!String(action).startsWith('desk:')) return;
    const [, what, id] = action.split(':'), now = state.time.ms;
    const until = (to, text) => {                                  // (the clock skipped to `to`, the calendar's consequences told)
      if (to <= now) return;
      if (text) say(state, bus, { kind: 'note', text });
      skip(state, bus, to - now);
      const papers = pass(c, now, state.time.ms);
      if (papers.length) bus?.emit('papers', papers);
      if (c.over && !state.scenario.outcome) { Object.assign(state.scenario, { outcome: c.over.why, ended: state.time.ms }); bus?.emit('scenario-end', c.over.why); }
    };
    if (what === 'work') {
      const to = work(c, now);
      if (to === now) return say(state, bus, { kind: 'instinct', text: 'Not a working day, or it\'s over: nobody at the embassy wants you now.' });
      until(to, 'The metro to the embassy, the guard\'s nod, the day\'s cables.');
      eat(state.people.me, state.time.ms - 4 * HOUR, 5);             // (lunch in the canteen: sim/needs.js)
      if (!state.scenario.outcome) goTo(state, bus, c.posting.embassy, `Six o'clock, and out of the embassy onto ${streetName(townOf({ seed: c.posting.mapSeed, city: c.posting.city }), c.posting.embassy.row)}.`);
    } else if (what === 'sleep') {                                  // (a night's sleep, and breakfast: sim/needs.js; you wake in the flat)
      until(rest(c, now), state.map.place === 'home' ? 'To bed.' : 'Home, and to bed.'); eat(state.people.me, state.time.ms, 60);
      if (state.map.place !== 'home' && !state.scenario.outcome) enterHome(state, bus, 'sleep');
    }
    else if (what === 'low') { const safe = c.posting.safehouses.some(h => h.row === state.map.row); until(lieLow(c, now, safe), safe ? 'A day in the safe house: the curtains drawn, the kettle, nobody.' : 'A day of being nobody.'); eat(state.people.me, state.time.ms, 40); }
    else if (what === 'rest' && state.map.place === 'home') {      // (the bed, by day: a nap, or lying down a while: sim/needs.js, campaign.js fatigue())
      const p = state.people.me;
      if (id === 'nap') { until(now + NAP_MIN * MIN, 'An hour on top of the covers, shoes off. You wake thick-headed, and better for it.'); c.awake = Math.min(state.time.ms, (c.awake ?? now) + NAP_EASES_H * HOUR); }
      else { until(now + REST_MIN * MIN, 'Half an hour on the bed with the ceiling for company. Your breathing slows.'); eat(p, p.needs?.ate ?? state.time.ms, REST_CALM); }
    }
    else if (what === 'travel') {
      const to = places(c).find(pl => pl.id === id);
      if (!to) return;
      const { ms, how } = trip(state.map.row ?? 0, to.row);
      until(now + ms, `To ${to.label}: ${how}.`);
      goTo(state, bus, to);
    }
    else if (what === 'go') {
      const a = c.assignments.find(x => x.id === id && x.status === 'open');
      if (!a) return;
      if (now < a.start) {
        if (Math.floor(a.start / DAY) !== Math.floor(now / DAY)) return say(state, bus, { kind: 'instinct', text: 'That\'s another day. Sleep on it.' });
        until(a.start, `You kill the time till ${clockText(a.start)}, and go.`);
      }
      if (state.scenario.outcome || state.people.me.dead) return;
      c.character = structuredClone(state.people.me);
      c.posting.heat = state.heat[heatKey('embassy', c.posting.country)] ?? c.posting.heat;
      bus?.emit('assignment', a.id);
    }
  },

  tick(state, bus) {
    if (state.tick % TPS !== 0) return;
    const c = state.campaign, now = state.time.ms;
    if (c.over && !state.scenario.outcome) { Object.assign(state.scenario, { outcome: c.over.why, ended: now }); bus?.emit('scenario-end', c.over.why); return; }   // (the goal met in the last assignment: the posting's paper)
    c.now = now;
    c.posting.heat = state.heat[heatKey('embassy', c.posting.country)] ?? c.posting.heat;
    const tired = fatigue(c, now);                                  // (up too long: every skill pays: sim/skills.js strain)
    if (tired.v) state.people.me.strain = tired.v; else delete state.people.me.strain;
    // (in the flat: out by its front door, down the stairs, onto the street at your door)
    const me = state.actors.find(a => a.who === state.player);
    if (state.map.place === 'home' && me && !me.busy && exitHere(state, me)) return leaveHome(state, bus);
    // (a spot walked to: what you went there for)
    if (state.scenario.using && me && !me.busy) { const u = state.scenario.using; state.scenario.using = null; if (spotNear(state, me)?.kind === u.spot) use(state, bus, u.act, true); }
    // (a call: the telephone rings in the flat, when it's due and you're there)
    const call = (c.calls ?? []).find(k => !k.done && now >= k.at);
    if (call && state.map.place === 'home' && !call.rang) { call.rang = now; say(state, bus, { kind: 'note', text: 'The telephone rings.' }); }
    // (let ring, it stops: Hale, most likely; his number's on the pad by it, and he'll be glad to hear from you)
    if (call?.rang && now - call.rang > RING_S * 1000) { call.done = now; call.missed = true; say(state, bus, { kind: 'note', text: 'The telephone stops. Hale, most likely: his number\'s on the pad by it.' }); }
    state.scenario.prompt = instinct(state, c, now);
  },

  /** At the window, your feet are the window's: nothing but T takes you from it. */
  holds(state) { return !!state.scenario.window; },

  /** In the flat, the whole of it is taken in: no fog (src/render/view.js). */
  aware(state) { return state.map.kind === 'interior'; },

  /** A taxi (sim/taxi.js) to the posting's places. */
  destinations(state) { return places(state.campaign).map(pl => ({ id: pl.id, label: pl.label, row: pl.row, x: pl.x ?? 12 })); },

  /** The posting's places on this street, named over their doors (sim/places.js). */
  signs(state) { return state.map.kind !== 'street' ? [] : places(state.campaign).filter(pl => pl.row === state.map.row && pl.x !== undefined).map(pl => ({ x: pl.x, z: pl.z ?? Z.front, label: signOf(pl), kind: pl.id === 'embassy' || pl.id === 'home' ? pl.id : 'safe' })); },

  /** Where you'd want to be: the embassy on a working morning not yet worked; the flat late at night. */
  goal(state) {
    if (state.map.kind !== 'street' || state.scenario.window) return null;   // (in the flat, the way out's the door; at its window, nowhere)
    const c = state.campaign, p = c.posting, now = state.time.ms, k = calendar(now);
    const pl = k.weekday < 5 && !c.worked[Math.floor(now / DAY)] && k.hour >= 7 && k.hour < WORK.to - 2 ? p.embassy : k.hour >= 22 || k.hour < 5 || fatigue(c, now).v ? p.home : null;
    const me = state.actors.find(a => a.who === state.player);
    if (!pl || pl.x === undefined || !me || (pl.row === state.map.row && Math.abs(me.x - pl.x) < 4)) return null;
    const far = pl.row === state.map.row ? `${Math.round(Math.abs(pl.x - me.x))} m` : rowsText(pl.row - state.map.row);
    return { row: pl.row, x: pl.x, z: pl.z ?? Z.front, name: signOf(pl), far, kind: pl === p.embassy ? 'embassy' : 'home', label: `${signOf(pl)} · ${far}` };
  },

  /** Where we are, for the watch: the street (the engine names it). */
  place() { return ''; },

  /** The posting over (expelled, or the goal met): what it came to. */
  result(state) {
    const c = state.campaign, p = c.posting, days = Math.round((state.time.ms - p.startMs) / DAY), done = c.over?.why === 'completed';
    const met = c.done.filter(a => a.kind === 'sdr' && ['clean', 'burned'].includes(a.outcome)).length, seen = c.done.filter(a => a.kind === 'tail' && a.outcome === 'seen').length;
    return {
      stamp: done ? 'POSTING COMPLETE' : 'EXPELLED', good: done, title: `STATION ${cityById(p.city).name.toUpperCase()}`,
      text: done ? `The station has what it wanted on ${p.subject}. Langley's reply is two words long, and one of them is "good". The next posting will be harder.`
        : 'Declared persona non grata, forty-eight hours to leave. The cable home will say "compromised"; the review will say more.',
      notes: [`${days} days on the posting: ${met} meetings, ${seen} tails that saw what they came for; intelligence ${p.intelligence}.`,
        `The network: ${c.posting.assets.length ? c.posting.assets.map(s => `${s.codename}, trust ${s.trust}`).join('; ') : 'none left'}.`,
        c.reviews.length ? `The weeks: ${c.reviews.map(r => r.grade).join(', ')}.` : null].filter(Boolean),
      stats: `Heat at the end: ${heatWord(p.heat)} · cover standing ${p.cover}`,
    };
  },
};

/** The flat the posting gives you, as a map (sim/map/interior.js): its plan from the posting's seed. */
export const homeMap = (c, ms = c.now ?? c.posting.startMs) => ({ kind: 'interior', plan: 'flat', place: 'home', seed: hash(c.posting.mapSeed, 'home') % 1e9, i0: 0, i1: 0, crowd: 0, row: c.posting.home.row, city: c.posting.city,
  boxes: ms < c.posting.startMs + UNPACKED_DAYS * DAY });   // (the first days, the moving boxes not yet unpacked)
export const UNPACKED_DAYS = 3;

/** Into the flat: up the stairs from your door (at 'door'), straight to bed (at 'sleep', the desk's), or back from its window (at 'window'). */
function enterHome(state, bus, at = 'door') {
  const c = state.campaign, me = state.actors.find(a => a.who === state.player), map = homeMap(c, state.time.ms), plan = planOf(map);
  const e = plan.exits[0], s = at === 'sleep' || at === 'window' ? plan.spots.find(x => x.kind === (at === 'sleep' ? 'sleep' : 'window')) : { x: (e.x0 + e.x1) / 2, z: e.z1 + 0.7, face: 'down' };
  Object.assign(me, { x: s.x, z: s.z, vx: 0, vz: 0, busy: null, face: s.face, head: headOf(s.face), hidden: false });
  newMap(state, bus, map, s.x);
  c.where = { inside: 'home', row: c.posting.home.row, x: s.x, z: s.z };
  if (at === 'door') say(state, bus, { kind: 'note', text: 'Up the stairs, the key in the lock: the flat.' });
}

/**
 * At the flat's window: the street below, from up behind the curtain (the user, 2026-10-27: "getting
 * close to the windows would allow us to get the outside of flat view"). The street's map, your eyes
 * at the front over your door, out of sight (hidden): who's there, who's waiting, who keeps looking up.
 * Your feet the window's (holds()); T, and you're back in the room.
 */
function lookOut(state, bus) {
  const c = state.campaign, p = c.posting, me = state.actors.find(a => a.who === state.player);
  Object.assign(me, { x: (p.home.x ?? 12) + 1.2, z: (p.home.z ?? Z.front) + 0.1, vx: 0, vz: 0, busy: null, face: 'down', head: Math.PI / 2, hidden: true });
  newMap(state, bus, { kind: 'street', seed: p.mapSeed, row: p.home.row, i0: null, i1: null, crowd: 1, city: p.city }, me.x);
  state.scenario.window = true;
  say(state, bus, { kind: 'note', text: 'The curtain an inch aside: the street below, and nobody looking up.' });
}
function backFromWindow(state, bus) {
  state.scenario.window = false;
  state.actors.find(a => a.who === state.player).hidden = false;
  enterHome(state, bus, 'window');
}

/** Out of the flat by its front door: down the stairs, and onto the street at your door. */
function leaveHome(state, bus) {
  const p = state.campaign.posting;
  goTo(state, bus, p.home, `Down the stairs and out, onto ${streetName(townOf({ seed: p.mapSeed, city: p.city }), p.home.row)}.`, (p.home.z ?? Z.front) + 0.8);
}
const DOORSTEP_M = 2.6;
export const NAP_MIN = 60, NAP_EASES_H = 4, REST_MIN = 30, REST_CALM = 15;   // (the bed by day: a nap takes the edge off being up long; lying down, stress)
export const RING_S = 45;                                          // (a call let ring stops after this)                                            // (your door's step: this far out from the building, the way up offered)

/**
 * What the instinct's line offers, done (T): up to the flat from your door; in it, the telephone, the
 * bed, the basin, the kitchen; walked to first if it's across the room (here: already there).
 */
function use(state, bus, act, here = false) {
  const c = state.campaign, me = state.actors.find(a => a.who === state.player);
  if (!act || !me || state.fight) return;
  if (act === 'home') return enterHome(state, bus, 'door');
  if (act === 'unwindow') return backFromWindow(state, bus);
  if (act === 'work') return campaignHub.act(state, bus, 'desk:work');   // (in at the embassy's door, and the day's work: out at six)
  const kind = { phone: 'phone', call: 'phone', sleep: 'sleep', wash: 'wash', eat: 'eat', window: 'window', read: 'read' }[act], s = kind && spotOf(state, kind);
  if (!s) return;
  if (!here && Math.hypot(me.x - s.x, me.z - s.z) > SPOT_REACH_M) { walkTo(state, me, s); state.scenario.using = { act, spot: kind }; return; }
  if (act === 'phone') {
    const call = (c.calls ?? []).find(k => k.rang && !k.done);
    if (!call) return;
    call.done = state.time.ms;
    say(state, bus, { kind: 'note', text: 'You pick up.' });
    bus?.emit('call', call.id);
  } else if (act === 'call') { say(state, bus, { kind: 'note', text: 'You dial the number Hale left you.' }); bus?.emit('call', 'hale-again'); }
  else if (act === 'sleep') {
    // (late, or worn out: to bed; by day the bed asks how long: sim/ui's choices, back as desk:sleep, desk:rest:nap, desk:rest:lie)
    const k = calendar(state.time.ms);
    if (k.hour >= 20 || k.hour < 5 || fatigue(c, state.time.ms).v <= -3) campaignHub.act(state, bus, 'desk:sleep');
    else bus?.emit('bed', [{ key: 'sleep', label: 'Sleep till seven tomorrow' }, { key: 'rest:nap', label: `A nap: an hour, and ${NAP_EASES_H} hours' tiredness gone` }, { key: 'rest:lie', label: 'Lie down half an hour: the nerves settle' }]);
  }
  else if (act === 'window') lookOut(state, bus);
  else if (act === 'read') {                                       // (an hour with the book on the go: sim/training.js)
    const p = state.people.me, lang = c.posting.city === 'london' ? 'ru' : cityById(c.posting.city).lang ?? 'ru';
    skip(state, bus, 60 * MIN);
    say(state, bus, { kind: 'note', text: readAnHour(p, lang) ?? 'Nothing left to read.' });
  }
  else if (act === 'eat') { say(state, bus, { kind: 'note', text: 'Bread, cheese, the kettle, the radio low: twenty minutes.' }); skip(state, bus, 20 * MIN); eat(state.people.me, state.time.ms, 20); }
  else if (act === 'wash') {
    const p = state.people.me;
    say(state, bus, { kind: 'note', text: p.bloody ? 'Hot water, a clean shirt, the stained one in a bag for the bin a long way from here.' : 'Hot water, a shave, a clean shirt.' });
    delete p.bloody;
    skip(state, bus, 15 * MIN);
  }
}

// (the instinct's line at a spot in the flat: [its words, its act])
const SPOT_LINE = {
  sleep: (state) => { const h = calendar(state.time.ms).hour; return [h >= 20 || h < 5 ? 'Your bed. {instinct}: sleep till seven.' : 'Your bed. {instinct}: a nap, a rest, or the night.', 'sleep']; },
  phone: () => ['The telephone. {instinct}: call Hale, about the exercises.', 'call'],
  wash: (state) => [state.people.me.bloody ? 'The basin. {instinct}: wash the blood off, a clean shirt.' : 'The basin. {instinct}: wash, a clean shirt.', 'wash'],
  eat: () => ['The kitchen table. {instinct}: something to eat.', 'eat'],
  cook: () => ['The cooker. {instinct}: something to eat.', 'eat'],
  window: () => ['The window, over the street. {instinct}: look out, from behind the curtain.', 'window'],
  read: (state) => { const b = reading(state.people.me); return b ? [`The armchair. {instinct}: an hour with ${bookOf(b.id).title}.`, 'read'] : ['The armchair, and nothing to read but the takeaway menus. A bookshop would help.', null]; },
};

/** Arrive at a place: its street loaded, the player at its door (sim/game.js newMap()). */
function goTo(state, bus, to, note = null, z = -2.6) {
  const c = state.campaign, p = c.posting, me = state.actors.find(a => a.who === state.player);
  const door = { x: to.x ?? 12 };                                  // (its door: sim/places.js)
  Object.assign(me, { x: door.x, z, vx: 0, vz: 0, face: 'down', head: Math.PI / 2, busy: null, hidden: false });
  newMap(state, bus, { kind: 'street', seed: p.mapSeed, row: to.row, i0: null, i1: null, crowd: 1, city: p.city }, door.x);
  c.where = { row: to.row, x: door.x, z };
  say(state, bus, { kind: 'note', text: note ?? `${cap(to.label)}, on ${streetName(townOf({ seed: p.mapSeed, city: p.city }), to.row)}.` });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The hub's instinct: what's next, and when to leave for it; the embassy, if it's a working day; otherwise nothing. */
function instinct(state, c, now) {
  const L = (id, tone, text, act = null) => ({ id, tone, text, act, ms: now });
  const me = state.actors.find(a => a.who === state.player), p = c.posting;
  // At the window: back from it. In the flat: the telephone, ringing, before anything. At your door: up to it.
  if (state.scenario.window) return L('window-out', 'calm', 'From the window: the street below. {instinct}: back into the room.', 'unwindow');
  if (state.map.place === 'home') {
    if ((c.calls ?? []).some(k => k.rang && !k.done)) return L('ring', 'warn', 'The telephone is ringing. {instinct}: answer it.', 'phone');
  } else if (me && state.map.kind === 'street' && state.map.row === p.home.row && p.home.x !== undefined && Math.abs(me.x - p.home.x) < 1.2 && me.z < (p.home.z ?? Z.front) + DOORSTEP_M) {
    return L('home-door', 'calm', 'Your building. {instinct}: up to the flat.', 'home');
  } else if (me && state.map.kind === 'street' && state.map.row === p.embassy.row && p.embassy.x !== undefined && Math.abs(me.x - p.embassy.x) < 1.6 && me.z < (p.embassy.z ?? Z.front) + DOORSTEP_M) {
    // (at the embassy's door: in to work, on a working day not yet worked; early, the day starts when you do)
    const k0 = calendar(now);
    if (k0.weekday < 5 && !c.worked[Math.floor(now / DAY)] && k0.hour < WORK.to) return L('work-door', 'note', `The embassy. {instinct}: in to work, till six${k0.hour < WORK.from ? ' (early: the coffee\'s on)' : ''}.`, 'work');
    return L('work-shut', 'calm', k0.weekday >= 5 ? 'The embassy: the weekend. The Marine at the desk wouldn\'t thank you.' : 'The embassy: your day\'s done here.');
  }
  const next = agenda(c, now)[0];
  const k = calendar(now), today = Math.floor(now / DAY), worked = c.worked[today];
  if (next) {
    const a = next.a, name = a.kind === 'sdr' ? c.posting.assets.find(s => s.id === a.who)?.codename : c.posting.targets.find(t => t.id === a.who)?.name;
    if (next.when === 'now') return L(`now-${a.id}`, 'warn', `${KINDS[a.kind].name}: ${name}, now. {mindmap} the desk, and go.`);
    if (a.start - now < 3 * HOUR) return L(`soon-${a.id}`, 'note', `${name} at ${clockText(a.from)}: be off by ${clockText(a.start)}. {mindmap}: the desk.`);
  }
  const tired = fatigue(c, now);
  if (tired.v) return L(`tired-${tired.word}`, tired.v <= -3 ? 'warn' : 'note', `${Math.floor(tired.h)} hours awake: ${tired.word}, ${tired.v} to everything. ${state.map.place === 'home' ? '{instinct}: to bed.' : '{mindmap}: the desk, and sleep.'}`, state.map.place === 'home' ? 'sleep' : null);
  // (in the flat, what's at hand: the bed, the telephone, the basin, the kitchen)
  const s = state.map.place === 'home' && me && !me.busy && spotNear(state, me), line = s && SPOT_LINE[s.kind]?.(state);
  if (line) return L(`spot-${s.kind}`, 'calm', line[0], line[1]);
  if (k.weekday < 5 && !worked && k.hour >= 7 && k.hour < WORK.to - 2) return L('work', 'note', `A working day: the embassy expects you${k.hour < WORK.from ? ' at nine' : ''}. Its door, {instinct}; or {mindmap}: the desk.`);
  if (k.hour >= 23 || k.hour < 5) return L('late', 'calm', `${clockText(now)}. Bed, sooner or later: {mindmap}.`);
  return next ? L(`later-${next.a.id}`, 'calm', `Next: ${KINDS[next.a.kind].name.toLowerCase()}, ${dayWord(next.a.from, now)} at ${clockText(next.a.from)}. Heat: ${heatWord(c.posting.heat)}.`) : null;
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayWord = (ms, now) => { const d = Math.floor(ms / DAY) - Math.floor(now / DAY); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : DAYS[calendar(ms).weekday]; };
