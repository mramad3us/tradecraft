// TRADECRAFT sim: experience, and Tradecraft grown of it (the user, 2026-11-03: "tradecraft increase should be
// heavily logarithmic, taking A LOT of missions to improve significantly as we get better … beginners
// (tradecraft around 20, they would improve 1 point from such a tail), officers (around 40, maybe 1 point for 5
// missions like this, more for more risky and difficult missions) … difficulty and risk increase the amount of
// XP, riskier stations would carry more … losing a tail would bring more XP than not doing anything wrong as
// we're being watched, and each successful roll should bring in some XP (very little comparatively)").
//
// XP is kept on the character (p.xp, carried into a mission and back with them). It comes of:
//   - an assignment done (missionXP(): MISSION_XP by its kind, × how it went (OUTCOME_K: a failure teaches a
//     little too), × how hard it was (the target's craft, CRAFT_K; the team on you, TEAM_K), × the risk (the
//     station's, its profile's station.risk, and the heat: HEAT_K a point over 20);
//   - a team that was on you shaken off (LOST_XP, by the team: losing a covert team teaches more than an
//     evening nobody followed you);
//   - every roll of yours that goes your way (ROLL_XP: a little, against an assignment's ten or so).
// Tradecraft grows of it a point at a time (level()), each point costing more than the last: COST0 at
// COST_FROM, × COST_K a point after (×6.25 every 20 points). A tail on a trained man done well in London (some
// 9 XP, and 3 or so of the rolls along the way) is a point to a beginner at 20; an officer at 40 wants four or
// five of them a point (fewer in riskier Moscow); at 60, twenty-five; at 95, a legend's, a point is some 7,000
// XP, and nothing much moves them.
import { won } from './checks.js';
import { practise, ROLL_SESSION } from './rust.js';

export const COST0 = 8, COST_FROM = 20, COST_K = Math.pow(6.25, 1 / 20);   // (a point: 8 XP at 20, 50 at 40, 312 at 60, some 7,000 at 95)
export const ROLL_XP = 0.1;
export const MISSION_XP = { sdr: 12, tail: 10, watch: 10 };
export const OUTCOME_K = {
  sdr: { clean: 1, burned: 0.5, right: 0.8, needless: 0.25, missed: 0.2, incident: 0.1 },
  tail: { seen: 1, lost: 0.4, made: 0.3, spooked: 0.3, missed: 0.3, blown: 0.1 },
  watch: { photo: 1, soft: 0.7, seen: 0.5, missed: 0.2, blown: 0.2 },
};
export const CRAFT_K = { careless: 0.85, trained: 1.15, sharp: 1.35, jumpy: 1.25 };
export const TEAM_K = { none: 1, overt: 1.2, covert: 1.5 };
export const LOST_XP = { overt: 6, covert: 10 };
export const HEAT_K = 0.005;
export const TRIP_K = 1.2;                                         // (a trip abroad: another station's streets, its team's eyes on you)

/** What a Tradecraft point costs at os. */
export const cost = (os) => Math.round(COST0 * COST_K ** Math.max(0, os - COST_FROM));

/** XP to someone (their sheet). */
export function gain(p, xp) { if (p && xp > 0) p.xp = Math.round(((p.xp ?? 0) + xp) * 100) / 100; }

/** Tradecraft grown of the XP banked, a point at a time (each costing what it does at the level reached): the points gained. */
export function level(p) {
  let n = 0;
  while (p && (p.os ?? 0) < 100 && (p.xp ?? 0) >= cost(p.os ?? 0)) { p.xp = Math.round((p.xp - cost(p.os ?? 0)) * 100) / 100; p.os = (p.os ?? 0) + 1; n++; }
  return n;
}

/**
 * An assignment's XP: { kind ('sdr' | 'tail' | 'watch'), outcome, craft (the target's), team (on you: 'none' |
 * 'overt' | 'covert'), risk (the station's), heat, trip }.
 */
export function missionXP({ kind, outcome, craft = null, team = 'none', risk = 1, heat = 20, trip = false }) {
  const base = MISSION_XP[kind] ?? 0, k = OUTCOME_K[kind]?.[outcome] ?? 0.2;
  const hard = (craft ? CRAFT_K[craft] ?? 1 : 1) * (TEAM_K[team] ?? 1), risky = risk * (1 + Math.max(0, heat - 20) * HEAT_K) * (trip ? TRIP_K : 1);
  return Math.round(base * k * hard * risky * 10) / 10;
}

/** A roll shown (sim/log.js): the player's, gone their way, a little XP. */
export function fromRoll(state, e) {
  if (!e?.roll || e.hidden || !state?.player) return;
  if (won(e.roll)) gain(state.people[state.player], ROLL_XP);
  // (and a little practice at the skill rolled, won or not: what you use keeps, sim/rust.js; yours, their side's skill when it's their roll)
  const key = e.roll.kind === 'opposed' ? (e.roll.them ? e.roll.theirs?.skill : e.roll.ours?.skill) : e.roll.skill;
  if (key && !e.roll.them && state.campaign) practise(state, null, state.people[state.player], key, ROLL_SESSION);
}

/** Where they stand: Tradecraft, and the XP toward the next point, in words for the sheet and the debrief. */
export function progress(p) {
  const os = p?.os ?? 0, need = cost(os), have = Math.floor(p?.xp ?? 0);
  return { os, have, need, words: os >= 100 ? `Tradecraft ${os}` : `Tradecraft ${os}, ${have} of ${need} XP toward ${os + 1}` };
}
