// The station's files and its briefs (sim/dossier.js): who the targets are by city (names, roles, covers,
// how careful), what they look like and whom they meet; briefs written from those facts, the place, the
// hour and the light, no line of the same man's said twice till its pool's run out; and the tail scene
// playing his file: his look, his skills, his lookalikes, its lines in his words.
import { newGame, start, step } from '../src/sim/game.js';
import { candidates, newCampaign, context, plan } from '../src/sim/campaign.js';
import { fileOf, briefOf, sigOf, CRAFT } from '../src/sim/dossier.js';
import { missionPlace } from '../src/sim/places.js';
import { clockText } from '../src/sim/clock.js';
import { cityById } from '../src/sim/cities/index.js';
import { assert } from './helpers.mjs';

const CITIES = [['moscow', 'handler'], ['london', 'junior'], ['london', 'handler'], ['cairo', 'handler'], ['beirut', 'handler']];

export default [
  {
    name: 'dossier: targets of their city (an Egyptian in Cairo, the residency\'s Russians in London), each a role, a cover, a place of work, a craft, a look to know him by, and a man he meets',
    fn() {
      const roles = new Set(), lines = new Set(), crafts = {}, names = {};
      for (const [city, level] of CITIES) for (let seed = 1; seed <= 24; seed++) {
        const c = newCampaign(seed, candidates(seed, city, level)[0], city, level);
        for (const t of c.posting.targets) {
          assert(t.file && t.role && t.cover && t.workplace && CRAFT[t.craft] && t.look && t.meets?.look && t.age >= 22 && t.age <= 68, `${city} ${seed}: a file`);
          const s = sigOf(t.look);
          assert(['briefcase', 'newspaper'].includes(s.carry) && s.hat && s.coat && !/T-shirt/.test(s.coat), 'something to know him by, dressed for it');
          roles.add(`${city}:${t.role}`); lines.add(s.line); crafts[t.craft] = (crafts[t.craft] ?? 0) + 1;
          (names[city] ??= new Set()).add(t.name);
        }
      }
      const ru = /(ov|ev|in|sky|ko)$/;
      assert([...names.cairo].every(n => !ru.test(n.split(' ').at(-1))) && [...names.beirut].every(n => !ru.test(n.split(' ').at(-1))), 'no Russians in Cairo or Beirut by name');
      console.log(`      ${roles.size} roles, ${lines.size} looks in ${Object.values(crafts).reduce((a, b) => a + b)} targets; craft ${Object.entries(crafts).map(([k, n]) => `${k} ${n}`).join(', ')}; e.g. ${[...names.cairo].slice(0, 2).join(', ')}, ${[...names.beirut].slice(0, 2).join(', ')}, ${[...names.london].slice(0, 2).join(', ')}`);
      assert(roles.size >= 25 && lines.size >= 100 && Object.keys(crafts).length === 4, 'many roles, looks, every craft');
    },
  },
  {
    name: 'dossier: briefs from the facts (his look, the place, the hour, the light), no line of the same man\'s twice till its pool\'s said, and hundreds of different paragraphs',
    fn() {
      const paras = new Set();
      let briefs = 0, repeats = 0, pairs = 0;
      for (const [city, level] of CITIES) for (let seed = 1; seed <= 12; seed++) {
        const c = newCampaign(seed, candidates(seed, city, level)[0], city, level);
        for (const t of c.posting.targets) t.contact = 1;
        plan(c, c.posting.startMs + 21 * 864e5);
        const last = {};
        for (const a of c.assignments) {
          const b = briefOf(c, a), text = b.body.join(' '), at = missionPlace(c, a);
          briefs++;
          for (const p of b.body) paras.add(p);
          assert(text.includes(clockText(a.from)), 'its hour');
          if (at && a.kind !== 'tail') assert(text.toLowerCase().includes(at.label.replace(/^(A bench in|Outside) /, '').toLowerCase()), `its place: ${at.label}`);
          if (a.kind === 'tail' && !a.trip) { const t = c.posting.targets.find(x => x.id === a.who); assert(text.includes(sigOf(t.look).line.slice(1, -1)), 'his look, as the file has it'); }
          // (the same man's last brief: no paragraph the same)
          const k = `${a.kind}:${a.who}`;
          if (last[k]) { pairs++; if (b.body.filter(p => last[k].includes(p) && !/^\d\d:\d\d|^He leaves|^He's out/.test(p)).length > 1) repeats++; }
          last[k] = b.body;
        }
      }
      console.log(`      ${briefs} briefs, ${paras.size} different paragraphs; the same man's next brief sharing more than one paragraph with his last: ${repeats} of ${pairs}`);
      assert(paras.size >= 600 && repeats <= pairs * 0.05, 'variety, and no saying the same twice running');
    },
  },
  {
    name: 'dossier: a campaign\'s tail plays his file: his look and craft in the scene, lookalikes of his, its lines in his words and his city\'s',
    fn() {
      const out = [];
      for (const [seed, city] of [[2, 'cairo'], [3, 'beirut'], [4, 'london'], [5, 'moscow']]) {
        const c = newCampaign(seed, candidates(seed, city)[0], city), a = c.assignments.find(x => x.kind === 'tail');
        if (!a) continue;
        const t = fileOf(c, c.posting.targets.find(x => x.id === a.who)), s = sigOf(t.look);
        const g = newGame({ seed, scenario: 'tail', campaign: c, context: context(c, a), autoplay: { keep: 20 } });
        start(g, null);
        const him = g.people.orlov, twins = Object.values(g.people).filter(p => p.tell);
        assert(JSON.stringify(him.look) === JSON.stringify(t.look) && him.skills.pathfinding[0] === CRAFT[t.craft].pathfinding, 'his look, his craft');
        assert(twins.length === 3 && twins.every(x => x.look.top.color === t.look.top.color || x.tell.includes('younger')), 'lookalikes of his');
        for (let k = 0; k < 20 * 60 * 6; k++) step(g, {}, null);
        const said = g.log.map(e => e.text).join(' ') + ' ' + (g.scenario.prompt?.text ?? '');
        const city2 = cityById(city).name;
        assert(!/Moscow/.test(said) || city === 'moscow', `no Moscow in ${city2}'s lines`);
        assert(!/grey coat|fedora|briefcase/.test(said) || /grey coat|fedora|briefcase/.test(`${s.coat} ${s.hat} ${s.carry}`), 'his words, not Orlov\'s');
        out.push(`${city2}: ${t.name}, ${t.craft}, ${s.line} (${twins.map(x => x.tell).join('; ')})`);
      }
      console.log(`      ${out.join('\n      ')}`);
      assert(out.length >= 3, 'played');
    },
  },
];
