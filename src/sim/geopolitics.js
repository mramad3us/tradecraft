// TRADECRAFT sim: the world's business over the years (the user, 2026-11-04: "some geopolitics background gen should rely
// on years to resolve and cycle through to justify the existence of this or that posting"; "geopolitics need to be built
// in a procedural fashion (no hard coded country etc) because a campaign is the same until we start a new one
// (geopolitics and date/time continue on the same timeline when we die or retire an officer and pick the next one").
//
// **Procedural.** Nothing here knows a country. A country's profile (sim/countries/) says what kinds of business it has
// (geo.traits, from TEMPLATES' keys) and the names its business needs (geo: its rival, its patron, a region, a
// neighbour, its leader's word); the world's seed (c.world: one for a whole campaign, every officer of it) picks what
// varies (which weapon, the order things come in) and lays it out in time. A new country gets its business the moment its
// profile has traits; one with none, DEFAULT_TRAITS.
// **The timeline** (timeline(w, country)): the country's issues in an order of the seed's, each lasting LAST_Y years, the
// next rising before the last is done (OVERLAP_Y at most), from START_Y to END_Y, round and round (a hostage crisis can
// come again). **A posting's tasking** (taskingAt()): the station's country's newest issue open at the posting's start.
// **The news** (newsBetween()): what rose and what was settled between two dates, a line each (a posting's brief after
// time away).
// **The long rivalries** (RIVALRIES, THREADS: 0.2's, DESIGN.md, 0.2: the deep postings; the user, 2026-11-04: "these postings should link to long
// running geopolitics (not surface stuff like regular officers who can be deployed to take part in a task force …) like decades
// long rivalry with a country"). Between the agency's country (AGENCY_COUNTRY) and another, played out where a country's
// profile says (rivalry: { [the agency's country]: { since, the (in words), threads (THREADS' keys), rival, patron, leader } }:
// Moscow's own, Beirut's Tehran's by way of the party, Cairo's Moscow's long courtship of it). A rivalry's threads run
// THREAD_Y each, decades, from its since and round again, the next rising before the last is done (THREAD_OVERLAP_Y): a deep
// posting's purpose is the thread open when it's decided (purposeAt(), threadAt()), not the station's business of the
// season (ISSUES above: a few years, a handler's tasking).
import { stream, range, pick } from './rng.js';
import { at } from './clock.js';
import { countryOfCity, countryById, COUNTRIES } from './countries/index.js';
import { cityById } from './cities/index.js';

export const START_Y = 2025, END_Y = 2075, LAST_Y = [1.5, 4], OVERLAP_Y = 1;
const Y = 365.25 * 86400000;
export const DEFAULT_TRAITS = ['residency', 'money'];
// (each kind of business: its subject, what the station wants of it, how it ended; {tokens} from the country's geo, the
// station's city, or the seed's VARIANTS)
export const TEMPLATES = {
  weapons: ['the {weapon} programme', 'how far {country}\'s {weapon} has come, and who builds it', 'the {weapon} in service, and its designer\'s name in every paper'],
  sanctions: ['sanctions evasion', 'who in {country}\'s ruling circle moves money and chips past the sanctions, and how', 'the last of the shell companies shut, and its banker in prison'],
  succession: ['the succession', 'who comes after {leader}, and who\'s already choosing', 'a new {leaderShort} named, and the losers abroad or quiet'],
  proxies: ['the private armies', 'the armed companies {country} pays abroad: who funds them, who they answer to', 'folded into the army, their founder dead in a plane that fell'],
  money: ['{rival}\'s money', 'whose fortunes in {city} are {rival}\'s men\'s, held in trust', 'frozen, mostly, by the courts'],
  residency: ['the residency', '{rival}\'s intelligence officers under diplomatic cover in {city}, and whom they run', 'two dozen of them expelled in one morning'],
  hit: ['the poisonings', 'the unit of {rival}\'s that kills defectors abroad, and who on its list lives in {city}', 'two of its officers named, and never tried'],
  routes: ['the arms routes', 'how {patron}\'s weapons reach {country}, by which ports and whose trucks', 'the port closed to them, for now'],
  hostages: ['the hostages', 'who holds the Westerners taken in {city}, and where', 'released at a border crossing in a deal nobody signed'],
  vaults: ['the emptied vaults', 'who took the depositors\' dollars out of the banks before the collapse, and where they are', 'a list leaked, and nobody on it arrested'],
  border: ['the {border}', 'what the armed men along the {border} have dug in, and what they mean to do with it', 'a ceasefire, a line on a map, and patrols on both sides of it'],
  insurgency: ['the {region} networks', 'the jihadist cells in {region}: their couriers in {city}', 'their emir killed, the rest scattered'],
  water: ['the river', 'the dam upstream and the water talks, and what the army means to do if they fail', 'an agreement on the filling, and nobody believing it'],
  arms: ['the arms deals', 'what {country} buys, from whom, paid how', 'the fighters delivered, and the bill in someone else\'s name'],
  smuggling: ['the {neighbour} border', 'the guns and the men across the {neighbour} border, and whose they are', 'the border shut, and the smugglers paid to keep it so'],
};
// (what the seed chooses among, where a token isn't the country's own)
export const VARIANTS = { weapon: ['hypersonic missile', 'new submarine', 'drone fleet', 'enrichment', 'satellite killer'] };

/** A country's issues over the years from world seed w: [{ trait, subject, goal, ended, from, to }] (game ms). */
export function timeline(w, countryId, city = null) {
  const K = countryById(countryId), G = K?.geo ?? {}, traits = (G.traits?.length ? G.traits : DEFAULT_TRAITS).filter(t => TEMPLATES[t]);
  const r = stream('geopolitics', w, countryId), words = wordsOf(G, K, city, stream('geo-words', w, countryId));
  const order = [...traits.slice(0, 2), ...shuffleOf(r, traits.slice(2))], out = [];
  let t = at(START_Y, 1, 1) - range(r, 0, 1.5) * Y, k = 0;
  while (t < at(END_Y, 1, 1) && order.length) {
    const T = TEMPLATES[order[k % order.length]], len = range(r, ...LAST_Y) * Y, fill = (s) => s.replace(/\{(\w+)\}/g, (m, key) => words[key] ?? m);
    out.push({ trait: order[k % order.length], subject: fill(T[0]), goal: fill(T[1]), ended: fill(T[2]), from: t, to: t + len, round: Math.floor(k / order.length) });
    t += len - range(r, 0, OVERLAP_Y) * Y; k++;
  }
  return out;
}
// (the tokens: the country's own words, the station's city, the seed's picks)
function wordsOf(G, K, city, r) {
  const C = city ? cityById(city) : null;
  return { country: G.the ?? K?.name ?? 'the country', leader: G.leader ?? 'the man at the top', leaderShort: G.leaderShort ?? 'leader', rival: G.rival ?? 'a rival\'s', patron: G.patron ?? 'a patron',
    region: G.region ?? 'the provinces', border: G.border ?? 'border', neighbour: G.neighbour ?? 'western', city: C?.name ?? 'the capital', weapon: pick(r, VARIANTS.weapon) };
}
const shuffleOf = (r, list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(range(r, 0, i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** The station's tasking at ms: [subject, goal] (its country's newest issue open then), or null (none to have). */
export function taskingAt(w, city, ms) {
  const K = countryOfCity(city), open = timeline(w, K?.id, city).filter(I => I.from <= ms && ms < I.to);
  const I = open.sort((a, b) => b.from - a.from)[0];
  return I ? [I.subject, I.goal] : null;
}

/** What rose and what was settled at the station's country between two dates: [line]. */
export function newsBetween(w, city, from, to, words = (ms) => new Date(Date.UTC(2026, 0, 1) + ms).toISOString().slice(0, 7)) {
  const out = [];
  for (const I of timeline(w, countryOfCity(city)?.id, city)) {
    if (I.to > from && I.to <= to) out.push(`${cap(I.subject)}: ${I.ended}, ${words(I.to)}.`);
    if (I.from > from && I.from <= to) out.push(`${cap(I.subject)}: the station's business since ${words(I.from)}: ${I.goal}.`);
  }
  return out;
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------- the long rivalries (0.2's deep postings) ----------

export const AGENCY_COUNTRY = { CIA: 'us' };
export const THREAD_Y = [10, 25], THREAD_OVERLAP_Y = 3, RIVALRY_SINCE = 1947;
// (each thread: its subject, what the post is to learn of it, how it's said when a decade's done with it; {tokens} the rivalry's words)
export const THREADS = {
  command: ['the command chain', 'who stands behind {leader} when the codes change hands, and what they would do with them', 'a generation of generals retired, and their files in our safe'],
  programme: ['the long programme', 'the weapon {country} has been building for thirty years: its designers, its tests, what it can do', 'the thing in service at last, and nothing about it we didn\'t know first'],
  inner: ['the inner circle', 'the score of men around {leader}: what they own, whom they fear, which of them would move first', 'the circle broken and remade, and our man inside the new one'],
  illegals: ['their illegals', '{rival}\'s own illegals in the West: who trains them, who runs them, under what names', 'a dozen of them gone home in a swap, and the school that made them known to us'],
  influence: ['the influence networks', 'whom {rival} pays in Western capitals, and through whom', 'the money traced, and the names in a report nobody published'],
  proxies: ['{patron}\'s army in {country}', 'the party\'s chain of command to {patron}: who gives the orders, how they travel, who carries them', 'the chain mapped, and two of its links dead'],
  arsenal: ['the hidden arsenal', 'how many rockets the party has dug in, where, and who holds the keys to them', 'the tunnels on a map in Langley, and the party knowing it'],
  hostages: ['the abductions', 'the men who have taken Westerners in {country} for forty years, and the next they mean to take', 'the last of the old kidnappers dead, the young ones known'],
  patron: ['{rival} on the Nile', '{rival}\'s long courtship of {country}: the arms, the reactor, the officers it trains, and what it\'s promised', 'the reactor running, and the officers who trained in Moscow our friends'],
  regime: ['the army\'s grip', 'the generals who really run {country}: their companies, their quarrels, who comes after', 'a new man at the top, from the list we had'],
};
/** The long rivalries there are, from the countries' profiles: [{ country, agency, since, the, rival, threads }]. */
export const RIVALRIES = Object.values(COUNTRIES).flatMap(K => Object.entries(K.rivalry ?? {}).map(([agency, R]) => ({ country: K.id, agency, ...R })));
/** The rivalry played out at city, for the agency's country (us): { since, the, threads, words }, or null (none: no deep posting's purpose here). */
export function rivalryOf(city, agency = 'us') {
  const K = countryOfCity(city), L = K?.rivalry?.[agency];
  if (!L?.threads?.length) return null;
  return { ...L, words: { country: K.geo?.the ?? K.name, rival: L.rival ?? K.geo?.rival ?? K.geo?.the ?? K.name, patron: L.patron ?? K.geo?.patron ?? 'its patron', leader: L.leader ?? K.geo?.leader ?? 'the man at the top' } };
}
/** A rivalry's threads over the decades from world seed w at city: [{ thread, subject, goal, ended, from, to }] (game ms). */
export function threads(w, city, agency = 'us') {
  const R = rivalryOf(city, agency);
  if (!R) return [];
  const K = countryOfCity(city), r = stream('rivalry', w, K.id, agency), order = shuffleOf(r, R.threads), fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => R.words[k] ?? m), out = [];
  let t = at(R.since ?? RIVALRY_SINCE, 1, 1) + range(r, 0, 2) * Y, k = 0;
  while (t < at(END_Y, 1, 1)) {
    const key = order[k % order.length], T = THREADS[key], len = range(r, ...THREAD_Y) * Y;
    if (T) out.push({ thread: key, subject: fill(T[0]), goal: fill(T[1]), ended: fill(T[2]), from: t, to: t + len });
    t += len - range(r, 0, THREAD_OVERLAP_Y) * Y; k++;
  }
  return out;
}
/** The thread open at city at ms (the newest begun): its { thread, subject, goal, from, to }, or null. */
export function threadAt(w, city, ms, agency = 'us') {
  return threads(w, city, agency).filter(I => I.from <= ms && ms < I.to).sort((a, b) => b.from - a.from)[0] ?? null;
}
/** What the rivalry at city did between two dates, a line each: threads done with, threads risen (a deep post's brief after time away). */
export function rivalryNews(w, city, from, to, words = (ms) => String(new Date(Date.UTC(2026, 0, 1) + ms).getUTCFullYear()), agency = 'us') {
  const out = [];
  for (const I of threads(w, city, agency)) {
    if (I.to > from && I.to <= to) out.push(`${cap(I.subject)}: ${I.ended}, ${words(I.to)}.`);
    if (I.from > from && I.from <= to) out.push(`${cap(I.subject)}: the long work since ${words(I.from)}: ${I.goal}.`);
  }
  return out;
}

/**
 * A deep posting's purpose at city, decided at ms: the rivalry's thread then (or the one named, if it's this rivalry's): { subject,
 * goal, thread, rivalry: { the, since, years (how long it's run by ms) } }; a station without a rivalry, its tasking then.
 */
export function purposeAt(w, city, ms, thread = null, agency = 'us') {
  const R = rivalryOf(city, agency), all = threads(w, city, agency);
  const I = (thread && all.filter(x => x.thread === thread && x.from <= ms).sort((a, b) => b.from - a.from)[0]) ?? threadAt(w, city, ms, agency);
  if (!R || !I) { const t = taskingAt(w, city, ms); return t ? { subject: t[0], goal: t[1], thread: null, rivalry: null } : null; }
  const year = new Date(Date.UTC(2026, 0, 1) + ms).getUTCFullYear();
  return { subject: I.subject, goal: I.goal, thread: I.thread, rivalry: { the: R.the, since: R.since ?? RIVALRY_SINCE, years: year - (R.since ?? RIVALRY_SINCE) } };
}
