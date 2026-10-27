// TRADECRAFT sim: lessons 4 and 5 of the tutorial, the brush pass and the dead drop (sim/scenarios/sdr.js
// brushTest, dropTest): being tailed's evening, with something to hand over at the end of it. Petrov
// plays SOLOVEY; some of ours may be out playing the FSB, as in lesson 2.
import { me, actorWho, gap, secs, still, aside } from './common.js';
import { laneMid } from '../acts.js';

const TEAM_WORDS = { none: 'nobody was out tonight', overt: 'two of ours were on you, playing an overt pair', covert: 'three of ours were on you, playing a proper team' };
const teamLine = (sc) => `"For the record, ${TEAM_WORDS[sc.team] ?? 'nobody was out'}.${sc.team !== 'none' && sc.teamLost ? ' You lost them on the way.' : ''}"`;
const checkBeats = [
  { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. You know the drill: don\'t touch your ear. Some of ours may be on you tonight, as before. Check your back on the way, the way you learnt."' },
  { id: 'glance', now: true, when: (s) => s.scenario.glances >= 1, say: '"No looks over the shoulder. A window, a crossing, a lane\'s mouth."' },
  { id: 'face2', now: true, when: (s) => Object.values(s.scenario.faces ?? {}).some(f => f.n >= 2),
    say: '"That face again. If they\'re on you, nothing changes hands tonight: lose them first, or call it off, {instinct}."' },
  { id: 'run', now: true, every: 30, when: (s) => me(s)?.gait === 'run', say: '"Don\'t run."' },
];
const checkStep = { id: 'checks', text: 'Check your back on the way, twice at least', done: (s) => s.scenario.checks >= 2 };

export const brushPass = {
  id: 'brush', title: 'A brush pass', scenario: 'brush', options: { teams: [['none', 2], ['overt', 2], ['covert', 1]] },
  about: 'A newspaper from his arm to your hand in passing, on a park path, neither of you stopping. Hale in your ear.',
  intro: () => [
    'Lesson four. A brush pass: a second, two people passing, and something changes hands. Petrov plays SOLOVEY; tonight he won\'t sit on a bench. He\'ll come along the park path at the minute with a newspaper under his arm, and walk on. Be there, walking his way, and take it as you pass. Some of ours may be on you, playing the FSB. Hale\'s in your ear.',
  ],
  steps: [
    checkStep,
    { id: 'path', text: 'Be on his path at the minute, walking his way', done: (s, m) => m.onPath, said: '"Good. Now walk, as if he were anyone."' },
    { id: 'pass', text: 'Take the paper as you pass, at arm\'s length ({instinct})', done: (s) => s.scenario.met },
    { id: 'walking', text: 'Without stopping', done: (s, m) => s.scenario.met && !m.stopped },
  ],
  tick(state, m) {
    const sc = state.scenario, p = me(state), sol = actorWho(state, 'solovey');
    if (sol && p && state.map.row === sc.meet.row && Math.abs(p.z - laneMid('path')) < 2 && gap(state, p, sol) < 30) m.onPath = true;
    if (sol && p && gap(state, p, sol) < 2.5 && still(p) && !sc.met) m.stopped = true;
  },
  beats: [
    ...checkBeats,
    { id: 'how', when: (s) => secs(s) >= 30, say: '"How it goes: you\'re on the path, walking toward him, steady. When you\'re at arm\'s length, {instinct}, and the paper\'s yours. Neither of you breaks step. A stop is what anyone watching remembers."' },
    { id: 'coming', now: true, when: (s) => { const a = actorWho(s, 'solovey'); return a && gap(s, me(s), a) < 25; }, say: '"There he is, paper under his arm. Walk to meet him. Pass close."' },
    { id: 'stopped', now: true, when: (s, m) => m.stopped, say: '"Don\'t stop. Keep walking."' },
    aside('brush', 90),
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    out.push({ clean: '"A second, and nobody saw it. That\'s a brush pass."', burned: '"They saw it change hands. In Moscow that\'s the end of SOLOVEY."', missed: '"He walked past you with it still under his arm."', right: '"Called off, and they were there: right."', needless: '"Called off, and nobody there. Careful costs something too."' }[sc.outcome] ?? '"That\'ll do."');
    out.push(teamLine(sc));
    return out;
  },
};

export const deadDrop = {
  id: 'drop', title: 'A dead drop', scenario: 'drop', options: { teams: [['none', 2], ['overt', 2], ['covert', 1]] },
  about: 'A tin behind a bench\'s leg, a chalk mark on a lamppost to say it\'s there. Hale in your ear.',
  intro: () => [
    'Lesson five. A dead drop: nobody to meet. A tin goes behind the leg of a bench in the park, and a chalk mark on a lamppost along the path tells SOLOVEY it\'s there to collect. The risk is only who sees you stoop. Some of ours may be on you, playing the FSB. Hale\'s in your ear.',
  ],
  steps: [
    checkStep,
    { id: 'load', text: 'Load the drop: the bench\'s leg ({instinct}, six seconds)', done: (s) => s.scenario.drop?.loaded, said: '"Loaded. Now the signal, or he\'ll never know."' },
    { id: 'mark', text: 'Chalk the lamppost ({instinct})', done: (s) => s.scenario.drop?.marked },
    { id: 'clean', text: 'Nobody sees you at it', done: (s) => s.scenario.outcome === 'clean' },
  ],
  beats: [
    ...checkBeats,
    { id: 'how', when: (s) => secs(s) >= 30, say: '"How it goes: at the bench, {instinct}: you sit on its end, retie a shoelace, and the tin goes behind the leg. Six seconds. Then the lamppost along the path: a line of chalk at waist height, two seconds, and walk on."' },
    { id: 'bench', when: (s) => { const d = s.scenario.drop, p = me(s); return d && !d.loaded && s.map.row === d.site.row && Math.abs(p.x - d.site.x) < 15; }, say: '"That\'s the bench. Before you stoop: anyone about who\'s been about before?"' },
    { id: 'doing', when: (s) => s.scenario.drop?.doing?.what === 'load', say: '"Easy. Don\'t look round while you\'re at it."' },
    aside('drop', 90),
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    out.push({ clean: '"Loaded, signalled, and nobody the wiser."', burned: '"They saw you load it. They\'ll sit on that bench now, and take whoever comes for the tin."', missed: '"It isn\'t done: a drop without its signal is a tin behind a bench."', right: '"Called off with them on you: right."', needless: '"Called off with nobody there. Careful costs something too."' }[sc.outcome] ?? '"That\'ll do."');
    out.push(teamLine(sc));
    return out;
  },
};
