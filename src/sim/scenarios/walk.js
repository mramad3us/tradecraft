// TRADECRAFT sim: the free walk. The skeleton on show: a Handler from the US embassy on a Moscow
// boulevard, a November afternoon, the street's people about their business, the light going with
// the clock. Nothing to do but walk, look and get the feel; the mechanic tests come next.
import { at } from '../clock.js';
import { handler, seedFrom } from '../people.js';
import { heatKey } from '../heat.js';
import { say } from '../log.js';

export const walk = {
  name: 'Free walk',
  about: 'A boulevard in central Moscow, a November afternoon. Walk, look, get the feel of it. The sun sets at ten to five.',
  setup(state) {
    const r = state.rng;
    state.time.ms = at(2026, 11, 2, 15, 40);
    state.legend = { id: 'embassy', name: 'Second Secretary, US Embassy', cover: 'official', floor: 20 };
    state.heat[heatKey('embassy', 'ru')] = 20;                   // official cover starts warm
    const me = handler(r);
    state.people[me.id] = me;
    state.player = me.id;
    state.map = { kind: 'street', seed: seedFrom(r), i0: -2, i1: 2, crowd: 1 };
    state.actors.push({ id: 'a0', who: me.id, seed: null, x: 1.5, z: -2.6, vx: 0, vz: 0, face: 'down', gait: 'idle', stride: 0, stuck: 0, ai: null });
    say(state, null, { kind: 'note', text: `${me.name}, ${state.legend.name}. An afternoon off, in theory. Moscow in November: the light is already going.` });
  },
};
