// TRADECRAFT sim: the log. Rolls, what the character notices, what happens: plain entries in
// state.log (the last LOG_MAX), each stamped with the game time, and told on the bus as 'log'.
// An entry is { ms, kind, text } or, for a roll, { ms, kind: 'roll', roll, text } where roll is the
// result of sim/checks.js and text the line of flavour that goes with it. How it reads on screen is
// the UI's (src/ui/log.js), through checkText() for the numbers.
export const LOG_MAX = 500;

export function say(state, bus, entry) {
  const e = { ms: state.time.ms, ...entry };
  state.log.push(e);
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  bus?.emit('log', e);
  return e;
}
