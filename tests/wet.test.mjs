// Getting wet, and what the cold makes of it (sim/wet.js): soaked by the rain's strength, less under an
// umbrella or a hood; dry out of it, faster indoors; wet through in the cold, shivering; a cold caught,
// more by the unfit; a cold's −1 and its sneezes, which show; painkillers.
import { newGame, start, step, skip, playerActor } from '../src/sim/game.js';
import { createBus } from '../src/sim/bus.js';
import { mods } from '../src/sim/health.js';
import { mods as shows } from '../src/sim/notice.js';
import { catchTick, wetOf, hasCold } from '../src/sim/wet.js';
import { sheet } from '../src/sim/people.js';
import { DAY } from '../src/sim/clock.js';
import { assert } from './helpers.mjs';

const walkIn = (weather, setup = () => {}, s = 300) => {
  const g = newGame({ seed: 9, city: 'london' }), bus = createBus();
  g.weather = weather;
  start(g, bus);
  const p = g.people[g.player];
  setup(p);
  for (let t = 0; t < s * 20; t++) step(g, { mx: t % 400 < 200 ? 0.6 : -0.6 }, bus);   // (to and fro along the street)
  return { g, p, bus };
};

export default [
  {
    name: 'wet: five minutes in a downpour soak you, heavy rain less, light rain less again; an umbrella keeps most of it off, a hood some; out of it you dry, slowly',
    fn() {
      const bare = walkIn('rain-extreme'), umb = walkIn('rain-extreme', p => { p.hand = 'umbrella'; }), hood = walkIn('rain-extreme', p => { p.look = { ...p.look, top: { ...p.look.top, hood: true } }; });
      const light = walkIn('rain-light'), heavy = walkIn('rain-heavy');
      const dry = walkIn('overcast', p => { p.wet = 80; }, 600);
      const said = bare.g.log.filter(l => /Damp|Wet through|Soaked/.test(l.text ?? '')).map(l => l.text.split(':')[0]);
      console.log(`      five minutes, a downpour: bare ${Math.round(wetOf(bare.p))}, an umbrella ${Math.round(wetOf(umb.p))}, a hood ${Math.round(wetOf(hood.p))}; heavy rain ${Math.round(wetOf(heavy.p))}, light ${Math.round(wetOf(light.p))}; ten minutes out of it, from 80: ${Math.round(wetOf(dry.p))}; the log: ${said.join(', ')}`);
      assert(wetOf(bare.p) >= 90 && wetOf(umb.p) < 20 && wetOf(hood.p) > wetOf(umb.p) && wetOf(hood.p) < wetOf(bare.p), 'soaked bare; the umbrella keeps most off, the hood some');
      assert(wetOf(light.p) < wetOf(heavy.p) && wetOf(heavy.p) < wetOf(bare.p) && wetOf(dry.p) < 80 && wetOf(dry.p) > 60 && said.length === 3, 'light rain less; drying slow out of doors; the log says so');
    },
  },
  {
    name: 'wet: soaked in the cold you shiver (−1 to everything); a cold caught more by the unfit; a cold\'s −1 and its sneezes, which show; painkillers; it passes',
    fn() {
      const { g, p, bus } = walkIn('sleet-heavy', () => {}, 360);
      const wet0 = wetOf(p);
      const shiver = mods(p, 'social').find(m => /shiver/.test(m.why));
      // (two hours soaked at a degree above freezing, a minute at a time: who catches one)
      const rate = (fit) => { let n = 0; for (let k = 0; k < 300; k++) { const q = sheet({ id: `q${k}`, name: 'P Q', cls: 'civilian', skills: { fitness: [fit, 0] } }); for (let m = 0; m < 120 && !q.sick; m++) catchTick(g, null, q, 0.9, g.time.ms, 1); n += !!q.sick; } return n / 300; };
      const unfit = rate(2), fit = rate(25);
      // (a cold, on the street: its −1, the sneezes; painkillers)
      p.sick = { kind: 'cold', ms: g.time.ms, until: g.time.ms + 5 * DAY, sneeze: g.time.ms };
      g.weather = 'overcast';
      let sneezes = 0, showed = 0;
      for (let t = 0; t < 20 * 60 * 20; t++) { const n0 = g.log.length; step(g, {}, bus); if (g.log.slice(n0).some(l => /sneeze/.test(l.text ?? ''))) { sneezes++; showed += shows(p).some(m => /sneeze/.test(m.why)); } }
      const cold = mods(p, 'tradecraft').find(m => /cold/.test(m.why));
      p.dosed = { at: g.time.ms, until: g.time.ms + 6 * 3600000 };
      const dosed = mods(p, 'tradecraft').find(m => /cold/.test(m.why));
      delete p.dosed;
      skip(g, bus, 6 * DAY);
      console.log(`      six minutes in heavy sleet (${Math.round(wet0)} wet): "${shiver?.why}" ${shiver?.v}; two hours soaked at 1°: a cold, Fitness 2 ${Math.round(unfit * 100)}%, Fitness 25 ${Math.round(fit * 100)}%; a cold: ${cold?.v} ("${cold?.why}"), on painkillers ${dosed ? dosed.v : 'nothing'}; ${sneezes} sneezes in twenty minutes, each showing ${showed === sneezes}; six days on: ${hasCold(p, g.time.ms) ? 'still' : 'gone'}`);
      assert(shiver?.v === -1, 'shivering, −1');
      assert(unfit > fit && unfit > 0.2 && fit < 0.5, 'the unfit catch it more');
      assert(cold?.v === -1 && !dosed && sneezes >= 2 && showed === sneezes && !hasCold(p, g.time.ms), 'a cold: −1, painkillers lift it, sneezes that show, and it passes');
    },
  },
];
