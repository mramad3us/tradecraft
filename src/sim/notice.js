// TRADECRAFT sim: what people notice about you (the user, 2026-10-27: "conspicuous wounds and blood (more
// heat, faces remembered), cleaning up in public toilets and businesses with toilets"). The engine's, in
// any scene on the street.
//
// Blood on you shows (sim/health.js p.bloody: on the face, from a wound to the head; on the clothes,
// from any other): shown() says what shows. On the street, every second people who can see you within
// SEEN_M count (state.notice.bloodS, seconds seen); each BLOOD_HEAT_S of it is a face remembered, a word
// to a policeman later: +1 heat (the legend's), at most BLOOD_HEAT_MAX a day. The first time, the log
// says so. The face washes clean in a café's, a bar's or a restaurant's toilet (sim/shops.js 'wash');
// the clothes want changing.
// mods(): what shows, for someone looking for you (sim/scenarios: the tail's Orlov, Blown's hunters):
// blood on the face +4, on the clothes +2, something in your hand +3, something at your belt with no
// coat over it +2, a pocket bulging +1 (sim/items.js placed()); a sneeze, for a few seconds after, +3
// (sim/wet.js). One helper, so it counts the same
// everywhere.
import { addHeat } from './heat.js';
import { say } from './log.js';
import { seesActor } from './perception.js';
import { DAY } from './clock.js';
import { showing } from './items.js';
import { SNEEZE_MOD } from './wet.js';

export const SEEN_M = 10;
export const BLOOD_HEAT_S = 20;
export const BLOOD_HEAT_MAX = 6;
export const FACE_MOD = 4, CLOTHES_MOD = 2, HELD_MOD = 3, BELT_MOD = 2, BULGE_MOD = 1;

/** What shows on someone: { face, clothes } (blood), hand (a weapon held), belt (one tucked there with no coat over it), bulge (a pocket stuffed: sim/items.js). */
export function shown(p) {
  const c = p ? showing(p) : [];
  return { face: p?.bloody?.face !== undefined, clothes: p?.bloody?.clothes !== undefined, hand: !!p?.hand, belt: c.some(o => o.at === 'belt'), bulge: c.some(o => o.at !== 'belt') };
}

/** What shows, as modifiers for someone looking for them. */
export function mods(p) {
  const s = shown(p), out = [];
  if (s.face) out.push({ why: 'blood on your face', v: FACE_MOD });
  else if (s.clothes) out.push({ why: 'blood on your clothes', v: CLOTHES_MOD });
  if (s.hand) out.push({ why: 'something in your hand', v: HELD_MOD });
  if (p?.sneezeS) out.push({ why: 'a sneeze, a head turned', v: SNEEZE_MOD });   // (a cold's: sim/wet.js)
  if (s.belt) out.push({ why: 'something at your belt', v: BELT_MOD });
  else if (s.bulge) out.push({ why: 'a bulge in your pocket', v: BULGE_MOD });
  return out;
}

/** Once a second, on the street: people seeing blood on you remember the face. */
export function notice(state, bus, me) {
  const p = state.people[state.player], s = shown(p);
  if (!me || me.hidden || state.map.kind !== 'street' || !(s.face || s.clothes) || !state.legend) return;
  const saw = state.actors.some(a => a !== me && !a.hidden && a.who !== state.player && (a.row ?? state.map.row) === (me.row ?? state.map.row) && Math.hypot(a.x - me.x, a.z - me.z) < SEEN_M && seesActor(state, a, me));
  if (!saw) return;
  const n = (state.notice ??= { bloodS: 0, day: Math.floor(state.time.ms / DAY), heat: 0 });
  if (n.day !== Math.floor(state.time.ms / DAY)) Object.assign(n, { day: Math.floor(state.time.ms / DAY), heat: 0 });
  n.bloodS += s.face ? 1 : 0.5;                                     // (a bloody face is remembered faster than a stained coat)
  if (!n.told) { n.told = true; say(state, bus, { kind: 'note', text: s.face ? 'People look at you, and then away, fast: the blood on your face. They\'ll remember it.' : 'A glance at your coat, and a second one: the stain on it.' }); }
  if (n.bloodS >= BLOOD_HEAT_S && n.heat < BLOOD_HEAT_MAX) { n.bloodS -= BLOOD_HEAT_S; n.heat++; addHeat(state, 1); }
}
