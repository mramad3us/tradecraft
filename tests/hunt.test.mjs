// The hunt for you (sim/hunt.js): how hard they look by what happened, the perimeter growing with the minutes, your
// Tradecraft's read of what they have, the three icons; a unit on your street, its officer's look, flagged in other clothes
// a suspect searched and questioned, the full description the alarm, a knife found an arrest for the hunt's kind; and the
// police's fixes of the same day (sim/armed.js): no officer on another street hears or shouts, the one coming to cuff you
// walks, into a shop after you; and a reflex's answer kept a while (sim/reflex.js).
import { newGame, start as begin, step, playerActor } from '../src/sim/game.js';
import { armCop, arrest } from '../src/sim/armed.js';
import { start, know, badges, mods, perimeterM, routeInto, HUNTS, PERIM0_M, PERIM_MS, QUESTION, DEPLOY_MIN } from '../src/sim/hunt.js';
import { makeAgent } from '../src/sim/agents.js';
import { sheet } from '../src/sim/people.js';
import { opposed } from '../src/sim/checks.js';
import { use } from '../src/sim/items.js';
import { waiting, emsBadges, ON_ALERT_K } from '../src/sim/emergency.js';
import { eyes } from '../src/sim/perception.js';
import { newGun, isGun } from '../src/sim/firearms.js';
import { bloodOf, hurt, takes, kill } from '../src/sim/health.js';
import { person } from '../src/sim/interact.js';
import { skill } from '../src/sim/skills.js';
import { policeOf } from '../src/sim/countries/index.js';
import { offer, chosen, KEEP_S } from '../src/sim/reflex.js';
import { unitAt } from '../src/sim/interiors/use.js';
import { stream } from '../src/sim/rng.js';
import { LINE } from '../src/sim/city.js';
import { MIN, HOUR } from '../src/sim/clock.js';
import { assert, fmt } from './helpers.mjs';

// (a street at noon, no officer on it; the log and the papers kept)
function scene(city = 'moscow', seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city, hour: 12, weather: 'clear' }), log = [], papers = [];
  const bus = { emit: (k, v) => { if (k === 'log') log.push(v.text ?? ''); if (k === 'papers') papers.push(...v); }, on() {} };
  begin(g, bus);
  for (let t = 0; t < 20; t++) step(g, {}, bus);
  g.actors = g.actors.filter(a => !a.cop);
  const me = playerActor(g), p = g.people[me.who];
  return { g, bus, log, papers, me, p };
}
const seconds = (w, n, input = {}) => { for (let t = 0; t < 20 * n; t++) step(w.g, input, w.bus); };
const otherCoat = (p) => { p.look = { ...p.look, top: { kind: 'coat', color: 0x123456 }, hat: { kind: 'cap', color: 0x24503a } }; };
// (an officer stood by you, looking at you)
function officer(w, dx = 6, id = 'copA') {
  const K = policeOf(w.g.map);
  w.g.people[id] = sheet({ id, name: 'a police officer', cls: 'cop', skills: { awareness: [10, 0], cqc: [6, 0], tracking: [6, 0] }, look: { skin: 'light', hair: { style: 'crew', color: 0x23252f }, ...K.look } });
  armCop(w.g, w.g.people[id], 'patrol', stream('t', 1));
  const c = makeAgent(w.g, { who: id, row: w.g.map.row ?? 0, x: w.me.x + dx, z: w.me.z, speed: 1.1, face: dx > 0 ? 'left' : 'right' });
  c.cop = true; c.head = dx > 0 ? Math.PI : 0; c.stopping = true; c.ai.wait = 20 * 600;   // (stood there: sim/police.js patrolTick() keeps a patrol at a stop)
  return c;
}

export default [
  {
    name: 'hunt: how hard they look: a fist fight three streets, an hour, no cars, not looking hard; someone shot or killed, the whole city for hours; the perimeter grows at a walk',
    fn() {
      const rows = Object.entries(HUNTS).map(([k, S]) => `${k}: ${S.rows === Infinity ? 'the city' : `${S.rows} streets`}, ${S.searchH} h, a unit every ${S.every.join('–')} min, cars ${Math.round(S.cars * 100)}%, eye ${S.eye >= 0 ? '+' : ''}${S.eye}`);
      const H = { why: 'killed', where: { ms: 0 } }, F = { why: 'fight', where: { ms: 0 } };
      const at = (h, m) => Math.round(perimeterM(h, m * MIN));
      assert(HUNTS.fight.rows === 3 && HUNTS.fight.cars === 0 && HUNTS.fight.eye > 0 && HUNTS.killed.rows === Infinity && HUNTS.killed.searchH > HUNTS.fight.searchH * 6, 'a fist fight small, a killing the city');
      assert(at(H, 0) === PERIM0_M && at(H, 10) === Math.round(PERIM0_M + PERIM_MS * 600) && at(F, 30) === Math.round(3.5 * 80), `perimeter ${at(H, 0)} → ${at(H, 10)} m; a fight's capped at ${at(F, 30)} m`);
      console.log(`      ${rows.join('; ')}\n      the perimeter (a killing): ${[0, 5, 10, 20, 40].map(m => `${m} min ${at(H, m)} m`).join(', ')}; a fight's at most ${at(F, 60)} m`);
    },
  },
  {
    name: 'hunt: after a killing, every street in the city for 48 hours: officers at its corners, armed units jogging through and cars with their lights, several at once (the user, 2026-11-04)',
    fn() {
      const w = scene('moscow'), p = w.p;
      p.skills.deception = [60, 0];                                   // (their eyes going past you: the deployment watched, no stop)
      start(w.g, w.bus, { why: 'killed', x: w.me.x, who: false, wearing: true });
      w.g.hunt.next = w.g.time.ms; w.g.hunt.deploy = w.g.time.ms; w.g.hunt.where.row = (w.g.map.row ?? 0) - 6;   // (six streets from it)
      let posts = 0, most = 0, armed = 0, cars = 0, units = new Set();
      for (let t = 0; t < 240; t++) {
        seconds(w, 1);
        const A = w.g.actors.filter(a => a.hunt);
        posts = Math.max(posts, A.filter(a => a.huntPost).length);
        const moving = new Set([...A.filter(a => !a.huntPost).map(a => a.hunt), ...(w.g.traffic?.cars ?? []).filter(c => c.ems?.hunt).map(c => c.ems.hunt)]);
        most = Math.max(most, moving.size); for (const u of moving) units.add(u);
        armed = Math.max(armed, A.filter(a => isGun(w.g.people[a.who]?.hand)).length);
        cars = Math.max(cars, (w.g.traffic?.cars ?? []).filter(c => c.ems?.hunt && c.ems.lights).length);
      }
      const H = w.g.hunt;
      console.log(`      four minutes six streets from it: ${posts} at the corners, ${units.size} units through (${most} at once), ${armed} long guns in hand at once, ${cars} car${cars === 1 ? '' : 's'} with its lights at once; the search on for ${fmt((H.search - H.ms) / HOUR, 0)} h`);
      assert(posts >= 2 && units.size >= 2 && most >= 2 && armed >= 2 && (H.search - H.ms) / HOUR >= 36, `posts ${posts}, units ${units.size}, at once ${most}, armed ${armed}`);
    },
  },
  {
    name: 'hunt: an officer\'s look, by what you\'ve changed and how far you\'ve gone (Deception 10 against Awareness 10, 4000 looks each): as described where they\'re looking, caught; another coat ten streets on, through',
    fn() {
      const w = scene(), me = w.me, r = stream('hunt-balance', 1);
      const p = sheet({ id: 'plain', sex: w.p.sex, cls: 'civilian', skills: { deception: [10, 0] }, look: structuredClone(w.p.look) });   // (a plain sheet: Deception 10 and nothing on it)
      p.age = w.p.age; w.g.people[w.g.player] = p;
      const cop = sheet({ id: 'eye', cls: 'cop', skills: { awareness: [10, 0] } });
      const rate = (why, { face = true, coat = false, away = 0, min = 3 } = {}) => {
        const now = w.g.time.ms, look = p.look;
        start(w.g, null, { why, x: me.x, who: face, wearing: true });
        w.g.hunt.where.ms = now - min * MIN;
        if (coat) otherCoat(p);
        const at = { row: (w.g.map.row ?? 0) + away, x: me.x };
        let pass = 0;
        for (let k = 0; k < 4000; k++) { const o = opposed(r, { skill: 'deception', value: skill(p, 'deception'), mods: mods(w.g, w.g.hunt, p, at) }, { skill: 'awareness', value: skill(cop, 'awareness') }); if (o.ok && o.ours.nat !== 1) pass++; }
        p.look = look; delete w.g.hunt;
        return pass / 4000;
      };
      const R = {
        'a killing, as described, on the spot': rate('killed'),
        'a killing, another coat, 10 streets on': rate('killed', { coat: true, away: 10 }),
        'a killing, another coat, 10 streets on, nobody saw your face': rate('killed', { coat: true, away: 10, face: false }),
        'a killing, as described, 10 streets on, 20 min later (inside their perimeter)': rate('killed', { away: 10, min: 20 }),
        'a fist fight, as described, on the spot': rate('fight'),
        'a fist fight, another coat, 4 streets on': rate('fight', { coat: true, away: 4 }),
      };
      const v = Object.values(R);
      assert(v[0] < 0.15 && v[1] > 0.6 && v[2] > 0.8 && v[2] <= 0.95 && v[3] < v[1] && v[4] > v[0] && v[5] > 0.65, JSON.stringify(R));
      console.log(`      ${Object.entries(R).map(([k, x]) => `${k}: ${Math.round(x * 100)}%`).join('; ')} (a natural 1 fails all the same)`);
    },
  },
  {
    name: 'hunt: what you know of it, by your Tradecraft: whether they have your face, right, can\'t tell, or wrong (300 hunts each)',
    fn() {
      const w = scene(), out = [];
      for (const os of [10, 40, 80]) {
        w.p.os = os;
        const n = { right: 0, unsure: 0, wrong: 0 };
        for (let k = 0; k < 300; k++) {
          const face = k % 2 === 0;
          w.g.hunt = { id: `t${os}-${k}`, why: 'shots', who: { known: face }, wearing: { known: true }, where: { row: 0, x: 0, ms: w.g.time.ms }, reads: 0, read: null, aware: null };
          know(w.g, null);
          const R = w.g.hunt.read.who;
          n[R === null ? 'unsure' : R === face ? 'right' : 'wrong']++;
        }
        out.push(`Tradecraft ${os}: right ${n.right}, can't tell ${n.unsure}, wrong ${n.wrong}`);
        if (os === 10) assert(n.unsure > 120, `a beginner mostly can't tell: ${JSON.stringify(n)}`);
        if (os === 80) assert(n.right > 250 && n.wrong < 25, `a veteran knows: ${JSON.stringify(n)}`);
      }
      delete w.g.hunt;
      console.log(`      ${out.join('; ')}`);
    },
  },
  {
    name: 'hunt: the three icons: red as they had you; another coat, the clothes green; out of their perimeter, the place green; a read you can\'t trust, grey',
    fn() {
      const w = scene(), p = w.p, me = w.me;
      start(w.g, null, { why: 'shots', x: me.x, who: true, wearing: true, sure: true });
      const show = () => badges(w.g).map(b => `${b.key} ${b.state}`).join(', ');
      const a = show();
      otherCoat(p);
      const b = show();
      me.x += 900;
      const c = show();
      w.g.hunt.read.who = null;
      const d = show();
      assert(a === 'face burned, clothes burned, place burned' && b === 'face burned, clothes clear, place burned' && c === 'face burned, clothes clear, place clear' && d.startsWith('face unknown'), `${a} | ${b} | ${c} | ${d}`);
      console.log(`      as they had you: ${a}; another coat: ${b}; 900 m on: ${c}; can't tell about the face: ${d}`);
    },
  },
  {
    name: 'hunt: a unit on your street within minutes; flagged in other clothes, a suspect: stopped, searched, nothing on you, taken in for questioning, out on a station\'s steps; the hunt over',
    fn() {
      const w = scene(), p = w.p;
      p.items = []; p.hand = null; p.skills.deception = [-30, 0];   // (no hope of their eyes going past you)
      start(w.g, w.bus, { why: 'shots', x: w.me.x, who: true, wearing: true });
      otherCoat(p);
      w.g.hunt.next = w.g.time.ms; w.g.hunt.deploy = w.g.time.ms;
      let unit = null, stop = null, t = 0;
      for (; t < 600 && !w.papers.length; t++) {
        seconds(w, 1);
        if (w.g.hunt && !w.g.actors.some(a => a.hunt) && !(w.g.traffic?.cars ?? []).some(c => c.ems?.hunt)) w.g.hunt.next = Math.min(w.g.hunt.next, w.g.time.ms);   // (the next unit as soon as one's gone: not the minutes between)
        unit ??= w.g.actors.some(a => a.hunt) ? t : (w.g.traffic?.cars ?? []).some(c => c.ems?.hunt) ? t : null;
        stop ??= w.g.$takedown?.suspect || w.log.some(l => /Остановитесь|Stay where|Stop there/.test(l)) ? t : null;   // (the stop: its words, as it may be over in the second)
      }
      seconds(w, 2);                                                 // (the hours at the station skipped, and out)
      const paper = w.papers.find(x => x.kind === 'questioned');
      assert(unit !== null && stop !== null && paper && w.g.$held === undefined && !w.g.hunt, `a unit at ${unit} s, the stop at ${stop} s, the paper ${!!paper}, the hunt ${!!w.g.hunt}`);
      assert(paper.lines.some(l => new RegExp(`${QUESTION.shots.h} hours|three hours`, 'i').test(l)) && w.log.some(l => /steps of/.test(l)), paper.lines.join(' / '));
      console.log(`      a unit on the street ${unit} s after it was called; the stop at ${stop} s; "${paper.lines[2]}"; ${w.log.find(l => /steps of/.test(l))}`);
    },
  },
  {
    name: 'hunt: as described, the alarm at once; a suspect who walks off has failed to stop: the alarm, and the next time they flag you it\'s the alarm',
    fn() {
      const w = scene(), p = w.p;
      p.skills.deception = [-30, 0];
      start(w.g, w.bus, { why: 'shots', x: w.me.x, who: true, wearing: true });
      officer(w, 6);
      seconds(w, 2);
      const full = !!w.g.$alarm;
      const v = scene();
      v.p.skills.deception = [-30, 0];
      start(v.g, v.bus, { why: 'shots', x: v.me.x, who: true, wearing: true });
      otherCoat(v.p);
      officer(v, 9);
      seconds(v, 2);
      const suspect = !!v.g.$takedown?.suspect && !v.g.$alarm;
      v.me.x -= 8;                                                   // (walked off)
      seconds(v, 2);
      assert(full && suspect && v.g.$alarm && v.g.hunt?.fled, `full: alarm ${full}; other coat: suspect ${suspect}; walked off: alarm ${!!v.g.$alarm}, fled ${v.g.hunt?.fled}`);
      console.log(`      as described: the alarm; in another coat: stopped as a suspect ("${v.log.find(l => /Stay where|Stop there|Остановитесь/.test(l))}"); walked off: ${v.log.find(l => /Stop! Police/.test(l))}`);
    },
  },
  {
    name: 'hunt: searched with a knife on you, the morning after a killing: arrested for the killing (its hours), the knife into evidence',
    fn() {
      const w = scene(), p = w.p;
      p.items = ['kitchen']; p.hand = null; p.skills.deception = [-30, 0];
      start(w.g, w.bus, { why: 'killed', x: w.me.x, who: false, wearing: true });
      otherCoat(p);
      officer(w, 5);
      for (let t = 0; t < 40 && !w.papers.length; t++) seconds(w, 1);
      const paper = w.papers.find(x => x.kind === 'arrest');
      assert(paper && paper.lines.some(l => /14 hours/.test(l)) && paper.lines.some(l => /knife/.test(l)) && !p.items.includes('kitchen'), paper?.lines.join(' / ') ?? 'no paper');
      console.log(`      ${paper.lines.slice(0, 4).join(' / ')}`);
    },
  },
  {
    name: 'armed: taken in hurt (two bullets in the chest, in shock): a hospital first, under guard, everything seen to, its hours before the station\'s; out on the steps alive',
    fn() {
      const w = scene(), p = w.p, ms = w.g.time.ms;
      p.injuries = [{ part: 'torso', kind: 'cut', name: 'a gunshot wound in the chest', ms, until: ms + 30 * 864e5, bleed: ms + 6 * HOUR, rate: 1.2, deep: true, gunshot: true },
        { part: 'torso', kind: 'cut', name: 'bleeding inside, from the chest wound', ms, until: ms + 30 * 864e5, bleed: ms + 3 * HOUR, rate: 0.6, deep: true, gunshot: true, internal: true }];
      p.blood = 45;
      w.g.$takedown = { cop: 'none', stage: 'pin', why: 'the shots' };
      arrest(w.g, w.bus, w.me, 'submitted');
      const paper = w.papers.find(x => x.kind === 'arrest'), held = w.g.$held / HOUR;
      seconds(w, 2);
      const bleeding = p.injuries.some(i => i.bleed > w.g.time.ms), dead = !!p.dead;
      assert(paper?.lines.some(l => /hospital first/.test(l)) && held > 5 && !bleeding && !dead && bloodOf(p) >= 90, `paper ${paper?.lines.join(' / ')}; held ${held} h; bleeding ${bleeding}; dead ${dead}; blood ${bloodOf(p)}`);
      console.log(`      ${paper.lines.find(l => /hospital first/.test(l))} (${fmt(held, 2)} h held in all); out alive, blood ${Math.round(bloodOf(p))}%`);
    },
  },
  {
    name: 'armed: down on the pavement with a gun in your hand: they come in and take it (no standing off for ever), the card offers no gun and no running; and you see all round you',
    fn() {
      const w = scene(), p = w.p;
      p.hand = newGun(p, 'makarov'); w.me.gait = 'down'; w.me.vx = w.me.vz = 0;
      for (const k of ['legL', 'legR']) hurt(p, k, takes(p, k) + 1);   // (both legs gone: on the ground, and staying there)
      const c = officer(w, 8); c.alert = w.g.time.ms;
      w.g.$alarm = { ms: w.g.time.ms, x: w.me.x, ordered: 0, why: 'an officer' };
      let pinned = null;
      for (let t = 0; t < 40 * 20 && pinned === null; t++) { step(w.g, {}, w.bus); if (w.g.$takedown?.stage === 'pin' || w.papers.length) pinned = t / 20; }
      const taken = !isGun(p.hand);
      // (the card, offered on the ground: what's on it)
      const v = scene(); v.g.$reflexes = true; v.p.hand = newGun(v.p, 'makarov'); v.me.gait = 'down'; v.p.skills.awareness = [30, 0];
      for (const k of ['legL', 'legR']) hurt(v.p, k, takes(v.p, k) + 1);
      const o = officer(v, -6); o.alert = v.g.time.ms; o.head = 0; o.face = 'right';
      const gun = v.g.people[o.who].items.find(isGun);
      o.ai.gunner = { gun, until: v.g.time.ms, aimed: null, hold: true };
      for (let t = 0; t < 10 * 20 && !v.g.$reflex; t++) step(v.g, {}, v.bus);
      const card = v.g.$reflex?.options.map(x => x.key) ?? [];
      const sees = eyes(v.g, v.me);
      assert(card.length && !card.includes('draw') && !card.includes('run') && card.includes('drop'), `the card on the ground: ${card.join(', ') || 'none offered'}`);
      assert(pinned !== null && pinned < 30, `came in and took you down at ${pinned} s`);
      assert(sees.cone >= Math.PI - 1e-9, `on the ground you see all round: cone ${sees.cone}`);
      console.log(`      down with a Makarov in hand: an officer in on you and the cuffs on at ${fmt(pinned, 1)} s, the gun ${taken ? 'taken' : 'still in hand (arrest takes it)'}; the card on the ground: ${card.join(', ')}; your eyes all round`);
    },
  },
  {
    name: 'hunt: the coat they described, in your shop\'s bag, found when they search you: arrested; the bag binned first, and it\'s questions only (the user, 2026-11-04)',
    fn() {
      const out = {};
      for (const binned of [false, true]) {
        const w = scene(), p = w.p;
        p.items = []; p.hand = null; p.skills.deception = [-30, 0];
        start(w.g, w.bus, { why: 'shots', x: w.me.x, who: false, wearing: true });
        const old = { slot: 'top', look: structuredClone(p.look.top), name: 'the old coat' };
        otherCoat(p);
        p.bag = [old];
        if (binned) use(w.g, w.bus, w.me, 'discard:bag');
        officer(w, 5);
        for (let t = 0; t < 40 && !w.papers.length; t++) seconds(w, 1);
        out[binned ? 'binned' : 'kept'] = { paper: w.papers[0]?.kind, bag: !!p.bag, line: w.papers[0]?.lines.find(l => /stood for the search/.test(l)) ?? w.papers[0]?.lines[1] };
      }
      console.log(`      the old coat in the bag: ${out.kept.paper} ("${out.kept.line}"); the bag binned first: ${out.binned.paper}`);
      assert(out.kept.paper === 'arrest' && out.binned.paper === 'questioned' && !out.binned.bag, JSON.stringify(out));
    },
  },
  {
    name: 'hunt: first responders first: nothing at the corners, no unit, no car before the call\'s police are on the scene; then the search (the user, 2026-11-04)',
    fn() {
      const w = scene('moscow'), p = w.p, now = w.g.time.ms;
      p.skills.deception = [60, 0];
      start(w.g, w.bus, { why: 'killed', x: w.me.x, who: false, wearing: true, first: now + 3 * MIN });
      const count = () => ({ posts: w.g.actors.filter(a => a.hunt && a.huntPost).length, units: w.g.actors.filter(a => a.hunt && !a.huntPost).length + (w.g.traffic?.cars ?? []).filter(c => c.ems?.hunt).length });
      let before = { posts: 0, units: 0 };
      for (let t = 0; t < 170; t++) { seconds(w, 1); const k = count(); before = { posts: Math.max(before.posts, k.posts), units: Math.max(before.units, k.units) }; }
      let after = { posts: 0, units: 0 };
      for (let t = 0; t < 120; t++) { seconds(w, 1); const k = count(); after = { posts: Math.max(after.posts, k.posts), units: Math.max(after.units, k.units) }; }
      const v = scene('moscow'); start(v.g, v.bus, { why: 'gun', x: v.me.x, who: true, wearing: true });
      const own = (v.g.hunt.deploy - v.g.time.ms) / MIN;              // (no call: an officer's own sighting, called in)
      console.log(`      before the call's police (3 min): ${before.posts} at the corners, ${before.units} units; after: ${after.posts} at the corners, ${after.units} units; an officer's own sighting: deployed ${own} min on`);
      assert(before.posts === 0 && before.units === 0 && after.posts >= 1 && own === DEPLOY_MIN, JSON.stringify({ before, after, own }));
    },
  },
  {
    name: 'emergency: another incident while the armed search is out: the police in a quarter of the time; before it\'s out, or after its window, as ever (the user, 2026-11-04)',
    fn() {
      const times = (setup) => {
        const out = [];
        for (let k = 0; k < 12; k++) {
          const w = scene('moscow', 30 + k), now = w.g.time.ms;
          setup(w, now);
          const v = w.g.actors.find(a => a !== w.me && a.ai?.civ && !a.hidden && (a.row ?? w.g.map.row) === w.g.map.row);
          Object.assign(v, { x: w.me.x + 4, z: w.me.z }); kill(person(w.g, v), now, 'shot');
          for (let t = 0; t < 60 && !(w.g.calls ?? []).length; t++) seconds(w, 1);
          const c = (w.g.calls ?? [])[0];
          if (c) out.push((c.at.police - c.ms) / MIN);
        }
        return out.reduce((a, b) => a + b, 0) / Math.max(1, out.length);
      };
      const calm = times(() => {});
      const alert = times((w, now) => { start(w.g, w.bus, { why: 'killed', row: (w.g.map.row ?? 0) + 5, x: w.me.x }); w.g.hunt.deploy = now; });
      const early = times((w, now) => { start(w.g, w.bus, { why: 'killed', row: (w.g.map.row ?? 0) + 5, x: w.me.x, first: now + 30 * MIN }); });
      const after = times((w, now) => { start(w.g, w.bus, { why: 'shots', row: w.g.map.row ?? 0, x: w.me.x }); w.g.hunt.deploy = now - 30 * HOUR; w.g.hunt.search = now - HOUR; });
      console.log(`      the police, on average: a quiet city ${fmt(calm, 1)} min; the armed search out ${fmt(alert, 1)} min (× ${ON_ALERT_K}); not out yet ${fmt(early, 1)} min; its window over ${fmt(after, 1)} min; a gun fired's search ${HUNTS.shots.searchH} h, someone shot's ${HUNTS.wounded.searchH} h`);
      assert(alert > 0 && alert < calm * 0.4 && early > calm * 0.7 && after > calm * 0.7 && HUNTS.shots.searchH === 24, JSON.stringify({ calm, alert, early, after }));
    },
  },
  {
    name: 'emergency: the call you know of, a few streets off: its timer stays on the watch, the street named (the user, 2026-11-04)',
    fn() {
      const w = scene(), now = w.g.time.ms, row = w.g.map.row ?? 0;
      w.g.calls = [{ id: 'callT', city: w.g.map.city ?? null, row: row + 3, x: w.me.x, z: w.me.z, ms: now, who: [], known: true, at: { police: now + 6 * MIN, ambulance: now + 6 * MIN }, err: { police: 0, ambulance: 0 }, police: { stage: 'coming' }, ambulance: { stage: 'done' } }];
      const W = waiting(w.g), B = emsBadges(w.g);
      w.g.calls[0].police.stage = 'working';
      const here = emsBadges(w.g)[0];
      w.g.calls = [];
      const none = emsBadges(w.g);
      assert(W?.length && W[0].where && W[0].kind === 'police', JSON.stringify(W));
      assert(B[0].kind === 'police' && B[0].state === 'inbound' && B[0].short && B[0].where && B[1].state === 'none' && here.state === 'here' && none.every(b => b.state === 'none'), JSON.stringify({ B, here, none }));
      console.log(`      three streets off: "${W[0].where}: police: ${W[0].text}"; the logos: ${B.map(b => `${b.kind} ${b.state} ${b.short}`).join(', ')} (${B[0].where}); on the scene: ${here.short}; nothing called: ${none.map(b => b.state).join(', ')}`);
    },
  },
  {
    name: 'police: an officer on another street hears no shot of yours and shouts at nobody (the user\'s ghosts, 2026-11-04)',
    fn() {
      const w = scene(), c = officer(w, -12);
      c.row = (w.g.map.row ?? 0) + 1;                                // (at a tape on the street you left: still in the world, there)
      c.alert = w.g.time.ms;
      w.g.$shotBy = { ms: w.g.time.ms, x: w.me.x };
      seconds(w, 8);
      const shouts = w.log.filter(l => /a shout|Stop!|Hands|Руки|Стоять/.test(l));
      assert(!shouts.length && !c.alert, `shouts: ${shouts.join(' / ')}; his alert ${c.alert}`);
      console.log('      a shot fired, an officer at the same spot one street over: no shout, his alarm dropped');
    },
  },
  {
    name: 'armed: after a shot, the officer coming to cuff you walks to you across the road (not a gunner again each second, no turning back mid-crossing), and takes you down',
    fn() {
      const w = scene();
      w.me.z = LINE.N;
      const c = officer(w, 4);
      c.z = LINE.F; c.alert = w.g.time.ms;
      w.g.$shotBy = { ms: w.g.time.ms - 2000, x: w.me.x };
      w.g.$alarm = { ms: w.g.time.ms, x: w.me.x, ordered: 0, why: 'the shots' };
      let reached = null, back = 0, was = 0;
      for (let t = 0; t < 60 * 20 && reached === null; t++) {
        step(w.g, {}, w.bus);
        const dir = Math.abs(c.vz) > 0.3 ? Math.sign(c.vz) : 0;     // (across the road: the way he's going, north or south)
        if (w.g.$takedown?.stage === 'closing' && dir && was && dir !== was) back++;
        if (dir) was = dir;
        if (w.g.$takedown?.stage === 'pin') reached = t / 20;
      }
      assert(reached !== null && reached < 30 && back <= 1, `pinned at ${reached} s, turned back across the road ${back} times`);
      console.log(`      across the road and on you in ${fmt(reached, 1)} s, turning back ${back} times`);
    },
  },
  {
    name: 'hunt: into a shop after you: a way in at its door and across its floor, to where you stand',
    fn() {
      const w = scene();
      let found = null;
      for (const S of w.g.$world.sections.values()) for (const u of S.units ?? []) if (!found && u.spots?.some(s => s.kind === 'counter')) found = u;
      assert(found, 'a shop on the street');
      const spot = found.spots.find(s => s.kind === 'counter');
      const c = officer(w, 0);
      c.x = found.door + 12; c.z = LINE.N;
      const r = routeInto(w.g, c, spot.x, spot.z + 0.6), end = r?.pts.at(-1);
      assert(r && Math.hypot(end.x - spot.x, end.z - spot.z - 0.6) < 0.3 && unitAt(w.g, end.x, end.z)?.u === found, `a way in: ${r ? `${fmt(r.length, 1)} m, ending at ${fmt(end.x, 1)}, ${fmt(end.z, 1)}` : 'none'}`);
      console.log(`      from the pavement 12 m along, in at the door and across the floor: ${fmt(r.length, 1)} m`);
    },
  },
  {
    name: 'reflex: an answer kept a while: the same kind of moment answered the same way for two minutes, the clock not stopping; after, the card again',
    fn() {
      const w = scene();
      w.g.$reflexes = true;
      const moment = () => offer(w.g, null, { why: 'gun', title: 'An officer, bringing his gun up', options: [{ key: 'run', label: 'Run for it', do: 'run' }] });
      moment(); chosen(w.g, 'run!keep');
      moment();
      const auto = w.g.$reflex?.auto;
      chosen(w.g, auto);
      w.g.time.ms += (KEEP_S + 1) * 1000;
      moment();
      const later = w.g.$reflex?.auto ?? null;
      assert(auto === 'run' && later === null, `kept: ${auto}; after ${KEEP_S} s: ${later}`);
      console.log(`      kept: the next moment answered "${auto}" at once; ${KEEP_S} s on, the card again`);
    },
  },
];
