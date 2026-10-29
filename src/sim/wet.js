// TRADECRAFT sim: getting wet, and what the cold makes of it (the user, 2026-10-28: "Implement a robust health
// system inspired by Rimworld and Project Zomboid"; after "how do i use my umbrella, it's raining" and "no
// hood for clothes that don't have a hood though"). Yours, the player's: once a second (wetTick()).
//
// **Wet** (p.wet, 0–100): under what falls, out on the street, you soak by its kind and its strength
// (SOAK_PER_S: light rain wets you through in twenty minutes, heavy in six or seven, a downpour in four; snow,
// at half the pace),
// less under cover: an umbrella up in your hand (UMBRELLA_K; not in a gale, and a strong wind gets under
// it), a hood (HOOD_K: sim/clothes.js, the parka, the anorak). Where nothing falls you dry, slowly out of
// doors (DRY_OUT_PER_S), faster in a room or a shop (DRY_IN_PER_S); a change of clothes at home is dry at
// once (sim/clothes.js dress(), the flat's basin: sim/scenarios/campaign.js). The log says when you're
// damp, wet through, soaked (WORDS).
// **Cold** (the air's temperature, sim/weather.js): wet through (CHILL_WET) below CHILL_C, you shiver: −1 to
// every roll (sim/health.js mods()) until you're dry or in. And the chill may give you a cold (catchTick():
// a game minute at a time, a hazard by how cold and how wet, less the fitter you are, summed against a
// threshold the dice set, so a skip and a walk count alike): a heavy cold, COLD_DAYS of it, −1 to every
// roll (painkillers take it away while they work: sim/medicine.js), and now and then a sneeze (SNEEZE_S
// apart, about): loud, a head turned, and for a few seconds anyone looking for you has it easier
// (sim/notice.js mods(): SNEEZE_MOD).
import { weatherAt, FALLS } from './weather.js';
import { stream, next, range } from './rng.js';
import { skill } from './skills.js';
import { say } from './log.js';
import { DAY } from './clock.js';

export const SOAK_PER_S = { rain: [0, 0.083, 0.25, 0.4], sleet: [0, 0.07, 0.21, 0.34], snow: [0, 0.04, 0.1, 0.17] };
export const UMBRELLA_K = 0.12, UMBRELLA_WIND_K = 0.35, HOOD_K = 0.45;
export const DRY_OUT_PER_S = 0.012, DRY_IN_PER_S = 0.045;           // (out of doors, two hours and more; in a room, forty minutes)
export const CHILL_C = 10, CHILL_WET = 60;
export const CATCH_PER_MIN = 0.0035, COLD_DAYS = [4, 7], SNEEZE_S = [150, 420], SNEEZE_MOD = 3, SNEEZE_SEEN_S = 6;
const WORDS = [[90, 'Soaked to the skin: your coat\'s twice its weight and your shoes squelch.'], [60, 'Wet through: it\'s found its way down your collar and up your sleeves.'], [30, 'Damp: the shoulders of your coat dark with it.']];

/** How wet someone is, 0–100. */
export const wetOf = (p) => p?.wet ?? 0;
/** Whether they're shivering (wet through in the cold: kept on p.shiver by wetTick()). */
export const shivering = (p) => !!p?.shiver;
/** Whether they have a cold, at game time ms (or as it stands, with none given). */
export const hasCold = (p, ms = null) => !!p?.sick && (ms === null || p.sick.until > ms);

/** What shelters you from what falls, × the soak: 1 none, less under an umbrella up or a hood. */
export function coverK(p, w) {
  if (p.hand === 'umbrella' && (w.wind ?? 0) < 3) return (w.wind ?? 0) >= 2 ? UMBRELLA_WIND_K : UMBRELLA_K;
  return p.look?.top?.hood ? HOOD_K : 1;
}

/** Once a second: soak or dry, shiver or not, the chance of a cold, a sneeze. */
export function wetTick(state, bus, me) {
  const p = me && state.people[state.player];
  if (!p || p.dead) return;
  const w = weatherAt(state), ms = state.time.ms, was = wetOf(p);
  const inside = w.indoors || me.within || me.inside || me.hidden;
  let wet = was;
  if (!inside && FALLS.has(w.kind) && w.level) wet += (SOAK_PER_S[w.kind]?.[w.level] ?? 0) * coverK(p, w);
  else wet -= inside ? DRY_IN_PER_S : DRY_OUT_PER_S * (w.temp < 5 ? 0.6 : 1);
  wet = Math.max(0, Math.min(100, wet));
  if (wet > 0) p.wet = Math.round(wet * 1000) / 1000; else delete p.wet;
  const words = WORDS.find(([at]) => was < at && wet >= at);
  if (words) say(state, bus, { kind: 'note', text: words[1] });
  // (shivering: wet through, in the cold, out of doors)
  const shiver = !inside && wet >= CHILL_WET && w.temp < CHILL_C;
  if (shiver && !p.shiver) { p.shiver = true; say(state, bus, { kind: 'instinct', text: `You're shivering: wet through, and it's ${Math.round(w.temp)}°. In, somewhere warm, or dry clothes, before it turns into something.` }); }
  else if (!shiver && p.shiver) delete p.shiver;
  if (state.tick % (20 * 60) === 0) catchTick(state, bus, p, shiver ? (CHILL_C - w.temp) / CHILL_C : 0, ms);
  sneezeTick(state, bus, p, inside, ms);
}

/** A game minute's chill (severity 0–1+): the hazard summed; past the threshold, a cold. */
export function catchTick(state, bus, p, severity, ms, minutes = 1) {
  if (p.sick && p.sick.until > ms) return;
  if (p.sick) { delete p.sick; delete p.chill; say(state, bus, { kind: 'note', text: 'The cold\'s gone: your head\'s your own again.' }); }
  if (!(severity > 0)) return;
  p.chill = (p.chill ?? 0) + CATCH_PER_MIN * (0.5 + severity) * Math.max(0.25, 1 - skill(p, 'fitness') / 40) * minutes;
  const r = stream('cold', p.id ?? 'me', p.colds ?? 0), at = -Math.log(1 - next(r) * 0.999999);
  if (p.chill < at) return;
  p.colds = (p.colds ?? 0) + 1; delete p.chill;
  p.sick = { kind: 'cold', ms, until: ms + Math.round(range(r, ...COLD_DAYS) * DAY), sneeze: ms + 30 * 1000 };
  say(state, bus, { kind: 'instinct', text: 'A scratch at the back of your throat, a heaviness behind the eyes: you\'ve caught a cold. A few days of it: −1 to everything, and you\'ll sneeze. Painkillers help.' });
}

/** A cold's sneezes: now and then, on the street, loud; anyone looking your way has it easier for a few seconds. */
function sneezeTick(state, bus, p, inside, ms) {
  if (p.sneezeS) { p.sneezeS--; if (!p.sneezeS) delete p.sneezeS; }
  if (!hasCold(p, ms) || ms < p.sick.sneeze) return;
  const r = stream('sneeze', p.id ?? 'me', Math.floor(ms / 1000));
  p.sick.sneeze = ms + Math.round(range(r, ...SNEEZE_S) * 1000);
  if (inside) return;
  p.sneezeS = SNEEZE_SEEN_S;
  say(state, bus, { kind: 'note', text: 'You sneeze, loud, before you can stop it. A head turns.' });
}

/** Days pass (a skip: sim/game.js): the cold runs its course; wet clothes dry (a night in is a night in). */
export function wetDays(p, days, ms) {
  if (p.wet) { p.wet = Math.max(0, p.wet - DRY_IN_PER_S * days * 86400); if (!p.wet) delete p.wet; }
  delete p.shiver;
  if (p.sick && p.sick.until <= ms) { delete p.sick; delete p.chill; }
}

/** Dry clothes on: a change at home. */
export function dryOff(p) { delete p.wet; delete p.shiver; }

