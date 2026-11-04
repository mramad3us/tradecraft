// TRADECRAFT sim: the legends of the deep postings (DESIGN.md, Career: The deep postings, and the table: the undercover officer "abroad,
// under a legend (e.g. a translator at a news agency) … no immunity. The cover job matters, and losing it fails the
// posting"; the illegal "abroad, as a citizen of the target country: a legally earned identity, never an obviously spooky
// post").
//
// **What's to be got into** (DEEP, by city; a station without, as London, has no deep postings: the user, never London):
// each post's target is a place (a ministry's directorate, a design bureau, the port), its security 0 … 1 (how hard it is to
// get near: with the country's counter-intelligence, the incubation's length, sim/incubation.js), the long rivalry's
// threads it serves (sim/geopolitics.js THREADS: a post's target is one its purpose wants), and the jobs that put a legend
// near it: an undercover officer's (a foreigner's job: a translator, a stringer, a sales engineer) or an illegal's (a
// citizen's: a dentist, an accountant, a piano teacher). A job has its employer's name (on the plate over its door: the
// workplace, on the posting's streets as the embassy is for a handler) and its hours.
// **The legend** (identity()): an undercover officer is a third country's national under a name not their own (NATIONS:
// a Belgian, a Canadian, an Irishman…), their papers that country's passport and a residence permit; an illegal a citizen
// of the country itself, named as its people are, their papers its own, every one of them genuine.
// **The posting** (deepPosting()): a handler's posting made from the same seed (sim/campaign.js posting(): its network, its
// targets, its flat and safe houses), made deep: no embassy (its place on the street is the legend's workplace, a plain
// door: sim/places.js), the legend's job and name, the rank, the heat at nothing (a clean unofficial cover isn't watched:
// sim/campaign.js pass() floors it at 1 only once it's ever risen past it), the job's standing by how long the legend's
// been lived, the purpose (the rivalry's thread at the time: sim/geopolitics.js purposeAt()), the target, the way out
// (exfilOf(): the self-extraction point, far from the centre), and the legend's history (sim/incubation.js life()).
import { stream, int, pick, range, chance, hash } from './rng.js';
import { cityById } from './cities/index.js';
import { countryOfCity } from './countries/index.js';
import { purposeAt } from './geopolitics.js';
import { incubationOf, life } from './incubation.js';
import { DAY } from './clock.js';

export const DEEP_LEVELS = new Set(['undercover', 'illegal']);
// (each target: { place, security, threads, jobs: { undercover: [[job, employer, sign]], illegal: […] } }; the employer's name is the plate over its door)
export const DEEP = {
  moscow: [
    { place: 'the Defence Ministry\'s procurement directorate', short: 'the ministry\'s procurement', security: 0.9, threads: ['command', 'programme'],
      jobs: { undercover: [['a technical translator at a bureau that works for the ministry\'s suppliers', 'Lingvo-Tekh', 'LINGVO-TEKH'], ['a correspondent for a Belgian defence trade weekly', 'the weekly\'s Moscow office', 'DEFENSE & INDUSTRIE']],
        illegal: [['a dentist with a practice whose patients include colonels', 'the practice', 'СТОМАТОЛОГИЯ'], ['an accountant at a firm that supplies the ministry\'s canteens', 'Prodsnab', 'ПРОДСНАБ']] } },
    { place: 'the Foreign Ministry\'s North America department', short: 'the Foreign Ministry', security: 0.75, threads: ['inner', 'illegals'],
      jobs: { undercover: [['a translator at a news agency that covers the ministry', 'Interlingua Press', 'INTERLINGUA PRESS'], ['a teacher of English to the ministry\'s young diplomats', 'the language centre', 'LINGUA CENTRE']],
        illegal: [['a piano teacher to diplomats\' children', 'the music school', 'МУЗЫКАЛЬНАЯ ШКОЛА'], ['a bookseller near the ministry, who orders what its people ask for', 'the bookshop', 'КНИГИ']] } },
    { place: 'a missile design bureau\'s export office', short: 'the design bureau', security: 0.85, threads: ['programme'],
      jobs: { undercover: [['a sales engineer for a Swiss machine-tool maker', 'Hauser Präzision', 'HAUSER PRAZISION']],
        illegal: [['an engineer at a subcontractor that machines the bureau\'s parts', 'Tochmash', 'ТОЧМАШ']] } },
    { place: 'the presidential administration\'s press service', short: 'the administration', security: 0.8, threads: ['inner', 'influence'],
      jobs: { undercover: [['a stringer for a Canadian news wire', 'Northern Wire', 'NORTHERN WIRE']],
        illegal: [['a sound engineer at a television studio the administration uses', 'the studio', 'СТУДИЯ']] } },
  ],
  beirut: [
    { place: 'the port\'s customs house and its clearing agents', short: 'the port', security: 0.5, threads: ['proxies', 'arsenal'],
      jobs: { undercover: [['a translator at a shipping agency', 'Levant Maritime', 'LEVANT MARITIME']],
        illegal: [['a clearing agent\'s bookkeeper', 'the clearing agency', 'تخليص']] } },
    { place: 'Hezbollah\'s security in the southern suburbs', short: 'the party\'s security', security: 0.85, threads: ['proxies', 'hostages'],
      jobs: { undercover: [['a stringer for a French news agency', 'Agence Levant', 'AGENCE LEVANT'], ['a researcher for a relief charity in the suburbs', 'Cedar Relief', 'CEDAR RELIEF']],
        illegal: [['a pharmacist in the southern suburbs', 'the pharmacy', 'صيدلية'], ['a teacher at a school in Haret Hreik', 'the school', 'مدرسة']] } },
    { place: 'a bank in Hamra that clears the party\'s money', short: 'the bank', security: 0.35, threads: ['proxies', 'influence'],
      jobs: { undercover: [['a compliance consultant on secondment from a Swiss bank', 'the bank', 'BANQUE']],
        illegal: [['a teller at the bank, then its head of branch', 'the bank', 'مصرف']] } },
    { place: 'the Iranian embassy\'s cultural centre and its circle', short: 'the cultural centre', security: 0.7, threads: ['arsenal', 'influence'],
      jobs: { undercover: [['a lecturer in Persian literature at a private university', 'the university', 'UNIVERSITE']],
        illegal: [['a money-changer\'s partner in Hamra', 'the exchange', 'صيرفة']] } },
  ],
  cairo: [
    { place: 'Military Production\'s procurement office', short: 'Military Production', security: 0.85, threads: ['programme', 'patron'],
      jobs: { undercover: [['a translator at a news agency', 'Nile Wire', 'NILE WIRE'], ['a sales engineer for a Danish valve maker', 'Holm Ventiler', 'HOLM VENTILER']],
        illegal: [['an accountant at a contractor that builds for the ministry', 'the contractor', 'مقاولات']] } },
    { place: 'the General Intelligence Service\'s liaison office', short: 'the GIS', security: 0.9, threads: ['regime', 'patron'],
      jobs: { undercover: [['a teacher at a language centre the officers\' families use', 'the British Language Centre', 'LANGUAGE CENTRE']],
        illegal: [['a lawyer\'s clerk who handles the officers\' property', 'the chambers', 'مكتب محاماة']] } },
    { place: 'the Russian engineers\' compound at the reactor site\'s Cairo office', short: 'the reactor\'s office', security: 0.6, threads: ['patron', 'programme'],
      jobs: { undercover: [['an interpreter for a Danish contractor at the site', 'Aarhus Nuclear Services', 'AARHUS NUCLEAR']],
        illegal: [['a driver for the Russian engineers\' families', 'the car service', 'ليموزين']] } },
    { place: 'the Suez Canal Authority\'s dispatch office', short: 'the Canal', security: 0.55, threads: ['patron', 'regime'],
      jobs: { undercover: [['a sales rep for a Danish shipping line', 'Nordsø Line', 'NORDSO LINE']],
        illegal: [['a tour guide whose regulars are Russian officers on leave', 'the travel agency', 'سياحة']] } },
  ],
};
export const deepOf = (city) => cityById(city)?.station?.deep ?? DEEP[city] ?? null;   // (a city's profile may carry its own: station.deep)
export const DEEP_CITIES = Object.keys(DEEP);

// (an undercover officer's papers: a third country's, never the agency's own; their names, by sex)
export const NATIONS = [
  { id: 'be', word: 'Belgian', passport: 'a Belgian passport', f: ['Claire', 'Anne', 'Sophie', 'Lise'], m: ['Luc', 'Pieter', 'Marc', 'Olivier'], family: ['Dumont', 'Peeters', 'Janssens', 'Lambert', 'Wouters'] },
  { id: 'ca', word: 'Canadian', passport: 'a Canadian passport', f: ['Megan', 'Jessica', 'Nicole', 'Julie'], m: ['Ryan', 'Kevin', 'Mathieu', 'Scott'], family: ['Tremblay', 'MacLeod', 'Gagnon', 'Fraser', 'Bouchard'] },
  { id: 'ie', word: 'Irish', passport: 'an Irish passport', f: ['Aoife', 'Siobhan', 'Niamh', 'Orla'], m: ['Ciaran', 'Declan', 'Eoin', 'Padraig'], family: ['Byrne', 'Doyle', 'Kavanagh', 'Nolan', 'Quinn'] },
  { id: 'ch', word: 'Swiss', passport: 'a Swiss passport', f: ['Regula', 'Stefanie', 'Corinne'], m: ['Urs', 'Beat', 'Reto', 'Lukas'], family: ['Meier', 'Brunner', 'Keller', 'Huber', 'Steiner'] },
  { id: 'dk', word: 'Danish', passport: 'a Danish passport', f: ['Mette', 'Karen', 'Signe'], m: ['Søren', 'Anders', 'Mikkel', 'Jens'], family: ['Holm', 'Lund', 'Madsen', 'Nygaard', 'Thorsen'] },
  { id: 'nz', word: 'New Zealander', passport: 'a New Zealand passport', f: ['Kate', 'Hannah', 'Ella'], m: ['Liam', 'Callum', 'Josh', 'Hamish'], family: ['Wallace', 'Reid', 'Gibson', 'Harland', 'Moffat'] },
];
// (a job's employer where its job says it: the trade weekly's office and the news wire want a Belgian or a Canadian; anyone else anyone)
const NATION_FOR = { 'DEFENSE & INDUSTRIE': 'be', 'NORTHERN WIRE': 'ca', 'HAUSER PRAZISION': 'ch', 'HOLM VENTILER': 'dk', 'NORDSO LINE': 'dk', 'AARHUS NUCLEAR': 'dk', 'AGENCE LEVANT': 'be', 'BANQUE': 'ch' };

/** A post's target and job, from its seed: { target, job: [what, employer, sign] } (a thread wanted first, when it's given). */
export function targetOf(seed, city, kind = 'undercover', thread = null) {
  const T = deepOf(city);
  if (!T?.length) return null;
  const r = stream('deep-target', seed, city, kind), want = thread ? T.filter(x => x.threads.includes(thread)) : [];
  const target = pick(r, want.length ? want : T), jobs = target.jobs[kind] ?? target.jobs.undercover;
  return { target, job: pick(r, jobs) };
}

/**
 * The legend's identity for p (the character) at city: { name, nation, papers, word }. An undercover officer's a third country's
 * national (NATIONS: the employer's own where it's one that would want them); an illegal's a citizen, named as the city's people are.
 */
export function identity(seed, p, city, kind, job) {
  const r = stream('deep-name', seed, city, kind), sex = p?.sex === 'f' ? 'f' : 'm', K = cityById(city), country = countryOfCity(city);
  if (kind === 'illegal') {
    const [given, family] = K.people.name(r, sex, p?.age ?? 45);
    return { name: `${given} ${family}`, nation: country?.id ?? null, word: 'a citizen', papers: `${country?.name ?? 'the country'}'s own papers, every one of them genuine: a birth certificate in a registry that burned, a school, an army record, a passport` };
  }
  const want = NATION_FOR[job?.[2]], N = NATIONS.find(n => n.id === want) ?? pick(r, NATIONS);
  return { name: `${pick(r, N[sex])} ${pick(r, N.family)}`, nation: N.id, word: N.word, papers: `${N.passport} in that name, and a residence permit for the job` };
}

// (the way out: a place far from the centre that an undercover officer must reach on their own, an illegal further still; its words by city)
export const EXFIL_ROWS = { undercover: [8, 11], illegal: [12, 15] };
export const EXFIL_WORDS = {
  moscow: ['a lorry park off the ring road, where the Finnish trucks wait', 'the yard behind a bus depot on the city\'s edge, where a Belarusian coach leaves at dawn', 'a dacha track past the last metro station'],
  beirut: ['a fishing harbour north of the city, where a boat for Cyprus waits', 'a garage on the coast road, where a truck for the north leaves after dark'],
  cairo: ['a truck stop on the desert road, where the Alexandria lorries fill up', 'a felucca landing far up the Nile\'s bank, past the last bridge'],
};
/** The way out of a deep posting: { row, x, label } (from its seed: EXFIL_ROWS streets from the flat, either way). */
export function exfilOf(seed, city, kind, homeRow) {
  const r = stream('deep-exfil', seed, city, kind), [lo, hi] = EXFIL_ROWS[kind] ?? EXFIL_ROWS.undercover, dir = chance(r, 0.5) ? 1 : -1;
  return { row: homeRow + dir * (lo + int(r, hi - lo + 1)), x: Math.round(range(r, 20, 160)), label: pick(r, EXFIL_WORDS[city] ?? ['a lay-by on the edge of the city']) };
}

// The legend's job, the employer's working week (as the embassy's: 9 to 6, Monday to Friday; an illegal's a citizen's).
export const DEEP_RANK = { undercover: 'Undercover officer', illegal: 'Illegal' };
export const DEEP_COVER0 = { undercover: 62, illegal: 74 }, DEEP_COVER_PER_MONTH = 0.5;   // (the job's standing at activation: a legend lived longer is better set; at most 90)
export const GOAL_DEEP = { undercover: 14, illegal: 12 };          // (an undercover post's, done; an illegal's, each of the Center's taskings: it never ends)

/**
 * A handler's posting P (sim/campaign.js posting(), from the same seed: its network, targets, flat and safe houses) made a deep
 * one of `kind` for character p: the legend, its job and workplace (p.embassy, a plain door: sim/places.js), the purpose, the
 * target, the heat at nothing, the job's standing, the way out, the history lived before day one (the incubation's).
 */
export function deepPosting(P, seed, kind, world, character = null) {
  const city = P.city, start = P.startMs, inc0 = incubationOf(seed, city, kind, world, start);
  const inc = character?.$incMax && character.$incMax < inc0.ms ? { ...inc0, ms: character.$incMax, months: Math.round(character.$incMax / (30.44 * DAY)) } : inc0;   // (a legend's lying low cut short: sim/postings.js capped())
  const pick0 = targetOf(seed, city, kind, inc.thread), purpose = purposeAt(world, city, start, inc.thread);   // (the thread open the day you're activated: what the Center wants of you now)
  const [what, employer, sign] = pick0.job, id = identity(seed, character, city, kind, pick0.job);
  const months = inc.ms / (30.44 * DAY);
  Object.assign(P, {
    rank: DEEP_RANK[kind], level: kind, legend: kind, job: `${what}, as ${id.name}`, jobShort: what, employer,
    alias: id.name, nation: id.nation, papers: id.papers, nationWord: id.word,
    embassy: { id: 'embassy', row: 0, label: employer, sign, door: true },   // (the workplace: a door of the street's, the plate over it; the hub's 'embassy' is wherever the day's work is)
    target: { place: pick0.target.place, short: pick0.target.short, security: pick0.target.security },
    subject: purpose?.subject ?? P.subject, goal: purpose?.goal ?? P.goal, thread: inc.thread, rivalry: purpose?.rivalry ?? null,
    heat: 0, cover: Math.min(90, Math.round(DEEP_COVER0[kind] + months * DEEP_COVER_PER_MONTH)),
    exfil: exfilOf(seed, city, kind, P.home.row),
    incubation: { from: start - inc.ms, ms: inc.ms, months: Math.round(months), years: Math.round(months / 12 * 10) / 10, why: inc.why },
  });
  P.money.fund = Math.round(P.money.fund * (kind === 'illegal' ? 0.4 : 0.6));   // (an operational fund that can't be traced to anyone: smaller)
  P.life = life(seed, P, character, kind);                          // (the legend's history: a job since, a flat, a marriage perhaps: sim/incubation.js)
  if (kind === 'illegal') P.handler = handlerOf(seed, city);         // (DESIGN.md, Career: "few contacts with a handler (a retired illegal, deep undercover too)")
  return P;
}

// An illegal's handler: one of the Center's own, a retired illegal living as a citizen too, met by signal twice a year (HANDLER_LINES).
export const HANDLER_LINES = ['who ran a bakery for nineteen years and never once burnt the bread', 'who taught chemistry in a provincial school for twenty years, and still corrects people', 'who was a taxi driver for sixteen years and knows every back way there is', 'who sold insurance for a decade and can tell you exactly what anything is worth'];
export function handlerOf(seed, city) {
  const r = stream('deep-handler', seed, city), sex = chance(r, 0.5) ? 'f' : 'm', [given, family] = cityById(city).people.name(r, sex, 66);
  return { name: `${given} ${family}`, sex, line: pick(r, HANDLER_LINES) };
}

/** Whether a posting is a deep one (undercover, an illegal's): no embassy, no immunity. */
export const isDeep = (P) => DEEP_LEVELS.has(P?.level);

// A deep start's past (sim/campaign.js newCampaign(): the picker's undercover or illegal officer, nobody's career before it). An
// undercover officer's: a handler's posting carried out in another country, the training (BACK_TRAINING_Y), the legend lived (the
// posting's own incubation). An illegal's (the branch for the young): London's first tour done well, a handler's posting after it
// in another country (its language school first, BACK_SCHOOL_Y), ended under ILLEGAL_AGE; then the school (its own weeks:
// character.$back), the legend lived. The career's file, as sim/postings.js nextPosting() would have made it.
export const BACK_TRAINING_Y = { undercover: 1, illegal: 2 }, BACK_SCHOOL_Y = 1.2, BACK_POSTING_Y = 0.15;
export function backstory(seed, P, character = null) {
  const r = stream('deep-back', seed, P.city, P.level), Y = 365.25 * DAY, inc = P.incubation?.from ?? P.startMs;
  const train = inc - (P.level === 'illegal' && character?.$back ? character.$back.weeks * 7 * DAY : BACK_TRAINING_Y[P.level] * Y);
  const other = Object.keys(DEEP).concat(['london']).filter(c => countryOfCity(c)?.id !== P.country);
  const handler = pick(r, other), out = [];
  if (P.level === 'illegal') {
    out.push({ level: 'junior', city: 'london', until: train - (BACK_SCHOOL_Y + BACK_POSTING_Y) * Y, how: 'promoted' }, { level: 'handler', city: handler, until: train, how: 'completed' });
  } else out.push({ level: 'handler', city: handler, until: train, how: 'completed' });
  out.push({ level: 'training', kind: P.level, city: P.city, from: train, until: inc }, { level: 'incubation', kind: P.level, city: P.city, from: inc, until: P.startMs });
  return out;
}
