// TRADECRAFT sim: game time and the calendar.
//
// Game time is whole milliseconds since 2026-01-01 00:00, Moscow time (state.time.ms). Whole
// milliseconds, so a tick (TICK_MS) adds exactly and a long game never drifts. Moscow keeps UTC+3
// all year (no daylight saving since 2014), so local time is game time: no zones to convert until
// the game goes abroad, and then a posting carries its offset (TZ_H).
//
// Time runs one second for one second while the player is on a map; actions that take time (sleep,
// travel, the cover job) jump it (the caller adds their length and the world gets outcomes for the
// gap, not a tick-by-tick simulation). The calendar is the proleptic Gregorian one, by Howard
// Hinnant's civil-date algorithms: pure integer arithmetic, no Date object, so it's the same in
// every browser and in the tests.

export const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;
export const TICK_MS = 50;                                         // the sim's step: 20 a second
export const TZ_H = 3;                                             // Moscow, UTC+3

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Days since 1970-01-01 of a civil date, and back.
function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9);
  return [era * 400 + yoe + (m <= 2 ? 1 : 0), m, d];
}
const EPOCH_DAYS = daysFromCivil(2026, 1, 1);

/** Game time of a local date and time (month 1–12). */
export const at = (y, m, d, hh = 0, mm = 0, ss = 0) => (daysFromCivil(y, m, d) - EPOCH_DAYS) * DAY + hh * HOUR + mm * MIN + ss * SEC;

/** The calendar at a game time: { year, month 1–12, day, weekday 0 (Monday)–6, hour, minute, second, doy 1–366, dayIndex }. */
export function calendar(ms) {
  const dayIndex = Math.floor(ms / DAY), inDay = ms - dayIndex * DAY;
  const [year, month, day] = civilFromDays(EPOCH_DAYS + dayIndex);
  const weekday = ((EPOCH_DAYS + dayIndex + 3) % 7 + 7) % 7;      // 1970-01-01 was a Thursday
  const doy = EPOCH_DAYS + dayIndex - daysFromCivil(year, 1, 1) + 1;
  return { year, month, day, weekday, doy, dayIndex,
    hour: Math.floor(inDay / HOUR), minute: Math.floor(inDay / MIN) % 60, second: Math.floor(inDay / SEC) % 60 };
}

/** Hours since local midnight, fractional. */
export const hourOfDay = (ms) => (((ms % DAY) + DAY) % DAY) / HOUR;

const pad = (n) => String(n).padStart(2, '0');
/** '16:05' */
export function clockText(ms) { const c = calendar(ms); return `${pad(c.hour)}:${pad(c.minute)}`; }
/** 'Monday 2 November 2026' */
export function dateText(ms) { const c = calendar(ms); return `${WEEKDAYS[c.weekday]} ${c.day} ${MONTHS[c.month - 1]} ${c.year}`; }
/** 'Mon 2 Nov, 16:05' */
export function stampText(ms) { const c = calendar(ms); return `${WEEKDAYS[c.weekday].slice(0, 3)} ${c.day} ${MONTHS[c.month - 1].slice(0, 3)}, ${pad(c.hour)}:${pad(c.minute)}`; }
