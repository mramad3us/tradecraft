// The feel (sim/sense.js): eyes on you felt out of your sight, your quarry felt wherever he's gone, by Tradecraft
// and a skill and the dice; what's felt is on the map (sim/perception.js). The files in debug mode, Tradecraft's
// growth. And a book, sat somewhere, ten minutes at a time (sim/reading.js).
import { newGame, start, step, playerActor, loadRow } from '../src/sim/game.js';
import { newCampaign, candidates, legendFile, LEGENDS, DEFAULT_LEGEND, fold } from '../src/sim/campaign.js';
import { feelM, feelOf, feltOf, tradecraftMod, feelWords, EYES_DC, QUARRY_DC, QUARRY_PER_M } from '../src/sim/sense.js';
import { eyes, visibility, inView, SEEN, feltPatches, sharpM } from '../src/sim/perception.js';
import { skill } from '../src/sim/skills.js';
import { act, affordance } from '../src/sim/acts.js';
import { sectionOf } from '../src/sim/city.js';
import { townOf } from '../src/sim/cities/index.js';
import { at } from '../src/sim/clock.js';
import { placed, fits } from '../src/sim/items.js';
import { unpack, shed } from '../src/sim/clothes.js';
import { cardOf, seat, READ_MIN } from '../src/sim/reading.js';
import { teamOf } from '../src/sim/scenarios/sdr.js';
import { haleCall, KNOWS } from '../src/sim/hale.js';
import { assert, fmt } from './helpers.mjs';

// (an officer of so much Tradecraft, a trained base in the street skills)
const officer = (os, base) => {
  const skills = Object.fromEntries(['deception', 'tracking', 'pathfinding', 'awareness'].map(k => [k, [base, 1]]));
  return { name: 'Test Officer', sex: 'f', age: 40, os, cls: 'spook', skills: { social: [10, 0], analysis: [5, 0], tech: [5, 0], medicine: [5, 0], cqc: [5, 1], weapons: [5, 0], fitness: [5, 1], ...skills }, look: { skin: 'light', hair: { style: 'bun', color: 0x47302a }, top: { kind: 'coat', color: 0x353947, trim: 0x23252f }, legs: 0x23252f, shoes: 0x14151c } };
};
const LADDER = [['a Handler', 38, 10], ['a good one', 60, 12], ['a master', 80, 15], ['a legend', 95, 20]];

/** On a bench, sat (the walk, at the hour given): the game, the player's actor. */
function onBench({ h = 12, weather = 'clear', books = [{ id: 'maps', read: 0 }], scenario = 'walk' } = {}) {
  const g = newGame({ seed: 4, scenario, weather });
  start(g, null);
  g.time.ms = at(2026, 11, 2, h, 0);
  const town = townOf(g.map);
  let found = null;
  for (let row = 0; row < 6 && !found; row++) for (let i = 0; i < 8 && !found; i++) { const b = sectionOf(town, row, i).props.find(p => p.kind === 'bench'); if (b) found = { row, x: b.seats[0] }; }
  const me = playerActor(g);
  Object.assign(me, { x: found.x, z: 13.3, row: found.row });
  loadRow(g, null, found.row, found.x, { quiet: true });
  g.people.me.books = books;
  act(g, null, me, 'bench');
  for (let t = 0; t < 60 && me.gait !== 'sit'; t++) step(g, {}, null);
  assert(me.gait === 'sit', 'sat on the bench');
  return { g, me, p: g.people.me };
}

export default [
  {
    name: 'the feel: what Tradecraft comes to: its reach, and the odds of a roll, up the ladder',
    fn() {
      for (const [who, os, base] of LADDER) {
        const p = { ...officer(os, base) }, v = feelOf(p, 'tracking'), w = feelWords(p);
        const odds = (dc) => Math.max(5, Math.min(95, (21 - (dc - v)) * 5));
        console.log(`      ${who} (Tradecraft ${os}, base ${base}): feel ${v} (+${tradecraftMod(os)}), reach ${Math.round(feelM(p, 'tracking'))} m, all round +${fmt(sharpM(os))} m; a covert team ${odds(EYES_DC + 18 + 3)}% a roll; a quarry at 30 m ${odds(QUARRY_DC + Math.round(30 / QUARRY_PER_M))}%, 120 m ${odds(QUARRY_DC + Math.round(120 / QUARRY_PER_M))}%, 300 m ${odds(QUARRY_DC + Math.round(300 / QUARRY_PER_M))}% (the sheet: ${w.overt}, ${w.covert}, ${w.quarry})`);
      }
      const reach = LADDER.map(([, os, base]) => feelM(officer(os, base), 'tracking'));
      assert(reach[0] < 60 && reach[2] > 180 && reach[3] > 400, 'a Handler\'s feel is close; a master\'s, a long way; a legend\'s, insane');
      assert(tradecraftMod(30) <= 3 && tradecraftMod(80) === 16, 'steep');
      assert(sharpM(45) === 0 && sharpM(80) > 4 && sharpM(95) > 10, 'an ordinary eye as it was; a master\'s wider');
    },
  },
  {
    name: 'the feel: what\'s felt is on the map, through a wall, and in view for the rolls, till it fades',
    fn() {
      const g = newGame({ seed: 7, scenario: 'walk', weather: 'clear' });
      start(g, null);
      for (let t = 0; t < 40; t++) step(g, {}, null);
      const me = playerActor(g), other = g.actors.find(a => a !== me && !inView(g, a.id) && !a.hidden && (a.row ?? g.map.row) === g.map.row && visibility(g, eyes(g, me), a.x, a.z) < SEEN);
      assert(other, 'someone out of sight');
      const was = visibility(g, eyes(g, me), other.x, other.z);
      g.mind.felt = { [other.id]: { ox: 0, oz: 0, r: 5, k: 1, until: g.time.ms + 3000, why: 'eyes', grade: 2, ms: g.time.ms, path: [] } };
      const now = visibility(g, eyes(g, me), other.x, other.z), walked = feltPatches(g);
      step(g, {}, null);
      assert(was < SEEN && now === 1 && walked.length === 1 && inView(g, other.id), `felt: ${fmt(was)} → ${fmt(now)}, and in view`);
      for (let t = 0; t < 120; t++) step(g, {}, null);
      assert(!feltOf(g, other.id) && !feltPatches(g)?.length, 'gone when it fades');
      console.log(`      out of sight ${fmt(was)}, felt ${fmt(now)}; ${Math.round(Math.hypot(other.x - me.x, other.z - me.z))} m off`);
    },
  },
  {
    name: 'the feel: a covert team behind you, not looked at: when you feel them, and when you know it\'s a tail, up the ladder',
    heavy: true,
    fn() {
      const out = [];
      for (const [who, os, base] of LADDER) {
        const first = [], sure = [], flags = [];
        for (let seed = 1; seed < 40 && first.length < 6; seed++) {
          const g = newGame({ seed, scenario: 'sdr', character: officer(os, base), weather: 'clear' });
          start(g, null);
          if (g.scenario.team !== 'covert') continue;
          g.scenario.meet.from = g.scenario.meet.to = 1e15;           // (nobody to meet: only the walk)
          let felt = null, known = null;
          for (let k = 0; k < 20 * 150 && !g.scenario.outcome; k++) {
            step(g, { mx: 1 }, null);
            if (felt === null && g.mind.felt && Object.values(g.mind.felt).some(f => f.why === 'eyes')) felt = k / 20;
            if (known === null && Object.values(teamOf(g).faces).some(f => f.crew && f.sure)) known = k / 20;
          }
          first.push(felt); sure.push(known); flags.push(teamOf(g).flags.length);
        }
        const got = first.filter(x => x !== null), kn = sure.filter(x => x !== null), mean = (l) => (l.length ? fmt(l.reduce((a, b) => a + b, 0) / l.length, 0) : '-');
        out.push({ os, felt: got.length, known: kn.length, n: first.length });
        console.log(`      ${who}: felt in ${got.length} of ${first.length} walks of 150 s (after ${mean(got)} s), known for a tail in ${kn.length} (after ${mean(kn)} s), written down ${fmt(flags.reduce((a, b) => a + b, 0) / flags.length)}`);
      }
      assert(out[3].known === out[3].n && out[2].felt === out[2].n, 'a master feels them every time; a legend knows it\'s a tail every time');
      assert(out[0].known < out[0].n, 'a Handler mostly doesn\'t know from the back of the neck alone');
    },
  },
  {
    name: 'the feel: stood still while he walks away, for five minutes: a Handler loses him, a legend never does, and he never sees either',
    fn() {
      const res = [];
      for (const [who, os, base] of [LADDER[0], LADDER[2], LADDER[3]]) {
        const g = newGame({ seed: 11, scenario: 'tail', character: officer(os, base), weather: 'clear' });
        start(g, null);
        const sc = g.scenario, t = g.actors.find(a => a.id === sc.target);
        let far = 0, rows = 0, ticks = 0;
        for (; ticks < 20 * 300 && !sc.outcome; ticks++) {
          step(g, {}, null);
          if (feltOf(g, t.id)) { far = Math.max(far, Math.hypot(t.x - playerActor(g).x, (t.row ?? 0) === g.map.row ? t.z - playerActor(g).z : 0)); rows = Math.max(rows, Math.abs((t.row ?? 0) - g.map.row)); }
        }
        res.push({ who, outcome: sc.outcome, far, rows, sightings: sc.sightings.length });
        console.log(`      ${who}: ${sc.outcome ?? 'still has him'} after ${fmt(ticks / 20, 0)} s; felt out to ${fmt(far, 0)} m along, ${rows} streets off; he saw them ${sc.sightings.length} times`);
      }
      assert(res[0].outcome === 'lost', 'a Handler stood still loses him');
      assert(!res[2].outcome && res[2].far > 100, 'a legend still has him, a long way off');
      assert(res.every(r => r.sightings <= 1), 'nobody made from there');
    },
  },
  {
    name: 'debug mode\'s files: Tradecraft 95, each for a reason of its own, and a campaign to play them in; and Tradecraft grows',
    fn() {
      const seen = new Set(), ages = new Set(), tops = new Set();
      for (let seed = 1; seed <= 200; seed++) {
        const city = ['moscow', 'london', 'beirut', 'cairo'][seed % 4], p = legendFile(seed, city);
        seen.add(p.legend); ages.add(p.age); tops.add(Object.entries(p.skills).sort((a, b) => b[1][0] + b[1][1] - a[1][0] - a[1][1])[0][0]);
        assert(p.os === 95 && p.background.length > 60 && p.persistent && p.look?.top && p.langs[city === 'london' ? 'en' : city === 'moscow' ? 'ru' : 'ar'], `a whole file: ${p.name}`);
        for (const k of Object.keys(p.skills)) assert(skill(p, k) <= 46, `${p.name} ${k}: ${skill(p, k)}`);
      }
      for (const L of LEGENDS) assert(L.names.f.length && L.names.m.length && L.text.length < 260, `${L.id}'s words`);
      // (what a file's reason gives it, mastered: every skill it raises to expert or past is a master's 20)
      const masters = LEGENDS.map(L => {
        const raised = Object.entries(L.skills).filter(([k, [b]]) => b > DEFAULT_LEGEND[k][0] && b >= 15);
        for (const [k, [b]] of raised) assert(b === 20, `${L.id}'s ${k} is its reason's, and mastered: ${b}`);
        const m = Object.entries({ ...DEFAULT_LEGEND, ...L.skills }).filter(([, [b]]) => b === 20).map(([k]) => k);
        assert(m.length >= 2, `${L.id} a master of something: ${m.join(', ')}`);
        return `${L.id} ${m.length}`;
      });
      console.log(`      masters of what their reason gives them: ${masters.join(', ')}`);
      // (each its reason for starting again, and Hale knows who he's talking to: sim/hale.js)
      for (const L of LEGENDS) assert(L.anew?.length > 60 && L.anew.length < 200 && KNOWS[L.id], `${L.id}: why they're back (${L.anew?.length}), and Hale's line`);
      const plain = haleCall(newCampaign(3, candidates(3)[0], 'moscow'), 'Moscow'), seenLines = new Set();
      for (const level of ['junior', 'handler']) for (let n = 0; n < LEGENDS.length; n++) {
        const city = level === 'junior' ? 'london' : 'moscow', p = legendFile(3, city, level, n), L = LEGENDS.find(x => x.id === p.legend);
        const call = haleCall(newCampaign(3, p, city, level), city === 'london' ? 'London' : 'Moscow'), text = call.lines.join(' ');
        assert(p.anew === L.anew && text.includes(KNOWS[L.id]) && !text.includes('Before they let you near anyone') && call.choices.some(c => c.key === 'tutorial') && call.choices.some(c => c.key === 'begin'), `${L.id} at ${level}: not a new officer's call`);
        assert(level === 'junior' ? /first tour/.test(text) : /network to run/.test(text), `${L.id} at ${level}: what the paper makes of them`);
        assert((L.id === 'deaf') === /relay service/.test(text), `${L.id}: the relay`);
        seenLines.add(text);
      }
      const again = haleCall(newCampaign(3, legendFile(3), 'moscow'), 'Moscow', false);
      assert(/Before they let you near anyone/.test(plain.lines.join(' ')) && !/Before they let/.test(again.lines.join(' ')), 'the ordinary call as it was; called back, a legend\'s own');
      console.log(`      Hale: ${seenLines.size} different calls to the files; to ${legendFile(3).name}, ${legendFile(3).legend}: ${haleCall(newCampaign(3, legendFile(3), 'moscow'), 'Moscow').lines.join(' ')}`);
      const a = legendFile(5), b = legendFile(5), c = legendFile(5, 'moscow', 'handler', 1);
      assert(a.name === b.name && JSON.stringify(a.skills) === JSON.stringify(b.skills), 'the same seed, the same file');
      assert(seen.size === LEGENDS.length && ages.size > 12, `all of them turn up: ${seen.size} of ${LEGENDS.length}`);
      console.log(`      ${seen.size} reasons, ${ages.size} ages, strongest in ${[...tops].join(', ')}; e.g. ${a.name}, ${a.age}; another file: ${c.name}, ${c.age}`);
      const C = newCampaign(7, legendFile(7), 'moscow');
      const g = newGame({ seed: 7, scenario: 'campaign', campaign: C });
      start(g, null);
      for (let t = 0; t < 20; t++) step(g, {}, null);
      assert(g.people.me.os === 95, 'played');
      const ordinary = candidates(7)[0], D = newCampaign(7, ordinary, 'moscow'), was = ordinary.os, t = D.posting.targets[0];
      const job = { id: 'x', kind: 'tail', who: t.id, status: 'open' };
      const paper = fold(D, job, { outcome: 'seen', sightings: [] }, ordinary, D.posting.startMs);
      assert(D.character.os === was + 2 && paper.lines.some(l => /Tradecraft/.test(l)), 'a tail that saw the meeting: Tradecraft up');
    },
  },
  {
    name: 'a book on a bench: R offers it, ten minutes at a time for as long as you like, its hours taught; a book finished passes the time',
    fn() {
      const { g, me, p } = onBench();
      const offer = affordance(g, me), asked = [], bus = { emit: (k, v) => { if (k === 'reading') asked.push(v); }, on() {} };
      assert(offer?.act === 'read' && /Atlas/.test(offer.text), `offered (${offer?.text})`);
      step(g, { act: ['use'] }, bus);
      assert(asked.length === 1 && asked[0].list[0].key === 'on:maps' && asked[0].list.at(-1).key === 'close', 'the card');
      const t0 = g.time.ms, base = p.skills.pathfinding?.[0];
      for (let k = 0; k < 18; k++) step(g, { act: ['read:on:maps'] }, bus);
      const mins = (g.time.ms - t0) / 60000;
      assert(Math.round(mins) === 18 * READ_MIN, `three hours by the clock: ${mins}`);
      assert(p.books[0].read === 3, `three hours of it: ${p.books[0].read}`);
      assert(me.gait === 'sit', 'still sat there');
      for (let k = 0; k < 24; k++) { g.time.ms = at(2026, 11, 2, 12, 0); step(g, { act: ['read:on:maps'] }, bus); }   // (held at noon: the bench's light runs out, rightly)
      assert(p.books[0].read === 7, `the whole of it: ${p.books[0].read}`);
      console.log(`      ${asked.length} cards, ${fmt(mins / 60)} h by the clock, the atlas ${p.books[0].read} h of 7; Pathfinding base ${base}; last card: ${asked.at(-1).title}: ${asked.at(-1).list[0].label}`);
      const train = JSON.stringify(p.training);
      step(g, { act: ['read:on:maps'] }, bus);
      assert(JSON.stringify(p.training) === train && p.books[0].read === 7 && /again/.test(asked.at(-1).list[0].label), 'read again: the time passes, nothing taught');
      const n = asked.length;
      step(g, { act: ['read:close'] }, bus);
      assert(asked.length === n, 'shut: no more cards');
    },
  },
  {
    name: 'a book: not in the dark on a bench, nor in the rain; what you carry it in; a novel teaches nothing; in a lived scene, cover',
    fn() {
      const night = onBench({ h: 21 }), wet = onBench({ weather: 'rain' });
      console.log(`      at night: ${affordance(night.g, night.me)?.text}; in the rain: ${affordance(wet.g, wet.me)?.text}`);
      assert(affordance(wet.g, wet.me)?.act === null && /rain/.test(affordance(wet.g, wet.me).text), 'the rain would have the pages');
      const d = onBench({ books: [{ id: 'coldspy', read: 0 }] }), tr = JSON.stringify(d.p.training ?? null);
      step(d.g, { act: ['read:on:coldspy'] }, null);
      assert(d.p.books[0].read > 0 && JSON.stringify(d.p.training ?? null) === tr, 'a novel: read, and nothing taught');
      // (a paperback goes in a coat's pocket, not a jumper's nothing: and what won't fit, the bag, then the shelf)
      const coat = { look: { top: { kind: 'coat' } }, persistent: true, books: [{ id: 'maps', read: 0 }] };
      assert(placed(coat).out.find(o => o.kind === 'book')?.at, 'a coat has room for it');
      const jumper = { ...coat, look: { top: { kind: 'sweater' } }, books: [{ id: 'maps', read: 0 }] };
      assert(!fits({ ...jumper, books: [] }, 'book'), 'a jumper and trousers don\'t');
      assert(shed(jumper) === 1 && jumper.books[0].at === 'bag' && jumper.bag[0].book === 'maps', 'shed, into the bag');
      unpack(jumper);
      assert(jumper.books[0].at === 'home' && !jumper.bag, 'unpacked, on the shelf');
      // (a tail: the book's cover, and no clock skipped)
      const { g, me } = onBench({ scenario: 'sdr' }), t0 = g.time.ms;
      assert(g.scenario.kind === 'sdr' && seat(g, me) === 'bench', 'sat, in a scene that\'s lived');
      step(g, { act: ['use'] }, null);
      assert(me.busy?.book === 'maps' && g.time.ms - t0 < 1000, 'open on your knee, nothing skipped');
      assert(cardOf(g, me).list.length === 2, 'the card reads the same; it just isn\'t asked for');
    },
  },
];
