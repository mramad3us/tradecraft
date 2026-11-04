// TRADECRAFT sim: arrested with no diplomatic passport (docs/POSTINGS.md; DESIGN.md, Career: the undercover officer has "no
// immunity"; Cover, heat and the hunt: "An arrest is survivable unless it also blows the cover, which will be under scrutiny.
// Captured alone costs time: deadlines pass, and posting objectives can fail badly. Captured and burned is game over").
// sim/armed.js arrest() hands a deep posting's arrest here (jailed()), with what they had you for; so do sim/hunt.js
// questioned() (taken in for questioning, the papers read) and sim/police.js's search (a weapon found on a legend).
//
// **The legend under their eyes** (scrutiny()): who you are is looked into, harder the graver the charge (GRAVITY) and the
// better the country's counter-intelligence (its ci): your Deception against SCRUTINY.base + ci × SCRUTINY.ci + the charge's
// gravity, a legend lived longer the easier (LIVED_MOD: a point every six months of it, at most 4), an illegal's papers
// genuine (ILLEGAL_MOD). Blown already (sim/campaign.js pass(): c.blown), there's nothing to look into: they know.
// **It breaks** (or blown): espionage. The opposition's own prison (the city's station.opposition.prison: Lefortovo, Tora, a
// basement in the Dahiyeh), a closed trial, years (ESPIONAGE_Y), and nobody will say you were ours: the posting's over and
// the career with it (c.over 'taken': the next officer, the world going on).
// **It holds**: charged as the person the legend says you are (CHARGES, by what they had you for):
//   - **a brawl, or a blade found** (the 'described' tier): BAIL_H in a cell, a fine (BAIL_USD), a court date; out, the
//     posting goes on (your employer has heard: the arrest's cost to the job's standing, sim/armed.js TIERS).
//   - **anything with a gun in it**: a sentence by the country's law (SENTENCE: years, a range by charge); served under the
//     legend's name, the Agency working quietly for a release (SERVED_K of it, a swap or parole). The posting's over
//     (c.over 'imprisoned', its ms the day you're out): the career goes on from there, back on the official ladder, older;
//     past 60 by then, retired. An illegal imprisoned is brought home on release, and that's the career (their post the last).
import { stream, range, chance } from './rng.js';
import { check } from './checks.js';
import { skill } from './skills.js';
import { say } from './log.js';
import { HOUR, DAY, MONTHS, calendar } from './clock.js';
import { cityById } from './cities/index.js';
import { countryOfCity } from './countries/index.js';
import { cashOf, price } from './money.js';
import { isDeep } from './legends.js';
import { ciOf, MONTH, YEAR } from './incubation.js';

export const SCRUTINY = { base: 20, ci: 14 }, LIVED_MOD = { perMonths: 6, max: 4 }, ILLEGAL_MOD = 6;
export const GRAVITY = { questioned: -2, described: 0, gun: 4, trap: 4, shots: 6, wounded: 8, killed: 10 };
export const BAIL_H = 48, BAIL_USD = 1500, SERVED_K = [0.4, 0.7];
// (years, by charge, by the country's law; my calls from the codes: Russia's 222 (arms), 213 (hooliganism), 111 (grievous harm), 105
// (murder), 276 (espionage); Egypt's Law 394 of 1954 and its military courts; Lebanon's penal code and the party's own justice)
export const SENTENCE = {
  ru: { gun: [2, 5], trap: [2, 5], shots: [3, 8], wounded: [6, 12], killed: [8, 20] },
  eg: { gun: [3, 7], trap: [3, 7], shots: [5, 10], wounded: [7, 15], killed: [15, 25] },
  lb: { gun: [0.5, 3], trap: [0.5, 3], shots: [1, 5], wounded: [3, 10], killed: [10, 25] },
  any: { gun: [1, 5], trap: [1, 5], shots: [3, 8], wounded: [5, 12], killed: [12, 25] },
};
export const ESPIONAGE_Y = { ru: [12, 20], eg: [15, 25], lb: null, any: [10, 20] };   // (Lebanon's: the party's, no court, no years)
export const CHARGES = { described: 'assault, and a weapon carried', gun: 'possessing an illegal firearm', trap: 'buying an illegal firearm', shots: 'firing a gun in a public place', wounded: 'attempted murder', killed: 'murder' };

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const month = (ms) => { const k = calendar(ms); return `${MONTHS[k.month - 1]} ${k.year}`; };
const yearsWords = (y) => (y < 1 ? `${Math.round(y * 12)} months` : `${Math.round(y * 10) / 10} years`);

/** Whether the legend holds under their eyes, for a charge's gravity (GRAVITY's key): the roll. */
export function scrutiny(state, p, charge = 'gun') {
  const c = state.campaign, P = c.posting, months = (P.incubation?.ms ?? 0) / MONTH + Math.max(0, state.time.ms - P.startMs) / MONTH;
  const dc = Math.round(SCRUTINY.base + ciOf(P.city) * SCRUTINY.ci + (GRAVITY[charge] ?? 0));
  const mods = [{ why: 'the legend lived', v: Math.min(LIVED_MOD.max, Math.floor(months / LIVED_MOD.perMonths)) }, ...(P.level === 'illegal' ? [{ why: 'a citizen\'s papers, every one genuine', v: ILLEGAL_MOD }] : [])];
  return check(stream('scrutiny', c.seed, Math.floor(state.time.ms / HOUR), charge), { skill: 'deception', value: skill(p, 'deception'), dc, mods, body: p });
}

/** Whether a posting has no diplomatic passport to show (a deep one): an arrest is jailed() then. */
export const noImmunity = (state) => isDeep(state.campaign?.posting);

/**
 * A deep posting's arrest (sim/armed.js arrest(), the facts it found): { tier (TIERS'), how, what (what they had you for), taken
 * ([what went into evidence]), ward (hurt: the hospital first), station (where) }. The legend looked into; bail, a sentence, or taken.
 */
export function jailed(state, bus, me, { tier = 'gun', how = 'submitted', what = '', taken = [], ward = null, station = 'the station' } = {}) {
  const c = state.campaign, P = c.posting, p = state.people[me.who], now = state.time.ms, K = cityById(P.city), country = countryOfCity(P.city)?.id;
  const charge = how === 'trap' ? 'trap' : tier, ill = P.level === 'illegal', lines = [`What they had you for: ${what.charAt(0).toLowerCase()}${what.slice(1)}`];
  if (taken.length) lines.push(`Taken, into evidence bags: ${taken.join(', ')}.`);
  if (ward) lines.push(ward.line);
  const roll = c.blown ? null : scrutiny(state, p, charge);
  if (roll) say(state, bus, { kind: 'roll', roll, text: roll.ok ? `${P.alias}: the papers, the employer rung at night, the flat looked over. It holds.` : `${P.alias}: the papers, the employer, the flat; and then a man from ${K.station.opposition.the} who asks about the years before it, and keeps asking.` });
  if (!roll || !roll.ok) return taken_(state, bus, me, lines, roll);
  lines.push(`No diplomatic passport to show: ${P.alias}'s papers, read twice, the employer rung at night, the flat looked over. The legend holds: to them you're ${P.alias}, ${P.jobShort}.`);
  if (charge === 'described') {
    const fine = Math.min(BAIL_USD, Math.max(0, cashOf(p)));
    p.cash = Math.round((cashOf(p) - fine) * 100) / 100;
    if (fine < BAIL_USD) P.money.bank = Math.max(0, (P.money.bank ?? 0) - (BAIL_USD - fine));
    lines.push(`Charged with ${CHARGES.described}. ${BAIL_H} hours in a cell at ${station}, a lawyer the legend can afford, and bail: ${price(state, BAIL_USD)}, and a court date in ${month(now + 120 * DAY)} that a quiet word from somewhere may make go away. ${P.employer} has heard.`);
    c.log.push({ ms: now, text: `Arrested as ${P.alias}: ${CHARGES.described}; ${BAIL_H} hours, bail, a court date. The legend held.` });
    bus?.emit('papers', [{ kind: 'arrest', title: 'ARRESTED', lines }]);
    say(state, bus, { kind: 'note', text: `The cuffs, the car, ${station}: ${BAIL_H} hours of it as ${P.alias}, and bail.` });
    state.$held = (BAIL_H + (ward?.h ?? 0)) * HOUR;
    state.$released = true;
    return true;
  }
  // (a sentence, served under the legend's name: the posting over; out when the Agency's quiet work gets you out)
  const r = stream('sentence', c.seed, now), S = (SENTENCE[country] ?? SENTENCE.any)[charge] ?? SENTENCE.any.gun, years = Math.round(range(r, ...S) * 2) / 2, served = Math.round(years * range(r, ...SERVED_K) * 10) / 10;
  const out = now + Math.round(served * YEAR);
  lines.push(`Charged with ${CHARGES[charge]}, as ${P.alias}. A trial, a lawyer the legend can afford: ${yearsWords(years)}. The Agency can't know you; it works quietly all the same.`,
    `${yearsWords(served)} of it served, then ${ill ? 'a deal nobody signs, and the Center brings you home at last: your last posting, over' : 'a deal nobody signs, a flight home in somebody else\'s name'}: ${month(out)}.`);
  c.over = { ms: out, why: 'imprisoned', years, served, charge: CHARGES[charge] };
  c.log.push({ ms: now, text: `Arrested as ${P.alias}: ${CHARGES[charge]}; ${yearsWords(years)}, ${yearsWords(served)} served. The legend held; the posting didn't.` });
  bus?.emit('papers', [{ kind: 'arrest', title: 'SENTENCED', lines }]);
  say(state, bus, { kind: 'note', text: `The cuffs, the car, ${station}; then a court, and ${yearsWords(years)}.` });
  state.$held = (12 + (ward?.h ?? 0)) * HOUR;                      // (the night of it lived; the years are the posting's end, sim/scenarios/campaign.js)
  state.$released = true;
  return true;
}

// The legend broken, or blown already: espionage, the opposition's own prison, and the career's end.
function taken_(state, bus, me, lines, roll) {
  const c = state.campaign, P = c.posting, now = state.time.ms, K = cityById(P.city), country = countryOfCity(P.city)?.id, O = K.station.opposition;
  const Y = country in ESPIONAGE_Y ? ESPIONAGE_Y[country] : ESPIONAGE_Y.any, r = stream('espionage', c.seed, now), years = Y ? Math.round(range(r, ...Y)) : null;
  lines.push(roll ? `The legend doesn't hold: ${P.alias}'s years before ${P.employer} have a hole in them, and a man from ${O.the} finds it.` : `There's no legend to look into: ${O.the} knew who you were before they had you.`,
    `${cap(O.prison)}. ${years ? `A closed trial for espionage, and ${years} years` : 'No court, no charge, no years: nobody is ever told'}. The Agency won't say your name, and neither will you.`,
    'If a swap ever comes, it won\'t be for years, and it won\'t be yours to play.');
  c.over = { ms: now, why: 'taken', years };
  c.log.push({ ms: now, text: `Taken as a spy: ${O.prison}${years ? `, ${years} years` : ''}.` });
  bus?.emit('papers', [{ kind: 'arrest', title: 'TAKEN', lines }]);
  say(state, bus, { kind: 'note', text: `The cuffs, a hood, ${O.prison}.` });
  state.$held = 6 * HOUR;
  state.$released = true;
  return true;
}

/** Blown, and home all the same: they were waiting on the stairs. */
export function takenAtHome(state, bus, me) {
  say(state, bus, { kind: 'note', text: 'Two men on the landing, one on the stairs below you, and the door of the flat open already. They\'ve been waiting.' });
  return taken_(state, bus, me, ['Home, blown: the one place they knew you\'d come back to.'], null);
}

/** Questioned under a legend (sim/hunt.js questioned()): the papers read; holds (true), or taken (false: jailed already). */
export function questionedDeep(state, bus, me) {
  const p = state.people[me.who];
  if (state.campaign.blown) { taken_(state, bus, me, ['Taken in for questioning, and they knew your face from their own file.'], null); return false; }
  const roll = scrutiny(state, p, 'questioned');
  say(state, bus, { kind: 'roll', roll, text: roll.ok ? 'The papers, read twice; a call to the employer; a long look. It holds.' : 'The papers, read twice; a call to the employer; and a question about the years before it that you answer a beat too late.' });
  if (roll.ok) return true;
  taken_(state, bus, me, ['Taken in for questioning, and the legend looked into.'], roll);
  return false;
}
