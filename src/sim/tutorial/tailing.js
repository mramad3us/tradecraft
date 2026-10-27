// TRADECRAFT sim: lesson 1 of the tutorial, tailing (the tail: sim/scenarios/tail.js). Lisowski, from the
// political section, plays Orlov; Hale's in your ear. At dusk (good light to learn in), and Orlov calm.
// What it teaches, step by step: picking him out, the gap, being busy when he looks, the glass, the
// meeting; and on the way, his tells, a sighting, the grey coats, a shop, a lane, the other pavement.
import { Z } from '../map/street.js';
import { rowOf } from '../agents.js';
import { me, actorId, gap, secs, sees, busyAtSomething } from './common.js';

const him = (state) => actorId(state, state.scenario.target);

export const tailing = {
  id: 'tailing', title: 'Tailing a man', scenario: 'tail', options: { evening: 'dusk' },
  about: 'Follow a man to a meeting without his seeing you twice. Hale in your ear, a colleague playing the man.',
  intro: () => [
    'Your first month at the station. Hale, who taught you hand to hand at the Farm, runs its training now, and tonight he runs you: an earpiece in your ear, him on the radio from a car somewhere about. Lisowski, from the political section, plays the man you follow; another of ours plays whoever he meets. It\'s an exercise. The brief\'s written as if it weren\'t, because that\'s how they\'ll come.',
  ],
  steps: [
    { id: 'pick', text: 'Pick him out as he leaves', done: (s) => s.scenario.markGone && s.scenario.marked === s.scenario.target,
      said: '"Marker\'s off and you\'ve still got him. That\'s the first thing done."' },
    { id: 'gap', text: 'Hang back 15–30 m, a minute in all', done: (s, m) => m.gapS >= 60,
      said: '"That\'s the distance. Close enough to keep him, far enough that he\'d have to look for you."' },
    { id: 'cover', text: 'Be busy at something when he looks back', done: (s, m) => m.coverPass >= 1,
      said: '"He looked, and you were a man looking at shoes. That\'s the whole trick."' },
    { id: 'glass', text: 'Keep him in a shop window\'s glass', done: (s, m) => m.glassS >= 4,
      said: '"Good. The glass shows you the street and shows him your back. Use it."' },
    { id: 'meet', text: 'See whom he meets', done: (s) => s.scenario.outcome === 'seen' },
  ],
  /** Once a second: the seconds at the right distance; his checks, and whether you were busy for them; the glass. */
  tick(state, m) {
    const sc = state.scenario, p = me(state), t = him(state), d = gap(state, p, t);
    if (sc.marked === sc.target && sees(state, t) && d >= 15 && d <= 30) m.gapS = (m.gapS ?? 0) + 1;
    if (p?.glass && sees(state, t)) m.glassS = (m.glassS ?? 0) + 1;
    if (sc.scan && !m.scan) m.scan = { n: sc.sightings.length, cover: false };
    if (m.scan && busyAtSomething(p)) m.scan.cover = true;
    if (!sc.scan && m.scan) { if (sc.sightings.length === m.scan.n && m.scan.cover) m.coverPass = (m.coverPass ?? 0) + 1; m.scan = null; }
  },
  beats: [
    { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. You hear me? Don\'t touch your ear: a hand to the ear is the oldest giveaway there is. You don\'t answer. You just do it."' },
    { id: 'who', when: (s) => secs(s) >= 7 && !s.scenario.markGone, say: '"Lisowski\'s coming out now, under my marker: grey coat, grey fedora, briefcase. Let him get twenty metres on before you go."' },
    { id: 'wrong', now: true, when: (s) => s.scenario.marked && s.scenario.marked !== s.scenario.target, say: '"That\'s not him. I can see you both from here. Look for the briefcase."' },
    { id: 'tell', now: true, when: (s) => s.scenario.tell?.read && s.scenario.tell.kind !== 'cross',
      say: '"See him slow? That\'s a tell: he\'s going to look back. When he does, be doing something: a shop window, {instinct}. Not stopping dead, not staring."' },
    { id: 'seen-once', now: true, when: (s) => s.scenario.sightings.length === 1,
      say: '"He saw you. Once is nothing: Moscow\'s a small town. Twice and he\'s made you, and we all go home. Drop back, cross over, put people between you."' },
    { id: 'markgone', when: (s) => s.scenario.markGone, say: '"Marker\'s off. From now he\'s what you know of him: the fedora, the briefcase, the walk. Moscow\'s full of grey coats; that\'s what they\'re for."' },
    { id: 'close', every: 45, when: (s) => { const d = gap(s, me(s), him(s)); return secs(s) > 25 && d < 12 && !s.scenario.scan; },
      say: '"Easy: you\'re on his heels. Fifteen metres at the least. If you\'re catching him up, hold {slow} and stroll."' },
    { id: 'far', every: 45, when: (s) => { const d = gap(s, me(s), him(s)); return s.scenario.marked === s.scenario.target && d > 34 && d < 1e6; },
      say: '"You\'re letting him go. Past thirty-five metres, one corner and he\'s gone. Close up."' },
    { id: 'twin', when: (s) => { const t = him(s); return s.scenario.twins.some(id => { const o = actorId(s, id); return o && sees(s, o) && gap(s, o, t) < 8; }); },
      say: '"Two grey coats now. Only one has the briefcase. Not sure which? Hold {watch} on him a moment: a close look."' },
    { id: 'unseen', every: 30, when: (s) => s.scenario.unseenS >= 8 && s.scenario.unseenS < 60, say: '"Where is he? Get eyes on him. If he\'s turned off, it was a shop or a lane."' },
    { id: 'shop', when: (s) => s.scenario.shop && him(s)?.hidden,
      say: '"He\'s gone into a shop. Don\'t go in after him, and don\'t hang about the door: find a window across the way and wait with the door in the glass. He\'ll come out looking."' },
    { id: 'lane', every: 120, when: (s) => { const t = him(s); return s.scenario.turn?.seen && t && (t.z < Z.front || t.z > Z.south); },
      say: '"He\'s gone up a lane. In there you\'re the only one behind him. Give him the corner, count five, then after him."' },
    { id: 'across', when: (s) => { const p = me(s), t = him(s); return gap(s, p, t) < 30 && (p.z < Z.kerbN) !== (t.z < Z.kerbN) && rowOf(s, p) === rowOf(s, t); },
      say: '"Other side of the road: good. People look behind them; hardly anyone looks across."' },
    { id: 'run', now: true, every: 30, when: (s) => me(s)?.gait === 'run', say: '"Don\'t run. Nobody runs in Moscow in November unless something\'s on fire."' },
    { id: 'meet', now: true, when: (s) => s.scenario.phase === 'meet',
      say: '"He\'s sitting down, and someone\'s coming to him. Get them both in view, twenty metres off, and keep still: hold {watch} and look."' },
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    out.push({ seen: '"You saw the meeting. That\'s the job, all of it: everything else was getting there without being seen."',
      made: `"He made you: twice he saw the same face. ${sc.sightings.length ? 'Next time, further back on the empty stretches, and busy when he looks.' : ''}"`,
      lost: '"You lost him. Close up in a crowd; drop back where it\'s empty. And never let a corner come between you for long."',
      missed: '"You were there, but you never had the two of them together long enough to see it."',
      blown: '"That was a bit close to the other man. He was playing a professional, and a professional notices."',
    }[sc.outcome] ?? '"That\'ll do for tonight."');
    out.push(`"${sc.sightings.length === 0 ? 'He never saw your face.' : sc.sightings.length === 1 ? 'He saw your face once.' : 'He saw your face twice.'} Closest you got: ${Math.round(sc.closest < 1e8 ? sc.closest : 0)} metres.${sc.warned ? ` His checks you saw coming: ${sc.warned}.` : ''}"`);
    return out;
  },
};
