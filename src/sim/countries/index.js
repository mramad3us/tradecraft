// TRADECRAFT sim: the countries a station is in (DESIGN.md, Stations and countries; the user, 2026-11-03:
// "make sure countries are implemented in a way that is scalable because we will be adding more playable
// stations down the line"). A station is a city (sim/cities/: its streets, its people, and its station: the
// embassy, the opposition, the work) in a country (here: what the country decides, the same in any of its
// cities). One file each, registered in COUNTRIES; a city names its country (profile.country), and a city's
// own police: { … } overrides its country's where a city's differ.
//
// A country: { id, name, lang (its language), currency ({ sign, rate a dollar, round, after: the sign after
// the number }), police ({ patrolP: a patrol's chance on a street in an hour, stopBase: a papers stop's
// chance with nothing showing, awareness: their Awareness, look: the uniform, skin: their skins, ask: the
// papers line, arms: { patrol: their handguns (empty: unarmed), patrolLong: the long guns some patrols carry,
// response: the armed response's guns, visible: who carries rifles in the open }, response: the armed unit
// and its minutes to come (soldiers: it's the army, a soldier each, in look: their uniform), armour: { patrol:
// the share of patrol officers in a soft vest under the shirt, color: the response's plate carriers, patch: POLICE
// across them: sim/armour.js }),
// law ({ handgun, long, carry, ranges, diplomats }: what's legal, in words the game
// reads: 'banned', 'licensed', 'permit', 'traumatic', 'open', 'club'), black ({ ease 0–1: how easy a gun is
// to come by, models: what's on offer }), range (a shooting club or range in its station, where there is one:
// { name, what: the guns it lets you shoot }) }. The research behind them is DESIGN.md's (Firearms: the law
// and the police, by country).
import { RU } from './ru.js';
import { GB } from './gb.js';
import { LB } from './lb.js';
import { EG } from './eg.js';
import { US } from './us.js';
import { cityById } from '../cities/index.js';

export const COUNTRIES = { ru: RU, gb: GB, lb: LB, eg: EG, us: US };

/** A country by its id ('ru' when unknown). */
export const countryById = (id) => COUNTRIES[id] ?? RU;
/** A city's country (by the city's id: 'moscow' when none). */
export const countryOfCity = (city) => countryById(cityById(city).country);
/** A map's country (its city's: Moscow's when it has none). */
export const countryOfMap = (map) => countryOfCity(map?.city);
/** The police of a map's city: its country's, with whatever the city has of its own. */
export function policeOf(map) {
  const C = cityById(map?.city), K = countryById(C.country);
  return C.police ? { ...K.police, ...C.police } : K.police;
}
