// TRADECRAFT sim: a community centre's clubs (the user, 2026-11-04: "since we got this rusty system we should add
// activities and clubs to work on each one (stuff like theater club etc)"). A centre is a shop of its kind ('culture':
// Moscow's House of Culture, London's community centre, Beirut's centre culturel, Cairo's Palace of Culture), and
// what's at its desk is its week (CLUBS): each club meets on its days at its hour, for its hours, a few dollars a
// time, and there's no going to it but then.
//
// **Its ways** (clubWays(), sim/shops.js ways()): every club, the one meeting now (from an hour before it starts to
// JOIN_LATE_M after: you wait for the start, then sit it out) open, the rest saying when they meet. **A session**
// (attend()): a session of practice in its skill, and half of one in its other (sim/rust.js practise(): two a month
// keep a skill from rusting), and its hours in the skill itself, up to an amateur's UP_TO (sim/training.js train());
// the walking club's and the dance class's also on your fitness (sim/fitness.js). It's the core of the craft that
// assignments keep (sim/rust.js fieldwork()); the clubs are for the rest, though a walk with a map or an afternoon
// with a camera do the core no harm.
import { calendar, WEEKDAYS, HOUR } from './clock.js';
import { train } from './training.js';
import { practise } from './rust.js';
import { exercise } from './fitness.js';
import { SKILLS } from './skills.js';

export const JOIN_LATE_M = 15, EARLY_H = 1, UP_TO = 12;
// (days: 0 Monday … 6 Sunday; at: the hour it starts, local; fit: its load on your fitness, sim/fitness.js points)
export const CLUBS = [
  { id: 'drama', name: 'the amateur dramatics', skill: 'deception', also: 'social', days: [1, 3], at: 19, hours: 2.5, usd: 6,
    words: 'A read-through, then the second act on its feet: a part that lies to everyone on the stage, played till the room believes it.' },
  { id: 'chess', name: 'the chess club', skill: 'analysis', days: [0, 4], at: 18.5, hours: 2.5, usd: 3,
    words: 'Three games against old men who saw your plan before you did, and a fourth you won by seeing theirs.' },
  { id: 'radio', name: 'the radio club', skill: 'tech', days: [2], at: 18, hours: 2.5, usd: 4,
    words: 'A soldering iron, a kit receiver on the bench, and the shortwave bands at the end of it: a voice from somewhere reading numbers.' },
  { id: 'firstaid', name: 'the first-aid course', skill: 'medicine', days: [1, 4], at: 18, hours: 2, usd: 10,
    words: 'A dummy on the floor, the recovery position, a tourniquet tied on a stranger\'s arm against the clock.' },
  { id: 'dance', name: 'the dance class', skill: 'social', fit: 5, days: [2, 5], at: 19.5, hours: 1.5, usd: 6,
    words: 'A new partner every song: small talk in three steps, and the trick of making a stranger feel they lead.' },
  { id: 'walkers', name: 'the walking club', skill: 'pathfinding', fit: 8, days: [5], at: 9, hours: 4, usd: 2,
    words: 'Twelve kilometres of the city with a map and a thermos: back ways, cut-throughs, a courtyard nobody else knows.' },
  { id: 'photo', name: 'the photography club', skill: 'awareness', also: 'tracking', days: [6], at: 10, hours: 3, usd: 4,
    words: 'A morning on the streets with a camera, the task a stranger: catch them, and never be seen catching them.' },
];
export const clubOf = (id) => CLUBS.find(c => c.id === id);

const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const daysText = (days) => (days.length === 1 ? `${WEEKDAYS[days[0]]}s` : `${days.slice(0, -1).map(d => `${WEEKDAYS[d]}s`).join(', ')} and ${WEEKDAYS[days.at(-1)]}s`);
const hoursText = (h) => (h === 1.5 ? 'an hour and a half' : h === 2 ? 'two hours' : h === 2.5 ? 'two and a half hours' : h === 3 ? 'three hours' : h === 4 ? 'four hours' : `${h} hours`);
/** When club c meets, in words: "Tuesdays and Thursdays at 19:00, two and a half hours". */
export const whenText = (c) => `${daysText(c.days)} at ${hhmm(c.at)}, ${hoursText(c.hours)}`;

/** The minutes till club c starts at game time ms, if it's meeting then (−JOIN_LATE_M … EARLY_H × 60: started a little, or about to), else null. */
export function meetsIn(c, ms) {
  const k = calendar(ms), now = k.hour + k.minute / 60;
  if (!c.days.includes(k.weekday)) return null;
  const m = Math.round((c.at - now) * 60);
  return m <= EARLY_H * 60 && m >= -JOIN_LATE_M ? m : null;
}

/** A centre's ways at its desk ({ id: 'club:<id>', label, off }), priced by price(usd). */
export function clubWays(ms, price) {
  return CLUBS.map(c => {
    const m = meetsIn(c, ms), what = `${c.name.charAt(0).toUpperCase() + c.name.slice(1)}: ${SKILLS[c.skill]?.name ?? c.skill}${c.also ? ` and ${SKILLS[c.also]?.name ?? c.also}` : ''}`;
    return { id: `club:${c.id}`, label: `${what} (${m === null ? whenText(c) : m > 0 ? `starts in ${m} min, ${hoursText(c.hours)}` : `started ${-m} min ago, ${hoursText(c.hours)}`}; ${price(c.usd)})`,
      off: m === null ? `it meets ${whenText(c)}` : null };
  });
}

/** How long a session of club c takes from game time ms, the wait for its start in it, in seconds (null if it isn't meeting). */
export function sessionS(c, ms) {
  const m = meetsIn(c, ms);
  return m === null ? null : Math.max(0, m) * 60 + Math.round(c.hours * HOUR / 1000) - Math.max(0, -m) * 60;
}

/** A session of club c sat through by p: its practice, its hours in its skill, its load on fitness. Its paper line. */
export function attend(state, bus, p, c) {
  practise(state, bus, p, c.skill, 1);
  if (c.also) practise(state, bus, p, c.also, 0.5);
  const g = train(p, c.skill, c.hours, UP_TO);
  if (c.fit) exercise(state, bus, p, c.fit);
  const name = SKILLS[c.skill]?.name ?? c.skill;
  return `${c.words} ${g.gained ? `${name} up a point, ${g.base}.` : g.toNext === null ? `There's no more ${c.name} can teach you, but it keeps your hand in.` : 'It keeps your hand in.'}`;
}
