// TRADECRAFT sim: lesson 2 of the tutorial, being tailed (sim/scenarios/sdr.js). You walk to a meeting
// and find out whether you're followed: two of ours playing an overt FSB pair more often than not (you
// can learn to see them), sometimes three playing a proper team, sometimes nobody. Hale knows which, and
// won't say till after; he tells you how to look.
import { me, actorWho, secs, gap } from './common.js';
import { paneNear } from '../acts.js';

const faces = (state) => Object.values(state.scenario.faces ?? {});
const TEAM_WORDS = { none: 'nobody. Ours were in the canteen', overt: 'two of ours, playing an overt pair: close, and not caring if you saw them', covert: 'three of ours, playing a proper team: a hand-over at every corner, and never the same face twice if they could help it' };

export const tailed = {
  id: 'tailed', title: 'Being tailed', scenario: 'sdr', options: { teams: [['overt', 3], ['covert', 1.5], ['none', 1.5]] },
  about: 'Walk to a meeting and find out whether you\'re followed, before you go near him. Hale in your ear.',
  intro: () => [
    'Lesson two, a week on. Tonight it\'s you they follow, maybe: some of ours are out there playing the FSB, or they\'re in the canteen. Finding out which, before you go near the bench, is the lesson. Petrov from the station plays SOLOVEY. Hale\'s in your ear again, and he knows who\'s out tonight. He won\'t tell you.',
  ],
  steps: [
    { id: 'glass', text: 'Check behind you in a shop window', done: (s) => (s.scenario.windows ?? 0) >= 1,
      said: '"That\'s the way: the glass shows you the street, and you\'re a man looking at boots."' },
    { id: 'ways', text: 'Check three different ways (a window, a crossing, a lane\'s mouth, a stop)', done: (s, m) => Object.keys(m.ways ?? {}).length >= 3,
      said: '"Three different checks, three different reasons. Nobody saw a man checking."' },
    { id: 'face', text: 'See a face, and see it again', done: (s) => faces(s).some(f => f.n >= 2),
      said: '"Twice. Now you know something, or near enough."' },
    { id: 'decide', text: 'Meet him clean, or call it off', done: (s) => ['clean', 'right'].includes(s.scenario.outcome) },
  ],
  tick(state, m) {
    const sc = state.scenario;
    if (sc.lastCheck && sc.lastCheck !== 'passive' && sc.lastCheck !== 'glance') (m.ways ??= {})[sc.lastCheck === 'stop' ? 'lane' : sc.lastCheck] = true;
  },
  beats: [
    { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. Same as before: don\'t touch your ear. Tonight you\'re the one being followed. Or not."' },
    { id: 'walk', when: (s) => secs(s) >= 9, say: '"Walk like a diplomat off to buy bread: an hour to kill and nowhere to be. Don\'t look round. People who look round have something behind them."' },
    { id: 'glance', now: true, when: (s) => s.scenario.glances >= 1,
      say: '"That look over your shoulder: if anyone\'s there, they wrote it down. A look behind you wants a reason. A shop window. A crossing. A turn."' },
    { id: 'window', when: (s) => secs(s) > 30 && !(s.scenario.windows) && paneNear(s, me(s)),
      say: '"A shop window. Stand at it, {instinct}, and look at the street behind you in the glass. Who stops when you stop?"' },
    { id: 'glass', when: (s) => !!me(s)?.glass, say: '"Don\'t stare into it. A few seconds, like a man choosing boots. Faces, coats, who\'s in no hurry. Hold {watch} and slant your eyes along it for the pavement."' },
    { id: 'face1', when: (s) => faces(s).some(f => f.n === 1),
      say: '"You\'ve marked a face. Hold on to it. If it turns up again somewhere it has no business being, that\'s not a small town, that\'s a team."' },
    { id: 'face2', now: true, when: (s) => faces(s).some(f => f.n >= 2),
      say: '"There it is again. Lose them where they can\'t see you do it: a lane, a shop with a back door. Or call it off, {instinct}, when your instinct offers it."' },
    { id: 'lane', when: (s) => s.scenario.sinceMap && s.time.ms - s.scenario.sinceMap < 6000,
      say: '"Through a lane, onto another street. Now stop somewhere natural and watch the lane\'s mouth. Whoever comes out after you and stops when you stop: there\'s your answer."' },
    { id: 'cross', when: (s) => s.scenario.onRoad, say: '"Crossing\'s a check anyone makes: you look both ways. Use the look."' },
    { id: 'run', now: true, every: 30, when: (s) => me(s)?.gait === 'run', say: '"Don\'t run. They write that down, and then they know what you are."' },
    { id: 'due', when: (s) => s.time.ms >= s.scenario.meet.from && s.scenario.phase === 'walk' && s.map.row !== s.scenario.meet.row,
      say: '"He\'s on the bench now. Eight minutes, and he goes home. If you\'re sure, go; if you\'re not, find out on the way."' },
    { id: 'bench', when: (s) => { const a = actorWho(s, 'solovey'); return a && s.scenario.phase === 'walk' && gap(s, me(s), a) < 12; },
      say: '"That\'s Petrov on the bench. Sure you\'re clean? Sit down beside him, {instinct}. Not sure? Walk past him: he\'ll understand. That\'s what calling it off looks like."' },
    { id: 'meet', now: true, when: (s) => s.scenario.phase === 'meet', say: '"The weather, the traffic, his wife\'s sister. Twenty seconds. Don\'t look round."' },
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    out.push(`"Tonight it was ${TEAM_WORDS[sc.team] ?? 'nobody'}.${sc.team !== 'none' && sc.teamLost ? ` You lost them${sc.lostHow ? ` ${sc.lostHow}` : ''}.` : ''}"`);
    out.push({ clean: '"You met him, and nobody saw it. That\'s the job."', burned: '"You met him with them watching. In Moscow that\'s SOLOVEY in Lefortovo, and you on a plane."',
      right: '"You called it off, and they were there: right call. He\'ll come back next week."', needless: '"You called it off, and nobody was there. Cautious isn\'t wrong; but he waited for nothing, and an agent who waits for nothing stops coming."',
      missed: '"You never sat down with him. The time came and went."' }[sc.outcome] ?? '"That\'ll do for tonight."');
    if (sc.flags.length) out.push(`"They wrote down ${sc.flags.length === 1 ? 'one thing' : `${sc.flags.length} things`} about you. Each of those is a line in a file with your name on it."`);
    else if (sc.team !== 'none') out.push('"They wrote nothing down. Good."');
    return out;
  },
};
