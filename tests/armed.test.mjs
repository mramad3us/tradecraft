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
import { kill } from '../src/sim/health.js';
import { nearestDoor } from '../src/sim/services.js';
import { policeOf } from '../src/sim/countries/index.js';
import { stream } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon in a city, and an officer a few metres off, facing you)
function scene(city, seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city, hour: 12, weather: 'clear' }), log = [], papers = [];
  const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); if (k === 'papers') papers.push(...v); }, on() {} };
  start(g, bus);
  for (let t = 0; t < 20; t++) step(g, {}, bus);
  const me = playerActor(g), p = g.people[me.who];
  g.people.cop1 = sheet({ id: 'cop1', name: 'a police officer', cls: 'cop', skills: { awareness: [12, 0], cqc: [6, 0], tracking: [6, 0] }, look: { skin: 'light', hair: { style: 'crew', color: 0x23252f }, ...policeOf(g.map).look } });
  const gun = armCop(g, g.people.cop1, 'patrol', stream('t', 1));
  const c = makeAgent(g, { who: 'cop1', row: g.map.row ?? 0, x: me.x + 7, z: me.z, speed: 1.1, face: 'left' });
  c.cop = true; c.stopping = true; c.head = Math.PI; c.ai.wait = 20 * 600;   // (stood there, as a patrol at a stop: sim/police.js keeps them)
  return { g, bus, log, papers, me, p, c, cop: g.people.cop1, gun };
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
    name: 'armed: drop it, hands empty: he comes in, takes you down (you face down, him on one knee on you), and you\'re taken in: the gun taken, the hours, heat, the paper that says what for; then nobody\'s still shouting',
    fn() {
      const w = scene('moscow'), h0 = heat(w.g), t0 = w.g.time.ms;
      w.p.hand = newGun(w.p, 'makarov');
      seconds(w, 2);
      (w.p.items ??= []).push(w.p.hand); w.p.hand = null;            // (put away: hands empty, and shown)
      w.c.x = w.me.x + 5;
      let pinned = null, firstPin = null;
      for (let t = 0; t < 20 * 20 && !w.papers.length; t++) { step(w.g, {}, w.bus); if (w.g.$takedown?.stage === 'pin') { pinned = [w.me.gait, w.c.gait, Math.abs(w.c.x - w.me.x)]; firstPin ??= w.g.time.ms; } }
      const P = w.papers[0], held = (w.g.time.ms - t0) / 3600000;
      seconds(w, 2);
      // (let out on the nearest station's steps: sim/services.js)
      const me2 = playerActor(w.g), st = nearestDoor(w.g, 'police'), out = w.log.find(l => /steps of/.test(l));
      assert(st && Math.abs(me2.x - st.x) < 1.5 && (w.g.map.row ?? 0) === st.row && out, `out: ${out}; at x ${fmt(me2.x, 1)} row ${w.g.map.row ?? 0}, the station's ${st && fmt(st.x, 1)} row ${st?.row}`);
      assert(pinned?.[0] === 'down' && pinned[1] === 'kneel' && pinned[2] < 1, `pinned: you ${pinned?.[0]}, him ${pinned?.[1]}, ${fmt(pinned?.[2] ?? 0, 2)} m`);
      assert(P?.kind === 'arrest' && /a gun in your hand/.test(P.lines[0]) && /Makarov/.test(P.lines.join(' ')) && heat(w.g) > h0 && w.g.time.ms - t0 > 2 * 3600 * 1000, `taken in: heat ${h0} → ${heat(w.g)}, ${fmt((w.g.time.ms - t0) / 3600000, 1)} h; the paper: ${P?.lines?.[0]}`);
      assert(!Object.keys(w.p.arms ?? {}).some(isGun), 'the gun gone');
      const before = w.log.length;
      seconds(w, 30);
      const after = w.log.slice(before).filter(l => /Полиция|Drop|Стоять/.test(l));
      assert(!w.g.$alarm && !w.g.$takedown && !w.g.wanted && !w.g.actors.some(a => a.alert) && !after.length, `after: alarm ${!!w.g.$alarm}, shouts ${after.length}`);
      console.log(`      the order, the gun away; ${fmt((firstPin - t0) / 1000, 1)} s on he has you down; the paper: ${P.lines.slice(0, 3).join(' / ')}; the hours: ${fmt((w.g.time.ms - t0) / 3600000, 1)} h; heat ${h0} → ${heat(w.g)}; ${out}`);
    },
  },
  {
    name: 'armed: a dead officer takes nobody in (the user\'s, 2026-11-04: checking on one he\'d shot, he was arrested by him); a shove that works and you\'re away, the resisting on the file',
    fn() {
      const w = scene('moscow');
      w.p.hand = newGun(w.p, 'makarov');
      seconds(w, 2);
      (w.p.items ??= []).push(w.p.hand); w.p.hand = null;
      kill(w.cop, w.g.time.ms, 'shot'); w.c.gait = 'down';
      w.me.x = w.c.x - 0.8;
      seconds(w, 15);
      assert(!w.papers.length && !w.g.$takedown, `beside the dead officer: ${w.papers.length ? 'arrested' : 'not arrested'}`);
      // (a shove: your CQC well over his)
      const v = scene('moscow', 6);
      v.g.$reflexes = true; v.p.skills.cqc = [20, 2];
      v.p.hand = newGun(v.p, 'makarov');
      for (let t = 0; t < 20 * 2; t++) { if (v.g.$reflex) step(v.g, { act: ['reflex:none'] }, v.bus); else step(v.g, {}, v.bus); }
      (v.p.items ??= []).push(v.p.hand); v.p.hand = null;
      let shoved = null;
      for (let t = 0; t < 20 * 30 && !v.papers.length; t++) {
        if (v.g.$reflex) { const k = v.g.$reflex.why === 'arrest' && !shoved ? 'shove' : 'none'; if (k === 'shove') shoved = v.g.time.ms; step(v.g, { act: [`reflex:${k}`] }, v.bus); }
        else step(v.g, {}, v.bus);
      }
      const P = v.papers[0];
      assert(shoved && P && /shove/.test(P.lines[1]), `shoved: ${!!shoved}; the paper: ${P?.lines?.[1]}`);
      console.log(`      beside a dead officer for 15 s: not taken in; a shove (CQC 20 against his 6 + ${'4'}): ${v.log.find(l => /Both hands|ready for it/.test(l))}; the paper: ${P.lines[1]}`);
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
  {
    name: 'armed: an officer behind you, out of your sight, gives the order: the log says where from and how far, his voice felt (the plaque\'s "Police"); his shot too',
    fn() {
      const w = scene('beirut');
      Object.assign(w.me, { head: 0, face: 'right' });                // (you facing away from him: he's 7 m behind you)
      Object.assign(w.c, { x: w.me.x - 7, head: 0, face: 'right' });   // (and he facing you)
      w.p.hand = newGun(w.p, 'makarov');
      seconds(w, 2);
      const said = w.log.find(l => /a shout:/.test(l)), felt = w.g.mind.felt?.[w.c.id];
      assert(said && /behind you/.test(said) && felt?.why === 'heard' && felt.label === 'Police', `the order from behind: ${said ?? w.log.filter(l => /Drop|olice/.test(l)).join(' / ')}; felt ${felt?.why}`);
      let shot = null;
      for (let t = 0; t < 20 * 12 && !shot; t++) { step(w.g, {}, w.bus); shot = w.log.find(l => /fires/.test(l)); }
      assert(!shot || /behind you/.test(shot), `his shot: ${shot}`);
      console.log(`      "${said}"; ${shot ? `"${shot.slice(0, 90)}"` : 'no shot yet'}`);
    },
  },
];
