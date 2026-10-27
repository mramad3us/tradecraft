// TRADECRAFT sim: lesson 6 of the tutorial, blown (sim/scenarios/hunted.js): your cover gone, out of the
// city to a car, with them looking for you. Four of ours play the hunters, with your description.
import { me, secs, around, dark, aside } from './common.js';

export const blown = {
  id: 'blown', title: 'Blown', scenario: 'hunted',
  about: 'The worst night: your cover gone, men with your description, a car waiting a few streets away. Hale in your ear.',
  intro: () => [
    'Lesson six, the one nobody likes. Your cover\'s gone and they\'re looking for you: four of ours play the hunters tonight, with your description and a radio. A car waits a few streets away, not for long. Hale\'s in your ear; on the real night, nobody will be.',
  ],
  steps: [
    { id: 'coat', text: 'Change your coat at a safe house ({instinct} at its door)', done: (s) => s.scenario.disguised, said: '"Another coat: the description doesn\'t fit any more. That\'s worth more than speed."' },
    { id: 'cover', text: 'Keep to people and the dark, a minute in all', done: (s, m) => m.coverS >= 60, said: '"That\'s it: in a crowd, in the dark, you\'re anyone."' },
    { id: 'car', text: 'Reach the car', done: (s) => s.scenario.outcome === 'out' },
  ],
  tick(state, m) {
    const p = me(state);
    if (p && (around(state, p, 4) >= 2 || dark(state, p))) m.coverS = (m.coverS ?? 0) + 1;
  },
  beats: [
    { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. They\'ve got your description, so the coat goes first. There\'s a safe house on the way: in at its door, {instinct}, a minute, and out in another coat."' },
    { id: 'way', when: (s) => secs(s) >= 14, say: '"The car\'s on the brief, and on the edge of your picture. Not the straightest way: the one with people on it, and the dark."' },
    { id: 'looking', when: (s) => s.scenario.hunters.some(id => { const a = s.actors.find(o => o.id === id); return a && (a.row ?? s.map.row) === s.map.row && Math.hypot(a.x - me(s).x, a.z - me(s).z) < 28; }),
      say: '"One of them\'s on this street, looking at faces. Keep walking. People round you, the shadows, and don\'t look at him."' },
    { id: 'known', now: true, when: (s) => Object.keys(s.scenario.known ?? {}).length > 0, say: '"He\'s got you. Don\'t run: lose him. People, a lane, a shop with a back door. Or, if he gets his hands on you, fight."' },
    { id: 'run', now: true, every: 30, when: (s) => me(s)?.gait === 'run', say: '"Don\'t run: a running man is the man they\'re looking for."' },
    { id: 'late', when: (s) => s.scenario.deadline - s.time.ms < 12 * 60000, say: '"Twelve minutes, and the car goes."' },
    aside('blown', 50),
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    out.push({ out: '"You made the car. That\'s the only lesson that counts on that night."', captured: '"They took you. On the real night that\'s a cell, and a long time in it."', stranded: '"The car\'s gone without you. On the real night, you\'d be on your own in a city that wants you."', dead: '"Dead. Don\'t."' }[sc.outcome] ?? '"That\'ll do."');
    out.push(`"${sc.seenBy ? `They knew you ${sc.seenBy === 1 ? 'once' : `${sc.seenBy} times`}.` : 'They never knew you.'}${sc.disguised ? ' The coat helped.' : ' Next time, the coat.'}"`);
    return out;
  },
};
