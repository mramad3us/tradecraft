// The weather (sim/weather.js): each city's November, hour by hour, read as shares; what each kind and
// level does (the eye's reach, the crowd, a face, the footing, the light); that it's the same from the
// same seed and date, moves none of the game's other dice, and that a pinned 'clear' is the weather
// before there was any. And a cell of the tail's balance in heavy snow and heavy rain, against clear.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { weather, weatherAt, weatherMods, sightM, crowdK, footing, parseWeather, weatherTick, CLIMATE, SLIP } from '../src/sim/weather.js';
import { sky } from '../src/sim/light.js';
import { reach, SIGHT_M, LIGHT_M, openAir } from '../src/sim/perception.js';
import { at, HOUR, MIN, clockText } from '../src/sim/clock.js';
import { geoOf } from '../src/sim/cities/index.js';
import { play } from './tail.test.mjs';
import { assert, fmt } from './helpers.mjs';

const CITIES = Object.keys(CLIMATE);
const LV = ['', ' light', ' heavy', ' extreme'];
const pct = (x) => `${fmt(100 * x, 1)}%`;
const townOf = (city, seed) => (city === 'moscow' ? seed : `${city}:${seed}`);

/** A city's November, hour by hour over a few towns: shares by kind and level, the ground, the temperature. */
function november(city, seeds = [11, 22, 33, 44, 55, 66]) {
  const n = { hours: 0, by: {}, kinds: {}, lying: 0, wet: 0, ice: 0, gale: 0, temps: [] };
  for (const seed of seeds) for (let h = 0; h < 30 * 24; h++) {
    const w = weather(townOf(city, seed), city, at(2026, 11, 1) + h * HOUR + 30 * MIN);
    const k = `${w.kind}${LV[w.level]}`;
    n.by[k] = (n.by[k] ?? 0) + 1; n.kinds[w.kind] = (n.kinds[w.kind] ?? 0) + 1; n.hours++;
    if (w.cover >= 0.3) n.lying++;
    if (w.wet >= 0.5) n.wet++;
    if (w.ice) n.ice++;
    if (w.wind === 3) n.gale++;
    n.temps.push(w.temp);
  }
  n.temps.sort((a, b) => a - b);
  n.share = (k) => (n.kinds[k] ?? 0) / n.hours;
  n.heavy = (ks) => Object.entries(n.by).filter(([k]) => ks.some(x => k.startsWith(x)) && /heavy|extreme/.test(k)).reduce((a, [, v]) => a + v, 0) / n.hours;
  return n;
}

export default [
  {
    name: 'weather: each city\'s November, by the hour (shares of kind and level, the ground, the temperature)',
    fn() {
      const N = {};
      for (const city of CITIES) {
        const n = N[city] = november(city);
        const by = Object.entries(n.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / n.hours)}`).join(', ');
        console.log(`      ${city}: ${by}`);
        console.log(`        ${fmt(n.temps[Math.floor(n.hours * 0.1)])}–${fmt(n.temps[Math.floor(n.hours * 0.9)])} °C (median ${fmt(n.temps[n.hours >> 1])}); snow lying ${pct(n.lying / n.hours)}, streets wet ${pct(n.wet / n.hours)}, ice ${pct(n.ice / n.hours)}, a gale ${pct(n.gale / n.hours)}`);
      }
      const M = N.moscow, L = N.london, B = N.beirut, C = N.cairo;
      assert(M.share('overcast') > 0.5 && M.share('clear') < 0.25, 'Moscow in November: grey, rarely clear');
      assert(M.share('snow') + M.share('sleet') > 0.08 && M.share('snow') > M.share('rain'), 'Moscow: light snow or sleet often');
      assert(M.heavy(['snow', 'sleet']) > 0.01 && M.heavy(['snow', 'sleet']) < (M.share('snow') + M.share('sleet')) / 2, 'Moscow: sometimes heavy, mostly light');
      assert(L.share('rain') > 0.08 && !L.share('snow') && (L.by['rain light'] ?? 0) > (L.by['rain heavy'] ?? 0), 'London: rain, light more than heavy');
      assert(B.share('rain') > 0.01 && B.share('rain') < 0.12 && B.share('clear') > 0.6 && (B.by['rain extreme'] ?? 0) > 0, 'Beirut: showers, storms now and then, mostly fine');
      assert(C.share('clear') > 0.6 && C.share('dust') > 0.05 && C.share('rain') < 0.01 && !C.share('snow'), 'Cairo: mostly clear, dust some days');
    },
  },
  {
    name: 'weather: a day comes and goes (a front rises and eases), and the log says when it turns',
    fn() {
      // The first Moscow day with a heavy fall: its hours, and what the log says through it.
      let day = null;
      for (let d = 1; d <= 30 && !day; d++) for (let h = 0; h < 24; h++) if (weather(11, 'moscow', at(2026, 11, d, h, 30)).level >= 2) { day = d; break; }
      assert(day, 'a heavy fall in a Moscow November');
      const hours = [];
      for (let h = 0; h < 24; h += 2) { const w = weather(11, 'moscow', at(2026, 11, day, h, 0)); hours.push(`${String(h).padStart(2, '0')}h ${w.kind}${LV[w.level]} ${fmt(w.temp)}°`); }
      console.log(`      Moscow, ${day} November, town 11: ${hours.join(' · ')}`);
      // (a fall's level never jumps two at once, ten minutes apart: a heavy fall starts and ends light)
      const falls = (w) => ['rain', 'sleet', 'snow'].includes(w.kind);
      let jumps = 0, prev = null;
      for (const town of [11, 22, 33]) for (let m = 0; m < 24 * 60 * 30; m += 10) { const w = weather(town, 'moscow', at(2026, 11, 1) + m * MIN); if (prev && falls(prev) && falls(w) && Math.abs(w.level - prev.level) > 1) jumps++; prev = w; }
      assert(jumps === 0, `${jumps} jumps of two levels at once`);
      const g = newGame({ seed: 11, scenario: 'walk' });
      g.map.seed = 11;
      g.time.ms = at(2026, 11, day, 0, 0);
      const said = [];
      for (let m = 0; m < 24 * 60; m++) { g.time.ms = at(2026, 11, day) + m * MIN; const n = g.log.length; weatherTick(g, null); if (g.log.length > n) said.push(`${clockText(g.time.ms)} "${g.log.at(-1).text}"`); }
      console.log(`      the log that day: ${said.join('; ')}`);
      assert(said.length >= 2, 'the log says when it turns');
    },
  },
  {
    name: 'weather: what each does: the eye\'s reach, the crowd, a face, the footing, the light',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk' });
      start(g, null);
      g.time.ms = at(2026, 11, 2, 13, 0);
      const rows = [];
      for (const pin of ['clear', 'overcast', 'rain-light', 'rain-heavy', 'rain-extreme-strong', 'sleet-heavy', 'snow-light', 'snow-heavy', 'snow-extreme-gale', 'fog-light', 'fog-heavy', 'fog-extreme', 'dust-light', 'dust-heavy-strong', 'dust-extreme-gale', 'frost']) {
        g.weather = parseWeather(pin); delete g.$sky;
        const w = weatherAt(g), f = footing(w), m = weatherMods(g), day = reach(g, openAir(g));
        g.time.ms = at(2026, 11, 2, 22, 0); delete g.$sky;
        const night = reach(g, openAir(g)), lamp = reach(g, openAir(g) + 0.4);
        g.time.ms = at(2026, 11, 2, 13, 0); delete g.$sky;
        rows.push(`${pin.padEnd(19)} sight to ${Number.isFinite(sightM(w)) ? `${sightM(w)} m` : 'the light\'s'} (by day ${fmt(day, 0)} m, at night ${fmt(night, 0)} m dark, ${fmt(lamp, 0)} m lamplit) · crowd ×${fmt(crowdK(w), 2)} · faces ${m[0] ? `${m[0].v} (${m[0].why})` : '0'} · walk ×${fmt(f.walk, 2)} run ×${fmt(f.run, 2)}, slips ${pct(f.slip)} a second running · light ${fmt(openAir(g), 2)} · "${w.words}"`);
      }
      console.log(rows.map(r => `      ${r}`).join('\n'));
      g.weather = parseWeather('fog-heavy'); delete g.$sky;
      assert(reach(g, 1) < 0.5 * (SIGHT_M + LIGHT_M), 'heavy fog: under half the reach');
      g.weather = parseWeather('rain-light'); delete g.$sky;
      assert(reach(g, 1) > 0.85 * (SIGHT_M + LIGHT_M) && weatherMods(g)[0]?.v === -1, 'light rain: a little');
      g.weather = parseWeather('snow-extreme-gale'); delete g.$sky;
      assert(crowdK(weatherAt(g)) < 0.3 && weatherMods(g)[0].v === -3 && footing(weatherAt(g)).walk < 1, 'a blizzard: the street empties, faces hidden, slow going');
    },
  },
  {
    name: 'weather: a pinned \'clear\' is no weather at all; the same seed and date, the same weather; the game\'s dice never move for it',
    fn() {
      // Clear: the sky's the sun's alone, every effect nothing.
      const ms = at(2026, 11, 2, 16, 40), clear = weatherAt({ map: { kind: 'street', seed: 3 }, weather: parseWeather('clear'), time: { ms } });
      assert(JSON.stringify(sky(ms, geoOf({}), clear)) === JSON.stringify(sky(ms, geoOf({}))), 'clear: the same light');
      assert(sightM(clear) === Infinity && crowdK(clear) === 1 && footing(clear).walk === 1 && footing(clear).run === 1 && !footing(clear).slip, 'clear: no effect');
      // The same town and time: the same weather, whatever was asked before.
      const a = weather('london:5', 'london', at(2026, 11, 20, 9, 13));
      for (let h = 0; h < 200; h++) weather('london:5', 'london', at(2026, 11, 1) + h * 3 * HOUR);
      const b = weather('london:5', 'london', at(2026, 11, 20, 9, 13));
      assert(JSON.stringify(a) === JSON.stringify(b), 'the same weather');
      // The weather draws nothing from the game's rng.
      const g = newGame({ seed: 8, scenario: 'walk' });
      start(g, null);
      const rng = g.rng.join();
      for (let m = 0; m < 3000; m++) { g.time.ms += MIN; weatherAt(g); }
      assert(g.rng.join() === rng, 'the game\'s dice untouched');
      // A game in its own weather, saved and loaded midway, plays on the same (and in a blizzard, slips and all).
      for (const pin of [null, 'snow-extreme-gale']) {
        const run = (cut) => {
          let s = newGame({ seed: 21, scenario: 'walk', city: 'london', weather: pin });
          start(s, null);
          s.time.ms = at(2026, 11, 7, 8, 0);
          for (let t = 0; t < 4000; t++) {
            if (t === cut) { s = fromJSON(toJSON(s)); start(s, null); }
            step(s, { mx: t % 900 < 450 ? 1 : -1, run: t % 300 < 120 }, null);
          }
          return toJSON(s);
        };
        assert(run(-1) === run(1700), `a save and a load change nothing (${pin ?? 'London\'s own'})`);
      }
    },
  },
  {
    name: 'weather: running on ice slips now and then; deep snow is slower going',
    fn() {
      const go = (pin) => {
        const g = newGame({ seed: 6, scenario: 'walk', weather: pin });
        start(g, null);
        const me = playerActor(g);
        step(g, { mx: 1 }, null);
        const walk = Math.hypot(me.vx, me.vz);
        step(g, { mx: 1, run: true }, null);
        const run = Math.hypot(me.vx, me.vz);
        let slips = 0, n = g.log.length;
        for (let t = 0; t < 20 * 120; t++) {
          step(g, { mx: Math.floor(t / 300) % 2 ? -1 : 1, run: true }, null);
          for (; n < g.log.length; n++) if (/ice|snow/.test(g.log[n].text) && /foot|heel/.test(g.log[n].text)) slips++;
        }
        return { slips, walk, run };
      };
      const ice = go('frost'), deep = go('snow-heavy'), clear = go('clear');
      console.log(`      two minutes running: on ice ${ice.slips} slips (${pct(SLIP.ice)} a second), in deep snow ${deep.slips} (${pct(SLIP.snow)}), clear ${clear.slips}; a walk ${fmt(clear.walk, 2)} m/s clear, ${fmt(deep.walk, 2)} in deep snow; a run ${fmt(clear.run, 2)}, ${fmt(deep.run, 2)}`);
      assert(ice.slips >= 2 && clear.slips === 0, 'ice slips, clear doesn\'t');
      assert(deep.walk < clear.walk * 0.95 && deep.walk > clear.walk * 0.85 && deep.run < clear.run * 0.9, 'deep snow, a little slower');
    },
  },
  {
    name: 'weather: the words for the watch, in each city',
    fn() {
      const said = new Set();
      for (const city of CITIES) for (const seed of [1, 2, 3]) for (let h = 0; h < 30 * 24; h += 5) said.add(`${city}: ${weather(townOf(city, seed), city, at(2026, 11, 1) + h * HOUR).words}`);
      const list = [...said];
      for (const city of CITIES) console.log(`      ${list.filter(s => s.startsWith(city)).slice(0, 12).join(' · ')}`);
      assert(list.some(s => /raw wind off the river/.test(s)), 'Moscow\'s wind');
      assert(list.every(s => s.split(': ')[1].length > 2), 'always words');
    },
  },
  {
    name: 'weather: the tail\'s balance in heavy snow and heavy rain, against clear (ours 15 v his 10)',
    heavy: true,
    fn() {
      const N = Number(process.env.TAIL_N ?? 24);
      const cell = (pin) => {
        const runs = Array.from({ length: N }, (_, i) => play(100 + i, 15, 10, 45, pin));
        const share = (o) => runs.filter(r => r.outcome === o).length / N;
        return { seen: share('seen'), made: share('made'), lost: share('lost'), sightings: runs.reduce((a, r) => a + r.sightings, 0) / N };
      };
      const out = {};
      for (const pin of ['clear', 'snow-heavy', 'rain-heavy']) {
        const c = out[pin] = cell(pin);
        console.log(`      ${pin.padEnd(10)}: seen ${pct(c.seen)}, made ${pct(c.made)}, lost ${pct(c.lost)}; seen by him ${fmt(c.sightings, 1)} times an evening`);
      }
      assert(out['snow-heavy'].lost <= 0.25 && out['rain-heavy'].lost <= 0.25, 'the follower seldom just loses him, even in this');
    },
  },
];
