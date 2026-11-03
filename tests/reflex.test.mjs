// The reflex (sim/reflex.js): a moment seen coming stops time, and what's done about it takes its time. The
// quarry's tell read (sim/scenarios/tail.js): the street's covers; a hunter's hand reaching (sim/scenarios/
// hunted.js): a step back makes it miss, meeting it gives you the fight's first edge; an officer going for his
// gun (sim/armed.js): drop yours, and he holds. Reflexes are the played game's (state.$reflexes): set here.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { armCop } from '../src/sim/armed.js';
import { newGun, isGun } from '../src/sim/firearms.js';
import { makeAgent } from '../src/sim/agents.js';
import { sheet } from '../src/sim/people.js';
import { policeOf } from '../src/sim/countries/index.js';
import { stream } from '../src/sim/rng.js';
import { MISS_S } from '../src/sim/reflex.js';
import { naive } from './bots.mjs';
import { assert, fmt } from './helpers.mjs';

// (step till a reflex of this kind is offered, or the minutes run out; drive: the player's input)
function until(g, why, minutes, drive = () => ({})) {
  for (let t = 0; t < 20 * 60 * minutes && !g.scenario.outcome; t++) {
    if (g.$reflex) { if (g.$reflex.why === why) return g.$reflex; step(g, { act: ['reflex:none'] }, null); continue; }
    if (g.fight?.phase === 'choose') return null;
    step(g, drive(g, playerActor(g)), null);
  }
  return null;
}
// (while a reflex stands, time doesn't move)
function stands(g) { const t0 = g.time.ms; for (let t = 0; t < 40; t++) step(g, {}, null); return g.time.ms === t0; }

// (the hunt, with a hunter who has you a few metres off and closing)
function hunt(seed) {
  const g = newGame({ seed, scenario: 'hunted', weather: 'clear' });
  start(g, null);
  g.$reflexes = true;
  const me = playerActor(g), p = g.people[me.who], sc = g.scenario;
  p.skills.awareness = [20, 1];
  const a = g.actors.find(x => x.id === sc.hunters[0]);
  g.people[a.who].skills.deception = [2, 0];
  Object.assign(a, { row: me.row, x: me.x + 5, z: me.z });
  if (a.ai) { delete a.ai.route; a.ai.wait = 0; }
  sc.known[a.id] = true;
  return { g, me, a };
}

export default [
  {
    name: 'reflex: the quarry\'s tell read: time stops, the street\'s covers offered; one chosen, you\'re at it as he looks',
    fn() {
      let hit = null;
      for (let seed = 1; seed <= 6 && !hit; seed++) {
        const g = newGame({ seed, scenario: 'tail', weather: 'clear' });
        start(g, null);
        g.$reflexes = true;
        g.people[g.player].skills.awareness = [20, 1];
        const R = until(g, 'tell', 25, (g, me) => { const t = g.actors.find(a => a.who === 'orlov'); return t ? naive(g, me, t) : {}; });
        if (!R) continue;
        const still = stands(g), cover = R.options.find(o => String(o.do).startsWith('cover:'));
        step(g, { act: [`reflex:${cover.key}`] }, null);
        step(g, {}, null);
        const me = playerActor(g);
        hit = { seed, title: R.title, options: R.options.map(o => o.label), still, at: me.busy?.what ?? (me.glass ? 'window' : me.gait), chose: cover.key };
      }
      assert(hit, 'a tell read in six tails');
      assert(hit.still, 'time stood while the card was up');
      assert(hit.at && hit.at !== 'walk', `chose ${hit.chose}, and at it: ${hit.at}`);
      console.log(`      seed ${hit.seed}: "${hit.title}": ${hit.options.join(' / ')}; chose ${hit.chose}, at it (${hit.at})`);
    },
  },
  {
    name: 'reflex: a hunter\'s hand seen coming: a step back and it closes on air; met, the fight\'s first edge is yours',
    fn() {
      const w = hunt(3), R = until(w.g, 'grab', 1);
      assert(R && R.options.some(o => o.key === 'back') && stands(w.g), `the hand read, time stood: ${R?.title}`);
      step(w.g, { act: ['reflex:back'] }, null);
      let fight = null;
      for (let t = 0; t < 20 * (MISS_S - 0.2) && !fight; t++) { step(w.g, {}, null); if (w.g.fight) fight = w.g.time.ms; }
      assert(!w.g.fight, 'stepped back: no grab while it misses');
      const v = hunt(3), R2 = until(v.g, 'grab', 1);
      step(v.g, { act: ['reflex:edge'] }, null);
      assert(v.g.fight && v.g.fight.adv.a === 1, `met: a fight, the first edge yours (adv ${v.g.fight?.adv?.a})`);
      console.log(`      "${R.title}": ${R.options.map(o => o.label).join(' / ')}; stepped back: no grab for ${MISS_S} s; met: the fight, with the edge`);
    },
  },
  {
    name: 'reflex: an officer going for his gun, seen: drop yours, and he holds; taken in, not shot',
    fn() {
      const g = newGame({ seed: 4, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' }), log = [];
      const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); }, on() {} };
      start(g, bus);
      for (let t = 0; t < 20; t++) step(g, {}, bus);
      g.$reflexes = true;
      const me = playerActor(g), p = g.people[me.who];
      p.skills.awareness = [20, 1];
      g.people.cop1 = sheet({ id: 'cop1', name: 'a police officer', cls: 'cop', skills: { awareness: [12, 0], cqc: [6, 0], tracking: [6, 0] }, look: { skin: 'light', hair: { style: 'crew', color: 0x23252f }, ...policeOf(g.map).look } });
      armCop(g, g.people.cop1, 'patrol', stream('t', 1));
      const c = makeAgent(g, { who: 'cop1', row: g.map.row ?? 0, x: me.x + 5, z: me.z, speed: 1.1, face: 'left' });
      c.cop = true; c.stopping = true; c.head = Math.PI; c.ai.wait = 20 * 600;
      me.head = 0; me.face = 'right';
      p.hand = newGun(p, 'makarov');
      let R = null;
      for (let t = 0; t < 20 * 10 && !R; t++) { step(g, {}, bus); if (g.$reflex?.why === 'gun') R = g.$reflex; }
      assert(R && R.options.some(o => o.key === 'drop') && stands(g), `his draw seen, time stood: ${R?.title}`);
      step(g, { act: ['reflex:drop'] }, bus);
      for (let t = 0; t < 20 * 8; t++) step(g, {}, bus);
      assert(!isGun(p.hand) && !log.some(l => /fires/.test(l)) && log.some(l => /cuffs/.test(l)), `dropped: ${log.filter(l => /fires|cuffs|fall/.test(l)).join(' | ')}`);
      console.log(`      "${R.title}": ${R.options.map(o => o.label).join(' / ')}; dropped it: no shot, taken in`);
    },
  },
];
