// TRADECRAFT sim: a building's people through its day (the user, 2026-10-28: "the ambassy looks to be
// static, NPCs should move around (not much but still) leave the office at 6pm (so at 6 there should not
// be many people working past 6pm), there also should be some turnover in the visas room, and nobody at
// 6pm since these tend to close earlier than that"). The embassy's, from its plan (sim/interiors/
// embassy.js: its posts, its seats, its errands), while its map is the one in play.
//
// **The rota** (rota()): who's due, from when to when, each day the same for the same day (a hash of the
// plan's seed, the day, the post). The Marine on the desk round the clock. On working days only, the
// rest: the chief from about eight till after six; the colleagues in from half past eight to a quarter
// past nine and out between twenty to six and twenty past (LATE of them, some evening, till seven or
// nine); one in twelve off that day; the consular officer at the visa window while the consular section
// is open (CONSULAR_H: nine till one), and gone soon after it shuts.
// **At work** (think()): in at the street door and to the post (a desk: sat at it); a while there (SIT_MIN),
// then now and then an errand (ERRANDS: the water cooler, the cabinets, the tank's door, the chief's), and
// back; at the hour, out by the street door. Applicants, while the visa room's open: one may come in each
// APPLICANT_EVERY_MIN, sit where a seat's free, wait to be called (WAIT_MIN), stand at the window a few
// minutes, and go. The clock skipped (the day's work), it's put right at once: whoever's due is at their
// post, whoever isn't is gone.
// They're the scene's people (ai.kind 'staff' | 'applicant': the campaign's think()); the staff each a
// sheet (who: 'emb:<post>'), dressed for indoors; the applicants passers-by (by seed), coats and all.
import { hash, stream, int, range } from '../rng.js';
import { DAY, HOUR, MIN, calendar, TICK_MS } from '../clock.js';
import { wayAcross } from './path.js';
import { sheet, passerby } from '../people.js';
import { headOf } from '../perception.js';

export const CONSULAR_H = [9, 13], LATE = 0.22, OFF = 1 / 12;
export const SIT_MIN = [6, 18], ERRAND_S = [25, 90], APPLICANT_EVERY_MIN = 5, APPLICANT_CHANCE = 0.6, WAIT_MIN = [5, 18], WINDOW_MIN = [2, 4];
const TPS = 1000 / TICK_MS;
const frac = (...k) => (hash(...k) % 100000) / 100000;

/** Who's due today, and when: [{ post (plan.staff's), from, to }] (to < from: not in today). */
export function rota(plan, ms) {
  const d = Math.floor(ms / DAY), workday = calendar(d * DAY).weekday < 5, at = (h) => d * DAY + h * HOUR, out = [];
  for (const s of plan.staff) {
    const r = frac(plan.seed, d, s.id), off = frac(plan.seed, d, s.id, 'off') < OFF;
    if (s.who === 'marine') { out.push({ post: s, from: -Infinity, to: Infinity }); continue; }
    if (!workday || (off && s.who !== 'chief')) continue;
    if (s.who === 'chief') out.push({ post: s, from: at(7.9 + r * 0.7), to: at(18.4 + r * 1.4) });
    else if (s.who === 'consular') out.push({ post: s, from: at(8.6 + r * 0.3), to: at(CONSULAR_H[1] + 0.2 + r * 0.3) });
    else out.push({ post: s, from: at(8.4 + r * 0.9), to: frac(plan.seed, d, s.id, 'late') < LATE ? at(19 + r * 2) : at(17.65 + r * 0.7) });
  }
  return out;
}

/** Whether the visa room's open at ms. */
export const consularOpen = (ms) => { const k = calendar(ms); return k.weekday < 5 && k.hour + k.minute / 60 >= CONSULAR_H[0] && k.hour + k.minute / 60 < CONSULAR_H[1]; };

/**
 * Once a second while the embassy's the map: the rota kept (in at the door when due, out at the hour),
 * the applicants' arrivals; after a skip (or on coming in), put right at once.
 */
export function staffTick(state, bus, S) {
  const plan = S.plan, ms = state.time.ms, life = (state.scenario.life ??= { at: ms, apps: 0 }), jump = ms - life.at > 2 * MIN || !life.seen;
  life.seen = true;
  const due = rota(plan, ms), here = (id) => state.actors.find(a => a.ai?.sid === id);
  for (const r of due) {
    const a = here(r.post.id), on = ms >= r.from && ms < r.to;
    if (on && !a) spawn(state, S, r.post, jump ? 'post' : 'door');
    if (!on && a && !a.ai.leaving) { if (jump) drop(state, a); else leave(state, S, a); }
  }
  // (posts not on the rota today, or no more: gone)
  for (const a of state.actors.filter(x => x.ai?.kind === 'staff')) if (!due.some(r => r.post.id === a.ai.sid && ms >= r.from && ms < r.to) && !a.ai.leaving) { if (jump) drop(state, a); else leave(state, S, a); }
  // The applicants: one now and then while the visa room's open; after a skip, a few already waiting.
  const open = consularOpen(ms);
  if (jump) {
    for (const a of state.actors.filter(x => x.ai?.kind === 'applicant')) drop(state, a);
    if (open) for (let k = 0, n = int(stream('apps', plan.seed, Math.floor(ms / MIN)), 4); k < n; k++) applicant(state, S, 'seat');
  } else if (open) {
    const slot = Math.floor(ms / (APPLICANT_EVERY_MIN * MIN));
    if (slot !== life.slot) { life.slot = slot; if (frac(plan.seed, slot, 'app') < APPLICANT_CHANCE) applicant(state, S, 'door'); }
  }
  life.at = ms;
}

/** A staff member's or an applicant's next steps, when the last are done (the campaign's think()). */
export function think(state, S, a, follow) {
  unstick(state, S, a);
  const step = follow(state, a);
  if (step?.[0] === 'sit') { Object.assign(a, { x: step[1], z: step[2], vx: 0, vz: 0, face: step[3], head: headOf(step[3]), gait: 'sit' }); a.ai.steps.shift(); return; }
  if (step?.[0] === 'stand') { Object.assign(a, { x: step[1], z: step[2], gait: 'idle' }); a.ai.steps.shift(); return; }   // (up off a chair, a step in front of it)
  if (step?.[0] === 'leave') { drop(state, a); return; }
  if (step) return;
  const plan = S.plan, ms = state.time.ms, r = stream('staff', plan.seed, a.id, Math.floor(ms / MIN));
  if (a.ai.kind === 'applicant') return;                            // (their whole visit was planned at the door)
  // (at the post: a while there; then, now and then, an errand and back)
  const p = a.ai.post, atPost = Math.hypot(a.x - p.x, a.z - p.z) < 0.3;
  if (!atPost) { a.ai.steps = [...walk(S, a, p.approach ?? p), ...seat(p)]; return; }
  if (p.who !== 'marine' && p.who !== 'consular' && range(r, 0, 1) < 0.35 && plan.errands?.length) {
    const e = plan.errands[int(r, plan.errands.length)], from = p.approach ?? p;
    a.ai.steps = [...walk(S, from, e), ['wait', Math.round(range(r, ...ERRAND_S) * TPS), e.face ?? 'up', 'idle'], ...walk(S, e, from), ...seat(p)];
    a.gait = 'idle';
    Object.assign(a, { x: from.x, z: from.z });
    return;
  }
  a.ai.steps = [['wait', Math.round(range(r, ...SIT_MIN) * 60 * TPS), p.face ?? 'down', p.gait ?? 'idle']];
}

// (no nearer where it's going for two seconds on end (a corner cut round a chair, a wall slid along): the
// way planned again from here; no nearer for four, or no way from here, there)
function unstick(state, S, a) {
  const st = a.ai.steps[0];
  if (st?.[0] !== 'go') { a.ai.held = 0; a.ai.was = null; return; }
  if (state.tick % TPS) return;
  const d = Math.hypot(st[1] - a.x, st[2] - a.z), was = a.ai.was;
  a.ai.was = d;
  a.ai.held = was !== null && was !== undefined && was - d < 0.25 ? (a.ai.held ?? 0) + 1 : 0;
  if (a.ai.held < 2) return;
  let n = 0;
  while (a.ai.steps[n]?.[0] === 'go') n++;
  const [, tx, tz] = a.ai.steps[n - 1], way = a.ai.held < 4 && wayAcross(S, a.x, a.z, tx, tz);
  if (way) { a.ai.steps.splice(0, n, ...way.map(([x, z]) => ['go', x, z])); a.ai.was = null; return; }
  Object.assign(a, { x: tx, z: tz });
  a.ai.steps.splice(0, n);
  a.ai.held = 0; a.ai.was = null;
}

// (a way across the plan, round its walls and furniture: go-steps)
function walk(S, from, to) {
  const pts = wayAcross(S, from.x, from.z, to.x, to.z) ?? [[to.x, to.z]];
  return pts.map(([x, z]) => ['go', x, z]);
}
const seat = (p) => (p.gait === 'sit' ? [['sit', p.x, p.z, p.face ?? 'down']] : [['go', p.x, p.z], ['wait', 1, p.face ?? 'down', 'idle']]);

// (someone in, at the street door or already at their post)
function spawn(state, S, post, where) {
  const plan = S.plan, e = plan.exits[0], door = { x: (e.x0 + e.x1) / 2, z: e.z0 - 0.5 }, who = `emb:${post.id}`;
  if (!state.people[who]) {
    const P = passerby(hash(plan.seed, post.id), state.map.city);
    const look = post.look ?? indoors(P.look);
    state.people[who] = sheet({ id: who, name: P.name, sex: P.sex, cls: 'civilian', look, skills: P.skills });
  }
  const start = where === 'post' ? (post.gait === 'sit' ? post : post.approach ?? post) : door;
  const a = { id: `s${state.nextActor++}`, who, seed: null, row: state.map.row ?? 0, x: start.x, z: start.z, vx: 0, vz: 0, face: post.face ?? 'down', head: headOf(post.face ?? 'down'), gait: where === 'post' && post.gait === 'sit' ? 'sit' : 'idle', stride: 0, stuck: 0,
    ai: { kind: 'staff', sid: post.id, post, steps: where === 'post' ? [] : [...walk(S, door, post.approach ?? post), ...seat(post)], wait: 0, speed: 1.25 } };
  state.actors.push(a);
  return a;
}

// (an applicant: in at the door to a free seat, or found sat in one; a wait, the window, and out)
function applicant(state, S, where) {
  const plan = S.plan, e = plan.exits[0], door = { x: (e.x0 + e.x1) / 2, z: e.z0 - 0.5 }, ms = state.time.ms;
  const taken = state.actors.filter(a => a.ai?.kind === 'applicant').map(a => a.ai.seatAt);
  const free = plan.seats.map((s, i) => i).filter(i => !taken.includes(i));
  if (!free.length) return null;
  const r = stream('applicant', plan.seed, Math.floor(ms / 1000), state.nextActor), i = free[int(r, free.length)], s = plan.seats[i], w = plan.window;
  const visit = [...(where === 'seat' ? [] : walk(S, door, s.approach)), ['sit', s.x, s.z, s.face], ['wait', Math.round(range(r, ...WAIT_MIN) * 60 * TPS), s.face, 'sit'],
    ['stand', s.approach.x, s.approach.z], ...walk(S, s.approach, w), ['wait', Math.round(range(r, ...WINDOW_MIN) * 60 * TPS), 'up', 'idle'], ...walk(S, w, door), ['leave']];
  const at = where === 'seat' ? s : door;
  const a = { id: `s${state.nextActor++}`, seed: hash(plan.seed, ms, state.nextActor) % 1e9, row: state.map.row ?? 0, x: at.x, z: at.z, vx: 0, vz: 0, face: 'up', head: headOf('up'), gait: where === 'seat' ? 'sit' : 'idle', stride: 0, stuck: 0,
    ai: { kind: 'applicant', seatAt: i, steps: visit, wait: 0, speed: 1.1 } };
  state.actors.push(a);
  return a;
}

// (out by the street door, at the hour)
function leave(state, S, a) {
  const e = S.plan.exits[0], door = { x: (e.x0 + e.x1) / 2, z: e.z0 - 0.3 }, from = a.gait === 'sit' ? (a.ai.post?.approach ?? a) : a;
  if (a.gait === 'sit') Object.assign(a, { x: from.x, z: from.z, gait: 'idle' });
  a.ai.leaving = true;
  a.ai.steps = [...walk(S, a, door), ['leave']];
}
function drop(state, a) { state.actors = state.actors.filter(o => o !== a); }

// (dressed for indoors: no hat but a headscarf or a skullcap, nothing carried)
function indoors(look) {
  const { carry, hat, ...rest } = look;
  return hat && ['hijab', 'skullcap'].includes(hat.kind) ? { ...rest, hat } : rest;
}
