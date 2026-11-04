// TRADECRAFT sim: the station's armoury (the user, 2026-11-03: "legal purchase and carry … carried legally only where
// that's real"; the armour's "a way to come by it in the campaign"). At the embassy, the chief's office: what the law of
// the posting's country lets a diplomat carry (its profile's law.diplomats, sim/countries/; DESIGN.md, Firearms: the law
// by country), and what the regional security officer keeps in his stores.
//
// **A sidearm** (SIDEARM): asked for, a permit filed with the host government, ready PERMIT_DAYS on (the chief's say-so
// first where the law's unclear: only with the heat up, HOT_HEAT, where somebody's plainly on you); collected at the
// chief's office once it's come: the station's SIG, two magazines and a box of fifty, on the belt, and the permit
// (p.permit: { country, gun, until }). A search that finds the permitted gun hands it back (sim/police.js). Where a
// diplomat can't carry (Russia, the UK), no: the chief says why.
// **A vest** (the soft kind: sim/armour.js), from the RSO's stores where the post's dangerous enough to keep them
// (VEST_AT); worn under your top, till you take it off at the wardrobe.
import { DAY } from './clock.js';
import { newGun, newMag, MODELS } from './firearms.js';
import { wear } from './armour.js';
import { countryOfCity } from './countries/index.js';

export const PERMIT_DAYS = { lb: 3, eg: 7 }, HOT_HEAT = 60, PERMIT_YEAR_DAYS = 365, SIDEARM = 'p229', MAGS = 2, ROUNDS = 50;
export const VEST_AT = new Set(['lb', 'eg']);
// (why not, by the law: the chief's words)
const NO = {
  ru: '"A gun? Here?" The chief almost laughs. "The FSB would love that: a diplomat with a pistol, on the evening news, and you on the next plane. No."',
  gb: '"The Met would have to agree, and the Met doesn\'t agree to things like that for people like us. No."',
  us: '"You\'re at home. Go and buy one, like everybody else."',
};

/** What the chief's office offers, now: [{ key, label, off }]. */
export function chiefWays(state) {
  const c = state.campaign, p = state.people[state.player], now = state.time.ms, K = countryOfCity(c.posting.city), id = K?.id;
  const law = K?.law?.diplomats, P = c.permit;
  const out = [{ key: 'desk', label: 'What\'s on: the assignments, the network' }];
  if (P?.ready && now >= P.ready && !P.got) out.push({ key: 'collect', label: 'The permit\'s come: the sidearm, from the security office' });
  else if (P?.ready && !P.got) out.push({ key: 'wait', label: `The permit: filed, back ${dayWord(P.ready, now)}`, off: 'it hasn\'t come' });
  else if (!P?.got) {
    const can = law === 'permit' && PERMIT_DAYS[id] ? null : law === 'unclear' && PERMIT_DAYS[id] ? (c.posting.heat >= HOT_HEAT ? null : 'the chief won\'t, without someone plainly on you') : 'the law here won\'t have it';
    out.push({ key: 'sidearm', label: 'A sidearm, and a permit to carry it', off: can });
  }
  if (!p.armour && !c.vest) out.push({ key: 'vest', label: 'A vest from the security office\'s stores, to wear under your clothes', off: VEST_AT.has(id) ? null : 'not kept at this post' });
  return out;
}
const dayWord = (ms, now) => { const d = Math.floor(ms / DAY) - Math.floor(now / DAY); return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`; };

/** A way at the chief's office, taken: its words. */
export function chiefDo(state, key) {
  const c = state.campaign, p = state.people[state.player], now = state.time.ms, K = countryOfCity(c.posting.city), id = K?.id;
  const way = chiefWays(state).find(w => w.key === key);
  if (!way || way.off) return way?.off ? `Not that: ${way.off}.${key === 'sidearm' && NO[id] ? ` ${NO[id]}` : ''}` : null;
  if (key === 'sidearm') {
    c.permit = { asked: now, ready: now + PERMIT_DAYS[id] * DAY };
    return `"If you think you need one." The chief signs the form without reading it twice. The security office files for a permit with the ${id === 'lb' ? 'Ministry of Defence' : 'Interior Ministry'}: back ${dayWord(c.permit.ready, now)}, and the gun comes with it.`;
  }
  if (key === 'collect') {
    const gun = newGun(p, SIDEARM, { cond: 0.97 });
    const mags = Array.from({ length: MAGS - 1 }, () => newMag(p, SIDEARM, MODELS[SIDEARM].cap));
    (p.items ??= []).push(gun, ...mags);
    p.rounds = { ...(p.rounds ?? {}), [MODELS[SIDEARM].cal]: (p.rounds?.[MODELS[SIDEARM].cal] ?? 0) + ROUNDS };
    p.permit = { country: id, gun, until: now + PERMIT_YEAR_DAYS * DAY };
    c.permit.got = now;
    return `The security officer signs it out to you: ${MODELS[SIDEARM].name}, loaded, a spare magazine, a box of fifty, and a permit with your photograph on it, good for a year. "On the belt, under the jacket. Nobody sees it, ever."`;
  }
  if (key === 'vest') {
    wear(p, 'light');
    c.vest = now;
    return 'A soft vest from the stores, your size near enough: under the shirt, the straps tight. You walk differently for an hour, and then you don\'t.';
  }
  return null;
}
