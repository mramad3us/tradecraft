// The crowd's bubble (sim/crowd.js): passers-by live on the player's street and the streets either
// side; the street left behind keeps its people for one change of street, the street ahead was full
// before we came, and each passer-by is going somewhere real, a door 2–5 streets from where they
// appeared, so a tail of one ends at their door.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { isPasserby, DEST_ROWS } from '../src/sim/crowd.js';
import { makeAgent, follow, rowOf, onMap } from '../src/sim/agents.js';
import { sectionOf, routeFrom, LINE } from '../src/sim/city.js';
import { createBus } from '../src/sim/bus.js';
import { at } from '../src/sim/clock.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';

/** Walk the player to (x, z), crossing to another street if that's where it leads. */
function walkTo(g, bus, x, z, max = 6000) {
  const row0 = g.map.row;
  for (let t = 0; t < max; t++) {
    const m = playerActor(g), dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz);
    if (d < 0.3 || g.map.row !== row0) return true;
    step(g, { mx: dx / d, mz: dz / d }, bus);
  }
  return false;
}

export default [
  {
    name: 'crowd: the street behind keeps its people for one change of street; the street ahead was full before we came',
    fn() {
      const g = newGame({ seed: 21 });
      const bus = createBus();
      start(g, bus);
      for (let t = 0; t < 20 * 30; t++) step(g, {}, bus);
      // Up the nearest way north, keeping a note of who was where on the tick before we crossed.
      const me = playerActor(g), S = [-1, 0, 1].map(i => sectionOf(g.map.seed, 0, Math.floor(me.x / 45) + i)).find(S => S.gapsN.length);
      const gap = S.gapsN[0], gx = (gap.x0 + gap.x1) / 2;
      const aheadAtStart = g.actors.filter(a => isPasserby(a) && rowOf(g, a) === -1).length;
      assert(aheadAtStart >= 10, `the street north is lived in before we get there (${aheadAtStart})`);
      assert(walkTo(g, bus, gx, LINE.F), 'to the lane');
      let ahead = new Set(), here = new Set();
      for (let t = 0; t < 2000 && g.map.row === 0; t++) {
        ahead = new Set(g.actors.filter(a => isPasserby(a) && rowOf(g, a) === -1).map(a => a.id));
        here = new Set(g.actors.filter(a => isPasserby(a) && rowOf(g, a) === 0).map(a => a.id));
        step(g, { mx: 0, mz: -1 }, bus);
      }
      assert(g.map.row === -1, 'on the street north');
      const nowHere = g.actors.filter(a => isPasserby(a) && onMap(g, a));
      const known = nowHere.filter(a => ahead.has(a.id)).length;
      const behind = g.actors.filter(a => here.has(a.id)).length;
      console.log(`      the tick before we crossed: ${here.size} on our street, ${ahead.size} on the one north (${aheadAtStart} when we set off); across: ${known} of the ${nowHere.length} here were here before us, and ${behind} of the ${here.size} are still about behind`);
      assert(known >= nowHere.length * 0.9, 'the people on the new street were already there');
      assert(behind >= here.size * 0.9, 'the street behind keeps its people');
      // Up again (by a planned way: the street's furniture is in the way of a straight line): the
      // street two back is let go.
      const m2 = playerActor(g), way = routeFrom(g.map.seed, { row: -1, x: m2.x, z: m2.z }, { row: -2, x: m2.x + 20, z: LINE.F });
      for (const p of way.pts.slice(1)) { if (g.map.row !== -1) break; assert(walkTo(g, bus, p.x, p.jump ? Z.north - 3 : p.z), 'up the next lane'); }
      for (let t = 0; t < 40; t++) step(g, {}, bus);
      const left = g.actors.filter(a => isPasserby(a) && rowOf(g, a) === 0).length;
      console.log(`      up again (street ${g.map.row}): ${left} passers-by left on the street two back`);
      assert(g.map.row === -2 && left === 0, 'two streets back, nobody is kept');
    },
  },
  {
    name: 'crowd: a passer-by followed leads 2–5 streets away, and the tail ends at their door',
    fn() {
      const runs = [];
      for (let k = 0; k < 6; k++) {
        const g = newGame({ seed: 40 + k });
        g.time.ms = at(2026, 11, 2, 12, 0);
        start(g, null);
        for (let t = 0; t < 20 * 10; t++) step(g, {}, null);
        // Someone on our street, out on a pavement, a good way from their door.
        const c = g.actors.find(a => isPasserby(a) && onMap(g, a) && Math.abs(a.z - LINE.F) < 1 && Math.abs(a.ai.plan.to.row) >= 2);
        assert(c, 'someone to follow');
        const f = makeAgent(g, { who: null, seed: 777, row: 0, x: c.x - 12, z: LINE.F, speed: 1.45 });
        follow(g, f, c, 16);
        g.focus = f.id;
        g.actors = g.actors.filter(a => a.who !== g.player);
        let maps = 0, row = g.map.row, inside = false, minutes = 0;
        for (let t = 0; t < 20 * 60 * 25; t++) {
          step(g, {}, null);
          if (g.map.row !== row) { maps++; row = g.map.row; }
          if (c.ai.waiting?.kind === 'enter' || !g.actors.includes(c)) { inside = c.ai.waiting?.kind === 'enter' || c.hidden; minutes = t / 1200; break; }
          if (f.ai.follow.lost) break;
        }
        const d = Math.hypot(c.x - f.x, c.z - f.z), rows = Math.abs(c.ai.plan.to.row - c.ai.plan.from.row);
        runs.push({ inside, lost: f.ai.follow.lost, maps, rows, d, minutes, door: c.ai.plan.to.door });
      }
      console.log(`      ${runs.map(r => `${r.inside ? `in at ${r.door === 'entrance' ? 'a block\'s door' : `a${r.door === 'arch' ? 'n arch' : ' shop'}`}` : r.lost ? 'lost' : 'never arrived'} after ${fmt(r.minutes, 1)} min, ${r.maps} changes of street (${r.rows} streets from where they appeared), followed to ${fmt(r.d, 0)} m`).join('; ')}`);
      assert(runs.every(r => r.inside && !r.lost), 'every tail ends at the door');
      assert(runs.every(r => r.rows >= DEST_ROWS[0] && r.rows <= DEST_ROWS[1]), 'their doors are 2–5 streets from where they appeared');
    },
  },
];
