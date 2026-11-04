// TRADECRAFT sim: the embassy's arch (the user, 2026-11-03: "GUNS SHOULD BE RARE AND HARD TO GET, HIDE, EMBASSY
// METAL DETECTOR SHOULD RING"). Everyone through the lobby goes through the arch of the metal detector and their
// bags through the X-ray (sim/interiors/embassy.js), staff too: a gun, a magazine or a box of rounds rings it,
// and the Marine holds you there till the security office comes down. What they find is taken (a station
// officer has no business walking a gun past the Marine: it goes to the regional security officer's safe, and
// the paperwork to the chief), and the embassy's view of you takes it: SCREEN_COVER off your cover standing,
// a line in the log the week's review reads. Blades go through the X-ray's tray and come back to you on the
// far side. Body armour (sim/armour.js): a plate carrier's steel plates ring it too, and go through the X-ray and
// come back to you (no cover lost for that alone, a line in the log); a soft vest's aramid doesn't ring at all.
// screen() is called as you pass the arch, walked through or skipped (a day's work from elsewhere:
// sim/scenarios/campaign.js), once a visit.
import { isGun, isMag, isBox, armName, disarm } from './firearms.js';
import { thingName } from './items.js';
import { armourOf } from './armour.js';
import { say } from './log.js';

export const SCREEN_COVER = 25;

export const PLATES = 'armour-plates';
/** What on p rings the arch: guns, magazines, rounds (by calibre); a plate carrier's steel (PLATES; a soft vest's aramid doesn't). */
export function rings(p) {
  const out = [p.hand, ...(p.items ?? [])].filter(k => isGun(k) || isMag(k) || isBox(k));
  for (const [cal, n] of Object.entries(p.rounds ?? {})) if (n > 0) out.push(`box-${cal}`);
  if (armourOf(p)?.metal) out.push(PLATES);
  return out;
}

/** Through the arch: what rings it found and taken, the cover standing hit; plates through the X-ray and back. Returns the things taken (none: []). */
export function screen(state, bus, p, c = state.campaign) {
  const all = rings(p), plates = all.includes(PLATES), found = all.filter(k => k !== PLATES);
  if (plates && !found.length) {                                    // (only the plates: off, through the X-ray, back on the far side)
    c?.log?.push({ ms: state.time.ms, text: 'The arch went off on you in the lobby: steel plates, in a carrier. Through the X-ray, and a long look from the Marine.' });
    say(state, bus, { kind: 'note', text: 'The arch shrieks. "Sir. Step back through, please." It\'s the plates: the carrier comes off, goes through the X-ray on its own, and comes back to you on the far side. The Marine watches you buckle it on again, and says nothing at all.' });
    return [];
  }
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
  say(state, bus, { kind: 'note', text: `The arch shrieks. The Marine's hand comes up: "Sir. Step back through, please. Arms out." ${cap([...new Set(words)].join(', '))}: on the tray, then gone, with the security officer, who doesn't say much and writes a great deal.${plates ? ' The plate carrier he hands back.' : ''} Your cover standing: −${SCREEN_COVER}.` });
  return found;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
