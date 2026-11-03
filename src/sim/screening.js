// TRADECRAFT sim: the embassy's arch (the user, 2026-11-03: "GUNS SHOULD BE RARE AND HARD TO GET, HIDE, EMBASSY
// METAL DETECTOR SHOULD RING"). Everyone through the lobby goes through the arch of the metal detector and their
// bags through the X-ray (sim/interiors/embassy.js), staff too: a gun, a magazine or a box of rounds rings it,
// and the Marine holds you there till the security office comes down. What they find is taken (a station
// officer has no business walking a gun past the Marine: it goes to the regional security officer's safe, and
// the paperwork to the chief), and the embassy's view of you takes it: SCREEN_COVER off your cover standing,
// a line in the log the week's review reads. Blades go through the X-ray's tray and come back to you on the
// far side. screen() is called as you pass the arch, walked through or skipped (a day's work from elsewhere:
// sim/scenarios/campaign.js), once a visit.
import { isGun, isMag, isBox, armName, disarm } from './firearms.js';
import { thingName } from './items.js';
import { say } from './log.js';

export const SCREEN_COVER = 25;

/** What on p rings the arch: guns, magazines, rounds (by calibre). */
export function rings(p) {
  const out = [p.hand, ...(p.items ?? [])].filter(k => isGun(k) || isMag(k) || isBox(k));
  for (const [cal, n] of Object.entries(p.rounds ?? {})) if (n > 0) out.push(`box-${cal}`);
  return out;
}

/** Through the arch: what rings it found and taken, the cover standing hit. Returns the things taken (none: []). */
export function screen(state, bus, p, c = state.campaign) {
  const found = rings(p);
  if (!found.length) return [];
  const words = found.map(k => (k.startsWith('box-') ? 'the rounds' : isGun(k) ? thingName(k) : armName(k)));
  // (the drawer's left alone: only what's on you; what's carried in the drawer stays home)
  const stash = p.stash, stashN = p.stashN;
  disarm(p);
  p.stash = stash; p.stashN = stashN;
  if (c?.posting) {
    c.posting.cover = Math.max(0, c.posting.cover - SCREEN_COVER);
    c.posting.rso = (c.posting.rso ?? 0) + 1;
    c.log?.push({ ms: state.time.ms, text: `The arch went off on you in the lobby: ${[...new Set(words)].join(', ')}, taken to the security office's safe, and a report to the chief.` });
  }
  say(state, bus, { kind: 'note', text: `The arch shrieks. The Marine's hand comes up: "Sir. Step back through, please. Arms out." ${cap([...new Set(words)].join(', '))}: on the tray, then gone, with the security officer, who doesn't say much and writes a great deal. Your cover standing: −${SCREEN_COVER}.` });
  return found;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
