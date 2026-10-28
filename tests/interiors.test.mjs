// Interiors (sim/interiors/, sim/map/interior.js): a flat's plan (its rooms closed, every spot reachable
// from the front door, round the furniture), and the campaign's flat (sim/scenarios/campaign.js): day one
// in it, Hale's call, the telephone answered by walking to it, out by the front door onto the street at
// your door and back up by it, to bed and up at seven, the same after a save and a load.
import { newGame, start, step, skip, playerActor } from '../src/sim/game.js';
import { fatigue } from '../src/sim/campaign.js';
import { NAP_MIN } from '../src/sim/scenarios/campaign.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { candidates, newCampaign, CALL_S } from '../src/sim/campaign.js';
import { sectionFor } from '../src/sim/world.js';
import { wayAcross } from '../src/sim/interiors/path.js';
import { walls, wallRect } from '../src/sim/interiors/plan.js';
import { exitHere } from '../src/sim/interiors/use.js';
import { calendar, HOUR, MIN, DAY } from '../src/sim/clock.js';
import { createBus } from '../src/sim/bus.js';
import { assert } from './helpers.mjs';

export default [
  {
    name: 'interiors: flats, every layout in every city, with the boxes and without: rooms closed but for their doors, every spot reached from the front door, no two alike',
    fn() {
      let n = 0, reached = 0, sizes = new Set(), looks = new Set(), decor = 0, flats = 0;
      for (const city of ['moscow', 'london', 'cairo', 'beirut']) for (const layout of ['bands', 'corridor', 'studio']) for (const boxes of [false, true]) for (let seed = 1; seed <= 15; seed++) {
        const S = sectionFor({ kind: 'interior', plan: 'flat', seed, i0: 0, i1: 0, city, layout, boxes }, 0), p = S.plan;
        flats++; decor += p.decor.length;
        looks.add(`${layout}|${p.mood}|${p.rooms.map(q => `${q.floor}:${q.wall.kind}:${q.wall.c1}`).join(',')}`);
        sizes.add(`${p.x1 - p.x0}×${p.z1 - p.z0}`);
        // (round the plan: wall all the way, but the front door)
        const W = walls(p), edge = (side) => W.filter(w => w.side === side).reduce((a, w) => a + (w.b - w.a), 0);
        assert(Math.abs(edge('s') - (p.x1 - p.x0)) < 0.01 && Math.abs(edge('w') - (p.z1 - p.z0)) < 0.01 && Math.abs(edge('e') - (p.z1 - p.z0)) < 0.01, `seed ${seed}: closed round`);
        assert(Math.abs(edge('n') + 1.0 - (p.x1 - p.x0)) < 0.01, `seed ${seed}: the north wall, less the front door`);
        const e = p.exits[0], from = [(e.x0 + e.x1) / 2, e.z1 + 0.7];
        for (const s of p.spots) { n++; if (wayAcross(S, from[0], from[1], s.x, s.z)) reached++; }
        assert(W.every(w => { const q = wallRect(w); return q.x1 > q.x0 && q.z1 > q.z0; }), 'walls with substance');
      }
      console.log(`      ${flats} flats (${[...sizes].length} sizes, ${looks.size} looks; ${(decor / flats).toFixed(1)} things on the back wall each): ${reached}/${n} spots reached from the front door`);
      assert(reached === n, 'every spot reached');
      assert(looks.size > flats / 2 * 0.9, 'flats unlike each other (the boxes aside, each seed its own)');
    },
  },
  {
    name: 'interiors: the campaign\'s flat: day one in it, Hale\'s call answered at the telephone, out of the front door and back, a save and a load, the bed by day (a nap) and the night',
    fn() {
      for (const city of ['moscow', 'cairo']) for (const seed of [3, 8]) {
        const c = newCampaign(seed, candidates(seed, city)[0], city), s = newGame({ seed, scenario: 'campaign', campaign: c }), bus = createBus(), calls = [];
        bus.on('call', (id) => calls.push(id));
        start(s, bus);
        const me = () => playerActor(s);
        assert(s.map.kind === 'interior' && s.map.place === 'home', `${city} ${seed}: day one in the flat`);
        // (the telephone rings; T, and you walk to it, round the furniture, and pick up)
        for (let i = 0; i < (CALL_S + 1) * 20; i++) step(s, {}, bus);
        assert(s.scenario.prompt?.act === 'phone', `${city} ${seed}: the telephone ringing (${s.scenario.prompt?.text})`);
        step(s, { act: ['instinct'] }, bus);
        for (let i = 0; i < 600 && !calls.length; i++) step(s, {}, bus);
        assert(calls[0] === 'hale', `${city} ${seed}: walked to it and picked up`);
        // (out by the front door: the street, at your door; T there, and up again)
        const p = s.$world.sections.get(0).plan, e = p.exits[0];
        Object.assign(me(), { x: (e.x0 + e.x1) / 2, z: e.z1 - 0.05 });
        for (let i = 0; i < 25 && s.map.kind === 'interior'; i++) step(s, {}, bus);
        assert(s.map.kind === 'street' && s.map.row === c.posting.home.row && Math.abs(me().x - c.posting.home.x) < 0.01, `${city} ${seed}: out onto the street at your door`);
        for (let i = 0; i < 25; i++) step(s, {}, bus);
        assert(s.scenario.prompt?.act === 'home', `${city} ${seed}: at your door, the way up (${s.scenario.prompt?.text})`);
        step(s, { act: ['instinct'] }, bus);
        assert(s.map.place === 'home' && !exitHere(s, me()), `${city} ${seed}: up to the flat, inside its door`);
        // (a save and a load: still in the flat; then to bed, and up at seven)
        const s2 = fromJSON(toJSON(s));
        start(s2, bus);
        assert(s2.map.place === 'home' && s2.$world.sections.get(0).plan.x1 === p.x1, `${city} ${seed}: the same flat after a load`);
        // (by day the bed asks how long: a nap, an hour, the tiredness eased; then the night, up at seven next day)
        const beds = [];
        bus.on('bed', (list) => beds.push(list));
        skip(s2, bus, 7 * HOUR);
        const day0 = Math.floor(s2.time.ms / DAY), up0 = fatigue(s2.campaign, s2.time.ms).h;
        s2.scenario.prompt = { act: 'sleep' };
        step(s2, { act: ['instinct'] }, bus);
        for (let i = 0; i < 800 && !beds.length; i++) step(s2, {}, bus);
        assert(beds[0]?.length === 3, `${city} ${seed}: by day, the bed asks how long`);
        const t0 = s2.time.ms;
        step(s2, { act: ['desk:rest:nap'] }, bus);
        const up1 = fatigue(s2.campaign, s2.time.ms).h;
        assert(Math.abs((s2.time.ms - t0) / MIN - NAP_MIN) < 1 && up1 < up0 - 2, `${city} ${seed}: a nap: an hour, and less tired (${up0.toFixed(1)} → ${up1.toFixed(1)} h up)`);
        step(s2, { act: ['desk:sleep'] }, bus);
        assert(calendar(s2.time.ms).hour === 7 && Math.floor(s2.time.ms / DAY) === day0 + 1 && s2.map.place === 'home', `${city} ${seed}: to bed, up at seven next day, in the flat`);
      }
    },
  },
];
