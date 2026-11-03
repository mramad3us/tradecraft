// Armed police (sim/armed.js): patrols armed as their country's are (London's not at all); a gun in your hand
// seen, the order, and if you keep it they ready and fire, in real time; drop it, and you're taken in; a shot
// heard, and the armed response comes in its minutes, long guns up.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { armCop, call } from '../src/sim/armed.js';
import { newGun, isGun, modelOf, isLong, MODELS } from '../src/sim/firearms.js';
import { bullet } from '../src/sim/shooting.js';
import { makeAgent } from '../src/sim/agents.js';
import { sheet } from '../src/sim/people.js';
import { heat } from '../src/sim/heat.js';
import { policeOf } from '../src/sim/countries/index.js';
import { stream } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon in a city, and an officer a few metres off, facing you)
function scene(city, seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city, hour: 12, weather: 'clear' }), log = [];
  const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); }, on() {} };
  start(g, bus);
  for (let t = 0; t < 20; t++) step(g, {}, bus);
  const me = playerActor(g), p = g.people[me.who];
  g.people.cop1 = sheet({ id: 'cop1', name: 'a police officer', cls: 'cop', skills: { awareness: [12, 0], cqc: [6, 0], tracking: [6, 0] }, look: { skin: 'light', hair: { style: 'crew', color: 0x23252f }, ...policeOf(g.map).look } });
  const gun = armCop(g, g.people.cop1, 'patrol', stream('t', 1));
  const c = makeAgent(g, { who: 'cop1', row: g.map.row ?? 0, x: me.x + 7, z: me.z, speed: 1.1, face: 'left' });
  c.cop = true; c.stopping = true; c.head = Math.PI; c.ai.wait = 20 * 600;   // (stood there, as a patrol at a stop: sim/police.js keeps them)
  return { g, bus, log, me, p, c, cop: g.people.cop1, gun };
}
const seconds = (w, n, input = {}) => { for (let t = 0; t < 20 * n; t++) step(w.g, input, w.bus); };

export default [
  {
    name: 'armed: patrols carry their country\'s sidearm, holstered (London\'s none); the armed response its long guns',
    fn() {
      const rows = [];
      for (const city of ['moscow', 'london', 'beirut', 'cairo']) {
        const w = scene(city), resp = sheet({ id: 'r', cls: 'cop' }), long = armCop(w.g, resp, 'response', stream('t', 2));
        rows.push(`${city}: patrol ${w.gun ? modelOf(w.gun).short : 'unarmed'}, response ${long ? modelOf(long).short : 'none'}`);
        if (city === 'london') assert(!w.gun && isLong(long), 'London: patrols unarmed, the response with a carbine');
        else assert(w.gun && !isLong(w.gun) && !isGun(w.cop.hand), `${city}: a holstered pistol`);
      }
      console.log(`      ${rows.join('; ')}`);
    },
  },
  {
    name: 'armed: a gun in your hand seen: the order; kept in your hand, they draw, aim and fire in real time; you\'re shot at',
    fn() {
      const w = scene('moscow');
      w.p.hand = newGun(w.p, 'makarov');
      seconds(w, 2);
      assert(w.c.alert && w.log.some(l => /Полиция|Police/.test(l)), `the order: ${w.log.filter(l => /olice|Полиция/.test(l)).join(' / ')}`);
      const t0 = w.g.time.ms;
      let fired = null;
      for (let t = 0; t < 20 * 12 && fired === null; t++) { step(w.g, {}, w.bus); if (w.log.some(l => /fires/.test(l))) fired = (w.g.time.ms - t0) / 1000; }
      assert(fired !== null && isGun(w.cop.hand), `kept in your hand: drawn and fired at you, ${fmt(fired ?? -1, 1)} s after the order`);
      console.log(`      the order, then ${fmt(fired, 1)} s later the first shot (Weapon handling ${w.cop.skills.weapons}); ${w.log.filter(l => /fires/.test(l)).slice(0, 2).join(' | ')}`);
    },
  },
  {
    name: 'armed: drop it, hands empty, and you\'re taken in: the gun taken, hours at the station, heat',
    fn() {
      const w = scene('moscow'), h0 = heat(w.g), t0 = w.g.time.ms;
      w.p.hand = newGun(w.p, 'makarov');
      seconds(w, 2);
      (w.p.items ??= []).push(w.p.hand); w.p.hand = null;            // (put away: hands empty, and shown)
      w.c.x = w.me.x + 3;
      seconds(w, 5);
      assert(w.log.some(l => /cuffs/.test(l)) && heat(w.g) > h0 && w.g.time.ms - t0 > 2 * 3600 * 1000, `taken in: heat ${h0} → ${heat(w.g)}, ${fmt((w.g.time.ms - t0) / 3600000, 1)} h`);
      assert(!Object.keys(w.p.arms ?? {}).some(isGun), 'the gun gone');
    },
  },
  {
    name: 'armed: a shot heard, and the armed response comes in its minutes, long guns up',
    fn() {
      const w = scene('london');
      call(w.g, w.bus, w.me.x, 'the shots');
      const R = w.g.$response, mins = (R.at - w.g.time.ms) / 60000;
      assert(R && mins >= 4 && mins <= 8, `called: due in ${fmt(mins, 1)} min (London's armed response)`);
      w.g.$response.at = w.g.time.ms + 1000;
      seconds(w, 3);
      const unit = w.g.actors.filter(a => a.unit);
      assert(unit.length === 3 && unit.every(a => isLong(w.g.people[a.who].hand)), `come: ${unit.length}, with ${unit.map(a => modelOf(w.g.people[a.who].hand).short).join(', ')}`);
      console.log(`      London: the armed response due in ${fmt(mins, 1)} min; ${unit.length} officers, ${unit.map(a => modelOf(w.g.people[a.who].hand).short).join(', ')}`);
    },
  },
  {
    name: 'armed: an officer shot down fires no more from the ground; nobody fires at you down, or with your hands empty; they cover you and come in',
    fn() {
      // (the user's save, 2026-11-03: two officers shot down went on firing, and on at the player down and unarmed)
      const w = scene('moscow');
      w.p.hand = newGun(w.p, 'makarov');
      seconds(w, 6);                                                   // (the order, kept: he engages)
      const fires = () => w.log.filter(l => /fires/.test(l)).length;
      bullet(w.g, w.bus, w.c, 'torso', MODELS.makarov, w.me);
      const f0 = fires();
      seconds(w, 20);
      assert(w.c.gait === 'down' && fires() === f0, `shot down: ${fires() - f0} more shots from the ground (${w.c.gait})`);
      const v = scene('moscow');
      v.p.hand = newGun(v.p, 'makarov');
      seconds(v, 6);
      (v.p.items ??= []).push(v.p.hand); v.p.hand = null;              // (put away)
      const g0 = v.log.filter(l => /fires/.test(l)).length;
      seconds(v, 15);
      const g1 = v.log.filter(l => /fires/.test(l)).length;
      assert(g1 === g0, `hands empty: ${g1 - g0} shots at you`);
      console.log(`      shot down, 20 s: ${fires() - f0} shots from him; your gun away, 15 s: ${g1 - g0} at you; ${v.log.some(l => /cuffs/.test(l)) ? 'cuffed' : 'covered'}`);
    },
  },
];
