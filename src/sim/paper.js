// TRADECRAFT sim: paper targets, a range's (the user, 2026-11-04: "a firearms training lesson" at "ranges where legal";
// the range: sim/interiors/range.js, its scene sim/scenarios/range.js).
//
// **A target is an actor of its own kind**: a sheet with `paper` on it ({ kind, lane, m, shots }) and no mind, on its
// stand where the range set it, drawn as the paper on its stand with its holes in it (src/art/sprites.js paperFrame(),
// from the look's `target` and `holes`). It's aimed at as anyone in the picture is (sim/shooting.js targets(), aimMs(),
// odds()): the distance, the gun, the hand, the light. What a round does to it is here (shotAt()), not a wound's: no
// blood, nobody runs, nobody calls anyone (sim/shooting.js heard(): on a range, a gunshot is what the place is for).
//   - **Where it lands** is the roll's. Made, it's on the paper, its ring by how far the roll beat the DC (RINGS, by the
//     margin: the inner ten, the X, the best); missed, it's off the paper and into the trap. The hole's in that ring
//     (BANDS: its radius, in ring widths) at an angle of its own dice (a 'hole' stream: the game's dice don't move).
//     Aimed at a silhouette's head or low (the aim's part), a hit lands there (OFF), outside the rings, OFF_SCORE:
//     the chest is what's taught.
//   - **The kinds** (KINDS): a chest silhouette, black on white, its rings on the chest (Moscow's No. 4 and its like,
//     RING_CM a ring); a rifle club's bull's-eye card (London's), rings a quarter the size and a harder DC (dc: the
//     precision asked of a .22 at a card), whatever part's aimed at.
//   - **A group** (group()): the first GROUP rounds fired at a target: hits, the score (each hit its ring's number, an
//     X counting ten and counted), and the extreme spread (cm, the two holes furthest apart), as a coach measures one.
// Rounds that weren't aimed at it (a miss gone wide of another, a gun gone off) still make a hole, marked stray, and
// count in no group.
import { sheet } from './people.js';
import { stream, range } from './rng.js';

export const GROUP = 5;
// The ring a hit's in, by the roll's margin over the DC (the first whose `from` it reaches), best first.
export const RINGS = [{ from: 13, score: 10, x: true, word: 'Dead centre: an X.' }, { from: 10, score: 10, word: 'In the ten.' }, { from: 7, score: 9, word: 'In the nine.' },
  { from: 4, score: 8, word: 'In the eight.' }, { from: 2, score: 7, word: 'In the seven.' }, { from: -99, score: 6, word: 'In the six, near the edge.' }];
const BANDS = [[0, 0.5], [0.5, 1], [1, 2], [2, 3], [3, 4], [4, 5]];      // (each ring's radius, in ring widths: the X half the ten's)
export const OFF_SCORE = 5;
export const OFF = { head: { y: -30, r: 5, word: 'High: in the head.' }, legs: { y: 18, r: 4, word: 'Low, under the rings.' } };   // (cm from the rings' middle, y down)
export const MISS_WORD = 'Off the paper: into the trap.';
export const KINDS = {
  chest: { word: 'a chest silhouette', ringCm: 5, dc: 0, parts: true },
  bull: { word: 'a club bull\'s-eye card', ringCm: 1.25, dc: 6, parts: false },
};

/** Whether actor a is a paper target. */
export const isPaper = (state, a) => !!(a?.who && state.people[a.who]?.paper);
/** The targets on the map: [actor]. */
export const papers = (state) => state.actors.filter(a => isPaper(state, a));
/** Whether the map is a range's (sim/interiors/range.js): its shots are nobody's business. */
export const onRange = (state) => state.map?.kind === 'interior' && state.map.plan === 'range';
/** The DC a paper adds to a shot at the part aimed at (sim/shooting.js shotOf()), in place of a person's part's. */
export const paperDC = (state, a, part, personal) => { const K = KINDS[state.people[a.who].paper.kind]; return K.parts ? personal : K.dc; };

/**
 * A target set on its stand: its sheet (`paper`, and the look the art draws from) and its actor, facing the camera (the
 * paper's face is what's drawn). holes: old ones, from whoever shot the lane before. Returns the actor.
 */
export function setPaper(state, { who, name, x, z, kind = 'chest', lane = 0, m = 0, holes = [] }) {
  state.people[who] = { ...sheet({ id: who, name, sex: 'm', look: { target: kind, holes } }), paper: { kind, lane, m, shots: [] } };
  const a = { id: `a${state.nextActor++}`, who, seed: null, row: state.map?.row ?? 0, x, z, vx: 0, vz: 0, face: 'down', head: Math.PI, gait: 'idle', stride: 0, stuck: 0, ai: null };
  state.actors.push(a);
  return a;
}

/**
 * A round at target a, aimed at `part`, its roll (made: on the paper; missed: off it). stray: not aimed at it (a gun gone
 * off, a miss at another), its hole made of its own dice. Returns { shot, words }.
 */
export function shotAt(state, a, part = 'torso', roll = null, { stray = false } = {}) {
  const p = state.people[a.who], P = p.paper, K = KINDS[P.kind], r = stream('hole', state.seed, a.id, P.shots.length);
  const margin = roll ? roll.margin : Math.floor(range(r, 0, 14));
  const s = { ms: state.time.ms, hit: roll ? !!roll.ok : true, part, margin, ...(stray ? { stray: true } : {}) };
  let words = MISS_WORD;
  if (s.hit) {
    const off = K.parts && OFF[part], t = range(r, 0, Math.PI * 2);
    if (off) { const d = range(r, 0, off.r); s.at = [Math.cos(t) * d, off.y + Math.sin(t) * d]; s.score = OFF_SCORE; s.zone = part; words = off.word; }
    else {
      const i = Math.max(0, RINGS.findIndex(q => margin >= q.from)), [lo, hi] = BANDS[i], d = range(r, lo, hi) * K.ringCm;
      s.at = [Math.cos(t) * d, Math.sin(t) * d]; s.score = RINGS[i].score; s.zone = 'rings'; if (RINGS[i].x) s.x = true;
      words = RINGS[i].word;
    }
    s.at = s.at.map(v => Math.round(v * 10) / 10);
    p.look = { ...p.look, holes: [...(p.look.holes ?? []), s.at] };   // (a new look, not the old one changed: the view keys a sheet by it, src/render/view.js)
  }
  P.shots.push(s);
  return { shot: s, words };
}

/** The first n rounds aimed at a paper (its sheet's `paper`): { shots, hits, score, of, xs, spreadCm, done }. */
export function group(P, n = GROUP) {
  const shots = P.shots.filter(s => !s.stray).slice(0, n), hits = shots.filter(s => s.hit);
  let spread = 0;
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) spread = Math.max(spread, Math.hypot(hits[i].at[0] - hits[j].at[0], hits[i].at[1] - hits[j].at[1]));
  return { shots: shots.length, hits: hits.length, score: hits.reduce((t, s) => t + s.score, 0), of: n * 10, xs: hits.filter(s => s.x).length, spreadCm: Math.round(spread), done: shots.length >= n };
}

/** A group in words: '43 of 50, 2 X, five on the paper in 11 cm'. */
export function groupWords(g) {
  const on = g.hits === g.shots ? `all ${NUM[g.shots] ?? g.shots} on the paper` : g.hits ? `${NUM[g.hits] ?? g.hits} of ${NUM[g.shots] ?? g.shots} on the paper` : 'nothing on the paper';
  return `${g.score} of ${g.of}${g.xs ? `, ${g.xs} X` : ''}, ${on}${g.hits > 1 ? ` in ${g.spreadCm} cm` : ''}`;
}
const NUM = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
