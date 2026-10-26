// TRADECRAFT sim: scenarios. What a new game is: the free walk for now, each mechanic test as it's
// built (docs/DESIGN.md, Road to 0.1.0), the game itself later. A scenario is
//   { name, about, test?, brief?, setup(state), attach?(state, bus), tick?(state, bus),
//     think?(state, actor, bus), act?(state, bus, action), anchors?(state) }
// setup() fills a new state (the time, the legend, the player, the map, its people); attach() runs
// when a state is started, new or loaded; tick() is its rules, step 5 of the tick (sim/game.js);
// think() moves its own characters (step 4); act() takes the player's actions (T); anchors() are
// the x positions the map must keep in play besides the player's (a target walking ahead). `test`
// lists it among the mechanic tests; `brief` is the paper shown before it starts. When it ends it
// sets state.scenario.outcome and tells the bus ('scenario-end').
import { walk } from './walk.js';
import { tail } from './tail.js';

export const SCENARIOS = { walk, tail };
