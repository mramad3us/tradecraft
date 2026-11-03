// TRADECRAFT sim: skills going rusty (the user, 2026-11-03: "in general, skills higher than 15 but unused for over four
// weeks become 'rusty' and require some amount of practice to restore their full bonus (like fighting which can be
// restored or maintained by going to a club twice a month. Getting into a fight in the world counts as two fight
// sessions in a club)"). Fitness has its own keeping (sim/fitness.js); Tradecraft isn't a skill.
//
// **Practice** (practise()): a class at the club a session of CQC (sim/shops.js), a fight in the street FIGHT_SESSIONS
// (sim/fight.js), every roll of a skill of yours ROLL_SESSION of one (sim/log.js: so what you use in the field keeps).
// **Rust** (p.rust, by skill, 0 … RUST_MAX): every PERIOD_DAYS (the calendar's, from day 0), a skill over RUST_FROM (as
// it shows, its Tradecraft multiplier in it) that had fewer than KEEP_SESSIONS of practice in it gains a level; each
// session of practice takes one away, and only then counts toward the next period's. What rust costs (rustOff(),
// sim/skills.js skill()): a sixth of what the skill is over RUST_FROM a level, so at RUST_MAX half of it: a legend's CQC
// of 30 left alone three months fights at 22.
import { rawSkill } from './skills.js';
import { DAY } from './clock.js';
import { say } from './log.js';

export const RUST_FROM = 15, PERIOD_DAYS = 28, KEEP_SESSIONS = 2, RUST_MAX = 3, ROLL_SESSION = 0.25, FIGHT_SESSIONS = 2;
export const RUSTING = ['deception', 'tracking', 'pathfinding', 'awareness', 'social', 'analysis', 'tech', 'medicine', 'cqc', 'weapons'];
const NAMES = { deception: 'Deception', tracking: 'Tracking', pathfinding: 'Pathfinding', awareness: 'Awareness', social: 'Social', analysis: 'Analysis', tech: 'Tech', medicine: 'Medicine', cqc: 'CQC', weapons: 'Weapon handling' };
export const periodOf = (ms) => Math.floor(Math.floor(ms / DAY) / PERIOD_DAYS);

/** What rust takes off a skill that shows `total` without it. */
export const rustOff = (p, key, total) => { const r = p.rust?.[key] ?? 0; return r > 0 && total > RUST_FROM ? Math.round((total - RUST_FROM) * r / 6) : 0; };

/** n sessions of practice at a skill (rust taken off first). */
export function practise(state, bus, p, key, n = 1, ms = state.time.ms) {
  if (!p?.skills || !RUSTING.includes(key) || !(n > 0)) return;
  rustRoll(state, bus, p, ms);
  const rust = (p.rust ??= {}), pr = (p.practice ??= {});
  const was = rust[key] ?? 0, off = Math.min(was, n);
  if (off > 0) { rust[key] = Math.round((was - off) * 100) / 100; if (!rust[key]) delete rust[key]; }
  pr[key] = (pr[key] ?? 0) + n - off;
  if (was >= 1 && Math.floor(rust[key] ?? 0) < Math.floor(was) && p.id === state.player) say(state, bus, { kind: 'note', text: rust[key] ? `${NAMES[key]}: coming back to you.` : `${NAMES[key]}: back to what it was.` });
}

/** Every period ended since p's last: a skill over RUST_FROM short of its practice a level rustier. */
export function rustRoll(state, bus, p, ms = state.time.ms) {
  if (!p?.skills) return;
  const now = periodOf(ms);
  p.rustAt ??= now;
  while (p.rustAt < now) {
    const rust = (p.rust ??= {}), pr = p.practice ?? {}, went = [];
    for (const k of RUSTING) if (rawSkill(p, k) > RUST_FROM && (pr[k] ?? 0) < KEEP_SESSIONS && (rust[k] ?? 0) < RUST_MAX) { rust[k] = Math.min(RUST_MAX, Math.floor(rust[k] ?? 0) + 1); went.push(NAMES[k]); }
    p.practice = {};
    p.rustAt++;
    if (went.length && p.id === state.player) say(state, bus, { kind: 'note', text: `A month without them, and it shows: ${went.join(', ')} ${went.length > 1 ? 'are' : 'is'} rusty.` });
  }
}
