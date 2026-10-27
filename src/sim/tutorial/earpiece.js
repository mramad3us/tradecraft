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
//     (STALE_S) and isn't said.
//   - **Steps** ({ id, text, done(state, mem) → truthy, said }): the lesson's checklist, shown on screen
//     and ticked as each is done (it stays done), with his line for it.
//   - mem: the lesson's own memory (state.tutor.mem), for beats and steps that count (seconds kept at
//     the right distance, the first window). A lesson's tick(state, mem) keeps it, once a second.
// Plain data, so a lesson saves and loads like the rest.
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

/** Something said on the earpiece now (beats queue; this is for the scene's own moments). */
export function radio(state, bus, text) {
  const t = state.tutor;
  say(state, bus, { kind: 'radio', who: t?.who ?? 'Hale', text });
  if (t) t.busyUntil = state.time.ms + readMs(text);
}

const readMs = (text) => (READ_S + String(text).split(/\s+/).length * WORD_S) * 1000;
const lineOf = (b, state, mem) => { const s = typeof b.say === 'function' ? b.say(state, mem) : b.say; return Array.isArray(s) ? s[(mem.n = (mem.n ?? 0) + 1) % s.length] : s; };

/** Each tick: the next line when the last's been read; once a second, the steps and the beats. */
export function tutorTick(state, bus) {
  const t = state.tutor, L = t && lessonOf(t.lesson);
  if (!L || state.scenario.outcome && t.closed) return;
  const now = state.time.ms;
  if (state.tick % TPS === 0) {
    const fails = (id, e) => { (t.errors ??= []).push(`${id}: ${e.message}`); if (t.errors.length > 20) t.errors.shift(); };   // (a script's slip: kept for the tests, never the game's end)
    try { L.tick?.(state, t.mem); } catch (e) { fails('tick', e); }
    for (const s of L.steps ?? []) {
      const mine = t.steps.find(x => x.id === s.id);
      let done = false;
      try { done = !!s.done(state, t.mem); } catch (e) { fails(`step ${s.id}`, e); }
      if (mine && !mine.done && done) {
        mine.done = true;
        if (s.said) t.queue.unshift({ id: `step:${s.id}`, text: typeof s.said === 'function' ? s.said(state, t.mem) : s.said, ms: now });
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
      const q = { id: b.id, text, ms: now };
      if (b.now) t.queue.unshift(q); else t.queue.push(q);
    }
  }
  if (now < t.busyUntil || !t.queue.length) return;
  while (t.queue.length && now - t.queue[0].ms > STALE_S * 1000 && !t.queue[0].id.startsWith('step:')) t.queue.shift();   // (gone stale: the moment's passed)
  const q = t.queue.shift();
  if (q) radio(state, bus, q.text);
  if (state.scenario.outcome) t.closed = !t.queue.length;
}
