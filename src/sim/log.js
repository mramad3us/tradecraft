// TRADECRAFT sim: the log. Rolls, what the character notices, what happens: plain entries in
// state.log (the last LOG_MAX), each stamped with the game time, and told on the bus as 'log'.
// An entry is { ms, kind, text } or, for a roll, { ms, kind: 'roll', roll, text } where roll is the
// result of sim/checks.js and text the line of flavour that goes with it. Something said aloud carries
// says: { id (the speaker's actor), words } and, if the line has more than the words, aside (the rest:
// "A hand on your arm"): on screen the words go in a balloon over the speaker, for as long as a line
// at the top left lingers, and the aside goes top left (the user, 2026-10-27: "speech bubbles for
// scripted speech"); the log keeps the whole line. How it reads on screen is the UI's (src/ui/ui.js,
// src/ui/log.js), through checkText() for the numbers.
export const LOG_MAX = 500;

/** The words in a line's quotes (“…” or "…"), joined: what a balloon shows. */
export const quoted = (text) => [...text.matchAll(/[“"]([^”"]+)[”"]/g)].map(m => m[1]).join(' … ');

/** A line said aloud by actor id: the log's text, the words for the balloon (from its quotes), and what else it says. */
export const speak = (state, bus, id, text, aside = null) => say(state, bus, { kind: 'note', text, says: id ? { id, words: quoted(text) } : undefined, aside: aside ?? undefined });

export function say(state, bus, entry) {
  const e = { ms: state.time.ms, ...entry };
  state.log.push(e);
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  bus?.emit('log', e);
  return e;
}
