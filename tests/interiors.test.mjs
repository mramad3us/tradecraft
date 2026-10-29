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
import { interior } from '../src/sim/map/interior.js';
import { wayAcross } from '../src/sim/interiors/path.js';
import { walls, wallRect } from '../src/sim/interiors/plan.js';
import { footprint } from '../src/sim/interiors/furniture.js';
import { exitHere } from '../src/sim/interiors/use.js';
import { calendar, clockText, HOUR, MIN, DAY } from '../src/sim/clock.js';
import { createBus } from '../src/sim/bus.js';
import { assert } from './helpers.mjs';

export default [
  {
    name: 'interiors: flats, every layout in every city, with the boxes and without: rooms closed but for their doors, nothing standing before the front door, every spot reached from it, no two alike',
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
        const fd = p.openings.find(o => o.kind === 'front');
        assert(Math.abs(edge('n') + (fd.b - fd.a) - (p.x1 - p.x0)) < 0.01, `seed ${seed}: the north wall, less the front door`);
        // (the way out seen for what it is: nothing stood in front of it; the user, 2026-10-28: "where is the door out of the flat")
        const before = p.items.filter(it => { const f = footprint(it); return f.z0 < 1.0 && f.x1 > fd.a - 0.1 && f.x0 < fd.b + 0.1; });
        assert(!before.length, `${city} ${layout} ${seed}: ${before.map(it => it.kind).join(', ')} before the front door`);
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
  {
    name: 'interiors: the embassy in every city: rooms closed but for their doors, your desk and the chief\'s office reached from the street door round the furniture; every post, seat and errand reached too',
    fn() {
      let n = 0;
      const desks = new Set();
      for (const city of ['moscow', 'london', 'cairo', 'beirut']) for (let seed = 1; seed <= 12; seed++) {
        const S = interior({ kind: 'interior', plan: 'embassy', seed, city }), p = S.plan, e = p.exits[0];
        for (const t of p.spots) {
          assert(wayAcross(S, (e.x0 + e.x1) / 2, e.z0 - 0.4, t.x, t.z), `${city} ${seed}: ${t.kind} reached from the street door`);
          n++;
        }
        const d = p.spots.find(t => t.kind === 'desk'); desks.add(`${d.seat.x}|${d.seat.z}`);
        // (closed: a step outside any wall but the doors' is blocked)
        assert(S.blockers.some(b => b.what === 'building' && b.z0 <= p.z1 && b.z1 >= p.z1 && b.x0 <= p.x0 + 2 && b.x1 >= p.x0 + 2), `${city} ${seed}: the street side walled`);
        assert(p.staff.some(t => t.who === 'marine') && p.staff.some(t => t.who === 'chief'), `${city} ${seed}: the Marine's post, the chief's`);
        // (where its people go: each post, from the street door, each seat and the window, each errand)
        for (const t of [...p.staff.map(x => x.approach ?? x), ...p.seats.map(x => x.approach), p.window, ...p.errands]) assert(wayAcross(S, (e.x0 + e.x1) / 2, e.z0 - 0.4, t.x, t.z), `${city} ${seed}: (${t.x.toFixed(1)}, ${t.z.toFixed(1)}) reached from the street door`);
      }
      console.log(`      48 embassies: ${n} spots reached from the street door; your desk at ${desks.size} of the station's four`);
    },
  },
  {
    name: 'interiors: the embassy\'s day: in by nine, applicants in and out of the visa room till one and nobody there after, most gone by half past six; the weekend, the Marine alone',
    heavy: true,
    fn() {
      const c = newCampaign(4, candidates(4, 'london', 'junior')[0], 'london', 'junior'), s = newGame({ seed: 4, scenario: 'campaign', campaign: c }), bus = createBus();
      c.calls = [];
      start(s, bus);
      step(s, { act: ['desk:travel:embassy'] }, bus);
      for (let i = 0; i < 25; i++) step(s, {}, bus);
      skip(s, bus, 90 * MIN);
      s.scenario.prompt = { act: 'embassy' };
      step(s, { act: ['instinct'] }, bus);
      const staff = () => s.actors.filter(a => a.ai?.kind === 'staff'), apps = () => s.actors.filter(a => a.ai?.kind === 'applicant');
      const at = {}, seen = new Set(), walked = new Set();
      const until = (h, m = 0) => { while (calendar(s.time.ms).hour * 60 + calendar(s.time.ms).minute < h * 60 + m) { for (let i = 0; i < 20; i++) step(s, {}, bus); for (const a of apps()) seen.add(a.id); for (const a of staff()) if (a.vx || a.vz) walked.add(a.ai.sid); } };
      until(10, 30); at.morning = staff().length;
      until(13, 45); at.afternoon = { staff: staff().map(a => a.ai.sid), apps: apps().length };
      until(18, 30); at.evening = staff().map(a => a.ai.sid);
      console.log(`      10:30: ${at.morning} at work; by 13:45 ${seen.size} applicants had been and gone, ${at.afternoon.apps} left, the consular officer ${at.afternoon.staff.includes('consular') ? 'still in' : 'gone'}; walked about: ${[...walked].join(', ')}; 18:30: ${at.evening.join(', ')}`);
      assert(at.morning >= 5 && seen.size >= 10 && walked.size >= 3, 'all in by half past ten; applicants in and out; people moving about');
      assert(!at.afternoon.apps && !at.afternoon.staff.includes('consular'), 'the visa room shut and empty after one');
      assert(at.evening.length <= 3 && at.evening.includes('marine'), 'most gone by half past six');
      // (Saturday: the Marine, and nobody else)
      skip(s, bus, (5 - calendar(s.time.ms).weekday) * DAY + 3 * HOUR);
      for (let i = 0; i < 40; i++) step(s, {}, bus);
      assert(staff().map(a => a.ai.sid).join() === 'marine' && !apps().length, `the weekend: the Marine alone (${staff().map(a => a.ai.sid)})`);
    },
  },
  {
    name: 'interiors: the campaign\'s embassy: in from the street past the Marine, to your desk and the day\'s work there till six; the chief\'s office opens the desk; out by the street door onto its street',
    fn() {
      for (const city of ['moscow', 'london']) {
        const seed = 4, c = newCampaign(seed, candidates(seed, city)[0], city), s = newGame({ seed, scenario: 'campaign', campaign: c }), bus = createBus(), opened = [];
        c.calls = [];
        bus.on('desk-open', () => opened.push(true));
        start(s, bus);
        const me = () => playerActor(s), day = Math.floor(s.time.ms / DAY);
        step(s, { act: ['desk:travel:embassy'] }, bus);
        for (let i = 0; i < 25; i++) step(s, {}, bus);
        assert(s.map.kind === 'street' && s.scenario.prompt?.act === 'embassy', `${city}: at the embassy's door, the way in (${s.scenario.prompt?.text})`);
        step(s, { act: ['instinct'] }, bus);
        assert(s.map.place === 'embassy', `${city}: in, the lobby`);
        const t0 = s.time.ms;
        s.scenario.prompt = { act: 'work' };
        step(s, { act: ['instinct'] }, bus);
        for (let i = 0; i < 1200 && !c.worked[day]; i++) step(s, {}, bus);
        const desk = s.$world.sections.get(0).plan.spots.find(t => t.kind === 'desk');
        assert(c.worked[day] && calendar(s.time.ms).hour === 18 && s.map.place === 'embassy' && Math.hypot(me().x - desk.x, me().z - desk.z) < 0.5, `${city}: walked to the desk, worked there till six, still there`);
        const walked = (s.time.ms - t0) / 1000;
        s.scenario.prompt = { act: 'chief' };
        step(s, { act: ['instinct'] }, bus);
        for (let i = 0; i < 1200 && !opened.length; i++) step(s, {}, bus);
        assert(opened.length === 1, `${city}: the chief's office: the desk opened`);
        const e = s.$world.sections.get(0).plan.exits[0];
        Object.assign(me(), { x: (e.x0 + e.x1) / 2, z: e.z0 + 0.05 });
        for (let i = 0; i < 25 && s.map.kind === 'interior'; i++) step(s, {}, bus);
        assert(s.map.kind === 'street' && s.map.row === c.posting.embassy.row && Math.abs(me().x - c.posting.embassy.x) < 0.01, `${city}: out by the street door, onto its street`);
        console.log(`      ${city}: in at ${clockText(t0)}, at the desk till six (${Math.round(walked / 360) / 10} h), the chief's desk opened, out onto the street at ${clockText(s.time.ms)}`);
      }
    },
  },
  {
    name: 'interiors: out by walking, not placed: the flat\'s front door and the embassy\'s street door, head on or slantwise, let you out at once (the user: "The door to exit the embassy is finicky")',
    fn() {
      const rows = [];
      for (const city of ['london', 'moscow']) for (const place of ['home', 'embassy']) for (const [dx, mx] of place === 'home' ? [[0.5, 0], [0.1, 0], [0.9, 0], [0.5, 0.15], [0.5, -0.15]] : [[0.5, 0], [0.1, 0], [0.9, 0], [-0.6, 0.4], [1.6, -0.4], [0.5, 0.3]]) {   // (the flat's coat rack and shoe rack stand either side of its door)
        const seed = 4, c = newCampaign(seed, candidates(seed, city)[0], city), s = newGame({ seed, scenario: 'campaign', campaign: c }), bus = createBus();
        c.calls = [];
        start(s, bus);
        if (place === 'embassy') { step(s, { act: ['desk:travel:embassy'] }, bus); for (let i = 0; i < 25; i++) step(s, {}, bus); step(s, { act: ['instinct'] }, bus); }
        const me = playerActor(s), e = s.$world.sections.get(0).plan.exits[0], out = e.side === 's' ? 1 : -1, w = e.x1 - e.x0;
        Object.assign(me, { x: e.x0 + dx * w, z: (out > 0 ? e.z0 : e.z1) - out * 1.7, busy: null });
        let t = 0;
        for (; t < 100 && s.map.kind === 'interior'; t++) step(s, { mx, mz: out }, bus);
        rows.push(t < 100 ? (t / 20).toFixed(1) : 'STUCK');
        assert(s.map.kind === 'street', `${city} ${place}: out from ${dx} across the door, slant ${mx} (at ${me.x.toFixed(2)}, ${me.z.toFixed(2)})`);
      }
      console.log(`      seconds to the street, from 1.7 m in (the flat's, five ways, then the embassy's, six, in two cities): ${rows.join(' ')}`);
    },
  },
];
