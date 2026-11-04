// TRADECRAFT sim: what you can ring for (the user, 2026-11-04: "phone services (burner phones to avoid heat but single use,
// our own phone increases heat each time we use it to do anything spook-related.)"). The campaign's, from the mind's Phone
// leaf (src/ui/mind.js), each call from a phone of PHONES.
//
// **Which phone**: a burner (sim/clothes.js, a phone shop's; used once and dumped: nothing to trace); your own (a watched
// line: watchedLine(), heat 1 and over, which official cover always is (embassy staff are watched) and an unofficial one
// becomes once its heat's ever risen past 1, never back to nothing: each spook-related call on it, OWN_HEAT; the user:
// "we can make heat as official cover as 1+ and never 0 so we can develop a single system for all postings"); the flat's
// (at home: food, nothing else).
// **The services** (services(): each with what it costs and why it can't be, ring(): rung):
//   - **Food** (at the flat; any phone, nothing spook-related): FOOD_USD, at the door in FOOD_MIN, and eaten.
//   - **A taxi** (on the street; your own phone or a burner): at your kerb in TAXI_MIN, stopped for you as one hailed is
//     (sim/taxi.js), wherever you tell it. Rung from your own phone, watched, where the security services aren't the
//     agency's friends (not the UK's, not the US's: FRIENDLY): TAXI_HEAT, and they know where it took you: at the other
//     end a covert team picks you up, TRACKED_P of the time (sim/scenarios/campaign.js tracked()).
//   - **A clean gun** (the agency's dead drop: COST.gun of the support, sim/support.js): the call's code (a dry cleaner's
//     number, a suit that's ready), a bench of the posting's in DROP_H, there DROP_FOR_H: a pistol with no history in a
//     sports bag (its magazine, a spare, a box of rounds), into your carrier bag.
//   - **Special equipment** (EQUIPMENT, the agency's drop the same way; a disguise kit, its uses: sim/disguise.js).
//   - **A clandestine clinic** (COST.clinic): a safe house of the posting's made one, a doctor of the agency's there from
//     CLINIC_H on for CLINIC_DAYS: at its door, everything seen to as a hospital would (sim/services.js admit(), official
//     no: nothing on any record, nothing reported), its hours.
//   - **A clean-up crew** (COST.cleanup; a station with the most support only, CLEANUP_KINDS): the dead here (CLEANUP_M,
//     nobody's called it in yet) gone in CLEANUP_MIN, a van and two men in overalls; nothing for anyone to call in.
//   - **Extraction** (COST.extract; hunted, sim/hunt.js): a car somewhere in the city (EXTRACT_ROWS streets off), the
//     waypoint at it, waiting EXTRACT_WAIT_MIN; reached, it takes you to the embassy, and the hunt's over outside it
//     without you (sim/scenarios/campaign.js extracted()), the ambassador's view of you EXTRACT_COVER the less.
// Spook-related calls cost OWN_HEAT on a watched line of your own; a burner, nothing. What's rung for and still to come is
// the campaign's (c.rung), heard each second (second()).
import { stream, chance, range, int, pick } from './rng.js';
import { MIN, HOUR, DAY, clockText } from './clock.js';
import { say } from './log.js';
import { addHeat } from './heat.js';
import { pay, price } from './money.js';
import { eat } from './needs.js';
import { burnersOf, spendBurner } from './items.js';
import { supportOf, spend } from './support.js';
import { sendFare } from './traffic.js';
import { countryOfCity } from './countries/index.js';
import { townOf } from './cities/index.js';
import { sectionOf, LINE } from './city.js';
import { placeName, streetName } from './map/street.js';
import { newGun, newMag, MODELS } from './firearms.js';
import { huntOf } from './hunt.js';
import { EQUIPMENT } from './disguise.js';

export const PHONES = { burner: 'From a burner', own: 'From your own phone', home: 'From the flat\'s phone' };
export const FOOD_USD = 18, FOOD_MIN = [30, 45], TAXI_MIN = [3, 6], TAXI_HEAT = 2, TRACKED_P = 0.5, OWN_HEAT = 4;
export const COST = { gun: 20, clinic: 40, cleanup: 60, extract: 80 };
export const DROP_H = [4, 10], DROP_FOR_H = 36, DROP_AT_M = 2.5, CLINIC_H = 4, CLINIC_DAYS = 3, CLEANUP_M = 40, CLEANUP_MIN = [4, 8];
export const EXTRACT_ROWS = [2, 4], EXTRACT_WAIT_MIN = 40, EXTRACT_COVER = 10, CLEANUP_KINDS = ['firstTour', 'official'];
export const FRIENDLY = new Set(['gb', 'us']);
// (the agency's clean gun: what its armourer has, by the posting's country)
const CLEAN_GUN = { ru: 'makarov', gb: 'glock19', lb: 'browning', eg: 'helwan', us: 'glock19' };

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);

/** Whether your own phone's a watched line: your heat 1 or more (official cover always is; an unofficial one once it's risen). */
export const watchedLine = (c) => (c?.posting?.heat ?? 0) >= 1;

/** What's rung for and still to come (the campaign's): { food, taxi, drops, clinic, cleanup, extract }. */
const rungOf = (c) => (c.rung ??= { drops: [] });

/** The services now: [{ key, label, ok, why, phones: [{ key, label, ok, why }] }]. */
export function services(state) {
  const c = state.campaign, me = playerOf(state), p = state.people[state.player];
  if (!c || !me || !p) return [];
  const R = rungOf(c), S = supportOf(c), now = state.time.ms, home = state.map.place === 'home', street = state.map.kind === 'street';
  const burners = burnersOf(p), country = countryOfCity(c.posting.city)?.id, watched = watchedLine(c);
  const phones = (spook, { homeOk = false } = {}) => [
    { key: 'burner', label: `${PHONES.burner} (${burners} on you)`, ok: burners > 0, why: burners > 0 ? 'used once, and dumped: nothing to trace' : 'none on you: a phone shop sells them' },
    { key: 'own', label: PHONES.own, ok: true, why: spook && watched ? 'a watched line: they\'ll read it (heat)' : 'nothing they\'d look twice at' },
    ...(homeOk && home ? [{ key: 'home', label: PHONES.home, ok: true, why: 'the flat\'s line' }] : []),
  ];
  const support = (n) => (S.now >= n ? `${n} of your ${S.now} support` : `${n} support, and there's ${S.now}`);
  const hunted = huntOf(state), bodies = street ? deadHere(state, me) : [];
  const out = [
    { key: 'food', label: 'Food, to the flat', ok: home && !R.food, why: !home ? 'at the flat' : R.food ? `on its way, by ${clockText(R.food.at)}` : `${price(state, FOOD_USD)}, at the door in half an hour or so`, phones: phones(false, { homeOk: true }) },
    { key: 'taxi', label: 'A taxi, to where you are', ok: street && !R.taxi, why: !street ? 'on the street' : R.taxi ? 'one\'s on its way' : `at your kerb in a few minutes${watched && !FRIENDLY.has(country) ? '; on your own phone, they\'ll know where it took you' : ''}`, phones: phones(!FRIENDLY.has(country)) },
    { key: 'gun', label: 'A clean gun, from the agency', ok: S.now >= COST.gun && !R.drops.some(d => d.what === 'gun'), why: R.drops.some(d => d.what === 'gun') ? 'one\'s waiting already' : `${support(COST.gun)}: a dead drop, ready in a few hours`, phones: phones(true) },
    ...Object.entries(EQUIPMENT).map(([k, E]) => ({ key: `kit:${k}`, label: `${cap(E.name)}, from the agency`, ok: S.now >= E.as && !R.drops.some(d => d.what === k), why: R.drops.some(d => d.what === k) ? 'one\'s waiting already' : `${support(E.as)}: ${E.uses} uses, at a dead drop`, phones: phones(true) })),
    { key: 'clinic', label: 'A clandestine clinic, in a safe house', ok: S.now >= COST.clinic && !!houseFor(c) && !(R.clinic && R.clinic.until > now), why: R.clinic && R.clinic.until > now ? `set up in ${c.posting.safehouses.find(h => h.id === R.clinic.house)?.label ?? 'a safe house'}` : !houseFor(c) ? 'no safe house left to make one of' : `${support(COST.clinic)}: a doctor of the agency's there from a few hours on, for ${CLINIC_DAYS} days`, phones: phones(true) },
    ...(CLEANUP_KINDS.includes(S.kind) ? [{ key: 'cleanup', label: 'A clean-up crew, here', ok: S.now >= COST.cleanup && bodies.length > 0 && !R.cleanup, why: R.cleanup ? 'on its way' : !bodies.length ? 'nothing here for one: nobody dead that hasn\'t been called in' : `${support(COST.cleanup)}: ${bodies.length === 1 ? 'the body' : `${bodies.length} bodies`} gone in a few minutes`, phones: phones(true) }] : []),
    { key: 'extract', label: 'Extraction', ok: !!hunted && S.now >= COST.extract && !R.extract, why: R.extract ? `the car's waiting, ${streetName(townOf(state.map), R.extract.row)}` : !hunted ? 'only with the police hunting you' : `${support(COST.extract)}: a car somewhere in the city, to the embassy`, phones: phones(true) },
  ];
  return out;
}

/** Ring for one (key, from phone): { ok, text }. */
export function ring(state, bus, key, phone) {
  const c = state.campaign, me = playerOf(state), p = state.people[state.player], now = state.time.ms;
  const sv = services(state).find(s => s.key === key), ph = sv?.phones.find(x => x.key === phone);
  if (!sv || !ph) return { ok: false };
  if (!sv.ok) return { ok: false, text: sv.why };
  if (!ph.ok) return { ok: false, text: ph.why };
  const R = rungOf(c), r = stream('dial', c.seed, key, Math.floor(now / MIN)), spook = !['food', 'taxi'].includes(key);
  const lines = [];
  if (phone === 'burner') { spendBurner(p); lines.push('A burner, a number from memory.'); }
  else if (phone === 'own' && spook && watchedLine(c)) { addHeat(state, OWN_HEAT); lines.push('Your own phone. Somebody, somewhere, will read who you rang.'); }
  if (key === 'food') {
    if (!pay(state, bus, FOOD_USD, 'the food')) return { ok: false };
    R.food = { at: now + Math.round(range(r, ...FOOD_MIN)) * MIN };
    lines.push(`Something hot, ${price(state, FOOD_USD)} on the card, at the door by ${clockText(R.food.at)}.`);
  } else if (key === 'taxi') {
    const tracked = phone === 'own' && watchedLine(c) && !FRIENDLY.has(countryOfCity(c.posting.city)?.id);
    if (tracked) addHeat(state, TAXI_HEAT);
    R.taxi = { at: now + Math.round(range(r, ...TAXI_MIN)) * MIN, row: state.map.row ?? 0, x: me.x, tracked };
    lines.push(`A taxi to ${placeName(townOf(state.map), state.map.row ?? 0, me.x, 0)}, in a few minutes.${tracked ? ' A taxi firm\'s booking on a diplomat\'s phone: they\'ll know where it took you.' : ''}`);
  } else if (key === 'gun' || key.startsWith('kit:')) {
    const what = key === 'gun' ? 'gun' : key.slice(4), cost = key === 'gun' ? COST.gun : EQUIPMENT[what].as;
    spend(c, cost);
    const at = benchFor(c, r), from = now + Math.round(range(r, ...DROP_H) * 60) * MIN;
    R.drops.push({ id: `drop${now}`, what, at, from, until: from + DROP_FOR_H * HOUR });
    lines.push(`${pick(r, CODES)} ${when(from, now)}, ${low(at.label)}: behind it, a sports bag. (Support ${cost}: ${supportOf(c).now} left.)`);
  } else if (key === 'clinic') {
    spend(c, COST.clinic);
    const h = houseFor(c);
    R.clinic = { house: h.id, from: now + CLINIC_H * HOUR, until: now + CLINIC_H * HOUR + CLINIC_DAYS * DAY };
    lines.push(`"The plumber can come to ${low(h.label)} ${when(R.clinic.from, now)}." A doctor of the agency's, and what he needs, for ${CLINIC_DAYS} days. (Support ${COST.clinic}: ${supportOf(c).now} left.)`);
  } else if (key === 'cleanup') {
    spend(c, COST.cleanup);
    R.cleanup = { at: now + Math.round(range(r, ...CLEANUP_MIN)) * MIN, row: state.map.row ?? 0, x: me.x, z: me.z };
    lines.push(`"There's been a spill: a van, please, and two of your best." Minutes, they say. (Support ${COST.cleanup}: ${supportOf(c).now} left.)`);
  } else if (key === 'extract') {
    spend(c, COST.extract);
    const dir = chance(r, 0.5) ? 1 : -1, row = (state.map.row ?? 0) + dir * (EXTRACT_ROWS[0] + int(r, EXTRACT_ROWS[1] - EXTRACT_ROWS[0] + 1)), x = me.x + range(r, -60, 60);
    const label = `a grey car, ${placeName(townOf(state.map), row, x, 0)}`;
    R.extract = { row, x: Math.round(x), until: now + EXTRACT_WAIT_MIN * MIN, label };
    c.waypoint = { row, x: Math.round(x), z: LINE.F, label: 'the car', kind: 'job' };
    lines.push(`"Your car's ready, sir": ${label}, the engine running, for ${EXTRACT_WAIT_MIN} minutes. Get to it. (Support ${COST.extract}: ${supportOf(c).now} left.)`);
  }
  return { ok: true, text: lines.join(' ') };
}
// (the call's code, for flavour: an agency's dead drop as a dry cleaner's, a florist's, a garage's)
const CODES = ['A dry cleaner\'s number: "My grey suit, is it ready?" "Ready', '"Is that the florist? The white lilies, for my aunt." "They\'ll be in', 'A garage: "The Peugeot, the brakes." "Done, sir. Collect it'];
const when = (ms, now) => { const d = Math.floor(ms / DAY) - Math.floor(now / DAY); return `${d === 0 ? 'from' : d === 1 ? 'tomorrow, from' : 'from'} ${clockText(ms)}`; };

/** A safe house to make a clinic of: the first not blown. */
const houseFor = (c) => c.posting.safehouses.find(h => !h.burned) ?? null;
/** The dead near you that nobody's called in (a clean-up's work). */
function deadHere(state, me) {
  const row = state.map.row ?? 0;
  return state.actors.filter(a => a !== me && a.who && state.people[a.who]?.dead && (a.row ?? row) === row && !state.people[a.who].reported && Math.hypot(a.x - me.x, a.z - me.z) < CLEANUP_M);
}
// (a bench in the posting's parks for a drop, by the call's own dice; as the black market's, sim/market.js)
function benchFor(c, r) {
  const town = townOf({ seed: c.posting.mapSeed, city: c.posting.city });
  for (const strict of [true, false]) for (let k = 0; k < 30; k++) {
    const row = int(r, 7) - 3, i = int(r, 10) - 5, S = sectionOf(town, row, i);
    if (strict && S.band !== 'park') continue;
    const b = S.props.filter(q => q.kind === 'bench');
    if (!b.length) continue;
    const q = pick(r, b), x = q.seats?.[0] ?? q.x;
    return { row, x, z: q.z ?? 12.96, label: `A bench in ${placeName(town, row, x, 14)}, by ${streetName(town, row)}` };
  }
  return { row: 0, x: 30, z: 12.96, label: `A bench by ${streetName(town, 0)}` };
}

/** The drop of the agency's you're at, ready or not, or null. */
export function dropAt(state, me) {
  const c = state.campaign, R = c?.rung;
  if (!R?.drops?.length || !me || state.map.kind !== 'street' || state.map.seed !== c.posting.mapSeed) return null;
  return R.drops.find(d => (state.map.row ?? 0) === d.at.row && Math.abs(me.x - d.at.x) < DROP_AT_M && Math.abs(me.z - d.at.z) < DROP_AT_M) ?? null;
}
/** At a drop, T: what's behind the bench taken (a clean gun into the bag; a kit's uses). Its line. */
export function collect(state, bus, d) {
  const c = state.campaign, p = state.people[state.player], now = state.time.ms;
  if (now < d.from) return `Nothing behind it yet: ${when(d.from, now)}.`;
  c.rung.drops = c.rung.drops.filter(x => x !== d);
  if (d.what === 'gun') {
    const model = CLEAN_GUN[countryOfCity(c.posting.city)?.id] ?? 'glock19', M = MODELS[model];
    const id = newGun(p, model), spare = newMag(p, id);
    if (p.arms?.[id]) p.arms[id].clean = true;                     // (no history: nothing ties it to anything)
    (p.bag ??= []).push({ item: id }, ...(spare ? [{ item: spare }] : []));
    p.rounds = { ...(p.rounds ?? {}), [M.cal]: (p.rounds?.[M.cal] ?? 0) + 20 };
    return `A sports bag behind the bench. In a towel: ${M.name}, its numbers ground off, its magazine in, a spare, a box of twenty. Into your carrier bag, and walk.`;
  }
  const E = EQUIPMENT[d.what];
  p.equip = { ...(p.equip ?? {}), [d.what]: (p.equip?.[d.what] ?? 0) + E.uses };
  return `A sports bag behind the bench: ${E.name}, ${E.uses} uses. Into your coat.`;
}

/**
 * Once a second, in the campaign's hub: the food at the door, the taxi at your kerb, drops gone stale, the clinic over, the
 * clean-up crew at work, the extraction's car. extracted: the hub's, when you're at the car (sim/scenarios/campaign.js).
 */
export function second(state, bus, me, { extracted = null } = {}) {
  const c = state.campaign, R = c?.rung;
  if (!R || !me) return;
  const now = state.time.ms, row = state.map.row ?? 0;
  if (R.food && now >= R.food.at) {
    if (state.map.place === 'home') { eat(state.people[state.player], now, 15); say(state, bus, { kind: 'note', text: 'The doorbell: a bag on the mat, warm through. You eat it out of the box at the table.' }); }
    else say(state, bus, { kind: 'note', text: 'The food you rang for will have come and gone at the flat, with nobody in.' });
    delete R.food;
  }
  if (R.taxi && now >= R.taxi.at) {
    if (state.map.kind !== 'street' || row !== R.taxi.row || Math.abs(me.x - R.taxi.x) > 80) { delete R.taxi; say(state, bus, { kind: 'note', text: 'The taxi you rang for came and went without you.' }); }
    else {
      const cab = sendFare(state, me.x);
      if (cab) {
        cab.taxi.hail.by = me.id; cab.taxi.hail.at = me.x; cab.taxi.rung = true;
        if (R.taxi.tracked) state.$tracked = true;                  // (the ride's end: a team there, sim/scenarios/campaign.js)
        delete R.taxi;
        say(state, bus, { kind: 'note', text: 'A taxi pulls in along the kerb, its light off: the one you rang for.' });
      } else if (now - R.taxi.at > 60000) { delete R.taxi; say(state, bus, { kind: 'note', text: 'The taxi you rang for never found the kerb free: it\'s gone on.' }); }
    }
  }
  R.drops = (R.drops ?? []).filter(d => now < d.until || (say(state, bus, { kind: 'note', text: `The sports bag behind ${low(d.at.label)}: gone back where it came from. Nobody came for it.` }), false));
  if (R.clinic && now >= R.clinic.until) { delete R.clinic; say(state, bus, { kind: 'note', text: 'The safe house is a safe house again: the doctor\'s packed up and gone.' }); }
  if (R.cleanup && now >= R.cleanup.at) {
    const gone = state.actors.filter(a => a !== me && a.who && state.people[a.who]?.dead && (a.row ?? row) === R.cleanup.row && !state.people[a.who].reported && Math.hypot(a.x - R.cleanup.x, a.z - R.cleanup.z) < CLEANUP_M);
    for (const a of gone) state.people[a.who].reported = now;      // (nobody to call it in now)
    state.actors = state.actors.filter(a => !gone.includes(a));
    if (row === R.cleanup.row) say(state, bus, { kind: 'note', text: gone.length ? `A white van, two men in overalls who don't look at you. A minute, a tarpaulin, the doors, and ${gone.length === 1 ? 'the body\'s' : 'the bodies are'} gone.` : 'A white van comes, finds nothing for it, and goes.' });
    delete R.cleanup;
  }
  if (R.extract) {
    if (now > R.extract.until) { delete R.extract; c.waypoint = null; say(state, bus, { kind: 'note', text: 'The car will have gone by now. You\'re on your own.' }); return; }
    if (state.map.kind === 'street' && row === R.extract.row && Math.abs(me.x - R.extract.x) < 3 && extracted) { const E = R.extract; delete R.extract; c.waypoint = null; extracted(E); }
  }
}

/** Whether a clinic's ready at this safe house (id), now. */
export const clinicAt = (c, id, now) => !!c?.rung?.clinic && c.rung.clinic.house === id && now >= c.rung.clinic.from && now < c.rung.clinic.until;

/** Where the posting's support is shown (the mind's leaves): '40 of 80, back 10 a day'. */
export function supportWords(c) {
  const S = supportOf(c);
  return S ? `${S.now} of ${S.max}, back ${S.perDay} a day: ${S.word}` : '';
}
