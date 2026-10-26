// TRADECRAFT sim: heat, how much the other side knows about us (docs/DESIGN.md, Cover, heat and the hunt).
//
// One number per legend per country, 0–100 (my call), kept in state.heat under `${legend}@${country}`.
// It rises when the authorities learn something (a witness reports, a camera catches us), Deception
// limiting what they get, and falls while we lie low. The player never sees it: the instinct reads
// its signs, as well as the character's skill allows. As it climbs the other side does more:
//
//   0–19   quiet         nothing more than anyone gets
//   20–39  watched       occasional surveillance (official cover starts here: embassy staff are presumed spooks)
//   40–59  tailed        regular tails, provocations
//   60–79  investigated  an investigation opens
//   80–99  closing       special agents on it
//   100    blown         the hunted state
//
// Cooling (my call, to tune): lying low takes 2 a day off, going about the cover 1 a day; never
// below the floor a cover starts at (official cover never cools below 20).

export const STAGES = [
  { min: 100, key: 'blown' }, { min: 80, key: 'closing' }, { min: 60, key: 'investigated' },
  { min: 40, key: 'tailed' }, { min: 20, key: 'watched' }, { min: 0, key: 'quiet' },
];
export const COOL_PER_DAY = { lowProfile: 2, cover: 1 };

export const heatKey = (legend, country) => `${legend}@${country}`;

/** The heat on the current legend in the current country. */
export function heat(state) {
  return state.heat[heatKey(state.legend.id, state.country)] ?? state.legend.floor ?? 0;
}

/** Add heat (negative to cool), clamped to the legend's floor … 100. Returns the new value. */
export function addHeat(state, delta) {
  const k = heatKey(state.legend.id, state.country);
  const v = Math.max(state.legend.floor ?? 0, Math.min(100, heat(state) + delta));
  state.heat[k] = v;
  return v;
}

/** The stage a heat value means. */
export const stage = (h) => STAGES.find(s => h >= s.min).key;
