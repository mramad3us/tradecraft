// What tends a body, and what an untended one goes through (sim/medicine.js, sim/aid.js, sim/health.js):
// each supply offered for the wound it fits; infection a race against the body and antibiotics, by care;
// breaks set or not, splinted or not; bruises under a poultice; pain and painkillers; the counters.
import { sheet } from '../src/sim/people.js';
import { seedRng } from '../src/sim/rng.js';
import { hurt, heal, mods, stateOf, takes, PARTS } from '../src/sim/health.js';
import { options, treat, bodyLine } from '../src/sim/aid.js';
import { addSupply, kitWords, painOf, painBand, infectionOf, INFECT_P } from '../src/sim/medicine.js';
import { GOODS, carry } from '../src/sim/clothes.js';
import { newGame, start, step, skip } from '../src/sim/game.js';
import { createBus } from '../src/sim/bus.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { DAY, HOUR } from '../src/sim/clock.js';
import { assert } from './helpers.mjs';

const person = (med = 8, fit = 5, id = 'q') => sheet({ id, name: 'P Q', cls: 'civilian', skills: { medicine: [med, 0], fitness: [fit, 0] } });
const scene = (seed, m, q) => ({ rng: seedRng(seed), people: { m, q }, time: { ms: 0 }, log: [], scenario: {} });
const A = { id: 'A', who: 'm', face: 'right' }, B = { id: 'B', who: 'q', face: 'left' };
const pct = (x, n) => `${Math.round(100 * x / n)}%`;

export default [
  {
    name: 'medicine: each supply for its wound: a bandage on what bleeds, antiseptic on what\'s open, stitches on a gash, a poultice on a bruise, a break set and splinted; none where it doesn\'t fit',
    fn() {
      const m = person(30), q = person();
      addSupply(m, 'firstaid'); addSupply(m, { sutures: 3, splint: 1, antibiotics: 1 });
      q.injuries = [
        { part: 'armR', kind: 'cut', name: 'a stab in the right arm', ms: 0, until: 10 * DAY, bleed: 1e9, rate: 3, deep: true },
        { part: 'head', kind: 'split', name: 'a split brow', ms: 0, until: 7 * DAY, bleed: 0, rate: 0.15 },
        { part: 'legL', kind: 'fracture', name: 'a fractured left shin', ms: 0, until: 42 * DAY, bleed: 0 },
      ];
      hurt(q, 'torso', 2); hurt(q, 'legL', takes(q, 'legL') + 1);
      const s = scene(3, m, q), keys = options(s, m, q).map(o => o.key);
      console.log(`      on you: ${kitWords(m.kit)}`);
      console.log(`      offered: ${keys.join(', ')}`);
      for (const k of ['dress:0', 'clean:0', 'stitch:0', 'clean:1', 'bandage:1', 'set:legL', 'splint:legL', 'poultice:torso', 'painkillers:0', 'antibiotics:0']) assert(keys.includes(k), `offered: ${k}`);
      assert(!keys.includes('stitch:1') && !keys.includes('poultice:armL') && !keys.includes('set:armR'), 'no stitches on a split brow, no poultice on an unhurt arm, no setting a bone that isn\'t broken');
      // (done, each: what it does)
      const pain0 = painOf(q, stateOf, Object.keys(PARTS)), band0 = painBand(pain0)?.word;
      for (const k of ['dress:0', 'clean:0', 'stitch:0', 'clean:1', 'bandage:1', 'set:legL', 'splint:legL', 'poultice:torso']) { s.time.ms += 60000; treat(s, null, A, B, k); }
      const pain1 = painOf(q, stateOf, Object.keys(PARTS));
      treat(s, null, A, B, 'painkillers:0');
      const pain2 = painOf(q, stateOf, Object.keys(PARTS)), [stab, brow] = q.injuries;
      console.log(`      the stab: ${['clean', 'stitched', 'bandage'].filter(k => stab[k]).join(', ')}, bleeding ${stab.bleed > s.time.ms}; the brow: ${['clean', 'bandage'].filter(k => brow[k]).join(', ')}; the shin set ${!!q.set?.legL}, splinted ${!!q.splints?.legL}; pain ${Math.round(pain0)} (${band0}) → ${Math.round(pain1)} → on painkillers ${Math.round(pain2)}; left: ${kitWords(m.kit)}`);
      assert(stab.clean && stab.stitched && !(stab.bleed > s.time.ms) && brow.clean && brow.bandage && q.set?.legL && q.splints?.legL && q.poultices?.torso, 'each did what it does (Medicine 30)');
      assert(pain1 < pain0 && pain2 < pain1 && !painBand(pain2), 'the splint and the poultice ease it; painkillers take the rest');
      assert(m.kit.bandage === 2 && m.kit.antiseptic === 1, 'what was used is gone from the kit');
    },
  },
  {
    name: 'medicine: infection, a race: a gash left open goes bad and can kill; a strip of shirt hardly helps; cleaned and stitched it rarely does; antibiotics win it; a fit body wins it alone',
    fn() {
      const N = 300, rows = [];
      const run = (label, care, { fit = 5, drugs = false, days = 21 } = {}) => {
        let infected = 0, dead = 0, healed = 0, fevered = 0;
        for (let n = 1; n <= N; n++) {
          const q = person(8, fit, `q${n}`), t0 = n * 7919;
          q.injuries = [{ part: 'armL', kind: 'cut', name: 'a deep cut on the left arm', ms: t0, until: t0 + 10 * DAY, bleed: 0, rate: 3, deep: true }];
          care(q.injuries[0], t0);
          let was = false, fev = false;
          for (let d = 1; d <= days && !q.dead; d++) {
            const ms = t0 + d * DAY, i = q.injuries?.[0];
            if (i && care === CARE.changed) i.bandage = ms - HOUR;   // (a fresh bandage every day)
            if (drugs && i?.infection && !q.antibiotics) q.antibiotics = ms + 5 * DAY;
            heal(q, 1, ms);
            was ||= infectionOf(q) > 0; fev ||= infectionOf(q) >= 25;
          }
          infected += was; dead += !!q.dead; healed += !q.dead && !q.injuries; fevered += fev;
        }
        rows.push(`${label}: infected ${pct(infected, N)}, fevered ${pct(fevered, N)}, dead ${pct(dead, N)}, healed in three weeks ${pct(healed, N)}`);
        return { infected, dead, healed };
      };
      const CARE = {
        open: () => {}, rag: (i, t) => Object.assign(i, { bandage: t, rag: true }), changed: (i, t) => Object.assign(i, { bandage: t }),
        stitched: (i, t) => Object.assign(i, { clean: true, stitched: t, bandage: t }), dirtyStitch: (i, t) => Object.assign(i, { stitched: t, bandage: t }),
      };
      const open = run('left open', CARE.open), rag = run('bound with a strip of shirt', CARE.rag), changed = run('bandaged, changed daily', CARE.changed);
      const dirty = run('stitched without cleaning', CARE.dirtyStitch), clean = run('cleaned, stitched, bandaged', CARE.stitched);
      const drugs = run('left open, antibiotics when it turns', CARE.open, { drugs: true }), fit = run('left open, Fitness 30', CARE.open, { fit: 30 });
      for (const r of rows) console.log(`      ${r}`);
      console.log(`      (a day's chance, dirty and untended: ${Object.entries(INFECT_P).map(([k, v]) => `${k} ${v}`).join(', ')})`);
      assert(open.infected > changed.infected && changed.infected > clean.infected && dirty.infected > clean.infected, 'care keeps it clean: open, bandaged, cleaned and stitched');
      assert(open.dead > 0 && drugs.dead === 0 && fit.dead === 0, 'left open it can kill; antibiotics or a fit body win the race');
      assert(open.healed < changed.healed && clean.healed > N * 0.9, 'a gash left open doesn\'t close; stitched clean, it does');
    },
  },
  {
    name: 'medicine: sepsis in the game: an infected wound, untended, through the days: the fever in the log, and the end',
    fn() {
      const g = newGame({ seed: 7 }), me = g.people[g.player];
      start(g, createBus());
      me.skills.fitness = [0, 0];
      me.injuries = [{ part: 'armL', kind: 'cut', name: 'a deep cut on the left arm', ms: g.time.ms, until: g.time.ms + 10 * DAY, bleed: 0, rate: 3, deep: true, infection: 20 }];
      const lines = [], said = bodyLine(g)?.text;
      let days = 0;
      while (!me.dead && days < 20) { skip(g, null, DAY); days++; }
      for (const l of g.log.filter(x => /infect|fever|delirious/.test(x.text ?? ''))) lines.push(l.text);
      console.log(`      the instinct: "${said}"; dead after ${days} days: ${me.dead?.why}; the scene: ${g.scenario.outcome}; the log: ${lines.map(t => `"${t}"`).join(' ')}`);
      assert(/infected/.test(said ?? ''), 'the instinct says so');
      assert(me.dead?.why?.includes('sepsis') && g.scenario.outcome === 'dead' && lines.length >= 2, 'sepsis kills, and the log saw it coming');
    },
  },
  {
    name: 'medicine: a break set knits straight, unset knits crooked (for good), unsplinted at half the pace; a wound mends only once tended; a poultice speeds a bruise; a tourniquet left on starves the limb',
    fn() {
      const broke = (setIt, splint) => {
        const q = person(8, 5);
        hurt(q, 'armL', takes(q, 'armL') + 1);
        q.injuries = [{ part: 'armL', kind: 'fracture', name: 'a fractured left forearm', ms: 0, until: 42 * DAY, bleed: 0 }];
        if (setIt) q.set = { armL: { ms: 0 } };
        if (splint) q.splints = { armL: { ms: 0 } };
        q.tended = { armL: 0 };
        heal(q, 50, 50 * DAY);
        return q;
      };
      const set = broke(true, true), unset = broke(false, true), loose = broke(true, false);
      const crooked = mods(unset, 'cqc').find(m => /badly set/.test(m.why));
      console.log(`      fifty days: set and splinted: ${set.injuries ? 'still knitting' : 'knitted'}, ${stateOf(set, 'armL')}, scars ${set.scars?.map(x => x.name).join(', ') ?? 'none'}; splinted unset: ${unset.scars?.map(x => `${x.name} (${x.v})`).join(', ')}; set, unsplinted: ${loose.injuries ? 'still knitting' : 'knitted'}`);
      assert(!set.injuries && !set.scars && !set.splints, 'set and splinted: knitted straight, the splint off');
      assert(crooked?.v === -1, 'unset: crooked, −1 to what the arm does, for good');
      assert(loose.injuries?.some(i => i.kind === 'fracture'), 'unsplinted: half the pace');
      // (a wound waits for care; a bruise mends faster under a poultice)
      const w = person(8, 5), t = person(8, 5), b = person(8, 5), bp = person(8, 5);
      for (const q of [w, t]) hurt(q, 'torso', takes(q, 'torso') * 0.8);
      for (const q of [b, bp]) hurt(q, 'legR', takes(q, 'legR') * 0.3);
      t.tended = { torso: 0 }; bp.poultices = { legR: 2 * DAY };
      heal(w, 6, 6 * DAY); heal(t, 6, 6 * DAY); heal(b, 1, DAY); heal(bp, 1, DAY);
      console.log(`      a wounded torso six days on: untended ${stateOf(w, 'torso')}, tended ${stateOf(t, 'torso')}; a bruised leg a day on: ${(b.body?.legR ?? 0).toFixed(2)} points, poulticed ${(bp.body?.legR ?? 0).toFixed(2)}`);
      assert(stateOf(w, 'torso') === 'wounded' && stateOf(t, 'torso') !== 'wounded' && (bp.body?.legR ?? 0) < (b.body?.legR ?? 0), 'tended it mends; a poultice is faster');
      // (a tourniquet five hours on)
      const tq = person(8, 5);
      tq.tourniquets = { legL: { ms: 0 } };
      const notes = heal(tq, 5 / 24, 5 * HOUR);
      console.log(`      a tourniquet on five hours: the leg ${stateOf(tq, 'legL')}; "${notes.map(n => n.text).join(' ')}"`);
      assert(stateOf(tq, 'legL') !== 'unhurt', 'past two hours, the limb pays');
    },
  },
  {
    name: 'medicine: a chemist\'s counter sells it all, a grocer\'s the everyday; a first-aid kit in a pocket; the flat\'s cabinet stocked on the first day',
    fn() {
      const p = person();
      const sold = (shop) => (GOODS[shop] ?? []).map(([k]) => k);
      const at = carry(p, 'firstaid'); carry(p, 'sutures');
      const c = newCampaign(61, candidates(61, 'london', 'junior')[0], 'london', 'junior');
      console.log(`      a chemist's: ${sold('pharmacy').join(', ')}; a grocer's: ${sold('grocery').join(', ')}; bought: ${kitWords(p.kit)} (${at}); the cabinet: ${kitWords(c.cabinet)}`);
      assert(['firstaid', 'bandage', 'antiseptic', 'sutures', 'splint', 'tourniquet', 'painkillers', 'poultice', 'antibiotics'].every(k => sold('pharmacy').includes(k)) && sold('grocery').includes('bandage'), 'the counters');
      assert(at === 'pocket' && p.kit.bandage === 4 && p.kit.sutures === 3 && !p.items?.length, 'counted, in a pocket');
      assert(c.cabinet.bandage > 0, 'the cabinet');
    },
  },
  {
    name: 'medicine: a professional: the embassy\'s nurse on a working day (an hour, discreet; an artery beyond her), a hospital\'s A&E (hours; everything; a knife wound reported, heat)',
    fn() {
      const wounds = (ms) => [
        { part: 'armR', kind: 'cut', name: 'a stab in the right arm', ms, until: ms + 10 * DAY, bleed: ms + 6 * HOUR, rate: 3, deep: true },
        { part: 'legL', kind: 'cut', name: 'a cut artery in the left thigh', ms, until: ms + 10 * DAY, bleed: ms + 6 * HOUR, rate: 12, deep: true, artery: true },
        { part: 'armL', kind: 'fracture', name: 'a fractured left forearm', ms, until: ms + 42 * DAY, bleed: 0 },
      ];
      const run = (where) => {
        const c = newCampaign(81, candidates(81, 'london', 'junior')[0], 'london', 'junior'); c.calls = [];
        const s = newGame({ seed: 81, scenario: 'campaign', campaign: c }), bus = createBus();
        start(s, bus);
        if (where === 'embassy') { step(s, { act: ['desk:travel:embassy'] }, bus); for (let t = 0; t < 25; t++) step(s, {}, bus); step(s, { act: ['instinct'] }, bus); }
        else { step(s, { act: ['desk:travel:embassy'] }, bus); for (let t = 0; t < 25; t++) step(s, {}, bus); }
        const me = s.actors.find(a => a.who === s.player), p = s.people[s.player];
        p.injuries = wounds(s.time.ms); p.tourniquets = { legL: { ms: s.time.ms } }; p.injuries[1].bleed = s.time.ms;
        const keys = options(s, p, p).map(o => o.key), t0 = s.time.ms, h0 = s.heat[Object.keys(s.heat)[0]] ?? 0;
        step(s, { act: [`aid:${me.id}:${where === 'embassy' ? 'nurse' : 'hospital'}:0`] }, bus);
        const [stab, artery, arm] = p.injuries;
        return { keys, h: (s.time.ms - t0) / HOUR, heat: (s.heat[Object.keys(s.heat)[0]] ?? 0) - h0, stab: !!stab.stitched, artery: !!artery.stitched, tq: !!p.tourniquets, set: !!p.set?.armL && !!p.splints?.armL, line: s.log.filter(l => /nurse|A&E/.test(l.text ?? '')).at(-1)?.text };
      };
      const e = run('embassy'), h = run('street');
      console.log(`      the nurse (${e.keys.includes('nurse:0')}): ${e.h.toFixed(1)} h, heat +${e.heat}, the stab stitched ${e.stab}, the artery ${e.artery ? 'tied off' : 'beyond her'} (the tourniquet ${e.tq ? 'still on' : 'off'}), the arm set and splinted ${e.set}`);
      console.log(`      A&E (${h.keys.includes('hospital:0')}): ${h.h.toFixed(1)} h, heat +${h.heat}, the stab stitched ${h.stab}, the artery tied off ${h.artery}, the tourniquet ${h.tq ? 'still on' : 'off'}, the arm set and splinted ${h.set}; "${(h.line ?? '').slice(0, 140)}…"`);
      assert(e.keys.includes('nurse:0') && Math.round(e.h) === 1 && e.heat === 0 && e.stab && !e.artery && e.tq && e.set, 'the nurse: an hour, discreet, all but the artery');
      assert(h.keys.includes('hospital:0') && h.h >= 4 && h.h <= 6.1 && h.heat === 8 && h.stab && h.artery && !h.tq && h.set, 'A&E: hours, everything, the knife wound reported');
    },
  },
];
