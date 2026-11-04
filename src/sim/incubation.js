// TRADECRAFT sim: the incubation, a deep posting's long wait before day one (the user, 2026-11-04: "undercover officer will
// get an incubation period of 3 to 20 months depending on the level of security of the place we're trying to infiltrate
// (based on counter-intel from the country), which will be a fast forward in time where we presumably just build up the
// legend's true history. Illegals get that as well, but it is 3 to 14 years of undercover lying low before they get
// activated").
//
// **How long** (incubationOf()): by the target's security (sim/legends.js DEEP: the place to be got into) and the country's
// counter-intelligence (its profile's ci, sim/countries/), mixed MIX and a little of the seed's either way (MIX_JITTER), and
// spread over what places there are (MIX_FROM, MIX_SPAN: a bank's back office in a lax country the least, a defence ministry in
// the FSB's the most), 0 … 1: an undercover officer's UNDERCOVER_MONTHS (3 to 20 months), an illegal's ILLEGAL_YEARS (3 to 14
// years). Moscow's Defence Ministry is the best part of two years undercover and thirteen as an illegal; Beirut's port eight
// months, six years. The clock, the
// officer's age and the world's date go by with it (the campaign shares one timeline: sim/geopolitics.js).
// **What's lived** (life()): the legend's true history, on the file: the job since its first day, the flat, the café, the
// colleagues who know you by the legend's name; for an illegal, years of it: a marriage perhaps (MARRY_P, more the longer),
// a child, the neighbours, the man at the kiosk who keeps the paper for you. Lines for the file (sim/campaign.js record()).
// **What it does to the officer** (lived()): the legend lived every day keeps Deception and Social up (you lie, you charm,
// for a living); the street's craft goes unused, lying low (LIVED_RUST: a level of rust on the street skills and the
// fighting ones undercover, two as an illegal, sim/rust.js), and the calendar's months start from the day you're activated.
import { stream, range, chance, pick, int } from './rng.js';
import { cityById, townOf } from './cities/index.js';
import { countryOfCity } from './countries/index.js';
import { threadAt } from './geopolitics.js';
import { targetOf } from './legends.js';
import { streetName } from './map/street.js';
import { DAY, calendar, MONTHS } from './clock.js';
import { periodOf, RUST_MAX } from './rust.js';

export const MONTH = 30.44 * DAY, YEAR = 365.25 * DAY;
export const UNDERCOVER_MONTHS = [3, 20], ILLEGAL_YEARS = [3, 14];
export const MIX = { security: 0.55, ci: 0.45 }, MIX_JITTER = 0.06, MIX_FROM = 0.35, MIX_SPAN = 0.6;
export const CI_DEFAULT = 0.7;
export const MARRY_P = { base: 0.3, perYear: 0.04 }, CHILD_P = 0.5;
export const LIVED_RUST = { undercover: { street: 1, fight: 1 }, illegal: { street: 2, fight: 2 } };
const STREET = ['tracking', 'pathfinding', 'awareness'], FIGHT = ['cqc', 'weapons'];

/** A country's counter-intelligence, 0 … 1 (its profile's ci). */
export const ciOf = (city) => countryOfCity(city)?.ci ?? CI_DEFAULT;

/**
 * The incubation of a deep post of `kind` at city, decided at game time ms (world: the campaign's): { ms (its length), months,
 * mix, thread (the rivalry's, sim/geopolitics.js), target (the place, sim/legends.js), why (in words) }.
 */
export function incubationOf(seed, city, kind, world, ms) {
  const thread = threadAt(world, city, ms)?.thread ?? null, T = targetOf(seed, city, kind, thread)?.target;
  const r = stream('incubation', seed, city, kind), ci = ciOf(city), sec = T?.security ?? 0.6;
  const mix = Math.max(0, Math.min(1, (MIX.security * sec + MIX.ci * ci + range(r, -MIX_JITTER, MIX_JITTER) - MIX_FROM) / MIX_SPAN));
  const months = kind === 'illegal' ? Math.round((ILLEGAL_YEARS[0] + mix * (ILLEGAL_YEARS[1] - ILLEGAL_YEARS[0])) * 12)
    : Math.round(UNDERCOVER_MONTHS[0] + mix * (UNDERCOVER_MONTHS[1] - UNDERCOVER_MONTHS[0]));
  const K = countryOfCity(city), why = `${T?.place ?? 'the target'} (its security ${Math.round(sec * 100)} in 100), and ${K?.name ?? 'the country'}'s counter-intelligence (${Math.round(ci * 100)} in 100)`;
  return { ms: Math.round(months * MONTH), months, mix, thread, target: T ?? null, why };
}

const month = (ms) => { const k = calendar(ms); return `${MONTHS[k.month - 1]} ${k.year}`; };
/**
 * The legend's history, lived through the incubation, for posting P (deep: sim/legends.js deepPosting()) and the officer:
 * { lines: [the file's words], spouse?, child? }.
 */
export function life(seed, P, character, kind) {
  const r = stream('legend-life', seed, P.city, kind), K = cityById(P.city), I = P.incubation, from = I.from, years = I.ms / YEAR;
  const street = streetName(townOf({ seed: P.mapSeed, city: P.city }), P.home.row), sex = character?.sex === 'f' ? 'f' : 'm';
  const lines = [
    `${P.alias}, ${P.nationWord}: ${P.jobShort}, at ${P.employer} since ${month(from)}.`,
    `A flat on ${street}, rented in the legend's name in ${month(from)}; ${pick(r, ['a café on the corner where they know the order', 'a gym three streets off, mornings', 'a bakery where the woman keeps the last loaf', 'a kiosk where the man keeps the paper'])}.`,
  ];
  const out = { lines };
  if (kind === 'illegal') {
    if (chance(r, Math.min(0.85, MARRY_P.base + MARRY_P.perYear * years))) {
      const [given, family] = K.people.name(r, sex === 'f' ? 'm' : 'f', (character?.age ?? 45) - 3);
      const wed = from + Math.round(range(r, 0.3, 0.7) * I.ms);
      out.spouse = { name: `${given} ${family}`, since: wed };
      lines.push(`Married ${given} ${family} in ${month(wed)}, who has never known what you are, and never will if you're good.`);
      if (years >= 4 && chance(r, CHILD_P)) { const [cg] = K.people.name(r, chance(r, 0.5) ? 'f' : 'm', 2); out.child = { name: cg, born: wed + Math.round(range(r, 1, 2.5) * YEAR) }; lines.push(`A child, ${cg}, born ${month(out.child.born)}.`); }
    } else lines.push(pick(r, ['Alone, as far as the neighbours know: a quiet one, polite on the stairs.', 'A friend or two from work, a name-day remembered, nobody close.', 'Engaged once, years ago; it didn\'t take, and nobody wonders why any more.']));
    lines.push(`${Math.round(years * 10) / 10} years of it, lying low: no signal, no drop, nothing that would make anyone look twice. The Center's word, when it comes, will be the first in all that time.`);
  } else {
    lines.push(`${pick(r, ['Colleagues who know you by the legend\'s name, and a boss who likes your work', 'An editor who thinks you\'re wasted on the job, and says so', 'A desk by the window, and colleagues who invite you to their name-days'])}: ${I.months} months of being nobody but ${P.alias}.`);
  }
  return out;
}

/**
 * The incubation lived by the officer p, activated at ms (kind: 'undercover' | 'illegal'): the street's craft rusty from lying low
 * (LIVED_RUST), Deception and Social kept by living the legend, the rust's calendar from the day you're activated. p, changed.
 */
export function lived(p, kind, ms) {
  if (!p?.skills) return p;
  const L = LIVED_RUST[kind] ?? LIVED_RUST.undercover, rust = (p.rust ??= {});
  for (const k of STREET) rust[k] = Math.min(RUST_MAX, Math.max(rust[k] ?? 0, L.street));
  for (const k of FIGHT) rust[k] = Math.min(RUST_MAX, Math.max(rust[k] ?? 0, L.fight));
  delete rust.deception; delete rust.social;
  p.practice = {};
  p.rustAt = periodOf(ms);
  return p;
}
