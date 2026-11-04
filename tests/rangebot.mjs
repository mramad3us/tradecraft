// A scripted shooter at the range (sim/scenarios/range.js), for the tests: the desk, the lane, the bench, and the gun's
// whole work through the engine's own steps (sim/shooting.js options(), choose()), as a careful player does it: checked
// clear, the magazines filled, one in, the slide racked, the safety off on the paper; five at each distance in turn, a
// reload after the first, a stoppage cleared as it comes; empty, the bench again; then unloaded, holstered, back at the
// desk. No time for thought: it chooses at once (time stands still while a player would think).
import { step, playerActor } from '../src/sim/game.js';
import { options } from '../src/sim/shooting.js';
import { armOf, sparesFor } from '../src/sim/firearms.js';
import { groupAt, gunOf, LANE } from '../src/sim/scenarios/range.js';
import { DISTANCES_M } from '../src/sim/interiors/range.js';

/** The picture's frame round the whole range (the page gives it in play: sim/shooting.js targets()). */
export const frameOf = (g) => { const p = g.$world.sections.get(0).plan; return { x0: p.x0 - 2, x1: p.x1 + 2, z0: p.z0 - 3, z1: p.z1 + 3 }; };

/**
 * Play the range to its end (or maxS game seconds): returns { log, steps: the shooting steps taken, said: Hale's lines }.
 * opts: { order: the distances, skip: steps to leave out ('check', 'unload'), turn: a heading to turn to once loaded
 * (a muzzle swept, for the safety test), stray: a lane's paper to fire at instead, think: ticks of a player's
 * thought after each step (time standing still: Hale's lines read in it, sim/tutorial/earpiece.js tutorWait()) }.
 */
export function shootRange(g, bus, { order = DISTANCES_M, skip = [], turn = null, stray = null, think = 0, maxS = 1800 } = {}) {
  const me = playerActor(g), frame = frameOf(g), out = { steps: [], said: [], log: [] };
  bus?.on('log', (e) => { out.log.push(e); if (e.kind === 'radio') out.said.push(e.text); });
  let table = null;
  bus?.on('bench', (l) => { table = l; });
  const t0 = g.time.ms, over = () => !!g.scenario.outcome || g.time.ms - t0 > maxS * 1000;
  const S = (n = 1, input = {}) => { for (let i = 0; i < n && !over(); i++) step(g, { frame, ...input }, bus); };
  const walkOver = () => { for (let i = 0; i < 2000 && !over() && (me.busy || g.scenario.using); i++) S(1); };
  const T = () => { S(1, { act: ['instinct'] }); walkOver(); S(2); };
  const opt = (k) => options(g).find(o => o.key === k && !o.off);
  const take = (key) => { out.steps.push(key); S(1, { act: [`shoot:${key}`] }); for (let n = 0; n < 2000 && !over() && g.shoot?.phase === 'act'; n++) S(1); if (g.shoot?.phase === 'choose') S(think); };
  const into = () => { if (!g.shoot && !over()) S(1, { act: ['aim'] }); };
  const outOf = () => { if (g.shoot?.phase === 'choose') S(1, { act: ['aim'] }); };
  const G = () => gunOf(g), p = g.people[g.player];
  const benchWork = (kinds) => {
    outOf(); table = null; T();
    for (let k = 0; k < 6 && !over() && table; k++) { const w = table.find(x => kinds.some(j => x.key.startsWith(j))); if (!w) break; table = null; S(1, { act: [`desk:table:${w.key}`] }); const me = g.actors.find(x => x.who === g.player); for (let n = 0; n < 20 * 200 && me?.busy && !over(); n++) S(1); }   // (the rounds in a round at a time, lived at the bench: sim/scenarios/range.js)
  };
  const paper = (m) => g.actors.find(a => { const P = g.people[a.who]?.paper; return P && P.lane === LANE && P.m === m; });
  // (the gun ready to fire at a paper: a stoppage cleared, a magazine in, a round up, the safety off)
  const ready = () => {
    for (let k = 0; k < 12 && !over(); k++) {
      if (!G()?.g) { outOf(); S(80); into(); if (!G()?.g) return false; }   // (dropped: it's picked up for you, back where you carry it)
      if (p.hand !== G().id && opt('draw')) { take('draw'); if (opt('check')) take('check'); continue; }
      const g0 = G().g, M = G().M;
      if (opt('clear')) { take('clear'); continue; }
      if ((g0.chamber === 'dud' || g0.chamber === 'case') && opt('rack')) { take('rack'); continue; }
      if (!g0.chamber && g0.mag && (armOf(p, g0.mag)?.n ?? 0) > 0) { take(opt('release') ? 'release' : 'rack'); continue; }
      if (!g0.chamber && !g0.mag) { if (sparesFor(p, g0.model).some(id => armOf(p, id).n > 0)) { take('insertMag'); continue; } benchWork(['fill']); into(); continue; }
      if (!g0.chamber && g0.mag) { take('stowMag'); continue; }   // (empty in it: out, into a pocket, and another)
      if (M.safety === 'manual' && g0.safety && opt('safety')) { take('safety'); continue; }
      return true;
    }
    return false;
  };
  const shootAt = (m, n) => {
    const a = paper(m);
    for (let k = 0; k < n * 4 && !over() && (groupAt(g, m)?.shots ?? 0) < n; k++) {
      if (!ready()) return;
      if (over()) return;
      if (g.shoot?.aim?.key !== a.id) take(`aim:${a.id}`);
      if (opt('fire')) take('fire');
    }
  };
  // The desk, the lane, the gun out and looked at, the bench, one in.
  S(2); T(); T();
  into(); take('draw');
  if (!skip.includes('check') && opt('check')) take('check');
  benchWork(['fill']);
  into(); take('insertMag'); take(opt('release') ? 'release' : 'rack');
  if (turn !== null) { outOf(); for (let i = 0; i < 60 && !over(); i++) S(1, { look: true, mx: Math.cos(turn), mz: Math.sin(turn) }); return out; }
  if (stray) { into(); const a = g.actors.find(x => x.who === stray); ready(); take(`aim:${a.id}`); take('fire'); S(20); return out; }
  for (const [i, m] of order.entries()) {
    shootAt(m, 5);
    if (i === 0 && !over()) {                                     // (a reload, the other magazine in, before it runs dry)
      if (!G()?.g) S(80);                                            // (dropped: picked up for you)
      if (G()?.g?.mag && opt('stowMag')) take('stowMag');
      if (opt('insertMag')) take('insertMag');
      if (G()?.g && !G().g.chamber) ready();
    }
  }
  if (over()) return out;
  // Unloaded and shown clear, holstered, back to the desk.
  if (!skip.includes('unload')) {
    for (let k = 0; k < 6 && !over(); k++) { const g0 = G().g; if (g0.mag && opt('stowMag')) take('stowMag'); else if (g0.chamber && opt('rack')) take('rack'); else if (g0.jam && opt('clear')) take('clear'); else break; }
    S(30);
  }
  into(); if (opt('holster')) take('holster');
  S(10);
  T();
  for (let i = 0; i < 40; i++) step(g, { frame }, bus);             // (his last words, and the checklist's last tick)
  return out;
}
