// Under a legend (DESIGN.md, Cover, heat and the hunt: Under a legend; sim/prison.js, sim/dial.js, sim/campaign.js pass() and blow(), sim/scenarios/campaign.js):
// no diplomatic immunity (an arrest is the legend looked into, and bail, a sentence, or their prison), the job lost fails the
// posting, blown is hunted not expelled (the flat theirs, the way out your own), the agency's support thin (no extraction), the
// station's word by dead drop; what each end makes of the career.
import { candidates, newCampaign, pass } from '../src/sim/campaign.js';
import { offers, careerEnd, facesOf } from '../src/sim/postings.js';
import { scrutiny, jailed, SENTENCE, GRAVITY } from '../src/sim/prison.js';
import { arrest } from '../src/sim/armed.js';
import { services, ring, second as dialSecond, collect, dropAt } from '../src/sim/dial.js';
import { supportOf } from '../src/sim/support.js';
import { huntOf } from '../src/sim/hunt.js';
import { newGun } from '../src/sim/firearms.js';
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { patrolTick, answer } from '../src/sim/police.js';
import { DAY, HOUR, calendar } from '../src/sim/clock.js';
import { YEAR } from '../src/sim/incubation.js';
import { assert, fmt } from './helpers.mjs';

// (a deep posting's hub, day one in the flat, out on the street at its door)
function hub(seed, city = 'moscow', level = 'undercover', { out = true } = {}) {
  const c = newCampaign(seed, candidates(seed, city, level)[0], city, level);
  const g = newGame({ seed, scenario: 'campaign', campaign: c }), papers = [], bus = { emit: (k, v) => { if (k === 'papers') papers.push(...v); }, on() {} };
  start(g, null);
  for (let t = 0; t < 21; t++) step(g, {}, bus);
  if (out) { c.where = { row: c.posting.home.row, x: c.posting.home.x, z: -2.6 }; const g2 = newGame({ seed, scenario: 'campaign', campaign: c }); start(g2, null); for (let t = 0; t < 21; t++) step(g2, {}, bus); return { c, g: g2, bus, papers, me: playerActor(g2) }; }
  return { c, g, bus, papers, me: playerActor(g) };
}
// (a patrol now, by hand, and the stop: the pair at your elbow; as tests/police.test.mjs)
function stopped(g, bus) {
  g.flags.patrol = null;
  for (let h = 0; h < 48 && !g.actors.some(a => a.cop); h++) { g.time.ms += HOUR; patrolTick(g); }
  const cops = g.actors.filter(a => a.cop), me = playerActor(g);
  Object.assign(me, { x: cops[0].x - 1, z: cops[0].z });
  g.$stop = { lead: cops[0].id };
  for (let t = 0; t < 40 && !g.$stop.asked; t++) step(g, {}, bus);
  return cops;
}
const armed = (w) => { const p = w.g.people[w.g.player]; p.hand = newGun(p, 'makarov'); };

export default [
  {
    name: 'legend: arrested with a gun under a legend: no diplomatic passport, the legend looked into (by the country\'s counter-intelligence and the charge): it holds, a sentence and the posting over; it breaks, their prison and the career over',
    fn() {
      const rows = [];
      for (const [city, level] of [['moscow', 'undercover'], ['beirut', 'undercover'], ['cairo', 'undercover'], ['moscow', 'illegal']]) {
        let held = 0, years = [], taken = 0, n = 0;
        for (let s = 1; s <= 30; s++) {
          const w = hub(100 + s, city, level);
          armed(w);
          w.g.time.ms += s * 7 * HOUR;
          arrest(w.g, w.bus, w.me, 'submitted');
          const o = w.c.over; n++;
          if (o?.why === 'imprisoned') { held++; years.push(o.years); assert(o.ms > w.g.time.ms && w.papers.some(x => x.title === 'SENTENCED'), 'sentenced, out later'); }
          else if (o?.why === 'taken') { taken++; assert(w.papers.some(x => x.title === 'TAKEN'), 'taken'); }
          else assert(false, `a gun, and neither: ${JSON.stringify(o)}`);
        }
        rows.push(`${level} in ${city}: the legend held ${held}/${n} (${years.length ? `${Math.min(...years)}–${Math.max(...years)} years` : 'never'}), broke ${taken}`);
      }
      const W = hub(7, 'moscow'); armed(W); arrest(W.g, W.bus, W.me, 'submitted');
      const P = W.papers.find(x => x.kind === 'arrest');
      assert(P && !P.lines.some(l => /diplomatic passport, and the calls/.test(l)) && P.lines.some(l => /No diplomatic passport|legend doesn't hold|no legend/.test(l)), P?.lines.join(' / '));
      for (const r of rows) console.log(`      ${r}`);
      console.log(`      e.g. ${P.title}: ${P.lines.slice(1).join(' ')}`);
    },
  },
  {
    name: 'legend: a brawl under a legend: 48 hours, bail and a court date if the legend holds, the posting goes on; a knife found at a police stop is an arrest, not a report',
    fn() {
      let bail = 0, broke = 0;
      for (let s = 1; s <= 20; s++) {
        const w = hub(200 + s, 'beirut');
        w.g.time.ms += s * 5 * HOUR;
        arrest(w.g, w.bus, w.me, 'submitted', 'the description');
        if (!w.c.over && w.g.$held >= 48 * HOUR && w.papers.some(x => x.lines.some(l => /bail/.test(l)))) bail++;
        else if (w.c.over?.why === 'taken') broke++;
      }
      assert(bail >= 14 && bail + broke === 20, `bail ${bail}, broke ${broke}`);
      // (a kitchen knife in your hand at a stop: under a legend, not a report to an ambassador but the cuffs)
      const K = hub(240, 'moscow'), kp = K.g.people[K.g.player];
      kp.hand = 'kitchen';
      stopped(K.g, K.bus);
      answer(K.g, K.bus, 'papers');
      const kpaper = K.papers.find(x => x.kind === 'arrest');
      assert(kpaper && kp.hand !== 'kitchen' && (K.c.over?.why === 'taken' || K.g.$held >= 48 * HOUR), `the knife: ${kpaper?.title} ${kpaper?.lines.join(' / ')}`);
      const g = hub(9, 'cairo').g, d = scrutiny(g, g.people[g.player], 'described'), k = scrutiny(g, g.people[g.player], 'killed');
      console.log(`      a brawl in Beirut, twenty times: bail ${bail}, the legend broke ${broke}; a knife at a stop in Moscow: ${kpaper.title} (${kpaper.lines.find(l => /Charged|legend doesn't/.test(l)) ?? ''}); the scrutiny in Cairo: a brawl DC ${d.dc}, a killing DC ${k.dc} against Deception ${d.value}${d.mods.map(m => ` + ${m.v} (${m.why})`).join('')}`);
    },
  },
  {
    name: 'legend: the end of it on the career: sentenced, back on the official ladder after the years served, the country closed; taken, the career over; an illegal sentenced, brought home at the end',
    fn() {
      const w = hub(301, 'moscow'); w.c.over = { why: 'imprisoned', ms: w.g.time.ms + 3 * YEAR, years: 6, served: 3, charge: 'possessing an illegal firearm' };
      const L = offers(w.c, w.c.over.ms), F = facesOf(w.c);
      assert(L.length && L.every(o => o.kind === 'official') && F.includes('ru'), `offers ${L.map(o => o.title)}; faces ${F}`);
      const t = hub(302, 'beirut'); t.c.over = { why: 'taken', ms: t.g.time.ms };
      const i = hub(303, 'cairo', 'illegal'); i.c.over = { why: 'imprisoned', ms: i.g.time.ms + 5 * YEAR };
      assert(!offers(t.c, t.c.over.ms).length && careerEnd(t.c, t.c.over.ms) === null && careerEnd(i.c, i.c.over.ms)?.why === 'last', 'taken: lost; an illegal imprisoned: the last');
      console.log(`      sentenced in Moscow: ${L.length} stations offered after the years, faces on file ${F.join(', ')}; taken in Beirut: the career over; an illegal out of prison: ${careerEnd(i.c, i.c.over.ms).words}`);
    },
  },
  {
    name: 'legend: blown is hunted, not expelled: heat at the top, the BLOWN paper, the hunt for a foreign spy wherever you step out, the flat theirs (home is taken), the way out your own',
    fn() {
      const w = hub(401, 'moscow'), p = w.c.posting, papers = [];
      p.heat = 97;
      papers.push(...pass(w.c, w.g.time.ms, w.g.time.ms + DAY));
      assert(w.c.blown && !w.c.over && papers.some(x => x.title === 'BLOWN') && w.c.waypoint?.row === p.exfil.row, `blown ${!!w.c.blown}, over ${w.c.over?.why}, papers ${papers.map(x => x.title)}`);
      for (let t = 0; t < 41; t++) step(w.g, {}, w.bus);
      const H = huntOf(w.g);
      assert(H?.why === 'blown' && H.who.known, `the hunt ${H?.why}, face ${H?.who?.known}`);
      Object.assign(w.me, { x: p.home.x, z: -2.6 });
      for (let t = 0; t < 21; t++) step(w.g, {}, w.bus);
      step(w.g, { act: ['instinct'] }, w.bus);
      assert(w.c.over?.why === 'taken' && w.papers.some(x => x.title === 'TAKEN'), `home: ${w.c.over?.why}`);
      console.log(`      ${papers.find(x => x.title === 'BLOWN').lines.join(' ')} | the hunt: ${H.what}, the whole city; up to the flat: ${w.c.over.why}`);
    },
  },
  {
    name: 'legend: the way out (self-extraction): no agency extraction under a legend; only hunted or blown; undercover, the point far from the centre open six hours; an illegal\'s only once the Center answers, a day or two on; reached, out',
    fn() {
      const out = [];
      for (const level of ['undercover', 'illegal']) {
        const w = hub(500 + (level === 'illegal' ? 1 : 0), 'cairo', level), c = w.c, p = c.posting, S = supportOf(c);
        const keys = (st) => services(st).map(s => s.key);
        const before = services(w.g).find(s => s.key === 'exfil');
        assert(!keys(w.g).includes('extract') && keys(w.g).includes('exfil') && !before.ok, `${level}: ${keys(w.g)}; the way out ${before.ok}`);
        pass(c, w.g.time.ms, w.g.time.ms + DAY); p.heat = 99; w.papers.push(...pass(c, w.g.time.ms, w.g.time.ms + DAY));
        const sv = services(w.g).find(s => s.key === 'exfil'), r = ring(w.g, w.bus, 'exfil', sv.phones[0].key), R = c.rung.exfil;
        const far = Math.abs(p.exfil.row - p.home.row), wait = (R.from - w.g.time.ms) / HOUR, open = (R.until - R.from) / HOUR;
        assert(r.ok && far >= 8 && (level === 'illegal' ? wait >= 24 && wait <= 48 : wait === 0), `${level}: ${r.text}; ${far} streets; ${fmt(wait, 1)} h`);
        // (there, in its hours: out)
        w.g.time.ms = R.from + HOUR; w.g.map.row = p.exfil.row; Object.assign(w.me, { x: p.exfil.x, z: -2.6 });
        dialSecond(w.g, w.bus, w.me);
        assert(c.over?.why === (level === 'illegal' ? 'brought' : 'exfiltrated'), `${level}: ${c.over?.why}`);
        out.push(`${level}: support ${S.max} at most, back ${S.perDay} a day; the way out ${far} streets from the flat (${p.exfil.label}), ${level === 'illegal' ? `the Center's answer ${fmt(wait, 0)} h on, then ${open} h` : `open ${open} h`}: ${c.over.why}`);
      }
      for (const o of out) console.log(`      ${o}`);
    },
  },
  {
    name: 'legend: the job lost fails the posting (LET GO); the station\'s word by dead drop: the week\'s review left at a bench on Monday, read when collected',
    fn() {
      const w = hub(601, 'beirut'), c = w.c, p = c.posting;
      let d = Math.floor(w.g.time.ms / DAY);
      while (calendar(d * DAY).weekday !== 6) d++;
      pass(c, w.g.time.ms, (d + 1) * DAY + 9 * HOUR);
      const pending = c.signals?.length;
      w.g.time.ms = (d + 1) * DAY + 9 * HOUR;
      dialSecond(w.g, w.bus, w.me);
      const D = c.rung.drops.find(x => x.what === 'signal');
      assert(pending === 1 && D && !w.papers.some(x => /THE WEEK|THE STATION/.test(x.title)), `pending ${pending}, drop ${!!D}`);
      w.g.map.row = D.at.row; Object.assign(w.me, { x: D.at.x, z: D.at.z });
      const at = dropAt(w.g, w.me), text = at && collect(w.g, w.bus, at), paper = w.papers.find(x => /THE STATION/.test(x.title));
      assert(paper && /film of paper/.test(text), `collected: ${text}; ${paper?.title}`);
      p.cover = 4;
      const lost = pass(c, (d + 1) * DAY + 10 * HOUR, (d + 3) * DAY + 10 * HOUR);
      assert(c.over?.why === 'sacked' && lost.some(x => x.title === 'LET GO'), `cover ${p.cover}: ${c.over?.why}`);
      console.log(`      Monday's chalk mark: ${D.at.label}; collected: "${text}" (${paper.title}: ${paper.lines.join(' ')}); the job's standing at nothing: ${lost.find(x => x.title === 'LET GO').lines[0]}`);
    },
  },
];
