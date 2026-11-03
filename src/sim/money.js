// TRADECRAFT sim: money in your pocket (DESIGN.md, Inventory: "… clothes that can be changed, clothes shops
// to buy a change of clothes when tailed … and money"). The campaign keeps the bank and the operational
// fund (sim/campaign.js); this is the cash on the character (p.cash, dollars underneath: CASH_START when
// they've none yet), spent on the street and shown in the country's money (its profile's currency: the
// rate, the sign, a sensible rounding; sim/countries/). price() says a cost as the city has it; pay() takes it, or says you haven't got it.
// Costs (in dollars, my call): a bite BITE_USD, a coat COAT_USD, a taxi's fare (sim/taxi.js).
import { say } from './log.js';
import { countryOfMap } from './countries/index.js';

export const CASH_START = 300;
export const BITE_USD = 6;
export const COAT_USD = 120;
const cur = (state) => countryOfMap(state.map).currency;

/** The cash on them, in dollars. */
export const cashOf = (p) => p?.cash ?? CASH_START;

/** An amount in dollars as the city has it: '4 750 ₽', '£95', 'E£ 290'. */
export function price(state, usd) {
  const c = cur(state), v = Math.max(c.round, Math.round(usd * c.rate / c.round) * c.round);
  const n = v.toLocaleString('en-GB').replace(/,/g, ' ');
  return c.after ? `${n} ${c.sign}` : c.sign.length > 1 ? `${c.sign} ${n}` : `${c.sign}${n}`;
}

/** Pay usd: true, taken; false (and the log says so), not enough on you. */
export function pay(state, bus, usd, what = 'it') {
  const p = state.people[state.player];
  if (!p) return false;
  if (cashOf(p) < usd) { say(state, bus, { kind: 'note', text: `You haven't the money for ${what}: ${price(state, cashOf(p))} on you, and it's ${price(state, usd)}.` }); return false; }
  p.cash = Math.round((cashOf(p) - usd) * 100) / 100;
  return true;
}
