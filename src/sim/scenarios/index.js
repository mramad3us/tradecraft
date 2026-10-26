// TRADECRAFT sim: scenarios. What a new game is: the free walk for now, each mechanic test as it's
// built (docs/DESIGN.md, Road to 0.1.0), the game itself later. A scenario is
//   { name, about, setup(state), attach?(state, bus), tick?(state, bus) }
// setup() fills a new state (the time, the legend, the player, the map, its people); attach() runs
// when a state is started, new or loaded; tick() is its rules, step 5 of the tick (sim/game.js).
import { walk } from './walk.js';

export const SCENARIOS = { walk };
