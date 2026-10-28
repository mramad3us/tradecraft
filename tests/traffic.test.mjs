// Traffic (sim/traffic.js): cars both ways on the city's side of the road, never through each other
// or anyone; they stop for people on a zebra and in the road, and a near miss shakes you; the bus you
// wait for (sim/buses.js) pulls in at the shelter, its doors at it, and waits while you choose; let
// go, it pulls out when there's a gap. The flow: mean speed and how much of it is standing, by city.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { section, SECTION_M, Z } from '../src/sim/map/street.js';
import { townOf } from '../src/sim/cities/index.js';
import { LANE_Z, DOOR_M, gapS } from '../src/sim/traffic.js';
import { DWELL_S } from '../src/sim/buses.js';
import { stressOf } from '../src/sim/needs.js';
import { assert, fmt } from './helpers.mjs';

const overlap = (a, b) => Math.abs(a.x - b.x) < (a.len + b.len) / 2 - 0.05 && Math.abs(a.z - b.z) < (a.w + b.w) / 2 - 0.05;
const inside = (c, a) => Math.abs(a.x - c.x) < c.len / 2 && Math.abs(a.z - c.z) < c.w / 2;

function nearestStop(g) {
  const me = playerActor(g);
  let st = null;
  for (let i = Math.floor(me.x / SECTION_M); !st; i++) st = section(townOf(g.map), i, g.map.row ?? 0).props.find(p => p.kind === 'stop');
  return st;
}

export default [
  {
    name: 'traffic: both ways on the city\'s side of the road, never through each other or anyone; it gets along',
    fn() {
      for (const city of [null, 'london', 'beirut', 'cairo']) {
        const g = newGame({ seed: 4, scenario: 'walk', weather: 'clear', city });
        start(g, null);
        let clip = 0, through = 0, n = 0, v = 0, standing = 0, ticks = 0;
        const lanes = new Set();
        for (let t = 0; t < 25 * 180; t++) {
          step(g, {}, null);
          const cs = g.traffic.cars;
          ticks++;
          for (const c of cs) {
            n++; v += c.v; if (c.v < 0.5) standing++;
            if (!c.bus) lanes.add(`${c.dir > 0 ? 'east' : 'west'} ${Math.abs(c.z - LANE_Z.north) < 0.6 ? 'north' : 'south'}`);
            for (const o of cs) if (c.id < o.id && overlap(c, o)) clip++;
            for (const a of g.actors) if (!a.hidden && (a.row ?? g.map.row) === g.map.row && inside(c, a)) through++;
          }
        }
        const left = city === 'london';
        console.log(`      ${city ?? 'moscow'}: ${fmt(n / ticks, 1)} cars in play, ${fmt(v / n * 3.6, 0)} km/h on average, ${fmt(standing / n * 100, 0)}% standing; lanes ${[...lanes].sort().join(', ')}; a car every ${gapS(g.time.ms)} s each way`);
        assert(!clip && !through, `${city ?? 'moscow'}: ${clip} cars through each other, ${through} through someone`);
        assert(lanes.has(left ? 'east north' : 'east south') && lanes.has(left ? 'west south' : 'west north') && lanes.size === 2, `${city ?? 'moscow'}: the city's side of the road`);
        assert(v / n * 3.6 > 7, 'it gets along');
      }
    },
  },
  {
    name: 'traffic: a car stops for you on the zebra, and short of you in the road; stepping out under its nose, a near miss',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk', weather: 'clear' });
      start(g, null);
      const me = playerActor(g), S = [...g.$world.sections.values()].find(S => S.crossings.length), zb = S.crossings[0];
      for (let t = 0; t < 25 * 30; t++) step(g, {}, null);
      // (stood on the zebra in the north lane: the westbound cars wait, nobody's in you)
      Object.assign(me, { x: (zb.x0 + zb.x1) / 2, z: LANE_Z.north });
      let waited = 0, through = 0;
      for (let t = 0; t < 25 * 30; t++) {
        step(g, {}, null);
        for (const c of g.traffic.cars) { if (inside(c, me)) through++; if (c.dir < 0 && c.v < 0.3 && (c.held === me.id || c.held === `zebra:${me.id}`)) waited++; }   // (stopped for you, short of you: you in the road, or on its zebra)
      }
      // (out in front of a car that's coming, a few metres off its nose)
      const was = stressOf(g.people[g.player]);
      let shaken = 0;
      for (let k = 0; k < 40 && !shaken; k++) {
        for (let t = 0; t < 25 * 3; t++) step(g, {}, null);
        const c = g.traffic.cars.find(c => c.dir > 0 && c.v > 7 && Math.abs(c.x - me.x) > 30);
        if (!c) continue;
        Object.assign(me, { x: c.x + c.len / 2 + 4, z: c.z });
        for (let t = 0; t < 25 * 3; t++) { step(g, {}, null); if (g.traffic.cars.some(o => inside(o, me))) through++; }
        shaken = stressOf(g.people[g.player]) > was;
      }
      console.log(`      on the zebra 30 s: a car stood for you ${fmt(waited / 25, 0)} car-seconds; stepped out under one's nose: ${shaken ? 'a near miss, and you\'re shaken' : 'nothing'}; anyone driven through: ${through}`);
      assert(waited > 25 && !through && shaken, 'they stop for you, every time, and it frightens you');
    },
  },
  {
    name: 'traffic: the bus you wait for pulls in at the shelter, its doors at it, and waits while you choose; let go, it pulls out',
    fn() {
      for (const city of [null, 'london', 'beirut']) {
        const g = newGame({ seed: 7, scenario: 'walk', weather: 'clear', city });
        start(g, null);
        const me = playerActor(g), st = nearestStop(g);
        Object.assign(me, { x: st.x + 0.4, z: -2.2 });
        for (let t = 0; t < 30; t++) step(g, {}, null);
        step(g, { act: ['instinct'] }, null);
        let t = 0;
        for (; t < 25 * 60 * 30 && !me.busy?.bus; t++) step(g, {}, null);
        const id = me.busy?.sent, b = g.traffic.cars.find(c => c.id === id);
        const doors = b && b.x + b.dir * (b.len / 2 - DOOR_M);
        console.log(`      ${city ?? 'moscow'}: the ${b?.kind ?? '(clock)'} pulled in ${b ? `${fmt(Math.abs(doors - st.x), 1)} m from the shelter, ${fmt(b.z, 2)} from the kerb's line` : ''}, ${fmt((g.time.ms - me.busy.due.at) / 1000, 0)} s off its time`);
        assert(b?.bus.stopped && Math.abs(doors - st.x) < 1 && b.z < 1.2, `${city ?? 'moscow'}: pulled in at the shelter`);
        for (t = 0; t < 25 * (DWELL_S + 25); t++) step(g, {}, null);
        assert(!b.bus.stopped && Math.abs(b.x - (doors - b.dir * (b.len / 2 - DOOR_M))) > 3, `${city ?? 'moscow'}: let go, it pulls out`);
      }
    },
  },
];
