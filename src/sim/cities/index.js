// TRADECRAFT sim: the cities. A posting's city is data, a profile (DESIGN.md, World and setting):
// everything the street generator (sim/map/street.js) and the people (sim/people.js) draw that isn't
// the same everywhere. Moscow (moscow.js: as it always was), London (london.js), Beirut (beirut.js),
// Cairo (cairo.js); their people's names and dress (folk.js); what stands in a square (square.js).
//
// A profile: { id, name, country, lang, geo (where the sun stands: lat, lon, the clock's offset from
// UTC), drive ('right' | 'left': which way parked cars face), streetName / boulevardName / parkName
// (the names, by hash: no stream drawn), gaps() (the ways north through a terrace, and what they're
// called), parkShare, building() (the architect: a building's doors, shops and arches, which the sim
// knows, and its facade's paint), dress() (its dress, from the looks' stream), LOOKS (the makes of
// everything, sim/map/street.js scheme()), SHOPS, carColours, postbox, taxi, kiosks, furnish() (what
// stands on its streets besides: drawn last, from a stream of its own), terrace (the chances of its
// terrace's shapes: court, square, crescent, jog; sim/map/street.js terraceOf()), courtName,
// squareName, lot (what stands beside a dogleg), people { name, langs, look } }.
//
// A map knows its city by state.map.city ('moscow' when there's none: a game saved before there were
// cities). The street functions take a *town*: the seed alone in Moscow, so its streets are drawn from
// the very streams they always were, and `city:seed` elsewhere (townOf()), so another city's are its
// own; cityOf() reads the profile back from it.
import { MOSCOW } from './moscow.js';
import { LONDON } from './london.js';
import { BEIRUT } from './beirut.js';
import { CAIRO } from './cairo.js';

export const CITIES = { moscow: MOSCOW, london: LONDON, beirut: BEIRUT, cairo: CAIRO };
export const CITY_IDS = Object.keys(CITIES);

/** The town a map's streets are generated from: its seed in Moscow, `city:seed` in another city. */
export const townOf = (map) => (!map?.city || map.city === 'moscow' ? map.seed : `${map.city}:${map.seed}`);

/** A town's city profile (a number: Moscow). */
export function cityOf(town) {
  if (typeof town !== 'string') return MOSCOW;
  return CITIES[town.slice(0, town.indexOf(':'))] ?? MOSCOW;
}

// The scenes are written for Moscow (its name, its service, its prison). Elsewhere, until the scenes
// are written for each city, localize() puts the city's own in their place as the words are shown
// (src/ui/ui.js): the log, the instinct, the balloons, the briefs and the papers.
const LOCAL = {
  london: { name: 'London', service: 'MI5', the: 'MI5', an: 'an MI5', prison: 'Belmarsh' },
  beirut: { name: 'Beirut', service: 'Sûreté Générale', the: 'the Sûreté Générale', an: 'a Sûreté Générale', prison: 'Roumieh' },
  cairo: { name: 'Cairo', service: 'Mukhabarat', the: 'the Mukhabarat', an: 'a Mukhabarat', prison: 'Tora' },
};
/** The words of a Moscow scene in the city (an id; none or Moscow: as they are). */
export function localize(city, text) {
  const L = LOCAL[city];
  if (!L || !text) return text;
  return text.replace(/\ban FSB\b/g, L.an).replace(/\bAn FSB\b/g, L.an.charAt(0).toUpperCase() + L.an.slice(1)).replace(/\bthe FSB\b/g, L.the).replace(/\bThe FSB\b/g, L.the.charAt(0).toUpperCase() + L.the.slice(1)).replace(/\bFSB\b/g, L.service)
    .replace(/\bMoscow\b/g, L.name).replace(/\bLefortovo\b/g, L.prison);
}

/** A city's profile by its id ('moscow' when unknown or none). */
export const cityById = (id) => CITIES[id] ?? MOSCOW;

/** Where a map's sun stands (sim/light.js): its city's latitude, longitude and clock. */
export const geoOf = (map) => cityById(map?.city).geo;
