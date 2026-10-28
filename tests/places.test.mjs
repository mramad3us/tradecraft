// A posting's places on its streets (sim/places.js, sim/map/marks.js, sim/cities/embassy.js): the embassy
// a building of its own, with its one door; the flat's and the safe houses' doors; the same after a save
// and a load; the taxi to each, to its door; a town with no posting as it was.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { sectionOf } from '../src/sim/city.js';
import { townOf } from '../src/sim/cities/index.js';
import { SAFE_APART_M } from '../src/sim/places.js';
import { assert } from './helpers.mjs';

export default [
  {
    name: 'places: the embassy has a building of its own, the flat and the safe houses a door each, kept through a save, and the taxi takes you to them',
    fn() {
      const widths = [];
      for (const city of ['moscow', 'london', 'beirut', 'cairo']) for (let seed = 1; seed <= 6; seed++) {
        const c = newCampaign(seed, candidates(seed, city)[0], city), s = newGame({ seed, scenario: 'campaign', campaign: c });
        start(s, null);
        const p = c.posting, town = townOf({ seed: p.mapSeed, city });
        const S = sectionOf(town, p.embassy.row, p.embassy.i), B = S.buildings[p.embassy.b];
        assert(B?.style === 'embassy', `${city} ${seed}: the embassy's building`);
        const doors = S.doors.filter(d => d.x > B.x0 && d.x < B.x1 && Math.abs(d.z - B.z) < 1);
        assert(doors.length === 1 && doors[0].kind === 'embassy' && Math.abs(doors[0].x - p.embassy.x) < 0.01, `${city} ${seed}: one door, the embassy's`);
        widths.push(B.x1 - B.x0);
        for (const pl of [p.home, ...p.safehouses]) {
          const d = sectionOf(town, pl.row, pl.i).doors.find(o => Math.abs(o.x - pl.x) < 0.01);
          assert(d?.place === pl.id && d.kind === 'entrance', `${city} ${seed}: ${pl.id}'s door`);
          if (pl !== p.home && pl.row === p.home.row) assert(Math.abs(pl.x - p.home.x) >= SAFE_APART_M, `${city} ${seed}: a safe house away from the flat`);
        }
        // (day one: in the flat, its street the flat's row; a save and a load; the taxi to the embassy, to its door)
        assert(s.map.place === 'home' && s.map.row === p.home.row, `${city} ${seed}: day one in the flat`);
        const s2 = fromJSON(toJSON(s));
        start(s2, null);
        step(s2, { act: ['desk:travel:embassy'] }, null);
        const me2 = playerActor(s2);
        assert(s2.map.row === p.embassy.row && Math.abs(me2.x - p.embassy.x) < 0.01, `${city} ${seed}: the taxi to the embassy's door`);
        assert(s2.campaign.posting.embassy.b === p.embassy.b && sectionOf(town, p.embassy.row, p.embassy.i).buildings[p.embassy.b].style === 'embassy', `${city} ${seed}: the same after a load`);
      }
      // (a town no posting has marked: no embassy anywhere on its first streets)
      for (const city of ['moscow', 'cairo']) for (let row = -2; row <= 3; row++) for (const i of [0, 1])
        assert(!sectionOf(townOf({ seed: 99991, city }), row, i).buildings.some(B => B.style === 'embassy'), 'a town with no posting is as it was');
      console.log(`      embassies ${widths.length}: ${Math.min(...widths).toFixed(1)}–${Math.max(...widths).toFixed(1)} m wide`);
    },
  },
];
