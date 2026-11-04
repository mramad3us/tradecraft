// TRADECRAFT sim: the campaign (DESIGN.md, The player's loop; Career; Postings, assignments and the
// day; the user, 2026-10-27: "Start working on campaign mode … the onion that is Character life >
// Posting > Assignment generation with the mission types that we tested … make sure the generators
// are well oiled and well defined").
//
// state.campaign is the persistent part of a game (plain data, saved with it): who you are, the
// posting, its people and places, the assignments, the gauges. It rides inside every game state, the
// hub's (sim/scenarios/campaign.js: your city, from your door, the desk) and an assignment's (a
// tested mission run with the campaign's context: sim/scenarios/sdr.js, tail.js); when an assignment
// ends, fold() takes its outcome back into the campaign.
//
// **The character** (candidates()): three generated officers to pick from at a level of the career
// (LEVELS): a junior officer's first tour (Station London, the liaison with MI5, no network of their
// own: the user, 2026-10-27, "characters that are getting out of spy school ... started with easy
// counter-intelligence assignments"), or a Handler's posting (an embassy job, official cover, a network
// to run). Each with a background, skills by it, a language level in the posting's tongue, a look.
// **The first tour** (level 'junior'): the residency's officers followed and photographed with MI5's
// watchers in London, and two team trips abroad (TRIPS: a couple of days with another station's team,
// flown out and back: an asset met for Moscow, a photograph in Beirut, a tail in Cairo). Its goal met
// (GOAL_JUNIOR), you're promoted: a posting of your own (promote()). The tour is a station's (the one
// whose profile has a firstTour, sim/cities/ FIRST_TOUR_CITY: its job, its targets, its brief), and
// each trip its city's (its station's trip): another station hosts either by its data.
// **The posting** (posting()): a city, its country, the cover (Second Secretary at the embassy), a
// goal (a subject the agency wants intelligence on: SUBJECTS by city), the flat and the embassy (doors
// on the city's streets), safe houses, the network (ASSETS: codenamed, each with a yield and a trust),
// the opposition's targets (who to follow: their files, names of the city's, and the briefs written from
// them, sim/dossier.js), and the gauges: heat (how much the opposition
// knows; sim/heat.js keeps it per legend and country), cover standing (the embassy's view of your
// work), intelligence (the blue thing: DESIGN.md, Intelligence), money (salary, operational fund).
// **The assignments** (plan()): the posting's schedule, made day by day as days begin, from the
// mission types tested (KINDS): an asset meeting by way of a surveillance detection run (sdr: a bench
// at a time, a window to be there in, whoever's on you as you get there), a tail on a target to his
// meeting (tail: his door, his evening), each at its place on the posting's streets (sim/places.js
// missionPlace()), walked to. Each has a window; missed, it costs (an asset's trust; a lead
// gone). The generator keeps them apart (never two at once), on working days' evenings and weekends,
// every few days for each asset and target (CADENCE), one a day at most, and only references people
// and places the posting has.
// **The day** (DAY): the cover job 9:00–18:00 on weekdays (work(): the hours pass, cover standing
// up), sleep (rest(): to 7:00, fatigue gone), lying low (a day, heat down), and the assignment's
// window. Skipping time is the engine's (sim/game.js skip()); the campaign keeps the calendar's
// consequences: pay on the 1st, the week's review on Sunday night (review()).
// **What heat costs** (pass()): an asset met with a tail on you is compromised, and each day after may be
// arrested (ARREST_PER_DAY): gone from the network, heat up. Heat at EXPEL_HEAT and the posting's over:
// declared persona non grata (official cover: expelled, not jailed; DESIGN.md, Career), c.over.
// Lying low at a safe house cools faster (SAFE_LOW_K); lying low at one with the opposition on you
// shows them the door, and the station's cable says it's blown the next morning (s.seen → s.burned).
// **Watched in your own hours** (watched(); DESIGN.md, Cover, heat and the hunt: "occasional
// surveillance (20+), then regular tails (40+)"): out of the flat's door or the embassy's, the hour's
// dice say whether they're on you (the same all that hour, at that door: the flat's window shows it):
// the station's watched (its city's profile) × (heat − 10) / 60, at most WATCHED_MAX, an overt pair or, as the heat climbs, a covert
// team ((heat − 30) / 40 of the time, at most COVERT_MAX). The scene is the hub's (sim/scenarios/
// campaign.js), with being tailed's team; still on you when an asset meeting begins, they're its team.
// **The goal** (GOAL_INTEL): the posting is done when the station has the intelligence it wanted, a few
// weeks' work done well; c.over = { why: 'completed' }. **Leads** (DESIGN.md, Intelligence and leads): a
// tail that sees the meeting identifies the contact, who becomes a target of his own (CONTACTS), the
// next step; an asset trusted enough (TRUSTED) brings more (yield 2).
// **The file** (record()): the career as the character sheet (C) shows it: the posting now, the postings before
// it (c.career: promote()), every assignment done or missed and how it went as the officer knows it, the reviews.
import { stream, int, pick, chance, range, weighted, hash } from './rng.js';
import { sheet, streetLook } from './people.js';
import { at, DAY, HOUR, MIN, calendar } from './clock.js';
import { CABINET } from './medicine.js';
import { fileOf, assetFile, targetName, briefOf, CRAFT, assetRolesOf } from './dossier.js';
import { outcomeWord } from './outcomes.js';
import { CITIES, CITY_IDS, cityById, FIRST_TOUR_CITY } from './cities/index.js';
import { missionXP, gain, level, progress } from './xp.js';
import { fieldwork } from './rust.js';
import { between, born } from './career.js';
import { LANG_NAME } from './langs.js';
import { POLICE_COOL_DAY } from './police.js';
import { LESSON_BOOK, lessonBook, sceneOf } from './lessons.js';
export { LESSON_BOOK, lessonBook, sceneOf };
export const LESSON_GAP_H = 2, LESSON_XP_K = 0.4;

export const KINDS = {
  sdr: { name: 'An asset meeting', scenario: 'sdr', about: 'Meet the asset clean: a surveillance detection run to the bench, and only sit down if nobody\'s on you.' },
  tail: { name: 'A tail', scenario: 'tail', about: 'Follow the target from his door to whoever he meets, and don\'t be seen.' },
  watch: { name: 'A photograph', scenario: 'watch', about: 'Photograph the target at his meeting, and don\'t let his minder see you do it.' },
  lesson: { name: 'Hale\'s exercise', scenario: null, about: 'One of Hale\'s exercises, on the posting\'s own streets: him in your ear, the station\'s people playing the parts.' },   // (its scene the lesson's: sim/tutorial/)
};
/**
 * Hale's exercises, booked (the user, 2026-11-04: "unless we accept tutorials from Hale, which instead of teleporting us
 * into the tutorials, should book the tutorial as an assignment we have to move to during a day we're not working in the
 * beginning. Assignments should populate the days after the tutorials we picked and asking for an other tutorial later on
 * should populate it a day that is free (or at an earlier time like in the morning) where the planning is free and at
 * least two hours before an assignment to avoid collisions"). Each an assignment of its own (kind 'lesson', a.lesson its
 * id: sim/tutorial/), walked to like any other, its place by its scene's kind (scene: a tail's door, a meeting's bench, a
 * café), its hour its own (h: when he comes out, the meeting, the photograph's). Booked on Hale's first call, the station
 * gives you the days before your desk to settle in: one a day from tomorrow, the desk from the day after the last
 * (p.deskFrom; the days between, nothing expected at the embassy), the work planned from there. Booked later: the first
 * day from tomorrow with room, one a day, LESSON_GAP_H clear of anything else that day. The Farm's mat isn't on the list:
 * it's a memory, played from the title's tutorial.
 */
export const lessonsLeft = (c) => LESSON_BOOK.filter(L => !c.assignments.some(a => a.kind === 'lesson' && a.lesson === L.id && a.status === 'open') && !c.done.some(a => a.kind === 'lesson' && a.lesson === L.id && a.status === 'done'));
/** Days between one asset's meetings, and between tails on one target. */
export const CADENCE = { sdr: [3, 6], tail: [4, 8], watch: [5, 9] };
export const WORK = { from: 9, to: 18 };
export const WAKE_H = 7;
export const COVER_PER_DAY = 6;                                   // (a day's work at the embassy, cover standing up)
export const COVER_MISSED = 10;                                   // (a working day missed)
export const HEAT_LOW_PER_DAY = 6;                                // (a day lying low)
export const SAFE_LOW_K = 1.7;                                     // (… at a safe house)
export const ARREST_PER_DAY = 0.25;
export const EXPEL_HEAT = 95;
export const WATCHED_MAX = 0.85, COVERT_MAX = 0.75;
export const GOAL_INTEL = 10;                                  // (six or seven good operations: two or three weeks, done well)
export const TRUSTED = 4;
export const GOAL_JUNIOR = 6;                                      // (a first tour: four or five good evenings, a trip done well)
// The career's rungs, lowest first (DESIGN.md, Next: the ladder to an illegal; built so far, these two).
export const LEVELS = [
  { id: 'junior', name: 'A first tour', rank: 'Junior officer', about: cityById(FIRST_TOUR_CITY).station.firstTour?.about },   // (its station's words: London's)
  { id: 'handler', name: 'A posting of your own', rank: 'Handler', about: 'A station of your choosing under official cover: a network to run, a man to watch, the heat to keep down.' },
];
export const levelOf = (id) => Math.max(0, LEVELS.findIndex(l => l.id === id));
// (a first tour's trips: the cities whose stations have one, in CITIES' order, and what the team wants of you there; never the tour's own)
export const TRIPS = CITY_IDS.filter(id => id !== FIRST_TOUR_CITY && CITIES[id].station.trip).map(id => ({ city: id, ...CITIES[id].station.trip }));
const CONTACTS = ['Kirill Belov', 'Arkady Shubin', 'Yuri Golovin', 'Stanislav Vetrov', 'Mikhail Danilov'];
export const SALARY = 7200;
export const TRAVEL = { waitMin: 6, perRowMin: 4 };                 // (the metro or a taxi: a wait, and minutes a street away)                                        // ($ a month, after tax: a GS-12)
export const FUND = 2500;                                          // ($ the operational fund, a month)

// (a station's own: its embassy, the cover, the opposition, what the agency wants there, how closely you're watched; its city's profile, sim/cities/)
const stationOf = (city) => cityById(city).station;
/** What the agency wants from a posting, by city: [subject, what it means] (its station's). */
export const subjectsOf = (city) => stationOf(city).subjects;
const CODENAMES = ['SOLOVEY', 'ZHURAVL', 'SKVORETS', 'KUKUSHKA', 'SINITSA', 'GRACH', 'SOKOL', 'DROZD'];
const ROLES = ['a ministry clerk', 'a defence engineer', 'a banker\'s assistant', 'a journalist', 'a customs officer', 'a translator at a state firm'];
const MOTIVES = ['money', 'ideology', 'ego', 'revenge'];
// What a life before the Agency brings (the user, 2026-10-27: "background should impact starting skills by up
// to +4 points (an ex marine would know how to fight)"): points on top of the training, BG_MAX at most a
// skill, kept apart on the sheet (p.bg: ◆, where practice is •).
export const BG_MAX = 4;
export const BACKGROUNDS = [
  { id: 'marine', text: 'A Marine infantry officer, two tours, then the Farm: knows how to fight, and how to keep going.', skills: { cqc: 4, weapons: 4, fitness: 3, awareness: 1 } },
  { id: 'army', text: 'Army intelligence, then the Farm: a linguist who learned to walk a street.', skills: { awareness: 3, tracking: 2, cqc: 2, fitness: 2 } },
  { id: 'police', text: 'A city detective once: patient on a street, hard to lose, handy in a scuffle.', skills: { tracking: 4, awareness: 2, cqc: 3 } },
  { id: 'econ', text: 'An economist out of Treasury: reads a balance sheet like a face.', skills: { analysis: 4, social: 2, deception: 1 } },
  { id: 'state', text: 'Four years at State before the Agency took them: at home at a reception.', skills: { social: 4, deception: 2, awareness: 1 } },
  { id: 'medic', text: 'A Navy corpsman before the Farm: steady hands, steadier nerves.', skills: { medicine: 4, fitness: 2, awareness: 1 } },
  { id: 'journo', text: 'A foreign correspondent, recruited in Istanbul: knows how to ask.', skills: { social: 3, deception: 3, pathfinding: 1 } },
  { id: 'nsa', text: 'An engineer at NSA who wanted to see the other end of the wire.', skills: { tech: 4, analysis: 3, awareness: 1 } },
  { id: 'wrestler', text: 'A college wrestler, then the Peace Corps in the Caucasus: strong, and at home anywhere.', skills: { fitness: 4, cqc: 3, social: 1, pathfinding: 1 } },
];
const US = { f: ['Rebecca', 'Laura', 'Megan', 'Claire', 'Diane', 'Hannah', 'Julia', 'Sarah'], m: ['Daniel', 'Michael', 'Thomas', 'Andrew', 'Mark', 'Peter', 'James', 'Robert'],
  family: ['Price', 'Walker', 'Brennan', 'Hollis', 'Mercer', 'Dalton', 'Keane', 'Whitlock', 'Sutton', 'Garrett'] };

// The legends (the user, 2026-10-31: "when dev mode is on, the carrer mode should allow us to select a special
// character with 95 tradecraft, give them a reason for it, make it varied"; 2026-11-03: "remove the debug
// character, we should replace this section to read Legends and it should be available even with debug mode off"). Each is its own
// reason for being what no ordinary career makes, and so its own skills on top of DEFAULT_LEGEND: its ages, its
// languages, its names. legendFile() draws one, a person of the same seed the same way. What a file's reason
// gives it, it has mastered (the user, 2026-11-03: "the debug profile with high tradecraft should also have
// mastery of all skills given their background"): a skill it raises to expert or past is a master's 20; a touch
// of something (a 10 or a 12) stays a touch, and what the reason takes away (age, a gift with no training) stays gone.
// And each its reason for starting again (anew; the user, 2026-11-03: "we also need to find a reason for starting
// anew, maybe we 'retired' and came back, maybe we were burned and dust has settled"): retired and back, burned
// and forgotten, pensioned and back with a lawyer; a first tour's paper puts them at the bottom, like anyone.
// Close combat and a gun, whatever the reason: every one of them came through the Farm (the user, 2026-11-03: "legends
// now start with close to 0 CQC and Weapons Handling skill, that's a bug these skills should be very high"), so
// both at LEGEND_ARMED at least, and every other skill at LEGEND_FLOOR's (armedFloor(): new files, and a legend's save on load once, sim/state.js).
export const LEGEND_ARMED = [18, 2];
// (and good at everything, the user, 2026-11-03: "legends should be very good at everything, even medicine or analysis (even
// though these last three skills should remain lower than the rest, they should still be high to reflect that legends had a
// past where they were illegals or other highly independent and skilled postings)")
export const LEGEND_FLOOR = { deception: [18, 2], tracking: [18, 2], pathfinding: [18, 2], awareness: [18, 2], social: [18, 2], cqc: LEGEND_ARMED, weapons: LEGEND_ARMED, fitness: [16, 2], analysis: [12, 2], tech: [12, 2], medicine: [12, 2] };
/** A legend's skills raised to LEGEND_FLOOR where under it (skills: a sheet's). Returns whether anything rose. */
export function armedFloor(skills) {
  let up = false;
  for (const [k, f] of Object.entries(LEGEND_FLOOR)) { const v = skills[k] ?? [0, 0]; if (v[0] + v[1] < f[0] + f[1]) { skills[k] = [...f]; up = true; } }
  return up;
}
export const DEFAULT_LEGEND = { deception: [15, 2], tracking: [15, 2], pathfinding: [15, 2], awareness: [15, 2], social: [10, 2], analysis: [10, 1], tech: [5, 1], medicine: [5, 1], cqc: [10, 2], weapons: [10, 1], fitness: [10, 1] };
export const LEGENDS = [
  { id: 'illegal', age: [58, 64], names: { f: ['Ruth Lindqvist', 'Marian Kessel'], m: ['Paul Ostrander', 'Henry Lindqvist'] }, langs: { ru: 'native', fr: 'fluent' },
    text: 'Twenty-two years in Moscow under a dead Canadian\'s name, an illegal the Agency stopped admitting to in 2009. Came home in a swap. The debriefers stopped taking notes after a week: there was nobody left to give them to.',
    anew: 'Retired to Vermont after the swap, under their own name, which they still answer to slowly. Two winters of it were enough: they asked to come back.',
    skills: { deception: [20, 3], pathfinding: [20, 3], tracking: [20, 2], awareness: [20, 2], social: [20, 2] } },
  { id: 'defector', age: [55, 62], names: { f: ['Irina Valk', 'Vera Sorin'], m: ['Anton Valk', 'Lev Sorin'] }, langs: { ru: 'native', de: 'fluent' },
    text: 'Directorate S\'s best instructor, until a Tuesday in Vienna in 2011. Wrote the street syllabus half the SVR still learns from, and walked out through the consulate\'s side door with it in their head.',
    anew: 'Resettled on a farm in Virginia under a third name. Fifteen years on, the SVR\'s own files say they\'re dead, and Langley has decided the dust has settled.',
    skills: { tracking: [20, 3], deception: [20, 3], pathfinding: [20, 1], analysis: [20, 2], cqc: [20, 1] } },
  { id: 'farm', age: [48, 57], names: { f: ['Grace Tolliver', 'Joan Marsh'], m: ['Walter Tolliver', 'Sam Marsh'] }, langs: {},
    text: 'Sixteen years running denied-area training at the Farm. No student has followed them further than a block, and none has ever shaken them. The Agency sends them now only when it has run out of everyone else.',
    anew: 'Retired last spring with a plaque and a dinner, and back by the autumn: the Agency had run out of everyone else again.',
    skills: { deception: [20, 2], tracking: [20, 2], pathfinding: [20, 2], awareness: [20, 2], social: [20, 1], cqc: [20, 2], weapons: [20, 2], fitness: [20, 1] } },
  { id: 'berlin', age: [66, 68], names: { f: ['Ingrid Bauer', 'Helen Roth'], m: ['Karl Bauer', 'Frank Roth'] }, langs: { de: 'native', ru: 'fluent' },
    text: 'On the streets of East Berlin from 1985, when the Moscow Rules were new, and the last of that generation still walking. Called out of a retirement in Maine because nobody else remembers how it\'s done with no phone in your pocket.',
    anew: 'Twenty years retired, and alone in the house since the spring. A year ago they\'d have said no.',
    skills: { pathfinding: [20, 3], tracking: [20, 3], deception: [20, 1], analysis: [20, 3], fitness: [5, 0], cqc: [8, 0], tech: [0, 0] } },
  { id: 'hostage', age: [58, 64], names: { f: ['Nora Haddad', 'Claire Aoun'], m: ['Elias Haddad', 'Thomas Aoun'] }, langs: { ar: 'fluent', fr: 'fluent' },
    text: 'Three years a hostage in the Bekaa, blindfolded, in the dark. Learned who was in the room from the floorboards, and who was looking from the back of the neck. It never went away, and nobody at Langley can explain it.',
    anew: 'Retired on medical grounds when they came home, with a pension and a therapist. Ten years on they walked into Langley and asked for their badge back, and nobody could think how to refuse.',
    skills: { awareness: [20, 3], pathfinding: [20, 2], deception: [15, 3], medicine: [10, 2], fitness: [8, 0], social: [8, 0] } },
  { id: 'meade', age: [50, 56], names: { f: ['Dana Whitcomb', 'Carol Pruitt'], m: ['Neil Whitcomb', 'Roy Pruitt'] }, langs: {},
    text: 'Subject 17 of the remote viewing programme at Fort Meade, closed in 1995 as useless. The file says the results were chance. Someone who read it didn\'t think so, and has kept them on the books ever since, on no budget anyone can find.',
    anew: 'Thirty years in a records office in Maryland, on a salary from somewhere. This autumn, whoever pays it decided to find out what it\'s been paying for.',
    skills: { awareness: [20, 3], tracking: [20, 3], deception: [10, 0], pathfinding: [10, 0], social: [5, 0], cqc: [0, 1], weapons: [0, 0] } },
  { id: 'naples', age: [38, 46], names: { f: ['Lucia Ferrante', 'Teresa Russo'], m: ['Marco Ferrante', 'Nino Russo'] }, langs: { it: 'native', es: 'working' },
    text: 'A pickpocket at nine in the Stazione Centrale in Naples, where you feel a policeman\'s eyes or you don\'t eat. The Agency found them at twenty-six, with the Rome station chief\'s wallet.',
    anew: 'Burned in Milan in 2019, their face in the Corriere under a headline about American spies. Six years at a desk at Langley while Italy forgot it, and Italy has.',
    skills: { deception: [20, 3], tracking: [15, 3], awareness: [20, 3], social: [20, 3], cqc: [12, 2], fitness: [20, 2], analysis: [5, 0] } },
  { id: 'a4', age: [47, 55], names: { f: ['Alison Reeve', 'Morag Dunn'], m: ['Colin Reeve', 'Ian Dunn'] }, langs: { en: 'native' },
    text: 'Twenty years with A4, MI5\'s watchers, of whom they were the one the others asked about. Seconded to Grosvenor Square for six months in 2019. Nobody has mentioned sending them back.',
    anew: 'Five let them go quietly last year, the paperwork lost on purpose. The Agency has made them one of its own, which means starting again from the start.',
    skills: { tracking: [20, 3], deception: [20, 2], awareness: [20, 2], pathfinding: [15, 1], social: [8, 0], weapons: [5, 0] } },
  { id: 'tehran', age: [44, 52], names: { f: ['Sara Vance', 'Leila Cross'], m: ['David Vance', 'Adam Cross'] }, langs: { fa: 'fluent', ar: 'working' },
    text: 'Burned in Tehran in 2014, and walked out over the mountains alone in midwinter with the whole of the ministry behind them. Nobody else has done it. Nobody asks how.',
    anew: 'Ten years on a desk at Langley while Tehran forgot the face. The dust has settled; they asked for the street again, and this time got it.',
    skills: { pathfinding: [20, 3], deception: [20, 2], fitness: [20, 3], cqc: [20, 3], medicine: [10, 1], social: [8, 1] } },
  { id: 'brat', age: [36, 44], names: { f: ['Isabel Thorne', 'Katya Ames'], m: ['Julian Thorne', 'Alex Ames'] }, langs: { ru: 'fluent', ar: 'working', fr: 'fluent', es: 'working' },
    text: 'A diplomat\'s child, raised in embassies from Minsk to Damascus, whose mother taught them at six that the man at this kiosk was at the last kiosk too. Was reading streets before reading books.',
    anew: 'Left at thirty for a private firm in Mayfair at five times the pay, and lasted three years of it. Came back in through the front door, which means starting again.',
    skills: { social: [20, 3], deception: [20, 2], awareness: [20, 3], tracking: [15, 2], analysis: [12, 1], cqc: [5, 1] } },
  { id: 'deaf', age: [46, 54], names: { f: ['Ellen Sayer', 'Priya Nair'], m: ['Owen Sayer', 'Arjun Nair'] }, langs: { hi: 'fluent', ar: 'working' },
    text: 'Deaf since a car bomb in Peshawar in 2009. Reads lips at forty metres, and a street by how the people in it move round what they\'re avoiding. The Agency tried to pension them off, once.',
    anew: 'They took the pension in the end, and spent eight years learning to read lips in three more languages. Then they came back with a lawyer, and won.',
    skills: { awareness: [20, 3], tracking: [20, 3], social: [20, 2], analysis: [20, 1], pathfinding: [15, 3] } },
  { id: 'chess', age: [41, 48], names: { f: ['Nino Abashidze', 'Tamar Gelashvili'], m: ['Levan Abashidze', 'Giorgi Gelashvili'] }, langs: { ru: 'native', en: 'fluent' },
    text: 'A Soviet Georgian chess prodigy who left at seventeen and never played again. Reads a street as a board, thirty moves on, and has never yet been surprised by which way someone turned.',
    anew: 'Ten years an analyst at Langley, reading other people\'s streets off the cables. Asked to walk them instead, and was told it meant starting again. They said every game does.',
    skills: { analysis: [20, 3], pathfinding: [20, 3], tracking: [20, 1], deception: [15, 1], fitness: [5, 1], cqc: [0, 2], weapons: [0, 0] } },
];

/** A legend's file: someone of Tradecraft 95, with their reason (LEGENDS), in the picker beside the career's own. n: another for the same seed. */
export function legendFile(seed, city = 'moscow', level = 'handler', n = 0) {
  const r = stream('legend', seed, city, level, n), L = LEGENDS[(int(stream('legend', seed), LEGENDS.length) + n * 5) % LEGENDS.length], sex = chance(r, 0.5) ? 'f' : 'm', lang = cityById(city).lang;   // (another file, another reason: every one of them before any twice)
  const age = L.age[0] + int(r, L.age[1] - L.age[0] + 1), name = pick(r, L.names[sex]);
  const langs = { en: 'native', [lang]: 'fluent', ...L.langs };
  const skills = structuredClone({ ...DEFAULT_LEGEND, ...L.skills });
  armedFloor(skills);
  const p = sheet({ id: 'me', name, sex, cls: 'spook', os: 95, skills, langs, persistent: true });
  p.age = age;
  p.background = L.text;
  p.anew = L.anew;                                                  // (why they're starting again: the picker's file, and Hale knows it: sim/hale.js)
  p.legend = L.id;
  const grey = age >= 50 && chance(r, 0.6);
  p.look = { skin: pick(r, ['light', 'light', 'tan', 'brown', 'dark']), hair: { style: sex === 'f' ? pick(r, ['bun', 'long', 'bob', 'short']) : pick(r, age >= 45 ? ['short', 'bald', 'side', 'crew'] : ['short', 'side', 'crew']), color: grey ? pick(r, [0x8f96a6, 0xdfe2e8]) : pick(r, [0x2a1c18, 0x47302a, 0x6b4636, 0x14151c]) },
    top: { kind: pick(r, ['coat', 'coat', 'jacket', 'suit']), color: pick(r, [0x353947, 0x4c5262, 0x47302a, 0x23252f, 0x6a7182]), trim: 0x23252f }, legs: 0x23252f, shoes: 0x14151c, ...(chance(r, 0.3) ? { glasses: 'specs' } : {}) };
  return p;
}

/** Three officers to pick from, from the campaign's seed, at a level (LEVELS: a junior's younger, two points under on the street). */
export function candidates(seed, city = 'moscow', level = 'handler') {
  const r = level === 'handler' ? stream('candidates', seed) : stream('candidates', seed, level), used = new Set(), junior = level === 'junior', core = junior ? 8 : 10;
  return [0, 1, 2].map(i => {
    const sex = i === 0 ? 'f' : i === 1 ? 'm' : chance(r, 0.5) ? 'f' : 'm';
    let bg; do bg = pick(r, BACKGROUNDS); while (used.has(bg.id)); used.add(bg.id);
    const age = junior ? 24 + int(r, 6) : 29 + int(r, 14);
    const base = { deception: [core, int(r, 3)], tracking: [core, int(r, 3)], pathfinding: [core, int(r, 3)], awareness: [core, int(r, 3)], social: [core, int(r, 3)],
      analysis: [5, int(r, 3)], tech: [5, int(r, 2)], medicine: [5, 0], cqc: [5, 1 + int(r, 2)], weapons: [5, int(r, 2)], fitness: [5, 1 + int(r, 3)] };
    const points = Object.fromEntries(Object.entries(bg.skills).map(([k, v]) => [k, Math.min(BG_MAX, v)]));
    for (const [k, v] of Object.entries(points)) base[k] = [base[k][0], Math.min(9, base[k][1] + v)];
    const K = cityById(city), lang = K.lang, learn = K.station.learn;   // (a junior where the English will do has a little of what the station wants learnt: London's Russian)
    const p = sheet({ id: 'me', name: `${pick(r, US[sex])} ${pick(r, US.family)}`, sex, cls: 'spook', os: junior ? 17 + int(r, 7) : 35 + int(r, 10), skills: base,   // (a beginner's Tradecraft round 20, an officer's round 40: the user, 2026-11-03; sim/xp.js)
      langs: { en: 'native', ...(lang !== 'en' ? { [lang]: pick(r, ['working', 'working', 'fluent']) } : junior && learn ? { [learn]: pick(r, ['basic', 'basic', 'working']) } : {}) }, persistent: true });
    p.age = age;
    p.background = bg.text;
    p.bg = { id: bg.id, points };                                   // (of the dots, these are the background's: the sheet shows them apart)
    p.look = { skin: pick(r, ['light', 'light', 'tan', 'brown']), hair: { style: sex === 'f' ? pick(r, ['bun', 'long']) : chance(r, age > 38 ? 0.25 : 0.05) ? 'bald' : 'short', color: pick(r, [0x2a1c18, 0x47302a, 0x6b4636, 0x14151c, 0xb9862e]) },
      top: { kind: 'coat', color: pick(r, [0x353947, 0x4c5262, 0x47302a, 0x23252f]), trim: 0x23252f }, legs: 0x23252f, shoes: 0x14151c };
    return p;
  });
}

/**
 * The posting: city, cover, goal, the network and the targets, the flat, the embassy, safe houses, gauges.
 * startMs: day one, morning. level: a Handler's (this), or a first tour's (juniorPosting(): at FIRST_TOUR_CITY, London).
 */
export function posting(seed, city = 'moscow', startMs = at(2026, 11, 2, WAKE_H), level = 'handler') {
  if (level === 'junior') return juniorPosting(seed, startMs);
  const r = stream('posting', seed, city), K = cityById(city), C = K.station;
  const [subject, goal] = pick(r, C.subjects);
  const mapSeed = Math.floor(range(r, 0, 4294967296));
  const names = CODENAMES.slice();
  const assets = [0, 1].slice(0, 1 + (chance(r, 0.5) ? 1 : 0)).map(i => {
    const codename = names.splice(int(r, names.length), 1)[0], sex = chance(r, 0.35) ? 'm' : 'm';   // (men for now: the scenes' words say he of an asset)
    return { id: `asset${i}`, codename, sex, role: pick(r, ROLES), motive: pick(r, MOTIVES), trust: 2 + int(r, 2), yield: 1, look: streetLook(r, sex, 35 + int(r, 25)), met: 0, last: null };
  });
  const targets = [{ id: 'target0', name: pick(r, ['Gennady Orlov', 'Viktor Lazarev', 'Oleg Sorokin', 'Pavel Rudnev']), what: `an officer of ${C.opposition.the}, under commercial cover`, wary: chance(r, 0.3), followed: 0, last: null, contact: null }];
  // (who they are, of the city's: sim/dossier.js; drawn from streams of their own, so nothing else here moves)
  const nr = stream('posting-names', seed, city);
  for (const t of targets) Object.assign(t, { name: targetName(nr, city), wary: false });
  for (const s of assets) s.role = pick(nr, assetRolesOf(city));
  return {
    city: K.id, country: K.country, agency: 'CIA', rank: 'Handler', level: 'handler', job: C.cover, legend: 'embassy', subject, goal,
    // (the embassy on the street the missions start from, "out of the embassy"; the flat a few streets off)
    mapSeed, home: { id: 'home', row: 2 + int(r, 2), label: 'the flat' }, embassy: { id: 'embassy', row: 0, label: C.embassy },
    safehouses: [{ id: 'sh0', row: 1 + int(r, 2), label: 'a flat above a pharmacy', known: true, burned: false }, { id: 'sh1', row: -3 - int(r, 2), label: 'a garage in a courtyard', known: true, burned: false }],
    assets, targets, startMs,
    heat: 20, cover: 70, intelligence: 0, money: { salary: SALARY, fund: FUND, paid: calendar(startMs).month, bank: SALARY },   // (the first month's salary in the account on arrival)
  };
}

/**
 * A first tour, at the station that has one (FIRST_TOUR_CITY; its firstTour, sim/cities/): Station London,
 * under cover in the embassy's Office of the Legal Attaché (the FBI's people, for whom you're the
 * station's liaison with MI5); no network of your own; two of the residency's officers to follow and
 * photograph with MI5's watchers, and two team trips abroad (TRIPS), a week or so apart, each on its own day.
 */
function juniorPosting(seed, startMs) {
  const r = stream('posting', seed, 'junior'), K = cityById(FIRST_TOUR_CITY), C = K.station, F = C.firstTour, day0 = dayOf(startMs);
  const mapSeed = Math.floor(range(r, 0, 4294967296)), names = F.names.slice();
  const nr = stream('posting-names', seed, 'junior');
  const targets = [0, 1].map(i => ({ id: `target${i}`, name: (names.splice(int(r, names.length), 1)[0], targetName(nr, K.id)), what: F.what, wary: false, followed: 0, last: null, contact: null }));
  const order = TRIPS.slice();
  const trips = [0, 1].map(i => {
    const T = order.splice(int(r, order.length), 1)[0];
    const trip = { id: `trip${i}`, city: T.city, kind: T.kind, station: T.station, why: T.why, day: day0 + (i ? 15 + int(r, 4) : 6 + int(r, 3)), mapSeed: Math.floor(range(r, 0, 4294967296)), planned: false };
    if (T.kind === 'sdr') trip.asset = { codename: pick(r, CODENAMES), sex: 'm', role: pick(r, ROLES), look: streetLook(r, 'm', 35 + int(r, 25)) };
    else trip.target = { id: `trip${i}-target`, name: (pick(r, T.names), targetName(nr, T.city)), what: T.what };
    return trip;
  });
  return {
    city: K.id, country: K.country, agency: 'CIA', rank: 'Junior officer', level: 'junior', job: F.job, legend: 'embassy',
    subject: F.subject, goal: F.goal,
    mapSeed, home: { id: 'home', row: 2 + int(r, 2), label: 'the flat' }, embassy: { id: 'embassy', row: 0, label: C.embassy },
    safehouses: [{ id: 'sh0', row: 1 + int(r, 2), label: F.safehouse, known: true, burned: false }],
    assets: [], targets, trips, startMs,
    heat: 20, cover: 70, intelligence: 0, money: { salary: SALARY_JUNIOR, fund: 0, paid: calendar(startMs).month, bank: SALARY_JUNIOR },
  };
}
export const SALARY_JUNIOR = 5400;                                 // ($ a month, after tax: a GS-10)
export const goalOf = (p) => (p.level === 'junior' ? GOAL_JUNIOR : GOAL_INTEL);

/** A new campaign: the chosen character, the posting (at a level: LEVELS), day one. */
export function newCampaign(seed, character, city = 'moscow', level = 'handler', startMs = undefined) {
  const p = posting(seed, city, startMs, level);
  const c = { seed, character, posting: p, day: dayOf(p.startMs), assignments: [], done: [], plannedTo: dayOf(p.startMs) - 1, worked: {}, log: [], reviews: [], awake: p.startMs, next: { },
    calls: [{ id: 'hale', at: p.startMs + CALL_S * 1000 }], cabinet: { ...CABINET } };   // (day one: Hale on the telephone, the exercises or straight in: src/main.js; the bathroom cabinet's few things, sim/medicine.js)
  born(character, p.startMs);                                      // (their birth, from the file's age: the years go by, sim/career.js)
  for (const t of p.targets) fileOf(c, t);                         // (the station's files on them: sim/dossier.js)
  for (const s of p.assets) assetFile(c, s);
  plan(c, p.startMs);
  return c;
}

// (no gun of the station's, in the drawer or anywhere: the user, 2026-11-03, "don't give a firearm to officers by
// default, firearms need to be rare and illegal in most places, acquiring one should be a whole thing"; DESIGN.md,
// Firearms: the law, the black market)

export const CALL_S = 12;                                          // (day one: the telephone rings this long after you wake)
export const dayOf = (ms) => Math.floor(ms / DAY);
const weekday = (ms) => calendar(ms).weekday;                      // 0 Monday … 6 Sunday
const isWorkday = (ms) => weekday(ms) < 5;

/**
 * Plan the assignments through the day of `ms` and the six after (a week ahead, as a schedule is):
 * for each asset a meeting every CADENCE.sdr days, for each target a tail every CADENCE.tail, each on an
 * evening (after work) or a weekend afternoon, never two at once, never in the past.
 */
export function plan(c, ms) {
  const p = c.posting, to = dayOf(ms) + 6;
  for (let d = c.plannedTo + 1; d <= to; d++) {
    const r = stream('plan', c.seed, d), dayMs = d * DAY;
    const busy = (from, until) => c.assignments.some(a => a.status === 'open' && a.from < until && a.to > from);
    const slot = (h0, h1) => { for (let k = 0; k < 8; k++) { const from = dayMs + Math.round(range(r, h0, h1) * 60) * MIN; if (!busy(from - 30 * MIN, from + 3 * HOUR)) return from; } return null; };
    const evening = isWorkday(dayMs) ? [18.5, 20.5] : [14, 19];
    const taken = () => c.assignments.some(a => dayOf(a.from) === d);   // (one a day: two meetings in an evening is how networks get rolled up)
    for (const s of p.assets) {
      const due = (s.nextDay ??= dayOf(p.startMs) + 1 + int(r, 2));
      if (d < due) continue;
      if (taken()) { s.nextDay = d + 1; continue; }
      const from = slot(...evening);
      if (from === null) { s.nextDay = d + 1; continue; }
      c.assignments.push({ id: `a${hash(c.seed, d, s.id) % 1e7}`, kind: 'sdr', who: s.id, from, to: from + 15 * MIN, start: from - Math.round(range(r, 25, 40)) * MIN, status: 'open',
        brief: `Meet ${s.codename} (${s.role}) on a boulevard bench, between ${hm(from)} and ${hm(from + 15 * MIN)}. Clean, or not at all.` });
      s.nextDay = d + CADENCE.sdr[0] + int(r, CADENCE.sdr[1] - CADENCE.sdr[0] + 1);
    }
    for (const t of p.targets) {
      const due = (t.nextDay ??= dayOf(p.startMs) + 2 + int(r, 3));
      if (d < due) continue;
      if (taken()) { t.nextDay = d + 1; continue; }
      const from = slot(...(isWorkday(dayMs) ? [17.5, 19.5] : [15, 18]));
      if (from === null) { t.nextDay = d + 1; continue; }
      c.assignments.push({ id: `a${hash(c.seed, d, t.id) % 1e7}`, kind: 'tail', who: t.id, from, to: from + 20 * MIN, start: from, status: 'open',
        brief: `${t.name}, ${t.what}, leaves his office at ${hm(from)}. Follow him to whoever he meets. Don't be seen.` });
      t.nextDay = d + CADENCE.tail[0] + int(r, CADENCE.tail[1] - CADENCE.tail[0] + 1);
    }
    // (a first tour's trips: on their day, or the next free one; the evening there, flown out that morning)
    for (const t of p.trips ?? []) {
      if (t.planned || d < t.day) continue;
      if (taken()) { t.day = d + 1; continue; }
      const from = slot(...(isWorkday(dayMs) ? [18.5, 20.5] : [15, 19]));
      if (from === null) { t.day = d + 1; continue; }
      const len = t.kind === 'tail' ? 20 : 15, place = cityById(t.city).name;
      c.assignments.push({ id: `a${hash(c.seed, d, t.id) % 1e7}`, kind: t.kind, who: t.id, trip: t.city, from, to: from + len * MIN, start: t.kind === 'sdr' ? from - 30 * MIN : t.kind === 'watch' ? from - 10 * MIN : from, status: 'open',
        brief: t.kind === 'sdr' ? `${place}, with the ${t.station}'s team, flown out that morning. Meet ${t.asset.codename} (${t.asset.role}) on a boulevard bench between ${hm(from)} and ${hm(from + len * MIN)}, for the station: ${t.why}. Clean, or not at all.`
          : t.kind === 'watch' ? `${place}, with the ${t.station}'s team, flown out that morning. ${t.target.name}, ${t.target.what}, meets someone outside a café between ${hm(from)} and ${hm(from + len * MIN)}. A photograph of the two of them: ${t.why}.`
          : `${place}, with the ${t.station}'s team, flown out that morning. ${t.target.name}, ${t.target.what}, leaves his office at ${hm(from)}. Follow him to whoever he meets: ${t.why}.` });
      t.planned = true;
    }
    // (a target seen meeting someone: the station knows where he meets now, and wants the photograph)
    for (const t of p.targets) {
      if (!t.contact || d < (t.photoDay ??= d + 2 + int(r, 2))) continue;
      if (taken()) { t.photoDay = d + 1; continue; }
      const from = slot(...(isWorkday(dayMs) ? [12.5, 14] : [13, 17]));
      if (from === null) { t.photoDay = d + 1; continue; }
      c.assignments.push({ id: `a${hash(c.seed, d, t.id, 'photo') % 1e7}`, kind: 'watch', who: t.id, from, to: from + 15 * MIN, start: from - 10 * MIN, status: 'open',
        brief: `${t.name} meets someone outside a café, between ${hm(from)} and ${hm(from + 15 * MIN)}. A photograph of the two of them; his minder mustn't see you take it.` });
      t.photoDay = d + CADENCE.watch[0] + int(r, CADENCE.watch[1] - CADENCE.watch[0] + 1);
    }
  }
  c.plannedTo = Math.max(c.plannedTo, to);
  c.assignments.sort((a, b) => a.from - b.from);
}

// (a lesson at game time from: its window as its scene's kind would have it)
function lessonAt(c, L, from) {
  const a = { id: `l${hash(c.seed, L.id, from) % 1e7}`, kind: 'lesson', lesson: L.id, who: null, from, status: 'open' };
  if (L.scene === 'sdr') Object.assign(a, { to: from + 15 * MIN, start: from - 30 * MIN });
  else if (L.scene === 'watch') Object.assign(a, { to: from + 15 * MIN, start: from - 10 * MIN });
  else Object.assign(a, { to: from + 20 * MIN, start: from });
  a.brief = `Hale's exercise: ${L.title.toLowerCase()}, at ${hm(from)}. The station's own people play the parts; Hale's in your ear.`;
  return a;
}
// (whether a lesson at a has room: nothing open within LESSON_GAP_H of it, no other lesson that day)
const roomFor = (c, a) => !c.assignments.some(x => x.status === 'open' && ((x.kind === 'lesson' && dayOf(x.from) === dayOf(a.from)) || (x.start < a.to + LESSON_GAP_H * HOUR && x.to > a.start - LESSON_GAP_H * HOUR)));

/**
 * Book Hale's lessons (ids, in order) from game time ms. settling: the first call's, the days before the desk (one a day
 * from tomorrow at its own hour; the desk from the day after the last; the work planned after it). Otherwise the first
 * free slot from tomorrow: a working day's evening after the desk, or a day off at its own hour, the morning or the
 * afternoon. Returns the assignments booked.
 */
export function bookLessons(c, ids, ms, settling = false) {
  const p = c.posting, today = dayOf(ms), out = [];
  if (settling) {                                                   // (the work moved after the lessons: what was planned from tomorrow, planned again)
    for (const a of c.assignments) if (a.status === 'open' && a.kind !== 'lesson' && dayOf(a.from) > today) a.status = 'unplanned';
    c.assignments = c.assignments.filter(a => a.status !== 'unplanned');
    for (const t of p.trips ?? []) if (t.planned && !c.assignments.some(a => a.trip && a.who === t.id)) t.planned = false;
  }
  let d = settling ? Math.max(today + 1, ...c.assignments.filter(a => a.kind === 'lesson' && a.status === 'open').map(a => dayOf(a.from) + 1)) : today + 1;
  for (const id of ids) {
    const L = lessonBook(id);
    if (!L || !lessonsLeft(c).some(x => x.id === id)) continue;
    for (let k = 0; k < 60; k++, d++) {
      const dayMs = d * DAY, hours = settling ? [L.h] : isWorkday(dayMs) ? [Math.max(L.h, WORK.to + 0.75), WORK.to + 1.5, WORK.to + 2.5] : [L.h, 10.5, 14, 17];
      const a = hours.map(h => lessonAt(c, L, dayMs + Math.round(h * 60) * MIN)).find(x => x.start > ms && roomFor(c, x));
      if (a) { c.assignments.push(a); out.push(a); d++; break; }
    }
  }
  if (settling && out.length) {
    const last = Math.max(...c.assignments.filter(a => a.kind === 'lesson' && a.status === 'open').map(a => dayOf(a.from)));
    p.deskFrom = last + 1;
    for (let k = today + 1; k < p.deskFrom; k++) c.worked[k] ??= 'settling';   // (nothing expected at the embassy: sim/campaign.js pass(), the hub's working day)
    for (const s of p.assets) s.nextDay = Math.max(s.nextDay ?? 0, p.deskFrom + hash(c.seed, s.id, 'desk') % 2);
    for (const t of p.targets) t.nextDay = Math.max(t.nextDay ?? 0, p.deskFrom + 1 + hash(c.seed, t.id, 'desk') % 3);
    for (const t of p.trips ?? []) if (!t.planned) t.day = Math.max(t.day, p.deskFrom);
    c.plannedTo = today;
    plan(c, ms);
  }
  c.assignments.sort((x, y) => x.from - y.from);
  return out;
}
const hm = (ms) => { const k = calendar(ms); return `${String(k.hour).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`; };

/** The open assignments at time ms: [{ a, state: 'later' | 'now' | 'missed' }]; the missed are marked (and cost), once. */
export function agenda(c, ms) {
  for (const a of c.assignments) if (a.status === 'open' && ms > a.to) miss(c, a);
  return c.assignments.filter(a => a.status === 'open').map(a => ({ a, when: ms < a.start ? 'later' : 'now' }));
}

/** An assignment missed: what it costs (an asset waited for nothing; a target's evening gone unseen). */
function miss(c, a) {
  a.status = 'missed';
  const p = c.posting;
  if (a.kind === 'sdr' && !a.trip) { const s = p.assets.find(x => x.id === a.who); if (s) s.trust = Math.max(-5, s.trust - 1); }
  if (a.trip) { p.cover = Math.max(0, p.cover - COVER_MISSED); c.log.push({ ms: a.to, text: `Missed: the ${cityById(a.trip).name} trip. The station there noticed, and so did yours.` }); c.done.push(a); return; }
  c.log.push({ ms: a.to, text: a.kind === 'lesson' ? `Missed: Hale's exercise, ${(lessonBook(a.lesson)?.title ?? 'the street').toLowerCase()}. He waited, and went home; ring him for another evening.` : a.kind === 'sdr' ? `Missed: ${who(c, a)} waited on the bench for nothing. Trust down.` : `Missed: ${who(c, a)}'s evening, unwatched.` });
  c.done.push(a);
}
/** Whom an assignment was about (an asset's codename, a target's name), or null (an asset arrested since: gone from the network). */
const nameOf = (c, a) => { if (a.kind === 'lesson') return 'Hale'; const T = a.trip && c.posting.trips?.find(t => t.id === a.who); return (T ? T.asset?.codename ?? T.target?.name : a.kind === 'sdr' ? c.posting.assets.find(x => x.id === a.who)?.codename : c.posting.targets.find(x => x.id === a.who)?.name) ?? null; };
const who = (c, a) => nameOf(c, a) ?? 'someone';

/**
 * Time passes in the campaign, from `from` to `to` (ms): the working days missed or worked (worked:
 * by work()), pay on the 1st, the week's review on Sunday night, the plan a week ahead, the missed
 * assignments. Returns the papers it made ([{ kind, title, lines }]).
 */
export function pass(c, from, to) {
  const p = c.posting, papers = [];
  for (let d = dayOf(from); d < dayOf(to); d++) {
    const dayMs = d * DAY;
    if (isWorkday(dayMs) && !c.worked[d] && d >= Math.max(dayOf(p.startMs), p.deskFrom ?? 0)) { p.cover = Math.max(0, p.cover - COVER_MISSED); c.log.push({ ms: dayMs + 18 * HOUR, text: 'A working day missed at the embassy. Someone noticed.' }); }
    const next = calendar((d + 1) * DAY);
    if (next.day === 1 && next.month !== p.money.paid) { p.money.paid = next.month; p.money.bank = (p.money.bank ?? 0) + p.money.salary; p.money.fundLeft = p.money.fund; papers.push({ kind: 'pay', title: 'PAY', lines: [`Salary in: $${p.money.salary}.`, `The operational fund topped up to $${p.money.fund}.`] }); }
    if (weekday(dayMs) === 6) papers.push(review(c, dayMs));
    p.heat = Math.max(20, p.heat - 1);                              // (a day goes by: the opposition's interest cools a little)
    if (p.police) p.police = Math.max(0, p.police - POLICE_COOL_DAY);   // (and the police's: sim/police.js)
    // (a safe house they saw you go into: the station hears by morning)
    for (const s of p.safehouses.filter(x => x.seen && !x.burned && x.seen < dayMs + DAY)) {
      s.burned = dayMs + DAY;
      papers.push({ kind: 'cable', title: 'CABLE: A SAFE HOUSE', lines: [`${s.label[0].toUpperCase()}${s.label.slice(1)} is blown: a car outside it since the day you used it, and a man on the stairs asking the neighbours.`, 'Don\'t go back. The station will find another, in time.'] });
      c.log.push({ ms: dayMs + DAY + 8 * HOUR, text: `${s.label}: blown.` });
    }
    // (a compromised asset may be taken; heat at the top, and you're out)
    const ar = stream('arrest', c.seed, d);
    for (const s of p.assets.filter(x => x.burned && !x.arrested)) if (chance(ar, ARREST_PER_DAY)) {
      s.arrested = dayMs; p.heat = Math.min(100, p.heat + 10);
      papers.push({ kind: 'news', title: `${s.codename}: ARRESTED`, lines: [`The evening news: ${s.role} detained on suspicion of espionage.`, `${s.codename} won't make the next signal, or any. Whoever followed you to the bench made sure of that.`, 'Heat up. The station will want to know how.'] });
      c.log.push({ ms: dayMs + 20 * HOUR, text: `${s.codename} arrested.` });
    }
    if (p.heat >= EXPEL_HEAT && !c.over) {
      c.over = { ms: dayMs + 11 * HOUR, why: 'expelled' };
      papers.push({ kind: 'over', title: 'PERSONA NON GRATA', lines: ['The Foreign Ministry summons the ambassador: you have forty-eight hours to leave the country.', 'Immunity keeps you out of a cell. It doesn\'t keep the posting. Whatever you built here, someone else will have to rebuild.'] });
    }
  }
  plan(c, to);
  agenda(c, to);
  c.posting.assets = p.assets.filter(s => !s.arrested);
  return papers;
}

// (out early for an assignment before six: the user, 2026-11-03, "the work day should automatically end soon enough and
// give us an excuse to leave for it"; what you tell the section, by the day)
// (who gives it, and how: the chief's assistant, who knows what you are, says it for the section, who don't: the user,
// 2026-11-03, "the exact texts you generate should roleplay the excuse the embassy senior staff who know who we are and
// why we have to get out early give us"). The excuse itself, and the line it's given in.
export const EXCUSES = ['your dentist', 'the reception at the Canadians\'', 'the plumber at your flat', 'the landlord, again', 'the ministry, the meeting about the visas'];
export const EXCUSE_LINES = [
  'The chief\'s assistant puts her head round the door: "Your dentist, don\'t forget. They won\'t hold it." Loud enough for the section.',
  'The chief\'s assistant, on the internal line, for the room to hear: "The reception at the Canadians\'. The car won\'t wait."',
  'The chief\'s assistant, passing your desk: "The plumber\'s at your flat at last. Go, before he gives up on you."',
  'The chief\'s assistant, for the room: "Your landlord\'s been on the phone again. Go and sort it out, please."',
  'The chief\'s assistant leaves a note on your keyboard, where the section can read it: the ministry, the meeting about the visas, the half hour.',
];
/**
 * The cover job: from ms to 18:00 (if it's a working day and before then), or to `end` if that's sooner (an
 * assignment to be off for: an excuse made). Cover standing by the share of the day worked. Returns the time after.
 */
export function work(c, ms, end = null) {
  const k = calendar(ms), d = dayOf(ms);
  if (!isWorkday(ms) || k.hour >= WORK.to) return ms;
  const six = d * DAY + WORK.to * HOUR, until = end !== null && end < six ? end : six, from = Math.max(ms, d * DAY + WORK.from * HOUR);
  if (until <= ms) return ms;
  c.worked[d] = true;
  const share = Math.max(0.3, Math.min(1, (until - from) / ((WORK.to - WORK.from) * HOUR)));
  c.posting.cover = Math.min(100, c.posting.cover + Math.round(COVER_PER_DAY * share));
  c.log.push({ ms: until, text: until < six ? `A day at the embassy, and out early: ${EXCUSES[d % EXCUSES.length]}, as the chief's assistant reminded you for the section's benefit.` : 'A day at the embassy: cables, a meeting about a meeting, the ambassador\'s mood.' });
  return until;
}

/** Sleep: to WAKE_H next morning (or this morning, before it). Fatigue gone. Returns the time after. */
export function rest(c, ms) {
  const d = dayOf(ms), k = calendar(ms);
  const until = (k.hour < WAKE_H ? d : d + 1) * DAY + WAKE_H * HOUR;
  c.awake = until;
  return until;
}

/** Lie low for a day: heat down. Returns the time after (the next morning). */
export function lieLow(c, ms, safe = false) {
  c.posting.heat = Math.max(20, c.posting.heat - Math.round(HEAT_LOW_PER_DAY * (safe ? SAFE_LOW_K : 1)));
  c.log.push({ ms, text: 'A day of nothing: the flat, the embassy canteen, a walk that goes nowhere. Let them get bored.' });
  return rest(c, ms + 12 * HOUR);
}

/** The posting's places one can go to: home, the embassy, the safe houses not burned. [{ id, row, label }]. */
export const places = (c) => [c.posting.home, c.posting.embassy, ...c.posting.safehouses.filter(s => !s.burned)];

/** How long getting from row a to row b takes (ms), and how it's done, in words. */
export function trip(a, b, rng) {
  const rows = Math.abs(a - b), min = TRAVEL.waitMin + rows * TRAVEL.perRowMin;
  const by = rows <= 1 ? 'foot' : rows <= 3 ? 'metro' : 'taxi';
  const how = { foot: 'on foot, the long way round', metro: 'two stops on the metro', taxi: 'a taxi, the driver silent for once' }[by];
  return { ms: min * MIN, how, by };
}

export const TIRED_H = 16;
export const EXHAUSTED_H = 20;
// Past exhausted, it keeps on (the user, 2026-11-03: "extreme fatigue (like from not sleeping for too long) should chip
// away at skill efficiency"): another point off every skill every WEAR_H hours more, at most WORN_MAX.
export const WEAR_H = 3, WORN_MAX = 12, RAGGED_H = 36, LOST_H = 48;
/** Hours awake since the last sleep, and what it costs every skill (DESIGN.md, Needs): { h, v, word }. */
export function fatigue(c, ms) {
  const h = (ms - (c.awake ?? ms)) / HOUR;
  const v = h > EXHAUSTED_H ? -Math.min(WORN_MAX, 3 + Math.floor((h - EXHAUSTED_H) / WEAR_H)) : h > TIRED_H ? -1 : 0;
  return { h, v, word: h > LOST_H ? 'seeing things for want of sleep' : h > RAGGED_H ? 'dead on your feet' : h > EXHAUSTED_H ? 'exhausted' : h > TIRED_H ? 'tired' : null };
}

/** The week's review: intelligence against expected, heat, cover standing, assets kept. */
export function review(c, dayMs) {
  const p = c.posting, week = c.done.filter(a => a.ended && a.ended > dayMs - 7 * DAY);
  const intel = week.reduce((n, a) => n + (a.intel ?? 0), 0), expected = 1;
  const grade = intel >= expected + 1 && p.heat < 40 ? 'Excellent' : intel >= expected && p.heat < 55 ? 'Good' : intel > 0 ? 'Adequate' : 'Poor';
  c.reviews.push({ ms: dayMs, grade, intel });
  return { kind: 'review', title: `THE WEEK: ${grade.toUpperCase()}`, lines: [`Intelligence: ${intel} (expected ${expected}).`, `Heat: ${heatWord(p.heat)}. Cover standing: ${p.cover}.`, p.assets.length ? `The network: ${p.assets.map(s => `${s.codename}, trust ${s.trust}`).join('; ')}.` : p.level === 'junior' ? 'The network: none of your own yet; a first tour runs nobody.' : 'The network: nobody left.'] };
}
export const heatWord = (h) => (h < 30 ? 'quiet' : h < 45 ? 'noticed' : h < 60 ? 'watched' : h < 75 ? 'hot' : 'burning');

/**
 * The context an assignment's scene is set up with (its setup(state, { campaign })): the character,
 * the city, the time, and the assignment's own: an asset's codename and look, the opposition's team
 * by the heat; a target's name and wariness.
 */
export function context(c, a) {
  const p = c.posting, r = stream('ctx', c.seed, a.id), T = a.trip ? p.trips.find(t => t.id === a.who) : null;
  // (a trip's in its own city, on its own streets; the opposition there knows you only as a visitor: TRIP_HEAT)
  const city = T?.city ?? p.city, heat = T ? TRIP_HEAT : p.heat;
  const ctx = { campaign: true, player: structuredClone(c.character), mapSeed: T?.mapSeed ?? p.mapSeed, startMs: a.start, assignment: a.id, city, country: cityById(city).country ?? p.country };
  // (walked to: its place on the posting's streets, and where you stood when you began: sim/places.js, sim/scenarios/campaign.js begin())
  if (!T && a.at) Object.assign(ctx, { at: a.at, me: a.me ?? null, startMs: a.began ?? a.start });
  ctx.brief = briefOf(c, a);                                       // (its words: sim/dossier.js)
  if (a.kind === 'sdr') {
    const s = T ? T.asset : p.assets.find(x => x.id === a.who);
    // (the heat says how hard they're on you: nobody, an overt pair, a covert team)
    // (still on you from your own hours when it began: them; sim/scenarios/campaign.js)
    const rolled = weighted(r, [['none', Math.max(1, 70 - heat)], ['overt', 20 + heat * 0.3], ['covert', Math.max(0, heat - 25)]]), team = (!T && a.tailedBy) || rolled;
    Object.assign(ctx, { asset: { codename: s.codename, look: s.look, sex: s.sex, role: s.role }, meetFrom: a.from, meetTo: a.to, team, heat });
  } else if (a.kind === 'lesson') {
    // (the station's people playing the parts: the scene's own cast, its own odds of a team; the heat the opposition's is no business of an exercise's)
    const L = lessonBook(a.lesson), rr = stream('lesson-team', c.seed, a.id), teams = { tailed: [['overt', 3], ['covert', 1.5], ['none', 1.5]], brush: [['none', 2], ['overt', 2], ['covert', 1]], drop: [['none', 2], ['overt', 2], ['covert', 1]] }[a.lesson];
    Object.assign(ctx, { lesson: a.lesson, heat: 20, meetFrom: a.from, meetTo: a.to, wary: false, made: false, brief: null });   // (no brief of ours: the scene's own, with Hale's framing, sim/tutorial/ briefFor())
    if (L?.scene === 'sdr') Object.assign(ctx, { team: teams ? weighted(rr, teams) : 'none', asset: { codename: 'SOLOVEY', role: 'Petrov of the station, playing an asset' } });
    if (a.lesson === 'tailing') ctx.target = { name: 'Piotr Lisowski', what: 'of the station\'s political section, playing the man you follow tonight' };
    if (a.lesson === 'blown') ctx.heat = 90;
  } else if (a.kind === 'tail' || a.kind === 'watch') {
    const t = fileOf(c, T ? T.target : p.targets.find(x => x.id === a.who), city);
    // (his file: his look, his craft (how careful: Pathfinding, Awareness, his way, his checks), the man he meets)
    const made = !T && (t.wary || t.followed > 2);                  // (he's seen someone on him before: jumpy since)
    Object.assign(ctx, { target: { name: t.name, what: t.what, look: t.look, craft: t.craft, contact: t.meets }, wary: made || CRAFT[t.craft].wary, made, heat, meetFrom: a.from, meetTo: a.to });
  }
  return ctx;
}
export const TRIP_HEAT = 35;
// (the core four back to what they were, in a debrief's words)
const keptLine = (names) => (!names.length ? null : `${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]}: a day of it for real, and ${names.length > 1 ? 'they\'re' : 'it\'s'} back to what ${names.length > 1 ? 'they were' : 'it was'}.`);

/** A lesson over: a little Tradecraft (LESSON_XP_K of its scene's), the core kept, nothing on the record; Hale's words are the result's (src/ui/ui.js). */
function foldLesson(c, a, sc, endMs, lines) {
  const L = lessonBook(a.lesson), xp = Math.round(missionXP({ kind: L?.scene ?? 'tail', outcome: a.known }) * LESSON_XP_K * 10) / 10;
  gain(c.character, xp);
  const ups = level(c.character), pr = progress(c.character);
  lines.push(`An exercise with Hale, ${(L?.title ?? 'the street').toLowerCase()}: the station's own people playing the parts, nothing on the record but what you learnt.`);
  lines.push(ups ? `Tradecraft ${pr.os}: you do this a little better now. (${xp} XP; ${pr.have} of ${pr.need} toward ${pr.os + 1}.)` : `${xp} XP from it: ${pr.words}.`);
  const kept = keptLine(fieldwork(c.character, endMs));
  if (kept) lines.push(kept);
  return { title: `HALE'S EXERCISE: ${(L?.title ?? 'the street').toUpperCase()}`, lines };
}

/** The odds the opposition's on you as you step out (heat, a city's id), and of a covert team when they are. */
export const watchedOdds = (heat, city) => (stationOf(city)?.watched ?? 0.6) * Math.max(0, Math.min(WATCHED_MAX, (heat - 10) / 60));
export const covertShare = (heat) => Math.max(0, Math.min(COVERT_MAX, (heat - 30) / 40));
/** Whether they're on you out of a door ('home', 'embassy', 'street') this hour: 'none', 'overt' or 'covert'. */
export function watched(c, door, ms, heat = c.posting.heat) {
  const r = stream('watched', c.seed, door, Math.floor(ms / HOUR));
  if (!chance(r, watchedOdds(heat, c.posting.city))) return 'none';
  return chance(r, covertShare(heat)) ? 'covert' : 'overt';
}                                       // (a visitor's heat in a trip's city: the opposition there has a file, and not much in it)

/**
 * An assignment's scene is over: its outcome (state.scenario.outcome) into the campaign: intelligence,
 * heat, an asset's trust, a target's wariness, the character's body (wounds, blood, what they carry),
 * the time. Returns a paper ({ title, lines }).
 */
export function fold(c, a, sc, player, endMs, heatNow) {
  const p = c.posting;
  a.status = 'done'; a.ended = endMs; a.outcome = sc.outcome;
  a.known = sc.outcome === 'made' && sc.madeSeen === false ? 'spooked' : sc.outcome;   // (as the officer knows it: made, but not seen made, is only "he was spooked"; the file says that: record())
  c.done.push(a);
  c.character = { ...structuredClone(player), id: 'me' };
  const lines = [];
  if (a.kind === 'lesson') return foldLesson(c, a, sc, endMs, lines);
  // (Tradecraft comes of doing it, slowly and slower as it climbs: the assignment's XP, by its kind, how it went, how hard and how risky; sim/xp.js)
  const T0 = a.trip ? p.trips?.find(t => t.id === a.who) : null, target = a.kind !== 'sdr' ? (T0?.target ?? p.targets.find(t => t.id === a.who)) : null;
  const xp = missionXP({ kind: a.kind, outcome: a.known, craft: target?.craft ?? null, team: a.kind === 'sdr' ? sc.team ?? 'none' : 'none',
    risk: cityById(T0?.city ?? p.city).station?.risk ?? 1, heat: heatNow ?? p.heat, trip: !!a.trip });
  gain(c.character, xp);
  const ups = level(c.character), pr = progress(c.character);
  lines.push(ups ? `Tradecraft ${pr.os}: you do this a little better now, and it shows on the street. (${xp} XP; ${pr.have} of ${pr.need} toward ${pr.os + 1}.)` : `${xp} XP from it: ${pr.words}.`);
  const kept = keptLine(fieldwork(c.character, endMs));             // (out on it, however it went: the craft's core kept up, sim/rust.js; assignments not gone to never fold)
  if (kept) lines.push(kept);
  if (a.trip) return foldTrip(c, a, sc, endMs, heatNow, lines);
  if (heatNow !== undefined) p.heat = Math.max(20, Math.min(100, heatNow));
  if (a.kind === 'sdr') {
    const s = p.assets.find(x => x.id === a.who);
    // (being tailed's endings, sim/scenarios/sdr.js: clean, burned, right, needless, missed)
    if (sc.outcome === 'clean') {
      a.intel = s.yield; p.intelligence += s.yield; s.trust = Math.min(5, s.trust + 1); s.met++;
      lines.push(`${s.codename} handed it over, and nobody saw: intelligence +${s.yield}. Trust up.`);
      if (s.trust >= TRUSTED && s.yield < 2) { s.yield = 2; lines.push(`${s.codename} trusts you now: from here on, more of what matters.`); }
    }
    else if (sc.outcome === 'burned') { a.intel = s.yield; p.intelligence += s.yield; s.trust = Math.max(-5, s.trust - 2); p.heat = Math.min(100, p.heat + 10); s.burned = true; lines.push(`You met ${s.codename} with a tail on you. The intelligence is yours (+${s.yield}); ${s.codename}'s face is theirs. Heat up; the asset is at risk.`); }
    else if (sc.outcome === 'right') lines.push(`You called it off, and you were right: they were on you. ${s.codename} is safe, and will wait for the next signal.`);
    else if (sc.outcome === 'needless') { s.trust = Math.max(-5, s.trust - 1); lines.push(`You called it off, and nobody was on you. ${s.codename} waited, and wonders why. Trust down.`); }
    else { s.trust = Math.max(-5, s.trust - 1); lines.push(`${s.codename} waited for nothing. Trust down.`); }
  } else if (a.kind === 'tail') {
    const t = p.targets.find(x => x.id === a.who);
    t.followed++;
    if (sc.outcome === 'seen') {
      a.intel = 1; p.intelligence += 1; t.contact = (t.contact ?? 0) + 1;
      lines.push(`You saw ${t.name} meet his contact: intelligence +1.`);
      // (a lead: the contact identified, a man to watch in his own right)
      if (!t.led && p.targets.length < 3) {
        const r = stream('lead', c.seed, a.id), name = targetName(r, p.city);
        // (the face the photograph showed: his look the contact's, sim/dossier.js)
        p.targets.push({ id: `target${p.targets.length}`, name, what: `the man ${t.name} met, by the photograph the station matched`, lead: t.id, look: t.meets?.look ? structuredClone(t.meets.look) : undefined, wary: false, followed: 0, last: null, contact: null, nextDay: Math.floor(endMs / DAY) + 2 });
        t.led = true;
        lines.push(`A lead: the station puts a name to the man he met, ${name}. He'll be worth an evening of your own.`);
      }
    }
    // (the tail's endings, sim/scenarios/tail.js: seen, lost, made, blown)
    else if (sc.outcome === 'made' || sc.outcome === 'blown') { t.wary = true; p.heat = Math.min(100, p.heat + (sc.outcome === 'blown' ? 12 : 6)); lines.push(`${t.name} made you. He'll be careful now, and someone will hear of it.`); }
    else lines.push(`${t.name} got away from you.`);
  } else if (a.kind === 'watch') {
    const t = p.targets.find(x => x.id === a.who);
    // (the photograph's endings, sim/scenarios/watch.js: photo, soft, seen, missed, blown)
    const intel = { photo: 2, soft: 1, seen: 1 }[sc.outcome] ?? 0;
    if (intel) { a.intel = intel; p.intelligence += intel; }
    if (sc.outcome === 'photo') lines.push(`A sharp print of ${t.name} and the man he met: intelligence +2. The station will put a name to the face.`);
    else if (sc.outcome === 'soft') lines.push(`A soft print, but it's ${t.name} and someone: intelligence +1.`);
    else if (sc.outcome === 'seen') lines.push(`No photograph, but you saw ${t.name}'s meeting: intelligence +1.`);
    else if (sc.outcome === 'blown') { t.wary = true; p.heat = Math.min(100, p.heat + 8); lines.push(`His minder made you. ${t.name} will meet somewhere else now, and someone will hear of a man with a camera.`); }
    else lines.push(`${t.name}'s meeting happened where you weren't looking.`);
  }
  goalMet(c, endMs, lines);
  plan(c, endMs);
  return { title: `${KINDS[a.kind].name.toUpperCase()}: ${outcomeWord(a.kind, a.known).toUpperCase()}`, lines };   // (its words: sim/outcomes.js)
}


/** The posting's goal met: done (a Handler's), or promoted (a first tour's: promote()). */
function goalMet(c, ms, lines) {
  const p = c.posting;
  if (p.intelligence < goalOf(p) || c.over) return;
  if (p.level === 'junior') { c.over = { ms, why: 'promoted' }; lines.push('That\'s a first tour done well. The chief\'s cable to Langley has the word "ready" in it.'); }
  else { c.over = { ms, why: 'completed' }; lines.push(`That's what the station needed on ${p.subject}. The cable home is a short one: done.`); }
}

/**
 * A trip's evening over (a first tour's: TRIPS): what it brought the station there, credited to you; a
 * cable about you if they made you; the flight home, and the flat in the tour's city (London) the morning
 * after (a.home), the days away worked.
 */
function foldTrip(c, a, sc, endMs, heatNow, lines) {
  const p = c.posting, T = p.trips.find(t => t.id === a.who), place = cityById(T.city).name, o = sc.outcome;
  const intel = { sdr: { clean: 2, burned: 1 }, tail: { seen: 2 }, watch: { photo: 2, soft: 1, seen: 1 } }[a.kind][o] ?? 0;
  if (intel) { a.intel = intel; p.intelligence += intel; }
  // (made there: their service files a face, and a cable says so; your own heat at home a little up)
  const made = (a.kind === 'sdr' && o === 'burned') || o === 'made' || o === 'blown';
  if (made || (heatNow ?? 0) > TRIP_HEAT + 15) p.heat = Math.min(100, p.heat + 5);
  lines.push(a.kind === 'sdr' ? (o === 'clean' ? `${T.asset.codename} handed it over, and nobody saw: the ${T.station} is grateful, and says so to yours. Intelligence +2.` : o === 'burned' ? `You met ${T.asset.codename} with a tail on you. The ${T.station} has his package, and a worry. Intelligence +1.` : o === 'right' ? `You called it off, and you were right: they were on you. ${T.asset.codename} will be met another month, by someone else.` : `${T.asset.codename} waited for nothing. The ${T.station} isn't pleased.`)
    : a.kind === 'tail' ? (o === 'seen' ? `You saw ${T.target.name} meet his contact: the ${T.station} has a name to chase. Intelligence +2.` : made ? `${T.target.name} made you. The ${T.station} will use someone else next time.` : `${T.target.name} got away from you.`)
    : (o === 'photo' ? `A sharp print of ${T.target.name} and the man he met: intelligence +2.` : o === 'soft' ? `A soft print, but it's ${T.target.name} and someone: intelligence +1.` : o === 'seen' ? `No photograph, but you saw the meeting: intelligence +1.` : made ? `His people made you. ${place} won't be sending for you again soon.` : `The meeting happened where you weren't looking.`));
  const home = (dayOf(endMs) + 1) * DAY + WAKE_H * HOUR;
  for (let d = dayOf(a.start); d < dayOf(home); d++) if (isWorkday(d * DAY)) c.worked[d] = true;
  a.home = home;
  lines.push(`The night flight back, and the flat in ${cityById(p.city).name} by ${WAKE_H} in the morning.`);
  goalMet(c, endMs, lines);
  plan(c, home);
  return { title: `${place.toUpperCase()}: ${outcomeWord(a.kind, o).toUpperCase()}`, lines };
}

/**
 * Promoted from a first tour: the same officer's posting of their own (a Handler's) at `city`, from
 * the Monday a fortnight on. Their sheet as the tour left it; a new seed for the posting.
 */
export function promote(c, city) {
  // (home leave, and the language school for as long as the station's language takes to working: sim/career.js; the
  // years go by, the officer ages, and the school's on the file)
  const end = c.over?.ms ?? c.now ?? c.posting.startMs, ch = { ...structuredClone(c.character), id: 'me' };
  born(ch, c.posting.startMs);
  const B = between(ch, city, 'official');
  if (B.langW) ch.langs = { ...(ch.langs ?? {}), [B.lang]: B.need };
  const from = dayOf(end) + B.weeks * 7, monday = from + ((7 - calendar(from * DAY).weekday) % 7);
  const next = newCampaign(hash(c.seed, 'promoted') % 1e9, ch, city, 'handler', monday * DAY + WAKE_H * HOUR);
  next.career = [...(c.career ?? []), { level: c.posting.level, city: c.posting.city, until: end },
    ...(B.langW ? [{ level: 'school', lang: B.lang, city: null, from: end + B.leaveW * 7 * DAY, until: monday * DAY }] : [])];
  next.posting.money.bank += c.posting.money.bank ?? 0;              // (the account goes with you: the new posting's first month on top)
  return next;
}

/**
 * The career as the personnel file has it (the character sheet, C: src/ui/ui.js; the user, 2026-11-03: "show more
 * information like character CV (including what is being written like current station and past stations, age
 * etc)"). Plain data at game time ms, for the sheet to word: the posting now (the rank, the station, the cover,
 * since when and the day of it, what the station wants and how much of it it has, the network, how it ended if it
 * has), the postings before it (c.career: a first tour, say), every assignment done or missed, oldest first, each
 * as the officer knows how it went (a.known: fold()), and the week's reviews.
 */
export function record(c, ms) {
  const p = c.posting;
  return {
    rank: p.rank, agency: p.agency, level: p.level, city: p.city, job: p.job, since: p.startMs, day: Math.max(1, dayOf(ms) - dayOf(p.startMs) + 1),
    subject: p.subject, intel: p.intelligence, goal: goalOf(p), network: p.assets.map(s => s.codename), over: c.over ? { why: c.over.why, ms: c.over.ms ?? null } : null,
    past: (c.career ?? []).map(k => ({ rank: k.level === 'school' ? `${LANG_NAME[k.lang] ?? 'A language'} at the Foreign Service Institute` : LEVELS[levelOf(k.level)].rank, city: k.city, until: k.until ?? null })),
    done: c.done.map(a => ({ ms: a.ended ?? a.to, kind: a.kind, who: nameOf(c, a), trip: a.trip ?? null, missed: a.status === 'missed', word: a.status === 'missed' ? 'missed' : outcomeWord(a.kind, a.known ?? a.outcome), intel: a.intel ?? 0 })),
    reviews: c.reviews.map(r => r.grade),
  };
}
