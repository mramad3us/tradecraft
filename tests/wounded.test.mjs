// The wounded, after the shot (sim/health.js knockS(), staysDown(), canCrawl(), exertion(), casualty(); sim/wounded.js):
// a bullet knocks them down for seconds to a couple of minutes by the wound, the pain and the blood, the trained
// quicker; out cold stays down; the legs gone, they crawl; otherwise what the wounds do decides (sim/health.js woundsNow():
// the pain as felt, adrenaline off it, against what their Fitness bears; the blood lost; dizziness): walking off, sat at the
// wall when dizzy and safe, running for their lives with you there and a gun in your hand, down past what they can bear or in
// shock; moving bleeds faster; an officer past it drops out of the fight; a graze along the skull bleeds a lot, slowly; and
// they're casualties all the while: called in, and the ambulance comes to where they sit.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { bullet } from '../src/sim/shooting.js';
import { MODELS } from '../src/sim/firearms.js';
import { person } from '../src/sim/interact.js';
import { sheet } from '../src/sim/people.js';
import { makeAgent } from '../src/sim/agents.js';
import { hurt, takes, bloodOf, staysDown, canCrawl, casualty, exertion, woundsNow, painLimit, adrenalK, surge, ADRENALINE, KNOCK_MAX_S, CRAWL_MS, EXERTION } from '../src/sim/health.js';
import { painOf } from '../src/sim/medicine.js';
import { stateOf, PARTS } from '../src/sim/health.js';
import { newGun } from '../src/sim/firearms.js';
import { armCop } from '../src/sim/armed.js';
import { stream } from '../src/sim/rng.js';
import { GRAZE_RATE } from '../src/sim/shooting.js';
import { WALL } from '../src/sim/wounded.js';
import { eyes, sees } from '../src/sim/perception.js';
import { LINE } from '../src/sim/city.js';
import { at } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

// (a street, you on the far pavement, and a passer-by 5 m along it from you, about to be shot; night: 11 at night)
function scene({ seed = 4, night = false } = {}) {
  const g = newGame({ seed, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
  start(g, null);
  if (night) g.time.ms = at(2026, 11, 2, 23, 0);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g), row = g.map.row ?? 0;
  const a = g.actors.filter(x => x !== me && x.ai?.civ && !x.hidden && (x.row ?? row) === row).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z))[0];
  Object.assign(a, { row, x: me.x + 5, z: LINE.F, vx: 0, vz: 0 });
  return { g, me, a };
}
const secs = (g, n, each = null) => { for (let t = 0; t < 20 * n; t++) { step(g, {}, null); each?.(t); } };
/** Shot (part) and watched for up to `s` seconds: when they moved, how far along, when they sat, how fast at most, the blood. */
function watch(w, part, s = 240, after = null) {
  const { g, me, a } = w, words = bullet(g, null, a, part, MODELS.makarov, me), p = g.people[a.who];
  after?.(p);
  const t0 = g.time.ms, x0 = a.x, knock = (a.ai.downUntil - t0) / 1000, gaits = new Set();
  let up = null, sat = null, vmax = 0, crawl = 0;
  secs(g, s, () => {
    const v = Math.hypot(a.vx, a.vz);
    if (v > 0.05) { up ??= (g.time.ms - t0) / 1000; vmax = Math.max(vmax, v); if (a.gait === 'down') crawl++; gaits.add(a.gait); }
    if (a.ai.hurt?.sat && sat === null) sat = (g.time.ms - t0) / 1000;
  });
  return { words, p, knock, up, sat, along: (a.x - x0) * Math.sign(x0 - me.x), vmax, crawl, gaits: [...gaits], blood: bloodOf(p) };
}

export default [
  {
    name: 'wounded: knocked down by the wound, the pain and the blood: an arm seconds, a leg ten to thirty, the body a minute or so; the trained quicker; never past a few minutes',
    fn() {
      const w = scene(), { g, me } = w, rows = {}, N = 30;
      g.people.cop1 = sheet({ id: 'cop1', name: 'a police officer', cls: 'cop', skills: { awareness: [8, 0] } });
      const cop = makeAgent(g, { who: 'cop1', row: g.map.row ?? 0, x: me.x + 6, z: LINE.F });
      for (const [key, a, part] of [['arm', w.a, 'armL'], ['leg', w.a, 'legs'], ['body', w.a, 'torso'], ['body, trained', cop, 'torso']]) {
        const out = [];
        for (let k = 0; k < N; k++) {
          const p = person(g, a);
          Object.assign(p, { body: {}, injuries: [] }); delete p.blood; delete p.dead; a.ai.downUntil = 0; delete a.ai.hurt;
          g.time.ms += 1000;
          bullet(g, null, a, part, MODELS.makarov, me);
          const went = p.injuries.find(i => i.gunshot && !i.internal)?.part ?? '';
          if (!p.dead && went.startsWith(part === 'torso' ? 'torso' : part.slice(0, 3))) out.push((a.ai.downUntil - g.time.ms) / 1000);   // (aimed at the body, one in eight takes an arm: not the body's)
        }
        rows[key] = { mean: out.reduce((s, v) => s + v, 0) / out.length, min: Math.min(...out), max: Math.max(...out) };
      }
      console.log(`      down for (s, of ${N}): ${Object.entries(rows).map(([k, r]) => `${k} ${fmt(r.mean, 0)} (${fmt(r.min, 0)}–${fmt(r.max, 0)})`).join('; ')}`);
      assert(rows.arm.mean < rows.leg.mean && rows.leg.mean < rows.body.mean, 'an arm the least, the body the most');
      assert(rows.arm.max < 30 && rows.body.min >= 15 && Object.values(rows).every(r => r.max <= KNOCK_MAX_S), 'seconds to a couple of minutes, no more');
      assert(rows['body, trained'].mean < rows.body.mean * 0.6, 'the trained up quicker');
    },
  },
  {
    name: 'wounded: shot in the arm, your hands empty: up in seconds, walking off; sat against the wall once the blood lost makes them dizzy, or the pain\'s past what they bear, and staying there',
    fn() {
      const rows = [];
      for (const seed of [4, 5, 6]) {
        const w = scene({ seed }), o = watch(w, 'armL', 600), a = w.a, H = a.ai.hurt;
        rows.push(`seed ${seed}: down ${fmt(o.knock, 0)} s, moving at ${fmt(o.up, 0)} s, sat at ${fmt(o.sat, 0)} s, ${fmt(o.along, 1)} m off, ${a.gait}; blood ${fmt(o.blood, 0)}%, pain ${H?.fx?.pain} of ${H?.fx?.limit}${H?.fx?.dizzy ? ', dizzy' : ''}`);
        if (w.g.people[a.who].dead || bloodOf(w.g.people[a.who]) < 55) continue;   // (an artery: down in the street, as it should be)
        assert(o.up !== null && o.up < 40 && o.along > 3, `seed ${seed}: up and walking off (${rows.at(-1)})`);
        assert(o.sat === null || H.fx.dizzy || H.fx.pain >= H.fx.limit, `seed ${seed}: sat only for a reason (${rows.at(-1)})`);
        if (o.sat !== null) { const x = a.x; secs(w.g, 30); assert(a.x === x && (a.gait === 'slump' || a.gait === 'down'), 'and stays there'); }
      }
      console.log(`      ${rows.join('\n      ')}`);
    },
  },
  {
    name: 'wounded: adrenaline takes the pain off for a while (60% for 40 s, gone by two minutes); what they bear by Fitness; past it they stop',
    fn() {
      const p = sheet({ id: 'q', name: 'Q', cls: 'civilian', skills: { fitness: [5, 0] } });
      hurt(p, 'torso', takes(p, 'torso') * 0.75);
      p.injuries = [{ part: 'torso', kind: 'cut', name: 'a gunshot wound in the body', ms: 0, until: 1e12, bleed: 0, rate: 0, deep: true, gunshot: true }];
      const raw = painOf(p, stateOf, Object.keys(PARTS));
      surge(p, 0);
      const felt = (s) => { p.$adrenal = ADRENALINE.k * adrenalK(p, s * 1000); return Math.round(woundsNow(p, s * 1000).pain); };
      const t = { 0: felt(0), 30: felt(30), 80: felt(80), 120: felt(120), 200: felt(200) };
      const limits = [0, 5, 10, 20].map(f => painLimit(sheet({ id: 'f', skills: { fitness: [f, 0] } })));
      console.log(`      a bullet in the body: ${Math.round(raw)} points of pain; felt with the adrenaline: ${Object.entries(t).map(([k, v]) => `${k} s ${v}`).join(', ')}; what Fitness 0, 5, 10, 20 bear: ${limits.join(', ')}`);
      assert(t[0] < raw * 0.45 && t[30] === t[0] && t[80] > t[30] && t[200] === Math.round(raw) && limits[3] > limits[0], JSON.stringify(t));
    },
  },
  {
    name: 'wounded: you still there with a gun in your hand: they run for their lives (faster than a walk); your hands empty, they walk off',
    fn() {
      const out = {};
      for (const armed of [true, false]) {
        const w = scene({ seed: 4 }), p = w.g.people[w.me.who];
        if (armed) p.hand = newGun(p, 'makarov');
        const o = watch(w, 'armL', 40);
        out[armed ? 'armed' : 'empty'] = { vmax: o.vmax, mode: w.a.ai.hurt?.mode, along: o.along };
      }
      console.log(`      a gun in your hand: ${out.armed.mode}, at most ${fmt(out.armed.vmax, 2)} m/s, ${fmt(out.armed.along, 1)} m in 40 s; your hands empty: ${out.empty.mode}, ${fmt(out.empty.vmax, 2)} m/s, ${fmt(out.empty.along, 1)} m`);
      assert(out.armed.vmax > out.empty.vmax * 1.3 && out.armed.along > out.empty.along, JSON.stringify(out));
    },
  },
  {
    name: 'wounded: an artery opened, running from your gun: in shock within a minute or so, and down; an officer past what he bears drops out of the fight',
    fn() {
      const w = scene({ seed: 5 }), p0 = w.g.people[w.me.who];
      p0.hand = newGun(p0, 'makarov');
      const o = watch(w, 'legL', 1, (p) => { p.injuries.push({ part: 'legL', kind: 'cut', name: 'a bullet through an artery in the left thigh', ms: w.g.time.ms, until: w.g.time.ms + 1e9, bleed: w.g.time.ms + 3600000, rate: 12, deep: true, artery: true, gunshot: true }); });
      let downAt = null;
      for (let t = 0; t < 20 * 180 && downAt === null; t++) { step(w.g, {}, null); if (w.a.ai.hurt?.mode === 'lie' || w.g.people[w.a.who].dead) downAt = t / 20; }
      const left = bloodOf(o.p);
      // (an officer, two in the body: out of it, gun or no gun)
      w.g.people.copW = sheet({ id: 'copW', name: 'a police officer', cls: 'cop', skills: { awareness: [10, 0], fitness: [5, 0] } });
      armCop(w.g, w.g.people.copW, 'patrol', stream('t', 2));
      const c = makeAgent(w.g, { who: 'copW', row: w.g.map.row ?? 0, x: w.me.x + 8, z: w.me.z, speed: 1.1, face: 'left' });
      c.cop = true; c.alert = w.g.time.ms; c.ai.gunner = { gun: w.g.people.copW.items[0], until: w.g.time.ms, aimed: null };
      const q = w.g.people.copW;
      hurt(q, 'torso', takes(q, 'torso') * 1.0);
      q.injuries = [{ part: 'torso', kind: 'cut', name: 'a gunshot wound', ms: w.g.time.ms, until: 1e13, bleed: 0, rate: 0, deep: true, gunshot: true }, { part: 'torso', kind: 'cut', name: 'a gunshot wound', ms: w.g.time.ms, until: 1e13, bleed: 0, rate: 0, deep: true, gunshot: true }];
      secs(w.g, 3);
      console.log(`      the artery, running: down at ${fmt(downAt, 0)} s, ${fmt(left, 0)}% of the blood left; the officer, two in the body: pain ${Math.round(woundsNow(q, w.g.time.ms).pain)} of ${painLimit(q)}, ${c.gait}, a gunner ${!!c.ai.gunner}`);
      assert(downAt !== null && downAt < 120, `the artery: down at ${downAt}`);
      assert(!c.ai.gunner && (c.gait === 'slump' || c.gait === 'down'), `the officer: ${c.gait}, gunner ${!!c.ai.gunner}`);
    },
  },
  {
    name: 'wounded: a bullet graze along the skull bleeds a lot, but slowly for the blood it is, and stops by itself; it reads so',
    fn() {
      let graze = null, tries = 0;
      while (!graze && tries++ < 200) {
        const w = scene({ seed: 3 + tries }), p = person(w.g, w.a);
        Object.assign(p, { body: {}, injuries: [] }); delete p.dead;
        bullet(w.g, null, w.a, 'head', MODELS.makarov, w.me);
        const i = p.injuries.find(j => j.scalp);
        if (i && !p.dead) graze = { i, p, ms: w.g.time.ms };
      }
      assert(graze, 'a graze, in 200 head shots');
      const { i } = graze;
      console.log(`      a graze: ${i.rate}%/min, stopping by itself after ${fmt((i.bleed - graze.ms) / 60000, 0)} min (at most ${fmt(i.rate * (i.bleed - graze.ms) / 60000, 0)}% of the blood); an artery ${!!i.artery}`);
      assert(i.rate <= GRAZE_RATE && !i.artery && i.bleed - graze.ms <= 20 * 60000 + 1, JSON.stringify(i));
    },
  },
  {
    name: 'wounded: both legs gone, they crawl (lying, slowly) while the adrenaline holds the pain off, then sit or lie; a bullet in the skull and they lie where they fell',
    fn() {
      const w = scene(), legs = watch(w, 'legs', 180, (p) => { hurt(p, 'legL', takes(p, 'legL') * 1.05); hurt(p, 'legR', takes(p, 'legR') * 1.05); }), a = w.a;
      console.log(`      both legs: staysDown ${staysDown(legs.p)}, canCrawl ${canCrawl(legs.p)}; moving at ${fmt(legs.up, 0)} s as ${legs.gaits.join('/')}, at most ${fmt(legs.vmax, 2)} m/s (a crawl's ${CRAWL_MS}); sat at ${fmt(legs.sat, 0)} s, ${fmt(legs.along, 1)} m on, z ${fmt(a.z, 2)}, ${a.gait}`);
      assert(canCrawl(legs.p) && legs.gaits.every(gt => gt === 'down') && legs.vmax <= CRAWL_MS + 0.01 && Math.hypot(legs.along, a.z - LINE.F) > 1 && (a.gait === 'slump' || a.gait === 'down'), 'a crawl while the adrenaline lasts (to the wall, or along), then sat at the wall or down');
      const v = scene({ seed: 5 }), skull = watch(v, 'torso', 300, (p) => {
        hurt(p, 'head', takes(p, 'head'));
        p.injuries.push({ part: 'head', kind: 'cut', name: 'a bullet in the skull', ms: v.g.time.ms, until: v.g.time.ms + 60 * 86400000, bleed: v.g.time.ms + 12 * 3600000, rate: 1.2, deep: true, gunshot: true, internal: true });
      });
      console.log(`      a bullet in the skull: after 5 minutes ${v.a.gait}, moved ${fmt(Math.abs(skull.along), 2)} m, never up: ${skull.up === null}`);
      assert(skull.up === null && v.a.gait === 'down' && staysDown(skull.p) && !canCrawl(skull.p), 'out cold: down where they fell');
    },
  },
  {
    name: 'wounded: moving bleeds faster: walking ×1.5, running ×2.5, crawling ×1.25, still as it is; yours as everyone\'s',
    fn() {
      const stub = (gait, v) => ({ gait, vx: v, vz: 0 });
      const k = { still: exertion(stub('idle', 0)), walk: exertion(stub('walk', 1.4)), run: exertion(stub('run', 4)), crawl: exertion(stub('down', 0.2)), lying: exertion(stub('down', 0)) };
      assert(k.still === 1 && k.lying === 1 && k.walk === EXERTION.walk && k.run === EXERTION.run && k.crawl === EXERTION.crawl, JSON.stringify(k));
      // (you, a deep cut on the arm bleeding 2% a minute: a minute stood still, a minute walking)
      const lost = {};
      for (const how of ['still', 'walking']) {
        const { g, me } = scene(), p = g.people[me.who];
        p.injuries = [{ part: 'armL', kind: 'cut', name: 'a deep cut on the left arm', ms: g.time.ms, until: g.time.ms + 10 * 86400000, bleed: g.time.ms + 6 * 3600000, rate: 2, deep: true }];
        const b0 = bloodOf(p);
        for (let t = 0; t < 20 * 60; t++) step(g, how === 'walking' ? { mx: t % 2400 < 1200 ? 1 : -1 } : {}, null);
        lost[how] = b0 - bloodOf(p);
      }
      console.log(`      × the bleed: still ${k.still}, crawling ${k.crawl}, walking ${k.walk}, running ${k.run}; you, a deep cut at 2%/min: a minute still ${fmt(lost.still, 2)}% of the blood, a minute walking ${fmt(lost.walking, 2)}% (×${fmt(lost.walking / lost.still, 2)})`);
      assert(lost.walking / lost.still > 1.4 && lost.walking / lost.still < 1.6, 'walking bleeds half as fast again');
    },
  },
  {
    name: 'wounded: sat against the wall (or stood calling for help), still a casualty: called in, and the ambulance comes to where they are, not where they fell',
    fn() {
      const w = scene({ seed: 5 }), { g, a } = w, fell = { x: a.x + 0 };
      const o = watch(w, 'torso', 600), p = o.p;
      assert((a.ai.hurt?.sat || a.ai.hurt?.mode === 'lie' || a.ai.hurt?.mode === 'stand') && casualty(p, a), `sat, down or stood waiting (${a.gait}, ${a.ai.hurt?.mode}), a casualty`);
      for (let s = 0; s < 300 && !(g.calls ?? []).some(c => c.who.includes(a.id)); s++) secs(g, 1);
      const c = (g.calls ?? []).find(k => k.who.includes(a.id));
      assert(c, 'called in');
      const now = g.time.ms; c.at.ambulance = now + 20000; c.at.police = now + 25000;   // (sooner, for the test)
      let crewOff = null;
      for (let s = 0; s < 600 && c.ambulance.stage !== 'done'; s++) {
        secs(g, 1);
        if (c.ambulance.stage === 'working' && crewOff === null) crewOff = Math.min(...c.ambulance.crew.map(id => g.actors.find(x => x.id === id)).filter(Boolean).map(x => Math.hypot(x.x - a.x, x.z - a.z)));
      }
      console.log(`      fell at x ${fmt(fell.x, 1)}, sat ${fmt(Math.abs(a.x - fell.x), 1)} m on; the call's place ${fmt(Math.hypot(c.x - a.x, c.z - a.z), 1)} m from them; the paramedics knelt ${fmt(crewOff, 1)} m from them; taken: ${!g.actors.includes(a)}, in hospital ${!!p.hospital}`);
      assert(crewOff !== null && crewOff < 2.5 && !g.actors.includes(a) && p.hospital, 'the paramedics at their side, and away to hospital');
    },
  },
];
