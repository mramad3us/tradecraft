// TRADECRAFT sim: lesson 8 of the tutorial, at the range (sim/scenarios/range.js; the user, 2026-11-04: "a firearms
// training lesson"). Hale's at your shoulder tonight, not in your ear: his lines in the same box, said beside you
// (via). The club's gun from the desk, checked clear at the line; its magazines filled at the bench and one in; a
// group of five at 7 m; a reload, before it runs dry, into the magazine Hale's been at: a dummy round in it, a few
// down (sim/scenarios/range.js slipDummy()), which clicks, and the drill (tap, rack, back on the paper); then 15 m and
// 25 m; and the gun unloaded, shown clear and handed back. Range safety is the scene's, and it stops the lesson
// (sim/scenarios/range.js safety()); the groups are scored (sim/paper.js group()) and said in his debrief.
import { secs, aside } from './common.js';
import { gunOf, groupAt, inBooth, isClear, slipDummy, rangeOf } from '../scenarios/range.js';
import { groupWords } from '../paper.js';
import { DISTANCES_M } from '../interiors/range.js';
import { MODELS } from '../firearms.js';

const meOf = (s) => s.actors.find(a => a.who === s.player);
const gun = (s) => gunOf(s);
const done = (s, m) => !!groupAt(s, m)?.done;
const allDone = (s) => DISTANCES_M.every(m => done(s, m));
const rifle = (s) => MODELS[rangeOf(s).gun].kind === 'rifle';
const short = (s) => MODELS[rangeOf(s).gun].short;
// (what a slide's called on this gun, and its safety, in Hale's words)
const rackWord = (s) => (rifle(s) ? 'work the bolt' : 'rack it');
const safetyWord = (s) => { const M = MODELS[rangeOf(s).gun]; return M.safety === 'manual' ? 'Safety stays on till you\'re on the paper.' : 'No safety on that one: your finger\'s the safety. Off the trigger, along the frame, till you\'re on the paper.'; };
const said7 = (s) => { const g = groupAt(s, 7); return `"${groupWords(g)}. ${remark(g)} Now a reload, before it runs dry: the magazine out, the other one in. And I've been at your other magazine while you were busy."`; };
const remark = (g) => (g.score >= 45 ? 'That\'s a group.' : g.score >= 35 ? 'Respectable.' : g.score >= 20 ? 'Something to work on.' : 'Mostly the trap, that.');

export const rangeLesson = {
  id: 'range', title: 'At the range', scenario: 'range', via: 'beside you',
  about: 'The club\'s gun from the desk, paper at 7, 15 and 25 m, a stoppage of Hale\'s making, range safety. Hale at your shoulder.',
  intro: (state) => [
    `Lesson eight. Not the street tonight: ${rangeOf(state).place}, a door off it, and Hale at your shoulder rather than in your ear. Whatever else you are, you're someone who may one day have to use a gun, and he wants to see what your hands do with one when nobody's shooting back.`,
  ],
  steps: [
    { id: 'clear', text: 'The club\'s gun from the desk, checked clear at the line', done: (s) => s.scenario.checked,
      said: '"Clear. Never take anyone\'s word for that, mine included. You look."' },
    { id: 'loaded', text: 'Both magazines filled at the bench; one in, a round chambered', done: (s) => s.scenario.filled && s.scenario.loaded,
      said: (s) => `"Loaded. ${safetyWord(s)}"` },
    { id: 'seven', text: 'A group of five at the 7 m paper', done: (s) => done(s, 7), said: said7 },
    { id: 'reload', text: 'A reload: the magazine out, the other one in', done: (s) => s.scenario.reloads >= 1,
      said: '"Good: the old one out, the fresh one in, eyes on the paper the whole time."' },
    { id: 'stoppage', text: 'A stoppage cleared: tap, rack, back on the paper', done: (s) => s.scenario.cleared >= 1,
      said: '"That\'s the drill. Tap, rack, back on target: it\'s cleared more stoppages than all the gunsmiths in Virginia."' },
    { id: 'fifteen', text: 'Five at the 15 m paper', done: (s) => done(s, 15), said: (s) => `"${groupWords(groupAt(s, 15))}. ${remark(groupAt(s, 15))}"` },
    { id: 'twentyfive', text: 'Five at the 25 m paper', done: (s) => done(s, 25), said: (s) => `"${groupWords(groupAt(s, 25))}. ${remark(groupAt(s, 25))} That's the shooting."` },
    { id: 'back', text: 'Unloaded, shown clear, handed back at the desk', done: (s) => s.scenario.back,
      said: '"Handed back clear. That\'s the evening."' },
  ],
  /** Once a second: the dummy round slipped in once the first group's done; the gun shown clear after the shooting. */
  tick(state, m) {
    const sc = state.scenario, G = gun(state);
    if (!G?.g) return;
    if (!m.dummy && !sc.dummy && done(state, 7)) m.dummy = slipDummy(state);
    if (allDone(state) && isClear(G.g) && state.people[state.player].hand === G.id) m.shown = true;
    if (G.g.locked || (G.g.mag && G.g.chamber === null && !(state.people[state.player].arms?.[G.g.mag]?.n))) m.empty = (m.empty ?? 0) + 1; else m.empty = 0;
  },
  beats: [
    { id: 'hello', when: (s) => secs(s) >= 1, say: '"Hale. Good: you found it. No earpiece tonight, I\'m right here. The desk first: sign for the club\'s gun, {instinct}."' },
    { id: 'desk', every: 45, when: (s) => !s.scenario.gun && secs(s) >= 20, keep: (s) => !s.scenario.gun, say: '"The desk. They don\'t bite. {instinct} there."' },
    { id: 'carry', when: (s) => s.scenario.gun && !inBooth(s, meOf(s)), keep: (s) => !s.scenario.checked && !inBooth(s, meOf(s)), say: (s) => `"Lane three. Carry it as it came to you: in your pocket${rifle(s) ? ', on your shoulder' : ''}, not your hand. It comes out at the line, and nowhere else."` },
    { id: 'booth', when: (s) => s.scenario.gun && inBooth(s, meOf(s)) && !s.scenario.checked, keep: (s) => !s.scenario.checked, say: '"At the line. Draw it, {aim}, and check it: the chamber, the magazine well. The muzzle downrange the whole time, at the paper or the floor in front of it. Never back up the range: I\'m standing here."' },
    { id: 'unchecked', now: true, when: (s) => s.scenario.loaded && !s.scenario.checked, say: '"You loaded it before you looked in it. Never again: you check it first, every time you pick one up."' },
    { id: 'bench', when: (s) => s.scenario.checked && !s.scenario.filled, keep: (s) => !s.scenario.filled, say: '"Now the magazines. Out of the moment, {aim}, the gun in your hand still pointed downrange; then the bench, {instinct}: thumb the rounds into both. One\'s to shoot, the other\'s the reload."' },
    { id: 'load', when: (s) => s.scenario.filled && !s.scenario.loaded, keep: (s) => !s.scenario.loaded, say: (s) => `"Back to it, {aim}: a magazine in, then ${rackWord(s)}. ${safetyWord(s)}"` },
    { id: 'seven', when: (s) => s.scenario.loaded && !groupAt(s, 7)?.shots, keep: (s) => !groupAt(s, 7)?.shots, say: (s) => `"The seven-metre paper. The mouse on it: a click aims, another fires. ${MODELS[rangeOf(s).gun].safety === 'manual' ? 'Safety off once you\'re on it. ' : ''}Five rounds, and not quick: the same thing five times."` },
    { id: 'first', when: (s) => groupAt(s, 7)?.shots >= 1 && !done(s, 7), keep: (s) => !done(s, 7), say: (s) => `"Front sight, trigger straight back, and hold it there after.${rifle(s) ? ' Then the bolt.' : ''}"` },
    { id: 'click', now: true, when: (s) => s.scenario.clicked, say: (s) => `"Click. That was my dummy round: a stoppage. Tap the magazine, ${rackWord(s)}, back on the paper: it's on the panel. That drill's saved more lives than body armour."` },
    { id: 'fifteen', when: (s) => done(s, 7) && s.scenario.reloads >= 1 && !groupAt(s, 15)?.shots, keep: (s) => !groupAt(s, 15)?.shots, say: '"The fifteen. Same again: further is harder, so don\'t hurry it. Pick it with the mouse."' },
    { id: 'twentyfive', when: (s) => done(s, 15) && !groupAt(s, 25)?.shots, keep: (s) => !groupAt(s, 25)?.shots, say: (s) => `"Twenty-five. ${rifle(s) ? 'A rifle\'s easy distance, and a small bull: it\'s the precision that\'s hard.' : 'A long way with a pistol: most people miss the paper at this.'} Breathe out, and press."` },
    { id: 'empty', every: 40, now: true, when: (s, m) => (m.empty ?? 0) >= 1 && !allDone(s), keep: (s, m) => (m.empty ?? 0) >= 1, say: (s) => `"Empty. That's why you count. The bench, {instinct}, fill it; a magazine in, ${rackWord(s)}."` },
    { id: 'unload', when: (s) => allDone(s) && !isClear(gun(s)?.g), keep: (s) => !isClear(gun(s)?.g) && !s.scenario.back, say: (s) => `"Unload. The magazine out, then ${rackWord(s)} to empty the chamber, and show me."` },
    { id: 'shown', when: (s, m) => m.shown, keep: (s) => !s.scenario.back, say: '"Clear. Holster it, {aim} then Put it away, and back to the desk with it."' },
    aside('range', 150),
  ],
  debrief(state) {
    const sc = state.scenario, out = [];
    if (sc.stop) out.push({
      uprange: '"You let the muzzle come back up the range. On a real range that\'s you off it, for good. Downrange, always: it\'s the one rule that\'s never wrong."',
      person: '"You pointed it at a man. Loaded or not, you never do that, not once, not for a second. Everything else tonight, we can work on."',
      lane: '"Someone else\'s lane. On the night, the lane next to yours has someone standing in it."',
      discharge: '"A round went off without you. That\'s the finger on the trigger when it shouldn\'t be. Along the frame, till you\'re on the paper."',
      walk: '"You walked about with it out. A gun comes out at the line, and nowhere else."',
    }[sc.stop.why] ?? '"Stopped."');
    for (const m of DISTANCES_M) { const g = groupAt(state, m); if (g?.shots) out.push(`"At ${m} metres: ${groupWords(g)}${g.done ? '' : ', of the five I asked for'}. ${remark(g)}"`); }
    if (sc.cleared) out.push('"The stoppage: cleared, and back on the paper. That\'s the drill that keeps you alive when the gun lets you down."');
    else if (sc.dummy) out.push('"My dummy round never came up. Next time."');
    if (!sc.stop && sc.outcome === 'done') out.push('"Handed back clear, everything in its place. You\'ll do."');
    if (!sc.stop && (sc.warnings ?? 0) === 0 && sc.rounds) out.push('"And not one word from me about the muzzle all evening. That\'s rarer than it should be."');
    if (!out.length) out.push('"That\'ll do for tonight."');
    return out;
  },
};
