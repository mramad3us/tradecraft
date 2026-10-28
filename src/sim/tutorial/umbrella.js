// TRADECRAFT sim: lesson 7 of the tutorial, the umbrella (sim/scenarios/tail.js umbrellaTest). Brennan
// plays Kostin and Ruiz his minder; the umbrella's a plain one, and the tip touched to the back of
// Brennan's leg is the whole of it. In the rain, the umbrella's cover.
import { me, actorId, gap, secs, sees, around, aside } from './common.js';

const him = (state) => actorId(state, state.scenario.target);
const atStop = (state) => { const h = state.scenario.hit, p = me(state); return p && state.map.row === h.stop.row && Math.abs(p.x - h.stop.x) < h.stop.w / 2 + 4 && p.z > -3.2 && p.z < -0.3; };

export const umbrella = {
  id: 'umbrella', title: 'The umbrella', scenario: 'umbrella', options: { weather: 'rain', evening: 'rush' },
  about: 'Close enough to touch a man in a crowd, and gone before he turns. Hale in your ear.',
  intro: () => [
    'Lesson seven. We don\'t do this. The Agency teaches it anyway, because one day someone may have to recognise it being done to us, or stop it. Brennan plays Kostin tonight, and Ruiz his minder. Your umbrella\'s a plain one: the tip touched to the back of Brennan\'s leg, and he\'ll know. Hale\'s in your ear.',
  ],
  steps: [
    { id: 'there', text: 'Be at his stop, or with him on the way', done: (s, m) => m.there, said: '"Good. Now the crowd does the work."' },
    { id: 'sure', text: 'Be sure it\'s him: a close look ({watch} held on a grey coat)', done: (s) => (s.scenario.looked?.[s.scenario.target] ?? 0) > 0 },
    { id: 'crowd', text: 'Close in where people are round him', done: (s, m) => m.crowded },
    { id: 'touch', text: 'The umbrella\'s tip, at arm\'s length ({instinct})', done: (s) => s.scenario.hit.done && !s.scenario.hit.done.wrong },
    { id: 'walk', text: 'Walk away: never run', done: (s, m) => s.scenario.outcome === 'done' && !m.ran },
  ],
  tick(state, m) {
    const sc = state.scenario, p = me(state), t = him(state);
    if (atStop(state) || (t && sees(state, t) && gap(state, p, t) < 30)) m.there = true;
    if (t && gap(state, p, t) < 3 && around(state, t, 3) >= 2) m.crowded = true;
    if (sc.hit.done && p?.gait === 'run') m.ran = true;
  },
  beats: [
    { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. Two ways to do this. Follow him from his door, as on the first night. Or go to his stop, it\'s on the brief, and be there first, waiting like everyone else."' },
    { id: 'rain', when: (s) => secs(s) >= 14, say: '"It\'s raining: everyone has an umbrella, and nobody looks twice at yours. On a dry night, it\'s the one thing they\'d remember."' },
    { id: 'stop', when: (s) => atStop(s) && !s.scenario.hit.waiting, say: '"His stop. Wait like the others; sit in the shelter if you like, {use}, and let the buses go. When he comes, pick him out: there are grey coats here too."' },
    { id: 'him', when: (s) => { const t = him(s); return t && sees(s, t) && s.scenario.hit.waiting; }, say: '"That\'s him, waiting, Ruiz a pace off. Close in among the people waiting. Behind him, not in front."' },
    { id: 'eyes', now: true, when: (s) => s.scenario.hit.eyesSeen, say: '"Ruiz is watching you. Drop back, let him forget you, or call it off, {instinct}."' },
    { id: 'doors', now: true, when: (s) => s.scenario.hit.boarding && !s.scenario.hit.done, say: '"The bus. They\'re crowding to the doors: now or never."' },
    { id: 'now', now: true, when: (s) => s.scenario.prompt?.act === 'jab', say: '"Now: {instinct}. A touch, and walk on."' },
    { id: 'away', now: true, when: (s) => s.scenario.hit.done && !s.scenario.hit.chased, say: '"Walk. Don\'t look back. Don\'t hurry."' },
    { id: 'chased', now: true, when: (s) => s.scenario.hit.chased, say: '"Ruiz saw it, and he\'s coming. Lose him: people, a lane, a shop\'s back door. Or put him down."' },
    aside('umbrella', 45),
  ],
  debrief(state) {
    const sc = state.scenario, h = sc.hit, d = h.done, out = [];
    out.push({ done: '"Done, and walked away. Brennan felt a touch on his leg and turned round to a street full of umbrellas."', wrong: `"That wasn't Brennan: ${d?.tell}. On the night, a stranger dies of it. Look, then do it."`,
      taken: '"Ruiz had you on the pavement. On the night, there\'s no getting up from that."', missed: '"He got on his bus."', made: '"Brennan made you on the way. Twice, the same face."', off: '"Called off. No shame in it."' }[sc.outcome] ?? '"That\'ll do."');
    if (d && !d.wrong) out.push(`"${d.face ? 'He turned and saw your face. ' : ''}${d.minder ? 'Ruiz saw your hand. ' : ''}${h.witnesses ? `${h.witnesses === 1 ? 'Someone' : `${h.witnesses} people`} at the stop would remember you. ` : ''}${!d.face && !d.minder && !h.witnesses ? 'Nobody saw a thing.' : 'People round you, the rain, the doors: that\'s what hides a hand.'}"`);
    return out;
  },
};
