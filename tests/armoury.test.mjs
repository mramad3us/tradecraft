// The station's armoury (sim/armoury.js): by the law for diplomats, a sidearm on a permit (Beirut: three days, then the
// station's SIG on the belt; Cairo: only with the heat up; Moscow, London: no), a vest where the post keeps them; and a
// search that finds the permitted gun hands it back (sim/police.js).
import { newGame, start } from '../src/sim/game.js';
import { candidates, newCampaign } from '../src/sim/campaign.js';
import { chiefWays, chiefDo, PERMIT_DAYS, HOT_HEAT } from '../src/sim/armoury.js';
import { DAY } from '../src/sim/clock.js';
import { createBus } from '../src/sim/bus.js';
import { assert } from './helpers.mjs';

function hub(city, seed = 4) {
  const level = city === 'london' ? 'junior' : 'handler', c = newCampaign(seed, candidates(seed, city, level)[0], city, level);
  const g = newGame({ seed, scenario: 'campaign', campaign: c });
  start(g, createBus());
  return { g, c, p: g.people[g.player] };
}
const off = (g, key) => chiefWays(g).find(w => w.key === key)?.off ?? null;

export default [
  {
    name: 'armoury: a sidearm by the law for diplomats (Beirut on a permit in three days, Cairo only with the heat up, Moscow and London no); a vest where the post keeps them',
    fn() {
      const out = [];
      for (const city of ['beirut', 'cairo', 'moscow', 'london']) {
        const { g, c, p } = hub(city), gun = off(g, 'sidearm'), vest = off(g, 'vest');
        if (city === 'cairo') { c.posting.heat = HOT_HEAT; }
        const hot = city === 'cairo' ? off(g, 'sidearm') : gun;
        out.push(`${city}: a sidearm ${gun ? `no (${gun})` : 'yes'}${city === 'cairo' ? `, with the heat at ${HOT_HEAT} ${hot ? 'no' : 'yes'}` : ''}; a vest ${vest ? `no (${vest})` : 'yes'}`);
        const want = { beirut: [null, null], cairo: ['x', null], moscow: ['x', 'x'], london: ['x', 'x'] }[city];
        assert(!!gun === !!want[0] && !!vest === !!want[1] && (city !== 'cairo' || !hot), `${city}: sidearm ${gun}, vest ${vest}, hot ${hot}`);
      }
      // (Beirut, end to end: asked, waited for, collected; the vest)
      const { g, c, p } = hub('beirut');
      chiefDo(g, 'sidearm');
      const early = chiefWays(g).find(w => w.key === 'wait');
      g.time.ms += PERMIT_DAYS.lb * DAY + 1;
      const line = chiefDo(g, 'collect'), vest = chiefDo(g, 'vest');
      assert(early?.off && p.permit?.gun && (p.items ?? []).includes(p.permit.gun) && p.arms[p.permit.gun].model === 'p229' && p.armour?.kind === 'light', `Beirut: ${line} / ${vest}`);
      console.log(`      ${out.join('; ')}; Beirut, collected: ${p.arms[p.permit.gun].model}, the permit to ${new Date(Date.UTC(2026, 0, 1) + p.permit.until).toISOString().slice(0, 10)}, a ${p.armour.kind} vest`);
    },
  },
];
