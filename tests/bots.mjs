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

// ---------- test 2, being tailed: players walking to a meeting ----------
//   oblivious  straight there, sits down;
//   checker    straight there, checking its back on the way (shop windows, a glance now and
//              then), and calls it off when the instinct says it's followed;
//   pro        a checker that, with a face marked, takes a lane where nobody it's marked can see
//              it go, watches the lane's mouth from the other end, and only then goes on.
import { waypoint } from '../src/sim/nav.js';
import { Z } from '../src/sim/map/street.js';
import { inView } from '../src/sim/perception.js';

/** The way to (row, x, z) across the city: lanes north or south first, then the spot. */
export function goTo(g, me, row, x, z) {
  if (g.map.row !== row) {
    const north = row < g.map.row;
    const gaps = [...g.$world.sections.values()].flatMap(S => (north ? S.gapsN : S.gapsS))
      .map(gp => ({ gp, c: (gp.x0 + gp.x1) / 2 })).filter(o => (o.c - me.x) * Math.sign(x - me.x || 1) > -6)
      .sort((p, q) => Math.abs(p.c - me.x) - Math.abs(q.c - me.x));
    const gp = gaps[0]?.gp;
    if (!gp) return toward(me, me.x + Math.sign(x - me.x || 1) * 20, -2.6, 0.5);
    const cx = Math.max(gp.x0 + 0.8, Math.min(gp.x1 - 0.8, (gp.x0 + gp.x1) / 2));
    const [wx, wz] = waypoint(g, me, cx, north ? Z.north - 3 : Z.edge + 3);
    return toward(me, wx, wz, 0.15);
  }
  const [wx, wz] = waypoint(g, me, x, z);
  return toward(me, wx, wz, Math.hypot(wx - x, wz - z) < 0.01 ? 0.6 : 0.15);
}

const memo = new WeakMap();
export const oblivious = (g, me) => {
  const sc = g.scenario, m = sc.meet;
  if (me.busy || sc.phase === 'meet') return {};
  if (sc.prompt?.act === 'meet') return { act: ['instinct'] };
  if (g.time.ms < m.from - 20000 && g.map.row === m.row && Math.abs(me.x - m.x) < 25) return {};   // (early: wait about)
  return goTo(g, me, m.row, m.seat2, 13.5);
};
export const checker = (g, me) => {
  const sc = g.scenario, m = sc.meet, p = sc.prompt;
  const k = memo.get(me) ?? { glance: g.time.ms + 20000, window: 0 };
  memo.set(me, k);
  if (me.busy || sc.phase === 'meet') return {};
  if (p?.act === 'abort') return { act: ['instinct'] };
  if (p?.act === 'meet') return { act: ['instinct'] };
  if (p?.act === 'window' && g.time.ms > k.window) { k.window = g.time.ms + 45000; return { act: ['instinct'] }; }
  if (g.time.ms > k.glance) { k.glance = g.time.ms + 25000; return { ...goTo(g, me, m.row, m.seat2, 13.5), act: ['glance'] }; }
  if (g.time.ms < m.from - 20000 && g.map.row === m.row && Math.abs(me.x - m.x) < 25) return {};
  return goTo(g, me, m.row, m.seat2, 13.5);
};
export const pro = (g, me) => {
  const sc = g.scenario, m = sc.meet;
  const k = memo.get(me) ?? { glance: g.time.ms + 20000, window: 0, shake: null, shook: 0 };
  memo.set(me, k);
  if (sc.sinceMap && g.time.ms - sc.sinceMap < 12000) return {};          // out of a lane: watch its mouth
  if (k.shake !== null) {                                                    // shaking them: off up a lane
    if (g.map.row !== k.shake) return goTo(g, me, k.shake, me.x + 8, -2.6);
    k.shake = null;
  }
  const marked = Object.entries(sc.suspects ?? {}).filter(([, v]) => v >= 1).map(([id]) => g.actors.find(a => a.id === id)).filter(Boolean);
  const watched = marked.some(a => inView(g, a.id) && Math.hypot(a.x - me.x, a.z - me.z) < 30);
  if (marked.length && !watched && k.shook < 2 && !me.busy && sc.prompt?.act !== 'meet') { k.shook++; k.shake = g.map.row - 1; return goTo(g, me, k.shake, me.x + 8, -2.6); }
  return checker(g, me);
};
