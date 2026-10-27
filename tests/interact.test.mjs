// What you can do with someone at hand (F: sim/interact.js), in any scene: the menu and what's greyed;
// a read (sim/know.js) whose ranges hold the truth and narrow; a word; a brawl on the street, played
// out by the engine's fight (sim/fight.js) to its end: they run, or lie there; and it's seen.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { atHand, options, act, GRAB_CQC } from '../src/sim/interact.js';
import { knownOf, READABLE } from '../src/sim/know.js';
import { skill } from '../src/sim/skills.js';
import { isPasserby } from '../src/sim/crowd.js';
import { at } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

/** The free walk by day, the player next to a passer-by on the pavement. */
function beside(seed) {
  const g = newGame({ seed });
  g.time.ms = at(2026, 11, 2, 13, 0);
  start(g, null);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g);
  const them = g.actors.find(a => isPasserby(a) && (a.row ?? g.map.row) === g.map.row && Math.abs(a.z - (-2.7)) < 1.5 && !a.hidden);
  Object.assign(me, { x: them.x - 1, z: them.z, head: 0, face: 'right' });
  return { g, me, them };
}

export default [
  {
    name: 'interact: within reach, the menu (Talk, Violence and its openings, Read), greyed where it isn\'t open to you',
    fn() {
      const { g, me, them } = beside(3);
      assert(atHand(g) === them, 'they\'re at hand');
      const o = options(g, them), v = o.find(x => x.id === 'violence').sub;
      assert(o.map(x => x.id).join() === 'talk,violence,read', 'talk, violence, read');
      const grab = v.find(x => x.id === 'grab'), stab = v.find(x => x.id === 'stab');
      const cqc = skill(g.people[g.player], 'cqc');
      assert(grab.ok === (cqc >= GRAB_CQC) && !stab.ok && /no blade drawn/.test(stab.why), `grab by CQC (${cqc}), stab greyed`);
      console.log(`      ${v.map(x => `${x.label}${x.ok ? '' : ` (greyed: ${x.why})`}`).join(', ')}`);
      me.x = them.x - 5;
      assert(!atHand(g), 'nobody, five metres off');
    },
  },
  {
    name: 'interact: a read guesses their sheet: ranges that hold the truth, narrowing read by read',
    fn() {
      const { g, me, them } = beside(4);
      const widths = [];
      for (let i = 0; i < 4; i++) {
        act(g, null, 'read', them);
        const k = knownOf(g, them.who), p = g.people[them.who];
        for (const key of READABLE) { const [lo, hi] = k.skills[key], v = skill(p, key); assert(lo <= v && v <= hi, `${key} ${v} within ${lo}–${hi}`); }
        widths.push(READABLE.reduce((a, key) => a + k.skills[key][1] - k.skills[key][0], 0));
      }
      console.log(`      four reads, the ranges' width all told: ${widths.join(', ')}; ${g.log.at(-1).text}`);
      assert(widths.every((w, i) => i === 0 || w <= widths[i - 1]), 'each read narrows, never widens');
      // Talk: time stands still; a choice, and an answer; leaving ends it.
      act(g, null, 'talk', them);
      const ms = g.time.ms;
      step(g, { act: ['talk:time'] }, null);
      for (let t = 0; t < 40; t++) step(g, {}, null);
      assert(g.talk && g.time.ms === ms, 'time stands still while you talk');
      assert(/^You ask/.test(g.log.at(-1).text), `a question, and an answer: ${g.log.at(-1).text}`);
      step(g, { act: ['talk:leave'] }, null);
      step(g, {}, null);
      assert(!g.talk && g.time.ms > ms, 'left there, and time goes on');
    },
  },
  {
    name: 'interact: a hit on the street is a fight\'s opening; it ends with them running, or lying there; and it\'s seen',
    fn() {
      const ends = [];
      for (let seed = 5; seed < 13; seed++) {
        const { g, them } = beside(seed);
        const heat0 = Object.values(g.heat).reduce((a, b) => a + b, 0);
        act(g, null, seed % 2 ? 'sucker' : 'hit', them);
        assert(g.fight && g.fight.owner === 'street', 'a fight, the street\'s');
        for (let t = 0; t < 20 * 60 && g.fight; t++) step(g, { act: g.fight?.phase === 'choose' ? ['hit'] : [] }, null);
        const k = knownOf(g, them.who), p = g.people[them.who];
        ends.push(`${them.ai?.downUntil > g.time.ms ? 'down' : them.ai?.pace > 1.5 ? 'ran' : 'stood'}${Object.values(g.heat).reduce((a, b) => a + b, 0) > heat0 ? ', seen' : ''}`);
        assert(!g.fight, 'it ends');
        assert(k && k.fights.won + k.fights.lost === 1, 'and you know them a little better for it');
      }
      console.log(`      eight on the street: ${ends.join('; ')}`);
      assert(ends.some(e => e.startsWith('ran')) || ends.some(e => e.startsWith('down')), 'they run, or go down');
    },
  },
  {
    name: 'interact: the scenes notice: a word with Orlov makes the tail, a blow blows it (once the fight is over); a blow on an FSB watcher is an incident',
    fn() {
      const out = {};
      for (const id of ['talk', 'hit']) {
        const g = newGame({ seed: 6, scenario: 'tail' });
        start(g, null);
        for (let t = 0; t < 20 * 5; t++) step(g, {}, null);
        const me = playerActor(g), orlov = g.actors.find(a => a.who === 'orlov');
        Object.assign(me, { row: orlov.row, x: orlov.x - 1, z: orlov.z, busy: null });
        step(g, { act: [`interact:${id}:${orlov.id}`] }, null);
        for (let t = 0; t < 20 * 120 && !g.scenario.outcome; t++) step(g, g.fight?.phase === 'choose' ? { act: ['hit'] } : id === 'talk' ? { act: ['talk:leave'] } : {}, null);
        out[id] = g.scenario.outcome;
      }
      const g = newGame({ seed: 2, scenario: 'sdr' });
      start(g, null);
      let k = 2; while (g.scenario.team === 'none') { const h = newGame({ seed: ++k, scenario: 'sdr' }); start(h, null); Object.assign(g, h); }
      for (let t = 0; t < 20 * 60 && !g.scenario.crew.some(c => c.id); t++) step(g, {}, null);
      const me = playerActor(g), w = g.actors.find(a => a.id === g.scenario.crew.find(c => c.id).id), heat0 = Object.values(g.heat)[0];
      Object.assign(me, { row: w.row, x: w.x - 1, z: w.z, busy: null });
      step(g, { act: [`interact:hit:${w.id}`] }, null);
      const flagged = g.scenario.flags.map(f => f.kind);
      console.log(`      Orlov, a word: ${out.talk}; a blow: ${out.hit}; an FSB watcher hit: flags ${flagged.join(', ')}, heat ${heat0} → ${Object.values(g.heat)[0]}`);
      assert(out.talk === 'made' && out.hit === 'blown', 'the tail notices');
      assert(flagged.includes('assaulted') && Object.values(g.heat)[0] > heat0, 'an incident');
    },
  },
];
