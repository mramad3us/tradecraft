// Perception: the cone, the radius of awareness, the light, the walls, a shop window's glass; and the
// player's memory of who was where (frozen out of sight, forgotten when the spot is looked at again).
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { eyes, visibility, sees, SEEN, inView, lightHere, AWARE_M, AWARE_PER, CONE_DEG, CONE_PER_AWARENESS, SIGHT_M, LIGHT_M, GLASS_K, BODY_DEG } from '../src/sim/perception.js';
import { coverHere, crossingNear } from '../src/sim/acts.js';
import { at } from '../src/sim/clock.js';
import { skill } from '../src/sim/skills.js';
import { Z } from '../src/sim/map/street.js';
import { assert, fmt } from './helpers.mjs';

// (in clear weather: the reach here is the light's alone; tests/weather.test.mjs has the weather's toll)
function street(hour = 15, seed = 4) {
  const g = newGame({ seed, weather: 'clear' });
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
      let g2 = g;
      let side = null;
      for (let seed = 4; !side && seed < 200; seed++) { g2 = street(13, seed); side = [...g2.$world.sections.values()].flatMap(s => s.gapsN).find(gp => gp.kind === 'side' && gp.x0 > -60 && gp.x1 < 60); }
      assert(side, 'a side street somewhere');
      {
        const g = g2, me = playerActor(g);
        const mx = (side.x0 + side.x1) / 2;
        Object.assign(me, { x: mx, z: -3, head: -Math.PI / 2 });
        const up = eyes(g, me);
        assert(sees(g, up, mx, -18), 'up the side street');
        assert(!sees(g, up, side.x0 - 6, -18), 'not through the corner house');
        console.log(`      ${side.name} at x ${fmt(side.x0, 0)}…${fmt(side.x1, 0)}: seen up its length, not through its corners`);
      }
    },
  },
  {
    name: 'perception: in the dark the eye reaches less far, except into the lamplight',
    fn() {
      const g = street(22);
      const me = playerActor(g);
      const lamp = g.$world.lamps.find(l => l.z < 0 && l.x > 30 && l.shop === undefined);   // (a street lamp, not a shop's light)
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
    name: 'perception: a shop window shows the street behind, through its pane, short of a straight look, and not what your back hides',
    fn() {
      const g = street(13), me = playerActor(g);
      const pane = [...g.$world.sections.values()].flatMap(S => S.doors).map(d => d.pane).filter(p => p && p.x1 - p.x0 >= 2.8).sort((a, b) => Math.abs(a.x0) - Math.abs(b.x0))[0];
      assert(pane, 'a shop with a good window');
      const ex = pane.x1 - 0.4, ez = pane.z + 0.65, across = 8.5;   // at the glass, near its east end; the near pavement over the road
      const at = (head, glass) => { Object.assign(me, { x: ex, z: ez, head, glass: glass ? { ...pane, since: 0 } : false }); return eyes(g, me); };
      const IN = -Math.PI / 2, BACK = Math.PI / 2, SLANT = -Math.PI / 2 - Math.PI / 4;   // into the glass; turned round; slanted along it, west
      const v = (e, x, z) => visibility(g, e, x, z);
      const glass = at(IN, true), wall = at(IN, false), turned = at(BACK, false), slant = at(SLANT, true);
      // Straight in: the road behind, and the near pavement over it, but not the middle (your own back).
      const behind = [ex, across], side = [ex - 9, across], east = [ex + 14, across], west = [ex - 14, across], pavement = [ex - 14, -2.7];
      assert(v(glass, ...side) >= SEEN && v(wall, ...side) < SEEN, 'over the road, to one side: in the glass (and not without it)');
      assert(v(glass, ...behind) < SEEN && v(turned, ...behind) >= SEEN, 'straight behind: your own back in the glass (a straight look sees it)');
      // Through the pane only: what's reflected beyond its end isn't in it.
      assert(v(glass, ...west) >= SEEN && v(glass, ...east) < SEEN, 'the glass shows what it reflects: west of us, not east past its end');
      // The pavement behind: not in a look straight in; slanted along the glass, yes.
      assert(v(glass, ...pavement) < SEEN && v(slant, ...pavement) >= SEEN, 'the pavement behind, slanted along the glass');
      // Shorter than a straight look: GLASS_K of the eye's reach (the way there and back).
      const range = SIGHT_M + LIGHT_M * lightHere(g, ex, 20), far = [ex - 0.58 * range, 28];   // (on the far pavement, back west)
      const vf = v(glass, ...far), tf = v(turned, ...far);
      console.log(`      straight in: over the road 9 m aside ${fmt(v(glass, ...side), 2)}, straight behind ${fmt(v(glass, ...behind), 2)} (your back: ${BODY_DEG}°), 14 m east past the pane ${fmt(v(glass, ...east), 2)}, the pavement 14 m back ${fmt(v(glass, ...pavement), 2)} (slanted: ${fmt(v(slant, ...pavement), 2)}); ${fmt(range, 0)} m reach straight, ${fmt(range * GLASS_K, 0)} in the glass: at ${fmt(Math.hypot(far[0] - ex, far[1] - ez), 0)} m ${fmt(vf, 2)} (turned round ${fmt(tf, 2)})`);
      assert(tf >= SEEN && vf < SEEN, 'the glass reaches less far than a look');
      // And the instinct's offer: a shop window at hand on the shops' pavement, not once you're at it.
      Object.assign(me, { x: (pane.x0 + pane.x1) / 2, z: -2.7, glass: false });
      assert(coverHere(g, me) === 'window', 'a window offered, walking past it');
      me.glass = { ...pane, since: 0 };
      assert(coverHere(g, me) !== 'window', 'not when you\'re at it');
    },
  },
  {
    name: 'what\'s at hand is the engine\'s: every scene offers a shop window and a free seat the same, and T does it',
    fn() {
      const out = [];
      for (const scenario of ['walk', 'sdr', 'tail']) {
        for (const want of ['window', 'bench']) {
          const g = newGame({ seed: 5, scenario });
          start(g, null);
          for (let t = 0; t < 20 * 3; t++) step(g, {}, null);
          const me = playerActor(g), mid = (p) => (p.x0 + p.x1) / 2;
          const S = [...g.$world.sections.values()];
          let at;
          if (want === 'window') {
            const pane = S.flatMap(S => S.doors).map(d => d.pane).filter(p => p && !crossingNear(g, { x: mid(p), z: -2.7 }, 6)).sort((a, b) => Math.abs(mid(a) - me.x) - Math.abs(mid(b) - me.x))[0];
            at = { x: mid(pane), z: -2.7 };
          } else {
            const seat = S.flatMap(S => S.props.filter(p => p.kind === 'bench')).flatMap(b => b.seats).filter(x => !crossingNear(g, { x, z: 15.6 }, 6)).sort((a, b) => Math.abs(a - me.x) - Math.abs(b - me.x))[0];
            at = { x: seat + 0.5, z: 14.4 };
          }
          Object.assign(me, { ...at, head: 0, face: 'right', busy: null });
          for (let t = 0; t < 20 * 2; t++) step(g, {}, null);
          const offer = g.$offer, own = g.scenario.prompt;
          assert(offer?.act === want, `${scenario}: ${want} at hand (${JSON.stringify(offer)})`);
          if (own?.act || own?.tone === 'urgent') out.push(`${scenario} ${want}: R beside the scene's own "${own.text}" on T`);   // (both at once: R's apart from T)
          step(g, { act: ['use'] }, null);
          for (let t = 0; t < 20 * 5; t++) step(g, {}, null);
          assert(want === 'window' ? me.glass : me.gait === 'sit', `${scenario}: R ${want === 'window' ? 'looks in the window' : 'sits'}`);
          out.push(`${scenario} ${want}: "${(own?.text ?? '')}${offer.text}"`.replace('{instinct}', 'T'));
        }
      }
      console.log(`      ${out.join('\n      ')}`);
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
