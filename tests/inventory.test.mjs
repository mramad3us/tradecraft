// What fits where (sim/items.js placed(), sim/weapons.js SIZES): by length and bulk, in the trousers'
// pockets, a coat's two and its inside one, the beltline; nothing that doesn't fit; what shows (at a
// belt with no coat over it, a pocket bulging) counts for anyone looking (sim/notice.js mods()), and
// being tailed writes down a weapon seen at your belt.
import { placed, fits, fitsSupply, showing } from '../src/sim/items.js';
import { mods, shown } from '../src/sim/notice.js';
import { carry, shed, unpack, cabinetWays, cabinetDo, bagWord } from '../src/sim/clothes.js';
import { kitOf, useSupply, kitWords, onYou, packsOf, CABINET, SUPPLIES } from '../src/sim/medicine.js';
import { SIZES } from '../src/sim/weapons.js';
import { doll, W, H } from '../src/art/doll.js';
import { assert } from './helpers.mjs';

const person = (top, items = []) => ({ look: { top: { kind: top, color: 0 } }, items: [...items], hand: null });
const where = (p) => placed(p).out.map(o => `${o.kind}: ${o.label ?? 'nowhere'}${o.shows ? ' (shows)' : ''}`).join(', ');

// (a named person: their wallet and phone come with them)
const named = (top, more = {}) => ({ ...person(top), persistent: true, ...more });

export default [
  {
    name: 'inventory: everything takes room: the wallet, the phone, burners, the supplies, all placed; everyday things never bulge while there\'s room',
    fn() {
      const coat = named('coat', { burners: 1, kit: { ...CABINET } }), tee = named('tee', { kit: { ...CABINET } });
      console.log(`      in a coat: ${where(coat)}`);
      console.log(`      in a T-shirt: ${where(tee)}`);
      for (const [k] of Object.entries(SUPPLIES)) assert(SIZES[k]?.length === 2, `${k} has a size`);
      assert(['wallet', 'phone', 'burner'].every(k => placed(coat).out.some(o => o.kind === k && o.at)) && placed(coat).out.filter(o => o.kind === 'bandage').length === 2, 'each in a pocket, a bandage each');
      assert(!placed(coat).out.some(o => o.at === 'belt'), 'nobody tucks a bandage in their belt');
      assert(!showing(coat).length, 'in a coat, nothing bulges');
      assert(!showing(named('tee')).length, 'a wallet and a phone alone don\'t bulge, even in jeans');
      assert(showing(tee).length > 0, 'the same kit in a T-shirt\'s jeans does');
      assert(placed({ ...person('coat') }).out.length === 0, 'a passer-by\'s pockets aren\'t simulated');
      assert(JSON.stringify(packsOf('antiseptic', 8)) === '[6,2]' && packsOf('bandage', 3).length === 3, 'by the bottle, or one by one');
      // (room runs out: a splint won't go in jeans; a T-shirt fills up; a chemist's bag takes the rest)
      assert(!fits(named('tee'), 'splint') && fits(named('coat'), 'splint'), 'a splint: a coat pocket, not jeans');
      const full = named('tee');
      let at, n = 0;
      do { at = carry(full, 'bandage'); n++; } while (at === 'pocket' && n < 40);
      console.log(`      a T-shirt takes ${n - 1} bandages besides a wallet and a phone; the next: ${at} (${full.bag.map(bagWord)})`);
      assert(at === 'bag' && n < 8, 'only so much room');
      assert(kitOf(full, 'bandage') === n && kitWords(onYou(full)).includes(`${n} bandages`), 'what\'s in the bag is still on you');
      assert(useSupply(full, 'bandage') && kitOf(full, 'bandage') === n - 1 && full.bag?.length === 1, 'used from the pockets first, the bag kept');
      const burner = named('tee', { kit: { bandage: 5 } });
      assert(carry(burner, 'burner') === 'bag' && !burner.burners, 'a burner too');
    },
  },
  {
    name: 'inventory: the bathroom cabinet: nothing comes out unasked; one thing at a time, if there\'s room; put back; a shop\'s bag unpacks into it; a top with fewer pockets sheds into the bag',
    fn() {
      const cab = { ...CABINET }, p = named('coat');
      const ways = cabinetWays(p, cab);
      console.log(`      the cabinet offers: ${ways.map(w => w.label).join('; ')}`);
      assert(ways.length === Object.keys(CABINET).length && ways.every(w => !w.off), 'each thing in it, to take');
      assert(/^From the cabinet/.test(cabinetDo(p, cab, 'take:bandage')) && p.kit.bandage === 1 && cab.bandage === CABINET.bandage - 1, 'one bandage');
      cabinetDo(p, cab, 'take:painkillers');
      assert(p.kit.painkillers === CABINET.painkillers && !cab.painkillers, 'a packet, whole');
      assert(/^Back in the cabinet/.test(cabinetDo(p, cab, 'put:bandage')) && !p.kit.bandage && cab.bandage === CABINET.bandage, 'put back');
      // (no room: greyed, and it can't be done)
      const tight = named('tee', { kit: { bandage: 5 } }), c2 = { splint: 1 };
      const off = cabinetWays(tight, c2).find(w => w.key === 'take:splint');
      assert(off?.off && cabinetDo(tight, c2, 'take:splint') === null && c2.splint === 1, 'no room, not taken');
      // (a chemist's bag goes in the cabinet at home)
      const b = named('tee', { bag: [{ supply: 'antiseptic', n: 6 }, { item: 'burner' }] }), c3 = {};
      const got = unpack(b, c3);
      console.log(`      unpacked: ${got}; the cabinet: ${kitWords(c3)}; the drawer: ${b.stash}`);
      assert(c3.antiseptic === 6 && b.stash[0] === 'burner' && !b.bag, 'supplies in the cabinet, the burner in the drawer');
      // (a jumper for a coat: what was in the coat has nowhere to go)
      const s = named('coat', { items: ['finka'], kit: { splint: 1 } });
      s.look = { top: { kind: 'sweater', color: 0 } };
      const n = shed(s);
      console.log(`      a coat off for a jumper: ${n} things into the bag: ${s.bag.map(bagWord).join(', ')}`);
      assert(n === 1 && s.bag[0].supply === 'splint' && !s.kit && placed(s).out.every(o => o.at), 'the splint in the bag; the finka under the jumper at the belt; the wallet and the phone where they were');
    },
  },
  {
    name: 'inventory: the figure: for every top, a hair and a hat, a whole picture, its ink closed round a figure in proportion; a pocket\'s mark lands on what\'s worn',
    fn() {
      const looks = [];
      for (const kind of ['coat', 'jacket', 'suit', 'sweater', 'tee', 'dress', 'uniform']) for (const sex of ['m', 'f']) for (const style of ['short', 'crew', 'side', 'long', 'bob', 'bun', 'ponytail', 'bald'])
        looks.push({ sex, look: { skin: 'tan', hair: { style, color: 0x47302a }, top: { kind, color: 0x353947, trim: 0x23252f }, legs: 0x23252f, shoes: 0x14151c } });
      for (const hat of ['fedora', 'cap', 'beanie', 'peaked', 'skullcap', 'hijab']) looks.push({ sex: 'f', look: { skin: 'light', hair: { style: 'long', color: 0 }, hat: { kind: hat, color: 0x4c5262 }, glasses: 'specs', beard: true, top: { kind: 'coat', color: 0x353947 } }, hand: 'pipe', bag: true });
      const INK = 0x14151c;
      for (const o of looks) {
        const R = doll({ ...o, marks: { coat: ['used', 'free'], inside: ['shows'], trousers: ['free', 'used'], belt: ['free', 'shows'] } });
        assert(R.length === H && R.every(r => r.length === W && r.every(c => Number.isInteger(c))), `${JSON.stringify(o.look.top)}: every pixel filled`);
        assert(R[0].every(c => c !== undefined) && R[H - 1].every(c => c !== INK), 'room at the foot of the frame');
      }
      // (a bare figure's silhouette: the shoulders wider than the head, feet on the floor, standing straight)
      const R = doll({ look: { skin: 'light', hair: { style: 'bald' }, top: { kind: 'coat', color: 0x353947 } } });
      const inked = R.map(r => r.map((c, x) => c === INK ? x : -1).filter(x => x >= 0)), width = (y) => (inked[y].length ? inked[y].at(-1) - inked[y][0] + 1 : 0);
      const rows = inked.map((r, y) => (r.length ? y : -1)).filter(y => y >= 0), tall = rows.at(-1) - rows[0];
      console.log(`      ${looks.length} figures whole; ${W} × ${H}; ${tall} tall, the head ${width(14)} wide, the shoulders ${width(40)}`);
      assert(tall > 115 && width(40) > width(14) * 1.6 && width(40) < W - 2, 'a person, and in the frame');
    },
  },
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
