// A look at a body (sim/diagnosis.js): what plain sight shows and what a Medicine roll finds besides, by how
// well it's made; a look kept a while, and rolled again; the words read live from the body; first aid's options
// named as far as they're known; the time the blood gives; and the figure marked where the wounds are.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { bullet } from '../src/sim/shooting.js';
import { MODELS } from '../src/sim/firearms.js';
import { person } from '../src/sim/interact.js';
import { injure, hurt, takes } from '../src/sim/health.js';
import { options } from '../src/sim/aid.js';
import { diagnose, findings, finds, minutesTo, lookOf, FINDS, DIAGNOSE_DC, LOOK_AGAIN_S } from '../src/sim/diagnosis.js';
import { doll } from '../src/art/doll.js';
import { assert, fmt } from './helpers.mjs';

// (the free walk at noon; a passer-by beside you, shot twice in the chest: the user's woman)
function scene(seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
  start(g, null);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g);
  const next = () => {
    const a = g.actors.find(o => o.ai?.civ && !o.who && o !== me);
    Object.assign(a, { x: me.x + 1.2, z: me.z, vx: 0, vz: 0 });
    return { a, p: person(g, a) };
  };
  return { g, me, mine: g.people[me.who], next };
}
/** A look that's made (a natural 1 fails anyone: looked again, fresh, till it's made). */
const sure = (g, me, a) => { for (let k = 0; k < 20; k++) { delete g.people[a.who].$dx; const L = diagnose(g, null, me, a); if (L.ok) return L; } throw new Error('never made'); };
const all = (f) => [...f.status.map(s => s.text), ...f.rows.map(r => `${r.words}: ${r.detail}`), ...f.needs.map(n => n.text)].join(' | ');

export default [
  {
    name: 'diagnosis: two bullets in the chest, looked at by Medicine 0, 10 and 20, many times: what each finds (gunshots, the exit, bleeding inside, the time left, what it takes)',
    fn() {
      const { g, me, mine, next } = scene();
      const { a, p } = next();
      bullet(g, null, a, 'torso', MODELS.makarov, me); bullet(g, null, a, 'torso', MODELS.makarov, me);
      const plain = findings(g, p, { actor: a });
      console.log(`      plain sight: ${all(plain)}`);
      assert(!/gunshot|inside,|exit|%/.test(all(plain)) && plain.rows.length === 2, 'plain sight: two wounds in the chest, nothing of what made them, nothing inside');
      const N = 400, out = {};
      for (const med of [0, 10, 20]) {
        mine.skills.medicine = [med, 0];
        const n = { made: 0, kind: 0, through: 0, inside: 0, blood: 0, safe: 0, liar: 0 };
        for (let k = 0; k < N; k++) {
          delete p.$dx;
          const L = diagnose(g, null, me, a), f = findings(g, p, { actor: a }), t = all(f);
          if (L.ok) n.made++;
          if (/gunshot/.test(t)) n.kind++;
          if (/exit/.test(t)) n.through++;
          if (/Bleeding inside, from the chest/.test(t)) n.inside++;
          if (/blood left|Hardly any blood/.test(t)) n.blood++;
          if (!L.ok && /treat it as bad/.test(t) && /If in doubt, a hospital/.test(t)) n.safe++;
          if (/No sign of bleeding inside/.test(t)) n.liar++;                    // (there is bleeding inside: no look may say otherwise)
        }
        out[med] = n;
        const pc = (x) => `${fmt(100 * x / N, 0)}%`;
        console.log(`      Medicine ${String(med).padStart(2)}: the look made ${pc(n.made)}; gunshots named ${pc(n.kind)}, the exit or none ${pc(n.through)}, bleeding inside ${pc(n.inside)}, the blood and the time left ${pc(n.blood)}; failed and said so the safe way ${pc(n.safe)} (of ${pc(N - n.made)} failed)`);
        assert(n.liar === 0, 'never "no sign of bleeding inside" when there is');
        assert(n.safe === N - n.made, 'every failed look says: treat it as bad, if in doubt a hospital');
      }
      assert(out[0].made < out[10].made && out[10].made <= out[20].made, 'the trained make it more');
      assert(out[0].inside / N < 0.25 && out[10].inside / N > 0.5 && out[20].inside / N > 0.9, 'bleeding inside: rarely untrained, mostly at 10, nearly always at 20');
      assert(out[0].kind / N > 0.4 && out[0].kind / N < 0.7, 'an untrained eye tells a bullet\'s hole about half the time');
      console.log(`      (DC ${DIAGNOSE_DC}; by the margin: ${Object.entries(FINDS).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')})`);
    },
  },
  {
    name: 'diagnosis: a look is kept (looked again within a minute, the same; later, rolled again and the better kept); a wound made after it shows as plain sight till the next',
    fn() {
      const { g, me, mine, next } = scene(7);
      const { a, p } = next();
      mine.skills.medicine = [10, 0];
      injure(p, 'armL', 0.5, g.rng, g.time.ms, { edge: true, deep: true });
      const L1 = diagnose(g, null, me, a), r1 = g.log.length;
      const L2 = diagnose(g, null, me, a);
      assert(L2 === L1 && g.log.length === r1, 'within LOOK_AGAIN_S: the same look, no roll');
      for (let t = 0; t < (LOOK_AGAIN_S + 5) * 20; t++) step(g, {}, null);
      const L3 = diagnose(g, null, me, a);
      assert(L3.margin >= L1.margin && g.log.length > r1, `a minute on: rolled again, the better kept (${L1.margin} then ${L3.margin})`);
      // (shot a moment later: a wound the look didn't see)
      step(g, {}, null);
      Object.assign(a, { x: me.x + 1.2, z: me.z });
      bullet(g, null, a, 'legs', MODELS.makarov, me);
      const shot = p.injuries.find(i => i.gunshot && !i.internal);
      assert(!finds(p, g.time.ms, 'kind', shot) && /^A wound in the/.test(findings(g, p, { actor: a }).rows.find(r => r.idx === p.injuries.indexOf(shot)).words), 'the new wound: plain sight');
      const L4 = diagnose(g, null, me, a), cut = p.injuries.find(i => i.kind === 'cut' && !i.gunshot);
      assert(L4 !== L3 && L4.ms === g.time.ms, 'something new on the body: a look again rolls again, whenever');
      assert(finds(p, g.time.ms, 'artery', cut) === L3.margin >= FINDS.artery, 'what the earlier look saw of the cut, it still knows, whatever the new one rolled');
      console.log(`      looks: ${L1.margin}, again at once the same, a minute on ${L3.margin} (kept the better), shot since: rolled again (${L4.margin}); kept ${lookOf(p, g.time.ms) ? 'yes' : 'no'}`);
    },
  },
  {
    name: 'diagnosis: the words read the body as it stands (up, down, the dressing on, the splint, the graze that didn\'t go in); first aid names what it knows, and bleeding inside only once found',
    fn() {
      const { g, me, mine, next } = scene(9);
      mine.skills.medicine = [20, 0];
      // (a deep cut on the arm, bandaged; standing)
      const c = next();
      injure(c.p, 'armL', 0.4, g.rng, g.time.ms - 600000, { edge: true, deep: true });
      const cut = c.p.injuries.find(i => i.kind === 'cut');
      Object.assign(cut, { artery: false, name: 'a deep cut on the left arm', dressed: true, bandage: g.time.ms - 300000, bleed: g.time.ms - 300000 });
      sure(g, me, c.a);
      const fc = findings(g, c.p, { actor: c.a });
      console.log(`      a bandaged cut: ${all(fc)}`);
      assert(fc.status[0].text.startsWith('On his feet') || fc.status[0].text.startsWith('On her feet'), 'on their feet');
      assert(fc.rows[0].care === 'bandaged' && fc.rows[0].tone === 'ok' && fc.marks.wounds[0].dressed === 'bandage', 'the dressing shows, on the figure too');
      // (a broken shin, set and splinted)
      const b = next();
      hurt(b.p, 'legR', takes(b.p, 'legR') * 1.05);
      b.p.injuries = [{ part: 'legR', kind: 'fracture', name: 'a fractured right shin', ms: g.time.ms, until: g.time.ms + 42 * 86400000, bleed: 0 }];
      b.p.splints = { legR: { ms: g.time.ms } }; b.p.set = { legR: { ms: g.time.ms } };
      sure(g, me, b.a);
      const fb = findings(g, b.p, { actor: b.a });
      console.log(`      a broken shin: ${all(fb)}`);
      assert(fb.rows[0].words === 'A fractured right shin' && /set, splinted/.test(fb.rows[0].care) && fb.marks.splints.includes('legR'), 'the break named, set and splinted');
      // (two in the chest: down; first aid's options before a look and after)
      const s = next();
      bullet(g, null, s.a, 'torso', MODELS.makarov, me); bullet(g, null, s.a, 'torso', MODELS.makarov, me);
      const before = options(g, mine, s.p);
      assert(!before.some(o => /inside/i.test(o.label)) && before.some(o => /Press on the first wound in the chest/.test(o.label)), `before a look: no row for bleeding inside, and the wounds as seen (${before[0].label})`);
      sure(g, me, s.a);
      const after = options(g, mine, s.p), fs = findings(g, s.p, { actor: s.a });
      assert(after.filter(o => /inside/i.test(o.label)).length === 1 && after.some(o => /first gunshot wound/.test(o.label)), 'after: one row for bleeding inside, the gunshots named');
      assert(fs.status[0].text.startsWith('Down') && fs.marks.inside, 'down; the figure marks what bleeds inside');
      // (a graze along the skull)
      const h = next(), ms = g.time.ms;
      h.p.injuries = [{ part: 'head', kind: 'cut', name: 'a bullet graze along the skull', ms, until: ms + 10 * 86400000, bleed: ms + 3600000, rate: 2, deep: true, gunshot: true, through: false }];
      sure(g, me, h.a);
      const fh = findings(g, h.p, { actor: h.a });
      assert(/didn't go in/.test(fh.rows[0].detail) && fh.marks.wounds[0].kind === 'graze', 'a graze: it didn\'t go in');
      // (someone unhurt: nothing to roll for)
      const u = next();
      assert(diagnose(g, null, me, u.a) === null && findings(g, u.p, { actor: u.a }).rows.length === 0, 'unhurt: no look, no rows');
      console.log(`      two in the chest, after a look: ${after.map(o => o.label).slice(0, 3).join(' · ')}…`);
    },
  },
  {
    name: 'diagnosis: the time the blood gives (minutesTo): a split lip stops before it matters, two in the chest have them down in minutes',
    fn() {
      const lip = { injuries: [{ part: 'head', kind: 'split', bleed: 240000, rate: 0.15 }] };
      const chest = { injuries: [{ part: 'torso', kind: 'cut', bleed: 6 * 3600000, rate: 10 }, { part: 'torso', kind: 'cut', bleed: 6 * 3600000, rate: 9 }, { part: 'torso', kind: 'cut', internal: true, bleed: 3 * 3600000, rate: 0.5 }] };
      const inside = { injuries: [{ part: 'torso', kind: 'cut', internal: true, bleed: 3 * 3600000, rate: 0.5 }] };
      const t = [minutesTo(lip, 0, 55), minutesTo(chest, 0, 55), minutesTo(chest, 0, 45), minutesTo(inside, 0, 55)];
      console.log(`      a split lip: ${t[0] ?? 'never'}; two in the chest: down in ${t[1]} min, dead in ${t[2]}; bleeding inside alone: down in ${t[3]} min`);
      assert(t[0] === null && t[1] <= 3 && t[2] <= 4 && t[3] > 60 && t[3] <= 180, 'the times');
    },
  },
  {
    name: 'diagnosis: the figure (src/art/doll.js) marks each wound where it lies: on its part, the pixels changed there, numbered as the rows are',
    fn() {
      const look = { top: { kind: 'coat', color: 0x5a4636 }, legs: 0x283f6b, hair: { style: 'short', color: 0x2a1c18 } };
      const plain = doll({ look, sex: 'f' });
      const marks = { wounds: [{ part: 'torso', kind: 'hole', bleed: 3, n: 1, tone: 'bad' }, { part: 'armR', kind: 'cut', bleed: 0, dressed: 'bandage', n: 2, tone: 'ok' }, { part: 'legL', kind: 'break', n: 3, tone: 'mid' }, { part: 'head', kind: 'graze', bleed: 2, n: 4, tone: 'mid' }, { part: 'torso', kind: 'inside', n: 5, tone: 'bad' }], tourniquets: ['legR'], splints: ['legL'], bloody: { clothes: true }, inside: true };
      const R = doll({ look, sex: 'f', wounds: marks });
      const changed = (x, y, r = 2) => { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (R[y + dy]?.[x + dx] !== plain[y + dy]?.[x + dx]) n++; return n; };
      const where = R.spots.map(s => `${s.n} ${s.part} (${s.x}, ${s.y}): ${changed(s.x, s.y)} px`);
      console.log(`      ${where.join('; ')}`);
      const at = Object.fromEntries(R.spots.map(s => [s.n, s]));
      assert(R.spots.length === 5 && R.spots.every(s => changed(s.x, s.y, 3) > 0), 'every mark drawn where its spot is');
      assert(at[2].x < 32 && at[3].x >= 32, 'their right arm on our left, their left leg on our right');
      assert(at[4].y < 12 && at[1].y > 30 && at[1].y < 60 && at[3].y > 100, 'the graze on the skull, the chest wound on the chest, the break on the shin');
      assert(R.length === plain.length && R[0].length === plain[0].length, 'the same figure, marked');
    },
  },
];
