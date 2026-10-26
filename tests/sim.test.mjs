// The sim's core: dice, calendar, the sun, skills, checks, gauges, heat. Pure modules, run in node.
import { seedRng, next, d20, stream, int } from '../src/sim/rng.js';
import { at, calendar, dateText, clockText, HOUR, MIN, DAY } from '../src/sim/clock.js';
import { sun, sky, lightAt, lightLevel, lightBand } from '../src/sim/light.js';
import { skill, CLASSES } from '../src/sim/skills.js';
import { check, opposed, checkText, DC } from '../src/sim/checks.js';
import { sheet, nudge, drift, passerby, handler } from '../src/sim/people.js';
import { addHeat, heat, stage } from '../src/sim/heat.js';
import { assert, near, fmt } from './helpers.mjs';

export default [
  {
    name: 'rng: the same seed gives the same numbers, and d20 is fair',
    fn() {
      const a = seedRng(42), b = seedRng(42), c = seedRng(43);
      for (let i = 0; i < 100; i++) assert(next(a) === next(b), 'same seed, same stream');
      assert(next(a) !== next(c), 'another seed, another stream');
      const r = stream('test', 7), n = 200000, counts = Array(21).fill(0);
      for (let i = 0; i < n; i++) counts[d20(r)]++;
      assert(counts[0] === 0, 'no zeros');
      const worst = Math.max(...counts.slice(1).map(k => Math.abs(k / n - 0.05)));
      console.log(`      d20 over ${n}: worst face off by ${fmt(worst * 100, 2)} points of 5%`);
      assert(worst < 0.003, 'every face near 5%');
    },
  },
  {
    name: 'clock: dates, weekdays and leap years',
    fn() {
      assert(dateText(0) === 'Thursday 1 January 2026', dateText(0));
      const t = at(2026, 11, 2, 15, 40);
      assert(dateText(t) === 'Monday 2 November 2026', dateText(t));
      assert(clockText(t) === '15:40', clockText(t));
      const c = calendar(at(2028, 2, 29, 23, 59, 59));
      assert(c.year === 2028 && c.month === 2 && c.day === 29 && c.hour === 23 && c.second === 59, JSON.stringify(c));
      assert(calendar(at(2028, 2, 29) + DAY).month === 3, 'the day after 29 Feb 2028 is in March');
      assert(calendar(at(2026, 12, 31)).doy === 365, 'doy');
      assert(calendar(-HOUR).year === 2025, 'before the epoch');
    },
  },
  {
    name: 'light: the sun over Moscow, and the light it makes',
    fn() {
      // Moscow, 2 November 2026. Solar noon: 12:00 + (45° − 37.62°) × 4 min, less the equation of time
      // (+16.4 min) = 12:13. Day length at 55.75° N, declination −14.6°, with refraction: 9 h 13 min.
      // So sunrise about 07:36, sunset about 16:50, the noon sun 90 − 55.75 − 14.6 ≈ 19.6° up.
      const day = at(2026, 11, 2);
      let rise = null, set = null, top = -90;
      for (let m = 0; m < 24 * 60; m++) {
        const e = sun(day + m * MIN).elev, e0 = sun(day + (m - 1) * MIN).elev;
        if (e0 < -0.833 && e >= -0.833) rise = m;
        if (e0 >= -0.833 && e < -0.833) set = m;
        top = Math.max(top, e);
      }
      const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      console.log(`      2 Nov 2026: sunrise ${hm(rise)}, sunset ${hm(set)}, noon ${fmt(top)}°`);
      near(rise, 7 * 60 + 36, 4, 'sunrise');
      near(set, 16 * 60 + 50, 4, 'sunset');
      near(top, 19.6, 0.6, 'noon');
      // Midsummer: the sun barely sets.
      near(Math.max(...Array.from({ length: 24 }, (_, h) => sun(at(2026, 6, 21, h)).elev)), 57.7, 0.8, 'midsummer noon');
      const noon = sky(day + 12 * HOUR), night = sky(day + 22 * HOUR), dusk = sky(day + 16 * HOUR + 50 * MIN);
      assert(noon.glow === 0 && noon.shadow > 0.99 && night.glow === 1 && night.shadow === 0, 'glow and shadow');
      console.log(`      levels: noon ${fmt(lightLevel([], 0, 0, day + 12 * HOUR), 2)}, 16:50 ${fmt(lightLevel([], 0, 0, day + 16 * HOUR + 50 * MIN), 2)} (glow ${fmt(dusk.glow, 2)}), 22:00 ${fmt(lightLevel([], 0, 0, day + 22 * HOUR), 2)}, under a lamp ${fmt(lightLevel([{ x: 0, z: 0, r: 2, color: 0xe7b84a, core: 0.5, ring: 0.2 }], 0, 0, day + 22 * HOUR), 2)}`);
      assert(lightBand(lightLevel([], 0, 0, day + 12 * HOUR)) === 'day', 'noon is day');
      assert(lightBand(lightLevel([], 0, 0, day + 22 * HOUR)) === 'dark', 'night is dark');
      assert(lightBand(lightLevel([{ x: 0, z: 0, r: 2, color: 0xe7b84a, core: 0.5, ring: 0.2 }], 0.5, 0, day + 22 * HOUR)) === 'dim', 'a lamp makes it dim');
      const lit = lightAt([{ x: 0, z: 0, r: 2, color: 0xe7b84a, core: 0.5, ring: 0.2 }], 0, 0, day + 12 * HOUR);
      assert(lit.every(v => v === 1), 'lamps are off by day');
    },
  },
  {
    name: 'skills: (base + practice) × (1 + weight × over-skill / 100)',
    fn() {
      const master = { cls: 'spook', os: 100, skills: { deception: [20, 3], social: [20, 3], fitness: [20, 3] } };
      assert(skill(master, 'deception') === 46, `a master at full Tradecraft: ${skill(master, 'deception')}`);
      assert(skill(master, 'social') === Math.round(23 * 1.6), 'Social at weight 0.6');
      assert(skill(master, 'fitness') === 23, 'Fitness: no weight');
      assert(skill({ cls: 'civilian', skills: { awareness: [5, 2] } }, 'awareness') === 7, 'a civilian: the plain sum');
      assert(skill({ cls: 'spook', os: 50, skills: {} }, 'cqc') === 0, 'untrained is 0 whatever the over-skill');
      assert(CLASSES.spook.weights.deception === 1 && CLASSES.spook.weights.cqc === 0.5, 'Tradecraft weights');
      const me = handler(stream('me', 1));
      console.log(`      a Handler (Tradecraft ${me.os}): ${['deception', 'tracking', 'pathfinding', 'awareness', 'social', 'cqc'].map(k => `${k} ${skill(me, k)}`).join(', ')}`);
    },
  },
  {
    name: 'checks: naturals, hooks, opposed rolls and their lines',
    fn() {
      // Find seeds that roll a natural 1 and a natural 20 first, to test both against any odds.
      const first = (want) => { for (let s = 1; ; s++) { const r = seedRng(s); if (d20(r) === want) return s; } };
      assert(!check(seedRng(first(1)), { skill: 'social', value: 60, dc: 10 }).ok, 'a natural 1 fails');
      assert(check(seedRng(first(20)), { skill: 'social', value: -60, dc: 40 }).ok, 'a natural 20 succeeds');
      const hooked = check(seedRng(5), { skill: 'social', value: 0, dc: 15, hook: true });
      assert(hooked.dc === 8, 'a hook halves the difficulty, rounded up');
      // Success rates over many rolls: d20 + 8 against 15 succeeds 70% of the time.
      const r = stream('rates', 1);
      let ok = 0;
      for (let i = 0; i < 20000; i++) ok += check(r, { skill: 'social', value: 8, dc: DC.average }).ok;
      near(ok / 20000, 0.7, 0.012, 'd20 + 8 vs 15');
      // Opposed: equal skills, ties to us: we win 52.5% (+ naturals shift it a hair).
      let won = 0;
      for (let i = 0; i < 40000; i++) won += opposed(r, { skill: 'deception', value: 10 }, { skill: 'pathfinding', value: 10 }).ok;
      console.log(`      d20+8 vs 15: ${fmt(ok / 200, 1)}%; equal opposed rolls, ties to us: ${fmt(won / 400, 1)}%`);
      near(won / 40000, 0.525, 0.01, 'opposed, equal');
      const o = opposed(seedRng(9), { skill: 'deception', value: 12, mods: [{ why: 'night', v: 2 }, { why: 'running', v: -4 }] }, { skill: 'pathfinding', value: 6 }, { hook: true });
      const line = checkText(o);
      console.log(`      "${line}"`);
      assert(line.includes('2 (night)') && line.includes('− 4 (running)') && line.includes('halved by a hook'), line);
      assert(checkText(check(seedRng(3), { skill: 'social', value: 8, dc: 15 })).startsWith('Social check: '), 'check line');
    },
  },
  {
    name: 'people: gauges clamp and drift back a step a week',
    fn() {
      const p = sheet({ id: 't', name: 'T' });
      nudge(p, 'trust', 3, 0); nudge(p, 'trust', 4, 0);
      assert(p.gauges.trust === 5, 'clamped at +5');
      nudge(p, 'fear', -2, 0);
      drift(p, 6 * DAY);
      assert(p.gauges.trust === 5, 'no drift inside a week');
      drift(p, 15 * DAY);
      assert(p.gauges.trust === 3 && p.gauges.fear === 0, `two weeks: ${JSON.stringify(p.gauges)}`);
      drift(p, 21 * DAY);
      assert(p.gauges.trust === 2, 'the third week, counted from where the last left off');
      const a = passerby(1234), b = passerby(1234);
      assert(JSON.stringify(a) === JSON.stringify(b), 'a passer-by is the same for the same seed');
      const sample = Array.from({ length: 400 }, (_, i) => passerby(i));
      const top = Math.max(...sample.map(q => skill(q, 'awareness')));
      console.log(`      400 passers-by: ${sample.filter(q => q.sex === 'f').length} women, best Awareness ${top}, e.g. ${sample[0].name}, ${sample[1].name}, ${sample[2].name}`);
      assert(top <= 10, 'civilians stay low');
    },
  },
  {
    name: 'heat: one number per legend per country, never below the cover\'s floor',
    fn() {
      const s = { country: 'ru', legend: { id: 'embassy', floor: 20 }, heat: {} };
      assert(heat(s) === 20 && stage(heat(s)) === 'watched', 'official cover starts watched');
      addHeat(s, 35);
      assert(heat(s) === 55 && stage(55) === 'tailed', 'tailed');
      addHeat(s, -100);
      assert(heat(s) === 20, 'cools only to the floor');
      addHeat(s, 500);
      assert(heat(s) === 100 && stage(100) === 'blown', 'blown at 100');
    },
  },
];
