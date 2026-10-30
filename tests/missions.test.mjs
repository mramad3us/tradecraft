// Assignments where they happen (sim/places.js missionPlace(), sim/scenarios/campaign.js begin()): each in
// the posting's city has a place on its streets (his office's door, a bench, a café), spread over the
// streets round the flat; the instinct says when to be off, the pointer leads there, and at it in its
// hour T begins it, the scene played there from where you stand, with whoever's on you then; the mind
// has no way to go to it but the waypoint (a trip abroad is still flown out).
import { newGame, start, step, playerActor, newMap } from '../src/sim/game.js';
import { candidates, newCampaign, context, plan, fold, KINDS } from '../src/sim/campaign.js';
import { missionPlace, officeOf, MISSION_ROWS } from '../src/sim/places.js';
import { windowOf } from '../src/sim/scenarios/campaign.js';
import { SCENARIOS } from '../src/sim/scenarios/index.js';
import { DAY, MIN } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

const busOf = () => { const said = [], ran = []; return { said, ran, emit: (k, v) => { if (k === 'assignment') ran.push(v); }, on() {} }; };

/** The hub, Hale's call had, at time ms, in the flat. */
function hub(c, ms) {
  const g = newGame({ seed: c.seed, scenario: 'campaign', campaign: c }), bus = busOf();
  start(g, null);
  step(g, {}, bus);
  for (const k of c.calls ?? []) k.done = g.time.ms;
  g.time.ms = ms; c.awake = ms - 2 * 3600e3;
  for (let k = 0; k < 21; k++) step(g, {}, bus);
  return { g, bus };
}
/** Onto a street of the posting's city at x (as if walked there). */
function onStreet(g, row, x, bus) {
  const p = g.campaign.posting, me = playerActor(g);
  Object.assign(me, { x, z: -2.6, vx: 0, vz: 0, hidden: false });
  newMap(g, bus, { kind: 'street', seed: p.mapSeed, row, i0: null, i1: null, crowd: 1, city: p.city }, x);
  for (let k = 0; k < 21; k++) step(g, {}, bus);
}

export default [
  {
    name: 'missions: each in the posting\'s city has a place on its streets, spread round the flat (never its street or the embassy\'s), the same every time; a tail at his office, a meeting at a bench, a photograph at a café',
    fn() {
      const rows = new Set(), kinds = {}, out = [];
      for (const [seed, city, level] of [[3, 'moscow', 'handler'], [4, 'cairo', 'handler'], [5, 'beirut', 'handler'], [11, 'london', 'junior'], [12, 'moscow', 'handler']]) {
        const c = newCampaign(seed, candidates(seed, city, level)[0], city, level), p = c.posting;
        for (const t of p.targets) t.contact = 1;
        plan(c, p.startMs + 20 * DAY);
        for (const a of c.assignments.filter(x => !x.trip)) {
          const at = missionPlace(c, a);
          assert(at, `${city}: a place for ${a.kind}`);
          assert(at.row !== p.home.row && at.row !== p.embassy.row && Math.abs(at.row - p.home.row) <= MISSION_ROWS, 'off the flat\'s street and the embassy\'s, near enough');
          assert(at.kind === { tail: 'office', sdr: 'bench', watch: 'cafe' }[a.kind], 'its kind of place');
          if (a.kind === 'tail') assert(at === officeOf(c, p.targets.find(t => t.id === a.who)), 'his office, every time');
          rows.add(`${seed}:${at.row}`); kinds[a.kind] = (kinds[a.kind] ?? 0) + 1;
          if (out.length < 8) out.push(`${a.kind} ${at.label} (${at.row - p.home.row > 0 ? '+' : ''}${at.row - p.home.row})`);
        }
        assert(c.assignments.filter(x => x.trip).every(a => missionPlace(c, a) === null), 'a trip abroad has none here');
      }
      console.log(`      ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')} over ${rows.size} streets in five postings; ${out.join('; ')}`);
      assert(rows.size >= 20, 'spread over many streets');
    },
  },
  {
    name: 'missions: from the flat, when to be off and the pointer to it; at the bench in its hour, T begins the meeting there, nobody on you, the scene where you stand; the mind\'s Go for it says it\'s on foot',
    fn() {
      const c = newCampaign(3, candidates(3)[0]), a = c.assignments.find(x => x.kind === 'sdr'), at = missionPlace(c, a);
      const { g, bus } = hub(c, a.from - 70 * MIN);
      const soon = g.scenario.prompt;
      step(g, { act: [`desk:go:${a.id}`] }, bus);
      const refused = g.log.at(-1).text;
      onStreet(g, at.row, at.x - 60, bus);
      const pointer = SCENARIOS.campaign.goal(g), far = g.scenario.prompt;
      onStreet(g, at.row, at.x - 25, bus);
      g.time.ms = windowOf(a)[0] + MIN; for (let k = 0; k < 21; k++) step(g, {}, bus);
      const there = g.scenario.prompt;
      step(g, { act: ['instinct'] }, bus);
      console.log(`      from the flat: "${soon?.text}"; Go from the mind: "${refused}"; 60 m off: "${far?.text}", the pointer "${pointer?.label}"; at it: "${there?.text}" → ${bus.ran.length ? 'begun' : 'nothing'}, the team: ${a.tailedBy}`);
      assert(/Be off by \d\d:\d\d/.test(soon?.text ?? '') && /on foot/.test(refused), 'when to be off; no going from the mind');
      assert(pointer?.x === at.x && pointer.row === at.row, 'the pointer leads to it');
      assert(there?.id === `begin-${a.id}` && bus.ran[0] === a.id && a.tailedBy === 'none' && a.me, 'T at the bench begins it, nobody on you');
      const ctx = context(c, a), s = newGame({ seed: 5, scenario: 'sdr', campaign: c, context: ctx });
      start(s, null);
      const me = playerActor(s);
      assert(s.map.row === at.row && Math.abs(me.x - a.me.x) < 0.01 && s.scenario.meet.x === at.x && ctx.team === 'none' && !s.scenario.crew?.length, 'the scene: its street, where you stood, the bench, nobody behind');
    },
  },
  {
    name: 'missions: a tail begun at his door (you wait till he\'s out), followed from there in autoplay on his street; a photograph at its café; both fold back',
    fn() {
      const out = [];
      for (const seed of [3, 6, 9]) {
        const c = newCampaign(seed, candidates(seed)[0]), p = c.posting;
        p.targets[0].contact = 1;
        plan(c, p.startMs + 14 * DAY);
        for (const kind of ['tail', 'watch']) {
          const a = c.assignments.find(x => x.kind === kind && x.status === 'open');
          if (!a) continue;
          const at = missionPlace(c, a), { g, bus } = hub(c, windowOf(a)[0] + 2 * MIN);
          onStreet(g, at.row, at.x + 18, bus);
          step(g, { act: ['instinct'] }, bus);
          assert(bus.ran[0] === a.id, `${kind}: begun at its place`);
          if (kind === 'tail') assert(g.time.ms >= a.from, 'waited till he came out');
          const s = newGame({ seed: seed * 3, scenario: KINDS[kind].scenario, campaign: c, context: context(c, a), autoplay: kind === 'tail' ? { keep: 20 } : null });
          start(s, null);
          const R = s.map.row, x0 = playerActor(s).x;
          for (let t = 0; t < 20 * 60 * 40 && !s.scenario.outcome; t++) step(s, {}, null);
          const paper = fold(c, a, s.scenario, s.people.me, s.time.ms, s.heat[Object.keys(s.heat)[0]]);
          out.push(`${kind} at ${at.label} (row ${R}, from ${fmt(x0 - at.x, 0)} m): ${s.scenario.outcome}`);
          assert(R === at.row && s.scenario.outcome && a.status === 'done', 'played on its street, to an end, folded');
        }
      }
      console.log(`      ${out.join('; ')}`);
      assert(out.length >= 5, 'played');
    },
  },
];
