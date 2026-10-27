// TRADECRAFT sim: the instinct, the engine's way of choosing what it says (DESIGN.md, the instinct; the
// user, 2026-10-26: "we need a serious instinct overhaul, it is mostly useless, giving advice that
// doesn't even apply to some situations").
//
// A scene's instinct is a list of rules, written as a generator that yields every line that applies
// now, the most pressing first ({ id, tone, text, act }; tone calm < note < warn < urgent: RANK).
// settle() picks the one shown: the line already up stays while its rule still fires and nothing
// more pressing does (no flicker between two that both apply); a line whose rule has stopped firing
// goes at once (no advice that no longer applies). A scene stops yielding where what follows would make
// no sense (lost him: nothing about the gap).
//
// place() says where someone is, the way the instinct speaks of it, so that a rule written for the
// street doesn't fire in a lane: 'shops' (the pavement along the shops), 'road', 'near' (the near
// pavement), 'boulevard', 'park', 'far-road', 'far' (the far pavement), 'strip' (behind the hedge),
// 'lane' (a side street or an alley, which: lane), 'court' (a court or a square off the street, in a
// city that has them), 'hall' (a room), or null off the map.
import { Z, inLane } from './map/street.js';
import { sectionAt } from './world.js';

export const RANK = { calm: 0, note: 1, warn: 2, urgent: 3 };

/** The line to show: prev kept while it still fires and nothing more pressing does; else the first that fires. lines: in order, most pressing first. */
export function settle(prev, lines, now) {
  const fired = lines.filter(Boolean);
  if (!fired.length) return null;
  const top = fired.reduce((b, l) => (RANK[l.tone] > RANK[b.tone] ? l : b), fired[0]);
  const still = prev && fired.find(l => l.id === prev.id);
  if (still && RANK[still.tone] >= RANK[top.tone]) return { ...still, ms: prev.ms };
  return { ...top, ms: now };
}

/** Where actor a is, as the instinct speaks of it: { at, lane } (lane: the side street or alley they're in). */
export function place(state, a) {
  if (state.map.kind !== 'street') return { at: 'hall', lane: null };
  const S = sectionAt(state, a.x);
  if (!S) return { at: null, lane: null };
  const inGap = (g) => a.x > g.x0 - 0.3 && a.x < g.x1 + 0.3;
  if (a.z < Z.front - 0.3) {                                       // (a lane north, round a dogleg; or off the street in a court or a square)
    const g = S.gapsN.find(gp => inLane(gp, a.x, a.z, 0.3));
    return g || !(S.courts?.length || S.squares?.length) ? { at: 'lane', lane: g ?? null } : { at: 'court', lane: null };
  }
  if (a.z > Z.south + 0.3) { const g = S.gapsS.find(inGap); return { at: g ? 'lane' : 'strip', lane: g ?? null }; }
  if (a.z < Z.kerbN) return { at: 'shops', lane: null };
  if (a.z < Z.kerbS) return { at: 'road', lane: null };
  if (a.z < Z.fence) return { at: 'near', lane: null };
  if (S.band === 'park') return { at: 'park', lane: null };
  if (a.z < Z.fenceS) return { at: 'boulevard', lane: null };
  if (a.z < Z.roadS) return { at: 'far-road', lane: null };
  return { at: 'far', lane: null };
}

/** Whether a place is on the street proper (its pavements and road), where the street's advice applies. */
export const onStreet = (p) => p.at === 'shops' || p.at === 'road' || p.at === 'near';
