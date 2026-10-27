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
};
