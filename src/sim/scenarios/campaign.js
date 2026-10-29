// TRADECRAFT sim: the campaign's hub (sim/campaign.js): between assignments, the posting's city from your
// own door, the campaign's clock, your character as the campaign has them (wounds, blood and all).
// Walk where you like; the instinct says what's next ("SKVORETS at 19:31: leave by 18:50"); Tab opens
// the mind (src/ui/mind.js: Ahead, its choices), which come back as actions:
//   - 'desk:work': the embassy until 18:00, a working day (cover standing up);
//   - 'desk:sleep': home, and sleep till 7:00;
//   - 'desk:low': lie low for a day (heat down);
//   - 'desk:travel:<place>': to the flat, the embassy, a safe house: the metro or a taxi (sim/campaign.js
//     trip(): the minutes it takes), and the place's street, from its door;
//   - 'desk:go:<id>': an assignment: wait (the clock skipped) until its start if it's later today, and
//     go: the game tells the bus ('assignment'), and the UI launches it (src/main.js) with the
//     campaign's context (sim/campaign.js context()).
// Two places are walked into: the flat (up from your door: its bed, its telephone, its window) and the
// embassy (in at its door, past the Marine and through the arch: your desk, where T is the day's work,
// till six, and you're still at it when it's done; the chief's office, where T opens the desk; the
// street door to leave by: sim/interiors/embassy.js).
// Every skip of the clock is the engine's (sim/game.js skip(): what bleeds bleeds, what heals heals),
// and the calendar's consequences are the campaign's (pass(): days worked or missed, pay, the week's
// review), told as papers on the bus ('papers').
// **Watched** (DESIGN.md, Cover, heat and the hunt; the user, 2026-10-26: "the FSB follows people of
// interest, diplomats among them, and doesn't much hide it"): out of the flat's door or the embassy's
// (outing()), the hour's dice (sim/campaign.js watched(): by the heat and the city) may put being
// tailed's team on you (sim/scenarios/sdr.js: an overt pair, or a covert team), and the scene is theirs
// as it is in the test: they follow you through lanes, shops, buses, taxis and the metro; you check your
// back the same ways, and mark faces; what they write down costs FLAG_HEAT each, at once. Their sheet is
// the scene's `tail`. From the flat's window, whoever waits for you by the kerb below is there to be seen. A trip
// from the desk takes them along or loses them by its way (tailOver()); lying low at a safe house with
// them on you shows them its door (the station's cable the next morning: sim/campaign.js pass()); an
// asset meeting begun with them still on you has them for its team (sim/campaign.js context()).
import { TICK_MS, DAY, HOUR, MIN, calendar, clockText } from '../clock.js';
import { heatKey, addHeat } from '../heat.js';
import { say } from '../log.js';
import { Z, streetName } from '../map/street.js';
import { townOf, cityById } from '../cities/index.js';
import { skip, newMap } from '../game.js';
import { eat, soothe } from '../needs.js';
import { agenda, pass, work, rest, lieLow, heatWord, places, trip, fatigue, watched, KINDS, WORK } from '../campaign.js';
import { signOf } from '../places.js';
import { reading, bookOf, readAnHour } from '../training.js';
import { dress, wardrobeWays, unpack, DRESS_S } from '../clothes.js';
import { kitWords, addSupply } from '../medicine.js';
import { call } from '../phone.js';
import { staffTick, think as staffThink } from '../interiors/staffing.js';
import { follow } from '../crowd.js';
import { arrived } from '../knowledge.js';
import { planOf } from '../map/interior.js';
import { spotNear, spotOf, exitHere, walkTo, SPOT_REACH_M } from '../interiors/use.js';
import { hash, stream, range, chance } from '../rng.js';
import { headOf, seesActor } from '../perception.js';
import { skill } from '../skills.js';
import { opposed } from '../checks.js';
import { keeps, behind, CAB_FLAG, CHASE_WAIT_S } from '../taxi.js';
import { freeShare } from '../traffic.js';
import { stays, RIDER_S } from '../metro.js';
import { sdr, rowsText, crewFor, newTeam, pickUp, join, teamTick, teamSecond, glanced, FLAG_HEAT } from './sdr.js';

const TPS = 1000 / TICK_MS;

export const campaignHub = {
  name: 'Campaign',
  about: 'A US embassy, for as long as it lasts: a first tour in London, or a network to run of your own; the heat to keep down.',
  campaign: true,
  police: true,                                                     // (your own hours in the city: patrols, and stops: sim/police.js)

  setup(state) {
    const c = state.campaign, p = c.posting;
    state.time.ms = c.now ?? p.startMs;
    state.legend = { id: 'embassy', name: p.job, cover: 'official', floor: 20 };
    state.country = p.country;
    state.heat[heatKey('embassy', p.country)] = p.heat;
    state.people.me = structuredClone(c.character);
    state.player = 'me';
    const row = c.where?.row ?? p.home.row, flat = !c.where || c.where.inside === 'home', inEmbassy = c.where?.inside === 'embassy';
    // (day one, and whenever the last of the day left you there: the flat; at work, the embassy; else
    // wherever the last assignment left you, on its street)
    state.map = flat ? homeMap(c) : inEmbassy ? embassyMap(c) : { kind: 'street', seed: p.mapSeed, row, i0: null, i1: null, crowd: 1, city: p.city };
    const bed = flat && planOf(state.map).spots.find(s => s.kind === 'sleep');
    const x = c.where?.x ?? (flat ? bed.x : p.home.x ?? 12), z = c.where?.z ?? (flat ? bed.z : -2.6);
    state.actors.push({ id: 'a0', who: 'me', seed: null, row, x, z, vx: 0, vz: 0, face: flat ? 'left' : 'down', head: flat ? Math.PI : Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: null });
    state.scenario = { kind: 'campaign', prompt: null, outcome: null, began: state.time.ms };
    const street = streetName(townOf({ seed: p.mapSeed, city: p.city }), row);
    say(state, null, { kind: 'note', text: c.where ? `${clockText(state.time.ms)}, ${flat ? 'the flat' : street}.` : `${state.people.me.name}, ${p.job}. Day one of the posting: ${clockText(state.time.ms)}, the flat the embassy rents you on ${street}. Boxes not yet unpacked. Tab: the desk.` });
  },

  /** Begun on a street (where an assignment left you), or a game from before the watchers: out, as from a door. */
  attach(state) { if (state.map.kind === 'street' && state.scenario.tail === undefined && !state.scenario.window) outing(state, 'street'); },

  act(state, bus, action) {
    const c = state.campaign;
    if (action === 'instinct') return use(state, bus, state.scenario.prompt?.act);
    if (action === 'glance') { const me = state.actors.find(a => a.who === state.player); if (state.scenario.tail && me && state.map.kind === 'street') glanced(state, bus, me); return; }
    if (!String(action).startsWith('desk:')) return;
    if (state.fight) return say(state, bus, { kind: 'instinct', text: 'Not with a fight on your hands.' });   // (the desk's days and trips wait till it's over)
    const [, what, id] = action.split(':'), now = state.time.ms;
    // (heat: the street's (state.heat, what they wrote down) into the campaign's, which the days, lying
    // low and arrests then move (sim/campaign.js pass(), lieLow()), and back after: until())
    c.posting.heat = heatNow(state);
    const until = (to, text) => {                                  // (the clock skipped to `to`, the calendar's consequences told)
      if (to <= now) return;
      if (text) say(state, bus, { kind: 'note', text });
      const out = state.scenario.tail && to - now > HOUR;             // (hours on, on the street: whoever was on you then isn't the question now)
      if (out) dropTeam(state);
      skip(state, bus, to - now);
      if (out && state.map.kind === 'street') outing(state, 'street');
      const papers = pass(c, now, state.time.ms);
      state.heat[heatKey('embassy', c.posting.country)] = c.posting.heat;
      if (papers.length) bus?.emit('papers', papers);
      if (c.over && !state.scenario.outcome) { Object.assign(state.scenario, { outcome: c.over.why, ended: state.time.ms }); bus?.emit('scenario-end', c.over.why); }
    };
    if (what === 'work') {
      const to = work(c, now), here = state.map.place === 'embassy';
      if (to === now) return say(state, bus, { kind: 'instinct', text: 'Not a working day, or it\'s over: nobody at the embassy wants you now.' });
      until(to, here ? 'The day\'s cables, a meeting about the meetings, the canteen at one.' : 'The metro to the embassy, the guard\'s nod, the day\'s cables.');
      eat(state.people.me, state.time.ms - 4 * HOUR, 5);             // (lunch in the canteen: sim/needs.js)
      if (state.scenario.outcome) return;
      // (at your desk: still there at six, up from it; from anywhere else, the day worked and out of its door)
      if (here) { const me = state.actors.find(a => a.who === state.player), d = spotOf(state, 'desk'); if (me && d) Object.assign(me, { x: d.x, z: d.z, face: 'left', head: headOf('left'), gait: 'idle' }); say(state, bus, { kind: 'note', text: 'Six o\'clock: the cables read, the safe locked, your coat off the back of the chair.' }); }
      else { goTo(state, bus, c.posting.embassy, `Six o'clock, and out of the embassy onto ${streetName(townOf({ seed: c.posting.mapSeed, city: c.posting.city }), c.posting.embassy.row)}.`); outing(state, 'embassy'); }
    } else if (what === 'sleep') {                                  // (a night's sleep, and breakfast: sim/needs.js; you wake in the flat)
      until(rest(c, now), state.map.place === 'home' ? 'To bed.' : 'Home, and to bed.'); soothe(state.people.me, 60);   // (rested, calmer: not fed; sim/needs.js)
      if (state.map.place !== 'home' && !state.scenario.outcome) enterHome(state, bus, 'sleep');
    }
    else if (what === 'dress') {                                    // (the wardrobe's way, chosen: sim/clothes.js; a change of clothes takes a few minutes)
      const p = state.people.me, line = dress(p, action.split(':').slice(2).join(':'));
      if (!line) return;
      say(state, bus, { kind: 'note', text: line });
      if (/^(wear|off):/.test(action.split(':').slice(2).join(':'))) skip(state, bus, DRESS_S * 1000);
      if (state.map.place === 'home') bus?.emit('wardrobe', wardrobeWays(p));   // (and the wardrobe still open: what else)
    }
    else if (what === 'low') {
      const house = safeHere(state), safe = !!house;
      if (house && seenGoing(state)) house.seen = now;               // (its door, with them watching: sim/campaign.js pass(), the cable)
      until(lieLow(c, now, safe), safe ? 'A day in the safe house: the curtains drawn, the kettle, nobody.' : 'A day of being nobody.'); eat(state.people.me, state.time.ms, 40);
    }
    else if (what === 'rest' && state.map.place === 'home') {      // (the bed, by day: a nap, or lying down a while: sim/needs.js, campaign.js fatigue())
      const p = state.people.me;
      if (id === 'nap') { until(now + NAP_MIN * MIN, 'An hour on top of the covers, shoes off. You wake thick-headed, and better for it.'); c.awake = Math.min(state.time.ms, (c.awake ?? now) + NAP_EASES_H * HOUR); }
      else { until(now + REST_MIN * MIN, 'Half an hour on the bed with the ceiling for company. Your breathing slows.'); eat(p, p.needs?.ate ?? state.time.ms, REST_CALM); }
    }
    else if (what === 'phone') {                                    // (a call to an asset, from the mind: sim/phone.js; desk:phone:<asset>:<burner|own>:<why>)
      const [, , , phone, why] = action.split(':'), r = call(state, bus, id, phone, why);
      if (!r.ok && r.text) say(state, bus, { kind: 'instinct', text: r.text });
    }
    else if (what === 'travel') {
      const to = places(c).find(pl => pl.id === id);
      if (!to) return;
      const from = state.map.row ?? 0, { ms, how, by } = trip(from, to.row);
      const kept = tailOver(state, by, to, from);                     // (whoever's on you, with you there or lost on the way)
      until(now + ms, `To ${to.label}: ${how}.`);
      goTo(state, bus, to);
      arriveWith(state, kept);
    }
    else if (what === 'go') {
      const a = c.assignments.find(x => x.id === id && x.status === 'open');
      if (!a) return;
      if (now < a.start) {
        if (Math.floor(a.start / DAY) !== Math.floor(now / DAY)) return say(state, bus, { kind: 'instinct', text: 'That\'s another day. Sleep on it.' });
        until(a.start, `You kill the time till ${clockText(a.start)}, and go.`);
      }
      if (state.scenario.outcome || state.people.me.dead) return;
      const t = state.scenario.tail;
      a.tailedBy = t && !t.teamLost && t.crew.some(x => x.id) ? t.team : null;   // (still on you: the meeting's team: sim/campaign.js context())
      c.character = structuredClone(state.people.me);
      c.posting.heat = state.heat[heatKey('embassy', c.posting.country)] ?? c.posting.heat;
      bus?.emit('assignment', a.id);
    }
  },

  tick(state, bus) {
    // (the watchers, if they're on you: being tailed's, every tick; what they write down, heat at once)
    const t = state.scenario.tail, me0 = t && state.map.kind === 'street' && !state.scenario.window && state.actors.find(a => a.who === state.player);
    if (me0 && teamTick(state, bus, me0)) {
      teamSecond(state, bus, me0);
      if (t.flags.length > (t.charged ?? 0)) { addHeat(state, FLAG_HEAT * (t.flags.length - (t.charged ?? 0))); t.charged = t.flags.length; }
    }
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
    if (state.map.place === 'embassy' && me && !me.busy && exitHere(state, me)) return leaveEmbassy(state, bus);   // (out by the street door)
    // (a spot walked to: what you went there for)
    if (state.scenario.using && me && !me.busy) { const u = state.scenario.using; state.scenario.using = null; if (spotNear(state, me)?.kind === u.spot) use(state, bus, u.act, true); }
    // (a call: the telephone rings in the flat, when it's due and you're there)
    const call = (c.calls ?? []).find(k => !k.done && now >= k.at);
    if (call && state.map.place === 'home' && !call.rang) { call.rang = now; say(state, bus, { kind: 'note', text: 'The telephone rings.' }); }
    // (let ring, it stops: Hale, most likely; his number's on the pad by it, and he'll be glad to hear from you)
    if (call?.rang && now - call.rang > RING_S * 1000) { call.done = now; call.missed = true; say(state, bus, { kind: 'note', text: 'The telephone stops. Hale, most likely: his number\'s on the pad by it.' }); }
    if (state.map.place === 'embassy') staffTick(state, bus, state.$world.sections.get(0));   // (its people through the day: sim/interiors/staffing.js)
    if (arrived(state)) say(state, bus, { kind: 'note', text: 'There.' });   // (the waypoint reached, and cleared: sim/knowledge.js)
    state.scenario.prompt = instinct(state, c, now);
  },

  /** The embassy's people, walking their day (sim/interiors/staffing.js). */
  think(state, a, bus) {
    if (a.ai?.kind === 'watcher') return sdr.think(state, a, bus);   // (being tailed's: sim/scenarios/sdr.js)
    if (a.ai?.kind === 'staff' || a.ai?.kind === 'applicant') staffThink(state, state.$world.sections.get(0), a, follow);
  },

  // Out on the street with the team's sheet (outing()): being tailed's hooks, as the test has them.
  onTaxi(state, bus, to, phase) { if (state.scenario.tail) sdr.onTaxi(state, bus, to, phase); },
  onBus(state, bus, to, phase) { if (state.scenario.tail) sdr.onBus(state, bus, to, phase); },
  onMetro(state, bus, to, phase) { if (state.scenario.tail) sdr.onMetro(state, bus, to, phase); },
  onShop(state, bus, phase, way) { if (state.scenario.tail) sdr.onShop(state, bus, phase, way); },
  onInteract(state, bus, them, id) { if (state.scenario.tail) sdr.onInteract(state, bus, them, id); },
  carry(state, way) { return state.scenario.tail ? sdr.carry(state, way) : []; },
  mapChanged(state) { if (state.scenario.tail) sdr.mapChanged(state); },

  /** At the window, your feet are the window's: nothing but T takes you from it. */
  holds(state) { return !!state.scenario.window; },

  /** In the flat, the whole of it is taken in: no fog (src/render/view.js). */
  aware(state) { return state.map.kind === 'interior' || !!state.scenario.window; },   // (from the flat's window, the whole stretch below: who's waiting, who looks up)

  /** A taxi (sim/taxi.js) to the posting's places. */
  destinations(state) { return places(state.campaign).map(pl => ({ id: pl.id, label: pl.label, row: pl.row, x: pl.x ?? 12 })); },

  /**
   * The posting's places on this street, named over their doors (sim/places.js); indoors, the way out,
   * marked over its door (the user, 2026-10-28: "where is the door out of the flat").
   */
  signs(state) {
    if (state.map.kind === 'interior') {
      const e = state.$world?.sections.get(0)?.plan?.exits[0], south = e?.side === 's';
      return e ? [{ x: (e.x0 + e.x1) / 2, z: south ? e.z1 : e.z0, lift: south ? 0.6 : 1.65, icon: south ? 'down' : 'up', label: state.map.place === 'embassy' ? 'The street' : 'Front door', kind: 'out' }] : [];
    }
    return state.map.kind !== 'street' ? [] : places(state.campaign).filter(pl => pl.row === state.map.row && pl.x !== undefined).map(pl => ({ x: pl.x, z: pl.z ?? Z.front, label: signOf(pl), kind: pl.id === 'embassy' || pl.id === 'home' ? pl.id : 'safe' }));
  },

  /** Where you'd want to be: the embassy on a working morning not yet worked; the flat late at night. */
  goal(state) {
    if (state.map.kind !== 'street' || state.scenario.window) return null;   // (in the flat, the way out's the door; at its window, nowhere)
    const c = state.campaign, p = c.posting, now = state.time.ms, k = calendar(now);
    // (a waypoint set on the mind's map first: sim/knowledge.js)
    const w = c.waypoint, me0 = state.actors.find(a => a.who === state.player);
    if (w && me0) {
      const far = w.row === state.map.row ? `${Math.round(Math.abs(w.x - me0.x))} m` : rowsText(w.row - state.map.row);
      return { row: w.row, x: w.x, z: w.z ?? Z.front, name: w.label, far, kind: w.kind === 'home' ? 'home' : w.kind === 'work' ? 'embassy' : w.kind === 'safe' ? 'safe' : 'way', label: `${w.label} · ${far}` };
    }
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
    if (c.over?.why === 'promoted') {                               // (a first tour done: a station of your own, chosen on this paper: src/ui/ui.js)
      const trips = c.done.filter(a => a.trip);
      return { stamp: 'PROMOTED', good: true, title: 'STATION LONDON: FIRST TOUR',
        text: 'Langley\'s cable is three lines long. The last one says you\'re ready for a posting of your own, under official cover, with a network to run. The station is yours to ask for.',
        notes: [`${days} days on the tour: ${c.done.filter(a => a.kind === 'tail' && a.outcome === 'seen').length} tails that saw the meeting, ${c.done.filter(a => a.kind === 'watch' && ['photo', 'soft'].includes(a.outcome)).length} photographs; intelligence ${p.intelligence}.`,
          trips.length ? `Abroad: ${trips.map(a => `${a.trip.charAt(0).toUpperCase() + a.trip.slice(1)}, ${a.outcome ?? 'missed'}`).join('; ')}.` : null].filter(Boolean),
        stats: `Heat at the end: ${heatWord(p.heat)} · cover standing ${p.cover}` };
    }
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

/** The embassy's ground floor, as a map (sim/interiors/embassy.js): its plan from the posting's seed. */
export const embassyMap = (c) => ({ kind: 'interior', plan: 'embassy', place: 'embassy', seed: hash(c.posting.mapSeed, 'embassy') % 1e9, i0: 0, i1: 0, crowd: 0, row: c.posting.embassy.row, city: c.posting.city });

/** In at the embassy's door, past the Marine: the lobby, a step in from the street. */
function enterEmbassy(state, bus) {
  const c = state.campaign, me = state.actors.find(a => a.who === state.player), map = embassyMap(c), plan = planOf(map), e = plan.exits[0];
  const s = { x: (e.x0 + e.x1) / 2, z: e.z0 - 0.8 };
  Object.assign(me, { x: s.x, z: s.z, vx: 0, vz: 0, busy: null, face: 'up', head: headOf('up'), hidden: false });
  newMap(state, bus, map, s.x);
  Object.assign(state.scenario, { tail: null, window: false });     // (in: whoever was on you waits outside, or doesn't)
  c.where = { inside: 'embassy', row: c.posting.embassy.row, x: s.x, z: s.z };
  say(state, bus, { kind: 'note', text: 'In off the street, your pass to the Marine behind the glass, a nod: the lobby, and the arch of the metal detector.' });
}

/** Out of the embassy by its street door, onto its street. */
function leaveEmbassy(state, bus) {
  const p = state.campaign.posting;
  state.scenario.life = null;                                       // (its people as they'll be when you're next in: sim/interiors/staffing.js)
  goTo(state, bus, p.embassy, `Out past the Marine, onto ${streetName(townOf({ seed: p.mapSeed, city: p.city }), p.embassy.row)}.`, (p.embassy.z ?? Z.front) + 0.8);
  outing(state, 'embassy');
}

/** Into the flat: up the stairs from your door (at 'door'), straight to bed (at 'sleep', the desk's), or back from its window (at 'window'). */
function enterHome(state, bus, at = 'door') {
  const c = state.campaign, me = state.actors.find(a => a.who === state.player), map = homeMap(c, state.time.ms), plan = planOf(map);
  const e = plan.exits[0], s = at === 'sleep' || at === 'window' ? plan.spots.find(x => x.kind === (at === 'sleep' ? 'sleep' : 'window')) : { x: (e.x0 + e.x1) / 2, z: e.z1 + 0.7, face: 'down' };
  Object.assign(me, { x: s.x, z: s.z, vx: 0, vz: 0, busy: null, face: s.face, head: headOf(s.face), hidden: false });
  newMap(state, bus, map, s.x);
  Object.assign(state.scenario, { tail: null, window: false });
  c.where = { inside: 'home', row: c.posting.home.row, x: s.x, z: s.z };
  if (at === 'door') say(state, bus, { kind: 'note', text: 'Up the stairs, the key in the lock: the flat.' });
  const got = unpack(state.people.me);                              // (the shop's bag unpacked: sim/clothes.js)
  if (got) say(state, bus, { kind: 'note', text: `The bag unpacked: ${got}, put away.` });
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
  state.scenario.tail = null;
  waiting(state);
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
  outing(state, 'home');
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
  if (act === 'embassy') return enterEmbassy(state, bus);
  const kind = { phone: 'phone', call: 'phone', sleep: 'sleep', wash: 'wash', eat: 'eat', window: 'window', read: 'read', work: 'desk', chief: 'chief', dress: 'dress' }[act], s = kind && spotOf(state, kind);
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
  else if (act === 'dress') bus?.emit('wardrobe', wardrobeWays(state.people.me));   // (the wardrobe: what to wear, what to keep: sim/clothes.js)
  else if (act === 'work') {                                        // (sat at your desk, and the day's work: sim/campaign.js work())
    const k = calendar(state.time.ms);
    if (k.weekday >= 5 || k.hour >= WORK.to || c.worked[Math.floor(state.time.ms / DAY)]) return say(state, bus, { kind: 'instinct', text: 'Not a working day, or it\'s over: nothing in the tray that won\'t keep.' });
    const seat = s.seat ?? s;
    Object.assign(me, { x: seat.x, z: seat.z, vx: 0, vz: 0, face: seat.face ?? 'down', head: headOf(seat.face ?? 'down'), gait: 'sit' });
    campaignHub.act(state, bus, 'desk:work');
  }
  else if (act === 'chief') { say(state, bus, { kind: 'note', text: 'The chief looks up from a cable, takes his glasses off: "What have we got?"' }); bus?.emit('desk-open'); }   // (the desk: what's on, src/ui/ui.js)
  else if (act === 'read') {                                       // (an hour with the book on the go: sim/training.js)
    const p = state.people.me, lang = c.posting.city === 'london' ? 'ru' : cityById(c.posting.city).lang ?? 'ru';
    skip(state, bus, 60 * MIN);
    say(state, bus, { kind: 'note', text: readAnHour(p, lang) ?? 'Nothing left to read.' });
  }
  else if (act === 'eat') { say(state, bus, { kind: 'note', text: 'Bread, cheese, the kettle, the radio low: twenty minutes.' }); skip(state, bus, 20 * MIN); eat(state.people.me, state.time.ms, 20); }
  else if (act === 'wash') {
    const p = state.people.me, cab = kitWords(c.cabinet);
    say(state, bus, { kind: 'note', text: p.bloody ? 'Hot water, a clean shirt, the stained one in a bag for the bin a long way from here.' : (p.wet ?? 0) >= 30 ? 'A hot shower, a towel, dry things on: the wet ones over the bath.' : 'Hot water, a shave, a clean shirt.' });
    delete p.bloody; delete p.wet; delete p.shiver;                  // (dry, and clean: sim/wet.js)
    // (the cabinet over the basin: what's in it, into your pockets: sim/medicine.js)
    if (cab) { addSupply(p, c.cabinet); c.cabinet = {}; say(state, bus, { kind: 'note', text: `From the cabinet over the basin, into a pocket: ${cab}.` }); }
    skip(state, bus, 15 * MIN);
  }
}

// (the instinct's line at a spot in the flat: [its words, its act])
const SPOT_LINE = {
  sleep: (state) => { const h = calendar(state.time.ms).hour; return [h >= 20 || h < 5 ? 'Your bed. {instinct}: sleep till seven.' : 'Your bed. {instinct}: a nap, a rest, or the night.', 'sleep']; },
  phone: () => ['The telephone. {instinct}: call Hale, about the exercises.', 'call'],
  wash: (state) => [`The basin${kitWords(state.campaign.cabinet) ? ', the cabinet over it' : ''}. {instinct}: ${state.people.me.bloody ? 'wash the blood off' : 'wash'}, a clean shirt${kitWords(state.campaign.cabinet) ? `; ${kitWords(state.campaign.cabinet)}, to take` : ''}.`, 'wash'],
  eat: () => ['The kitchen table. {instinct}: something to eat.', 'eat'],
  cook: () => ['The cooker. {instinct}: something to eat.', 'eat'],
  window: () => ['The window, over the street. {instinct}: look out, from behind the curtain.', 'window'],
  desk: (state) => { const c = state.campaign, k = calendar(state.time.ms); return k.weekday < 5 && !c.worked[Math.floor(state.time.ms / DAY)] && k.hour < WORK.to ? [`Your desk, the in-tray. {instinct}: the day's cables, till six.`, 'work'] : ['Your desk: nothing in the tray that won\'t keep till tomorrow.', null]; },
  chief: () => ['The chief\'s office. {instinct}: what\'s on.', 'chief'],
  dress: (state) => [wardrobeWays(state.people.me).length ? 'The wardrobe. {instinct}: what you wear, what you keep here.' : 'The wardrobe: nothing in it but hangers yet. The shops have more.', wardrobeWays(state.people.me).length ? 'dress' : null],
  read: (state) => { const b = reading(state.people.me); return b ? [`The armchair. {instinct}: an hour with ${bookOf(b.id).title}.`, 'read'] : ['The armchair, and nothing to read but the takeaway menus. A bookshop would help.', null]; },
};

/** Arrive at a place: its street loaded, the player at its door (sim/game.js newMap()). */
function goTo(state, bus, to, note = null, z = -2.6) {
  const c = state.campaign, p = c.posting, me = state.actors.find(a => a.who === state.player);
  const door = { x: to.x ?? 12 };                                  // (its door: sim/places.js)
  Object.assign(me, { x: door.x, z, vx: 0, vz: 0, face: 'down', head: Math.PI / 2, busy: null, hidden: false });
  newMap(state, bus, { kind: 'street', seed: p.mapSeed, row: to.row, i0: null, i1: null, crowd: 1, city: p.city }, door.x);
  state.scenario.window = false;                                    // (from the flat's window by the desk: down and out, not still behind the curtain)
  c.where = { row: to.row, x: door.x, z };
  say(state, bus, { kind: 'note', text: note ?? `${cap(to.label)}, on ${streetName(townOf({ seed: p.mapSeed, city: p.city }), to.row)}.` });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- watched in your own hours ----------

const heatNow = (state) => state.heat[heatKey('embassy', state.campaign.posting.country)] ?? state.campaign.posting.heat;
const outingDice = (state, door) => stream('outing', state.campaign.seed, door, Math.floor(state.time.ms / HOUR));   // (the hour's: the window shows the faces you'll meet)
const actorOf = (state, id) => (id ? state.actors.find(a => a.id === id) : null);

/**
 * Out of a door ('home', 'embassy'; 'street': begun on one): whether they're on you this hour
 * (sim/campaign.js watched()), and if so being tailed's team, picking you up behind you. Their sheet
 * either way, team or none: your checks of your back, and the faces you mark, work the same.
 */
function outing(state, door) {
  const c = state.campaign, r = outingDice(state, door), team = watched(c, door, state.time.ms, heatNow(state)), crew = crewFor(state, team, r);
  state.scenario.tail = newTeam(state, team, crew, r);
  pickUp(state, r);
  // (at your own door, from where they waited: what the window showed; a covert team's back-up out of its sight)
  if (door === 'home') for (const p of postsOf(state, team, crew)) Object.assign(actorOf(state, p.c.id), { x: p.x, z: p.z });
}

/** The team off the street (the clock skipped hours on): their people gone, their sheet with them. */
function dropTeam(state) {
  const ids = (state.scenario.tail?.crew ?? []).map(x => x.id).filter(Boolean);
  state.actors = state.actors.filter(a => !ids.includes(a.id));
  state.scenario.tail = null;
}

/** The safe house whose door you're at (on its street, within SAFE_DOOR_M of it; not one that's blown), or null. */
function safeHere(state) {
  const me = state.actors.find(a => a.who === state.player);
  if (!me || state.map.kind !== 'street' || state.scenario.window) return null;
  return state.campaign.posting.safehouses.find(h => !h.burned && h.row === state.map.row && Math.abs((h.x ?? 12) - me.x) <= SAFE_DOOR_M) ?? null;
}
export const SAFE_DOOR_M = 10;

/** Whether they see you go in at a door here: one of them on you, with you in sight or lately so. */
function seenGoing(state) {
  const t = state.scenario.tail, me = state.actors.find(a => a.who === state.player);
  return !!t && !t.teamLost && !!me && t.crew.some(x => { const a = actorOf(state, x.id); return a && (seesActor(state, a, me) || state.time.ms - (a.ai.seenMs ?? -1e12) < SEEN_GOING_MS); });
}
export const SEEN_GOING_MS = 10000;

/**
 * A trip from the desk (sim/campaign.js trip()) with them on you: on foot the long way round, your
 * Pathfinding (+TRIP_FOOT_MOD) against their best Tracking; two stops on the metro, a leg of the metro's
 * (sim/metro.js stays(): an overt pair both, a covert team its eye); a taxi, theirs to keep (sim/taxi.js
 * keeps(): a covert team's own car, an overt pair a cab if one comes along). Indoors, whoever waits at
 * the door you leave by this hour. { team, crew, kept: [crew indices], by }, or null (nobody on you, or
 * lost on the way).
 */
function tailOver(state, by, to, from) {
  const c = state.campaign, now = state.time.ms, you = state.people[state.player];
  let t = state.scenario.tail, on;
  if (!t && (state.map.kind !== 'street' || state.scenario.window)) {
    const door = state.map.place === 'embassy' ? 'embassy' : 'home', team = watched(c, door, now, heatNow(state));
    if (team === 'none') return null;
    t = { team, crew: crewFor(state, team, outingDice(state, door)) };
    on = t.crew.filter(x => x.role !== 'spare');                   // (as they'd have picked you up at the door)
  } else {
    if (!t || t.teamLost) return null;
    on = t.crew.filter(x => actorOf(state, x.id));
  }
  if (!on.length) return null;
  const sheets = on.map(x => state.people[x.who]), best = [...sheets].sort((p, q) => skill(q, 'tracking') - skill(p, 'tracking'))[0];
  let kept = [];
  if (by === 'foot') {
    const r = opposed(state.rng, { skill: 'pathfinding', value: skill(you, 'pathfinding'), body: you, mods: [{ why: 'the long way round', v: TRIP_FOOT_MOD }] }, { skill: 'tracking', value: skill(best, 'tracking'), body: best });
    if (!r.ok) kept = on;
  } else if (by === 'metro') kept = (t.team === 'overt' ? on : on.slice(0, 1)).filter(x => stays(state, state.people[x.who], { lines: [null] }, TRIP_METRO_M));
  else if ((t.team === 'covert' || chance(state.rng, freeShare(now) * CAB_FLAG)) && keeps(state, best, to, from)) kept = t.team === 'covert' ? on.slice(0, 1) : on;
  return kept.length ? { team: t.team, crew: t.crew, kept: kept.map(x => t.crew.indexOf(x)), by } : null;
}
export const TRIP_FOOT_MOD = 2, TRIP_METRO_M = 12;

/**
 * At the trip's end, out at its door: whoever kept with you (tailOver()) behind you, as each way brings
 * them (out of a car pulled in behind yours; up the metro's steps a few seconds after you; round the
 * corner after you on foot); otherwise nobody, this outing.
 */
function arriveWith(state, k) {
  const now = state.time.ms, r = outingDice(state, 'trip'), me = state.actors.find(a => a.who === state.player);
  if (state.map.kind !== 'street' || !me) return;
  state.scenario.tail = newTeam(state, k?.team ?? 'none', k?.crew ?? [], r);
  const t = state.scenario.tail;
  if (!k) return;
  if (k.by === 'taxi') { behind(state, k.kept.map(i => join(state, t.crew[i], 0)), { plain: k.team === 'covert' }); t.teamSeenMs = now + CHASE_WAIT_S * 1000; }
  else if (k.by === 'metro') { t.arrival = { x: me.x, z: me.z }; k.kept.forEach((i, n) => t.pending.push({ crew: i, at: now + Math.round(range(r, ...RIDER_S) * 1000) + n * 900, bus: true, metro: true })); t.teamSeenMs = now; }
  else { for (const i of k.kept) join(state, t.crew[i], -range(r, 14, 22)); t.teamSeenMs = now; }
}

/**
 * Where they wait for you at the flat's door this hour, by the kerb on your own pavement (the window
 * looks down on it): an overt pair together a few doors along, a covert team's eye further, the others
 * out of sight. [{ c: a crew member, x, z }].
 */
function postsOf(state, team, crew) {
  const c = state.campaign, door = c.posting.home.x ?? 12, hour = Math.floor(state.time.ms / HOUR), r = stream('post', c.seed, hour), side = chance(r, 0.5) ? 1 : -1;
  const along = team === 'overt' ? range(r, ...POST_OVERT_M) : range(r, ...POST_COVERT_M);
  return crew.filter(x => team === 'overt' || x.role === 'eye').map((x, n) => ({ c: x, x: door + side * (along + n * 1.1), z: Z.kerbN - 0.6 }));
}
export const POST_OVERT_M = [4, 8], POST_COVERT_M = [12, 20];

/**
 * From the flat's window: whoever waits for you this hour (outing()'s dice: the faces you'll meet at the
 * door), standing where they wait, facing the building.
 */
function waiting(state) {
  const c = state.campaign, team = watched(c, 'home', state.time.ms, heatNow(state));
  if (team === 'none') return;
  for (const p of postsOf(state, team, crewFor(state, team, outingDice(state, 'home')))) {
    state.actors.push({ id: `a${state.nextActor++}`, who: p.c.who, seed: null, row: c.posting.home.row, x: p.x, z: p.z, vx: 0, vz: 0,
      face: 'up', head: headOf('up'), gait: 'idle', stride: 0, stuck: 0, ai: { kind: 'post', steps: [], wait: 0 } });
  }
}

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
    // (at the embassy's door: in, to your desk on a working day not yet worked; any other time, in all the same)
    const k0 = calendar(now);
    if (k0.weekday < 5 && !c.worked[Math.floor(now / DAY)] && k0.hour < WORK.to) return L('work-door', 'note', `The embassy. {instinct}: in, to your desk${k0.hour < WORK.from ? ' (early: the coffee\'s on)' : ''}.`, 'embassy');
    return L('work-shut', 'calm', `The embassy${k0.weekday >= 5 ? ': the weekend, the Marine and the flag' : ': your day\'s done here'}. {instinct}: in all the same.`, 'embassy');
  }
  const next = agenda(c, now)[0];
  const k = calendar(now), today = Math.floor(now / DAY), worked = c.worked[today];
  if (next) {
    const a = next.a, name = a.kind === 'sdr' ? c.posting.assets.find(s => s.id === a.who)?.codename : c.posting.targets.find(t => t.id === a.who)?.name;
    if (next.when === 'now') return L(`now-${a.id}`, 'warn', `${KINDS[a.kind].name}: ${name}, now. {mindmap} the desk, and go.`);
    if (a.start - now < 3 * HOUR) return L(`soon-${a.id}`, 'note', `${name} at ${clockText(a.from)}: be off by ${clockText(a.start)}. {mindmap}: the desk.`);
  }
  // (a face you've marked as a tail, about you still: what it means in your own hours)
  const tl = state.scenario.tail;
  if (tl && state.map.kind === 'street' && Object.values(tl.suspects).some(v => v >= 2)) return L('tail', 'warn', 'A tail, you\'d swear to it. Lose them before anywhere that matters (a safe house, an asset), or go about your day as if you hadn\'t seen them: everything you do, they write down.');
  const tired = fatigue(c, now);
  if (tired.v) return L(`tired-${tired.word}`, tired.v <= -3 ? 'warn' : 'note', `${Math.floor(tired.h)} hours awake: ${tired.word}, ${tired.v} to everything. ${state.map.place === 'home' ? '{instinct}: to bed.' : '{mindmap}: the desk, and sleep.'}`, state.map.place === 'home' ? 'sleep' : null);
  // (in the flat, what's at hand: the bed, the telephone, the basin, the kitchen; at the embassy, your desk, the chief's)
  const s = (state.map.place === 'home' || state.map.place === 'embassy') && me && !me.busy && spotNear(state, me), line = s && SPOT_LINE[s.kind]?.(state);
  if (line) return L(`spot-${s.kind}`, 'calm', line[0], line[1]);
  const fd = state.map.place === 'home' && me && state.$world?.sections.get(0)?.plan?.exits[0];
  if (fd && Math.hypot(me.x - (fd.x0 + fd.x1) / 2, me.z - fd.z0) < 1.8) return L('front-door', 'calm', 'The front door. Through it, down the stairs and out onto the street.');
  if (state.map.place === 'embassy') return k.weekday < 5 && !worked && k.hour < WORK.to ? L('work-in', 'note', 'The station: through the arch, behind the vault door off the corridor. Your desk\'s in there.') : null;
  if (k.weekday < 5 && !worked && k.hour >= 7 && k.hour < WORK.to - 2) return L('work', 'note', `A working day: the embassy expects you${k.hour < WORK.from ? ' at nine' : ''}. ${state.map.place === 'home' ? 'Out by the front door in the hall, and to its door' : 'Its door, {instinct}'}; or {mindmap}: the desk.`);
  if (k.hour >= 23 || k.hour < 5) return L('late', 'calm', `${clockText(now)}. Bed, sooner or later: {mindmap}.`);
  return next ? L(`later-${next.a.id}`, 'calm', `Next: ${KINDS[next.a.kind].name.toLowerCase()}, ${dayWord(next.a.from, now)} at ${clockText(next.a.from)}.`) : null;   // (how hot you are is the officer's guess, the mind's: sim/belief.js)
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayWord = (ms, now) => { const d = Math.floor(ms / DAY) - Math.floor(now / DAY); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : DAYS[calendar(ms).weekday]; };
