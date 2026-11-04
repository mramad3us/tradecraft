// Body armour (sim/armour.js): what a soft vest and a plate carrier stop of each round, and what a stopped round
// still does (the bruise, a cracked rib, the knock); blades on it; what it costs (the legs, the core, the week's
// training, being seen); who wears it; noticing a vest up close; the arch; the words the read and first aid use; the
// wardrobe and the door; and the carrier drawn over the top.
import { newGame, start, step, playerActor } from '../src/sim/game.js';
import { bullet } from '../src/sim/shooting.js';
import { MODELS } from '../src/sim/firearms.js';
import { person } from '../src/sim/interact.js';
import { sheet } from '../src/sim/people.js';
import { startFight, resolve, MOVES } from '../src/sim/cqc.js';
import { mobility, takes, stateOf } from '../src/sim/health.js';
import { settleTo } from '../src/sim/thermal.js';
import { onFoot } from '../src/sim/fitness.js';
import { mods as noticeMods } from '../src/sim/notice.js';
import { rings, screen, PLATES } from '../src/sim/screening.js';
import { armCop } from '../src/sim/armed.js';
import { policeOf } from '../src/sim/countries/index.js';
import { read } from '../src/sim/know.js';
import { findings, diagnose, seenName } from '../src/sim/diagnosis.js';
import { dress, wardrobeWays, comeIn, armourPiece } from '../src/sim/clothes.js';
import { toJSON, fromJSON } from '../src/sim/state.js';
import { frame } from '../src/art/sprites.js';
import { doll } from '../src/art/doll.js';
import * as AR from '../src/sim/armour.js';
import { seedRng, stream } from '../src/sim/rng.js';
import { check } from '../src/sim/checks.js';
import { assert, fmt } from './helpers.mjs';

const pct = (x) => `${Math.round(x * 100)}%`;
// (a street at noon, and someone on it to shoot: their sheet reset before every round)
function range0(seed = 4) {
  const g = newGame({ seed, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
  start(g, null);
  for (let t = 0; t < 40; t++) step(g, {}, null);
  const me = playerActor(g), a = g.actors.find(o => o !== me && o.ai && !o.cop);
  return { g, me, a, p: person(g, a) };
}
/** n torso hits from a gun at d metres on someone wearing `kind` (or nothing): what they did. */
function volley(model, kind, n = 600, d = 10, seed = 4) {
  const { g, me, a, p } = range0(seed), M = MODELS[model], out = { n, stopped: 0, through: 0, wound: 0, arm: 0, crack: 0, down: 0, blunt: 0, worst: 'unhurt' };
  g.rng = seedRng(17);
  for (let k = 0; k < n; k++) {
    Object.assign(p, { body: {}, injuries: [] }); delete p.dead; delete p.blood; delete p.armour;
    if (kind) AR.wear(p, kind);
    a.gait = 'idle'; if (a.ai) a.ai.downUntil = 0;
    g.time.ms += 1000;
    const from = { x: a.x - d, z: a.z, who: 'nobody' };            // (not you: no read of theirs learns of it)
    bullet(g, null, a, 'torso', M, from);
    const I = p.injuries ?? [];
    if (I.some(i => i.gunshot && i.part.startsWith('arm'))) { out.arm++; continue; }
    if (I.some(i => i.kind === 'blunt')) { out.stopped++; out.blunt += p.body.torso ?? 0; if (I.some(i => i.kind === 'crack')) out.crack++; if (a.gait === 'down') out.down++; const s = stateOf(p, 'torso'); if (['unhurt', 'bruised', 'hurt', 'wounded', 'out'].indexOf(s) > ['unhurt', 'bruised', 'hurt', 'wounded', 'out'].indexOf(out.worst)) out.worst = s; }
    else if (I.some(i => i.gunshot && /through the/.test(i.name))) out.through++;
    else out.wound++;
  }
  const torso = n - out.arm;
  return { ...out, torso, sStop: out.stopped / torso, sWound: (out.wound + out.through) / torso, meanBlunt: out.stopped ? out.blunt / out.stopped : 0, sCrack: out.stopped ? out.crack / out.stopped : 0, sDown: out.stopped ? out.down / out.stopped : 0 };
}

export default [
  {
    name: 'armour: torso hits from a Makarov, a Glock, a Tokarev, an AK-74M, an AKM and an SVD, on no armour, a soft vest and a plate carrier: stopped, wounded, and what a stopped round still does',
    fn() {
      const guns = [['makarov', 'Makarov 9×18'], ['glock17', 'Glock 9×19'], ['colt1911', '1911 .45'], ['tokarev', 'Tokarev 7.62×25'], ['mp7', 'MP7 4.6×30'], ['ak74m', 'AK-74M 5.45×39'], ['akm', 'AKM 7.62×39'], ['m4', 'M4 5.56×45'], ['svd', 'SVD 7.62×54R'], ['rem870', '870 12-gauge']];
      const R = {};
      for (const [m, word] of guns) {
        R[m] = {};
        const row = [];
        for (const kind of [null, 'light', 'heavy']) {
          const v = volley(m, kind, 500);
          R[m][kind ?? 'none'] = v;
          row.push(`${kind ?? 'none'}: stopped ${pct(v.sStop)}, wound ${pct(v.sWound)}${v.stopped ? ` (blunt ${fmt(v.meanBlunt)} pts, worst ${v.worst}; a rib ${pct(v.sCrack)}, off their feet ${pct(v.sDown)})` : ''}`);
        }
        console.log(`      ${word} at 10 m, torso hits: ${row.join('; ')}`);
      }
      const close = volley('tokarev', 'light', 500, 4), far = volley('tokarev', 'light', 500, 40);
      console.log(`      a Tokarev into a soft vest: at 4 m stopped ${pct(close.sStop)}, at 40 m ${pct(far.sStop)}`);
      // (no armour, nothing stopped; a vest stops the handgun rounds, nearly all, on the three in four that land on it)
      for (const m of Object.keys(R)) assert(R[m].none.stopped === 0, `${m}: nothing stops a round with no armour`);
      for (const m of ['makarov', 'glock17', 'colt1911']) assert(R[m].light.sStop > 0.65 && R[m].light.sStop < 0.85, `${m} into a soft vest: about three in four stopped (${pct(R[m].light.sStop)})`);
      for (const m of ['ak74m', 'akm', 'm4', 'svd']) assert(R[m].light.sStop === 0, `${m}: no rifle round stopped by a soft vest`);
      for (const m of ['ak74m', 'akm', 'm4', 'svd']) assert(R[m].heavy.sStop > 0.3 && R[m].heavy.sStop < 0.6, `${m} on a carrier: the plates' half (${pct(R[m].heavy.sStop)})`);
      for (const m of ['makarov', 'glock17']) assert(R[m].heavy.sStop > 0.7, `${m} on a carrier: plates and soft both stop it (${pct(R[m].heavy.sStop)})`);
      assert(R.mp7.light.sStop < 0.3, `the MP7's round, made to go through soft armour: ${pct(R.mp7.light.sStop)} stopped`);
      assert(close.sStop < far.sStop, 'a Tokarev up close goes through a vest more than from far off');
      assert(R.glock17.light.meanBlunt < R.svd.heavy.meanBlunt && R.svd.heavy.sCrack > R.glock17.light.sCrack, 'a rifle round on a plate hits harder behind it than a pistol\'s into a vest');
      assert(['bruised', 'hurt'].includes(R.glock17.light.worst), `a 9 mm stopped: a bruise, not a wound (${R.glock17.light.worst})`);
    },
  },
  {
    name: 'armour: blades on the torso: a vest turns most slashes and a few stabs, a plate stops them; knife fights to the end with and without',
    fn() {
      const r = stream('blades', 1), N = 4000, rows = [];
      for (const kind of ['light', 'heavy']) {
        const p = sheet({ id: 'b' }); AR.wear(p, kind);
        for (const [edge, how] of [['blade', 'slash'], ['blade', 'stab'], ['point', 'stab'], [null, 'jab']]) {
          let on = 0, stop = 0, deep = 0, k = 0;
          for (let i = 0; i < N; i++) { const A = AR.blow(p, edge, how, r); if (!A) continue; on++; stop += A.stopped; deep += A.deep; k += A.k; }
          rows.push(`${kind} ${edge ?? 'blunt'} ${how}: on it ${pct(on / N)}, stopped ${pct(stop / on)}, still deep ${pct(deep / on)}, damage ×${fmt(k / on, 2)}`);
        }
      }
      console.log(`      ${rows.join('\n      ')}`);
      // (a real fight, 10 with a combat knife against 10 bare-handed, their torso armoured or not: the deep cuts and the dead)
      const COUNTER = { hit: 'guard', grapple: 'hit', guard: 'grapple', open: 'hit' };
      const fights = (kind, n = 300) => {
        let deepT = 0, deadB = 0, won = 0;
        for (let seed = 1; seed <= n; seed++) {
          const s = { rng: seedRng(seed), people: {}, time: { ms: 0 }, map: { row: 0 } };
          s.people.a = sheet({ id: 'a', name: 'A', skills: { cqc: [10, 0], fitness: [5, 0] } }); s.people.a.hand = 'combat';
          s.people.b = sheet({ id: 'b', name: 'B', skills: { cqc: [10, 0], fitness: [5, 0] } });
          if (kind) AR.wear(s.people.b, kind);
          const f = startFight(s, 'a', 'b', {});
          let q = seed * 7 + 1, m = 0;
          const rr = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
          while (!f.ended && m++ < 200) { const mv = f.read ? COUNTER[f.theirs.move] : MOVES[Math.floor(rr() * 3)]; resolve(s, f, { move: mv, spend: f.adv.a > 0 && f.read && mv === 'hit' }); s.time.ms += 1000; }
          deepT += (s.people.b.injuries ?? []).filter(i => i.part === 'torso' && i.deep).length; deadB += !!s.people.b.dead; won += f.ended?.by === 'a';
        }
        return { deep: deepT / n, dead: deadB / n, won: won / n };
      };
      const none = fights(null), light = fights('light'), heavy = fights('heavy');
      console.log(`      10 with a combat knife v 10 bare: no armour ${fmt(none.deep, 2)} deep torso wounds a fight, dead ${pct(none.dead)}, the knife wins ${pct(none.won)}; a soft vest ${fmt(light.deep, 2)}, ${pct(light.dead)}, ${pct(light.won)}; a plate carrier ${fmt(heavy.deep, 2)}, ${pct(heavy.dead)}, ${pct(heavy.won)}`);
      assert(light.deep < none.deep && heavy.deep < light.deep, 'fewer deep torso wounds in a vest, fewer still in plates');
      assert(light.won > 0.4, `a vest doesn't make a knife harmless: the knife still wins ${pct(light.won)}`);
    },
  },
  {
    name: 'armour: what it costs: the legs, the core on a warm day, the week\'s training, being seen',
    fn() {
      const base = sheet({ id: 'me', look: { top: { kind: 'jacket' } } }), soft = sheet({ id: 'me', look: { top: { kind: 'jacket' } } }), plate = sheet({ id: 'me', look: { top: { kind: 'jacket' } } });
      AR.wear(soft, 'light'); AR.wear(plate, 'heavy');
      const hot = { temp: 30, wind: 0, kind: 'clear', cloud: 0 }, cold = { temp: -10, wind: 1, kind: 'overcast', cloud: 1 };
      const t = (p, w) => settleTo(p, w, { hour: 14 }).target;
      const load = (p) => { const g = { time: { ms: 0 }, player: 'me' }; onFoot(g, null, p, 1000, 0); return p.fit.load; };
      console.log(`      the legs: none ×${mobility(base)}, a soft vest ×${mobility(soft)}, a plate carrier ×${mobility(plate)}; the core, in a jacket at 30 °C in the sun: ${fmt(t(base, hot), 2)} / ${fmt(t(soft, hot), 2)} / ${fmt(t(plate, hot), 2)} °C, at −10: ${fmt(t(base, cold), 2)} / ${fmt(t(soft, cold), 2)} / ${fmt(t(plate, cold), 2)}; a kilometre walked: ${fmt(load(base), 2)} / ${fmt(load(soft), 2)} / ${fmt(load(plate), 2)} training points; being looked for: ${noticeMods(plate).map(m => `${m.why} +${m.v}`).join(', ') || 'nothing'} (a vest: ${noticeMods(soft).length ? 'something' : 'nothing'})`);
      assert(mobility(plate) < 0.95 && mobility(soft) === 1, 'a carrier slows you; a vest doesn\'t');
      assert(t(plate, hot) > t(soft, hot) && t(soft, hot) > t(base, hot), 'warmer in a vest, warmer still in a carrier, on a hot day');
      assert(t(plate, cold) >= t(base, cold), 'and no colder in the cold');
      assert(load(plate) > load(base) * 1.4, 'a kilometre in a carrier is a load carried');
      assert(noticeMods(plate).some(m => m.v === AR.SEEN_MOD) && !noticeMods(soft).length, 'a carrier is seen; a vest isn\'t');
    },
  },
  {
    name: 'armour: noticed: a vest under the top up close by Awareness, the distance, the top over it; a carrier by anyone; the arch rings for plates and not a vest',
    fn() {
      const rows = [];
      for (const top of ['tee', 'sweater', 'coat']) for (const aw of [3, 10, 18]) {
        const p = sheet({ id: 'b', look: { top: { kind: top } } }), me = sheet({ id: 'me', skills: { awareness: [aw, 0] } }), r = stream('vest', top, aw);
        AR.wear(p, 'light');
        const at = [1, 2, 3].map(d => { let ok = 0; for (let i = 0; i < 400; i++) { const V = AR.vestCheck(p, d); ok += check(r, { skill: 'awareness', value: aw, dc: V.dc, mods: V.mods, body: me }).ok; } return ok / 400; });
        rows.push(`${top}, Awareness ${aw}: ${at.map(pct).join(' / ')}`);
      }
      console.log(`      a soft vest seen at 1 / 2 / 3 m: ${rows.join('; ')}; past ${AR.VEST_M} m, never`);
      const far = sheet({ id: 'b', look: { top: { kind: 'tee' } } }); AR.wear(far, 'light');
      assert(AR.vestCheck(far, AR.VEST_M + 0.5) === null, 'too far off to see it');
      // (the read: a carrier's known at once; the arch)
      const g = newGame({ seed: 3, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
      start(g, null); for (let t = 0; t < 20; t++) step(g, {}, null);
      const me = playerActor(g), a = g.actors.find(o => o !== me && o.ai), q = person(g, a);
      AR.wear(q, 'heavy'); a.x = me.x + 1.2; a.z = me.z;
      const { k } = read(g, me, a);
      assert(k.armour === 'heavy', 'a carrier: your read knows it, whatever the roll');
      const vest = sheet({ id: 'v' }), plates = sheet({ id: 'p' }); AR.wear(vest, 'light'); AR.wear(plates, 'heavy');
      assert(!rings(vest).length && rings(plates).includes(PLATES), `the arch: a vest ${rings(vest).length ? 'rings' : 'doesn\'t ring'}, plates ring`);
      const c = { log: [], posting: { cover: 70 } };
      screen(g, null, plates, c);
      assert(plates.armour?.kind === 'heavy' && c.posting.cover === 70 && /plates/.test(g.log.at(-1)?.text), `the plates through the X-ray and back, no cover lost: "${g.log.at(-1)?.text}"`);
    },
  },
  {
    name: 'armour: who wears it: the armed response in carriers; a patrol\'s soft vest by its country; Beirut\'s response is soldiers',
    fn() {
      const share = (city, role) => {
        const g = { seed: 9, map: { city, row: 0 }, rng: seedRng(3) }; let n = 0, heavy = 0, light = 0;
        for (let i = 0; i < 200; i++) { const p = sheet({ id: `cop${i}`, skills: {} }); armCop(g, p, role, seedRng(i)); n++; heavy += p.armour?.kind === 'heavy'; light += p.armour?.kind === 'light'; }
        return { heavy: heavy / n, light: light / n };
      };
      const rows = ['moscow', 'london', 'beirut', 'cairo'].map(c => [c, share(c, 'patrol'), share(c, 'response')]);
      console.log(`      ${rows.map(([c, p, r]) => `${c}: patrols in a vest ${pct(p.light)}, the response in a carrier ${pct(r.heavy)}`).join('; ')}`);
      for (const [c, , r] of rows) assert(r.heavy === 1, `${c}: the armed response all in carriers`);
      const R = Object.fromEntries(rows.map(([c, p]) => [c, p.light]));
      assert(R.london > 0.85 && R.moscow < 0.35 && R.cairo < 0.2, 'London\'s patrols nearly all in vests; Moscow\'s and Cairo\'s few');
      const p = sheet({ id: 'x' }); AR.issue(p, 'response', { armour: { color: 0x8f6345 } }, 'x');
      assert(p.armour?.kind === 'heavy' && p.armour.color === 0x8f6345, 'a carrier in its country\'s colour');
      assert(policeOf({ city: 'beirut' }).response.soldiers && !policeOf({ city: 'moscow' }).response.soldiers, 'Beirut\'s armed response is the army');
      let guards = 0; for (let i = 0; i < 200; i++) { const q = sheet({ id: 'minder' }); AR.issue(q, 'bodyguard', null, `${i}|minder`); guards += q.armour?.kind === 'light'; }
      console.log(`      a bodyguard in a soft vest: ${pct(guards / 200)}`);
      assert(guards > 40 && guards < 100, 'a bodyguard\'s vest one time in three');
    },
  },
  {
    name: 'armour: the read and first aid: a hole and no blood, then "the vest stopped it: a bruise the size of a fist"; your own sheet says what you wear',
    fn() {
      const { g, me, a, p } = range0(5);
      AR.wear(p, 'light');
      g.rng = seedRng(2);
      let line = '';
      for (let k = 0; k < 40 && !(p.injuries ?? []).some(i => i.kind === 'blunt'); k++) { Object.assign(p, { body: {}, injuries: [] }); delete p.blood; a.gait = 'idle'; if (a.ai) a.ai.downUntil = 0; g.time.ms += 1000; line = bullet(g, null, a, 'torso', MODELS.glock17, { ...me, who: 'nobody' }); }
      const i = p.injuries.find(j => j.kind === 'blunt');
      assert(i && !p.injuries.some(j => j.bleed > g.time.ms), `a round stopped: no bleeding (${line})`);
      const plain = seenName(p, i, g.time.ms);
      const medic = g.people[me.who]; medic.skills.medicine = [20, 2];
      a.x = me.x + 1; a.z = me.z;
      diagnose(g, null, me, a);
      const looked = seenName(p, i, g.time.ms), f = findings(g, p, { actor: a });
      console.log(`      the words: "${line}"; plain sight: "${plain}"; a look: "${looked}"; on the card: ${f.status.map(s => `"${s.text}"`).join(', ')}`);
      assert(/no blood/.test(plain) && /vest stopped a round/.test(looked), 'plain sight a hole and no blood; the look, the vest and the bruise');
      assert(f.status.some(s => /vest/.test(s.text)), 'the look finds the vest under the shirt');
      const mine = g.people[me.who]; AR.wear(mine, 'heavy');
      const self = findings(g, mine, { actor: me, self: true });
      assert(self.status.some(s => /plate carrier/.test(s.text)), `your own sheet: ${self.status.map(s => s.text).join(' | ')}`);
    },
  },
  {
    name: 'armour: you, shot in your vest: no wound, a stagger, your aim lost; an officer\'s round on his plate: his aim lost, now and then off his feet',
    fn() {
      const { g, me, a } = range0(6), mine = g.people[me.who];
      AR.wear(mine, 'light');
      g.rng = seedRng(5);
      g.shoot = { phase: 'choose', aim: { key: a.id, settled: 0 } };
      let line = '';
      for (let k = 0; k < 40 && !(mine.injuries ?? []).some(i => i.kind === 'blunt'); k++) { Object.assign(mine, { body: {}, injuries: [] }); delete mine.blood; g.time.ms += 1000; line = bullet(g, null, me, 'torso', MODELS.makarov, a); }
      assert(/vest/.test(line) && me.skid > 0 && !g.shoot.aim && !(mine.injuries ?? []).some(i => i.gunshot), `you: "${line}" (a stagger ${me.skid} ticks, the aim ${g.shoot.aim ? 'held' : 'lost'})`);
      // (an armed officer with a carrier, aiming at you: an AK round of yours on the plate)
      const cop = g.actors.find(o => o !== me && o !== a && o.ai), q = person(g, cop);
      AR.wear(q, 'heavy'); cop.ai.gunner = { gun: 'x', until: 0, aimed: g.time.ms };
      let words = '', downs = 0, tries = 0;
      for (let k = 0; k < 300; k++) {
        Object.assign(q, { body: {}, injuries: [] }); delete q.blood; cop.gait = 'idle'; cop.ai.downUntil = 0; cop.ai.gunner.aimed = g.time.ms; cop.ai.gunner.until = 0;
        g.time.ms += 1000;
        const w = bullet(g, null, cop, 'torso', MODELS.ak74m, me);
        if (!q.injuries.some(i => i.kind === 'blunt')) continue;
        tries++; words ||= w; downs += cop.gait === 'down';
        assert(cop.ai.gunner.aimed === null && cop.ai.gunner.until > g.time.ms, 'his aim lost, a moment to find it again');
      }
      console.log(`      you: "${line}"; him: "${words}"; of ${tries} AK rounds his plates stopped, ${downs} knocked him off his feet`);
      assert(tries > 50 && downs > 0 && downs < tries / 2, 'now and then off his feet');
    },
  },
  {
    name: 'armour: the wardrobe: on and off, a vest under the top, a carrier over it and off at the door; kept in a save',
    fn() {
      const p = sheet({ id: 'me', look: { top: { kind: 'coat', color: 0x353947 } } });
      p.wardrobe = [armourPiece({ kind: 'heavy', hits: {} }), armourPiece({ kind: 'light', hits: {} })];
      const ways = wardrobeWays(p).map(w => w.label);
      const on = dress(p, wardrobeWays(p).find(w => /plate carrier/.test(w.label)).key);
      assert(p.armour?.kind === 'heavy' && /over/.test(on), `on: ${on}`);
      const swap = dress(p, wardrobeWays(p).find(w => /soft vest/.test(w.label)).key);
      assert(p.armour?.kind === 'light' && p.wardrobe.some(x => x.armour?.kind === 'heavy'), `swapped: ${swap}`);
      const off = dress(p, 'off:armour');
      assert(!p.armour && p.wardrobe.filter(x => x.slot === 'armour').length === 2, `off: ${off}`);
      dress(p, wardrobeWays(p).find(w => /plate carrier/.test(w.label)).key);
      const door = comeIn(p);
      assert(!p.armour && /plate carrier off/.test(door), `at the door: ${door}`);
      console.log(`      the wardrobe: ${ways.join('; ')}; "${on}" "${swap}" "${off}"; the door: "${door}"`);
      const g = newGame({ seed: 2, scenario: 'walk', city: 'moscow', hour: 12, weather: 'clear' });
      start(g, null);
      AR.wear(g.people[g.player], 'light'); g.people[g.player].armour.hits.soft = 2;
      const back = fromJSON(toJSON(g));
      assert(back.people[back.player].armour?.kind === 'light' && back.people[back.player].armour.hits.soft === 2, 'a vest, and the rounds it stopped, kept in a save');
    },
  },
  {
    name: 'armour: drawn: a plate carrier over the top in every view, a soft vest not at all',
    fn() {
      const look = { skin: 'light', hair: { style: 'crew', color: 0x23252f }, top: { kind: 'uniform', color: 0x4c5262, trim: 0x9e3c36 }, legs: 0x353947, shoes: 0x14151c };
      const differ = (x, y) => x.reduce((n, row, j) => n + row.filter((c, i) => c !== y[j][i]).length, 0);
      const counts = {};
      for (const dir of ['down', 'up', 'right', 'left']) for (const f of ['idle0', 'walk1', 'run0', 'aim', 'guard']) {
        const d = differ(frame(look, dir, f), frame({ ...look, armour: { color: 0x545e40, patch: true } }, dir, f));
        counts[`${dir} ${f}`] = d;
        assert(d >= 12, `${dir} ${f}: the carrier changes the torso (${d} pixels)`);
      }
      const soft = sheet({ id: 'v' }), heavy = sheet({ id: 'h' }); AR.wear(soft, 'light'); AR.wear(heavy, 'heavy', { color: 0x545e40, patch: true });
      assert(AR.pictureOf(soft) === null && AR.pictureOf(heavy)?.color === 0x545e40 && AR.pictureOf(heavy).patch, 'the picture: a carrier, never a vest under the top');
      const fig = doll({ look }), carried = doll({ look, armour: AR.pictureOf(heavy) });
      const dd = differ(fig, carried);
      assert(dd > 300, `the close figure: the carrier over the uniform (${dd} pixels)`);
      console.log(`      sprite pixels changed by the carrier: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}; the close figure ${dd}`);
    },
  },
  {
    name: 'armour: a helmet on the head: of head hits from a Makarov, a Glock, an AK-74M and an SVD at 10 m, what\'s turned (no wound, no death), against no helmet; Moscow\'s response in helmets',
    fn() {
      const out = [];
      for (const model of ['makarov', 'glock17', 'ak74m', 'svd']) {
        const row = [];
        for (const helmet of [false, true]) {
          const { g, a, p } = range0(), M = MODELS[model];
          g.rng = seedRng(23);
          let turned = 0, dead = 0;
          const n = 400;
          for (let k = 0; k < n; k++) {
            Object.assign(p, { body: {}, injuries: [] }); delete p.dead; delete p.blood; delete p.helmet;
            if (helmet) AR.wearHelmet(p);
            a.gait = 'idle'; if (a.ai) a.ai.downUntil = 0;
            g.time.ms += 1000;
            bullet(g, null, a, 'head', M, { x: a.x - 10, z: a.z, who: 'nobody' });
            if (p.dead) dead++; else if (!(p.injuries ?? []).some(i => i.gunshot)) turned++;
          }
          row.push({ turned: turned / n, dead: dead / n });
        }
        out.push(`${model}: turned ${pct(row[1].turned)} (dead ${pct(row[0].dead)} → ${pct(row[1].dead)})`);
        const handgun = model === 'makarov' || model === 'glock17';
        assert(row[0].turned === 0 && (handgun ? row[1].turned > 0.45 && row[1].dead < row[0].dead * 0.6 : row[1].turned < 0.12), `${model}: ${JSON.stringify(row)}`);
      }
      const { g } = range0(), cop = sheet({ id: 'u1', name: 'an armed officer', look: { top: { kind: 'uniform', color: 0x23252f } } });
      armCop(g, cop, 'response');
      assert(cop.helmet && cop.look.hat?.kind === 'helmet' && cop.armour?.kind === 'heavy', `Moscow's response: helmet ${!!cop.helmet}, hat ${cop.look.hat?.kind}, ${cop.armour?.kind}`);
      console.log(`      head hits at 10 m: ${out.join('; ')}; Moscow's response in a helmet and a carrier`);
    },
  },
];
