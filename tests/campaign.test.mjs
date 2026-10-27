// The campaign (sim/campaign.js, sim/scenarios/campaign.js): its generators (candidates, the posting,
// the assignments, a month of them, making sense), the hub's day (work, sleep, days missed, pay, the
// week's review), and assignments run with the campaign's context and folded back: a meeting by way of
// a detection run, a tail; the character's body carried through.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { candidates, newCampaign, plan, pass, context, fold, agenda, lieLow, KINDS, CADENCE } from '../src/sim/campaign.js';
import { DAY, HOUR, calendar } from '../src/sim/clock.js';
import { injure, bloodOf } from '../src/sim/health.js';
import { oblivious } from './bots.mjs';
import { seedRng } from '../src/sim/rng.js';
import { skill } from '../src/sim/skills.js';
import { assert, fmt } from './helpers.mjs';

export default [
  {
    name: 'campaign: the generators: three officers to pick from, a posting, four weeks of assignments that make sense (one a day at most, evenings and weekends, no overlap, only the posting\'s people)',
    fn() {
      let n = 0, kinds = {}, gaps = [];
      for (let seed = 1; seed <= 30; seed++) for (const city of ['moscow', 'london', 'beirut', 'cairo']) {
        const cs = candidates(seed, city);
        assert(new Set(cs.map(c => c.background)).size === 3 && cs.every(c => c.name && c.langs.en === 'native'), 'three different officers');
        const c = newCampaign(seed, cs[0], city), p = c.posting;
        assert(p.assets.length >= 1 && p.targets.length >= 1 && p.subject && p.mapSeed >= 0, 'a posting with a network and a target');
        pass(c, p.startMs, p.startMs + 28 * DAY);
        const all = c.assignments, days = new Set();
        for (const a of all) {
          const k = calendar(a.from), d = Math.floor(a.from / DAY);
          assert(!days.has(d), `one a day (${seed} ${city})`); days.add(d);
          assert(a.from >= p.startMs && a.start <= a.from && a.to > a.from, 'in order, not in the past');
          assert(k.weekday < 5 ? k.hour >= 17 : k.hour >= 13, `an evening, or a weekend afternoon (${k.weekday} ${k.hour})`);
          assert(a.kind === 'sdr' ? p.assets.some(s => s.id === a.who) : p.targets.some(t => t.id === a.who), 'the posting\'s own people');
          kinds[a.kind] = (kinds[a.kind] ?? 0) + 1; n++;
        }
        const ds = [...days].sort((a, b) => a - b);
        for (let i = 1; i < ds.length; i++) gaps.push(ds[i] - ds[i - 1]);
      }
      console.log(`      120 postings, four weeks each: ${n} assignments (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}), ${fmt(n / 120 / 4, 1)} a week; days between them ${fmt(gaps.reduce((a, b) => a + b, 0) / gaps.length, 1)} on average`);
      const c = newCampaign(7, candidates(7)[1]);
      console.log(`      e.g. ${c.character.name}, ${c.character.background} Posting: ${c.posting.subject} (${c.posting.goal}). ${c.assignments[0].brief}`);
      assert(n / 120 / 4 > 1.5 && n / 120 / 4 < 5, 'a few a week');
    },
  },
  {
    name: 'campaign: the hub\'s day: a day at the embassy (cover standing up), sleep till seven, working days missed (it shows), pay on the first, the week\'s review on Sunday night',
    fn() {
      const c = newCampaign(3, candidates(3)[0]);
      const g = newGame({ seed: 3, scenario: 'campaign', campaign: c });
      const papers = [], bus = { emit: (k, v) => { if (k === 'papers') papers.push(...v); }, on() {} };
      start(g, null);
      for (let t = 0; t < 20; t++) step(g, {}, bus);
      const t0 = g.time.ms, cover0 = c.posting.cover;
      step(g, { act: ['desk:work'] }, bus);
      const worked = calendar(g.time.ms).hour, cover1 = c.posting.cover;
      step(g, { act: ['desk:sleep'] }, bus);
      const woke = calendar(g.time.ms);
      for (let i = 0; i < 31; i++) step(g, { act: ['desk:sleep'] }, bus);   // (a month of nothing but sleep)
      console.log(`      from ${calendar(t0).hour}:00: worked till ${worked}:00 (cover ${cover0} → ${cover1}); slept till ${woke.hour}:00; a month in bed: cover ${c.posting.cover}, papers ${papers.map(p => p.title).join(', ')}`);
      assert(worked === 18 && cover1 > cover0 && woke.hour === 7, 'worked till six, slept till seven');
      assert(c.posting.cover < cover1 - 30, 'working days missed show');
      assert(papers.some(p => p.kind === 'pay') && papers.filter(p => p.kind === 'review').length >= 3, 'pay, and a review a week');
      assert(c.done.some(a => a.status === 'missed'), 'and the assignments slept through are missed');
    },
  },
  {
    name: 'campaign: what heat costs: an asset met with a tail on you is taken in the days after; heat at the top, and you\'re expelled; lying low cools it, faster at a safe house',
    fn() {
      const c = newCampaign(9, candidates(9)[0]), p = c.posting;
      p.assets[0].burned = true;
      let papers = [];
      for (let d = 0; d < 20 && p.assets.some(s => s.burned); d++) papers.push(...pass(c, p.startMs + d * DAY, p.startMs + (d + 1) * DAY));
      const taken = papers.find(x => x.kind === 'news');
      p.heat = 60; const h0 = p.heat; lieLow(c, p.startMs); const h1 = p.heat; lieLow(c, p.startMs, true); const h2 = p.heat;
      p.heat = 96; const end = pass(c, p.startMs + 30 * DAY, p.startMs + 31 * DAY);
      console.log(`      ${taken?.title} (after ${papers.indexOf(taken) + 1} papers); lying low: heat ${h0} → ${h1}, at a safe house → ${h2}; at 96: ${end.map(x => x.title).join(', ')}`);
      assert(taken && !p.assets.some(s => s.codename === taken.title.split(':')[0]), 'taken, and gone from the network');
      assert(h0 - h1 >= 6 && h1 - h2 > h0 - h1 - 1 && c.over?.why === 'expelled' && end.some(x => x.kind === 'over'), 'lying low cools; at the top, expelled');
    },
  },
  {
    name: 'campaign: the arc: a tail that sees the meeting names the contact, a new man to watch; an asset trusted enough brings more; the goal met, the posting\'s done',
    fn() {
      const c = newCampaign(21, candidates(21)[0]), p = c.posting, lines = [];
      const t = c.assignments.find(a => a.kind === 'tail' && a.status === 'open') ?? (plan(c, p.startMs + 10 * DAY), c.assignments.find(a => a.kind === 'tail' && a.status === 'open'));
      lines.push(...fold(c, t, { outcome: 'seen' }, c.character, t.to).lines);
      const named = p.targets.length;
      let n = 0;
      while (!c.over && n++ < 20) {
        const a = c.assignments.find(x => x.kind === 'sdr' && x.status === 'open') ?? (plan(c, p.startMs + n * 7 * DAY), c.assignments.find(x => x.kind === 'sdr' && x.status === 'open'));
        lines.push(...fold(c, a, { outcome: 'clean' }, c.character, a.to).lines);
      }
      console.log(`      targets now ${named} (${p.targets.map(x => x.name).join(', ')}); ${n} clean meetings to the goal, intelligence ${p.intelligence}; over: ${c.over?.why}; ${lines.filter(l => /trusts you|lead|needed/.test(l)).join(' | ')}`);
      assert(named === 2 && p.targets[1].name, 'the contact, a target of his own');
      assert(c.over?.why === 'completed' && p.intelligence >= 10 && n >= 4 && n <= 9, 'the goal met in a few weeks of clean meetings');
    },
  },
  {
    name: 'campaign: fatigue: up 16 hours, −1 to every skill; 20, −3; sleep wipes it; the instinct says so',
    fn() {
      const c = newCampaign(5, candidates(5)[0]);
      const g = newGame({ seed: 5, scenario: 'campaign', campaign: c });
      start(g, null);
      const base = skill(g.people.me, 'awareness'), row = [];
      for (const h of [17, 21]) {
        g.time.ms = c.awake + h * HOUR; step(g, {}, null);
        for (let t = 0; t < 20; t++) step(g, {}, null);
        row.push([h, g.people.me.strain ?? 0, skill(g.people.me, 'awareness'), g.scenario.prompt?.id]);
      }
      step(g, { act: ['desk:sleep'] }, null);
      for (let t = 0; t < 20; t++) step(g, {}, null);
      console.log(`      awareness ${base}; ${row.map(([h, v, a, id]) => `${h} h up: ${v} (${a}), the instinct: ${id}`).join('; ')}; slept: ${g.people.me.strain ?? 0} (${skill(g.people.me, 'awareness')})`);
      assert(row[0][1] === -1 && row[1][1] === -3 && row[0][2] === base - 1 && /^tired/.test(row[1][3]), 'tired, then exhausted');
      assert(!g.people.me.strain && skill(g.people.me, 'awareness') === base, 'sleep wipes it');
    },
  },
  {
    name: 'campaign: assignments run with the campaign\'s context and fold back: a meeting (the asset\'s codename, the heat\'s team), a tail (the target\'s name); the posting changes; the character\'s wounds go with them',
    fn() {
      const out = [];
      for (const seed of [11, 12, 13, 14]) {
        const c = newCampaign(seed, candidates(seed)[0]);
        injure(c.character, 'armL', 0.2, seedRng(seed), c.posting.startMs, { edge: true });   // (a cut from the night before)
        for (const kind of ['sdr', 'tail']) {
          const a = c.assignments.find(x => x.kind === kind && x.status === 'open');
          if (!a) continue;
          const ctx = context(c, a), g = newGame({ seed: seed * 7 + (kind === 'tail' ? 1 : 0), scenario: KINDS[kind].scenario, campaign: c, context: ctx, autoplay: kind === 'tail' ? { keep: 20 } : null });
          start(g, null);
          assert(g.time.ms === a.start && g.map.seed === c.posting.mapSeed && g.people.me.name === c.character.name, 'the campaign\'s time, city and character');
          const named = kind === 'sdr' ? g.people.solovey.name === c.posting.assets.find(s => s.id === a.who).codename : g.people.orlov.name === c.posting.targets[0].name;
          assert(named, 'the campaign\'s people');
          for (let t = 0; t < 20 * 60 * 40 && !g.scenario.outcome; t++) step(g, kind === 'sdr' ? oblivious(g, playerActor(g)) : {}, null);
          const before = { intel: c.posting.intelligence, heat: c.posting.heat };
          const paper = fold(c, a, g.scenario, g.people.me, g.time.ms, g.heat[Object.keys(g.heat)[0]]);
          out.push(`${kind} → ${g.scenario.outcome} (${paper.lines[0].slice(0, 60)}…), intelligence ${before.intel}→${c.posting.intelligence}, heat ${before.heat}→${c.posting.heat}`);
          assert(a.status === 'done' && c.character.injuries?.length, 'folded; the cut still on them');
        }
      }
      for (const o of out) console.log(`      ${o}`);
      assert(out.length >= 6, 'played through');
    },
  },
];
