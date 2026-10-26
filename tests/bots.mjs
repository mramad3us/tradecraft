// Scripted followers for mechanic test 1 (tailing), shared by the balance tests and by playtests in
// the browser (the dev server serves this file: import('/tests/bots.mjs') from the page). Each takes
// (state, the player's actor, the target's actor) and gives the tick's input. They read the true
// target (they cheat where a player would look about), but they keep to the street: no walking
// through railings (route()), and they look where they mean to look.
//   naive    10 m behind him, his pavement;
//   careful  the other pavement 20 m back, closer when he's out of sight, after him up a lane, eyes
//            on the bench at the meeting;
//   trained  careful, and does what the instinct offers when it warns of a check (T), and strolls
//            when told it's gaining.
import { sectionAt } from '../src/sim/world.js';

// Toward (x, z), stopping within slack; a bot that hasn't moved for a few ticks against something
// (a lamp post, a parked car) sidesteps a while, as anyone would.
const stuck = new WeakMap();
export const toward = (me, x, z, slack, extra = {}) => {
  const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
  if (d <= slack) { stuck.delete(me); return { ...extra }; }
  const k = stuck.get(me) ?? { x: me.x, z: me.z, n: 0, side: 0, flip: -1 };   // (the first sidestep toward the target)
  k.n = Math.hypot(me.x - k.x, me.z - k.z) < 0.01 ? k.n + 1 : 0; k.x = me.x; k.z = me.z;
  if (k.n > 3) { k.side = 12; k.flip = -k.flip; k.n = 0; }      // (stuck again: the other way this time)
  stuck.set(me, k);
  let mx = dx / d, mz = Math.abs(dz) > 0.3 ? dz / d : 0;
  if (k.side > 0) {                                                  // along the other axis, toward the target on it
    k.side--;
    if (Math.abs(dx) >= Math.abs(dz)) [mx, mz] = [Math.sign(dx) * 0.3, (Math.sign(dz) || 1) * k.flip];
    else [mx, mz] = [(Math.sign(dx) || 1) * k.flip, Math.sign(dz) * 0.3];
  }
  return { mx, mz, ...extra };
};
// A bot's way somewhere: straight, unless a railing's in the way (the boulevard's, either side), then
// through the nearest gap in it (a zebra's line, a park path).
export function route(g, me, x, z, slack = 1) {
  const S = sectionAt(g, me.x);
  const zone = (v) => (v < 10 ? 0 : S?.band === 'park' ? (v < 26 ? 1 : 2) : v < 19.4 ? 1 : 2);
  const a = zone(me.z), b = zone(z);
  if (!S || a === b) return toward(me, x, z, slack);
  const gaps = (a + b === 1 ? S.crossings : S.crossingsS).map(c => (c.x0 + c.x1) / 2).sort((p, q) => Math.abs(p - me.x) - Math.abs(q - me.x));
  const cx = gaps[0];
  if (cx === undefined) return toward(me, x, z, slack);
  if (Math.abs(me.x - cx) > 0.5) return toward(me, cx, me.z, 0.2);
  return toward(me, cx, z, 0.2);
}
export const naive = (g, me, t) => (t.offmap ? toward(me, t.x, -60, 0) : Math.hypot(t.x - me.x, t.z - me.z) > 10 ? toward(me, t.x, t.z, 0) : {});
export const careful = (g, me, t) => {
  const sc = g.scenario, meeting = sc.phase === 'meet' || (t.z > 11 && t.z < 17), have = sc.marked === sc.target && sc.unseenS < 3;
  if (t.offmap) return toward(me, t.x, -60, 0.5);                          // up the lane after him
  if (t.z < -5) return toward(me, t.x, Math.min(-3, t.z + 14), 1);           // he's in a lane: give him the corner, then follow
  if (me.z < -5) return toward(me, me.x, -3, 0.5);                           // (out of a lane we went up for nothing)
  if (t.z > 25) return route(g, me, t.x - (have ? 18 : 8), 27.7);            // the far pavement south of the boulevard
  const south = me.z > 10.2;                                                  // (come at the boulevard from the far pavement)
  const want = meeting && south ? route(g, me, t.x - 10, 14.6) : route(g, me, t.x - (have ? (meeting ? 8 : 20) : 8), meeting || t.z < -0.5 ? 8.6 : -2.6);
  if (!want.mx && meeting) { const d = Math.hypot(t.x - me.x, t.z - me.z) || 1; return { look: true, mx: (t.x - me.x) / d, mz: (t.z - me.z) / d }; }   // stood: eyes on the bench
  return want;
};
// Trained: careful, and when the instinct warns of a check, it does what it offers (T); it strolls
// when told it's gaining, and stays put while busy at its cover.
export const trained = (g, me, t) => {
  const sc = g.scenario, p = sc.prompt;
  if (me.busy && me.busy.what !== 'cross') return sc.tell || sc.scan ? {} : (Math.hypot(t.x - me.x, t.z - me.z) > 26 ? careful(g, me, t) : {});
  if (p?.act && p.tone === 'urgent' && p.act !== 'cross' && Math.hypot(t.x - me.x, t.z - me.z) < 30) return { act: ['instinct'] };
  const c = careful(g, me, t);
  if (p?.id === 'gaining') c.slow = true;
  return c;
};
