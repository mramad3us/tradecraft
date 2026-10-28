// Furniture as the sim knows it (src/sim/interiors/furniture.js): every kind sized in metres, in
// proportion to a 1.7 m person; a piece turned left or right swaps its width and depth; its seats,
// spots and staff places turn with it.
import { FURNITURE, footprint, seatsOf } from '../src/sim/interiors/furniture.js';
import { assert, near, fmt } from './helpers.mjs';

export default [
  {
    name: 'furniture: every kind has a size; turned left or right, w and d swap; the centre stays put',
    fn() {
      const kinds = Object.keys(FURNITURE);
      for (const k of kinds) {
        const f = FURNITURE[k];
        assert(f.w > 0 && f.d > 0 && f.h > 0 && f.w <= 3 && f.d <= 3 && f.h <= 2.6, `${k}: a size in metres, no bigger than a room's height (${f.w} × ${f.d} × ${f.h})`);
        assert(typeof f.block === 'boolean' && typeof f.wall === 'boolean', `${k}: block and wall said`);
        for (const face of ['down', 'up', 'left', 'right']) {
          const p = footprint({ kind: k, x: 10, z: -4, face });
          const side = face === 'left' || face === 'right';
          near(p.x1 - p.x0, side ? f.d : f.w, 1e-9, `${k} ${face} width`);
          near(p.z1 - p.z0, side ? f.w : f.d, 1e-9, `${k} ${face} depth`);
          near((p.x0 + p.x1) / 2, 10, 1e-9); near((p.z0 + p.z1) / 2, -4, 1e-9);
        }
      }
      const tall = kinds.filter(k => FURNITURE[k].h > 1.7).map(k => `${k} ${fmt(FURNITURE[k].h, 2)}`);
      console.log(`      ${kinds.length} kinds; over a 1.7 m person's head: ${tall.join(', ')}`);
    },
  },
  {
    name: 'furniture: seats turn with the piece (a dining table turned left seats its north pair east, looking west)',
    fn() {
      const t = { kind: 'diningTable', x: 10, z: 5 };
      const down = seatsOf({ ...t, face: 'down' }), left = seatsOf({ ...t, face: 'left' }), right = seatsOf({ ...t, face: 'right' }), up = seatsOf({ ...t, face: 'up' });
      assert(down.length === 4 && down[0].z < 5 && down[0].face === 'down', 'facing down, the north pair sit north, looking south');
      assert(left[0].x > 10 && left[0].face === 'left', `turned left, they sit east looking west (${JSON.stringify(left[0])})`);
      assert(right[0].x < 10 && right[0].face === 'right', 'turned right, west looking east');
      assert(up[0].z > 5 && up[0].face === 'up', 'turned up, south looking north');
      // Every seat, spot and staff place of every kind lies within a metre of its piece's footprint.
      for (const k of Object.keys(FURNITURE)) for (const face of ['down', 'left']) for (const which of ['seats', 'spot', 'staff']) {
        const p = footprint({ kind: k, x: 0, z: 0, face });
        for (const s of seatsOf({ kind: k, x: 0, z: 0, face }, which)) assert(s.x > p.x0 - 1 && s.x < p.x1 + 1 && s.z > p.z0 - 1 && s.z < p.z1 + 1, `${k} ${face} ${which} near it`);
      }
      const desk = seatsOf({ kind: 'desk', x: 0, z: 0, face: 'down' })[0];
      console.log(`      desk's chair: ${fmt(desk.z, 2)} m in front of its centre, looking ${desk.face}; dining turned left: ${left.map(s => `(${fmt(s.x, 2)}, ${fmt(s.z, 2)}) ${s.face}`).join(' ')}`);
    },
  },
];
