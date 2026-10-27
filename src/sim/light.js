// TRADECRAFT sim: light, from the clock. One helper for what the scene shows and what the dice see.
//
// The sun stands where it really stands over the city (Moscow, 55.75° N, 37.62° E, unless a city's
// `geo` says otherwise: sim/cities/, its latitude, longitude and the clock's offset from UTC) at the
// game time, by NOAA's short solar-position formulas (good to a fraction of a degree). Its elevation
// sets everything:
//   - sky(ms): the light of the whole scene, as keyframes by elevation (full day, golden, sunset,
//     blue hour, night), each the colours and strengths of the renderer's two lights (a sun and a
//     sky fill, calibrated in src/art/pixelart.js so a front shows its painted colour by day), the
//     tint a sprite takes standing in the open, how far the windows and lamps are lit (glow) and how
//     dark the sun's shadows are. The renderer only copies these numbers into three.js.
//   - lightAt(lamps, x, z, ms): the light at a spot, the open-air tint plus every lamp's pool it
//     stands in (a bright core to r, a dimmer ring to 1.5 r, hard-edged as pixel art draws a pool).
//     The renderer tints a sprite with it; lightLevel() turns it into the one number checks read
//     (0 pitch dark … 1 daylight). So what you see is what's rolled.
// The sun's direction on screen stays the art's (from the upper left): sprites are shaded that way,
// and a sun swinging round them would contradict their drawing. Its height, colour and strength move.
import { calendar, hourOfDay, TZ_H } from './clock.js';

export const LAT = 55.75, LON = 37.62;
export const MOSCOW_GEO = { lat: LAT, lon: LON, tz: TZ_H };
const RAD = Math.PI / 180;

/** The sun at a game time (a city's local clock): { elev, az } in degrees (azimuth from north, clockwise). */
export function sun(ms, geo = MOSCOW_GEO) {
  const { doy } = calendar(ms);
  const hour = hourOfDay(ms), TZ_H = geo.tz, LON = geo.lon, LAT = geo.lat;
  const g = 2 * Math.PI / 365 * (doy - 1 + (hour - TZ_H - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqt + 4 * LON - 60 * TZ_H;               // true solar time, minutes
  const ha = (tst / 4 - 180) * RAD;
  const lat = LAT * RAD;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / RAD + 180;
  return { elev: 90 - zen / RAD, az: (az + 360) % 360 };
}

// Keyframes by the sun's elevation (degrees), high to low. Colours sRGB hex; k the light's strength
// in the renderer's units (× π); tint linear RGB.
const KEYS = [
  { elev: 18, sun: 0xfff2dc, sunK: 0.79, sky: 0xdde6ff, ground: 0x9a8a78, skyK: 0.6, tint: [1, 1, 1] },
  { elev: 7, sun: 0xffe2b4, sunK: 0.74, sky: 0xdcdcf0, ground: 0x9a8470, skyK: 0.56, tint: [1, 0.95, 0.86] },
  { elev: 0.5, sun: 0xffb685, sunK: 0.48, sky: 0xa2a8cc, ground: 0x5e5258, skyK: 0.43, tint: [0.76, 0.66, 0.6] },   // a November sunset: cool, a warm glimmer
  { elev: -4, sun: 0x95c1e3, sunK: 0.16, sky: 0x6a8fc4, ground: 0x23294a, skyK: 0.32, tint: [0.14, 0.19, 0.3] },
  { elev: -9, sun: 0x95c1e3, sunK: 0.15, sky: 0x5d8fc2, ground: 0x1b2541, skyK: 0.26, tint: [0.061, 0.118, 0.193] },
];
const lerp = (a, b, k) => a + (b - a) * k;
const lerpHex = (a, b, k) => {
  const ch = (h, s) => (h >> s) & 255;
  return (Math.round(lerp(ch(a, 16), ch(b, 16), k)) << 16) | (Math.round(lerp(ch(a, 8), ch(b, 8), k)) << 8) | Math.round(lerp(ch(a, 0), ch(b, 0), k));
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * The scene's light at a game time: { elev, sun, sunK, sky, ground, skyK, tint, glow, shadow }.
 * glow 0..1: windows and lamps lit (on from 2° above the horizon to 3° below);
 * shadow 0..1: the sun's shadows (they fade out as it sets; the moon casts none).
 */
export function sky(ms, geo = MOSCOW_GEO) {
  const { elev } = sun(ms, geo);
  let i = 0;
  while (i < KEYS.length - 1 && elev < KEYS[i + 1].elev) i++;
  const a = KEYS[i], b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const k = a === b ? 0 : clamp01((a.elev - elev) / (a.elev - b.elev));
  return {
    elev,
    sun: lerpHex(a.sun, b.sun, k), sunK: lerp(a.sunK, b.sunK, k),
    sky: lerpHex(a.sky, b.sky, k), ground: lerpHex(a.ground, b.ground, k), skyK: lerp(a.skyK, b.skyK, k),
    tint: a.tint.map((v, j) => lerp(v, b.tint[j], k)),
    glow: clamp01((2 - elev) / 5),
    shadow: clamp01(elev / 4),
  };
}

const toLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linearCache = new Map();
/** An sRGB hex colour in linear RGB. */
export function linear(hex) {
  if (!linearCache.has(hex)) linearCache.set(hex, [toLinear((hex >> 16) & 255), toLinear((hex >> 8) & 255), toLinear(hex & 255)]);
  return linearCache.get(hex);
}

/** A lamp's pool of light on the ground. Lamps are map data: { x, z, r, color, core, ring }. */
export const LAMP = { r: 2.0, color: 0xe7b84a, core: 0.5, ring: 0.2 };

/** The light at (x, z): linear RGB, the open-air tint plus the pools of the lamps (lit by `glow`). */
export function lightAt(lamps, x, z, ms, s = sky(ms)) {
  const out = s.tint.slice();
  if (s.glow > 0) for (const p of lamps) {
    const d = Math.hypot(x - p.x, z - p.z);
    const k = d < p.r ? p.core + p.ring : d < p.r * 1.5 ? p.ring : 0;
    if (!k) continue;
    const c = linear(p.color);
    for (let j = 0; j < 3; j++) out[j] += c[j] * k * s.glow;
  }
  return out;
}

/** The one number checks read: how lit a spot is, 0 (pitch dark) … 1 (daylight). */
export function lightLevel(lamps, x, z, ms, s) {
  const [r, g, b] = lightAt(lamps, x, z, ms, s);
  return clamp01(0.3 * r + 0.59 * g + 0.11 * b);
}

/** Light as a check reads it: 'day', 'dim' (dusk, or a lamp's pool at night) or 'dark'. */
export function lightBand(level) { return level >= 0.6 ? 'day' : level >= 0.25 ? 'dim' : 'dark'; }
