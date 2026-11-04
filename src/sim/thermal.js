// TRADECRAFT sim: the body's warmth, and what the day expects you to wear (the user, 2026-11-03: "add
// temperature, seasons and link them to NPC clothing (which if we're too far from it should make us more
// conspicuous, like carrying an umbrella in a sunny day of summer or be in a t-shirt in a snowy day of winter),
// also add hypothermia and heat strokes for extreme temperatures + being wet for when caught in rain, which
// would decrease body temperature").
//
// **The day** (bandOf()): the day's feel, from its temperature at noon and dusk (sim/weather.js, the city's
// climate), one of BANDS, freezing to hot. Passers-by dress for it (sim/people.js passerby(): a stream of its
// own, so who they are doesn't change), and what's expected of a top is its range (EXPECT: warmth from, to).
// **What a top's worth** (warmthOf()): WARMTH by its kind (a T-shirt 0, a dress 0, a robe 1, a jumper, a
// jacket, a suit 2, a coat 3, a parka 4); a hat the head's (HAT_WARM); body armour adds to the core's (a soft
// vest half a point, a plate carrier a point against the heat, WARM_COLD of that against the cold: sim/armour.js
// WARM), not to how you look. Out of the day's range, you're dressed
// for another season, and anyone looking for you has it easier (sim/notice.js: SEASON_MOD a step, at most
// SEASON_MAX); an umbrella in the hand under a clear sky, the same (UMBRELLA_MOD).
// **The core** (p.core, °C, 37 when nothing's happened): out of doors it drifts by how far the air (felt:
// the temperature, less the wind's chill, WIND_CHILL, and the wet's, WET_CHILL a point of it; more under
// a clear midday sun, SUN_C) is from the comfort of what you wear (COMFORT by warmth: [cold below, hot
// above], a hat COMFORT_HAT lower): it settles toward 37 less COLD_K a degree below, or more HEAT_K a degree above
// (running, RUN_C more, and it warms you in the cold), over TAU_COLD or TAU_HEAT minutes; inside, back to 37.
// What it does (STAGES): under 36 you shiver (−1); under 35, hypothermia (−3, and slow); under 33, worse
// (−6, slower); under 31 you go down; under 28, dead. Over 38, hot (−1); over 39.5, heat exhaustion (−3,
// slow); over 41, heat stroke: you go down; over 42.5, dead. The rolls read it through sim/health.js mods(),
// standing through canStand(); the log says when it changes (WORDS); a skip lives it a minute at a time.
// (My calls, to be tuned in play: tests/thermal.test.mjs prints them.)

import { weather as weatherOf } from './weather.js';
import { warmthOf as armourWarmth } from './armour.js';
import { townOf } from './cities/index.js';
import { DAY, HOUR } from './clock.js';

export const BANDS = ['freezing', 'cold', 'cool', 'mild', 'warm', 'hot'];
export const BAND_FROM_C = [-Infinity, 0, 8, 15, 22, 28];          // (a band from this, at the day's feel)
export const WARMTH = { tee: 0, dress: 0, robe: 1, sweater: 2, jacket: 2, suit: 2, uniform: 2, coat: 3 };
export const WARM_ITEMS = { parka: 4, anorak: 3, trench: 2.5, puffer: 4 };   // (a wardrobe's piece by its id, warmer or lighter than its kind)
export const HAT_WARM = 0.5;
// What the day expects of a top: [least, most] warmth (dressed for it inside these).
export const EXPECT = { freezing: [3, 4], cold: [2.5, 4], cool: [2, 3.5], mild: [0, 3], warm: [0, 2], hot: [0, 1] };
export const SEASON_MOD = 1, SEASON_MAX = 3, UMBRELLA_MOD = 1;
// The felt air: the wind's chill by its level, the wet's a point (0–100), the clear sun at midday.
export const WIND_CHILL = [0, 2, 5, 9], WET_CHILL = 0.07, SUN_C = 3;
// Comfort by warmth (0 a T-shirt … 4 a parka): felt air from, to (°C); a hat lowers the floor.
export const COMFORT = [[16, 31], [12, 32], [5, 25], [-10, 17], [-25, 10]];
export const COMFORT_HAT = 3;
// (the core settles toward where the air would hold it, CORE less COLD_K a degree below comfort or more HEAT_K a degree
// above, RUN_C more running; over TAU_COLD, TAU_HEAT, TAU_IN minutes: the body sweats, shivers, and holds what it can)
export const COLD_K = 0.25, HEAT_K = 0.12, RUN_C = 1.2, TAU_COLD = 60, TAU_HEAT = 45, TAU_IN = 30;
export const CORE = 37;
export const STAGES = [
  { below: 28, id: 'frozen', v: -10, dead: true }, { below: 31, id: 'collapse', v: -10, down: true }, { below: 33, id: 'severe', v: -6, slow: 0.7 },
  { below: 35, id: 'hypothermia', v: -3, slow: 0.85 }, { below: 36, id: 'shivering', v: -1 },
  { above: 42.5, id: 'cooked', v: -10, dead: true }, { above: 41, id: 'stroke', v: -10, down: true }, { above: 39.5, id: 'exhaustion', v: -3, slow: 0.85 }, { above: 38, id: 'hot', v: -1 },
];
const WORDS = {
  shivering: 'You\'re shivering, and can\'t stop.', hypothermia: 'The cold\'s in your bones: your hands are slow, your thoughts slower.',
  severe: 'You can\'t feel your hands. You need to get warm, now.', collapse: 'Your legs go from under you in the cold.',
  hot: 'Too hot: the sweat\'s running down your back.', exhaustion: 'The heat\'s got into you: dizzy, sick, slow.',
  stroke: 'The street tilts, and the heat takes you down.', warm: 'Warm again.',
};

/** The day's band from its felt temperature (°C). */
export const bandFor = (c) => { let b = 0; for (let i = 0; i < BAND_FROM_C.length; i++) if (c >= BAND_FROM_C[i]) b = i; return BANDS[b]; };
/** What a look's top and hat are worth (warmth, 0–4.5). id: a wardrobe piece's (a parka's warmer than a coat). */
export function warmthOf(look) {
  const t = look?.top, base = t ? (WARM_ITEMS[t.id] ?? WARMTH[t.kind] ?? 2) : 0;
  return base + (look?.hat && !['cap', 'fedora'].includes(look.hat.kind ?? look.hat) ? HAT_WARM : 0);
}
/** What a look's top alone is worth (the hat's apart). */
export const topWarmth = (look) => (look?.top ? WARM_ITEMS[look.top.id] ?? WARMTH[look.top.kind] ?? 2 : 0);
/** Whether a look's dressed for the day (band): 0 yes, else how many steps off (by its top). */
export function offSeason(look, band) {
  const [lo, hi] = EXPECT[band] ?? [0, 4], w = topWarmth(look);
  return w < lo ? Math.ceil(lo - w) : w > hi ? Math.ceil(w - hi) : 0;
}

/** The felt air on someone out of doors: the temperature, the wind's chill, the wet's, the midday sun. */
export function feltC(w, p, hour = 12) {
  const sun = w.kind === 'clear' && hour >= 10 && hour <= 16 ? SUN_C * (1 - (w.cloud ?? 0)) : 0;
  return (w.temp ?? 15) - (WIND_CHILL[w.wind ?? 0] ?? 0) - (p?.wet ?? 0) * WET_CHILL + sun;
}

/** Where the core would settle in this air (w, the weather; indoors: null), dressed so, running or not: { target °C, tau minutes }. */
export function settleTo(p, w, { hour = 12, running = false } = {}) {
  if (!w) return { target: CORE, tau: TAU_IN };
  // (the top's warmth, and a vest's or a carrier's with it: all of it against the heat, a share against the cold, sim/armour.js; the hat's is COMFORT_HAT)
  const at = (w, end) => { const v = Math.min(4, Math.max(0, w)), i = Math.floor(v), f = v - i; return COMFORT[i][end] + (COMFORT[Math.min(4, i + 1)][end] - COMFORT[i][end]) * f; };
  const top = topWarmth(p.look), lo = at(top + armourWarmth(p, true), 0) - (p.look?.hat ? COMFORT_HAT : 0), hi = at(top + armourWarmth(p), 1);
  const t = feltC(w, p, hour), run = running ? RUN_C : 0;
  if (t < lo) return { target: CORE - COLD_K * (lo - t) + run, tau: TAU_COLD };
  if (t > hi) return { target: CORE + HEAT_K * (t - hi) + run, tau: TAU_HEAT };
  return { target: CORE + run * 0.5, tau: run ? TAU_HEAT : TAU_IN };
}
/** The core's move in a minute (°C), toward where it would settle. */
export function drift(p, w, opts = {}) {
  const { target, tau } = settleTo(p, w, opts), core = p.core ?? CORE;
  return (target - core) * (1 - Math.exp(-1 / tau));
}

/** The stage the core's at ({ id, v, slow, down, dead }), or null when it's fine. */
export function stageOf(p) {
  const c = p?.core ?? CORE;
  for (const s of STAGES) if ((s.below !== undefined && c < s.below) || (s.above !== undefined && c > s.above)) return s;
  return null;
}

/** What the cold or the heat costs every roll (sim/health.js mods()). */
export const thermalMods = (p) => { const s = stageOf(p); return s ? [{ why: { shivering: 'shivering', hypothermia: 'hypothermia', severe: 'hypothermia, badly', collapse: 'hypothermia', frozen: 'frozen', hot: 'too hot', exhaustion: 'heat exhaustion', stroke: 'heat stroke', cooked: 'heat stroke' }[s.id], v: s.v }] : []; };
/** Whether the cold or the heat has you down. */
export const thermalDown = (p) => !!stageOf(p)?.down || !!stageOf(p)?.dead;

/**
 * minutes of it (a tick's share, or a skip's): the core moved, the log told when its stage changes, and
 * death if it comes to that (sim/health.js kill()). w: the weather out of doors, or null indoors.
 */
export function live(p, w, minutes, { hour = 12, running = false, ms = 0, say = null, kill = null } = {}) {
  const was = stageOf(p)?.id ?? null;
  for (let left = minutes; left > 0; left -= 1) p.core = Math.round(((p.core ?? CORE) + drift(p, w, { hour, running }) * Math.min(1, left)) * 1000) / 1000;
  if (Math.abs((p.core ?? CORE) - CORE) < 0.01) delete p.core;
  const now = stageOf(p);
  if ((now?.id ?? null) !== was) say?.(now ? WORDS[now.id] ?? null : was ? WORDS.warm : null);
  if (now?.dead && kill) kill(now.id === 'frozen' ? 'the cold' : 'the heat');
  return now;
}

/**
 * A passer-by dressed for the day (band): a top too light or too heavy for it changed for one that isn't, a
 * beanie on in the cold, off in the heat; a robe and a uniform as they are. r: the dressing's own stream.
 */
export function dressFor(look, band, sex, r) {
  const t = look?.top;
  if (!t || !band || ['robe', 'uniform'].includes(t.kind)) return look;
  const [lo, hi] = EXPECT[band], w = WARMTH[t.kind] ?? 2, pick = (opts) => opts[Math.floor(r() * opts.length)];
  let kind = t.kind;
  if (w < lo) kind = band === 'cool' ? pick(['jacket', 'coat', 'coat']) : 'coat';
  else if (w > hi) kind = band === 'mild' ? pick(['sweater', 'jacket', 'jacket']) : sex === 'f' ? pick(['tee', 'tee', 'dress']) : 'tee';
  let hat = look.hat;
  const beanie = (h) => (h?.kind ?? h) === 'beanie';
  if ((band === 'freezing' || band === 'cold') && !hat && r() < 0.45) hat = { kind: 'beanie', color: t.color };
  else if ((band === 'warm' || band === 'hot') && beanie(hat)) hat = null;
  return kind === t.kind && hat === look.hat ? look : { ...look, top: { ...t, kind }, ...(hat ? { hat } : { hat: undefined }) };
}

// (the day's band, by its temperature at noon, three and six; a pinned weather's own: snow freezing, sleet cold, 'clear' none: as they were)
const PIN_BAND = { snow: 'freezing', sleet: 'cold' };
const bands = new Map();
/** The day's band where the map is (a street's: indoors none, and none under a pinned 'clear'). */
export function dayBand(state) {
  const map = state?.map;
  if (!map || map.kind !== 'street') return null;
  if (state.weather) return PIN_BAND[(typeof state.weather === 'string' ? state.weather : state.weather.kind ?? '').split('-')[0]] ?? null;
  const day = Math.floor(state.time.ms / DAY), town = townOf(map), city = map.city ?? 'moscow', k = `${town}|${day}`;
  if (!bands.has(k)) {
    const t = [12, 15, 18].reduce((a, h) => a + weatherOf(town, city, day * DAY + h * HOUR).temp, 0) / 3;
    bands.set(k, bandFor(t));
    if (bands.size > 200) bands.delete(bands.keys().next().value);
  }
  return bands.get(k);
}

