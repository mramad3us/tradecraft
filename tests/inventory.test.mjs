// What fits where (sim/items.js placed(), sim/weapons.js SIZES): by length and bulk, in the trousers'
// pockets, a coat's two and its inside one, the beltline; nothing that doesn't fit; what shows (at a
// belt with no coat over it, a pocket bulging) counts for anyone looking (sim/notice.js mods()), and
// being tailed writes down a weapon seen at your belt.
import { placed, fits, showing } from '../src/sim/items.js';
import { mods, shown } from '../src/sim/notice.js';
import { assert } from './helpers.mjs';

const person = (top, items = []) => ({ look: { top: { kind: top, color: 0 } }, items: [...items], hand: null });
const where = (p) => placed(p).out.map(o => `${o.kind}: ${o.label ?? 'nowhere'}${o.shows ? ' (shows)' : ''}`).join(', ');

export default [
  {
    name: 'inventory: by length and bulk, the most hidden space first; a coat adds pockets and hides the beltline; a dress, neither',
    fn() {
      const coat = person('coat', ['penknife', 'switchblade', 'finka', 'bottle', 'kitchen', 'hammer']);
      const tee = person('tee', ['penknife', 'switchblade', 'finka', 'kitchen']);
      const dress = person('dress', ['penknife']);
      console.log(`      in a coat: ${where(coat)}`);
      console.log(`      in a T-shirt: ${where(tee)}`);
      console.log(`      in a dress: ${where(dress)}`);
      const c = placed(coat).out, t = placed(tee).out;
      assert(c[0].at === 'trousers' && c[1].at === 'trousers' && c[2].at === 'inside' && c[3].at === 'coat' && c[4].at === 'belt' && c[5].at === 'belt', 'small in the trousers, a finka inside, a bottle in a coat pocket, the long ones in the beltline');
      assert(!c.some(o => o.at === 'belt' && o.shows), 'under a coat the beltline doesn\'t show');
      assert(t[2].at === 'belt' && t[2].shows && t[3].shows, 'in a T-shirt, the finka and the kitchen knife go in the beltline, and show');
      assert(placed(dress).out[0].at === null, 'a dress: no pockets');
      assert(!fits(person('coat'), 'pipe') && !fits(person('coat'), 'shovel') && fits(person('coat'), 'brick') && !fits(person('tee'), 'brick'), 'a pipe only in the hand; half a brick in a coat pocket, not in jeans');
      assert(!fits(person('coat', ['kitchen', 'hammer']), 'combat') && fits(person('coat', ['kitchen']), 'combat'), 'two things in the beltline');
    },
  },
  {
    name: 'inventory: what shows counts for anyone looking for you; a weapon held most, one at an uncovered belt, a stuffed pocket least',
    fn() {
      const rows = [['nothing', person('coat')], ['a penknife in the trousers', person('coat', ['penknife'])], ['a bottle in a coat pocket', person('coat', ['bottle'])],
        ['a kitchen knife under a coat', person('coat', ['kitchen'])], ['a kitchen knife at a T-shirt\'s belt', person('tee', ['kitchen'])], ['a knife in the hand', { ...person('coat'), hand: 'kitchen' }]];
      for (const [what, p] of rows) console.log(`      ${what}: ${mods(p).map(m => `${m.why} +${m.v}`).join(', ') || 'nothing shows'}`);
      const v = (p) => mods(p).reduce((a, m) => a + m.v, 0);
      assert(v(rows[0][1]) === 0 && v(rows[1][1]) === 0 && v(rows[3][1]) === 0, 'hidden is hidden');
      assert(v(rows[2][1]) > 0 && v(rows[4][1]) > v(rows[2][1]) && v(rows[5][1]) > v(rows[4][1]), 'a bulge, less than a knife at the belt, less than one in the hand');
      assert(shown(rows[4][1]).belt && showing(rows[4][1]).length === 1, 'the belt shows');
    },
  },
];
