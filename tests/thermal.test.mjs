// The body's warmth and the day's dress (sim/thermal.js): how long the cold or the heat takes, and what it
// does; passers-by dressed for the day; dressed for another season, or an umbrella under a clear sky, and
// you're easier to pick out; the ground's memory (sim/weather.js): old snow dirty, a dry spell without puddles.
import { live, drift, stageOf, bandFor, dressFor, offSeason, warmthOf, EXPECT, CORE } from '../src/sim/thermal.js';
import { passerby, sheet } from '../src/sim/people.js';
import { mods as noticeMods } from '../src/sim/notice.js';
import { canStand } from '../src/sim/health.js';
import { weather } from '../src/sim/weather.js';
import { at, HOUR, DAY } from '../src/sim/clock.js';
import { stream, next } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

const dressed = (kind, hat = null) => sheet({ id: 'me', look: { top: { kind }, ...(hat ? { hat: { kind: hat } } : {}) } });
// (minutes till a stage is reached, in this air, or null within the hours given)
function till(p, w, stage, hours = 6, opts = {}) {
  for (let m = 1; m <= hours * 60; m++) { live(p, w, 1, opts); if (stageOf(p)?.id === stage || (stage === 'any' && stageOf(p))) return m; }
  return null;
}

export default [
  {
    name: 'thermal: the cold and the heat take their time, by what you wear, the wind and the wet; and what they do',
    fn() {
      const air = (temp, wind = 0, kind = 'clear', cloud = 1) => ({ temp, wind, kind, cloud });
      const tee = till(dressed('tee'), air(-15, 1), 'hypothermia');
      const coat = till(dressed('coat', 'beanie'), air(-15, 1), 'hypothermia');
      const wetJumper = (() => { const p = dressed('sweater'); p.wet = 90; return till(p, air(5, 1, 'rain'), 'hypothermia'); })();
      const dryJumper = till(dressed('sweater'), air(5, 1, 'overcast'), 'hypothermia');
      const cairoCoat = till(dressed('coat'), air(38, 0, 'clear', 0), 'exhaustion', 6, { hour: 14 });
      const cairoTee = till(dressed('tee'), air(38, 0, 'clear', 0), 'exhaustion', 6, { hour: 14 });
      assert(tee && tee < 45 && (!coat || coat > tee * 3), `a T-shirt at −15 in a breeze: hypothermia in ${tee} min (a coat and a hat: ${coat ?? 'not in 6 h'})`);
      assert(wetJumper && (!dryJumper || dryJumper > wetJumper * 1.5), `wet through in a jumper at 5 °C: ${wetJumper} min; dry: ${dryJumper ?? 'not in 6 h'}`);
      assert(cairoCoat && cairoCoat < 120 && (!cairoTee || cairoTee > cairoCoat * 2), `a coat in Cairo's 38 °C sun: heat exhaustion in ${cairoCoat} min (a T-shirt: ${cairoTee ?? 'not in 6 h'})`);
      // (the body holds what it can: overdressed on a warm day, too hot, never worse, however long; 0.1.5's first try cooked a coat at 24 °C in six hours)
      const warm = dressed('coat'); for (let m = 0; m < 6 * 60; m++) live(warm, air(24, 0, 'clear', 0), 1, { hour: 13 });
      assert(!stageOf(warm) || stageOf(warm).id === 'hot', `a coat at 24 °C in the sun, six hours: ${stageOf(warm)?.id ?? 'fine'} (${warm.core?.toFixed(1) ?? 37})`);
      const p = dressed('tee'); p.core = 30.5;
      assert(!canStand(p), 'under 31: down');
      const q = dressed('coat'); q.core = 34.5;
      for (let m = 0; m < 120; m++) live(q, null, 1);
      assert(!q.core || Math.abs(q.core - CORE) < 0.05, `indoors, back to 37 (${q.core ?? CORE})`);
      console.log(`      hypothermia: a T-shirt at −15 °C, breezy, ${tee} min; a coat and a hat ${coat ?? '> 6 h'}; a jumper at 5 °C wet through ${wetJumper} min, dry ${dryJumper ?? '> 6 h'}; heat exhaustion in Cairo's 38 °C midday: a coat ${cairoCoat} min, a T-shirt ${cairoTee ?? '> 6 h'}`);
    },
  },
  {
    name: 'thermal: passers-by dress for the day (coats in a Moscow January, T-shirts in a Cairo July); who they are doesn\'t change',
    fn() {
      const share = (city, band, kinds) => { let n = 0; for (let s = 1; s <= 400; s++) if (kinds.includes(passerby(s, city, band).look.top?.kind)) n++; return n / 400; };
      const cold = share('moscow', 'freezing', ['coat']), hot = share('cairo', 'hot', ['tee', 'dress', 'robe']);
      const a = passerby(7, 'moscow', 'freezing'), b = passerby(7, 'moscow', 'hot'), c = passerby(7, 'moscow');
      assert(cold > 0.85 && hot > 0.85, `coats in the freezing ${fmt(cold * 100, 0)}%, light in the heat ${fmt(hot * 100, 0)}%`);
      assert(a.name === b.name && a.age === b.age && a.look.skin === b.look.skin && JSON.stringify(c.skills) === JSON.stringify(a.skills), 'the same person, dressed otherwise');
      console.log(`      in a Moscow freeze ${fmt(cold * 100, 0)}% in coats; in a Cairo heat ${fmt(hot * 100, 0)}% in T-shirts, dresses and robes; a mild Moscow day: ${fmt(share('moscow', 'mild', ['coat']) * 100, 0)}% coats`);
    },
  },
  {
    name: 'thermal: dressed for another season, or an umbrella under a clear sky, and you\'re easier to pick out',
    fn() {
      const p = dressed('tee');
      p.$season = { off: offSeason(p.look, 'freezing'), umbrella: false };
      const m = noticeMods(p).find(x => /season/.test(x.why));
      assert(m && m.v >= 2, `a T-shirt in a freeze: +${m?.v}`);
      const q = dressed('coat'); q.$season = { off: offSeason(q.look, 'hot'), umbrella: true };
      const ms = noticeMods(q);
      assert(ms.some(x => /season/.test(x.why)) && ms.some(x => /umbrella/.test(x.why)), 'a coat and an umbrella in a hot clear day: both');
      assert(offSeason(dressed('coat').look, 'cold') === 0 && offSeason(dressed('tee').look, 'warm') === 0, 'dressed for it: nothing');
      console.log(`      a T-shirt in a freeze +${m.v}; a coat in the heat +${ms.find(x => /season/.test(x.why)).v}, an umbrella under a clear sky +${ms.find(x => /umbrella/.test(x.why)).v}`);
    },
  },
  {
    name: 'weather: old snow goes dirty as the days pass; a dry spell leaves the streets dry',
    fn() {
      // (Moscow, January and February at noon: fresh snow is clean, and lying a few days without more, it greys)
      const days = Array.from({ length: 59 }, (_, d) => weather(5, 'moscow', at(2026, 1, 1 + d, 12)));
      const falling = days.filter(w => w.kind === 'snow'), dirty = days.filter(w => w.cover > 0.3 && w.dirt > 0.4);
      assert(falling.length && falling.every(w => (w.dirt ?? 0) === 0), 'snow falling: clean');
      assert(dirty.length >= 2, `old snow, greyed: ${dirty.length} noons of the 59`);
      const dirt = [Math.max(...days.map(w => w.dirt ?? 0))];
      // (a Cairo July: dry, no puddles)
      let wetH = 0;
      for (let d = 1; d <= 14; d++) for (let h = 0; h < 24; h += 3) if (weather(5, 'cairo', at(2026, 7, d, h)).wet > 0.45) wetH++;
      assert(wetH === 0, `two weeks of a Cairo July: the streets never wet enough for a puddle (${wetH})`);
      console.log(`      a Moscow January and February at noon: snow lying ${days.filter(w => w.cover > 0.3).length} of 59, greyed ${dirty.length}, the dirtiest ${fmt(dirt[0], 2)}; a Cairo July, hours wet enough for puddles: ${wetH}`);
    },
  },
];
