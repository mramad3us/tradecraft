// TRADECRAFT sim: people. Sheets, the three social gauges, and generated passers-by.
//
// A sheet is plain data: { id, name, sex, cls, os (over-skill 0–100), skills: { key: [base, practice] },
// langs: { code: level }, gauges: { fear, trust, affinity }, met (game time of the last contact),
// look (a sprite spec, src/art/sprites.js), persistent }. The player is a sheet too.
//
// The gauges are what this person feels toward us, each −5 … +5 (DESIGN.md, People): they move ±1
// for a notable exchange and ±2–3 for a big moment, and drift back toward 0 over weeks without
// contact: one step a week (my call), applied when time passes (drift()).
//
// Most people on a map are throwaway: passers-by generated from a seed of their own (passerby()),
// the same every time for that seed and city, never saved beyond the seed. Their sheets sit around
// 0–8. Their names, languages and dress are their city's (its profile's people: sim/cities/).
import { stream, int, pick, chance, weighted, next, hash } from './rng.js';
import { DAY } from './clock.js';
import { cityById } from './cities/index.js';

export const GAUGES = ['fear', 'trust', 'affinity'];
export const GAUGE_MAX = 5;
export const DRIFT_DAYS = 7;                                       // a gauge steps back toward 0 each week without contact

/** A sheet, with what's missing filled in. */
export function sheet({ id, name, sex = 'm', cls = 'civilian', os = 0, skills = {}, langs = {}, look = null, persistent = false, met = null }) {
  return { id, name, sex, cls, os, skills, langs, gauges: { fear: 0, trust: 0, affinity: 0 }, met, look, persistent };
}

/** Move a gauge by delta (clamped), at game time ms: contact resets the drift. Returns the new value. */
export function nudge(person, gauge, delta, ms) {
  const g = person.gauges;
  g[gauge] = Math.max(-GAUGE_MAX, Math.min(GAUGE_MAX, g[gauge] + delta));
  person.met = ms;
  return g[gauge];
}

/** Bring a person's gauges up to game time ms: a step toward 0 for each whole week since contact. */
export function drift(person, ms) {
  if (person.met === null) return;
  const weeks = Math.floor((ms - person.met) / (DRIFT_DAYS * DAY));
  if (weeks <= 0) return;
  for (const k of GAUGES) {
    const v = person.gauges[k];
    person.gauges[k] = Math.sign(v) * Math.max(0, Math.abs(v) - weeks);
  }
  person.met += weeks * DRIFT_DAYS * DAY;                          // what's left of a week carries on
}

// ---------- names (Moscow) ----------

const MALE = ['Aleksandr', 'Dmitri', 'Sergei', 'Andrei', 'Aleksei', 'Mikhail', 'Ivan', 'Nikolai', 'Vladimir', 'Yevgeni',
  'Pavel', 'Oleg', 'Igor', 'Maksim', 'Artyom', 'Viktor', 'Konstantin', 'Roman', 'Denis', 'Gleb', 'Timur', 'Ruslan', 'Boris', 'Yuri'];
const FEMALE = ['Yelena', 'Olga', 'Tatiana', 'Natalia', 'Irina', 'Svetlana', 'Anna', 'Maria', 'Yekaterina', 'Anastasia',
  'Yulia', 'Daria', 'Marina', 'Vera', 'Ksenia', 'Polina', 'Galina', 'Lyudmila', 'Alina', 'Sofia', 'Nadezhda', 'Zoya'];
// Surnames by their masculine form; the feminine adds -a (or -aya for -iy / -oy).
const SURNAMES = ['Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Vasiliev', 'Petrov', 'Sokolov', 'Mikhailov', 'Novikov', 'Fyodorov',
  'Morozov', 'Volkov', 'Alekseev', 'Lebedev', 'Semyonov', 'Yegorov', 'Pavlov', 'Kozlov', 'Stepanov', 'Nikolaev', 'Orlov',
  'Andreev', 'Makarov', 'Zakharov', 'Zaitsev', 'Solovyov', 'Borisov', 'Yakovlev', 'Grigoriev', 'Romanov', 'Vorobyov',
  'Sergeev', 'Frolov', 'Belov', 'Tarasov', 'Belousov', 'Komarov', 'Kiselyov', 'Gusev', 'Titov', 'Kuzmin', 'Kudryavtsev',
  'Baranov', 'Kulikov', 'Gromov', 'Polyakov', 'Sobolev', 'Davydov', 'Medvedev', 'Ershov', 'Nikitin', 'Bogdanov'];
const feminine = (s) => s.endsWith('iy') || s.endsWith('oy') ? s.slice(0, -2) + 'aya' : s + 'a';

/** A Russian name: [given, family]. */
export function russianName(r, sex) {
  const fam = pick(r, SURNAMES);
  return [pick(r, sex === 'f' ? FEMALE : MALE), sex === 'f' ? feminine(fam) : fam];
}

// ---------- looks: sprite specs a Moscow street would show (src/art/sprites.js) ----------

// Colours from the sprites' ramps (others shade flat). Autumn in Moscow: coats, dark and muted, a
// few bright scarves and hats.
const SKINS = [['light', 8], ['tan', 2], ['brown', 0.6], ['dark', 0.4]];
const HAIR = [0x14151c, 0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb9862e, 0x8f96a6, 0xdfe2e8];
const COATS = [0x353947, 0x4c5262, 0x23252f, 0x47302a, 0x6b4636, 0x8f6345, 0xd6ad7a, 0x24503a, 0x283f6b, 0x6e2a2e, 0x6a7182, 0x2f6b62, 0x4a2a52];
const BRIGHT = [0x9e3c36, 0xc95c45, 0xe7b84a, 0x3b6296, 0x5d8fc2, 0x7a4a86, 0x356f42, 0xf6f4ee];
const LEGS = [0x23252f, 0x353947, 0x283f6b, 0x1b2541, 0x47302a, 0x4c5262, 0x2a1c18];
const SHOES = [0x14151c, 0x2a1c18, 0x47302a, 0x23252f];

/**
 * The cut, finer: of the long and the short, some are a bob or a ponytail, a crew cut or a side part
 * (the user, 2026-10-27: "more haircuts"). From a hash of the look, no die cast, so who's about
 * doesn't change: only how their hair's cut. Women's and men's cuts stay apart.
 */
export function cutOf(style, sex, ...keys) {
  const v = hash('cut', style, sex, ...keys) % 100;
  if (sex === 'f' && style === 'long') return v < 22 ? 'bob' : v < 44 ? 'ponytail' : style;
  if (sex !== 'f' && style === 'short') return v < 25 ? 'crew' : v < 45 ? 'side' : style;
  return style;
}

/** A look for someone on the street. */
export function streetLook(r, sex, age = 40) {
  const grey = age > 55 && chance(r, 0.7);
  const hairColor = grey ? pick(r, [0x8f96a6, 0xdfe2e8, 0xb8bdc8]) : pick(r, HAIR.slice(0, 6));
  // (women's hair and men's never the same cut, so who's who reads at a glance: the user, 2026-10-26)
  const style = sex === 'f' ? weighted(r, [['long', 4], ['bun', 3]]) : weighted(r, [['short', 8], ['bald', age > 45 ? 2 : 0.3]]);
  const skin = weighted(r, SKINS);
  const look = { skin, hair: { style: cutOf(style, sex, hairColor, age, skin), color: hairColor } };
  const top = sex === 'f' ? weighted(r, [['coat', 6], ['sweater', 2], ['dress', 1.2], ['suit', 0.6]]) : weighted(r, [['coat', 6], ['sweater', 2], ['suit', 1.5], ['tee', 0.3]]);
  const color = top === 'coat' || top === 'suit' ? pick(r, COATS) : chance(r, 0.5) ? pick(r, BRIGHT) : pick(r, COATS);
  look.top = { kind: top, color };
  if (top === 'coat') { look.top.trim = pick(r, [0x23252f, 0x353947, 0x47302a]); if (chance(r, 0.5)) look.top.belt = look.top.trim; if (chance(r, 0.25)) look.top.tie = pick(r, BRIGHT); }
  if (top === 'suit') look.top.tie = pick(r, BRIGHT.slice(0, 7));
  if (top === 'sweater') look.top.trim = pick(r, [0xf6f4ee, 0xdfe2e8, ...BRIGHT]);
  if (top === 'dress') look.top.trim = pick(r, [0x23252f, 0x3f1a22, 0x1b2541]);
  look.legs = top === 'dress' ? pick(r, [0x23252f, 0x353947, 0xedc39c]) : pick(r, LEGS);
  look.shoes = pick(r, SHOES);
  const hat = weighted(r, [[null, 5], ['beanie', 3], ['cap', 0.8], ['fedora', sex === 'm' && age > 40 ? 0.8 : 0.1]]);
  if (hat) look.hat = { kind: hat, color: hat === 'beanie' ? pick(r, [...BRIGHT, ...COATS.slice(0, 6)]) : pick(r, COATS.slice(0, 8)) };
  if (hat === 'beanie') look.hat.band = pick(r, [0x173327, 0x23252f, 0x3f1a22, 0x1b2541]);
  if (sex === 'm' && chance(r, 0.18)) look.beard = hairColor; else if (sex === 'm' && chance(r, 0.12)) look.moustache = true;
  const glasses = weighted(r, [[null, 8], ['specs', age > 45 ? 3 : 1], ['shades', 0.4]]);
  if (glasses) look.glasses = glasses;
  const carry = weighted(r, [[null, 6], ['briefcase', top === 'suit' ? 4 : 0.7], ['paper', 0.6]]);
  if (carry) look.carry = carry;
  return look;
}

// Colours by name, for describing someone the way you'd remember them ("the woman in the beige coat").
const COLOUR_NAMES = {
  0x353947: 'charcoal', 0x4c5262: 'grey', 0x23252f: 'black', 0x47302a: 'brown', 0x6b4636: 'brown', 0x8f6345: 'tan', 0xd6ad7a: 'beige',
  0x24503a: 'green', 0x283f6b: 'navy', 0x6e2a2e: 'maroon', 0x6a7182: 'grey', 0x2f6b62: 'teal', 0x4a2a52: 'plum', 0x9e3c36: 'red',
  0xc95c45: 'rust', 0xe7b84a: 'yellow', 0x3b6296: 'blue', 0x5d8fc2: 'light blue', 0x7a4a86: 'purple', 0x356f42: 'green', 0xf6f4ee: 'white',
  0x8f96a6: 'pale grey',
};
const TOPS = { coat: 'coat', suit: 'suit', sweater: 'jumper', tee: 'T-shirt', dress: 'dress', jacket: 'jacket' };

/** How you'd remember someone by their look: "the man in the beige coat", "the woman in the red beanie". */
export function describe(look, sex = 'm') {
  const who = sex === 'f' ? 'woman' : 'man';
  const top = look?.top ? `${COLOUR_NAMES[look.top.color] ?? 'dark'} ${TOPS[look.top.kind] ?? 'coat'}` : 'coat';
  if (look?.hat && look.hat.kind !== 'fedora' && (look.hat.kind === 'beanie' ? (COLOUR_NAMES[look.hat.color] ?? '') !== (COLOUR_NAMES[look.top?.color] ?? '') : true)) {
    return `the ${who} in the ${COLOUR_NAMES[look.hat.color] ?? 'dark'} ${look.hat.kind}`;
  }
  return `the ${who} in the ${top}`;
}

/** A passer-by, the same every time for a seed (in a city: 'moscow' by default): a civilian sheet with a look. */
export function passerby(seed, city = 'moscow') {
  const r = stream('passerby', seed), P = cityById(city).people;
  const sex = chance(r, 0.52) ? 'f' : 'm';
  const age = 18 + int(r, 60);
  const skill = () => [int(r, 4) + (chance(r, 0.15) ? 5 : 0), int(r, 2)];
  const [given, family] = P.name(r, sex, age);
  const p = sheet({
    id: `x${seed}`, name: `${given} ${family}`, sex, cls: 'civilian',
    skills: { awareness: skill(), pathfinding: [int(r, 3), 0], social: skill(), fitness: skill() },
    langs: P.langs(r),
    look: P.look(r, sex, age),
  });
  // (how they'd do in a fight, 0–8: most never had a lesson; a stream of its own, so who they are doesn't change)
  const q = stream('passerby-cqc', seed);
  p.skills.cqc = [int(q, 4) + (chance(q, sex === 'm' ? 0.3 : 0.15) ? int(q, 5) : 0), 0];
  p.age = age;
  return p;
}

/** A number for seeding, from the sim's stream. */
export const seedFrom = (r) => Math.floor(next(r) * 4294967296);

// ---------- officers ----------

const US_MALE = ['Michael', 'David', 'James', 'Robert', 'Daniel', 'Thomas', 'Matthew', 'Andrew', 'Mark', 'Paul', 'Steven', 'Kevin', 'Brian', 'Eric', 'Jason', 'Ryan'];
const US_FEMALE = ['Sarah', 'Jennifer', 'Elizabeth', 'Rachel', 'Laura', 'Emily', 'Megan', 'Katherine', 'Rebecca', 'Amanda', 'Julia', 'Claire', 'Anne', 'Diane'];
const US_FAMILY = ['Walker', 'Hughes', 'Bennett', 'Collins', 'Foster', 'Reed', 'Morgan', 'Sullivan', 'Hayes', 'Parker', 'Brooks', 'Price', 'Ward', 'Ellis', 'Keller', 'Novak', 'Lindqvist', 'Moreau', 'Kowalski', 'Garrett'];

/**
 * The player as a given officer (a campaign's, playing one of Hale's lessons: the user, 2026-10-28, "we
 * don't even get to play our picked character"): a scene's own made person p, dressed as them before the
 * scene says a word (who they are: name, sex, age, look, skills, Tradecraft, background, languages; what
 * the scene gave them to carry stays the scene's). Without one, p as made.
 */
export const PLAYED = ['name', 'sex', 'age', 'look', 'skills', 'os', 'cls', 'bg', 'langs', 'background'];
export function asOfficer(p, character) {
  if (character) for (const k of PLAYED) if (character[k] !== undefined) p[k] = structuredClone(character[k]);
  return p;
}

/** A CIA officer at the rank of Handler (0.1.0's character): a spook with a mid-career Tradecraft. */
export function handler(r) {
  const sex = chance(r, 0.5) ? 'f' : 'm';
  const t = (base, practice) => [base, practice];
  const p = sheet({
    id: 'me', name: `${pick(r, sex === 'f' ? US_FEMALE : US_MALE)} ${pick(r, US_FAMILY)}`, sex, cls: 'spook', os: 35 + int(r, 11),
    skills: {
      deception: t(10, 1 + int(r, 3)), tracking: t(10, int(r, 3)), pathfinding: t(10, 1 + int(r, 3)), awareness: t(10, int(r, 3)),
      social: t(10, int(r, 3)), analysis: t(5, int(r, 3)), tech: t(5, int(r, 2)), medicine: t(5, 0),
      cqc: t(5, 1 + int(r, 2)), weapons: t(5, int(r, 2)), fitness: t(5, 1 + int(r, 3)),
    },
    langs: { en: 'native', ru: pick(r, ['working', 'fluent']) },
    persistent: true,
  });
  // Dressed not to be noticed: a dark coat, a plain bag, nothing that catches the eye.
  p.look = { skin: pick(r, ['light', 'light', 'tan']), hair: { style: sex === 'f' ? pick(r, ['bun', 'long']) : 'short', color: pick(r, [0x2a1c18, 0x47302a, 0x6b4636, 0x14151c]) },
    top: { kind: 'coat', color: pick(r, [0x353947, 0x4c5262, 0x47302a]), trim: 0x23252f, belt: 0x23252f }, legs: 0x23252f, shoes: 0x14151c };
  return p;
}

/**
 * Someone at the Farm, the agency's school (sim/scenarios/dojo.js): a trainee, or (instructor) one of
 * its teachers. In training clothes, a grey or navy sweatshirt; their CQC and over-skill as given.
 */
export function recruit(r, { id, cqc = [5, 1], os = 15, age = 24 + int(r, 6), instructor = false, sex = chance(r, 0.45) ? 'f' : 'm' }) {
  const t = (base, most) => [base, int(r, most + 1)];
  const p = sheet({
    id, name: `${pick(r, sex === 'f' ? US_FEMALE : US_MALE)} ${pick(r, US_FAMILY)}`, sex, cls: 'spook', os,
    skills: instructor
      ? { deception: t(10, 3), tracking: t(10, 3), pathfinding: t(10, 3), awareness: t(15, 3), social: t(10, 2), analysis: t(10, 2), tech: t(5, 1), medicine: t(10, 2), cqc, weapons: t(15, 3), fitness: [15, 3] }
      : { deception: t(5, 2), tracking: t(5, 1), pathfinding: t(5, 1), awareness: t(5, 2), social: t(5, 2), analysis: t(5, 2), tech: t(5, 1), medicine: t(5, 0), cqc, weapons: t(5, 2), fitness: [5, 1 + int(r, 3)] },
    langs: { en: 'native', ...(chance(r, 0.6) ? { [pick(r, ['ru', 'es', 'fr', 'de', 'ar', 'zh'])]: pick(r, ['basic', 'working']) } : {}) },
    persistent: true,
  });
  p.age = age;
  p.look = { skin: pick(r, ['light', 'light', 'tan', 'brown', 'dark']), hair: { style: sex === 'f' ? pick(r, ['bun', 'long']) : age > 40 && chance(r, 0.3) ? 'bald' : 'short', color: pick(r, [0x14151c, 0x2a1c18, 0x47302a, 0x6b4636, 0xb9862e]) },
    top: { kind: 'sweater', color: instructor ? 0x23252f : pick(r, [0x6a7182, 0x4c5262, 0x283f6b]), trim: instructor ? 0x9e3c36 : 0x8f96a6 }, legs: 0x23252f, shoes: 0xf6f4ee };
  return p;
}
