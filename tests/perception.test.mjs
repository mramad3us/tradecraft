// Perception: the cone, the radius of awareness, the light, the walls; and the player's memory of
// who was where (frozen out of sight, forgotten when the spot is looked at again).
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { eyes, visibility, sees, SEEN, inView, AWARE_M, AWARE_PER, CONE_DEG, CONE_PER_AWARENESS } from '../src/sim/perception.js';
import { at } from '../src/sim/clock.js';
import { skill } from '../src/sim/skills.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';

function street(hour = 15, seed = 4) {
  const g = newGame({ seed });
  g.time.ms = at(2026, 11, 2, hour, 0);
  start(g, null);
  return g;
}

export default [
  {
    name: 'perception: a cone ahead, awareness all round, and nothing through a wall',
    fn() {
      const g = street(13);
      const me = playerActor(g);
      Object.assign(me, { x: 0, z: -2.6, head: 0 });              // on the far pavement, facing east
      const e = eyes(g, me), aw = skill(g.people[g.player], 'awareness');
      console.log(`      Awareness ${aw}: a cone of ${fmt(CONE_DEG + CONE_PER_AWARENESS * aw, 0)}°, aware ${fmt(AWARE_M + AWARE_PER * aw)} m round`);
      assert(sees(g, e, 25, -2.6), 'someone 25 m ahead by day');
      assert(!sees(g, e, -12, -2.6), 'not someone 12 m behind');
      assert(sees(g, e, -3, -2.6), 'someone 3 m behind (awareness)');
      assert(sees(g, e, 6, 6), 'the road ahead and to the right');
      assert(!sees(g, e, 0, 12), 'not the boulevard straight to the side');
      // The terrace: its foot is seen, the yard behind it isn't.
      assert(sees(g, e, 8, Z.front + 0.25), 'the foot of the facade ahead');
      assert(!sees(g, e, 8, -20), 'not through the building');
      // A side street is seen down its length from its mouth, not through the houses beside it.
      let g2 = g, S = null;
      for (let seed = 4; !S; seed++) { g2 = street(13, seed); S = [...g2.$world.sections.values()].find(s => s.side && s.side.x0 > -60); }
      {
        const g = g2, me = playerActor(g);
        const mx = (S.side.x0 + S.side.x1) / 2;
        Object.assign(me, { x: mx, z: -3, head: -Math.PI / 2 });
        const up = eyes(g, me);
        assert(sees(g, up, mx, -18), 'up the side street');
        assert(!sees(g, up, S.side.x0 - 6, -18), 'not through the corner house');
        console.log(`      side street at x ${fmt(S.side.x0, 0)}…${fmt(S.side.x1, 0)}: seen up its length, not through its corners`);
      }
    },
  },
  {
    name: 'perception: in the dark the eye reaches less far, except into the lamplight',
    fn() {
      const g = street(22);
      const me = playerActor(g);
      const lamp = g.$world.lamps.find(l => l.z < 0 && l.x > 30);
      Object.assign(me, { x: lamp.x - 26, z: -2.6, head: 0 });
      const e = eyes(g, me);
      const lit = visibility(g, e, lamp.x, -1.0), dark = visibility(g, e, lamp.x, -4.8);
      console.log(`      22:00, 26 m ahead: under a lamp ${fmt(lit, 2)}, against the wall out of its light ${fmt(dark, 2)}`);
      assert(lit >= SEEN, 'someone under a lamp, 26 m off');
      assert(dark < SEEN, 'not someone in the dark, 26 m off');
      const day = street(13), me2 = playerActor(day);
      Object.assign(me2, { x: lamp.x - 26, z: -2.6, head: 0 });
      assert(sees(day, eyes(day, me2), lamp.x, -4.8), 'by day, the same spot is seen');
    },
  },
  {
    name: 'memory: out of sight, people stay where they were seen; looked at again, they\'re moved on or forgotten',
    fn() {
      const g = street(15);
      const me = playerActor(g);
      for (let t = 0; t < 40; t++) step(g, {}, null);              // facing down (the road, the boulevard)
      const ahead = g.actors.filter(a => a !== me && inView(g, a.id) && a.z > 6);
      assert(ahead.length > 0, 'someone seen on the near pavement or the path');
      const watched = ahead.find(a => a.vx || a.vz) ?? ahead[0];
      const before = g.mind.seen[watched.id].slice();
      for (let t = 0; t < 60; t++) step(g, { look: true, mx: 0, mz: -1 }, null);   // turn round, toward the shops, 3 s
      const frozen = g.mind.seen[watched.id];
      const moved = Math.hypot(watched.x - before[0], watched.z - before[1]);
      assert(!inView(g, watched.id) || Math.hypot(watched.x - me.x, watched.z - me.z) < 6, 'turned away, not in view');
      if (frozen && !inView(g, watched.id)) {
        assert(frozen[0] !== watched.x || moved === 0, 'remembered where they were, not where they are');
        console.log(`      turned away for 3 s: remembered ${fmt(Math.hypot(watched.x - frozen[0], watched.z - frozen[1]), 1)} m from where they've walked to`);
      }
      for (let t = 0; t < 10; t++) step(g, { look: true, mx: 0, mz: 1 }, null);    // and back
      const now = g.mind.seen[watched.id];
      const stale = Object.values(g.mind.seen).filter(r => r[5] !== g.mind.at && sees(g, eyes(g, me), r[0], r[1])).length;
      assert(stale === 0, 'no memory of someone at a spot in view who isn\'t there');
      console.log(`      looked back: ${now ? (now[5] === g.mind.at ? 'seen again where they are' : 'remembered (out of sight again)') : 'forgotten (gone from the spot)'}; ${Object.keys(g.mind.seen).length} people remembered, ${g.actors.length - 1} about`);
    },
  },
];
