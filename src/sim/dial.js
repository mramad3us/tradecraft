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
import { supportOf, spend, AS_USD } from './support.js';
import { sellerOf } from './market.js';
import { arrest } from './armed.js';
import { check } from './checks.js';
import { skill } from './skills.js';
import { cashOf } from './money.js';
import { sendFare } from './traffic.js';
import { countryOfCity } from './countries/index.js';
import { townOf } from './cities/index.js';
import { sectionOf, LINE } from './city.js';
import { placeName, streetName } from './map/street.js';
import { newGun, newMag, MODELS } from './firearms.js';
import { huntOf } from './hunt.js';
import { EQUIPMENT } from './disguise.js';
import { isDeep } from './legends.js';

export const PHONES = { burner: 'From a burner', own: 'From your own phone', home: 'From the flat\'s phone' };
export const FOOD_USD = 18, FOOD_MIN = [30, 45], TAXI_MIN = [3, 6], TAXI_HEAT = 2, TRACKED_P = 0.5, OWN_HEAT = 4;
export const COST = { gun: 20, clinic: 40, cleanup: 60, extract: 80 };
export const DROP_H = [4, 10], DROP_FOR_H = 36, DROP_AT_M = 2.5, CLINIC_H = 4, CLINIC_DAYS = 3, CLEANUP_M = 40, CLEANUP_MIN = [4, 8];
export const EXTRACT_ROWS = [2, 4], EXTRACT_WAIT_MIN = 40, EXTRACT_COVER = 10, CLEANUP_KINDS = ['firstTour', 'official'];
export const FRIENDLY = new Set(['gb', 'us']);
// (the black market's ways instead of the agency's (the user, 2026-11-04: "Black market provides alternative ways to:
// extract, gun and clandestine clinic (costs a LOT of money (1AS = 1000£) and can be a trap with authorities waiting for us
// instead, which we can spot when getting close if we successfully roll our awareness"; "we need to have developed a
// relationship with a black market contact to have access to it"): a deal done with him first (BM_DEALS); his price the
// support's in cash (AS_USD a point), paid when it's done; a trap settled when you ring, by how thin the market is (BM_TRAP);
// near it (NOTICE_M), each time you come, your Awareness: missed, you can't tell; made, you can: waiting, or clean)
export const BM_DEALS = 1, NOTICE_M = 25, NOTICE_DC = 14;
export const BM_TRAP = (city) => 0.05 + (1 - (countryOfCity(city)?.black?.ease ?? 0.5)) * 0.3;
export const bmUsd = (k) => COST[k] * AS_USD;
export const developed = (s) => (s?.deals ?? 0) >= BM_DEALS;
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
    // (under a legend, no car of the agency's: the way out is your own, far from the centre; an illegal's only once the Center answers: exfilWays())
    ...(isDeep(c.posting) ? [exfilWays(state, c, hunted, now)] : [{ key: 'extract', label: 'Extraction', ok: !!hunted && S.now >= COST.extract && !R.extract, why: R.extract ? `the car's waiting, ${streetName(townOf(state.map), R.extract.row)}` : !hunted ? 'only with the police hunting you' : `${support(COST.extract)}: a car somewhere in the city, to the embassy`, phones: phones(true) }]),
  ];
  // (his, if you know a man: sim/market.js)
  const sl = sellerOf(c);
  if (sl) {
    const dev = developed(sl), nm = cap(sl.name);
    const bm = (k, label, can, why) => ({ key: `bm:${k}`, label: `${label}, from ${nm}`, ok: dev && can, why: !dev ? `he doesn't know you well enough yet: a deal done with him first` : why ?? `${price(state, bmUsd(k))} cash, paid when it's done: his people, not the agency's, and nobody's word for them`, phones: phones(true) });
    out.push(
      bm('gun', 'A clean gun', !R.drops.some(d => d.what === 'gun'), R.drops.some(d => d.what === 'gun') ? 'one\'s waiting already' : undefined),
      bm('clinic', 'A doctor who asks no questions', !!houseFor(c) && !(R.clinic && R.clinic.until > now), R.clinic && R.clinic.until > now ? 'there\'s one set up already' : !houseFor(c) ? 'no safe house to have him at' : undefined),
      bm('extract', 'A way out of the city', !!hunted && !R.extract, R.extract ? 'a car\'s waiting already' : !hunted ? 'only with the police hunting you' : undefined));
  }
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
  } else if (key.startsWith('bm:')) {
    // (his: no support spent; the price when it's done; a trap, or not, settled now)
    const k = key.slice(3), sl = sellerOf(c), nm = cap(sl.name), bm = { usd: bmUsd(k), trap: chance(r, BM_TRAP(c.posting.city)) };
    if (k === 'gun') {
      const at = benchFor(c, r), from = now + Math.round(range(r, ...DROP_H) * 60) * MIN;
      R.drops.push({ id: `drop${now}`, what: 'gun', at, from, until: from + DROP_FOR_H * HOUR, bm });
      lines.push(`${nm} doesn't ask what it's for. "Clean. Nothing on it. ${price(state, bm.usd)}, in the bag where you find it": ${low(at.label)}, ${when(from, now)}.`);
    } else if (k === 'clinic') {
      const h = houseFor(c);
      R.clinic = { house: h.id, from: now + CLINIC_H * HOUR, until: now + CLINIC_H * HOUR + CLINIC_DAYS * DAY, bm };
      lines.push(`"I know a man. He was a surgeon once." ${cap(h.label)}, ${when(R.clinic.from, now)}, for ${CLINIC_DAYS} days: ${price(state, bm.usd)}, cash, at the door.`);
    } else {
      const dir = chance(r, 0.5) ? 1 : -1, row = (state.map.row ?? 0) + dir * (EXTRACT_ROWS[0] + int(r, EXTRACT_ROWS[1] - EXTRACT_ROWS[0] + 1)), x = me.x + range(r, -60, 60);
      const label = `a delivery van, ${placeName(townOf(state.map), row, x, 0)}`;
      R.extract = { row, x: Math.round(x), until: now + EXTRACT_WAIT_MIN * MIN, label, bm };
      c.waypoint = { row, x: Math.round(x), z: LINE.F, label: 'the van', kind: 'job' };
      lines.push(`"There's a van. In the back, under the boxes, and out." ${cap(label)}, for ${EXTRACT_WAIT_MIN} minutes: ${price(state, bm.usd)}, cash, to the driver.`);
    }
  } else if (key === 'exfil') {
    // (the way out, your own: open now undercover, for EXFIL_WAIT_H; an illegal's once the Center answers the signal, EXFIL_SIGNAL_H on)
    const X = c.posting.exfil, ill = c.posting.level === 'illegal', from = ill ? now + Math.round(range(r, ...EXFIL_SIGNAL_H) * 60) * MIN : now;
    R.exfil = { from, until: from + (ill ? EXFIL_WAIT_H.illegal : EXFIL_WAIT_H.undercover) * HOUR };
    c.waypoint = { row: X.row, x: X.x, z: LINE.F, label: 'the way out', kind: 'job' };
    lines.length = 0;
    lines.push(ill ? `A chalk mark where the Center will see it: the signal nobody wants to send. If they answer, ${X.label}, ${when(from, now)}, for ${EXFIL_WAIT_H.illegal} hours.` : `The plan you made the week you arrived and hoped never to use: ${X.label}, by your own means, in the next ${EXFIL_WAIT_H.undercover} hours.`);
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
  if (d.what === 'signal') { bus?.emit('papers', [d.paper]); return 'Taped under the seat, a cigarette packet with a film of paper in it: read, memorised, and down a drain on the way home.'; }   // (the station's word, under a legend)
  if (d.bm) {
    const me = playerOf(state);
    if (d.bm.trap) return trapped(state, bus, me, 'the gun');
    if (cashOf(p) < d.bm.usd) { lostSeller(c, false); return `A sports bag behind the bench, and a man on the next one watching you count. ${price(state, cashOf(p))}: not enough. He takes the bag, and his number won't answer again.`; }
    p.cash = Math.round((cashOf(p) - d.bm.usd) * 100) / 100;
    dealt(c);
  }
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
  const c = state.campaign, R = c && (c.rung || c.signals?.length) ? rungOf(c) : c?.rung;   // (the station's word to leave makes the rung, under a legend)
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
  signals(state, bus, c, now);                                      // (under a legend, the station's word: a drop)
  exfilSecond(state, bus, me, c, now);                              // (and the way out, if you're making for it)
  R.drops = (R.drops ?? []).filter(d => now < d.until || (say(state, bus, { kind: 'note', text: d.what === 'signal' ? `The station's word behind ${low(d.at.label)}: cleared, unread. They'll wonder why.` : `The sports bag behind ${low(d.at.label)}: gone back where it came from. Nobody came for it.` }), false));
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
    if (state.map.kind === 'street' && row === R.extract.row && Math.abs(me.x - R.extract.x) < 3 && extracted) {
      const E = R.extract, p = state.people[state.player]; delete R.extract; c.waypoint = null;
      if (E.bm?.trap) { trapped(state, bus, me, null); return; }
      if (E.bm && cashOf(p) < E.bm.usd) { lostSeller(c, false); say(state, bus, { kind: 'note', text: `The driver counts it twice: ${price(state, cashOf(p))}. "That's not what he said." The van goes without you.` }); return; }
      if (E.bm) { p.cash = Math.round((cashOf(p) - E.bm.usd) * 100) / 100; dealt(c); }
      extracted(E);
    }
  }
  sense(state, bus, me, now);
  station(state, bus, c, now);
}

// Near one of the black market's (a bench, the safe house's door, the van; and his own gun's bench, sim/market.js), each
// time you come within NOTICE_M: your Awareness, against NOTICE_DC. Missed, you can't tell; made, it tells you true.
function sense(state, bus, me, now) {
  const c = state.campaign, R = c.rung, row = state.map.row ?? 0;
  if (state.map.kind !== 'street' || state.map.seed !== c.posting.mapSeed) return;
  const spots = [...(R.drops ?? []).filter(d => d.bm).map(d => ({ o: d, at: d.at, trap: d.bm.trap, label: low(d.at.label) })),
    ...(R.clinic?.bm ? [{ o: R.clinic, at: c.posting.safehouses.find(h => h.id === R.clinic.house), trap: R.clinic.bm.trap, label: c.posting.safehouses.find(h => h.id === R.clinic.house)?.label }] : []),
    ...(R.extract?.bm ? [{ o: R.extract, at: R.extract, trap: R.extract.bm.trap, label: R.extract.label }] : []),
    ...(c.order && !c.order.done && c.order.paid ? [{ o: c.order, at: c.order.get, trap: c.order.sting, label: low(c.order.get.label) }] : [])];
  const p = state.people[state.player];
  for (const S of spots) {
    if (!S.at || S.at.row !== row) continue;
    const d = Math.hypot(me.x - S.at.x, me.z - (S.at.z ?? me.z));
    if (d > NOTICE_M + 15) { S.o.near = false; continue; }
    if (d > NOTICE_M || S.o.near) continue;
    S.o.near = true; S.o.looks = (S.o.looks ?? 0) + 1;
    const roll = check(stream('notice', c.seed, S.o.id ?? S.o.at ?? 'x', S.o.looks), { skill: 'awareness', value: skill(p, 'awareness'), dc: NOTICE_DC, body: p });
    const text = !roll.ok ? `${cap(S.label)}: you look it over from ${Math.round(d)} m, and can't tell whether anyone's waiting for you there.`
      : S.trap ? `${cap(S.label)}: something's off. A man reading the same page he was reading a minute ago; a car with two in it and the engine off; nobody looking your way, and all of them placed. Someone's waiting.`
        : `${cap(S.label)}: you look it over from ${Math.round(d)} m. Nobody waiting, nothing out of place.`;
    say(state, bus, { kind: 'roll', roll, text });
  }
}

/** The trap sprung: police off the next bench, out of the van, in the stairwell: taken in, his number theirs. */
export function trapped(state, bus, me, what) {
  const c = state.campaign;
  lostSeller(c, true);
  say(state, bus, { kind: 'note', text: 'And as you reach it, they come: two off the next bench, one from behind you, plain clothes, quick, and they\'d been waiting. Your face on the pavement, the cuffs.' });
  if (me) arrest(state, bus, me, 'trap', 'the black market', { found: what ? [what] : [] });
  return 'It was theirs all along.';
}
// (him gone: a trap's, his number dead; or short-changed, he won't call back)
function lostSeller(c, trap) { if (c.black) delete c.black[c.posting.city]; if (trap && c.posting) c.posting.cover = Math.max(0, (c.posting.cover ?? 70) - 10); }
/** A deal done with him (sim/market.js, and his ways here): he knows you better. */
export function dealt(c) { const s = sellerOf(c); if (s) s.deals = (s.deals ?? 0) + 1; }

// The station's optional tasks for the network (the user, 2026-11-04: "Black market contact acquisition will be one of the
// missions we have when developing a network, there should be optional assignments to that purpose"): a black-market
// contact found (a quiet word at a bar), and a deal done with him; each done, the station's thanks (support back, OPT_AS).
export const OPTIONAL = [
  { key: 'contact', name: 'A black-market contact', about: 'A quiet word at a bar or a pub, the right question asked the right way (Social): a name and a number.', done: (c) => !!sellerOf(c) || !!c.opt?.contact },
  { key: 'deal', name: 'A deal with him', about: 'Something bought from him, collected, paid for: a man who knows you is a man you can call on (his clean gun, his doctor, his van).', done: (c) => developed(sellerOf(c)) || !!c.opt?.deal },
];
export const OPT_AS = 10;
function station(state, bus, c, now) {
  for (const O of OPTIONAL) {
    if (c.opt?.[O.key] || !O.done(c)) continue;
    (c.opt ??= {})[O.key] = now;
    const S = supportOf(c);
    if (S) c.posting.support.now = Math.min(S.max, S.now + OPT_AS);
    say(state, bus, { kind: 'note', text: `${O.name}, as the station asked: a line in the next cable, and they're pleased. (Support +${OPT_AS}.)` });
  }
}

// ---------- under a legend (0.2's deep postings: docs/POSTINGS.md) ----------

// The way out (self-extraction): no car of the agency's, no embassy to be driven to; the posting's own point far from the centre
// (sim/legends.js exfilOf()), reached by your own means while it's open: undercover, EXFIL_WAIT_H.undercover hours from when you
// decide to go; an illegal, only once a signal's answered (EXFIL_SIGNAL_H), and then for EXFIL_WAIT_H.illegal hours. Only hunted,
// or blown. Reached: out of the country, the posting over (c.over 'exfiltrated'; an illegal's, 'brought': the career's end).
export const EXFIL_WAIT_H = { undercover: 6, illegal: 3 }, EXFIL_SIGNAL_H = [24, 48], EXFIL_AT_M = 3;
function exfilWays(state, c, hunted, now) {
  const R = rungOf(c), X = c.posting.exfil, ill = c.posting.level === 'illegal', need = !!hunted || !!c.blown;
  const why = R.exfil ? (now < R.exfil.from ? `the Center's answer, if it comes, ${when(R.exfil.from, now)}` : `open till ${clockText(R.exfil.until)}: ${X.label}`)
    : !need ? 'only hunted, or blown' : ill ? 'a signal for the Center, a day or two for its answer, then the place by your own means' : `${X.label}: by your own means`;
  return { key: 'exfil', label: 'The way out, on your own', ok: need && !R.exfil, why,
    phones: [ill ? { key: 'signal', label: 'A signal for the Center', ok: true, why: 'a chalk mark, and a day or two' } : { key: 'plan', label: 'Your own plan', ok: true, why: 'nobody to call' }] };
}
// (reached, while it's open: out; its paper, and the posting's end)
function exfilSecond(state, bus, me, c, now) {
  const R = c.rung, X = c.posting.exfil, ill = c.posting.level === 'illegal';
  if (!R.exfil || !X) return;
  if (now > R.exfil.until) { delete R.exfil; c.waypoint = null; say(state, bus, { kind: 'note', text: `${cap(X.label)}: shut, gone, or never there. You're on your own, and still here.` }); return; }
  if (now < R.exfil.from || state.map.kind !== 'street' || state.map.seed !== c.posting.mapSeed || (state.map.row ?? 0) !== X.row || Math.abs(me.x - X.x) > EXFIL_AT_M) return;
  delete R.exfil; c.waypoint = null;
  c.over = { ms: now, why: ill ? 'brought' : 'exfiltrated' };
  c.log.push({ ms: now, text: ill ? 'Brought out: the Center came for you, at the last.' : `Out: ${X.label}, and over the border by morning.` });
  bus?.emit('papers', [{ kind: 'over', title: ill ? 'BROUGHT OUT' : 'OUT', lines: [ill ? `${cap(X.label)}: a man who says the word you were told, years ago, he'd say. Out under a tarpaulin, and the border by morning.` : `${cap(X.label)}: there, on time, and nobody behind you that you can see. Out, and over the border by morning.`,
    `${c.posting.alias} is gone: the flat, the job, the café. ${ill ? 'Whoever you married wakes to an empty bed and a policeman at the door.' : 'Your face is in their files now, for good.'}`] }]);
}
// (the station's word, its week's review, left at a bench on Monday morning: the drops' own, read when collected)
function signals(state, bus, c, now) {
  if (!c.signals?.length) return;
  const R = rungOf(c);
  for (const S of c.signals.splice(0)) {
    const at = benchFor(c, stream('signal', c.seed, S.from));
    R.drops.push({ id: `signal${S.from}`, what: 'signal', at, from: S.from, until: S.from + DROP_FOR_H * HOUR, paper: S.paper });
    say(state, bus, { kind: 'note', text: `A chalk mark on a lamp post you pass, where there wasn't one: the ${c.posting.level === 'illegal' ? 'Center' : 'station'}'s word, ${low(at.label)}, ${when(S.from, now)}.` });
  }
}

/** Whether a clinic's ready at this safe house (id), now. */
export const clinicAt = (c, id, now) => !!c?.rung?.clinic && c.rung.clinic.house === id && now >= c.rung.clinic.from && now < c.rung.clinic.until;

/** Where the posting's support is shown (the mind's leaves): '40 of 80, back 10 a day'. */
export function supportWords(c) {
  const S = supportOf(c);
  return S ? `${S.now} of ${S.max}, back ${S.perDay} a day: ${S.word}` : '';
}
