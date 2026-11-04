// TRADECRAFT sim: the black market (the user, 2026-11-03: "legal purchase and carry … and the black market via dead
// drops"; "GUNS SHOULD BE RARE AND HARD TO GET, HIDE"). The campaign's: a gun is a whole thing to come by.
//
// **A seller** (ask(): a quiet word with a bar's barman, sim/shops.js): Social against ASK_DC, harder where guns are
// rare (its country's black.ease, sim/countries/: Beirut 9, Cairo 13, Moscow 14, London 18). Got, a name and a number
// on a beer mat (c.black[city]); not, nothing, and where the opposition watches embassy staff a word of the question
// reaches it (ASK_HEAT).
// **The order** (order(): a call to him, from the mind's People leaf, src/ui/mind.js): what he has (black.models), at
// his price (priceOf(): a model's BASE_USD, dearer where the market's thin), a spare magazine and a box of its rounds
// with it. From a burner, or your own phone (the police's interest, and the opposition's: OWN_HEAT). He names two dead
// drops on the posting's streets, benches in its parks: the money behind one's leg by the next night (PAY_H), and the
// goods behind another's from the day after (GET_AFTER_H) for two days (GET_FOR_H).
// **What can go wrong** was settled when you called, on dice of its own: a scam (SCAM: the money gone, nothing at the
// second bench, his number dead), likelier where the market's thin; a sting (STING: the police waiting at the second
// bench, where guns are rare and they watch for buyers): taken in, the gun theirs, and a diplomat's name on a report
// that reaches the ambassador (STING_HEAT, STING_COVER, and the police's file: sim/police.js policeHeat()).
// **The drops** are the hub's (sim/scenarios/campaign.js): at the bench, T: the envelope left, or what's there taken;
// the goods in a carrier bag, put away in the flat with the rest (sim/clothes.js unpack(): the stash).
import { stream, chance, int, pick, range } from './rng.js';
import { DAY, HOUR, calendar, clockText } from './clock.js';
import { say } from './log.js';
import { check } from './checks.js';
import { skill } from './skills.js';
import { addHeat } from './heat.js';
import { cashOf, price } from './money.js';
import { MODELS, newGun, newMag } from './firearms.js';
import { countryOfCity } from './countries/index.js';
import { townOf, cityById } from './cities/index.js';
import { sectionOf } from './city.js';
import { placeName, streetName } from './map/street.js';
import { burnersOf, spendBurner } from './items.js';
import { policeHeat } from './police.js';
import { noImmunity } from './prison.js';

export const ASK_USD = 25, ASK_HEAT = 2, OWN_HEAT = 6, OWN_POLICE = 10;
export const PAY_H = 36, GET_AFTER_H = 24, GET_FOR_H = 48, DROP_AT_M = 2.5;
export const STING_HEAT = 30, STING_COVER = 30, STING_POLICE = 50;
// (what a model fetches where guns are about as easy as anywhere: its price elsewhere, by how thin the market is)
export const BASE_USD = { canik: 250, glock17: 600, glock19: 600, browning: 350, tokarev: 250, helwan: 250, makarov: 300, traumatic: 350, pya: 700, converted: 250, colt1911: 500, model10: 300, uzi: 700, akm: 600, ak74m: 900, aks74u: 900, m16a4: 1200 };
const easeOf = (city) => countryOfCity(city)?.black?.ease ?? 0.5;
export const ASK_DC = (city) => Math.round(20 - easeOf(city) * 12);
export const SCAM = (city) => 0.08 + (1 - easeOf(city)) * 0.25;
export const STING = (city) => (1 - easeOf(city)) * 0.3;
export const priceOf = (city, model) => Math.max(50, Math.round((BASE_USD[model] ?? 500) * (1.8 - easeOf(city) * 1.4) / 50) * 50);
const NAMES = { ru: ['Vadik', 'Sergei', 'the man called Lyokha'], gb: ['Dean', 'a man called Tel', 'Kieran'], lb: ['Rafik', 'Abu Samir', 'Joe'], eg: ['Hamada', 'Sayed', 'the one they call el-Ostaz'], us: ['Ray', 'Dee', 'Marcus'] };

/** The seller you know in the campaign's city, or null. */
export const sellerOf = (c) => c?.black?.[c.posting.city] ?? null;
// (where a quiet word's had: a bar's barman; London's pubs; Cairo's ahwas, the men who sit all day at the same table)
export const ASK_AT = { ru: ['bar'], gb: ['pub', 'bar'], lb: ['bar'], eg: ['cafe', 'juice'], us: ['bar'] };
/** Whether a quiet word's to be had at this counter, in the campaign, no seller known yet. */
export const askable = (state, shop) => !!state.campaign && (ASK_AT[countryOfCity(state.campaign.posting.city)?.id] ?? ['bar']).includes(shop) && !sellerOf(state.campaign);

/** The question asked at the bar: a seller found, or not. Its line. */
export function ask(state, bus, p) {
  const c = state.campaign, city = c.posting.city, country = countryOfCity(city);
  const r = check(stream('ask', c.seed, Math.floor(state.time.ms / HOUR)), { skill: 'social', value: skill(p, 'social'), dc: ASK_DC(city), body: p });
  say(state, bus, { kind: 'roll', roll: r, text: r.ok ? 'A round, a joke, and the question asked as if it were someone else\'s.' : 'A round, and the question asked a beat too soon.' });
  if (!r.ok) {
    if (country?.id === 'ru' || country?.id === 'lb') addHeat(state, ASK_HEAT);
    return 'The barman\'s face closes like a shop at six. "Don\'t know anyone like that." He watches you to the door.';
  }
  const name = pick(stream('seller', c.seed, city), NAMES[country?.id] ?? NAMES.us);
  (c.black ??= {})[city] = { name, at: state.time.ms };
  return `The barman writes a number on a beer mat and slides it over with your change. "${name.charAt(0).toUpperCase() + name.slice(1)}. Not from your own phone." The People on the mind has him now.`;
}

/** What the seller has, now: [{ model, name, usd }]. */
export function stock(c) {
  const city = c.posting.city, models = countryOfCity(city)?.black?.models ?? [];
  return models.filter(m => MODELS[m]).map(m => ({ model: m, name: MODELS[m].name, usd: priceOf(city, m) }));
}

// (two benches in the posting's parks for the drops, by the order's own dice: a park's, then any)
function benchFor(c, r, avoid = null) {
  const town = townOf({ seed: c.posting.mapSeed, city: c.posting.city });
  for (const strict of [true, false]) for (let k = 0; k < 30; k++) {
    const row = int(r, 7) - 3, i = int(r, 10) - 5, S = sectionOf(town, row, i);
    if (strict && S.band !== 'park') continue;
    const b = S.props.filter(q => q.kind === 'bench');
    if (!b.length) continue;
    const q = pick(r, b), x = q.seats?.[0] ?? q.x;
    if (avoid && avoid.row === row && Math.abs(avoid.x - x) < 60) continue;
    return { row, x, z: q.z ?? 12.96, label: `A bench in ${placeName(town, row, x, 14)}, by ${streetName(town, row)}` };
  }
  return { row: 0, x: 30, z: 12.96, label: `A bench by ${streetName(town, 0)}` };
}

/** The order, by telephone (phone: 'burner' | 'own'): { ok, text }. */
export function order(state, bus, model, phone) {
  const c = state.campaign, p = state.people[state.player], s = sellerOf(c), now = state.time.ms, city = c?.posting.city;
  if (!s) return { ok: false, text: 'Nobody to ring.' };
  if (c.order && !c.order.done) return { ok: false, text: 'One thing at a time: there\'s money owed, or something waiting at a bench.' };
  const item = stock(c).find(o => o.model === model);
  if (!item) return { ok: false, text: 'He hasn\'t that.' };
  if (phone === 'burner' && !(burnersOf(p) > 0)) return { ok: false, text: 'No burner on you: a phone shop sells them.' };
  const lines = [];
  if (phone === 'burner') { spendBurner(p); lines.push('A burner, the number off the beer mat.'); }
  else { addHeat(state, OWN_HEAT); policeHeat(state, OWN_POLICE); lines.push(state.legend?.cover === 'official' ? 'Your own phone: a diplomat\'s number on a gun dealer\'s bill. Somebody, somewhere, will read it.' : 'Your own phone: the legend\'s number on a gun dealer\'s bill. Somebody, somewhere, will read it.'); }
  const r = stream('order', c.seed, model, Math.floor(now / HOUR)), pay = benchFor(c, r), get = benchFor(c, r, pay);
  const scam = chance(r, SCAM(city)), sting = !scam && chance(r, STING(city));
  c.order = { model, name: item.name, usd: item.usd, city, at: now, pay: { ...pay, by: now + PAY_H * HOUR }, get: { ...get, from: null }, paid: null, scam, sting, done: false };
  lines.push(`${s.name.charAt(0).toUpperCase() + s.name.slice(1)} listens, names a price, ${price(state, item.usd)}, and doesn't haggle. The money in an envelope behind the leg of a bench: ${pay.label.charAt(0).toLowerCase()}${pay.label.slice(1)}, by ${clockText(now + PAY_H * HOUR)} ${dayWord(now + PAY_H * HOUR, now)}. The day after, ${item.name} behind another: ${get.label.charAt(0).toLowerCase()}${get.label.slice(1)}.`);
  return { ok: true, text: lines.join(' ') };
}

const dayWord = (ms, now) => { const d = Math.floor(ms / DAY) - Math.floor(now / DAY); return d === 0 ? 'tonight' : d === 1 ? 'tomorrow' : ['on Monday', 'on Tuesday', 'on Wednesday', 'on Thursday', 'on Friday', 'on Saturday', 'on Sunday'][calendar(ms).weekday]; };

/** Whether the player is at a drop of the order's, and which: 'pay' | 'get' | null. */
export function dropHere(state, me) {
  const o = state.campaign?.order;
  if (!o || o.done || !me || state.map.kind !== 'street' || state.map.seed !== state.campaign.posting.mapSeed) return null;
  const near = (d) => (state.map.row ?? 0) === d.row && Math.abs(me.x - d.x) < DROP_AT_M && Math.abs(me.z - d.z) < DROP_AT_M;
  if (!o.paid && near(o.pay)) return 'pay';
  if (o.paid && near(o.get)) return 'get';
  return null;
}

/** Time passes: an envelope never left, the deal's off; goods never collected, gone. */
export function lapse(state, bus) {
  const c = state.campaign, o = c?.order, now = state.time.ms;
  if (!o || o.done) return;
  if (!o.paid && now > o.pay.by) { o.done = 'lapsed'; say(state, bus, { kind: 'note', text: 'No envelope behind the bench by the time he said: the deal\'s off, and his number won\'t answer you again.' }); delete c.black[o.city]; }
  else if (o.paid && o.get.from && now > o.get.from + GET_FOR_H * HOUR) { o.done = 'lapsed'; say(state, bus, { kind: 'note', text: 'Two days behind a bench, and nobody came for it: whatever was there is someone else\'s now.' }); }
}

/** At a drop, T: the envelope left, or what's behind the bench taken. Its line. */
export function atDrop(state, bus, p, which) {
  const c = state.campaign, o = c.order, now = state.time.ms;
  if (which === 'pay') {
    if (cashOf(p) < o.usd) return `An envelope, and not enough to put in it: ${price(state, cashOf(p))} on you, and it's ${price(state, o.usd)}.`;
    p.cash = Math.round((cashOf(p) - o.usd) * 100) / 100;
    o.paid = now; o.get.from = now + GET_AFTER_H * HOUR;
    return `You sit, tie a shoelace, and the envelope goes behind the bench's leg. ${price(state, o.usd)}. From ${clockText(o.get.from)} ${dayWord(o.get.from, now)}: ${o.get.label.charAt(0).toLowerCase()}${o.get.label.slice(1)}.`;
  }
  if (now < o.get.from) return `Nothing behind it yet. From ${clockText(o.get.from)} ${dayWord(o.get.from, now)}.`;
  if (o.scam) { o.done = 'scam'; delete c.black[o.city]; return 'Behind the bench\'s leg: a crisp packet, and nothing else. His number rings out, and tomorrow it won\'t ring at all. That money\'s gone.'; }
  if (o.sting) {
    o.done = 'sting';
    // (under a legend, no diplomatic passport to put on the table: an arrest, and the legend looked into; sim/prison.js)
    // (the hub springs it: sim/dial.js trapped(), state.$trap)
    if (noImmunity(state)) { delete c.black[o.city]; state.$trap = 'the gun'; return 'A bag behind the bench, and as your hand closes on it, two men off the next bench and a third from the path.'; }
    addHeat(state, STING_HEAT); policeHeat(state, STING_POLICE);
    if (c.posting) c.posting.cover = Math.max(0, c.posting.cover - STING_COVER);
    delete c.black[o.city];
    return `A bag behind the bench, and as your hand closes on it, two men off the next bench and a third from the path: police, plain clothes, and they were waiting. ${o.name.charAt(0).toUpperCase() + o.name.slice(1)} on the table at the station, your diplomatic passport beside it, three hours till the embassy's man comes. The ambassador hears of it tonight; the station chief, sooner.`;
  }
  // (the goods: a gun of its model, used, its magazine in and a spare, a box of its rounds; in a carrier bag, for the flat's stash)
  const cond = Math.round(range(stream('cond', c.seed, o.at), 0.55, 0.95) * 100) / 100;
  const id = newGun(p, o.model, { cond, chamber: false }), M = MODELS[o.model];
  const spare = M.feed === 'mag' ? newMag(p, o.model, 0) : null;
  (p.bag ??= []).push({ item: id }, ...(spare ? [{ item: spare }] : []));
  p.rounds = { ...(p.rounds ?? {}), [M.cal]: (p.rounds?.[M.cal] ?? 0) + 20 };
  o.done = 'got'; o.gun = id;
  const sl = sellerOf(c); if (sl) sl.deals = (sl.deals ?? 0) + 1;    // (a deal done: he knows you, and you can call on him, sim/dial.js)
  return `A sports bag behind the bench, heavier than it looks. Inside, in a towel: ${o.name}, used, its magazine in${spare ? ', a spare' : ''}, and a box of twenty. Into your carrier bag, and walk.`;
}
