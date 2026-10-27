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
//     the more you read what's coming), an even one, a better one, and last Hale, who reads everything.
// Between steps the player walks the hall as they like; T, when the instinct says so, goes on. The
// bouts' bruises stay on the sheet (C). The result paper says how it went.
//
// **Remembered** (chapter 'remembered'; the user, 2026-10-26: "once we did it once, remember it so next
// time … snap flash forward to the last part about fighting the three trainees and Hale, then change of
// scenery"): with the lesson done once (the title remembers it), the Farm comes back as a memory:
// straight to the bouts, and when Hale's ends you hit the floor, and it isn't the mat (present()).
// Moscow, years on, three in the morning: you get up off the cobbles, somebody having hit you hard
// enough to send you back to the Farm. The same character, an illegal now (ILLEGAL: the trade, and
// Hale's own combat training: CQC as Hale's was then), against an FSB officer (FSB_CQC: strong, but not
// as good). A fight for real: it ends with one of you down.
//
// **A foul** (the user: "doing so during a friendly bout is considered a breach of ethics"): a fight
// ender in a bout (sim/cqc.js finish()) stops it, and the bout is lost, whatever it did; Hale sees to
// that. A classmate killed by one ends the lesson ('dismissed').
import { at, TICK_MS, dateText } from '../clock.js';
import { recruit } from '../people.js';
import { say, speak } from '../log.js';
import { pick, int, stream } from '../rng.js';
import { HEARSAY, haleStream } from '../hale.js';
import { follow } from '../crowd.js';
import { headOf } from '../perception.js';
import { dojo as hall, FIGHT, SPOTS } from '../map/dojo.js';
import { newMap } from '../game.js';
import { cqcOf } from '../cqc.js';
import { begin as beginFight } from '../fight.js';
import { stateText, stateOf, takes, PARTS } from '../health.js';

const TPS = 1000 / TICK_MS;
export const HALE_PULL = 0.25;                                     // Hale's blows in a bout (a classmate's: cqc.js BOUT_K)


// The lesson, step by step. need(out, f): whether an exchange counts toward n; or a bout (to: points).
const STEPS = [
  { id: 'guard', with: 'hale', fight: { script: ['hit'], tell: true, pull: 0.2 }, n: 2, need: (o) => (o.kind === 'blocked' || o.kind === 'riposte') && o.by === 'a',
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
    lines: ['“The edges you earn covering: spend them. Hold {run} with a key. With a hit, it lands double. With a grab, you shrug off the punch you walk into. With a cover, you stop a throw; and against a punch, you hit back through it and keep the edge: a riposte.”', '“You\'ve one now. Use it right.”'],
    hint: 'Spend your edge: hold {run} with the key. On my grab, a {guard} cover with it stops the throw; on my hit, a {grapple} grab with it shrugs it off.', miss: ['“Hold {run} with it, and pick the move it helps.”'],
    done: '“That\'s an edge, spent. One for every ten points of CQC you have, at most, held at once.”' },
  { id: 'read', with: 'weak', bout: 3,
    lines: ['“Nobody will call it for you again. Watch them instead: weight, shoulders, eyes. The better you are than them, the more you\'ll see it coming.”', '“Over their head: what you read. A question mark when you can\'t.”', '“{name}. Three points.”'],
    hint: 'A bout to three points. Read {name} if you can: the mark over their head.' },
  { id: 'even', with: 'even', bout: 3,
    lines: ['“{name}, you\'re up. As good as you are, near enough: you won\'t read much.”'],
    hint: 'A bout to three points, against someone your equal.' },
  { id: 'strong', with: 'strong', bout: 3,
    lines: ['“{name}. A little better than you, and knows it. Show me something.”'],
    hint: 'A bout to three points, against someone a little better.' },
  { id: 'hale', with: 'hale', bout: 3,
    lines: ['“Last one. Me.”', '“Nobody in this class beats me, so don\'t try to. Learn something.”'],
    hint: 'A bout with Hale. Hale reads you; you won\'t read Hale.' },
];

const BOUTS = STEPS.filter(s => s.bout).length;
/** Years on: an illegal's sheet (Hale's CQC is copied in: as good as Hale was then), and the FSB man's CQC (recruit()'s [base, practice]). */
export const ILLEGAL = { deception: [15, 3], tracking: [15, 2], pathfinding: [15, 3], awareness: [15, 3], social: [15, 2], analysis: [10, 3], tech: [10, 1], medicine: [10, 2], weapons: [15, 2], fitness: [15, 2] };
export const FSB_CQC = [17, 2];
export const FSB_OS = 50;
export const CUT_S = 2;                                             // from Hale's last word to the cobbles
export const RISE_S = 3;                                            // getting up off them

export const dojoScenario = {
  name: 'The Farm: hand to hand',
  again: { another: ['Again, another lesson', 'Another day on the mat: new classmates, new dice.'], same: ['Again, the same lesson', 'The same class; the dice fall as you fight.'] },
  about: 'Camp Peary, Virginia: the agency\'s school. An instructor, a class, a mat. A tutorial for close combat.',
  brief(state) {
    const me = state.people[state.player];
    if (state.scenario.chapter === 'remembered') return {
      title: 'THE FARM, REMEMBERED',
      body: [
        `The Farm, years ago. Week six. ${me.name}, a career trainee, and Hale's mat.`,
        'The drills are long gone. What you remember is the bouts: three of your class, and then Hale.',
        'You remember it for a reason.',
      ],
      footer: 'Camp Peary, Virginia · years ago',
      keys: [['hit', 'hit'], ['grapple', 'grab'], ['guard', 'cover'], ['run', 'held with a move: an edge (with a cover: hit back)'], ['instinct', 'go on, when Hale says'], ['sheet', 'your sheet']],
    };
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

  setup(state, { chapter = null } = {}) {
    const r = state.rng;
    state.time.ms = at(2007, 9, 14, 10, 20);                       // (the Farm is the past: Moscow's nineteen years on)
    state.legend = { id: 'farm', name: 'Career trainee, the Farm', cover: 'none', floor: 0 };
    state.country = 'us';
    const me = recruit(r, { id: 'me', cqc: [5, 2], os: 15 });
    state.people.me = me;
    state.player = 'me';
    state.map = { kind: 'dojo', seed: int(r, 1e9), row: 0, i0: 0, i1: 0, crowd: 0 };
    // Hale, and the class: one weaker (in from the analysts, a few weeks of it), one even, the rest.
    // (Hale is one man, here and on the earpiece: his own dice, sim/hale.js)
    state.people.hale = recruit(haleStream(), { id: 'hale', cqc: [20, 3], os: 60, age: 46, instructor: true, sex: 'm' });
    state.people.hale.name = `${state.people.hale.name.split(' ')[0]} Hale`;
    const names = new Set([me.name.split(' ')[1], state.people.hale.name.split(' ')[1]]);
    const cls = [{ cqc: [0, 2], os: 10 }, { cqc: [5, 2], os: 15 }, { cqc: [5, 1], os: 12 }, { cqc: [5, 0], os: 14 }, { cqc: [8, 2], os: 18 }].map((o, i) => {
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
    const remembered = chapter === 'remembered';
    state.scenario = { kind: 'dojo', chapter: remembered ? 'remembered' : 'lesson', step: remembered ? STEPS.findIndex(s => s.bout) - 1 : -1, phase: 'ready', count: 0, misses: 0, bouts: [],
      weak: cls[0], even: cls[1], strong: cls[4], prompt: null, outcome: null, began: state.time.ms, show: 0 };
    say(state, null, { kind: 'note', text: remembered ? 'The Farm, years ago: floor polish, other people\'s effort, and Hale waiting on the mat. You remember the bouts best.' : `${me.name}, week six at the Farm. The hall smells of floor polish and other people's effort. Hale is waiting on the mat.` });
  },

  attach(state) {},

  /** A lit hall, small enough to take in whole: the view shows all of it (src/render/view.js). A street at night isn't. */
  aware(state) { return state.map.kind === 'dojo'; },

  /** On the mat and walking onto it, on the cobbles and getting up off them: the player's feet are the scene's. */
  holds(state) { return ['walk', 'fight', 'cut', 'rise', 'present'].includes(state.scenario.phase); },

  /** Where we are, for the watch (on the street, the street's own name). */
  place() { return 'The Farm, Virginia'; },

  act(state, bus, action) {
    const sc = state.scenario, f = state.fight, me = playerOf(state);
    if (sc.outcome || !me) return;
    if (action !== 'instinct') return;                            // (a fight's moves are the engine's: sim/fight.js)
    if (sc.phase === 'ready') return next(state, bus);
    say(state, bus, { kind: 'instinct', text: f ? 'In the middle of it. Choose: {hit}, {grapple} or {guard}.' : sc.with === 'fsb' ? 'Get up.' : 'Wait for Hale.' });
  },

  think(state, a) { follow(state, a); },

  tick(state, bus) {
    const sc = state.scenario;
    if (sc.outcome) return;
    if (sc.gossipAt && state.tick >= sc.gossipAt) { sc.gossipAt = null; if (sc.phase === 'ready' || sc.phase === 'walk') gossip(state, bus); }
    // Into place for a fight: both on their marks, and it starts.
    if (sc.phase === 'walk') {
      const me = playerOf(state), them = actorOfWho(state, sc.with);
      if (!me.busy && !them.ai.steps.length) begin(state, bus);
    }
    // Hale's last word, and the cut; on the cobbles, getting up: on your back, a knee, up; and he comes on.
    if (sc.phase === 'cut' && state.tick >= sc.cutAt) present(state, bus);
    if (sc.phase === 'rise') {
      const me = playerOf(state), k = (state.tick - sc.rose) / TPS;
      me.gait = k < RISE_S * 0.5 ? 'down' : k < RISE_S * 0.8 ? 'crouch' : 'guard';
      if (k >= RISE_S) beginPresent(state, bus);
    }
    sc.prompt = instinct(state);                                    // (every tick: a fight's choice comes with time stopped)
  },

  /** Each exchange of a drill: counted toward the step, or a word from Hale. */
  onExchange(state, bus, out) {
    const sc = state.scenario, f = state.fight, step = STEPS[sc.step];
    if (!step || step.bout) return;                                 // (a bout, or years on: nobody's counting)
    if (step.need(out, f)) {
      if (++sc.count >= step.n) f.ended = { by: 'a', why: 'drill' };
    } else if (out.by !== 'a' || out.kind === 'circle') {
      sc.misses++;
      hale(state, bus, `Hale: ${step.miss[(sc.misses - 1) % step.miss.length]}`);
    }
  },

  /** A drill done, or a bout won or lost; or, years on, the fight that sent you back there. */
  onFightEnd(state, bus, f) { if (state.scenario.with === 'fsb') presentOver(state, bus, f); else finishBout(state, bus, f); },

  result(state) {
    const sc = state.scenario, me = state.people[state.player];
    const won = sc.bouts.filter(b => b.won).length;
    const hurts = Object.keys(PARTS).filter(k => stateOf(me, k) !== 'unhurt').map(k => `${PARTS[k].name.toLowerCase()} ${stateText(me, k)}`);
    if (sc.outcome === 'dismissed') return {
      stamp: 'DISMISSED', good: false, title: 'THE FARM: DEFENSIVE TACTICS', text: sc.endText,
      notes: [`Bouts: ${sc.bouts.map(b => `${b.name}, ${b.why === 'fouled' ? 'a foul' : result(b)}`).join('; ')}.`],
      stats: `CQC ${cqcOf(state, state.player)}`,
    };
    if (sc.chapter === 'remembered') return {
      stamp: sc.outcome === 'won' ? 'WALKED AWAY' : 'TAKEN', good: sc.outcome === 'won',
      title: 'THE FARM, REMEMBERED', text: sc.endText,
      notes: [
        `At the Farm, years ago: ${sc.bouts.map(b => `${b.name}, ${result(b)}`).join('; ')}.`,
        hurts.length ? `Tonight it cost you: ${hurts.join(', ')}.` : 'Tonight, not a mark on you.',
      ],
      stats: `CQC ${cqcOf(state, state.player)} now; the FSB man's ${cqcOf(state, 'fsb')}; Hale's, then, ${cqcOf(state, 'hale')}`,
    };
    return {
      stamp: won === BOUTS ? 'TOP OF THE CLASS' : won ? 'PASSED' : 'PASSED, JUST', good: won >= 1,
      title: 'THE FARM: DEFENSIVE TACTICS', text: sc.endText,
      notes: [
        `Bouts: ${sc.bouts.map(b => `${b.name}, ${b.why === 'fouled' ? 'lost on a foul' : `${result(b)}${b.why === 'stopped' ? ' (stopped)' : ''}`}`).join('; ')}.`,
        ...(sc.fouls ? ['A foul on your record: Hale will remember it, and so will your file.'] : []),
        hurts.length ? `You leave with: ${hurts.join(', ')}. It's on your sheet (C), and it mends in days.` : 'You leave without a mark on you.',
      ],
      stats: `${Math.round((state.time.ms - sc.began) / 60000)} min on the mat · CQC ${cqcOf(state, state.player)}`,
    };
  },
};

// ---------- the steps ----------

const playerOf = (state) => state.actors.find(a => a.who === state.player);
const actorOfWho = (state, who) => state.actors.find(a => a.who === who);
const whoOf = (sc, step) => (step.with === 'hale' ? 'hale' : sc[step.with]);
const short = (state, who) => (who === 'hale' ? 'Hale' : state.people[who].name.split(' ')[1]);
const fill = (state, who, text) => text.replace(/\{name\}/g, short(state, who));
const dateLine = (state) => dateText(state.time.ms);
/** A bout's result, the winner's score first: 'won 3–1', 'lost 3–2'. */
const result = (b) => (b.won ? `won ${b.score.a}–${b.score.b}` : `lost ${b.score.b}–${b.score.a}`);

/** The next step: whoever it's with walks onto the mat; the last one gone, it's over. */
function next(state, bus) {
  const sc = state.scenario;
  sc.step++;
  const step = STEPS[sc.step];
  if (!step) return sc.chapter === 'remembered' ? present(state, bus) : over(state, bus);
  // (Hale is padded and pulls his drills: each step he's fresh. Out cold or broken, nobody spars again today, but
  // in the memory Hale sends you back in; hurt, the worst of it is shaken off: a bout stops only for a wound taken in it)
  const me0 = state.people[state.player], halesBody = state.people.hale;
  if (halesBody && !halesBody.dead) for (const k in halesBody.body) halesBody.body[k] = 0;
  if (step.bout && ['head', 'torso'].some(k => ['wounded', 'out'].includes(stateOf(me0, k)))) {
    if (sc.chapter !== 'remembered' && ['head', 'torso'].some(k => stateOf(me0, k) === 'out')) {
      hale(state, bus, 'Hale: “You\'re done for today. Sit down, and get some ice on that.”');
      return over(state, bus);
    }
    for (const k in me0.body) me0.body[k] = Math.min(me0.body[k], Math.floor(takes(me0, k) * 0.3 * 10) / 10);
    hale(state, bus, sc.chapter === 'remembered' ? 'Hale: “Shake it off. Out there nobody lets you sit down.”' : 'Hale: “Breathe. Some ice at the break. You can go on: you\'ll know when you can\'t.”');
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
  for (const line of step.lines) hale(state, bus, `Hale: ${fill(state, who, line)}`);
}

/** A classmate on the bench, low, about Hale: the canteen's hearsay (sim/hale.js), a different piece each time. */
const GOSSIP_S = 5;
function gossip(state, bus) {
  const sc = state.scenario, n = sc.gossip = (sc.gossip ?? 0) + 1;
  const g = stream('gossip', state.seed ?? 0), first = int(g, HEARSAY.length);
  const bench = state.actors.filter(a => /^c\d$/.test(a.who) && a.who !== sc.with && !state.people[a.who]?.dead && a.gait === 'idle');
  const a = bench.length ? bench[int(stream('gossip', state.seed ?? 0, n), bench.length)] : null;
  if (a) speak(state, bus, a.id, `${short(state, a.who)}, low, from the bench: “${HEARSAY[(first + n * 3) % HEARSAY.length]}”`, 'Bench talk.');
}

/** Hale says it aloud: the log's line, and a balloon over him (sim/log.js speak()). */
const hale = (state, bus, text, aside = null) => speak(state, bus, actorOfWho(state, 'hale')?.id, text, aside);

/** On the marks: the fight starts. */
function begin(state, bus) {
  const sc = state.scenario, step = STEPS[sc.step];
  const opts = step.bout ? { bout: true, to: step.bout, stop: true, pull: step.with === 'hale' ? HALE_PULL : undefined, style: step.with === 'hale' ? 'even' : pick(state.rng, ['striker', 'wrestler', 'careful', 'even']) } : { ...step.fight };
  beginFight(state, bus, actorOfWho(state, sc.with), { ...opts, adv: step.fight?.adv, owner: 'dojo',
    marks: { a: { x: FIGHT.x - FIGHT.gap / 2, z: FIGHT.z }, b: { x: FIGHT.x + FIGHT.gap / 2, z: FIGHT.z } } });
  sc.phase = 'fight';
}

/** A fight over (f, the engine's: sim/fight.js): a drill done, or a bout won or lost. */
function finishBout(state, bus, f) {
  const sc = state.scenario, step = STEPS[sc.step], who = sc.with;
  sc.phase = 'ready';
  for (const a of [playerOf(state), actorOfWho(state, who)]) if (a) a.gait = 'idle';
  // A foul: Hale stops it, the bout is lost; someone dead, and the lesson's over.
  if (step.bout && (f.ended.why === 'fouled' || f.ended.why === 'dead')) {
    sc.bouts.push({ id: step.id, name: short(state, who), won: false, score: { ...f.score }, why: 'fouled' });
    sc.fouls = (sc.fouls ?? 0) + 1;
    if (state.people[who]?.dead) {
      say(state, bus, { kind: 'note', text: `Hale is on the mat before anyone else, two fingers on ${short(state, who)}'s neck, for a long time. Nobody says anything. Nobody looks at you.` });
      return dismissed(state, bus, who);
    }
    hale(state, bus, `Hale: “STOP. Off my mat.” A long look. “Someone who can't defend themselves, you let go. Here, and anywhere I'd want you. That bout's lost, and so is my good opinion.”`, 'A long look from Hale.');
    return;
  }
  if (step.bout) {
    const won = f.ended.by === 'a';
    sc.bouts.push({ id: step.id, name: short(state, who), won, score: { ...f.score }, why: f.ended.why });
    const line = f.ended.why === 'stopped' ? (won ? `“Stop. That's enough, ${short(state, who)}'s hurt.”` : '“Stop. You\'re hurt: that\'s the bout.”') : won ? '“That\'s the bout. Good.”' : '“That\'s the bout.”';
    const score = `${won ? `You win it, ${f.score.a}–${f.score.b}` : `${short(state, who)} takes it, ${f.score.b}–${f.score.a}`}.`;   // (the winner's score first)
    hale(state, bus, `Hale: ${line} ${score}`, score);
    if (sc.bouts.length === 1 || sc.bouts.length === 3) sc.gossipAt = state.tick + GOSSIP_S * TPS;   // (and on the bench, while he's not listening)
    if (sc.chapter === 'remembered' && step.id === 'hale') Object.assign(sc, { phase: 'cut', cutAt: state.tick + CUT_S * TPS });   // (and then the floor)
  } else hale(state, bus, `Hale: ${step.done}`);
}

// ---------- years on: the fight that sent you back there ----------

/** The cut: you hit the floor, and it isn't the mat. Moscow, years on, three in the morning; on the cobbles. */
function present(state, bus) {
  const sc = state.scenario, r = state.rng, me = state.people[state.player], hale = state.people.hale;
  say(state, bus, { kind: 'note', text: 'The mat comes up to meet you, hard. Only it isn\'t a mat.' });
  bus?.emit('cut');
  // An illegal now: the same face, years on; the trade, and Hale's own training: CQC as Hale's was then.
  Object.assign(me, { cls: 'spook', os: hale.os, skills: { ...structuredClone(ILLEGAL), cqc: [...hale.skills.cqc] }, body: { head: 3 }, injuries: [], bloody: undefined });
  me.age = (me.age ?? 26) + 19;
  me.langs = { ...me.langs, ru: 'native' };                           // (an illegal speaks the country's language as a native: no accent, nothing)
  me.look = { ...me.look, top: { kind: 'coat', color: 0x23252f, trim: 0x14151c }, legs: 0x23252f, shoes: 0x14151c };
  state.legend = { id: 'illegal', name: 'Illegal, Moscow', cover: 'non-official', floor: 30 };
  state.country = 'ru';
  state.time.ms = at(2026, 11, 5, 2, 55);
  const fsb = state.people.fsb = recruit(r, { id: 'fsb', cqc: FSB_CQC, os: FSB_OS, age: 38, sex: 'm' });
  Object.assign(fsb, { name: 'the FSB man', known: false, seen: 'the FSB man' });
  fsb.look = { ...fsb.look, top: { kind: 'coat', color: 0x47302a, trim: 0x2a1c18 }, legs: 0x23252f, shoes: 0x14151c };
  const pc = playerOf(state), x = 4, them = { id: `a${state.nextActor++}`, who: 'fsb', seed: null, x: x + FIGHT.gap, z: -2.7, vx: 0, vz: 0, face: 'left', head: Math.PI, gait: 'guard', stride: 0, stuck: 0,
    ai: { kind: 'dojo', speed: 1.4, steps: [], wait: 0, fighting: true } };
  Object.assign(pc, { x, z: -2.7, face: 'right', head: 0, gait: 'down', busy: null, glass: false });
  state.actors.push(them);
  newMap(state, bus, { kind: 'street', seed: int(r, 1e9), row: 0, i0: null, i1: null, crowd: 0.15 }, x, [them.id]);
  say(state, bus, { kind: 'note', text: 'Cobbles, cold and wet. Moscow, three in the morning, years on, and you\'re on your back in a side street. Somebody hit you hard enough to send you back to the Farm.' });
  say(state, bus, { kind: 'note', text: 'He\'s waiting for you to get up: FSB, by the way he stands. He\'s good. You\'re better. You\'ve been better since Hale.' });
  Object.assign(sc, { phase: 'rise', rose: state.tick, with: 'fsb' });
  bus?.emit('brief', {
    title: 'MOSCOW, YEARS ON',
    body: [`${me.name}, nineteen years on: an illegal, no embassy behind you, in Moscow under a name that isn't yours.`,
      'Somebody hit you from behind, and the cobbles came up. He\'s FSB, he\'s strong, and he wants you on your feet so he can put you down properly.',
      'You\'re as good now as Hale was then. This one isn\'t a bout: nobody stops it. It ends with one of you on the ground.'],
    footer: 'Moscow · 02:55',
    keys: [['hit', 'hit'], ['grapple', 'grab'], ['guard', 'cover'], ['run', 'held with a move: an edge (with a cover: hit back)'], ['sheet', 'your sheet: what you are now']],
  });
}

/** On your feet: he comes on. */
function beginPresent(state, bus) {
  const me = playerOf(state);
  beginFight(state, bus, actorOfWho(state, 'fsb'), { style: 'striker', owner: 'dojo', marks: { a: { x: me.x, z: me.z }, b: { x: me.x + FIGHT.gap, z: me.z } } });
  state.scenario.phase = 'present';
}

/** One of you on the cobbles. */
function presentOver(state, bus, f) {
  const sc = state.scenario, won = f.ended.by === 'a';
  Object.assign(sc, { phase: 'done', outcome: won ? 'won' : 'lost' });
  sc.endText = won && state.people.fsb?.dead ? 'He doesn\'t get up, and he isn\'t going to: no breath, nothing. You take his radio and walk out of the street the way a man walks home. It\'s a killing now, and the FSB doesn\'t forget its own.'
    : won ? 'He doesn\'t get up. You stand over him long enough to be sure, take his radio, and walk out of the street the way a man walks home: unhurried, nobody. Hale would have called it adequate.'
      : state.people[state.player]?.dead ? 'The cobbles, cold and wet, and then nothing at all. In the morning a street sweeper finds a man with no papers worth the name.'
        : 'The cobbles again, and this time they stay. Boots, a car door, a hood. Somewhere a long way off, Hale is saying something about the ones who learn.';
  bus?.emit('scenario-end', sc.outcome);
}

/** A classmate dead on the mat: the lesson, and the course, over for you. */
function dismissed(state, bus, who) {
  const sc = state.scenario;
  Object.assign(sc, { outcome: 'dismissed', phase: 'done' });
  sc.endText = `They take ${short(state, who)} out on a stretcher with a blanket over the face. By the evening you're in a car to the gate, and someone from the Office of Security is in the back seat with you, saying nothing.`;
  bus?.emit('scenario-end', sc.outcome);
}

function over(state, bus) {
  const sc = state.scenario, won = sc.bouts.filter(b => b.won).length;
  sc.outcome = won === BOUTS ? 'top' : won ? 'passed' : 'just';
  sc.phase = 'done';
  sc.endText = won === BOUTS ? 'Hale looks at you for a long moment. “Again tomorrow. Earlier.” From Hale, that\'s a medal.'
    : won ? '“Ice what needs icing. Tomorrow, knives.” The class files out to the showers.'
      : '“Everyone loses here. The ones who learn something lose less on the street.” The class files out to the showers.';
  bus?.emit('scenario-end', sc.outcome);
}

// ---------- the instinct: what to do now ----------

function instinct(state) {
  const sc = state.scenario, f = state.fight, step = STEPS[sc.step];
  const L = (id, tone, text, act = null) => ({ id, tone, text, act });
  if (sc.with === 'fsb' || sc.phase === 'cut') {
    if (sc.phase === 'cut') return L('cut', 'calm', '…');
    if (sc.phase === 'rise') return L('rise', 'calm', 'Get up.');
    return f ? L(`choose-${f.round}`, 'warn', 'He\'s good. You\'re better. Nobody stops this one.') : L('wait', 'calm', '…');
  }
  if (sc.phase === 'ready' && sc.chapter === 'remembered' && !sc.bouts.length) return L('start', 'note', 'The bouts, as you remember them. {instinct} step onto the mat.', 'next');
  if (sc.phase === 'ready') return sc.step < 0 ? L('start', 'note', 'Hale is waiting. {instinct} step onto the mat.', 'next') : L('next', 'note', STEPS[sc.step + 1] ? 'Catch your breath. {instinct} when you\'re ready for the next.' : 'That\'s the lesson. {instinct} to finish.', 'next');
  if (sc.phase === 'walk') return L('walk', 'calm', 'Onto the mat.');
  if (!f) return L('wait', 'calm', 'Wait for Hale.');
  return L(`choose-${f.round}`, step.bout ? 'warn' : 'note', `${fill(state, sc.with, step.hint)}`);
}
