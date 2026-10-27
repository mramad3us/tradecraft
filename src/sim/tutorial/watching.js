// TRADECRAFT sim: lesson 3 of the tutorial, watching and photographing (sim/scenarios/watch.js). Two of
// ours play Volkov and his contact at a café; Ruiz plays the FSB minder across the road. Where to wait,
// what the minder looks for, and the photograph.
import { me, actorWho, secs, sees, busyAtSomething } from './common.js';

export const watching = {
  id: 'watching', title: 'Watching and photographing', scenario: 'watch',
  about: 'Wait for a meeting at a café, unseen by the man watching for watchers, and photograph it. Hale in your ear.',
  intro: () => [
    'Lesson three. Two of ours play Volkov and the man he meets at a café; Ruiz plays the FSB minder, across the road from it, looking at faces. You\'ve a camera. A photograph of the two of them together is what the station would want; Ruiz not noticing you is what you want. Hale\'s in your ear.',
  ],
  steps: [
    { id: 'spot', text: 'Wait somewhere you\'d have a reason to be', done: (s, m) => m.spotS >= 20,
      said: '"Good place. A man with a reason to be somewhere is invisible."' },
    { id: 'see', text: 'See them meet', done: (s) => s.scenario.witnessed || s.scenario.phase === 'meet' && sees(s, actorWho(s, 'volkov')) && sees(s, actorWho(s, 'contact')) },
    { id: 'photo', text: 'Photograph the two of them together ({camera})', done: (s) => !!s.scenario.photo,
      said: '"Got it. Now put the camera away."' },
    { id: 'unseen', text: 'Never give the minder a reason to look at you', done: (s) => s.scenario.outcome && !s.scenario.made },
  ],
  tick(state, m) {
    const p = me(state), sc = state.scenario;
    if (busyAtSomething(p) && !sc.made) m.spotS = (m.spotS ?? 0) + 1;
  },
  beats: [
    { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. Same rules. Tonight you watch, and you don\'t get watched doing it."' },
    { id: 'minder', when: (s) => secs(s) >= 8, say: '"See the café on the brief? Across the road from it, Ruiz isn\'t waiting for anyone. He\'s looking at faces. Anyone standing about near that café, anyone staring at it, anyone with a camera up: that\'s who he\'s there for."' },
    { id: 'where', when: (s) => secs(s) >= 22, say: '"So find somewhere you\'d be anyway, with the café in sight: a shop window across the way, a kiosk, a café\'s window table. {instinct} when you\'re at one."' },
    { id: 'loiter', now: true, every: 40, when: (s) => s.scenario.loiterS >= 25 && !s.scenario.made, say: '"You\'ve been standing about. Ruiz will have noticed a man with nowhere to be. Find a reason to be there."' },
    { id: 'stare', now: true, every: 30, when: (s) => s.scenario.stareS >= 2 && !s.scenario.made, say: '"Don\'t stare at the café. Look at it the way you\'d look at anything: then at something else."' },
    { id: 'coming', now: true, when: (s) => s.scenario.phase === 'walk' && sees(s, actorWho(s, 'volkov')), say: '"There\'s Volkov: glasses, dark coat, briefcase. Let him get there. Don\'t move to meet him."' },
    { id: 'together', now: true, when: (s) => s.scenario.phase === 'meet', say: '"They\'re together. Both of them in your sight, then {camera}. Not where Ruiz can see you lift it."' },
    { id: 'made', now: true, when: (s) => s.scenario.made, say: '"Ruiz made you. Words into his collar, and now watch: they\'ll walk past each other like strangers."' },
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    out.push({ photo: '"A sharp picture, both faces. The station would hang it on the wall, if the station hung things on walls."', soft: '"A soft picture. You can tell who it is if you already know."',
      seen: '"You saw them meet; no picture. Something, not much."', missed: '"You missed it."', blown: '"Ruiz made you, and the meeting didn\'t happen. A minder who\'s made you is worse than no picture: they know we\'re interested."' }[sc.outcome] ?? '"That\'ll do."');
    out.push(sc.made ? '"He made you. Ask yourself what he saw: a man standing about, a man staring, a camera up."' : '"Ruiz never looked at you twice. That\'s the lesson."');
    return out;
  },
};
