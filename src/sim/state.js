// TRADECRAFT sim: the game state as saved, and its upgrades.
//
// State is plain data (numbers, strings, arrays, objects), so a save is its JSON. Keys starting
// with $ are runtime only (the world's indexes, caches) and never saved: toJSON() drops them at any
// depth. SAVE_SCHEMA is bumped only for a change an upgrade can't fill in; anything additive is
// filled in by upgradeState() on load, so players keep their games across releases.
//
// The shape (schema 1):
//   schema, version (the game that saved it), seed, rng (sim/rng.js), tick, time { ms }
//   scenario { kind, … }       which game or mechanic test this is, and its own progress
//   country, legend { id, name, cover, floor }   where we are and as whom (heat is per legend per country)
//   player (a person id), focus (the actor the map follows: usually the player's)
//   people { id: sheet }       persistent people, the player among them (sim/people.js)
//   map { kind, seed, i0, i1, crowd }   the map being played: enough to generate it again
//   actors [ … ]               who's on it, where, doing what (sim/crowd.js, sim/game.js)
//   nextActor, heat { 'legend@country': 0–100 }, log [ … ] (sim/log.js), flags { }
//   mind { seen { actor id: [x, z, face, gait, stride, ms, look key] } }   what the player last saw of
//                              whom, and where (sim/perception.js)
import { headOf } from './perception.js';

export const SAVE_SCHEMA = 1;

/** The state as save JSON: everything but the $ keys. */
export function toJSON(state) {
  return JSON.stringify(state, (k, v) => (k.startsWith('$') ? undefined : v));
}

/** A state from save JSON, upgraded to the current shape. Throws on something that isn't a save. */
export function fromJSON(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || s.game !== 'tradecraft') throw new Error('not a TRADECRAFT save');
  if (s.schema > SAVE_SCHEMA) throw new Error(`a save from a newer game (schema ${s.schema}; this game reads up to ${SAVE_SCHEMA})`);
  return upgradeState(s);
}

/** Fill in what an older save lacks. */
export function upgradeState(s) {
  s.flags ??= {};
  s.heat ??= {};
  s.log ??= [];
  s.focus ??= null;
  s.map.crowd ??= 1;
  s.mind ??= { seen: {} };
  for (const a of s.actors) { a.stride ??= 0; a.stuck ??= 0; a.head ??= headOf(a.face); }
  s.schema = SAVE_SCHEMA;
  return s;
}
