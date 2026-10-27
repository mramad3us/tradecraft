// TRADECRAFT sim: scenarios. What a new game is: the free walk for now, each mechanic test as it's
// built (docs/DESIGN.md, Road to 0.1.0), the game itself later. A scenario is
//   { name, about, test?, brief?, setup(state), attach?(state, bus), tick?(state, bus),
//     think?(state, actor, bus), act?(state, bus, action), anchors?(state) }
// setup() fills a new state (the time, the legend, the player, the map, its people); attach() runs
// when a state is started, new or loaded; tick() is its rules, step 5 of the tick (sim/game.js);
// think() moves its own characters (step 4); act() takes the player's actions (T); anchors() are
// the x positions the map must keep in play besides the player's (a target walking ahead); carry()
// and mapChanged() are told when the player goes off the map to the next street (sim/game.js
// changeMap): whom to take along, and what to do on arrival; result() fills its result paper. `test`
// lists it among the mechanic tests; `brief` is the paper shown before it starts. When it ends it
// sets state.scenario.outcome and tells the bus ('scenario-end'). holds?(state): whether the player's
// feet are the scenario's just now (a fight, a walk onto the mat), so the move keys do nothing.
// aware(state): the character takes in the whole map (a small lit room), so the view shows it all, no fog.
// place?(state): where we are, for the watch, off the street. watch?(state): { x, z } of someone the
// picture should lean toward while they're in sight (the tail: him). `campaign`: the campaign's hub
// (sim/scenarios/campaign.js), listed apart on the title. setup(state, { chapter, campaign }): campaign
// is an assignment's context when it's run from a campaign (sim/campaign.js context()): the character,
// the city, the time, its people; state.campaign is the campaign itself, riding along.
import { walk } from './walk.js';
import { tail } from './tail.js';
import { sdr } from './sdr.js';
import { dojoScenario } from './dojo.js';
import { campaignHub } from './campaign.js';
import { hunted } from './hunted.js';
import { watchTest } from './watch.js';

export const SCENARIOS = { walk, dojo: dojoScenario, tail, sdr, watch: watchTest, hunted, campaign: campaignHub };
