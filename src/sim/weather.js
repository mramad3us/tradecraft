// TRADECRAFT sim: the weather (the user, 2026-10-27: "Weather: snow, rain and wind, graduated
// light/heavy/extreme, real effects, structured and scalable"). The engine's, in every city, from the
// city's climate and the date; DESIGN.md, Weather, has the numbers.
//
// The model is small and has no state: the weather over a town (a map's seed and city, sim/cities/
// townOf()) at a game time is a pure function of the two, drawn from streams of its own
// (stream('weather', town, day)). So it never moves the game's other dice, the hub and an assignment's
// street (the posting's seed) share it, and nothing of it is saved.
//   - The city's climate (CLIMATE, one table a city): each month's mean temperature (°C), its swing
//     over a clear day and the day-to-day wander; the chance a day brings rain or snow; by season, the
//     sky (clear, broken, overcast), how many spells of rain or snow a wet day has, how long they last,
//     how hard they come at their worst and how often a hard one brings a wind; the chance of fog (and
//     in Cairo, dust); the day's wind. A city added is a table added.
//   - A day (dayOf()): its sky, its wind and which way it blows, its spells. A front comes and goes:
//     a spell rises to its worst over its first RAMP and eases off over its last, so a heavy fall
//     starts and ends light; one may run on past midnight. The temperature's wander from the month's
//     mean is a running mean of three days' draws, so a cold spell lasts.
//   - The hour's air (airAt()): what falls is what the temperature makes it (snow below SNOW_BELOW_C,
//     sleet below SLEET_BELOW_C, rain above); fog when nothing falls and the wind is light; dust in
//     Cairo; otherwise the day's sky, gone over to cloud an hour and a half either side of a spell.
//   - The ground (groundAt()): snow lying (cover: 0 none, 0.3 white, 1 deep) and wet (0–1), hour by
//     hour over the last GROUND_H hours, from the climate's snow pack before that: snow settles by how
//     hard it falls, melts above MELT_ABOVE_C and under rain; rain wets, and the wet dries by the
//     warmth and the wind. Wet below freezing is ice.
// The result: { kind (KINDS), level 0–3 (none, light, heavy, extreme), wind 0–3 (calm, breezy,
// strong, gale), dir (the wind's way across the picture: east +), cloud 0–1, temp, cover, wet, ice,
// rime (a frost on what faces up, 0–1: below RIME_BELOW_C, more under a clear sky, none under snow),
// words (for the watch) }.
//
// weatherAt(state) is the one the game reads: the city's where the map is a street (a room has none),
// or a pin (state.weather, from newGame's `weather`: the debug override, ?weather=snow-heavy-gale, and
// the balance tests' 'clear'), kept for the game minute ($wx). Its effects, each a number in one table
// below, read through one helper each:
//   - sight (sightM): how far anyone sees through it, metres, whatever the light: the eye's reach is
//     the lesser of this and the light's (sim/perception.js reach()). A distance, not a share: falling
//     snow hides a man at 30 m by day or by night, and the dark's own 15 m stays the dark's (a share of
//     it, tried first, left a night tail in heavy snow lost one evening in two);
//   - the crowd (crowdK): passers-by × this (sim/crowd.js populate());
//   - faces (weatherMods): hoods up, umbrellas, heads down: a modifier to a roll to know someone by
//     their face or their look (the tail's Orlov and our close looks, being tailed's checks of faces,
//     Blown's hunters);
//   - footing (footing): slower going in snow; running on snow or ice, now and then a slip (sim/game.js);
//   - the light (sim/light.js sky()): greyer and flatter under cloud, dimmer under rain, fog and dust;
//   - the words (words, weatherLine(), weatherTick(): the log says when it turns).
// A pinned 'clear' is the weather before there was any: every effect exactly nothing.
import { stream, next, range, int, chance, weighted } from './rng.js';
import { DAY, HOUR, MIN, calendar, hourOfDay } from './clock.js';
import { townOf } from './cities/index.js';
import { say } from './log.js';

export const KINDS = ['clear', 'overcast', 'rain', 'sleet', 'snow', 'fog', 'dust'];
export const LEVELS = ['none', 'light', 'heavy', 'extreme'];
export const WINDS = ['calm', 'breezy', 'strong', 'gale'];
export const FALLS = new Set(['rain', 'sleet', 'snow']);

export const SNOW_BELOW_C = -0.3;                                  // what falls: snow below this, °C
export const SLEET_BELOW_C = 2.5;                                  // sleet below this, rain above
export const RAMP = 0.3;                                           // a spell rises over this share of it, and eases over as much
export const RAMP_MIN_H = 0.25;                                    // and over this long a level at least (a downpour builds over 45 minutes)
export const NEAR_SPELL_H = 1.5;                                   // the sky's overcast this long either side of a spell
export const SKY_TURN_H = 3;                                       // a day's sky turns into the next's over this long either side of midnight
export const SKY_CLOUD = { clear: 0.1, broken: 0.5, overcast: 0.9 };
export const GROUND_H = 120;                                       // the ground remembers this many hours of weather
export const COVER_LYING = 0.3;                                    // snow lying: white underfoot
export const COVER_DEEP = 0.9;                                     // deep snow
export const ICE_BELOW_C = -0.5;                                   // wet ground freezes below this
export const RIME_BELOW_C = -1;                                    // a frost on what faces up below this, full RIME_FULL_C lower
export const RIME_FULL_C = 4;
// The ground, an hour at a time: snow settling by level (× 0.6 above freezing), sleet's slush, rain
// washing snow away, melt a degree above MELT_ABOVE_C, the wet drying.
export const SETTLE = [0, 0.1, 0.28, 0.5];
export const SLEET_SETTLE = [0, 0.02, 0.05, 0.08];
export const RAIN_MELT = 0.08;
export const MELT_ABOVE_C = 0.5, MELT_PER_C = 0.04;
export const DRY_PER_H = 0.12, DRY_PER_C = 0.025, DRY_PER_WIND = 0.05;

// ---------- the climates ----------
//
// temp: each month's mean, °C (1991–2020 normals, rounded); swing: ± °C over a clear day (under
// cloud, SWING_CLOUD of it); spread: the day-to-day wander (its sd, °C); wet: each month's chance that
// a day brings rain or snow at all; pack: snow lying from before the ground's memory (0–1); dust (Cairo):
// each month's chance of a hazy or dusty day. months: each month's season, a letter, and by season:
//   sky [clear, broken, overcast] (weights), spells [fewest, most] on a wet day, hours [shortest,
//   longest] a spell lasts, level [light, heavy, extreme] (weights: how hard it comes at its worst),
//   gust (the chance a heavy one brings a wind: its level's), fog (a day's chance of a fog, mostly
//   at dawn), wind [calm, breezy, strong, gale] (weights).
export const SWING_CLOUD = 0.45;
export const CLIMATE = {
  moscow: {
    temp: [-6.2, -6.0, -0.6, 6.6, 13.0, 16.8, 19.2, 17.0, 11.3, 5.6, 0.0, -4.0],
    swing: [1.8, 2.5, 3.5, 5, 6, 6, 6, 5.5, 4.5, 3, 2, 1.8], spread: 4.5,
    wet: [0.6, 0.55, 0.48, 0.45, 0.45, 0.5, 0.5, 0.48, 0.5, 0.58, 0.62, 0.64],
    pack: [0.9, 1, 0.8, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0.5],
    months: 'WWSSUUUUAAAW',
    W: { sky: [1.5, 2, 6.5], spells: [1, 3], hours: [2, 10], level: [6.5, 3, 0.5], gust: 0.4, fog: 0.04, wind: [3, 4.5, 2, 0.25] },
    S: { sky: [3, 3.5, 3.5], spells: [1, 2], hours: [1, 6], level: [7, 2.7, 0.3], gust: 0.3, fog: 0.06, wind: [3, 4.5, 2, 0.25] },
    U: { sky: [3.5, 4.5, 2], spells: [1, 2], hours: [0.5, 3], level: [5, 4, 1], gust: 0.5, fog: 0.04, wind: [3.5, 4.5, 1.6, 0.2] },
    A: { sky: [0.5, 1.4, 8.1], spells: [1, 3], hours: [1.5, 8], level: [7, 2.6, 0.4], gust: 0.4, fog: 0.1, wind: [3, 4.5, 2, 0.25] },
  },
  london: {
    temp: [5.2, 5.5, 7.6, 10.0, 13.4, 16.4, 18.7, 18.4, 15.6, 12.2, 8.4, 5.9],
    swing: [2.5, 3, 4, 5, 5.5, 6, 6, 5.5, 5, 4, 3, 2.5], spread: 2.8,
    wet: [0.6, 0.52, 0.5, 0.45, 0.45, 0.4, 0.4, 0.42, 0.45, 0.55, 0.6, 0.6],
    pack: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    months: 'WWSSSUUUAAWW',
    W: { sky: [1.2, 3.3, 5.5], spells: [1, 3], hours: [1, 6], level: [7.5, 2.3, 0.2], gust: 0.5, fog: 0.08, wind: [2, 4.5, 2.8, 0.35] },
    S: { sky: [2.5, 4.5, 3], spells: [1, 2], hours: [0.5, 4], level: [7.5, 2.3, 0.2], gust: 0.3, fog: 0.04, wind: [2, 4.5, 2.5, 0.25] },
    U: { sky: [3, 4.5, 2.5], spells: [1, 2], hours: [0.5, 3], level: [6, 3.4, 0.6], gust: 0.3, fog: 0.02, wind: [3, 4.5, 2, 0.15] },
    A: { sky: [1.8, 4, 4.2], spells: [1, 3], hours: [1, 5], level: [7, 2.7, 0.3], gust: 0.4, fog: 0.1, wind: [2, 4.5, 2.8, 0.35] },
  },
  beirut: {
    temp: [14.0, 14.2, 16.0, 18.8, 22.0, 25.0, 27.6, 28.2, 26.8, 24.0, 19.6, 15.8],
    swing: [3, 3.2, 3.5, 4, 4, 3.5, 3.5, 3.5, 3.5, 4, 3.5, 3], spread: 2,
    wet: [0.48, 0.42, 0.3, 0.15, 0.06, 0.01, 0, 0, 0.03, 0.12, 0.28, 0.42],
    pack: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    months: 'WWSSUUUUUAAW',
    W: { sky: [4, 3.5, 2.5], spells: [1, 3], hours: [0.5, 4], level: [4.5, 4, 1.5], gust: 0.6, fog: 0.02, wind: [2.5, 4, 2.5, 0.3] },
    S: { sky: [6, 3, 1], spells: [1, 2], hours: [0.3, 2], level: [5, 4, 1], gust: 0.4, fog: 0.02, wind: [3, 4.5, 2, 0.5] },
    U: { sky: [9, 1, 0.2], spells: [1, 1], hours: [0.3, 1], level: [6, 3, 1], gust: 0.3, fog: 0.01, wind: [3.5, 5, 1.2, 0.2] },
    A: { sky: [5, 3.5, 1.5], spells: [1, 3], hours: [0.5, 3.5], level: [4.5, 4, 1.5], gust: 0.6, fog: 0.01, wind: [3.5, 4, 2, 0.15] },
  },
  cairo: {
    temp: [14.0, 15.2, 17.6, 21.4, 25.0, 27.6, 28.3, 28.2, 26.6, 23.8, 19.4, 15.6],
    swing: [5, 5.5, 6, 6.5, 6.5, 6, 5.5, 5.5, 5.5, 5.5, 5.5, 5], spread: 2,
    wet: [0.12, 0.08, 0.06, 0.03, 0.02, 0, 0, 0, 0, 0.02, 0.05, 0.1],
    pack: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dust: [0.12, 0.16, 0.24, 0.26, 0.16, 0.08, 0.06, 0.06, 0.08, 0.2, 0.26, 0.16],
    dustLevel: [6, 2.5, 0.5],
    months: 'YYYYYYYYYYYY',
    Y: { sky: [8, 1.5, 0.5], spells: [1, 1], hours: [0.3, 2], level: [7, 2.5, 0.5], gust: 0.4, fog: 0.05, wind: [3.5, 4.5, 1.6, 0.15] },
  },
};
const climateOf = (city) => CLIMATE[city] ?? CLIMATE.moscow;

// ---------- the effects (DESIGN.md, Weather) ----------

/** How far the eye reaches through it, m, by kind and level (none, light, heavy, extreme): by day it's 52 m, under a lamp at night 30. */
export const SIGHT_M = { rain: [Infinity, 46, 36, 24], sleet: [Infinity, 42, 32, 22], snow: [Infinity, 40, 28, 16], fog: [Infinity, 30, 18, 10], dust: [Infinity, 40, 24, 14] };
/** Passers-by × this, by kind and level; and by the wind (calm … gale). */
export const CROWD_K = { rain: [1, 0.9, 0.65, 0.35], sleet: [1, 0.85, 0.6, 0.3], snow: [1, 0.95, 0.72, 0.35], fog: [1, 1, 0.92, 0.8], dust: [1, 0.95, 0.65, 0.3] };
export const WIND_CROWD_K = [1, 1, 0.92, 0.75];
/** To a roll to know someone by face or look, by kind and level: hoods, umbrellas, scarves, heads down. */
export const FACE_MOD = { rain: [0, -1, -2, -3], sleet: [0, -1, -2, -3], snow: [0, -1, -2, -3], dust: [0, 0, -2, -3] };
const FACE_WHY = {
  rain: [null, 'umbrellas up', 'hoods up in the rain', 'heads down in the downpour'],
  sleet: [null, 'hoods up in the sleet', 'hoods up in the sleet', 'heads down in the sleet'],
  snow: [null, 'hats and hoods in the snow', 'collars up in the snow', 'faces into scarves in the blizzard'],
  dust: [null, null, 'scarves over faces in the dust', 'scarves over faces in the dust storm'],
};
/** Footing: the walk and the run × these on snow lying, and deep snow; a slip's chance a second running. */
export const FOOT = { lying: { walk: 0.95, run: 0.9 }, deep: { walk: 0.9, run: 0.82 } };
export const SLIP = { snow: 0.015, slush: 0.01, ice: 0.05 };
export const SLIP_S = 0.8;                                          // a slip: this long staggering

// ---------- a day, the hour's air, the ground ----------

const days = new Map(), grounds = new Map();
const keep = (m, k, v, max) => { if (m.size > max) m.delete(m.keys().next().value); m.set(k, v); return v; };

// A rough standard normal from a stream (the sum of four uniforms, scaled).
const gauss = (r) => (next(r) + next(r) + next(r) + next(r) - 2) * Math.sqrt(3);

/** A day's weather over a town (d: days since 2026-01-01): { sky, wind, dir, spells, fog, dust, dev }. */
function dayOf(town, city, d) {
  const k = `${town}|${d}`, hit = days.get(k);
  if (hit) return hit;
  const C = climateOf(city), m = calendar(d * DAY + 12 * HOUR).month, P = C[C.months[m - 1]];
  const r = stream('weather', town, d);
  const sky = weighted(r, [['clear', P.sky[0]], ['broken', P.sky[1]], ['overcast', P.sky[2]]]);
  let wind = weighted(r, P.wind.map((w, i) => [i, w]));
  const dir = (chance(r, 0.6) ? 1 : -1) * range(r, 0.6, 1);       // (mostly westerlies: east across the picture)
  const spells = [];
  if (chance(r, C.wet[m - 1])) {
    const n = P.spells[0] + int(r, P.spells[1] - P.spells[0] + 1);
    for (let i = 0; i < n; i++) {
      const s = d * 24 + range(r, 0, 24), len = range(r, P.hours[0], P.hours[1]);
      const peak = 1 + weighted(r, P.level.map((w, j) => [j, w]));
      spells.push({ s, e: s + len, peak, gust: peak >= 2 && chance(r, P.gust) ? peak : 0 });
    }
  }
  let fog = null, dust = null;
  if (chance(r, P.fog)) {                                          // (mostly in the small hours, burnt off by mid-morning; now and then an evening's)
    const s = d * 24 + (chance(r, 0.7) ? range(r, 0, 6) : range(r, 17, 22));
    fog = { s, e: s + range(r, 3, 9), peak: 1 + weighted(r, [[0, 5], [1, 3], [2, 1]]) };
    wind = Math.min(wind, 1);
  }
  if (C.dust && chance(r, C.dust[m - 1])) {                        // (a haze all day, or the wind's dust in the afternoon)
    const peak = 1 + weighted(r, C.dustLevel.map((w, j) => [j, w]));
    const s = d * 24 + (peak === 1 ? range(r, 0, 6) : range(r, 9, 13));
    dust = { s, e: s + (peak === 1 ? range(r, 14, 22) : range(r, 4, 10)), peak };
    if (peak >= 2) wind = Math.max(wind, peak - 1 + int(r, 2));
  }
  return keep(days, k, { sky, wind, dir, spells, fog, dust, dev: gauss(stream('weather-t', town, d)) }, 4000);
}

// The month's mean temperature on a day of the year (the table's means are mid-month's).
function meanTemp(C, ms) {
  const c = calendar(ms), x = (c.month - 1) + (c.day - 15) / 30.4;
  const i = Math.floor(x), k = x - i, at = (j) => C.temp[((j % 12) + 12) % 12];
  return at(i) + (at(i + 1) - at(i)) * k;
}

// The day's wander from the mean, at noon: three days' draws, the latest weighing most.
const wander = (town, city, d) => climateOf(city).spread * (dayOf(town, city, d - 2).dev + 2 * dayOf(town, city, d - 1).dev + 3 * dayOf(town, city, d).dev) / Math.sqrt(14);

// How far into a spell (s … e, hours) h is, as its strength 0 … 1: up over the first RAMP of it (or
// RAMP_MIN_H a level of its peak, up to half of it), down over as much at its end.
const shape = (sp, h) => {
  if (h <= sp.s || h >= sp.e) return 0;
  const ramp = Math.min((sp.e - sp.s) / 2, Math.max((sp.e - sp.s) * RAMP, RAMP_MIN_H * (sp.peak ?? 1)));
  return Math.min(1, (h - sp.s) / ramp, (sp.e - h) / ramp);
};
// A strength 0 … 3 as a level: under 0.15 nothing, then light, heavy, extreme.
const levelOf = (x) => (x < 0.15 ? 0 : Math.min(3, Math.ceil(x - 1e-9)));

/** The air over a town at a game time: { kind, level, wind, dir, cloud, temp }. */
function airAt(town, city, ms) {
  const C = climateOf(city), d = Math.floor(ms / DAY), h = ms / HOUR;
  const D = dayOf(town, city, d), Y = dayOf(town, city, d - 1);
  let x = 0, gust = 0, near = false;
  for (const sp of [Y.spells, D.spells].flat()) {
    if (h > sp.s - NEAR_SPELL_H && h < sp.e + NEAR_SPELL_H) near = true;
    const v = sp.peak * shape(sp, h);
    if (v > x) { x = v; gust = sp.gust; }
  }
  let level = levelOf(x), kind = null, wind = D.wind;
  // (the day's sky, and the wind's way, going over to the next day's through the night: SKY_TURN_H either side of midnight)
  const into = h - d * 24, k = into < SKY_TURN_H ? 0.5 - 0.5 * into / SKY_TURN_H : into > 24 - SKY_TURN_H ? 0.5 * (into - 24 + SKY_TURN_H) / SKY_TURN_H : 0;
  const other = into < 12 ? Y : dayOf(town, city, d + 1);
  let cloud = SKY_CLOUD[D.sky] + (SKY_CLOUD[other.sky] - SKY_CLOUD[D.sky]) * k;
  const dir = D.dir + (other.dir - D.dir) * k;
  if (near) cloud = Math.max(cloud, 0.95);
  if (level) cloud = 1;
  // The temperature: the month's mean, the day's wander (noon to noon), the hour (warmest at three).
  const f = (h - 12) / 24 - Math.floor((h - 12) / 24), d0 = Math.floor((h - 12) / 24);
  const dev = wander(town, city, d0) + (wander(town, city, d0 + 1) - wander(town, city, d0)) * f;
  const m = calendar(ms).month, swing = C.swing[m - 1] * (1 - (1 - SWING_CLOUD) * Math.max(0, Math.min(1, (cloud - 0.3) / 0.6)));
  const temp = meanTemp(C, ms) + dev + swing * Math.cos(2 * Math.PI * (hourOfDay(ms) - 15) / 24);
  if (level) {
    kind = temp < SNOW_BELOW_C ? 'snow' : temp < SLEET_BELOW_C ? 'sleet' : 'rain';
    if (level >= 2 && gust) wind = Math.max(wind, gust);
  } else {
    const fx = Math.max(Y.fog ? Y.fog.peak * shape(Y.fog, h) : 0, D.fog ? D.fog.peak * shape(D.fog, h) : 0);
    const dx = D.dust ? D.dust.peak * shape(D.dust, h) : 0;
    if (levelOf(fx) && wind <= 1) { kind = 'fog'; level = levelOf(fx); cloud = Math.max(cloud, 0.8); }
    else if (levelOf(dx)) { kind = 'dust'; level = levelOf(dx); cloud = Math.max(cloud, 0.4 + 0.15 * level); }
    else kind = cloud >= 0.75 ? 'overcast' : 'clear';
  }
  return { kind, level, wind, dir, cloud, temp };
}

// One hour of weather on the ground: g ({ cover, wet }) after an hour of air a.
function settle(g, a) {
  let { cover, wet } = g;
  if (a.kind === 'snow') cover += SETTLE[a.level] * (a.temp < 0 ? 1 : 0.6);
  else if (a.kind === 'sleet') { cover += SLEET_SETTLE[a.level] * (a.temp < 1 ? 1 : 0.3); wet = 1; }
  else if (a.kind === 'rain') { wet = 1; cover -= RAIN_MELT * a.level; }
  const melting = cover > 0.02 && a.temp > MELT_ABOVE_C;
  if (melting) cover -= MELT_PER_C * (a.temp - MELT_ABOVE_C);
  if (!FALLS.has(a.kind)) wet -= DRY_PER_H + DRY_PER_C * Math.max(0, a.temp) + DRY_PER_WIND * a.wind;
  if (melting) wet = Math.max(wet, 0.7);                          // (slush)
  return { cover: Math.max(0, Math.min(1.5, cover)), wet: Math.max(0, Math.min(1, wet)) };
}

/** The ground at the start of hour H (hours since 2026-01-01): { cover, wet }. */
function groundAt(town, city, H) {
  const k = `${town}|${H}`, hit = grounds.get(k);
  if (hit) return hit;
  const C = climateOf(city), start = H - GROUND_H;
  let g = { cover: C.pack[calendar(start * HOUR).month - 1], wet: 0 };
  for (let h = start; h < H; h++) g = settle(g, airAt(town, city, (h + 0.5) * HOUR));
  return keep(grounds, k, g, 2000);
}

/** The weather over a town (a city's) at a game time: see the header. */
export function weather(town, city, ms) {
  const a = airAt(town, city, ms), H = Math.floor(ms / HOUR), f = ms / HOUR - H;
  const g0 = groundAt(town, city, H), g1 = groundAt(town, city, H + 1);
  const cover = g0.cover + (g1.cover - g0.cover) * f, wet = g0.wet + (g1.wet - g0.wet) * f;
  const rime = FALLS.has(a.kind) || cover >= COVER_LYING ? 0 : Math.max(0, Math.min(1, (RIME_BELOW_C - a.temp) / RIME_FULL_C)) * (1 - 0.6 * a.cloud);
  return finish({ ...a, cover, wet, ice: wet > 0.3 && a.temp < ICE_BELOW_C, rime }, city, ms);
}

// ---------- pins (the debug override, the tests') ----------

/**
 * A pin from words: 'snow-heavy-gale', 'rain', 'fog-extreme', 'dust-heavy-strong', 'frost' (a clear,
 * hard frost, rime and ice), 'clear' (the weather before there was any). null when it isn't one.
 */
export function parseWeather(s) {
  if (!s) return null;
  if (typeof s === 'object') return s.kind ? s : null;
  const words = String(s).toLowerCase().split(/[-_ ,+]+/);
  const frost = words.includes('frost');
  const kind = frost ? 'clear' : words.find(w => KINDS.includes(w));
  if (!kind) return null;
  const lv = LEVELS.findIndex(l => words.includes(l)), wd = WINDS.findIndex(l => words.includes(l));
  const level = kind === 'clear' || kind === 'overcast' ? 0 : lv > 0 ? lv : 1;
  return { kind, level, wind: wd >= 0 ? wd : 0, ...(frost ? { frost: true } : {}) };
}

// A pin as weather: the ground it implies (it's been doing it a while), a temperature that makes it.
function pinned(p, city, ms) {
  const C = climateOf(city), mean = meanTemp(C, ms), L = p.level ?? 0;
  const temp = p.frost ? -9 : p.kind === 'snow' ? -3 : p.kind === 'sleet' ? 1 : p.kind === 'rain' ? Math.max(4, mean) : mean;
  const cover = p.kind === 'snow' ? [0, 0.5, 1, 1.3][L] : p.kind === 'sleet' ? 0.15 : 0;
  const wet = p.kind === 'rain' || p.kind === 'sleet' ? 1 : p.kind === 'fog' ? 0.3 : 0;
  const cloud = p.kind === 'clear' ? 0 : p.kind === 'overcast' ? 0.9 : p.kind === 'fog' ? 0.8 : p.kind === 'dust' ? 0.4 + 0.15 * L : 1;
  return finish({ kind: p.kind, level: L, wind: p.wind ?? 0, dir: p.dir ?? 1, cloud, temp, cover, wet, ice: !!p.frost || (wet > 0.3 && temp < ICE_BELOW_C), rime: p.frost ? 1 : 0, pinned: true }, city, ms);
}

const INDOORS = Object.freeze({ kind: 'clear', level: 0, wind: 0, dir: 1, cloud: 0, temp: 18, cover: 0, wet: 0, ice: false, rime: 0, indoors: true, words: '', foot: Object.freeze({ walk: 1, run: 1, slip: 0 }) });

/** The weather where the state's map is, now (or at ms): the city's, a pin's, or none in a room. Kept for the game minute. */
export function weatherAt(state, ms = state.time.ms) {
  const map = state.map;
  if (!map || map.kind !== 'street') return INDOORS;
  const min = Math.floor(ms / MIN), town = townOf(map), c = state.$wx;
  if (c && c.min === min && c.town === town && c.pin === state.weather) return c.w;
  const city = map.city ?? 'moscow', pin = parseWeather(state.weather);
  const w = pin ? pinned(pin, city, min * MIN) : weather(town, city, min * MIN);
  state.$wx = { min, town, pin: state.weather, w };
  return w;
}

// ---------- the effects, one helper each ----------

/** How far the eye reaches through the weather, m (sim/perception.js: the lesser of this and the light's reach). */
export const sightM = (w) => (w.level ? SIGHT_M[w.kind]?.[w.level] ?? Infinity : Infinity);
/** Passers-by × this (sim/crowd.js). */
export const crowdK = (w) => (w.level ? CROWD_K[w.kind]?.[w.level] ?? 1 : 1) * WIND_CROWD_K[w.wind ?? 0];
/** Footing: { walk, run } (× the pace) and slip (the chance, a second running, of a slip). Worked out once a weather. */
export const footing = (w) => w.foot ?? footingOf(w);
function footingOf(w) {
  const deep = w.cover >= COVER_DEEP, lying = w.cover >= COVER_LYING;
  const pace = deep ? FOOT.deep : lying ? FOOT.lying : null;
  const slip = w.ice ? SLIP.ice : lying ? SLIP.snow : w.cover > 0.1 && w.wet > 0.5 ? SLIP.slush : 0;
  return { walk: pace?.walk ?? 1, run: pace?.run ?? 1, slip };
}

/** What the weather does to a roll to know someone by their face or their look: [{ why, v }]. */
export function weatherMods(state) {
  const w = weatherAt(state), v = FACE_MOD[w.kind]?.[w.level] ?? 0;
  return v ? [{ why: FACE_WHY[w.kind][w.level], v }] : [];
}

// ---------- the words ----------

// Each city's wind, when it's up; its grey sky; its drizzle.
const LOCAL = {
  moscow: { wind: 'a raw wind off the river', grey: 'Low grey cloud' },
  london: { wind: 'a wind down the street', grey: 'Grey skies', drizzle: true },
  beirut: { wind: 'a wind off the sea', grey: 'Cloud over the sea' },
  cairo: { wind: 'a wind off the desert', grey: 'Cloud, for once' },
};
const FALL_WORDS = {
  rain: [null, 'Light rain', 'Heavy rain', 'A downpour'], sleet: [null, 'Sleet', 'Heavy sleet', 'Driving sleet'],
  snow: [null, 'Light snow', 'Heavy snow', 'Thick snow'], fog: [null, 'Mist', 'Fog', 'Thick fog'], dust: [null, 'Haze', 'Dust', 'A dust storm'],
};

// The weather in a few words, for the watch: 'Sleet, and a raw wind off the river'.
function finish(w, city, ms) {
  const L = LOCAL[city] ?? LOCAL.moscow, h = hourOfDay(ms), night = h < 7 || h > 17.5;
  let what;
  if (w.kind === 'clear') what = w.temp <= -3 || w.frost ? (night ? 'A clear, hard frost' : 'A clear frost') : night ? 'A clear night' : w.cloud >= 0.4 ? 'Broken cloud' : w.temp >= 18 ? 'Sun' : 'Clear';
  else if (w.kind === 'overcast') what = L.grey;
  else if (w.kind === 'rain' && w.level === 1 && L.drizzle) what = 'Drizzle';
  else if (w.kind === 'snow' && w.level === 3 && w.wind >= 2) what = 'A blizzard';
  else if (w.kind === 'rain' && w.level === 3 && w.wind >= 2) what = 'A storm';
  else what = FALL_WORDS[w.kind][w.level];
  const ground = FALLS.has(w.kind) ? null : w.ice ? 'ice underfoot' : w.cover >= COVER_LYING ? 'snow lying' : w.wet >= 0.5 && w.kind !== 'fog' ? 'the streets wet' : null;
  const wind = w.wind === 3 && what !== 'A blizzard' && what !== 'A storm' ? 'and a gale' : w.wind === 2 ? `and ${L.wind}` : w.wind === 1 && !w.level ? 'a breeze' : null;
  w.words = [what, ground, wind].filter(Boolean).join(', ');
  w.foot = footingOf(w);
  return w;
}

/**
 * The instinct's word on the weather, when it matters (null when it doesn't): { id, text, tone }. For
 * a scene's rules (the free walk's): running on ice or snow is a note, the rest its quietest line.
 */
export function weatherLine(state, me) {
  const w = weatherAt(state);
  if (w.indoors) return null;
  const run = me?.gait === 'run' || me?.gait === 'stagger';
  if (run && w.ice) return { id: 'wx-ice-run', tone: 'note', text: 'Ice under your feet: running on it is how ankles go.' };
  if (run && w.cover >= COVER_LYING) return { id: 'wx-snow-run', tone: 'note', text: 'Running in snow: one bad step and you\'re on your back in it.' };
  if (FALLS.has(w.kind) && w.level >= 2) return { id: `wx-${w.kind}`, text: { rain: 'The rain\'s a friend: hoods up, umbrellas, nobody looks at faces. Yours included.', sleet: 'In sleet like this, everyone walks with their head down. Nobody looks at faces; nor can you.', snow: 'In this snow everyone\'s a hood and a pair of shoulders. Faces are hard to know, and so is yours.' }[w.kind] };
  if (w.kind === 'fog' && w.level >= 2) return { id: 'wx-fog', text: 'Fog: a few doors, and then nothing. Whoever\'s behind you is as blind as you are, and closer.' };
  if (w.kind === 'dust' && w.level >= 2) return { id: 'wx-dust', text: 'Dust: scarves over faces, eyes half shut. Nobody\'s looking at anyone.' };
  if (crowdK(w) <= 0.7) return { id: 'wx-empty', text: 'The weather\'s emptied the street: fewer people to be one of.' };
  if (w.ice) return { id: 'wx-ice', text: w.cover > 0.1 ? 'Ice under the slush. Walk; don\'t run.' : 'Ice on the pavement, thin and hard to see. Walk; don\'t run.' };
  return null;
}

// What the log says when it turns: [from, to] → a line.
const START = { rain: 'It starts to rain: dark spots on the pavement, then all of it.', sleet: 'Sleet, starting: half rain, half ice, and all of it down your collar.',
  snow: 'It\'s starting to snow: big, slow flakes.', fog: 'Fog coming in: the far end of the street goes first.', dust: 'A haze comes over, the colour of the desert.' };
const HARDER = { rain: 'The rain comes down harder.', sleet: 'The sleet comes harder, stinging.', snow: 'The snow thickens.', fog: 'The fog thickens.', dust: 'The dust thickens: grit on the wind.' };
const WORST = { rain: 'A downpour now: the gutters running, everyone under something.', sleet: 'Sleet in sheets.', snow: 'The snow\'s so thick now the far side of the street is gone.',
  fog: 'Thick fog: a few metres, and then nothing.', dust: 'A dust storm: grit in your teeth, the sun a dull coin.' };
const EASING = { rain: 'The rain eases.', sleet: 'The sleet eases.', snow: 'The snow thins.', fog: 'The fog thins.', dust: 'The dust thins.' };
const STOP = { rain: 'The rain stops. Everything drips.', sleet: 'The sleet stops.', snow: 'The snow stops.', fog: 'The fog lifts.', dust: 'The air clears.' };

// Whether the weather's worth a word when a scene opens.
const notable = (w) => (w.kind !== 'clear' && w.kind !== 'overcast') || w.ice || w.cover >= COVER_LYING || w.wind === 3 || (w.kind === 'clear' && w.temp <= -3);

/**
 * Once a second on the street (sim/game.js): when the weather turns, the log says so; when a scene
 * opens in weather worth a word, it says what it's like. What was last said is kept (state.flags.wx:
 * 'kind level', and 'g' in a gale), and nothing at all while there's been nothing to say.
 */
export function weatherTick(state, bus) {
  const w = weatherAt(state);
  if (w.indoors) return;
  const was = state.flags.wx, key = `${w.kind} ${w.level}${w.wind === 3 ? ' g' : ''}`;
  if (was === key || (was === undefined && !notable(w))) return;
  state.flags.wx = key;
  let text = null;
  if (was === undefined) text = `${w.words}.`;
  else {
    const [k0, l0] = was.split(' '), level0 = Number(l0), quiet0 = k0 === 'clear' || k0 === 'overcast', quiet = w.kind === 'clear' || w.kind === 'overcast';
    if (quiet0 && !quiet) text = w.level >= 3 ? WORST[w.kind] : START[w.kind];
    else if (!quiet0 && quiet) text = STOP[k0];
    else if (!quiet0 && k0 !== w.kind) text = FALLS.has(k0) && FALLS.has(w.kind) ? `The ${k0} turns to ${w.kind}.` : `${STOP[k0]} ${START[w.kind]}`;
    else if (!quiet && w.level > level0) text = w.level >= 3 ? WORST[w.kind] : HARDER[w.kind];
    else if (!quiet && w.level < level0) text = EASING[w.kind];
    if (w.wind === 3 && !was.endsWith(' g')) text = `${text ? `${text} ` : ''}The wind gets up: a gale.`;
    else if (w.wind < 3 && was.endsWith(' g') && !text) text = 'The wind drops.';
  }
  if (text) say(state, bus, { kind: 'note', text });
}
