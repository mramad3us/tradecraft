// TRADECRAFT sim: Hale, and what people say about him (the user, 2026-10-27: "more flavor about Hale's
// background, hearsay about him/her having been deep under as an illegal superagent during the war, or
// some other last tier (maybe he/she was a tier 1 operator), make it make sense it's just flavor").
//
// One man, the same at the Farm (sim/scenarios/dojo.js, 2007, Hale at 46) and on the earpiece
// (sim/tutorial/): his look and first name come from his own stream (HALE_SEED), not the scene's dice.
// What the record says: an instructor at the Farm, defensive tactics and the street, these last years.
// What it doesn't, and the canteen does, never all of it at once and some of it wrong: the Army at
// eighteen; the Unit (Delta) by the mid-eighties, Grenada and things that weren't in the papers; the
// Agency in '87; the Cold War's last three years in Leningrad as a Finnish timber buyer, a Finnish
// passport and no diplomatic one, an illegal in all but name, out over the Finnish border in a timber
// lorry when it went wrong; among the first into Afghanistan in October 2001; a left hand that doesn't
// close all the way. He confirms none of it. Now and then, on the earpiece, something slips (ASIDES).
import { stream } from './rng.js';

export const HALE_SEED = 'hale';
/** His own dice: his look and his first name (people.js recruit()). */
export const haleStream = () => stream(HALE_SEED, 1961);

/** What they say about him: at the Farm, a classmate on the bench; at the station, the canteen. */
export const HEARSAY = [
  'They say Hale was in the Unit before the Agency. Delta. Ask him, and he\'ll tell you he was in logistics.',
  'Three years in Leningrad at the end of the Cold War, they say, as a Finnish timber buyer. No diplomatic passport. If they\'d caught him, nobody would have come for him.',
  'The KGB had a file on someone they called the Finn. Ten years of it, and never a photograph. Say \'the Finn\' at the instructors\' table and watch who doesn\'t look up.',
  'Hale was in the first team into Afghanistan, that October. Three million dollars in a cardboard box, someone\'s cousin says.',
  'Ask Hale about his hand and you get a story about a car door. It\'s a different car door every time.',
  'There\'s a star on the Memorial Wall at Langley that Hale stops at, every time he\'s in the building. Nobody asks whose.',
  'Watch where Hale sits in the canteen: back to the wall, the door in sight. Every time.',
  'Nobody\'s ever put Hale on the mat. Not in all the years he\'s taught at the Farm.',
  'Hale speaks Russian like a man from Vyborg and Finnish like a man from Helsinki. Where does a soldier pick that up?',
  'When it went wrong in Leningrad, they say, he came out over the Finnish border under a load of timber. In February.',
];

/** What slips out of him on the earpiece, once a lesson, when nothing else is going on. */
export const ASIDES = {
  tailing: '"Patience. I once sat on a man for eleven hours in a stairwell, in January, and he never came down. You\'ll manage an evening."',
  tailed: '"Walking with nowhere to be is the hardest thing there is to fake. I did it for three years. Never mind where."',
  watching: '"A window and patience. I had a whole winter of that once, over the Neva. Forget I said that."',
  brush: '"The best one I ever saw was in a revolving door. They both went round twice."',
  drop: '"A dead drop in snow is the worst kind: footprints. I learnt that the hard way. Write it down."',
  blown: '"I\'ve had this night. Once. The car was a timber lorry, and it was a long way to Finland. Move."',
  umbrella: '"Rain\'s a friend. Nobody looks up in it, nobody looks at anyone. Leningrad was all rain. Never mind."',
  range: '"I learnt on a Makarov, if you want to know. Not from the Army. Somebody\'s cellar, a long way east of here. Front sight."',
};

// Hale on the flat's telephone (src/main.js openCall(): day one, and called back). To an officer out of
// the Farm, the exercises before the real thing. To a file from the basement (sim/campaign.js LEGENDS;
// the user, 2026-11-03: "the phonecall from Hale should read very different if we decide to start as a
// 'new recruit' since we are not new to any of it at all"), he knows who he's talking to (KNOWS: one line
// for each reason, the hearsay's man showing a little of himself to someone who'd understand), says what
// the paper makes of them (a first tour or a posting, as if they were anyone), and offers the exercises
// as something they don't need.
export const KNOWS = {
  illegal: '"Twenty-two years. I did three on the other side with a passport nobody would have come for, and I still sit with my back to the wall. I won\'t pretend I\'ve anything to teach you."',
  defector: '"I\'ve spent fifteen years teaching from what you brought out of Vienna. Half of what I tell the young ones is yours, and they think it\'s mine. I\'ll not correct them if you don\'t."',
  farm: '"Sixteen years down the corridor from me at the Farm, and they\'ve put you on my list of new arrivals. Somebody in personnel thinks that\'s funny. So do I, a little."',
  berlin: '"Berlin, \'85. When they sent me east two years later, half of what they told me to do was yours. I thought you were a story they told us."',
  hostage: '"I\'ve read the file. I won\'t ask about it. If you ever want to say any of it out loud, I\'m a man who doesn\'t write things down."',
  meade: '"Yours is the only file I\'ve been told not to read, so I read it. Forty years at this, and I don\'t know what to make of it. I\'ll just watch, if you don\'t mind."',
  naples: '"The chief in Rome still tells the one about his wallet; it gets better every year. I\'ve moved mine to an inside pocket, for when we meet."',
  a4: '"Five\'s watchers. I spent a week in \'99 trying to lose your lot on the Northern line, for practice. I\'m told one of them was you. I\'m still annoyed."',
  tehran: '"Over the mountains, alone, in midwinter. I came out under a load of timber once, in February. I\'ve never told anyone that; you\'re the one person who\'d not be impressed."',
  brat: '"I knew your mother a little, in Minsk. She lost me in a department store once, and I was trying. She\'d be pleased you\'re back, and say so to nobody."',
  deaf: '"I\'ll keep it short; the operator types faster than I talk, but not by much. I was in Peshawar the week after. I\'ve wanted to meet you since."',
  chess: '"I play a little. Badly. I\'m told you don\'t play at all now, so I\'ll never find out how badly, which suits me."',
};

/**
 * Hale's call: { lines, choices } for the telephone (src/ui/ui.js showCall()). c: the campaign; city: its
 * city's name; first: day one's call (else called back).
 */
export function haleCall(c, city, first = true) {
  const me = c.character, p = c.posting, legend = me?.legend && KNOWS[me.legend] ? me.legend : null;
  // (booked, not played there and then: each an assignment of its own on the posting's streets, sim/campaign.js bookLessons();
  // the first call's before the desk starts, the station's days to settle in; a later one's in a free evening)
  const tutorial = { key: 'book', label: legend ? 'An evening or two anyway' : 'Book the exercises', about: `Hale's evenings, booked like any assignment: on the streets here, at their hours, him in your ear. ${first ? 'Before your desk starts: the station gives you the days to settle in.' : 'In a free evening, clear of the work.'}` };
  const begin = { key: 'begin', label: 'Straight in', about: 'The posting\'s brief, and on with it. Hale\'s number stays by the phone.' }, later = { key: 'later', label: 'Not now', about: 'Another time.' };
  const relay = me?.legend === 'deaf' ? ['The telephone\'s lamp flashes: the relay service, his words on its screen as he says them.'] : [];
  if (!first) return { lines: [...relay, '"Hale."', legend ? '"The exercises are still there, if you want an evening of them. I\'d enjoy watching, frankly."' : '"The exercises? Whenever you like. My door\'s open, and so\'s the street."'], choices: [tutorial, later] };
  if (!legend) return { lines: [
    `"Hale. Welcome to ${city}. You'll meet the station chief soon enough; I wanted to get to you first."`,
    '"The station gives you a few days to settle in before the desk. I\'d like them: the street work, an evening at a time, me in your ear and our own people playing the parts. Seven exercises, as many as you want. Or you go straight in and learn it on the job. Plenty did. Your call."',
  ], choices: [tutorial, begin] };
  const paper = p.level === 'junior'
    ? '"The paper says first tour, liaison with Five, as if you\'d come out of the Farm in the summer. It was the only way back onto the books: at the bottom, like everyone. Nobody at the station knows otherwise, and best keep it so."'
    : `"The paper says ${p.job.split(',')[0]} and a network to run, as anyone's posting would. The chief knows what you are. Nobody else at the station does, and best keep it so."`;
  return { lines: [...relay, `"Hale. Welcome to ${city}."`, KNOWS[legend], paper,
    '"There are exercises, the ones I give the new people: me in your ear, our own playing the parts. You don\'t need them. The streets have more cameras on them than they used to, though; if you want an evening or two to see them with someone at your back, before the desk, they\'re yours. Or straight in. I expect you will."',
  ], choices: [tutorial, begin] };
}
