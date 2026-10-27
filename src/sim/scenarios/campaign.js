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
    const row = c.where?.row ?? p.home.row;
    state.map = { kind: 'street', seed: p.mapSeed, row, i0: null, i1: null, crowd: 1, city: p.city };
    // (home: the flat's door; or wherever the last assignment left you)
    const door = { x: p.home.x ?? 12 };                             // (the flat's front door: sim/places.js)
    const x = c.where?.x ?? door.x;
    state.actors.push({ id: 'a0', who: 'me', seed: null, row, x, z: c.where?.z ?? -2.6, vx: 0, vz: 0, face: 'down', head: Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: null });
    state.scenario = { kind: 'campaign', prompt: null, outcome: null, began: state.time.ms };
    say(state, null, { kind: 'note', text: c.where ? `${clockText(state.time.ms)}, ${streetName(townOf({ seed: p.mapSeed, city: p.city }), row)}.` : `${state.people.me.name}, ${p.job}. Day one of the posting: ${p.subject}. ${clockText(state.time.ms)}, outside the flat on ${streetName(townOf({ seed: p.mapSeed, city: p.city }), row)}. Tab: the desk.` });
  },

  act(state, bus, action) {
    const c = state.campaign;
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
    } else if (what === 'sleep') { until(rest(c, now), 'Home, and to bed.'); eat(state.people.me, state.time.ms, 60); }   // (a night's sleep, and breakfast: sim/needs.js)
    else if (what === 'low') { const safe = c.posting.safehouses.some(h => h.row === state.map.row); until(lieLow(c, now, safe), safe ? 'A day in the safe house: the curtains drawn, the kettle, nobody.' : 'A day of being nobody.'); eat(state.people.me, state.time.ms, 40); }
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
    state.scenario.prompt = instinct(state, c, now);
  },

  /** A taxi (sim/taxi.js) to the posting's places. */
  destinations(state) { return places(state.campaign).map(pl => ({ id: pl.id, label: pl.label, row: pl.row, x: pl.x ?? 12 })); },

  /** The posting's places on this street, named over their doors (sim/places.js). */
  signs(state) { return places(state.campaign).filter(pl => pl.row === state.map.row && pl.x !== undefined).map(pl => ({ x: pl.x, z: pl.z ?? Z.front, label: signOf(pl) })); },

  /** Where you'd want to be: the embassy on a working morning not yet worked; the flat late at night. */
  goal(state) {
    const c = state.campaign, p = c.posting, now = state.time.ms, k = calendar(now);
    const pl = k.weekday < 5 && !c.worked[Math.floor(now / DAY)] && k.hour >= 7 && k.hour < WORK.to - 2 ? p.embassy : k.hour >= 22 || k.hour < 5 || fatigue(c, now).v ? p.home : null;
    const me = state.actors.find(a => a.who === state.player);
    if (!pl || pl.x === undefined || !me || (pl.row === state.map.row && Math.abs(me.x - pl.x) < 4)) return null;
    return { row: pl.row, x: pl.x, z: pl.z ?? Z.front, label: `${signOf(pl)} · ${pl.row === state.map.row ? `${Math.round(Math.abs(pl.x - me.x))} m` : rowsText(pl.row - state.map.row)}` };
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

/** Arrive at a place: its street loaded, the player at its door (sim/game.js newMap()). */
function goTo(state, bus, to) {
  const c = state.campaign, p = c.posting, me = state.actors.find(a => a.who === state.player);
  const door = { x: to.x ?? 12 };                                  // (its door: sim/places.js)
  Object.assign(me, { x: door.x, z: -2.6, vx: 0, vz: 0, face: 'down', head: Math.PI / 2, busy: null });
  newMap(state, bus, { kind: 'street', seed: p.mapSeed, row: to.row, i0: null, i1: null, crowd: 1, city: p.city }, door.x);
  c.where = { row: to.row, x: door.x, z: -2.6 };
  say(state, bus, { kind: 'note', text: `${cap(to.label)}, on ${streetName(townOf({ seed: p.mapSeed, city: p.city }), to.row)}.` });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The hub's instinct: what's next, and when to leave for it; the embassy, if it's a working day; otherwise nothing. */
function instinct(state, c, now) {
  const L = (id, tone, text) => ({ id, tone, text, act: null, ms: now });
  const next = agenda(c, now)[0];
  const k = calendar(now), today = Math.floor(now / DAY), worked = c.worked[today];
  if (next) {
    const a = next.a, name = a.kind === 'sdr' ? c.posting.assets.find(s => s.id === a.who)?.codename : c.posting.targets.find(t => t.id === a.who)?.name;
    if (next.when === 'now') return L(`now-${a.id}`, 'warn', `${KINDS[a.kind].name}: ${name}, now. {mindmap} the desk, and go.`);
    if (a.start - now < 3 * HOUR) return L(`soon-${a.id}`, 'note', `${name} at ${clockText(a.from)}: be off by ${clockText(a.start)}. {mindmap}: the desk.`);
  }
  const tired = fatigue(c, now);
  if (tired.v) return L(`tired-${tired.word}`, tired.v <= -3 ? 'warn' : 'note', `${Math.floor(tired.h)} hours awake: ${tired.word}, ${tired.v} to everything. {mindmap}: the desk, and sleep.`);
  if (k.weekday < 5 && !worked && k.hour >= 8 && k.hour < WORK.to - 2) return L('work', 'note', 'A working day: the embassy expects you. {mindmap}: the desk.');
  if (k.hour >= 23 || k.hour < 5) return L('late', 'calm', `${clockText(now)}. Bed, sooner or later: {mindmap}.`);
  return next ? L(`later-${next.a.id}`, 'calm', `Next: ${KINDS[next.a.kind].name.toLowerCase()}, ${dayWord(next.a.from, now)} at ${clockText(next.a.from)}. Heat: ${heatWord(c.posting.heat)}.`) : null;
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayWord = (ms, now) => { const d = Math.floor(ms / DAY) - Math.floor(now / DAY); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : DAYS[calendar(ms).weekday]; };
