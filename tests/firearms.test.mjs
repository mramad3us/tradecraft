// Firearms, the guns themselves (sim/firearms.js): every part's state through its actions (the safety, a
// magazine in and out, a round chambered with none, the slide locked back on the last, a dud, a stovepipe,
// a double feed and its drill, a worn gun that won't fire), each action's time and roll by Weapon handling,
// what goes wrong by condition, and a gun's state kept by its id wherever it goes.
import { MODELS, KINDS, FAMILIES, ACTIONS, newGun, newMag, armOf, moveArm, act, fire, canDo, said, service, fillMag, pace, misfire, jamChance, BROKEN, isGun, isLong, sparesFor, ready } from '../src/sim/firearms.js';
import { sizeOf, weaponOf } from '../src/sim/weapons.js';
import { armName, boxWord } from '../src/sim/firearms.js';
import { wardrobeWays, dress } from '../src/sim/clothes.js';
import { placed, fits } from '../src/sim/items.js';
import { sheet } from '../src/sim/people.js';
import { skill } from '../src/sim/skills.js';
import { stream } from '../src/sim/rng.js';
import { assert, fmt } from './helpers.mjs';

const hand = (base, os = 38) => sheet({ id: 'me', cls: 'spook', os, skills: { weapons: [base, 1] } });
// (a sure hand, for the parts' states: every roll made)
const sure = () => hand(20, 95);

export default [
  {
    name: 'firearms: a Makarov\'s parts through their actions: the safety, the magazine out and in, the chamber, the slide locked back on the last round',
    fn() {
      const rng = stream('fa', 1), p = sure(), id = newGun(p, 'makarov');
      const g = armOf(p, id);
      assert(isGun(id) && g.chamber === 'live' && armOf(p, g.mag).n === 8 && g.safety, `new: ${said(p, id)}`);
      assert(fire(rng, p, id).why === 'safety', 'safety on: the trigger does nothing');
      act(rng, p, id, 'safety');
      let shots = 0, last;
      for (let i = 0; i < 12; i++) { last = fire(rng, p, id); if (!last.fired) break; shots++; }
      assert(shots === 9 && g.locked && !g.chamber && last.why === 'empty', `one in the chamber and eight: ${shots} shots, then the slide locked back (${said(p, id)})`);
      const spare = newMag(p, 'makarov', 8);
      p.items = [spare];
      assert(canDo(p, id).includes('dropMag'), 'an empty magazine in: it can come out');
      const out = act(rng, p, id, 'dropMag');
      assert(!g.mag && out.mag, 'out');
      assert(canDo(p, id).includes('insertMag'), 'a spare to put in');
      act(rng, p, id, 'insertMag', { mag: spare });
      assert(g.mag === spare && canDo(p, id).includes('release'), 'in, and the slide to release');
      act(rng, p, id, 'release');
      assert(g.chamber === 'live' && armOf(p, spare).n === 7 && !g.locked, `released: ${said(p, id)}`);
      // (a round chambered and no magazine: one shot)
      act(rng, p, id, 'dropMag');
      assert(fire(rng, p, id).fired && fire(rng, p, id).why === 'empty', 'a round in the chamber, no magazine: one shot, then nothing');
      p.rounds = { '9x18': 3 };
      assert(canDo(p, id).includes('chamber1'), 'a loose round, and a round can go in by hand');
      act(rng, p, id, 'chamber1');
      assert(g.chamber === 'live' && p.rounds['9x18'] === 2, 'one in by hand');
      const m2 = newMag(p, 'makarov', 0);
      assert(fillMag(p, m2) === 2 && armOf(p, m2).n === 2, 'the loose rounds into a magazine');
      console.log(`      ${said(p, id)}`);
    },
  },
  {
    name: 'firearms: stoppages: a dud and a stovepipe cleared by racking, a double feed only by the drill; worn past BROKEN it won\'t fire till serviced',
    fn() {
      const rng = stream('fa', 2), p = sure(), id = newGun(p, 'glock17'), g = armOf(p, id);
      assert(!canDo(p, id).includes('safety') && fire(rng, p, id).fired, 'a Glock: no safety to work, it fires');
      g.chamber = 'dud';
      assert(fire(rng, p, id).why === 'jammed' && canDo(p, id).includes('rack'), 'a dud in the chamber: click; rack it');
      const r = act(rng, p, id, 'rack');
      assert(g.chamber === 'live' && r.ejected === 'round', `tap, rack: ${r.text}`);
      g.chamber = 'case';
      act(rng, p, id, 'rack');
      assert(g.chamber === 'live', 'a stovepipe racked clear');
      g.jam = 'double'; g.chamber = null;
      assert(canDo(p, id)[0] === 'clear' && fire(rng, p, id).why === 'jammed', 'a double feed: the drill first');
      act(rng, p, id, 'rack');
      assert(g.jam === 'double', 'racking doesn\'t clear a double feed');
      const c = act(rng, p, id, 'clear');
      assert(!g.jam && g.chamber === 'live', `the drill: ${c.text}`);
      g.cond = BROKEN - 0.01;
      assert(fire(rng, p, id).why === 'broken', 'worn out: it won\'t fire');
      service(p, id);
      assert(g.cond >= 0.95 && fire(rng, p, id).fired, 'serviced: it fires');
    },
  },
  {
    name: 'firearms: every action is a roll of Weapon handling: its time by the skill, a fumble costing time, a mishap only in a poor hand',
    fn() {
      const rng = stream('fa', 3), rows = [];
      for (const [who, base, os] of [['untrained', 0, 0], ['a Handler', 5, 38], ['an expert', 15, 60], ['a master', 20, 95]]) {
        const p = hand(base, os), n = 400;
        let ms = 0, fails = 0, mishaps = 0;
        for (let i = 0; i < n; i++) { const id = newGun(p, 'makarov'), r = act(rng, p, id, 'draw', { from: 'belt' }); ms += r.ms; if (!r.ok) fails++; if (r.mishap) mishaps++; }
        rows.push({ who, v: skill(p, 'weapons'), s: ms / n / 1000, fails: fails / n, mishaps: mishaps / n });
      }
      for (let i = 1; i < rows.length; i++) assert(rows[i].s < rows[i - 1].s, `${rows[i].who} draws faster than ${rows[i - 1].who}`);
      assert(rows[0].mishaps > 0.02 && rows[2].mishaps === 0 && rows[3].mishaps === 0, `mishaps: the untrained ${fmt(rows[0].mishaps * 100, 0)}%, experts and masters none`);
      assert(rows[3].s < 0.7 && rows[0].s > 1.6, 'a master under 0.7 s from the belt, the untrained over 1.6 s');
      console.log(`      from the beltline: ${rows.map(r => `${r.who} (${r.v}) ${fmt(r.s, 2)} s, fumbled ${fmt(r.fails * 100, 0)}%, a mishap ${fmt(r.mishaps * 100, 0)}%`).join('; ')}`);
      // (a mishap with a round chambered and the safety off is a shot)
      const p = hand(0, 0), id = newGun(p, 'glock17');
      let shot = 0;
      for (let i = 0; i < 400; i++) { const g = armOf(p, id); g.chamber = 'live'; g.jam = null; const r = act(rng, p, id, 'holster'); if (r.mishap === 'discharge') shot++; }
      assert(shot > 0, `an untrained hand putting away a Glock with one in the chamber: it went off ${shot} times in 400`);
    },
  },
  {
    name: 'firearms: what goes wrong by condition (misfires, stoppages), and a gun keeps its state by its id: carried, in a pocket, on the ground',
    fn() {
      const rng = stream('fa', 4), rows = [];
      for (const cond of [0.95, 0.6, 0.35]) {
        let pulls = 0, shots = 0, duds = 0, stops = 0;
        const p = hand(5, 38);
        for (let k = 0; k < 400; k++) {
          const id = newGun(p, 'makarov', { safety: false, cond });
          for (let t = 0; t < 9; t++) { const r = fire(rng, p, id); pulls++; if (r.fired) shots++; if (r.why === 'dud') duds++; if (r.stoppage) stops++; if (!r.fired || r.stoppage) break; }
        }
        rows.push({ cond, dud: duds / pulls, stop: stops / shots });
      }
      assert(rows[0].dud < 0.01 && rows[0].stop < 0.01 && rows[2].dud > rows[0].dud * 3 && rows[2].stop > rows[0].stop * 5, 'a worn gun misfires and jams far more');
      console.log(`      ${rows.map(r => `condition ${r.cond}: a dud ${fmt(r.dud * 100, 1)}% of pulls, a stoppage ${fmt(r.stop * 100, 1)}% of shots`).join('; ')}`);
      // (carried as anything is: a Makarov fits a coat pocket or the beltline; dropped, the same gun)
      const p = sheet({ id: 'me', persistent: true, look: { top: { kind: 'coat' } } }), id = newGun(p, 'makarov');
      p.items = [id];
      const at = placed(p).out.find(o => o.kind === id);
      assert(at && sizeOf(id)[0] === 16 && weaponOf(id)?.gun === 'makarov', `in ${at?.space}: ${weaponOf(id).name}`);
      const before = JSON.stringify(armOf(p, id));
      const it = { id: 'd1', kind: id }, other = sheet({ id: 'fsb0' });
      moveArm(p, it, id); moveArm(it, other, id);
      assert(JSON.stringify(armOf(other, id)) === before && !armOf(p, id) && armOf(other, armOf(other, id).mag), 'dropped and picked up by someone else: the same gun, its magazine with it');
      assert(fits(p, newMag(p, 'makarov', 8)), 'a spare magazine fits too');
    },
  },
  {
    name: 'firearms: the arsenal: every model whole (handguns, revolvers, submachine guns, carbines, rifles, a marksman\'s, shotguns), loaded new, and it fires',
    fn() {
      const kinds = {}, rng = stream('fa', 5);
      for (const [model, M] of Object.entries(MODELS)) {
        assert(M.name && M.short && M.cal && M.cap > 0 && M.size?.length === 2 && KINDS[M.kind], `${model}: whole`);
        if (M.safety === 'selector') assert(M.modes?.length, `${model}: a selector has modes`);
        const p = sure(), id = newGun(p, model, { safety: false });
        assert(ready(armOf(p, id), M), `${model}: loaded new, ready (${said(p, id)})`);
        assert(fire(rng, p, id).fired, `${model}: fires`);
        (kinds[M.kind] ??= []).push(M.short);
      }
      assert(Object.keys(kinds).length === Object.keys(KINDS).length && Object.keys(MODELS).length >= 40, 'every kind, and many of them');
      console.log(`      ${Object.keys(MODELS).length} models: ${Object.entries(kinds).map(([k, v]) => `${v.length} ${k}`).join(', ')}`);
    },
  },
  {
    name: 'firearms: a revolver turns to the next chamber, a dud just clicks on; opened, emptied, loaded a round at a time, shut',
    fn() {
      const rng = stream('fa', 6), p = sure(), id = newGun(p, 'model10'), g = armOf(p, id);
      let shots = 0;
      for (let i = 0; i < 8; i++) if (fire(rng, p, id).fired) shots++;
      assert(shots === 6 && fire(rng, p, id).why === 'empty', `six, then clicks: ${said(p, id)}`);
      p.rounds = { '.38': 4 };
      assert(canDo(p, id)[0] === 'openCyl', 'it opens');
      act(rng, p, id, 'openCyl'); act(rng, p, id, 'eject');
      for (let i = 0; i < 4; i++) act(rng, p, id, 'load1');
      assert(fire(rng, p, id).why === 'open', 'open: it won\'t fire');
      act(rng, p, id, 'closeCyl');
      let n = 0; for (let i = 0; i < 6; i++) if (fire(rng, p, id).fired) n++;
      assert(n === 4 && p.rounds['.38'] === 0, `four loaded, four fired (${said(p, id)})`);
    },
  },
  {
    name: 'firearms: a pump leaves its case till it\'s worked; an AK on its selector, safe, auto, semi; magazines fit their family',
    fn() {
      const rng = stream('fa', 7), p = sure(), sg = newGun(p, 'rem870', { safety: false }), g = armOf(p, sg);
      assert(fire(rng, p, sg).fired && g.chamber === 'case' && fire(rng, p, sg).why === 'case', 'a pump: the case stays in till it\'s worked');
      act(rng, p, sg, 'rack');
      assert(g.chamber === 'live' && g.tube === 3, `pumped: ${said(p, sg)}`);
      const ak = newGun(p, 'ak74m'), a = armOf(p, ak);
      assert(a.mode === 'safe' && fire(rng, p, ak).why === 'safety', 'an AK on safe');
      act(rng, p, ak, 'selector');
      assert(a.mode === 'auto', 'the lever\'s first stop is auto, as an AK\'s is');
      act(rng, p, ak, 'selector');
      assert(a.mode === 'semi', 'then semi');
      const spare = newMag(p, 'ak74m', 30);
      p.items = [spare];
      assert(sparesFor(p, 'aks74u')[0] === spare && sparesFor(p, 'm4').length === 0, 'an AK-74 magazine fits an AKS-74U, not an M4');
      for (let i = 0; i < 40 && fire(rng, p, ak).fired; i++);
      assert(!a.locked && !a.chamber, 'an AK doesn\'t lock back on the last round');
    },
  },
  {
    name: 'firearms: long guns go on a sling, and show; a pistol in its holster under a coat doesn\'t',
    fn() {
      const p = sheet({ id: 'me', persistent: true, look: { top: { kind: 'coat' } } });
      const ak = newGun(p, 'ak74m'), pistol = newGun(p, 'glock17');
      p.items = [ak, pistol];
      const P = placed(p).out, a = P.find(o => o.kind === ak), g = P.find(o => o.kind === pistol);
      assert(isLong(ak) && a.at === 'sling' && a.shows, `the AK slung, and seen: ${a.at}`);
      assert(g.at === 'belt' && !g.shows, `the Glock at the belt, under the coat: ${g.at}`);
      const two = newGun(p, 'mp5');
      assert(!fits(p, two), 'one sling: a second long gun has nowhere to go but the hand');
    },
  },
  {
    name: 'firearms: rounds by their calibre: a box of each, named; dropped, picked up, left in the drawer and taken again',
    fn() {
      const p = sheet({ id: 'me', persistent: true, look: { top: { kind: 'coat' } } });
      p.rounds = { '9x19': 20, '.38': 12 };
      assert(armName('box-9x19') === 'a box of 9×19 mm Parabellum' && boxWord('.38', 12) === 'a box of .38 Special (12)', 'named by the calibre');
      const boxes = placed(p).out.filter(o => o.kind === 'rounds');
      assert(boxes.length === 2 && boxes.every(o => o.at), `a box of each, in a pocket (${boxes.map(o => `${o.cal} ${o.n} in ${o.at}`).join(', ')})`);
      const way = wardrobeWays(p).find(w => w.key === 'leave:box-9x19');
      assert(way && /9×19/.test(way.label), `the drawer: ${way?.label}`);
      dress(p, 'leave:box-9x19');
      assert(!p.rounds['9x19'] && p.stashN['box-9x19'] === 20, 'in the drawer, counted');
      dress(p, `take:${p.stash.indexOf('box-9x19')}`);
      assert(p.rounds['9x19'] === 20, 'and out again');
      assert(armName(newMag(p, 'p229', 13)) === 'a SIG P229 magazine, 9×19 mm Parabellum', 'a magazine: its gun and its calibre');
    },
  },
];
