// TRADECRAFT sim: talking to someone (F, Talk: sim/interact.js), the engine's. Time stands still while
// you talk, as it does while a fight waits for a move (the user, 2026-10-26: "talk should pause the
// game, like combat, we will find a KLM style minigame for at least some conversations").
//
// state.talk: { who, round, said: [{ ours, theirs }] }. Each choice (CHOICES: ask the time, the way,
// small talk; leave) gets a line of ours and theirs; theirs by how they feel about us (their gauges,
// sim/people.js: afraid, cold, as anyone would, warm: mood()), and a stranger who's been hit by us is
// afraid (sim/interact.js nudges their fear). Conversation proper (approaches, gauges moved, hooks,
// leads: DESIGN.md) is mechanic test 4; its minigame slots in here.
import { hash } from './rng.js';
import { calendar } from './clock.js';
import { say } from './log.js';
import { nudge } from './people.js';
import { shortName } from './fight.js';

export const CHOICES = [
  { id: 'time', label: 'Ask the time' },
  { id: 'way', label: 'Ask the way' },
  { id: 'chat', label: 'Small talk' },
  { id: 'leave', label: 'Leave it there' },
];
const OURS = {
  time: ['You ask the time.', 'You ask if they have the time.'],
  way: ['You ask the way to the metro.', 'You ask where the nearest pharmacy is.', 'You ask for the post office.'],
  chat: ['You say something about the weather.', 'You nod at the sky: snow by tonight, you\'d say.', 'You say the traffic\'s worse every year.'],
};
const THEIRS = {
  afraid: ['They flinch, and step back.', '"Leave me alone," and they\'re already walking.', 'They look at your hands, not your face, and say nothing.'],
  cold: ['A look, and nothing more.', '"Ask someone else."', 'They turn half away.'],
  neutral: { time: ['"{time}."', '"{time}," with a glance at the wrist.', '"No watch, sorry."'], way: ['"Second left, then straight on."', '"Down there, past the bank."', 'A shrug: they don\'t know.'],
    chat: ['"Always is," and a half smile.', '"We\'ll see," noncommittal.', 'A grunt that could mean anything.'] },
  warm: { time: ['"{time}. Late for something?"'], way: ['"I\'ll show you, I\'m going that way."'], chat: ['"Don\'t I know it." They seem glad of the word.'] },
};

/** How they feel about us, for what they say. */
export function mood(p) {
  const g = p?.gauges ?? { fear: 0, trust: 0, affinity: 0 };
  return g.fear >= 3 ? 'afraid' : g.affinity <= -2 ? 'cold' : g.affinity + g.trust >= 3 ? 'warm' : 'neutral';
}

/** Start talking to actor `them` (who: a sheet). */
export function begin(state, bus, them) {
  state.talk = { who: them.who, id: them.id, round: 0, said: [] };
  const p = state.people[them.who];
  if (mood(p) === 'afraid') { say(state, bus, { kind: 'note', text: `${cap(shortName(state, them.who))} backs away from you.` }); }
}

/** A choice: ours, theirs; 'leave' ends it. */
export function choose(state, bus, id) {
  const t = state.talk;
  if (!t) return;
  if (id === 'leave') { state.talk = null; return; }
  const p = state.people[t.who], m = mood(p), k = hash(t.round, t.who.length, state.tick);
  const ours = OURS[id]?.[k % OURS[id].length] ?? '';
  const pool = Array.isArray(THEIRS[m]) ? THEIRS[m] : THEIRS[m][id] ?? THEIRS.neutral[id];
  const theirs = pool[(k >>> 4) % pool.length].replace('{time}', spoken(state.time.ms));   // (the time they tell is the watch's)
  t.said.push({ ours, theirs });
  t.round++;
  if (p) nudge(p, 'affinity', 0, state.time.ms);                    // (contact: their gauges' drift starts again)
  say(state, bus, { kind: 'note', text: `${ours} ${cap(shortName(state, t.who))}: ${theirs}` });
  if (m === 'afraid') state.talk = null;                             // (they won't stay to talk)
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The time as people say it, to the nearest five minutes: "Quarter past", "Twenty to", "Three o'clock". */
const NUM = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
function spoken(ms) {
  const k = calendar(ms), m = Math.round(k.minute / 5) * 5 % 60, h = (k.hour + (Math.round(k.minute / 5) * 5 >= 60 ? 1 : 0)) % 12;
  const by = { 5: 'Five', 10: 'Ten', 15: 'Quarter', 20: 'Twenty', 25: 'Twenty-five', 30: 'Half' };
  return m === 0 ? `${cap(NUM[h])} o'clock` : m <= 30 ? `${by[m]} past` : `${by[60 - m]} to`;
}
