// TRADECRAFT sim: the tutorial's earpiece (the user, 2026-10-27: "the test assignments … should be
// consolidated as tutorials, rewritten to really hold the hand of the player so they really understand
// the game mechanics … a tutor on these missions, make it make sense, the idea is to roleplay the
// instructions, maybe a radio and an earpiece that supplement the instinct"). Something to refine over
// time: the lessons' scripts are sim/tutorial/*.js, the list sim/tutorial/index.js.
//
// A lesson runs a mechanic test's scene with Hale in your ear (state.tutor): your first month at the
// station, Hale, who taught you at the Farm, takes you through the work on the street, the station's
// own people playing the parts. What he says goes to the log as kind 'radio' (src/ui/ui.js: the
// earpiece's box, not the top left), a line at a time, each given its time to read (READ_S, and
// WORD_S a word), so nothing piles up; the instinct goes on saying what's at hand, and he says why.
//   - **Beats** ({ id, when(state, mem) → truthy, say: text | [texts] | (state, mem) → text, every: s,
//     now: true }): each second, those whose `when` holds and that haven't been said (or not for `every`
//     seconds) are queued, in the script's order; one marked `now` goes to the front (he's watching
//     what you're doing, and some things can't wait). A beat whose line is queued too long goes stale
//     (STALE_S) and isn't said; one with `keep(state, mem)` is said only if that still holds when its
//     turn comes (an instruction for a moment that's passed: the seven-metre paper, once it's shot).
//   - **Steps** ({ id, text, done(state, mem) → truthy, said }): the lesson's checklist, shown on screen
//     and ticked as each is done (it stays done), with his line for it: ahead of the beats, behind
//     the steps done before it (in the order they were done) and anything `now`.
//   - mem: the lesson's own memory (state.tutor.mem), for beats and steps that count (seconds kept at
//     the right distance, the first window). A lesson's tick(state, mem) keeps it, once a second.
// **In stop motion** (a gun being readied, sim/shooting.js: time stands still while you choose, and runs for a step's
// half second once chosen), the game's seconds hardly pass, and a lesson at the lanes (sim/tutorial/range.js) would
// have its lines pile up behind them. So his lines are read on a clock of their own (clockOf(): the game's, and the
// moments time stood still, t.waitMs, each a tick's worth: tutorWait()), and each step chosen is a moment the
// checklist and the beats are looked at (not just once a game second, which a shot can fall between).
// A lesson Hale gives in person (a range: L.via, 'beside you') says so on his box (src/ui/ui.js), not 'earpiece'.
// Plain data, so a lesson saves and loads like the rest.
import { cityWords } from '../cities/index.js';
import { TICK_MS } from '../clock.js';
import { say } from '../log.js';
import { lessonOf } from './index.js';

export const READ_S = 3.5, WORD_S = 0.33, STALE_S = 25;
const TPS = 1000 / TICK_MS;

/** A lesson begins: Hale on the earpiece, the checklist set out. */
export function startTutor(state, lesson) {
  state.tutor = { lesson: lesson.id, who: lesson.tutor ?? 'Hale', said: {}, queue: [], busyUntil: 0, mem: {},
    steps: (lesson.steps ?? []).map(s => ({ id: s.id, text: s.text, done: false })) };
}

/** The clock his lines are read by: the game's, and the moments it stood still for a shot (tutorWait()). */
export const clockOf = (state) => state.time.ms + (state.tutor?.waitMs ?? 0);

/** Something said on the earpiece now (beats queue; this is for the scene's own moments). */
export function radio(state, bus, text) {
  const t = state.tutor, via = t && lessonOf(t.lesson)?.via;
  say(state, bus, { kind: 'radio', who: t?.who ?? 'Hale', text: cityWords(text, state.map?.city, state.time.ms), ...(via ? { via } : {}) });   // (in the city's own words: sim/cities/ cityWords())
  if (t) t.busyUntil = clockOf(state) + readMs(text);
}

/** Time standing still for a shot being readied (sim/game.js): a tick's worth of reading, and the next line if it's due. */
export function tutorWait(state, bus) {
  const t = state.tutor;
  if (!t || (state.scenario.outcome && t.closed)) return;
  t.waitMs = (t.waitMs ?? 0) + TICK_MS;
  next(state, bus, t);
}

const readMs = (text) => (READ_S + String(text).split(/\s+/).length * WORD_S) * 1000;
const lineOf = (b, state, mem) => { const s = typeof b.say === 'function' ? b.say(state, mem) : b.say; return Array.isArray(s) ? s[(mem.n = (mem.n ?? 0) + 1) % s.length] : s; };

/** Each tick: the next line when the last's been read; once a second, the steps and the beats. */
export function tutorTick(state, bus) {
  const t = state.tutor, L = t && lessonOf(t.lesson);
  if (!L || state.scenario.outcome && t.closed) return;
  const now = clockOf(state), poke = !!state.shoot?.doing && t.poked !== state.shoot.doing.start;   // (a gun's step chosen: a moment to look)
  if (poke) t.poked = state.shoot.doing.start;
  if (state.tick % TPS === 0 || poke) {
    const fails = (id, e) => { (t.errors ??= []).push(`${id}: ${e.message}`); if (t.errors.length > 20) t.errors.shift(); };   // (a script's slip: kept for the tests, never the game's end)
    try { L.tick?.(state, t.mem); } catch (e) { fails('tick', e); }
    for (const s of L.steps ?? []) {
      const mine = t.steps.find(x => x.id === s.id);
      let done = false;
      try { done = !!s.done(state, t.mem); } catch (e) { fails(`step ${s.id}`, e); }
      if (mine && !mine.done && done) {
        mine.done = true;
        if (s.said) {                                                // (ahead of the beats, behind the steps done before it and anything urgent)
          const last = t.queue.map(q => q.id.startsWith('step:')).lastIndexOf(true);
          let at = last + 1;
          if (last < 0) while (at < t.queue.length && t.queue[at].now) at++;
          t.queue.splice(at, 0, { id: `step:${s.id}`, text: typeof s.said === 'function' ? s.said(state, t.mem) : s.said, ms: now });
        }
      }
    }
    const greeted = !L.beats?.length || t.said[L.beats[0].id] !== undefined;   // (his first line, the greeting, before anything else)
    for (const b of greeted ? L.beats ?? [] : L.beats.slice(0, 1)) {
      const last = t.said[b.id];
      if ((last !== undefined && !(b.every && now - last >= b.every * 1000)) || t.queue.some(q => q.id === b.id)) continue;
      let ok = false;
      try { ok = !!b.when(state, t.mem); } catch (e) { fails(b.id, e); }
      if (!ok) continue;
      const text = lineOf(b, state, t.mem);
      t.said[b.id] = now;
      if (!text) continue;
      const q = { id: b.id, text, ms: now, ...(b.now ? { now: true } : {}) };
      if (b.now) t.queue.unshift(q); else t.queue.push(q);
    }
  }
  next(state, bus, t);
}

/** The next line, when the last's been read: the stale gone (the moment's passed), and a beat whose moment it no longer is (keep). */
function next(state, bus, t) {
  const now = clockOf(state), L = lessonOf(t.lesson);
  if (now < t.busyUntil || !t.queue.length) return;
  t.queue = t.queue.filter(q => q.id.startsWith('step:') || now - q.ms <= STALE_S * 1000);
  let q;
  while ((q = t.queue.shift())) {
    const b = L?.beats?.find(x => x.id === q.id);
    let keep = true;
    try { keep = !b?.keep || !!b.keep(state, t.mem); } catch (e) { keep = false; }
    if (keep) break;
  }
  if (q) radio(state, bus, q.text);
  if (state.scenario.outcome) t.closed = !t.queue.length;
}
