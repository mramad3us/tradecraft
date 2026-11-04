// TRADECRAFT sim: the agency's support (the user, 2026-11-04: "Agency Support (AS) which is a new resource that is a function
// of how 'easy' our station is"). The campaign's: what the station will do for you when you ring for it (sim/dial.js), a
// pool that's spent and comes back a little every day.
//
// **How much** (SUPPORT, by the posting's kind: kindOf()): London's first tour, the most there is (100 at most, back 50 a
// day: a junior officer's station has every resource); a handler under official cover elsewhere, moderate (80, which is
// exactly an extraction's; back 10 a day); an undercover officer under an unofficial cover (Beirut, Cairo, Moscow; London
// has none such), thin (40, a clandestine clinic's, never an extraction: that would take more than a clandestine
// operation has); an illegal, next to nothing (20, a clean gun's; back 2 a day). The last two are the 0.2 postings'
// (DESIGN.md, Cover, heat and the hunt: Under a legend: sim/legends.js, the way out instead of an extraction, sim/dial.js). It starts full.
// **Its price on the black market**, where it has none of its own: AS_USD dollars a point (the user: "1AS = 1000£"), for
// what the black market does instead (sim/dial.js: Queued).
// The posting keeps what's left (c.posting.support: { now }, filled in on first asking, so a save from before it has it).
export const SUPPORT = {
  firstTour: { max: 100, perDay: 50, word: 'everything the station has' },
  official: { max: 80, perDay: 10, word: 'the station behind you' },
  undercover: { max: 40, perDay: 4, word: 'a thin line to the agency' },
  illegal: { max: 20, perDay: 2, word: 'next to nothing' },
};
export const AS_USD = 1250;                                       // (£1,000 a point, in the dollars the game keeps: sim/money.js)

/** The posting's kind, for its support: London's first tour, official cover, an undercover officer's, an illegal's. */
export const kindOf = (P) => (P?.level === 'junior' ? 'firstTour' : !P?.legend || P.legend === 'embassy' ? 'official' : P.legend === 'illegal' ? 'illegal' : 'undercover');

/** What support there is now: { now, max, perDay, kind, word }, or null outside a campaign. */
export function supportOf(c) {
  const P = c?.posting;
  if (!P) return null;
  const kind = kindOf(P), S = SUPPORT[kind];
  P.support ??= { now: S.max };
  P.support.now = Math.min(S.max, P.support.now);
  return { now: P.support.now, max: S.max, perDay: S.perDay, kind, word: S.word };
}

/** Spend n of it: true, spent; false, not enough. */
export function spend(c, n) {
  const S = supportOf(c);
  if (!S || S.now < n) return false;
  c.posting.support.now = S.now - n;
  return true;
}

/** A day gone by (sim/campaign.js pass()): it comes back, its day's worth, to its most. */
export function regen(c) {
  const S = supportOf(c);
  if (S) c.posting.support.now = Math.min(S.max, S.now + S.perDay);
}
