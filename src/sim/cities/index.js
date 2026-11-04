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
// squareName, lot (what stands beside a dogleg), people { name, langs, look, hats (the hats of its own a
// man on business may wear besides the fedora, the cap and the beanie, [kind, weight]: sim/dossier.js) },
// warm (true: a jumper or a galabeya will do on business, as well as a coat or a suit), police (its own,
// over its country's: sim/countries/index.js policeOf()),
//   station (the work here, DESIGN.md Stations and countries): { risk (sim/xp.js), watched (how closely
//     the opposition follows a diplomat in their own hours: sim/campaign.js watched()), embassy, cover (the
//     job), opposition { the, an, name, prison: how the scenes and the briefs name them (localize(), below);
//     short: the briefs' name for them once it's said, where it isn't the `the` ("the residency") },
//     subjects (what the agency wants here: [subject, what it means]), about (the promotion paper's line),
//     targets (who the opposition's men are: [what he is, his cover, where he works, how careful (weights
//     over sim/dossier.js CRAFT), his age's range]), targetsFrom (the city whose people they are, where
//     they aren't this one's: London's are Moscow's), assets (what a posting's assets are), learn (the
//     language its schools and grammars teach, where it isn't the city's own: London's, the opposition's
//     Russian), trip (a first tour's evening here with the station's team, sim/campaign.js TRIPS: { kind,
//     station, why, names (a target's, drawn), what (he is) }), firstTour (the station a junior's first tour
//     is at, FIRST_TOUR_CITY: { about (the career's rung), wanted (the picker's line), job, subject, goal,
//     names, what (the targets), safehouse, paper and work (the tour's brief: src/main.js) }) },
//   transit (sim/transit.js): { metro ({ name ('Underground'), the (in a sentence: 'the Underground'),
//     lines ([name, colour]), front (its stations' building, sim/cities/station.js: { kind ('tiles',
//     'concrete', 'pavilion'), wall, trim, h, door (the door's frame), sign }) } or null), buses (the
//     numbers its buses go by) }, home (a flat's keeping house: sim/interiors/flat.js), embassyLook (the
//     embassy's paint: sim/interiors/embassy.js), walk (the free walk: { about (its line on the title),
//     hello, langs (a Handler's there), park (what the park's things are in its climate) }; Moscow's,
//     but for its about, are the scene's own: sim/scenarios/walk.js) }.
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

// A shop's sign in English, by its kind (src/render/view.js: a sign turning into English for someone who reads its
// language: the user, 2026-11-03, "if the character understands the language, the shop names should periodically
// animate into english"): the longest that fits the board first; a city's own where it differs (Moscow's club is sambo).
export const SHOP_EN = {
  pharmacy: ['PHARMACY'], grocery: ['GROCERY', 'FOOD'], cafe: ['CAFE'], flowers: ['FLOWERS'], bakery: ['BAKERY', 'BREAD'], books: ['BOOKS'],
  optician: ['OPTICIAN', 'GLASSES'], bank: ['BANK'], tobacco: ['TOBACCO', 'KIOSK'], exchange: ['EXCHANGE'], bar: ['BAR'], clothes: ['CLOTHES'],
  shoes: ['SHOES'], watches: ['WATCHES'], phones: ['PHONES'], shawarma: ['SHAWARMA'], beer: ['BEER'], deli: ['DELI'], restaurant: ['RESTAURANT', 'FOOD'],
  gym: ['GYM'], club: ['KARATE CLUB', 'KARATE'], school: ['LANGUAGES'], culture: ['COMMUNITY CENTRE', 'CENTRE'], manakish: ['FLATBREADS', 'BREAD'], sweets: ['SWEETS'], vegetables: ['VEGETABLES', 'GREENGROCER'],
  butcher: ['BUTCHER'], barber: ['BARBER'], laundry: ['LAUNDRY'], juice: ['JUICE BAR', 'JUICE'], koshary: ['KOSHARY'], foul: ['BEANS & FALAFEL', 'FALAFEL'], spices: ['SPICES'],
};
/**
 * A park's kiosk (its feature: look, seed; sim/map/street.js) as its city has it: [sign, colour, sells]. A newsstand (look
 * 'news') is signed its city's news; the rest one of the city's other kiosks, by the seed (the user, 2026-11-04: "why do
 * newspaper booths read teas or cafe ?": the sign, the goods behind the glass, and what you buy at it agree).
 */
export function kioskOf(city, f) {
  const K = cityById(city), news = K.kiosks.find(k => k[2] === 'news') ?? [K.news, 0x283f6b, 'news'];
  if (f?.look === 'news') return [K.news ?? news[0], news[1], 'news'];
  const sold = K.kiosks.filter(k => k[2] !== 'news');
  const [sign, colour, sells = 'cafe'] = sold[(f?.seed ?? 0) % sold.length];
  return [sign, colour, sells];
}
export const SHOP_EN_CITY = { moscow: { club: ['SAMBO CLUB', 'SAMBO'], culture: ['HOUSE OF CULTURE', 'CULTURE'] }, beirut: { culture: ['CULTURAL CENTRE', 'CULTURE'] }, cairo: { culture: ['PALACE OF CULTURE', 'CULTURE'] } };
/** The language a sign's part is in, by its script and the city: Cyrillic Russian, Arabic Arabic, Latin French in Beirut, else English. */
export const scriptLang = (part, city) => (/[\u0400-\u04FF]/.test(part) ? 'ru' : /[\u0600-\u06FF]/.test(part) ? 'ar' : city === 'beirut' ? 'fr' : 'en');

/** The town a map's streets are generated from: its seed in Moscow, `city:seed` in another city. */
export const townOf = (map) => (!map?.city || map.city === 'moscow' ? map.seed : `${map.city}:${map.seed}`);

/** A town's city profile (a number: Moscow). */
export function cityOf(town) {
  if (typeof town !== 'string') return MOSCOW;
  return CITIES[town.slice(0, town.indexOf(':'))] ?? MOSCOW;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The scenes are written for Moscow (its name, its service, its prison). Elsewhere, until the scenes
// are written for each city, localize() puts the city's own in their place as the words are shown
// (src/ui/ui.js): the log, the instinct, the balloons, the briefs and the papers. The city's own are
// its name and its station's opposition (whoever would follow an American there); in Moscow they're
// the scenes' words already.
/** The words of a Moscow scene in the city (an id; none, Moscow or a city we don't know: as they are). */
export function localize(city, text) {
  const K = CITIES[city];
  if (!K || K === MOSCOW || !text) return text;
  const O = K.station.opposition;
  return text.replace(/\ban FSB\b/g, O.an).replace(/\bAn FSB\b/g, cap(O.an)).replace(/\bthe FSB\b/g, O.the).replace(/\bThe FSB\b/g, cap(O.the)).replace(/\bFSB\b/g, O.name)
    .replace(/\bMoscow\b/g, K.name).replace(/\bLefortovo\b/g, O.prison);
}

/** A city's profile by its id ('moscow' when unknown or none). */
export const cityById = (id) => CITIES[id] ?? MOSCOW;

/** The language a city's schools and grammars teach (an id): its station's learn, or the city's own (London's: Russian, the opposition's). */
export const taughtIn = (city) => { const K = cityById(city); return K.station.learn ?? K.lang; };
/** Every language a city's schools teach: the station's target's, the city's own, and its others (its profile's schoolLangs), not English (the user, 2026-11-04: "Beirut and Cairo don't speak russian"). */
export const schoolLangs = (city) => { const K = cityById(city); return [...new Set([K.station.learn, K.lang, ...(K.schoolLangs ?? [])].filter(l => l && l !== 'en'))]; };

/** A city's opposition as a brief names them at the head of a sentence (a profile): "The FSB", "The residency". */
export const serviceOf = (K) => cap(K.station.opposition.short ?? K.station.opposition.the);

/** The station a junior officer's first tour is at (sim/campaign.js juniorPosting()): the city whose station has one, London. */
export const FIRST_TOUR_CITY = CITY_IDS.find(id => CITIES[id].station.firstTour);

/** Where a map's sun stands (sim/light.js): its city's latitude, longitude and clock. */
export const geoOf = (map) => cityById(map?.city).geo;
