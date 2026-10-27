// TRADECRAFT sim: the dojo, a starter and the tutorial for close combat (the user, 2026-10-26: "a
// demo starter in a CIA dojo where young agents are taught how to fight, it will serve as a tutorial
// for CQC"). The rules of the fight are sim/cqc.js; the room is sim/map/dojo.js.
//
// The Farm (Camp Peary, Virginia), week six of the course: hand to hand. The player is a trainee
// (recruit()); the instructor, Hale, teaches it in STEPS, each some lines, a fight, and what
// completes it:
//   - drills, Hale calling each move before it comes (the fight's tell): cover a punch, grab someone
//     behind their cover, hit someone coming in to grab; the triangle mixed; then the edge
//     (advantage points), spent with Shift;
//   - bouts to three points, nobody calling anything: a weaker classmate first (the better you are,
//     the more you read what's coming), an even one, and last Hale, who reads everything.
// Between steps the player walks the hall as they like; T, when the instinct says so, goes on. The
// bouts' bruises stay on the sheet (C). The result paper says how it went.
import { at, TICK_MS, dateText } from '../clock.js';
import { recruit } from '../people.js';
import { say } from '../log.js';
import { pick, int } from '../rng.js';
import { follow } from '../crowd.js';
import { headOf } from '../perception.js';
import { dojo as hall, FIGHT, SPOTS } from '../map/dojo.js';
import { startFight, resolve, cqcOf, MOVES } from '../cqc.js';
import { exchangeText } from '../cqctext.js';
import { animate, length } from '../cqcshow.js';
import { stateText, stateOf, PARTS } from '../health.js';

const TPS = 1000 / TICK_MS;
export const HALE_PULL = 0.25;                                     // Hale's blows in a bout (a classmate's: cqc.js BOUT_K)


// The lesson, step by step. need(out, f): whether an exchange counts toward n; or a bout (to: points).
const STEPS = [
  { id: 'guard', with: 'hale', fight: { script: ['hit'], tell: true, pull: 0.2 }, n: 2, need: (o) => o.kind === 'blocked' && o.by === 'a',
    lines: ['“Three things you can do with your hands. Hit, grab, cover. Everything else is decoration.”', '“I\'m going to hit you. Cover up.”'],
    hint: 'Hale\'s going to hit. {guard} cover.', miss: ['“Cover means cover.”', '“That would have been your nose.”'],
    done: '“Good. A punch you cover is an opening you\'ve earned: that\'s an edge. Remember it.”' },
  { id: 'grapple', with: 'hale', fight: { script: ['guard'], tell: true, pull: 0.2 }, n: 2, need: (o) => o.by === 'a' && o.ours === 'grapple',
    lines: ['“Now I\'m covering. Someone behind their hands can still be put on the floor. Grab me.”'],
    hint: 'Hale\'s covering. {grapple} grab.', miss: ['“Punching my forearms. Very satisfying for my forearms.”', '“Grab. Hands on cloth, hip in, and down I go.”'],
    done: '“And down I go. Cover beats a hit; a grab beats cover.”' },
  { id: 'hit', with: 'hale', fight: { script: ['grapple'], tell: true, pull: 0.2 }, n: 2, need: (o) => o.by === 'a' && o.ours === 'hit',
    lines: ['“Now I\'m coming in to grab you. Hit me before I get hold.”'],
    hint: 'Hale\'s coming in to grab. {hit} hit.', miss: ['“I\'ve got hold of you. Now what?”', '“Hit me first. Someone reaching has no hands to cover with.”'],
    done: '“A hit beats a grab: hands reaching aren\'t covering. Cover, grab, hit: that\'s the triangle. All of it.”' },
  { id: 'mix', with: 'hale', fight: { script: ['hit', 'grapple', 'guard', 'guard', 'hit', 'grapple', 'hit'], tell: true, pull: 0.2 }, n: 4, need: (o) => o.by === 'a' && o.kind !== 'circle',
    lines: ['“I\'ll mix them up, and I\'ll call each one. Answer it.”'],
    hint: 'Hale calls it: answer it. {guard} covers a hit, {grapple} grabs a cover, {hit} hits a grab.', miss: ['“Again.”', '“The triangle. Think, then move.”'],
    done: '“Good. Out there nobody calls it for you.”' },
  { id: 'edge', with: 'hale', fight: { script: ['hit', 'grapple', 'hit', 'grapple'], tell: true, pull: 0.2, adv: 1 }, n: 1, need: (o) => o.spent.a,
    lines: ['“The edges you earn covering: spend them. Hold {run} with a key. With a hit, it lands double. With a grab, you shrug off the punch you walk into. With a cover, you stop a throw.”', '“You\'ve one now. Use it right.”'],
    hint: 'Spend your edge: hold {run} with the key. On my grab, a {guard} cover with it stops the throw; on my hit, a {grapple} grab with it shrugs it off.', miss: ['“Hold {run} with it, and pick the move it helps.”'],
    done: '“That\'s an edge, spent. One for every ten points of CQC you have, at most, held at once.”' },
  { id: 'read', with: 'weak', bout: 3,
    lines: ['“Nobody will call it for you again. Watch them instead: weight, shoulders, eyes. The better you are than them, the more you\'ll see it coming.”', '“Over their head: what you read. A question mark when you can\'t.”', '“{name}. Three points.”'],
    hint: 'A bout to three points. Read {name} if you can: the mark over their head.' },
  { id: 'even', with: 'even', bout: 3,
    lines: ['“{name}, you\'re up. As good as you are, near enough: you won\'t read much.”'],
    hint: 'A bout to three points, against someone your equal.' },
  { id: 'hale', with: 'hale', bout: 3,
    lines: ['“Last one. Me.”', '“Nobody in this class beats me, so don\'t try to. Learn something.”'],
    hint: 'A bout with Hale. Hale reads you; you won\'t read Hale.' },
];

export const dojoScenario = {
  name: 'The Farm: hand to hand',
  about: 'Camp Peary, Virginia: the agency\'s school. An instructor, a class, a mat. A tutorial for close combat.',
  brief(state) {
    const me = state.people[state.player];
    return {
      title: 'THE FARM: DEFENSIVE TACTICS',
      body: [
        `${me.name}, a career trainee, week six of the course. This morning: hand to hand, with Hale.`,
        'A fight is a second at a time, and the world waits while you choose. Three moves: hit, grab, cover. Cover beats a hit, a hit beats a grab, a grab beats cover. The same move both ways is a roll of CQC against CQC.',
        'A punch you cover earns you an edge; hold Shift with a move to spend one. The better fighter reads what the other is about to do.',
        'Hale will walk you through it, then you\'ll spar. Bruises are real, and they\'re on your sheet.',
      ],
      footer: `Camp Peary, Virginia · ${dateLine(state)}`,
      keys: [['hit', 'hit'], ['grapple', 'grab'], ['guard', 'cover'], ['run', 'held with a move: spend an edge'], ['instinct', 'go on, when Hale says'], ['sheet', 'your sheet: CQC, and the bruises']],
    };
  },

  setup(state) {
    const r = state.rng;
    state.time.ms = at(2026, 9, 14, 10, 20);
    state.legend = { id: 'farm', name: 'Career trainee, the Farm', cover: 'none', floor: 0 };
    state.country = 'us';
    const me = recruit(r, { id: 'me', cqc: [5, 2], os: 15 });
    state.people.me = me;
    state.player = 'me';
    state.map = { kind: 'dojo', seed: int(r, 1e9), row: 0, i0: 0, i1: 0, crowd: 0 };
    // Hale, and the class: one weaker (in from the analysts, a few weeks of it), one even, the rest.
    state.people.hale = recruit(r, { id: 'hale', cqc: [20, 3], os: 60, age: 46, instructor: true });
    state.people.hale.name = `${state.people.hale.name.split(' ')[0]} Hale`;
    const names = new Set([me.name.split(' ')[1], state.people.hale.name.split(' ')[1]]);
    const cls = [{ cqc: [0, 2], os: 10 }, { cqc: [5, 2], os: 15 }, { cqc: [5, 1], os: 12 }, { cqc: [5, 0], os: 14 }, { cqc: [5, 3], os: 16 }].map((o, i) => {
      let p;
      do p = recruit(r, { id: `c${i}`, ...o }); while (names.has(p.name.split(' ')[1]));
      names.add(p.name.split(' ')[1]);
      state.people[p.id] = p;
      return p.id;
    });
    const person = (who, x, z, face) => state.actors.push({ id: `a${state.nextActor++}`, who, seed: null, x, z, vx: 0, vz: 0, face, head: headOf(face), gait: 'idle', stride: 0, stuck: 0,
      ai: who === 'me' ? null : { kind: 'dojo', speed: 1.3, steps: [], wait: 0 } });
    person('me', FIGHT.x - 4, FIGHT.z + 1.5, 'up');
    person('hale', SPOTS.instructor.x, SPOTS.instructor.z, 'down');
    cls.forEach((who, i) => person(who, SPOTS.class[i].x, SPOTS.class[i].z, 'down'));
    state.scenario = { kind: 'dojo', step: -1, phase: 'ready', count: 0, misses: 0, bouts: [], weak: cls[0], even: cls[1], prompt: null, outcome: null, began: state.time.ms, show: 0 };
    say(state, null, { kind: 'note', text: `${me.name}, week six at the Farm. The hall smells of floor polish and other people's effort. Hale is waiting on the mat.` });
  },

  attach(state) {},

  /** A lit hall, small enough to take in whole: the view shows all of it (src/render/view.js). */
  aware: true,

  /** On the mat, and walking onto it, the player's feet are the lesson's. */
  holds(state) { return state.scenario.phase === 'walk' || state.scenario.phase === 'fight'; },

  /** Where we are, for the watch. */
  place() { return 'The Farm, Virginia'; },

  act(state, bus, action) {
    const sc = state.scenario, f = state.fight, me = playerOf(state);
    if (sc.outcome || !me) return;
    const move = String(action).replace('+', '');
    if (MOVES.includes(move)) {
      if (!f || f.phase !== 'choose' || f.status?.a === 'stunned') return;
      exchange(state, bus, { move, spend: action.endsWith('+') });
      return;
    }
    if (action !== 'instinct') return;
    if (sc.phase === 'ready') return next(state, bus);
    say(state, bus, { kind: 'instinct', text: f ? 'In the middle of it. Choose: {hit}, {grapple} or {guard}.' : 'Wait for Hale.' });
  },

  think(state, a) { follow(state, a); },

  tick(state, bus) {
    const sc = state.scenario, f = state.fight;
    if (sc.outcome) return;
    // Into place for a fight: both on their marks, and it starts.
    if (sc.phase === 'walk') {
      const me = playerOf(state), them = actorOfWho(state, sc.with);
      if (!me.busy && !them.ai.steps.length) begin(state, bus);
    }
    // An exchange played out: the next choice (dazed, there's none: it comes at you), or the end.
    if (f && f.phase === 'show' && state.tick >= sc.show) {
      if (f.ended) return finishBout(state, bus);
      f.phase = 'choose';
      if (f.status.a === 'stunned') exchange(state, bus, { move: 'open' });
    }
    poses(state);
    sc.prompt = instinct(state);                                    // (every tick: a fight's choice comes with time stopped)
  },

  result(state) {
    const sc = state.scenario, me = state.people[state.player];
    const won = sc.bouts.filter(b => b.won).length;
    const hurts = Object.keys(PARTS).filter(k => stateOf(me, k) !== 'unhurt').map(k => `${PARTS[k].name.toLowerCase()} ${stateText(me, k)}`);
    return {
      stamp: won === 3 ? 'TOP OF THE CLASS' : won ? 'PASSED' : 'PASSED, JUST', good: won >= 1,
      title: 'THE FARM: DEFENSIVE TACTICS', text: sc.endText,
      notes: [
        `Bouts: ${sc.bouts.map(b => `${b.name}, ${b.won ? 'won' : 'lost'} ${b.score.a}–${b.score.b}${b.why === 'stopped' ? ' (stopped)' : ''}`).join('; ')}.`,
        hurts.length ? `You leave with: ${hurts.join(', ')}. It's on your sheet (C), and it mends in days.` : 'You leave without a mark on you.',
      ],
      stats: `${Math.round((state.time.ms - sc.began) / 60000)} min on the mat · CQC ${cqcOf(state, state.player)}`,
    };
  },
};

// ---------- the steps ----------

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const actorOfWho = (state, who) => state.actors.find(a => a.who === who);
const whoOf = (sc, step) => (step.with === 'weak' ? sc.weak : step.with === 'even' ? sc.even : 'hale');
const short = (state, who) => (who === 'hale' ? 'Hale' : state.people[who].name.split(' ')[1]);
const fill = (state, who, text) => text.replace(/\{name\}/g, short(state, who));
const dateLine = (state) => dateText(state.time.ms);

/** The next step: whoever it's with walks onto the mat; the last one gone, it's over. */
function next(state, bus) {
  const sc = state.scenario;
  sc.step++;
  const step = STEPS[sc.step];
  if (!step) return over(state, bus);
  // (hurt that badly, nobody spars again today)
  if (step.bout && ['head', 'torso'].some(k => ['wounded', 'out'].includes(stateOf(state.people[state.player], k)))) {
    say(state, bus, { kind: 'note', text: 'Hale: “You\'re done for today. Sit down, and get some ice on that.”' });
    return over(state, bus);
  }
  const who = whoOf(sc, step), me = playerOf(state);
  // The one before back to their place; this one to the mark facing us; us to ours.
  for (const a of state.actors) {
    if (!a.ai || a.who === who) continue;
    const home = a.who === 'hale' ? SPOTS.instructor : SPOTS.class[Number(a.who.slice(1))];
    if (Math.hypot(a.x - home.x, a.z - home.z) > 0.3) a.ai.steps = [['go', home.x, home.z], ['wait', 1, 'down', 'idle']];
  }
  actorOfWho(state, who).ai.steps = [['go', FIGHT.x + FIGHT.gap / 2, FIGHT.z], ['wait', 1, 'left', 'idle']];
  me.busy = { what: 'mat', steps: [['go', FIGHT.x - FIGHT.gap / 2, FIGHT.z], ['wait', 1, 'right', 'idle']], wait: 0, since: state.time.ms };
  Object.assign(sc, { phase: 'walk', with: who, count: 0, misses: 0 });
  for (const line of step.lines) say(state, bus, { kind: 'note', text: `Hale: ${fill(state, who, line)}` });
}

/** On the marks: the fight starts. */
function begin(state, bus) {
  const sc = state.scenario, step = STEPS[sc.step];
  const opts = step.bout ? { bout: true, to: step.bout, stop: true, pull: step.with === 'hale' ? HALE_PULL : undefined, style: step.with === 'hale' ? 'even' : pick(state.rng, ['striker', 'wrestler', 'careful', 'even']) } : { ...step.fight };
  const f = startFight(state, state.player, sc.with, opts);
  if (step.fight?.adv) f.adv.a = step.fight.adv;
  f.marks = { a: { x: FIGHT.x - FIGHT.gap / 2, z: FIGHT.z }, b: { x: FIGHT.x + FIGHT.gap / 2, z: FIGHT.z } };
  f.phase = 'choose';
  sc.phase = 'fight';
}

/** An exchange: resolved, told, counted. */
function exchange(state, bus, ours) {
  const sc = state.scenario, f = state.fight, step = STEPS[sc.step], who = sc.with;
  const out = resolve(state, f, ours);
  say(state, bus, { kind: out.roll ? 'roll' : 'note', roll: out.roll ?? undefined, text: exchangeText(out, short(state, who), state.people[who], state.map.seed) });
  f.phase = 'show';
  f.shown = state.tick;
  sc.show = state.tick + length(state, f, out);
  if (step.bout) return;
  if (step.need(out, f)) {
    if (++sc.count >= step.n) { f.ended = { by: 'a', why: 'drill' }; return; }
  } else if (out.by !== 'a' || out.kind === 'circle') {
    sc.misses++;
    say(state, bus, { kind: 'note', text: `Hale: ${step.miss[(sc.misses - 1) % step.miss.length]}` });
  }
}

/** A fight over: a drill done, or a bout won or lost. */
function finishBout(state, bus) {
  const sc = state.scenario, f = state.fight, step = STEPS[sc.step], who = sc.with;
  state.fight = null;
  sc.phase = 'ready';
  for (const a of [playerOf(state), actorOfWho(state, who)]) if (a) a.gait = 'idle';
  if (step.bout) {
    const won = f.ended.by === 'a';
    sc.bouts.push({ id: step.id, name: short(state, who), won, score: { ...f.score }, why: f.ended.why });
    const line = f.ended.why === 'stopped' ? (won ? `“Stop. That's enough, ${short(state, who)}'s hurt.”` : '“Stop. You\'re hurt: that\'s the bout.”') : won ? '“That\'s the bout. Good.”' : '“That\'s the bout.”';
    say(state, bus, { kind: 'note', text: `Hale: ${line} ${won ? 'You' : short(state, who)} ${f.score.a}–${f.score.b}${won ? '' : ' you'}.` });
  } else say(state, bus, { kind: 'note', text: `Hale: ${step.done}` });
}

function over(state, bus) {
  const sc = state.scenario, won = sc.bouts.filter(b => b.won).length;
  sc.outcome = won === 3 ? 'top' : won ? 'passed' : 'just';
  sc.phase = 'done';
  sc.endText = won === 3 ? 'Hale looks at you for a long moment. “Again tomorrow. Earlier.” From Hale, that\'s a medal.'
    : won ? '“Ice what needs icing. Tomorrow, knives.” The class files out to the showers.'
      : '“Everyone loses here. The ones who learn something lose less on the street.” The class files out to the showers.';
  bus?.emit('scenario-end', sc.outcome);
}

// ---------- the picture: the exchange played out (sim/cqcshow.js) ----------

function poses(state) {
  const f = state.fight;
  if (f) animate(state, f, { a: playerOf(state), b: actorOfWho(state, f.b) });
}

// ---------- the instinct: what to do now ----------

function instinct(state) {
  const sc = state.scenario, f = state.fight, step = STEPS[sc.step];
  const L = (id, tone, text, act = null) => ({ id, tone, text, act });
  if (sc.phase === 'ready') return sc.step < 0 ? L('start', 'note', 'Hale is waiting. {instinct} step onto the mat.', 'next') : L('next', 'note', STEPS[sc.step + 1] ? 'Catch your breath. {instinct} when you\'re ready for the next.' : 'That\'s the lesson. {instinct} to finish.', 'next');
  if (sc.phase === 'walk') return L('walk', 'calm', 'Onto the mat.');
  if (!f) return L('wait', 'calm', 'Wait for Hale.');
  if (f.status?.a === 'stunned') return L('dazed', 'urgent', 'You\'re dazed. Your hands won\'t come up, and whatever comes, you can\'t stop it.');
  return L(`choose-${f.round}`, step.bout ? 'warn' : 'note', `${fill(state, sc.with, step.hint)}`);
}
