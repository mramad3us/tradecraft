// TRADECRAFT sim: the free walk. The skeleton on show: a Handler from the US embassy on a Moscow
// boulevard (or in another city: London, Beirut, Cairo; sim/cities/), a November afternoon, the
// street's people about their business, the light going with the clock. Nothing to do but walk, look
// and get the feel: the street goes on east and west, and its side streets, alleys and lanes lead on
// to the streets north and south.
//
// The instinct walks with you (instinct(), once a second): where a lane leads, where to cross, what
// T would do here (what's at hand, the engine's: sim/acts.js affordance()), and between those a lesson
// or two.
import { townOf } from '../cities/index.js';
import { at, TICK_MS, hourOfDay } from '../clock.js';
import { handler, seedFrom } from '../people.js';
import { heatKey } from '../heat.js';
import { say } from '../log.js';
import { Z, streetName, parkName, inLane, mouthOf } from '../map/street.js';
import { sectionAt } from '../world.js';
import { act, crossingNear, paneNear, benchNear, say1 } from '../acts.js';
import { openAir } from '../perception.js';
import { atKerb } from '../taxi.js';

const TPS = 1000 / TICK_MS;

export const walk = {
  name: 'Free walk',
  again: { another: ['Another walk', 'A new street, new people, new dice.'], same: ['The same walk again', 'The same streets and the same people; the dice fall as you play.'] },
  about: 'A boulevard in central Moscow, a November afternoon. Walk, look, get the feel of it; the lanes lead on north and south. The sun sets at ten to five.',
  setup(state, { city = null } = {}) {
    const r = state.rng, C = CITY_WORDS[city] ?? null;
    state.time.ms = at(2026, 11, 2, 15, 40);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.heat[heatKey('embassy', state.country)] = 20;           // official cover starts warm
    const me = handler(r);
    if (C) Object.assign(me.langs, C.langs);                      // (posted there: the language learnt)
    state.people[me.id] = me;
    state.player = me.id;
    state.map = { kind: 'street', seed: seedFrom(r), row: 0, i0: null, i1: null, crowd: 1, ...(C ? { city } : {}) };
    state.actors.push({ id: 'a0', who: me.id, seed: null, x: 1.5, z: -2.6, vx: 0, vz: 0, face: 'down', head: Math.PI / 2, gait: 'idle', stride: 0, stuck: 0, ai: null });
    state.scenario.prompt = null;
    state.scenario.rest = true;                                    // (the time's yours: H can rest the hours away, sim/aid.js)
    say(state, null, { kind: 'note', text: `${me.name}, ${state.legend.name}. An afternoon off, in theory. ${C?.hello ?? 'Moscow in November: the light is already going.'}` });
  },

  act(state, bus, action) {
    const me = state.actors.find(a => a.who === state.player), p = state.scenario.prompt;
    if (action !== 'instinct' || !me) return;
    if (p?.act) act(state, bus, me, p.act);
    else say(state, bus, { kind: 'instinct', text: me.busy || me.glass ? 'You\'re at it. Moving stops it.' : 'Nothing to do here but look.' });
  },

  tick(state) {
    if (state.tick % TPS !== 0) return;
    const me = state.actors.find(a => a.who === state.player);
    if (!me) return;
    const p = instinct(state, me), q = state.scenario.prompt;      // (nothing to say: nothing said, and the line shows only what's at hand)
    if (!p) state.scenario.prompt = null;
    else if (!q || q.id !== p.id || q.text !== p.text) state.scenario.prompt = { ...p, ms: state.time.ms };
  },
};


/** The walk's instinct: { id, text, tone, act }. */
function instinct(state, me) {
  const L = (id, text, act = null, tone = 'calm') => ({ id, tone, text: Array.isArray(text) ? say1(state, id, text) : text, act });
  const S = sectionAt(state, me.x), seed = townOf(state.map), row = state.map.row ?? 0, C = CITY_WORDS[state.map.city] ?? null;
  if (!S) return null;
  if (me.glass) return L('glass', ['In the glass, the street behind you, all but the middle of it: that\'s your own back.', 'Straight in, the glass shows the road behind you. Hold {watch} and slant your eyes along it: the pavement behind.',
    'A shop window is a mirror with goods in it. Nobody minds anyone looking at the goods.']);
  if (me.busy) return L('busy', { window: 'To the shop window.', bench: 'A bench is a good seat for the street. Moving gets you up.',
    lace: 'A shoelace: ten seconds to look back along the street, for free.', cross: 'Over you go.', pickup: 'Picking it up.',
    pressure: 'Your hand hard on the wound. Hold still: moving lets go.', dress: 'Binding it.', tourniquet: 'The belt, tight.', splint: 'Splinting it: it takes a while.' }[me.busy.what] ?? 'Busy with it: moving stops it.');
  const side = (g) => ((g.x0 + g.x1) / 2 < me.x ? 'on your left' : 'on your right');
  const inside = (g) => me.x > g.x0 && me.x < g.x1;
  // In a lane north, or one south.
  if (me.z < Z.front) {
    const g = S.gapsN.find(gp => inLane(gp, me.x, me.z));
    if (g) return L('lane-n', `${g.name}.${g.jog ? ' It turns, behind the houses.' : ''} At the top, ${streetName(seed, row - 1)}.`);
    const c = S.courts?.find(c => me.x > c.x0 - 0.2 && me.x < c.x1 + 0.2), q = S.squares?.find(q => me.x > q.x0 && me.x < q.x1);
    if (c) return L('court', `${c.name}. It goes nowhere: a door at the end, and whoever's behind you knows it.`);
    if (q) return L('square', `${q.name}, set back off the street. Open ground: you see who comes in, and they see you.`);
  }
  if (me.z > Z.south) { const g = S.gapsS.find(inside); if (g) return L('lane-s', `${g.name}. It goes on south to ${streetName(seed, row + 1)}.`); }
  // A crossing at hand.
  const cr = crossingNear(state, me, 4);
  if (cr?.road === 'main') return L('cross', me.z < Z.kerbN ? `A zebra, for the ${S.band === 'park' ? 'park' : 'boulevard'}.` : 'A zebra, back to the shops.');
  if (cr?.road === 'far') {
    const g = S.gapsS[0];
    return L('cross-far', me.z < Z.roadN ? `The far road${g ? `: ${g.name} goes on south from the far pavement` : ''}.` : 'The far road, back to the boulevard.');
  }
  // A way north or south close by.
  const gn = me.z < Z.kerbN && S.gapsN.find(g => Math.abs((mouthOf(g).x0 + mouthOf(g).x1) / 2 - me.x) < 8);
  if (gn) return L('gap-n', `${gn.name}, ${side(gn)}: up it to ${streetName(seed, row - 1)}.`);
  const gs = me.z > Z.roadS - 0.5 && S.gapsS.find(g => Math.abs((g.x0 + g.x1) / 2 - me.x) < 8);
  if (gs) return L('gap-s', `${gs.name}, ${side(gs)}: down it to ${streetName(seed, row + 1)}.`);
  // Something here: what to make of it (T, what's at hand, is the engine's).
  if (atKerb(state, me)) return L('kerb', 'The kerb: taxis stop for a raised hand.');
  if (paneNear(state, me)) return L('window', 'A shop window: its glass shows the street behind you.');
  if (benchNear(state, me) !== null) return L('bench', 'A bench: a seat for watching the boulevard go by.');
  const f = S.park?.feature;
  if (f && Math.hypot((f.x0 + f.x1) / 2 - me.x, (f.z0 + f.z1) / 2 - me.z) < 9) {
    return L('park', { pond: `${cap(parkName(seed, row, S.i))}'s pond. Ducks, an old man with bread, and a view of every path.`, fountain: 'A fountain, off for the winter.',
      monument: 'A bronze somebody on a plinth. Every square has one; nobody looks at it, which makes it a fine place to wait.', kiosk: 'A kiosk. Coffee, papers, cigarettes, and a man who sees everyone who passes.',
      beds: 'Flower beds, put to bed for the winter.', ...(C?.park ?? {}) }[f.kind]);
  }
  return null;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// The walk's words in the other cities: the line it opens with, the languages a Handler posted there
// has, what the park's things are in that climate.
const CITY_WORDS = {
  london: { hello: 'London in November: the light is going, and the rain hasn\'t made up its mind.', langs: {} },
  beirut: { hello: 'Beirut in November: the heat\'s gone out of the day, and the generators are clearing their throats.', langs: { ar: 'working', fr: 'working' },
    park: { fountain: 'A fountain, running. Pigeons, a man with a coffee, and every path in view.', beds: 'Flower beds, bright in November.' } },
  cairo: { hello: 'Cairo in November: the dust settles at dusk, and the horns never do.', langs: { ar: 'working' },
    park: { fountain: 'A fountain, running. Pigeons, a man with a tea, and every path in view.', beds: 'Flower beds, bright in November.' } },
};
