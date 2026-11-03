// A gun in the hands, as it's drawn (src/render/crowd.js gunPose(), src/art/sprites.js's gun rig): carried at
// the low ready, aimed (turned up or down the picture, or to its right or left, the way the aim lies), fired
// (the kick, the flash), from the sim's runtime marks ($aim, $shot) and its clock, never the wall's. The
// sim's tick is 50 ms, so what's drawn for so many ms is drawn for whole ticks: the numbers printed are those.
import { gunPose, turnOf, FLASH_MS, KICK_MS, AFTER_MS, RAISE_MS, SLOTS } from '../src/render/crowd.js';
import { frame, flashOf, GUN_FRAMES, DIRS } from '../src/art/sprites.js';
import { TICK_MS } from '../src/sim/clock.js';
import { assert } from './helpers.mjs';

const LOOK = { skin: 'light', hair: { style: 'short', color: 0x47302a }, top: { kind: 'uniform', color: 0x283f6b }, legs: 0x1b2541, shoes: 0x14151c };
const GUN_COLOURS = new Set([0x353947, 0x9aa1ae, 0x23252f]);            // (what's held: a dark grip, steel, black: sprites.js colours())
const actor = (face, more = {}) => ({ x: 10, z: 5, face, head: { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[face], gait: 'idle', ...more });
const at = (a, deg, m = 6, ms = -1000) => ({ x: a.x + m * Math.cos(deg * Math.PI / 180), z: a.z + m * Math.sin(deg * Math.PI / 180), ms });
const count = (px, set) => px.flat().filter(c => set.has(c)).length;
const differ = (a, b) => a.reduce((n, row, y) => n + row.filter((c, x) => c !== b[y][x]).length, 0);

export default [
  {
    name: 'gunpose: carried, nothing aimed; aimed straight, up or down the picture, or to its sides from the front; the aim turned only past TURN_RAD',
    fn() {
      assert(gunPose(actor('right'), 0).frame === null, 'a gun in hand, nothing aimed at: the gait\'s own frames (the low ready)');
      // (world angles, atan2(dz, dx): z grows down the picture)
      const sweep = { right: [-60, -30, -15, -5, 0, 10, 30, 60], left: [120, 150, 170, 180, 195, 210, 240], down: [30, 60, 80, 90, 100, 120, 150], up: [-150, -120, -100, -90, -80, -60, -30] };
      for (const [face, degs] of Object.entries(sweep)) {
        const a = actor(face);
        console.log(`      facing ${face}: ${degs.map(d => `${d}° ${gunPose({ ...a, $aim: at(a, d) }, 0).frame}`).join(', ')}`);
      }
      const p = (face, deg) => gunPose({ ...actor(face), $aim: at(actor(face), deg) }, 0).frame;
      assert(p('right', 0) === 'aim' && p('right', -30) === 'aimhi' && p('right', 30) === 'aimlo', 'side on: straight, up the picture (north), down it');
      assert(p('left', 180) === 'aim' && p('left', 210) === 'aimhi' && p('left', 150) === 'aimlo', 'facing left the same, mirrored: up the picture is still hi');
      assert(p('right', -5) === 'aim' && p('right', 10) === 'aim', 'a few degrees off is straight');
      assert(p('down', 90) === 'aim' && p('down', 60) === 'aimhi' && p('down', 120) === 'aimlo', 'facing us: to the picture\'s right is hi, its left lo');
      assert(p('up', -90) === 'aim' && p('up', -60) === 'aimhi' && p('up', -120) === 'aimlo', 'facing away: the same, the picture\'s right hi');
      assert(turnOf('right', 0) === 0 && turnOf('down', Math.PI / 2) === 0, 'straight is straight');
      const still = actor('right', { $aim: { x: 10, z: 5, ms: -1000 }, head: -0.6 });
      assert(gunPose(still, 0).frame === 'aimhi', 'aimed at their own feet\' spot: the head says where');
    },
  },
  {
    name: 'gunpose: a round fired: the flash for a tick, the kick for two or three, the arms kept up after; on the sim\'s clock, frozen when it stops',
    fn() {
      // (the sim marks $shot during a tick, then the clock moves on TICK_MS: drawn from the next tick; or, marked after, from that one)
      for (const [how, d0] of [['marked before the clock moves', TICK_MS], ['marked after', 0]]) {
        const a = actor('right', { $aim: at(actor('right'), 0), $shot: 1000 });
        const seq = [];
        for (let ms = 1000 + d0; ms <= 1000 + AFTER_MS + 2 * TICK_MS; ms += TICK_MS) seq.push(gunPose(a, ms));
        const flash = seq.filter(s => s.flash).length * TICK_MS, kick = seq.filter(s => s.frame.startsWith('fire')).length * TICK_MS;
        console.log(`      ${how}: ${seq.slice(0, 5).map(s => `${s.frame}${s.flash ? '+flash' : ''}`).join(', ')}… flash ${flash} ms, kick ${kick} ms (FLASH_MS ${FLASH_MS}, KICK_MS ${KICK_MS})`);
        assert(flash >= 50 && flash <= 100 && kick >= 100 && kick <= 150, 'a flash of 50–100 ms, a kick of 100–150 ms, in whole ticks');
        assert(seq[0].flash && seq[0].frame === 'fire', 'the first frame drawn after the round is the flash and the kick');
      }
      const point = actor('right', { $shot: 1000 });                  // (a point shot: nothing aimed, the arms up for it)
      const up = gunPose(point, 1000 + AFTER_MS - TICK_MS), down = gunPose(point, 1000 + AFTER_MS + TICK_MS);
      console.log(`      a point shot, nothing aimed: ${gunPose(point, 1050).frame} at 50 ms, ${up.frame} at ${AFTER_MS - TICK_MS} ms, ${down.frame ?? 'carried'} at ${AFTER_MS + TICK_MS} ms`);
      assert(up.frame === 'aim' && down.frame === null, 'after a shot the arms stay up AFTER_MS, then it\'s carried again');
      const frozen = actor('right', { $aim: at(actor('right'), 0), $shot: 1000 });
      assert([1, 2, 3].every(() => gunPose(frozen, 1050).flash), 'the clock stopped (shooting\'s choice): the same flash every frame, not a flicker');
      assert(gunPose(actor('right', { $shot: 2000 }), 1000).frame === null, 'a shot "after" now (a save loaded back): nothing');
    },
  },
  {
    name: 'gunpose: coming up into the aim side on (RAISE_MS a turn lower); nobody down, sat or fighting is drawn aiming',
    fn() {
      const a = actor('right', { $aim: at(actor('right'), 0, 6, 1000) });
      const early = gunPose(a, 1000 + TICK_MS).frame, late = gunPose(a, 1000 + RAISE_MS + TICK_MS).frame;
      console.log(`      aim begun: ${early} at ${TICK_MS} ms, ${late} at ${RAISE_MS + TICK_MS} ms (RAISE_MS ${RAISE_MS})`);
      assert(early === 'aimlo' && late === 'aim', 'the gun comes up from the low ready');
      for (const gait of ['down', 'sit', 'guard', 'phone']) assert(gunPose({ ...a, gait }, 5000).frame === null, `${gait}: not drawn aiming`);
      assert(gunPose({ ...a, gait: 'walk' }, 5000).frame === 'aim', 'walking, aiming');
    },
  },
  {
    name: 'gunpose: every gun frame draws a gun, in every facing, for a handgun and a long gun; carried differs from empty-handed; a fired frame has its flash',
    fn() {
      for (const hand of ['pistol', 'rifle']) {
        const spec = { ...LOOK, hand }, rows = [];
        for (const dir of DIRS) {
          const idle = frame(LOOK, dir, 'idle0'), carry = frame(spec, dir, 'idle0');
          const n = GUN_FRAMES.map(f => count(frame(spec, dir, f), GUN_COLOURS));
          rows.push(`${dir}: carried ${differ(idle, carry)} px changed, gun px ${n.join('/')}`);
          assert(differ(idle, carry) > 4, `${hand} ${dir}: carried at the low ready, not empty-handed`);
          if (dir !== 'up') assert(n.every(k => k >= 3), `${hand} ${dir}: the gun shows aimed and fired`);
          for (const f of GUN_FRAMES) {
            const fl = flashOf(hand, dir, f);
            assert(f.startsWith('fire') ? fl && fl.px.flat().some(c => c !== null) : fl === null, `${hand} ${dir} ${f}: a flash only when fired`);
          }
          assert(differ(frame(spec, dir, 'aim'), frame(spec, dir, 'fire')) > 0 || dir === 'up', `${hand} ${dir}: the kick moves the gun`);
        }
        console.log(`      ${hand} (gun frames ${GUN_FRAMES.join('/')}): ${rows.join('; ')}`);
      }
      console.log(`      the atlas holds ${SLOTS} people's sheets`);
      assert(SLOTS >= 100, 'still room for a crowd\'s looks');
    },
  },
];
