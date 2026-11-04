// The city's services (sim/services.js): police stations and hospitals on every city's streets, their fronts signed in
// the city's words, a desk inside with someone at it; the nearest of each from a place; a walk-in at a hospital's desk
// (the hours by how bad it is, everything seen to, the heat an official hospital costs, the police waiting if they have
// your description; nothing wrong, no time); and the ambulance's patient out in front of the hospital nearest where
// they fell.
import { newGame, start, step, playerActor, loadRow } from '../src/sim/game.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { createBus } from '../src/sim/bus.js';
import { section } from '../src/sim/map/street.js';
import { sectionOf } from '../src/sim/city.js';
import { Z, SECTION_M } from '../src/sim/map/layout.js';
import { CITIES, townOf } from '../src/sim/cities/index.js';
import { nearestDoor, outside, needsOf, TREAT_MAX_H, VISIT_HEAT, ROW_WALK_M, SERVICE_ROWS } from '../src/sim/services.js';
import { ways } from '../src/sim/shops.js';
import { HOSPITAL_HEAT } from '../src/sim/aid.js';
import { POLICE_HOSPITAL, policeHeatOf } from '../src/sim/police.js';
import { heat } from '../src/sim/heat.js';
import { seenLook } from '../src/sim/emergency.js';
import { injure, addInjury, bloodOf, bleeding } from '../src/sim/health.js';
import { stream } from '../src/sim/rng.js';
import { atDoor, walkIn, walk, spotOf } from './shopwalk.mjs';
import { assert, fmt } from './helpers.mjs';

const HOUR = 3600000, DAY = 24 * HOUR;
const townFor = (city, seed) => (city === 'moscow' ? seed : `${city}:${seed}`);

// (a campaign's street in a city, the player on it, a hospital's floor found and walked to its counter)
function atHospital(city = 'london', seed = 43) {
  const c = newCampaign(seed, candidates(seed, city, 'junior')[0], city, 'junior');
  c.calls = [];
  const g = newGame({ seed, scenario: 'campaign', campaign: c }), bus = createBus(), log = [];
  bus.on('log', (e) => log.push(e.text ?? ''));
  start(g, bus);
  step(g, { act: ['desk:travel:embassy'] }, bus);
  for (let t = 0; t < 10; t++) step(g, {}, bus);
  const at = nearestDoor(g, 'hospital');
  if (at.row !== g.map.row) loadRow(g, bus, at.row, at.x, { quiet: true });
  Object.assign(playerActor(g), { x: at.x });
  const u = atDoor(g, (o) => o.shop === 'hospital');
  walkIn(g, u, bus);
  const k = spotOf(u, 'counter');
  walk(g, k.x, k.z, bus);
  return { g, bus, log, u, me: playerActor(g), p: g.people[g.player] };
}
// (the counter's ways, as the UI would offer them, and the one chosen; then the second the hours are skipped in)
const counter = (w) => ways(w.g, { x: w.u.door, z: Z.front, shop: 'hospital' }, 'counter');
function treat(w) {
  const t0 = w.g.time.ms, h0 = heat(w.g), ph0 = policeHeatOf(w.g), n = w.log.length;
  step(w.g, { act: ['shop:treat'] }, w.bus);
  for (let s = 0; s < 40 && (w.g.$hospital || w.g.$held); s++) step(w.g, {}, w.bus);
  return { h: (w.g.time.ms - t0) / HOUR, heat: heat(w.g) - h0, police: policeHeatOf(w.g) - ph0, lines: w.log.slice(n) };
}

export default [
  {
    name: 'services: police stations and hospitals on every city\'s streets, one in every 600 to 900 m or so, signed in the city\'s words; a desk inside, its word on it, someone at it',
    fn() {
      const rows = [];
      for (const city of Object.keys(CITIES)) {
        const C = CITIES[city], n = { police: 0, hospital: 0 }, signs = { police: new Set(), hospital: new Set() };
        let sections = 0, desks = 0, staffed = 0, chairs = 0;
        for (const seed of [7, 77]) for (let row = -4; row <= 4; row++) for (let i = -10; i <= 10; i++) {
          const S = section(townFor(city, seed), i, row);
          sections++;
          for (const d of S.doors) {
            if (d.kind !== 'shop' || !n.hasOwnProperty(d.shop) || d.z !== Z.front || d.unit === undefined) continue;
            n[d.shop]++;
            const B = S.buildings.find(b => d.x > b.x0 && d.x < b.x1), sign = B.ops.find(op => op[0] === 'sign' && d.x > B.x0 + op[1] && d.x < B.x0 + op[1] + op[3] + 0.2);
            signs[d.shop].add(sign[5]);
            const u = S.units[d.unit], desk = u.items.find(it => it.kind === 'bankCounter');
            if (desk?.look.sign === (C.desks?.[d.shop] ?? desk?.look.sign)) desks++;
            if (u.staff.dress === (d.shop === 'police' ? 'police' : 'nurse')) staffed++;
            if (u.items.some(it => it.kind === 'waitingChairs')) chairs++;   // (where the floor's wide enough for them west of the desk)
            assert(u.decor.some(o => o.kind === 'board' && o.look.posters), `${city}: a notice board on the back wall`);
          }
        }
        const km = sections * SECTION_M / 1000, every = (k) => 1000 * km / n[k];
        const words = (k) => [...signs[k]].join(', ');
        rows.push(`${C.name}: ${fmt(km, 1)} km of street, ${n.police} police stations (one every ${Math.round(every('police'))} m: ${words('police')}), ${n.hospital} hospitals (one every ${Math.round(every('hospital'))} m: ${words('hospital')}); desks ${C.desks.police} / ${C.desks.hospital}, chairs to wait on in ${chairs} of ${desks}`);
        for (const k of ['police', 'hospital']) assert(every(k) > 380 && every(k) < 1400, `${city}: a ${k} in every ${Math.round(every(k))} m`);
        for (const k of ['police', 'hospital']) for (const w of signs[k]) assert((Array.isArray(C.SHOPS[k]) ? C.SHOPS[k] : [C.SHOPS[k]]).some(s => s === w || s.split('|')[0] === w), `${city}: ${w} is one of its ${k} signs`);
        assert(desks === n.police + n.hospital && staffed === desks && chairs >= desks / 2, `${city}: every one a desk with its word (${desks}), someone at it (${staffed}), most with chairs (${chairs})`);
      }
      console.log(`      ${rows.join('\n      ')}`);
    },
  },
  {
    name: 'services: the nearest police station and hospital from a few places: its own street first, a street over counted as a block\'s walk; out in front of its door',
    fn() {
      const g = newGame({ seed: 7, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' }), bus = createBus();
      start(g, bus);
      for (let t = 0; t < 5; t++) step(g, {}, bus);
      const town = townOf(g.map), lines = [];
      // (by brute force: every door of the kind in reach, the nearest by the same measure)
      const brute = (kind, f) => {
        let best = null;
        for (let k = -SERVICE_ROWS; k <= SERVICE_ROWS; k++) for (let i = Math.floor(f.x / SECTION_M) - 30; i <= Math.floor(f.x / SECTION_M) + 30; i++) for (const d of sectionOf(town, f.row + k, i).doors) {
          if (d.kind !== 'shop' || d.shop !== kind || d.z !== Z.front || d.unit === undefined) continue;
          const far = Math.abs(k) * ROW_WALK_M + Math.abs(d.x - f.x);
          if (!best || far < best.far) best = { far, row: f.row + k, x: d.x };
        }
        return best;
      };
      for (const f of [{ row: 0, x: 20 }, { row: 3, x: 500 }, { row: -5, x: -900 }, { row: 1, x: 2400 }]) for (const kind of ['police', 'hospital']) {
        const a = nearestDoor(g, kind, f), b = brute(kind, f);
        assert(a && b && Math.abs(a.far - b.far) < 1, `${kind} from row ${f.row}, ${f.x} m: ${a?.far} m, the brute's ${b && Math.round(b.far)} m`);
        lines.push(`${kind} from row ${f.row} at ${f.x} m: ${a.label}, row ${a.row} at ${fmt(a.x, 1)} m (${a.far} m away)`);
      }
      // (out in front of the nearest hospital: the player, on another street if need be; nothing of a kind there isn't, and nothing moves)
      const me = playerActor(g), was = { row: g.map.row, x: me.x }, at = outside(g, bus, 'hospital', { row: 2, x: 300 });
      assert(at && g.map.row === at.row && me.row === at.row && Math.abs(me.x - at.x) < 1e-9 && Math.abs(me.z - (Z.front + 0.8)) < 1e-9 && me.face === 'down', 'out on the pavement in front of its door, on its street');
      const none = outside(g, bus, 'embassy-of-mars');
      assert(none === null && me.x === at.x && g.map.row === at.row, 'a kind with no doors: null, and nothing moves');
      console.log(`      ${lines.join('\n      ')}\n      outside(): from row ${was.row} to ${at.label} (row ${at.row}, ${fmt(at.x, 1)} m), on the pavement at z ${fmt(me.z, 1)}`);
    },
  },
  {
    name: 'services: a hospital\'s desk: a stab wound and a broken arm, bleeding and pale, seen to in hours (stitched, set, the blood put back), the heat an official hospital costs; out in front of its door',
    fn() {
      // (a broken arm alone: the wait, then the plaster; nothing reported)
      const broke = { id: 'x' }; addInjury(broke, 'armR', 'fracture', 0);
      const A = needsOf(broke, 1000);
      console.log(`      a broken arm alone: ${A.needs.map(n => `${n.key} ${n.h} h`).join(', ')} → ${A.hours} h (${A.urgent ? 'straight through' : 'the wait first'}, reported: ${A.reported})`);
      assert(!A.urgent && !A.reported && A.hours === 3, 'the wait and the plaster, nothing reported');
      const w = atHospital('london', 43), { g, p, me } = w, ms = g.time.ms;
      // (a knife between the ribs, deep; a fractured forearm; the blood down to 74%)
      injure(p, 'torso', 0.6, stream('test-stab', 1), ms, { edge: true, deep: true });
      addInjury(p, 'armL', 'fracture', ms);
      p.body = { torso: 6, armL: 5 }; p.blood = 74;
      const N = needsOf(p, ms), offered = counter(w).find(o => o.id === 'treat');
      const before = `${(p.injuries ?? []).map(i => i.name).join(', ')}; blood ${Math.round(bloodOf(p))}%, bleeding ${bleeding(p, ms)}`;
      const T = treat(w);
      const stab = p.injuries.find(i => i.deep), arm = p.set?.armL && p.splints?.armL;
      const door = { x: w.u.door, z: Z.front + 0.8 };
      console.log(`      before: ${before}\n      the desk: "${offered?.label}"; needs ${N.needs.map(n => `${n.key.replace(/\d+$/, '')} ${n.h} h`).join(', ')} → ${N.hours} h (${N.urgent ? 'straight through' : 'the wait first'})\n      after ${fmt(T.h, 2)} h: the stab ${stab?.stitched ? 'stitched' : 'NOT stitched'}, bleeding ${bleeding(p, g.time.ms)}, the arm ${arm ? 'set and splinted' : 'NOT set'}, blood ${Math.round(bloodOf(p))}%; heat +${T.heat}, the police's file +${T.police}; out at ${fmt(me.x - door.x, 2)} m from its door, z ${fmt(me.z, 1)}, inside ${!!me.within}\n      "${T.lines.join(' / ')}"`);
      assert(offered && /knife wound/.test(offered.label) && N.reported === 'knife' && N.urgent, 'offered, the report warned of; straight through (a deep cut bleeding fast)');
      assert(Math.abs(T.h - N.hours) < 0.02 && N.hours >= 3 && N.hours <= TREAT_MAX_H, `the hours by how bad it is (${N.hours})`);
      assert(stab?.stitched && !bleeding(p, g.time.ms) && arm && bloodOf(p) >= 99, 'stitched, stopped, set, the blood put back');
      assert(T.heat === VISIT_HEAT + HOSPITAL_HEAT && T.police === POLICE_HOSPITAL, `an official hospital's records and its report (${T.heat}, ${T.police})`);
      assert(Math.abs(me.x - door.x) < 1e-6 && Math.abs(me.z - door.z) < 1e-6 && T.lines.some(l => /out through the doors of the hospital on/.test(l)), 'out in front of its door, the log naming it');
      // (nothing wrong now: the desk says so, and no time goes)
      walkIn(g, w.u, w.bus); const k = spotOf(w.u, 'counter'); walk(g, k.x, k.z, w.bus);
      const again = counter(w).find(o => o.id === 'treat'), t1 = g.time.ms, n1 = w.log.length;
      step(g, { act: ['shop:treat'] }, w.bus);
      const spent = (g.time.ms - t1) / 1000;
      console.log(`      again, seen to: "${again.label}" → "${w.log.slice(n1).join(' ')}" (${fmt(spent, 2)} s of the clock)`);
      assert(again.label === 'Ask to see a doctor' && spent < 1 && !g.$hospital && /nothing here for a doctor/.test(w.log.slice(n1).join(' ')), 'nothing to treat: the desk says so, no time');
    },
  },
  {
    name: 'services: a hospital\'s desk: shot through the chest, bleeding inside: straight through, theatre, hours; described by the police, an officer waiting in the corridor',
    fn() {
      const w = atHospital('moscow', 44), { g, p, me } = w, ms = g.time.ms;
      // (a bullet in the chest, as sim/shooting.js leaves it: the wound, and the bleeding inside)
      p.injuries = [{ part: 'torso', kind: 'cut', name: 'a gunshot wound in the chest', ms, until: ms + 30 * DAY, bleed: ms + 6 * HOUR, rate: 0.8, deep: true, gunshot: true },
        { part: 'torso', kind: 'cut', name: 'bleeding inside, from the chest wound', ms, until: ms + 30 * DAY, bleed: ms + 3 * HOUR, rate: 0.6, deep: true, gunshot: true, internal: true }];
      p.body = { torso: 8 }; p.blood = 66;
      g.wanted = { look: seenLook(p.look), ms, until: ms + 4 * DAY, city: g.map.city ?? null, hit: true };
      const N = needsOf(p, ms), T = treat(w);
      const inside = p.injuries.find(i => i.internal);
      console.log(`      needs ${N.needs.map(n => `${n.key.replace(/\d+$/, '')} ${n.h} h`).join(', ')} → ${N.hours} h (${N.urgent ? 'straight through' : 'the wait first'}, reported: ${N.reported}); after ${fmt(T.h, 2)} h of the clock (the hospital's and the station's): the bleeding inside ${inside.bleed > ms ? 'NOT stopped' : 'stopped'}, blood ${Math.round(bloodOf(p))}%; heat +${T.heat}, the police's file +${T.police}\n      "${T.lines.join(' / ')}"`);
      assert(N.urgent && N.reported === 'gunshot' && N.needs.some(n => n.key === 'inside') && N.hours >= 5, 'straight through, theatre, reported');
      assert(!(inside.bleed > ms) && !bleeding(p, g.time.ms) && bloodOf(p) >= 99, 'the bleeding inside stopped, the blood put back');
      assert(T.lines.some(l => /waiting in the corridor/.test(l)) && T.h > N.hours + 1, 'described: the officer in the corridor, and the hours at the station after');
    },
  },
  {
    name: 'services: the ambulance\'s patient: shot down in the street, carried off, out after the hours in front of the hospital nearest where they fell, the log naming it',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' }), log = [];
      const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); }, on() {} };
      start(g, bus);
      for (let t = 0; t < 40; t++) step(g, {}, bus);
      const me = playerActor(g), p = g.people[g.player], fell = { row: g.map.row ?? 0, x: me.x }, ms = g.time.ms;
      // (down on the pavement, the blood gone: collapsed, nothing bleeding any more; people about to see it)
      p.injuries = [{ part: 'torso', kind: 'cut', name: 'a gunshot wound in the chest', ms, until: ms + 30 * DAY, bleed: ms, rate: 0.8, deep: true, gunshot: true }];
      p.body = { torso: 9 }; p.blood = 52; me.gait = 'down';
      const want = nearestDoor(g, 'hospital', fell), t0 = g.time.ms;
      let called = 0;
      for (let s = 0; s < 900 && !log.some(l => /out through the doors/.test(l)); s++) {
        for (let t = 0; t < 20; t++) step(g, {}, bus);
        const c = (g.calls ?? []).find(k => k.who.includes(me.id));
        if (c && !called) { called = s; c.at.ambulance = g.time.ms + 20000; c.at.police = g.time.ms + 1e9; }
      }
      const line = log.find(l => /out through the doors/.test(l)) ?? '';
      console.log(`      called after ${called} s; ${fmt((g.time.ms - t0) / HOUR, 1)} h on; fell on row ${fell.row} at ${fmt(fell.x, 1)} m, out on row ${g.map.row} at ${fmt(me.x, 1)} m (the nearest: ${want.label}, ${want.far} m); blood ${Math.round(bloodOf(p))}%, the wound ${p.injuries[0].stitched ? 'stitched' : 'NOT stitched'}\n      "${line}"`);
      assert(called && line.includes(`${want.label.charAt(0).toLowerCase()}${want.label.slice(1)}`), 'carried off; out, the log naming the hospital');
      assert(g.map.row === want.row && Math.abs(me.x - want.x) < 1e-6 && Math.abs(me.z - (Z.front + 0.8)) < 1e-6 && !me.hidden, 'on the pavement in front of the nearest hospital to where they fell');
    },
  },
];
