// TRADECRAFT sim: what the officer believes of their own standing (the user, 2026-10-28: "The heat level and
// the cover health should be reworded to be more roleplay, what we see is what our character evaluates as
// being true (we can't know for sure we're not about to be burned, especially if we're not very
// experienced)").
//
// The truth is the campaign's (sim/campaign.js: heat, how much the opposition knows; cover standing, the
// embassy's view of your work). What the player's shown is the officer's read of it (readOf()): the truth
// off by an error of their own, wider the less they know a street (Awareness, the street's eye; Social,
// for the embassy's mood), the less Tradecraft they have, the newer they are to the posting (days in it,
// assignments done; a posting of one's own's career behind them); the same all day (the day's own dice), so it doesn't flicker as you look. Said in
// words, never a number, with how sure they are: sure, thinking so, or guessing.
import { stream, range } from './rng.js';
import { DAY } from './clock.js';
import { skill } from './skills.js';

export const SPREAD = { base: 34, min: 4, career: 6 };              // (career: a posting of one's own's experience, off the spread)                         // (the error's spread, in points of heat or standing)

// (what the read means, by the number read: heat, then cover standing)
const HEAT = [
  [28, 'Nobody\'s shown any interest in you that you\'ve seen.'],
  [40, 'A face or two you\'ve seen more than once. Probably nothing.'],
  [55, 'You\'ve felt eyes on you some evenings. They\'re interested.'],
  [70, 'They\'re on you most days now: you\'d stake money on it.'],
  [85, 'They\'re close. Somebody\'s file on you is getting thick.'],
  [101, 'You can feel the end coming: they know who you are.'],
];
const COVER = [
  [20, 'Your cover\'s in tatters: the embassy can\'t explain you any more.'],
  [40, 'People at the embassy have started asking what it is you actually do.'],
  [60, 'There\'ve been looks at the embassy. Your cover\'s thinner than it was.'],
  [80, 'Nobody at the embassy has said a word about your hours.'],
  [101, 'The ambassador\'s office thinks you\'re one of the good ones.'],
];

/** The spread of the officer's error on a gauge read by a skill: points (SPREAD.min at the best). */
export function spreadOf(p, c, key = 'awareness') {
  const days = c ? (c.now ?? c.posting.startMs) / DAY - c.posting.startMs / DAY : 0, done = c?.done?.length ?? 0;
  return Math.max(SPREAD.min, SPREAD.base - 0.8 * skill(p, key) - 0.15 * (p.os ?? 30) - Math.min(5, days * 0.2) - Math.min(4, done * 0.4) - (c?.posting?.level === 'junior' ? 0 : SPREAD.career));
}

/** How sure, by the spread: the words. */
const sureOf = (s) => (s < 6 ? 'You\'re sure of it.' : s < 11 ? 'You think so.' : 'It\'s a guess, and you\'re new at this.');

/** The officer's read of their heat and their cover: { heat: { text, sure }, cover: { text, sure } }. */
export function readOf(c, p, ms) {
  const P = c.posting, day = Math.floor(ms / DAY);
  const read = (truth, key, scale, salt) => {
    const s = spreadOf(p, c, key), r = stream('belief', c.seed, day, salt);
    const g = (range(r, 0, 1) + range(r, 0, 1) + range(r, 0, 1) + range(r, 0, 1) - 2) * 1.7;   // (about one spread either way, now and then more)
    return { v: Math.max(0, Math.min(100, truth + g * s)), s };
  };
  const h = read(P.heat, 'awareness', HEAT, 'heat'), cv = read(P.cover, 'social', COVER, 'cover');
  return {
    heat: { text: HEAT.find(([t]) => h.v < t)[1], sure: sureOf(h.s) },
    cover: { text: COVER.find(([t]) => cv.v < t)[1], sure: sureOf(cv.s) },
  };
}
