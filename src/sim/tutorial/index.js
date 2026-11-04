// TRADECRAFT sim: the tutorial, its lessons in order (the user, 2026-10-27: "the test assignments … should
// be consolidated as tutorials … all grouped in a directory under a tutorial title"). On the title, a
// directory: the Farm's hand to hand first (sim/scenarios/dojo.js, Hale in the hall), then the street,
// each lesson a mechanic test's scene with Hale on the earpiece (sim/tutorial/earpiece.js) and a script
// of its own (sim/tutorial/*.js): { id, title, about, scenario, chapter, options (what the scene's
// setup reads, as `lesson`: an evening, the teams, the weather), intro(state) (the brief's first
// paragraphs), steps, beats, tick, debrief(state) }. The plain test is there for each, "on your own".
import { tailing } from './tailing.js';
import { tailed } from './tailed.js';
import { watching } from './watching.js';
import { brushPass, deadDrop } from './handover.js';
import { blown } from './blown.js';
import { umbrella } from './umbrella.js';
import { HEARSAY } from '../hale.js';
import { cityWords } from '../cities/index.js';

export const FARM = { id: 'farm', title: 'Hand to hand, at the Farm', scenario: 'dojo', chapter: 'lesson', farm: true,
  about: 'Camp Peary, week six: Hale teaches you to hit, grab and cover, then puts you in the ring with your class, and with himself.' };
export const LESSONS = [FARM, tailing, tailed, watching, brushPass, deadDrop, blown, umbrella];

export const lessonOf = (id) => LESSONS.find(l => l.id === id) ?? null;
/** The lesson after this one, or null. */
export const nextLesson = (id) => { const i = LESSONS.findIndex(l => l.id === id); return i >= 0 ? LESSONS[i + 1] ?? null : null; };
/** Its number in the tutorial (the Farm's 0). */
export const numberOf = (id) => LESSONS.findIndex(l => l.id === id);

/** The scene's brief, as the lesson gives it: its title, Hale's framing first, an exercise; and the canteen's talk of him (sim/hale.js). */
export function briefFor(state, b) {
  const L = state.tutor && lessonOf(state.tutor.lesson);
  if (!L || !b) return b;
  const talk = `In the station's canteen, they say things about Hale. ${HEARSAY[(numberOf(L.id) * 3 + 1) % HEARSAY.length]}`;
  // (in the city's own words, and the month it is; booked in a campaign, not a numbered lesson but another of Hale's evenings)
  const W = (t) => cityWords(state.campaign ? t.replace(/^Lesson [a-z]+, a week on\. /, 'Another of Hale\'s evenings. ').replace(/^Lesson [a-z]+(, [^.]*)?\. /, (m, rest) => `Another of Hale's evenings${rest ?? ''}. `) : t, state.map?.city, state.time.ms);
  return { ...b, stamp: 'EXERCISE', title: state.campaign ? `HALE'S EXERCISE: ${L.title.toUpperCase()}` : `TUTORIAL ${numberOf(L.id)}: ${L.title.toUpperCase()}`, body: [...(L.intro?.(state) ?? []), ...(b.body ?? []), talk].map(W), footer: `${W(b.footer ?? '')} · an exercise` };
}
